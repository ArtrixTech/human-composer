import { useCallback, useEffect, useRef, useState } from 'react';
import { Command, Layers, Plus, Play, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface CommandPaletteProps {
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => Promise<void> | void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const { tasks, branches, updateTaskStatus, createTask, selectedProjectId } = useStore();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const activeTasks = tasks.filter((t) => t.status === 'active');
  const readyTasks = tasks.filter((t) => t.status === 'ready');

  const staticItems: PaletteItem[] = [
    ...activeTasks.map((task) => ({
      id: `complete-${task.id}`,
      label: `Complete: ${task.title}`,
      description: branches.find((b) => b.id === task.branch_id)?.name,
      icon: <CheckCircle2 size={13} />,
      action: async () => {
        await updateTaskStatus(task.id, 'done');
        onClose();
      },
    })),
    ...readyTasks.map((task) => ({
      id: `start-${task.id}`,
      label: `Start: ${task.title}`,
      description: branches.find((b) => b.id === task.branch_id)?.name,
      icon: <Play size={13} />,
      action: async () => {
        await updateTaskStatus(task.id, 'active');
        onClose();
      },
    })),
    ...branches.map((branch) => ({
      id: `add-to-${branch.id}`,
      label: `Add task to ${branch.name}`,
      icon: <Plus size={13} />,
      action: async () => {
        const title = query.startsWith('Add task to') ? '' : query;
        if (title && selectedProjectId) {
          await createTask(title, branch.id);
        }
        onClose();
      },
    })),
  ];

  const filtered = query
    ? staticItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.description ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : staticItems;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        filtered[activeIndex].action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, activeIndex, onClose],
  );

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input-row">
          <Command size={15} className="palette__icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette__input"
            placeholder="Search tasks or commands…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="palette__esc" onClick={onClose}>
            esc
          </kbd>
        </div>

        <div className="palette__list">
          {filtered.length === 0 && (
            <div className="palette__empty">No results for "{query}"</div>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              className={`palette__item${i === activeIndex ? ' palette__item--active' : ''}`}
              onClick={() => item.action()}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="palette__item-icon">{item.icon}</span>
              <span className="palette__item-label">{item.label}</span>
              {item.description && (
                <span className="palette__item-desc">{item.description}</span>
              )}
            </button>
          ))}
        </div>

        <div className="palette__footer">
          <span>
            <kbd>↑↓</kbd> navigate · <kbd>↵</kbd> select · <kbd>esc</kbd> close
          </span>
          <span>
            <Layers size={11} /> Human Composer
          </span>
        </div>
      </div>
    </div>
  );
}
