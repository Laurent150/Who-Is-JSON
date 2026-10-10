<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">FIMI</h1>

<h3 align="center">点一下，读懂眼前的代码</h3>

<p align="center">为使用 AI 构建产品、也想在过程中学懂代码的人准备的阅读工作台</p>

<p align="center">
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/github/v/release/Laurent150/FIMI?style=flat-square&amp;color=496B4A" alt="最新版本"></a>
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/badge/desktop-Windows%20x64-496B4A?style=flat-square" alt="Windows x64"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-DCE7A4?style=flat-square" alt="MIT 许可证"></a>
</p>

<p align="center">
  <a href="#开始使用">开始使用</a> · <a href="#你可以做什么">功能</a> · <a href="#从源码运行">源码运行</a> · <a href="https://github.com/Laurent150/FIMI/issues">反馈</a>
</p>

## 看看 FIMI 如何工作

https://github.com/user-attachments/assets/6b5deab6-18f2-4a1f-a3b5-622c61fa94fb

从购物车结算函数中一个陌生的符号出发，找到一个实际问题的答案：为什么用了优惠券，反而不包邮了？沿着代码理解判断条件，追问如何调整，再把答案和对应源码一起收藏。

## 为什么做 FIMI

让 AI 写出代码，往往比弄懂这段代码容易。FIMI 把源码、流程和解释放在同一个工作台，减少在编辑器、聊天窗口和零散笔记之间来回切换。

从不懂的地方开始：点击词语或符号，看它在当前代码里的含义；点击流程步骤，定位对应源码；继续提问，把语法和实际行为联系起来。无论你在尝试 vibe coding，还是学习第一门编程语言，都可以逐步读懂自己正在使用的代码。

## 你可以做什么

| 功能 | 使用方式 |
| --- | --- |
| **点读词语、符号和整行** | 点击名称、`=>` 或一行代码，得到结合上下文的解释。解释卡片可以拖动，读完后手动关闭。 |
| **沿流程理解代码** | 展开函数或模块，点击步骤，同时查看对应源码与解释，从整体走到细节。 |
| **理解一段逻辑** | 选择流程模块或步骤，把关联代码作为一个整体阅读，不用逐个拼接术语定义。 |
| **举个例子** | 用具体输入和变化过程，理解抽象的条件或计算。 |
| **继续提问** | 追问为什么出现某个结果，或修改条件会有什么影响，回答与当前源码保持关联。 |
| **收藏并回看** | 将有用的解释保存到收藏库，之后搜索、展开，并查看收藏时的源码和高亮位置。 |

在当前页面再次点读相同位置时，会复用已经生成的解释。界面与 AI 解释支持英文、简体中文；默认英文，并记住你的语言选择。

## 开始使用

1. **安装 FIMI。** 下载 [Windows 10/11 x64 安装包](https://github.com/Laurent150/FIMI/releases/download/v1.2.2/FIMI-1.2.2-Windows-x64-Setup.exe)。已包含 Node.js 和 Python，无需配置开发环境。
2. **选择 AI 连接方式。** 使用邮箱登录，在试用可用时使用有限额度；也可以在 **AI settings / AI 设置** 中填写自己的 OpenAI 兼容服务地址、模型名和 API Key。
3. **放入代码。** 粘贴、导入文件，或打开内置示例。展开流程模块，点读源码，继续追问不明白的地方。

当前 Windows 安装包尚未签名。[Release](https://github.com/Laurent150/FIMI/releases/latest) 提供校验文件，具体说明见 [Windows 安装指南](docs/WINDOWS_INSTALL.md)。

### 代码与语言支持

Python、JavaScript/TypeScript、Java 和 Bash 支持本地结构导航。JSON、YAML、HTML、CSS、SQL、Dockerfile 等配置或数据格式按各自结构展示。C/C++、Go、Rust、C#、PHP 和 Ruby 可以导入并请求 AI 点读，但暂不提供完整的本地函数流程图。

代码图片也可以先识别成文字，核对后再阅读。本地 OCR 包含英文、简体中文；AI 识图需要支持图像的模型。README 的翻译语言不代表软件界面支持相同语言。

### AI、账户与源码

- 本地解析和本地 OCR 不需要连接 AI。AI 解释需要试用或自行配置的服务；试用受可用性与额度限制。
- 使用 AI 功能时，相关源码和上下文会发送到所选服务；AI 识图还会发送图片。自备服务的费用与数据处理适用其提供方规则。
- 未登录时，收藏保存在当前浏览器；账户收藏会将解释及其**关联源码**同步到云端。
- FIMI 用于阅读代码，不会执行代码。解释和示例仍应对照源码核对，尤其是在依赖或上下文不完整时。

## 从源码运行

需要 Node.js 20 或更新版本、Python（推荐 3.12）以及 pnpm 10.15.1。

```sh
git clone https://github.com/Laurent150/FIMI.git
cd FIMI
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

打开 <http://127.0.0.1:43127>。如果 Python 不在 PATH 中，启动前用 `CODELINGO_PYTHON` 指定其可执行文件。Windows 开发脚本与验证方式见 [参与贡献](CONTRIBUTING.md)。

## 参与贡献

欢迎提交问题、可复现的代码示例，以及解释质量方面的改进建议。可以创建 [Issue](https://github.com/Laurent150/FIMI/issues)，提交 PR 前请阅读 [贡献指南](CONTRIBUTING.md)。分享内容前请移除密钥与私有代码。

## 许可证

FIMI 使用 [MIT 许可证](LICENSE)。第三方组件与数据集保留各自的许可，详见 [来源与署名](OPEN_SOURCE_REFERENCES.md)。
