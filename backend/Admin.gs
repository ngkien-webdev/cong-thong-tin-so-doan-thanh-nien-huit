const PORTAL_API_VERSION = 3;
function portalCapabilities_() {
  return {version:PORTAL_API_VERSION,actions:['listAdminApplications','getApplicationDetails','updateApplication','recordHardcopy','listMailJobs','retryReminder'],reminders:{enabled:mailEnabled_(),timezone:'Asia/Ho_Chi_Minh',hour:8}};
}
function fold_(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();}
function isPlan_(docType){return fold_(docType).startsWith('ke hoach');}
function pageParams_(payload) {
  const page=Number(payload.page||1),pageSize=Number(payload.pageSize||20);
  if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)fail_('INVALID_INPUT','Phân trang không hợp lệ.');
  return {page,pageSize};
}
function listAdminApplications_(payload) {
  const paging=pageParams_(payload),all=records_('Applications'),receipts=records_('Hardcopies'),jobs=records_('MailQueue');
  const received=new Map(receipts.map(r=>[r.applicationId,r]));
  const queued=new Map(jobs.map(j=>[j.applicationId,j]));
  const summary={total:all.length,pending:0,supplement:0,completed:0,rejected:0,awaitingHardcopy:0};
  all.forEach(a=>{const key={'Đang xử lý':'pending','Yêu cầu bổ sung':'supplement','Hoàn thành':'completed','Từ chối':'rejected'}[a.status];if(key)summary[key]++;if(isPlan_(a.docType)&&!received.has(a.id)&&a.status!=='Từ chối')summary.awaitingHardcopy++;});
  const query=fold_(text_(payload.query||'',0,150,'Từ khóa'));
  const from=payload.from||'',to=payload.to||'';
  if([from,to].some(s=>s&&!/^\d{4}-\d{2}-\d{2}$/.test(s))||(from&&to&&from>to))fail_('INVALID_INPUT','Khoảng ngày không hợp lệ.');
  const filtered=all.filter(a=>{
    const day=Utilities.formatDate(new Date(a.submittedAt),'Asia/Ho_Chi_Minh','yyyy-MM-dd');
    return (!query||fold_([a.id,a.studentName,a.studentId,a.docType,a.email].join(' ')).includes(query))
      &&(!payload.status||a.status===payload.status)&&(!payload.docType||a.docType===payload.docType)
      &&(!from||day>=from)&&(!to||day<=to)
      &&(!payload.awaitingHardcopy||(isPlan_(a.docType)&&!received.has(a.id)&&a.status!=='Từ chối'));
  }).sort((a,b)=>(new Date(b.submittedAt)-new Date(a.submittedAt))*(payload.sort==='oldest'?-1:1));
  const page=Math.min(paging.page,Math.max(1,Math.ceil(filtered.length/paging.pageSize)));
  return {applications:filtered.slice((page-1)*paging.pageSize,page*paging.pageSize).map(a=>Object.assign({},a,{hardcopy:received.get(a.id)||null,reminder:queued.get(a.id)||null})),total:filtered.length,page,pageSize:paging.pageSize,summary,docTypes:[...new Set(all.map(a=>a.docType))].sort(),hasMore:page*paging.pageSize<filtered.length};
}
function applicationDetails_(payload) {
  const id=text_(payload.applicationId,1,150,'Mã hồ sơ');
  const application=records_('Applications').find(a=>a.id===id);
  if(!application)fail_('NOT_FOUND','Hồ sơ không còn tồn tại.');
  return {application,audit:records_('AuditLog').filter(r=>r.applicationId===id).reverse().slice(0,50),hardcopy:records_('Hardcopies').find(r=>r.applicationId===id)||null,reminder:records_('MailQueue').find(r=>r.applicationId===id)||null};
}
function cells_(name,data){return {values:PORTAL_HEADERS[name].map(h=>({userEnteredValue:{stringValue:String(data[h]===undefined?'':data[h])}}))};}
function appendRequest_(name,data){return {appendCells:{sheetId:sheet_(name).getSheetId(),rows:[cells_(name,data)],fields:'userEnteredValue'}};}
function updateRequest_(name,index,data){return {updateCells:{range:{sheetId:sheet_(name).getSheetId(),startRowIndex:index+1,endRowIndex:index+2,startColumnIndex:0,endColumnIndex:PORTAL_HEADERS[name].length},rows:[cells_(name,data)],fields:'userEnteredValue'}};}
function recordHardcopy_(user,payload) {
  const id=text_(payload.applicationId,1,150,'Mã hồ sơ'),note=text_(payload.note||'',0,500,'Ghi chú');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_('BUSY','Hệ thống đang bận. Vui lòng thử lại.');
  try {
    const application=records_('Applications').find(a=>a.id===id);
    if(!application||!isPlan_(application.docType))fail_('INVALID_INPUT','Hồ sơ này không thuộc nhóm kế hoạch cần nhận bản cứng.');
    const existing=records_('Hardcopies').find(r=>r.applicationId===id);if(existing)return {hardcopy:existing};
    const now=new Date().toISOString(),hardcopy={applicationId:id,receivedAt:now,receivedBy:user.localId,note};
    const requests=[appendRequest_('Hardcopies',hardcopy),appendRequest_('AuditLog',{id:Utilities.getUuid(),actorUid:user.localId,applicationId:id,fromStatus:application.status,toStatus:application.status,note:'Đã nhận bản cứng. '+note,createdAt:now})];
    const jobs=records_('MailQueue'),index=jobs.findIndex(j=>j.applicationId===id);
    if(index>=0&&jobs[index].state==='pending')requests.push(updateRequest_('MailQueue',index,Object.assign({},jobs[index],{state:'cancelled',updatedAt:now,error:'Đã nhận bản cứng trước khi gửi nhắc.'})));
    Sheets.Spreadsheets.batchUpdate({requests},prop_('SPREADSHEET_ID'));return {hardcopy};
  } finally{lock.releaseLock();}
}
function listMailJobs_(payload) {
  const {page:requested,pageSize}=pageParams_(payload);const all=records_('MailQueue').reverse();
  const filtered=all.filter(j=>!payload.state||j.state===payload.state);
  const page=Math.min(requested,Math.max(1,Math.ceil(filtered.length/pageSize)));
  return {jobs:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,page,pageSize,enabled:mailEnabled_(),summary:{pending:all.filter(j=>j.state==='pending').length,sent:all.filter(j=>j.state==='sent').length,uncertain:all.filter(j=>j.state==='uncertain'||j.state==='sending').length,cancelled:all.filter(j=>j.state==='cancelled').length}};
}
function retryReminder_(user,payload) {
  if(payload.confirmDuplicateRisk!==true)fail_('CONFIRM_REQUIRED','Cần xác nhận email có thể đã được gửi trước khi thử lại.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_('BUSY','Hệ thống đang bận.');
  try {
    const jobs=records_('MailQueue'),index=jobs.findIndex(j=>j.id===payload.jobId);
    if(index<0||jobs[index].state!=='uncertain')fail_('CONFLICT','Trạng thái email đã thay đổi. Hãy tải lại danh sách.');
    const job=jobs[index],now=new Date().toISOString();
    const next=Object.assign({},job,{state:'pending',updatedAt:now,error:''});
    Sheets.Spreadsheets.batchUpdate({requests:[updateRequest_('MailQueue',index,next),appendRequest_('AuditLog',{id:Utilities.getUuid(),actorUid:user.localId,applicationId:job.applicationId,fromStatus:'uncertain',toStatus:'pending',note:'Quản trị viên xác nhận đưa email vào hàng đợi gửi lại.',createdAt:now})]},prop_('SPREADSHEET_ID'));
    return {job:next};
  }finally{lock.releaseLock();}
}
