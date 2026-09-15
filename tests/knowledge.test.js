const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const {analyze}=require('../analyzer'),K=require('../public/knowledge');
test('curated examples use their own language or configuration parser',()=>{
 for(const c of Object.values(K.cards)){
  let actual;
  if(c.language==='JSON')actual=JSON.parse(c.example);
  else if(c.language==='Gitignore'){const r=analyze(c.example,'.gitignore');assert.equal(r.status,'ready',c.id+': '+r.warnings.join(';'));assert.ok(c.naming&&c.pitfall&&c.result,c.id);continue;}
  else if(c.language==='JavaScript')actual=JSON.parse(JSON.stringify(vm.runInNewContext(c.example+'\n'+c.check,{}, {timeout:1000})));
  else if(c.language==='Dockerfile'){const r=analyze(c.example,'Dockerfile');assert.equal(r.status,'ready',c.id+': '+r.warnings.join(';'));continue;}
  else if(c.language==='Shell'){const r=analyze(c.example,'example.sh');assert.equal(r.status,'ready',c.id+': '+r.warnings.join(';'));continue;}
  else if(c.language==='Java'){const r=analyze(c.example,'Demo.java');assert.equal(r.status,'ready',c.id+': '+r.warnings.join(';'));continue;}
  else {const r=spawnSync(process.env.CODELINGO_PYTHON||'python',['-c',c.example+'\nimport json\nprint(json.dumps('+c.check+'))'],{encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});assert.equal(r.status,0,r.stderr);actual=JSON.parse(r.stdout);}
  assert.deepEqual(actual,c.expected,c.id);assert.ok(c.naming&&c.pitfall&&c.result);
 }
});
test('destructuring and native hypot carry specific source-backed learning',()=>{
 const code='function distance(a,b){\n const [x1,y1]=a;\n const [x2,y2]=b;\n return Math.hypot(x2-x1,y2-y1);\n}';const r=analyze(code,'x.js'),b=r.blocks[0];assert.match(b.controlFlow[0].detail,/第 1 项交给 x1/);assert.match(b.controlFlow[2].detail,/3 和 4/);assert.match(b.purpose,/平方/);
 assert.ok(['js.hypot','js.return'].every(id=>K.select(b.learning,4,4).some(x=>x.id===id)));
 assert.ok(K.select(b.learning,2,2).every(x=>x.start===2&&x.end===2));
});
test('comments and shadowed names do not fabricate builtin lessons',()=>{
 const source='function f(Math){ const text="Math.hypot(x,y)"; /* const [a,b]=c */ return Math.hypot(3,4); }';const b=analyze(source,'x.js').blocks[0];assert.ok(!b.learning.some(x=>['js.hypot','js.destructure'].includes(x.id)));
 const r=analyze('function f(){const list={map:x=>7};return list.map(3);}','x.js');assert.ok(!r.blocks[0].learning.some(x=>x.id==='js.map'));
});
test('destructured parameters and loop entries describe where the values come from',()=>{
 const b=analyze('function read([x,y], entries){for(const [key,value] of entries){use(key,value)}return x;}','x.js').blocks[0];const cards=b.learning.filter(x=>x.id==='js.destructure');assert.equal(cards.length,2);assert.match(cards[0].context,/调用时提供/);assert.match(cards[1].context,/当前这一轮/);assert.ok(cards.every(x=>!x.context.includes('从  中')));
});
test('knowledge follows original lines through wrappers and partial Python recovery',()=>{
 const r=analyze('```javascript\nfunction f(a){\nconst [x,y]=a;\nreturn x;\n}\n```','x.txt');assert.equal(r.blocks[0].learning.find(x=>x.id==='js.destructure').start,3);
 const py=analyze('bad =\n\ndef f(pair):\n    x, y = pair\n    return x\n','x.py','python');const b=py.blocks.find(x=>x.title==='f');assert.ok(b);assert.equal(b.learning.find(x=>x.id==='py.unpack').start,4);assert.equal(b.learning.find(x=>x.id==='py.return').start,5);
});
test('favorites deduplicate concepts and exact sources without overwriting existing associations',()=>{
 const c=K.cards['js.destructure'],a={file:'one.js',start:1,end:1,code:'const [a,b]=x;',context:'a'},b={...a,file:'two.js'};
 let list=K.merge([],c,a);const original=JSON.stringify(list);list=K.merge(list,c,a);assert.equal(JSON.stringify(list),original);list=K.merge(list,c,b);assert.equal(list.length,1);assert.equal(list[0].sources.length,2);assert.equal(JSON.parse(original)[0].sources.length,1);
 const exported=K.markdown(list[0]);assert.match(exported,/one.js/);assert.match(exported,/two.js/);assert.match(exported,/price/);
});
test('export uses a long enough fence for source containing backticks',()=>{const item=K.merge([],K.cards['js.template'],{file:'x.js',start:1,end:1,code:'const x = "```";',context:'example'})[0];assert.match(K.markdown(item),/````\nconst x/);});

