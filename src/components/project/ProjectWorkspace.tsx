import { useState } from "react";

import { useAppStore } from "../../store/appStore";
import { KanbanBoard } from "./KanbanBoard";
import { ProjectFooterBar } from "./ProjectFooterBar";
import "./ProjectWorkspace.css";

export function ProjectWorkspace() {
  const graph = useAppStore((s) => s.graph);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const createBranch = useAppStore((s) => s.createBranch);

  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

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
              placeholder="可衡量的目标，如「登录页可上线」"
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
            <button type="button" className="project-workspace__toolbar-action" onClick={() => void submitBranch()}>
              创建
            </button>
            <button
              type="button"
              className="project-workspace__toolbar-action"
              onClick={() => {
                setAddingBranch(false);
                setNewBranchName("");
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="project-workspace__toolbar-action" onClick={() => setAddingBranch(true)}>
            + 新目标
          </button>
        )}
      </div>

      <div className="project-workspace__board-scroll">
        <KanbanBoard />
      </div>

      <ProjectFooterBar projectId={activeProjectId} />
    </div>
  );
}
