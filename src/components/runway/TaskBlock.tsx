import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Bot, Clock, Play } from "lucide-react";
import { useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { ExternalTaskDialog } from "./ExternalTaskDialog";
import { TaskCardStatus } from "./TaskCardStatus";
import { stopCardDrag } from "./taskCardDrag";
import { cardWidth, formatEstimate } from "./taskBlockUtils";

type StatusKind = "active" | "claimable" | "pending" | "queued" | "postponed";

function statusKind(
  isActive: boolean,
  showClaim: boolean,
  isPending: boolean,
  isPostponed: boolean,
): StatusKind {
  if (isActive) return "active";
  if (showClaim) return "claimable";
  if (isPending) return "pending";
  if (isPostponed) return "postponed";
  return "queued";
}

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
  const postponeTask = useAppStore((s) => s.postponeTask);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const [externalOpen, setExternalOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.action.id,
    data: { task: ctx, laneId, taskId: ctx.action.id },
  });

  const isPostponed = ctx.action.postponed && ctx.action.status === "ready";
  const kind = statusKind(isActive, showClaim, isPending, isPostponed);
  const meta = [ctx.projectName, ctx.outcomeName].filter(Boolean).join(" · ");
  const blockerLabel =
    blockerTitles.length > 0
      ? blockerTitles.slice(0, 2).join("、") + (blockerTitles.length > 2 ? "…" : "")
      : "依赖";

  const canDelegate =
    !isPending && !isWatch && ctx.action.taskType === "normal" && ctx.action.status !== "done";

  const metaLine = isPending ? (
    <span className="task-card__blocker">等待 {blockerLabel}</span>
  ) : (
    meta
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: cardWidth(),
    opacity: isDragging ? 0.4 : isPending ? 0.75 : isPostponed ? 0.85 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`task-card task-card--${kind}`}
        title={isPending && blockerTitles.length > 0 ? blockerTitles.join(" → ") : undefined}
        {...attributes}
        {...listeners}
      >
        <div className="task-card__content">
          <div className="task-card__row-top">
            <TaskCardStatus kind={kind} />
            {ctx.action.priority && (
              <span className={`task-card__priority task-card__priority--${ctx.action.priority.toLowerCase()}`}>
                {ctx.action.priority}
              </span>
            )}
            <span className="task-card__title">{ctx.action.title}</span>
            <span className="task-card__time">{formatEstimate(ctx.action.estimatedMinutes, isPending)}</span>
          </div>
          {metaLine ? <div className="task-card__meta">{metaLine}</div> : null}

          <div className="task-card__actions">
            {isActive && !isWatch && (
              <button
                type="button"
                className="task-card__action task-card__action--postpone"
                aria-label="稍后"
                title="稍后再做，先做泳道里其他行动"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void postponeTask(ctx.action.id, laneId, ctx.projectId);
                }}
              >
                <Clock size={12} />
              </button>
            )}
            {showClaim && !isActive && (
              <button
                type="button"
                className="task-card__action task-card__action--claim"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void claimTask(ctx.action.id, laneId, ctx.projectId);
                }}
              >
                <Play size={12} />
              </button>
            )}
            {isPostponed && !showClaim && (
              <button
                type="button"
                className="task-card__action task-card__action--resume"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void claimTask(ctx.action.id, laneId, ctx.projectId);
                }}
              >
                现在做
              </button>
            )}
            {canDelegate && (
              <button
                type="button"
                className="task-card__action task-card__action--delegate"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  setExternalOpen(true);
                }}
                title="委派"
              >
                <Bot size={12} />
              </button>
            )}
            <button
              type="button"
              className="task-card__action"
              aria-label="归档"
              onPointerDown={stopCardDrag}
              onClick={(e) => {
                e.stopPropagation();
                void archiveTask(ctx.action.id, ctx.projectId);
              }}
            >
              <Archive size={12} />
            </button>
          </div>
        </div>
      </div>
      {externalOpen && (
        <ExternalTaskDialog ctx={ctx} laneId={laneId} onClose={() => setExternalOpen(false)} />
      )}
    </>
  );
}
