import { useState } from 'react';
import type { StructureChangeEntry } from '../../../shared/types';
import { actionLabel, actionIcon, actionClass } from '../utils/structureChangeLog';

interface Props {
  entries: StructureChangeEntry[];
  onDelete: (entryId: string) => void;
  onClear: () => void;
}

export default function StructureChangeLogPanel({ entries, onDelete, onClear }: Props) {
  const [filter, setFilter] = useState<'all' | 'scenario' | 'test' | 'fg'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'scenario') return e.action.startsWith('scenario-');
    if (filter === 'test') return e.action.startsWith('test-');
    if (filter === 'fg') return e.action.startsWith('fg-');
    return true;
  });

  return (
    <div className="structure-log-panel">
      <div className="structure-log-toolbar">
        <h4>Structure History</h4>
        <div className="structure-log-filters">
          {(['all', 'scenario', 'test', 'fg'] as const).map(f => (
            <button
              key={f}
              className={`structure-log-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'fg' ? 'Group' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {entries.length > 0 && (
          confirmClear ? (
            <span className="structure-log-confirm-clear">
              Clear all?
              <button className="btn btn-xs btn-danger" onClick={() => { onClear(); setConfirmClear(false); }}>Yes</button>
              <button className="btn btn-xs" onClick={() => setConfirmClear(false)}>No</button>
            </span>
          ) : (
            <button className="btn btn-xs btn-ghost" onClick={() => setConfirmClear(true)} title="Clear all entries">
              Clear
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="structure-log-empty">
          <p>No structure changes recorded</p>
          <p className="structure-log-empty-hint">
            Changes to scenarios and tests (add, remove, rename, move, copy) will appear here.
          </p>
        </div>
      ) : (
        <div className="structure-log-list">
          {filtered.map(entry => (
            <div key={entry.id} className={`structure-log-item ${actionClass(entry.action)}`}>
              <span className={`structure-log-badge ${actionClass(entry.action)}`}>
                {actionIcon(entry.action)}
              </span>
              <div className="structure-log-item-body">
                <div className="structure-log-item-top">
                  <span className="structure-log-item-action">{actionLabel(entry.action)}</span>
                  <span className="structure-log-item-time">{formatRelativeTime(entry.timestamp)}</span>
                </div>
                <div className="structure-log-item-detail">
                  <span className="structure-log-item-entity">{entry.entityName}</span>
                  {entry.scenarioName && (
                    <span className="structure-log-item-scenario"> in {entry.scenarioName}</span>
                  )}
                  {entry.detail && (
                    <span className="structure-log-item-extra"> — {entry.detail}</span>
                  )}
                </div>
              </div>
              <button
                className="structure-log-delete-btn"
                onClick={() => onDelete(entry.id)}
                title="Remove this entry"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="structure-log-footer">
        <span className="structure-log-footer-count">
          {filtered.length}{filtered.length !== entries.length ? ` of ${entries.length}` : ''} entr{filtered.length === 1 ? 'y' : 'ies'}
        </span>
      </div>
    </div>
  );
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
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
