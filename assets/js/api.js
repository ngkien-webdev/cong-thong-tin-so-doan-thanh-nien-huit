import {API_URL} from './firebase-config.js';

// A single deadline covers authentication, redirects and body decoding.
// Never automatically retry an uncertain write: it may already be committed.
export async function apiRequest(user, action, payload = {}, refresh = false) {
  if(!user)throw new Error('Vui lòng đăng nhập để tiếp tục.');
  const controller=new AbortController(),read=/^(get|list|verify)/.test(action);
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
    const error=Object.assign(new Error(read?'Kết nối đang chậm. Chọn Thử lại hoặc Làm mới để tải lại dữ liệu.':'Chưa nhận được xác nhận từ máy chủ. Hãy tải lại danh sách trước khi gửi lại để tránh tạo trùng.'),{code:'REQUEST_TIMEOUT'});
    reject(error);controller.abort();
  },read?30000:60000);});
  const work=async()=>{
    for(let attempt=0;attempt<2;attempt++){
      const authToken=await user.getIdToken(refresh||attempt>0);
      if(controller.signal.aborted)throw Object.assign(new Error('Hết thời gian kết nối.'),{code:'REQUEST_TIMEOUT'});
      const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload,action,authToken}),signal:controller.signal,redirect:'follow',cache:'no-store'});
      let result;
      try{result=await response.json();}catch{throw new Error('Chưa đọc được phản hồi của máy chủ. Vui lòng thử tải lại.');}
      if(response.ok&&result.success)return result;
      if(!refresh&&attempt===0&&['AUTH_INVALID','AUTH_EXPIRED'].includes(result.code))continue;
      throw Object.assign(new Error(result.message||'Không thể hoàn thành yêu cầu.'),{code:result.code});
    }
  };
  try{return await Promise.race([work(),timeout]);}
  catch(error){if(error instanceof TypeError)throw Object.assign(new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi chọn Thử lại.'),{code:'NETWORK_ERROR'});throw error;}
  finally{clearTimeout(timer);}
}
