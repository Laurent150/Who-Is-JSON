const {test}=require('node:test'),assert=require('node:assert/strict');
const {modelCall,requestOptions}=require('../ai/ai-client'),expression=require('../ai/ai-expression-review'),audit=require('../ai/ai-final-audit');
const {mockFinalAudit}=require('./final-audit-mock.cjs');

test('editing boundaries are confined to the reviewer, not initial composition or final audit',()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const task of ['talk','knowledge','ask','flow','overview']){
  const options={task,locale,readingMode,audience:'beginner',detail:'standard',coverage:'full'};
  assert.match(expression.instruction(options,true),/FIMI_REVIEW_EDIT_SCOPE_V2/);
  assert.doesNotMatch(expression.instruction(options),/FIMI_REVIEW_EDIT_SCOPE_V2/);
  assert.doesNotMatch(audit.instruction(options),/FIMI_REVIEW_EDIT_SCOPE_V2/);
  const initial=requestOptions({base:'https://example.org',model:'mock'},[{role:'system',content:'Explain'}],{...options,explanation:true});
  assert.doesNotMatch(JSON.stringify(initial),/FIMI_REVIEW_EDIT_SCOPE_V2/);
  if(locale==='en')assert.doesNotMatch(expression.instruction(options,true),/[\u3400-\u9fff]/);
 }
});

test('beginner selections and introductory talks omit audit while other routes retain it and all preserve source',async()=>{
 const source='function choose(value) { return value; }';
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const task of ['talk','knowledge','ask']){
  const point=task==='ask'&&readingMode==='beginner',noAudit=point||task==='talk';
  const json=task!=='ask',draft=task==='talk'?JSON.stringify({title:'Walkthrough',sections:[{title:'Result',text:'Returns the supplied value.'}],questions:[]}):task==='knowledge'?JSON.stringify({kind:'definition',answer:'Returns the supplied value.'}):'Returns the supplied value.';
  const seen=[];const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
   seen.push(body);const final=mockFinalAudit(body);if(final)return final;
   assert.ok(seen.length<=2,'No extra model stage is permitted');
   return {choices:[{message:{content:seen.length===1?draft:(json||point)?'{"corrections":[]}':draft}}]};
  }};
  const messages=[{role:'system',content:'Explain the source.'},{role:'user',content:JSON.stringify({filename:'choose.js',source,selectedSource:{start:1,end:1,code:source}})}];
  const result=await modelCall(config,messages,{task,locale,readingMode,audience:'beginner',json,explanation:true});
  assert.equal(result,draft);assert.equal(seen.length,noAudit?2:3);
  assert.doesNotMatch(seen[0].messages[0].content,/FIMI_REVIEW_EDIT_SCOPE_V2/);
  assert.match(seen[1].messages[0].content,point?/方法3复核候选V1|FIMI_METHOD3_PARAGRAPH_REVIEW_V1/:/FIMI_REVIEW_EDIT_SCOPE_V2/);
  if(!noAudit)assert.doesNotMatch(seen[2].messages[0].content,/FIMI_REVIEW_EDIT_SCOPE_V2/);
  assert.equal(JSON.parse(seen[1].messages.find(m=>m.role==='user').content).source,source);
 }
});
