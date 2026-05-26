import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function Sidebar() {
  const { projects, selectedProjectId, createProject, deleteProject, selectProject } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    await createProject(name.trim());
    setName('');
    setIsAdding(false);
  }, [name, createProject]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCreate();
      if (e.key === 'Escape') {
        setName('');
        setIsAdding(false);
      }
    },
    [handleCreate],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">Projects</span>
        <button
          className="sidebar__icon-btn"
          onClick={() => setIsAdding((v) => !v)}
          title="New project"
        >
          <Plus size={15} />
        </button>
      </div>

      {isAdding && (
        <div className="sidebar__new-row">
          <input
            ref={inputRef}
            type="text"
            className="sidebar__input"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!name.trim()) setIsAdding(false);
            }}
          />
        </div>
      )}

      <ul className="sidebar__list">
        {projects.map((project) => (
          <li
            key={project.id}
            className={`sidebar__item${project.id === selectedProjectId ? ' sidebar__item--active' : ''}`}
            onClick={() => selectProject(project.id)}
          >
            <FolderOpen size={13} className="sidebar__item-icon" />
            <span className="sidebar__item-name">{project.name}</span>
            <button
              className="sidebar__item-delete"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete project "${project.name}"?`)) {
                  deleteProject(project.id);
                }
              }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
        {projects.length === 0 && !isAdding && (
          <li className="sidebar__empty">No projects yet</li>
        )}
      </ul>
    </aside>
  );
}
