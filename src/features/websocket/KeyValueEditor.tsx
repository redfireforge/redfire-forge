import type { WsKeyValueEntry } from '@shared/websocket/types';
import { useListDragReorder } from '@shared/hooks/useListDragReorder';
import '../../styles/key-value-editor.css';

interface KeyValueEditorProps {
  entries: WsKeyValueEntry[];
  onChange: (entries: WsKeyValueEntry[]) => void;
  disabled?: boolean;
  label: string;
  testIdPrefix?: string;
  /** Optional handler that clears all entries. When provided, a "Delete all" button is rendered beside Add. */
  onDeleteAll?: () => void;
  /** Verb used in the enable/disable toggle tooltip, e.g. "connect" (default) or "send". */
  toggleVerb?: string;
  /** Optional CSS class override for the section wrapper (default: ws-connect-kv-section) */
  sectionClassName?: string;
  /** Optional CSS class override for the header wrapper (default: ws-connect-kv-header) */
  headerClassName?: string;
  /** Optional CSS class override for the label (default: ws-connect-label) */
  labelClassName?: string;
}

const KV_DND_MIME = 'application/x-redfire-kv-index';

export function KeyValueEditor({
  entries,
  onChange,
  disabled = false,
  label,
  testIdPrefix,
  onDeleteAll,
  toggleVerb = 'connect',
  sectionClassName = 'ws-connect-kv-section',
  headerClassName = 'ws-connect-kv-header',
  labelClassName = 'ws-connect-label',
}: KeyValueEditorProps) {
  const { onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDragOver } = useListDragReorder(
    entries,
    onChange,
    { disabled, mime: KV_DND_MIME },
  );

  const addEntry = () => {
    onChange([...entries, { key: '', value: '', enabled: true }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, patch: Partial<WsKeyValueEntry>) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const lower = label.toLowerCase();
  const rowCountLabel = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  return (
    <div className={sectionClassName} data-testid={testIdPrefix ? `${testIdPrefix}-section` : undefined}>
      <div className={headerClassName}>
        <div className="ws-connect-kv-heading-group">
          <span className={labelClassName}>{label}</span>
          <span className="ws-connect-kv-count-badge" aria-label={`${label} count`}>{rowCountLabel}</span>
        </div>
        <div className="ws-connect-kv-actions">
          {onDeleteAll && entries.length > 0 && (
            <button
              className="ws-connect-kv-add-btn ws-connect-kv-delete-all-btn"
              onClick={onDeleteAll}
              disabled={disabled}
              data-testid={testIdPrefix ? `${testIdPrefix}-delete-all-btn` : undefined}
              aria-label={`Delete all ${lower}`}
              type="button"
            >
              Delete all
            </button>
          )}
          <button
            className="ws-connect-kv-add-btn"
            onClick={addEntry}
            disabled={disabled}
            data-testid={testIdPrefix ? `${testIdPrefix}-add-btn` : undefined}
            aria-label={`Add ${lower}`}
            type="button"
          >
            + Add
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="ws-connect-kv-empty" data-testid={testIdPrefix ? `${testIdPrefix}-empty` : undefined}>
          No {lower} yet. Click <strong>Add</strong> to create one.
        </div>
      ) : (
        <div className="ws-connect-kv-table" role="list" data-dense={entries.length >= 10 ? 'true' : undefined}>
          <div className="ws-connect-kv-table-head" aria-hidden="true">
            <span className="ws-connect-kv-head-spacer" />
            <span className="ws-connect-kv-head-cell ws-connect-kv-head-key">Key</span>
            <span className="ws-connect-kv-head-cell ws-connect-kv-head-value">Value</span>
            <span className="ws-connect-kv-head-cell ws-connect-kv-head-enabled">On</span>
            <span className="ws-connect-kv-head-cell ws-connect-kv-head-remove" />
          </div>
          {entries.map((entry, index) => {
            const rowClass = [
              'ws-connect-kv-row',
              entry.enabled ? '' : 'is-disabled-entry',
              isDragOver(index) ? 'is-drag-over' : '',
              isDragging(index) ? 'is-dragging' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                className={rowClass}
                key={index}
                role="listitem"
                data-testid={testIdPrefix ? `${testIdPrefix}-row-${index}` : undefined}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
              >
                <span
                  className="ws-connect-kv-grip"
                  draggable={!disabled}
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragEnd={onDragEnd}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Reorder ${lower} ${index + 1}`}
                  title="Drag to reorder"
                  data-testid={testIdPrefix ? `${testIdPrefix}-grip-${index}` : undefined}
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                    <circle cx="3" cy="3" r="1.3" />
                    <circle cx="7" cy="3" r="1.3" />
                    <circle cx="3" cy="8" r="1.3" />
                    <circle cx="7" cy="8" r="1.3" />
                    <circle cx="3" cy="13" r="1.3" />
                    <circle cx="7" cy="13" r="1.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="ws-connect-kv-input ws-connect-kv-key"
                  value={entry.key}
                  onChange={(e) => updateEntry(index, { key: e.target.value })}
                  placeholder="Key"
                  disabled={disabled}
                  aria-label={`${label} key ${index + 1}`}
                />
                <input
                  type="text"
                  className="ws-connect-kv-input ws-connect-kv-value"
                  value={entry.value}
                  onChange={(e) => updateEntry(index, { value: e.target.value })}
                  placeholder="Value"
                  disabled={disabled}
                  aria-label={`${label} value ${index + 1}`}
                />
                <label
                  className="ws-connect-kv-toggle"
                  title={entry.enabled ? `Enabled — included on ${toggleVerb}` : `Disabled — skipped on ${toggleVerb}`}
                >
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => updateEntry(index, { enabled: e.target.checked })}
                    disabled={disabled}
                    className="ws-connect-kv-checkbox"
                    aria-label={`Enable ${lower} ${index + 1}`}
                  />
                </label>
                <button
                  className="ws-connect-kv-remove-btn"
                  onClick={() => removeEntry(index)}
                  disabled={disabled}
                  aria-label={`Remove ${lower} ${index + 1}`}
                  title={`Remove ${lower}`}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
