const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {analyze} = require('../analyzer');
const {flowNodes} = require('../public/structure');
const K = require('../public/knowledge');
const sample = fs.readFileSync(path.join(__dirname,'fixtures/behavior-retry.py'),'utf8');
test('CSS source-map comments cannot cause local source-map file reads',()=>{
    const dir=path.join(__dirname,'../.browser-artifacts');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,'whoisjson-test.map');fs.writeFileSync(file,JSON.stringify({version:3,sources:['demo'],sourcesContent:['only a test marker'],names:[],mappings:''}));
    const read=fs.readFileSync;let touched=false;
    fs.readFileSync=function(p,...args){if(path.resolve(String(p))===file){touched=true;throw Error('Source maps must not be read');}return read.call(this,p,...args);};
    try{const result=analyze('a {color:red} /*# sourceMappingURL='+file.replaceAll('\\','/')+' */','x.css');assert.equal(result.status,'ready');assert.equal(touched,false);}
    finally{fs.readFileSync=read;fs.unlinkSync(file);}
});
const py = s => analyze(s,'sample.py',process.env.CODELINGO_PYTHON || 'python');
function facts(result) { return result.blocks.flatMap(b=>flowNodes(b.controlFlow)).filter(n=>n.guide?.id); }

test('retry is a bounded behavior, not a guessed variable name; imports and Unicode survive',()=>{
    for (const code of [sample,sample.replace(/attempt/g,'tries').replace(/LIMIT/g,'CAP'), '说明\n```python\n'+sample+'\n```\n结束', sample.replace(/\n/g,'\r\n')]) {
        const r=py(code); assert.equal(r.status,'ready');
        const nodes=facts(r), retry=nodes.find(n=>n.guide.id==='py.retry');
        assert.ok(retry);assert.match(retry.guide.purpose,/3 轮（包含第一次）/);
        assert.ok(nodes.some(n=>n.guide.id==='py.json-read'));
        assert.ok(nodes.some(n=>n.guide.id==='py.regex-replace'));
        const block=r.blocks.find(b=>b.title==='read_order');
        for(const id of ['py.text-strip','py.text-replace','py.json-read','py.retry'])assert.ok(block.learning.some(x=>x.id===id)&&K.cards[id]);
        for(const node of nodes)for(const ref of node.guide.evidence){assert.ok(code.split('\n').slice(ref.start-1,ref.end).join('\n').trim());assert.ok(ref.start>=block.start);}
    }
});
test('counter reset, non-unit update, success without return and continue do not claim bounded retry',()=>{
    for(const code of [sample.replace('attempt += 1','attempt = 0'),sample.replace('attempt += 1','attempt += 2'),sample.replace('return quantity','if quantity:\n                return quantity'),sample.replace('return quantity','continue')]) {
        assert.ok(!facts(py(code)).some(n=>n.guide.id==='py.retry'));
    }
});
test('standard-library aliases work; shadowed names, custom methods and strings in comments do not',()=>{
    assert.ok(facts(py('import json as j\ndef read(s):\n    return j.loads(s)')).some(n=>n.guide.id==='py.json-read'));
    for(const code of ['import json\ndef f(json,s):\n    return json.loads(s)','import json\njson.loads = custom\ndef f(s):\n    return json.loads(s)','def f(x):\n    # json.loads(x)\n    return x.strip()']) assert.equal(facts(py(code)).length,0);
    assert.ok(facts(py('def f():\n    text = "  你好😀  "\n    return text.strip()')).some(n=>n.guide.id==='py.text-strip'));
});
test('named initialization arguments and missing inherited methods remain visible',()=>{
    const r=py('from somewhere import Base\nclass Child(Base):\n    def __init__(self, name, cancel=None):\n        super().__init__(name, cancel=cancel)\n    async def run(self, text):\n        return await self.remote(text)');
    const init=facts(r).find(n=>n.guide.id==='py.super');assert.ok(init);assert.match(init.guide.input,/cancel=cancel/);assert.match(init.guide.purpose,/继承查找顺序/);
    assert.ok(r.blocks.find(b=>b.title==='run').guide.needsSource.some(x=>x.includes('self.remote')));
});
test('same-file relationships point to real definitions, not just matching text',()=>{
    const r=py('def helper(x):\n    return x\ndef caller(x):\n    return helper(x)');
    assert.equal(r.blocks.find(b=>b.title==='caller').guide.related[0].start,1);
    const js=analyze('function helper(x){return x;} function caller(x){return helper(x);}','x.js');
    assert.equal(js.blocks.find(b=>b.title==='caller').guide.related[0].title,'helper');
    const shadowed=py('def helper(x):\n    return x\ndef caller(helper, x):\n    return helper(x)');
    assert.equal(shadowed.blocks.find(b=>b.title==='caller').guide.related?.length || 0,0);
});
test('partial recovery shifts guide evidence and lessons to original locations',()=>{
    const code='bad = ;\n\ndef read(s):\n    import json\n    return json.loads(s)';
    const r=py(code), n=facts(r).find(x=>x.guide.id==='py.json-read');assert.ok(n);
    assert.equal(n.guide.evidence[0].start,5);assert.equal(r.blocks.find(b=>b.title==='read').guide.evidence[0].start,3);
});
test('JS parse and stringify have useful facts, knowledge and separate exception paths',()=>{
    const code='function read(text){try{const data=JSON.parse(text); return data.count;}catch(error){return 0;}finally{done();}}';
    const r=analyze(code,'x.js'),b=r.blocks[0],flow=b.controlFlow[0];
    assert.equal(flow.kind,'exception');assert.equal(flow.handlers[0].children[0].kind,'return');assert.ok(flow.finalizer.length);
    assert.ok(facts(r).some(n=>n.guide.id==='js.json-read'));
    assert.ok(b.learning.some(x=>x.id==='js.json-read'));
    for(const s of ['function f(JSON,s){return JSON.parse(s);}','JSON.parse = custom; function f(s){return JSON.parse(s);}'])assert.ok(!facts(analyze(s,'x.js')).length);
    assert.ok(facts(analyze('function save(data){return JSON.stringify(data);}','x.js')).some(n=>n.guide.id==='js.json-write'));
});
