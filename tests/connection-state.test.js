const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('app.js',fs.readFileSync(require.resolve('../public/app.js'),'utf8'),ts.ScriptTarget.Latest,true);
const functions=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&['effectiveConfig','connected','connection'].includes(node.name.text)).map(node=>node.getText(source)).join('\n');
function setup(config={},trial=false){
 const nodes={connection:{},localModeNotice:{hidden:true}};
 const context=vm.createContext({config,window:{WhoTrial:{enabled:trial}},URL,$:id=>nodes[id],uiText:value=>value});
 vm.runInContext(functions,context);return {context,nodes,refresh:()=>vm.runInContext('connection();connected()',context)};
}
test('a saved remote address without the in-memory key remains in local mode',()=>{
 const app=setup({base:'https://api.deepseek.com',model:'deepseek-flash'});
 assert.equal(app.refresh(),false);assert.equal(app.nodes.localModeNotice.hidden,false);assert.equal(app.nodes.connection.textContent,'● 本地模式');
 app.context.config.key='test-only';assert.equal(app.refresh(),true);assert.equal(app.nodes.localModeNotice.hidden,true);
});
test('available trial enables AI and exhausted or opted-out trial restores the local notice',()=>{
 const app=setup({},true);assert.equal(app.refresh(),true);assert.equal(app.nodes.localModeNotice.hidden,true);
 app.context.window.WhoTrial.enabled=false;assert.equal(app.refresh(),false);assert.equal(app.nodes.localModeNotice.hidden,false);
 app.context.window.WhoTrial.enabled=true;app.context.window.WhoTrialOptOut=true;assert.equal(app.refresh(),false);
});
test('local keyless endpoints remain usable and a personal key survives trial unavailability',()=>{
 for(const base of ['http://127.0.0.1:9000/v1','http://localhost:9000/v1','http://[::1]:9000/v1'])assert.equal(setup({base,model:'local'}).refresh(),true);
 assert.equal(setup({base:'https://api.deepseek.com',model:'deepseek-flash',key:'test-only'},false).refresh(),true);
 assert.equal(setup({base:'invalid',model:'local'}).refresh(),false);
 assert.equal(setup({base:'https://api.deepseek.com',key:'test-only'}).refresh(),false);
});
