import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Archive, Check, Circle, Play, Pause } from "lucide-react";

import type { Task } from "../../types";
import "./TaskNode.css";

export interface TaskNodeData {
  task: Task;
  branchName: string;
  isRecommended?: boolean;
  dependencyCount?: number;
  onSelect?: (taskId: string) => void;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onCyclePriority?: (taskId: string, current: number | null) => void;
  [key: string]: unknown;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  inbox: "Inbox",
  pending: "Pending",
  ready: "Ready",
  active: "Active",
  done: "Done",
};

function TaskNodeComponent({ data }: NodeProps) {
  const nodeData = data as TaskNodeData;
  const {
    task,
    onStart,
    onComplete,
    onPause,
    onSelect,
    onArchive,
    onCyclePriority,
    isRecommended,
    dependencyCount,
  } = nodeData;

  return (
    <div
      className={`task-node task-node--${task.status} ${isRecommended ? "task-node--recommended" : ""} ${task.pinned ? "task-node--pinned" : ""}`}
      onClick={() => onSelect?.(task.id)}
      onKeyDown={() => {}}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Top} className="task-node__handle" />
      <div className="task-node__header">
        {task.priority != null && (
          <button
            type="button"
            className="task-node__priority"
            title="点击切换优先级"
            onClick={(e) => {
              e.stopPropagation();
              onCyclePriority?.(task.id, task.priority);
            }}
          >
            P{task.priority}
          </button>
        )}
        {task.priority == null && onCyclePriority && (
          <button
            type="button"
            className="task-node__priority task-node__priority--unset"
            title="设置优先级"
            onClick={(e) => {
              e.stopPropagation();
              onCyclePriority(task.id, null);
            }}
          >
            —
          </button>
        )}
        <span className="task-node__status">{STATUS_LABEL[task.status]}</span>
        <div className="task-node__actions">
          {task.status === "ready" && onStart && (
            <button
              type="button"
              className="task-node__action"
              onClick={(e) => {
                e.stopPropagation();
                onStart(task.id);
              }}
              title="开始"
            >
              <Play size={12} />
            </button>
          )}
          {task.status === "active" && (
            <>
              {onComplete && (
                <button
                  type="button"
                  className="task-node__action task-node__action--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(task.id);
                  }}
                  title="完成"
                >
                  <Check size={12} />
                </button>
              )}
              {onPause && (
                <button
                  type="button"
                  className="task-node__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPause(task.id);
                  }}
                  title="暂停"
                >
                  <Pause size={12} />
                </button>
              )}
            </>
          )}
          {task.status === "done" && (
            <Check size={12} className="task-node__done-icon" />
          )}
          {task.status === "pending" && (
            <Circle size={10} className="task-node__pending-icon" />
          )}
          {onArchive && (
            <button
              type="button"
              className="task-node__action task-node__action--archive"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(task.id);
              }}
              title="归档"
            >
              <Archive size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="task-node__title">{task.title}</div>
      <div className="task-node__meta">
        {(task.estimatedMinutes ?? 30) > 0 && (
          <span>{task.estimatedMinutes ?? 30}m</span>
        )}
        {(dependencyCount ?? 0) > 0 && <span>⛓ {dependencyCount}</span>}
        {task.description && <span>📝</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="task-node__handle" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);

export interface AddTaskNodeData {
  branchId: string;
  onAdd?: (title: string) => void;
  [key: string]: unknown;
}

function AddTaskNodeComponent({ data }: NodeProps) {
  const { branchId, onAdd } = data as AddTaskNodeData;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const value = title.trim();
    if (!value) return;
    onAdd?.(value);
    setTitle("");
    setOpen(false);
  };

  if (open) {
    return (
      <div className="add-task-node">
        <input
          autoFocus
          placeholder="任务名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <button type="button" className="add-task-node add-task-node--btn" onClick={() => setOpen(true)}>
      + {branchId ? "" : ""}
    </button>
  );
}

export const AddTaskNode = memo(AddTaskNodeComponent);
