// Application field conventions are separate from JSON syntax. These descriptions
// do not grant permissions or execute commands. Unknown fields remain explicit gaps.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const stringList = x => Array.isArray(x) && x.every(v => typeof v === 'string');
const brief = s => String(s).length > 70 ? String(s).slice(0, 67) + '…' : String(s);
const knownEvents = { PostToolUse: '工具成功执行后', PreToolUse: '工具执行前', PostToolUseFailure: '工具执行失败后' };
function identify(data, name) {
    if (!object(data))
        return null;
    if (/package(?:-lock)?\.json$/i.test(name || '') || 'lockfileVersion' in data ||
        typeof data.name === 'string' && (object(data.dependencies) || object(data.devDependencies)))
        return 'npm';
    const permissions = object(data.permissions) && ['allow', 'deny', 'ask'].some(k => stringList(data.permissions[k]));
    const hooks = object(data.hooks) && Object.keys(knownEvents).some(k => Array.isArray(data.hooks[k]));
    return permissions && hooks ? 'claude' : null;
}
function overview(profile, data) {
    if (profile === 'claude')
        return {
            title: '命令许可与自动操作',
            purpose: '这份配置声明哪些操作允许、需要确认或拒绝，并安排在指定事件发生时自动做什么。填写命令许可清单本身不会运行这些命令。',
            basis: '根据 permissions 与 hooks 的组合推测为 Claude Code 配置；实际生效还取决于文件位置、软件版本与其他设置。',
            limits: ['这里只解释已支持的字段；没有确认外部脚本的内容及运行结果。'],
            reference: 'https://code.claude.com/docs/en/hooks',
        };
    if (profile === 'npm')
        return {
            title: 'lockfileVersion' in data ? 'npm 依赖安装记录' : '项目的安装与任务说明',
            purpose: 'lockfileVersion' in data ? '记录依赖的安装信息，帮助不同电脑准备一致的软件包。版本要求与具体锁定版本需要分开看。' : '告诉 npm 这个项目叫什么、需要哪些工具，以及可以启动哪些任务。',
            basis: '根据文件名或依赖字段组合识别 npm 格式。',
            limits: ['配置列出任务，不代表任务已经执行；外部库和任务的内部实现仍需查看源码。'],
        };
    return {
        title: '按名称组织的一份数据',
        purpose: '这份 JSON 用名称和内容组织信息。先沿层级查看每组保存什么；它本身没有从上到下执行的流程。',
        basis: '已读取 JSON 结构；尚未确定由哪个软件使用。',
        limits: ['字段的业务含义尚未确认，不能只根据英文名字猜测其效果。'],
    };
}
function describe(profile, path, value, data) {
    if (profile === 'npm' && path[0] === 'packages' && path[1] === '' && path.length > 2)
        path = path.slice(2);
    const key = path.at(-1), full = path.join('.');
    if (profile === 'claude') {
        if (full === 'permissions')
            return ['哪些操作提前允许或需要确认', '这里分组保存操作许可规则。真正执行时还会结合其他权限设置；允许规则不是执行记录。', '减少对已批准操作的重复确认，同时保留需要确认或禁止的规则。'];
        if (path[0] === 'permissions' && path.length === 2 && ['allow', 'deny', 'ask'].includes(key) && stringList(value))
            return [
                { allow: '提前允许的操作', deny: '明确拒绝的操作', ask: '执行前需要确认的操作' }[key],
                `这里列出了 ${value.length} 条规则；${{ allow: '匹配时可按许可规则放行，但仍受拒绝、确认及其他设置约束', deny: '匹配时拒绝执行', ask: '匹配时要求先确认' }[key]}。`,
                '把执行许可集中列出来，便于查看与调整。',
            ];
        if (path[0] === 'permissions' && ['allow', 'deny', 'ask'].includes(path[1]) && path.length === 3 && typeof value === 'string')
            return ['一条操作许可规则', '这是用于匹配操作的文字规则。Bash(...) 指向 Bash 工具的命令；* 可匹配不同内容。规则不会在读取 JSON 时执行。', '相同类型的操作可以共用一条规则，实际匹配行为由 Claude Code 决定。'];
        if (full === 'hooks')
            return ['发生事件后自动做什么', '这里按事件登记自动操作，常叫 hook（钩子）：满足触发条件时，由软件调用指定动作。', '让重复操作在合适的时机自动启动。'];
        if (path[0] === 'hooks' && path.length === 2 && Object.hasOwn(knownEvents, key) && Array.isArray(value))
            return [knownEvents[key] + '的安排', `这里登记了 ${value.length} 组自动操作。触发时机是“${knownEvents[key]}”，并不是 JSON 读到这一行时执行。`, '把执行时机与具体动作分开配置。'];
        if (path[0] === 'hooks' && Object.hasOwn(knownEvents, path[1])) {
            if (path.length === 3 && object(value))
                return ['一组触发规则与动作', '先看 matcher 决定匹配哪些工具，再看 hooks 中安排的动作。', '避免每次工具调用都执行相同操作。'];
            if (path.length === 4 && key === 'matcher' && typeof value === 'string') {
                const simple = /^(Edit|Write)(\|(Edit|Write))*$/.test(value);
                return ['哪些操作会触发', simple ? `匹配 ${[...new Set(value.split('|'))].join(' 或 ')} 工具：${[...new Set(value.split('|'))].map(x => x === 'Edit' ? '编辑已有文件（Edit）' : '写入文件（Write）').join('或者')}。这里的 | 表示“或者”，其他工具导致的文件改动不一定触发。` : '这段文字是一条工具名匹配表达式；具体匹配范围尚需核对，不能把它当作普通文件名。', '只在符合范围的事件上启动动作。'];
            }
            if (path.length === 4 && key === 'hooks' && Array.isArray(value))
                return ['匹配后要做的动作', `这里列出了 ${value.length} 个动作；列表位置不表示它们一定按先后顺序运行。`, '同一个事件可以登记多个动作。'];
            if (path.length === 5 && object(value))
                return ['一个自动动作', '查看动作类型、执行内容和等待设置，理解它如何启动。', '把一次自动操作需要的信息放在一起。'];
            if (path.length === 6) {
                const action = data.hooks[path[1]]?.[path[2]]?.hooks?.[path[4]];
                if (key === 'type' && value === 'command')
                    return ['用命令完成动作', 'command 表示让系统启动一条命令；具体内容写在旁边的 command 字段里。', '复用项目已经提供的脚本或工具。'];
                if (key === 'command' && typeof value === 'string' && action?.type === 'command')
                    return ['要启动的命令', '触发后把下面这段文字作为命令执行。引用的脚本不在这份 JSON 里，具体做什么还需要查看脚本内容。', '将自动操作连接到实际工具或脚本。'];
                if (key === 'shell' && ['bash', 'powershell'].includes(value) && action?.type === 'command')
                    return ['由哪个命令工具处理', `选择 ${value} 来处理命令。它是命令运行环境，不是这份文件的语言；这份文件仍是 JSON。${Array.isArray(action.args) ? '此动作设置了 args，shell 字段会被忽略。' : ''}`, '不同命令环境使用不同的写法。'];
                if (key === 'timeout' && typeof value === 'number' && value > 0)
                    return ['最多等待多久', action?.async === true ? `这里填写了 ${value} 秒，但后台运行的 command hook 不强制采用该超时限制。` : `这里填写最多等待 ${value} 秒；达到限制可能取消动作，不代表这段时间内一定完成或通过。`, '限制一次动作占用的等待时间。'];
                if (key === 'statusMessage' && typeof value === 'string')
                    return ['运行中显示的提示', '动作运行时显示下面这段提示文字。它是作者填写的说明，不是检查已通过的证明。', '让使用者知道当前正在等待什么。'];
            }
        }
    }
    if (profile === 'npm') {
        const fields = {
            name: ['项目名字', '这是作者给这个软件包起的名字，供安装或引用时识别。'], version: ['项目版本', '这是项目的发布版本，用来区分不同发布内容。'], license: ['许可证声明', '说明项目声明采用的使用许可，不代表已经检查所有依赖的许可。'],
            dependencies: ['项目要用的工具', '声明直接依赖及允许的版本范围；范围不等于已安装的确切版本。'], devDependencies: ['开发时使用的工具', '声明开发、检查、测试或构建时使用的依赖。'],
            scripts: ['可以执行的任务', '左边是作者起的任务名，右边是启动该任务的命令。可以使用 npm run 任务名 来调用。'], engines: ['允许的运行环境', '声明 Node 等运行环境的版本要求；是否强制限制还取决于安装设置。'],
            packages: ['已记录的软件包', '按安装路径区分软件包，空字符串键代表项目自身。'], lockfileVersion: ['锁文件格式', '这是安装记录的格式版本，不是项目版本。'],
            requires: ['依赖信息标记', '锁文件中的元数据，不是一条执行命令。'], private: ['是否拒绝发布', 'true 表示 npm 应拒绝发布这个包。'], type: ['JavaScript 文件方式', 'module 通常使 .js 按 ES 模块解释，commonjs 表示 CommonJS。'], exports: ['对外提供的入口', '规定使用者可以从哪些路径导入内容。'],
        };
        if (path.length === 1 && Object.hasOwn(fields, key))
            return [...fields[key], '让安装或使用项目的工具读取统一约定。'];
        if (path.length === 2 && ['dependencies', 'devDependencies'].includes(path[0]))
            return ['依赖：' + brief(key), '右边是允许使用的版本范围；库的具体功能需要查看项目使用它的位置。', '把版本要求交给安装工具处理。'];
        if (path.length === 2 && path[0] === 'scripts')
            return ['任务：' + brief(key), '这是作者起的任务名，右边是对应命令。仅凭任务名称不能确认内部行为。', '通过统一任务名启动操作。'];
        if (path.length === 2 && path[0] === 'engines')
            return ['运行环境：' + brief(key), '右边是允许的版本范围。>= 表示至少，< 表示小于，|| 表示满足任意一组要求。', '帮助使用者准备合适的运行环境。'];
    }
    return null;
}
module.exports = { identify, overview, describe };
