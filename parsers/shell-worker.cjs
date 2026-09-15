const Parser = require('web-tree-sitter'), fs = require('node:fs');
const original = fs.readFileSync(0, 'utf8');
// The original stays intact. Only identifiers containing impossible \_ inside ${...}
// trigger a labelled copy-recovery view. Do not remove unrelated escapes such as \t or \$.
const copied = (original.match(/\$\{[A-Za-z_][A-Za-z0-9_\\]*\\_[A-Za-z0-9_\\]*\}/g) || []).length >= 2;
const lines = original.split('\n'), maps = [];
const source = lines.map(line => { let out = '', map = [0]; for (let i = 0; i < line.length; i++) {
    if (copied && line[i] === '\\' && line[i + 1] === '_') {
        i++;
        out += '_';
        map.push(i + 1);
    }
    else {
        out += line[i];
        map.push(i + 1);
    }
} maps.push(map); return out; }).join('\n');
let parser;
const field = (n, k) => n.childForFieldName(k), kids = n => n.namedChildren.filter(c => c.type !== 'comment');
function span(n) { const a = n.startPosition, z = n.endPosition; return { start: a.row + 1, end: z.row + 1, startColumn: maps[a.row]?.[a.column] ?? a.column, endColumn: maps[z.row]?.[z.column] ?? z.column }; }
const flat = n => [n, ...kids(n).flatMap(flat)];
const allSyntax = n => [n, ...n.children.flatMap(allSyntax)];
const text = n => n?.text || '', short = n => text(n).replace(/\s+/g, ' ').slice(0, 85);
const commandName = n => text(field(n, 'name')).replace(/\\_/g, '_');
function unquote(s) { return /^(["']).*\1$/s.test(s) ? s.slice(1, -1) : s; }
function value(n) {
    if (!n)
        return '空值';
    const s = text(n);
    if (n.type === 'string' && kids(n).length === 1)
        return value(kids(n)[0]);
    if (n.type === 'expansion' || n.type === 'simple_expansion') {
        const name = kids(n).find(x => x.type === 'variable_name');
        if (/^\d+$/.test(text(name)))
            return '第 ' + text(name) + ' 个输入';
        if (s.includes("%%$'\\t'"))
            return '第一个制表符之前的内容';
        if (s.includes("#*$'\\t'"))
            return '第一个制表符之后的内容';
        return text(name) || short(n);
    }
    if (n.type === 'command_substitution')
        return '收集里面命令输出的文字（去掉末尾换行）';
    if (s === '""' || s === "''")
        return '空文字';
    return unquote(s).length < 70 ? '「' + unquote(s) + '」' : '这一段文字';
}
function condition(n) {
    if (!n)
        return '条件是否成立';
    if (n.type === 'test_command')
        return condition(kids(n)[0]);
    if (n.type === 'unary_expression') {
        const op = text(field(n, 'operator')) || n.children.find(c => ['!', '-z', '-n', '-f'].includes(c.text))?.text;
        const arg = kids(n).filter(c => c.type !== 'test_operator').at(-1);
        const v = value(arg);
        if (op === '-z')
            return v + ' 是否为空';
        if (op === '-n')
            return v + ' 是否已有内容';
        if (op === '-f')
            return v + ' 是否指向普通文件';
        if (op === '!')
            return '并非：' + condition(arg);
    }
    if (n.type === 'binary_expression') {
        const l = field(n, 'left'), r = field(n, 'right'), op = text(field(n, 'operator')) || n.children.find(c => ['||', '&&', '!=', '==', '='].includes(c.text))?.text;
        if (op === '||' || op === '&&')
            return condition(l) + (op === '||' ? '，或者 ' : '，并且 ') + condition(r);
        if (text(r) === "*$'\\t'*" && op === '!=')
            return value(l) + ' 是否没有制表符（两个字段的分隔符）';
        if (['!=', '==', '='].includes(op))
            return value(l) + (op === '!=' ? ' 是否不匹配 ' : ' 是否匹配 ') + value(r);
    }
    const cmd = flat(n).find(x => x.type === 'command' && commandName(x) === 'command');
    if (cmd && kids(cmd).some(x => x.text === '-v')) {
        const tool = kids(cmd).at(-1)?.text || '这个工具';
        return tool + (flat(n).some(x => x.type === 'negated_command') ? ' 是否不可用' : ' 是否可用');
    }
    return '检查命令是否成功：' + short(n);
}
function explain(n) {
    if (n.type === 'variable_assignment') {
        const name = text(field(n, 'name')), v = field(n, 'value');
        const inner = flat(n).find(x => x.type === 'command');
        if (inner && commandName(inner) === 'security' && kids(inner).some(c => c.text === 'find-generic-password'))
            return { label: '从系统钥匙串查找密码，保存到 ' + name, detail: '按服务名和账号查找条目。-w 请求输出密码；外层 $(...) 把输出保存起来。错误输出被隐藏，|| true 会把失败状态变为成功，不能据此认定找到了密码。' };
        if (inner && commandName(inner) === 'node')
            return { label: '把内嵌 JavaScript 交给 Node 处理', detail: '外层仍是 Bash。这里把 -e 后的文字交给 Node.js 处理，再收集其输出；软件仅分析这段文字，没有启动 Node 执行它。' };
        return { label: '把 ' + value(v) + ' 保存为 ' + name, detail: '等号左边是作者起的名字，右边是要保存的内容。命令替换会先取得输出，再完成赋值。' };
    }
    if (n.type === 'declaration_command') {
        if (!/^local\b/.test(text(n)))
            return { kind: 'unknown', label: '声明或导出变量，具体规则待核对', detail: '不同声明命令影响变量范围或属性，当前没有把它们都视为 local。' };
        const assignment = kids(n).find(x => x.type === 'variable_assignment');
        if (assignment) {
            const x = explain(assignment);
            x.detail = 'local 让这个名字属于当前函数的局部范围。' + x.detail;
            return x;
        }
        return { label: '准备局部变量：' + kids(n).map(short).join('、'), detail: 'local 声明函数里的局部名字；这一步没有给它填入新内容。' };
    }
    const direct = n.type === 'command' ? n : flat(n).find(c => c.type === 'command');
    const name = direct ? commandName(direct) : '';
    if (name === 'return')
        return { kind: 'return', terminal: true, label: '提前结束这次函数调用', detail: 'Bash 的 return 交回退出状态，不交回字符串；要传出文字通常用命令输出。没有给出状态时沿用最近命令的状态。' };
    if (name === 'break')
        return { kind: 'break', terminal: true, label: '停止本轮之后的循环尝试', detail: 'break 离开当前循环；循环之后的脚本仍会继续。' };
    if (name === 'echo')
        return { label: '显示提示信息', detail: '把后面的文字写到标准输出；它不负责修复导致提示的问题。' };
    if (name === 'security' && kids(direct).some(c => c.text === 'find-generic-password'))
        return { label: '按服务与账号读取钥匙串密码', detail: 'security 是 macOS 的系统工具，不是 Bash 关键字。find-generic-password 查找条目，-s 指定服务，-a 指定账号，-w 输出密码。' };
    return { label: '调用 ' + (name || '外部命令'), detail: '根据退出状态与输出继续处理。命令具体行为需要对应工具或函数的实现；下方会列出未覆盖部分。' };
}
function learning(root) {
    const out = [];
    const add = (id, n, context, why = '') => out.push({ id: 'sh.' + id, ...span(n), context, why });
    const knownCalls = new Set(['command', 'security', 'node', 'echo', 'return', 'break', 'true']);
    for (const n of flat(root)) {
        if (n.type === 'test_command')
            add('test', n, '这里检查：' + condition(n) + '。');
        if (n.type === 'if_statement' || n.type === 'elif_clause')
            add('if', n, '先检查条件，再只执行选中的一条路径。');
        if (n.type === 'for_statement')
            add('for', n, '依次尝试列出的值；break 会提前结束尝试。');
        if (n.type === 'variable_assignment')
            add('assignment', n, explain(n).label + '。');
        if (n.type === 'declaration_command' && /^local\b/.test(text(n)))
            add('local', n, '把名字限制在当前函数的局部范围。');
        if (n.type === 'declaration_command' && !/^local\b/.test(text(n)))
            out.push({ id: 'gap.sh.declaration', ...span(n), gap: true, label: '声明与导出规则', context: '这种声明的变量范围和属性尚未专门解释。' });
        if (n.type === 'function_definition')
            add('function', n, '这里只定义功能。调用它时才进入内部步骤。');
        if (n.type === 'command_substitution')
            add('substitution', n, '取得命令的标准输出，放回当前表达式。');
        if (n.type === 'file_redirect')
            add('redirect', n, '重定向输出到指定位置；/dev/null 表示丢弃。');
        if (n.type === 'list' && n.children.some(x => x.text === '||') && kids(n).at(-1)?.text === 'true')
            add('fallback', n, '前面失败时执行 true，让这组命令最后显示成功状态。');
        if (n.type === 'expansion' || n.type === 'simple_expansion') {
            const s = text(n);
            add(/%%|#/.test(s) ? 'slice' : 'expansion', n, value(n) + '。');
        }
        if (n.type === 'command') {
            const name = commandName(n);
            if (name === 'command')
                add('command', n, 'command -v 检查当前环境能否找到指定工具。');
            if (name === 'security' && kids(n).some(c => c.text === 'find-generic-password'))
                add('keychain', n, '使用 macOS 钥匙串查找条目，不是从变量名中直接拿到密钥。');
            if (name === 'return' || name === 'break')
                add(name, n, explain(n).detail);
            if (name === 'node' && kids(n).some(x => x.text === '-e'))
                add('embedded', n, 'node -e 后面是另一种语言的代码，应单独理解，不能用它决定整个文件的语言。');
            if (!knownCalls.has(name))
                out.push({ id: 'gap.sh.call', ...span(n), gap: true, label: '外部功能 ' + name, context: '没有提供该功能的实现，无法确认读取规则及失败行为。' });
        }
        if (['case_statement', 'heredoc_redirect', 'pipeline', 'subshell', 'while_statement', 'until_statement'].includes(n.type))
            out.push({ id: 'gap.sh.' + n.type, ...span(n), gap: true, label: '尚未展开的 ' + n.type, context: '已识别这一结构，但当前流程没有完整展开其行为。' });
    }
    return out;
}
let budget = 0;
function sequence(nodes) {
    const out = [];
    for (const n of nodes.filter(x => x.type !== 'comment')) {
        if (++budget > 70) {
            out.push({ ...span(n), kind: 'unknown', label: '其余步骤请缩小范围查看' });
            break;
        }
        let x;
        if (n.type === 'if_statement' || n.type === 'elif_clause') {
            const children = kids(n), cond = field(n, 'condition') || children[0], branches = children.filter(c => ['elif_clause', 'else_clause'].includes(c.type));
            const yes = children.filter(c => c.id !== cond.id && !branches.includes(c));
            let no = [];
            for (let i = branches.length - 1; i >= 0; i--) {
                if (branches[i].type === 'else_clause')
                    no = sequence(kids(branches[i]));
                else {
                    const next = sequence([branches[i]])[0];
                    next.otherwise = no;
                    next.terminal = !!next.children.at(-1)?.terminal && !!no.at(-1)?.terminal;
                    no = [next];
                }
            }
            x = { ...span(cond), kind: 'condition', label: condition(cond), detail: '结果成立就进入“成立”路径，否则看“不成立”路径。这里的检查不会把工具名当成计算变量。', children: sequence(yes), otherwise: no };
            x.terminal = !!x.children.at(-1)?.terminal && !!x.otherwise.at(-1)?.terminal;
        }
        else if (n.type === 'for_statement') {
            const body = field(n, 'body'), variable = field(n, 'variable'), values = kids(n).filter(c => c.id !== body?.id && c.id !== variable?.id);
            x = { ...span(n), kind: 'loop', label: '依次把 ' + values.map(value).join('、') + ' 交给 ' + text(variable), detail: '每轮换一个值，重复内部步骤；找到合适结果后可用 break 停止。', children: sequence(kids(body)) };
        }
        else if (n.type === 'function_definition')
            x = { ...span(n), kind: 'definition', label: '准备函数 ' + text(field(n, 'name')) + '；此处不执行函数体' };
        else if (n.type === 'while_statement' || n.type === 'until_statement')
            x = { ...span(n), kind: 'unknown', label: '条件循环已读取，完整执行路径尚未展开' };
        else
            x = { ...span(n), kind: 'step', ...explain(n) };
        const target = (n.type === 'if_statement' || n.type === 'elif_clause') ? (field(n, 'condition') || kids(n)[0]) : n;
        x.guide = require('../explanation/shell-guide').explainNode(target, { field, kids, text, flat, commandName }) || undefined;
        out.push(x);
        if (x.terminal)
            break;
    }
    return out;
}
function makeBlock(n, kind, title, nodes) {
    budget = 0;
    const localNames = flat(n).filter(x => x.type === 'variable_name').map(x => x.text);
    const symbols = [...new Set(localNames)].map(name => ({ name, origin: /^\d+$/.test(name) ? 'Bash 位置参数' : '作者使用的变量名', meaning: /^\d+$/.test(name) ? '调用函数时提供的第 ' + name + ' 项输入。' : '保存当前处理的数据；大写名称也是作者或调用环境约定，不是 Bash 关键字。', rename: '改名时应同时检查所有引用及环境变量约定。' }));
    return { ...span(n), kind, title, reusable: kind === 'function', role: kind === 'module' ? 'script-entry' : 'named-function', purpose: kind === 'module' ? '从文件入口按顺序处理下面的命令与判断。函数定义只准备功能，调用时才会执行；具体用途需要结合各步骤说明。' : '把内部步骤定义成可以调用的功能；先看参数和提前结束条件，再看输出或被更新的变量。', inputs: kind === 'function' ? '通过 $1、$2 等位置参数接收输入；也可能读取外层变量。' : '读取此前已经准备的变量，以及脚本所用工具能提供的内容。', output: '可能修改变量、输出文字或给出退出状态；Bash return 本身不返回字符串。', usage: kind === 'function' ? '以函数名和参数调用；需要 Bash 及内部依赖的工具。' : '按源码顺序执行。这里只做静态分析。', concept: 'Bash 脚本组织命令、变量与分支；退出状态和输出文字是不同的东西。', code: lines.slice(n.startPosition.row, n.endPosition.row + 1).join('\n'), symbols, learning: learning(n), controlFlow: sequence(nodes) };
}
(async () => {
    await Parser.init();
    parser = new Parser();
    parser.setLanguage(await Parser.Language.load(require.resolve('tree-sitter-wasms/out/tree-sitter-bash.wasm')));
    const tree = parser.parse(source), root = tree.rootNode;
    const errors = allSyntax(root).filter(n => n.type === 'ERROR' || n.isMissing());
    const top = kids(root), safe = top.filter(n => !n.hasError()), blocks = [];
    const main = safe.filter(n => n.type !== 'function_definition');
    if (main.length) {
        const b = makeBlock(root, 'module', '脚本入口 · 按顺序准备配置', safe);
        b.learning = safe.flatMap(learning);
        blocks.push(b);
    }
    for (const n of safe.filter(n => n.type === 'function_definition')) {
        const b = makeBlock(n, 'function', text(field(n, 'name')), kids(field(n, 'body')));
        b.purpose = require('../explanation/shell-purpose').functionPurpose(n, {flat,kids,text,commandName}) || b.purpose;
        blocks.push(b);
    }
    const warnings = ['Bash 静态解析；未执行脚本、访问文件或查询钥匙串。函数定义不代表已经调用。'];
    if (copied)
        warnings.unshift('发现变量展开中的复制转义。在分析副本中还原了 \\_，原文及高亮位置保留；引号内本来有意保留的反斜杠仍需对照确认。');
    if (errors.length)
        warnings.push('部分 Bash 结构存在错误，只展示边界完整的顶层结构。');
    if(blocks[0]?.kind === 'module') blocks[0].purpose = require('../explanation/shell-purpose').entryPurpose(safe,source,{field,kids,text}) || blocks[0].purpose;
    const embedded = flat(root).filter(n => n.type === 'command' && commandName(n) === 'node' && kids(n).some(c => c.text === '-e'));
    for (const n of embedded) {
        const args = kids(n), i = args.findIndex(c => c.text === '-e'), arg = args[i + 1];
        if (!arg)
            continue;
        const js = unquote(text(arg));
        const dynamic = flat(arg).some(c => ['expansion', 'simple_expansion', 'command_substitution'].includes(c.type));
        const ts = require('typescript'), parsed = ts.createSourceFile('embedded.js', js, ts.ScriptTarget.Latest, true);
        for (const b of blocks.filter(b => b.start <= span(n).start && b.end >= span(n).end))
            b.learning.push({ id: 'gap.sh.embedded', ...span(arg), gap: true, label: '内嵌 JavaScript 的边界', context: dynamic ? '代码中包含 Shell 展开，传给 Node 的实际文字需运行上下文才能确定。' : parsed.parseDiagnostics.length ? '这段 JavaScript 字符串未通过语法检查（例如属性前的 \\. 可能来自复制转义），不能认定能运行。' : '这段是交给 Node 的 JavaScript：语法已读取，但还未对内部每个步骤生成完整流程；JSON 字段规则和异常需单独核对。' });
    }
    process.stdout.write(JSON.stringify({ language: 'Shell', parser: 'Tree-sitter Bash 语法树', mode: 'local', status: errors.length ? 'partial' : 'ready', syntaxErrors: errors.length > 0, partialRecovery: errors.length > 0 && blocks.length > 0, summary: '已识别 Bash 外层脚本；内嵌 JavaScript 不参与外层语言判断。', purpose: blocks[0]?.purpose || '没有读到可展示结构。', blocks, warnings, normalizedCode: copied ? source : undefined, formatChanges: copied ? ['在分析副本中还原标识符的复制转义；不改变编辑框原文。'] : [], unexplained: errors.slice(0, 12).map(n => ({ ...span(n), reason: '这处 Bash 语法或边界不完整。' })) }));
    tree.delete();
    parser.delete();
})().catch(e => { process.stderr.write(e.stack); process.exitCode = 1; });
