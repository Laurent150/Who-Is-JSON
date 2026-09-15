const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {analyze,detect}=require('../analyzer'),K=require('../public/knowledge'),{modules,flowNodes}=require('../public/structure');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8');
test('Bash envelope wins over embedded JavaScript, while JS strings do not become shell',()=>{
 assert.equal(detect(fixture('user-credentials.sh')),'Shell');assert.equal(detect(fixture('user-credentials-copied.txt')),'Shell');
 assert.equal(detect('const code = `if [[ -z "$x" ]]; then\necho hi\nfi`;'),'JavaScript');
 assert.equal(detect('const code="node -e \\"const x=1\\"";'),'JavaScript');
 assert.equal(detect('echo hello','x.sh'),'Shell');assert.equal(detect('const x = 1;','x.js'),'JavaScript');
});
test('the reported script has a script entry, two functions and real shell branches',()=>{
 const r=analyze(fixture('user-credentials.sh'),'sample.sh');assert.equal(r.status,'ready');assert.equal(r.language,'Shell');assert.equal(modules(r).length,3);assert.equal(r.blocks.filter(b=>b.kind==='function').length,2);assert.match(r.blocks[0].purpose,/仍优先/);assert.match(r.blocks[0].purpose,/定义本身不运行/);
 const nodes=flowNodes(r.blocks[0].controlFlow);assert.match(nodes[0].label,/是否为空/);assert.ok(nodes.some(n=>n.kind==='loop'));assert.ok(nodes.some(n=>n.kind==='break'));assert.ok(nodes.some(n=>n.label==='security 是否可用'));assert.ok(nodes.some(n=>n.otherwise?.[0]?.kind==='condition'));
 for(const b of r.blocks){assert.ok(b.learning.every(x=>x.id.startsWith('sh.')||x.id.startsWith('gap.sh.')));assert.doesNotMatch(b.purpose,/一组包含|command 减/);}
});
test('copy escapes retain original evidence and flag invalid embedded JS separately',()=>{
 const raw=fixture('user-credentials-copied.txt'),r=analyze(raw,'clip.txt');assert.equal(r.status,'ready');assert.equal(r.blocks[0].code,raw);assert.ok(r.normalizedCode.includes('GOOGLE_MAPS_API_KEY_ENV'));const n=r.blocks[0].controlFlow[0],line=raw.split('\n')[n.start-1];assert.equal(line.slice(n.startColumn,n.endColumn),'[[ -z "${GOOGLE\\_MAPS\\_API\\_KEY\\_ENV}" ]]');assert.ok(r.blocks.flatMap(b=>b.learning).some(k=>k.id==='gap.sh.embedded'&&k.context.includes('未通过语法检查')));assert.match(r.warnings.join(' '),/分析副本/);
});
test('OpenSky function preserves checks, splitting, early return, and shell return semantics',()=>{
 const r=analyze(fixture('user-credentials.sh'),'a.sh'),b=r.blocks.find(b=>b.title==='load_opensky_oauth_from_file'),nodes=flowNodes(b.controlFlow);assert.ok(nodes.some(n=>n.label==='node 是否不可用'));assert.ok(nodes.some(n=>n.label.includes('是否没有制表符')));assert.ok(nodes.some(n=>n.label.includes('第一个制表符之前')));assert.ok(nodes.some(n=>n.label.includes('第一个制表符之后')));assert.ok(nodes.some(n=>n.label.includes('OPENSKY_CLIENT_SECRET 是否为空，并且')));assert.ok(nodes.filter(n=>n.kind==='return').every(n=>n.detail.includes('不交回字符串')));
 const condition=nodes.find(n=>n.label==='node 是否不可用'),report=K.coverage(b.learning,condition);assert.ok(report.current.some(k=>k.id==='sh.command'));assert.ok(!report.current.some(k=>k.id.startsWith('js.')));
});
test('broken shell stays partial and quotes/comments cannot manufacture declarations',()=>{
 const r=analyze('if [[ -z "$x" ]]; then\necho missing\n','broken.sh');assert.equal(r.syntaxErrors,true);assert.equal(r.blocks.length,0);
 const safe=analyze('# fake() {\ntext=\'if [[ -z "$x" ]]; then\'\necho "$text"\n','safe.sh');assert.equal(safe.status,'ready');assert.equal(safe.blocks.filter(b=>b.kind==='function').length,0);
});
test('generic Bash input does not get application-specific credential claims',()=>{
 const r=analyze('show() {\n node -e \'console.log(1)\'\n}\nshow\n','generic.sh');assert.ok(r.blocks.every(b=>!b.purpose.includes('补齐变量')));assert.ok(!r.blocks[0].purpose.includes('Google Maps'));
 const changed=fixture('user-credentials.sh').replace('GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_ENV}"','GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_KEYCHAIN}"');assert.ok(!analyze(changed,'changed.sh').blocks[0].purpose.includes('仍优先'));
});
test('shell fences and Unicode keep source ranges grounded',()=>{
 const code='```bash\nmessage="中文😀"\nif [[ -n "$message" ]]; then\necho "$message"\nfi\n```';const r=analyze(code,'clip.txt');assert.equal(r.language,'Shell');const n=r.blocks[0].controlFlow.find(n=>n.kind==='condition');assert.equal(n.start,3);assert.equal(code.split('\n')[2].slice(n.startColumn,n.endColumn),'[[ -n "$message" ]]');
});
