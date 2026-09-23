// Real page checks with a local server. AI responses are mocked; no remote calls.
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process');
const http=require('node:http'), fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const out=path.resolve(process.env.CODELINGO_BROWSER_REPORT || '.browser-artifacts/line-reading');
fs.mkdirSync(out,{recursive:true});
(async()=>{
    const reservation=http.createServer();
    await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
    const port=reservation.address().port;
    await new Promise(r=>reservation.close(r));
    const server=spawn(process.execPath,[path.resolve('server.js')],{env:{...process.env,CODELINGO_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
    const report={checks:[],errors:[]}; let browser;
    try {
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error('Server did not start')),20000);
            server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
            server.once('error',e=>{clearTimeout(timer);reject(e);});
            server.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});
        });
        browser=await chromium.launch({channel:'msedge',headless:true});
        const page=await browser.newPage({viewport:{width:1600,height:1050}});
        page.on('pageerror',e=>report.errors.push(e.message));
        await page.goto('http://127.0.0.1:'+port);
        await page.locator('#emptyDemo').click();
        await page.locator('#mapTab').click();
        await page.locator('#mapPanel').waitFor({state:'visible'});
        assert.equal(await page.locator('#linePanel').isVisible(),false);
        assert.match(await page.locator('#flowTitle').innerText(),/文件|准备/);
        await page.locator('.module-node[data-function="calculate_total"]').click();
        await page.locator('.overview-step[data-start="3"]').click();
        assert.equal(await page.locator('#linePanel').isVisible(),true);
        assert.equal(await page.locator('#mapPanel').isVisible(),true);
        assert.equal(await page.locator('#lineCode .is-step').count(),3);
        assert.equal(await page.locator('#lineCode .is-selected').count(),1);
        await page.locator('#lineCode [data-line="5"]').click();
        assert.match(await page.locator('#lineExplanation').innerText(),/total 原有的值/);
        assert.match(await page.locator('#flowReadingPurpose').innerText(),/3—5/);
        await page.locator('#lineCode [data-line="6"]').click();
        assert.equal(await page.locator('.overview-step[data-start="6"]').getAttribute('aria-pressed'),'true');
        await page.locator('#flowReadingBack').click();
        assert.equal(await page.locator('#lineCode [data-line="6"]').getAttribute('aria-pressed'),'true');
        await page.screenshot({path:path.join(out,'flow-overview.png'),fullPage:true});
        report.checks.push('entry overview, flow-to-source, parent step scope, reverse link and return navigation');
        await page.evaluate(()=>setMode('line')); // Legacy source view compatibility check.
        await page.locator('#lineCode [data-line="1"]').click();
        assert.ok(await page.locator('.line-token-keyword').count());
        assert.match(await page.locator('#lineExplanation').innerText(),/定义.*calculate_total/);
        await page.locator('#lineBasics summary').filter({hasText:/^def$/}).click();
        assert.match(await page.locator('#lineBasics').innerText(),/定义/);
        await page.locator('#lineCode [data-line="5"]').click();
        assert.match(await page.locator('#lineExplanation').innerText(),/total 原有的值.*加上 price/);
        assert.equal(await page.locator('#lineCode .is-selected').count(),1);
        assert.match(await page.locator('#lineCode [data-line="4"]').getAttribute('class'),/is-context/);
        await page.locator('#lineCode [data-line="5"]').press('ArrowDown');
        assert.match(await page.locator('#lineExplanation').innerText(),/小数点后 2 位/);
        await page.locator('#lineCode [data-line="3"]').click({modifiers:['Shift']});
        assert.equal(await page.locator('#lineCode .is-selected').count(),4);
        report.checks.push('default view, syntax colors, contextual explanations, keyboard and range selection');
        await page.locator('#lineCode [data-line="1"]').click();
        await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
        await page.locator('#mapTab').click();
        assert.equal(await page.locator('#mapPanel').isVisible(),true);
        await page.locator('#talkTab').click();
        assert.equal(await page.locator('#talkPanel').isVisible(),true);
        await page.evaluate(()=>setMode('line')); // Legacy source view compatibility check.
        await page.locator('#lineAiBtn').click();
        assert.equal(await page.locator('#settings').isVisible(),true);
        await page.locator('#base').fill('http://127.0.0.1:1/v1');
        await page.locator('#model').fill('test-only');
        await page.locator('#saveSettings').click();
        let finishRequest, requestStarted;
        const pending=new Promise(resolve=>{requestStarted=resolve;});
        await page.route('**/api/ask',async route=>{
            const body=route.request().postDataJSON();
            assert.match(body.code,/def calculate_total/); assert.match(body.question,/第 1—1 行/);
            requestStarted(); await new Promise(resolve=>{finishRequest=resolve;});
            await route.fulfill({json:{answer:'过期的 AI 解释'}});
        });
        await page.locator('#lineAiBtn').click(); await pending;
        await page.locator('#lineCode [data-line="2"]').click();
        const response=page.waitForResponse(r=>r.url().endsWith('/api/ask'));
        finishRequest(); await response;
        // A second request proves the UI remains available after ignoring the stale response.
        await page.unroute('**/api/ask');
        await page.route('**/api/ask',route=>route.fulfill({json:{answer:'把累计值从零开始准备。'}}));
        assert.equal(await page.locator('#lineAiAnswer').isVisible(),false);
        await page.locator('#lineAiBtn').click();
        await page.locator('#lineAiAnswer').waitFor({state:'visible'});
        assert.match(await page.locator('#lineAiAnswer').innerText(),/AI 解释[\s\S]*累计值/);
        assert.equal(await page.locator('#lineLocal').getAttribute('open'),null);
        report.checks.push('legacy views, AI setup, full context request, stale result rejection and AI attribution');
        // Multiline input is uploaded as text; it is never executed.
        const code='def read():\n    result = tool(\n        "hello",\n        count=2,\n    )\n    return result';
        await page.locator('#fileInput').setInputFiles({name:'multiline.py',mimeType:'text/plain',buffer:Buffer.from(code)});
        await page.locator('#analyzeBtn').click();
        await page.locator('#lineFile').filter({hasText:'multiline.py'}).waitFor();
        await page.locator('#mapTab').click();
        assert.equal(await page.locator('.flow-workspace').isVisible(),false);
        assert.match(await page.locator('#structureNote').innerText(),/没有确定的文件执行入口/);
        await page.locator('.module-node[data-function="read"]').click();
        await page.locator('.overview-step[data-start="2"]').click();
        await page.locator('#lineCode [data-line="3"]').click();
        assert.equal(await page.locator('#lineCode .is-selected').count(),4);
        assert.match(await page.locator('#lineRange').innerText(),/2—5/);
        report.checks.push('multiline statement selection');
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
        await page.waitForFunction(()=>document.getElementById('toast').hidden);
        await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
        assert.deepEqual(report.errors,[]); report.checks.push('390px layout and no page errors');report.pass=true;
    } catch(e) {report.failure=e.stack;throw e;}
    finally {
        if(browser)await browser.close();server.kill();
        fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));
    }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
