(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoPresentation=api;})(this,function(){
 const clean=v=>typeof v==='string'?v.trim():'';
 function build(result,{duration='180',audience='peer',offset=0,name='代码片段',coverage='full'}={}){
  const max=duration==='30'?2:duration==='300'?8:5;
  const all=Array.isArray(result.blocks)?result.blocks:[];
  const named=all.filter(b=>b.kind==='function'&&b.reusable===true);
  const roots=all.filter(b=>!all.some(p=>p!==b&&p.start<=b.start&&p.end>=b.end&&(p.start<b.start||p.end>b.end)));
  const main=named.length?[...new Set([...roots.filter(b=>b.kind!=='function'),...named])].sort((a,b)=>a.start-b.start):roots;
  const candidates=main.length?main:all;
  const chosen=coverage==='full'?candidates:candidates.slice(0,max);
  const label=audience==='nontechnical'?'非技术听众':audience==='review'?'代码评审':'同事交流';
  const sections=[];
  if((result.syntaxErrors&&!result.partialRecovery)||result.inputFormatIssue)return {title:'代码尚未完整读通，先修复复制或语法问题',sections:[],questions:[],diagnostics:result.warnings||[],name,note:'已暂停生成讲解稿，避免把错误解析拼成正式说明。请优先拖入原始 .js 文件；若复制了代码围栏或转义符，可先点“清理复制格式”核对预览。已有语法问题不会被自动猜测修复。'};
  if(!chosen.length)return {title:'暂时还不能生成可靠的讲解稿',sections:[],questions:[],note:'没有读到可对应源码的模块。请补全片段、选择语言明确的文件，或配置 AI 后重试。',name};
  sections.push({title:'先说明这份代码',text:`我这次说明的是 ${name}${offset?` 中从第 ${offset+1} 行开始选取的片段`:''}。${result.mode==='ai'?clean(result.aiOverview?.summary||result.purpose):'我会重点介绍'+chosen.map(b=>'「'+clean(b.title)+'」').join('、')+'，说明它们处理的内容和结果。'}\n下面按源码中的组织顺序展开；这个顺序不等于实际调用顺序。`,evidence:'范围说明',index:null});
  chosen.forEach((b,i)=>{
   const children=all.filter(c=>c!==b&&c.start>=b.start&&c.end<=b.end);
   let text=`${i===0?'先看':'接着看'}「${clean(b.title)}」。${clean(b.aiExplanation?.purpose)||clean(b.flow)||clean(b.purpose)||'这部分的具体作用仍需要补充上下文。'}`;
   if(!b.aiExplanation&&!b.flow&&children.length)text+='\n其中可以看到：'+children.slice(0,duration==='30'?1:3).map(c=>clean(c.purpose)).join('\n');
   if(b.aiExplanation && duration!=='30'){
    if(b.aiExplanation.example)text+='\n'+b.aiExplanation.example;
    for(const term of b.aiExplanation.terms||[])text+='\n'+term.name+'：'+term.meaning;
   }else if(duration!=='30'){
    if(clean(b.inputs))text+=`\n它接收的内容是：${clean(b.inputs)}`;
    if(!b.flow&&clean(b.output))text+=`\n这一部分的结果：${clean(b.output)}`;
    if(audience==='review'&&clean(b.dependencies))text+=`\n需要一起确认的是：${clean(b.dependencies)}`;
    if(audience==='nontechnical'&&clean(b.concept))text+=`\n换个角度理解：${clean(b.concept)}`;
   }
   sections.push({title:clean(b.title),text,evidence:b.aiExplanation?'AI 解读 · 待核对':'本地规则解读',index:all.indexOf(b),start:b.start+offset,end:b.end+offset});
  });
  sections.push({title:'最后交代范围',text:`${result.partialRecovery?"原文件仍有未读通部分，下面的说明不能代表整份代码。":""}以上覆盖了${chosen.length}个主要部分。${chosen.length<main.length?`还有 ${main.length-chosen.length} 个部分没有在这份简稿中展开。`:''}这次没有执行代码，也没有检查整个项目，因此实际运行结果、外部依赖和作者的设计动机还需要进一步核对。`,evidence:'已知边界',index:null});
  const questions=chosen.slice(0,duration==='30'?1:4).map(b=>({question:`为什么需要「${clean(b.title)}」？`,answer:`从当前片段可以说明它的作用：${clean(b.aiExplanation?.purpose||b.purpose)}\n这说明了代码在做什么，但不能据此确认作者为什么选择它，而没有选择其他写法。`,index:all.indexOf(b)}));
  questions.push({question:'这段代码已经验证能正常运行了吗？',answer:'这里进行了结构读取和解释，没有执行程序。要确认运行结果，需要项目依赖、调用方式和实际测试。',index:null});
  return {title:`${name} · 讲解稿`,sections,questions,name,diagnostics:result.warnings||[],note:`${result.partialRecovery?"部分可读：只讲解独立解析通过的结构；其他部分未纳入，跨片段依赖未验证。":""}${label} · ${coverage==='full'?`完整覆盖已识别的 ${chosen.length} 个主要功能/结构`:`重点提纲：${chosen.length} / ${candidates.length} 个主要功能/结构`} · ${duration==='30'?'简洁表达':duration==='300'?'详细展开':'标准说明'}。${coverage==='full'?'完整覆盖优先，不保证符合所选时长。':''}${result.mode==='ai'?'依据 AI 分析整理，需核对。':'本地规则只描述可识别操作，尚不能代替完整业务解读。'}`};
 }
 function markdown(p){return `# ${p.title}\n\n${p.note}\n\n${(p.diagnostics||[]).length?"解析提示："+p.diagnostics.join("；")+"\n\n":""}`+p.sections.map(s=>`## ${s.title}\n\n${s.text}\n\n${s.start?`源码：第 ${s.start}—${s.end} 行 · `:''}${s.evidence}`).join('\n\n')+'\n\n## 可能被追问\n\n'+p.questions.map(q=>`### ${q.question}\n\n${q.answer}`).join('\n\n');}
 return {build,markdown};
});
