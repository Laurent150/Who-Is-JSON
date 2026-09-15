(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoFileTypes=api;})(this,function(){
    const extensions = { '.py': 'Python', '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.java': 'Java', '.go': 'Go', '.rs': 'Rust', '.c': 'C', '.h': 'C/C++', '.cpp': 'C++', '.cs': 'C#', '.php': 'PHP', '.rb': 'Ruby', '.sql': 'SQL', '.html': 'HTML', '.css': 'CSS', '.json': 'JSON', '.yml': 'YAML', '.yaml': 'YAML', '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell' };
    function language(name='') {
        if(/\.gitignore$|(?:^|[\\/])\.git[\\/]info[\\/]exclude$/i.test(name))return 'Gitignore';
        if(/(?:^|[\\/])\.dockerignore$/i.test(name))return 'Dockerignore';
        if (/(?:^|[\\/])(?:Dockerfile|Containerfile)(?:\.[\w.-]+)?$/i.test(name) || /\.(?:dockerfile|containerfile)$/i.test(name)) return 'Dockerfile';
        return extensions[(name.match(/\.[^.\\/]+$/)||[''])[0].toLowerCase()] || '';
    }
    function accepts(name){return !!language(name)||/\.txt$/i.test(name);}
    const support = [
        ['Gitignore','.gitignore / .git/info/exclude','忽略与例外规则、路径范围、通配符、转义、注释及知识卡','不读取实际仓库或其他忽略文件，不判断真实文件的最终状态；与 .dockerignore 分开处理'],
        ['Python','.py','函数、类、分支、异常与等待；部分 JSON/文字处理、继承初始化和明确的计数重试；本文件定义关联','仅支持列出的常见行为；生成器调度、动态调用、跨文件实现与第三方内部行为未知；英文说明不自动翻译'],
        ['JavaScript / TypeScript','.js .mjs .cjs .jsx .ts .tsx','函数、条件、循环、try/catch/finally、JSON 读写、部分表达式与知识卡；本文件定义关联','复杂异步调度、switch 内部转移、动态覆盖及框架业务未完全解释'],
        ['Java','.java','类与方法、常见判断和循环、基础知识卡','复杂异常、泛型及框架行为未完全解释'],
        ['Shell','.sh .bash .zsh','按 Bash 语法分析函数、条件、循环、常见命令','不保证 zsh 专属语法；嵌入其他语言和外部命令保留缺口'],
        ['Dockerfile','Dockerfile / Containerfile','常见构建指令、阶段、启动设置与知识卡','非完整构建器；扩展语法和镜像内实际环境未知'],
        ['JSON / YAML','.json .yml .yaml','数据层级；已知配置类型的部分字段解释','未知应用的字段用途无法由格式确定'],
        ['HTML / CSS / SQL','.html .css .sql','标签、样式规则或语句结构','知识卡和业务语义覆盖有限；SQL 方言可能不兼容'],
        ['其他文件 / 截图','.txt / 图片 / 其他语言','文本会尝试识别；内置英文与简体中文 OCR，可提取截图文字','Go、Rust、C/C++、C#、PHP、Ruby 目前仅识别类型；图片识字不保证准确']
    ];
    return {language,accepts,support};
});
