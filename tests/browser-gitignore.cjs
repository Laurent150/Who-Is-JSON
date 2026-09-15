const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43130',out=path.resolve(process.env.WHO_REPORT_DIR||path.join(__dirname,'../.browser-artifacts/gitignore'));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>report.errors.push(e.message));
  const code=fs.readFileSync(path.join(__dirname,'fixtures/feedback-ignore.gitignore'),'utf8');
  for(const named of [true,false]){
   await page.goto(base);if(named)await page.locator('#fileInput').setInputFiles({name:'.gitignore',mimeType:'text/plain',buffer:Buffer.from(code)});else await page.locator('#source').fill(code);
   const pending=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();const r=await(await pending).json();
   assert.equal(r.status,'ready');assert.equal(r.language,'Gitignore');report.build=r.analysisMeta;
   await page.locator('.module-node').first().click();assert.equal(await page.locator('.config-node').count(),14);
   await page.locator('.config-node').filter({hasText:'!'}).count();
   await page.locator('.config-node').filter({hasText:'例外：lesson/items/.keep'}).click();
   assert.match(await page.locator('#nodeStudy').innerText(),/上级目录/);
   assert.equal((await page.locator('#nodeStudy .source-citation pre').getAttribute('data-raw')).trim(),'!lesson/items/.keep');
   const card=page.locator('#nodeStudy .knowledge-card[data-concept="gitignore.negation"]');await card.locator(':scope>summary').click();
   assert.match(await card.innerText(),/cache\/\*/);
   await card.locator('.code-lessons>summary').click();await card.locator('.reading-links button').filter({hasText:'! ·'}).click();assert.match(await card.locator('.reading-lesson').innerText(),/例外/);
   report.checks.push(named?'file import + source + knowledge + symbol':'pasted text + source + knowledge + symbol');
  }
  await page.locator('#nodeStudy').evaluate(el=>el.scrollTop=0);await page.locator('.flow-workspace').screenshot({path:path.join(out,'gitignore-rules.png')});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  assert.deepEqual(report.errors,[]);report.pass=true;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
