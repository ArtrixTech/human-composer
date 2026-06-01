import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock } from "lucide-react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";

function elapsedMinutes(startedAt: string | null): number {
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.task.id,
    data: { task: ctx, laneId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDelegated = ctx.task.externalStatus === "delegated";
  const isNeedsReview = ctx.task.externalStatus === "needs_review";
  const elapsed = elapsedMinutes(ctx.task.externalStartedAt);
  const est = ctx.task.estimatedMinutes ?? 30;
  const progress = Math.min(100, (elapsed / est) * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`external-task-block${isNeedsReview ? " external-task-block--review" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="external-task-block__header">
        <Clock size={12} />
        <span>{ctx.task.title}</span>
      </div>
      <div className="external-task-block__meta">
        {ctx.projectName}
        {ctx.branchName ? ` · ${ctx.branchName}` : ""}
      </div>
      {isDelegated && (
        <>
          <div className="external-task-block__progress">
            <div className="external-task-block__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="external-task-block__elapsed">运行 {elapsed}min / 预估 {est}min</div>
          <button
            type="button"
            className="external-task-block__done"
            onClick={(e) => {
              e.stopPropagation();
              void completeExternal(ctx.task.id, ctx.projectId);
            }}
          >
            标记外部完成
          </button>
        </>
      )}
      {isNeedsReview && (
        <div className="external-task-block__review">
          <span className="external-task-block__review-badge">等待审核</span>
          {ctx.task.externalNote && (
            <p className="external-task-block__note">{ctx.task.externalNote}</p>
          )}
          <div className="external-task-block__review-actions">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void reviewExternal(ctx.task.id, ctx.projectId, "done");
              }}
            >
              <Check size={12} /> 审核通过
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void reviewExternal(ctx.task.id, ctx.projectId, "rework");
              }}
            >
              需要返工
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
