import {lexAndParse} from 'java-parser';
import fs from 'node:fs';
const code=fs.readFileSync(0,'utf8');
const nodes=n=>Object.values(n?.children||{}).flat().filter(x=>x.name);
const all=n=>[n,...nodes(n).flatMap(all)];
const first=(n,name)=>{if(n?.name===name)return n;for(const c of nodes(n)){const x=first(c,name);if(x)return x;}};
const raw=n=>n?code.slice((n.location||n).startOffset,(n.location||n).endOffset+1):'';
const short=n=>raw(n).replace(/\s+/g,' ').slice(0,90);
function conditionPhrase(n){const b=first(n,'binaryExpression'),ops=b?.children.BinaryOperator||[],values=b?.children.unaryExpression||[];const words={'<':'小于','>':'大于','<=':'小于或等于','>=':'大于或等于','==':'等于','!=':'不等于'};if(ops.length===1&&values.length===2&&words[ops[0].image])return short(values[0])+' 是否'+words[ops[0].image]+' '+short(values[1]);return short(n);}
function span(n){const p=n.location||n;return {start:p.startLine,end:p.endLine,startColumn:p.startColumn-1,endColumn:p.endColumn};}
function lesson(id,n,context,why){return {id:'java.'+id,...span(n),context,why};}
function learning(root){const out=[];
 const types={classDeclaration:'class',methodDeclaration:'method',constructorDeclaration:'new',localVariableDeclaration:'variable',fieldDeclaration:'variable',formalParameter:'variable',ifStatement:'condition',basicForStatement:'loop',enhancedForStatement:'loop',whileStatement:'loop',doStatement:'loop',returnStatement:'return',arrayCreationExpression:'array',arrayInitializer:'array',tryStatement:'exception',classInstanceCreationExpression:'new',methodModifier:'modifier',classModifier:'modifier',variableModifier:'modifier'};
 const gaps={typeParameters:'泛型类型的约束',typeArguments:'泛型参数的具体含义',lambdaExpression:'匿名功能与捕获变量',switchStatement:'多分支跳转路径',tryStatement:'异常及 finally 的执行路径',synchronizedStatement:'并发访问的协调',annotation:'注解的实际作用',importDeclaration:'引入类型的具体实现',throws:'错误向外传播的约定'};
 for(const n of all(root)){
  if(types[n.name])out.push(lesson(types[n.name],n,'此处使用了“'+({class:'类',method:'方法',new:'创建或初始化对象',variable:'声明数据',condition:'条件选路',loop:'重复处理',return:'交回结果',array:'数组',exception:'处理异常',modifier:'访问与归属修饰'}[types[n.name]])+'”的写法。','卡片介绍这处语法的用法；具体数据含义仍要结合调用处。'));
  if(gaps[n.name])out.push({id:'gap.java.'+n.name,...span(n),gap:true,label:gaps[n.name],context:'语法已读取，专门解释或完整执行路径尚未覆盖。'});
  if(n.name==='binaryExpression'&&(n.children.BinaryOperator||[]).some(t=>['<','>','<=','>=','==','!='].includes(t.image)))out.push(lesson('compare',n,'这里比较两边的值，得到真假结果。','判断结果决定进入哪条路径。'));
  if(n.name==='binaryExpression'&&(n.children.BinaryOperator||[]).some(t=>!['<','>','<=','>=','==','!='].includes(t.image)))out.push({id:'gap.java.operator',...span(n),gap:true,label:'运算或条件组合的具体规则',context:'这些运算已读取，但尚未逐项解释优先级、类型转换或位运算。'});
  if(n.name==='methodInvocationSuffix')out.push({id:'gap.java.call',...span(n),gap:true,label:'方法调用的实现',context:'这里没有读取被调用方法的全部实现，输入约束和副作用需另行核对。'});
  for(const token of Object.values(n.children||{}).flat().filter(t=>!t.name)){
   if(token.tokenType?.name==='StringLiteral')out.push(lesson('string',token,'双引号里的内容是文字值。','区分文字本身与变量名。'));
  }
 }
 return out;
}
const unwrapNames=new Set(['blockStatement','statement','statementWithoutTrailingSubstatement','forStatement','methodBody']);
function unwrap(n){while(n&&unwrapNames.has(n.name)&&nodes(n).length===1)n=nodes(n)[0];return n;}
let budget=0;
function sequence(n,depth=0){if(!n)return [];n=unwrap(n);if(['block','constructorBody'].includes(n.name)){const b=n.children.blockStatements?.[0];const flow=seqList(b?.children.blockStatement||[],depth);if(n.children.explicitConstructorInvocation)flow.unshift({...span(n.children.explicitConstructorInvocation[0]),kind:'unknown',label:'先调用其他构造方法，具体初始化待核对'});return flow;}return seqList([n],depth);}
function seqList(items,depth){const out=[];for(let n of items){n=unwrap(n);if(++budget>70||depth>5){out.push({...span(n),kind:'unknown',label:'还有步骤尚未展开，请对照源码'});break;}
 let x={...span(n),kind:'step',label:'执行这一步',detail:'阅读下方独立显示的源码；涉及的语法和未解释的调用会分别列出。'};
 if(n.name==='ifStatement'){const cond=n.children.expression[0],branches=n.children.statement||[];const yes=sequence(branches[0],depth+1),no=sequence(branches[1],depth+1);x={...span(cond),kind:'condition',label:'检查：'+conditionPhrase(cond),detail:'检查“'+conditionPhrase(cond)+'”。结果为是时，执行“成立”路径；否则执行“不成立”路径。',children:yes,otherwise:no,terminal:!!yes.at(-1)?.terminal&&!!no.at(-1)?.terminal};}
 else if(['basicForStatement','enhancedForStatement','whileStatement','doStatement'].includes(n.name)){const body=n.children.statement?.[0],cond=n.children.expression?.[0];x={...span(n),kind:'loop',label:n.name==='enhancedForStatement'?'依次处理每一项':n.name==='doStatement'?'先执行一轮，再检查条件':'按条件重复处理',detail:cond?'继续的条件：'+short(cond)+'。每轮结束后依照循环头部更新数据，再决定是否继续。':'按循环头部规定，依次取出数据并处理。',children:sequence(body,depth+1),first:n.name==='doStatement'};}
 else if(['returnStatement','throwStatement','breakStatement','continueStatement'].includes(n.name)){x.kind={returnStatement:'return',throwStatement:'throw',breakStatement:'break',continueStatement:'continue'}[n.name];x.terminal=true;x.label={return:'交回：'+(short(n.children.expression?.[0])||'不带结果值'),throw:'报告错误并结束当前路径',break:'离开当前循环或 switch',continue:'跳过本轮剩余步骤'}[x.kind];x.detail={return:'结束本次方法调用，把这个值交给调用处。返回值的作用还要看调用者怎样使用。',throw:'抛出错误后不会继续当前路径；外层可能有捕获处理。',break:'离开最近的循环或 switch；带标签时需查看标签目标。',continue:'进入下一轮；带标签时需查看标签目标。'}[x.kind];}
 else if(n.name==='localVariableDeclarationStatement'||n.name==='localVariableDeclaration'){const decl=first(n,'variableDeclaratorId');x.label='准备数据：'+short(decl);x.detail='先算出等号右边的内容，交给声明的名字。前面的类型说明这个名字能保存哪一类值。';}
 else if(['tryStatement','switchStatement','synchronizedStatement'].includes(n.name)){x.kind='unknown';x.label='这组内部转移尚未展开';x.detail='已经读取这种结构，但没有完整展示异常、多分支或并发行为。请查看解释缺口。';}
 else if(n.name==='expressionStatement'){const expression=first(n,'statementExpression');x.label='更新数据或调用功能';x.detail='这条语句执行下方表达式。若调用了其他方法，其具体行为需要结合方法实现；缺口列在知识区。';if(expression&&raw(expression).length<60)x.label=short(expression);}
 else {x.kind='unknown';x.label='已读取结构，具体步骤待展开';}
 out.push(x);if(x.terminal)break;
 }return out;}
try{
 let tree,fragment=false;try{tree=lexAndParse(code).cst;}catch(original){const attempt=lexAndParse(code,'classBodyDeclaration');if(attempt.cst.location.endOffset!==attempt.tokens.at(-1)?.endOffset)throw original;tree=attempt.cst;fragment=true;}const blocks=[];
 for(const n of all(tree)){
  if(!['classDeclaration','methodDeclaration','constructorDeclaration','importDeclaration'].includes(n.name))continue;
  const method=n.name==='methodDeclaration',constructor=n.name==='constructorDeclaration',callable=method||constructor;
  const declaration=first(n,method?'methodDeclarator':constructor?'constructorDeclarator':'typeIdentifier');
  const name=method?declaration?.children.Identifier?.[0]?.image:constructor?short(first(declaration,'simpleTypeName')):short(declaration);
  const body=method?first(n,'methodBody'):constructor?first(n,'constructorBody'):null;
  const header=method?first(n,'methodHeader'):declaration;
  const params=first(header,'formalParameterList');budget=0;
  const flow=callable?sequence(body):[];
  blocks.push({kind:callable?'function':n.name==='importDeclaration'?'import':'class',title:name||short(n),...span(n),reusable:callable,constructorMethod:constructor,code:code.split("\n").slice(span(n).start-1,span(n).end).join("\n"),purpose:callable?'这是一个可调用的'+(constructor?'构造方法':'方法')+'。'+(params?'调用时需要提供 '+short(params)+'。':'没有列出输入参数。')+'下面按顺序展示内部处理；方法名本身不足以确认业务目的。':'把相关类型或工具组织到当前文件中。',inputs:short(params)||'没有列出输入参数。',output:method?'声明交回的类型：'+short(first(header,'result')):'构造方法初始化新对象。',usage:'先查看参数与类型，再结合所在类调用此方法。没有编译或执行这份项目。',concept:'Java 的方法通常放在类中；类组织数据与操作。',dependencies:'被引入的类及调用的方法需要项目上下文。',symbols:name?[{name,origin:'作者起的名称',meaning:callable?'调用此功能时使用的名称。':'作者声明的类型名。',rename:'修改时需检查调用处、接口约定与文件名；构造方法须与类名一致。'}]:[],learning:learning(n),controlFlow:flow});
 }
 process.stdout.write(JSON.stringify({language:'Java',parser:'java-parser 3.0.1 · Java 语法树',mode:'local',status:'ready',summary:'已读取 Java 的类、方法及内部结构。',purpose:'先看方法目录，再沿图查看处理过程。',warnings:[...(fragment?['本次读取的是单个类成员片段，所在类和导入信息需补全。']:[]),'Java 当前提供语法与常见流程解释；未进行编译、类型检查或项目运行。泛型、外部调用与复杂转移会列为缺口。'],blocks}));
}catch(e){process.stdout.write(JSON.stringify({language:'Java',parser:'java-parser 3.0.1',mode:'local',status:'invalid',syntaxErrors:true,summary:'Java 语法未完整读通',purpose:'请保留类声明或导入完整 .java 文件。',blocks:[],warnings:[String(e.message).slice(0,700)]}));}
