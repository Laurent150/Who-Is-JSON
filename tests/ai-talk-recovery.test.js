const {test}=require('node:test'),assert=require('node:assert/strict');
const audit=require('../ai/ai-final-audit'),recovery=require('../ai/ai-talk-recovery');
const {modelCall}=require('../ai/ai-client'),{mockFinalAudit}=require('./final-audit-mock.cjs');
const source='def read_count(record, fallback=0):\n    text = record["count"]\n    try:\n        return int(text)\n    except ValueError:\n        return fallback\n';
const messages=[{role:'user',content:JSON.stringify({source,filename:'records.py'})}];
const options={task:'talk',json:true,locale:'zh-CN',readingMode:'beginner',audience:'beginner'};
const wrong='如果它无法变成整数，就交回后备值。';
const fixed='如果文本格式不符合整数要求（ValueError），就交回后备值；输入类型不适合转换（TypeError）时仍会报错。';
const document={title:'读取数量',sections:[{title:'用途',text:'先读取数量。'+wrong+' 这是一段保留的说明 😀。\r\n后文解释具体错误。'},{title:'限制',text:'这里只处理 ValueError，TypeError 会继续报错。'}],questions:[]};
const candidate=JSON.stringify(document);
// Recovery remains available for explicit offline evaluation, not the default
// introductory walkthrough delivery path.
process.env.WHO_TALK_EVAL_TRACE='1';process.env.WHO_CLOUD_DISABLED='1';
const reply=value=>({choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
function rejection(input){return {candidateHash:input.candidateHash,verdict:'reject',checks:input.requiredChecks.map(id=>({id,status:['SOURCE-01','EXPRESSION-01'].includes(id)?'fail':'pass',reason:'Checked'})),findings:['SOURCE-01','EXPRESSION-01'].map(rule=>({rule,field:'f2',quote:wrong,sourceQuote:'except ValueError:',reason:'The opening incorrectly covers every conversion failure.'}))};}
function edits(){return {edits:[{field:'f2',quote:wrong,replacement:fixed,sourceQuote:'except ValueError:',reason:'限定被处理的错误。'}]};}
test('one local repair of a grounded rejection preserves all other bytes and rechecks the complete candidate independently',async()=>{
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
  const calls=[],reports=[];
  const result=await audit.run(async(_,msgs,opts)=>{
   calls.push(opts.usagePhase);const input=JSON.parse(msgs[1].content);
   if(opts.usagePhase==='final-audit')return JSON.stringify(rejection(input));
   if(opts.usagePhase==='final-audit-repair'){
    assert.deepEqual(input.targets,[{field:'f2',quote:wrong}]);assert.equal(input.fields.length,5);
    assert.equal(input.settings.readingMode,readingMode);return JSON.stringify(edits());
   }
   assert.equal(msgs.length,2);assert.equal(input.source,source);assert.deepEqual(input.changedFields,['f2']);
   assert.equal(Object.hasOwn(input,'findings'),false);assert.equal(Object.hasOwn(input,'targets'),false);
   assert.equal(input.candidate,JSON.stringify({...document,sections:[{...document.sections[0],text:document.sections[0].text.replace(wrong,fixed)},document.sections[1]]}));
   return mockFinalAudit({messages:msgs}).choices[0].message.content;
  },{},messages,candidate,candidate,{...options,locale,readingMode,onFinalAudit:r=>reports.push(r)});
  assert.equal(result,JSON.stringify({...document,sections:[{...document.sections[0],text:document.sections[0].text.replace(wrong,fixed)},document.sections[1]]}));
  assert.deepEqual(calls,['final-audit','final-audit-repair','final-audit-recheck']);
  assert.deepEqual(reports.map(r=>r.verdict),['reject','pass']);assert.notEqual(reports[0].candidateHash,reports[1].candidateHash);
 }
});
test('recovery rejects missing, empty, overlapping, moved or expanded edits and fabricated source anchors',()=>{
 const input=audit.build(messages,candidate,candidate,options),report=rejection(input),allowed=recovery.targets(input,report,options);
 for(const mutate of [e=>e.edits=[],e=>e.edits.push({...e.edits[0]}),e=>e.edits[0].replacement=' ',e=>e.edits[0].replacement=wrong,e=>e.edits[0].field='f4',e=>e.edits[0].quote=document.sections[0].text,e=>e.edits[0].sourceQuote='except TypeError:',e=>e.edits[0].replacement='x'.repeat(2001),e=>e.other='Unrequested change']){
  const changed=edits();mutate(changed);assert.throws(()=>recovery.apply(input,allowed,JSON.stringify(changed)),{code:'AI_REVIEW_PROTOCOL'});
 }
});
test('point reading, uncertain evidence and nonlocal failures never trigger walkthrough recovery',async()=>{
 const input=audit.build(messages,candidate,candidate,options),report=rejection(input);
 assert.equal(recovery.targets(input,report,{...options,task:'knowledge'}),null);
 assert.equal(recovery.targets(input,report,{...options,json:false}),null);
 for(const mutate of [r=>r.checks[0].status='uncertain',r=>r.findings[0].sourceQuote='',r=>r.findings[0].quote='x'.repeat(1501)]){
  const changed=structuredClone(report);mutate(changed);assert.equal(recovery.targets(input,changed,options),null);
 }
 const broad=structuredClone(report);broad.findings=Array.from({length:4},(_,i)=>({...report.findings[0],field:'f'+i,quote:'once'}));
 assert.equal(recovery.targets({...input,fields:Array.from({length:4},(_,i)=>({field:'f'+i,text:'once'}))},broad,options),null);
 let calls=0;await assert.rejects(()=>audit.run(async(_,msgs)=>{calls++;return JSON.stringify(rejection(JSON.parse(msgs[1].content)));},{},messages,candidate,candidate,{...options,task:'knowledge'}),{code:'AI_FINAL_AUDIT_REJECTED'});assert.equal(calls,1);
});
test('malformed gate, invalid repair, service failure, cancellation, truncation and a rejected recheck remain bounded and never return a draft',async()=>{
 for(const failure of ['gate','repair','service','cancel','truncation','recheck','recheck-protocol']){
  const phases=[],controller=new AbortController();
  const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{
   const phase=phases.at(-1);
   if(phase==='draft')return reply(document);
   if(phase==='review')return reply({corrections:[]});
   if(phase==='final-audit')return reply(failure==='gate'?'broken':rejection(JSON.parse(body.messages[1].content)));
   if(phase==='final-audit-repair'){
    if(failure==='service')throw Error('upstream failed');
    if(failure==='cancel')controller.abort();
    const result=reply(failure==='repair'?{edits:[]}:edits());if(failure==='truncation')result.choices[0].finish_reason='length';return result;
   }
   if(failure==='recheck-protocol')return reply('broken');
   const input=JSON.parse(body.messages[1].content),rejected=rejection(input);for(const f of rejected.findings)f.quote=fixed;
   return reply(rejected);
  }};
  await assert.rejects(()=>modelCall(config,messages,{...options,explanation:true,evaluationReview:{editor:'legacy',audit:'on'},signal:controller.signal,onModelRequest:(_,phase)=>phases.push(phase)}));
  assert.equal(phases.length,failure==='gate'?3:['recheck','recheck-protocol'].includes(failure)?5:4);
  assert.equal(phases.filter(p=>p==='final-audit-repair').length,failure==='gate'?0:1);
 }
});
test('both languages explicitly exclude manuscript length and useful repetition as rejection reasons',()=>{
 assert.match(audit.instruction(options),/字数、章节数量、段落长短、有助理解的重复本身都不能成为拒绝理由/);
 assert.match(audit.instruction({...options,locale:'en'}),/Word count, section count, paragraph length and useful repetition alone are never grounds for rejection/);
 assert.doesNotMatch(recovery.instruction({...options,locale:'en'}),/[\u3400-\u9fff]/);
});
