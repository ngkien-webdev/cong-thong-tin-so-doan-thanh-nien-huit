import {mountEditor} from '../dang-bai/ui.js';
const posts=new Map(),images=new Map();let failOnce=new URLSearchParams(location.search).has('fail');
const ui=mountEditor({logout:async()=>ui.clear(),request:async(action,p={})=>{
  if(action==='verifyAdmin')return {capabilities:{news:{version:1}}};
  if(action==='listNewsAdmin'){const all=[...posts.values()],list=all.filter(x=>(!p.status||x.status===p.status)&&(!p.query||x.title.includes(p.query)));return {posts:list,total:list.length,page:1,hasMore:false,summary:{total:all.length,published:all.filter(x=>x.status==='published').length,draft:all.filter(x=>x.status==='draft').length}};}
  if(action==='getNewsAdmin')return {post:posts.get(p.id),dataUrl:images.get(p.id)||''};
  if(action==='saveNews'){
    const old=posts.get(p.post.id);if(old?.lastRequestId===p.requestId)return {post:old};
    if((old?.revision||0)!==p.expectedRevision)throw new Error('Bài đã được chỉnh sửa ở phiên khác.');
    if(p.image)images.set(p.post.id,'data:'+p.image.mimeType+';base64,'+p.image.base64);if(p.removeImage)images.delete(p.post.id);
    const post={...p.post,revision:(old?.revision||0)+1,hasImage:images.has(p.post.id),updatedAt:new Date().toISOString(),publishedAt:p.post.status==='published'?new Date().toISOString():'',lastRequestId:p.requestId};posts.set(post.id,post);
    if(failOnce){failOnce=false;throw new Error('Giả lập mất phản hồi sau khi lưu.');}return {post};
  }
  throw new Error('Unknown fixture action');
}});ui.connect('Biên tập thử nghiệm','cms-preview');
