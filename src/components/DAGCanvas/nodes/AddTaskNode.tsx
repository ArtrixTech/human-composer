import { memo, useState, useCallback, useRef } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useStore } from '../../../store/useStore';

export type AddTaskNodeType = Node<{ branchId: string }, 'addTaskNode'>;

function AddTaskNode({ data }: NodeProps<AddTaskNodeType>) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const { createTask } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const startAdding = useCallback(() => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!title.trim()) {
      setIsAdding(false);
      return;
    }
    await createTask(title.trim(), data.branchId);
    setTitle('');
    setIsAdding(false);
  }, [title, data.branchId, createTask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') handleAdd();
      if (e.key === 'Escape') {
        setTitle('');
        setIsAdding(false);
      }
    },
    [handleAdd],
  );

  if (isAdding) {
    return (
      <div className="add-task-node add-task-node--editing">
        <input
          ref={inputRef}
          type="text"
          className="add-task-input"
          placeholder="Task name…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!title.trim()) setIsAdding(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="add-task-node" onClick={startAdding} role="button" tabIndex={0}>
      <Plus size={14} />
      <span>Add task</span>
    </div>
  );
}

export default memo(AddTaskNode);
