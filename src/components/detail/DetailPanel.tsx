import { useEffect, useState } from "react";
import { Pin, X } from "lucide-react";

import * as api from "../../api/tauri";
import { useAppStore } from "../../store/appStore";
import "./DetailPanel.css";

export function DetailPanel() {
  const graph = useAppStore((s) => s.graph);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const detailOpen = useAppStore((s) => s.detailOpen);
  const setDetailOpen = useAppStore((s) => s.setDetailOpen);
  const refreshAll = useAppStore((s) => s.refreshAll);

  const task = graph?.tasks.find((t) => t.id === selectedTaskId) ?? null;
  const branch = graph?.branches.find((b) => b.id === task?.branchId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [task]);

  if (!detailOpen || !task || !activeProjectId) return null;

  const save = async () => {
    await api.updateTask(activeProjectId, task.id, title, description);
    await refreshAll();
  };

  const togglePin = async () => {
    await api.pinTask(activeProjectId, task.id, !task.pinned);
    await refreshAll();
  };

  const archiveBranch = async () => {
    if (!branch) return;
    await api.archiveBranch(activeProjectId, branch.id);
    await refreshAll();
    setDetailOpen(false);
  };

  const upstream = graph?.dependencies.filter((d) => d.taskId === task.id) ?? [];
  const downstream = graph?.dependencies.filter((d) => d.dependsOnTaskId === task.id) ?? [];

  return (
    <aside className="detail-panel">
      <header className="detail-panel__header">
        <span className="detail-panel__status">{task.status}</span>
        <div className="detail-panel__actions">
          <button type="button" onClick={() => void togglePin()} title="置顶">
            <Pin size={14} className={task.pinned ? "detail-panel__pinned" : ""} />
          </button>
          <button type="button" onClick={() => setDetailOpen(false)} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      </header>

      <input
        className="detail-panel__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void save()}
      />
      <textarea
        className="detail-panel__desc"
        placeholder="描述（可选）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => void save()}
      />

      <div className="detail-panel__meta">
        {branch && (
          <div className="detail-panel__branch-row">
            <span>支线: {branch.name}</span>
            <button type="button" className="detail-panel__archive" onClick={() => void archiveBranch()}>
              归档支线
            </button>
          </div>
        )}
        <span>排序: {task.sortOrder}</span>
      </div>

      <section className="detail-panel__deps">
        <h3>依赖</h3>
        <div className="detail-panel__dep-list">
          {upstream.length === 0 && downstream.length === 0 && (
            <p className="detail-panel__dep-empty">在 DAG 上连线可添加跨支线依赖</p>
          )}
          {upstream.map((d) => {
            const dep = graph?.tasks.find((t) => t.id === d.dependsOnTaskId);
            return dep ? <div key={d.dependsOnTaskId}>阻塞于: {dep.title}</div> : null;
          })}
          {downstream.map((d) => {
            const dep = graph?.tasks.find((t) => t.id === d.taskId);
            return dep ? <div key={d.taskId}>阻塞: {dep.title}</div> : null;
          })}
        </div>
      </section>
    </aside>
  );
}
