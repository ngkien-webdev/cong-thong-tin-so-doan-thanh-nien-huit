/** Add-on for the existing Vietnamese 17-column Apps Script project.
 * Keep the original project functions; route upgraded actions to these helpers.
 * Does not rename, migrate, or overwrite existing application columns.
 */
const PORTAL_V3_HEADERS = {
  PortalRequests: ['id','uid','applicationId','createdAt'],
  MailQueue: ['id','applicationId','recipient','studentName','dueAt','state','attempts','updatedAt','sentAt','error'],
  Hardcopies: ['applicationId','receivedAt','receivedBy','note'],
  AuditLog: ['id','actorUid','applicationId','fromStatus','toStatus','note','createdAt'],
  StudentProfiles: ['uid','studentName','studentId','phone','updatedAt'],
  ApplicationExtras: ['applicationId','phone','deliveryMethod','deliveryPhone','deliveryAddress','unitId','unitName','createdAt'],
  PortalUnits: ['id','name','type','active','createdAt','updatedAt','updatedBy'],
  UnitMembers: ['email','uid','unitId','active','username','displayName','createdAt','updatedAt','updatedBy'],
  AdminAccounts: ['uid','email','username','displayName','active','createdAt','updatedAt','updatedBy']
};
const PORTAL_V3_STATUSES = ['Đang xử lý','Yêu cầu bổ sung','Hoàn thành','Từ chối'];

function portalV3Fail_(code,message) { const e=new Error(message);e.code=code;e.publicMessage=message;throw e; }
function portalV3Text_(value,min,max,label) {
  if(typeof value!=='string'||value.trim().length<min||value.length>max)portalV3Fail_('INVALID_INPUT',label+' không hợp lệ.');
  return value.trim();
}
function portalV3Fold_(value) { return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim(); }
function portalV3IsPlan_(type) { return portalV3Fold_(type).startsWith('ke hoach'); }
function portalV3MailEnabled_() { return PropertiesService.getScriptProperties().getProperty('MAIL_ENABLED')==='true'; }
function portalV3Capabilities_() {
  return {version:3,profile:1,delivery:1,units:1,unitAccounts:1,actions:['listAdminApplications','getApplicationDetails','updateApplication','recordHardcopy','listMailJobs','retryReminder','listUnitsAdmin','saveUnitAdmin','listUnitMembersAdmin','saveUnitMemberAdmin','createUnitAccountAdmin'],reminders:{enabled:portalV3MailEnabled_(),timezone:'Asia/Ho_Chi_Minh',hour:8}};
}
// Per-execution references only. Never store authorization in ScriptCache.
let PORTAL_V4_REQUEST = null;
function portalV4BeginRequest_() { PORTAL_V4_REQUEST={sheets:{},rows:{},book:null}; }
function portalV3Book_() {
  if(!PORTAL_V4_REQUEST)portalV4BeginRequest_();
  if(!PORTAL_V4_REQUEST.book)PORTAL_V4_REQUEST.book=getApplicationSheet_().getParent();
  return PORTAL_V4_REQUEST.book;
}
function portalV3Sheet_(name) {
  if(!PORTAL_V4_REQUEST)portalV4BeginRequest_();
  if(PORTAL_V4_REQUEST.sheets[name])return PORTAL_V4_REQUEST.sheets[name];
  const sheet=portalV3Book_().getSheetByName(name),headers=PORTAL_V3_HEADERS[name];
  if(!sheet)portalV3Fail_('SCHEMA_REQUIRED','Chưa có bảng '+name+'. Chạy setupPortalUpgrade trước khi triển khai.');
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if(headers.some((h,i)=>actual[i]!==h))portalV3Fail_('SCHEMA_MISMATCH','Cấu trúc bảng '+name+' chưa phù hợp. Không tự ghi đè dữ liệu.');
  PORTAL_V4_REQUEST.sheets[name]=sheet;return sheet;
}
function portalV3Rows_(name) {
  if(!PORTAL_V4_REQUEST)portalV4BeginRequest_();
  if(PORTAL_V4_REQUEST.rows[name])return PORTAL_V4_REQUEST.rows[name];
  const sheet=portalV3Sheet_(name),headers=PORTAL_V3_HEADERS[name];
  const lastRow=sheet.getLastRow();
  if(lastRow<2)return PORTAL_V4_REQUEST.rows[name]=[];
  return PORTAL_V4_REQUEST.rows[name]=sheet.getRange(2,1,lastRow-1,headers.length).getValues().map((row,i)=>{
    const data={_row:i+1};headers.forEach((h,j)=>data[h]=row[j] instanceof Date?row[j].toISOString():row[j]);return data;
  }).filter(r=>r[headers[0]]!=='');
}
function portalV3Cells_(values) { return {values:values.map(v=>({userEnteredValue:typeof v==='number'&&Number.isFinite(v)?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v instanceof Date?v.toISOString():String(v===undefined||v===null?'':v)}}))}; }
function portalV3Append_(name,data) {
  return {appendCells:{sheetId:portalV3Sheet_(name).getSheetId(),rows:[portalV3Cells_(PORTAL_V3_HEADERS[name].map(h=>data[h]))],fields:'userEnteredValue'}};
}
function portalV3Update_(name,data) {
  return portalV3RowUpdate_(portalV3Sheet_(name),data._row,PORTAL_V3_HEADERS[name].map(h=>data[h]));
}
function portalV3RowUpdate_(sheet,row,values) {
  return {updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:row,endRowIndex:row+1,startColumnIndex:0,endColumnIndex:values.length},rows:[portalV3Cells_(values)],fields:'userEnteredValue'}};
}
function portalV3ColumnUpdate_(sheet,row,column,values) {
  return {updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:row,endRowIndex:row+1,startColumnIndex:column,endColumnIndex:column+values.length},rows:[portalV3Cells_(values)],fields:'userEnteredValue'}};
}
function portalV3AppendValues_(sheet,values) { return {appendCells:{sheetId:sheet.getSheetId(),rows:[portalV3Cells_(values)],fields:'userEnteredValue'}}; }
function portalV3Batch_(requests) {
  if(PORTAL_V4_REQUEST)PORTAL_V4_REQUEST.rows={};
  const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(portalV3Book_().getId())+':batchUpdate',{
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests}),muteHttpExceptions:true
  });
  if(response.getResponseCode()<200||response.getResponseCode()>=300)portalV3Fail_('DATABASE_ERROR','Chưa xác nhận được lần lưu dữ liệu. Tải lại danh sách trước khi thử lại.');
}
function portalV3Lock_(callback) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))portalV3Fail_('BUSY','Hệ thống đang bận. Vui lòng thử lại.');
  try{return callback();}finally{lock.releaseLock();}
}
function setupPortalUpgrade() {
  portalV4BeginRequest_();
  const book=portalV3Book_();
  Object.keys(PORTAL_V3_HEADERS).forEach(name=>{
    if(book.getSheetByName(name)){portalV3Sheet_(name);return;}
    const sheet=book.insertSheet(name);sheet.getRange(1,1,1,PORTAL_V3_HEADERS[name].length).setValues([PORTAL_V3_HEADERS[name]]);sheet.setFrozenRows(1);
  });
  return {success:true,message:'Đã kiểm tra và tạo các bảng bổ sung. Dữ liệu hồ sơ cũ được giữ nguyên.'};
}
function portalV3NextMorning_(submittedAt) {
  const instant=new Date(submittedAt);if(!Number.isFinite(instant.getTime()))portalV3Fail_('INVALID_INPUT','Ngày gửi không hợp lệ.');
  const vn=new Date(instant.getTime()+7*3600000);
  return new Date(Date.UTC(vn.getUTCFullYear(),vn.getUTCMonth(),vn.getUTCDate()+1,1)).toISOString();
}
function portalV3Reminder_(a) {
  return {id:'hardcopy-'+a.id,applicationId:a.id,recipient:a.email,studentName:a.studentName,dueAt:portalV3NextMorning_(a.submittedAt),state:'pending',attempts:0,updatedAt:a.submittedAt,sentAt:'',error:''};
}
function portalV3Page_(body) {
  const page=Number(body.page||1),pageSize=Number(body.pageSize||20);
  if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)portalV3Fail_('INVALID_INPUT','Phân trang không hợp lệ.');
  return {page,pageSize};
}
function portalV3Join_(a,jobs,receipts,privateView) {
  const job=jobs.find(j=>j.applicationId===a.id),receipt=receipts.find(r=>r.applicationId===a.id);
  const result=Object.assign({},a);delete result._row;delete result._values;
  result.reminder=job?(privateView?{dueAt:job.dueAt,state:job.state}:portalV3Public_(job)):null;
  result.hardcopy=receipt?(privateView?{receivedAt:receipt.receivedAt}:portalV3Public_(receipt)):null;return result;
}
function portalV3Public_(data) { const result=Object.assign({},data);delete result._row;delete result._values;return result; }
function portalV3ListAdmin_(body) {
  const paging=portalV3Page_(body),all=portalV3Applications_(),receipts=portalV3Rows_('Hardcopies'),jobs=portalV3Rows_('MailQueue');
  const received=new Set(receipts.map(r=>r.applicationId)),summary={total:all.length,pending:0,supplement:0,completed:0,rejected:0,awaitingHardcopy:0};
  all.forEach(a=>{const key={'Đang xử lý':'pending','Yêu cầu bổ sung':'supplement','Hoàn thành':'completed','Từ chối':'rejected'}[a.status];if(key)summary[key]++;if(portalV3IsPlan_(a.docType)&&a.status!=='Từ chối'&&!received.has(a.id))summary.awaitingHardcopy++;});
  const query=portalV3Fold_(portalV3Text_(body.query||'',0,150,'Từ khóa')),from=body.from||'',to=body.to||'';
  if([from,to].some(s=>s&&!/^\d{4}-\d{2}-\d{2}$/.test(s))||(from&&to&&from>to))portalV3Fail_('INVALID_INPUT','Khoảng ngày không hợp lệ.');
  const filtered=all.filter(a=>{
    const stamp=new Date(a.submittedAt),day=Number.isFinite(stamp.getTime())?Utilities.formatDate(stamp,'Asia/Ho_Chi_Minh','yyyy-MM-dd'):'';
    return (!query||portalV3Fold_([a.id,a.studentName,a.studentId,a.docType,a.email,a.phone,a.unitName].join(' ')).includes(query))&&(!body.status||a.status===body.status)&&(!body.docType||a.docType===body.docType)&&(!body.unitId||a.unitId===body.unitId)
      &&(!from||(day&&day>=from))&&(!to||(day&&day<=to))&&(!body.awaitingHardcopy||(portalV3IsPlan_(a.docType)&&!received.has(a.id)&&a.status!=='Từ chối'));
  }).sort((a,b)=>{const x=Date.parse(a.submittedAt),y=Date.parse(b.submittedAt);if(!Number.isFinite(x))return Number.isFinite(y)?1:0;if(!Number.isFinite(y))return -1;return(y-x)*(body.sort==='oldest'?-1:1);});
  const page=Math.min(paging.page,Math.max(1,Math.ceil(filtered.length/paging.pageSize)));
  return {success:true,applications:filtered.slice((page-1)*paging.pageSize,page*paging.pageSize).map(a=>portalV3Join_(a,jobs,receipts,false)),total:filtered.length,page,pageSize:paging.pageSize,summary,docTypes:[...new Set(all.map(a=>a.docType))].sort(),hasMore:page*paging.pageSize<filtered.length};
}
function portalV3Details_(body) {
  const id=portalV3Text_(body.applicationId,1,150,'Mã hồ sơ'),a=portalV3Applications_().find(r=>r.id===id);
  if(!a)portalV3Fail_('NOT_FOUND','Không tìm thấy hồ sơ.');
  const joined=portalV3Join_(a,portalV3Rows_('MailQueue'),portalV3Rows_('Hardcopies'),false);
  return {success:true,application:portalV3Public_(a),hardcopy:joined.hardcopy,reminder:joined.reminder,audit:portalV3Rows_('AuditLog').filter(r=>r.applicationId===id).reverse().slice(0,50).map(portalV3Public_)};
}
function portalV3Receive_(user,body) {
  const id=portalV3Text_(body.applicationId,1,150,'Mã hồ sơ'),note=portalV3Text_(body.note||'',0,500,'Ghi chú');
  return portalV3Lock_(()=>{
    const a=portalV3Applications_().find(r=>r.id===id);if(!a||!portalV3IsPlan_(a.docType))portalV3Fail_('INVALID_INPUT','Hồ sơ này không thuộc nhóm kế hoạch.');
    const existing=portalV3Rows_('Hardcopies').find(r=>r.applicationId===id);if(existing)return {success:true,hardcopy:portalV3Public_(existing)};
    const now=new Date().toISOString(),receipt={applicationId:id,receivedAt:now,receivedBy:user.uid,note};
    const requests=[portalV3Append_('Hardcopies',receipt),portalV3Append_('AuditLog',{id:Utilities.getUuid(),actorUid:user.uid,applicationId:id,fromStatus:a.status,toStatus:a.status,note:'Đã nhận bản cứng. '+note,createdAt:now})];
    const job=portalV3Rows_('MailQueue').find(j=>j.applicationId===id);if(job&&job.state==='pending')requests.push(portalV3Update_('MailQueue',Object.assign({},job,{state:'cancelled',updatedAt:now,error:'Đã nhận bản cứng.'})));
    portalV3Batch_(requests);return {success:true,hardcopy:receipt};
  });
}
function portalV3ListJobs_(body) {
  const paging=portalV3Page_(body),all=portalV3Rows_('MailQueue').reverse(),filtered=all.filter(j=>!body.state||j.state===body.state),page=Math.min(paging.page,Math.max(1,Math.ceil(filtered.length/paging.pageSize)));
  return {success:true,jobs:filtered.slice((page-1)*paging.pageSize,page*paging.pageSize).map(portalV3Public_),total:filtered.length,page,pageSize:paging.pageSize,enabled:portalV3MailEnabled_(),summary:{pending:all.filter(j=>j.state==='pending').length,sent:all.filter(j=>j.state==='sent').length,uncertain:all.filter(j=>j.state==='uncertain'||j.state==='sending').length,cancelled:all.filter(j=>j.state==='cancelled').length}};
}
function portalV3Retry_(user,body) {
  if(body.confirmDuplicateRisk!==true)portalV3Fail_('CONFIRM_REQUIRED','Cần xác nhận đã kiểm tra kết quả trước khi gửi lại.');
  return portalV3Lock_(()=>{
    const job=portalV3Rows_('MailQueue').find(j=>j.id===body.jobId);if(!job||job.state!=='uncertain')portalV3Fail_('CONFLICT','Trạng thái email đã đổi. Hãy tải lại danh sách.');
    const now=new Date().toISOString(),next=Object.assign({},job,{state:'pending',updatedAt:now,error:''});
    portalV3Batch_([portalV3Update_('MailQueue',next),portalV3Append_('AuditLog',{id:Utilities.getUuid(),actorUid:user.uid,applicationId:job.applicationId,fromStatus:'uncertain',toStatus:'pending',note:'Quản trị viên xác nhận gửi lại email.',createdAt:now})]);
    return {success:true,job:portalV3Public_(next)};
  });
}
function portalV3SaveJob_(job) { portalV3Batch_([portalV3Update_('MailQueue',job)]); }
function portalV3ReminderMessage_(job) {
  return {to:job.recipient,subject:'[Đoàn - Hội HUIT] Nhắc nộp bản cứng hồ sơ kế hoạch '+job.applicationId,name:'Đoàn - Hội HUIT',body:[
    'Chào '+job.studentName+',','','Hệ thống đã tiếp nhận hồ sơ kế hoạch của bạn với mã '+job.applicationId+'.',
    'Vui lòng nộp bản cứng hồ sơ kế hoạch tại Văn phòng Đoàn trường để hoàn tất việc tiếp nhận.',
    'Khi đến nộp, vui lòng cung cấp mã hồ sơ để cán bộ đối chiếu.','',
    'Nếu bạn đã nộp bản cứng, vui lòng bỏ qua email này và liên hệ Văn phòng Đoàn để xác nhận.','','Đoàn Thanh niên - Hội Sinh viên HUIT'
  ].join('\n')};
}
function portalV3ProcessReminderQueue() {
  portalV4BeginRequest_();
  if(!portalV3MailEnabled_())return;
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const started=Date.now(),now=new Date(),jobs=portalV3Rows_('MailQueue'),apps=new Map(portalV3Applications_().map(a=>[a.id,a])),receipts=new Set(portalV3Rows_('Hardcopies').map(r=>r.applicationId));
    let remaining=MailApp.getRemainingDailyQuota(),handled=0;
    for(const job of jobs) {
      if(handled>=20||Date.now()-started>=45000)break;
      if(job.state==='sending'&&(!Number.isFinite(Date.parse(job.updatedAt))||now-new Date(job.updatedAt)>10*60000)) {
        portalV3SaveJob_(Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Lần gửi trước bị gián đoạn; cần kiểm tra trước khi gửi lại.'}));handled++;continue;
      }
      if(job.state!=='pending')continue;
      const due=new Date(job.dueAt);
      if(!Number.isFinite(due.getTime())){portalV3SaveJob_(Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Lịch gửi không hợp lệ.'}));handled++;continue;}
      if(due>now)continue;
      const a=apps.get(job.applicationId);
      if(!a||!portalV3IsPlan_(a.docType)||a.status==='Từ chối'||receipts.has(job.applicationId)){portalV3SaveJob_(Object.assign({},job,{state:'cancelled',updatedAt:now.toISOString(),error:'Không còn cần nhắc nộp bản cứng.'}));handled++;continue;}
      if(typeof portalV4IsUnitEmail_==='function'&&portalV4IsUnitEmail_(a.email)){portalV3SaveJob_(Object.assign({},job,{state:'cancelled',updatedAt:now.toISOString(),error:'Tài khoản đơn vị theo dõi thông báo trong hệ thống.'}));handled++;continue;}
      if(job.recipient!==a.email){portalV3SaveJob_(Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Người nhận không khớp hồ sơ.'}));handled++;continue;}
      if(remaining<1)break;
      const sending=Object.assign({},job,{state:'sending',attempts:Number(job.attempts||0)+1,updatedAt:now.toISOString(),error:''});portalV3SaveJob_(sending);handled++;
      try{MailApp.sendEmail(portalV3ReminderMessage_(job));remaining--;portalV3SaveJob_(Object.assign({},sending,{state:'sent',sentAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));}
      catch(error){portalV3SaveJob_(Object.assign({},sending,{state:'uncertain',updatedAt:new Date().toISOString(),error:'Không xác nhận được kết quả gửi. Cần kiểm tra trước khi gửi lại.'}));}
    }
  }finally{lock.releaseLock();}
}
function installPortalReminderTrigger() {
  portalV3Book_();portalV3Sheet_('MailQueue');portalV3Sheet_('Hardcopies');MailApp.getRemainingDailyQuota();
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='portalV3ProcessReminderQueue'))ScriptApp.newTrigger('portalV3ProcessReminderQueue').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty('MAIL_ENABLED','true');
}
function pausePortalReminderEmails() { PropertiesService.getScriptProperties().setProperty('MAIL_ENABLED','false'); }

/** Keep physical row offsets even if operators left blank lines in Sheets. */
function portalV3Applications_() {
  const applications=readRows_(getApplicationSheet_(),APPLICATION_HEADERS.length).map((row,index)=>{
    const a=applicationFromRow_(row);a.email=a.studentEmail;a._row=index+1;a._values=row;return a;
  }).filter(a=>a.id);
  return typeof portalV4JoinExtras_==='function'?portalV4JoinExtras_(applications):applications;
}
function portalV3Route_(action,body) {
  const user=authenticate_(body.authToken,true);
  switch(action) {
    case 'listAdminApplications':case 'listApplications':return portalV3ListAdmin_(body);
    case 'getApplicationDetails':return portalV3Details_(body);
    case 'updateApplication':case 'updateApplicationStatus':return portalV3Status_(user,body,action==='updateApplication');
    case 'recordHardcopy':return portalV3Receive_(user,body);
    case 'listMailJobs':return portalV3ListJobs_(body);
    case 'retryReminder':return portalV3Retry_(user,body);
    default:portalV3Fail_('UNKNOWN_ACTION','Thao tác không hợp lệ.');
  }
}
function portalV3ListMine_(body) {
  const user=authenticate_(body.authToken,false),jobs=portalV3Rows_('MailQueue'),receipts=portalV3Rows_('Hardcopies');
  if(typeof portalV4IsUnitEmail_==='function'&&portalV4IsUnitEmail_(user.email)&&!portalV4Membership_(user))portalV3Fail_('UNIT_ACCESS_REQUIRED','Tài khoản đơn vị đã bị ngừng hoạt động.');
  return {success:true,applications:portalV3Applications_().filter(a=>a.uid===user.uid).sort(sortNewestFirst_).map(a=>portalV3Join_(a,jobs,receipts,true))};
}
function portalV3CreateResult_(application) {
  const job=portalV3Rows_('MailQueue').find(j=>j.applicationId===application.id);
  return {success:true,application:portalV3Public_(application),reminder:job?{dueAt:job.dueAt,enabled:portalV3MailEnabled_(),state:job.state}:null};
}
function portalV3Create_(body) {
  const user=authenticate_(body.authToken,false);
  if(user.isAnonymous)portalV3Fail_('GUEST_NOT_ALLOWED','Chế độ khách không thể nộp hồ sơ.');
  const requestId=body.requestId?portalV3Text_(body.requestId,8,100,'Mã yêu cầu'):Utilities.getUuid();
  return portalV3Lock_(()=>{
    const raw=body.application||body,membership=typeof portalV4Membership_==='function'?portalV4Membership_(user):null;
    if(!user.emailVerified&&!membership)portalV3Fail_('EMAIL_NOT_VERIFIED','Vui lòng xác minh email trước khi nộp hồ sơ.');
    const extra=typeof portalV4ApplicationInput_==='function'?portalV4ApplicationInput_(raw,user,membership):null;
    const unit=extra&&extra.unitId?portalV4Unit_(extra.unitId):null;
    const input=validateApplication_(unit?Object.assign({},raw,{studentName:unit.name,studentId:unit.id,studentEmail:user.email}):raw,user);
    const all=portalV3Applications_(),previous=portalV3Rows_('PortalRequests').find(r=>r.uid===user.uid&&r.id===requestId);
    if(previous){const saved=all.find(a=>a.id===previous.applicationId&&a.uid===user.uid);if(!saved)portalV3Fail_('CONFLICT','Hồ sơ đã tiếp nhận nhưng chưa tìm thấy dữ liệu. Liên hệ quản trị trước khi nộp lại.');return portalV3CreateResult_(saved);}
    checkSubmissionRate_(user.uid);
    const sheet=getApplicationSheet_(),logSheet=getLogSheet_();portalV3Sheet_('AuditLog');if(portalV3IsPlan_(input.docType))portalV3Sheet_('MailQueue');
    let id=generateApplicationId_();for(let i=0;all.some(a=>a.id===id)&&i<5;i++)id=generateApplicationId_();
    if(all.some(a=>a.id===id))portalV3Fail_('BUSY','Chưa tạo được mã hồ sơ. Vui lòng thử lại.');
    const now=new Date().toISOString();let uploaded=null,batchStarted=false;
    try {
      if(input.file)uploaded=uploadFile_(input.file,id,user.uid);
      const values=[id,user.uid,input.studentName,input.studentId,input.studentEmail,input.docType,input.reason,uploaded?uploaded.getName():'Không có tệp',uploaded?uploaded.getId():'',uploaded?uploaded.getUrl():'','Đang xử lý',now,now,'','','Chưa gửi',0];
      const application=Object.assign(applicationFromRow_(values),extra||{});application.email=application.studentEmail;
      const reminder=portalV3IsPlan_(input.docType)&&!(typeof portalV4IsUnitEmail_==='function'&&portalV4IsUnitEmail_(user.email))?portalV3Reminder_(application):null;
      const requests=[portalV3AppendValues_(sheet,values),portalV3Append_('PortalRequests',{id:requestId,uid:user.uid,applicationId:id,createdAt:now}),
        portalV3Append_('AuditLog',{id:Utilities.getUuid(),actorUid:user.uid,applicationId:id,fromStatus:'',toStatus:'Đang xử lý',note:'Sinh viên nộp hồ sơ mới.',createdAt:now}),
        portalV3AppendValues_(logSheet,[now,'CREATE_APPLICATION',id,user.uid,user.email,'Sinh viên nộp hồ sơ mới.'])];
      if(reminder)requests.push(portalV3Append_('MailQueue',reminder));
      if(extra)requests.push(portalV3Append_('ApplicationExtras',Object.assign({},extra,{applicationId:id,createdAt:now})));
      // A lost batch response may still have committed. Keep its Drive file.
      batchStarted=true;portalV3Batch_(requests);
      return {success:true,application,reminder:reminder?{dueAt:reminder.dueAt,enabled:portalV3MailEnabled_(),state:reminder.state}:null};
    }catch(error){if(uploaded&&!batchStarted){try{uploaded.setTrashed(true);}catch(ignored){}}throw error;}
  });
}
function portalV3Status_(admin,body,requireVersion) {
  const id=portalV3Text_(body.applicationId,1,150,'Mã hồ sơ'),status=body.status,note=portalV3Text_(body.note||'',0,2000,'Ghi chú');
  if(!PORTAL_V3_STATUSES.includes(status))portalV3Fail_('INVALID_STATUS','Trạng thái hồ sơ không hợp lệ.');
  if(status==='Yêu cầu bổ sung'&&note.length<5)portalV3Fail_('NOTE_REQUIRED','Vui lòng ghi rõ nội dung cần bổ sung.');
  if(requireVersion&&(typeof body.expectedStatus!=='string'||typeof body.expectedUpdatedAt!=='string'))portalV3Fail_('CONFLICT','Vui lòng tải lại hồ sơ trước khi cập nhật.');
  return portalV3Lock_(()=>{
    const a=portalV3Applications_().find(r=>r.id===id);if(!a)portalV3Fail_('NOT_FOUND','Không tìm thấy hồ sơ.');
    if((body.expectedStatus!==undefined&&a.status!==body.expectedStatus)||(body.expectedUpdatedAt!==undefined&&a.updatedAt!==body.expectedUpdatedAt))portalV3Fail_('CONFLICT','Hồ sơ đã được người khác cập nhật. Tải lại trước khi lưu.');
    const now=new Date().toISOString(),changed=a.status!==status,sendMail=changed&&['Hoàn thành','Yêu cầu bổ sung'].includes(status)&&!(typeof portalV4IsUnitEmail_==='function'&&portalV4IsUnitEmail_(a.studentEmail)),sheet=getApplicationSheet_();
    // Touch only status + processing fields; retain original file ID, dates,
    // links, formulas, student data, and all unrelated columns exactly.
    const requests=[portalV3ColumnUpdate_(sheet,a._row,10,[status]),portalV3ColumnUpdate_(sheet,a._row,12,[now,note,admin.email]),portalV3ColumnUpdate_(sheet,a._row,16,[a.updateCount+1]),
      portalV3Append_('AuditLog',{id:Utilities.getUuid(),actorUid:admin.uid,applicationId:id,fromStatus:a.status,toStatus:status,note,createdAt:now}),
      portalV3AppendValues_(getLogSheet_(),[now,'UPDATE_STATUS',id,admin.uid,admin.email,a.status+' -> '+status+(note?' | '+note:'')])];
    let notification=null;
    if(changed||note){
      const title=status==='Hoàn thành'?'Hồ sơ đã hoàn thành':status==='Yêu cầu bổ sung'?'Hồ sơ cần bổ sung':'Trạng thái hồ sơ đã thay đổi';
      const message='Hồ sơ '+id+' đã chuyển sang trạng thái "'+status+'".'+(note?' Ghi chú: '+note:'');
      notification={id:'TB-'+Utilities.getUuid().replace(/-/g,'').substring(0,12).toUpperCase(),title,message,createdAt:now};
      requests.push(portalV3AppendValues_(getNotificationSheet_(),[notification.id,id,a.uid,a.studentEmail,title,message,status,now]));
    }
    if(sendMail)requests.push(portalV3ColumnUpdate_(sheet,a._row,15,['Đang gửi; cần kiểm tra nếu tiến trình bị gián đoạn.']));
    if(status==='Từ chối'){
      const job=portalV3Rows_('MailQueue').find(j=>j.applicationId===id);
      if(job&&job.state==='pending')requests.push(portalV3Update_('MailQueue',Object.assign({},job,{state:'cancelled',updatedAt:now,error:'Hồ sơ đã bị từ chối.'})));
    }
    portalV3Batch_(requests);
    let email={sent:false,skipped:true,message:'Trạng thái không cần gửi email.'};
    if(sendMail){
      try{email=sendStatusEmail_(a,status,note);}catch(error){email={sent:false,skipped:false,message:'Không xác nhận được kết quả gửi; cần kiểm tra trước khi gửi lại.'};}
      // Status is already committed. A failure to record email delivery must
      // never present the completed status change as an unsuccessful write.
      try{portalV3Batch_([portalV3ColumnUpdate_(sheet,a._row,15,[email.sent?'Đã gửi '+formatDateTime_(new Date()):'Cần kiểm tra: '+String(email.message||'Không xác nhận được kết quả').slice(0,250)])]);}
      catch(error){email.recorded=false;}
    }
    return {success:true,applicationId:id,status,application:{id,previousStatus:a.status,status,note,updatedAt:now},notification,email};
  });
}
