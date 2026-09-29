/** Apps Script backend reference. Configure Script Properties before deployment.
 * Existing spreadsheets MUST use the documented headers; never overwrite a live
 * project before reviewing its current schema and making a backup.
 */
const PORTAL_HEADERS = {
  Applications: ['id','uid','docType','studentName','studentId','email','fileName','fileUrl','reason','status','submittedAt','note','updatedAt','requestId'],
  Notifications: ['id','recipientUid','applicationId','title','message','status','createdAt'],
  AuditLog: ['id','actorUid','applicationId','fromStatus','toStatus','note','createdAt'],
  MailQueue: ['id','applicationId','recipient','studentName','dueAt','state','attempts','updatedAt','sentAt','error'],
  Hardcopies: ['applicationId','receivedAt','receivedBy','note']
};
const PORTAL_STATUSES = ['Đang xử lý','Yêu cầu bổ sung','Hoàn thành','Từ chối'];

function doPost(e) {
  try {
    if(!e || !e.postData || e.postData.contents.length > 7500000) fail_('INVALID_REQUEST','Yêu cầu không hợp lệ.');
    const payload=JSON.parse(e.postData.contents);
    const user=authenticate_(payload.authToken);
    let result;
    switch(payload.action) {
      case 'verifyAdmin': requireAdmin_(user); result={admin:{uid:user.localId,email:user.email,displayName:user.displayName||''},capabilities:portalCapabilities_()}; break;
      case 'createApplication': result=createApplication_(user,payload); break;
      case 'listMyApplications': {
        const own=records_('Applications').filter(r=>r.uid===user.localId).reverse();
        const jobs=new Map(records_('MailQueue').map(j=>[j.applicationId,j]));
        const receipts=new Map(records_('Hardcopies').map(r=>[r.applicationId,r]));
        result={applications:own.map(a=>Object.assign({},a,{reminder:jobs.has(a.id)?{dueAt:jobs.get(a.id).dueAt,state:jobs.get(a.id).state}:null,hardcopy:receipts.has(a.id)?{receivedAt:receipts.get(a.id).receivedAt}:null}))};break;
      }
      case 'listMyNotifications': result={notifications:records_('Notifications').filter(r=>r.recipientUid===user.localId).reverse().slice(0,100)};break;
      case 'listAdminApplications': {
        requireAdmin_(user);result=listAdminApplications_(payload);break;
      }
      case 'getApplicationDetails': requireAdmin_(user);result=applicationDetails_(payload);break;
      case 'recordHardcopy': requireAdmin_(user);result=recordHardcopy_(user,payload);break;
      case 'listMailJobs': requireAdmin_(user);result=listMailJobs_(payload);break;
      case 'retryReminder': requireAdmin_(user);result=retryReminder_(user,payload);break;
      case 'updateApplication':requireAdmin_(user);result=updateApplication_(user,payload);break;
      default:fail_('UNKNOWN_ACTION','API chưa hỗ trợ thao tác này. Kiểm tra phiên bản Apps Script.');
    }
    return json_(Object.assign({success:true},result));
  } catch(error) {
    console.error(error.code||'SERVER_ERROR');
    return json_({success:false,code:error.code||'SERVER_ERROR',message:error.code?error.message:'Không xử lý được yêu cầu. Kiểm tra cấu hình máy chủ.'});
  }
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function fail_(code,message){const error=new Error(message);error.code=code;throw error;}
function prop_(key){const value=PropertiesService.getScriptProperties().getProperty(key);if(!value)fail_('CONFIG_REQUIRED','Máy chủ chưa được cấu hình đầy đủ.');return value;}
function authenticate_(token) {
  if(typeof token!=='string'||token.length>10000)fail_('AUTH_INVALID','Vui lòng đăng nhập lại.');
  const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(prop_('FIREBASE_WEB_API_KEY')),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)fail_('AUTH_INVALID','Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  const data=JSON.parse(response.getContentText());const user=data.users&&data.users[0];
  if(!user||user.disabled||!user.email||!user.emailVerified)fail_('EMAIL_NOT_VERIFIED','Vui lòng đăng nhập bằng email đã xác minh.');
  // The lookup verifies the token remotely. Also require the configured audience.
  let claims;try{claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());}catch{fail_('AUTH_INVALID','Token không hợp lệ.');}
  if(claims.aud!==prop_('FIREBASE_PROJECT_ID')||claims.iss!=='https://securetoken.google.com/'+prop_('FIREBASE_PROJECT_ID')||claims.sub!==user.localId||claims.exp*1000<=Date.now())fail_('AUTH_INVALID','Token không thuộc hệ thống này.');
  return user;
}
function requireAdmin_(user) {
  const allowed=prop_('ADMIN_EMAILS').split(',').map(s=>s.trim().toLowerCase());
  if(!allowed.includes(user.email.toLowerCase()))fail_('FORBIDDEN','Tài khoản chưa được cấp quyền quản trị.');
}
function sheet_(name) {
  const book=SpreadsheetApp.openById(prop_('SPREADSHEET_ID'));
  const sheet=book.getSheetByName(name);
  if(!sheet)fail_('SCHEMA_REQUIRED','Chưa có bảng '+name+'. Cần khởi tạo hoặc ánh xạ dữ liệu theo hướng dẫn.');
  const expected=PORTAL_HEADERS[name];
  const actual=sheet.getRange(1,1,1,expected.length).getValues()[0];
  if(expected.some((header,i)=>actual[i]!==header))fail_('SCHEMA_MISMATCH','Cấu trúc bảng '+name+' chưa phù hợp. Không có dữ liệu nào bị ghi đè.');
  return sheet;
}
function records_(name) {
  const sheet=sheet_(name),headers=PORTAL_HEADERS[name];
  if(sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues().map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i] instanceof Date?row[i].toISOString():row[i]])));
}
function append_(name,data){const sheet=sheet_(name);const values=PORTAL_HEADERS[name].map(h=>data[h]===undefined?'':data[h]);const range=sheet.getRange(sheet.getLastRow()+1,1,1,values.length);range.setNumberFormat('@');range.setValues([values.map(v=>typeof v==='string'&&/^[=+@\-]/.test(v)?"'"+v:v)]);}
function text_(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.length>max)fail_('INVALID_INPUT',label+' không hợp lệ.');return value.trim();}
function createApplication_(user,payload) {
  const a=payload.application||{};
  const docType=text_(a.docType,1,150,'Loại hồ sơ'),studentName=text_(a.studentName,2,100,'Họ tên'),studentId=text_(a.studentId,5,30,'MSSV'),reason=text_(a.reason,10,3000,'Nội dung');
  if(!/^[A-Z0-9._-]{5,30}$/i.test(studentId)||String(a.studentEmail).toLowerCase()!==user.email.toLowerCase())fail_('INVALID_INPUT','MSSV hoặc email không hợp lệ.');
  const requestId=payload.requestId?text_(payload.requestId,8,100,'Mã yêu cầu'):Utilities.getUuid();
  let blob=null;
  if(a.file){const file=a.file;const mime={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};const name=text_(file.name,1,255,'Tên tệp');const ext=name.split('.').pop().toLowerCase();if(!mime[ext]||file.mimeType!==mime[ext]||typeof file.base64!=='string'||file.base64.length>7000000)fail_('INVALID_FILE','Loại tệp không hợp lệ.');let bytes;try{bytes=Utilities.base64Decode(file.base64);}catch{fail_('INVALID_FILE','Dữ liệu tệp không hợp lệ.');}if(!bytes.length||bytes.length>5*1024*1024)fail_('INVALID_FILE','Tệp phải từ 1 byte đến 5 MB.');blob=Utilities.newBlob(bytes,mime[ext],name);}
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_('BUSY','Hệ thống đang bận. Vui lòng thử lại.');
  let uploaded=null;
  try {
    const all=records_('Applications');const existing=all.find(r=>r.uid===user.localId&&r.requestId===requestId);if(existing)return {application:existing};
    if(all.some(r=>r.uid===user.localId&&Date.now()-new Date(r.submittedAt).getTime()<30000))fail_('RATE_LIMIT','Vui lòng đợi 30 giây giữa các lần nộp hồ sơ.');
    const now=new Date().toISOString();const application={id:'HS-'+Utilities.getUuid(),uid:user.localId,docType,studentName,studentId,email:user.email,fileName:'',fileUrl:'',reason,status:'Đang xử lý',submittedAt:now,note:'',updatedAt:now,requestId};
    if(blob){uploaded=DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(blob);application.fileName=blob.getName();application.fileUrl=uploaded.getUrl();}
    const reminder=isPlan_(docType)?makeReminder_(application):null;
    // Validate queue schema before writing so an application cannot lose its reminder.
    const requests=[appendRequest_('Applications',application)];
    if(reminder)requests.push(appendRequest_('MailQueue',reminder));
    // Preserve the Drive file on an ambiguous network failure; deleting it could
    // break an application committed by Sheets before the response was lost.
    uploaded=null;
    Sheets.Spreadsheets.batchUpdate({requests},prop_('SPREADSHEET_ID'));
    return {application,reminder:reminder?{dueAt:reminder.dueAt,enabled:mailEnabled_()}:null};
  } catch(error){if(uploaded){try{uploaded.setTrashed(true);}catch{}}throw error;} finally{lock.releaseLock();}
}
function updateApplication_(user,payload) {
  const id=text_(payload.applicationId,1,150,'Mã hồ sơ'),note=text_(payload.note||'',0,2000,'Ghi chú');
  if(!PORTAL_STATUSES.includes(payload.status))fail_('INVALID_INPUT','Trạng thái không hợp lệ.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_('BUSY','Hệ thống đang bận.');
  try {
    const applications=records_('Applications'),index=applications.findIndex(a=>a.id===id);
    if(index<0)fail_('NOT_FOUND','Không tìm thấy hồ sơ.');
    const application=applications[index];
    if(application.status!==payload.expectedStatus || (payload.expectedUpdatedAt !== undefined && application.updatedAt !== payload.expectedUpdatedAt))fail_('CONFLICT','Hồ sơ đã được người khác cập nhật. Đóng hộp thoại và làm mới danh sách.');
    const previous=application.status,now=new Date().toISOString();
    // Validate every destination before changing the application.
    sheet_('AuditLog');sheet_('Notifications');
    const eventId=Utilities.getUuid();
    const audit={id:eventId,actorUid:user.localId,applicationId:id,fromStatus:previous,toStatus:payload.status,note,createdAt:now};
    const notification={id:eventId,recipientUid:application.uid,applicationId:id,title:'Hồ sơ được cập nhật',message:note||('Trạng thái mới: '+payload.status),status:payload.status,createdAt:now};
    const updated=Object.assign({},application,{status:payload.status,note,updatedAt:now});
    const cells=(name,data)=>({values:PORTAL_HEADERS[name].map(h=>({userEnteredValue:{stringValue:String(data[h]||'')}}))});
    // Sheets batchUpdate is atomic: status, notification and audit commit together.
    Sheets.Spreadsheets.batchUpdate({requests:[
      {updateCells:{range:{sheetId:sheet_('Applications').getSheetId(),startRowIndex:index+1,endRowIndex:index+2,startColumnIndex:0,endColumnIndex:PORTAL_HEADERS.Applications.length},rows:[cells('Applications',updated)],fields:'userEnteredValue'}},
      {appendCells:{sheetId:sheet_('AuditLog').getSheetId(),rows:[cells('AuditLog',audit)],fields:'userEnteredValue'}},
      {appendCells:{sheetId:sheet_('Notifications').getSheetId(),rows:[cells('Notifications',notification)],fields:'userEnteredValue'}}
    ]},prop_('SPREADSHEET_ID'));
    return {applicationId:id,status:payload.status};
  } finally{lock.releaseLock();}
}
/** Run manually once on a NEW spreadsheet. Does not change existing tabs. */
function setupPortalSheets() {
  const book=SpreadsheetApp.openById(prop_('SPREADSHEET_ID'));
  for(const name of Object.keys(PORTAL_HEADERS)){
    if(book.getSheetByName(name))continue;
    const sheet=book.insertSheet(name);sheet.appendRow(PORTAL_HEADERS[name]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,PORTAL_HEADERS[name].length).setFontWeight('bold');
  }
}
