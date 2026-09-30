/** Provisioned administrators are bound to Firebase UID, never to a claimed email alone. */
const PORTAL_ADMIN_DOMAIN='@admins.huit-youth-portal.local';
function portalAdminAlias_(email) { return String(email||'').toLowerCase().endsWith(PORTAL_ADMIN_DOMAIN); }
function portalAdminOwner_(user) { return Boolean(user&&!user.isAnonymous&&user.emailVerified&&!portalAdminAlias_(user.email)&&isAdmin_(user)); }
function portalAdminAccount_(user) {
  if(!user||user.isAnonymous||!portalAdminAlias_(user.email))return null;
  return portalV3Rows_('AdminAccounts').find(row=>row.uid===user.uid&&row.email===user.email&&portalV4Active_(row.active))||null;
}
function portalAdminAllowed_(user) { return portalAdminOwner_(user)||Boolean(portalAdminAccount_(user)); }
function portalAdminPublic_(row) { return {uid:row.uid,username:row.username,displayName:row.displayName,active:portalV4Active_(row.active),createdAt:row.createdAt}; }
function portalAdminRequireOwner_(user) {
  if(!portalAdminOwner_(user))portalV3Fail_('OWNER_REQUIRED','Chỉ quản trị viên chủ hệ thống được cấp hoặc khóa tài khoản quản trị.');
}
function portalAdminCreate_(user,body) {
  portalAdminRequireOwner_(user);
  const username=portalV3Text_(body.username,3,40,'Tên đăng nhập').toLowerCase(),displayName=portalV3Text_(body.displayName,2,120,'Tên hiển thị');
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))portalV3Fail_('INVALID_USERNAME','Tên đăng nhập dùng 3–40 ký tự không dấu: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)portalV3Fail_('INVALID_PASSWORD','Mật khẩu quản trị cần từ 12 đến 128 ký tự.');
  const email=username+PORTAL_ADMIN_DOMAIN;
  return portalV3Lock_(()=>{
    if(portalV3Rows_('AdminAccounts').some(row=>row.email===email))portalV3Fail_('ACCOUNT_EXISTS','Tên đăng nhập đã được cấp. Hãy quản lý tài khoản trong danh sách bên dưới.');
    portalV3Sheet_('AdminAccounts');
    let created=portalV4FirebasePassword_('signUp',email,body.password,displayName);
    if(!created.ok&&String(created.data.error&&created.data.error.message).startsWith('EMAIL_EXISTS')) {
      created=portalV4FirebasePassword_('signInWithPassword',email,body.password);
      if(!created.ok)portalV3Fail_('ACCOUNT_EXISTS','Tên đăng nhập đã tồn tại. Chọn tên khác hoặc dùng đúng mật khẩu của lần tạo trước.');
    }
    if(!created.ok||!created.data.localId||String(created.data.email||'').toLowerCase()!==email)portalV3Fail_('ACCOUNT_SERVICE_ERROR','Chưa tạo được tài khoản. Kiểm tra chính sách mật khẩu và thử lại.');
    const now=new Date().toISOString(),account={uid:created.data.localId,email,username,displayName,active:true,createdAt:now,updatedAt:now,updatedBy:user.uid};
    try{portalV3Batch_([portalV3Append_('AdminAccounts',account)]);}catch(error){portalV3Fail_('ACCOUNT_SETUP_PENDING','Chưa xác nhận được quyền quản trị. Tải lại danh sách; nếu chưa có, thử lại cùng tên đăng nhập và mật khẩu.');}
    return {account:portalAdminPublic_(account)};
  });
}
function portalAdminSetActive_(user,body) {
  portalAdminRequireOwner_(user);
  if(typeof body.active!=='boolean')portalV3Fail_('INVALID_INPUT','Trạng thái tài khoản không hợp lệ.');
  return portalV3Lock_(()=>{
    const previous=portalV3Rows_('AdminAccounts').find(row=>row.uid===body.uid);
    if(!previous)portalV3Fail_('NOT_FOUND','Không tìm thấy tài khoản quản trị.');
    if(previous.uid===user.uid)portalV3Fail_('SELF_LOCK','Không thể khóa tài khoản đang sử dụng.');
    const account=Object.assign({},previous,{active:body.active,updatedAt:new Date().toISOString(),updatedBy:user.uid});
    portalV3Batch_([portalV3Update_('AdminAccounts',account)]);
    return {account:portalAdminPublic_(account)};
  });
}
function portalAdminRoute_(action,body) {
  const user=authenticate_(body.authToken,true);portalAdminRequireOwner_(user);
  switch(action) {
    case 'listAdminAccounts':return {accounts:portalV3Rows_('AdminAccounts').map(portalAdminPublic_)};
    case 'createAdminAccount':return portalAdminCreate_(user,body);
    case 'setAdminAccountActive':return portalAdminSetActive_(user,body);
    default:portalV3Fail_('UNKNOWN_ACTION','Thao tác không hợp lệ.');
  }
}
