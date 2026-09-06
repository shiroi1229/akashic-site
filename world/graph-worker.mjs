import {buildGraph,GRAPH_LIMIT} from './graph-core.mjs';
self.onmessage=event=>{try{const graph=buildGraph(event.data.records);const total=event.data.total;if(Number.isSafeInteger(total)&&total>=graph.nodes.length){graph.total=total;graph.truncated=total>GRAPH_LIMIT;}postMessage({sequence:event.data.sequence,graph})}catch{postMessage({sequence:event.data.sequence,error:'layout_failed'})}};
