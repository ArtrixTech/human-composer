import { formatMinutesTotal } from "./taskBlockUtils";

import type { TodayTaskContext } from "../../types";

export function LaneTimeline({ tasks }: { tasks: TodayTaskContext[] }) {
  const actionable = tasks.filter(
    (t) => t.task.status === "active" || t.task.status === "ready",
  );
  if (actionable.length === 0) return null;

  let cursor = 0;
  const segments = actionable.map((ctx) => {
    const minutes = ctx.task.estimatedMinutes ?? 30;
    const start = cursor;
    cursor += minutes;
    return { id: ctx.task.id, title: ctx.task.title, minutes, start };
  });

  const total = cursor;
  if (total <= 0) return null;

  return (
    <div className="lane-timeline" aria-hidden="true">
      <div className="lane-timeline__track">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="lane-timeline__seg"
            style={{ flex: seg.minutes }}
            title={`${seg.title} · ${seg.minutes}m`}
          />
        ))}
      </div>
      <div className="lane-timeline__label">可执行约 {formatMinutesTotal(total)}</div>
    </div>
  );
}
