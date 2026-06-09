import { invoke } from "@tauri-apps/api/core";

import type {
  Action,
  AppSnapshot,
  CompleteActionResult,
  CreateActionResult,
  DayLane,
  DayLaneType,
  DayRunwaySnapshot,
  Outcome,
  LlmConfig,
  OutcomeSuggestion,
  PriorityLevel,
  ProjectGraph,
  ProjectSummary,
  TodaySnapshot,
} from "../types";
import {
  parseAppSnapshot,
  parseCompleteActionResult,
  parseCreateActionResult,
  parseDayRunwaySnapshot,
  parseProjectGraph,
  parseTodaySnapshot,
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

export async function getProjectGraph(projectId: string): Promise<ProjectGraph> {
  const raw = await invoke<Parameters<typeof parseProjectGraph>[0]>("get_project_graph", {
    projectId,
  });
  return parseProjectGraph(raw);
}

export async function getAppSnapshot(projectId?: string): Promise<AppSnapshot> {
  const raw = await invoke<Parameters<typeof parseAppSnapshot>[0]>("get_app_snapshot", {
    projectId: projectId ?? null,
  });
  return parseAppSnapshot(raw);
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const raw = await invoke<Parameters<typeof parseTodaySnapshot>[0]>("get_today_snapshot");
  return parseTodaySnapshot(raw);
}

export async function getDayRunwaySnapshot(): Promise<DayRunwaySnapshot> {
  const raw = await invoke<Parameters<typeof parseDayRunwaySnapshot>[0]>("get_day_runway_snapshot");
  return parseDayRunwaySnapshot(raw);
}

export function autoPopulateRunway(date?: string): Promise<void> {
  return invoke("auto_populate_runway", { date: date ?? null });
}

export function createDayLane(
  name: string,
  laneType: DayLaneType,
  date?: string,
  priorityTier?: PriorityLevel,
): Promise<DayLane> {
  return invoke("create_day_lane", {
    date: date ?? null,
    name,
    laneType,
    priorityTier: priorityTier ?? null,
  });
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

export function assignActionToLane(
  actionId: string,
  laneId: string,
  position?: number,
): Promise<void> {
  return invoke("assign_task_to_lane", { taskId: actionId, laneId, position: position ?? null });
}
/** @deprecated Use assignActionToLane */
export const assignTaskToLane = assignActionToLane;

export function removeActionFromLane(actionId: string, laneId: string): Promise<void> {
  return invoke("remove_task_from_lane", { taskId: actionId, laneId });
}
/** @deprecated Use removeActionFromLane */
export const removeTaskFromLane = removeActionFromLane;

export function reorderLaneActions(laneId: string, actionIds: string[]): Promise<void> {
  return invoke("reorder_lane_tasks", { laneId, taskIds: actionIds });
}
/** @deprecated Use reorderLaneActions */
export const reorderLaneTasks = reorderLaneActions;

export function moveActionBetweenLanes(
  actionId: string,
  fromLaneId: string,
  toLaneId: string,
  position?: number,
): Promise<void> {
  return invoke("move_task_between_lanes", {
    taskId: actionId,
    fromLaneId,
    toLaneId,
    position: position ?? null,
  });
}
/** @deprecated Use moveActionBetweenLanes */
export const moveTaskBetweenLanes = moveActionBetweenLanes;

export function claimAction(actionId: string, laneId: string, projectId: string): Promise<Action> {
  return invoke("claim_task", { taskId: actionId, laneId, projectId });
}
/** @deprecated Use claimAction */
export const claimTask = claimAction;

export function postponeAction(
  actionId: string,
  laneId: string,
  projectId: string,
): Promise<Action> {
  return invoke("postpone_task", { taskId: actionId, laneId, projectId });
}
/** @deprecated Use postponeAction */
export const postponeTask = postponeAction;

export function startExternalAction(
  actionId: string,
  projectId: string,
  estimatedMinutes: number,
  note?: string,
  laneId?: string,
): Promise<Action> {
  return invoke("start_external_task", {
    taskId: actionId,
    projectId,
    laneId: laneId ?? null,
    estimatedMinutes,
    note: note ?? null,
  });
}
/** @deprecated Use startExternalAction */
export const startExternalTask = startExternalAction;

export function completeExternalAction(actionId: string, projectId: string): Promise<Action> {
  return invoke("complete_external_task", { taskId: actionId, projectId });
}
/** @deprecated Use completeExternalAction */
export const completeExternalTask = completeExternalAction;

export function reviewExternalAction(
  actionId: string,
  projectId: string,
  action: "done" | "rework",
): Promise<Action> {
  return invoke("review_external_task", { taskId: actionId, projectId, action });
}
/** @deprecated Use reviewExternalAction */
export const reviewExternalTask = reviewExternalAction;

export function createOutcome(projectId: string, name: string): Promise<string> {
  return invoke("create_branch", { projectId, name });
}
/** @deprecated Use createOutcome */
export const createBranch = createOutcome;

export function renameOutcome(
  projectId: string,
  outcomeId: string,
  name: string,
): Promise<Outcome> {
  return invoke("rename_branch", { projectId, branchId: outcomeId, name });
}
/** @deprecated Use renameOutcome */
export const renameBranch = renameOutcome;

export function unarchiveOutcome(projectId: string, outcomeId: string): Promise<Outcome> {
  return invoke("unarchive_branch", { projectId, branchId: outcomeId });
}
/** @deprecated Use unarchiveOutcome */
export const unarchiveBranch = unarchiveOutcome;

export function listArchivedOutcomes(projectId: string): Promise<Outcome[]> {
  return invoke("list_archived_branches", { projectId });
}
/** @deprecated Use listArchivedOutcomes */
export const listArchivedBranches = listArchivedOutcomes;

export async function createAction(
  projectId: string,
  title: string,
  outcomeId?: string,
): Promise<CreateActionResult> {
  const raw = await invoke<Parameters<typeof parseCreateActionResult>[0]>("create_task", {
    projectId,
    branchId: outcomeId ?? null,
    title,
  });
  return parseCreateActionResult(raw);
}
/** @deprecated Use createAction */
export const createTask = createAction;

export function assignActionToOutcome(actionId: string, outcomeId: string): Promise<Action> {
  return invoke("assign_task_to_branch", { taskId: actionId, branchId: outcomeId });
}
/** @deprecated Use assignActionToOutcome */
export const assignTaskToBranch = assignActionToOutcome;

export function addDependency(actionId: string, dependsOnActionId: string): Promise<void> {
  return invoke("add_dependency", { taskId: actionId, dependsOnTaskId: dependsOnActionId });
}

export function removeDependency(actionId: string, dependsOnActionId: string): Promise<void> {
  return invoke("remove_dependency", { taskId: actionId, dependsOnTaskId: dependsOnActionId });
}

export function updateAction(
  projectId: string,
  actionId: string,
  title?: string,
  description?: string,
): Promise<Action> {
  return invoke("update_task", { projectId, taskId: actionId, title, description });
}
/** @deprecated Use updateAction */
export const updateTask = updateAction;

export function setActionEstimatedMinutes(
  projectId: string,
  actionId: string,
  minutes: number,
): Promise<Action> {
  return invoke("set_task_estimated_minutes", { projectId, taskId: actionId, minutes });
}
/** @deprecated Use setActionEstimatedMinutes */
export const setTaskEstimatedMinutes = setActionEstimatedMinutes;

export function deleteAction(projectId: string, actionId: string): Promise<void> {
  return invoke("delete_task", { projectId, taskId: actionId });
}
/** @deprecated Use deleteAction */
export const deleteTask = deleteAction;

export function setActionStatus(
  projectId: string,
  actionId: string,
  status: string,
): Promise<Action> {
  return invoke("set_task_status", { projectId, taskId: actionId, status });
}
/** @deprecated Use setActionStatus */
export const setTaskStatus = setActionStatus;

export function activateAction(actionId: string, projectId: string): Promise<Action> {
  return invoke("activate_task", { taskId: actionId, projectId });
}
/** @deprecated Use activateAction */
export const activateTask = activateAction;

export async function completeAction(
  actionId: string,
  projectId: string,
): Promise<CompleteActionResult> {
  const raw = await invoke<Parameters<typeof parseCompleteActionResult>[0]>("complete_task", {
    taskId: actionId,
    projectId,
  });
  return parseCompleteActionResult(raw);
}
/** @deprecated Use completeAction */
export const completeTask = completeAction;

export function pinAction(projectId: string, actionId: string, pinned: boolean): Promise<Action> {
  return invoke("pin_task", { projectId, taskId: actionId, pinned });
}
/** @deprecated Use pinAction */
export const pinTask = pinAction;

export function archiveOutcome(projectId: string, outcomeId: string): Promise<void> {
  return invoke("archive_branch", { projectId, branchId: outcomeId });
}
/** @deprecated Use archiveOutcome */
export const archiveBranch = archiveOutcome;

export function deleteOutcome(projectId: string, outcomeId: string): Promise<void> {
  return invoke("delete_branch", { projectId, branchId: outcomeId });
}
/** @deprecated Use deleteOutcome */
export const deleteBranch = deleteOutcome;

export function reorderOutcomes(projectId: string, outcomeIds: string[]): Promise<void> {
  return invoke("reorder_branches", { projectId, branchIds: outcomeIds });
}
/** @deprecated Use reorderOutcomes */
export const reorderBranches = reorderOutcomes;

export function setActionPriority(
  projectId: string,
  actionId: string,
  priority: import("../types").PriorityLevel,
): Promise<Action> {
  return invoke("set_task_priority", { projectId, taskId: actionId, priority });
}
/** @deprecated Use setActionPriority */
export const setTaskPriority = setActionPriority;

export function archiveAction(projectId: string, actionId: string): Promise<Action> {
  return invoke("archive_task", { projectId, taskId: actionId });
}
/** @deprecated Use archiveAction */
export const archiveTask = archiveAction;

export function unarchiveAction(projectId: string, actionId: string): Promise<Action> {
  return invoke("unarchive_task", { projectId, taskId: actionId });
}
/** @deprecated Use unarchiveAction */
export const unarchiveTask = unarchiveAction;

export function listArchivedActions(projectId: string): Promise<Action[]> {
  return invoke("list_archived_tasks", { projectId });
}
/** @deprecated Use listArchivedActions */
export const listArchivedTasks = listArchivedActions;

export function reorderOutcomeActions(
  projectId: string,
  outcomeId: string,
  actionIds: string[],
): Promise<void> {
  return invoke("reorder_branch_tasks", { projectId, branchId: outcomeId, taskIds: actionIds });
}
/** @deprecated Use reorderOutcomeActions */
export const reorderBranchTasks = reorderOutcomeActions;

export function reorderAction(
  projectId: string,
  actionId: string,
  direction: "up" | "down",
): Promise<Action> {
  return invoke("reorder_task", { projectId, taskId: actionId, direction });
}
/** @deprecated Use reorderAction */
export const reorderTask = reorderAction;

export function suggestOutcomeForAction(
  projectId: string,
  title: string,
): Promise<OutcomeSuggestion | null> {
  return invoke("suggest_branch_for_task", { projectId, title });
}
/** @deprecated Use suggestOutcomeForAction */
export const suggestBranchForTask = suggestOutcomeForAction;

export function undoLastAction(projectId: string): Promise<void> {
  return invoke("undo_last_action", { projectId });
}

export function listProjectSources(): Promise<string[]> {
  return invoke("list_project_sources");
}

export function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

export function showFloatingNotice(message: string): Promise<void> {
  return invoke("show_floating_notice", { message });
}

export function toggleFloatingExpanded(): Promise<void> {
  return invoke("toggle_floating_expanded");
}

export function focusFloatingForQuickAdd(): Promise<void> {
  return invoke("focus_floating_for_quick_add");
}

export function getLlmConfig(): Promise<LlmConfig> {
  return invoke("get_llm_config_cmd");
}

export function setLlmConfig(config: LlmConfig): Promise<void> {
  return invoke("set_llm_config_cmd", { config });
}

export function testLlmConnection(config: LlmConfig): Promise<string> {
  return invoke("test_llm_connection_cmd", { config });
}
