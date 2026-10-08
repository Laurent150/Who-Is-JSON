const {test}=require('node:test'),assert=require('node:assert/strict');
const {modelCall,requestOptions}=require('../ai-client'),point=require('../ai-point');
const knowledge=require('../ai-knowledge'),contract=require('../ai-point-contract');
const config={base:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const source='async function load(value) {\r\n  const result = await transform(value);\r\n  return result;\r\n}';
const selectedSource={start:2,end:2,code:source.split('\n')[1]};
const token={text:'transform',line:2,startColumn:23,endColumn:32,sourceLine:selectedSource.code};
const messages=data=>[{role:'system',content:'Old generic teaching rules.'},{role:'user',content:JSON.stringify({source,selectedSource,...data})}];
const reply=(content,finish='stop')=>Response.json({model:'deepseek-flash',usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:finish,message:{content}}]});
async function capture(action,answer='The selected action.',finish='stop') {
 const previous=globalThis.fetch,bodies=[];
 globalThis.fetch=async(url,request)=>{assert.equal(new URL(url).origin,'https://api.deepseek.com');bodies.push(JSON.parse(request.body));return reply(answer,finish);};
 try{return {result:await action(),bodies};}finally{globalThis.fetch=previous;}
}

test('official Flash local selections emit one isolated scope-controlled draft across locale and mode',async()=>{
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const scope of ['token','line','passage']){
  const question=locale==='en'?'Explain only this occurrence.':'只解释这里。';
  const selection=scope==='passage'?{start:1,end:4,code:source}:selectedSource;
  const opts={locale,readingMode,explanation:true,pointReading:true};
  const answer=scope==='token'?JSON.stringify({kind:'definition',answer:'A local function call.'}):'A local explanation.\n\nNecessary second paragraph.';
  const {result,bodies}=await capture(()=>scope==='token'?knowledge.explain(source,token,config,{...opts,name:'load.js'}):modelCall(config,messages({selectedSource:selection,question,reviewContext:{fake:true}}),opts),answer);
  assert.equal(bodies.length,1);const body=bodies[0];
  assert.equal(body.model,config.model);assert.deepEqual(body.thinking,{type:'enabled'});assert.equal(body.reasoning_effort,scope==='line'&&readingMode==='standard'?'high':'low');assert.equal(body.max_tokens,6000);
  const system=body.messages[0].content;
  const expected=scope==='token'?require('../ai-token-prompts').draft(locale,readingMode):contract.profile(locale,readingMode,scope)+(locale==='en'?'\nReturn only the explanation as plain text.':'\n只返回解释正文，不使用JSON包装。');
  assert.equal(system,expected);assert.equal(body.messages.length,2);
  assert.doesNotMatch(system,/FUNCTION CONTRACTS|ERROR BOUNDARIES|ASYNC INPUT.?OUTPUT|FIMI_REVIEW_CONTEXT_V1|caller.*Promise|calling.*Promise/i);
  if(locale==='en')assert.doesNotMatch(system,/[\u3400-\u9fff]/);
  const sent=JSON.parse(body.messages[1].content);assert.equal(sent.source,source);assert.equal(sent.reviewContext,undefined);
  if(scope!=='token'){assert.equal(sent.question,question);assert.deepEqual(sent.selectedSource,selection);assert.equal(result,answer);assert.equal(body.response_format,undefined);}
  else {assert.deepEqual(result,{answer:'A local function call.'});assert.deepEqual(body.response_format,{type:'json_object'});}
 }
});

test('one-pass capability requires exact official Flash with no hosted adapter',()=>{
 for(const candidate of [{...config,model:'deepseek-v4-pro'},{...config,model:'future-flash'},{...config,base:'https://compatible.example'},{...config,base:'https://api.deepseek.com:444'},{...config,base:'http://api.deepseek.com'},{...config,sponsoredCall(){},reviewThinking:true},{...config,base:'invalid'}]){
  assert.equal(point.supportsLow(candidate),false);
  if(candidate.base==='http://api.deepseek.com'){assert.throws(()=>requestOptions(candidate,[],{pointDraftLow:true}),/HTTPS/);continue;}
  const body=requestOptions(candidate.base==='invalid'?{...candidate,base:'https://example.org'}:candidate,[],{pointDraftLow:true}).body;
  assert.equal(body.model,candidate.model);assert.equal(body.reasoning_effort,undefined);
  const highBody=requestOptions(candidate.base==='invalid'?{...candidate,base:'https://example.org'}:candidate,[],{pointDraftHigh:true}).body;
  assert.equal(highBody.model,candidate.model);assert.equal(highBody.reasoning_effort,undefined);
 }
 assert.equal(point.supportsLow(config),true);
 assert.equal(requestOptions(config,[],{pointDraftLow:true}).timeoutMs,120000);
 assert.equal(requestOptions(config,[],{pointDraftHigh:true}).timeoutMs,120000);
});

test('free-form asks and nonboolean/body intent cannot select the low route',()=>{
 for(const readingMode of ['beginner','standard'])for(const question of ['Make this simpler and give an example.','Why is this awaited?']){
  for(const intent of [undefined,false,'true',1]){
   const result=point.route(messages({question,pointReading:true,pointDraftLow:true}),{explanation:true,readingMode,pointReading:intent},config);
   assert.equal(result?.direct||false,false);
  }
  const result=point.route(messages({question}),{explanation:true,readingMode,pointReading:true},config);
  assert.equal(result.direct,true);assert.equal(result.input.question,question);
 }
 for(const task of ['talk','flow','overview'])assert.equal(point.route(messages({}),{explanation:true,pointReading:true,task},config),null);
 assert.equal(point.route(messages({}),{explanation:true,pointReading:true,json:true},config),null);
 assert.equal(point.route(messages({}),{explanation:true,pointReading:true,evaluationReview:{}},config),null);
});

test('standard direct default questions do not impose a beginner audience',async()=>{
 for(const locale of ['en','zh-CN'])for(const question of [undefined,'   ']){
  const {bodies}=await capture(()=>modelCall(config,messages({question}),{explanation:true,pointReading:true,readingMode:'standard',locale}));
  const sent=JSON.parse(bodies[0].messages[1].content);
  assert.match(sent.question,locale==='en'?/programming experience/:/基础编程经验/);
  assert.doesNotMatch(sent.question,/no programming background|没有编程背景/);
 }
});

test('unsupported provider keeps prior stages despite explicit point intent',async()=>{
 for(const readingMode of ['beginner','standard']){
  const bodies=[],provider={...config,reviewThinking:true,sponsoredCall:async body=>{
   bodies.push(body);const audit=require('./final-audit-mock.cjs').mockFinalAudit(body);if(audit)return audit;
   return await reply(readingMode==='beginner'&&bodies.length===2?'{"corrections":[]}':'A local explanation.').json();
  }};
  await modelCall(provider,messages({question:'Give an example.'}),{explanation:true,pointReading:true,readingMode,locale:'en'});
  assert.equal(bodies.length,readingMode==='beginner'?2:3);
  assert.equal(bodies[0].thinking.type,'disabled');assert.equal(bodies[0].reasoning_effort,undefined);assert.equal(bodies[1].reasoning_effort,'high');
 }
});

test('single low draft retains token schema/display guards and rejects incomplete responses without retry',async()=>{
 for(const [answer,finish,pattern]of [['','stop',/可用的文本/],['   ','stop',/可用的文本/],['partial','length',/长度限制/],['{"kind":"definition","answer":"x","extra":true}','stop',/格式不完整/],['{"kind":"definition","answer":""}','stop',/格式不完整/],[JSON.stringify({kind:'definition',answer:'x'.repeat(2401)}),'stop',/长度限制/]]){
  let count=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{count++;return reply(answer,finish);};
  try {await assert.rejects(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),pattern);assert.equal(count,1);}finally{globalThis.fetch=previous;}
 }
 for(const [answer,finish]of [['','stop'],['partial','length']])await assert.rejects(()=>capture(()=>modelCall(config,messages({}),{explanation:true,pointReading:true,readingMode:'standard'}),answer,finish));
});

test('single low draft validates exact source and cancellation on both sides of dispatch',async()=>{
 const aborted=new AbortController();aborted.abort();let count=0;const previous=globalThis.fetch;
 globalThis.fetch=async()=>{count++;return reply('unused');};
 try {
  const opts={explanation:true,pointReading:true,readingMode:'standard'};
  await assert.rejects(()=>modelCall(config,messages({}),{...opts,signal:aborted.signal}),/取消/);
  await assert.rejects(()=>modelCall(config,messages({selectedSource:{...selectedSource,code:'changed'}}),opts),/重新选择/);
  await assert.rejects(()=>knowledge.explain(source,{...token,text:'changed'},config,opts),/重新选择/);
  assert.equal(count,0);
  const during=new AbortController();await assert.rejects(()=>modelCall(config,messages({}),{...opts,signal:during.signal,onModelText:()=>during.abort()}),/取消/);assert.equal(count,1);
 }finally{globalThis.fetch=previous;}
});

test('direct token narrowly normalizes the observed json_object label without altering its answer',async()=>{
 const answer='A function call with 原始名称 and a second sentence.';
 const {result,bodies}=await capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify({type:'json_object',answer}));
 assert.deepEqual(result,{answer});assert.equal(bodies.length,1);
 assert.equal(point.draftAnswer(JSON.stringify({type:'json_object',answer}),'token',true),answer);
 assert.throws(()=>point.draftAnswer(JSON.stringify({type:'json_object',answer}),'token'),/格式不完整/);
 const raw=JSON.stringify({type:'json_object',answer});assert.equal(point.draftAnswer(raw,'passage',true),raw);
 for(const value of [{type:'unknown',answer},{type:'definition',answer},{kind:'unknown',answer},{kind:'lesson',answer},{type:'json_object',kind:'definition',answer},{type:'json_object',answer,extra:true},{type:'json_object',answer:''},{type:'json_object',answer:'  '},{type:'json_object',answer:12},{answer}]){
  await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify(value)),/格式不完整/);
 }
 await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),'not JSON'),/格式不完整/);
 await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify({type:'json_object',answer:'x'.repeat(2401)})),/长度限制/);
 let calls=0;const legacy={...config,reviewThinking:true,sponsoredCall:async()=>{calls++;return await reply(raw).json();}};
 await assert.rejects(()=>knowledge.explain(source,token,legacy,{readingMode:'beginner'}),/格式不完整/);assert.equal(calls,1);
});
