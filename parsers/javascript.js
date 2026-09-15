const ts=require('typescript');const {block,result,symbol}=require('./common');
const keywordHelp={if:'如果条件成立，就执行后面的步骤。',return:'结束这一次处理，把结果交给使用它的地方。',const:'给一个值起名字；这个名字之后不能重新绑定到另一个值。',let:'给一个值起名字，之后允许重新赋值。',function:'定义一组可以被调用的步骤。',typeof:'查看一个值的种类，结果是 number、string 等文字。',async:'声明一个异步功能，调用它会得到代表未来结果的 Promise。',await:'在当前异步处理里等待一个结果，再继续后面的步骤。',for:'按指定规则重复处理。',while:'只要条件成立就重复。',throw:'报告失败，让调用方或错误处理代码接手。',import:'从其他文件或工具包引入功能。',export:'把这里的功能提供给其他文件使用。',interface:'描述数据应该有哪些字段，供 TypeScript 检查。',type:'给一种类型描述起别名。'};
const nativeHelp={Number:'JavaScript 提供的数字转换与数字相关工具。',String:'JavaScript 提供的文字转换与文字相关工具。',Array:'JavaScript 提供的数组工具；数组用来按顺序保存多项内容。',Object:'JavaScript 提供的对象工具；对象按名字保存各项信息。',Promise:'表示一个可能稍后成功或失败的结果。',Math:'JavaScript 提供的数学工具。',isFinite:'检查转换成数字后是否为有限值；与 Number.isFinite 的转换规则不同。',Boolean:'把值转换成 true 或 false。'};
function javascript(code,name,language){
 const kind=/\.tsx$/i.test(name)?ts.ScriptKind.TSX:/\.jsx$/i.test(name)?ts.ScriptKind.JSX:language==='TypeScript'?ts.ScriptKind.TS:ts.ScriptKind.JS;
 const fileName=name||('input.'+(language==='TypeScript'?'ts':'js'));
 const source=ts.createSourceFile(fileName,code,ts.ScriptTarget.Latest,true,kind);
 const host={getSourceFile:f=>f===fileName?source:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===fileName,readFile:f=>f===fileName?code:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
 const program=ts.createProgram([fileName],{noLib:true,noResolve:true,allowJs:true},host),checker=program.getTypeChecker();
 const text=n=>n?.getText(source)||'';const plainText=n=>text(n).slice(0,220);
 const unbound=n=>ts.isIdentifier(n)&&!checker.getSymbolAtLocation(n)?.declarations?.length;
 function expr(n){
  if(!n)return '没有明确给出结果';
  if(ts.isParenthesizedExpression(n))return expr(n.expression);
  if(ts.isStringLiteralLike(n))return '文字 '+JSON.stringify(n.text);
  if(ts.isNumericLiteral(n))return n.text;
  if(ts.isObjectLiteralExpression(n))return '一份包含 '+n.properties.slice(0,8).map(p=>text(p.name)).filter(Boolean).join('、')+(n.properties.length>8?' 等':'')+' 字段的数据';
  if(ts.isArrayLiteralExpression(n))return n.elements.length?'一组包含 '+n.elements.length+' 项的内容':'一个空列表';
  if(ts.isTemplateExpression(n))return '把 '+n.templateSpans.map(s=>text(s.expression).slice(0,45)).slice(0,4).join('、')+' 等值填进一段文字';
  if(n.kind===ts.SyntaxKind.TrueKeyword)return 'true（是）';if(n.kind===ts.SyntaxKind.FalseKeyword)return 'false（不是）';
  if(ts.isTypeOfExpression(n))return text(n.expression)+' 的数据种类';
  if(ts.isBinaryExpression(n)){
   if(ts.isStringLiteral(n.right)&&n.right.text===''&&['===','!=='].includes(text(n.operatorToken)))return expr(n.left)+(text(n.operatorToken)==='!=='?'不是空文字':'是空文字');
   if(text(n.operatorToken)==='==='&&ts.isNumericLiteral(n.right)&&n.right.text==='0'&&ts.isBinaryExpression(n.left)&&text(n.left.operatorToken)==='-'&&ts.isIdentifier(n.left.left)&&ts.isIdentifier(n.left.right)&&n.left.left.text===n.left.right.text&&(checker.getTypeAtLocation(n.left.left).flags&ts.TypeFlags.NumberLike))return `${n.left.left.text} 是有限数字（数字减去自己等于 0；NaN 和无穷值不能通过）`;
   if(ts.isTypeOfExpression(n.left)&&ts.isStringLiteral(n.right)&&['===','==','!==','!='].includes(text(n.operatorToken))){const label={number:'数字',string:'文字',boolean:'真假值',undefined:'未定义的值',function:'可以调用的功能',object:'对象（这个判断也会包含 null）',symbol:'唯一标记',bigint:'大整数'}[n.right.text]||n.right.text;return `${text(n.left.expression)} ${['!==','!='].includes(text(n.operatorToken))?'不是':'是'}${label}`;}
   const operators={'===':'严格等于','!==':'不严格等于','==':'按宽松规则等于','!=':'按宽松规则不等于','>':'大于','<':'小于','>=':'大于或等于','<=':'小于或等于','&&':'并且','||':'或者','-':'减去','*':'乘以','/':'除以','%':'求余数','+':'使用 + 组合（数字相加，文字可拼接）'};
   const op=operators[text(n.operatorToken)];if(op)return `（${expr(n.left)} ${op} ${expr(n.right)}）`;
  }
  if(ts.isPrefixUnaryExpression(n)){if(n.operator===ts.SyntaxKind.ExclamationToken)return '取相反的真假结果：'+expr(n.operand);if(n.operator===ts.SyntaxKind.PlusToken)return '把 '+text(n.operand)+' 转为数字';}
  if(ts.isConditionalExpression(n))return `如果 ${text(n.condition)==='Number.isFinite'&&ts.isPropertyAccessExpression(n.condition)&&unbound(n.condition.expression)?'当前环境提供 Number.isFinite':expr(n.condition)}，就用 ${expr(n.whenTrue)}；否则用 ${expr(n.whenFalse)}`;
  if(ts.isCallExpression(n)){
   if(ts.isPropertyAccessExpression(n.expression)){
    const base=n.expression.expression,method=n.expression.name.text,t=checker.getTypeAtLocation(base);
    if(t.flags&ts.TypeFlags.StringLike){const who=text(base),arg=expr(n.arguments[0]);const hints={trim:`去掉 ${who} 两端的空白文字`,startsWith:`检查 ${who} 是否以 ${arg} 开头`,endsWith:`检查 ${who} 是否以 ${arg} 结尾`,includes:`检查 ${who} 是否包含 ${arg}`,charCodeAt:`读取 ${who} 在位置 ${text(n.arguments[0])} 的字符编码（位置从 0 开始）`,slice:`截取 ${who} 的一段文字，范围参数为 ${n.arguments.map(text).join('、')}`};if(hints[method])return hints[method];}
   }
   if(ts.isPropertyAccessExpression(n.expression)&&text(n.expression.name)==='isFinite'&&text(n.expression.expression)==='Number'&&unbound(n.expression.expression))return n.arguments[0]&&ts.isPrefixUnaryExpression(n.arguments[0])&&n.arguments[0].operator===ts.SyntaxKind.PlusToken?`检查 ${text(n.arguments[0].operand)} 转换后的数字是否有限`:`检查 ${expr(n.arguments[0])} 是否已经是有限的数字（不先转换类型）`;
   if(ts.isIdentifier(n.expression)&&n.expression.text==='isFinite'&&unbound(n.expression))return `把 ${text(n.arguments[0])} 按规则转成数字，再检查是否有限`;
   return `使用 ${text(n.expression)} 处理 ${n.arguments.map(plainText).join('、')||'这次操作（没有传入参数）'}`;
  }
  if(ts.isAwaitExpression(n))return '等待 '+expr(n.expression)+' 完成';
  return plainText(n);
 }
 function symbols(root){const map=new Map();const put=(...args)=>map.set(args[0],symbol(...args));
  function visit(n){
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
    const methods={map:'列表常用方法：把每项转换成新内容，收集成新列表。',join:'列表常用方法：用指定的分隔文字把各项连接成一段文字。',filter:'列表常用方法：保留判断结果成立的那些项。',some:'列表常用方法：只要有一项通过判断，就得到 true。',forEach:'列表常用方法：为每项执行一组步骤，不收集回调的返回值。',push:'列表常用方法：在末尾添加内容，会改变原列表。',trim:'文字常用方法：去掉首尾空白，不改变中间的空格。',slice:'文字或列表常用方法：按起止位置取出一段，结束位置本身不包含。'};
    const key=n.expression.name.text;if(methods[key])put(key,'常见方法名',methods[key]+' 这里按标准用法说明；如果接收者自己定义了同名方法，应查看它的实现。','使用标准方法时保留这个名称；点号前保存数据的名字可能由作者自己起。');
   }
   if(ts.isIdentifier(n)){
   const parent=n.parent;if((ts.isPropertyAccessExpression(parent)&&parent.name===n)||(ts.isPropertyAssignment(parent)&&parent.name===n))return;
   const sym=checker.getSymbolAtLocation(n),decl=sym?.declarations?.[0];
   if(decl){let origin='作者起的名字',meaning='在源码中定义；用途由它的定义和使用位置决定。',rename='可以改名，但同一作用范围内的引用需要一起修改。';
    if(ts.isParameter(decl)){origin='作者命名的输入';meaning='接收调用者提供的一项内容。'+(decl.type?'这里要求的类型：'+text(decl.type)+'。':'当前没有写明类型，要结合使用位置理解。');}
    if(ts.isImportSpecifier(decl)||ts.isImportClause(decl)||ts.isNamespaceImport(decl)){origin='导入的功能';meaning='从其他文件或工具包引入。仅凭这里不能确定它的完整实现。';rename='本地名字可以通过别名修改；导入来源及原始导出名须符合对方约定。';}
    put(n.text,origin,meaning,rename);
   }else if(nativeHelp[n.text])put(n.text,'JavaScript 自带',nativeHelp[n.text],'使用自带工具时保留这个名称；同名变量会遮住它。');
   else if(n.text==='module'||n.text==='require')put(n.text,'取决于运行环境','在 CommonJS / Node.js 环境中常用于导出或引入模块；浏览器不一定提供。','先确认运行环境，不当作作者任意命名的变量。');
   else if(!['undefined','NaN','Infinity'].includes(n.text))put(n.text,'来源待确认','当前文件未找到它的定义；可能由其他文件或运行环境提供。','找到定义后再判断能否改名。');
  }ts.forEachChild(n,visit);}visit(root);
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,kind===ts.ScriptKind.TSX||kind===ts.ScriptKind.JSX?ts.LanguageVariant.JSX:ts.LanguageVariant.Standard,text(root));let token;
  while((token=scanner.scan())!==ts.SyntaxKind.EndOfFileToken){const word=scanner.getTokenText();if(keywordHelp[word]&&token>=ts.SyntaxKind.FirstKeyword&&token<=ts.SyntaxKind.LastKeyword)put(word,'语言固定写法',keywordHelp[word],'作为语法使用时不能换成自起的名字。');}
  return [...map.values()].slice(0,35);
 }
 let blocks=[];function add(n,kind,title,purpose,extra={}){blocks.push(block(code,n.getStart(source),n.end,kind,title,purpose,{symbols:symbols(n),learning:require('./learning').learningFor(n,source,checker),...extra}));}
 function ownReturns(n){let found=[];function walk(x){if(x!==n&&(ts.isFunctionLike(x)||ts.isClassDeclaration(x)))return;if(ts.isReturnStatement(x))found.push(x);ts.forEachChild(x,walk);}walk(n);return found;}
 function short(n){const s=expr(n);return s.length>180?s.slice(0,177)+'…（表达式较长，请对照源码）':s;}
 function steps(nodes,depth=0){
  if(depth>2)return '内部还有步骤，可展开源码查看。';
  const parts=[];
  for(const n of nodes.slice(0,14)){
   if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations){if(d.initializer&&ts.isFunctionLike(d.initializer))continue;parts.push(`准备 ${text(d.name)}：${short(d.initializer)}。`);}
   else if(ts.isReturnStatement(n))parts.push(`交回${short(n.expression)}，结束这次处理。`);
   else if(ts.isIfStatement(n)){const inner=ts.isBlock(n.thenStatement)?n.thenStatement.statements:[n.thenStatement];parts.push(`如果 ${short(n.expression)}：${steps(inner,depth+1)}${n.elseStatement?'否则：'+steps(ts.isBlock(n.elseStatement)?n.elseStatement.statements:[n.elseStatement],depth+1):''}`);}
   else if(ts.isExpressionStatement(n)){
    const e=n.expression;
    if(ts.isBinaryExpression(e)&&['=','+='].includes(text(e.operatorToken)))parts.push(`${text(e.operatorToken)==='='?'设置':'更新'} ${text(e.left)}：${short(e.right)}。`);
    else if(ts.isCallExpression(e)&&ts.isPropertyAccessExpression(e.expression)){
     const method=e.expression.name.text,base=text(e.expression.expression);
     if(method==='push')parts.push(`向 ${base} 添加${e.arguments.map(short).join('、')}。`);
     else if(method==='forEach'){const callback=e.arguments[0];parts.push(`对 ${base} 调用 forEach 逐项处理。${callback&&ts.isFunctionLike(callback)&&ts.isBlock(callback.body)?steps(callback.body.statements,depth+1):''}`);}
     else parts.push(short(e)+'。');
    }else parts.push(short(e)+'。');
   }else if(ts.isFunctionDeclaration(n))parts.push(`在这里定义 ${text(n.name)}，具体步骤见它自己的章节。`);
   else parts.push(`第 ${source.getLineAndCharacterOfPosition(n.getStart(source)).line+1} 行还有 ${ts.SyntaxKind[n.kind]} 处理，当前规则未展开，需查看源码。`);
  }
  if(nodes.length>14)parts.push(`还有 ${nodes.length-14} 条语句未在本段展开。`);
  return parts.join('\n');
 }
 function visit(n){
  if(ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)){
   let name=text(n.name);if(!name&&ts.isVariableDeclaration(n.parent))name=text(n.parent.name);if(!name&&ts.isBinaryExpression(n.parent))name=text(n.parent.left);if(!name)name='临时使用的功能';
   const commonJS=name==='module.exports'&&ts.isBinaryExpression(n.parent)&&ts.isPropertyAccessExpression(n.parent.left)&&unbound(n.parent.left.expression);const returns=ownReturns(n);const checks=[];function collect(x){if(x!==n&&ts.isFunctionLike(x))return;if(ts.isIfStatement(x))checks.push(expr(x.expression));ts.forEachChild(x,collect);}collect(n);
   const params=n.parameters.map(p=>`${text(p.name)}：调用者交进来的内容${p.type?'（要求 '+text(p.type)+' 类型）':''}${p.initializer?'；不填写时使用 '+text(p.initializer):''}`).join('；');
   const outputs=ts.isArrowFunction(n)&&!ts.isBlock(n.body)?[expr(n.body)]:returns.map(r=>expr(r.expression));
   let purpose=checks.length?'先按输入情况分开处理：'+checks.slice(0,3).join('；')+'。':outputs.length===1?'处理交进来的内容，然后交回：'+outputs[0]+'。':'将下面这些步骤组织成可重复使用的功能。';
   add(n,'function',name,purpose,{inputs:params||'没有列出输入参数；仍可能读取外部数据。',output:outputs.length?'不同路径可能交回：\n'+outputs.slice(0,6).map(x=>'• '+x).join('\n'):'没有发现显式 return；仍可能修改数据或执行其他操作。',usage:commonJS?'这个功能被提供给其他文件使用。在 CommonJS 环境中，其他文件可以用 require 引入，再交给它一个输入值。':`先看 ${name} 需要的输入，再查调用它的位置。这里只解析源码，没有执行它。`,concept:'函数可以理解成一个有名字的小工具：交给它输入，它按自己的步骤处理。'});
   const added=blocks[blocks.length-1];added.reusable=name!=='临时使用的功能';added.role=added.reusable?'named-function':'callback-or-wrapper';
   if(added.reusable&&/^[A-Za-z_$][\w$]*$/.test(name)&&!added.symbols.some(x=>x.name===name))added.symbols.unshift(symbol(name,'作者起的功能名','这个名字指向当前功能；语言没有要求必须叫这个名字。','可以改名，但调用它的地方、导出约定和其他文件中的引用要一起检查。'));
   added.flow=n.body?(ts.isBlock(n.body)?steps(n.body.statements):'交回'+short(n.body)+'。'):'';
   const meaning=require('./meaning').meaningOf(n,source,checker);
   added.controlFlow=require('./flow').flowOf(n.body,source,meaning.statement,meaning.condition,meaning.value);
   function teachNodes(nodes){for(const item of nodes){const candidates=added.learning.filter(k=>require('./spans').contains(item,k));const preferred=item.kind==='return'?'js.hypot':item.kind==='step'?'js.destructure':null;const hint=candidates.find(k=>k.id===preferred);if(hint){item.detail=hint.context;item.why=hint.why;}for(const key of ['children','otherwise','afterLoop'])teachNodes(item[key]||[]);}}
   teachNodes(added.controlFlow);
   added.meaning=meaning.info;
   if(meaning.info.title){added.purpose=meaning.info.purpose;added.output=meaning.info.output;added.flow=added.controlFlow.map(x=>x.label).join('\n');}
   else if(added.purpose.length>220){added.purpose='这个功能把输入按内部步骤处理。先看下面的判断、重复和结果，再结合源码确认具体用途。';}
   require('../explanation/javascript-semantics').decorate(n,added,source,checker);
   if(commonJS)added.symbols.unshift(symbol('module.exports','CommonJS 环境约定','把右边这个功能提供给其他文件使用。它不是作者给函数起的名字。','使用这套导出机制时保留写法。引入方保存它的本地名字可以自己起。'));
  }else if(ts.isIfStatement(n))add(n,'condition','如果 '+expr(n.expression),`先检查 ${expr(n.expression)}。成立时做紧接着的内容；不成立时${n.elseStatement?'进入另一条路径。':'跳过这部分。'}`,{concept:'if 是“如果”；缩进或花括号里的内容属于对应分支。'});
  else if(ts.isForOfStatement(n)||ts.isForInStatement(n))add(n,'loop','逐项处理 '+text(n.expression),`从 ${text(n.expression)} ${ts.isForOfStatement(n)?'依次取出值':'依次枚举可枚举的属性名'}，交给 ${text(n.initializer)}，重复执行里面的步骤。`,{concept:'循环让计算机重复做事；break、return 或异常可能提前结束。'});
  else if(ts.isForStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n))add(n,'loop','按条件重复',`只要 ${expr(n.condition||n.expression)} 成立，就继续重复。${ts.isDoStatement(n)?'这里会先做一次再检查。':''}${n.incrementor?'每轮之后：'+text(n.incrementor)+'。':''}`);
  else if(ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n))add(n,'type','约定数据形状：'+text(n.name),'用 TypeScript 描述允许的数据类型，帮助开发时检查；类型描述本身不会变成运行时的数据验证。',{usage:'查看字段名、冒号后面的类型，以及 ? 标记的可选字段。'});
  else if(ts.isClassDeclaration(n))add(n,'class','组织相关数据和操作：'+text(n.name),'把一类对象需要的数据和方法放在一起。展开下面的方法可以看各自做什么。');
  else if(ts.isImportDeclaration(n))add(n,'import','引入工具：'+text(n.moduleSpecifier),'让当前文件可以使用其他文件或包导出的内容。没有读到对方源码时，不推断它的完整业务行为。');
  ts.forEachChild(n,visit);
 }visit(source);
 const warnings=source.parseDiagnostics.map(d=>`第 ${source.getLineAndCharacterOfPosition(d.start||0).line+1} 行：${ts.flattenDiagnosticMessageText(d.messageText,' ')}`).slice(0,8);
 if(!blocks.length&&source.statements.length)for(const n of source.statements.slice(0,12))add(n,'module','文件里的操作',ts.isVariableStatement(n)?'准备有名字的数据：'+text(n).slice(0,350):'这条语句是：'+text(n).slice(0,350));
 const unexplained=[];
 if(source.parseDiagnostics.length){
  const safe=[];
  for(const node of source.statements){
   const start=node.getStart(source),end=node.end;
   const touches=source.parseDiagnostics.some(d=>(d.start||0)>=start&&(d.start||0)<=end);
   const isolated=ts.createSourceFile(fileName,text(node),ts.ScriptTarget.Latest,true,kind);
   const a=source.getLineAndCharacterOfPosition(start).line+1,b=source.getLineAndCharacterOfPosition(Math.max(start,end-1)).line+1;
   if(!touches&&!isolated.parseDiagnostics.length)safe.push({start:a,end:b});else unexplained.push({start:a,end:b,reason:'这一部分存在语法错误或边界不完整，暂未生成解释。'});
  }
  blocks=blocks.filter(b=>safe.some(s=>b.start>=s.start&&b.end<=s.end));
  warnings.unshift(`只解释独立解析通过的 ${blocks.filter(b=>b.kind==='function'&&b.reusable).length} 个具名功能及其他完整结构；它们仍可能依赖出错部分。`);
 }
 const functions=blocks.filter(b=>b.kind==='function');return {...result(language,'TypeScript 语法解析',functions.length?`这里有 ${functions.length} 个可调用功能，以及它们的判断、重复处理或类型约定。`:`这份 ${language} 代码包含 ${blocks.length} 个可查看的结构。`,'先点开一个功能，看输入会经过哪些处理，再查看名字由谁提供。仅分析当前文件；没有执行，也没有完成跨文件类型检查。',blocks,warnings,warnings.length?'partial':'ready'),syntaxErrors:source.parseDiagnostics.length>0,partialRecovery:source.parseDiagnostics.length>0&&blocks.length>0,unexplained};
}
module.exports={javascript};
