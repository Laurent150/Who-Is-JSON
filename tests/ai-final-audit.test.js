const {test}=require('node:test'),assert=require('node:assert/strict');
const {modelCall}=require('../ai-client'),audit=require('../ai-final-audit'),expression=require('../ai-expression-review');
const {mockFinalAudit}=require('./final-audit-mock.cjs');
const source='function choose(value, active) {\r\n if (active && value !== null) return value;\r\n return 0;\r\n}';
const messages=[{role:'system',content:'Explain the selection.'},{role:'user',content:JSON.stringify({filename:'choose.js',source,selectedSource:{start:2,end:2,code:source.split('\n')[1]}})}];
const response=content=>({usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15},choices:[{finish_reason:'stop',message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
const options={locale:'en',readingMode:'standard',explanation:true};
function rejection(body,rule='LOGIC-01'){
    const result=JSON.parse(mockFinalAudit(body).choices[0].message.content),input=JSON.parse(body.messages[1].content);
    result.verdict='reject';result.checks.find(c=>c.id===rule).status='fail';
    result.findings=[{rule,field:input.fields[0].field,quote:input.fields[0].text,sourceQuote:'active && value !== null',reason:'The final text changed the conjunction into a disjunction.'}];
    return result;
}
test('task-specific expression contracts preserve all languages, modes, audiences and walkthrough depth without flattening tasks',()=>{
    for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard']){
        for(const [task,marker] of [['knowledge',/WORD POINT-READING|词语点读/],['ask',/STATEMENT POINT-READING|语句点读/],['flow',/FUNCTION FLOW|函数流程/],['overview',/FILE OVERVIEW|文件总览/]]){
            const text=expression.instruction({task,locale,readingMode});assert.match(text,marker);
            assert.doesNotMatch(text,/WALKTHROUGH:|完整讲解稿：/);if(locale==='en')assert.doesNotMatch(text,/[\u3400-\u9fff]/);
        }
        for(const audience of ['beginner','peer','review'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
            const text=expression.instruction({task:'talk',locale,readingMode,audience,detail,coverage});
            assert.match(text,/WALKTHROUGH:|完整讲解稿：/);assert.match(text,/point-reading sentence limits|点读句数限制/);
            assert.match(text,locale==='en'?/Coverage — /:/范围—/);
            if(locale==='en')assert.doesNotMatch(text,/[\u3400-\u9fff]/);
        }
    }
});
test('legacy post-edit gates see exact final prose; beginner selections use paragraph review without a gate',async()=>{
    for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const json of [false,true]){
        const point=readingMode==='beginner'&&!json;
        const calls=[],phases=[],usage=[],candidate=locale==='en'?'Use value when active AND value is not null.':'active为真且value不是null时交回value。';
        const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
            calls.push(body);
            if(calls.length===3){
                assert.equal(body.messages.length,2);assert.equal(body.messages[0].role,'system');
                const input=JSON.parse(body.messages[1].content);assert.equal(input.source,source);
                assert.equal(input.fields[0].text,candidate);assert.deepEqual(input.changedFields,['f0']);
                assert.doesNotMatch(body.messages[1].content,/WRONG_DRAFT|FAKE_LEDGER|editor history/);
                assert.equal(input.settings.locale,locale);assert.equal(input.settings.readingMode,readingMode);
                return mockFinalAudit(body,{prompt_tokens:10,completion_tokens:5,total_tokens:15});
            }
            if(point&&calls.length===2)return response({corrections:[{id:'p1',value:candidate,reason:'Restore the deciding conjunction.'}]});
            return response(calls.length===1?(json?{answer:'WRONG_DRAFT'}:'WRONG_DRAFT'):(json?{corrections:[{path:['answer'],value:candidate}]}:candidate));
        }};
        const input=[...messages,{role:'user',content:'FAKE_LEDGER must not enter independent audit'}];
        const result=await modelCall(config,input,{...options,locale,readingMode,json,onUsage:v=>usage.push(v),onModelRequest:(_,p)=>phases.push(p)});
        assert.equal(json?JSON.parse(result).answer:result,candidate);assert.equal(calls.length,point?2:3);
        assert.deepEqual(phases,point?['draft','review']:['draft','review','final-audit']);assert.equal(usage.length,point?2:3);
        assert.equal(require('../ai-usage').summary(usage).totalTokens,point?30:45);
    }
});
test('a mistake introduced by the editor is blocked even when the original draft was correct',async()=>{
    let calls=0,report;
    const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
        calls++;if(calls===3)return response(rejection(body));
        return response(calls===1?'Both conditions must hold.':'Either condition is enough.');
    }};
    await assert.rejects(()=>modelCall(config,messages,{...options,onFinalAudit:r=>report=r}),{code:'AI_FINAL_AUDIT_REJECTED'});
    assert.equal(calls,3);assert.equal(report.verdict,'reject');
});
test('unchanged candidates still receive an independent audit, and no correction follows an audit pass',async()=>{
    const calls=[];
    const candidate={answer:'Both conditions must hold.'};
    const output=await modelCall({base:'https://example.org',model:'mock',sponsoredCall:async body=>{
        calls.push(body);if(calls.length===3){assert.deepEqual(JSON.parse(body.messages[1].content).changedFields,[]);return mockFinalAudit(body);}
        return response(calls.length===1?candidate:{corrections:[]});
    }},messages,{...options,json:true});
    assert.equal(output,JSON.stringify(candidate));assert.equal(calls.length,3);
});
test('audit protocol rejects stale candidates, missing checks, false passes and fabricated source/prose anchors',()=>{
    const input=audit.build(messages,'Both conditions hold.','Old.',{}),body={messages:[{content:'FIMI_FINAL_AUDIT_V1'},{content:JSON.stringify(input)}]};
    const valid=()=>JSON.parse(mockFinalAudit(body).choices[0].message.content);
    for(const mutate of [v=>v.candidateHash='stale',v=>v.checks.pop(),v=>v.checks.push({...v.checks[0],status:'fail'}),v=>v.checks[0].status='not-applicable',v=>v.checks[0].status='uncertain',v=>v.verdict='reject',v=>v.candidate='unsolicited rewrite']){
        const data=valid();mutate(data);assert.throws(()=>audit.validate(JSON.stringify(data),input),{code:'AI_FINAL_AUDIT_PROTOCOL'});
    }
    const reject=valid();reject.verdict='reject';reject.checks[0].status='uncertain';reject.findings=[{rule:reject.checks[0].id,field:'f0',quote:'conditions',sourceQuote:'',reason:'A material claim is unresolved.'}];
    assert.equal(audit.validate(JSON.stringify(reject),input).verdict,'reject');
    for(const change of [{field:'f90'},{quote:'fabricated quote'},{sourceQuote:'return fabricated;'},{rule:'missing-rule'}]){
        const data=structuredClone(reject);Object.assign(data.findings[0],change);assert.throws(()=>audit.validate(JSON.stringify(data),input),{code:'AI_FINAL_AUDIT_PROTOCOL'});
    }
});

test('redundant checks normalize only exact repeats or explicit references in both languages',()=>{
    const input=audit.build(messages,'Both conditions hold.','Old.',{}),body={messages:[{content:'FIMI_FINAL_AUDIT_V1'},{content:JSON.stringify(input)}]};
    const valid=()=>JSON.parse(mockFinalAudit(body).choices[0].message.content);
    for(const reference of [null,'见上。','同上','See above.','Same as above.'])for(const first of [false,true]){
        const data=valid(),expected=structuredClone(data),duplicate={...data.checks[0],reason:reference||data.checks[0].reason};
        if(first)data.checks.unshift(duplicate);else data.checks.push(duplicate);
        assert.deepEqual(audit.validate(JSON.stringify(data),input),expected);
    }
});

test('duplicate recovery cannot hide disagreement, missing IDs, bad anchors, stale hashes or unsupported records',()=>{
    const input=audit.build(messages,'Both conditions hold.','Old.',{}),body={messages:[{content:'FIMI_FINAL_AUDIT_V1'},{content:JSON.stringify(input)}]};
    const valid=()=>JSON.parse(mockFinalAudit(body).choices[0].message.content);
    for(const mutate of [
        v=>v.checks.push({...v.checks[0],status:'uncertain'}),
        v=>v.checks.push({...v.checks[0],status:'not-applicable',reason:'A different decision.'}),
        v=>v.checks.push({...v.checks[0],reason:'See above.',extra:'unsupported'}),
        v=>{v.checks[0].reason='见上。';v.checks.push({...v.checks[0]});},
        v=>v.checks.push({...v.checks[0]},{...v.checks[0]}),
        v=>{v.checks.pop();v.checks.push({...v.checks[0]});},
        v=>{v.checks.push({...v.checks[0]});v.candidateHash='stale';},
        v=>v.checks.push({...v.checks[0],id:'UNKNOWN-01'}),
        v=>v.checks.push({...v.checks[0],reason:''}),
        v=>v.checks.push({...v.checks[0],reason:'x'.repeat(2001)}),
        v=>{v.checks.push({...v.checks[0]});v.findings=[{rule:v.checks[0].id,field:'f0',quote:'fabricated',sourceQuote:'',reason:'Error'}];}
    ]){const data=valid();mutate(data);assert.throws(()=>audit.validate(JSON.stringify(data),input),{code:'AI_FINAL_AUDIT_PROTOCOL'});}
});

test('same-status duplicate checks preserve both reasons in English and Chinese without changing the decision',()=>{
 const input=audit.build(messages,'Both conditions hold.','Old.',{}),body={messages:[{content:'FIMI_FINAL_AUDIT_V1'},{content:JSON.stringify(input)}]};
 for(const reasons of [['The return expression matches.','Each branch returns its stated value.'],['返回表达式一致。','各分支的返回值对应正确。']])for(const status of ['pass','fail','uncertain']){
  const data=JSON.parse(mockFinalAudit(body).choices[0].message.content),rule=data.checks[0].id;
  data.checks[0]={id:rule,status,reason:reasons[0]};data.checks.push({id:rule,status,reason:reasons[1]});
  if(status!=='pass'){data.verdict='reject';data.findings=[{rule,field:'f0',quote:'conditions',sourceQuote:'active && value !== null',reason:'Material mismatch.'}];}
  const result=audit.validate(JSON.stringify(data),input);
  assert.equal(result.verdict,data.verdict);assert.equal(result.candidateHash,input.candidateHash);
  assert.equal(result.checks.find(c=>c.id===rule).reason,reasons.join('\n'));assert.deepEqual(result.findings,data.findings);
  const tooLong=structuredClone(data);tooLong.checks.at(-1).reason='x'.repeat(2000);
  assert.throws(()=>audit.validate(JSON.stringify(tooLong),input),{code:'AI_FINAL_AUDIT_PROTOCOL'});
 }
});

test('duplicate failure records retain rejection and every required source and candidate anchor',()=>{
    const input=audit.build(messages,'Both conditions hold.','Old.',{}),body={messages:[{content:'FIMI_FINAL_AUDIT_V1'},{content:JSON.stringify(input)}]};
    const data=JSON.parse(mockFinalAudit(body).choices[0].message.content),rule=data.checks[0].id;
    data.verdict='reject';data.checks[0]={id:rule,status:'fail',reason:'A material contradiction.'};
    data.findings=[{rule,field:'f0',quote:'conditions',sourceQuote:'active && value !== null',reason:'A material contradiction.'}];
    const expected=structuredClone(data);data.checks.push({...data.checks[0],reason:'See above.'});
    assert.deepEqual(audit.validate(JSON.stringify(data),input),expected);
    for(const change of [v=>v.findings=[],v=>v.findings[0].quote='invented',v=>v.findings[0].sourceQuote='invented',v=>v.verdict='pass']){
        const broken=structuredClone(data);change(broken);assert.throws(()=>audit.validate(JSON.stringify(broken),input),{code:'AI_FINAL_AUDIT_PROTOCOL'});
    }
});

test('normalized audit remains a single gate call and never changes candidate bytes',async()=>{
    const candidate='实际原文 👩‍💻\r\nBoth conditions hold.',input=audit.build(messages,candidate,'old',{});
    for(const rejected of [false,true]){
        let calls=0,observed;
        const invoke=()=>audit.run(async(_config,msgs)=>{
            calls++;const body={messages:msgs},report=JSON.parse(mockFinalAudit(body).choices[0].message.content);
            if(rejected){report.verdict='reject';report.checks[0].status='fail';report.findings=[{rule:report.checks[0].id,field:'f0',quote:'conditions',sourceQuote:'',reason:'A material contradiction.'}];}
            report.checks.push({...report.checks[0],reason:'见上。'});return JSON.stringify(report);
        },{},messages,candidate,'old',{onFinalAudit:r=>observed=r});
        if(rejected)await assert.rejects(invoke,{code:'AI_FINAL_AUDIT_REJECTED'});else assert.equal(await invoke(),candidate);
        assert.equal(calls,1);assert.equal(observed.checks.length,input.requiredChecks.length);assert.equal(observed.candidateHash,input.candidateHash);
    }
});

test('audit service failure, truncation, malformed protocol and cancellation never expose the candidate or start retry loops',async()=>{
    for(const failure of ['service','truncated','protocol','cancel']){
        let calls=0;const controller=new AbortController();
        const config={base:'https://example.org',model:'mock',sponsoredCall:async body=>{
            calls++;if(calls<3){if(calls===2&&failure==='cancel')controller.abort();return response('candidate');}
            if(failure==='service')throw Error('Upstream failed');
            if(failure==='truncated'){const r=mockFinalAudit(body);r.choices[0].finish_reason='length';return r;}
            return response('not JSON');
        }};
        await assert.rejects(()=>modelCall(config,messages,{...options,signal:controller.signal}));
        assert.equal(calls,failure==='cancel'?2:3);
    }
});
test('structured protocol repair is bounded and its applied result, not its invalid precursor, reaches the gate',async()=>{
    let calls=0;const phases=[];
    const result=await modelCall({base:'https://example.org',model:'mock',sponsoredCall:async body=>{
        calls++;if(calls===4){assert.equal(JSON.parse(body.messages[1].content).fields[0].text,'Corrected');return mockFinalAudit(body);}
        return response(calls===1?{answer:'Wrong'}:calls===2?'bad JSON':{corrections:[{path:['answer'],value:'Corrected'}]});
    }},messages,{...options,json:true,onModelRequest:(_,phase)=>phases.push(phase)});
    assert.equal(JSON.parse(result).answer,'Corrected');assert.deepEqual(phases,['draft','review','repair','final-audit']);
});
test('English audit retains Chinese source and identifiers and localized gate errors round-trip',()=>{
    const input=audit.build([{role:'user',content:JSON.stringify({source:'const 名称 = "你好";'})}],'名称 stores the greeting "你好".','',{});
    assert.equal(input.source,'const 名称 = "你好";');assert.equal(input.fields[0].text,'名称 stores the greeting "你好".');
    assert.doesNotMatch(audit.instruction({locale:'en',task:'knowledge'}),/[\u3400-\u9fff]/);
    const fs=require('node:fs'),vm=require('node:vm'),ctx=vm.createContext({});
    for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file),'utf8'),ctx);
    for(const message of Object.values(audit.failures)){
        ctx.WhoI18n.set('en');const translated=ctx.WhoI18n.error(Error(message));assert.doesNotMatch(translated,/[\u3400-\u9fff]/);assert.notEqual(translated,ctx.WhoI18n.t('请求未完成。'));
        ctx.WhoI18n.set('zh-CN');assert.equal(ctx.WhoI18n.error(Error(translated)),message);
    }
});
test('final prose cannot be approved then silently clipped by a downstream display adapter',()=>{
    for(const [task,field,limit] of [['knowledge','answer',2400],['flow','explanation',1400],['overview','purpose',600],['talk','text',12000]]){
        const valid=JSON.stringify({[field]:'x'.repeat(limit)}),tooLong=JSON.stringify({[field]:'x'.repeat(limit)+' Only if both conditions hold.'});
        assert.doesNotThrow(()=>audit.build(messages,valid,'', {task,json:true}));
        assert.throws(()=>audit.build(messages,tooLong,'',{task,json:true}),{code:'AI_FINAL_TEXT_LIMIT'});
    }
});
