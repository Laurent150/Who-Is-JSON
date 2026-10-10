const {test}=require('node:test'),assert=require('node:assert/strict');
const {plan}=require('./talk-eval-server.cjs');
test('manual talk evaluation cannot fan out beyond six explicit valid jobs',()=>{
 const cases=[{id:'a'},{id:'b'},{id:'c'}],body={samples:['a','b'],audience:'all',locale:'zh-CN',readingMode:'beginner',detail:'standard',coverage:'full'};
 assert.equal(plan(body,cases).length,6);assert.equal(plan({...body,audience:'review',samples:['b']},cases).length,1);
 assert.equal(plan({...body,pipeline:'contracts'},cases)[0].pipeline,'contracts');
 assert.throws(()=>plan({...body,pipeline:'unknown'},cases),/Invalid pipeline/);
 for(const bad of [{samples:[]},{samples:['a','a']},{samples:['a','b','c']},{samples:['unknown']},{audience:'nontechnical'},{locale:'xx'},{detail:'unknown'}])assert.throws(()=>plan({...body,...bad},cases),/Invalid/);
});
test('model comparison is isolated, preserves the opaque connection, and reserves at most six attempts',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fimi-model-budget-'));
 const file=path.join(dir,'model-comparison.json'),{prepare}=require('./talk-eval-runtime.cjs');
 const config={base:'https://api.deepseek.com',model:'deepseek-flash',key:'test-only-placeholder'};
 const env={WHO_TALK_EVAL_TRACE:'1',WHO_CLOUD_DISABLED:'1',WHO_TALK_EVAL_OUTPUT:dir};
 try{
  fs.writeFileSync(file,JSON.stringify({enabled:true,model:'deepseek-v4-pro',limit:6,used:0}));
  assert.equal(prepare(config,{}),null);assert.equal(prepare(config,{...env,WHO_CLOUD_DISABLED:'0'}),null);
  assert.throws(()=>prepare({...config,base:'https://example.org'},env),/existing personal/);
  for(let i=1;i<=6;i++){
   const result=prepare(config,env);assert.equal(result.config.key,config.key);assert.equal(result.config.base,config.base);
   assert.equal(result.config.model,'deepseek-v4-pro');assert.equal(config.model,'deepseek-flash');assert.equal(result.metadata.comparisonAttempt,i);
   result.options.onProviderModel('reported-model');assert.deepEqual(result.metadata.reportedModels,['reported-model']);
   assert.doesNotMatch(JSON.stringify(result.metadata)+fs.readFileSync(file,'utf8'),/test-only-placeholder/);
  }
  assert.throws(()=>prepare(config,env),/limit reached/);
  fs.writeFileSync(file,JSON.stringify({enabled:false,model:'deepseek-v4-pro',limit:6,used:6}));
  assert.equal(prepare(config,env).options.onModelText,undefined);
  fs.writeFileSync(file,JSON.stringify({enabled:false,model:'deepseek-v4-pro',limit:6,used:6,captureFlashText:true,introComposition:'purpose-first',asyncFocusRules:true}));
  const observed=prepare(config,env);assert.equal(observed.config,config);
  assert.equal(observed.options.introComposition,'purpose-first');
  assert.equal(observed.options.asyncFocusRules,true);
  observed.options.onProviderModel('deepseek-flash');
  observed.options.onModelText('final ledger text','contracts');
  observed.options.onModelText('final manuscript text','composition');
  const saved=fs.readFileSync(path.join(dir,observed.metadata.observationId+'.json'),'utf8');
  assert.deepEqual(JSON.parse(saved).phases,[{phase:'contracts',text:'final ledger text'},{phase:'composition',text:'final manuscript text'}]);
  assert.doesNotMatch(saved,/test-only-placeholder|https:\/\/|reasoning_content/);
  assert.equal(JSON.parse(fs.readFileSync(file)).used,6);
  assert.equal(prepare({...config,model:'another-model'},env).options.onModelText,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Pro comparison matches Flash reasoning settings without changing ordinary requests',()=>{
 const {requestOptions}=require('../ai/ai-client'),before={trace:process.env.WHO_TALK_EVAL_TRACE,cloud:process.env.WHO_CLOUD_DISABLED};
 const config={base:'https://api.deepseek.com',model:'deepseek-v4-pro'};
 try{
  process.env.WHO_TALK_EVAL_TRACE='1';process.env.WHO_CLOUD_DISABLED='1';
  for(const phase of ['contracts','composition']){
   const options={task:'talk',reviewReasoning:true,usagePhase:phase,json:true,evaluationModelComparison:true};
   const pro=requestOptions(config,[],options).body,flash=requestOptions({...config,model:'deepseek-flash'},[],options).body;
   assert.deepEqual({...pro,model:'deepseek-flash'},flash);
  }
  assert.equal(requestOptions(config,[],{reviewReasoning:true}).body.thinking.type,'disabled');
  process.env.WHO_TALK_EVAL_TRACE='0';
  assert.equal(requestOptions(config,[],{reviewReasoning:true,evaluationModelComparison:true}).body.thinking.type,'disabled');
 }finally{for(const [key,value] of [['WHO_TALK_EVAL_TRACE',before.trace],['WHO_CLOUD_DISABLED',before.cloud]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
