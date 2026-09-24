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
  if(route.endsWith('/verify'))result={access_token:'provider-secret',expires_in:3600};
  if(route.endsWith('/user'))result={id:'account-a',email:'a@example.com',email_confirmed_at:mode==='unverified'?null:'2026-01-01'};
  if(route.endsWith('/who_libraries'))result=mode==='leak'?[{},{}]:mode==='bad-revision'?[{revision:-1,payload:empty()}]:[];
  if(route.endsWith('/who_save_library'))result=mode==='conflict'?{conflict:true}:{revision:JSON.parse(options.body).expected_revision+1};
  return Response.json(result);
 }});
 const req={headers:{}};
 return {account,req,calls,setMode:v=>mode=v,setTime:v=>time=v,login:async()=>{const r=await account.handle(req,'verify',{email:'A@example.com',code:'123456'});req.headers['x-who-session']=r.session;return r;}};
}
test('optional cloud configuration rejects admin keys and non-provider URLs',async()=>{
 assert.deepEqual(await createCloudAccount({env:{}}).handle({},'status'),{enabled:false});
 await assert.rejects(createCloudAccount({env:{}}).handle({},'send-code'),{status:503});
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
test('email requests are limited; provider errors do not leak details',async()=>{
 const s=setup();await s.account.handle(s.req,'send-code',{email:'a@example.com'});
 await assert.rejects(s.account.handle(s.req,'send-code',{email:'a@example.com'}),{status:429});
 await assert.rejects(s.account.handle(s.req,'verify',{email:'a@example.com',code:'invalid'}),{status:400});
 s.setMode('offline');await assert.rejects(s.login(),e=>e.status===503&&!e.message.includes('private'));
 s.setMode('rejected');await assert.rejects(s.login(),{status:401});
});
test('malformed and oversized favorites are rejected before upload',()=>{
 for(const p of [null,{}, {knowledge:[],cards:[{}]}, {knowledge:[{}],cards:[]}, {knowledge:[],cards:Array(61).fill({id:1,title:'x',code:'x'})}, {knowledge:[],cards:[{id:1,title:'x',code:'x'.repeat(2000000)}]}])assert.throws(()=>validateLibrary(p));
 assert.deepEqual(validateLibrary({...empty(),extra:'discarded'}),empty());
});
