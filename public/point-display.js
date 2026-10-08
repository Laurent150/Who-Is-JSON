(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoPointDisplay=api;})(globalThis,function(){
 function inline(text){
  let out='',i=0;
  while(i<text.length){
   if(text[i]==='\\'&&text[i+1]==='`'){out+=text.slice(i,i+2);i+=2;continue;}
   if(text[i]!=='`'){out+=text[i++];continue;}
   let end=i;while(text[end]==='`')end++;const mark=text.slice(i,end);let close=end;
   while(close<text.length){if(text[close]==='\\'){close+=2;continue;}if(text[close]==='`'){let next=close;while(text[next]==='`')next++;if(next-close===mark.length)break;close=next;}else close++;}
   if(close>=text.length){out+=mark;i=end;continue;}
   out+="'"+text.slice(end,close)+"'";i=close+mark.length;
  }
  return out;
 }
 function text(value){
  const lines=String(value).split(/(\r?\n)/);let fence=null,out='';
  for(let i=0;i<lines.length;i+=2){const line=lines[i],newline=lines[i+1]||'';
   const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
   if(fence){if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim()){fence=null;continue;}out+=line+newline;continue;}
   if(marker){fence={char:marker[1][0],length:marker[1].length};continue;}
   out+=inline(line)+newline;
  }
  return out;
 }
 return {text};
});
