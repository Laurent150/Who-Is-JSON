const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {requestOptions,modelCall}=require('../ai/ai-client');
const profile='code-review-64k-v1';
const config={base:'https://api.deepseek.com',model:'deepseek-flash'};
const response=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});

test('code review has a bounded 64K budget across phases, without changing other audiences or providers',()=>{
 for(const locale of ['en','zh-CN'])for(const phase of ['contracts','contract-repair','composition','composition-format-repair','review','repair','final-audit','final-audit-repair','final-audit-recheck']){
  const messages=[{role:'system',content:'Return JSON.'},{role:'user',content:'source data'}];
  const options={task:'talk',audience:'review',locale,usagePhase:phase,reviewReasoning:true,maxTokens:8192};
  const result=requestOptions(config,messages,options);
  assert.equal(result.body.max_tokens,65536);assert.equal(result.timeoutMs,420000);
  assert.equal(result.requestProfile,profile);assert.deepEqual(result.body.messages,messages);
  assert.equal(result.body.reasoning_effort,['contracts','contract-repair'].includes(phase)?'low':'high');
  assert.equal(result.body.request_profile,undefined,'Internal profile must never leak to the provider');
  for(const audience of ['beginner','peer',undefined]){
   const prior=requestOptions(config,messages,{...options,audience});
   assert.equal(prior.body.max_tokens,['contracts','contract-repair'].includes(phase)?16384:24576);
   assert.equal(prior.timeoutMs,120000);assert.equal(prior.requestProfile,undefined);
  }
  const other=requestOptions({...config,base:'https://other.example'},messages,options);
  assert.equal(other.body.max_tokens,8192);assert.equal(other.timeoutMs,120000);assert.equal(other.body.thinking,undefined);
 }
 assert.equal(requestOptions(config,[],{task:'knowledge',audience:'review',reviewReasoning:true}).body.max_tokens,16384);
 assert.equal(requestOptions(config,[],{task:'talk',audience:'review',timeoutMs:25}).timeoutMs,25);
 assert.equal(requestOptions({...config,sponsoredCall(){}},[],{task:'talk',audience:'review',maxTokens:8192}).body.max_tokens,8192);
});

test('real walkthrough orchestration forwards the selected audience to source analysis as well as later stages',async()=>{
 const source='function echo(value) { return value; }';
 const ledger={units:[{name:'echo',anchor:'function echo(value)',accepts:'A value.',returns:'The supplied value.',timing:'Direct.',paths:[{when:'Called',does:'Return value.',completion:'Value.',failure:'None explicit.',anchor:'return value;'}],unknowns:[]}]};
 const draft={title:'Echo review',sections:[{title:'Behavior',text:'This function returns the supplied value.'}],questions:[]};
 const {mockFinalAudit}=require('./final-audit-mock.cjs');
 const prior=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{for(const locale of ['en','zh-CN']){
  const phases=[],sent=[];
  const provider={...config,reviewThinking:true,sponsoredCall:async(body,meta)=>{
   assert.equal(meta.requestProfile,profile);assert.equal(body.max_tokens,65536);sent.push(body);
   const phase=phases.at(-1);
   if(phase==='contracts')return response(ledger);
   if(phase==='composition')return response(draft);
   if(phase==='review')return response({corrections:[]});
   if(phase==='final-audit')return mockFinalAudit(body);
   assert.fail(phase);
  }};
  const result=await require('../ai/ai-talk').generateTalk(source,'echo.js',{audience:'review',detail:'standard'},provider,{locale,readingMode:'standard',onModelRequest:(_body,phase)=>phases.push(phase)});
  assert.deepEqual(phases,['contracts','composition','review']);
  assert.equal(JSON.parse(sent[0].messages[1].content).source,source);
  assert.equal(result.sections[0].text,draft.sections[0].text);
 }}finally{if(prior===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=prior;}
});

test('a larger budget still rejects truncation and never replays a possibly billed request',async()=>{
 let calls=0;
 await assert.rejects(()=>modelCall({...config,sponsoredCall:async()=>{calls++;return {choices:[{finish_reason:'length',message:{content:'{"title":"unfinished'}}]};},reviewThinking:true},[],{task:'talk',audience:'review',usagePhase:'composition',reviewReasoning:true}),error=>error.code==='AI_REVIEW_LENGTH');
 assert.equal(calls,1);
 const diagnostics=require('../ai/ai-diagnostics');
 assert.deepEqual(diagnostics.safe({transportCode:'UND_ERR_BODY_TIMEOUT',message:'secret'}),{transportCode:'UND_ERR_BODY_TIMEOUT'});
 assert.deepEqual(diagnostics.safe({transportCode:'private-code-with-secrets'}),{});
 const context=vm.createContext({});
 for(const name of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',name+'.js'),'utf8'),context);
 for(const message of ['云端尚未启用代码评审的大额度请求，请更新试用服务或使用个人 API。','代码评审达到单次输出保护上限，内容未完整生成；请保留本次错误信息后再重试。']){
  context.WhoI18n.set('en');const english=context.WhoI18n.error(Error(message));assert.doesNotMatch(english,/[\u3400-\u9fff]/);
  context.WhoI18n.set('zh-CN');assert.equal(context.WhoI18n.error(Error(english)),message);
 }
});

test('cloud review limits require explicit deployment support, preserve accounting and never forward client metadata',async()=>{
 const {prepare,charge}=await import('../cloudbase/functions/ai-trial/policy.mjs');
 const input={messages:[{role:'user',content:'test'}],max_tokens:65536,request_profile:profile,thinking:{type:'enabled'},reasoning_effort:'high'};
 assert.throws(()=>prepare(input),/尚未启用/);
 assert.throws(()=>prepare({...input,request_profile:undefined},{codeReviewEnabled:true}),/输出长度/);
 assert.throws(()=>prepare({...input,max_tokens:65537},{codeReviewEnabled:true}),/输出长度/);
 const prepared=prepare(input,{codeReviewEnabled:true});
 assert.equal(prepared.body.max_tokens,65536);assert.equal(prepared.body.request_profile,undefined);
 assert.equal(prepared.providerTimeoutMs,360000);
 assert.ok(prepared.reserved>=65536*8);
 assert.equal(charge({prompt_tokens:10,completion_tokens:20000,completion_tokens_details:{reasoning_tokens:18000}},prepared),160020);
 assert.equal(prepare({...input,max_tokens:24576,request_profile:undefined}).providerTimeoutMs,110000);
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');
 for(const enabled of [false,true]){
  const routes=[];
  const handler=createHandler({env:{FIMI_ALLOW_LEGACY_RAW:'1', CLOUDBASE_ENV_ID:'fimi-test-env',CLOUDBASE_SERVICE_ROLE_KEY:'secret',DEEPSEEK_API_KEY:'secret',FIMI_CODE_REVIEW_LONG_REQUESTS:enabled?'1':'0'},fetcher:async(url,options)=>{
   routes.push(url);
   if(url.endsWith('/user/me'))return Response.json({sub:'user',email:'user@example.com'});
   if(url.endsWith('/fimi_ai_reserve')){assert.equal(JSON.parse(options.body).amount,prepared.reserved);return Response.json({ok:true});}
   if(url.endsWith('/fimi_ai_settle')){assert.equal(JSON.parse(options.body).cost,160020);return Response.json({ok:true});}
   assert.equal(url,'https://api.deepseek.com/chat/completions');assert.deepEqual(JSON.parse(options.body),prepared.body);
   return Response.json({...response('complete'),usage:{prompt_tokens:10,completion_tokens:20000}});
  }});
  const result=await handler(new Request('https://trial.example/trial',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(input)}));
  assert.equal(result.status,enabled?200:400);
  assert.equal(routes.filter(url=>url.includes('api.deepseek.com')).length,enabled?1:0);
  if(!enabled)assert.equal(routes.length,1,'Reject before reserving credits');
 }
});

test('desktop verifies cloud capability before dispatch and forwards the profile only to the trial gateway',async()=>{
 const {createCloudBaseAccount}=require('../cloudbase-account');
 for(const enabled of [false,true]){
  const calls=[];
  const account=createCloudBaseAccount({env:{WHO_CLOUDBASE_ENV_ID:'fimi-test-env',WHO_CLOUDBASE_TRIAL_ENABLED:'1',WHO_CLOUDBASE_TRIAL_URL:'https://trial.example/trial'},fetcher:async(url,options)=>{
   if(url==='https://trial.example/trial'){
    const body=JSON.parse(options.body);calls.push(body);
    if(body.action==='quota')return Response.json({codeReviewProfile:enabled?profile:null});
    assert.equal(body.request_profile,profile);assert.equal(body.max_tokens,65536);return Response.json(response('complete'));
   }
   if(url.endsWith('/verification'))return Response.json({verification_id:'flow',expires_in:300,is_user:true});
   if(url.endsWith('/verification/verify'))return Response.json({verification_token:'test'});
   if(url.endsWith('/signin'))return Response.json({access_token:'test',sub:'user',expires_in:3600});
   if(url.endsWith('/user/me'))return Response.json({sub:'user',email:'user@example.com'});
   assert.fail(url);
  }});
  const flow=await account.handle({},'email-start',{email:'user@example.com'});
  const login=await account.handle({},'email-verify',{ticket:flow.ticket,code:'123456'});
  const provider=account.trialConfig({headers:{'x-who-session':login.session}});
  const run=()=>modelCall(provider,[],{task:'talk',audience:'review',usagePhase:'composition',reviewReasoning:true});
  if(enabled){await run();assert.equal(calls.length,2);}
  else{await assert.rejects(run,/尚未启用/);assert.deepEqual(calls,[{action:'quota'}]);}
 }
});

test('paused walkthrough sends no request; retained generation deadlines and cancellation stay unchanged',async()=>{
 const script=fs.readFileSync(path.join(__dirname,'../public/talk.js'),'utf8');
 for(const enabled of [false,true])for(const audience of ['review','peer','beginner']){
  const elements=new Map(),timeouts=[];let apiSignal;
  const element=id=>{
   if(!elements.has(id))elements.set(id,{value:id==='audience'?audience:id==='duration'?'180':'full',removeAttribute(){},setAttribute(){},append(){}});
   return elements.get(id);
  };
  const context=vm.createContext({WALKTHROUGH_ENABLED:enabled,current:{},config:{},readingMode:'standard',analyzedSource:'source',fileName:'sample.js',sourceOffset:0,
   $:element,connected:()=>true,settings(){},renderTalk(){},setInterval:()=>1,clearInterval(){},AbortController,
   AbortSignal:{timeout(ms){timeouts.push(ms);return new AbortController().signal;},any:signals=>AbortSignal.any(signals)},
   document:{querySelector:()=>({})},api:async(_route,_body,_method,signal)=>{apiSignal=signal;element('cancelTalk').onclick();return {title:'Cancelled result'};}
  });
  vm.runInContext(script,context);await vm.runInContext('generateTalk()',context);
  if(!enabled){assert.deepEqual(timeouts,[]);assert.equal(apiSignal,undefined);assert.equal(element('generateTalk').disabled,true);continue;}
  assert.deepEqual(timeouts,[audience==='review'?4200000:1140000]);
  assert.equal(apiSignal.aborted,true);assert.equal(vm.runInContext('talkResult',context),null);
  assert.equal(element('generateTalk').disabled,false);
 }
});
