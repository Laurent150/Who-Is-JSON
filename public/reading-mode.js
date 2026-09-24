let readingMode='beginner';
try{if(localStorage.getItem('whoisjson.readingMode')==='standard')readingMode='standard';}catch{}
function beginnerMode(){return readingMode==='beginner';}
function applyReadingMode(){
 $('readingMode').value=readingMode;
 document.body.dataset.readingMode=readingMode;
}
function changeReadingMode(value){
 const next=value==='standard'?'standard':'beginner';if(next===readingMode)return;
 readingMode=next;try{localStorage.setItem('whoisjson.readingMode',next);}catch{toast('当前选择可用，但浏览器未能保存偏好。');}
 applyReadingMode();revision++;analysisAbort?.abort();resetTalk();studioReset();studioSource=null;
 $('aiProgress').hidden=true;$('answer').hidden=true;
 if(current){
  const {aiOverview,aiOverviewError,...local}=current;
  current={...local,mode:'local',blocks:current.blocks.map(({aiExplanation,...block})=>block)};
  render();
 }
 toast('已切换为'+(beginnerMode()?'零基础友好':'标准')+'。再次点击即可按新模式解释。');
}
$('readingMode').onchange=e=>changeReadingMode(e.target.value);
applyReadingMode();
