// Private 1.1 experience refinement. Existing canonical gates and app APIs remain authoritative.
const root=document.documentElement,life=new AbortController(),signal=life.signal;
const menu=document.querySelector('#experience-menu'),open=document.querySelector('#menu-open'),close=document.querySelector('#menu-close');
if(menu&&open&&close){
 open.addEventListener('click',()=>{if(!menu.open){menu.showModal();open.setAttribute('aria-expanded','true');}},{signal});
 close.addEventListener('click',()=>menu.close(),{signal});
 menu.addEventListener('close',()=>{open.setAttribute('aria-expanded','false');open.focus({preventScroll:true});},{signal});
 // Close this menu before the original handler opens its dialog. No nested modal stacks.
 menu.addEventListener('click',event=>{if(event.target.closest('.menu-links>button'))menu.close();},{capture:true,signal});
 menu.addEventListener('click',event=>{if(event.target!==menu)return;const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();},{signal});
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{
  queueMicrotask(()=>{if(document.querySelector('dialog[open]'))return;const current=document.activeElement;if(!current||current===document.body||!current.getClientRects().length)open.focus({preventScroll:true});});
 },{signal});
}
let installed=false,observer;
function install(){if(installed||!window.worldExperience)return;installed=true;
 const app=window.worldApp,stage=document.querySelector('#stage');
 if(app?.getState().validation.ok)root.classList.add('experience-ready');
 for(const id of ['command-open','checkpoint-open']){const button=document.getElementById(id);if(button)document.querySelector('#menu-extra')?.append(button);}
 function update(){root.dataset.observing=String(!!app?.getState().location);root.dataset.clean=String(stage?.classList.contains('clean'));}
 document.addEventListener('akashic:worldchange',update,{signal});observer=new MutationObserver(update);observer.observe(stage,{attributes:true,attributeFilter:['class']});update();
}
if(window.worldExperience)install();else document.addEventListener('akashic:ready',install,{once:true,signal});
addEventListener('pagehide',()=>{observer?.disconnect();life.abort();},{once:true});
