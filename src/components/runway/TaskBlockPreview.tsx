import type { TodayTaskContext } from "../../types";
import { blockWidth, formatEstimate } from "./taskBlockUtils";

export function TaskBlockPreview({
  ctx,
  isPending = false,
}: {
  ctx: TodayTaskContext;
  isPending?: boolean;
}) {
  const est = ctx.task.estimatedMinutes ?? 30;
  const meta = [ctx.projectName, ctx.branchName, `${est}min`].filter(Boolean).join(" · ");

  return (
    <div
      className={`task-block task-block--dragging${isPending ? " task-block--pending" : ""}`}
      style={{ width: blockWidth(ctx.task.estimatedMinutes) }}
    >
      <span className="task-block__time-badge">{formatEstimate(ctx.task.estimatedMinutes, isPending)}</span>
      <div className="task-block__title">{ctx.task.title}</div>
      <div className="task-block__meta">{meta}</div>
    </div>
  );
}
