import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Link, Pause, Play, Trash2, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useToastStore } from '../../store/useToastStore';
import type { Task } from '../../types';

interface DetailPanelProps {
  task: Task;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  inbox: '#6b7280',
  pending: '#4b5563',
  ready: '#3b82f6',
  active: '#22c55e',
  done: '#374151',
};

const STATUS_LABEL: Record<string, string> = {
  inbox: 'Inbox',
  pending: 'Pending',
  ready: 'Ready',
  active: 'Active',
  done: 'Done',
};

export default function DetailPanel({ task, onClose }: DetailPanelProps) {
  const { updateTask, updateTaskStatus, deleteTask, tasks, branches, dependencies } = useStore();
  const { push } = useToastStore();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const currentTask = tasks.find((t) => t.id === task.id) ?? task;

  // Auto-save on change
  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateTask(task.id, title, description || undefined);
      setIsDirty(false);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [title, description, isDirty, task.id, updateTask]);

  // Sync title/desc when task changes externally
  useEffect(() => {
    setTitle(currentTask.title);
    setDescription(currentTask.description ?? '');
  }, [currentTask.title, currentTask.description]);

  const handleComplete = useCallback(async () => {
    const affected = await updateTaskStatus(task.id, 'done');
    const prev = task.status;
    push(`Completed: ${task.title}`, async () => {
      await updateTaskStatus(task.id, prev);
    });
    if (affected.some((t) => t.id === task.id && t.status === 'done')) {
      onClose();
    }
  }, [task, updateTaskStatus, push, onClose]);

  const handleStart = useCallback(async () => {
    await updateTaskStatus(task.id, 'active');
  }, [task.id, updateTaskStatus]);

  const handlePause = useCallback(async () => {
    await updateTaskStatus(task.id, 'ready');
  }, [task.id, updateTaskStatus]);

  const handleDelete = useCallback(async () => {
    await deleteTask(task.id);
    push(`Deleted: ${task.title}`);
    onClose();
  }, [task, deleteTask, push, onClose]);

  // Deps display
  const myDeps = dependencies.filter(([tid]) => tid === task.id);
  const myDownstream = dependencies.filter(([, did]) => did === task.id);
  const branchName = branches.find((b) => b.id === currentTask.branch_id)?.name;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <div className="detail-panel__meta">
          {branchName && <span className="detail-panel__branch">{branchName}</span>}
          <span
            className="detail-panel__status"
            style={{ color: STATUS_COLOR[currentTask.status] }}
          >
            {STATUS_LABEL[currentTask.status]}
          </span>
        </div>
        <button className="detail-panel__close" onClick={onClose} title="Close">
          <X size={15} />
        </button>
      </div>

      <div className="detail-panel__body">
        <textarea
          className="detail-panel__title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          rows={2}
          placeholder="Task title"
        />

        <textarea
          className="detail-panel__description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setIsDirty(true);
          }}
          rows={4}
          placeholder="Add a description…"
        />

        <div className="detail-panel__actions">
          {currentTask.status === 'ready' && (
            <button className="detail-btn detail-btn--primary" onClick={handleStart}>
              <Play size={13} />
              Start
            </button>
          )}
          {currentTask.status === 'active' && (
            <>
              <button className="detail-btn detail-btn--success" onClick={handleComplete}>
                <CheckCircle2 size={13} />
                Mark Done
              </button>
              <button className="detail-btn detail-btn--secondary" onClick={handlePause}>
                <Pause size={13} />
                Pause
              </button>
            </>
          )}
          {currentTask.status === 'done' && (
            <span className="detail-done-badge">✓ Completed</span>
          )}
        </div>

        {(myDeps.length > 0 || myDownstream.length > 0) && (
          <div className="detail-panel__deps">
            <div className="detail-panel__deps-label">
              <Link size={12} />
              Dependencies
            </div>
            {myDeps.length > 0 && (
              <div className="detail-panel__dep-group">
                <span className="detail-panel__dep-heading">Blocked by:</span>
                {myDeps.map(([, did]) => {
                  const dep = tasks.find((t) => t.id === did);
                  return dep ? (
                    <span key={did} className="detail-panel__dep-chip">
                      {dep.title}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            {myDownstream.length > 0 && (
              <div className="detail-panel__dep-group">
                <span className="detail-panel__dep-heading">Blocking:</span>
                {myDownstream.map(([tid]) => {
                  const dep = tasks.find((t) => t.id === tid);
                  return dep ? (
                    <span key={tid} className="detail-panel__dep-chip detail-panel__dep-chip--downstream">
                      {dep.title}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="detail-panel__footer">
        <button className="detail-btn detail-btn--danger" onClick={handleDelete}>
          <Trash2 size={13} />
          Delete
        </button>
        {isDirty && <span className="detail-saving">Saving…</span>}
      </div>
    </div>
  );
}
