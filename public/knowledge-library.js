(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoLibrary=api;})(this,function(){
 const categories=['语法与基础','流程与函数','数据结构与算法','异步与错误处理','文件、网络与系统','工程与设计'];
 function category(card){
  if(categories.includes(card.category))return card.category;
  const text=card.id+' '+card.title;
  if(/async|await|promise|try|catch|except|throw|raise|error|异步|异常|错误|重试/i.test(text))return categories[3];
  if(/file|path|read|write|http|fetch|process|socket|stream|文件|网络|进程|权限/i.test(text))return categories[4];
  if(/docker|gitignore|module|import|export|package|test|模块|容器|测试|配置/i.test(text))return categories[5];
  if(/array|list|dict|map|set|sort|search|filter|reduce|数组|列表|字典|集合|排序|搜索/i.test(text))return categories[2];
  if(/function|return|loop|for|while|if|switch|recurs|函数|循环|分支|判断|递归/i.test(text))return categories[1];
  return categories[0];
 }
 function tags(card){return [...new Set([card.language,...(Array.isArray(card.tags)?card.tags:[])].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,40)))].slice(0,6);}
 function matches(item,kind,query){const c=item.card;if(kind&&category({...c,category:item.category||c.category})!==kind)return false;const q=query.trim().toLocaleLowerCase();return !q||[c.title,c.plain,c.naming,...tags(c),...item.sources.map(s=>s.file+' '+s.context+' '+s.code)].join(' ').toLocaleLowerCase().includes(q);}
 return {categories,category,tags,matches};
});
