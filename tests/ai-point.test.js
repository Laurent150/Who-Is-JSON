const {test}=require('node:test'),assert=require('node:assert/strict');
const point=require('../ai-point'),prompts=require('../ai-point-prompts'),paragraphs=require('../ai-point-paragraphs');
const {modelCall}=require('../ai-client'),knowledge=require('../ai-knowledge');
const hover=require('../ai-token-prompts');
const source='function pick(value) {\n  return value;\n}';
const token={text:'return',line:2,startColumn:2,endColumn:8,sourceLine:'  return value;'};
const selectedSource={start:2,end:2,code:'  return value;'};
const options={explanation:true,readingMode:'beginner',locale:'zh-CN'};
const input=scope=>({filename:'pick.js',sourceLanguage:'JavaScript',source,...(scope==='token'?{selectedToken:token}:{selectedSource})});
const messages=value=>[{role:'system',content:'Legacy instruction must not leak.'},{role:'user',content:JSON.stringify(value)}];
const response=(value,finish='stop')=>({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:finish,message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
async function run(scope,{draft='把收到的值交回。\n\n随后结束这次处理。',review={corrections:[{id:'p1',value:'把收到的内容原样交回。',reason:'用日常说法说明。'}]},draftFinish='stop',reviewFinish='stop',config={},extra={}}={}) {
 const bodies=[],phases=[],usage=[];
 const provider={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,...config,sponsoredCall:async body=>{
  bodies.push(body);assert.ok(bodies.length<=2,'No independent audit or retry');
  return bodies.length===1?response(scope==='token'?{kind:'definition',answer:draft}:draft,draftFinish):response(review,reviewFinish);
 }};
 const opts={...options,onModelRequest:(body,phase)=>phases.push(phase),onUsage:u=>usage.push(u),...extra};
 try {
  const result=scope==='token'?await knowledge.explain(source,token,provider,{...opts,name:'pick.js'}):await modelCall(provider,messages(input(scope)),opts);
  return {result,bodies,phases,usage};
 }catch(error){error.phases=phases;throw error;}
}

test('method 3 routes bilingual beginner token and selected-passage requests',()=>{
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const task of ['knowledge','ask','flow','overview','talk']){
  const routed=point.route(messages(input(task==='knowledge'?'token':'passage')),{...options,locale,readingMode,task});
  assert.equal(!!routed,task==='knowledge'||readingMode==='beginner'&&task==='ask');
 }
 assert.equal(point.route(messages({source}),options),null);
 assert.equal(point.route(messages(input('passage')),{...options,task:'knowledge',json:true}),null);
 assert.equal(point.route(messages(input('passage')),{...options,json:true}),null);
 assert.equal(point.route(messages(input('token')),{...options,task:'knowledge',explanation:false}),null);
 assert.equal(point.route(messages(input('passage')),{...options,evaluationReview:{editor:'legacy',audit:'on'}}),null);
});

for(const scope of ['token','passage'])test(scope+' uses two exact prompt stages and preserves paragraphs and source',async()=>{
 const mode=scope==='token'?'standard':'beginner';
 const {result,bodies,phases,usage}=await run(scope,{extra:{readingMode:mode}});
 assert.deepEqual(phases,['draft','review']);assert.equal(usage.length,2);
 assert.equal(scope==='token'?result.answer:result,'把收到的内容原样交回。');
 assert.equal(bodies[0].messages[0].content,scope==='token'?hover.draft('zh-CN',mode):prompts.line);
 assert.equal(bodies[1].messages[0].content,scope==='token'?hover.review('zh-CN',mode):prompts.review(prompts.line));
 for(const [index,body]of bodies.entries()){
  const data=JSON.parse(body.messages[1].content);assert.equal(data.source,source);
  assert.equal(body.max_tokens,index?16384:2200);assert.equal(body.thinking.type,index?'enabled':'disabled');
  assert.equal(body.messages.length,2);
  if(index){assert.equal(data.reviewContext.scope.status,'verified');assert.deepEqual(data.draftParagraphs,[{id:'p1',text:'把收到的值交回。\n\n随后结束这次处理。'}]);}
  else assert.equal(Object.hasOwn(data,'reviewContext'),false);
 }
 assert.equal(bodies[1].reasoning_effort,'high');
 assert.deepEqual(bodies[1].response_format,{type:'json_object'});
});

test('user follow-up questions survive routing and supplied evidence is discarded',()=>{
 const data={...input('passage'),question:'只说明这里最后得到什么。',reviewContext:{verified:true}};
 const routed=point.route(messages(data),options);
 assert.equal(routed.input.question,data.question);assert.equal(Object.hasOwn(routed.input,'reviewContext'),false);
});

test('single-line review can merge repeated paragraphs while passages preserve separate edit locations',async()=>{
 for(const singleLine of [true,false]){
  const code='function f(x) {\n  return x;\n}',selection=singleLine?{start:2,end:2,code:'  return x;'}:{start:1,end:3,code};
  const bodies=[],draft='The result is x.\n\nThis returns x.';
  const result=await modelCall({base:'https://example.org',model:'mock',sponsoredCall:async body=>{
   bodies.push(body);return response(bodies.length===1?draft:{corrections:[{id:'p1',value:'Returns x.',reason:'Remove repetition without changing the result.'}]});
  }},messages({source:code,selectedSource:selection,question:'Explain this selection.'}),{...options,locale:'en'});
  assert.equal(bodies.length,2);
  assert.deepEqual(JSON.parse(bodies[1].messages[1].content).draftParagraphs,singleLine?[{id:'p1',text:draft}]:[{id:'p1',text:'The result is x.'},{id:'p2',text:'This returns x.'}]);
  assert.equal(result,singleLine?'Returns x.':'Returns x.\n\nThis returns x.');
  for(const body of bodies){
   assert.match(body.messages[0].content,singleLine?/ONE SELECTED LINE/:/SELECTED PASSAGE/);
   assert.doesNotMatch(body.messages[0].content,singleLine?/SELECTED PASSAGE/:/ONE SELECTED LINE/);
  }
 }
});

test('token routing removes redundant neighboring context but preserves exact UTF-16 source positions',async()=>{
 const code='const 名称 = "😀";\r\nconsole.log(名称);';
 const selected=require('../ai-flow').tokenSource(code,{line:2,startColumn:12,endColumn:14});
 const routed=point.route(messages({filename:'unicode.js',source:code,selectedToken:selected}),{...options,task:'knowledge',json:true});
 assert.equal(routed.input.source,code);assert.equal(routed.input.selectedToken.text,'名称');
 assert.equal(Object.hasOwn(routed.input.selectedToken,'context'),false);
 assert.equal(require('../ai-review-context').scopeFor(routed.input,'knowledge').status,'verified');
 assert.deepEqual(Object.keys(routed.input.selectedToken),['text','line','startColumn','endColumn','sourceLine']);
});

test('incomplete token drafts fail locally before review without a paid format retry',async()=>{
 for(const draft of ['{"answer":"missing kind"}','{"kind":"definition","answer":""}','{"kind":"lesson","answer":"wrong schema"}','{"kind":"definition","answer":"ok","extra":true}']){
  let calls=0;
  const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{calls++;return response(draft);}};
  await assert.rejects(()=>knowledge.explain(source,token,config,{...options,name:'pick.js'}),e=>e.code==='AI_REVIEW_PROTOCOL'&&e.diagnostics.aiPhase==='draft');
  assert.equal(calls,1);
 }
});

test('paragraph edits are transactional, unique and cannot empty/delete or reorder paragraphs',()=>{
 const draft='第一段。\r\n \r\n第二段。\n\n\n最后一段。';
 const edit={id:'p2',value:'修改后的第二段。',reason:'修正具体问题。'};
 assert.equal(paragraphs.apply(draft,JSON.stringify({corrections:[edit]})).answer,draft.replace('第二段。',edit.value));
 assert.equal(paragraphs.apply(draft,'```json\n{"corrections":[]}\n```').answer,draft);
 for(const corrections of [[{...edit,id:'p99'}],[edit,edit],[{...edit,value:''}],[{...edit,reason:''}],[{...edit,source:'invented'}],[{...edit,value:12}],[{...edit,value:'x'.repeat(20001)}]])assert.throws(()=>paragraphs.apply(draft,JSON.stringify({corrections})));
 for(const raw of ['oops','[]','{"corrections":[],"answer":"replacement"}','{"corrections":null}'])assert.throws(()=>paragraphs.apply(draft,raw));
 assert.equal(draft,'第一段。\r\n \r\n第二段。\n\n\n最后一段。');
});

test('failed review never silently falls back to draft or bills a retry',async()=>{
 for(const review of ['invalid',{corrections:[{id:'p99',value:'不存在的段落。',reason:'无效'}]}])await assert.rejects(()=>run('token',{review,extra:{readingMode:'standard'}}),e=>e.code==='AI_REVIEW_PROTOCOL'&&e.phases.join()==='draft,review'&&e.diagnostics.aiPhase==='review');
});
test('truncation stops before further calls and reviewed display text is never clipped',async()=>{
 await assert.rejects(()=>run('token',{draftFinish:'length'}),e=>e.phases.join()==='draft');
 await assert.rejects(()=>run('passage',{reviewFinish:'length'}),e=>e.phases.join()==='draft,review');
 await assert.rejects(()=>run('token',{review:{corrections:[{id:'p1',value:'长'.repeat(2401),reason:'模拟超出显示限制'}]},extra:{readingMode:'standard'}}),e=>e.code==='AI_FINAL_TEXT_LIMIT');
});
test('cancellation and stale source positions stop paid dispatch',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{calls++;return response('bad');}};
 await assert.rejects(()=>modelCall(config,messages(input('passage')),{...options,signal:controller.signal}),/取消/);
 await assert.rejects(()=>modelCall(config,messages({...input('passage'),selectedSource:{...selectedSource,code:'different'}}),options),/重新选择/);
 assert.equal(calls,0);
 const during=new AbortController();
 await assert.rejects(()=>run('passage',{extra:{signal:during.signal,onModelText:()=>during.abort()}}),/取消/);
});
test('compatible providers do not receive DeepSeek-specific parameters',async()=>{
 const {bodies}=await run('token',{config:{base:'https://example.org',model:'compatible'}});
 for(const body of bodies)for(const key of ['thinking','reasoning_effort','response_format'])assert.equal(Object.hasOwn(body,key),false);
});

for(const scope of ['token','passage'])test('English '+scope+' sends the native-language profile through both stages without legacy additions',async()=>{
 const english=require('../ai-point-prompts-en');
 const draft='This gives the supplied value back.\n\nThis part then finishes.';
 const revised='This gives the information it received back to the code that asked for it.';
 const mode=scope==='token'?'standard':'beginner';
 const {result,bodies,phases,usage}=await run(scope,{draft,review:{corrections:[{id:'p1',value:revised,reason:'Explain what is being given back in ordinary language.'}]},extra:{locale:'en',readingMode:mode}});
 assert.deepEqual(phases,['draft','review']);assert.equal(usage.length,2);
 assert.equal(scope==='token'?result.answer:result,revised);
 assert.equal(bodies[0].messages[0].content,scope==='token'?hover.draft('en',mode):english.line);assert.equal(bodies[1].messages[0].content,scope==='token'?hover.review('en',mode):english.review(english.line));
 for(const body of bodies){assert.doesNotMatch(body.messages[0].content,/[\u3400-\u9fff]|FIMI_BEGINNER_TOKEN_V1|FIMI_REVIEW_EDIT_SCOPE_V2/);assert.equal(JSON.parse(body.messages[1].content).source,source);}
 const first=JSON.parse(bodies[0].messages[1].content),second=JSON.parse(bodies[1].messages[1].content);
 assert.equal(first.question,scope==='token'?'Explain the selected return here briefly for a reader with programming experience.':'Explain the selected code here to an adult with no programming background.');
 assert.equal(first.reviewContext,undefined);assert.equal(second.reviewContext.settings.locale,'en');
 assert.equal(bodies[0].max_tokens,2200);assert.equal(bodies[0].thinking.type,'disabled');
 assert.equal(bodies[1].max_tokens,16384);assert.equal(bodies[1].thinking.type,'enabled');assert.equal(bodies[1].reasoning_effort,'high');
 assert.equal(paragraphs.apply(draft,'{"corrections":[]}').answer,draft);
});

test('English adaptation preserves explicit questions and original non-English names',async()=>{
 const code='const 商品 = "茶";\nuse(商品);',selectedSource={start:1,end:1,code:code.split('\n')[0]},question='What information is stored here?';
 const value=point.route(messages({filename:'names.js',source:code,selectedSource,question}),{...options,locale:'en'});
 assert.equal(value.input.question,question);assert.equal(value.input.source,code);assert.deepEqual(value.input.selectedSource,selectedSource);
 const unchanged='The name 商品 holds the text "茶".';
 const bodies=[],config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{bodies.push(body);return response(bodies.length===1?unchanged:{corrections:[]});}};
 assert.equal(await modelCall(config,messages(value.input),{...options,locale:'en'}),unchanged);
 for(const body of bodies)assert.equal(JSON.parse(body.messages[1].content).source,code);
});
