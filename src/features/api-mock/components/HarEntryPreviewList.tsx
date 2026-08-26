import type { HarPreviewResult } from '@shared/api-mock/harImport';

interface Props {
  preview: HarPreviewResult;
  /** Accepted-array positions (0..N-1) — NOT raw HAR entry indices. */
  selectedIndices: Set<number>;
  onToggle: (pos: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const FILTER_REASON_LABELS: Record<string, string> = {
  'options-preflight': 'CORS',
  'tracking-domain': 'tracking',
  'non-http': 'non-HTTP',
  'duplicate': 'duplicate',
};

export function HarEntryPreviewList({
  preview,
  selectedIndices,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: Props) {
  return (
    <div className="am-har-preview-list" data-testid="am-har-preview-list">
      <div className="am-har-preview-summary">
        <span>
          Found <strong>{preview.accepted.length}</strong> request{preview.accepted.length !== 1 ? 's' : ''}
          {preview.autoFiltered.length > 0 && (
            <span className="am-har-summary-filtered"> · {preview.autoFiltered.length} filtered</span>
          )}
          {preview.secretHits > 0 && (
            <span className="am-har-summary-redacted"> · {preview.secretHits} header{preview.secretHits !== 1 ? 's' : ''} redacted</span>
          )}
          {preview.truncated && (
            <span className="am-har-summary-truncated"> · truncated to cap</span>
          )}
        </span>
        <span className="am-har-select-controls">
          <button
            type="button"
            className="am-btn small ghost"
            onClick={onSelectAll}
            data-testid="am-har-select-all"
          >
            All
          </button>
          <button
            type="button"
            className="am-btn small ghost"
            onClick={onDeselectAll}
            data-testid="am-har-select-none"
          >
            None
          </button>
        </span>
      </div>

      {preview.accepted.length === 0 && !preview.error && (
        <div className="am-har-empty" data-testid="am-har-empty">
          No accepted entries — all entries were filtered automatically.
        </div>
      )}

      <div className="am-har-entry-table" data-testid="am-har-entry-table">
        {/* pos = accepted-array position (0..N-1); entry.index = raw HAR array index (display-only) */}
        {preview.accepted.map((entry, pos) => (
          <label
            key={pos}
            className={`am-har-entry-row${selectedIndices.has(pos) ? ' am-har-entry-row--checked' : ''}`}
            data-testid={`am-har-entry-${pos}`}
          >
            <input
              type="checkbox"
              checked={selectedIndices.has(pos)}
              onChange={() => onToggle(pos)}
              data-testid={`am-har-entry-cb-${pos}`}
            />
            <span className={`am-har-method am-har-method-${entry.method.toLowerCase()}`}>
              {entry.method}
            </span>
            <span className="am-har-path" title={`${entry.host}${entry.path}`}>
              {entry.path}
            </span>
            <span className="am-har-status">{entry.status}</span>
            {entry.hasRedactedHeaders && (
              <span className="am-har-redacted" title="Contains redacted headers" aria-label="redacted headers">
                🔒
              </span>
            )}
          </label>
        ))}

        {preview.autoFiltered.length > 0 && (
          <details className="am-har-filtered-section" data-testid="am-har-filtered-section">
            <summary className="am-har-filtered-label">
              {preview.autoFiltered.length} automatically filtered
            </summary>
            {preview.autoFiltered.map((entry, i) => (
              <div key={i} className="am-har-entry-row am-har-entry-row--filtered">
                <span className={`am-har-method am-har-method-${entry.method.toLowerCase()}`}>
                  {entry.method}
                </span>
                <span className="am-har-path" title={`${entry.host}${entry.path}`}>
                  {entry.path}
                </span>
                <span className="am-har-filter-reason">
                  [{entry.filteredReason ? (FILTER_REASON_LABELS[entry.filteredReason] ?? entry.filteredReason) : ''}]
                </span>
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}
