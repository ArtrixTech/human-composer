export type TaskStatus = "inbox" | "pending" | "ready" | "active" | "done";
export type TaskType = "normal" | "external";
export type ExternalStatus = "delegated" | "needs_review" | null;
export type DayLaneType = "focus" | "watch";

export interface Project {
  id: string;
  name: string;
  sourceType: string;
  sourceRef: string | null;
  createdAt: string;
}

export interface Branch {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  branchId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  sortOrder: number;
  pinned: boolean;
  estimatedMinutes: number | null;
  taskType: TaskType;
  externalStatus: ExternalStatus;
  externalStartedAt: string | null;
  externalCompletedAt: string | null;
  externalNote: string | null;
  priority: number | null;
  archived: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface ProjectGraph {
  project: Project;
  branches: Branch[];
  tasks: Task[];
  dependencies: TaskDependency[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  activeCount: number;
  readyCount: number;
  doneCount: number;
  taskCount: number;
}

export interface TaskWithBranch {
  task: Task;
  branchName: string | null;
}

export interface RecommendedTask {
  task: Task;
  branchName: string | null;
  projectId: string | null;
  projectName: string | null;
  score: number;
  blockedCount: number;
}

export interface AppSnapshot {
  projectId: string;
  projectName: string;
  activeTask: TaskWithBranch | null;
  readyTasks: TaskWithBranch[];
  recommendations: RecommendedTask[];
  inboxCount: number;
}

export interface TodayTaskContext {
  task: Task;
  projectId: string;
  projectName: string;
  branchName: string | null;
}

export interface TodayScheduleItem {
  task: Task;
  projectId: string;
  projectName: string;
  branchName: string | null;
  estimatedMinutes: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface TimeBudget {
  remainingMinutes: number;
  availableMinutes: number;
  estimatedFinishTime: string | null;
  completedCount: number;
  remainingCount: number;
}

export interface TodaySnapshot {
  activeTask: TodayTaskContext | null;
  schedule: TodayScheduleItem[];
  completedToday: TodayTaskContext[];
  recommendations: RecommendedTask[];
  timeBudget: TimeBudget;
  dayEndTime: string;
}

export interface DayLane {
  id: string;
  date: string;
  name: string;
  laneType: DayLaneType;
  sortOrder: number;
  createdAt: string;
}

export interface DayLaneSnapshot {
  lane: DayLane;
  tasks: TodayTaskContext[];
  activeTaskId: string | null;
  completedCount: number;
  totalCount: number;
  estimatedFinishTime: string | null;
}

export interface DayRunwaySnapshot {
  date: string;
  lanes: DayLaneSnapshot[];
  backlog: TodayTaskContext[];
  completedToday: TodayTaskContext[];
  recommendations: RecommendedTask[];
  dependencies: TaskDependency[];
  timeBudget: TimeBudget;
  dayEndTime: string;
  carryOverCount: number;
  focusLaneCount: number;
}

export interface CompleteTaskResult {
  completedTask: Task;
  recommendations: RecommendedTask[];
}

export interface BranchSuggestion {
  branchId: string;
  branchName: string;
  confidence: number;
}

export interface CreateTaskResult {
  task: Task;
  branchSuggestion: BranchSuggestion | null;
}

export type MainView = "today" | "project";
