import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Branch, Task } from "../../types";
import { useAppStore } from "../../store/appStore";
import "./BranchSectionHeader.css";

export function BranchSectionHeader({
  branch,
  tasks,
  collapsed,
  onToggle,
}: {
  branch: Branch;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const renameBranch = useAppStore((s) => s.renameBranch);
  const archiveBranch = useAppStore((s) => s.archiveBranch);
  const deleteBranch = useAppStore((s) => s.deleteBranch);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(branch.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: branch.id,
  });

  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;

  useEffect(() => setName(branch.name), [branch.name]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const commitRename = async () => {
    const trimmed = name.trim();
    setEditing(false);
    if (trimmed && trimmed !== branch.name) {
      await renameBranch(branch.id, trimmed);
    } else {
      setName(branch.name);
    }
  };

  const confirmDelete = () => {
    setMenuOpen(false);
    const msg =
      total > 0
        ? `删除支线「${branch.name}」及其 ${total} 个任务？此操作不可撤销。`
        : `删除空支线「${branch.name}」？`;
    if (window.confirm(msg)) void deleteBranch(branch.id);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="branch-header">
      <button
        type="button"
        className="branch-header__drag"
        aria-label="拖拽调整支线顺序"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      {editing ? (
        <input
          className="branch-header__name-input"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commitRename();
            if (e.key === "Escape") {
              setName(branch.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="branch-header__toggle" onClick={onToggle}>
          <ChevronRight
            size={14}
            style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform 0.15s" }}
          />
          <span>{branch.name}</span>
          <span className="branch-header__progress">
            {done}/{total}
          </span>
        </button>
      )}
      <div className="branch-header__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="branch-header__menu-btn"
          aria-label="支线菜单"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="branch-header__menu">
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
              重命名
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm(`归档支线「${branch.name}」？`)) void archiveBranch(branch.id);
              }}
            >
              归档
            </button>
            <button type="button" className="danger" onClick={confirmDelete}>
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
