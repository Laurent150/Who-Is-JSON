# Windows 桌面启动版

开发版本：核心应用 1.2.0，桌面包装版本 1.2.0.0。当前已发布安装包仍为 1.1.0；新版安装器需单独构建验收。

安装包使用 NSIS 3.12，按当前用户安装，不要求管理员权限；提供桌面/开始菜单快捷方式、Windows 卸载注册信息和卸载程序。GitHub 构建配置使用 Node.js 24.19.0、Python 3.12.10；已验证的本地候选使用 Python 3.12.14，均包含应用所需依赖。

`WhoIsJSON.exe` 是 .NET Framework 桌面启动器，负责启动本地服务、打开 Edge 应用窗口和提供托盘退出菜单。没有 Edge 时使用默认浏览器。关闭显示窗口不会立刻停止后台服务，用户可从托盘退出。

## 构建

安装锁定依赖后，从 Node.js 官方取得对应版本 LICENSE，准备 NSIS 3.12、Node.js 24.19.0 和 Python 3.12.10：

```powershell
./desktop/build.ps1 -Output .runtime/desktop-release -NodeRuntime (Get-Command node).Source -PythonRuntime (Split-Path (Get-Command python).Source) -NodeLicense ./NODE-LICENSE.txt -MakeNSIS ./nsis-3.12/makensis.exe
./desktop/verify.ps1 -Build .runtime/desktop-release
```

输出目录必须是新的空目录。脚本从 `desktop/app-files.json` 明确列出的应用文件及已安装依赖生成离线 payload，不打包 `.env`、本机配置、site-packages、日志、浏览器数据或编译缓存。公共云连接配置包含在 `cloud-config.js` 中，密钥仍由云端保管。

脚本编译 WinExe/x64 启动器，生成准确卸载文件清单、文件哈希清单与安装包 SHA-256。Python 缓存只删除已知目录内的 `.pyc` 文件；不会递归删除用户选定的安装目录。

`windows-release.yml` 在 PR 中构建并验证安装包；相关改动合并到 main 后重新构建验证，按 package.json 版本创建草稿 Release，核对签名与发布说明后再发布。版本标签必须尚未存在，流程不会覆盖已有版本。普通源码 CI 继续独立运行。

## 验收

安装器支持 `/S /TEST /D=隔离目录`。TEST 会把桌面/开始菜单快捷方式写到该目录内的 test-shortcuts，并跳过实际注册表修改，以免自动测试改变用户桌面。它使用真实安装/卸载文件流程，不是只解压压缩包。

安装后的 `WhoIsJSON.exe --self-test` 在动态分配的独立测试端口启动自带 Node.js 和 Python，检查代码分析与公共登录配置后关闭服务，并写入 data/self-test.json；不会挤占正在使用的开发端口。正常启动默认使用 43127；同一地址已有旧版 Who Is JSON 服务时会关闭旧服务后启动安装目录中的版本，避免继续依赖原源码目录。

`verify.ps1` 在 build 子目录真实安装，逐项比较文件哈希、核对快捷方式、运行自测、覆盖安装、再卸载，并确认额外文件和日志保留。不会真实登录、同步账户数据或调用付费 AI。

卸载只删除准确列出的程序文件和快捷方式，保留用户额外放入的文件及 data 日志，不会清空浏览器收藏。测试必须确认这些保留规则有效。

收藏按浏览器和本地地址保存。Codex 内置浏览器的收藏不会自动迁移到 Edge。安装包目前未作商业代码签名。


## 1.2.0 发布候选

显示名称改为 FIMI，安装目录、内部可执行文件名和卸载注册键保留，以覆盖升级旧版；安装器版本与启动器程序集版本都由 package.json 生成。新增模块使用明确的 app-files.json 清单，打包不依赖开发者是否暂存过文件。新增应用文件时必须更新清单，缺文件会使构建失败。

安装包名为 FIMI-1.2.0-Windows-x64-Setup.exe。本机未签名候选只验证安装功能，不代表消除了 SmartScreen 或 Smart App Control 提示。GitHub 工作流只创建草稿，避免把未经签名确认的文件自动设为最新版。

### 可选代码签名

已有当前用户证书库中的有效代码签名证书时，build.ps1 接受 -SigningThumbprint、-SignTool、-TimestampUrl 与 -RequireSignature。私钥不导出、不写入仓库；签名使用 SHA-256 和 RFC3161 时间戳，覆盖启动器、嵌入的卸载程序及最终安装器。签名或验证失败则中止。清单在启动器签名后生成，安装包校验值在最终签名后生成，结果写入 signing-status.json。没有证书时可构建未签名测试包；该签名路径须在取得证书后真实验证，不能以本地无签名安装成功代替签名验收。

未签名提示与安装错误分开排查，见 [Windows 安装说明](../docs/WINDOWS_INSTALL.md)。

## 1.2.1 桌面外观修正

`public/fimi.svg` 是统一的圆角 F 标志。`desktop/generate-icon.cjs` 从该矢量文件生成包含 16、24、32、48、64、128、256 像素尺寸的 `public/favicon.ico`；运行转换工具时通过 `WHO_SHARP_MODULE` 指定开发环境中的 sharp，不增加应用运行依赖。网页标志直接使用 SVG，网页窗口使用 ICO；构建时把同一 ICO 复制为 `fimi.ico`，用于启动器、安装器、卸载器和快捷方式。新图标文件名及安装后的 Shell 通知用于刷新旧快捷方式图标。

Edge 应用窗口首次请求以当前屏幕可用区域的 90% 居中打开，上限 1440×900，避免遮挡任务栏；浏览器已有窗口与缩放设置可能影响最终显示，仍需实机核对。首次使用默认英文，不再跟随操作系统语言；明确保存的中英文选择继续生效。主窗口标题固定为英文，启动提示和托盘菜单使用英文。

验证入口：`node tests/browser-desktop-branding.cjs`（需要 `WHO_PLAYWRIGHT_MODULE` 指定 Playwright），覆盖中文浏览器环境下的英文首次登录、图标响应、不同窗口大小及语言记忆。原生标题栏和任务栏图标必须另外进行可视检查，不能由无头浏览器测试代替。
