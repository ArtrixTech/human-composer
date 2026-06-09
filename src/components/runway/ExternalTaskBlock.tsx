import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { cardWidth, formatEstimate } from "./taskBlockUtils";
import { TaskCardStatus } from "./TaskCardStatus";
import { stopCardDrag } from "./taskCardDrag";

function elapsedMinutes(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 60000));
}

export function ExternalTaskBlock({
  ctx,
  laneId,
}: {
  ctx: TodayTaskContext;
  laneId: string;
}) {
  const completeExternal = useAppStore((s) => s.completeExternal);
  const reviewExternal = useAppStore((s) => s.reviewExternal);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (ctx.action.externalStatus !== "delegated") return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [ctx.action.externalStatus]);
  void tick;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.action.id,
    data: { task: ctx, laneId, taskId: ctx.action.id },
  });

  const isDelegated = ctx.action.externalStatus === "delegated";
  const isNeedsReview = ctx.action.externalStatus === "needs_review";
  const elapsed = elapsedMinutes(ctx.action.externalStartedAt);
  const est = ctx.action.estimatedMinutes ?? 30;
  const progress = Math.min(100, (elapsed / est) * 100);
  const kind = isNeedsReview ? "review" : "external";
  const meta = [ctx.projectName, ctx.outcomeName].filter(Boolean).join(" · ");

  const metaLine = isDelegated
    ? `运行 ${elapsed}m / ${est}m`
    : isNeedsReview
      ? "待审核"
      : meta || "外部执行";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: cardWidth(),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card task-card--${kind}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-card__content">
        <div className="task-card__row-top">
          <TaskCardStatus kind={kind} />
          {ctx.action.priority != null && (
            <span className="task-card__priority">P{ctx.action.priority}</span>
          )}
          <span className="task-card__title">{ctx.action.title}</span>
          <span className="task-card__time">{formatEstimate(est)}</span>
        </div>
        <div className="task-card__meta">{metaLine}</div>
        {isDelegated && (
          <div className="task-card__progress" aria-hidden="true">
            <div className="task-card__progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="task-card__actions">
          {isDelegated && (
            <button
              type="button"
              className="task-card__action task-card__action--claim"
              onPointerDown={stopCardDrag}
              onClick={(e) => {
                e.stopPropagation();
                void completeExternal(ctx.action.id, ctx.projectId);
              }}
              title="标记完成"
            >
              <Check size={12} />
            </button>
          )}
          {isNeedsReview && (
            <>
              <button
                type="button"
                className="task-card__action task-card__action--claim"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void reviewExternal(ctx.action.id, ctx.projectId, "done");
                }}
                title="通过"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                className="task-card__action"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void reviewExternal(ctx.action.id, ctx.projectId, "rework");
                }}
                title="返工"
              >
                <RotateCcw size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
