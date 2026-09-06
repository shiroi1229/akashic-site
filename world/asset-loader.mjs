import {verifiedAsset as verify} from '../experience-base/world/loader.mjs';
export const WORLD_BASE=new URL('../experience-base/world/',import.meta.url);
export const MANIFEST_URL=new URL('manifest.json',WORLD_BASE);
/** Resolve approved relative asset paths without a document-wide <base>. */
export function verifiedAsset(asset,options={}){
 const upstream=options.fetcher||globalThis.fetch;
 return verify(asset,{...options,fetcher:(path,init)=>upstream(new URL(path,WORLD_BASE),init)});
}
