const {test}=require('node:test'),assert=require('node:assert/strict');
const {cases,plan}=require('./review-acceptance-cases.cjs'),{validatePlan,normalCalls,maxCalls}=require('./review-acceptance-server.cjs');
test('infrastructure retry never resets the budget or retries semantic/protocol failures',()=>{
 const {infrastructureRetry}=require('./review-acceptance-server.cjs');
 const r={jobId:'test',error:'应用进程没有访问 AI 服务的网络权限。请从正常终端启动应用，并检查防火墙或运行环境限制。',traces:[{}]};
 assert.equal(infrastructureRetry([r],'test'),true);assert.equal(infrastructureRetry([r,r],'test'),false);
 assert.equal(infrastructureRetry([{...r,error:'AI 最终复核未通过，请重试或缩小讲解范围。'}],'test'),false);
 assert.equal(infrastructureRetry([{...r,traces:[{model:'responded'}]}],'test'),false);
 assert.equal(infrastructureRetry([{...r,traces:[{text:'response'}]}],'test'),false);
});
test('fixed acceptance plan covers all language/mode/audience combinations and has eight exact pairs within a stated budget',()=>{
 const jobs=validatePlan(plan()),candidate=jobs.filter(j=>j.variant==='candidate');
 assert.equal(jobs.reduce((n,j)=>n+normalCalls(j),0),92);assert.equal(candidate.length,20);
 assert.equal(new Set(candidate.filter(j=>j.task==='talk').map(j=>[j.locale,j.readingMode,j.audience].join('/'))).size,12);
 for(const task of ['token','line'])assert.equal(new Set(candidate.filter(j=>j.task===task).map(j=>[j.locale,j.readingMode].join('/'))).size,4);
 for(const b of jobs.filter(j=>j.variant==='baseline')){
  const c=candidate.find(j=>j.jobId===b.jobId.replace('baseline','candidate'));assert.ok(c);
  const settings=({variant,jobId,...s})=>s;assert.deepEqual(settings(b),settings(c));
 }
 for(const c of cases){assert.ok(c.oracle.length);assert.equal(require('../ai/ai-flow').tokenSource(c.source,c.token).text,c.word);assert.ok(require('../ai/ai-client').selectedSource(c.source,c.selection).code);}
 assert.equal(maxCalls({task:'talk',variant:'candidate'}),6);assert.equal(maxCalls({task:'line',variant:'candidate'}),4);
 assert.throws(()=>validatePlan(jobs.slice(1)),/plan changed/);
});
