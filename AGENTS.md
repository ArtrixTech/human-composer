# Human Composer

## 项目介绍

Human Composer 是一个个人多任务并行管理器，用可视化图形界面编排多个项目及其子支线的并行执行流程，帮助用户明确「现在该做什么」，以实现效率最大化。

### 设计哲学

1. **Minimum effort** — 用户输入以语音/自然语言为主；能自动化就自动化，能直观呈现就直观呈现。
2. **e/acc** — 有效加速，帮助用户实现效率最大化。

### 技术栈

- **桌面端**: Tauri 2 (Rust)
- **前端**: React + TypeScript + Vite
- **图形编排**: React Flow (`@xyflow/react`)
- **目标平台**: macOS（早期）

### 核心功能（规划）

- 图形化任务编排界面：展示并行支线、任务及其关系（block、顺序）
- 菜单栏指示器：快速查看当前应执行的任务
- 多 project 源：支持手动创建，预留解耦接口供外部软件同步

---

## 项目规范

### Git 分支策略

采用 **Gitflow**：

| 分支 | 用途 |
|------|------|
| `main` | 生产就绪代码 |
| `develop` | 集成分支 |
| `feature/*` | 新功能 |
| `release/*` | 发布准备 |
| `hotfix/*` | 紧急修复 |

### Commit 规范

- 使用 **英文** commit message
- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如：
  - `feat: add task graph editor`
  - `fix: resolve menu bar icon rendering`
  - `chore: update dependencies`

### 提交节奏

做了一次**显著修改**后应先提交，即使尚未完全验证闭环。

### Devlog 规范

- 根目录维护 [`devlog.md`](devlog.md)
- **每次提交前**先记录本次主要改动，比 commit message 更详细但仍保持简要，确保主要改动都提及
- 新的 devlog 条目应将**上一条** devlog 对应条目的 git commit hash 附上
