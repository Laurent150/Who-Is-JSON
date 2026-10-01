const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../public/saved-explanations'),{validateLibrary}=require('../cloud-account');
const {webcrypto}=require('node:crypto'),Reading=require('../public/reading-model');
const source={file:'demo.js',language:'JavaScript',fullSource:'// 中文😀\nconst count = 1;\nreturn count;',sourceStart:1,start:2,end:2,startColumn:6,endColumn:11};
const create=(overrides={})=>S.create({answer:'count is the stored number.',source,...overrides},webcrypto);
test('same explanation at the same position has a stable ID; another occurrence or file stays separate',async()=>{
 const a=await create(),b=await create();assert.equal(a.id,b.id);
 for(const change of [{file:'other.js'},{start:3,end:3,startColumn:7,endColumn:12},{fullSource:source.fullSource+'\n// changed'}])assert.notEqual(a.id,(await create({source:{...source,...change}})).id);
 assert.notEqual(a.id,(await create({answer:'A new explanation.'})).id);
 assert.equal(a.sources[0].code,'count');assert.equal(a.sources[0].fullSource,source.fullSource);
 assert.equal(a.card.kind,'explanation');
});
test('symbols, definitions and multi-line explanations survive the existing cloud payload contract',async()=>{
 const symbol=await create({answer:'This equals sign assigns the value.',source:{...source,startColumn:12,endColumn:13}});
 const multi=await create({source:{...source,start:2,end:3,startColumn:0,endColumn:13}});
 const payload={knowledge:[symbol,multi],cards:[]},roundtrip=JSON.parse(JSON.stringify(validateLibrary(payload)));
 assert.equal(roundtrip.knowledge[0].sources[0].code,'=');
 assert.equal(roundtrip.knowledge[1].sources[0].code,'const count = 1;\nreturn count;');
 assert.equal(roundtrip.knowledge[0].sources[0].fullSource,source.fullSource);
 assert.equal(roundtrip.knowledge[1].card.plain,'count is the stored number.');
});
test('snapshot ranges use UTF-16 columns and preserve selected snippets with an original line offset',()=>{
 assert.equal(S.selection({...source,start:1,end:1,startColumn:3,endColumn:7}).code,'中文😀');
 assert.equal(S.selection({fullSource:'x\ny',sourceStart:20,start:21,end:21}).code,'y');
 assert.throws(()=>S.selection({...source,start:0}));assert.throws(()=>S.selection({...source,startColumn:99}));
});
test('language-only filtering supports old cards and never uses their old knowledge categories',async()=>{
 const item=await create();item.category='工程与设计';
 assert.equal(S.language(item),'JavaScript');assert.ok(S.matches(item,'JavaScript','demo.js'));assert.ok(!S.matches(item,'Python',''));
 assert.ok(S.matches({language:'Python',title:'Old function',code:'x'},'Python','old'));
 assert.equal(S.language({card:{language:'Java'},sources:[]}),'Java');
});
test('built-in references require parser-backed keywords and exclude symbols, custom names and property names',()=>{
 const text='function map(x) {\n  const value = x * 2;\n  return value;\n}\nobj.return(value);';
 const records=[{id:'js.function',start:1,end:4},{id:'js.return',start:3,end:3},{id:'js.binding',start:2,end:2}];
 const args={language:'JavaScript',source:text,start:1,end:5,records,scan:Reading.scan};
 assert.deepEqual(S.builtinIds({...args,start:3,end:3,token:{line:3,startColumn:2,endColumn:8}}),['js.return']);
 for(const token of [{line:1,startColumn:9,endColumn:12},{line:2,startColumn:18,endColumn:19},{line:5,startColumn:4,endColumn:10}])assert.deepEqual(S.builtinIds({...args,token}),[]);
 assert.deepEqual(S.builtinIds({...args,records:[]}),[]);
 assert.deepEqual(S.builtinIds({...args,source:'const obj = {return: 1}; return obj;',start:1,end:1,records:[{id:'js.return',start:1,end:1}],token:{line:1,startColumn:13,endColumn:19}}),[]);
 assert.deepEqual(S.builtinIds({...args,source:'const text = "return";',records:[{id:'js.return',start:1,end:1}],token:{line:1,startColumn:14,endColumn:20}}),[]);
});
