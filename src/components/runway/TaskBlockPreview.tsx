import type { TodayTaskContext } from "../../types";
import { cardWidth, formatEstimate } from "./taskBlockUtils";
import { TaskCardStatus } from "./TaskCardStatus";

export function TaskBlockPreview({
  ctx,
  isPending = false,
}: {
  ctx: TodayTaskContext;
  isPending?: boolean;
}) {
  const meta = [ctx.projectName, ctx.outcomeName].filter(Boolean).join(" · ");
  const kind = isPending ? "pending" : "queued";

  return (
    <div
      className={`task-card task-card--dragging task-card--${kind}`}
      style={{ width: cardWidth() }}
    >
      <div className="task-card__content">
        <div className="task-card__row-top">
          <TaskCardStatus kind={kind} />
          <span className="task-card__title">{ctx.action.title}</span>
          <span className="task-card__time">{formatEstimate(ctx.action.estimatedMinutes, isPending)}</span>
        </div>
        {meta ? <div className="task-card__meta">{meta}</div> : null}
      </div>
    </div>
  );
}
