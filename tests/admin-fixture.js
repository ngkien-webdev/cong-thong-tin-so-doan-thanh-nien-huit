// Local-only fixture. tests/** is excluded from Firebase Hosting.
import {mountAdmin} from '../admin/ui.js';
const apps=Array.from({length:27},(_,i)=>({id:`HS-TEST-${String(i+1).padStart(3,'0')}`,studentName:['Nguyễn An (mẫu)','Trần Bình (mẫu)','Lê Chi (mẫu)'][i%3],studentId:`TEST000${i}`,email:`student${i}@example.com`,docType:i%2?'Chuyển sinh hoạt Đoàn':'Kế hoạch - Quyết định',status:['Đang xử lý','Yêu cầu bổ sung','Hoàn thành','Từ chối'][i%4],submittedAt:'2026-09-19T03:30:00Z',updatedAt:'2026-09-19T03:30:00Z',reason:'Nội dung hồ sơ dùng để kiểm tra giao diện. Đây không phải dữ liệu sinh viên thật.',note:'',fileUrl:'',hardcopy:null,reminder:i%2?null:{state:'pending',dueAt:'2026-09-20T01:00:00Z'}}));
let audit=[];
const jobs=[{id:'mail-test',applicationId:apps[0].id,studentName:apps[0].studentName,recipient:'student0@example.com',dueAt:'2026-09-20T01:00:00Z',state:'pending',error:''},{id:'mail-review',applicationId:apps[2].id,studentName:apps[2].studentName,recipient:'student2@example.com',dueAt:'2026-09-20T01:00:00Z',state:'uncertain',error:'Lần gửi thử cần kiểm tra.'}];
const capabilities={version:3,actions:['listAdminApplications','getApplicationDetails','updateApplication','recordHardcopy','listMailJobs','retryReminder']};
const ui=mountAdmin({logout:()=>{},request:async(action,p={})=>{
  if(action==='verifyAdmin')return new URLSearchParams(location.search).has('legacy')?{admin:{}}:{admin:{},capabilities};
  if(action==='listAdminApplications'){
    const list=apps.filter(a=>(!p.status||a.status===p.status)&&(!p.docType||a.docType===p.docType)&&(!p.query||a.studentName.toLowerCase().includes(p.query.toLowerCase()))&&(!p.awaitingHardcopy||(a.reminder&&!a.hardcopy)));
    const page=Math.min(p.page,Math.max(1,Math.ceil(list.length/p.pageSize)));
    return {applications:list.slice((page-1)*p.pageSize,page*p.pageSize),total:list.length,page,pageSize:p.pageSize,docTypes:[...new Set(apps.map(a=>a.docType))],summary:{total:apps.length,pending:apps.filter(a=>a.status==='Đang xử lý').length,completed:apps.filter(a=>a.status==='Hoàn thành').length,awaitingHardcopy:apps.filter(a=>a.reminder&&!a.hardcopy).length}};
  }
  if(action==='getApplicationDetails'){const a=apps.find(a=>a.id===p.applicationId);return {application:a,audit:audit.filter(e=>e.applicationId===a.id),hardcopy:a.hardcopy,reminder:a.reminder};}
  if(action==='updateApplication'){const a=apps.find(a=>a.id===p.applicationId);audit.unshift({applicationId:a.id,fromStatus:a.status,toStatus:p.status,note:p.note,createdAt:new Date().toISOString()});Object.assign(a,{status:p.status,note:p.note,updatedAt:new Date().toISOString()});return {};}
  if(action==='recordHardcopy'){const a=apps.find(a=>a.id===p.applicationId);a.hardcopy={receivedAt:new Date().toISOString()};const job=jobs.find(j=>j.applicationId===a.id);if(job?.state==='pending'){job.state='cancelled';a.reminder.state='cancelled';}return {};}
  if(action==='listMailJobs'){const list=jobs.filter(j=>!p.state||j.state===p.state);return {jobs:list,total:list.length,page:1,pageSize:20,enabled:true,summary:Object.fromEntries(['pending','sent','uncertain','cancelled'].map(state=>[state,jobs.filter(j=>j.state===state).length]))};}
  if(action==='retryReminder'){jobs.find(j=>j.id===p.jobId).state='pending';return {};}
  throw new Error('Unhandled fixture action');
}});
ui.connect('Quản trị thử nghiệm');
