// Read-only links for unambiguous, directly named functions in this file.
// Unknown imports, methods, aliases, mutable/reassigned bindings and dynamic
// scopes are deliberately not promoted to a confirmed definition link.
const ts=require('typescript');
function functionLinks(source,checker,blocks){
 if(source.parseDiagnostics.length)return [];
 const calls=[],writes=new Set(),propertyWrites=new Set();let dynamic=false;
 const line=n=>source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
 function markWrite(node){
  if(ts.isShorthandPropertyAssignment(node)){const symbol=checker.getShorthandAssignmentValueSymbol(node);if(symbol)writes.add(symbol);}
  if(ts.isIdentifier(node)){const symbol=checker.getSymbolAtLocation(node);if(symbol)writes.add(symbol);}
  if(ts.isPropertyAccessExpression(node))propertyWrites.add(node.name.text);
  if(ts.isElementAccessExpression(node)){
   if(ts.isStringLiteral(node.argumentExpression))propertyWrites.add(node.argumentExpression.text);
   else dynamic=true;
  }
  ts.forEachChild(node,markWrite);
 }
 function visit(node,owner){
  if(ts.isWithStatement(node)||(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='eval'))dynamic=true;
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment)markWrite(node.left);
  if((ts.isForOfStatement(node)||ts.isForInStatement(node))&&!ts.isVariableDeclarationList(node.initializer))markWrite(node.initializer);
  if((ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator))markWrite(node.operand);
  if(ts.isFunctionLike(node))owner=node;
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression))calls.push({node,owner});
  ts.forEachChild(node,child=>visit(child,owner));
 }
 visit(source,null);if(dynamic)return [];
 const functions=blocks.filter(b=>b.kind==='function');
 const find=n=>{const matches=functions.filter(b=>b.start===line(n));return matches.length===1?matches[0]:null;};
 return calls.flatMap(({node,owner})=>{
  const symbol=checker.getSymbolAtLocation(node.expression),declarations=symbol?.declarations;
  if(!declarations||declarations.length!==1||writes.has(symbol)||propertyWrites.has(node.expression.text))return [];
  const target=declarations[0];if(!ts.isFunctionDeclaration(target)||!target.body||target.getSourceFile()!==source)return [];
  const to=find(target),from=owner&&find(owner);if(!to||(owner&&!from))return [];
  return [{name:node.expression.text,fromStart:from?.start||0,toStart:to.start,line:line(node)}];
 });
}
module.exports={functionLinks};
