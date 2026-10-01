(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoAIGlossary=api;})(globalThis,function(){
 const terms=[
  {name:'Promise',pattern:/\bpromises?\b/i,en:'A JavaScript value that represents an outcome: a value on success or an error on failure. The outcome may already be known or arrive later.',zh:'JavaScript 中表示处理结果的值：成功时得到一个值，失败时得到一个错误。结果可能已经确定，也可能稍后才确定。'},
  {name:'thenable',pattern:/\bthenables?\b/i,en:'A value with a callable then property. JavaScript can use that method to wait for its eventual outcome.',zh:'带有可调用的 then 属性的值。JavaScript 可以通过这个方法等待它的处理结果。'},
  {name:'rejection',pattern:/\breject(?:s|ed|ion|ions)?\b/i,en:'A promise failing with an error. Awaiting a rejected promise throws that error at the await expression.',zh:'Promise 以错误告终。await 等待这样的 Promise 时，会在 await 所在位置抛出该错误。'},
  {name:'property',pattern:/\bpropert(?:y|ies)\b/i,en:'A named piece of data on an object. In user.name, name is the property being read; this access alone does not prove that it exists.',zh:'对象上有名称的数据项。例如 user.name 读取名为 name 的属性；出现这样的读取写法，不代表该属性一定存在。'}
 ];
 function forText(text,language,locale){
  if(!/^(?:JavaScript|TypeScript)$/i.test(language||''))return [];
  return terms.filter(term=>term.pattern.test(String(text))).map(term=>({name:term.name,meaning:locale==='en'?term.en:term.zh}));
 }
 return {forText};
});
