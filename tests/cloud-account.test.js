const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCloudAccount,validateLibrary}=require('../cloud-account');
const env={WHO_SUPABASE_URL:'https://example.supabase.co',WHO_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const empty=()=>({knowledge:[],cards:[]});
function setup(){
 let time=0,mode='',calls=[];
 const account=createCloudAccount({env,now:()=>time,fetcher:async(url,options)=>{
  calls.push({url,options});const route=new URL(url).pathname;
  if(mode==='offline')throw Error('private upstream error');
  if(mode==='rejected')return new Response('private error',{status:401});
  let result={};
  if(route.endsWith('/token'))result={access_token:'provider-secret',expires_in:3600};
  if(route.endsWith('/user'))result={id:'account-a',email:'a@example.com',identities:mode==='unverified'?[]:[{provider:'github',identity_data:{user_name:'test-user'}}]};
  if(route.endsWith('/who_libraries'))result=mode==='leak'?[{},{}]:mode==='bad-revision'?[{revision:-1,payload:empty()}]:[];
  if(route.endsWith('/who_save_library'))result=mode==='conflict'?{conflict:true}:{revision:JSON.parse(options.body).expected_revision+1};
  return Response.json(result);
 }});
 const req={headers:{host:'127.0.0.1:43127'}};
 return {account,req,calls,setMode:v=>mode=v,setTime:v=>time=v,login:async()=>{const flow=await account.handle(req,'github-start');const redirect=new URL(new URL(flow.url).searchParams.get('redirect_to'));redirect.searchParams.set('code','test-code');await account.callback(redirect.searchParams);const r=await account.handle(req,'github-poll',{ticket:flow.ticket});req.headers['x-who-session']=r.session;return r;}};
}
test('optional cloud configuration rejects admin keys and non-provider URLs',async()=>{
 assert.deepEqual(await createCloudAccount({env:{}}).handle({},'status'),{enabled:false});
 await assert.rejects(createCloudAccount({env:{}}).handle({},'github-start'),{status:503});
 for(const url of ['http://example.supabase.co','https://example.supabase.co.evil.test','https://example.supabase.co/path'])assert.throws(()=>createCloudAccount({env:{...env,WHO_SUPABASE_URL:url}}));
 for(const key of ['sb_secret_bad','x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x'])assert.throws(()=>createCloudAccount({env:{...env,WHO_SUPABASE_PUBLISHABLE_KEY:key}}));
});
test('verified identity stays server-side; writes derive ownership and use revisions',async()=>{
 const s=setup();const login=await s.login();assert.match(login.session,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(login).includes('provider-secret'));
 assert.deepEqual((await s.account.handle(s.req,'library')).payload,empty());
 await assert.rejects(s.account.handle(s.req,'save',{userId:'account-b',revision:0,payload:empty()}),{status:409});
 assert.deepEqual(await s.account.handle(s.req,'save',{userId:'account-a',revision:0,payload:empty()}),{revision:1});
 const call=s.calls.at(-1);assert.equal(call.options.headers.Authorization,'Bearer provider-secret');assert.deepEqual(JSON.parse(call.options.body),{expected_revision:0,new_payload:empty()});
 s.setMode('conflict');await assert.rejects(s.account.handle(s.req,'save',{userId:'account-a',revision:0,payload:empty()}),{status:409});
 for(const mode of ['leak','bad-revision']){s.setMode(mode);await assert.rejects(s.account.handle(s.req,'library'),{status:502});}
});
test('unverified identities, expired sessions, and logged-out sessions cannot read',async()=>{
 const s=setup();s.setMode('unverified');await assert.rejects(s.login(),{status:401});s.setMode('');await s.login();
 s.setTime(3600001);await assert.rejects(s.account.handle(s.req,'library'),{status:401});
 await s.login();s.setMode('offline');await s.account.handle(s.req,'logout');await assert.rejects(s.account.handle(s.req,'library'),{status:401});
});
test('PKCE binds each callback to a single flow; wrong, expired and cancelled states fail',async()=>{
 const s=setup(),flow=await s.account.handle(s.req,'github-start');const url=new URL(flow.url),params=new URL(url.searchParams.get('redirect_to')).searchParams;
 assert.equal(url.searchParams.get('provider'),'github');assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.ok(!flow.url.includes(flow.ticket));
 await assert.rejects(s.account.callback(new URLSearchParams('state=wrong&code=bad')),{status:400});
 assert.deepEqual(await s.account.handle(s.req,'github-poll',{ticket:flow.ticket}),{pending:true});
 params.set('code','test');await s.account.callback(params);
 const exchange=s.calls.find(x=>x.url.includes('grant_type=pkce'));const verifier=JSON.parse(exchange.options.body).code_verifier;
 assert.equal(require('node:crypto').createHash('sha256').update(verifier).digest('base64url'),url.searchParams.get('code_challenge'));
 await assert.rejects(s.account.callback(params),{status:400});
 await s.account.handle(s.req,'github-poll',{ticket:flow.ticket});await assert.rejects(s.account.handle(s.req,'github-poll',{ticket:flow.ticket}),{status:401});
 const cancelled=await s.account.handle(s.req,'github-start');await s.account.handle(s.req,'github-cancel',{ticket:cancelled.ticket});await assert.rejects(s.account.handle(s.req,'github-poll',{ticket:cancelled.ticket}),{status:401});
 const expired=await s.account.handle(s.req,'github-start');s.setTime(600001);await assert.rejects(s.account.handle(s.req,'github-poll',{ticket:expired.ticket}),{status:401});
});
test('login rate limits and fixed redirects prevent abuse; upstream failures are sanitized',async()=>{
 const s=setup();await assert.rejects(s.account.handle({headers:{host:'evil.test'}},'github-start'),{status:400});
 s.setMode('offline');await assert.rejects(s.login(),e=>e.status===401&&!e.message.includes('private'));
 s.setMode('rejected');await assert.rejects(s.login(),{status:401});
 const fresh=setup();for(let i=0;i<20;i++)await fresh.account.handle(fresh.req,'github-start');await assert.rejects(fresh.account.handle(fresh.req,'github-start'),{status:429});
});
test('malformed and oversized favorites are rejected before upload',()=>{
 for(const p of [null,{}, {knowledge:[],cards:[{}]}, {knowledge:[{}],cards:[]}, {knowledge:[],cards:Array(61).fill({id:1,title:'x',code:'x'})}, {knowledge:[],cards:[{id:1,title:'x',code:'x'.repeat(2000000)}]}])assert.throws(()=>validateLibrary(p));
 assert.deepEqual(validateLibrary({...empty(),extra:'discarded'}),empty());
});
