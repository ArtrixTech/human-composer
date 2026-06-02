import { invoke } from "@tauri-apps/api/core";

import type {
  AppSnapshot,
  Branch,
  BranchSuggestion,
  CompleteTaskResult,
  CreateTaskResult,
  DayLane,
  DayLaneType,
  DayRunwaySnapshot,
  ProjectGraph,
  ProjectSummary,
  Task,
  TodaySnapshot,
} from "../types";

export function listProjects(): Promise<ProjectSummary[]> {
  return invoke("list_projects");
}

export function createProject(name: string): Promise<string> {
  return invoke("create_project", { name });
}

export function deleteProject(projectId: string): Promise<void> {
  return invoke("delete_project", { projectId });
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

export function getTodaySnapshot(): Promise<TodaySnapshot> {
  return invoke("get_today_snapshot");
}

export function getDayRunwaySnapshot(): Promise<DayRunwaySnapshot> {
  return invoke("get_day_runway_snapshot");
}

export function autoPopulateRunway(date?: string): Promise<void> {
  return invoke("auto_populate_runway", { date: date ?? null });
}

export function createDayLane(
  name: string,
  laneType: DayLaneType,
  date?: string,
): Promise<DayLane> {
  return invoke("create_day_lane", { date: date ?? null, name, laneType });
}

export function closeDayLane(laneId: string): Promise<void> {
  return invoke("close_day_lane", { laneId });
}

export function renameDayLane(laneId: string, name: string): Promise<DayLane> {
  return invoke("rename_day_lane", { laneId, name });
}

export function reorderDayLanes(laneIds: string[], date?: string): Promise<void> {
  return invoke("reorder_day_lanes", { date: date ?? null, laneIds });
}

export function assignTaskToLane(
  taskId: string,
  laneId: string,
  position?: number,
): Promise<void> {
  return invoke("assign_task_to_lane", { taskId, laneId, position: position ?? null });
}

export function removeTaskFromLane(taskId: string, laneId: string): Promise<void> {
  return invoke("remove_task_from_lane", { taskId, laneId });
}

export function reorderLaneTasks(laneId: string, taskIds: string[]): Promise<void> {
  return invoke("reorder_lane_tasks", { laneId, taskIds });
}

export function moveTaskBetweenLanes(
  taskId: string,
  fromLaneId: string,
  toLaneId: string,
  position?: number,
): Promise<void> {
  return invoke("move_task_between_lanes", {
    taskId,
    fromLaneId,
    toLaneId,
    position: position ?? null,
  });
}

export function claimTask(taskId: string, laneId: string, projectId: string): Promise<Task> {
  return invoke("claim_task", { taskId, laneId, projectId });
}

export function startExternalTask(
  taskId: string,
  projectId: string,
  estimatedMinutes: number,
  note?: string,
  laneId?: string,
): Promise<Task> {
  return invoke("start_external_task", {
    taskId,
    projectId,
    laneId: laneId ?? null,
    estimatedMinutes,
    note: note ?? null,
  });
}

export function completeExternalTask(taskId: string, projectId: string): Promise<Task> {
  return invoke("complete_external_task", { taskId, projectId });
}

export function reviewExternalTask(
  taskId: string,
  projectId: string,
  action: "done" | "rework",
): Promise<Task> {
  return invoke("review_external_task", { taskId, projectId, action });
}

export function createBranch(projectId: string, name: string): Promise<string> {
  return invoke("create_branch", { projectId, name });
}

export function renameBranch(projectId: string, branchId: string, name: string): Promise<Branch> {
  return invoke("rename_branch", { projectId, branchId, name });
}

export function unarchiveBranch(projectId: string, branchId: string): Promise<Branch> {
  return invoke("unarchive_branch", { projectId, branchId });
}

export function listArchivedBranches(projectId: string): Promise<Branch[]> {
  return invoke("list_archived_branches", { projectId });
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

export function setTaskEstimatedMinutes(
  projectId: string,
  taskId: string,
  minutes: number,
): Promise<Task> {
  return invoke("set_task_estimated_minutes", { projectId, taskId, minutes });
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

export function reorderTask(
  projectId: string,
  taskId: string,
  direction: "up" | "down",
): Promise<Task> {
  return invoke("reorder_task", { projectId, taskId, direction });
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

export function focusFloatingForQuickAdd(): Promise<void> {
  return invoke("focus_floating_for_quick_add");
}
