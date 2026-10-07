// Parser-derived syntax only, never a runtime type or reachability proof.
// Source stays data; createSourceFile neither imports nor executes it.
function parseSource(source,filename){
 if(typeof source!=='string'||! /\.(?:[cm]?js|jsx|ts|tsx)$/i.test(filename))return null;
 const ts=require('typescript');
 const kind=/\.tsx$/i.test(filename)?ts.ScriptKind.TSX:/\.jsx$/i.test(filename)?ts.ScriptKind.JSX:/\.ts$/i.test(filename)?ts.ScriptKind.TS:ts.ScriptKind.JS;
 const file=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,kind);
 if(file.parseDiagnostics.length)return null;
 return {ts,file};
}
function parameterReturns(source,filename=''){
 const parsed=parseSource(source,filename);if(!parsed?.file)return [];
 const {ts,file}=parsed;
 const facts=[];
 function inspect(node){
  if(ts.isReturnStatement(node)&&node.expression&&ts.isIdentifier(node.expression)){
   let owner=node.parent;while(owner&&!ts.isFunctionLike(owner))owner=owner.parent;
   const parameter=owner?.parameters?.find(p=>ts.isIdentifier(p.name)&&p.name.text===node.expression.text);
   // Conservatively omit shadowed bindings, including nested declarations.
   // This may omit a useful record; it must never label a local as a parameter.
   let shadowed=false;
   function declarations(n){
    if(ts.isWithStatement(n))shadowed=true;
    if(n!==owner&&(ts.isVariableDeclaration(n)||ts.isParameter(n)||ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isClassDeclaration(n)||ts.isClassExpression(n)||ts.isEnumDeclaration(n)||ts.isModuleDeclaration(n))&&n.name){
     function matches(name){return ts.isIdentifier(name)?name.text===parameter.name.text:ts.isObjectBindingPattern(name)||ts.isArrayBindingPattern(name)?name.elements.some(e=>e.name&&matches(e.name)):false;}
     if(matches(n.name))shadowed=true;
    }
    ts.forEachChild(n,declarations);
   }
   if(parameter&&owner.body){declarations(owner.body);if(!shadowed)facts.push({function:owner.name?.getText(file)||'(anonymous)',parameter:parameter.name.text,declaredType:parameter.type?.getText(file)||null,async:!!owner.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword),generator:!!owner.asteriskToken,returnQuote:source.slice(node.getStart(file),node.getEnd())});}
  }
  ts.forEachChild(node,inspect);
 }
 inspect(file);return facts.slice(0,60);
}
function enclosingLoops(source,filename,selection){
 if(typeof source!=='string'||!selection||!Number.isInteger(selection.start)||!Number.isInteger(selection.end)||selection.start<1||selection.end<selection.start)return [];
 const lines=source.split('\n');if(selection.end>lines.length||selection.code!==lines.slice(selection.start-1,selection.end).join('\n'))return [];
 const parsed=parseSource(source,filename);if(!parsed?.file)return [];
 const {ts,file}=parsed,facts=[];
 const quote=node=>node?source.slice(node.getStart(file),node.getEnd()):null;
 function visit(node){
  if(ts.isForStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node)){
   const first=file.getLineAndCharacterOfPosition(node.statement.getStart(file)).line+1,last=file.getLineAndCharacterOfPosition(node.statement.getEnd()).line+1;
   let nestedFunction=false;
   function nested(n){if(ts.isFunctionLike(n)&&n.body){const start=file.getLineAndCharacterOfPosition(n.body.getStart(file)).line+1,end=file.getLineAndCharacterOfPosition(n.body.getEnd()).line+1;if(selection.start>=start&&selection.end<=end)nestedFunction=true;}ts.forEachChild(n,nested);}
   nested(node.statement);
   if(selection.start>=first&&selection.end<=last&&!nestedFunction)facts.push({kind:ts.isForStatement(node)?'for':ts.isDoStatement(node)?'do-while':'while',initialization:quote(node.initializer),condition:quote(node.condition||node.expression),update:quote(node.incrementor)});
  }
  ts.forEachChild(node,visit);
 }
 visit(file);return facts.slice(0,12);
}
module.exports={parameterReturns,enclosingLoops};
