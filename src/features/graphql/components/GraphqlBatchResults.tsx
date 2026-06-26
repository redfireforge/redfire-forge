/**
 * GraphqlBatchResults — Phase 3F (task 3F-4)
 *
 * Displays batch execution results as N stacked response cards, one per
 * operation, preserved in request-index order.
 */

import { useEffect, useId, useState } from 'react';
import type { GraphqlBatchResult, GraphqlBatchOperationResult } from '../../../shared/types/graphql';

interface GraphqlBatchResultsProps {
  result: GraphqlBatchResult;
  onDismiss: () => void;
}

function StatusIcon({ success }: { success: boolean }) {
  if (success) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`gql-batch-card-chevron-icon${expanded ? ' gql-batch-card-chevron-icon--expanded' : ''}`}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

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
  const statusLabel = response.httpStatus > 0 ? `HTTP ${response.httpStatus}` : '';
  const displayName = operationName ?? `Operation ${index + 1}`;

  return (
    <div className={cardClass}>
      <button
        type="button"
        className="gql-batch-card-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${displayName}${statusLabel ? `, ${statusLabel}` : ''}${latencyLabel ? `, ${latencyLabel}` : ''}`}
      >
        <span className="gql-batch-card-index">#{index + 1}</span>
        <span className={`gql-batch-card-indicator${isSuccess ? ' gql-batch-card-indicator--success' : ' gql-batch-card-indicator--error'}`}>
          <StatusIcon success={isSuccess} />
        </span>
        <span className="gql-batch-card-name">{displayName}</span>
        <span className="gql-batch-card-meta">
          {statusLabel && (
            <span className={`gql-batch-card-status${isSuccess ? ' gql-batch-card-status--success' : ' gql-batch-card-status--error'}`}>
              {statusLabel}
            </span>
          )}
          {latencyLabel && <span className="gql-batch-card-latency">{latencyLabel}</span>}
        </span>
        <ChevronIcon expanded={expanded} />
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

export function GraphqlBatchResults({ result, onDismiss }: GraphqlBatchResultsProps) {
  const titleId = useId();
  const total = result.results.length;
  const passed = result.results.filter(
    (r) => (r.response.errors?.length ?? 0) === 0 || r.response.data !== null,
  ).length;
  const failed = total - passed;
  const allPassed = failed === 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="gql-batch-results"
      data-testid="gql-batch-results"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="gql-batch-results-header">
        <div className="gql-batch-results-heading">
          <h2 id={titleId} className="gql-batch-results-title">Batch execution</h2>
          <p className="gql-batch-results-subtitle">
            {total} operation{total !== 1 ? 's' : ''} completed
          </p>
        </div>
        <div className="gql-batch-results-badges">
          <span className={`gql-batch-summary-pill gql-batch-summary-pill--passed${allPassed ? ' gql-batch-summary-pill--solo' : ''}`}>
            {passed} passed
          </span>
          {failed > 0 && (
            <span className="gql-batch-summary-pill gql-batch-summary-pill--failed">
              {failed} failed
            </span>
          )}
          {result.batchUnsupported && (
            <span
              className="gql-batch-summary-pill gql-batch-summary-pill--fallback"
              title="Server does not support array batching — operations were sent individually"
            >
              Sequential fallback
            </span>
          )}
        </div>
      </header>

      <div className="gql-batch-cards">
        {result.results.map((item) => (
          <BatchOpCard key={item.index} item={item} />
        ))}
      </div>

      <footer className="gql-batch-results-footer">
        <button
          type="button"
          className="gql-btn gql-btn--secondary gql-batch-results-close-btn"
          onClick={onDismiss}
          aria-label="Close batch results"
        >
          Close
        </button>
      </footer>
    </div>
  );
}
