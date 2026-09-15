> 历史记录：其中的反馈输入已在公开迁移时替换为自编回归样本，旧文字和数字不代表对原始反馈文件的新验收。迁移范围见 [迁移说明](docs/PUBLIC_MIGRATION.md)。

# Who Is JSON 0.6.1：Dockerfile 识别与中文注释反馈验收

## 根因与复现

按用户截图重建 tests/fixtures/user-python.Dockerfile。0.6.0 中，保留中文注释和删除所有注释均得到“未确定 / unsupported”。这说明本次失败源于未提供 Dockerfile 识别与解释，不能归因于中文注释。

页面验收又发现文件导入的扩展名白名单拦截了无扩展名 Dockerfile。已将普通导入、后端语言识别与悬浮窗收件入口统一为 public/file-types.js 的规则，支持 Dockerfile、Containerfile、Dockerfile.dev 及 .dockerfile / .containerfile。

## 修改范围

- 独立的 Dockerfile 逻辑指令读取器：保留原文、中文注释、行列位置，合并续行，按 FROM 分组。代码围栏 dockerfile 标签也可识别。
- 独立解释模块，复用 0.6 的 guide、源文高亮、收藏与学习面板；没有把 Dockerfile 硬塞进 Python 或 Shell 解析器。
- 区分制作指令与启动设置：RUN 制作时执行，CMD / ENTRYPOINT 登记启动设置；EXPOSE 不启动服务、不自动创建宿主机映射。
- 本样本读取 1 个 FROM 阶段和 10 条指令；COPY --from 引用其他镜像不算额外 FROM 阶段。
- 注释以“作者的注释 · 未核实”显示；不把注释声称的系统 Python 安装位置作为执行事实。
- 新增 13 个 Dockerfile 基础主题，共 95 个内置主题；这不代表完整知识覆盖。
- 未识别内容时隐藏空白流程面板。文件选择器不再仅以扩展名过滤，实际允许导入的类型仍由共用规则控制。

## 实际验证

- 完整自动测试 111/111 通过，包含既有多语言/真实开源样本回归。
- 最后统一悬浮窗收件入口后，相关 8 项测试再次通过，包含带令牌的收件 API 导入与读取。该 8 项属于原有集合，不重复累计。
- 7 项新增回归覆盖：中英文注释对照、删除注释后指令与说明一致、文件名/围栏/BOM/CRLF/Unicode 定位、制作与启动边界、其他语言不被误识别、续行与注释、多个 FROM / CMD 覆盖、损坏和暂不支持的语法。
- 浏览器使用独立 Edge 上下文，将带中文注释、无注释、.txt 粘贴型样本各导入两次；检查 1 个阶段、10 个节点、跨行源文高亮、启动参数、未核实注释、缓存知识及 390px 无横向溢出。
- 页面额外导入带中文注释的 Python，确认仍能展示其结构。
- 手动查看 Dockerfile 跨行 RUN 窄屏学习页与 CMD 参数页截图。
- Dockerfile 教学例子只做本地指令读取，未运行 Docker 构建；没有执行用户的 RUN、安装软件、删除文件或启动其服务。

## 边界与来源

这是有限的 Dockerfile 逻辑指令读取，不是完整 Docker 构建验证器。复杂引号、扩展选项、构建前端、自定义语法、动态变量、内嵌命令与项目依赖仍可能有缺口。Here-document 内容作为不透明范围保留，不把其中的 FROM / CMD 当作外层指令。损坏续行或明显缺少参数会提示核对。

没有检查 pyproject.toml、uv.lock、应用入口、基础镜像的继承启动设置或真实依赖安装位置。因此“读出了结构”不能证明原项目能够成功制作镜像或启动。

用户样本由截图重建，非原文件的逐字校验版本；真实开源回归样本沿用 tests/corpus/manifest.json 中的已有归档。本轮没有新下载或运行那些项目。未重新全面测试系统截图/OCR、多屏和外部 AI 服务。

参考：[Dockerfile 官方说明](https://docs.docker.com/reference/dockerfile/)、[uv 的 Docker 集成说明](https://docs.astral.sh/uv/guides/integration/docker/)。中文普通注释与英文注释遵守相同规则；文件头的 syntax / escape 等解析指令另有作用。

复现：node --test tests/*.test.js。启动服务后运行 node tests/browser-dockerfile.cjs，需要 Playwright 与 Edge，可设置 WHO_PLAYWRIGHT_MODULE。历史验收见 TEST_REPORT_0.6.0.md。
