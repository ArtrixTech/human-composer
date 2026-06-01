import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pause, Pin, Play, Trash2, X } from "lucide-react";

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
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const reorderTask = useAppStore((s) => s.reorderTask);
  const assignInboxTask = useAppStore((s) => s.assignInboxTask);

  const task = graph?.tasks.find((t) => t.id === selectedTaskId) ?? null;
  const branch = graph?.branches.find((b) => b.id === task?.branchId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState("30");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setEstimate(String(task.estimatedMinutes ?? 30));
    }
  }, [task]);

  if (!detailOpen || !task || !activeProjectId) return null;

  const save = async () => {
    await api.updateTask(activeProjectId, task.id, title, description);
    await api.setTaskEstimatedMinutes(activeProjectId, task.id, parseInt(estimate, 10) || 30);
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

  const removeDep = async (dependsOnTaskId: string) => {
    await api.removeDependency(task.id, dependsOnTaskId);
    await refreshAll();
  };

  const upstream = graph?.dependencies.filter((d) => d.taskId === task.id) ?? [];
  const downstream = graph?.dependencies.filter((d) => d.dependsOnTaskId === task.id) ?? [];

  return (
    <aside className="detail-panel detail-panel--open">
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

      <div className="detail-panel__status-actions">
        {task.status === "ready" && (
          <button type="button" onClick={() => void activateTask(task.id, activeProjectId)}>
            <Play size={12} /> 开始
          </button>
        )}
        {task.status === "active" && (
          <>
            <button type="button" onClick={() => void completeTask(task.id, activeProjectId)}>
              <Check size={12} /> 完成
            </button>
            <button type="button" onClick={() => void pauseTask(task.id, activeProjectId)}>
              <Pause size={12} /> 暂停
            </button>
          </>
        )}
      </div>

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

      <label className="detail-panel__estimate">
        预估时长（分钟）
        <input
          type="number"
          min={5}
          step={5}
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          onBlur={() => void save()}
        />
      </label>

      <div className="detail-panel__meta">
        {branch && (
          <div className="detail-panel__branch-row">
            <span>支线: {branch.name}</span>
            <select
              value={branch.id}
              onChange={(e) => void assignInboxTask(task.id, e.target.value)}
            >
              {graph?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="button" className="detail-panel__archive" onClick={() => void archiveBranch()}>
              归档支线
            </button>
          </div>
        )}
        <div className="detail-panel__reorder">
          <button type="button" onClick={() => void reorderTask(task.id, "up")}>
            <ArrowUp size={12} /> 上移
          </button>
          <button type="button" onClick={() => void reorderTask(task.id, "down")}>
            <ArrowDown size={12} /> 下移
          </button>
        </div>
      </div>

      <section className="detail-panel__deps">
        <h3>依赖</h3>
        <div className="detail-panel__dep-list">
          {upstream.length === 0 && downstream.length === 0 && (
            <p className="detail-panel__dep-empty">在 DAG 上连线可添加跨支线依赖</p>
          )}
          {upstream.map((d) => {
            const dep = graph?.tasks.find((t) => t.id === d.dependsOnTaskId);
            return dep ? (
              <div key={d.dependsOnTaskId} className="detail-panel__dep-row">
                <span>阻塞于: {dep.title}</span>
                <button type="button" onClick={() => void removeDep(d.dependsOnTaskId)}>
                  <X size={10} />
                </button>
              </div>
            ) : null;
          })}
          {downstream.map((d) => {
            const dep = graph?.tasks.find((t) => t.id === d.taskId);
            return dep ? <div key={d.taskId}>阻塞: {dep.title}</div> : null;
          })}
        </div>
      </section>

      <button
        type="button"
        className="detail-panel__delete"
        onClick={() => void deleteTask(task.id, activeProjectId)}
      >
        <Trash2 size={14} /> 删除任务
      </button>
    </aside>
  );
}
