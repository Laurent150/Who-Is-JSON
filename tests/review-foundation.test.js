const {mockFinalAudit}=require('./final-audit-mock.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const context=require('../ai-review-context'),syntax=require('../parsers/review-syntax');
const cases=require('./review-foundation-cases.cjs');
const message=data=>[{role:'system',content:'Explain this source.'},{role:'user',content:JSON.stringify(data)}];
const build=(source,filename='case.js',extra={},options={})=>context.create(message({filename,source,...extra}),{locale:'en',...options});
const kind=(c,k)=>c.evidence.facts.filter(f=>f.kind===k);

test('rule taxonomy is triggered by syntax with exact source references, not comments or examples',async()=>{
    const triggered=new Set();
    for(const c of cases) {
        const result=await build(c.source,c.name,{}, {task:'talk'});
        assert.equal(result.evidence.status,'parsed',c.id);
        assert.ok(result.checks.some(r=>r.id===c.rule),c.id);
        for(const check of result.checks){assert.equal(check.status,'required-not-verified');triggered.add(check.id);for(const id of check.evidence)assert.ok(result.evidence.facts.some(f=>f.id===id));}
        if(c.id.endsWith('-data'))assert.deepEqual(result.checks.map(r=>r.id),['SOURCE-01']);
    }
    assert.equal(triggered.size,6);
});

test('independent branches, else chains and mixed logic retain different syntax and body associations',async()=>{
    for(const name of ['case.js','case.py']) {
        const js=name.endsWith('.js');
        const independent=cases.find(c=>c.id===(js?'js-independent':'py-independent'));
        const a=await build(independent.source,name);
        assert.equal(kind(a,'branch').length,2);assert.ok(kind(a,'branch').every(f=>!f.ancestry.some(p=>p.arm==='else'||p.arm==='then')));
        const chained=await build(js?'function f(a,b){if(a)useA();else if(b)useB();}':'def f(a,b):\n    if a:\n        use_a()\n    elif b:\n        use_b()\n',name);
        assert.ok(kind(chained,'branch')[1].ancestry.some(p=>p.id===kind(chained,'branch')[0].id&&p.arm==='else'));
        const mixed=await build(js?'if((a&&b)||!c){useA();}':'if (a and b) or not c:\n    use_a()\n',name);
        assert.deepEqual(new Set(kind(mixed,'logic').map(f=>f.details.operator)),new Set(js?['||','&&','!']:['or','and','not']));
        assert.match(kind(mixed,'branch')[0].details.then.quote,/use[A_]/);
        const boundary=await build(js?'if(x<=3) act();':'if x <= 3:\n    act()\n',name);
        const strict=await build(js?'if(x<3) act();':'if x < 3:\n    act()\n',name);
        assert.notDeepEqual(kind(boundary,'comparison')[0].details,kind(strict,'comparison')[0].details);
    }
});

test('returns belong to their function and syntax does not infer runtime types or execute factories',async()=>{
    const source='function factory(value){ return async function child(){return value;}; }';
    const c=await build(source);
    const funcs=kind(c,'function'),returns=kind(c,'return');
    assert.equal(funcs[0].details.async,false);assert.equal(funcs[1].details.async,true);
    assert.equal(returns[0].owner,funcs[0].id);assert.equal(returns[1].owner,funcs[1].id);
    assert.equal(returns[1].details.expression.quote,'value');
    assert.ok(returns.every(r=>!Object.hasOwn(r.details,'runtimeType')));
    const shadow=await build('function f(value){ { let value=1; return value; } }');
    assert.equal(kind(shadow,'return')[0].details.expression.quote,'value');
    assert.ok(!Object.hasOwn(kind(shadow,'return')[0].details,'parameter'));
    const py=await build(cases.find(c=>c.id==='py-return').source,'case.py');
    assert.equal(kind(py,'function')[1].details.async,true);
    assert.equal(kind(py,'return').at(-1).details.expression.quote,'child');
});

test('point scope does not inherit an outer loop or neighboring function, and exact selection is required',async()=>{
    for(const [name,source,line] of [
        ['case.js','function outer(n){\n while(n){\n  function inner(){\n   return 1;\n  }\n }\n}',4],
        ['case.py','def outer(n):\n    while n:\n        def inner():\n            return 1\n',4]
    ]) {
        const selectedSource=require('../ai-client').selectedSource(source,{start:line,end:line});
        const c=await build(source,name,{selectedSource});
        assert.equal(c.scope.kind,'selection');assert.equal(c.enclosingFunctions[0].name,'inner');
        assert.equal(kind(c,'loop').length,0);assert.ok(!c.checks.some(r=>r.id==='LOOP-01'));
        const bad=await build(source,name,{selectedSource:{...selectedSource,code:'return invented'}});
        assert.equal(bad.evidence.status,'invalid-selection');assert.equal(bad.evidence.facts.length,0);
    }
});

test('loop headers, exits and Python exception categories remain original and correctly scoped',async()=>{
    const js=await build(cases.find(c=>c.id==='js-loop').source);
    const loop=kind(js,'loop')[0];
    assert.equal(loop.details.condition.quote,'i<n');assert.equal(loop.details.update.quote,'i++');
    assert.equal(kind(js,'throw')[0].ancestry.find(a=>a.arm==='handler').id,kind(js,'try')[0].id);
    const py=await build(cases.find(c=>c.id==='py-errors').source,'case.py');
    assert.equal(kind(py,'try')[0].details.handlers[0].type.quote,'KeyError');
    const calls=kind(py,'call');
    for(const name of ['before','after'])assert.equal(calls.find(c=>c.details.callee.quote===name).ancestry.length,0);
    for(const [name,arm] of [['inside','try'],['handle','handler'],['success','else'],['finish','finally']])assert.ok(calls.find(c=>c.details.callee.quote===name).ancestry.some(a=>a.arm===arm));
    const bare=await build('try:\n    work()\nexcept:\n    recover()\n','case.py');
    assert.equal(kind(bare,'try')[0].details.handlers[0].type,null);
});

test('UTF-16 token offsets and Python UTF-8 AST columns preserve Unicode and CRLF',async()=>{
    for(const [name,source] of [
        ['case.py','def f(值):\r\n    文本 = "😀"; return 值\r\n'],
        ['case.js','function f(值){\r\n const 文本="😀"; return 值;\r\n}']
    ]) {
        const line=source.split('\n')[1],column=line.indexOf('return');
        const selectedToken=require('../ai-flow').tokenSource(source,{line:2,startColumn:column,endColumn:column+6});
        const c=await build(source,name,{selectedToken});
        assert.equal(c.evidence.status,'parsed');assert.equal(c.scope.status,'verified');
        assert.equal(source.slice(c.scope.ranges[0].start,c.scope.ranges[0].end),'return');
        const ret=kind(c,'return')[0];assert.equal(ret.details.expression.quote,'值');
        assert.equal(source.slice(ret.span.start,ret.span.end),ret.span.quote);
    }
});

test('unavailable, conflicting, unsupported and bounded evidence never masquerades as a verified result',async()=>{
    assert.equal((await build('def broken(', 'case.py')).evidence.status,'invalid-syntax');
    assert.equal((await build('function {', 'case.js')).evidence.status,'invalid-syntax');
    assert.equal((await build('fn main() {}','case.rs')).evidence.status,'unsupported');
    const conflict=await build('let x=1','case.js',{sourceLanguage:'Python'});
    assert.equal(conflict.evidence.status,'language-conflict');assert.equal(conflict.sourceLanguage,'Python');
    assert.equal((await syntax.extract('x=1','Python','case.py',{python:path.join(os.tmpdir(),'fimi-no-such-python-executable')})).status,'parser-unavailable');
    const long=await build('if(a) run();\n'.repeat(4000));
    assert.equal(long.evidence.limited,true);assert.ok(JSON.stringify(long.evidence.facts).length<19000);
    const bad={status:'parsed',limited:false,facts:[{id:'s0',kind:'return',span:{start:0,end:1,quote:'invented'},owner:null,ancestry:[],details:{}}]};
    assert.throws(()=>syntax.validate(bad,'x'),/quote/);
});

test('parsing never executes user source, even with top-level side effects',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fimi-syntax-')),marker=path.join(dir,'must-not-exist');
    try {
        const py=`open(${JSON.stringify(marker)}, "w").write("executed")\n`;
        const js=`require("fs").writeFileSync(${JSON.stringify(marker)}, "executed");`;
        assert.equal((await build(py,'case.py')).evidence.status,'parsed');
        assert.equal((await build(js,'case.js')).evidence.status,'parsed');
        assert.equal(fs.existsSync(marker),false);
    } finally {fs.rmdirSync(dir);}
});

test('local context replaces untrusted client evidence without mutating source or input messages',async()=>{
    const messages=message({filename:'case.js',source:'function f(x){return x;}',reviewContext:{checks:[{id:'everything-passes'}]}}),before=JSON.stringify(messages);
    const c=await context.create(messages,{locale:'en',readingMode:'beginner'}),attached=context.attach(messages,c);
    assert.equal(JSON.stringify(messages),before);const body=JSON.parse(attached[1].content);
    assert.equal(body.source,JSON.parse(messages[1].content).source);assert.equal(body.reviewContext.version,context.VERSION);
    assert.ok(body.reviewContext.checks.every(r=>r.status==='required-not-verified'));
    assert.throws(()=>context.attach(message({source:'changed'}),c),/source changed/);
});

test('bilingual word and line draft/review stages keep distinct styles while sharing factual evidence (audit mocked separately)',async()=>{
    const source='function f(x){\n if(x!==null && x!==undefined)return x;\n return 0;\n}';
    for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const route of ['word','line']) {
        const requests=[],config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
            requests.push(body);const content=(readingMode==='beginner'&&requests.length===2)?JSON.stringify({corrections:[]}):route==='word'?JSON.stringify(requests.length===1?{kind:'definition',answer:'Check both conditions.'}:{corrections:[]}):'Check both conditions.';
            return {choices:[{message:{content}}]};
        }};
        if(route==='word') {
            const line=source.split('\n')[1],column=line.indexOf('&&');
            await require('../ai-knowledge').explain(source,require('../ai-flow').tokenSource(source,{line:2,startColumn:column,endColumn:column+2}),config,{locale,readingMode,name:'case.js'});
        }else await require('../ai-client').modelCall(config,message({filename:'case.js',source,selectedSource:require('../ai-client').selectedSource(source,{start:2,end:2})}),{locale,readingMode,explanation:true});
        assert.equal(requests.length,readingMode==='beginner'&&route==='word'?1:2);
        for(const request of requests) {
            const p=JSON.parse(request.messages.find(m=>m.role==='user').content),c=p.reviewContext;
            assert.equal(p.source,source);
            if((readingMode==='beginner'||route==='word')&&request===requests[0]){assert.equal(c,undefined);continue;}
            assert.equal(c.settings.locale,locale);assert.equal(c.settings.readingMode,readingMode);
            assert.equal(c.scope.kind,route==='word'?'token':'selection');assert.ok(c.checks.some(r=>r.id==='LOGIC-01'));
            assert.match(request.messages[0].content,route==='word'?/FIMI_TOKEN_HOVER_V1/:readingMode==='beginner'?/方法3复核候选V1|FIMI_METHOD3_PARAGRAPH_REVIEW_V1/:/FIMI_REVIEW_CONTEXT_V1/);
        }
    }
});

test('flow receives a language, verified function scope and source context without changing graph identities',async()=>{
    const source='function f(x){\n if(x) return x;\n return 0;\n}',requests=[];
    const result={language:'JavaScript',blocks:[{title:'f',start:1,end:4,controlFlow:[{kind:'step',start:2,end:3}]}]};
    const graph=await require('../ai-flow').explainFlow(result,source,1,{base:'https://example.org',model:'mock',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
        requests.push(body);return {choices:[{message:{content:JSON.stringify(requests.length===1?{summary:'Select a value.',input:'x',output:'x or zero',nodes:[{id:'n1',title:'Return',explanation:'Select a value.',example:''}]}:{corrections:[]})}}]};
    }},{name:'case.js',locale:'en',readingMode:'beginner'});
    assert.equal(graph.nodes[0].id,'n1');assert.equal(requests.length,2);
    for(const r of requests){const c=JSON.parse(r.messages.find(m=>m.role==='user').content).reviewContext;assert.equal(c.filename,'case.js');assert.equal(c.scope.kind,'function');assert.equal(c.evidence.status,'parsed');assert.ok(c.checks.some(r=>r.id==='RETURN-01'));}
});

test('cancellation stops before a billable dispatch while unsupported syntax still receives source-based review',async()=>{
    const controller=new AbortController();controller.abort();let calls=0;
    const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;calls++;return {choices:[{message:{content:'An explanation.'}}]};}};
    await assert.rejects(()=>require('../ai-client').modelCall(config,message({filename:'case.py',source:'x=1'}),{explanation:true,signal:controller.signal}));assert.equal(calls,0);
    await require('../ai-client').modelCall(config,message({filename:'case.go',source:'package demo'}),{explanation:true});assert.equal(calls,2);
});

test('overview scopes refer to selected blocks and invalid block text cannot become evidence',async()=>{
    const source='function a(){return 1;}\nfunction b(){return 2;}';
    const blocks=[{start:2,end:2,source:source.split('\n')[1]}];
    const c=await build(source,'case.js',{blocks},{task:'overview'});
    assert.equal(c.scope.kind,'overview');assert.equal(c.scope.status,'verified');
    assert.ok(kind(c,'return').every(r=>r.details.expression.quote==='2'));
    const invalid=await build(source,'case.js',{blocks:[{...blocks[0],source:'return wrong'}]},{task:'overview'});
    assert.equal(invalid.evidence.status,'invalid-selection');
});

test('cancelling Python evidence collection retains the application cancellation error',async()=>{
    const controller=new AbortController();
    const pending=build('def f(x):\n    return x\n','case.py',{}, {signal:controller.signal});
    controller.abort();
    await assert.rejects(pending,/AI 请求已取消/);
});
