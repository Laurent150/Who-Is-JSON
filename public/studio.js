var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
var uiError = globalThis.WhoI18n?.error || (error=>uiText(error?.message || String(error || '请求未完成。')));
// AI reading workspace. Parser ranges anchor every node and clickable token.
let studioSource=null,studioConfig=null,studioVersion=0,studioRequest=0,studioTokenRequest=0;
let studioCache=new Map(),studioAnswers=new Map(),studioControllers=new Set(),studioSelected=null,studioAnchor=1,studioTokenAnchor=null;
let studioPendingFlows=new Map(),studioSelectionKind='line',studioActiveToken=null;
let studioMapFrames=[],studioFocusedNodeId=null,studioReadingTask=null;
let studioModuleCache=new Map(),studioPendingModules=new Map(),studioIdentitySnapshot=null;
let studioFollowupPending=null;
let studioPendingAnswers=new Map(),studioPopupPosition=null,studioPopupDrag=null;
function studioReset(){
 studioVersion++;studioRequest++;studioTokenRequest++;
 for(const c of studioControllers)c.abort();studioControllers.clear();
 studioMapFrames=[];studioFocusedNodeId=null;studioReadingTask=null;studioFollowupPending=null;studioCache.clear();studioAnswers.clear();studioPendingAnswers.clear();studioPendingFlows.clear();studioModuleCache.clear();studioPendingModules.clear();studioSelected=null;studioSelectionKind='line';closeStudioToken();
}
// Availability/quota refreshes do not change the identity of an explanation.
// Explicit settings, account, source, language and reading-mode changes do.
function studioIdentityKey(){return JSON.stringify({source:analyzedSource,name:fileName,config,session:window.WhoAccountSession?.()||'',mode:readingMode,locale:globalThis.WhoI18n?.locale||'en'});}
function studioIdentity(){
 const identity=studioIdentityKey();if(studioIdentitySnapshot!==identity){studioReset();studioSource=analyzedSource;studioConfig=config;studioIdentitySnapshot=identity;return true;}return false;
}
async function studioApi(route,data){
 const c=new AbortController();studioControllers.add(c);
 const signal=AbortSignal.any([c.signal,AbortSignal.timeout(510000)]);
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
 $('studioOverview').textContent=current.aiOverview?.summary||uiText("选择一个模块读正文，展开流程，再点击步骤对照源码。");
 if(!changed&&$('studioCode').children.length)return;
 renderStudioCode();
 studioMapFrames=[{type:'directory'}];studioMapRender();
 $('studioExplain').replaceChildren(element('p',uiText("点击左侧流程步骤，或在中间选择一行代码。"),'studio-empty'));
 $('studioRange').textContent=uiText("等你选择");
}
function studioBlockTitle(block){
 // Localize generated labels by structural role, never source-defined names.
 if(block.role==='script-entry')return studioModuleCache.get(studioBlockKey(block))?.title||uiText('这段代码');
 if(current?.language==='Python'&&block.kind==='module'&&block.title==='文件中的说明')return uiText('文件中的说明');
 if(current?.language==='Gitignore'&&block.kind==='config'&&block.title==='忽略与例外规则')return uiText('忽略与例外规则');
 return block.title;
}
function studioModuleType(block){return block.role==='script-entry'?uiText('执行步骤'):({function:uiText('函数'),class:uiText('类'),type:uiText('类型约定'),import:uiText('引入'),module:uiText('文件'),loop:uiText('循环'),condition:uiText('条件判断'),error:uiText('异常处理')})[block.kind]||uiText('代码结构');}
function studioFunction(block){
 const card=element('div',undefined,'studio-module-card'),select=element('button',undefined,'studio-module-select');
 const title=element('strong',studioBlockTitle(block),block.kind==='function'?'studio-title-code':'studio-title-natural');title.classList.add('studio-module-title');title.dataset.blockKey=studioBlockKey(block);
 const range=(block.start+sourceOffset)+'—'+(block.end+sourceOffset);select.dataset.blockKey=studioBlockKey(block);select.dataset.range=range;select.setAttribute('aria-label',uiText('解释模块：{0}，第{1}行',studioBlockTitle(block),range));select.append(element('span',studioModuleType(block),'studio-function-type'),title);
 select.onclick=()=>studioOpenFunction(block);const actions=element('div',undefined,'studio-module-actions'),expand=element('button',uiText('展开流程'),'studio-map-expand');expand.dataset.blockKey=studioBlockKey(block);expand.onclick=()=>studioMapOpen(block,null,true,expand);actions.append(element('small',uiText('第 ')+range+uiText(' 行')),expand);card.append(select,actions);return card;
}
function studioMapColumn(){return $('studioMapColumn')||$('studioFlow');}
// A navigation snapshot can reattach an existing request, never dispatch another one.
function studioTrackReading(promise,apply){
 const task={version:studioVersion,apply,settled:false};studioReadingTask=task;
 task.done=Promise.resolve(promise).then(value=>{task.settled=true;task.value=value;},error=>{task.settled=true;task.error=error;});return task;
}
function studioRestoreReading(task){
 studioReadingTask=task;if(!task)return;
 const apply=()=>{if(studioReadingTask!==task||task.version!==studioVersion)return;if(task.error)$('studioExplain').replaceChildren(element('p',uiError(task.error),'studio-error'));else task.apply(task.value);};
 if(task.settled)apply();else task.done.then(apply);
}
function studioMapCapture(){
 const frame=studioMapFrames.at(-1);if(!frame)return;
 frame.readingTask=studioReadingTask;frame.leftNodes=[...$('studioFlow').children];frame.leftScroll=studioMapColumn().scrollTop||0;frame.codeScroll=$('studioCode').scrollTop||0;frame.codeLeft=$('studioCode').scrollLeft||0;
 frame.selection=studioSelected?{...studioSelected}:null;frame.kind=studioSelectionKind;frame.anchor=studioAnchor;frame.rightNodes=[...$('studioExplain').children];frame.range=$('studioRange').textContent;frame.nodeId=studioFocusedNodeId;frame.readBlock=frame.kind==='function'?current.blocks.find(b=>frame.selection?.blockKey===studioBlockKey(b)):null;frame.pending=frame.readBlock&&studioPendingModules.has(studioBlockKey(frame.readBlock));
}
function studioMapBack(index=studioMapFrames.length-2){
 if(index<0)return;studioRequest++;studioMapFrames.length=index+1;const frame=studioMapFrames.at(-1);
 $('studioFlow').replaceChildren(...frame.leftNodes);studioMapColumn().scrollTop=frame.leftScroll;
 if(frame.selection){studioSelect(frame.selection.start,frame.selection.end,false,frame.kind,frame.nodeId);studioSelected={...frame.selection};}else studioSelected=null;
 studioAnchor=frame.anchor;$('studioExplain').replaceChildren(...frame.rightNodes);$('studioRange').textContent=frame.range;$('studioCode').scrollTop=frame.codeScroll;$('studioCode').scrollLeft=frame.codeLeft;
 if(frame.block&&frame.renderNodes&&studioModuleCache.has(studioBlockKey(frame.block)))frame.renderNodes(studioModuleCache.get(studioBlockKey(frame.block)).nodes);studioRestoreReading(frame.readingTask);frame.updateReadStatus?.();
 const saved=frame.focusReturn,host=$('studioFlow');let focus=host.contains(saved)?saved:null;
 if(!focus&&saved?.dataset?.callNode)focus=[...host.querySelectorAll('.studio-call-nav')].find(n=>n.dataset.callNode===saved.dataset.callNode&&n.dataset.callIndex===saved.dataset.callIndex);
 if(!focus&&saved?.dataset?.blockKey)focus=[...host.querySelectorAll('.studio-map-expand')].find(n=>n.dataset.blockKey===saved.dataset.blockKey);
 (focus||host.querySelector('.studio-map-back'))?.focus({preventScroll:true});studioMapColumn().scrollTop=frame.leftScroll;
}
function studioMapOpen(block,via,read=true,trigger=null){
 studioIdentity();if(!studioMapFrames.length)studioMapFrames=[{type:'directory'}];
 const existing=studioMapFrames.findIndex(f=>f.block&&studioBlockKey(f.block)===studioBlockKey(block));
 if(existing>=0){if(existing<studioMapFrames.length-1)studioMapBack(existing);const frame=studioMapFrames.at(-1);if(frame.notice)frame.notice.textContent=uiText('此调用回到已在阅读路径中的模块。');return;}
 studioMapCapture();studioMapFrames.at(-1).focusReturn=trigger||document.activeElement;studioMapFrames.push({type:'module',block,via});studioOpenFunction(block,{read});studioMapRender();studioMapColumn().scrollTop=0;$('studioFlow').querySelector('.studio-map-back')?.focus({preventScroll:true});
}
function studioMapRender(){
 const host=$('studioFlow'),frame=studioMapFrames.at(-1);host.replaceChildren();if(!frame)return;
 $('studioEntry').textContent=uiText('点模块读正文；展开流程查看当前步骤。');$('studioEntry').hidden=frame.type!=='directory';
 if(frame.type==='directory'){
  const all=WhoStructure.modules(current).map(x=>x.block),reachable=new Set();
  const visit=block=>{for(const link of current.framework?.links||[]){if(block.role==='script-entry'?(link.fromStart!==0||link.line<block.start||link.line>block.end):link.fromStart!==block.start)continue;const target=all.find(b=>b.kind==='function'&&b.start===link.toStart);if(target&&!reachable.has(studioBlockKey(target))){reachable.add(studioBlockKey(target));visit(target);}}};
  const starts=all.filter(b=>b.role==='script-entry');starts.forEach(visit);if(!starts.length)all.filter(b=>!all.some(parent=>(current.framework?.links||[]).some(l=>l.fromStart===parent.start&&l.toStart===b.start))).forEach(visit);
  let primary=all.filter(b=>!reachable.has(studioBlockKey(b)));if(!primary.length&&all.length)primary=[all[0]];
  primary.forEach(block=>host.append(studioFunction(block)));const others=all.filter(b=>!primary.includes(b));if(others.length){const directory=element('details',undefined,'studio-map-directory');directory.append(element('summary',uiText('其他模块')+' · '+others.length));others.forEach(b=>directory.append(studioFunction(b)));host.append(directory);}
  if(!all.length)host.append(element('p',uiText('尚未定位到可展开结构；仍可选中源码请求 AI 解释。'),'studio-note'));return;
 }
 const toolbar=element('div',undefined,'studio-map-nav'),back=element('button',uiText('返回'),'studio-map-back');back.onclick=()=>studioMapBack();
 const heading=element('strong',studioBlockTitle(frame.block),frame.block.kind==='function'?'studio-title-code':'studio-title-natural');heading.classList.add('studio-module-title');heading.dataset.blockKey=studioBlockKey(frame.block);
 toolbar.append(back,heading);frame.notice=element('small',undefined,'studio-map-notice');toolbar.append(frame.notice);host.append(toolbar);
 const body=element('div',undefined,'studio-map-body');host.append(body);const version=studioVersion,identity=studioIdentityKey();
 const render=nodes=>{const active=document.activeElement,focus=body.contains(active)?{node:active.dataset.node,branch:active.dataset.branch,callNode:active.dataset.callNode,callIndex:active.dataset.callIndex}:null,scroll=studioMapColumn().scrollTop;const opened=new Map([...body.querySelectorAll('.studio-branch')].map(d=>[d.dataset.branch,d.open]));const sequence=studioSequence(nodes,[]);body.replaceChildren(sequence);body.querySelectorAll('.studio-branch').forEach(d=>d.open=!!opened.get(d.dataset.branch));if(studioSelectionKind==='step')body.querySelectorAll('.studio-node').forEach(n=>n.classList.toggle('selected',n.dataset.node===studioFocusedNodeId));if(focus){const target=focus.branch?[...body.querySelectorAll('.studio-branch-summary')].find(n=>n.dataset.branch===focus.branch):focus.callNode?[...body.querySelectorAll('.studio-call-nav')].find(n=>n.dataset.callNode===focus.callNode&&n.dataset.callIndex===focus.callIndex):[...body.querySelectorAll('.studio-node')].find(n=>n.dataset.node===focus.node);target?.focus({preventScroll:true});studioMapColumn().scrollTop=scroll;}};frame.renderNodes=render;
 try{const graph=WhoFlowModel.scaffold(current,frame.block.start,globalThis.WhoI18n?.locale,{end:frame.block.end,role:frame.block.role,blockId:frame.block.blockId});render(studioModuleCache.get(studioBlockKey(frame.block))?.nodes||graph.nodes);}catch(error){body.append(element('p',uiError(error),'studio-error'));}
 const status=element('div',undefined,'studio-map-status');host.insertBefore(status,body);
 frame.updateReadStatus=()=>{
  if(version!==studioVersion||identity!==studioIdentityKey()||studioMapFrames.at(-1)!==frame)return;
  if(studioModuleCache.has(studioBlockKey(frame.block))){status.hidden=true;return;}status.hidden=false;status.replaceChildren();
  if(frame.readError){status.append(element('p',uiError(frame.readError),'studio-error'));}
  else if(studioPendingModules.has(studioBlockKey(frame.block))){status.append(element('p',uiText('正在生成流程标题和模块解释…')));return;}
  else status.append(element('p',uiText('连接 AI 后可生成流程标题和模块解释。')));
  const retry=element('button',connected()?uiText('重试模块阅读'):uiText('配置 AI 后生成流程标题'),'studio-map-retry');retry.onclick=()=>{if(!connected()){settings();return;}studioOpenFunction(frame.block);};status.append(retry);
 };
 frame.trackMapRead=pending=>{
  if(frame.trackedMapPromise===pending){frame.updateReadStatus();return;}frame.trackedMapPromise=pending;frame.readError=null;frame.updateReadStatus();
  pending.then(()=>frame.updateReadStatus(),error=>{if(version===studioVersion&&identity===studioIdentityKey()){frame.readError=error;frame.updateReadStatus();}});
 };
 const pending=studioPendingModules.get(studioBlockKey(frame.block));if(pending)frame.trackMapRead(pending);else frame.updateReadStatus();
}
function studioGetFlow(block){
 if(studioCache.has(studioBlockKey(block)))return Promise.resolve(studioCache.get(studioBlockKey(block)));
 if(studioPendingFlows.has(studioBlockKey(block)))return studioPendingFlows.get(studioBlockKey(block));
 const version=studioVersion;
 const pending=studioApi('flow',{start:block.start,end:block.end,role:block.role,blockId:block.blockId}).then(graph=>{if(version===studioVersion)studioCache.set(studioBlockKey(block),graph);return graph;}).finally(()=>{if(studioPendingFlows.get(studioBlockKey(block))===pending)studioPendingFlows.delete(studioBlockKey(block));});
 studioPendingFlows.set(studioBlockKey(block),pending);return pending;
}
function studioBlockKey(block){return [block.start,block.end,block.role||block.kind,block.blockId||''].join(':');}
function studioUpdateModuleTitles(block){
 if(block.role!=='script-entry')return;const key=studioBlockKey(block),title=studioBlockTitle(block);
 for(const root of [$('studioFlow'),$('studioExplain'),...studioMapFrames.flatMap(frame=>frame.leftNodes||[])]){
  if(root.classList?.contains('studio-module-title')&&root.dataset.blockKey===key)root.textContent=title;
  root.querySelectorAll('.studio-module-title').forEach(node=>{if(node.dataset.blockKey===key)node.textContent=title;});
  root.querySelectorAll('.studio-module-select').forEach(node=>{if(node.dataset.blockKey===key)node.setAttribute('aria-label',uiText('解释模块：{0}，第{1}行',title,node.dataset.range));});
 }
}
function studioGetModule(block){
 studioIdentity();
 if(studioModuleCache.has(studioBlockKey(block)))return Promise.resolve(studioModuleCache.get(studioBlockKey(block)));
 if(studioPendingModules.has(studioBlockKey(block)))return studioPendingModules.get(studioBlockKey(block));
 const version=studioVersion,identity=studioIdentityKey();
 const pending=studioApi('module-reading',{start:block.start,end:block.end,role:block.role,blockId:block.blockId}).then(result=>{if(version===studioVersion&&identity===studioIdentityKey()){studioModuleCache.set(studioBlockKey(block),result);studioUpdateModuleTitles(block);const frame=studioMapFrames.at(-1);if(frame?.block&&studioBlockKey(frame.block)===studioBlockKey(block)&&frame.renderNodes)frame.renderNodes(result.nodes);}return result;}).finally(()=>{if(studioPendingModules.get(studioBlockKey(block))===pending)studioPendingModules.delete(studioBlockKey(block));});
 studioPendingModules.set(studioBlockKey(block),pending);const frame=studioMapFrames.at(-1);if(frame?.block&&studioBlockKey(frame.block)===studioBlockKey(block))frame.trackMapRead?.(pending);return pending;
}
function studioOpenFunction(block,options={}){
 studioIdentity();studioAnchor=block.start;studioSelect(block.start,block.end,false,'function');studioSelected.blockKey=studioBlockKey(block);const rangeLabel=studioModuleType(block);$('studioRange').textContent=rangeLabel+' · '+uiText('第 ')+(block.start+sourceOffset)+(block.end===block.start?'':'—'+(block.end+sourceOffset))+uiText(' 行');studioRevealLine(block.start);
 studioShowFunction(block,studioModuleCache.get(studioBlockKey(block)));
 // Free expansion may reattach this module's existing read, but cannot start one.
 const pending=studioPendingModules.get(studioBlockKey(block));if(options.read===false&&pending)studioRestoreReading(studioTrackReading(pending,result=>studioShowFunction(block,result)));
 if(options.read!==false&&connected()&&!studioModuleCache.has(studioBlockKey(block)))$('studioExplain').querySelector('.studio-module-generate')?.click();
}
function studioShowFunction(block,module){
 const title=studioBlockTitle(block),content=$('studioExplain'),heading=element('h3',title,'studio-module-title');heading.dataset.blockKey=studioBlockKey(block);content.replaceChildren(heading);
 if(!module){
  content.append(element('p',uiText("模块正文及输入、输出将在生成后显示。"),'studio-empty'));
  const generate=element('button',connected()?uiText("解释这个模块"):uiText("配置 AI 后解释模块"),'studio-module-generate studio-generate');
  generate.onclick=async()=>{
   if(generate.disabled)return;if(!connected()){settings();return;}
   studioIdentity();const version=studioVersion,id=studioRequest,identity=studioIdentityKey();generate.disabled=true;generate.textContent=uiText("正在理解这个模块…");
   try{const pending=studioGetModule(block);studioTrackReading(pending,result=>studioShowFunction(block,result));const result=await pending;if(version!==studioVersion||id!==studioRequest||identity!==studioIdentityKey())return;studioShowFunction(block,result);}
   catch(error){if(version===studioVersion&&id===studioRequest&&identity===studioIdentityKey()){generate.disabled=false;generate.textContent=uiText("重试模块解释");content.append(element('p',uiError(error),'studio-error'));}}
  };content.append(generate);return;
 }
 const citationContext={source:analyzedSource.split('\n').slice(block.start-1,block.end).join('\n')};
 content.append(element('span',uiText("AI 解释 · 请对照源码核对"),'studio-provenance'),globalThis.WhoPointDisplay?.paragraph(module.summary,current?.language,citationContext)??element('p',module.summary));
 const io=element('div',undefined,'studio-io');
 for(const [label,value] of [[beginnerMode()?uiText("传入什么"):uiText("输入"),module.input],[beginnerMode()?uiText("得到什么"):uiText("输出"),module.output]]){
  const section=element('div');section.append(element('strong',label),globalThis.WhoPointDisplay?.paragraph(value,current?.language,citationContext)??element('p',value));io.append(section);
 }
 content.append(io);
 const answer=[module.summary,uiText("输入")+'：'+module.input,uiText("输出")+'：'+module.output].join('\n\n');
 appendExplanationSave(content,answer,explanationSource({start:block.start,end:block.end}),title);
 studioAppendFollowups(content,{start:block.start,end:block.end});
}
function studioAppendFollowups(host,selection){
 const actions=element('div',undefined,'studio-followups');
 const example=element('button',uiText("举个例子"));example.onclick=()=>studioFollowup('',selection,'example');actions.append(example);
 const form=element('form',undefined,'studio-followup-form'),input=element('input');input.placeholder=uiText("针对当前代码提问…");input.setAttribute('aria-label',uiText("针对当前代码提问"));input.maxLength=500;
 const send=element('button',uiText("发送"));send.type='submit';form.append(input,send);form.onsubmit=e=>{e.preventDefault();if(input.value.trim())studioFollowup(input.value.trim(),selection);};host.append(actions,form);
}
async function studioFollowup(question,selection,kind='question'){
 if(!connected()){settings();return;}if(!studioSelected)return;
 if(studioFollowupPending?.version===studioVersion)return;
 const version=studioVersion,id=++studioRequest,content=$('studioExplain');
 const task={version,id};studioFollowupPending=task;
 const buttons=[...content.querySelectorAll('.studio-followups button'),...content.querySelectorAll('.studio-followup-form button')];buttons.forEach(button=>button.disabled=true);
 content.querySelector('.studio-followup-answer')?.remove();
 const response=element('div',undefined,'studio-followup-answer');response.append(element('p',uiText("正在回答与当前代码相关的问题…")));content.append(response);
 const apply=result=>{response.replaceChildren(globalThis.WhoPointDisplay?.paragraph(result.answer,current?.language)??element('p',result.answer));appendAITerms(response,result.answer);appendExplanationSave(response,result.answer,explanationSource(selection));};
 try{const pending=studioApi('ask',{selection:{...selection},question,followupKind:kind==='example'?'example':'question'});studioTrackReading(pending,apply);const result=await pending;if(version!==studioVersion||id!==studioRequest)return;
  apply(result);
 }catch(error){if(version===studioVersion&&id===studioRequest)response.replaceChildren(element('p',uiError(error),'studio-error'));}
 finally{if(studioFollowupPending===task)studioFollowupPending=null;buttons.forEach(button=>button.disabled=false);}
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
  button.append(element('small',({condition:uiText("判断"),loop:uiText("重复"),return:uiText("返回语句"),exception:uiText("异常路径"),definition:uiText("定义"),unknown:uiText("待核对")})[node.kind]||uiText("步骤")),element('strong',node.title||uiText("源码步骤")),element('small',uiText("第 ")+(node.start+sourceOffset)+'—'+(studioNodeEnd(node)+sourceOffset)+uiText(" 行")));
  button.onclick=()=>{
   studioSelect(node.start,studioNodeEnd(node),false,'step',node.id);studioRequest++;
   if(!node.explanation){studioRevealLine(node.start);if(node.origin==='ai-module-title'&&connected())studioExplainSelection();return;}
   const content=$('studioExplain');content.replaceChildren(element('span',uiText("AI 流程解释 · 请对照源码核对"),'studio-provenance'),element('h3',node.title),element('p',node.explanation||uiText("该步骤尚无 AI 说明，可以点击下方按钮继续解释。")));
   appendAITerms(content,node.explanation||'');if(node.explanation){appendExplanationSave(content,[node.explanation,node.example].filter(Boolean).join('\n\n'),explanationSource({start:node.start,end:studioNodeEnd(node)}),node.title);appendBuiltinReference(content,{start:node.start,end:node.end});}
   if(node.example)content.append(element('h4',uiText("用小例子理解")),element('p',node.example));
   studioAppendFollowups(content,{start:node.start,end:studioNodeEnd(node)});
   studioRevealLine(node.start);
  };card.append(button);if(node.kind==='unknown')card.append(element('p',uiText('这部分只定位到源码范围，内部流程尚未展开。'),'studio-note'));
  for(const [callIndex,call] of (node.calls||[]).entries()){
   const target=current.blocks.find(b=>b.start===call.start);
   if(target){const jump=element('button',uiText('查看调用的模块')+' · '+call.name,'studio-call-nav');jump.dataset.callNode=node.id;jump.dataset.callIndex=String(callIndex);jump.onclick=()=>studioMapOpen(target,{line:call.line,fromBlock:studioMapFrames.at(-1)?.block?studioBlockKey(studioMapFrames.at(-1).block):null,nodeId:node.id,callIndex},true,jump);card.append(jump);}
  }
  for(const [branchIndex,branch] of node.branches.entries()){const branchPath=[...path,node.id,branchIndex],key=JSON.stringify(branchPath),details=element('details',undefined,'studio-branch'),summary=element('summary',branch.label,'studio-branch-summary');details.dataset.branch=key;summary.dataset.branch=key;details.append(summary,studioSequence(branch.nodes,branchPath));card.append(details);}
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
   if(interactive){span.type='button';span.tabIndex=-1;span.setAttribute('aria-label',uiText("解释 ")+text);span.onclick=e=>{e.stopPropagation();if(e.shiftKey){studioSelect(Math.min(studioAnchor,i+1),Math.max(studioAnchor,i+1),true,'line',null,row);return;}studioAnchor=i+1;studioSelect(i+1,i+1,false,'token');openStudioToken(span,{line:i+1,startColumn,endColumn,text});};}
   code.append(span);
  }
  if(!line.length)code.append(document.createTextNode(' '));row.append(code);
  row.onclick=e=>{if(!e.shiftKey)studioAnchor=i+1;studioSelect(Math.min(studioAnchor,i+1),Math.max(studioAnchor,i+1),true,'line',null,row);};
  row.onkeydown=e=>{
   if(e.target!==row)return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();studioAnchor=i+1;studioSelect(i+1,i+1,true,'line',null,row);return;}
   if(e.key==='ArrowRight'){e.preventDefault();row.querySelector('button')?.focus();return;}
   const next=e.key==='ArrowDown'?Math.min(lines.length,i+2):e.key==='ArrowUp'?Math.max(1,i):null;
   if(next){e.preventDefault();if(!e.shiftKey)studioAnchor=next;studioSelect(Math.min(studioAnchor,next),Math.max(studioAnchor,next),false);host.querySelector('[data-line="'+next+'"]').focus();}
  };
  host.append(row);offset+=line.length+1;
 });
 host.onkeydown=e=>{if(e.target.tagName==='BUTTON'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const buttons=[...e.target.closest('.studio-code-row').querySelectorAll('button')],i=buttons.indexOf(e.target);buttons[i+(e.key==='ArrowLeft'?-1:1)]?.focus();}};
}
function studioSelect(start,end,ask,kind='line',nodeId=null,popupAnchor=null){
 studioRequest++;studioReadingTask=null;studioSelectionKind=kind==='line'&&start!==end?'range':kind;studioSelected={start,end};studioFocusedNodeId=nodeId;
 for(const row of $('studioCode').children){const selected=+row.dataset.line>=start&&+row.dataset.line<=end;row.classList.toggle('selected',selected);row.tabIndex=+row.dataset.line===start?0:-1;row.setAttribute('aria-pressed',String(selected));}
 for(const node of $('studioFlow').querySelectorAll('.studio-node'))node.classList.toggle('selected',kind==='step'&&node.dataset.node===nodeId&&+node.dataset.start===start&&+node.dataset.end===end);
 const label={function:uiText("函数"),step:uiText("步骤"),line:uiText("整行"),range:uiText("选中代码段"),token:uiText("词语 / 符号")}[studioSelectionKind];
 $('studioRange').textContent=label+' · '+uiText("第 ")+(start+sourceOffset)+(end===start?'':'—'+(end+sourceOffset))+uiText(" 行");
 $('studioExplain').replaceChildren(element('p',connected()?uiText("点击“解释选中代码”获取 AI 说明。"):uiText("连接 AI 后，可以解释选中的代码。"),'studio-empty'));
 if(ask&&(connected()||studioAnswers.has('line:'+start+':'+end)||studioPendingAnswers.has('line:'+start+':'+end)))studioExplainSelection(popupAnchor);
}
function studioGetAnswer(key,data){
 if(studioAnswers.has(key))return Promise.resolve(studioAnswers.get(key));
 if(studioPendingAnswers.has(key))return studioPendingAnswers.get(key);
 const version=studioVersion;
 const pending=studioApi('ask',data).then(response=>{if(version===studioVersion)studioAnswers.set(key,response);return response;}).finally(()=>{if(studioPendingAnswers.get(key)===pending)studioPendingAnswers.delete(key);});
 studioPendingAnswers.set(key,pending);return pending;
}
async function studioExplainSelection(anchor=null){
 if(!studioSelected)return toast(uiText("先选择一行代码或一个流程步骤。"));
 if(studioSelectionKind==='function'){const block=current.blocks.find(b=>b.start===studioSelected.start&&b.end===studioSelected.end&&(!studioSelected.blockKey||studioBlockKey(b)===studioSelected.blockKey));if(block){studioShowFunction(block,studioModuleCache.get(studioBlockKey(block)));$('studioExplain').querySelector('.studio-module-generate')?.click();return;}}
 const selection={...studioSelected};studioIdentity();studioSelected=selection;const version=studioVersion,id=++studioRequest,key='line:'+selection.start+':'+selection.end;
 if(!connected()&&!studioAnswers.has(key)&&!studioPendingAnswers.has(key)){settings();return;}
 const popupId=anchor?.getBoundingClientRect?showStudioPopup(anchor,uiText('第 ')+(selection.start+sourceOffset)+(selection.end===selection.start?'':'—'+(selection.end+sourceOffset))+uiText(' 行')):null;
 $('studioExplain').replaceChildren(element('p',uiText("AI 正在解释选中的原文…"),'studio-empty'));
 const apply=answer=>{$('studioExplain').replaceChildren(element('span',uiText("AI 解释 · 请对照源码核对"),'studio-provenance'),globalThis.WhoPointDisplay?.paragraph(answer,current?.language)??element('p',answer));appendAITerms($('studioExplain'),answer);appendExplanationSave($('studioExplain'),answer,explanationSource(selection));appendBuiltinReference($('studioExplain'),selection);studioAppendFollowups($('studioExplain'),selection);};
 try{const pending=studioGetAnswer(key,{selection,pointReading:true,question:selectionQuestion()}).then(response=>response.answer);studioTrackReading(pending,apply);const answer=await pending;
  if(version===studioVersion&&popupId===studioTokenRequest)studioPopupAnswer(answer,selection);
  if(version===studioVersion&&id===studioRequest)apply(answer);
 }catch(e){if(version===studioVersion){if(id===studioRequest)$('studioExplain').replaceChildren(element('p',uiError(e),'studio-error'));if(popupId===studioTokenRequest){$('studioTokenText').textContent=uiError(e);positionStudioToken();}}}
}
function closeStudioToken(){studioTokenRequest++;studioActiveToken?.classList.remove('selected-token');studioActiveToken=null;studioPopupPosition=null;studioPopupDrag=null;const p=$('studioTokenPopup');if(p){p.hidden=true;p.classList?.remove('dragging');}}
function positionStudioToken(reveal=false){
 const popup=$('studioTokenPopup');if(popup.hidden||!studioTokenAnchor)return;
 const width=Math.min(360,innerWidth-24);popup.style.width=width+'px';
 if(studioPopupPosition){
  popup.style.maxHeight=Math.max(1,Math.min(studioPopupPosition.heightLimit||innerHeight-24,innerHeight-24))+'px';
  const height=popup.getBoundingClientRect().height;
  studioPopupPosition={...studioPopupPosition,left:Math.max(12,Math.min(studioPopupPosition.left,innerWidth-width-12)),top:Math.max(12,Math.min(studioPopupPosition.top,innerHeight-height-12))};
  popup.style.left=studioPopupPosition.left+'px';popup.style.top=studioPopupPosition.top+'px';return;
 }
 let box=studioTokenAnchor.getBoundingClientRect();
 if(reveal&&(box.top<12||innerHeight-box.bottom<Math.min(240,innerHeight*.4))){studioTokenAnchor.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});box=studioTokenAnchor.getBoundingClientRect();}
 const clip=$('studioCode').getBoundingClientRect();
 if(!reveal&&(box.top<Math.max(12,clip.top)||box.bottom>Math.min(innerHeight-80,clip.bottom))){
  const previous=popup.getBoundingClientRect();studioPopupPosition={left:previous.left,top:previous.top,heightLimit:parseFloat(popup.style.maxHeight)};positionStudioToken();return;
 }
 const top=Math.max(12,box.bottom+8);
 // Reserve space below the target; never move a tall answer over its anchor.
 popup.style.maxHeight=Math.max(1,innerHeight-top-12)+'px';
 popup.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';popup.style.top=top+'px';
}
function showStudioPopup(anchor,title){
 studioActiveToken?.classList.remove('selected-token');studioActiveToken=anchor;anchor.classList.add('selected-token');studioTokenAnchor=anchor;studioPopupPosition=null;
 const id=++studioTokenRequest,popup=$('studioTokenPopup');$('studioTokenLesson').replaceChildren();$('studioTokenTitle').textContent=title;
 $('studioTokenText').textContent=uiText('AI 正在解释选中的原文…');popup.hidden=false;popup.scrollTop=0;positionStudioToken(true);$('studioTokenClose').focus({preventScroll:true});return id;
}
function studioPopupAnswer(answer,selection,token){
 if(globalThis.WhoPointDisplay)WhoPointDisplay.render($('studioTokenText'),answer,current?.language);else $('studioTokenText').textContent=answer;appendAITerms($('studioTokenText'),answer);
 $('studioTokenLesson').replaceChildren();appendExplanationSave($('studioTokenLesson'),answer,explanationSource(selection,token?{startColumn:token.startColumn,endColumn:token.endColumn}:undefined),token?.text);appendBuiltinReference($('studioTokenLesson'),selection,token);positionStudioToken();
}
async function openStudioToken(anchor,token){
 studioIdentity();const id=showStudioPopup(anchor,token.text),version=studioVersion;
 const key='token:'+token.line+':'+token.startColumn+':'+token.endColumn;
 if(!connected()&&!studioAnswers.has(key)&&!studioPendingAnswers.has(key)){$('studioTokenText').textContent=uiText('请先连接 AI，然后再次点击这个词语。');return;}
 try{const response=await studioGetAnswer(key,{selection:{start:token.line,end:token.line},token,knowledge:true,question:uiText('解释选中词语；简单定义不需要知识卡。')});
  if(id===studioTokenRequest&&version===studioVersion){
   studioPopupAnswer(response.answer,{start:token.line,end:token.line},token);
  }
 }catch(e){if(id===studioTokenRequest&&version===studioVersion){$('studioTokenText').textContent=uiError(e);positionStudioToken();}}
}
$('studioTokenClose').onclick=()=>{closeStudioToken();studioTokenAnchor?.focus({preventScroll:true});};
$('studioTokenHeader').onpointerdown=e=>{
 if(e.button!==0||e.target.closest('button'))return;
 const popup=$('studioTokenPopup'),box=popup.getBoundingClientRect();studioPopupPosition={left:box.left,top:box.top,heightLimit:parseFloat(popup.style.maxHeight)};studioPopupDrag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:box.left,top:box.top};
 $('studioTokenHeader').setPointerCapture(e.pointerId);$('studioTokenPopup').classList.add('dragging');e.preventDefault();
};
$('studioTokenHeader').onpointermove=e=>{if(studioPopupDrag?.pointerId!==e.pointerId)return;studioPopupPosition={...studioPopupPosition,left:studioPopupDrag.left+e.clientX-studioPopupDrag.x,top:studioPopupDrag.top+e.clientY-studioPopupDrag.y};positionStudioToken();};
const studioEndDrag=()=>{studioPopupDrag=null;$('studioTokenPopup').classList.remove('dragging');};
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('studioTokenHeader').addEventListener(event,studioEndDrag);
window.addEventListener('resize',()=>positionStudioToken(true));document.addEventListener('scroll',()=>positionStudioToken(),true);
$('studioExplainBtn').onclick=studioExplainSelection;
$('studioStop').onclick=()=>{for(const c of studioControllers)c.abort();};
$('studioEdit').onclick=()=>document.body.classList.toggle('source-open');
$('studioTab').onclick=()=>setMode('studio');
$('studioCopy').onclick=async()=>{if(!studioSelected)return;try{await navigator.clipboard.writeText(analyzedSource.split('\n').slice(studioSelected.start-1,studioSelected.end).join('\n'));toast(uiText("已复制选中原文。"));}catch{toast(uiText("复制未完成，请从编辑区复制。"));}};
