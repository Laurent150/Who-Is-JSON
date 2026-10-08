(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoAIGlossary=api;})(globalThis,function(){
 const terms=[
  {name:'null',pattern:/(?<![\p{L}\p{N}_$])null(?![\p{L}\p{N}_$])/u,en:'As a JavaScript language value, null explicitly means “no content”: an empty value.',zh:'作为JavaScript语言值时，null是用来明确表示“没有内容”的空值。'},
  {name:'true / false',pattern:/(?<![\p{L}\p{N}_$])(?:true|false)(?![\p{L}\p{N}_$])/u,en:'As JavaScript language values, true and false mean “yes” and “no”; a condition uses them to decide whether its test is satisfied.',zh:'作为JavaScript语言值时，true和false表示“是”和“否”；判断代码据此决定条件是否成立。'},
  {name:'undefined',pattern:/\bundefined\b/i,en:'As a special JavaScript value, undefined means there is no concrete value.',zh:'作为JavaScript特殊值时，undefined表示没有一个具体值。'},
  {name:'object',pattern:/\bobjects?\b|对象/i,en:'An object is one value that groups pieces of content by name. In the general notation { name: value }, name labels a piece and value is its content. Assigning an object to a variable lets that variable refer to the whole object; it does not automatically read one piece or copy the object.',zh:'对象是把多项内容按名字组织在一起的一个值。一般示意 { name: value } 中，name 是一项的名字，value 是对应内容。把对象赋给变量，是让变量记住整个对象，不是自动取出其中一项，也不是复制对象。'},
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
