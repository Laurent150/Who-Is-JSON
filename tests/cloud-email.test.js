const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCloudAccount}=require('../cloud-account');
const {releaseCloudEnv}=require('../cloud-config');
const env={WHO_SUPABASE_URL:'https://example.supabase.co',WHO_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',WHO_EMAIL_LOGIN_ENABLED:'1'};
function setup(){
 let mode='',time=0,release;const calls=[];
 const account=createCloudAccount({env,now:()=>time,fetcher:async(url,options)=>{
  const route=new URL(url).pathname;calls.push({route,options});
  if(mode==='offline')throw Error('secret transport detail');
  if(route==='/auth/v1/otp')return Response.json({});
  if(route==='/auth/v1/verify'){
   if(mode==='bad')return Response.json({error:'private detail'},{status:422});
   if(mode==='pending')await new Promise(r=>release=r);
   return Response.json({access_token:'provider-secret',expires_in:3600});
  }
  if(route==='/auth/v1/user')return Response.json({id:'email-user',email:mode==='wrong'?'other@example.com':'reader@example.com',email_confirmed_at:mode==='unconfirmed'?null:'2026-01-01',identities:[{provider:'email'}]});
  if(route==='/rest/v1/who_libraries')return Response.json([]);
  if(route==='/rest/v1/rpc/who_save_library')return Response.json({revision:1});
  return Response.json({});
 }});
 const req={headers:{host:'127.0.0.1:43127'}};
 return {account,req,calls,setMode:x=>mode=x,setTime:x=>time=x,release:()=>release(),start:()=>account.handle(req,'email-start',{email:' Reader@Example.com '})};
}
test('email is deployment-gated; OTP sends only the validated address and stays server-side',async()=>{
 const off=createCloudAccount({env:{...env,WHO_EMAIL_LOGIN_ENABLED:'0'}});
 assert.equal((await off.handle({},'status')).emailEnabled,undefined);
 await assert.rejects(off.handle({},'email-start',{email:'reader@example.com'}),{status:503});
 const s=setup();
 for(const email of ['bad','x@y','x\ny@example.com','x'.repeat(260)+'@example.com'])await assert.rejects(s.account.handle(s.req,'email-start',{email}),{status:400});
 assert.equal(s.calls.length,0);
 const flow=await s.start();assert.match(flow.ticket,/^[a-f0-9]{64}$/);
 assert.deepEqual(JSON.parse(s.calls[0].options.body),{email:'reader@example.com',create_user:true});
 assert.equal(s.calls[0].options.redirect,'error');
 const login=await s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456',email:'attacker@example.com'});
 assert.ok(!JSON.stringify(login).includes('provider-secret'));assert.equal(login.user.trialEligible,false);
 assert.deepEqual(JSON.parse(s.calls[1].options.body),{email:'reader@example.com',token:'123456',type:'email'});
 s.req.headers['x-who-session']=login.session;
 assert.equal((await s.account.handle(s.req,'library')).user.id,'email-user');
 assert.deepEqual(await s.account.handle(s.req,'save',{userId:'email-user',revision:0,payload:{knowledge:[],cards:[]}}),{revision:1});
 await assert.rejects(s.account.handle(s.req,'save',{userId:'other',revision:0,payload:{knowledge:[],cards:[]}}),{status:409});
 assert.equal((await s.account.handle(s.req,'trial-quota')).enabled,false);
 assert.throws(()=>s.account.trialConfig(s.req),{status:403});
 await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'}),{status:400});
 await s.account.handle(s.req,'logout');await assert.rejects(s.account.handle(s.req,'library'),{status:401});
});
test('email codes cannot authenticate a different or unconfirmed identity',async()=>{
 for(const mode of ['wrong','unconfirmed']){
  const s=setup(),flow=await s.start();s.setMode(mode);
  await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'}),{status:401});
  await assert.rejects(s.account.handle(s.req,'library'),{status:401});
 }
});
test('email resend and verification are bounded; uncertain failures are not replayed',async()=>{
 const s=setup(),flow=await s.start();await assert.rejects(s.start(),{status:429});s.setMode('bad');
 for(let i=0;i<5;i++)await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'}),e=>e.status===400&&!e.message.includes('private'));
 const before=s.calls.length;await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'}),{status:400});assert.equal(s.calls.length,before);
 s.setTime(60001);s.setMode('');const next=await s.start();s.setMode('offline');
 await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:next.ticket,code:'123456'}),e=>e.status===503&&!e.message.includes('secret'));
 const after=s.calls.length;await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:next.ticket,code:'123456'}),{status:400});assert.equal(s.calls.length,after);
});
test('cancelled, expired and concurrent email attempts never mint a second session',async()=>{
 const s=setup(),flow=await s.start();
 await assert.rejects(s.account.handle(s.req,'github-poll',{ticket:flow.ticket}),{status:401});
 s.setMode('pending');const work=s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'});
 await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:flow.ticket,code:'123456'}),{status:409});
 await s.account.handle(s.req,'email-cancel',{ticket:flow.ticket});s.release();await assert.rejects(work,{status:400});
 assert.equal(s.calls.filter(c=>c.route==='/auth/v1/verify').length,1);
 s.setTime(60001);s.setMode('');const old=await s.start();s.setTime(660002);
 await assert.rejects(s.account.handle(s.req,'email-verify',{ticket:old.ticket,code:'123456'}),{status:400});
});
test('custom cloud origins require explicit operator opt-in and paired configuration',async()=>{
 const custom={...env,WHO_SUPABASE_URL:'https://accounts.example.org'};
 assert.throws(()=>createCloudAccount({env:custom}));
 const allowed={...custom,WHO_CLOUD_ALLOW_CUSTOM_ORIGIN:'1'};
 assert.equal((await createCloudAccount({env:allowed}).handle({},'status')).enabled,true);
 assert.throws(()=>releaseCloudEnv({WHO_SUPABASE_URL:allowed.WHO_SUPABASE_URL}));
 for(const url of ['http://accounts.example.org','https://127.0.0.1','https://accounts.example.org/path','https://user:password@accounts.example.org','https://accounts.example.org:444','https://accounts.example.org?secret=x'])assert.throws(()=>createCloudAccount({env:{...allowed,WHO_SUPABASE_URL:url}}));
 assert.equal((await createCloudAccount({env:releaseCloudEnv({...allowed,WHO_CLOUD_DISABLED:'1'})}).handle({},'status')).enabled,false);
});
