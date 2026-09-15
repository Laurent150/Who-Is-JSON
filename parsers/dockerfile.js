const {read,operands}=require('./dockerfile-reader');
const {explain}=require('../explanation/dockerfile-guide');
const {result}=require('./common');
function dockerfile(code) {
  const records=read(code),lines=code.split('\n'),blocks=[],warnings=[];
  let stage;
  const begin=(r,title)=>{
    const block={kind:'module',title,role:'build-stage',start:r.start,end:r.end,code:'',purpose:'按下面的指令准备运行环境，并登记启动时使用的设置。',controlFlow:[],learning:[],symbols:[],
      flowPresentation:{legend:'向下阅读制作说明。RUN 在制作时执行；CMD / ENTRYPOINT 仅登记以后启动时的设置。缓存可能复用已完成的制作步骤。',entry:'开始读取这个制作阶段',exit:'阶段说明结束；这不表示服务已经启动'},
    };
    blocks.push(block);return block;
  };
  for(const r of records) {
    if(!r.args || r.instruction==='FROM'&&!/^(?:--platform=\S+\s+)?[^\s]+(?:\s+AS\s+[\w.-]+)?$/i.test(r.args))warnings.push(`第 ${r.start} 行：缺少参数或 FROM 结构不完整。`);
    if(['CMD','ENTRYPOINT'].includes(r.instruction)&&r.args.startsWith('[')&&!operands(r.args))warnings.push(`第 ${r.start} 行：启动参数的 JSON 列表不完整。`);
    if(r.instruction==='FROM')stage=begin(r,'制作阶段 '+(blocks.filter(b=>b.role==='build-stage').length+1)+(r.args.match(/\s+AS\s+([\w.-]+)$/i)?.[1]?' · '+r.args.match(/\s+AS\s+([\w.-]+)$/i)[1]:''));
    if(!stage){stage=begin(r,'制作前的参数或文件片段');stage.role='build-preamble';}
    const guide=explain(r),span={start:r.start,end:r.end,startColumn:r.startColumn,endColumn:r.endColumn};
    const node={...span,kind:guide.gap&&!r.known?'unknown':['CMD','ENTRYPOINT'].includes(r.instruction)?'startup':'build',label:guide.title,guide,instruction:r.instruction};
    const earlier=stage.controlFlow.filter(x=>x.instruction===r.instruction);
    if(['CMD','ENTRYPOINT'].includes(r.instruction)&&earlier.length)for(const n of earlier)n.guide.purpose+=' 同一阶段后面又出现了 '+r.instruction+'，这条旧设置会被后面的覆盖。';
    stage.controlFlow.push(node);stage.end=r.end;
    const add=(id,context,extra={})=>stage.learning.push({id:'docker.'+id,...span,context,...extra});
    if(['FROM','RUN','COPY','WORKDIR','EXPOSE','CMD','ENTRYPOINT','ARG','ENV'].includes(r.instruction))add(r.instruction.toLowerCase(),guide.purpose);
    if(r.continued&&!r.heredoc)add('continuation','一条制作指令写在多行中；这些行一起解释，不是几个独立步骤。');
    for(const id of guide.extraKnowledge||[])add(id,guide.why);
    for(const c of r.comments){
      if(c.directive)stage.learning.push({id:'gap.docker.directive',...c,gap:true,label:'构建前端与解析指令',context:'这行会影响 Docker 的解析方式或前端版本；本地只支持有限续行规则，不确认所有前端扩展。'});
      else stage.learning.push({id:'docker.comment',...c,context:'作者写下的说明：'+c.text+'。这是注释，不是已验证的执行结果。'});
    }
    if(r.comments.length)node.guide.authorNotes=r.comments.filter(c=>!c.directive).map(c=>c.text);
    if(guide.gap)stage.learning.push({id:'gap.docker.'+r.instruction,...span,gap:true,label:r.instruction+' 尚未确认的内容',context:guide.note||guide.purpose});
    if(r.dangling||!r.known)warnings.push(`第 ${r.start} 行：${r.dangling?'续行或多行内容没有结束':'指令未识别'}。`);
    if(r.limited)warnings.push('只读取前 200 条指令，请缩小片段查看剩余内容。');
    stage.symbols.push({name:r.instruction,origin:'Dockerfile 固定指令',meaning:guide.purpose,rename:'这是工具规定的指令名，不能任意改名。'});
  }
  for(const b of blocks){b.code=lines.slice(b.start-1,b.end).join('\n');const names=new Set();b.symbols=b.symbols.filter(s=>!names.has(s.name)&&names.add(s.name));}
  const stages=records.filter(r=>r.instruction==='FROM').length;
  if(!stages&&records.length)warnings.push('没有看到 FROM，当前按片段展示，不能确认基础环境。');
  const first=records.find(r=>r.instruction==='FROM');
  const purpose=`这是一份制作容器镜像的说明：可以把镜像理解为打包好的运行环境。${first?'从 '+first.args+' 开始。':''}当前看到 ${stages} 个 FROM 制作阶段；先准备环境和文件，再保存以后启动容器时使用的设置。`;
  const out=result('Dockerfile','Dockerfile 逻辑指令读取（有限支持）','Docker 镜像制作说明',purpose,blocks,warnings,warnings.length?'partial':records.length?'ready':'empty');
  out.documentKind='build';out.navigationNote='按 FROM 分组查看制作阶段；COPY --from 取文件不等于新建阶段。启动命令与制作命令分开解释。';
  out.guide={title:'先准备运行环境，再规定怎样启动',purpose,basis:'依据 Dockerfile 指令。中文注释保留为作者说明，不参与语言判断，也不作为执行结果。',limits:['没有调用 Docker、执行 RUN 命令或验证服务启动。','RUN 内部命令、项目依赖、基础镜像继承设置以及扩展语法仍需核对。'],reference:'https://docs.docker.com/reference/dockerfile/'};
  return out;
}
module.exports={dockerfile};
