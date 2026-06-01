import { useState } from "react";
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./InboxPanel.css";

export function InboxPanel() {
  const graph = useAppStore((s) => s.graph);
  const inboxOpen = useAppStore((s) => s.inboxOpen);
  const toggleInbox = useAppStore((s) => s.toggleInbox);
  const addInboxTask = useAppStore((s) => s.addInboxTask);
  const assignInboxTask = useAppStore((s) => s.assignInboxTask);
  const [title, setTitle] = useState("");

  if (!graph) return null;

  const inboxTasks = graph.tasks.filter((t) => t.status === "inbox");

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addInboxTask(value);
    setTitle("");
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
                <div key={task.id} className="inbox-panel__item" draggable>
                  <span>{task.title}</span>
                  <div className="inbox-panel__assign">
                    {graph.branches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => void assignInboxTask(task.id, branch.id)}
                      >
                        → {branch.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
