import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Pause, Play } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { DayRunwaySnapshot, TodayTaskContext } from "../../types";
import * as api from "../../api/tauri";
import {
  findFirstClaimable,
  isFocusActive,
  isExternalActive,
} from "../runway/runwayTaskUtils";
import { formatMinutesTotal } from "../runway/taskBlockUtils";
import "./FloatingWidget.css";

function focusActiveTasks(snapshot: DayRunwaySnapshot | null): TodayTaskContext[] {
  if (!snapshot) return [];
  return snapshot.lanes.flatMap((l) => l.tasks.filter((t) => isFocusActive(t)));
}

type LaneState = "active" | "review" | "claimable" | "external" | "idle";

function laneState(
  lane: DayRunwaySnapshot["lanes"][0],
  claimableTaskId: string | null,
): { state: LaneState; task: TodayTaskContext | null } {
  const focusActive = lane.tasks.find((t) => isFocusActive(t));
  if (focusActive) return { state: "active", task: focusActive };

  const review = lane.tasks.find((t) => t.task.externalStatus === "needs_review");
  if (review) return { state: "review", task: review };

  const external = lane.tasks.find(
    (t) => isExternalActive(t) && t.task.externalStatus === "delegated",
  );
  if (external) return { state: "external", task: external };

  const claimable = lane.tasks.find(
    (t) => t.task.status === "ready" && t.task.id === claimableTaskId,
  );
  if (claimable) return { state: "claimable", task: claimable };

  return { state: "idle", task: null };
}

const STATE_LABEL: Record<LaneState, string> = {
  active: "进行中",
  review: "待审核",
  claimable: "可领取",
  external: "外部执行",
  idle: "空闲",
};

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
      await win.setSize(new LogicalSize(280, 52));
    }
  };

  const actives = focusActiveTasks(snapshot);
  const primary = actives[0];
  const primaryLane = snapshot?.lanes.find((l) =>
    l.tasks.some((t) => primary && t.task.id === primary.task.id),
  );
  const claimable = snapshot ? findFirstClaimable(snapshot) : null;
  const claimableTaskId = claimable?.ctx.task.id ?? null;
  const needsReviewCount =
    snapshot?.lanes
      .flatMap((l) => l.tasks)
      .filter((t) => t.task.externalStatus === "needs_review").length ?? 0;

  const dateStr = snapshot
    ? new Date(snapshot.date + "T12:00:00").toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "";
  const finishHint = snapshot?.timeBudget.estimatedFinishTime
    ? `预计 ${snapshot.timeBudget.estimatedFinishTime} 收工`
    : null;

  const complete = async (ctx: TodayTaskContext) => {
    await api.completeTask(ctx.task.id, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
    if (!expanded) void resize(true);
  };

  const pause = async (ctx: TodayTaskContext) => {
    await api.setTaskStatus(ctx.projectId, ctx.task.id, "ready");
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const claim = async (taskId: string, laneId: string, projectId: string) => {
    await api.claimTask(taskId, laneId, projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const markExternalDone = async (ctx: TodayTaskContext) => {
    await api.completeExternalTask(ctx.task.id, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const addTask = async () => {
    const projectId =
      snapshot?.lanes[0]?.tasks[0]?.projectId ??
      snapshot?.lanes.find((l) => l.tasks[0])?.tasks[0]?.projectId ??
      primary?.projectId;
    if (!projectId || !title.trim()) return;
    await api.createTask(projectId, title.trim());
    setTitle("");
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, textarea, a, select")) return;
    void getCurrentWindow().startDragging();
  };

  if (!expanded) {
    const label = primary?.task.title ?? claimable?.ctx.task.title ?? "选择任务…";
    const laneName = primaryLane?.lane.name ?? claimable?.laneId
      ? snapshot?.lanes.find((l) => l.lane.id === claimable?.laneId)?.lane.name
      : undefined;
    const dotClass = primary
      ? "floating__dot--active"
      : claimable
        ? "floating__dot--claimable"
        : needsReviewCount > 0
          ? "floating__dot--review"
          : "floating__dot--idle";

    return (
      <div
        className="floating floating--collapsed"
        data-tauri-drag-region
        onMouseDown={onBackgroundMouseDown}
      >
        <span className={`floating__dot ${dotClass}`} />
        <div className="floating__collapsed-main">
          <span className="floating__task-name">{label}</span>
          {laneName && <span className="floating__lane-name">{laneName}</span>}
        </div>
        {needsReviewCount > 0 && (
          <span className="floating__badge">{needsReviewCount}</span>
        )}
        {primary && (
          <button type="button" className="floating__icon-btn floating__icon-btn--done" onClick={() => void complete(primary)}>
            <Check size={14} />
          </button>
        )}
        {!primary && claimable && (
          <button
            type="button"
            className="floating__icon-btn floating__icon-btn--claim"
            onClick={() =>
              void claim(claimable.ctx.task.id, claimable.laneId, claimable.ctx.projectId)
            }
          >
            <Play size={14} />
          </button>
        )}
        <button type="button" className="floating__icon-btn" onClick={() => void resize(true)}>
          <ChevronDown size={14} />
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
        <div className="floating__header-meta">
          <span>{dateStr}</span>
          {finishHint && <span className="floating__header-budget">{finishHint}</span>}
          {snapshot?.timeBudget.remainingMinutes != null && snapshot.timeBudget.remainingMinutes > 0 && (
            <span className="floating__header-budget">
              剩余 {formatMinutesTotal(snapshot.timeBudget.remainingMinutes)}
            </span>
          )}
        </div>
        <div className="floating__header-actions">
          <button type="button" onClick={() => void api.showMainWindow()} title="打开主窗口">
            <ExternalLink size={14} />
          </button>
          <button type="button" className="floating__collapse" onClick={() => void resize(false)}>
            —
          </button>
        </div>
      </header>

      <div className="floating__lanes">
        {snapshot?.lanes.map((lane) => {
          const { state, task } = laneState(lane, claimableTaskId);
          const isWatch = lane.lane.laneType === "watch";
          return (
            <section
              key={lane.lane.id}
              className={`floating__lane floating__lane--${isWatch ? "watch" : "focus"} floating__lane--${state}`}
            >
              <div className="floating__lane-header">
                <span className="floating__lane-name">{lane.lane.name}</span>
                <span className="floating__lane-state">{STATE_LABEL[state]}</span>
              </div>
              {task ? (
                <div className="floating__lane-row">
                  <span className="floating__lane-task">{task.task.title}</span>
                  {state === "active" && (
                    <div className="floating__lane-actions">
                      <button type="button" className="floating__cta" onClick={() => void complete(task)}>
                        完成
                      </button>
                      <button type="button" className="floating__cta floating__cta--ghost" onClick={() => void pause(task)}>
                        <Pause size={12} />
                      </button>
                    </div>
                  )}
                  {state === "claimable" && (
                    <button
                      type="button"
                      className="floating__cta floating__cta--claim"
                      onClick={() => void claim(task.task.id, lane.lane.id, task.projectId)}
                    >
                      领取
                    </button>
                  )}
                  {state === "external" && (
                    <button type="button" className="floating__cta floating__cta--ghost" onClick={() => void markExternalDone(task)}>
                      标记完成
                    </button>
                  )}
                  {state === "review" && (
                    <button type="button" className="floating__cta floating__cta--review" onClick={() => void api.showMainWindow()}>
                      审核
                    </button>
                  )}
                </div>
              ) : (
                <p className="floating__lane-empty">暂无任务</p>
              )}
            </section>
          );
        })}
      </div>

      {snapshot && snapshot.lanes.length === 0 && (
        <p className="floating__lane-empty floating__lane-empty--page">暂无泳道</p>
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
