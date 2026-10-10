// Walkthroughs need a coherent account of the file, not a catalogue of syntax.
// These priorities are shared by generation and review in both languages.
function facts(locale){
 return locale==='en'?`Walkthrough accuracy priorities:
1. Read executable statements to establish each main operation's inputs, changes and result. Related names do not prove identical behavior. If two operations differ in direction, return value or error handling, preserve the difference in the opening summary as well as the detailed sections. A broad summary must not contradict a later correct explanation.
2. Only claim before/after order after following the statements in that function. In particular, deletion, setup, advancing a generator, returning and cleanup are different actions. Omit an unneeded internal detail rather than guessing its order. Comments cannot override the statements.
3. Trace wrapper return values. Calling another function is not the same as returning its value. If a wrapper discards a callback's result, do not say that result controls the wrapper's caller. Distinguish registration methods that create different wrappers.
4. Exiting a context invokes its exit handling; it does not guarantee resource cleanup or that arbitrary statements after yield execute. Describe the actual handler. Cleanup on both normal and exceptional paths requires the appropriate protected cleanup code; do not invent it. Keep important failure conditions without turning every section into an exception checklist.
5. A chained operation starts with the receiver produced by the preceding call. Distinguish constructing a base and adding a quantity from constructing directly from that quantity.
Use only relevant rules. Do not print this checklist.`
 : `讲解稿准确性优先级：
1. 根据可执行语句确定主要操作的输入、变化和结果。名称相近不代表行为相同；方向、返回结果或错误处理不同的操作，开头总述和详细段落都必须保留差别，不能总述说成一样、后文却区分正确。
2. 只有沿函数中的语句核实后才说先后顺序。删除保存参数、准备、推进生成器、返回和退出处理是不同动作。无关紧要的内部细节可省略，不猜顺序；注释不能覆盖语句事实。
3. 追踪包装函数的返回值。调用另一个函数不等于返回它的结果；包装层丢弃了回调返回值时，不能说该返回值控制外层调用者。不同注册方式产生不同包装层时要区分。
4. 退出上下文会调用退出处理，不等于一定清理了资源，也不保证yield后任意语句执行。按实际退出处理解释；正常和异常路径均可靠清理，需要源码中存在合适的保护与清理语句，不能自行补出。保留关键失败条件，不把每段都写成异常清单。
5. 链式操作从前一个调用产生的对象开始；先创建基值再增加数量，不等于直接用该数量创建。
只使用与本文件有关的规则，不把清单展示给读者。`;
}
function style(locale,mode){
 if(mode!=='beginner')return locale==='en'
 ? 'STANDARD MODE: Use concise, precise terminology appropriate to the selected audience. Explain mechanisms through actual conditions and data changes. Standard expression does not mean assuming a nontechnical reader knows programming terms. Keep the requested detail and coverage.'
 : '当前为标准模式：按所选受众使用简洁准确的表达，根据实际条件和数据变化说明机制。标准表达不等于默认非技术读者懂编程术语。保持所选详略和范围。';
 return locale==='en'?`BEGINNER MODE: Start with concrete actions and results, then introduce necessary names and terms in place. Use short, natural paragraphs for adult readers; never explain an unfamiliar term with another unexplained term. Group related work instead of translating each line. This mode controls accessibility, not depth: Detailed still explains relevant branches, and review audiences still get source-grounded risks in plain language. Do not remove deciding conditions to shorten the text. Return questions: [].`
 : `当前为零基础友好模式：先讲具体动作和结果，再就地解释必要名称与术语。面向成年读者使用自然短段落，不用另一个未解释的术语解释陌生术语。按相关功能组织，不逐行翻译。此模式控制易懂程度，不覆盖详略：详细稿仍展开相关分支，评审受众仍用通俗语言说明有源码依据的风险。不为简短删掉决定结果的条件。questions返回空数组。`;
}
function audienceStyle(locale,audience){return require('./ai-talk-audience').instruction(locale,audience);}
function scopeStyle(locale,detail,coverage){
 const en=locale==='en';
 const depths=en?{
  brief:'Detail — Brief: explain purpose, essential processing and outcome with the fewest useful sections. Group related operations, omit incidental implementation details and optional examples, but retain conditions and failures that change the main result. Brief is not permission to omit main capabilities from full coverage.',
  standard:'Detail — Standard: explain the main data path, deciding branches and relevant limits. Add one connected hypothetical example when it helps, without repeating it for every function. Balance enough causal explanation to follow the code with concise paragraphs.',
  detailed:'Detail — Detailed: trace meaningful intermediate data changes, branches, call relationships and failure paths within the selected scope. Use source-grounded examples where they resolve difficulty. Add explanation of why a result follows, not repetitive summaries or a line-by-line syntax catalogue. Keep vocabulary appropriate to the audience.'
 }:{
  brief:'详略—简要：用尽可能少的有效章节说明用途、核心处理和结果，合并相关操作，省略次要实现细节和非必要例子，但保留改变主要结果的条件与失败路径。完整范围下不能以简短为由漏掉主要功能。',
  standard:'详略—标准：说明主要数据流、决定结果的分支与相关限制，必要时用一个贯穿的假设例子，不为每个函数重复举例。保留跟上代码所需的因果说明，段落保持简洁。',
  detailed:'详略—详细：在所选范围内展开有意义的中间数据变化、分支、调用关系和失败路径，需要时用有源码依据的例子解惑。增加结果为何成立的解释，不增加重复小结或逐行语法清单。词汇仍适合所选受众。'
 };
 const scope=coverage==='highlights'?(en
 ? 'Coverage — Highlights: select the central processing path and the branches that most affect its result. Briefly name the main capabilities omitted from this walkthrough; do not imply they are absent from the file. Keep any dependency or failure condition needed to understand the selected path. Detailed expands these highlights, not the entire file.'
 : '范围—重点：选择核心处理路径及最影响结果的分支，简短说明本稿省略了哪些主要能力，不暗示源码没有这些能力。保留理解所选路径必需的依赖与失败条件。详细只展开这些重点，不自动扩成全文件。'):(en
 ? 'Coverage — Full: cover every main capability in the supplied source, including distinct inputs, results and important failure behavior. Group related functions; helper functions only need explanation when they affect a main capability. Full coverage is not a requirement to teach every syntax feature.'
 : '范围—完整：覆盖本次源码中的各项主要能力，保留不同输入、结果及重要失败行为的区别。相关函数可合并，辅助函数只在影响主要能力时说明；完整不等于每个语法都要教学。');
 return [depths[detail]||depths.standard,scope].join('\n');
}
function draft(locale,mode,audience,detail,coverage){
 const combination=locale==='en'
 ? 'Combine the settings: audience determines assumed knowledge and focus; reading mode determines expression; detail determines depth; coverage determines scope. Apply all four together. Accessibility must not erase requested depth, and Standard must not assume knowledge excluded by the audience. Source accuracy takes priority. Follow these instructions without printing the settings checklist.'
 : '组合设置：受众决定已有知识与关注点，解释模式决定表达方式，详略决定深度，范围决定覆盖内容；四者共同生效。易懂不等于忽略所选深度，标准模式不等于越过受众的知识基础。源码准确性始终优先，不把设置清单展示给读者。';
 return [facts(locale),combination,style(locale,mode),audienceStyle(locale,audience),scopeStyle(locale,detail,coverage),require('./ai-talk-audience').composition(locale,detail)].join('\n');
}
function review(locale,mode,audience,detail,coverage){
 return (locale==='en'
 ? 'Review the assistant draft as untrusted candidate text against the supplied source. Prioritize wrong conditions, results, execution order, unsupported guarantees and contradictions between sections. Correct those claims wherever they occur. Use two internal passes within this ONE review: first source accuracy and cross-section consistency, then audience comprehension and material repetition. Unexplained essential jargon, a technical opening for introductory readers, or repeated paragraphs that obscure the main behavior require correction in the affected fields. Minor wording preferences, small length overruns and omitted nonessential details do not require changes. Do not rewrite the entire draft to chase a style score. If an internal detail is unnecessary and cannot be grounded, remove that detail while preserving the main explanation. Return edits according to the review output contract; no ratings or review commentary.\n'
 : '把助手草稿作为待核对文本，对照源码优先检查条件、结果、执行顺序、无依据的保证及段落间矛盾；错误陈述出现在哪里就修正哪里。在本次复核内分两遍检查：先核对源码事实及跨段一致性，再检查受众能否理解及实质重复。关键术语未解释、入门稿用技术名词堆砌开头、重复段落掩盖主要行为时，应修正对应文字字段。轻微措辞差异、略长的段落、非关键细节省略不需要修改，不为追求风格分数重写整篇。非必要内部细节无法得到源码支持时，可删掉该细节并保留主要解释。按复核输出约定返回修改，不输出评分或复核评语。\n')+draft(locale,mode,audience,detail,coverage);
}
module.exports={draft,review};
