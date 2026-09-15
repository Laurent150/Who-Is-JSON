const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { config } = require('./parsers/config');
const { javascript } = require('./parsers/javascript');
const { html, css, sql } = require('./parsers/web-data');
const { result } = require('./parsers/common');
const descriptions = {
    function: ['把一组步骤包装成可以再次调用的功能。定义函数通常不会立即执行它，调用时才会进入。', '先准备参数，再调用函数。返回值是否存在，要看函数体；也可能直接修改外部状态。', '函数：为一组操作取名字，方便重复使用。'],
    loop: ['重复执行这部分操作。需要结合循环条件、数据长度以及 break 等语句判断何时结束。', '观察每轮处理的对象、变化的变量，以及退出条件。', '循环：把需要重复做的事交给计算机。'],
    condition: ['根据条件选择是否执行这一段。不同输入可能走向不同分支。', '先找到判断条件，再分别试想条件成立和不成立时的结果。', '条件判断：满足条件才做某件事。'],
    class: ['把相关的数据和操作组织到一起。具体用途要结合里面的方法及调用位置判断。', '先看如何创建对象，再看对象保存的数据和提供的方法。', '类：描述一类事物具有哪些数据和操作。'],
    error: ['在操作出错时进入对应的处理路径。捕获错误不意味着问题一定被解决。', '查看它尝试做什么、捕获哪类错误、出错后如何回应。', '异常处理：为失败情况准备应对步骤。'],
    module: ['这里是文件级别的代码，包括准备工作、调用或配置。请结合函数定义和使用位置阅读。', '先找程序入口，以及在文件顶层直接执行的语句。', '模块：组织在同一文件里的相关代码。']
};
function detect(code, name = '') {
    const named=require('./public/file-types').language(name);
    if(named)return named;
    if(require('./public/gitignore-syntax').evidence(code))return 'Gitignore';
    if (require('./parsers/dockerfile-reader').evidence(code)) return 'Dockerfile';
    if (require('./parsers/shell-detect').shellEvidence(code))
        return 'Shell';
    if (/^\s*(async\s+)?def\s+\w+\s*\(/m.test(code) || /^\s*(from\s+\w+\s+import|import\s+\w+\s*$)/m.test(code))
        return 'Python';
    if (/^\s*[\[{]/.test(code) && (/"[^"]+"\s*:/.test(code) || /^\s*\[/.test(code)))
        return 'JSON';
    if (/^\s*(?:<!doctype\s+html|<html\b|<(?:div|h1|p|section|body)\b)/i.test(code))
        return 'HTML';
    if (/^\s*(SELECT\b|CREATE\s+TABLE\b|INSERT\s+INTO\b|UPDATE\b|DELETE\s+FROM\b)/im.test(code))
        return 'SQL';
    if (/^(?:on|jobs|services|apiVersion|lockfileVersion):/m.test(code) || (/^name:/m.test(code) && /^\s*(?:steps|uses):/m.test(code)))
        return 'YAML';
    if (/\b(?:export\s+)?(?:interface|type)\s+\w+/.test(code) || /\b(?:const|let)\s+\w+\s*:\s*(?:string|number|boolean)/.test(code))
        return 'TypeScript';
    if (/\b(?:public\s+|private\s+|protected\s+)?(?:class|interface|enum)\s+\w+/.test(code) && /\b(?:package|import\s+java\.|public\s+static|private\s+|implements|int\s+)\b/.test(code))
        return 'Java';
    if (/\b(function|const|let)\b|=>/.test(code))
        return 'JavaScript';
    if (/[^{}]+\{\s*(?:--[\w-]+|color|display|margin|padding|font-size|background)[\w-]*\s*:/.test(code))
        return 'CSS';
    return '未确定';
}
// A conservative lexical fallback. It masks comments and strings before finding blocks.
function mask(code) { return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, s => s.replace(/[^\n]/g, ' ')); }
function heuristic(code) {
    const lines = mask(code).split('\n'), blocks = [];
    for (let i = 0; i < lines.length; i++) {
        let s = lines[i], kind = '', title = '', inputs = '';
        let m;
        if (m = s.match(/\b(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/)) {
            kind = 'function';
            title = m[1];
            inputs = m[2];
        }
        else if (m = s.match(/\b(?:const|let|var)\s+(\w+)\s*=.*=>/)) {
            kind = 'function';
            title = m[1];
        }
        else if (m = s.match(/\bclass\s+(\w+)/)) {
            kind = 'class';
            title = m[1];
        }
        else if (/\b(for|while)\s*\(/.test(s)) {
            kind = 'loop';
            title = '重复处理';
        }
        else if (/\bif\s*\(/.test(s)) {
            kind = 'condition';
            title = '条件判断';
        }
        else if (/\btry\s*\{/.test(s)) {
            kind = 'error';
            title = '处理失败情况';
        }
        if (!kind)
            continue;
        let end = i, depth = 0, started = false;
        for (let j = i; j < lines.length; j++) {
            for (const c of lines[j]) {
                if (c === '{') {
                    depth++;
                    started = true;
                }
                if (c === '}')
                    depth--;
            }
            end = j;
            if (started && depth <= 0)
                break;
            if (!started)
                break;
        }
        blocks.push({ kind, title, inputs, start: i + 1, end: end + 1 });
    }
    return blocks;
}
function enrich(b, lines) { let d = descriptions[b.kind] || descriptions.module; return { ...b, purpose: b.purpose || d[0], usage: b.usage ?? d[1], concept: b.concept || d[2], output: b.output ?? '需要结合代码中的返回、赋值或外部操作判断。', dependencies: '复制这几行不一定就能用：它可能还需要文件其他位置准备的数据或工具。', code: lines.slice(b.start - 1, b.end).join('\n') }; }
function analyze(code, name, python) {
    if (typeof code !== 'string' || !code.trim())
        return result('未确定', '未解析', '请先放入代码', '粘贴或拖入源码文件即可开始。', [], [], 'empty');
    const input = require('./source-input').sourceInput(code);
    if (input.changed) {
        const parsed = analyze(input.code, name && path.extname(name) !== '.txt' ? name : input.extension ? 'clipboard' + input.extension : name, python);
        parsed.warnings = parsed.warnings || [];
        parsed.warnings.unshift(...input.changes.map(x => x + ' 编辑框原文及行号保持不变。'));
        parsed.outerFenceIgnored = !!(input.wrapped || parsed.outerFenceIgnored);
        parsed.formatChanges = [...input.changes, ...(parsed.formatChanges || [])];
        parsed.normalizedCode = parsed.normalizedCode || input.code;
        const original = code.split('\n'), normalized = input.code.split('\n');
        const seen = new Set();
        function remap(x) { if (!x || typeof x !== 'object' || seen.has(x))
            return; seen.add(x); if (Number.isInteger(x.startColumn)) {
            for (const key of ['start', 'end']) {
                const i = x[key] - 1, raw = original[i] || '', clean = normalized[i] || '';
                const shift = clean && raw.endsWith(clean) ? raw.length - clean.length : raw === clean ? 0 : null;
                if (shift === null) {
                    delete x.startColumn;
                    delete x.endColumn;
                    break;
                }
                x[key + 'Column'] += shift;
            }
        } for (const value of Object.values(x))
            if (value && typeof value === 'object')
                Array.isArray(value) ? value.forEach(remap) : remap(value); }
        parsed.blocks.forEach(remap);
        (parsed.reading || []).forEach(remap);
        for (const b of parsed.blocks) {
            b.normalizedCode = b.normalizedCode || b.code;
            b.code = code.split('\n').slice(b.start - 1, b.end).join('\n');
        }
        return parsed;
    }
    const language = detect(code, name), lines = code.split('\n');
    let recovery = {}, blocks = [], parser = '启发式结构识别', warnings = [];
    let parsed;
    try {
        if (language === 'Gitignore')
            parsed = require('./parsers/gitignore').gitignore(code);
        else if (language === 'JSON')
            parsed = require('./parsers/json-config').jsonConfig(code, name);
        else if (language === 'YAML')
            parsed = config(code, name, language);
        else if (['JavaScript', 'TypeScript'].includes(language))
            parsed = javascript(code, name, language);
        else if (language === 'Dockerfile')
            parsed = require('./parsers/dockerfile').dockerfile(code);
        else if (language === 'Shell')
            parsed = require('./parsers/shell').shell(code);
        else if (language === 'Java')
            parsed = require('./parsers/java').java(code);
        else if (language === 'HTML')
            parsed = html(code);
        else if (language === 'CSS')
            parsed = css(code);
        else if (language === 'SQL')
            parsed = sql(code);
    }
    catch (e) {
        parsed = result(language, '解析未完成', '没有完成这份内容的解析', '原文保留。当前解析器无法处理这一写法，请尝试较小片段或 AI 分析。', [], [String(e.message).slice(0, 200)], 'invalid');
    }
    if (parsed) {
        parsed.inputFormatIssue = /^\s*```/m.test(code);
        if (language!=='Gitignore'&&/&#(?:x20|32);|^```|\\_|\\@/m.test(code))
            parsed.warnings.unshift('检测到复制格式痕迹。可点击“清理复制格式”预览修改；软件不会自动修改原文。');
        if (parsed.blocks.length > 60) {
            parsed.warnings.push(`共识别 ${parsed.blocks.length} 个结构，先展示前 60 个。可粘贴更小的片段查看其余内容。`);
            parsed.blocks = [...parsed.blocks.filter(b => b.reusable), ...parsed.blocks.filter(b => !b.reusable)].slice(0, 60).sort((a, b) => a.start - b.start || b.end - a.end);
        }
        return parsed;
    }
    if (language === 'Python' && python) {
        const r = spawnSync(python, [path.join(__dirname, 'analyze.py')], { input: code, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 12000, windowsHide: true, maxBuffer: 24e6 });
        try {
            const p = JSON.parse(r.stdout);
            blocks = p.blocks;
            parser = p.parser;
            warnings = p.warnings;
            recovery = { reading: p.reading, guide: p.guide, framework:p.framework, syntaxErrors: !!p.syntaxErrors, partialRecovery: !!p.partialRecovery, unexplained: p.unexplained || [] };
        }
        catch {
            warnings.push(r.error?.code==='ETIMEDOUT'?'Python 分析超过时间限制；请按函数拆分后再试。':r.error?.code==='ENOBUFS'?'分析结果超过容量限制；请拆分文件后再试。':'Python 分析未完成；当前无法可靠解释，请查看文件格式或运行环境。');
        }
    }
    else
        return result(language, '尚未支持本地解析', language === '未确定' ? '暂未确定内容类型。' : `已识别为 ${language}，但尚未提供可靠的本地讲解。`, '没有生成通用模板冒充解释。可以提供文件名、换成受支持的文件，或连接 AI。', [], ['本地支持 Python、JavaScript、TypeScript、Java、Shell、Dockerfile、Gitignore、JSON、YAML、HTML、CSS、SQL。'], 'unsupported');
    if (!blocks.length)
        return { ...recovery, ...result(language, parser, '未读到可讲解的函数或控制结构。', '可能是纯数据、短片段，或语法尚不完整。请结合下面的提示查看。', [], warnings, warnings.length ? 'invalid' : 'partial') };
    blocks = blocks.map(b => enrich(b, lines));
    const counts = blocks.reduce((a, b) => (a[b.kind] = (a[b.kind] || 0) + 1, a), {});
    if(blocks.length>60){
        const functions=blocks.filter(b=>b.kind==='function');
        blocks=blocks.filter(b=>!['condition','loop','error'].includes(b.kind)||!functions.some(f=>f.start<=b.start&&f.end>=b.end));
    }
    if (blocks.length > 60) {
        warnings.push(`识别到 ${blocks.length} 个结构，先展示前 60 个。`);
        blocks = [...blocks.filter(b => b.kind === 'function'), ...blocks.filter(b => b.kind !== 'function')].slice(0, 60).sort((a,b)=>a.start-b.start||b.end-a.end);
    }
    return { ...recovery, language, parser, mode: 'local', status: warnings.length ? 'partial' : 'ready', summary: `这份 Python 代码包含 ${counts.function || 0} 个函数、${counts.loop || 0} 处重复处理、${counts.condition || 0} 处条件判断。`, purpose: '点开功能，先看它处理哪些输入、走哪些步骤，再查看名字来源。源码未执行，复杂业务用途仍需更多上下文。', warnings, blocks };
}
const buildInfo = require('./build-info');
module.exports = { detect, analyze: (...args) => {
    const result = require('./explanation/model').attach(analyze(...args));
    result.analysisMeta = {...buildInfo, inputSha256:require('node:crypto').createHash('sha256').update(args[0] || '').digest('hex'),inputBytes:Buffer.byteLength(args[0] || ''),language:result.language};
    return result;
}, heuristic };
