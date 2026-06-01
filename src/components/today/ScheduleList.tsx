import type { TodayScheduleItem } from "../../types";
import { useAppStore } from "../../store/appStore";

export function ScheduleList({ items }: { items: TodayScheduleItem[] }) {
  const activateTask = useAppStore((s) => s.activateTask);
  const selectProjectView = useAppStore((s) => s.selectProjectView);

  if (items.length === 0) {
    return (
      <section className="schedule-list schedule-list--empty">
        <p>队列已空 — 所有 Ready 任务已完成或暂无待办</p>
      </section>
    );
  }

  return (
    <section className="schedule-list">
      {items.map((item) => (
        <div key={item.task.id} className="schedule-item">
          <div className="schedule-item__time">
            <span>{item.scheduledStart}</span>
            <span className="schedule-item__duration">{item.estimatedMinutes}min</span>
          </div>
          <div className="schedule-item__body">
            <div className="schedule-item__title">{item.task.title}</div>
            <button
              type="button"
              className="schedule-item__tag"
              onClick={() => void selectProjectView(item.projectId)}
            >
              {item.projectName}
              {item.branchName ? ` · ${item.branchName}` : ""}
            </button>
          </div>
          <button
            type="button"
            className="schedule-item__start"
            onClick={() => void activateTask(item.task.id, item.projectId)}
          >
            开始
          </button>
        </div>
      ))}
    </section>
  );
}
