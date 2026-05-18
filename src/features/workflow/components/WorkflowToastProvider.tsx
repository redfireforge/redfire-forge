import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
  durationMs?: number;
}

export interface ToastApi {
  show: (type: ToastType, title: string, subtitle?: string, durationMs?: number) => void;
  dismiss: (id: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastApi | null>(null);

const ICON_MAP: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'i',
  warning: '!',
};

export default function WorkflowToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, title: string, subtitle?: string, durationMs = 4000) => {
    const id = `toast-${++nextId.current}`;
    const t: Toast = { id, type, title, subtitle, durationMs };
    setToasts((prev) => [...prev, t]);
    if (durationMs > 0) {
      window.setTimeout(() => dismiss(id), durationMs);
    }
  }, [dismiss]);

  const api: ToastApi = { show, dismiss };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="wf-toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`wf-toast wf-toast-${t.type}`}>
              <span className="wf-toast-icon">{ICON_MAP[t.type]}</span>
              <div className="wf-toast-body">
                <div className="wf-toast-title">{t.title}</div>
                {t.subtitle && <div className="wf-toast-sub">{t.subtitle}</div>}
              </div>
              <button
                className="wf-toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
              {(t.durationMs ?? 0) > 0 && (
                <div
                  className={`wf-toast-progress wf-toast-progress-${t.type}`}
                  style={{ animationDuration: `${t.durationMs}ms` }}
                />
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
