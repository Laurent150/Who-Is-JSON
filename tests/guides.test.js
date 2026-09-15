const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../analyzer'),K=require('../public/knowledge');
const fixture=n=>fs.readFileSync(__dirname+'/fixtures/'+n,'utf8');
const nodes=r=>r.blocks.flatMap(b=>{const visit=n=>[n,...(n.children||[]).flatMap(visit),...(n.otherwise||[]).flatMap(visit)];return (b.configurationNodes||b.controlFlow||[]).flatMap(visit)});
const fragment=(code,n)=>code.split('\n').slice(n.start-1,n.end).map((s,i)=>s.slice(i===0?n.startColumn:0,i===n.end-n.start?n.endColumn:undefined)).join('\n');
test('configuration guide explains settings without dumping command strings into prose',()=>{
  const code=fixture('user-settings.json'),r=analyze(code,'settings.json');
  assert.equal(r.configProfile,'claude');assert.equal(r.documentKind,'configuration');assert.equal(r.blocks.length,2);
  assert.match(r.guide.purpose,/不会运行/);assert.match(r.guide.basis,/推测/);
  const all=nodes(r),command=all.find(n=>n.path.endsWith('.command'));
  assert.equal(command.guide.decoded,JSON.parse(code).hooks.PostToolUse[0].hooks[0].command);
  assert.doesNotMatch(command.guide.purpose,/检查已通过|lint checks/);
  assert.ok(command.learning.some(x=>x.gap));
  assert.equal(JSON.parse(fragment(code,command)),command.guide.decoded);
  assert.match(all.find(n=>n.path.endsWith('.matcher')).guide.purpose,/Edit 或 Write/);
  assert.match(all.find(n=>n.path.endsWith('.timeout')).guide.purpose,/180 秒/);
  assert.ok(K.coverage(r.blocks[0].learning,r.blocks[0]).current.length>0);
});
test('unknown schemas, unfamiliar fields and mismatched hooks retain explanation gaps',()=>{
  const generic=analyze('{"permissions":{"name":"abc"},"hooks":"not a hook"}','x.json');
  assert.equal(generic.configProfile,'unknown');assert.match(generic.guide.basis,/尚未确定/);
  assert.ok(nodes(generic).some(n=>n.learning.some(x=>x.gap)));
  const changed=JSON.parse(fixture('user-settings.json'));
  changed.hooks.PreToolUse=changed.hooks.PostToolUse;delete changed.hooks.PostToolUse;
  changed.hooks.PreToolUse[0].matcher='Bash';changed.hooks.PreToolUse[0].hooks[0].timeout=12;
  changed.hooks.PreToolUse[0].hooks[0].args=['hello'];changed.hooks.PreToolUse[0].hooks[0].async=true;
  const all=nodes(analyze(JSON.stringify(changed),'x.json'));
  assert.ok(all.some(n=>n.guide.title.includes('工具执行前')));
  assert.match(all.find(n=>n.path.endsWith('.timeout')).guide.purpose,/不强制/);
  assert.match(all.find(n=>n.path.endsWith('.shell')).guide.purpose,/忽略/);
  assert.doesNotMatch(all.find(n=>n.path.endsWith('.matcher')).guide.purpose,/Edit 或 Write/);
  assert.ok(all.find(n=>n.path.endsWith('.args')).learning.some(x=>x.gap));
});
test('JSON basic values, source offsets and nested limits stay truthful',()=>{
  for(const code of ['{}','[]','null','"文字"','[true,false,null,2]','{"x":"😀\\n你好","nested":{"text":"<script>bad()</script>"}}','{"name":"demo","dependencies":{},"constructor":{},"__proto__":{"x":1}}']){
    const r=analyze(code,'x.json');assert.equal(r.status,'ready',r.warnings.join(';'));
    for(const n of nodes(r)){assert.doesNotThrow(()=>JSON.parse(fragment(code,n)));assert.ok(n.guide.purpose.length);}
  }
  const huge=analyze(JSON.stringify({items:Array.from({length:800},(_,i)=>i)}),'x.json');
  assert.ok(nodes(huge).length<360);assert.match(huge.warnings.join(''),/350/);
  assert.ok(huge.blocks.some(b=>b.learning.some(x=>x.label==='尚未展开的层级或项目')));
});
test('Bash beginner checks use actual operators, remain useful after renaming and explain limits',()=>{
  for(const source of [fixture('user-credentials.sh'),fixture('user-credentials-copied.txt')]){
    const r=analyze(source,'x.sh'),all=nodes(r);
    assert.match(all[0].guide.title,/还没准备/);assert.match(all[0].guide.example,/空格/);
    assert.ok(all.some(n=>n.guide?.purpose.includes('macOS 管理已保存密码')));
    assert.ok(all.some(n=>n.guide?.title.includes('系统保存的密码')));
  }
  const r=analyze('if [[ -n "${totally_renamed}" ]]; then\n echo ready\nfi','x.sh');
  assert.match(nodes(r)[0].guide.title,/已经有值/);assert.equal(nodes(r)[0].guide.subject,'totally_renamed');
  assert.doesNotMatch(JSON.stringify(r),/Google Maps/);
});
test('one guide contract works across real JavaScript, Python, Java and YAML',()=>{
  for(const name of ['is-number.js','binary-search.py','java-Factorial.java','vue-ci.yml']){
    const code=fs.readFileSync(__dirname+'/corpus/'+name,'utf8'),r=analyze(code,name,'python');
    assert.ok(r.guide.purpose);assert.ok(r.blocks.length);
    for(const b of r.blocks){assert.ok(b.guide.title);assert.ok(b.guide.purpose);assert.ok(['partial','unassessed'].includes(b.coverageState));}
  }
});
