(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoSavedExplanations=api;})(globalThis,function(){
 function selection(source){
  const lines=source.fullSource.split('\n'),base=source.sourceStart||1,a=source.start-base,b=source.end-base;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<a||b>=lines.length)throw Error('Invalid saved source range');
  const from=source.startColumn??0,to=source.endColumn??lines[b].length;
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>lines[a].length||to<0||to>lines[b].length||(a===b&&to<from))throw Error('Invalid saved source columns');
  return {code:lines.slice(a,b+1).map((line,i)=>line.slice(i===0?from:0,i===b-a?to:line.length)).join('\n'),startColumn:from,endColumn:to};
 }
 async function create({answer,title,source,locale='zh-CN',readingMode='beginner',origin='ai'},cryptoApi=globalThis.crypto){
  if(typeof answer!=='string'||!answer.trim())throw Error('An explanation is required');
  const selected=selection(source),snapshot={...source,...selected,context:answer};
  // Content identity includes the exact source and location, not merely the selected word.
  const identity=JSON.stringify([source.file,source.language,source.fullSource,source.sourceStart||1,source.start,source.end,selected.startColumn,selected.endColumn,answer,locale,readingMode,origin]);
  const hash=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  const id='explanation.'+[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {id,savedAt:new Date().toISOString(),card:{id,title:(title||selected.code).trim().replace(/\s+/g,' ').slice(0,90)||'Code',plain:answer,naming:'',example:'',result:'',pitfall:'',language:source.language,origin,kind:'explanation',locale,readingMode},sources:[snapshot]};
 }
 function language(item){return item.sources?.find(s=>s.language)?.language||item.card?.language||item.language||'Unknown';}
 function matches(item,selectedLanguage,query=''){
  if(selectedLanguage&&language(item)!==selectedLanguage)return false;
  const c=item.card||item,q=query.trim().toLowerCase();
  return !q||[c.title,c.plain,c.purpose,...(item.sources||[]).map(s=>s.file+' '+s.code+' '+s.context)].join(' ').toLowerCase().includes(q);
 }
 const keywordCards={
  JavaScript:{function:'js.function',return:'js.return',const:'js.binding',let:'js.binding',if:'js.condition',else:'js.condition',for:'js.loop',while:'js.loop',typeof:'js.typeof'},
  Python:{def:'py.function',return:'py.return',for:'py.loop',while:'py.loop',if:'py.condition',elif:'py.condition',else:'py.condition',class:'py.class',try:'py.exception',except:'py.exception',finally:'py.exception',raise:'py.exception',with:'py.with',import:'py.import',from:'py.import',lambda:'py.lambda',assert:'py.assert',await:'py.await'},
  Java:{class:'java.class',return:'java.return',for:'java.loop',while:'java.loop',if:'java.condition',try:'java.exception',catch:'java.exception',finally:'java.exception',new:'java.new'}
 };
 function builtinIds({language,source,start,end,token,records=[],scan}){
  const map=keywordCards[language==='TypeScript'?'JavaScript':language];if(!map)return [];
  const lines=source.split('\n'),offsets=[0];for(const line of lines)offsets.push(offsets.at(-1)+line.length+1);
  const tokens=scan(source,language),ids=new Set();
  for(const t of tokens){
   if(t.kind!=='name'||!map[t.text])continue;
   const line=offsets.findIndex((n,i)=>i<lines.length&&n<=t.start&&offsets[i+1]>t.start)+1;
   if(line<start||line>end)continue;
   if(token&&(line!==token.line||t.start-offsets[line-1]!==token.startColumn||t.end-offsets[line-1]!==token.endColumn))continue;
   if(/\.\s*$/.test(source.slice(0,t.start))||(['JavaScript','TypeScript'].includes(language)&&/^\s*:/.test(source.slice(t.end))))continue;
   const id=map[t.text];
   // Require parser evidence at the occurrence; never guess from a custom name.
   if(records.some(r=>r.id===id&&r.start<=line&&r.end>=line&&!r.gap))ids.add(id);
  }
  return [...ids];
 }
 return {create,selection,language,matches,builtinIds};
});
