import { useState, useMemo } from 'react';
import PopupModal from '../../../shared/components/PopupModal';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import type { TrashItem, TrashEntityType, TrashSettings } from '../../../shared/types';
import { formatRelativeTime, formatTimestamp } from '../../../shared/utils/formatRelativeTime';
import { TRASH_MS_PER_DAY, TRASH_RETENTION_OPTIONS, TRASH_MAX_ITEMS_OPTIONS } from '../../../shared/utils/trashConstants';

const ENTITY_ICONS: Record<TrashEntityType, string> = {
  featureGroup: '\u{1F4C1}',
  scenario: '\u{1F4CB}',
  test: '\u{26A1}',
  sharedDataSource: '\u{1F4E6}',
};

const ENTITY_LABELS: Record<TrashEntityType, string> = {
  featureGroup: 'Feature Group',
  scenario: 'Scenario',
  test: 'Test',
  sharedDataSource: 'Shared Data Source',
};

function formatExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';
  const days = Math.ceil(remaining / TRASH_MS_PER_DAY);
  return days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`;
}

function formatChildCounts(item: TrashItem): string | null {
  const parts: string[] = [];
  if (item.childCounts?.scenarios) {
    parts.push(`${item.childCounts.scenarios} scenario${item.childCounts.scenarios !== 1 ? 's' : ''}`);
  }
  if (item.childCounts?.tests) {
    parts.push(`${item.childCounts.tests} test${item.childCounts.tests !== 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(' \u00B7 ') : null;
}

const RETENTION_OPTIONS = TRASH_RETENTION_OPTIONS;
const MAX_ITEMS_OPTIONS = TRASH_MAX_ITEMS_OPTIONS;

interface Props {
  trashItems: TrashItem[];
  loading: boolean;
  trashSettings: TrashSettings;
  onUpdateSettings: (partial: Partial<TrashSettings>) => Promise<void>;
  onRestore: (trashId: string) => Promise<void>;
  onPermanentlyDelete: (trashId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
  onClose: () => void;
}

export default function TrashPanel({
  trashItems,
  loading,
  trashSettings,
  onUpdateSettings,
  onRestore,
  onPermanentlyDelete,
  onEmptyTrash,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return trashItems;
    const q = search.trim().toLowerCase();
    return trashItems.filter(
      item => item.entityName.toLowerCase().includes(q) || item.parentPath.toLowerCase().includes(q),
    );
  }, [trashItems, search]);

  const pendingItem = pendingDeleteId ? trashItems.find(i => i.id === pendingDeleteId) : null;

  return (
    <>
      <PopupModal
        title={`Trash (${trashItems.length})`}
        onClose={onClose}
        dialogClassName="trash-panel-modal"
        footer={
          <>
            <div className="trash-panel-settings">
              <label className="trash-panel-setting-label">
                Retention
                <select
                  className="trash-panel-setting-select"
                  value={trashSettings.retentionDays}
                  onChange={e => onUpdateSettings({ retentionDays: Number(e.target.value) })}
                  aria-label="Trash retention period"
                >
                  {RETENTION_OPTIONS.map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </label>
              <label className="trash-panel-setting-label">
                Max items
                <select
                  className="trash-panel-setting-select"
                  value={trashSettings.maxItems}
                  onChange={e => onUpdateSettings({ maxItems: Number(e.target.value) })}
                  aria-label="Maximum trash items"
                >
                  {MAX_ITEMS_OPTIONS.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="trash-panel-empty-footer-btn"
              onClick={() => setConfirmEmpty(true)}
              disabled={trashItems.length === 0}
              aria-label="Empty trash"
            >
              Empty Trash
            </button>
            <button className="btn" onClick={onClose}>Close</button>
          </>
        }
      >
        <div className="trash-panel-header">
          <input
            className="trash-panel-search"
            type="text"
            placeholder="Search trash\u2026"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search trash"
          />
        </div>

        {loading ? (
          <div className="trash-panel-empty">
            <span className="trash-panel-empty-icon">&#x2026;</span>
            <span>Loading trash{'\u2026'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="trash-panel-empty">
            <span className="trash-panel-empty-icon">{search ? '\u{1F50D}' : '\u{2212}'}</span>
            <span>{search ? 'No items match your search' : 'Trash is empty'}</span>
          </div>
        ) : (
          <div className="trash-panel-list" role="list">
            {filtered.map(item => {
              const counts = formatChildCounts(item);
              return (
                <div key={item.id} className="trash-item" role="listitem">
                  <span className="trash-item-icon" aria-hidden="true">
                    {ENTITY_ICONS[item.entityType]}
                  </span>
                  <div className="trash-item-body">
                    <div className="trash-item-name" title={item.entityName}>
                      {item.entityName}
                    </div>
                    {item.parentPath && (
                      <div className="trash-item-meta">
                        {item.parentPath}
                      </div>
                    )}
                    {counts && <div className="trash-item-counts">{counts}</div>}
                    <div className="trash-item-meta">
                      Deleted {formatRelativeTime(item.deletedAt, formatTimestamp)}
                      <span className="trash-item-meta-sep" />
                      {formatExpiry(item.expiresAt)}
                    </div>
                    <span className="trash-item-type">{ENTITY_LABELS[item.entityType]}</span>
                  </div>
                  <div className="trash-item-actions">
                    <button
                      className="trash-item-restore"
                      onClick={() => onRestore(item.id)}
                      aria-label={`Restore ${item.entityName}`}
                    >
                      Restore
                    </button>
                    <button
                      className="trash-item-delete"
                      onClick={() => setPendingDeleteId(item.id)}
                      aria-label={`Delete ${item.entityName} permanently`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopupModal>

      {pendingItem && (
        <ConfirmModal
          title="Delete Permanently"
          message={`Permanently delete "${pendingItem.entityName}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => { onPermanentlyDelete(pendingItem.id); setPendingDeleteId(null); }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Empty Trash"
          message={`Permanently delete all ${trashItems.length} item${trashItems.length !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel="Empty Trash"
          variant="danger"
          onConfirm={() => { onEmptyTrash(); setConfirmEmpty(false); }}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </>
  );
}
