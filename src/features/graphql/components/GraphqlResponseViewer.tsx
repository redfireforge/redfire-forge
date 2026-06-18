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
import type { GraphqlResponse } from '../../../shared/types/graphql';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphqlResponseViewerProps {
  response: GraphqlResponse | null;
  loading?: boolean;
}

type ResponseTab = 'body' | 'headers' | 'metadata';

// ─── JSON Syntax Highlighter ─────────────────────────────────────────────────

interface JsonToken {
  cls?: string;
  text: string;
}

/**
 * Tokenizes a pre-formatted JSON string into typed tokens for CSS syntax
 * highlighting. Handles strings (keys vs values), numbers, booleans, nulls,
 * and punctuation.
 */
function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const n = json.length;
  let i = 0;

  while (i < n) {
    const ch = json[i];

    // Whitespace / newlines — preserve as plain (pre tag renders them)
    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      let j = i;
      while (j < n && (json[j] === '\n' || json[j] === '\r' || json[j] === ' ' || json[j] === '\t')) {
        j++;
      }
      tokens.push({ text: json.slice(i, j) });
      i = j;
      continue;
    }

    // String — classify as key or value based on whether followed by ':'
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (json[j] === '\\') { j += 2; continue; }
        if (json[j] === '"') { j++; break; }
        j++;
      }
      const text = json.slice(i, j);
      let k = j;
      while (k < n && (json[k] === ' ' || json[k] === '\t')) k++;
      tokens.push({ cls: json[k] === ':' ? 'gql-json-key' : 'gql-json-str', text });
      i = j;
      continue;
    }

    // Number
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i;
      while (j < n && /[-\d.eE+]/.test(json[j])) j++;
      tokens.push({ cls: 'gql-json-num', text: json.slice(i, j) });
      i = j;
      continue;
    }

    // Literals
    if (json.startsWith('true', i))  { tokens.push({ cls: 'gql-json-bool', text: 'true'  }); i += 4; continue; }
    if (json.startsWith('false', i)) { tokens.push({ cls: 'gql-json-bool', text: 'false' }); i += 5; continue; }
    if (json.startsWith('null', i))  { tokens.push({ cls: 'gql-json-null', text: 'null'  }); i += 4; continue; }

    // Punctuation
    tokens.push({ cls: 'gql-json-punc', text: ch });
    i++;
  }

  return tokens;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function humanizeBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Returns the Catppuccin color class for an HTTP status code */
function statusColorClass(httpStatus: number): string {
  if (httpStatus === 0)       return 'gql-status--network-error';
  if (httpStatus < 300)       return 'gql-status--ok';
  if (httpStatus < 400)       return 'gql-status--redirect';
  if (httpStatus < 500)       return 'gql-status--client-error';
  return 'gql-status--server-error';
}

/**
 * Compact human-readable status for the status bar badge.
 * Short enough to always fit in the badge without overflow.
 */
function statusBadgeLabel(httpStatus: number): string {
  if (httpStatus === 0) return 'Error';
  const map: Record<number, string> = {
    200: '200 OK',        201: '201 Created',   204: '204 No Content',
    301: '301 Moved',     302: '302 Found',      304: '304 Not Modified',
    400: '400 Bad Request', 401: '401 Unauthorized', 403: '403 Forbidden',
    404: '404 Not Found', 408: '408 Timeout',   422: '422 Unprocessable',
    429: '429 Too Many',
    500: '500 Server Error', 502: '502 Bad Gateway',
    503: '503 Unavailable', 504: '504 Timeout',
  };
  return map[httpStatus] ?? String(httpStatus);
}

/** Full verbose status label for the Metadata tab */
function statusFullLabel(httpStatus: number): string {
  if (httpStatus === 0) return 'Network Error';
  const map: Record<number, string> = {
    200: '200 OK',          201: '201 Created',         204: '204 No Content',
    301: '301 Moved Permanently', 302: '302 Found',     304: '304 Not Modified',
    400: '400 Bad Request', 401: '401 Unauthorized',    403: '403 Forbidden',
    404: '404 Not Found',   408: '408 Request Timeout', 422: '422 Unprocessable Entity',
    429: '429 Too Many Requests',
    500: '500 Internal Server Error', 502: '502 Bad Gateway',
    503: '503 Service Unavailable',   504: '504 Gateway Timeout',
  };
  return map[httpStatus] ?? String(httpStatus);
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Skip syntax highlighting for responses above this size to prevent main-thread freezing */
const LARGE_RESPONSE_THRESHOLD = 512 * 1024;

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeadersTab({ headers }: { headers: Record<string, string> }) {
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

interface MetadataTabProps {
  response: GraphqlResponse;
  bodySize: number;
}

function MetadataTab({ response, bodySize }: MetadataTabProps) {
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
            {response.latencyMs} ms
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
      </div>

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
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GraphqlResponseViewer({ response, loading = false }: GraphqlResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [copied, setCopied] = useState(false);
  // BUG-GQL-R9-9 fix: track copy feedback timer for cleanup on unmount
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  // BUG-GQL-R10-18 fix: defensive guard — httpHeaders could be undefined/null from
  // a malformed proxy response or TLS-skip path; fall back to empty object.
  const safeHeaders = response?.httpHeaders ?? {};
  const headerCount = response ? Object.keys(safeHeaders).length : 0;

  // Reset to Body tab when a new response arrives
  const prevTimestampRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (response && response.timestamp !== prevTimestampRef.current) {
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
    const payload: Record<string, unknown> = {};
    if (response.data !== undefined) payload.data = response.data;
    if (response.errors && response.errors.length > 0) payload.errors = response.errors;
    if (response.extensions) payload.extensions = response.extensions;
    let pj: string;
    try {
      pj = JSON.stringify(payload, null, 2);
    } catch {
      pj = '// Could not serialize response body — it may contain non-JSON values';
    }
    const size = new TextEncoder().encode(pj).length;
    return {
      prettyJson: pj,
      tokens: size <= LARGE_RESPONSE_THRESHOLD ? tokenizeJson(pj) : [],
      bodySize: size,
      isLargeResponse: size > LARGE_RESPONSE_THRESHOLD,
    };
  }, [response]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(prettyJson).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard API unavailable (insecure context, permission denied) — silent no-op
    });
  }, [prettyJson]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="gql-rv gql-rv--loading" data-testid="gql-response-loading">
        <div className="gql-rv-spinner-wrap">
          <div className="gql-response-spinner" aria-label="Executing…" />
          <span className="gql-rv-loading-text">Executing…</span>
          <span className="gql-rv-loading-hint">
            Press <kbd>Esc</kbd> to cancel
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
  const statusCls = isPureGqlError ? 'gql-status--gql-error' : statusColorClass(response.httpStatus);

  return (
    <div
      className={`gql-rv${hasErrors ? ' gql-rv--has-errors' : ''}`}
      data-testid="gql-response-viewer"
    >
      {/* Status bar — always visible; Copy button lives here */}
      <div className="gql-rv-statusbar" data-testid="gql-rv-statusbar">
        {/* Left: status info */}
        <div className="gql-rv-statusbar-left">
          {/* BUG-GQL-R9-16 fix: when a 2xx response has ONLY GraphQL errors (no data),
              label the badge "GraphQL Error" instead of "200 OK" to avoid contradictory UI */}
          <span
            className={`gql-rv-status-badge ${statusCls}`}
            data-testid="gql-response-status"
          >
            {isPureGqlError ? 'GraphQL Error' : statusBadgeLabel(response.httpStatus)}
          </span>
          <span className="gql-rv-latency" data-testid="gql-response-latency">
            {response.latencyMs} ms
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
        </div>
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
      </div>
    </div>
  );
}
