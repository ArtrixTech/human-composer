import { useState } from "react";
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";

import * as api from "../../api/tauri";
import { useAppStore } from "../../store/appStore";
import "./InboxPanel.css";

export function InboxPanel() {
  const graph = useAppStore((s) => s.graph);
  const inboxOpen = useAppStore((s) => s.inboxOpen);
  const toggleInbox = useAppStore((s) => s.toggleInbox);
  const addInboxTask = useAppStore((s) => s.addInboxTask);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const [title, setTitle] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
  };

  return (
    <section className={`inbox-panel ${inboxOpen ? "inbox-panel--open" : ""}`}>
      <button type="button" className="inbox-panel__toggle" onClick={toggleInbox}>
        <Inbox size={14} />
        <span>Inbox</span>
        <span className="inbox-panel__count">{inboxTasks.length}</span>
        {inboxOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
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
                <div key={task.id} className="inbox-panel__item">
                  <button
                    type="button"
                    className="inbox-panel__item-title"
                    onClick={() => setAssigningId(assigningId === task.id ? null : task.id)}
                  >
                    {task.title}
                  </button>
                  {assigningId === task.id && (
                    <div className="inbox-panel__dropdown">
                      {graph.branches.map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => void assignToBranch(task.id, branch.id)}
                        >
                          → {branch.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
