/** Preserve view/search fragments during in-document navigation. */
document.addEventListener('click',event=>{
 const a=event.target.closest?.('a[href^="#"]');
 if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 const id=a.getAttribute('href').slice(1),target=document.getElementById(id);if(!target)return;
 event.preventDefault();
 target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
 if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
});
