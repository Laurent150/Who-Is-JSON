const ts=require('typescript');
function flowOf(body,source,describe,condition=n=>n.getText(source).slice(0,80),value=()=> '计算结果'){
 let count=0;
 const range=n=>require('./spans').span(n,source);
 const list=n=>ts.isBlock(n)?[...n.statements]:[n];
 function sequence(items,depth=0){const nodes=[];
  for(const n of items){
   const pos=range(n);if(count++>=70||depth>5){nodes.push({...pos,kind:'unknown',label:'还有内部步骤未展开，请对照源码。'});break;}
   let x={...pos,kind:'step',label:describe(n).replace(/\s+/g,' ').slice(0,140)};
   if(ts.isIfStatement(n)){x={...range(n.expression),kind:'condition',label:condition(n.expression),children:sequence(list(n.thenStatement),depth+1),otherwise:n.elseStatement?sequence(list(n.elseStatement),depth+1):[]};x.terminal=!!n.elseStatement&&!!x.children.at(-1)?.terminal&&!!x.otherwise.at(-1)?.terminal;}
   else if(ts.isForOfStatement(n)||ts.isForInStatement(n)||ts.isForStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n)){x={...pos,kind:'loop',label:ts.isForOfStatement(n)?'逐项处理 '+n.expression.getText(source):ts.isForInStatement(n)?'遍历属性名 '+n.expression.getText(source):ts.isDoStatement(n)?'先做一次，再检查条件':'按条件重复',condition:(n.condition||n.expression)?.getText(source).slice(0,100)||'按循环头部的规则',children:sequence(list(n.statement),depth+1),first:ts.isDoStatement(n)};}
   else if(ts.isReturnStatement(n)){if(n.expression&&ts.isConditionalExpression(n.expression))x=conditional(n.expression);else{x.kind='return';x.terminal=true;}}
   else if(ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&ts.isPropertyAccessExpression(n.expression.expression)&&n.expression.expression.name.text==='forEach'&&n.expression.arguments[0]&&ts.isArrowFunction(n.expression.arguments[0])){const cb=n.expression.arguments[0];x={...pos,kind:'iteration',label:'对选出的每一项重复处理',children:ts.isBlock(cb.body)?sequence([...cb.body.statements],depth+1):[{...range(cb.body),kind:'step',label:value(cb.body)}],detail:'按标准列表 forEach 的用法逐项调用回调；回调中的 return 只结束这一项的处理，不会直接退出外面的函数。'};}
   else if(ts.isThrowStatement(n)){x.kind='throw';x.label='报告错误，寻找匹配的错误处理路径';x.terminal=true;}
   else if(ts.isBreakStatement(n)||ts.isContinueStatement(n)){x.kind=ts.isBreakStatement(n)?'break':'continue';x.label=n.label?'转移到标签 '+n.label.text:ts.isBreakStatement(n)?'跳出当前循环或 switch':'跳到当前循环的下一轮';x.terminal=true;}
   else if(ts.isFunctionDeclaration(n)){x.kind='definition';x.label='准备函数 '+(n.name?.text||'内部功能')+'，函数体在调用时执行';}
   else if(ts.isClassDeclaration(n)){x.kind='unknown';x.label='定义类 '+(n.name?.text||'')+'；静态初始化等定义时行为未展开';}
   else if(ts.isTryStatement(n)){
    x={...pos,kind:'exception',label:'尝试正常处理，出错时进入 catch',detail:'try 内报告的错误进入 catch；没有 catch 时继续向外报告。finally 在离开时收尾，也可能改变返回或错误。',children:sequence(list(n.tryBlock),depth+1),handlers:n.catchClause?[{...range(n.catchClause),kind:'handler',label:'发生错误时'+(n.catchClause.variableDeclaration?'，保存为 '+n.catchClause.variableDeclaration.getText(source):''),children:sequence(list(n.catchClause.block),depth+1)}]:[],finalizer:n.finallyBlock?sequence(list(n.finallyBlock),depth+1):[]};
    x.terminal=!!x.finalizer.at(-1)?.terminal;
   }
   else if(ts.isSwitchStatement(n)){x.kind='unknown';x.label='按多个情况分支；内部转移未展开';}
   nodes.push(x);if(x.terminal)break;
  }return nodes;
 }
 function conditional(n){return {...range(n.condition),kind:'condition',label:condition(n.condition),children:[{...range(n.whenTrue),kind:'return',label:'交回：'+value(n.whenTrue),detail:'条件成立时，只计算这个结果并交回调用处。',terminal:true}],otherwise:[{...range(n.whenFalse),kind:'return',label:'交回：'+value(n.whenFalse),detail:ts.isStringLiteral(n.whenFalse)&&n.whenFalse.text===''?'条件不成立时交回空字符串：它仍然是文字，但里面没有任何字符。这里不会执行另一条分支的处理。':'条件不成立时，只计算这个结果并交回调用处。',terminal:true}],terminal:true};}
 if(!body)return [];
 if(!ts.isBlock(body))return [ts.isConditionalExpression(body)?conditional(body):{...range(body),kind:'return',label:'交回：'+value(body),terminal:true}];
 return sequence([...body.statements]);
}
module.exports={flowOf};
