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
   if(!entry||typeof edit.anchor!=='string'||edit.anchor!==entry.anchor)throw invalid('field anchor mismatch',null);
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
  ? '\nREQUIRED BEGINNER EDITS: '+JSON.stringify(flagged)+'. These paragraph fields are too dense. Include a correction for each listed field. Rewrite into short, natural paragraphs of one or two sentences, each preferably under 65 words. Explain data and decisions in ordinary words; define unfamiliar terms in place. Preserve important branches and failure conditions. Do not chain source identifiers as the explanation. Separate independent ideas with a blank line if all the facts cannot fit a short paragraph.'
  : '\n必须修改的零基础段落：'+JSON.stringify(flagged)+'。这些字段过于密集，请逐一提供修正，改为每段一两句的自然短段，先讲数据和实际动作，必要术语就地说明，保留关键分支和失败条件。不用标识符串代替解释；内容较多时以空行分开独立思路。';
}
function allowedPaths(draft){
 return '\nReview field catalog (copy field and anchor from the same entry; context identifies the section/node): '+JSON.stringify(fieldCatalog(draft));
}
module.exports={parseDraft,apply,instruction,readabilityHints,allowedPaths};
