import { useState } from "react";

import { useAppStore } from "../../store/appStore";
import { ArchivedBranchesPanel } from "./ArchivedBranchesPanel";
import { ArchivedTasksSection } from "./ArchivedTasksSection";
import { KanbanBoard } from "./KanbanBoard";
import "./ProjectWorkspace.css";

export function ProjectWorkspace() {
  const graph = useAppStore((s) => s.graph);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const createBranch = useAppStore((s) => s.createBranch);

  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showArchivedBranches, setShowArchivedBranches] = useState(false);

  if (!graph || !activeProjectId) return null;

  const submitBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    await createBranch(name);
    setNewBranchName("");
    setAddingBranch(false);
  };

  return (
    <div className="project-workspace">
      <div className="project-workspace__toolbar">
        {addingBranch ? (
          <div className="project-workspace__new-branch">
            <input
              autoFocus
              placeholder="支线名称"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitBranch();
                if (e.key === "Escape") {
                  setAddingBranch(false);
                  setNewBranchName("");
                }
              }}
            />
            <button type="button" onClick={() => void submitBranch()}>
              创建
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingBranch(false);
                setNewBranchName("");
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingBranch(true)}>
            + 新支线
          </button>
        )}
        <button type="button" onClick={() => setShowArchivedBranches((s) => !s)}>
          {showArchivedBranches ? "隐藏已归档支线" : "显示已归档支线"}
        </button>
      </div>

      <div className="project-workspace__board-scroll">
        <KanbanBoard />
      </div>

      {showArchivedBranches && <ArchivedBranchesPanel projectId={activeProjectId} />}
      <ArchivedTasksSection projectId={activeProjectId} />
    </div>
  );
}
