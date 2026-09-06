/** World contract: no implied canon, no remote URL injection, no network until approval. */
export const VERSION='0.3.1';
export const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const wrapYaw=n=>((n+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
const finite=Number.isFinite;
const ID=/^[a-z0-9][a-z0-9-]{0,63}$/;
const HASH=/^[a-f0-9]{64}$/;
export function safeAssetPath(p){return typeof p==='string'&&p.startsWith('assets/')&&p.length<240&&p.split('/').every(x=>/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(x)&&x!=='.'&&x!=='..')&&!p.includes('..');}
export function validEvidence(v){return v&&v.status==='approved'&&typeof v.ref==='string'&&v.ref.trim().length>0&&v.ref.length<400;}
export function validateWorld(w){
 const errors=[]; const err=s=>errors.push(s);
 if(!w||w.schema!=='akashic-world/v1'||!Array.isArray(w.locations)||!Array.isArray(w.assets))return {ok:false,errors:['world_schema']};
 if(w.locations.length>2000||w.assets.length>10000)return {ok:false,errors:['world_too_large']};
 if(w.coordinates?.units!=='m'||w.coordinates?.up!=='Y'||w.coordinates?.handedness!=='right')err('coordinate_contract');
 const ids=new Set(), aids=new Set();
 for(const a of w.assets){
  if(!a||typeof a!=='object'){err('asset_object');continue;}
  if(!ID.test(a.id)||aids.has(a.id))err('asset_id');aids.add(a.id);
  if(!['still','panorama','video','audio','glb'].includes(a.kind))err('asset_kind');
  if(!safeAssetPath(a.path)||!HASH.test(a.sha256||''))err('asset_identity');
  if(!Number.isInteger(a.bytes)||a.bytes<=0||a.bytes>256*1024*1024)err('asset_budget');
  if(['still','panorama','video'].includes(a.kind)&&(!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>32768||a.height>32768))err('asset_dimensions');
  if(!['approved','pending','rejected'].includes(a.approval?.status))err('asset_approval');
  if(a.approval?.status==='approved'&&(!validEvidence(a.approval)||a.sourceVerified!==true))err('approval_evidence');
  if(a.kind==='panorama'&&(a.projection!=='equirectangular'||a.coverage!=='full-360'||a.width!==2*a.height||!validEvidence(a.projectionReview)))err('panorama_projection');
 }
 for(const n of w.locations){
  if(!n||typeof n!=='object'){err('location_object');continue;}
  if(!ID.test(n.id)||ids.has(n.id))err('location_id');ids.add(n.id);
  if(typeof n.title!=='string'||!n.title.trim()||n.title.length>100)err('location_title');
  if(!['approved','pending','rejected'].includes(n.approval?.status))err('location_approval');
  if(n.approval?.status==='approved'&&!validEvidence(n.approval))err('location_evidence');
  if(n.assetId!==null&&!aids.has(n.assetId))err('missing_asset');
  if(!['still','panorama','video','walk'].includes(n.mode))err('location_mode');
  if(!Array.isArray(n.hotspots)||n.hotspots.length>60)err('hotspot_limit');
  for(const h of Array.isArray(n.hotspots)?n.hotspots:[]){
   if(!h||typeof h!=='object'){err('hotspot_object');continue;}
   if(typeof h.label!=='string'||h.label.length>100)err('hotspot_label');
   if(!['inspect','travel'].includes(h.action))err('hotspot_action');
   if(h.action==='inspect'&&(typeof h.text!=='string'||h.text.length>2000))err('hotspot_text');
   if(h.coordinates==='image'&&(!finite(h.x)||!finite(h.y)||h.x<0||h.x>1||h.y<0||h.y>1))err('hotspot_bounds');
   else if(h.coordinates==='sphere'&&(!finite(h.yaw)||!finite(h.pitch)||Math.abs(h.pitch)>Math.PI/2))err('hotspot_angles');
   else if(!['image','sphere'].includes(h.coordinates))err('hotspot_coordinates');
  }
 }
 for(const n of w.locations)for(const h of Array.isArray(n?.hotspots)?n.hotspots:[])if(h?.action==='travel'&&!ids.has(h.target))err('hotspot_target');
 return {ok:errors.length===0,errors:[...new Set(errors)]};
}
export function entryGate(w,id,{walkRenderer=false}={}){
 const check=validateWorld(w);if(!check.ok)return {ok:false,reason:'世界データの検査に失敗',code:'invalid_manifest'};
 const n=w.locations.find(x=>x.id===id);if(!n)return {ok:false,reason:'場所が見つからない',code:'unknown_location'};
 if(!validEvidence(n.approval))return {ok:false,reason:'場所の正典照合待ち',code:'location_unapproved'};
 const a=w.assets.find(x=>x.id===n.assetId);
 if(!a||!validEvidence(a.approval)||a.sourceVerified!==true)return {ok:false,reason:'承認済みの映像・原画像待ち',code:'asset_unapproved'};
 if(n.mode==='walk'){
  if(a.kind!=='glb'||!validEvidence(n.navigation?.approval)||!validEvidence(n.frontProjection)||!validEvidence(n.topProjection))return {ok:false,reason:'歩行・正面・真上の検査待ち',code:'spatial_gate'};
  if(!walkRenderer)return {ok:false,reason:'自由歩行レンダラー未接続',code:'renderer_unavailable'};
 }else if(a.kind!==n.mode)return {ok:false,reason:'映像形式が一致しない',code:'mode_mismatch'};
 return {ok:true,location:n,asset:a,code:'approved_metadata'};
}
export function cameraView(v={}){return {yaw:wrapYaw(finite(v.yaw)?v.yaw:0),pitch:clamp(finite(v.pitch)?v.pitch:0,-1.45,1.45),fov:clamp(finite(v.fov)?v.fov:70,40,90),zoom:clamp(finite(v.zoom)?v.zoom:1,1,1.5),x:clamp(finite(v.x)?v.x:0,-1,1),y:clamp(finite(v.y)?v.y:0,-1,1)};}
export function imageRect(iw,ih,vw,vh,view={}){
 const c=cameraView(view);if([iw,ih,vw,vh].some(x=>!finite(x)||x<=0))throw Error('invalid_dimensions');
 const k=Math.min(vw/iw,vh/ih)*c.zoom,w=iw*k,h=ih*k;
 return {x:(vw-w)/2+c.x*Math.max(0,(w-vw)/2),y:(vh-h)/2+c.y*Math.max(0,(h-vh)/2),w,h};
}
/** Camera looks -Z. Positive yaw turns right. No degrees/radians ambiguity. */
export function projectSphere(yaw,pitch,view,vw,vh){
 const c=cameraView(view),d=wrapYaw(yaw-c.yaw),cp=Math.cos(pitch);
 const x=Math.sin(d)*cp,y=Math.sin(pitch),z=-Math.cos(d)*cp;
 const yy=Math.cos(c.pitch)*y+Math.sin(c.pitch)*z,zz=-Math.sin(c.pitch)*y+Math.cos(c.pitch)*z;
 const near=-zz;if(near<=.001)return null;
 const f=Math.tan(c.fov*Math.PI/360),nx=x/(near*f*(vw/vh)),ny=yy/(near*f);
 if(Math.abs(nx)>1||Math.abs(ny)>1)return null;
 return {x:(nx+1)*vw/2,y:(1-ny)*vh/2};
}
export function cleanVisitState(raw,w){
 const fallback={schema:'akashic-visits/v1',last:null,visited:[]};if(!validateWorld(w).ok||!raw||raw.schema!==fallback.schema)return fallback;
 const allowed=new Set(w.locations.filter(n=>entryGate(w,n.id).ok).map(n=>n.id));
 const visited=[...new Set((Array.isArray(raw.visited)?raw.visited:[]).filter(x=>allowed.has(x)))].slice(0,2000);
 return {...fallback,last:allowed.has(raw.last)?raw.last:null,visited};
}
/** Deterministic floor-only swept-circle prototype. NOT a complete 3D navmesh engine. */
export function stepWalker(p,input,dt,nav){
 if(!p||![p.x,p.y,p.z,dt].every(finite)||!nav||!nav.bounds||!Array.isArray(nav.obstacles))throw Error('invalid_walk_input');
 const b=nav.bounds,r=nav.radius??.25;if(!finite(nav.speed??1.4))throw Error('invalid_speed');
 if(![b.minX,b.maxX,b.minZ,b.maxZ,r,nav.floorY].every(finite)||r<=0||b.maxX-b.minX<2*r||b.maxZ-b.minZ<2*r||nav.obstacles.some(o=>![o.minX,o.maxX,o.minZ,o.maxZ].every(finite)||o.minX>o.maxX||o.minZ>o.maxZ))throw Error('invalid_navigation');
 let x=p.x,z=p.z;const y=nav.floorY;
 const collides=(xx,zz)=>xx<b.minX+r||xx>b.maxX-r||zz<b.minZ+r||zz>b.maxZ-r||nav.obstacles.some(o=>xx>o.minX-r&&xx<o.maxX+r&&zz>o.minZ-r&&zz<o.maxZ+r);
 if(collides(x,z))throw Error('invalid_spawn');
 const ix=finite(input?.x)?input.x:0,iz=finite(input?.z)?input.z:0,len=Math.hypot(ix,iz),speed=clamp(nav.speed??1.4,0,3),t=clamp(dt,0,.1);
 const dx=ix/Math.max(1,len)*speed*t,dz=iz/Math.max(1,len)*speed*t,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/(r*.25)));
 for(let i=0;i<steps;i++){if(!collides(x+dx/steps,z))x+=dx/steps;if(!collides(x,z+dz/steps))z+=dz/steps;}
 return {x,y,z};
}
/** Resident-byte accounting only. Does not claim real GPU VRAM measurements. */
export class AssetBudget{
 constructor(limit){if(!Number.isSafeInteger(limit)||limit<1)throw Error('invalid_budget');this.limit=limit;this.items=new Map();this.clock=0;}
 get used(){return [...this.items.values()].reduce((n,v)=>n+v.bytes,0);}
 touch(id){const x=this.items.get(id);if(x)x.tick=++this.clock;}
 plan(id,bytes){if(!Number.isSafeInteger(bytes)||bytes<1||bytes>this.limit)throw Error('asset_over_budget');const old=this.items.get(id);let needed=this.used-(old?.bytes||0)+bytes-this.limit;const evict=[];
  for(const [k,v]of [...this.items].filter(([k,v])=>k!==id&&!v.pinned).sort((a,b)=>a[1].tick-b[1].tick)){if(needed<=0)break;evict.push(k);needed-=v.bytes;}if(needed>0)throw Error('pinned_budget');return evict;}
 add(id,bytes,pinned=false){const evict=this.plan(id,bytes);for(const k of evict)this.items.delete(k);this.items.set(id,{bytes,pinned,tick:++this.clock});return evict;}
 pin(id,on=true){if(this.items.has(id))this.items.get(id).pinned=on;}
}
