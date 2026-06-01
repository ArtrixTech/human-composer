export type TaskStatus = "inbox" | "pending" | "ready" | "active" | "done";

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
  branchId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  sortOrder: number;
  pinned: boolean;
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
}

export interface TaskWithBranch {
  task: Task;
  branchName: string | null;
}

export interface RecommendedTask {
  task: Task;
  branchName: string | null;
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
