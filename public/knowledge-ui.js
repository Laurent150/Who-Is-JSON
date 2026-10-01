var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
const KNOWLEDGE_KEY = 'whoisjson.knowledge.v1';
function knowledgeSaved() {
    const raw = WhoLibraryStore.getItem(KNOWLEDGE_KEY);
    if (!raw)
        return [];
    const items = JSON.parse(raw);
    const cardFields = ['id', 'title', 'plain', 'naming', 'example', 'result', 'pitfall'];
    const valid = x => x && typeof x.id === 'string' && x.card && cardFields.every(k => typeof x.card[k] === 'string') && Array.isArray(x.sources) && x.sources.every(s => s && ['file', 'code', 'context'].every(k => typeof s[k] === 'string') && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 1 && s.end >= s.start);
    if (!Array.isArray(items) || !items.every(valid))
        throw Error(uiText("收藏数据暂时无法读取；原数据已保留，请勿清空浏览器存储。"));
    return items;
}
function knowledgeCard(entry, source, open = false) {
    const c = entry.card, card = element('details', undefined, 'knowledge-card');
    card.dataset.concept = c.id;
    card.open = open;
    card.append(element('summary', c.title));
    card.append(element('p', c.plain, 'knowledge-plain'));
    card.append(element('p', uiText(WhoLibrary.category(c))+' · '+WhoLibrary.tags(c).join(' · '), 'knowledge-meta'));
    if(c.origin==='ai')card.append(element('small',uiText("AI 知识卡 · 示例为推演")));
    const more=beginnerMode()?element('details',undefined,'knowledge-more'):card;
    if(more!==card){more.append(element('summary',uiText("写法与例子")));card.append(more);}
    if (entry.context) {
        more.append(element('div', uiText("在这段源码里"), 'knowledge-label'), element('p', entry.context));
        if (entry.why)
            more.append(element('p', entry.why, 'knowledge-why'));
    }
    more.append(element('div', uiText("哪些名字可以自己起？"), 'knowledge-label'), element('p', c.naming));
    appendRelatedSyntax(more,c);
    appendKnowledgeExample(more,c);
    card.append(element('p', uiText("容易弄错：") + c.pitfall, 'knowledge-pitfall'));
    const snapshot=localExplanationSource(source.code,source.language||c.language,source.start,{start:1,end:source.code.split('\n').length});
    const explanation=[c.plain,entry.context,entry.why,c.naming,...(c.prerequisites||[]).map(p=>p.name+' — '+p.text),c.example,...(c.walkthrough||[]),c.result,c.transfer,c.exercise,c.pitfall].filter(Boolean).join('\n\n');
    appendExplanationSave(card,explanation,snapshot,c.title,c.origin||'local');
    return card;
}
function appendKnowledgeExample(host, card) {
    for(const pre of card.prerequisites || []){
        const box=element('details',undefined,'knowledge-prerequisite');box.append(element('summary',pre.name),element('p',pre.text));host.append(box);
    }
    const example=element('section',undefined,'knowledge-example');
    example.append(element('div',uiText("换个场景试试 · 独立教学例子"),'knowledge-label'),codeView(card.example,{language:card.language,indentHints:false}));
    if(card.walkthrough?.length){
        example.append(element('strong',uiText("跟着例子走一遍")));
        const list=element('ol',undefined,'example-walkthrough');for(const step of card.walkthrough)list.append(element('li',step));example.append(list);
    }
    example.append(element('p',card.result,'example-result'));
    appendCodeLessons(example,card.example,card.language);
    if(card.transfer)example.append(element('p',card.transfer,'example-transfer'));
    if(card.exercise){const box=element('details');box.append(element('summary',uiText("少写这一步会怎样？")),element('p',card.exercise));example.append(box);}
    host.append(example);
}
function renderKnowledge(host, node, b) {
    const range = node || { start: b.start, end: b.end }, report = WhoKnowledge.coverage(b.learning, range), section = element('section', undefined, 'node-knowledge');
    section.append(element('h4', node ? uiText("想学写法？从这里展开") : current.documentKind === 'configuration' ? uiText("这组数据可以学什么") : uiText("这个功能可以学什么")));
    const status = element('div', undefined, 'knowledge-coverage');
    status.append(element('strong', b.coverageState === 'unassessed' ? uiText("知识覆盖尚未评估") : uiText("已匹配 {0} 类知识点 · 待补充 {1} 类已识别内容",report.current.length,report.gaps.length)), element('p', uiText("匹配到知识卡，不代表这段代码的每个细节都已解释。"), 'tiny'));
    if (node && !report.precise)
        status.append(element('p', uiText("此节点暂时只有行范围；本区按这些行提供知识，不宣称精确对应某个表达式。"), 'tiny'));
    section.append(status);
    const preferred = node?.kind === 'return' ? (report.current.some(x => x.id === 'js.empty-string') ? 'js.empty-string' : 'js.hypot') : node?.kind === 'step' ? 'js.destructure' : null;
    report.current.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
    function show(entries, target) {
        let more;
        entries.forEach((entry, i) => {
            const raw = analyzedSource.split('\n').slice(entry.start - 1, entry.end).join('\n');
            const source = { file: fileName || uiText("代码片段"), language: current.language, function: b.title, start: entry.start + sourceOffset, end: entry.end + sourceOffset, startColumn: entry.startColumn, endColumn: entry.endColumn, code: raw, context: entry.context };
            const card = knowledgeCard(node?.detail === entry.context ? { ...entry, context: '' } : entry, source, false);
            if (i < 3)
                target.append(card);
            else {
                if (!more) {
                    more = element('details', undefined, 'knowledge-more');
                    more.append(element('summary', uiText("再看 {0} 个知识点",entries.length - 3)));
                    target.append(more);
                }
                more.append(card);
            }
        });
    }
    show(report.current, section);
    if (!report.current.length)
        section.append(element('p', uiText("这部分尚未匹配到知识卡；没有列出缺口也不代表已全部讲清。"), 'tiny'));
    function gaps(entries, target) { if (!entries.length)
        return; const box = element('details', undefined, 'knowledge-gaps'); box.open = false; box.append(element('summary', uiText("还有 {0} 类内容未讲解",entries.length)),element('p',uiText("这些地方还不能完整解释。展开源码或提供相关函数定义，可以继续核对。"),'tiny')); const list = element('ul'); for (const x of entries) {
        list.append(element('li', uiText("{0} · 第 {1} 行",x.label || x.id,x.start + sourceOffset)));
    } box.append(list); target.append(box); }
    gaps(report.gaps, section);
    if (report.context.length || report.contextGaps.length) {
        const context = element('details', undefined, 'knowledge-context');
        context.append(element('summary', uiText("所在行与外层写法 · {0} 类其他知识点",report.context.length)), element('p', uiText("这些写法帮助理解上下文，并不都属于当前选中的分支。"), 'tiny'));
        show(report.context, context);
        gaps(report.contextGaps, context);
        section.append(context);
    }
    host.append(section);
}
