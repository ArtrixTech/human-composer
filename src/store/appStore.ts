import { create } from "zustand";

import * as api from "../api/tauri";
import type {
  AppSnapshot,
  ProjectGraph,
  ProjectSummary,
  RecommendedTask,
  Task,
} from "../types";
import { useToastStore } from "./toastStore";

interface AppStore {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  graph: ProjectGraph | null;
  snapshot: AppSnapshot | null;
  loading: boolean;
  error: string | null;
  sidebarCollapsed: boolean;
  inboxOpen: boolean;
  selectedTaskId: string | null;
  detailOpen: boolean;
  commandOpen: boolean;
  recommendPrompt: RecommendedTask[] | null;
  topRecommendationId: string | null;

  initialize: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
  toggleSidebar: () => void;
  toggleInbox: () => void;
  selectTask: (taskId: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  dismissRecommend: () => void;

  addInboxTask: (title: string) => Promise<void>;
  addBranchTask: (branchId: string, title: string) => Promise<void>;
  assignInboxTask: (taskId: string, branchId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  activateTask: (taskId: string) => Promise<void>;
  undo: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  graph: null,
  snapshot: null,
  loading: true,
  error: null,
  sidebarCollapsed: false,
  inboxOpen: true,
  selectedTaskId: null,
  detailOpen: false,
  commandOpen: false,
  recommendPrompt: null,
  topRecommendationId: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.listProjects();
      const activeProjectId = projects[0]?.id ?? null;
      set({ projects, activeProjectId });
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

  selectProject: async (projectId) => {
    set({ activeProjectId: projectId, loading: true, error: null });
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

  createProject: async (name) => {
    const id = await api.createProject(name);
    const projects = await api.listProjects();
    set({ projects, activeProjectId: id });
    const [graph, snapshot] = await Promise.all([
      api.getProjectGraph(id),
      api.getAppSnapshot(id),
    ]);
    set({ graph, snapshot, topRecommendationId: snapshot.recommendations[0]?.task.id ?? null });
  },

  refreshAll: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const [graph, snapshot, projects] = await Promise.all([
      api.getProjectGraph(activeProjectId),
      api.getAppSnapshot(activeProjectId),
      api.listProjects(),
    ]);
    set({
      graph,
      snapshot,
      projects,
      topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
    });
  },

  applySnapshot: async (snapshot) => {
    const { loading, activeProjectId } = get();
    if (loading && activeProjectId === snapshot.projectId) {
      set({
        snapshot,
        topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
      });
      return;
    }
    const graph = await api.getProjectGraph(snapshot.projectId);
    set({
      snapshot,
      graph,
      activeProjectId: snapshot.projectId,
      topRecommendationId: snapshot.recommendations[0]?.task.id ?? null,
    });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleInbox: () => set((s) => ({ inboxOpen: !s.inboxOpen })),
  selectTask: (taskId) => set({ selectedTaskId: taskId, detailOpen: taskId !== null }),
  setDetailOpen: (open) => set({ detailOpen: open, selectedTaskId: open ? get().selectedTaskId : null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  dismissRecommend: () => set({ recommendPrompt: null }),

  addInboxTask: async (title) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const result = await api.createTask(activeProjectId, title);
    await get().refreshAll();
    useToastStore.getState().push({
      message: `已添加「${result.task.title}」到 Inbox`,
      undo: () => api.deleteTask(activeProjectId, result.task.id).then(() => get().refreshAll()),
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

  assignInboxTask: async (taskId, branchId) => {
    await api.assignTaskToBranch(taskId, branchId);
    await get().refreshAll();
  },

  completeTask: async (taskId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const result = await api.completeTask(taskId, activeProjectId);
    await get().refreshAll();
    useToastStore.getState().push({
      message: `已完成「${result.completedTask.title}」`,
      undo: () => get().undo(),
    });
    if (result.recommendations.length > 0) {
      set({ recommendPrompt: result.recommendations });
    }
  },

  activateTask: async (taskId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    await api.activateTask(taskId, activeProjectId);
    await get().refreshAll();
    set({ recommendPrompt: null });
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
