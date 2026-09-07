import {createRecordPlayer} from './media.mjs';
import {chapterRecords} from './journey-core.mjs';
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
/** A companion workspace. It never changes the chapter gate or writes browsing history. */
export function installJourney({reader,getRecords,getLimit}){
 const dialog=document.querySelector('#reader'),scroll=document.querySelector('#reader-scroll'),tools=document.querySelector('.reader-tools');
 const life=new AbortController(),signal=life.signal;
 const workspace=element('div',null,'reader-workspace');scroll.before(workspace);workspace.append(scroll);
 const toggle=element('button','同じ章の映像');toggle.id='journey-toggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','journey-shelf');tools.append(toggle);
 const aside=element('aside',null,'journey-shelf');aside.id='journey-shelf';aside.hidden=true;aside.setAttribute('aria-label','読書と映像のワークスペース');workspace.append(aside);
 const top=element('div',null,'journey-head'),kicker=element('p','COMPANION RECORDS','eyebrow'),title=element('h3','同じ章を、違う視点で。');top.append(kicker,title);aside.append(top);
 const intro=element('p','本文を開いたまま、同じ章の映像へ。場面と再生時刻の自動同期ではありません。','journey-note');aside.append(intro);
 const choices=element('div',null,'journey-choices');choices.id='journey-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label','この章の映像を選ぶ');aside.append(choices);
 const selectedTitle=element('p',null,'journey-selection');aside.append(selectedTitle);
 const connect=element('button','YouTubeに接続');connect.id='journey-connect';connect.type='button';aside.append(connect);
 const host=element('div',null,'journey-video');host.id='journey-player';const status=element('p',null,'journey-note');status.id='journey-status';status.setAttribute('role','status');aside.append(host,status);
 const playback=element('div',null,'journey-playback');playback.hidden=true;
 const play=element('button','再生'),pause=element('button','一時停止');play.id='journey-play';pause.id='journey-pause';for(const b of [play,pause])b.type='button';playback.append(play,pause);aside.append(playback);
 const external=element('a','YouTubeで開く ↗','journey-external');external.target='_blank';external.rel='noopener noreferrer';external.hidden=true;aside.append(external);
 const back=element('button','本文だけに戻る');back.id='journey-back';back.type='button';aside.append(back);
 const player=createRecordPlayer(host,status);let videos=[],selected=null,record=null,revision=0;
 function setOpen(on,{focus=true}={}){
  const mark=reader.capturePosition();revision++;if(!on)player.close();aside.hidden=!on;dialog.classList.toggle('with-companion',on);toggle.setAttribute('aria-expanded',String(on));
  if(mark)reader.restorePosition(mark);if(focus){if(on)(choices.querySelector('button')||back).focus({preventScroll:true});else toggle.focus({preventScroll:true});}
 }
 function choose(id){const r=videos.find(r=>r.id===id);if(!r)return false;revision++;player.close();selected=r;selectedTitle.textContent=r.title;connect.hidden=false;external.href=r.url;external.hidden=false;for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.video===id));return true;}
 function configure(){
  const current=reader.getState().record;if(current===record)return;record=current;player.close();videos=chapterRecords(getRecords(),current,getLimit()).filter(r=>r.kind==='video');selected=null;choices.replaceChildren();
  for(const [i,r] of videos.entries()){const b=element('button');b.type='button';b.dataset.video=r.id;b.append(element('small',`FILM ${String(i+1).padStart(2,'0')}`),element('span',r.title));b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(r.id),{signal});choices.append(b);}
  title.textContent=videos.length?'同じ章を、違う視点で。':'この章の映像は、索引に未登録。';
  connect.hidden=!videos.length;external.hidden=true;selectedTitle.textContent='';if(videos.length)choose(videos[0].id);
 }
 toggle.addEventListener('click',()=>{configure();setOpen(aside.hidden);},{signal});back.addEventListener('click',()=>setOpen(false),{signal});
 connect.addEventListener('click',async()=>{if(!selected||aside.hidden||!dialog.open)return;connect.disabled=true;const own=++revision;try{await player.connect(selected);}finally{if(own===revision)connect.disabled=false;}},{signal});
 host.addEventListener('akashic:mediachange',()=>{const s=player.getState().state;playback.hidden=!['ready','playing','paused','ended'].includes(s);play.disabled=s==='playing';pause.disabled=s!=='playing';if(s==='idle')connect.disabled=false;},{signal});
 play.addEventListener('click',()=>player.play(),{signal});pause.addEventListener('click',()=>player.pause(),{signal});
 dialog.addEventListener('akashic:reader-open',()=>{stop();configure();},{signal});
 const stop=()=>{revision++;player.close();aside.hidden=true;dialog.classList.remove('with-companion');toggle.setAttribute('aria-expanded','false');};
 dialog.addEventListener('close',()=>{if(!dialog.open)stop();},{signal});dialog.addEventListener('cancel',stop,{signal});document.querySelector('#reader-close').addEventListener('click',stop,{capture:true,signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause();},{signal});
 addEventListener('pagehide',()=>{stop();life.abort();},{once:true});
 return {getState:()=>({open:!aside.hidden,record,selected:selected?.id||null,video:player.getState(),choices:videos.length}),close:()=>setOpen(false,{focus:false})};
}
