import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, Check, GripVertical, Pause, Play } from "lucide-react";
import { useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { ExternalTaskDialog } from "./ExternalTaskDialog";
import { blockWidth, formatEstimate } from "./taskBlockUtils";

export function TaskBlock({
  ctx,
  laneId,
  showClaim,
  isActive,
  isPending = false,
  isWatch = false,
  blockerTitles = [],
}: {
  ctx: TodayTaskContext;
  laneId: string;
  showClaim: boolean;
  isActive: boolean;
  isPending?: boolean;
  isWatch?: boolean;
  blockerTitles?: string[];
}) {
  const claimTask = useAppStore((s) => s.claimTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const [externalOpen, setExternalOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.task.id,
    data: { task: ctx, laneId, taskId: ctx.task.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: blockWidth(ctx.task.estimatedMinutes),
    opacity: isDragging ? 0.4 : isPending ? 0.75 : 1,
  };

  const meta = [ctx.projectName, ctx.branchName].filter(Boolean).join(" · ");
  const blockerLabel =
    blockerTitles.length > 0
      ? `等待 ${blockerTitles.slice(0, 2).join("、")}${blockerTitles.length > 2 ? "…" : ""}`
      : "等待依赖";

  // In a watch lane, normal tasks should still be claimable/completable — they don't
  // auto-convert to external just because of the lane type.
  const canDelegate =
    !isPending && !isWatch && ctx.task.taskType === "normal" && ctx.task.status !== "done";

  const statusLabel = isPending ? "等待" : isActive ? "进行中" : showClaim ? "可领取" : "排队";
  const stateClass = isActive
    ? " task-block--active"
    : showClaim
      ? " task-block--claimable"
      : isPending
        ? " task-block--pending"
        : " task-block--queued";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`task-block${stateClass}`}
        title={isPending && blockerTitles.length > 0 ? blockerTitles.join(" → ") : undefined}
        {...attributes}
      >
        {/* Dedicated drag handle — keeps button click areas drag-free */}
        <div className="task-block__handle" {...listeners} aria-label="拖拽">
          <GripVertical size={12} />
        </div>

        <div className="task-block__body">
          <div className="task-block__top">
            {/* Only show status chip for active/claimable/pending; hide for queued to reduce noise */}
            {(isActive || showClaim || isPending) && (
              <span
                className={`task-block__status task-block__status--${
                  isPending ? "pending" : isActive ? "active" : "ready"
                }`}
              >
                {statusLabel}
              </span>
            )}
            <span className="task-block__time-badge">
              {formatEstimate(ctx.task.estimatedMinutes, isPending)}
            </span>
          </div>

          <div className="task-block__title">{ctx.task.title}</div>
          {meta && <div className="task-block__meta">{meta}</div>}
          {isPending && <div className="task-block__blocker">{blockerLabel}</div>}

          {(isActive || showClaim || canDelegate) && (
            <div className="task-block__actions">
              {isActive && (
                <>
                  <button
                    type="button"
                    className="task-block__complete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void completeTask(ctx.task.id, ctx.projectId, laneId);
                    }}
                  >
                    <Check size={12} /> 完成
                  </button>
                  <button
                    type="button"
                    className="task-block__pause"
                    onClick={(e) => {
                      e.stopPropagation();
                      void pauseTask(ctx.task.id, ctx.projectId);
                    }}
                    aria-label="暂停"
                  >
                    <Pause size={12} />
                  </button>
                </>
              )}
              {showClaim && !isActive && (
                <button
                  type="button"
                  className="task-block__claim"
                  onClick={(e) => {
                    e.stopPropagation();
                    void claimTask(ctx.task.id, laneId, ctx.projectId);
                  }}
                >
                  <Play size={12} /> 领取
                </button>
              )}
              {canDelegate && (
                <button
                  type="button"
                  className="task-block__delegate"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExternalOpen(true);
                  }}
                  title="委派给 Agent / CI / 他人执行"
                >
                  <Bot size={12} /> 委派
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {externalOpen && (
        <ExternalTaskDialog ctx={ctx} laneId={laneId} onClose={() => setExternalOpen(false)} />
      )}
    </>
  );
}
