import { create } from "zustand";

import * as api from "../api/tauri";
import type {
  AppSnapshot,
  MainView,
  ProjectGraph,
  ProjectSummary,
  RecommendedTask,
  Task,
  TodaySnapshot,
} from "../types";
import { useToastStore } from "./toastStore";

interface AppStore {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  currentView: MainView;
  graph: ProjectGraph | null;
  snapshot: AppSnapshot | null;
  todaySnapshot: TodaySnapshot | null;
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
  previousActiveTitle: string | null;

  initialize: () => Promise<void>;
  selectTodayView: () => Promise<void>;
  selectProjectView: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshToday: () => Promise<void>;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
  applyTodaySnapshot: (snapshot: TodaySnapshot) => void;
  toggleSidebar: () => void;
  toggleInbox: () => void;
  toggleHideDone: () => void;
  selectTask: (taskId: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  dismissRecommend: () => void;

  addInboxTask: (title: string) => Promise<void>;
  addBranchTask: (branchId: string, title: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  renameBranch: (branchId: string, name: string) => Promise<void>;
  assignInboxTask: (taskId: string, branchId: string) => Promise<void>;
  completeTask: (taskId: string, projectId?: string) => Promise<void>;
  activateTask: (taskId: string, projectId: string) => Promise<void>;
  pauseTask: (taskId: string, projectId: string) => Promise<void>;
  deleteTask: (taskId: string, projectId: string) => Promise<void>;
  reorderTask: (taskId: string, direction: "up" | "down") => Promise<void>;
  undo: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  currentView: "today",
  graph: null,
  snapshot: null,
  todaySnapshot: null,
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
  previousActiveTitle: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [projects, todaySnapshot] = await Promise.all([
        api.listProjects(),
        api.getTodaySnapshot(),
      ]);
      const activeProjectId = projects[0]?.id ?? null;
      set({ projects, activeProjectId, todaySnapshot, currentView: "today" });
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
    await get().refreshToday();
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
    const [projects, todaySnapshot] = await Promise.all([
      api.listProjects(),
      api.getTodaySnapshot(),
    ]);
    set({ projects, activeProjectId: id, todaySnapshot });
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
    const todaySnapshot = await api.getTodaySnapshot();
    const nextId = projects[0]?.id ?? null;
    set({ projects, activeProjectId: nextId, todaySnapshot, currentView: "today" });
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
    const [todaySnapshot, projects] = await Promise.all([
      api.getTodaySnapshot(),
      api.listProjects(),
    ]);
    set({ todaySnapshot, projects });
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

  refreshToday: async () => {
    const todaySnapshot = await api.getTodaySnapshot();
    set({ todaySnapshot });
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

  applyTodaySnapshot: (snapshot) => {
    set({ todaySnapshot: snapshot });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleInbox: () => set((s) => ({ inboxOpen: !s.inboxOpen })),
  toggleHideDone: () => set((s) => ({ hideDoneTasks: !s.hideDoneTasks })),
  selectTask: (taskId) => set({ selectedTaskId: taskId, detailOpen: taskId !== null }),
  setDetailOpen: (open) => set({ detailOpen: open, selectedTaskId: open ? get().selectedTaskId : null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  dismissRecommend: () => set({ recommendPrompt: null }),

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

  assignInboxTask: async (taskId, branchId) => {
    await api.assignTaskToBranch(taskId, branchId);
    await get().refreshAll();
    useToastStore.getState().push({ message: "已分配到支线" });
  },

  completeTask: async (taskId, projectId) => {
    const pid = projectId ?? get().activeProjectId;
    if (!pid) {
      const task = get().todaySnapshot?.activeTask;
      if (!task) return;
      const result = await api.completeTask(taskId, task.projectId);
      await get().refreshAll();
      useToastStore.getState().push({
        message: `已完成「${result.completedTask.title}」`,
        undo: () => get().undo(),
      });
      if (get().currentView === "project" && result.recommendations.length > 0) {
        set({ recommendPrompt: result.recommendations });
      }
      return;
    }
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

  activateTask: async (taskId, projectId) => {
    const previousTitle =
      get().todaySnapshot?.activeTask?.task.title ??
      get().snapshot?.activeTask?.task.title ??
      null;
    await api.activateTask(taskId, projectId);
    await get().refreshAll();
    set({ recommendPrompt: null });
    const newActive = get().todaySnapshot?.activeTask?.task.title;
    if (previousTitle && newActive && previousTitle !== newActive) {
      useToastStore.getState().push({
        message: `已切换到「${newActive}」，「${previousTitle}」已暂停`,
      });
    }
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
