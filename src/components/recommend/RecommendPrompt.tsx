import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./RecommendPrompt.css";

export function RecommendPrompt() {
  const recommendPrompt = useAppStore((s) => s.recommendPrompt);
  const currentView = useAppStore((s) => s.currentView);
  const dismissRecommend = useAppStore((s) => s.dismissRecommend);
  const activateTask = useAppStore((s) => s.activateTask);

  useEffect(() => {
    if (!recommendPrompt || recommendPrompt.length === 0) return;
    const timer = setTimeout(() => dismissRecommend(), 7000);
    return () => clearTimeout(timer);
  }, [recommendPrompt, dismissRecommend]);

  if (currentView === "today" || currentView === "project") return null;
  if (!recommendPrompt || recommendPrompt.length === 0) return null;

  const top = recommendPrompt[0];
  const others = recommendPrompt.slice(1, 4);
  const projectId = top.projectId ?? top.task.projectId;

  return (
    <div className="recommend-prompt recommend-prompt--toast">
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
          {top.branchName && <div className="recommend-prompt__branch">{top.branchName}</div>}
        </div>
        <button
          type="button"
          className="recommend-prompt__start"
          onClick={() => void activateTask(top.task.id, projectId)}
        >
          开始
        </button>
      </div>

      {others.length > 0 && (
        <div className="recommend-prompt__others">
          {others.map((r) => (
            <button
              key={r.task.id}
              type="button"
              onClick={() =>
                void activateTask(r.task.id, r.projectId ?? r.task.projectId)
              }
            >
              {r.task.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
