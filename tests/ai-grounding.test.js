const {mockFinalAudit}=require('./final-audit-mock.cjs');
// Legacy direct pipeline regression; the release default is tested separately.
process.env.WHO_TALK_PIPELINE='direct';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {modelCall,overviewBlocks,requestOptions,explainOverview}=require('../ai/ai-client');
const {explainFlow,attach}=require('../ai/ai-flow');
const {java}=require('../parsers/java');

test('review compares the original source and draft, and only returns the reviewed result',async()=>{
 const source='if value is not None:\n    saved = value',seen=[];
 const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
  seen.push(body);return {choices:[{finish_reason:'stop',message:{content:seen.length===1?'Wrong draft':'Save value only when it is not None.'}}]};
 }};
 const text=await modelCall(config,[{role:'system',content:'Explain the source.'},{role:'user',content:JSON.stringify({source})}],{explanation:true,locale:'en',readingMode:'beginner'});
 assert.equal(seen.length,2);assert.equal(text,'Save value only when it is not None.');
 assert.equal(JSON.parse(seen[1].messages[1].content).source,source);
 assert.equal(seen[1].messages[2].content,'Wrong draft');
 assert.match(seen[1].messages[0].content,/untrusted candidate text/);
 assert.match(seen[1].messages[0].content,/Python async def returns a coroutine/);
 const abort=new AbortController();abort.abort();
 await assert.rejects(modelCall(config,[],{explanation:true,signal:abort.signal}),/取消/);
});

test('flow requests carry exact node source and missing annotations remain explicit',async()=>{
 const source='setup();\nfunction f(x) {\n  return x + 1;\n}',seen=[];
 const result={language:'JavaScript',blocks:[{title:'f',start:2,end:4,controlFlow:[{kind:'return',start:3,end:3}]}]};
 const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;seen.push(body);return {choices:[{message:{content:JSON.stringify({summary:'Return the incremented value.',nodes:[]})}}]};}};
 const output=await explainFlow(result,source,2,config,{locale:'en'});
 const payload=JSON.parse(seen[0].messages[1].content);
 assert.equal(payload.graph.nodes[0].source,'  return x + 1;');
 assert.doesNotMatch(payload.selectedFunction.source,/setup/);
 assert.equal(output.nodes[0].missingExplanation,true);
 assert.match(output.nodes[0].explanation,/missing/);
 assert.equal(output.nodes[0].start,3);
 assert.equal(attach(output,JSON.stringify({summary:'x',nodes:[{id:'n1',title:'Return',explanation:'Return x plus one.'}]})).nodes[0].missingExplanation,false);
});

test('main functions outrank imports and nested conditions without changing block indices',()=>{
 const blocks=[...Array.from({length:15},(_,i)=>({kind:'import',start:i+1,end:i+1,title:'import'})),{kind:'function',start:20,end:40,title:'work'},{kind:'condition',start:21,end:39,title:'if'}];
 assert.deepEqual(overviewBlocks({blocks}).map(b=>b.index),[15]);
 assert.equal(blocks[15].title,'work');
});

test('overview carries source slices and token context includes the guarded assignment',async()=>{
 const source='// outside\nfunction f() {\n return 1;\n}',seen=[];
 const result={blocks:[{kind:'function',title:'f',start:2,end:4}]};
 await explainOverview(result,source,'f.js',{base:'https://example.org',model:'mock',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
  seen.push(body);return {choices:[{message:{content:JSON.stringify({summary:'Return one.',blocks:[{index:0,purpose:'Return one.'}]})}}]};
 }},{locale:'en'});
 assert.equal(JSON.parse(seen[0].messages[1].content).blocks[0].source,'function f() {\n return 1;\n}');
 const code='def update():\n    new = hook()\n    if new is not None:\n        current = new\n    return current';
 const token=require('../ai/ai-flow').tokenSource(code,{line:3,startColumn:18,endColumn:22});
 assert.equal(token.text,'None');assert.match(token.context.source,/current = new/);
 assert.equal(token.context.start,1);assert.equal(token.context.end,5);
});

test('reasoning review stays bounded and provider-specific; sponsored policy stays compatible',()=>{
 const config={base:'https://api.deepseek.com',model:'deepseek-flash'},options={reviewReasoning:true,maxTokens:5000,json:true};
 const body=requestOptions(config,[],options).body;
 assert.equal(body.thinking.type,'enabled');assert.equal(body.reasoning_effort,'high');assert.equal(body.max_tokens,16384);
 assert.equal(requestOptions(config,[],{...options,maxTokens:20000}).body.max_tokens,16384);
 assert.equal(requestOptions(config,[],{...options,task:'talk'}).body.max_tokens,24576);
 const sponsored=requestOptions({...config,sponsoredCall(){}},[],options).body;
 assert.equal(sponsored.thinking.type,'disabled');assert.equal(sponsored.max_tokens,5000);assert.equal(sponsored.reasoning_effort,undefined);
 const other=requestOptions({base:'https://example.org',model:'deepseek-flash'},[],options).body;
 assert.equal(other.thinking,undefined);assert.equal(other.reasoning_effort,undefined);
 assert.equal(requestOptions(config,[],{maxTokens:5000}).body.thinking.type,'disabled');
});

test('Java interfaces expose abstract, default and static methods without inventing abstract flow',()=>{
 const source='interface Check<T> {\n boolean test(T x);\n default boolean and(T x) { return test(x); }\n static int value() { return 1; }\n}\nclass Example { int field; }';
 const result=java(source);assert.equal(result.status,'ready');
 const methods=result.blocks.filter(b=>b.kind==='function');
 assert.deepEqual(methods.map(b=>b.title),['test','and','value']);
 assert.deepEqual(methods[0].controlFlow,[]);
 assert.equal(methods[1].controlFlow[0].kind,'return');
 assert.equal(methods[2].start,4);
 assert.equal(result.blocks.filter(b=>b.title==='Check').length,1);
 assert.ok(!methods.some(b=>b.title==='field'));
});

test('source-grounding checks reach both generation and review across tasks and languages',async()=>{
 const source='async function read(load) { const raw = await load(); try { return JSON.parse(raw); } catch { return null; } }';
 for(const locale of ['en','zh-CN'])for(const task of ['flow','talk','knowledge','overview','ask']){
  const seen=[];
  const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   seen.push(body);return {choices:[{message:{content:seen.length===1?(task==='talk'?'{"title":"Candidate","sections":[{"title":"Result","text":"Read the value."}],"questions":[]}':'{"summary":"Candidate"}'):'{"corrections":[]}'}}]};
  }};
  await modelCall(config,[{role:'system',content:'Explain'},{role:'user',content:JSON.stringify({source})}],{locale,task,json:true,explanation:true});
  for(const body of seen){
   assert.equal(JSON.parse(body.messages[1].content).source,source);
   assert.match(body.messages[0].content,locale==='en'?/ERROR BOUNDARIES: Inspect each function separately/:/异常范围：逐个函数/);
   assert.match(body.messages[0].content,locale==='en'?/including a throw before the first await/:/包括第一个await之前的throw/);
   assert.match(body.messages[0].content,locale==='en'?/not restricted to boolean true/:/真值不限于布尔true/);
   assert.match(body.messages[0].content,locale==='en'?/No unfinished self-correction/:/不输出“等等，也许/);
  }
 }
});
test('official DeepSeek uses direct walkthrough drafts and reasoning reviews without changing source',async()=>{
 const previous=global.fetch,seen=[];
 global.fetch=async(url,options)=>{
  const audit=mockFinalAudit(JSON.parse(options.body));if(audit)return Response.json(audit);
  seen.push(JSON.parse(options.body));
  return Response.json({choices:[{finish_reason:'stop',message:{content:seen.length%2===1?'{"title":"Check","sections":[{"title":"Use","text":"Check the value."}],"questions":[]}':'{"corrections":[]}'}}]});
 };
 try{
  const source='function check(value) { return value > 0; }';
  const config={base:'https://api.deepseek.com',model:'deepseek-flash'},request={locale:'en',readingMode:'beginner'};
  const {generateTalk}=require('../ai/ai-talk');
  await generateTalk(source,'short.js',{detail:'brief'},config,request);
  const longSource=source+'\n// Context line'.repeat(201);
  await generateTalk(longSource,'long.js',{detail:'brief'},config,request);
  assert.equal(seen.length,4);
  for(const i of [0,2]){assert.equal(seen[i].thinking.type,'disabled');assert.equal(seen[i].max_tokens,8192);}
  for(const i of [1,3]){assert.equal(seen[i].thinking.type,'enabled');assert.equal(seen[i].reasoning_effort,'high');assert.equal(seen[i].max_tokens,24576);}
  assert.equal(JSON.parse(seen[0].messages[1].content).source,source);
  assert.equal(JSON.parse(seen[2].messages[1].content).source,longSource);
 }finally{global.fetch=previous;}
});
