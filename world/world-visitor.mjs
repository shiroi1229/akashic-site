import {preview} from './preview.mjs';
import {verifiedAsset as verifyDisplayAsset} from '../experience-base/world/loader.mjs';
import {terminalSession} from './session-core.mjs';
import {entryGate, validEvidence} from '../experience-base/world/core.mjs';
import {verifiedAsset} from './asset-loader.mjs';

/** Additional visitor UI. Never modifies approval, location, camera or visit counters. */
export function enhanceWorld(world, app) {
 const $=s=>document.querySelector(s), stage=$('#stage');
 const archive=$('#archive-dialog'), frame=$('#archive-frame'), source=$('#source-dialog');
 let coverURL=null, sourceURL=null, sourceController=null, sourceSeq=0, disposed=false;
 let archiveHash='',archiveSession=null;
 const archiveURL=new URL('./archive.html',import.meta.url);
 const trustedFrame=()=>{try{const u=new URL(frame.contentWindow.location.href);return frame.hasAttribute('src')&&u.origin===archiveURL.origin&&u.pathname===archiveURL.pathname;}catch{return false;}};
 const state={coverVerified:false,coverPreviewVerified:false,sourceAsset:null,sourceError:null,archiveLoads:0,terminalResumed:false};
 const findAsset=id=>world.assets.find(a=>a.id===id);
 const isApproved=a=>a?.sourceVerified===true&&validEvidence(a.approval);
 function returnFocus(){if(app.getState().location)stage.focus({preventScroll:true});}
 const openArchive=()=>{if(disposed)return;archive.showModal();frame.src=new URL('./archive.html'+archiveHash,import.meta.url).href;state.archiveLoads++;};
 const closeArchive=()=>{releaseFrame();archive.close();};
 const releaseFrame=()=>{try{const h=trustedFrame()?frame.contentWindow.location.hash:undefined;if(trustedFrame()){const value=frame.contentWindow.akashicArchiveSession?.snapshot();if(value)archiveSession=terminalSession(value);}if(typeof h==='string'&&h.length<=2048)archiveHash=h;}catch{}frame.removeAttribute('src');returnFocus();};
 const frameLoad=()=>{if(!trustedFrame())return;if(archiveSession){frame.contentWindow.akashicArchiveSession?.restore(archiveSession).then(ok=>{state.terminalResumed=ok}).catch(()=>{state.terminalResumed=false;});}try{frame.contentDocument?.addEventListener('keydown',e=>{if(e.key==='Escape'&&!frame.contentDocument.querySelector('dialog[open]')){e.preventDefault();closeArchive();}});}catch(_) { /* External frame navigation cannot control the parent. */ }};
 $('#archive-open').addEventListener('click',openArchive);
 $('#archive-close').addEventListener('click',closeArchive);
 archive.addEventListener('close',releaseFrame);archive.addEventListener('cancel',releaseFrame);frame.addEventListener('load',frameLoad);
 async function loadSource(id){
  const asset=findAsset(id);if(disposed||!source.open||!isApproved(asset))return {ok:false,code:'source_unapproved'};
  sourceController?.abort();sourceController=new AbortController();const signal=sourceController.signal,seq=++sourceSeq;
  $('#source-status').textContent='原画像のSHA-256を照合しています…';state.sourceError=null;let url=null;
  try{
   const blob=await verifiedAsset(asset,{signal});url=URL.createObjectURL(blob);
   const image=new Image();image.alt=id==='zerochi-overhead'?'ゼロ地の現行正典・真上 C-002':'ゼロ地の現行正典・外観 C-001';image.src=url;await image.decode();
   if(signal.aborted||seq!==sourceSeq||!source.open){URL.revokeObjectURL(url);return {ok:false,code:'cancelled'};}
   if(image.naturalWidth!==asset.width||image.naturalHeight!==asset.height)throw Error('asset_dimensions');
   $('#source-image').replaceChildren(image);if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=url;url=null;state.sourceAsset=id;
   document.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===id)));
   $('#source-status').textContent=`原本一致 / ${asset.width} × ${asset.height} / SHA-256 ${asset.sha256}`;
   return {ok:true,id};
  }catch(e){if(url)URL.revokeObjectURL(url);if(seq===sourceSeq&&source.open&&e.name!=='AbortError'){state.sourceError=e.message;$('#source-status').textContent='原本照合に失敗しました。未検証の画像は表示しません。';}return {ok:false,code:e.message};}
 }
 const openSource=()=>{if(disposed)return;source.showModal();loadSource('zerochi-exterior');};
 const closeSource=()=>source.close();
 const releaseSource=()=>{sourceController?.abort();sourceSeq++;if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=null;$('#source-image').replaceChildren();state.sourceAsset=null;returnFocus();};
 $('#source-open').addEventListener('click',openSource);$('#source-close').addEventListener('click',closeSource);source.addEventListener('close',releaseSource);
 const sourceClicks=[];document.querySelectorAll('[data-source]').forEach(b=>{const fn=()=>loadSource(b.dataset.source);b.addEventListener('click',fn);sourceClicks.push([b,fn]);});
 const togglePoints=()=>{const on=!stage.classList.contains('show-points');stage.classList.toggle('show-points',on);$('#toggle-points').setAttribute('aria-pressed',String(on));$('#toggle-points').textContent=on?'観察点を隠す':'観察点を表示';};
 $('#toggle-points').addEventListener('click',togglePoints);
 const quickVisit=async()=>{const result=await app.enter('shell-exterior');if(result.ok)stage.scrollIntoView({block:'start',behavior:'instant'});};
 $('#visit-exterior').addEventListener('click',quickVisit);
 const coverController=new AbortController();
 const coverReady=(async()=>{
  const gate=entryGate(world,'shell-exterior');if(!gate.ok||gate.asset.sha256!==preview.sourceSha256){$('#entry-poster').replaceChildren();stage.classList.remove('poster-ready');return {ok:false,code:'preview_source_mismatch'};}
  try{
   await verifyDisplayAsset(preview,{signal:coverController.signal,maxBytes:500000,fetcher:(path,init)=>fetch(new URL(path,import.meta.url),{...init,cache:'force-cache'})});
   if(disposed||coverController.signal.aborted)return {ok:false,code:'cancelled'};
   const im=$('#entry-poster img');if(!im)throw Error('preview_missing');await im.decode();
   if(im.naturalWidth!==preview.width||im.naturalHeight!==preview.height)throw Error('preview_dimensions');
   stage.classList.add('poster-ready');state.coverPreviewVerified=true;return {ok:true,scope:'derived_entry_preview'};
  }catch(e){$('#entry-poster').replaceChildren();stage.classList.remove('poster-ready');return {ok:false,code:e.message};}
 })();
 function hide(){if(document.hidden&&archive.open)archive.close();}
 document.addEventListener('visibilitychange',hide);
 return {coverReady,loadSource,getState:()=>({...state}),dispose(){disposed=true;coverController.abort();if(archive.open)archive.close();if(source.open)source.close();releaseSource();if(coverURL)URL.revokeObjectURL(coverURL);$('#entry-poster').replaceChildren();frame.removeAttribute('src');document.removeEventListener('visibilitychange',hide);$('#archive-open').removeEventListener('click',openArchive);$('#archive-close').removeEventListener('click',closeArchive);archive.removeEventListener('close',releaseFrame);archive.removeEventListener('cancel',releaseFrame);frame.removeEventListener('load',frameLoad);$('#source-open').removeEventListener('click',openSource);$('#source-close').removeEventListener('click',closeSource);source.removeEventListener('close',releaseSource);sourceClicks.forEach(([b,fn])=>b.removeEventListener('click',fn));$('#toggle-points').removeEventListener('click',togglePoints);$('#visit-exterior').removeEventListener('click',quickVisit);}};
}
