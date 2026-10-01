// Optional writing guidance, not a semantic analyzer. Never execute input code.
// Conservative syntax selection avoids applying JavaScript Promise rules to
// other languages, comments, strings, or generators.
function applies(source){
 if(typeof source!=='string'||!source.trim())return false;
 const ts=require('typescript');
 const file=ts.createSourceFile('input.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(file.parseDiagnostics.length)return false;
 let functions=0,generators=0;
 function visit(node){
  if(ts.isFunctionLike(node)&&node.body){functions++;if(node.asteriskToken)generators++;}
  ts.forEachChild(node,visit);
 }
 visit(file);return functions>0&&generators===0;
}
function instruction(locale){
 return locale==='en'?`JavaScript/TypeScript return-and-completion focus. Apply only to behavior established by the ORIGINAL source, not merely a keyword or the fallible ledger. The examples below are unrelated teaching examples, not facts about the supplied code.
Before explaining each public entry point, settle three separate questions: what its caller receives from this call; what contents may become available upon completion; and whether the source proves the delegated work is still unfinished when the call returns. Keep those distinctions in the actual prose, not just in private analysis. An ordinary async function returns a Promise, a value used to receive its completion outcome. Await pauses the remaining steps inside that function; the caller does not thereby receive the final contents synchronously. Say what the caller receives first, then describe what success or failure supplies through it. Never replace that with “it waits and then returns the finished contents” as the only description of the call.
A non-async function's return depends on its return expression: it may be an ordinary value, a Promise, or a record containing a Promise. Follow a visible wrapper's own return. If it calls an absent implementation, leave only that implementation's missing behavior unknown. Synchronous work in a delegated operation can finish before this call returns; a Promise can already be settled. Neither async, Promise.resolve nor absence of await proves unfinished/background/parallel work.
Independent examples and wording:
1. function twice(n) { return n * 2; } — “It calculates twice the supplied number and returns that number in this call.” Do not introduce a pending outcome here.
2. async function cleaned(read) { const text = await read(); return text.trim(); } — “The call gives back a result whose completion can be observed. When reading and trimming succeed, that result provides the cleaned text; if either fails, it reports failure.” Explain this result as a Promise if the name is useful. Do not say the caller receives cleaned text directly. Whether read itself still has work pending depends on read, whose implementation is absent in this example.
3. function relay(task) { return task(); } — “It returns whatever the supplied task returns.” Missing task code does not justify choosing either a synchronous value or a Promise.
4. function packet() { return { done: Promise.resolve(7) }; } — “The call returns a record containing a completion result that is already fulfilled with 7.” It returns the record, not the number or the Promise alone, and no ongoing task is shown.
Use these as patterns for reasoning, not a template to copy or an extra tutorial. Keep the whole manuscript readable by a nonprogrammer. In each relevant paragraph, make the source-supported return distinction explicit in ordinary words before summarizing what the work achieves. Headings and openings must not contradict it.`
 : `JavaScript/TypeScript返回与完成时机专项。只说明原始源码确实支持的行为，不因关键词或可能出错的约定直接下结论。下面是独立教学示例，不是当前源码的事实。
讲每个对外入口前，分开确定三件事：调用者在这次调用中拿到什么；完成后可能得到什么内容；源码是否证明调用返回时传入的操作还没有做完。这些区别必须保留在正文里，不能只在内部分析中正确。普通async函数交回Promise，即一个用来接收完成结果的值；await暂停的是该函数里面后续的步骤，不会因此让调用者同步拿到最终内容。先说当场交回的东西，再说成功或失败通过它提供什么。不能仅用“它等完后返回最终内容”描述调用。
没有async的函数要沿return表达式判断：可能交回普通值、Promise或包含Promise的一组信息。可见包装按它自己的返回说明；调用了缺失实现时，只把那部分未提供的行为留为未知。传入操作中的同步工作可能在这次调用返回前已经做完，Promise也可能已经有结果。async、Promise.resolve和没有await都不能证明操作还没完成、在后台或并行执行。
独立示例及写法：
1. function twice(n) { return n * 2; }——“它算出所给数字的两倍，并在这次调用中交回这个数字。”这里不要引入待完成结果。
2. async function cleaned(read) { const text = await read(); return text.trim(); }——“调用先交回一个可获知完成情况的结果；读取和整理成功后，可从中得到整理过的文本，任一步失败则从中收到失败信息。”确有必要再说明这种结果叫Promise；不能说调用者直接拿到了整理好的文本。示例未提供read，读取是否仍有工作尚未完成取决于它。
3. function relay(task) { return task(); }——“它原样交回传入任务的返回内容。”任务实现缺失，不能替它决定是普通值还是Promise。
4. function packet() { return { done: Promise.resolve(7) }; }——“调用交回一组信息，其中包含一个已经完成、内容为7的结果。”交回的是这一组信息，不是数字或Promise本身，源码也没有显示仍在进行的任务。
这些只用于推理，不照抄成模板或另加技术课。全文仍让没学过编程的成年人读懂；在对应段落先用通俗话明确源码支持的返回区别，再概括用途。标题和开头不能与这个区别冲突。`;
}
module.exports={applies,instruction};
