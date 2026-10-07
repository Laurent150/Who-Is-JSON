const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const peer=require('../ai-talk-code-review'),composition=require('../ai-talk-composition');
const {generateTalk}=require('../ai-talk');
const source='function echo(value) {\r\n  return value; // 中文 😀\r\n}';
const ledger={units:[{name:'echo',anchor:'function echo(value)',accepts:'A value.',returns:'The supplied value.',timing:'Returns directly.',paths:[{when:'Called',does:'Return value.',completion:'The same value.',failure:'No explicit handler.',anchor:'return value;'}],unknowns:[]}]};
const draft={title:'Echo',sections:[{title:'Result',text:'echo returns the supplied value.\n\nThe caller receives that same value.'}],questions:[]};
const revised=draft.sections[0].text+' No copy is made.';
const reply=value=>({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30},choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
async function run(locale='en',settings={},fault){
 const phases=[],bodies=[];
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',reviewThinking:true,sponsoredCall:async body=>{
  bodies.push(body);const phase=phases.at(-1);
  if(phase==='contracts')return reply(ledger);
  if(phase==='composition')return reply(fault==='format'?JSON.stringify(draft).replace(',"sections"',' "sections"'):draft);
  if(phase==='composition-format-repair')return reply(draft);
  if(phase==='review'){
   if(fault==='service')throw Error('Review interrupted');
   return reply({corrections:[{field:'f2',anchor:draft.sections[0].text,value:fault==='empty'?'':revised}]});
  }
  throw Error('Unexpected phase: '+phase);
 }};
 try{
  const result=await generateTalk(source,'echo.js',{audience:'review',detail:'standard',coverage:'full',...settings},config,{locale,readingMode:settings.readingMode||'standard',onModelRequest:(_,phase)=>phases.push(phase)});
  return {result,phases,bodies};
 }catch(error){error.phases=phases;throw error;}
}

test('code-review fusion keeps the exact selected Chinese system prompt',()=>{
 assert.equal(createHash('sha256').update(peer.instruction({locale:'zh-CN'})).digest('hex'),'456ed3fe5600c6273e4c1aa067dfdb1e6aa4d54ffc89b71e3a62c7af2b0517d2');
 assert.doesNotMatch(peer.instruction({locale:'en'}),/[\u3400-\u9fff]/);
 assert.ok(require('../desktop/app-files.json').includes('ai-talk-code-review.js'));
});

test('code-review fusion preserves source and every setting through bilingual drafting, existing review and local delivery',async()=>{
 const prior=process.env.WHO_TALK_COMPOSITION;delete process.env.WHO_TALK_COMPOSITION;
 try{
  const {prepare}=await import('../cloudbase/functions/ai-trial/policy.mjs');
  for(const readingMode of ['beginner','standard'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
   const pair=[];
   for(const locale of ['zh-CN','en']){
    const {result,phases,bodies}=await run(locale,{readingMode,detail,coverage});
    assert.deepEqual(phases,['contracts','composition','review']);
    assert.equal(result.sections[0].text,revised);
    assert.equal(result.usage.totalTokens,90);
    const input=JSON.parse(bodies[1].messages[1].content);
    assert.deepEqual(input.settings,{task:'talk',locale,readingMode,audience:'review',detail,coverage});
    assert.deepEqual(input.sourceContracts,ledger);
    assert.equal(bodies[1].messages.length,2);
    assert.equal(bodies[1].messages[0].content,peer.instruction({locale}));
    for(const body of bodies){
     assert.equal(JSON.parse(body.messages.find(m=>m.role==='user').content).source,source);
     assert.deepEqual(prepare({...body,request_profile:'code-review-64k-v1'},{codeReviewEnabled:true}).body,body);
    }
    assert.match(bodies[2].messages[0].content,/FIMI_REVIEW_EDIT_SCOPE_V2/);
    pair.push(bodies.map(({messages,...transport})=>transport));
   }
   assert.deepEqual(pair[0],pair[1]);
   assert.deepEqual(pair[0].map(b=>b.reasoning_effort),['low','high','high']);
   assert.deepEqual(pair[0].map(b=>b.max_tokens),[65536,65536,65536]);
  }
 }finally{if(prior===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=prior;}
});

test('new drafting does not append old instructions or change the existing review request',async()=>{
 const prior=process.env.WHO_TALK_COMPOSITION;
 try{
  for(const locale of ['zh-CN','en']){
   delete process.env.WHO_TALK_COMPOSITION;const current=await run(locale);
   process.env.WHO_TALK_COMPOSITION='E';const old=await run(locale);
   assert.deepEqual(current.bodies[0],old.bodies[0]);
   assert.deepEqual(current.bodies[2],old.bodies[2]);
   assert.deepEqual(JSON.parse(current.bodies[1].messages[1].content),JSON.parse(old.bodies[1].messages[1].content));
   assert.notEqual(current.bodies[1].messages[0].content,old.bodies[1].messages[0].content);
  }
 }finally{if(prior===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=prior;}
});

test('code-review delivery retains bounded format repair and rejects missing review output',async()=>{
 for(const locale of ['zh-CN','en']){
  const fixed=await run(locale,{},'format');
  assert.deepEqual(fixed.phases,['contracts','composition','composition-format-repair','review']);
  assert.equal(fixed.result.sections[0].text,revised);
  for(const fault of ['service','empty'])await assert.rejects(()=>run(locale,{},fault),error=>{
   assert.deepEqual(error.phases,['contracts','composition','review']);
   return fault==='service'?error.message==='Review interrupted':error.code==='AI_TALK_PROTOCOL';
  });
 }
});

test('code-review selection cannot replace other audiences or be overridden by public settings',async()=>{
 const prior=process.env.WHO_TALK_COMPOSITION;
 try{
  delete process.env.WHO_TALK_COMPOSITION;
  assert.equal(composition.version({audience:'review'}),'CR2');
  assert.equal(composition.version({audience:'peer'}),'M2');
  assert.equal(composition.version({audience:'beginner'}),'M4');
  const current=await run('en',{compositionPrompt:'E',evaluationReview:{editor:'legacy',audit:'on'}});
  assert.deepEqual(current.phases,['contracts','composition','review']);
  assert.equal(current.bodies[1].messages[0].content,peer.instruction({locale:'en'}));
  process.env.WHO_TALK_COMPOSITION='CR2';
  assert.equal(composition.version({audience:'peer'}),'M2');
  for(const audience of ['beginner','nontechnical',undefined])assert.equal(composition.version({audience}),'M4');
  for(const value of ['B','E']){process.env.WHO_TALK_COMPOSITION=value;assert.equal(composition.version({audience:'review'}),value);}
 }finally{if(prior===undefined)delete process.env.WHO_TALK_COMPOSITION;else process.env.WHO_TALK_COMPOSITION=prior;}
});
