import { useState, useMemo, useCallback } from 'react';
import type { WorkflowVersion } from '../../types/workflow';
import { generateChangeSummary } from '../../utils/workflowVersioning';
import { formatRelativeTime, formatTimestamp } from '@shared/utils/formatRelativeTime';
import '../../../../styles/workflow-version-panel.css';

interface Props {
  versions: WorkflowVersion[];
  onRestore: (version: WorkflowVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, label: string) => void;
  onCompare: (older: WorkflowVersion, newer: WorkflowVersion) => void;
  onClose: () => void;
}

export default function WorkflowVersionPanel({
  versions,
  onRestore,
  onDelete,
  onRename,
  onCompare,
  onClose,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 2) {
          const iter = next.values();
          next.delete(iter.next().value!);
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const canCompare = selectedIds.size === 2;

  const handleCompare = useCallback(() => {
    if (!canCompare) return;
    const ids = [...selectedIds];
    const a = versions.find((v) => v.id === ids[0]);
    const b = versions.find((v) => v.id === ids[1]);
    if (!a || !b) return;
    const [older, newer] = a.timestamp <= b.timestamp ? [a, b] : [b, a];
    onCompare(older, newer);
  }, [canCompare, selectedIds, versions, onCompare]);

  const handleStartRename = useCallback((v: WorkflowVersion) => {
    setEditingId(v.id);
    setEditLabel(v.label ?? '');
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingId) {
      onRename(editingId, editLabel.trim());
      setEditingId(null);
    }
  }, [editingId, editLabel, onRename]);

  const changeSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < versions.length - 1; i++) {
      map.set(versions[i].id, generateChangeSummary(versions[i + 1], versions[i]));
    }
    if (versions.length > 0) {
      map.set(versions[versions.length - 1].id, 'Initial version');
    }
    return map;
  }, [versions]);

  return (
    <div className="wfv-panel">
      <div className="wfv-header">
        <div className="wfv-header-title">
          <svg className="wfv-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          <span>Version History</span>
        </div>
        <div className="wfv-header-actions">
          <button
            className={`wfv-compare-btn ${canCompare ? 'wfv-compare-btn-active' : ''}`}
            onClick={handleCompare}
            disabled={!canCompare}
            title={canCompare ? 'Compare selected versions' : 'Select 2 versions to compare'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M21 3l-7 7M3 21l7-7" />
            </svg>
            Compare
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="wfv-selection-bar">
          <span>{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      <div className="wfv-list">
        {versions.length === 0 ? (
          <div className="wfv-empty">
            <svg className="wfv-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            <p className="wfv-empty-title">No versions yet</p>
            <p className="wfv-empty-hint">Save the workflow to create your first version snapshot</p>
          </div>
        ) : (
          versions.map((v, index) => {
            const isSelected = selectedIds.has(v.id);
            const isHovered = hoveredId === v.id;
            const isLatest = index === 0;
            const summary = changeSummaries.get(v.id) ?? '';

            return (
              <div
                key={v.id}
                className={`wfv-item ${isSelected ? 'wfv-item-selected' : ''} ${isHovered ? 'wfv-item-hovered' : ''}`}
                onClick={() => toggleSelect(v.id)}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="wfv-item-selector">
                  <div className={`wfv-checkbox ${isSelected ? 'wfv-checkbox-checked' : ''}`}>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="wfv-item-timeline">
                  <div className={`wfv-timeline-dot ${isLatest ? 'wfv-timeline-dot-latest' : ''}`} />
                  {index < versions.length - 1 && <div className="wfv-timeline-line" />}
                </div>

                <div className="wfv-item-content">
                  <div className="wfv-item-header">
                    {editingId === v.id ? (
                      <input
                        className="wfv-label-input"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        placeholder="Version label…"
                      />
                    ) : (
                      <div className="wfv-item-title-row">
                        <span
                          className="wfv-item-label"
                          onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(v); }}
                        >
                          {v.label || formatTimestamp(v.timestamp)}
                        </span>
                        {isLatest && <span className="wfv-badge-latest">Latest</span>}
                      </div>
                    )}
                    <span className="wfv-item-time">{formatRelativeTime(v.timestamp, formatTimestamp)}</span>
                  </div>

                  <div className="wfv-item-meta">
                    <span className="wfv-meta-stat">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                        <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
                        <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
                        <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
                      </svg>
                      {v.nodeCount} nodes
                    </span>
                    <span className="wfv-meta-divider">·</span>
                    <span className="wfv-meta-stat">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      {v.edgeCount} edges
                    </span>
                  </div>

                  {summary && (
                    <div className="wfv-item-summary">{summary}</div>
                  )}

                  <div className={`wfv-item-actions ${isHovered || isSelected ? 'wfv-item-actions-visible' : ''}`}>
                    <button
                      className="wfv-action-btn wfv-action-restore"
                      onClick={(e) => { e.stopPropagation(); onRestore(v); }}
                      title="Restore this version"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Restore
                    </button>
                    <button
                      className="wfv-action-btn"
                      onClick={(e) => { e.stopPropagation(); handleStartRename(v); }}
                      title="Rename this version"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Rename
                    </button>
                    <button
                      className="wfv-action-btn wfv-action-delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                      title="Delete this version"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="wfv-footer">
        <span className="wfv-footer-count">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
        {canCompare && (
          <span className="wfv-footer-hint">Click Compare to view differences</span>
        )}
        <button type="button" className="btn btn-primary wfv-footer-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
