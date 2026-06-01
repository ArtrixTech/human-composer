import { useAppStore } from "../../store/appStore";
import "./ProjectHeader.css";

export function ProjectHeader() {
  const graph = useAppStore((s) => s.graph);
  const snapshot = useAppStore((s) => s.snapshot);
  const loading = useAppStore((s) => s.loading);

  if (!graph) return null;

  const activeCount = graph.tasks.filter((t) => t.status === "active").length;
  const readyCount = graph.tasks.filter((t) => t.status === "ready").length;
  const inboxCount = graph.tasks.filter((t) => t.status === "inbox").length;
  const topRec = snapshot?.recommendations[0];

  return (
    <header className="project-header">
      <div className="project-header__title">
        <h1>{graph.project.name}</h1>
        {topRec && (
          <span className="project-header__rec" title="推荐下一个">
            → {topRec.task.title}
          </span>
        )}
        {loading && <span className="project-header__loading">同步中…</span>}
      </div>
      <div className="project-header__stats">
        <Stat label="Active" value={activeCount} accent={activeCount > 0} />
        <Stat label="Ready" value={readyCount} />
        {inboxCount > 0 && <Stat label="Inbox" value={inboxCount} />}
        <Stat label="Branches" value={graph.branches.length} />
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
