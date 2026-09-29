import {API_URL} from './firebase-config.js';
export async function apiRequest(user, action, payload = {}, refresh = false) {
  if(!user) throw new Error('Vui lòng đăng nhập để tiếp tục.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 90000);
  try {
    const authToken = await user.getIdToken(refresh);
    const response = await fetch(API_URL, {method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload, action, authToken}),signal:controller.signal,redirect:'follow',cache:'no-store'});
    let result;
    try {result=await response.json();} catch {throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Kiểm tra bản triển khai Apps Script.');}
    if(!response.ok || !result.success){
      if(!refresh && ['AUTH_INVALID','AUTH_EXPIRED'].includes(result.code))return apiRequest(user,action,payload,true);
      const error=new Error(result.message||'Không thể hoàn thành yêu cầu.');error.code=result.code;throw error;
    }
    return result;
  } catch(error) {
    if(error.name==='AbortError')throw new Error('Máy chủ phản hồi quá lâu. Hãy tải lại danh sách trước khi thử gửi lại.');
    throw error;
  } finally {clearTimeout(timeout);}
}
