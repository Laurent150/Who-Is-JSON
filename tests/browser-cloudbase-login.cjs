// Real browser / local application, mocked cloud responses. Sends no email or AI call.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/cloudbase-login');
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
  let badCode=true,emailEnabled=true,trialEnabled=false,quotaMode='ready'; const unexpected=[];
  await page.route('**/api/account/**',async r=>{
   const op=new URL(r.request().url()).pathname.split('/').at(-1);
   if(op==='status')return r.fulfill({json:{enabled:true,emailEnabled,provider:'cloudbase',githubEnabled:false,libraryEnabled:false,trialEnabled}});
   if(op==='email-start'){assert.equal(r.request().postDataJSON().email,'reader@example.com');assert.equal(r.request().postDataJSON().locale,'en');return r.fulfill({json:{ticket:'test-ticket'}});}
   if(op==='email-verify')return badCode?r.fulfill({status:400,json:{error:'验证码无效或已过期，请重新获取。'}}):r.fulfill({json:{session:'opaque-test-session'}});
   if(op==='me')return r.fulfill({json:{user:{id:'cloudbase:test:reader',name:'reader@example.com',trialEligible:trialEnabled,provider:'cloudbase'}}});
   if(op==='library'||op==='save'){unexpected.push(op);return r.fulfill({status:503,json:{error:'disabled'}});}
   if(op==='trial-quota'){
    const failure={error:'额度服务暂时不可用。',identity:'未能确认邮箱身份。',unknown:'private upstream detail'}[quotaMode];
    const remaining = {pending:0,half:1000000,low:1000,empty:0}[quotaMode] ?? 2000000;
    return failure?r.fulfill({status:503,json:{error:failure}}):r.fulfill({json:trialEnabled?{enabled:quotaMode!=='paused',remaining,held:quotaMode==='pending'?2000000:0,grant:2000000,poolRemaining:null,unlimitedPool:true,currency:'CNY',unit:1000000}:{enabled:false,remaining:0,poolRemaining:0,held:0}});
   }
   return r.fulfill({json:{ok:true}});
  });
  await page.goto(url);await page.locator('#account[open]').waitFor();
  assert.doesNotMatch(await page.locator('#accountLogin').innerText(),/[\u4e00-\u9fff]/);
  assert.equal(await page.locator('#accountGithub').isVisible(),false);
  await page.locator('#accountSkip').click();
  await page.evaluate(()=>{localStorage.setItem('codelingo.cards',JSON.stringify([{id:1,title:'guest',code:'unchanged'}]));localStorage.setItem('whoisjson.account-library.v1.old',JSON.stringify({payload:{knowledge:[],cards:[]},revision:4,dirty:true,sequence:1}));});
  const saved=await page.evaluate(()=>[localStorage.getItem('codelingo.cards'),localStorage.getItem('whoisjson.account-library.v1.old')]);
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
   await page.setViewportSize(size);await page.screenshot({path:path.join(out,'cloudbase-'+size.width+'.png')});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#accountEmailConfirm').scrollIntoViewIfNeeded();
  }
  badCode=false;await page.locator('#accountEmailCode').fill('654321');await page.locator('#accountEmailConfirm').click();
  await page.locator('#accountSignedIn:not([hidden])').waitFor();
  await page.getByText('AI trial credits are not enabled for CloudBase accounts yet. Connect your own service in AI settings.',{exact:true}).waitFor();
  assert.equal(await page.locator('#source').inputValue(),source);
  assert.equal(await page.locator('#accountUseTrial').isVisible(),false);
  assert.equal(await page.locator('#accountSync').isVisible(),false);
  assert.doesNotMatch(await page.locator('#accountSignedIn').innerText(),/[\u4e00-\u9fff]/);
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('codelingo.cards'),localStorage.getItem('whoisjson.account-library.v1.old')]),saved);
  await page.reload();await page.locator('#accountSignedIn:not([hidden])').waitFor({state:'attached'});await page.locator('#accountBtn').click();
  assert.deepEqual(unexpected,[]);
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>/123456|654321|test-ticket/.test(v))),false);
  await page.locator('#accountLogout').click();await page.locator('#accountLogin:not([hidden])').waitFor();
  emailEnabled=false;await page.reload();await page.locator('#accountBtn').click();
  assert.equal(await page.locator('#accountEmailLogin').isVisible(),false);
  emailEnabled=true;trialEnabled=true;await page.reload();await page.locator('#accountBtn').click();
  await page.locator('#accountEmailAddress').fill('reader@example.com');await page.locator('#accountEmailSend').click();
  await page.locator('#accountEmailCode').fill('654321');await page.locator('#accountEmailConfirm').click();
  await page.waitForFunction(()=>WhoTrial.enabled);
  assert.equal(await page.locator('#accountQuotaPercent').innerText(),'100%');
  assert.equal(await page.locator('#accountQuotaLabel').innerText(),'Trial allowance remaining');
  quotaMode='half';await page.evaluate(()=>WhoRefreshTrial());
  assert.equal(await page.locator('#accountQuotaPercent').innerText(),'50%');
  assert.equal(await page.locator('#accountQuotaBar').evaluate(el=>el.value),50);
  await page.screenshot({path:path.join(out,'trial-percent-en.png')});
  quotaMode='low';await page.evaluate(()=>WhoRefreshTrial());
  assert.equal(await page.locator('#accountQuotaPercent').innerText(),'<1%');
  quotaMode='empty';await page.evaluate(()=>WhoRefreshTrial());
  assert.equal(await page.locator('#accountQuotaPercent').innerText(),'0%');
  assert.equal(await page.evaluate(()=>WhoTrial.enabled),false);
  assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/CNY|¥|2\.00|peak rates/);
  assert.equal(await page.locator('#accountUseTrial').isVisible(),true);
  quotaMode='paused';await page.evaluate(()=>WhoRefreshTrial());
  assert.match(await page.locator('#accountTrial').innerText(),/currently paused/);
  assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/CNY|¥|2\.00/);
  assert.equal(await page.evaluate(()=>WhoTrial.enabled),false);
  quotaMode='pending';await page.evaluate(()=>WhoRefreshTrial());
  assert.match(await page.locator('#accountTrial').innerText(),/previous AI request is still processing/);
  assert.equal(await page.evaluate(()=>WhoTrial.enabled),false);
  await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));
  assert.equal(await page.locator('#accountQuotaLabel').innerText(),'剩余试用额度');
  await page.screenshot({path:path.join(out,'trial-percent-zh.png')});
  assert.match(await page.locator('#accountTrial').innerText(),/上一笔调用仍在处理或待核对/);
  assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/¥|余额|2\.00|高峰单价/);
  for(const locale of ['zh-CN','en']) {
   await page.evaluate(locale=>changeInterfaceLanguage(locale),locale);
   quotaMode='pending';await page.evaluate(()=>WhoRefreshTrial());
   assert.equal(await page.locator('#accountUseTrial').isDisabled(),true);
   await page.locator('#accountClose').click();
   quotaMode='half';await page.locator('#accountBtn').click();
   await page.waitForFunction(()=>WhoTrial.enabled);
   assert.equal(await page.locator('#accountQuotaPercent').innerText(),'50%');
   assert.equal(await page.locator('#accountUseTrial').isDisabled(),false);
   assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/上一笔调用|previous AI request/);
  }
  await page.evaluate(()=>changeInterfaceLanguage('zh-CN'));
  quotaMode='error';await page.evaluate(()=>WhoRefreshTrial());
  assert.equal(await page.locator('#accountQuota').isVisible(),false);
  assert.equal(await page.evaluate(()=>WhoTrial.enabled),false);
  assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/一次性试用额度/);
  assert.equal(await page.locator('#accountTrial').innerText(),'额度服务暂时不可用。');
  await page.evaluate(()=>changeInterfaceLanguage('en'));
  await page.evaluate(()=>WhoRefreshTrial());
  assert.match(await page.locator('#accountTrial').innerText(),/allowance service is temporarily unavailable/);
  quotaMode='identity';await page.evaluate(()=>WhoRefreshTrial());
  assert.equal(await page.locator('#accountTrial').innerText(),'Your email identity could not be verified.');
  quotaMode='unknown';await page.evaluate(()=>WhoRefreshTrial());
  assert.doesNotMatch(await page.locator('#accountTrial').innerText(),/private upstream detail/);
  assert.equal(await page.locator('#accountUseTrial').isDisabled(),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,mockedCloud:true,realEmailSent:false,checks:['English selected language','invalid code translation','live language switch','source unchanged','email sign-in and logout','CloudBase credit and sync unavailable states','mobile layout','deployment flag hides email entry','trial status without monetary balances in both languages','pending holds and quota errors disable trial','reopening account clears a settled cached hold in Chinese and English']},null,2));
  console.log('CloudBase browser checks passed (mock cloud; no real email, login or AI call).');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
