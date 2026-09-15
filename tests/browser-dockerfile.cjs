const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
process.chdir(path.resolve(__dirname,'..'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:43127/?v=0.6.1');
  const code=fs.readFileSync('tests/fixtures/user-python.Dockerfile','utf8');
  async function load(code,name){if(await p.locator('#mapSource').isVisible()&&!await p.locator('#source').isVisible())await p.locator('#mapSource').click();await p.locator('#fileInput').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(code)});await p.locator('#analyzeBtn').click();await p.waitForFunction(()=>!document.querySelector('#analyzeBtn').disabled&&document.querySelector('.module-node'));}
  for(let pass=0;pass<2;pass++)for(const [text,name]of [[code,'Dockerfile'],[code.replace(/^#.*$/gm,''),'Dockerfile'],[code,'clip.txt']]){
   await load(text,name);assert.match(await p.locator('#structureSummary').innerText(),/Dockerfile/);assert.equal(await p.locator('.module-node').count(),1);assert.equal(await p.locator('.flow-node').count(),10);
   assert.match(await p.locator('#documentGuide').innerText(),/1 个 FROM/);assert.match(await p.locator('#flowLegend').innerText(),/CMD/);
   await p.locator('.flow-node').filter({hasText:'记下容器启动时的默认命令'}).click();assert.match(await p.locator('.node-explanation').innerText(),/制作镜像时不会/);
   assert.match(await p.locator('.decoded-value').innerText(),/启动参数/);assert.ok(await p.locator('.source-focus').count());
   if(text===code){assert.equal(await p.locator('.author-notes').count(),1);await p.locator('.author-notes summary').click();assert.match(await p.locator('.author-notes').innerText(),/系统 Python/);}
   checks.push(name+' '+(text===code?'Chinese':'no comments')+' pass '+pass);
  }
  await p.waitForFunction(()=>document.getElementById('toast').hidden);
  await p.locator('#nodeStudy').screenshot({path:'.browser-artifacts/docker-startup.png'});
  await p.locator('.flow-node').filter({hasText:'先准备依赖，暂不安装项目本身'}).click();assert.match(await p.locator('.node-explanation').innerText(),/跳过项目/);assert.equal(await p.locator('.source-focus').count(),2);
  await p.locator('.flow-workspace').screenshot({path:'.browser-artifacts/docker-flow.png'});
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('#nodeStudy').screenshot({path:'.browser-artifacts/docker-mobile.png'});
  assert.ok(await p.locator('.knowledge-card[data-concept="docker.cache"]').count());
  await p.setViewportSize({width:1440,height:1000});
  await load('# 中文注释\ndef greet(name):\n    return name\n','sample.py');assert.match(await p.locator('#structureSummary').innerText(),/Python/);assert.ok(await p.locator('.flow-node').count());
  assert.deepEqual(errors,[]);fs.writeFileSync('.browser-artifacts/docker-report.json',JSON.stringify({checks,errors,mobile:true,pythonComment:true},null,2));
  console.log('PASS Dockerfile Chinese/no-comments/unnamed twice, phase boundaries, exact spans, mobile and Python comments.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
