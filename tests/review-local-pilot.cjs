// Paired editor experiment over saved prose. Never execute sample source or
// pass evaluator ratings/counterexamples to a model. No network on import.
const crypto=require('node:crypto'),local=require('../ai/ai-review-local-edits'),patches=require('../ai/ai-review-patches'),audit=require('../ai/ai-final-audit');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const LIMIT=36,REPAIRS=4;
async function capture(client,config,prepared,draft,options){
 let body;const stop=new Error('LOCAL_CAPTURE_ONLY');
 try{await client.reviewModelResponse(config,prepared,draft,{...options,onModelRequest:value=>{body=value;throw stop;}});}catch(error){if(error!==stop)throw error;}
 if(!body)throw Error('No editor request captured');return body;
}
async function plan(records){
 if(process.env.WHO_TALK_EVAL_TRACE!=='1'||process.env.WHO_CLOUD_DISABLED!=='1')throw Error('Explicit local evaluation environment required');
 const jobs=[];
 // Two known problem manuscripts, one runtime-boundary line explanation, and
 // a previously acceptable manuscript. Identical saved candidate for each arm.
 for(let repeat=0;repeat<2;repeat++)for(const [pair,index]of [1,6,17,9].entries()){
  const record=records.find(r=>r.jobId===`recovery-j${index}-candidate`);
  if(!record)throw Error('Missing saved record '+index);
  const review=record.traces.find(t=>t.phase==='review'),checked=record.traces.find(t=>t.phase==='final-audit');
  const input=JSON.parse(checked.request.messages[1].content),draft=input.candidate;
  const options={...input.settings,json:record.task==='talk'||record.task==='token',reviewFoundation:input.reviewContext};
  const prepared=options.json?review.request.messages.slice(0,review.request.messages.findIndex(m=>m.role==='assistant')):record.traces.find(t=>t.phase==='draft').request.messages;
  const document=options.json?patches.parseDraft(draft):{answer:draft};if(!document)throw Error('Invalid saved candidate');
  const config={base:'https://api.deepseek.com',model:review.request.model,reviewThinking:true};
  const oldBody=await capture(require('../ai/ai-client'),config,prepared,draft,{...options,evaluationReview:{editor:'legacy',audit:'off'}});
  const newBody=await capture(require('../ai/ai-client'),config,prepared,draft,{...options,evaluationReview:{editor:'local-edits-v1',audit:'off'}});
  for(const variant of (repeat+pair)%2?['local','legacy']:['legacy','local'])jobs.push({jobId:`local-r${repeat}-j${index}-${variant}`,sourceJob:record.jobId,id:record.id,repeat,variant,sourceHash:hash(input.source),draftHash:hash(draft),draft,prepared,options,body:variant==='legacy'?oldBody:newBody});
 }
 return jobs;
}
function apply(job,text){
 const document=job.options.json?patches.parseDraft(job.draft):{answer:job.draft};
 const source=job.prepared.flatMap(m=>{try{const p=JSON.parse(m.content);return typeof p.source==='string'?[p.source]:[];}catch{return[];}})[0];
 let candidate;
 if(job.variant==='local'){
  candidate=local.apply(document,text,source);if(!job.options.json)candidate=JSON.parse(candidate).answer;
 }else candidate=job.options.json?patches.apply(document,text):text;
 audit.build(job.prepared,candidate,job.draft,job.options);return candidate;
}
function repairBody(job){
 const body=structuredClone(job.body),en=job.options.locale==='en';
 body.messages.push({role:'user',content:job.variant==='local'
  ? en?'The previous edits failed mechanical validation. Recheck the unchanged fields and source. Return edits JSON with exact unique quotes, valid field IDs and source excerpts; do not return empty edits just to avoid the error.':'上次修改未通过程序校验。重新核对未改动的字段和源码，按edits约定返回准确且唯一的原文引用、有效字段编号及源码引用，不为规避报错而返回空修改。'
  : en?'The previous review could not be applied. Recheck the original source and draft. Copy field and anchor from the same catalog entry and return only corrections JSON with complete corrected strings. Do not guess references or return empty corrections merely to avoid the format error.':'上次复核未能应用。重新核对源码和草稿，从同一条字段记录复制field和anchor，返回corrections JSON及完整修正文字，不猜引用，不为规避报错而返回空修改。'});
 return body;
}
function auditRequest(job,candidate){
 const input=audit.build(job.prepared,candidate,job.draft,job.options);
 const body=require('../ai/ai-client').requestOptions({base:'https://api.deepseek.com',model:job.body.model,reviewThinking:true},[{role:'system',content:audit.instruction(job.options)},{role:'user',content:JSON.stringify(input)}],{...job.options,explanation:false,json:true,usagePhase:'final-audit',reviewReasoning:true,maxTokens:5000}).body;
 return {body,input};
}
function canReserve(events,phase){return events.length<LIMIT&&(phase!=='repair'||events.filter(e=>e.phase==='repair').length<REPAIRS);}
module.exports={plan,capture,apply,repairBody,auditRequest,canReserve,LIMIT,REPAIRS,hash};
