> 历史记录：其中的反馈输入已在公开迁移时替换为自编回归样本，旧文字和数字不代表对原始反馈文件的新验收。迁移范围见 [迁移说明](docs/PUBLIC_MIGRATION.md)。

# Who Is JSON 0.6.2：发布验收

## 结论

本次完成了已知 Python 阻断项的修复，并建立了可重复的发布检查。Agent 的正常路径、错误处理与异步等待能够展开；名称来源和常见知识解释有所改进。**这不等于所有语言、所有代码的语义均已解释。**

## 实际检查

- 完整回归：116 项通过，0 失败。随后根据截图修正循环条件和异步标题，相关 34 项回归再次通过；静态验收和全部浏览器验收也在最后修改后重新运行。
- 静态发布检查：28 项通过。包括 17 份固定版本的 GitHub 源码、8 份用户反馈样本，以及 Go / Rust / Ruby 的未支持边界检查。
- GitHub 样本来自 11 个项目，涵盖 Python、JavaScript、TypeScript、Java、JSON、YAML、HTML、CSS、SQL。Shell 与 Dockerfile 在本轮使用已有用户反馈样本，不能冒称也新增了 GitHub 样本。
- 新下载 CPython 的 queues.py、contextlib.py、mixins.py，固定提交 `890778604a8cc99f18ce07737b198a8031c91f8d`，附许可证和 SHA-256。前两份在初次实现之后加入，并暴露了同名方法、展示上限和生成器缺口；修正后成为回归样本。最后一份未用于针对性修改解释规则。
- 浏览器：17 次真实导入流程，检查目录、用途面板、源码引用、错误路径展开、收藏，以及 390 像素窄屏布局；没有捕获页面脚本错误。已人工查看三张最终页面截图。
- 测试用户提交及下载代码时仅作静态分析，没有执行 Agent、模型调用、Shell、Docker 构建或 GitHub 项目。教学卡片中本项目编写的安全小例子由自动测试验证结果；Java / Shell / Docker 卡片仍为语法检查，不是运行证明。

## 修改内容

1. 新建统一的 `python_explain.py`，集中处理表达式说明、作者文档字符串、方法关联和名称上下文；没有根据 Agent 的类名或方法名硬编码业务解释。
2. Python 流程模型区分 try 正常路径、except 匹配路径、else 成功路径和 finally 收尾；with / async with 展示内部步骤，保留资源实现未知的提示。
3. 异步等待单独显示，不再被普通步骤合并隐藏。asyncio.wait 的任一完成条件会说明“不会自动取消剩余任务”。
4. 补充 len、max/min、转换、range、sum、索引、切片、类型提示、文档字符串和异步知识。self 说明当前实例；内置名称与作者定义分开；检测到名称覆盖时不强行套用内置解释。
5. 方法目录带所属类名，避免不同类的同名方法混淆；超过展示上限时优先保留主要方法，并明确警告。
6. 长流程和学习面板分别滚动，源码继续使用独立背景；术语说明帮助理解 token、LLM、上下文窗口等词。
7. 页面增加支持范围与已知缺口，公开区分类型识别、结构解析、用途解释和知识教学。

## 本轮仍存在的限制

- 文件或函数的作者说明会明确标注来源，可能过时；英文作者说明目前不自动翻译。不能把引用说明当作已验证的业务事实。
- 外部工具、复杂业务、生成器调度、动态行为和自定义运算仍有解释缺口。未知项没有通过增加卡片数伪装成已覆盖。
- Chinook SQL 样本包含当前方言解析器未接受的语法，按部分解析记录；GitHub Markdown CSS 与 contextlib 长文件触发展示上限。它们通过的是“边界得到准确报告”，不是完整解释验收。
- Java 当前是语法与常见流程解释；复杂异常、框架、泛型、编译结果没有完整验证。JavaScript / TypeScript 的复杂异步与异常路径也仍可能显示未展开。
- 中文文档字符串已经能辅助解释；只有截图、没有完整原文的早期反馈不能保证逐字重现。旧文件和场景继续保留在 tests/fixtures 与旧测试中。

## 页面证据

- [Agent：等待回复及对应源码](../Who-Is-JSON-0.6.2-验收/agent-run.png)
- [独立样本：队列中的循环、等待和错误处理](../Who-Is-JSON-0.6.2-验收/holdout-queue.png)
- [窄屏：异步任务知识与源码](../Who-Is-JSON-0.6.2-验收/mobile-study.png)

## 复验

在源码目录运行：

```text
node --test tests/*.test.js
node tests/release-gate.cjs
node server.js
node tests/browser-release.cjs
```

浏览器测试需要 Edge 和 Playwright，可通过 `WHO_PLAYWRIGHT_MODULE` 指定 Playwright 模块位置。发布静态记录保存被测核心文件的哈希；打包前会再次核对，避免把未测试的改动装入包中。

异步和异常规则核对了 [Python asyncio 官方文档](https://docs.python.org/3/library/asyncio-task.html) 与 [复合语句官方文档](https://docs.python.org/3/reference/compound_stmts.html#the-try-statement)。新样本可从 [CPython 固定版本](https://github.com/python/cpython/tree/890778604a8cc99f18ce07737b198a8031c91f8d/Lib) 核对，具体文件及许可证见 tests/holdout/manifest.json。
