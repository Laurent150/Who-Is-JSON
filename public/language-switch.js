async function changeInterfaceLanguage(value){
 if(WhoI18n.normalize(value)===WhoI18n.locale)return;
 // Never reload: the editor, API key and account session live in this page.
 WhoI18n.set(value);revision++;analysisAbort?.abort();resetTalk();studioReset();studioSource=null;
 // Transient notices belong to the language in which they were created.
 $('toast').hidden=true;$('toast').textContent='';
 applyLanguageUI();formatSourceChanged();meta();connection();
 $('rehearse').textContent=uiText(document.body.classList.contains('rehearsing')?'退出专注 · Esc':'专注讲稿');
 // These UI nodes are replaced by dynamic actions, so their original text nodes may be detached.
 for(const id of ['scopeNotice','resultMode',...(!busy?['analyzeBtn','selectionBtn']:[])]){
  const node=$(id),text=node.textContent,key=Object.hasOwn(WhoEnglish,text)?text:Object.keys(WhoEnglish).find(k=>WhoEnglish[k]===text);
  if(key)node.textContent=uiText(key);
 }
 $('aiProgress').hidden=true;$('answer').hidden=true;
 if(current){
  const {aiOverview,aiOverviewError,...local}=current;
  current={...local,mode:'local',blocks:local.blocks.map(({aiExplanation,...block})=>block)};
  render();
 }
 if($('library').open)library();
 window.dispatchEvent(new Event('who-language-change'));
}
$('interfaceLanguage').onchange=e=>changeInterfaceLanguage(e.target.value);
$('accountLanguage').onchange=e=>changeInterfaceLanguage(e.target.value);
