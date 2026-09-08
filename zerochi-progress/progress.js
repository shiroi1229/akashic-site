'use strict';
let snapshot=null;
let selected='斜め';
const image=document.getElementById('model-image');
function showView(){
 if(!snapshot)return;
 const item=snapshot.images.find(x=>x.view===selected);
 if(!item)return;
 const url=new URL(item.url,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith(new URL('./revisions/',location.href).pathname))throw new Error('invalid image location');
 image.src=url.href;image.alt=`制作途中のゼロ地モデル：${selected}。完成した外観ではありません。`;
 document.getElementById('full').href=url.href;
 document.getElementById('caption').textContent=`${selected}からの実モデル`;
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===selected)));
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.view;showView();}));
async function refresh(){
 try{
  const response=await fetch(`current.json?t=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error('fetch');
  const data=await response.json();
  if(data.schema!=='zerochi.public-progress.v1'||!Array.isArray(data.images)||(data.images.length<3||data.images.length>4))throw new Error('format');
  snapshot=data;
  document.querySelectorAll('[data-view]').forEach(b=>{b.hidden=!data.images.some(item=>item.view===b.dataset.view);});
  if(!data.images.some(item=>item.view===selected))selected='斜め';
  showView();
  const time=document.getElementById('updated');time.dateTime=data.image_updated_at;time.textContent=new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(data.image_updated_at))+' JST';
  const progressTime=document.getElementById('progress-updated');
  progressTime.dateTime=data.progress_updated_at||data.image_updated_at;progressTime.textContent=new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(progressTime.dateTime))+' JST';
  const notice=document.getElementById('review-notice');notice.textContent=data.notice||'';notice.hidden=!data.notice;
  document.getElementById('description').textContent=data.description;
  const list=document.getElementById('limitations');list.replaceChildren(...data.limitations.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  document.getElementById('poll-status').textContent='現在公開中の画像を表示しています。';
 }catch{document.getElementById('poll-status').textContent='更新情報を取得できません。最後に読み込んだ画像を表示しています。';}
}
image.addEventListener('error',()=>{document.getElementById('poll-status').textContent='画像を取得できません。時間をおいて再読み込みしてください。';});
refresh();setInterval(refresh,60000);
