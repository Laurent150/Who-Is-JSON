// Format only. No source execution, semantic editing, or invented manuscript text.
class ProtocolError extends Error{constructor(kind,position=0){super(kind);this.kind=kind;this.position=position;}}
function unwrap(text){
 if(typeof text!=='string'||!text.trim()||text.length>200000)throw new ProtocolError('empty-or-large');
 let value=text.replace(/^\uFEFF/,'').trim(),normalizations=[];
 const fence=value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);if(fence){value=fence[1];normalizations.push('outer-code-fence');}
 return {value,normalizations};
}
function lex(text){
 const tokens=[];let i=0;
 while(i<text.length){
  if(/\s/.test(text[i])){i++;continue;}
  const start=i,c=text[i];
  if('{}[]:,'.includes(c)){tokens.push({type:c,start,end:++i});continue;}
  if(c==='"'){
   i++;let closed=false;
   while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i]==='"'){i++;closed=true;break;}i++;}
   if(!closed)throw new ProtocolError('unterminated-string',start);
   let value;try{value=JSON.parse(text.slice(start,i));}catch{throw new ProtocolError('invalid-string',start);}
   tokens.push({type:'string',value,start,end:i});
  }else{
   const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
   if(!m)throw new ProtocolError('invalid-token',i);
   i+=m[0].length;tokens.push({type:'literal',value:JSON.parse(m[0]),start,end:i});
  }
  if(tokens.length>20000)throw new ProtocolError('too-many-tokens',i);
 }
 return tokens;
}
function parseTokens(tokens){
 let index=0;
 const expect=type=>{const t=tokens[index];if(t?.type!==type)throw new ProtocolError('syntax',t?.start??-1);index++;return t;};
 function value(depth=0){
  if(depth>64)throw new ProtocolError('too-deep');
  const t=tokens[index];if(!t)throw new ProtocolError('incomplete',-1);
  if(t.type==='string'||t.type==='literal'){index++;return t.value;}
  if(t.type==='{'){
   index++;const object=Object.create(null),keys=new Set();
   if(tokens[index]?.type==='}'){index++;return object;}
   for(;;){
    const key=expect('string');if(keys.has(key.value))throw new ProtocolError('duplicate-key',key.start);keys.add(key.value);
    expect(':');object[key.value]=value(depth+1);
    if(tokens[index]?.type==='}'){index++;return object;}expect(',');
   }
  }
  if(t.type==='['){
   index++;const array=[];if(tokens[index]?.type===']'){index++;return array;}
   for(;;){array.push(value(depth+1));if(tokens[index]?.type===']'){index++;return array;}expect(',');}
  }
  throw new ProtocolError('syntax',t.start);
 }
 const result=value();if(index!==tokens.length)throw new ProtocolError('trailing-content',tokens[index].start);return result;
}
function schema(data){
 const obj=x=>x&&typeof x==='object'&&!Array.isArray(x),str=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
 const normalizations=[];
 // Empty, unrecognized metadata carries no manuscript content. Remove it
 // locally, but never coerce required fields or discard populated extras.
 const empty=x=>x===null||typeof x==='string'&&!x.trim()||Array.isArray(x)&&!x.length||obj(x)&&!Object.keys(x).length;
 const keys=(x,allowed)=>{
  if(!obj(x))return false;
  for(const key of Object.keys(x))if(!allowed.includes(key)){
   if(['__proto__','constructor','prototype'].includes(key)||!empty(x[key]))return false;
   delete x[key];normalizations.push('empty-extra-field');
  }
  return true;
 };
 if(!keys(data,['title','sections','questions'])||!str(data.title,150)||!Array.isArray(data.sections)||!data.sections.length||data.sections.length>60||data.sections.some(s=>!keys(s,['title','text'])||!str(s.title,150)||!str(s.text,12000)))throw new ProtocolError('schema');
 if(!Object.hasOwn(data,'questions')){data.questions=[];normalizations.push('missing-optional-questions');}
 if(!Array.isArray(data.questions)||data.questions.length>6||data.questions.some(q=>!keys(q,['question','answer'])||!str(q.question,300)||!str(q.answer,2000)))throw new ProtocolError('schema');
 return {response:data,normalizations};
}
function strict(text){return schema(parseTokens(lex(text)));}
function balanced(tokens){const stack=[];let roots=0;for(const t of tokens){if(t.type==='{'||t.type==='['){if(!stack.length&&++roots>1)return false;stack.push(t.type);}else if(t.type==='}'||t.type===']'){if(stack.pop()!==(t.type==='}'?'{':'['))return false;}}return !stack.length&&roots===1;}
// Container boundaries and all decoded literal values remain fixed. Only commas
// and colons can differ in a model repair; no rewriting or re-grouping sections.
function signature(tokens){return tokens.filter(t=>![':',','].includes(t.type)).map(t=>[t.type,...(Object.hasOwn(t,'value')?[t.value]:[])]);}
function inspect(text){
 let raw,tokens;
 try{raw=unwrap(text);tokens=lex(raw.value);}catch(e){return {ok:false,firstPassValid:false,repairEligible:false,errorKind:e.kind||'syntax'};}
 try{const parsed=strict(raw.value);return {...parsed,ok:true,firstPassValid:true,localRepairs:[],normalizations:[...raw.normalizations,...parsed.normalizations]};}
 catch(error){
  if(['schema','duplicate-key','too-deep','incomplete'].includes(error.kind))return {ok:false,firstPassValid:false,repairEligible:false,errorKind:error.kind};
  // Narrow historical fault: a complete root closes before the questions field.
  const trailing=raw.value.match(/,\s*"questions"\s*:\s*\[\s*\]\s*}\s*$/);
  if(trailing){
   const before=raw.value.slice(0,trailing.index).trimEnd();
   if(before.endsWith('}'))try{
    const base=parseTokens(lex(before));if(Object.hasOwn(base,'questions'))throw new ProtocolError('duplicate-key');schema(base);
    const candidate=before.slice(0,-1)+raw.value.slice(trailing.index),parsed=strict(candidate);
    return {...parsed,ok:true,firstPassValid:false,localRepairs:[{kind:'extra-root-closer-before-empty-questions',offset:before.length-1}],normalizations:[...raw.normalizations,...parsed.normalizations],repairedText:candidate};
   }catch{}
  }
  // Remove only commas immediately before a container closer, outside strings.
  const remove=tokens.filter((t,i)=>t.type===','&&[']','}'].includes(tokens[i+1]?.type)&&['string','literal',']','}'].includes(tokens[i-1]?.type)).map(t=>t.start);
  if(remove.length){let candidate=raw.value;for(const offset of remove.toReversed())candidate=candidate.slice(0,offset)+candidate.slice(offset+1);try{const parsed=strict(candidate);return {...parsed,ok:true,firstPassValid:false,localRepairs:remove.map(offset=>({kind:'trailing-comma',offset})),normalizations:[...raw.normalizations,...parsed.normalizations],repairedText:candidate};}catch{}}
  return {ok:false,firstPassValid:false,repairEligible:balanced(tokens)&&tokens[0]?.type==='{'&&tokens.at(-1)?.type==='}',errorKind:error.kind||'syntax',originalText:raw.value,signature:signature(tokens)};
 }
}
function acceptRepair(original,repaired){
 if(!original.repairEligible)throw new ProtocolError('repair-not-eligible');
 const text=unwrap(repaired).value,tokens=lex(text),data=strict(text);
 if(JSON.stringify(signature(tokens))!==JSON.stringify(original.signature))throw new ProtocolError('repair-changed-content-or-containers');
 return {...data,ok:true,firstPassValid:false,localRepairs:[],modelRepairAccepted:true,repairedText:text};
}
module.exports={inspect,acceptRepair};
