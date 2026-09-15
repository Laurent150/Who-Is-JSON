const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../analyzer'),{flowNodes}=require('../public/structure'),K=require('../public/knowledge');
const sample=fs.readFileSync(__dirname+'/fixtures/initialization-lesson.py','utf8');
const py=code=>analyze(code,'lesson.py','python');
test('initializer explains object changes, defaults and evidence without invented docstrings',()=>{
 const b=py(sample).blocks.find(b=>b.title==='__init__'),g=b.guide;
 assert.match(g.plain.output,/调用者得到的是新对象/);assert.match(g.plain.output,/DEFAULT_PROMPT.*system_prompt/);
 assert.match(g.plain.input,/context_window：可以省略，省略时用 128000/);
 assert.match(g.basis,/没有提供作者说明/);assert.ok(!g.basis.includes('用途引用'));
 assert.ok(g.needsSource.some(x=>x.includes('__init__')));assert.match(g.validation,/没有运行/);
 const annotated=py(sample.replace('        super()', '        """准备当前对象。"""\n        super()')).blocks.find(b=>b.title==='__init__');
 assert.match(annotated.guide.basis,/引用该函数的作者说明/);
});
test('super token lessons distinguish two calls, member lookup and keyword sides',()=>{
 const b=py(sample).blocks.find(b=>b.title==='__init__'),n=flowNodes(b.controlFlow).find(n=>n.guide?.id==='py.super');
 const parts=n.guide.parts,opens=parts.filter(p=>p.text==='(');
 assert.equal(opens.length,2);assert.match(opens[0].plain,/当前类和 self/);assert.match(opens[1].plain,/调用前面的功能/);
 assert.ok(parts.some(p=>p.text==='.'&&p.plain.includes('属性或方法')));
 assert.ok(parts.some(p=>p.text==='='&&p.plain.includes('按名字传参数')));
 const sides=parts.filter(p=>p.text==='cancel_event');assert.equal(sides.length,2);
 assert.match(sides[0].plain,/接收方/);assert.match(sides[1].plain,/当前变量/);
 assert.ok(!b.learning.some(x=>x.gap&&x.label==='调用 super'));
 for(const p of parts)assert.equal(sample.split('\n')[p.start-1].slice(p.startColumn,p.endColumn),p.text);
});
test('definition parts cover defaults, optional annotations, return hint and same-line definitions',()=>{
 const g=py(sample).blocks.find(b=>b.title==='__init__').guide;
 for(const text of ['def','self','__init__',':','=','|','->','None'])assert.ok(g.parts.some(p=>p.text===text),text);
 assert.ok(py('def f(x=2): return x').blocks[0].guide.parts.some(p=>p.text==='def'));
 const positional=py('def f(x, /, *, y=3):\n    return x+y').blocks[0].guide.plain.input;assert.match(positional,/x：只能按位置提供，不能省略/);assert.match(positional,/y：必须按名字提供；省略时用 3/);
 const optional=py('def f(x) -> int | None:\n    return x').blocks[0].guide.parts.find(p=>p.text==='None');assert.match(optional.plain,/允许出现 None/);
 const declaration=py('class A:\n    def __init__(self):\n        self.name: str').blocks.find(b=>b.title==='__init__');assert.ok(!declaration.guide.plain.output.includes('保存到'));
 assert.match(declaration.controlFlow[0].detail,/没有给它赋值/);assert.ok(!declaration.learning.some(x=>x.id==='py.assign'));
});
test('source spans survive Unicode and recovery; custom super is not taught as builtin',()=>{
 for(const code of [sample.replace('task_id','名字'), 'broken = ;\n'+sample]){
  const r=py(code),b=r.blocks.find(b=>b.title==='__init__');assert.ok(b);
  for(const p of b.guide.parts)assert.equal(code.split('\n')[p.start-1].slice(p.startColumn,p.endColumn),p.text);
 }
 const custom=py('class A:\n    def f(self, super):\n        return super().__init__()');
 assert.ok(!flowNodes(custom.blocks.find(b=>b.title==='f').controlFlow).some(x=>x.guide?.id==='py.super'));
 const local=py(K.cards['py.super'].example).blocks.find(b=>b.owner==='User'&&b.title==='__init__');
 assert.ok(local.guide.related.some(x=>x.title.includes('Base')));assert.ok(!local.guide.needsSource.length);
});
test('saved teaching walkthroughs retain concrete results and are exported',()=>{
 const card=K.cards['py.super'];assert.equal(card.walkthrough.length,4);assert.match(card.result,/同一个 user/);
 assert.equal(card.prerequisites.length,2);
 const saved=K.merge([],card,{file:'demo.py',code:sample,context:'初始化',start:1,end:15});
 const md=K.markdown(saved[0]);assert.match(md,/Base 的初始化方法/);assert.match(md,/少写这一步/);
 for(const id of ['py.function','py.annotation','py.assign','py.json-read'])assert.equal(K.cards[id].walkthrough.length,3);
});
test('indexed source extraction preserves Unicode, CRLF and multiline call arguments',()=>{
 const code='def f(名字):\r\n    text = "😀"\r\n    return other(\r\n        名字, text,\r\n        option="中文"\r\n    )\r\n';
 const r=py(code);assert.equal(r.status,'ready');const b=r.blocks.find(b=>b.title==='f');
 assert.match(b.guide.plain.input,/名字/);assert.match(b.output,/中文/);
 for(const p of b.guide.parts)assert.equal(code.split('\n')[p.start-1].slice(p.startColumn,p.endColumn),p.text);
});
