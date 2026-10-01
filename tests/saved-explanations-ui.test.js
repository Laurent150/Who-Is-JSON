const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Model=require('../public/saved-explanations');
async function setup(initial=[],mode='beginner'){
 const item=await Model.create({answer:'Return the value.',source:{file:'test.js',language:'JavaScript',fullSource:'return value;',start:1,end:1}});
 let stored=JSON.stringify(initial),fail=false;
 const inputs=[],buttons=[],notices=[],host={append(button){buttons.push(button);}};
 const context=vm.createContext({readingMode:mode,WhoAIGlossary:require('../public/ai-glossary'),TextEncoder,WhoI18n:{locale:'en'},uiText:t=>t,
  WhoSavedExplanations:{create:async input=>{inputs.push(input);return item;}},KNOWLEDGE_KEY:'knowledge',knowledgeSaved:()=>JSON.parse(stored),saved:()=>[],
  WhoLibraryStore:{setItem(key,value){if(fail)throw Object.assign(Error('full'),{name:'QuotaExceededError'});stored=value;}},
  toast:t=>notices.push(t),document:{querySelectorAll:()=>buttons.filter(b=>b.dataset.explanationSave)},
  element(){return {dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;}}}
 });
 vm.runInContext(fs.readFileSync(require.resolve('../public/saved-explanations-ui'),'utf8'),context);
 async function append(answer='Return the value.'){context.appendExplanationSave(host,answer,item.sources[0]);await Promise.resolve();return buttons.at(-1);}
 return {append,item,notices,inputs,items:()=>JSON.parse(stored),fail:()=>{fail=true;}};
}
test('all visible save buttons stay synchronized and toggling removes only the matching explanation',async()=>{
 const other={id:'existing',card:{title:'Keep me'},sources:[]},ui=await setup([other]),a=await ui.append(),b=await ui.append();
 assert.equal(a.textContent,'Save');a.onclick();assert.equal(a.textContent,'Saved');assert.equal(b.textContent,'Saved');assert.equal(b.attributes['aria-pressed'],'true');
 assert.equal(ui.items().length,2);b.onclick();assert.deepEqual(ui.items(),[other]);assert.equal(a.textContent,'Save');
});
test('storage failures and the cloud item limit preserve existing data and do not claim success',async()=>{
 const old={id:'existing'},ui=await setup([old]),button=await ui.append();ui.fail();button.onclick();
 assert.deepEqual(ui.items(),[old]);assert.equal(button.textContent,'Save');assert.equal(ui.notices.length,1);
 const full=await setup(Array.from({length:500},(_,i)=>({id:'old.'+i}))),next=await full.append();next.onclick();
 assert.equal(full.items().length,500);assert.ok(!full.items().some(x=>x.id===full.item.id));assert.equal(next.textContent,'Save');assert.equal(full.notices.length,1);
});

test('beginner term definitions stay with saved AI explanations without expanding standard mode',async()=>{
 const beginner=await setup(),standard=await setup([],'standard');
 await beginner.append('The function returns a Promise.');await standard.append('The function returns a Promise.');
 assert.match(beginner.inputs[0].answer,/Terms used here/);assert.match(beginner.inputs[0].answer,/Promise —/);
 assert.equal(standard.inputs[0].answer,'The function returns a Promise.');
});
