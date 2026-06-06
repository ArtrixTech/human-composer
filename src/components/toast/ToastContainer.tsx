import { useEffect, useState } from "react";

import { useToastStore } from "../../store/toastStore";
import "./ToastContainer.css";

function ToastItemView({
  id,
  message,
  undo,
  actionLabel,
  onAction,
  duration,
  createdAt,
  exiting,
  pausedAt,
}: {
  id: string;
  message: string;
  undo?: () => Promise<void>;
  actionLabel?: string;
  onAction?: () => Promise<void>;
  duration: number;
  createdAt: number;
  exiting?: boolean;
  pausedAt?: number;
}) {
  const dismiss = useToastStore((s) => s.dismiss);
  const pause = useToastStore((s) => s.pause);
  const resume = useToastStore((s) => s.resume);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (pausedAt) return;
    const tick = () => {
      const elapsed = Date.now() - createdAt;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
    };
    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [createdAt, duration, pausedAt]);

  return (
    <div
      className={`toast ${exiting ? "toast--exiting" : ""}`}
      onMouseEnter={() => pause(id)}
      onMouseLeave={() => resume(id)}
    >
      <span>{message}</span>
      <div className="toast__actions">
        {onAction && actionLabel && (
          <button
            type="button"
            onClick={() => {
              void onAction();
              dismiss(id);
            }}
          >
            {actionLabel}
          </button>
        )}
        {undo && (
          <button
            type="button"
            onClick={() => {
              void undo();
              dismiss(id);
            }}
          >
            Undo
          </button>
        )}
      </div>
      <div className="toast__progress">
        <div className="toast__progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItemView key={toast.id} {...toast} />
      ))}
    </div>
  );
}
