const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const diagnostics=require('../ai-diagnostics');
const requestId='b3677a72-cad2-4f7d-934f-794d6d608bd5';
const env={FIMI_ALLOW_LEGACY_RAW:'1', CLOUDBASE_ENV_ID:'fimi-test-env',CLOUDBASE_SERVICE_ROLE_KEY:'private-service',DEEPSEEK_API_KEY:'private-model'};
const usage={prompt_tokens:10,completion_tokens:5};

test('failure metadata is allowlisted and excludes credentials, source and raw errors',()=>{
 const input={code:'trial_provider_timeout',stage:'provider-request',aiPhase:'composition',requestId,
  providerStatus:200,elapsedMs:110000,settlement:'pending',key:'secret',headers:{Authorization:'secret'},source:'private-source',message:'private-error'};
 assert.deepEqual(diagnostics.safe(input),{code:input.code,stage:input.stage,aiPhase:input.aiPhase,requestId,providerStatus:200,elapsedMs:110000,settlement:'pending'});
 assert.deepEqual(diagnostics.safe({code:'private-error',stage:'private-source',aiPhase:'private-key',requestId:'Bearer secret',providerStatus:999,elapsedMs:Infinity,settlement:'invented'}),{});
 const log=[];const result=diagnostics.report(diagnostics.attach(Error('private-error'),input),x=>log.push(x));
 assert.deepEqual(result.diagnostics,diagnostics.safe(input));
 assert.doesNotMatch(log.join(''),/secret|private|headers|source|message/);
 assert.deepEqual(diagnostics.report(Error('ordinary'),()=>assert.fail('no diagnostic record')),{});
 assert.doesNotThrow(()=>diagnostics.report(diagnostics.attach(Error(),input),()=>{throw Error('logger offline');}));
});

for(const [mode,code,stage,settlement] of [
 ['timeout','trial_provider_timeout','provider-request','pending'],
 ['body-timeout','trial_provider_timeout','provider-response','pending'],
 ['connection','trial_provider_connection','provider-request','pending'],
 ['http','trial_provider_http','provider-response','pending'],
 ['json','trial_provider_response','provider-response','pending'],
 ['usage','trial_usage_invalid','usage-validation','pending'],
 ['settlement','trial_settlement_failed','settlement','unknown'],
 ['settlement-ack','trial_settlement_failed','settlement','unknown'],
 ['content','trial_invalid_content','content-validation','confirmed']
])test('trial distinguishes '+mode+' and refunds the failed call without retrying generation',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');
 let time=1000;const calls=[],logs=[];
 const handle=createHandler({env,now:()=>time,logger:entry=>logs.push(entry),fetcher:async(url,options)=>{
  calls.push({url,body:options.body&&JSON.parse(options.body)});
  if(url.endsWith('/user/me'))return Response.json({sub:'private-subject',email:'private@example.com'});
  if(url.endsWith('/fimi_ai_reserve'))return Response.json({ok:true});
  if(url.endsWith('/fimi_ai_refund_request'))return Response.json({ok:true,state:'refunded'});
  if(url.endsWith('/fimi_ai_settle')){
   if(mode==='settlement')throw Error('private-settlement-error');
   return Response.json({ok:mode!=='settlement-ack'});
  }
  assert.equal(url,'https://api.deepseek.com/chat/completions');time=111000;
  if(mode==='timeout')throw new DOMException('private-error','TimeoutError');
  if(mode==='connection')throw Error('private-network-error');
  if(mode==='http')return new Response('private-upstream-body',{status:429});
  if(mode==='json')return new Response('private-invalid-json',{status:200});
  if(mode==='body-timeout')return {ok:true,status:200,json:async()=>{throw new DOMException('private-body-error','TimeoutError');}};
  return Response.json({choices:[{message:{content:mode==='content'?null:'private-model-prose',reasoning_content:'private-reasoning'}}],usage:mode==='usage'?{}:usage});
 }});
 const response=await handle(new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer private-user'},body:JSON.stringify({messages:[{role:'user',content:'private-source'}],max_tokens:100})}));
 assert.equal(response.status,502);const body=await response.json();
 assert.equal(body.diagnostics.code,code);assert.equal(body.diagnostics.stage,stage);
 assert.equal(body.diagnostics.settlement,'refunded');assert.equal(body.diagnostics.elapsedMs,110000);
 assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(logs.length,1);assert.equal(logs[0].requestId,body.requestId);
 assert.equal(calls.filter(c=>c.url.includes('api.deepseek.com')).length,1);
 const settlements=calls.filter(c=>c.url.endsWith('/fimi_ai_settle'));
 assert.equal(settlements.length,['settlement','settlement-ack'].includes(mode)?1:0);
 assert.equal(calls.filter(c=>c.url.endsWith('/fimi_ai_refund_request')).length,1);
 if(settlements.length){assert.equal(settlements[0].body.cost,60);assert.equal(logs[0].computedCost,60);}
 assert.doesNotMatch(JSON.stringify({logs,body}),/private-|private@|Authorization|reasoning_content/);
});

async function localAccount(reply){
 const {createCloudBaseAccount}=require('../cloudbase-account');let trialCalls=0;
 const account=createCloudBaseAccount({env:{WHO_CLOUDBASE_ENV_ID:'fimi-test-env',WHO_CLOUDBASE_TRIAL_ENABLED:'1',WHO_CLOUDBASE_TRIAL_URL:'https://trial.example/trial'},fetcher:async(url)=>{
  if(url==='https://trial.example/trial'){trialCalls++;return reply();}
  if(url.endsWith('/verification'))return Response.json({verification_id:'flow',expires_in:300,is_user:true});
  if(url.endsWith('/verification/verify'))return Response.json({verification_token:'private-verification'});
  if(url.endsWith('/signin'))return Response.json({access_token:'private-access',sub:'user',expires_in:3600});
  if(url.endsWith('/user/me'))return Response.json({sub:'user',email:'user@example.com'});
  throw Error('unexpected request');
 }});
 const flow=await account.handle({},'email-start',{email:'user@example.com'});
 const login=await account.handle({},'email-verify',{ticket:flow.ticket,code:'123456'});
 const req={headers:{'x-who-session':login.session}};
 return {account,req,config:account.trialConfig(req),count:()=>trialCalls};
}

test('gateway error keeps the request ID and AI phase through the local model boundary',async()=>{
 const s=await localAccount(()=>Response.json({error:'private-upstream-message',requestId,diagnostics:{code:'trial_settlement_failed',stage:'settlement',settlement:'unknown',providerStatus:200,elapsedMs:70000,key:'private-secret'}},{status:502}));
 await assert.rejects(require('../ai-client').modelCall(s.config,[],{usagePhase:'composition'}),error=>{
  assert.match(error.message,/结算未确认/);assert.deepEqual(error.diagnostics,{code:'trial_settlement_failed',stage:'settlement',aiPhase:'composition',requestId,providerStatus:200,elapsedMs:70000,settlement:'unknown'});
  assert.doesNotMatch(JSON.stringify(error),/private-/);return true;
 });
 assert.equal(s.count(),1);
});

test('old gateways retain their legacy message while preserving a valid request ID',async()=>{
 const s=await localAccount(()=>Response.json({error:'AI 调用未完成，预留额度待核对，请勿反复重试。',requestId},{status:502}));
 await assert.rejects(s.config.sponsoredCall({}),error=>{
  assert.equal(error.message,'AI 调用未完成，预留额度待核对，请勿反复重试。');assert.deepEqual(error.diagnostics,{requestId});return true;
 });assert.equal(s.count(),1);
});

test('local transport failures are distinct and quota reads never imply a paid reservation',async()=>{
 for(const [reply,code] of [
  [()=>{throw new DOMException('private-timeout','TimeoutError');},'trial_gateway_timeout'],
  [()=>{throw Error('private-network');},'trial_gateway_connection'],
  [()=>new Response('private-bad-json',{status:502}),'trial_gateway_response']
 ]){
  const s=await localAccount(reply);
  await assert.rejects(s.account.handle(s.req,'trial-quota'),error=>error.message==='额度服务暂时不可用。'&&error.diagnostics.code===code&&!error.diagnostics.settlement);
  await assert.rejects(s.config.sponsoredCall({}),error=>error.diagnostics.code===code&&error.diagnostics.settlement==='unknown');
  assert.equal(s.count(),3); // Two idempotent quota reads, one paid dispatch only.
 }
});

test('all detailed trial failure messages work in English and Chinese',async()=>{
 const context=vm.createContext({});
 for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file+'.js'),'utf8'),context);
 for(const code of ['trial_provider_timeout','trial_provider_connection','trial_provider_http','trial_provider_response','trial_usage_invalid','trial_settlement_failed','trial_invalid_content']){
  const s=await localAccount(()=>Response.json({requestId,diagnostics:{code}},{status:502}));let caught;
  try{await s.config.sponsoredCall({});}catch(error){caught=error;}
  assert.ok(caught);context.WhoI18n.set('en');const en=context.WhoI18n.error(caught);
  assert.doesNotMatch(en,/[\u3400-\u9fff]/);assert.notEqual(en,context.WhoI18n.t('请求未完成。'));
  context.WhoI18n.set('zh-CN');assert.equal(context.WhoI18n.error(Error(en)),caught.message);
 }
});

test('model timeout wrappers retain diagnostics and successful responses stay unchanged',async()=>{
 const {modelCall}=require('../ai-client');const config={base:'https://api.deepseek.com',model:'deepseek-flash',sponsoredCall:async()=>{
  await new Promise(resolve=>setTimeout(resolve,15));throw diagnostics.attach(Error('uncertain'),{requestId,code:'trial_settlement_failed'});
 }};
 await assert.rejects(modelCall(config,[],{timeoutMs:1,usagePhase:'review'}),error=>/响应超时/.test(error.message)&&error.diagnostics.requestId===requestId&&error.diagnostics.aiPhase==='review');
 assert.equal(await modelCall({...config,sponsoredCall:async()=>({choices:[{message:{content:'Unchanged prose.'}}]})},[]),'Unchanged prose.');
});
