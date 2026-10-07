const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const design=require('./review-recovery-plan.cjs'),server=require('./review-recovery-server.cjs');
test('recovery preserves all 20 modes and budgets four probes plus 72 normal acceptance calls',()=>{
 const jobs=design.acceptance();assert.equal(jobs.length,20);assert.equal(jobs.reduce((n,j)=>n+design.normalCalls(j),0),72);assert.equal(25+4+72,101);
 assert.equal(new Set(jobs.filter(j=>j.task==='talk').map(j=>[j.locale,j.readingMode,j.audience].join('/'))).size,12);
 for(const task of ['token','line'])assert.equal(new Set(jobs.filter(j=>j.task===task).map(j=>[j.locale,j.readingMode].join('/'))).size,4);
});
test('paired removal changes only foundation material, preserving fixed source, ledger and generation parameters',()=>{
 const body={model:'deepseek-flash',thinking:{type:'disabled'},max_tokens:8192,response_format:{type:'json_object'},messages:[{role:'system',content:'schema\nFIMI_REVIEW_CONTEXT_V1: obligations'},{role:'user',content:JSON.stringify({filename:'file.py',source:'return value',reviewContext:{evidence:['exact quote']}})},{role:'user',content:'Identical fallible ledger'}]};
 const before=structuredClone(body),off=design.withoutFoundation(body);assert.deepEqual(body,before);assert.equal(off.messages[0].content,'schema');assert.deepEqual(JSON.parse(off.messages[1].content),{filename:'file.py',source:'return value'});assert.deepEqual(off.messages[2],body.messages[2]);assert.deepEqual({...off,messages:[]},{...body,messages:[]});assert.throws(()=>design.withoutFoundation(off),/exactly one/);
});
test('recovery reservations include all prior calls, persist before dispatch and cannot reset or exceed 104',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fimi-budget-'));try{const file=path.join(dir,'events.jsonl');fs.writeFileSync(file,Array.from({length:103},(_,i)=>JSON.stringify({ordinal:i+1})).join('\n')+'\n');assert.equal(server.reserve(file,{jobId:'new'}).ordinal,104);assert.throws(()=>server.reserve(file,{jobId:'overflow'}),/104/);assert.equal(fs.readFileSync(file,'utf8').trim().split('\n').length,104);const freeze=path.join(dir,'freeze.json');server.saveOnce(freeze,{version:1});assert.throws(()=>server.saveOnce(freeze,{version:2}),/Frozen/);}finally{for(const name of ['events.jsonl','freeze.json'])if(fs.existsSync(path.join(dir,name)))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
});
