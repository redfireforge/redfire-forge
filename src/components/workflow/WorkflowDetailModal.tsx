import { useCallback } from 'react';
import WorkflowResponseBody from './WorkflowResponseBody';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Step result: read-only body */
  body?: string;
  /** Variable: editable */
  variableMode?: boolean;
  variableValue?: string;
  onVariableChange?: (v: string) => void;
  onApplyVariable?: () => void;
  onClose: () => void;
}

export default function WorkflowDetailModal({
  open,
  title,
  subtitle,
  body,
  variableMode,
  variableValue,
  onVariableChange,
  onApplyVariable,
  onClose,
}: Props) {
  const copy = useCallback(async () => {
    const text = variableMode ? variableValue ?? '' : body ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, [body, variableMode, variableValue]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay wf-detail-modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`modal ram-modal wf-detail-modal ${variableMode ? '' : 'wf-detail-modal--wide'}`}
        role="dialog"
        aria-labelledby="wf-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ram-header">
          <h3 id="wf-detail-title">{title}</h3>
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="ram-body wf-detail-modal-body">
          {subtitle && <p className="wf-detail-modal-sub">{subtitle}</p>}
          {variableMode ? (
            <textarea
              className="wf-detail-modal-textarea"
              value={variableValue ?? ''}
              onChange={(e) => onVariableChange?.(e.target.value)}
              spellCheck={false}
              rows={16}
            />
          ) : (
            <WorkflowResponseBody body={body ?? ''} />
          )}
        </div>
        <div className="ram-footer wf-detail-modal-footer">
          <button type="button" className="btn btn-sm" onClick={copy}>
            Copy
          </button>
          <div style={{ flex: 1 }} />
          {variableMode && (
            <button type="button" className="btn btn-sm btn-accent" onClick={onApplyVariable}>
              Apply
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
