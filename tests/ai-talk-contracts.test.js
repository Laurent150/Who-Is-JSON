// These cases retain coverage of the B rollback prompt; E is covered by ai-integration.test.js.
process.env.WHO_TALK_COMPOSITION="B";
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../ai/ai-talk-contracts');
const source='async function fetchOne(load) {\r\n  return await load("值");\r\n}';
const ledger=()=>({purpose:'Load one value',units:[{name:'fetchOne',anchor:'async function fetchOne(load)',accepts:'A callable load',returns:'Promise that adopts the result',timing:'Calls load before awaiting',paths:[{when:'load returns or resolves',does:'Invoke and await load',completion:'Fulfill with its value',failure:'A load error rejects the async call; no catch',anchor:'return await load("值");'}],unknowns:['The implementation of load is not supplied']}]});
test('contract evidence must quote supplied bytes without inventing positions or accepting partial ledgers',()=>{
 assert.deepEqual(parse(JSON.stringify(ledger()),source),ledger());
 for(const change of [d=>d.units[0].anchor='function invented()',d=>d.units[0].paths[0].anchor='return load("值");',d=>d.units[0].paths=[],d=>delete d.units[0].returns,d=>d.units[0].line=1,d=>d.units=[]]){
  const d=ledger();change(d);assert.throws(()=>parse(JSON.stringify(d),source),/源码依据不完整/);
 }
});
test('fact-first generation preserves source and settings across the contract and final composition stages and keeps notes internal',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  for(const locale of ['zh-CN','en'])for(const audience of ['beginner','peer','review'])for(const readingMode of ['beginner','standard'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
   const calls=[];const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body,{prompt_tokens:10,completion_tokens:20,total_tokens:30});if(audit)return audit;
    calls.push(body);const content=calls.length===1?JSON.stringify(ledger()):JSON.stringify({title:'Load a value',sections:[{title:'Result',text:'It requests one value and reports the result when the work finishes.'}],questions:[]});
    return {usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:'stop',message:{content}}]};
   }};
   const result=await require('../ai/ai-talk').generateTalk(source,'fetch.js',{audience,detail,coverage},config,{locale,readingMode});
   assert.equal(calls.length,3);assert.deepEqual(result.usage.calls.map(c=>c.phase),['contracts','composition','review']);
   for(const c of calls)assert.equal(JSON.parse(c.messages.find(m=>m.role==='user').content).source,source);
   assert.equal(result.evaluationContracts,undefined);
   const system=calls[1].messages[0].content;
   if(locale==='en')assert.doesNotMatch(system,/[\u4e00-\u9fff]/);
   assert.ok(system.includes(locale==='en'?coverage==='full'?'Coverage — Full:':'Coverage — Highlights:':coverage==='full'?'范围—完整：':'范围—重点：'));
   assert.ok(system.includes(locale==='en'?readingMode==='beginner'?'BEGINNER MODE':'STANDARD MODE':readingMode==='beginner'?'当前为零基础友好模式':'当前为标准模式'));
   assert.equal(JSON.parse(calls[1].messages.find(m=>m.role==='user').content).coverage,coverage);
   assert.ok(calls[1].messages.some(m=>m.content.includes('sourceContracts')));
   const constraints=calls[1].messages.at(-1);
   assert.equal(constraints.role,'user');
   assert.match(constraints.content,locale==='en'?/wrapper body IS supplied/:/包装函数体已经提供/);
   assert.match(constraints.content,locale==='en'?/synchronous work inside the supplied operation may already finish/:/同步工作可能在下一次调用前已经完成/);
   assert.match(constraints.content,locale==='en'?/A pending Promise is already returned/:/等待中的Promise已经返回/);
   assert.match(constraints.content,locale==='en'?/An uncaught throw means the call fails/:/未被处理的抛错表示本次调用失败/);
   if(locale==='en')assert.doesNotMatch(constraints.content,/[\u4e00-\u9fff]/);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
test('invalid contracts and cancellation cannot fall through to an unchecked manuscript',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  let calls=0;const config={base:'https://example.org',model:'test',sponsoredCall:async()=>{calls++;return {choices:[{finish_reason:'stop',message:{content:'{"purpose":"missing units"}'}}]};}};
  await assert.rejects(()=>require('../ai/ai-talk').generateTalk(source,'x.js',{},config),/源码依据不完整/);assert.equal(calls,2);
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>require('../ai/ai-talk').generateTalk(source,'x.js',{},config,{signal:controller.signal}),/取消/);assert.equal(calls,2);
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
test('optional contract label never weakens required facts, anchors or the single-object protocol',()=>{
 const data=ledger();delete data.purpose;
 assert.deepEqual(parse(JSON.stringify(data),source),data);
 for(const change of [d=>d.purpose=null,d=>d.purpose='',d=>delete d.units[0].timing,d=>delete d.units[0].paths[0].failure,d=>d.units[0].anchor='invented',d=>d.extra='ignored']){
  const bad=structuredClone(data);change(bad);assert.throws(()=>parse(JSON.stringify(bad),source),/源码依据不完整/);
 }
 assert.throws(()=>parse(JSON.stringify(data)+'\n'+JSON.stringify(data),source),/源码依据不完整/);
 const manuscript={title:'Result',sections:[{title:'Outcome',text:'Original prose, untouched.'}],questions:[]};
 const {parseTalk,settings}=require('../ai/ai-talk');
 assert.equal(parseTalk(JSON.stringify(manuscript),'sample',settings()).sections[0].text,manuscript.sections[0].text);
 assert.throws(()=>parseTalk(JSON.stringify(manuscript)+'\n'+JSON.stringify(manuscript),'sample',settings()),/格式不完整/);
});
test('question schema is explicit in both languages and nonempty Q&A survives two-stage generation unchanged',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  for(const locale of ['en','zh-CN']){
   const question=locale==='en'?{question:'What is returned?',answer:'A Promise adopting the supplied load result.'}:{question:'交回什么？',answer:'交回采用传入load结果的Promise。'};
   const manuscript={title:'Result',sections:[{title:'Outcome',text:'Original prose.'}],questions:[question]};
   const calls=[];
   const result=await require('../ai/ai-talk').generateTalk(source,'sample',{audience:'review',detail:'standard'},{base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
    calls.push(body);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls.length===1?ledger():manuscript)}}]};
   }},{locale,readingMode:'standard'});
   assert.equal(calls.length,3);assert.deepEqual(result.questions,[question]);assert.equal(result.sections[0].text,manuscript.sections[0].text);
   for(const call of calls)assert.equal(JSON.parse(call.messages.find(m=>m.role==='user').content).source,source);
   const prompt=calls[1].messages[0].content;
   assert.match(prompt,locale==='en'?/Never return an array of question strings/:/禁止返回问题字符串数组/);
   assert.match(prompt,/"question":/);assert.match(prompt,/"answer":/);
   const beginner=require('../ai/ai-talk-contracts').finalReview({locale,readingMode:'beginner',audience:'review',detail:'standard',coverage:'full'});
   assert.match(beginner,locale==='en'?/this reading mode does not include questions/:/此阅读模式不包含问答/);
   const {parseTalk,settings}=require('../ai/ai-talk');
   for(const questions of [[question.question],[{question:question.question}],[{question:question.question,answer:''}]])assert.throws(()=>parseTalk(JSON.stringify({...manuscript,questions}),'sample',settings()),/完整讲解稿/);
   assert.deepEqual(parseTalk(JSON.stringify({...manuscript,questions:[]}),'sample',settings()).questions,[]);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
test('contracts without optional label use a separate final review and preserve Unicode CRLF source and prose',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  for(const locale of ['en','zh-CN']){
   const data=ledger();delete data.purpose;const calls=[];
   const manuscript={title:'Result',sections:[{title:'Outcome',text:'Exact model prose; no replacement.'}],questions:[]};
   const result=await require('../ai/ai-talk').generateTalk(source,'sample',{audience:'beginner'},{base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
    calls.push(body);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls.length===1?data:manuscript)}}]};
   }},{locale,readingMode:'beginner'});
   assert.equal(calls.length,3);assert.equal(result.sections[0].text,manuscript.sections[0].text);
   for(const c of calls)assert.equal(JSON.parse(c.messages.find(m=>m.role==='user').content).source,source);
   assert.match(calls[1].messages[0].content,locale==='en'?/exactly ONE final JSON object/:/只序列化一个最终JSON对象/);
   assert.match(calls[1].messages[0].content,locale==='en'?/other failures still escape/:/其他失败仍会向外报错/);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
test('purpose-first experiment only appends an introductory constraint and preserves the existing protocol and other audiences',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  for(const locale of ['en','zh-CN'])for(const audience of ['beginner','peer','review']){
   const variants=[];
   for(const introComposition of [undefined,'purpose-first']){
    const calls=[],config={base:'https://example.org',model:'test',sponsoredCall:async payload=>{const audit=mockFinalAudit(payload);if(audit)return audit;
     calls.push(payload);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls.length===1?ledger():{title:'Purpose',sections:[{title:'Result',text:'Original complete prose.'}],questions:[]})}}]};
    }};
    const result=await require('../ai/ai-talk').generateTalk(source,'x.js',{audience,detail:'brief'},config,{locale,readingMode:'beginner',introComposition,asyncFocusRules:false});
    assert.equal(calls.length,3);assert.equal(result.sections[0].text,'Original complete prose.');variants.push(calls);
   }
   assert.deepEqual(variants[0][0],variants[1][0]);
   const before=variants[0][1].messages,after=variants[1][1].messages;
   if(audience==='beginner'){
    assert.deepEqual(before.slice(0,-1),after.slice(0,-1));assert.ok(after.at(-1).content.startsWith(before.at(-1).content));
    assert.match(after.at(-1).content,locale==='en'?/Opening section:/:/开头首节只用/);
   }else assert.deepEqual(before,after);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});

test('contract reasoning is bounded and provider-specific, and failed calls retain only counters',async()=>{
 const {requestOptions}=require('../ai/ai-client');
 const options={task:'talk',reviewReasoning:true,usagePhase:'contracts',json:true};
 const config={base:'https://api.deepseek.com',model:'deepseek-flash'};
 const body=requestOptions(config,[],options).body;
 assert.equal(body.reasoning_effort,'low');assert.equal(body.max_tokens,16384);
 assert.equal(requestOptions({...config,base:'https://example.org'},[],options).body.thinking,undefined);
 assert.equal(requestOptions({...config,sponsoredCall:()=>{}},[],options).body.thinking.type,'disabled');
 assert.equal(requestOptions({...config,reviewThinking:true,sponsoredCall:()=>{}},[],options).body.thinking.type,'enabled');
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  await assert.rejects(()=>require('../ai/ai-talk').generateTalk(source,'x.js',{}, {...config,sponsoredCall:async()=>({usage:{prompt_tokens:11,completion_tokens:13,total_tokens:24},choices:[{finish_reason:'length',message:{content:'private incomplete model content'}}]})}),error=>{
   assert.equal(error.usage.totalTokens,24);assert.equal(error.usage.calls[0].phase,'contracts');assert.doesNotMatch(JSON.stringify(error.usage),/private|source|key/);return true;
  });
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});



test('B rollback uses the source, composition and final review options without evaluation setup',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;delete process.env.WHO_TALK_PIPELINE;
 try{
  for(const locale of ['zh-CN','en'])for(const audience of ['beginner','peer','review']){
   const requests=[];
   for(const explicit of [false,true]){
    const calls=[];
    const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
     calls.push(body);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls.length===1?ledger():{title:'Result',sections:[{title:'Result',text:'Unchanged model prose.'}],questions:[]})}}]};
    }};
    const options={locale,readingMode:'beginner',...(explicit?{introComposition:'purpose-first',asyncFocusRules:true}:{})};
    const result=await require('../ai/ai-talk').generateTalk(source,'sample.js',{audience,detail:'standard'},config,options);
    assert.equal(calls.length,3);assert.equal(result.sections[0].text,'Unchanged model prose.');
    assert.equal(result.evaluationContracts,undefined);
    for(const call of calls)assert.equal(JSON.parse(call.messages.find(m=>m.role==='user').content).source,source);
    requests.push(calls);
   }
   assert.deepEqual(requests[0],requests[1]);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
