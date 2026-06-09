import { useEffect, useState } from "react";
import { Archive, ArrowDown, ArrowUp, Check, Pause, Pin, Play, Trash2, X } from "lucide-react";

import * as api from "../../api/tauri";
import { useAppStore } from "../../store/appStore";
import { DurationPicker } from "../shared/DurationPicker";
import { PriorityPicker } from "../shared/PriorityPicker";
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
  const archiveTask = useAppStore((s) => s.archiveTask);
  const reorderTask = useAppStore((s) => s.reorderTask);
  const assignInboxTask = useAppStore((s) => s.assignInboxTask);
  const renameBranch = useAppStore((s) => s.renameBranch);
  const archiveBranchStore = useAppStore((s) => s.archiveBranch);
  const deleteBranch = useAppStore((s) => s.deleteBranch);
  const setTaskPriority = useAppStore((s) => s.setTaskPriority);

  const action = graph?.actions.find((t) => t.id === selectedTaskId) ?? null;
  const outcome = graph?.outcomes.find((b) => b.id === action?.branchId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState(30);
  const [outcomeNameEditing, setOutcomeNameEditing] = useState(false);
  const [outcomeName, setOutcomeName] = useState("");

  useEffect(() => {
    if (action) {
      setTitle(action.title);
      setDescription(action.description);
      setEstimate(action.estimatedMinutes ?? 30);
    }
  }, [action]);

  useEffect(() => {
    if (outcome) setOutcomeName(outcome.name);
  }, [outcome?.name]);

  if (!detailOpen || !action || !activeProjectId) return null;

  const save = async () => {
    await api.updateTask(activeProjectId, action.id, title, description);
    await api.setTaskEstimatedMinutes(activeProjectId, action.id, estimate || 30);
    await refreshAll();
  };

  const togglePin = async () => {
    await api.pinTask(activeProjectId, action.id, !action.pinned);
    await refreshAll();
  };

  const commitOutcomeRename = async () => {
    if (!outcome) return;
    setOutcomeNameEditing(false);
    const trimmed = outcomeName.trim();
    if (trimmed && trimmed !== outcome.name) {
      await renameBranch(outcome.id, trimmed);
    } else {
      setOutcomeName(outcome.name);
    }
  };

  const removeDep = async (dependsOnActionId: string) => {
    await api.removeDependency(action.id, dependsOnActionId);
    await refreshAll();
  };

  const upstream = graph?.dependencies.filter((d) => d.taskId === action.id) ?? [];
  const downstream = graph?.dependencies.filter((d) => d.dependsOnTaskId === action.id) ?? [];

  return (
    <aside className="detail-panel detail-panel--open">
      <header className="detail-panel__header">
        <span className="detail-panel__status">{action.status}</span>
        <div className="detail-panel__actions">
          <button type="button" onClick={() => void togglePin()} title="置顶">
            <Pin size={14} className={action.pinned ? "detail-panel__pinned" : ""} />
          </button>
          <button type="button" onClick={() => setDetailOpen(false)} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="detail-panel__status-actions">
        {action.status === "ready" && (
          <button type="button" onClick={() => void activateTask(action.id, activeProjectId)}>
            <Play size={12} /> 开始
          </button>
        )}
        {action.status === "active" && (
          <>
            <button type="button" onClick={() => void completeTask(action.id, activeProjectId)}>
              <Check size={12} /> 完成
            </button>
            <button type="button" onClick={() => void pauseTask(action.id, activeProjectId)}>
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

      <div className="detail-panel__estimate">
        <span className="detail-panel__estimate-label">预估时长</span>
        <DurationPicker
          value={estimate}
          onChange={(m) => {
            setEstimate(m);
            void api
              .setTaskEstimatedMinutes(activeProjectId, action.id, m)
              .then(() => refreshAll());
          }}
        />
      </div>

      <div className="detail-panel__estimate">
        <span className="detail-panel__estimate-label">优先级</span>
        <PriorityPicker
          value={action.priority}
          onChange={(p) => void setTaskPriority(action.id, p)}
        />
      </div>

      <div className="detail-panel__meta">
        {outcome && (
          <div className="detail-panel__branch-row">
            <span>目标: {outcome.name}</span>
            <select
              value={outcome.id}
              onChange={(e) => void assignInboxTask(action.id, e.target.value)}
            >
              {graph?.outcomes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {outcomeNameEditing ? (
              <input
                className="detail-panel__outcome-rename"
                autoFocus
                value={outcomeName}
                onChange={(e) => setOutcomeName(e.target.value)}
                onBlur={() => void commitOutcomeRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitOutcomeRename();
                  if (e.key === "Escape") {
                    setOutcomeName(outcome.name);
                    setOutcomeNameEditing(false);
                  }
                }}
              />
            ) : (
              <button type="button" onClick={() => setOutcomeNameEditing(true)}>
                重命名目标
              </button>
            )}
            <button
              type="button"
              className="detail-panel__archive"
              onClick={() => void archiveBranchStore(outcome.id)}
            >
              归档目标
            </button>
            <button
              type="button"
              className="detail-panel__archive"
              onClick={() => void deleteBranch(outcome.id)}
            >
              删除目标
            </button>
          </div>
        )}
        <div className="detail-panel__reorder">
          <button type="button" onClick={() => void reorderTask(action.id, "up")}>
            <ArrowUp size={12} /> 上移
          </button>
          <button type="button" onClick={() => void reorderTask(action.id, "down")}>
            <ArrowDown size={12} /> 下移
          </button>
        </div>
      </div>

      <section className="detail-panel__deps">
        <h3>Block 依赖</h3>
        <p className="detail-panel__dep-hint">
          从行动卡片左侧 block 出线点拖至目标行动的入线点以建立阻塞关系
        </p>
        <div className="detail-panel__dep-list">
          {upstream.length === 0 && downstream.length === 0 && (
            <p className="detail-panel__dep-empty">暂无 block 关系</p>
          )}
          {upstream.map((d) => {
            const dep = graph?.actions.find((t) => t.id === d.dependsOnTaskId);
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
            const dep = graph?.actions.find((t) => t.id === d.taskId);
            return dep ? <div key={d.taskId}>阻塞: {dep.title}</div> : null;
          })}
        </div>
      </section>

      <button
        type="button"
        className="detail-panel__archive-task"
        onClick={() => void archiveTask(action.id, activeProjectId)}
      >
        <Archive size={14} /> 归档行动
      </button>
      <button
        type="button"
        className="detail-panel__delete"
        onClick={() => void deleteTask(action.id, activeProjectId)}
      >
        <Trash2 size={14} /> 彻底删除
      </button>
    </aside>
  );
}
