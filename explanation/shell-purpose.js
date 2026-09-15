// Existing source-grounded patterns live outside the grammar reader.
// These are limited recognizers, not a general inference of business purpose.
function functionPurpose(n,{flat,kids,text,commandName}) {
    let purpose;
    const cmds = flat(n).filter(x => x.type === 'command');
    if (cmds.some(c => commandName(c) === 'security' && kids(c).some(x => x.text === 'find-generic-password')))
        purpose = '这个功能包含查询 macOS 已保存密码的操作。需要对照后面的步骤，确认查询的是哪个服务与账号，以及取得的内容如何使用。';
    if (cmds.some(c => commandName(c) === 'node' && text(c).includes('JSON.parse') && text(c).includes('fs.readFileSync')) && text(n).includes('parsed_client_id') && text(n).includes('parsed_client_secret'))
        purpose = '这个功能包含交给 Node.js 处理的内嵌 JavaScript，随后由外层脚本接收结果。先沿图查看哪些情况会提前结束，再看结果怎样被拆开和保存；内嵌代码仍有单独列出的解释缺口。';
    return purpose;
}
function entryPurpose(safe,source,{field,kids,text}) {
    const compact = n => text(n).replace(/\s+/g, '');
    const choice = safe.find(n => n.type === 'if_statement' && compact(field(n, 'condition')) === '[[-n"${GOOGLE_MAPS_API_KEY_ENV}"]]');
    const prefer = choice && kids(choice).some(n => n.type === 'variable_assignment' && compact(n) === 'GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_ENV}"');
    const alternate = choice && kids(choice).find(n => n.type === 'elif_clause');
    const fallback = alternate && compact(kids(alternate)[0]) === '[[-n"${GOOGLE_MAPS_API_KEY_KEYCHAIN}"]]' && kids(alternate).some(n => n.type === 'variable_assignment' && compact(n) === 'GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_KEYCHAIN}"');
    const dotenv = safe.some(n => n.type === 'if_statement' && compact(field(n, 'condition')) === '[[-z"${GOOGLE_MAPS_API_KEY_ENV}"]]' && kids(n).some(n => n.type === 'variable_assignment' && compact(n) === 'GOOGLE_MAPS_API_KEY_ENV="$(read_dotenv_value"GOOGLE_MAPS_API_KEY")"'));
    if (source.includes('google-maps-api') && prefer && fallback && dotenv)
        return '为 Google Maps 选择访问密钥并记录来源：已经准备的环境变量优先；没有内容时先尝试 read_dotenv_value 这个读取配置的辅助功能。脚本还会尝试 macOS 保存密码的地方（钥匙串），但最后仍优先采用环境／dotenv 的值。定义本身不运行，具体函数见下方目录。';
}
module.exports={functionPurpose,entryPurpose};
