const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43128',dir=path.join(__dirname,'../.browser-artifacts/readability-v072');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);
  report.build=await(await page.request.get(base+'/health')).json();
  async function load(file){
   if(!await page.locator('#source').isVisible())await page.locator('#mapSource').click();
   const buffer=fs.readFileSync(path.isAbsolute(file)?file:path.join(__dirname,file));
   await page.locator('#fileInput').setInputFiles({name:path.basename(file),mimeType:'text/plain',buffer});
   const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();const data=await(await response).json();
   await page.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled);assert.equal(data.analysisMeta.buildId,report.build.buildId);assert.equal(data.status,'ready');report.checks.push(path.isAbsolute(file)?'historical-restored-coordinator':file);return data;
  }
  await load('fixtures/behavior-retry.py');
  const overview=page.locator('#functionOverview');assert.ok((await overview.boundingBox()).height<650,'overview stays compact');
  assert.ok(await overview.evaluate(el=>el.querySelector('.source-parts').nextElementSibling.classList.contains('node-glossary')));
  assert.ok(!await overview.locator('.overview-more').evaluate(el=>el.open));report.overviewRows=await overview.locator(':scope>details').evaluateAll(xs=>xs.map(el=>({type:el.className,height:el.getBoundingClientRect().height,summary:getComputedStyle(el.querySelector('summary')).cssText,padding:getComputedStyle(el).padding})));
  await page.locator('.flow-node[data-concept="py.retry"]').click();
  await page.locator('#nodeStudy .guide-example>summary').click();
  const example=page.locator('#nodeStudy .guide-example pre');
  assert.equal(await example.locator('.reading-line').count(),7);
  assert.deepEqual(await example.locator('.reading-indent-count').allTextContents(),['0空','0空','4空','8空','8空','4空','8空']);
  assert.match(await page.locator('#nodeStudy .guide-example>p').innerText(),/“错误”转成整数.*计数加 1.*“7”.*break/);
  const raw=await example.getAttribute('data-raw');
  assert.equal(await example.locator('.reading-text').allTextContents().then(lines=>lines.join('\n')),raw);
  await page.waitForFunction(()=>document.getElementById('toast').hidden);
  await page.locator('.flow-workspace').evaluate(el=>el.scrollIntoView({block:'start'}));await example.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(dir,'retry-desktop.png')});
  const gap=page.locator('#nodeStudy .knowledge-gaps').first();if(await gap.count())assert.ok(!await gap.evaluate(el=>el.open));
  await overview.locator('.overview-more>summary').click();
  await overview.locator('.guide-source-link').filter({hasText:'把 JSON 文字读成数据'}).click();
  await page.evaluate(()=>{navigator.clipboard.writeText=async value=>{window.__copied=value;};});
  const quote=page.locator('#nodeStudy .source-citation pre');await page.locator('#nodeStudy .source-citation button').click();
  assert.equal(await page.evaluate(()=>window.__copied),await quote.getAttribute('data-raw'));
  assert.match(await quote.locator('mark').allTextContents().then(x=>x.join('')),/json.loads/);
  // Tabs remain tabs; long visual wraps do not create source line numbers.
  await page.evaluate(()=>{const host=document.createElement('section');host.id='code-view-check';host.style.width='230px';host.append(codeView('def f():\n\treturn "a very long line that wraps on a narrow screen"\n'));document.body.append(host);});
  const test=page.locator('#code-view-check');assert.equal(await test.locator('.reading-line').count(),3);assert.equal(await test.locator('.indent-tab').count(),1);
  assert.equal(await test.locator('.reading-text').nth(1).textContent(),'\treturn "a very long line that wraps on a narrow screen"');await test.evaluate(el=>el.remove());
  if(process.env.WHO_PRIVATE_INITIALIZER){
   await load(process.env.WHO_PRIVATE_INITIALIZER);
   await page.locator('.module-node').filter({hasText:'CoordinatorAgent.run'}).click();
   assert.ok((await overview.boundingBox()).height<650);assert.ok((await overview.locator(':scope>p').innerText()).length<85);
   await overview.locator('.node-glossary>summary').click();assert.ok(await overview.locator('.name-item').count()>5);
   await overview.screenshot({path:path.join(dir,'coordinator-names.png')});await overview.locator('.node-glossary>summary').click();
   await overview.locator('.guide-notes>summary').click();assert.ok(await overview.locator('.guide-notes .guide-evidence').count());
   await overview.screenshot({path:path.join(dir,'compact-overview.png')});
  }
  await page.setViewportSize({width:390,height:844});await load('fixtures/behavior-retry.py');await page.locator('.flow-node[data-concept="py.retry"]').click();await page.locator('#nodeStudy .guide-example>summary').click();
  assert.equal(await page.locator('#nodeStudy .guide-example .reading-line').count(),7);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.waitForFunction(()=>document.getElementById('toast').hidden);await page.locator('#nodeStudy .guide-example').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'retry-mobile.png')});
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1});
