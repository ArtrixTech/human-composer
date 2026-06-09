import { useState } from "react";

import { useAppStore } from "../../store/appStore";

export function AddTaskInline({ branchId }: { branchId: string }) {
  const addBranchTask = useAppStore((s) => s.addBranchTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    await addBranchTask(branchId, value);
    setTitle("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="branch-section__add-trigger"
        onClick={() => setOpen(true)}
      >
        + 添加行动…
      </button>
    );
  }

  return (
    <div className="branch-section__add-form">
      <input
        autoFocus
        placeholder="行动标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
      />
      <button type="button" onClick={() => void submit()}>
        添加
      </button>
    </div>
  );
}
