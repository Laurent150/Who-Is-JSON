// Public corpus validation. Downloaded programs are parsed, never executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {analyze}=require('../analyzer'),{modules,flowNodes}=require('../public/structure');
const report={build:require('../build-info'),samples:[],failures:[]};
for(const folder of ['corpus','holdout'])for(const item of require('./'+folder+'/manifest.json')){
 try{
  const file=path.join(__dirname,folder,item.name),bytes=fs.readFileSync(file),code=bytes.toString('utf8');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
  assert.ok(fs.readFileSync(file+'.LICENSE','utf8').length>100);
  const r=analyze(code,item.name,process.env.CODELINGO_PYTHON||'python');
  assert.ok(['ready','partial'].includes(r.status));assert.ok(modules(r).length);
  for(const {block:b} of modules(r))for(const n of flowNodes(b.controlFlow)){assert.ok(n.start>=b.start&&n.end<=b.end);assert.ok(code.split('\n').slice(n.start-1,n.end).join('\n').trim());}
  const ids=r.blocks.flatMap(b=>flowNodes(b.controlFlow)).map(n=>n.guide?.id);
  if(item.name==='flask-json-provider.py'){assert.ok(ids.includes('py.json-read'));assert.ok(ids.includes('py.json-write'));}
  if(item.name==='node-jsonfile.js'){assert.ok(ids.includes('js.json-read'));assert.ok(r.blocks.some(b=>flowNodes(b.controlFlow).some(n=>n.kind==='exception')));}
  report.samples.push({file:folder+'/'+item.name,sha256:item.sha256,status:r.status,language:r.language,modules:modules(r).length,warnings:r.warnings});
 }catch(e){report.failures.push({file:item.name,error:e.message});}
}
fs.mkdirSync(path.join(__dirname,'../.browser-artifacts'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../.browser-artifacts/public-gate.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({build:report.build,samples:report.samples.length,failures:report.failures}));
if(report.failures.length)process.exitCode=1;
