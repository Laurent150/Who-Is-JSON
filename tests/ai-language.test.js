const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../analyzer');
const {identify,parseLanguage,needsLanguageHelp,analyzeAs}=require('../ai-language');
const code='class Box { read(value) { return value; } }';
const guess=(language,confidence='high')=>async()=>JSON.stringify({language,confidence});
test('AI language hint is verified locally without editing source and reused by flow parsing',async()=>{
 const original=analyze(code,'');assert.ok(needsLanguageHelp(original));
 let sent;const result=await identify(code,'',undefined,original,{}, {},async(config,messages)=>{sent=JSON.parse(messages[1].content);return JSON.stringify({language:'JavaScript',confidence:'high'});});
 assert.equal(sent.source,code);assert.equal(result.language,'JavaScript');assert.equal(result.languageIdentification.status,'verified');
 assert.ok(result.blocks.some(b=>b.title==='read'));assert.equal(result.analysisMeta.inputSha256,original.analysisMeta.inputSha256);
 assert.deepEqual(analyzeAs(code,'',undefined,result.languageIdentification.language).blocks,result.blocks);
});
test('working local parse does not call AI; uncertain or unsupported hints preserve original structures',async()=>{
 const good=analyze('function read(x){return x}','input.js');
 assert.equal(await identify(code,'',undefined,good,{}, {},async()=>{throw Error('should not call')}),good);
 const original=analyze(code,'');
 for(const [language,confidence,status]of [['JavaScript','low','uncertain'],['C++','high','unsupported'],['Java','high','unverified']]){
  const r=await identify(code,'',undefined,original,{}, {},guess(language,confidence));
  assert.equal(r.languageIdentification.status,status);assert.equal(r.blocks,original.blocks);
 }
});
test('AI failures preserve local results; cancellation is propagated',async()=>{
 const original=analyze(code,'');
 const result=await identify(code,'',undefined,original,{}, {},async()=>{throw Error('network unavailable')});
 assert.equal(result.languageIdentification.status,'failed');assert.equal(result.blocks,original.blocks);
 const controller=new AbortController();controller.abort();
 await assert.rejects(identify(code,'',undefined,original,{}, {signal:controller.signal},async()=>{throw Error('cancelled')}),/cancelled/);
});
test('language output and hint are bounded to known names',()=>{
 for(const text of ['invalid','{"language":"../file","confidence":"high"}','{"language":"JavaScript","confidence":1}'])assert.throws(()=>parseLanguage(text));
 assert.throws(()=>analyzeAs(code,'',undefined,'constructor'));
});
