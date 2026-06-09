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

## 2026-06-01 — DayRunway 今日任务核心界面重构方案

- 添加 `.cursor/plans/dayrunway_redesign_9ec238e3.plan.md`：以注意力泳道（Focus/Watch）替代单线程 Today View 列表
- 核心概念：领取→执行→完成循环、外部任务生命周期（Delegated/NeedsReview）、泳道动态管理
- 泳道填充策略：继承昨日泳道结构、新 Ready 任务追加到活跃泳道、用户手动拖拽调整
- 数据模型：`day_lanes` / `day_lane_tasks` 表、Task 外部任务字段、每泳道单 Active 约束
- 前端：`src/components/runway/` 自定义泳道组件（非 React Flow），六阶段实施路径

**Commit:** `553e059`

## 2026-06-01 — DayRunway 执行核查补漏 + UI 交互优化

- **后端**：`populate_lane_with_actionable_tasks` 在泳道为空时自动填充全部 pending 任务（拓扑排序）；有 ready/active 种子时追加下游 pending 管线
- **后端**：`DayRunwaySnapshot` 新增 `dependencies` 字段，仅传输泳道/backlog 涉及任务的依赖边
- **前端 pending 态**：TaskBlock 虚线边框、等待标签、阻塞上游任务名；LaneTrack 识别 pending 任务
- **依赖可视化**：任务块间 `DependencyConnector` 箭头；pending 块显示「等待: [上游]」
- **时间可视化**：TaskBlock 宽度 100–320px、右上角时间 badge；泳道头显示待解锁预估时间
- **NowStrip**：Header 下方一句话回答「现在该做什么」，含进行中/可领取/pending 管线引导
- **信息层级**：Header 展示预计收工 + 剩余工作量；CompletedBar 精简为纯回顾
- **交互基线**：hover/active/focus-visible 状态；LaneRow 关闭确认、重命名 pencil、+N 可展开、折叠动画
- **DragOverlay**：完整 TaskBlock 预览（宽度 + meta）
- **CSS 修复**：补全 `.backlog-pool__assign` 孤立属性；硬编码色迁移到 theme tokens
- **AddLaneDialog**：Escape 关闭、空名 disabled、类型说明、默认名称

**Commit:** `42d5936` (frontend), `28c5b3d` (backend), `40afe3f` (devlog)

## 2026-06-02 — DayRunway 集成 + Focus/Watch 交互流程修复

- **TodayView 退役**：AppShell 默认视图改为 `DayRunway`；删除 `src/components/today/`；store/API 全面切换为 `runwaySnapshot` 与泳道 CRUD / claim / external 命令
- **Focus/Watch 双轨状态机**：委派时从 focus 泳道强制迁入 watch 泳道；`claim_task` 不再暂停外部委派任务；`active_task_id` / `focus_lane_count` 仅统计 focus-active；rework 重置 `task_type=normal`
- **NowStrip 动作路由**：优先级 待审核 → 专注进行中 → 可领取 → 外部运行中；禁止对外部任务误调 `completeTask`
- **LaneTrack 渲染**：仅 `isExternalActive` 走 ExternalTaskBlock；普通任务误入 watch 泳道仍可领取
- **UI 栅格化**：TaskBlock/ExternalTaskBlock 独立拖拽手柄、标题 line-clamp、actions 底栏对齐；LaneRow header grid；NowStrip 新状态样式
- **三层交互面**：Tray / 悬浮窗按任务类型路由「完成 / 标记完成 / 审核」；委派成功 toast 引导继续领取
- 新增 `runwayTaskUtils.ts`、`ExternalTaskDialog.tsx`、`LaneTimeline.tsx`

**Commit:** `56dad85` (backend), `df53913` (frontend)

## 2026-06-02 — 消灭「待分配」+ DayRunway 紧凑化

- **后端**：`populate_lane_with_actionable_tasks` 末尾追加全部未分配 Ready/Pending；`close_day_lane` 关闭前将任务合并到剩余泳道（无泳道则新建「主线」）；`sync_day_runway` 每次同步把孤儿 Ready/Pending 塞入默认泳道
- **前端**：删除 `BacklogPool.tsx`、`NowStrip.tsx` 及 backlog DnD 路径；清理「待分配」文案（LaneRow、LanesContainer、CommandPalette、toast）
- **单行工具栏**：`RunwayHeader` 合并原 NowStrip（当前任务 + CTA）、时间预算、已完成计数；`FocusHealthIndicator` 仅在 ≥3 专注泳道时显示「高负荷」
- **紧凑布局**：卡片 88→68px、section-gap 24→12、lane-gap 16→10；TaskBlock 改为 dot+单行标题+时间 / meta 两行
- **悬浮窗**：快速添加任务不再依赖 `backlog` 取 projectId

**Commit:** `60bc8f8` (backend), `c3fa3e3` (frontend)

## 2026-06-02 — 项目 Kanban + 优先级/归档 + 三项修复

- **数据层**：`tasks.priority`、`tasks.archived`；`set_task_priority`、`archive_task`、`unarchive_task`、`delete_branch`、`reorder_branches`、`reorder_branch_tasks`；graph/runway/recommend 过滤已归档；推荐含 priority 权重
- **项目视图**：`ProjectWorkspace` + `KanbanBoard`（React Flow 竖列 Kanban，每列一支线）；`kanbanLayout` 列内拓扑排序 + 仅真实 blocking 边；`BranchColumnHeader` 菜单/拖拽排列
- **TaskNode**：180px 卡片、Top/Bottom handle、P{n}/归档；泳道 `TaskBlock` P badge
- **修复**：悬浮窗 Capture→Pick→Assign + `getAppSnapshot` projectId；Inbox/DetailPanel/CommandPalette 归档与支线 CRUD；修复 Kanban 容器高度为 0 导致黑屏

**Commit:** `1972c06` (backend), `ed74b44` (frontend), `77e1df0` (titlebar)

## 2026-06-04 — Project 页面 UI Linear 化

- **布局 token**：`theme.css` 新增 `--page-padding-*`、`--kanban-*`；`kanbanTokens.ts` 与 `kanbanLayout.ts` 同步（列宽 196、卡片 180×76、header/card 左对齐）
- **ProjectHeader**：两行结构（项目名 + inline stats；推荐 chip + 隐藏已完成）；去掉竖排英文 stat；RecommendPrompt 在 project 视图禁用
- **Kanban 扁平化**：移除 zebra 列与 dot 背景；`BranchColumnHeader` 改为 flat section；`TaskNode` left-accent、固定高度、hover-reveal 操作、全宽「+ 添加任务」
- **底部整合**：`ProjectFooterBar` 合并已归档支线/任务 popover；toolbar ghost 按钮；Inbox compact row + fixed popover 分配
- **间距统一**：Header / Toolbar / Board / Inbox 均使用 `--page-padding-x: 16px`

**Commit:** `a95d362`

## 2026-06-04 — Runway「稍后」让位

- **数据层**：`tasks.postponed` 布尔字段；`postpone_task` API；`claim_task` 同泳道顶替时自动标记稍后，领取时清除 flag
- **领取队列**：`isClaimCandidate` 跳过 postponed ready；lane 内仅剩 postponed 时 fallback 仍可领取
- **UI**：RunwayHeader / TaskBlock / FloatingWidget 将「暂停」改为「稍后」；postponed 卡片 badge +「现在做」；Project Kanban 仍用 `pauseTask`
- **悬浮窗**：折叠/展开态补齐完成、稍后、委派快速图标；委派复用 ExternalTaskDialog

**Commit:** `874ed04`

## 2026-06-05 — Kanban 菜单修复 + 悬浮窗支线按项目分组

- **Kanban 支线菜单**：`BranchColumnHeader` 下拉改用 portal + fixed 定位，避免被 board scroll 裁切；列背景/header 使用 `--bg-surface`；React Flow 节点层 `overflow: visible`
- **悬浮窗分配**：快速添加后支线选择按项目分组展示，推荐高亮限定在创建任务所属项目

**Commit:** `ae874f9`

## 2026-06-05 — 悬浮窗拖动修复

- **macOS 失焦拖动**：floating 窗口配置 `acceptFirstMouse: true`，首次点击即可拖动，无需先手动 focus
- **拖动区域**：移除全局 `-webkit-app-region: drag`（会干扰滚动与按钮）；折叠态任务信息区、展开态 header meta 使用 `data-tauri-drag-region="deep"`，点击子元素也能触发拖动

**Commit:** `e2f4322`

## 2026-06-05 — 悬浮窗双击打开主页

- 折叠/展开态拖动区域双击调用 `showMainWindow`，并 emit `main-show-today` 切换主窗口至今日安排视图

**Commit:** `55875e1`

## 2026-06-06 — 悬浮窗系统性优化

- **折叠态多泳道**：N 条泳道 = N 行紧凑泳道栈，窗口高度随行数精确增长（36px/行），无内部留白
- **完成后保持折叠**：删除完成后强制展开；各行就地完成/领取下一项
- **Per-lane 可领取**：`findLaneClaimableOptions` 按全局推荐顺序展示多任务胶囊，点击即领取
- **组件拆分**：`FloatingLaneRow` + `floatingSize` 统一折叠/展开泳道行与动态窗口尺寸
- **Tauri 同步**：`toggle_floating_expanded` 改为 emit `floating-toggle-expand`；初始窗口 300×36

**Commit:** `f376dee`

## 2026-06-06 — 悬浮窗圆角裁切与独立通知胶囊

- **圆角裁切**：圆角/背景/边框移至 `.floating-shell`，`overflow: hidden` 裁切透明窗口尖角
- **动态尺寸**：`useLayoutEffect` 测量 `shellRef.scrollHeight` 同步窗口高度，展开态 footer 不再被裁切
- **独立通知**：临时反馈改为悬浮窗正下方 `floating-notice` 圆角胶囊，2s 自动收起，主面板高度不变
- **泳道排序**：折叠/展开态 `sortLanesForDisplay`，watch 泳道置底；外部任务行黄色虚线样式

**Commit:** `b7cc00b`

## 2026-06-09 — 支线归档删除修复 + 概念重命名计划 (prev: `b7cc00b`)

- **支线操作修复**：移除 `window.confirm`（Tauri WebView 无效），归档/删除点击即执行；归档 Toast 支持 Undo（`unarchiveBranch`）
- **重命名计划**：新增 `.cursor/plans/支线任务概念重命名_2e0b640e.plan.md`，决策 **A+α**（UI「目标-行动」、代码 `Outcome`/`Action`，DB/IPC 保持 branch/task 别名）

**Commit:** `c0a127b`

## 2026-06-09 — 目标/行动概念重命名 Outcome/Action (prev: `1b97fec`)

- **文档**：`AGENTS.md` 新增 Glossary；产品设计 plan 修正 Outcome≠泳道
- **TS**：`Outcome`/`Action` 主类型 + wire 解析器；API/Store 新函数名，JSON 仍 `branches`/`tasks`
- **Rust**：`Outcome`/`Action` type alias；`recommend`/`auto_assign` 内部改名
- **UI**：全局「目标-行动」文案；`OutcomeColumnHeader`/`ActionNode` 组件重命名；DetailPanel inline 重命名目标

**Commit:** `418ca06`

## 2026-06-09 — 泳道自动配色（可开关）(prev: `418ca06`)

- **专注泳道**：按排序自动分配 8 色色相（左边框 + 名称色点）；等待泳道仍用黄色虚线
- **可选**：今日安排标题栏调色板按钮切换；偏好存 `localStorage`（`hc-lane-colors-enabled`，默认开启）
- **同步**：主窗口 `LaneRow` 与悬浮窗 `FloatingLaneRow` 共用同一套索引与开关

**Commit:** `4eead85`

## 2026-06-09 — 悬浮窗透明圆角修复 (prev: `253af53`)

- 关闭 floating 窗口原生 shadow / ContentBackground，改由 CSS `floating-shell` 负责圆角与阴影
- `floating.html` / `floating-window.css`：根节点填满 webview，避免透明窗矩形边框

**Commit:** `5a9efd7`

## 2026-06-09 — 概念重命名计划全部完成 (prev: `3ab8c64`)

- 更新 `.cursor/plans/支线任务概念重命名_2e0b640e.plan.md`：Phase 0–5 todos 标记为 completed

**Commit:** `111ceea`

## 2026-06-09 — 体验堵点全面优化 (prev: `111ceea`)

- **优先级 H/M/L**：`Action.priority`、`DayLane.priorityTier`、`Project.priority` 三档枚举；DB 迁移旧 P1–P5；推荐引擎与泳道排序联动
- **泳道自动分配**：首日创建「重要/日常/可选」三泳道；`sync_day_runway` 按 Action 优先级入对应 tier；跨泳道拖拽同步 priority
- **LLM**：`llm.rs` + `reqwest` OpenAI-compatible；`get/set/test_llm_config` IPC；侧栏 AI 设置面板；创建 Inbox 行动时 LLM 建议 Outcome（降级关键词）
- **自动化**：`create_task` / `assign_task_to_branch` 后 `auto_slot_action_to_lane`；置信度 ≥0.8 自动分配 Outcome
- **悬浮窗**：泳道色条内缩伪元素防圆角裁切；claim 后 notice 反馈；外部任务多行展示
- **交互减负**：`PriorityPicker` / `DurationPicker` 替换数字输入；Kanban 卡片间距 16px、Handle 扩大、依赖快捷选择；列头/列背景 UI 抛光

**Commit:** `d810d67` (also `46cc5cb` priority, `a675ddc` llm)

## 2026-06-09 — 泳道四档、整理与悬浮窗修复 (prev: `813fbba`)

- **泳道四档**：`LaneTier` T1–T4（主线/副线/次要/可选）替代 H/M/L 泳道档位；DB 迁移旧泳道名与 tier；`enabled_lane_count` 设置（默认 3）
- **顶栏**：1–4 按钮切换启用泳道数；**整理**按钮手动按行动优先级重分配；调整数量后自动调用 `reorganize_focus_lanes`
- **悬浮窗**：修复折叠态 drag-region 吞点击导致胶囊无法领取；泳道名保留拖动区；每泳道 **+** 快速 Inbox 入泳道
- **行动优先级标签**：H/M/L 显示改为高/中/低，与泳道档位解耦

**Commit:** `ba7c1c9`, `422c998`

## 2026-06-09 — UI overhaul: DOM 画布、今日视图、侧栏图标 (prev: `0f93c4d`)

- **项目画布**：移除 React Flow；纯 DOM 竖列 + `ActionCard` + SVG 正交 block 连线（淡灰白、右侧双端口）；`@dnd-kit` 列内/跨列拖拽；移除 `@xyflow/react` 与死代码（`DAGCanvas`、`ActionNode` 等）
- **今日视图**：顶栏溢出菜单减负；预算截断；泳道边框与任务卡层叠/信息密度修复
- **侧栏/项目**：`PROJECT_ICONS` 改 lucide key + `ProjectIcon`；项目设置菜单（优先级/色/图标）；DB emoji→key 迁移；侧栏项目行布局与色点+线条 icon 指示
- **布局**：竖列顶部留白与列间距 token 调整；修复项目页无限重渲染黑屏

**Commit:** `336cc34`
