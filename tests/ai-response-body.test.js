const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {modelCall}=require('../ai/ai-client');

test('a real response stream interruption is not mislabeled as invalid JSON and is never replayed',async()=>{
 let calls=0;
 const server=http.createServer((_req,res)=>{
  calls++;res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();
  res.write('{"choices":[');setTimeout(()=>res.destroy(),20);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await assert.rejects(()=>modelCall({base:'http://127.0.0.1:'+server.address().port,model:'test'},[],{usagePhase:'contracts'}),error=>{
   assert.match(error.message,/连接被拒绝或中断/);assert.doesNotMatch(error.message,/JSON/);
   assert.equal(error.diagnostics.stage,'provider-response');assert.equal(error.diagnostics.aiPhase,'contracts');
   assert.equal(error.diagnostics.providerStatus,200);assert.equal(error.diagnostics.transportCode,'UND_ERR_SOCKET');
   assert.ok(error.diagnostics.elapsedMs>=0);return true;
  });
  assert.equal(calls,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('JSON syntax, body timeouts and unknown read errors remain distinct without exposing provider data',async()=>{
 const original=global.fetch;
 try{
  for(const [response,expected] of [
   [()=>new Response('private malformed data'),/不是完整 JSON/],
   [()=>({ok:true,status:200,json:async()=>{throw new DOMException('private timeout','TimeoutError');}}),/响应超时/],
   [()=>({ok:true,status:200,json:async()=>{throw Error('private source and credentials');}}),/无法连接 AI 服务/]
  ]){
   let calls=0;global.fetch=async()=>{calls++;return response();};
   await assert.rejects(()=>modelCall({base:'https://provider.example',model:'test'},[],{usagePhase:'review'}),error=>{
    assert.match(error.message,expected);assert.doesNotMatch(error.message+JSON.stringify(error),/private/);
    assert.equal(error.diagnostics.stage,'provider-response');assert.equal(error.diagnostics.aiPhase,'review');return true;
   });assert.equal(calls,1);
  }
  global.fetch=async()=>new Response('\n\n'+JSON.stringify({choices:[{message:{content:'Unchanged text.'}}]})+'\n');
  assert.equal(await modelCall({base:'https://provider.example',model:'test'},[]),'Unchanged text.');
 }finally{global.fetch=original;}
});

test('source-analysis truncation stops before composition or paid repair and names the actual failed stage',async()=>{
 let calls=0;
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async()=>{
  calls++;return {usage:{prompt_tokens:10,completion_tokens:16384,total_tokens:16394,completion_tokens_details:{reasoning_tokens:15261}},choices:[{finish_reason:'length',message:{content:'{"units":['}}]};
 }};
 await assert.rejects(()=>require('../ai/ai-talk-contracts').derive('function echo(value) { return value; }','echo.js',config,{locale:'zh-CN'}),error=>{
  assert.equal(error.code,'AI_CONTRACT_LENGTH');assert.equal(error.diagnostics.aiPhase,'contracts');
  assert.match(error.message,/源码分析.*输出上限/);assert.doesNotMatch(error.message,/较小范围/);return true;
 });assert.equal(calls,1);
 const context=vm.createContext({});
 for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file+'.js'),'utf8'),context);
 const message='AI 源码分析达到本次输出上限，未能完成；本次未生成讲解稿。';
 context.WhoI18n.set('en');const en=context.WhoI18n.error(Error(message));
 assert.match(en,/Source analysis reached its output limit/);assert.doesNotMatch(en,/[\u3400-\u9fff]/);
 context.WhoI18n.set('zh-CN');assert.equal(context.WhoI18n.error(Error(en)),message);
});
