const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../analyzer'),K=require('../public/knowledge'),{flowNodes,modules}=require('../public/structure');
const py=process.env.CODELINGO_PYTHON||'python';
const cases=[
 ['顶层赋值','x = 2\ny = x + 3',['py.assign','py.arithmetic']],
 ['导入与别名','from math import sqrt as root\nvalue = root(9)',['py.import','py.call']],
 ['注释与说明','"""给读者看的说明"""\n# 没有处理步骤',[]],
 ['函数与返回','def twice(n):\n    return n * 2',['py.function','py.return']],
 ['仅限位置及具名参数','def f(a, /, b=2, *, c=3):\n    return a + b + c',['py.function']],
 ['可变参数','def f(*items, **options):\n    return items, options',['py.tuple']],
 ['具名调用','def f(x):\n    return x\nanswer = f(x=3)',['py.keyword']],
 ['默认值与类型提示','def f(x: list[int] = None) -> tuple[str, int]:\n    return "n", 2',['py.annotation','py.tuple']],
 ['解包','a, b = (2, 4)',['py.unpack','py.tuple']],
 ['扩展调用','def f(*xs):\n    return xs\nvalues = [2, 4]\nanswer = f(*values)',['py.call']],
 ['属性与对象','class Box:\n    def __init__(self, value):\n        self.value = value',['py.class','py.self','py.attribute']],
 ['类方法','class Box:\n    @classmethod\n    def name(cls):\n        return cls.__name__',['py.function','py.attribute']],
 ['静态方法','class Box:\n    @staticmethod\n    def twice(n):\n        return n * 2',['py.function']],
 ['分支','def sign(x):\n    if x > 0:\n        return 1\n    else:\n        return 0',['py.condition']],
 ['条件选值','result = "yes" if ready else "no"',['py.conditional-value']],
 ['列表推导','result = [x * 2 for x in [1, 2] if x > 1]',['py.comprehension']],
 ['字典与集合推导','a = {x: x * 2 for x in [1, 2]}\nb = {x % 2 for x in [1, 2]}',['py.collection-comprehension']],
 ['集合','items = {1, 1, 2}',['py.set']],
 ['索引与切片','items = [1, 2, 3]\na = items[0]\nb = items[1:]',['py.index','py.slice']],
 ['字典','data = {"name": "小林"}\nvalue = data["name"]',['py.dict']],
 ['循环与else','def first(xs):\n    for x in xs:\n        if x:\n            break\n    else:\n        return None\n    return x',['py.loop']],
 ['while与continue','def run():\n    i = 0\n    while i < 3:\n        i += 1\n        if i < 2:\n            continue\n    return i',['py.loop']],
 ['异常与收尾','def number(x):\n    try:\n        return int(x)\n    except ValueError:\n        return 0\n    finally:\n        cleanup()',['py.exception']],
 ['资源范围','def read(stream):\n    with stream as item:\n        return item.read()',['py.with']],
 ['异步等待','async def run(client):\n    return await client.read()',['py.await']],
 ['生成器','def values():\n    yield 2\n    yield 4',['py.generator']],
 ['转交生成器','def values(xs):\n    yield from xs',['py.generator']],
 ['生成器表达式','items = (x * 2 for x in [1, 2])',['py.generator']],
 ['短函数','twice = lambda n: n * 2',['py.lambda']],
 ['字符串插值','count = 2\ntext = f"数量：{count}"',['py.format']],
 ['布尔与比较','ok = x is not None and x > 0',['py.logic','py.compare']],
 ['断言','assert count > 0, "需要正数"',['py.assert']],
 ['模式匹配','def read(value):\n    match value:\n        case ["ok", n] if n > 0:\n            return n\n        case _:\n            return 0',['py.match']],
 ['嵌套定义','def outer(x):\n    def inner(y):\n        return y + 1\n    return inner(x)',['py.function']],
 ['绑定声明与删除','value = 1\ndef clear():\n    global value\n    del value',[]]
];
for(const [name,code,cards] of cases)test('Python 基础覆盖：'+name,()=>{
 const r=analyze(code,'sample.py',py);assert.equal(r.status,'ready',JSON.stringify(r.warnings));assert.ok(modules(r).length);
 const ids=new Set(r.blocks.flatMap(b=>(b.learning||[]).map(x=>x.id)));for(const id of cards)assert.ok(ids.has(id)&&K.cards[id],name+': '+id);
 for(const b of r.blocks){assert.ok(b.start>=1&&b.end<=code.split('\n').length);assert.equal(b.code,code.split('\n').slice(b.start-1,b.end).join('\n'));}
});
test('input and output contracts distinguish parameter modes, coroutines and generators',()=>{
 const block=code=>analyze(code,'x.py',py).blocks.find(b=>b.kind==='function');
 let g=block(cases[4][1]).guide.plain;assert.match(g.input,/a：只能按位置/);assert.match(g.input,/c：必须按名字/);
 g=block(cases[25][1]).guide.plain;assert.match(g.output,/生成器/);assert.doesNotMatch(g.output,/没有交回具体结果/);
 assert.match(block(cases[24][1]).guide.plain.output,/协程/);
 const cls=block(cases[11][1]);assert.doesNotMatch(cls.guide.plain.input,/cls：.*不能省略/);
});
test('match, loops and finally retain alternative paths instead of flattening them',()=>{
 const r=analyze(cases[32][1],'x.py',py),n=r.blocks.find(b=>b.kind==='function').controlFlow[0];assert.equal(n.kind,'pattern');assert.equal(n.children.length,2);assert.match(n.children[0].label,/并且/);
 const loop=analyze(cases[20][1],'x.py',py).blocks.find(b=>b.kind==='function').controlFlow[0];assert.equal(loop.afterLoop[0].kind,'return');assert.ok(flowNodes(loop.children).some(x=>x.kind==='break'));
 const exc=analyze(cases[22][1],'x.py',py).blocks.find(b=>b.kind==='function').controlFlow[0];assert.ok(exc.finalizer.length&&exc.handlers.length);
});
test('external names and nested generators do not get invented return behavior',()=>{
 const r=analyze('def outer():\n    def child():\n        yield 1\n    return child\n','x.py',py);assert.doesNotMatch(r.blocks.find(x=>x.title==='outer').guide.plain.output||'',/调用后得到.*生成器/);
 const g=analyze('def value(LLM):\n    return LLM()','x.py',py).blocks.find(x=>x.title==='value');assert.ok(g.learning.some(x=>x.gap));assert.doesNotMatch(g.guide.plain.purpose||'',/创建模型/);
});
module.exports={cases};
test('path division and numeric division have different source-based explanations',()=>{
 const r=analyze('from pathlib import Path\ndef join(root: Path, name):\n    return root / name','x.py',py),b=r.blocks.find(b=>b.title==='join');assert.match(b.controlFlow[0].detail,/拼成路径/);assert.ok(b.learning.some(x=>x.id==='py.path'));assert.ok(!b.learning.some(x=>x.id==='py.arithmetic'));
 const other=analyze('def divide(root, name):\n    return root / name','x.py',py).blocks[0];assert.ok(!other.learning.some(x=>x.id==='py.path'));
});
