let repairSnapshot=null,repairProposal=null,repairController=null,repairUndo=null;

function formatSuspicious(source){
 if(/^\s*(```|~~~)|&#(?:x20|32);|\\[_@-]|[\u00a0\u200b\uFEFF“”‘’]/m.test(source))return true;
 const lines=source.split('\n');
 if(!/\.py$/i.test(fileName)&&!/^\s*(?:async\s+)?def\s+\w+\s*\(/m.test(source))return false;
 return lines.some((line,i)=>{
  if(/^[ \t]*\t[ \t]* /.test(line)||/^[ ]+\t/.test(line))return true;
  if(!/^\s*(?:(?:async\s+)?def|class|if|elif|else|for|while|try|except|finally|with)\b.*:\s*(?:#.*)?$/.test(line))return false;
  const next=lines.slice(i+1).find(x=>x.trim()&&!/^\s*#/.test(x));
  return !!next&&next.match(/^\s*/)[0].length<=line.match(/^\s*/)[0].length;
 });
}
function updateFormatHint(result){
 const source=$('source').value;
 const parseProblem=!!result&&(result.syntaxErrors||result.status==='invalid');
 $('formatHint').hidden=!source.trim()||!(formatSuspicious(source)||parseProblem||result?.formatChanges?.length);
 $('formatHintText').textContent=parseProblem?'解析发现问题，可核对格式或缺失内容':'可能存在复制格式问题';
}
function formatSourceChanged(){
 repairController?.abort();
 if(repairSnapshot){repairSnapshot=null;repairProposal=null;$('cleanup').close();}
 if(repairUndo&&($('source').value!==repairUndo.after||fileName!==repairUndo.name))repairUndo=null;
 $('repairUndo').hidden=!repairUndo;
 updateFormatHint();
}
function validRepair(snapshot){return snapshot===repairSnapshot&&snapshot.revision===revision&&snapshot.code===$('source').value&&snapshot.name===fileName;}
function showRepair(proposal){
 repairProposal=proposal;
 const before=repairSnapshot.code.split('\n'),after=proposal.code.split('\n');
 // Bounded alignment keeps unchanged lines clear after inserted/deleted lines.
 const unchangedBefore=new Set(),unchangedAfter=new Set();let a=0,b=0;
 while(a<before.length&&b<after.length){
  if(before[a]===after[b]){unchangedBefore.add(a++);unchangedAfter.add(b++);continue;}
  let skipBefore=-1,skipAfter=-1;
  for(let distance=1;distance<=80;distance++){
   if(a+distance<before.length&&before[a+distance]===after[b]){skipBefore=distance;break;}
   if(b+distance<after.length&&before[a]===after[b+distance]){skipAfter=distance;break;}
  }
  if(skipBefore>0)a+=skipBefore;else if(skipAfter>0)b+=skipAfter;else {a++;b++;}
 }
 for(const [id,lines]of [['cleanOriginal',before],['cleanPreview',after]]){
  $(id).replaceChildren();
  const unchanged=id==='cleanOriginal'?unchangedBefore:unchangedAfter;
  lines.forEach((line,i)=>$(id).append(element('span',String(i+1).padStart(3)+'  '+line,'repair-line'+(!unchanged.has(i)?' changed':''))));
 }
 $('cleanChanges').textContent=(proposal.origin==='ai'?'AI 修复建议':'本地格式建议')+'：\n'+(proposal.changes.join('\n')||'未找到可确定的格式修复；请对照原文件，或请求 AI 建议。');
 $('repairNotice').textContent=proposal.origin==='ai'?(proposal.notice||''):'';
 $('repairNotice').hidden=!$('repairNotice').textContent;
 $('applyClean').disabled=proposal.code===repairSnapshot.code;
}
async function previewCleanup(){
 if(!$('source').value.trim())return;
 repairController?.abort();
 const snapshot={code:$('source').value,name:fileName,revision};repairSnapshot=snapshot;repairProposal=null;
 $('cleanOriginal').textContent=snapshot.code;$('cleanPreview').textContent='';$('cleanChanges').textContent='正在检查复制格式…';$('repairNotice').textContent='';$('applyClean').disabled=true;$('aiRepair').disabled=true;
 if(!$('cleanup').open)$('cleanup').showModal();
 try {const result=await api('prepare',{code:snapshot.code});if(validRepair(snapshot))showRepair(result);}
 catch(e){if(validRepair(snapshot))$('cleanChanges').textContent=e.message;}
 finally {if(validRepair(snapshot))$('aiRepair').disabled=false;}
}
$('cleanBtn').onclick=previewCleanup;
$('aiRepair').onclick=async()=>{
 const snapshot=repairSnapshot;if(!snapshot||!validRepair(snapshot))return;
 if(!connected()){settings();return;}
 const usedConfig=config,controller=new AbortController();repairController?.abort();repairController=controller;
 $('aiRepair').disabled=true;$('applyClean').disabled=true;$('cancelRepair').hidden=false;$('cleanChanges').textContent='AI 正在生成修复建议…';
 try {
  const result=await api('repair',{code:snapshot.code,name:snapshot.name,config:usedConfig},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(130000)]));
  if(validRepair(snapshot)&&repairController===controller&&!controller.signal.aborted&&config===usedConfig)showRepair(result);
 }catch(e){if(validRepair(snapshot)&&repairController===controller)$('cleanChanges').textContent=controller.signal.aborted?'已停止。原文未修改。':e.name==='TimeoutError'?'等待超时，请重试。原文未修改。':e.message;}
 finally {
  if(repairController===controller){repairController=null;$('aiRepair').disabled=false;$('cancelRepair').hidden=true;
   if(validRepair(snapshot)){$('applyClean').disabled=!repairProposal||repairProposal.code===snapshot.code;if(config!==usedConfig)$('cleanChanges').textContent='AI 配置已变化，请重新请求建议。';}
  }
 }
};
$('cancelRepair').onclick=()=>repairController?.abort();
$('cleanup').addEventListener('close',()=>{repairController?.abort();repairController=null;repairSnapshot=null;repairProposal=null;$('aiRepair').disabled=false;$('cancelRepair').hidden=true;});
$('applyClean').onclick=()=>{
 const snapshot=repairSnapshot,proposal=repairProposal;
 if(!snapshot||!proposal||!validRepair(snapshot)||repairController)return;
 const undo={before:snapshot.code,after:proposal.code,name:snapshot.name};
 repairSnapshot=null;repairProposal=null;$('cleanup').close();setCode(undo.after,undo.name);
 repairUndo=undo;$('repairUndo').hidden=false;toast('已应用修复。请核对后重新分析，也可以撤销。');
};
$('undoRepair').onclick=()=>{
 const undo=repairUndo;if(!undo||$('source').value!==undo.after||fileName!==undo.name)return;
 repairUndo=null;setCode(undo.before,undo.name);toast('已恢复修复前的原文。');
};
updateFormatHint();
