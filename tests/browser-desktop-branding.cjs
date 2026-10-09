const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/desktop-branding');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 let browser,server;
 try{
  const port=await new Promise(resolve=>{const socket=require('node:net').createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
  const url='http://127.0.0.1:'+port;
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},windowsHide:true,stdio:'ignore'});
  let ready=false;
  for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'test server started');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Exercise the welcome dialog without signing in or calling a real cloud / AI service.
  await page.route('**/api/account/status',r=>r.fulfill({json:{enabled:true}}));
  await page.goto(url);
  await page.locator('#account[open]').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('#accountTitle').innerText(),/account/i);
  assert.doesNotMatch(await page.locator('#accountLogin').innerText(),/[\u4e00-\u9fff]/);
  assert.equal(await page.title(),'FIMI · Understand code, step by step');
  const icon=await page.request.get(url+'/favicon.ico?v=fimi-1');
  assert.equal(icon.status(),200);assert.match(icon.headers()['content-type'],/image\/x-icon/);
  assert.deepEqual(await icon.body(),fs.readFileSync(path.join(root,'public/favicon.ico')));
  assert.ok(await page.locator('.fimi-logo img').evaluate(img=>img.complete&&img.naturalWidth>0));
  for(const viewport of [{width:1440,height:900},{width:1229,height:691},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   const box=await page.locator('#account').boundingBox();
   assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'welcome dialog fits');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,'login-'+viewport.width+'.png')});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#accountClose').click();
  const source='// 中文 source must stay unchanged\nconst value = "原文";';
  await page.locator('#source').fill(source);
  await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));
  assert.equal(await page.locator('#source').inputValue(),source);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  assert.equal(await page.title(),'FIMI · Understand code, step by step');
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.screenshot({path:path.join(out,'workspace.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,checks:['Chinese OS first run in English','English welcome dialog','English window title','favicon response and image load','desktop/small screen/mobile layout','saved language persists','switching language preserves source'],nativeWindowChromeVerified:false},null,2));
  console.log('Desktop branding browser checks passed. Native Windows title/taskbar artwork requires a visible desktop check.');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
