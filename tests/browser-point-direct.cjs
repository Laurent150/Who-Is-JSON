// Actual UI -> local backend -> official-parameter path -> local mock provider.
// No paid provider call. The explicit preload redirects only official requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const {mockFinalAudit}=require('./final-audit-mock.cjs'),contract=require('../ai/ai-point-contract'),awaitStyle=require('../ai/ai-point-await-line');
const root=path.resolve(__dirname,'..'),out=process.env.WHO_BROWSER_ARTIFACT_DIR||path.join(root,'.browser-artifacts/point-direct');
const source='async function load(value) {\n  const result = await transform(value);\n  return result;\n}';
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
(async()=>{
 let app,browser,provider,pending,delay=false,fatal;const calls=[],checks=[],requests=[],errors=[];
 try {
  fs.mkdirSync(out,{recursive:true});
  provider=http.createServer(async(req,res)=>{
   try {
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);calls.push(body);
    const audit=mockFinalAudit(body);if(audit){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(audit));return;}
    const data=JSON.parse(body.messages.find(m=>m.role==='user').content);
    const reviewed=data.draftParagraphs||body.messages.some(m=>m.role==='assistant');
    const answer='Mock answer for '+(data.selectedToken?.text||data.selectedSource?.start)+'.';
    const content=body.messages[0].content.includes('"related"')?JSON.stringify({related:true,answer,evidence:[data.selectedSource.code]}):data.draftParagraphs?JSON.stringify({corrections:[]}):data.selectedToken||body.messages[0].content.includes('FIMI_LOCAL_AWAIT_SAVE_V1')?JSON.stringify({kind:'definition',effect:answer}):answer;
    const send=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));};
    if(delay&&!reviewed){delay=false;const held={send,closed:false};pending=held;res.on('close',()=>{held.closed=true;});return;}
    send();
   }catch(e){fatal=e;res.writeHead(500);res.end('{}');}
  });
  const modelPort=await listen(provider),reservation=http.createServer(),port=await listen(reservation);await new Promise(r=>reservation.close(r));
  app=spawn(process.execPath,['--require',path.join(__dirname,'point-provider-mock.cjs'),'server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1',WHO_POINT_MOCK_BASE:'http://127.0.0.1:'+modelPort},windowsHide:true,stdio:'ignore'});
  const url='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{if(req.url().endsWith('/api/ask'))requests.push(req.postDataJSON());});
  await page.goto(url);if(await page.locator('#accountClose').isVisible())await page.locator('#accountClose').click();
  await page.evaluate(async source=>{setCode(source,'load.js');await run();config={base:'https://api.deepseek.com/v1',model:'deepseek-flash',key:'local-mock-only'};connection();setMode('studio');},source);
  for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard']){
   await page.evaluate(({locale,readingMode})=>{changeInterfaceLanguage(locale);changeReadingMode(readingMode);setMode('studio');studioSelect(2,2,false);},{locale,readingMode});
   let start=calls.length;await page.locator('#studioExplainBtn').click();await page.waitForFunction(()=>$('studioExplain').textContent.includes('Mock answer'));
   assert.equal(calls.length-start,1);assert.equal(requests.at(-1).pointReading,true);let body=calls.at(-1);
   assert.equal(body.reasoning_effort,readingMode==='standard'?'high':'low');assert.equal(body.max_tokens,6000);assert.deepEqual(body.thinking,{type:'enabled'});
   const input=JSON.parse(body.messages[1].content);
   assert.equal(body.messages[0].content,readingMode==='beginner'?awaitStyle.prompt(locale,readingMode,'line'):contract.profile(locale,readingMode,'line',undefined,true,input)+(locale==='en'?'\nReturn only the explanation as plain text.':'\n只返回解释正文，不使用JSON包装。'));
   assert.equal(await page.locator('#studioExplain .studio-followups button').count(),1);
   start=calls.length;await page.locator('#studioExplain .studio-followups button').click();await page.waitForFunction(()=>document.querySelector('#studioExplain .studio-followup-answer')?.textContent.includes('Mock answer'));
   assert.equal(calls.length-start,1);assert.equal(requests.at(-1).followupKind,'example');assert.equal(calls.at(-1).max_tokens,1100);
   start=calls.length;await page.locator('#studioExplain .studio-followup-form input').fill('Give an example in simpler words.');await page.locator('#studioExplain .studio-followup-form button').click();
   await page.waitForFunction(()=>document.querySelector('#studioExplain .studio-followup-answer')?.textContent.includes('Mock answer'));
   assert.equal(requests.at(-1).pointReading,undefined);assert.equal(requests.at(-1).followupKind,'question');assert.equal(calls.length-start,1);assert.equal(calls[start].thinking.type,'disabled');
   await page.evaluate(()=>studioSelect(2,3,false));start=calls.length;await page.locator('#studioExplainBtn').click();await page.waitForFunction(()=>$('studioExplain').textContent.includes('Mock answer'));
   assert.equal(calls.length-start,1);assert.equal(JSON.parse(calls.at(-1).messages[1].content).selectedSource.code,source.split('\n').slice(1,3).join('\n'));
   await page.locator('#studioCode [data-line="2"] button').filter({hasText:/^transform$/}).click();await page.waitForFunction(()=>$('studioTokenText').textContent.includes('Mock answer'));
   assert.equal(calls.at(-1).reasoning_effort,'low');assert.equal(requests.at(-1).knowledge,true);await page.locator('#studioTokenClose').click();
   checks.push('line/passage/token and quick/free question isolation '+locale+' '+readingMode);
  }
  // Request body options and nonboolean intent cannot force an internal profile.
  let start=calls.length;await page.evaluate(async()=>{await api('ask',{code:analyzedSource,name:fileName,config,selection:{start:2,end:2},question:'Give an example.',pointReading:'true',pointDraftLow:true,options:{pointDraftLow:true},readingMode:'standard'});});
  assert.equal(calls.length-start,1);assert.equal(calls[start].thinking.type,'disabled');assert.equal(calls[start].max_tokens,1100);checks.push('body profile injection stays on constrained follow-up route');
  await page.evaluate(()=>{changeReadingMode('standard');studioReset();renderStudio();studioSelect(2,2,false);});delay=true;await page.locator('#studioExplainBtn').click();
  for(let i=0;i<100&&!pending;i++)await new Promise(r=>setTimeout(r,20));assert.ok(pending);
  await page.evaluate(()=>studioSelect(3,3,false));await page.locator('#studioExplainBtn').click();await page.waitForFunction(()=>$('studioExplain').textContent.includes('Mock answer for 3.'));
  pending.send();pending=null;await page.waitForTimeout(100);assert.ok((await page.locator('#studioExplain').innerText()).includes('Mock answer for 3.'));checks.push('late line answer does not replace new selection');
  await page.evaluate(()=>{studioReset();renderStudio();studioSelect(2,2,false);});delay=true;await page.locator('#studioExplainBtn').click();
  for(let i=0;i<100&&!pending;i++)await new Promise(r=>setTimeout(r,20));assert.ok(pending);const count=calls.length;
  await page.evaluate(()=>changeReadingMode('beginner'));for(let i=0;i<100&&!pending.closed;i++)await new Promise(r=>setTimeout(r,20));assert.equal(pending.closed,true);pending.send();pending=null;
  assert.equal(calls.length,count);assert.ok(!(await page.locator('#studioExplain').innerText()).includes('Mock answer'));checks.push('mode change cancels provider and rejects late content');
  await page.evaluate(()=>{setMode('studio');studioSelect(2,2,false);});await page.locator('#studioExplainBtn').click();await page.waitForFunction(()=>$('studioExplain').textContent.includes('Mock answer'));checks.push('manual retry delivers after cancellation');
  assert.equal(await page.locator('#source').inputValue(),source);await page.screenshot({path:path.join(out,'point-en.png')});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(out,'point-narrow.png')});
  assert.equal(fatal,undefined);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,mockProvider:true,paidCalls:0,checks,requests:requests.length,modelCalls:calls.length},null,2));console.log(JSON.stringify({pass:true,checks:checks.length,mockCalls:calls.length}));
 }finally{pending?.send();await browser?.close();app?.kill();provider?.closeAllConnections();if(provider)await new Promise(r=>provider.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
