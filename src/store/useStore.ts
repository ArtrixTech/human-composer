import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Branch, Project, Task, TaskStatus } from '../types';

interface AppStore {
  projects: Project[];
  selectedProjectId: string | null;
  branches: Branch[];
  tasks: Task[];
  dependencies: [string, string][];
  recommendations: Task[];
  isLoading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null) => Promise<void>;

  createBranch: (name: string) => Promise<void>;
  archiveBranch: (id: string) => Promise<void>;

  createTask: (title: string, branchId?: string) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<Task[]>;
  updateTask: (id: string, title: string, description?: string) => Promise<void>;
  assignTaskToBranch: (taskId: string, branchId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  addDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  removeDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;

  loadRecommendations: () => Promise<void>;
  applyTaskUpdates: (updated: Task[]) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  branches: [],
  tasks: [],
  dependencies: [],
  recommendations: [],
  isLoading: false,

  loadProjects: async () => {
    const projects = await invoke<Project[]>('get_projects');
    set({ projects });
    if (projects.length > 0 && !get().selectedProjectId) {
      await get().selectProject(projects[0].id);
    }
  },

  createProject: async (name) => {
    const project = await invoke<Project>('create_project', { name });
    set((state) => ({ projects: [...state.projects, project] }));
    await get().selectProject(project.id);
  },

  deleteProject: async (id) => {
    await invoke('delete_project', { id });
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id);
      const selectedProjectId =
        state.selectedProjectId === id ? (projects[0]?.id ?? null) : state.selectedProjectId;
      return { projects, selectedProjectId };
    });
    const { selectedProjectId } = get();
    if (selectedProjectId) {
      await get().selectProject(selectedProjectId);
    } else {
      set({ branches: [], tasks: [], dependencies: [], recommendations: [] });
    }
  },

  selectProject: async (id) => {
    set({ selectedProjectId: id, branches: [], tasks: [], dependencies: [], isLoading: true });
    if (!id) {
      set({ isLoading: false, recommendations: [] });
      return;
    }
    const [branches, tasks, dependencies] = await Promise.all([
      invoke<Branch[]>('get_branches', { projectId: id }),
      invoke<Task[]>('get_tasks', { projectId: id }),
      invoke<[string, string][]>('get_dependencies', { projectId: id }),
    ]);
    set({ branches, tasks, dependencies, isLoading: false });
    await get().loadRecommendations();
  },

  createBranch: async (name) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;
    const branch = await invoke<Branch>('create_branch', { projectId: selectedProjectId, name });
    set((state) => ({ branches: [...state.branches, branch] }));
  },

  archiveBranch: async (id) => {
    await invoke('archive_branch', { id });
    set((state) => ({ branches: state.branches.filter((b) => b.id !== id) }));
  },

  createTask: async (title, branchId) => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;
    const task = await invoke<Task>('create_task', {
      projectId: selectedProjectId,
      title,
      branchId: branchId ?? null,
    });
    set((state) => ({ tasks: [...state.tasks, task] }));
    if (task.status === 'ready') await get().loadRecommendations();
  },

  updateTaskStatus: async (id, status) => {
    const affected = await invoke<Task[]>('update_task_status', { id, status });
    get().applyTaskUpdates(affected);
    await get().loadRecommendations();
    return affected;
  },

  updateTask: async (id, title, description) => {
    const task = await invoke<Task>('update_task', {
      id,
      title,
      description: description ?? null,
    });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }));
  },

  assignTaskToBranch: async (taskId, branchId) => {
    const task = await invoke<Task>('assign_task_to_branch', { taskId, branchId });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? task : t)),
    }));
    await get().loadRecommendations();
  },

  deleteTask: async (id) => {
    await invoke('delete_task', { id });
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      recommendations: state.recommendations.filter((t) => t.id !== id),
    }));
  },

  addDependency: async (taskId, dependsOnTaskId) => {
    await invoke('add_dependency', { taskId, dependsOnTaskId });
    set((state) => ({
      dependencies: [...state.dependencies, [taskId, dependsOnTaskId]],
      tasks: state.tasks.map((t) =>
        t.id === taskId && t.status === 'ready' ? { ...t, status: 'pending' as TaskStatus } : t,
      ),
    }));
    await get().loadRecommendations();
  },

  removeDependency: async (taskId, dependsOnTaskId) => {
    await invoke('remove_dependency', { taskId, dependsOnTaskId });
    set((state) => ({
      dependencies: state.dependencies.filter(
        ([tid, dtid]) => !(tid === taskId && dtid === dependsOnTaskId),
      ),
    }));
    // Re-fetch the task to get the updated status from Rust
    const { selectedProjectId } = get();
    if (selectedProjectId) {
      const tasks = await invoke<Task[]>('get_tasks', { projectId: selectedProjectId });
      set({ tasks });
    }
    await get().loadRecommendations();
  },

  loadRecommendations: async () => {
    const { selectedProjectId } = get();
    if (!selectedProjectId) return;
    const recommendations = await invoke<Task[]>('get_recommendations', {
      projectId: selectedProjectId,
    });
    set({ recommendations });
  },

  applyTaskUpdates: (updated) => {
    set((state) => ({
      tasks: state.tasks.map((t) => {
        const u = updated.find((u) => u.id === t.id);
        return u ?? t;
      }),
    }));
  },
}));
