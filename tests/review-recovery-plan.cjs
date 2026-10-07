// Follow-up within the original 104-call budget. Never execute sample source.
const {plan,cases}=require('./review-acceptance-cases.cjs');
function withoutFoundation(body){
 const copy=structuredClone(body);let contexts=0,instructions=0;
 for(const m of copy.messages){
  if(m.role==='system')m.content=m.content.split('\n').filter(line=>{if(line.startsWith('FIMI_REVIEW_CONTEXT_V1')){instructions++;return false;}return true;}).join('\n');
  if(m.role==='user')try{const p=JSON.parse(m.content);if(typeof p.source==='string'&&p.reviewContext){delete p.reviewContext;contexts++;m.content=JSON.stringify(p);}}catch{}
 }
 if(contexts!==1||instructions!==1)throw Error('Expected exactly one foundation context and instruction');
 return copy;
}
function probes(records){
 const jobs=[];
 for(const [index,id] of ['j0-candidate','j2-candidate'].entries()){
  const record=records.find(r=>r.jobId===id&&r.traces.some(t=>t.phase==='composition'));
  if(!record)throw Error('Missing original composition request: '+id);
  const body=record.traces.find(t=>t.phase==='composition').request;
  const sample=cases.find(c=>c.id===record.id);
  const sourceMessage=body.messages.find(m=>{try{return JSON.parse(m.content).source===sample.source;}catch{return false;}});
  if(!sourceMessage||body.model!=='deepseek-flash')throw Error('Probe source/model mismatch');
  const off=withoutFoundation(body),conditions=index%2?['off','on']:['on','off'];
  for(const context of conditions)jobs.push({jobId:'format-'+id+'-'+context,id:record.id,task:'probe',locale:record.locale,readingMode:record.readingMode,audience:record.audience,context,sourceJob:id,body:context==='on'?structuredClone(body):off});
 }
 return jobs;
}
function acceptance(){return plan().filter(j=>j.variant==='candidate').map(j=>({...j,jobId:'recovery-'+j.jobId}));}
function normalCalls(j){return j.task==='probe'?1:j.task==='talk'?4:3;}
module.exports={withoutFoundation,probes,acceptance,normalCalls};
