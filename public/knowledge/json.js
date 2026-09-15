(function (root, factory) { if (typeof module === 'object' && module.exports)
    module.exports = factory;
else
    root.WhoJsonCards = factory; })(this, function (card) {
    const add = (id, title, plain, naming, example, result, pitfall, expected) => card('json.' + id, 'JSON', title, plain, naming, example, result, pitfall, '', expected);
    add('object', '把有关的信息放成一组', '大括号就像一张信息表，把名称与对应内容放在一起。', '{}、:、, 是 JSON 的写法；里面的字段名由作者或使用它的软件约定。', '{"name":"小林","age":20}', '这一组记录了名字和年龄。', '同一份结构能用于很多软件，不能只根据名字推断业务用途。', { name: '小林', age: 20 });
    add('array', '用列表保存多个项目', '方括号把多个项目放在一个列表里。列表可以保存文字，也可以保存一整组信息。', '[] 和分隔项目的逗号是固定写法。', '{"fruits":["苹果","梨"]}', 'fruits 中有两个项目。', '排列位置不自动等于程序的执行顺序。', { fruits: ['苹果', '梨'] });
    add('field', '名称和内容是一对', '冒号左边是信息的名称，右边是保存的内容。它不是声明函数或执行命令。', '字段名不是 JSON 关键字；特定软件可能要求使用指定名称。', '{"nickname":"小林"}', 'nickname 对应的内容是小林。', '把配置软件规定的字段改名后，它可能不再识别。', { nickname: '小林' });
    add('string', '用双引号保存文字', '双引号中间是文字，包括文件路径和命令。JSON 读取文字本身不会运行命令。', '文字必须用双引号，不能直接改成单引号。', '{"message":"你好"}', 'message 保存文字：你好。', '看起来像代码的文字，仍需由其他工具接收后才可能执行。', { message: '你好' });
    add('escape', '为什么文字中有反斜杠', String.raw `想在文字里放双引号，就写 \"；想放一个反斜杠，就写 \\。这些标记让 JSON 知道文字还没有结束。`, '反斜杠与后面的字符共同组成转义写法。', JSON.stringify({ message: '他说："你好"', path: 'C:\\demo' }), '读取后是：他说："你好"；路径里是一个反斜杠。', '不能直接删除所有反斜杠。复制 JSON 原文和复制实际文字是两种操作。', { message: '他说："你好"', path: 'C:\\demo' });
    add('number', '直接保存一个数字', '数字不需要双引号；它与同样内容的文字是不同类型。', '数字写法由 JSON 规定，字段的单位由软件约定。', '{"count":3}', 'count 是数字 3。', '仅凭 180 不能判断是秒还是分钟。', { count: 3 });
    add('boolean', '保存“是”或“否”', 'true 和 false 表示两种相反的状态，具体是允许还是开启，要看字段含义。', 'true、false 是 JSON 固定值，使用小写，不加引号。', '{"enabled":true}', 'enabled 是布尔值 true。', '"false" 是文字，不是布尔值 false。', { enabled: true });
    add('null', '明确表示没有具体值', 'null 表示这里没有提供具体值。它与空文字和数字 0 不同。', 'null 是 JSON 固定值，不加引号。', '{"middleName":null}', 'middleName 没有具体值。', '软件如何处理缺值由它自己规定，不一定等同于省略字段。', { middleName: null });
});
