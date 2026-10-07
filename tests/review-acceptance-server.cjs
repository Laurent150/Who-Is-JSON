// Explicit local paid acceptance, fixed plan and hard persisted request budget.
// Starting/importing/connecting does not dispatch model requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),Module=require('node:module');
const {cases,plan}=require('./review-acceptance-cases.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/review-final-20261002');
const LIMIT=104,PORT=43177,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function normalCalls(job){return (job.task==='talk'?3:2)+(job.variant==='candidate'?1:0);}
function maxCalls(job){return normalCalls(job)+(job.task==='talk'?2:1);}
function validatePlan(jobs){
 if(jobs.length!==28||jobs.filter(j=>j.variant==='candidate').length!==20||jobs.reduce((n,j)=>n+normalCalls(j),0)!==92||new Set(jobs.map(j=>j.jobId)).size!==jobs.length)throw Error('Acceptance plan changed; review budget and design first');
 for(const job of jobs)if(!cases.some(c=>c.id===job.id))throw Error('Unknown sample');
 return jobs;
}
function frozenFiles(){
 const production=fs.readdirSync(root).filter(f=>/^ai-.*\.js$/.test(f));
 const files=[...production,'server.js','public/file-types.js','public/flow-model.js','public/knowledge-library.js','parsers/review-javascript.js','parsers/review-python.py','parsers/review-syntax.js','tests/review-acceptance-cases.cjs','tests/review-acceptance-server.cjs','tests/ai-quality-server.cjs','tests/live-bilingual-request.cjs'];
 const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline/manifest.json'),'utf8').replace(/^\uFEFF/,''));
 for(const f of baseline.files){
  const p=path.join(out,'baseline',f.path);if(sha(fs.readFileSync(p))!==f.sha256)throw Error('Baseline snapshot changed: '+f.path);
  files.push(path.relative(root,p));
 }
 return files.sort().map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
}
function freeze(){
 const file=path.join(out,'freeze.json'),files=frozenFiles(),jobs=validatePlan(plan());
 const record={files,jobs,samples:cases.map(c=>({id:c.id,name:c.name,sha256:sha(c.source),oracle:c.oracle})),limit:LIMIT,normalCalls:92,model:'deepseek-flash',baseline:'Steps 1-3 working tree; before steps 4-5',candidate:'Steps 1-5 working tree',createdAt:new Date().toISOString()};
 if(fs.existsSync(file)){
  const old=JSON.parse(fs.readFileSync(file,'utf8'));
  if(JSON.stringify(old.files)!==JSON.stringify(files)||JSON.stringify(old.jobs)!==JSON.stringify(jobs))throw Error('Frozen source or plan changed; do not mix evaluation revisions');
  return old;
 }
 fs.writeFileSync(file,JSON.stringify(record,null,2),{flag:'wx'});return record;
}
function baseline(){
 const cache=new Map();
 function load(file){
  const relative=path.relative(root,file),saved=path.join(out,'baseline',relative);
  if(!fs.existsSync(saved))return require(file);
  if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);cache.set(file,m);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  m.require=specifier=>{const resolved=Module._resolveFilename(specifier,m);return path.isAbsolute(resolved)&&resolved.startsWith(root+path.sep)?load(resolved):require(specifier);};
  m._compile(fs.readFileSync(saved,'utf8'),file);return m.exports;
 }
 return {talk:load(path.join(root,'ai-talk.js')),knowledge:load(path.join(root,'ai-knowledge.js')),client:load(path.join(root,'ai-client.js'))};
}
function readLines(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];}
function infrastructureRetry(results,jobId){
 const prior=results.filter(r=>r.jobId===jobId);
 // One retry only for the observed local permission denial, before any model
 // response. Keep both records and every reserved dispatch in the same budget.
 return prior.length===1&&prior[0].error==='应用进程没有访问 AI 服务的网络权限。请从正常终端启动应用，并检查防火墙或运行环境限制。'&&prior[0].traces.length===1&&!prior[0].traces[0].text&&!prior[0].traces[0].model;
}
async function main(){
 const frozen=freeze(),jobs=frozen.jobs,old=baseline();
 const current={talk:require('../ai-talk'),knowledge:require('../ai-knowledge'),client:require('../ai-client')};
 const askPrompt=require('./ai-quality-server.cjs').selectionPrompt();
 const eventsFile=path.join(out,'dispatches.jsonl'),resultsFile=path.join(out,'acceptance-results.jsonl');
 const events=readLines(eventsFile),results=readLines(resultsFile),token=crypto.randomBytes(24).toString('hex');
 // Reserve before sending so a crash cannot reset paid request accounting.
 const attempted=new Set([...events,...results].map(e=>e.jobId));
 let key='',running=false,controller,lastError='',phase='';
 const pending=()=>jobs.filter(j=>!attempted.has(j.jobId)||infrastructureRetry(results,j.jobId));
 const status=()=>({connected:!!key,running,dispatched:events.length,limit:LIMIT,completed:new Set(results.filter(r=>!infrastructureRetry(results,r.jobId)).map(r=>r.jobId)).size,total:jobs.length,phase,lastError,remaining:pending().length,next:pending()[0]||null,results:results.map(r=>({jobId:r.jobId,id:r.id,variant:r.variant,task:r.task,locale:r.locale,readingMode:r.readingMode,audience:r.audience,ok:r.ok,error:r.error,calls:r.traces.length,audit:r.audit?.verdict}))});
 function unchanged(){if(JSON.stringify(frozen.files)!==JSON.stringify(frozenFiles()))throw Error('Frozen source changed; testing is stopped.');}
 async function job(j){
  unchanged();const sample=cases.find(c=>c.id===j.id),modules=j.variant==='baseline'?old:current,traces=[];
  const record={...j,attempt:results.filter(r=>r.jobId===j.jobId).length+1,startedAt:new Date().toISOString(),sourceHash:sha(sample.source),transport:'Official DeepSeek API, direct connection; not CloudBase acceptance',oracle:sample.oracle};
  const options={locale:j.locale,readingMode:j.readingMode,signal:controller.signal,
   onModelRequest:(_,p)=>{phase=p;},onModelText:(text,p)=>{if(traces.length)Object.assign(traces.at(-1),{text,phase:p});},onFinalAudit:r=>record.audit=r};
  const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async(body,{signal})=>{
   unchanged();if(events.length>=LIMIT)throw Error('本轮104次请求上限已达到。');
   signal.throwIfAborted();const event={jobId:j.jobId,ordinal:events.length+1,phase,at:new Date().toISOString()};
   fs.appendFileSync(eventsFile,JSON.stringify(event)+'\n');events.push(event);attempted.add(j.jobId);
   const trace={phase,request:body,dispatchedAt:event.at};traces.push(trace);
   const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
   trace.durationMs=Date.now()-Date.parse(event.at);
   if(!r.ok){await r.body?.cancel();throw Error('DeepSeek HTTP '+r.status);}
   const v=await r.json();trace.usage=v.usage;trace.model=v.model;
   return {model:v.model,usage:v.usage,choices:v.choices?.map(c=>({finish_reason:c.finish_reason,message:{role:c.message?.role,content:c.message?.content}}))};
  }};
  try{
   if(j.task==='talk')record.response=await modules.talk.generateTalk(sample.source,sample.name,{audience:j.audience,detail:j.detail,coverage:j.coverage},config,options);
   else if(j.task==='token')record.response=await modules.knowledge.explain(sample.source,require('../ai-flow').tokenSource(sample.source,sample.token),config,{...options,name:sample.name});
   else record.response={answer:await modules.client.modelCall(config,[{role:'system',content:askPrompt},{role:'user',content:JSON.stringify({filename:sample.name,sourceLanguage:require('../public/file-types').language(sample.name),source:sample.source,selectedSource:modules.client.selectedSource(sample.source,sample.selection),question:require('./live-bilingual-request.cjs').questions[j.readingMode][j.locale]})}],{...options,explanation:true})};
   record.ok=true;
  }catch(e){record.ok=false;record.error=e.message;record.errorCode=e.code||null;lastError=e.message;}
  record.durationMs=Date.now()-Date.parse(record.startedAt);record.traces=traces;
  fs.appendFileSync(resultsFile,JSON.stringify(record)+'\n');results.push(record);attempted.add(j.jobId);
  return record;
 }
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:'+PORT)return json(res,403,{error:'Local host required'});
  if(req.method==='GET'&&req.url==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+token+"'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
   return res.end(fs.readFileSync(path.join(__dirname,'review-acceptance.html'),'utf8').replaceAll('__NONCE__',token));
  }
  if(req.method==='GET'&&req.url==='/status')return json(res,200,status());
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+PORT||req.headers['x-evaluation-token']!==token)return json(res,403,{error:'页面已过期，请刷新测试页。'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}const b=JSON.parse(raw||'{}');
  if(req.url==='/connect'){if(running)throw Error('请等待当前测试结束。');if(typeof b.key!=='string'||b.key.length<8||b.key.length>255)throw Error('请在本地页面填写有效密钥。');key=b.key;lastError='';return json(res,200,status());}
  if(req.url==='/disconnect'){if(running)throw Error('请先停止并等待当前测试结束。');key='';return json(res,200,status());}
  if(req.url==='/stop'){controller?.abort();return json(res,200,status());}
  if(req.url==='/next'){
   if(running||!key)throw Error('请先连接并等待当前测试结束。');unchanged();
   const next=pending()[0];if(!next)throw Error('固定计划已结束。');
   if(events.length+maxCalls(next)>LIMIT)throw Error('剩余额度不足以完整完成下一项。');
   running=true;controller=new AbortController();lastError='';
   void job(next).catch(e=>{lastError=e.message;}).finally(()=>{running=false;phase='';});
   return json(res,200,status());
  }
  json(res,404,{error:'Not found'});
 }catch(e){json(res,400,{error:e.message});}});
 server.listen(PORT,'127.0.0.1',()=>console.log('Frozen acceptance: http://127.0.0.1:'+PORT+'; 0 dispatches until explicitly started.'));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={normalCalls,maxCalls,validatePlan,freeze,infrastructureRetry};
