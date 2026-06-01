import type { TodaySnapshot } from "../../types";

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export function TodayHeader({ snapshot }: { snapshot: TodaySnapshot }) {
  const { timeBudget } = snapshot;
  const now = new Date();
  const dateStr = now.toLocaleDateString("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const overBudget = timeBudget.remainingMinutes > timeBudget.availableMinutes;

  return (
    <header className="today-header">
      <div>
        <h1 className="today-header__title">今日安排</h1>
        <span className="today-header__date">{dateStr}</span>
      </div>
      <div className={`today-header__budget ${overBudget ? "today-header__budget--over" : ""}`}>
        <span>
          剩余 {formatMinutes(timeBudget.remainingMinutes)} / 可用{" "}
          {formatMinutes(timeBudget.availableMinutes)}
        </span>
        <div className="today-header__bar">
          <div
            className="today-header__bar-fill"
            style={{
              width: `${Math.min(100, (timeBudget.remainingMinutes / Math.max(timeBudget.availableMinutes, 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </header>
  );
}
