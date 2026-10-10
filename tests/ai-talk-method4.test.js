const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const composition=require('../ai/ai-talk-composition'),method4=require('../ai/ai-talk-method4');
const {generateTalk}=require('../ai/ai-talk');
const source='function echo(名称) {\r\n  return 名称; // original 中文 😀\r\n}';
const ledger={units:[{name:'echo',anchor:'function echo(名称)',accepts:'A value.',returns:'The supplied value.',timing:'Returns directly.',paths:[{when:'Called',does:'Return the value.',completion:'The same value.',failure:'No explicit handler.',anchor:'return 名称;'}],unknowns:[]}]};
const options={locale:'zh-CN',readingMode:'beginner',audience:'beginner',detail:'standard',coverage:'full'};
const reply=value=>({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
async function run(locale,settings={},fault){
 const phases=[],bodies=[],events=[],draft={title:'Echo',sections:[{title:'Result',text:locale==='en'?'The code gives the supplied value back.\n\nThe name 名称 refers to that value.':'代码把提供的值交回。\n\n名称代表这个值。'}],questions:[]};
 const revised=draft.sections[0].text+(locale==='en'?' It does not print the value.':'它不打印这个值。');
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{
  bodies.push(body);const phase=phases.at(-1);
  if(phase==='contracts')return reply(ledger);
  if(phase==='composition')return reply(fault==='format'?JSON.stringify(draft).replace(',"sections"',' "sections"'):draft);
  if(phase==='composition-format-repair')return reply(draft);
  if(phase==='review'){
   if(fault==='service')throw Error('Test service failure.');
   return reply({corrections:[{field:'f2',anchor:draft.sections[0].text,value:fault==='empty'?'':revised}]});
  }
  throw Error('Unexpected model stage: '+phase);
 }};
 try{
  const result=await generateTalk(source,'echo.js',{audience:'beginner',detail:'standard',coverage:'full',...settings},config,{locale,readingMode:settings.readingMode||'beginner',onModelRequest:(_,p)=>phases.push(p),onProtocolRepair:e=>events.push(e)});
  return {result,phases,bodies,events,revised};
 }catch(error){error.phases=phases;throw error;}
}

test('selected Chinese method 4 remains byte-identical to the approved experimental system prompt',()=>{
 const prompt=method4.instruction(options)+'\n\n'+method4.example('zh-CN');
 assert.equal(createHash('sha256').update(prompt).digest('hex'),'371b23954d93638e373e69049ef04ce622717deb0ecace4893740373d034b277');
});

test('method 4 reaches both languages with the same settings, transport, review and delivery policy',async()=>{
 const before=process.env.WHO_TALK_COMPOSITION;delete process.env.WHO_TALK_COMPOSITION;
 try{
  for(const readingMode of ['beginner','standard'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
   const pair=[];
   for(const locale of ['zh-CN','en']){
    const {result,phases,bodies,revised}=await run(locale,{readingMode,detail,coverage});
    assert.deepEqual(phases,['contracts','composition','review']);
    assert.equal(result.sections[0].text,revised);assert.equal(result.questions.length,0);
    assert.equal(result.usage.totalTokens,90);assert.equal(result.usage.calls.length,3);
    const drafting=bodies[1],input=JSON.parse(drafting.messages[1].content);
    assert.equal(drafting.messages[0].content,method4.instruction({locale,readingMode,audience:'beginner',detail,coverage})+'\n\n'+method4.example(locale));
    assert.deepEqual(input.settings,{task:'talk',locale,readingMode,audience:'beginner',detail,coverage});
    assert.deepEqual(input.sourceContracts,ledger);
    for(const body of bodies){
     assert.equal(JSON.parse(body.messages.find(m=>m.role==='user').content).source,source);
     // Source identifiers remain verbatim even inside reviewer field anchors.
     if(locale==='en')for(const m of body.messages.filter(m=>m.role==='system'))assert.doesNotMatch(m.content.replaceAll('名称','').replaceAll('中文',''),/[\u3400-\u9fff]/);
    }
    assert.match(bodies[2].messages[0].content,/FIMI_REVIEW_EDIT_SCOPE_V2/);
    assert.equal(bodies[2].messages.filter(m=>m.role==='assistant').length,1);
    const {prepare}=await import('../cloudbase/functions/ai-trial/policy.mjs');
    for(const body of bodies)assert.deepEqual(prepare(body).body,body);
    pair.push(bodies.map(({messages,...transport})=>transport));
   }
   assert.deepEqual(pair[0],pair[1]);
   assert.deepEqual(pair[0].map(b=>b.reasoning_effort),['low','high','high']);
   assert.deepEqual(pair[0].map(b=>b.max_tokens),[16384,24576,24576]);
  }
 }finally{if(before===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=before;}
});

test('both languages retain separator-only repair and stop on review failure or missing body',async()=>{
 for(const locale of ['zh-CN','en']){
  const fixed=await run(locale,{},'format');
  assert.deepEqual(fixed.phases,['contracts','composition','composition-format-repair','review']);
  assert.equal(fixed.result.sections[0].text,fixed.revised);
  for(const [fault,code] of [['service',undefined],['empty','AI_TALK_PROTOCOL']]){
   await assert.rejects(()=>run(locale,{},fault),error=>{
    assert.deepEqual(error.phases,['contracts','composition','review']);
    return code?error.code===code:error.message==='Test service failure.';
   });
  }
 }
});

test('method 4 is restricted to introductory talks with explicit E and B rollback and no public override',async()=>{
 const before=process.env.WHO_TALK_COMPOSITION;
 try{
  delete process.env.WHO_TALK_COMPOSITION;
  for(const audience of ['beginner','nontechnical',undefined])assert.equal(composition.version({audience}),'M4');
  assert.equal(composition.version({audience:'peer'}),'M2');
  assert.equal(composition.version({audience:'review'}),'CR2');
  const result=await run('en',{audience:'nontechnical',compositionPrompt:'B',evaluationReview:{editor:'legacy',audit:'on'}});
  assert.deepEqual(result.phases,['contracts','composition','review']);
  assert.equal(result.bodies[1].messages[0].content,method4.instruction({...options,locale:'en'})+'\n\n'+method4.example('en'));
  for(const value of ['E','B']){
   process.env.WHO_TALK_COMPOSITION=value;const rolled=await run('en');
   assert.deepEqual(rolled.phases,['contracts','composition','review']);
   if(value==='E')assert.equal(rolled.bodies[1].messages[0].content,composition.instruction({...options,locale:'en'})+'\n\n'+composition.example('en'));
   else assert.match(rolled.bodies[1].messages[0].content,/^Write the final code walkthrough/);
  }
  process.env.WHO_TALK_COMPOSITION='M4';assert.equal(composition.version({audience:'peer'}),'E');
 }finally{if(before===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=before;}
 const files=require('../desktop/app-files.json');assert.ok(files.includes('ai/ai-talk-method4.js'));
});
