// Manual, localhost-only evaluation. Not run by automated tests.
// Only the user's explicitly submitted key is used; it stays in process memory.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const choices={audience:['all','beginner','peer','review'],locale:['zh-CN','en'],readingMode:['beginner','standard'],detail:['brief','standard','detailed'],coverage:['full','highlights']};
function plan(body,cases){
 for(const [key,values]of Object.entries(choices))if(!values.includes(body[key]))throw Error('Invalid '+key);
 if(!Array.isArray(body.samples)||body.samples.length<1||body.samples.length>2||new Set(body.samples).size!==body.samples.length||body.samples.some(id=>!cases.some(c=>c.id===id)))throw Error('Invalid samples');
 const pipeline=body.pipeline||'direct';if(!['direct','contracts'].includes(pipeline))throw Error('Invalid pipeline');
 const audiences=body.audience==='all'?choices.audience.slice(1):[body.audience];
 return body.samples.flatMap(id=>audiences.map(audience=>({id,audience,pipeline,locale:body.locale,readingMode:body.readingMode,detail:body.detail,coverage:body.coverage})));
}
async function main(){
 const port=Number(process.env.WHO_TALK_EVAL_PORT||43154),apiPort=port+1;
 const manifestPath=path.resolve(process.env.WHO_TALK_EVAL_MANIFEST||path.join(root,'.browser-artifacts/talk-tuning/cases.json'));
 let cases=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const refreshCases=()=>{if(!running)cases=JSON.parse(fs.readFileSync(manifestPath,'utf8'));};
 const out=path.resolve(process.env.WHO_TALK_EVAL_OUTPUT||path.join(root,'.browser-artifacts/talk-tuning'));fs.mkdirSync(out,{recursive:true});
 const limit=Number(process.env.WHO_TALK_EVAL_LIMIT||36);if(!Number.isInteger(limit)||limit<1||limit>120)throw Error('Invalid session limit');
 const nonce=crypto.randomBytes(24).toString('hex');
 let config=null,backend,localToken,running=false,controller,stopped=false,count=0,lastError='';
 const resultPath=path.join(out,'results.jsonl');
 const results=fs.existsSync(resultPath)?fs.readFileSync(resultPath,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[],usage=[];count=results.length;
 function state(){refreshCases();return {connected:!!config,running,stopped,count,limit,lastError,results,cases:cases.map(({id,label})=>({id,label}))};}
 function source(sample){const bytes=fs.readFileSync(path.resolve(root,sample.path));if(crypto.createHash('sha256').update(bytes).digest('hex')!==sample.sha256)throw Error('Sample hash mismatch');return bytes.toString('utf8');}
 async function startBackend(pipeline){
  if(backend&&backend.exitCode===null){const previous=backend;await new Promise(resolve=>{previous.once('exit',resolve);previous.kill();});}
  backend=require('node:child_process').spawn(process.execPath,['--use-env-proxy',path.join(root,'server.js')],{cwd:root,env:{...process.env,CODELINGO_PORT:String(apiPort),WHO_CLOUD_DISABLED:'1',WHO_TALK_PIPELINE:pipeline,WHO_TALK_EVAL_TRACE:'1'},windowsHide:true,stdio:'ignore'});
  backend.on('error',()=>{});
  for(let i=0;i<80;i++){
   try{const r=await fetch('http://127.0.0.1:'+apiPort+'/config.js');if(r.ok){const match=(await r.text()).match(/^window\.APP_TOKEN=("[a-f0-9]+");$/);if(match){localToken=JSON.parse(match[1]);return;}}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Test backend did not start');
 }
 const revision=()=>crypto.createHash('sha256').update(['ai/ai-client.js','ai/ai-talk.js','ai/ai-talk-policy.js','ai/ai-talk-audience.js','ai/ai-english.js','ai/ai-grounding-checks.js','ai/ai-review-patches.js','ai/ai-talk-contracts.js','ai/ai-talk-async.js'].filter(f=>fs.existsSync(path.join(root,f))).map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')).digest('hex').slice(0,16);
 async function run(jobs){
  running=true;stopped=false;lastError='';
  try{
   await startBackend(jobs[0].pipeline);const policyRevision=revision();
   for(const job of jobs){
    if(stopped)break;
    const sample=cases.find(c=>c.id===job.id),record={...job,policyRevision,sourceHash:sample.sha256,model:'deepseek-flash',startedAt:new Date().toISOString()};count++;
    controller=new AbortController();const start=Date.now();
    try{
     const code=source(sample);
     const response=await fetch('http://127.0.0.1:'+apiPort+'/api/talk',{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':localToken},body:JSON.stringify({code,name:sample.label,config,locale:job.locale,readingMode:job.readingMode,options:{audience:job.audience,detail:job.detail,coverage:job.coverage}}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(420000)])});
     const body=await response.json();if(!response.ok){if(body.usage)record.usage=body.usage;throw Error(body.error||'Generation failed');}
     record.ok=true;record.response=body;if(body.usage)usage.push(body.usage);
    }catch(error){record.ok=false;record.error=controller.signal.aborted?'Stopped':String(error.message);lastError=record.error;stopped=true;}
    finally{record.durationMs=Date.now()-start;controller=null;results.push(record);fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(record)+'\n');}
   }
  }catch(error){lastError=String(error.message);stopped=true;}finally{running=false;}
 }
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Local host required'});
   if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; connect-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});return res.end(fs.readFileSync(path.join(__dirname,'talk-eval.html'),'utf8').replaceAll('__NONCE__',nonce));}
   if(req.method==='GET'&&req.url==='/status')return json(res,200,state());
   if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+port||req.headers['x-evaluation-token']!==nonce)return json(res,403,{error:'Local form required'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Error('Request too large');}const body=JSON.parse(raw||'{}');
   if(req.url==='/connect'){if(running)throw Error('Wait for this batch');if(typeof body.key!=='string'||body.key.trim().length<8)throw Error('请填写密钥');config={base:'https://api.deepseek.com',model:'deepseek-flash',key:body.key.trim()};return json(res,200,state());}
   if(req.url==='/run'){if(!config||running)throw Error('请先连接，或等待当前批次结束');refreshCases();const jobs=plan(body,cases);if(count+jobs.length>limit)throw Error('本会话已到'+limit+'次生成上限，停止新增请求');void run(jobs);return json(res,200,{ok:true});}
   if(req.url==='/stop'){stopped=true;controller?.abort();return json(res,200,{ok:true});}
   if(req.url==='/disconnect'){if(running)throw Error('请先停止生成');config=null;return json(res,200,state());}
   return json(res,404,{error:'Not found'});
  }catch(error){json(res,400,{error:String(error.message)});}
 });
 process.on('exit',()=>backend?.kill());
 server.listen(port,'127.0.0.1',()=>console.log('Talk evaluation: http://127.0.0.1:'+port));
}
if(require.main===module)main().catch(()=>{console.error('Evaluation setup failed');process.exitCode=1;});
module.exports={plan};
