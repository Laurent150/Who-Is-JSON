// Explicit, local-only live evaluation. Never started by the normal test suite.
// Credentials live only in memory; reports contain public case IDs and model replies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildRequest}=require('./live-bilingual-request.cjs');
const profile=process.env.WHO_EVAL_PROFILE||'ui';
if(!['ui','zh-stress'].includes(profile))throw Error('Invalid evaluation profile');
const runId=process.env.WHO_EVAL_RUN||'';if(runId&&!/^[a-z0-9-]+$/.test(runId))throw Error('Invalid run ID');
const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'.runtime/bilingual-corpus'),out=path.join(root,'.browser-artifacts',runId|| (profile==='ui'?'bilingual-live-ui':'bilingual-live'));
const manifestFile=process.env.WHO_EVAL_MANIFEST?path.resolve(process.env.WHO_EVAL_MANIFEST):path.join(dataDir,'manifest.json');
fs.mkdirSync(out,{recursive:true});
const nonce=crypto.randomBytes(24).toString('hex'),port=Number(process.env.WHO_EVAL_PORT||43148),apiPort=port+1;
let backend;
async function startBackend(){
 if(backend){const previous=backend;backend=null;await new Promise(resolve=>{if(previous.exitCode!==null)return resolve();previous.once('exit',resolve);previous.kill();});}
 localToken=undefined;
 backend=require('node:child_process').spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,env:{...process.env,CODELINGO_PORT:String(apiPort),WHO_CLOUD_DISABLED:'1'},windowsHide:true,stdio:'ignore'});
 backend.on('error',()=>{});
 for(let i=0;i<80;i++){try{const res=await fetch('http://127.0.0.1:'+apiPort+'/health');if(res.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 throw Error('Evaluation backend did not start');
}
process.on('exit',()=>backend?.kill());
let config=null,running=false,stopped=false,lastError='',active=[],calls=0;
const resultsFile=path.join(out,'results.jsonl');
const results=fs.existsSync(resultsFile)?fs.readFileSync(resultsFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const keyOf=j=>[j.id,j.locale,j.readingMode].join('|');
function manifest(){return JSON.parse(fs.readFileSync(manifestFile,'utf8'));}
function status(){let cases=[];try{cases=manifest().cases;}catch{}return {profile,connected:!!config,model:config?.model||'',running,stopped,lastError,active,calls,caseCount:cases.length,completed:results.length,successful:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,byPhase:Object.fromEntries(['development','holdout'].map(p=>[p,results.filter(r=>r.phase===p).length]))};}
let localToken;
async function api(route,payload,signal){
 if(!localToken){const text=await(await fetch('http://127.0.0.1:'+apiPort+'/config.js')).text();localToken=JSON.parse(text.match(/^window\.APP_TOKEN=("[a-f0-9]+");$/)[1]);}
 const response=await fetch('http://127.0.0.1:'+apiPort+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':localToken},body:JSON.stringify(payload),signal:signal||AbortSignal.timeout(270000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');if(data.aiOverviewError)throw Error(data.aiOverviewError);return data;
}
function compact(task,response){
 if(task==='overview')return {summary:response.aiOverview?.summary,blocks:response.blocks.filter(b=>b.aiExplanation).map(b=>({title:b.title,start:b.start,end:b.end,...b.aiExplanation}))};
 return response;
}
async function runJob(job){
 const {sample,locale,readingMode}=job,id=sample.id,label=[id,locale,readingMode].join('/');active.push(label);calls++;
 const started=Date.now(),record={id,profile,phase:sample.phase,task:sample.task,locale,readingMode,sourceHash:sample.sha256,model:config.model,startedAt:new Date().toISOString()};
 try{
  const bytes=fs.readFileSync(path.join(dataDir,sample.local));if(crypto.createHash('sha256').update(bytes).digest('hex')!==sample.sha256)throw Error('Source hash changed');
  const {route,payload}=buildRequest(sample,bytes.toString('utf8'),config,locale,readingMode,profile);
  record.response=compact(sample.task,await api(route,payload));record.ok=true;
 }catch(error){record.ok=false;record.error=error.message;lastError=error.message;stopped=true;}
 finally{record.durationMs=Date.now()-started;results.push(record);fs.appendFileSync(resultsFile,JSON.stringify(record)+'\n');active=active.filter(x=>x!==label);}
}
async function run(phase){
 if(running||!config)throw Error('Connect first, and wait for the current batch to finish');
 const plan=manifest(),done=new Set(results.map(keyOf));
 let jobs=plan.cases.filter(c=>phase==='pilot'?c.pilot:c.phase===phase).flatMap(sample=>['zh-CN','en'].flatMap(locale=>['beginner','standard'].map(readingMode=>({sample,locale,readingMode})))).filter(j=>!done.has(keyOf({id:j.sample.id,...j})));
 if(!jobs.length)throw Error('No pending cases in this batch');
 if(results.length+jobs.length>plan.cases.length*4)throw Error('Batch exceeds the selected manifest limit');
 running=true;stopped=false;lastError='';
 try{await startBackend();while(jobs.length&&!stopped){await Promise.all(jobs.splice(0,2).map(runJob));}}finally{running=false;}
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
http.createServer(async(req,res)=>{try{
 if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Local host required'});
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(__dirname,'live-bilingual.html'),'utf8').replaceAll('__NONCE__',nonce));}
 if(req.method==='GET'&&req.url==='/status')return json(res,200,status());
 if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+port||req.headers['x-evaluation-token']!==nonce)return json(res,403,{error:'Local form required'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Error('Request too large');}const body=JSON.parse(raw||'{}');
 if(req.url==='/connect'){if(running)throw Error('A batch is running');if(typeof body.key!=='string'||body.key.length<8)throw Error('请填写 API 密钥');config={base:'https://api.deepseek.com',model:'deepseek-flash',key:body.key};return json(res,200,status());}
 if(req.url==='/run'){if(!['pilot','development','holdout'].includes(body.phase))throw Error('Invalid phase');if(running||!config)throw Error('请先连接，或等待当前批次结束');void run(body.phase).catch(error=>{lastError=error.message;running=false;});return json(res,200,{ok:true});}
 if(req.url==='/stop'){stopped=true;return json(res,200,{ok:true});}
 if(req.url==='/disconnect'){stopped=true;if(running)throw Error('等待当前请求完成后再断开');config=null;return json(res,200,status());}
 return json(res,404,{error:'Not found'});
 }catch(error){json(res,400,{error:error.message});}}).listen(port,'127.0.0.1',()=>console.log('Live evaluation UI: http://127.0.0.1:'+port));
