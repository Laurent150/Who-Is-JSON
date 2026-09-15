(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.WhoDockerfileCards=factory;})(this,function(card){
  const add=(id,title,plain,example,result,pitfall)=>card('docker.'+id,'Dockerfile',title,plain,'指令名是 Dockerfile 规定的写法；镜像、文件路径和阶段别名由项目选择或命名。',example,result,pitfall,'',null);
  add('comment','中文注释是给人看的说明','# 开头的普通注释不会作为制作命令执行。中文和英文注释遵守同样规则。','# 中文说明\nFROM alpine:3.20','这里只有一条制作指令：FROM。','注释可能过时；“已安装成功”之类说法不能当作运行证据。# syntax 等位于文件头的解析指令另有作用。');
  add('from','选一个已有环境作为起点','FROM 开始一个制作阶段，可以给它起别名，供后面引用。','FROM python:3.12-slim AS base','从这个 Python 镜像开始，阶段别名是 base。','只有一个 FROM 就是一个阶段；AS builder 这个名字不自动产生多阶段构建。');
  add('run','制作时执行命令','RUN 在制作镜像时运行准备命令；后面的命令成功与否要由真实构建确认。','FROM alpine:3.20\nRUN echo hello','制作时会尝试输出 hello。','构建缓存可能复用结果；RUN 与启动容器时的 CMD 不同。');
  add('copy','将文件复制进环境','COPY 指定来源与目标，让镜像中包含项目所需文件。','FROM alpine:3.20\nWORKDIR /app\nCOPY hello.txt ./','把构建目录里的 hello.txt 复制到 /app。','没有在本地检查文件存在性；.dockerignore 可以排除文件。');
  add('copy-from','从另一个来源取文件','COPY --from 可以从阶段、镜像或命名构建上下文取文件，而不只从本地项目取。','FROM alpine:3.20\nCOPY --from=busybox:1.36 /bin/busybox /tools/busybox','尝试从指定镜像复制 busybox 文件。','这条 COPY 本身不会新建 FROM 阶段，也不保证来源可以下载。');
  add('workdir','设置后续工作的文件夹','WORKDIR 改变后续操作使用的文件夹；相对路径参照当前位置。','FROM alpine:3.20\nWORKDIR /app\nCOPY . .','第二个点表示当前工作文件夹 /app。','COPY 中两个点的含义不同：来源构建目录与目标工作文件夹。');
  add('expose','登记端口，不自动开放端口','EXPOSE 告诉使用者程序预期用哪个端口，属于说明信息。','FROM alpine:3.20\nEXPOSE 8000','镜像记录 8000 端口信息。','不会因此启动服务或创建宿主机端口映射。');
  add('cmd','容器启动时的默认安排','CMD 保存默认启动命令或参数，制作镜像时不会执行它。','FROM alpine:3.20\nCMD ["echo", "hello"]','未被覆盖且没有改变语义的 ENTRYPOINT 时，启动容器会运行 echo hello。','同阶段最后一条 CMD 生效；实际命令还受 ENTRYPOINT 和启动参数影响。');
  add('entrypoint','指定启动程序','ENTRYPOINT 指定启动容器时的主程序，常与 CMD 的默认参数组合。','FROM alpine:3.20\nENTRYPOINT ["echo"]\nCMD ["hello"]','默认组合成 echo hello。','运行时仍可覆盖入口；Shell 形式与 JSON 形式的组合规则不同。');
  add('arg','制作时可传入的设置','ARG 提供制作镜像时的参数，可以写默认值。','ARG BASE=alpine:3.20\nFROM ${BASE}','未覆盖 BASE 时使用默认基础镜像。','ARG 不自动保留为运行容器时的环境变量；跨阶段还有作用范围规则。');
  add('env','给环境保存设置','ENV 设置后续步骤和容器可读取的环境变量。','FROM alpine:3.20\nENV GREETING=hello','GREETING 的默认内容是 hello。','保存文字不等于执行文字里的命令，程序是否读取它取决于程序本身。');
  add('continuation','一条长指令分成多行','行尾续行符把下一行接进同一条指令，便于排版。','FROM alpine:3.20\nRUN echo \\\n    hello','两行 RUN 内容合起来是一条指令。','续行符由文件头 escape 设置决定，默认是反斜杠；不能任意删掉。');
  add('cache','复用制作过程中的下载缓存','RUN --mount=type=cache 临时提供缓存位置，减少后续制作的重复下载。','FROM alpine:3.20\nRUN --mount=type=cache,target=/tmp/cache echo ready','本条 RUN 可以使用该缓存目录。','缓存不是依赖最终安装位置，也不会仅因为挂载就复制进镜像。');
});
