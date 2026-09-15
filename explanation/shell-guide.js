// Beginner descriptions from Bash syntax nodes, not replacements in translated text.
// Variable names are displayed separately; no business meaning is guessed from them.
function explainNode(node, api) {
    const { field, kids, text, flat, commandName } = api;
    const variables = n => [...new Set(flat(n).filter(x => x.type === 'variable_name').map(text))];
    const base = (title, purpose, why, example = '', subject = '') => ({ title, purpose, why, example, subject, basis: '依据 Bash 语法与当前步骤；没有执行命令。', limits: [] });
    function check(n) {
        if (n.type === 'test_command')
            return check(kids(n)[0]);
        if (n.type === 'unary_expression') {
            const op = text(field(n, 'operator')) || n.children.find(x => ['-z', '-n', '-f', '!'].includes(x.text))?.text;
            const arg = kids(n).filter(x => x.type !== 'test_operator').at(-1);
            const subject = variables(arg).join('、');
            if (op === '-z')
                return base('这项内容还没准备好吗？', '检查这项内容是不是空的。没有内容就走“是”，已经有内容就走“否”。', '让后面的步骤针对缺少内容的情况处理。', '例如：空文字会走“是”；已有 abc 会走“否”。空格也算内容。', subject);
            if (op === '-n')
                return base('这项内容已经有值了吗？', '检查是否已经保存了内容。有内容就走“是”，没有内容就走“否”。', '让后面的步骤根据有没有内容选择处理方式。', '例如：已有 abc 会走“是”；空文字会走“否”。这不证明内容一定有效。', subject);
            if (op === '-f')
                return base('这个位置有普通文件吗？', '检查给定位置是否对应一个普通文件。文件夹不算通过这个检查。', '在后续读取之前先检查文件是否存在。', '文件存在仍可能没有读取权限；要结合后续错误处理看。', subject);
            if (op === '!') {
                const inner = check(arg);
                if (inner)
                    return base('把检查结果反过来', `先检查：${inner.title} 原本是“是”就改为“否”，原本是“否”就改为“是”。`, '用来处理原条件不满足的情况。', '', inner.subject);
            }
        }
        if (n.type === 'binary_expression') {
            const op = text(field(n, 'operator')) || n.children.find(x => ['&&', '||'].includes(x.text))?.text;
            if (['&&', '||'].includes(op)) {
                const a = check(field(n, 'left')), b = check(field(n, 'right'));
                if (a && b)
                    return base(op === '&&' ? '两个条件都满足吗？' : '至少有一个条件满足吗？', `先检查“${a.title}”，${op === '&&' ? '通过后才检查' : '未通过才检查'}“${b.title}”。`, op === '&&' ? '两项都满足才走“是”。' : '任意一项满足就走“是”。', '', [a.subject, b.subject].filter(Boolean).join('；'));
            }
        }
        const cmd = flat(n).find(x => x.type === 'command' && commandName(x) === 'command' && kids(x).some(c => c.text === '-v'));
        if (cmd) {
            const tool = kids(cmd).at(-1)?.text, negative = flat(n).some(x => x.type === 'negated_command');
            const familiar = { security: 'macOS 管理已保存密码的工具', node: '运行 JavaScript 的工具' }[tool] || '这个命令工具';
            return base(negative ? '缺少后面要用的工具吗？' : '后面要用的工具找得到吗？', `检查能不能找到 ${familiar}（${tool}）。${negative ? '找不到走“是”，找到走“否”。' : '找到走“是”，找不到走“否”。'}`, '决定接下来是否可以尝试使用它。', '找到工具不代表后续操作一定成功。', tool);
        }
        return null;
    }
    if (['test_command', 'unary_expression', 'binary_expression', 'redirected_statement', 'negated_command', 'command'].includes(node.type)) {
        const checked = check(node);
        if (checked)
            return checked;
    }
    let assignment = node.type === 'variable_assignment' ? node : node.type === 'declaration_command' ? kids(node).find(x => x.type === 'variable_assignment') : null;
    if (assignment) {
        const name = text(field(assignment, 'name')), value = field(assignment, 'value'), cmd = value && flat(value).find(x => x.type === 'command');
        if (cmd && commandName(cmd) === 'security' && kids(cmd).some(x => x.text === 'find-generic-password'))
            return base('尝试取出系统保存的密码', '向 macOS 保存密码的地方（钥匙串）查询指定服务和账号，将命令输出保存起来。', '为后面选择可用的配置提供一个候选值。', '没有找到、访问被拒绝或命令失败时，不一定能取得密码；要看后续是否检查结果。', name);
        if (cmd && commandName(cmd) === 'node')
            return base('交给 JavaScript 处理，再收集文字结果', '用 Node.js 运行这里内嵌的 JavaScript，并把它输出的文字保存下来。内部代码的解释缺口在学习区单独列出。', '把这部分工作交给另一种语言完成，再接回外层脚本。', 'Who Is JSON 只分析这一步，不会运行里面的代码。', name);
        if (cmd)
            return base('调用一个工具，记下它输出的内容', `这里调用 ${commandName(cmd)}，并保存它输出的文字。具体从哪里取内容，要查看这个工具或函数的实现。`, '让后续步骤可以继续使用这次取得的内容。', '', name);
        if (text(value) === '""' || text(value) === "''")
            return base('先把这项内容设为空', '把之前的内容清掉，保存一段空文字。后续是否重新填入，要沿图继续看。', '为接下来的处理设置一个明确的起点。', '空文字不是数字 0，也不是一个空格。', name);
        const refs = value ? variables(value) : [];
        if (refs.length && !/%%|#/.test(text(value)))
            return base('把已有内容保存到这个名字下', `读取 ${refs.join('、')} 中的内容，用它准备左边这项值。${node.type === 'declaration_command' ? '这里的 local 将名字限制在当前函数内。' : ''}`, '让后面的步骤能通过这个名字使用内容。', '', name);
    }
    const direct = node.type === 'command' ? node : null;
    if (direct && commandName(direct) === 'break')
        return base('停止继续尝试，离开这一轮循环', '不再处理循环剩下的项目，转到循环之后的步骤。', '在当前路径下结束尝试；不会因此退出整个脚本。');
    if (direct && commandName(direct) === 'return')
        return base('到这里结束这次调用', '跳过这个函数后面剩余的步骤，回到调用它的地方。', '让不需要继续处理的情况提前结束。', 'Bash 的 return 给出成功或失败的状态；文字通常通过命令输出传出。');
    return null;
}
module.exports = { explainNode };
