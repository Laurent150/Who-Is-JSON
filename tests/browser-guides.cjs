const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
process.chdir(path.resolve(__dirname,'..'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:43127/?v=0.6.0');
  async function load(file){
   if(await page.locator('#mapSource').isVisible()&&!await page.locator('#source').isVisible())await page.locator('#mapSource').click();
   await page.locator('#fileInput').setInputFiles(file);await page.locator('#analyzeBtn').click();
   await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled&&document.querySelector('.module-node'));
  }
  async function expand(){await page.locator('.configuration-children').evaluateAll(xs=>xs.forEach(x=>x.open=true));}
  for(let pass=0;pass<2;pass++){
   await load('tests/fixtures/user-settings.json');
   assert.match(await page.locator('#documentGuide').innerText(),/不会运行/);
   assert.equal(await page.locator('.module-node').count(),2);
   assert.doesNotMatch(await page.locator('#functionOverview').innerText(),/Get-ChildItem/);
   await page.locator('.module-node').nth(1).click();await expand();
   await page.locator('.config-node[data-path="hooks.PostToolUse.0.hooks.0.command"]').click();
   assert.match(await page.locator('.decoded-value pre').innerText(),/printf "/);
   assert.match(await page.locator('.source-focus').innerText(),/\\"/);
   assert.ok(await page.locator('.knowledge-card[data-concept="json.escape"]').count());
   assert.match(await page.locator('.knowledge-gaps').innerText(),/外部脚本/);
   assert.equal(await page.locator('.flow-arrow').count(),0);
   checks.push('screenshot configuration, exact source, decoded text, known gap: '+pass);
  }
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('#nodeStudy').screenshot({path:'.browser-artifacts/guides-json-detail.png'});
  await page.locator('.flow-workspace').screenshot({path:'.browser-artifacts/guides-json-tree.png'});
  const card=page.locator('.knowledge-card[data-concept="json.escape"]').first();await card.locator('summary').click();await card.locator('.save-knowledge').click();
  await page.reload();await page.locator('#libraryBtn').click();assert.ok(await page.locator('.saved-knowledge[data-concept="json.escape"]').count());await page.keyboard.press('Escape');checks.push('new JSON card persists after refresh');
  await load('tests/fixtures/user-settings.json');await page.locator('.module-node').nth(1).click();await expand();await page.locator('.config-node[data-path="hooks.PostToolUse.0.matcher"]').click();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('#nodeStudy').screenshot({path:'.browser-artifacts/guides-json-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  for(let pass=0;pass<2;pass++)for(const file of ['is-number.js','binary-search.py','java-Factorial.java','vue-ci.yml','typescript-package.json']){
   await load('tests/corpus/'+file);assert.ok((await page.locator('#documentGuide').innerText()).length>20);
   const node=page.locator('.flow-node').first();await node.click();assert.ok((await page.locator('#nodeStudy .node-explanation').innerText()).length>10);
   assert.ok(await page.locator('.source-citation').count());checks.push(file+' pass '+pass);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('.browser-artifacts/guides-report.json',JSON.stringify({checks,errors},null,2));
  console.log('PASS configuration twice, five real projects twice, persistence, source focus and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
