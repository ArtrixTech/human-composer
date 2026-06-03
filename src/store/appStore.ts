import { create } from "zustand";

import * as api from "../api/tauri";
import type {
  AppSnapshot,
  DayLaneType,
  DayRunwaySnapshot,
  MainView,
  ProjectGraph,
  ProjectSummary,
  RecommendedTask,
  Task,
  TodayTaskContext,
} from "../types";
import { useToastStore } from "./toastStore";

interface AppStore {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  currentView: MainView;
  graph: ProjectGraph | null;
  snapshot: AppSnapshot | null;
  runwaySnapshot: DayRunwaySnapshot | null;
  loading: boolean;
  error: string | null;
  sidebarCollapsed: boolean;
  inboxOpen: boolean;
  hideDoneTasks: boolean;
  selectedTaskId: string | null;
  detailOpen: boolean;
  commandOpen: boolean;
  recommendPrompt: RecommendedTask[] | null;
  topRecommendationId: string | null;
  addLaneOpen: boolean;

  initialize: () => Promise<void>;
  selectTodayView: () => Promise<void>;
  selectProjectView: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshRunway: () => Promise<void>;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
  applyRunwaySnapshot: (snapshot: DayRunwaySnapshot) => void;
  toggleSidebar: () => void;
  toggleInbox: () => void;
  toggleHideDone: () => void;
  selectTask: (taskId: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setAddLaneOpen: (open: boolean) => void;
  dismissRecommend: () => void;

  createLane: (name: string, laneType: DayLaneType) => Promise<void>;
  closeLane: (laneId: string) => Promise<void>;
  renameLane: (laneId: string, name: string) => Promise<void>;
  assignToLane: (taskId: string, laneId: string, position?: number) => Promise<void>;
  removeFromLane: (taskId: string, laneId: string) => Promise<void>;
  reorderLaneTasks: (laneId: string, taskIds: string[]) => Promise<void>;
  moveBetweenLanes: (
    taskId: string,
    fromLaneId: string,
    toLaneId: string,
    position?: number,
  ) => Promise<void>;
  claimTask: (taskId: string, laneId: string, projectId: string) => Promise<void>;
  startExternal: (
    taskId: string,
    projectId: string,
    laneId: string | undefined,
    minutes: number,
    note?: string,
  ) => Promise<void>;
  completeExternal: (taskId: string, projectId: string) => Promise<void>;
  reviewExternal: (taskId: string, projectId: string, action: "done" | "rework") => Promise<void>;

  addInboxTask: (title: string) => Promise<void>;
  addBranchTask: (branchId: string, title: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  renameBranch: (branchId: string, name: string) => Promise<void>;
  archiveBranch: (branchId: string) => Promise<void>;
  deleteBranch: (branchId: string) => Promise<void>;
  reorderBranches: (branchIds: string[]) => Promise<void>;
  setTaskPriority: (taskId: string, priority: number | null) => Promise<void>;
  archiveTask: (taskId: string, projectId?: string) => Promise<void>;
  unarchiveTask: (taskId: string, projectId?: string) => Promise<void>;
  reorderBranchTasks: (branchId: string, taskIds: string[]) => Promise<void>;
  assignInboxTask: (taskId: string, branchId: string) => Promise<void>;
  completeTask: (taskId: string, projectId?: string, laneId?: string) => Promise<void>;
  activateTask: (taskId: string, projectId: string, laneId?: string) => Promise<void>;
  pauseTask: (taskId: string, projectId: string) => Promise<void>;
  deleteTask: (taskId: string, projectId: string) => Promise<void>;
  reorderTask: (taskId: string, direction: "up" | "down") => Promise<void>;
  undo: () => Promise<void>;
}

function firstActiveTask(snapshot: DayRunwaySnapshot | null): TodayTaskContext | null {
  if (!snapshot) return null;
  for (const lane of snapshot.lanes) {
    const active = lane.tasks.find((t) => t.task.status === "active");
    if (active) return active;
  }
  return null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  currentView: "today",
  graph: null,
  snapshot: null,
  runwaySnapshot: null,
  loading: true,
  error: null,
  sidebarCollapsed: false,
  inboxOpen: true,
  hideDoneTasks: true,
  selectedTaskId: null,
  detailOpen: false,
  commandOpen: false,
  recommendPrompt: null,
  topRecommendationId: null,
  addLaneOpen: false,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [projects, runwaySnapshot] = await Promise.all([
        api.listProjects(),
        api.getDayRunwaySnapshot(),
      ]);
      const activeProjectId = projects[0]?.id ?? null;
      set({ projects, activeProjectId, runwaySnapshot, currentView: "today" });
      if (activeProjectId) {
        const [graph, snapshot] = await Promise.all([
          api.getProjectGraph(activeProjectId),
          api.getAppSnapshot(activeProjectId),
        ]);
        set({
          graph,
          snapshot,
          topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectTodayView: async () => {
    set({ currentView: "today", selectedTaskId: null, detailOpen: false });
    await get().refreshRunway();
  },

  selectProjectView: async (projectId) => {
    set({
      currentView: "project",
      activeProjectId: projectId,
      loading: true,
      error: null,
    });
    try {
      await api.setActiveProject(projectId);
      const [graph, snapshot] = await Promise.all([
        api.getProjectGraph(projectId),
        api.getAppSnapshot(projectId),
      ]);
      set({
        graph,
        snapshot,
        topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
        selectedTaskId: null,
        detailOpen: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectProject: async (projectId) => get().selectProjectView(projectId),

  createProject: async (name) => {
    const id = await api.createProject(name);
    const [projects, runwaySnapshot] = await Promise.all([
      api.listProjects(),
      api.getDayRunwaySnapshot(),
    ]);
    set({ projects, activeProjectId: id, runwaySnapshot });
    const [graph, snapshot] = await Promise.all([
      api.getProjectGraph(id),
      api.getAppSnapshot(id),
    ]);
    set({
      graph,
      snapshot,
      topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
      currentView: "project",
    });
  },

  deleteProject: async (projectId) => {
    await api.deleteProject(projectId);
    const projects = await api.listProjects();
    const runwaySnapshot = await api.getDayRunwaySnapshot();
    const nextId = projects[0]?.id ?? null;
    set({ projects, activeProjectId: nextId, runwaySnapshot, currentView: "today" });
    if (nextId) {
      const [graph, snapshot] = await Promise.all([
        api.getProjectGraph(nextId),
        api.getAppSnapshot(nextId),
      ]);
      set({ graph, snapshot });
    } else {
      set({ graph: null, snapshot: null });
    }
  },

  refreshAll: async () => {
    const { activeProjectId } = get();
    const [runwaySnapshot, projects] = await Promise.all([
      api.getDayRunwaySnapshot(),
      api.listProjects(),
    ]);
    set({ runwaySnapshot, projects });
    if (activeProjectId) {
      const [graph, snapshot] = await Promise.all([
        api.getProjectGraph(activeProjectId),
        api.getAppSnapshot(activeProjectId),
      ]);
      set({
        graph,
        snapshot,
        topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
      });
    }
  },

  refreshRunway: async () => {
    const runwaySnapshot = await api.getDayRunwaySnapshot();
    set({ runwaySnapshot });
  },

  applySnapshot: async (snapshot) => {
    const { loading, activeProjectId, currentView } = get();
    if (loading && activeProjectId === snapshot.projectId) {
      set({
        snapshot,
        topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
      });
      return;
    }
    if (currentView === "project") {
      const graph = await api.getProjectGraph(snapshot.projectId);
      set({
        snapshot,
        graph,
        activeProjectId: snapshot.projectId,
        topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
      });
    } else {
      set({ snapshot });
    }
  },

  applyRunwaySnapshot: (snapshot) => {
    set({ runwaySnapshot: snapshot });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleInbox: () => set((s) => ({ inboxOpen: !s.inboxOpen })),
  toggleHideDone: () => set((s) => ({ hideDoneTasks: !s.hideDoneTasks })),
  selectTask: (taskId) => set({ selectedTaskId: taskId, detailOpen: taskId !== null }),
  setDetailOpen: (open) =>
    set({ detailOpen: open, selectedTaskId: open ? get().selectedTaskId : null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setAddLaneOpen: (open) => set({ addLaneOpen: open }),
  dismissRecommend: () => set({ recommendPrompt: null }),

  createLane: async (name, laneType) => {
    await api.createDayLane(name, laneType);
    await get().refreshRunway();
    useToastStore.getState().push({ message: `已创建泳道「${name}」` });
  },

  closeLane: async (laneId) => {
    await api.closeDayLane(laneId);
    await get().refreshRunway();
    useToastStore.getState().push({ message: "泳道已关闭，任务已合并到其他泳道" });
  },

  renameLane: async (laneId, name) => {
    await api.renameDayLane(laneId, name);
    await get().refreshRunway();
  },

  assignToLane: async (taskId, laneId, position) => {
    await api.assignTaskToLane(taskId, laneId, position);
    await get().refreshRunway();
  },

  removeFromLane: async (taskId, laneId) => {
    await api.removeTaskFromLane(taskId, laneId);
    await get().refreshRunway();
  },

  reorderLaneTasks: async (laneId, taskIds) => {
    await api.reorderLaneTasks(laneId, taskIds);
    await get().refreshRunway();
  },

  moveBetweenLanes: async (taskId, fromLaneId, toLaneId, position) => {
    await api.moveTaskBetweenLanes(taskId, fromLaneId, toLaneId, position);
    await get().refreshRunway();
  },

  claimTask: async (taskId, laneId, projectId) => {
    const previous = firstActiveTask(get().runwaySnapshot);
    await api.claimTask(taskId, laneId, projectId);
    await get().refreshAll();
    set({ recommendPrompt: null });
    const newActive = firstActiveTask(get().runwaySnapshot);
    if (previous && newActive && previous.task.id !== newActive.task.id) {
      useToastStore.getState().push({
        message: `已切换到「${newActive.task.title}」`,
      });
    }
  },

  startExternal: async (taskId, projectId, laneId, minutes, note) => {
    await api.startExternalTask(taskId, projectId, minutes, note, laneId);
    await get().refreshAll();
    // Check if there is a claimable task in a focus lane to surface to the user
    const snapshot = get().runwaySnapshot;
    const hasClaimable = snapshot?.lanes.some(
      (l) => l.lane.laneType === "focus" && l.tasks.some((t) => t.task.status === "ready"),
    );
    useToastStore.getState().push({
      message: hasClaimable
        ? "已委派至等待泳道 · 可继续领取下一项专注任务"
        : "已委派至等待泳道",
    });
  },

  completeExternal: async (taskId, projectId) => {
    await api.completeExternalTask(taskId, projectId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "外部任务已完成，等待审核" });
  },

  reviewExternal: async (taskId, projectId, action) => {
    await api.reviewExternalTask(taskId, projectId, action);
    await get().refreshAll();
    useToastStore.getState().push({
      message: action === "done" ? "审核完成" : "已退回重做",
    });
  },

  addInboxTask: async (title) => {
    const { activeProjectId } = get();
    const projectId = activeProjectId ?? get().projects[0]?.id;
    if (!projectId) return;
    const result = await api.createTask(projectId, title);
    await get().refreshAll();
    useToastStore.getState().push({
      message: `已添加「${result.task.title}」到 Inbox`,
      undo: () => api.deleteTask(projectId, result.task.id).then(() => get().refreshAll()),
    });
    if (result.branchSuggestion) {
      useToastStore.getState().push({
        message: `建议分配到「${result.branchSuggestion.branchName}」`,
        actionLabel: "确认",
        onAction: () =>
          api
            .assignTaskToBranch(result.task.id, result.branchSuggestion!.branchId)
            .then(() => get().refreshAll()),
      });
    }
  },

  addBranchTask: async (branchId, title) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const result = await api.createTask(activeProjectId, title, branchId);
    await get().refreshAll();
    useToastStore.getState().push({
      message: `已创建「${result.task.title}」`,
      undo: () => api.deleteTask(activeProjectId, result.task.id).then(() => get().refreshAll()),
    });
  },

  createBranch: async (name) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.createBranch(activeProjectId, name);
    await get().refreshAll();
    useToastStore.getState().push({ message: `已创建支线「${name}」` });
  },

  renameBranch: async (branchId, name) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.renameBranch(activeProjectId, branchId, name);
    await get().refreshAll();
  },

  archiveBranch: async (branchId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.archiveBranch(activeProjectId, branchId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "支线已归档" });
  },

  deleteBranch: async (branchId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.deleteBranch(activeProjectId, branchId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "支线已删除" });
  },

  reorderBranches: async (branchIds) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.reorderBranches(activeProjectId, branchIds);
    await get().refreshAll();
  },

  setTaskPriority: async (taskId, priority) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.setTaskPriority(activeProjectId, taskId, priority);
    await get().refreshAll();
  },

  archiveTask: async (taskId, projectId) => {
    const pid =
      projectId ?? get().activeProjectId ?? get().graph?.tasks.find((t) => t.id === taskId)?.projectId;
    if (!pid) return;
    const title = get().graph?.tasks.find((t) => t.id === taskId)?.title ?? "任务";
    await api.archiveTask(pid, taskId);
    await get().refreshAll();
    if (get().selectedTaskId === taskId) {
      set({ detailOpen: false, selectedTaskId: null });
    }
    useToastStore.getState().push({
      message: `已归档「${title}」`,
      undo: () => get().unarchiveTask(taskId, pid),
    });
  },

  unarchiveTask: async (taskId, projectId) => {
    const pid = projectId ?? get().activeProjectId;
    if (!pid) return;
    await api.unarchiveTask(pid, taskId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "已恢复任务" });
  },

  reorderBranchTasks: async (branchId, taskIds) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.reorderBranchTasks(activeProjectId, branchId, taskIds);
    await get().refreshAll();
  },

  assignInboxTask: async (taskId, branchId) => {
    await api.assignTaskToBranch(taskId, branchId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "已分配到支线" });
  },

  completeTask: async (taskId, projectId, _laneId) => {
    const pid =
      projectId ??
      get().runwaySnapshot?.lanes
        .flatMap((l) => l.tasks)
        .find((t) => t.task.id === taskId)?.projectId;
    if (!pid) return;
    const result = await api.completeTask(taskId, pid);
    await get().refreshAll();
    useToastStore.getState().push({
      message: `已完成「${result.completedTask.title}」`,
      undo: () => get().undo(),
    });
    if (get().currentView === "project" && result.recommendations.length > 0) {
      set({ recommendPrompt: result.recommendations });
    }
  },

  activateTask: async (taskId, projectId, laneId) => {
    if (laneId) {
      await get().claimTask(taskId, laneId, projectId);
      return;
    }
    await api.activateTask(taskId, projectId);
    await get().refreshAll();
    set({ recommendPrompt: null });
  },

  pauseTask: async (taskId, projectId) => {
    await api.setTaskStatus(projectId, taskId, "ready");
    await get().refreshAll();
  },

  deleteTask: async (taskId, projectId) => {
    const title = get().graph?.tasks.find((t) => t.id === taskId)?.title ?? "任务";
    await api.deleteTask(projectId, taskId);
    await get().refreshAll();
    set({ detailOpen: false, selectedTaskId: null });
    useToastStore.getState().push({ message: `已删除「${title}」` });
  },

  reorderTask: async (taskId, direction) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.reorderTask(activeProjectId, taskId, direction);
    await get().refreshAll();
  },

  undo: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.undoLastAction(activeProjectId);
    await get().refreshAll();
  },
}));

export function getSelectedTask(): Task | null {
  const { graph, selectedTaskId } = useAppStore.getState();
  if (!graph || !selectedTaskId) return null;
  return graph.tasks.find((t) => t.id === selectedTaskId) ?? null;
}

export function getFirstActiveTask(): TodayTaskContext | null {
  return firstActiveTask(useAppStore.getState().runwaySnapshot);
}
