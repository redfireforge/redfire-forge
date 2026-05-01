import { useState, useMemo } from 'react';
import type { Scenario, TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';
import { generateChangeSummary, computeSnapshotDiff } from '../utils/testDefinitionVersioning';

interface Props {
  versions: TestDefinitionVersion[];
  currentSnapshot: TestDefinitionSnapshot;
  onRestore: (version: TestDefinitionVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, label: string) => void;
  onCompare: (older: TestDefinitionVersion, newer: TestDefinitionVersion) => void;
}

export default function TestDefinitionVersionPanel({
  versions,
  currentSnapshot,
  onRestore,
  onDelete,
  onRename,
  onCompare,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  };

  const canCompare = selectedIds.size === 2;

  const handleCompare = () => {
    if (!canCompare) return;
    const ids = [...selectedIds];
    const a = versions.find(v => v.id === ids[0])!;
    const b = versions.find(v => v.id === ids[1])!;
    const [older, newer] = a.timestamp <= b.timestamp ? [a, b] : [b, a];
    onCompare(older, newer);
  };

  const handleStartRename = (v: TestDefinitionVersion) => {
    setEditingId(v.id);
    setEditLabel(v.label ?? '');
  };

  const handleFinishRename = () => {
    if (editingId && editLabel.trim()) {
      onRename(editingId, editLabel.trim());
    }
    setEditingId(null);
  };

  const changeSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < versions.length; i++) {
      if (versions[i].changeSummary) {
        map.set(versions[i].id, versions[i].changeSummary!);
      }
    }
    return map;
  }, [versions]);

  return (
    <div className="test-def-version-panel">
      <div className="test-def-version-toolbar">
        <h4>Definition History</h4>
        {canCompare && (
          <button
            className="btn btn-xs btn-primary"
            onClick={handleCompare}
            title="Compare selected versions"
          >
            Compare
          </button>
        )}
      </div>

      {versions.length === 0 ? (
        <div className="test-def-version-empty">
          <p>No definition history yet</p>
          <p className="test-def-version-empty-hint">Save the test to create a definition snapshot.</p>
        </div>
      ) : (
        <div className="test-def-version-list">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`test-def-version-item ${selectedIds.has(v.id) ? 'selected' : ''}`}
              onClick={() => toggleSelect(v.id)}
            >
              <div className="test-def-version-item-check">
                <input
                  type="checkbox"
                  checked={selectedIds.has(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="test-def-version-item-body">
                <div className="test-def-version-item-top">
                  {editingId === v.id ? (
                    <input
                      className="test-def-version-label-input"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      placeholder="Version label…"
                    />
                  ) : (
                    <span className="test-def-version-item-label" onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(v); }}>
                      {v.label || formatTimestamp(v.timestamp)}
                    </span>
                  )}
                  <span className="test-def-version-item-time">
                    {formatRelativeTime(v.timestamp)}
                  </span>
                </div>
                <div className="test-def-version-item-meta">
                  <span className="test-def-version-item-summary">{changeSummaries.get(v.id) ?? ''}</span>
                </div>
                <div className="test-def-version-item-actions">
                  <button
                    className="test-def-version-action-btn"
                    onClick={(e) => { e.stopPropagation(); onRestore(v); }}
                    title="Restore this version"
                  >
                    ↩ Restore
                  </button>
                  <button
                    className="test-def-version-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleStartRename(v); }}
                    title="Rename this version"
                  >
                    ✏ Rename
                  </button>
                  <button
                    className="test-def-version-action-btn test-def-version-action-danger"
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

      <div className="test-def-version-footer">
        <span className="test-def-version-footer-count">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
        {selectedIds.size > 0 && (
          <button className="test-def-version-footer-clear" onClick={() => setSelectedIds(new Set())}>
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
