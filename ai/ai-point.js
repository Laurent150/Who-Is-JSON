// Explicit local reading uses one draft on tested official Flash.
// Standard selected lines use high reasoning; other local selections use low.
// Other provider/model paths retain their existing point-reading stages.
// Transport, usage accounting and cancellation stay in ai-client.rawModelCall.
const paragraphs=require('./ai-point-paragraphs');
const foundation=require('./ai-review-context');

// A hosted adapter's static reviewThinking flag is not deployed low support.
function supportsLow(config={}) {
    if(config.model!=='deepseek-flash'||typeof config.sponsoredCall==='function'&&config.directReadingProfile!==require('./ai-direct-reading').PROFILE)return false;
    try {return new URL(config.base).origin==='https://api.deepseek.com';}catch{return false;}
}
function route(messages,options={},config={}) {
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
    const direct=supportsLow(config)&&(scope==='token'||options.pointReading===true);
    if(!scope||(scope==='passage'&&options.readingMode!=='beginner'&&!direct))return null;
    const input={filename:data.filename||'',sourceLanguage:data.sourceLanguage||'',source:data.source,
        ...(scope==='token'?{selectedToken:Object.fromEntries(['text','line','startColumn','endColumn','sourceLine'].map(key=>[key,data.selectedToken[key]]))}
            :{selectedSource:data.selectedSource}),
        question:typeof data.question==='string'&&data.question.trim()?data.question:options.locale==='en'
            ?(scope==='token'?`Explain the selected ${data.selectedToken.text} here briefly for ${options.readingMode==='beginner'?'an adult with no programming background':'a reader with programming experience'}.`
                :direct&&options.readingMode!=='beginner'?'Explain the selected code here to a reader with programming experience.':'Explain the selected code here to an adult with no programming background.')
            :scope==='token'?`请简短解释选中的 ${data.selectedToken.text}，面向${options.readingMode==='beginner'?'没有编程背景的成年人':'有基础编程经验的读者'}。`
                :direct&&options.readingMode!=='beginner'?'请解释选中的代码段，面向有基础编程经验的读者。':'请解释选中的代码段，让一个没有编程背景的成年人能看懂。'};
    return {scope,input,direct};
}

function protocolError(phase) {
    return require('./ai-diagnostics').attach(Object.assign(Error(phase==='draft'?'AI 词语解释格式不完整，请再次点击重试。':'AI 复核格式不完整，请重试。'),{code:'AI_REVIEW_PROTOCOL'}),{aiPhase:phase});
}
function draftAnswer(raw,scope,transportType=false,semantic=false) {
    return require('./ai-direct-reading').draftAnswer(raw,scope,transportType,semantic);
}

async function run(call,config,selection,options={}) {
    const {scope,input}=selection;
    const draftOnly=scope==='token'&&options.readingMode==='beginner';
    const prompts=options.locale==='en'?require('./ai-point-prompts-en'):require('./ai-point-prompts');
    // Verify the selection against the original source before paid dispatch.
    if(foundation.scopeFor(input,options.task).status!=='verified')throw Error('选中源码范围无效，请重新选择。');
    const tokenPrompts=require('./ai-token-prompts');
    const localScope=scope==='token'?'token':require('./ai-point-contract').scopeFor(input);
    if(selection.direct&&supportsLow(config)) {
        const direct=require('./ai-direct-reading'),prepared=direct.prepare(input,options);
        const raw=await call(config,prepared.messages,
            {...options,explanation:false,reviewFoundation:null,reviewDraft:false,reviewReasoning:false,
                readingContext:direct.context(input,options),
                pointDraftLow:prepared.reasoningEffort==='low',pointDraftHigh:prepared.reasoningEffort==='high',usagePhase:'draft',maxTokens:6000,json:prepared.json});
        if(options.signal?.aborted)throw Error('AI 请求已取消。');
        return direct.decode(raw,prepared);
    }

    const wholeExplanation=localScope==='token'||localScope==='line';
    const draftPrompt=scope==='token'?tokenPrompts.draft(options.locale,options.readingMode):prompts[localScope];
    const reviewPrompt=scope==='token'?tokenPrompts.review(options.locale,options.readingMode):prompts.review(prompts[localScope]);
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
        {role:'user',content:JSON.stringify({...input,reviewContext:context,draftParagraphs:wholeExplanation?[{id:'p1',text:draft}]:paragraphs.catalog(draft)})}],
        {...shared,usagePhase:'review',maxTokens:16384,json:true,reviewReasoning:true});
    let answer;
    try {answer=paragraphs.apply(draft,reviewed,wholeExplanation).answer;}catch{throw protocolError('review');}
    return deliver(answer,scope,'review');
}
function deliver(answer,scope,phase,preserveDefinition=false) {
    // The existing word-display adapter clips at 2400 characters. Never silently
    // lose a condition there. This is a display bound, not a style rule.
    if(scope==='token'&&(preserveDefinition?answer.length:answer.trim().length)>2400)throw require('./ai-diagnostics').attach(
        Object.assign(Error('AI 解释超过本次长度限制。请选择较小范围后重试。'),{code:'AI_FINAL_TEXT_LIMIT'}),{aiPhase:phase});
    const candidate=scope==='token'?JSON.stringify({kind:'definition',answer}):answer;
    // Both direct and legacy paths keep complete text; no automatic retry.
    return candidate;
}
module.exports={route,run,draftAnswer,supportsLow};
