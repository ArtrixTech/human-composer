import { useEffect, useState } from "react";

import * as api from "../../api/tauri";
import { useAppStore } from "../../store/appStore";

export function ArchivedBranchesPanel({ projectId }: { projectId: string }) {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const graphBranchCount = useAppStore((s) => s.graph?.branches.length);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void api.listArchivedBranches(projectId).then((list) => {
      setBranches(list.map((b) => ({ id: b.id, name: b.name })));
    });
  }, [projectId, graphBranchCount]);

  if (branches.length === 0) return null;

  return (
    <div className="project-workspace__archived">
      <p className="project-workspace__archived-title">已归档支线</p>
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() =>
            void api.unarchiveBranch(projectId, b.id).then(() => {
              void refreshAll();
              void api.listArchivedBranches(projectId).then((list) => {
                setBranches(list.map((x) => ({ id: x.id, name: x.name })));
              });
            })
          }
        >
          恢复「{b.name}」
        </button>
      ))}
    </div>
  );
}
