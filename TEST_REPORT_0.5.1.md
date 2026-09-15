> 历史记录：其中的反馈输入已在公开迁移时替换为自编回归样本，旧文字和数字不代表对原始反馈文件的新验收。迁移范围见 [迁移说明](docs/PUBLIC_MIGRATION.md)。

# Who Is JSON 0.5.1：Bash 误识别修复验收

## 问题与修复

用户提供的外层 Bash 代码中包含 node -e 的 JavaScript。0.5 按全文关键字查找 const，将外层错认成 JavaScript，随后把 [[...]] 当数组、把 command -v 当减法，输出了错误卡片。粘贴整段新代码时还可能保留上一个 .js 文件名，进一步导致错误分派。

0.5.1 增加外层语言证据检查及真正的 Bash 语法树解析；加入脚本入口，保留两个函数的独立流程；全量替换粘贴时清除旧文件名。内嵌 JavaScript 不用于决定外层语言，单独说明其边界和语法问题。

## 本轮实际验收

- 整套自动检查 **99/99** 通过，包含既有 14 个真实开源样本的解析和源文范围回归。
- 新增 7 个针对性测试：外层识别、脚本入口/函数/分支、复制转义与原始列、OpenSky 提前返回与字段拆分、缺少 fi 的损坏结构、非目标脚本不套用业务目的、围栏与 Unicode 范围。
- 浏览器：用户脚本与带转义版本各导入两次，检查 3 个模块、循环与 break、command -v 精确引用、没有混入 JavaScript 知识卡、内嵌代码错误、旧文件名清理以及 390px 布局。
- 已查看实际的条件学习和内嵌代码页面截图。没有仅凭测试数量判断解释质量。
- 新增 16 个 Bash 教学例子通过语法解析，**未执行这些命令**。既有 JS/Python 自编例子仍核对实际结果；Java 仍仅做语法检查。

## 对这段代码核对的含义

1. -z 检查空文字，-n 检查非空；[[...]] 不是 JavaScript 数组。
2. command -v security / node 检查命令是否可用，不是减法。
3. Google Maps 最终优先采用环境侧变量（为空时尝试 dotenv），然后才采用钥匙串结果；即使前者已有值，源码仍会进行钥匙串尝试。
4. 账号循环遇到非空结果后 break；循环后仍继续脚本。
5. 两个函数在此处只定义，没有看到调用；Bash return 交回状态，不交回密码字符串。
6. OpenSky 函数检查文件、工具与制表符分隔，再按条件补齐已有值为空的字段。
7. read_dotenv_value 的实现未提供，列为外部功能缺口。复制版 raw\.clientId 等内嵌 JavaScript 写法不能算作合法代码；只把 Bash 中可读结构继续展示。

## 未完成的范围

不宣称完整 Bash 或完整嵌套 JavaScript 语义支持。内嵌代码尚未逐项拆成独立流程；动态 Shell 展开会影响实际传给 Node 的文字。case、管道、heredoc、while/until 等复杂结构仍有缺口。静态图不验证工具权限、文件格式、原项目运行结果或密钥存在性。没有执行用户脚本或读取任何真实凭据。

复制恢复仅用于标明的分析副本；原文中真正有意保留的反斜杠可能需要人工核对。不能把“成功读取分析副本”当作“原代码已通过运行验证”。

## 复现与来源

运行 `node --test tests/*.test.js`；启动服务后运行 `node tests/browser-shell.cjs`（Playwright + Edge，可使用 WHO_PLAYWRIGHT_MODULE）。测试输入见 tests/fixtures/user-credentials.sh 和 user-credentials-copied.txt：前者是按用户粘贴整理的无 Markdown 转义版本，后者保留其转义形式；不是新从 GitHub 获取的样本。

解析依赖固定为 web-tree-sitter 0.20.8 与 tree-sitter-wasms 0.1.13，版本和完整性记录在 pnpm-lock.yaml。解析器来源：[Tree-sitter Bash](https://github.com/tree-sitter/tree-sitter-bash)、[预编译语法包](https://github.com/sourcegraph/tree-sitter-wasms)。语义参考：[GNU Bash 手册](https://www.gnu.org/s/bash/manual/bash.html)、[命令替换](https://www.gnu.org/s/bash/manual/html_node/Command-Substitution.html)、[内置命令与 return](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html)。

0.5 历史验收见 TEST_REPORT_0.5.md；其中的页面验收属于上一版，不冒充本轮重新执行的结果。
