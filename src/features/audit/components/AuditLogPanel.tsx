import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AuditEntry, AuditEntityType, AuditAction } from '../utils/auditLog';
import { loadAuditLog, clearAuditLog, formatAction, formatEntityType, auditLogToCsv } from '../utils/auditLog';
import { saveFile } from '../../../shared/utils/fileSaver';
import { formatTimestamp } from '../../../shared/utils/formatRelativeTime';
import { CustomSelect } from '../../../shared/components/CustomSelect';

const ENTITY_TYPES: AuditEntityType[] = ['environment', 'microservice', 'authProfile'];
const ACTION_TYPES: AuditAction[] = ['created', 'updated', 'deleted', 'renamed'];

const ACTION_ICONS: Record<AuditAction, string> = {
  created: '+',
  updated: '~',
  deleted: '×',
  renamed: '→',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  created: 'var(--color-success, #4caf50)',
  updated: 'var(--color-info, #2196f3)',
  deleted: 'var(--color-danger, #f44336)',
  renamed: 'var(--color-warning, #ff9800)',
};

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AuditEntityType | ''>('');
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const log = await loadAuditLog();
    setEntries(log);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filterType) list = list.filter((e) => e.entityType === filterType);
    if (filterAction) list = list.filter((e) => e.action === filterAction);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.entityName.toLowerCase().includes(q) ||
        formatEntityType(e.entityType).toLowerCase().includes(q) ||
        formatAction(e.action).toLowerCase().includes(q),
      );
    }
    // Most recent first
    return [...list].reverse();
  }, [entries, filterType, filterAction, search]);

  const handleClear = async () => {
    await clearAuditLog();
    setEntries([]);
    setConfirmClear(false);
  };

  const handleExportJson = async () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    await saveFile(blob, { filename: `audit-log-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json' });
  };

  const handleExportCsv = async () => {
    const csv = auditLogToCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv' });
    await saveFile(blob, { filename: `audit-log-${new Date().toISOString().slice(0, 10)}.csv`, mimeType: 'text/csv' });
  };

  const formatChangeValue = (val: unknown): string => {
    if (val === undefined || val === null) return '(none)';
    if (typeof val === 'string') return val || '(empty)';
    return JSON.stringify(val);
  };

  if (loading) return <div className="settings-section"><p>Loading audit log...</p></div>;

  return (
    <div className="settings-section audit-log-panel">
      <h4>Audit Log</h4>
      <p className="settings-section-desc">
        Track changes to environments, microservices, and auth profiles. {entries.length} entries recorded.
      </p>

      {/* Toolbar */}
      <div className="audit-log-toolbar">
        <input
          className="audit-log-search"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CustomSelect
          className="audit-log-filter"
          value={filterType}
          onChange={(v) => setFilterType(v as AuditEntityType | '')}
          options={[
            { value: '', label: 'All Types' },
            ...ENTITY_TYPES.map(t => ({ value: t, label: formatEntityType(t) })),
          ]}
          size="sm"
        />
        <CustomSelect
          className="audit-log-filter"
          value={filterAction}
          onChange={(v) => setFilterAction(v as AuditAction | '')}
          options={[
            { value: '', label: 'All Actions' },
            ...ACTION_TYPES.map(a => ({ value: a, label: formatAction(a) })),
          ]}
          size="sm"
        />
      </div>

      {/* Actions */}
      <div className="audit-log-actions">
        <button type="button" className="btn btn-sm" onClick={handleExportJson}>Export JSON</button>
        <button type="button" className="btn btn-sm" onClick={handleExportCsv}>Export CSV</button>
        <button type="button" className="btn btn-sm" onClick={refresh}>Refresh</button>
        {!confirmClear ? (
          <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => setConfirmClear(true)} disabled={entries.length === 0}>
            Clear Log
          </button>
        ) : (
          <>
            <span className="audit-log-confirm-text">Clear all entries?</span>
            <button type="button" className="btn btn-sm btn-danger" onClick={handleClear}>Yes</button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmClear(false)}>No</button>
          </>
        )}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="empty-hint" style={{ marginTop: 16 }}>
          {entries.length === 0 ? 'No audit entries yet. Changes to environments, microservices, and auth profiles will appear here.' : 'No entries match the current filter.'}
        </div>
      ) : (
        <div className="audit-log-timeline">
          {filtered.map((entry) => (
            <div key={entry.id} className="audit-log-entry">
              <span
                className="audit-log-action-icon"
                style={{ color: ACTION_COLORS[entry.action] }}
                title={formatAction(entry.action)}
              >
                {ACTION_ICONS[entry.action]}
              </span>
              <div className="audit-log-entry-body">
                <div className="audit-log-entry-header">
                  <span className="audit-log-entity-type">{formatEntityType(entry.entityType)}</span>
                  <strong className="audit-log-entity-name">{entry.entityName}</strong>
                  <span className={`audit-log-action-badge audit-log-action-${entry.action}`}>
                    {formatAction(entry.action)}
                  </span>
                  <span className="audit-log-timestamp">{formatTimestamp(entry.timestamp)}</span>
                </div>
                {entry.changes && entry.changes.length > 0 && (
                  <div className="audit-log-changes">
                    {entry.changes.map((c, i) => (
                      <div key={i} className="audit-log-change">
                        <span className="audit-log-change-field">{c.field}:</span>
                        <span className="audit-log-change-old">{formatChangeValue(c.oldValue)}</span>
                        <span className="audit-log-change-arrow">→</span>
                        <span className="audit-log-change-new">{formatChangeValue(c.newValue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
