(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoPointDisplay=api;})(globalThis,function(){
 // Parse explicit presentation markers only; ordinary quotes and source literals remain data.
 function inline(text){
  const parts=[];let plain='',i=0;const flush=()=>{if(plain){parts.push({kind:'text',text:plain});plain='';}};
  while(i<text.length){
   if(text[i]==='\\'&&text[i+1]==='`'){plain+=text.slice(i,i+2);i+=2;continue;}
   if(text[i]!=='`'){plain+=text[i++];continue;}
   let end=i;while(text[end]==='`')end++;const mark=text.slice(i,end);let close=end;
   while(close<text.length){if(text[close]==='\\'){close+=2;continue;}if(text[close]==='`'){let next=close;while(text[next]==='`')next++;if(next-close===mark.length)break;close=next;}else close++;}
   if(close>=text.length){plain+=mark;i=end;continue;}
   flush();parts.push({kind:'code',text:text.slice(end,close)});i=close+mark.length;
  }flush();return parts;
 }
 function segments(value){
  const lines=String(value).split(/(\r?\n)/),parts=[];let fence=null,code='';
  const flush=()=>{if(code){parts.push({kind:'block',text:code,language:fence?.language||''});code='';}};
  for(let i=0;i<lines.length;i+=2){const line=lines[i],newline=lines[i+1]||'',marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
   if(fence){if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim()){flush();fence=null;continue;}code+=line+newline;continue;}
   if(marker){fence={char:marker[1][0],length:marker[1].length,language:marker[2].trim()};continue;}
   parts.push(...inline(line));if(newline)parts.push({kind:'text',text:newline});
  }flush();return parts;
 }
 function text(value){return segments(value).map(part=>part.text).join('');}
 const keywords=new Set('if else elif def class return for in while try except finally raise with as import from async await function const let var new throw catch switch case break continue yield True False None true false null'.split(' '));
 function appendCode(host,value,language){
  // Reuse the source view's lexical classes, never evaluate fragments or infer their types.
  const scan=globalThis.WhoReading?.scan;if(!scan||!['Python','JavaScript','TypeScript'].includes(language)){host.textContent=value;return;}
  for(const token of scan(value,language)){
   const span=host.ownerDocument.createElement('span');span.textContent=token.text;span.className='token-'+(keywords.has(token.text)?'keyword':token.kind);host.append(span);
  }
 }
 function render(host,value,language){
  const doc=host.ownerDocument,fragment=doc.createDocumentFragment();
  for(const part of segments(value)){
   if(part.kind==='text'){fragment.append(doc.createTextNode(part.text));continue;}
   const code=doc.createElement('code');code.className='point-code'+(part.kind==='block'?' point-code-block':'');
   const declared=({js:'JavaScript',javascript:'JavaScript',ts:'TypeScript',typescript:'TypeScript',py:'Python',python:'Python'})[part.language?.toLowerCase()];
   appendCode(code,part.text,part.language?(declared||''):language);fragment.append(code);
  }host.replaceChildren(fragment);return host;
 }
 function paragraph(value,language){return render(document.createElement('p'),value,language);}
 return {text,segments,render,paragraph};
});
