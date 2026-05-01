import { useState, useMemo, useCallback } from 'react';
import type { WorkflowVersion } from '../../types/workflow';
import { generateChangeSummary } from '../../utils/workflowVersioning';

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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 2) {
          // Replace oldest selection
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
    // Older first, newer second
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
    <div className="wf-config-panel wf-version-panel">
      <div className="wf-config-header">
        <span className="wf-config-type">🕐 Version History</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleCompare}
            disabled={!canCompare}
            title={canCompare ? 'Compare selected versions' : 'Select 2 versions to compare'}
          >
            Compare
          </button>
          <button className="btn btn-sm" onClick={onClose} title="Close">×</button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="wf-version-empty">
          <p>No versions yet</p>
          <p className="wf-version-empty-hint">Save the workflow to create a version snapshot.</p>
        </div>
      ) : (
        <div className="wf-version-list">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`wf-version-item ${selectedIds.has(v.id) ? 'selected' : ''}`}
              onClick={() => toggleSelect(v.id)}
            >
              <div className="wf-version-item-check">
                <input
                  type="checkbox"
                  checked={selectedIds.has(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="wf-version-item-body">
                <div className="wf-version-item-top">
                  {editingId === v.id ? (
                    <input
                      className="wf-version-label-input"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      placeholder="Version label…"
                    />
                  ) : (
                    <span className="wf-version-item-label" onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(v); }}>
                      {v.label || formatTimestamp(v.timestamp)}
                    </span>
                  )}
                  <span className="wf-version-item-time">
                    {formatRelativeTime(v.timestamp)}
                  </span>
                </div>
                <div className="wf-version-item-meta">
                  <span>{v.nodeCount} nodes · {v.edgeCount} edges</span>
                  <span className="wf-version-item-summary">{changeSummaries.get(v.id) ?? ''}</span>
                </div>
                <div className="wf-version-item-actions">
                  <button
                    className="wf-version-action-btn"
                    onClick={(e) => { e.stopPropagation(); onRestore(v); }}
                    title="Restore this version"
                  >
                    ↩ Restore
                  </button>
                  <button
                    className="wf-version-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleStartRename(v); }}
                    title="Rename this version"
                  >
                    ✏ Rename
                  </button>
                  <button
                    className="wf-version-action-btn wf-version-action-danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                    title="Delete this version"
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wf-version-footer">
        <span className="wf-version-footer-count">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
        {selectedIds.size > 0 && (
          <button className="wf-version-footer-clear" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatTimestamp(ts);
}
