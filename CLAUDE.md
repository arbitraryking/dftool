# CLAUDE.md

本文件用于记录 DFtool 项目的协作、开发、发布规范。Claude Code 在本仓库中工作时应遵守以下约定。

## 项目概况

DFtool 是一个基于 Tauri v2、React、TypeScript、Vite、Rust 和 pnpm 的桌面应用，用于《三角洲行动》PC 端外部地图标点覆盖显示。

项目只做外部桌面覆盖层：不注入游戏进程、不修改游戏文件、不读写游戏内存、不做反作弊绕过。

## 分支模型

本项目采用以下分支流程：

```text
feature/* -> develop -> main -> tag -> GitHub Releases
```

分支职责：

- `main`：稳定发布分支，只保存可发布源码。
- `develop`：日常集成分支，新功能完成后先合入此分支。
- `feature/*`：新功能开发分支，必须从 `develop` 创建。
- `fix/*`：问题修复分支，通常从 `develop` 创建；紧急生产修复可从 `main` 创建后同步回 `develop`。

不使用 `release` 分支保存编译产物。编译后的安装包和可执行文件统一通过 GitHub Releases 发布。

## 新功能开发流程

开发新功能时按以下流程执行：

1. 确认当前分支为 `develop`，并同步远程：

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. 从 `develop` 创建功能分支：

   ```bash
   git checkout -b feature/<short-description>
   ```

3. 在功能分支上完成开发和本地验证。

4. 提交并推送功能分支：

   ```bash
   git add <changed-files>
   git commit -m "Add <feature description>"
   git push -u origin feature/<short-description>
   ```

5. 在 GitHub 创建 Pull Request：

   ```text
   feature/<short-description> -> develop
   ```

6. CI 通过并完成审查后合并到 `develop`。

7. 当 `develop` 稳定后，再创建 Pull Request：

   ```text
   develop -> main
   ```

8. 合并到 `main` 后，通过 tag 触发 GitHub Releases 发布。

## 开发规范

- 不直接在 `main` 上开发功能。
- 不直接向 `main` 推送代码，必须通过 Pull Request 合并。
- 新功能优先使用 `feature/*` 分支。
- Bug 修复优先使用 `fix/*` 分支。
- 每个分支只处理一个明确目标，避免混入无关重构。
- 修改代码前必须先阅读相关文件，理解现有实现和项目结构。
- 避免过度设计，只实现当前需求需要的最小改动。
- 不提交构建产物、依赖目录、运行时数据或临时文件。
- 不将 `.env`、密钥、凭据、证书等敏感信息提交到仓库。
- 不新增与项目目标冲突的能力，例如进程注入、游戏内存读写、反作弊绕过等。

## 本地检查命令

提交前建议至少执行：

```bash
pnpm typecheck
pnpm test
cargo check --manifest-path src-tauri/Cargo.toml
```

发布前或涉及桌面端能力时建议执行：

```bash
pnpm tauri build
```

项目脚本来源：

- `pnpm typecheck`：TypeScript 类型检查。
- `pnpm test`：Vitest 单元测试。
- `pnpm build`：前端类型检查和 Vite 构建。
- `pnpm tauri build`：Tauri 桌面应用构建。

## CI 规范

仓库使用 GitHub Actions：

- `.github/workflows/ci.yml`：用于 `develop`、`main` 的 push 和 Pull Request 检查。
- `.github/workflows/release.yml`：用于 tag 发布和手动发布。

CI 应至少检查：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
cargo check --manifest-path src-tauri/Cargo.toml
```

Release workflow 还应执行：

```bash
pnpm tauri build
```

## 版本和发布规范

发布流程：

```text
develop -> main -> tag vX.Y.Z -> GitHub Actions -> GitHub Releases
```

发布前需要确认版本号同步：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

版本号使用语义化版本格式：

```text
MAJOR.MINOR.PATCH
```

示例：

```text
0.1.0
0.2.0
1.0.0
```

发布 tag 使用 `v` 前缀：

```bash
git tag v0.1.0
git push origin v0.1.0
```

推送 tag 后，GitHub Actions 会创建 draft GitHub Release。确认产物无误后再手动发布。

## 发布产物规范

构建产物不提交到 Git 仓库。

前端构建产物目录：

```text
dist/
```

Tauri 发布产物目录：

```text
src-tauri/target/release/bundle/
```

GitHub Releases 上传的主要产物类型：

```text
*.exe
*.msi
*.zip
```

## 提交信息建议

提交信息使用简洁英文祈使句，描述本次变更目的，例如：

```text
Add marker filter
Fix overlay visibility toggle
Update release workflow
Refactor marker editing state
```

常用前缀可选：

- `Add`：新增功能。
- `Fix`：修复问题。
- `Update`：更新已有能力或配置。
- `Refactor`：重构，不改变功能行为。
- `Test`：新增或调整测试。
- `Docs`：文档变更。

## Claude Code 工作约定

Claude Code 在本项目中执行任务时应：

- 优先确认当前任务应基于哪个分支完成。
- 涉及新功能时，默认从 `develop` 创建 `feature/*` 分支，除非用户另有说明。
- 修改代码前先阅读相关文件，不基于猜测改动。
- 涉及多步骤任务时使用 todo 跟踪进度。
- 完成修改后说明改动文件、关键位置和建议验证命令。
- 未经用户明确要求，不主动创建 git commit、tag 或 push。
- 未经用户明确要求，不修改 GitHub Release、删除远程分支或执行破坏性 git 操作。

## 最小上下文与省 token 约定

为尽量节省额度，Claude Code 在本项目中工作时应：

- 默认不要通读、总结或扫描整个仓库。
- 开始任务时优先只阅读 `README.md`、用户明确指定的文件，以及完成任务所必需的配置文件。
- 新功能开发或 Bug 修复时，先使用 `Glob` / `Grep` 定位相关实现，再只读取与当前任务直接相关的文件或片段。
- 修改代码前仍必须阅读被修改文件及其必要上下文，避免在不了解现有实现的情况下改动。
- 不主动读取大型文件、构建产物、依赖目录、运行时数据、日志文件或无关目录。
- 如确实需要大范围代码扫描、架构梳理、全仓库审查或读取大量文件，应先说明原因，并在继续前征得用户同意。
- 除非用户明确要求“全面审查”“全仓库分析”“彻底排查”等，否则不要执行全仓库级别探索。
