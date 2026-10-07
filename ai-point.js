// Compact token reading in both modes; beginner passages retain method 3.
// Transport, usage accounting and cancellation stay in ai-client.rawModelCall.
const paragraphs=require('./ai-point-paragraphs');
const foundation=require('./ai-review-context');

function route(messages,options={}) {
    if(!options.explanation||options.evaluationReview)return null;
    if(options.task&&!['knowledge','ask'].includes(options.task))return null;
    let data;
    for(const message of messages)if(message.role==='user')try {
        const value=JSON.parse(message.content);
        if(typeof value?.source==='string'){data=value;break;}
    }catch{}
    if(!data)return null;
    const scope=options.task==='knowledge'?(data.selectedToken?'token':null)
        :(!options.json&&!data.selectedToken&&data.selectedSource?'passage':null);
    if(!scope||(scope==='passage'&&options.readingMode!=='beginner'))return null;
    const input={filename:data.filename||'',sourceLanguage:data.sourceLanguage||'',source:data.source,
        ...(scope==='token'?{selectedToken:Object.fromEntries(['text','line','startColumn','endColumn','sourceLine'].map(key=>[key,data.selectedToken[key]]))}
            :{selectedSource:data.selectedSource}),
        question:typeof data.question==='string'&&data.question.trim()?data.question:options.locale==='en'
            ?(scope==='token'?`Explain the selected ${data.selectedToken.text} here briefly for ${options.readingMode==='beginner'?'an adult with no programming background':'a reader with programming experience'}.`
                :'Explain the selected code here to an adult with no programming background.')
            :scope==='token'?`请简短解释选中的 ${data.selectedToken.text}，面向${options.readingMode==='beginner'?'没有编程背景的成年人':'有基础编程经验的读者'}。`
                :'请解释选中的代码段，让一个没有编程背景的成年人能看懂。'};
    return {scope,input};
}

function protocolError(phase) {
    return require('./ai-diagnostics').attach(Object.assign(Error(phase==='draft'?'AI 词语解释格式不完整，请再次点击重试。':'AI 复核格式不完整，请重试。'),{code:'AI_REVIEW_PROTOCOL'}),{aiPhase:phase});
}
function draftAnswer(raw,scope) {
    if(scope!=='token')return raw;
    let value;
    try {value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n/,'').replace(/\n```$/,''));}catch{throw protocolError('draft');}
    if(!value||Array.isArray(value)||Object.keys(value).sort().join()!=='answer,kind'||value.kind!=='definition'||typeof value.answer!=='string'||!value.answer.trim())throw protocolError('draft');
    return value.answer;
}

async function run(call,config,selection,options={}) {
    const {scope,input}=selection;
    const draftOnly=scope==='token'&&options.readingMode==='beginner';
    const prompts=options.locale==='en'?require('./ai-point-prompts-en'):require('./ai-point-prompts');
    // Verify the selection against the original source before paid dispatch.
    if(foundation.scopeFor(input,options.task).status!=='verified')throw Error('选中源码范围无效，请重新选择。');
    const tokenPrompts=require('./ai-token-prompts');
    const draftPrompt=scope==='token'?tokenPrompts.draft(options.locale,options.readingMode):prompts[scope];
    const reviewPrompt=scope==='token'?tokenPrompts.review(options.locale,options.readingMode):prompts.review(prompts[scope]);
    const messages=[{role:'system',content:draftPrompt},{role:'user',content:JSON.stringify(input)}];
    // Generate trusted context locally; do not accept context supplied in input.
    const context=draftOnly?null:await foundation.create(messages,options);
    // Neither stage appends legacy writing rules. The paragraph reviewer already
    // describes how to use the syntax context, which is absent from the draft.
    const shared={...options,explanation:false,reviewFoundation:null,reviewDraft:false};
    const raw=await call(config,messages,{...shared,usagePhase:'draft',maxTokens:2200,json:scope==='token',reviewReasoning:false});
    if(options.signal?.aborted)throw Error('AI 请求已取消。');
    const draft=draftAnswer(raw,scope);
    if(draftOnly)return deliver(draft,scope,'draft');
    const reviewed=await call(config,[{role:'system',content:reviewPrompt},
        {role:'user',content:JSON.stringify({...input,reviewContext:context,draftParagraphs:scope==='token'?[{id:'p1',text:draft}]:paragraphs.catalog(draft)})}],
        {...shared,usagePhase:'review',maxTokens:16384,json:true,reviewReasoning:true});
    let answer;
    try {answer=paragraphs.apply(draft,reviewed,scope==='token').answer;}catch{throw protocolError('review');}
    return deliver(answer,scope,'review');
}
function deliver(answer,scope,phase) {
    // The existing word-display adapter clips at 2400 characters. Never silently
    // lose a condition there. This is a display bound, not a style rule.
    if(scope==='token'&&answer.trim().length>2400)throw require('./ai-diagnostics').attach(
        Object.assign(Error('AI 解释超过本次长度限制。请选择较小范围后重试。'),{code:'AI_FINAL_TEXT_LIMIT'}),{aiPhase:phase});
    const candidate=scope==='token'?JSON.stringify({kind:'definition',answer}):answer;
    // Beginner token: one draft by explicit user choice. Standard token and
    // beginner passage: reviewed text. No final audit or automatic retry.
    return candidate;
}
module.exports={route,run,draftAnswer};
