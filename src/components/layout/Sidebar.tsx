import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FolderKanban, Plus, Trash2 } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./Sidebar.css";

export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const currentView = useAppStore((s) => s.currentView);
  const selectTodayView = useAppStore((s) => s.selectTodayView);
  const selectProjectView = useAppStore((s) => s.selectProjectView);
  const createProject = useAppStore((s) => s.createProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [contextProjectId, setContextProjectId] = useState<string | null>(null);

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
        <button
          type="button"
          className={`sidebar__item sidebar__today ${currentView === "today" ? "sidebar__item--active" : ""}`}
          onClick={() => void selectTodayView()}
          title="今日安排"
        >
          <CalendarDays size={14} />
          {!collapsed && <span className="sidebar__item-name">今日</span>}
        </button>

        {!collapsed && <div className="sidebar__separator" />}

        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`sidebar__item ${currentView === "project" && project.id === activeProjectId ? "sidebar__item--active" : ""}`}
            onClick={() => void selectProjectView(project.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextProjectId(project.id);
            }}
            title={project.name}
          >
            <span className="sidebar__item-dot" />
            {!collapsed && (
              <>
                <span className="sidebar__item-name">{project.name}</span>
                {project.taskCount > 0 && (
                  <div className="sidebar__item-progress">
                    <div
                      className="sidebar__item-progress-fill"
                      style={{
                        width: `${Math.round((project.doneCount / project.taskCount) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <span className="sidebar__item-meta">
                  {project.activeCount > 0 && `${project.activeCount} active`}
                  {project.activeCount > 0 && project.readyCount > 0 && " · "}
                  {project.readyCount > 0 && `${project.readyCount} ready`}
                </span>
                {contextProjectId === project.id && (
                  <button
                    type="button"
                    className="sidebar__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteProject(project.id);
                      setContextProjectId(null);
                    }}
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                )}
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
            <button type="button" className="sidebar__add" onClick={() => setAdding(true)}>
              <Plus size={14} />
              <span>新建项目</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
