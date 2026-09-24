// AI reading workspace. Parser ranges anchor every node and clickable token.
let studioSource=null,studioConfig=null,studioVersion=0,studioRequest=0,studioTokenRequest=0;
let studioCache=new Map(),studioAnswers=new Map(),studioControllers=new Set(),studioSelected=null,studioAnchor=1,studioTokenAnchor=null;
function studioReset(){
 studioVersion++;studioRequest++;studioTokenRequest++;
 for(const c of studioControllers)c.abort();studioControllers.clear();
 studioCache.clear();studioAnswers.clear();studioSelected=null;closeStudioToken();
}
function studioIdentity(){
 if(studioSource!==analyzedSource||studioConfig!==config){studioReset();studioSource=analyzedSource;studioConfig=config;return true;}return false;
}
async function studioApi(route,data){
 const c=new AbortController();studioControllers.add(c);
 const signal=AbortSignal.any([c.signal,AbortSignal.timeout(130000)]);
 try{const result=await api(route,{code:analyzedSource,name:fileName,config,...(current.languageIdentification?.status==='verified'?{languageHint:current.languageIdentification.language}:{}),...data},'POST',signal);signal.throwIfAborted();return result;}
 catch(error){
  if(c.signal.aborted)throw new Error('已停止生成，源码未修改，可以重试。');
  if(signal.aborted||error.name==='TimeoutError')throw new Error('AI 服务响应超时，源码未修改，请稍后重试。');
  throw error;
 }
 finally{studioControllers.delete(c);}
}
function renderStudio(){
 const changed=studioIdentity();
 $('studioFile').textContent=(fileName||'代码片段')+' · '+current.language;
 $('studioOverview').textContent=current.aiOverview?.summary||'从文件入口或一个函数开始。展开流程，再点击步骤对照源码。';
 if(!changed&&$('studioCode').children.length)return;
 renderStudioCode();
 const host=$('studioFlow');host.replaceChildren();
 const items=WhoStructure.modules(current);
 const entry=items.find(x=>x.block.role==='script-entry');
 $('studioEntry').textContent=entry?'文件入口已定位；函数体在被调用时进入。':'没有确定的执行入口，请选择想了解的函数。';
 for(const item of [...(entry?[entry]:[]),...items.filter(x=>x!==entry)])host.append(studioFunction(item.block,[]));
 if(!items.length)host.append(element('p','尚未定位到可展开结构；仍可选中源码请求 AI 解释。','studio-note'));
 $('studioExplain').replaceChildren(element('p','点击左侧流程步骤，或在中间选择一行代码。','studio-empty'));
 $('studioRange').textContent='等你选择';
}
function studioFunction(block,path){
 const details=element('details',undefined,'studio-function');details.dataset.function=block.title;
 const type=block.role==='script-entry'?'文件入口':({function:'函数',class:'类',module:'文件',loop:'循环',condition:'条件判断',error:'异常处理'})[block.kind]||'代码结构';
 const summary=element('summary');summary.append(element('span',type,'studio-function-type'),element('strong',block.role==='script-entry'?'从这里开始':block.title),element('small','第 '+(block.start+sourceOffset)+'—'+(block.end+sourceOffset)+' 行 · 点击定位源码'));details.append(summary);
 summary.addEventListener('click',()=>{
  studioAnchor=block.start;studioSelect(block.start,block.end,false);studioRevealLine(block.start);
  $('studioExplain').replaceChildren(element('h3',type+' · '+block.title),element('p',block.kind==='function'?(beginnerMode()?'这里定义了'+block.title+'。展开后，可以看它分几步做完。':'这是函数名。函数是一段可以通过名字调用的代码；中间已高亮它的定义和函数体。展开后生成 AI 流程，可以了解它具体做什么。'):'中间已高亮这段'+type+'对应的源码。展开流程后，可以逐步对照阅读。'));
 });
 const body=element('div',undefined,'studio-function-body');details.append(body);
 let loaded=false,loading=false;
 const load=async()=>{
  if(loaded||loading)return;
  body.replaceChildren();
  if(path.includes(block.start)){body.append(element('p','再次调用 '+block.title+'。这是递归调用；是否停止取决于函数内的退出条件。','studio-note'));loaded=true;return;}
  if(path.length>=6){body.append(element('p','已展开 6 层。请从功能目录单独打开这个函数，继续阅读。','studio-note'));return;}
  const generate=element('button',connected()?'生成这个函数的 AI 流程':'配置 AI 后生成流程','studio-generate');body.append(generate);
  generate.onclick=async()=>{
   if(!connected()){settings();return;}
   studioIdentity();const version=studioVersion;loading=true;generate.disabled=true;
   const start=Date.now();generate.textContent='正在理解这个函数…';const timer=setInterval(()=>generate.textContent='正在生成 · '+Math.floor((Date.now()-start)/1000)+' 秒',1000);
   try{
    let graph=studioCache.get(block.start);
    if(!graph){graph=await studioApi('flow',{start:block.start});if(version!==studioVersion)return;studioCache.set(block.start,graph);}
    if(version!==studioVersion)return;
    body.replaceChildren(element('p',graph.summary,'studio-function-purpose'),element('span','AI 语义说明 · 源码位置已校验','studio-provenance'),studioSequence(graph.nodes,[...path,block.start]));loaded=true;
   }catch(e){if(version===studioVersion){generate.disabled=false;body.append(element('p',e.message,'studio-error'));}}
   finally{clearInterval(timer);loading=false;if(!loaded){generate.disabled=false;generate.textContent='重试生成 AI 流程';}}
  };
  if(studioCache.has(block.start))generate.click();
 };
 details.addEventListener('toggle',()=>{if(details.open)load();});
 return details;
}
function studioNodeEnd(node){return Math.max(node.end,...node.branches.flatMap(b=>b.nodes.map(studioNodeEnd)));}
function studioRevealLine(line){
 const host=$('studioCode'),row=host.querySelector('[data-line="'+line+'"]');
 if(!row)return;
 const top=host.scrollTop+row.getBoundingClientRect().top-host.getBoundingClientRect().top;
 host.scrollTo({top:Math.max(0,top-host.clientHeight*.2),left:0,behavior:'smooth'});
}
function studioSequence(nodes,path){
 const host=element('div',undefined,'studio-sequence');
 if(!nodes.length)host.append(element('p','继续后续步骤','studio-note'));
 nodes.forEach((node,i)=>{
  if(i)host.append(element('div','↓','studio-arrow'));
  const card=element('div',undefined,'studio-node-wrap');
  const button=element('button',undefined,'studio-node studio-kind-'+node.kind);button.dataset.start=node.start;button.dataset.end=studioNodeEnd(node);button.dataset.node=node.id;
  button.append(element('small',({condition:'判断',loop:'重复',return:'返回',exception:'异常路径',definition:'定义',unknown:'待核对'})[node.kind]||'步骤'),element('strong',node.title),element('small','第 '+(node.start+sourceOffset)+'—'+(studioNodeEnd(node)+sourceOffset)+' 行'));
  button.onclick=()=>{
   studioSelect(node.start,studioNodeEnd(node),false);studioRequest++;
   const content=$('studioExplain');content.replaceChildren(element('span','AI 流程解释 · 请对照源码核对','studio-provenance'),element('h3',node.title),element('p',node.explanation||'该步骤尚无 AI 说明，可以点击下方按钮继续解释。'));
   if(node.example)content.append(element('h4','用小例子理解'),element('p',node.example));
   studioRevealLine(node.start);
  };card.append(button);
  for(const call of node.calls||[]){
   const target=current.blocks.find(b=>b.start===call.start);
   if(target){const wrapper=element('div',undefined,'studio-call');wrapper.append(element('span','↳ 调用 '+call.name+' · 第 '+(call.line+sourceOffset)+' 行','studio-note'),studioFunction(target,path));card.append(wrapper);}
  }
  for(const branch of node.branches){const details=element('details',undefined,'studio-branch');details.append(element('summary',branch.label),studioSequence(branch.nodes,path));card.append(details);}
  if(node.kind==='loop')card.append(element('p','↶ 正常完成这一轮后再次检查；break 离开循环，return 离开函数。','studio-loop-note'));
  if(node.terminal)card.append(element('small','此路径在这里结束或转移','studio-note'));
  host.append(card);
 });return host;
}
function renderStudioCode(){
 const source=analyzedSource,lines=source.split('\n'),tokens=WhoReading.scan(source,current.language),host=$('studioCode');host.replaceChildren();
 const keywords=new Set('if else elif def class return for in while try except finally raise with as import from async await function const let var new throw catch switch case break continue yield True False None true false null'.split(' '));
 let offset=0,index=0;
 lines.forEach((line,i)=>{
  const row=element('div',undefined,'studio-code-row');row.dataset.line=i+1;row.tabIndex=i===0?0:-1;row.setAttribute('role','button');row.setAttribute('aria-label','选择第 '+(i+1+sourceOffset)+' 行');
  row.append(element('span',String(i+1+sourceOffset),'studio-line-number'));const code=element('code');
  while(tokens[index]&&tokens[index].end<=offset)index++;
  for(let j=index;j<tokens.length&&tokens[j].start<offset+line.length;j++){
   const t=tokens[j],start=Math.max(offset,t.start),end=Math.min(offset+line.length,t.end),text=source.slice(start,end);
   const startColumn=start-offset,endColumn=end-offset;
   const interactive=['name','symbol','number','string'].includes(t.kind);
   const span=element(interactive?'button':'span',text,'studio-token token-'+(keywords.has(t.text)?'keyword':t.kind));
   if(interactive){span.type='button';span.tabIndex=-1;span.setAttribute('aria-label','解释 '+text);span.onclick=e=>{e.stopPropagation();studioSelect(i+1,i+1,false);openStudioToken(span,{line:i+1,startColumn,endColumn,text});};}
   code.append(span);
  }
  if(!line.length)code.append(document.createTextNode(' '));row.append(code);
  row.onclick=e=>{if(!e.shiftKey)studioAnchor=i+1;studioSelect(Math.min(studioAnchor,i+1),Math.max(studioAnchor,i+1),true);};
  row.onkeydown=e=>{
   if(e.target!==row)return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();studioSelect(i+1,i+1,true);return;}
   if(e.key==='ArrowRight'){e.preventDefault();row.querySelector('button')?.focus();return;}
   const next=e.key==='ArrowDown'?Math.min(lines.length,i+2):e.key==='ArrowUp'?Math.max(1,i):null;
   if(next){e.preventDefault();if(!e.shiftKey)studioAnchor=next;studioSelect(Math.min(studioAnchor,next),Math.max(studioAnchor,next),false);host.querySelector('[data-line="'+next+'"]').focus();}
  };
  host.append(row);offset+=line.length+1;
 });
 host.onkeydown=e=>{if(e.target.tagName==='BUTTON'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const buttons=[...e.target.closest('.studio-code-row').querySelectorAll('button')],i=buttons.indexOf(e.target);buttons[i+(e.key==='ArrowLeft'?-1:1)]?.focus();}};
}
function studioSelect(start,end,ask){
 studioRequest++;studioSelected={start,end};
 for(const row of $('studioCode').children){const selected=+row.dataset.line>=start&&+row.dataset.line<=end;row.classList.toggle('selected',selected);row.tabIndex=+row.dataset.line===start?0:-1;row.setAttribute('aria-pressed',String(selected));}
 for(const node of $('studioFlow').querySelectorAll('.studio-node'))node.classList.toggle('selected',+node.dataset.start<=start&&+node.dataset.end>=end);
 $('studioRange').textContent='第 '+(start+sourceOffset)+(end===start?'':'—'+(end+sourceOffset))+' 行';
 $('studioExplain').replaceChildren(element('p',connected()?'点击“解释选中代码”获取 AI 说明。':'连接 AI 后，可以解释选中的代码。','studio-empty'));
 if(ask&&connected())studioExplainSelection();
}
async function studioExplainSelection(){
 if(!studioSelected)return toast('先选择一行代码或一个流程步骤。');
 if(!connected()){settings();return;}
 const selection={...studioSelected};studioIdentity();studioSelected=selection;const version=studioVersion,id=++studioRequest,key='line:'+selection.start+':'+selection.end;
 $('studioExplain').replaceChildren(element('p','AI 正在解释选中的原文…','studio-empty'));
 try{let answer=studioAnswers.get(key);if(!answer){answer=(await studioApi('ask',{selection,question:beginnerMode()?'请只用一两句解释 selectedSource 在做什么。像朋友指着这一行回答；没有必要就不要举例，不补充下一步或术语背景。':'请只解释 selectedSource：先说这一步做什么，再用很小的假设输入说明数据变化，最后说明下一步。术语就地用日常中文解释，不猜作者动机。'})).answer;if(version!==studioVersion)return;studioAnswers.set(key,answer);}
  if(version===studioVersion&&id===studioRequest)$('studioExplain').replaceChildren(element('span','AI 解释 · 请对照源码核对','studio-provenance'),element('p',answer));
 }catch(e){if(version===studioVersion&&id===studioRequest)$('studioExplain').replaceChildren(element('p',e.message,'studio-error'));}
}
function closeStudioToken(){studioTokenRequest++;const p=$('studioTokenPopup');if(p)p.hidden=true;}
async function openStudioToken(anchor,token){
 studioIdentity();studioTokenAnchor=anchor;const id=++studioTokenRequest,version=studioVersion,popup=$('studioTokenPopup');
 $('studioTokenLesson').replaceChildren();
 $('studioTokenTitle').textContent=token.text;$('studioTokenText').textContent=connected()?'AI 正在结合这一行解释…':'请先连接 AI，然后再次点击这个词语。';popup.hidden=false;
 const box=anchor.getBoundingClientRect(),width=Math.min(360,innerWidth-24);popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';popup.style.top=Math.max(12,Math.min(box.bottom+8,innerHeight-310))+'px';$('studioTokenClose').focus({preventScroll:true});
 if(!connected())return;
 const key='token:'+token.line+':'+token.startColumn+':'+token.endColumn;
 try{let response=studioAnswers.get(key);if(!response){response=await studioApi('ask',{selection:{start:token.line,end:token.line},token,knowledge:true,question:'解释选中词语；简单定义不需要知识卡。'});if(version!==studioVersion)return;studioAnswers.set(key,response);}
  if(id===studioTokenRequest&&version===studioVersion){
   $('studioTokenText').textContent=response.answer;
   if(response.knowledge){const source={file:fileName||'代码片段',language:current.language,start:token.line+sourceOffset,end:token.line+sourceOffset,startColumn:token.startColumn,endColumn:token.endColumn,code:analyzedSource.split('\n')[token.line-1],context:response.answer};$('studioTokenLesson').append(knowledgeCard({card:response.knowledge},source,true));}
  }
 }catch(e){if(id===studioTokenRequest&&version===studioVersion)$('studioTokenText').textContent=e.message;}
}
$('studioTokenClose').onclick=()=>{closeStudioToken();studioTokenAnchor?.focus({preventScroll:true});};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('studioTokenPopup').hidden){closeStudioToken();studioTokenAnchor?.focus({preventScroll:true});}});
document.addEventListener('pointerdown',e=>{if(!$('studioTokenPopup').contains(e.target)&&!e.target.closest('.studio-token'))closeStudioToken();});
window.addEventListener('resize',closeStudioToken);$('studioCode').addEventListener('scroll',closeStudioToken);
$('studioExplainBtn').onclick=studioExplainSelection;
$('studioStop').onclick=()=>{for(const c of studioControllers)c.abort();};
$('studioEdit').onclick=()=>document.body.classList.toggle('source-open');
$('studioTab').onclick=()=>setMode('studio');
$('studioCopy').onclick=async()=>{if(!studioSelected)return;try{await navigator.clipboard.writeText(analyzedSource.split('\n').slice(studioSelected.start-1,studioSelected.end).join('\n'));toast('已复制选中原文。');}catch{toast('复制未完成，请从编辑区复制。');}};
