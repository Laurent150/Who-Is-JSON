const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse,normalize}=require('../ai-talk-format');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const base={title:'Unicode 名称 😀',sections:[{title:'Original heading',text:'Keep "quotes", \\ paths and 中文.\r\nNext line.'}]};
test('empty extra metadata is removed at each manuscript level without changing any content',()=>{
 for(const extra of [null,'',' \r\n',[],{}]){
  const expected={...base,questions:[{question:'Why?',answer:'Because.'}]},events=[];
  const input={...expected,questions_note:extra,sections:expected.sections.map(s=>({...s,note:extra})),questions:expected.questions.map(q=>({...q,note:extra}))};
  assert.deepEqual(parse(JSON.stringify(input),e=>events.push(e)),expected);
  assert.deepEqual(events,Array(3).fill({stage:'manuscript',repair:'empty-extra-field'}));
 }
});
test('empty metadata recovery cannot erase content, malformed required fields, reserved keys or duplicate fields',()=>{
 for(const extra of [false,0,'Do not drop this.',[null],{note:null}])assert.throws(()=>parse(JSON.stringify({...base,questions_note:extra})),{code:'AI_TALK_PROTOCOL'});
 for(const key of ['__proto__','constructor','prototype'])assert.throws(()=>parse(JSON.stringify({...base,[key]:null})),{code:'AI_TALK_PROTOCOL'});
 for(const text of [JSON.stringify({...base,sections:[{title:'Empty',text:' ',note:null}]}),JSON.stringify(base).slice(0,-1)+',"note":null,"n\\u006fte":null}',JSON.stringify({...base,note:null}).slice(0,-1)])assert.throws(()=>parse(text),{code:'AI_TALK_PROTOCOL'});
});
test('missing optional Q&A normalizes without rewriting text, Unicode, or existing metadata',()=>{
 const original=JSON.stringify(base),events=[];
 const normalized=JSON.parse(normalize(original,event=>events.push(event)));
 assert.deepEqual(normalized,{...base,questions:[]});assert.equal(JSON.stringify(base),original);
 assert.deepEqual(events,[{stage:'manuscript',repair:'missing-optional-questions'}]);
 assert.equal(normalize(JSON.stringify(normalized),()=>assert.fail('No repeated normalization event')),JSON.stringify(normalized));
 const q={...base,questions:[{question:'What?',answer:'Original answer.'}]};assert.deepEqual(parse(JSON.stringify(q)),q);
});
test('optional Q&A never hides an invalid supplied value, missing body, truncated JSON or multiple responses',()=>{
 for(const questions of [null,'',{},[1],['Question'],[{question:'Missing answer'}],[{question:'',answer:'Value'}],Array(7).fill({question:'Q',answer:'A'})])assert.throws(()=>parse(JSON.stringify({...base,questions})),/完整讲解稿/);
 for(const value of [null,[],{}, {title:'Only title'}, {...base,title:''},{...base,sections:[]},{...base,sections:[{title:'No body'}]},{...base,sections:[{title:'Long',text:'x'.repeat(12001)}]}])assert.throws(()=>parse(JSON.stringify(value)),/完整讲解稿/);
 for(const text of [JSON.stringify(base).slice(0,-1),JSON.stringify(base)+JSON.stringify(base),'Here is JSON: '+JSON.stringify(base)])assert.throws(()=>parse(text),/格式不完整/);
});
test('all walkthrough settings can omit optional Q&A without a paid repair and retain their audience-specific review policy',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 try{
  for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const audience of ['beginner','peer','review']){
   const source='function identity(value){return value;}',phases=[],events=[];
   const ledger={units:[{name:'identity',anchor:'function identity(value)',accepts:'Value',returns:'Unchanged value',timing:'Returns directly',paths:[{when:'Called',does:'Returns value',completion:'Value',failure:'None explicit',anchor:'return value;'}],unknowns:[]}]};
   const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
    const phase=phases.at(-1);if(phase==='final-audit'){assert.deepEqual(JSON.parse(JSON.parse(body.messages[1].content).candidate).questions,[]);return mockFinalAudit(body);}
    if(phase==='review'){assert.deepEqual(JSON.parse(body.messages.find(m=>m.role==='assistant').content).questions,[]);return {choices:[{message:{content:'{"corrections":[]}'}}]};}
    return {choices:[{message:{content:JSON.stringify(phase==='contracts'?ledger:base)}}]};
   }};
   const result=await require('../ai-talk').generateTalk(source,'identity.js',{audience},config,{locale,readingMode,onModelRequest:(_,p)=>phases.push(p),onProtocolRepair:e=>events.push(e)});
   assert.deepEqual(phases,['contracts','composition','review']);assert.deepEqual(result.questions,[]);
   assert.equal(result.sections[0].text,base.sections[0].text);assert.equal(events.length,1);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
test('legacy direct drafting normalizes optional Q&A before review, while broken manuscripts fail before further requests',async()=>{
 for(const valid of [true,false]){
  const phases=[];
  const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
   const phase=phases.at(-1);if(phase==='final-audit')return mockFinalAudit(body);
   return {choices:[{message:{content:phase==='draft'?(valid?JSON.stringify(base):'{"title":"unfinished"'): '{"corrections":[]}'}}]};
  }};
  const call=()=>require('../ai-client').modelCall(config,[{role:'system',content:'Explain'},{role:'user',content:JSON.stringify({filename:'case.js',source:'const value=1;'})}],{task:'talk',json:true,explanation:true,onModelRequest:(_,p)=>phases.push(p)});
  if(valid){assert.deepEqual(JSON.parse(await call()).questions,[]);assert.deepEqual(phases,['draft','review']);}
  else {await assert.rejects(call,/格式不完整/);assert.deepEqual(phases,['draft']);}
 }
});
