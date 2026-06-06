import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";

export interface LaneLabelNodeData {
  label: string;
  branchId: string;
  progress?: string;
  onRename?: (name: string) => void;
  onArchive?: () => void;
  [key: string]: unknown;
}

function LaneLabelNodeComponent({ data }: NodeProps) {
  const nodeData = data as LaneLabelNodeData;
  const { label, progress, onRename, onArchive } = nodeData;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);

  const submit = () => {
    const value = name.trim();
    if (value && value !== label) onRename?.(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="lane-label-input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <div
      className="lane-label"
      onDoubleClick={() => setEditing(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        onArchive?.();
      }}
      title="双击重命名，右键归档"
    >
      {label}
      {progress && <span className="lane-label__progress">{progress}</span>}
    </div>
  );
}

export const LaneLabelNode = memo(LaneLabelNodeComponent);
