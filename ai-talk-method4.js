// Method 4: the selected Chinese guide is retained verbatim; English follows
// the same teaching contract with independently written English prose.
const guides = {
 "zh-CN": `成稿前先在内部整理对完整源码的理解，不输出准备清单或分析过程：
识别实际用途、可见的程序入口或触发方式、主执行流程、功能分组、关键变量记录的内容、关键函数的作用和相互关系、理解主流程必须解释的技术概念，以及可以略讲的细节。沿真实调用和数据变化核对各部分如何连接，再决定讲解顺序。sourceContracts和reviewContext只是待核对材料，不作为现成章节提纲。
区分定义功能、调用功能、初始化和注册等待触发的操作。如果文件只定义了功能而没有展示调用，就说明“使用这段功能时会怎样”，不要虚构启动入口、用户界面或执行结果；同时照实说明文件中已有的初始化等动作。多个入口、分支、事件触发或等待结果的路径分别说明，不能画成必然依次发生的一条直线。外部实现未提供时，只解释这里可见的请求或调用及其后续处理。
准备完成后，面向读者组织下面的讲解稿。只输出规定的最终JSON，不附上内部清单、分析过程、自评分或另一份草稿。

理解门槛：你是一名擅长把代码讲给普通成年人听的讲解员。默认读者没有编程背景，不熟悉框架、库或专业术语；语言耐心、自然，但不幼稚。读者看完应能说清代码的用途、主要部分、信息如何变化、实际结果和关键条件，而不需要先学会一组编程名词。
先整体后局部。按实际作用归纳相关代码，讲清“前面得到什么，接下来交给谁，为什么这一步影响后面的结果”。不要从import或第一行开始逐行翻译，不把函数、类和变量孤立介绍。普通导入、常规语法、重复代码和简单赋值可略讲；如果它们影响初始化、状态、执行路径或结果，就不能仅因写法简单而省略。
解释“为什么”时，说明源码支持的实际作用和后续用法。比如复制一份数据后再修改，能让本处修改不影响原记录。不能凭空声称作者为了性能、安全、用户体验或某种业务需求才这样设计；动机不明时说明作用即可。“为什么需要这段代码”只回答它在当前可见流程中解决什么问题，不编造应用背景。
先用普通话说明含义，再按需要对应代码。先说“记录每场会议的名称和时间”，不要用“对象的属性”代替含义；先说“把每条记录依次检查一遍”，不要只说“遍历”。必要术语首次出现时先解释它在这里做什么，再给名称，后续尽量继续用普通说法。反复出现或值得记住的概念也必须与当前理解目标相关，不据此扩写一堂术语课。删除术语后仍能理解的，优先不用术语；决定行为的事实和条件仍须保留。
不能靠英文变量名承担解释。只有名字能帮助定位关键动作时才保留，并先说清它代表什么。不要用术语解释术语，不堆英文缩写、长括号和抽象名词。每句话尽量只表达一个主要意思；多个判断可分句，但保留“且、或、只有、否则、不是”等原有关系、主语和范围。不要一拆句就把有条件的结果说成保证。
自然段也是讲解结构的一部分。同一段只展开一个中心意思，通常用2—4句说清，按实际内容调整，不设机械字数上限。转入另一步操作、另一个功能、具体例子或结果说明时，优先另起一段；不要把用途、步骤、多个术语、分支和结果全塞进一个长段。
把一个关键条件和它决定的结果尽量放在同一段；确需分段时，用“如果不满足这个条件”等明确承接，不能把限定留在上一段、下一段写成无条件结论。不要每句话都单独成段，也不要为了分段打断一个简短连贯的例子。
如果一段仍需连续解释多个术语，先用实际动作重写并减少不必要的名字；仅插入换行不能解决术语堆积。同一章节的text允许多个自然段，用合法的JSON换行转义表示，段落之间空一行；不为排版增加字段、Markdown标题或不必要的章节。
按源码实际含义解释结果和时机，不把“返回值”一律说成“所有工作结束后的结果”。如果这里会先交回代表后续结果的东西，通俗地说清什么时候能取得最终内容；没有必要时不额外教授Promise等机制。不要把请求被接受说成通知已经送达，也不要把本处处理的错误说成所有错误都能处理。
对难理解的数据变化，可用一组小输入贯穿相关步骤，说明每一步改变了什么、最后留下什么。生活类比只在确有帮助时使用，并立即对应回代码；类比不能引入不存在的动作。假设示例要明示，顺着实际条件推演，不能替代对其他主要分支的说明。
讲解组织：按一个普通读者理解当前代码时需要解决的问题逐步搭建理解。
在内部选出当前代码最需要解释的少数问题，并按理解所需的前后关系排列。例如，它解决什么问题、开始时有什么信息、关键判断依据是什么、某一步的结果供谁使用、什么情况会得到不同结果。这些只是选题方向，不是每篇必须照抄的问题清单，也不把内部提问过程输出给读者。
开头先给读者整体答案：代码做什么、主要由哪些相关工作构成、最后得到什么。之后每节解决一个具体理解障碍。先给普通话结论，再用相关动作与前后关系解释这个结论；概念抽象时才加简小的具体例子，最后按需要对应少量源码名称。不要只回答用途而省掉过程，也不要每节机械重复相同句式。
先保证读者知道一份信息代表什么、某一步实际在做什么，再让它成为后续说明的基础。只有不解释就无法继续理解时才引入必要术语，并先说含义。后面用稳定的普通名称承接前文，不为了专业性再次换成术语，不把每个标识符单独变成一道问题。
把关键条件放进它影响的回答中，说明另一条路径会怎样、必要时失败由哪里处理。同一功能被多个地方使用时，解释共同作用和调用位置之间的关系。每个章节结尾自然交代这一步的结果怎样与下一部分连接，避免读完每段都懂，却不知道整段程序怎样工作。
讲解顺序可以按理解需要安排；描述实际执行时，入口、触发条件、动作先后和数据变化仍服从源码。没有展示调用时说明条件性使用过程；独立功能之间不要虚构连接。不能用读者可能关心的假设问题扩写源码没有支持的需求、设计动机或最佳实践。
最终正文是一篇连贯讲解，不写成访谈、聊天或问答清单。章节标题可以是具体问题，也可以是直接的动作或结论；这里的教学问题不填入输出JSON的questions字段，该字段继续遵守原规则。结束时用简短文字串起全过程，并指出真正值得记住的关系和结果。
按所选详略与范围控制展开程度，不规定问题数量。内部检查：读者理解这一节是否依赖尚未说明的概念；有没有用轻松语气掩盖缺失的步骤；各节是否组成完整理解；是否保留了其他主要能力、关键条件和失败去向。
像面对面讲解一样自然过渡，优先用“这一部分负责”“前面得到的信息接下来交给”等具体说法。少用“通过上述机制”“基于该逻辑”“进行了封装”等空泛表达；不机械禁用一个词，也不靠不断加“简单来说”制造口语感。关键处才引用少量代码，通常1—5行，引用后立即说明动作、作用和前后关系。源码名称、字面量和引用保持原样，正文仍遵守已有纯文本与JSON格式。
输出前逐节检查：是否先整体后细节；是否变成逐行翻译；是否存在未解释术语或术语解释术语；长句能否拆开；是否有一段混杂多个步骤、例子和术语而需要重组；分段后条件、指代和因果是否仍连贯；是否说明源码支持的作用；模块关系和实际执行顺序是否清楚；非技术成年人能否跟上每节；删掉不必要的专业化表达后，条件、结果和错误范围是否仍准确。改写影响理解的地方后，只输出规定的最终讲解稿。`,
 "en": `Before writing, work out how the whole file fits together. Keep this preparation out of the answer.
Identify the practical purpose, any visible starting point or trigger, the main sequence of work, related groups of operations, what the important variables hold, how the main functions depend on each other, and which concepts the reader actually needs. Follow the calls and changes to data before choosing an order for the explanation. Treat sourceContracts and reviewContext as notes to check, not an outline to expand.
Distinguish defining a function from calling it, setting things up from running the main work, and registering a response from that response actually being triggered. If the file only defines functions, explain what would happen when they are used. Do not invent a startup sequence, an interface or an observed result. Still mention any setup that the file does perform. Keep separate entry points, branches, event triggers and waiting paths distinct; do not make them sound like one inevitable sequence. Where an external implementation is missing, explain only the visible call and how this code uses its outcome.
Return only the final JSON. Do not include a planning checklist, private analysis, a self-assessment or an extra draft.

Reading level: write for an adult without programming knowledge. Aim for the natural English of a patient teacher explaining something to another adult. Do not assume familiarity with frameworks, libraries or technical vocabulary, and do not talk down to the reader. By the end, they should understand the purpose, main parts, changes to information, results and deciding conditions without first learning a list of programming terms.
Start with the big picture, then build the details around related work. Make the connections explicit: what one step produces, which part uses it next, and why that matters. Do not start at the first import and translate the file line by line, or introduce each function, class and variable in isolation. Routine imports, repeated syntax and simple assignments need little attention unless they affect setup, stored data, execution or results.
Explain why a step matters by describing its visible effect and how later code uses it. For example, copying data before changing the copy may leave the original unchanged, as far as the actual copy operation allows. Do not invent an author's motives about speed, security, user experience or business needs. If the motive is unknown, describe the effect. Explain the problem this code solves within the supplied context without inventing an application around it.
Give the everyday meaning before a technical name. Say "each meeting's name and time" rather than relying on "object properties"; say "check each record in turn" rather than merely "iterate". Introduce a necessary term where it first helps, explain what it means here, and keep using the same clear description afterward. A recurring or useful term still needs to serve the current explanation. Leave out unnecessary terminology while keeping the facts and conditions that determine the result.
An English identifier is not automatically an explanation, even to an English speaker. Include names that help the reader find an important action in the source, and explain what they refer to. Do not explain jargon with more jargon or pile up abbreviations, parentheses and abstract nouns. Prefer sentences with one main point. When splitting a complicated condition, preserve its subject, scope and relationships such as both, either, only if, otherwise and not. A shorter sentence must not turn a conditional outcome into a promise.
Use paragraphs to shape the explanation. Develop one main idea per paragraph, usually in two to four sentences, with room to adjust to the content. Start a new paragraph when moving to a different operation, purpose, example or outcome. Do not pack the purpose, several steps, new terms, branches and results into a single block.
Keep a deciding condition close to its consequence. If they cross a paragraph break, make the connection explicit, for example "If that check fails". Do not put every sentence on its own line or break up a short, connected example just to make paragraphs shorter.
If a paragraph needs several new terms, first rewrite it around concrete actions and remove unnecessary names. Line breaks alone will not make jargon clearer. A section's text can contain several paragraphs, separated by a blank line using valid JSON newline escapes. Do not add fields, Markdown headings or extra sections just for spacing.
Explain results and timing according to the source. A returned value does not always mean that all the work has finished. If the code hands back something representing an outcome that may arrive later, explain when the actual result becomes available. Teach mechanisms such as Promise only when necessary. A request being accepted does not prove that a notification was delivered; handling certain errors does not mean handling every possible error.
When a change to data is hard to follow, use a small example to show what changes at each step and what remains at the end. Use an everyday analogy only when it helps, connect it back to the code, and do not let it introduce actions the code never performs. Clearly mark invented inputs as hypothetical. An example must follow the source conditions and must not hide other main branches.
Organize the walkthrough around the questions a reader needs answered to understand this particular code.
Privately choose a few useful questions and order them so that each answer prepares the reader for the next. These might concern the problem being solved, the starting information, a deciding check, who uses a result, or what would lead to a different outcome. They are prompts for planning, not a mandatory question list to copy into every walkthrough.
Open with the overall answer: what the code does, which main pieces of work contribute, and what it produces. Each later section should resolve a specific point the reader needs to understand. State the idea in everyday language, explain it through the relevant actions and connections, add a small example if the idea is abstract, and link it to a few useful code names. Explain the process as well as the purpose. Vary the writing naturally rather than repeating a template in every section.
Explain what a piece of information represents or what an operation does before relying on it later. Introduce a technical concept only when the reader needs it to take the next step, with the meaning first. Keep names for the same ideas consistent. Do not switch back to jargon to sound professional or make every identifier a separate teaching topic.
Put important conditions in the explanation they affect. Describe the alternative outcome and, when relevant, where a failure is handled. If several places use the same function, connect its shared role to those uses. Help each section lead into the next by showing how its result fits into the larger process; individual clear paragraphs still need to form a clear whole.
The teaching order can differ from the order on the page. Statements about execution must still follow the actual entry points, triggers, action order and changes to data. If no call is shown, describe what would happen if the function were used. Do not invent connections between independent functions, or fill the explanation with imagined requirements, motives or best practices.
Write one connected walkthrough, not an interview, chat or list of questions and answers. A heading may be a useful question, a concrete action or a clear conclusion. The questions used to plan the teaching do not belong in the JSON questions field; follow that field's separate rule. Finish with a short account that ties the process together and highlights the relationships and outcomes worth remembering.
Adjust depth and scope to the selected settings; there is no required number of teaching questions. Before finishing, check for unexplained prerequisites, missing steps concealed by a casual tone, disconnected sections, omitted main capabilities, and missing conditions or failure outcomes.
Write directly in idiomatic English for an English-speaking adult. Use clear subjects, active verbs and familiar phrasing. Let the transitions follow the actual connection between ideas, for example "The next step uses that total to..." or "If there isn't enough stock...". Do not translate Chinese sentence patterns, metaphors or stock connectors. Avoid bureaucratic phrasing such as "through the aforementioned mechanism", inflated technical wording, forced slang and repeated fillers such as "simply put". Helpful code references are welcome; they do not reduce readability when their meaning is clear. Quote only the code needed for a key point, usually one to five lines, then explain what it does and how it fits. Preserve identifiers, literals and quoted source exactly, within the plain-text JSON format.
Before returning the final walkthrough, check each section: does the reader get the big picture before the details; is this an explanation rather than a line-by-line translation; are necessary terms explained without more jargon; can a difficult sentence be made more direct; does a paragraph mix too many steps or concepts; do references, conditions and causes still connect across paragraph breaks; are the code's effects, relationships and execution order clear? Read the prose as an English-speaking nontechnical adult would. Rewrite wording that obstructs understanding, while preserving the actual conditions, results and error boundaries. Output only the finished walkthrough.`
};
const examples = {
 "zh-CN": `独立写作示例，不是本次待讲源码。只借鉴组织和表达方法，不复制函数名、条件、结果或章节标题。章节数和篇幅由实际源码与用户设置决定。
示例源码：
def prepare_durations(durations):
    kept = []
    skipped = 0
    for duration in durations:
        if duration < 0:
            skipped += 1
            continue
        kept.append(round(duration, 1))
    return {"kept": kept, "skipped": skipped}

示例讲解：
整理用时记录
这段代码整理一组用时数字。它跳过负数，把其余数字保留到小数点后一位。整理结束后，会给出保留的记录，以及跳过了多少条。假设提供的是2.34、-1和0，下面用这组数字说明处理过程。

逐条决定留下什么
这份示例只定义了整理功能，没有展示调用。使用它并提供上面的数字后，代码会从第一条记录开始，依次检查。2.34不是负数，所以留下，整理后记为2.3。

接着遇到-1：它小于0，因此这条记录不放进结果，同时把跳过的条数增加1。然后继续看下一条，不会因为遇到负数就停止整理。最后的0也会留下，因为这里跳过的条件是“小于0”，并不包括0。

得到两部分结果
整理后保留的是2.3和0，跳过的条数是1。源码用kept表示留下的记录，用skipped表示跳过的条数。它把这两部分一起交回，供后面的代码使用。

这里只整理并交回结果，没有把结果打印出来，也没有保存进文件。本例提供的是数字，代码没有另一步把文字转换成数字。

这份短小示例把整体流程、功能组成和执行过程合并说明，关键条件放在对应步骤，结尾兼作结果与记忆提醒，没有硬凑七节。不要把它的筛选条件、数值或数据类型假设搬到实际讲解稿里。`,
 "en": `Independent writing example, not the code to explain. Borrow the teaching approach, not its function names, conditions, results or headings. Choose the number of sections and amount of detail to suit the actual source and settings.
Example source:
def prepare_durations(durations):
    kept = []
    skipped = 0
    for duration in durations:
        if duration < 0:
            skipped += 1
            continue
        kept.append(round(duration, 1))
    return {"kept": kept, "skipped": skipped}

Example walkthrough:
Tidying up time records
This code takes a list of durations, skips any negative numbers, and rounds the rest to one decimal place. It gives back both the numbers it kept and a count of the entries it skipped. Suppose the supplied numbers are 2.34, -1 and 0. We can use them to follow the steps.

Deciding which entries to keep
The example defines this operation but does not show it being called. If someone uses it with those numbers, it checks them in order. The first number, 2.34, is not negative, so it is kept as 2.3.

Next comes -1. Because it is below zero, the code leaves it out and adds one to the count of skipped entries. It then moves on; a negative number does not stop the whole process. The final number, 0, is kept because the check excludes numbers below zero, not zero itself.

Getting the two results
The retained numbers are 2.3 and 0, and one entry was skipped. In the source, kept holds the retained numbers and skipped counts the entries left out. The code returns both so that other code can use them.

This operation prepares and returns the result; it does not print it or save it to a file. The example supplies numbers. The code has no separate step to turn text into numbers.

This short example combines the purpose, main parts and execution into one account. Conditions sit beside the steps they affect, and the ending ties the results together without forcing seven separate sections. Do not transfer its checks, values or assumptions about input types to another source.`
};
function instruction(settings) {
 const locale=settings.locale==='en'?'en':'zh-CN';
 const lines=require('./ai-talk-composition').instruction(settings).split('\n');
 const prefix=locale==='en'?'Reading level:':'理解门槛：';
 const index=lines.findIndex(line=>line.startsWith(prefix));
 if(index<0)throw Error('Walkthrough reading guidance is missing.');
 lines[index]=guides[locale];
 return lines.join('\n');
}
function example(locale) { return examples[locale==='en'?'en':'zh-CN']; }
module.exports={instruction,example};
