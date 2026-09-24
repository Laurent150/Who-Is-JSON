# GitHub 账户与收藏云同步

当前实现仍由本机应用运行。Supabase 托管 GitHub 登录身份和收藏数据库；没有部署公共网站，没有平台代付 AI。本地收藏、分析和 AI 设置不依赖登录。

## 使用发布版

发布配置 `cloud-config.js` 包含公共 Supabase 项目地址和 publishable key。安装依赖后直接 `pnpm start`，打开 `http://127.0.0.1:43127/`，从“账户”登录；不需要用户创建 Supabase 项目或填写 `.env`。服务不会在启动时上传数据，只有登录后收藏的内容才会同步。发布配置不含 GitHub Client Secret、管理员密钥或代理端口。

公共项目当前允许 `127.0.0.1` 的 43127、43134 端口回调。其他主机名或端口需要项目管理员另外配置，不能任意更换。设置 `WHO_CLOUD_DISABLED=1` 可禁用云账户；原本地功能继续可用。自建项目必须同时设置 URL 和 publishable key，避免把不同项目的参数混用。

**直连限制仍未解决：** 当前测试网络不经过代理时，Supabase 项目接口连接被重置；经过用户自己的本机代理后真实登录、收藏上传和重新登录读回成功。因此，默认配置完整不代表所有网络均能无 VPN 使用云服务。发布版不会自动使用某个私人代理，也不会在失败后将收藏或登录令牌转发给未经配置的第三方。

## 自建云服务（可选）

1. 自行创建 Supabase 项目，在 SQL Editor 执行 `supabase/migrations/202609240001_accounts.sql`。不要关闭 RLS，也不要给予客户端直接写表的权限。
2. 在 GitHub 的 Settings → Developer settings → OAuth Apps 创建 OAuth App。Authorization callback URL 填入 Supabase 的 `https://项目引用.supabase.co/auth/v1/callback`，**不是本机地址**。将 Client ID / Client Secret 填入 Supabase 的 GitHub provider 并启用。Client Secret 只留在 Supabase 后台，不放进应用或仓库。
3. 在 Supabase Auth → URL Configuration 的 Redirect URLs 添加本机回调白名单：`http://127.0.0.1:43127/auth/callback?state=*`。若使用 localhost 或其他固定端口，单独添加相应地址；不要允许任意域名跳转。当前预览端口使用 43134。可将 Site URL 设为本机首页。
4. 把 `cloud.env.example` 复制为 `.env`，填写项目 URL 和 **publishable key**（也兼容 legacy anon key）。不要填写 secret / service_role 管理员密钥。应用会拒绝已知管理员密钥格式。
5. 使用 Node 20.6+：`node --env-file=.env server.js`。已有 `pnpm start` 支持预先设置的环境变量，不会自动读取 .env。修改端口需同时设置 CODELINGO_PORT 并更新回调白名单。
6. 打开侧栏“账户”→“使用 GitHub 登录”，在新窗口授权，然后回到原应用。只用于登录身份，不请求仓库读写权限。登录窗口不会刷新原编辑器或清空内存中的 AI 配置；登录不会自动上传原本地收藏。

这一方案不需要购买发信域名、SMTP 或自有服务器。在免费额度内使用 Supabase；免费项目仍有容量、流量及不活跃暂停等限制，以官方套餐为准。当前不提供邮箱验证码登录。

默认公共项目已由项目所有者创建并配置。自建时账号和地区由部署者选择。本机服务器仍只绑定 127.0.0.1，包含桌面操作接口，**不能直接改为公网监听来充当网站后端**。

## 数据和同步行为

- 云端保存知识卡、功能卡及其关联源码。AI 密钥、AI 服务配置和未收藏的编辑器内容不属于同步数据。收藏私有源码前应确认允许上传。
- 未登录的收藏保持原存储位置；每个已登录账户有独立的本机缓存。导入是复制，同 ID 项目以账户中的版本为准，原本地版本不删除。
- 登录时拉取云端；修改收藏后自动上传。不会后台定时拉取其他设备修改。需要刷新云端数据时选择“重新载入云端收藏”。
- 写入使用原子版本比较。其他设备先修改时停止同步，提示导出本机备份后明确选择云端版本，不会默默覆盖。替换前自动保留一份本机备份，并可单独导出。当前不提供自动合并和备份文件导入。
- 云端不可达、登录过期或容量超限时，本机修改保留；账户面板显示错误并支持重试。最多 500 条知识收藏、60 条功能收藏、2 MB JSON。
- 登录会话最多一小时，没有自动续期。服务重启后需重新登录。服务端只在内存保存 Supabase access token；浏览器 sessionStorage 只保存本机随机会话号。退出后回到原来的本地收藏，账户缓存仍留在浏览器，共用电脑应清理站点数据。
- 此阶段没有改邮箱、删除账户、自助找回、订阅或充值入口。账户及其云数据可由项目管理员删除；外键会级联删除收藏。

## 验证和上线前缺口

本地自动测试使用模拟服务，不会访问 GitHub 或 Supabase，覆盖GitHub 身份核验和 PKCE 单次回调绑定、过期/退出、账户隔离、限流、冲突、断网保留、损坏存储和保存期间退出等情况。模拟测试不能证明实际 Supabase RLS 配置正确。

已执行 `supabase/isolation-test.sql`，两个测试身份的读写隔离和旧版本写入拒绝检查通过，测试数据随事务回滚。已通过真实 GitHub 登录、功能收藏上传、退出后重新登录并读回收藏的基本检查。尚未完成两个真实 GitHub 账户、独立设备、跨设备冲突和断网恢复的完整验收。当前继续使用免费方案，直连失败作为已知限制保留，不承诺所有网络下无需 VPN。

参考：[GitHub 登录](https://supabase.com/docs/guides/auth/social-login/auth-github)、[跳转白名单](https://supabase.com/docs/guides/auth/redirect-urls)、[免费套餐](https://supabase.com/pricing)、[行级权限](https://supabase.com/docs/guides/database/postgres/row-level-security)。
