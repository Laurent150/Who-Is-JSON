// Static analysis only: submitted and downloaded sources are never imported or executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {analyze}=require('../analyzer'),{modules,flowNodes}=require('../public/structure');
const py=process.env.CODELINGO_PYTHON||'python',root=path.join(__dirname,'..');
const report={date:new Date().toISOString(),checks:[],failures:[],limits:[],engineHashes:{}};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const name of ['analyze.py','python_explain.py','flow_python.py','learning_python.py','beginner.py','analyzer.js','recover_python.py','meaning_python.py','explanation/model.js','public/structure.js','public/structure-ui.js','public/knowledge/python.js','public/file-types.js','public/guide-ui.js','public/style.css','public/index.html','server.js','package.json'])report.engineHashes[name]=sha(fs.readFileSync(path.join(root,name)));
function check(name,fn){try{const detail=fn()||{};report.checks.push({name,pass:true,...detail});}catch(e){report.failures.push({name,error:e.message});}}
for(const folder of ['corpus','holdout']){
 const manifest=require('./'+folder+'/manifest.json');
 for(const item of manifest)check(folder+'/'+item.name,()=>{
  const raw=fs.readFileSync(path.join(__dirname,folder,item.name));assert.equal(sha(raw),item.sha256);assert.ok(fs.existsSync(path.join(__dirname,folder,item.name+'.LICENSE')));
  const source=raw.toString('utf8'),start=Date.now(),r=analyze(source,item.name,py);assert.ok(['ready','partial'].includes(r.status),r.status+': '+r.warnings);assert.ok(r.blocks.length);
  const selected=modules(r),nodes=selected.flatMap(x=>flowNodes(x.block.controlFlow));
  for(const {block:b}of selected)for(const n of flowNodes(b.controlFlow)){assert.ok(n.start>=b.start&&n.end<=b.end&&n.end>=n.start,'invalid source range');assert.ok(source.split('\n').slice(n.start-1,n.end).join('\n').trim());}
  if(item.name==='cpython-queues.py'){
   assert.equal(selected.length,24);
   for(const method of ['put','get']){const b=r.blocks.find(x=>x.owner==='Queue'&&x.title===method),n=flowNodes(b.controlFlow);assert.ok(n.some(x=>x.kind==='loop'));assert.ok(n.some(x=>x.kind==='await'));assert.ok(n.some(x=>x.kind==='exception'&&x.handlers.length));assert.ok(n.some(x=>x.kind==='throw'));}
   assert.ok(r.blocks.some(b=>b.guide?.title==='PriorityQueue._put'));assert.ok(r.blocks.some(b=>b.guide?.title==='LifoQueue._put'));
  }
  if(item.name==='cpython-contextlib.py'){
   const b=r.blocks.find(x=>x.owner==='_GeneratorContextManager'&&x.title==='__exit__');assert.ok(b);const n=flowNodes(b.controlFlow);assert.ok(n.some(x=>x.kind==='exception'&&x.afterSuccess.length));assert.ok(n.some(x=>x.kind==='handler'&&x.label.includes('RuntimeError')));
   assert.ok(r.blocks.some(x=>x.learning?.some(k=>k.gap&&/生成器/.test(k.label))),'generator gaps must remain visible');
  }
  if(r.warnings.length)report.limits.push({name:item.name,warnings:r.warnings});
  return {language:r.language,status:r.status,modules:selected.length,nodes:nodes.length,unknownNodes:nodes.filter(n=>n.kind==='unknown').length,ms:Date.now()-start,semanticScope:folder==='holdout'?'exception/await structure; English docs and generator semantics remain limited':'existing regression expectations; not full business semantics'};
 });
}
for(const item of [['user-agent.py','Python'],['translator.py','Python'],['chat-presentation.txt','JavaScript'],['distance-learning.js','JavaScript'],['user-credentials.sh','Shell'],['user-credentials-copied.txt','Shell'],['user-python.Dockerfile','Dockerfile'],['user-settings.json','JSON']])check('feedback/'+item[0],()=>{
 const source=fs.readFileSync(path.join(__dirname,'fixtures',item[0]),'utf8'),r=analyze(source,item[0],py);assert.equal(r.language,item[1]);assert.ok(r.blocks.length);assert.ok(!['invalid','unsupported'].includes(r.status));return {language:r.language,status:r.status,modules:modules(r).length};
});
for(const [name,source]of [['a.go','package main\nfunc main() {}'],['a.rs','fn main() {}'],['a.rb','puts "hello"']])check('boundary/'+name,()=>{const r=analyze(source,name,py);assert.equal(r.status,'unsupported');assert.equal(r.blocks.length,0);return {language:r.language,status:r.status};});
const target=process.env.CODELINGO_GATE_REPORT||path.join(__dirname,'release-result.json');fs.writeFileSync(target,JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.checks.length,failed:report.failures,limits:report.limits,report:target}));if(report.failures.length)process.exitCode=1;
