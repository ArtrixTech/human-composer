import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Bot, Pause, Play } from "lucide-react";
import { useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { ExternalTaskDialog } from "./ExternalTaskDialog";
import { TaskCardStatus } from "./TaskCardStatus";
import { stopCardDrag } from "./taskCardDrag";
import { cardWidth, formatEstimate } from "./taskBlockUtils";

type StatusKind = "active" | "claimable" | "pending" | "queued";

function statusKind(
  isActive: boolean,
  showClaim: boolean,
  isPending: boolean,
): StatusKind {
  if (isActive) return "active";
  if (showClaim) return "claimable";
  if (isPending) return "pending";
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
  const pauseTask = useAppStore((s) => s.pauseTask);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const [externalOpen, setExternalOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.task.id,
    data: { task: ctx, laneId, taskId: ctx.task.id },
  });

  const kind = statusKind(isActive, showClaim, isPending);
  const meta = [ctx.projectName, ctx.branchName].filter(Boolean).join(" · ");
  const blockerLabel =
    blockerTitles.length > 0
      ? blockerTitles.slice(0, 2).join("、") + (blockerTitles.length > 2 ? "…" : "")
      : "依赖";

  const canDelegate =
    !isPending && !isWatch && ctx.task.taskType === "normal" && ctx.task.status !== "done";

  const metaLine = isPending ? (
    <span className="task-card__blocker">等待 {blockerLabel}</span>
  ) : (
    meta
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: cardWidth(),
    opacity: isDragging ? 0.4 : isPending ? 0.75 : 1,
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
            {ctx.task.priority != null && (
              <span className="task-card__priority">P{ctx.task.priority}</span>
            )}
            <span className="task-card__title">{ctx.task.title}</span>
            <span className="task-card__time">{formatEstimate(ctx.task.estimatedMinutes, isPending)}</span>
          </div>
          {metaLine ? <div className="task-card__meta">{metaLine}</div> : null}

          <div className="task-card__actions">
            {isActive && (
              <button
                type="button"
                className="task-card__action"
                aria-label="暂停"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void pauseTask(ctx.task.id, ctx.projectId);
                }}
              >
                <Pause size={12} />
              </button>
            )}
            {showClaim && !isActive && (
              <button
                type="button"
                className="task-card__action task-card__action--claim"
                onPointerDown={stopCardDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  void claimTask(ctx.task.id, laneId, ctx.projectId);
                }}
              >
                <Play size={12} />
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
                void archiveTask(ctx.task.id, ctx.projectId);
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
