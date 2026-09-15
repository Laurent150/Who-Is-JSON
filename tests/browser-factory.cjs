const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43130';
const out=path.resolve(process.env.WHO_REPORT_DIR||path.join(__dirname,'../.browser-artifacts/factory'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>report.errors.push(e.message));
  async function submit(code,name){
   await page.goto(base);
   if(name)await page.locator('#fileInput').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(code)});else await page.locator('#source').fill(code);
   const pending=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();return (await pending).json();
  }
  const raw=fs.readFileSync(path.join(__dirname,'fixtures/feedback-llm-factory.md'),'utf8');
  assert.equal((await submit(raw)).status,'partial');report.checks.push('raw mixed Markdown reports partial; no guessed class indentation');
  const code=fs.readFileSync(path.join(__dirname,'fixtures/feedback-llm-factory.py'),'utf8');
  const r=await submit(code,'factory.py');assert.equal(r.status,'ready');report.build=r.analysisMeta;
  await page.locator('.module-node[data-function="make_all"]').click();
  assert.match(await page.locator('#functionOverview').innerText(),/4 组数据/);
  await page.locator('#functionOverview').screenshot({path:path.join(out,'factory-overview.png')});
  const b=r.blocks.find(b=>b.title==='make_all'),first=b.controlFlow[0];
  await page.locator('.flow-details>summary').filter({hasText:'展开 4 个具体步骤'}).click();
  await page.locator('.flow-step[data-start="'+first.start+'"]').click();
  assert.equal(await page.locator('#nodeStudy .guide-arguments li').count(),6);
  assert.match(await page.locator('#nodeStudy .guide-arguments').innerText(),/当前对象保存的 task_id → 交给 task_id/);
  assert.match(await page.locator('#nodeStudy .source-citation pre').getAttribute('data-raw'),/shade=palette.RED/);
  const card=page.locator('#nodeStudy .knowledge-card[data-concept="py.keyword"]');await card.locator(':scope>summary').click();
  assert.match(await card.innerText(),/把 2 交给 count/);
  await card.locator('.code-lessons>summary').click();await card.locator('.reading-links button').filter({hasText:'= ·'}).first().click();
  assert.match(await card.locator('.reading-lesson').innerText(),/参数|保存到左边/);
  await page.locator('#nodeStudy').evaluate(el=>el.scrollTop=0);
  await page.locator('.flow-workspace').screenshot({path:path.join(out,'factory-arguments.png')});
  const ret=b.controlFlow.at(-1);await page.locator('.flow-node[data-start="'+ret.start+'"]').click();
  const tuple=page.locator('#nodeStudy .knowledge-card[data-concept="py.tuple"]');await tuple.locator(':scope>summary').click();
  assert.match(await tuple.innerText(),/result 是 \(3, 5\)/);
  report.checks.push('formatted file: overview, six parameter mappings, source, keyword and tuple lessons');
  await submit(code);assert.equal(await page.locator('.module-node[data-function="make_all"]').count(),1);
  await page.locator('.flow-details>summary').filter({hasText:'展开 4 个具体步骤'}).click();
  await page.setViewportSize({width:390,height:844});await page.locator('.flow-step[data-start="'+first.start+'"]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  assert.equal(await page.locator('#nodeStudy .guide-arguments li').count(),6);
  report.checks.push('formatted paste and 390px layout');assert.deepEqual(report.errors,[]);report.pass=true;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
