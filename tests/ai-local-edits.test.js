const {test}=require('node:test'),assert=require('node:assert/strict');
const local=require('../ai/ai-review-local-edits'),client=require('../ai/ai-client');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const source='function pick(cache,key,fallback) { return cache[key] ?? fallback; }';
const messages=[{role:'system',content:'Explain.'},{role:'user',content:JSON.stringify({filename:'pick.js',source})},{role:'user',content:'UNTRUSTED_LEDGER fabricated guarantee'}];
const edit=(overrides={})=>({field:'f0',quote:'always stored',replacement:'stored unless nullish',sourceQuote:'cache[key] ?? fallback',reason:'Nullish values take the fallback.',...overrides});
const response=value=>({choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
const config=call=>({base:'https://example.org',model:'mock',sponsoredCall:call});
async function experiment(fn){
 const before=[process.env.WHO_TALK_EVAL_TRACE,process.env.WHO_CLOUD_DISABLED];
 process.env.WHO_TALK_EVAL_TRACE='1';process.env.WHO_CLOUD_DISABLED='1';
 try{return await fn();}finally{for(const [i,key]of ['WHO_TALK_EVAL_TRACE','WHO_CLOUD_DISABLED'].entries())if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];}
}
test('local edits preserve CRLF, Unicode, other fields and parser identities transactionally',()=>{
 const draft={answer:'前文🙂\r\nalways stored\r\n后文',nodes:[{id:'source-node',start:4,end:8,source:'unchanged',title:'Same title'}]};
 const before=structuredClone(draft),out=JSON.parse(local.apply(draft,JSON.stringify({edits:[edit()]}),source));
 assert.equal(out.answer,'前文🙂\r\nstored unless nullish\r\n后文');assert.deepEqual(out.nodes,draft.nodes);assert.deepEqual(draft,before);
 assert.deepEqual(JSON.parse(local.apply(draft,'{"edits":[]}',source)),draft);
});
test('invalid field, ambiguous quote, forged evidence, overlap and structural writes fail before any mutation',()=>{
 const draft={answer:'always stored, then always stored',summary:'Another claim'},before=structuredClone(draft);
 for(const item of [edit(),edit({field:'f999'}),edit({sourceQuote:'return fake;'}),edit({quote:'missing'}),edit({replacement:null}),edit({reason:''}),edit({path:['source']})]){
  assert.throws(()=>local.apply(draft,JSON.stringify({edits:[item]}),source),{code:'AI_REVIEW_PROTOCOL'});assert.deepEqual(draft,before);
 }
 const unique={answer:'It is always stored.'};
 assert.throws(()=>local.apply(unique,JSON.stringify({edits:[edit(),edit({quote:'is always stored',replacement:'may use fallback'})]}),source),{code:'AI_REVIEW_PROTOCOL'});
 assert.throws(()=>local.apply(unique,JSON.stringify({edits:[edit(),edit({field:'f9'})]}),source),{code:'AI_REVIEW_PROTOCOL'});
 assert.deepEqual(unique,{answer:'It is always stored.'});
});
test('multiple non-overlapping edits use original positions and cannot change non-prose facts',()=>{
 const draft={answer:'always stored; always present.',id:'always stored'};
 const out=JSON.parse(local.apply(draft,JSON.stringify({edits:[edit(),edit({quote:'always present',replacement:'possibly absent'})]}),source));
 assert.equal(out.answer,'stored unless nullish; possibly absent.');assert.equal(out.id,draft.id);
 for(const value of [{edits:[],extra:true},{corrections:[]},{edits:Array(25).fill(edit())},{edits:[edit({replacement:'x'.repeat(2001)})]}])assert.throws(()=>local.apply(draft,JSON.stringify(value),source),{code:'AI_REVIEW_PROTOCOL'});
});
test('local input excludes generated ledger and conflicting audience plans while preserving source, settings and every prose field',()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const task of ['ask','knowledge','flow','overview','talk']){
  const options={locale,readingMode,task,audience:'review',detail:'detailed',coverage:'full',reviewFoundation:{version:'frozen'}};
  const input=local.build(messages,{title:'Title',sections:[{text:'Text'}]},options);
  assert.equal(input.source,source);assert.equal(input.settings.task,task);assert.equal(input.settings.readingMode,readingMode);assert.equal(input.settings.audience,'review');
  assert.deepEqual(input.fields.map(f=>f.text),['Title','Text']);assert.doesNotMatch(JSON.stringify(input),/UNTRUSTED_LEDGER/);
  const prompt=local.instruction(options);if(locale==='en')assert.doesNotMatch(prompt,/[\u3400-\u9fff]/);
  assert.match(prompt,task==='talk'?/Walkthrough:|讲解稿：/:/Point reading:|点读：/);
 }
});
test('evaluation switches are rejected outside an explicit local evaluation before any model request',async()=>{
 const saved=process.env.WHO_TALK_EVAL_TRACE;delete process.env.WHO_TALK_EVAL_TRACE;
 try{await assert.rejects(()=>client.reviewModelResponse(config(()=>{throw Error('must not dispatch');}),messages,'Draft',{evaluationReview:{editor:'local-edits-v1',audit:'off'}}),/Invalid review evaluation/);}finally{if(saved!==undefined)process.env.WHO_TALK_EVAL_TRACE=saved;}
});
test('both raw and structured explanations edit only the intended fragment and audit the exact resulting candidate',()=>experiment(async()=>{
 for(const json of [false,true])for(const audit of ['on','off']){
  const phases=[],reports=[];
  const draft=json?JSON.stringify({answer:'It is always stored.',summary:'Keep this.'}):'It is always stored.';
  const out=await client.reviewModelResponse(config(async body=>{
   if(phases.at(-1)==='final-audit'){
    const input=JSON.parse(body.messages[1].content);assert.equal(input.fields[0].text,'It is stored unless nullish.');return mockFinalAudit(body);
   }
   const input=JSON.parse(body.messages[1].content);assert.equal(input.fields[0].text,'It is always stored.');assert.equal(input.reviewContext.sourceHash.length,64);
   assert.doesNotMatch(JSON.stringify(body),/UNTRUSTED_LEDGER/);return response({edits:[edit()]});
  }),messages,draft,{locale:'en',readingMode:'standard',json,evaluationReview:{editor:'local-edits-v1',audit},onModelRequest:(_,phase)=>phases.push(phase),onFinalAudit:report=>reports.push(report)});
  assert.equal(json?JSON.parse(out).answer:out,'It is stored unless nullish.');if(json)assert.equal(JSON.parse(out).summary,'Keep this.');
  assert.deepEqual(phases,audit==='on'?['review','final-audit']:['review']);assert.equal(reports.length,audit==='on'?1:0);
 }
}));
test('local review has at most one protocol repair and never substitutes an unreviewed draft',()=>experiment(async()=>{
 let calls=0;
 const options={json:true,locale:'en',evaluationReview:{editor:'local-edits-v1',audit:'off'}};
 const out=await client.reviewModelResponse(config(async()=>response(++calls===1?{edits:[edit({sourceQuote:'invented'})]}:{edits:[edit()]})),messages,'{"answer":"always stored"}',options);
 assert.equal(JSON.parse(out).answer,'stored unless nullish');assert.equal(calls,2);
 calls=0;await assert.rejects(()=>client.reviewModelResponse(config(async()=>{calls++;return response({edits:[edit({quote:'missing'})]});}),messages,'{"answer":"always stored"}',options),{code:'AI_REVIEW_PROTOCOL'});assert.equal(calls,2);
}));
test('audit-off still checks display limits and does not retry service failures or cancellations',()=>experiment(async()=>{
 const options={json:true,task:'knowledge',evaluationReview:{editor:'local-edits-v1',audit:'off'}};
 await assert.rejects(()=>client.reviewModelResponse(config(async()=>response({edits:[]})),messages,JSON.stringify({answer:'x'.repeat(2401)}),options),{code:'AI_FINAL_TEXT_LIMIT'});
 let calls=0;await assert.rejects(()=>client.reviewModelResponse(config(async()=>{calls++;throw Error('Service unavailable');}),messages,'{"answer":"draft"}',options),/Service unavailable/);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>client.reviewModelResponse(config(async()=>{calls++;}),messages,'{"answer":"draft"}',{...options,signal:controller.signal}),/取消/);assert.equal(calls,1);
}));
test('legacy evaluation uses the existing editor; default requests still run the existing independent audit',()=>experiment(async()=>{
 for(const evaluationReview of [undefined,{editor:'legacy',audit:'off'}]){
  const phases=[];
  const out=await client.reviewModelResponse(config(async body=>{
   if(phases.at(-1)==='final-audit')return mockFinalAudit(body);
   assert.doesNotMatch(body.messages[0].content,/FIMI_LOCAL_EDITS_V1/);return response({corrections:[]});
  }),messages,'{"answer":"A correct answer."}',{json:true,locale:'en',evaluationReview,onModelRequest:(_,phase)=>phases.push(phase)});
  assert.equal(JSON.parse(out).answer,'A correct answer.');assert.deepEqual(phases,evaluationReview?['review']:['review','final-audit']);
 }
}));
