import type { TodayTaskContext } from "../../types";
import { blockWidth, formatEstimate } from "./taskBlockUtils";

export function TaskBlockPreview({
  ctx,
  isPending = false,
}: {
  ctx: TodayTaskContext;
  isPending?: boolean;
}) {
  const meta = [ctx.projectName, ctx.branchName].filter(Boolean).join(" · ");

  return (
    <div
      className={`task-block task-block--dragging${isPending ? " task-block--pending" : ""}`}
      style={{ width: blockWidth(ctx.task.estimatedMinutes) }}
    >
      <div className="task-block__top">
        <span className="task-block__status task-block__status--queued">拖拽中</span>
        <span className="task-block__time-badge">
          {formatEstimate(ctx.task.estimatedMinutes, isPending)}
        </span>
      </div>
      <div className="task-block__title">{ctx.task.title}</div>
      {meta && <div className="task-block__meta">{meta}</div>}
    </div>
  );
}
