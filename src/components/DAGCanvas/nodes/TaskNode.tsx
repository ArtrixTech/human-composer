import { memo, useCallback } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Play, Pause } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { useToastStore } from '../../../store/useToastStore';
import type { Task } from '../../../types';

export type TaskNodeType = Node<
  { task: Task; onSelect?: (task: Task) => void },
  'taskNode'
>;

function TaskNode({ data }: NodeProps<TaskNodeType>) {
  const { task, onSelect } = data;
  const { updateTaskStatus, loadRecommendations } = useStore();
  const { push } = useToastStore();

  const handleComplete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const prevStatus = task.status;
      const affected = await updateTaskStatus(task.id, 'done');
      const newlyReady = affected.filter((t) => t.id !== task.id && t.status === 'ready');
      push(
        `Completed: ${task.title}${newlyReady.length ? ` · ${newlyReady.length} unlocked` : ''}`,
        async () => { await updateTaskStatus(task.id, prevStatus); },
      );
      loadRecommendations();
    },
    [task, updateTaskStatus, push, loadRecommendations],
  );

  const handleStart = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await updateTaskStatus(task.id, 'active');
    },
    [task.id, updateTaskStatus],
  );

  const handlePause = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await updateTaskStatus(task.id, 'ready');
    },
    [task.id, updateTaskStatus],
  );

  return (
    <div
      className={`task-node task-node--${task.status}`}
      onClick={() => onSelect?.(task)}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Left} className="task-handle" />
      <div className="task-node__body">
        <div className="task-node__title">{task.title}</div>
        <div className="task-node__footer">
          <span className="task-node__status-dot" />
          <span className="task-node__status-label">
            {{ inbox: 'Inbox', pending: 'Waiting…', ready: 'Ready', active: 'Active', done: 'Done' }[task.status]}
          </span>
          <div className="task-node__actions">
            {task.status === 'ready' && (
              <button className="task-btn task-btn--start" onClick={handleStart}>
                <Play size={11} />
                <span>Start</span>
              </button>
            )}
            {task.status === 'active' && (
              <>
                <button className="task-btn task-btn--complete" onClick={handleComplete}>
                  <CheckCircle2 size={11} />
                  <span>Done</span>
                </button>
                <button className="task-btn task-btn--pause" onClick={handlePause}>
                  <Pause size={11} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="task-handle" />
    </div>
  );
}

export default memo(TaskNode);
