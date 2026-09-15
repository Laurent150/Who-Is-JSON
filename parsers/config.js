const YAML = require('yaml');
const { block, result, symbol } = require('./common');
function scalar(n) { if (!n)
    return null; try {
    return n.toJSON();
}
catch {
    return null;
} }
function valueText(v) { if (v === undefined || v === null)
    return '未提供或片段不完整'; return typeof v === 'string' ? v : JSON.stringify(v); }
function range(n, code) { return n?.range ? [n.range[0], n.range[2] ?? n.range[1]] : [0, code.length]; }
function config(code, name, language) {
    let doc;
    try {
        doc = YAML.parseDocument(code, { strict: true, uniqueKeys: true, keepSourceTokens: true });
    }
    catch (e) {
        return result(language, '配置解析器', '无法完整读取配置', '保留了原文。请检查缩进、括号和复制格式。', [], [e.message], 'invalid');
    }
    const warnings = doc.errors.map(e => e.message.split('\n')[0]);
    const pairs = YAML.isMap(doc.contents) ? doc.contents.items : [];
    const keys = pairs.map(p => String(scalar(p.key)));
    const get = k => pairs.find(p => String(scalar(p.key)) === k);
    let blocks = [], summary, purpose;
    if (language === 'YAML' && keys.includes('jobs') && (keys.includes('on') || keys.includes('name'))) {
        summary = '这是 GitHub Actions 自动工作流。';
        purpose = '它是一张自动办事清单：规定什么时候启动、准备什么环境，以及按什么步骤检查或构建项目。';
        for (const p of pairs) {
            const k = String(scalar(p.key)), v = scalar(p.value), [s] = range(p.key, code), [, e] = range(p.value || p.key, code);
            if (k === 'on') {
                const eventNames = typeof v === 'string' ? [v] : Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v) : [];
                let desc = eventNames.map(x => ({ push: '代码被推送时', pull_request: '拉取请求发生相应事件时', workflow_dispatch: '有人手动启动时', schedule: '到达设置的时间时' })[x] || x).join('；');
                if (v?.push?.branches)
                    desc += '。push 仅针对分支：' + v.push.branches.join('、');
                blocks.push(block(code, s, e, 'trigger', '什么时候启动', desc || '未读到有效触发规则，请核对缩进。', { symbols: [symbol('on', 'GitHub Actions 规定', '下面列出触发这份工作流的事件。', '不能任意换成自起的字段名。')] }));
                if (!eventNames.length)
                    warnings.push('on 没有读到有效事件，可能丢失缩进。');
            }
            else if (k === 'permissions')
                blocks.push(block(code, s, e, 'config', '允许自动任务做什么', `为工作流令牌声明权限：${valueText(v)}。权限约束的是这次自动任务使用的令牌。`));
            else if (k === 'concurrency')
                blocks.push(block(code, s, e, 'config', '避免同组任务重复运行', `分组规则：${v?.group ?? '未提供'}。${v?.['cancel-in-progress'] === true ? '同组有新的运行时，取消正在进行的旧运行。' : typeof v?.['cancel-in-progress'] === 'string' ? '是否取消旧运行由这个表达式决定：' + v['cancel-in-progress'] : '当前没有启用取消正在运行的旧任务。'}`));
            else if (k === 'jobs') {
                if (!YAML.isMap(p.value)) {
                    warnings.push('jobs 必须包含嵌套的任务配置，当前缩进可能已经丢失。');
                    continue;
                }
                for (const job of p.value.items) {
                    const id = String(scalar(job.key)), j = scalar(job.value), [js] = range(job.key, code), [, je] = range(job.value, code);
                    if (!j || typeof j !== 'object') {
                        warnings.push(`任务 ${id} 不完整。`);
                        continue;
                    }
                    const matrix = j.strategy?.matrix;
                    let matrixText = matrix ? '环境组合：' + JSON.stringify(matrix) + '。同一套步骤按组合重复安排。' : '';
                    blocks.push(block(code, js, je, 'job', `任务：${j.name || id}`, (j.uses ? `复用另一份工作流：${j.uses}。环境和具体步骤需查看那份文件。` : `运行环境：${j['runs-on'] || '未提供'}。`) + matrixText + (j.if ? `启动前还要满足：${j.if}。` : '') + (j.needs ? `先等待这些任务：${valueText(j.needs)}。` : '') + (j.strategy?.['fail-fast'] === false ? '某个矩阵任务失败时，不因此取消其他矩阵任务。' : ''), { usage: j['timeout-minutes'] ? `最长运行 ${j['timeout-minutes']} 分钟。` : '', symbols: [symbol(id, '作者起的任务标识', '区分这份工作流里的不同任务。', '改名时同步修改 needs 等引用它的地方。'), symbol('matrix', 'GitHub Actions 规定', '把相同检查安排到不同环境；不是源码里的 for 循环。', '保持字段名，修改里面的环境值。')] }));
                    const stepNode = YAML.isMap(job.value) ? job.value.items.find(x => scalar(x.key) === 'steps')?.value : null;
                    if (YAML.isSeq(stepNode))
                        for (const step of stepNode.items) {
                            const t = scalar(step);
                            if (!t || typeof t !== 'object')
                                continue;
                            const [ss, se] = range(step, code);
                            let desc = t.uses ? `使用现成的自动化工具：${t.uses}。` : t.run ? `运行命令：\n${t.run}` : '这一步没有读到 uses 或 run，请核对配置。';
                            if (String(t.uses).startsWith('actions/checkout@'))
                                desc = '把仓库代码取到这次任务的工作目录。';
                            if (String(t.uses).startsWith('actions/setup-node@'))
                                desc = `准备 Node.js 环境，版本要求：${t.with?.['node-version'] || '按该工具的配置决定'}。`;
                            if (t.run === 'npm ci')
                                desc = '按照项目锁文件安装依赖，用于尽量保持自动检查环境一致。';
                            if (t.run && /^npm (run |test)/.test(t.run) && t.run !== 'npm ci')
                                desc += '\n具体做什么需要查看 package.json 对应脚本，不能只凭任务名称确定。';
                            blocks.push(block(code, ss, se, 'step', t.name || t.uses || '执行命令', desc, { concept: 'uses 调用已有工具；run 直接运行命令。步骤名称是给人看的标签。' }));
                        }
                }
            }
        }
    }
    else {
        summary = `这是 ${language} 配置或数据。`;
        purpose = '按信息名称组织内容。每项的业务意义需要结合读取它的软件判断。';
        blocks = pairs.map(p => { const k = String(scalar(p.key)), [a] = range(p.key, code), [, z] = range(p.value || p.key, code); return block(code, a, z, 'config', k, '这一项保存配置内容。尚未确认读取它的软件，因此暂不推断字段的业务效果。'); });
        if (!pairs.length && doc.contents) {
            const [s, e] = range(doc.contents, code);
            blocks.push(block(code, s, e, 'config', Array.isArray(scalar(doc.contents)) ? '一组数据' : '一个数据值', valueText(scalar(doc.contents)).slice(0, 600)));
        }
    }
    return result(language, 'JSON / YAML 语法解析', summary, purpose, blocks, warnings, warnings.length ? 'partial' : 'ready');
}
module.exports = { config };
