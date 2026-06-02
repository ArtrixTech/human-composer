import { AlertCircle, Bot, Check, Clock, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";

import type { DayRunwaySnapshot, TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { ExternalTaskDialog } from "./ExternalTaskDialog";
import { formatMinutesTotal } from "./taskBlockUtils";
import {
  findFocusActives,
  findNeedsReview,
  findFirstClaimable,
  findWatchTasks,
} from "./runwayTaskUtils";

export function NowStrip({ snapshot }: { snapshot: DayRunwaySnapshot }) {
  const claimTask = useAppStore((s) => s.claimTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const completeExternal = useAppStore((s) => s.completeExternal);
  const reviewExternal = useAppStore((s) => s.reviewExternal);
  const [delegateTarget, setDelegateTarget] = useState<{
    ctx: TodayTaskContext;
    laneId: string;
  } | null>(null);

  const focusActives = findFocusActives(snapshot);
  const needsReview = findNeedsReview(snapshot);
  const claimable = findFirstClaimable(snapshot);
  const watchRunning = findWatchTasks(snapshot).filter(
    (lc) => lc.ctx.task.externalStatus === "delegated",
  );
  const finishTime = snapshot.timeBudget.estimatedFinishTime;

  // ── Priority 1: needs-review ──────────────────────────────────────────────
  if (needsReview.length > 0) {
    const first = needsReview[0];
    const others = needsReview.length - 1;
    return (
      <>
        <div className="now-strip now-strip--review">
          <div className="now-strip__main">
            <AlertCircle size={14} className="now-strip__review-icon" />
            <span className="now-strip__label">待审核</span>
            <span className="now-strip__title">{first.ctx.task.title}</span>
            {others > 0 && (
              <span className="now-strip__extra">另有 {others} 项待审核</span>
            )}
          </div>
          <div className="now-strip__actions">
            <button
              type="button"
              className="now-strip__approve"
              onClick={() => void reviewExternal(first.ctx.task.id, first.ctx.projectId, "done")}
            >
              <Check size={14} /> 通过
            </button>
            <button
              type="button"
              className="now-strip__rework"
              onClick={() => void reviewExternal(first.ctx.task.id, first.ctx.projectId, "rework")}
            >
              <RotateCcw size={14} /> 返工
            </button>
            {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
          </div>
        </div>
      </>
    );
  }

  // ── Priority 2: focus-active ──────────────────────────────────────────────
  if (focusActives.length > 0) {
    const primary = focusActives[0];
    const est = primary.ctx.task.estimatedMinutes ?? 30;
    const meta = [primary.ctx.projectName, primary.ctx.branchName, `${est}m`]
      .filter(Boolean)
      .join(" · ");
    const canDelegate =
      primary.ctx.task.taskType === "normal" && primary.ctx.task.externalStatus == null;
    const others = focusActives.length - 1;

    return (
      <>
        <div className="now-strip now-strip--active">
          <div className="now-strip__main">
            <span className="now-strip__label">进行中</span>
            <span className="now-strip__title">{primary.ctx.task.title}</span>
            <span className="now-strip__meta">{meta}</span>
            {others > 0 && (
              <span className="now-strip__extra">另有 {others} 条泳道进行中</span>
            )}
          </div>
          <div className="now-strip__actions">
            <button
              type="button"
              className="now-strip__complete"
              onClick={() => void completeTask(primary.ctx.task.id, primary.ctx.projectId, primary.laneId)}
            >
              <Check size={14} /> 完成
            </button>
            <button
              type="button"
              className="now-strip__pause"
              aria-label="暂停"
              onClick={() => void pauseTask(primary.ctx.task.id, primary.ctx.projectId)}
            >
              <Pause size={14} />
            </button>
            {canDelegate && (
              <button
                type="button"
                className="now-strip__delegate"
                onClick={() => setDelegateTarget({ ctx: primary.ctx, laneId: primary.laneId })}
              >
                <Bot size={14} /> 委派
              </button>
            )}
            {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
          </div>
        </div>
        {delegateTarget && (
          <ExternalTaskDialog
            ctx={delegateTarget.ctx}
            laneId={delegateTarget.laneId}
            onClose={() => setDelegateTarget(null)}
          />
        )}
      </>
    );
  }

  // ── Priority 3: claimable ─────────────────────────────────────────────────
  if (claimable) {
    const est = claimable.ctx.task.estimatedMinutes ?? 30;
    const watchCount = watchRunning.length;
    return (
      <div className="now-strip now-strip--claimable">
        <div className="now-strip__main">
          <span className="now-strip__label">下一项</span>
          <span className="now-strip__title">{claimable.ctx.task.title}</span>
          <span className="now-strip__meta">{est}m</span>
          {watchCount > 0 && (
            <span className="now-strip__extra">
              <Clock size={11} /> {watchCount} 项外部运行中
            </span>
          )}
        </div>
        <div className="now-strip__actions">
          <button
            type="button"
            className="now-strip__claim"
            onClick={() => void claimTask(claimable.ctx.task.id, claimable.laneId, claimable.ctx.projectId)}
          >
            <Play size={14} /> 领取
          </button>
          {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
        </div>
      </div>
    );
  }

  // ── Priority 4: only watch running (no claimable focus task) ─────────────
  if (watchRunning.length > 0) {
    return (
      <div className="now-strip now-strip--watch">
        <div className="now-strip__main">
          <Clock size={14} />
          <span className="now-strip__title">
            {watchRunning.length} 项外部任务执行中
          </span>
          <span className="now-strip__hint">可启动新泳道并领取下一项任务</span>
        </div>
        <div className="now-strip__actions">
          {watchRunning[0] && (
            <button
              type="button"
              className="now-strip__mark-done"
              onClick={() =>
                void completeExternal(
                  watchRunning[0].ctx.task.id,
                  watchRunning[0].ctx.projectId,
                )
              }
            >
              标记完成
            </button>
          )}
          {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
        </div>
      </div>
    );
  }

  // ── Priority 5: all pending / idle ────────────────────────────────────────
  const allPendingCount =
    snapshot.lanes.reduce(
      (n, l) => n + l.tasks.filter((t) => t.task.status === "pending").length,
      0,
    ) + snapshot.backlog.filter((t) => t.task.status === "pending").length;

  if (allPendingCount > 0) {
    const pendingMinutes =
      snapshot.lanes.reduce(
        (sum, l) =>
          sum +
          l.tasks
            .filter((t) => t.task.status === "pending")
            .reduce((s, t) => s + (t.task.estimatedMinutes ?? 30), 0),
        0,
      ) +
      snapshot.backlog
        .filter((t) => t.task.status === "pending")
        .reduce((sum, t) => sum + (t.task.estimatedMinutes ?? 30), 0);

    return (
      <div className="now-strip now-strip--pending">
        <span className="now-strip__title">
          {allPendingCount} 项等待依赖解锁
          {pendingMinutes > 0 ? ` · 管线约 ${formatMinutesTotal(pendingMinutes)}` : ""}
        </span>
        <span className="now-strip__hint">查看下方泳道管线了解任务关系</span>
      </div>
    );
  }

  if (finishTime) {
    return (
      <div className="now-strip now-strip--idle">
        <span className="now-strip__title">暂无进行中任务</span>
        <span className="now-strip__finish">预计 {finishTime} 收工</span>
      </div>
    );
  }

  return null;
}
