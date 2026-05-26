import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { LayoutGrid, Plus } from 'lucide-react';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import DAGCanvas from './components/DAGCanvas';
import InboxPanel from './components/InboxPanel';
import DetailPanel from './components/DetailPanel';
import ToastContainer from './components/Toast';
import RecommendPopup from './components/RecommendPopup';
import CommandPalette from './components/CommandPalette';
import type { Task } from './types';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import './App.css';

export default function App() {
  const {
    projects,
    selectedProjectId,
    branches,
    tasks,
    isLoading,
    loadProjects,
    createBranch,
    applyTaskUpdates,
    loadRecommendations,
    recommendations,
  } = useStore();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [showRecommend, setShowRecommend] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  useGlobalShortcuts();

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Cross-window event sync
  useEffect(() => {
    const cleanups = Promise.all([
      listen<Task[]>('tasks-updated', (e) => {
        applyTaskUpdates(e.payload);
        loadRecommendations();
        // If a task just became Done, show the recommend popup
        const hadDone = e.payload.some((t) => t.status === 'done');
        if (hadDone && recommendations.length > 0) {
          setShowRecommend(true);
        }
      }),
      listen<Task>('task-created', (e) => {
        useStore.setState((s) => ({ tasks: [...s.tasks, e.payload] }));
      }),
      listen<string>('task-deleted', (e) => {
        useStore.setState((s) => ({
          tasks: s.tasks.filter((t) => t.id !== e.payload),
        }));
      }),
    ]);
    return () => {
      cleanups.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [applyTaskUpdates, loadRecommendations, recommendations.length]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
      if (e.key === 'Escape') {
        setShowPalette(false);
        setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeTasks = tasks.filter((t) => t.status === 'active');
  const readyTasks = tasks.filter((t) => t.status === 'ready');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const handleCreateBranch = useCallback(async () => {
    if (!branchName.trim()) return;
    await createBranch(branchName.trim());
    setBranchName('');
    setIsAddingBranch(false);
  }, [branchName, createBranch]);

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  return (
    <div className="app">
      <Sidebar />

      <div className="main-content">
        {selectedProject ? (
          <>
            {/* Project header */}
            <div className="project-header">
              <div className="project-header__info">
                <h2 className="project-header__name">{selectedProject.name}</h2>
                <div className="project-header__stats">
                  {activeTasks.length > 0 && (
                    <span className="stat-badge stat-badge--active">
                      {activeTasks.length} active
                    </span>
                  )}
                  <span className="stat-badge stat-badge--ready">{readyTasks.length} ready</span>
                  <span className="stat-badge stat-badge--muted">{doneTasks.length} done</span>
                </div>
              </div>
              <div className="project-header__actions">
                {isAddingBranch ? (
                  <input
                    type="text"
                    className="branch-name-input"
                    placeholder="Branch name"
                    value={branchName}
                    autoFocus
                    onChange={(e) => setBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBranch();
                      if (e.key === 'Escape') {
                        setBranchName('');
                        setIsAddingBranch(false);
                      }
                    }}
                    onBlur={() => {
                      if (!branchName.trim()) setIsAddingBranch(false);
                    }}
                  />
                ) : (
                  <button className="btn-secondary" onClick={() => setIsAddingBranch(true)}>
                    <Plus size={13} />
                    Branch
                  </button>
                )}
                  <button
                    className="btn-secondary"
                    onClick={() => invoke('open_floating_widget')}
                    title="Open floating widget"
                  >
                    <LayoutGrid size={13} />
                    Widget
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowPalette(true)}
                    title="Command palette (⌘K)"
                  >
                    ⌘K
                  </button>
              </div>
            </div>

            {/* Main DAG area */}
            {isLoading ? (
              <div className="loading-state">Loading…</div>
            ) : branches.length === 0 ? (
              <div className="empty-state">
                <p>No branches yet.</p>
                <p className="empty-hint">Add a branch to start organizing tasks.</p>
              </div>
            ) : (
              <DAGCanvas onSelectTask={handleSelectTask} />
            )}

            {/* Inbox panel */}
            <InboxPanel onSelectTask={handleSelectTask} />
          </>
        ) : (
          <div className="empty-state empty-state--full">
            <p>Select or create a project to get started.</p>
          </div>
        )}
      </div>

      {/* Right side: detail panel */}
      {selectedTask && (
        <DetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Recommendation popup */}
      {showRecommend && recommendations.length > 0 && (
        <RecommendPopup onDismiss={() => setShowRecommend(false)} />
      )}

      {/* Command palette */}
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}

      <ToastContainer />
    </div>
  );
}
