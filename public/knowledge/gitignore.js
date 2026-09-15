(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.WhoGitignoreCards=factory;})(this,function(card){
    const add=(id,title,plain,example,result,pitfall)=>card('gitignore.'+id,'Gitignore',title,plain,'文件、目录和路径通常由作者填写；#、!、*、?、/ 等符号遵守 Git 规定的规则。',example,result,pitfall,'',null);
    add('basics','让 Git 跳过不必记录的内容','Git 用来记录文件的版本。.gitignore 是忽略清单，每行写一种不必记录的名称或路径。','logs/\n*.tmp','logs 目录和以 .tmp 结尾的匹配项会被忽略。','只影响尚未被 Git 跟踪的文件；不会删除文件，也不会自动取消已有记录。');
    add('comment','# · 给读者看的说明','行首 # 开始注释；空行可用来分组。','# 临时文件\n*.tmp','第一行是说明，第二行才是规则。','前面有空格的 # 不算行首注释；文件名中的 # 也不自动开始注释。');
    add('wildcard','* · 一次匹配多个名称','* 匹配零个或多个字符，不跨过 /。','*.log','app.log 和 debug.log 都能匹配；report.txt 不能。','目录一旦匹配并被忽略，里面的文件也会被排除。');
    add('negation','! · 从忽略范围中取回例外','行首 ! 让匹配项重新有机会被 Git 记录。','cache/*\n!cache/.gitkeep','第一行忽略 cache 下的直接内容；第二行将 .gitkeep 作为例外。','如果写成 cache/，整个上级目录被忽略，单独 !cache/.gitkeep 无法取回文件；其他规则也可能改变结果。');
    add('slash','/ · 区分目录和匹配位置','末尾 / 表示只匹配目录；开头或中间的 / 通常把路径定位到这份 .gitignore 所在目录。','logs/\n/config/local.toml','logs/ 可匹配下层同名目录；第二行定位当前 .gitignore 所在目录下的 config/local.toml。','没有末尾 / 的模式可以匹配文件，也可以匹配同名目录。');
    add('globstar','** · 跨多层目录匹配','** 放在特定目录位置，可以匹配多层目录。','**/cache/\na/**/b\noutput/**','第一行匹配任意层的 cache 目录；第二行包含 a/b、a/x/b；第三行匹配 output 里面各层内容。','其他位置的连续星号按普通星号处理，不要把每个 ** 都理解为任意路径。');
    add('characters','? 和 [] · 匹配一个字符','? 匹配一个非 / 字符；[0-9] 表示匹配一位数字。','file?.txt\npart[0-9].log','file1.txt、part2.log 分别匹配对应规则；file12.txt、part12.log 不匹配。','这里的 [] 是字符范围，不是 Python 列表或数组。');
    add('escape','\\ · 按字符本身匹配','反斜杠可以取消后面字符的特殊作用。','\\#notes\n\\!keep\nname\\ ','分别匹配名称 #notes、!keep，以及末尾带一个空格的 name 。','普通行尾空格会被忽略；没有配对字符的行尾反斜杠不能匹配。');
    add('gitkeep','.gitkeep · 约定的占位文件名','.gitkeep 只是大家常用的文件名，不是 Git 内置指令。Git 通常不单独记录空目录，因此有人在里面放一个文件。','cache/*\n!cache/.gitkeep','例外来自第二行的 !，不是因为文件名包含 gitkeep。','仍要实际创建并添加这个文件；写进忽略清单不会自动创建或提交它。');
});
