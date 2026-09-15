const {read}=require('../public/gitignore-syntax');
const {result}=require('./common');
function gitignore(code){
    const records=read(code),active=records.filter(r=>r.kind!=='blank'),warnings=[],learning=[];
    const nodes=active.slice(0,200).map(r=>{
        const span={start:r.start,end:r.end,startColumn:r.startColumn,endColumn:r.endColumn};
        const ids=['basics'];let title,purpose,why;
        if(r.kind==='comment'){
            title='注释：'+r.text.slice(1).trim();purpose='这是作者留给读者的说明，不是一条忽略规则。';why='只有行首的 # 才开始注释；名称中间的 # 仍是名称的一部分。';ids.push('comment');
        }else{
            title=(r.negated?'例外：':'忽略：')+r.pattern;
            const scope=r.anchored?'相对于这份 .gitignore 所在目录':'在这份 .gitignore 所在目录及其下层';
            purpose=`${scope}，${r.negated?'把匹配项从忽略范围中取回':'让 Git 忽略匹配项'}：${r.pattern}。${r.directory?'末尾的 / 表示只匹配目录。':'没有末尾 /，同名文件和目录都可能匹配。'}`;
            why=r.negated?'前提是上级目录没有被忽略。! 不是删除操作，也不会自动创建、添加或提交文件。':'忽略不会删除文件，也不会改变已经被 Git 记录的文件。';
            if(r.negated)ids.push('negation');
            if(r.pattern.includes('/'))ids.push('slash');
            if(/(^|[^\\])\*/.test(r.pattern))ids.push('wildcard');
            if(r.pattern.includes('**'))ids.push('globstar');
            if(r.pattern.includes('?')||r.pattern.includes('['))ids.push('characters');
            if(r.pattern.includes('\\'))ids.push('escape');
            if(r.pattern.includes('.gitkeep'))ids.push('gitkeep');
            if(r.invalid){purpose='这一行缺少匹配内容，或以未配对的反斜杠结束，不能形成有效匹配。';warnings.push(`第 ${r.start} 行：请核对空规则或行尾反斜杠。`);}
        }
        const records=[...new Set(ids)].map(id=>({id:'gitignore.'+id,...span,context:purpose}));learning.push(...records);
        return {...span,kind:'config',label:title,path:r.kind==='comment'?'作者注释':r.negated?'例外规则':'忽略规则',children:[],learning:records,guide:{title,purpose,why,basis:'依据 Git 的 gitignore 规则；没有读取仓库的实际文件或已跟踪状态。',limits:[]},rule:r};
    });
    if(active.length>200)warnings.push('先展示前 200 行规则与注释，其余保留在原文；请分段查看。');
    const rules=records.filter(r=>r.kind==='rule').length;
    const purpose='这是一份 Git 忽略清单。Git 是记录代码版本的工具；这里告诉它哪些文件或目录暂时不必记录。每行一条规则，不会删除文件，也不会自动取消已经记录的文件。';
    const blocks=nodes.length?[{kind:'config',title:'忽略与例外规则',start:1,end:code.split('\n').length,code,purpose:`当前有 ${rules} 条匹配规则。点开下面的一行，查看它忽略什么、是否设置例外，以及符号怎样使用。`,configurationNodes:nodes,configurationLegend:'按原文顺序列出规则。相同优先级中，后面的匹配规则可覆盖前面的；被忽略目录里的文件不能直接用例外取回。',learning,symbols:[],guide:{title:'忽略与例外规则',purpose:'逐条指定不必记录的内容，再用 ! 设置需要保留的例外。',basis:'Git 忽略规则。',limits:['是否实际生效，还取决于其他忽略文件和 Git 已跟踪的文件。']}}]:[];
    const out=result('Gitignore','Git 忽略规则读取',`${rules} 条 Git 忽略规则`,purpose,blocks,warnings,warnings.length?'partial':nodes.length?'ready':'empty');
    out.documentKind='configuration';out.navigationNote='这份文件是匹配规则清单，不是程序执行流程。';
    out.guide={title:'告诉 Git 哪些文件不必记录',purpose,basis:'按 Git 官方 gitignore 规则解释。',limits:['没有读取仓库文件、其他忽略清单或 Git 的跟踪状态，因此不判断某个真实文件最终是否被忽略。'],reference:'https://git-scm.com/docs/gitignore'};
    return out;
}
module.exports={gitignore};
