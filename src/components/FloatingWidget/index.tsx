import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Layers, Pause, Play, Plus, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../../store/useStore';
import type { Task } from '../../types';

export default function FloatingWidget() {
  const {
    tasks,
    branches,
    recommendations,
    updateTaskStatus,
    createTask,
    loadProjects,
    loadRecommendations,
    applyTaskUpdates,
    selectedProjectId,
  } = useStore();

  const [expanded, setExpanded] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showRecommend, setShowRecommend] = useState(false);

  const activeTasks = tasks.filter((t) => t.status === 'active');
  const currentTask = activeTasks[0] ?? null;

  // Load data on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Listen for cross-window events
  useEffect(() => {
    const unlisten = Promise.all([
      listen<Task[]>('tasks-updated', (e) => {
        applyTaskUpdates(e.payload);
        loadRecommendations();
      }),
      listen<Task>('task-created', (e) => {
        useStore.setState((s) => ({ tasks: [...s.tasks, e.payload] }));
      }),
    ]);
    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [applyTaskUpdates, loadRecommendations]);

  const handleComplete = useCallback(async () => {
    if (!currentTask) return;
    await updateTaskStatus(currentTask.id, 'done');
    setShowRecommend(true);
  }, [currentTask, updateTaskStatus]);

  const handlePause = useCallback(async () => {
    if (!currentTask) return;
    await updateTaskStatus(currentTask.id, 'ready');
  }, [currentTask, updateTaskStatus]);

  const handleStartRecommended = useCallback(
    async (task: Task) => {
      await updateTaskStatus(task.id, 'active');
      setShowRecommend(false);
    },
    [updateTaskStatus],
  );

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !selectedProjectId) return;
    await createTask(newTaskTitle.trim());
    setNewTaskTitle('');
  }, [newTaskTitle, selectedProjectId, createTask]);

  const handleClose = useCallback(async () => {
    await invoke('close_floating_widget');
  }, []);

  if (!expanded) {
    return (
      <div className="widget-collapsed" data-tauri-drag-region>
        <div className="widget-collapsed__content">
          {currentTask ? (
            <>
              <span className="widget-collapsed__task">{currentTask.title}</span>
              <button
                className="widget-collapsed__complete"
                onClick={handleComplete}
                title="Complete"
              >
                <CheckCircle2 size={14} />
              </button>
            </>
          ) : (
            <span className="widget-collapsed__idle">Nothing active</span>
          )}
        </div>
        <button
          className="widget-collapsed__expand"
          onClick={() => setExpanded(true)}
          title="Expand"
        >
          <ChevronUp size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="widget">
      <div className="widget__titlebar" data-tauri-drag-region>
        <Layers size={12} className="widget__logo" />
        <span className="widget__app-name">Human Composer</span>
        <button className="widget__minimize" onClick={() => setExpanded(false)} title="Collapse">
          <ChevronDown size={12} />
        </button>
        <button className="widget__close" onClick={handleClose} title="Close">
          <X size={12} />
        </button>
      </div>

      <div className="widget__body">
        {/* Current task */}
        <div className="widget__section">
          {currentTask ? (
            <>
              <div className="widget__current-label">Now:</div>
              <div className="widget__current-task">
                <span className="widget__current-title">{currentTask.title}</span>
                <div className="widget__current-actions">
                  <button className="widget-btn widget-btn--complete" onClick={handleComplete}>
                    <CheckCircle2 size={12} />
                    Done
                  </button>
                  <button className="widget-btn widget-btn--pause" onClick={handlePause}>
                    <Pause size={12} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="widget__no-active">No active task</div>
          )}
        </div>

        {/* Recommendations / next actions */}
        {(showRecommend || !currentTask) && recommendations.length > 0 && (
          <div className="widget__section widget__section--recommend">
            <div className="widget__recommend-label">
              {showRecommend ? '✓ Done! Start next:' : 'Ready to start:'}
            </div>
            {recommendations.slice(0, 3).map((task, i) => (
              <button
                key={task.id}
                className={`widget__recommend-item${i === 0 ? ' widget__recommend-item--top' : ''}`}
                onClick={() => handleStartRecommended(task)}
              >
                <Play size={11} />
                <span>{task.title}</span>
                <span className="widget__recommend-branch">
                  {branches.find((b) => b.id === task.branch_id)?.name}
                </span>
              </button>
            ))}
            {showRecommend && (
              <button className="widget__skip" onClick={() => setShowRecommend(false)}>
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* Quick add */}
        <div className="widget__section widget__add">
          <input
            type="text"
            className="widget__add-input"
            placeholder="Add to inbox…"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleAddTask();
            }}
          />
          <button className="widget__add-btn" onClick={handleAddTask}>
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
