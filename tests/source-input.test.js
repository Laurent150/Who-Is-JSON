const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {sourceInput}=require('../source-input'),{analyze}=require('../analyzer'),{build}=require('../public/presentation');
test('matching outer fences preserve nested templates and original source line numbers',()=>{
 const original=fs.readFileSync(require.resolve('../public/presentation'),'utf8');
 const wrapped='```javascript\n'+original+'\n```';const input=sourceInput(wrapped);
 assert.equal(input.code.split('\n').length,wrapped.split('\n').length);
 assert.equal(input.code.slice(1,-1),original);const plain=analyze(original,''),r=analyze(wrapped,'');
 assert.equal(r.syntaxErrors,false);assert.equal(r.outerFenceIgnored,true);
 const names=['clean','build','markdown'];for(const name of names){const a=plain.blocks.find(b=>b.title===name),b=r.blocks.find(b=>b.title===name);assert.equal(b.start,a.start+1);assert.equal(b.code,a.code);assert.ok(build(r).sections.some(s=>s.title===name));}
});
test('only a complete outer pair is ignored; embedded backticks and mismatched fences stay intact',()=>{
 for(const code of ['const s = `hello`;','```javascript\nfunction a() {}','const text = "```";','```js\nlet x=1;\n~~~~'])assert.equal(sourceInput(code).code,code);
});
test('ignoring a wrapper does not hide genuine syntax errors',()=>{const r=analyze('```javascript\nfunction a() { return “bad”; }\n```','');assert.equal(r.syntaxErrors,true);assert.equal(build(r).sections.length,0);});
test('actual user pasted chat answer extracts its code and preserves source evidence',()=>{const raw=fs.readFileSync(require('node:path').join(__dirname,'fixtures/chat-presentation.txt'),'utf8');const r=analyze(raw,'pasted-text.txt');assert.equal(r.syntaxErrors,false);assert.equal(r.status,'ready');assert.deepEqual(build(r).sections.filter(x=>x.index!==null).map(x=>x.title),['clean','build','markdown']);for(const b of r.blocks)assert.equal(b.code,raw.split('\n').slice(b.start-1,b.end).join('\n'));assert.equal(r.normalizedCode.split('\n').length,raw.split('\n').length);assert.ok(r.formatChanges.some(x=>x.includes('块外说明')));});
test('multiple fenced blocks are not silently merged and template contents are not extracted',()=>{const multi='Here are two files\n```js\nlet a=1;\n```\n```py\ndef f(): pass\n```';assert.equal(sourceInput(multi).code,multi);const literal='const example = `\n```js\nhello\n```\n`;';assert.equal(sourceInput(literal).code,literal);});
