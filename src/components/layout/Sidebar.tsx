import { useState } from "react";
import { ChevronLeft, ChevronRight, FolderKanban, Plus } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./Sidebar.css";

export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const createProject = useAppStore((s) => s.createProject);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createProject(name);
    setNewName("");
    setAdding(false);
  };

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar__header">
        {!collapsed && (
          <div className="sidebar__brand">
            <FolderKanban size={16} />
            <span>Projects</span>
          </div>
        )}
        <button
          type="button"
          className="sidebar__collapse"
          onClick={toggleSidebar}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar__list">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`sidebar__item ${project.id === activeProjectId ? "sidebar__item--active" : ""}`}
            onClick={() => selectProject(project.id)}
            title={project.name}
          >
            <span className="sidebar__item-dot" />
            {!collapsed && (
              <>
                <span className="sidebar__item-name">{project.name}</span>
                <span className="sidebar__item-meta">
                  {project.activeCount > 0 && `${project.activeCount} active`}
                  {project.activeCount > 0 && project.readyCount > 0 && " · "}
                  {project.readyCount > 0 && `${project.readyCount} ready`}
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div className="sidebar__footer">
          {adding ? (
            <div className="sidebar__add-form">
              <input
                autoFocus
                placeholder="项目名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                  if (e.key === "Escape") setAdding(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="sidebar__add"
              onClick={() => setAdding(true)}
            >
              <Plus size={14} />
              <span>新建项目</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
