import { useEffect, useRef, useState } from "react";
import { Archive, ChevronDown, ChevronUp, Inbox } from "lucide-react";

import * as api from "../../api/tauri";
import { useAppStore } from "../../store/appStore";
import "./InboxPanel.css";

export function InboxPanel() {
  const graph = useAppStore((s) => s.graph);
  const inboxOpen = useAppStore((s) => s.inboxOpen);
  const toggleInbox = useAppStore((s) => s.toggleInbox);
  const addInboxTask = useAppStore((s) => s.addInboxTask);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [title, setTitle] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assigningId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (itemRefs.current.get(assigningId)?.contains(target)) return;
      setAssigningId(null);
      setPopoverPos(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [assigningId]);

  if (!graph) return null;

  const inboxTasks = graph.tasks.filter((t) => t.status === "inbox");

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addInboxTask(value);
    setTitle("");
  };

  const assignToBranch = async (taskId: string, branchId: string) => {
    await api.assignTaskToBranch(taskId, branchId);
    await refreshAll();
    setAssigningId(null);
    setPopoverPos(null);
  };

  const openAssign = (taskId: string) => {
    if (assigningId === taskId) {
      setAssigningId(null);
      setPopoverPos(null);
      return;
    }
    const el = itemRefs.current.get(taskId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: rect.left });
    }
    setAssigningId(taskId);
  };

  return (
    <section className={`inbox-panel ${inboxOpen ? "inbox-panel--open" : ""}`}>
      <button type="button" className="inbox-panel__toggle" onClick={toggleInbox}>
        <Inbox size={14} />
        <span>Inbox</span>
        {inboxTasks.length > 0 && <span className="inbox-panel__count">{inboxTasks.length}</span>}
        <span className="inbox-panel__chevron">
          {inboxOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>

      {inboxOpen && (
        <div className="inbox-panel__body">
          <div className="inbox-panel__input-row">
            <input
              placeholder="输入任务名，Enter 创建…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>
          <div className="inbox-panel__list">
            {inboxTasks.length === 0 ? (
              <p className="inbox-panel__empty">Inbox 为空 — 随时 capture 碎片任务</p>
            ) : (
              inboxTasks.map((task) => (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(task.id, el);
                    else itemRefs.current.delete(task.id);
                  }}
                  className={`inbox-panel__item ${assigningId === task.id ? "inbox-panel__item--active" : ""}`}
                >
                  <button
                    type="button"
                    className="inbox-panel__item-title"
                    onClick={() => openAssign(task.id)}
                  >
                    {task.title}
                  </button>
                  {activeProjectId && (
                    <button
                      type="button"
                      className="inbox-panel__archive"
                      title="归档"
                      onClick={() => void archiveTask(task.id, activeProjectId)}
                    >
                      <Archive size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {assigningId && popoverPos && (
        <div
          ref={popoverRef}
          className="inbox-panel__popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <p className="inbox-panel__popover-label">分配到支线</p>
          {graph.branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => void assignToBranch(assigningId, branch.id)}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
