let activeStructure = null;
function arrangeFramework(items){
    const host=$('structureModules'),buttons=[...host.querySelectorAll('.module-node')],groups=new Map();
    items.forEach((item,i)=>{const b=item.block;buttons[i].dataset.sourceStart=b.start;const outer=items.filter(x=>x.block!==b&&x.block.start<b.start&&x.block.end>=b.end).sort((a,c)=>c.block.start-a.block.start)[0];const name=outer?'嵌套在 '+WhoReading.identity(outer.block,current.language).name:b.owner||'文件直接定义的功能与准备';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(buttons[i]);});
    host.replaceChildren();host.classList.add('framework-groups');
    for(const [name,nodes] of groups){const group=element('section',undefined,'framework-group');group.append(element('h4',name),element('p',name==='文件直接定义的功能与准备'?'点击一个功能，查看内部步骤。':'下面的功能属于这一组；包含关系不代表执行顺序。','tiny'));const list=element('div',undefined,'framework-members');list.append(...nodes);group.append(list);host.append(group);}
    const box=element('details',undefined,'file-framework');box.id='fileFramework';box.append(element('summary','文件框架 · '+groups.size+' 组 · 查看引入的工具与类'));
    for(const g of current.framework?.groups||[])box.append(guideSourceButton({...g,title:g.name},g.name+' · 类，组织数据和功能'));
    const imports=current.framework?.imports||[];if(imports.length){box.append(element('p','从其他文件引入的名字：'));for(const ref of imports)box.append(guideSourceButton({...ref,title:ref.name},ref.name));}
    box.append(element('p','这里展示当前文件的框架。跨文件的完整调用关系需要更多项目源码，不能仅凭 import 推断。','tiny'));host.before(box);
}
function renderFlowViews(graph,b,m){
    const host=$('flowCanvas'),bar=element('div',undefined,'flow-view-tabs'),overview=element('section',undefined,'flow-overview'),detail=element('section',undefined,'flow-detail-view');detail.hidden=true;
    const map=element('button','框架总览'),steps=element('button','逐步展开');map.setAttribute('aria-pressed','true');steps.setAttribute('aria-pressed','false');
    const detailedLegend=$('flowLegend').textContent;const overviewLegend='先看主要环节，再展开分支、重复和错误处理。';$('flowLegend').textContent=overviewLegend;const toggle=on=>{$('flowLegend').textContent=on?overviewLegend:detailedLegend;overview.hidden=!on;detail.hidden=on;map.setAttribute('aria-pressed',String(on));steps.setAttribute('aria-pressed',String(!on));};map.onclick=()=>toggle(true);steps.onclick=()=>toggle(false);bar.append(map,steps);
    overview.append(element('p','按编号了解主要环节。判断、重复和错误处理要点开查看；编号不表示每一步都会执行。','tiny'));
    const grid=element('div',undefined,'flow-overview-grid'),focus=element('details',undefined,'flow-focus');
    graph.forEach((n,i)=>{const btn=element('button',undefined,'overview-step overview-'+n.kind);btn.dataset.start=n.start;btn.dataset.end=n.end;btn.append(element('small',String(i+1).padStart(2,'0')+' · '+({condition:'判断',loop:'重复',exception:'正常与错误路径',pattern:'模式分支',return:'交回结果',yield:'提供一项并暂停',resource:'使用与收尾',unknown:'需进一步核对'})[n.kind]||''));
        btn.lastChild.textContent=String(i+1).padStart(2,'0')+' · '+(({condition:'判断',loop:'重复',exception:'正常与错误路径',pattern:'模式分支',return:'交回结果',yield:'提供一项并暂停',resource:'使用与收尾',unknown:'需进一步核对'})[n.kind]||'处理');
        btn.append(element('span',n.guide?.title||n.label),element('small','第 '+(n.start+sourceOffset)+'—'+(n.end+sourceOffset)+' 行'));
        btn.onclick=()=>{grid.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));studyNode(n,b);focus.replaceChildren();if(['condition','loop','exception','pattern','resource','iteration','group'].includes(n.kind)){focus.append(element('summary','展开这一环节的分支与循环'),drawSequence([n],false));}scrollToReading();};grid.append(btn);});
    overview.append(grid,focus);detail.append(element('div',b.flowPresentation?.entry||(b.role==='script-entry'?'从文件顶层开始':'调用这个功能时开始'),'flow-endpoint'),drawSequence(graph));host.append(bar,overview,detail);
}
function readableTitle(b) { const id=WhoReading.identity(b,current.language);return id.title || b.guide?.plain?.title || b.guide?.title || b.meaning?.title || b.title; }
function renderStructure() {
    const items = WhoStructure.modules(current);
    activeStructure = null;
    $('functionOverview')?.remove();
    $('flowTitle').textContent = '';
    $('flowLegend').textContent = '';
    $('structureModules').replaceChildren();
    $('structureModules').classList.remove('framework-groups');
    $('fileFramework')?.remove();
    $('flowCanvas').replaceChildren();
    $('nodeStudy').replaceChildren();
    $('structureSummary').textContent = `${fileName || '代码片段'} · ${current.language} · ${items.length} 个主要功能或结构`;


    renderDocumentGuide();
    const support = element('details', undefined, 'support-overview');
    support.append(element('summary', '查看当前支持范围与已知缺口'));
    if (current.analysisMeta) support.append(element('p',`版本 ${current.analysisMeta.version} · 构建 ${current.analysisMeta.buildId} · 输入指纹 ${current.analysisMeta.inputSha256.slice(0,16)}。核对测试差异时请同时比较这三项。`,'analysis-identity tiny'));
    support.append(element('p', '识别出语言、读出结构、解释用途和提供知识卡是不同能力。下面列出本地模式的范围；不代表所有写法已覆盖。', 'tiny'));
    for (const [language, files, features, gaps] of WhoFileTypes.support) {
        const row = element('section', undefined, 'support-row');
        row.append(element('strong', language + ' · ' + files), element('p', features), element('p', '已知缺口：' + gaps, 'tiny'));
        support.append(row);
    }
    $('documentGuide').append(support);
    const roles = items.filter(x => x.block.meaning?.title).map(x => readableTitle(x.block));
    $('structureNote').textContent = (current.partialRecovery ? '部分内容未读通，只展示已恢复的结构。' : '') + (roles.length ? '这份代码包含：' + [...new Set(roles)].join('、') + '。' : '') + '下面是功能目录，排列不代表调用顺序。点选一个功能，先看用途，再沿图向下读。';
    if (current.documentKind === 'configuration') {
        $('structureNote').textContent = '这里是配置目录。点开一组，沿层级查看规则与内容；各组不代表先后执行步骤。';
        document.querySelector('.structure-root').textContent = '配置与数据分组';
    }
    else
        document.querySelector('.structure-root').textContent = '文件包含的功能 / 结构';
    if(current.navigationNote){$('structureNote').textContent=current.navigationNote;document.querySelector('.structure-root').textContent='制作阶段与参数';}
    document.querySelector('.flow-workspace').hidden=!items.length;
    if (!items.length) {
        $('structureNote').textContent = '当前没有可可靠展示的结构。请展开“格式与解析提示”查看原因。';
        return;
    }
    for (const item of items) {
        const b = item.block, btn = element('button', undefined, 'module-node');
        btn.dataset.function = b.title;
        btn.append(element('strong', readableTitle(b)));
        const identity=WhoReading.identity(b,current.language);
        if (identity.name!==readableTitle(b)) btn.append(element('code', identity.name));
        btn.append(element('small', `第 ${b.start + sourceOffset}—${b.end + sourceOffset} 行`));
        btn.append(element('small',identity.note));
        btn.onclick = () => openStructure(item, btn);
        $('structureModules').append(btn);
    }
    if(current.documentKind!=='configuration'&&['Python','JavaScript','TypeScript','Java'].includes(current.language))arrangeFramework(items);
    const entry = items.find(x=>x.block.role==='script-entry');
    const initial = entry || (current.documentKind==='configuration' ? items[0] : null);
    if(initial) openStructure(initial,[...$('structureModules').querySelectorAll('.module-node')].find(btn=>Number(btn.dataset.sourceStart)===initial.block.start || btn.dataset.function===initial.block.title));
    else {
        document.querySelector('.flow-workspace').hidden=true;
        $('structureNote').textContent='先选择下面的一个功能，查看调用它时的处理流程。这里没有确定的文件执行入口，功能排列不代表调用顺序。';
    }
}
function openStructure(item, button) {
    activeStructure = item;
    document.querySelector('.flow-workspace').hidden=false;
    if(!flowReadingSync) clearFlowReading();
    document.querySelectorAll('.module-node').forEach(n => n.classList.toggle('active', n === button));
    const b = item.block, m = b.meaning, g = b.guide;
    $('flowTitle').textContent = readableTitle(b);
    $('flowCanvas').replaceChildren();
    let intro = $('functionOverview');
    if (!intro) {
        intro = element('section', undefined, 'function-overview');
        intro.id = 'functionOverview';
        document.querySelector('.flow-workspace').before(intro);
    }
    intro.replaceChildren();
    intro.append(element('div', current.documentKind === 'configuration' ? '这组配置安排什么' : '这个功能要完成什么', 'section-label'), element('h3', readableTitle(b)), element('p', overviewPurpose(g?.plain?.purpose || g?.purpose || m?.purpose || b.purpose, !!g)));
    intro.querySelector('.section-label').append(document.createTextNode(` · 源码第 ${b.start+sourceOffset}—${b.end+sourceOffset} 行`));
    const identity=WhoReading.identity(b,current.language);if(identity.name!==readableTitle(b))intro.querySelector('h3').after(element('code',identity.name,'function-source-name'));
    appendFunctionIdentity(intro,b);
    if (!m?.title)
        appendGuideDetails(intro, g, {overview:true,symbols:b.symbols});
    if (m?.title) {
        const io = element('div', undefined, 'function-io');
        for (const [label, value] of [['交给它', m.input], ['会得到', m.output], ['这样组织的作用', m.why]]) {
            const x = element('div');
            x.append(element('strong', label), element('p', value));
            io.append(x);
        }
        intro.append(io);
        if (m.example)
            intro.append(element('p', m.example, 'worked-example'));
    }
    const graph = m?.steps || b.controlFlow;
    const links=(current.framework?.links||[]).filter(x=>x.fromStart===b.start);
    if(links.length){const row=element('div',undefined,'function-links');row.append(element('strong','这里会调用本文件中的：'));for(const ref of links){const target=WhoStructure.modules(current).find(x=>x.block.start===ref.toStart);if(!target)continue;const btn=element('button',ref.name+' ↗');btn.onclick=()=>openStructure(target,$('structureModules').querySelector('.module-node[data-source-start="'+ref.toStart+'"]'));row.append(btn);}intro.append(row);}
    if (b.configurationNodes) {
        $('flowLegend').textContent = b.configurationLegend || '按包含关系展开；点一项看效果、实际文字和对应知识。';
        $('flowCanvas').append(renderConfigurationNodes(b.configurationNodes));
    }
    else if (graph?.length) {
        $('flowLegend').textContent = m?.flowType === 'expression' ? '文字是怎样组成的 · 把同一条表达式拆成几个数据整理步骤；不是多条独立执行的语句。' : '向下阅读执行步骤。黄色框是判断，蓝色框是重复；点节点查看理由和源码。长步骤可以展开。';
        if(b.flowPresentation)$('flowLegend').textContent=b.flowPresentation.legend;
        renderFlowViews(graph,b,m);
        if (!graph.at(-1)?.terminal)
            $('flowCanvas').append(element('div', b.flowPresentation?.exit || '正常完成后到达末尾；分支、返回和错误可能改变路径', 'flow-endpoint'));
    }
    else {
        $('flowLegend').textContent = '这里展示文件结构，暂不推断执行顺序。';
        const children = current.blocks.filter(c => c !== b && c.start >= b.start && c.end <= b.end);
        const btn = element('button', '查看这个结构', 'flow-node');
        btn.onclick = () => studyNode({ start: b.start, end: b.end, label: readableTitle(b), detail: b.purpose }, b);
        $('flowCanvas').append(btn);
        for (const c of children.slice(0, 30)) {
            const child = element('button', c.title, 'flow-node structure-child');
            child.onclick = () => studyNode({ start: c.start, end: c.end, label: readableTitle(c), detail: c.purpose }, c);
            $('flowCanvas').append(child);
        }
    }
    compactFlowIntro(intro,b);
    studyNode(null, b);
}
function groupSteps(nodes) { const result = []; for (let i = 0; i < nodes.length;) {
    let j = i;
    while (j < nodes.length && nodes[j].kind === 'step')
        j++;
    if (j - i >= 3) {
        const part = nodes.slice(i, j);
        result.push({ kind: 'group', start: part[0].start, end: part.at(-1).end, label: '准备和整理本次使用的数据', detail: part.map(x => x.label).join('\n'), children: part });
        i = j;
    }
    else {
        result.push(nodes[i]);
        i++;
    }
} return result; }
function drawSequence(nodes, group = true) {
    const host = element('div', undefined, 'flow-sequence');
    (group ? groupSteps(nodes) : nodes).forEach((n, i) => {
        if (i)
            host.append(element('div', '↓', 'flow-arrow'));
        const box = element('div', undefined, 'flow-group');
        const btn = element('button', undefined, 'flow-node flow-' + n.kind);
        btn.dataset.start=n.start;btn.dataset.end=n.end;
        if(n.guide?.id)btn.dataset.concept=n.guide.id;
        btn.append(element('small', ({ exception:'错误处理范围',resource:'资源使用范围',await:'等待任务',build:'制作说明',startup:'启动时的设置',condition: '判断', loop: '重复', iteration: '逐项处理', group: '合并显示的步骤', transform: '整理文字', result: '最终结果', return: '返回结果', throw: '报告错误', break: '跳出', continue: '下一轮', definition: '准备功能', unknown: '待展开' })[n.kind] || '处理'), element('span', n.guide?.title || n.label), element('small', `第 ${n.start + sourceOffset}—${n.end + sourceOffset} 行 ↗`));
        btn.onclick = () => { document.querySelectorAll('.flow-node').forEach(x => x.classList.toggle('selected', x === btn)); studyNode(n, activeStructure.block); scrollToReading(); };
        box.append(btn);
        if(n.kind==='pattern'){
            const branches=element('div',undefined,'flow-branches');
            for(const c of n.children||[]){const branch=element('section',undefined,'flow-branch');branch.append(element('strong',c.label),drawSequence(c.children||[]));branches.append(branch);}box.append(branches);
        }
        if (n.kind === 'condition') {
            const branches = element('div', undefined, 'flow-branches');
            for (const [label, children] of [[n.guide ? '是' : '成立', n.children], [n.guide ? '否' : '不成立', n.otherwise]]) {
                const branch = element('div', undefined, 'flow-branch');
                branch.append(element('div', label, 'branch-label'));
                branch.append(children?.length ? drawSequence(children) : element('p', '跳过，继续后续步骤', 'empty-path'));
                branches.append(branch);
            }
            box.append(branches);
            if (!n.terminal)
                box.append(element('div', '未提前结束的路径继续向下', 'flow-merge'));
        }
        if (n.kind === 'group' || n.kind === 'iteration') {
            const details = element('details', undefined, 'flow-details');
            details.append(element('summary', n.kind === 'group' ? `展开 ${n.children.length} 个具体步骤` : '展开每一项内部的处理'), drawSequence(n.children || [], n.kind !== 'group'));
            box.append(details);
        }
        if (n.kind === 'exception' || n.kind === 'resource') {
            const normal = element('div', undefined, 'flow-protected');
            normal.append(element('p', n.kind === 'exception' ? '正常路径 · 从这里开始尝试' : '取得资源后执行', 'branch-label'), drawSequence(n.children || []));
            box.append(normal);
            for (const handler of n.handlers || []) {
                const path = element('details', undefined, 'flow-details exception-path');
                path.append(element('summary', handler.label + ' · 查看处理路径'), drawSequence(handler.children || []));
                box.append(path);
            }
            if (n.afterSuccess?.length) {
                const path = element('details', undefined, 'flow-details');
                path.append(element('summary', 'else · 仅 try 正常结束、没有提前返回时执行'), drawSequence(n.afterSuccess));
                box.append(path);
            }
            if (n.finalizer?.length) {
                box.append(element('p', 'finally · 离开时收尾，即使此前准备返回或报告错误', 'branch-label'), drawSequence(n.finalizer));
            }
            box.append(element('p', n.kind === 'exception' ? '未处理的错误向外报告；只有未返回、未跳出且未继续报错的路径才进入后续步骤。' : '离开时调用资源的收尾操作；具体行为取决于资源实现。', 'tiny'));
        }
        if (n.kind === 'loop') {
            const body = element('div', undefined, 'loop-body');
            body.append(element('p', n.first ? '先执行一次，再检查条件' : '有下一项 / 条件成立时进入', 'branch-label'), drawSequence(n.children || []), element('p', '↶ 正常结束或 continue：进入下一轮；break：退出循环。', 'loop-return'));
            if (n.afterLoop?.length) {
                body.append(element('p', '正常结束且未 break 时，执行循环 else：', 'branch-label'), drawSequence(n.afterLoop));
            }
            box.append(body, element('div', '没有下一项 / 条件不成立 / break：退出循环', 'flow-merge'));
        }
        host.append(box);
    });
    return host;
}
function studyNode(node, b) {
    selected = b;
    if(node) openFlowReading(node,b);
    const h = $('nodeStudy');
    h.replaceChildren();
    h.scrollTop = 0;
    const a = node?.start || b.start, z = node?.end || b.end, m = b.meaning, g = node?.guide;
    h.append(element('div', node ? (current.documentKind === 'configuration' ? '当前配置 · 对照学习' : '当前步骤 · 对照学习') : (current.documentKind === 'configuration' ? '点选左侧的配置项目' : '选中一个步骤，看它如何实现'), 'section-label'), element('h3', g?.title || node?.label || readableTitle(b)));
    const concepts = { condition: '这里像一个路口：检查结果决定走哪条路径。', loop: '把同一组步骤重复用于多项数据，或重复到条件不再满足。', return: '把结果交回使用这个功能的地方，这一次处理到此结束。', break: '提前离开当前循环或 switch，不等同于退出整个函数。', continue: '跳过本轮剩余步骤，进入下一轮。', definition: '这里只是准备功能，使用时才进入它的内部。', unknown: '这一部分暂时不能准确展开，请结合源码确认。', transform: '原表达式中的一部分，用来准备最终文字。', result: '组合各部分产生的文字，作为这次调用的结果。', step: '这一步使用已有的数据，为后面的处理准备结果。' };
    h.append(element('p', node ? (g?.plain?.purpose || g?.purpose || node.detail || concepts[node.kind] || '查看下面的代码，了解这组步骤怎样完成。') : (b.configurationNodes ? '左侧是这组内容包含的项目。点开具体一项，再看它的作用和知识点。' : '左侧展示处理步骤。点一个步骤，查看它的作用、具体例子与源码。'), 'node-explanation'));
    if (!g && node?.why) {
        h.append(element('div', '为什么要这一步', 'knowledge-label'), element('p', node.why, 'node-why'));
    }
    if (!node && m?.basis)
        h.append(element('p', m.basis, 'tiny'));
    const source = analyzedSource.split('\n').slice(a - 1, z).join('\n');
    const citation = element('details', undefined, 'source-citation');
    citation.open = !!node || z - a < 12;
    citation.append(element('summary', `引用源码 · 第 ${a + sourceOffset}—${z + sourceOffset} 行`));
    const tools = element('div', undefined, 'code-tools'), copy = element('button', '复制这段源码');
    copy.onclick = async () => { try {
        await navigator.clipboard.writeText(source);
        toast('已复制原文，未改动格式。');
    }
    catch {
        toast('可在下方代码区手动选择复制。');
    } };
    tools.append(element('span', Number.isInteger(node?.startColumn) ? '浅黄色：当前步骤 · 其他文字：上下文' : '原文引用 · 此节点按行展示', 'tiny'), copy);
    citation.append(tools);
    const pre=codeView(source,{start:a+sourceOffset,highlight:Number.isInteger(node?.startColumn)?{...node,start:a+sourceOffset,end:z+sourceOffset}:null,className:'node-code',contextSource:analyzedSource,contextLine:a});
    citation.append(pre);
    appendCodeLessons(citation,source,current.language,{start:a+sourceOffset,title:'这段源码的符号与写法 · 点开逐个看',knownParts:(g?.parts||b.guide?.parts||[]).map(p=>({...p,start:p.start+sourceOffset,end:p.end+sourceOffset}))});
    h.append(citation);
    const tokens = new Set(source.match(/[A-Za-z_$][\w$]*/g) || []), symbols = (b.symbols || []).filter(s => tokens.has(s.name));
    appendGuideDetails(h, g, {symbols});
    renderKnowledge(h, node, b);
    if (node) {
        const back = element('button', current.documentKind === 'configuration' ? '回到选中的配置项目' : '回到选中的流程步骤', 'back-to-flow');
        back.onclick = () => document.querySelector('.flow-node.selected')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        h.append(back);
    }
    const save = element('button', current.documentKind === 'configuration' ? '收藏这组配置源码' : '收藏整个功能源码', 'save-function');
    save.onclick = () => saveCard(b);
    h.append(save);
}

function overviewPurpose(text, compact=true) {
    if(!compact || !text)return text;
    const first=text.match(/^.*?[。！？](?:\s|$)?/u)?.[0]?.trim();
    // Keep the retry cap visible; the full explanation remains in the details.
    const retry=text.match(/最多允许\s*(\d+)\s*轮/);
    if(first && first.length<=160)return first+(retry?' 最多尝试 '+retry[1]+' 次（包括第一次）。':'');
    return text; // Do not cut off an unfinished sentence or invent a summary.
}

function compactFlowIntro(intro,b) {
    const extra=element('div',undefined,'flow-extra');
    for(const child of [...intro.children].slice(3))extra.append(child);
    const purpose=intro.querySelector(':scope > p');
    if(purpose){extra.append(purpose);}
    if(b.aiExplanation){
        const ai=b.aiExplanation;
        intro.append(element('span','AI 解释 · 请对照源码核对','line-badge'),element('p',ai.purpose,'ai-purpose'));
        const lesson=element('details',undefined,'ai-lesson');lesson.append(element('summary','举个小例子 · 解释术语'));
        if(ai.example)lesson.append(element('p',ai.example));
        for(const term of ai.terms)lesson.append(element('p',term.name+'：'+term.meaning));
        intro.append(lesson,extra);
    }else intro.append(element('p',b.role==='script-entry'?'从这些文件顶层语句开始阅读；调用已定义的函数时，再进入对应功能。':'这里展示调用这个功能时的主要步骤。点击一个流程块，再对照下面的源码逐句阅读。','tiny'),extra);
}
