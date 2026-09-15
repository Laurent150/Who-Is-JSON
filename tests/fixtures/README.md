# 公开回归输入与来源

本目录的样本用于静态分析测试，不执行、导入或构建这些源码。文件名部分沿用历史版本，便于保留测试入口；**公开发行中的内容不是用户原始项目的备份**。

以下 10 个文件在公开迁移时重新编写或清理，使用 MIT 许可证：

| 文件 | 当前输入与覆盖目的 |
| --- | --- |
| feedback-llm-factory.py | 自编配色图块工厂；四次调用、六个关键字参数、self 属性和元组类型提示 |
| feedback-llm-factory.md | 上述样本的故意破损缩进与 Markdown 包装版本；检查部分恢复而非猜测 |
| user-agent.py | 自编教学笔记本；11 个方法、异步等待、循环、异常与归档处理 |
| translator.py | 自编 AST 递归小例子；名称来源、递归、文字模板与数值运算区别 |
| user-credentials.sh | 自编 Shell 语法组合；仅含假想输入变量，覆盖优先级、命令检测、循环、分支、字段拆分和返回。保留个别语法识别需要的名称，不含实际凭据 |
| user-credentials-copied.txt | 上述自编 Shell 的转义与故意损坏内嵌语法版本 |
| user-python.Dockerfile | 自编 10 条指令的构建语法练习；注释不能代替环境验证 |
| user-settings.json | 自编编辑事件配置；假想的版本查询权限与打印命令，不是任何人的实际配置 |
| feedback-ignore.gitignore | 自编忽略与例外规则；含故意拼错的名字，验证分析器不会偷偷修正 |
| chat-presentation.txt | 引用本项目 MIT 讲解稿代码的复制恢复输入；移除原对话说明和文件路径 |

`behavior-retry.py`、`distance-learning.js`、`initialization-lesson.py` 是已有自编教学输入，保留原字节。

所有 `demo_*` 模块、图块工具、回调和服务名只服务于语法演示，不需要下载安装。测试只解析源码；不应把这些片段当作可直接部署的真实应用。

`tests/corpus`、`tests/holdout` 中的第三方公开样本仍保留原字节、清单和相邻许可证，与本目录分开管理。
