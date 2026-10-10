// Review edits only AI-authored prose. Parser identities, positions and source
// never enter this mutation path. Apply transactionally after validating all edits.
const proseFields=new Set(['summary','input','output','purpose','example','name','meaning','title','explanation','answer','plain','naming','result','pitfall','text','question']);
function protocolError(message){return Object.assign(Error(message),{code:'AI_REVIEW_PROTOCOL'});}
function fieldPaths(draft){
 const paths=[];
 function visit(value,path=[]){
  if(path.length>64)return;
  if(typeof value==='string'&&proseFields.has(path.at(-1)))paths.push(path);
  else if(Array.isArray(value))value.forEach((v,i)=>visit(v,[...path,i]));
  else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))if(!['__proto__','prototype','constructor'].includes(key))visit(v,[...path,key]);
 }
 visit(draft);return paths;
}
function fieldCatalog(draft){
 return fieldPaths(draft).map((path,i)=>{
  let value=draft,parent=draft;
  for(const key of path){parent=value;value=value[key];}
  return {field:'f'+i,path,context:typeof parent.title==='string'?parent.title:typeof parent.id==='string'?parent.id:path.at(-1),anchor:value.slice(0,96)};
 });
}
function parseDraft(text){
 try {const value=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}
}
function apply(draft,text){
 const result=parseDraft(text);
 if(!result)throw protocolError('AI 复核格式不完整，请重试。');
 const catalog=fieldCatalog(draft),paths=catalog.map(f=>f.path),allowed=new Set(paths.map(p=>JSON.stringify(p)));
 // Legacy full responses must keep the exact structure and non-prose facts.
 if(!Object.hasOwn(result,'corrections')){
  function sameShape(before,after,path=[]){
   if(before===after)return true;
   if(typeof before==='string'&&typeof after==='string'&&after.length<=12000&&allowed.has(JSON.stringify(path)))return true;
   if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)!==Array.isArray(after))return false;
   if(Array.isArray(before)&&before.length!==after.length)return false;
   const keys=Object.keys(before);
   return keys.length===Object.keys(after).length&&keys.every(k=>Object.hasOwn(after,k)&&sameShape(before[k],after[k],[...path,Array.isArray(before)?Number(k):k]));
  }
  if(!sameShape(draft,result))throw protocolError('AI 复核包含无效修改，请重试。');
  return JSON.stringify(result);
 }
 if(!Array.isArray(result.corrections)||result.corrections.length>200)throw protocolError('AI 复核格式不完整，请重试。');
 const copy=JSON.parse(JSON.stringify(draft));
 const invalid=(reason,path)=>{
  if(process.env.WHO_REVIEW_DIAGNOSTICS==='1'){
   const known=new Set([...proseFields,'nodes','blocks','branches','sections','questions','terms']);
   console.warn('AI review rejected:',JSON.stringify({reason,path:Array.isArray(path)?path.map(k=>typeof k==='number'?k:known.has(k)?k:typeof k==='string'&&/^(0|[1-9]\d*)$/.test(k)?{numericString:k}:'[unknown key]'):'[invalid path]'}));
  }
  return protocolError('AI 复核包含无效修改，请重试。');
 };
 const touched=new Set();
 for(const edit of result.corrections){
  let path=edit?.path;
  if(Object.hasOwn(edit||{},'field')){
   if(Object.hasOwn(edit,'path')||typeof edit.field!=='string'||!/^f(?:0|[1-9]\d*)$/.test(edit.field))throw invalid('invalid field reference',null);
   const entry=catalog[Number(edit.field.slice(1))];
   if(!entry||typeof edit.anchor!=='string')throw invalid('field anchor mismatch',null);
   // A reviewer may extend the catalog prefix to finish a word or quote.
   // Require an exact prefix of this original field, no shorter than the
   // catalog anchor. Never trim, normalize, guess another field or match edits.
   let original=draft;for(const key of entry.path)original=original[key];
   if(edit.anchor!==entry.anchor&&!(edit.anchor.length>=entry.anchor.length&&original.startsWith(edit.anchor)))throw invalid('field anchor mismatch',null);
   path=entry.path;
  }
  if(!Array.isArray(path)||path.length<1||path.length>64||typeof edit.value!=='string'||edit.value.length>12000||!proseFields.has(path.at(-1)))throw invalid('invalid path or replacement type',path);
  let target=copy;const normalized=[];
  for(let i=0;i<path.length;i++){
   // Some compatible models serialize array indices as JSON strings. Accept
   // only canonical decimal indices on actual arrays; object keys and the
   // existing-property/prose-only checks remain unchanged.
   const rawKey=path[i],key=Array.isArray(target)&&typeof rawKey==='string'&&/^(0|[1-9]\d*)$/.test(rawKey)?Number(rawKey):rawKey;
   normalized.push(key);
   if(!target||typeof target!=='object'||(Array.isArray(target)?!Number.isInteger(key)||key<0:typeof key!=='string'||['__proto__','prototype','constructor'].includes(key))||!Object.hasOwn(target,key))throw invalid('path does not exist',path);
   if(i===path.length-1){
    const identity=JSON.stringify(normalized);
    if(typeof target[key]!=='string'||!allowed.has(identity)||touched.has(identity))throw invalid('target is not unique prose',path);
    touched.add(identity);target[key]=edit.value;
   }
   else target=target[key];
  }
 }
 return JSON.stringify(copy);
}
function instruction(locale){return locale==='en'
 ? 'REVIEW OUTPUT CONTRACT (overrides the task output format for this review only): return JSON {"corrections":[{"field":"f0","anchor":"copy exact anchor from catalog","value":"complete corrected text for that field"}]}. Copy BOTH field and anchor from the SAME catalog entry whose context and original text you intend to change; f0 is only a format example. Never calculate paths or use source line numbers, graph node IDs or array indices as field IDs. An anchor is the original text prefix, not your replacement. Keep each replacement about that section or node; check its heading and neighboring paragraphs to avoid moving the explanation of another function into it. Review the draft against the source; edit only prose that needs factual, language or teaching corrections. Use corrections: [] only after checking that no correction is needed. Replace the whole string, not a substring. Each field can occur only once. Do not return the draft, add fields, edit structure, IDs, source or arrays. Preserve important conditions. No review notes.'
 : '本次复核输出约定（仅在复核时覆盖任务输出格式）：只返回JSON {"corrections":[{"field":"f0","anchor":"原样复制字段表中的anchor","value":"此字段修正后的完整文字"}]}。根据章节/节点上下文和原文，从同一条字段记录复制field与anchor，f0仅为示例。anchor是原文前缀，不是修正文字。不要计算路径，不用行号、流程id或数组下标替代编号。替换内容必须仍解释这个章节或节点，核对标题和相邻段落，不能把另一函数的说明挪过来。对照源码只修改有事实、语言或教学问题的文字，核对后无需修改才返回corrections: []。替换整个字符串，每个字段只出现一次。不返回整篇草稿，不新增字段，不改结构、id、源码或数组。保留重要条件，不输出复核评语。';}
function readabilityHints(draft,options={}){
 if(options.readingMode!=='beginner'||!Array.isArray(draft.sections))return '';
 const flagged=draft.sections.flatMap((s,i)=>{
  if(typeof s?.text!=='string')return [];
  const long=s.text.split(/\n\s*\n/).some(p=>options.locale==='en'?p.trim().split(/\s+/).length>140:(p.match(/[\u3400-\u9fff]/g)||[]).length>280);
  return long?[['sections',i,'text']]:[];
 });
 if(!flagged.length)return '';
 if(options.task==='talk')return options.locale==='en'
  ? '\nReadability signals (advisory): '+JSON.stringify(flagged)+'. Shorten or split only when density obstructs the selected audience. Length alone is not a required edit. Do not expand a section to explain every technical detail.'
  : '\n可读性参考（非强制修改）：'+JSON.stringify(flagged)+'。只有密度妨碍所选受众理解时才缩短或分段，字数本身不是必须修改的理由，不为解释全部技术细节扩写章节。';
 return options.locale==='en'
  ? '\nReadability signals (advisory): '+JSON.stringify(flagged)+'. Length alone is not a defect or a required edit. Check whether essential terms, actual data and deciding conditions are understandable to the selected reader. Rewrite only to remove an identified comprehension obstacle, preserving necessary explanations and failure conditions. Keep useful repetition; do not compress merely to meet a word or sentence count.'
  : '\n可读性参考（非强制修改）：'+JSON.stringify(flagged)+'。长度本身不是错误或必须修改的理由。核对所选读者能否理解必要术语、实际数据和决定条件；只为消除明确理解障碍改写，保留必要解释、失败条件和有用重复，不为字数或句数压缩。';
}
function allowedPaths(draft){
 return '\nReview field catalog (copy field and anchor from the same entry; context identifies the section/node): '+JSON.stringify(fieldCatalog(draft));
}
function claimHints(draft,options={}){
 const fields=fieldCatalog(draft).filter(entry=>{
  let value=draft;for(const key of entry.path)value=value[key];
  return /\b(only|all|always|never|every|instant(?:ly|aneous)?|immediately|non.numeric|mixed.type)\b|只有|所有|一定|总是|从不|瞬间|非数字|混合类型/i.test(value);
 }).map(entry=>entry.field);
 if(!fields.length)return '';
 return options.locale==='en'
  ? '\nScope audit signals (advisory, not proof of error): '+JSON.stringify(fields)+'. Independently test these fields, including headings, for a source-supported counterexample and their input domain. Check the whole original field, not just its catalog anchor. A later caveat cannot repair an overbroad heading or earlier guarantee. Keep correct scoped conditions unchanged; correct or qualify unsupported claims in their own field. Do not add a catalogue of exotic inputs.'
  : '\n范围核对提示（参考信号，不代表已判错）：'+JSON.stringify(fields)+'。独立对照源码检查这些字段（含标题）的反例与输入范围，检查完整原文，不只看字段表中的anchor。后文限定不能修补标题或前文过宽的保证。正确的条件无需修改；无依据结论在原字段内修正或加必要限定，不扩写特殊输入清单。';
}
function returnHints(draft,messages,options={}){
 const fields=fieldCatalog(draft).filter(entry=>{
  let value=draft;for(const key of entry.path)value=value[key];
  return /\b(?:does(?:n't| not)|do(?:n't| not)|never|cannot|can't|no)\b.{0,70}\b(?:promise|asynchronous)\b|不存在.{0,24}(?:等待|稍后)|没有.{0,20}Promise/i.test(value);
 }).map(entry=>entry.field);
 let payload;for(const message of messages){if(message.role!=='user')continue;try{const value=JSON.parse(message.content);if(typeof value.source==='string'){payload=value;break;}}catch{}}
 if(!payload)return '';
 const facts=require('./ai-source-returns').parameterReturns(payload.source,payload.filename);
 if(!facts.length)return '';
 const data=JSON.stringify({fields,parameterReturnSyntax:facts});
 return options.locale==='en'
  ? '\nREQUIRED RETURN-TYPE CHECK: '+data+'. These records prove syntax only, not reachability or runtime types. For EACH listed prose field, compare its negative Promise/async guarantee with the exact returned expression. Also check any such guarantee you introduce during review. Trace assignments, actual guards and finally before deciding its type. A plain non-async function can return a caller-supplied Promise unchanged; no automatic wrapping is different from never returning a Promise. Unless source conditions establish the claimed type, correct the whole field, including the early guarantee. Do not preserve an unsupported guarantee and add a later caveat. Preserve correct statements about work performed by the function itself. Do not add a Promise discussion when no return-type claim needs correcting.'
  : '\n必须检查的返回类型结论：'+data+'。这些记录只证明语法，不证明可达性或运行时类型。逐个对照列出的说明字段，把“没有Promise/没有稍后结果”等保证与原样返回表达式比较，也检查你在复核时新增的同类保证；沿赋值、实际条件与finally确认其类型。非async函数也可以原样返回调用者传入的Promise；没有自动包装不等于绝不返回Promise。源码条件不能建立该类型时，修正完整字段及前面的保证，不保留错误保证再追加后文限定；保留关于函数自身执行工作的正确说明。无需修正返回类型陈述时，不额外加入Promise讲解。';
}
function loopHints(draft,messages,options={}){
 let payload;for(const message of messages){if(message.role!=='user')continue;try{const value=JSON.parse(message.content);if(typeof value.source==='string'&&value.selectedSource){payload=value;break;}}catch{}}
 if(!payload)return '';
 const loops=require('./ai-source-returns').enclosingLoops(payload.source,payload.filename,payload.selectedSource);
 if(!loops.length)return '';
 const data=JSON.stringify(loops);
 return options.locale==='en'
  ? '\nREQUIRED LOOP-CONTINUATION CHECK for the selected statement: '+data+'. These are exact parser-derived loop headers, not an executed trace. Finishing a catch block does not guarantee another attempt: follow any update, then re-evaluate the actual continuation condition. A default count does not prove supplied counts are positive integers. An exact equality used to rethrow is not necessarily the same boundary as a loop comparison. Correct unconditional retry/next-iteration statements, including any you introduce during review; describe the next guard check or leave it conditional. Keep the explanation local instead of listing unrelated input cases. Do not add a loop lecture when the answer need not discuss another iteration.'
  : '\n必须检查选中语句后的循环延续：'+data+'。这是解析器提取的原样循环头，不是运行轨迹。catch结束不保证再次尝试：先沿更新语句，再重新检查实际循环条件。默认次数不能证明调用者传入的次数都是正整数；用于重新抛错的严格相等，与循环比较未必是同一边界。修正无条件重试或下一轮执行的说法，包括复核时新增的说法；说明要继续检查条件或保留必要前提；仍只解释当前语句，不罗列无关输入。回答不需要讲下一轮时，不扩写循环教程。';
}
module.exports={parseDraft,apply,instruction,readabilityHints,allowedPaths,fieldCatalog,claimHints,returnHints,loopHints};
