// Shared prompt and deterministic decoder; no model, parser process or ledger access.
const {decodeModuleResponse:decode}=require('./cloudbase/functions/ai-trial/module-output.cjs');
function prompt(input,locale,mode){
 // The existing passage contract is reused verbatim. Module fields only isolate
 // the whole-module explanation from its input/output facts, in one request.
 return require('./ai-point-contract').profile(locale,mode,'passage',undefined,true,input)+(locale==='en'
 ? '\nModule transport: return a JSON object with summary, input, output, nodes and optional title. The text fields are {"summary":"<selected-module explanation>","input":"<received data and necessary dependencies>","output":"<returned results or visible effects and their conditions>"}. All three fields are nonempty plain-text strings. summary follows the passage rules above, retaining natural paragraphs; input and output contain concise source-supported facts. Do not add a terminology card or a technical prerequisites table. Do not duplicate the input/output inventory in summary. Also return nodes as an array of exactly {"id":"<provided scaffold id>","title":"<short, natural action title>"} for every provided scaffold node, including nested nodes. Copy ids exactly once; do not add ids or change positions, branches or calls. No other fields, Markdown fences or review notes. Encode paragraph breaks inside strings as \\n\\n. Optionally include title: a short plain-text heading (about eight words), summarizing only visible source-supported actions; an unknown callee name does not prove its internal purpose. Do not copy or truncate summary for the title.'
 : '\n模块传输：只返回含summary、input、output、nodes及可选title的JSON对象，文字字段为 {"summary":"<所选模块的整体解释>","input":"<接收的数据与必要依赖>","output":"<返回结果或可见作用及其条件>"}。三项均为非空纯文本字符串。summary遵循上方段读规则并保留自然段，input和output简洁说明源码支持的事实。不加术语卡或技术前提表，不在summary重复输入输出清单。另给nodes数组，每项只含{"id":"<已有scaffold节点id>","title":"<自然简短的动作标题>"}，覆盖所有提供的节点（含嵌套节点），id逐一原样且仅一次，不新增id或改变范围、分支、调用。不加其他字段、Markdown围栏或审核意见，字符串内段落空行编码为\\n\\n。可另给title：约八个中文词的简短纯文本功能标题，只概括源码可见作用，未知调用名称不证明内部职责；不照抄或截取summary。');
}

function fromContext(context){
 const input=context?.input,source=input?.source,selected=input?.selectedSource;
 const invalid=()=>Error('请选择有效的模块范围。');
 if(context?.kind!=='module'||typeof source!=='string'||!source.trim()||Buffer.byteLength(source)>100000||typeof input.filename!=='string'||input.filename.length>260||typeof input.sourceLanguage!=='string'||input.sourceLanguage.length>80)throw invalid();
 const lines=source.split('\n'),range=(start,end)=>Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end>=start&&end<=lines.length;
 if(!selected||!range(selected.start,selected.end)||!Array.isArray(input.scaffold)||!input.scaffold.length||!Array.isArray(input.knownCallees))throw invalid();
 const ids=new Set(),targets=new Set();let count=0;
 function nodes(items){
  if(!Array.isArray(items))throw invalid();
  return items.map(node=>{
   if(!node||++count>120||typeof node.id!=='string'||!/^n[1-9]\d*$/.test(node.id)||ids.has(node.id)||typeof node.kind!=='string'||node.kind.length>40||!range(node.start,node.end)||node.start<selected.start||node.end>selected.end||!Array.isArray(node.branches))throw invalid();
   ids.add(node.id);
   if(node.startColumn!==undefined||node.endColumn!==undefined){if(!Number.isInteger(node.startColumn)||!Number.isInteger(node.endColumn)||node.startColumn<0||node.endColumn<0||node.startColumn>lines[node.start-1].length||node.endColumn>lines[node.end-1].length)throw invalid();}
   if(node.terminal!==undefined&&typeof node.terminal!=='boolean')throw invalid();
   const next={id:node.id,kind:node.kind,start:node.start,end:node.end,
    ...(node.startColumn!==undefined?{startColumn:node.startColumn,endColumn:node.endColumn}:{}),
    ...(node.terminal!==undefined?{terminal:node.terminal}:{}),branches:node.branches.map(branch=>{
     if(!branch||typeof branch.label!=='string'||branch.label.length>80)throw invalid();
     return {label:branch.label,nodes:nodes(branch.nodes)};
    })};
   if(node.calls!==undefined){
    if(!Array.isArray(node.calls)||node.calls.length>120)throw invalid();
    next.calls=node.calls.map(call=>{if(!call||typeof call.name!=='string'||call.name.length>260||!range(call.start,call.start)||!Number.isInteger(call.line)||call.line<node.start||call.line>node.end)throw invalid();targets.add(call.start);return {name:call.name,start:call.start,line:call.line};});
   }
   return next;
  });
 }
 const scaffold=nodes(input.scaffold),seen=new Set();
 const knownCallees=input.knownCallees.map(callee=>{if(!callee||!range(callee.start,callee.end)||!targets.has(callee.start)||seen.has(callee.start)||typeof callee.name!=='string'||callee.name.length>260)throw invalid();seen.add(callee.start);return {name:callee.name,start:callee.start,end:callee.end,source:lines.slice(callee.start-1,callee.end).join('\n')};});
 const locale=context.locale==='en'?'en':'zh-CN',readingMode=context.readingMode==='beginner'?'beginner':'standard';
 const rebuilt={filename:input.filename,sourceLanguage:input.sourceLanguage,source,selectedSource:{start:selected.start,end:selected.end,code:lines.slice(selected.start-1,selected.end).join('\n')},knownCallees,scaffold,question:locale==='en'?'Explain the selected module and the data it receives and produces.':'解释选中的模块及它接收和产生的数据。'};
 return {input:rebuilt,json:true,maxTokens:6000,reasoningEffort:'low',messages:[{role:'system',content:prompt(rebuilt,locale,readingMode)},{role:'user',content:JSON.stringify(rebuilt)}]};
}
module.exports={prompt,decode,fromContext};
