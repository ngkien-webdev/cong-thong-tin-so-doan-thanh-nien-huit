import fs from 'node:fs';
const root=new URL('../',import.meta.url);
let source=fs.readFileSync(new URL('backend/live-original/Original.gs',root),'utf8');
const replaceFunction=(name,replacement)=>{const pattern=new RegExp('function '+name+'\\([\\s\\S]*?\\n\\}','m');if(!pattern.test(source))throw new Error('Missing original '+name);source=source.replace(pattern,()=>replacement);};
replaceFunction('doGet',`function doGet(e) {
  portalV4BeginRequest_();
  try {
    const params=e&&e.parameter||{},action=params.action||'';
    if(['listPublicNews','getPublicNews','getNewsImage'].includes(action))return jsonOutput_(Object.assign({success:true},newsPublicRoute_(action,params)));
    if(action)throw apiError_('UNKNOWN_ACTION','Thao tác không hợp lệ.');
    return jsonOutput_({success:true,service:CONFIG.SYSTEM_NAME,version:3,newsVersion:1,accountsVersion:1,capabilities:{profile:1,delivery:1,units:1,unitAccounts:1},message:'API đang hoạt động.',timestamp:new Date().toISOString()});
  }catch(error){return jsonOutput_({success:false,code:error.code||'SERVER_ERROR',message:error.publicMessage||'Chưa tải được dữ liệu. Vui lòng thử lại.'});}
}`);
replaceFunction('doPost',`function doPost(e) {
  portalV4BeginRequest_();
  try {
    if(!e||!e.postData||e.postData.contents.length>7500000)throw apiError_('INVALID_REQUEST','Yêu cầu không hợp lệ.');
    const body=parseBody_(e),action=cleanText_(body.action,60);let result;
    switch(action){
      case 'createApplication':result=portalV3Create_(body);break;
      case 'listMyApplications':result=portalV3ListMine_(body);break;
      case 'listMyNotifications':result=listMyNotifications_(body);break;
      case 'verifyAdmin':result=verifyAdmin_(body);result.capabilities=portalV3Capabilities_();result.capabilities.news={version:1,actions:['listNewsAdmin','getNewsAdmin','saveNews']};break;
      case 'listApplications':case 'listAdminApplications':case 'updateApplicationStatus':case 'updateApplication':case 'getApplicationDetails':case 'recordHardcopy':case 'listMailJobs':case 'retryReminder':result=portalV3Route_(action,body);break;
      case 'listNewsAdmin':case 'getNewsAdmin':case 'saveNews':result=newsAdminRoute_(action,body);break;
      case 'getPortalContext':case 'saveMyProfile':case 'getUnitDashboard':case 'listUnitsAdmin':case 'saveUnitAdmin':case 'listUnitMembersAdmin':case 'saveUnitMemberAdmin':case 'createUnitAccountAdmin':result=portalV4Route_(action,body);break;
      default:throw apiError_('UNKNOWN_ACTION','Thao tác không hợp lệ.');
    }
    return jsonOutput_(Object.assign({success:true},result));
  }catch(error){console.error(error.code||'SERVER_ERROR');return jsonOutput_({success:false,code:error.code||'SERVER_ERROR',message:error.publicMessage||'Hệ thống chưa thể xử lý yêu cầu.'});}
}`);
replaceFunction('ensureSheet_',`function ensureSheet_(spreadsheet,name,headers) {
  let sheet=spreadsheet.getSheetByName(name);
  if(!sheet){sheet=spreadsheet.insertSheet(name);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);return sheet;}
  if(sheet.getMaxColumns()<headers.length)throw apiError_('SCHEMA_MISMATCH','Bảng '+name+' thiếu cột. Dữ liệu được giữ nguyên.');
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if(headers.some((h,i)=>h!==actual[i]))throw apiError_('SCHEMA_MISMATCH','Tiêu đề bảng '+name+' chưa khớp. Dữ liệu được giữ nguyên.');
  return sheet;
}`);
replaceFunction('authenticate_',`function authenticate_(idToken,requireAdmin) {
  const token=String(idToken||'').trim();
  if(token.length<100||token.length>10000)throw apiError_('AUTH_REQUIRED','Phiên đăng nhập không hợp lệ.');
  const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(requiredProperty_('FIREBASE_API_KEY')),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw apiError_('AUTH_EXPIRED','Phiên đăng nhập đã hết hạn.');
  const data=JSON.parse(response.getContentText()||'{}'),info=data.users&&data.users[0];
  if(!info||!info.localId||info.disabled)throw apiError_('AUTH_INVALID','Không thể xác thực tài khoản.');
  let decoded;try{decoded=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());}catch(error){throw apiError_('AUTH_INVALID','Phiên đăng nhập không hợp lệ.');}
  if(decoded.aud!=='huit-youth-portal'||decoded.iss!=='https://securetoken.google.com/huit-youth-portal'||decoded.sub!==info.localId||!(decoded.exp*1000>Date.now()))throw apiError_('AUTH_INVALID','Phiên đăng nhập không thuộc hệ thống.');
  let claims={};try{claims=JSON.parse(info.customAttributes||'{}');}catch(ignored){}
  const user={uid:String(info.localId),email:String(info.email||'').trim().toLowerCase(),displayName:String(info.displayName||''),emailVerified:info.emailVerified===true,isAnonymous:!info.email,claims};
  if(portalV4IsUnitEmail_(user.email)&&!portalV4Membership_(user))throw apiError_('UNIT_ACCESS_REQUIRED','Tài khoản đơn vị chưa được cấp quyền hoặc đã tạm khóa.');
  if(requireAdmin&&(!user.emailVerified||!isAdmin_(user)))throw apiError_('ADMIN_REQUIRED','Tài khoản chưa được cấp quyền quản trị.');
  return user;
}`);
replaceFunction('getApplicationSheet_',`function getApplicationSheet_() { return portalV4BaseSheet_(PropertiesService.getScriptProperties().getProperty('SHEET_NAME')||CONFIG.APPLICATION_SHEET,APPLICATION_HEADERS);\n}`);
replaceFunction('getNotificationSheet_',`function getNotificationSheet_() { return portalV4BaseSheet_(CONFIG.NOTIFICATION_SHEET,NOTIFICATION_HEADERS);\n}`);
replaceFunction('getLogSheet_',`function getLogSheet_() { return portalV4BaseSheet_(CONFIG.LOG_SHEET,LOG_HEADERS);\n}`);
source+='\n'+fs.readFileSync(new URL('backend/LegacyUpgrade.gs',root),'utf8')+'\n'+fs.readFileSync(new URL('backend/Accounts.gs',root),'utf8')+'\n'+fs.readFileSync(new URL('backend/News.gs',root),'utf8');
source+=`\nfunction setupWebsiteUpgrade(){const result=setupPortalUpgrade();setupNewsCMS();Logger.log(JSON.stringify(result));return result;}
function enablePortalReminderEmails(){portalV3Sheet_('MailQueue');PropertiesService.getScriptProperties().setProperty('MAIL_ENABLED','true');Logger.log('Lịch email đã bật. Cần có trình kích hoạt portalV3ProcessReminderQueue mỗi phút.');}
function inspectWebsiteUpgrade(){portalV4BeginRequest_();const book=portalV3Book_();Logger.log(JSON.stringify({applicationRows:Math.max(0,getApplicationSheet_().getLastRow()-1),newsReady:Boolean(book.getSheetByName('NewsPosts')),queueReady:Boolean(book.getSheetByName('MailQueue')),accountsReady:['StudentProfiles','ApplicationExtras','PortalUnits','UnitMembers'].every(name=>Boolean(book.getSheetByName(name))),mailEnabled:portalV3MailEnabled_()}));}
function inspectSheetsConnection(){const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(requiredProperty_('SPREADSHEET_ID'))+'?fields=spreadsheetId',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});let reason='';try{const body=JSON.parse(response.getContentText());reason=body.error&&body.error.status||'';}catch(ignored){}Logger.log(JSON.stringify({sheetsApiStatus:response.getResponseCode(),reason}));}
`;
fs.mkdirSync(new URL('backend/deploy/',root),{recursive:true});
fs.writeFileSync(new URL('backend/deploy/Code.gs',root),source);
fs.writeFileSync(new URL('scripts/backend-editor.html',root),'<!doctype html><meta charset="utf-8"><title>Bản cập nhật máy chủ đã kiểm tra</title><h1>Mã cập nhật máy chủ</h1><textarea aria-label="Mã cập nhật" style="width:95%;height:80vh">'+source.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</textarea>');
const manifest=JSON.parse(fs.readFileSync(new URL('backend/live-original/appsscript.json',root),'utf8'));manifest.dependencies={enabledAdvancedServices:[{userSymbol:'Sheets',serviceId:'sheets',version:'v4'}]};fs.writeFileSync(new URL('backend/deploy/appsscript.json',root),JSON.stringify(manifest,null,2));
console.log('Built compatible backend; original schema and existing OAuth scopes preserved.');

