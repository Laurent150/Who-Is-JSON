const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {analyze}=require('../analyzer'),K=require('../public/knowledge'),{flowNodes}=require('../public/structure');
const clean='const clean = v => typeof v === "string" ? v.trim() : "";';
function fragment(code,x){const lines=code.split('\n').slice(x.start-1,x.end);return lines.map((l,i)=>l.slice(i===0?x.startColumn:0,i===lines.length-1?x.endColumn:undefined)).join('\n');}
test('the selected empty branch highlights only the empty literal and excludes trim lessons',()=>{
 const b=analyze(clean,'x.js').blocks[0],condition=b.controlFlow[0],no=condition.otherwise[0],yes=condition.children[0],report=K.coverage(b.learning,no);
 assert.equal(fragment(clean,no),'""');assert.equal(fragment(clean,condition),'typeof v === "string"');assert.equal(fragment(clean,yes),'v.trim()');
 assert.deepEqual(report.current.map(x=>x.id).sort(),['js.empty-string','js.implicit-return']);
 assert.ok(report.context.some(x=>x.id==='js.trim'));assert.ok(!report.current.some(x=>x.id==='js.trim'));
 for(const id of ['js.binding','js.variable','js.arrow','js.typeof','js.compare','js.string','js.choice'])assert.ok(K.coverage(b.learning,{start:1,end:1}).current.some(x=>x.id===id),id);
});
test('source positions survive prose, fences, numbered gutters, BOM, CRLF, Unicode and selected-line offsets',()=>{
 const variants=[clean,'```javascript\r\n'+clean+'\r\n```','下面是示例\n```js\n'+clean+'\n```\n以上是说明','1 | const emoji="😀";\n2 | '+clean+'\n3 | clean(3);','\uFEFF'+clean,'const emoji="😀"; '+clean];
 for(const code of variants){const b=analyze(code,'x.js').blocks.find(x=>x.title==='clean');assert.ok(b);const no=b.controlFlow[0].otherwise[0];assert.equal(fragment(code,no),'""',code);const records=K.coverage(b.learning,no).current;assert.ok(records.some(x=>x.id==='js.empty-string'));}
});
test('Python UTF-8 AST columns map to browser UTF-16 without losing Chinese or emoji',()=>{
 const source='def read():\n    文字 = "😀"; return ""\n';const b=analyze(source,'x.py','python').blocks[0],node=b.controlFlow.at(-1);assert.equal(fragment(source,node),'return ""');const k=b.learning.find(x=>x.id==='py.string'&&fragment(source,x)==='""');assert.ok(k);assert.ok(K.coverage(b.learning,node).current.some(x=>x.id==='py.string'));
});
test('coverage names known gaps and does not call arbitrary methods standard built-ins',()=>{
 const b=analyze('async function work(input){const x=await remote(input);return x[0];}','x.js').blocks[0],r=K.coverage(b.learning,{start:1,end:1});assert.ok(r.gaps.some(x=>x.label.includes('异步')));assert.ok(r.gaps.some(x=>x.label.includes('remote')));
 const py=analyze('def f(xs):\n    return [x * 2 for x in xs if x > 1]\n','x.py','python').blocks[0];assert.ok(['py.comprehension','py.compare','py.arithmetic'].every(id=>py.learning.some(x=>x.id===id)));
});
test('Java parser reads actual methods, branches and loops with exact conditions',()=>{
 const file=path.join(__dirname,'corpus/java-Factorial.java'),source=fs.readFileSync(file,'utf8'),r=analyze(source,'Factorial.java'),b=r.blocks.find(x=>x.title==='factorial');assert.equal(r.status,'ready');assert.ok(b);const nodes=flowNodes(b.controlFlow);assert.ok(nodes.some(x=>x.kind==='loop'));assert.ok(nodes.some(x=>x.kind==='throw'));assert.equal(fragment(source,nodes.find(x=>x.kind==='condition')),'n < 0');assert.ok(b.learning.some(x=>x.id==='java.compare'));assert.ok(b.learning.some(x=>x.gap));
 const broken=analyze('public class Demo { public int f( { }','Demo.java');assert.equal(broken.status,'invalid');assert.equal(broken.blocks.length,0);
 const snippet=analyze('public int doubleValue(int n) { return n * 2; }','snippet.java');assert.equal(snippet.status,'ready');assert.ok(snippet.blocks.some(x=>x.title==='doubleValue'));
});
test('the new Java and Flask corpus files retain pinned sources and verified content hashes',()=>{
 const manifest=require('./corpus/manifest.json');for(const m of manifest.filter(x=>x.name.startsWith('java-')||x.name==='flask-helpers.py')){assert.match(m.revision,/^[a-f0-9]{40}$/);assert.equal(m.licenseRetrieved,true);const source=fs.readFileSync(path.join(__dirname,'corpus',m.name));assert.equal(crypto.createHash('sha256').update(source).digest('hex'),m.sha256);assert.ok(fs.readFileSync(path.join(__dirname,'corpus',m.name+'.LICENSE'),'utf8').length>200);}
});
test('real Java files consistently expose gaps and bound all nodes within original source',()=>{
 for(const name of ['java-BinarySearch.java','java-InsertionSort.java','java-Factorial.java']){const source=fs.readFileSync(path.join(__dirname,'corpus',name),'utf8'),r=analyze(source,name);assert.equal(r.status,'ready',name);const methods=r.blocks.filter(x=>x.kind==='function');assert.ok(methods.length);for(const b of methods)for(const n of flowNodes(b.controlFlow)){assert.ok(n.start>=b.start&&n.end<=b.end);assert.ok(n.endColumn>=0);assert.ok(fragment(source,n).trim());}assert.ok(r.blocks.some(b=>b.learning.some(x=>x.gap)));}
});
test('same-line occurrences remain distinct in favorites while exact duplicates merge',()=>{
 const card=K.cards['js.implicit-return'],a={file:'x.js',start:1,end:1,startColumn:10,endColumn:12,code:'same line',context:'first'},b={...a,startColumn:20,endColumn:22,context:'second'};
 let saved=K.merge([],card,a);saved=K.merge(saved,card,b);saved=K.merge(saved,card,b);assert.equal(saved[0].sources.length,2);
});
test('module-level Python shadowing and JS custom methods remain explanation gaps',()=>{
 const r=analyze('isinstance = custom\ndef f(x):\n    return isinstance(x, str)\n','x.py','python');assert.ok(!r.blocks.flatMap(b=>b.learning).some(x=>x.id==='py.typecheck'));assert.ok(r.blocks.flatMap(b=>b.learning).some(x=>x.gap));
 const b=analyze('function f(){const item={trim:()=>7};return item.trim();}','x.js').blocks[0];assert.ok(!b.learning.some(x=>x.id==='js.trim'));assert.ok(b.learning.some(x=>x.id==='gap.js.custom-call'));
});
