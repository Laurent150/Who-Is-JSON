const test=require('node:test'),assert=require('node:assert/strict');
const {reconstruct}=require('../ocr-layout');
function line(text,x,y,confidence=95){return {text,bbox:{x0:x,y0:y,x1:x+text.length*10,y1:y+16},confidence,words:[{text:'result',confidence,bbox:{x0:x,y0:y,x1:x+60,y1:y+16},symbols:[...'result'].map((text,i)=>({text,bbox:{x0:x+i*10,x1:x+i*10+8}}))}]};}
function data(lines){return {confidence:90,blocks:[{paragraphs:[{lines}]}]};}
test('OCR estimates relative indentation without language-specific repairs',()=>{
 const result=reconstruct(data([line('function total() {',30,10),line('const values = [1, 2];',70,35),line('return values[0];',110,60),line('}',30,85)]));
 assert.equal(result.code,'function total() {\n    const values = [1, 2];\n        return values[0];\n}');
 assert.deepEqual(result.uncertainLines,[]);
});
test('two-space YAML and crop margins preserve relative alignment',()=>{
 const result=reconstruct(data([line('jobs:',90,10),line('build:',110,30),line('steps:',130,50)]));
 assert.equal(result.code,'jobs:\n  build:\n    steps:');
});
test('uncertain symbols are reported, not silently rewritten',()=>{
 const result=reconstruct(data([line('retum self.client',20,10,40)]));
 assert.equal(result.code,'retum self.client');assert.deepEqual(result.uncertainLines,[1]);
});
test('empty recognition is an explicit failure',()=>assert.throws(()=>reconstruct({blocks:[]}),/没有识别到代码/));
const {restoreUnderscores}=require('../ocr-consensus');
test('second optical pass restores matching underscores, never different letters',()=>{
 assert.equal(restoreUnderscores('async def get client(self):','async def get_client(self):'),'async def get_client(self):');
 assert.equal(restoreUnderscores('decode responses=True','decode_responses=rrue'),'decode_responses=True');
 assert.equal(restoreUnderscores('MAX CONNECTIONS','MAX_CONNECTIONSJ'),'MAX CONNECTIONS');
 assert.equal(restoreUnderscores('return value','retum value'),'return value');
});
test('ambiguous repeated names are not automatically replaced',()=>assert.equal(restoreUnderscores('value name + value name','value_name'),'value name + value name'));
test('shipped OCR models match the recorded downloads',()=>{
 const fs=require('fs'),path=require('path'),crypto=require('crypto'),dir=path.join(__dirname,'../ocr-data');
 for(const entry of require('../ocr-data/manifest.json').files){const bytes=fs.readFileSync(path.join(dir,entry.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
 assert.match(fs.readFileSync(path.join(dir,'LICENSE'),'utf8'),/Apache License/);
});
test('damaged OCR Python is reported for review, not accepted as verified code',()=>{
 const result=require('../ocr-review').review('async def get client(self):\n    return 1',process.env.CODELINGO_PYTHON||'python');
 assert.equal(result.language,'Python');assert.notEqual(result.status,'ready');assert.match(result.warning,/核对/);
});
test('disagreement such as 0 versus 9 is flagged even at high OCR confidence',()=>{
 const primary=data([line('return items[9]',20,10)]),alternate=data([line('return items[0]',20,10)]);
 require('../ocr-consensus').compare(primary,alternate);
 assert.deepEqual(reconstruct(primary).uncertainLines,[1]);
 assert.equal(reconstruct(primary).code,'return items[9]');
});
