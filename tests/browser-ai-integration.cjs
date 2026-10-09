// Real UI -> local API -> production layers -> local mock provider. No paid API.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.WHO_BROWSER_ARTIFACT_DIR||path.join(root,'.browser-artifacts/integration-20261003/browser');
const source='function echo(value) {\n  return value;\n}';
const ledger={units:[{name:'echo',anchor:'function echo(value)',accepts:'A value.',returns:'The supplied value.',timing:'Returns directly.',paths:[{when:'Called',does:'Return value.',completion:'Value.',failure:'No explicit handler.',anchor:'return value;'}],unknowns:[]}]};
const manuscript=en=>({title:en?'Returning the supplied value':'交回提供的值',sections:[{title:en?'What this code does':'这段代码做什么',text:en?'The function gives the supplied value back to the caller.':'这个函数把收到的值原样交给调用它的位置。'}],questions:[]});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const reply=content=>({choices:[{finish_reason:'stop',message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
(async()=>{
 let app,browser,provider,pending=null,pendingClosed=false,mode='normal',fatal=null;const events=[],checks=[];
 try{
  fs.mkdirSync(out,{recursive:true});
  provider=http.createServer(async(req,res)=>{
   try{
    let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw),system=body.messages[0].content;
    const audit=mockFinalAudit(body);if(audit){
     events.push('final-audit');
     const input=JSON.parse(body.messages[1].content);
     if(mode==='audit-recovery'&&JSON.parse(input.candidate).sections[0].text==='This function returns nothing.'){
      const report=JSON.parse(audit.choices[0].message.content);report.verdict='reject';report.checks.find(c=>c.id==='SOURCE-01').status='fail';
      report.findings=[{rule:'SOURCE-01',field:'f2',quote:'This function returns nothing.',sourceQuote:'return value;',reason:'The return expression gives back value.'}];audit.choices[0].message.content=JSON.stringify(report);
     }
     res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(audit));
    }
    let data;for(const m of body.messages.filter(m=>m.role==='user'))try{const p=JSON.parse(m.content);if(typeof p.source==='string'){data=p;break;}}catch{}
    if(system.startsWith('You are writing a FIMI explanation')){
     assert.equal(data.reviewContext,undefined);
     if(data.selectedToken){assert.equal(data.selectedToken.context,undefined);assert.equal(data.question,'Explain the selected value here to an adult with no programming background.');}
     else assert.equal(data.question,'Explain the selected code here to an adult with no programming background.');
    }
    if(system.startsWith('你正在为 FIMI 生成中文')){
     assert.equal(data.reviewContext,undefined);
     if(data.selectedToken){assert.equal(data.selectedToken.context,undefined);assert.equal(data.question,'请解释选中的 value，让一个没有编程背景的成年人能看懂。');}
     else assert.equal(data.question,'请解释选中的代码段，让一个没有编程背景的成年人能看懂。');
    }
    const en=(data?.settings?.locale||data?.reviewContext?.settings.locale)==='en'||system.startsWith('You are writing a FIMI explanation')||system.startsWith('FIMI_TOKEN_HOVER_V1:')||system.startsWith('FIMI_TOKEN_HOVER_V1 / FIMI_BEGINNER_HOVER_V3:')||system.startsWith('FIMI_POINT_READING_V2:')||system.startsWith('FIMI_TOKEN_HOVER_V1 / FIMI_POINT_READING_V2:');let response;
    if(system.startsWith('Build a compact source-contract ledger')){events.push('contracts');assert.equal(data.source,source);response=reply(ledger);}
    else if(data?.sourceContracts&&data?.settings){
     events.push('composition');assert.equal(body.messages.length,2);assert.equal(data.source,source);assert.deepEqual(data.sourceContracts,ledger);
     const value=manuscript(en);if(mode==='empty-extra')value.questions_note=null;
     if(mode==='audit-recovery')value.sections[0].text='This function returns nothing.';
     const doc=JSON.stringify(value);
     if(mode==='pending'){pendingClosed=false;res.on('close',()=>{pendingClosed=true;});pending=()=>res.end(JSON.stringify(reply(doc)));return;}
     response=reply(mode==='truncated'?doc.slice(0,-1):mode==='local-repair'?doc.slice(0,-1)+',}':mode==='model-repair'?doc.replace(',"sections"',' "sections"'):doc);
    }else if(system.startsWith('Repair only missing')||system.startsWith('只修复所给JSON')){
     events.push('format-repair');const damaged=body.messages[1].content;response=reply(damaged.replace(' "sections"',',"sections"'));
    }else if(system.startsWith('FIMI_TALK_RECOVERY_V1')){
     events.push('audit-repair');response=reply({edits:[{field:'f2',quote:'This function returns nothing.',replacement:manuscript(en).sections[0].text,sourceQuote:'return value;',reason:'Restore the actual returned value.'}]});
    }else if(/方法3复核候选V1|FIMI_METHOD3_PARAGRAPH_REVIEW_V1/.test(system)||data?.draftParagraphs){events.push('review');assert.ok(data.draftParagraphs.length);response=reply({corrections:[]});}
    else if(/REVIEW OUTPUT CONTRACT|本次复核输出约定（仅在复核时/.test(system)){events.push('review');response=reply({corrections:[]});}
    else {
     assert.equal(data.source,source);const reviewing=body.messages.some(m=>m.role==='assistant');events.push(reviewing?'review':'point-draft');
     const answer=en?'This step returns the supplied value.':'这一步把收到的值原样交回。';
     if(data.selectedToken){assert.equal(data.selectedToken.text,'value');response=reply({kind:'definition',answer});}
     else {assert.equal(data.selectedSource.code,'  return value;');response=reply(answer);}
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response));
   }catch(error){fatal=error;res.writeHead(500);res.end('{}');}
  });
  const modelPort=await listen(provider),reservation=http.createServer(),port=await listen(reservation);await new Promise(r=>reservation.close(r));
  const url='http://127.0.0.1:'+port;
  app=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1',WHO_TALK_PIPELINE:'contracts',WHO_TALK_COMPOSITION:''},windowsHide:true,stdio:'ignore'});
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(url);if(await page.locator('#accountClose').isVisible())await page.locator('#accountClose').click();
  await page.evaluate(async({source,modelPort})=>{setCode(source,'echo.js');await run();config={base:'http://127.0.0.1:'+modelPort,model:'mock'};connection();setMode('talk');},{source,modelPort});
  for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
   await page.evaluate(({locale,readingMode})=>{changeInterfaceLanguage(locale);changeReadingMode(readingMode);setMode('talk');}, {locale,readingMode});
   for(const audience of ['beginner','peer','review']){
    await page.evaluate(a=>{$('audience').value=a;resetTalk();renderTalk();},audience);assert.equal(await page.locator('#exportTalk').count(),0);
    const start=events.length;await page.locator('#generateTalk').click();await page.locator('#talkStatus[data-ready="true"]').waitFor();
    assert.deepEqual(events.slice(start),['contracts','composition','review']);
    assert.equal(await page.locator('#exportTalk').count(),1);assert.equal(await page.locator('#source').inputValue(),source);
    assert.equal(await page.locator('#qaHeading').isVisible(),false);
    const text=await page.locator('#speech').innerText();assert.ok(text.includes(manuscript(locale==='en').sections[0].text));
    if(locale==='en')assert.doesNotMatch(text,/[\u3400-\u9fff]/);
    checks.push('talk '+locale+' '+readingMode+' '+audience);
   }
   // A real backend format failure stays localized and preserves the last good result.
   mode='truncated';let start=events.length;await page.locator('#generateTalk').click();await page.waitForFunction(()=>!$('generateTalk').disabled);
   assert.deepEqual(events.slice(start),['contracts','composition']);const status=await page.locator('#talkStatus').innerText();
   assert.match(status,locale==='en'?/format|incomplete/i:/格式不完整/);if(locale==='en')assert.doesNotMatch(status,/[\u3400-\u9fff]/);
   assert.ok((await page.locator('#speech').innerText()).includes(manuscript(locale==='en').sections[0].text));mode='normal';
   await page.evaluate(()=>setMode('studio'));await page.evaluate(()=>studioSelect(2,2,false));start=events.length;
   await page.locator('#studioExplainBtn').click();try{await page.waitForFunction(()=>$('studioExplain').textContent.includes(WhoI18n.locale==='en'?'This step returns':'这一步把收到的值'),null,{timeout:5000});}catch(error){throw Error(JSON.stringify({stage:'line',locale,readingMode,fatal:fatal?.message,events:events.slice(start),text:await page.locator('#studioExplain').innerText()}));}
   assert.deepEqual(events.slice(start),readingMode==='beginner'?['point-draft','review']:['point-draft','review','final-audit']);
   start=events.length;await page.locator('#studioCode [data-line="2"] button').filter({hasText:/^value$/}).click();
   await page.waitForFunction(()=>$('studioTokenText').textContent.includes(WhoI18n.locale==='en'?'This step returns':'这一步把收到的值'));
   assert.deepEqual(events.slice(start),readingMode==='beginner'?['point-draft']:['point-draft','review']);await page.keyboard.press('Escape');
   checks.push('localized failure, line and token '+locale+' '+readingMode);
  }
  await page.evaluate(()=>{changeInterfaceLanguage('en');setMode('talk');});
  assert.equal(await page.locator('#toast').isVisible(),false);
  for(mode of ['local-repair','model-repair']){
   const start=events.length;await page.locator('#generateTalk').click();await page.locator('#talkStatus[data-ready="true"]').waitFor();
   assert.deepEqual(events.slice(start),mode==='local-repair'?['contracts','composition','review']:['contracts','composition','format-repair','review']);checks.push(mode+' reaches reviewed UI');
  }
  // Independent talk audits are disabled by product choice. Recovery remains
  // covered by its unit tests, not required on this production browser route.
  for(const locale of ['en','zh-CN'])for(mode of ['empty-extra']){
   await page.evaluate(locale=>changeInterfaceLanguage(locale),locale);
   const start=events.length;await page.locator('#generateTalk').click();await page.locator('#talkStatus[data-ready="true"]').waitFor();
   assert.deepEqual(events.slice(start),['contracts','composition','review']);
   assert.ok((await page.locator('#speech').innerText()).includes(manuscript(locale==='en').sections[0].text));
   assert.equal(await page.locator('#exportTalk').count(),1);checks.push(mode+' delivers '+locale);
  }
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  mode='pending';await page.evaluate(()=>{resetTalk();renderTalk();});const start=events.length;await page.locator('#generateTalk').click();
  for(let i=0;i<100&&!pending;i++)await new Promise(r=>setTimeout(r,25));assert.ok(pending);await page.locator('#cancelTalk').click();
  await page.waitForFunction(()=>!$('generateTalk').disabled);
  // Wait for cancellation to reach the provider before simulating a late reply;
  // clicking Cancel and network delivery are not the same event.
  for(let i=0;i<200&&!pendingClosed;i++)await new Promise(r=>setTimeout(r,25));assert.ok(pendingClosed,'Abort must close the provider request');pending();pending=null;
  await page.waitForTimeout(100);assert.equal(await page.locator('#exportTalk').count(),0);assert.deepEqual(events.slice(start),['contracts','composition']);
  mode='normal';await page.locator('#generateTalk').click();await page.locator('#talkStatus[data-ready="true"]').waitFor();checks.push('cancel blocks late response and retry succeeds');
  const downloadStart=events.length;
  for(const format of ['docx','md']){
   await page.locator('#exportTalk').click();const download=page.waitForEvent('download');await page.locator('[data-format="'+format+'"]').click();await(await download).saveAs(path.join(out,'integrated.'+format));
  }
  assert.equal(events.length,downloadStart);assert.match(fs.readFileSync(path.join(out,'integrated.md'),'utf8'),/The function gives the supplied value/);checks.push('reviewed result exports to Word and Markdown without a model call');
  await page.screenshot({path:path.join(out,'integrated-en.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(out,'integrated-mobile.png'),fullPage:true});
  assert.equal(fatal,null);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,realAppAndBackend:true,mockProvider:true,paidCalls:0,checks,modelPhases:events.length},null,2));console.log(JSON.stringify({pass:true,checks:checks.length,mockCalls:events.length}));
 }finally{pending?.();await browser?.close();app?.kill();provider?.closeAllConnections();if(provider)await new Promise(r=>provider.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
