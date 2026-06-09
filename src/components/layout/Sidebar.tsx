import { useEffect, useRef, useState } from "react";
import { Bot, CalendarDays, ChevronLeft, ChevronRight, FolderKanban, Plus } from "lucide-react";

import type { PriorityLevel } from "../../types";
import { useAppStore } from "../../store/appStore";
import { PRIORITY_LABELS } from "../../utils/priorityUtils";
import { ProjectIcon } from "../shared/ProjectIcon";
import { projectPriorityClass } from "../../utils/projectUtils";
import { ProjectSettingsMenu } from "./ProjectSettingsMenu";
import "./Sidebar.css";

export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const currentView = useAppStore((s) => s.currentView);
  const selectTodayView = useAppStore((s) => s.selectTodayView);
  const selectProjectView = useAppStore((s) => s.selectProjectView);
  const createProject = useAppStore((s) => s.createProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsProjectId) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setSettingsProjectId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [settingsProjectId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createProject(name);
    setNewName("");
    setAdding(false);
  };

  const settingsProject = projects.find((p) => p.id === settingsProjectId);

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
          <div
            key={project.id}
            className={`sidebar__project-wrap${settingsProjectId === project.id ? " sidebar__project-wrap--open" : ""}`}
            ref={settingsProjectId === project.id ? menuRef : undefined}
          >
            <button
              type="button"
              className={`sidebar__item sidebar__project ${currentView === "project" && project.id === activeProjectId ? "sidebar__item--active" : ""}`}
              onClick={() => void selectProjectView(project.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSettingsProjectId(project.id);
              }}
              title={`${project.name} · ${PRIORITY_LABELS[project.priority]}`}
            >
              <span className="sidebar__project-dot" style={{ background: project.color }} aria-hidden />
              <span className="sidebar__project-icon" style={{ color: project.color }} aria-hidden>
                <ProjectIcon name={project.icon} size={14} />
              </span>
              {!collapsed && (
                <div className="sidebar__project-body">
                  <div className="sidebar__project-head">
                    <span className="sidebar__item-name">{project.name}</span>
                    <span
                      className={`sidebar__priority-badge ${projectPriorityClass(project.priority)}`}
                    >
                      {project.priority}
                    </span>
                  </div>
                  {project.taskCount > 0 && (
                    <div className="sidebar__item-progress">
                      <div
                        className="sidebar__item-progress-fill"
                        style={{
                          width: `${Math.round((project.doneCount / project.taskCount) * 100)}%`,
                          background: project.color,
                        }}
                      />
                    </div>
                  )}
                  <span className="sidebar__item-meta">
                    {project.activeCount > 0 && `${project.activeCount} active`}
                    {project.activeCount > 0 && project.readyCount > 0 && " · "}
                    {project.readyCount > 0 && `${project.readyCount} ready`}
                  </span>
                </div>
              )}
            </button>
            {settingsProjectId === project.id && settingsProject && !collapsed && (
              <ProjectSettingsMenu
                project={settingsProject}
                onUpdatePriority={(p: PriorityLevel) => void updateProject(project.id, { priority: p })}
                onUpdateColor={(color) => void updateProject(project.id, { color })}
                onUpdateIcon={(icon) => void updateProject(project.id, { icon })}
                onDelete={() => {
                  void deleteProject(project.id);
                  setSettingsProjectId(null);
                }}
                onClose={() => setSettingsProjectId(null)}
              />
            )}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__ai-settings"
            onClick={() => window.dispatchEvent(new Event("open-ai-settings"))}
          >
            <Bot size={14} />
            <span>AI 设置</span>
          </button>
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
