import type { TimeBudget } from "../../types";

export function DaySummary({ budget }: { budget: TimeBudget }) {
  return (
    <footer className="day-summary">
      今日已完成 {budget.completedCount} 项 · 剩余 {budget.remainingCount} 项
      {budget.estimatedFinishTime && (
        <> · 预计 {budget.estimatedFinishTime} 完成</>
      )}
    </footer>
  );
}
