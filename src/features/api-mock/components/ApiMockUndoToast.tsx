import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export const API_MOCK_UNDO_DISMISS_MS = 5000;

interface Props {
  label: string;
  /** Stable id so a second delete with the same display name restarts the timer. */
  undoKey?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Timed undo affordance after a confirmed route delete (W6 recovery).
 * Reuses the shared trash-toast chrome so the Studio matches Feature Group undo.
 */
export function ApiMockUndoToast({ label, undoKey, onUndo, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onUndoRef = useRef(onUndo);
  const onDismissRef = useRef(onDismiss);
  onUndoRef.current = onUndo;
  onDismissRef.current = onDismiss;
  const timerKey = undoKey ?? label;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismissRef.current(), API_MOCK_UNDO_DISMISS_MS);
    return () => { clearTimeout(timerRef.current); };
  }, [timerKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (
        el.isContentEditable
        || el.closest('input, textarea, select, .monaco-editor, [role="textbox"], .confirm-dialog, .confirm-overlay, dialog, .modal')
      )) return;
      if (document.querySelector('.confirm-dialog, .confirm-overlay, dialog, .modal, [role="dialog"]')) return;
      e.preventDefault();
      clearTimeout(timerRef.current);
      onUndoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleUndo = () => {
    clearTimeout(timerRef.current);
    onUndoRef.current();
  };

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    onDismissRef.current();
  };

  return createPortal(
    <div className="trash-toast-container" role="alert" aria-live="assertive" data-testid="api-mock-undo-toast">
      <div className="trash-toast">
        <span className="trash-toast-icon" aria-hidden="true">&#x2212;</span>
        <div className="trash-toast-body">
          <span className="trash-toast-message">
            Deleted <span className="trash-toast-entity">{label}</span>
          </span>
        </div>
        <button
          type="button"
          className="trash-toast-undo"
          onClick={handleUndo}
          aria-label="Undo delete"
          data-testid="api-mock-undo-restore"
        >
          Undo
        </button>
        <button
          type="button"
          className="trash-toast-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
          data-testid="api-mock-undo-dismiss"
        >
          Dismiss
        </button>
        <div
          key={timerKey}
          className="trash-toast-progress"
          style={{ animationDuration: `${API_MOCK_UNDO_DISMISS_MS}ms` }}
        />
      </div>
    </div>,
    document.body,
  );
}
