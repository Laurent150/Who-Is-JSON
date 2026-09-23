const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseRepair,repair}=require('../ai-repair');
test('repair preserves suggested source and explicit uncertainty without executing it',()=>{
 const code='throw new Error("this is data");';
 const result=parseRepair(JSON.stringify({code,changes:['调整缩进'],uncertainty:'分支归属需要核对'}));
 assert.equal(result.code,code);assert.equal(result.origin,'ai');assert.match(result.notice,/核对/);
});
test('repair rejects incomplete, empty and excessive model output',()=>{
 for(const value of ['broken',JSON.stringify({code:'x',changes:[]}),JSON.stringify({code:' ',changes:[],uncertainty:''}),JSON.stringify({code:'x'.repeat(100001),changes:[],uncertainty:''}),JSON.stringify({code:'x',changes:[{}],uncertainty:''})])assert.throws(()=>parseRepair(value));
});
test('repair rejects invalid source before making a model call',async()=>{
 for(const code of [null,'',' '.repeat(10),'字'.repeat(34000)])await assert.rejects(repair(code,'x.py',{}),/100 KB/);
});
