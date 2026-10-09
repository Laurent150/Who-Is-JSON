// Shared deterministic delivery decoder for a single module-reading response.
// The gateway must bind and validate scaffoldNodes before provider dispatch.
// Never use a later client-supplied scaffold or reported failure for a refund.
// This module deliberately has no provider, parser, account or ledger access.
function decodeModuleResponse(raw,scaffoldNodes){
 let data;try{data=JSON.parse(raw.trim());}catch{throw Error('模块解释格式不完整，请重试。');}
 if(!data||Array.isArray(data)||!['input,nodes,output,summary','input,nodes,output,summary,title'].includes(Object.keys(data).sort().join())||!['summary','input','output'].every(k=>typeof data[k]==='string'&&data[k].trim()))throw Error('模块解释格式不完整，请重试。');
 const ids=[];const visit=nodes=>nodes.forEach(n=>{ids.push(n.id);for(const branch of n.branches||[])visit(branch.nodes);});visit(scaffoldNodes);
 if(!Array.isArray(data.nodes)||data.nodes.length!==ids.length||data.nodes.some(n=>!n||Array.isArray(n)||Object.keys(n).sort().join()!=='id,title'||typeof n.id!=='string'||!ids.includes(n.id)||typeof n.title!=='string'||!n.title.trim()||n.title.length>160)||new Set(data.nodes.map(n=>n.id)).size!==ids.length)throw Error('模块解释格式不完整，请重试。');
 const titles=new Map(data.nodes.map(n=>[n.id,n.title]));const attach=nodes=>nodes.map(n=>({...n,title:titles.get(n.id),origin:'ai-module-title',branches:n.branches.map(b=>({...b,nodes:attach(b.nodes)}))}));
 const {title,...body}=data;const validTitle=typeof title==='string'&&title.trim()&&title.length<=80&&!/[\r\n\x00-\x1f`]/.test(title);
 return {...body,...(validTitle?{title}:{}),nodes:attach(scaffoldNodes)};
}
module.exports={decodeModuleResponse};
