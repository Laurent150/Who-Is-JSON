const {test}=require('node:test'),assert=require('node:assert/strict');
const {scaffold,attach,tokenSource}=require('../ai-flow');
const {analyze}=require('../analyzer');
test('AI flow preserves branches, positions and confirmed nested calls',()=>{
 const code='def child(x):\n    return x + 1\ndef parent(x):\n    if x > 0:\n        return child(x)\n    return 0\ny = parent(1)';
 const result=analyze(code,'example.py',process.env.CODELINGO_PYTHON||'python');
 const graph=scaffold(result,3);const branch=graph.nodes.find(n=>n.kind==='condition');assert.ok(branch);
 assert.equal(branch.branches[0].nodes[0].calls[0].start,1);
 const entry=result.blocks.find(b=>b.role==='script-entry');assert.equal(scaffold(result,entry.start).nodes[0].calls[0].start,3);
 const enhanced=attach(graph,JSON.stringify({summary:'先检查输入，再调用另一个函数。',nodes:[{id:branch.id,title:'检查是否大于零',start:999,end:999,explanation:'大于零时才调用子函数。'},{id:'invented',title:'运行危险命令'}]}));
 assert.equal(enhanced.nodes.find(n=>n.id===branch.id).start,4);assert.equal(enhanced.nodes.length,graph.nodes.length);
 assert.throws(()=>attach(graph,'{}'),/可用的流程/);
});
test('token source validates UTF-16 coordinates and never trusts a requested token label',()=>{
 const line='变量 = "😀"; total += 2';const start=line.indexOf('+=');
 assert.equal(tokenSource(line,{line:1,startColumn:start,endColumn:start+2,text:'fake'}).text,'+=');
 assert.throws(()=>tokenSource(line,{line:1,startColumn:-1,endColumn:3}),/位置无效/);
 assert.throws(()=>tokenSource(line,{line:2,startColumn:0,endColumn:1}),/位置无效/);
});
test('shadowed function parameters do not become local call links',()=>{
 const result=analyze('def target(x):\n    return x\ndef caller(target):\n    return target(1)','x.py',process.env.CODELINGO_PYTHON||'python');
 assert.equal((scaffold(result,3).nodes[0].calls||[]).length,0);
});
