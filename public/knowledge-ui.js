const KNOWLEDGE_KEY = 'whoisjson.knowledge.v1';
function knowledgeSaved() {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    if (!raw)
        return [];
    const items = JSON.parse(raw);
    const cardFields = ['id', 'title', 'plain', 'naming', 'example', 'result', 'pitfall'];
    const valid = x => x && typeof x.id === 'string' && x.card && cardFields.every(k => typeof x.card[k] === 'string') && Array.isArray(x.sources) && x.sources.every(s => s && ['file', 'code', 'context'].every(k => typeof s[k] === 'string') && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 1 && s.end >= s.start);
    if (!Array.isArray(items) || !items.every(valid))
        throw Error('收藏数据暂时无法读取；原数据已保留，请勿清空浏览器存储。');
    return items;
}
function saveKnowledge(card, source, button) { try {
    const next = WhoKnowledge.merge(knowledgeSaved(), card, source);
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(next));
    button.textContent = '已收藏 · 可关联新源码';
    toast('已收藏知识点，相同知识点的源码会合并保存。');
}
catch (e) {
    toast(e instanceof SyntaxError ? '收藏数据暂时无法读取，原数据已保留。' : e.name === 'QuotaExceededError' ? '浏览器存储空间不足；请先导出并整理收藏。' : e.message);
} }
function knowledgeCard(entry, source, open = false) {
    const c = entry.card, card = element('details', undefined, 'knowledge-card');
    card.dataset.concept = c.id;
    card.open = open;
    card.append(element('summary', c.title));
    card.append(element('p', c.plain, 'knowledge-plain'));
    card.append(element('p', WhoLibrary.category(c)+' · '+WhoLibrary.tags(c).join(' · '), 'knowledge-meta'));
    if(c.origin==='ai')card.append(element('small','AI 知识卡 · 示例为推演'));
    const more=beginnerMode()?element('details',undefined,'knowledge-more'):card;
    if(more!==card){more.append(element('summary','写法与例子'));card.append(more);}
    if (entry.context) {
        more.append(element('div', '在这段源码里', 'knowledge-label'), element('p', entry.context));
        if (entry.why)
            more.append(element('p', entry.why, 'knowledge-why'));
    }
    more.append(element('div', '哪些名字可以自己起？', 'knowledge-label'), element('p', c.naming));
    appendRelatedSyntax(more,c);
    appendKnowledgeExample(more,c);
    card.append(element('p', '容易弄错：' + c.pitfall, 'knowledge-pitfall'));
    const save = element('button', '＋ 收藏知识点', 'save-knowledge');
    try {
        if (knowledgeSaved().some(x => x.id === c.id))
            save.textContent = '已收藏 · 关联这段源码';
    }
    catch { }
    save.onclick = () => saveKnowledge(c, source, save);
    card.append(save);
    return card;
}
function appendKnowledgeExample(host, card) {
    for(const pre of card.prerequisites || []){
        const box=element('details',undefined,'knowledge-prerequisite');box.append(element('summary',pre.name),element('p',pre.text));host.append(box);
    }
    const example=element('section',undefined,'knowledge-example');
    example.append(element('div','换个场景试试 · 独立教学例子','knowledge-label'),codeView(card.example,{language:card.language}));
    if(card.walkthrough?.length){
        example.append(element('strong','跟着例子走一遍'));
        const list=element('ol',undefined,'example-walkthrough');for(const step of card.walkthrough)list.append(element('li',step));example.append(list);
    }
    example.append(element('p',card.result,'example-result'));
    appendCodeLessons(example,card.example,card.language);
    if(card.transfer)example.append(element('p',card.transfer,'example-transfer'));
    if(card.exercise){const box=element('details');box.append(element('summary','少写这一步会怎样？'),element('p',card.exercise));example.append(box);}
    host.append(example);
}
function renderKnowledge(host, node, b) {
    const range = node || { start: b.start, end: b.end }, report = WhoKnowledge.coverage(b.learning, range), section = element('section', undefined, 'node-knowledge');
    section.append(element('h4', node ? '想学写法？从这里展开' : current.documentKind === 'configuration' ? '这组数据可以学什么' : '这个功能可以学什么'));
    const status = element('div', undefined, 'knowledge-coverage');
    status.append(element('strong', b.coverageState === 'unassessed' ? '知识覆盖尚未评估' : `已匹配 ${report.current.length} 类知识点 · 待补充 ${report.gaps.length} 类已识别内容`), element('p', '匹配到知识卡，不代表这段代码的每个细节都已解释。', 'tiny'));
    if (node && !report.precise)
        status.append(element('p', '此节点暂时只有行范围；本区按这些行提供知识，不宣称精确对应某个表达式。', 'tiny'));
    section.append(status);
    const preferred = node?.kind === 'return' ? (report.current.some(x => x.id === 'js.empty-string') ? 'js.empty-string' : 'js.hypot') : node?.kind === 'step' ? 'js.destructure' : null;
    report.current.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
    function show(entries, target) {
        let more;
        entries.forEach((entry, i) => {
            const raw = analyzedSource.split('\n').slice(entry.start - 1, entry.end).join('\n');
            const source = { file: fileName || '代码片段', language: current.language, function: b.title, start: entry.start + sourceOffset, end: entry.end + sourceOffset, startColumn: entry.startColumn, endColumn: entry.endColumn, code: raw, context: entry.context };
            const card = knowledgeCard(node?.detail === entry.context ? { ...entry, context: '' } : entry, source, false);
            if (i < 3)
                target.append(card);
            else {
                if (!more) {
                    more = element('details', undefined, 'knowledge-more');
                    more.append(element('summary', `再看 ${entries.length - 3} 个知识点`));
                    target.append(more);
                }
                more.append(card);
            }
        });
    }
    show(report.current, section);
    if (!report.current.length)
        section.append(element('p', '这部分尚未匹配到知识卡；没有列出缺口也不代表已全部讲清。', 'tiny'));
    function gaps(entries, target) { if (!entries.length)
        return; const box = element('details', undefined, 'knowledge-gaps'); box.open = false; box.append(element('summary', `还有 ${entries.length} 类内容未讲解`),element('p','这些地方还不能完整解释。展开源码或提供相关函数定义，可以继续核对。','tiny')); const list = element('ul'); for (const x of entries) {
        list.append(element('li', `${x.label || x.id} · 第 ${x.start + sourceOffset} 行`));
    } box.append(list); target.append(box); }
    gaps(report.gaps, section);
    if (report.context.length || report.contextGaps.length) {
        const context = element('details', undefined, 'knowledge-context');
        context.append(element('summary', `所在行与外层写法 · ${report.context.length} 类其他知识点`), element('p', '这些写法帮助理解上下文，并不都属于当前选中的分支。', 'tiny'));
        show(report.context, context);
        gaps(report.contextGaps, context);
        section.append(context);
    }
    host.append(section);
}
function renderKnowledgeLibrary(host) {
    host.append(element('h3', '知识卡片'));
    const catalog = element('details', undefined, 'knowledge-catalog');
    catalog.append(element('summary', '按语言浏览内置知识目录'), element('p', '这里是已经提供的教学主题，不是各语言的全部知识。具体源码的匹配情况与缺口，请在流程节点中查看。', 'tiny'));
    for (const language of ['JavaScript', 'Python', 'Java', 'Shell', 'JSON', 'Dockerfile']) {
        const entries = Object.values(WhoKnowledge.cards).filter(x => x.language === language), group = element('details');
        group.append(element('summary', language + ' · ' + entries.length + ' 个主题'));
        for (const c of entries) {
            const item = element('details', undefined, 'catalog-card');
            item.append(element('summary', c.title), element('p', c.plain), element('p', c.naming));appendKnowledgeExample(item,c);item.append(element('p', '容易弄错：' + c.pitfall));
            group.append(item);
        }
        catalog.append(group);
    }
    host.append(catalog);
    let items;
    try {
        items = knowledgeSaved();
    }
    catch (e) {
        host.append(element('p', '知识收藏暂时无法读取，原数据已保留。'));
        return;
    }
    if (!items.length)
        host.append(element('p', '点击流程节点，在知识卡片里选择“收藏知识点”。', 'tiny'));
    const controls=element('div',undefined,'knowledge-filters'),filter=element('select'),search=element('input'),list=element('div');
    filter.setAttribute('aria-label','按知识种类筛选');search.type='search';search.placeholder='搜索知识、标签或源码';search.setAttribute('aria-label','搜索收藏知识');
    const all=element('option','全部知识');all.value='';filter.append(all);
    for(const name of WhoLibrary.categories){if(!items.some(x=>WhoLibrary.category({...x.card,category:x.category||x.card.category})===name))continue;const option=element('option',name);option.value=name;filter.append(option);}
    controls.append(filter,search);host.append(controls,list);
    function draw(){list.replaceChildren();const selected=items.filter(item=>WhoLibrary.matches(item,filter.value,search.value));
    if(items.length&&!selected.length)list.append(element('p','没有符合条件的收藏。'));
    for (const item of selected) {
        const article = element('article', undefined, 'saved-knowledge');
        article.dataset.concept = item.id;
        const card = item.card, detail = element('details');
        detail.append(element('summary', card.title + ' · ' + item.sources.length + ' 处关联源码'), element('p', card.plain), element('p', card.naming));appendKnowledgeExample(detail,card);detail.append(element('p', '容易弄错：' + card.pitfall));
        for (const s of item.sources) {
            const source = element('details', undefined, 'saved-source');
            source.append(element('summary', `${s.file} · 第 ${s.start}—${s.end} 行`), element('p', s.context), codeView(s.code,{start:s.start,language:s.language||card.language}));
            detail.append(source);
        }
        article.append(detail);
        const meta=element('div',undefined,'knowledge-meta'),category=element('select');category.setAttribute('aria-label','修改知识分类：'+card.title);
        for(const name of WhoLibrary.categories){const option=element('option',name);option.value=name;category.append(option);}category.value=WhoLibrary.category({...card,category:item.category||card.category});
        category.onchange=()=>{try{const next=knowledgeSaved();const entry=next.find(x=>x.id===item.id);if(!entry)throw Error('收藏已不存在，请重新打开收藏库。');entry.category=category.value;localStorage.setItem(KNOWLEDGE_KEY,JSON.stringify(next));library();}catch(e){category.value=WhoLibrary.category({...card,category:item.category||card.category});toast(e.message);}};
        meta.append(category,element('span',WhoLibrary.tags(card).join(' · ')));if(card.origin==='ai')meta.append(element('span','AI 知识卡 · 示例为推演'));article.append(meta);
        const exportBtn = element('button', '导出知识卡');
        exportBtn.onclick = () => download('Who-Is-JSON-知识卡.md', '分类：'+WhoLibrary.category({...card,category:item.category||card.category})+'\n标签：'+WhoLibrary.tags(card).join('、')+'\n'+(card.origin==='ai'?'来源：AI 生成，示例为推演\n':'')+'\n'+WhoKnowledge.markdown(item));
        const del = element('button', '取消收藏');
        del.onclick = () => { try {
            localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledgeSaved().filter(x => x.id !== item.id)));
            library();
        }
        catch {
            toast('取消收藏失败，原数据已保留。');
        } };
        article.append(exportBtn, del);
        list.append(article);
    }
    }
    filter.onchange=draw;search.oninput=draw;draw();
}
