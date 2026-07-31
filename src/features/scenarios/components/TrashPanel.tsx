import { useState, useMemo } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { CustomSelect } from '../../../shared/components/CustomSelect';
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
      <AppModalFrame
        open
        title={
          <span className="trash-modal-title">
            <span className="trash-modal-title-icon">🗑</span>
            Trash
            {trashItems.length > 0 && (
              <span className="trash-modal-title-count">{trashItems.length}</span>
            )}
          </span>
        }
        onClose={onClose}
        overlayClassName="modal-overlay"
        dialogClassName="trash-modal"
        closeButtonKind="none"
        showExpandButton={false}
        closeOnOverlayClick={false}
        constrainDragToViewport
        dragViewportPadding={12}
        minWidth={480}
        minHeight={300}
        bodyClassName="trash-modal-body"
        footerClassName="trash-modal-footer"
        footer={
          <div className="trash-footer-bar">
            <div className="trash-footer-settings">
              <label className="trash-footer-setting">
                <span className="trash-footer-setting-label">Retention</span>
                <CustomSelect
                  className="trash-footer-select"
                  data-testid="har-trash-retention"
                  value={String(trashSettings.retentionDays)}
                  onChange={v => onUpdateSettings({ retentionDays: Number(v) })}
                  options={RETENTION_OPTIONS.map(d => ({ value: String(d), label: `${d} days` }))}
                  aria-label="Trash retention period"
                  size="sm"
                />
              </label>
              <label className="trash-footer-setting">
                <span className="trash-footer-setting-label">Max items</span>
                <CustomSelect
                  className="trash-footer-select"
                  data-testid="har-trash-max-items"
                  value={String(trashSettings.maxItems)}
                  onChange={v => onUpdateSettings({ maxItems: Number(v) })}
                  options={MAX_ITEMS_OPTIONS.map(n => ({ value: String(n), label: String(n) }))}
                  aria-label="Maximum trash items"
                  size="sm"
                />
              </label>
            </div>
            <div className="trash-footer-actions">
              <button
                className="trash-empty-btn"
                data-testid="har-trash-empty-btn"
                onClick={() => setConfirmEmpty(true)}
                disabled={trashItems.length === 0}
                aria-label="Empty trash"
              >
                Empty Trash
              </button>
              <button className="btn btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        }
      >
        <div className="trash-search-wrap">
          <svg className="trash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="trash-search-input"
            type="text"
            placeholder="Search trash…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search trash"
          />
          {search && (
            <button className="trash-search-clear" onClick={() => setSearch('')} aria-label="Clear search">&times;</button>
          )}
        </div>

        {loading ? (
          <div className="trash-empty-state">
            <span className="trash-empty-state-icon">⋯</span>
            <span className="trash-empty-state-text">Loading trash…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="trash-empty-state">
            <span className="trash-empty-state-icon">{search ? '🔍' : '🗑'}</span>
            <span className="trash-empty-state-text">{search ? 'No items match your search' : 'Trash is empty'}</span>
            {!search && <span className="trash-empty-state-hint">Deleted items will appear here</span>}
          </div>
        ) : (
          <div className="trash-list" role="list">
            {filtered.map(item => {
              const counts = formatChildCounts(item);
              return (
                <div key={item.id} className="trash-card" role="listitem">
                  <div className="trash-card-icon" aria-hidden="true">
                    {ENTITY_ICONS[item.entityType]}
                  </div>
                  <div className="trash-card-body">
                    <div className="trash-card-row-1">
                      <span className="trash-card-name" title={item.entityName}>
                        {item.entityName}
                      </span>
                      {counts && <span className="trash-card-counts">{counts}</span>}
                      <span className="trash-card-type">{ENTITY_LABELS[item.entityType]}</span>
                    </div>
                    {item.parentPath && (
                      <div className="trash-card-path">{item.parentPath}</div>
                    )}
                    <div className="trash-card-meta">
                      Deleted {formatRelativeTime(item.deletedAt, formatTimestamp)}
                      <span className="trash-card-sep">·</span>
                      {formatExpiry(item.expiresAt)}
                    </div>
                  </div>
                  <div className="trash-card-actions">
                    <button
                      className="trash-card-restore"
                      onClick={() => onRestore(item.id)}
                      aria-label={`Restore ${item.entityName}`}
                    >
                      Restore
                    </button>
                    <button
                      className="trash-card-delete"
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
      </AppModalFrame>

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
