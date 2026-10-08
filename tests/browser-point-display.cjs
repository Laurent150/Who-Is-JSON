// Real HTTP resource and browser loading; no model request or user-session navigation.
const {spawn}=require('node:child_process'),path=require('node:path'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{let app,browser;try{
 const port=await new Promise(r=>{const s=http.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 app=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},windowsHide:true,stdio:'ignore'});
 const url='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const resource=await fetch(url+'/point-display.js');assert.equal(resource.status,200);assert.match(resource.headers.get('content-type'),/javascript/);assert.equal(await resource.text(),fs.readFileSync(path.join(root,'public/point-display.js'),'utf8'));
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.goto(url);
 await page.waitForFunction(()=>typeof globalThis.WhoPointDisplay?.text==='function');
 assert.equal(await page.evaluate(()=>WhoPointDisplay.text('The `value` matters.')),"The value matters.");
 assert.equal(await page.evaluate(()=>WhoPointDisplay.text('```js\nconst s = `x`;\n```')), 'const s = `x`;\n');

 const result=await page.evaluate(()=>{
  const raw='The `const value = "dark";` remains.\n\nThen `value`. <img src=x onerror="alert(1)">';
  const p=WhoPointDisplay.paragraph(raw,'JavaScript');document.querySelector('main').append(p);
  const code=p.querySelector('.point-code'),style=getComputedStyle(code),keyword=code.querySelector('.token-keyword'),string=code.querySelector('.token-string');
  const unknown=WhoPointDisplay.paragraph('`untouched`','Unsupported');const block=WhoPointDisplay.paragraph('```js\nconst text = `x`;\n```','JavaScript');
  return {text:p.textContent,font:style.fontFamily,color:style.color,keyword:getComputedStyle(keyword).color,string:getComputedStyle(string).color,stringText:string.textContent,codeCount:p.querySelectorAll('code').length,injected:p.querySelectorAll('img,script').length,fallback:unknown.textContent,block:block.textContent,blockCode:block.querySelector('.point-code-block')!==null,raw};
 });
 assert.match(result.font,/Consolas/);assert.notEqual(result.keyword,result.string);assert.equal(result.stringText,'"dark"');assert.equal(result.codeCount,2);assert.equal(result.injected,0);assert.match(result.text,/remains.\n\nThen value/);assert.equal(result.fallback,'untouched');assert.equal(result.block,'const text = `x`;\n');assert.equal(result.blockCode,true);
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.startsWith(url)));assert.ok(!requests.some(r=>r.includes('/api/ask')));
 console.log(JSON.stringify({pass:true,paidCalls:0,http200:true,resourceBytesMatch:true,browserRuntimeAvailable:true,modelCalls:0}));
 }finally{await browser?.close();app?.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
