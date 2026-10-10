// These cases retain coverage of the B rollback prompt; E is covered by ai-integration.test.js.
process.env.WHO_TALK_COMPOSITION="B";
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {applies,instruction}=require('../ai/ai-talk-async');
test('return guidance is syntax-scoped and does not infer async behavior from comments, strings, or another language',()=>{
 for(const source of ['function f(){return 1}','export async function f(){return 1}','const f = (x: number) => x + 1;','function wrapper(fn){return {result:fn()};}'])assert.equal(applies(source),true);
 for(const source of ['// async function f() { await x(); }','const text="async function f(){return 1}";','def f():\n    return 1','async function* f(){yield 1;}','function* f(){yield 1;}','interface Worker { work(): Promise<number>; }','async function f( {','{"async":"Promise"}'])assert.equal(applies(source),false);
 assert.doesNotMatch(instruction('en'),/[\u4e00-\u9fff]/);
});
test('opt-in async guidance leaves the analysis call, source bytes, other audiences and output protocol unchanged',async()=>{
 const previous=process.env.WHO_TALK_PIPELINE;process.env.WHO_TALK_PIPELINE='contracts';
 const source='export async function job() {\r\n  return 9;\r\n}';
 const ledger={purpose:'Return a number',units:[{name:'job',anchor:'export async function job()',accepts:'No parameters',returns:'Promise fulfilled with 9',timing:'Body returns without an await',paths:[{when:'called',does:'Returns 9 inside async',completion:'Promise fulfills with 9',failure:'No explicit failure path',anchor:'return 9;'}],unknowns:[]}]};
 try{
  for(const locale of ['en','zh-CN'])for(const audience of ['beginner','peer','review']){
   const variants=[];
   for(const asyncFocusRules of [false,true]){
    const calls=[],config={base:'https://example.org',model:'test',sponsoredCall:async payload=>{const audit=mockFinalAudit(payload);if(audit)return audit;
     calls.push(payload);return {choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls.length===1?ledger:{title:'Result',sections:[{title:'Value',text:'Unmodified model text.'}],questions:[]})}}]};
    }};
    const result=await require('../ai/ai-talk').generateTalk(source,'job.ts',{audience,detail:'brief'},config,{locale,readingMode:'beginner',introComposition:'purpose-first',asyncFocusRules});
    assert.equal(calls.length,3);assert.equal(result.sections[0].text,'Unmodified model text.');
    for(const c of calls)assert.equal(JSON.parse(c.messages.find(m=>m.role==='user').content).source,source);
    variants.push(calls);
   }
   assert.deepEqual(variants[0][0],variants[1][0]);
   const before=variants[0][1].messages,after=variants[1][1].messages;
   if(audience==='beginner'){
    assert.deepEqual(before.slice(0,-1),after.slice(0,-1));
    assert.equal(after.at(-1).content,before.at(-1).content+'\n'+instruction(locale));
   }else assert.deepEqual(before,after);
  }
 }finally{if(previous===undefined)delete process.env.WHO_TALK_PIPELINE;else process.env.WHO_TALK_PIPELINE=previous;}
});
