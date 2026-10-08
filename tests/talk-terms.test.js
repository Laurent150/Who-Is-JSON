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

test('true and false form one bilingual concept note without binding claims or standard teaching',()=>{
 const glossary=require('../public/ai-glossary'),raw='When open is true, the selected item is returned; otherwise false.';
 for(const language of ['JavaScript','TypeScript'])for(const locale of ['en','zh-CN']){
  const terms=glossary.forText(raw,language,locale);assert.equal(terms.length,1);assert.equal(terms[0].name,'true / false');
  assert.match(terms[0].meaning,locale==='en'?/As JavaScript language values/:/作为JavaScript语言值时/);assert.doesNotMatch(terms[0].meaning,/open|boolean|布尔/);
 }
 for(const text of ['verytrueish','true_count','falsehood','$true','中文true名称','True','FALSE'])assert.deepEqual(glossary.forText(text,'JavaScript','en'),[]);
 assert.deepEqual(glossary.forText(raw,'Python','en'),[]);
 const source=fs.readFileSync(require.resolve('../public/reading-mode'),'utf8'),element=(tag,text,cls)=>({tag,text,cls,children:[],append(...nodes){this.children.push(...nodes);}});
 let beginner=true;const context={beginnerMode:()=>beginner,WhoAIGlossary:glossary,WhoI18n:{locale:'zh-CN'},current:{language:'JavaScript'},element};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function appendAITerms(')),context);
 const host=element('aside'),seen=new Set();context.appendAITerms(host,raw,seen);assert.equal(host.children.length,1);assert.equal(host.children[0].children.length,2);context.appendAITerms(host,'false true',seen);assert.equal(host.children.length,1);
 beginner=false;const standard=element('aside');context.appendAITerms(standard,raw);assert.equal(standard.children.length,0);assert.equal(raw,'When open is true, the selected item is returned; otherwise false.');
});

test('null adds only a bilingual language concept with beginner gating and unchanged raw text',()=>{
 const glossary=require('../public/ai-glossary'),raw='The actual value is null, not undefined.';
 for(const language of ['JavaScript','TypeScript'])for(const locale of ['en','zh-CN']){
  const terms=glossary.forText('null null',language,locale);assert.equal(terms.length,1);assert.equal(terms[0].name,'null');assert.match(terms[0].meaning,locale==='en'?/As a JavaScript language value, null explicitly means/:/作为JavaScript语言值时，null是用来明确表示/);assert.doesNotMatch(terms[0].meaning,/undefined|Guest|account|field|账号|字段/);
 }
 for(const text of ['nullish','null_count','$null','中文null名称','Null','NULL'])assert.deepEqual(glossary.forText(text,'JavaScript','en'),[]);
 assert.deepEqual(glossary.forText('null','Python','en'),[]);
 const source=fs.readFileSync(require.resolve('../public/reading-mode'),'utf8'),element=(tag,text,cls)=>({tag,text,cls,children:[],append(...nodes){this.children.push(...nodes);}});let beginner=true;
 const context={beginnerMode:()=>beginner,WhoAIGlossary:glossary,WhoI18n:{locale:'en'},current:{language:'JavaScript'},element};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function appendAITerms(')),context);
 const notes=element('aside');context.appendAITerms(notes,raw);assert.equal(notes.children.length,1);assert.equal(notes.children[0].children.length,3);assert.match(notes.children[0].children[1].text,/null —/);
 beginner=false;const standard=element('aside');context.appendAITerms(standard,raw);assert.equal(standard.children.length,0);assert.equal(raw,'The actual value is null, not undefined.');
});
