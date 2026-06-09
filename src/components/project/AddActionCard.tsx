import { useState } from "react";

import "../dag/TaskNode.css";

export function AddActionCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const value = title.trim();
    if (!value) return;
    onAdd(value);
    setTitle("");
    setOpen(false);
  };

  if (open) {
    return (
      <div className="add-task-node add-task-node--input">
        <input
          autoFocus
          placeholder="行动名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <button type="button" className="add-task-node add-task-node--btn" onClick={() => setOpen(true)}>
      + 添加行动
    </button>
  );
}
