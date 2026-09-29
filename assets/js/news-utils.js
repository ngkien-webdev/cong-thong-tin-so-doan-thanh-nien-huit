export const NEWS_CATEGORIES = Object.freeze(['Hoạt động Đoàn - Hội','Thông báo','Sự kiện','Gương sáng sinh viên']);
export const NEWS_STATUSES = Object.freeze({draft:'Bản nháp',published:'Đã đăng',archived:'Đã ẩn'});
export function validateNewsPost(post, {hasImage=false} = {}) {
  const errors = {};
  if(!Object.hasOwn(NEWS_STATUSES,post.status))errors.status='Trạng thái bài viết không hợp lệ.';
  const published = post.status === 'published';
  for(const [key,label,min,max] of [['title','Tiêu đề',published?8:1,180],['summary','Mô tả ngắn',published?20:0,400],['content','Nội dung',published?50:0,30000],['imageAlt','Mô tả ảnh',published?3:0,200]]) {
    const text = typeof post[key] === 'string' ? post[key] : '';
    if(text.trim().length < min) errors[key] = `${label} cần ít nhất ${min} ký tự.`;
    else if(text.length > max)errors[key] = `${label} tối đa ${max.toLocaleString('vi-VN')} ký tự.`;
  }
  if(!NEWS_CATEGORIES.includes(post.category))errors.category='Chọn chuyên mục cho bài viết.';
  if(published&&!hasImage)errors.image='Chọn ảnh bìa trước khi đăng bài.';
  return errors;
}
export function isNewsImageDataUrl(value) {
  return typeof value === 'string' && value.length <= 800050 && /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export function newsDate(value) {
  const d = new Date(value);
  return value&&!Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'long'}).format(d) : 'Chưa đăng';
}
export function newsDisplayTitle(value,{max=100}={}) {
  const source=String(value||'').replace(/\s+/g,' ').trim();
  if(!source)return 'Chưa có tiêu đề';
  const allCaps=/[A-ZÀ-Ỹ]/.test(source)&&source.replace(/[^\p{L}]/gu,'').split('').every(ch=>ch===ch.toUpperCase());
  let title=allCaps?source.toLocaleLowerCase('vi-VN'):source;
  title=title.replace(/\s*\|\s*/g,' · ').replace(/\s+ngày\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/i,'');
  title=title.charAt(0).toLocaleUpperCase('vi-VN')+title.slice(1);
  title=title.replace(/\"([^\"]+)\"/g,'“$1”').replace(/\bhuit\b/gi,'HUIT').replace(/\btp\.?\s*hcm\b/gi,'TP.HCM');
  if(/^Công bố danh sách điểm danh · chương trình “Bình dân học vụ số”/i.test(title)&&/phường tây thạnh/i.test(title))return 'Công bố danh sách điểm danh · Chương trình “Bình dân học vụ số” tại phường Tây Thạnh';
  if(title.length<=max)return title;
  const cut=title.slice(0,Math.max(1,max-1)).replace(/\s+\S*$/,'').trim();
  return (cut||title.slice(0,max-1)).replace(/[,:;·-]+$/,'').trim()+'…';
}
export function newsParagraphs(value) {
  return String(value||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(part=>part.trim()).filter(Boolean);
}
export function renderNewsParagraphs(container, value) {
  container.replaceChildren(...newsParagraphs(value).map(text=>{
    const p=document.createElement('p'),pattern=/https?:\/\/[^\s]+/g;let cursor=0,match;
    while((match=pattern.exec(text))){
      const raw=match[0],trimmed=raw.replace(/[.,;:!?)]*$/,'');
      if(match.index>cursor)p.append(document.createTextNode(text.slice(cursor,match.index)));
      const link=document.createElement('a');link.href=trimmed;link.textContent=trimmed;link.target='_blank';link.rel='noopener noreferrer';p.append(link);
      if(trimmed.length<raw.length)p.append(document.createTextNode(raw.slice(trimmed.length)));
      cursor=match.index+raw.length;
    }
    if(cursor<text.length)p.append(document.createTextNode(text.slice(cursor)));
    return p;
  }));
}
export function newsFingerprint(post,image,removeImage) {
  return JSON.stringify({post:{id:post.id,title:post.title,summary:post.summary,content:post.content,category:post.category,imageAlt:post.imageAlt,status:post.status},image:image||null,removeImage:Boolean(removeImage)});
}
export function requestIdentity(previous, fingerprint, createId) {
  return previous?.fingerprint === fingerprint ? previous : {fingerprint,requestId:createId()};
}
export async function optimizeNewsImage(file) {
  if(!file||!['image/jpeg','image/png'].includes(file.type))throw new Error('Chọn ảnh định dạng JPG hoặc PNG.');
  if(!file.size||file.size>8*1024*1024)throw new Error('Ảnh gốc cần nhỏ hơn hoặc bằng 8 MB.');
  let source;
  let objectUrl;
  try {
    if(typeof createImageBitmap==='function') source=await createImageBitmap(file,{imageOrientation:'from-image'});
    else {
      objectUrl=URL.createObjectURL(file);
      source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Không đọc được ảnh.'));img.src=objectUrl;});
    }
    const width=source.width||source.naturalWidth,height=source.height||source.naturalHeight;
    if(!width||!height||width*height>60000000)throw new Error('Ảnh quá lớn để xử lý. Hãy chọn ảnh dưới 60 megapixel.');
    const ratio=Math.min(1,1600/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
    let dataUrl;
    for(const quality of [.86,.76,.66,.56,.46]) {
      dataUrl=canvas.toDataURL('image/jpeg',quality);
      const base64=dataUrl.split(',')[1];
      const bytes=base64?Math.floor(base64.length*3/4)-(base64.endsWith('==')?2:base64.endsWith('=')?1:0):Infinity;
      if(bytes<=600000&&isNewsImageDataUrl(dataUrl))return {name:'anh-bia.jpg',mimeType:'image/jpeg',base64,dataUrl,bytes,width:canvas.width,height:canvas.height};
    }
    throw new Error('Ảnh còn quá nhiều chi tiết sau tối ưu. Hãy chọn ảnh nhỏ hơn.');
  } catch(error) {
    if(error instanceof Error&&/^Chọn|^Ảnh|^Trình|^Không/.test(error.message))throw error;
    throw new Error('Không đọc được ảnh. Hãy chọn một tệp JPG hoặc PNG khác.');
  } finally {
    source?.close?.();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
  }
}
