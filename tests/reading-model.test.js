const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../public/reading-model');
const explain=(s,l,t)=>R.lessons(s,l).parts.filter(x=>x.text===t).map(x=>x.plain).join('\n');
test('symbols are explained by language and context, not spelling alone',()=>{
 assert.match(explain('for cost in [3, 8]:\n    sum += cost','Python','['),/列表/);
 assert.match(explain('items[0]','Python','['),/取出/);
 assert.match(explain('items[1:3]','Python',':'),/切片/);
 assert.match(explain('values: list[int]','Python','['),/类型/);
 assert.match(explain('data = {"x": items[0]}','Python','['),/取出/);
 assert.match(explain('{"values": [3, 8]}','JSON',':'),/名称/);
 assert.match(explain('for (const cost of [3, 8]) { sum += cost; }','JavaScript','of'),/提供的值/);
 assert.match(explain('for (const cost of [3, 8]) {}','JavaScript','['),/数组/);
 assert.match(explain('let values: number[] = [];','TypeScript','['),/数组类型/);
 assert.match(explain('for (const key in values) {}','JavaScript','in'),/属性名/);
 assert.match(explain('const [a, b] = items;','JavaScript','['),/接收/);
 assert.match(explain('int[] values = new int[3];','Java','['),/数组类型/);
 assert.match(explain('int[] values = new int[3];','Java','['),/长度/);
 assert.match(explain('for (int value : values) { sum += value; }','Java',':'),/遍历/);
 assert.match(explain('count=1\nwhile check; do work; done','Shell','='),/不能随意加空格/);
 assert.match(explain('FROM python:3.12\nRUN echo hello','Dockerfile','RUN'),/制作镜像/);
 assert.match(explain('a { color: red; }','CSS',':'),/属性名/);
 assert.match(explain('name: demo','YAML',':'),/配置/);
 assert.equal(explain('SELECT * FROM x WHERE id = 3','SQL','='),'');
 assert.equal(explain('const v = condition ? x : y;','TypeScript',':'),'');
});
test('comments, strings, regex and unsupported syntax never fabricate Python lessons',()=>{
 for(const [s,l] of [['text="for [1]: +=" # for while','Python'],['const re = /[+:]/; // while','JavaScript'],['/* for [1] */ String x="while";','Java'],['echo "while for []" # for','Shell'],['<!-- for += --> <p>while</p>','HTML']]){
  const tokens=R.scan(s,l);assert.equal(tokens.map(x=>x.text).join(''),s);
  assert.ok(!R.lessons(s,l).parts.some(x=>['for','while','+='].includes(x.text)));
 }
 assert.equal(R.lessons('fn main() { for x in [1] {} }','Rust').parts.length,0);
 assert.ok(R.lessons('const value = flag ? a : b','JavaScript').unknown.includes(':'));
 assert.match(explain('async function load() { await fetch(url); }','JavaScript','async'),/返回 Promise/);
 assert.match(explain('async def load():\n    await fetch()','Python','async'),/单独调用后/);
});
test('Unicode and source ranges survive rendering lesson extraction',()=>{
 const s='# 中文\n总数 = 0\nfor 价格 in [10, 20]:\n    总数 += 价格';
 for(const part of R.lessons(s,'Python').parts)assert.equal(s.split('\n')[part.start-1].slice(part.startColumn,part.endColumn),part.text);
 const original='title = "。。"';R.lessons(original,'Python');assert.equal(original,'title = "。。"');
 const id=R.identity({kind:'function',title:'__init__',owner:'Store'},'Python');assert.equal(id.name,'Store.__init__');assert.equal(id.title,'做好开始前的准备');
 assert.equal(R.identity({kind:'function',title:'__init__'},'JavaScript').title,null);
});
test('documentation sentence joining preserves original source but avoids duplicate punctuation',()=>{
 const {analyze}=require('../analyzer');const code='class Demo:\n    """整理内容。"""\n    def prepare(self):\n        self.text = "。。"';const r=analyze(code,'demo.py','python');assert.ok(!r.guide.purpose.includes('。。'));assert.ok(code.includes('"。。"'));
 assert.equal(explain('const async = 2; obj.for(); obj.while();','JavaScript','async'),'');assert.equal(explain('obj.for();','JavaScript','for'),'');
});
