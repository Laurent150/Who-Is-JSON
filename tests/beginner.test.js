const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');const {analyze}=require('../analyzer');
const python=process.env.CODELINGO_PYTHON||'python';const code=fs.readFileSync(path.join(__dirname,'fixtures/translator.py'),'utf8');
test('explains naming origin, checks and self calls in actual reported sample',()=>{
 const r=analyze(code,'translator.py',python),f=r.blocks[0];const symbols=Object.fromEntries(f.symbols.map(x=>[x.name,x]));
 assert.match(symbols.plain.origin,/作者/);assert.match(symbols.n.origin,/作者/);assert.equal(symbols.isinstance.origin,'Python 自带');assert.equal(symbols.ast.origin,'导入的工具');assert.equal(symbols['ast.Name'].origin,'ast 工具提供');assert.equal(symbols.if.origin,'Python 固定写法');
 assert.match(f.output,/文字模板/);assert.doesNotMatch(f.output,/取余/);assert.match(f.usage,/不是给新手的外部调用范例/);assert.match(f.concept,/递归/);
 const c=r.blocks.find(b=>b.kind==='condition');assert.match(c.purpose,/是不是一个表示名字/);assert.equal(c.output,'');assert.equal(c.usage,'');assert.equal(c.inputs,'');
});
test('preserves numeric modulo and avoids builtin claims when name is redefined',()=>{
 assert.match(analyze('def rem(x):\n    return x % 2','x.py',python).blocks[0].output,/取余/);
 const r=analyze('def isinstance(x, y):\n    return False\n\ndef use(x):\n    if isinstance(x, int):\n        return x','x.py',python);
 const f=r.blocks.find(b=>b.title==='use');assert.match(f.symbols.find(s=>s.name==='isinstance').origin,/作者/);assert.ok(!r.blocks.find(b=>b.kind==='condition').purpose.includes('看看'));
});
test('recognizes ast alias without declaring unrelated object fields to be ast fields',()=>{
 const r=analyze('import ast as syntax\ndef f(n, other):\n    if isinstance(n, syntax.Name):\n        return other.id','x.py',python);
 const symbols=r.blocks[0].symbols;assert.ok(symbols.some(s=>s.name==='syntax.Name'&&s.origin==='ast 工具提供'));assert.ok(!symbols.some(s=>s.name==='other.id'&&s.origin==='对象里的信息'));
});
