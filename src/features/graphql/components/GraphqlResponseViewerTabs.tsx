/**
 * GraphqlResponseViewerTabs — Headers and Metadata tab panels.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { GraphqlResponse } from '../../../shared/types/graphql';
import { authSentSourceLabel } from '../utils/gqlAuthResolve';
import { serializeGraphqlRequestBody } from '../utils/graphqlRequestBodyDisplay';
import {
  batchLatencyStatusLabel,
  batchOperationSlotLabel,
  batchResponseExplainer,
  batchTransportSummaryForResponse,
} from '../utils/batchResponseContextUtils';
import {
  formatTimestamp,
  humanizeBytes,
  statusColorClass,
  statusFullLabel,
} from '../utils/graphqlResponseViewerUtils';

const REQUEST_BODY_COLLAPSE_CHARS = 480;
const REQUEST_HEADERS_COLLAPSE_COUNT = 4;

function shouldCollapseRequestBody(body: Record<string, unknown>): boolean {
  const text = JSON.stringify(body, null, 2);
  return text.length > REQUEST_BODY_COLLAPSE_CHARS || text.split('\n').length > 12;
}

interface MetadataCollapsibleSectionProps {
  title: string;
  sectionTestId: string;
  toggleTestId: string;
  defaultExpanded: boolean;
  collapsedSummary?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

function MetadataCollapsibleSection({
  title,
  sectionTestId,
  toggleTestId,
  defaultExpanded,
  collapsedSummary,
  headerActions,
  children,
}: MetadataCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="gql-rv-meta-section" data-testid={sectionTestId}>
      <div className="gql-rv-meta-section-header">
        <button
          type="button"
          className="gql-rv-meta-section-toggle"
          data-testid={toggleTestId}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          <span
            className={`gql-rv-meta-section-chevron${expanded ? ' gql-rv-meta-section-chevron--open' : ''}`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="gql-rv-meta-section-title">{title}</span>
          {!expanded && collapsedSummary && (
            <span className="gql-rv-meta-section-summary">{collapsedSummary}</span>
          )}
        </button>
        {expanded && headerActions && (
          <div className="gql-rv-meta-section-actions">{headerActions}</div>
        )}
      </div>
      {expanded && (
        <div className="gql-rv-meta-section-body">
          {children}
        </div>
      )}
    </div>
  );
}

function MetadataRequestBodySection({ body }: { body: Record<string, unknown> }) {
  const [graphqlView, setGraphqlView] = useState(false);
  const displayText = useMemo(
    () => serializeGraphqlRequestBody(body, { graphqlView }),
    [body, graphqlView],
  );

  return (
    <MetadataCollapsibleSection
      title="Request body"
      sectionTestId="gql-rv-request-body"
      toggleTestId="gql-rv-request-body-toggle"
      defaultExpanded={!shouldCollapseRequestBody(body)}
      collapsedSummary="POST payload — click to expand"
      headerActions={(
        <button
          type="button"
          className={`gql-rv-pretty-badge${graphqlView ? ' gql-rv-pretty-badge--active' : ''}`}
          onClick={() => setGraphqlView((value) => !value)}
          title={graphqlView ? 'Show raw POST JSON' : 'Show GraphQL query and variables view'}
          data-testid="gql-rv-request-body-pretty-btn"
        >
          {graphqlView ? 'Raw JSON' : 'GraphQL view'}
        </button>
      )}
    >
      <pre className="gql-rv-request-body-json" data-testid="gql-rv-request-body-content">
        {displayText}
      </pre>
    </MetadataCollapsibleSection>
  );
}

interface MetadataTabProps {
  response: GraphqlResponse;
  bodySize: number;
}

export function MetadataTab({ response, bodySize }: MetadataTabProps) {
  // BUG-GQL-R10-18 fix: defensive guard for missing httpHeaders
  const hdrs = response.httpHeaders ?? {};
  const contentType = hdrs['content-type'] ?? hdrs['Content-Type'] ?? '—';
  // BUG-GQL-R11-6 fix: mirror the status bar's isPureGqlError logic so MetadataTab
  // shows amber "GraphQL Error" instead of green "200 OK" for HTTP 2xx + errors-only.
  const hasErrors = !!(response.errors && response.errors.length > 0);
  const hasData = response.data != null;
  const isPureGqlError = hasErrors && !hasData && response.httpStatus >= 200 && response.httpStatus < 300;
  // BUG-GQL-R12-12 fix: also flag partial success (data + errors) with amber styling
  const isPartialSuccess = hasErrors && hasData && response.httpStatus >= 200 && response.httpStatus < 300;
  const cls = isPureGqlError || isPartialSuccess ? 'gql-status--gql-error' : statusColorClass(response.httpStatus);
  const label = isPureGqlError ? 'GraphQL Error' : isPartialSuccess ? 'Partial Success' : statusFullLabel(response.httpStatus);

  return (
    <div className="gql-rv-metadata-shell" data-testid="gql-rv-metadata-shell">
      <div className="gql-rv-metadata" data-testid="gql-rv-metadata">
      <div className="gql-rv-meta-grid">
        <div className="gql-rv-meta-row">
          <span className="gql-rv-meta-label">Status</span>
          <span className={`gql-rv-meta-status ${cls}`} data-testid="gql-rv-meta-status">
            {label}
          </span>
        </div>
        <div className="gql-rv-meta-row">
          <span className="gql-rv-meta-label">Latency</span>
          <span className="gql-rv-meta-value gql-rv-meta-latency" data-testid="gql-rv-meta-latency">
            {response.batchContext
              ? batchLatencyStatusLabel(response.batchContext, response.latencyMs)
              : `${response.latencyMs} ms`}
          </span>
        </div>
        <div className="gql-rv-meta-row">
          <span className="gql-rv-meta-label">Size</span>
          <span className="gql-rv-meta-value">
            {humanizeBytes(bodySize)}
            <span className="gql-rv-meta-muted"> ({bodySize.toLocaleString()} B)</span>
          </span>
        </div>
        <div className="gql-rv-meta-row">
          <span className="gql-rv-meta-label">Content-Type</span>
          <span className="gql-rv-meta-value gql-rv-meta-mono">{contentType}</span>
        </div>
        <div className="gql-rv-meta-row">
          <span className="gql-rv-meta-label">Time</span>
          <span className="gql-rv-meta-value">{formatTimestamp(response.timestamp)}</span>
        </div>
        {response.errors && response.errors.length > 0 && (
          <div className="gql-rv-meta-row">
            <span className="gql-rv-meta-label">GraphQL Errors</span>
            <span className="gql-rv-meta-value gql-rv-meta-error">
              {response.errors.length} error{response.errors.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {/* APQ metadata (3F-2) — shown when this response was sent via APQ */}
        {response.apqHash && (
          <div className="gql-rv-meta-row">
            <span className="gql-rv-meta-label">APQ Hash</span>
            <span className="gql-rv-meta-value gql-rv-meta-mono" data-testid="gql-rv-meta-apq-hash">
              {response.apqHash.slice(0, 16)}…
              {response.apqCacheHit != null && (
                <span className={`gql-rv-meta-apq-badge${response.apqCacheHit ? ' gql-rv-meta-apq-badge--hit' : ' gql-rv-meta-apq-badge--miss'}`}>
                  {response.apqCacheHit ? 'cache hit' : 'cache miss'}
                </span>
              )}
              {response.apqUnsupported && (
                <span className="gql-rv-meta-apq-badge gql-rv-meta-apq-badge--unsupported">unsupported</span>
              )}
            </span>
          </div>
        )}
        {response.authSentSource != null && (
          <div className="gql-rv-meta-row gql-rv-meta-row--stacked" data-testid="gql-rv-auth-sent">
            <span className="gql-rv-meta-label">Authentication sent</span>
            <div className="gql-rv-meta-auth-sent">
              {response.authSentLines && response.authSentLines.length > 0 ? (
                response.authSentLines.map((line, idx) => (
                  <div key={idx} className="gql-rv-meta-auth-sent-line">{line}</div>
                ))
              ) : (
                <div className="gql-rv-meta-auth-sent-line gql-rv-meta-auth-sent-line--muted">
                  No authentication headers were sent
                </div>
              )}
              <span className="gql-rv-meta-auth-sent-source">
                ({authSentSourceLabel(response.authSentSource)})
              </span>
            </div>
          </div>
        )}
        {response.requestMethod && (
          <div className="gql-rv-meta-row">
            <span className="gql-rv-meta-label">Method</span>
            <span className="gql-rv-meta-value gql-rv-meta-mono" data-testid="gql-rv-request-method">
              {response.requestMethod}
            </span>
          </div>
        )}
        {response.batchContext && (
          <div className="gql-rv-meta-batch-block" data-testid="gql-rv-meta-batch">
            <div className="gql-rv-meta-row">
              <span className="gql-rv-meta-label">Batch slot</span>
              <span className="gql-rv-meta-value" data-testid="gql-rv-meta-batch-slot">
                {batchOperationSlotLabel(response.batchContext)}
              </span>
            </div>
            <div className="gql-rv-meta-row">
              <span className="gql-rv-meta-label">Batch transport</span>
              <span className="gql-rv-meta-value" data-testid="gql-rv-meta-batch-transport">
                {batchTransportSummaryForResponse(response.batchContext, response)}
              </span>
            </div>
            <p className="gql-rv-meta-batch-explainer" data-testid="gql-rv-meta-batch-explainer">
              {batchResponseExplainer(response.batchContext)}
            </p>
          </div>
        )}
      </div>

      {response.requestHeaders && Object.keys(response.requestHeaders).length > 0 && (
        <MetadataCollapsibleSection
          title="Request headers"
          sectionTestId="gql-rv-request-headers"
          toggleTestId="gql-rv-request-headers-toggle"
          defaultExpanded={
            Object.keys(response.requestHeaders).length <= REQUEST_HEADERS_COLLAPSE_COUNT
          }
          collapsedSummary={`${Object.keys(response.requestHeaders).length} header${
            Object.keys(response.requestHeaders).length === 1 ? '' : 's'
          } — click to expand`}
        >
          <table className="gql-rv-headers-table">
            <thead>
              <tr>
                <th scope="col">Header</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.requestHeaders).map(([key, value], idx) => (
                <tr key={`${key}-${idx}`}>
                  <td className="gql-rv-header-name" data-testid={`gql-rv-request-header-key-${key}`}>{key}</td>
                  <td className="gql-rv-header-value" data-testid={`gql-rv-request-header-val-${key}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MetadataCollapsibleSection>
      )}

      {response.requestBody && Object.keys(response.requestBody).length > 0 && (
        <MetadataRequestBodySection body={response.requestBody} />
      )}

      {response.batchContext?.wireRequestBody && response.batchContext.wireRequestBody.length > 0 && (
        <MetadataCollapsibleSection
          title="Wire batch body (upstream POST)"
          sectionTestId="gql-rv-wire-batch-body"
          toggleTestId="gql-rv-wire-batch-body-toggle"
          defaultExpanded={false}
          collapsedSummary={`JSON array · ${response.batchContext.wireRequestBody.length} operation${
            response.batchContext.wireRequestBody.length === 1 ? '' : 's'
          } — click to expand`}
        >
          <pre className="gql-rv-request-body-json" data-testid="gql-rv-wire-batch-body-content">
            {JSON.stringify(response.batchContext.wireRequestBody, null, 2)}
          </pre>
        </MetadataCollapsibleSection>
      )}

      {/* GraphQL error detail cards */}
      {response.errors && response.errors.length > 0 && (
        <div className="gql-rv-error-list" data-testid="gql-rv-error-list">
          <div className="gql-rv-error-list-title">Error Details</div>
          {response.errors.map((err, idx) => (
            <div key={idx} className="gql-rv-error-item">
              <div className="gql-rv-error-message">{err.message}</div>
              {err.locations && err.locations.length > 0 && (
                <div className="gql-rv-error-location">
                  {err.locations.map((loc, li) => (
                    <span key={li} className="gql-rv-error-loc-badge">
                      Line {loc.line}, Col {loc.column}
                    </span>
                  ))}
                </div>
              )}
              {err.path && err.path.length > 0 && (
                <div className="gql-rv-error-path">
                  Path: <code>{err.path.join(' → ')}</code>
                </div>
              )}
              {err.extensions?.code != null && (
                <div className="gql-rv-error-code">
                  Code: <code>{String(err.extensions.code)}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export function HeadersTab({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return (
      <div className="gql-rv-tab-empty" data-testid="gql-rv-headers-empty">
        No response headers available.
      </div>
    );
  }
  return (
    <div className="gql-rv-headers-scroll" data-testid="gql-rv-headers">
      <table className="gql-rv-headers-table">
        <thead>
          <tr>
            <th scope="col">Header</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {/* BUG-GQL-R9-21 fix: servers may emit duplicate headers (e.g. Set-Cookie).
              Use index in key to avoid React key collision warnings. */}
          {entries.map(([key, value], idx) => (
            <tr key={`${key}-${idx}`}>
              <td className="gql-rv-header-name" data-testid={`gql-rv-header-key-${key}`}>{key}</td>
              <td className="gql-rv-header-value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResponseDataSummaryCard({
  path,
  data,
  testId,
}: {
  path: string;
  data: Record<string, unknown>;
  testId: string;
}) {
  return (
    <div className="gql-rv-data-user" data-testid={testId} aria-label={`GraphQL ${path} fields`}>
      <div className="gql-rv-data-user-head">
        <span className="gql-rv-data-user-path">{path}</span>
      </div>
      <dl className="gql-rv-data-user-fields">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="gql-rv-data-user-row">
            <dt>{key}</dt>
            <dd>{typeof value === 'string' ? `"${value}"` : String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
