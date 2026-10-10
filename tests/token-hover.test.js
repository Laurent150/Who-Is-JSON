const {test}=require('node:test'),assert=require('node:assert/strict');
const knowledge=require('../ai/ai-knowledge'),hover=require('../ai/ai-token-prompts'),paragraphs=require('../ai/ai-point-paragraphs');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const source='function pick(value) {\n  return value;\n}',token={text:'return',line:2,startColumn:2,endColumn:8,sourceLine:'  return value;'};
const response=x=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(x)}}]});
for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])test(`${locale} ${readingMode} compact token draft and review keep source with no final audit`,async()=>{
 const bodies=[],phases=[],draft='This gives back value.\n\nIt then finishes this call.',answer=locale==='en'?'Returns value and ends this call.':'交回value保存的内容，并结束这次调用。';
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{
  bodies.push(body);assert.ok(bodies.length<=(readingMode==='beginner'?1:2),'No disabled review, final audit or retry');
  assert.ok(body.messages.some(m=>['system','user'].includes(m.role)&&/json/i.test(m.content)),'DeepSeek JSON mode requires an explicit JSON instruction');
  return response(bodies.length===1?{kind:'definition',answer:draft}:{corrections:[{id:'p1',value:answer,reason:'Condense the complete hover card.'}]});
 }};
 const result=await knowledge.explain(source,token,config,{locale,readingMode,name:'pick.js',onModelRequest:(b,p)=>phases.push(p)});
 assert.deepEqual(result,{answer:readingMode==='beginner'?draft:answer});assert.deepEqual(phases,readingMode==='beginner'?['draft']:['draft','review']);
 assert.equal(bodies[0].messages[0].content,hover.draft(locale,readingMode));
 if(readingMode==='standard')assert.equal(bodies[1].messages[0].content,hover.review(locale,readingMode));
 for(const body of bodies.slice(0,2)){
  const payload=JSON.parse(body.messages[1].content);assert.equal(payload.source,source);assert.deepEqual(payload.selectedToken,token);
  assert.doesNotMatch(body.messages[0].content,/按四步|Build the explanation in this order|FIMI_BEGINNER_TOKEN_V1/);
  if(locale==='en')assert.doesNotMatch(body.messages[0].content,/[\u3400-\u9fff]/);
 }
 if(readingMode==='standard')assert.deepEqual(JSON.parse(bodies[1].messages[1].content).draftParagraphs,[{id:'p1',text:draft}]);
 assert.match(bodies[0].messages[0].content,/FIMI_POINT_READING_V2/);
 assert.match(bodies[0].messages[0].content,locale==='en'?/Prefer actual source data for a small example/:/小例子优先使用源码已有数据/);
 assert.match(bodies[0].messages[0].content,locale==='en'?/explicitly label invented data as hypothetical/:/自拟数据明确标为假设/);
 assert.doesNotMatch(bodies[0].messages[0].content,/Role first|先说明它是什么角色|35 words|50个中文字/);

});

test('beginner draft-only still validates format, display bounds, cancellation and exact token scope',async()=>{
 for(const [content,code]of [[{kind:'definition',answer:''},'AI_REVIEW_PROTOCOL'],[{kind:'definition',answer:'字'.repeat(2401)},'AI_FINAL_TEXT_LIMIT']]){
  let calls=0;
  const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{calls++;return response(content);}};
  await assert.rejects(()=>knowledge.explain(source,token,config,{readingMode:'beginner',name:'pick.js'}),e=>e.code===code&&e.diagnostics.aiPhase==='draft');
  assert.equal(calls,1);
 }
 let calls=0;const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{calls++;return response({kind:'definition',answer:'unused'});}};
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>knowledge.explain(source,token,config,{readingMode:'beginner',signal:controller.signal}),/取消/);
 await assert.rejects(()=>knowledge.explain(source,{...token,text:'different'},config,{readingMode:'beginner'}),/重新选择/);
 assert.equal(calls,0);
 const during=new AbortController();
 await assert.rejects(()=>knowledge.explain(source,token,config,{readingMode:'beginner',signal:during.signal,onModelText:()=>during.abort()}),/取消/);
 assert.equal(calls,1);
});
test('whole-card review can shorten multiple paragraphs without altering passage edit semantics',()=>{
 const draft='First.\n\nSecond.',edit=JSON.stringify({corrections:[{id:'p1',value:'Both, briefly.',reason:'Too long for the card.'}]});
 assert.equal(paragraphs.apply(draft,edit,true).answer,'Both, briefly.');
 assert.equal(paragraphs.apply(draft,edit).answer,'Both, briefly.\n\nSecond.');
 assert.equal(paragraphs.apply(draft,'{"corrections":[]}',true).answer,draft);
 assert.throws(()=>paragraphs.apply(draft,'{"corrections":[{"id":"p2","value":"bad","reason":"not a card id"}]}',true));
});
