const kinds=new Set(['text','video','audio']);
const valid=r=>r&&typeof r.id==='string'&&r.id.length<=160&&Number.isInteger(r.episode)&&r.episode>=1&&Number.isInteger(r.chapter)&&r.chapter>=1&&r.chapter<=6&&kinds.has(r.kind);
export function chapterRecords(records,anchor,limit=1){
 if(!Array.isArray(records)||records.length>5000||!Number.isInteger(limit)||limit<1||limit>6)return [];
 const origin=records.find(r=>valid(r)&&r.id===anchor);if(!origin||origin.chapter>limit)return [];
 return records.filter(r=>valid(r)&&r.episode===origin.episode&&r.chapter===origin.chapter&&r.chapter<=limit&&kinds.has(r.kind)).slice(0,100);
}
export function introductoryRecords(records){
 if(!Array.isArray(records)||records.length>5000)return [];
 return records.filter(r=>valid(r)&&r.episode===1&&r.chapter===1&&kinds.has(r.kind)).slice(0,8);
}
export function approvedRecord(records,id,limit=1){
 if(!Array.isArray(records)||records.length>5000||typeof id!=='string'||id.length>160||!Number.isInteger(limit)||limit<1||limit>6)return null;
 return records.find(r=>valid(r)&&r.id===id&&r.chapter>=1&&r.chapter<=limit&&kinds.has(r.kind))||null;
}
export function focusNeighbor(index,key,length){
 if(!Number.isInteger(length)||length<1||length>100)return null;
 if(key==='Home')return 0;if(key==='End')return length-1;
 if(['ArrowRight','ArrowDown'].includes(key))return (index+1)%length;
 if(['ArrowLeft','ArrowUp'].includes(key))return (index-1+length)%length;return null;
}
