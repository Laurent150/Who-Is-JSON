// A new menu belongs to the currently rendered walkthrough, never a stale draft.
function walkthroughExport(p){
 const host=element('div',undefined,'walkthrough-export');
 const trigger=element('button',undefined,'walkthrough-export-trigger');trigger.id='exportTalk';trigger.type='button';
 trigger.append(element('span',uiText('导出讲解稿')),element('span',undefined,'export-chevron'));
 trigger.lastChild.setAttribute('aria-hidden','true');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','walkthroughExportMenu');
 const menu=element('div',undefined,'walkthrough-export-menu');menu.id='walkthroughExportMenu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-labelledby','exportTalk');
 const close=(focus=false)=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();};
 const open=(last=false)=>{menu.hidden=false;trigger.setAttribute('aria-expanded','true');(last?menu.lastChild:menu.firstChild).focus();};
 for(const [format,label] of [['docx','Word 文档（.docx）'],['md','Markdown（.md）']]){
  const button=element('button',uiText(label));button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.dataset.format=format;
  button.onclick=()=>{close(true);try{
   if(format==='docx')download(uiText('FIMI-讲解稿.docx'),WhoWalkthroughDocx.create(p,WhoI18n.locale),WhoWalkthroughDocx.mime);
   else download(uiText('Who-Is-JSON-讲解稿.md'),WhoPresentation.markdown(p));
  }catch(error){toast(uiError(error));}};menu.append(button);
 }
 trigger.onclick=()=>menu.hidden?open():close();
 trigger.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open(e.key==='ArrowUp');}};
 host.onkeydown=e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
  else if(!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&e.target!==trigger){e.preventDefault();const items=[...menu.children],index=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}
  else if(e.key==='Tab')close();
 };
 host.onfocusout=e=>{if(!host.contains(e.relatedTarget))close();};
 host.append(trigger,menu);return host;
}
document.addEventListener('pointerdown',e=>{const menu=document.getElementById('walkthroughExportMenu');if(menu&&!menu.parentElement.contains(e.target)){menu.hidden=true;document.getElementById('exportTalk')?.setAttribute('aria-expanded','false');}});
