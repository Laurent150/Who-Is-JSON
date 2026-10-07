const {mockFinalAudit}=require('./final-audit-mock.cjs');
// Legacy direct pipeline regression; the release default is tested separately.
process.env.WHO_TALK_PIPELINE='direct';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {requestOptions,explainOverview}=require('../ai-client');
const flow=require('../ai-flow'),talk=require('../ai-talk'),knowledge=require('../ai-knowledge');
const config={base:'https://example.org/v1',model:'test'};

test('input assistance follows selected language without translating the supplied source',async()=>{
 const source='// 原注释\nconst 名称 = "原文字串";';
 for(const locale of ['en','zh-CN']){
  let captured;
  await require('../ai-language').identify(source,'unknown.txt',null,{language:'未确定',status:'unsupported',blocks:[]},config,{locale},async(c,m,o)=>{captured={m,o};return '{"language":"unknown","confidence":"low"}';});
  assert.equal(captured.o.locale,locale);
  assert.equal(JSON.parse(captured.m[1].content).source,source);
  const ocr=require('../ai-input-prompts').transcription(locale);
  if(locale==='en'){
   assert.doesNotMatch(captured.m[0].content,/[\u4e00-\u9fff]/);
   assert.doesNotMatch(ocr.system+ocr.user,/[\u4e00-\u9fff]/);
   assert.match(ocr.system,/never translate/);
  }else{assert.match(captured.m[0].content,/只判断源码/);assert.match(ocr.system,/不翻译源码/);}
 }
});
test('experimental source-contract failures have an English UI message',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(fs.readFileSync(require.resolve('../public/locale-en'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../public/i18n'),'utf8'),ctx);
 ctx.WhoI18n.set('en');
 const message=ctx.WhoI18n.t('AI 函数约定格式或源码依据不完整，请重试。');
 assert.match(message,/source-contract analysis/);assert.doesNotMatch(message,/[\u4e00-\u9fff]/);
});
test('overview failure banners translate both HTTP errors and partial-success errors',async()=>{
 const error='应用进程没有访问 AI 服务的网络权限。请从正常终端启动应用，并检查防火墙或运行环境限制。';
 const source=fs.readFileSync(require.resolve('../public/app'),'utf8');
 const run=source.slice(source.indexOf('function languageHelpNotice('),source.indexOf("$('cancelAnalysis').onclick"));
 for(const locale of ['en','zh-CN'])for(const partial of [true,false]){
  const nodes=new Map();let calls=0;
  const ctx=vm.createContext({AbortController,AbortSignal,setInterval:()=>1,clearInterval(){},revision:0,fileName:'sample.js',config:{},activeStructure:null,lineReadingSelection:null,flowReadingStep:null,WhoStructure:{modules:()=>[]},task:async(btn,fn)=>fn(),ensureAI(){},connected:()=>true,render(){},updateFormatHint(){},$:id=>{if(!nodes.has(id))nodes.set(id,{value:'function f(){}',checked:true});return nodes.get(id);},api:async()=>{if(calls++===0)return {language:'JavaScript',blocks:[]};if(!partial)throw Error(error);return {language:'JavaScript',blocks:[],aiOverviewError:error};}});
  vm.runInContext(fs.readFileSync(require.resolve('../public/locale-en'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../public/i18n'),'utf8'),ctx);
  ctx.WhoI18n.set(locale);ctx.uiText=ctx.WhoI18n.t;ctx.uiError=ctx.WhoI18n.error;
  vm.runInContext(run,ctx);await ctx.run();
  const message=nodes.get('aiProgressText').textContent;
  if(locale==='en'){assert.match(message,/cannot access the AI service/);assert.doesNotMatch(message,/[\u4e00-\u9fff]/);}
  else assert.match(message,/应用进程没有访问/);
 }
});
test('beginner term notes are bilingual, language-scoped and never rewrite AI text',()=>{
 const glossary=require('../public/ai-glossary'),text='The caller receives a Promise. If getUser rejects, the call fails.';
 const en=glossary.forText(text,'JavaScript','en'),zh=glossary.forText(text,'JavaScript','zh-CN');
 assert.deepEqual(en.map(x=>x.name),['Promise','rejection']);assert.deepEqual(zh.map(x=>x.name),en.map(x=>x.name));
 assert.match(en[0].meaning,/value on success or an error on failure/);assert.match(zh[0].meaning,/成功/);
 assert.deepEqual(glossary.forText(text,'Python','en'),[]);assert.deepEqual(glossary.forText('promised results','JavaScript','en'),[]);
 assert.equal(text,'The caller receives a Promise. If getUser rejects, the call fails.');
});
test('English teaching prompts preserve source and task contracts in both reading modes',()=>{
 const source='// 中文注释\nconst 用户 = await getUser();';
 const messages=[{role:'system',content:'中文任务'},{role:'user',content:source}];
 for(const task of ['overview','flow','knowledge','talk','ask'])for(const readingMode of ['beginner','standard']){
  const body=requestOptions(config,messages,{explanation:true,locale:'en',task,readingMode}).body;
  assert.equal(body.messages[1].content,source);
  assert.match(body.messages[0].content,/natural English/);
  assert.match(body.messages[0].content,readingMode==='beginner'?/never programmed/:/STANDARD MODE/);
  assert.match(body.messages[0].content,/Do not infer implementation from a function name/);
  assert.match(body.messages[0].content,/additional retries/);
  assert.match(body.messages[0].content,/Python coroutine objects are not JavaScript promises/);
 }
 assert.equal(messages[0].content,'中文任务');
 assert.equal(requestOptions(config,messages,{locale:'en'}).body.messages[0].content,'中文任务');
 assert.match(requestOptions(config,messages,{explanation:true,locale:'untrusted override'}).body.messages[0].content,/中文任务/);
});
test('English flow labels and fallbacks preserve branch polarity, source positions and identifiers',()=>{
 const result={blocks:[{title:'函数',start:1,end:4,controlFlow:[{kind:'condition',start:2,end:2,children:[{start:3,end:3}],otherwise:[{start:4,end:4}]}]}]};
 const before=JSON.stringify(result),graph=flow.scaffold(result,1,'en');
 assert.equal(graph.name,'函数');
 assert.deepEqual(graph.nodes[0].branches.map(b=>b.label),['Condition is true','Condition is false']);
 const explained=flow.attach(graph,JSON.stringify({summary:'Check the input.',nodes:[]}),'en');
 assert.equal(explained.nodes[0].title,'Source line 2');
 assert.equal(explained.nodes[0].branches[1].nodes[0].start,4);
 assert.equal(JSON.stringify(result),before);
 assert.equal(flow.scaffold(result,1).nodes[0].branches[0].label,'条件成立');
});
test('actual model adapters carry English through overview, flow, knowledge and walkthrough',async()=>{
 const source='function double(value) { return value * 2; }',seen=[];
 const result={blocks:[{title:'double',start:1,end:1,code:source,controlFlow:[{kind:'return',start:1,end:1}]}]};
 const sponsoredCall=async body=>{const audit=mockFinalAudit(body);if(audit)return audit;seen.push(body);const prompt=body.messages[0].content;let content;
  if(/REVIEW OUTPUT CONTRACT|FIMI_METHOD3_PARAGRAPH_REVIEW_V1|Review the supplied draft against/.test(prompt))content={corrections:[]};
  else if(prompt.startsWith('Explain the purpose'))content={summary:'Multiply a number by two.',blocks:[{index:0,purpose:'Return twice the supplied number.'}]};
  else if(prompt.startsWith('Explain the supplied graph'))content={summary:'Double the number.',nodes:[{id:'n1',title:'Return twice the value',explanation:'Multiply the supplied number by two.'}]};
  else if(prompt.startsWith('Explain the selected token')||prompt.startsWith('You are writing a FIMI explanation of the selected word')||prompt.startsWith('FIMI_TOKEN_HOVER_V1'))content={kind:'definition',answer:'value is the number supplied to double.'};
  else content={title:'Doubling a number',sections:[{title:'Result',text:'The function returns twice the supplied number.'}],questions:[]};
  return {choices:[{message:{content:JSON.stringify(content)}}]};
 };
 const c={...config,sponsoredCall},options={locale:'en',readingMode:'beginner'};
 const overview=await explainOverview(result,source,'test.js',c,options);assert.equal(overview.blocks[0].code,source);
 await flow.explainFlow(result,source,1,c,options);
 await knowledge.explain(source,{text:'value',line:1,startColumn:16,endColumn:21,sourceLine:source},c,options);
 const script=await talk.generateTalk(source,'test.js',{detail:'brief'},c,options);
 assert.equal(JSON.parse(seen.at(-1).messages[1].content).audience,'Introductory understanding');
 assert.equal(JSON.parse(seen.at(-1).messages[1].content).detail,'Brief');
 assert.match(script.note,/Introductory understanding · Brief/);assert.doesNotMatch(script.note,/[\u4e00-\u9fff]/);
 assert.equal(seen.length,7);
 for(const request of seen){assert.match(request.messages[0].content,/BEGINNER MODE|FIMI_METHOD3_PARAGRAPH_REVIEW_V1|You are writing a FIMI explanation|FIMI_TOKEN_HOVER_V1/);assert.equal(JSON.parse(request.messages[1].content).source,source);}
});
test('browser language defaults survive unavailable storage and Chinese remains reversible',()=>{
 const ctx=vm.createContext({navigator:{language:'en-US'},localStorage:{getItem(){throw Error();},setItem(){throw Error();}},WhoEnglish:{'工作台':'Workspace'}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/i18n'),'utf8'),ctx);
 assert.equal(ctx.WhoI18n.locale,'en');assert.equal(ctx.WhoI18n.t('工作台'),'Workspace');
 ctx.WhoI18n.set('zh-CN');assert.equal(ctx.WhoI18n.t('工作台'),'工作台');
});
test('first use defaults to English even on Chinese systems, while explicit language choices persist',()=>{
 for(const language of ['zh-CN','zh-TW','en-US'])for(const saved of [null,'invalid','en','zh-CN']){
  const ctx=vm.createContext({navigator:{language},localStorage:{getItem:()=>saved,setItem(){}},WhoEnglish:{}});
  vm.runInContext(fs.readFileSync(require.resolve('../public/i18n'),'utf8'),ctx);
  assert.equal(ctx.WhoI18n.locale,saved==='zh-CN'?'zh-CN':'en');
 }
 const ctx=vm.createContext({navigator:{language:'zh-CN'},localStorage:{getItem(){throw Error('blocked');}}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/i18n'),'utf8'),ctx);
 assert.equal(ctx.WhoI18n.locale,'en');
});
test('switching language cancels stale AI work without changing source or saved explanations',async()=>{
 const nodes=new Map([['scopeNotice',{textContent:'代码已变化，请重新生成。'}],['resultMode',{textContent:'等待分析'}],['analyzeBtn',{textContent:'查看整段结构 →'}]]),calls=[],saved={answer:'Original saved explanation'};
 const ctx=vm.createContext({document:{body:{classList:{contains:()=>false}}},busy:false,WhoEnglish:{'代码已变化，请重新生成。':'The code has changed.','等待分析':'Ready to analyze','查看整段结构 →':'Explore code structure →'},uiText:k=>({'专注讲稿':'Focus mode','代码已变化，请重新生成。':'The code has changed.','等待分析':'Ready to analyze','查看整段结构 →':'Explore code structure →'}[k]||k),WhoI18n:{locale:'zh-CN',normalize:v=>v,set(v){this.locale=v;}},revision:1,analysisAbort:{abort(){calls.push('abort');}},resetTalk(){calls.push('talk');},studioReset(){calls.push('studio');},studioSource:'old',applyLanguageUI(){},formatSourceChanged(){calls.push('repair');},meta(){},connection(){},render(){},Event:class{},window:{dispatchEvent(){}},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},current:{mode:'ai',aiOverview:{summary:'旧回答'},blocks:[{code:'const 中文 = 1;',start:1,aiExplanation:{purpose:'旧解释'}}]},analyzedSource:'const 中文 = 1;',saved});
 vm.runInContext(fs.readFileSync(require.resolve('../public/language-switch'),'utf8'),ctx);
 nodes.set('toast',{hidden:false,textContent:'已切换为标准。'});
 await vm.runInContext("changeInterfaceLanguage('en')",ctx);
 assert.equal(nodes.get('toast').hidden,true);assert.equal(nodes.get('toast').textContent,'');
 assert.equal(nodes.get('rehearse').textContent,'Focus mode');assert.deepEqual(calls,['abort','talk','studio','repair']);assert.equal(ctx.current.aiOverview,undefined);
 assert.equal(ctx.current.blocks[0].aiExplanation,undefined);assert.equal(ctx.current.blocks[0].code,'const 中文 = 1;');assert.equal(ctx.analyzedSource,'const 中文 = 1;');assert.equal(saved.answer,'Original saved explanation');assert.equal(nodes.get('scopeNotice').textContent,'The code has changed.');assert.equal(nodes.get('analyzeBtn').textContent,'Explore code structure →');
});
