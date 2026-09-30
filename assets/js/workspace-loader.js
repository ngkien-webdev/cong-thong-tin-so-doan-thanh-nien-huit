// A failed CDN/module load must not leave the initial loading state indefinitely.
(() => {
  const script=document.currentScript,target=document.getElementById(script.dataset.message);
  let settled=false;
  const fail=()=>{
    if(settled)return;
    if(target){target.replaceChildren(document.createTextNode('Chưa kết nối được trang quản trị. Kiểm tra mạng rồi thử lại. '));const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Thử lại';retry.onclick=()=>location.reload();target.append(retry);target.classList.add('error');}
  };
  const timer=setTimeout(fail,35000);
  window.addEventListener('huit:workspace-ready',()=>{settled=true;clearTimeout(timer);},{once:true});
  import(new URL(script.dataset.entry,script.src).href).catch(()=>{clearTimeout(timer);fail();});
})();
