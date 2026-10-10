const {mockFinalAudit}=require('./final-audit-mock.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {generateTalk}=require('../ai/ai-talk');
const {requestOptions}=require('../ai/ai-client');
const source='def rebate(amount, member, voucher):\r\n    discount = amount * 0.1 if member else 0\r\n    if voucher and amount >= 100:\r\n        discount += 5\r\n    return min(discount, amount)\r\n';
const ledger={units:[{name:'rebate',anchor:'def rebate(amount, member, voucher):',accepts:'Amount, membership and voucher.',returns:'Capped discount.',timing:'Synchronous.',paths:[{when:'Voucher AND amount >= 100, independently of membership.',does:'Add 5.',completion:'Capped combined discount.',failure:'Unhandled failures escape.',anchor:'discount += 5'}],unknowns:[]}]};
test('every walkthrough setting retains content review and its audience-specific audit policy',async()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const audience of ['beginner','peer','review'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
  const seen=[],trace=[],wrong=locale==='en'?'Only members can receive a discount.':'只有会员才能得到折扣。';
  const corrected=locale==='en'?'Membership and the voucher are independent. The voucher applies when it is supplied AND the amount is at least 100; both discounts can accumulate.':'会员优惠与优惠券独立判断。提供优惠券且金额至少100时，优惠券生效；两种优惠可以叠加。';
  const manuscript={title:'Rebate',sections:[{title:'Discount',text:wrong}],questions:[]};
  const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   seen.push(body);
   return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(seen.length===1?ledger:seen.length===2?manuscript:{corrections:[{path:['sections',0,'text'],value:corrected}]})}}]};
  }};
  const result=await generateTalk(source,'rebate.py',{audience,detail,coverage},config,{locale,readingMode,onModelRequest:(body,phase)=>trace.push({body,phase})});
  assert.equal(result.sections[0].text,corrected);assert.equal(result.sections[0].index,null);
  assert.deepEqual(trace.map(x=>x.phase),['contracts','composition','review']);
  assert.deepEqual(seen.map(x=>x.thinking.type),['enabled','enabled','enabled']);
  assert.deepEqual(seen.filter(x=>x.thinking.type==='enabled').map(x=>x.reasoning_effort),['low','high','high']);
  for(const body of seen){
   const payload=JSON.parse(body.messages.find(m=>m.role==='user').content);
   assert.equal(payload.source,source);
   const foundation=payload.reviewContext;
   assert.equal(foundation.version,'review-foundation-v1');
   assert.deepEqual(foundation.settings,{task:'talk',locale,readingMode,audience,detail,coverage});
   assert.equal(foundation.scope.kind,'walkthrough');
   assert.equal(foundation.evidence.status,'parsed');
   assert.ok(foundation.checks.some(r=>r.id==='LOGIC-01'));
   assert.ok(!Object.hasOwn(body,'key'));assert.ok(!Object.hasOwn(body,'headers'));
  }
  assert.match(seen[2].messages[0].content,locale==='en'?/counterexample/:/反例/);
  assert.match(seen[2].messages[0].content,locale==='en'?/independent if/:/独立的多个if/);
  assert.match(seen[2].messages[0].content,/REVIEW OUTPUT CONTRACT|本次复核输出约定/);
 }
});
test('word explanations preserve source and token with draft-only beginner and reviewed standard modes',async()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const seen=[],token={text:'and',line:3,startColumn:15,endColumn:18,sourceLine:source.split('\n')[2]};
  const answer=locale==='en'?'Both a voucher and an amount of at least 100 are needed for this branch. Membership is checked separately.':'这个分支需要提供优惠券且金额至少100；会员条件另行判断。';
  const result=await require('../ai/ai-knowledge').explain(source,token,{base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   seen.push(body);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(seen.length===1?{kind:'definition',answer:readingMode==='beginner'?answer:'Either condition is enough.'}:{corrections:[{id:'p1',value:answer,reason:'Keep both required conditions.'}]})}}]};
  }},{locale,readingMode,name:'rebate.py'});
  assert.deepEqual(result,{answer});assert.equal(seen.length,readingMode==='beginner'?1:2);
  for(const body of seen){const payload=JSON.parse(body.messages.find(m=>m.role==='user').content);assert.equal(payload.source,source);assert.deepEqual(payload.selectedToken,token);}
  assert.deepEqual(seen.map(x=>x.thinking.type),readingMode==='beginner'?['disabled']:['disabled','enabled']);
 }
});
test('a failed final review never exposes a manuscript or retries a service failure',async()=>{
 let calls=0;
 const config={base:'https://example.org',model:'test',sponsoredCall:async()=>{
  calls++;if(calls===3)throw Error('额度服务暂时不可用。');
  return {choices:[{message:{content:JSON.stringify(calls===1?ledger:{title:'Rebate',sections:[{title:'Discount',text:'Unchecked candidate'}],questions:[]})}}]};
 }};
 await assert.rejects(()=>generateTalk(source,'rebate.py',{},config),/额度服务暂时不可用/);assert.equal(calls,3);
 const controller=new AbortController();calls=0;
 config.sponsoredCall=async()=>{calls++;if(calls===2)controller.abort();return {choices:[{message:{content:JSON.stringify(calls===1?ledger:{title:'Rebate',sections:[{title:'Discount',text:'Unchecked candidate'}],questions:[]})}}]};};
 await assert.rejects(()=>generateTalk(source,'rebate.py',{},config,{signal:controller.signal}),/取消/);assert.equal(calls,2);
});
test('trial policy forwards bounded thinking choices while pinning model and counting reasoning exactly once',async()=>{
 const {prepare,charge}=await import('../cloudbase/functions/ai-trial/policy.mjs');
 for(const effort of ['low','high','max','unsupported',undefined]){
  const input={messages:[{role:'user',content:'test'}],model:'expensive',max_tokens:16384,thinking:{type:'enabled'},reasoning_effort:effort};
  const p=prepare(input);assert.equal(p.body.model,'deepseek-flash');assert.equal(p.body.max_tokens,16384);
  assert.equal(p.body.reasoning_effort,effort==='high'?'high':'low');
  assert.equal(charge({prompt_tokens:100,completion_tokens:100,completion_tokens_details:{reasoning_tokens:80}},p),1000);
 }
 const disabled=prepare({messages:[{role:'user',content:'test'}],max_tokens:100,reasoning_effort:'max'}).body;
 assert.equal(disabled.thinking.type,'disabled');assert.equal(disabled.reasoning_effort,undefined);
 assert.equal(requestOptions({base:'https://example.org',model:'test'},[],{reviewReasoning:true}).body.thinking,undefined);
});
test('quality evaluation plans bounded real-setting combinations and cannot silently substitute an unsupported variant',()=>{
 const {plan,selectionPrompt}=require('./ai-quality-server.cjs');
 const input={id:'independent-rebate',variant:'candidate-thinking',task:'talk',locale:'both',readingMode:'beginner',audience:'all',detail:'standard',coverage:'full'};
 const jobs=plan(input);assert.equal(jobs.length,6);assert.deepEqual(new Set(jobs.map(j=>j.audience)),new Set(['beginner','peer','review']));
 assert.throws(()=>plan({...input,variant:'all'}),/最多6/);assert.throws(()=>plan({...input,variant:'unapproved'}),/Invalid/);
 assert.throws(()=>plan({...input,key:'must not enter reports'}),/Unknown evaluation setting/);
 assert.equal(plan({...input,task:'token',readingMode:'both'}).length,4);
 assert.match(selectionPrompt(),/selectedSource/);
 for(const c of require('./ai-quality-cases.cjs'))assert.ok(require('../ai/ai-flow').tokenSource(c.source,c.token).text.trim());
});
test('quality evaluator defaults to 80 requests and permits only a bounded explicit limit',()=>{
 const {evaluationLimit}=require('./ai-quality-server.cjs');
 assert.equal(evaluationLimit(),80);assert.equal(evaluationLimit('90'),90);
 for(const value of ['not a number',0,-1,90.5,91,Infinity])assert.throws(()=>evaluationLimit(value),/integer from 1 to 90/);
});
test('selected-line explanations retain local scope and deciding conditions in both reading modes and languages',async()=>{
 const {modelCall,selectedSource}=require('../ai/ai-client');
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const selected=selectedSource(source,{start:3,end:4}),seen=[];
  const answer=locale==='en'?'Add 5 when a voucher is supplied AND amount is at least 100. This condition does not depend on membership.':'提供优惠券且金额至少100时增加5元优惠；这个判断不依赖会员条件。';
  const result=await modelCall({base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;seen.push(body);return {choices:[{message:{content:seen.length===1?'Only members get this rebate.':readingMode==='beginner'?JSON.stringify({corrections:[{id:'p1',value:answer,reason:'Restore independent conditions.'}]}):answer}}]};}},[{role:'system',content:'Explain selectedSource.'},{role:'user',content:JSON.stringify({source,selectedSource:selected})}],{locale,readingMode,explanation:true});
  assert.equal(result,answer);assert.equal(seen.length,2);
  for(const b of seen)assert.deepEqual(JSON.parse(b.messages.find(m=>m.role==='user').content).selectedSource,selected);
 }
});
test('malformed fact notes get one source-preserving protocol repair and never bypass quote or schema validation',async()=>{
 for(const locale of ['en','zh-CN']){
  const seen=[],phases=[],manuscript={title:'Rebate',sections:[{title:'Discount',text:'Independent conditions.'}],questions:[]};
  const result=await generateTalk(source,'rebate.py',{}, {base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   seen.push(body);return {choices:[{finish_reason:'stop',message:{content:seen.length===1?'{"units":[':JSON.stringify(seen.length===2?ledger:seen.length===3?manuscript:{corrections:[]})}}]};
  }},{locale,onModelRequest:(body,phase)=>phases.push(phase)});
  assert.equal(result.sections[0].text,'Independent conditions.');assert.deepEqual(phases,['contracts','contract-repair','composition','review']);
  for(const body of seen)assert.equal(JSON.parse(body.messages.find(m=>m.role==='user').content).source,source);
  assert.equal(seen[1].reasoning_effort,'low');assert.equal(seen[1].max_tokens,16384);
  let calls=0;await assert.rejects(()=>generateTalk(source,'rebate.py',{}, {base:'https://example.org',model:'test',sponsoredCall:async()=>{calls++;return {choices:[{message:{content:'{"units":[]}'}}]};}}),/源码依据不完整/);assert.equal(calls,2);
  calls=0;await assert.rejects(()=>generateTalk(source,'rebate.py',{}, {base:'https://example.org',model:'test',sponsoredCall:async()=>{calls++;throw Error('额度服务暂时不可用。');}}),/额度服务/);assert.equal(calls,1);
 }
});
test('scope hints flag complete broad claims for review without deciding correctness or locally replacing model prose',()=>{
 const {claimHints}=require('../ai/ai-review-patches');
 const draft={title:'All inputs work',sections:[{title:'Limits',text:'Mixed-type inputs always fail.'},{title:'Action',text:'Add five to the subtotal.'}]};
 const before=JSON.stringify(draft),hint=claimHints(draft,{locale:'en'});
 assert.match(hint,/f0/);assert.match(hint,/f2/);assert.match(hint,/advisory, not proof of error/);assert.match(hint,/whole original field/);assert.equal(JSON.stringify(draft),before);
 assert.equal(claimHints({answer:'Add five.'},{locale:'en'}),'');
});
test('complete ledger responses may close only a missing unknowns delimiter, preserving every value and strict evidence checks',()=>{
 const {parse}=require('../ai/ai-talk-contracts');
 const unit={...ledger.units[0],unknowns:['A literal } and ] are not delimiters.','Quoted "text", newline\n and a backslash \\ stay exact.']};
 const value={units:[unit]},good=JSON.stringify(value),array=JSON.stringify(unit.unknowns);
 const malformed=good.replace(array+'}',array.slice(0,-1)+'}'),repairs=[];
 assert.throws(()=>JSON.parse(malformed));
 assert.deepEqual(parse(malformed,source,r=>repairs.push(r)),value);
 assert.deepEqual(repairs,[{stage:'contracts',repair:'missing-unknowns-array-closer'}]);
 assert.deepEqual(parse(good,source,()=>assert.fail('Valid JSON must not be marked repaired')),value);
 assert.throws(()=>parse(malformed.replace('def rebate(amount, member, voucher):','invented source quote'),source),/源码依据/);
 assert.throws(()=>parse(malformed.slice(0,-1),source),/源码依据/);
 assert.throws(()=>parse(good.replace(array,'[1'),source),/源码依据/);
 assert.throws(()=>parse(good.replace(array,array.slice(0,-1)+','),source),/源码依据/);
 const badPaths=good.replace('}],"unknowns"','},"unknowns"');
 assert.throws(()=>parse(badPaths,source),/源码依据/);
});
test('return-origin syntax facts preserve quotes and omit shadowed or unsupported source without inventing runtime types',()=>{
 const {parameterReturns}=require('../ai/ai-source-returns');
 const code='export function update(current, locked) {\r\n  if (locked) return current;\r\n  return 0;\r\n}\r\n';
 assert.deepEqual(parameterReturns(code,'counter.js'),[{function:'update',parameter:'current',declaredType:null,async:false,generator:false,returnQuote:'return current;'}]);
 assert.equal(parameterReturns('function outer(value) { function inner() { return value; } return value; }','test.js').length,1);
 assert.deepEqual(parameterReturns('function shadow(value) { { let value = 1; return value; } }','test.js'),[]);
 assert.deepEqual(parameterReturns('function shadow(value) { let {item: value} = input; return value; }','test.js'),[]);
 assert.deepEqual(parameterReturns('function shadow(value) { with (input) { return value; } }','test.js'),[]);
 assert.deepEqual(parameterReturns('def identity(value):\n    return value\n','test.py'),[]);
 assert.deepEqual(parameterReturns('function broken(value) { return value;','test.js'),[]);
 const typed=parameterReturns('async function typed(value: number) { return value; }','test.ts')[0];
 assert.equal(typed.async,true);assert.equal(typed.declaredType,'number');
 const {returnHints}=require('../ai/ai-review-patches'),draft={title:'Update',sections:[{title:'Contract',text:'This function does not return a Promise.'}]};
 const hints=returnHints(draft,[{role:'user',content:JSON.stringify({filename:'counter.js',source:code})}],{locale:'en'});
 assert.match(hints,/f2/);assert.match(hints,/return current;/);assert.match(hints,/syntax only/);assert.match(hints,/whole field/);
 assert.match(returnHints({answer:'The code starts with the old value.'},[{role:'user',content:JSON.stringify({filename:'counter.js',source:code})}],{locale:'en'}),/"fields":\[\]/);
 assert.equal(returnHints(draft,[{role:'user',content:JSON.stringify({filename:'test.js',source:'function value() { return 1; }'})}],{locale:'en'}),'');
});
test('selected retry statements receive exact enclosing loop guards without confusing neighboring or nested-function execution',async()=>{
 const {enclosingLoops}=require('../ai/ai-source-returns'),{selectedSource,modelCall}=require('../ai/ai-client');
 const sample=require('./ai-quality-cases.cjs').find(c=>c.id==='async-retry-boundary'),selected=selectedSource(sample.source,sample.selection);
 assert.deepEqual(enclosingLoops(sample.source,sample.name,selected),[{kind:'for',initialization:'let i = 0',condition:'i < attempts',update:'i++'}]);
 assert.deepEqual(enclosingLoops(sample.source,sample.name,{...selected,code:'stale selection'}),[]);
 const nested='function outer() {\n  for (let i = 0; i < 2; i++) {\n    function later() {\n      return value;\n    }\n  }\n}\n';
 assert.deepEqual(enclosingLoops(nested,'test.js',selectedSource(nested,{start:4,end:4})),[]);
 assert.deepEqual(enclosingLoops(sample.source,sample.name,selectedSource(sample.source,{start:11,end:11})),[]);
 for(const locale of ['en','zh-CN']){
  const seen=[],answer=locale==='en'?'On failure, catch handles the error; another attempt depends on the next loop condition.':'失败后进入catch；是否再次尝试还取决于下一次循环条件。';
  const result=await modelCall({base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;seen.push(body);return {choices:[{message:{content:seen.length===1?'On failure, it always retries.':answer}}]};}},[{role:'system',content:'Explain selectedSource.'},{role:'user',content:JSON.stringify({filename:sample.name,source:sample.source,selectedSource:selected})}],{locale,readingMode:'standard',explanation:true});
  assert.equal(result,answer);assert.match(seen[1].messages[0].content,/i < attempts/);assert.match(seen[1].messages[0].content,/i\+\+/);assert.equal(seen.length,2);
 }
});
