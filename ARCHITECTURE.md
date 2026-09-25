# Who Is JSON 架构说明

当前发布版本：1.1.0。本文保留历史实现说明；现行入口是三列 AI 工作台和独立 AI 讲解稿，操作方式见 [README](README.md)。

讲解稿独立链路：`public/talk.js` 管理用户触发、设置、取消和过期响应；`/api/talk` 校验源码大小并调用 `ai-talk.js`，直接根据源码和阅读基础/详略/范围生成结构化完整稿件。服务端校验模型输出，不拼接本地语义，也不接受模型虚构的源码定位。`public/presentation.js` 保留旧稿件模型兼容与 Markdown 导出，当前页面不再调用其本地模板生成器。AI 工作台中的零散回答不是讲稿事实来源。

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

`ai-flow.js` 为选中功能建立带固定节点 id、源码范围、分支和已确认本文件调用目标的结构，AI 仅补充节点标题、解释与例子，不改写调用关系或源码位置。`public/studio.js` 组合流程、源码和解释三列，按功能生成并缓存 AI 流程；词语位置使用 UTF-16 列，在服务端重新截取核对。源码或 AI 配置变化会取消请求并清空缓存。旧结构与讲稿作为资料视图保留。

## 可选账户边界

`cloud-account.js` 仅承载 Supabase GitHub OAuth（PKCE）与收藏 RPC，由已有本机 API 令牌保护；上游访问令牌仅在服务内存中。`public/library-store.js` 为现有两种收藏提供本地/账户存储适配，`public/account.js` 处理登录、退出与版本冲突。数据库迁移启用 RLS，写入 RPC 从 auth.uid() 取所有者并原子比较版本。AI、解析器和源码解释流程不依赖账户服务。详见 docs/CLOUD_ACCOUNTS.md。

GitHub 登录使用单次随机 state 与服务端 PKCE verifier，回调只完成换取身份；原页面携带独立随机 ticket 轮询取得本机会话。过期/取消/重复回调被拒绝，回调页不反射 code 或令牌；浏览器授权窗口与原编辑器分离。

平台试用由 cloud-account.js 将已验证会话转发到 Supabase Edge Function；普通客户端无法选择代付模型或修改额度。函数验证 GitHub 身份，先原子预留、后按用量结算。个人 AI 配置仍可独立使用，密钥不进入发布配置。详见 docs/AI_TRIAL.md。
