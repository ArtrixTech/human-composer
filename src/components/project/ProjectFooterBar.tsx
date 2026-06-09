import { useEffect, useRef, useState } from "react";
import { Archive, MoreHorizontal } from "lucide-react";

import * as api from "../../api/tauri";
import type { Task } from "../../types";
import { useAppStore } from "../../store/appStore";
import "./ProjectFooterBar.css";

interface ArchivedBranch {
  id: string;
  name: string;
}

export function ProjectFooterBar({ projectId }: { projectId: string }) {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const graphBranchCount = useAppStore((s) => s.graph?.outcomes.length);
  const graphTaskCount = useAppStore((s) => s.graph?.actions.length);

  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<ArchivedBranch[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void api.listArchivedBranches(projectId).then((list) => {
      setBranches(list.map((b) => ({ id: b.id, name: b.name })));
    });
    void api.listArchivedTasks(projectId).then(setTasks);
  }, [open, projectId, graphBranchCount, graphTaskCount]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const restoreBranch = (branchId: string) => {
    void api.unarchiveBranch(projectId, branchId).then(() => {
      void refreshAll();
      void api.listArchivedBranches(projectId).then((list) => {
        setBranches(list.map((b) => ({ id: b.id, name: b.name })));
      });
    });
  };

  return (
    <div className="project-footer-bar" ref={wrapRef}>
      <button
        type="button"
        className="project-footer-bar__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <MoreHorizontal size={14} />
        <span>归档</span>
      </button>

      {open && (
        <div className="project-footer-bar__popover">
          <section className="project-footer-bar__section">
            <h4 className="project-footer-bar__heading">
              <Archive size={12} />
              已归档目标
            </h4>
            {branches.length === 0 ? (
              <p className="project-footer-bar__empty">暂无已归档目标</p>
            ) : (
              <ul className="project-footer-bar__list">
                {branches.map((b) => (
                  <li key={b.id}>
                    <span>{b.name}</span>
                    <button type="button" onClick={() => restoreBranch(b.id)}>
                      恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="project-footer-bar__section">
            <h4 className="project-footer-bar__heading">
              <Archive size={12} />
              已归档行动
            </h4>
            {tasks.length === 0 ? (
              <p className="project-footer-bar__empty">暂无已归档行动</p>
            ) : (
              <ul className="project-footer-bar__list">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <span>{t.title}</span>
                    <button type="button" onClick={() => void unarchiveTask(t.id, projectId)}>
                      恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
