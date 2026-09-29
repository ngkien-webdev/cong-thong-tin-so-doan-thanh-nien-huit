import {csv,download,normalize} from '../assets/js/portal-utils.js';

const statuses={'Đang xử lý':'pending','Yêu cầu bổ sung':'supplement','Hoàn thành':'completed','Từ chối':'rejected'};
const mailLabels={pending:'Chờ gửi',sending:'Đang gửi',sent:'Đã gửi',uncertain:'Cần kiểm tra',cancelled:'Đã hủy'};
const date=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(d);};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const badge=(label,kind)=>el('span',label,'status-badge '+kind);
const isPlan=item=>normalize(item.docType).startsWith('ke hoach');
const paperLabel=item=>item.hardcopy?'Đã nhận':isPlan(item)&&item.status!=='Từ chối'?'Chờ nhận':'Không yêu cầu';

export function mountAdmin({request,logout}) {
  const $=id=>document.getElementById(id);
  const state={ready:false,view:'applications',page:1,mailPage:1,items:[],selected:null,epoch:0,loadId:0,detailId:0,busy:false,capabilities:null};
  let toastTimer,closeConfirmation;
  const confirmation=document.createElement('dialog');confirmation.className='confirm-dialog';confirmation.setAttribute('aria-labelledby','confirm-title');confirmation.innerHTML='<h2 id="confirm-title"></h2><p id="confirm-copy"></p><div class="confirm-actions"><button type="button" class="button secondary" data-cancel>Hủy</button><button type="button" class="button primary" data-confirm>Xác nhận</button></div>';document.body.append(confirmation);
  function confirmAction(title,copy){return new Promise(resolve=>{
    confirmation.querySelector('h2').textContent=title;confirmation.querySelector('p').textContent=copy;
    const finish=value=>{confirmation.close();closeConfirmation=null;resolve(value);};closeConfirmation=finish;
    confirmation.querySelector('[data-cancel]').onclick=()=>finish(false);confirmation.querySelector('[data-confirm]').onclick=()=>finish(true);confirmation.oncancel=e=>{e.preventDefault();finish(false);};confirmation.showModal();confirmation.querySelector('[data-cancel]').focus();
  });}
  function toast(text){$('adminToast').textContent=text;$('adminToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('adminToast').hidden=true,4500);}
  function cell(row,label,...content){const td=el('td');td.dataset.label=label;td.append(...content);row.append(td);return td;}
  function placeholder(target,columns,title,description,spinner=false){const row=el('tr'),td=el('td'),box=el('div',undefined,'empty-state');td.colSpan=columns;if(spinner)box.append(el('span',undefined,'loader'));box.append(el('strong',title));if(description)box.append(el('p',description));td.append(box);row.append(td);target.replaceChildren(row);}
  function issue(error){
    const unsupported=['UNKNOWN_ACTION','INVALID_ACTION','UNSUPPORTED_API'].includes(error.code)||/thao tác không hợp lệ|chưa hỗ trợ thao tác/i.test(error.message||'');
    $('connectionIssue').hidden=false;
    $('issueTitle').textContent=unsupported?'Kết nối quản trị cần được cập nhật':'Chưa tải được dữ liệu';
    $('issueMessage').textContent=unsupported?'Máy chủ hiện tại chưa hỗ trợ các chức năng quản trị của phiên bản này. Dữ liệu trong Google Sheets vẫn được giữ nguyên; cần cập nhật dự án Apps Script để tiếp tục.':error.message||'Kiểm tra kết nối và bấm Làm mới dữ liệu để thử lại.';
    $('issueHelp').hidden=!unsupported;
    $('connectionStatus').textContent=unsupported?'Máy chủ chưa tương thích':'Chưa đồng bộ';$('connectionStatus').className='connection';
  }
  function summary(data,mail=false){
    const cards=mail?[['Chờ gửi',data.pending],['Đã gửi',data.sent],['Cần kiểm tra',data.uncertain],['Đã hủy',data.cancelled]]:[['Tổng hồ sơ',data.total],['Chờ xử lý',data.pending],['Hoàn thành',data.completed],['Chờ bản cứng',data.awaitingHardcopy]];
    $('summaryCards').replaceChildren(...cards.map(([label,count])=>{const n=el('div',undefined,'stat-card');n.append(el('span',label),el('strong',Number(count||0).toLocaleString('vi-VN')),el('small',mail?'Trạng thái gửi email':'Toàn bộ hồ sơ trong hệ thống'));return n;}));
  }
  function filters(){return {query:$('queryInput').value.trim(),status:$('statusFilter').value,docType:$('typeFilter').value,from:$('fromFilter').value,to:$('toFilter').value,sort:$('sortFilter').value,awaitingHardcopy:$('hardcopyFilter').checked};}
  function pagination(prefix,page,total,pageSize){const first=prefix==='mail'?'mailPrevious':'previousPage',next=prefix==='mail'?'mailNext':'nextPage',status=prefix==='mail'?'mailPageStatus':'pageStatus';$(first).disabled=page<=1;$(next).disabled=page*pageSize>=total;$(status).textContent=`Trang ${page} / ${Math.max(1,Math.ceil(total/pageSize))} · ${total.toLocaleString('vi-VN')} mục`;}
  function renderApplications(result){
    state.items=result.applications;state.page=result.page;
    $('tableBody').replaceChildren();
    for(const item of result.applications){
      const row=el('tr');const id=el('span',item.id,'record-id');id.title=item.id;
      cell(row,'Hồ sơ',id,el('small',date(item.submittedAt)));
      cell(row,'Sinh viên',el('strong',item.studentName),el('small',item.studentId));
      cell(row,'Loại hồ sơ',el('span',item.docType));
      cell(row,'Trạng thái',badge(item.status,statuses[item.status]||''));
      cell(row,'Bản cứng',badge(paperLabel(item),item.hardcopy?'received':paperLabel(item)==='Chờ nhận'?'pending':''));
      const button=el('button','Xem & xử lý →','text-button');button.type='button';button.setAttribute('aria-label','Xử lý hồ sơ '+item.studentName);button.onclick=()=>openDetail(item.id);cell(row,'Thao tác',button);$('tableBody').append(row);
    }
    if(!result.applications.length)placeholder($('tableBody'),6,'Không có hồ sơ phù hợp','Thử đổi bộ lọc hoặc khoảng ngày tìm kiếm.');
    $('totalCount').textContent=`${result.total.toLocaleString('vi-VN')} hồ sơ phù hợp · ${result.applications.length} hồ sơ trên trang này`;
    $('exportButton').disabled=!result.applications.length;
    const old=$('typeFilter').value;$('typeFilter').replaceChildren(new Option('Tất cả loại hồ sơ',''),...result.docTypes.map(t=>new Option(t,t)));$('typeFilter').value=old;
    summary(result.summary);pagination('',result.page,result.total,result.pageSize);
  }
  async function load(){
    if(!state.ready)return;
    const epoch=state.epoch,id=++state.loadId,view=state.view;
    const target=view==='applications'?$('tableBody'):$('mailBody'),columns=view==='applications'?6:5;
    $('connectionIssue').hidden=true;$('connectionStatus').textContent='Đang đồng bộ…';$('refreshButton').disabled=true;
    if(view==='applications'){$('exportButton').disabled=true;state.items=[];}
    placeholder(target,columns,'Đang tải dữ liệu','',true);
    try {
      const result=await request(view==='applications'?'listAdminApplications':'listMailJobs',view==='applications'?{...filters(),page:state.page,pageSize:20}:{page:state.mailPage,pageSize:20,state:$('mailFilter').value});
      if(epoch!==state.epoch||id!==state.loadId)return;
      if(view==='applications'){
        if(!Array.isArray(result.applications)||!Number.isFinite(result.total)||!result.summary||!Array.isArray(result.docTypes))throw Object.assign(new Error('Máy chủ chưa trả về dữ liệu quản trị đầy đủ.'),{code:'UNSUPPORTED_API'});
        renderApplications(result);
      }else renderMail(result);
      $('connectionStatus').textContent='Đã đồng bộ · '+new Date().toLocaleTimeString('vi-VN');$('connectionStatus').className='connection ready';
    }catch(error){if(epoch!==state.epoch||id!==state.loadId)return;issue(error);placeholder(target,columns,'Chưa hiển thị được danh sách','Kiểm tra thông báo phía trên và thử làm mới.');}
    finally{if(epoch===state.epoch&&id===state.loadId)$('refreshButton').disabled=false;}
  }
  function renderMail(result){
    if(!Array.isArray(result.jobs)||!result.summary)throw new Error('Dữ liệu email không hợp lệ.');
    state.mailPage=result.page;$('mailBody').replaceChildren();
    $('mailEnabled').textContent=result.enabled?'Lịch gửi đang bật · 08:00 ngày sau khi nộp hồ sơ':'Lịch gửi đang tắt. Quản trị hệ thống cần kích hoạt lịch gửi trên máy chủ.';
    for(const job of result.jobs){
      const row=el('tr');cell(row,'Người nhận',el('strong',job.studentName),el('small',job.recipient));cell(row,'Mã hồ sơ',el('span',job.applicationId,'record-id'));cell(row,'Lịch gửi',el('span',date(job.dueAt)),el('small',job.sentAt?'Đã gửi: '+date(job.sentAt):''));cell(row,'Trạng thái',badge(mailLabels[job.state]||job.state,job.state),el('small',job.error||''));
      const action=el('button',job.state==='uncertain'?'Kiểm tra & gửi lại':'Xem hồ sơ','text-button');action.type='button';action.onclick=()=>job.state==='uncertain'?retryMail(job,action):openDetail(job.applicationId);cell(row,'Thao tác',action);$('mailBody').append(row);
    }
    if(!result.jobs.length)placeholder($('mailBody'),5,'Chưa có email trong danh sách','Email nhắc được tạo khi tiếp nhận hồ sơ kế hoạch mới.');
    summary(result.summary,true);pagination('mail',result.page,result.total,result.pageSize);
  }
  async function retryMail(job,button){
    const epoch=state.epoch;
    if(!await confirmAction('Gửi lại email nhắc?', 'Email này có thể đã được gửi nhưng chưa ghi nhận kết quả. Chỉ xác nhận sau khi kiểm tra để tránh gửi trùng cho sinh viên.')||epoch!==state.epoch)return;
    button.disabled=true;
    try{await request('retryReminder',{jobId:job.id,confirmDuplicateRisk:true});if(epoch!==state.epoch)return;toast('Đã đưa email vào hàng đợi gửi lại.');await load();}catch(error){if(epoch===state.epoch)issue(error);}finally{button.disabled=false;}
  }
  function safeFile(value){try{const u=new URL(value);return u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
  async function openDetail(id){
    const epoch=state.epoch,detailId=++state.detailId;
    state.selected=null;$('detailTitle').textContent='Thông tin hồ sơ';$('detailId').textContent=id;$('detailContent').hidden=true;$('detailLoading').hidden=false;$('detailError').textContent='';
    if(!$('detailDialog').open)$('detailDialog').showModal();
    try{const data=await request('getApplicationDetails',{applicationId:id});if(epoch!==state.epoch||detailId!==state.detailId)return;renderDetail(data);}
    catch(error){if(epoch===state.epoch&&detailId===state.detailId)$('detailError').textContent=error.message;}
    finally{if(epoch===state.epoch&&detailId===state.detailId)$('detailLoading').hidden=true;}
  }
  function renderDetail(data){
    state.selected=data.application;const a=data.application;$('detailContent').hidden=false;$('detailTitle').textContent=a.studentName;$('detailId').textContent=a.id;
    const fields=[[a.unitId?'Mã đơn vị':'MSSV',a.studentId],['Người nộp',a.unitName||a.email],['Số liên hệ',a.phone||'Chưa cung cấp'],['Loại hồ sơ',a.docType],['Ngày nộp',date(a.submittedAt)],['Nhận kết quả',a.deliveryMethod==='post'?'Gửi bưu điện':'Tại Văn phòng Đoàn']];
    if(a.deliveryMethod==='post')fields.push(['Điện thoại người nhận',a.deliveryPhone||'—'],['Địa chỉ nhận',a.deliveryAddress||'—']);
    $('detailMeta').replaceChildren(...fields.map(([label,value])=>{const div=el('div');div.append(el('dt',label),el('dd',value));return div;}));
    $('detailReason').textContent=a.reason;$('detailStatus').value=a.status;$('detailNote').value=a.note||'';
    const file=safeFile(a.fileUrl);$('detailFile').hidden=!file;if(file){$('detailFile').href=file;$('detailFile').textContent=(a.fileName||'Mở tệp đính kèm')+' ↗';}else $('detailFile').removeAttribute('href');
    $('paperSection').hidden=!isPlan(a);
    $('paperStatus').textContent=data.hardcopy?'Đã nhận bản cứng lúc '+date(data.hardcopy.receivedAt):'Chưa xác nhận nhận bản cứng.';
    $('receivePaper').hidden=Boolean(data.hardcopy);
    $('reminderStatus').textContent=data.reminder?`Email: ${mailLabels[data.reminder.state]||data.reminder.state} · Lịch gửi ${date(data.reminder.dueAt)}`:'Hồ sơ chưa có lịch email. Lịch tự động áp dụng cho hồ sơ mới sau khi nâng cấp máy chủ.';
    $('auditList').replaceChildren(...data.audit.map(entry=>{const li=el('li');li.append(el('strong',entry.fromStatus===entry.toStatus?'Cập nhật hồ sơ':`${entry.fromStatus} → ${entry.toStatus}`),el('p',entry.note||'Không có ghi chú'),el('small',date(entry.createdAt)));return li;}));
    if(!data.audit.length)$('auditList').append(el('li','Chưa có cập nhật xử lý.'));
  }
  async function change(action,payload,success){
    if(state.busy||!state.selected)return;state.busy=true;const epoch=state.epoch,id=state.selected.id;
    $('saveDetail').disabled=true;$('receivePaper').disabled=true;$('closeDetail').disabled=true;$('detailError').textContent='';
    try{await request(action,payload);if(epoch!==state.epoch)return;toast(success);await openDetail(id);await load();}
    catch(error){if(epoch===state.epoch)$('detailError').textContent=error.message;}
    finally{state.busy=false;$('saveDetail').disabled=false;$('receivePaper').disabled=false;$('closeDetail').disabled=false;}
  }
  $('updateForm').onsubmit=e=>{e.preventDefault();if(!state.selected)return;const a=state.selected;change('updateApplication',{applicationId:a.id,expectedStatus:a.status,expectedUpdatedAt:a.updatedAt,status:$('detailStatus').value,note:$('detailNote').value.trim()},'Đã cập nhật hồ sơ và thông báo trên tài khoản sinh viên.');};
  $('receivePaper').onclick=async()=>{if(!state.selected)return;const id=state.selected.id,epoch=state.epoch;if(await confirmAction('Xác nhận đã nhận bản cứng','Bạn đã nhận bản cứng của hồ sơ này tại Văn phòng Đoàn? Email nhắc đang chờ sẽ được hủy.')&&epoch===state.epoch)change('recordHardcopy',{applicationId:id,note:''},'Đã ghi nhận bản cứng. Email đang chờ gửi sẽ được hủy.');};
  $('closeDetail').onclick=()=>{if(!state.busy){state.detailId++;$('detailDialog').close();}};
  $('detailDialog').addEventListener('cancel',e=>{if(state.busy)e.preventDefault();else state.detailId++;});
  $('filterForm').onsubmit=e=>{e.preventDefault();if($('fromFilter').value&&$('toFilter').value&&$('fromFilter').value>$('toFilter').value){toast('Ngày bắt đầu cần trước hoặc bằng ngày kết thúc.');return;}state.page=1;load();};
  $('filterForm').onreset=()=>queueMicrotask(()=>{state.page=1;load();});
  $('mailFilter').onchange=()=>{state.mailPage=1;load();};
  $('previousPage').onclick=()=>{state.page--;load();};$('nextPage').onclick=()=>{state.page++;load();};$('mailPrevious').onclick=()=>{state.mailPage--;load();};$('mailNext').onclick=()=>{state.mailPage++;load();};
  $('exportButton').onclick=()=>download('ho-so-trang-'+state.page+'.csv',csv([['Mã hồ sơ','Sinh viên','MSSV','Email','Loại hồ sơ','Ngày nộp','Trạng thái','Bản cứng','Đơn vị','Số liên hệ','Nhận kết quả','Điện thoại nhận','Địa chỉ nhận'],...state.items.map(i=>[i.id,i.studentName,i.studentId,i.email,i.docType,date(i.submittedAt),i.status,paperLabel(i),i.unitName||'',i.phone||'',i.deliveryMethod==='post'?'Bưu điện':'Văn phòng Đoàn',i.deliveryPhone||'',i.deliveryAddress||''])]),'text/csv;charset=utf-8');
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
    if(state.view===button.dataset.view)return;state.view=button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);active?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});
    const mail=state.view==='mail';$('applicationsPanel').hidden=mail;$('mailPanel').hidden=!mail;$('pageTitle').textContent=mail?'Email nhắc bản cứng':'Quản lý hồ sơ';$('pageDescription').textContent=mail?'Theo dõi lịch gửi, kết quả gửi và các trường hợp cần kiểm tra.':'Tiếp nhận hồ sơ, theo dõi tiến độ và xác nhận bản cứng.';load();
  });
  $('logoutButton').onclick=logout;
  async function connect(name){
    const epoch=++state.epoch;state.ready=false;$('adminName').textContent=name||'Quản trị viên';$('refreshButton').disabled=true;$('connectionIssue').hidden=true;$('connectionStatus').textContent='Đang kiểm tra kết nối…';
    try{const verified=await request('verifyAdmin');if(epoch!==state.epoch)return;
      const capabilities=verified.capabilities;
      if(!capabilities||capabilities.version<3||!['listAdminApplications','getApplicationDetails','listMailJobs','recordHardcopy','updateApplication','retryReminder'].every(a=>capabilities.actions?.includes(a)))throw Object.assign(new Error('Máy chủ chưa hỗ trợ phiên bản quản trị này.'),{code:'UNSUPPORTED_API'});
      state.capabilities=capabilities;state.ready=true;await load();
    }catch(error){if(epoch!==state.epoch)return;issue(error);placeholder($('tableBody'),6,'Chưa kết nối được dữ liệu hồ sơ','Xem thông báo phía trên để khôi phục kết nối.');$('totalCount').textContent='Chưa tải dữ liệu từ máy chủ.';}
    finally{if(epoch===state.epoch)$('refreshButton').disabled=false;}
  }
  $('refreshButton').onclick=()=>state.ready?load():connect($('adminName').textContent);
  function clear(){state.epoch++;state.loadId++;state.detailId++;state.ready=false;state.selected=null;state.items=[];closeConfirmation?.(false);$('detailDialog').close();$('detailContent').hidden=true;$('detailMeta').replaceChildren();$('detailReason').textContent='';$('detailNote').value='';$('detailFile').removeAttribute('href');$('auditList').replaceChildren();$('tableBody').replaceChildren();$('mailBody').replaceChildren();$('summaryCards').querySelectorAll('strong').forEach(n=>n.textContent='—');$('exportButton').disabled=true;}
  return {connect,clear};
}
