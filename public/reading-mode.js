var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
let readingMode='beginner';
try{if(localStorage.getItem('whoisjson.readingMode')==='standard')readingMode='standard';}catch{}
function beginnerMode(){return readingMode==='beginner';}
function beginnerSelectionQuestion(){
 return globalThis.WhoI18n?.locale==='en'
  ?'Explain the selected code here to an adult with no programming background.'
  :'请解释选中的代码段，让一个没有编程背景的成年人能看懂。';
}
function applyReadingMode(){
 $('readingMode').value=readingMode;
 document.body.dataset.readingMode=readingMode;
}
function changeReadingMode(value){
 const next=value==='standard'?'standard':'beginner';if(next===readingMode)return;
 readingMode=next;try{localStorage.setItem('whoisjson.readingMode',next);}catch{toast(uiText("当前选择可用，但浏览器未能保存偏好。"));}
 applyReadingMode();revision++;analysisAbort?.abort();resetTalk();studioReset();studioSource=null;
 $('aiProgress').hidden=true;$('answer').hidden=true;
 if(current){
  const {aiOverview,aiOverviewError,...local}=current;
  current={...local,mode:'local',blocks:current.blocks.map(({aiExplanation,...block})=>block)};
  render();
 }
 toast(uiText("已切换为")+(beginnerMode()?uiText("零基础友好"):uiText("标准"))+uiText("。再次点击即可按新模式解释。"));
}
$('readingMode').onchange=e=>changeReadingMode(e.target.value);
applyReadingMode();

function appendAITerms(host,text,seen){
 if(!beginnerMode()||!globalThis.WhoAIGlossary)return;
 const terms=WhoAIGlossary.forText(text,current?.language,globalThis.WhoI18n?.locale).filter(term=>!seen?.has(term.name));
 if(seen)for(const term of terms)seen.add(term.name);
 if(!terms.length)return;
 const notes=element('span',undefined,'ai-term-notes');notes.append(element('strong',globalThis.WhoI18n?.locale==='en'?'Terms used here':'这里的术语'));
 for(const term of terms)notes.append(element('span',term.name+' — '+term.meaning));
 host.append(notes);
}
