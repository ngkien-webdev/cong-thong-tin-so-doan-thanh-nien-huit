/** News CMS for the verified existing Apps Script project. No public Drive sharing. */
var NEWS_HEADERS = ['id','title','summary','content','category','imageFileId','imageMime','imageAlt','status','authorName','authorUid','createdAt','updatedAt','publishedAt','revision','lastRequestId'];
var NEWS_CATEGORIES = ['Hoạt động Đoàn - Hội','Thông báo','Sự kiện','Gương sáng sinh viên'];
function newsSheet_() {
  if(typeof PORTAL_V4_REQUEST!=='undefined'&&PORTAL_V4_REQUEST&&PORTAL_V4_REQUEST.sheets.news)return PORTAL_V4_REQUEST.sheets.news;
  var sheet=SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID')).getSheetByName('NewsPosts');
  if(!sheet)throw apiError_('NEWS_SETUP_REQUIRED','Chưa khởi tạo kho bài viết. Quản trị hệ thống cần chạy setupNewsCMS.');
  var actual=sheet.getRange(1,1,1,NEWS_HEADERS.length).getValues()[0];
  if(NEWS_HEADERS.some(function(h,i){return actual[i]!==h;}))throw apiError_('SCHEMA_MISMATCH','Cấu trúc kho bài viết chưa phù hợp.');
  if(typeof PORTAL_V4_REQUEST!=='undefined'&&PORTAL_V4_REQUEST)PORTAL_V4_REQUEST.sheets.news=sheet;
  return sheet;
}
function setupNewsCMS() {
  var book=SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID'));
  if(!book.getSheetByName('NewsPosts')){var sheet=book.insertSheet('NewsPosts');sheet.appendRow(NEWS_HEADERS);sheet.setFrozenRows(1);}
  newsSheet_();
  Logger.log('Kho bài viết sẵn sàng. Không thay đổi hồ sơ hoặc bài viết có sẵn.');
}
function newsRows_(){return readRows_(newsSheet_(),NEWS_HEADERS.length).map(function(row,index){var item={row:index+2};NEWS_HEADERS.forEach(function(h,i){item[h]=row[i] instanceof Date?row[i].toISOString():row[i];});return item;}).filter(function(p){return p.id;});}
function newsText_(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.length>max)throw apiError_('INVALID_INPUT',label+' không hợp lệ.');return value.trim();}
function newsSearchText_(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function newsPublic_(post,full){var out={id:post.id,title:post.title,summary:post.summary,category:post.category,imageAlt:post.imageAlt,hasImage:Boolean(post.imageFileId),authorName:post.authorName,publishedAt:post.publishedAt,revision:Number(post.revision)};if(full)out.content=post.content;return out;}
function newsAdmin_(post){var out={};NEWS_HEADERS.filter(function(k){return k!=='imageFileId'&&k!=='imageMime'&&k!=='lastRequestId';}).forEach(function(k){out[k]=post[k];});out.revision=Number(out.revision);out.hasImage=Boolean(post.imageFileId);return out;}
function newsImage_(post){
  if(!post.imageFileId)return '';
  if(['image/jpeg','image/png'].indexOf(post.imageMime)<0)throw apiError_('INVALID_IMAGE','Ảnh không hợp lệ.');
  var blob=DriveApp.getFileById(post.imageFileId).getBlob(),bytes=blob.getBytes();
  if(bytes.length>600000||!validSignature_(bytes,post.imageMime))throw apiError_('INVALID_IMAGE','Không đọc được ảnh bài viết.');
  return 'data:'+post.imageMime+';base64,'+Utilities.base64Encode(bytes);
}
function newsPublicRoute_(action,params){
  var cacheKey='portal:public-news:v1',isDefault=action==='listPublicNews'&&(!params.page||String(params.page)==='1')&&!params.query&&!params.category;
  if(isDefault){try{var hit=CacheService.getScriptCache().get(cacheKey);if(hit)return JSON.parse(hit);}catch(ignored){}}
  var posts=newsRows_().filter(function(p){return p.status==='published';});
  if(action==='listPublicNews'){
    var page=Math.max(1,Number(params.page)||1),size=12;
    if(!Number.isInteger(page)||page>10000)throw apiError_('INVALID_INPUT','Trang không hợp lệ.');
    var q=newsSearchText_(String(params.query||'').slice(0,150));
    posts=posts.filter(function(p){return (!params.category||p.category===params.category)&&(!q||newsSearchText_([p.title,p.summary].join(' ')).includes(q));}).sort(function(a,b){return new Date(b.publishedAt)-new Date(a.publishedAt)||String(a.id).localeCompare(String(b.id));});
    var result={posts:posts.slice((page-1)*size,page*size).map(function(p){return newsPublic_(p,false);}),total:posts.length,page:page,hasMore:page*size<posts.length};
    if(isDefault){try{var serialized=JSON.stringify(result);if(serialized.length<25000)CacheService.getScriptCache().put(cacheKey,serialized,15);}catch(ignored){}}
    return result;
  }
  var post=posts.find(function(p){return p.id===params.id;});
  if(!post)throw apiError_('NOT_FOUND','Bài viết không tồn tại hoặc chưa được đăng.');
  if(action==='getPublicNews')return {post:newsPublic_(post,true)};
  if(action==='getNewsImage')return {dataUrl:newsImage_(post)};
  throw apiError_('UNKNOWN_ACTION','Không có thao tác này.');
}
function newsAdminRoute_(action,body){
  var user=authenticate_(body.authToken,true);
  // authenticate_(..., true) checks the active server-side administrator grant.
  if(action==='listNewsAdmin'){
    var posts=newsRows_().sort(function(a,b){return new Date(b.updatedAt)-new Date(a.updatedAt);});
    var query=newsSearchText_(String(body.query||'').slice(0,150)),filtered=posts.filter(function(p){return (!body.status||p.status===body.status)&&(!query||newsSearchText_([p.title,p.category].join(' ')).includes(query));});
    var page=Math.max(1,Math.floor(Number(body.page)||1));
    return {posts:filtered.slice((page-1)*20,page*20).map(newsAdmin_),total:filtered.length,page:page,hasMore:page*20<filtered.length,summary:{total:posts.length,published:posts.filter(function(p){return p.status==='published';}).length,draft:posts.filter(function(p){return p.status==='draft';}).length,archived:posts.filter(function(p){return p.status==='archived';}).length}};
  }
  if(action==='getNewsAdmin'){
    var post=newsRows_().find(function(p){return p.id===body.id;});
    if(!post)throw apiError_('NOT_FOUND','Không tìm thấy bài viết.');
    return {post:newsAdmin_(post),dataUrl:newsImage_(post)};
  }
  if(action==='saveNews')return newsSave_(user,body);
  throw apiError_('UNKNOWN_ACTION','Không có thao tác này.');
}
function newsSave_(user,body){
  var raw=body.post||{},id=newsText_(raw.id,10,80,'Mã bài viết'),requestId=newsText_(body.requestId,8,100,'Mã yêu cầu');
  if(!/^NEWS-[a-zA-Z0-9-]+$/.test(id))throw apiError_('INVALID_INPUT','Mã bài viết không hợp lệ.');
  var status=raw.status;
  if(['draft','published','archived'].indexOf(status)<0)throw apiError_('INVALID_INPUT','Trạng thái không hợp lệ.');
  var title=newsText_(raw.title,status==='published'?8:1,180,'Tiêu đề'),summary=newsText_(raw.summary||'',status==='published'?20:0,400,'Mô tả ngắn'),content=newsText_(raw.content||'',status==='published'?50:0,30000,'Nội dung'),imageAlt=newsText_(raw.imageAlt||'',status==='published'?3:0,200,'Mô tả ảnh');
  if(NEWS_CATEGORIES.indexOf(raw.category)<0)throw apiError_('INVALID_INPUT','Chuyên mục không hợp lệ.');
  var image=null;
  if(body.image){image=validateFile_(body.image);if(!image||['image/jpeg','image/png'].indexOf(image.mimeType)<0||image.bytes.length>600000)throw apiError_('INVALID_IMAGE','Ảnh cần là JPG hoặc PNG, tối đa 600 KB sau tối ưu.');}
  var lock=LockService.getScriptLock();lock.waitLock(20000);var uploaded=null,writing=false;
  try{
    var sheet=newsSheet_(),existing=newsRows_().find(function(p){return p.id===id;});
    if(existing&&existing.lastRequestId===requestId)return {post:newsAdmin_(existing)};
    if(existing&&Number(body.expectedRevision)!==Number(existing.revision)||!existing&&Number(body.expectedRevision)!==0)throw apiError_('CONFLICT','Bài viết đã thay đổi ở phiên khác. Tải lại bài trước khi lưu. Nội dung đang nhập được giữ nguyên.');
    var imageFileId=existing&&existing.imageFileId||'',imageMime=existing&&existing.imageMime||'';
    if(body.removeImage===true){imageFileId='';imageMime='';}
    if(image){
      // Separate folder; never publish dossier file IDs or change their sharing.
      var parent=DriveApp.getFolderById(requiredProperty_('DRIVE_FOLDER_ID')),folders=parent.getFoldersByName('Portal News Images');
      var folder=folders.hasNext()?folders.next():parent.createFolder('Portal News Images');
      uploaded=folder.createFile(Utilities.newBlob(image.bytes,image.mimeType,id+'-'+Utilities.getUuid()+'.'+(image.mimeType==='image/png'?'png':'jpg')));imageFileId=uploaded.getId();imageMime=image.mimeType;
    }
    if(status==='published'&&!imageFileId)throw apiError_('IMAGE_REQUIRED','Chọn ảnh bìa trước khi đăng bài.');
    var now=new Date().toISOString(),post={id:id,title:title,summary:summary,content:content,category:raw.category,imageFileId:imageFileId,imageMime:imageMime,imageAlt:imageAlt,status:status,authorName:existing?existing.authorName:(user.displayName||'Ban biên tập Đoàn - Hội'),authorUid:existing?existing.authorUid:user.uid,createdAt:existing?existing.createdAt:now,updatedAt:now,publishedAt:status==='published'?(existing&&existing.publishedAt||now):(existing&&existing.publishedAt||''),revision:Number(existing&&existing.revision||0)+1,lastRequestId:requestId};
    // Literal cells prevent formulas; the full article changes in one atomic request.
    var values=NEWS_HEADERS.map(function(k){return {userEnteredValue:{stringValue:String(post[k])}};});
    var req=existing?{updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:existing.row-1,endRowIndex:existing.row,startColumnIndex:0,endColumnIndex:NEWS_HEADERS.length},rows:[{values:values}],fields:'userEnteredValue'}}:{appendCells:{sheetId:sheet.getSheetId(),rows:[{values:values}],fields:'userEnteredValue'}};
    writing=true;
    try{CacheService.getScriptCache().remove('portal:public-news:v1');}catch(ignored){}
    var response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(requiredProperty_('SPREADSHEET_ID'))+':batchUpdate',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:[req]}),muteHttpExceptions:true});
    if(response.getResponseCode()>=300)throw apiError_('SAVE_FAILED','Chưa xác nhận được kết quả lưu. Hãy thử lưu lại cùng nội dung.');
    try{CacheService.getScriptCache().remove('portal:public-news:v1');}catch(ignored){}
    return {post:newsAdmin_(post)};
  }catch(error){if(uploaded&&!writing){try{uploaded.setTrashed(true);}catch(ignored){}}throw error;}finally{lock.releaseLock();}
}
