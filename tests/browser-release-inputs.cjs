// Real page, file chooser, local parser and local OCR; AI vision response mocked.
// No real email or paid model calls.
// OS file drops and screenshot clipboard input are represented by browser events
// carrying real File objects; this does not claim an OS clipboard integration test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.FIMI_INPUT_REPORT||path.join(root,'.browser-artifacts/release-inputs/browser'));
fs.mkdirSync(out,{recursive:true});
const source='// 原始文件测试：保留中文与缩进\n\nfunction totalFor(items) {\n    let total = 0;\n    for (const item of items) {\n        total += item.price * item.quantity;\n    }\n    return total;\n}\n\nconst order = [{ name: "杯子", price: 12, quantity: 2 }];\nconsole.log(totalFor(order));';
const imageSource='function sum(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n    return total;\n}';
const report={checks:[],errors:[],unexpectedRequests:[],ocr:[],paidCalls:0,realEmailSent:false,inputSimulation:'real file chooser; File-backed drop and paste events; real local OCR'};
let browser,server,page,visionRequest=null;
(async()=>{
 try{
  const port=await new Promise(resolve=>{const net=require('node:net').createServer();net.listen(0,'127.0.0.1',()=>{const p=net.address().port;net.close(()=>resolve(p));});});
  const url='http://127.0.0.1:'+port,env={...process.env,CODELINGO_PORT:String(port)};delete env.WHO_CLOUD_DISABLED;
  server=spawn(process.execPath,['server.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  server.stderr.on('data',data=>fs.appendFileSync(path.join(out,'server.stderr.log'),data));
  let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'local server ready');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  await context.addInitScript(()=>localStorage.setItem('whoisjson.locale','zh-CN'));
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.message));
  const analyses=[];
  await page.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin!==url){report.unexpectedRequests.push(u.origin);return route.abort();}
   if(u.pathname.startsWith('/api/account/')&&!u.pathname.endsWith('/status')){
    const operation=u.pathname.split('/').at(-1);
    if(operation==='email-start')return route.fulfill({json:{ticket:'local-ui-check'}});
    if(operation==='email-cancel')return route.fulfill({json:{ok:true}});
    report.unexpectedRequests.push(u.pathname);return route.fulfill({status:400,json:{error:'请求未完成。'}});
   }
   if(u.pathname==='/api/analyze'){
    const body=request.postDataJSON();analyses.push(body);
    if(body.ai||body.identifyLanguage){report.unexpectedRequests.push('unexpected AI analysis');return route.abort();}
   }
   if(['/api/ask','/api/flow','/api/module','/api/module-reading','/api/talk'].includes(u.pathname)){
    report.unexpectedRequests.push(u.pathname);return route.abort();
   }
   if(u.pathname==='/api/ocr'&&request.postDataJSON().ai){
    visionRequest=request.postDataJSON();return route.fulfill({json:{code:imageSource,method:'AI vision mock'}});
   }
   return route.continue();
  });
  await page.goto(url);await page.locator('#account[open]').waitFor();
  assert.equal(await page.locator('#accountCloudbaseNotice').innerText(),'登录赠送AI试用额度，也可自行配置服务');
  assert.equal(await page.locator('#accountSkip').count(),0);assert.equal(await page.locator('#useAI').count(),0);
  assert.equal(await page.locator('#accountGithub').isVisible(),false);
  await page.locator('#accountEmailAddress').fill('ui-check@example.com');await page.locator('#accountEmailSend').click();
  await page.locator('#accountEmailCode').waitFor({state:'visible'});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1050});
   const alignment=await page.evaluate(()=>{
    const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {right:r.right,left:r.left,width:r.width};};
    return {send:box('accountEmailSend'),email:box('accountEmailAddress'),confirm:box('accountEmailConfirm'),code:box('accountEmailCode'),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.ok(Math.abs(alignment.send.right-alignment.email.right)<2,JSON.stringify(alignment));
   assert.ok(Math.abs(alignment.confirm.right-alignment.code.right)<2,JSON.stringify(alignment));assert.equal(alignment.overflow,false);
   report.checks.push({check:'email button alignment',width,...alignment});
   await page.screenshot({path:path.join(out,'login-'+width+'.png')});
  }
  await page.locator('#accountClose').click();assert.equal(await page.locator('#localModeNotice').isVisible(),true);
  await page.locator('#interfaceLanguage').selectOption('en');assert.match(await page.locator('#localModeNotice').innerText(),/Local mode provides basic structure/);
  await page.screenshot({path:path.join(out,'local-mode-390-en.png'),fullPage:true});
  await page.locator('#interfaceLanguage').selectOption('zh-CN');await page.setViewportSize({width:1440,height:1050});
  await page.locator('#settingsBtn').click();await page.locator('#base').fill('https://example.invalid/v1');await page.locator('#model').fill('test-model');await page.locator('#key').fill('');await page.locator('#saveSettings').click();
  assert.equal(await page.locator('#localModeNotice').isVisible(),true);assert.match(await page.locator('#connection').innerText(),/本地模式/);
  await page.reload();assert.equal(await page.locator('#localModeNotice').isVisible(),true);
  await page.locator('#settingsBtn').click();await page.locator('#key').fill('not-a-real-key');await page.locator('#saveSettings').click();assert.equal(await page.locator('#localModeNotice').isVisible(),false);
  await page.locator('#settingsBtn').click();await page.locator('#disconnect').click();assert.equal(await page.locator('#localModeNotice').isVisible(),true);
  report.checks.push({check:'local notice fresh, saved credentials missing, connected and disconnected states',pass:true});
  const input=path.join(out,'original-input.js');fs.writeFileSync(input,source);
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('#replaceSource').click();const chooser=await chooserPromise;await chooser.setFiles(input);
  await page.waitForFunction(expected=>document.getElementById('source').value===expected,source);
  assert.equal(await page.locator('#filename').innerText(),'original-input.js');
  const firstAnalysis=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();assert.equal((await firstAnalysis).status(),200);
  await page.locator('#studioPanel').waitFor({state:'visible'});assert.equal(analyses.at(-1).code,source);
  assert.equal(await page.locator('#studioCode .studio-code-row').count(),source.split('\n').length);
  assert.equal(await page.locator('#source').inputValue(),source);
  report.checks.push({check:'original file chooser import, filename, full source and all rows',pass:true,rows:source.split('\n').length});
  await page.screenshot({path:path.join(out,'imported-local-1440.png'),fullPage:true});
  await page.getByRole('button',{name:'修改源码',exact:true}).click();await page.locator('#source').focus();await page.keyboard.press('Control+Home');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');for(let i=0;i<7;i++)await page.keyboard.press('Shift+ArrowDown');
  const selection=await page.locator('#source').evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,text:el.value.slice(el.selectionStart,el.selectionEnd)}));
  assert.match(selection.text,/function totalFor/);
  await page.screenshot({path:path.join(out,'selected-editor.png'),fullPage:true});
  const selectedAnalysis=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#selectionBtn').click();assert.equal((await selectedAnalysis).status(),200);
  await page.waitForFunction(()=>!document.getElementById('selectionBtn').disabled);
  assert.equal(analyses.at(-1).code,source.split('\n').slice(2,9).join('\n'));assert.equal(await page.locator('#studioCode .studio-line-number').first().innerText(),'3');
  assert.equal(await page.locator('#studioCode .studio-line-number').last().innerText(),'9');assert.equal(await page.locator('#source').inputValue(),source);
  report.checks.push({check:'keyboard selection preserves full lines and original line numbers',pass:true,originalLines:[3,9]});
  await page.getByRole('button',{name:'修改源码',exact:true}).click();await page.locator('#source').click();await page.keyboard.press('ArrowLeft');const before=analyses.length;await page.locator('#selectionBtn').click();
  assert.equal(analyses.length,before);assert.match(await page.locator('#toast').innerText(),/请先在代码框里选中/);
  report.checks.push({check:'empty selection gives a clear prompt without sending an analysis',pass:true});
  const fixture=await context.newPage();await fixture.setContent('<style>body{margin:0;background:white}pre{font:18px/1.8 Consolas,monospace;padding:24px;margin:0;display:inline-block;color:#202830;white-space:pre}</style><pre></pre>');
  await fixture.locator('pre').evaluate((el,value)=>{el.textContent=value;},imageSource);
  const png=await fixture.locator('pre').screenshot({path:path.join(out,'code-fixture.png')});await fixture.close();
  for(const method of ['drop','paste']){
   await page.evaluate(({method,bytes})=>{
    const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(bytes)],'code-image.png',{type:'image/png'}));
    document.getElementById('source').dispatchEvent(method==='drop'?new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}):new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
   },{method,bytes:[...png]});
   await page.locator('#preview').waitFor({state:'visible'});
   const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/ocr'),{timeout:130000});await page.locator('#ocrBtn').click();const response=await responsePromise,body=await response.json();
   const entry={method,status:response.status(),exact:body.code===imageSource,code:body.code,warnings:body.warnings,uncertainLines:body.uncertainLines};report.ocr.push(entry);
   fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));assert.equal(response.status(),200,JSON.stringify(body));assert.equal(body.code,imageSource,method+' OCR transcription');
   await page.waitForFunction(expected=>document.getElementById('source').value===expected,imageSource);
   assert.match(await page.locator('#ocrNotice').innerText(),/核对/);assert.equal(await page.locator('#preview').isVisible(),true);
   report.checks.push({check:method+' image accepted and real local OCR returned exact sample code',pass:true});
   await page.screenshot({path:path.join(out,method+'-recognized.png'),fullPage:true});
  }
  const afterOcr=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();const parsed=await(await afterOcr).json();assert.equal(parsed.language,'JavaScript');assert.equal(parsed.status,'ready');
  report.checks.push({check:'recognized code can enter the structure workspace',pass:true});
  await page.getByRole('button',{name:'修改源码',exact:true}).click();
  await page.locator('#ocrAiBtn').click();await page.locator('#settings[open]').waitFor();assert.equal(visionRequest,null);
  await page.locator('#base').fill('https://example.invalid/v1');await page.locator('#model').fill('mock-vision');await page.locator('#key').fill('not-a-real-key');await page.locator('#saveSettings').click();
  const originalImage=await page.locator('#preview').getAttribute('src');await page.locator('#ocrAiBtn').click();
  await page.waitForFunction(()=>document.getElementById('ocrNotice').textContent.startsWith('AI vision mock'));
  assert.equal(visionRequest.image,originalImage);assert.equal(visionRequest.ai,true);assert.equal(visionRequest.config.model,'mock-vision');assert.equal(await page.locator('#source').inputValue(),imageSource);
  await page.setViewportSize({width:390,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(out,'independent-vision-390.png'),fullPage:true});
  report.checks.push({check:'independent AI image button requires connection and preserves original image; response mocked',pass:true});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedRequests,[]);report.pass=true;
 }catch(error){report.failure=error.message;if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();if(server)server.kill();console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,ocr:report.ocr.map(r=>({method:r.method,status:r.status,exact:r.exact})),failure:report.failure}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
