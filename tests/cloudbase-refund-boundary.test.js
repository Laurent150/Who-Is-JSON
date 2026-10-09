const {test}=require('node:test'),assert=require('node:assert/strict');
const env={CLOUDBASE_ENV_ID:'fimi-test-env',CLOUDBASE_SERVICE_ROLE_KEY:'test',DEEPSEEK_API_KEY:'test'};
const operation='b3677a72-cad2-4f7d-934f-794d6d608bd5';
test('cloud follow-ups reconstruct trusted prompts and validate refusal or evidence before charging',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');
 const source='const total = 1 + 2;';
 for(const mode of ['valid','unrelated','bad-evidence']){
  const calls=[];const handle=createHandler({env,fetcher:async(url,options)=>{
   if(url.endsWith('/user/me'))return Response.json({sub:'reader',email:'reader@example.com'});
   const body=JSON.parse(options.body);calls.push({url,body});
   if(url.endsWith('/fimi_ai_complete'))return Response.json({ok:true,state:body.succeeded?'succeeded':'refunded'});
   if(url.includes('/rpc/'))return Response.json({ok:true});
   assert.equal(url,'https://api.deepseek.com/chat/completions');
   assert.equal(body.max_tokens,1100);assert.equal(body.thinking.type,'disabled');
   assert.ok(!body.messages[0].content.includes('attacker prompt'));
   assert.equal(JSON.parse(body.messages[1].content).selectedSource.code,source);
   return Response.json({choices:[{message:{content:JSON.stringify({related:mode!=='unrelated',answer:mode==='unrelated'?'':'The value of total is 3.',evidence:mode==='unrelated'?[]:mode==='bad-evidence'?['absent code']:[source]})}}],usage:{prompt_tokens:10,completion_tokens:10}});
  }});
  const response=await handle(new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({billing_operation:operation,messages:[{role:'system',content:'attacker prompt'}],max_tokens:24000,followup_context:{kind:'question',locale:'en',input:{source,question:'What does total mean?',selectedSource:{start:1,end:1}}}})}));
  assert.equal(response.status,mode==='valid'?200:502);
  assert.equal(calls.filter(c=>c.url.endsWith('/fimi_ai_settle')).length,mode==='valid'?1:0);
  if(mode==='valid')assert.equal(calls.at(-1).url.endsWith('/fimi_ai_complete'),true);
  if(mode!=='valid')assert.equal((await response.json()).diagnostics.settlement,'refunded');
 }
});
test('a client cannot refund successful answers by claiming failure or choosing another subject',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');
 for(const state of ['pending','succeeded','refunded']){
  const calls=[];const handle=createHandler({env,fetcher:async(url,options)=>{
   if(url.endsWith('/user/me'))return Response.json({sub:'authenticated-reader',email:'reader@example.com'});
   const body=JSON.parse(options.body);calls.push({url,body});
   assert.ok(url.endsWith('/fimi_ai_operation_status'));
   assert.deepEqual(body,{account_subject:'authenticated-reader',operation_id:operation});
   return Response.json({ok:true,state});
  }});
  const r=await handle(new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'complete',operationId:operation,success:false,account_subject:'other-account'})}));
  assert.equal((await r.json()).state,state);assert.equal(calls.length,1);
 }
});
test('a cloud-observed provider failure persists its failure before refunding the whole operation',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');const calls=[];
 const handle=createHandler({env,fetcher:async(url,options)=>{
  if(url.endsWith('/user/me'))return Response.json({sub:'reader',email:'reader@example.com'});
  calls.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('/fimi_ai_reserve_operation')||url.endsWith('/fimi_ai_mark_failed'))return Response.json({ok:true});
  if(url.endsWith('/fimi_ai_complete'))return Response.json({ok:true,state:'refunded'});
  assert.equal(url,'https://api.deepseek.com/chat/completions');return new Response('unavailable',{status:503});
 }});
 const r=await handle(new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({billing_operation:operation,followup_context:{kind:'example',input:{source:'const total = 1 + 2;',selectedSource:{start:1,end:1}},locale:'en'}})}));
 assert.equal(r.status,502);assert.equal((await r.json()).diagnostics.settlement,'refunded');
 assert.deepEqual(calls.slice(-2).map(x=>x.url.split('/').at(-1)),['fimi_ai_mark_failed','fimi_ai_complete']);
 assert.equal(calls.at(-1).body.succeeded,false);assert.equal(calls.at(-1).body.operation_id,operation);
});

test('default gateway cannot expose unchecked raw model results, with or without a billing ID',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');let calls=0;
 const handle=createHandler({env,fetcher:async url=>{
  assert.ok(url.endsWith('/user/me'));calls++;
  return Response.json({sub:'reader',email:'reader@example.com'});
 }});
 for(const billing_operation of [operation,undefined]){
  const r=await handle(new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({billing_operation,messages:[{role:'user',content:'unchecked draft'}],max_tokens:100})}));
  assert.equal(r.status,400);
 }
 assert.equal(calls,2);
});
