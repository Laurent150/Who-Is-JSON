# Who Is JSON 架构说明

2026-10-08 当前点读：仅精确官方HTTPS DeepSeek Flash个人配置的词／符号、明确pointReading意图的行／段与快捷追问使用一次局部成稿，两种阅读模式均适用。标准单行high，其余low；保留用户model，max_tokens=6000包含思考余量，timeout120秒。不追加泛用输入输出义务、模型复核、终审或自动重试。源码、UTF16选区和实际问题核验后原样传入；普通自由问题、其他provider／model及网关保留既有路线，不从静态标记推定已部署能力。

官方direct词符使用严格definition/effect及可选details字段；已验证的JS/TS零基础单行调用-await-标识符保存也使用此局部结构，交付完整纯文本，其他行／段仍为纯文本。字段原字符以空行连接，不做语义删句。仅有限兼容实测且键集合精确的type=json_object回显；未知字段／kind／type、空或错误类型、无效JSON和截断拒绝，不自动修复。词符2400字符保护保留，行解释不套此上限，legacy协议不扩为新shape。

局部风格入口只决定表达职责，不证明绑定或运行类型。调用名称说明可见调用而不从译名猜业务；简单Python参数连接数据含义、当前运算及实参，复杂声明保守回退；标准Python复合赋值保留实际两侧条件。JS/TS选中if/else中的null检查与同来源属性赋值按既有AST选择窄职责，说明取名称对应内容并保存，条件不保证另一分支任何值都可读取。段落以实际选区描述范围、成功条件和捕获类别，不强制类型或异常教程。源码不执行，未增加解析进程或依赖。

public/point-display.js将配对行内格式标记显示为等宽code DOM，用浅色面板高对比语法配色区分名称、关键字、字符串和数字，不另加装饰性引号。代码围栏隐藏但内部字符串引号及模板字符保留；只用安全文本节点，未标记的普通引号不猜测或删除，不改源码。词法类别仅用于视觉，不证明类型或绑定。两档按自然语义分段，不固定段数。JS/TS零基础同页object、undefined、true/false、null等语言概念卡不推断当前同名变量类型；标准模式不显示教学卡。浮层异步内容增长后重新定位、限制视口并可内部滚动，源码滚动关闭与取消／过期响应保护保留。canonical answer和source保留；收藏输入仍是原answer加已有零基础术语说明，展示DOM及颜色不会写入存储；因术语说明存在，不声称所有收藏plain等于provider原始字节。

最终有限验收：原80项重新核准为46项无备注通过、34项带非阻断备注通过、0必修未解决；新32、手动4、额外分支4和行内异常1在完整有效请求及必要UI证据上通过。原候选7统一80/80结论已撤回，历史记录保留。结果不保证随机输出、全部语言或全软件质量。CloudBase／其他服务模型、安装器和部署未同条件验证；样本源码未执行。用户要求本轮完成后暂停其他语言测试，等待新指令。工程来源见VALIDATION。

2026-10-07 已选代码评审成稿接入：默认成稿按受众选择非技术M4、同事M2、代码评审CR2（`ai-talk-code-review.js`）。CR2中文保留已测融合成稿提示，英文按同一评审要求独立撰写。用户选择保留原版复核，不接入新融合复核。三类讲解稿默认均为源码约定分析→成稿→现有复核→本地校验交付，不追加模型终审；既有有限格式修复、失败拦截及受控离线终审保持可用。中文两份保存响应通过正式入口回放，成稿提示、原版复核请求与最终正文均一致。英文通过工程链路检查，未新增真实模型质量验收。以下日期相同但更早的“代码评审E／保留终审”说明是历史状态。

2026-10-07 代码评审输出保护额度：官方 DeepSeek Flash 的 `talk/review` 受众各阶段上限为65536（含思考），本地单次等待上限420秒；其他受众和服务配置不变。源码分析现在接收已校验的受众设置，避免漏用该额度。CloudBase使用独立的`code-review-64k-v1`能力标记，部署后仅在确认实际网关支持长请求并启用环境开关时开放；提供方360秒、网关客户端400秒，旧云端在扣费前阻止不兼容的大额度请求。浏览器代码评审整条链路上限70分钟，覆盖既有最多9次有界请求及队列余量，可随时取消；这不是通常生成时长。额度调整不改提示、思考强度、成稿版本、自动重试或计费算法，不构成真实可靠性验证。见[云端部署说明](cloudbase/AI_TRIAL_DEPLOYMENT.md)。

2026-10-07 当前同事交流由`ai-talk-peer.js`提供方法2：中文保留已选提示，英文按等价要求独立撰写。`ai-talk-composition.js`按受众默认选择非技术M4、同事M2、代码评审E。前两类在现有复核和本地校验后交付，不默认调用AI终审；代码评审保持原策略，受控离线评估仍可显式启用终审。新增复核适配未证明收益，因此不接入；分析、复核和格式处理规则保留。工程接入不代表英文真实模型质量已验收，详见[整合说明](docs/AI_INTEGRATION.md)。下列日期更早的说明为历史状态。

当前发布版本：1.1.0。本文保留历史实现说明；现行入口是三列 AI 工作台和独立 AI 讲解稿，操作方式见 [README](README.md)。

2026-10-05 最新成稿策略：`ai-talk-method4.js` 为入门理解／非技术讲解稿提供方法4，中文保留已选提示，英文按等价教学要求独立撰写；两种语言共用源码分析、成稿、现有复核、本地校验及既有有限格式修复，默认没有AI终审。同事交流和代码评审仍用E，环境变量保留E/B回退。489项自动测试与19份发布样本检查验证工程接入，不代表英文新增真实模型质量已验收；旧产品进程与安装包未更新。以下10月4日“方法4尚待整合”是当时状态，现状以本段和[整合说明](docs/AI_INTEGRATION.md)为准。

2026-10-04 最新交付策略：入门理解／非技术受众讲解稿在现有 AI 复核和本地最终格式校验后直接交付，不再默认运行 AI 终审及其局部修复链路。中英文及两种阅读模式均适用，正常请求数从4减为3，最多6次含既有协议纠正。其他讲解稿受众和其他解释入口保持既有策略，原终审仍可由受控的离线评估显式调用。本次未切换成稿提示，方法4尚待独立整合。下文终审整合描述为历史基线，当前范围以[整合说明](docs/AI_INTEGRATION.md)为准。

2026-10-03 本地整合基线：默认讲解稿采用已测 E 成稿提示与独立写作示例，官方 DeepSeek Flash 和当前 CloudBase 网关源码使用 high 思考；函数约定仍为 low。`ai-talk-composition.js` 的 E 提示不叠加旧成稿指令，完整源码、语法上下文、函数笔记和全部设置仍传入。`WHO_TALK_COMPOSITION=B` 可由启动进程的环境切回已测 B＋high，仅影响成稿；这不是请求体选项。其他模型/兼容服务不获得 DeepSeek 专有参数。旧 Supabase 试用适配器仍使用原策略，不宣称与当前 DeepSeek/CloudBase 配置一致。

E 是针对零基础阅读目标选定的产品基线，不是统计意义上的获胜者。小样本中 B/E 严格评分均7/8；E有局部术语解释优势，也有局部歧义和冗余。未重新融合提示。修改后的现有复核、严格字段引用兼容及终审冗余编号兼容继续使用；失败的终审逻辑提示不恢复。终审仍可能漏检，模型放行不构成正确性证明。详见 [整合说明](docs/AI_INTEGRATION.md)。

讲解稿独立链路：`public/talk.js` 管理用户触发、设置、取消和过期响应；`/api/talk` 校验源码大小并调用 `ai-talk.js`，直接根据源码和阅读基础/详略/范围生成结构化完整稿件。服务端校验模型输出，不拼接本地语义，也不接受模型虚构的源码定位。`public/presentation.js` 保留旧稿件模型兼容与 Markdown 导出，当前页面不再调用其本地模板生成器。AI 工作台中的零散回答不是讲稿事实来源。

`ai-talk-policy.js` 按中英文、受众、解释模式、详略和覆盖范围组合具体写作要求。`ai-talk-audience.js` 提供三类受众的要求、独立正反示例、写作计划与复核要求；`ai-talk.js` 校验设置，并将写作计划作为独立消息传入。界面使用入门理解、同事交流、代码评审；旧 nontechnical 值兼容映射至 beginner。受众决定知识前提与关注点，模式决定表达，详略决定深度，范围决定覆盖内容。入门稿使用面向完整讲解的事实核对要求，不继承流程图必须填写技术 output 的指令；其他解释入口的规则保持独立。提示词与模拟验证不构成模型内容准确性保证。

当前默认讲解稿链路为 `contracts`：第一次生成可错的函数约定笔记，第二次依据完整源码和笔记撰写成稿，第三次独立核对原始源码与成稿，并通过 `ai-review-patches.js` 事务性修正已有文字字段。引用只验证来自原始源码，不证明语义正确。事实笔记的结构或引用无效时最多增加一次约定协议纠正；稿件在复核前先验证原有JSON结构，复核无效时最多增加一次复核协议纠正，服务失败、取消或仍然无效时不返回未复核稿件。`WHO_TALK_PIPELINE=direct` 保留旧的初稿＋独立复核对照链路。两种链路均保留完整原文，不执行用户源码，不接受模型新增位置或结构。

官方 DeepSeek Flash 个人连接及支持新版策略的 CloudBase 试用连接中，约定阶段使用 low 思考、16384 输出上限，成稿关闭思考并使用8192上限，独立讲解稿复核使用 high 思考及24576上限；词语、语句、流程等解释保持初稿＋独立复核，复核使用 high 及16384上限。CloudBase 网关白名单接受 low/high，仍固定模型、输入上限和总输出上限，不开放客户端自选模型或max思考。旧试用适配器未声明能力时保持原有非思考参数。线上必须更新网关后才能生效；新网关的健康、额度和生成响应带 `policyVersion: review-thinking-v1`，生成响应另带实际接受的思考配置。

`ai-logic-policy.js` 为各解释入口及成稿复核提供中英文的且/或/非、独立条件与互斥分支、边界及绝对结论反例检查。检查只作为模型要求，不将通用规则或模型笔记冒充解析器事实。模式、受众、详略与范围继续共同决定表达；点读保留局部选择，必要术语在原位置解释，不为简短删掉关键条件。`ai-usage.js` 保留分阶段计数，推理token不重复累计；产品不再显示token/调用次数的状态长句。讲解稿前端总等待上限现为900秒，以容纳独立复核及三处各一次的协议纠正，各模型请求仍有原有时间和长度限制，可主动停止。

`ai-source-returns.js` 使用已有 TypeScript 解析器，为可解析的 JS/TS 源码提取直接返回参数的原文，以及真实选区所在循环的初始化、条件和更新表达式。记录只证明语法，不证明运行类型、路径可达或必然重试；遮蔽、嵌套函数边界及选区原文均保守核对。复核在有相关记录时始终接收这些证据，既核对初稿，也限制复核自己新增的绝对结论。其他语言没有这些提示时仍使用完整原文与共享检查规则，不伪造解析器证明。

事实复核基础 v1（实施步骤1—3）：`ai-review-context.js` 为讲解稿、总览、函数流程、词语及语句解释提供统一的语言、源码哈希、已核对选区、所属函数和模式信息。原文及各场景的表达提示保持独立；上下文加入模型输入，不加入产品输出。讲解稿三阶段共用同一份请求内上下文，点读的初稿与复核共用上下文，不增加模型调用。流程入口补传原始文件名；文件类型与声明语言冲突时保留信息并标记缺口，不凭文件名覆盖声明语言。

`parsers/review-javascript.js` 与 `parsers/review-python.py` 分别使用现有 TypeScript AST 和 Python `ast.parse`，记录常见条件、分支、参数、return/await/yield、循环、try/处理体/收尾及退出语句。Python 只通过隔离进程解析标准输入，不执行或导入输入；原始CRLF和Unicode位置由`parsers/review-syntax.js`再次核对。`ai-review-rules.js` 按这些语法种类生成六类检查要求，状态始终为“待核对”，不冒充语义通过。运行类型、可达性、外部实现及完成时间仍不能由这些记录证明。超限、语法失败、环境不可用、语言冲突和未覆盖语言均显式标记；既有专项提示暂时保留。

规则、分场景验收标准及步骤1—3限制见 [事实复核基础](docs/AI_REVIEW_FOUNDATION.md)。步骤4—5增加`ai-expression-review.js`的分场景双语表达要求，以及`ai-final-audit.js`对最终候选原文的独立模型检查。检查只判定、不改稿，报告绑定哈希并校验必查项及引用；未通过或协议无效时不返回草稿。整合后正常讲解稿4次、点读/流程/总览3次请求；函数约定、成稿格式和复核协议各至多纠正一次，讲解稿最多7次，点读/流程/总览仍最多4次。终审无新增重试。讲解稿页面总等待上限900秒，每次模型请求仍至多120秒，用户可主动取消。模型通过不构成语义证明。字段长度在检查前验证，避免随后截掉条件。机制的历史方案见 [步骤4—6](docs/AI_FINAL_REVIEW.md)。

函数约定 JSON 对一种已观察到的格式缺陷提供窄范围本地修复：仅在 `unknowns` 字符串数组后已有对象闭括号的位置补缺失的数组闭括号。不会补截断结尾、添加内容或放宽结构与逐字引用校验。其他无效协议仍走最多一次的模型纠正；格式成功不代表语义通过。

讲解稿协议由`ai-talk-format.js`调用`ai-talk-json.js`校验。问答为可选产品内容，模型遗漏`questions`时规范为空数组；显式提供的错误问答仍拒绝，标题及正文仍须完整。沿用已测的词法格式恢复：只本地移除字符串外的尾逗号、或空questions前已观察到的多余根闭括号。仅完整、容器平衡且单根对象的分隔符错误可请求一次模型修复；返回值必须保留全部解码字符串、顺序和容器层级。重复字段、错误结构、截断、改写正文或第二个对象均不能被修成“通过”。修复后仍经过内容复核与终审；不把结构可用当作内容正确。

本地真实对照工具为 `tests/ai-quality-server.cjs`：读取明确保存的修改前代码快照，以官方个人API模拟旧/新试用参数，比较旧/新链路与思考开关四组设置；支持讲解稿各受众、详略、范围及中英文两种阅读模式的词语/语句点读。每批最多6份，会话最多80次模型请求，失败停止本批。只记录固定自编源码、最终请求、模型正文与用量，不记录密钥、授权头或隐藏思考正文；人工核对基准不会传给模型。不具备快照时拒绝启动，不把当前版本冒称旧版。此工具的参数模拟不代替已部署CloudBase的付费、扣费和延迟验收。

手动模型对照由 `tests/talk-eval-runtime.cjs` 限定：只有评测标记、禁用云试用与本地输出目录同时存在时，才读取非秘密实验设置。Pro 对照复用用户已连接的官方个人服务，最多预留六份尝试，失败也计数；不写入或输出密钥，不改变产品默认配置。可选观测仅记录供应商返回模型名、最终文本和用量，不记录隐藏推理。生成稿件通过格式校验不代表事实或受众验收通过。

入门提示词的进一步候选由同一评测设置中的 `introComposition: "purpose-first"` 显式开启，仅作用于函数约定链路的入门受众。在原受众要求上补充首节只交代用途及输入，把具体时序、返回形式与失败条件放在对应正文旁说明。仍使用原JSON协议，不重排或改写AI文字，不增加模型调用。同事交流、代码评审和未启用此设置时保持原提示。先正文后开头的特殊协议及整体精简提示曾作对照，未显示可靠改善，已从当前实现撤回；生成原稿和实验快照仍保留在本机报告中。用途优先的入门开头现保留在B回退成稿中，仍不构成内容准确性证明。

返回与完成时机专项候选由本地评测设置 `asyncFocusRules: true` 单独开启，仅追加到函数约定链路的入门成稿提示。`ai-talk-async.js` 通过 TypeScript 语法树保守选择含函数体、无生成器且无解析错误的输入，提供中英文的即时返回、最终内容与是否仍有未完成操作三项区分，以及独立正反示例。语法选择不是语义证明，也不是完整语言识别；其他输入跳过该候选。仍以原源码为事实依据，不执行输入、不改写成稿、不增加调用，B回退成稿启用该候选，只有语法选择成立的入门输入才追加；同事和评审不追加该规则。

函数约定协议中的顶层 `purpose` 是可省略的辅助标签；缺省时不补造内容，所有函数字段、错误路径与原样源码引用仍必须完整有效。无效标签、多个JSON对象、缺少行为字段或无依据引用仍拒绝。两阶段均要求完成检查后只输出一个最终对象，不先输出草稿再追加修正版。入门成稿要求把错误类别限定与结果放在同段，不为不同返回形态追加共同结论；这是生成要求，不是生成后替换句子或本地修补事实。原样引用与成稿格式的拒绝规则保持不变，当前调用阶段见上文。

成稿协议显式说明非空 `questions` 必须为 `question`/`answer` 对象数组及既有长度限制，不需要问答或零基础友好阅读模式时用空数组。问题字符串数组仍由原解析器拒绝，不删除问题或补造答案来兼容错误返回；该说明不增加模型调用。

复核字段引用兼容：保留原字段编号及96个UTF-16代码单元的前缀目录，也接受该编号对应字段的完整原文作为`anchor`。两种引用都与修改前稿件精确比较，不裁剪空白、不模糊匹配、不猜测其他字段；替换文字保持模型原样，重复字段及非文字结构修改仍事务性拒绝。此兼容仅减少可机械恢复的协议失败，不代表复核内容正确率提高。

复核表达范围调整（2026-10-03）：仅在改稿调用中使用`ai-expression-review.instruction(options,true)`，事实纠错优先；只有明确妨碍所选读者理解时才优化表达，保留必要概念、例子及有用重复。讲解稿受众复核不再把重复本身判为必须压缩，点读的内部段落长度信号改为参考；用户明确请求的范围和详略仍须满足。默认表达标准、初次成稿与最终模型审核提示保持原样，不增加模型调用。10组同输入新旧对照显示有限的改动范围收敛和点读范围改善，不构成普遍准确率提升；模型仍可能多改或产生局部边界措辞风险。

## 本次实现

原文 → 复制恢复与语言识别 → 语法结构和源文位置 → 用途规则与 guide 模型 → 配置树或流程图 → 按需展开知识。

- `parsers/json-config.js`：JSON 有效性、层级、源文位置、转义还原和知识记录，不执行命令。
- `parsers/config.js`：保留 YAML/GitHub Actions；旧 JSON/npm 解释分支已移除，避免两套规则并存。
- `explanation/config-profiles.js`：通用数据、npm、有限 Claude Code 字段约定。未识别字段进入用途缺口。
- `explanation/shell-guide.js`：直接从 Bash 语法节点生成通俗说明，将变量名独立展示，不替换翻译结果中的文字来猜语义。
- `explanation/shell-purpose.js`：承载有限用途模式，与语法读取分开；这不是通用业务推理。
- `explanation/model.js`：统一用途、理由、例子、下一步与边界，复用 JS/Python/Java 已有分析。
- `public/guide-ui.js`：只展示解释模型与配置层级，不判断具体语言或应用字段的意义。
- `public/structure-ui.js`：组合结构导航、精确源文与学习面板。
- `public/knowledge/json.js`：独立 JSON 目录，复用现有收藏和导出。

核心 guide 字段：title、purpose、why、example、basis、limits；可选 subject、paths、decoded、input/output。源文保持一基行号、零基 UTF-16 列号，结束列不包含在引用内。

本轮重构了受反馈影响的解释链路，没有宣称整个历史项目已全部重写。其余解析器仍保留既有实现，后续按同一接口逐步整理。知识匹配与业务解释是不同证据；不提供无法可靠计算的完整理解百分比。

## AI agent 的后续位置

本版没有实现跨文件 AI agent，也没有为了设想引入未使用的 agent 框架。现有可选 AI 功能继续保留。

有价值的 agent 应处理具体问题，例如“这个 hook 最后检查什么”：在已授权项目范围内找到引用脚本，继续查看相关工具与配置，整理调用关系，再给出带文件位置的解释。反复调用模型本身不能证明准确性。

建议边界：

1. 本地解析、流程图、知识收藏在没有模型时仍可使用。
2. 用户主动进入深入理解模式，明确项目范围与模型来源。
3. 默认读取上下文；执行代码和修改文件属于独立能力，不与解释默认捆绑。
4. 项目文件、注释、网页中的指令作为待分析内容，不能扩大授权范围。
5. AI 补充独立标注来源、证据和不确定项，不覆盖本地解析事实。
6. 限制文件数量、上下文长度和调用次数；缺少证据时列出缺口。

agent 仍需要可用模型，可以是后续支持的本地运行方式或已授权服务。架构预留不代表已经能连接任意聊天账号。

## 验收原则

核对具体解释、原文位置和实际页面，并用字段变化、变量改名、未知配置与损坏输入反向验证。测试通过不等于第三方项目能运行，也不等于初学者一定看懂；后续需要用户复述用途、选择修改位置等可用性测试。


## 0.6.1：文件类型与制作说明

public/file-types.js 统一前端导入、后端文件名识别和悬浮窗收件白名单。parsers/dockerfile-reader.js 负责有限的逻辑指令与原文范围；explanation/dockerfile-guide.js 提供用途说明；parsers/dockerfile.js 按 FROM 组织阶段与知识。阶段通过通用 flowPresentation 提供图例和起止文案，界面不判断具体 Docker 指令。注释作为未核实作者说明传递，不参与代码行为判定。这不是完整 Docker 语法或构建验证器。


## 0.6.2：Python 解释与发布门槛

python_explain.py 从 AST、文档字符串与本文件定义生成可溯源说明；业务说明与源码事实区分。flow_python.py 保留 children、handlers、afterSuccess、finalizer 等路径；structure.js 的统一遍历及原文恢复同步处理这些字段。public/structure-ui.js 仅渲染模型，不判断特定 Python 库的业务行为。

public/file-types.js 提供支持范围目录。tests/python-acceptance.test.js 记录已知缺陷的内容要求；tests/release-gate.cjs 验证固定版本样本、边界和源文位置，输出被测文件哈希；tests/browser-release.cjs 检查真实界面、收藏和窄屏。新例子若暴露问题，应修正通用规则并加入回归；结构通过不等于语义完整。

## 0.7.0：源码事实供多处展示

`semantics_python.py` 与 `explanation/javascript-semantics.js` 生成标准调用和有限结构模式的行为事实，不执行源码。事实由语法节点产生，再同时用于 guide、流程节点和 learning 记录，避免为页面重复编写语义规则。

新增 guide 字段：id（知识主题）、input/output、naming、evidence（行列范围）、milestones（可跳转摘要）、related（本文件定义）。公共界面在解释后展示引用源码，然后展示名称、用途理由与独立示例。例子取自同一个知识目录；收藏保持原有存储结构。

Python 重试只匹配计数初始化为 0、小于已知正整数上限、单个 try、正常路径末尾 return、每个错误分支首先加 1 的有限模式；重置计数、非单位更新、continue 和复杂收尾不作有界重试结论。没有为某个业务函数名字硬编码解释。

名称覆盖与类型推断采取保守策略；按标准库含义解释仍不等于完整运行语义。方法动态重写、运行时导入、跨文件依赖和自定义编码器需要上下文。

build-info.js 给分析结果和健康检查提供构建编号；原始输入 SHA-256 在分析边界生成。局部恢复、复制格式处理会同步移动 guide 和知识记录的源码坐标。

## 0.7.1 教学呈现层

pedagogy_python.py 在语义识别之后生成 guide.plain（通俗用途/输入/输出/作用）、parts（真实 token 的 UTF-16 行列位置与上下文解释）、needsSource、validation。保留原有 purpose/input/output/why 供专业说明使用。函数文档来源依据实际 docstring 判断，不统一假称作者说明。

公共 guide-ui 只负责呈现上述字段；knowledge-ui 共用同一例子渲染器，支持可选 prerequisites、walkthrough、transfer、exercise。语义识别仍在原有解析与 semantics 层进行，不从名称猜测业务含义。符号拆解不能作为完整语义覆盖率。

SourceIndex 按原始换行与 UTF-8 字节列提取源码；Python 学习匹配复用本次分析的绑定信息，避免每个函数重新解析整份文件。浏览器的源码位置仍使用 UTF-16 列，中文与补充字符都有回归检查。

## 逐行阅读视图

Python 的 `line_reading_python.py` 从 AST 与现有教学模型生成逐句 reading 单元，`analyzer.js` 负责原文位置映射。浏览器的 `line-reading.js` 选择语句与整理知识，`line-reading-ui.js` 展示三栏并发起可选 AI 补充。其他语言复用现有 guide。详见 [接口与边界](docs/LINE_READING.md)。

流程节点点击复用已有源码范围，连接到同一份逐行选择状态。三栏在流程模式下位于图下方，独立逐行模式下复用同一个面板；不会因为导航重新分析源码。文件入口仅使用已有 script-entry 标记；没有该标记时请用户选择功能。

## AI 补充链路

`ai-client.js` 负责有界请求、错误分类和 AI 说明校验。整体 AI 分析返回按本地块 index 关联的用途、示例与术语，存入 aiOverview/aiExplanation；保留本地 blocks、controlFlow、guide、reading、status 与原文位置。前端先显示本地结果，再补充说明；取消或失败不清空本地结果。逐句追问由服务器从原文提取 selectedSource，避免模型自行计数行号。

## 三列 AI 工作台

`ai-flow.js` 为选中功能建立带固定节点 id、源码范围、分支和已确认本文件调用目标的结构，AI 仅补充节点标题、解释与例子，不改写调用关系或源码位置。`public/studio.js` 组合流程、源码和解释三列，按功能生成并缓存 AI 流程；词语位置使用 UTF-16 列，在服务端重新截取核对。源码或 AI 配置变化会取消请求并清空缓存。旧结构渲染代码保留用于兼容，但不再提供独立页签；讲解稿继续独立。

## 可选账户边界

`cloud-account.js` 仅承载 Supabase GitHub OAuth（PKCE）与收藏 RPC，由已有本机 API 令牌保护；上游访问令牌仅在服务内存中。`public/library-store.js` 为现有两种收藏提供本地/账户存储适配，`public/account.js` 处理登录、退出与版本冲突。数据库迁移启用 RLS，写入 RPC 从 auth.uid() 取所有者并原子比较版本。AI、解析器和源码解释流程不依赖账户服务。详见 docs/CLOUD_ACCOUNTS.md。

GitHub 登录使用单次随机 state 与服务端 PKCE verifier，回调只完成换取身份；原页面携带独立随机 ticket 轮询取得本机会话。过期/取消/重复回调被拒绝，回调页不反射 code 或令牌；浏览器授权窗口与原编辑器分离。

平台试用由 cloud-account.js 将已验证会话转发到 Supabase Edge Function；普通客户端无法选择代付模型或修改额度。函数验证 GitHub 身份，先原子预留、后按用量结算。个人 AI 配置仍可独立使用，密钥不进入发布配置。详见 docs/AI_TRIAL.md。

## FIMI 1.2.0：归并工作台

`public/flow-model.js` 为服务器和工作台共享的只读流程骨架，保持解析器 id、范围、分支、调用目标。`ai-flow.js` 仅附加 AI 语义，包括函数级 input/output；缺失字段明确提示并可重试，不从本地模板填补。`ai-review-patches.js` 允许复核这两个文字字段，继续禁止修改位置和身份。

`parsers/javascript-links.js` 使用现有 TypeScript AST 与符号绑定提取有限的当前文件直接函数调用。遮蔽、赋值、解构赋值、动态作用域、外部导入等不能确认为该定义时不添加链接，不改变原分析块或源文。

`public/studio.js` 统一函数、步骤、整行、多行与词语选择，分别标记范围；词语事件阻止冒泡，选择变化关闭旧弹窗并使旧回复失效。函数流程请求合并并发，按现有 source/config/version 生命周期清理；阅读模式和界面语言切换也重置。追问绑定发起时的选区，复用现有保存与源码快照功能。解释不写回源码编辑器。

函数请求的 `knownCallees` 仅包含解析器确认的同文件调用目标和原文，供 AI 沿已知实现解释返回值，避免将已提供的定义误报为外部缺失。中英文输出模式均在正式 JSON 示例中要求 input/output。


## FIMI 1.2.0 历史发布入口（现为B回退）

上述实验历史保留。当时发布默认改为函数约定→源码复核成稿，启用已抽查的purpose-first与asyncFocusRules；受众和语言范围不变，原提示文字冻结，不增加调用或改写输出。WHO_TALK_PIPELINE=direct仍供旧链路回归，显式评测选项可覆盖默认值。默认入口回归比较两种语言三种受众的实际模型请求，必须与此前显式候选配置一致；局部格式验证不等于内容语义证明。


## Walkthrough export

`public/walkthrough-export.js` renders the Word/Markdown menu in the first generated section header. Drafts and invalidated results have no export menu. Export uses the captured rendered walkthrough without additional model requests. Markdown retains the existing serializer; `public/walkthrough-docx.js` produces a browser-local UTF-8 OOXML ZIP with editable heading styles, explicit Latin/CJK/code fonts and source-preserving code indentation. Text is escaped as XML; the package contains no macros or external relationships. New browser assets are registered in the local server and desktop payload manifest.

Each final audit is an independent gate over its exact candidate. Protocol validation normalizes at most two entries for one required check only when status agrees and substantive reasons are identical, or one reason is an explicit same-as-above reference. This normalization never supplies missing checks, chooses between conflicting decisions, weakens hash/quote validation, or starts an extra model call. A candidate-claim prompt change was withdrawn after a six-call comparison still missed the targeted logical contradiction; that semantic checklist remains withdrawn. The retained compatibility rule is mechanical; passing the protocol is not evidence of semantic correctness.

Walkthrough delivery recovery now permits one local edit after a valid, narrowly grounded audit rejection. `ai-talk-recovery.js` restricts edits to at most six exact unique fragments across three fields, preserves all other characters, requires complete nonempty replacements and source anchors, then submits the whole amended candidate to a fresh independent audit. Uncertain, ungrounded or broader failures remain rejected; a second rejection never loops. Other explanation tasks retain their prior path. Normal walkthroughs still use four calls; all format allowances plus local recovery are bounded at nine. The browser allows 1140 seconds while individual calls retain their 120-second limit. Manuscript length guidance and useful repetition are not audit rejection criteria; serialization and downstream display safety bounds remain enforced.

The walkthrough schema drops only empty, unknown metadata after strict JSON parsing. It does not coerce required fields, discard populated extras, accept duplicate/reserved keys, or bypass either content check. This compatibility repair costs no model request. Saved failures and offline/browser results are recorded separately from any paid model evidence; see `docs/AI_INTEGRATION.md`.

## Beginner point reading: method 3 and paragraph review（历史legacy说明）

以下记录旧方法3；官方Flash明确点读两档已由顶部单次局部成稿覆盖。其他配置保留各自既有路线，不将本节两阶段说明视为当前统一策略。

`ai-point.js` routes Chinese and English beginner word explanations (`knowledge` with a verified token) and plain-text selected-line/passage explanations (`ask`) through the method 3 draft and paragraph reviewer. `ai-point-prompts.js` preserves the tested Chinese instructions verbatim. `ai-point-prompts-en.js` adapts the teaching goals and editing boundaries into natural English for nontechnical adults; it does not impose Chinese character quotas or require four headings. The draft receives the complete source and exact selection without legacy writing rules or syntax context. The review receives the same source/selection, locally generated review context and the original draft paragraph catalogue. Redundant token-neighborhood metadata is omitted; exact UTF-16 positions and source lines remain unchanged. Explicit follow-up questions are preserved. Both selection buttons use the appropriate language's default request instead of the former one/two-sentence constraint.

The normal chain has two model requests: draft, then review. Official DeepSeek Flash uses the measured 2200-token non-thinking draft and 16384-token high-thinking review when supported by the configured trial gateway. Other compatible providers retain the existing provider-parameter boundary. There is no independent model audit, automatic model retry or fallback to an unchecked draft on these two routes. `ai-point-paragraphs.js` applies all paragraph edits transactionally, rejects unknown/repeated IDs and empty edits, and preserves untouched paragraphs and separators exactly. Local source-position, response-format, cancellation, truncation and existing display-bound checks remain. Mechanical success is not proof of factual correctness or readability.

Standard reading mode, unselected questions, function-flow explanations and walkthroughs keep their existing pipelines. Method 3 token responses are definition answers; the existing explanation-saving UI remains available, without requiring a generated lesson-card schema. English integration tests establish routing, source preservation and protocol behavior, not native-speaker approval or live-model teaching quality. The desktop file manifest includes the new modules; this does not establish that an installer has been rebuilt or validated.
# 单词短卡片（2026-10-07，历史迭代）

零基础写作要求后续升级为`FIMI_BEGINNER_HOVER_V2`：采用用户新提示的作用优先、最多引入一个正式术语、标题去重、普通成人语言及极短类比仅按需原则；通常1—3句、中文60—80字以内，英文独立适配为55词以内，均非机械截断。初稿和复核共用该配置，复核同时保留有帮助的一个基础术语与必要行为条件。标准双语提示字节不变，单词点读均无模型终审；行读、段读和讲解稿不受影响。提示中的语法示例仅说明表达方法，不替代具体语言和源码判断。

同日后续：用户明确取消标准单词点读终审。中英文两档词语点读现均为初稿、复核、本地校验，不调用模型终审；复核失败仍不回退未核对初稿。短卡片初稿和复核明确要求JSON。DeepSeek JSON模式在传输前补足缺失的JSON指令，以免只给结构示例却缺少接口要求的关键词；已有合法提示不变，其他供应商和非JSON请求不受影响。

词语点读按`ai-token-prompts`的双语、双阅读档位短卡片要求生成与复核；不再套用方法3四步叙述。中文零基础/标准通常60/50中文字，英文45/35词，1—3短句单段；这些是写作目标，不是字符截断或付费重试条件。界面只收到definition的answer，不为单词扩写lesson。原始源码与精确选区继续核验，必要事实边界仍保留。

复核沿用已选的局部纠错原则，同时允许为卡片压缩无关扩写与重复。整张卡片以p1交给复核，确保多段坏初稿能在一次请求内改成单段；行读/段读继续按原段落编号处理，方法3提示保持字节不变。零基础点读仍两次调用；标准点读保留原有独立终审，不在本次写作调整中隐式取消。无新增自动重试、无机械按字数截断，已有2400字符显示边界保护保留。

## 单词点读：零基础 V3，单次成稿（2026-10-07，历史legacy说明）

本节记录当时对历史单词链路的调整；当前官方Flash明确点读以顶部为准。按用户最新选择，`ai-token-prompts.js` 的 `FIMI_BEGINNER_HOVER_V3` 以准确角色优先，再解释当前含义和最近一层作用。保留必要基础术语并就地简释，不再强制作用先于角色或每卡最多一个术语；通常两句、简单一句、复杂最多三句，中文通常70—110字以内，英文自然适配为70词以内。字数为写作指导，不凑下限也不机械截断。完整源码只用于判断当前对象，不扩写整段流程，不依据名称编造行为。

中英文零基础单词现在只调用一次初稿，保留精确选区核验、JSON协议、非空正文、取消、上游截断和2400字符显示保护；不生成复核上下文，不调用AI复核、终审或自动重试。初稿调用仍使用原2200 token及非思考设置。标准单词仍为初稿加复核、无终审，提示保持原样；零基础行读/段读仍为方法3加段落复核，讲解稿不变。本地校验只证明可交付格式，不证明内容事实正确或可读性达标。
