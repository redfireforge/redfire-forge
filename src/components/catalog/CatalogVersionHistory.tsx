import { useState, useCallback } from 'react';
import type { CatalogEntry, CatalogVersion, CatalogSpecDiff } from '../../types/catalog';
import { parseOpenApiSpec } from '../../utils/openApiParser';
import { formatBytes } from '../../utils/helpers';
import { diffCatalogEntries } from '../../utils/catalogSpecDiff';
import CatalogVersionDiff from './CatalogVersionDiff';

interface Props {
  entry: CatalogEntry;
  onClose: () => void;
  onSwitchVersion: (versionId: string) => void;
  onReimport: () => void;
  loadRawSpec: (entryId: string, versionId: string) => Promise<string | null>;
}

export default function CatalogVersionHistory({ entry, onClose, onSwitchVersion, onReimport, loadRawSpec }: Props) {
  const [diffState, setDiffState] = useState<{
    loading: boolean;
    diff: CatalogSpecDiff | null;
    error: string | null;
    targetVersionId: string | null;
  }>({ loading: false, diff: null, error: null, targetVersionId: null });

  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);

  const handleDiff = useCallback(async (targetVersion: CatalogVersion) => {
    if (targetVersion.id === entry.currentVersionId) return;

    setDiffState({ loading: true, diff: null, error: null, targetVersionId: targetVersion.id });

    try {
      const [currentRaw, targetRaw] = await Promise.all([
        loadRawSpec(entry.id, entry.currentVersionId),
        loadRawSpec(entry.id, targetVersion.id),
      ]);

      if (!currentRaw || !targetRaw) {
        setDiffState(prev => ({ ...prev, loading: false, error: 'Raw spec not available for comparison.' }));
        return;
      }

      const currentParsed = await parseOpenApiSpec(currentRaw);
      const targetParsed = await parseOpenApiSpec(targetRaw);

      const diff = diffCatalogEntries(
        targetParsed.entry,
        currentParsed.entry,
        targetVersion.version,
        currentVersion?.version ?? 'current',
      );

      setDiffState({ loading: false, diff, error: null, targetVersionId: targetVersion.id });
    } catch (err) {
      setDiffState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to compute diff',
      }));
    }
  }, [entry, currentVersion, loadRawSpec]);

  const handleSwitch = useCallback((versionId: string) => {
    onSwitchVersion(versionId);
    onClose();
  }, [onSwitchVersion, onClose]);

  return (
    <div className="cat-modal-overlay" onClick={onClose}>
      <div className="cat-modal cat-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>Version History — {entry.name}</h3>
          <button className="cat-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="cat-modal-body cat-vh-body">
          <div className="cat-vh-list">
            <div className="cat-vh-list-header">
              <span>Versions ({entry.versions.length})</span>
              <button className="cat-btn cat-btn-sm" onClick={() => { onReimport(); onClose(); }}>
                + Re-import New Version
              </button>
            </div>

            {entry.versions.map(v => {
              const isCurrent = v.id === entry.currentVersionId;
              const isSelected = v.id === diffState.targetVersionId;
              return (
                <div
                  key={v.id}
                  className={`cat-vh-item ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => !isCurrent && handleDiff(v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isCurrent) { e.preventDefault(); handleDiff(v); } }}
                >
                  <div className="cat-vh-version">
                    v{v.version}
                    {isCurrent && <span className="cat-vh-badge-current">current</span>}
                  </div>
                  <div className="cat-vh-meta">
                    <span className="cat-vh-date">{new Date(v.importedAt).toLocaleString()}</span>
                    <span className="cat-vh-size">{formatBytes(v.specSize)}</span>
                  </div>
                  {v.changelog && <div className="cat-vh-changelog">{v.changelog}</div>}
                  {!isCurrent && (
                    <button className="cat-btn cat-btn-xs cat-vh-restore"
                      onClick={e => { e.stopPropagation(); handleSwitch(v.id); }}>
                      Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cat-vh-detail">
            {diffState.loading && <div className="cat-vh-loading">Computing diff...</div>}
            {diffState.error && <div className="cat-vh-error">{diffState.error}</div>}
            {diffState.diff && <CatalogVersionDiff diff={diffState.diff} />}
            {!diffState.diff && !diffState.loading && !diffState.error && (
              <div className="cat-vh-hint">
                Click a version to compare it against the current version.
              </div>
            )}
          </div>
        </div>

        <div className="cat-modal-footer">
          <button className="cat-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
