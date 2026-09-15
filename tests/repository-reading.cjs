// Explicit expectations for reviewed functions; never runs repository source.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{analyze}=require('../analyzer');
const root=process.argv[2],out=process.argv[3]||'repository-reading.json',checks=[];
function read(repo,file,name){const code=fs.readFileSync(path.join(root,repo,file),'utf8'),r=analyze(code,file,process.env.CODELINGO_PYTHON||'python'),b=r.blocks.find(x=>x.title===name);assert.equal(r.status,'ready');assert.ok(b);return b;}
let b=read('MathModelAgent','backend/app/core/llm/llm_factory.py','get_all_llms');
assert.equal(b.controlFlow.length,5);assert.ok(b.controlFlow.slice(0,4).every(n=>n.guide.arguments.length===6));assert.match(b.controlFlow.at(-1).guide.plain.purpose,/4 项.*一个元组.*交回调用处/);assert.ok(!b.learning.some(x=>x.id==='py.index'));
checks.push({function:'MathModelAgent / get_all_llms',expectation:'四次调用分别传六个参数；四项装成一个元组交回；类型提示不作为取值。',pass:true});
b=read('agent-skills','packages/skills-catalog/skills/(development)/harness-eval/scripts/inventory_extract.py','normalize_cite');
assert.equal(b.controlFlow[1].kind,'loop');assert.match(b.controlFlow[1].condition,/startswith/);assert.ok(b.learning.some(x=>x.id==='py.slice'));assert.equal(b.controlFlow.at(-1).kind,'return');
checks.push({function:'agent-skills / normalize_cite',expectation:'先清理文字，再重复去掉开头的 ./，最后交回结果；保留循环和切片。',pass:true});
b=read('omarchy','test/shell.d/qml-text-format-scan.py','is_pure_literal');
assert.equal(b.controlFlow.length,3);assert.ok(b.learning.some(x=>x.id==='py.regex-replace'));assert.ok(b.learning.some(x=>x.id==='py.logic'));assert.ok(b.learning.some(x=>x.gap&&x.label.includes('STRING_LITERAL')));
checks.push({function:'omarchy / is_pure_literal',expectation:'两次清理后组合两个判断；re.sub 可解释，编译正则的外部定义仍保留待核对项。',pass:true});
b=read('claude-plugins-community','tres-finance-plugin/skills/tres-report-create/tests/run_report_matrix.py','_normalize');
assert.equal(b.controlFlow[0].kind,'condition');assert.equal(b.controlFlow[1].kind,'condition');assert.equal(b.controlFlow[0].otherwise.length,0);assert.equal(b.controlFlow[1].otherwise.length,0);assert.equal(b.controlFlow[2].kind,'return');
checks.push({function:'claude-plugins-community / _normalize',expectation:'两个顺序判断，不误画成二选一；最后交回处理后的对应表。',pass:true});
b=read('OpenLogi','.github/scripts/i18n/merge_crowdin_download.py','toml_string');
assert.equal(b.controlFlow.length,1);assert.equal(b.controlFlow[0].kind,'return');assert.ok(b.learning.some(x=>x.id==='py.json-write'));assert.ok(b.learning.some(x=>x.id==='py.keyword'&&x.context.includes('ensure_ascii')));
checks.push({function:'OpenLogi / toml_string',expectation:'调用 json.dumps 写成 JSON 文字并交回；保留 ensure_ascii 的具名传参，不靠函数名猜实现。',pass:true});
fs.writeFileSync(out,JSON.stringify({pass:true,checks},null,2));console.log('Reviewed functions: '+checks.length+' passed');
