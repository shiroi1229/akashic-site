/** Pure catalogue functions shared by the page and the tests. No network or AI API. */
export const KINDS = {video:'映像',text:'小説',audio:'音声'};
export function normalize(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
}
export function validateCatalog(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length>2000 || !/^[a-f0-9]{40}$/.test(data.sourceCommit)) throw new Error('索引の形式が一致しません');
  const ids=new Set();
  for (const r of data.records) {
    if (!r || typeof r.id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) || ids.has(r.id) || !Object.hasOwn(KINDS,r.kind) || typeof r.title!=='string' || !r.title || r.title.length>300 || !Number.isInteger(r.chapter) || r.chapter<1 || r.chapter>6 || r.episode!==1 || r.provenance!=='published_metadata' || typeof r.source!=='string' || r.source.length>200) throw new Error('未検証の記録形式です');
    const u=new URL(r.url);
    if (u.protocol!=='https:' || u.username || u.password || u.port || !['www.youtube.com','shiroi1229.github.io'].includes(u.hostname)) throw new Error('許可されていないURLです');
    if (r.kind==='video' && (!/^[\w-]{11}$/.test(r.videoId) || u.hostname!=='www.youtube.com' || u.pathname!=='/watch' || u.searchParams.get('v')!==r.videoId)) throw new Error('映像IDが一致しません');
    if (r.kind!=='video' && (u.hostname!=='shiroi1229.github.io' || !u.pathname.startsWith('/akashic-site/'))) throw new Error('書庫のURLが一致しません');
    ids.add(r.id);
  }
  return data;
}
export function selectRecords(records, state, saved=[]) {
  const tokens=normalize(state.query||'').trim().split(/\s+/).filter(Boolean);
  const cap=Math.max(1,Math.min(6,Number(state.chapter)||1));
  return records.filter(r=>r.chapter<=cap && (state.kind==='all'||r.kind===state.kind) && (!state.savedOnly||saved.includes(r.id)) && tokens.every(t=>normalize(`${r.title} ${r.description||''} ${r.id} EP01 第${r.chapter}章 ${KINDS[r.kind]}`).includes(t)));
}
export function validateImport(data, allowedIDs) {
  if (!data || data.version!==1 || data.application!=='akashic-terminal' || !Array.isArray(data.saved) || data.saved.length>2000 || !data.saved.every(id=>typeof id==='string' && id.length<=100)) throw new Error('しおりJSONの形式が一致しません');
  return [...new Set(data.saved.filter(id=>allowedIDs.has(id)))];
}

/** URL fragment state is local to the browser. Recipients opt in to later chapters. */
export function readURLState(fragment) {
  const q=new URLSearchParams(String(fragment||'').replace(/^[#?]/,''));
  return {query:(q.get('q')||'').slice(0,300),
    kind:Object.hasOwn(KINDS,q.get('kind'))?q.get('kind'):'all',
    chapter:1, requestedChapter:Math.max(1,Math.min(6,parseInt(q.get('chapter')||'1',10)||1)),
    savedOnly:q.get('saved')==='1',record:(q.get('record')||'').slice(0,100)};
}
