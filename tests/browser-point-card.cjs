// Actual page interactions with intercepted AI/account responses. No paid calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.WHO_BROWSER_ARTIFACT_DIR||path.join(root,'.browser-artifacts/point-card');
const source='function calculateCart(items, discountRate = 0) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price;\n  }\n  return total * (1 - discountRate);\n}';
const longAnswer='The word `function` starts a named operation called `calculateCart`.\n\n'+Array(8).fill('The body works with `items` and `discountRate`, then returns the computed total.').join('\n\n');
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
(async()=>{
 let app,browser;const checks=[],errors=[],calls=[];fs.mkdirSync(out,{recursive:true});
 try{
  const reservation=http.createServer(),port=await listen(reservation);await new Promise(r=>reservation.close(r));
  app=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},windowsHide:true,stdio:'ignore'});
  const url='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/account/**',route=>route.fulfill({json:{enabled:true,provider:'cloudbase',emailEnabled:true,githubEnabled:false,libraryEnabled:false,trialEnabled:true}}));
  let held=null,delay=false,failNext=false;
  await page.route('**/api/ask',async route=>{
   const body=route.request().postDataJSON();calls.push(body);
   const answer=body.token?longAnswer:'This line reads the current source.\n\n'+longAnswer;
   const send=()=>route.fulfill(failNext?(failNext=false,{status:503,json:{error:'请求未完成。'}}):{json:{answer}});
   if(delay){delay=false;held=send;}else await send();
  });
  await page.goto(url);await page.locator('#account').waitFor({state:'visible'});
  assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#interfaceLanguage').inputValue(),'en');assert.equal(await page.locator('#accountEmailLogin').isVisible(),true);
  await page.locator('#accountClose').click();await page.reload();await page.locator('#account').waitFor({state:'visible'});await page.locator('#accountClose').click();checks.push('fresh startup defaults to English; dismissed login prompt returns on next unsigned launch');
  await page.evaluate(async code=>{setCode(code,'cart.js');await run();config={base:'http://127.0.0.1:1',model:'mock'};connection();setMode('studio');},source);
  const token=page.locator('#studioCode [data-line="1"] button').filter({hasText:/^function$/}),popup=page.locator('#studioTokenPopup');
  const waitAnswer=()=>page.waitForFunction(()=>$('studioTokenText').textContent.includes('named operation'));
  const below=async anchor=>{
   const a=await anchor.boundingBox(),p=await popup.boundingBox(),viewport=page.viewportSize();
   assert.ok(p.y>=a.y+a.height+6,JSON.stringify({a,p}));assert.ok(p.y+p.height<=viewport.height-10,JSON.stringify({p,viewport}));assert.ok(p.x>=10&&p.x+p.width<=viewport.width-10);
  };
  await token.click();await waitAnswer();await below(token);assert.equal(calls.length,1);
  assert.ok(await popup.evaluate(p=>p.scrollHeight>p.clientHeight));await page.screenshot({path:path.join(out,'desktop-below-token.png')});checks.push('long word explanation opens below source and scrolls inside the card');
  await page.locator('#studioFile').click();assert.equal(await popup.isVisible(),true);await page.keyboard.press('Escape');assert.equal(await popup.isVisible(),true);
  await page.evaluate(()=>{$('studioCode').scrollLeft=20;window.scrollBy(0,15);});assert.equal(await popup.isVisible(),true);
  await page.setViewportSize({width:1300,height:900});assert.equal(await popup.isVisible(),true);checks.push('outside click, Escape, scroll and resize do not dismiss the card');
  const before=await popup.boundingBox(),header=await page.locator('#studioTokenHeader').boundingBox();
  await page.mouse.move(header.x+80,header.y+18);await page.mouse.down();await page.mouse.move(header.x-60,header.y-22,{steps:8});await page.mouse.up();
  const moved=await popup.boundingBox();assert.ok(moved.x<before.x-100);assert.ok(moved.y<before.y-25);
  await page.locator('#studioFile').click();assert.equal(await popup.isVisible(),true);await page.locator('#studioTokenClose').click();assert.equal(await popup.isVisible(),false);checks.push('title drag moves the card; only its close control dismisses it during reading');
  await token.click();await waitAnswer();assert.equal(calls.length,1);await below(token);await page.locator('#studioTokenClose').click();
  delay=true;const symbol=page.locator('#studioCode [data-line="1"] button').filter({hasText:/^\($/});await symbol.click();await page.waitForFunction(()=>studioPendingAnswers.size===1);await symbol.click();assert.equal(calls.length,2);
  await page.locator('#studioTokenClose').click();await held();held=null;await page.waitForFunction(()=>studioPendingAnswers.size===0);assert.equal(await popup.isVisible(),false);await symbol.click();await waitAnswer();assert.equal(calls.length,2);await below(symbol);checks.push('completed and in-flight repeated token reads reuse one request, including close before completion');
  await page.locator('#studioTokenClose').click();const line=page.locator('#studioCode [data-line="2"] .studio-line-number');
  delay=true;await line.click();await page.waitForFunction(()=>studioPendingAnswers.size===1);await line.click();assert.equal(calls.length,3);await held();held=null;await waitAnswer();await below(line);await page.locator('#studioTokenClose').click();await line.click();await waitAnswer();assert.equal(calls.length,3);checks.push('line reading uses the same anchored card and pending/completed cache');
  await page.locator('#studioTokenClose').click();await page.evaluate(()=>{config={};window.WhoTrial={enabled:true};studioIdentity();});await token.click();await waitAnswer();const count=calls.length;await page.locator('#studioTokenClose').click();
  await page.evaluate(()=>{window.WhoTrial={enabled:false};connection();});await token.click();await waitAnswer();assert.equal(calls.length,count);checks.push('temporary trial unavailability preserves already generated content without a new request');
  await page.locator('#studioTokenClose').click();await page.evaluate(()=>{config={base:'http://127.0.0.1:1',model:'mock'};connection();});
  failNext=true;await symbol.click();await page.waitForFunction(()=>$('studioTokenText').textContent.includes('did not complete'));assert.doesNotMatch(await page.locator('#studioTokenText').innerText(),/[\u3400-\u9fff]/u);const failures=calls.length;await symbol.click();await waitAnswer();assert.equal(calls.length,failures+1);checks.push('failed response is not cached and explicit retry is possible');
  await page.locator('#studioTokenClose').click();await page.setViewportSize({width:390,height:844});await token.click();await waitAnswer();await below(token);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(out,'mobile-below-token.png')});checks.push('390px card stays below the target and inside the viewport');
  await page.locator('#studioTokenClose').click();await page.setViewportSize({width:1440,height:800});
  await page.evaluate(async code=>{config={};setCode(code,'long-cart.js');await run();config={base:'http://127.0.0.1:1',model:'mock'};connection();setMode('studio');},source+'\n'+Array(50).fill('// More source').join('\n')+'\nconst finalValue = 1;');
  const bottomToken=page.locator('#studioCode button').filter({hasText:/^finalValue$/});await bottomToken.click();await waitAnswer();await below(bottomToken);checks.push('a source token near the viewport bottom is revealed before placing the card below');
  await page.evaluate(()=>$('studioCode').scrollTop=0);await page.waitForTimeout(100);const floating=await popup.boundingBox();assert.ok(floating.y>=10&&floating.y+floating.height<=810);assert.equal(await popup.isVisible(),true);checks.push('scrolling the selected source out of view keeps the card visible');
  await page.locator('#studioTokenClose').click();await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));await page.reload();await page.locator('#account').waitFor({state:'visible'});assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');checks.push('explicit language choice is remembered on later startup');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,checks,requests:calls.length,paidModelCalls:0,errors},null,2));console.log(JSON.stringify({pass:true,checks:checks.length,requests:calls.length,paidModelCalls:0}));
 }finally{await browser?.close();app?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
