const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
function setup({pollError,cloudbase=false,quotaProvider,storedSession='',welcomeSeen=false,sessionExpired=false}={}){
 // These tests exercise the explicitly selected Chinese UI, not first-run defaults.
 const nodes=new Map(),data=new Map([['whoisjson.locale','zh-CN']]),events=new Map(),calls=[],timers=[];let pendingSave,conflict=false,remote={revision:0,payload:{knowledge:[],cards:[]}};
 if(storedSession)data.set('who.account.session',storedSession);if(welcomeSeen)data.set('who.welcome.seen','1');
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',hidden:false,open:false,showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context=vm.createContext({Event,AbortSignal,localStorage:storage,sessionStorage:storage,$:node,library(){},download(){},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},window:{open:()=>({opener:null,location:{},close(){}}),APP_TOKEN:'local-token',dispatchEvent:e=>events.get(e.type)?.(),addEventListener:(k,v)=>events.set(k,v)},fetch:async(url,options)=>{
  const route=url.split('/').at(-1);calls.push({route,options});
  if(route==='status')return Response.json({enabled:true,...(cloudbase?{provider:'cloudbase',libraryEnabled:true,trialEnabled:true}:{})});
  if(route==='github-start')return Response.json({ticket:'ticket',url:'https://example.supabase.co/auth/v1/authorize'});
  if(route==='github-poll')return pollError ? Response.json({error:pollError},{status:503}) : Response.json({session:'opaque'});
  if(route==='library')return sessionExpired?Response.json({error:'登录已过期，请重新登录。'},{status:401}):Response.json({user:{id:'a',email:'a@example.com'},...remote});
  if(route==='trial-quota')return Response.json(quotaProvider?await quotaProvider():{enabled:true,remaining:1000000,held:0,poolRemaining:15000000});
  if(route==='save')return new Promise(resolve=>pendingSave=()=>{if(conflict)return resolve(Response.json({error:'收藏版本冲突'},{status:409}));const saved=JSON.parse(options.body);remote={revision:saved.revision+1,payload:saved.payload};resolve(Response.json({revision:remote.revision}));});
  return Response.json({ok:true});
 }});
 for(const file of ['locale-en','i18n','library-store','account'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file+'.js'),'utf8'),context);
 return {context,nodes,node,data,calls,timers,store:context.window.WhoLibraryStore,conflict:()=>conflict=true,finish:()=>pendingSave(),login:async()=>{await node('accountGithub').onclick();}};
}

test('login network failures keep their cause and translate when the dialog language changes',async()=>{
 const message='云端暂时不可用，本地收藏已保留，请稍后重试。',s=setup({pollError:message});await tick();
 assert.equal(s.node('accountStatus').hidden,true);
 await s.login();assert.equal(s.node('accountStatus').textContent,message);assert.equal(s.node('accountGithub').disabled,false);
 s.context.WhoI18n.set('en');s.context.window.dispatchEvent(new Event('who-language-change'));
 assert.match(s.node('accountStatus').textContent,/cloud service is temporarily unavailable/);assert.doesNotMatch(s.node('accountStatus').textContent,/expired|[\u4e00-\u9fff]/);
 s.context.WhoI18n.set('zh-CN');s.context.window.dispatchEvent(new Event('who-language-change'));assert.equal(s.node('accountStatus').textContent,message);
});
test('UI login leaves guest data local and ignores a save finishing after logout',async()=>{
 const s=setup();await tick();s.data.set('codelingo.cards','[{"id":1,"title":"guest","code":"x"}]');await s.login();assert.equal(s.calls.filter(x=>x.route==='save').length,0);
 s.store.setItem('codelingo.cards','[{"id":2,"title":"account","code":"y"}]');s.node('accountSync').onclick();await tick();assert.equal(s.calls.at(-1).route,'save');
 await s.node('accountLogout').onclick();s.finish();await tick();assert.equal(s.node('accountSignedIn').hidden,true);assert.match(s.store.getItem('codelingo.cards'),/guest/);assert.equal(JSON.parse(s.data.get('whoisjson.account-library.v1.a')).dirty,true);
 assert.ok(s.calls.every(x=>x.options.headers['X-CodeLingo-Token']==='local-token'));
});
test('initial cloud status enables login without switching the local library',async()=>{
 const s=setup();await tick();assert.equal(s.node('accountLogin').hidden,false);assert.equal(s.node('accountGithub').disabled,false);assert.match(s.node('libraryLocation').textContent,/本地/);
});
test('trial UI shows availability without monetary balance and clears on logout',async()=>{
 const s=setup();await tick();await s.login();await tick();
 assert.match(s.node('accountTrial').textContent,/正在使用 DeepSeek AI 试用/);
 assert.doesNotMatch(s.node('accountTrial').textContent,/¥|余额|1000000|15/);
 assert.equal(s.node('accountUseTrial').disabled,false);
 assert.equal(s.node('accountUseTrial').textContent,'取消 AI 试用');
 s.node('accountUseTrial').onclick();assert.equal(s.node('accountUseTrial').textContent,'使用 AI 试用');assert.equal(s.data.get('who.trial.off'),'1');
 s.node('accountUseTrial').onclick();assert.equal(s.node('accountUseTrial').textContent,'取消 AI 试用');
 await s.node('accountLogout').onclick();assert.equal(s.node('accountSignedIn').hidden,true);
});
test('manual refresh saves pending changes before loading and uses a transient success message',async()=>{
 const s=setup();await tick();await s.login();await tick();
 assert.equal(s.node('accountStatus').hidden,true);
 s.store.setItem('codelingo.cards','[{"id":3,"title":"keep","code":"x"}]');
 const work=s.node('accountSync').onclick();await tick();assert.equal(s.calls.at(-1).route,'save');s.finish();await work;
 assert.equal(s.calls.at(-1).route,'library');assert.match(s.store.getItem('codelingo.cards'),/keep/);assert.equal(s.store.snapshot().dirty,false);
 assert.equal(s.node('accountSyncToast').hidden,false);s.timers.at(-1)();assert.equal(s.node('accountSyncToast').hidden,true);
});
test('refresh conflict retains dirty local favorites and offers an explicit choice',async()=>{
 const s=setup();await tick();await s.login();s.store.setItem('codelingo.cards','[{"id":4,"title":"unsynced","code":"x"}]');s.conflict();
 const work=s.node('accountSync').onclick();await tick();s.finish();await work;
 assert.equal(s.calls.at(-1).route,'save');assert.equal(s.store.snapshot().dirty,true);assert.match(s.store.getItem('codelingo.cards'),/unsynced/);assert.equal(s.node('accountReplace').hidden,false);
});
test('first-use prompt can be dismissed and guest favorites are only offered for explicit import',async()=>{
 const s=setup();await tick();assert.equal(s.node('account').open,true);s.node('accountClose').onclick();assert.equal(s.node('account').open,false);assert.equal(s.data.get('who.welcome.seen'),'1');
 s.data.set('codelingo.cards','[{"id":5,"title":"guest","code":"x"}]');await s.login();assert.equal(s.node('accountGuest').hidden,false);assert.equal(s.store.snapshot().payload.cards.length,0);
 s.node('accountGuestSkip').onclick();assert.equal(s.node('accountGuest').hidden,true);
});

test('each unsigned startup prompts even when the old welcome was dismissed',async()=>{
 const s=setup({welcomeSeen:true});await tick();assert.equal(s.node('account').open,true);
 s.node('accountClose').onclick();assert.equal(s.node('account').open,false);
});

test('startup restores a valid account without asking it to log in again',async()=>{
 const s=setup({storedSession:'opaque',welcomeSeen:true});await tick();
 assert.equal(s.node('account').open,false);assert.equal(s.node('accountSignedIn').hidden,false);
});

test('an expired saved session shows the login prompt and its readable error',async()=>{
 const s=setup({storedSession:'expired',welcomeSeen:true,sessionExpired:true});await tick();
 assert.equal(s.node('account').open,true);assert.equal(s.node('accountSignedIn').hidden,true);assert.match(s.node('accountStatus').textContent,/登录已过期/);
});

const cloudQuota=(held=0,remaining=1000000)=>({enabled:true,remaining,held,poolRemaining:null,unlimitedPool:true,grant:2000000,currency:'CNY',unit:1000000});

test('quota timeout offers a translated read-only retry and recovers without signing in again',async()=>{
 let failure=true,finish;
 const s=setup({cloudbase:true,quotaProvider:()=>{if(failure)throw Object.assign(Error('timeout'),{name:'TimeoutError'});return new Promise(resolve=>{finish=()=>resolve(cloudQuota());});}});
 await tick();await s.login();await tick();
 assert.match(s.node('accountTrial').textContent,/查询超时.*尚未确认/);
 assert.equal(s.node('accountRetryQuota').hidden,false);assert.equal(s.node('accountUseTrial').disabled,true);
 s.context.WhoI18n.set('en');s.context.window.dispatchEvent(new Event('who-language-change'));
 assert.match(s.node('accountTrial').textContent,/balance check timed out/);
 assert.equal(s.node('accountRetryQuota').textContent,'Check trial balance again');
 const before=s.calls.length;failure=false;
 const work=s.node('accountRetryQuota').onclick();await tick();
 assert.equal(s.node('accountRetryQuota').disabled,true);
 await s.node('accountRetryQuota').onclick();assert.equal(s.calls.length,before+1);
 assert.equal(s.calls.at(-1).route,'trial-quota');
 finish();await work;
 assert.equal(s.node('accountRetryQuota').hidden,true);assert.equal(s.node('accountUseTrial').disabled,false);
 assert.equal(s.node('accountQuotaPercent').textContent,'50%');
 assert.equal(s.node('accountSignedIn').hidden,false);
});

test('quota read failures preserve known causes and retries never override empty or held balances',async()=>{
 let result=Error('额度服务暂时不可用。');
 const s=setup({cloudbase:true,quotaProvider:()=>{if(result instanceof Error)throw result;return result;}});
 await tick();await s.login();await tick();
 assert.equal(s.node('accountTrial').textContent,'额度服务暂时不可用。');
 result=Error('private transport detail');await s.node('accountRetryQuota').onclick();
 assert.match(s.node('accountTrial').textContent,/查询失败.*尚未确认/);
 assert.doesNotMatch(s.node('accountTrial').textContent,/private/);
 result=cloudQuota(0,0);await s.node('accountRetryQuota').onclick();
 assert.equal(s.node('accountUseTrial').disabled,true);assert.equal(s.node('accountRetryQuota').hidden,true);
 result=cloudQuota(100000);await s.context.window.WhoRefreshTrial();
 assert.equal(s.node('accountUseTrial').disabled,true);assert.match(s.node('accountTrial').textContent,/上一笔调用/);
});
test('opening a signed-in account rechecks quota and clears a stale settled hold',async()=>{
 let quota=cloudQuota(500000);
 const s=setup({cloudbase:true,quotaProvider:()=>quota});await tick();await s.login();await tick();
 assert.equal(s.context.window.WhoTrial.enabled,false);
 assert.match(s.node('accountTrial').textContent,/上一笔调用/);
 const before=s.calls.filter(c=>c.route==='trial-quota').length;
 quota=cloudQuota();s.node('accountBtn').onclick();await tick();
 assert.equal(s.calls.filter(c=>c.route==='trial-quota').length,before+1);
 assert.equal(s.context.window.WhoTrial.enabled,true);
 assert.equal(s.node('accountUseTrial').disabled,false);
 assert.doesNotMatch(s.node('accountTrial').textContent,/上一笔调用/);
 // A current real hold must still keep new trial calls disabled.
 quota=cloudQuota(100000);s.node('accountBtn').onclick();await tick();
 assert.equal(s.context.window.WhoTrial.enabled,false);
 assert.equal(s.node('accountUseTrial').disabled,true);
 await s.node('accountLogout').onclick();
 const afterLogout=s.calls.filter(c=>c.route==='trial-quota').length;
 s.node('accountBtn').onclick();await tick();
 assert.equal(s.calls.filter(c=>c.route==='trial-quota').length,afterLogout);
});

for(const staleError of [false,true])test('out-of-order quota '+(staleError?'error':'hold')+' cannot overwrite a newer successful check',async()=>{
 let defer=false,finish;
 const s=setup({cloudbase:true,quotaProvider:()=>defer?new Promise((resolve,reject)=>{finish=()=>staleError?reject(Error('额度服务暂时不可用。')):resolve(cloudQuota(500000));}):cloudQuota()});
 await tick();await s.login();await tick();
 defer=true;const older=s.context.window.WhoRefreshTrial();await tick();
 defer=false;await s.context.window.WhoRefreshTrial();
 finish();await older;
 assert.equal(s.context.window.WhoTrial.enabled,true);
 assert.equal(s.node('accountUseTrial').disabled,false);
 assert.doesNotMatch(s.node('accountTrial').textContent,/上一笔调用|暂不可用/);
});
