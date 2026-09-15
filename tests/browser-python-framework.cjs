const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CODELINGO_URL||'http://127.0.0.1:43130',out=path.resolve(process.env.WHO_REPORT_DIR||'work/framework-browser');
const corpusRoot=process.env.WHO_CORPUS_ROOT;fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};
try{const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>report.errors.push(e.message));
async function input(code,name){await page.goto(base);await page.locator('#fileInput').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(code)});const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));await page.locator('#analyzeBtn').click();return(await response).json()}
const examples=[['MathModelAgent','backend/app/core/llm/llm_factory.py'],['agent-skills','packages/skills-catalog/skills/(development)/harness-eval/scripts/inventory_extract.py'],['omarchy','test/shell.d/qml-text-format-scan.py'],['claude-plugins-community','tres-finance-plugin/skills/tres-report-create/tests/run_report_matrix.py'],['OpenLogi','.github/scripts/i18n/merge_crowdin_download.py']];
if(corpusRoot)for(const [repo,file] of examples){const full=path.join(corpusRoot,repo,file);if(!fs.existsSync(full))throw Error('Missing browser corpus '+full);const code=fs.readFileSync(full,'utf8'),r=await input(code,path.basename(file));assert.equal(r.status,'ready',repo+': '+r.warnings.join(';'));report.build=r.analysisMeta;
assert.ok(await page.locator('.module-node').count()>0);assert.equal(await page.locator('.flow-view-tabs button[aria-pressed="true"]').innerText(),'框架总览');
const first=page.locator('.flow-overview:not([hidden]) .overview-step').first();await first.click();const raw=await page.locator('#nodeStudy .source-citation pre').getAttribute('data-raw');assert.ok(code.replace(/\r\n/g,'\n').includes(raw),repo+' source quote');
await page.getByRole('button',{name:'逐步展开',exact:true}).click();assert.ok(await page.locator('.flow-detail-view').isVisible());await page.getByRole('button',{name:'框架总览',exact:true}).click();
assert.ok(await page.locator('.flow-overview-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length>=2));
report.checks.push(repo+': import, overview/detail, click, exact source');if(repo==='MathModelAgent')await page.locator('.flow-workspace').screenshot({path:path.join(out,'factory-framework.png')});}
const code='class Box:\n    def twice(self, x):\n        return x * 2\n    def run(self, x):\n        if x > 0:\n            return self.twice(x)\n        return 0\n\ndef outer(x):\n    return x\n';
await input(code,'framework.py');assert.equal(await page.locator('.framework-group').count(),2);
await page.locator('.module-node[data-function="run"]').click();await page.locator('.function-links button').filter({hasText:'twice'}).click();assert.match(await page.locator('#functionOverview').innerText(),/Box.twice/);
await page.locator('.module-node[data-function="run"]').click();await page.locator('.overview-step').first().click();assert.ok(await page.locator('.flow-focus .flow-branches').isVisible());
await page.locator('#structureModules').screenshot({path:path.join(out,'class-framework.png')});
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));report.checks.push('class grouping, local-call navigation, branch expansion, 390px no page overflow');
const unknown=await input('def f():\n    try:\n        work()\n    except* ValueError:\n        handle()\n','group.py');assert.equal(unknown.status,'ready');await page.locator('.overview-step').first().click();assert.match(await page.locator('#nodeStudy').innerText(),/不能套用普通 except/);
assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
