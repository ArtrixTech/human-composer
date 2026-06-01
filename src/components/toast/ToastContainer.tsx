import { useToastStore } from "../../store/toastStore";
import "./ToastContainer.css";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span>{toast.message}</span>
          <div className="toast__actions">
            {toast.onAction && toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  void toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  void toast.undo?.();
                  dismiss(toast.id);
                }}
              >
                Undo
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
