const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
function setup(){
 const nodes=new Map(),data=new Map(),events=new Map(),calls=[],timers=[];let pendingSave;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',hidden:false,open:false,showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context=vm.createContext({Event,AbortSignal,localStorage:storage,sessionStorage:storage,$:node,library(){},download(){},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},window:{open:()=>({opener:null,location:{},close(){}}),APP_TOKEN:'local-token',dispatchEvent:e=>events.get(e.type)?.(),addEventListener:(k,v)=>events.set(k,v)},fetch:async(url,options)=>{
  const route=url.split('/').at(-1);calls.push({route,options});
  if(route==='status')return Response.json({enabled:true});
  if(route==='github-start')return Response.json({ticket:'ticket',url:'https://example.supabase.co/auth/v1/authorize'});
  if(route==='github-poll')return Response.json({session:'opaque'});
  if(route==='library')return Response.json({user:{id:'a',email:'a@example.com'},revision:0,payload:{knowledge:[],cards:[]}});
  if(route==='trial-quota')return Response.json({enabled:true,remaining:1000000,held:0,poolRemaining:15000000});
  if(route==='save')return new Promise(resolve=>pendingSave=()=>resolve(Response.json({revision:1})));
  return Response.json({ok:true});
 }});
 for(const file of ['library-store','account'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file+'.js'),'utf8'),context);
 return {nodes,node,data,calls,timers,store:context.window.WhoLibraryStore,finish:()=>pendingSave(),login:async()=>{await node('accountGithub').onclick();}};
}
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
 assert.match(s.node('accountTrial').textContent,/可使用 AI 试用/);
 assert.doesNotMatch(s.node('accountTrial').textContent,/¥|余额|1000000|15/);
 assert.equal(s.node('accountUseTrial').disabled,false);
 await s.node('accountLogout').onclick();assert.equal(s.node('accountSignedIn').hidden,true);
});
