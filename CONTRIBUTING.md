# 参与改进

## 协作方式

有写权限的协作者可以在自己的分支提交修改，再向 `main` 发起 Pull Request。其他贡献者可以先 Fork，再从自己的仓库提交 PR。请在 PR 中写清楚问题、修改后的行为和实际验证结果，由项目所有者检查后合并。不要直接向 `main` 提交；这是协作约定，是否由 GitHub 强制限制取决于仓库的分支保护设置。

```text
git switch main
git pull --ff-only
git switch -c fix/short-description
# 修改文件并运行与修改相关的测试
git add <要提交的文件>
git commit -m "Describe the change"
git push -u origin HEAD
```

推送后在 GitHub 的 Pull requests 页面创建 PR，目标分支选择 `main`。第一次运行项目请按 README 安装依赖；验证当前 Python 基础能力建议使用 Python 3.12，并设置 `CODELINGO_PYTHON`。

## Windows 开发入口

使用 PowerShell 7，在仓库根目录运行：

```powershell
./dev.ps1 -Task Install
./dev.ps1 -Task Verify -Python '你的 Python 3.12 安装目录/python.exe'
./dev.ps1 -Task Start -Python '你的 Python 3.12 安装目录/python.exe'
```

`Install` 将 package.json 指定版本的 pnpm 安装到忽略目录 `.runtime/tools`，
再按现有锁文件安装依赖，不需要全局安装 pnpm。`Test` 只运行自动测试；
`Verify` 依次运行自动测试和公开样本校验；`Start` 启动本地服务，用 Ctrl+C 停止。

解释器选择依次采用 `-Python`、`CODELINGO_PYTHON`、
`.runtime/dev-config.json` 中的 `python` 字段、PATH 中的 `python.exe`。
本机配置可以写成 `{"python":"D:/Tools/Python312/python.exe"}`，不要提交它。
开发入口同时准备 `CODELINGO_PYTHON` 和 PATH，以兼容直接调用 `python` 的历史测试；
这些环境设置仅影响本次进程。开发验证要求 Python 3.12+，不改变 README 的产品最低版本声明。

项目代码和可选 AI 服务配置彼此独立，运行本地测试不需要 API 密钥。

## Git 与 PR 检查

建议每位协作者在自己的克隆中设置（仅当前仓库生效）：

```text
git config --local pull.ff only
git config --local fetch.prune true
git config --local push.default simple
git config --local push.autoSetupRemote true
git config --local remote.pushDefault origin
git config --local core.autocrlf false
```

`pull.ff=only` 会在分支分叉时停下来，避免拉取时意外生成合并提交。
它和其他本地配置都不能阻止向 main 推送；仍须遵守分支协作约定。

`.gitattributes` 要求测试样本保留提交中的原始字节。公开样本使用 SHA-256
核对来源，Windows 自动转换换行也会导致校验失败；不要通过修改 manifest 哈希解决。
对于本地无修改的旧克隆，可以在采用该属性文件后恢复样本：

```text
git diff -- tests/corpus tests/holdout tests/fixtures
# 确认没有需要保留的修改后，才执行下一条；它会覆盖这些目录的本地改动。
git restore --source=HEAD --worktree -- tests/corpus tests/holdout tests/fixtures
```

PR 工作流定义在 `.github/workflows/ci.yml`，在 Windows 和 Ubuntu 上使用
Node.js 24、Python 3.12、package.json 指定的 pnpm，运行 `pnpm test` 和
`pnpm run test:release`。Action 固定到提交哈希。浏览器、OCR 实机效果、
外部五仓库语料和桌面安装器仍需按改动范围单独验收，CI 不涵盖这些检查。

提交前查看实际 diff，再精确暂存本次改动：

```text
git diff --check
git diff
git add <本次改动的文件>
git diff --cached
git commit -m "Describe the change"
git push -u origin HEAD
```

有 GitHub CLI 时，可使用 `gh pr create --base main --draft` 创建草稿 PR；
按现有模板填写具体问题、改动和实际测试结果。多人参与时各自使用任务分支，
合并后再从更新的 main 创建下一条分支。需要吸收 main 的变更时，先 fetch，
再在自己的任务分支合并 `origin/main`，解决冲突后复测。

主分支保护需要仓库所有者在 GitHub 配置，并受仓库套餐能力限制。
应在工作流成功运行后，再将相应测试状态设为合并要求；本地 Git 设置不能替代它。

不要提交 `.env`、API 密钥、浏览器收藏、运行日志和本机依赖目录。`tests/fixtures` 是解析测试的输入材料，其中出现的脚本和配置不应作为安装步骤执行。

## 反馈与实现

提交反馈时请提供最小可公开样本、文件类型、软件版本、构建编号、实际解释与预期解释。请先移除密钥和私人数据；不要只截图报错而遗漏输入。

新增规则需要同时提供应匹配和不应匹配的例子，检查名称覆盖、嵌套与源码范围。优先完善已有语言的解释，不因识别出扩展名就宣称支持整个语言。

语法读取放在解析模块；行为事实放在语义模块；界面只渲染统一 guide 字段。新知识卡必须有独立教学例子与可以验证的预期结果。

复用第三方源码时，保留来源、固定提交、哈希及许可证。发布前按 VALIDATION.md 复查。

## 公开发行的测试资料

反馈样本现为自编回归输入，来源记录见 [fixtures 说明](tests/fixtures/README.md)。新增测试应使用自编代码或提供明确可再分发的来源与许可证，不把真实凭据或用户原始私有项目放入测试目录。
