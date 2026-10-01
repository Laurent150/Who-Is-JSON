var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
// AI reading workspace. Parser ranges anchor every node and clickable token.
let studioSource=null,studioConfig=null,studioVersion=0,studioRequest=0,studioTokenRequest=0;
let studioCache=new Map(),studioAnswers=new Map(),studioControllers=new Set(),studioSelected=null,studioAnchor=1,studioTokenAnchor=null;
let studioPendingFlows=new Map(),studioSelectionKind='line',studioActiveToken=null;
function studioReset(){
 studioVersion++;studioRequest++;studioTokenRequest++;
 for(const c of studioControllers)c.abort();studioControllers.clear();
 studioCache.clear();studioAnswers.clear();studioPendingFlows.clear();studioSelected=null;studioSelectionKind='line';studioActiveToken=null;closeStudioToken();
}
function studioIdentity(){
 if(studioSource!==analyzedSource||studioConfig!==config){studioReset();studioSource=analyzedSource;studioConfig=config;return true;}return false;
}
async function studioApi(route,data){
 const c=new AbortController();studioControllers.add(c);
 const signal=AbortSignal.any([c.signal,AbortSignal.timeout(250000)]);
 try{const result=await api(route,{code:analyzedSource,name:fileName,config,...(current.languageIdentification?.status==='verified'?{languageHint:current.languageIdentification.language}:{}),...data},'POST',signal);signal.throwIfAborted();return result;}
 catch(error){
  if(c.signal.aborted)throw new Error(uiText("已停止生成，源码未修改，可以重试。"));
  if(signal.aborted||error.name==='TimeoutError')throw new Error(uiText("AI 服务响应超时，源码未修改，请稍后重试。"));
  throw error;
 }
 finally{studioControllers.delete(c);}
}
function renderStudio(){
 const changed=studioIdentity();
 $('studioFile').textContent=(fileName||uiText("代码片段"))+' · '+uiText(current.language);
 $('studioOverview').textContent=current.aiOverview?.summary||uiText("从文件入口或一个函数开始。展开流程，再点击步骤对照源码。");
 if(!changed&&$('studioCode').children.length)return;
 renderStudioCode();
 const host=$('studioFlow');host.replaceChildren();
 const items=WhoStructure.modules(current);
 const entry=items.find(x=>x.block.role==='script-entry');
 $('studioEntry').textContent=entry?uiText("文件入口已定位；函数体在被调用时进入。"):uiText("没有确定的执行入口，请选择想了解的函数。");
 for(const item of [...(entry?[entry]:[]),...items.filter(x=>x!==entry)])host.append(studioFunction(item.block,[]));
 if(!items.length)host.append(element('p',uiText("尚未定位到可展开结构；仍可选中源码请求 AI 解释。"),'studio-note'));
 $('studioExplain').replaceChildren(element('p',uiText("点击左侧流程步骤，或在中间选择一行代码。"),'studio-empty'));
 $('studioRange').textContent=uiText("等你选择");
}
function studioFunction(block,path){
 const details=element('details',undefined,'studio-function');details.dataset.function=block.title;
 const type=block.role==='script-entry'?uiText("文件入口"):({function:uiText("函数"),class:uiText("类"),module:uiText("文件"),loop:uiText("循环"),condition:uiText("条件判断"),error:uiText("异常处理")})[block.kind]||uiText("代码结构");
 const summary=element('summary');summary.dataset.expandLabel=uiText('展开流程');summary.dataset.collapseLabel=uiText('收起流程');summary.append(element('span',type,'studio-function-type'),element('strong',block.role==='script-entry'?uiText("从这里开始"):block.title),element('small',uiText("第 ")+(block.start+sourceOffset)+'—'+(block.end+sourceOffset)+uiText(" 行 · 点击定位源码")));details.append(summary);
 summary.addEventListener('click',()=>{
  studioOpenFunction(block);
 });
 const body=element('div',undefined,'studio-function-body');details.append(body);
 let loaded=false,loading=false,attempted=false;
 const load=async()=>{
  if(loaded||loading||attempted)return;
  body.replaceChildren();
  if(path.includes(block.start)){body.append(element('p',uiText("再次调用 ")+block.title+uiText("。这是递归调用；是否停止取决于函数内的退出条件。"),'studio-note'));loaded=true;return;}
  if(path.length>=6){body.append(element('p',uiText("已展开 6 层。请从功能目录单独打开这个函数，继续阅读。"),'studio-note'));return;}
  const generate=element('button',connected()?uiText("生成这个函数的 AI 流程"):uiText("配置 AI 后生成流程"),'studio-generate');body.append(generate);
  // The same parser scaffold is used by the server. Offline nodes contain positions,
  // not invented input/output or semantic summaries.
  try{const local=WhoFlowModel.scaffold(current,block.start,globalThis.WhoI18n?.locale);body.append(studioSequence(local.nodes,[...path,block.start]));}
  catch(error){body.append(element('p',uiText(error.message),'studio-note'));}
  generate.onclick=async()=>{
   if(loading)return;
   if(!connected()){settings();return;}
   studioIdentity();const version=studioVersion,selectionRequest=studioRequest;loading=true;attempted=true;generate.disabled=true;
   const start=Date.now();generate.textContent=uiText("正在理解这个函数…");const timer=setInterval(()=>generate.textContent=uiText("正在生成 · ")+Math.floor((Date.now()-start)/1000)+uiText(" 秒"),1000);
   try{
    const pending=studioGetFlow(block);
    if(studioSelectionKind==='function'&&studioSelected?.start===block.start&&studioSelected?.end===block.end)studioShowFunction(block,null);
    const graph=await pending;
    if(version!==studioVersion)return;
    body.replaceChildren(element('span',uiText("AI 语义说明 · 源码位置已校验"),'studio-provenance'),studioSequence(graph.nodes,[...path,block.start]));loaded=true;
    if((selectionRequest===studioRequest||$('studioExplain').querySelector('.studio-generate')?.disabled)&&studioSelectionKind==='function'&&studioSelected?.start===block.start&&studioSelected?.end===block.end)studioShowFunction(block,graph);
   }catch(e){if(version===studioVersion){generate.disabled=false;body.append(element('p',uiText(e.message),'studio-error'));if((selectionRequest===studioRequest||$('studioExplain').querySelector('.studio-generate')?.disabled)&&studioSelectionKind==='function'&&studioSelected?.start===block.start&&studioSelected?.end===block.end){studioShowFunction(block,null);$('studioExplain').append(element('p',uiText(e.message),'studio-error'));}}}
   finally{clearInterval(timer);loading=false;if(!loaded){generate.disabled=false;generate.textContent=uiText("重试生成 AI 流程");}}
  };
  if(connected()||studioCache.has(block.start))generate.click();
 };
 details.addEventListener('toggle',()=>{if(details.open)load();});
 return details;
}
function studioGetFlow(block){
 if(studioCache.has(block.start))return Promise.resolve(studioCache.get(block.start));
 if(studioPendingFlows.has(block.start))return studioPendingFlows.get(block.start);
 const version=studioVersion;
 const pending=studioApi('flow',{start:block.start}).then(graph=>{if(version===studioVersion)studioCache.set(block.start,graph);return graph;}).finally(()=>{if(studioPendingFlows.get(block.start)===pending)studioPendingFlows.delete(block.start);});
 studioPendingFlows.set(block.start,pending);return pending;
}
function studioOpenFunction(block){
 studioAnchor=block.start;studioSelect(block.start,block.end,false,'function');studioRevealLine(block.start);
 studioShowFunction(block,studioCache.get(block.start));
}
function studioShowFunction(block,graph){
 const content=$('studioExplain');content.replaceChildren(element('h3',block.title));
 if(!graph){
  content.append(element('p',uiText("输入、输出和步骤总结将在生成 AI 流程后显示。"),'studio-empty'));
  const generate=element('button',connected()?uiText("生成这个函数的 AI 流程"):uiText("配置 AI 后生成流程"),'studio-generate');
  generate.onclick=async()=>{
   if(!connected()){settings();return;}const version=studioVersion,id=studioRequest;generate.disabled=true;generate.textContent=uiText("正在理解这个函数…");
   try{const result=await studioGetFlow(block);if(version!==studioVersion)return;
    // Rebuild only flow navigation, keeping the current source selection intact.
    const items=WhoStructure.modules(current);$('studioFlow').replaceChildren(...items.map(item=>studioFunction(item.block,[])));
    const owner=[...$('studioFlow').children].find(d=>d.dataset.function===block.title);if(owner)owner.open=true;
    if(id===studioRequest)studioShowFunction(block,result);
   }catch(error){if(version===studioVersion&&id===studioRequest){generate.disabled=false;generate.textContent=uiText("重试生成 AI 流程");content.append(element('p',uiText(error.message),'studio-error'));}}
  };if(studioPendingFlows.has(block.start)){generate.disabled=true;generate.textContent=uiText("正在理解这个函数…");}content.append(generate);return;
 }
 content.append(element('span',uiText("AI 解释 · 请对照源码核对"),'studio-provenance'),element('p',graph.summary));
 const io=element('div',undefined,'studio-io');
 for(const [label,value] of [[beginnerMode()?uiText("传入什么"):uiText("输入"),graph.input],[beginnerMode()?uiText("得到什么"):uiText("输出"),graph.output]]){
  const section=element('div');section.append(element('strong',label),element('p',value||uiText("AI 未提供此项说明，请重新生成。")));io.append(section);
 }
 content.append(io);
 if(!graph.input||!graph.output){const retry=element('button',uiText("重试生成 AI 流程"));retry.onclick=()=>{studioCache.delete(block.start);studioShowFunction(block,null);content.querySelector('.studio-generate')?.click();};content.append(retry);}
 const answer=[graph.summary,graph.input&&uiText("输入")+'：'+graph.input,graph.output&&uiText("输出")+'：'+graph.output].filter(Boolean).join('\n\n');
 appendAITerms(content,answer);appendExplanationSave(content,answer,explanationSource({start:block.start,end:block.end}),block.title);
 studioAppendFollowups(content,{start:block.start,end:block.end});
}
function studioAppendFollowups(host,selection){
 const actions=element('div',undefined,'studio-followups');
 for(const [label,question] of [[uiText("再简单一点"),uiText("请用更简单的日常语言解释选中的代码，保留关键条件。")],[uiText("举个例子"),uiText("请用一组具体输入推演选中代码，标明是假设示例，没有实际运行。")]]){
  const button=element('button',label);button.onclick=()=>studioFollowup(question,selection);actions.append(button);
 }
 const form=element('form',undefined,'studio-followup-form'),input=element('input');input.placeholder=uiText("针对选中代码继续提问…");input.setAttribute('aria-label',uiText("针对选中代码继续提问"));input.maxLength=1800;
 const send=element('button',uiText("发送"));send.type='submit';form.append(input,send);form.onsubmit=e=>{e.preventDefault();if(input.value.trim())studioFollowup(input.value.trim(),selection);};host.append(actions,form);
}
async function studioFollowup(question,selection){
 if(!connected()){settings();return;}if(!studioSelected)return;
 const version=studioVersion,id=++studioRequest,content=$('studioExplain');
 content.querySelector('.studio-followup-answer')?.remove();
 const response=element('div',undefined,'studio-followup-answer');response.append(element('p',uiText("AI 正在解释选中的原文…")));content.append(response);
 try{const result=await studioApi('ask',{selection,question});if(version!==studioVersion||id!==studioRequest)return;
  response.replaceChildren(element('p',result.answer));appendAITerms(response,result.answer);appendExplanationSave(response,result.answer,explanationSource(selection));
 }catch(error){if(version===studioVersion&&id===studioRequest)response.replaceChildren(element('p',uiText(error.message),'studio-error'));}
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
 if(!nodes.length)host.append(element('p',uiText("继续后续步骤"),'studio-note'));
 nodes.forEach((node,i)=>{
  if(i)host.append(element('div','↓','studio-arrow'));
  const card=element('div',undefined,'studio-node-wrap');
  const button=element('button',undefined,'studio-node studio-kind-'+node.kind);button.dataset.start=node.start;button.dataset.end=studioNodeEnd(node);button.dataset.node=node.id;
  button.append(element('small',({condition:uiText("判断"),loop:uiText("重复"),return:uiText("返回"),exception:uiText("异常路径"),definition:uiText("定义"),unknown:uiText("待核对")})[node.kind]||uiText("步骤")),element('strong',node.title||uiText("源码步骤")),element('small',uiText("第 ")+(node.start+sourceOffset)+'—'+(studioNodeEnd(node)+sourceOffset)+uiText(" 行")));
  button.onclick=()=>{
   studioSelect(node.start,studioNodeEnd(node),false,'step',node.id);studioRequest++;
   if(!node.explanation){studioRevealLine(node.start);return;}
   const content=$('studioExplain');content.replaceChildren(element('span',uiText("AI 流程解释 · 请对照源码核对"),'studio-provenance'),element('h3',node.title),element('p',node.explanation||uiText("该步骤尚无 AI 说明，可以点击下方按钮继续解释。")));
   appendAITerms(content,node.explanation||'');if(node.explanation){appendExplanationSave(content,[node.explanation,node.example].filter(Boolean).join('\n\n'),explanationSource({start:node.start,end:studioNodeEnd(node)}),node.title);appendBuiltinReference(content,{start:node.start,end:node.end});}
   if(node.example)content.append(element('h4',uiText("用小例子理解")),element('p',node.example));
   studioAppendFollowups(content,{start:node.start,end:studioNodeEnd(node)});
   studioRevealLine(node.start);
  };card.append(button);
  for(const call of node.calls||[]){
   const target=current.blocks.find(b=>b.start===call.start);
   if(target){const wrapper=element('div',undefined,'studio-call');wrapper.append(element('span',uiText("↳ 调用 ")+call.name+uiText(" · 第 ")+(call.line+sourceOffset)+uiText(" 行"),'studio-note'),studioFunction(target,path));card.append(wrapper);}
  }
  for(const branch of node.branches){const details=element('details',undefined,'studio-branch');details.append(element('summary',branch.label),studioSequence(branch.nodes,path));card.append(details);}
  if(node.kind==='loop')card.append(element('p',uiText("↶ 正常完成这一轮后再次检查；break 离开循环，return 离开函数。"),'studio-loop-note'));
  if(node.terminal)card.append(element('small',uiText("此路径在这里结束或转移"),'studio-note'));
  host.append(card);
 });return host;
}
function renderStudioCode(){
 const source=analyzedSource,lines=source.split('\n'),tokens=WhoReading.scan(source,current.language),host=$('studioCode');host.replaceChildren();
 const keywords=new Set('if else elif def class return for in while try except finally raise with as import from async await function const let var new throw catch switch case break continue yield True False None true false null'.split(' '));
 let offset=0,index=0;
 lines.forEach((line,i)=>{
  const row=element('div',undefined,'studio-code-row');row.dataset.line=i+1;row.tabIndex=i===0?0:-1;row.setAttribute('role','button');row.setAttribute('aria-label',uiText("选择第 ")+(i+1+sourceOffset)+uiText(" 行"));
  row.append(element('span',String(i+1+sourceOffset),'studio-line-number'));const code=element('code');
  while(tokens[index]&&tokens[index].end<=offset)index++;
  for(let j=index;j<tokens.length&&tokens[j].start<offset+line.length;j++){
   const t=tokens[j],start=Math.max(offset,t.start),end=Math.min(offset+line.length,t.end),text=source.slice(start,end);
   const startColumn=start-offset,endColumn=end-offset;
   const interactive=['name','symbol','number','string'].includes(t.kind);
   const span=element(interactive?'button':'span',text,'studio-token token-'+(keywords.has(t.text)?'keyword':t.kind));
   if(interactive){span.type='button';span.tabIndex=-1;span.setAttribute('aria-label',uiText("解释 ")+text);span.onclick=e=>{e.stopPropagation();if(e.shiftKey){studioSelect(Math.min(studioAnchor,i+1),Math.max(studioAnchor,i+1),true);return;}studioAnchor=i+1;studioSelect(i+1,i+1,false,'token');openStudioToken(span,{line:i+1,startColumn,endColumn,text});};}
   code.append(span);
  }
  if(!line.length)code.append(document.createTextNode(' '));row.append(code);
  row.onclick=e=>{if(!e.shiftKey)studioAnchor=i+1;studioSelect(Math.min(studioAnchor,i+1),Math.max(studioAnchor,i+1),true);};
  row.onkeydown=e=>{
   if(e.target!==row)return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();studioAnchor=i+1;studioSelect(i+1,i+1,true);return;}
   if(e.key==='ArrowRight'){e.preventDefault();row.querySelector('button')?.focus();return;}
   const next=e.key==='ArrowDown'?Math.min(lines.length,i+2):e.key==='ArrowUp'?Math.max(1,i):null;
   if(next){e.preventDefault();if(!e.shiftKey)studioAnchor=next;studioSelect(Math.min(studioAnchor,next),Math.max(studioAnchor,next),false);host.querySelector('[data-line="'+next+'"]').focus();}
  };
  host.append(row);offset+=line.length+1;
 });
 host.onkeydown=e=>{if(e.target.tagName==='BUTTON'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const buttons=[...e.target.closest('.studio-code-row').querySelectorAll('button')],i=buttons.indexOf(e.target);buttons[i+(e.key==='ArrowLeft'?-1:1)]?.focus();}};
}
function studioSelect(start,end,ask,kind='line',nodeId=null){
 closeStudioToken();studioRequest++;studioSelectionKind=kind==='line'&&start!==end?'range':kind;studioSelected={start,end};
 for(const row of $('studioCode').children){const selected=+row.dataset.line>=start&&+row.dataset.line<=end;row.classList.toggle('selected',selected);row.tabIndex=+row.dataset.line===start?0:-1;row.setAttribute('aria-pressed',String(selected));}
 for(const node of $('studioFlow').querySelectorAll('.studio-node'))node.classList.toggle('selected',kind==='step'&&node.dataset.node===nodeId&&+node.dataset.start===start&&+node.dataset.end===end);
 const label={function:uiText("函数"),step:uiText("步骤"),line:uiText("整行"),range:uiText("选中代码段"),token:uiText("词语 / 符号")}[studioSelectionKind];
 $('studioRange').textContent=label+' · '+uiText("第 ")+(start+sourceOffset)+(end===start?'':'—'+(end+sourceOffset))+uiText(" 行");
 $('studioExplain').replaceChildren(element('p',connected()?uiText("点击“解释选中代码”获取 AI 说明。"):uiText("连接 AI 后，可以解释选中的代码。"),'studio-empty'));
 if(ask&&connected())studioExplainSelection();
}
async function studioExplainSelection(){
 if(!studioSelected)return toast(uiText("先选择一行代码或一个流程步骤。"));
 if(!connected()){settings();return;}
 if(studioSelectionKind==='function'){const block=current.blocks.find(b=>b.start===studioSelected.start&&b.end===studioSelected.end);if(block){studioShowFunction(block,studioCache.get(block.start));$('studioExplain').querySelector('.studio-generate')?.click();return;}}
 const selection={...studioSelected};studioIdentity();studioSelected=selection;const version=studioVersion,id=++studioRequest,key='line:'+selection.start+':'+selection.end;
 $('studioExplain').replaceChildren(element('p',uiText("AI 正在解释选中的原文…"),'studio-empty'));
 try{let answer=studioAnswers.get(key);if(!answer){answer=(await studioApi('ask',{selection,question:beginnerMode()?uiText("请只用一两句解释 selectedSource 在做什么。像朋友指着这一行回答；没有必要就不要举例，不补充下一步或术语背景。"):uiText("请只解释 selectedSource：先说这一步做什么，再用很小的假设输入说明数据变化，最后说明下一步。术语就地用日常中文解释，不猜作者动机。")})).answer;if(version!==studioVersion)return;studioAnswers.set(key,answer);}
  if(version===studioVersion&&id===studioRequest){$('studioExplain').replaceChildren(element('span',uiText("AI 解释 · 请对照源码核对"),'studio-provenance'),element('p',answer));appendAITerms($('studioExplain'),answer);appendExplanationSave($('studioExplain'),answer,explanationSource(selection));appendBuiltinReference($('studioExplain'),selection);studioAppendFollowups($('studioExplain'),selection);}
 }catch(e){if(version===studioVersion&&id===studioRequest)$('studioExplain').replaceChildren(element('p',uiText(e.message),'studio-error'));}
}
function closeStudioToken(){studioTokenRequest++;studioActiveToken?.classList.remove('selected-token');studioActiveToken=null;const p=$('studioTokenPopup');if(p)p.hidden=true;}
async function openStudioToken(anchor,token){
 studioIdentity();studioTokenAnchor=anchor;studioActiveToken=anchor;anchor.classList.add('selected-token');const id=++studioTokenRequest,version=studioVersion,popup=$('studioTokenPopup');
 $('studioTokenLesson').replaceChildren();
 $('studioTokenTitle').textContent=token.text;$('studioTokenText').textContent=connected()?uiText("AI 正在结合这一行解释…"):uiText("请先连接 AI，然后再次点击这个词语。");popup.hidden=false;
 const box=anchor.getBoundingClientRect(),width=Math.min(360,innerWidth-24);popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';popup.style.top=Math.max(12,Math.min(box.bottom+8,innerHeight-310))+'px';$('studioTokenClose').focus({preventScroll:true});
 if(!connected())return;
 const key='token:'+token.line+':'+token.startColumn+':'+token.endColumn;
 try{let response=studioAnswers.get(key);if(!response){response=await studioApi('ask',{selection:{start:token.line,end:token.line},token,knowledge:true,question:uiText("解释选中词语；简单定义不需要知识卡。")});if(version!==studioVersion)return;studioAnswers.set(key,response);}
  if(id===studioTokenRequest&&version===studioVersion){
   $('studioTokenText').textContent=response.answer;appendAITerms($('studioTokenText'),response.answer);
   appendExplanationSave($('studioTokenLesson'),response.answer,explanationSource({start:token.line,end:token.line},{startColumn:token.startColumn,endColumn:token.endColumn}),token.text);appendBuiltinReference($('studioTokenLesson'),{start:token.line,end:token.line},token);
  }
 }catch(e){if(id===studioTokenRequest&&version===studioVersion)$('studioTokenText').textContent=uiText(e.message);}
}
$('studioTokenClose').onclick=()=>{closeStudioToken();studioTokenAnchor?.focus({preventScroll:true});};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('studioTokenPopup').hidden){closeStudioToken();studioTokenAnchor?.focus({preventScroll:true});}});
document.addEventListener('pointerdown',e=>{if(!$('studioTokenPopup').contains(e.target)&&!e.target.closest('.studio-token'))closeStudioToken();});
window.addEventListener('resize',closeStudioToken);$('studioCode').addEventListener('scroll',closeStudioToken);
$('studioExplainBtn').onclick=studioExplainSelection;
$('studioStop').onclick=()=>{for(const c of studioControllers)c.abort();};
$('studioEdit').onclick=()=>document.body.classList.toggle('source-open');
$('studioTab').onclick=()=>setMode('studio');
$('studioCopy').onclick=async()=>{if(!studioSelected)return;try{await navigator.clipboard.writeText(analyzedSource.split('\n').slice(studioSelected.start-1,studioSelected.end).join('\n'));toast(uiText("已复制选中原文。"));}catch{toast(uiText("复制未完成，请从编辑区复制。"));}};
