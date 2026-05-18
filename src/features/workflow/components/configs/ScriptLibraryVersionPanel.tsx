import { useState, useMemo } from 'react';
import { formatRelativeTime, formatTimestamp } from '../../../../shared/utils/formatRelativeTime';
import type { ScriptLibrary, ScriptLibraryVersion } from '../../engine/scriptLibraries';
import { restoreFromVersion, deleteVersion, renameVersion, computeSnapshotDiff } from '../../engine/scriptLibraryVersioning';
import type { LibraryUsage } from '../../engine/scriptLibraryVersioning';
import ScriptLibraryVersionDiff from './ScriptLibraryVersionDiff';

interface Props {
  library: ScriptLibrary;
  onLibraryChange: (updated: ScriptLibrary) => void;
  usages: LibraryUsage[];
  onClose: () => void;
}

export default function ScriptLibraryVersionPanel({
  library,
  onLibraryChange,
  usages,
  onClose,
}: Props) {
  const versions = useMemo(() => library.versions ?? [], [library.versions]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [diffPair, setDiffPair] = useState<[ScriptLibraryVersion, ScriptLibraryVersion] | null>(null);

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
    setDiffPair([older, newer]);
  };

  const handleStartRename = (v: ScriptLibraryVersion) => {
    setEditingId(v.id);
    setEditLabel(v.label ?? '');
  };

  const handleFinishRename = () => {
    if (editingId) {
      onLibraryChange(renameVersion(library, editingId, editLabel));
    }
    setEditingId(null);
  };

  const handleRestore = (v: ScriptLibraryVersion) => {
    onLibraryChange(restoreFromVersion(library, v.id));
  };

  const handleDelete = (versionId: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.delete(versionId); return next; });
    onLibraryChange(deleteVersion(library, versionId));
  };

  const changeSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) {
      if (v.changeSummary) map.set(v.id, v.changeSummary);
    }
    return map;
  }, [versions]);

  if (diffPair) {
    const diff = computeSnapshotDiff(diffPair[0].snapshot, diffPair[1].snapshot);
    return (
      <ScriptLibraryVersionDiff
        older={diffPair[0]}
        newer={diffPair[1]}
        diff={diff}
        onClose={() => setDiffPair(null)}
      />
    );
  }

  return (
    <div className="script-lib-version-panel">
      <div className="script-lib-version-toolbar">
        <h4>Version History — {library.name}</h4>
        <div className="script-lib-version-toolbar-btns">
          {canCompare && (
            <button className="btn btn-xs btn-primary" onClick={handleCompare} title="Compare selected versions">Compare</button>
          )}
          <button className="wf-config-remove-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {usages.length > 0 && (
        <div className="script-lib-version-usages">
          <span className="script-lib-version-usages-label">Used by:</span>
          {usages.map((u, i) => (
            <span key={i} className="script-lib-version-usage-tag" title={`${u.workflowName} → ${u.nodeLabel}`}>
              {u.workflowName} › {u.nodeLabel}
            </span>
          ))}
        </div>
      )}

      {versions.length === 0 ? (
        <div className="script-lib-version-empty">
          <p>No version history yet</p>
          <p className="script-lib-version-empty-hint">Edit the library to start recording versions.</p>
        </div>
      ) : (
        <div className="script-lib-version-list">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`script-lib-version-item ${selectedIds.has(v.id) ? 'selected' : ''}`}
              onClick={() => toggleSelect(v.id)}
            >
              <div className="script-lib-version-item-check">
                <input
                  type="checkbox"
                  checked={selectedIds.has(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="script-lib-version-item-body">
                <div className="script-lib-version-item-top">
                  {editingId === v.id ? (
                    <input
                      className="script-lib-version-label-input"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      placeholder="Version label…"
                    />
                  ) : (
                    <span className="script-lib-version-item-label" onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(v); }}>
                      {v.label || formatTimestamp(v.timestamp)}
                    </span>
                  )}
                  <span className="script-lib-version-item-time">{formatRelativeTime(v.timestamp, formatTimestamp)}</span>
                </div>
                <div className="script-lib-version-item-meta">
                  <span className="script-lib-version-item-summary">{changeSummaries.get(v.id) ?? ''}</span>
                </div>
                <div className="script-lib-version-item-actions">
                  <button className="script-lib-version-action-btn" onClick={(e) => { e.stopPropagation(); handleRestore(v); }} title="Restore this version">↩ Restore</button>
                  <button className="script-lib-version-action-btn" onClick={(e) => { e.stopPropagation(); handleStartRename(v); }} title="Rename this version">✏ Rename</button>
                  <button className="script-lib-version-action-btn script-lib-version-action-danger" onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }} title="Delete this version">✕ Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="script-lib-version-footer">
        <span className="script-lib-version-footer-count">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
        {selectedIds.size > 0 && (
          <button className="script-lib-version-footer-clear" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        )}
      </div>
    </div>
  );
}
