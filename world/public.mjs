document.body.dataset.release='1.0.0';
document.querySelectorAll('[data-terminal]').forEach(button=>button.addEventListener('click',()=>document.querySelector('#archive-open')?.click()));
// Preserve an existing bookmarked entrance without fabricating camera movement.
function legacyAnchor(){if(location.hash==='#records'&&window.worldVisitor&&!document.querySelector('#archive-dialog')?.open)document.querySelector('#archive-open')?.click();}
if(document.readyState==='complete')legacyAnchor();else addEventListener('load',legacyAnchor,{once:true});
addEventListener('hashchange',legacyAnchor);
// Local, bounded diagnostic values. Nothing is sent to any analytics endpoint.
const timings={lcpMs:null,cls:0,maxEventDurationMs:0};window.akashicPerformance=timings;
for(const type of ['largest-contentful-paint','layout-shift','event'])try{const observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')timings.lcpMs=e.startTime;else if(type==='layout-shift'&&!e.hadRecentInput)timings.cls+=e.value;else if(type==='event'&&e.interactionId)timings.maxEventDurationMs=Math.max(timings.maxEventDurationMs,e.duration);}});observer.observe({type,buffered:true,...(type==='event'?{durationThreshold:40}:{})});addEventListener('pagehide',()=>observer.disconnect(),{once:true});}catch{}

document.addEventListener('akashic:ready',legacyAnchor);
