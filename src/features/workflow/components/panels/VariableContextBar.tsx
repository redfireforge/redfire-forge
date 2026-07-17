import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWorkflowInspect } from './WorkflowInspectContext';
import { useModalDrag } from '../../../../shared/hooks/useModalDrag';

const WF_CONTEXT_MODAL_MOUNT =
  () => document.querySelector('.workflow-designer-mount') || document.body;

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
  const [search, setSearch] = useState('');
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(open);
  const entries = Object.entries(variables);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([name, value]) =>
      name.toLowerCase().includes(q) || String(value).toLowerCase().includes(q),
    );
  }, [entries, search]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

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

      {open && createPortal(
        <div
          className="modal-overlay wf-vars-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); handleClose(); } }}
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
            </div>
            <div className="wf-vars-modal-body">
              <p className="wf-vars-modal-intro">
                After <strong>Quick Test</strong>, this is the snapshot of names and values your workflow uses when
                resolving <code>{'{{placeholders}}'}</code> in URLs, bodies, <strong>If/Else</strong> conditions, and
                delays. Use it to confirm extractions (e.g. <code>httpStatus</code>) and why a branch ran or skipped.
                Initial variables live in the right panel; extractions update when steps run.
              </p>
              <input
                className="wf-vars-modal-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variables…"
                autoFocus
                aria-label="Search variables"
              />
              {filteredEntries.length === 0 ? (
                <div className="wf-vars-modal-no-results">
                  No variables match &ldquo;{search.trim()}&rdquo;
                </div>
              ) : (
                <ul className="wf-vars-modal-list">
                  {filteredEntries.map(([name, value]) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="wf-vars-modal-row"
                        title="View or edit in Initial variables"
                        onClick={() => {
                          openVariableDetail(name, value);
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
              )}
            </div>
            <div className="ram-footer wf-vars-modal-footer">
              <button type="button" className="btn btn-sm btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>,
        WF_CONTEXT_MODAL_MOUNT(),
      )}
    </>
  );
}
