import { useCallback, useState } from 'react';

export type ConfirmAction = {
  message: string;
  onConfirm: () => void;
  detail?: string;
  stage?: 'warning' | 'final';
};

export function useConfirmDialog() {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const confirm = useCallback((message: string, onConfirm: () => void, detail?: string) => {
    setConfirmAction({ message, onConfirm, detail, stage: detail ? 'warning' : 'final' });
  }, []);

  const confirmDialogElement =
    confirmAction && (
      <div className="confirm-overlay">
        <div className="confirm-dialog">
          {confirmAction.stage === 'warning' ? (
            <>
              <div className="confirm-icon confirm-icon-warn">&#9888;</div>
              <p className="confirm-title">Warning</p>
              <p className="confirm-message">{confirmAction.message}</p>
              <div className="confirm-detail">{confirmAction.detail}</div>
              <div className="confirm-actions">
                <button className="btn-cancel" type="button" onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => setConfirmAction({ ...confirmAction, stage: 'final' })}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="confirm-icon confirm-icon-danger">&#128680;</div>
              <p className="confirm-title">Confirm Deletion</p>
              <p className="confirm-message">{confirmAction.message}</p>
              <p className="confirm-final-note">This action cannot be undone.</p>
              <div className="confirm-actions">
                <button className="btn-cancel" type="button" onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  return {
    confirmAction,
    setConfirmAction,
    confirm,
    confirmDialogElement,
  };
}
