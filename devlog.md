# Devlog

## 2026-05-26 — 项目初始化

- 初始化 git 仓库（`main` 分支）
- 添加 `.gitignore`（Node / Rust / Tauri / macOS）
- 创建 `AGENTS.md`：项目介绍与开发规范
- 搭建 Tauri 2 + React + TypeScript 最小项目脚手架
- 添加 React Flow 依赖，为图形化任务编排预留

**Commit:** `56d26e2`

## 2026-05-26 — 产品设计与文档更新 (prev: `56d26e2`)

- 完成产品设计讨论，写入 `.cursor/plans/human_composer_产品设计_7db1e838.plan.md`
- 核心设计决策：泳道式 DAG（横向）、细粒度任务、三层交互面（菜单栏→悬浮窗→主窗口）、完成→推荐自动循环、Toast+Undo 无弹窗模式、SQLite 持久化
- 更新 `AGENTS.md`：新增设计哲学 #3（前额叶保护）、#4（细粒度、低阻力）及交互原则；扩充核心功能描述

**Commit:** `3a07785`

## 2026-05-26 — Phase 1-4 全量实现 (prev: `3a07785`)

**Phase 1 — 数据基础 + 泳道 DAG 渲染**
- Rust：`models.rs`（Project/Branch/Task/TaskDependency 数据模型，TaskStatus 状态机）、`db.rs`（SQLite WAL 模式 + 4 张表迁移）、`commands.rs`（完整 CRUD + cascade_ready 完成级联解锁逻辑）
- 前端：Zustand store、TypeScript 类型定义、自定义 React Flow 节点（TaskNode、BranchLaneNode、AddTaskNode）、泳道 DAG 布局算法、深色主题 UI 骨架（Sidebar + ProjectHeader + DAGCanvas）

**Phase 2 — 核心交互 + 三层界面**
- InboxPanel（底部抽屉，快速收集任务 + 一键分配到支线）
- DetailPanel（右侧滑出，任务详情编辑 + 依赖关系展示）
- Toast + Undo（全局 Toast 系统，操作即生效 + 1-2s 内 Undo）
- FloatingWidget（独立 Tauri 窗口，always-on-top，折叠/展开态，完成+推荐+快速添加）
- 系统托盘（Tauri tray-icon：常驻图标 + Toggle Widget / Open / Quit 菜单）
- tauri.conf.json：主窗口 titleBar Overlay（macOS 原生交通灯），floating-widget 窗口配置

**Phase 3 — 推荐引擎 + 核心循环**
- `get_recommendations`：关键路径分析（递归 CTE 计算下游任务数）+ 加权排序
- `update_task_status` 完成时自动级联解锁所有满足条件的 Pending 任务 → Ready
- RecommendPopup：完成任务后弹出推荐（排序前 3），支持一键开始或忽略
- 支线归档（archive_branch 命令）

**Phase 4 — 提效增强**
- 命令面板（Cmd+K，模糊搜索任务 + 快速执行完成/开始/添加操作，键盘导航）
- 全局快捷键（`tauri-plugin-global-shortcut` v2：`CmdOrCtrl+Shift+H` 切换悬浮窗，`CmdOrCtrl+Shift+D` 完成当前任务）
- 外部源接口（`sources.rs`：`ProjectSource` trait + `ManualSource` 实现，预留 Linear/GitHub 扩展点）
- Tauri 事件总线：所有状态变更通过 emit 广播，主窗口与悬浮窗跨窗口状态自动同步

**Commit:** `f113ccd`
