# Windows 下载与安装

FIMI 1.2.0 尚为发布候选，当前公开下载仍是 Who Is JSON 1.1.0。新版正式发布后，Windows 10/11 x64 用户应下载 Release 附件中的 FIMI-1.2.0-Windows-x64-Setup.exe；Source code ZIP 是开发源码，不是安装包。当前用户安装，不需要管理员权限；包含本地 Node.js/Python，无需另装开发环境。版本目录和内部 WhoIsJSON.exe 名称为兼容旧版保留。

## 提示如何区分

- “Windows 已保护你的电脑”或“未知发布者”：通常涉及 Authenticode 签名和应用信誉，不等于安装器文件损坏。未签名版本可能被组织策略或 Smart App Control 直接阻止。签名也不保证新文件立即免除提示。
- 浏览器提示不常见下载：先核对项目官方 Release 来源与附件名；不要下载第三方改包。不要为安装关闭杀毒软件或全局安全防护。
- “Error launching installer”或解压/写入错误：保存完整错误文字，核对 Release 的 SHA256SUMS.txt 与本地 Get-FileHash 结果，并记录 Windows 版本、架构、安装路径及失败步骤。哈希匹配只能证明文件与发布附件一致，不能代替发布者签名。
- 安装后启动失败：保留安装目录 data/desktop.log 与出现的错误文字，检查安装文件是否被安全软件隔离；不要盲目重复安装或关闭防护。

如果用户信任官方来源，是否继续运行应依其系统允许的选项及组织政策决定；应用不修改 Windows 信任设置。没有原始报错截图时，不能确定上述哪一种是某位用户的实际原因。

## 发布者处理

当前本地候选未签名。取得有效发布者身份后，给启动器、卸载程序和安装器签名并验证时间戳；之后重新生成SHA-256、安装验证和发布附件。不得把自签证书当作面向普通用户的信任解决方案。

参考：[Microsoft SmartScreen 应用信誉](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)。
