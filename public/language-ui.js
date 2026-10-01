// Static nodes are registered once, before app rendering. Never walk generated source,
// AI responses or saved cards to translate arbitrary text.
const languageStatic=[];
function registerLanguageUI(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('script,style,textarea,pre,code'))continue;
  const key=node.nodeValue.trim();
  if(Object.hasOwn(WhoEnglish,key))languageStatic.push({node,key,before:node.nodeValue,attribute:null});
 }
 for(const el of document.querySelectorAll('[title],[alt],[placeholder],[aria-label],[data-q]')){
  for(const attribute of ['title','alt','placeholder','aria-label','data-q']){
   const key=el.getAttribute(attribute);
   if(key&&Object.hasOwn(WhoEnglish,key))languageStatic.push({node:el,key,before:key,attribute});
  }
 }
 applyLanguageUI();
}
function applyLanguageUI(){
 document.documentElement.lang=WhoI18n.locale;
 document.title=WhoI18n.t('FIMI · 从功能读懂代码');
 for(const entry of languageStatic){
  const {node,key,attribute}=entry;
  if(!node.isConnected)continue;
  const previous=attribute?node.getAttribute(attribute):node.nodeValue;
  // A dynamic renderer has taken ownership of this node; do not overwrite it.
  if(previous!==entry.before)continue;
  const next=WhoI18n.t(key);
  if(attribute)node.setAttribute(attribute,next);else node.nodeValue=next;
  entry.before=next;
 }
 for(const id of ['interfaceLanguage','accountLanguage']){const select=document.getElementById(id);if(select)select.value=WhoI18n.locale;}
}
registerLanguageUI();
