const {modelCall}=require('./ai-client');
const {scaffold}=require('../public/flow-model');
function moduleInput(result,source,start,end,name,locale='zh-CN',role,blockId){
 if(typeof source!=='string'||!Number.isInteger(start))throw Error('请选择有效的模块范围。');
 const graph=scaffold(result,start,locale,(end!==undefined||role!==undefined||blockId!==undefined)?{end,role,blockId}:undefined),lines=source.split('\n');
 if(graph.start<1||graph.end>lines.length||!Number.isInteger(graph.end)||(end!==undefined&&end!==graph.end))throw Error('请选择有效的模块范围。');
 const targets=new Set();
 const collect=nodes=>nodes.forEach(n=>{for(const call of n.calls||[])targets.add(call.start);for(const branch of n.branches||[])collect(branch.nodes);});collect(graph.nodes);
 const knownCallees=result.blocks.filter(b=>targets.has(b.start)).map(b=>({name:b.title,start:b.start,end:b.end,source:lines.slice(b.start-1,b.end).join('\n')}));
 return {filename:name||'',sourceLanguage:result.language,source,selectedSource:{start:graph.start,end:graph.end,code:lines.slice(graph.start-1,graph.end).join('\n')},knownCallees,scaffold:graph.nodes,question:locale==='en'?'Explain the selected module and the data it receives and produces.':'解释选中的模块及它接收和产生的数据。'};
}
const {prompt,decode}=require('./ai-module-reading-policy');
async function explainModule(result,source,start,config,options={}){
 options.signal?.throwIfAborted();
 await config.prepareTrial?.();
 options.signal?.throwIfAborted();
 const input=moduleInput(result,source,start,options.end,options.name,options.locale,options.role,options.blockId);
 const raw=await modelCall(config,[{role:'system',content:prompt(input,options.locale,options.readingMode)},{role:'user',content:JSON.stringify(input)}],{...options,task:'module-reading',readingContext:{kind:'module',input,locale:options.locale,readingMode:options.readingMode},explanation:false,json:true,reviewFoundation:null,reviewDraft:false,reviewReasoning:false,pointDraftHigh:false,pointDraftLow:require('./ai-point').supportsLow(config),maxTokens:6000,usagePhase:'module-reading'});
 options.signal?.throwIfAborted();
 return {...decode(raw,input.scaffold),start:input.selectedSource.start,end:input.selectedSource.end,origin:'ai-module-reading'};
}
module.exports={moduleInput,prompt,decode,explainModule};
