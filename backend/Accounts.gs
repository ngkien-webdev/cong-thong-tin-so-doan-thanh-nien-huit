/** Profile, delivery and institution accounts. All access is resolved server-side. */
const PORTAL_V4_UNIT_DOMAIN='@units.huit-youth-portal.local';
// Read related tables in one Sheets call. Values live only for this execution;
// active account permissions are never shared across requests or users.
function portalV4PrimeRows_(names) {
  if(!PORTAL_V4_REQUEST)portalV4BeginRequest_();
  const needed=names.filter(name=>!PORTAL_V4_REQUEST.rows[name]);if(!needed.length)return;
  const ranges=needed.map(name=>'ranges='+encodeURIComponent("'"+name+"'!A:Z")).join('&');
  const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(requiredProperty_('SPREADSHEET_ID'))+'/values:batchGet?'+ranges+'&valueRenderOption=UNFORMATTED_VALUE',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)portalV3Fail_('DATABASE_READ_FAILED','Chưa tải được dữ liệu đơn vị. Vui lòng chọn Làm mới để thử lại.');
  let data;try{data=JSON.parse(response.getContentText());}catch(error){portalV3Fail_('DATABASE_READ_FAILED','Dữ liệu máy chủ chưa hợp lệ. Vui lòng thử lại.');}
  const pending={};
  needed.forEach((name,index)=>{
    const values=data.valueRanges&&data.valueRanges[index]&&data.valueRanges[index].values||[],headers=PORTAL_V3_HEADERS[name];
    if(!headers||headers.some((header,i)=>!values[0]||values[0][i]!==header))portalV3Fail_('SCHEMA_MISMATCH','Cấu trúc bảng '+name+' chưa phù hợp. Dữ liệu được giữ nguyên.');
    pending[name]=values.slice(1).map((row,i)=>{const item={_row:i+1};headers.forEach((header,j)=>item[header]=row[j]??'');return item;}).filter(item=>item[headers[0]]!=='');
  });
  Object.assign(PORTAL_V4_REQUEST.rows,pending);
}
function portalV4BaseSheet_(name,headers) {
  if(!PORTAL_V4_REQUEST)portalV4BeginRequest_();
  const key='base:'+name;
  if(!PORTAL_V4_REQUEST.book)PORTAL_V4_REQUEST.book=SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID'));
  if(!PORTAL_V4_REQUEST.sheets[key])PORTAL_V4_REQUEST.sheets[key]=ensureSheet_(PORTAL_V4_REQUEST.book,name,headers);
  return PORTAL_V4_REQUEST.sheets[key];
}
function portalV4IsUnitEmail_(email) { return String(email||'').toLowerCase().endsWith(PORTAL_V4_UNIT_DOMAIN); }
function portalV4Active_(value) { return value===true||String(value).toLowerCase()==='true'; }
function portalV4Phone_(value,required) {
  const raw=portalV3Text_(value===undefined?'':value,0,40,'Số điện thoại');
  const phone=raw.replace(/[\s().-]/g,'').replace(/^\+84/,'0');
  if(!phone&&!required)return '';
  if(!/^(?:0[35789]\d{8}|02\d{9})$/.test(phone))portalV3Fail_('INVALID_PHONE','Vui lòng nhập số điện thoại Việt Nam hợp lệ.');
  return phone;
}
function portalV4Unit_(id) { return portalV3Rows_('PortalUnits').find(unit=>unit.id===id)||null; }
function portalV4PublicUnit_(unit) { return {id:unit.id,unitId:unit.id,name:unit.name,type:unit.type,active:portalV4Active_(unit.active)}; }
function portalV4Membership_(user) {
  if(user.isAnonymous||!user.email)return null;
  const member=portalV3Rows_('UnitMembers').find(row=>String(row.email).toLowerCase()===user.email&&portalV4Active_(row.active));
  if(!member)return null;
  // An unverified synthetic address alone is never evidence of membership.
  if(portalV4IsUnitEmail_(user.email)) { if(!member.uid||member.uid!==user.uid)return null; }
  else if(!user.emailVerified||(member.uid&&member.uid!==user.uid))return null;
  const unit=portalV4Unit_(member.unitId);
  return unit&&portalV4Active_(unit.active)?{unitId:unit.id,name:unit.name,type:unit.type}:null;
}
function portalV4RequireUser_(user) {
  if(user.isAnonymous)portalV3Fail_('GUEST_NOT_ALLOWED','Vui lòng đăng nhập tài khoản để sử dụng chức năng này.');
}
function portalV4Context_(user) {
  portalV4RequireUser_(user);
  portalV4PrimeRows_(['StudentProfiles','UnitMembers','PortalUnits']);
  const saved=portalV3Rows_('StudentProfiles').find(row=>row.uid===user.uid);
  return {profile:saved?{studentName:saved.studentName,studentId:saved.studentId,phone:saved.phone}:{studentName:user.displayName||'',studentId:'',phone:''},membership:portalV4Membership_(user),admin:portalAdminAllowed_(user),canManageAdmins:portalAdminOwner_(user),capabilities:{profile:1,delivery:1,units:1,unitAccounts:1,adminAccounts:1}};
}
function portalV4SaveProfile_(user,body) {
  portalV4RequireUser_(user);
  const raw=body.profile||{},profile={uid:user.uid,studentName:portalV3Text_(raw.studentName,2,120,'Họ và tên'),studentId:portalV3Text_(raw.studentId||'',0,30,'Mã số sinh viên').toUpperCase(),phone:portalV4Phone_(raw.phone,false),updatedAt:new Date().toISOString()};
  if(profile.studentId&&!/^[A-Z0-9._-]{5,30}$/.test(profile.studentId))portalV3Fail_('INVALID_STUDENT_ID','Mã số sinh viên không hợp lệ.');
  return portalV3Lock_(()=>{
    const existing=portalV3Rows_('StudentProfiles').find(row=>row.uid===user.uid);
    portalV3Batch_([existing?portalV3Update_('StudentProfiles',Object.assign({},profile,{_row:existing._row})):portalV3Append_('StudentProfiles',profile)]);
    return {profile:{studentName:profile.studentName,studentId:profile.studentId,phone:profile.phone}};
  });
}
function portalV4ApplicationInput_(raw,user,membership) {
  const deliveryMethod=raw.deliveryMethod===undefined?'office':raw.deliveryMethod;
  if(!['office','post'].includes(deliveryMethod))portalV3Fail_('INVALID_DELIVERY','Vui lòng chọn hình thức nhận hồ sơ.');
  const phone=portalV4Phone_(raw.phone,false),postal=deliveryMethod==='post';
  const deliveryPhone=postal?portalV4Phone_(raw.deliveryPhone,true):'';
  const deliveryAddress=postal?portalV3Text_(raw.deliveryAddress,10,500,'Địa chỉ nhận hồ sơ'):'';
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(deliveryAddress))portalV3Fail_('INVALID_DELIVERY','Địa chỉ nhận hồ sơ không hợp lệ.');
  const requested=portalV3Text_(raw.unitId||'',0,80,'Mã đơn vị');
  let unitId=requested||(membership?membership.unitId:'');
  if(portalV4IsUnitEmail_(user.email)&&!membership)portalV3Fail_('UNIT_ACCESS_REQUIRED','Tài khoản đơn vị chưa được cấp quyền hoặc đã bị ngừng hoạt động.');
  if(unitId&&(!membership||unitId!==membership.unitId)&&!portalAdminAllowed_(user))portalV3Fail_('UNIT_ACCESS_REQUIRED','Bạn không có quyền nộp hồ sơ cho đơn vị này.');
  const unit=unitId?portalV4Unit_(unitId):null;
  if(unitId&&(!unit||!portalV4Active_(unit.active)))portalV3Fail_('UNIT_INACTIVE','Đơn vị chưa hoạt động.');
  return {phone,deliveryMethod,deliveryPhone,deliveryAddress,unitId,unitName:unit?unit.name:''};
}
function portalV4JoinExtras_(applications) {
  const extras=new Map(portalV3Rows_('ApplicationExtras').map(row=>[row.applicationId,row]));
  return applications.map(application=>{
    const extra=extras.get(application.id)||{};
    return Object.assign({},application,{phone:extra.phone||'',deliveryMethod:extra.deliveryMethod==='post'?'post':'office',deliveryPhone:extra.deliveryPhone||'',deliveryAddress:extra.deliveryAddress||'',unitId:extra.unitId||'',unitName:extra.unitName||''});
  });
}
function portalV4SaveUnit_(admin,body) {
  const raw=body.unit||{},id=raw.id?portalV3Text_(raw.id,5,30,'Mã đơn vị'):'UNIT-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();
  if(!/^[A-Z0-9._-]{5,30}$/.test(id))portalV3Fail_('INVALID_UNIT','Mã đơn vị cần 5–30 ký tự viết hoa, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  const name=portalV3Text_(raw.name,2,120,'Tên đơn vị');
  if(!['faculty','club'].includes(raw.type)||typeof raw.active!=='boolean')portalV3Fail_('INVALID_UNIT','Loại hoặc trạng thái đơn vị không hợp lệ.');
  return portalV3Lock_(()=>{
    const all=portalV3Rows_('PortalUnits'),previous=all.find(row=>row.id===id);
    if(all.some(row=>row.id!==id&&portalV3Fold_(row.name)===portalV3Fold_(name)))portalV3Fail_('UNIT_EXISTS','Tên đơn vị đã được sử dụng.');
    const now=new Date().toISOString(),unit={id,name,type:raw.type,active:raw.active,createdAt:previous?previous.createdAt:now,updatedAt:now,updatedBy:admin.uid};
    portalV3Batch_([previous?portalV3Update_('PortalUnits',Object.assign({},unit,{_row:previous._row})):portalV3Append_('PortalUnits',unit)]);
    return {unit:portalV4PublicUnit_(unit)};
  });
}
function portalV4SaveMember_(admin,body) {
  const email=portalV3Text_(body.email,3,254,'Email').toLowerCase(),unitId=portalV3Text_(body.unitId,5,30,'Mã đơn vị');
  if(!isValidEmail_(email)||typeof body.active!=='boolean')portalV3Fail_('INVALID_MEMBER','Email hoặc trạng thái thành viên không hợp lệ.');
  return portalV3Lock_(()=>{
    const unit=portalV4Unit_(unitId);if(!unit||(body.active&&!portalV4Active_(unit.active)))portalV3Fail_('UNIT_INACTIVE','Đơn vị chưa hoạt động.');
    const previous=portalV3Rows_('UnitMembers').find(row=>row.email===email);
    if(portalV4IsUnitEmail_(email)&&(!previous||!previous.uid))portalV3Fail_('INVALID_MEMBER','Hãy dùng chức năng tạo tài khoản đơn vị để cấp tên đăng nhập.');
    const now=new Date().toISOString(),member={email,uid:previous?previous.uid:'',unitId,active:body.active,username:previous?previous.username:'',displayName:previous?previous.displayName:'',createdAt:previous?previous.createdAt:now,updatedAt:now,updatedBy:admin.uid};
    portalV3Batch_([previous?portalV3Update_('UnitMembers',Object.assign({},member,{_row:previous._row})):portalV3Append_('UnitMembers',member)]);
    return {member:portalV3Public_(member)};
  });
}
function portalV4FirebasePassword_(method,email,password,displayName) {
  const payload={email,password,returnSecureToken:true};if(displayName)payload.displayName=displayName;
  const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+encodeURIComponent(requiredProperty_('FIREBASE_API_KEY')),{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  let data;try{data=JSON.parse(response.getContentText());}catch(error){portalV3Fail_('ACCOUNT_SERVICE_ERROR','Dịch vụ tài khoản chưa trả kết quả hợp lệ.');}
  return {ok:response.getResponseCode()===200,data};
}
function portalV4CreateAccount_(admin,body) {
  const username=portalV3Text_(body.username,3,40,'Tên đăng nhập').toLowerCase(),unitId=portalV3Text_(body.unitId,5,30,'Mã đơn vị');
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))portalV3Fail_('INVALID_USERNAME','Tên đăng nhập dùng 3–40 ký tự không dấu: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)portalV3Fail_('INVALID_PASSWORD','Mật khẩu cần từ 8 đến 128 ký tự.');
  const email=username+PORTAL_V4_UNIT_DOMAIN,displayName=portalV3Text_(body.displayName||username,2,120,'Tên hiển thị');
  return portalV3Lock_(()=>{
    const unit=portalV4Unit_(unitId);if(!unit||!portalV4Active_(unit.active))portalV3Fail_('UNIT_INACTIVE','Đơn vị chưa hoạt động.');
    const previous=portalV3Rows_('UnitMembers').find(row=>row.email===email);
    if(previous)portalV3Fail_('ACCOUNT_EXISTS','Tên đăng nhập đã được cấp. Dùng danh sách tài khoản để quản lý.');
    // Check schema before creating a Firebase account. Never write the password to Sheets/logs.
    portalV3Sheet_('UnitMembers');
    let created=portalV4FirebasePassword_('signUp',email,body.password,displayName);
    if(!created.ok&&created.data.error&&String(created.data.error.message).startsWith('EMAIL_EXISTS')) {
      // A prior Sheets save may have failed after signup. Prove the same credentials before attaching.
      created=portalV4FirebasePassword_('signInWithPassword',email,body.password);
      if(!created.ok)portalV3Fail_('ACCOUNT_EXISTS','Tên đăng nhập đã tồn tại. Chọn tên khác hoặc dùng đúng mật khẩu của lần tạo trước.');
    }
    if(!created.ok||!created.data.localId||String(created.data.email||'').toLowerCase()!==email)portalV3Fail_('ACCOUNT_SERVICE_ERROR','Chưa tạo được tài khoản. Kiểm tra dịch vụ đăng nhập Email/Mật khẩu và chính sách mật khẩu trong Firebase.');
    const now=new Date().toISOString(),member={email,uid:created.data.localId,unitId,active:true,username,displayName,createdAt:now,updatedAt:now,updatedBy:admin.uid};
    try{portalV3Batch_([portalV3Append_('UnitMembers',member)]);}catch(error){portalV3Fail_('ACCOUNT_SETUP_PENDING','Firebase đã tiếp nhận tài khoản nhưng chưa xác nhận quyền đơn vị. Tải lại danh sách; nếu chưa có, thử lại cùng tên đăng nhập và mật khẩu.');}
    return {account:{username,uid:member.uid,unitId,displayName}};
  });
}
function portalV4Dashboard_(user,body) {
  portalV4RequireUser_(user);
  const member=portalV4Membership_(user),isAdmin=portalAdminAllowed_(user),unitId=portalV3Text_(body.unitId||(member&&member.unitId)||'',0,80,'Mã đơn vị');
  if(!unitId||(!isAdmin&&(!member||member.unitId!==unitId)))portalV3Fail_('UNIT_ACCESS_REQUIRED','Bạn chưa được cấp quyền truy cập đơn vị này.');
  const unit=portalV4Unit_(unitId);if(!unit||(!isAdmin&&!portalV4Active_(unit.active)))portalV3Fail_('UNIT_ACCESS_REQUIRED','Bạn chưa được cấp quyền truy cập đơn vị này.');
  const all=portalV3Applications_().filter(application=>application.unitId===unitId).sort(sortNewestFirst_),summary={total:all.length,pending:0,supplement:0,completed:0,rejected:0};
  all.forEach(application=>{const key={'Đang xử lý':'pending','Yêu cầu bổ sung':'supplement','Hoàn thành':'completed','Từ chối':'rejected'}[application.status];if(key)summary[key]++;});
  const query=portalV3Fold_(portalV3Text_(body.query||'',0,150,'Từ khóa')),filtered=all.filter(application=>(!body.status||application.status===body.status)&&(!query||portalV3Fold_([application.id,application.docType,application.reason].join(' ')).includes(query)));
  const paging=portalV3Page_(body),page=Math.min(paging.page,Math.max(1,Math.ceil(filtered.length/paging.pageSize))),jobs=portalV3Rows_('MailQueue'),receipts=portalV3Rows_('Hardcopies');
  return {unit:portalV4PublicUnit_(unit),applications:filtered.slice((page-1)*paging.pageSize,page*paging.pageSize).map(application=>portalV3Join_(application,jobs,receipts,true)),summary,total:filtered.length,page,pageSize:paging.pageSize,hasMore:page*paging.pageSize<filtered.length};
}
function portalV4Route_(action,body) {
  const adminActions=['getUnitAdminWorkspace','listUnitsAdmin','saveUnitAdmin','listUnitMembersAdmin','saveUnitMemberAdmin','createUnitAccountAdmin'],user=authenticate_(body.authToken,adminActions.includes(action));
  if(action==='getUnitAdminWorkspace')portalV4PrimeRows_(['PortalUnits','UnitMembers']);
  switch(action) {
    case 'getPortalContext':return portalV4Context_(user);
    case 'saveMyProfile':return portalV4SaveProfile_(user,body);
    case 'getUnitDashboard':return portalV4Dashboard_(user,body);
    case 'getUnitWorkspace':return {membership:portalV4Membership_(user),dashboard:portalV4Dashboard_(user,body)};
    case 'getUnitAdminWorkspace':return {units:portalV3Rows_('PortalUnits').map(portalV4PublicUnit_),members:portalV3Rows_('UnitMembers').map(row=>Object.assign(portalV3Public_(row),{active:portalV4Active_(row.active)})),canManageAdmins:portalAdminOwner_(user)};
    case 'listUnitsAdmin':return {units:portalV3Rows_('PortalUnits').map(portalV4PublicUnit_)};
    case 'saveUnitAdmin':return portalV4SaveUnit_(user,body);
    case 'listUnitMembersAdmin':return {members:portalV3Rows_('UnitMembers').filter(row=>!body.unitId||row.unitId===body.unitId).map(row=>Object.assign(portalV3Public_(row),{active:portalV4Active_(row.active)}))};
    case 'saveUnitMemberAdmin':return portalV4SaveMember_(user,body);
    case 'createUnitAccountAdmin':return portalV4CreateAccount_(user,body);
    default:portalV3Fail_('UNKNOWN_ACTION','Thao tác không hợp lệ.');
  }
}
