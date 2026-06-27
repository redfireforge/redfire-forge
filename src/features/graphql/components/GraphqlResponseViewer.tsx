/**
 * GraphqlResponseViewer — Phase 1C (Re-evaluated)
 *
 * Three-tab response viewer: Body · Headers · Metadata
 *
 * Status bar structure (top row, always visible once response arrives):
 *   [200 OK]  [142ms]  [2.4 KB]  [1 error]         [Copy ▸]
 *
 * The Copy button lives in the status bar and copies the formatted JSON body.
 * There is no separate "toolbar" row between the tab bar and the content.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApolloTracingData, GraphqlResponse } from '../../../shared/types/graphql';
import { GraphqlTracingView } from './GraphqlTracingView';
import { GqlLatencyHistogram } from './GqlLatencyHistogram';
import { useGraphqlResponseDataOnly } from '../hooks/useGraphqlResponseDataOnly';
import {
  getResponseDataCreateOrder,
  getResponseDataCreateUser,
  getResponseDataDeleteUser,
  getResponseDataUser,
} from '../utils/graphqlResponseDataExtractors';
import { serializeGraphqlResponseBody } from '../utils/graphqlResponseBodyPayload';
import {
  batchLatencyStatusLabel,
  batchOperationSlotLabel,
  batchStatusPillLabel,
  batchTransportSummaryForResponse,
} from '../utils/batchResponseContextUtils';
import {
  humanizeBytes,
  LARGE_RESPONSE_THRESHOLD,
  statusBadgeLabel,
  statusColorClass,
  tokenizeJson,
} from '../utils/graphqlResponseViewerUtils';
import {
  HeadersTab,
  MetadataTab,
  ResponseDataSummaryCard,
} from './GraphqlResponseViewerTabs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphqlResponseViewerProps {
  response: GraphqlResponse | null;
  loading?: boolean;
  /** True while Send Batch is in flight — shows batch-specific loading copy */
  batchExecuting?: boolean;
  /** Re-open the floating batch results panel (when viewing a batch slice) */
  onOpenBatchResults?: () => void;
  /** Ring buffer of recent latency values (ms). Histogram shown when length ≥ 2. */
  latencyHistory?: number[];
}

type ResponseTab = 'body' | 'headers' | 'metadata' | 'tracing';

// ─── Main Component ───────────────────────────────────────────────────────────

export function GraphqlResponseViewer({
  response,
  loading = false,
  batchExecuting = false,
  onOpenBatchResults,
  latencyHistory = [],
}: GraphqlResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [copied, setCopied] = useState(false);
  const { dataOnly, setDataOnly } = useGraphqlResponseDataOnly();
  // BUG-GQL-R9-9 fix: track copy feedback timer for cleanup on unmount
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  // BUG-GQL-R10-18 fix: defensive guard — httpHeaders could be undefined/null from
  // a malformed proxy response or TLS-skip path; fall back to empty object.
  const safeHeaders = response?.httpHeaders ?? {};
  const headerCount = response ? Object.keys(safeHeaders).length : 0;

  // Reset to Body tab only at the START of a new execution.
  // Bug fix: during streaming, `response.timestamp` changes with every chunk because
  // each chunk calls `Date.now()`. Without this guard, the tab resets to 'body' on
  // every streaming chunk, even if the user has navigated to Headers/Metadata.
  // Fix: only reset when `chunkCount` is absent (non-streaming) or equals 1 (first chunk).
  const prevTimestampRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!response) return;
    const isFirstOrNonStreaming = !response.chunkCount || response.chunkCount === 1;
    if (isFirstOrNonStreaming && response.timestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = response.timestamp;
      setActiveTab('body');
    }
  }, [response]);

  // Build pretty JSON and tokens (memoized)
  // BUG-GQL-R10-6 fix: wrap stringify in try/catch — BigInt, circular structures,
  // or other exotic values could throw during render and white-screen the viewer.
  // BUG-GQL-R16-2 fix: skip syntax highlighting for responses above 512 KB to
  // prevent main-thread freezing from tokenization + mounting thousands of spans.

  const { prettyJson, tokens, bodySize, isLargeResponse } = useMemo(() => {
    if (!response) return { prettyJson: '', tokens: [], bodySize: 0, isLargeResponse: false };
    const pj = serializeGraphqlResponseBody(response, { dataOnly });
    const size = new TextEncoder().encode(pj).length;
    return {
      prettyJson: pj,
      tokens: size <= LARGE_RESPONSE_THRESHOLD ? tokenizeJson(pj) : [],
      bodySize: size,
      isLargeResponse: size > LARGE_RESPONSE_THRESHOLD,
    };
  }, [response, dataOnly]);

  const dataUser = useMemo(() => getResponseDataUser(response), [response]);
  const dataCreateUser = useMemo(() => getResponseDataCreateUser(response), [response]);
  const dataCreateOrder = useMemo(() => getResponseDataCreateOrder(response), [response]);
  const dataDeleteUser = useMemo(() => getResponseDataDeleteUser(response), [response]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(prettyJson).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard API unavailable (insecure context, permission denied) — silent no-op
    });
  }, [prettyJson]);

  // Sprint 7 (2G-1): detect Apollo Tracing data in extensions
  // MUST be before early returns to obey Rules of Hooks
  const tracingData: ApolloTracingData | null = useMemo(() => {
    if (!response?.extensions?.tracing) return null;
    const t = response.extensions.tracing as Record<string, unknown>;
    if (typeof t.version !== 'number' || typeof t.duration !== 'number') return null;
    return t as unknown as ApolloTracingData;
  }, [response]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading && !response?.isStreaming) {
    return (
      <div className="gql-rv gql-rv--loading" data-testid="gql-response-loading">
        <div className="gql-rv-spinner-wrap">
          <div className="gql-response-spinner" aria-label={batchExecuting ? 'Batching…' : 'Executing…'} />
          <span className="gql-rv-loading-text">{batchExecuting ? 'Batching…' : 'Executing…'}</span>
          <span className="gql-rv-loading-hint">
            {batchExecuting
              ? 'Sending batched operations to the server'
              : <>Press <kbd>Esc</kbd> to cancel</>}
          </span>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!response) {
    return (
      <div className="gql-rv gql-rv--empty" data-testid="gql-response-empty">
        <div className="gql-rv-empty-icon" aria-hidden="true">
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <p className="gql-rv-empty-title">No response yet</p>
        {/* BUG-GQL-R8-11 fix: use platform-aware shortcut text */}
        <p className="gql-rv-empty-body">
          Press <kbd>{typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'}+Enter</kbd> to execute the query
        </p>
      </div>
    );
  }

  // ── Response state ───────────────────────────────────────────────────────
  const hasErrors = response.errors && response.errors.length > 0;
  const hasData = response.data !== undefined && response.data !== null;
  const isPartial = hasData && hasErrors;
  // BUG-GQL-R8-18 fix: HTTP 200 + GraphQL errors should NOT show a green "200 OK" badge —
  // it misleads users into thinking everything succeeded. When a 200 response has ONLY
  // errors (no data), downgrade the badge color to the warning/error style.
  const isPureGqlError = hasErrors && !hasData && response.httpStatus >= 200 && response.httpStatus < 300;
  // Re-eval round 3: partial success (data + errors) should also not show plain green —
  // use warning color to signal the mixed result in the status bar badge.
  const statusCls =
    isPureGqlError ? 'gql-status--gql-error' :
    isPartial      ? 'gql-status--partial' :
    statusColorClass(response.httpStatus);

  // Sprint 7 (2D): incremental delivery state
  const isStreaming  = response.isStreaming ?? false;
  const chunkCount   = response.chunkCount  ?? null;

  return (
    <div
      className={`gql-rv${hasErrors ? ' gql-rv--has-errors' : ''}${isStreaming ? ' gql-rv--streaming' : ''}`}
      data-testid="gql-response-viewer"
    >
      {/* Sprint 7 (2D): streaming indicator banner */}
      {isStreaming && (
        <div className="gql-rv-streaming-banner" role="status" aria-live="polite" data-testid="gql-rv-streaming-banner">
          <span className="gql-rv-streaming-dot" aria-hidden="true" />
          <span>Streaming…</span>
          {chunkCount !== null && (
            <span className="gql-rv-chunk-count">
              {chunkCount} chunk{chunkCount !== 1 ? 's' : ''} received
            </span>
          )}
          <span className="gql-rv-streaming-hint">Press <kbd>Esc</kbd> to cancel</span>
        </div>
      )}

      {response.batchContext && (
        <div className="gql-rv-batch-banner" role="status" data-testid="gql-rv-batch-banner">
          <span className="gql-rv-batch-banner-pill" data-testid="gql-rv-batch-pill">
            {batchStatusPillLabel(response.batchContext)}
          </span>
          <span className="gql-rv-batch-banner-text">
            {batchOperationSlotLabel(response.batchContext)}
            {' · '}
            {batchTransportSummaryForResponse(response.batchContext, response)}
          </span>
          {onOpenBatchResults && (
            <button
              type="button"
              className="gql-rv-batch-banner-link"
              onClick={onOpenBatchResults}
              data-testid="gql-rv-open-batch-results"
            >
              View full batch
            </button>
          )}
        </div>
      )}

      {/* Status bar — always visible; Copy button lives here */}
      <div className="gql-rv-statusbar" data-testid="gql-rv-statusbar">
        {/* Left: status info */}
        <div className="gql-rv-statusbar-left">
          {/* BUG-GQL-R9-16 fix: when a 2xx response has ONLY GraphQL errors (no data),
              label the badge "GraphQL Error" instead of "200 OK" to avoid contradictory UI.
              Re-eval round 3: partial success uses "Partial" label. */}
          <span
            className={`gql-rv-status-badge ${statusCls}`}
            data-testid="gql-response-status"
          >
            {isPureGqlError ? 'GraphQL Error' : isPartial ? 'Partial' : statusBadgeLabel(response.httpStatus)}
          </span>
          <span className="gql-rv-latency" data-testid="gql-response-latency">
            {response.batchContext
              ? batchLatencyStatusLabel(response.batchContext, response.latencyMs)
              : `${response.latencyMs} ms`}
          </span>
          <span className="gql-rv-size">{humanizeBytes(bodySize)}</span>
          {isPartial && (
            <span className="gql-rv-partial-badge" title="Server returned both data and errors">
              Partial
            </span>
          )}
          {/* Clickable error count — switches to Metadata tab to see error details */}
          {hasErrors && (
            <button
              type="button"
              className="gql-rv-error-count"
              onClick={() => setActiveTab('metadata')}
              aria-label={`${response.errors!.length} GraphQL ${response.errors!.length > 1 ? 'errors' : 'error'} — click to view details`}
              title="Click to view error details in Metadata tab"
              data-testid="gql-response-error-count"
            >
              {response.errors!.length} error{response.errors!.length > 1 ? 's' : ''}
            </button>
          )}
          {/* Sprint 7 (2D): non-streaming chunk count badge */}
          {!isStreaming && chunkCount !== null && (
            <span className="gql-rv-chunk-badge" title={`Response received in ${chunkCount} chunk${chunkCount !== 1 ? 's' : ''}`} data-testid="gql-rv-chunk-badge">
              {chunkCount} chunk{chunkCount !== 1 ? 's' : ''}
            </span>
          )}
          {/* Sprint 7 (2G-1): tracing indicator — click to switch to Tracing tab (hidden when already there) */}
          {tracingData && activeTab !== 'tracing' && (
            <button
              type="button"
              className="gql-rv-tracing-badge"
              onClick={() => setActiveTab('tracing')}
              title="Apollo Tracing data available — click to view waterfall"
              aria-label="Apollo Tracing data available — click to view waterfall"
              data-testid="gql-rv-tracing-badge"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Tracing
            </button>
          )}
        </div>
        <label
          className="gql-rv-data-only-toggle"
          title="Hide extensions in Body tab and Copy output — tracing remains on the Tracing tab"
        >
          <input
            type="checkbox"
            checked={dataOnly}
            onChange={(e) => setDataOnly(e.target.checked)}
            data-testid="gql-rv-data-only-toggle"
            aria-label="Data only — hide extensions in response body and copy output"
          />
          <span className="gql-rv-data-only-label">Data only</span>
        </label>
        {/* Right: Copy button — copies the JSON body */}
        <button
          type="button"
          className={`gql-rv-copy-btn${copied ? ' gql-rv-copy-btn--copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy response JSON to clipboard'}
          data-testid="gql-rv-copy-btn"
          title="Copy JSON response"
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Compact data.* summaries — pinned above sub-tabs so demo spotlight stays narrow */}
      {dataUser && (
        <ResponseDataSummaryCard
          path="data.user"
          data={dataUser}
          testId="gql-response-data-user"
        />
      )}
      {dataCreateUser && (
        <ResponseDataSummaryCard
          path="data.createUser"
          data={dataCreateUser}
          testId="gql-response-data-create-user"
        />
      )}
      {dataCreateOrder && (
        <ResponseDataSummaryCard
          path="data.createOrder"
          data={dataCreateOrder}
          testId="gql-response-data-create-order"
        />
      )}
      {dataDeleteUser && (
        <ResponseDataSummaryCard
          path="data.deleteUser"
          data={dataDeleteUser}
          testId="gql-response-data-delete-user"
        />
      )}

      {/* Tab bar */}
      <div className="gql-rv-tab-bar" role="tablist" aria-label="Response view">
        <button
          id="gql-rv-tab-body-btn"
          type="button"
          className={`gql-rv-tab${activeTab === 'body' ? ' gql-rv-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'body'}
          aria-controls="gql-rv-tabpanel"
          onClick={() => setActiveTab('body')}
          data-testid="gql-rv-tab-body"
        >
          Body
        </button>
        <button
          id="gql-rv-tab-headers-btn"
          type="button"
          className={`gql-rv-tab${activeTab === 'headers' ? ' gql-rv-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'headers'}
          aria-controls="gql-rv-tabpanel"
          onClick={() => setActiveTab('headers')}
          data-testid="gql-rv-tab-headers"
        >
          Headers
          {headerCount > 0 && (
            <span className="gql-rv-tab-badge">{headerCount}</span>
          )}
        </button>
        <button
          id="gql-rv-tab-metadata-btn"
          type="button"
          className={`gql-rv-tab${activeTab === 'metadata' ? ' gql-rv-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'metadata'}
          aria-controls="gql-rv-tabpanel"
          onClick={() => setActiveTab('metadata')}
          data-testid="gql-rv-tab-metadata"
        >
          Metadata
        </button>
        {/* Sprint 7 (2G-1): Tracing tab — only shown when tracing data is present */}
        {tracingData && (
          <button
            id="gql-rv-tab-tracing-btn"
            type="button"
            className={`gql-rv-tab${activeTab === 'tracing' ? ' gql-rv-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'tracing'}
            aria-controls="gql-rv-tabpanel"
            onClick={() => setActiveTab('tracing')}
            data-testid="gql-rv-tab-tracing"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Tracing
          </button>
        )}
      </div>

      {/* Tab content — aria-labelledby points to the currently active tab button */}
      <div
        id="gql-rv-tabpanel"
        className="gql-rv-content"
        role="tabpanel"
        aria-labelledby={`gql-rv-tab-${activeTab}-btn`}
      >
        {activeTab === 'body' && (
          // BUG-GQL-R6-5 fix: tabIndex={0} makes the scrollable area keyboard-focusable so
          // keyboard-only users can Tab to it and use arrow keys / Page Down to scroll through
          // large responses. Without this, the content is only reachable via a pointing device.
          <div className="gql-rv-json-scroll" data-testid="gql-rv-json-scroll" tabIndex={0}>
            {isLargeResponse && (
              <div className="gql-rv-large-response-hint" role="status" aria-live="polite">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Response too large for syntax highlighting ({humanizeBytes(bodySize)}) — displaying plain text.
              </div>
            )}
            <pre
              className="gql-rv-json-pre"
              data-testid="gql-response-body"
              aria-label="Response body"
            >
              {isLargeResponse
                ? prettyJson
                : tokens.map((tok, idx) =>
                    tok.cls
                      ? <span key={idx} className={tok.cls}>{tok.text}</span>
                      : <span key={idx}>{tok.text}</span>
                  )
              }
            </pre>
          </div>
        )}
        {activeTab === 'headers' && (
          <HeadersTab headers={safeHeaders} />
        )}
        {activeTab === 'metadata' && (
          <MetadataTab response={response} bodySize={bodySize} />
        )}
        {activeTab === 'tracing' && tracingData && (
          <div className="gql-rv-tracing-scroll" data-testid="gql-rv-tracing-scroll">
            <GraphqlTracingView tracing={tracingData} />
          </div>
        )}
        {/* Pinned below scrollable tab body — reserves space on Tauri/WKWebView flex layouts */}
        {latencyHistory.length >= 1 && (
          <GqlLatencyHistogram latencyHistory={latencyHistory} />
        )}
      </div>
    </div>
  );
}
