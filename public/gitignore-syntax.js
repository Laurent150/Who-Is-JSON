(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoGitignoreSyntax=api;})(this,function(){
    function trimEnd(value){
        while(value.endsWith(' ')){let n=0;for(let i=value.length-2;i>=0&&value[i]==='\\';i--)n++;if(n%2)break;value=value.slice(0,-1);}
        return value;
    }
    function read(code){return code.split('\n').map((raw,index)=>{
        const text=trimEnd((index===0?raw.replace(/^\uFEFF/,''):raw).replace(/\r$/,''));
        const kind=!text?'blank':text[0]==='#'?'comment':'rule',negated=kind==='rule'&&text[0]==='!';
        const pattern=negated?text.slice(1):text,directory=pattern.endsWith('/'),body=directory?pattern.slice(0,-1):pattern;
        let trailingSlashes=0;for(let i=pattern.length-1;i>=0&&pattern[i]==='\\';i--)trailingSlashes++;
        return {raw,text,kind,negated,pattern,directory,anchored:body.includes('/')&&!body.startsWith('**/'),invalid:kind==='rule'&&(!pattern||trailingSlashes%2===1),start:index+1,end:index+1,startColumn:0,endColumn:raw.replace(/\r$/,'').length};
    });}
    function evidence(code){
        const rows=read(code).filter(r=>r.kind==='rule');
        // Bare path lists are ambiguous; require several rules plus wildcard/exception evidence.
        return rows.length>=3&&rows.every(r=>!r.invalid&&/^[!\w.\-/*?\[\]\\]+$/.test(r.text))&&rows.some(r=>r.negated)&&rows.some(r=>/[?*]/.test(r.pattern));
    }
    function tokens(code){
        let offset=0;const out=[];
        for(const r of read(code)){
            const raw=r.raw;let i=0;
            if(r.kind==='comment')out.push({text:raw,start:offset,end:offset+raw.length,kind:'comment'});
            else while(i<raw.length){const tail=raw.slice(i),m=/^(?:\\.|\*\*|\[[^\]]*\]|[!*?/]|[^\\!*?/\[]+|.)/.exec(tail),text=m[0];out.push({text,start:offset+i,end:offset+i+text.length,kind:/^(?:\\.|\*\*|\[[^\]]*\]|[!*?/])$/.test(text)?'symbol':'opaque'});i+=text.length;}
            if(offset+raw.length<code.length)out.push({text:'\n',start:offset+raw.length,end:offset+raw.length+1,kind:'space'});
            offset+=raw.length+1;
        }
        return out;
    }
    function lessons(code){
        const parts=[],seen=new Set();
        for(const t of tokens(code)){
            if(t.kind!=='symbol')continue;
            const start=code.slice(0,t.start).split('\n').length,startColumn=t.start-(code.lastIndexOf('\n',t.start-1)+1),r=read(code)[start-1];
            const plain=t.text==='!'?(startColumn===0?'行首的 ! 表示例外：把匹配项从忽略范围中取回；上级目录不能仍被忽略。':'这里的 ! 是名称的一部分，只有行首未转义的 ! 才表示例外。')
                :t.text==='*'?'匹配零个或多个字符，但不跨过 /。被忽略的目录里面的内容也会被排除。'
                :t.text==='**'?'在 **/、/** 或 /**/ 这样的目录位置可跨多层目录；其他位置按普通星号处理。'
                :t.text==='?'?'匹配一个字符，但不能是目录分隔符 /。'
                :t.text==='/'?(startColumn===r.text.length-1?'行末的 / 表示只匹配目录。':'分隔路径中的目录；开头或中间有 / 时，通常相对于这份 .gitignore 所在目录匹配。')
                :t.text.startsWith('\\')?'反斜杠让后面的字符按字面匹配，例如 \\! 匹配名称中的 !，不表示例外。'
                :t.text.startsWith('[')?'方括号表示从指定字符或范围中匹配一个字符，例如 [0-9] 匹配一位数字；不是列表。':'';
            if(plain&&!seen.has(t.text+'\0'+plain)){seen.add(t.text+'\0'+plain);parts.push({text:t.text,plain,start,end:start,startColumn,endColumn:startColumn+t.text.length,offset:t.start});}
        }
        return {parts,unknown:[],unknownTokens:[],supported:true};
    }
    return {read,evidence,tokens,lessons};
});
