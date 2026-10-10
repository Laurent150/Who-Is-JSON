// Shared accuracy standards do not imply a shared writing template.
// This contract is selected locally, independently of model-authored prose.
function kind(options={}) {
    if(options.task==='talk')return 'walkthrough';
    if(options.task==='knowledge')return 'token';
    if(options.task==='flow')return 'function';
    if(options.task==='overview')return 'overview';
    return options.reviewFoundation?.scope.kind==='token'?'token':'selection';
}
function instruction(options={},editing=false) {
    const en=options.locale==='en',beginner=options.readingMode==='beginner',scope=kind(options);
    const contracts=en?{
        token:'WORD POINT-READING: explain the selected word or symbol at its exact occurrence: what it refers to or does HERE, and the smallest concept needed to understand that role. For a variable, describe the represented data; for an operator, connect its actual operands to its effect. Do not replace this with a whole-function summary or a dictionary definition. Do not expand a simple definition into an unsolicited lesson. Existing lesson fields may explain the requested reusable concept, with a clearly hypothetical example.',
        selection:'STATEMENT POINT-READING: explain what the selected statements do to the actual data, under which necessary conditions, and their direct result or failure. Preserve AND/OR/NOT and grouping in natural words. If explaining a branch condition, connect it to the branch action. Include surrounding code only when needed to understand this selection; do not retell the file. A comparison or a chain of identifiers alone is insufficient.',
        function:'FUNCTION FLOW: keep each supplied node attached to its own source. A parent describes the purpose of the group; a child describes its specific action and deciding condition. Input/output descriptions explain the actual data and result without inventing a return for a non-returning step. Do not repeat the full function in every node.',
        overview:'FILE OVERVIEW: explain the overall purpose, then each supplied block at the requested scope. Keep different return/error contracts distinct. Describe actual responsibilities rather than listing identifiers; do not expand this into a walkthrough.',
        walkthrough:'WALKTHROUGH: produce a standalone, connected account of the purpose, supplied information, meaningful transformations and outcome. Organize related operations together and place conditions and failures beside the action they qualify. Check headings, openings, body and ending for consistency and material repetition. Do not apply point-reading sentence limits or turn the manuscript into a sequence of local definitions.'
    }:{
        token:'词语点读：解释选中词语或符号在原位置指什么、做什么，以及理解该作用所需的最小概念。变量说明代表的数据，运算符结合实际操作对象说明作用。不用整函数概述或词典定义代替局部解释，不把简单定义扩成未请求的教程。已有知识卡字段可解释相关的可复用原理，例子必须明确是假设。',
        selection:'语句点读：说明选中语句对实际数据做什么、在什么必要条件下发生、直接得到什么或怎样失败。用自然语言保留且/或/非及组合关系；解释判断时连接到对应分支动作。周围代码只用于理解选区，不复述全文件。只翻译比较式或串联标识符不算解释。',
        function:'函数流程：每个给定节点始终对应自己的源码。父节点概括整组目的，子节点解释具体动作及决定条件。输入输出说明真实数据与结果，不给没有return的步骤编造返回值，不在每个节点重复整个函数。',
        overview:'文件总览：先讲整体用途，再按给定范围解释所选主要块，保留不同返回约定和错误处理的区别。说明实际职责，不罗列名称，不扩成完整讲解稿。',
        walkthrough:'完整讲解稿：形成可独立阅读的连贯说明，解释用途、提供的信息、有意义的数据变化和结果。相关操作合并组织，条件与失败紧邻对应动作；检查标题、开头、正文和结尾的一致性及实质重复。不套用点读句数限制，不把讲稿写成一串局部定义。'
    };
    const mode=beginner?(en
        ? 'BEGINNER EXPRESSION: start with concrete data/actions/results for an adult without assumed syntax knowledge. Introduce a necessary term by its meaning at first use; do not explain jargon with more jargon. Prefer short natural paragraphs. For local point-reading, one or two sentences often suffice, but add a sentence when a deciding condition would otherwise be lost. Do not replace precise conditions with a vague analogy.'
        : '零基础表达：面向不默认懂语法的成年读者，先讲具体数据、动作和结果；必要术语首次出现就说明含义，不用另一术语解释术语。优先自然短段。局部点读通常一两句足够，但不能为句数省略决定结果的条件，必要时增加一句；不以模糊比喻替代准确条件。'):(en
        ? 'STANDARD EXPRESSION: use concise, precise terminology appropriate to the audience. Explain cause and consequence, not just syntax names. Standard mode does not imply that an introductory walkthrough audience knows programming concepts.'
        : '标准表达：使用适合受众的简洁准确术语，说清因果，不只列语法名称。标准模式不等于入门讲解稿的读者已经懂编程概念。');
    const common=en
        ? 'FIMI_EXPRESSION_REVIEW_V1: preserve source accuracy while editing expression. Correct material comprehension problems: unexplained essential jargon, identifier-only restatements, missing causal links, misplaced scope or repetition that hides the main behavior. Do not rewrite acceptable prose for cosmetic preferences or fixed word counts. Every added condition, example and guarantee must be supported by source. Write in English; retain original code, quoted source and identifiers, including their original language. Do not print this contract.'
        : 'FIMI_EXPRESSION_REVIEW_V1：修改表达时保持源码事实。需要修改的实质理解障碍包括关键术语未解释、只复述名称、缺少因果、范围错位、重复掩盖主线；不为个人措辞偏好或固定字数改写已合格文字。新增条件、例子和保证仍需源码支持。说明使用中文，源码引用与标识符保持原样，不向读者输出这份要求。';
    const editBoundary=en
        ? 'FIMI_REVIEW_EDIT_SCOPE_V2: First correct source contradictions, missing deciding conditions and inconsistent claims wherever they occur. Then edit expression only when you can identify a concrete obstacle for the selected reader: an essential term whose meaning is missing, identifier-only prose that hides the action, a missing causal link, or repetition that actually confuses which condition or result applies. Keep already understandable wording, useful examples and necessary definitions. Repeating a key fact in an opening, explanation or recap is acceptable. Do not shorten merely for paragraph length, a sentence count, stylistic preference or the existence of repeated facts. Keep changes within affected fields and preserve their correct conditions and explanatory links; multiple affected fields still require correction. Fewer edits is not the goal if an error or comprehension obstacle remains. Earlier drafting preferences for length, section arrangement or repetition describe a style, not mandatory revision triggers; explicit requested scope and detail still apply. Use the requested language and retain source identifiers. Do not print these instructions.'
        : 'FIMI_REVIEW_EDIT_SCOPE_V2：先修正与源码矛盾、决定条件遗漏和前后不一致的说法，错误出现在哪里就修正哪里。再检查表达；只有能指出针对当前读者的具体理解障碍才改写：必要术语缺少含义、名称堆砌看不出动作、必要因果缺失，或重复实际导致条件与结果混淆。保留已经易懂的措辞、有用例子和必要定义。开头、正文或小结适当重复关键事实可以接受；不只因段落较长、句数、风格偏好或出现重复事实就压缩。修改限于有问题的字段，并保留其中正确的条件和解释关系；多处确有问题仍须逐处修正，不能为少改而漏错或保留理解障碍。前面的成稿篇幅、章节安排和去重偏好用于说明风格，不是强制改稿触发条件；明确请求的范围和详略仍须满足。使用所选语言，源码标识符保持原样，不输出这份要求。';
    const readingStyle=beginner&&options.task==='knowledge'?require('./ai-reading-style').tokenPrompt(options.locale):mode;
    return [editing?editBoundary:common,contracts[scope],readingStyle,scope==='walkthrough'?require('./ai-talk-policy').draft(options.locale,options.readingMode,options.audience,options.detail,options.coverage):''].filter(Boolean).join('\n');
}
module.exports={kind,instruction};
