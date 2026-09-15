const {operands}=require('../parsers/dockerfile-reader');
function explain(record) {
  const {instruction:op,args}=record;
  const flags=[],rest=args.replace(/^(?:--[\w-]+(?:=[^\s]+)?\s+)+/,s=>{flags.push(...s.trim().split(/\s+/));return '';});
  const parts=operands(rest),short=s=>s.length>100?s.slice(0,97)+'…':s;
  const g=(title,purpose,why='',extra={})=>({title,purpose,why,basis:'根据 Dockerfile 指令；没有制作镜像或启动容器。',limits:[],...extra});
  if(record.heredoc||record.dangling||!record.known) return g('这部分需要单独核对',record.dangling?'这里的续行或多行内容尚未结束，暂不推断它的完整作用。':record.heredoc?'这里使用了多行脚本。已保留完整范围，内部语法与行为尚未展开。':'没有识别这条指令；请核对拼写或使用的 Dockerfile 扩展。','',{gap:true});
  if(op==='FROM')return g('选择现成的运行环境作为起点',`以 ${short(parts?.[0]||rest)} 为基础，开始一个制作阶段。镜像可以理解为已经准备好的系统与工具包。`,'复用已有环境，再添加项目需要的东西。');
  if(op==='WORKDIR')return g('设置后续操作所在的文件夹',`把 ${short(rest)} 设为当前工作文件夹。后面的相对路径会以它为参照；不存在时会创建。`,'让复制文件和运行程序使用一致的位置。',{example:'例如 WORKDIR /app 后，COPY . . 的目标是当前的 /app 文件夹。'});
  if(op==='COPY'||op==='ADD') {
    if(!parts||parts.length<2)return g('复制参数需要核对','没有完整读到来源和目标，暂不推断复制效果。','',{gap:true});
    const from=flags.find(f=>f.startsWith('--from='));
    const source=parts.slice(0,-1).join('、'),target=parts.at(-1);
    return g(from?'从另一个镜像或阶段取文件':'把项目文件放进运行环境',
      `把 ${short(source)} 复制到 ${short(target)}。${from?'来源由 '+short(from.slice(7))+' 指定，可能是镜像、已命名阶段或构建上下文。':'来源来自本次提交给 Docker 的构建目录，实际可用文件还受 .dockerignore 影响。'}`,
      '让制作出的环境里包含所需工具、依赖清单或项目文件。',
      {extraKnowledge:from?['copy-from']:[],gap:op==='ADD',note:op==='ADD'?'ADD 还涉及远程下载与自动解包规则，尚未展开。':''});
  }
  if(op==='RUN') {
    let purpose='制作镜像时执行这里的命令，完成当前这一步准备工作。里面各个工具的具体行为仍要结合命令或项目文件。',title='制作环境时，执行一组准备命令';
    if(/^uv\s+sync(?:\s+--[\w-]+)*$/.test(rest)) {
      const words=rest.split(/\s+/);
      title=words.includes('--no-install-project')?'先准备依赖，暂不安装项目本身':'同步项目需要的运行环境';
      purpose='使用 uv 这个 Python 项目管理工具，按项目配置同步依赖。'+(words.includes('--no-install-project')?'此处明确跳过项目本身的安装。':'是否及如何安装项目本身，还取决于项目的打包配置。')+(words.includes('--locked')?'--locked 要求锁文件保持一致；过期时会报错，而不是自动改写。':'');
    }
    const cache=flags.some(f=>/^--mount=type=cache(?:,|$)/.test(f));
    return g(title,purpose,cache?'临时复用下载缓存，减少重复下载；缓存不是最终镜像中的依赖安装位置。':'将准备操作写进制作说明，方便按相同指令重新准备环境。',
      {extraKnowledge:cache?['cache']:[],gap:true,note:'未验证命令内部行为、项目依赖或执行成功；注释提到的安装位置不能作为事实。'});
  }
  if(op==='EXPOSE')return g('说明程序预期使用的端口',`这里登记 ${short(rest)} 作为端口信息，相当于写下“程序打算在哪个门口接收连接”。它不会启动程序，也不会自动把端口开放到宿主机。`,'让使用镜像的人了解预期端口。',{example:'EXPOSE 8000 只是说明；通常仍要在启动容器时设置端口映射，例如 -p 8000:8000。'});
  if(['CMD','ENTRYPOINT'].includes(op)) {
    const json=rest.startsWith('[');
    if(json&&!parts)return g('启动参数需要核对','方括号内应是合法的 JSON 文字列表；当前没有完整读通。','',{gap:true});
    return g(op==='CMD'?'记下容器启动时的默认命令':'指定容器启动时使用的程序',
      `这一步只登记启动设置，制作镜像时不会因此运行服务。${json?'列表中的每一项是一个独立参数，不会自动按 Shell 展开。':'这里使用命令文字形式，具体执行还受 Shell 与其他启动设置影响。'}${op==='CMD'?'默认命令可被启动参数覆盖，也可能与继承的 ENTRYPOINT 组合。':''}`,
      '把“准备环境”和“使用环境启动程序”分开。',
      {decoded:json?parts.map((x,i)=>`${i+1}. ${x}`).join('\n'):rest,decodedLabel:'启动参数 · 逐项展示，不会执行',gap:true,note:'未读取应用入口或基础镜像的 ENTRYPOINT，尚未确认服务行为和启动成功。'});
  }
  if(op==='ARG')return g('提供制作时可传入的设置',`声明制作参数 ${short(rest)}。实际值可能由构建命令传入；它不自动成为运行容器时的环境变量。`);
  if(op==='ENV')return g('保存后续可使用的环境设置',`设置 ${short(rest)}。后续指令和由此镜像启动的容器可使用这些值，具体效果取决于读取它的程序。`);
  return g('登记 '+op+' 指令','识别了这条 Dockerfile 指令，但它的具体规则尚未提供专门解释。请查看原文及缺口。','',{gap:true});
}
module.exports={explain};
