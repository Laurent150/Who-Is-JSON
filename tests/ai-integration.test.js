const {test}=require('node:test'),assert=require('node:assert/strict');
const {generateTalk}=require('../ai/ai-talk'),composition=require('../ai/ai-talk-composition');
const format=require('../ai/ai-talk-format'),{mockFinalAudit}=require('./final-audit-mock.cjs');
// Opt in only within the tests that exercise the retained offline gate.
process.env.WHO_TALK_EVAL_TRACE='1';process.env.WHO_CLOUD_DISABLED='1';
const offlineAudit={evaluationReview:{editor:'legacy',audit:'on'}};
const source='function echo(value) {\r\n  return value; // 中文 😀\r\n}';
const ledger={units:[{name:'echo',anchor:'function echo(value)',accepts:'A value.',returns:'The supplied value.',timing:'Returns directly.',paths:[{when:'Called',does:'Return value.',completion:'Value.',failure:'No explicit handler.',anchor:'return value;'}],unknowns:[]}]};
const doc={title:'Echo',sections:[{title:'Result',text:'Keep the original paragraph, punctuation } ] : , and Unicode 中文 😀. '+ 'Readable text. '.repeat(10)}],questions:[]};
const reply=(value,finish='stop')=>({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:finish,message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
async function run({request={},settings={},draft=JSON.stringify(doc),overrides={}}={}){
 const phases=[],bodies=[],events=[];
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{
  const phase=phases.at(-1);bodies.push(body);
  if(overrides[phase])return overrides[phase](body);
  if(phase==='contracts')return reply(ledger);
  if(phase==='composition')return reply(draft);
  if(phase==='review')return reply({corrections:[]});
  if(phase==='final-audit')return mockFinalAudit(body,{prompt_tokens:10,completion_tokens:20,total_tokens:30});
  throw Error('Unexpected request: '+phase);
 }};
 try {const result=await generateTalk(source,'echo.js',{audience:'beginner',detail:'standard',coverage:'full',...settings},config,{locale:'en',readingMode:'beginner',...request,onModelRequest:(body,phase)=>phases.push(phase),onProtocolRepair:event=>events.push(event)});return {result,phases,bodies,events};}
 catch(error){error.phases=phases;throw error;}
}
test('default introductory walkthrough uses method 4 and the existing review, then delivers without a paid final audit',async()=>{
 const prior=process.env.WHO_TALK_COMPOSITION;delete process.env.WHO_TALK_COMPOSITION;
 try{
  const {result,phases,bodies}=await run();
  assert.deepEqual(phases,['contracts','composition','review']);
  const settings={task:'talk',locale:'en',readingMode:'beginner',audience:'beginner',detail:'standard',coverage:'full'};
  assert.equal(bodies[1].messages.length,2);
  const method4=require('../ai/ai-talk-method4');
  assert.equal(bodies[1].messages[0].content,method4.instruction(settings)+'\n\n'+method4.example('en'));
  const input=JSON.parse(bodies[1].messages[1].content);
  assert.equal(input.source,source);assert.deepEqual(input.sourceContracts,ledger);assert.deepEqual(input.settings,settings);
  assert.deepEqual(input.reviewContext,JSON.parse(bodies[0].messages[1].content).reviewContext);
  assert.deepEqual(bodies.map(b=>b.reasoning_effort),['low','high','high']);
  assert.deepEqual(bodies.map(b=>b.max_tokens),[16384,24576,24576]);
  assert.match(bodies[2].messages[0].content,/FIMI_REVIEW_EDIT_SCOPE_V2/);
  assert.equal(result.sections[0].text,doc.sections[0].text);assert.equal(result.usage.calls.length,3);
 }finally{if(prior===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=prior;}
});
test('E draft settings remain distinct for every language, reading mode, audience, detail and coverage',()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const audience of ['beginner','peer','review'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
  const options={task:'talk',locale,readingMode,audience,detail,coverage};
  const messages=composition.messages([{role:'user',content:JSON.stringify({filename:'echo.js',source})}],ledger,options);
  assert.deepEqual(JSON.parse(messages[1].content).settings,options);
  const prompt=messages[0].content;
  if(locale==='en')assert.doesNotMatch(prompt,/[\u3400-\u9fff]/);
  assert.match(prompt,locale==='en'?/Useful repetition is allowed/:/允许有助理解的重复/);
  if(readingMode==='beginner'||audience==='beginner')assert.match(prompt,locale==='en'?/without programming knowledge/:/没有编程知识的成年人/);
  assert.equal(messages.length,2);
 }
});

test('introductory and peer delivery keep reviewed text in both languages while code-review retains its gate',async()=>{
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const audience of ['beginner','nontechnical','peer','review']){
  const revised=locale==='en'?'The code gives the supplied value back.':'这段代码把提供的值交回。';
  const {result,phases}=await run({request:{locale,readingMode},settings:{audience},overrides:{review:()=>reply({corrections:[{field:'f2',anchor:doc.sections[0].text,value:revised}]})}});
  assert.deepEqual(phases,['beginner','nontechnical','peer','review'].includes(audience)?['contracts','composition','review']:['contracts','composition','review','final-audit']);
  assert.equal(result.sections[0].text,revised);assert.equal(result.usage.calls.length,phases.length);
 }
});

test('removing the paid gate never skips review failure or the final required-prose checks',async()=>{
 await assert.rejects(()=>run({overrides:{review:()=>reply('invalid'),repair:()=>reply('invalid')}}),e=>{
  assert.deepEqual(e.phases,['contracts','composition','review','repair']);return e.code==='AI_REVIEW_PROTOCOL';
 });
 await assert.rejects(()=>run({overrides:{review:()=>reply({corrections:[{field:'f2',anchor:doc.sections[0].text,value:''}]})}}),e=>{
  assert.deepEqual(e.phases,['contracts','composition','review']);return e.code==='AI_TALK_PROTOCOL';
 });
 const {phases}=await run({settings:{evaluationReview:{editor:'legacy',audit:'on'}}});
 assert.deepEqual(phases,['contracts','composition','review'],'Public walkthrough settings must not enable an offline-only gate');
});
test('personal and current CloudBase policy forward identical method 4 and review requests',async()=>{
 const {prepare}=await import('../cloudbase/functions/ai-trial/policy.mjs');
 const {bodies}=await run();
 for(const body of bodies)assert.deepEqual(prepare(body).body,body);
 const oldFetch=global.fetch,captured=[];
 try{
  global.fetch=async(url,input)=>{captured.push(JSON.parse(input.body));return Response.json(reply(doc));};
  await require('../ai/ai-client').modelCall({base:'https://api.deepseek.com',model:'deepseek-flash'},bodies[1].messages,{task:'talk',json:true,reviewReasoning:true,usagePhase:'composition',compositionPrompt:'M4'});
  assert.deepEqual(captured[0],bodies[1]);
 }finally{global.fetch=oldFetch;}
});
test('B is an explicit high-thinking rollback, and invalid switches fail before dispatch',async()=>{
 const prior=process.env.WHO_TALK_COMPOSITION;
 try{
  process.env.WHO_TALK_COMPOSITION='B';const {bodies,phases}=await run();assert.equal(bodies[1].thinking.type,'enabled');assert.equal(bodies[1].max_tokens,24576);assert.match(bodies[1].messages[0].content,/^Write the final code walkthrough/);assert.equal(phases.length,3);
  process.env.WHO_TALK_COMPOSITION='unrecognized';await assert.rejects(run,error=>{assert.deepEqual(error.phases,[]);return /composition version/.test(error.message);});
 }finally{if(prior===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=prior;}
});
test('full-field review anchors and redundant audit references still work with explicit offline audit',async()=>{
 const changed='A corrected paragraph whose complete original reference is longer than 96 UTF-16 units.';
 const {result,phases}=await run({request:offlineAudit,overrides:{review:body=>{
  const draft=JSON.parse(body.messages.find(m=>m.role==='assistant').content);assert.equal(draft.sections[0].text,doc.sections[0].text);
  return reply({corrections:[{field:'f2',anchor:doc.sections[0].text,value:changed}]});
 },'final-audit':body=>{
  const input=JSON.parse(body.messages[1].content);assert.equal(input.fields.find(f=>f.field==='f2').text,changed);
  const r=JSON.parse(mockFinalAudit(body).choices[0].message.content);const item=r.checks.find(x=>x.id==='RETURN-01');r.checks.push({...item,reason:'See above.'});return reply(r);
 }}});
 assert.equal(result.sections[0].text,changed);assert.equal(phases.length,4);
});
test('known complete-format faults recover locally before content review without an extra call',async()=>{
 const raw=JSON.stringify(doc);
 for(const draft of [raw.slice(0,-1)+',}',JSON.stringify({title:doc.title,sections:doc.sections})+',"questions":[]}']){
  const {result,phases,events}=await run({draft});assert.equal(result.sections[0].text,doc.sections[0].text);assert.equal(phases.length,3);assert.equal(events.length,1);
 }
});
test('one separator-only model repair preserves exact strings before the existing review',async()=>{
 const raw=JSON.stringify(doc),draft=raw.replace(',"sections"',' "sections"');
 const {result,phases,bodies}=await run({draft,overrides:{'composition-format-repair':()=>reply(raw)}});
 assert.deepEqual(phases,['contracts','composition','composition-format-repair','review']);
 assert.equal(result.sections[0].text,doc.sections[0].text);assert.equal(result.usage.calls.length,4);
 assert.doesNotMatch(bodies[2].messages[0].content,/FIMI_REVIEW_CONTEXT|independent review/i);
 assert.equal(bodies[2].messages[1].content,draft);assert.equal(bodies[2].max_tokens,24576);
});
test('format repair cannot change text, reorder containers, or trigger a second repair',async()=>{
 const raw=JSON.stringify(doc),draft=raw.replace(',"sections"',' "sections"');
 for(const response of [raw.replace('Keep','Rewrite'),JSON.stringify({sections:doc.sections,title:doc.title,questions:[]}),draft]){
  await assert.rejects(()=>run({draft,overrides:{'composition-format-repair':()=>reply(response)}}),error=>{
   assert.equal(error.code,'AI_TALK_PROTOCOL');assert.deepEqual(error.phases,['contracts','composition','composition-format-repair']);return true;
  });
 }
});
test('incomplete or ambiguous drafts never invent text or enter a review',async()=>{
 const raw=JSON.stringify(doc);
 for(const draft of [raw.slice(0,-1),raw+raw,raw.replace('"title":','"title":"duplicate","title":'),JSON.stringify({...doc,questions:null}),JSON.stringify({...doc,sections:[]})]){
  await assert.rejects(()=>run({draft}),e=>{assert.deepEqual(e.phases,['contracts','composition']);return e.code==='AI_TALK_PROTOCOL';});
 }
 await assert.rejects(()=>run({overrides:{composition:()=>reply(doc,'length')}}),e=>{assert.deepEqual(e.phases,['contracts','composition']);return /长度限制/.test(e.message);});
});
test('format-service failure and cancellation stop the chain, preserving usage counters',async()=>{
 const draft=JSON.stringify(doc).replace(',"sections"',' "sections"');
 await assert.rejects(()=>run({draft,overrides:{'composition-format-repair':()=>{throw Error('AI 服务返回 429。请求过多或额度受限，请稍后重试。');}}}),e=>{assert.equal(e.phases.length,3);assert.equal(e.usage.calls.length,2);return /429/.test(e.message);});
 const controller=new AbortController();
 await assert.rejects(()=>run({draft,request:{signal:controller.signal},overrides:{'composition-format-repair':()=>{controller.abort();return reply(doc);}}}),e=>{assert.equal(e.phases.length,3);return /取消/.test(e.message);});
});
test('the three format allowances remain bounded; explicit offline audit still has no retry',async()=>{
 const raw=JSON.stringify(doc),draft=raw.replace(',"sections"',' "sections"');
 const {phases,result}=await run({draft,overrides:{contracts:()=>reply({units:[]}), 'contract-repair':()=>reply(ledger),'composition-format-repair':()=>reply(raw),review:()=>reply('invalid'),'repair':()=>reply({corrections:[]})}});
 assert.deepEqual(phases,['contracts','contract-repair','composition','composition-format-repair','review','repair']);assert.equal(result.usage.calls.length,6);
 await assert.rejects(()=>run({request:offlineAudit,overrides:{'final-audit':()=>reply('invalid')}}),e=>{assert.equal(e.phases.length,4);return e.code==='AI_FINAL_AUDIT_PROTOCOL';});
});
test('empty extra metadata reaches review without another request and cannot bypass an explicit offline audit',async()=>{
 const draft=JSON.stringify({...doc,questions_note:null});
 const success=await run({draft});
 assert.deepEqual(success.phases,['contracts','composition','review']);
 assert.deepEqual(success.events,[{stage:'manuscript',repair:'empty-extra-field'}]);
 assert.equal(success.result.sections[0].text,doc.sections[0].text);
 assert.equal(Object.hasOwn(JSON.parse(success.bodies[2].messages.find(m=>m.role==='assistant').content),'questions_note'),false);
 await assert.rejects(()=>run({draft,request:offlineAudit,overrides:{'final-audit':body=>{
  const report=JSON.parse(mockFinalAudit(body).choices[0].message.content);
  report.verdict='reject';report.checks.find(c=>c.id==='SOURCE-01').status='uncertain';
  report.findings=[{rule:'SOURCE-01',field:'f2',quote:doc.sections[0].text,sourceQuote:'',reason:'An essential claim cannot be established.'}];return reply(report);
 }}}),error=>{assert.equal(error.phases.length,4);return error.code==='AI_FINAL_AUDIT_REJECTED';});
});
test('offline audit retains bounded nine-call recovery and CloudBase compatibility',async()=>{
 const quote='Keep the original paragraph',replacement='Return the provided value';
 const {result,phases,bodies}=await run({request:offlineAudit,draft:JSON.stringify(doc).replace(',"sections"',' "sections"'),overrides:{
  contracts:()=>reply('invalid'), 'contract-repair':()=>reply(ledger),
  'composition-format-repair':()=>reply(doc),review:()=>reply('invalid'),repair:()=>reply({corrections:[]}),
  'final-audit':body=>{
   const report=JSON.parse(mockFinalAudit(body).choices[0].message.content);report.verdict='reject';report.checks.find(c=>c.id==='SOURCE-01').status='fail';
   report.findings=[{rule:'SOURCE-01',field:'f2',quote,sourceQuote:'return value;',reason:'The described action must match the source.'}];return reply(report);
  },
  'final-audit-repair':()=>reply({edits:[{field:'f2',quote,replacement,sourceQuote:'return value;',reason:'Describe the actual return.'}]}),
  'final-audit-recheck':body=>mockFinalAudit(body,{prompt_tokens:10,completion_tokens:20,total_tokens:30})
 }});
 assert.deepEqual(phases,['contracts','contract-repair','composition','composition-format-repair','review','repair','final-audit','final-audit-repair','final-audit-recheck']);
 assert.equal(result.usage.calls.length,9);assert.equal(result.usage.totalTokens,270);
 assert.equal(result.sections[0].text,doc.sections[0].text.replace(quote,replacement));
 const {prepare}=await import('../cloudbase/functions/ai-trial/policy.mjs');
 for(const body of bodies.slice(-2)){assert.deepEqual(prepare(body).body,body);assert.equal(body.thinking.type,'enabled');assert.equal(body.max_tokens,24576);}
});
test('standalone format parser rejects escaped duplicate fields and preserves all Unicode and nested punctuation',()=>{
 const raw=JSON.stringify(doc);assert.deepEqual(format.parse('\uFEFF```json\n'+raw+'\n```'),doc);
 assert.throws(()=>format.parse(raw.replace('"title":','"t\\u0069tle":"duplicate","title":')),/格式不完整/);
 for(const text of [raw.replace('"text":','"extra":0,"text":'),raw.replace('"text":','"text":"duplicate","text":')])assert.throws(()=>format.parse(text));
});
