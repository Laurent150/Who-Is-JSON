const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43128';
const dir=process.env.CODELINGO_BROWSER_REPORT||path.join(__dirname,'../.browser-artifacts/semantics');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={checks:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);
  report.build=await(await page.request.get(base+'/health')).json();
  async function load(file){
   if(!await page.locator('#source').isVisible())await page.locator('#mapSource').click();
   const buffer=fs.readFileSync(path.join(__dirname,file));
   await page.locator('#fileInput').setInputFiles({name:path.basename(file),mimeType:'text/plain',buffer});
   const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));
   await page.locator('#analyzeBtn').click();const r=await(await response).json();
   await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled);
   await page.locator('#mapTab').click();
   if(!await page.locator('#functionOverview').count())await page.locator('.module-node').first().click();
   if(file==='fixtures/behavior-retry.py')await page.locator('.module-node[data-function="read_order"]').click();
   await page.locator('#legacyStudy').evaluate(e=>e.open=true);

   assert.equal(r.analysisMeta.inputSha256,crypto.createHash('sha256').update(buffer).digest('hex'));
   assert.equal(r.analysisMeta.buildId,report.build.buildId);
   assert.equal(r.status,'ready');if(await page.locator('#functionOverview .overview-more>summary').count())await page.locator('#functionOverview .overview-more>summary').click();report.checks.push({file,identity:r.analysisMeta,status:r.status});return r;
  }
  await load('fixtures/behavior-retry.py');
  assert.match(await page.locator('#functionOverview').innerText(),/3 次（包括第一次）/);
  const entry=page.locator('#functionOverview .guide-source-link').filter({hasText:'把 JSON 文字读成数据'});
  await entry.click();
  assert.match(await page.locator('#nodeStudy').innerText(),/标准库 json/);
  assert.match(await page.locator('#nodeStudy mark').allTextContents().then(x=>x.join('')),/json.loads/);
  assert.ok(await page.locator('.flow-node.selected').count());
  for (const summary of await page.locator('#nodeStudy .knowledge-more:not([open])>summary').all()) if (await summary.isVisible()) await summary.click();
  await page.locator('#nodeStudy .knowledge-card[data-concept="py.json-read"]>summary').click();
  assert.match(await page.locator('#nodeStudy .knowledge-card[data-concept="py.json-read"] pre').innerText(),/count/);
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('#nodeStudy').evaluate(el=>el.scrollTop=0);
  const panel=await page.locator('#nodeStudy').boundingBox(), citation=await page.locator('#nodeStudy .source-citation').boundingBox();
  assert.ok(citation.y>=panel.y && citation.y+citation.height<=panel.y+panel.height,'selected source must be visible near the explanation');
  await page.locator('.flow-workspace').screenshot({path:path.join(dir,'python-json-learning.png')});
  for(const details of await page.locator('#nodeStudy .knowledge-more:not([open])>summary').all())if(await details.isVisible())await details.click();
  const card=page.locator('#nodeStudy .knowledge-card[data-concept="py.json-read"]');
  if(!await card.evaluate(e=>e.open))await card.locator(':scope>summary').click();await card.locator('.save-knowledge').click();
  assert.ok(await page.evaluate(()=>localStorage.getItem('whoisjson.knowledge.v1').includes('py.json-read')));
  await page.reload();assert.ok(await page.evaluate(()=>localStorage.getItem('whoisjson.knowledge.v1').includes('py.json-read')));report.favoritePersisted=true;
  await load('holdout/flask-json-provider.py');
  const fn=page.locator('.module-node').filter({hasText:'DefaultJSONProvider.loads'});await fn.click();await page.locator('#functionOverview .overview-more>summary').click();
  await page.locator('#functionOverview .guide-source-link').filter({hasText:'把 JSON 文字读成数据'}).click();
  assert.match(await page.locator('#nodeStudy').innerText(),/kwargs/);
  await load('holdout/node-jsonfile.js');
  await page.locator('.module-node[data-function="readFileSync"]').click();if(await page.locator('#functionOverview .overview-more>summary').count())await page.locator('#functionOverview .overview-more>summary').click();
  await page.locator('#functionOverview .guide-source-link').filter({hasText:'把 JSON 文字读成数据'}).click();
  assert.match(await page.locator('#nodeStudy').innerText(),/reviver/);
  assert.ok(await page.locator('.flow-exception').count());
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('#nodeStudy').evaluate(el=>el.scrollTop=0);
  await page.locator('.flow-workspace').screenshot({path:path.join(dir,'javascript-holdout.png')});
  await page.setViewportSize({width:390,height:844});await load('fixtures/behavior-retry.py');
  await page.locator('#functionOverview .guide-source-link').filter({hasText:'把 JSON 文字读成数据'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  for (const summary of await page.locator('#nodeStudy .knowledge-more:not([open])>summary').all()) if (await summary.isVisible()) await summary.click();
  await page.locator('#nodeStudy .knowledge-card[data-concept="py.json-read"]>summary').click();
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('#nodeStudy').evaluate(el=>{el.scrollTop=0;el.scrollIntoView({block:'start'});});
  await page.screenshot({path:path.join(dir,'mobile-learning.png')});
  report.mobile=true;assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{
  fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
