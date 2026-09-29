import {apiRequest} from './api.js';
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
export async function mountUnitHome(host,user,membership){
  const panel=node('section','','unit-home-panel');panel.id='unit-home-panel';host.after(panel);host.hidden=true;
  const heading=node('div','','unit-home-heading'),copy=node('div','');copy.append(node('span',membership.type==='faculty'?'KHÔNG GIAN KHOA':'KHÔNG GIAN CÂU LẠC BỘ','unit-home-kicker'),node('h2',membership.name),node('p','Theo dõi hồ sơ và phối hợp cùng Văn phòng Đoàn.'));
  const link=node('a','Mở khu làm việc →','unit-home-link');link.href=new URL('../../don-vi/',import.meta.url).href;heading.append(copy,link);panel.append(heading);
  const status=node('p','Đang cập nhật trạng thái hồ sơ…','unit-home-status');status.setAttribute('role','status');panel.append(status);
  try{const result=await apiRequest(user,'getUnitDashboard',{unitId:membership.unitId,pageSize:3});if(!panel.isConnected)return;
    const counts=node('div','','unit-home-counts');[['Tổng hồ sơ','total'],['Chờ xử lý','pending'],['Cần bổ sung','supplement'],['Hoàn thành','completed']].forEach(([label,key])=>{const card=node('div','');card.append(node('strong',String(result.summary?.[key]||0)),node('span',label));counts.append(card);});status.before(counts);status.textContent='Trạng thái mới nhất của đơn vị. Chọn Mở khu làm việc để xem chi tiết.';
  }catch(error){if(panel.isConnected)status.textContent='Chưa cập nhật được trạng thái. Mở khu làm việc để thử lại.';}
}
