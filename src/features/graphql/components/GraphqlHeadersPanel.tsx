import { useCallback } from 'react';
import type { GraphqlEnvironment, GraphqlHeaderRow } from '@shared/types/graphql';
import { findUnresolvedVars } from '../utils/envUtils';
import { makeHeaderId } from '../utils/headerUtils';

interface GraphqlHeadersPanelProps {
  headers: GraphqlHeaderRow[];
  onChange: (headers: GraphqlHeaderRow[]) => void;
  disabled?: boolean;
  /** Phase 1E: active environment for {{var}} resolution warnings */
  activeEnvironment?: GraphqlEnvironment | null;
  /** Phase 4: global env map from header env/service selection ({{graphqlUrl}}, etc.) */
  globalEnvMap?: Record<string, string>;
}

export function GraphqlHeadersPanel({
  headers,
  onChange,
  disabled = false,
  activeEnvironment,
  globalEnvMap,
}: GraphqlHeadersPanelProps) {
  const addHeader = useCallback(() => {
    onChange([...headers, { id: makeHeaderId(), key: '', value: '', enabled: true }]);
  }, [headers, onChange]);

  const removeHeader = useCallback(
    (id: string) => {
      onChange(headers.filter((h) => h.id !== id));
    },
    [headers, onChange],
  );

  const updateHeader = useCallback(
    (id: string, patch: Partial<Omit<GraphqlHeaderRow, 'id'>>) => {
      onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    },
    [headers, onChange],
  );

  return (
    <div className="gql-headers-panel" data-testid="gql-headers-panel">
      <div className="gql-headers-toolbar">
        <span className="gql-headers-label">Headers</span>
        <button
          className="gql-btn gql-btn--sm"
          onClick={addHeader}
          disabled={disabled}
          data-testid="gql-headers-add-btn"
          type="button"
          aria-label="Add header"
        >
          + Add
        </button>
      </div>

      {headers.length === 0 ? (
        <div className="gql-headers-empty" data-testid="gql-headers-empty">
          No headers yet. Click <strong>Add</strong> to create one.
        </div>
      ) : (
        <div className="gql-headers-table" role="list">
          <div className="gql-headers-row gql-headers-row--head" role="listitem" aria-hidden>
            <span className="gql-headers-cell gql-headers-cell--toggle" />
            <span className="gql-headers-cell gql-headers-cell--key">Key</span>
            <span className="gql-headers-cell gql-headers-cell--value">Value</span>
            <span className="gql-headers-cell gql-headers-cell--remove" />
          </div>
          {headers.map((header, idx) => {
            // Phase 1E: check for unresolved {{var}} refs in the header value
            const unresolvedVars =
              header.enabled && header.value
                ? findUnresolvedVars(header.value, activeEnvironment, globalEnvMap)
                : [];
            const hasWarning = unresolvedVars.length > 0;
            const warningTooltip = hasWarning
              ? unresolvedVars.map((k) => `'{{${k}}}' not found in active environment`).join('\n')
              : '';

            // Use the header key name if present, otherwise fall back to row number,
            // so aria-labels are unique across rows (avoids "Header key, Header key, Header key")
            const rowLabel = header.key.trim() || `row ${idx + 1}`;

            return (
              <div
                className={`gql-headers-row${header.enabled ? '' : ' gql-headers-row--disabled'}`}
                key={header.id}
                role="listitem"
                data-testid={`gql-header-row-${header.id}`}
              >
                <label
                  className="gql-headers-cell gql-headers-cell--toggle"
                  title={header.enabled ? 'Enabled — included in request' : 'Disabled — skipped'}
                >
                  <input
                    type="checkbox"
                    checked={header.enabled}
                    onChange={(e) => updateHeader(header.id, { enabled: e.target.checked })}
                    disabled={disabled}
                    aria-label={`Enable ${rowLabel} header`}
                  />
                </label>
                <input
                  type="text"
                  className="gql-headers-cell gql-headers-cell--key gql-input"
                  value={header.key}
                  onChange={(e) => updateHeader(header.id, { key: e.target.value })}
                  placeholder="Header name"
                  disabled={disabled}
                  // BUG-GQL-R6-4 fix: use rowLabel (key name when available) for consistency
                  // with the value input and remove button in the same row.
                  aria-label={`${rowLabel} header name`}
                  data-testid={`gql-header-key-${header.id}`}
                />
                <div className="gql-headers-cell gql-headers-cell--value-wrap">
                  <input
                    type="text"
                    className={`gql-headers-cell--value gql-input${hasWarning ? ' gql-headers-value--warn' : ''}`}
                    value={header.value}
                    onChange={(e) => updateHeader(header.id, { value: e.target.value })}
                    placeholder="Value ({{var}} supported)"
                    disabled={disabled}
                    aria-label={`${rowLabel} header value`}
                    data-testid={`gql-header-value-${header.id}`}
                  />
                  {hasWarning && (
                    <span
                      className="gql-headers-unresolved-icon"
                      title={warningTooltip}
                      aria-label={warningTooltip}
                      data-testid={`gql-header-unresolved-${header.id}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                  )}
                </div>
                <button
                  className="gql-headers-cell gql-headers-cell--remove gql-btn gql-btn--icon gql-btn--danger"
                  onClick={() => removeHeader(header.id)}
                  disabled={disabled}
                  aria-label={`Remove ${rowLabel} header`}
                  title="Remove header"
                  type="button"
                  data-testid={`gql-header-remove-${header.id}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
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
