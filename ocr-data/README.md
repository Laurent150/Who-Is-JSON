# 本地 OCR 语言数据

这些文件随软件保存，运行识图功能时不访问语言包下载服务。

- `eng.traineddata`：英文，来自 `@tesseract.js-data/eng@1.0.0` 的 `4.0.0`，包含两种识别引擎所需数据。
- `chi_sim.traineddata`：简体中文，来自 `@tesseract.js-data/chi_sim@1.0.0` 的 `4.0.0_best_int`。
- 原始软件包说明保存在对应的 `.README.md`；具体来源、软件包完整性值和解压后文件校验值见 `manifest.json`。

上游数据项目：[naptha/tessdata](https://github.com/naptha/tessdata)，许可为 Apache-2.0，完整文本保留于 LICENSE。运行引擎为 [Tesseract.js](https://github.com/naptha/tesseract.js) 6.0.1，依赖版本固定于 pnpm-lock.yaml。

实现分工：`ocr-image.js` 处理截图对比度；`local-ocr.js` 管理识别进程及超时；`ocr-worker.js` 加载本地引擎；`ocr-layout.js` 根据图中文字位置估算相对缩进；`ocr-consensus.js` 对照两次识别，只在字母一致、位置匹配且文本不歧义时补回下划线；`ocr-review.js` 检查提取结果能否解析。不会执行截图里的代码。

一张截图无法证明原文件的缩进使用空格还是 Tab，也无法知道整体裁掉了多少左侧空白。恢复的缩进是以可见代码最左侧为基准的估算。字符准确率仍受字号、字体、主题、截图质量和光标遮挡影响。

复测：启动软件后，配置 `WHO_PLAYWRIGHT_MODULE`（如未本地安装 Playwright）和 `CODELINGO_URL`，运行 `node tests/browser-ocr.cjs`。历史反馈截图可通过 `WHO_OCR_FEEDBACK_IMAGE` 额外提供；该图片不随软件分发。报告中的 `exact: false` 表示转录未与预期完全一致，即使疑点提示检查通过也不能算作准确识别。
