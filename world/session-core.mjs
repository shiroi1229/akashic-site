import {graphView} from './graph-core.mjs';
export const SESSION_SCHEMA='akashic-terminal-session/v1';
export function terminalSession(value){
 if(!value||value.schema!==SESSION_SCHEMA||!value.state||!value.graph)throw Error('session_invalid');
 const s=value.state,g=value.graph;if(typeof s.query!=='string'||s.query.length>300)throw Error('session_query');
 if(!['all','video','text','audio'].includes(s.kind)||!Number.isInteger(s.chapter)||s.chapter<1||s.chapter>6||typeof s.savedOnly!=='boolean')throw Error('session_filter');
 if(!g.view||['scale','x','y'].some(k=>!Number.isFinite(g.view[k]))||typeof g.list!=='boolean')throw Error('session_graph');
 const y=value.scrollY;if(!Number.isFinite(y)||y<0||y>1000000)throw Error('session_scroll');
 const selected=value.selected;if(selected!==null&&(typeof selected!=='string'||selected.length>160))throw Error('session_record');
 return {schema:SESSION_SCHEMA,state:{query:s.query,kind:s.kind,chapter:s.chapter,savedOnly:s.savedOnly},graph:{view:graphView(g.view),list:g.list},scrollY:y,selected};
}
