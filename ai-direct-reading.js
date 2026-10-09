// Shared direct-reading strategy. Only source-derived scope selects a decoder.
// No provider, parser subprocess, account, persistence or ledger dependency.
const PROFILE='direct-reading-v1';
function protocolError(){return Object.assign(Error('AI 词语解释格式不完整，请再次点击重试。'),{code:'AI_REVIEW_PROTOCOL',diagnostics:{aiPhase:'draft'}});}
function validateSelection(input){
    if(typeof input?.source!=='string'||!input.source.trim()||Buffer.byteLength(input.source)>100000)throw Error('请选择不超过 100 KB 的源码。');
    const lines=input.source.split('\n'),token=input.selectedToken,selected=input.selectedSource;
    if(token){
        const line=lines[token.line-1];
        if(selected||!Number.isInteger(token.line)||typeof line!=='string'||!Number.isInteger(token.startColumn)||!Number.isInteger(token.endColumn)||token.startColumn<0||token.endColumn<=token.startColumn||token.endColumn>line.length||token.text!==line.slice(token.startColumn,token.endColumn)||token.sourceLine!==line)throw Error('选中源码范围无效，请重新选择。');
        return 'token';
    }
    if(!selected||!Number.isInteger(selected.start)||!Number.isInteger(selected.end)||selected.start<1||selected.end<selected.start||selected.end>lines.length||selected.code!==lines.slice(selected.start-1,selected.end).join('\n'))throw Error('选中源码范围无效，请重新选择。');
    return selected.start===selected.end?'line':'passage';
}
function prepare(input,options={}){
    const localScope=validateSelection(input),scope=localScope==='token'?'token':'passage';
    const awaitScope=['line','token'].includes(localScope)?require('./ai-point-await-line').classify(input,options.readingMode):null;
    const awaitScene=awaitScope==='line',tokenPrompts=require('./ai-token-prompts');
    const semantic=awaitScope?require('./ai-point-await-line').prompt(options.locale,options.readingMode,awaitScope):scope==='token'?tokenPrompts.semanticDraft(input,options.locale,options.readingMode,true):null;
    const prompt=semantic||(scope==='token'?tokenPrompts.draft(options.locale,options.readingMode,true)
        :require('./ai-point-contract').profile(options.locale,options.readingMode,localScope,undefined,true,input)
            +(options.locale==='en'?'\nReturn only the explanation as plain text.':'\n只返回解释正文，不使用JSON包装。'));
    return {input,scope,localScope,semantic:Boolean(semantic),json:scope==='token'||awaitScene,
        reasoningEffort:localScope==='line'&&options.readingMode!=='beginner'?'high':'low',maxTokens:6000,
        messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(input)}]};
}
// Context contains coordinates, not client-authored selected text or a decoder.
function context(input,options={}){
    const token=input.selectedToken,selected=input.selectedSource;
    return {kind:'point',locale:options.locale==='en'?'en':'zh-CN',readingMode:options.readingMode==='beginner'?'beginner':'standard',input:{
        filename:input.filename||'',sourceLanguage:input.sourceLanguage||'',source:input.source,
        ...(token?{selectedToken:{line:token.line,startColumn:token.startColumn,endColumn:token.endColumn}}:{selectedSource:{start:selected.start,end:selected.end}}),question:input.question}};
}
function fromContext(value){
    const source=value?.input?.source;
    if(typeof source!=='string'||!source.trim()||Buffer.byteLength(source)>100000)throw Error('请选择不超过 100 KB 的源码。');
    const options={locale:value.locale==='en'?'en':'zh-CN',readingMode:value.readingMode==='beginner'?'beginner':'standard'},lines=source.split('\n'),data=value.input;
    if(value.kind!=='point'||typeof data.filename!=='string'||data.filename.length>260||typeof data.sourceLanguage!=='string'||data.sourceLanguage.length>80)throw Error('选中源码范围无效，请重新选择。');
    const token=data.selectedToken,selected=data.selectedSource;
    let selection,question;
    if(token&&!selected){
        const line=lines[token.line-1];
        if(!Number.isInteger(token.line)||typeof line!=='string'||!Number.isInteger(token.startColumn)||!Number.isInteger(token.endColumn)||token.startColumn<0||token.endColumn<=token.startColumn||token.endColumn>line.length)throw Error('选中源码范围无效，请重新选择。');
        const text=line.slice(token.startColumn,token.endColumn);
        selection={selectedToken:{text,line:token.line,startColumn:token.startColumn,endColumn:token.endColumn,sourceLine:line}};
        question=options.locale==='en'?`Explain the selected ${text} here briefly for ${options.readingMode==='beginner'?'an adult with no programming background':'a reader with programming experience'}.`:`请简短解释选中的 ${text}，面向${options.readingMode==='beginner'?'没有编程背景的成年人':'有基础编程经验的读者'}。`;
    }else if(selected&&!token){
        if(!Number.isInteger(selected.start)||!Number.isInteger(selected.end)||selected.start<1||selected.end<selected.start||selected.end>lines.length)throw Error('选中源码范围无效，请重新选择。');
        selection={selectedSource:{start:selected.start,end:selected.end,code:lines.slice(selected.start-1,selected.end).join('\n')}};
        const fixed=new Set(['只解释选中代码，需要时用一个小例子帮助理解。','Explain only the selected code, using a small example when it helps.','请解释选中的代码段，让一个没有编程背景的成年人能看懂。','Explain the selected code here to an adult with no programming background.']);
        if(!fixed.has(data.question))throw Error('请只询问当前代码的含义、执行过程或问题；与这份代码无关的请求不予回答。');
        question=data.question;
    }else throw Error('选中源码范围无效，请重新选择。');
    return prepare({filename:data.filename,sourceLanguage:data.sourceLanguage,source,...selection,question},options);
}
function draftAnswer(raw,scope,transportType=false,semantic=false){
    if(scope!=='token'&&!semantic)return raw;
    let value;try{value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n/,'').replace(/\n```$/,''));}catch{throw protocolError();}
    if(!value||Array.isArray(value))throw protocolError();
    const keys=Object.keys(value).sort().join();
    if(semantic){
        const echo=value.type==='json_object',baseKeys=echo?Object.keys(value).filter(k=>k!=='type').sort().join():keys;
        if(transportType&&['effect,kind','details,effect,kind'].includes(baseKeys)&&value.kind==='definition'&&typeof value.effect==='string'&&value.effect.trim()&&(!Object.hasOwn(value,'details')||typeof value.details==='string'&&value.details.trim()))return value.effect+(Object.hasOwn(value,'details')?'\n\n'+value.details:'');
        throw protocolError();
    }
    if(transportType&&(keys==='kind,paragraphs'||keys==='kind,paragraphs,type'&&value.type==='json_object')&&value.kind==='definition'&&Array.isArray(value.paragraphs)&&value.paragraphs.length&&value.paragraphs.every(paragraph=>typeof paragraph==='string'&&paragraph.trim()))return value.paragraphs.join('\n\n');
    if(typeof value.answer!=='string'||!value.answer.trim())throw protocolError();
    if(!(keys==='answer,kind'&&value.kind==='definition')&&!(transportType&&keys==='answer,type'&&value.type==='json_object'))throw protocolError();
    return value.answer;
}
function decode(raw,prepared){
    if(typeof raw!=='string'||!raw.trim())throw protocolError();
    const answer=draftAnswer(raw,prepared.scope,true,prepared.semantic);
    if(prepared.scope==='token'&&answer.length>2400)throw Object.assign(Error('AI 解释超过本次长度限制。请选择较小范围后重试。'),{code:'AI_FINAL_TEXT_LIMIT',diagnostics:{aiPhase:'draft'}});
    return prepared.scope==='token'?JSON.stringify({kind:'definition',answer}):answer;
}
module.exports={PROFILE,prepare,context,fromContext,decode,draftAnswer,validateSelection};
