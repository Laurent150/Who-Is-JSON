const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {analyze}=require('../analyzer'),{modules,flowNodes}=require('../public/structure'),K=require('../public/knowledge');
const py=process.env.CODELINGO_PYTHON||'python',read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const source=read('fixtures/user-agent.py');
test('authored Notebook release gate: purpose, all methods, normal/error paths and real names',()=>{
 const r=analyze(source,'agent.py',py);assert.equal(r.status,'ready');assert.equal(modules(r).filter(x=>x.block.kind==='function').length,11);assert.match(r.guide.purpose,/整理便签.*归档/);
 for(const name of ['run','compress_if_needed']){
  const b=r.blocks.find(x=>x.title===name),nodes=flowNodes(b.controlFlow);
  assert.doesNotMatch(b.guide.purpose,/把一组步骤包装/);
  assert.ok(nodes.some(x=>x.kind==='exception'&&x.handlers.length));assert.ok(nodes.some(x=>x.kind==='await'));
  assert.ok(!nodes.some(x=>x.kind==='unknown'));assert.ok(nodes.length>15);
  for(const n of nodes){assert.ok(n.start>=b.start&&n.end<=b.end);assert.ok(n.label.trim());}
 }
 const chat=r.blocks.find(x=>x.title==='_chat');assert.ok(flowNodes(chat.controlFlow).some(n=>n.detail?.includes('不会自动取消剩余任务')));
 const estimate=r.blocks.find(x=>x.title==='_estimate_tokens');assert.match(estimate.controlFlow[0].label,/除以 3.*向下取整/);
 for(const n of ['len','max','str'])assert.equal(estimate.symbols.find(s=>s.name===n).origin,'Python 自带');
 assert.match(estimate.symbols.find(s=>s.name==='self').meaning,/自动传入/);assert.doesNotMatch(estimate.inputs,/self（需要传入）/);
 for(const id of ['py.length','py.extrema','py.docstring','py.annotation'])assert.ok(estimate.learning.some(k=>k.id===id)&&K.cards[id]);
 assert.ok(!estimate.learning.some(x=>x.gap&&/max|len/.test(x.label)));
});
test('try else finally retain separate source paths, including overriding return and wrapped Unicode',()=>{
 const code='def read(value):\n    """读取中文😀内容。"""\n    try:\n        number = int(value)\n    except ValueError:\n        return 0\n    else:\n        return number\n    finally:\n        cleanup()\n';
 for(const raw of [code,'说明\n```python\n'+code+'```\n结束',code.replace(/\n/g,'\r\n')]){
  const r=analyze(raw,'clip.txt',py),b=r.blocks.find(x=>x.title==='read'),flow=b.controlFlow[0];
  assert.equal(flow.kind,'exception');assert.equal(flow.handlers.length,1);assert.equal(flow.afterSuccess[0].kind,'return');assert.ok(flow.finalizer.length);
  for(const n of flowNodes(b.controlFlow)){const lines=raw.split('\n');assert.ok(n.start>=b.start&&n.end<=b.end);assert.ok(lines.slice(n.start-1,n.end).join('\n').trim());}
 }
 const r=analyze('def f():\n    try:\n        return 1\n    finally:\n        return 2\n    unreachable()','x.py',py);assert.equal(r.blocks[0].controlFlow.length,1);assert.equal(r.blocks[0].controlFlow[0].terminal,true);
});
test('unknown tool behavior remains a gap; same-name user definitions stay user-defined',()=>{
 const r=analyze('def max(a,b):\n    return a\ndef f(text):\n    return max(1,len(text))','x.py',py),b=r.blocks.find(x=>x.title==='f');
 assert.match(b.symbols.find(x=>x.name==='max').origin,/作者/);assert.ok(!b.learning.some(x=>x.id==='py.extrema'));
 const unknown=analyze('async def f(value):\n    async with external(value) as item:\n        return await item.read()','x.py',py).blocks[0];
 assert.equal(unknown.controlFlow[0].kind,'resource');assert.ok(unknown.learning.some(x=>x.gap&&x.label.includes('external')));
});
test('comparison chains, changed constants and augmented assignment keep actual meaning',()=>{
 const r=analyze('LIMIT = 3\ndef f(LIMIT, x, y, z):\n    x -= 2\n    if x < y < z:\n        return x // LIMIT','x.py',py).blocks.find(b=>b.title==='f');
 assert.match(r.controlFlow[0].label,/原值减去 2/);assert.match(r.controlFlow[1].label,/x 小于 y.*y 小于 z/);assert.match(r.controlFlow[1].children[0].label,/LIMIT/);
});
test('Python recovery remaps exception handler and finalizer source positions',()=>{
 const r=analyze('broken = (\n\ndef f():\n    try:\n        return 1\n    except ValueError:\n        return 2\n    finally:\n        cleanup()\n','x.py',py);
 // Unmatched opening brackets may make recovery unsafe; use an independent syntax error instead.
 const s=analyze('oops = ;\n\ndef f():\n    try:\n        return 1\n    except ValueError:\n        return 2\n    finally:\n        cleanup()\n','x.py',py);
 const b=s.blocks.find(x=>x.title==='f');assert.ok(b);const x=b.controlFlow[0];assert.equal(x.handlers[0].children[0].start,7);assert.equal(x.finalizer[0].start,9);
});
