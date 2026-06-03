import { memo, useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { MoreVertical } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./BranchColumnHeader.css";

export interface BranchColumnHeaderData {
  label: string;
  branchId: string;
  progress?: string;
  taskCount?: number;
  onRename?: (branchId: string, name: string) => void;
  onArchive?: (branchId: string) => void;
  onDelete?: (branchId: string, taskCount: number) => void;
  [key: string]: unknown;
}

function BranchColumnHeaderComponent({ data }: NodeProps) {
  const nodeData = data as BranchColumnHeaderData;
  const { label, branchId, progress, taskCount = 0, onRename, onArchive, onDelete } = nodeData;

  const renameBranch = useAppStore((s) => s.renameBranch);
  const archiveBranch = useAppStore((s) => s.archiveBranch);
  const deleteBranch = useAppStore((s) => s.deleteBranch);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(label), [label]);

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

  const commitRename = () => {
    const trimmed = name.trim();
    setEditing(false);
    if (trimmed && trimmed !== label) {
      if (onRename) onRename(branchId, trimmed);
      else void renameBranch(branchId, trimmed);
    } else {
      setName(label);
    }
  };

  const confirmDelete = () => {
    setMenuOpen(false);
    if (onDelete) {
      onDelete(branchId, taskCount);
      return;
    }
    const msg =
      taskCount > 0
        ? `删除支线「${label}」及其 ${taskCount} 个任务？此操作不可撤销。`
        : `删除空支线「${label}」？`;
    if (window.confirm(msg)) void deleteBranch(branchId);
  };

  return (
    <div className="branch-column-header">
      {editing ? (
        <input
          className="branch-column-header__input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setName(label);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="branch-column-header__title" title="拖拽调整列顺序">
          <span className="branch-column-header__name">{label}</span>
          {progress && <span className="branch-column-header__progress">{progress}</span>}
        </div>
      )}
      <div className="branch-column-header__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="branch-column-header__menu-btn"
          aria-label="支线菜单"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="branch-column-header__menu">
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
              重命名
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm(`归档支线「${label}」？`)) {
                  if (onArchive) onArchive(branchId);
                  else void archiveBranch(branchId);
                }
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

export const BranchColumnHeader = memo(BranchColumnHeaderComponent);
