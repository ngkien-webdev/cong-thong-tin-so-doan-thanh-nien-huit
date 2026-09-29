import {publicNewsRequest,getCachedNewsList} from './news-api.js';
import {createNewsCard,disposeNewsCards} from './news-cards.js';
const grid=document.getElementById('newsContainer');
if(grid){
  const status=document.createElement('div');status.className='news-api-status';status.setAttribute('role','status');const copy=document.createElement('span'),retry=document.createElement('button'),all=document.createElement('a');retry.type='button';retry.textContent='Tải lại tin mới';all.href='tin-tuc/';all.textContent='Xem kho tin tức →';status.append(copy,retry,all);grid.before(status);
  let loading=false,controller,refreshTimer,rendered='',savedAt=0;
  const savedTime=()=>new Date(savedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  function render(result){
    const signature=JSON.stringify(result.posts.map(post=>[post.id,post.revision]));
    if(signature===rendered)return;
    rendered=signature;disposeNewsCards(grid);grid.querySelectorAll('[data-dynamic-news]').forEach(c=>c.remove());
    grid.prepend(...result.posts.map(post=>createNewsCard(post,{home:true})));
    document.dispatchEvent(new Event('huit:news-updated'));
  }
  async function load(){
    if(loading)return;loading=true;retry.disabled=true;controller=new AbortController();
    const cached=getCachedNewsList({}, {allowStale:true});
    if(cached){savedAt=cached.savedAt;render(cached.data);copy.textContent=`Bản tin đã lưu lúc ${savedTime()} · Đang kiểm tra tin mới…`;}
    else copy.textContent='Đang cập nhật tin mới…';
    try{
      const result=await publicNewsRequest('listPublicNews',{}, {signal:controller.signal,fresh:true});
      render(result);savedAt=Date.now();copy.textContent=result.posts.length?`Đã cập nhật lúc ${savedTime()} · Tin từ ban biên tập.`:'Các tin tức hiện có của cổng thông tin.';
    }catch(error){
      if(error.name!=='AbortError')copy.textContent=savedAt?`Đang hiển thị bản tin đã lưu lúc ${savedTime()}. Chưa kết nối được để cập nhật.`:'Chưa tải được tin mới. Bạn vẫn có thể đọc các tin hiện có bên dưới.';
    }finally{loading=false;retry.disabled=false;}
  }
  retry.onclick=load;
  function startRefresh(){window.clearInterval(refreshTimer);refreshTimer=window.setInterval(()=>{if(!document.hidden)load();},300000);}
  window.addEventListener('pageshow',e=>{if(e.persisted){startRefresh();load();}});
  // Keep the home page fresh after an editor publishes a post in another tab.
  // The interval is deliberately conservative so it does not create a request storm.
  startRefresh();
  window.addEventListener('pagehide',()=>{window.clearInterval(refreshTimer);controller?.abort();});
  load();
}
