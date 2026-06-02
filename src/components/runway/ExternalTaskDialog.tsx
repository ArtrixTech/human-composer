import { useState } from "react";
import { Bot } from "lucide-react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";

export function ExternalTaskDialog({
  ctx,
  laneId,
  onClose,
}: {
  ctx: TodayTaskContext;
  laneId: string;
  onClose: () => void;
}) {
  const startExternal = useAppStore((s) => s.startExternal);
  const defaultMinutes = ctx.task.estimatedMinutes ?? 30;
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedMinutes = Number.parseInt(minutes, 10);
  const valid = Number.isFinite(parsedMinutes) && parsedMinutes > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await startExternal(
        ctx.task.id,
        ctx.projectId,
        laneId,
        parsedMinutes,
        note.trim() || undefined,
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="external-dialog__backdrop"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="external-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="external-dialog__header">
          <Bot size={18} className="external-dialog__icon" />
          <div>
            <h3 id="external-dialog-title">委派外部执行</h3>
            <p className="external-dialog__subtitle">{ctx.task.title}</p>
          </div>
        </div>

        <p className="external-dialog__hint">
          任务将移入等待泳道，由 Agent / CI / 他人执行。完成后会提醒你审核。
        </p>

        <label className="external-dialog__field">
          <span>预估耗时（分钟）</span>
          <input
            type="number"
            min={1}
            value={minutes}
            autoFocus
            onChange={(e) => setMinutes(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </label>

        <label className="external-dialog__field">
          <span>备注（可选）</span>
          <textarea
            rows={2}
            placeholder="链接、指令摘要…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="external-dialog__actions">
          <button type="button" className="external-dialog__cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="external-dialog__submit"
            disabled={!valid || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "启动中…" : "启动外部执行"}
          </button>
        </div>
      </div>
    </div>
  );
}
