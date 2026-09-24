const $=id=>document.getElementById(id);let current=null,selected=null,imageData=null,fileName='',revision=0,config={};let busy=false;let sourceOffset=0,analyzedSource="",presentation=null,activeMode="studio";
try{config=JSON.parse(localStorage.getItem('codelingo.config')||'{}');}catch{}config.key='';
const sample=`def calculate_total(prices, discount=0.9):\n    total = 0\n    for price in prices:\n        if price > 0:\n            total += price\n    return round(total * discount, 2)\n\ncart = [29, 49, 99]\nfinal_price = calculate_total(cart)\nprint(final_price)\n`;
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6000);}
async function api(route,data,method='POST',signal){const r=await fetch('/api/'+route,{signal:signal||AbortSignal.timeout(130000),method,headers:{'Content-Type':'application/json','X-CodeLingo-Token':window.APP_TOKEN},...(method==='POST'?{body:JSON.stringify({...data,readingMode})}:{})});const b=await r.json();if(!r.ok)throw Error(b.error||'操作未完成');return b;}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function meta(){const n=$('source').value.split('\n').length;$('numbers').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');$('sourceMeta').textContent=($('source').value?n:0)+' 行 · 原代码不会被执行';$('filename').textContent=fileName||'未命名片段';}
function invalidate(){resetTalk();studioReset();studioSource=null;analysisAbort?.abort();revision++;document.body.classList.remove('has-report');current=null;selected=null;presentation=null;$('scopeNotice').textContent='代码已变化，请重新生成。';$('results').hidden=true;$('empty').hidden=false;$('resultMode').textContent='等待分析';meta();if(typeof formatSourceChanged==='function')formatSourceChanged();}
function setCode(code,name){$('examples').value='';$('exampleSource').hidden=true;$('source').value=code;fileName=name||'';invalidate();}
function setImage(data,name){revision++;imageData=data;$('preview').src=data;$('imageBox').hidden=false;$('ocrNotice').textContent='内置英文与简体中文语言包。识别后请对照图片核对代码。';setCode('',name||'截图.png');toast('图片已导入。点击「识别代码」，核对后再开始讲解。');}
function settings(){for(const k of ['base','model','key'])$(k).value=config[k]||'';$('settings').showModal();}
function connected(){return !!(config.base&&config.model);}
function connection(){ $('connection').textContent=connected()?'● 已配置 AI':'● 本地模式';}
function ensureAI(){if(!connected()){settings();throw Error('请先连接 AI，或关闭「AI 深入讲解」使用本地模式。');}}
async function task(btn,fn){if(busy)return;busy=true;const old=btn.textContent;btn.disabled=true;btn.classList.add('busy');btn.textContent='正在处理…';const started=Date.now();const timer=setInterval(()=>{btn.textContent='正在处理 · '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);try{await fn();}catch(e){toast(e.message);}finally{clearInterval(timer);btn.textContent=old;btn.disabled=false;btn.classList.remove('busy');busy=false;}}
let analysisAbort=null;
async function run(selectionOnly=false){
 const full=$('source').value;let code=full,offset=0;
 if(selectionOnly){const start=$('source').selectionStart,end=$('source').selectionEnd;if(start===end)return toast('请先在代码框里选中要讲的内容。');const a=full.lastIndexOf('\n',start-1)+1;let z=full.indexOf('\n',end-1);if(z<0)z=full.length;code=full.slice(a,z);offset=full.slice(0,a).split('\n').length-1;}
 await task(selectionOnly?$('selectionBtn'):$('analyzeBtn'),async()=>{
  if(!code.trim())throw Error('先放入一段代码，或选择一个示例。');
  const ai=$('useAI').checked;if(ai)ensureAI();const rev=revision;
  const data=await api('analyze',{code,name:fileName,ai:false});
  if(rev!==revision)return;
  sourceOffset=offset;analyzedSource=code;current=data;updateFormatHint(data);
  $('scopeNotice').textContent=selectionOnly?`本次分析：原文件第 ${offset+1}—${offset+code.split('\n').length} 行（完整行）。`:'本次分析：整个文件。';render();
  const identifyLanguage=connected()&&data.needsLanguageHelp;
  $('aiProgress').hidden=!ai&&!identifyLanguage;if(!ai&&!identifyLanguage)return;
  const controller=new AbortController();analysisAbort=controller;
  $('cancelAnalysis').hidden=false;
  const started=Date.now();const update=()=>{$('aiProgressText').textContent=(identifyLanguage?'本地识别未确定，AI 正在辅助判断语言':'本地流程已就绪，可以先阅读。AI 正在补充用途说明')+' · 已等待 '+Math.floor((Date.now()-started)/1000)+' 秒';};update();const timer=setInterval(update,1000);
  try {
   const enhanced=await api('analyze',{code,name:fileName,ai,identifyLanguage,config},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(130000)]));
   if(rev!==revision)return;
   const focused=activeStructure?.block.start, selection=lineReadingSelection && {...lineReadingSelection}, step=flowReadingStep;
   const languageChanged=enhanced.language!==current.language||enhanced.languageIdentification?.status==='verified';
   current=enhanced;if(languageChanged){studioReset();studioSource=null;}render();updateFormatHint(enhanced);
   const item=WhoStructure.modules(current).find(x=>x.block.start===focused);
   if(item){openStructure(item,[...$('structureModules').querySelectorAll('.module-node')].find(x=>x.dataset.function===item.block.title));if(step)openFlowReading(step.node,item.block);}
   if(selection){flowReadingSync=true;try{selectReadingLines(selection.requestedStart,selection.requestedEnd);}finally{flowReadingSync=false;}}
   $('aiProgressText').textContent=[enhanced.languageIdentification?.message,enhanced.aiOverviewError?'AI 总览未完成：'+enhanced.aiOverviewError:ai?'AI 用途说明已完成；流程和源码位置仍来自本地解析。':''].filter(Boolean).join(' ');
  }catch(error){if(rev===revision)$('aiProgressText').textContent=controller.signal.aborted?'已停止 AI 补充，本地流程仍可阅读。':'AI 补充未完成：'+(error.name==='TimeoutError'?'等待超时，请稍后重试。':error.message)+' 本地流程仍可阅读。';}
  finally{clearInterval(timer);if(analysisAbort===controller)analysisAbort=null;$('cancelAnalysis').hidden=true;}
 });
}
$('cancelAnalysis').onclick=()=>analysisAbort?.abort();

function render(){
 selected=null;document.body.classList.add('has-report');document.body.classList.remove('source-open');$('empty').hidden=true;$('results').hidden=false;
 $('resultMode').textContent=current.mode==='ai'?'本地流程 + AI 说明':({ready:'已读取结构',partial:current.partialRecovery?'部分可读 · 已继续讲解':'仅部分解析',invalid:'解析未完成',unsupported:'暂不支持',empty:'等待输入'})[current.status]||'本地结构讲解';
 $('warnings').replaceChildren(...(current.warnings||[]).map(w=>element('div','· '+w)));$('answer').hidden=true;renderTalk();renderFormatGuide();$('inputNotes').hidden=!(current.warnings||[]).length&&$('formatGuide').hidden;resetFlowReading();renderStructure();renderLineReading();renderStudio();setMode(activeMode);
}
function showBlock(b,i){
 selected=b;openStructure({block:b,index:i},[...document.querySelectorAll('.module-node')].find(x=>x.dataset.function===b.title));
 const lines=$('source').value.split('\n');const start=lines.slice(0,b.start+sourceOffset-1).reduce((a,l)=>a+l.length+1,0);const end=start+lines.slice(b.start+sourceOffset-1,b.end+sourceOffset).join('\n').length;
 $('source').setSelectionRange(start,end);$('source').scrollTop=Math.max(0,(b.start+sourceOffset-3)*24);$('numbers').scrollTop=$('source').scrollTop;
}
function saved(){try{return JSON.parse(localStorage.getItem('codelingo.cards')||'[]');}catch{return [];}}
function saveCard(b){const cards=saved();cards.unshift({...b,start:b.start+sourceOffset,end:b.end+sourceOffset,id:Date.now(),language:current.language,name:fileName||'代码片段',saved:new Date().toLocaleString(),mode:current.mode});try{localStorage.setItem('codelingo.cards',JSON.stringify(cards.slice(0,60)));toast('已收藏到「我的功能卡」。');}catch{toast('本地存储空间不足，请导出或删除部分收藏。');}}
function download(name,text){const a=element('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function library(){const host=$('savedCards');host.replaceChildren();renderKnowledgeLibrary(host);host.append(element('h3','收藏的功能源码'));const cards=saved();if(!cards.length)host.append(element('p','还没有收藏。分析代码后，打开功能块即可收藏。'));cards.forEach(b=>{const card=element('div',undefined,'saved');card.append(element('strong',b.title),element('p',`${b.language} · ${b.name}\n${b.purpose}`));const exportBtn=element('button','导出学习卡');exportBtn.onclick=()=>download('Who Is JSON-学习卡.md',`# ${b.title}\n\n来源：${b.name}，第 ${b.start}—${b.end} 行\n模式：${b.mode}\n\n${b.purpose}\n\n## 用法\n${b.usage}\n\n## 依赖\n${b.dependencies}\n\n## 原代码\n\n\`\`\`\n${b.code}\n\`\`\`\n\n## 教学示例（未运行）\n${b.example||'无'}\n`);const del=element('button','删除');del.onclick=()=>{localStorage.setItem('codelingo.cards',JSON.stringify(saved().filter(x=>x.id!==b.id)));library();};card.append(exportBtn,del);host.append(card);});if(!$('library').open)$('library').showModal();}
async function loadFile(file){if(!file)return;if(file.size>8e6)return toast('请选择小于 8 MB 的文件。');if(file.type.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(file.name)){const reader=new FileReader();reader.onload=()=>setImage(reader.result,file.name);reader.readAsDataURL(file);}else{if(!WhoFileTypes.accepts(file.name))return toast('请选择源码文本或 PNG、JPG、WebP 图片。');if(file.size>100000)return toast('第一版最多分析 100 KB 源码。');removeImage();setCode(await file.text(),file.name);toast('文件已导入，点击「查看整段结构」。');}}
function removeImage(){imageData=null;$('imageBox').hidden=true;$('preview').removeAttribute('src');}
async function ask(q){if(!current)return toast('先分析一段代码。');if(current.mode!=='ai'&&!connected()){const b=selected||current.blocks[0];if(!b)return toast('当前没有可解释的模块，请补全代码或连接 AI。');$('answer').hidden=false;$('answer').textContent=`本地学习提示：${b.concept}\n\n${b.usage}\n\n连接 AI 后，可以结合你的实际代码回答「${q}」。`;return;}await task($('askBtn'),async()=>{ensureAI();const rev=revision;const r=await api('ask',{question:q,code:analyzedSource,config});if(rev!==revision)return;$('answer').hidden=false;$('answer').textContent=r.answer;});}
$('settingsBtn').onclick=settings;$('saveSettings').onclick=()=>{config={base:$('base').value.trim().replace(/\/$/,''),model:$('model').value.trim(),key:$('key').value.trim()};if(!connected())return toast('请填写基础地址和模型名称。');try{const u=new URL(config.base);if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error();}catch{return toast('请填写有效 HTTPS 地址，或本机 HTTP 地址。');}localStorage.setItem('codelingo.config',JSON.stringify({base:config.base,model:config.model}));connection();if(current){renderStudio();renderTalk();}$('settings').close();toast('已配置。下一次 AI 操作会发送内容到此服务；连接尚未验证。');};$('disconnect').onclick=()=>{config={};localStorage.removeItem('codelingo.config');connection();if(current){renderStudio();renderTalk();}$('settings').close();toast('已断开 AI 连接。');};
$('libraryBtn').onclick=library;$('knowledgeLibraryBtn').onclick=library;$('source').oninput=invalidate;$('source').addEventListener('paste',e=>{const t=e.currentTarget;if(e.clipboardData?.getData('text/plain')&&t.selectionStart===0&&t.selectionEnd===t.value.length){fileName='';meta();}});$('source').onscroll=()=>$('numbers').scrollTop=$('source').scrollTop;$('source').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,s=t.selectionStart,end=t.selectionEnd;t.value=t.value.slice(0,s)+'    '+t.value.slice(end);t.setSelectionRange(s+4,s+4);invalidate();}};
$('analyzeBtn').onclick=()=>run();$('selectionBtn').onclick=()=>run(true);$('clearBtn').onclick=()=>{removeImage();setCode('','');};const demo=()=>{removeImage();setCode(sample,'shopping_cart.py');run();};$('emptyDemo').onclick=demo;$('fileBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>{loadFile(e.target.files[0]).catch(e=>toast(e.message));e.target.value='';};$('removeImage').onclick=removeImage;
$('ocrBtn').onclick=()=>task($('ocrBtn'),async()=>{const ai=$('useAI').checked;if(ai)ensureAI();const rev=revision;const image=ai?imageData:await prepareOcrImage(imageData);if(rev!==revision)return;const r=await api('ocr',{image,ai,config});if(rev!==revision)return;$('ocrNotice').textContent=[r.method,...(r.warnings||['请核对缩进与符号。'])].join('；');setCode(r.code,fileName.replace(/\.[^.]+$/,'')+'.txt');toast('已提取代码，请对照原图核对后再分析。');});
$('captureBtn').onclick=()=>task($('captureBtn'),async()=>{toast('拖动选择代码区域；按 Esc 取消。');const r=await api('capture');if(!r.cancelled)setImage(r.image,'截图.png');});$('widgetBtn').onclick=()=>task($('widgetBtn'),async()=>{await api('widget');toast('悬浮入口已打开，可截图或拖入文件。');});$('quitBtn').onclick=async()=>{try{await api('quit');document.body.replaceChildren(element('p','Who Is JSON 已退出。可以关闭页面；下次双击「启动 Who Is JSON.vbs」重新打开。'));}catch(e){toast(e.message);}};
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ask(b.dataset.q));$('askBtn').onclick=()=>{const q=$('question').value.trim();if(q)ask(q);else toast('写下你想了解或修改的地方。');};$('question').onkeydown=e=>{if(e.key==='Enter')$('askBtn').click();};
let drag=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();drag++;$('dropHint').hidden=false;}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',()=>{if(--drag<=0)$('dropHint').hidden=true;});document.addEventListener('drop',e=>{e.preventDefault();drag=0;$('dropHint').hidden=true;loadFile(e.dataTransfer.files[0]).catch(e=>toast(e.message));});document.addEventListener('paste',e=>{const item=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(item){e.preventDefault();loadFile(item.getAsFile());}});
setInterval(async()=>{if(busy)return;try{const b=await api('inbox',null,'GET');if(b){if(b.image)setImage(b.image,b.name);else{removeImage();setCode(b.code,b.name);toast('已接收悬浮窗拖入的文件。');}window.focus();}}catch{}},1400);connection();meta();

function renderSymbols(host,symbols){
 if(!Array.isArray(symbols)||!symbols.length)return;
 const section=element('section',undefined,'name-guide');
 section.append(element('h4','这些名字是谁起的？'),element('p','点开一个名字，看看它是什么、能不能改名。','tiny'));
 for(const item of symbols){
  const row=element('details',undefined,'name-item');
  const label=element('summary');label.append(element('code',item.name),element('span',item.origin,'name-origin'));
  row.append(label,element('p',item.meaning),element('p',item.rename,'rename-note'));
  if(item.example)row.append(element('p','例如：'+item.example,'name-example'));
  section.append(row);
 }
 host.append(section);
}

let exampleList=[];
api('examples',null,'GET').then(list=>{exampleList=list;for(const [i,x]of list.entries()){const opt=element('option',x.name);opt.value=String(i);$('examples').append(opt);}}).catch(()=>{});
$('examples').onchange=()=>{if($('examples').value==='')return;const x=exampleList[Number($('examples').value)];if(!x)return;removeImage();setCode(x.code,x.name);$('exampleSource').href=x.source;$('exampleSource').hidden=false;run();};
function setMode(mode){mode=mode==='learn'?'map':mode;activeMode=mode;document.body.classList.toggle('line-mode',mode==='line'||mode==='map'||mode==='studio');for(const [key,panel,tab]of [['studio','studioPanel','studioTab'],['line','linePanel','lineTab'],['map','mapPanel','mapTab'],['talk','talkPanel','talkTab']]){$(panel).hidden=mode!==key;$(tab).setAttribute('aria-pressed',String(mode===key));}layoutFlowReading();closeStudioToken();}

function renderTalk(){
 presentation=talkDraft();
 $('talkNote').textContent=presentation.note;$('parseIssues').hidden=!(presentation.diagnostics||[]).length;$('parseIssueText').textContent=(presentation.diagnostics||[]).join('\n');$('speechToc').replaceChildren();$('talkScope').textContent=$('scopeNotice').textContent;$('speech').replaceChildren();$('talkQuestions').replaceChildren();
 const blocked=!presentation.sections.length;const fixable=false;$('recovery').hidden=!fixable;$('qaHeading').hidden=blocked;$('talkQuestions').hidden=blocked;$('speechToc').hidden=blocked;$('parseIssues').open=false;if(fixable){const issues=presentation.diagnostics||[];const issue=issues.find(x=>/第\s*\d+\s*行/.test(x));$('firstIssue').textContent=issue?'解析器首先报告：'+issue+(sourceOffset?'（上面的行号相对于选区；定位按钮会跳回原文件。）':''):'检测到了代码围栏等复制格式，它们可能被误当成代码。先预览清理，再重新解析。';}$('exportTalk').disabled=blocked;$('rehearse').disabled=!presentation.sections.length;
 presentation.sections.forEach((s,i)=>{const card=element('article',undefined,'speech-card');card.id='speech-'+i;const link=element('button',s.title);link.onclick=()=>card.scrollIntoView({behavior:'smooth',block:'start'});$('speechToc').append(link);card.append(element('div',`${String(i+1).padStart(2,'0')} / ${s.evidence}`,'speech-kicker'),element('h3',s.title),element('p',s.text));
 if(s.index!==null){const row=element('div',undefined,'speech-actions');const locate=element('button',`对照第 ${s.start}—${s.end} 行`);locate.onclick=()=>{document.body.classList.add('source-open');showBlock(current.blocks[s.index],s.index);document.querySelectorAll('.speech-card').forEach(x=>x.classList.remove('active'));card.classList.add('active');};const learn=element('button','这部分我还不懂 ↗');learn.onclick=()=>{setMode('learn');showBlock(current.blocks[s.index],s.index);$('nodeStudy').scrollIntoView({behavior:'smooth',block:'nearest'});};row.append(locate,learn);card.append(row);} $('speech').append(card);});
 if(!presentation.sections.length)$('speech').append(element('p',presentation.title));
 presentation.questions.forEach(q=>{const d=element('details',undefined,'qa-item');d.append(element('summary',q.question),element('p',q.answer));$('talkQuestions').append(d);});
}
$('talkTab').onclick=()=>setMode('talk');
$('sourceToggle').onclick=()=>document.body.classList.toggle('source-open');
for(const id of ['duration','audience','coverage'])$(id).onchange=()=>{if(current)renderTalk();};
$('exportTalk').onclick=()=>{if(presentation)download('Who-Is-JSON-讲解稿.md',WhoPresentation.markdown(presentation));};
$('rehearse').onclick=()=>{document.body.classList.toggle('rehearsing');$('rehearse').textContent=document.body.classList.contains('rehearsing')?'退出专注 · Esc':'专注讲稿';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('rehearsing');$('rehearse').textContent='专注讲稿';}});

function locateProblem(){document.body.classList.add('source-open');const issue=(presentation?.diagnostics||[]).find(x=>/第\s*\d+\s*行/.test(x));const relative=Number(issue?.match(/第\s*(\d+)\s*行/)?.[1]||1);const line=relative+sourceOffset;const lines=$('source').value.split('\n');const start=lines.slice(0,line-1).reduce((n,l)=>n+l.length+1,0);$('source').focus({preventScroll:true});$('source').setSelectionRange(start,start+(lines[line-1]||'').length);$('source').scrollTop=Math.max(0,(line-3)*24);$('numbers').scrollTop=$('source').scrollTop;$('source').scrollIntoView({behavior:'smooth',block:'nearest'});}
$('locateIssue').onclick=locateProblem;
$('replaceSource').onclick=()=>$('fileInput').click();
$('repairFormat').onclick=()=>previewCleanup();

function renderFormatGuide(){
 const host=$('formatGuide');host.replaceChildren();const changes=current.formatChanges||[],unknown=current.unexplained||[];host.hidden=!changes.length&&!current.syntaxErrors;if(host.hidden)return;
 host.append(element('h3','原文、格式处理与未读懂的部分'));
 host.append(element('p','分析不会覆盖你的原文。下面的“处理后”只去除明确的展示格式，不代表已经修复所有语法或验证运行。'));
 for(const c of changes)host.append(element('p','✓ '+c));
 if(changes.length){const details=element('details');details.append(element('summary','逐行对照自动处理的格式'));const rows=element('div',undefined,'format-diff');const before=analyzedSource.split('\n'),after=(current.normalizedCode||analyzedSource).split('\n');before.forEach((line,i)=>{if(line===after[i])return;const row=element('div',undefined,'format-row');row.append(element('strong',`原文件第 ${i+1+sourceOffset} 行`),element('small','原文'),codeView(line,{start:i+1+sourceOffset}),element('small','处理后'),codeView(after[i]||'',{start:i+1+sourceOffset}));rows.append(row);});details.append(rows);host.append(details);const preview=element('details');preview.append(element('summary','查看用于解析的完整文本'),codeView(current.normalizedCode,{start:1+sourceOffset}));host.append(preview);}
 if(current.syntaxErrors){host.append(element('h4',current.partialRecovery?'这些区域未纳入讲稿':'当前没有足够完整的结构可讲解'));for(const x of unknown){host.append(element('p',`第 ${x.start+sourceOffset}—${x.end+sourceOffset} 行：${x.reason}`));}if(!unknown.length)host.append(element('p',(current.warnings||[]).join('\n')));host.append(element('p','修复建议：对照原始文件检查括号、引号和缩进。Python 缩进决定语句属于哪个分支；缺少上下文时，软件不会擅自替你选择一种写法。'));}
}

$('mapTab').onclick=()=>setMode('map');$('mapSource').onclick=()=>document.body.classList.toggle('source-open');
