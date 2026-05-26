import { useCallback } from 'react';
import { Sparkles, X, Play } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface RecommendPopupProps {
  onDismiss: () => void;
}

export default function RecommendPopup({ onDismiss }: RecommendPopupProps) {
  const { recommendations, updateTaskStatus, branches } = useStore();

  const top = recommendations[0];
  const others = recommendations.slice(1, 4);

  const handleStart = useCallback(
    async (id: string) => {
      await updateTaskStatus(id, 'active');
      onDismiss();
    },
    [updateTaskStatus, onDismiss],
  );

  if (!top) return null;

  const branchName = (branchId: string | null) =>
    branches.find((b) => b.id === branchId)?.name ?? '';

  return (
    <div className="recommend-popup">
      <div className="recommend-popup__header">
        <Sparkles size={13} />
        <span>Recommended next</span>
        <button className="recommend-popup__close" onClick={onDismiss}>
          <X size={13} />
        </button>
      </div>

      <div className="recommend-popup__primary">
        <div className="recommend-popup__task-info">
          <span className="recommend-popup__branch">{branchName(top.branch_id)}</span>
          <span className="recommend-popup__title">{top.title}</span>
        </div>
        <button className="recommend-popup__start" onClick={() => handleStart(top.id)}>
          <Play size={12} />
          Start
        </button>
      </div>

      {others.length > 0 && (
        <div className="recommend-popup__others">
          <span className="recommend-popup__others-label">Or:</span>
          {others.map((task) => (
            <button
              key={task.id}
              className="recommend-popup__other-task"
              onClick={() => handleStart(task.id)}
            >
              {task.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
