import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Archive, Check, FileText, Link2, Pause, Play } from "lucide-react";

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

  const estimate = task.estimatedMinutes ?? 30;

  return (
    <div
      className={`task-node task-node--${task.status} ${isRecommended ? "task-node--recommended" : ""} ${task.pinned ? "task-node--pinned" : ""}`}
      onClick={() => onSelect?.(task.id)}
      onKeyDown={() => {}}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Top} className="task-node__handle" />
      <div className="task-node__body">
        <div className="task-node__title">{task.title}</div>
        <div className="task-node__meta">
          {estimate > 0 && <span>{estimate}m</span>}
          {task.priority != null && <span>P{task.priority}</span>}
          {(dependencyCount ?? 0) > 0 && (
            <span className="task-node__meta-deps">
              <Link2 size={10} />
              {dependencyCount}
            </span>
          )}
          {task.description && (
            <span className="task-node__meta-desc" title="有描述">
              <FileText size={10} />
            </span>
          )}
          {task.pinned && <span className="task-node__meta-pin">★</span>}
        </div>
      </div>
      <div className="task-node__actions">
        {onCyclePriority && (
          <button
            type="button"
            className="task-node__action task-node__action--priority"
            title={task.priority != null ? "切换优先级" : "设置优先级"}
            onClick={(e) => {
              e.stopPropagation();
              onCyclePriority(task.id, task.priority);
            }}
          >
            {task.priority != null ? `P${task.priority}` : "P"}
          </button>
        )}
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
        {task.status === "active" && onComplete && (
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
        {task.status === "active" && onPause && (
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
  const { onAdd } = data as AddTaskNodeData;
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
      <div className="add-task-node add-task-node--input">
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
      + 添加任务
    </button>
  );
}

export const AddTaskNode = memo(AddTaskNodeComponent);
