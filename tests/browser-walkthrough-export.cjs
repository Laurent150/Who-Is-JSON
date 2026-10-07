// Real local UI and downloads, mocked model response; no paid requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.browser-artifacts/walkthrough-export');
function sample(locale){const en=locale==='en';return {title:en?'Understanding a greeting function':'理解一个问候函数',name:'greet.py',note:'HIDDEN_NOTE',sections:[
 {title:en?'What this code does':'这段代码做什么',text:en?'The function greets the supplied name. It preserves names such as 小明 and café. Example punctuation: < > & "quotes".':'函数接收一个名字，然后返回问候语。中文标点：“你好，小明！”；英文名称 café、FIMI 保持原样。',evidence:en?'Written by AI · Check against the source':'AI 撰写 · 请对照源码核对',index:null},
 {title:en?'Read the example':'阅读示例',text:'```python\ndef greet(name):\n    return f"你好，{name}!"\n\nmessage = greet("FIMI")\nprint(message)\n```',evidence:'AI',index:null},
 {title:en?'Step by step':'逐步理解',text:Array.from({length:12},(_,i)=>en?`Step ${i+1}: The function receives a name and constructs a greeting. The caller can store this text and display it later. This example explains the source without executing it.`:`步骤 ${i+1}：函数接收名字，并把名字放入问候语。调用方可以保存返回的文字，再根据需要显示。这里保留讲解内容和标点，使用较长段落检查自动换行与跨页排版。`).join('\n\n'),evidence:'AI',index:null}
 ],questions:[{question:en?'Does it change the name?':'它会修改名字吗？',answer:en?'No. It returns a new greeting string.':'不会。它返回一个新的问候字符串。'}]};}
(async()=>{let browser,server;try{
 fs.mkdirSync(out,{recursive:true});
 const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const url='http://127.0.0.1:'+port;
 server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,CODELINGO_PORT:String(port),WHO_CLOUD_DISABLED:'1'},stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch(url+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let calls=0,locale='en';
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/talk',r=>{calls++;return r.fulfill({contentType:'application/json',body:JSON.stringify(sample(locale))});});
 await page.goto(url);if(await page.locator('#accountSkip').isVisible())await page.locator('#accountSkip').click();
 await page.evaluate(async()=>{setCode('def greet(name):\n    return name','greet.py');$('useAI').checked=false;await run();setMode('talk');config={base:'https://example.invalid',model:'mock'};});
 for(locale of ['en','zh-CN']){
  await page.evaluate(l=>{changeInterfaceLanguage(l);renderTalk();},locale);assert.equal(await page.locator('#exportTalk').count(),0);
  await page.locator('#generateTalk').click();try{await page.locator('#exportTalk').waitFor({timeout:5000});}catch(e){throw Error(JSON.stringify({errors,calls,status:await page.locator('#talkStatus').innerText(),body:await page.locator('#speech').innerText()}));}assert.equal(await page.locator('#exportTalk').count(),1);
  const originalCalls=calls;
  assert.equal(await page.locator('#qaHeading').isVisible(),true);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.locator('#exportTalk').scrollIntoViewIfNeeded();
   const ready=await page.evaluate(()=>{const b=$('generateTalk').getBoundingClientRect(),s=$('talkStatus').getBoundingClientRect();return {right:s.left>=b.right,gap:s.left-b.right,alignment:Math.abs(b.y+b.height/2-s.y-s.height/2),color:getComputedStyle($('talkStatus')).color,connectionColor:getComputedStyle($('connection')).color,dot:getComputedStyle($('talkStatus'),'::before').content};});
   assert.ok(ready.right&&ready.gap>=12&&ready.gap<=16&&ready.alignment<1,JSON.stringify(ready));assert.equal(ready.color,ready.connectionColor);assert.ok(ready.dot.includes('●'));
   const bounds=await page.evaluate(()=>{const b=$('exportTalk').getBoundingClientRect(),head=$('speech').firstChild.querySelector('.speech-head').getBoundingClientRect(),toc=$('speechToc').getBoundingClientRect(),label=$('exportTalk').firstChild.getBoundingClientRect(),arrow=$('exportTalk').lastChild.getBoundingClientRect();return {right:Math.abs(b.right-head.right),below:b.top>=toc.bottom,label:Math.abs(label.y+label.height/2-b.y-b.height/2),arrow:Math.abs(arrow.y+arrow.height/2-b.y-b.height/2),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(bounds.right<1&&bounds.below&&bounds.label<1&&bounds.arrow<3&&!bounds.overflow,JSON.stringify(bounds));
   await page.locator('#exportTalk').click();const box=await page.locator('#walkthroughExportMenu').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
   await page.screenshot({path:path.join(out,`${locale}-${width}.png`)});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#exportTalk').getAttribute('aria-expanded'),'false');
  }
  for(const format of ['docx','md']){
   await page.locator('#exportTalk').focus();await page.keyboard.press('ArrowDown');if(format==='md')await page.keyboard.press('ArrowDown');
   assert.equal(await page.locator(':focus').getAttribute('data-format'),format);
   const pending=page.waitForEvent('download');await page.keyboard.press('Enter');const download=await pending;
   assert.ok(download.suggestedFilename().endsWith('.'+format));await download.saveAs(path.join(out,locale+'.'+format));
  }
  assert.equal(calls,originalCalls);assert.equal(await page.locator('#exportTalk').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>{resetTalk();renderTalk();});assert.equal(await page.locator('#exportTalk').count(),0);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,mockedAI:true,paidCalls:0,checks:['hidden before generation and after invalidation','one menu at top right below divider','bilingual desktop/mobile text and arrow alignment','keyboard open/select/Escape','actual Word and Markdown downloads without extra API calls']},null,2));console.log('Walkthrough export browser checks passed.');
}finally{await browser?.close();server?.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
