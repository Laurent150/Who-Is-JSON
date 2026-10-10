const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'public/locale-en.js'),'utf8'),context);
const dictionary=context.WhoEnglish,han=/[\u3400-\u9fff]/;
function check(key,where,missing){
 if(han.test(key)&&(!Object.hasOwn(dictionary,key)||han.test(dictionary[key])))missing.push(where+': '+key);
}
test('every literal UI translation key and server Error message has an English translation',()=>{
 const missing=[];
 const publicFiles=fs.readdirSync(path.join(root,'public')).filter(f=>f.endsWith('.js')&&f!=='locale-en.js').map(f=>'public/'+f);
 const serverFiles=[...fs.readdirSync(root).filter(f=>/^(cloud|server)/.test(f)&&f.endsWith('.js')),
  ...fs.readdirSync(path.join(root,'ai')).filter(f=>f.endsWith('.js')).map(f=>'ai/'+f)];
 for(const file of [...publicFiles,...serverFiles]){
  const ast=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
  function walk(n){
   if(ts.isCallExpression(n)||ts.isNewExpression(n)){
    const name=n.expression.getText(ast),arg=n.arguments?.[0];
    const translated=name==='uiText'||name==='t'||name.endsWith('.t');
    if(arg&&ts.isStringLiteralLike(arg)&&(translated||serverFiles.includes(file)&&name==='Error'))check(arg.text,file+':'+(ast.getLineAndCharacterOfPosition(n.pos).line+1),missing);
   }
   ts.forEachChild(n,walk);
  }
  walk(ast);
 }
 assert.deepEqual(missing,[]);
});
test('static interface text and accessible labels have English translations',()=>{
 const missing=[],html=fs.readFileSync(path.join(root,'public/index.html'),'utf8')
  .replace(/<(script|style|textarea|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 for(const match of html.matchAll(/>([^<>]+)</g)){
  const key=match[1].trim();
  if(key==='简体中文')continue; // Native language name in the language selector.
  check(key,'index.html text',missing);
 }
 for(const match of html.matchAll(/(?:title|alt|placeholder|aria-label|data-q)="([^"]+)"/g))check(match[1],'index.html attribute',missing);
 assert.deepEqual(missing,[]);
});

test('UI error sinks cannot render raw exception messages',()=>{
 const leaks=[];
 for(const file of fs.readdirSync(path.join(root,'public')).filter(f=>f.endsWith('.js'))){
  const ast=ts.createSourceFile(file,fs.readFileSync(path.join(root,'public',file),'utf8'),ts.ScriptTarget.Latest,true);
  function containsMessage(n){
   if(ts.isPropertyAccessExpression(n)&&n.name.text==='message')return true;
   return !!ts.forEachChild(n,containsMessage);
  }
  function walk(n){
   const assignment=ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&/\.(textContent|innerHTML|innerText)$/.test(n.left.getText(ast));
   const call=ts.isCallExpression(n)&&/^(uiText|toast|note|element)$/.test(n.expression.getText(ast));
   const values=assignment?[n.right]:call?[...(n.arguments||[])]:[];
   if(values.some(containsMessage))leaks.push(file+':'+(ast.getLineAndCharacterOfPosition(n.pos).line+1));
   ts.forEachChild(n,walk);
  }
  // The adapter extracts the message only for isolated legacy tests without i18n.
  // Check sinks in the application body, excluding the adapter declaration.
  for(const statement of ast.statements)if(!/^var uiError\b/.test(statement.getText(ast)))walk(statement);
 }
 assert.deepEqual(leaks,[]);
});
