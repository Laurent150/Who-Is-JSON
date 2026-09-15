const ts = require('typescript');

// Explanations are derived from syntax and literal output, never the function name.
function meaningOf(fn, source, checker) {
  const raw = n => n?.getText(source) || '';
  const unwrap = n => n && ts.isParenthesizedExpression(n) ? unwrap(n.expression) : n;
  const range = n => require('./spans').span(n,source);
  const name = n => raw(n).length <= 36 && !/[\n=>{}]/.test(raw(n)) ? raw(n) : '这项内容';
  const method = n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : '';
  const base = n => n.expression.expression;
  const nativeHypot=n=>!!n&&ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&raw(base(n))==='Math'&&method(n)==='hypot'&&!checker?.getSymbolAtLocation(base(n))?.declarations?.length;
  const property = (n,key) => ts.isObjectLiteralExpression(n) ? n.properties.find(p=>ts.isPropertyAssignment(p)&&raw(p.name)===key)?.initializer : undefined;
  const callbackFields = n => {const fields=new Set();function walk(x){if(ts.isPropertyAccessExpression(x))fields.add(x.name.text);ts.forEachChild(x,walk);}walk(n);return fields;};
  function excludesContained(n){
    if(method(n)!=='filter')return false;
    const cb=n.arguments[0];if(!cb||!ts.isArrowFunction(cb)||cb.parameters.length!==1)return false;
    const neg=unwrap(cb.body);if(!ts.isPrefixUnaryExpression(neg)||neg.operator!==ts.SyntaxKind.ExclamationToken||method(unwrap(neg.operand))!=='some')return false;
    const inner=unwrap(neg.operand).arguments[0];if(!inner||!ts.isArrowFunction(inner)||inner.parameters.length!==1)return false;
    const outerName=raw(cb.parameters[0].name),innerName=raw(inner.parameters[0].name),expr=unwrap(inner.body);
    const terms=[];function and(x){x=unwrap(x);if(ts.isBinaryExpression(x)&&raw(x.operatorToken)==='&&'){and(x.left);and(x.right);}else terms.push(raw(x).replace(/\s/g,''));}and(expr);
    return terms.length===4&&terms.includes(`${innerName}.start<=${outerName}.start`)&&terms.includes(`${innerName}.end>=${outerName}.end`)&&terms.includes(`${innerName}!==${outerName}`)&&terms.includes(`${innerName}.start<${outerName}.start||${innerName}.end>${outerName}.end`);
  }
  const literals = n => {
    const found = [];
    function visit(x) { if (ts.isStringLiteralLike(x) || ts.isTemplateHead(x) || ts.isTemplateMiddle(x) || ts.isTemplateTail(x)) found.push(x.text); ts.forEachChild(x, visit); }
    if(n) visit(n); return found;
  };
  function condition(n) {
    n = unwrap(n);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) {
      if(ts.isPropertyAccessExpression(n.operand) && n.operand.name.text === 'length') return name(n.operand.expression) + ' 没有内容';
      return name(n.operand) + ' 不成立';
    }
    if(ts.isBinaryExpression(n)) {
      const op = raw(n.operatorToken), labels = {'===':'等于','==':'按宽松规则等于','!==':'不等于','!=':'按宽松规则不等于','>':'大于','<':'小于','>=':'不少于','<=':'不超过'};
      if(ts.isTypeOfExpression(n.left) && ts.isStringLiteral(n.right) && ['===','==','!==','!='].includes(op)) return name(n.left.expression) + (op.includes('!')?' 不是':' 是') + ({string:'文字',number:'数字',boolean:'真假值',function:'可调用的功能'}[n.right.text] || n.right.text);
      if(labels[op]) return name(n.left) + ' ' + labels[op] + ' ' + name(n.right);
      if(op === '&&'||op === '||'){const joined=condition(n.left)+(op==='&&'?'，并且':'，或者')+condition(n.right);return joined.length<=75?joined:op==='&&'?'同时满足两个条件':'至少满足一个条件';}
    }
    if(method(n) === 'isArray') return name(n.arguments[0]) + ' 是列表';
    return raw(n).length < 55 && !/[\n{}]/.test(raw(n)) ? name(n) + ' 成立' : '检查这里的条件是否成立';
  }
  function value(n) {
    n = unwrap(n); if(!n) return '不附带结果';
    if(ts.isConditionalExpression(n)) {
      const choices=[];function leaves(x){x=unwrap(x);if(ts.isConditionalExpression(x)){leaves(x.whenTrue);leaves(x.whenFalse);}else if(ts.isNumericLiteral(x)||ts.isStringLiteral(x))choices.push(x);}
      leaves(n);if(choices.length>=2&&choices.length<=4){const values=choices.map(x=>ts.isNumericLiteral(x)?x.text:'“'+x.text+'”').join(' / ');if(values.length<55)return '按条件选用 '+values;}
      return '按条件选择一个结果';
    }
    if(ts.isStringLiteralLike(n)) return n.text === '' ? '空文字' : n.text.length < 26 ? '文字“' + n.text.replace(/\n/g,' / ') + '”' : '一段固定文字';
    if(ts.isTemplateExpression(n)) return '把数据填入文字模板';
    if(ts.isObjectLiteralExpression(n)) {const title=property(n,'title');if(title&&ts.isStringLiteral(title)&&title.text.length<32)return '带有“'+title.text+'”提示的数据';return '包含 '+n.properties.slice(0,5).map(p=>name(p.name)).join('、')+(n.properties.length>5?' 等':'')+' 的数据';}
    if(ts.isArrayLiteralExpression(n)) return n.elements.length ? '准备一个列表' : '准备空列表，稍后装入内容';
    const m = method(n);
    if(excludesContained(n))return '排除被其他范围完整包含的部分，留下外层部分';
    if(m==='slice'&&n.arguments.length===2&&ts.isNumericLiteral(n.arguments[0])&&n.arguments[0].text==='0')return '从开头取出最多 '+name(n.arguments[1])+' 项';
    if(m==='push'&&n.arguments.length===1&&ts.isObjectLiteralExpression(n.arguments[0])){const title=property(n.arguments[0],'title'),question=property(n.arguments[0],'question');if(title&&ts.isStringLiteral(title)&&title.text.length<30)return '添加“'+title.text+'”这一段';if(question)return '补充一组问题与回答';}
    if(m==='map'){const fields=callbackFields(n.arguments[0]||n);if(fields.has('question')&&fields.has('answer'))return '为每项整理问题与回答';}
    const actions = {filter:'按条件保留列表中的部分内容',some:'检查列表中是否至少有一项符合条件',every:'检查列表中是否每项都符合条件',slice:'取出指定范围的内容',map:'把列表中的每项转换成新内容',join:'把多项内容连接成一段文字',trim:'去掉文字首尾的空白',push:'把新内容放到列表末尾',isArray:'检查是否为列表',forEach:'对列表中的每项执行同一组步骤',reduce:'逐项处理并累计结果'};
    if(nativeHypot(n))return '把各个数平方相加，再开平方';
    if(actions[m]) return actions[m];
    if(ts.isCallExpression(n)) return '调用 ' + name(n.expression) + ' 完成这一步';
    if(n.kind===ts.SyntaxKind.TrueKeyword)return 'true（是）';
    if(n.kind===ts.SyntaxKind.FalseKeyword)return 'false（否）';
    if(ts.isBinaryExpression(n)) {
      if(n.operatorToken.kind === ts.SyntaxKind.PlusToken) return '合并两边的值（相加或连接文字，取决于类型）';
      if(['===','!==','==','!=','>','<','>=','<=','&&','||'].includes(raw(n.operatorToken))) return '得到条件检查的真假结果';
      return '计算这条表达式的结果';
    }
    if(ts.isAwaitExpression(n)) return '等待当前操作完成，再取得结果';
    return name(n);
  }
  function statement(n) {
    if(ts.isVariableStatement(n)) return [...n.declarationList.declarations].map(d => ts.isArrayBindingPattern(d.name)?'从 '+name(d.initializer)+' 依次取出值，分别命名':ts.isObjectBindingPattern(d.name)?'按字段名取出要用的内容':name(d.name) + '：' + value(d.initializer)).join('；');
    if(ts.isReturnStatement(n)) return '交回结果：' + value(n.expression);
    if(ts.isIfStatement(n)) return condition(n.expression);
    if(ts.isExpressionStatement(n)) {
      if(ts.isBinaryExpression(n.expression) && ['=','+='].includes(raw(n.expression.operatorToken))) return (raw(n.expression.operatorToken)==='+='?'补充 ':'更新 ') + name(n.expression.left);
      return value(n.expression);
    }
    return '执行这一步；具体操作见引用代码';
  }
  const returns = [], records = new Map();
  function own(x) {if(x!==fn && ts.isFunctionLike(x))return; if(ts.isReturnStatement(x))returns.push(unwrap(x.expression));ts.forEachChild(x,own);}
  own(fn);
  if(ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) returns.push(unwrap(fn.body));
  function findRecords(x){
    if(x!==fn&&(ts.isFunctionDeclaration(x)||ts.isClassDeclaration(x)))return;
    if(method(x)==='push'&&ts.isIdentifier(base(x)))for(const arg of x.arguments){if(ts.isObjectLiteralExpression(arg)){const target=raw(base(x));records.set(target,[...(records.get(target)||[]),arg.properties.map(p=>raw(p.name))]);}}
    ts.forEachChild(x,findRecords);
  }
  findRecords(fn);
  const output = returns.length === 1 ? returns[0] : null;
  const onlyReturns = !!fn.body && (!ts.isBlock(fn.body) || (fn.body.statements.length === 1 && ts.isReturnStatement(fn.body.statements[0])));
  const info = {title:'',purpose:'',input:'查看下方输入名称，具体要求需结合使用位置。',output:'',why:'把相关步骤放在一起，其他地方需要时可以再次调用。',basis:'依据当前函数的写法整理，未执行代码。'};
  if(returns.length&&returns.every(nativeHypot))Object.assign(info,{title:'计算数值的合成长度',purpose:'把传入的数分别平方、相加，再开平方，得到一个数值。比如 3 和 4 会得到 5；这种计算常用于距离。',input:'用于计算的各项数值；它们代表坐标、差值还是别的量，需要结合前面的取值和计算确认。',output:'一个数值结果。若输入是横向与纵向距离，这个结果就是对应的直线距离。',why:'把多个方向上的数值合成一个长度，调用方可以直接使用这个结果。',basis:'确认了 Math.hypot 的计算含义；尚未仅凭函数名认定具体几何算法。'});
  // A guarded trim is identifiable even after all author-defined names change.
  if(onlyReturns && output && ts.isConditionalExpression(output) && ts.isBinaryExpression(output.condition) && ts.isTypeOfExpression(output.condition.left) && ts.isStringLiteral(output.condition.right) && output.condition.right.text === 'string' && ['===','=='].includes(raw(output.condition.operatorToken)) && method(unwrap(output.whenTrue)) === 'trim' && raw(base(unwrap(output.whenTrue))) === raw(output.condition.left.expression) && ts.isStringLiteral(unwrap(output.whenFalse)) && unwrap(output.whenFalse).text === '') {
    Object.assign(info,{title:'整理文字输入',purpose:'收到文字时，去掉开头和结尾的空白；收到其他类型时，交回空文字。',input:'一个待整理的值，可以是文字或其他类型。',output:'一段文字；两种分支都交回文字。',why:'让后续步骤拿到统一的文字结果，不必每次都重复判断输入类型。',example:'按源码推演：输入 "  你好  " → "你好"；输入 42 → ""。未执行程序。'});
  }
  // Split a string-concatenation expression into cited transformations, not fake statements.
  const isText = n => {n=unwrap(n);return !!n && (ts.isStringLiteralLike(n)||ts.isTemplateExpression(n)||(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&(isText(n.left)||isText(n.right))));};
  if(onlyReturns && output && ts.isBinaryExpression(output) && output.operatorToken.kind===ts.SyntaxKind.PlusToken && isText(output)) {
    const pieces=[];
    function split(n){n=unwrap(n);if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&isText(n)){split(n.left);split(n.right);}else pieces.push(n);}
    split(output);
    const markdown = pieces.some(n=>literals(n).some(t=>/(^|\n)#{1,6} /.test(t)));
    const steps = pieces.filter(n=>!ts.isStringLiteralLike(n)||n.text.trim()).map(n=>{
      let label=value(n), detail='这部分产生的内容会被连接到最终文字中。';
      if(method(n)==='join' && method(unwrap(base(n)))==='map') {
        const mapped=unwrap(base(n)),fields=callbackFields(mapped.arguments[0]||mapped);label=fields.has('question')&&fields.has('answer')?'整理每组问题和回答':fields.has('title')&&fields.has('text')?'整理每段的标题和正文':'逐项生成文字，再连接起来';
        detail='从 '+name(base(mapped))+' 取出每一项，按这里的模板生成文字，再用指定的分隔符连接。map 是逐项转换；join 是连接结果。';
      } else if(literals(n).some(t=>/(^|\n)#{1,6} /.test(t))) {
        const headings=literals(n).flatMap(t=>t.split('\n').filter(l=>/^#{1,6} /.test(l)).map(l=>l.replace(/^#+ /,''))).filter(Boolean);
        label=ts.isStringLiteralLike(n)?'加入小标题'+(headings[0]?'“'+headings[0].slice(0,22)+'”':''):'填入标题和说明';
        detail='这里的 #、## 或 ### 是 Markdown 标题标记。把后面的内容交给支持 Markdown 的工具，就能显示不同层级的标题。';
      }
      return {...range(n),kind:'transform',label,detail};
    });
    steps.push({...range(output),kind:'result',label:'连接各部分，交回完整文字',detail:'原代码用一条 return 表达式完成这些组合；图中把表达式拆开说明，没有新增实际语句。',terminal:true});
    Object.assign(info,{title:markdown?'生成 Markdown 文本':'组合文字结果',purpose:markdown?'把输入数据排成带标题和分段的 Markdown 文本，便于保存或交给支持这种格式的工具展示。':'把动态数据和固定文字组合成一段完整文本。',input:fn.parameters.length?'包含模板中所引用内容的数据；相关列表需要支持逐项转换和连接。':'从外部读取模板所需数据。',output:markdown?'一整段 Markdown 文字；Markdown 用 # 等标记表示标题、段落的格式。':'一整段组合后的文字。',why:'把输出格式集中在这里，其他步骤可以专注于准备数据。',basis:'依据文字模板及标准 map / join 用法解释；如果同名方法被改写，需要另外核对。',steps,flowType:'expression'});
  }
  const isReport = returns.some(n=>{if(!n||!ts.isObjectLiteralExpression(n))return false;const keys=n.properties.flatMap(p=>records.get(ts.isShorthandPropertyAssignment(p)?raw(p.name):ts.isPropertyAssignment(p)&&ts.isIdentifier(p.initializer)?raw(p.initializer):'')||[]);return keys.some(k=>k.includes('title')&&k.includes('text'))&&keys.some(k=>k.includes('question')&&k.includes('answer'));});
  if(isReport && !info.title) Object.assign(info,{title:'组织分段说明与问答',purpose:'把输入内容整理成多个说明段落，并配上问题和回答，最后交回一份结构化结果。',input:'供整理的输入内容，以及控制整理方式的设置；下方流程展示筛选和组合步骤。',output:'包含说明段落、问答等信息的数据。这里准备内容，显示或导出由使用它的地方负责。',why:'把内容组织集中在一个功能里，让显示界面或导出工具可以使用同一份结果。',basis:'从输出对象及段落的 title / text、问答的 question / answer 结构识别；不代表已理解全部业务含义。'});
  return {info, statement, condition, value, range};
}
module.exports = {meaningOf};
