import {cameraView, entryGate} from '../experience-base/world/core.mjs';
export const SCHEMA='akashic-checkpoints/v1';
const copy=x=>JSON.parse(JSON.stringify(x));
export function snapshot(value,world){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('snapshot_invalid');
 if(value.location===null)return {location:null,view:cameraView()};
 if(typeof value.location!=='string'||!entryGate(world,value.location).ok)throw Error('location_not_admitted');
 if(!value.view||typeof value.view!=='object')throw Error('view_invalid');
 for(const k of ['zoom','x','y','yaw','pitch','fov'])if(k in value.view&&!Number.isFinite(value.view[k]))throw Error('view_nonfinite');
 return {location:value.location,view:cameraView(value.view)};
}
export class Timeline{
 constructor(limit=64){this.limit=Math.max(2,Math.min(128,Math.floor(limit)||64));this.items=[];this.cursor=-1;}
 push(value){const v=copy(value);if(this.cursor>=0&&JSON.stringify(v)===JSON.stringify(this.items[this.cursor]))return false;this.items=this.items.slice(0,this.cursor+1);this.items.push(v);if(this.items.length>this.limit)this.items.shift();this.cursor=this.items.length-1;return true;}
 get canUndo(){return this.cursor>0} get canRedo(){return this.cursor>=0&&this.cursor<this.items.length-1}
 undo(){if(!this.canUndo)return null;return copy(this.items[--this.cursor]);}
 redo(){if(!this.canRedo)return null;return copy(this.items[++this.cursor]);}
}
export function viewHash(value,world){const s=snapshot(value,world);if(!s.location)return '';const p=new URLSearchParams({place:s.location});for(const k of ['zoom','x','y','yaw','pitch','fov'])p.set(k,String(Number(s.view[k].toFixed(4))));return '#'+p;}
export function readViewHash(hash,world){
 if(typeof hash!=='string'||hash.length>512)throw Error('link_oversize');const p=new URLSearchParams(hash.replace(/^#/,''));if(!p.has('place'))return null;
 for(const k of p.keys())if(!['place','zoom','x','y','yaw','pitch','fov'].includes(k)||p.getAll(k).length!==1)throw Error('link_fields');
 const v={};for(const k of ['zoom','x','y','yaw','pitch','fov'])if(p.has(k)){if(!p.get(k).trim())throw Error('link_number');v[k]=Number(p.get(k));}
 return snapshot({location:p.get('place'),view:v},world);
}
export function validateCheckpoints(data,world){
 if(!data||data.schema!==SCHEMA||!Array.isArray(data.points)||data.points.length>40)throw Error('journal_schema_or_limit');
 return data.points.map(p=>{if(!p||typeof p.name!=='string'||p.name.length<1||p.name.length>80)throw Error('checkpoint_name');const s=snapshot(p,world);if(!s.location)throw Error('checkpoint_empty');return {...s,name:p.name.replace(/[\u0000-\u001f]/g,' ')};});
}
export function pinchView(view,ratio){if(!Number.isFinite(ratio)||ratio<=0)return cameraView(view);return cameraView({...view,zoom:view.zoom*ratio,fov:view.fov/ratio});}
