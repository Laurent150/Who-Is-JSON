// Bounded logical-instruction reader, not a replacement for Docker's build validator.
// Preserves physical source ranges and never parses comment text as instructions.
const instructions = new Set('FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL'.split(' '));
function read(code) {
  const lines=code.split('\n'),records=[];
  let escape='\\',directives=true,comments=[];
  for(let i=0;i<lines.length;i++) {
    const line=lines[i].replace(/\r$/,''),trim=line.trim();
    if(trim.startsWith('#')) {
      const directive=directives && trim.match(/^#\s*(syntax|escape|check)\s*=\s*(.*)$/i);
      if(directive){if(directive[1].toLowerCase()==='escape'&&['\\','`'].includes(directive[2]))escape=directive[2];}
      else directives=false;
      comments.push({start:i+1,end:i+1,startColumn:line.indexOf('#'),endColumn:line.length,text:trim.slice(1).trim(),directive:!!directive});
      continue;
    }
    if(!trim){directives=false;continue;}
    directives=false;
    const start=i,parts=[];let dangling=false;
    while(true) {
      const raw=lines[i].replace(/\r$/,'');
      if(!raw.trim().startsWith('#')) {
        let tail=raw.trimEnd(),slashes=0;
        for(let j=tail.length-1;j>=0&&tail[j]===escape;j--)slashes++;
        const continued=slashes%2===1;
        parts.push(continued?tail.slice(0,-1):raw);
        if(!continued)break;
      }
      if(++i>=lines.length){i=lines.length-1;dangling=true;break;}
    }
    const logical=parts.join(''),m=logical.trim().match(/^([A-Za-z]+)(?:\s+([\s\S]*))?$/);
    const instruction=m?.[1].toUpperCase()||'',args=m?.[2]?.trim()||'';
    // Here-document bodies may themselves contain FROM/RUN or other language code.
    // Consume them as opaque source, explicitly leaving their semantics uncovered.
    const delimiters=['RUN','COPY','ADD'].includes(instruction)?[...args.matchAll(/<<(-?)(["']?)([\w-]+)\2/g)]:[];
    let heredoc=false;
    for(const match of delimiters){heredoc=true;let found=false;while(++i<lines.length){const candidate=lines[i].replace(/\r$/,'');if((match[1]?candidate.replace(/^\t+/,''):candidate)===match[3]){found=true;break;}}if(!found){i=lines.length-1;dangling=true;break;}}
    records.push({instruction,args,known:instructions.has(instruction),heredoc,dangling,
      start:start+1,end:i+1,startColumn:Math.max(0,lines[start].search(/\S/)),endColumn:lines[i].replace(/\r$/,'').length,
      comments,continued:i>start,source:lines.slice(start,i+1).join('\n')});
    comments=[];
    if(records.length>=200){if(i<lines.length-1)records.at(-1).limited=true;break;}
  }
  return records;
}
function evidence(code) {
  const records=read(code),first=records.find(r=>r.instruction!=='ARG');
  return first?.instruction==='FROM' && /^(?:--platform=\S+\s+)?[^\s]+(?:\s+AS\s+[\w.-]+)?$/i.test(first.args);
}
// Tokenization is used only for simple Docker operands, not to execute shell syntax.
function operands(value) {
  if(value.trim().startsWith('[')){try{const a=JSON.parse(value);return Array.isArray(a)&&a.every(x=>typeof x==='string')?a:null;}catch{return null;}}
  const parts=value.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)||[];
  if(parts.some(x=>(x.startsWith('"')&&!x.endsWith('"'))||(x.startsWith("'")&&!x.endsWith("'"))))return null;
  return parts.map(x=>/^(["'])[\s\S]*\1$/.test(x)?x.slice(1,-1):x);
}
module.exports={read,evidence,operands};
