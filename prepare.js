function prepare(code){let clean=code;const changes=[];
 if(/^\s*```[^\n]*\n/.test(clean)||/^\s*```\s*$/m.test(clean)){clean=clean.split('\n').filter(l=>!/^\s*```[^`]*$/.test(l)).join('\n');changes.push('移除独占一行的 Markdown 代码围栏。');}
 if(/&#(?:x20|32);/i.test(clean)){clean=clean.replace(/&#(?:x20|32);/gi,' ');changes.push('把 HTML 空格实体还原为空格；请检查文字字符串内部是否也应还原。');}
 if(/\\[_@-]/.test(clean)){clean=clean.replace(/\\([_@-])/g,'$1');changes.push('移除下划线、@ 和短横线前的 Markdown 转义；可能影响原本需要反斜杠的字符串，请核对。');}
 return {code:clean,changes,notice:'不会自动补缩进、闭合括号或编造缺失代码。应用后，行号按清理后的输入计算。'};}
module.exports={prepare};
