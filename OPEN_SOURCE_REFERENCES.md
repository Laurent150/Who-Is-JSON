# 借鉴来源与代码归属

本版借鉴以下项目的方法，没有复制、打包它们的 SKILL.md 或实现，也不要求用户安装它们。

| 来源 | 借鉴的方法 | 本项目对应实现 |
| --- | --- | --- |
| [Codebase Onboarding Skill](https://github.com/eabait/codebase-onboarding-skill) | 先概述、引用源码、区分已知与未确认内容 | guide 的 purpose、evidence、limits；作者说明明确标注 |
| [ast-grep Agent Skill](https://github.com/ast-grep/agent-skill) | 依据结构识别模式；用正反例验证规则 | Python AST 上的有限重试识别；别名、同名覆盖、重置计数反例 |
| [Serena](https://github.com/oraios/serena) | 按定义与引用查找相关代码 | 当前文件里的函数定义链接；尚未集成 LSP 或跨文件检索 |
| [CodeTour](https://github.com/microsoft/codetour) | 导览步骤绑定源码位置 | 用途摘要与流程节点跳转到原文，知识卡关联同一段源码 |

这些机制不意味着本项目具备上述工具的全部能力；本地规则仍然是有限的静态分析。AI 扩展可选。

## 行为规则核对依据

- [Python JSON](https://docs.python.org/3/library/json.html)：loads、dumps、解析结果及可选参数。
- [Python re](https://docs.python.org/3/library/re.html)：sub 匹配与替换。
- [Python 字符串](https://docs.python.org/3/library/stdtypes.html#string-methods)：strip、replace；区分字符集合与完整前缀。
- [Python super](https://docs.python.org/3/library/functions.html#super)：继承查找顺序。
- [JavaScript JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)：JSON 解析与 reviver。

## 许可证

Who Is JSON 自有源码与自编教学示例采用根目录 LICENSE 中的 MIT 许可证。
tests/corpus、tests/holdout 中的第三方样本各自适用相邻的 `.LICENSE`，不被本项目的 MIT 许可证替换。manifest.json 记录上游路径、固定提交和 SHA-256。样本原文不修改，也不会在分析或验收中执行。

运行依赖通过 pnpm-lock.yaml 固定，安装后各包许可证位于其自身目录。源码包不包含 node_modules、第三方 skill 的代码或运行环境。

公开发行中的 `tests/fixtures` 为自编回归输入或本项目自有代码的引用，适用根目录 MIT 许可，见 [来源记录](tests/fixtures/README.md)。`tests/corpus/python-repositories.json` 仅记录可选外部评估的仓库路径与哈希，不包含这些仓库的实现；自行获取外部资料时仍须遵守上游许可。
