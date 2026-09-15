const ts=require('typescript');
function learningFor(root,source,checker){
 const records=[],raw=n=>n?.getText(source)||'';
 function add(id,n,context,why){records.push({id,...require('./spans').span(n,source),context,why});}
 function visit(n){
  if(ts.isVariableDeclarationList(n))add('js.binding',n.getFirstToken(source),'const 固定这个名字指向的值；let 允许以后重新赋值。','先准备一个名字，后面的代码才能引用它。');
  if(ts.isArrowFunction(n)){
   add('js.arrow',n.equalsGreaterThanToken,'箭头左边列出输入，右边写处理步骤。','让这段处理可以作为一个值保存或传给其他功能。');
   if(!ts.isBlock(n.body))for(const v of ts.isConditionalExpression(n.body)?[n.body.whenTrue,n.body.whenFalse]:[n.body])add('js.implicit-return',v,'箭头后没有花括号，这个表达式的结果会自动交回调用处。','不用另写 return；只有被选中的分支会求值。');
  }
  if(ts.isTypeOfExpression(n))add('js.typeof',n,'询问输入属于哪一种值，得到 string、number 等类型名称文字。','先确认输入类型，再选择能用于这种值的处理。');
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))add(n.text===''?'js.empty-string':'js.string',n,n.text===''?'引号中没有字符，表示一段长度为 0 的文字。':'引号中的内容是文字值，不是变量名。','明确区分文字本身和保存文字的名字。');
  if(ts.isNumericLiteral(n))add('js.number',n,'这里直接写了一个数字值。','为比较或计算提供数值。');
  if(ts.isArrayLiteralExpression(n))add('js.array',n,'按顺序放在一起的一组值。','让多项数据可以一起传递和逐项处理。');
  if(ts.isObjectLiteralExpression(n))add('js.object',n,'用字段名保存几项相关内容。','后续可以按名称取出需要的内容。');
  if(ts.isBinaryExpression(n)&&['+','-','*','/','%','**'].includes(raw(n.operatorToken)))add('js.arithmetic',n,'这里用运算符组合左右两边的值。','得到后续步骤需要的新值；加号也可能连接文字。');
  const gaps=new Map([[ts.SyntaxKind.AwaitExpression,'等待异步结果'],[ts.SyntaxKind.YieldExpression,'暂停并产出值'],[ts.SyntaxKind.TryStatement,'异常处理的执行路径'],[ts.SyntaxKind.SwitchStatement,'多分支转移'],[ts.SyntaxKind.RegularExpressionLiteral,'正则表达式规则'],[ts.SyntaxKind.TypeReference,'引用类型的具体约定'],[ts.SyntaxKind.ImportDeclaration,'被引入文件的具体实现'],[ts.SyntaxKind.ClassDeclaration,'类与继承的完整行为']]);
  if(gaps.has(n.kind))records.push({id:'gap.js.'+ts.SyntaxKind[n.kind],...require('./spans').span(n,source),gap:true,label:gaps.get(n.kind),context:'已识别这种写法，但尚未提供完整的专门解释。'});
  if(ts.isCallExpression(n)){
   const method=ts.isPropertyAccessExpression(n.expression)?n.expression.name.text:'';
   if(!['map','filter','join','trim','forEach','hypot'].includes(method))records.push({id:'gap.js.call',...require('./spans').span(n,source),gap:true,label:'调用 '+raw(n.expression).slice(0,50),context:'未核对被调用功能的实现、输入要求和副作用。'});
  }
  if(ts.isFunctionLike(n))add('js.function',n,'这组步骤可以通过函数名或保存它的变量来使用。','让调用它的地方可以提供输入，再使用处理结果。');
  if(ts.isVariableDeclaration(n)||ts.isParameter(n)){
   if(ts.isArrayBindingPattern(n.name)){
    const pieces=n.name.elements.map((e,i)=>ts.isOmittedExpression(e)?'':e.dotDotDotToken?'把剩下的项交给 '+raw(e.name):'第 '+(i+1)+' 项交给 '+raw(e.name)+(e.initializer?'；没有值时用默认值':'')).filter(Boolean);
    const input=ts.isParameter(n)?'调用时提供的这一项输入':n.initializer?raw(n.initializer).slice(0,40):'当前这一轮取出的内容';
    add('js.destructure',n,'从 '+input+' 中按顺序取值：'+pieces.join('，')+'。','取出的值有了各自的名字，后续可以单独使用。');
   }else if(ts.isObjectBindingPattern(n.name))add('js.object-destructure',n,'按字段名取出 '+n.name.elements.map(e=>raw(e.propertyName||e.name)).join('、')+'。','只拿当前需要的字段，后续不必每次都写完整取值路径。');
   else if(ts.isVariableDeclaration(n))add('js.variable',n,'这里给计算结果起名为 '+raw(n.name)+'。','后续代码可以用这个名字继续读取或更新它。');
  }
  if(ts.isIfStatement(n))add('js.condition',n.expression,'这个检查决定进入哪条路径。','不同输入可能需要不同的处理，判断负责选路。');
  if(ts.isConditionalExpression(n))add('js.choice',n,'这里根据条件从两种结果中选一个。','把两种情况收束成一个可以继续使用的值。');
  if(ts.isReturnStatement(n))add('js.return',n,'当前路径在这里结束，并把值交回调用处。','调用方才能取得这次处理的结果；不会继续执行这条路径后面的语句。');
  if(ts.isForStatement(n)||ts.isForOfStatement(n)||ts.isForInStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n))add('js.loop',n,'这一部分会按循环规则重复执行。','把同样的处理应用于多项数据，或重复到条件满足。');
  if(ts.isBinaryExpression(n)){
   if(['===','!==','==','!=','>','<','>=','<='].includes(raw(n.operatorToken)))add('js.compare',n,'这里比较两边的值，把结果用于判断或交回调用处。','计算机需要得到明确的真假结果，才能决定下一步。');
   if(['&&','||'].includes(raw(n.operatorToken)))add('js.logic',n,'这里把多个条件组合起来，并可能跳过后面的检查。','让选路同时考虑多个情况。');
  }
  if(ts.isTemplateExpression(n))add('js.template',n,'把当前的数据填进这段文字的指定位置。','把变化的数据和固定说明合成可读文字。');
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
   const base=n.expression.expression,method=n.expression.name.text;
   const known={map:'逐项生成新结果',filter:'保留符合条件的项',join:'把多项连接成文字',trim:'去掉文字首尾空白',forEach:'为每项执行一组步骤'};
   // Do not teach a known locally declared object method as a standard array/string method.
   const decl=ts.isIdentifier(base)?checker.getSymbolAtLocation(base)?.declarations?.[0]:null;
   const custom=decl&&ts.isVariableDeclaration(decl)&&decl.initializer&&(ts.isObjectLiteralExpression(decl.initializer)||ts.isNewExpression(decl.initializer));
   if((known[method]&&custom)||(raw(base)==='Math'&&method==='hypot'&&checker.getSymbolAtLocation(base)?.declarations?.length))records.push({id:'gap.js.custom-call',...require('./spans').span(n,source),gap:true,label:'同名自定义方法 '+raw(n.expression).slice(0,50),context:'这里的名称不能保证是语言内置方法，需查看实际定义。'});
   if(known[method]&&!custom)add('js.'+(method==='forEach'?'foreach':method),n,'这里对 '+raw(base).slice(0,48)+' 使用 '+method+'，按标准用法是'+known[method]+'。','如果这个对象自己实现了同名方法，要结合它的实现核对；卡片示例演示的是标准用法。');
   if(raw(base)==='Math'&&method==='hypot'&&!checker.getSymbolAtLocation(base)?.declarations?.length)add('js.hypot',n,'把传入的数分别平方、相加，再开平方。例如 3 和 4 会得到 5。','当输入是横向和纵向距离时，可以据此得到直线距离；这里仍要结合前面数值的含义。');
  }
  ts.forEachChild(n,visit);
 }
 visit(root);if(ts.isVariableDeclaration(root.parent)){const d=root.parent;add('js.variable',d.name,'作者把这个功能命名为 '+raw(d.name)+'。','以后可以用这个名字调用它。');if(ts.isVariableDeclarationList(d.parent))add('js.binding',d.parent.getFirstToken(source),'这里声明保存功能的名字。','const 不允许给同一个名字重新赋值。');}return records;
}
module.exports={learningFor};
