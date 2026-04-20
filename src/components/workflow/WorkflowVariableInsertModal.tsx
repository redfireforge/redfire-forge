import { useState, useMemo, useEffect } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  open: boolean;
  hints: WorkflowVariableHint[];
  onClose: () => void;
  /** Called with full template including braces, e.g. `{{node:uuid.vin}}` */
  onPick: (template: string) => void;
}

/**
 * Modal to pick a workflow / upstream variable and insert `{{ref}}` into URL, params, etc.
 */
export default function WorkflowVariableInsertModal({ open, hints, onClose, onPick }: Props) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return hints;
    return hints.filter(
      (h) =>
        h.ref.toLowerCase().includes(t) ||
        h.label.toLowerCase().includes(t),
    );
  }, [hints, q]);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wf-var-insert-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ram-modal wf-var-insert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ram-header">
          <h3 id="wf-var-insert-title">Insert variable</h3>
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="ram-body wf-var-insert-body">
          <p className="wf-config-hint-text" style={{ marginBottom: 10 }}>
            Choose a workflow default or a value from an upstream HTTP step. Scoped entries point at one specific step.
          </p>
          <input
            className="ram-input wf-var-insert-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or label…"
            autoFocus
            aria-label="Filter variables"
          />
          <ul className="wf-var-insert-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="wf-var-insert-empty">
                No matches
                {hints.length === 0
                  ? ' — add names under Initial variables (this step) or workflow defaults, or connect upstream HTTP steps with extractions.'
                  : '.'}
              </li>
            ) : (
              filtered.map((h) => (
                <li key={h.ref} role="option">
                  <button
                    type="button"
                    className="wf-var-insert-row"
                    onClick={() => onPick(`{{${h.ref}}}`)}
                  >
                    <span className="wf-var-insert-label">{h.label}</span>
                    <code className="wf-var-insert-code">{`{{${h.ref}}}`}</code>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="ram-footer">
          <button type="button" className="btn btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
