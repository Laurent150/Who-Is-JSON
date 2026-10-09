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
 const contexts=new WeakMap();
 function citationEvidence(language,context){
  const scan=globalThis.WhoReading?.scan;if(!scan||!['Python','JavaScript','TypeScript'].includes(language)||!context||typeof context.source!=='string')return null;
  const previous=contexts.get(context);if(previous?.source===context.source&&previous.language===language)return previous;
  // This is visual source membership, never binding resolution or a type/behavior proof.
  const tokens=scan(context.source,language),names=new Set(),positions=new Map();let limit=context.source.length;
  for(let i=tokens.length-1;i>=0;i--){const token=tokens[i];if(['string','docstring','comment','opaque'].includes(token.kind)){limit=token.start;continue;}if(token.kind==='name')names.add(token.text);if(token.kind==='name'||token.kind==='symbol'&&['{','['].includes(token.text)){if(!positions.has(token.text))positions.set(token.text,[]);positions.get(token.text).push({start:token.start,end:limit});}}
  const evidence={source:context.source,language,names,positions};contexts.set(context,evidence);return evidence;
 }
 function sourceParts(value,evidence){
  const tokens=globalThis.WhoReading.scan(value,evidence.language).flatMap(token=>{
   if(token.kind!=='name')return [token];
   // Han prose may directly adjoin an ASCII source name; other Unicode identifier letters remain joined.
   return [...token.text.matchAll(/[\u3400-\u9fff]+|[^\u3400-\u9fff]+/gu)].map(match=>({...token,text:match[0],start:token.start+match.index,end:token.start+match.index+match[0].length}));
  }),parts=[];let cursor=0;
  const han=line=>/[\u3400-\u9fff]/u.test(line),ascii=name=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name),obvious=name=>/[_$]|[a-z][A-Z]/.test(name);
  for(let i=0;i<tokens.length;i++){
   const token=tokens[i];if(token.start<cursor||!(['name'].includes(token.kind)&&evidence.names.has(token.text)||token.kind==='symbol'&&['{','['].includes(token.text)))continue;
   let end=0;
   // Grow only at indexed source-token starts; matching never searches the entire source per fragment.
   let candidates=evidence.positions.get(token.text)||[],punctuation=token.kind==='symbol',hasName=token.kind==='name';
   for(let j=i+1;j<tokens.length&&j<i+80;j++){
    const next=tokens[j];if(['string','docstring','comment','opaque'].includes(next.kind)||/\r|\n/.test(next.text)||next.end-token.start>200)break;
    const fragment=value.slice(token.start,next.end);candidates=candidates.filter(pos=>pos.start+fragment.length<=pos.end&&evidence.source.startsWith(fragment,pos.start));if(!candidates.length)break;
    if(next.kind==='symbol'&&/[.([{:<>+=*/%-]/.test(next.text))punctuation=true;if(next.kind==='name'&&evidence.names.has(next.text))hasName=true;
    if(punctuation&&hasName&&(['name','number'].includes(next.kind)||[')',']','}'].includes(next.text)))end=next.end;
   }
   if(!end&&token.kind==='name'&&ascii(token.text)){
    const before=value.slice(0,token.start).trimEnd().slice(-1),after=value.slice(token.end).trimStart().slice(0,1);
    const chineseLabel=/^：\s*[\u3400-\u9fff]/u.test(value.slice(token.end));
    if(obvious(token.text)||han(before)||han(after)||chineseLabel||keywords.has(token.text)&&(before==='/'||after==='/'))end=token.end;
   }
   if(!end)continue;if(token.start>cursor)parts.push({kind:'text',text:value.slice(cursor,token.start)});parts.push({kind:'code',text:value.slice(token.start,end)});cursor=end;
  }
  if(cursor<value.length)parts.push({kind:'text',text:value.slice(cursor)});return parts;
 }
 function render(host,value,language,context){
  const doc=host.ownerDocument,fragment=doc.createDocumentFragment(),evidence=citationEvidence(language,context);
  for(const part of segments(value).flatMap(part=>part.kind==='text'&&evidence?sourceParts(part.text,evidence):[part])){
   if(part.kind==='text'){fragment.append(doc.createTextNode(part.text));continue;}
   const code=doc.createElement('code');code.className='point-code'+(part.kind==='block'?' point-code-block':'');
   const declared=({js:'JavaScript',javascript:'JavaScript',ts:'TypeScript',typescript:'TypeScript',py:'Python',python:'Python'})[part.language?.toLowerCase()];
   appendCode(code,part.text,part.language?(declared||''):language);fragment.append(code);
  }host.replaceChildren(fragment);return host;
 }
 function paragraph(value,language,context){return render(document.createElement('p'),value,language,context);}
 return {text,segments,render,paragraph};
});
