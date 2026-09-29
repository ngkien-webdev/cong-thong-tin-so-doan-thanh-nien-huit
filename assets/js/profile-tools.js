import {readLocal, writeLocal, normalize, csv, download} from './portal-utils.js';
const fields=['docType','studentName','studentId','reasonContent'];
let draftKey=null;
let pendingRequest=null;
export async function applicationRequestId(uid, application) {
  const bytes=new TextEncoder().encode(JSON.stringify(application));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const key=`huit:submit:${uid}:${fingerprint}`;
  if(pendingRequest?.key===key)return pendingRequest.id;
  let id;
  try{id=sessionStorage.getItem(key);}catch{}
  id ||= crypto.randomUUID();
  try{sessionStorage.setItem(key,id);}catch{}
  pendingRequest={key,id};return id;
}
export function completeApplicationRequest(){
  if(pendingRequest){try{sessionStorage.removeItem(pendingRequest.key);}catch{}pendingRequest=null;}
}
export function setupDraft(user) {
  const form=document.getElementById('applicationForm');if(!form||!user||user.isAnonymous)return;
  draftKey=`huit:draft:${user.uid}`;
  const bar=document.createElement('div');bar.className='portal-draft';bar.innerHTML='<span role="status">Bản nháp lưu trên thiết bị này; tệp đính kèm cần chọn lại.</span><button type="button" class="portal-secondary">Khôi phục nháp</button><button type="button" class="portal-secondary">Xóa nháp</button>';
  form.before(bar);const status=bar.querySelector('span'),[restore,clear]=bar.querySelectorAll('button');
  const stored=readLocal(draftKey,null);restore.hidden=!stored;
  if(stored)status.textContent='Có bản nháp đã lưu trên thiết bị này. Khôi phục để tiếp tục.';
  restore.onclick=()=>{const data=readLocal(draftKey,null);if(!data)return;fields.forEach(id=>{const input=document.getElementById(id);if(input&&!input.readOnly&&typeof data[id]==='string')input.value=data[id];});restore.hidden=true;status.textContent='Đã khôi phục nháp. Hãy chọn lại tệp đính kèm.';};
  clear.onclick=()=>{try{localStorage.removeItem(draftKey);restore.hidden=true;status.textContent='Đã xóa bản nháp đã lưu. Nội dung đang nhập được giữ nguyên.';}catch{status.textContent='Không thể xóa bản nháp trên thiết bị này.';}};
  form.addEventListener('input',()=>{const data={};fields.forEach(id=>data[id]=document.getElementById(id)?.value||'');status.textContent=writeLocal(draftKey,data)?'Đã lưu nháp trên thiết bị · '+new Date().toLocaleTimeString('vi-VN'):'Không thể lưu nháp: trình duyệt đã chặn bộ nhớ.';});
  form.addEventListener('reset',()=>{try{localStorage.removeItem(draftKey);}catch{}restore.hidden=true;status.textContent='Bản nháp đã được xóa sau khi gửi thành công.';});
}
export function enhanceHistory(items) {
  const list=document.getElementById('historyList');if(!list)return;
  [...list.querySelectorAll('article')].forEach((card,index)=>{
    const item=items[index];if(!item)return;
    const delivery=document.createElement('p');delivery.className='history-delivery';
    delivery.textContent=item.deliveryMethod==='post' ? `Nhận qua bưu điện · ${item.deliveryPhone||'Chưa có số điện thoại'} · ${item.deliveryAddress||'Chưa có địa chỉ'}` : 'Nhận kết quả tại Văn phòng Đoàn';
    card.append(delivery);
    if(!item.reminder&&!item.hardcopy)return;
    const info=document.createElement('p');info.className='portal-draft';
    const format=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(d):'Chưa xác định';};
    const labels={pending:'Chờ gửi',sending:'Đang gửi',sent:'Đã gửi',cancelled:'Đã hủy',uncertain:'Đang kiểm tra'};
    info.textContent=item.hardcopy?'Đã nhận bản cứng: '+format(item.hardcopy.receivedAt):`Nhắc nộp bản cứng: ${labels[item.reminder.state]||'Chưa xác nhận'} · ${format(item.reminder.dueAt)} (giờ Việt Nam)`;
    card.append(info);
  });
  let toolbar=document.getElementById('history-tools');
  if(!toolbar){toolbar=document.createElement('div');toolbar.id='history-tools';toolbar.className='portal-toolbar';toolbar.innerHTML='<input type="search" aria-label="Tìm hồ sơ" placeholder="Tìm mã hồ sơ, loại hồ sơ, nội dung…"><select aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option><option>Đang xử lý</option><option>Yêu cầu bổ sung</option><option>Hoàn thành</option><option>Từ chối</option></select><button class="portal-secondary" type="button">Xuất CSV</button><span role="status"></span>';list.before(toolbar);}
  const input=toolbar.querySelector('input'),select=toolbar.querySelector('select');
  const matching=()=>items.filter(item=>normalize([item.id,item.docType,item.reason].join(' ')).includes(normalize(input.value))&&(!select.value||item.status===select.value));
  const filter=()=>{const visible=new Set(matching().map(i=>i.id));[...list.querySelectorAll('article')].forEach((card,index)=>card.hidden=!visible.has(items[index]?.id));toolbar.querySelector('span').textContent=`${visible.size}/${items.length} hồ sơ`;};
  input.oninput=filter;select.onchange=filter;toolbar.querySelector('button').onclick=()=>download('ho-so-huit.csv',csv([['Mã hồ sơ','Loại hồ sơ','Trạng thái','Ngày gửi'],...matching().map(i=>[i.id,i.docType,i.status,i.submittedAt])]),'text/csv;charset=utf-8');filter();
}
