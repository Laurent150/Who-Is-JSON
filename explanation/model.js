// Stable presentation contract. Parsers own source facts; profiles own domain meaning;
// the browser only renders this model. Optional AI can add a separately attributed guide.
function guide({ title, purpose, why = '', example = '', basis = '源码结构', limits = [], ...rest }) {
    return { title, purpose, why, example, basis, limits, ...rest };
}
function attach(result) {
    const configuration = ['JSON', 'YAML'].includes(result.language);
    result.documentKind ||= configuration ? 'configuration' : 'program';
    result.guide ||= guide({
        title: configuration ? '这份配置安排什么' : '这份代码包含什么',
        purpose: result.purpose,
        limits: ['这里只读取源码，未验证程序运行结果。'],
    });
    for (const b of result.blocks || []) {
        const m = b.meaning;
        b.guide ||= guide({
            title: m?.title || b.title,
            purpose: m?.purpose || b.purpose,
            why: m?.why || '',
            example: m?.example || '',
            input: m?.input || '',
            output: m?.output || '',
            basis: m?.basis || '依据当前源码；业务用途还需要调用位置或项目说明。',
        });
        b.coverageState = Array.isArray(b.learning) && b.learning.length ? 'partial' : 'unassessed';
        function nextSteps(nodes) {
            for (const node of nodes || []) {
                if (node.kind === 'condition' && node.guide) {
                    const next = list => list?.length ? list[0].guide?.purpose || list[0].detail || list[0].label : '跳过这组操作，继续后面的步骤。';
                    node.guide.paths = [
                        { when: '是', next: next(node.children) },
                        { when: '否', next: next(node.otherwise) },
                    ];
                }
                nextSteps(node.children);
                nextSteps(node.otherwise);
                nextSteps(node.afterLoop);
                nextSteps(node.handlers);
                nextSteps(node.afterSuccess);
                nextSteps(node.finalizer);
            }
        }
        nextSteps(b.controlFlow);
    }
    return result;
}
module.exports = { guide, attach };
