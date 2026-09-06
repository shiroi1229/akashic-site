let apiPromise=null;
function youtubeAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
  const previous=window.onYouTubeIframeAPIReady;let settled=false;
  const timer=setTimeout(()=>finish(Error('youtube_timeout')),15000);
  function finish(error){if(settled)return;settled=true;clearTimeout(timer);if(error){script.remove();apiPromise=null;reject(error);}else resolve(window.YT);}
  window.onYouTubeIframeAPIReady=()=>{if(typeof previous==='function')previous();finish();};script.onerror=()=>finish(Error('youtube_unavailable'));document.head.append(script);
 });return apiPromise;
}
export function createRecordPlayer(host,status){
 let player=null,generation=0,timer=0,state='idle',videoId=null;
 function show(next,text){state=next;host.dataset.state=next;status.textContent=text;host.dispatchEvent(new Event('akashic:mediachange'));}
 function close(){generation++;clearTimeout(timer);try{player?.destroy();}catch{}player=null;host.replaceChildren();show('idle','');videoId=null;}
 async function connect(record){
  close();if(record?.kind!=='video'||!/^[a-zA-Z0-9_-]{11}$/.test(record.videoId))return false;const own=generation;videoId=record.videoId;
  show('connecting','YouTubeに接続しています…');
  try{
   const YT=await youtubeAPI();if(own!==generation)return false;const mount=document.createElement('div');host.append(mount);
   timer=setTimeout(()=>{if(own===generation&&state==='connecting')show('unavailable','接続を完了できませんでした。記録の原本リンクからYouTubeで視聴できます。');},18000);
   player=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',width:'100%',height:'360',videoId:record.videoId,playerVars:{playsinline:1,rel:0,origin:location.origin,autoplay:0},events:{
    onReady(event){if(own!==generation){event.target.destroy();return;}clearTimeout(timer);const f=event.target.getIframe();f.title=record.title;f.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');f.referrerPolicy='strict-origin-when-cross-origin';show('ready','接続できました。プレーヤーの再生ボタンを押してください。');},
    onStateChange(event){if(own!==generation)return;if(event.data===1)show('playing','再生中');else if(event.data===2)show('paused','一時停止');else if(event.data===0)show('ended','再生が終了しました。');},
    onError(event){if(own!==generation)return;clearTimeout(timer);show('unavailable',`この環境では埋込再生できません（${event.data}）。記録の原本リンクからYouTubeで視聴できます。`);},
    onAutoplayBlocked(){if(own===generation)show('ready','プレーヤーの再生ボタンを押してください。');}
   }});return true;
  }catch{if(own===generation)show('unavailable','YouTubeへ接続できませんでした。記録の原本リンクから視聴できます。');return false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)try{player?.pauseVideo();}catch{}});
 return {connect,close,getState:()=>({state,videoId,currentTime:player?.getCurrentTime?.()||0}),pause(){try{player?.pauseVideo();}catch{}},play(){try{player?.playVideo();}catch{}}};
}
