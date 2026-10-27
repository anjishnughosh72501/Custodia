import { useEffect } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  tone?: "ok" | "warn" | "bad" | "info";
}

interface ToastsProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        onDismiss(t.id);
      }, 3000)
    );
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) {
    return <div className="toasts-container sr" aria-live="polite" aria-atomic="true" />;
  }

  // Display at most 3 toasts
  const visible = toasts.slice(-3);

  return (
    <div
      className="toasts-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="true"
    >
      {visible.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.tone ?? "ok"}`} role="status">
          <span className="toast-text">{t.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
