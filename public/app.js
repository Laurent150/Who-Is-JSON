var uiText = globalThis.WhoI18n?.t || ((text,...values)=>text.replace(/\{(\d+)\}/g,(m,n)=>n<values.length?String(values[n]):m));
var uiError = globalThis.WhoI18n?.error || (error=>uiText(error?.message || String(error || '请求未完成。')));
// Temporarily paused in the product UI; keep the walkthrough implementation for restoration.
const WALKTHROUGH_ENABLED=false;
const $=id=>document.getElementById(id);let current=null,selected=null,imageData=null,fileName='',revision=0,config={};let busy=false;let sourceOffset=0,analyzedSource="",analyzedFullSource="",presentation=null,activeMode="studio";
try{config=JSON.parse(localStorage.getItem('codelingo.config')||'{}');}catch{}config.key='';
const sample=`def calculate_total(prices, discount=0.9):\n    total = 0\n    for price in prices:\n        if price > 0:\n            total += price\n    return round(total * discount, 2)\n\ncart = [29, 49, 99]\nfinal_price = calculate_total(cart)\nprint(final_price)\n`;
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6000);}
function effectiveConfig(){return window.WhoTrial?.enabled&&!window.WhoTrialOptOut&&!config.key?{provider:'platform',base:'https://api.deepseek.com',model:'deepseek-flash'}:config;}
async function api(route,data,method='POST',signal){const payload={...data,readingMode,locale:globalThis.WhoI18n?.locale||'zh-CN'};if(data&&Object.hasOwn(data,'config'))payload.config=effectiveConfig();try{const r=await fetch('/api/'+route,{signal:signal||AbortSignal.timeout(510000),method,headers:{'Content-Type':'application/json','X-CodeLingo-Token':window.APP_TOKEN,'X-Who-Session':window.WhoAccountSession?.()||''},...(method==='POST'?{body:JSON.stringify(payload)}:{})});const b=await r.json();if(!r.ok)throw Object.assign(Error(b.error||"操作未完成"),{trialRefund:b.trialRefund,diagnostics:b.diagnostics});return b;}finally{if(payload.config?.provider==='platform')void window.WhoRefreshTrial?.();}}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function meta(){const n=$('source').value.split('\n').length;$('numbers').textContent=$('source').value?Array.from({length:n},(_,i)=>i+1).join('\n'):'';$('sourceMeta').textContent=($('source').value?n:0)+uiText(" 行 · 原代码不会被执行");$('filename').textContent=fileName||uiText("未命名片段");}
function invalidate(){resetTalk();studioReset();studioSource=null;analysisAbort?.abort();revision++;document.body.classList.remove('has-report');current=null;selected=null;presentation=null;$('scopeNotice').textContent=uiText("代码已变化，请重新生成。");$('results').hidden=true;$('empty').hidden=false;$('resultMode').textContent=uiText("等待分析");meta();if(typeof formatSourceChanged==='function')formatSourceChanged();}
function setCode(code,name){$('source').value=code;fileName=name||'';invalidate();}
function setImage(data,name){revision++;imageData=data;$('preview').src=data;$('imageBox').hidden=false;$('ocrNotice').textContent=uiText("内置英文与简体中文语言包。识别后请对照图片核对代码。");setCode('',name||uiText("截图.png"));toast(uiText("图片已导入。点击「识别代码」，核对后再开始讲解。"));}
function settings(){for(const k of ['base','model','key'])$(k).value=config[k]||'';$('settings').showModal();}
function connected(){const c=effectiveConfig();if(!c.base||!c.model)return false;if(c.provider==='platform'||c.key)return true;try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(c.base).hostname);}catch{return false;}}
function connection(){
 const c=effectiveConfig();const model=connected()?String(c.model).trim().replace(/^deepseek-/i,'DEEPSEEK-'):'';
 $('connection').textContent=model?uiText("● 已接入 ")+model+(c.provider==='platform'?uiText(" · 赠送额度"):''):uiText("● 本地模式");
 $('connection').title=model;
 $('localModeNotice').hidden=!!model;
}
function ensureAI(){if(!connected()){settings();throw Error(uiText("请先登录获取可用试用额度，或在 AI 设置中配置服务。"));}}
async function task(btn,fn){if(busy)return;busy=true;const old=btn.textContent;btn.disabled=true;btn.classList.add('busy');btn.textContent=uiText("正在处理…");const started=Date.now();const timer=setInterval(()=>{btn.textContent=uiText("正在处理 · ")+Math.floor((Date.now()-started)/1000)+uiText(" 秒");},1000);try{await fn();}catch(e){toast(uiError(e));}finally{clearInterval(timer);btn.textContent=old;btn.disabled=false;btn.classList.remove('busy');busy=false;}}
let analysisAbort=null;
function languageHelpNotice(info){
 if(!info)return '';
 const language=uiText(info.language||'未确定');
 switch(info.status){
  case 'verified':return uiText('AI 辅助识别为 {0}；结构和源码位置已由本地解析。',language);
  case 'uncertain':return uiText('AI 未能确定语言，保留本地结果。');
  case 'unsupported':return uiText('AI 判断为 {0}，当前没有对应的本地结构解析器；仍可点读源码。',language);
  case 'unverified':return uiText('AI 判断为 {0}，但本地解析未确认有效结构，保留原结果。',language);
  default:return uiText('AI 辅助识别未完成，保留本地结果。');
 }
}
async function run(selectionOnly=false){
 const full=$('source').value;let code=full,offset=0;
 if(selectionOnly){const start=$('source').selectionStart,end=$('source').selectionEnd;if(start===end)return toast(uiText("请先在代码框里选中要讲的内容。"));const a=full.lastIndexOf('\n',start-1)+1;let z=full.indexOf('\n',end-1);if(z<0)z=full.length;code=full.slice(a,z);offset=full.slice(0,a).split('\n').length-1;}
 await task(selectionOnly?$('selectionBtn'):$('analyzeBtn'),async()=>{
  if(!code.trim())throw Error(uiText("先放入一段代码，或选择一个示例。"));
  const rev=revision;
  const data=await api('analyze',{code,name:fileName,ai:false});
  if(rev!==revision)return;
  sourceOffset=offset;analyzedSource=code;analyzedFullSource=full;current=data;updateFormatHint(data);
  $('scopeNotice').textContent=selectionOnly?uiText("本次分析：原文件第 {0}—{1} 行（完整行）。",offset+1,offset+code.split('\n').length):uiText("本次分析：整个文件。");render();
  const identifyLanguage=connected()&&data.needsLanguageHelp;
  $('aiProgress').hidden=!identifyLanguage;if(!identifyLanguage)return;
  const controller=new AbortController();analysisAbort=controller;
  $('cancelAnalysis').hidden=false;
  const started=Date.now();const update=()=>{$('aiProgressText').textContent=uiText("本地识别未确定，AI 正在辅助判断语言")+uiText(" · 已等待 ")+Math.floor((Date.now()-started)/1000)+uiText(" 秒");};update();const timer=setInterval(update,1000);
  try {
   const enhanced=await api('analyze',{code,name:fileName,ai:false,identifyLanguage,config},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(630000)]));
   if(rev!==revision)return;
   const focused=activeStructure?.block.start, selection=lineReadingSelection && {...lineReadingSelection}, step=flowReadingStep;
   const languageChanged=enhanced.language!==current.language||enhanced.languageIdentification?.status==='verified';
   current=enhanced;if(languageChanged){studioReset();studioSource=null;}render();updateFormatHint(enhanced);
   const item=WhoStructure.modules(current).find(x=>x.block.start===focused);
   if(item){openStructure(item,[...$('structureModules').querySelectorAll('.module-node')].find(x=>x.dataset.function===item.block.title));if(step)openFlowReading(step.node,item.block);}
   if(selection){flowReadingSync=true;try{selectReadingLines(selection.requestedStart,selection.requestedEnd);}finally{flowReadingSync=false;}}
   $('aiProgressText').textContent=languageHelpNotice(enhanced.languageIdentification);
  }catch(error){if(rev===revision)$('aiProgressText').textContent=controller.signal.aborted?uiText("已停止 AI 补充，本地流程仍可阅读。"):uiText("AI 补充未完成：")+(error.name==='TimeoutError'?uiText("等待超时，请稍后重试。"):uiError(error))+uiText(" 本地流程仍可阅读。");}
  finally{clearInterval(timer);if(analysisAbort===controller)analysisAbort=null;$('cancelAnalysis').hidden=true;}
 });
}
$('cancelAnalysis').onclick=()=>analysisAbort?.abort();

function render(){
 selected=null;document.body.classList.add('has-report');document.body.classList.remove('source-open');$('empty').hidden=true;$('results').hidden=false;
 $('resultMode').textContent=current.mode==='ai'?uiText("本地流程 + AI 说明"):({ready:uiText("已读取结构"),partial:current.partialRecovery?uiText("部分可读 · 已继续讲解"):uiText("仅部分解析"),invalid:uiText("解析未完成"),unsupported:uiText("暂不支持"),empty:uiText("等待输入")})[current.status]||uiText("本地结构讲解");
 $('warnings').replaceChildren(...(current.warnings||[]).map(w=>element('div','· '+w)));$('answer').hidden=true;renderTalk();renderFormatGuide();$('inputNotes').hidden=!(current.warnings||[]).length&&$('formatGuide').hidden;resetFlowReading();renderStructure();renderLineReading();renderStudio();setMode(activeMode);
}
function showBlock(b,i){
 selected=b;openStructure({block:b,index:i},[...document.querySelectorAll('.module-node')].find(x=>x.dataset.function===b.title));
 const lines=$('source').value.split('\n');const start=lines.slice(0,b.start+sourceOffset-1).reduce((a,l)=>a+l.length+1,0);const end=start+lines.slice(b.start+sourceOffset-1,b.end+sourceOffset).join('\n').length;
 $('source').setSelectionRange(start,end);$('source').scrollTop=Math.max(0,(b.start+sourceOffset-3)*24);$('numbers').scrollTop=$('source').scrollTop;
}
function saved(){try{return JSON.parse(WhoLibraryStore.getItem('codelingo.cards')||'[]');}catch{return [];}}
function saveCard(b){const cards=saved();cards.unshift({...b,start:b.start+sourceOffset,end:b.end+sourceOffset,id:Date.now(),language:current.language,name:fileName||uiText("代码片段"),saved:new Date().toLocaleString(),mode:current.mode,fullSource:analyzedFullSource||analyzedSource,sourceStart:analyzedFullSource?1:sourceOffset+1});try{WhoLibraryStore.setItem('codelingo.cards',JSON.stringify(cards.slice(0,60)));toast(uiText("已收藏到「我的功能卡」。"));}catch{toast(uiText("本地存储空间不足，请导出或删除部分收藏。"));}}
function download(name,text,type='text/markdown;charset=utf-8'){const a=element('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function library(){const host=$('savedCards');host.replaceChildren();renderSavedLibrary(host);if(!$('library').open)$('library').showModal();}
async function loadFile(file){if(!file)return;if(file.size>8e6)return toast(uiText("请选择小于 8 MB 的文件。"));if(file.type.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(file.name)){const reader=new FileReader();reader.onload=()=>setImage(reader.result,file.name);reader.readAsDataURL(file);}else{if(!WhoFileTypes.accepts(file.name))return toast(uiText("请选择源码文本或 PNG、JPG、WebP 图片。"));if(file.size>100000)return toast(uiText("第一版最多分析 100 KB 源码。"));removeImage();setCode(await file.text(),file.name);toast(uiText("文件已导入，点击「查看整段结构」。"));}}
function removeImage(){imageData=null;$('imageBox').hidden=true;$('preview').removeAttribute('src');}
async function ask(q){if(!current)return toast(uiText("先分析一段代码。"));if(current.mode!=='ai'&&!connected()){const b=selected||current.blocks[0];if(!b)return toast(uiText("当前没有可解释的模块，请补全代码或连接 AI。"));$('answer').hidden=false;$('answer').textContent=uiText("本地学习提示：{0}\n\n{1}\n\n连接 AI 后，可以结合你的实际代码回答「{2}」。",b.concept,b.usage,q);return;}await task($('askBtn'),async()=>{ensureAI();const rev=revision;const r=await api('ask',{question:q,code:analyzedSource,config});if(rev!==revision)return;$('answer').hidden=false;$('answer').textContent=r.answer;});}
$('localModeLogin').onclick=()=>$('accountBtn').click();$('localModeSettings').onclick=settings;
$('settingsBtn').onclick=settings;$('saveSettings').onclick=()=>{config={base:$('base').value.trim().replace(/\/$/,''),model:$('model').value.trim(),key:$('key').value.trim()};if(!config.base||!config.model)return toast(uiText("请填写基础地址和模型名称。"));try{const u=new URL(config.base);if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error();}catch{return toast(uiText("请填写有效 HTTPS 地址，或本机 HTTP 地址。"));}window.WhoTrialOptOut=true;localStorage.setItem('codelingo.config',JSON.stringify({base:config.base,model:config.model}));connection();if(current){renderStudio();renderTalk();}$('settings').close();toast(uiText(connected()?"已配置。下一次 AI 操作会发送内容到此服务；连接尚未验证。":"服务地址已保存；尚未填写密钥，当前仍为本地模式。"));};$('disconnect').onclick=()=>{window.WhoTrialOptOut=true;config={};localStorage.removeItem('codelingo.config');connection();if(current){renderStudio();renderTalk();}$('settings').close();toast(uiText("已断开 AI 连接。"));};
$('libraryBtn').onclick=library;$('source').oninput=invalidate;$('source').addEventListener('paste',e=>{const t=e.currentTarget;if(e.clipboardData?.getData('text/plain')&&t.selectionStart===0&&t.selectionEnd===t.value.length){fileName='';meta();}});$('source').onscroll=()=>$('numbers').scrollTop=$('source').scrollTop;$('source').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,s=t.selectionStart,end=t.selectionEnd;t.value=t.value.slice(0,s)+'    '+t.value.slice(end);t.setSelectionRange(s+4,s+4);invalidate();}};
$('analyzeBtn').onclick=()=>run();$('selectionBtn').onclick=()=>run(true);$('clearBtn').onclick=()=>{removeImage();setCode('','');};const demo=()=>{removeImage();setCode(sample,'shopping_cart.py');run();};$('emptyDemo').onclick=demo;$('fileInput').onchange=e=>{loadFile(e.target.files[0]).catch(e=>toast(uiError(e)));e.target.value='';};$('removeImage').onclick=removeImage;
function recognizeImage(ai=false){return task($(ai?'ocrAiBtn':'ocrBtn'),async()=>{if(ai)ensureAI();const rev=revision;const image=ai?imageData:await prepareOcrImage(imageData);if(rev!==revision)return;const r=await api('ocr',{image,ai,...(ai?{config}:{})});if(rev!==revision)return;$('ocrNotice').textContent=[r.method,...(r.warnings||[uiText("请核对缩进与符号。")])].join('；');setCode(r.code,fileName.replace(/\.[^.]+$/,'')+'.txt');toast(uiText("已提取代码，请对照原图核对后再分析。"));});}
$('ocrBtn').onclick=()=>recognizeImage();$('ocrAiBtn').onclick=()=>recognizeImage(true);
$('widgetBtn').onclick=()=>task($('widgetBtn'),async()=>{await api('widget');toast(uiText("悬浮入口已打开，可截图或拖入文件。"));});
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ask(b.dataset.q));$('askBtn').onclick=()=>{const q=$('question').value.trim();if(q)ask(q);else toast(uiText("写下你想了解或修改的地方。"));};$('question').onkeydown=e=>{if(e.key==='Enter')$('askBtn').click();};
let drag=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();drag++;$('dropHint').hidden=false;}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',()=>{if(--drag<=0)$('dropHint').hidden=true;});document.addEventListener('drop',e=>{e.preventDefault();drag=0;$('dropHint').hidden=true;loadFile(e.dataTransfer.files[0]).catch(e=>toast(uiError(e)));});document.addEventListener('paste',e=>{const item=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(item){e.preventDefault();loadFile(item.getAsFile()).catch(error=>toast(uiError(error)));}});
setInterval(async()=>{if(busy)return;try{const b=await api('inbox',null,'GET');if(b){if(b.image)setImage(b.image,b.name);else{removeImage();setCode(b.code,b.name);toast(uiText("已接收悬浮窗拖入的文件。"));}window.focus();}}catch{}},1400);connection();meta();

function renderSymbols(host,symbols){
 if(!Array.isArray(symbols)||!symbols.length)return;
 const section=element('section',undefined,'name-guide');
 section.append(element('h4',uiText("这些名字是谁起的？")),element('p',uiText("点开一个名字，看看它是什么、能不能改名。"),'tiny'));
 for(const item of symbols){
  const row=element('details',undefined,'name-item');
  const label=element('summary');label.append(element('code',item.name),element('span',item.origin,'name-origin'));
  row.append(label,element('p',item.meaning),element('p',item.rename,'rename-note'));
  if(item.example)row.append(element('p',uiText("例如：")+item.example,'name-example'));
  section.append(row);
 }
 host.append(section);
}

function setMode(mode){mode=['learn','map','line'].includes(mode)||mode==='talk'&&!WALKTHROUGH_ENABLED?'studio':mode;activeMode=mode;document.body.classList.toggle('line-mode',mode==='line'||mode==='map'||mode==='studio');for(const [key,panel,tab]of [['studio','studioPanel','studioTab'],['line','linePanel','lineTab'],['map','mapPanel','mapTab'],['talk','talkPanel','talkTab']]){$(panel).hidden=mode!==key;$(tab).setAttribute('aria-pressed',String(mode===key));}layoutFlowReading();closeStudioToken();}

function renderTalk(){
 if(!WALKTHROUGH_ENABLED)return;
 presentation=talkDraft();
 $('parseIssues').hidden=!(presentation.diagnostics||[]).length;$('parseIssueText').textContent=(presentation.diagnostics||[]).join('\n');$('speechToc').replaceChildren();$('talkScope').textContent=$('scopeNotice').textContent;$('speech').replaceChildren();$('talkQuestions').replaceChildren();
 const blocked=!presentation.sections.length;const fixable=false;$('recovery').hidden=!fixable;$('qaHeading').hidden=blocked||!presentation.questions.length;$('talkQuestions').hidden=blocked||!presentation.questions.length;$('speechToc').hidden=blocked;$('parseIssues').open=false;if(fixable){const issues=presentation.diagnostics||[];const issue=issues.find(x=>/第\s*\d+\s*行/.test(x));$('firstIssue').textContent=issue?uiText("解析器首先报告：")+issue+(sourceOffset?uiText("（上面的行号相对于选区；定位按钮会跳回原文件。）"):''):uiText("检测到了代码围栏等复制格式，它们可能被误当成代码。先预览清理，再重新解析。");}$('rehearse').disabled=!presentation.sections.length;
 const talkTerms=new Set();
 presentation.sections.forEach((s,i)=>{const card=element('article',undefined,'speech-card');card.id='speech-'+i;const link=element('button',s.title);link.onclick=()=>card.scrollIntoView({behavior:'smooth',block:'start'});$('speechToc').append(link);const head=element('div',undefined,'speech-head');head.append(element('div',`${String(i+1).padStart(2,'0')} / ${s.evidence}`,'speech-kicker'));if(i===0)head.append(walkthroughExport(presentation));card.append(head,element('h3',s.title),element('p',s.text));appendAITerms(card,s.text,talkTerms);
 if(s.index!==null){const row=element('div',undefined,'speech-actions');const locate=element('button',uiText("对照第 {0}—{1} 行",s.start,s.end));locate.onclick=()=>{document.body.classList.add('source-open');showBlock(current.blocks[s.index],s.index);document.querySelectorAll('.speech-card').forEach(x=>x.classList.remove('active'));card.classList.add('active');};const learn=element('button',uiText("这部分我还不懂 ↗"));learn.onclick=()=>{setMode('studio');studioOpenFunction(current.blocks[s.index]);};row.append(locate,learn);card.append(row);} $('speech').append(card);});
 if(!presentation.sections.length)$('speech').append(element('p',presentation.title));
 presentation.questions.forEach(q=>{const d=element('details',undefined,'qa-item');d.append(element('summary',q.question),element('p',q.answer));$('talkQuestions').append(d);});
}
$('talkTab').onclick=()=>setMode('talk');
$('sourceToggle').onclick=()=>document.body.classList.toggle('source-open');
for(const id of ['duration','audience','coverage'])$(id).onchange=()=>{if(current)renderTalk();};
$('rehearse').onclick=()=>{document.body.classList.toggle('rehearsing');$('rehearse').textContent=document.body.classList.contains('rehearsing')?uiText("退出专注 · Esc"):uiText("专注讲稿");};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('rehearsing');$('rehearse').textContent=uiText("专注讲稿");}});

function locateProblem(){document.body.classList.add('source-open');const issue=(presentation?.diagnostics||[]).find(x=>/第\s*\d+\s*行/.test(x));const relative=Number(issue?.match(/第\s*(\d+)\s*行/)?.[1]||1);const line=relative+sourceOffset;const lines=$('source').value.split('\n');const start=lines.slice(0,line-1).reduce((n,l)=>n+l.length+1,0);$('source').focus({preventScroll:true});$('source').setSelectionRange(start,start+(lines[line-1]||'').length);$('source').scrollTop=Math.max(0,(line-3)*24);$('numbers').scrollTop=$('source').scrollTop;$('source').scrollIntoView({behavior:'smooth',block:'nearest'});}
$('locateIssue').onclick=locateProblem;
$('replaceSource').onclick=()=>$('fileInput').click();
$('repairFormat').onclick=()=>previewCleanup();

function renderFormatGuide(){
 const host=$('formatGuide');host.replaceChildren();const changes=current.formatChanges||[],unknown=current.unexplained||[];host.hidden=!changes.length&&!current.syntaxErrors;if(host.hidden)return;
 host.append(element('h3',uiText("原文、格式处理与未读懂的部分")));
 host.append(element('p',uiText("分析不会覆盖你的原文。下面的“处理后”只去除明确的展示格式，不代表已经修复所有语法或验证运行。")));
 for(const c of changes)host.append(element('p','✓ '+c));
 if(changes.length){const details=element('details');details.append(element('summary',uiText("逐行对照自动处理的格式")));const rows=element('div',undefined,'format-diff');const before=analyzedSource.split('\n'),after=(current.normalizedCode||analyzedSource).split('\n');before.forEach((line,i)=>{if(line===after[i])return;const row=element('div',undefined,'format-row');row.append(element('strong',uiText("原文件第 {0} 行",i+1+sourceOffset)),element('small',uiText("原文")),codeView(line,{start:i+1+sourceOffset}),element('small',uiText("处理后")),codeView(after[i]||'',{start:i+1+sourceOffset}));rows.append(row);});details.append(rows);host.append(details);const preview=element('details');preview.append(element('summary',uiText("查看用于解析的完整文本")),codeView(current.normalizedCode,{start:1+sourceOffset}));host.append(preview);}
 if(current.syntaxErrors){host.append(element('h4',current.partialRecovery?uiText("这些区域未纳入讲稿"):uiText("当前没有足够完整的结构可讲解")));for(const x of unknown){host.append(element('p',uiText("第 {0}—{1} 行：{2}",x.start+sourceOffset,x.end+sourceOffset,x.reason)));}if(!unknown.length)host.append(element('p',(current.warnings||[]).join('\n')));host.append(element('p',uiText("修复建议：对照原始文件检查括号、引号和缩进。Python 缩进决定语句属于哪个分支；缺少上下文时，软件不会擅自替你选择一种写法。")));}
}

$('mapTab').onclick=()=>setMode('map');$('mapSource').onclick=()=>document.body.classList.toggle('source-open');
