const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const {analyze}=require('../analyzer'),{scaffold,attach}=require('../ai-flow');
const code='def child(x):\n    return x + 1\n\ndef parent(x):\n    if x > 0:\n        total = child(x)\n        total += 2\n        return total\n    return 0\n\nvalue = parent(3)';
const parsed=analyze(code,'nested.py',process.env.CODELINGO_PYTHON||'python');
const out='.browser-artifacts/studio';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={checks:[],errors:[]};
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(process.env.CODELINGO_URL||'http://127.0.0.1:43133');
 await page.locator('#settingsBtn').click();await page.locator('#base').fill('http://127.0.0.1:1/v1');await page.locator('#model').fill('mock');await page.locator('#saveSettings').click();
 let calls=0,tokenCalls=0,pending;
 await page.route('**/api/flow',async route=>{
  calls++;const data=route.request().postDataJSON(),graph=scaffold(analyze(data.code,'nested.py',process.env.CODELINGO_PYTHON||'python'),data.start),notes=[];
  const walk=nodes=>nodes.forEach(n=>{notes.push({id:n.id,title:n.kind==='condition'?'检查输入是否大于零':n.calls?.length?'调用另一个函数处理数值':'处理当前数值',explanation:'这里处理选中范围里的数据，再继续下一步。',example:'假设输入 3，先检查它是否大于 0。'});n.branches.forEach(b=>walk(b.nodes));});walk(graph.nodes);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(attach(graph,JSON.stringify({summary:'先检查输入，调用子函数，再得到结果。',nodes:notes})))});
 });
 await page.route('**/api/ask',async route=>{
  const data=route.request().postDataJSON();
  if(data.token){tokenCalls++;assert.equal(code.split('\n')[data.token.line-1].slice(data.token.startColumn,data.token.endColumn),data.token.text);await route.fulfill({contentType:'application/json',body:JSON.stringify({answer:'+= 把右边的数加到原来的值上，再保存回 total。例如 4 加 2，得到 6。'})});}
  else if(data.selection.start===9){pending=route;}
  else await route.fulfill({contentType:'application/json',body:JSON.stringify({answer:'这一步把结果交给调用这个函数的位置。'})});
 });
 await page.locator('#fileInput').setInputFiles({name:'nested.py',mimeType:'text/plain',buffer:Buffer.from(code)});await page.locator('#analyzeBtn').click();await page.locator('#studioPanel').waitFor({state:'visible'});
 assert.equal(await page.locator('#linePanel').isVisible(),false);assert.equal(await page.locator('#mapPanel').isVisible(),false);
 const parent=page.locator('#studioFlow>.studio-function[data-function="parent"]');await parent.locator(':scope>summary').click();await parent.locator('.studio-generate').click();await parent.locator('.studio-node').first().waitFor();
 await parent.locator('.studio-node').first().click();assert.equal(await page.locator('#studioCode .selected').count(),4);assert.match(await page.locator('#studioExplain').innerText(),/检查输入/);
 await parent.locator('.studio-branch>summary').first().click();const child=parent.locator('.studio-call .studio-function[data-function="child"]');await child.locator(':scope>summary').click();await child.locator('.studio-generate').click();await child.locator('.studio-node').click();assert.equal(await page.locator('#studioCode [data-line="2"]').getAttribute('aria-pressed'),'true');
 await child.locator(':scope>summary').click();await child.locator(':scope>summary').click();assert.equal(calls,2);report.checks.push('three columns, validated flow-to-source, nested calls and cached expansion');
 const token=page.locator('#studioCode [data-line="7"] button').filter({hasText:'+='});await token.click();await page.waitForFunction(()=>document.querySelector('#studioTokenText').textContent.includes('得到 6'));assert.equal(await page.locator('#studioTokenPopup').isVisible(),true);
 await page.waitForFunction(()=>document.querySelector('#toast').hidden);await token.click();await page.screenshot({path:out+'/desktop.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#studioTokenPopup').isVisible(),false);await token.click();assert.equal(tokenCalls,1);await page.locator('#studioTokenClose').click();report.checks.push('operator popup, exact token coordinates, keyboard close and cache');
 await page.locator('#studioCode [data-line="9"]').click();await page.waitForTimeout(100);await page.locator('#studioCode [data-line="2"]').click();await page.waitForFunction(()=>document.querySelector('#studioExplain').textContent.includes('交给'));
 if(pending)await pending.fulfill({contentType:'application/json',body:JSON.stringify({answer:'过期回复'})});await page.waitForTimeout(100);assert.doesNotMatch(await page.locator('#studioExplain').innerText(),/过期/);report.checks.push('stale reply rejected');
 await page.setViewportSize({width:390,height:844});await token.click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));const box=await page.locator('#studioTokenPopup').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await page.screenshot({path:out+'/mobile.png'});report.checks.push('390px layout and popup placement');
 const recursive='def again(x):\n    if x > 0:\n        return again(x - 1)\n    return 0';
 await page.locator('#fileInput').setInputFiles({name:'recursive.py',mimeType:'text/plain',buffer:Buffer.from(recursive)});await page.locator('#analyzeBtn').click();
 const root=page.locator('#studioFlow>.studio-function[data-function="again"]');await root.locator(':scope>summary').click();await root.locator('.studio-generate').click();await root.locator('.studio-branch>summary').first().click();const nested=root.locator('.studio-call .studio-function');await nested.locator(':scope>summary').click();await nested.locator('.studio-function-body').filter({hasText:'递归调用'}).waitFor();assert.match(await nested.innerText(),/再次调用 again/);report.checks.push('new source clears cached graph; recursion stops expanding');
 await page.setViewportSize({width:1600,height:1000});
 const longCode='# '+ 'long comment '.repeat(60)+'\n'+ '\n'.repeat(179)+code;
 await page.locator('#fileInput').setInputFiles({name:'long.py',mimeType:'text/plain',buffer:Buffer.from(longCode)});await page.locator('#analyzeBtn').click();
 const longParent=page.locator('#studioFlow>.studio-function[data-function="parent"]');
 await longParent.waitFor();const callsBefore=calls;
 assert.equal(await longParent.locator(':scope>summary .studio-function-type').innerText(),'函数');
 await longParent.locator(':scope>summary').click();
 await page.waitForFunction(()=>{const host=document.querySelector('#studioCode'),row=host.querySelector('[data-line="184"]'),a=host.getBoundingClientRect(),b=row.getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom;});
 assert.equal(await page.locator('#studioCode [data-line="184"]').getAttribute('aria-pressed'),'true');assert.equal(calls,callsBefore);
 const scroll=await page.evaluate(()=>{const host=document.querySelector('#studioCode');return {sourceOverflow:host.scrollHeight>host.clientHeight,columnOverflow:getComputedStyle(host.parentElement).overflowY,track:getComputedStyle(host,'::-webkit-scrollbar-track').backgroundColor,buttons:getComputedStyle(host,'::-webkit-scrollbar-button').display};});
 assert.equal(scroll.sourceOverflow,true);assert.equal(scroll.columnOverflow,'hidden');assert.equal(scroll.track,'rgba(0, 0, 0, 0)');assert.equal(scroll.buttons,'none');
 await page.locator('.studio-grid').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/scroll-navigation.png'});
 report.checks.push('function type and immediate long-file navigation before AI; single source scroller with transparent track');
 assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
})().catch(()=>process.exitCode=1);
