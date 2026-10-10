// Manual, local-only paid evaluation. Starting/importing does not call a model.
// Key stays in memory. Logs contain fixed source, final prompts/prose and usage,
// never authorization headers, credentials or hidden reasoning text.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const cases=require('./ai-quality-cases.cjs');
const root=path.resolve(__dirname,'..'),port=Number(process.env.WHO_QUALITY_PORT||43176);
const out=path.resolve(root,'.browser-artifacts/ai-quality-20261002');
const variants=['baseline-trial','baseline-thinking','candidate-trial','candidate-thinking'];
function plan(input){
 const allowed={id:cases.map(c=>c.id),variant:['all',...variants],task:['talk','token','line'],locale:['en','zh-CN','both'],readingMode:['beginner','standard','both'],audience:['beginner','peer','review','all'],detail:['brief','standard','detailed'],coverage:['full','highlights']};
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!Object.hasOwn(allowed,k)))throw Error('Unknown evaluation setting');
 for(const [k,values]of Object.entries(allowed))if(!values.includes(input[k]))throw Error('Invalid '+k);
 const each=(v,list)=>v==='all'||v==='both'?list:[v];
 const jobs=each(input.variant,variants).flatMap(variant=>each(input.locale,['en','zh-CN']).flatMap(locale=>each(input.readingMode,['beginner','standard']).flatMap(readingMode=>(input.task==='talk'?each(input.audience,['beginner','peer','review']):['beginner']).map(audience=>({...input,variant,locale,readingMode,audience})))));
 if(jobs.length>6)throw Error('每批最多6份，请缩小组合范围。');
 return jobs;
}
function evaluationLimit(value){const limit=value===undefined?80:Number(value);if(!Number.isSafeInteger(limit)||limit<1||limit>90)throw Error('Evaluation limit must be an integer from 1 to 90');return limit;}
function baseline(){
 const cache=new Map(),snapshot=path.join(out,'baseline');
 if(!fs.existsSync(path.join(snapshot,'ai/ai-client.js')))throw Error('缺少修改前的本地快照，不能把当前版本标为旧版对照。');
 function load(file){
  const relative=path.relative(root,file),saved=path.join(snapshot,relative);
  if(!fs.existsSync(saved))return require(file);
  if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);cache.set(file,m);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  m.require=specifier=>{const resolved=Module._resolveFilename(specifier,m);return path.isAbsolute(resolved)&&resolved.startsWith(root+path.sep)?load(resolved):require(specifier);};
  m._compile(fs.readFileSync(saved,'utf8'),file);return m.exports;
 }
 return {talk:load(path.join(root,'ai/ai-talk.js')),client:load(path.join(root,'ai/ai-client.js')),knowledge:load(path.join(root,'ai/ai-knowledge.js'))};
}
function selectionPrompt(){
 // Read the application's own literal prompt via syntax; execute no source.
 const ts=require('typescript'),file=ts.createSourceFile('server.js',fs.readFileSync(path.join(root,'server.js'),'utf8'),ts.ScriptTarget.Latest,true);let found;
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(file)==='modelCall'&&node.arguments[0]?.getText(file)==='b.config'){
   const value=node.arguments[1]?.elements?.[0]?.properties?.find(p=>p.name?.getText(file)==='content')?.initializer;
   if(value&&ts.isStringLiteral(value))found=value.text;
  }
  ts.forEachChild(node,visit);
 }
 visit(file);if(!found)throw Error('Application selection prompt was not found');return found;
}
async function main(){
 const old=baseline();
 const candidate=()=>({talk:require('../ai/ai-talk'),client:require('../ai/ai-client'),knowledge:require('../ai/ai-knowledge')});
 let current=candidate();
 const askPrompt=selectionPrompt();
 const legacyPolicy=await import(require('node:url').pathToFileURL(path.join(out,'baseline/cloudbase/functions/ai-trial/policy.mjs')));
 const policy=await import('../cloudbase/functions/ai-trial/policy.mjs');
 fs.mkdirSync(out,{recursive:true});
 const resultsFile=path.join(out,'live-results.jsonl');
 const results=fs.existsSync(resultsFile)?fs.readFileSync(resultsFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const token=crypto.randomBytes(24).toString('hex');let key='',running=false,controller,dispatched=results.reduce((n,r)=>n+(r.traces?.length||0),0),lastError='';
 const limit=evaluationLimit(process.env.WHO_QUALITY_LIMIT);
 const status=()=>({connected:!!key,running,dispatched,limit,lastError,cases:cases.map(({id,name,oracle})=>({id,name,oracle})),results});
 async function job(j){
  const sample=cases.find(c=>c.id===j.id),baselineVariant=j.variant.startsWith('baseline'),thinking=j.variant.endsWith('thinking');
  const policyFiles=['ai/ai-client.js','ai/ai-talk.js','ai/ai-talk-contracts.js','ai/ai-review-patches.js','ai/ai-logic-policy.js','ai/ai-source-returns.js'];
  const policyRevision=crypto.createHash('sha256').update(policyFiles.map(f=>{const file=baselineVariant?path.join(out,'baseline',f):path.join(root,f);return fs.existsSync(file)?fs.readFileSync(file):'';}).join('\n')).digest('hex').slice(0,16);
  const modules=baselineVariant?old:current,traces=[],record={...j,policyRevision,sourceHash:crypto.createHash('sha256').update(sample.source).digest('hex'),oracle:sample.oracle,startedAt:new Date().toISOString(),transport:'official DeepSeek with local trial-policy emulation; NOT deployed CloudBase acceptance'};
  const options={locale:j.locale,readingMode:j.readingMode,signal:controller.signal,onUsage:u=>{if(traces.length)traces.at(-1).phase=u.phase;},onModelText:(text,phase)=>{if(traces.length)Object.assign(traces.at(-1),{phase,text});}};
  const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:thinking,sponsoredCall:async body=>{
   if(dispatched>=limit)throw Error('本会话的'+limit+'次模型请求上限已达到。');
   if(thinking&&baselineVariant){
    const contracts=body.messages[0]?.content.startsWith('Build a compact source-contract ledger');
    const review=body.messages[0]?.content.includes('REVIEW OUTPUT CONTRACT');
    if(contracts||review||j.task==='talk')body={...body,thinking:{type:'enabled'},reasoning_effort:contracts?'low':'high',max_tokens:j.task==='talk'?24576:16384};
   }
   const prepared=(thinking?policy:legacyPolicy).prepare(body),trace={request:prepared.body,phase:null,dispatchedAt:new Date().toISOString()};traces.push(trace);
   controller.signal.throwIfAborted();dispatched++;
   const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(prepared.body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});
   if(!response.ok){await response.body?.cancel();throw Error('DeepSeek HTTP '+response.status+'，本批已停止。');}
   const value=await response.json();trace.durationMs=Date.now()-Date.parse(trace.dispatchedAt);trace.model=value.model;trace.usage=value.usage;
   // Discard reasoning_content before returning or writing any provider response.
   return {model:value.model,usage:value.usage,choices:value.choices?.map(c=>({finish_reason:c.finish_reason,message:{role:c.message?.role,content:c.message?.content}}))};
  }};
  try{
   if(j.task==='talk')record.response=await modules.talk.generateTalk(sample.source,sample.name,{audience:j.audience,detail:j.detail,coverage:j.coverage},config,options);
   else if(j.task==='token'){
    const selectedToken=require('../ai/ai-flow').tokenSource(sample.source,sample.token);
    record.response=await modules.knowledge.explain(sample.source,selectedToken,config,{...options,name:sample.name});
   }else{
    const selectedSource=modules.client.selectedSource(sample.source,sample.selection);
    const question=require('./live-bilingual-request.cjs').questions[j.readingMode][j.locale];
    record.response={answer:await modules.client.modelCall(config,[{role:'system',content:askPrompt},{role:'user',content:JSON.stringify({filename:sample.name,sourceLanguage:require('../public/file-types').language(sample.name),source:sample.source,selectedSource,question})}],{...options,explanation:true})};
   }
   record.ok=true;
   record.languageWarning=j.locale==='en'&&/[\u3400-\u9fff]/.test(JSON.stringify(record.response));
  }catch(e){record.ok=false;record.error=e.message;lastError=e.message;}
  record.durationMs=Date.now()-Date.parse(record.startedAt);record.traces=traces;
  fs.appendFileSync(path.join(out,'live-results.jsonl'),JSON.stringify(record)+'\n');
  results.push(record);return record.ok;
 }
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Local host required'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'nonce-"+token+"'; style-src 'unsafe-inline'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(__dirname,'ai-quality.html'),'utf8').replaceAll('__NONCE__',token));}
  if(req.method==='GET'&&req.url==='/status')return json(res,200,status());
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:'+port||req.headers['x-evaluation-token']!==token)return json(res,403,{error:'Local form required'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Request too large');}let b;try{b=JSON.parse(raw||'{}');}catch{throw Error('请求内容格式不正确。');}
  if(req.url==='/connect'){if(running)throw Error('Wait for the current batch');if(typeof b.key!=='string'||b.key.length<8||b.key.length>255)throw Error('请在本地页面填写有效密钥。');key=b.key;return json(res,200,status());}
  if(req.url==='/disconnect'){if(running)throw Error('Stop and wait before disconnecting');key='';return json(res,200,status());}
  if(req.url==='/reload'){
   if(running)throw Error('Wait for the current batch');
   for(const file of Object.keys(require.cache))if(file.startsWith(root+path.sep)&&/^ai-.*\.js$/.test(path.basename(file)))delete require.cache[file];
   current=candidate();return json(res,200,status());
  }
  if(req.url==='/stop'){controller?.abort();return json(res,200,status());}
  if(req.url==='/run'){
   if(running||!key)throw Error('请连接服务并等待当前批次结束。');const jobs=plan(b);
   if(dispatched+jobs.length*(b.task==='talk'?5:3)>limit)throw Error('剩余请求预算不足，请缩小本批。');
   running=true;controller=new AbortController();lastError='';
   (async()=>{try{for(const j of jobs){if(controller.signal.aborted||!await job(j))break;}}finally{running=false;}})();
   return json(res,200,status());
  }
  json(res,404,{error:'Not found'});
 }catch(e){json(res,400,{error:e.message});}});
 server.listen(port,'127.0.0.1',()=>console.log('Local quality evaluation: http://127.0.0.1:'+port+' (no calls until connected and started)'));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={plan,selectionPrompt,evaluationLimit};
