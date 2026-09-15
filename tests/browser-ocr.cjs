// Real OCR through the page. Exact=false remains visible in the report.
// Known small dark-font ambiguity must be flagged, never counted as exact transcription.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.WHO_PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.CODELINGO_OCR_REPORT||path.join(__dirname,'../.browser-artifacts/ocr'));fs.mkdirSync(out,{recursive:true});
const cases=[
 {name:'javascript',language:'JavaScript',source:'function sum(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n    return total;\n}'},
 {name:'yaml',language:'YAML',source:'name: Build\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test'},
 {name:'cpp',language:'C++',source:'int sum(int a, int b) {\n    if (a > 0) {\n        return a + b;\n    }\n    return b;\n}'},
 {name:'python-dark',language:'Python',source:'def first_item(items):\n    if items:\n        return items[0]\n    return None'}
];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
 try{
  const fixture=await browser.newPage({viewport:{width:1100,height:800}});
  const attachment=process.env.WHO_OCR_FEEDBACK_IMAGE;
  if(attachment){
  const data='data:image/png;base64,'+fs.readFileSync(attachment).toString('base64');
  const crop=await fixture.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=582;c.height=315;c.getContext('2d').drawImage(img,180,21,582,315,0,0,582,315);return c.toDataURL();},data);
  fs.writeFileSync(path.join(out,'user-redis.png'),Buffer.from(crop.split(',')[1],'base64'));
  }
  for(const item of cases){
   await fixture.setContent('<style>body{margin:0;background:white}pre{font:16px/1.8 Consolas,monospace;padding:24px;margin:0;display:inline-block;color:#202830;white-space:pre}</style><pre></pre>');
   await fixture.locator('pre').evaluate((el,s)=>el.textContent=s,item.source);
   if(item.name==='python-dark')await fixture.locator('pre').evaluate(el=>{el.style.background='#203e35';el.style.color='#f8faf8';});
   await fixture.locator('pre').screenshot({path:path.join(out,item.name+'.png')});
  }
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  for(const name of [...(attachment?['user-redis']:[]),...cases.map(x=>x.name)]){
   await page.goto(process.env.CODELINGO_URL||'http://127.0.0.1:43128');
   await page.locator('#fileInput').setInputFiles(path.join(out,name+'.png'));
   await page.locator('#preview').waitFor({state:'visible'});
   const response=page.waitForResponse(r=>r.url().endsWith('/api/ocr'),{timeout:130000});
   await page.locator('#ocrBtn').click();const res=await response,r=await res.json();
   const expected=cases.find(item=>item.name===name);
   report.push({name,status:res.status(),exact:expected?r.code===expected.source:null,...r});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   assert.equal(res.status(),200,JSON.stringify(r));
   if(expected&&name!=='python-dark')assert.equal(r.code,expected.source,name+' transcription');
   else if(expected){const different=expected.source.split('\n').flatMap((line,i)=>line!==r.code.split('\n')[i]?[i+1]:[]);for(const line of different)assert.ok(r.uncertainLines.includes(line),'unreported OCR mismatch at '+line);}
   else assert.match(r.syntaxCheck.warning,/核对/);
   console.log(JSON.stringify({name,code:r.code,uncertainLines:r.uncertainLines}));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
