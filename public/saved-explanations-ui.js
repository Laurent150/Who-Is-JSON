function savedSourceName(source){return source.unnamed?uiText('代码片段'):source.file;}
var uiError = globalThis.WhoI18n?.error || (error=>uiText(error?.message || String(error || '请求未完成。')));
function explanationSaveLabel(on){return globalThis.WhoI18n?.locale==='en'?(on?'Saved':'Save'):(on?'已收藏':'收藏');}
function explanationSource(range,extra={}){
 const full=typeof analyzedFullSource==='string'&&analyzedFullSource?analyzedFullSource:analyzedSource;
 return {file:fileName||uiText('代码片段'),unnamed:!fileName,language:current?.language||'Unknown',fullSource:full,sourceStart:typeof analyzedFullSource==='string'&&analyzedFullSource?1:sourceOffset+1,start:range.start+sourceOffset,end:range.end+sourceOffset,...extra};
}
function refreshExplanationSaves(){
 let ids;try{ids=new Set(knowledgeSaved().map(x=>x.id));}catch{return;}
 for(const button of document.querySelectorAll('[data-explanation-save]')){
  const on=ids.has(button.dataset.explanationSave);button.textContent=explanationSaveLabel(on);button.setAttribute('aria-pressed',String(on));
 }
}
function appendExplanationSave(host,answer,source,title,origin='ai'){
 if(typeof answer!=='string'||!answer.trim())return;
 // Keep the beginner definitions visible beside an AI explanation in its saved copy too.
 const locale=globalThis.WhoI18n?.locale||'zh-CN';
 const terms=origin==='ai'&&readingMode==='beginner'?globalThis.WhoAIGlossary?.forText(answer,source.language,locale)||[]:[];
 if(terms.length)answer+='\n\n'+(locale==='en'?'Terms used here':'这里的术语')+'\n'+terms.map(t=>t.name+' — '+t.meaning).join('\n');
 const button=element('button',explanationSaveLabel(false),'save-explanation');button.type='button';button.disabled=true;host.append(button);
 const input={answer,title,source:JSON.parse(JSON.stringify(source)),locale:globalThis.WhoI18n?.locale||'zh-CN',readingMode,origin};
 WhoSavedExplanations.create(input).then(item=>{
  button.dataset.explanationSave=item.id;button.disabled=false;refreshExplanationSaves();
  button.onclick=()=>{try{
   const items=knowledgeSaved(),exists=items.some(x=>x.id===item.id),next=exists?items.filter(x=>x.id!==item.id):[item,...items];
   if(next.length>500||new TextEncoder().encode(JSON.stringify({knowledge:next,cards:saved()})).length>1900000)throw Error(uiText('收藏空间不足，请先整理收藏后重试'));
   WhoLibraryStore.setItem(KNOWLEDGE_KEY,JSON.stringify(next));refreshExplanationSaves();
  }catch(error){toast(error.name==='QuotaExceededError'?uiText('收藏空间不足，请先整理收藏后重试'):uiError(error));}};
 }).catch(()=>{button.remove();toast(uiText('未能准备收藏，请重新打开这段解释'));});
}
function appendBuiltinReference(host,range,token){
 const ids=WhoSavedExplanations.builtinIds({language:current.language,source:analyzedSource,start:range.start,end:range.end,token,records:current.blocks.flatMap(b=>b.learning||[]),scan:WhoReading.scan});
 const cards=ids.map(id=>WhoKnowledge.cards[id]).filter(Boolean);if(!cards.length)return;
 const box=element('details',undefined,'explanation-basics');box.append(element('summary',uiText('查看基础知识')));
 for(const card of cards){const section=element('section');section.append(element('strong',card.title),element('p',card.plain),element('p',card.naming));if(card.example)section.append(codeView(card.example,{language:card.language,indentHints:false}),element('p',card.result));if(card.pitfall)section.append(element('p',card.pitfall));box.append(section);}
 host.append(box);
}
function showSavedSource(source,language){
 const dialog=element('dialog',undefined,'saved-source-dialog');dialog.setAttribute('aria-label',uiText('收藏时的源码'));
 const header=element('div',undefined,'dialog-head'),close=element('button',uiText('关闭'));close.onclick=()=>dialog.close();
 header.append(element('h2',uiText('收藏时的源码')),close);dialog.append(header,element('p',savedSourceName(source)+' · '+uiText('第 {0}—{1} 行',source.start,source.end)));
 const full=typeof source.fullSource==='string'?source.fullSource:source.code,start=typeof source.fullSource==='string'?(source.sourceStart||1):source.start;
 if(typeof source.fullSource!=='string')dialog.append(element('p',uiText('这条旧收藏只保留了当时的源码片段'),'tiny'));
 const lines=full.split('\n'),highlight={start:source.start,end:source.end,startColumn:source.startColumn??0,endColumn:source.endColumn??(lines[source.end-start]?.length||0)};
 const code=codeView(full,{start,highlight,indentHints:false,language:source.language||language});dialog.append(code);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();requestAnimationFrame(()=>code.querySelector('mark')?.scrollIntoView({block:'center'}));
}
function renderSavedLibrary(host){
 let items;
 try{items=[...knowledgeSaved().map(item=>({item,kind:'knowledge'})),...saved().map(item=>({item,kind:'function'}))];}catch{host.append(element('p',uiText('收藏数据暂时无法读取，原数据已保留。')));return;}
 const controls=element('div',undefined,'knowledge-filters'),filter=element('select'),search=element('input'),list=element('div');
 filter.setAttribute('aria-label',uiText('按语言筛选'));const all=element('option',uiText('全部'));all.value='';filter.append(all);
 for(const language of [...new Set(items.map(x=>WhoSavedExplanations.language(x.item)))].sort()){const option=element('option',language==='Unknown'?uiText('未识别语言'):language);option.value=language;filter.append(option);}
 search.type='search';search.placeholder=uiText('搜索收藏');search.setAttribute('aria-label',uiText('搜索收藏'));controls.append(filter,search);host.append(controls,list);
 function draw(){list.replaceChildren();const selected=items.filter(x=>WhoSavedExplanations.matches(x.item,filter.value,search.value));
  if(!selected.length)list.append(element('p',uiText(items.length?'没有符合条件的收藏。':'还没有收藏，打开一段解释即可收藏')));
  for(const {item,kind} of selected){
   const card=item.card||item,language=WhoSavedExplanations.language(item),sources=item.sources||[{file:item.name||uiText('代码片段'),code:item.code,context:item.purpose||'',language,start:item.start||1,end:item.end||((item.start||1)+item.code.split('\n').length-1),...(item.fullSource?{fullSource:item.fullSource,sourceStart:item.sourceStart||1}: {})}];
   const article=element('article',undefined,'saved-explanation'),detail=element('details'),summary=element('summary');
   const answer=card.plain||card.purpose||'',first=sources[0];summary.append(element('strong',card.title),element('span',answer.replace(/\s+/g,' ').slice(0,150),'saved-explanation-preview'),element('small',(language==='Unknown'?uiText('未识别语言'):language)+(first?' · '+savedSourceName(first)+' · '+uiText('第 {0}—{1} 行',first.start,first.end):'')));detail.append(summary,element('p',answer));
   // Legacy cards keep their existing content, without imposing their old categories on the UI.
   if(card.kind!=='explanation'){if(card.naming)detail.append(element('p',card.naming));if(card.example)detail.append(codeView(card.example,{language,indentHints:false}),element('p',card.result||''));if(card.pitfall)detail.append(element('p',card.pitfall));}
   const actions=element('div',undefined,'saved-explanation-actions');
   for(const source of sources){const view=element('button',sources.length===1?uiText('查看源码'):uiText('查看源码')+' · '+savedSourceName(source)+' · '+source.start);view.onclick=()=>showSavedSource(source,language);actions.append(view);}
   const remove=element('button',uiText('取消收藏'));remove.onclick=()=>{try{if(kind==='knowledge')WhoLibraryStore.setItem(KNOWLEDGE_KEY,JSON.stringify(knowledgeSaved().filter(x=>x.id!==item.id)));else WhoLibraryStore.setItem('codelingo.cards',JSON.stringify(saved().filter(x=>x.id!==item.id)));items=items.filter(x=>!(x.kind===kind&&x.item.id===item.id));refreshExplanationSaves();draw();}catch{toast(uiText('取消收藏失败，原数据已保留。'));}};
   actions.append(remove);detail.append(actions);article.append(detail);list.append(article);
  }
 }
 filter.onchange=draw;search.oninput=draw;draw();
}

function localExplanationSource(source,language,start,part){
 const range={start:start+part.start-1,end:start+(part.end||part.start)-1},columns={startColumn:part.startColumn??0,endColumn:part.endColumn??source.split('\n')[(part.end||part.start)-1]?.length??0};
 const full=typeof analyzedFullSource==='string'?analyzedFullSource:'';
 if(full&&full.split('\n').slice(start-1,start-1+source.split('\n').length).join('\n')===source)return {file:fileName||uiText('代码片段'),unnamed:!fileName,language,fullSource:full,sourceStart:1,...range,...columns};
 return {file:uiText('代码片段'),unnamed:true,language,fullSource:source,sourceStart:start,...range,...columns};
}
