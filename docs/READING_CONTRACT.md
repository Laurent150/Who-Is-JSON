# 阅读体验约定（0.7.3 起）

这些规则来自用户对真实代码的连续反馈，适用于所有语言、所有导入代码与教学例子。不能为某个类名或测试输入写专用界面。

1. 先说这段代码在做什么，再介绍术语。专业说明保留在可选展开项；无法从源码确定的用途不能靠函数名猜。
2. 目录保留源码名称、名称来源和实际行范围。通俗标题不能替代源码定位。初始化名称要区分 Python 的约定名称、Java 构造方法和普通作者命名。
3. 名词解释必须从当前可见的名字或说明引出。例如先解释 `__init__` 对应什么准备工作，再引出“初始化”；JSON 只在当前说明出现 JSON 时补充。
4. 用“为什么这样解释这段代码？”说明依据；详细内容默认折叠，区分作者的描述、源码能确认的动作和实际运行效果。
5. 行号、缩进数量、原代码分三列且属于同一行。保留真实空格、Tab、空行、Unicode 和换行，折行不产生新的源码行号；复制不包含辅助标记。
6. 注释与字符串分别配色。Python 三引号文本不一概称作注释；嵌入语言和无法确定的片段应保守显示。
7. 教学例子应解释具体经过与结果，也要能点读 `[]`、`,`、`:`、`+=`、`=` 等关键符号。不能只解释 for 而假设读者已经认识其余符号。
8. 知识点关联在当前阅读位置展开并可返回。解释的是当前语言和上下文中的作用，不给同一个符号统一套话。
9. 文案拼接避免重复标点；源码、作者原始说明和字符串内容不做全局标点替换。
10. 发布检查必须包括多语言实际页面、真实项目样本、保留反馈样本和非本次针对性适配的样本。测试成功不等于全部语义已经解释。

## 实现与边界

- `public/code-view.js`：所有引用、教学例子、收藏共用的只读显示。
- `public/reading-model.js`：按语言提供保守的词法片段和上下文符号说明；不替代正式解析器。
- `public/reading-ui.js`：共用点读交互与源码名称解释；源码解析器给出的精确片段优先。
- Python 原有 AST 片段仍由 `pedagogy_python.py` 提供，保留类型提示、调用、参数等上下文区分。

| 内容 | 当前能力与限制 |
| --- | --- |
| 所有可展示语言 | 共用行号、缩进列、折行、原文复制、源码范围和紧凑说明依据 |
| Python / JavaScript / TypeScript / Java | 补充循环、集合/数组、部分索引、赋值与异步等点读；不承诺完整语言语义 |
| JSON | 对象、数组、名称和值的冒号、内容分隔逗号 |
| Shell / Dockerfile | 部分赋值、循环和制作指令；Shell 展开、heredoc 内部暂保守处理 |
| YAML / CSS | 部分名称与值的分隔说明；复杂值和嵌入语言有限 |
| HTML / SQL | 共用展示，保留已有结构讲解；新增符号讲解覆盖有限 |
| 无法可靠区分的符号 | 明确列在“本组尚未展开的符号”，不计作完整解释 |

JavaScript 正则/模板字符串、Python f-string 内插、Shell 展开等使用保守词法处理，无法代替完整语法树。类、函数的业务用途仍受当前文件和作者说明限制；英文作者说明没有自动翻译为中文。

## 可复现检查

```text
node --test tests/*.test.js
node tests/public-gate.cjs
node tests/browser-reading-v073.cjs
node tests/browser-semantics.cjs
```

页面检查默认服务地址为 `http://127.0.0.1:43128`，通过 `CODELINGO_URL` 修改；需要本机 Playwright 和 Edge，通过 `WHO_PLAYWRIGHT_MODULE` 指定 Playwright 模块位置。

标准语义核对依据：[Python 增量赋值](https://docs.python.org/3/reference/simple_stmts.html#augmented-assignment-statements)、[Python 异步调用](https://docs.python.org/3/library/asyncio-task.html)、[JavaScript for…of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of)、[Java 增强 for](https://docs.oracle.com/javase/tutorial/java/nutsandbolts/for.html)。保留本地真实样本及各自的来源清单和许可证。
