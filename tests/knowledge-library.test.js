const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../ai-knowledge'),K=require('../public/knowledge'),L=require('../public/knowledge-library');
const lesson={kind:'lesson',answer:'await 等待一个异步结果。',title:'等待异步结果',language:'JavaScript',category:'异步与错误处理',tags:['Promise'],plain:'用 await 取得 Promise 完成后的值。',naming:'await 是关键词。',example:'const value = await Promise.resolve(3);',result:'假设推演：value 为 3。',pitfall:'拒绝时需要处理异常。'};
test('only complete reusable lessons can be saved, definitions and incomplete replies cannot',()=>{
 assert.ok(parse(JSON.stringify(lesson)).knowledge);
 for(const change of [{kind:'definition'},{kind:'unknown'},{example:''},{category:'自定义'},{plain:null}])assert.equal(parse(JSON.stringify({...lesson,...change})).knowledge,undefined);
 assert.throws(()=>parse('not json'));assert.throws(()=>parse('{"answer":null}'));
 const a=parse(JSON.stringify(lesson)).knowledge,b=parse(JSON.stringify({...lesson,tags:['等待']})).knowledge;assert.equal(a.id,b.id);assert.notEqual(a.id,parse(JSON.stringify({...lesson,example:'await task();'})).knowledge.id);
});
test('old favorites get categories without mutation; search includes tags and associated sources',()=>{
 const source={file:'demo.js',start:1,end:1,code:'const [a,b]=pair;',context:'拆开两个值'};
 const item=K.merge([],K.cards['js.destructure'],source)[0],before=JSON.stringify(item);
 assert.equal(L.category(item.card),'语法与基础');assert.equal(JSON.stringify(item),before);
 assert.ok(L.matches(item,'语法与基础','demo.js'));assert.ok(!L.matches(item,'异步与错误处理',''));
 const card=parse(JSON.stringify(lesson)).knowledge;assert.ok(L.matches({card,sources:[source]},'异步与错误处理','promise'));
 assert.ok(L.matches({...item,category:'工程与设计'},'工程与设计',''));
 item.category='工程与设计';const merged=K.merge([item],item.card,{...source,file:'other.js'});assert.equal(merged[0].category,'工程与设计');assert.equal(merged[0].sources.length,2);
});
