import { useState } from 'react';
import { useWorkflowInspect } from './WorkflowInspectContext';
import { useModalDrag } from '../../hooks/useModalDrag';

interface Props {
  variables: Record<string, string>;
}

/**
 * Compact badge over the canvas; opens a modal with live variable snapshot + usage hint.
 * Replaces the always-on chip strip so the graph stays clear.
 */
export default function VariableContextBadge({ variables }: Props) {
  const { openVariableDetail } = useWorkflowInspect();
  const [open, setOpen] = useState(false);
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(open);
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="wf-var-badge"
        onClick={() => setOpen(true)}
        title="Open workflow context: values your {{variables}} resolve to after a run"
        aria-label={`Workflow context, ${entries.length} variables`}
      >
        <span className="wf-var-badge-label">Context</span>
        <span className="wf-var-badge-count">{entries.length}</span>
      </button>

      {open && (
        <div
          className="modal-overlay wf-detail-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={overlayStyle}
        >
          <div
            className="modal ram-modal wf-vars-modal wf-vars-modal--card"
            role="dialog"
            aria-labelledby="wf-vars-modal-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={modalStyle}
          >
            <div className="ram-header wf-vars-modal-header" style={{ cursor: 'move' }} onMouseDown={onDragStart}>
              <h3 id="wf-vars-modal-title">Workflow context</h3>
              <button type="button" className="ram-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
            {/* Do not use ram-body here — it applies a 2-column grid (regex modal) and breaks this layout. */}
            <div className="wf-vars-modal-body">
              <p className="wf-vars-modal-intro">
                After <strong>Quick Test</strong>, this is the snapshot of names and values your workflow uses when
                resolving <code>{'{{placeholders}}'}</code> in URLs, bodies, <strong>If/Else</strong> conditions, and
                delays. Use it to confirm extractions (e.g. <code>httpStatus</code>) and why a branch ran or skipped.
                Initial variables live in the right panel; extractions update when steps run.
              </p>
              <ul className="wf-vars-modal-list">
                {entries.map(([name, value]) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="wf-vars-modal-row"
                      title="View or edit in Initial variables"
                      onClick={() => {
                        openVariableDetail(name);
                        setOpen(false);
                      }}
                    >
                      <div className="wf-vars-modal-row-head">
                        <code className="wf-vars-modal-name">{`{{${name}}}`}</code>
                      </div>
                      <pre className="wf-vars-modal-val">{value}</pre>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ram-footer wf-vars-modal-footer">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
