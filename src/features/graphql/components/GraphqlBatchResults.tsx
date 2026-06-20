/**
 * GraphqlBatchResults — Phase 3F (task 3F-4)
 *
 * Displays batch execution results as N stacked response cards, one per
 * operation, preserved in request-index order.
 *
 * Layout:
 *   - Header: "Batch of N" with summary "N passed / M failed"
 *   - Per-operation cards with success (green) / error (red) header stripe
 *   - Each card expands to show the full data/errors
 */

import { useState } from 'react';
import type { GraphqlBatchResult, GraphqlBatchOperationResult } from '../../../shared/types/graphql';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlBatchResultsProps {
  result: GraphqlBatchResult;
  onDismiss: () => void;
}

// ─── Sub-component: single operation card ────────────────────────────────────

interface BatchOpCardProps {
  item: GraphqlBatchOperationResult;
}

function BatchOpCard({ item }: BatchOpCardProps) {
  const [expanded, setExpanded] = useState(true);
  const { response, operationName, index } = item;

  const hasErrors = (response.errors?.length ?? 0) > 0;
  const isSuccess = !hasErrors || response.data !== null;
  const cardClass = `gql-batch-card ${isSuccess ? 'gql-batch-card--success' : 'gql-batch-card--error'}`;

  const latencyLabel = response.latencyMs > 0 ? `${response.latencyMs} ms` : '';
  const statusLabel  = response.httpStatus > 0 ? `HTTP ${response.httpStatus}` : '';
  const displayName  = operationName ?? `Operation ${index + 1}`;

  return (
    <div className={cardClass}>
      <button
        type="button"
        className="gql-batch-card-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="gql-batch-card-indicator">{isSuccess ? '✓' : '✗'}</span>
        <span className="gql-batch-card-name">{displayName}</span>
        <span className="gql-batch-card-meta">
          {statusLabel && <span className="gql-batch-card-status">{statusLabel}</span>}
          {latencyLabel && <span className="gql-batch-card-latency">{latencyLabel}</span>}
        </span>
        <span className="gql-batch-card-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="gql-batch-card-body">
          {response.errors && response.errors.length > 0 && (
            <div className="gql-batch-card-errors">
              {response.errors.map((err, i) => (
                <div key={i} className="gql-batch-card-error-item">
                  <span className="gql-batch-card-error-msg">{err.message}</span>
                  {Array.isArray(err.path) && err.path.length > 0 && (
                    <span className="gql-batch-card-error-path">{err.path.join(' → ')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {response.data !== undefined && response.data !== null && (
            <pre className="gql-batch-card-data">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          )}
          {response.data === null && !response.errors?.length && (
            <p className="gql-batch-card-empty">No data returned.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GraphqlBatchResults({ result, onDismiss }: GraphqlBatchResultsProps) {
  const total   = result.results.length;
  const passed  = result.results.filter(
    (r) => (r.response.errors?.length ?? 0) === 0 || r.response.data !== null,
  ).length;
  const failed  = total - passed;

  return (
    <div className="gql-batch-results" data-testid="gql-batch-results">
      {/* Header row */}
      <div className="gql-batch-results-header">
        <span className="gql-batch-results-title">Batch of {total}</span>
        <span className="gql-batch-results-summary">
          <span className="gql-batch-summary-passed">{passed} passed</span>
          {failed > 0 && (
            <span className="gql-batch-summary-failed">{failed} failed</span>
          )}
        </span>
        {result.batchUnsupported && (
          <span
            className="gql-batch-unsupported-badge"
            title="Server does not support array batching — operations were sent individually"
          >
            Sequential fallback
          </span>
        )}
        <button
          type="button"
          className="gql-batch-results-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss batch results"
        >
          ×
        </button>
      </div>

      {/* Per-operation cards, ordered by request index */}
      <div className="gql-batch-cards">
        {result.results.map((item) => (
          <BatchOpCard key={item.index} item={item} />
        ))}
      </div>
    </div>
  );
}
