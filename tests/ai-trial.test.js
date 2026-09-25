const {test}=require('node:test');
const assert=require('node:assert/strict');
const {modelCall}=require('../ai-client');
const {createCloudAccount}=require('../cloud-account');
test('cloud handler verifies identity, refuses exhausted credit, and retains uncertain reservations',async()=>{
 let handler, rejectAuth=false, exhausted=false, providerFails=false;
 const calls=[], originalFetch=global.fetch, originalDeno=global.Deno;
 global.Deno={env:{get:n=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',DEEPSEEK_API_KEY:'test-secret'})[n]},serve:fn=>handler=fn};
 global.fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null; calls.push({url,body});
  if(url.endsWith('/auth/v1/user'))return Response.json({identities:[{provider:'github',identity_data:{sub:'12345'}}]},{status:rejectAuth?401:200});
  if(url.endsWith('/who_ai_reserve'))return Response.json(exhausted?{error:'quota'}:{ok:true});
  if(url.endsWith('/who_ai_settle'))return Response.json({ok:true});
  if(url==='https://api.deepseek.com/chat/completions'){
   if(providerFails)throw Error('ambiguous network failure');
   return Response.json({choices:[{message:{content:'test'}}],usage:{prompt_tokens:10,completion_tokens:5}});
  }
  throw Error('unexpected URL');
 };
 try {
  const ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
  const policy=await import('../supabase/functions/ai-trial/policy.mjs');
  const source=fs.readFileSync(require.resolve('../supabase/functions/ai-trial/index.ts'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{exports:{},require:()=>policy,Deno:global.Deno,fetch:global.fetch,Response,AbortSignal,Uint8Array,TextDecoder,crypto:require('node:crypto').webcrypto});
  const request=(auth=true)=>new Request('https://test/ai-trial',{method:'POST',headers:auth?{Authorization:'Bearer test-session'}:{},body:JSON.stringify({github_account:'spoofed',messages:[{role:'user',content:'test'}],max_tokens:100})});
  assert.equal((await handler(request(false))).status,401);assert.equal(calls.length,0);
  rejectAuth=true;assert.equal((await handler(request())).status,401);assert.equal(calls.length,1);
  rejectAuth=false;exhausted=true;assert.equal((await handler(request())).status,402);assert.ok(!calls.some(c=>c.url.includes('deepseek.com')));
  exhausted=false;calls.length=0;assert.equal((await handler(request())).status,200);
  assert.equal(calls.find(c=>c.url.endsWith('/who_ai_reserve')).body.github_account,'12345');
  assert.equal(calls.find(c=>c.url.endsWith('/who_ai_settle')).body.cost,60);
  providerFails=true;calls.length=0;assert.equal((await handler(request())).status,502);
  assert.equal(calls.filter(c=>c.url.includes('deepseek.com')).length,1);assert.ok(!calls.some(c=>c.url.endsWith('/who_ai_settle')));
 }finally{global.fetch=originalFetch;if(originalDeno===undefined)delete global.Deno;else global.Deno=originalDeno;}
});
test('trial gateway pins the model and strips client options; text/output are bounded',async()=>{
 const {prepare}=await import('../supabase/functions/ai-trial/policy.mjs');
 const p=prepare({model:'expensive',messages:[{role:'user',content:'你好',name:'ignored'}],max_tokens:100,stream:true,tools:[{}],response_format:{type:'json_object'}});
 assert.equal(p.body.model,'deepseek-flash');assert.equal(p.body.stream,false);assert.equal(p.body.thinking.type,'disabled');assert.equal(p.body.tools,undefined);assert.equal(p.body.messages[0].name,undefined);
 assert.ok(p.reserved>800&&p.reserved<1000000);
 for(const input of [{messages:[],max_tokens:100},{messages:[{role:'user',content:[]}],max_tokens:100},{messages:[{role:'user',content:'x'.repeat(100001)}],max_tokens:100},{messages:[{role:'user',content:'x'}],max_tokens:8193}])assert.throws(()=>prepare(input));
});
test('credit settlement rounds up cache charges and refuses unknown/out-of-bound usage',async()=>{
 const {prepare,charge}=await import('../supabase/functions/ai-trial/policy.mjs');
 const p=prepare({messages:[{role:'user',content:'test'}],max_tokens:100});
 assert.equal(charge({prompt_tokens:10,prompt_cache_hit_tokens:1,completion_tokens:5},p),59);
 assert.ok(charge({prompt_tokens:p.inputBound,completion_tokens:100},p)<=p.reserved);
 for(const u of [{},{prompt_tokens:1,completion_tokens:101},{prompt_tokens:1,completion_tokens:0,prompt_cache_hit_tokens:2},{prompt_tokens:-1,completion_tokens:0}])assert.throws(()=>charge(u,p));
});
test('sponsored transport receives the existing explanation rules and has no client key',async()=>{
 let sent;
 const text=await modelCall({base:'https://api.deepseek.com',model:'deepseek-flash',sponsoredCall:async body=>{sent=body;return {choices:[{message:{content:'说明'}}]};}},[{role:'system',content:'Explain'},{role:'user',content:'const a=1;'}],{explanation:true,maxTokens:100});
 assert.equal(text,'说明');assert.match(sent.messages[0].content,/async/);assert.equal(sent.max_tokens,100);
 assert.throws(()=>createCloudAccount({env:{}}).trialConfig({headers:{}}),/登录/);
});
