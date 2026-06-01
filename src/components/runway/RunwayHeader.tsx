import type { DayRunwaySnapshot } from "../../types";
import { FocusHealthIndicator } from "./FocusHealthIndicator";
import { formatMinutesTotal } from "./taskBlockUtils";

export function RunwayHeader({
  snapshot,
  onAddLane,
}: {
  snapshot: DayRunwaySnapshot;
  onAddLane: () => void;
}) {
  const { timeBudget } = snapshot;
  const pct = timeBudget.availableMinutes
    ? Math.min(100, (timeBudget.remainingMinutes / timeBudget.availableMinutes) * 100)
    : 0;
  const over = timeBudget.remainingMinutes > timeBudget.availableMinutes;
  const dateStr = new Date(snapshot.date + "T12:00:00").toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const forecast = timeBudget.estimatedFinishTime
    ? `预计 ${timeBudget.estimatedFinishTime} 收工`
    : "暂无剩余任务";
  const remaining = `剩余 ${formatMinutesTotal(timeBudget.remainingMinutes)}`;

  return (
    <header className="runway-header">
      <div className="runway-header__top">
        <div>
          <h1 className="runway-header__title">今日安排</h1>
          <span className="runway-header__date">{dateStr}</span>
        </div>
        <FocusHealthIndicator focusLaneCount={snapshot.focusLaneCount} />
        <div className={`runway-header__budget${over ? " runway-header__budget--over" : ""}`}>
          {forecast} · {remaining}
          {over && ` · 超出 ${formatMinutesTotal(timeBudget.remainingMinutes - timeBudget.availableMinutes)}`}
        </div>
        <button type="button" className="runway-header__add-lane" onClick={onAddLane}>
          + 泳道
        </button>
      </div>
      <div className={`runway-header__bar${over ? " runway-header__bar--over" : ""}`}>
        <div className="runway-header__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}
