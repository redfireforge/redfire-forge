import { useState, useCallback, useMemo } from 'react';
import type { CatalogEntry, CatalogVersion, CatalogSpecDiff } from '../types/catalog';
import { parseOpenApiSpec } from '../utils/openApiParser';
import { formatBytes } from '../../../shared/utils/helpers';
import { diffCatalogEntries } from '../utils/catalogSpecDiff';
import CatalogVersionDiff from './CatalogVersionDiff';
import FullPanelModal from '../../../shared/components/FullPanelModal';

const VERSION_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="cat-vh-title-icon">
    <path d="M8 1v2m0 10v2M1 8h2m10 0h2M3.05 3.05l1.41 1.41m7.08 7.08l1.41 1.41M3.05 12.95l1.41-1.41m7.08-7.08l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

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
  }>({ loading: false, diff: null, error: null });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


  const selectedPair = useMemo((): [CatalogVersion, CatalogVersion] | null => {
    if (selectedIds.size !== 2) return null;
    const ids = [...selectedIds];
    const v1 = entry.versions.find(v => v.id === ids[0]);
    const v2 = entry.versions.find(v => v.id === ids[1]);
    if (!v1 || !v2) return null;
    // Older first (higher index = older)
    const i1 = entry.versions.indexOf(v1);
    const i2 = entry.versions.indexOf(v2);
    return i1 > i2 ? [v1, v2] : [v2, v1];
  }, [selectedIds, entry.versions]);

  const toggleSelection = useCallback((versionId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        if (next.size >= 2) {
          // Replace oldest selection
          const first = [...next][0];
          next.delete(first);
        }
        next.add(versionId);
      }
      return next;
    });
    setDiffState({ loading: false, diff: null, error: null });
  }, []);

  const handleCompare = useCallback(async () => {
    if (!selectedPair) return;
    const [older, newer] = selectedPair;

    setDiffState({ loading: true, diff: null, error: null });

    try {
      const [olderRaw, newerRaw] = await Promise.all([
        loadRawSpec(entry.id, older.id),
        loadRawSpec(entry.id, newer.id),
      ]);

      if (!olderRaw || !newerRaw) {
        setDiffState({ loading: false, diff: null, error: 'Raw spec not available for comparison.' });
        return;
      }

      const olderParsed = await parseOpenApiSpec(olderRaw);
      const newerParsed = await parseOpenApiSpec(newerRaw);

      const diff = diffCatalogEntries(
        olderParsed.entry,
        newerParsed.entry,
        older.version,
        newer.version,
      );

      setDiffState({ loading: false, diff, error: null });
    } catch (err) {
      setDiffState({
        loading: false,
        diff: null,
        error: err instanceof Error ? err.message : 'Failed to compute diff',
      });
    }
  }, [selectedPair, entry.id, loadRawSpec]);

  const handleSwitch = useCallback((versionId: string) => {
    onSwitchVersion(versionId);
    onClose();
  }, [onSwitchVersion, onClose]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setDiffState({ loading: false, diff: null, error: null });
  }, []);

  return (
    <FullPanelModal
      title={<span className="cat-vh-title-wrap">{VERSION_ICON}Version History — {entry.name}</span>}
      onClose={onClose}
      dialogClassName="cat-vh-dialog"
      movable
      resizable
      minWidth={640}
      minHeight={400}
      bodyScrollable={false}
      data-testid="catalog-version-history-modal"
      footer={
        <div className="cat-vh-footer">
          <span className="cat-vh-footer-hint">
            {entry.versions.length} version{entry.versions.length !== 1 ? 's' : ''} tracked
          </span>
          <div className="cat-vh-footer-actions">
            <button className="cat-vh-footer-btn cat-vh-footer-btn--import" onClick={() => { onReimport(); onClose(); }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v6m0 0L5.5 4.5M8 7l2.5-2.5M2 9v3a2 2 0 002 2h8a2 2 0 002-2V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Import New Version
            </button>
            <button className="cat-vh-footer-btn cat-vh-footer-btn--close" onClick={onClose}>Close</button>
          </div>
        </div>
      }
    >
      <div className="cat-vh-layout">
        {/* Left panel: version list */}
        <div className="cat-vh-sidebar">
          <div className="cat-vh-sidebar-header">
            <span className="cat-vh-sidebar-title">
              Versions
              <span className="cat-vh-count">{entry.versions.length}</span>
            </span>
          </div>

          {selectedIds.size > 0 && (
            <div className="cat-vh-selection-bar">
              <span className="cat-vh-selection-label">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M13.5 2.5l-7 7L3 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {selectedIds.size}/2 selected
              </span>
              <div className="cat-vh-selection-actions">
                {selectedIds.size === 2 && (
                  <button className="cat-vh-compare-btn" data-testid="catalog-version-compare-btn" onClick={handleCompare} disabled={diffState.loading}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M8 1v14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Compare
                  </button>
                )}
                <button className="cat-vh-clear-btn" onClick={clearSelection}>Clear</button>
              </div>
            </div>
          )}

          <div className="cat-vh-versions" data-testid="catalog-version-list">
            {entry.versions.map((v, idx) => {
              const isCurrent = v.id === entry.currentVersionId;
              const isSelected = selectedIds.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`cat-vh-card ${isCurrent ? 'cat-vh-card--current' : ''} ${isSelected ? 'cat-vh-card--selected' : ''}`}
                  data-testid="catalog-version-item"
                >
                  <div className="cat-vh-card-select" onClick={() => toggleSelection(v.id)}>
                    <span className={`cat-vh-checkbox ${isSelected ? 'checked' : ''}`} data-testid="catalog-version-checkbox">
                      {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                  </div>

                  <div className="cat-vh-card-body">
                    <div className="cat-vh-card-top">
                      <span className="cat-vh-card-version">v{v.version}</span>
                      {v.specFormat && <span className="cat-vh-badge-format">{v.specFormat}</span>}
                      {isCurrent && <span className="cat-vh-badge-current cat-version-current">CURRENT</span>}
                      {idx === 0 && !isCurrent && <span className="cat-vh-badge-latest">LATEST</span>}
                    </div>
                    <div className="cat-vh-card-meta">
                      <span>{new Date(v.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="cat-vh-dot">·</span>
                      <span>{new Date(v.importedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="cat-vh-dot">·</span>
                      <span>{formatBytes(v.specSize)}</span>
                    </div>
                    {v.changelog && <div className="cat-vh-card-changelog">{v.changelog}</div>}
                  </div>

                  <div className="cat-vh-card-actions">
                    {!isCurrent && (
                      <button className="cat-vh-action-btn cat-vh-action-restore" title="Restore this version"
                        data-testid="catalog-version-restore-btn"
                        onClick={() => handleSwitch(v.id)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8a6 6 0 1111.3-2.8M2 3v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: diff results */}
        <div className="cat-vh-detail">
          {diffState.loading && (
            <div className="cat-vh-state">
              <div className="cat-vh-spinner" />
              <span>Computing diff...</span>
            </div>
          )}
          {diffState.error && (
            <div className="cat-vh-state cat-vh-state--error">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{diffState.error}</span>
            </div>
          )}
          {diffState.diff && <CatalogVersionDiff diff={diffState.diff} />}
          {!diffState.diff && !diffState.loading && !diffState.error && (
            <div className="cat-vh-state cat-vh-state--empty">
              <svg width="48" height="48" viewBox="0 0 16 16" fill="none" opacity="0.2">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M8 1v14" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
              </svg>
              <span className="cat-vh-empty-title">Compare Versions</span>
              <span className="cat-vh-empty-desc">Select two versions to see what changed between them.</span>
            </div>
          )}
        </div>
      </div>
    </FullPanelModal>
  );
}
