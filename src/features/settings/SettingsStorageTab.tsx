import React, { useState, useCallback } from 'react';
import { setMaxRuns, getStorageUsage, deleteRunsOlderThan, clearAllTestRuns, loadTestRunsLite, cleanupStaleStorageKeys, compactWorkflowStorage } from '../../shared/utils/storage';
import { DEMO_HUB_ENABLED } from '../../config/features';
import { isTauri } from '../../shared/utils/platform';
import { formatBytes } from '../../shared/utils/helpers';

export interface SettingsStorageTabProps {
  storageUsage: { usedBytes: number; entries: Record<string, number> };
  setStorageUsage: React.Dispatch<React.SetStateAction<{ usedBytes: number; entries: Record<string, number> }>>;
  maxRunsLocal: number;
  setMaxRunsLocal: React.Dispatch<React.SetStateAction<number>>;
  storageExpanded: boolean;
  setStorageExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

const AGE_OPTIONS = [
  { label: 'Older than 1 day', days: 1 },
  { label: 'Older than 7 days', days: 7 },
  { label: 'Older than 30 days', days: 30 },
  { label: 'Older than 90 days', days: 90 },
];

export default function SettingsStorageTab({
  storageUsage,
  setStorageUsage,
  maxRunsLocal,
  setMaxRunsLocal,
  storageExpanded,
  setStorageExpanded,
}: SettingsStorageTabProps) {
  const [runCount, setRunCount] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const isWeb = !isTauri();

  // Load run count on first render
  React.useEffect(() => {
    loadTestRunsLite().then(runs => setRunCount(runs.length));
  }, []);

  const refreshUsage = useCallback(async () => {
    const usage = await getStorageUsage();
    setStorageUsage(usage);
    const runs = await loadTestRunsLite();
    setRunCount(runs.length);
  }, [setStorageUsage]);

  const handleDeleteOlderThan = useCallback(async (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const deleted = await deleteRunsOlderThan(cutoff);
    setActionMsg(deleted > 0 ? `Deleted ${deleted} run${deleted > 1 ? 's' : ''}.` : 'No runs matched.');
    await refreshUsage();
    setTimeout(() => setActionMsg(null), 3000);
  }, [refreshUsage]);

  const handleClearAll = async () => {
    await clearAllTestRuns();
    setConfirmClear(false);
    setActionMsg('All test runs deleted.');
    await refreshUsage();
    setTimeout(() => setActionMsg(null), 3000);
  };

  const limitHint = isWeb
    ? 'All data stored in IndexedDB (no size limit). Only small settings remain in localStorage.'
    : 'All data stored on disk (no size limit).';

  return (
    <div className="settings-section">
      <h4>Storage</h4>

      {/* Storage backend info */}
      <p className="settings-section-desc">{limitHint}</p>

      {/* Usage breakdown */}
      <div className="storage-stats">
        <div className="storage-stat storage-stat-toggle" onClick={() => setStorageExpanded(!storageExpanded)}>
          <span className={`storage-expand-icon ${storageExpanded ? 'expanded' : ''}`}>▸</span>
          <span className="storage-stat-label">Total usage</span>
          <span className="storage-stat-value">{formatBytes(storageUsage.usedBytes)}</span>
          {!isWeb && (
            <span className="storage-stat-hint">/ disk</span>
          )}
        </div>
        {storageExpanded && Object.entries(storageUsage.entries).sort(([, a], [, b]) => b - a).map(([key, bytes]) => {
          const isIdb = key.includes('(IndexedDB)');
          const displayKey = key.replace('perf-test-', '');
          return (
            <div key={key} className="storage-stat storage-stat-detail">
              <span className="storage-stat-label">
                {displayKey}
                {!isIdb && isWeb && <span className="storage-badge-ls" title="localStorage">LS</span>}
              </span>
              <span className="storage-stat-value">{formatBytes(bytes)}</span>
              <div className="storage-bar storage-bar-sm"><div className="storage-bar-fill" style={{ width: `${Math.min(100, (bytes / storageUsage.usedBytes) * 100)}%` }} /></div>
            </div>
          );
        })}
      </div>

      {/* Max runs */}
      <div className="storage-max-runs">
        <label>Max stored runs</label>
        <input type="number" min={1} max={500} value={maxRunsLocal} onChange={async (e) => {
          const v = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1));
          setMaxRunsLocal(v);
          await setMaxRuns(v);
          await refreshUsage();
        }} />
        <span className="storage-hint">Oldest runs auto-deleted when limit is exceeded. Bodies truncated to 2 KB.</span>
      </div>

      {/* Run count */}
      {runCount !== null && (
        <div className="storage-run-count">
          <span className="storage-stat-label">Stored runs</span>
          <span className="storage-stat-value">{runCount}</span>
        </div>
      )}

      {/* Delete by age */}
      <div className="storage-cleanup-section">
        <label className="storage-cleanup-label">Delete old runs</label>
        <div className="storage-cleanup-buttons">
          {AGE_OPTIONS.map(opt => (
            <button key={opt.days} type="button" className="btn btn-secondary btn-sm"
              onClick={() => handleDeleteOlderThan(opt.days)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear all */}
      <div className="storage-cleanup-section">
        <label className="storage-cleanup-label">Clear all test runs</label>
        {!confirmClear ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>
            Delete All Runs
          </button>
        ) : (
          <div className="storage-confirm-row">
            <span className="storage-confirm-text">Are you sure? This cannot be undone.</span>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleClearAll}>Yes, Delete All</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Quick cleanup */}
      <div className="storage-cleanup-section">
        <label className="storage-cleanup-label">Free up space</label>
        <div className="storage-cleanup-buttons">
          <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
            let demo = { profilesRemoved: 0, runnerConfigsRemoved: 0, freedKB: 0 };
            if (DEMO_HUB_ENABLED) {
              const { purgeGqlDemoEphemeralStorage } = await import('../demo-player/lessons/gql-demo-storage-cleanup');
              demo = await purgeGqlDemoEphemeralStorage();
            }
            const stale = cleanupStaleStorageKeys();
            const compact = await compactWorkflowStorage(5);
            const totalFreed = demo.freedKB + stale.freedKB + (compact.beforeKB - compact.afterKB);
            setActionMsg(totalFreed > 0
              ? `Freed ~${totalFreed} KB (${demo.profilesRemoved} demo profiles, ${demo.runnerConfigsRemoved} runner configs, ${stale.removed} stale keys)`
              : 'Storage is already optimized.');
            await refreshUsage();
            setTimeout(() => setActionMsg(null), 5000);
          }}>
            Clean Up Stale Data
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
            const compact = await compactWorkflowStorage(3);
            const freed = compact.beforeKB - compact.afterKB;
            setActionMsg(freed > 0
              ? `Compacted workflow versions: ${compact.beforeKB} KB → ${compact.afterKB} KB (freed ${freed} KB)`
              : 'Workflow versions already compact.');
            await refreshUsage();
            setTimeout(() => setActionMsg(null), 5000);
          }}>
            Compact Workflow Versions
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {actionMsg && <div className="storage-action-msg">{actionMsg}</div>}
    </div>
  );
}
