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

**Commit:** `5ca1bc6` (UI chrome), `ec2d0c3` (window config), `6594273` (AGENTS 规范)

## 2026-06-01 — 交互优化与目标对齐（Today View + 全链路 UX）

- 更新产品设计文档：以人为中心的日程管理视角、Today View 章节、`estimated_minutes`、跨项目推荐与时间轴排布
- 更新 `AGENTS.md`：核心功能新增「今日安排视图」
- **数据层**：Task 新增 `estimated_minutes`；Settings 新增 `day_end_time`；新增 `get_today_snapshot` 跨项目聚合 API 与 `today.rs` 时间预算算法；全局单 Active 约束；新增 `delete_project` / `rename_branch` / `unarchive_branch` / `reorder_task` / `list_archived_branches`
- **Today View**：默认首页，含 TimeBudgetBar、ActiveTaskCard、ScheduleList、DaySummary；Sidebar「今日」入口与视图切换
- **悬浮窗 + Tray**：改用 today snapshot；移除 220ms 展开延迟；完成后展示推荐；Tray「快速添加任务…」
- **支线管理**：DAG「+ 新支线」、泳道双击重命名、右键归档、归档支线恢复面板
- **DetailPanel**：状态操作按钮、依赖删除、预估时长、上移/下移、删除任务
- **推荐非模态**：DAG 右下角滑入卡片，7s 自动消失；Today View 队列自动推进
- **Inbox + 删除**：点击下拉分配支线；Sidebar 项目右键删除
- **DAG 打磨**：隐藏已完成、空状态引导、泳道/项目进度条
- **体验打磨**：Command Palette 跨项目搜索与键盘导航、Toast 退出动画与进度条、Escape 关闭面板、TaskNode 信息密度

**Commit:** `7497a14` (prior), `2606b71` … `48c2161`

## 2026-06-01 — 添加交互优化实施计划文档

- 添加 `.cursor/plans/交互优化与目标对齐_1f222d06.plan.md`：Today View 锚点的 10 步实施计划（文档对齐 → 数据层 → Today View → 悬浮窗/Tray → 支线管理 → DetailPanel → 推荐非模态 → Inbox/删除 → DAG 打磨 → 体验打磨）

**Commit:** `1fc7c71`
