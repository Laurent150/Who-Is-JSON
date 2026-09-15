const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze,detect}=require('../analyzer'),{read}=require('../parsers/dockerfile-reader');
const source=fs.readFileSync(__dirname+'/fixtures/user-python.Dockerfile','utf8');
test('Chinese comments do not affect Dockerfile detection or instruction meaning',()=>{
  const variants=[source,source.replace(/^#.*$/gm,''),source.replace(/^#.*$/gm,'# English comment'),source.replace(/^#.*$/gm,'# const fake = () => 1; 中文😀')];
  let baseline;
  for(const code of variants){const r=analyze(code,'');assert.equal(r.language,'Dockerfile');assert.equal(r.status,'ready');assert.equal(r.blocks.length,1);const nodes=r.blocks[0].controlFlow;assert.equal(nodes.length,10);const facts=nodes.map(x=>[x.instruction,x.start,x.end,x.guide.title,x.guide.purpose]);if(baseline)assert.deepEqual(facts,baseline);else baseline=facts;}
});
test('named files, Docker fences, comments, Unicode and CRLF preserve original ranges',()=>{
  for(const [code,name]of [[source,'Dockerfile'],[source,'C:\\work\\Dockerfile.dev'],[source,'Containerfile'],['\uFEFF'+source,'user.dockerfile'],['```dockerfile\n'+source+'\n```','x.txt'],[source.replace(/\n/g,'\r\n'),'']]){
    const r=analyze(code,name);assert.equal(r.language,'Dockerfile');assert.equal(r.status,'ready',r.warnings.join(';'));
    for(const b of r.blocks){assert.equal(b.code,code.split('\n').slice(b.start-1,b.end).join('\n'));for(const n of b.controlFlow){const lines=code.split('\n').slice(n.start-1,n.end);assert.match(lines[0].slice(n.startColumn),new RegExp('^'+n.instruction));assert.ok(lines.at(-1).length>=n.endColumn);}}
  }
});
test('build commands, cache, expose and startup are distinct; comments are not proof',()=>{
  const r=analyze(source,''),b=r.blocks[0],nodes=b.controlFlow;
  assert.equal(r.documentKind,'build');assert.match(r.guide.purpose,/1 个 FROM/);
  const sync=nodes.filter(n=>n.instruction==='RUN'&&n.guide.title.includes('依赖'))[0];assert.match(sync.guide.purpose,/跳过项目/);assert.match(sync.guide.why,/不是最终镜像/);assert.equal(sync.end-sync.start,1);
  assert.match(nodes.find(n=>n.instruction==='EXPOSE').guide.purpose,/不会启动程序/);
  const cmd=nodes.at(-1);assert.equal(cmd.kind,'startup');assert.match(cmd.guide.purpose,/制作镜像时不会/);assert.ok(cmd.guide.authorNotes[0].includes('系统 Python'));assert.doesNotMatch(cmd.guide.purpose,/已安装到系统/);
  assert.ok(b.learning.some(x=>x.id==='docker.comment'));assert.ok(b.learning.some(x=>x.gap));
});
test('Docker text inside JS strings and Python comments cannot hijack explicit languages',()=>{
  assert.equal(detect('const code=`FROM alpine\nRUN echo hi`;'),'JavaScript');
  assert.equal(detect('# FROM alpine\n# RUN echo hi\ndef f():\n return 1'),'Python');
  assert.equal(detect('FROM python:3.12\nRUN echo hi','x.py'),'Python');
  for(const [code,name,py]of [['# 中文注释\ndef f(x):\n return x','x.py','python'],['// 中文注释\nconst f=x=>x;','x.js',undefined]])assert.equal(analyze(code,name,py).status,'ready');
});
test('logical lines preserve literal hashes and ignore full comment lines and directives',()=>{
  const code='FROM alpine\nRUN echo "# 中文" \\\n# comment\n world\n';const r=read(code);assert.equal(r.length,2);assert.equal(r[1].end,4);assert.match(r[1].args,/# 中文/);assert.doesNotMatch(r[1].args,/comment/);
  const win=analyze('# escape=`\nFROM windows\nRUN echo `\n hello','Dockerfile');assert.equal(win.blocks[0].controlFlow.length,2);assert.equal(win.blocks[0].controlFlow[1].end,4);
});
test('multiple FROM stages and overwritten CMD remain separate',()=>{
  const code='FROM alpine AS first\nCMD ["old"]\nCMD ["new"]\nFROM scratch\nCOPY --from=first /a /a\nCMD ["/a"]';const r=analyze(code,'Dockerfile');assert.equal(r.blocks.length,2);assert.match(r.guide.purpose,/2 个 FROM/);assert.match(r.blocks[0].controlFlow[1].guide.purpose,/覆盖/);assert.doesNotMatch(r.blocks[1].controlFlow.at(-1).guide.purpose,/旧设置/);
});
test('unsupported heredocs and malformed instructions stay bounded and explicit',()=>{
  const h=analyze('FROM alpine\nRUN <<EOF\nFROM fake\nCMD ["not real"]\nEOF\nEXPOSE 80','Dockerfile');assert.equal(h.blocks.length,1);assert.equal(h.blocks[0].controlFlow.length,3);assert.ok(h.blocks[0].learning.some(x=>x.gap&&x.context.includes('多行脚本')));
  for(const code of ['FROM','FROM alpine AS','FROM alpine\nCMD ["bad"','FROM alpine\nRUN echo \\','FROM alpine\nTYPO something'])assert.notEqual(analyze(code,'Dockerfile').status,'ready',code);
});
