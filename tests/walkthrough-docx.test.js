const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const docx=require('../public/walkthrough-docx');
test('Word export is valid Unicode OOXML with safe text, editable headings and no external resources',()=>{
 const p={title:'中文与 English <标题> & "quotes"',note:'HIDDEN_NOTE',sections:[{title:'函数 greet',text:'中文标点：“你好！” — café 😀\n\n```python\n\treturn "<你好> & English"\n```\nUse `greet(name)` to continue.',start:2,end:4}],questions:[{question:'为什么？',answer:'保留原文。'}]};
 const before=JSON.stringify(p);
 for(const locale of ['en','zh-CN']){
  const bytes=docx.create(p,locale);assert.equal(bytes[0],0x50);assert.equal(JSON.stringify(p),before);
  const check=spawnSync(process.env.CODELINGO_PYTHON||'python',['-c',
   'import sys,io,zipfile,json,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nassert z.testzip() is None\nfor n in z.namelist(): E.fromstring(z.read(n))\nn={"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}\nd=E.fromstring(z.read("word/document.xml"))\ns=E.fromstring(z.read("word/styles.xml"))\nprint(json.dumps({"text":"".join(d.itertext()),"tabs":len(d.findall(".//w:tab",n)),"styles":[x.attrib.get("{"+n["w"]+"}styleId") for x in s.findall("w:style",n)],"rels":z.read("word/_rels/document.xml.rels").decode()},ensure_ascii=True))'
  ],{input:bytes});
  assert.equal(check.status,0,check.stderr.toString());const result=JSON.parse(check.stdout);
  assert.ok(result.text.includes(p.title));assert.match(result.text,/中文标点：“你好！” — café 😀/);assert.match(result.text,/<你好> & English/);assert.match(result.text,/greet\(name\)/);assert.doesNotMatch(result.text,/HIDDEN_NOTE|```/);assert.equal(result.tabs,1);
  assert.ok(result.styles.includes('Title'));assert.ok(result.styles.includes('Heading1'));assert.ok(result.styles.includes('Code'));assert.doesNotMatch(result.rels,/TargetMode="External"/);
  assert.ok(result.text.includes(locale==='en'?'Follow-up questions':'可能被追问'));
 }
});
test('Word export rejects placeholder drafts without mutating input',()=>{
 assert.throws(()=>docx.create({sections:[]}),/请先生成讲解稿/);
});
