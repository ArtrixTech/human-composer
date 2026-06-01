import "./TodayView.css";

import { useAppStore } from "../../store/appStore";
import { ActiveTaskCard } from "./ActiveTaskCard";
import { DaySummary } from "./DaySummary";
import { ScheduleList } from "./ScheduleList";
import { TodayHeader } from "./TodayHeader";

export function TodayView() {
  const todaySnapshot = useAppStore((s) => s.todaySnapshot);
  const loading = useAppStore((s) => s.loading);

  if (loading && !todaySnapshot) {
    return <div className="today-view today-view--loading">加载今日安排…</div>;
  }

  if (!todaySnapshot) {
    return (
      <div className="today-view today-view--empty">
        <p>暂无任务 — 创建项目并添加任务后即可在此查看今日安排</p>
      </div>
    );
  }

  return (
    <div className="today-view">
      <TodayHeader snapshot={todaySnapshot} />
      <ActiveTaskCard active={todaySnapshot.activeTask} />
      <ScheduleList items={todaySnapshot.schedule} />
      <DaySummary budget={todaySnapshot.timeBudget} />
      {todaySnapshot.completedToday.length > 0 && (
        <details className="today-completed">
          <summary>今日已完成 ({todaySnapshot.completedToday.length})</summary>
          <ul>
            {todaySnapshot.completedToday.map((item) => (
              <li key={item.task.id}>
                {item.task.title}
                <span className="today-completed__meta">
                  {item.projectName}
                  {item.branchName ? ` · ${item.branchName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
