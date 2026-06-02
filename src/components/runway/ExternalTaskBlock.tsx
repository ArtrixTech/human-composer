import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, Check, Clock, GripVertical, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { blockWidth, formatEstimate } from "./taskBlockUtils";

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

  // Refresh elapsed time every 30 s so the progress bar stays live
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (ctx.task.externalStatus !== "delegated") return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [ctx.task.externalStatus]);
  void tick; // consumed only to trigger re-render

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.task.id,
    data: { task: ctx, laneId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: blockWidth(ctx.task.estimatedMinutes),
    opacity: isDragging ? 0.4 : 1,
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
      className={`external-task-block${isNeedsReview ? " external-task-block--review" : ""}${isDelegated ? " external-task-block--running" : ""}`}
      {...attributes}
    >
      {/* Dedicated drag handle — click-safe from action buttons */}
      <div className="external-task-block__handle" {...listeners} aria-label="拖拽">
        <GripVertical size={12} />
      </div>

      <div className="external-task-block__body">
        <div className="external-task-block__top">
          <span className={`external-task-block__status${isNeedsReview ? " external-task-block__status--review" : ""}`}>
            <Bot size={10} />
            {isNeedsReview ? "待审核" : "外部执行"}
          </span>
          <span className="external-task-block__time">{formatEstimate(est)}</span>
        </div>
        <div className="external-task-block__title">{ctx.task.title}</div>
        <div className="external-task-block__meta">
          {ctx.projectName}
          {ctx.branchName ? ` · ${ctx.branchName}` : ""}
        </div>
        {isDelegated && (
          <>
            <div className="external-task-block__progress">
              <div className="external-task-block__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="external-task-block__elapsed">
              <Clock size={10} /> 运行 {elapsed}m / 预估 {est}m
            </div>
            <button
              type="button"
              className="external-task-block__done"
              onClick={(e) => {
                e.stopPropagation();
                void completeExternal(ctx.task.id, ctx.projectId);
              }}
            >
              <Check size={12} /> 标记完成
            </button>
          </>
        )}
        {isNeedsReview && (
          <div className="external-task-block__review">
            {ctx.task.externalNote && (
              <p className="external-task-block__note">{ctx.task.externalNote}</p>
            )}
            <div className="external-task-block__review-actions">
              <button
                type="button"
                className="external-task-block__approve"
                onClick={(e) => {
                  e.stopPropagation();
                  void reviewExternal(ctx.task.id, ctx.projectId, "done");
                }}
              >
                <Check size={12} /> 通过
              </button>
              <button
                type="button"
                className="external-task-block__rework"
                onClick={(e) => {
                  e.stopPropagation();
                  void reviewExternal(ctx.task.id, ctx.projectId, "rework");
                }}
              >
                <RotateCcw size={12} /> 返工
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
