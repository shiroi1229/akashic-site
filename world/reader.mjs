const ID=/^ep01-ch[1-6](?:-gaiden)?$/;
const KEY='akashic-reader-position-v1';
export function readingMark(value){if(!value||value.schema!==1||!ID.test(value.id)||!Number.isFinite(value.ratio)||value.ratio<0||value.ratio>1||!Number.isInteger(value.font)||value.font<16||value.font>26)throw Error('invalid_reading_mark');return {schema:1,id:value.id,ratio:value.ratio,font:value.font};}
export function readerSource(record){if(record?.kind!=='text'||!ID.test(record.id))throw Error('invalid_reading_record');const claimed=new URL(record.url);if(claimed.origin!=='https://shiroi1229.github.io'||claimed.pathname!==`/akashic-site/novel/${record.id}.html`||claimed.search||claimed.hash)throw Error('invalid_reading_source');return new URL(`../novel/${record.id}.html`,import.meta.url);}
/** Inert text extraction: never mount fetched scripts, attributes, or HTML. */
export function extractReadingDocument(html,Parser=globalThis.DOMParser){if(typeof html!=='string'||html.length>2_000_000)throw Error('reading_size');const doc=new Parser().parseFromString(html,'text/html'),article=doc.querySelector('article.read');if(!article)throw Error('reading_missing_article');const blocks=[...article.children].filter(n=>['P','H2','H3','H4','BLOCKQUOTE'].includes(n.tagName)).map(n=>({tag:n.tagName.toLowerCase(),text:n.textContent,speech:n.classList.contains('say')}));if(!blocks.length||blocks.length>20000)throw Error('reading_empty');return {title:doc.querySelector('h1')?.textContent?.trim()||'',blocks};}
export function createReader(){
 const $=s=>document.querySelector(s),dialog=$('#reader'),scroll=$('#reader-scroll'),content=$('#reader-content'),status=$('#reader-status'),sections=$('#reader-section');
 let current=null,controller=null,request=0,font=18,paint=0,lastRatio=0;const memory=new Map(),cache=new Map();
 // Closing a native dialog removes its layout box. Keep the last visible ratio.
 const ratio=()=>{if(!dialog.open||scroll.clientHeight===0)return lastRatio;lastRatio=Math.max(0,Math.min(1,scroll.scrollTop/Math.max(1,scroll.scrollHeight-scroll.clientHeight)));return lastRatio;};
 function remember(){if(current&&content.children.length)memory.set(current.id,{schema:1,id:current.id,ratio:ratio(),font});}
 function progress(){paint=0;$('#reader-progress').value=Math.round(ratio()*100);}
 const queueProgress=()=>{if(!paint)paint=requestAnimationFrame(progress);};
 function fontSize(value){font=Math.max(16,Math.min(26,value));content.style.setProperty('--reader-font',font+'px');$('#reader-smaller').disabled=font===16;$('#reader-larger').disabled=font===26;queueProgress();}
 function saved(id){if(memory.has(id))return memory.get(id);try{const raw=localStorage.getItem(KEY)||'{}';if(raw.length>16384)return null;const all=JSON.parse(raw);if(Object.hasOwn(all,id))return readingMark(all[id]);}catch{}return null;}
 async function open(record){
  let url;try{url=readerSource(record);}catch{return false;}remember();controller?.abort();controller=new AbortController();const localController=controller,signal=controller.signal,own=++request;current=record;
  if(!dialog.open)dialog.showModal();$('#reader-title').textContent=record.title;status.textContent='原本の本文を読み込んでいます…';content.replaceChildren();sections.replaceChildren();$('#reader-save').disabled=true;const timer=setTimeout(()=>localController.abort(),12000);
  try{
   let data=cache.get(record.id);if(!data){const response=await fetch(url,{signal,cache:'no-cache',redirect:'error',credentials:'same-origin'});if(!response.ok)throw Error('HTTP '+response.status);if(Number(response.headers.get('content-length'))>2_000_000)throw Error('reading_size');data=extractReadingDocument(await response.text());if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(record.id,data);}
   if(own!==request||signal.aborted||!dialog.open)return false;
   const fragment=document.createDocumentFragment();let section=0;
   for(const block of data.blocks){const n=document.createElement(block.tag);n.textContent=block.text;if(block.speech)n.className='speech';if(block.tag.startsWith('h')){n.id='reader-heading-'+section++;const opt=document.createElement('option');opt.value=n.id;opt.textContent=block.text;sections.append(opt);}fragment.append(n);}
   content.replaceChildren(fragment);sections.disabled=section===0;const mark=saved(record.id);fontSize(mark?.font||18);$('#reader-save').disabled=false;
   requestAnimationFrame(()=>{if(own!==request||!dialog.open)return;scroll.scrollTo({top:(mark?.ratio||0)*Math.max(0,scroll.scrollHeight-scroll.clientHeight),behavior:'instant'});progress();scroll.focus({preventScroll:true});});
   status.textContent=mark?'記録した位置から。本文は公開原本のままです。':'本文は公開原本のままです。「読書位置を記録」を押すと、このブラウザーに位置を保存します。';return true;
  }catch(error){if(own===request&&dialog.open)status.textContent='本文を読み込めませんでした。記録画面の「原本をひらく」から読むか、もう一度試してください。';return false;}
  finally{clearTimeout(timer);}
 }
 $('#reader-close').addEventListener('click',()=>{remember();dialog.close();});dialog.addEventListener('cancel',remember);dialog.addEventListener('close',()=>{remember();++request;controller?.abort();cancelAnimationFrame(paint);paint=0;});
 $('#reader-smaller').addEventListener('click',()=>fontSize(font-2));$('#reader-larger').addEventListener('click',()=>fontSize(font+2));scroll.addEventListener('scroll',queueProgress,{passive:true});
 sections.addEventListener('change',()=>{const target=document.getElementById(sections.value);if(target&&content.contains(target))target.scrollIntoView({block:'start',behavior:'instant'});});
 $('#reader-save').addEventListener('click',()=>{if(!current||!content.children.length)return;const mark=readingMark({schema:1,id:current.id,ratio:ratio(),font});memory.set(current.id,mark);try{const all=Object.create(null);try{const raw=localStorage.getItem(KEY)||'{}';const previous=raw.length<=16384?JSON.parse(raw):{};for(const [id,v] of Object.entries(previous).slice(0,7)){try{const valid=readingMark(v);if(valid.id===id)all[id]=valid;}catch{}}}catch{}all[mark.id]=mark;localStorage.setItem(KEY,JSON.stringify(all));status.textContent='このブラウザーに読書位置を記録しました。次にこの章を開くと復帰します。';}catch{status.textContent='この環境では保存できません。このタブ内で位置を保持します。';}});
 return {open,close(){if(dialog.open){remember();dialog.close();}},getState:()=>({record:current?.id||null,open:dialog.open,font,ratio:ratio(),blocks:content.children.length}),dispose(){remember();++request;controller?.abort();cancelAnimationFrame(paint);if(dialog.open)dialog.close();cache.clear();}};
}
