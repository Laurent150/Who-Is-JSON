const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('walkthrough term notes deduplicate across sections but remain available on a fresh render',()=>{
 const source=fs.readFileSync(require.resolve('../public/reading-mode'),'utf8');
 const code=source.slice(source.indexOf('function appendAITerms('));
 const element=(tag,text,cls)=>({tag,text,cls,children:[],append(...nodes){this.children.push(...nodes);}});
 const context={beginnerMode:()=>true,WhoAIGlossary:require('../public/ai-glossary'),WhoI18n:{locale:'en'},current:{language:'JavaScript'},element};vm.createContext(context);vm.runInContext(code,context);
 const seen=new Set(),a=element('article'),b=element('article'),c=element('article');
 context.appendAITerms(a,'Returns a Promise.',seen);context.appendAITerms(b,'Waits for a Promise.',seen);context.appendAITerms(c,'Returns a Promise.',new Set());
 assert.equal(a.children.length,1);assert.equal(b.children.length,0);assert.equal(c.children.length,1);
 const token=element('aside');context.appendAITerms(token,'Returns a Promise.');assert.equal(token.children.length,1);
 assert.match(fs.readFileSync(require.resolve('../public/app'),'utf8'),/appendAITerms\(card,s.text,talkTerms\)/);
});
