import type { WsKeyValueEntry } from '../../shared/websocket/types';

interface KeyValueEditorProps {
  entries: WsKeyValueEntry[];
  onChange: (entries: WsKeyValueEntry[]) => void;
  disabled?: boolean;
  label: string;
  testIdPrefix?: string;
  /** Optional CSS class override for the section wrapper (default: ws-connect-kv-section) */
  sectionClassName?: string;
  /** Optional CSS class override for the header wrapper (default: ws-connect-kv-header) */
  headerClassName?: string;
  /** Optional CSS class override for the label (default: ws-connect-label) */
  labelClassName?: string;
}

export function KeyValueEditor({
  entries,
  onChange,
  disabled = false,
  label,
  testIdPrefix,
  sectionClassName = 'ws-connect-kv-section',
  headerClassName = 'ws-connect-kv-header',
  labelClassName = 'ws-connect-label',
}: KeyValueEditorProps) {
  const addEntry = () => {
    onChange([...entries, { key: '', value: '', enabled: true }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, patch: Partial<WsKeyValueEntry>) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  return (
    <div className={sectionClassName} data-testid={testIdPrefix ? `${testIdPrefix}-section` : undefined}>
      <div className={headerClassName}>
        <span className={labelClassName}>{label}</span>
        <button
          className="ws-connect-kv-add-btn"
          onClick={addEntry}
          disabled={disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-add-btn` : undefined}
          aria-label={`Add ${label.toLowerCase()}`}
          type="button"
        >
          + Add
        </button>
      </div>
      {entries.map((entry, index) => (
        <div className="ws-connect-kv-row" key={index} data-testid={testIdPrefix ? `${testIdPrefix}-row-${index}` : undefined}>
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
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={(e) => updateEntry(index, { enabled: e.target.checked })}
            disabled={disabled}
            className="ws-connect-kv-checkbox"
            aria-label={`Enable ${label.toLowerCase()} ${index + 1}`}
          />
          <button
            className="ws-connect-kv-remove-btn"
            onClick={() => removeEntry(index)}
            disabled={disabled}
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            title={`Remove ${label.toLowerCase()}`}
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
      ))}
    </div>
  );
}
