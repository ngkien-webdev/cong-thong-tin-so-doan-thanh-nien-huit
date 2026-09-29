import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=['Code.gs','Admin.gs','Mail.gs'].map(file=>fs.readFileSync(new URL('../backend/'+file,import.meta.url),'utf8')).join('\n');
function makeContext({now='2026-09-20T01:00:00Z',enabled=true,quota=10,sendError=false}={}){
  const RealDate=Date;class Clock extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return new RealDate(now).getTime();}}
  const mail=[],writes=[],records={Applications:[],MailQueue:[],Hardcopies:[],AuditLog:[]};
  const context=vm.createContext({console,Date:Clock,JSON,Object,Error,Map,Set,Number,encodeURIComponent,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='MAIL_ENABLED'?String(enabled):'test'})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:message=>{mail.push(message);if(sendError)throw new Error('ambiguous');}},
    Utilities:{getUuid:()=> 'job',formatDate:d=>new Date(d.getTime()+7*3600000).toISOString().slice(0,10)}
  });vm.runInContext(source,context);
  context.records_=name=>records[name];
  context.saveMailJob_=(index,job)=>{writes.push({...job});records.MailQueue[index]={...job};};
  const app={id:'HS-plan',uid:'student',studentName:'Sinh viên thử nghiệm',email:'test@example.com',docType:'Kế hoạch - Quyết định',status:'Đang xử lý',submittedAt:'2026-09-19T16:59:00Z'};
  records.Applications.push(app);records.MailQueue.push({...context.makeReminder_(app)});
  return {context,mail,writes,records,app};
}
test('8 AM next Vietnam calendar day at midnight, year and leap boundaries',()=>{
  const {context:c}=makeContext();
  assert.equal(c.nextMorning_('2026-09-19T16:59:59Z'),'2026-09-20T01:00:00.000Z');
  assert.equal(c.nextMorning_('2026-09-19T17:00:00Z'),'2026-09-21T01:00:00.000Z');
  assert.equal(c.nextMorning_('2026-12-31T10:00:00Z'),'2027-01-01T01:00:00.000Z');
  assert.equal(c.nextMorning_('2028-02-28T10:00:00Z'),'2028-02-29T01:00:00.000Z');
});
test('Before 8 AM no email is sent',()=>{const x=makeContext({now:'2026-09-20T00:59:59Z'});x.context.processReminderQueue();assert.equal(x.mail.length,0);});
test('At 8 AM send once and subsequent runs do not duplicate it',()=>{const x=makeContext();x.context.processReminderQueue();x.context.processReminderQueue();assert.equal(x.mail.length,1);assert.equal(x.mail[0].to,'test@example.com');assert.match(x.mail[0].body,/Văn phòng Đoàn trường/);assert.equal(x.records.MailQueue[0].state,'sent');assert.equal(x.writes[0].state,'sending');});
test('Received hardcopy and rejected application cancel pending reminders',()=>{for(const scenario of ['receipt','rejected']){const x=makeContext();if(scenario==='receipt')x.records.Hardcopies.push({applicationId:x.app.id});else x.app.status='Từ chối';x.context.processReminderQueue();assert.equal(x.mail.length,0);assert.equal(x.records.MailQueue[0].state,'cancelled');}});
test('Paused mail and exhausted quota keep jobs pending',()=>{for(const options of [{enabled:false},{quota:0}]){const x=makeContext(options);x.context.processReminderQueue();assert.equal(x.mail.length,0);assert.equal(x.records.MailQueue[0].state,'pending');}});
test('Ambiguous sending failure is not automatically retried',()=>{const x=makeContext({sendError:true});x.context.processReminderQueue();x.context.processReminderQueue();assert.equal(x.mail.length,1);assert.equal(x.records.MailQueue[0].state,'uncertain');});
test('Crash during sending needs manual review after lease expires',()=>{const x=makeContext();x.records.MailQueue[0].state='sending';x.records.MailQueue[0].updatedAt='2026-09-20T00:40:00Z';x.context.processReminderQueue();assert.equal(x.mail.length,0);assert.equal(x.records.MailQueue[0].state,'uncertain');});
test('Plan classification does not schedule other application types',()=>{const {context:c}=makeContext();assert.equal(c.isPlan_('Kế hoạch - Quyết định'),true);assert.equal(c.isPlan_('Chuyển sinh hoạt Đoàn'),false);});
test('Admin pagination includes old records and filters inclusive local date boundaries',()=>{const x=makeContext();x.records.Applications=[];for(let i=0;i<45;i++)x.records.Applications.push({...x.app,id:'HS-'+i,submittedAt:'2026-09-19T17:01:00Z',studentName:'Nguyễn An'});const result=x.context.listAdminApplications_({page:2,pageSize:20,query:'nguyen',from:'2026-09-20',to:'2026-09-20'});assert.equal(result.total,45);assert.equal(result.applications.length,20);assert.equal(result.page,2);assert.equal(result.summary.total,45);});
test('Invalid date range and out-of-bound pagination are rejected',()=>{const {context:c}=makeContext();assert.throws(()=>c.listAdminApplications_({from:'2026-09-21',to:'2026-09-19'}),e=>e.code==='INVALID_INPUT');assert.throws(()=>c.pageParams_({pageSize:1000}),e=>e.code==='INVALID_INPUT');});
test('Invalid schedule or mismatched recipient cannot send email',()=>{for(const change of [{dueAt:'invalid'},{recipient:'different@example.com'}]){const x=makeContext();Object.assign(x.records.MailQueue[0],change);x.context.processReminderQueue();assert.equal(x.mail.length,0);assert.equal(x.records.MailQueue[0].state,'uncertain');}});
