const {test}=require('node:test'),assert=require('node:assert/strict');
const display=require('../public/point-display'),reading=require('../public/reading-model');
class Dom {
 constructor(tag,doc,text=''){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.value=text;this.className='';}
 append(...nodes){for(const n of nodes)if(n.tagName==='#fragment')this.append(...n.children);else this.children.push(n);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 set textContent(value){this.value=value;this.children=[];}get textContent(){return this.value+this.children.map(n=>n.textContent).join('');}
}
const doc={createElement:tag=>new Dom(tag,doc),createTextNode:text=>new Dom('#text',doc,text),createDocumentFragment:()=>new Dom('#fragment',doc)};
function codes(node){return node.children.flatMap(n=>n.tagName==='code'?[n.textContent]:codes(n));}
function render(text,source,language='JavaScript',context={source}){globalThis.WhoReading=reading;return display.render(doc.createElement('p'),text,language,context);}
test('actual source references next to Han prose and exact expressions retain every visible character',()=>{
 const source='function collectAccepted(values, limit) { const accepted=[]; let total=0; try { if(total + value > limit) return { count: accepted.length, total }; } catch(error) { total=0; } finally {} }';
 const text='collectAccepted处理values，accepted和一个结果，把total重新设为零；try/catch/finally。\n\n判断total + value > limit，得到{ count: accepted.length, total }。';
 const node=render(text,source);assert.equal(node.textContent,text);const c=codes(node);for(const value of ['collectAccepted','values','accepted','total','try','catch','finally','total + value > limit','{ count: accepted.length, total }'])assert.ok(c.includes(value),JSON.stringify(c));
});
test('source evidence does not color English prose, identifier substrings, strings, comments or unknown assumptions',()=>{
 const source='const total=1, count=2, accepted=[]; // phantom\nconst note="imaginary";';
 for(const text of ['中文说明：the total count is large','acceptedé αaccepted accepted_tail accepted2 $accepted','phantom和imaginary与invented','"accepted" and \'total\''])assert.deepEqual(codes(render(text,source)),[],text);
 assert.deepEqual(codes(render('accepted保存结果',source)),['accepted']);
 assert.deepEqual(codes(render('accepted保存结果',source,'Java')),[]);
});
test('explicit markers remain independent of evidence, quotes and hostile text stay inert',()=>{
 const node=render('`"Ada"` and `<img onerror=bad>`; it\'s unchanged.','const values=[];');
 assert.equal(node.textContent,'"Ada" and <img onerror=bad>; it\'s unchanged.');assert.deepEqual(codes(node),['"Ada"','<img onerror=bad>']);assert.ok(!JSON.stringify(node.children.map(n=>n.tagName)).includes('img'));
});
test('one module context scans selected source once across summary and two IO paragraphs',()=>{
 const source='const values=[];',context={source};let scans=0;globalThis.WhoReading={scan:(value,lang)=>{if(value===source)scans++;return reading.scan(value,lang);}};
 for(const value of ['values保存内容','传入values这份内容','得到values对应结果'])display.render(doc.createElement('p'),value,'JavaScript',context);
 assert.equal(scans,1);context.source='const total=0;';display.render(doc.createElement('p'),'total保存结果','JavaScript',context);assert.equal(scans,1);globalThis.WhoReading=reading;
});

test('actual Chinese IO labels use source membership without coloring ordinary English colon labels',()=>{
 const source='function collectAccepted(values, limit) { for (const value of values) { if(value > limit) break; } }';
 const text='values：被 for...of 逐个取出的数据。limit：在判断 value > limit 时使用的上限。';const node=render(text,source);assert.equal(node.textContent,text);assert.ok(codes(node).includes('values'));assert.ok(codes(node).includes('limit'));
 for(const plain of ['values: 3; limit: 4','values：three items','unknown：传入内容'])assert.deepEqual(codes(render(plain,source)),[],plain);
});
