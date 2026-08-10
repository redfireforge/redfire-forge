import { useMemo, useId, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClassifiedDrift } from './utils/schemaDrift';
import type { RepairSuggestion } from './utils/schemaRepair';
import { useModalFrame } from '../../hooks/useModalFrame';
import ModalResizeHandles from '../ModalResizeHandles';

interface SchemaDiffModalProps {
  drifts: ClassifiedDrift[];
  onClose: () => void;
  /** Confirm accept-and-update (only used when acceptMode is true). */
  onAccept?: () => void;
  repairSuggestions?: Map<string, RepairSuggestion[]>;
  onApplyRepair?: (mappingId: string, suggestion: RepairSuggestion) => void;
  onApplyRepairBatch?: (repairs: Array<{ mappingId: string; suggestion: RepairSuggestion }>) => void;
  /** When true, the footer shows Cancel + Accept & Update instead of just Close */
  acceptMode?: boolean;
}

export default function SchemaDiffModal({
  drifts,
  onClose,
  onAccept,
  repairSuggestions,
  onApplyRepair,
  onApplyRepairBatch,
  acceptMode,
}: SchemaDiffModalProps) {
  const titleId = useId();
  const previousFocusRef = useRef<Element | null>(null);

  const {
    isDragged,
    overlayStyle,
    dialogStyle,
    headerDragStyle,
    onHeaderMouseDown,
    dialogRef,
    onRightEdge,
    onCorner,
    onBottomEdge,
  } = useModalFrame({
    open: true,
    minWidth: 500,
    minHeight: 300,
    constrainDragToViewport: true,
    dragViewportPadding: 8,
  });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [dialogRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const [openRepairPath, setOpenRepairPath] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const order = { breaking: 0, warning: 1, info: 2 } as const;
    return [...drifts].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [drifts]);

  const counts = useMemo(() => {
    let breaking = 0, warning = 0, info = 0;
    for (const d of drifts) {
      if (d.severity === 'breaking') breaking++;
      else if (d.severity === 'warning') warning++;
      else info++;
    }
    return { breaking, warning, info };
  }, [drifts]);

  const batchRepairs = useMemo(() => {
    if (!repairSuggestions) return [];
    const bestSuggestionByMapping = new Map<string, RepairSuggestion>();
    for (const drift of sorted) {
      if (drift.severity !== 'breaking' || drift.affectedMappingIds.length === 0) continue;
      const suggestions = repairSuggestions.get(drift.path) ?? [];
      for (const suggestion of suggestions) {
        const prev = bestSuggestionByMapping.get(suggestion.mappingId);
        if (!prev || suggestion.confidence > prev.confidence) {
          bestSuggestionByMapping.set(suggestion.mappingId, suggestion);
        }
      }
    }
    return Array.from(bestSuggestionByMapping.entries()).map(([mappingId, suggestion]) => ({
      mappingId,
      suggestion,
    }));
  }, [repairSuggestions, sorted]);

  return createPortal(
    <div className="dm-diff-overlay" style={overlayStyle}>
      <div
        ref={dialogRef}
        className={`dm-diff-shell${isDragged ? ' dm-diff-shell--positioned' : ''}`}
        style={dialogStyle}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="dm-diff-header"
          onMouseDown={onHeaderMouseDown}
          style={headerDragStyle}
        >
          <h3 id={titleId} className="dm-diff-title">Schema Changes</h3>
          <div className="dm-diff-summary-badges">
            {counts.breaking > 0 && (
              <span className="dm-diff-count dm-diff-count--breaking">{counts.breaking} breaking</span>
            )}
            {counts.warning > 0 && (
              <span className="dm-diff-count dm-diff-count--warning">{counts.warning} warning</span>
            )}
            {counts.info > 0 && (
              <span className="dm-diff-count dm-diff-count--info">{counts.info} info</span>
            )}
          </div>
        </div>
        {onApplyRepairBatch && batchRepairs.length > 0 && (
          <div className="dm-diff-batch-actions">
            <button
              type="button"
              className="dm-repair-btn dm-repair-btn--batch"
              onClick={() => onApplyRepairBatch(batchRepairs)}
            >
              Apply all repairs ({batchRepairs.length})
            </button>
          </div>
        )}
        <div className="dm-diff-body">
          <table className="dm-diff-table">
            <thead>
              <tr>
                <th className="dm-diff-th">Severity</th>
                <th className="dm-diff-th">Field Path</th>
                <th className="dm-diff-th">Change</th>
                <th className="dm-diff-th">Saved Type</th>
                <th className="dm-diff-th">Current Type</th>
                <th className="dm-diff-th">Mappings</th>
                {repairSuggestions && <th className="dm-diff-th">Repair</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => {
                const suggestions = repairSuggestions?.get(d.path);
                const topSuggestion = suggestions?.[0];
                const isOpen = openRepairPath === d.path;
                return (
                  <tr key={`${d.path}-${i}`} className={`dm-diff-row dm-diff-row--${d.severity}`}>
                    <td className="dm-diff-td">
                      <span className={`dm-diff-severity dm-diff-severity--${d.severity}`}>
                        {d.severity === 'breaking' ? '⛔' : d.severity === 'warning' ? '⚠' : 'ℹ'}
                        {' '}{d.severity}
                      </span>
                    </td>
                    <td className="dm-diff-td dm-diff-path">{d.path}</td>
                    <td className="dm-diff-td">
                      <span className={`dm-diff-type-label dm-diff-type-label--${d.driftType}`}>
                        {d.driftType === 'added' ? '+ added' :
                         d.driftType === 'removed' ? '− removed' :
                         d.driftType === 'typeChanged' ? '≠ type changed' :
                         '~ nullable'}
                      </span>
                    </td>
                    <td className="dm-diff-td dm-diff-type">
                      {d.savedType ?? '—'}
                    </td>
                    <td className="dm-diff-td dm-diff-type">
                      {d.currentType ?? '—'}
                    </td>
                    <td className="dm-diff-td">
                      {d.affectedMappingIds.length > 0
                        ? <span className="dm-diff-affected">{d.affectedMappingIds.length}</span>
                        : '—'}
                    </td>
                    {repairSuggestions && (
                      <td className="dm-diff-td dm-diff-repair-cell">
                        {d.severity === 'breaking' && topSuggestion && onApplyRepair ? (
                          <div className="dm-repair-dropdown-wrapper">
                            <button
                              className="dm-repair-btn"
                              onClick={() => setOpenRepairPath(isOpen ? null : d.path)}
                              aria-expanded={isOpen}
                              aria-label={`Repair ${d.path}`}
                            >
                              🔧 Repair ({suggestions!.length})
                            </button>
                            {isOpen && (
                              <div className="dm-repair-dropdown">
                                {suggestions!.map((s, si) => (
                                  <div key={si} className="dm-repair-suggestion">
                                    <div className="dm-repair-suggestion-header">
                                      <span className="dm-repair-suggestion-path">{s.suggestedPath}</span>
                                      <span className={`dm-repair-confidence dm-repair-confidence--${s.confidence >= 70 ? 'high' : s.confidence >= 40 ? 'medium' : 'low'}`}>
                                        {s.confidence}%
                                      </span>
                                    </div>
                                    <div className="dm-repair-suggestion-reason">{s.reason}</div>
                                    <button
                                      className="dm-repair-apply-btn"
                                      onClick={() => {
                                        onApplyRepair(s.mappingId, s);
                                        setOpenRepairPath(null);
                                      }}
                                    >
                                      Apply
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : d.severity === 'breaking' && d.affectedMappingIds.length > 0 ? (
                          <span className="dm-repair-none">No suggestions</span>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="dm-diff-footer">
          {acceptMode ? (
            <>
              <button
                type="button"
                className="dm-modal-btn dm-modal-btn--secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dm-modal-btn dm-modal-btn--primary"
                onClick={onAccept ?? onClose}
              >
                Accept &amp; Update
              </button>
            </>
          ) : (
            <button type="button" className="dm-modal-btn dm-modal-btn--secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        <ModalResizeHandles
          onRightEdge={onRightEdge}
          onCorner={onCorner}
          onBottomEdge={onBottomEdge}
        />
      </div>
    </div>,
    document.body,
  );
}
