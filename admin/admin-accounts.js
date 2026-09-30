import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {firebaseConfig} from '../assets/js/firebase-config.js';
import {apiRequest} from '../assets/js/api.js';
const auth=getAuth(getApps().length?getApp():initializeApp(firebaseConfig));
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text??'';if(cls)n.className=cls;return n;};
let user=null,accounts=[],epoch=0,busy=false,ready=false;
function message(text,error=false){$('adminsMessage').textContent=text;$('adminsMessage').classList.toggle('error',error);}
function setBusy(value){busy=value;$('adminAccountFields').disabled=value||!ready;$('refreshAdmins').disabled=value||!user;document.querySelectorAll('[data-account-toggle]').forEach(button=>button.disabled=value);}
function render(){
  $('adminAccountsBody').replaceChildren();$('adminAccountCount').textContent=`${accounts.length} tài khoản`;
  accounts.forEach(account=>{const row=el('tr');[account.username,account.displayName,account.active?'Đang hoạt động':'Tạm khóa'].forEach((text,i)=>{const td=el('td');td.dataset.label=['Tên đăng nhập','Cán bộ','Trạng thái'][i];td.append(el(i===0?'strong':'span',text,i===2?'status-badge '+(account.active?'completed':'pending'):''));row.append(td);});const cell=el('td'),toggle=el('button',account.active?'Tạm khóa':'Mở lại','text-button');cell.dataset.label='Thao tác';toggle.type='button';toggle.dataset.accountToggle='';toggle.onclick=()=>save('setAdminAccountActive',{uid:account.uid,active:!account.active},account.active?'Đã tạm khóa tài khoản.':'Đã mở lại tài khoản.');cell.append(toggle);row.append(cell);$('adminAccountsBody').append(row);});
  if(!accounts.length){const row=el('tr'),cell=el('td','Chưa cấp tài khoản quản trị nào. Tài khoản chủ hệ thống vẫn hoạt động như trước.','empty-state');cell.colSpan=4;row.append(cell);$('adminAccountsBody').append(row);}
}
async function connect(){
  if(!user||busy)return;const version=epoch;setBusy(true);message('Đang tải tài khoản quản trị…');$('connectionStatus').textContent='Đang kết nối…';
  try{const result=await apiRequest(user,'listAdminAccounts');if(version!==epoch)return;accounts=result.accounts||[];ready=true;render();$('adminsWorkspace').hidden=false;$('connectionStatus').textContent='Đã đồng bộ';message('Bạn đang quản lý tài khoản với quyền chủ hệ thống.');}
  catch(error){if(version!==epoch)return;message(error.message,true);$('connectionStatus').textContent='Chưa tải được dữ liệu';}
  finally{if(version===epoch){setBusy(false);window.dispatchEvent(new Event('huit:workspace-ready'));}}
}
async function save(action,payload,success){
  if(!ready||busy)return;const version=epoch;setBusy(true);message('Đang lưu thay đổi…');
  try{const result=await apiRequest(user,action,payload);if(version!==epoch)return;const index=accounts.findIndex(account=>account.uid===result.account.uid);if(index<0)accounts.push(result.account);else accounts[index]=result.account;render();if(action==='createAdminAccount')$('adminAccountForm').reset();message(success);}
  catch(error){if(version===epoch)message(error.message,true);}
  finally{if(version===epoch){$('newAdminPassword').value='';setBusy(false);}}
}
$('adminAccountForm').onsubmit=event=>{event.preventDefault();save('createAdminAccount',{username:$('newAdminUsername').value.trim(),displayName:$('newAdminName').value.trim(),password:$('newAdminPassword').value},'Đã cấp tài khoản quản trị. Bàn giao riêng thông tin đăng nhập cho cán bộ.');};
$('refreshAdmins').onclick=connect;$('logoutButton').onclick=()=>signOut(auth);
onAuthStateChanged(auth,current=>{++epoch;user=current;ready=false;busy=false;accounts=[];$('adminAccountForm').reset();$('adminsWorkspace').hidden=true;render();setBusy(false);if(!current||current.isAnonymous){window.dispatchEvent(new Event('huit:workspace-ready'));location.replace('../ho-so/login.html?tab=admin');return;}$('adminName').textContent=current.displayName||'Chủ hệ thống';connect();});
