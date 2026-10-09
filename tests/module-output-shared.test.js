const {test}=require('node:test'),assert=require('node:assert/strict');
const {decodeModuleResponse}=require('../cloudbase/functions/ai-trial/module-output.cjs');
const local=require('../ai-module-reading').decode;
const scaffold=[{id:'n1',start:2,end:4,kind:'condition',branches:[{label:'yes',nodes:[{id:'n2',start:3,end:3,kind:'return',branches:[],calls:[]}]}],calls:[]}];
const body={summary:'  Read a value.\n\nKeep every paragraph. ',input:'value',output:'return value',nodes:[{id:'n1',title:'Check the value'},{id:'n2',title:'Return it'}]};
test('shared module decoder preserves the current exact strings, nested topology and optional-title behavior',()=>{
 const before=JSON.stringify(scaffold);
 for(const data of [body,{...body,title:'Read a value'},{...body,title:'bad\nheading'},{...body,title:3},{...body,title:'x'.repeat(81)}]){
  const raw=JSON.stringify(data),actual=decodeModuleResponse(raw,scaffold);assert.deepEqual(actual,local(raw,scaffold));assert.equal(actual.summary,body.summary);assert.equal(actual.nodes[0].branches[0].nodes[0].start,3);assert.equal(JSON.stringify(scaffold),before);
 }
});
test('shared module decoder rejects the same malformed provider outputs before any delivery',()=>{
 for(const data of [null,{...body,summary:''},{...body,extra:'untrusted'},{...body,nodes:[]},{...body,nodes:[body.nodes[0],body.nodes[0]]},{...body,nodes:[body.nodes[0],{id:'invented',title:'wrong'}]},{...body,nodes:[body.nodes[0],{...body.nodes[1],title:'x'.repeat(161)}]}]){
  const raw=JSON.stringify(data);assert.throws(()=>local(raw,scaffold));assert.throws(()=>decodeModuleResponse(raw,scaffold));
 }
 for(const raw of ['{broken','```json\n'+JSON.stringify(body)+'\n```']){assert.throws(()=>local(raw,scaffold));assert.throws(()=>decodeModuleResponse(raw,scaffold));}
});
