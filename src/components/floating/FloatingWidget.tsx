import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, ExternalLink } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { TodaySnapshot } from "../../types";
import * as api from "../../api/tauri";
import "./FloatingWidget.css";

export function FloatingWidget() {
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.getTodaySnapshot().then(setSnapshot);
    const unsubs: Promise<() => void>[] = [];
    unsubs.push(listen<TodaySnapshot>("today-updated", (e) => setSnapshot(e.payload)));
    unsubs.push(
      listen("floating-focus-input", () => {
        void resize(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }),
    );
    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
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
    if (!active) return;
    const result = await api.completeTask(active.task.id, active.projectId);
    const updated = await api.getTodaySnapshot();
    setSnapshot(updated);
    if (result.recommendations.length > 0 && !expanded) {
      void resize(true);
    }
  };

  const addTask = async () => {
    const projectId = snapshot?.schedule[0]?.projectId ?? snapshot?.activeTask?.projectId;
    if (!projectId || !title.trim()) return;
    await api.createTask(projectId, title.trim());
    setTitle("");
    const updated = await api.getTodaySnapshot();
    setSnapshot(updated);
  };

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, textarea, a")) return;
    void getCurrentWindow().startDragging();
  };

  if (!expanded) {
    return (
      <div
        className="floating floating--collapsed"
        data-tauri-drag-region
        onMouseDown={onBackgroundMouseDown}
      >
        <span className="floating__task-name">{active?.task.title ?? "选择任务…"}</span>
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
    <div
      className="floating floating--expanded"
      data-tauri-drag-region
      onMouseDown={onBackgroundMouseDown}
    >
      <header className="floating__header">
        <span className="floating__header-title">今日安排</span>
        <div className="floating__header-actions">
          <button type="button" onClick={() => void api.showMainWindow()} title="打开主窗口">
            <ExternalLink size={14} />
          </button>
          <button type="button" className="floating__collapse" onClick={() => void resize(false)}>
            —
          </button>
        </div>
      </header>

      <section className="floating__section">
        <h4>当前</h4>
        {active ? (
          <>
            <div className="floating__current-title">{active.task.title}</div>
            {active.branchName && (
              <span className="floating__branch">
                {active.projectName} · {active.branchName}
              </span>
            )}
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
            onClick={() =>
              void api.activateTask(
                topRec.task.id,
                topRec.projectId ?? topRec.task.projectId,
              )
            }
          >
            开始
          </button>
        </section>
      )}

      <section className="floating__section">
        <h4>队列</h4>
        <div className="floating__ready-list">
          {snapshot?.schedule.slice(0, 5).map((item) => (
            <button
              key={item.task.id}
              type="button"
              onClick={() => void api.activateTask(item.task.id, item.projectId)}
            >
              {item.task.title}
            </button>
          ))}
        </div>
      </section>

      <footer className="floating__footer">
        <input
          ref={inputRef}
          placeholder="快速添加…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addTask();
          }}
        />
      </footer>
    </div>
  );
}
