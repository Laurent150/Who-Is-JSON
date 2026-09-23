// No paid calls: delay/failure responses are mocked, local parsing remains real.
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={checks:[],errors:[]};
 try{
  const page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(process.env.CODELINGO_URL||'http://127.0.0.1:43132');
  await page.locator('#settingsBtn').click();await page.locator('#base').fill('http://127.0.0.1:1/v1');await page.locator('#model').fill('mock');await page.locator('#saveSettings').click();await page.locator('#useAI').check();
  let mode='wait',pending;
  await page.route('**/api/analyze',async route=>{
   if(!route.request().postDataJSON().ai)return route.continue();
   if(mode==='wait'){pending=route;return;}
   await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'AI 服务返回 401。密钥无效或未填写，请重新配置密钥。'})});
  });
  await page.locator('#emptyDemo').click();await page.locator('#cancelAnalysis').waitFor({state:'visible'});
  assert.ok(await page.locator('.module-node').count());assert.match(await page.locator('#aiProgressText').innerText(),/本地流程已就绪/);
  await page.locator('#cancelAnalysis').click();await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled);
  assert.match(await page.locator('#aiProgressText').innerText(),/已停止/);assert.ok(await page.locator('.module-node').count());
  if(pending)await pending.abort().catch(()=>{});report.checks.push('local result is available while AI waits; cancellation restores controls');
  mode='fail';await page.locator('#mapTab').click();await page.locator('#mapSource').click();await page.locator('#analyzeBtn').click();await page.waitForFunction(()=>document.querySelector('#aiProgressText').textContent.includes('401'));
  assert.ok(await page.locator('.module-node').count());assert.match(await page.locator('#aiProgressText').innerText(),/本地流程仍可阅读/);report.checks.push('AI auth failure preserves local result and actionable error');
  mode='wait';await page.locator('#mapSource').click();await page.locator('#analyzeBtn').click();await page.locator('#cancelAnalysis').waitFor({state:'visible'});
  await page.locator('#fileInput').setInputFiles({name:'new.py',mimeType:'text/plain',buffer:Buffer.from('x = 1')});
  await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled);assert.equal(await page.locator('#results').isVisible(),false);
  if(pending)await pending.abort().catch(()=>{});report.checks.push('new input cancels stale AI work');
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.mkdirSync('.browser-artifacts/ai-states',{recursive:true});fs.writeFileSync('.browser-artifacts/ai-states/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
})().catch(()=>{process.exitCode=1;});
