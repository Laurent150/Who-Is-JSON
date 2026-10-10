const {mockFinalAudit}=require('./final-audit-mock.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {analyze}=require('../analyzer'),flow=require('../ai/ai-flow'),patches=require('../ai/ai-review-patches');
const publicFlow=require('../public/flow-model');

test('JavaScript call navigation resolves direct definitions, never shadowed or replaced targets',()=>{
 const source='function discount(amount) { return amount * 0.9; }\nfunction order(amount) {\n  return discount(amount);\n}';
 const parsed=analyze(source,'order.js');assert.deepEqual(parsed.framework.links,[{name:'discount',fromStart:2,toStart:1,line:3}]);
 assert.equal(flow.scaffold(parsed,2).nodes[0].calls[0].start,1);
 for(const code of [
  source.replace('order(amount)','order(amount, discount)'),
  source+'\ndiscount = external;',
  source+'\n({discount} = external);',
  source+'\nglobalThis.discount = external;',
  source.replace('return discount(amount);','return eval("discount(amount)");'),
  'import { discount } from "external";\nfunction order(n) { return discount(n); }',
  'function order(n) { return external.discount(n); }',
 ])assert.deepEqual(analyze(code,'order.js').framework.links,[]);
});

test('shared local/AI flow and IO annotations preserve source, Unicode positions and branches',()=>{
 const code='function total(商品) {\r\n  const 标记 = "😀";\r\n  if (商品.length) {\r\n    return 商品[0].price;\r\n  }\r\n  return 0;\r\n}';
 const parsed=analyze(code,'total.js',process.env.CODELINGO_PYTHON||'python'),before=JSON.stringify(parsed);
 const graph=publicFlow.scaffold(parsed,1,'en');assert.deepEqual(graph,flow.scaffold(parsed,1,'en'));
 const notes=[];const collect=ns=>ns.forEach(n=>{notes.push({id:n.id,title:'Read the value',explanation:'Read the selected value.',start:999,calls:[{start:999}]});n.branches.forEach(b=>collect(b.nodes));});collect(graph.nodes);
 const enhanced=flow.attach(graph,JSON.stringify({summary:'Read the first price.',input:'A list of items.',output:'The first price or zero.',source:'replacement',start:999,nodes:notes}),'en');
 assert.equal(enhanced.input,'A list of items.');assert.equal(enhanced.output,'The first price or zero.');assert.equal(enhanced.start,1);assert.equal(enhanced.source,undefined);
 const locations=ns=>ns.map(({id,start,end,calls,branches})=>({id,start,end,calls,branches:branches.map(b=>({label:b.label,nodes:locations(b.nodes)}))}));
 assert.deepEqual(locations(enhanced.nodes),locations(graph.nodes));assert.equal(JSON.stringify(parsed),before);assert.equal(parsed.blocks[0].code,code);
 const incomplete=flow.attach(graph,JSON.stringify({summary:'Only partial.',input:{text:'do not stringify'},nodes:[]}), 'en');assert.equal(incomplete.input,'');assert.equal(incomplete.output,'');
});

test('AI IO is generated and reviewed in both interface languages and explanation modes',async()=>{
 const source='function twice(value) { return value * 2; }',parsed=analyze(source,'twice.js'),calls=[];
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard']){
  const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   calls.push(body);const input=JSON.parse(body.messages[1].content);assert.equal(input.source,source);assert.equal(input.selectedFunction.source,source);
   if(body.messages.some(m=>m.role==='assistant'))return {choices:[{message:{content:JSON.stringify({corrections:[{path:['output'],value:'Reviewed output.'}]})}}]};
   return {choices:[{message:{content:JSON.stringify({summary:'Double.',input:'A number.',output:'Draft output.',nodes:[{id:'n1',title:'Double the number',explanation:'Multiply by two.'}]})}}]};
  }};
  const result=await flow.explainFlow(parsed,source,1,config,{locale,readingMode});assert.equal(result.output,'Reviewed output.');
  const prompt=calls.at(-2).messages[0].content;assert.match(prompt,/"input"\s*:/);assert.match(prompt,/"output"\s*:/);
  assert.match(prompt,locale==='en'?readingMode==='beginner'?/BEGINNER MODE/:/STANDARD MODE/:readingMode==='beginner'?/当前为零基础友好模式/:/当前为标准模式/);
 }
 assert.match(patches.allowedPaths({input:'x',output:'y',start:1}),/\["input"\]/);assert.doesNotMatch(patches.allowedPaths({start:1}),/\["start"\]/);
});

test('flow prompts carry exact confirmed callees but exclude shadowed names',async()=>{
 const source='function twice(n) { return n * 2; }\nfunction order(n) { return twice(n); }';
 for(const shadowed of [false,true]){
  const code=shadowed?source.replace('order(n)','order(n, twice)'):source;
  const parsed=analyze(code,'order.js');
  const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   const payload=JSON.parse(body.messages[1].content);
   assert.deepEqual(payload.knownCallees,shadowed?[]:[{name:'twice',start:1,end:1,source:source.split('\n')[0]}]);
   if(body.messages.some(m=>m.role==='assistant')){
    assert.doesNotMatch(body.messages[0].content,/questions must be/);
    return {choices:[{message:{content:'{"corrections":[]}'}}]};
   }
   assert.match(body.messages[0].content,/knownCallees/);
   return {choices:[{message:{content:'{"summary":"Order","input":"n","output":"Value","nodes":[]}'}}]};
  }};
  await flow.explainFlow(parsed,code,2,config,{locale:'en',readingMode:'standard'});
 }
});

class Node {
 constructor(tag='div',text='',cls=''){this.tagName=tag.toUpperCase();this.text=text;this.className=cls;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.classList={add:c=>{this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');},toggle:(c,on)=>{this.classList.remove(c);if(on)this.classList.add(c);},contains:c=>this.className.split(' ').includes(c)};}
 get textContent(){return this.text+this.children.map(c=>c.textContent).join('');} set textContent(v){this.text=String(v);this.children=[];}
 append(...items){for(const n of items){n.parent=this;this.children.push(n);}} insertBefore(node,ref){node.parent=this;const i=this.children.indexOf(ref);this.children.splice(i<0?this.children.length:i,0,node);} replaceChildren(...items){this.text='';this.children=[];this.append(...items);}
 setAttribute(k,v){this.attributes[k]=String(v);} addEventListener(name,handler){(this.events??={})[name]=handler;} click(){return this.onclick?.();} focus(){} contains(node){return this.children.some(child=>child===node||child.contains(node));} scrollTo(){} scrollIntoView(){} getBoundingClientRect(){return {top:0,bottom:10,left:0};}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(selector==='button'?n.tagName==='BUTTON':selector.startsWith('.')?n.classList.contains(selector.slice(1)):false)?[n]:[],...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function workspace(api){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const ctx=vm.createContext({api,AbortController,AbortSignal,Error,Map,Set,setInterval,clearInterval,innerWidth:1200,innerHeight:800,
  readingMode:'beginner',config:{},current:{language:'JavaScript',blocks:[]},analyzedSource:'const 商品 = "😀";\nreturn 商品;',fileName:'test.js',sourceOffset:7,
  WhoReading:require('../public/reading-model'),WhoFlowModel:publicFlow,beginnerMode:()=>true,selectionQuestion:()=> '请解释选中的代码段，让一个没有编程背景的成年人能看懂。',connected:()=>true,
  element:(tag,text='',cls='')=>new Node(tag,text,cls),document:{addEventListener(){},createTextNode:text=>new Node('text',text)},window:{addEventListener(){}},$:get,
  appendAITerms(){},appendExplanationSave(){},appendBuiltinReference(){},explanationSource:s=>s,toast(){},settings(){},
 });
 vm.runInContext(fs.readFileSync(require.resolve('../public/studio.js'),'utf8'),ctx);
 vm.runInContext('studioIdentity()',ctx);
 return {ctx,get,run:s=>vm.runInContext(s,ctx)};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('generated workspace titles follow the UI language without translating source-defined names',()=>{
 const app=workspace(async()=>{});
 app.ctx.current.language='Python';
 app.ctx.uiText=text=>({'这段代码':'This section','文件中的说明':'File notes','忽略与例外规则':'Ignore rules and exceptions'}[text]||text);
 const before=app.ctx.analyzedSource;
 app.run("studioShowFunction({role:'script-entry',kind:'module',title:'文件开始时的准备',start:1,end:2},null)");
 assert.equal(app.get('studioExplain').children[0].textContent,'This section');
 app.run("studioShowFunction({role:'script-entry',kind:'module',title:'文件开始时的准备',start:1,end:2},{summary:'Source summary',input:'None',output:'Text'})");
 assert.equal(app.get('studioExplain').children[0].textContent,'This section');
 assert.equal(app.run("studioBlockTitle({kind:'module',title:'文件中的说明'})"),'File notes');
 assert.equal(app.run("studioBlockTitle({kind:'function',title:'文件中的说明'})"),'文件中的说明');
 app.ctx.current.language='Gitignore';
 assert.equal(app.run("studioBlockTitle({kind:'config',title:'忽略与例外规则'})"),'Ignore rules and exceptions');
 app.ctx.uiText=text=>text;
 assert.equal(app.run("studioBlockTitle({role:'script-entry',title:'文件开始时的准备'})"),'这段代码');
 assert.equal(app.ctx.analyzedSource,before);
});

test('line and token clicks remain separate; Shift extends lines and original source is unchanged',async()=>{
 const seen=[],app=workspace(async(route,data)=>{seen.push(data);return {answer:'Explanation'};});
 app.run('renderStudioCode()');const rows=app.get('studioCode').children;
 assert.equal(rows.map(r=>r.children[1].textContent).join('\n'),app.ctx.analyzedSource);
 rows[1].onclick({shiftKey:false});await new Promise(setImmediate);
 assert.equal(seen.length,1);assert.equal(seen[0].selection.start,2);assert.match(app.get('studioRange').textContent,/整行.*9/);
 const token=rows[0].children[1].children.find(n=>n.textContent==='商品');let stopped=false;
 token.onclick({stopPropagation(){stopped=true;},shiftKey:false});await new Promise(setImmediate);
 assert.ok(stopped);assert.equal(seen.length,2);assert.equal(seen[1].token.text,'商品');assert.equal(seen[1].token.startColumn,6);assert.equal(seen[1].token.endColumn,8);assert.equal(app.get('studioTokenPopup').hidden,false);assert.ok(token.classList.contains('selected-token'));
 rows[1].onclick({shiftKey:true});await new Promise(setImmediate);
 assert.equal(app.get('studioTokenPopup').hidden,false);assert.equal(token.classList.contains('selected-token'),false);
 assert.equal(app.get('studioTokenText').textContent,'Explanation');
 assert.deepEqual({...seen.at(-1).selection},{start:1,end:2});assert.match(app.get('studioRange').textContent,/选中代码段/);
 assert.equal(app.ctx.analyzedSource,'const 商品 = "😀";\nreturn 商品;');
});

test('late line replies cannot overwrite a newer step, and late token replies stay closed',async()=>{
 const line=deferred(),token=deferred();const app=workspace((route,data)=>data.token?token.promise:line.promise);
 app.run('studioSelect(1,1,true)');app.run("studioSelect(2,2,false,'step','n2')");
 app.get('studioExplain').textContent='Current step';line.resolve({answer:'Old line'});await new Promise(setImmediate);
 assert.equal(app.get('studioExplain').textContent,'Current step');
 app.ctx.anchor=new Node('button');app.run("openStudioToken(anchor,{line:1,startColumn:6,endColumn:8,text:'商品'})");
 app.run("studioSelect(2,2,false,'function')");assert.equal(app.get('studioTokenPopup').hidden,false);app.run('closeStudioToken()');token.resolve({answer:'Old token'});await new Promise(setImmediate);
 assert.equal(app.get('studioTokenPopup').hidden,true);assert.doesNotMatch(app.get('studioTokenText').textContent,/Old token/);
});

test('concurrent flow requests share one call and reset prevents stale cache reuse',async()=>{
 let calls=0;const pending=deferred(),app=workspace(()=>{calls++;return pending.promise;});
 const a=app.run('studioGetFlow({start:1})'),b=app.run('studioGetFlow({start:1})');assert.equal(calls,1);
 app.run('studioReset()');pending.resolve({summary:'Old mode',nodes:[]});await Promise.all([assert.rejects(a,/已停止生成/),assert.rejects(b,/已停止生成/)]);
 assert.equal(app.run('studioCache.size'),0);assert.equal(app.run('studioPendingFlows.size'),0);
});

test('a follow-up belongs to its selection and cannot replace the next selected answer',async()=>{
 const pending=deferred(),app=workspace(()=>pending.promise);app.run('studioSelect(1,1,false)');
 const request=app.run("studioFollowup('Explain more',{start:1,end:1})");
 app.run('studioSelect(2,2,false)');app.get('studioExplain').textContent='New selection';pending.resolve({answer:'Late follow-up'});await request;
 assert.equal(app.get('studioExplain').textContent,'New selection');
});


test('expansion uses the single module route and never generates legacy detailed flow',async()=>{
 const seen=[],pending=deferred(),app=workspace((route,body)=>{seen.push({route,body});return pending.promise;});app.ctx.WhoFlowModel={scaffold:()=>({nodes:[]})};app.ctx.current.blocks=[{title:'total',start:1,end:2,kind:'function'}];const card=app.run('studioFunction(current.blocks[0])');card.querySelector('.studio-map-expand').click();assert.equal(seen.length,1);assert.equal(seen[0].route,'module-reading');assert.equal(app.get('studioFlow').querySelector('.studio-detailed-flow'),null);pending.resolve({summary:'Total',input:'Values',output:'Number',nodes:[]});await new Promise(setImmediate);app.run('studioMapBack()');card.querySelector('.studio-map-expand').click();assert.equal(seen.length,1);
});
test('offline map does not request; errors expose a manual retry without eager repetition',async()=>{
 let calls=0;const app=workspace(async()=>{calls++;throw Error('Temporary failure');});app.ctx.WhoFlowModel={scaffold:()=>({nodes:[]})};app.ctx.current.blocks=[{title:'total',start:1,end:2,kind:'function'}];app.ctx.connected=()=>false;const card=app.run('studioFunction(current.blocks[0])');card.querySelector('.studio-map-expand').click();assert.equal(calls,0);app.ctx.connected=()=>true;app.get('studioFlow').querySelector('.studio-map-retry').click();await new Promise(setImmediate);assert.equal(calls,1);assert.match(app.get('studioFlow').textContent,/Temporary failure/);assert.ok(app.get('studioFlow').querySelector('.studio-map-retry'));app.get('studioFlow').querySelector('.studio-map-retry').click();await new Promise(setImmediate);assert.equal(calls,2);
});

test('unknown language heading is translated without changing analysis facts',()=>{
 const app=workspace(async()=>{throw Error('No AI request expected');});
 app.ctx.current.language='未确定';app.ctx.WhoStructure={modules:()=>[]};
 app.ctx.uiText=text=>text==='未确定'?'Unknown language':text;
 app.run('renderStudio()');assert.equal(app.get('studioFile').textContent,'test.js · Unknown language');assert.equal(app.ctx.current.language,'未确定');
});
