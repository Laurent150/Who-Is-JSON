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
 for(const locale of ['en','zh-CN']){
  const declarationSource='const count = 3;',declarationToken={text:'const',line:1,startColumn:0,endColumn:5,sourceLine:declarationSource};
  const {bodies}=await capture(()=>knowledge.explain(declarationSource,declarationToken,config,{locale,readingMode:'beginner',name:'count.js'}),JSON.stringify({kind:'definition',effect:'The declaration gives count the value 3.'}));
  assert.equal(bodies.length,1);const sent=JSON.parse(bodies[0].messages[1].content);assert.equal(sent.source,declarationSource);
  assert.match(bodies[0].messages[0].content,locale==='en'?/For a function declaration keyword, explain establishing the reusable operation/:/声明函数的词可说明建立可重复使用的操作/);
  assert.doesNotMatch(bodies[0].messages[0].content,/For a declaration word, explain establishing|声明词可说明建立/);
 }

 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const scope of ['token','line','passage']){
  const question=locale==='en'?'Explain only this occurrence.':'只解释这里。';
  const selection=scope==='passage'?{start:1,end:4,code:source}:selectedSource;
  const opts={locale,readingMode,explanation:true,pointReading:true};
  const answer=scope==='token'?JSON.stringify({kind:'definition',effect:'A local function call.'}):'A local explanation.\n\nNecessary second paragraph.';
  const {result,bodies}=await capture(()=>scope==='token'?knowledge.explain(source,token,config,{...opts,name:'load.js'}):modelCall(config,messages({selectedSource:selection,question,reviewContext:{fake:true}}),opts),answer);
  assert.equal(bodies.length,1);const body=bodies[0];
  assert.equal(body.model,config.model);assert.deepEqual(body.thinking,{type:'enabled'});assert.equal(body.reasoning_effort,scope==='line'&&readingMode==='standard'?'high':'low');assert.equal(body.max_tokens,6000);
  const system=body.messages[0].content;
  const expected=scope==='token'?(require('../ai-point-await-line').classify(JSON.parse(body.messages[1].content),readingMode)?require('../ai-point-await-line').prompt(locale,readingMode,'token'):require('../ai-token-prompts').semanticDraft(JSON.parse(body.messages[1].content),locale,readingMode,true)):contract.profile(locale,readingMode,scope,undefined,true)+(locale==='en'?'\nReturn only the explanation as plain text.':'\n只返回解释正文，不使用JSON包装。');
  assert.equal(system,expected);assert.equal(body.messages.length,2);
  if(scope==='line'&&readingMode==='beginner'){
   assert.match(system,locale==='en'?/roster holds the complete list of names; batch is the small group produced this time/:/roster是完整的姓名名单，batch是这次得到的小组/);
   assert.match(system,locale==='en'?/other endpoints or negative steps retain their real semantics/:/其他终点或负步长保留真实语义/);
   assert.match(system,locale==='en'?/Actual roles must come from source/:/实际角色须由源码证明/);
  }else assert.doesNotMatch(system,/roster holds|roster是完整/);
  if(scope==='token'&&readingMode==='beginner'&&!require('../ai-point-await-line').classify(JSON.parse(body.messages[1].content),readingMode))assert.match(system,locale==='en'?/surrounding signature is evidence, not a checklist/:/周围完整声明是证据，不是待逐项解释的清单/);
  else assert.doesNotMatch(system,/surrounding signature is evidence|周围完整声明是证据/);
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

test('generic semantic token transport preserves fields and old decoder isolation',async()=>{
 const effect='  One idea.\nInternal line. ',details='  Another developed task.  ';
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const {result,bodies}=await capture(()=>knowledge.explain(source,token,config,{readingMode,locale}),JSON.stringify({kind:'definition',effect,details,type:'json_object'}));
  assert.equal(result.answer,effect+'\n\n'+details);assert.equal(bodies.length,1);assert.equal(bodies[0].max_tokens,6000);
  assert.doesNotMatch(bodies[0].messages[0].content,/paragraphs is a nonempty|Transport contract:|传输协议：/);
 }
 const raw=JSON.stringify({kind:'definition',paragraphs:[' old characters ',' old paragraph ']});
 assert.equal(point.draftAnswer(raw,'token',true),' old characters \n\n old paragraph ');
 assert.throws(()=>point.draftAnswer(raw,'token',true,true),/格式不完整/);
 assert.throws(()=>point.draftAnswer(raw,'token'),/格式不完整/);
 for(const locale of ['en','zh-CN'])for(const mode of ['beginner','standard']){const legacy=require('../ai-token-prompts').draft(locale,mode);assert.match(legacy,/kind="definition"/);assert.doesNotMatch(legacy,/"effect":|"paragraphs":/);}
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
 for(const [answer,finish,pattern]of [['','stop',/可用的文本/],['   ','stop',/可用的文本/],['partial','length',/长度限制/],['{"kind":"definition","answer":"x","extra":true}','stop',/格式不完整/],['{"kind":"definition","answer":""}','stop',/格式不完整/],[JSON.stringify({kind:'definition',effect:'x'.repeat(2401)}),'stop',/长度限制/]]){
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
 const {result,bodies}=await capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify({type:'json_object',kind:'definition',effect:answer}));
 assert.deepEqual(result,{answer});assert.equal(bodies.length,1);
 assert.equal(point.draftAnswer(JSON.stringify({type:'json_object',answer}),'token',true),answer);
 assert.throws(()=>point.draftAnswer(JSON.stringify({type:'json_object',answer}),'token'),/格式不完整/);
 const raw=JSON.stringify({type:'json_object',answer});assert.equal(point.draftAnswer(raw,'passage',true),raw);
 for(const value of [{type:'unknown',answer},{type:'definition',answer},{kind:'unknown',answer},{kind:'lesson',answer},{type:'json_object',kind:'definition',answer},{type:'json_object',answer,extra:true},{type:'json_object',answer:''},{type:'json_object',answer:'  '},{type:'json_object',answer:12},{answer}]){
  await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify(value)),/格式不完整/);
 }
 await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),'not JSON'),/格式不完整/);
 await assert.rejects(()=>capture(()=>knowledge.explain(source,token,config,{readingMode:'standard'}),JSON.stringify({type:'json_object',kind:'definition',effect:'x'.repeat(2401)})),/长度限制/);
 let calls=0;const legacy={...config,reviewThinking:true,sponsoredCall:async()=>{calls++;return await reply(raw).json();}};
 await assert.rejects(()=>knowledge.explain(source,token,legacy,{readingMode:'beginner'}),/格式不完整/);assert.equal(calls,1);
});


test('semantic transport is routed only for beginner function and exception candidates',async()=>{
 const cases=[['s.py','def twice(x): return x * 2','def',true],['s.py','raise RuntimeError("missing")','raise',true],['s.py','if missing: raise RuntimeError("missing")','raise',true],['s.py','value = 1; raise RuntimeError("missing")','raise',true],['s.py','label = "raise"','raise',false],['s.py','doc = """\nraise RuntimeError("missing")\n"""','raise',false],['s.py','doc = """\ndef twice(x): return x * 2\n"""','def',false],['s.py','label = "def"','def',false],['s.py','# raise example','raise',false],['s.js','function twice(x) { return x * 2; }','function',true],['s.ts','try { throw new Error("bad"); } catch (e) { recover(); }','throw',true],['s.js','try { try { throw new Error("bad"); } finally { cleanup(); } } catch (e) { recover(); }','throw',true],['s.ts','obj.function(x);','function',false],['s.ts','obj.throw(x);','throw',false],['s.js','// function example','function',false],['s.js','const count = 3;','const',false]];
 for(const [name,source,text,eligible] of cases)for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const offset=source.indexOf(text),before=source.slice(0,offset).split('\n'),line=before.length,startColumn=before.at(-1).length,selectedToken={text,line,startColumn,endColumn:startColumn+text.length,sourceLine:source.split('\n')[line-1]},semantic=true;
  const effect='  Original effect.  ',details='Original detail.\nInside paragraph.';
  const raw=semantic?JSON.stringify({kind:'definition',effect,details,type:'json_object'}):JSON.stringify({kind:'definition',paragraphs:[effect]});
  const {bodies,result}=await capture(()=>knowledge.explain(source,selectedToken,config,{name,locale,readingMode}),raw);
  assert.equal(bodies.length,1);const body=bodies[0],input=JSON.parse(body.messages[1].content);assert.equal(input.source,source);assert.deepEqual(input.selectedToken,selectedToken);
  const prompts=require('../ai-token-prompts');assert.equal(body.messages[0].content,prompts.semanticDraft(input,locale,readingMode,true));
  assert.equal(result.answer,semantic?effect+'\n\n'+details:effect);
  if(semantic){assert.doesNotMatch(body.messages[0].content,/Transport contract:|传输协议：|paragraphs is a nonempty/);assert.match(body.messages[0].content,locale==='en'?/details may be omitted/:/details可省略/);}
 }
});
test('semantic decoder preserves text and rejects unknown or incomplete shapes without retry',async()=>{
 const src='def twice(x): return x * 2',selected={text:'def',line:1,startColumn:0,endColumn:3,sourceLine:src};
 for(const value of [{kind:'definition',effect:' effect '},{kind:'definition',effect:' effect ',details:' detail '},{kind:'definition',effect:' effect ',type:'json_object'}]){
  const {result,bodies}=await capture(()=>knowledge.explain(src,selected,config,{name:'s.py',readingMode:'beginner'}),JSON.stringify(value));assert.equal(result.answer,value.effect+(value.details?'\n\n'+value.details:''));assert.equal(bodies.length,1);
 }
 for(const value of [{kind:'definition',effect:''},{kind:'definition',effect:'x',details:''},{kind:'definition',effect:'x',details:[]},{kind:'definition',effect:'x',extra:true},{kind:'lesson',effect:'x'},{kind:'definition',effect:1},{kind:'definition',effect:'x',type:'unknown'},[],{kind:'definition',paragraphs:['old shape']},{kind:'definition',answer:'old shape'}]){
  await assert.rejects(()=>capture(()=>knowledge.explain(src,selected,config,{name:'s.py',readingMode:'beginner'}),JSON.stringify(value)),/格式不完整/);
 }
 await assert.rejects(()=>capture(()=>knowledge.explain(src,selected,config,{name:'s.py',readingMode:'beginner'}),JSON.stringify({kind:'definition',effect:'x'.repeat(2399),details:'y'})),/长度限制/);
 assert.throws(()=>point.draftAnswer(JSON.stringify({kind:'definition',effect:'x'}),'token',false,true),/格式不完整/);
 assert.throws(()=>point.draftAnswer(JSON.stringify({kind:'definition',effect:'x'}),'token',true),/格式不完整/);
});

test('sole JS/TS beginner call-await-save lines use one semantic draft with complete plaintext delivery',async()=>{
 const cases=[['JavaScript','scene.mjs','const result = await foo(7);',1],['TypeScript','scene.ts','let result: number = await foo(7);',1],['JavaScript','scene.js','async function run() {\n  result = await foo(7);\n  useResult(result);\n}',2]];
 for(const [sourceLanguage,filename,src,line]of cases)for(const locale of ['en','zh-CN']){
  const selectedSource={start:line,end:line,code:src.split('\n')[line-1]},effect='  Visible call, local wait and save.  ',details='A needed example.\nIts text is unchanged.';
  const {result,bodies}=await capture(()=>modelCall(config,messages({source:src,sourceLanguage,filename,selectedSource}),{locale,readingMode:'beginner',explanation:true,pointReading:true}),JSON.stringify({kind:'definition',effect,details,type:'json_object'}));
  assert.equal(result,effect+'\n\n'+details);assert.equal(bodies.length,1);assert.equal(bodies[0].reasoning_effort,'low');assert.equal(bodies[0].max_tokens,6000);assert.deepEqual(bodies[0].response_format,{type:'json_object'});const input=JSON.parse(bodies[0].messages[1].content);assert.equal(input.source,src);assert.deepEqual(input.selectedSource,selectedSource);
  assert.match(bodies[0].messages[0].content,locale==='en'?/await accepts ordinary values or Promises; the callee return type must come from evidence/:/await接受普通值或Promise，调用返回类型须由证据确定/);assert.doesNotMatch(bodies[0].messages[0].content,/Return only the explanation as plain text|只返回解释正文，不使用JSON/);
 }
 const selectedSource={start:1,end:1,code:cases[0][2]},opts={locale:'en',readingMode:'beginner',explanation:true,pointReading:true},ms=messages({source:cases[0][2],sourceLanguage:'JavaScript',filename:'scene.mjs',selectedSource});
 const long=' '+ 'x'.repeat(3000)+' ';const {result}=await capture(()=>modelCall(config,ms,opts),JSON.stringify({kind:'definition',effect:long}));assert.equal(result,long);
 for(const value of [{kind:'definition',effect:''},{kind:'definition',effect:'x',details:[]},{kind:'definition',effect:'x',extra:true},{kind:'definition',effect:'x',type:'other'},{kind:'lesson',effect:'x'},[]])await assert.rejects(()=>capture(()=>modelCall(config,ms,opts),JSON.stringify(value)),/格式不完整/);
 await assert.rejects(()=>capture(()=>modelCall(config,ms,opts),'partial','length'),/长度限制/);
 const stopped=new AbortController();await assert.rejects(()=>capture(()=>modelCall(config,ms,{...opts,signal:stopped.signal,onModelText:()=>stopped.abort()}),JSON.stringify({kind:'definition',effect:'x'})),/取消/);
});
test('await-line scene excludes nonsole or different language and mode selections without changing old transport',async()=>{
 const codes=['// const result = await foo();','const text = "const result = await foo();";','const result = await foo(); useResult(result);','obj.result = await foo();','const result = await foo(), another = 1;','const result = { nested: await foo() };','const result = (await foo()) + 1;','const result = await foo(() => 1);','async function nested() { const result = await foo(); }'];
 for(const src of codes){const {bodies}=await capture(()=>modelCall(config,messages({source:src,sourceLanguage:'JavaScript',filename:'scene.mjs',selectedSource:{start:1,end:1,code:src}}),{readingMode:'beginner',explanation:true,pointReading:true}), 'A plain explanation.');assert.equal(bodies.length,1);assert.equal(bodies[0].response_format,undefined);}
 for(const [sourceLanguage,readingMode]of [['Python','beginner'],['JavaScript','standard']]){const src='const result = await foo();';const {bodies}=await capture(()=>modelCall(config,messages({source:src,sourceLanguage,selectedSource:{start:1,end:1,code:src}}),{readingMode,explanation:true,pointReading:true}),'A plain explanation.');assert.equal(bodies[0].response_format,undefined);}
 const src='const result = await foo(\n  7\n);';const {bodies}=await capture(()=>modelCall(config,messages({source:src,sourceLanguage:'JavaScript',selectedSource:{start:1,end:3,code:src}}),{readingMode:'beginner',explanation:true,pointReading:true}),'A plain explanation.');assert.equal(bodies[0].response_format,undefined);
 let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;return reply('unused');};try{await assert.rejects(()=>modelCall(config,messages({source:'const result = await foo();',sourceLanguage:'JavaScript',selectedSource:{start:1,end:1,code:'changed'}}),{readingMode:'beginner',explanation:true,pointReading:true}),/重新选择/);assert.equal(calls,0);}finally{globalThis.fetch=previous;}
});

test('await-save direct callee receives the positive local contract only with exact identifier scope and conservative missing binding',async()=>{
 const cases=[['const saved = await foo(7);',true],['function foo(value) { return value * 2; }\nconst saved = await foo(7);',false],['const foo = value => value * 2;\nconst saved = await foo(7);',false],['foo = value => value * 2;\nconst saved = await foo(7);',false],['async function run(foo) {\n const saved = await foo(7);\n}',false],['const saved = await obj.foo(7);',false],['const text = "foo";',false],['// foo',false],['function foo(value) { return value; }',false],['const saved = await foo(7); useResult(saved);',false]];
 for(const [src,eligible]of cases)for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const offset=src.lastIndexOf('foo'),before=src.slice(0,offset).split('\n'),line=before.length,startColumn=before.at(-1).length,selectedToken={text:'foo',line,startColumn,endColumn:startColumn+3,sourceLine:src.split('\n')[line-1]};
  const {bodies,result}=await capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.mjs',readingMode,locale}),JSON.stringify({kind:'definition',effect:'  Visible call.  ',details:'Necessary separate task.'}));
  assert.equal(result.answer,'  Visible call.  \n\nNecessary separate task.');assert.equal(bodies.length,1);const system=bodies[0].messages[0].content;assert.equal(system.includes('FIMI_LOCAL_AWAIT_SAVE_V1'),eligible&&readingMode==='beginner');
  const input=JSON.parse(bodies[0].messages[1].content);assert.equal(input.source,src);assert.deepEqual(input.selectedToken,selectedToken);
  if(eligible&&readingMode==='beginner'){assert.match(system,locale==='en'?/translating the call or result name is not evidence of a business task/:/翻译调用或结果名称不是业务职责的证据/);assert.doesNotMatch(system,/FIMI_POINT_READING_V2|missing-definition commentary|源码没有定义/);assert.match(system,locale==='en'?/only when the actual question depends on that missing implementation/:/只有实际问题必须依赖缺少的内部实现/);}
 }
 const src=cases[0][0],offset=src.indexOf('foo'),selectedToken={text:'foo',line:1,startColumn:offset,endColumn:offset+3,sourceLine:src};
 await assert.rejects(()=>capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.mjs',readingMode:'beginner'}),JSON.stringify({kind:'definition',effect:'x'.repeat(2401)})),/长度限制/);
 const cancel=new AbortController();await assert.rejects(()=>capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.mjs',readingMode:'beginner',signal:cancel.signal,onModelText:()=>cancel.abort()}),JSON.stringify({kind:'definition',effect:'x'})),/取消/);
});

test('targeted Python data and compound contracts preserve exact source and isolate other occurrences',async()=>{
 const cases=[['def repeat(mark, count):\n    return mark * count\n\nresult = repeat("x", 3)','count','beginner','parameter'],['def repeat(mark, count):\n    return mark * count','count','standard',null],['def repeat(count=3):\n    return count','count','beginner',null],['text = "def repeat(mark, count):"','count','beginner',null],['# def repeat(mark, count):','count','beginner',null],['def repeat(mark, count):\n    return mark * count','count','beginner',null,2],['items = [1]\nitems += [2]','+=','standard','compound'],['items = [1]\nitems += [2]','+=','beginner',null],['text = "items += [2]"','+=','standard',null],['# items += [2]','+=','standard',null]];
 for(const [src,text,readingMode,role,which=1]of cases)for(const locale of ['en','zh-CN']){
  let offset=-1;for(let n=0;n<which;n++)offset=src.indexOf(text,offset+1);const prefix=src.slice(0,offset),line=prefix.split('\n').length,startColumn=prefix.length-(prefix.lastIndexOf('\n')+1),selectedToken={text,line,startColumn,endColumn:startColumn+text.length,sourceLine:src.split('\n')[line-1]};
  const {bodies,result}=await capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.py',locale,readingMode}),JSON.stringify({kind:'definition',effect:'  Actual meaning.  ',details:'Separate needed use.'}));
  const system=bodies[0].messages[0].content;assert.equal(system.includes('FIMI_LOCAL_PARAMETER_DATA_V1'),role==='parameter');assert.equal(system.includes(locale==='en'?'Compound assignment:':'复合赋值：'),role==='compound');assert.equal(bodies.length,1);assert.equal(result.answer,'  Actual meaning.  \n\nSeparate needed use.');assert.equal(bodies[0].reasoning_effort,'low');assert.equal(bodies[0].max_tokens,6000);assert.equal(JSON.parse(bodies[0].messages[1].content).source,src);
 }
});
test('direct passage precision is isolated from legacy and all line profiles',async()=>{
 const source='def convert(value):\n    try:\n        result = int(value)\n    except ValueError:\n        return None\n    return result',selectedSource={start:2,end:6,code:source.split('\n').slice(1).join('\n')};
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  assert.equal(contract.profile(locale,readingMode,'line',undefined,true),contract.profile(locale,readingMode,'line'));assert.doesNotMatch(contract.profile(locale,readingMode,'passage'),/exact error categories handled here|此处实际捕获的错误类别/);
  const {bodies}=await capture(()=>modelCall(config,messages({source,sourceLanguage:'Python',filename:'scene.py',selectedSource}),{locale,readingMode,pointReading:true,explanation:true}),'A complete source-supported explanation.');assert.equal(bodies.length,1);assert.equal(bodies[0].response_format,undefined);assert.match(bodies[0].messages[0].content,locale==='en'?/exact error categories handled here/:/此处实际捕获的错误类别/);assert.match(bodies[0].messages[0].content,locale==='en'?/actual selected code/:/实际所选代码/);
 }
});

test('simple parameter routing rejects empty slots and avoids scanning unrelated Python tokens',async()=>{
 const scanner=require('../public/reading-model'),original=scanner.scan;let scans=0;scanner.scan=function(...args){scans++;return original.apply(this,args);};
 try{
  for(const [src,text,readingMode,role,expectedScans]of [['def run(a,,b):\n    return b','b','beginner',false,0],['def run(,a):\n    return a','a','beginner',false,0],['def run(a,b,):\n    return b','b','beginner',true,1],['value = 3','value','beginner',false,0],['value = 3','value','standard',false,0],['values = [1]','[','beginner',false,0]]){
   const offset=src.indexOf(text),selectedToken={text,line:1,startColumn:offset,endColumn:offset+text.length,sourceLine:src.split('\n')[0]};scans=0;
   const {bodies}=await capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.py',readingMode,locale:'en'}),JSON.stringify({kind:'definition',effect:'Current meaning.'}));assert.equal(scans,expectedScans);assert.equal(bodies[0].messages[0].content.includes('FIMI_LOCAL_PARAMETER_DATA_V1'),role);assert.equal(bodies.length,1);
  }
 }finally{scanner.scan=original;}
});

test('conditional property scene is exact selected JS/TS if-else with matching guarded receiver',async()=>{
 const cases=[['if (record === null) {\n caption = "Unknown";\n} else {\n caption = record.title;\n}',true],['if (null !== record) { caption = record.title; } else { caption = "Unknown"; }',true],['if (record === null) { caption = "Unknown"; } else { caption = other.title; }',false],['if (record) { caption = record.title; } else { caption = "Unknown"; }',false],['if (record === null) { caption = "Unknown"; }',false],['if (record === null) { caption = "Unknown"; } else { caption = record?.title; }',false],['// if (record === null) { caption = record.title; } else {}',false],['const text = "if (record === null) { caption = record.title; } else {}";',false],['if (record === null) { caption = "Unknown"; } else { function nested() { caption = record.title; } }',false],['if (record === null) { caption = "Unknown"; } else { caption = record.title; }\nother();',false]];
 for(const [src,eligible]of cases)for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const selectedSource={start:1,end:src.split('\n').length,code:src};if(selectedSource.end===1){selectedSource.code='\n'+src;selectedSource.end=2;}const source=selectedSource.code;
  const {bodies}=await capture(()=>modelCall(config,messages({source,sourceLanguage:'JavaScript',filename:'scene.js',selectedSource}),{locale,readingMode,pointReading:true,explanation:true}),'  Full untouched explanation.  ');
  const system=bodies[0].messages[0].content;assert.equal(system.includes(locale==='en'?'Conditional property read:':'条件属性读取：'),eligible);assert.equal(bodies.length,1);assert.equal(bodies[0].response_format,undefined);assert.equal(JSON.parse(bodies[0].messages[1].content).source,source);if(eligible)assert.match(system,locale==='en'?/guard establishes only its exact tested condition/:/条件只验证它确切检查的情况/);
 }
});

test('simple parameter numeric style presents data role before binding while nonparameter bodies remain unchanged',async()=>{
 const src='def measure(rate, units):\n    return rate * units\n\nresult = measure(6, 2)',text='units',startColumn=src.split('\n')[0].indexOf(text),selectedToken={text,line:1,startColumn,endColumn:startColumn+text.length,sourceLine:src.split('\n')[0]};
 for(const locale of ['en','zh-CN']){
  const {bodies,result}=await capture(()=>knowledge.explain(src,selectedToken,config,{name:'scene.py',readingMode:'beginner',locale}),JSON.stringify({kind:'definition',effect:'  Complete data meaning.  ',details:'The current numeric use.'}));const system=bodies[0].messages[0].content;
  assert.match(system,locale==='en'?/units as the number of units, two this time/:/units表示单位数量，本次是2/);assert.doesNotMatch(system,/replicate\(symbol, copies\)/);assert.equal(result.answer,'  Complete data meaning.  \n\nThe current numeric use.');assert.equal(bodies.length,1);assert.equal(bodies[0].reasoning_effort,'low');assert.equal(bodies[0].max_tokens,6000);assert.deepEqual(JSON.parse(bodies[0].messages[1].content).selectedToken,selectedToken);
 }
});
