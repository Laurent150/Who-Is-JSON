// Real browser / local application, mocked cloud responses. Sends no email or AI call.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/email-login');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 let browser,server;
 try{
  const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const url='http://127.0.0.1:'+port;
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},windowsHide:true,stdio:'ignore'});
  let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1229,height:691},locale:'zh-CN'});
  await context.addInitScript(()=>localStorage.setItem('whoisjson.locale','en'));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let badCode=true,emailEnabled=true;
  await page.route('**/api/account/**',async r=>{
   const op=new URL(r.request().url()).pathname.split('/').at(-1);
   if(op==='status')return r.fulfill({json:{enabled:true,emailEnabled}});
   if(op==='email-start'){assert.equal(r.request().postDataJSON().email,'reader@example.com');return r.fulfill({json:{ticket:'test-ticket'}});}
   if(op==='email-verify')return badCode?r.fulfill({status:400,json:{error:'验证码无效或已过期，请重新获取。'}}):r.fulfill({json:{session:'opaque-test-session'}});
   if(op==='library')return r.fulfill({json:{user:{id:'reader',name:'reader@example.com',trialEligible:false},revision:0,payload:{knowledge:[],cards:[]}}});
   if(op==='trial-quota')return r.fulfill({json:{enabled:false,remaining:0,poolRemaining:0,held:0}});
   return r.fulfill({json:{ok:true}});
  });
  await page.goto(url);await page.locator('#account[open]').waitFor();
  assert.doesNotMatch(await page.locator('#accountLogin').innerText(),/[\u4e00-\u9fff]/);
  await page.locator('#accountClose').click();
  const source='// 保留原文\nconst 名字 = "中文";';await page.locator('#source').fill(source);
  await page.locator('#accountBtn').click();await page.locator('#accountEmailAddress').fill('reader@example.com');await page.locator('#accountEmailSend').click();
  await page.locator('#accountEmailCode').waitFor();await page.locator('#accountEmailCode').fill('123456');await page.locator('#accountEmailConfirm').click();
  await page.getByText('The code is invalid or has expired. Request a new code.',{exact:true}).waitFor();
  assert.equal(await page.locator('#accountEmailCode').inputValue(),'');
  await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));
  await page.getByText('验证码无效或已过期，请重新获取。',{exact:true}).waitFor();
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  assert.equal(await page.locator('#source').inputValue(),source);
  for(const size of [{width:1229,height:691},{width:390,height:844}]){
   await page.setViewportSize(size);await page.screenshot({path:path.join(out,'email-'+size.width+'.png')});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#accountEmailConfirm').scrollIntoViewIfNeeded();
  }
  badCode=false;await page.locator('#accountEmailCode').fill('654321');await page.locator('#accountEmailConfirm').click();
  await page.locator('#accountSignedIn:not([hidden])').waitFor();
  await page.getByText('Your email account can sync saved items. Connect your own service in AI settings.',{exact:true}).waitFor();
  assert.equal(await page.locator('#source').inputValue(),source);
  assert.equal(await page.locator('#accountUseTrial').isDisabled(),true);
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>/123456|654321|test-ticket/.test(v))),false);
  await page.locator('#accountLogout').click();await page.locator('#accountLogin:not([hidden])').waitFor();
  emailEnabled=false;await page.reload();await page.locator('#accountBtn').click();
  assert.equal(await page.locator('#accountEmailLogin').isVisible(),false);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,mockedCloud:true,realEmailSent:false,checks:['English selected language','invalid code translation','live language switch','source unchanged','email sign-in and logout','trial unavailable for email-only identity','mobile layout','deployment flag hides email entry']},null,2));
  console.log('Email browser checks passed (mock cloud; no real email, login or AI call).');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
