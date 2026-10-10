// Local, explicit paid evaluation. Same persisted budget as the paused run.
// Probe -> offline diagnosis -> separately frozen acceptance; no automatic calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const design=require('./review-recovery-plan.cjs'),{cases}=require('./review-acceptance-cases.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/review-final-20261002');
const revision=path.join(out,'format-recovery'),PORT=43177,LIMIT=104;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const lines=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
function saveOnce(file,value){if(fs.existsSync(file)){if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(value))throw Error('Frozen evaluation changed: '+path.basename(file));}else fs.writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx'});return value;}
function hashes(files){return [...new Set(files)].sort().map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));}
function productionFiles(){return [...fs.readdirSync(path.join(root,'ai')).filter(f=>/^ai-.*\.js$/.test(f)).map(f=>'ai/'+f),'public/file-types.js','public/flow-model.js','public/knowledge-library.js','parsers/review-javascript.js','parsers/review-python.py','parsers/review-syntax.js'];}
function reserve(file,event){const events=lines(file);if(events.length>=LIMIT)throw Error('本轮104次请求上限已达到。');const saved={...event,ordinal:events.length+1};fs.appendFileSync(file,JSON.stringify(saved)+'\n');return saved;}
async function main(){
 fs.mkdirSync(revision,{recursive:true});
 const probeJobs=design.probes(lines(path.join(out,'acceptance-results.jsonl'))),jobs=design.acceptance();
 const harnessFiles=['tests/review-recovery-server.cjs','tests/review-recovery-plan.cjs','tests/review-acceptance-cases.cjs','tests/review-recovery.html','tests/ai-quality-server.cjs','tests/live-bilingual-request.cjs','ai/ai-talk-format.js'];
 const harness=saveOnce(path.join(revision,'probe-freeze.json'),{files:hashes(harnessFiles),probeJobs,limit:LIMIT,normalNewCalls:76,startingReservedCalls:25});
 const eventFile=path.join(out,'dispatches.jsonl'),resultFile=path.join(revision,'results.jsonl'),results=lines(resultFile),token=crypto.randomBytes(24).toString('hex');
 const frozenFile=path.join(revision,'acceptance-freeze.json');
 let stage=fs.existsSync(frozenFile)?'acceptance':'probe',frozen=fs.existsSync(frozenFile)?JSON.parse(fs.readFileSync(frozenFile,'utf8')):null;
 let key='',running=false,controller,lastError='',phase='',current;
 const pending=()=>{const attempted=new Set(lines(eventFile).map(e=>e.jobId));return(stage==='probe'?probeJobs:jobs).filter(j=>!attempted.has(j.jobId));};
 const status=()=>({stage,connected:!!key,running,dispatched:lines(eventFile).length,limit:LIMIT,completed:results.length,total:24,phase,lastError,remaining:pending().length,next:pending()[0]?.jobId||null,results:results.map(({jobId,id,task,locale,readingMode,audience,ok,error,traces,format,audit})=>({jobId,id,task,locale,readingMode,audience,ok,error,calls:traces.length,format,audit:audit?.verdict}))});
 function unchanged(){if(JSON.stringify(harness.files)!==JSON.stringify(hashes(harnessFiles)))throw Error('Frozen harness changed; testing is stopped.');if(stage==='acceptance'&&JSON.stringify(frozen.files)!==JSON.stringify(hashes(productionFiles())))throw Error('Frozen source changed; testing is stopped.');}
 function loadCandidate(){
  unchanged();
  // Only repository-owned application modules, never samples, can be loaded.
  for(const f of productionFiles())delete require.cache[require.resolve(path.join(root,f))];
  current={talk:require('../ai/ai-talk'),knowledge:require('../ai/ai-knowledge'),client:require('../ai/ai-client')};
 }
 if(stage==='acceptance')loadCandidate();
 async function run(job){
  unchanged();const traces=[],sample=cases.find(c=>c.id===job.id),{body:probeBody,...identity}=job;
  const record={...identity,stage,startedAt:new Date().toISOString(),sourceHash:sha(sample.source),transport:'Official DeepSeek API; not CloudBase acceptance',protocolRepairs:[]};
  const send=async(body,{signal})=>{
   unchanged();signal.throwIfAborted();
   const event=reserve(eventFile,{jobId:job.jobId,revision:'format-recovery',phase,at:new Date().toISOString()});
   const trace={request:body,phase,dispatchedAt:event.at};traces.push(trace);
   const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
   if(!response.ok){await response.body?.cancel();throw Error('DeepSeek HTTP '+response.status);}
   const data=await response.json();Object.assign(trace,{durationMs:Date.now()-Date.parse(event.at),usage:data.usage,model:data.model,text:data.choices?.[0]?.message?.content,finishReason:data.choices?.[0]?.finish_reason});
   return {model:data.model,usage:data.usage,choices:data.choices?.map(c=>({finish_reason:c.finish_reason,message:{role:c.message?.role,content:c.message?.content}}))};
  };
  const options={locale:job.locale,readingMode:job.readingMode,signal:controller.signal,onModelRequest:(_,p)=>{phase=p;},onProtocolRepair:r=>record.protocolRepairs.push(r),onFinalAudit:r=>record.audit=r};
  const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:send};
  try{
   if(job.task==='probe'){
    phase='composition-probe';const data=await send(probeBody,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});
    const choice=data.choices?.[0],raw=choice?.message?.content;
    if(choice?.finish_reason==='length')throw Error('Probe response was truncated');
    const parsed=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
    record.format={validJSON:true,questionsPresent:Object.hasOwn(parsed,'questions')};
    record.response=require('../ai/ai-talk-format').parse(raw,r=>record.protocolRepairs.push(r));record.format.normalizedValid=true;
   }else if(job.task==='talk')record.response=await current.talk.generateTalk(sample.source,sample.name,{audience:job.audience,detail:job.detail,coverage:job.coverage},config,options);
   else if(job.task==='token')record.response=await current.knowledge.explain(sample.source,require('../ai/ai-flow').tokenSource(sample.source,sample.token),config,{...options,name:sample.name});
   else record.response={answer:await current.client.modelCall(config,[{role:'system',content:require('./ai-quality-server.cjs').selectionPrompt()},{role:'user',content:JSON.stringify({filename:sample.name,sourceLanguage:require('../public/file-types').language(sample.name),source:sample.source,selectedSource:current.client.selectedSource(sample.source,sample.selection),question:require('./live-bilingual-request.cjs').questions[job.readingMode][job.locale]})}],{...options,explanation:true})};
   record.ok=true;
  }catch(error){record.ok=false;record.error=error.message;record.errorCode=error.code||null;lastError=error.message;}
  record.durationMs=Date.now()-Date.parse(record.startedAt);record.traces=traces;fs.appendFileSync(resultFile,JSON.stringify(record)+'\n');results.push(record);return record;
 }
 const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:'+PORT)return json(res,403,{error:'Local host required'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+token+"'; style-src 'unsafe-inline'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(__dirname,'review-recovery.html'),'utf8').replaceAll('__NONCE__',token));}
  if(req.method==='GET'&&req.url==='/status')return json(res,200,status());
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+PORT||req.headers['x-evaluation-token']!==token)return json(res,403,{error:'页面已过期，请刷新测试页。'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}const b=JSON.parse(raw||'{}');
  if(req.url==='/stop'){controller?.abort();return json(res,200,status());}
  if(running)throw Error('请等待当前测试结束。');
  if(req.url==='/connect'){if(typeof b.key!=='string'||b.key.length<8||b.key.length>255)throw Error('请在本地页面填写有效密钥。');key=b.key;lastError='';return json(res,200,status());}
  if(req.url==='/disconnect'){key='';return json(res,200,status());}
  if(req.url==='/acceptance'){
   unchanged();if(stage!=='probe'||pending().length||results.filter(r=>r.task==='probe').length!==4)throw Error('请先完成并检查4次格式对照。');
   frozen=saveOnce(frozenFile,{files:hashes(productionFiles()),jobs,limit:LIMIT,model:'deepseek-flash',evaluation:'All 20 candidate configurations, separate from the paused revision. No new baseline pairs.'});
   stage='acceptance';loadCandidate();lastError='';return json(res,200,status());
  }
  if(req.url==='/next'){
   if(!key)throw Error('请先连接。');unchanged();const next=pending()[0];if(!next)throw Error('当前阶段已结束。');
   if(lines(eventFile).length+design.normalCalls(next)>LIMIT)throw Error('剩余额度不足以完成下一项的正常请求；不会提高104次上限。');
   running=true;controller=new AbortController();lastError='';void run(next).catch(e=>{lastError=e.message;}).finally(()=>{running=false;phase='';});return json(res,200,status());
  }
  return json(res,404,{error:'Not found'});
 }catch(error){json(res,400,{error:error.message});}});
 server.listen(PORT,'127.0.0.1',()=>console.log('Format recovery: http://127.0.0.1:'+PORT+'; original 104-call budget; no automatic dispatch.'));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={reserve,saveOnce,productionFiles};
