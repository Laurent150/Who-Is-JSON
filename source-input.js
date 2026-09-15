// Ignore only a matching outer Markdown fence. Keep line count and source text in the editor.
function sourceInput(raw){
 const lines=raw.split('\n');const changes=[];
 if(lines[0]?.startsWith('\uFEFF')){lines[0]=lines[0].slice(1);changes.push('忽略文件开头的不可见 BOM 标记。');}
 const numbered=lines.map((s,i)=>({i,m:s.match(/^\s*(\d+)\s*\| ?(.*)$/)})).filter(x=>lines[x.i].trim());
 if(numbered.length>=3&&numbered.every((x,j)=>x.m&&(!j||Number(x.m[1])===Number(numbered[j-1].m[1])+1))){for(const x of numbered)lines[x.i]=x.m[2];changes.push('忽略连续的“行号 | ”前缀；不改变代码内部缩进。');}
 let first=0,last=lines.length-1;
 while(first<=last&&!lines[first].trim())first++;
 while(last>=first&&!lines[last].trim())last--;
 // A copied chat answer may have prose before and after one fenced code block.
 // Do not combine multiple blocks or reinterpret fences inside apparent source code.
 const regions=[];let active=null;
 for(let i=first;i<=last;i++){
  if(active){if(lines[i].trim()===active.marker){regions.push({...active,end:i});active=null;}}
  else {const m=lines[i].match(/^\s*(`{3,}|~{3,})([\w+-]*)\s*\r?$/);if(m)active={start:i,marker:m[1],language:m[2]};}
 }
 const sourcePrefix=/^(?:const\b|let\b|var\b|function\b|async\b|def\b|class\b|import\b|from\b|export\b|return\b|\/\/|\/\*|#|[({["']|\w+\s*=)/;
 if(regions.length===1&&!active&&regions[0].start>first&&!sourcePrefix.test(lines[first].trim())){
  const region=regions[0];
  for(let i=0;i<lines.length;i++)if(i<region.start||i>region.end)lines[i]='';
  first=region.start;last=region.end;
  changes.push('从一段带说明的文本中提取唯一的完整代码块；忽略块外说明，保留原始行号。');
 }
 const opening=lines[first]?.match(/^\s*(`{3,}|~{3,})([\w+-]*)\s*\r?$/);
 if(!opening||last<=first||lines[last].trim()!==opening[1])return {code:lines.join('\n'),wrapped:false,changed:changes.length>0,changes};
 const language=opening[2].toLowerCase();
 const extensions={gitignore:'.gitignore',dockerfile:'.dockerfile',containerfile:'.containerfile',bash:'.sh',shell:'.sh',sh:'.sh',java:'.java',javascript:'.js',js:'.js',typescript:'.ts',ts:'.ts',python:'.py',py:'.py',json:'.json',yaml:'.yaml',yml:'.yaml',html:'.html',css:'.css',sql:'.sql'};
 lines[first]='';lines[last]='';
 changes.push('忽略最外层 Markdown 代码围栏。');return {code:lines.join('\n'),wrapped:true,changed:true,changes,extension:extensions[language]||''};
}
module.exports={sourceInput};
