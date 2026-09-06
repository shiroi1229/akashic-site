export const GRAPH_LIMIT=100;
export function buildGraph(records){
 if(!Array.isArray(records))throw Error('records_invalid');const seen=new Set();
 const selected=records.slice(0,GRAPH_LIMIT).filter(r=>{if(!r||typeof r.id!=='string'||seen.has(r.id))return false;seen.add(r.id);return true;});
 const nodes=selected.map((r,i)=>{const a=-Math.PI/2+i*2*Math.PI/Math.max(1,selected.length);return {id:r.id,chapter:r.chapter,kind:r.kind,title:r.title,x:Math.cos(a)*.68,y:Math.sin(a)*.65};});
 const edges=[];const previous=new Map();nodes.forEach((n,i)=>{if(previous.has(n.chapter))edges.push([previous.get(n.chapter),i]);previous.set(n.chapter,i);});
 // Bounded, deterministic relaxation. Relationships mean same chapter, never geography or canon.
 for(let step=0;step<36;step++){
  const delta=nodes.map(()=>({x:0,y:0}));for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d2=Math.max(.025,dx*dx+dy*dy),f=.0018/d2;
   delta[i].x+=dx*f;delta[i].y+=dy*f;delta[j].x-=dx*f;delta[j].y-=dy*f;
  }
  for(const [i,j]of edges){const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y;delta[i].x+=dx*.007;delta[i].y+=dy*.007;delta[j].x-=dx*.007;delta[j].y-=dy*.007;}
  nodes.forEach((n,i)=>{n.x=Math.max(-.8,Math.min(.8,n.x+delta[i].x-n.x*.003));n.y=Math.max(-.72,Math.min(.72,n.y+delta[i].y-n.y*.003));});
 }
 return {nodes,edges,truncated:records.length>GRAPH_LIMIT,total:records.length};
}
export function graphView(v={}){const f=(n,d)=>Number.isFinite(n)?n:d;return {scale:Math.max(.65,Math.min(2.6,f(v.scale,1))),x:Math.max(-1.2,Math.min(1.2,f(v.x,0))),y:Math.max(-1.2,Math.min(1.2,f(v.y,0)))};}
export function projectNode(node,v,width,height){v=graphView(v);return {x:width/2+(node.x*v.scale+v.x)*width*.42,y:height/2+(node.y*v.scale+v.y)*height*.42};}
export function neighbor(nodes,current,key){const i=nodes.findIndex(n=>n.id===current);if(i<0)return nodes[0]?.id||null;const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];if(!dir)return null;let best=null,score=Infinity;for(const n of nodes){if(n.id===current)continue;const dx=n.x-nodes[i].x,dy=n.y-nodes[i].y,dot=dx*dir[0]+dy*dir[1];if(dot<=0)continue;const s=Math.hypot(dx,dy)+(Math.abs(dx*dir[1]-dy*dir[0]))*1.3;if(s<score){score=s;best=n.id;}}return best;}
/** Screen-space label relaxation; never changes source records or their edges. */
export function separateLabels(points,width,height,labelWidth=105,labelHeight=64,gap=10){
 const p=points.map(v=>({...v})),padX=Math.min(width/2,labelWidth/2+8),padY=Math.min(height/2,labelHeight/2+8);
 const bound=v=>{v.x=Math.max(padX,Math.min(width-padX,v.x));v.y=Math.max(padY,Math.min(height-padY,v.y));};p.forEach(bound);
 for(let step=0;step<48;step++){let changed=false;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  const dx=p[j].x-p[i].x,dy=p[j].y-p[i].y,ox=labelWidth+gap-Math.abs(dx),oy=labelHeight+gap-Math.abs(dy);if(ox<=0||oy<=0)continue;changed=true;
  if(ox<oy){const amount=(ox+.1)/2*(dx>=0?1:-1);p[i].x-=amount;p[j].x+=amount;}else{const amount=(oy+.1)/2*(dy>=0?1:-1);p[i].y-=amount;p[j].y+=amount;}bound(p[i]);bound(p[j]);
 }if(!changed)break;}return p;
}
