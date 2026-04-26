import React from 'react';
import { setMaxRuns, getStorageUsage } from '../../shared/utils/storage';
import { formatBytes } from '../../shared/utils/helpers';

export interface SettingsStorageTabProps {
  storageUsage: { usedBytes: number; entries: Record<string, number> };
  setStorageUsage: React.Dispatch<React.SetStateAction<{ usedBytes: number; entries: Record<string, number> }>>;
  maxRunsLocal: number;
  setMaxRunsLocal: React.Dispatch<React.SetStateAction<number>>;
  storageExpanded: boolean;
  setStorageExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SettingsStorageTab({
  storageUsage,
  setStorageUsage,
  maxRunsLocal,
  setMaxRunsLocal,
  storageExpanded,
  setStorageExpanded,
}: SettingsStorageTabProps) {
  return (
    <div className="settings-section">
      <h4>Storage</h4>
      <div className="storage-stats">
        <div className="storage-stat storage-stat-toggle" onClick={() => setStorageExpanded(!storageExpanded)}>
          <span className={`storage-expand-icon ${storageExpanded ? 'expanded' : ''}`}>▸</span>
          <span className="storage-stat-label">Total usage</span>
          <span className="storage-stat-value">{formatBytes(storageUsage.usedBytes)}</span>
          <span className="storage-stat-hint">/ ~5 MB limit</span>
          <div className="storage-bar"><div className="storage-bar-fill" style={{ width: `${Math.min(100, (storageUsage.usedBytes / (5 * 1024 * 1024)) * 100)}%` }} /></div>
        </div>
        {storageExpanded && Object.entries(storageUsage.entries).sort(([, a], [, b]) => b - a).map(([key, bytes]) => (
          <div key={key} className="storage-stat storage-stat-detail">
            <span className="storage-stat-label">{key.replace('perf-test-', '')}</span>
            <span className="storage-stat-value">{formatBytes(bytes)}</span>
            <div className="storage-bar storage-bar-sm"><div className="storage-bar-fill" style={{ width: `${Math.min(100, (bytes / storageUsage.usedBytes) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="storage-max-runs">
        <label>Max stored runs</label>
        <input type="number" min={1} max={500} value={maxRunsLocal} onChange={async (e) => {
          const v = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1));
          setMaxRunsLocal(v);
          await setMaxRuns(v);
          setStorageUsage(await getStorageUsage());
        }} />
        <span className="storage-hint">Oldest runs are auto-deleted when limit is exceeded. Response bodies are truncated to 2 KB each.</span>
      </div>
    </div>
  );
}
