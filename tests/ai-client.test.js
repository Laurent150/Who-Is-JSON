const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {requestOptions,mergeOverview,modelCall,networkMessage}=require('../ai-client');
test('teaching rules preserve source and response format and stay out of non-explanation requests',()=>{
 const messages=[{role:'system',content:'Only return JSON.'},{role:'user',content:'async function f(){ return 1; }'}];
 const config={base:'https://api.deepseek.com',model:'deepseek-flash'};
 const body=requestOptions(config,messages,{explanation:true,json:true}).body;
 assert.match(body.messages[0].content,/async 声明使函数每次调用返回 Promise/);
 assert.match(body.messages[0].content,/普通同步上下文用 .then\(\)/);
 assert.match(body.messages[0].content,/try\/catch/);
 assert.equal(body.messages[1].content,messages[1].content);
 assert.equal(body.response_format.type,'json_object');
 assert.equal(messages[0].content,'Only return JSON.');
 assert.equal(requestOptions(config,messages).body.messages[0].content,'Only return JSON.');
});
test('DeepSeek uses bounded non-thinking output without changing other providers',()=>{
 const options=requestOptions({base:'https://api.deepseek.com',model:'deepseek-flash'},[],{json:true,maxTokens:5000});
 assert.equal(options.url.pathname,'/chat/completions');assert.equal(options.body.thinking.type,'disabled');assert.equal(options.body.max_tokens,5000);assert.equal(options.body.response_format.type,'json_object');
 assert.equal(requestOptions({base:'https://example.org/v1',model:'test'},[]).body.thinking,undefined);
 assert.throws(()=>requestOptions({base:'http://example.org',model:'test'},[]),/HTTPS/);
});
test('AI descriptions cannot replace parser positions, flow or reading units',()=>{
 const result={status:'ready',reading:[{start:2,text:'local'}],blocks:[{title:'f',start:1,end:3,controlFlow:[{start:2,end:2}],guide:{purpose:'local'}}]};
 const merged=mergeOverview(result,JSON.stringify({summary:'将数值加一。',blocks:[{index:0,start:999,controlFlow:[],purpose:'把输入加一后交回。',terms:[{name:'返回',meaning:'交回给调用者'}]},{index:99,purpose:'invented'}]}));
 assert.equal(merged.reading,result.reading);assert.equal(merged.blocks[0].controlFlow,result.blocks[0].controlFlow);assert.equal(merged.blocks[0].start,1);assert.equal(merged.blocks[0].guide,result.blocks[0].guide);assert.equal(merged.aiOverview.covered,1);assert.equal(result.blocks[0].aiExplanation,undefined);
 assert.throws(()=>mergeOverview(result,'null'),/用途说明/);assert.throws(()=>mergeOverview(result,'invalid'),/格式/);
});
test('transport handles valid replies, rejected credentials, truncation, cancellation and body timeout',async()=>{
 const server=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  if(body.model==='slow'){res.writeHead(200,{'Content-Type':'application/json'});res.write('{');return;}
  if(body.model==='reject'){res.writeHead(401);res.end('secret upstream details');return;}
  if(body.model==='bad-json'){res.end('not json');return;}
  res.end(JSON.stringify({choices:[{finish_reason:body.model==='long'?'length':'stop',message:{content:'把结果交回调用的位置。'}}]}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.match(await modelCall({base,model:'ok'},[]),/交回/);
  await assert.rejects(modelCall({base,model:'reject'},[]),/401.*密钥/);
  await assert.rejects(modelCall({base,model:'long'},[]),/长度限制/);
  await assert.rejects(modelCall({base,model:'bad-json'},[]),/不是完整 JSON/);
  await assert.rejects(modelCall({base,model:'slow'},[],{timeoutMs:50}),/超时/);
  const controller=new AbortController();const pending=modelCall({base,model:'slow'},[],{signal:controller.signal});setTimeout(()=>controller.abort(),20);await assert.rejects(pending,/取消/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 assert.match(networkMessage({cause:{code:'EACCES'}}),/网络权限/);
 assert.match(networkMessage({cause:{code:'ENOTFOUND'}}),/DNS/);
 assert.match(networkMessage({cause:{code:'CERT_HAS_EXPIRED'}}),/证书/);
});

test('selected source is extracted from actual input rather than model line counting',()=>{
 const {selectedSource}=require('../ai-client');
 assert.deepEqual(selectedSource('while lo < hi:\n    mid = lo + (hi-lo) // 2\n    x = 1',{start:2,end:2}),{start:2,end:2,code:'    mid = lo + (hi-lo) // 2'});
 assert.throws(()=>selectedSource('x',{start:0,end:3}),/范围无效/);
});
