import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, ExternalLink } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { DayRunwaySnapshot, TodayTaskContext } from "../../types";
import * as api from "../../api/tauri";
import { isFocusActive, isExternalActive } from "../runway/runwayTaskUtils";
import "./FloatingWidget.css";

/** Only tasks the user is actively working on (not externally delegated). */
function focusActiveTasks(snapshot: DayRunwaySnapshot | null): TodayTaskContext[] {
  if (!snapshot) return [];
  return snapshot.lanes.flatMap((l) => l.tasks.filter((t) => isFocusActive(t)));
}

export function FloatingWidget() {
  const [snapshot, setSnapshot] = useState<DayRunwaySnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.getDayRunwaySnapshot().then(setSnapshot);
    const unsubs: Promise<() => void>[] = [];
    unsubs.push(listen<DayRunwaySnapshot>("runway-updated", (e) => setSnapshot(e.payload)));
    unsubs.push(listen<DayRunwaySnapshot>("today-updated", (e) => setSnapshot(e.payload)));
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
      await win.setSize(new LogicalSize(320, 420));
    } else {
      await win.setSize(new LogicalSize(220, 52));
    }
  };

  const actives = focusActiveTasks(snapshot);
  const primary = actives[0];
  const needsReviewCount = snapshot?.lanes
    .flatMap((l) => l.tasks)
    .filter((t) => t.task.externalStatus === "needs_review").length ?? 0;

  const complete = async (ctx: TodayTaskContext) => {
    await api.completeTask(ctx.task.id, ctx.projectId);
    const updated = await api.getDayRunwaySnapshot();
    setSnapshot(updated);
    if (!expanded) void resize(true);
  };

  const markExternalDone = async (ctx: TodayTaskContext) => {
    await api.completeExternalTask(ctx.task.id, ctx.projectId);
    const updated = await api.getDayRunwaySnapshot();
    setSnapshot(updated);
  };

  const addTask = async () => {
    const projectId =
      snapshot?.lanes[0]?.tasks[0]?.projectId ??
      snapshot?.backlog[0]?.projectId ??
      primary?.projectId;
    if (!projectId || !title.trim()) return;
    await api.createTask(projectId, title.trim());
    setTitle("");
    const updated = await api.getDayRunwaySnapshot();
    setSnapshot(updated);
  };

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, textarea, a, select")) return;
    void getCurrentWindow().startDragging();
  };

  const collapsedLabel =
    actives.length > 1
      ? `${actives.length} 泳道进行中`
      : primary?.task.title ?? "选择任务…";

  if (!expanded) {
    return (
      <div
        className="floating floating--collapsed"
        data-tauri-drag-region
        onMouseDown={onBackgroundMouseDown}
      >
        {needsReviewCount > 0 && (
          <span className="floating__badge">{needsReviewCount}</span>
        )}
        <span className="floating__task-name">{collapsedLabel}</span>
        {primary && (
          <button
            type="button"
            className="floating__complete"
            onClick={() => void complete(primary)}
          >
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
        <span className="floating__header-title">
          今日安排
          {needsReviewCount > 0 && (
            <span className="floating__header-badge">{needsReviewCount} 待审核</span>
          )}
        </span>
        <div className="floating__header-actions">
          <button type="button" onClick={() => void api.showMainWindow()} title="打开主窗口">
            <ExternalLink size={14} />
          </button>
          <button type="button" className="floating__collapse" onClick={() => void resize(false)}>
            —
          </button>
        </div>
      </header>

      {snapshot?.lanes.map((lane) => {
        const focusActive = lane.tasks.find((t) => isFocusActive(t));
        const externalRunning = lane.tasks.find(
          (t) => isExternalActive(t) && t.task.externalStatus === "delegated",
        );
        const review = lane.tasks.find((t) => t.task.externalStatus === "needs_review");
        const hasReview = !!review;
        return (
          <section
            key={lane.lane.id}
            className={`floating__section${hasReview ? " floating__section--review" : ""}`}
          >
            <h4>
              {lane.lane.laneType === "watch" ? "⏳" : "🎯"} {lane.lane.name}
              {hasReview && <span className="floating__lane-badge">!</span>}
            </h4>
            {focusActive && (
              <>
                <div className="floating__current-title">{focusActive.task.title}</div>
                <span className="floating__branch">
                  {focusActive.projectName}
                  {focusActive.branchName ? ` · ${focusActive.branchName}` : ""}
                </span>
                <button type="button" className="floating__cta" onClick={() => void complete(focusActive)}>
                  完成
                </button>
              </>
            )}
            {externalRunning && (
              <>
                <div className="floating__current-title">{externalRunning.task.title}</div>
                <span className="floating__branch floating__branch--external">外部执行中</span>
                <button
                  type="button"
                  className="floating__cta floating__cta--external"
                  onClick={() => void markExternalDone(externalRunning)}
                >
                  标记完成
                </button>
              </>
            )}
            {review && !focusActive && !externalRunning && (
              <>
                <div className="floating__current-title">{review.task.title}</div>
                <span className="floating__branch floating__branch--review">待审核</span>
                <button
                  type="button"
                  className="floating__cta floating__cta--review"
                  onClick={() => void api.showMainWindow()}
                >
                  查看审核
                </button>
              </>
            )}
            {!focusActive && !externalRunning && !review && (
              <p className="floating__empty">暂无进行中任务</p>
            )}
          </section>
        );
      })}

      {snapshot && snapshot.lanes.length === 0 && (
        <section className="floating__section">
          <p className="floating__empty">暂无泳道</p>
        </section>
      )}

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
