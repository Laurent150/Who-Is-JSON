// Transactional paragraph edits from the accepted comparison protocol.
function split(text){
 if(typeof text!=='string'||!text.trim())throw Error('Empty original explanation');
 const chunks=text.split(/(\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*)/);
 let number=0;
 return chunks.map((text,i)=>({text,id:i%2===0&&text.trim()?'p'+(++number):null}));
}
function catalog(text){return split(text).filter(p=>p.id).map(({id,text})=>({id,text}));}
function apply(draft,raw,wholeCard=false){
 if(typeof raw!=='string'||!raw.trim())throw Error('Empty review response');
 let cleaned=raw.trim();
 if(/^```(?:json)?\s*\n[\s\S]*\n```$/.test(cleaned))cleaned=cleaned.replace(/^```(?:json)?\s*\n/,'').replace(/\n```$/,'');
 let parsed;try{parsed=JSON.parse(cleaned);}catch{throw Error('Invalid review JSON');}
 if(!parsed||Array.isArray(parsed)||Object.keys(parsed).join()!=='corrections'||!Array.isArray(parsed.corrections))throw Error('Invalid review structure');
 const chunks=wholeCard?[{id:'p1',text:draft}]:split(draft),byId=new Map(chunks.filter(c=>c.id).map(c=>[c.id,c])),seen=new Set(),edits=[];
 for(const c of parsed.corrections){
  if(!c||Array.isArray(c)||Object.keys(c).sort().join()!=='id,reason,value')throw Error('Invalid correction fields');
  if(!byId.has(c.id)||seen.has(c.id))throw Error('Unknown or duplicate paragraph ID');
  if(typeof c.value!=='string'||!c.value.trim()||typeof c.reason!=='string'||!c.reason.trim())throw Error('Empty correction or reason');
  if(c.value.length>20000||c.reason.length>2000)throw Error('Correction exceeds protocol limit');
  seen.add(c.id);edits.push({id:c.id,before:byId.get(c.id).text,after:c.value,reason:c.reason});
 }
 const editsById=new Map(edits.map(e=>[e.id,e.after]));
 const answer=chunks.map(c=>editsById.has(c.id)?editsById.get(c.id):c.text).join('');
 if(!answer.trim())throw Error('Empty edited explanation');
 return {answer,edits,unchangedParagraphs:byId.size-edits.length,unchanged:answer===draft};
}

module.exports={split,catalog,apply};
