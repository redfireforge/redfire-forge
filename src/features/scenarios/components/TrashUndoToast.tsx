import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TrashItem } from '@shared/types';

const DISMISS_MS = 5000;

interface Props {
  item: TrashItem;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function TrashUndoToast({ item, onUndo, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismissRef.current(), DISMISS_MS);
    return () => { clearTimeout(timerRef.current); };
  }, [item.id]);

  const handleUndo = () => {
    clearTimeout(timerRef.current);
    onUndo();
  };

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    onDismiss();
  };

  return createPortal(
    <div className="trash-toast-container" role="alert" aria-live="assertive">
      <div className="trash-toast">
        <span className="trash-toast-icon" aria-hidden="true">&#x2212;</span>
        <div className="trash-toast-body">
          <span className="trash-toast-message">
            <span className="trash-toast-entity">{item.entityName}</span> moved to Trash
          </span>
        </div>
        <button
          className="trash-toast-undo"
          onClick={handleUndo}
          aria-label="Undo delete"
        >
          Undo
        </button>
        <button
          className="trash-toast-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
        <div
          key={item.id}
          className="trash-toast-progress"
          style={{ animationDuration: `${DISMISS_MS}ms` }}
        />
      </div>
    </div>,
    document.body,
  );
}
