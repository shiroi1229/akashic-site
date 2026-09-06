import {snapshot,Timeline,SCHEMA,validateCheckpoints,viewHash,readViewHash} from './interaction-core.mjs';
/** Optional interaction layer. Canon is checked by the immutable core at every restoration. */
export function installExperience(world,app){
 const $=s=>document.querySelector(s),life=new AbortController(),signal=life.signal;
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const timeline=new Timeline(64);let points=[],applying=false,disposed=false;const key='akashic-checkpoints-v1';
 const metrics={lcpMs:null,cls:0,eventLatencyMaxMs:null,kind:'current-tab-observation-not-field-INP'};const observers=[];
 for(const type of ['largest-contentful-paint','layout-shift','event'])try{
  if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;const o=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')metrics.lcpMs=e.renderTime||e.loadTime;if(type==='layout-shift'&&!e.hadRecentInput)metrics.cls+=e.value;if(type==='event'&&e.interactionId)metrics.eventLatencyMaxMs=Math.max(metrics.eventLatencyMaxMs||0,e.duration);}});o.observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});observers.push(o);
 }catch{}
 const bar=make('div');bar.className='interaction-bar';bar.setAttribute('aria-label','世界と記録の統合操作');
 const addButton=(parent,text,fn,id)=>{const b=make('button',text);b.type='button';if(id)b.id=id;b.addEventListener('click',fn,{signal});parent.append(b);return b;};
 const makeDialog=(id,title)=>{const d=make('dialog');d.id=id;d.className='command-dialog';const head=make('div');head.className='dialog-head';const h=make('h2',title);h.id=id+'-title';d.setAttribute('aria-labelledby',h.id);head.append(h);addButton(head,'閉じる',()=>d.close()).setAttribute('aria-label',title+'を閉じる');d.append(head);const body=make('div');body.className='dialog-body';d.append(body);document.body.append(d);return {d,body};};
 const palette=makeDialog('command-palette','接続コマンド');const input=make('input');input.type='search';input.placeholder='探索・記録・視点を検索';input.setAttribute('aria-label','実行する操作を検索');palette.body.append(input);const results=make('div');results.className='command-results';palette.body.append(results);
 const journal=makeDialog('checkpoint-dialog','観察のチェックポイント');const controls=make('div');controls.className='checkpoint-tools';journal.body.append(controls);const nameInput=make('input');nameInput.type='text';nameInput.maxLength=80;nameInput.placeholder='観察の名前';nameInput.setAttribute('aria-label','新しいチェックポイントの名前');controls.append(nameInput);addButton(controls,'この名前で記録',()=>savePoint(nameInput.value),'checkpoint-named-save');const savedList=make('div');journal.body.append(savedList);const msg=make('p');msg.className='experience-message';msg.setAttribute('role','status');journal.body.append(msg);const note=make('p','原画像の視点を記録します。新しい場所・移動経路・正典を作る操作ではありません。保存は体験設定の同意に従い、外部送信しません。');note.className='experience-note';journal.body.append(note);
 const diagnostic=makeDialog('diagnostics-dialog','このタブの計測');const diagnosticText=make('pre');diagnosticText.style.whiteSpace='pre-wrap';diagnostic.body.append(diagnosticText);diagnostic.body.append(make('p','現在のタブの参考計測です。実利用者の75パーセンタイル、正式INP、公開品質合格、実機性能を意味しません。'));
 const status=make('small','視点と記録を、同じ世界のままで。');status.setAttribute('role','status');
 function notify(text){status.textContent=text;msg.textContent=text;}
 function consent(){return $('#save-visits')?.getAttribute('aria-pressed')==='true';}
 function persist(){if(!consent())return;try{localStorage.setItem(key,JSON.stringify({schema:SCHEMA,points}));}catch{notify('このタブ内では使えます。端末保存はできないため書き出しを利用してください。');}}
 try{if(consent()){const s=localStorage.getItem(key);if(s&&s.length<=131072)points=validateCheckpoints(JSON.parse(s),world);}}catch{points=[];}
 function capture(){if(disposed||applying||app.getState().pending)return;try{timeline.push(snapshot(app.getState(),world));updateControls();}catch{}}
 async function apply(value){if(applying||disposed)return false;let s;try{s=snapshot(value,world);}catch{notify('承認された場所の視点ではないため復帰できません。');return false;}applying=true;try{
  if(s.location===null)app.exit();else{if(app.getState().location!==s.location){const r=await app.enter(s.location);if(!r.ok)throw Error('entry_failed');}if(!app.setView(s.view))throw Error('view_failed');}
  notify('照合した場所と視点に復帰しました。');return true;
 }catch{notify('復帰できませんでした。原本と入域ゲートを確認してください。');return false;}finally{applying=false;updateControls();}}
 async function historyStep(direction){if(applying)return;capture();const old=timeline.cursor;const s=direction==='undo'?timeline.undo():timeline.redo();if(s&&!(await apply(s)))timeline.cursor=old;updateControls();}
 function savePoint(label){if(app.getState().pending){notify('原本の読込が終わってから視点を記録してください。');return;}const s=snapshot(app.getState(),world);if(!s.location){notify('外殻に入域してから視点を記録してください。');return;}if(points.length>=40){notify('チェックポイントは40件までです。書き出して保管してください。');return;}
  const supplied=typeof label==='string'?label.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,80):'';const name=supplied||(world.locations.find(n=>n.id===s.location)?.title||'観察')+' / '+String(points.length+1).padStart(2,'0');points.push({...s,name});persist();renderPoints();notify('チェックポイント '+points.length+' を記録しました。'+(consent()?'この端末に保存。':'このタブ内のみ。'));}
 function renderPoints(){savedList.replaceChildren();if(!points.length)savedList.append(make('p','まだチェックポイントはありません。'));points.forEach((p,i)=>{const row=make('div');row.className='checkpoint-row';addButton(row,p.name+' / 拡大 '+p.view.zoom.toFixed(2),async()=>{journal.d.close();if(await apply(p))capture();},'checkpoint-'+i);savedList.append(row);});}
 const openJournal=()=>{renderPoints();if(!journal.d.open)journal.d.showModal();};
 async function share(){try{const hash=viewHash(app.getState(),world);if(!hash){notify('先に訪問先へ入域してください。');return;}const url=new URL(location.href);url.hash=hash;try{history.replaceState(null,'',url);}catch{}await navigator.clipboard.writeText(url.href);notify('この場所と視点のリンクをコピーしました。');}catch{notify('リンクのコピーは許可されていません。アドレス欄のリンクを利用してください。');}}
 function showDiagnostics(){diagnosticText.textContent=JSON.stringify({...metrics,secureContext:globalThis.isSecureContext===true,webGPUExposed:Boolean(navigator.gpu),note:'WebGPUの有無は描画成功・性能測定とは別'},null,2);diagnostic.d.showModal();}
 const commands=[
  {name:'外殻を訪れる',keywords:'visit world 世界 入域',run:async()=>{const r=await app.enter('shell-exterior');if(r.ok)capture();}},
  {name:'アカシック接続端末を開く',keywords:'archive terminal 検索 プレクサス 動画 小説',run:()=>$('#archive-open').click()},
  {name:'正典の外観・真上資料を開く',keywords:'source canon 資料 図面',run:()=>$('#source-open').click()},
  {name:'現在の視点を記録する',keywords:'save bookmark checkpoint 保存',run:savePoint},
  {name:'チェックポイントから復帰する',keywords:'restore 記録 保存 戻る',run:openJournal},
  {name:'ひとつ前の視点へ戻す',keywords:'undo',run:()=>historyStep('undo')},
  {name:'視点操作をやり直す',keywords:'redo',run:()=>historyStep('redo')},
  {name:'この場所と視点へのリンク',keywords:'share url 共有',run:share},
  {name:'このタブの性能計測を見る',keywords:'performance 診断 計測 応答',run:showDiagnostics},
  {name:'体験設定を開く',keywords:'settings 動き 保存 同意',run:()=>$('#settings-button').click()}
 ];
 async function execute(c){palette.d.close();try{await c.run();capture();}catch{notify('操作を完了できませんでした。現在の世界は維持します。');}}
 function renderCommands(){const q=input.value.slice(0,100).normalize('NFKC').toLowerCase();results.replaceChildren();for(const c of commands.filter(c=>(c.name+' '+c.keywords).normalize('NFKC').toLowerCase().includes(q)))addButton(results,c.name,()=>execute(c));if(!results.children.length)results.append(make('p','一致する操作はありません。'));}
 function openPalette(){if(document.querySelector('dialog[open]'))return;input.value='';renderCommands();palette.d.showModal();input.focus();}
 input.addEventListener('input',renderCommands,{signal});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Enter'){e.preventDefault();results.querySelector('button')?.click();}},{signal});
 palette.d.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key)||e.target===input)return;const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(i>=0){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}},{signal});
 for(const {d} of [palette,journal,diagnostic])d.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=[...d.querySelectorAll('button,input,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length);if(!f.length)return;if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}},{signal});
 const opener=addButton(bar,'コマンド ⌘K',openPalette,'command-open');addButton(bar,'視点を記録',savePoint,'checkpoint-save');addButton(bar,'記録から戻る',openJournal,'checkpoint-open');
 const undo=addButton(bar,'戻す',()=>historyStep('undo'),'view-undo'),redo=addButton(bar,'やり直す',()=>historyStep('redo'),'view-redo');bar.append(status);$('.status-bar').after(bar);
 function updateControls(){undo.disabled=!timeline.canUndo||applying;redo.disabled=!timeline.canRedo||applying;}
 addButton(controls,'JSONを書き出す',()=>{const b=new Blob([JSON.stringify({schema:SCHEMA,points},null,2)],{type:'application/json'});const url=URL.createObjectURL(b),a=make('a');a.href=url;a.download='akashic-checkpoints.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const imp=make('input');imp.type='file';imp.accept='.json,application/json';imp.setAttribute('aria-label','チェックポイントJSONを取り込む');controls.append(imp);
 imp.addEventListener('change',async()=>{const f=imp.files?.[0];if(!f)return;try{if(f.size>131072)throw Error('file_size');const incoming=validateCheckpoints(JSON.parse(await f.text()),world);const seen=new Set(points.map(p=>JSON.stringify(p)));const additions=incoming.filter(p=>{const k=JSON.stringify(p);if(seen.has(k))return false;seen.add(k);return true;});if(points.length+additions.length>40)throw Error('limit');points.push(...additions);persist();renderPoints();notify(additions.length+'件のチェックポイントを取り込みました。');}catch{notify('取り込めません。形式・承認地点・40件上限を確認してください。既存の記録は変更していません。');}finally{imp.value='';}},{signal});
 document.addEventListener('keydown',e=>{const editable=e.target.closest('input,textarea,select,[contenteditable=true]');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){if(!document.querySelector('dialog[open]')){e.preventDefault();openPalette();}}else if(!editable&&!document.querySelector('dialog[open]')&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();historyStep(e.shiftKey?'redo':'undo');}},{signal});
 document.addEventListener('akashic:worldchange',capture,{signal});$('#save-visits').addEventListener('click',()=>{if(consent())persist();},{signal});
 async function restoreLink(){try{const s=readViewHash(location.hash,world);if(s&&await apply(s))capture();}catch{notify('視点リンクを検証できません。未承認の場所は開きません。');}}
 window.addEventListener('hashchange',restoreLink,{signal});capture();restoreLink();
 return {getState:()=>({points:points.map(p=>JSON.parse(JSON.stringify(p))),history:{size:timeline.items.length,cursor:timeline.cursor},metrics:{...metrics},applying,disposed}),savePoint,apply,capture,openPalette,dispose(){disposed=true;life.abort();observers.forEach(o=>o.disconnect());bar.remove();[palette,journal,diagnostic].forEach(x=>x.d.remove());}};
}
