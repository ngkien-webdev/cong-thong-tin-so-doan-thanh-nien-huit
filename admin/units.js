import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {firebaseConfig} from '../assets/js/firebase-config.js';
import {apiRequest} from '../assets/js/api.js';
const auth=getAuth(getApps().length?getApp():initializeApp(firebaseConfig));
const $=id=>document.getElementById(id), el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text??'';if(cls)n.className=cls;return n;};
let user=null,units=[],members=[],epoch=0,busy=false,ready=false;
function message(text,error=false){$('unitsMessage').textContent=text;$('unitsMessage').classList.toggle('error',error);}
function request(action,payload){return apiRequest(user,action,payload);}
function setBusy(value){busy=value;$('unitFields').disabled=value||!ready;$('accountFields').disabled=value||!ready;$('refreshUnits').disabled=value||!ready;document.querySelectorAll('[data-mutation]').forEach(b=>b.disabled=value);if(!value&&ready)renderMembers();}
function cell(row,...nodes){const td=el('td');td.dataset.label=['Tên','Nhóm / đơn vị','Trạng thái','Thao tác'][row.children.length];td.append(...nodes);row.append(td);}
function render(){
  $('facultyCount').textContent=units.filter(u=>u.type==='faculty').length;$('clubCount').textContent=units.filter(u=>u.type==='club').length;$('accountCount').textContent=members.filter(m=>m.active&&units.some(u=>u.id===m.unitId&&u.active)).length;
  const selected=$('accountUnit').value,filter=$('memberUnit').value;
  $('accountUnit').replaceChildren(new Option('Chọn đơn vị đang hoạt động',''),...units.filter(u=>u.active).map(u=>new Option(u.name,u.id)));$('accountUnit').value=selected;
  $('memberUnit').replaceChildren(new Option('Tất cả đơn vị',''),...units.map(u=>new Option(u.name,u.id)));$('memberUnit').value=filter;
  $('unitsBody').replaceChildren();
  units.forEach(unit=>{const row=el('tr');cell(row,el('strong',unit.name),el('small',unit.id));cell(row,el('span',unit.type==='faculty'?'Khoa':'Câu lạc bộ'));cell(row,el('span',unit.active?'Đang hoạt động':'Tạm ngừng','status-badge '+(unit.active?'completed':'pending')));const edit=el('button','Chỉnh sửa','text-button');edit.type='button';edit.dataset.mutation='';edit.onclick=()=>{if(busy)return;$('unitId').value=unit.id;$('unitName').value=unit.name;$('unitType').value=unit.type;$('unitActive').checked=unit.active;$('unitFormTitle').textContent='Chỉnh sửa đơn vị';$('unitName').focus();};cell(row,edit);$('unitsBody').append(row);});
  if(!units.length)empty($('unitsBody'),'Chưa có đơn vị. Thêm khoa hoặc câu lạc bộ đầu tiên ở phía trên.');renderMembers();
}
function empty(body,text){const row=el('tr'),td=el('td',text,'empty-state');td.colSpan=4;row.append(td);body.append(row);}
function renderMembers(){
  $('membersBody').replaceChildren();const selected=$('memberUnit').value,filtered=members.filter(m=>!selected||m.unitId===selected);
  filtered.forEach(member=>{const unit=units.find(u=>u.id===member.unitId),row=el('tr');cell(row,el('strong',member.username||member.email),el('small',member.displayName||''));cell(row,el('span',unit?.name||member.unitId));cell(row,el('span',member.active?(unit?.active?'Đang hoạt động':'Đơn vị tạm ngừng'):'Tạm khóa','status-badge '+(member.active&&unit?.active?'completed':'pending')));const toggle=el('button',member.active?'Tạm khóa':'Mở lại','text-button');toggle.type='button';toggle.dataset.mutation='';toggle.disabled=busy||(!member.active&&!unit?.active);toggle.onclick=()=>mutate('saveUnitMemberAdmin',{email:member.email,unitId:member.unitId,active:!member.active},member.active?'Đã tạm khóa quyền truy cập đơn vị.':'Đã mở lại quyền truy cập đơn vị.');cell(row,toggle);$('membersBody').append(row);});if(!filtered.length)empty($('membersBody'),'Chưa có tài khoản trong danh sách này.');
}
async function reload(){const version=epoch;const result=await Promise.all([request('listUnitsAdmin'),request('listUnitMembersAdmin')]);if(version!==epoch)return;units=result[0].units||[];members=result[1].members||[];render();$('connectionStatus').textContent='Đã đồng bộ · '+new Date().toLocaleTimeString('vi-VN');}
async function mutate(action,payload,success,after){
  if(busy||!ready)return;const version=epoch;setBusy(true);message('Đang lưu thay đổi…');
  try{await request(action,payload);if(version!==epoch)return;after?.();message(success);try{await reload();}catch{message(success+' Chưa tải lại được danh sách; chọn Làm mới để kiểm tra.',true);}}
  catch(error){if(version===epoch)message(error.message,true);}finally{if(version===epoch)setBusy(false);}
}
$('unitForm').onsubmit=e=>{e.preventDefault();mutate('saveUnitAdmin',{unit:{id:$('unitId').value,name:$('unitName').value.trim(),type:$('unitType').value,active:$('unitActive').checked}},'Đã lưu đơn vị.',()=>$('unitForm').reset());};
$('unitForm').onreset=()=>queueMicrotask(()=>{$('unitId').value='';$('unitFormTitle').textContent='Thêm đơn vị';});
$('accountForm').onsubmit=e=>{e.preventDefault();const username=$('accountUsername').value.trim();mutate('createUnitAccountAdmin',{username,password:$('accountPassword').value,unitId:$('accountUnit').value,displayName:$('accountDisplayName').value.trim()},'Đã tạo tài khoản “'+username+'”. Bàn giao tên đăng nhập và mật khẩu riêng cho người phụ trách.',()=>$('accountForm').reset());};
$('memberUnit').onchange=renderMembers;$('refreshUnits').onclick=async()=>{if(busy||!ready)return;setBusy(true);try{await reload();message('Đã cập nhật danh sách mới nhất.');}catch(error){message(error.message,true);}finally{setBusy(false);}};
$('logoutButton').onclick=async()=>{await signOut(auth);location.replace('../ho-so/login.html');};
onAuthStateChanged(auth,async current=>{const version=++epoch;user=current;ready=false;units=[];members=[];$('unitsWorkspace').hidden=true;$('unitsBody').replaceChildren();$('membersBody').replaceChildren();$('accountForm').reset();setBusy(false);if(!current||current.isAnonymous){location.replace('../ho-so/login.html');return;}$('adminName').textContent=current.displayName||'Quản trị viên';try{await request('verifyAdmin');if(version!==epoch)return;await reload();if(version!==epoch)return;ready=true;$('unitsWorkspace').hidden=false;message('Bắt đầu bằng cách tạo đơn vị, sau đó cấp tài khoản đăng nhập.');setBusy(false);}catch(error){if(version===epoch)message(error.message,true);}});
