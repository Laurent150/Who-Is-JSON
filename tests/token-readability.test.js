const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestOptions}=require('../ai/ai-client'),knowledge=require('../ai/ai-knowledge');
const expression=require('../ai/ai-expression-review'),audit=require('../ai/ai-final-audit');
const {fieldCatalog}=require('../ai/ai-review-patches');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const marker='FIMI_BEGINNER_TOKEN_V1';
const config={base:'https://example.org/v1',model:'test'};

test('the new token contract is restricted to beginner knowledge in both languages',()=>{
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const task of ['knowledge','ask','flow','overview','talk']){
  const options={locale,readingMode,task,explanation:true};
  const payload=JSON.stringify({source:'const 名称 = "原文 😀";',question:'Keep source unchanged.'});
  const messages=[{role:'system',content:'Original schema'},{role:'user',content:payload}];
  const body=requestOptions(config,messages,options).body;
  const expected=readingMode==='beginner'&&task==='knowledge';
  for(const instruction of [body.messages[0].content,expression.instruction(options,true),audit.instruction(options)])assert.equal(instruction.includes(marker),expected,JSON.stringify(options));
  assert.equal(body.messages[1].content,payload);
  assert.equal(messages[0].content,'Original schema');
  if(expected)assert.doesNotMatch(body.messages[0].content,/80个汉字|roughly 20–60 words/);
 }
 const messages=[{role:'system',content:'Unrelated non-explanation request'}];
 assert.deepEqual(requestOptions(config,messages,{task:'knowledge',readingMode:'beginner'}).body.messages,messages);
});

// Self-authored static source. It is parsed, never executed. Model responses
// below are protocol fixtures: these tests cannot establish teaching quality.
const source='def collect(rows):\n    rejected = []\n    for row in rows:\n        try:\n            int(row["count"])\n        except (KeyError, ValueError) as error:\n            rejected.append(str(error))\n    return rejected\n';
const selectedToken={text:'except',line:6,startColumn:8,endColumn:14,sourceLine:source.split('\n')[5]};
const reply=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
async function run(locale,reject=false,readingMode='beginner'){
 const phases=[],bodies=[];
 const draft={kind:'definition',answer:locale==='en'?'Catch and collect exceptions.':'捕获异常后记录。'};
 const answer=locale==='en'
  ? 'If an item lacks count (KeyError), or its text cannot be read as an integer (ValueError), except runs the code below. It saves the error description in the rejected list, then checks the next item. Other error types are not handled here.'
  : '如果一条记录缺少count这项内容（KeyError），或其中的文字不能转成整数（ValueError），except就让程序执行下面的处理。这里把错误说明记入rejected这个列表，再检查下一条记录。其他类别的错误不由这里处理。';
 const sponsoredCall=async body=>{
  bodies.push(body);
  const phase=phases.at(-1);
  if(phase==='draft')return reply(draft);
  if(phase==='review'){
   if(reject)return reply({corrections:[{id:'p1',value:'',reason:'Invalid empty replacement.'}]});
   return reply({corrections:[{id:'p1',value:answer,reason:'Clarify the handled errors in everyday language.'}]});
  }
  if(phase==='final-audit'){
   const response=mockFinalAudit(body);
   if(reject){
    const result=JSON.parse(response.choices[0].message.content);
    const input=JSON.parse(body.messages[1].content);
    result.verdict='reject';result.checks.find(c=>c.id==='EXPRESSION-01').status='fail';
    result.findings=[{rule:'EXPRESSION-01',field:input.fields[0].field,quote:answer,sourceQuote:'except (KeyError, ValueError) as error:',reason:'Simulated comprehension failure, not a semantic assessment.'}];
    return reply(result);
   }
   return response;
  }
  throw Error('Unexpected additional model call: '+phase);
 };
 try{
  const result=await knowledge.explain(source,selectedToken,{...config,sponsoredCall},{name:'counts.py',locale,readingMode,onModelRequest:(body,phase)=>phases.push(phase)});
  return {result,phases,bodies,answer};
 }catch(error){error.phases=phases;throw error;}
}

for(const locale of ['zh-CN','en'])test(locale+' token stages keep the selected contract without extra calls or source changes',async()=>{
 const {result,phases,bodies,answer}=await run(locale,false,'standard');
 assert.deepEqual(phases,['draft','review']);
 assert.deepEqual(result,{answer});
 for(const body of bodies){
  assert.doesNotMatch(body.messages[0].content,/FIMI_BEGINNER_TOKEN_V1/);
  const input=JSON.parse(body.messages.find(m=>m.role==='user').content);
  assert.equal(input.source,source);assert.deepEqual(input.selectedToken,selectedToken);
  if(body===bodies[0]){assert.equal(input.reviewContext,undefined);continue;}
  assert.equal(input.reviewContext.scope.status,'verified');
  assert.ok(input.reviewContext.checks.some(c=>c.id==='ERROR-01'));
 }

});

test('invalid standard-mode review is blocked without an unchecked draft fallback or final audit',async()=>{
 await assert.rejects(()=>run('en',true,'standard'),error=>{
  assert.equal(error.code,'AI_REVIEW_PROTOCOL');
  assert.deepEqual(error.phases,['draft','review']);return true;
 });
});
