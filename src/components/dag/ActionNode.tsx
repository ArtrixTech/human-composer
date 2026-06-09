import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Archive, Check, FileText, Link2, Pause, Play } from "lucide-react";

import type { Action, PriorityLevel } from "../../types";
import { PRIORITY_LABELS } from "../../utils/priorityUtils";
import "./TaskNode.css";

export interface ActionNodeData {
  task: Action;
  outcomeName: string;
  isRecommended?: boolean;
  dependencyCount?: number;
  dependencyOptions?: Action[];
  onSelect?: (taskId: string) => void;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onCyclePriority?: (taskId: string, current: PriorityLevel) => void;
  onAddDependency?: (taskId: string, dependsOnId: string) => void;
  [key: string]: unknown;
}

function ActionNodeComponent({ data }: NodeProps) {
  const nodeData = data as ActionNodeData;
  const {
    task,
    onStart,
    onComplete,
    onPause,
    onSelect,
    onArchive,
    onCyclePriority,
    onAddDependency,
    isRecommended,
    dependencyCount,
    dependencyOptions = [],
  } = nodeData;

  const [depOpen, setDepOpen] = useState(false);
  const estimate = task.estimatedMinutes ?? 30;

  return (
    <div
      className={`task-node task-node--${task.status} task-node--priority-${task.priority.toLowerCase()} ${isRecommended ? "task-node--recommended" : ""} ${task.pinned ? "task-node--pinned" : ""}`}
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
          <span className={`task-node__priority-badge task-node__priority-badge--${task.priority.toLowerCase()}`}>
            {task.priority} {PRIORITY_LABELS[task.priority]}
          </span>
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
            title="切换优先级 H/M/L"
            onClick={(e) => {
              e.stopPropagation();
              onCyclePriority(task.id, task.priority);
            }}
          >
            {task.priority}
          </button>
        )}
        {onAddDependency && dependencyOptions.length > 0 && (
          <div className="task-node__dep-wrap">
            <button
              type="button"
              className="task-node__action"
              title="添加依赖"
              onClick={(e) => {
                e.stopPropagation();
                setDepOpen((v) => !v);
              }}
            >
              <Link2 size={12} />
            </button>
            {depOpen && (
              <select
                className="task-node__dep-select"
                defaultValue=""
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const depId = e.target.value;
                  if (!depId) return;
                  onAddDependency(task.id, depId);
                  setDepOpen(false);
                  e.target.value = "";
                }}
              >
                <option value="">阻塞于…</option>
                {dependencyOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
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

export const ActionNode = memo(ActionNodeComponent);
/** @deprecated Use ActionNode */
export const TaskNode = ActionNode;
export type TaskNodeData = ActionNodeData;

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
          placeholder="行动名"
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
      + 添加行动
    </button>
  );
}

export const AddTaskNode = memo(AddTaskNodeComponent);
