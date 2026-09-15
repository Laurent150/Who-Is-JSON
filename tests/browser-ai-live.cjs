// Explicit opt-in live checks. Keep credentials outside the repository and reports.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43132';
const key=process.env.WHO_AI_KEY_FILE && fs.readFileSync(process.env.WHO_AI_KEY_FILE,'utf8').trim();
if(!key)throw Error('Set WHO_AI_KEY_FILE to an external/local ignored credential file to opt in.');
const out=path.resolve('.browser-artifacts/ai-live');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={checks:[],errors:[],timings:{}};
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}});page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base);
  await page.locator('#settingsBtn').click();
  await page.locator('#base').fill('https://api.deepseek.com');await page.locator('#model').fill('deepseek-flash');await page.locator('#key').fill(key);await page.locator('#saveSettings').click();
  await page.locator('#useAI').check();
  const source=fs.readFileSync('tests/corpus/binary-search.py','utf8');
  await page.locator('#fileInput').setInputFiles({name:'binary-search.py',mimeType:'text/plain',buffer:Buffer.from(source)});
  const start=Date.now();await page.locator('#analyzeBtn').click();
  await page.locator('#mapTab').click();
  await page.locator('#mapPanel').waitFor({state:'visible',timeout:20000});report.timings.localMs=Date.now()-start;
  const count=await page.locator('.module-node').count();assert.ok(count>2);
  await page.waitForFunction(()=>document.querySelector('#aiProgressText').textContent.includes('AI 用途说明已完成')||document.querySelector('#aiProgressText').textContent.includes('未完成'),null,{timeout:135000});
  const status=await page.locator('#aiProgressText').innerText();assert.match(status,/已完成/,status);
  report.timings.overviewMs=Date.now()-start;assert.equal(await page.locator('.module-node').count(),count);
  report.overview=await page.locator('#documentGuide').innerText();
  await page.locator('.module-node[data-function="bisect_left"]').click();
  report.functionPurpose=await page.locator('.ai-purpose').innerText();
  await page.locator('.ai-lesson>summary').click();report.example=await page.locator('.ai-lesson').innerText();
  assert.ok(await page.locator('#flowCanvas .overview-step').count());report.checks.push('435-line live AI overview preserves local functions and flow');
  await page.locator('#functionOverview').screenshot({path:path.join(out,'function-explanation.png')});
  await page.evaluate(()=>setMode('line')); // Legacy source view compatibility check.
  const line=source.split('\n').findIndex(x=>/mid\s*=/.test(x))+1;assert.ok(line>0);
  await page.locator('#lineCode [data-line="'+line+'"]').click();
  const lineStart=Date.now();await page.locator('#lineAiBtn').click();await page.locator('#lineAiAnswer').waitFor({state:'visible',timeout:130000});
  report.lineAnswer=await page.locator('#lineAiAnswer').innerText();assert.match(report.lineAnswer,/AI 解释/);assert.match(report.lineAnswer,/mid/);assert.doesNotMatch(report.lineAnswer.split('\n').filter(Boolean)[1],/这行.*while/);report.timings.lineMs=Date.now()-lineStart;
  await page.locator('#linePanel').screenshot({path:path.join(out,'line-explanation.png')});report.checks.push('live selected-line explanation');
  await page.locator('#mapTab').click();await page.locator('.ask-more>summary').click();
  await page.locator('#question').fill('bisect_left 找不到目标值时返回什么？请用 [1, 3, 5] 查找 4 举例，解释位置编号从哪里开始。');
  const askStart=Date.now();await page.locator('#askBtn').click();await page.locator('#answer').waitFor({state:'visible',timeout:130000});
  report.answer=await page.locator('#answer').innerText();report.timings.askMs=Date.now()-askStart;assert.match(report.answer,/2/);report.checks.push('live follow-up with insertion-point example');
  await page.locator('#talkTab').click();const talkStart=Date.now();await page.locator('#generateTalk').click();await page.locator('#speech .speech-card').first().waitFor({state:'visible',timeout:130000});report.talk=await page.locator('#speech').innerText();assert.match(report.talk,/查找|二分/);report.timings.talkMs=Date.now()-talkStart;report.checks.push('live complete AI-authored talk');
  // Self-authored teaching image only. OCR does not execute its contents.
  const imagePage=await browser.newPage({viewport:{width:650,height:160}});
  await imagePage.setContent('<pre style="font:24px monospace;padding:20px">total = 2 + 3\nprint(total)</pre>');
  const png=await imagePage.screenshot();await imagePage.close();
  await page.locator('#fileInput').setInputFiles({name:'teaching.png',mimeType:'image/png',buffer:png});
  const ocrStart=Date.now();await page.locator('#ocrBtn').click();
  await page.waitForFunction(()=>!document.querySelector('#ocrBtn').disabled,null,{timeout:130000});
  report.ocr=await page.locator('#source').inputValue();assert.match(report.ocr,/total\s*=\s*2\s*\+\s*3/);assert.match(report.ocr,/print\(total\)/);report.timings.ocrMs=Date.now()-ocrStart;report.checks.push('live vision OCR on a teaching image');
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}
 finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks,timings:report.timings,failure:report.failure}));await browser.close();}
})().catch(()=>{process.exitCode=1;});
