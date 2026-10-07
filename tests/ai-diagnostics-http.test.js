const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),http=require('node:http');
const requestId='b3677a72-cad2-4f7d-934f-794d6d608bd5';
test('real HTTP failure response retains safe request and phase metadata',async()=>{
 const socket=http.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const bootstrap=`
  global.fetch=async()=>{throw Error('Unexpected external fetch');};
  const cloud=require(${JSON.stringify(require.resolve('../cloud-account'))});
  cloud.createCloudAccount=()=>({handle:async()=>({enabled:false}),trialConfig:()=>({
   base:'https://api.deepseek.com',model:'deepseek-flash',sponsoredCall:async()=>{
    const error=Error('已收到 AI 响应，但试用额度结算未确认，请勿连续重试。');
    error.diagnostics={code:'trial_settlement_failed',stage:'settlement',requestId:${JSON.stringify(requestId)},settlement:'unknown',key:'private-key'};
    throw error;
   }
  })});
  require(${JSON.stringify(require.resolve('../server'))});`;
 const child=spawn(process.execPath,['-e',bootstrap],{env:{...process.env,CODELINGO_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',chunk=>{logs+=chunk;});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),15000);
   child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',error=>{clearTimeout(timer);reject(error);});});
  const base='http://127.0.0.1:'+port;
  const config=await(await fetch(base+'/config.js')).text(),token=JSON.parse(config.match(/window.APP_TOKEN=(.*);/)[1]);
  const response=await fetch(base+'/api/talk',{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':token},body:JSON.stringify({code:'function echo(value) { return value; }',name:'echo.js',config:{provider:'platform'},options:{audience:'beginner',detail:'standard'},locale:'en'})});
  assert.equal(response.status,400);const body=await response.json();
  assert.deepEqual(body.diagnostics,{code:'trial_settlement_failed',stage:'settlement',aiPhase:'contracts',requestId,settlement:'unknown'});
  assert.match(body.error,/结算未确认/);assert.doesNotMatch(JSON.stringify(body),/private-key/);
  await new Promise(resolve=>setImmediate(resolve));
  const records=logs.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  assert.deepEqual(records,[{event:'fimi_ai_failure',...body.diagnostics}]);
 }finally{child.kill();}
});
