# 验证记录

## 0.8.0 发布验证

本次发布合并现有工作台与 README，统一应用版本号。实际验证结果与限制见 [0.8.0 发布说明](docs/releases/v0.8.0.md)。后续章节包含历史记录，不能把旧结果直接当作当前版本的新验收。

## 0.7.0 预览版验收范围（历史）

## 可以复现的检查

1. `pnpm test`：自编教学例子的预期结果；重试正反例、标准库别名与同名覆盖、源文位置和本文件关联。
2. `pnpm run test:release`：固定提交的公开代码样本，核对哈希、许可证、语言识别、结构范围与部分行为。
3. 服务启动后，`pnpm run test:browser`：真实页面导入，用途摘要跳转、源码高亮、知识卡收藏及刷新保留、390px 布局；需要 Playwright 和 Edge。

页面检查可以用 `WHO_PLAYWRIGHT_MODULE` 指定已安装的 Playwright 路径，用 `CODELINGO_URL` 指定本地服务地址。检查报告写入 `.browser-artifacts`，不应提交。

Flask JSON provider 和 node-jsonfile 是在规则写完后取得的新样本，未按它们的变量名或函数名编写规则。其它公开样本保留跨语言回归。

分析结果附版本、构建编号、原始输入 SHA-256。输入不同、构建不同，不能直接当作同一次测试比较。源码引用保留原文位置，恢复后的分析不代表原始程序已经能运行。

## 不应误解为已完成的验证

- 公开代码只被静态读取，不表示其依赖已安装或整个上游项目能运行。
- 教学卡中的自编 Python / JavaScript 例子在测试中核对实际结果；用户导入的代码不会执行。
- 没有真实新手参与的理解测试，不宣称比通用 AI 更快或更准确。
- 没有完整审计所有依赖，也没有验证所有 AI 服务、Windows 多屏截图和 OCR 组合。
- 稳定读出结构不等于理解全部业务。跨文件继承、动态修改、框架调用、复杂异步调度仍存在缺口。

## 公开包与本地反馈样本

开发工作区保留用户反馈与更广泛的历史回归；待公开包不含用户上传的私人源码、原始聊天粘贴、运行日志或个人路径。公开包使用自编等价场景及带许可证的上游样本验收。因此公开包与本地完整测试的数量不同，不能混为一谈。

下一轮用户验证：给初学者一段未见过的代码，观察其是否能说明用途、输入输出及失败路径，并指出对应源码。记录误解和用时，不以知识卡数量替代理解效果。

## 依赖检查

本版升级 YAML、PostCSS 与 Lodash 相关依赖，版本固定在 package.json 和 pnpm-lock.yaml。CSS 解析显式关闭 source map 加载，回归测试确认导入 CSS 的映射注释不会读取本地映射文件。
可用 `pnpm audit --prod` 复查已知依赖通告；数据库会变化，零条通告不等于没有安全问题。

## 0.7.1 本地增量验收

130 项自动测试、19 份既有公开样本以及 9 次页面导入通过。新增 tests/pedagogy.test.js 和 tests/browser-pedagogy.cjs；后者默认使用自编例子和公开样本，WHO_PRIVATE_INITIALIZER 可选指定历史反馈对照文件。截图和结果来自实际页面，未进行独立新手理解实验。本次未重新验证安装或更新公开压缩包。

## 逐行阅读回归

`tests/line-reading.test.js` 纳入 `pnpm test`。`node tests/browser-line-reading.cjs` 自行启动临时服务，通过 Edge 验证选行、完整语句、旧视图切换、AI 请求状态和手机布局；AI 回复使用模拟接口。依赖与运行方法见 [逐行阅读说明](docs/LINE_READING.md#验证)。

## AI 调用回归

完整讲解稿：`tests/ai-talk.test.js` 检查输出完整性、参数和导出；`tests/api.test.js` 通过本机模拟模型验证 `/api/talk`。`node tests/browser-talk.cjs`（设置 `WHO_PLAYWRIGHT_MODULE` 和 `CODELINGO_URL`）验证生成、阅读基础/详略、导出、失败保留上稿、设置失效、取消晚到响应、重试和手机布局；回复是模拟数据，不能据此声称真实模型稿件质量通过。该轮全量测试 207 项和 19 个公开样本通过。真实模型稿件尚未验证；此前提供的凭据最后一次调用返回 401。可用有效配置运行显式选择的 `tests/browser-ai-live.cjs`，该脚本现已包含完整讲解稿生成。

`tests/ai-client.test.js` 和 `tests/api.test.js` 检查接口参数、源码保留、选区原文、超时和错误分类。`tests/browser-ai-states.cjs` 验证本地结果优先、取消和失败恢复。真实调用脚本 `tests/browser-ai-live.cjs` 为显式选择的额外检查，不纳入默认测试，运行方法见逐行阅读说明。

## 三列 AI 工作台验收

`tests/ai-flow.test.js` 验证分支、源码范围、顶层与嵌套调用、名称覆盖和 UTF-16 词语位置；`tests/api.test.js` 通过模拟模型服务验证 `/api/flow` 完整请求链路。启动服务后，设置 `CODELINGO_URL`、`CODELINGO_PYTHON` 和 `WHO_PLAYWRIGHT_MODULE`，运行 `node tests/browser-studio.cjs`，验证嵌套展开、递归终止、缓存、过期响应、词语弹窗与 390px 布局。该脚本使用模拟 AI 回复。新流程接口的真实 DeepSeek 测试收到 401，未完成新功能的实际模型质量验收。
