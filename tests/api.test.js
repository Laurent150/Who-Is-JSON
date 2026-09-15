const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{spawn}=require('node:child_process'),path=require('node:path');
test('HTTP API handles local content, AI failures, vision input and authorization',async()=>{
 const reservation=http.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));const base='http://127.0.0.1:'+port;let token='',calls=[];
 const mock=http.createServer(async(req,res)=>{let data='';for await(const c of req)data+=c;const b=JSON.parse(data);calls.push(b);let content;
 if(b.model==='bad-json')content='not json';else if(b.model==='bad-lines')content=JSON.stringify({blocks:[{start:99,end:100,title:'bad'}]});
 else if(b.messages[0].content.includes('中文代码解释稿'))content=JSON.stringify({title:'输入怎样返回',sections:[{title:'先看结果',text:'这个函数把传入的值原样交回。'}],questions:[]});
 else if(b.messages[0].content.includes('给定 graph')){const g=JSON.parse(b.messages[1].content).graph;content=JSON.stringify({summary:'按步骤处理输入。',nodes:g.nodes.map(n=>({id:n.id,title:'交回输入',explanation:'把输入交回调用者。'}))});}
 else if(Array.isArray(b.messages[1].content))content='const count = 2;';
 else if(b.messages[0].content.includes('只返回 JSON'))content=JSON.stringify({language:'JavaScript',summary:'简单测试功能',purpose:'测试服务生成，非真实模型评估。',warnings:[],blocks:[{index:0,kind:'function',title:'f',start:1,end:1,purpose:'把收到的值交回去。',inputs:'x',output:'x',symbols:[]}]});else content='这是模拟服务的追问答复。';
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content}}]}));
 });await new Promise(r=>mock.listen(0,'127.0.0.1',r));const mockBase='http://127.0.0.1:'+mock.address().port+'/v1';
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,CODELINGO_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start timeout')),20000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('server exited '+code));});});
 token=JSON.parse((await(await fetch(base+'/config.js')).text()).match(/window.APP_TOKEN=(.*);/)[1]);
 const post=async(route,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CodeLingo-Token':token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
 assert.equal((await fetch(base+'/api/inbox')).status,403);
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
 r=await post('prepare',{code:'{\n&#x20; "name": "x"\n}'});assert.ok(r.body.changes.length);assert.ok(!r.body.code.includes('&#x20;'));
 const samples=await(await fetch(base+'/api/examples',{headers:{'X-CodeLingo-Token':token}})).json();assert.equal(samples.length,require('./corpus/manifest.json').filter(x=>x.licenseRetrieved).length);assert.ok(samples.some(x=>x.name.endsWith('.java')));
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
