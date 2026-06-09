import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";

import { useAppStore } from "../../store/appStore";
import { PRIORITY_LABELS } from "../../utils/priorityUtils";
import { ProjectIcon } from "../shared/ProjectIcon";
import { projectPriorityClass } from "../../utils/projectUtils";
import "./ProjectHeader.css";

export function ProjectHeader() {
  const graph = useAppStore((s) => s.graph);
  const snapshot = useAppStore((s) => s.snapshot);
  const loading = useAppStore((s) => s.loading);
  const hideDoneTasks = useAppStore((s) => s.hideDoneTasks);
  const toggleHideDone = useAppStore((s) => s.toggleHideDone);

  if (!graph) return null;

  const activeCount = graph.actions.filter((t) => t.status === "active").length;
  const readyCount = graph.actions.filter((t) => t.status === "ready").length;
  const inboxCount = graph.actions.filter((t) => t.status === "inbox").length;
  const doneCount = graph.actions.filter((t) => t.status === "done").length;
  const totalCount = graph.actions.filter((t) => t.status !== "inbox").length;
  const topRec = snapshot?.recommendations[0];
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const showSecondRow = Boolean(topRec || loading || doneCount > 0);

  return (
    <header className="project-header">
      <div
        className="project-header__row"
        style={{ "--project-color": graph.project.color } as CSSProperties}
      >
        <span className="project-header__icon" aria-hidden>
          <ProjectIcon name={graph.project.icon} size={16} />
        </span>
        <h1 className="project-header__name">{graph.project.name}</h1>
        <span className={`project-header__priority ${projectPriorityClass(graph.project.priority)}`}>
          {graph.project.priority} {PRIORITY_LABELS[graph.project.priority]}
        </span>
        <span className="project-header__scale">
          {graph.outcomes.length} 个目标 · {totalCount} 项行动
        </span>
        <div className="project-header__stats">
          {activeCount > 0 && (
            <span className="project-header__stat">
              <span className="project-header__dot project-header__dot--active" />
              {activeCount} 进行中
            </span>
          )}
          {readyCount > 0 && (
            <span className="project-header__stat">
              <span className="project-header__dot project-header__dot--ready" />
              {readyCount} 就绪
            </span>
          )}
          {inboxCount > 0 && (
            <span className="project-header__stat">
              <span className="project-header__dot project-header__dot--inbox" />
              {inboxCount} 收件
            </span>
          )}
          <span className="project-header__progress">
            <span className="project-header__progress-bar">
              <span
                className="project-header__progress-fill"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="project-header__progress-label">{progress}%</span>
          </span>
        </div>
      </div>

      {showSecondRow && (
        <div className="project-header__row project-header__row--secondary">
          <div className="project-header__secondary-left">
            {topRec && (
              <button
                type="button"
                className="project-header__rec"
                title="点击激活推荐行动"
                onClick={() =>
                  useAppStore
                    .getState()
                    .activateTask(topRec.action.id, topRec.projectId ?? topRec.action.projectId)
                }
              >
                <ArrowRight size={12} />
                <span>{topRec.action.title}</span>
              </button>
            )}
            {loading && <span className="project-header__loading">同步中…</span>}
          </div>
          {doneCount > 0 && (
            <button type="button" className="project-header__hide-done" onClick={toggleHideDone}>
              {hideDoneTasks ? `显示 ${doneCount} 已完成` : "隐藏已完成"}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
