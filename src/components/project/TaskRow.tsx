import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Check, GripVertical, Play } from "lucide-react";

import type { Task, TaskDependency } from "../../types";
import { useAppStore } from "../../store/appStore";
import { blockedCount, blockerTitles, formatEstimate, nextPriority } from "./taskUtils";
import "./TaskRow.css";

export function TaskRow({
  task,
  tasks,
  dependencies,
  isRecommended,
}: {
  task: Task;
  tasks: Task[];
  dependencies: TaskDependency[];
  isRecommended?: boolean;
}) {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectTask = useAppStore((s) => s.selectTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const setTaskPriority = useAppStore((s) => s.setTaskPriority);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const blockers = blockerTitles(task.id, tasks, dependencies);
  const downstream = blockedCount(task.id, dependencies);
  let metaLabel: string = task.status;
  if (blockers.length > 0) metaLabel = `等待: ${blockers.slice(0, 2).join("、")}`;
  else if (downstream > 0) metaLabel = `阻塞 ${downstream} 项`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityLabel = task.priority != null ? `P${task.priority}` : "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-row task-row--${task.status} ${isRecommended ? "task-row--rec" : ""}`}
    >
      <button
        type="button"
        className="task-row__drag"
        aria-label="拖拽排序"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      <span className={`task-row__status task-row__status--${task.status}`} />
      <button type="button" className="task-row__title" onClick={() => selectTask(task.id)}>
        {task.title}
      </button>
      <button
        type="button"
        className="task-row__priority"
        title="点击切换优先级 P1–P5"
        onClick={(e) => {
          e.stopPropagation();
          void setTaskPriority(task.id, nextPriority(task.priority));
        }}
      >
        {priorityLabel}
      </button>
      <div className="task-row__meta-group">
        <span className="task-row__meta">{formatEstimate(task.estimatedMinutes)}</span>
        <span className="task-row__meta">{metaLabel}</span>
      </div>
      <div className="task-row__actions">
        {task.status === "ready" && activeProjectId && (
          <button
            type="button"
            title="开始"
            onClick={(e) => {
              e.stopPropagation();
              void activateTask(task.id, activeProjectId);
            }}
          >
            <Play size={14} />
          </button>
        )}
        {(task.status === "ready" || task.status === "active") && activeProjectId && (
          <button
            type="button"
            title="完成"
            onClick={(e) => {
              e.stopPropagation();
              void completeTask(task.id, activeProjectId);
            }}
          >
            <Check size={14} />
          </button>
        )}
        <button
          type="button"
          className="task-row__archive"
          title="归档"
          onClick={(e) => {
            e.stopPropagation();
            void archiveTask(task.id, activeProjectId ?? undefined);
          }}
        >
          <Archive size={14} />
        </button>
      </div>
    </div>
  );
}
