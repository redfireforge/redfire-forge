import type { ReactNode } from 'react';
import PopupModal from './PopupModal';

interface Props {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title = 'Confirm',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <PopupModal
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
    </PopupModal>
  );
}
