const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../analyzer'),K=require('../public/knowledge');
const python=process.env.CODELINGO_PYTHON||'python';
const read=(code)=>analyze(code,'sample.py',python);
const fixture=name=>fs.readFileSync(__dirname+'/fixtures/'+name,'utf8');
test('original mixed Markdown stays partial; explicitly formatted sample gets full reading',()=>{
 const raw=read(fixture('feedback-llm-factory.md'));assert.equal(raw.status,'partial');assert.match(raw.warnings.join(''),/缩进/);
 const r=read(fixture('feedback-llm-factory.py'));assert.equal(r.status,'ready');
 const b=r.blocks.find(b=>b.title==='make_all');assert.match(b.guide.plain.purpose,/4 组数据/);assert.match(b.guide.plain.purpose,/其他文件引入/);
 assert.equal(b.controlFlow.length,5);assert.match(b.controlFlow[4].guide.plain.purpose,/不是依次返回多次/);
 const ids=new Set(b.learning.filter(x=>K.cards[x.id]).map(x=>x.id));
 for(const id of ['py.call','py.keyword','py.attribute','py.tuple','py.self','py.annotation'])assert.ok(ids.has(id),id);
 assert.ok(!ids.has('py.index'));assert.ok(b.learning.some(x=>x.gap&&x.label==='调用 Tile'));
 assert.ok(b.guide.parts.some(p=>p.text==='['&&/不是按位置取值/.test(p.plain)));
});
test('six keyword values retain exact source spans and distinguish attribute access from parameter names',()=>{
 const code=fixture('feedback-llm-factory.py'),b=read(code).blocks.find(b=>b.title==='make_all');
 const first=b.controlFlow[0],args=first.guide.arguments;assert.equal(args.length,6);
 assert.equal(args[0].name,'shade');assert.equal(args[0].source,'palette.RED');assert.match(args[4].plain,/当前对象保存的 task_id/);
 for(const n of b.controlFlow.slice(0,4))for(const a of n.guide.arguments){assert.equal(a.start,a.end);assert.equal(code.split('\n')[a.start-1].slice(a.startColumn,a.endColumn),a.source);}
 assert.doesNotMatch(first.label,/RED/);assert.match(first.guide.needsSource.join(''),/查看对应定义/);
});
test('unrelated callable and names get the same behavior without declaring objects or model training',()=>{
 const r=read('def build_pair(make, options):\n    red = make(color=options.red)\n    blue = make(color=options.blue)\n    return red, blue\n');
 const b=r.blocks.find(b=>b.title==='build_pair');assert.match(b.guide.plain.purpose,/2 组数据分别交给 make/);assert.doesNotMatch(b.guide.plain.purpose,/LLM|模型|创建对象|其他文件/);
 assert.equal(b.controlFlow[0].guide.arguments[0].plain,'从 options 读取 red');
});
test('branches, rebinding, nested calls and reordered returns do not get the batch shortcut',()=>{
 for(const body of ['    a = make(x=1)\n    if ok:\n        b = make(x=2)\n    return a, b', '    a = make(x=1)\n    a = make(x=2)\n    return a, a', '    a = make(x=other())\n    b = make(x=2)\n    return a, b','    a = make(x=1)\n    b = make(x=2)\n    return b, a']){
  const b=read('def build(make, ok):\n'+body+'\n').blocks.find(b=>b.title==='build');assert.doesNotMatch(b.guide?.plain?.title||'',/分别准备/);
 }
});
test('tuple annotations and values differ from actual subscripting',()=>{
 const b=read('def pair(items) -> tuple[str, int]:\n    first = items[0]\n    return first, 2\n').blocks.find(b=>b.title==='pair');
 const index=b.learning.filter(x=>x.id==='py.index');assert.equal(index.length,1);assert.equal(index[0].start,2);
 assert.equal(b.learning.filter(x=>x.id==='py.tuple').length,1);
});
