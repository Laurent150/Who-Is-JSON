// Real local UI and parsers; all model responses are mocked. No paid calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/english-workspace');
const source='# 中文注释保持原样\ndef greet(name):\n    return f"Hello, {name}!"\n\nmessage = greet("FIMI")\nprint(message)';
(async()=>{
 let browser,server;
 try{
  fs.mkdirSync(out,{recursive:true});
  const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const url='http://127.0.0.1:'+port;
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  if(await page.locator('#accountSkip').isVisible())await page.locator('#accountSkip').click();
  await page.locator('#fileInput').setInputFiles({name:'greeting.py',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.locator('#analyzeBtn').click();
  await page.locator('#studioPanel').waitFor({state:'visible'});
  await page.locator('#studioFlow>.studio-function').first().locator(':scope>summary').click();
  assert.equal(await page.locator('#studioExplain h3').innerText(),'Entry point');
  await page.evaluate(()=>{
   const entry=current.blocks.find(b=>b.role==='script-entry');
   studioShowFunction(entry,{summary:'Call greet, save its result and display it.',input:'The literal name FIMI.',output:'A greeting string.'});
  });
  assert.doesNotMatch(await page.locator('#studioExplain').innerText(),/[\u3400-\u9fff]/);
  assert.doesNotMatch(await page.locator('#studioFlow').innerText(),/[\u3400-\u9fff]/);
  assert.equal(await page.locator('#source').inputValue(),source);
  await page.screenshot({path:path.join(out,'entry-en.png')});
  await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));
  await page.evaluate(()=>studioShowFunction(current.blocks.find(b=>b.role==='script-entry'),null));
  assert.equal(await page.locator('#studioExplain h3').innerText(),'文件入口');
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  await page.evaluate(()=>studioShowFunction(current.blocks.find(b=>b.role==='script-entry'),null));
  assert.equal(await page.locator('#studioExplain h3').innerText(),'Entry point');
  assert.equal(await page.locator('#source').inputValue(),source);
  // Exercise the real HTTP failure path and renderers without contacting a model.
  let failure={error:'选中源码范围无效，请重新选择。'};
  for(const route of ['flow','talk','ask'])await page.route('**/api/'+route,r=>failure===null?r.abort('failed'):r.fulfill({status:503,contentType:'application/json',body:JSON.stringify(failure)}));
  await page.evaluate(()=>{config={base:'https://example.invalid',model:'mock'};connection();});
  for(const locale of ['en','zh-CN']){
   await page.evaluate(locale=>changeInterfaceLanguage(locale),locale);
   for(const error of ['选中源码范围无效，请重新选择。','AI 最终复核格式不完整，请重试。','AI 最终复核未通过，请重试或缩小讲解范围。','未识别的上游报错','Unknown upstream details',null]){
    failure=error===null?null:{error};
    const expected=await page.evaluate(error=>WhoI18n.error(error===null?new TypeError('Failed to fetch'):error),error);
    await page.evaluate(()=>{studioCache.clear();studioShowFunction(current.blocks.find(b=>b.role==='script-entry'),null);});
    await page.locator('#studioExplain .studio-generate').click();
    await page.locator('#studioExplain .studio-error').waitFor();
    assert.equal(await page.locator('#studioExplain .studio-error').innerText(),expected);
    await page.evaluate(()=>generateTalk());
    assert.ok((await page.locator('#talkStatus').innerText()).includes(expected));
    await page.evaluate(()=>task($('analyzeBtn'),()=>api('ask',{})));
    assert.equal(await page.locator('#toast').innerText(),expected);
    if(locale==='en')assert.doesNotMatch(await page.locator('#talkStatus').innerText(),/[\u3400-\u9fff]/);
   }
  }
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  assert.equal(await page.locator('#source').inputValue(),source);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,mockedAI:true,paidCalls:0,checks:['real Python entry title before/after AI result','flow and explanation without Chinese system text','Chinese source preserved','English/Chinese/English switching','HTTP known/unknown/network errors in English and Chinese: flow, walkthrough and task toast']},null,2));
  console.log('English workspace browser checks passed (mock AI, real parser and UI).');
 }finally{await browser?.close();server?.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
