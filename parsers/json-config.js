const YAML = require('yaml');
const { block, result } = require('./common');
const profiles = require('../explanation/config-profiles');
const { guide } = require('../explanation/model');
function jsonConfig(code, name) {
    let data;
    try {
        data = JSON.parse(code);
    }
    catch (e) {
        return result('JSON', 'JSON 语法解析', '这份 JSON 尚未完整读通', '保留原文，请核对提示位置；不会把未读通的数据解释成有效配置。', [], [e.message], 'invalid');
    }
    const doc = YAML.parseDocument(code, { keepSourceTokens: true });
    if (doc.errors.length)
        return result('JSON', 'JSON 结构核对', '字段结构需要核对', '存在重复字段或解析分歧，暂不推断最终生效值。', [], doc.errors.map(x => x.message.split('\n')[0]), 'invalid');
    const profile = profiles.identify(data, name);
    const lines = code.split('\n'), starts = [0];
    for (let i = 0; i < code.length; i++)
        if (code[i] === '\n')
            starts.push(i + 1);
    function position(offset) {
        let low = 0, high = starts.length;
        while (low + 1 < high) {
            const mid = (low + high) >> 1;
            if (starts[mid] <= offset)
                low = mid;
            else
                high = mid;
        }
        return { line: low + 1, column: offset - starts[low] };
    }
    function span(n) {
        const a = position(n.range[0]), z = position(n.range[1]);
        return { start: a.line, end: z.line, startColumn: a.column, endColumn: z.column };
    }
    const scalar = n => n?.toJSON();
    let count = 0;
    const warnings = [];
    function read(n, path, label, depth = 0) {
        const value = scalar(n), location = span(n), learning = [];
        const record = (id, context, extra = {}) => learning.push({ id, ...location, context, ...extra });
        const isMap = YAML.isMap(n), isList = YAML.isSeq(n);
        const known = profiles.describe(profile, path, value, data);
        const shape = isMap ? `这一组包含 ${n.items.length} 个有名称的项目。点开后逐项查看。`
            : isList ? `这一组按列表保存 ${n.items.length} 个项目。列表次序不一定是执行次序。`
                : typeof value === 'string' ? '这里保存一段文字。下方将原文与实际文字分开展示。'
                    : typeof value === 'boolean' ? `这里保存的是“${value ? '是 / 开启' : '否 / 关闭'}”这个值；具体控制什么由读取它的软件决定。`
                        : value === null ? '这里明确写了 null，表示没有具体值；它与空文字、数字 0 不同。'
                            : `这里保存数字 ${value}，具体单位由字段约定决定。`;
        record('json.' + (isMap ? 'object' : isList ? 'array' : typeof value === 'string' ? 'string' : value === null ? 'null' : typeof value), shape);
        if (typeof value === 'string' && /\\/.test(code.slice(n.range[0], n.range[1])))
            record('json.escape', 'JSON 原文包含转义。下方“实际文字”显示读取后的内容，不会执行其中的命令。');
        if (path.length)
            record('json.field', known ? '字段含义来自对应软件约定，不是 JSON 的关键字。' : '字段名或列表位置只说明如何找到内容；业务含义尚未确认。');
        if (!known && path.length)
            record('gap.json.meaning', '已读到数据结构，但尚未说明这个字段在所属软件中的具体作用。', { gap: true, label: '字段含义：' + path.join('.') });
        if (profile === 'claude' && path.at(-1) === 'command' && typeof value === 'string')
            record('gap.json.command', '没有读取引用的脚本，也没有检查命令运行环境。不能从提示或文件名断言检查内容。', { gap: true, label: '命令与外部脚本的内部行为' });
        const x = {
            ...location, kind: 'config', label: known?.[0] || label,
            path: path.join('.') || '根数据', children: [], learning,
            guide: guide({ title: known?.[0] || label, purpose: known?.[1] || shape, why: known?.[2] || '', basis: known ? '依据 ' + (profile === 'claude' ? 'Claude Code' : 'npm') + ' 的字段约定。' : '只确认了 JSON 数据结构，字段用途待确认。',
                decoded: typeof value === 'string' ? value : undefined,
                example: path.at(-1) === 'matcher' && /^(Edit|Write)(\|(Edit|Write))*$/.test(value) ? '例如：使用匹配的工具并到达当前事件时会触发；只读取文件，或由其他工具修改文件，不一定触发。' : '',
            }),
        };
        const items = isMap ? n.items.map(p => ({ node: p.value, path: [...path, String(scalar(p.key))], label: String(scalar(p.key)) }))
            : isList ? n.items.map((v, i) => ({ node: v, path: [...path, i], label: '第 ' + (i + 1) + ' 项' })) : [];
        for (const item of items) {
            if (depth >= 10 || ++count > 350) {
                record('gap.json.limit', '这组数据过大，后续项目未展开；请选择更小的片段继续。', { gap: true, label: '尚未展开的层级或项目' });
                if (!warnings.length)
                    warnings.push('配置树最多展开 350 项、10 层，其余内容保留在原文。');
                break;
            }
            x.children.push(read(item.node, item.path, item.label, depth + 1));
        }
        return x;
    }
    const root = read(doc.contents, [], '根数据');
    const flatten = n => [n, ...n.children.flatMap(flatten)];
    const roots = root.children.length ? root.children : [root];
    const blocks = roots.map(n => {
        const start = starts[n.start - 1] + n.startColumn, end = starts[n.end - 1] + n.endColumn;
        return block(code, start, end, 'config', n.label, n.guide.purpose, {
            guide: n.guide, configurationNodes: n.children.length ? n.children : [n],
            learning: flatten(n).flatMap(x => x.learning),
            symbols: [{ name: n.path, origin: profile ? '配置软件约定的字段或项目名称' : '数据名称，读取方待确认', meaning: n.guide.purpose, rename: 'JSON 允许自定义名称，但改名是否影响使用取决于读取方，不能随意改变约定字段。' }],
        });
    });
    const overview = profiles.overview(profile, data);
    const r = result('JSON', 'JSON 语法与配置层级', overview.title, overview.purpose, blocks, warnings);
    r.guide = guide(overview);
    r.configProfile = profile || 'unknown';
    // Retain original root-level basic knowledge when the document has named groups.
    if (blocks[0] && roots[0] !== root)
        blocks[0].learning.push(...root.learning.filter(x => !x.gap));
    return r;
}
module.exports = { jsonConfig };
