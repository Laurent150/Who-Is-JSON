const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){const data=new Map();let fail=false;const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}};const context={localStorage,Event,window:{dispatchEvent(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../public/library-store.js'),'utf8'),context);return {s:context.window.WhoLibraryStore,data,fail:()=>fail=true};}
const remote=(revision=0)=>({revision,payload:{knowledge:[],cards:[]}});
const card=id=>({id,title:id,code:'test'});
const plain=x=>JSON.parse(JSON.stringify(x));
test('guest favorites remain separate until explicit import; accounts stay isolated',()=>{
 const {s,data}=setup();s.setItem('codelingo.cards',JSON.stringify([card('guest')]));s.activate('a',remote());assert.equal(s.getItem('codelingo.cards'),'[]');assert.equal(s.snapshot().dirty,false);
 s.importGuest();assert.equal(s.snapshot().payload.cards[0].id,'guest');assert.ok(data.get('codelingo.cards').includes('guest'));
 s.activate('b',remote());assert.equal(s.getItem('codelingo.cards'),'[]');s.activate('a',remote(2));assert.equal(s.snapshot().dirty,true);assert.equal(s.snapshot().revision,0);
 s.deactivate();assert.equal(JSON.parse(s.getItem('codelingo.cards'))[0].id,'guest');
});
test('in-flight save does not mark later edits as synced',()=>{
 const {s}=setup();s.activate('a',remote());s.setItem('codelingo.cards',JSON.stringify([card('one')]));const before=s.snapshot();s.setItem('codelingo.cards',JSON.stringify([card('two')]));s.acknowledged(1,before.sequence,before.payload);assert.equal(s.snapshot().dirty,true);assert.equal(s.snapshot().revision,1);
 const after=s.snapshot();s.acknowledged(2,after.sequence,after.payload);assert.equal(s.snapshot().dirty,false);
});
test('explicit cloud replacement retains an exportable backup; quota failures preserve state',()=>{
 const {s,fail}=setup();s.activate('a',remote());s.setItem('codelingo.cards',JSON.stringify([card('local')]));s.replace(remote(2));assert.equal(s.backup().cards[0].id,'local');assert.deepEqual(plain(s.snapshot().payload),remote().payload);
 fail();assert.throws(()=>s.setItem('codelingo.cards',JSON.stringify([card('lost')])));assert.deepEqual(plain(s.snapshot().payload),remote().payload);
});
test('damaged stored data blocks account switching rather than overwriting it',()=>{
 const {s,data}=setup();data.set('whoisjson.account-library.v1.a','broken');assert.throws(()=>s.activate('a',remote()));assert.equal(data.get('whoisjson.account-library.v1.a'),'broken');
});
