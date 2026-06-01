import { useEffect, useState } from "react";
import { Check, ChevronUp, ExternalLink } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { AppSnapshot } from "../../types";
import * as api from "../../api/tauri";
import "./FloatingWidget.css";

export function FloatingWidget() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    void api.getAppSnapshot().then(setSnapshot);
    const unlisten = listen<AppSnapshot>("graph-updated", (e) => setSnapshot(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const resize = async (next: boolean) => {
    setExpanded(next);
    const win = getCurrentWindow();
    if (next) {
      await win.setSize(new LogicalSize(320, 400));
    } else {
      await win.setSize(new LogicalSize(220, 52));
    }
  };

  const active = snapshot?.activeTask;
  const topRec = snapshot?.recommendations[0];

  const complete = async () => {
    if (!active || !snapshot) return;
    await api.completeTask(active.task.id, snapshot.projectId);
  };

  const addTask = async () => {
    if (!snapshot || !title.trim()) return;
    await api.createTask(snapshot.projectId, title.trim());
    setTitle("");
  };

  if (!expanded) {
    return (
      <div className="floating floating--collapsed" data-tauri-drag-region>
        <span className="floating__task-name">
          {active?.task.title ?? "选择任务…"}
        </span>
        {active && (
          <button type="button" className="floating__complete" onClick={() => void complete()}>
            <Check size={14} />
          </button>
        )}
        <button type="button" className="floating__expand" onClick={() => void resize(true)}>
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="floating floating--expanded">
      <header className="floating__header" data-tauri-drag-region>
        <span>{snapshot?.projectName}</span>
        <button type="button" onClick={() => void resize(false)}>—</button>
      </header>

      <section className="floating__section">
        <h4>当前</h4>
        {active ? (
          <>
            <div className="floating__current-title">{active.task.title}</div>
            {active.branchName && <span className="floating__branch">{active.branchName}</span>}
            <button type="button" className="floating__cta" onClick={() => void complete()}>
              完成
            </button>
          </>
        ) : (
          <p className="floating__empty">暂无 Active 任务</p>
        )}
      </section>

      {topRec && (
        <section className="floating__section floating__section--rec">
          <h4>推荐</h4>
          <div className="floating__rec-title">{topRec.task.title}</div>
          <button
            type="button"
            className="floating__cta"
            onClick={() => void api.activateTask(topRec.task.id, snapshot!.projectId)}
          >
            开始
          </button>
        </section>
      )}

      <section className="floating__section">
        <h4>Ready</h4>
        <div className="floating__ready-list">
          {snapshot?.readyTasks.slice(0, 5).map((t) => (
            <button
              key={t.task.id}
              type="button"
              onClick={() => void api.activateTask(t.task.id, snapshot!.projectId)}
            >
              {t.task.title}
            </button>
          ))}
        </div>
      </section>

      <footer className="floating__footer">
        <input
          placeholder="快速添加…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addTask();
          }}
        />
        <button type="button" onClick={() => void api.showMainWindow()}>
          <ExternalLink size={14} />
        </button>
      </footer>
    </div>
  );
}
