import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./OutcomeColumnHeader.css";

export interface OutcomeColumnHeaderData {
  label: string;
  branchId: string;
  progress?: string;
  taskCount?: number;
  onRename?: (branchId: string, name: string) => void;
  onArchive?: (branchId: string) => void;
  onDelete?: (branchId: string, taskCount: number) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  [key: string]: unknown;
}

const MENU_WIDTH = 128;

function OutcomeColumnHeaderComponent({
  label,
  branchId,
  progress,
  taskCount = 0,
  onRename,
  onArchive,
  onDelete,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
}: OutcomeColumnHeaderData) {

  const renameBranch = useAppStore((s) => s.renameBranch);
  const archiveBranch = useAppStore((s) => s.archiveBranch);
  const deleteBranch = useAppStore((s) => s.deleteBranch);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setName(label), [label]);

  const updateMenuPos = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
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
    void deleteBranch(branchId);
  };

  const menu = menuOpen && menuPos
    ? createPortal(
        <div
          ref={menuRef}
          className="branch-column-header__menu branch-column-header__menu--portal"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {canMoveLeft && onMoveLeft && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onMoveLeft();
              }}
            >
              左移
            </button>
          )}
          {canMoveRight && onMoveRight && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onMoveRight();
              }}
            >
              右移
            </button>
          )}
          <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }}>
            重命名
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              if (onArchive) onArchive(branchId);
              else void archiveBranch(branchId);
            }}
          >
            归档
          </button>
          <button type="button" className="danger" onClick={confirmDelete}>
            删除
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
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
          <div className="branch-column-header__title">
            <span className="branch-column-header__name">{label}</span>
            {progress && <span className="branch-column-header__progress">{progress}</span>}
          </div>
        )}
        <div className="branch-column-header__menu-wrap">
          <button
            ref={menuBtnRef}
            type="button"
            className="branch-column-header__menu-btn"
            aria-label="目标菜单"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              updateMenuPos();
              setMenuOpen(true);
            }}
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>
      {menu}
    </>
  );
}

export const OutcomeColumnHeader = memo(OutcomeColumnHeaderComponent);
/** @deprecated Use OutcomeColumnHeader */
export const BranchColumnHeader = OutcomeColumnHeader;
export type BranchColumnHeaderData = OutcomeColumnHeaderData;
