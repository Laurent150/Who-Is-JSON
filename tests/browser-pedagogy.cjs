const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43128';
const dir=process.env.CODELINGO_BROWSER_REPORT||path.join(__dirname,'../.browser-artifacts/pedagogy');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);
  report.build=await(await page.request.get(base+'/health')).json();
  async function load(file){
   if(!await page.locator('#source').isVisible())await page.locator('#mapSource').click();
   const buffer=fs.readFileSync(path.isAbsolute(file)?file:path.join(__dirname,file));await page.locator('#fileInput').setInputFiles({name:path.basename(file),mimeType:'text/plain',buffer});
   const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();const data=await(await response).json();
   await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled);assert.equal(data.analysisMeta.buildId,report.build.buildId);assert.equal(data.status,'ready');if(await page.locator('#functionOverview .overview-more>summary').count())await page.locator('#functionOverview .overview-more>summary').click();report.checks.push(path.isAbsolute(file)?'historical-format-restored-control':file);
  }
  await load('fixtures/initialization-lesson.py');
  assert.match(await page.locator('#functionOverview').innerText(),/调用者得到的是新对象/);
  assert.ok(!await page.locator('#functionOverview .guide-professional').evaluate(e=>e.open));
  await page.locator('#functionOverview .guide-professional>summary').click();assert.match(await page.locator('#functionOverview .guide-professional').innerText(),/类型提示/);
  await page.locator('#functionOverview .guide-professional>summary').click();
  await page.locator('#functionOverview .guide-notes>summary').click();assert.match(await page.locator('#functionOverview .guide-evidence').innerText(),/此函数没有提供作者说明/);
  assert.ok(!(await page.locator('body').innerText()).includes('解释依据与尚未确认的内容'));
  await page.locator('#functionOverview').screenshot({path:path.join(dir,'overview.png')});
  await page.locator('.flow-node[data-concept="py.super"]').click();
  assert.match(await page.locator('#nodeStudy .node-explanation').innerText(),/不会另外创建/);
  await page.locator('#nodeStudy .source-parts>summary').click();
  const parts=page.locator('#nodeStudy .source-part');
  const opens=parts.filter({has:page.locator('summary code').filter({hasText:/^\($/})});assert.equal(await opens.count(),2);
  await opens.nth(0).locator('summary').click();assert.match(await opens.nth(0).innerText(),/当前类和 self/);assert.equal(await opens.nth(0).locator('mark').innerText(),'(');
  await opens.nth(1).locator('summary').click();assert.match(await opens.nth(1).innerText(),/调用前面的功能/);
  await page.locator('.flow-workspace').evaluate(el=>el.scrollIntoView({block:'start'}));
  await opens.first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.screenshot({path:path.join(dir,'symbol-breakdown.png')});
  await page.locator('#nodeStudy .source-parts>summary').click();
  for(const summary of await page.locator('#nodeStudy .knowledge-more>summary').all())if(await summary.isVisible())await summary.click();
  const card=page.locator('#nodeStudy .knowledge-card[data-concept="py.super"]');await card.locator(':scope>summary').click();
  assert.equal(await card.locator('.example-walkthrough li').count(),4);assert.match(await card.locator('.example-result').innerText(),/同一个 user/);
  assert.equal(await page.locator('#nodeStudy .guide-example').count(),0,'do not duplicate the annotated example');
  await card.locator('.save-knowledge').click();
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('whoisjson.knowledge.v1')).some(x=>x.card.walkthrough?.length===4)));
  await card.locator('.example-walkthrough').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.getElementById('toast').hidden);await page.screenshot({path:path.join(dir,'annotated-example.png')});
  await page.reload();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('whoisjson.knowledge.v1')).some(x=>x.card.walkthrough?.length===4)));
  await load('holdout/flask-json-provider.py');
  await page.locator('.module-node').filter({hasText:'DefaultJSONProvider.loads'}).click();
  assert.ok(await page.locator('#functionOverview .guide-professional').count());
  await load('holdout/node-jsonfile.js');assert.ok(await page.locator('.flow-node').count());
  await page.setViewportSize({width:390,height:844});await load('fixtures/initialization-lesson.py');await page.locator('.flow-node[data-concept="py.super"]').click();
  await page.locator('#nodeStudy .source-parts>summary').click();await page.locator('#nodeStudy .source-part').first().locator('summary').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.locator('#nodeStudy .source-parts').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.getElementById('toast').hidden);await page.screenshot({path:path.join(dir,'mobile-symbols.png')});
  if(process.env.WHO_PRIVATE_INITIALIZER){
   await page.setViewportSize({width:1440,height:1050});await load(process.env.WHO_PRIVATE_INITIALIZER);
   await page.locator('.module-node').filter({hasText:'CoordinatorAgent.__init__'}).click();
   assert.match(await page.locator('#functionOverview').innerText(),/COORDINATOR_PROMPT/);
   assert.match(await page.locator('#functionOverview').innerText(),/调用者得到的是新对象/);
   await page.locator('#functionOverview').screenshot({path:path.join(dir,'coordinator-overview.png')});
  }
  report.favoritePersisted=true;report.mobile=true;assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1});
