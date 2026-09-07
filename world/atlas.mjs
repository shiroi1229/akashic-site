import {introductoryRecords,focusNeighbor} from './journey-core.mjs';
const root=document.querySelector('#record-atlas');
if(root){
 const raw=document.querySelector('#intro-catalog');let records=[];try{records=introductoryRecords(JSON.parse(raw.textContent));}catch{}
 const nodes=[...root.querySelectorAll('[data-atlas-record]')],panel=root.querySelector('#atlas-panel'),link=root.querySelector('#atlas-open'),read=root.querySelector('#atlas-read'),message=root.querySelector('#atlas-status');let active=null,opening=false;
 const kindNames={video:'映像の記録',text:'文字の記録',audio:'音声の記録'};
 function select(id){const r=records.find(x=>x.id===id);if(!r)return false;active=r;panel.querySelector('h3').textContent=r.title;panel.querySelector('.atlas-kind').textContent=kindNames[r.kind];panel.querySelector('.atlas-description').textContent=r.description||'公開原本をそのまま読む。文字の大きさや読書位置は、あなたのペースに合わせて。';for(const n of nodes){const chosen=n.dataset.atlasRecord===id;n.setAttribute('aria-selected',String(chosen));n.tabIndex=chosen?0:-1;}for(const line of root.querySelectorAll('[data-atlas-edge]'))line.classList.toggle('selected',line.dataset.atlasEdge===id);link.href=new URL('./archive.html#record='+encodeURIComponent(id),import.meta.url).href;read.hidden=r.kind!=='text';panel.setAttribute('aria-labelledby',nodes.find(n=>n.dataset.atlasRecord===id)?.id||'atlas-title');return true;}
 for(const [i,n] of nodes.entries()){
  n.addEventListener('click',()=>select(n.dataset.atlasRecord));
  n.addEventListener('keydown',e=>{const j=focusNeighbor(i,e.key,nodes.length);if(j!==null){e.preventDefault();nodes[j].focus();}});
 }
 async function enter(event,mode){
  if(!active||!window.worldVisitor?.openRecord)return;if(event&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0))return;event?.preventDefault();if(opening)return;opening=true;message.textContent='記録端末へ接続しています…';link.setAttribute('aria-disabled','true');read.disabled=true;
  try{const ok=await worldVisitor.openRecord(active.id,{read:mode==='read'});message.textContent=ok?'':'接続できませんでした。記録のリンクを新しいタブで開いて再試行できます。';}catch{message.textContent='接続できませんでした。少し待って再試行してください。';}finally{opening=false;link.removeAttribute('aria-disabled');read.disabled=false;}
 }
 link.addEventListener('click',e=>enter(e,'inspect'));read.addEventListener('click',e=>enter(e,'read'));if(records.length)select(records[0].id);
 window.akashicAtlas={select,getState:()=>({selected:active?.id||null,count:records.length,opening})};
}
