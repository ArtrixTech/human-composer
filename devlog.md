# Devlog

## 2026-05-26 — 项目初始化

- 初始化 git 仓库（`main` 分支）
- 添加 `.gitignore`（Node / Rust / Tauri / macOS）
- 创建 `AGENTS.md`：项目介绍与开发规范
- 搭建 Tauri 2 + React + TypeScript 最小项目脚手架
- 添加 React Flow 依赖，为图形化任务编排预留

**Commit:** `56d26e2`

## 2026-05-26 — 产品设计文档

- 添加 `.cursor/plans/human_composer_产品设计_7db1e838.plan.md`：完整产品设计方案
- 涵盖设计哲学、分层交互模型、数据模型、UI 组件层级、推荐逻辑、菜单栏指示器与分阶段实施路径

**Commit:** `3a07785`

## 2026-05-26 — Phase 1–4 完整实现

- 更新 `AGENTS.md`：设计哲学 #3 前额叶保护、#4 细粒度低阻力
- **Phase 1**：SQLite 数据模型 + CRUD、泳道 DAG 渲染、Linear 风格 UI 骨架（无边框窗口 + macOS traffic lights）
- **Phase 2**：Inbox 抽屉、支线末尾 + 创建、DetailPanel、DAG 连线依赖、Toast + Undo、悬浮窗（折叠/展开）、菜单栏 Tray 动态菜单
- **Phase 3**：推荐引擎（关键路径 + 支线均衡 + 置顶权重）、完成→推荐弹窗、Ready 高亮、Inbox 关键词自动分配建议
- **Phase 4**：全局快捷键（⌘⇧D 完成 / ⌘⇧N 快速添加 / ⌘K 命令面板）、语音输入（Web Speech API）、外部源 trait 骨架（ManualSource）
- 跨窗口 `graph-updated` 事件同步（主窗口 / 悬浮窗 / Tray）
- 安装 Rust toolchain（rustup）；`pnpm tauri` 脚本自动注入 `$HOME/.cargo/bin`

**Commit:** `5ca1bc6` (frontend), `ec2d0c3` (rust)

## 2026-05-26 — 修复启动黑屏/卡死

- **根因**：`emit_snapshot` 在持有 DB Mutex 时 `emit("graph-updated")`，同步触发 Tray 刷新再次抢锁 → 死锁；主窗口 `initialize` 卡在 `setActiveProject` invoke
- **修复**：所有 command 在 emit 前释放 DB 锁；Tray 刷新改为 async spawn；启动时跳过多余的 `setActiveProject` 调用

**Commit:** `ec2d0c3`

## 2026-05-26 — 窗体圆角

- 主窗口与悬浮窗启用 `transparent` + `shadow`，HTML 背景透明
- AppShell / FloatingWidget 应用 12px 圆角与边框
- `AGENTS.md` 补充「按具体改进项拆分提交」规范

**Commit:** _(pending — included in docs commit below)_
