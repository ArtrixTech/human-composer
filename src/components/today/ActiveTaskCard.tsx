import { Check, Pause } from "lucide-react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";

export function ActiveTaskCard({ active }: { active: TodayTaskContext | null }) {
  const completeTask = useAppStore((s) => s.completeTask);
  const pauseTask = useAppStore((s) => s.pauseTask);

  if (!active) {
    return (
      <section className="active-task-card active-task-card--empty">
        <p>暂无进行中的任务 — 从下方队列选择一项开始</p>
      </section>
    );
  }

  const est = active.task.estimatedMinutes ?? 30;

  return (
    <section className="active-task-card">
      <div className="active-task-card__badge">NOW</div>
      <div className="active-task-card__body">
        <h2>{active.task.title}</h2>
        <span className="active-task-card__meta">
          {active.projectName}
          {active.branchName ? ` · ${active.branchName}` : ""} · 预估 {est}min
        </span>
      </div>
      <div className="active-task-card__actions">
        <button
          type="button"
          className="active-task-card__complete"
          onClick={() => void completeTask(active.task.id, active.projectId)}
        >
          <Check size={14} /> 完成
        </button>
        <button
          type="button"
          className="active-task-card__pause"
          onClick={() => void pauseTask(active.task.id, active.projectId)}
        >
          <Pause size={14} /> 暂停
        </button>
      </div>
    </section>
  );
}
