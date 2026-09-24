let talkResult=null,talkIdentity='',talkConfig=null,talkController=null,talkTimer=null;
function talkKey(){return JSON.stringify([readingMode,analyzedSource,fileName,sourceOffset,$('duration').value,$('audience').value,$('coverage').value]);}
function resetTalk(){
 talkController?.abort();talkController=null;clearInterval(talkTimer);talkResult=null;talkIdentity='';
 $('generateTalk').disabled=false;$('cancelTalk').hidden=true;$('talkStatus').textContent='';
}
function talkDraft(){
 const key=talkKey();
 if(talkIdentity!==key||talkConfig!==config){resetTalk();talkIdentity=key;talkConfig=config;}
 $('generateTalk').textContent=talkResult?'重新生成 AI 讲解稿':'生成 AI 讲解稿';
 return talkResult||{title:'选择阅读基础、详略和范围，生成帮助理解代码的解释稿。',name:fileName,sections:[],questions:[],note:'点击生成会将本次分析的源码发送到你配置的 AI 服务。讲稿由 AI 完整撰写。'};
}
async function generateTalk(){
 if(!current)return;
 if(!connected()){settings();return;}
 talkDraft();talkController?.abort();const controller=new AbortController();talkController=controller;
 const key=talkKey(),usedConfig=config,started=Date.now();
 $('generateTalk').disabled=true;$('cancelTalk').hidden=false;
 const progress=()=>{$('talkStatus').textContent='AI 正在撰写完整讲解稿 · '+Math.floor((Date.now()-started)/1000)+' 秒';};progress();
 clearInterval(talkTimer);talkTimer=setInterval(progress,1000);
 try{
  const result=await api('talk',{code:analyzedSource,name:fileName,options:{detail:({'30':'brief','180':'standard','300':'detailed'})[$('duration').value],audience:$('audience').value,coverage:$('coverage').value},config},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(130000)]));
  if(controller!==talkController||controller.signal.aborted||key!==talkKey()||usedConfig!==config)return;
  talkResult=result;renderTalk();$('talkStatus').textContent='讲解稿已生成，可导出或进入专注讲稿。';
 }catch(e){if(controller===talkController)$('talkStatus').textContent=controller.signal.aborted?'已停止生成，可以重试。':'生成未完成：'+(e.name==='TimeoutError'?'等待超时，请重试。':e.message)+(talkResult?' 已保留上一份稿件。':'');}
 finally{if(controller===talkController){clearInterval(talkTimer);talkController=null;$('generateTalk').disabled=false;$('cancelTalk').hidden=true;}}
}
$('generateTalk').onclick=generateTalk;
$('cancelTalk').onclick=()=>talkController?.abort();
// Settings live next to the result, so they remain usable after source is folded.
$('talkControls').append(document.querySelector('.brief-controls'));
document.querySelector('.optional-talk').hidden=true;
