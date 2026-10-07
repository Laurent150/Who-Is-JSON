const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCloudAccount}=require('../cloud-account');
const {modelCall}=require('../ai-client');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
async function setup(respond){
 let time=10000,last=-Infinity,active=0,maxActive=0;
 const calls=[],waits=[];
 const account=createCloudAccount({env:{WHO_SUPABASE_URL:'https://example.supabase.co',WHO_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},now:()=>time,
  pause:async(ms,signal)=>{signal?.throwIfAborted();waits.push(ms);time+=ms;},
  fetcher:async(url,options)=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/token'))return Response.json({access_token:'test-only',expires_in:3600});
   if(path.endsWith('/user'))return Response.json({id:'same-user',identities:[{provider:'github'}]});
   if(path.includes('/logout'))return new Response(null,{status:204});
   assert.equal(path,'/functions/v1/ai-trial');
   const call={time,body:JSON.parse(options.body)};calls.push(call);active++;maxActive=Math.max(active,maxActive);
   try{
    await new Promise(resolve=>setImmediate(resolve));
    if(respond)return await respond(call,calls.length);
    if(time-last<5000)return Response.json({error:'请稍后再试。'},{status:429});
    last=time;return Response.json(mockFinalAudit(call.body)||{choices:[{message:{content:'This creates a name for the value.'}}]});
   }finally{active--;}
  }});
 async function login(){const req={headers:{host:'127.0.0.1:43127'}};const flow=await account.handle(req,'github-start');const params=new URL(new URL(flow.url).searchParams.get('redirect_to')).searchParams;params.set('code','test');await account.callback(params);req.headers['x-who-session']=(await account.handle(req,'github-poll',{ticket:flow.ticket})).session;return req;}
 const req=await login();
 return {account,req,login,calls,waits,get maxActive(){return maxActive;},config:account.trialConfig(req)};
}
test('trial draft, review and final audit all honor the deployed five-second reservation interval',async()=>{
 const s=await setup();
 const answer=await modelCall(s.config,[{role:'system',content:'Explain'},{role:'user',content:JSON.stringify({source:'const n=1;'})}],{explanation:true,locale:'en',maxTokens:100});
 assert.match(answer,/creates a name/);assert.equal(s.calls.length,3);assert.ok(s.calls[1].time-s.calls[0].time>=5000);assert.ok(s.calls[2].time-s.calls[1].time>=5000);assert.equal(s.maxActive,1);
});
test('separate requests and local sessions for one account share a serial trial queue',async()=>{
 const s=await setup(),second=s.account.trialConfig(await s.login());
 await Promise.all([s.config.sponsoredCall({id:1}),second.sponsoredCall({id:2}),s.config.sponsoredCall({id:3})]);
 assert.equal(s.maxActive,1);assert.equal(s.calls.length,3);
 for(let i=1;i<s.calls.length;i++)assert.ok(s.calls[i].time-s.calls[i-1].time>=5000);
});
test('only explicit pre-dispatch rate rejection is retried, once, after a wait',async()=>{
 const rate=()=>Response.json({error:'请稍后再试。'},{status:429});
 const s=await setup((call,n)=>n===1?rate():Response.json({ok:true}));
 assert.deepEqual(await s.config.sponsoredCall({}),{ok:true});assert.equal(s.calls.length,2);assert.ok(s.waits[0]>=5000);
 const persistent=await setup(rate);await assert.rejects(persistent.config.sponsoredCall({}),{status:429});assert.equal(persistent.calls.length,2);
 for(const [status,message] of [[429,'上一笔调用仍在处理或待核对。'],[502,'AI 调用未完成，预留额度待核对，请勿反复重试。'],[402,'个人或平台试用额度不足，可改用自己的 AI。']]){
  const other=await setup(()=>Response.json({error:message},{status}));await assert.rejects(other.config.sponsoredCall({}),{status});assert.equal(other.calls.length,1);
 }
 const network=await setup(()=>{throw Error('uncertain network failure');});await assert.rejects(network.config.sponsoredCall({}),{status:503});assert.equal(network.calls.length,1);
});
test('cancelled queued work is not dispatched and does not poison the queue',async()=>{
 let release,started;const ready=new Promise(r=>started=r);
 const s=await setup(async(call,n)=>{if(n===1){started();await new Promise(r=>release=r);}return Response.json({ok:true});});
 const first=s.config.sponsoredCall({id:1});await ready;
 const controller=new AbortController();const cancelled=s.config.sponsoredCall({id:2},{signal:controller.signal});controller.abort();
 const rejected=assert.rejects(cancelled,{name:'AbortError'});release();await first;await rejected;
 await s.config.sponsoredCall({id:3});assert.deepEqual(s.calls.map(x=>x.body.id),[1,3]);
});
test('signing out prevents an already queued trial request from being dispatched',async()=>{
 const s=await setup();await s.account.handle(s.req,'logout');await assert.rejects(s.config.sponsoredCall({}),{status:401});assert.equal(s.calls.length,0);
});
test('every deployed trial gateway and policy message has an English translation',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ctx=vm.createContext({navigator:{language:'en'}});
 for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file),'utf8'),ctx);
 for(const file of ['index.ts','policy.mjs']){
  const source=fs.readFileSync(require.resolve('../supabase/functions/ai-trial/'+file),'utf8');
  for(const [,message] of source.matchAll(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g))assert.doesNotMatch(ctx.WhoI18n.t(message),/[\u4e00-\u9fff]/,message);
 }
 assert.match(ctx.WhoI18n.t('请稍后再试。'),/rate-limited/);
 ctx.WhoI18n.set('zh-CN');assert.equal(ctx.WhoI18n.t('请稍后再试。'),'请稍后再试。');
});
