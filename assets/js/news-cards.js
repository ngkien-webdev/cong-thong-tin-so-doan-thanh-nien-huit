import {loadNewsImage} from './news-api.js';
import {newsDate,newsDisplayTitle} from './news-utils.js';
const root=new URL('../../',import.meta.url);
const imageJobs=new WeakMap(),cardCleanup=new WeakMap(),queue=[];
let activeImages=0;
function drainImages(){
  while(activeImages<3&&queue.length){
    const job=queue.shift();
    if(job.signal.aborted||!job.img.isConnected)continue;
    activeImages++;
    loadNewsImage(job.id,{revision:job.revision,signal:job.signal}).then(src=>{
      if(job.signal.aborted||!job.img.isConnected)return;
      job.img.src=src;job.img.classList.remove('placeholder');
    }).catch(error=>{if(error.name!=='AbortError')job.img.alt='Ảnh bài viết chưa tải được';})
      .finally(()=>{activeImages--;drainImages();});
  }
}
function enqueueImage(job){queue.push(job);queueMicrotask(drainImages);}
const imageObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    imageObserver.unobserve(entry.target);
    const job=imageJobs.get(entry.target);imageJobs.delete(entry.target);
    if(job)enqueueImage(job);
  });
},{rootMargin:'240px 0px'}):null;
export function disposeNewsCards(container){
  container.querySelectorAll('[data-dynamic-news]').forEach(card=>{
    cardCleanup.get(card)?.();cardCleanup.delete(card);
  });
}
export function createNewsCard(post,{home=false}={}){
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const card=el('article',home?'news-card is-visible':'public-news-card');card.id=post.id;card.dataset.dynamicNews='true';
  const link=new URL('tin-tuc/?id='+encodeURIComponent(post.id),root).href;
  const imageLink=el('a',home?'news-image':'news-image-wrap');imageLink.href=link;imageLink.setAttribute('aria-label',post.title);
  const img=el('img','placeholder');img.src=new URL('assets/images/logo-huit-doan.png',root).href;img.alt=post.imageAlt||post.title;img.width=600;img.height=375;img.loading='lazy';imageLink.append(img);
  const body=el('div',home?'news-content':'public-news-copy');const category=el('small','news-category',post.category);const heading=el('h3',home?'news-title':'');const displayTitle=newsDisplayTitle(post.title,{max:home?86:100});const titleLink=el('a','',displayTitle);titleLink.title=post.title;titleLink.setAttribute('aria-label',post.title);titleLink.href=link;heading.append(titleLink);const description=el('p','news-excerpt',post.summary);const date=el('time','news-date',newsDate(post.publishedAt));date.dateTime=post.publishedAt;body.append(category,heading,description,date);card.append(imageLink,body);
  if(post.hasImage){
    const controller=new AbortController(),job={img,id:post.id,revision:post.revision,signal:controller.signal};
    cardCleanup.set(card,()=>{controller.abort();imageObserver?.unobserve(img);imageJobs.delete(img);});
    if(imageObserver){imageJobs.set(img,job);imageObserver.observe(img);}else enqueueImage(job);
  }
  return card;
}
