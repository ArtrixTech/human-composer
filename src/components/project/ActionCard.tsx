import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Check, FileText, Pause, Pin, Play, X } from "lucide-react";

import type { Action, PriorityLevel } from "../../types";
import { PRIORITY_LABELS } from "../../utils/priorityUtils";
import "../dag/TaskNode.css";

export interface UpstreamDep {
  id: string;
  title: string;
}

export interface ActionCardProps {
  task: Action;
  branchId: string;
  isRecommended?: boolean;
  dependencyCount?: number;
  upstreamDeps?: UpstreamDep[];
  connecting?: boolean;
  highlightIn?: boolean;
  onSelect?: (taskId: string) => void;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onCyclePriority?: (taskId: string, current: PriorityLevel) => void;
  onRemoveDependency?: (taskId: string, dependsOnId: string) => void;
  onPortPointerDown?: (taskId: string, e: React.PointerEvent) => void;
}

function ActionCardComponent({
  task,
  branchId,
  isRecommended,
  dependencyCount,
  upstreamDeps = [],
  connecting = false,
  highlightIn = false,
  onSelect,
  onStart,
  onComplete,
  onPause,
  onArchive,
  onCyclePriority,
  onRemoveDependency,
  onPortPointerDown,
}: ActionCardProps) {
  const [blockInHover, setBlockInHover] = useState(false);
  const estimate = task.estimatedMinutes ?? 30;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "card", taskId: task.id, branchId },
    disabled: connecting,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card-id={task.id}
      data-branch-id={branchId}
      className={`task-node task-node--card task-node--${task.status} task-node--priority-${task.priority.toLowerCase()} ${isRecommended ? "task-node--recommended" : ""} ${task.pinned ? "task-node--pinned" : ""}${upstreamDeps.length > 0 ? " task-node--blocked" : ""}${highlightIn ? " task-node--port-highlight" : ""}`}
      onClick={() => onSelect?.(task.id)}
      {...attributes}
      {...listeners}
    >
      <div className="task-node__body">
        <div className="task-node__title">{task.title}</div>
        <div className="task-node__meta">
          {estimate > 0 && <span>{estimate}m</span>}
          <span className={`task-node__priority-badge task-node__priority-badge--${task.priority.toLowerCase()}`}>
            {task.priority} {PRIORITY_LABELS[task.priority]}
          </span>
          {(dependencyCount ?? 0) > 0 && (
            <span className="task-node__meta-deps" title="依赖关系">
              block×{dependencyCount}
            </span>
          )}
          {task.description && (
            <span className="task-node__meta-desc" title="有描述">
              <FileText size={10} />
            </span>
          )}
          {task.pinned && (
            <span className="task-node__meta-pin" title="已置顶">
              <Pin size={10} />
            </span>
          )}
        </div>
      </div>

      <div className="task-node__actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        {onCyclePriority && (
          <button
            type="button"
            className="task-node__action task-node__action--priority"
            title="切换优先级 H/M/L"
            onClick={() => onCyclePriority(task.id, task.priority)}
          >
            {task.priority}
          </button>
        )}
        {task.status === "ready" && onStart && (
          <button type="button" className="task-node__action" onClick={() => onStart(task.id)} title="开始">
            <Play size={12} />
          </button>
        )}
        {task.status === "active" && onComplete && (
          <button
            type="button"
            className="task-node__action task-node__action--primary"
            onClick={() => onComplete(task.id)}
            title="完成"
          >
            <Check size={12} />
          </button>
        )}
        {task.status === "active" && onPause && (
          <button type="button" className="task-node__action" onClick={() => onPause(task.id)} title="暂停">
            <Pause size={12} />
          </button>
        )}
        {onArchive && (
          <button
            type="button"
            className="task-node__action task-node__action--archive"
            onClick={() => onArchive(task.id)}
            title="归档"
          >
            <Archive size={12} />
          </button>
        )}
      </div>

      <div className="task-node__block-ports">
        <div
          className="task-node__block-port task-node__block-port--in"
          onMouseEnter={() => setBlockInHover(true)}
          onMouseLeave={() => setBlockInHover(false)}
        >
          <button
            type="button"
            className="task-node__port task-node__port--in"
            data-port="block-in"
            data-task-id={task.id}
            aria-label="阻塞入线点"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          {upstreamDeps.length > 0 && (
            <span className="task-node__block-in-badge" title={`${upstreamDeps.length} 项阻塞`}>
              {upstreamDeps.length}
            </span>
          )}
          {blockInHover && upstreamDeps.length > 0 && (
            <div className="task-node__block-in-menu">
              {upstreamDeps.map((dep) => (
                <button
                  key={dep.id}
                  type="button"
                  className="task-node__block-in-remove"
                  title={`取消阻塞：${dep.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDependency?.(task.id, dep.id);
                  }}
                >
                  <span className="task-node__block-in-remove-title">{dep.title}</span>
                  <X size={10} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="task-node__block-port task-node__block-port--out">
          <button
            type="button"
            className="task-node__port task-node__port--out"
            data-port="block-out"
            data-task-id={task.id}
            aria-label="阻塞出线点"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPortPointerDown?.(task.id, e);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}

export const ActionCard = memo(ActionCardComponent);
