const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),http=require('node:http');
test('HTTP boundary reports only cloud-confirmed refunds and leaves local-only failures unconfirmed',async()=>{
 const socket=http.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const bootstrap=`
  global.fetch=async()=>{throw Error('Unexpected external request');};
  require(${JSON.stringify(require.resolve('../cloud-account'))}).createCloudAccount=()=>({trialConfig(req,options){
   if(options.refundFailures!==true)throw Error('Missing operation boundary');
   const mode=req.headers['x-test-outcome'];let spent=0;
   return {mode,sponsoredCall:async()=>{spent+=5;},finishTrial:async success=>{
    process.send({mode,success});
    if(mode==='refund-outage'||mode==='commit-loss'||mode==='invalid')throw Error('refund not confirmed');
    if(!success)spent=0;
    process.send({mode,spent});return success?'succeeded':'refunded';
   }};
  }});
  require(${JSON.stringify(require.resolve('../ai-module-reading'))}).explainModule=async(r,source,start,config)=>{
   await config.sponsoredCall();await config.sponsoredCall();
   if(['invalid','refund-outage','cloud-failure'].includes(config.mode))throw Error('模型返回的内容无法对应当前源码，请重试。');
   return {answer:'valid code explanation'};
  };
  require(${JSON.stringify(require.resolve('../server'))});`;
 const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,CODELINGO_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
 const events=[];child.on('message',v=>events.push(v));let stderr='';child.stderr.on('data',v=>stderr+=v);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout '+stderr)),15000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  const base='http://127.0.0.1:'+port,config=await(await fetch(base+'/config.js')).text(),token=JSON.parse(config.match(/window.APP_TOKEN=(.*);/)[1]);
  for(const mode of ['ok','invalid','commit-loss','refund-outage','cloud-failure']){
   const response=await fetch(base+'/api/module-reading',{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':token,'X-Test-Outcome':mode},body:JSON.stringify({code:'function echo(value) { return value; }',name:'test.js',start:1,config:{provider:'platform'},locale:'en'})});
   const body=await response.json();assert.equal(response.status,mode==='ok'?200:400);
   if(mode==='ok')assert.equal(body.answer,'valid code explanation');
   else assert.equal(body.trialRefund,mode==='cloud-failure'?'refunded':'refund_pending');
  }
  await new Promise(r=>setImmediate(r));
  assert.ok(events.some(e=>e.mode==='ok'&&e.spent===10));
  assert.ok(events.some(e=>e.mode==='cloud-failure'&&e.spent===0));
  for(const mode of ['invalid','commit-loss'])assert.ok(!events.some(e=>e.mode===mode&&e.spent===0));
  assert.deepEqual(events.filter(e=>e.mode==='commit-loss'&&'success'in e).map(e=>e.success),[true,false]);
 }finally{child.kill();}
});
