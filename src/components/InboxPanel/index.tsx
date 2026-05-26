import { useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Inbox, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Task } from '../../types';

interface InboxPanelProps {
  onSelectTask: (task: Task) => void;
}

export default function InboxPanel({ onSelectTask }: InboxPanelProps) {
  const { tasks, branches, createTask, assignTaskToBranch } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const inboxTasks = tasks.filter((t) => t.status === 'inbox');

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    await createTask(newTitle.trim());
    setNewTitle('');
    inputRef.current?.focus();
  }, [newTitle, createTask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') handleAdd();
    },
    [handleAdd],
  );

  const handleAssign = useCallback(
    async (taskId: string, branchId: string) => {
      await assignTaskToBranch(taskId, branchId);
    },
    [assignTaskToBranch],
  );

  return (
    <div className={`inbox-panel${expanded ? ' inbox-panel--expanded' : ''}`}>
      <button className="inbox-panel__header" onClick={() => setExpanded((v) => !v)}>
        <Inbox size={13} />
        <span>Inbox</span>
        {inboxTasks.length > 0 && (
          <span className="inbox-panel__count">{inboxTasks.length}</span>
        )}
        <span className="inbox-panel__chevron">
          {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </span>
      </button>

      {expanded && (
        <div className="inbox-panel__body">
          <div className="inbox-panel__add">
            <input
              ref={inputRef}
              type="text"
              className="inbox-input"
              placeholder="Quick add task… (Enter to save)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="inbox-add-btn" onClick={handleAdd} title="Add">
              <Plus size={14} />
            </button>
          </div>

          {inboxTasks.length > 0 && (
            <ul className="inbox-list">
              {inboxTasks.map((task) => (
                <li key={task.id} className="inbox-item">
                  <span
                    className="inbox-item__title"
                    onClick={() => onSelectTask(task)}
                    role="button"
                    tabIndex={0}
                  >
                    {task.title}
                  </span>
                  {branches.length > 0 && (
                    <select
                      className="inbox-item__assign"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleAssign(task.id, e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        → Branch
                      </option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}

          {inboxTasks.length === 0 && (
            <p className="inbox-empty">Inbox is clear.</p>
          )}
        </div>
      )}
    </div>
  );
}
