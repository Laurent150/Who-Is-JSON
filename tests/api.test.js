const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{spawn}=require('node:child_process'),path=require('node:path');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
test('HTTP API handles local content, AI failures, vision input and authorization',async()=>{
 const reservation=http.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));const base='http://127.0.0.1:'+port;let token='',calls=[];
 const mock=http.createServer(async(req,res)=>{let data='';for await(const c of req)data+=c;const b=JSON.parse(data);const audit=mockFinalAudit(b);if(audit){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(audit));}calls.push(b);let content;
 if(b.model==='bad-json')content='not json';else if(b.model==='bad-lines')content=JSON.stringify({blocks:[{start:99,end:100,title:'bad'}]});
 else if(b.messages[0].content.includes('"related"')){const input=JSON.parse(b.messages[1].content);content=JSON.stringify({related:true,answer:b.messages[0].content.startsWith('You answer')?'The function returns the supplied value.':'这是模拟服务的追问答复。',evidence:[input.source.slice(0,240)]});}
 else if(b.messages[0].content.startsWith('Build a compact source-contract ledger')){const source=JSON.parse(b.messages[1].content).source;content=JSON.stringify({units:[{name:'f',anchor:source,accepts:'x',returns:'x',timing:'synchronous',paths:[{when:'called',does:'return x',completion:'x',failure:'none shown',anchor:source}],unknowns:[]}]});}
 else if(b.messages[0].content.startsWith('Write a coherent, source-grounded walkthrough')||b.messages[0].content.startsWith('为指定读者写一份连贯'))content=JSON.stringify({title:'Return',sections:[{title:'Result',text:b.messages[0].content.startsWith('Write a coherent')?'Return the supplied value.':'这个函数把传入的值原样交回。'}],questions:[]});
 else if(b.messages[0].content.startsWith('FIMI_TOKEN_HOVER_V1'))content=JSON.stringify(JSON.parse(b.messages[1].content).draftParagraphs?{corrections:[]}:{kind:'definition',answer:/Explain (?:only|selectedToken)/.test(b.messages[0].content)?'x is the value supplied to f.':'x 是传入函数的参数名。'});
 else if(/方法3复核候选V1|FIMI_METHOD3_PARAGRAPH_REVIEW_V1/.test(b.messages[0].content))content=JSON.stringify({corrections:[]});
 else if(b.messages[0].content.startsWith('You are writing a FIMI explanation'))content=b.messages[0].content.includes('(selectedToken)')?JSON.stringify({kind:'definition',answer:'x is the value supplied to f.'}):'The function returns the supplied value.';
 else if(b.messages[0].content.startsWith('你正在为 FIMI 生成中文词语点读初稿'))content=JSON.stringify({kind:'definition',answer:'x 是传入函数的参数名。'});
 else if(/REVIEW OUTPUT CONTRACT|本次复核输出约定（仅在复核时/.test(b.messages[0].content))content=JSON.stringify({corrections:[]});
 else if((b.messages[0].content.includes('Write all explanations in natural English')||b.messages[0].content.startsWith('FIMI_POINT_READING_V2:'))){
  const prompt=b.messages[0].content,input=JSON.parse(b.messages[1].content);
  if(prompt.startsWith('Explain the purpose'))content=JSON.stringify({summary:'Return the supplied value.',blocks:[{index:0,purpose:'Return the supplied value.'}]});
  else if(prompt.startsWith('Explain the supplied graph'))content=JSON.stringify({summary:'Return the value.',nodes:input.graph.nodes.map(n=>({id:n.id,title:'Return the value',explanation:'Pass the value back to the caller.'}))});
  else if(prompt.startsWith('Write a code walkthrough'))content=JSON.stringify({title:'Returning a value',sections:[{title:'Result',text:'The function returns the supplied value.'}],questions:[]});
  else if(prompt.startsWith('Explain the selected token'))content=JSON.stringify({kind:'definition',answer:'x is the value supplied to f.'});
  else content='The function returns the value supplied as x.';
 }
 else if(b.messages[0].content.includes('definition 或 lesson'))content=JSON.stringify({kind:'definition',answer:'x 是传入函数的参数名。'});
 else if(b.messages[0].content.includes('只判断源码'))content=JSON.stringify({language:'JavaScript',confidence:'high'});
 else if(b.messages[0].content.includes('复制格式修复建议'))content=JSON.stringify({code:'def f():\n    return 1',changes:['为函数体补上缩进'],uncertainty:'假设 return 属于该函数，请核对。'});
 else if(b.messages[0].content.includes('中文讲解稿'))content=JSON.stringify({title:'输入怎样返回',sections:[{title:'先看结果',text:'这个函数把传入的值原样交回。'}],questions:[]});
 else if(b.messages[0].content.includes('给定 graph')){const g=JSON.parse(b.messages[1].content).graph;content=JSON.stringify({summary:'按步骤处理输入。',nodes:g.nodes.map(n=>({id:n.id,title:'交回输入',explanation:'把输入交回调用者。'}))});}
 else if(Array.isArray(b.messages[1].content))content='const count = 2;';
 else if(b.messages[0].content.includes('只返回 JSON'))content=JSON.stringify({language:'JavaScript',summary:'简单测试功能',purpose:'测试服务生成，非真实模型评估。',warnings:[],blocks:[{index:0,kind:'function',title:'f',start:1,end:1,purpose:'把收到的值交回去。',inputs:'x',output:'x',symbols:[]}]});else content='这是模拟服务的追问答复。';
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content}}]}));
 });await new Promise(r=>mock.listen(0,'127.0.0.1',r));const mockBase='http://127.0.0.1:'+mock.address().port+'/v1';
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,WHO_SUPABASE_URL:"",WHO_SUPABASE_PUBLISHABLE_KEY:"",CODELINGO_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start timeout')),20000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('server exited '+code));});});
 token=JSON.parse((await(await fetch(base+'/config.js')).text()).match(/window.APP_TOKEN=(.*);/)[1]);
 const post=async(route,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
 assert.equal((await fetch(base+'/api/inbox')).status,403);
 assert.equal((await fetch(base+'/knowledge-library.js')).status,200);
 assert.equal((await fetch(base+'/reading-mode.js')).status,200);
 let imported=await post('inbox',{path:path.join(__dirname,'fixtures/user-python.Dockerfile')});assert.equal(imported.status,200);
 let incoming=await(await fetch(base+'/api/inbox',{headers:{'X-CodeLingo-Token':token}})).json();assert.match(incoming.code,/FROM python:3.12-slim/);assert.equal(incoming.name,'user-python.Dockerfile');
 let r=await post('analyze',{code:'SELECT name FROM people;',name:'x.sql'});assert.equal(r.status,200);assert.equal(r.body.language,'SQL');
 r=await post('analyze',{code:'x'.repeat(100001),name:'x.js'});assert.equal(r.status,400);
 for(const model of ['bad-json','bad-lines']){r=await post('analyze',{code:'function f(x){return x}',name:'x.js',ai:true,config:{base:mockBase,model}});assert.equal(r.status,400);assert.ok(r.body.error);}
 r=await post('analyze',{code:'function f(x){return x}',name:'x.js',ai:true,config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.status,'ready');assert.equal(r.body.mode,'ai');assert.match(r.body.aiOverview.summary,/简单测试/);assert.match(r.body.blocks[0].aiExplanation.purpose,/交回/);assert.ok(r.body.blocks[0].controlFlow.length);assert.equal(r.body.blocks[0].code,'function f(x){return x}');
 r=await post('flow',{code:'function f(x){return x}',name:'x.js',start:1,config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.origin,'ai');assert.match(r.body.nodes[0].title,/交回/);
 r=await post('talk',{code:'function f(x){return x}',name:'x.js',options:{audience:'beginner',duration:'30',coverage:'highlights'},config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.origin,'ai');assert.match(r.body.sections[0].text,/原样交回/);assert.equal(JSON.parse(calls.at(-1).messages[1].content).detail,'简要');
 r=await post('talk',{code:'x',options:{duration:'bad'},config:{base:mockBase,model:'good'}});assert.equal(r.status,400);
 r=await post('ocr',{image:'data:image/png;base64,aGVsbG8=',ai:true,config:{base:mockBase,model:'vision'}});assert.equal(r.status,200);assert.equal(r.body.code,'const count = 2;');assert.ok(calls.some(x=>Array.isArray(x.messages[1].content)));
 r=await post('ask',{code:'function f(x){return x}',question:'解释 x',selection:{start:1,end:1},config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.match(r.body.answer,/模拟服务/);assert.equal(JSON.parse(calls.at(-1).messages[1].content).selectedSource.code,'function f(x){return x}');
 r=await post('ask',{code:'const x = 1;',question:'解释 x',knowledge:true,token:{line:1,startColumn:6,endColumn:7,text:'fake'},config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.knowledge,undefined);assert.match(r.body.answer,/参数名/);assert.equal(JSON.parse(calls.at(-1).messages[1].content).selectedToken.text,'x');
 r=await post('prepare',{code:'{\n&#x20; "name": "x"\n}'});assert.ok(r.body.changes.length);assert.ok(!r.body.code.includes('&#x20;'));
 for(const asset of ['account.js','library-store.js','account-callback.js'])assert.equal((await fetch(base+'/'+asset)).status,200);
 assert.equal((await fetch(base+'/api/account/status',{method:'POST'})).status,403);
 const callback=await fetch(base+'/auth/callback?state=invalid&code=do-not-reflect');const callbackBody=await callback.text();assert.match(callbackBody,/登录未完成/);assert.ok(!callbackBody.includes('do-not-reflect'));assert.equal(callback.headers.get('referrer-policy'),'no-referrer');
 const accountStatus=await post('account/status',{});assert.equal(accountStatus.status,200);assert.equal(accountStatus.body.enabled,false);
 assert.equal((await post('account/github-start',{})).status,503);
 const samples=await(await fetch(base+'/api/examples',{headers:{'X-CodeLingo-Token':token}})).json();assert.equal(samples.length,require('./corpus/manifest.json').filter(x=>x.licenseRetrieved).length);assert.ok(samples.some(x=>x.name.endsWith('.java')));
 const beforeRepairCalls=calls.length;
 const ambiguous='class Box { read(value) { return value; } }';
 r=await post('analyze',{code:ambiguous,name:'',ai:false});assert.equal(r.body.needsLanguageHelp,true);assert.equal(calls.length,beforeRepairCalls);
 r=await post('analyze',{code:ambiguous,name:'',ai:false,identifyLanguage:true,config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.language,'JavaScript');assert.equal(r.body.languageIdentification.status,'verified');
 const method=r.body.blocks.find(b=>b.title==='read');assert.ok(method);
 r=await post('flow',{code:ambiguous,name:'',languageHint:'JavaScript',start:method.start,config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.origin,'ai');
 r=await post('analyze',{code:ambiguous,name:'',ai:false,identifyLanguage:true,config:{base:mockBase,model:'bad-json'}});assert.equal(r.status,200);assert.equal(r.body.languageIdentification.status,'failed');assert.equal(r.body.language,'未确定');
 const afterLanguageCalls=calls.length;
 r=await post('repair',{code:'字'.repeat(34000),config:{base:mockBase,model:'good'}});assert.equal(r.status,400);assert.equal(calls.length,afterLanguageCalls);
 r=await post('repair',{code:'def f():\nreturn 1',name:'x.py',config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.equal(r.body.origin,'ai');assert.equal(r.body.code,'def f():\n    return 1');assert.match(r.body.notice,/假设/);assert.equal(JSON.parse(calls.at(-1).messages[1].content).source,'def f():\nreturn 1');
 r=await post('repair',{code:'x',config:{base:mockBase,model:'bad-json'}});assert.equal(r.status,400);
 assert.equal((await fetch(base+'/api/repair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'x'})})).status,403);
 for(const mode of ['beginner','standard']){
  const common={code:'function f(x){return x}',name:'x.js',config:{base:mockBase,model:'good'},readingMode:mode};
  for(const [route,extra]of [['analyze',{ai:true}],['flow',{start:1}],['talk',{}],['ask',{pointReading:true,question:'只解释选中代码，需要时用一个小例子帮助理解。',selection:{start:1,end:1}}],['ask',{question:'解释',knowledge:true,token:{line:1,startColumn:11,endColumn:12}}]]){
   const response=await post(route,{...common,...extra});assert.equal(response.status,200);
   assert.match(calls.at(-1).messages[0].content,extra.knowledge?/FIMI_TOKEN_HOVER_V1/:mode==='beginner'?(route==='ask'?/方法3复核候选V1/:/当前为零基础友好模式/):/当前为标准模式/);
  }
 }
 for(const mode of ['beginner','standard']){
  const common={code:'function f(x){return x}',name:'x.js',locale:'en',config:{base:mockBase,model:'good'},readingMode:mode};
  for(const [route,extra]of [['analyze',{ai:true}],['flow',{start:1}],['talk',{}],['ask',{pointReading:true,question:'Explain only the selected code, using a small example when it helps.',selection:{start:1,end:1}}],['ask',{question:'Explain x',knowledge:true,token:{line:1,startColumn:11,endColumn:12}}]]){
   const response=await post(route,{...common,...extra});assert.equal(response.status,200,JSON.stringify(response.body));
   const request=calls.at(-1);assert.match(request.messages[0].content,extra.knowledge?/FIMI_TOKEN_HOVER_V1/:mode==='beginner'?(route==='ask'?/FIMI_METHOD3_PARAGRAPH_REVIEW_V1/:/BEGINNER MODE/):/STANDARD MODE/);
   assert.equal(JSON.parse(request.messages[1].content).source,common.code);
   if(route==='talk')assert.doesNotMatch(response.body.note,/[\u4e00-\u9fff]/);
   if(route==='ask')assert.match(response.body.answer,/value/);
  }
 }
 r=await post('repair',{code:'def f():\nreturn 1',name:'x.py',locale:'en',config:{base:mockBase,model:'good'}});assert.equal(r.status,200);assert.match(calls.at(-1).messages[0].content,/Write changes and uncertainty in natural English/);assert.equal(JSON.parse(calls.at(-1).messages[1].content).source,'def f():\nreturn 1');
 const teaching=['整份代码的用途','给定 graph','为指定读者写一份连贯','FIMI_POINT_READING_V2','FIMI_TOKEN_HOVER_V1'];
 for(const marker of teaching){
  const requests=calls.filter(c=>c.messages[0].content.includes(marker));
  assert.ok(requests.length,'missing explanation route: '+marker);
  for(const request of requests)assert.match(request.messages[0].content,marker==='FIMI_TOKEN_HOVER_V1'?/WORD \/ SYMBOL|词语／符号/:marker==='FIMI_POINT_READING_V2'?/当前|selected occurrence/:marker==='为指定读者写一份连贯'?/独立写作示例/:/async 声明使函数每次调用返回 Promise/);
 }
 for(const request of calls.filter(c=>/只判断源码|复制格式修复建议|只转录图片/.test(c.messages[0].content)))assert.ok(!request.messages[0].content.includes('async 声明使函数每次调用返回 Promise'));
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
