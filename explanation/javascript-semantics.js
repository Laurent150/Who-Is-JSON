// Source-backed facts; no execution, dependency imports or name-only API guesses.
const ts = require('typescript');
const {span, contains} = require('../parsers/spans');

function decorate(root, block, source, checker) {
    const text = n => n?.getText(source) || '';
    const free = n => ts.isIdentifier(n) && !checker.getSymbolAtLocation(n)?.declarations?.length;
    const facts = [], related = [];
    let modifiedJSON = false;
    function mutations(n) {
        if ((ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && /^JSON\./.test(text(n.left))) || (ts.isDeleteExpression(n) && /^JSON\./.test(text(n.expression)))) modifiedJSON = true;
        ts.forEachChild(n, mutations);
    }
    mutations(source);
    function visit(n) {
        if (n !== root && ts.isFunctionLike(n)) return;
        if (ts.isCallExpression(n)) {
            let fact;
            const fn = n.expression;
            if (ts.isPropertyAccessExpression(fn) && text(fn.expression) === 'JSON' && free(fn.expression) && !modifiedJSON && ['parse','stringify'].includes(fn.name.text) && n.arguments.length) {
                const read = fn.name.text === 'parse';
                fact = {
                    id: read ? 'js.json-read' : 'js.json-write',
                    title: read ? '把 JSON 文字读成数据' : '把数据写成 JSON 文字',
                    purpose: read ? `把 ${text(n.arguments[0])} 中的 JSON 文字转换为 JavaScript 数据，供后面的步骤读取。` : `把 ${text(n.arguments[0])} 转为 JSON 文字，方便保存或传递；有些输入可能得到 undefined。`,
                    why: read ? '转换后才可以按数据形状读取属性或列表内容；解析成功不代表所需字段都存在。' : '把内存里的数据表示成可保存或传递的文字。',
                    naming: `JSON 是 JavaScript 自带对象，${fn.name.text} 是它提供的方法名；输入变量名由作者起。`,
                    limits: [read ? '格式错误会报告 SyntaxError；可选的 reviver 参数可以改变转换结果。' : '循环引用等情况可能失败；可选参数可以改变输出，转换不保证保留所有原始信息。'],
                };
            } else if (ts.isPropertyAccessExpression(fn) && fn.name.text === 'trim' && (checker.getTypeAtLocation(fn.expression).flags & ts.TypeFlags.StringLike)) {
                fact = {id:'js.trim',title:'去掉文字两端的空白',purpose:`生成 ${text(fn.expression)} 去掉首尾空白后的新文字，中间的空格保留。`,why:'让后续步骤使用整理后的文字，原字符串不会被原地修改。',naming:'trim 是字符串提供的方法名；点号前的变量名由作者起。',limits:['这里只说明字符串的标准方法；不执行调用。']};
            }
            if (fact) {
                Object.assign(fact,{subject:text(fn),input:n.arguments.map(text).join('；'),basis:'当前语法结构与 JavaScript 标准用法；未执行源码。',evidence:[{...span(n,source),label:'调用依据'}]});
                if (n.arguments.length > 1) fact.purpose += ' 本次还传入了额外参数，请结合引用源码核对自定义行为。';
                facts.push({node:n,guide:fact,...span(n,source)});
            } else if (ts.isIdentifier(fn)) {
                const d = checker.getSymbolAtLocation(fn)?.declarations?.[0];
                const target = d && (ts.isFunctionDeclaration(d) ? d : ts.isVariableDeclaration(d) && d.initializer && ts.isFunctionLike(d.initializer) ? d.initializer : null);
                if (target && target.getSourceFile() === source) related.push({...span(target,source),title:text(fn),purpose:'当前文件中找到的功能定义；点击定位。'});
            }
        }
        ts.forEachChild(n, visit);
    }
    visit(root);
    function flow(nodes) {
        for (const node of nodes || []) {
            const match = facts.find(f => contains(node, f));
            if (match && ['step','return','await'].includes(node.kind)) {
                node.guide = {...match.guide};
                node.label = match.guide.title;
                if (node.kind === 'return') node.guide.purpose += ' 这里把结果交回调用处，结束本次函数处理。';
                const p = match.node.parent;
                if (ts.isVariableDeclaration(p)) node.guide.output = '结果保存为 '+text(p.name);
            }
            for (const key of ['children','otherwise','afterLoop','handlers','afterSuccess','finalizer']) flow(node[key]);
        }
    }
    flow(block.controlFlow);
    for (const f of facts) {
        block.learning = block.learning.filter(x => !(x.gap && ['start','end','startColumn','endColumn'].every(k => x[k] === f[k])));
        block.learning.push({...span(f.node,source),id:f.guide.id,context:f.guide.purpose,why:f.guide.why});
    }
    if (block.meaning?.title) return;
    block.guide = {
        title:block.title, purpose:facts.length ? '这个功能包含以下可核对的处理：'+[...new Set(facts.map(f=>f.guide.title))].join('、')+'。完整分支和先后关系见流程图。' : block.purpose,
        input:block.inputs, output:block.output,
        why:'输入、处理步骤和结果在下面对应展示；未读取的外部实现不会按名称猜测用途。',
        basis:'当前文件语法结构与已核对的标准用法。', limits:['没有运行代码；动态调用及外部依赖的内部行为尚未确认。'],
        evidence:[{...span(root,source),label:'功能定义'}], related,
        milestones:facts.slice(0,8).map(f=>({...span(f.node,source),title:f.guide.title,purpose:f.guide.purpose})),
    };
}
module.exports = {decorate};
