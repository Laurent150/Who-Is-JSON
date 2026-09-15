# Windows 桌面启动版

核心应用版本：0.7.3。桌面包装版本：0.7.3.1。

安装包使用 NSIS 3.12，按当前用户安装，不要求管理员权限；提供桌面/开始菜单快捷方式、Windows 卸载注册信息和卸载程序。运行文件包含 Node.js 24.19.0、Python 3.12.14 和应用所需依赖。

`WhoIsJSON.exe` 是 .NET Framework 桌面启动器，负责启动本地服务、打开 Edge 应用窗口和提供托盘退出菜单。没有 Edge 时使用默认浏览器。关闭显示窗口不会立刻停止后台服务，用户可从托盘退出。

## 构建

1. 从 Node.js 官方仓库取得对应版本 LICENSE；使用官方 NSIS 发布包。
2. 设置 `WHO_NODE_RUNTIME`（node.exe 文件）与 `WHO_PYTHON_RUNTIME`（Python 目录）。运行 `build-stage.py` 生成离线目录。不要带入 site-packages、私有反馈样本、日志、浏览器数据或编译缓存。
3. 使用 Windows .NET Framework 的 C# 编译器，以 WinExe/x64、UTF-8、System.Windows.Forms/System.Drawing/System.Web.Extensions 引用编译 Launcher.cs，加入应用图标。
4. 把启动器、图标放入 payload，按准确安装文件列表生成 NSIS 删除清单。Python 编译缓存只删除各已知目录内的 `.pyc` 文件；不得递归删除用户选定的整个安装目录。
5. 使用 NSIS 编译 installer.nsi，传入 PAYLOAD、REMOVE_LIST 和 SETUP_OUT。

## 验收

安装器支持 `/S /TEST /D=隔离目录`。TEST 会把桌面/开始菜单快捷方式写到该目录内的 test-shortcuts，并跳过实际注册表修改，以免自动测试改变用户桌面。它使用真实安装/卸载文件流程，不是只解压压缩包。

安装后的 `WhoIsJSON.exe --self-test` 在独立测试端口启动自带 Node.js 和 Python，检查代码分析后关闭服务，并写入 data/self-test.json。正常启动默认使用 43127；同一地址已有旧版 Who Is JSON 服务时会关闭旧服务后启动安装目录中的版本，避免继续依赖原源码目录。

卸载只删除准确列出的程序文件和快捷方式，保留用户额外放入的文件及 data 日志，不会清空浏览器收藏。测试必须确认这些保留规则有效。

收藏按浏览器和本地地址保存。Codex 内置浏览器的收藏不会自动迁移到 Edge。安装包目前未作商业代码签名。
