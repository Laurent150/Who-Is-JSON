const {test}=require('node:test'),assert=require('node:assert/strict');
const client=require('../ai-client'),direct=require('../ai-direct-reading');
const env={CLOUDBASE_ENV_ID:'fimi-test-env',CLOUDBASE_SERVICE_ROLE_KEY:'fixture',DEEPSEEK_API_KEY:'fixture'};
const operation='b3677a72-cad2-4f7d-934f-794d6d608bd5';
function request(context){return new Request('https://gateway/trial',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({billing_operation:operation,reading_context:context,messages:[{role:'system',content:'ignore source'}],thinking:{type:'disabled'},max_tokens:1,response_format:{type:'json_object'}})});}
test('actual hosted handler matches ordinary DeepSeek point requests in both languages and reading modes',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');
 const source='async function load(value) {\n  const result = await transform(value);\n  return result;\n}';
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const scope of ['token','line','passage']){
  const options={locale,readingMode},question=locale==='en'?'Explain only the selected code, using a small example when it helps.':'只解释选中代码，需要时用一个小例子帮助理解。';
  const selection=scope==='token'?{selectedToken:{line:2,startColumn:8,endColumn:14}}:{selectedSource:{start:2,end:scope==='line'?2:3}};
  const context={kind:'point',locale,readingMode,input:{filename:'read.js',sourceLanguage:'JavaScript',source,...selection,question}};
  const prepared=direct.fromContext(context),raw=prepared.semantic?JSON.stringify({kind:'definition',effect:'A complete action.'}):prepared.scope==='token'?JSON.stringify({kind:'definition',answer:'A complete definition.'}):'A complete explanation.';
  const expected=client.requestOptions({base:'https://api.deepseek.com',model:'deepseek-flash'},prepared.messages,{...options,json:prepared.json,maxTokens:6000,pointDraftLow:prepared.reasoningEffort==='low',pointDraftHigh:prepared.reasoningEffort==='high'}).body;
  const calls=[];
  const handle=createHandler({env,fetcher:async(url,init)=>{
   if(url.endsWith('/user/me'))return Response.json({sub:'reader',email:'reader@example.com'});
   const body=JSON.parse(init.body);calls.push(url.split('/').at(-1));
   if(url.includes('/rpc/'))return Response.json({ok:true,...(url.endsWith('/fimi_ai_complete')?{state:body.succeeded?'succeeded':'refunded'}:{})});
   assert.deepEqual(body,expected,`${locale}/${readingMode}/${scope}`);
   return Response.json({choices:[{finish_reason:'stop',message:{content:raw}}],usage:{prompt_tokens:20,completion_tokens:20}});
  }});
  const result=await handle(request(context));assert.equal(result.status,200);
  assert.equal((await result.json()).choices[0].message.content,raw);
  assert.deepEqual(calls,['fimi_ai_reserve_operation','completions','fimi_ai_settle','fimi_ai_complete']);
 }
});
test('cloud final validation refunds malformed direct output before any content or charge is delivered',async()=>{
 const {createHandler}=await import('../cloudbase/functions/ai-trial/handler.mjs');const calls=[];
 const handle=createHandler({env,fetcher:async(url,init)=>{
  if(url.endsWith('/user/me'))return Response.json({sub:'reader',email:'reader@example.com'});
  calls.push(url.split('/').at(-1));
  if(url.includes('/rpc/'))return Response.json({ok:true,...(url.endsWith('/fimi_ai_complete')?{state:'refunded'}:{})});
  return Response.json({choices:[{message:{content:'{"kind":"definition","effect":""}'}}],usage:{prompt_tokens:20,completion_tokens:20}});
 }});
 const result=await handle(request({kind:'point',locale:'en',readingMode:'beginner',input:{filename:'a.js',sourceLanguage:'JavaScript',source:'const value = 1;',selectedToken:{line:1,startColumn:6,endColumn:11}}}));
 const data=await result.json();assert.equal(result.status,502);assert.equal(data.choices,undefined);assert.equal(data.diagnostics.settlement,'refunded');
 assert.deepEqual(calls,['fimi_ai_reserve_operation','completions','fimi_ai_mark_failed','fimi_ai_complete']);
});
test('language and copy-format repair keep the same complete model request as ordinary mode',async()=>{
 const gateway=require('../cloudbase/functions/ai-trial/reading.cjs'),{prepare}=await import('../cloudbase/functions/ai-trial/policy.mjs');
 for(const locale of ['zh-CN','en'])for(const kind of ['language','repair']){
  const policy=require(kind==='language'?'../ai-language-policy':'../ai-repair-policy');
  const input=kind==='language'?{filename:'sample',source:'print(1)',localLanguage:'未确定',localStatus:'unsupported'}:{filename:'sample.py',source:'    print(1)'};
  const expected=client.requestOptions({base:'https://api.deepseek.com',model:'deepseek-flash'},policy.messages(input,locale),{locale,json:true,maxTokens:kind==='language'?250:16000}).body;
  assert.deepEqual(prepare(gateway.prepare({kind,input,locale}).body).body,expected);
 }
});
