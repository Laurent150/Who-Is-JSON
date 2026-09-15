// Rendering and selection only. Explanations come from parser-owned reading units.
let lineReadingSelection = null, lineReadingAnchor = 1, lineReadingRequest = 0;
function renderLineReading() {
    const host = $('lineCode');
    host.replaceChildren();
    lineReadingRequest++;
    $('lineFile').textContent = (fileName || '代码片段') + ' · ' + current.language;
    const source = analyzedSource, lines = source.split('\n');
    const tokens = WhoReading.scan(source, current.language);
    const keywords = {
        Python:'def class return if elif else for in while import from as with try except finally raise pass break continue async await lambda yield True False None and or not is',
        JavaScript:'function const let var return if else for while class new async await import export from throw try catch finally true false null',
        TypeScript:'function const let var return if else for while class new async await import export from throw try catch finally interface type true false null',
        Java:'class public private protected static void return if else for while new try catch finally throw int boolean true false null'
    };
    const words = new Set((keywords[current.language] || '').split(' '));
    let offset = 0, tokenIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i], row = element('button', undefined, 'line-row');
        row.type = 'button'; row.dataset.line = i+1;
        row.setAttribute('aria-label', '第 ' + (i+1+sourceOffset) + ' 行：' + (line.trim() || '空行'));
        row.setAttribute('aria-pressed', 'false'); row.tabIndex = i ? -1 : 0;
        const number = element('span', String(i+1+sourceOffset), 'line-number');
        number.setAttribute('aria-hidden', 'true');
        const code = element('code', undefined, 'line-text');
        while (tokens[tokenIndex] && tokens[tokenIndex].end <= offset) tokenIndex++;
        for (let j = tokenIndex; j < tokens.length && tokens[j].start < offset+line.length; j++) {
            const t = tokens[j], text = source.slice(Math.max(offset,t.start),Math.min(offset+line.length,t.end));
            let kind = t.kind;
            if (kind === 'name' && words.has(t.text)) kind = 'keyword';
            code.append(element('span', text, 'line-token-' + kind));
        }
        if (!line.length) code.append(document.createTextNode(' '));
        row.append(number,code);
        row.onclick = event => {
            if (!event.shiftKey) lineReadingAnchor = i+1;
            selectReadingLines(Math.min(lineReadingAnchor,i+1),Math.max(lineReadingAnchor,i+1));
        };
        row.onkeydown = event => {
            let next;
            if (event.key === 'ArrowDown') next = Math.min(lines.length,i+2);
            if (event.key === 'ArrowUp') next = Math.max(1,i);
            if (event.key === 'Home') next = 1;
            if (event.key === 'End') next = lines.length;
            if (next === undefined) return;
            event.preventDefault();
            if (!event.shiftKey) lineReadingAnchor = next;
            selectReadingLines(Math.min(lineReadingAnchor,next),Math.max(lineReadingAnchor,next));
            host.querySelector('[data-line="'+next+'"]').focus({preventScroll:true});
            host.querySelector('[data-line="'+next+'"]').scrollIntoView({block:'nearest'});
        };
        host.append(row); offset += line.length+1;
    }
    lineReadingAnchor = 1;
    flowReadingSync=true;
    try { selectReadingLines(1); } finally { flowReadingSync=false; }
}
function selectReadingLines(start,end=start) {
    lineReadingRequest++;
    if(!flowReadingSync) syncFlowFromLine(start,end);
    const selection = WhoLineReading.select(current,analyzedSource,start,end);
    lineReadingSelection = selection;
    const context = selection.units.map(n=>n.context).filter(Boolean);
    for (const row of $('lineCode').children) {
        const line = Number(row.dataset.line), active = line>=selection.start && line<=selection.end;
        row.classList.toggle('is-selected',active);
        row.classList.toggle('is-step',!!flowReadingStep && line>=flowReadingStep.node.start && line<=flowReadingStep.node.end);
        row.classList.toggle('is-context',!active && context.some(c=>line===c.start));
        row.setAttribute('aria-pressed',String(active));
        row.tabIndex = line===start ? 0 : -1;
    }
    $('lineRange').textContent = '第 '+(selection.start+sourceOffset)+(selection.end===selection.start?'':'—'+(selection.end+sourceOffset))+' 行';
    const explanation = $('lineExplanation'); explanation.replaceChildren();
    $('lineLocal').open=true;
    $('lineAiAnswer').replaceChildren(); $('lineAiAnswer').hidden = true;
    $('lineAiBtn').disabled = false; $('lineAiBtn').textContent = '用 AI 再讲清楚';
    if (!selection.units.length) {
        explanation.append(element('p',selection.code.trim() ? '这部分暂时没有可靠的逐句解释。可以选择相邻的完整语句，或使用 AI 结合上下文补充。' : '这是空行，用来分隔代码，让相邻的步骤更容易阅读。','line-plain'));
    }
    for (const n of selection.units) {
        const article = element('article',undefined,'line-lesson');
        article.append(element('p',n.text || '这句的含义还需要更多上下文。','line-plain'));
        if (n.detail) article.append(element('p',n.detail,'line-detail'));
        if (n.context) article.append(element('p',n.context.title+' · 第 '+(n.context.start+sourceOffset)+' 行','line-context-note'));
        explanation.append(article);
    }
    const basics = $('lineBasics'); basics.replaceChildren();
    const entries = WhoLineReading.basics(selection,current,WhoKnowledge.cards);
    if (!entries.length) basics.append(element('p','这部分尚未匹配到基础知识。试着选择一条完整语句。','line-detail'));
    for (const entry of entries) {
        const item = element('details',undefined,'line-basic');
        item.append(element('summary',entry.title),element('p',entry.text));
        if (entry.example) item.append(element('pre',entry.example),element('p','示例预期：'+entry.result,'line-detail'));
        basics.append(item);
    }
}
$('lineAiBtn').onclick = async () => {
    if (!connected()) { settings(); toast('先配置 AI 服务，再点击这条语句的 AI 讲解。'); return; }
    const request = ++lineReadingRequest, sourceRevision = revision, selection = lineReadingSelection;
    const result = current, target = $('lineAiAnswer');
    $('lineAiBtn').disabled = true; $('lineAiBtn').textContent = '正在结合上下文讲解…';
    try {
        const response = await api('ask',{code:analyzedSource,config,selection:{start:selection.start,end:selection.end},
            question:'请面向初学者解释这份源码的第 '+selection.start+'—'+selection.end+' 行。结合所在函数和前后语句，但只围绕选中部分。先用一句自然中文说它做什么，再用一组很小的假设数值逐步说明怎么算，最后说明下一步做什么。新术语就地解释；只保留读懂这一句所需的知识。不要仅把运算符替换成中文，也不要猜测作者的性能动机。区分定义与调用、真实代码与假设示例。不能确定外部行为时明确说明；不声称运行过代码。'});
        if (request!==lineReadingRequest || sourceRevision!==revision || result!==current) return;
        target.replaceChildren(element('span','AI 解释 · 请对照源码核对','line-badge'),element('p',response.answer));
        $('lineLocal').before(target);$('lineLocal').open=false;
        target.hidden = false;
    } catch (error) {
        if (request===lineReadingRequest && sourceRevision===revision) {
            target.replaceChildren(element('p',error.message)); target.hidden = false;
        }
    } finally {
        if (request===lineReadingRequest && sourceRevision===revision) {
            $('lineAiBtn').disabled = false; $('lineAiBtn').textContent = '用 AI 再讲清楚';
        }
    }
};
$('lineCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(lineReadingSelection.code); toast('已复制选中语句的原文。'); }
    catch { toast('复制未完成，请从原文编辑区复制。'); }
};
$('lineEdit').onclick = () => document.body.classList.toggle('source-open');
$('lineTab').onclick = () => setMode('line');

// Flow and line views share the same source and selection; no re-analysis on navigation.
let flowReadingStep = null, flowReadingSync = false;
function resetFlowReading() {
    flowReadingStep = null;
    $('legacyStudy').open = false;
    $('flowReadingContext').hidden = true;
}
function clearFlowReading() {
    flowReadingStep = null;
    $('flowReadingContext').hidden = true;
    layoutFlowReading();
}
function layoutFlowReading() {
    const panel = $('linePanel');
    if(activeMode==='map') {
        document.querySelector('.flow-workspace').after(panel);
        panel.hidden = !flowReadingStep;
    } else {
        $('mapPanel').before(panel);
        panel.hidden = activeMode!=='line';
    }
}
function markFlowStep() {
    for(const button of document.querySelectorAll('#flowCanvas button[data-start]')) {
        const n=flowReadingStep?.node;
        const exact=!!n && Number(button.dataset.start)===n.start && Number(button.dataset.end)===n.end;
        const contains=!!n && Number(button.dataset.start)<=n.start && Number(button.dataset.end)>=n.end;
        button.classList.toggle('selected',exact);
        button.classList.toggle('contains-reading',contains&&!exact);
        button.setAttribute('aria-pressed',String(exact));
    }
}
function showFlowContext() {
    const step=flowReadingStep;
    $('flowReadingContext').hidden=!step;
    if(!step){markFlowStep();return;}
    $('flowReadingTitle').textContent=readableTitle(step.block)+' › '+(step.node.guide?.title||step.node.label||'当前步骤');
    $('flowReadingPurpose').textContent=(step.node.guide?.plain?.purpose||step.node.guide?.purpose||step.node.detail||'查看对应代码，了解这一步。')+' · 步骤范围：第 '+(step.node.start+sourceOffset)+'—'+(step.node.end+sourceOffset)+' 行';
    markFlowStep();
    const focus=document.querySelector('.flow-focus');
    if(focus && ![...focus.querySelectorAll('[data-start]')].some(b=>Number(b.dataset.start)===step.node.start))focus.open=false;
}
function openFlowReading(node,block) {
    if(flowReadingSync)return;
    flowReadingStep={node,block};
    flowReadingSync=true;
    try {
        lineReadingAnchor=node.start;
        selectReadingLines(node.start);
        showFlowContext();layoutFlowReading();
        $('lineCode').querySelector('[data-line="'+node.start+'"]')?.scrollIntoView({block:'nearest'});
    } finally {flowReadingSync=false;}
}
function scrollToReading() {
    if(activeMode==='map'&&!$('linePanel').hidden)$('flowReadingContext').scrollIntoView({block:'start',behavior:'smooth'});
}
function syncFlowFromLine(start,end) {
    // Keep the chosen parent step while drilling into its statements.
    if(flowReadingStep && start>=flowReadingStep.node.start && end<=flowReadingStep.node.end)return;
    const items=WhoStructure.modules(current);
    const candidates=[];
    for(const item of items) for(const node of WhoStructure.flowNodes(item.block.meaning?.steps||item.block.controlFlow||item.block.configurationNodes||[])) {
        if(node.start<=start && node.end>=end)candidates.push({node,block:item.block,item});
    }
    candidates.sort((a,b)=>(a.node.end-a.node.start)-(b.node.end-b.node.start));
    const match=candidates[0];
    if(!match){flowReadingStep=null;showFlowContext();return;}
    flowReadingSync=true;
    try {
        if(activeStructure?.block!==match.block)openStructure(match.item,[...$('structureModules').querySelectorAll('.module-node')].find(b=>b.dataset.function===match.block.title));
        flowReadingStep=match;showFlowContext();
    }finally{flowReadingSync=false;}
}
$('flowReadingBack').onclick=()=>{
    setMode('map');
    const target=document.querySelector('#flowCanvas .overview-step.selected, #flowCanvas .overview-step.contains-reading')||$('flowTitle');
    target.scrollIntoView({block:'center',behavior:'smooth'});
    if(target.tagName==='BUTTON')target.focus({preventScroll:true});
};
