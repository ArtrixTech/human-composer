import { Sparkles, X } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./RecommendPrompt.css";

export function RecommendPrompt() {
  const recommendPrompt = useAppStore((s) => s.recommendPrompt);
  const dismissRecommend = useAppStore((s) => s.dismissRecommend);
  const activateTask = useAppStore((s) => s.activateTask);
  const snapshot = useAppStore((s) => s.snapshot);

  if (!recommendPrompt || recommendPrompt.length === 0) return null;

  const top = recommendPrompt[0];
  const others = recommendPrompt.slice(1, 5);

  return (
    <div className="recommend-prompt">
      <header className="recommend-prompt__header">
        <Sparkles size={14} />
        <span>下一个建议</span>
        <button type="button" onClick={dismissRecommend} aria-label="关闭">
          <X size={14} />
        </button>
      </header>

      <div className="recommend-prompt__top">
        <div>
          <div className="recommend-prompt__title">{top.task.title}</div>
          {top.branchName && (
            <div className="recommend-prompt__branch">{top.branchName}</div>
          )}
        </div>
        <button type="button" className="recommend-prompt__start" onClick={() => void activateTask(top.task.id)}>
          开始
        </button>
      </div>

      {others.length > 0 && (
        <div className="recommend-prompt__others">
          <span className="recommend-prompt__others-label">其他 Ready</span>
          {others.map((r) => (
            <button key={r.task.id} type="button" onClick={() => void activateTask(r.task.id)}>
              {r.task.title}
            </button>
          ))}
        </div>
      )}

      {!snapshot?.activeTask && (
        <p className="recommend-prompt__idle">暂无 Active 任务 — 从上方选择开始</p>
      )}
    </div>
  );
}
