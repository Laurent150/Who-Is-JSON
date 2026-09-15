const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {analyze}=require('../analyzer'),{flowNodes}=require('../public/structure');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/chat-presentation.txt'),'utf8');
test('actual pasted example has useful roles, specific stages, and bounded source-free labels',()=>{
 const r=analyze(fixture,'sample.js');const get=name=>r.blocks.find(b=>b.title===name);
 assert.match(get('clean').purpose,/空白/);assert.match(get('build').purpose,/问答|回答/);assert.match(get('markdown').purpose,/Markdown/);
 const clean=get('clean').controlFlow;assert.equal(clean[0].kind,'condition');assert.match(clean[0].otherwise[0].label,/空文字/);
 const markdown=get('markdown').meaning;assert.equal(markdown.flowType,'expression');assert.equal(markdown.steps.length,5);assert.match(markdown.steps[1].label,/标题和正文/);assert.match(markdown.steps[3].label,/问题和回答/);
 const build=get('build');assert.ok(build.controlFlow.some(x=>x.label.includes('外层部分')));assert.ok(build.controlFlow.some(x=>x.label.includes('先说明这份代码')));
 for(const b of [get('clean'),build,get('markdown')])for(const n of [...flowNodes(b.controlFlow),...flowNodes(b.meaning.steps)]){assert.ok(n.label.length<110,n.label);assert.doesNotMatch(n.label,/使用 \+ 组合|=>|\$\{|表达式较长/);assert.ok(n.start>=b.start&&n.end<=b.end);assert.ok(fixture.split('\n').slice(n.start-1,n.end).join('\n').trim());}
});
test('roles survive author-name changes and source offset changes',()=>{
 const changed=fixture.replace(/\bclean\b/g,'tidy').replace(/\bbuild\b/g,'prepare').replace(/\bmarkdown\b/g,'exportText').replace(/\bv\b/g,'inputValue');
 const r=analyze('\n\n'+changed,'renamed.js'),original=analyze(fixture,'sample.js');
 for(const [before,after]of [['clean','tidy'],['build','prepare'],['markdown','exportText']]){const a=original.blocks.find(b=>b.title===before),b=r.blocks.find(b=>b.title===after);assert.equal(a.meaning.title,b.meaning.title);assert.equal(b.start,a.start+2);for(const [i,s]of (a.meaning.steps||[]).entries())assert.equal(b.meaning.steps[i].start,s.start+2);}
});
test('names or unrelated nested records do not invent a report purpose',()=>{
 const r=analyze('function markdown(x){return x*2} function clean(x){return x.trim()} function build(){function unrelated(){let a=[];a.push({title:"x",text:"y"});a.push({question:"q",answer:"a"});}return {ok:true};}','names.js');
 for(const b of r.blocks.filter(b=>['clean','build','markdown'].includes(b.title)))assert.equal(b.meaning.title,'');
 const invalid=analyze('const clean=x=>typeof x==="number"?x.trim():"";','x.js');assert.equal(invalid.blocks[0].meaning.title,'');
});
test('numeric subtree stays one cited operation inside text concatenation',()=>{
 const r=analyze('function render(){return (1+2)+" apples";}','x.js');const steps=r.blocks[0].meaning.steps;assert.equal(steps.length,3);assert.doesNotMatch(r.blocks[0].purpose,/Markdown/);
});
test('output simplification does not hide earlier operations or fail on overload declarations',()=>{
 const r=analyze('function render(x){save(x);return "# "+x;}','x.js');assert.ok(!r.blocks[0].meaning.steps);assert.equal(r.blocks[0].controlFlow.length,2);
 const t=analyze('function size(x: string): number; function size(x: string){return x.length;}','x.ts');assert.ok(t.blocks.length>=2);
});
test('forEach callback return ends the item and does not end the enclosing function',()=>{
 const r=analyze('function run(xs){xs.forEach(x=>{if(x)return;send(x)});done();return 1;}','x.js');const f=r.blocks.find(b=>b.title==='run').controlFlow;assert.equal(f[0].kind,'iteration');assert.ok(!f[0].terminal);assert.equal(f.length,3);assert.match(f[0].detail,/只结束这一项/);
});
test('real Python bisection explains narrowing by structure, including renamed variables',()=>{
 const raw=fs.readFileSync(path.join(__dirname,'corpus/binary-search.py'),'utf8');
 for(const code of [raw,raw.replace(/\bbisect_left\b/g,'place').replace(/\bmid\b/g,'center')]){const r=analyze(code,'x.py','python');const b=r.blocks.find(x=>['bisect_left','place'].includes(x.title));assert.match(b.meaning.purpose,/左侧位置/);assert.match(b.meaning.output,/没有真的插入/);assert.ok(flowNodes(b.controlFlow).some(x=>x.label.includes('排除中间项')));}
 const wrong=analyze(raw.replace(/lo = mid \+ 1/g,'lo = mid + 2'),'x.py','python');assert.ok(!wrong.blocks.find(b=>b.title==='bisect_left').meaning);
});
