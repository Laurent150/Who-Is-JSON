const {test}=require('node:test'),assert=require('node:assert/strict');
const {apply,parseDraft}=require('../ai-review-patches');
const {modelCall}=require('../ai-client');
test('review edits only existing prose strings and preserves identities transactionally',()=>{
 const draft={summary:'Draft',nodes:[{id:'n2',start:3,explanation:'Wrong',example:''}]};
 const result=JSON.parse(apply(draft,JSON.stringify({corrections:[{path:['nodes',0,'explanation'],value:'Correct'},{path:['summary'],value:'Reviewed'}]})));
 assert.equal(result.nodes[0].explanation,'Correct');assert.equal(result.nodes[0].id,'n2');assert.equal(result.nodes[0].start,3);
 assert.equal(draft.nodes[0].explanation,'Wrong');assert.equal(draft.summary,'Draft');
 for(const path of [['nodes',0,'id'],['nodes',0,'start'],['nodes',4,'explanation'],['__proto__','title'],['constructor','prototype','title'],['nodes','01','explanation'],['nodes','-1','explanation'],['nodes','1e0','explanation']])assert.throws(()=>apply(draft,JSON.stringify({corrections:[{path,value:'changed'}]})),/无效修改/);
 assert.deepEqual(JSON.parse(apply(draft,'{"corrections":[]}')),draft);
 assert.equal(parseDraft('{"summary":'),null);
 assert.throws(()=>apply(draft,'{} invalid'),/格式不完整/);
});
test('structured model review applies a correction without returning the patch protocol to the UI',async()=>{
 let calls=0;
 const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
  calls++;
  if(calls===2)assert.match(body.messages[0].content,/REVIEW OUTPUT CONTRACT/);
  return {choices:[{message:{content:calls===1?'{"kind":"definition","answer":"Wrong"}':'{"corrections":[{"path":["answer"],"value":"Use the new value only when it is not None."}]}'}}]};
 }};
 const result=JSON.parse(await modelCall(config,[{role:'system',content:'Explain'},{role:'user',content:'if incoming is not None: current = incoming'}],{json:true,explanation:true,task:'knowledge',locale:'en'}));
 assert.equal(result.kind,'definition');assert.match(result.answer,/not None/);assert.equal(result.corrections,undefined);
});
test('cancelling between draft and review never starts another sponsored request',async()=>{
 const controller=new AbortController();let calls=0;
 const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{
  calls++;controller.abort();return {choices:[{message:{content:'draft'}}]};
 }};
 await assert.rejects(modelCall(config,[],{explanation:true,signal:controller.signal}),/取消/);
 assert.equal(calls,1);
 await assert.rejects(modelCall(config,[],{explanation:true,signal:controller.signal}),/取消/);
 assert.equal(calls,1);
});
test('beginner readability flags dense paragraphs without rewriting text or flagging short separated paragraphs',()=>{
 const {readabilityHints}=require('../ai-review-patches');
 const dense='word '.repeat(160),short='word '.repeat(80);
 const draft={sections:[{text:dense},{text:short+'\n\n'+short},{text:'Short.'}]};
 const hint=readabilityHints(draft,{locale:'en',readingMode:'beginner'});
 assert.match(hint,/\["sections",0,"text"\]/);assert.doesNotMatch(hint,/\["sections",1/);
 assert.equal(draft.sections[0].text,dense);
 assert.equal(readabilityHints(draft,{locale:'en',readingMode:'standard'}),'');
 assert.equal(readabilityHints({sections:[{text:'短段'}]},{locale:'zh-CN',readingMode:'beginner'}),'');
 assert.equal(readabilityHints({sections:[{text:'字'.repeat(170)}]},{locale:'zh-CN',readingMode:'beginner'}),'');
 assert.match(readabilityHints({sections:[{text:'字'.repeat(300)}]},{locale:'zh-CN',readingMode:'beginner'}),/必须修改/);
});
test('beginner review removes hidden questions before listing allowed prose edits',async()=>{
 let calls=0;
 const draft={title:'Walkthrough',sections:[{title:'Step',text:'Read the input.'}],questions:[{question:'Why?',answer:'Because.'}]};
 const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
  calls++;
  if(calls===2){
   const reviewed=JSON.parse(body.messages.find(m=>m.role==='assistant').content);
   assert.deepEqual(reviewed.questions,[]);
   assert.match(body.messages[0].content,/\["sections",0,"text"\]/);
   assert.doesNotMatch(body.messages[0].content,/\["questions",0,"answer"\]/);
  }
  return {choices:[{message:{content:calls===1?JSON.stringify(draft):'{"corrections":[]}'}}]};
 }};
 const output=JSON.parse(await modelCall(config,[{role:'system',content:'Explain'},{role:'user',content:'source'}],{json:true,explanation:true,task:'talk',locale:'en',readingMode:'beginner'}));
 assert.deepEqual(output.questions,[]);assert.equal(draft.questions.length,1);
});
test('nested flow prose can be reviewed without loosening identity or path checks',()=>{
 const path=['nodes',0,'branches',0,'nodes',0,'branches',0,'nodes',0,'explanation'];
 const draft={nodes:[{id:'a',branches:[{nodes:[{id:'b',branches:[{nodes:[{id:'c',explanation:'Draft'}]}]}]}]}]};
 const {allowedPaths}=require('../ai-review-patches');
 assert.ok(allowedPaths(draft).includes(JSON.stringify(path)));
 const corrected=JSON.parse(apply(draft,JSON.stringify({corrections:[{path,value:'Correct'}]})));
 assert.equal(corrected.nodes[0].branches[0].nodes[0].branches[0].nodes[0].explanation,'Correct');
 assert.throws(()=>apply(draft,JSON.stringify({corrections:[{path:[...path.slice(0,-1),'id'],value:'Wrong'}]})),/无效修改/);
});


test('review accepts canonical string indices only on existing array elements',()=>{
 const draft={sections:[{title:'Step',text:'Draft'}],nodes:[{id:'n1',explanation:'Draft'}]};
 const corrected=JSON.parse(apply(draft,JSON.stringify({corrections:[{path:['sections','0','text'],value:'Reviewed'}]})));
 assert.equal(corrected.sections[0].text,'Reviewed');assert.equal(draft.sections[0].text,'Draft');
 for(const path of [['sections','00','text'],['sections','-0','text'],['sections','1.0','text'],['sections','1','text'],['nodes','0','id'],['sections','__proto__','text']])assert.throws(()=>apply(draft,JSON.stringify({corrections:[{path,value:'bad'}]})),/无效修改/);
});

test('catalog IDs address nested prose and reject unknown, ambiguous and duplicate edits',()=>{
 const draft={summary:'Draft',nodes:[{id:'n17',start:18,branches:[{nodes:[{id:'n20',explanation:'Wrong'}]}]}]};
 const {allowedPaths}=require('../ai-review-patches');
 assert.match(allowedPaths(draft),/"field":"f1","path":\["nodes",0,"branches",0,"nodes",0,"explanation"\]/);
 const corrected=JSON.parse(apply(draft,JSON.stringify({corrections:[{field:'f1',anchor:'Wrong',value:'Correct'}]})));
 assert.equal(corrected.nodes[0].branches[0].nodes[0].explanation,'Correct');
 assert.equal(corrected.nodes[0].id,'n17');assert.equal(corrected.nodes[0].start,18);
 for(const edit of [{field:'f17',value:'bad'},{field:'f01',value:'bad'},{field:'f1',path:['summary'],value:'bad'},{field:'f1',value:{}},{path:'nodes[17].explanation',value:'bad'}])assert.throws(()=>apply(draft,JSON.stringify({corrections:[edit]})),e=>e.code==='AI_REVIEW_PROTOCOL');
 for(const anchor of [undefined,'Draft','wrong'])assert.throws(()=>apply(draft,JSON.stringify({corrections:[{field:'f1',anchor,value:'Wrong target'}]})),/无效修改/);
 assert.throws(()=>apply(draft,JSON.stringify({corrections:[{field:'f0',anchor:'Draft',value:'a'},{path:['summary'],value:'b'}]})),/无效修改/);
 assert.equal(draft.summary,'Draft');
});

test('full review compatibility preserves non-prose structure and identities',()=>{
 const draft={summary:'Draft',nodes:[{id:'n1',start:2,explanation:'Wrong'}]};
 assert.equal(JSON.parse(apply(draft,JSON.stringify({...draft,summary:'Correct'}))).summary,'Correct');
 for(const result of [{summary:'Short'}, {...draft,nodes:[]},{...draft,nodes:[{id:'n9',start:2,explanation:'Correct'}]},{...draft,extra:'bad'}])assert.throws(()=>apply(draft,JSON.stringify(result)),e=>e.code==='AI_REVIEW_PROTOCOL');
});

test('invalid review gets at most one protocol repair using the original source and draft',async()=>{
 const source='async function value() { return 1; }',draft={summary:'Wrong',nodes:[{id:'n1',explanation:'Wrong'}]};
 for(const invalid of ['{','{"corrections":[{"path":"nodes[17].explanation","value":"bad"}]}','{"corrections":[{"path":["nodes",17,"explanation"],"value":"bad"}]}']){
  const seen=[];
  const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
   seen.push(body);return {choices:[{message:{content:seen.length===1?JSON.stringify(draft):seen.length===2?invalid:'{"corrections":[{"field":"f0","anchor":"Wrong","value":"Returns a Promise that fulfills with 1."}]}'}}]};
  }};
  const output=JSON.parse(await modelCall(config,[{role:'system',content:'Explain'},{role:'user',content:source}],{json:true,explanation:true,task:'flow',locale:'en'}));
  assert.equal(seen.length,3);assert.match(output.summary,/Promise/);assert.equal(output.nodes[0].id,'n1');
  assert.equal(seen[2].messages[1].content,source);
  assert.deepEqual(JSON.parse(seen[2].messages.find(m=>m.role==='assistant').content),draft);
 }
});

test('persistent invalid review, cancellation and trial exhaustion cannot fall back to drafts or retry indefinitely',async()=>{
 for(const outcome of ['invalid','cancel','quota']){
  const controller=new AbortController();let calls=0;
  const config={base:'https://example.org',model:'mock',sponsoredCall:async()=>{
   calls++;
   if(calls===1)return {choices:[{message:{content:'{"summary":"Unchecked"}'}}]};
   if(outcome==='quota')throw Error('试用额度已用完');
   if(outcome==='cancel')controller.abort();
   return {choices:[{message:{content:'{"corrections":[{"field":"f999","value":"bad"}]}'}}]};
  }};
  await assert.rejects(modelCall(config,[{role:'system',content:'Explain'}],{json:true,explanation:true,signal:controller.signal}),outcome==='quota'?/额度已用完/:outcome==='cancel'?/取消/:/无效修改/);
  assert.equal(calls,outcome==='invalid'?3:2);
 }
});
