import { Check, Play } from "lucide-react";

import type { DayRunwaySnapshot, TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { formatMinutesTotal } from "./taskBlockUtils";

function findFirstClaimable(snapshot: DayRunwaySnapshot): {
  ctx: TodayTaskContext;
  laneId: string;
} | null {
  for (const lane of snapshot.lanes) {
    const ready = lane.tasks.find((t) => t.task.status === "ready");
    if (ready) return { ctx: ready, laneId: lane.lane.id };
  }
  return null;
}

function findActiveTasks(snapshot: DayRunwaySnapshot): Array<{
  ctx: TodayTaskContext;
  laneId: string;
  laneName: string;
}> {
  const result: Array<{ ctx: TodayTaskContext; laneId: string; laneName: string }> = [];
  for (const lane of snapshot.lanes) {
    const active = lane.tasks.find((t) => t.task.status === "active");
    if (active) {
      result.push({ ctx: active, laneId: lane.lane.id, laneName: lane.lane.name });
    }
  }
  return result;
}

export function NowStrip({ snapshot }: { snapshot: DayRunwaySnapshot }) {
  const claimTask = useAppStore((s) => s.claimTask);
  const completeTask = useAppStore((s) => s.completeTask);

  const actives = findActiveTasks(snapshot);
  const claimable = findFirstClaimable(snapshot);
  const primary = actives[0];
  const finishTime = snapshot.timeBudget.estimatedFinishTime;

  if (primary) {
    const est = primary.ctx.task.estimatedMinutes ?? 30;
    const meta = [primary.ctx.projectName, primary.ctx.branchName, `${est}m`]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className="now-strip now-strip--active">
        <div className="now-strip__main">
          <span className="now-strip__label">进行中</span>
          <span className="now-strip__title">{primary.ctx.task.title}</span>
          <span className="now-strip__meta">{meta}</span>
          {actives.length > 1 && (
            <span className="now-strip__extra">另有 {actives.length - 1} 条泳道进行中</span>
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
          {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
        </div>
      </div>
    );
  }

  if (claimable) {
    const est = claimable.ctx.task.estimatedMinutes ?? 30;
    return (
      <div className="now-strip now-strip--claimable">
        <div className="now-strip__main">
          <span className="now-strip__label">下一项</span>
          <span className="now-strip__title">{claimable.ctx.task.title}</span>
          <span className="now-strip__meta">{est}m</span>
        </div>
        <div className="now-strip__actions">
          <button
            type="button"
            className="now-strip__claim"
            onClick={() =>
              void claimTask(claimable.ctx.task.id, claimable.laneId, claimable.ctx.projectId)
            }
          >
            <Play size={14} /> 领取
          </button>
          {finishTime && <span className="now-strip__finish">预计 {finishTime} 收工</span>}
        </div>
      </div>
    );
  }

  const allPending =
    snapshot.lanes.every((l) => l.tasks.every((t) => t.task.status === "pending")) &&
    snapshot.backlog.every((t) => t.task.status === "pending") &&
    snapshot.lanes.some((l) => l.tasks.length > 0);

  if (allPending || snapshot.backlog.some((t) => t.task.status === "pending")) {
    const pendingCount =
      snapshot.lanes.reduce(
        (n, l) => n + l.tasks.filter((t) => t.task.status === "pending").length,
        0,
      ) + snapshot.backlog.filter((t) => t.task.status === "pending").length;
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
          {pendingCount} 项等待依赖解锁
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
