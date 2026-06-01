import { useAppStore } from "../../store/appStore";
import "./ProjectHeader.css";

export function ProjectHeader() {
  const graph = useAppStore((s) => s.graph);
  const snapshot = useAppStore((s) => s.snapshot);
  const loading = useAppStore((s) => s.loading);
  const hideDoneTasks = useAppStore((s) => s.hideDoneTasks);
  const toggleHideDone = useAppStore((s) => s.toggleHideDone);

  if (!graph) return null;

  const activeCount = graph.tasks.filter((t) => t.status === "active").length;
  const readyCount = graph.tasks.filter((t) => t.status === "ready").length;
  const inboxCount = graph.tasks.filter((t) => t.status === "inbox").length;
  const doneCount = graph.tasks.filter((t) => t.status === "done").length;
  const totalCount = graph.tasks.filter((t) => t.status !== "inbox").length;
  const topRec = snapshot?.recommendations[0];
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <header className="project-header">
      <div className="project-header__title">
        <h1>{graph.project.name}</h1>
        {topRec && (
          <button
            type="button"
            className="project-header__rec"
            title="点击激活推荐任务"
            onClick={() =>
              useAppStore
                .getState()
                .activateTask(topRec.task.id, topRec.projectId ?? topRec.task.projectId)
            }
          >
            → {topRec.task.title}
          </button>
        )}
        {loading && <span className="project-header__loading">同步中…</span>}
      </div>
      <div className="project-header__stats">
        <div className="project-header__progress">
          <div className="project-header__progress-bar">
            <div className="project-header__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
        <Stat label="Active" value={activeCount} accent={activeCount > 0} />
        <Stat label="Ready" value={readyCount} />
        {inboxCount > 0 && <Stat label="Inbox" value={inboxCount} />}
        {doneCount > 0 && (
          <button type="button" className="project-header__hide-done" onClick={toggleHideDone}>
            {hideDoneTasks ? `显示 ${doneCount} done` : "隐藏已完成"}
          </button>
        )}
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`project-header__stat ${accent ? "project-header__stat--accent" : ""}`}>
      <span className="project-header__stat-value">{value}</span>
      <span className="project-header__stat-label">{label}</span>
    </div>
  );
}
