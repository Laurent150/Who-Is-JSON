// Read-only code presentation. Line numbers and whitespace hints never enter exports.
function codeView(source, {start=1, highlight=null, className='', language=(typeof current!=='undefined'?current?.language:''),contextSource=null,contextLine=1}={}) {
    const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
    const pre=make('pre',undefined,'reading-code '+className);
    pre.dataset.raw=source;
    const legend=make('span','行号 → 缩进格数 → 原代码。Tab 按 4 格对齐；灰绿色为注释。','code-legend');
    legend.setAttribute('aria-hidden','true');pre.append(legend);
    const toggle=make('button','开启自动折行','code-wrap-toggle');toggle.type='button';toggle.setAttribute('aria-pressed','false');toggle.onclick=()=>{const on=pre.classList.toggle('code-wrap');toggle.textContent=on?'保持原行，横向滚动':'开启自动折行';toggle.setAttribute('aria-pressed',String(on));};pre.append(toggle);
    const baseOffset=contextSource?contextSource.split('\n').slice(0,contextLine-1).reduce((n,s)=>n+s.length+1,0):0;
    const tokens=WhoReading.scan(contextSource||source,language).filter(t=>t.end>baseOffset&&t.start<baseOffset+source.length).map(t=>({...t,start:Math.max(0,t.start-baseOffset),end:Math.min(source.length,t.end-baseOffset)}));let lineOffset=0,tokenIndex=0;
    source.split('\n').forEach((line,i)=>{
        const indent=line.match(/^[ \t]*/)[0],spaces=(indent.match(/ /g)||[]).length,tabs=(indent.match(/\t/g)||[]).length;
        const row=make('span',undefined,'reading-line'),number=make('span',String(start+i),'reading-number');
        number.setAttribute('aria-hidden','true');number.title='第 '+(start+i)+' 行';
        const columns=[...indent].reduce((n,c)=>n+(c==='\t'?4-n%4:1),0);
        const label=columns+'个';
        const count=make('small',label,'reading-indent-count');count.setAttribute('aria-hidden','true');
        count.title=tabs?`显示缩进 ${columns} 格；原文为 ${spaces} 个空格、${tabs} 个 Tab`:`本行开头有 ${spaces} 个空格`;
        const code=make('code',undefined,'reading-text');
        let column=0;
        for(let j=0;j<line.length;j++){
            const marked=highlight && start+i>=highlight.start && start+i<=highlight.end && j>=(start+i===highlight.start?highlight.startColumn:0) && j<(start+i===highlight.end?highlight.endColumn:line.length);
            // Keep text nodes together so highlighted expressions remain easy to select.
            if(j>=indent.length){
                while(tokens[tokenIndex]&&tokens[tokenIndex].end<=lineOffset+j)tokenIndex++;
                const token=tokens[tokenIndex],kind=token?.kind||'',limit=Math.min(line.length,(token?.end??source.length)-lineOffset);let end=j+1;
                while(end<limit){const nextMarked=highlight && start+i>=highlight.start && start+i<=highlight.end && end>=(start+i===highlight.start?highlight.startColumn:0) && end<(start+i===highlight.end?highlight.endColumn:line.length);if(!!nextMarked!==!!marked)break;end++;}
                const cls=['comment','string','docstring'].includes(kind)?'syntax-'+kind:'';
                code.append(marked?make('mark',line.slice(j,end),'source-focus '+cls):cls?make('span',line.slice(j,end),cls):document.createTextNode(line.slice(j,end)));j=end-1;continue;
            }
            const tab=line[j]==='\t',hint=make(marked?'mark':'span',line[j],'indent-hint'+(tab?' indent-tab':'')+(marked?' source-focus':''));
            hint.title=tab?'原文的一个 Tab':'原文的一个空格';
            if(tab){const width=4-column%4;hint.style.width=width+'ch';column+=width;}else column++;
            code.append(hint);
        }
        row.append(number,count,code);pre.append(row);lineOffset+=line.length+1;
    });
    return pre;
}
