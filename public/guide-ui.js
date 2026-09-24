// Shared rendering for local guides. No language or application semantics live here.
function appendTerms(host, guide) {
    const text=guide?.plain?.purpose||guide?.purpose||'',terms=(guide?.terms||[]).filter(t=>text.includes(t.name));
    if(/\bJSON\b/.test(text)&&!terms.some(t=>t.name==='JSON'))terms.push({name:'JSON',meaning:'一种按固定规则记录数据的文字格式。程序把这种文字读成数据后，可以取出里面的名称、数量等内容。'});
    if (!terms.length) return;
    const box=element('details',undefined,'guide-terms');
    box.append(element('summary','上面说明里提到的名词'));
    for(const term of terms)box.append(element('p',term.name+'：'+term.meaning));
    host.append(box);
}
function appendNameGlossary(host, symbols) {
    if(!symbols?.length)return;
    const box=element('details',undefined,'node-glossary');
    box.append(element('summary','代码里的名字 · '+symbols.length+' 个'));
    renderSymbols(box,symbols);host.append(box);
}
function appendGuideDetails(host, guide, {overview=false,symbols=[]}={}) {
    if (!guide){appendNameGlossary(host,symbols);return;}
    appendTerms(host,guide);
    if(guide.arguments?.length){
        const list=element('ol',undefined,'guide-arguments');
        host.append(element('div','这次把哪些值交给它','knowledge-label'));
        for(const arg of guide.arguments){
            const row=element('li');row.append(element('span',arg.plain+' → 交给 '),element('code',arg.name));list.append(row);
        }
        host.append(list);
    }
    const fold=overview||beginnerMode();
    const body=fold?element('details',undefined,'overview-more'):host;
    if(fold){body.append(element('summary',beginnerMode()?'深入了解':'输入、结果与处理细节'));host.append(body);}
    const plain = guide.plain || {};
    for (const [label,value] of [['需要提供什么',plain.input || guide.input],['执行后有什么变化',plain.output || guide.output]]) {
        if (!value) continue;
        if (value.length > 350) {
            const details = element('details',undefined,'guide-evidence');
            details.append(element('summary',label+' · 展开具体内容'),element('p',value,'guide-output'));
            body.append(details);
        } else body.append(element('div',label,'knowledge-label'),element('p',value,'guide-input'));
    }
    if (guide.naming)
        body.append(element('div','这些名字从哪里来','knowledge-label'),element('p',guide.naming,'guide-naming'));
    if (guide.subject)
        body.append(element('div', '对应源码中的名字', 'knowledge-label'), element('code', guide.subject, 'guide-subject'));
    if (plain.why || guide.why)
        body.append(element('div', '这一步有什么用', 'knowledge-label'), element('p', plain.why || guide.why, 'node-why'));
    if (guide.plain) {
        const expert = element('details',undefined,'guide-professional');
        expert.append(element('summary','专业说明 · 查看准确术语与类型细节'));
        for (const [label,value] of [['用途',guide.purpose],['输入',guide.input],['输出',guide.output],['作用',guide.why]])
            if(value) expert.append(element('strong',label),element('p',value));
        host.append(expert);
    }
    appendSourceParts(host, guide.parts);
    appendNameGlossary(host,symbols);
    if (guide.example)
        host.append(element('p', guide.example, 'worked-example'));
    const card = guide.id && WhoKnowledge.cards[guide.id];
    if (card && !card.walkthrough) {
        const example = element('details',undefined,'guide-example');
        example.append(element('summary','换个简单例子理解'),codeView(card.example,{language:card.language}),element('p',card.result));
        appendCodeLessons(example,card.example,card.language);
        host.append(example);
    }
    if (guide.milestones?.length) {
        const steps = element('section',undefined,'guide-milestones');
        steps.append(element('strong','已识别的处理环节 · 点选查看'),element('p','按源码位置列出；实际先后与分支以流程图为准。','tiny'));
        for (const step of guide.milestones) steps.append(guideSourceButton(step,step.title));
        body.append(steps);
    }
    if (guide.related?.length) {
        const links = element('div',undefined,'guide-related');
        links.append(element('strong','关联的本文件功能'));
        for (const ref of guide.related) links.append(guideSourceButton(ref,ref.title));
        host.append(links);
    }
    appendGuideStatus(host, guide);
    if (guide.paths) {
        const paths = element('section', undefined, 'guide-paths');
        paths.append(element('div', '选完以后，接着做什么', 'knowledge-label'));
        for (const path of guide.paths) {
            const row = element('p');
            row.append(element('strong', path.when + ' → '), document.createTextNode(path.next));
            paths.append(row);
        }
        host.append(paths);
    }
    if(guide.authorNotes?.length){const notes=element('details',undefined,'author-notes');notes.append(element('summary','作者的注释 · 未核实'),element('p',guide.authorNotes.join('\n')));host.append(notes);}
    if (guide.decoded !== undefined) {
        const panel = element('section', undefined, 'decoded-value');
        panel.append(element('div', guide.decodedLabel || '实际文字 · 已按 JSON 规则还原，不会执行', 'knowledge-label'), element('pre', guide.decoded || '（空文字）'));
        host.append(panel);
    }
}
function appendGuideStatus(host, guide, documentScope=false) {
    if(!guide.basis && !guide.evidence?.length && !guide.needsSource?.length && !guide.limits?.length && !documentScope)return;
    const details=element('details',undefined,'guide-notes');
    const missing=(guide.needsSource?.length || 0)+(guide.limits?.length || 0);
    details.append(element('summary','为什么这样解释'+(documentScope?'代码用途':'这段代码')+'？'+(missing?' · '+missing+' 项待核对':'')));
    details.append(element('p','这里列出所依据的源码，以及还缺少什么信息，帮助你判断这段解释能说明到哪一步。','tiny'));
    if(guide.basis || guide.evidence?.length) {
        const box=element('div',undefined,'guide-evidence');
        if(guide.basis) box.append(element('p',guide.basis,'tiny'));
        for(const ref of guide.evidence || []) box.append(guideSourceButton(ref,ref.label || '查看引用的源码'));
        details.append(box);
    }
    for(const [label,items] of [['需要其他源码',guide.needsSource],['这些行为还需核对',guide.limits]]) {
        if(!items?.length)continue;
        const box=element('div',undefined,'guide-limits');box.append(element('strong',label));
        const list=element('ul');for(const item of items)list.append(element('li',item));box.append(list);details.append(box);
    }
    if(documentScope)details.append(element('p','工具只阅读你提供的代码，不会替你启动项目。想确认功能是否真的可用，还需要在项目里实际试运行。','tiny'));
    host.append(details);
}
function appendSourceParts(host, parts) {
    if(!parts?.length)return;
    // Repeat punctuation only when it has a different role in this selection.
    const unique=new Map();
    for(const part of parts){const key=part.text+'\0'+part.plain;if(!unique.has(key))unique.set(key,part);}
    parts=[...unique.values()];
    const group=element('details',undefined,'source-parts');
    group.append(element('summary','逐个读懂符号与写法 · '+parts.length+' 种用法'),element('p','相同作用的重复符号合并展示，引用其中一处。点开查看解释；这里不代表全部语法已覆盖。','tiny'));
    for(const part of parts){
        const detail=element('details',undefined,'source-part');
        const summary=element('summary');summary.append(element('code',part.text),document.createTextNode(' · 第 '+(part.start+sourceOffset)+' 行'));detail.append(summary);
        detail.append(element('p',part.plain));
        const lines=analyzedSource.split('\n');
        const pre=codeView(lines.slice(part.start-1,part.end).join('\n'),{start:part.start+sourceOffset,highlight:{...part,start:part.start+sourceOffset,end:part.end+sourceOffset},className:'part-source',contextSource:analyzedSource,contextLine:part.start});
        detail.append(pre);group.append(detail);
    }
    host.append(group);
}
function guideSourceButton(ref, title) {
    const button = element('button',`${title} · 第 ${ref.start + sourceOffset}—${ref.end + sourceOffset} 行`,'guide-source-link');
    button.onclick = () => {
        const items = WhoStructure.modules(current);
        const item = items.find(x=>x.block.start===ref.start && x.block.end===ref.end) || items.filter(x=>x.block.start<=ref.start && x.block.end>=ref.end).sort((a,b)=>(a.block.end-a.block.start)-(b.block.end-b.block.start))[0];
        if (!item) return;
        const button = [...document.querySelectorAll('.module-node')][items.indexOf(item)];
        if (activeStructure !== item && activeStructure?.block !== item.block) openStructure(item,button);
        const nodes = WhoStructure.flowNodes(item.block.controlFlow || []);
        const node = nodes.filter(n=>n.start<=ref.start && n.end>=ref.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
        for(const button of document.querySelectorAll('.flow-node')) {
            const selected=!!node && Number(button.dataset.start)===node.start && Number(button.dataset.end)===node.end;
            button.classList.toggle('selected',selected);
            if(selected){
                for(let parent=button.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
                button.scrollIntoView({block:'center',inline:'nearest'});
            }
        }
        studyNode(node || {...ref,label:title,guide:ref.start===item.block.start && ref.end===item.block.end ? item.block.guide : undefined,detail:ref.purpose || '这里展示引用依据。运行验证状态单独列出。'},item.block);
        scrollToReading();
    };
    return button;
}
function renderDocumentGuide() {
    let host = $('documentGuide');
    if (!host) {
        host = element('section', undefined, 'document-guide');
        host.id = 'documentGuide';
        $('structureModules').before(host);
    }
    host.replaceChildren();
    const g = current.guide;
    if(current.aiOverview){host.hidden=false;host.append(element('span','AI 用途说明 · 请对照源码核对','line-badge'),element('h3','这份代码在做什么'),element('p',current.aiOverview.summary));return;}
    host.hidden = !g;
    if (!g)
        return;
    host.append(element('h3', g.title==='这份代码包含什么'?'代码概览':g.title), element('p', g.plain?.purpose || g.purpose));
    const evidence=element('details',undefined,'document-evidence');
    evidence.append(element('summary','用途依据与术语'));
    appendTerms(evidence,g);
    appendGuideStatus(evidence,g,true);
    host.append(evidence);
    const details = element('div', undefined, 'guide-boundaries');
    if (g.reference && /^https:\/\/(?:code\.claude\.com|docs\.docker\.com)\//.test(g.reference)) {
        const a = element('a', '查看字段文档');
        a.href = g.reference;
        a.target = '_blank';
        a.rel = 'noreferrer';
        details.append(a);
    }
    host.append(details);
}
function renderConfigurationNodes(nodes) {
    const host = element('div', undefined, 'configuration-tree');
    for (const node of nodes) {
        const row = element('div', undefined, 'configuration-item');
        const button = element('button', undefined, 'flow-node config-node');
        button.dataset.path = node.path;
        button.append(element('strong', node.guide.title), element('code', node.path), element('small', `第 ${node.start + sourceOffset}—${node.end + sourceOffset} 行`));
        button.onclick = () => { document.querySelectorAll('.flow-node').forEach(x => x.classList.toggle('selected', x === button)); studyNode(node, activeStructure.block); if (innerWidth <= 800)
            $('nodeStudy').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        row.append(button);
        if (node.children.length) {
            const children = element('details', undefined, 'configuration-children');
            children.open = node.children.length <= 4;
            children.append(element('summary', `展开 ${node.children.length} 个项目`), renderConfigurationNodes(node.children));
            row.append(children);
        }
        host.append(row);
    }
    return host;
}
