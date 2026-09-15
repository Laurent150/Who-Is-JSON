const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const {parseTalk,settings}=require('../ai-talk');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(process.env.CODELINGO_URL||'http://127.0.0.1:43130');
 await page.locator('#settingsBtn').click();await page.locator('#base').fill('http://127.0.0.1:1/v1');await page.locator('#model').fill('mock');await page.locator('#saveSettings').click();
 await page.locator('#fileInput').setInputFiles({name:'cart.py',mimeType:'text/plain',buffer:Buffer.from('def total(prices):\n    return sum(prices)')});await page.locator('#analyzeBtn').click();await page.locator('#talkTab').click();
 assert.equal(await page.locator('#exportTalk').isDisabled(),true);assert.equal(await page.locator('#audience').inputValue(),'beginner');
 let requests=[],mode='success',pending;
 const draft=parseTalk(JSON.stringify({title:'两件商品一共多少钱',sections:[{title:'从一笔购物说起',text:'假设两件商品分别是 3 元和 5 元，把它们相加就得到 8 元。这是根据代码做的推演。'}],questions:[{question:'结果会显示出来吗？',answer:'这里把金额返回给调用者，没有显示操作。'}]}),'cart.py',settings());
 await page.route('**/api/talk',async route=>{requests.push(route.request().postDataJSON());if(mode==='pending'){pending=route;return;}await route.fulfill({status:mode==='error'?400:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{error:'模拟服务暂时不可用'}:{...draft,note:parseTalk(JSON.stringify(draft),'cart.py',settings(requests.at(-1).options)).note})});});
 await page.locator('#generateTalk').click();await page.locator('.speech-card').waitFor();assert.equal(requests.length,1);assert.equal(requests[0].options.audience,'beginner');assert.match(await page.locator('#speech').innerText(),/8 元/);
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportTalk').click();const download=await downloadPromise;assert.match(fs.readFileSync(await download.path(),'utf8'),/8 元/);
 mode='error';await page.locator('#generateTalk').click();await page.waitForFunction(()=>document.querySelector('#talkStatus').textContent.includes('保留'));assert.match(await page.locator('#speech').innerText(),/8 元/);
 await page.locator('#duration').selectOption('30');assert.equal(await page.locator('.speech-card').count(),0);assert.equal(await page.locator('#exportTalk').isDisabled(),true);
 mode='pending';await page.locator('#generateTalk').click();await page.waitForTimeout(100);await page.locator('#cancelTalk').click();await page.waitForFunction(()=>document.querySelector('#talkStatus').textContent.includes('停止'));assert.equal(await page.locator('#generateTalk').isDisabled(),false);
 if(pending)await pending.fulfill({contentType:'application/json',body:JSON.stringify(draft)}).catch(()=>{});
 await page.waitForTimeout(100);assert.equal(await page.locator('.speech-card').count(),0);
 mode='success';await page.locator('#generateTalk').click();await page.locator('.speech-card').waitFor();assert.equal(requests.at(-1).options.detail,'brief');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 fs.mkdirSync('.browser-artifacts/talk',{recursive:true});await page.screenshot({path:'.browser-artifacts/talk/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.browser-artifacts/talk/desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: AI talk preferences, generation, export, failure preserves draft, settings invalidate, cancellation rejects late reply, retry, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
