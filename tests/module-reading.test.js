const {test}=require('node:test'),assert=require('node:assert/strict');
const moduleReading=require('../ai-module-reading'),contract=require('../ai-point-contract'),{analyze}=require('../analyzer');
const source='function summarize(values) {\n  const kept = values.filter(value => value > 0);\n  const total = kept.reduce((sum, value) => sum + value, 0);\n  return { count: kept.length, total };\n}\nconst example = summarize([2, 0, 5]);';
const result=analyze(source,'scores.js'),start=result.blocks.find(b=>b.title==='summarize').start;
const config={base:'https://api.deepseek.com/v1',model:'deepseek-flash'},answer={summary:'Keep positive values.\n\nCollect their count and total.',input:'values holds the numbers.',output:'An object with count and total.'};
async function capture(action,content=null,finish='stop'){
 const previous=globalThis.fetch,bodies=[];globalThis.fetch=async(url,req)=>{const body=JSON.parse(req.body);bodies.push(body);const nodes=[];const walk=ns=>ns.forEach(n=>{nodes.push({id:n.id,title:"Action "+n.id});n.branches.forEach(b=>walk(b.nodes));});walk(JSON.parse(body.messages[1].content).scaffold);const output=content===null?JSON.stringify({...answer,nodes}):content;return Response.json({model:'deepseek-flash',usage:{prompt_tokens:1,completion_tokens:2,total_tokens:3},choices:[{finish_reason:finish,message:{content:output}}]});};
 try{return {value:await action(),bodies};}finally{globalThis.fetch=previous;}
}
test('module reading uses one isolated low request and unchanged passage foundation for both audiences/locales',async()=>{
 for(const readingMode of ['beginner','standard'])for(const locale of ['en','zh-CN']){
  const {value,bodies}=await capture(()=>moduleReading.explainModule(result,source,start,config,{name:'scores.js',end:5,readingMode,locale}));assert.equal(bodies.length,1);
  const body=bodies[0],input=JSON.parse(body.messages[1].content);assert.equal(input.source,source);assert.equal(input.selectedSource.code,source.split('\n').slice(0,5).join('\n'));assert.deepEqual(input.selectedSource,{start:1,end:5,code:source.split('\n').slice(0,5).join('\n')});
  const foundation=contract.profile(locale,readingMode,'passage',undefined,true,input);assert.equal(body.messages[0].content.slice(0,foundation.length),foundation);assert.doesNotMatch(body.messages[0].content,/FIMI_REVIEW_CONTEXT|FUNCTION CONTRACTS|ASYNC INPUT\/OUTPUT/);
  assert.equal(body.model,config.model);assert.deepEqual(body.thinking,{type:'enabled'});assert.equal(body.reasoning_effort,'low');assert.equal(body.max_tokens,6000);assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(value.summary,answer.summary);assert.equal(value.input,answer.input);assert.equal(value.output,answer.output);assert.equal(value.start,1);assert.equal(value.end,5);
 }
});
test('module range and parser-confirmed callee evidence are local and validated before dispatch',async()=>{
 const src='function twice(value) {\n  return value * 2;\n}\nfunction first(values) {\n  return twice(values[0]);\n}',parsed=analyze(src,'calls.js');
 const input=moduleReading.moduleInput(parsed,src,4,6,'calls.js');assert.equal(input.source,src);assert.deepEqual(input.knownCallees.map(c=>c.name),['twice']);assert.equal(input.knownCallees[0].source,src.split('\n').slice(0,3).join('\n'));
 let count=0;for(const options of [{end:4},{end:7}])await assert.rejects(()=>moduleReading.explainModule(result,source,start,config,{...options,onModelRequest:()=>count++}),/模块范围|找不到/);
 await assert.rejects(()=>moduleReading.explainModule(result,source,99,config,{onModelRequest:()=>count++}),/找不到/);assert.equal(count,0);
});
test('strict module JSON preserves strings and rejects unknown shape without repair or retry',async()=>{
 for(const data of [[],{...answer,extra:true},{...answer,summary:''},{...answer,input:[]},{summary:'Only summary'},{...answer,type:'json_object'}]){let count=0;await assert.rejects(()=>capture(()=>moduleReading.explainModule(result,source,start,config,{onModelRequest:()=>count++}),JSON.stringify(data)),/模块解释格式/);assert.equal(count,1);}
 await assert.rejects(()=>capture(()=>moduleReading.explainModule(result,source,start,config),'{invalid'),/模块解释格式/);
 const raw={nodes:[{id:'n1',title:'Keep'},{id:'n2',title:'Total'},{id:'n3',title:'Return'}],summary:'  Full `value`\n\nSecond paragraph.  ',input:' "Ada" ',output:' Nothing truncated. '};const {value}=await capture(()=>moduleReading.explainModule(result,source,start,config),JSON.stringify(raw));for(const k of ['summary','input','output'])assert.equal(value[k],raw[k]);
 await assert.rejects(()=>capture(()=>moduleReading.explainModule(result,source,start,config),JSON.stringify(answer),'length'));
});
test('module cancellation and provider parameter isolation remain one dispatch',async()=>{
 const aborted=new AbortController();aborted.abort();let count=0;await assert.rejects(()=>moduleReading.explainModule(result,source,start,config,{signal:aborted.signal,onModelRequest:()=>count++}));assert.equal(count,0);
 const during=new AbortController();await assert.rejects(()=>capture(()=>moduleReading.explainModule(result,source,start,config,{signal:during.signal,onModelText:()=>during.abort()})));
 const {bodies}=await capture(()=>moduleReading.explainModule(result,source,start,{base:'https://example.org/v1',model:'chosen'},{readingMode:'standard'}));assert.equal(bodies.length,1);assert.equal(bodies[0].model,'chosen');assert.equal(bodies[0].max_tokens,6000);assert.ok(!Object.hasOwn(bodies[0],'thinking'));assert.ok(!Object.hasOwn(bodies[0],'reasoning_effort'));
});

test('optional decorative module title cannot corrupt canonical summary IO or topology',()=>{
 const graph=[{id:'n1',kind:'return',start:2,end:2,branches:[]}],raw={summary:'  Same summary.\n\nComplete. ',input:' Original input ',output:' Original output ',nodes:[{id:'n1',title:'Return result'}]};
 for(const title of [undefined,'Visible action',null,{},'', 'x'.repeat(81),'two\nlines',String.fromCharCode(96)+'format'+String.fromCharCode(96)]){const data=title===undefined?raw:{...raw,title};const value=moduleReading.decode(JSON.stringify(data),graph);for(const k of ['summary','input','output'])assert.equal(value[k],raw[k]);assert.equal(value.nodes[0].start,2);assert.equal(value.nodes[0].id,'n1');assert.equal(value.title,title==='Visible action'?title:undefined);}
 assert.throws(()=>moduleReading.decode(JSON.stringify({...raw,title:'Title',extra:'Unknown'}),graph),/格式/);assert.throws(()=>moduleReading.decode(JSON.stringify({...raw,title:'Title',nodes:[]}),graph),/格式/);
});
