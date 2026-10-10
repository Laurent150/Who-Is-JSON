// Legacy direct pipeline regression; the release default is tested separately.
process.env.WHO_TALK_PIPELINE='direct';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {record,summary}=require('../ai/ai-usage');
const {generateTalk,settings}=require('../ai/ai-talk');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
test('usage counts reasoning as part of output and preserves unavailable counters',()=>{
 const a=record({prompt_tokens:100,completion_tokens:60,total_tokens:160,completion_tokens_details:{reasoning_tokens:40},prompt_cache_hit_tokens:50,secret:'not retained'},'draft');
 const b=record({prompt_tokens:200,completion_tokens:80,total_tokens:280,completion_tokens_details:{reasoning_tokens:70},prompt_cache_hit_tokens:100},'review');
 const total=summary([a,b]);assert.equal(total.totalTokens,440);assert.equal(total.outputTokens,140);assert.equal(total.reasoningTokens,110);assert.equal(total.cachedInputTokens,150);assert.equal(total.calls[0].secret,undefined);
 assert.equal(summary([a,record({},'review')]).totalTokens,null);assert.equal(summary([]).totalTokens,null);
 for(const bad of [-1,'10',Infinity,1.5])assert.equal(record({prompt_tokens:bad},'draft').inputTokens,null);
});
test('talk usage records draft, failed protocol review and repair without leaking content',async()=>{
 let calls=0;const observed=[];
 const draft={title:'Sample',sections:[{title:'Result',text:'Original prose.'}],questions:[]};
 const config={base:'https://example.org',model:'test',sponsoredCall:async body=>mockFinalAudit(body,{prompt_tokens:10,completion_tokens:5,total_tokens:15})||({usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15},choices:[{message:{content:++calls===1?JSON.stringify(draft):calls===2?'bad JSON':'{"corrections":[]}'}}]})};
 const result=await generateTalk('function f(){}','sample.js',{audience:'nontechnical'},config,{onUsage:u=>observed.push(u)});
 assert.equal(result.usage.totalTokens,45);assert.deepEqual(result.usage.calls.map(c=>c.phase),['draft','review','repair']);assert.deepEqual(observed,result.usage.calls);assert.equal(result.sections[0].text,'Original prose.');assert.match(result.note,/入门理解/);
 assert.doesNotMatch(JSON.stringify(result.usage),/Original prose|function f|secret/);
 assert.equal(settings({audience:'nontechnical'}).audience,'beginner');
});
test('unsupported audience names remain invalid after merging legacy preferences',()=>{
 for(const audience of ['unknown','__proto__','constructor'])assert.throws(()=>settings({audience}),/设置无效/);
});
test('optional evaluation observers capture only provider identity and final text, not reasoning or connection data',async()=>{
 const {modelCall}=require('../ai/ai-client'),models=[],texts=[];
 const answer=await modelCall({base:'https://example.org',model:'requested',key:'test-only-secret',sponsoredCall:async()=>({model:'reported',choices:[{message:{content:'Final content',reasoning_content:'Private reasoning'}}]})},[],{onProviderModel:m=>models.push(m),onModelText:(text,phase)=>texts.push({text,phase}),usagePhase:'composition'});
 assert.equal(answer,'Final content');assert.deepEqual(models,['reported']);assert.deepEqual(texts,[{text:'Final content',phase:'composition'}]);
 assert.doesNotMatch(JSON.stringify({models,texts}),/Private reasoning|test-only-secret/);
});
