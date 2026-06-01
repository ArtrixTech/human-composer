import { invoke } from "@tauri-apps/api/core";

import type {
  AppSnapshot,
  BranchSuggestion,
  CompleteTaskResult,
  CreateTaskResult,
  ProjectGraph,
  ProjectSummary,
  Task,
} from "../types";

export function listProjects(): Promise<ProjectSummary[]> {
  return invoke("list_projects");
}

export function createProject(name: string): Promise<string> {
  return invoke("create_project", { name });
}

export function setActiveProject(projectId: string): Promise<void> {
  return invoke("set_active_project", { projectId });
}

export function getProjectGraph(projectId: string): Promise<ProjectGraph> {
  return invoke("get_project_graph", { projectId });
}

export function getAppSnapshot(projectId?: string): Promise<AppSnapshot> {
  return invoke("get_app_snapshot", { projectId: projectId ?? null });
}

export function createBranch(projectId: string, name: string): Promise<string> {
  return invoke("create_branch", { projectId, name });
}

export function createTask(
  projectId: string,
  title: string,
  branchId?: string,
): Promise<CreateTaskResult> {
  return invoke("create_task", { projectId, branchId: branchId ?? null, title });
}

export function assignTaskToBranch(taskId: string, branchId: string): Promise<Task> {
  return invoke("assign_task_to_branch", { taskId, branchId });
}

export function addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  return invoke("add_dependency", { taskId, dependsOnTaskId });
}

export function removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  return invoke("remove_dependency", { taskId, dependsOnTaskId });
}

export function updateTask(
  projectId: string,
  taskId: string,
  title?: string,
  description?: string,
): Promise<Task> {
  return invoke("update_task", { projectId, taskId, title, description });
}

export function deleteTask(projectId: string, taskId: string): Promise<void> {
  return invoke("delete_task", { projectId, taskId });
}

export function setTaskStatus(
  projectId: string,
  taskId: string,
  status: string,
): Promise<Task> {
  return invoke("set_task_status", { projectId, taskId, status });
}

export function activateTask(taskId: string, projectId: string): Promise<Task> {
  return invoke("activate_task", { taskId, projectId });
}

export function completeTask(taskId: string, projectId: string): Promise<CompleteTaskResult> {
  return invoke("complete_task", { taskId, projectId });
}

export function pinTask(projectId: string, taskId: string, pinned: boolean): Promise<Task> {
  return invoke("pin_task", { projectId, taskId, pinned });
}

export function archiveBranch(projectId: string, branchId: string): Promise<void> {
  return invoke("archive_branch", { projectId, branchId });
}

export function suggestBranchForTask(
  projectId: string,
  title: string,
): Promise<BranchSuggestion | null> {
  return invoke("suggest_branch_for_task", { projectId, title });
}

export function undoLastAction(projectId: string): Promise<void> {
  return invoke("undo_last_action", { projectId });
}

export function listProjectSources(): Promise<string[]> {
  return invoke("list_project_sources");
}

export function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

export function toggleFloatingExpanded(): Promise<void> {
  return invoke("toggle_floating_expanded");
}
