import { ArrowDownUp, Check, CheckCircle2, ChevronDown, Clock, Palette, Play } from "lucide-react";
import { LANE_TIER_LABELS, LANE_TIER_ORDER } from "../../utils/laneTierUtils";
import { useState, type ReactNode } from "react";

import type { DayRunwaySnapshot } from "../../types";
import { useAppStore } from "../../store/appStore";
import { CompletedBar } from "./CompletedBar";
import { formatMinutesTotal } from "./taskBlockUtils";
import {
  findFocusActives,
  findNeedsReview,
  findFirstClaimable,
  findWatchTasks,
} from "./runwayTaskUtils";

export function RunwayHeader({
  snapshot,
  onAddLane,
}: {
  snapshot: DayRunwaySnapshot;
  onAddLane: () => void;
}) {
  const claimTask = useAppStore((s) => s.claimTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const postponeTask = useAppStore((s) => s.postponeTask);
  const completeExternal = useAppStore((s) => s.completeExternal);
  const laneColorsEnabled = useAppStore((s) => s.laneColorsEnabled);
  const toggleLaneColors = useAppStore((s) => s.toggleLaneColors);
  const reviewExternal = useAppStore((s) => s.reviewExternal);
  const setEnabledLaneCount = useAppStore((s) => s.setEnabledLaneCount);
  const reorganizeRunway = useAppStore((s) => s.reorganizeRunway);
  const enabledLaneCount = snapshot.enabledLaneCount ?? 3;

  const [showCompleted, setShowCompleted] = useState(false);

  const { timeBudget } = snapshot;
  const over = timeBudget.remainingMinutes > timeBudget.availableMinutes;
  const dateStr = new Date(snapshot.date + "T12:00:00").toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  const forecast = timeBudget.estimatedFinishTime
    ? `预计 ${timeBudget.estimatedFinishTime} 收工`
    : "暂无剩余";
  const remaining = `剩余 ${formatMinutesTotal(timeBudget.remainingMinutes)}`;

  const focusActives = findFocusActives(snapshot);
  const needsReview = findNeedsReview(snapshot);
  const claimable = findFirstClaimable(snapshot);
  const watchRunning = findWatchTasks(snapshot).filter(
    (lc) => lc.ctx.action.externalStatus === "delegated",
  );

  let nowVariant = "idle";
  let nowTitle = "暂无进行中";
  let nowActions: ReactNode = null;

  if (needsReview.length > 0) {
    const first = needsReview[0];
    nowVariant = "review";
    nowTitle = first.ctx.action.title;
    nowActions = (
      <button
        type="button"
        className="runway-header__cta"
        onClick={() => void reviewExternal(first.ctx.action.id, first.ctx.projectId, "done")}
      >
        <Check size={12} /> 通过
      </button>
    );
  } else if (focusActives.length > 0) {
    const primary = focusActives[0];
    nowVariant = "active";
    nowTitle = primary.ctx.action.title;
    nowActions = (
      <>
        <button
          type="button"
          className="runway-header__cta"
          onClick={() =>
            void completeTask(primary.ctx.action.id, primary.ctx.projectId, primary.laneId)
          }
        >
          <Check size={12} /> 完成
        </button>
        <button
          type="button"
          className="runway-header__cta runway-header__cta--ghost"
          title="稍后再做，先做泳道里其他行动"
          onClick={() =>
            void postponeTask(primary.ctx.action.id, primary.laneId, primary.ctx.projectId)
          }
        >
          <Clock size={12} /> 稍后
        </button>
      </>
    );
  } else if (claimable) {
    nowVariant = "claimable";
    nowTitle = claimable.ctx.action.title;
    nowActions = (
      <button
        type="button"
        className="runway-header__cta"
        onClick={() =>
          void claimTask(claimable.ctx.action.id, claimable.laneId, claimable.ctx.projectId)
        }
      >
        <Play size={12} /> 领取
      </button>
    );
  } else if (watchRunning.length > 0) {
    nowVariant = "watch";
    nowTitle = watchRunning[0].ctx.action.title;
    nowActions = (
      <button
        type="button"
        className="runway-header__cta runway-header__cta--muted"
        onClick={() =>
          void completeExternal(watchRunning[0].ctx.action.id, watchRunning[0].ctx.projectId)
        }
      >
        标记完成
      </button>
    );
  } else {
    const allPendingCount = snapshot.lanes.reduce(
      (n, l) => n + l.actions.filter((t) => t.action.status === "pending").length,
      0,
    );
    if (allPendingCount > 0) {
      const pendingMinutes = snapshot.lanes.reduce(
        (sum, l) =>
          sum +
          l.actions
            .filter((t) => t.action.status === "pending")
            .reduce((s, t) => s + (t.action.estimatedMinutes ?? 30), 0),
        0,
      );
      nowVariant = "pending";
      nowTitle = `${allPendingCount} 项等待依赖${pendingMinutes > 0 ? ` · ~${formatMinutesTotal(pendingMinutes)}` : ""}`;
    }
  }

  const completedCount = snapshot.completedToday.length;

  return (
    <header className="runway-header">
      <div className="runway-header__toolbar">
        <div className="runway-header__left">
          <span className="runway-header__date">{dateStr}</span>
          {snapshot.focusLaneCount >= 3 && (
            <span className="runway-header__heavy">高负荷</span>
          )}
          {snapshot.carryOverCount > 0 && (
            <span className="runway-header__carry" title="昨日未完成，已保留在今日泳道">
              昨日 {snapshot.carryOverCount}
            </span>
          )}
        </div>

        <div className={`runway-header__now runway-header__now--${nowVariant}`}>
          <span className={`runway-header__now-dot runway-header__now-dot--${nowVariant}`} />
          <span className="runway-header__now-title">{nowTitle}</span>
          {nowActions && <div className="runway-header__now-actions">{nowActions}</div>}
        </div>

        <div className="runway-header__right">
          <div className="runway-header__lane-count" role="group" aria-label="启用泳道数量">
            {LANE_TIER_ORDER.map((tier, index) => {
              const count = index + 1;
              const active = enabledLaneCount === count;
              return (
                <button
                  key={tier}
                  type="button"
                  className={`runway-header__lane-count-btn${active ? " runway-header__lane-count-btn--active" : ""}`}
                  title={`启用 ${count} 条泳道（至${LANE_TIER_LABELS[tier]}）`}
                  aria-pressed={active}
                  onClick={() => void setEnabledLaneCount(count)}
                >
                  {count}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="runway-header__organize"
            title="按优先级重新分配泳道中的行动"
            onClick={() => void reorganizeRunway()}
          >
            <ArrowDownUp size={12} />
            整理
          </button>
          <span className={`runway-header__budget${over ? " runway-header__budget--over" : ""}`}>
            {forecast} · {remaining}
            {over &&
              ` · 超 ${formatMinutesTotal(timeBudget.remainingMinutes - timeBudget.availableMinutes)}`}
          </span>
          {completedCount > 0 && (
            <button
              type="button"
              className="runway-header__completed-toggle"
              onClick={() => setShowCompleted(!showCompleted)}
              aria-expanded={showCompleted}
            >
              <CheckCircle2 size={12} />
              {completedCount}
              <ChevronDown
                size={12}
                className={showCompleted ? "runway-header__chevron--open" : ""}
              />
            </button>
          )}
          <button
            type="button"
            className={`runway-header__lane-colors${laneColorsEnabled ? " runway-header__lane-colors--on" : ""}`}
            onClick={toggleLaneColors}
            title={laneColorsEnabled ? "关闭泳道配色" : "开启泳道配色"}
            aria-pressed={laneColorsEnabled}
          >
            <Palette size={12} />
          </button>
          <button type="button" className="runway-header__add-lane" onClick={onAddLane}>
            + 泳道
          </button>
        </div>
      </div>
      {showCompleted && <CompletedBar completed={snapshot.completedToday} listOnly />}
    </header>
  );
}
