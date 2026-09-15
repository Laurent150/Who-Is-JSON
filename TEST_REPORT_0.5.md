> 历史记录：其中的反馈输入已在公开迁移时替换为自编回归样本，旧文字和数字不代表对原始反馈文件的新验收。迁移范围见 [迁移说明](docs/PUBLIC_MIGRATION.md)。

# Who Is JSON 0.5 验收记录

## 本轮交付

针对“整行源码混在一起、看不清当前分支、知识卡数目被误认为完整覆盖”的问题，修改解析位置、流程引用和知识匹配三层。基础理解仍在本地完成，AI 是可选扩展。

| 用户要求 | 实现与验收依据 |
|---|---|
| 精确引用 | 点击 clean 的空文字分支，只高亮 `""`。其余源码保留上下文；编辑框和复制原文不改写。 |
| 分开当前步骤和整行知识 | 默认只有空字符串与自动返回两类卡；trim、typeof、const、箭头与比较等在折叠上下文区。 |
| 标出覆盖与缺口 | 展示匹配的知识类别、具体未解释的调用/语法，以及不代表完整理解的说明。没有使用误导性的源码理解百分比。 |
| 按语言扩充 | JavaScript 27、Python 19、Java 12 个主题，分为独立目录；收藏页可按语言浏览。 |
| 增加 Java 解析 | java-parser 3.0.1 读取类、方法、构造方法和常见流程；泛型、注解、外部调用及复杂转移列为缺口。 |
| 真实代码验证 | 14 个有来源和许可的项目文件；浏览器每份导入两遍，检查模块及节点展示。 |

## 通过的检查

最终整套自动测试 **92 / 92** 通过。包括源码范围、语法容错、现有多语言解释、原有讲稿功能、HTTP 接口、知识匹配及收藏数据。测试数是回归证据，不是解释完整度。

新增针对性验证：

- 条件本身、成立分支和不成立分支分别引用正确表达式；空分支不混入 trim 卡。
- 中文/emoji、BOM、CRLF、Markdown 围栏、附带说明、连续行号前缀后的列位置仍对应原文。
- Python AST 的 UTF-8 字节列转换成浏览器使用的 UTF-16 列；恢复独立片段时原始行号保持。
- Java 实际源码的方法、循环、抛错和返回节点范围有效；损坏 Java 不冒充解析成功；单方法片段可读取。
- 同一行不同位置的同类知识点可以分别关联收藏；重复同一位置不会重复保存。
- Python 模块级同名覆盖、JS 自定义 trim 等不会误教成确定的内置调用。
- 新下载文件固定提交，核对 SHA-256，保留原文件与许可证。

页面验证使用独立 Edge/Playwright 上下文，不接触用户原有收藏：

- browser-coverage：14 份真实代码 × 2 次导入，共 28 次；每份检查前 3 个模块（少于 3 则全检）。另外检查空分支、格式包装、收藏刷新、Java 条件和 390px 布局。
- browser-knowledge：旧收藏保留、新收藏去重及多源关联、刷新、导出、删除、存储不足反馈、Python、可选讲稿返回学习均通过。
- browser-readability：实际聊天粘贴的 clean/build/markdown、展开回调、原文保留、引用换行、手机布局、真实样本两遍导入通过。
- 已查看生成的空分支、Java 与手机布局截图，检查代码背景、浅黄色引用和上下文折叠。

自编教学例子：**46 个 JavaScript/Python 例子实际执行并核对输出；12 个 Java 例子通过 Java 语法解析，本次环境未找到可用的 JDK，本轮未编译运行 Java。** 运行的是自编教学例子，导入的用户代码不会被软件执行。

## 测试中发现并修复

Java 初次引用漏掉首行缩进，已改为保留整行原文并独立记录精确范围。增加样本后，旧接口测试写死了 10 个例子，现按许可样本清单验证。知识点按行关联会合并同一行的两处不同位置，现加入列范围。复制格式清理新增了原始列映射；无精确范围的合并节点明确按行展示。

## 实际边界

58 个教学主题远未覆盖三门语言全部知识。缺口清单也只列出目前解析规则能识别的未讲解构造；未识别到的写法不能因此视为已解释。局部语法说明不等于业务目的已确认。

Java 的复杂异常、switch、并发、泛型约束、注解行为和外部方法仍不完整；普通表达式及构造方法的复杂初始化可能只展示结构。Python/JS 的动态调用、闭包异步、跨文件含义和运行时覆盖仍需要上下文。合并节点及部分结构只有行范围。

本轮没有重跑第三方项目的完整原生测试套件，也没有验证任意业务输入都正确。成熟开源项目和许可证提供来源依据，不能保证代码绝对无缺陷。截图/OCR、多显示器及其他 Windows 环境未在本轮全面复测。

## 真实源码清单

所有样本都保留对应 .LICENSE；精确下载地址、是否摘录、哈希见 tests/corpus/manifest.json。新增 Java 三文件和 Flask 文件均固定到提交 SHA；既有样本若记录分支，需连同归档源码和哈希使用，不能把移动分支当成永久版本。

| 样本 | 项目 | 来源版本 |
|---|---|---|
| binary-search.py | TheAlgorithms/Python | d5020134382bf0719974232595467bd3227243f8 |
| p-limit.js | sindresorhus/p-limit | 783068bb9e967fd7bea8642e1bf5a3627fe38bdf |
| mdn-index.html | mdn/beginner-html-site | gh-pages |
| chinook.sql | lerocha/chinook-database | 7f67772503d71ba90f19283c38e93923addb43fa |
| is-number.js | jonschlinkert/is-number | 98e8ff1da1a89f93d1397a24d7413ed15421c139 |
| vue-general.ts | vuejs/core | 54097087a0918b98f16c84599b1a6d654e952ca7 |
| vue-ci.yml | vuejs/core | 54097087a0918b98f16c84599b1a6d654e952ca7 |
| typescript-package.json | microsoft/TypeScript | 879f9867ac455404e75759dd1739281cf6aa7f85 |
| github-markdown.css | sindresorhus/github-markdown-css | e49401776c9d581ad42367fc4ea3d677d13e2e39 |
| factorial.py | TheAlgorithms/Python | d5020134382bf0719974232595467bd3227243f8 |
| flask-helpers.py | pallets/flask | d73fa1cdcbd8b1465c151db8924ba58b1dd14e35 |
| java-BinarySearch.java | TheAlgorithms/Java | a097a286fc0c7b268ec9788996db5dfd8782ab45 |
| java-InsertionSort.java | TheAlgorithms/Java | a097a286fc0c7b268ec9788996db5dfd8782ab45 |
| java-Factorial.java | TheAlgorithms/Java | a097a286fc0c7b268ec9788996db5dfd8782ab45 |

项目来源：[TheAlgorithms/Java](https://github.com/TheAlgorithms/Java)、[TheAlgorithms/Python](https://github.com/TheAlgorithms/Python)、[Flask](https://github.com/pallets/flask)、[Vue](https://github.com/vuejs/core)。

教学规则核对参考：[Python 内置函数](https://docs.python.org/3/library/functions.html#isinstance)、[MDN typeof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof)、[Java 语言基础](https://dev.java/learn/language-basics/)。Java 语法解析器来自 [prettier-java/java-parser](https://github.com/jhipster/prettier-java/tree/main/packages/java-parser)，依赖版本与校验信息锁定在 pnpm-lock.yaml。

## 复现

安装与页面测试命令见 README.md。自动测试输出、浏览器报告与截图保存在本机 .browser-artifacts；发布包提供源码、测试、样本与许可，不含 node_modules 或个人浏览器数据。
