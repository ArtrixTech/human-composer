---
name: Human Composer UX 优化方案
overview: 基于产品设计文档与实际代码的系统性差距分析，提出分优先级的交互优化方案，覆盖核心工作流断裂修复、交互摩擦消除、缺失功能补齐三大维度。
todos:
  - id: phase-a
    content: "Phase A: 核心工作流修复 -- 支线 CRUD UI / 推荐弹窗非模态化 / 任务项目删除"
    status: pending
  - id: phase-b
    content: "Phase B: 核心循环完善 -- 悬浮窗延迟修复 / DetailPanel 操作 / Inbox 分配优化 / 悬浮窗推荐循环 / 依赖删除 / 任务排序 / Done 降噪"
    status: pending
  - id: phase-c
    content: "Phase C: 体验打磨 -- Command Palette / Toast 动画 / 空状态引导 / Tray 快速添加 / 进度追踪 / 动画过渡 / 键盘导航 / 节点信息密度"
    status: pending
isProject: false
---

# Human Composer 系统性产品交互优化方案

## 评估方法论

从产品核心价值"帮助用户明确「现在该做什么」"出发，将用户工作流分为四条主线评估：

1. **Setup（编排）**: 创建项目/支线/任务/依赖关系
2. **Execute（执行）**: 完成 -> 推荐 -> 开始 核心循环
3. **Capture（捕获）**: 快速记录碎片任务并分配
4. **Monitor（监控）**: 了解整体进度与瓶颈

---

## 一、交互设计不合理之处（现有功能的问题）

### 1.1 [P0] 支线（Branch）管理在主界面完全缺失

**现状**: 后端有 `create_branch`、`archive_branch` API，但主窗口没有任何创建支线的入口。用户只能依赖种子数据的预设支线，无法定义自己的并行执行轨道。

**影响**: Setup 工作流断裂 -- 整个产品的核心概念"并行支线编排"无法由用户自主构建。

**优化方案**:
- 在 DAG 画布左侧的泳道标签区域添加"+ 新支线"按钮
- ProjectHeader 或 DAG 空状态下添加创建支线入口
- 泳道标签（`LaneLabelNode`）支持双击重命名
- 右键泳道标签弹出上下文菜单：重命名 / 归档 / 排序
- 被归档支线在 Sidebar 或设置中可查看和恢复

### 1.2 [P0] 推荐弹窗违反"无确认弹窗"设计原则

**现状**: `RecommendPrompt` 是一个 `position: fixed; top: 50%; left: 50%` 的居中模态弹窗，没有背景遮罩的点击关闭，阻断了用户对 DAG 的视线和操作。

```css
/* 当前实现 -- 阻断式 */
.recommend-prompt {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 900;
}
```

**影响**: 违反设计哲学 #4"无确认弹窗，误操作靠 Undo 挽回"。每次完成任务都会被打断。

**优化方案**:
- 改为右下角滑入式 Toast-like 推荐卡片（非模态）
- 保持 5-8 秒后自动消失（足够用户决策）
- 卡片内一键"开始推荐的任务"+ "查看更多 Ready"
- 若用户不操作，自动淡出，不阻断任何工作流
- 点击卡片外区域立即消失

### 1.3 [P1] 悬浮窗单击/双击区分导致 220ms 交互延迟

**现状**: `FloatingWidget` 用 `setTimeout(220ms)` 区分展开（单击）和打开主窗口（双击），导致每次展开操作有明显滞后感。

```typescript
// 当前实现 -- 220ms 延迟
const handleExpandClick = () => {
  expandClickTimer.current = setTimeout(() => {
    void resize(true);
  }, 220);
};
```

**影响**: 违反设计哲学 #1 "Minimum effort" -- 高频操作应该即时响应。

**优化方案**:
- 取消双击开主窗口的设计
- 折叠态：单击展开（即时响应，0ms 延迟）
- 展开态 header：添加小的"外部链接"图标按钮来打开主窗口
- 或：折叠态用明确的两个不同按钮区域（展开 vs 打开主窗口）代替双击

### 1.4 [P1] Detail Panel 缺少关键操作按钮

**现状**: [DetailPanel.tsx](src/components/detail/DetailPanel.tsx) 显示任务状态（如 `active` / `ready`）但没有任何状态流转按钮。显示依赖关系但没有删除按钮。没有删除任务的入口。

**影响**: 用户点开详情面板期望能执行操作，但发现只能编辑标题和描述。需要回到 DAG 上点小按钮来操作。

**优化方案**:
- 状态区域添加操作按钮组：开始 / 完成 / 暂停（根据当前状态动态显示）
- 依赖列表每项添加"x"删除按钮
- 添加"添加依赖"入口（下拉选择任务）
- 底部添加危险操作区：删除任务（带确认或 Undo）
- 添加"移动到其他支线"操作

### 1.5 [P1] Inbox 拖拽未实现，分配交互过于粗糙

**现状**: `InboxPanel` 的 item 有 `draggable` 属性但无任何 DnD handler。分配只能通过每个 inbox item 旁边的 `→ branchName` 小按钮。当支线多时按钮会挤满一行。

**影响**: 设计文档明确写了"从 Inbox 拖拽到泳道图的某条支线"，但未实现。按钮式分配在多支线时体验差。

**优化方案**:
- 实现 HTML5 或 React DnD 从 Inbox 拖拽到泳道
- 或更简单：点击 inbox item 后弹出轻量级支线选择下拉（比逐项排列按钮更清晰）
- 自动建议的分支高亮显示在选择列表顶部

### 1.6 [P1] Active 任务约束未向用户传达

**现状**: `activate_task` 函数会将当前项目所有 active 任务静默设为 ready（一次只能有一个 active 任务），但 UI 没有任何提示。

```rust
// db.rs - 静默切换
pub fn activate_task(&self, task_id: &str, project_id: &str) -> rusqlite::Result<Task> {
    self.conn.execute(
        "UPDATE tasks SET status = 'ready' WHERE status = 'active' AND project_id = ?1",
        params![project_id],
    )?;
    self.set_task_status(task_id, TaskStatus::Active)
}
```

**影响**: 用户可能困惑为什么之前的 active 任务突然变成了 ready。违反"前额叶保护"原则。

**优化方案**:
- 激活新任务时，Toast 提示"已切换到「新任务」，「旧任务」已暂停"
- 在 ProjectHeader 明确标注"单 Active 任务模式"
- 或：支持多 Active 但用推荐引擎引导聚焦

### 1.7 [P2] Command Palette 功能过于简陋

**现状**: [CommandPalette.tsx](src/components/command/CommandPalette.tsx) 只支持 3 个固定命令（完成当前、开始 xxx、默认添加到 Inbox），没有模糊搜索、没有任务列表导航、没有项目切换。

**影响**: 设计文档定义的是"Cmd+K 风格命令面板"，应该是像 Linear/Raycast 那样的全能入口。

**优化方案**:
- 输入即模糊搜索所有任务（跨项目）
- 支持命令前缀：`/add`、`/switch`、`/branch`、`/complete`
- 搜索结果列表可键盘上下选择 + Enter 执行
- 集成项目切换、支线创建等管理操作
- 搜索结果分组显示（任务 / 项目 / 命令）

### 1.8 [P2] Toast 缺少退出动画和时间指示

**现状**: Toast 有入场动画（`toast-in`）但 2500ms 后瞬间消失，没有退出动画，也没有剩余时间指示。

**优化方案**:
- 添加退出动画（fade-out + slide-down）
- 添加底部进度条指示剩余时间
- Toast 悬停时暂停自动消失计时

### 1.9 [P2] DAG 画布空状态引导缺失

**现状**: 当项目无支线/任务时，显示"选择或创建一个项目以开始编排" -- 但即使项目已存在也不知道怎么添加支线。

**优化方案**:
- 新项目空状态：显示引导卡片，带"创建第一条支线"CTA
- 有支线无任务：在泳道内显示"从这里添加第一个任务"引导
- 新用户首次进入：简短的 3 步引导（创建支线 -> 添加任务 -> 开始执行）

---

## 二、缺失功能清单与优化建议

### 2.1 [P0] 任务/项目删除功能

**现状**: 只有 `delete_task` 后端 API，前端无任何删除入口。无项目删除功能。

**优化方案**:
- Detail Panel 底部添加"删除任务"按钮（红色，配 Undo toast）
- 任务节点右键菜单添加删除选项
- Sidebar 项目 item 右键/长按弹出删除选项（带确认）
- 后端添加 `delete_project` command

### 2.2 [P1] 悬浮窗的完成-推荐循环断裂

**现状**: `FloatingWidget` 完成任务后直接调用 API，不展示推荐结果。主窗口的 recommend prompt 在悬浮窗中不存在。

```typescript
// FloatingWidget.tsx -- 完成后无推荐
const complete = async () => {
  if (!active || !snapshot) return;
  await api.completeTask(active.task.id, snapshot.projectId);
  // 缺失：没有获取和展示推荐
};
```

**影响**: 设计文档核心的"完成->推荐->开始"循环在悬浮窗层断裂。用户完成任务后需要手动查看"推荐"区域。

**优化方案**:
- 完成任务后获取 `CompleteTaskResult.recommendations`
- 展开态自动滚到推荐区域并高亮闪烁
- 或弹出轻量级推荐卡片覆盖在悬浮窗内
- 折叠态完成后自动展开显示推荐

### 2.3 [P1] 依赖关系无法从 UI 删除

**现状**: 可以在 DAG 上连线创建依赖，但无法删除。Detail Panel 显示"阻塞于/阻塞"但没有操作按钮。API `remove_dependency` 存在但无前端调用。

**优化方案**:
- Detail Panel 依赖列表每项添加"x"删除按钮
- DAG 上点击依赖边 (BlockingEdge) 时高亮并显示删除按钮
- 或：选中边后按 Delete 键删除

### 2.4 [P1] 支线内任务排序不可调整

**现状**: 任务的 `sort_order` 决定了泳道内的顺序，但没有任何 UI 来拖拽排序。

**优化方案**:
- DAG 内支持拖拽任务节点调整顺序
- 或 Detail Panel 添加"上移/下移"按钮
- 拖拽结束后更新 `sort_order` 并重新布局

### 2.5 [P1] 完成任务的视觉降噪

**现状**: Done 任务以 65% 透明度和删除线显示在泳道中，占据空间并增加视觉噪音。

**优化方案**:
- ProjectHeader 添加"隐藏已完成"开关
- 默认折叠 Done 任务（显示为小圆点或计数标记"3 done"）
- 或：Done 任务只在悬停泳道时展开显示

### 2.6 [P2] 菜单栏缺少"快速添加任务"入口

**现状**: 设计文档定义了 Tray 下拉中有"快速添加任务..."选项，当前 [tray.rs](src-tauri/src/tray.rs) 未实现。

**优化方案**:
- Tray menu 添加"快速添加任务..."选项
- 点击后弹出一个最小输入框窗口（或聚焦到悬浮窗的输入框并展开）

### 2.7 [P2] 进度追踪缺失

**现状**: ProjectHeader 只显示 Active/Ready/Inbox/Branches 数量。没有完成率、没有进度条。

**优化方案**:
- ProjectHeader 添加整体完成进度条（Done / Total）
- 泳道标签旁添加支线进度指示（如 "3/7"）
- Sidebar 项目列表添加简化进度条

### 2.8 [P2] 缺少关键动画和过渡

**现状**: Sidebar 折叠、Detail Panel 出现/消失、Inbox 展开/收起均无过渡动画。

**优化方案**:
- Sidebar 折叠/展开：CSS transition on width
- Detail Panel：slide-in-from-right 动画
- Inbox Panel：smooth height transition
- 悬浮窗展开/折叠：窗口 resize 配合内容 fade
- 任务状态变化：节点颜色渐变过渡

### 2.9 [P3] 键盘导航和快捷键不足

**现状**: 只有 3 个全局快捷键（Cmd+Shift+D 完成 / Cmd+Shift+N 快速添加 / Cmd+K 命令面板）。DAG 无键盘导航。

**优化方案**:
- DAG 中支持 Tab 在节点间导航，Enter 展开详情
- Escape 关闭 Detail Panel
- Cmd+Z 全局 Undo（当前只在 Toast 中有 Undo 按钮）
- 方向键在 Command Palette 结果中导航

### 2.10 [P3] 任务节点信息密度不足

**现状**: TaskNode 只显示状态标签 + 标题。不显示依赖数量、被阻塞数、是否有描述等信息。

**优化方案**:
- 底部添加微标签行：依赖图标 + 数量 / pin 标记 / 描述指示器
- 被推荐的任务节点添加 sparkle 动效或脉冲边框
- 悬停时显示更多信息（tooltip 或扩展卡片）

---

## 三、优化优先级总结

### Phase A: 核心工作流修复 (P0)

解决 Setup 和 Execute 工作流的断裂：

| 项 | 内容 |
|---|---|
| 1.1 | 支线 CRUD UI（创建/重命名/归档/排序） |
| 1.2 | 推荐弹窗改为非模态滑入式 |
| 2.1 | 任务和项目删除功能 |

### Phase B: 核心循环完善 (P1)

确保三层交互面的"完成->推荐->开始"循环完整：

| 项 | 内容 |
|---|---|
| 1.3 | 悬浮窗展开延迟修复 |
| 1.4 | Detail Panel 操作按钮补齐 |
| 1.5 | Inbox 分配交互优化 |
| 1.6 | Active 约束透明化 |
| 2.2 | 悬浮窗推荐循环修复 |
| 2.3 | 依赖删除 UI |
| 2.4 | 支线内任务排序 |
| 2.5 | 完成任务视觉降噪 |

### Phase C: 体验打磨 (P2-P3)

提升交互流畅度和信息密度：

| 项 | 内容 |
|---|---|
| 1.7 | Command Palette 增强 |
| 1.8 | Toast 动画优化 |
| 1.9 | 空状态引导 |
| 2.6 | Tray 快速添加 |
| 2.7 | 进度追踪 |
| 2.8 | 动画和过渡 |
| 2.9 | 键盘导航 |
| 2.10 | 任务节点信息密度 |
