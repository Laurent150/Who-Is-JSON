const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
test('production HTTP serves the point display script as executable browser-global JavaScript',async()=>{
 const root=path.resolve(__dirname,'..'),port=await new Promise(resolve=>{const reservation=http.createServer();reservation.listen(0,'127.0.0.1',()=>{const port=reservation.address().port;reservation.close(()=>resolve(port));});});
 const app=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1',NODE_OPTIONS:''},windowsHide:true,stdio:'ignore'});
 try{
  const base='http://127.0.0.1:'+port;let ready=false;
  for(let i=0;i<80;i++){try{ready=(await fetch(base+'/health',{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'isolated production server started');
  const response=await fetch(base+'/point-display.js');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  const script=await response.text();assert.equal(script,fs.readFileSync(path.join(root,'public/point-display.js'),'utf8'));
  const browser=vm.createContext({});vm.runInContext(script,browser,{timeout:1000});assert.equal(typeof browser.WhoPointDisplay?.text,'function');
  assert.equal(browser.WhoPointDisplay.text('Read `value`.'),"Read 'value'.");
  assert.equal(browser.WhoPointDisplay.text('```js\nconst text = `x`;\n```'),'const text = `x`;\n');
 }finally{
  if(app.exitCode===null){const exited=new Promise(resolve=>app.once('exit',resolve));app.kill();await exited;}
 }
});
