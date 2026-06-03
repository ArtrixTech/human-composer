import { useEffect, useState } from "react";
import { Archive } from "lucide-react";

import * as api from "../../api/tauri";
import type { Task } from "../../types";
import { useAppStore } from "../../store/appStore";

export function ArchivedTasksSection({ projectId }: { projectId: string }) {
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const graph = useAppStore((s) => s.graph);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    void api.listArchivedTasks(projectId).then(setTasks);
  }, [open, projectId, graph?.tasks.length]);

  return (
    <div className="project-workspace__archived">
      <button type="button" className="project-workspace__archived-toggle" onClick={() => setOpen((o) => !o)}>
        <Archive size={14} />
        {open ? "隐藏已归档任务" : "显示已归档任务"}
        {tasks.length > 0 && open && ` (${tasks.length})`}
      </button>
      {open && (
        <ul className="project-workspace__archived-list">
          {tasks.length === 0 ? (
            <li className="project-workspace__archived-empty">暂无已归档任务</li>
          ) : (
            tasks.map((t) => (
              <li key={t.id}>
                <span>{t.title}</span>
                <button type="button" onClick={() => void unarchiveTask(t.id, projectId)}>
                  恢复
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
