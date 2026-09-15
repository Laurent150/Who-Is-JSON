// Presentation-only lexical facts. Does not execute source or claim full parsing.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoReading=api;})(this,function(){
 const supported=['Gitignore','Python','JavaScript','TypeScript','Java','JSON','Shell','Dockerfile','YAML','SQL','CSS','HTML'];
 function language(value){return ({gitignore:'Gitignore',python:'Python',javascript:'JavaScript',typescript:'TypeScript',java:'Java',json:'JSON',bash:'Shell',shell:'Shell',dockerfile:'Dockerfile',yaml:'YAML',sql:'SQL',css:'CSS',html:'HTML'})[String(value).toLowerCase()]||value||'';}
 function scan(source,lang){
  if(language(lang)==='Gitignore')return (typeof require==='function'?require('./gitignore-syntax'):globalThis.WhoGitignoreSyntax).tokens(source);
  lang=language(lang);if(!supported.includes(lang))return [{text:source,start:0,end:source.length,kind:'opaque'}];
  const tokens=[];let i=0;const cstyle=['JavaScript','TypeScript','Java','CSS'].includes(lang),hash=['Python','Shell','Dockerfile','YAML'].includes(lang);
  const push=(end,kind)=>{tokens.push({text:source.slice(i,end),start:i,end,kind});i=end;};
  while(i<source.length){const rest=source.slice(i),ch=source[i];let m;
   if((m=/^\s+/.exec(rest))){push(i+m[0].length,'space');continue;}
   if(lang==='HTML'){if(rest.startsWith('<!--')){let e=source.indexOf('-->',i+4);push(e<0?source.length:e+3,'comment');}else{let e=source.indexOf('<!--',i+1);push(e<0?source.length:e,'opaque');}continue;}
   if(hash&&ch==='#'&&(lang==='Python'||i===0||/[\s;]/.test(source[i-1]))||cstyle&&lang!=='CSS'&&rest.startsWith('//')||lang==='SQL'&&rest.startsWith('--')){let e=source.indexOf('\n',i);push(e<0?source.length:e,'comment');continue;}
   if((cstyle||lang==='SQL')&&rest.startsWith('/*')){let e=source.indexOf('*/',i+2);push(e<0?source.length:e+2,'comment');continue;}
   // Shell expansions/heredocs, YAML block scalars and JS templates/regex are opaque.
   if((lang==='Shell'||lang==='Dockerfile')&&(rest.startsWith('<<')||rest.startsWith('${')||rest.startsWith('$('))||(lang==='YAML'&&/^[|>][+-]?\s*(?:\n|$)/.test(rest))){push(source.length,'opaque');continue;}
   if(ch==='"'||ch==="'"||ch==='`'){
    const triple=lang==='Python'&&rest.startsWith(ch.repeat(3)),delim=triple?ch.repeat(3):ch;let e=i+delim.length;
    while(e<source.length){if(source[e]==='\\'){e+=2;continue;}if(source.startsWith(delim,e)){if(lang==='SQL'&&source[e+1]===ch){e+=2;continue;}e+=delim.length;break;}e++;}
    push(Math.min(e,source.length),triple?'docstring':'string');continue;
   }
   if((lang==='JavaScript'||lang==='TypeScript')&&ch==='/'){
    const prev=tokens.filter(t=>!['space','comment'].includes(t.kind)).at(-1)?.text;
    if(!prev||['=','(',',',':','return','=>','[','!',';','{','}'].includes(prev)){let e=i+1,inClass=false;while(e<source.length&&source[e]!=='\n'){if(source[e]==='\\'){e+=2;continue;}if(source[e]==='[')inClass=true;if(source[e]===']')inClass=false;if(source[e]==='/'&&!inClass){e++;while(/[a-z]/i.test(source[e]||'')&&e<source.length)e++;break;}e++;}push(e,'string');continue;}
   }
   if((m=/^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(rest))){push(i+m[0].length,'name');continue;}
   if((m=/^\d+(?:\.\d+)?/.exec(rest))){push(i+m[0].length,'number');continue;}
   m=/^(?:===|!==|==|!=|<=|>=|\+=|-=|\*=|\/=|=>|->|&&|\|\||\*\*|\?\?|\?\.|:=|\+\+|--|\[\[|\]\])/.exec(rest);push(i+(m?m[0].length:1),'symbol');
  }
  return tokens;
 }
 function lessons(source,lang){
  if(language(lang)==='Gitignore')return (typeof require==='function'?require('./gitignore-syntax'):globalThis.WhoGitignoreSyntax).lessons(source);
  lang=language(lang);const ts=scan(source,lang).filter(t=>!['space','comment','string','docstring','opaque'].includes(t.kind));const all=scan(source,lang),stack=[],out=[],unknown=[];let line=1,offset=0;
  const add=(t,text)=>{while(source.indexOf('\n',offset)>=0&&source.indexOf('\n',offset)<t.start){offset=source.indexOf('\n',offset)+1;line++;}out.push({text:t.text,plain:text,start:line,end:line,startColumn:t.start-offset,endColumn:t.end-offset,offset:t.start});};
  for(let k=0;k<ts.length;k++){
   const t=ts[k],v=t.text,prev=ts[k-1]?.text,next=ts[k+1]?.text,frame=stack.at(-1),lineText=source.slice(source.lastIndexOf('\n',t.start-1)+1,source.indexOf('\n',t.start)<0?source.length:source.indexOf('\n',t.start));let meaning='';
   const py=lang==='Python',js=['JavaScript','TypeScript'].includes(lang),java=lang==='Java',json=lang==='JSON',shell=lang==='Shell';
   if(v==='['){
    const last=all.filter(x=>x.end<=t.start&&!['space','comment'].includes(x.kind)).at(-1);
    const index=!!last&&(last.kind==='name'&&!['return','in','yield','await','throw','of','const','let','var'].includes(last.text)||['number','string'].includes(last.kind)||[')',']'].includes(last.text));
    const type=py&&['list','dict','tuple','set','List','Dict','Optional','Union','Sequence','Mapping','Callable'].includes(last?.text)&&/(?:->|:)\s*[^=]*$/.test(source.slice(source.lastIndexOf('\n',t.start-1)+1,t.start));
    const tsType=lang==='TypeScript'&&next===']'&&/(?:\btype\s+\w+\s*=|:)\s*[^=]*$/.test(source.slice(source.lastIndexOf('\n',t.start-1)+1,t.start));
    const role=type?'type':(java||tsType)&&next===']'?'arraytype':java&&/\bnew\s+[\w.]+\s*$/.test(source.slice(0,t.start))?'allocate':js&&['const','let','var'].includes(prev)?'destructure':index?'index':json||js?'array':py?'list':'unknown';stack.push({open:v,role});
    meaning=role==='list'?'这里用方括号把内容按顺序放进一个列表；例如 [10, 20] 包含两项。':role==='array'?'这里用方括号把内容按顺序放进一个数组，也就是一组有顺序的值。':role==='index'&& (py||js||java)?'这里在已有内容后使用方括号，按括号里指定的位置或键取出对应内容；不是新建列表。':role==='type'?'这里的方括号补充类型提示，说明容器里预期存放哪种类型；不是实际数据。':'';
    if(role==='arraytype')meaning='这对空方括号表示数组类型；不是从数组里取出某一项。';
    if(role==='allocate')meaning='这里给出新数组的长度，创建能容纳这些元素的数组。';
    if(role==='destructure')meaning='这里按位置接收右边提供的各项内容，并分别给它们起名字；不是创建数组。';
   }else if(v==='('){stack.push({open:v,role:'paren'});}
   else if(v==='{'){stack.push({open:v,role:json?'object':'brace'});if(json)meaning='把一组“名称和对应的值”放在一起，组成一个 JSON 对象。';}
   else if([')',']','}'].includes(v)){const wanted={')':'(',']':'[','}':'{'}[v];if(frame?.open===wanted){stack.pop();if(v===']'&&['list','array','index','type'].includes(frame.role))meaning='结束与前面左方括号配对的这部分内容。';if(v==='}'&&json)meaning='结束这一组 JSON 名称和值。';}}
   else if(v===',') {if(['list','array'].includes(frame?.role))meaning='分隔这一组内容里的相邻两项；逗号不表示相加。';else if(json&&frame?.role==='object')meaning='分隔相邻的两组名称和值。';else if(frame?.role==='paren'&&(py||js||java))meaning='分隔括号里相邻的项目，例如参数。';}
   else if(v===':'){
    if(json)meaning='左边是名称，右边是这个名称对应的值；例如 "count": 2。';
    else if(py&&!stack.length&&/^\s*(?:async\s+)?(?:for|while|if|elif|else|try|except|finally|with|def|class)\b/.test(lineText))meaning=/^\s*(?:async\s+)?(?:for|while)\b/.test(lineText)?'冒号表示：下面开始写这个循环每轮要做的步骤。换行后向右缩进，表示这些步骤属于这个循环。':'冒号表示：下面开始写这部分的具体内容。换行后通过向右缩进，标明哪些内容属于它。';
    else if(py&&frame?.role==='index')meaning='这里在方括号里分隔切片的起点、终点或步长，用来取出一段内容。';
    else if(py&&frame?.role==='brace')meaning='这里分隔字典的一组键和值；左边是查找用的键，右边是对应的值。';
    else if(lang==='CSS')meaning='在 CSS 声明里，冒号分隔属性名和它的设置值。';
    else if(lang==='YAML'&&/\s|$/.test(source[t.end]||''))meaning='在这条 YAML 配置里，冒号后面填写左侧名称对应的值。';
    else if(java&&/\bfor\s*\(/.test(lineText))meaning='在这种 Java for 循环里，右边是要遍历的内容，左边接收每次取出的一项。';
   }else if(v==='+='){
    if(py||js||java)meaning='把右边的内容加到左边原有的值上，再保存结果。例如数值原来是 5，加上 2 后变为 7。文字或容器的行为要按类型区分，不能全部当作数字加法。';
   }else if(v==='='){
    if(py||js||java)meaning=frame?.role==='paren'&&py?'这里可能是参数的默认值或按名字传参数；要结合它属于定义还是调用来区分。':'先求出右边的值，再保存到左边指定的位置；这不是比较相等。';
    if(shell&&/^[A-Za-z_]\w*$/.test(prev||'')&&ts[k-1].end===t.start)meaning='在 Shell 赋值写法中，把右边的内容保存到左边的变量；等号两侧不能随意加空格。';
   }else if(v==='for'&&(py||(js||java)&&next==='('&&prev!=='.'||shell&&/^\s*for\b/.test(lineText)))meaning=py?'依次取出一项，再执行下面缩进的步骤；取完后停止。':java||js?'这里开始一个循环；括号里的写法决定逐项处理还是按条件重复。':'依次把每一项交给循环变量，再执行 do 与 done 之间的步骤。';
   else if(v==='in'&&py)meaning=/\bfor\b/.test(lineText)?'在这行 for 循环里，in 后面是要依次读取的内容。':'在这里检查左边的内容是否包含在右边的内容中，得到 True 或 False。';
   else if(v==='in'&&js&&prev!=='.'&&next!==':')meaning=/\bfor\b/.test(lineText)?'在 for…in 里遍历属性名，不是直接取出数组中的值。':'检查右边的对象是否有左边指定的属性，包括继承来的属性。';
   else if(v==='of'&&js&&/\bfor\b/.test(lineText))meaning='在 for…of 中依次取出右边内容提供的值，例如数组中的每一项。';
   else if(v==='while'&&(py||(js||java)&&next==='('&&prev!=='.'||shell&&/^\s*while\b/.test(lineText)))meaning=shell?'条件命令成功时执行一轮，再检查；条件不成功就停止。':'每轮先检查条件：成立才执行这一轮，不成立就停止。';
   else if(v==='async'&&(py&&next==='def'||js&&next==='function'))meaning=py?'定义可以使用 await 等待结果的功能；等待时，其他已安排的任务有机会继续。单独调用后，还需要 await 或安排任务来运行。':'定义可以使用 await 等待结果的功能。调用后会返回 Promise，用它接收将来的结果；不保证自动并行或更快。';
   else if(v==='await'&&(py||js))meaning='等待这里的任务结果，再继续后面的步骤；需要真正等待时，其他已安排的任务有机会运行。';
   else if(v===';'&&(js||java))meaning=frame?.role==='paren'&&/\bfor\s*\(/.test(lineText)?'在这种 for 循环头部，分号隔开开始时的设置、继续条件和每轮结束后的操作。':'这里用分号结束一条语句。';
   else if(lang==='Dockerfile'&&lineText.trimStart().startsWith(v+' '))meaning=({FROM:'选一个已有镜像作为这一制作阶段的基础。',RUN:'制作镜像时执行后面的命令，把结果加入镜像。',COPY:'把文件复制到镜像中的指定位置；带 --from 时可从其他阶段或镜像复制。',WORKDIR:'设置后续指令使用的工作目录。',CMD:'设置容器启动时的默认命令；不是在制作镜像时执行。',EXPOSE:'声明容器预期使用的端口；这条指令本身不会把端口发布到主机。'})[v]||'';
   if(meaning)add(t,meaning);else if(t.kind==='symbol')unknown.push(t);
  }
  const unique=new Map();for(const x of out){const key=x.text+'\0'+x.plain;if(!unique.has(key))unique.set(key,x);}
  return {parts:[...unique.values()],unknown:[...new Set(unknown.map(x=>x.text))],unknownTokens:unknown,supported:supported.includes(lang)};
 }
 function qualified(block){return block.owner&&!block.title.startsWith(block.owner+'.')?block.owner+'.'+block.title:block.title;}
 function identity(block,lang){
  lang=language(lang);const name=qualified(block),init=(lang==='Python'&&block.title==='__init__'&&!!block.owner)||block.constructorMethod||(['JavaScript','TypeScript'].includes(lang)&&block.title==='constructor'&&!!block.owner);
  const facts=[];if(block.owner)facts.push({name:block.owner,plain:'作者定义的类名。类是一种模板，规定这类对象能保存哪些数据、做哪些事；按模板创建出的具体一份叫对象。'});
  if(block.owner)facts.push({name:'.',plain:'这个目录名称里的点号表示所属关系：右边的功能属于左边的类。'});
  if(block.kind==='function')facts.push({name:block.title,plain:init?'对应开始前的准备工作。创建新对象时，这里的步骤准备它需要的数据和设置，这种准备叫初始化。具体步骤由作者编写。': '这是作者使用的功能名称，对应下面列出的处理步骤；仅凭名称不能确定它的全部作用。'});
  return {name,title:init?'做好开始前的准备':null,note:init?(lang==='Python'?'__init__ 是 Python 约定的名称':'创建对象时的准备步骤'):block.kind==='function'?'作者使用的功能名称':'源码中的结构名称',facts};
 }
 return {scan,lessons,language,identity,supported};
});
