const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function workspace(api){
 const nodes=new Map();
 const context=vm.createContext({api,AbortController,AbortSignal,Error,config:{},current:{},analyzedSource:'async function value(){return 1}',fileName:'test.js',document:{addEventListener(){}},window:{addEventListener(){}},$:id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/studio.js'),'utf8'),context);
 return {call:()=>vm.runInContext("studioApi('ask',{})",context),stop:()=>nodes.get('studioStop').onclick(),pending:()=>vm.runInContext('studioControllers.size',context)};
}
test('stopping a pending workspace request has a readable message and retry works',async()=>{
 let calls=0;
 const app=workspace((route,data,method,signal)=>++calls===1?new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})):Promise.resolve({answer:'retried'}));
 const pending=app.call();app.stop();
 await assert.rejects(pending,/已停止生成，源码未修改，可以重试/);
 assert.equal(app.pending(),0);
 assert.equal((await app.call()).answer,'retried');
});
test('a reply that arrives after stopping cannot become a successful cached answer',async()=>{
 let finish;const app=workspace(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=app.call();app.stop();finish({answer:'late answer'});
 await assert.rejects(pending,/已停止生成/);assert.equal(app.pending(),0);
});
test('timeouts and service failures stay distinct from user cancellation',async()=>{
 const timeout=workspace(async()=>{const e=new Error('raw timeout');e.name='TimeoutError';throw e;});
 await assert.rejects(timeout.call(),/响应超时/);
 const failed=workspace(async()=>{throw new Error('AI 服务返回 401。密钥无效。');});
 await assert.rejects(failed.call(),/401/);
 assert.equal(timeout.pending(),0);assert.equal(failed.pending(),0);
});
