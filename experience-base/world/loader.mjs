import {safeAssetPath} from './core.mjs';
/** Verify bytes before decode. A hash proves identity, never visual/canon approval. */
export async function verifiedAsset(a,{
 signal,fetcher=fetch,hasher=globalThis.crypto?.subtle,
 maxBytes=64*1024*1024,maxPixels=24_000_000,timeoutMs=15000
}={}){
 if(!a || !safeAssetPath(a.path) || !Number.isSafeInteger(a.bytes) || a.bytes<1 || a.bytes>maxBytes || !/^[a-f0-9]{64}$/.test(a.sha256||''))throw Error('asset_blocked');
 if(['still','panorama','video'].includes(a.kind) && (!Number.isSafeInteger(a.width)||!Number.isSafeInteger(a.height)||a.width<1||a.height<1||a.width*a.height>maxPixels))throw Error('decoded_pixel_budget');
 if(!hasher)throw Error('secure_context_required');
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw Error('invalid_timeout');
 const controller=new AbortController();let timedOut=false,reader=null;
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 const throwAborted=()=>{if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');};
 try{
  throwAborted();
  const r=await fetcher(a.path,{signal:controller.signal,credentials:'same-origin',cache:'no-cache',redirect:'error'});
  throwAborted();if(!r.ok)throw Error(`asset_http_${r.status}`);
  if(r.redirected)throw Error('asset_redirect');
  const length=r.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>a.bytes||Number(length)>maxBytes))throw Error('asset_size');
  let buf;
  if(r.body?.getReader){
   reader=r.body.getReader();const parts=[];let size=0;
   const cancelRead=()=>{reader?.cancel().catch(()=>{});};controller.signal.addEventListener('abort',cancelRead,{once:true});
   try{
    for(;;){throwAborted();const {done,value}=await reader.read();throwAborted();if(done)break;
     size+=value.byteLength;if(size>a.bytes||size>maxBytes)throw Error('asset_size');parts.push(value);
    }
    buf=new Uint8Array(size);let offset=0;for(const p of parts){buf.set(p,offset);offset+=p.length;}
   }catch(e){await reader.cancel().catch(()=>{});throw e;}
   finally{controller.signal.removeEventListener('abort',cancelRead);reader.releaseLock();reader=null;}
  }else buf=new Uint8Array(await r.arrayBuffer());
  throwAborted();if(buf.length!==a.bytes||buf.length>maxBytes)throw Error('asset_size');
  const digest=new Uint8Array(await hasher.digest('SHA-256',buf));throwAborted();
  const hex=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');if(hex!==a.sha256)throw Error('asset_hash');
  return new Blob([buf],{type:typeof a.mime==='string'?a.mime:'application/octet-stream'});
 }catch(e){if(timedOut)throw Error('asset_timeout');throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
