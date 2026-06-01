import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, MoreHorizontal, Pause, Play } from "lucide-react";
import { useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { blockWidth, formatEstimate } from "./taskBlockUtils";

export function TaskBlock({
  ctx,
  laneId,
  showClaim,
  isActive,
  isPending = false,
  blockerTitles = [],
}: {
  ctx: TodayTaskContext;
  laneId: string;
  showClaim: boolean;
  isActive: boolean;
  isPending?: boolean;
  blockerTitles?: string[];
}) {
  const claimTask = useAppStore((s) => s.claimTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const startExternal = useAppStore((s) => s.startExternal);
  const [menuOpen, setMenuOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.task.id,
    data: { task: ctx, laneId, taskId: ctx.task.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: blockWidth(ctx.task.estimatedMinutes),
    opacity: isDragging ? 0.5 : isPending ? 0.72 : 1,
  };

  const est = ctx.task.estimatedMinutes ?? 30;
  const meta = [ctx.projectName, ctx.branchName, `${est}min`].filter(Boolean).join(" · ");
  const blockerLabel =
    blockerTitles.length > 0
      ? `等待: ${blockerTitles.slice(0, 2).join("、")}${blockerTitles.length > 2 ? "…" : ""}`
      : "等待依赖";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-block${isActive ? " task-block--active" : ""}${showClaim ? " task-block--claimable" : ""}${isPending ? " task-block--pending" : ""}`}
      title={isPending && blockerTitles.length > 0 ? blockerTitles.join(" → ") : undefined}
      {...attributes}
      {...listeners}
    >
      <span className="task-block__time-badge">
        {formatEstimate(ctx.task.estimatedMinutes, isPending)}
      </span>
      <div className="task-block__title">{ctx.task.title}</div>
      <div className="task-block__meta">{meta}</div>
      {isPending && <div className="task-block__blocker">{blockerLabel}</div>}
      {isActive && (
        <div className="task-block__actions">
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
          >
            <Pause size={12} />
          </button>
        </div>
      )}
      {showClaim && !isActive && !isPending && (
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
      {!isPending && (
        <div className="task-block__menu-wrap">
          <button
            type="button"
            className="task-block__menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <MoreHorizontal size={12} />
          </button>
          {menuOpen && (
            <div className="task-block__menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void startExternal(ctx.task.id, ctx.projectId, laneId, est);
                }}
              >
                启动外部执行
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
