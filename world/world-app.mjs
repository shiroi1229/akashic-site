import './local-navigation.mjs';
import {validateWorld,entryGate,cameraView,imageRect,projectSphere,cleanVisitState} from '../experience-base/world/core.mjs';
import {verifiedAsset} from './asset-loader.mjs';
import {Panorama} from '../experience-base/world/panorama.mjs';

export function createWorldApp(world,{loadAsset=verifiedAsset}={}){
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 const stage=$('#stage'),root=$('#media-root'),hotspots=$('#hotspots'),validation=validateWorld(world);
 let current=null,view=cameraView(),panorama=null,objectURL=null,requestNo=0,pending=null,paintFrame=0,disposed=false,drag=null;
 let visits={schema:'akashic-visits/v1',last:null,visited:[]},saveVisits=false;
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');let motion=!reduce.matches;
 let consentRead=false;try{consentRead=localStorage.getItem('akashic-world-save-consent')==='on';if(consentRead){saveVisits=true;visits=cleanVisitState(JSON.parse(localStorage.getItem('akashic-world-visits')||'null'),world);}}catch(_){saveVisits=false;}
 document.body.classList.toggle('no-motion',!motion);
 function notify(message){$('#toast').textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>{$('#toast').textContent=''},5000);}
 function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
 function gate(id){return entryGate(world,id);}
 function listPlaces(){
  $('#locations').replaceChildren();$('#audit-list').replaceChildren();
  const nodes=validation.ok?world.locations:[];const ready=nodes.filter(n=>gate(n.id).ok).length;
  $('#open-count').textContent=String(ready);$('#readiness-line').textContent=ready?`ゼロ地の外殻を観察し、風景の中から記録へ接続する。`:'正典の場所画像は未接続。現在、訪問できる場所は0地点。';
  for(const [i,n]of nodes.entries()){
   const g=gate(n.id),card=element('article',undefined,'location');card.append(element('small',`${String(i+1).padStart(2,'0')} / LOCATION`),element('h3',n.title),element('p',g.ok?'承認素材を照合して入域':'正典映像の受入待ち'));
   const button=element('button',g.ok?'入域する →':'受入状況を見る →');button.dataset.location=n.id;button.addEventListener('click',()=>openDetail(n.id));card.append(button);if(g.ok)$('#locations').append(card);
   const row=element('div',undefined,'audit-row');row.append(element('strong',n.title),element('span',g.ok?'メタデータ承認済み / 原本は入域時に検査':g.reason));$('#audit-list').append(row);
  }
  if(!validation.ok){$('#readiness-line').textContent='世界データが不正です。映像の読込を停止しました。';$('#audit-list').textContent=validation.errors.join(', ');}
 }
 function openDetail(id){const n=world.locations.find(x=>x.id===id);if(!n)return;const g=gate(id);$('#detail-title').textContent=n.title;$('#detail-note').textContent=n.note||'';$('#detail-gate').textContent=g.ok?'素材のSHA-256と映像形式を照合してから表示します。':g.reason;$('#detail-source').textContent=g.ok?'承認根拠: '+n.approval.ref:'未取得の景観を生成して代用しません。';$('#enter-place').disabled=!g.ok;$('#enter-place').onclick=()=>{$('#detail').close();enter(id)};$('#detail').showModal();}
 function releaseCurrent(){
  panorama?.dispose();panorama=null;root.querySelectorAll('video,audio').forEach(m=>{m.pause();m.removeAttribute('src');m.load()});root.replaceChildren();hotspots.replaceChildren();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;current=null;
 }
 function persist(){if(!saveVisits)return;try{localStorage.setItem('akashic-world-visits',JSON.stringify(visits));$('#storage-notice').textContent='この端末のブラウザー内に滞在した場所IDだけを保存します。';}catch(_){$('#storage-notice').textContent='保存できません。このタブ内で利用を続けます。';notify('ブラウザー保存は使えません。体験は継続できます。');}}
 function renderHotspots(){hotspots.replaceChildren();if(!current)return;for(const h of current.hotspots){if(h.action==='travel'&&!gate(h.target).ok)continue;
  const b=element('button',h.label,'hotspot');b.dataset.hotspot='true';b.__spot=h;b.addEventListener('click',()=>{if(h.action==='travel')enter(h.target);else{$('#inspect-title').textContent=h.label;$('#inspect-text').textContent=h.text;$('#inspection').showModal()}});hotspots.append(b);
 }}
 function paint(){paintFrame=0;if(!current||disposed)return;const w=root.clientWidth,h=root.clientHeight,img=root.querySelector('img');let rect=null;
  if(img){rect=imageRect(img.naturalWidth,img.naturalHeight,w,h,view);Object.assign(img.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});}
  try{panorama?.render(view,w,h)}catch(_){exit();notify('描画の検査に失敗したため入域前へ戻りました。');return;}
  for(const b of hotspots.children){const s=b.__spot;let p=null;
   if(current.mode==='panorama'&&s.coordinates==='sphere')p=projectSphere(s.yaw,s.pitch,view,w,h);
   else if(rect&&s.coordinates==='image')p={x:rect.x+s.x*rect.w,y:rect.y+s.y*rect.h};
   else if(current.mode==='video'&&s.coordinates==='image'){const v=root.querySelector('video');if(v?.videoWidth){const r=imageRect(v.videoWidth,v.videoHeight,w,h,{});p={x:r.x+s.x*r.w,y:r.y+s.y*r.h};}}
   b.hidden=!p||p.x<22||p.y<22||p.x>w-22||p.y>h-22;if(!b.hidden){b.style.left=p.x+'px';b.style.top=p.y+'px';}
  }
 }
 let commitTimer;function commit(immediate=false){clearTimeout(commitTimer);const emit=()=>{if(!disposed)document.dispatchEvent(new Event('akashic:worldchange'))};if(immediate)emit();else commitTimer=setTimeout(emit,160)}
 function schedulePaint(){if(!paintFrame)paintFrame=requestAnimationFrame(paint);}
 function displayState(){
  stage.classList.toggle('active-view',Boolean(current));
  $('#entry').hidden=Boolean(current);$('#lens').hidden=Boolean(current);$('#cinema-caption').hidden=!current;$('#view-controls').hidden=!current;
  $('#camera-hint').textContent=!current?'画面は入域前のインターフェース':current.mode==='still'?'静止画 / 拡大は歩行ではありません':current.mode==='panorama'?'360° / ドラッグ・矢印キーで見回す':'動画 / 再生は映像内の操作から';
  $('#scene-mode').textContent=current?({'still':'STILL / BOUNDED VIEW','panorama':'360° / VERIFIED CAPTURE','video':'CINEMATIC RECORD'}[current.mode]||'UNAVAILABLE'):'PRE-ENTRY';
  $('#source-line').textContent=current?'原本SHA-256照合済み / '+current.id:'映像未接続 / 正典と異なる景観は表示しない';
  if(current){$('#scene-title').textContent=current.title;$('#scene-subtitle').textContent=current.subtitle||'';$('#scene-description').textContent=current.note||'';}
 }
 async function enter(id){
  if(disposed)return {ok:false,code:'app_disposed'};
  const g=gate(id);if(!g.ok){notify(g.reason);return {ok:false,code:g.code};}
  if(g.asset.width*g.asset.height>24_000_000){notify('この原画像は展開時のメモリー予算を超えます。承認済み軽量版が必要です。');return {ok:false,code:'decoded_pixel_budget'};}
  pending?.abort();const own=++requestNo;pending=new AbortController();const signal=pending.signal;$('#loading').hidden=false;
  let candidateURL=null,candidate=null,nextPano=null;
  try{
   const blob=await loadAsset(g.asset,{signal});if(signal.aborted||own!==requestNo)return {ok:false,code:'cancelled'};
   candidateURL=URL.createObjectURL(blob);
   if(g.location.mode==='video'){
    candidate=document.createElement('video');candidate.controls=true;candidate.preload='metadata';candidate.playsInline=true;candidate.autoplay=false;candidate.setAttribute('aria-label',g.location.title);
    await new Promise((resolve,reject)=>{let done=false;const timeout=setTimeout(()=>finish(Error('video_timeout')),8000);
     function finish(error){if(done)return;done=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);candidate.onloadedmetadata=null;candidate.onerror=null;if(error){candidate.pause();candidate.removeAttribute('src');candidate.load();reject(error)}else resolve();}
     function abort(){finish(new DOMException('Aborted','AbortError'));}
     signal.addEventListener('abort',abort,{once:true});candidate.onloadedmetadata=()=>finish(candidate.videoWidth===g.asset.width&&candidate.videoHeight===g.asset.height?null:Error('asset_dimensions'));candidate.onerror=()=>finish(Error('video_decode'));candidate.src=candidateURL;candidate.load();
    });
    candidate.addEventListener('error',()=>{if(own===requestNo)notify('動画の再生を停止しました。退出して再試行してください。')});
   }else{
    candidate=new Image();candidate.alt=g.location.title;candidate.src=candidateURL;await candidate.decode();
    if(candidate.naturalWidth!==g.asset.width||candidate.naturalHeight!==g.asset.height)throw Error('asset_dimensions');
   }
   if(own!==requestNo||signal.aborted){URL.revokeObjectURL(candidateURL);candidateURL=null;return {ok:false,code:'cancelled'};}
   // Prepare new renderer off-DOM. Keep previous scene intact if preparation fails.
   let nextCanvas=null;
   if(g.location.mode==='panorama'){
    nextCanvas=document.createElement('canvas');nextCanvas.setAttribute('role','img');nextCanvas.setAttribute('aria-label',g.location.title+'の360度表示');try{nextPano=new Panorama(nextCanvas);nextPano.setImage(candidate);nextPano.render(cameraView(g.location.camera),root.clientWidth,root.clientHeight)}catch(e){nextPano?.dispose();throw e;}
    nextCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(root.contains(nextCanvas)){exit();notify('描画コンテキストを失ったため入域前へ戻りました。再入域できます。')}});
   }
   releaseCurrent();objectURL=candidateURL;candidateURL=null;current=g.location;view=cameraView(current.camera);panorama=nextPano;nextPano=null;root.append(nextCanvas||candidate);
   root.classList.toggle('fade',motion);renderHotspots();displayState();paint();
   if(!current || own!==requestNo)return {ok:false,code:'first_frame_failed'};
   visits.last=id;visits.visited=[...new Set([...visits.visited,id])];persist();stage.focus({preventScroll:true});$('#loading').hidden=true;commit(true);return {ok:true,code:'entered'};
  }catch(e){nextPano?.dispose();if(candidate?.tagName==='VIDEO'){candidate.pause();candidate.removeAttribute('src');candidate.load();}if(candidateURL)URL.revokeObjectURL(candidateURL);if(e.name!=='AbortError'&&own===requestNo)notify(e.message==='asset_timeout'?'読込が制限時間を超えました。前の場面を保っています。':e.message==='webgl_unavailable'?'この環境では360°描画を利用できません。平面画像での代用は行いません。':'映像を開けませんでした。原本・ハッシュ・対応形式を確認してください。');return {ok:false,code:e.message||e.name};}
  finally{if(own===requestNo)$('#loading').hidden=true;}
 }
 function exit(){pending?.abort();++requestNo;releaseCurrent();view=cameraView();$('#loading').hidden=true;setClean(false);displayState();commit(true);}
 function adjust(axis,delta){if(!current||current.mode==='video')return;view=cameraView({...view,[axis]:view[axis]+delta});schedulePaint();commit();}
 function turn(x,y){if(current?.mode==='panorama'){adjust('yaw',x*.12);adjust('pitch',y*.10)}else if(current?.mode==='still'){adjust('x',-x*.15);adjust('y',y*.15)}}
 function zoom(d){if(current?.mode==='panorama')adjust('fov',-d*5);else if(current?.mode==='still')adjust('zoom',d*.1);}
 $('#view-left').onclick=()=>turn(-1,0);$('#view-right').onclick=()=>turn(1,0);$('#view-up').onclick=()=>turn(0,1);$('#view-down').onclick=()=>turn(0,-1);$('#zoom-in').onclick=()=>zoom(1);$('#zoom-out').onclick=()=>zoom(-1);$('#view-reset').onclick=()=>{view=cameraView(current?.camera);schedulePaint();commit()};$('#exit-scene').onclick=exit;
 function setClean(on){stage.classList.toggle('clean',on);$('#clean-view').setAttribute('aria-pressed',String(on));$('#restore-hud').hidden=!on;}
 $('#clean-view').onclick=()=>setClean(true);$('#restore-hud').onclick=()=>setClean(false);
 function key(e){if(!current||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='Escape'){setClean(false);return}if(e.target!==stage)return;
  const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(keys[e.key]){e.preventDefault();turn(...keys[e.key])}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1)}else if(e.key==='-'){e.preventDefault();zoom(-1)}
 }
 stage.addEventListener('keydown',key);
 const pointers=new Map();let pinch=null;
 function down(e){if(!current||current.mode==='video'||e.target.closest('button,a,video')||e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.setPointerCapture?.(e.pointerId);stage.focus({preventScroll:true});if(pointers.size===1)drag={x:e.clientX,y:e.clientY,id:e.pointerId};if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y)||1,view:{...view}};drag=null;}}
 function move(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&pinch){const[a,b]=[...pointers.values()];const ratio=Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance;view=cameraView({...pinch.view,zoom:pinch.view.zoom*ratio,fov:pinch.view.fov/Math.max(.01,ratio)});schedulePaint();commit();return;}if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(current?.mode==='panorama'){adjust('yaw',-dx*.003);adjust('pitch',dy*.003)}else{adjust('x',dx*.007);adjust('y',dy*.007)}}
 function up(e){if(e?.pointerId!==undefined)pointers.delete(e.pointerId);else pointers.clear();pinch=null;drag=null;if(pointers.size===1){const[id,p]=[...pointers][0];drag={id,x:p.x,y:p.y};}commit(true);}
 stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);stage.addEventListener('lostpointercapture',up);
 function pauseMedia(){if(document.hidden){root.querySelectorAll('video,audio').forEach(m=>m.pause());up()}}
 document.addEventListener('visibilitychange',pauseMedia);window.addEventListener('blur',up);
 const resize=new ResizeObserver(schedulePaint);resize.observe(stage);
 function updateSettings(){document.body.classList.toggle('no-motion',!motion);$('#motion').setAttribute('aria-pressed',String(motion));$('#motion').textContent=motion?'オン':'停止';$('#save-visits').setAttribute('aria-pressed',String(saveVisits));$('#save-visits').textContent=saveVisits?'オン':'オフ';}
 $('#motion').onclick=()=>{motion=!motion;updateSettings()};function onReduce(e){if(e.matches){motion=false;updateSettings()}}reduce.addEventListener('change',onReduce);
 $('#save-visits').onclick=()=>{saveVisits=!saveVisits;try{localStorage.setItem('akashic-world-save-consent',saveVisits?'on':'off')}catch(_){}updateSettings();if(saveVisits)persist();else $('#storage-notice').textContent='以後はこのタブ内にだけ保存します。以前の記録は削除しません。';};
 $('#export-visits').onclick=()=>{const b=new Blob([JSON.stringify(visits,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=element('a');a.href=u;a.download='zero-ground-visits.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 $('#settings-button').onclick=()=>$('#settings').showModal();$('#readiness').onclick=()=>$('#audit').showModal();all('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
 $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else notify('このブラウザーは全画面表示に対応していません。');}catch(_){notify('全画面表示はこの環境では許可されていません。')}};
 updateSettings();listPlaces();displayState();
 return {enter,exit,openDetail,setView(next){if(!current||current.mode==='video')return false;view=cameraView(next);schedulePaint();return true;},getState:()=>({location:current?.id||null,view:{...view},visits:{...visits,visited:[...visits.visited]},pending:!$('#loading').hidden,validation}),dispose(){disposed=true;exit();clearTimeout(commitTimer);pointers.clear();resize.disconnect();cancelAnimationFrame(paintFrame);clearTimeout(notify.timer);document.removeEventListener('visibilitychange',pauseMedia);window.removeEventListener('blur',up);reduce.removeEventListener('change',onReduce);stage.removeEventListener('keydown',key);stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);stage.removeEventListener('lostpointercapture',up);}};
}
async function boot(){
 try{const r=await fetch(new URL('../experience-base/world/manifest.json',import.meta.url),{credentials:'same-origin'});if(!r.ok)throw Error('manifest_missing');const w=await r.json();window.worldApp=createWorldApp(w); const visitor=await import('./world-visitor.mjs'); window.worldVisitor=visitor.enhanceWorld(w,window.worldApp); const enhanced=await import('./experience.mjs');window.worldExperience=enhanced.installExperience(w,window.worldApp);document.dispatchEvent(new Event('akashic:ready'));}
 catch(_){document.querySelector('#readiness-line').textContent='世界データを取得できません。HTTPサーバーで開くか、同梱の単体プレビューを使用してください。';}
}
boot();
