const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const design=require('./review-local-pilot.cjs'),{reserve}=require('./review-local-server.cjs');
test('pilot counts attempts before dispatch, enforces 36 total and four repairs across restarts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fimi-local-budget-')),file=path.join(dir,'events.jsonl');
 try{
  for(let i=0;i<4;i++)reserve(file,{phase:'repair',jobId:'job'+i});
  assert.throws(()=>reserve(file,{phase:'repair'}),/上限/);
  for(let i=4;i<36;i++)reserve(file,{phase:'review',jobId:'job'+i});
  assert.throws(()=>reserve(file,{phase:'final-audit'}),/上限/);
  const events=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);assert.equal(events.length,36);assert.deepEqual(events.map(e=>e.ordinal),Array.from({length:36},(_,i)=>i+1));
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir);}
});
test('editor failure is not upgraded to a candidate; audit input is the exact immutable candidate',()=>{
 const source='function f(x) { return x ?? 0; }',prepared=[{role:'user',content:JSON.stringify({source,filename:'f.js'})}];
 const job={variant:'local',draft:'It always returns x.',prepared,options:{locale:'en',readingMode:'standard',json:false},body:{model:'deepseek-flash',messages:prepared}};
 assert.throws(()=>design.apply(job,'{"edits":[{"field":"f9"}]}'),{code:'AI_REVIEW_PROTOCOL'});
 const candidate=design.apply(job,'{"edits":[]}'),request=design.auditRequest(job,candidate);
 assert.equal(request.input.candidate,candidate);assert.equal(request.input.source,source);assert.equal(job.draft,'It always returns x.');assert.equal(request.input.candidateHash,design.hash(candidate));
});
test('source/format repair never overwrites the original request or inserts evaluator judgments',()=>{
 const job={variant:'local',options:{locale:'en'},body:{model:'deepseek-flash',messages:[{role:'user',content:'Fixed source and draft'}]}},before=structuredClone(job);
 const repaired=design.repairBody(job);assert.deepEqual(job,before);assert.equal(repaired.messages.length,2);assert.equal(repaired.messages[0].content,'Fixed source and draft');assert.doesNotMatch(repaired.messages[1].content,/reference answer|oracle|expected output/);
});
