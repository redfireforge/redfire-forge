import { useCallback, useState, useEffect } from 'react';
import WorkflowResponseBody from './WorkflowResponseBody';
import { useModalDrag } from '../../hooks/useModalDrag';
import { useModalExpand } from '../../hooks/useModalExpand';
import { useModalResize } from '../../hooks/useModalResize';
import ModalExpandButton from '../shared/ModalExpandButton';
import ModalResizeHandles from '../shared/ModalResizeHandles';

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

  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(open);

  // ── Pretty-print toggle ───────────────────────────────────────────────────
  const [pretty, setPretty] = useState(false);
  const { expanded, setExpanded, toggleExpand, expandClass } = useModalExpand();
  const { resizeStyle, onRightEdge, onCorner } = useModalResize();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset UI state when modal opens/closes
  useEffect(() => { setPretty(false); setExpanded(false); }, [open, setExpanded]);

  const prettyValue = (() => {
    if (!pretty || !variableMode) return null;
    const raw = (variableValue ?? '').trim();
    if (!raw) return null;
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return null;
    }
  })();

  /** Can the value be parsed as JSON? */
  const isJson = (() => {
    const raw = (variableValue ?? '').trim();
    if (!raw) return false;
    try { JSON.parse(raw); return true; } catch { return false; }
  })();

  if (!open) return null;

  return (
    <div
      className="modal-overlay wf-detail-modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={overlayStyle}
    >
      <div
        className={`modal ram-modal wf-detail-modal ${variableMode ? '' : 'wf-detail-modal--wide'} ${expandClass}`}
        role="dialog"
        aria-labelledby="wf-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalStyle, ...resizeStyle }}
      >
        <div className="ram-header" style={{ cursor: 'move' }} onMouseDown={onDragStart}>
          <h3 id="wf-detail-title">{title}</h3>
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="ram-body wf-detail-modal-body">
          {variableMode ? (
            <>
              {subtitle && <p className="wf-detail-modal-sub">{subtitle}</p>}
              {isJson && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button
                    type="button"
                    className={`btn btn-sm${pretty ? ' btn-accent' : ''}`}
                    onClick={() => setPretty(p => !p)}
                    title={pretty ? 'Show raw value' : 'Pretty-print JSON (read-only)'}
                  >
                    {pretty ? '{ } Raw' : '{ } Pretty'}
                  </button>
                </div>
              )}
              {pretty && prettyValue != null ? (
                <pre className="wf-detail-modal-pretty">{prettyValue}</pre>
              ) : (
                <textarea
                  className="wf-detail-modal-textarea"
                  value={variableValue ?? ''}
                  onChange={(e) => onVariableChange?.(e.target.value)}
                  spellCheck={false}
                  rows={16}
                />
              )}
            </>
          ) : (
            <WorkflowResponseBody body={body ?? ''} subtitle={subtitle} />
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
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />
        </div>
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>
    </div>
  );
}
