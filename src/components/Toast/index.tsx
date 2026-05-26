import { useToastStore } from '../../store/useToastStore';

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span className="toast__message">{toast.message}</span>
          <div className="toast__actions">
            {toast.undoFn && (
              <button
                className="toast__undo"
                onClick={async () => {
                  await toast.undoFn!();
                  dismiss(toast.id);
                }}
              >
                Undo
              </button>
            )}
            <button className="toast__dismiss" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
