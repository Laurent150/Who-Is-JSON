# Windows 桌面启动版

核心应用版本：1.1.0。桌面包装版本：1.1.0.0。

安装包使用 NSIS 3.12，按当前用户安装，不要求管理员权限；提供桌面/开始菜单快捷方式、Windows 卸载注册信息和卸载程序。运行文件包含 Node.js 24.19.0、Python 3.12.14 和应用所需依赖。

`WhoIsJSON.exe` 是 .NET Framework 桌面启动器，负责启动本地服务、打开 Edge 应用窗口和提供托盘退出菜单。没有 Edge 时使用默认浏览器。关闭显示窗口不会立刻停止后台服务，用户可从托盘退出。

## 构建

安装锁定依赖后，从 Node.js 官方取得对应版本 LICENSE，准备 NSIS 3.12、Node.js 24.19.0 和 Python 3.12.14：

```powershell
./desktop/build.ps1 -Output .runtime/desktop-release -NodeRuntime (Get-Command node).Source -PythonRuntime (Split-Path (Get-Command python).Source) -NodeLicense ./NODE-LICENSE.txt -MakeNSIS ./nsis-3.12/makensis.exe
./desktop/verify.ps1 -Build .runtime/desktop-release
```

输出目录必须是新的空目录。脚本从已跟踪的应用文件及已安装依赖生成离线 payload，不打包 `.env`、本机配置、site-packages、日志、浏览器数据或编译缓存。公共云连接配置包含在 `cloud-config.js` 中，密钥仍由云端保管。

脚本编译 WinExe/x64 启动器，生成准确卸载文件清单、文件哈希清单与安装包 SHA-256。Python 缓存只删除已知目录内的 `.pyc` 文件；不会递归删除用户选定的安装目录。

`windows-release.yml` 在 PR 中构建并验证安装包；相关改动合并到 main 后重新构建验证，按 package.json 版本发布 Release。版本标签必须尚未存在，流程不会覆盖已有版本。普通源码 CI 继续独立运行。

## 验收

安装器支持 `/S /TEST /D=隔离目录`。TEST 会把桌面/开始菜单快捷方式写到该目录内的 test-shortcuts，并跳过实际注册表修改，以免自动测试改变用户桌面。它使用真实安装/卸载文件流程，不是只解压压缩包。

安装后的 `WhoIsJSON.exe --self-test` 在动态分配的独立测试端口启动自带 Node.js 和 Python，检查代码分析与公共登录配置后关闭服务，并写入 data/self-test.json；不会挤占正在使用的开发端口。正常启动默认使用 43127；同一地址已有旧版 Who Is JSON 服务时会关闭旧服务后启动安装目录中的版本，避免继续依赖原源码目录。

`verify.ps1` 在 build 子目录真实安装，逐项比较文件哈希、核对快捷方式、运行自测、覆盖安装、再卸载，并确认额外文件和日志保留。不会真实登录、同步账户数据或调用付费 AI。

卸载只删除准确列出的程序文件和快捷方式，保留用户额外放入的文件及 data 日志，不会清空浏览器收藏。测试必须确认这些保留规则有效。

收藏按浏览器和本地地址保存。Codex 内置浏览器的收藏不会自动迁移到 Edge。安装包目前未作商业代码签名。
