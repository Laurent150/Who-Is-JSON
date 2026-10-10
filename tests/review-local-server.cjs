// Explicitly authorized, local-only pilot. No automatic dispatch; keys remain
// in process memory. Importing this file cannot start a server or model call.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const design=require('./review-local-pilot.cjs'),audit=require('../ai/ai-final-audit');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/review-local-edit-20261002'),PORT=43178;
const lines=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
function reserve(file,event){
 const events=lines(file);if(!design.canReserve(events,event.phase))throw Error('已达到本轮36次总上限或4次格式修复上限。');
 const saved={...event,ordinal:events.length+1};fs.appendFileSync(file,JSON.stringify(saved)+'\n');return saved;
}
async function main(){
 if(process.argv[2]!=='--authorized-limit=36')throw Error('尚未提供本轮新增36次请求的明确授权启动参数。');
 process.env.WHO_TALK_EVAL_TRACE='1';process.env.WHO_CLOUD_DISABLED='1';
 const plan=JSON.parse(fs.readFileSync(path.join(out,'pilot-plan.json'),'utf8')),freeze=JSON.parse(fs.readFileSync(path.join(out,'pilot-freeze.json'),'utf8'));
 const eventsFile=path.join(out,'dispatches.jsonl'),resultsFile=path.join(out,'pilot-results.jsonl'),stageFile=path.join(out,'audit-stage.json');
 const token=crypto.randomBytes(24).toString('hex');
 let key='',running=false,controller,lastError='',phase='',stage=fs.existsSync(stageFile)?'audit':'editor';
 function unchanged(){for(const f of freeze.files)if(design.hash(fs.readFileSync(path.join(root,f.file)))!==f.sha256)throw Error('冻结版本已变更，测试已停止。');}
 function pending(){
  const attempted=new Set(lines(eventsFile).map(e=>e.jobId));
  if(stage==='editor')return plan.jobs.filter(j=>!attempted.has(j.jobId));
  return lines(resultsFile).filter(r=>r.stage==='editor'&&r.ok).map(r=>({jobId:'audit-'+r.jobId,editor:r,job:plan.jobs.find(j=>j.jobId===r.jobId)})).filter(j=>!attempted.has(j.jobId));
 }
 function status(){return {stage,connected:!!key,running,phase,lastError,dispatched:lines(eventsFile).length,limit:design.LIMIT,repairs:lines(eventsFile).filter(e=>e.phase==='repair').length,remaining:pending().length,next:pending()[0]?.jobId||null,results:lines(resultsFile).map(({jobId,stage,ok,error,calls,auditVerdict})=>({jobId,stage,ok,error,calls,auditVerdict}))};}
 async function run(job){
  const record={jobId:job.jobId,stage,startedAt:new Date().toISOString(),traces:[]};
  async function send(body,kind){
   unchanged();controller.signal.throwIfAborted();phase=kind;
   const event=reserve(eventsFile,{jobId:job.jobId,phase:kind,at:new Date().toISOString()});
   const trace={phase:kind,request:body,at:event.at};record.traces.push(trace);
   const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(240000)])});
   if(!response.ok){await response.body?.cancel();throw Error('DeepSeek HTTP '+response.status);}
   let data;try{data=await response.json();}catch{throw Error('模型接口未返回完整JSON。');}
   const choice=data.choices?.[0];Object.assign(trace,{text:choice?.message?.content,finishReason:choice?.finish_reason,usage:data.usage,model:data.model,durationMs:Date.now()-Date.parse(event.at)});
   if(choice?.finish_reason==='length')throw Error('模型响应达到长度上限，停止本项。');
   if(typeof trace.text!=='string'||!trace.text.trim())throw Error('模型未返回有效文字。');
   return trace.text;
  }
  try{
   if(stage==='editor'){
    record.variant=job.variant;record.sourceJob=job.sourceJob;record.repeat=job.repeat;record.draftHash=job.draftHash;
    const text=await send(job.body,'review');
    try{record.candidate=design.apply(job,text);}catch(error){
     if(error.code!=='AI_REVIEW_PROTOCOL')throw error;
     record.candidate=design.apply(job,await send(design.repairBody(job),'repair'));
    }
    record.candidateHash=design.hash(record.candidate);
   }else{
    const request=design.auditRequest(job.job,job.editor.candidate);
    record.editorJob=job.editor.jobId;record.candidateHash=design.hash(job.editor.candidate);
    const result=audit.validate(await send(request.body,'final-audit'),request.input);
    record.audit=result;record.auditVerdict=result.verdict;
   }
   record.ok=true; // transport/protocol success only, never a quality verdict
  }catch(error){record.ok=false;record.error=error.message;record.errorCode=error.code||null;lastError=error.message;}
  record.calls=record.traces.length;record.durationMs=Date.now()-Date.parse(record.startedAt);
  fs.appendFileSync(resultsFile,JSON.stringify(record)+'\n');
 }
 unchanged();
 const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:'+PORT)return json(res,403,{error:'Local host required'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+token+"'; style-src 'unsafe-inline'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(__dirname,'review-local.html'),'utf8').replaceAll('__NONCE__',token));}
  if(req.method==='GET'&&req.url==='/status')return json(res,200,status());
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+PORT||req.headers['x-evaluation-token']!==token)return json(res,403,{error:'页面已过期，请刷新测试页。'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}const body=JSON.parse(raw||'{}');
  if(req.url==='/stop'){controller?.abort();return json(res,200,status());}
  if(running)throw Error('请等待当前项完成。');
  if(req.url==='/connect'){if(typeof body.key!=='string'||body.key.length<8||body.key.length>255)throw Error('请在本地填写有效密钥。');key=body.key;lastError='';return json(res,200,status());}
  if(req.url==='/disconnect'){key='';return json(res,200,status());}
  if(req.url==='/audit'){
   unchanged();if(stage!=='editor'||pending().length)throw Error('先完成并评估固定的编辑对照，再开启独立终审对照。');
   fs.writeFileSync(stageFile,JSON.stringify({enabledAt:new Date().toISOString()}),{flag:'wx'});stage='audit';return json(res,200,status());
  }
  if(req.url==='/next'){
   if(!key)throw Error('请先连接。');unchanged();const job=pending()[0];if(!job)throw Error('本阶段已结束。');
   if(!design.canReserve(lines(eventsFile),stage==='editor'?'review':'final-audit'))throw Error('本轮请求预算已用完。');
   running=true;controller=new AbortController();lastError='';void run(job).catch(error=>{lastError=error.message;}).finally(()=>{running=false;phase='';});return json(res,200,status());
  }
  return json(res,404,{error:'Not found'});
 }catch(error){json(res,400,{error:error.message});}});
 server.listen(PORT,'127.0.0.1',()=>console.log('Local editor pilot: http://127.0.0.1:'+PORT+'; authorized cap 36; no automatic dispatch.'));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={reserve};
