import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GrpcCallResult, GrpcErrorBody, GrpcAuthConfig, GrpcMethodInfo } from '../../../shared/grpc/contracts';
import type { GrpcRequestLifecycle } from '../grpcStudioTypes';
import { isGrpcLifecycleInFlight } from '../grpcStudioTypes';
import {
  buildGrpcResponseCopyText,
  countGrpcHeaderEntries,
  formatGrpcDurationMs,
  formatGrpcErrorSummary,
  formatGrpcRpcStatusLabel,
  formatGrpcTlsFailureHint,
  formatGrpcBrowserTransportFailureHint,
  grpcStatusBadgeModifier,
  serializeGrpcResponseBody,
  sortedGrpcHeaderEntries,
} from '../utils/grpcResponseUtils';
import {
  buildGrpcTimingBreakdownRows,
  formatGrpcTimingDurationLabel,
  grpcTimingBarWidthPercent,
  resolveGrpcTimingBarDenominatorMs,
} from '../utils/grpcTimingBreakdown';
import { redactGrpcErrorBody, redactGrpcMetadataForDisplay } from '../../../shared/grpc/grpcRedaction';
import { useGrpcStudioHints } from '../hooks/useGrpcStudioHints';
import { shouldShowPermissionDeniedHint } from '../utils/grpcSpringHints';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';
import { isGrpcExpressFallbackOffered } from '../../../shared/grpc/grpcTransportFallback';
import { highlightJson } from '../../../shared/utils/jsonHighlighter';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';
import { computePercentiles, round2 } from '../../../shared/utils/percentiles';

export type GrpcResponseTab = 'body' | 'headers' | 'trailers' | 'metadata' | 'tracing' | 'timing';
type GrpcResponseTopTab = 'response' | 'proto';

type GrpcTraceEntry = { source: 'header' | 'trailer'; key: string; value: string };

export interface GrpcResponsePanelProps {
  lifecycle: GrpcRequestLifecycle;
  lastResult?: GrpcCallResult;
  lastError?: GrpcErrorBody;
  method?: GrpcMethodInfo;
  serviceFullName?: string;
  descriptorSourceLabel?: string;
  targetAddress?: string;
  latencyHistoryMs?: number[];
  auth?: GrpcAuthConfig;
  disabled?: boolean;
  onRetryWithExpress?: () => void;
}

export function GrpcResponsePanel({
  lifecycle,
  lastResult,
  lastError,
  method,
  serviceFullName,
  descriptorSourceLabel,
  targetAddress,
  latencyHistoryMs,
  auth,
  disabled = false,
  onRetryWithExpress,
}: GrpcResponsePanelProps) {
  const [topTab, setTopTab] = useState<GrpcResponseTopTab>('response');
  const [responseTab, setResponseTab] = useState<GrpcResponseTab>('body');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [rawBodyView, setRawBodyView] = useState(false);
  const [bodyDisplayOverride, setBodyDisplayOverride] = useState<string | null>(null);
  const { isDismissed, dismiss } = useGrpcStudioHints();

  const inFlight = isGrpcLifecycleInFlight(lifecycle);
  const headerCount = lastResult ? countGrpcHeaderEntries(lastResult.headers) : 0;
  const trailerCount = lastResult ? countGrpcHeaderEntries(lastResult.trailers) : 0;

  const bodyText = useMemo(
    () => serializeGrpcResponseBody(lastResult?.body),
    [lastResult?.body],
  );

  useEffect(() => {
    setBodyDisplayOverride(null);
    setRawBodyView(false);
  }, [bodyText]);

  const rawBodyText = useMemo(() => {
    const body = lastResult?.body;
    if (!body || Object.keys(body).length === 0) {
      return '{}';
    }
    return JSON.stringify(body);
  }, [lastResult?.body]);

  const displayBodyText = rawBodyView ? rawBodyText : (bodyDisplayOverride ?? bodyText);
  const responseSizeBytes = useMemo(
    () => new TextEncoder().encode(displayBodyText).length,
    [displayBodyText],
  );

  const highlightedBody = useMemo(
    () => highlightJson(displayBodyText),
    [displayBodyText],
  );

  const timingRows = useMemo(
    () => buildGrpcTimingBreakdownRows(lastResult?.timingBreakdown, lastResult?.durationMs ?? 0),
    [lastResult?.durationMs, lastResult?.timingBreakdown],
  );
  const timingBarDenominatorMs = useMemo(
    () => resolveGrpcTimingBarDenominatorMs(timingRows, lastResult?.durationMs ?? 0),
    [lastResult?.durationMs, timingRows],
  );

  const displayResult = useMemo(() => {
    if (!lastResult) return undefined;
    return {
      ...lastResult,
      headers: redactGrpcMetadataForDisplay(lastResult.headers, { maskNonSecret: false }),
      trailers: redactGrpcMetadataForDisplay(lastResult.trailers, { maskNonSecret: false }),
    };
  }, [lastResult]);

  const metadataEntries = useMemo(() => {
    if (!displayResult) return [] as Array<{ key: string; value: string }>;
    const headerRows = sortedGrpcHeaderEntries(displayResult.headers).map((entry) => ({
      key: `header:${entry.key}`,
      value: entry.value,
    }));
    const trailerRows = sortedGrpcHeaderEntries(displayResult.trailers).map((entry) => ({
      key: `trailer:${entry.key}`,
      value: entry.value,
    }));
    return [...headerRows, ...trailerRows];
  }, [displayResult]);

  const traceEntries = useMemo(() => {
    if (!displayResult) return [] as GrpcTraceEntry[];
    const isTraceKey = (key: string) => /(trace|span|request-id|correlation)/i.test(key);
    const rows: GrpcTraceEntry[] = [];
    for (const entry of sortedGrpcHeaderEntries(displayResult.headers)) {
      if (isTraceKey(entry.key)) rows.push({ source: 'header', key: entry.key, value: entry.value });
    }
    for (const entry of sortedGrpcHeaderEntries(displayResult.trailers)) {
      if (isTraceKey(entry.key)) rows.push({ source: 'trailer', key: entry.key, value: entry.value });
    }
    return rows;
  }, [displayResult]);

  const latencyStats = useMemo(() => {
    const samples = (latencyHistoryMs ?? []).filter((value) => Number.isFinite(value) && value >= 0);
    if (samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const summary = computePercentiles(sorted);
    const fastCount = sorted.filter((value) => value <= 50).length;
    const moderateCount = sorted.filter((value) => value > 50 && value <= 1000).length;
    const slowCount = sorted.filter((value) => value > 1000).length;
    return {
      total: sorted.length,
      min: Math.round(summary.min),
      avg: round2(summary.mean),
      p95: Math.round(summary.p95),
      max: Math.round(summary.max),
      histogram: { fastCount, moderateCount, slowCount },
    };
  }, [latencyHistoryMs]);

  const showResult = lifecycle === 'success' && !!lastResult;
  const showError = lifecycle === 'error' && !!lastError;
  const showCancelled = lifecycle === 'cancelled';
  const hasProtoSummary = !!method && !!serviceFullName;

  const protoSummaryText = useMemo(() => {
    if (!hasProtoSummary) return '';
    return `service ${serviceFullName} {\n  rpc ${method!.name} (${method!.requestTypeName}) returns (${method!.responseTypeName});\n}\n// callType: ${method!.callType}`;
  }, [hasProtoSummary, method, serviceFullName]);

  useEffect(() => {
    if (!hasProtoSummary && topTab === 'proto') {
      setTopTab('response');
    }
  }, [hasProtoSummary, topTab]);

  const showPermissionHint = shouldShowPermissionDeniedHint({
    unaryStatus: showResult ? lastResult?.status : undefined,
    lastError: showError ? lastError : undefined,
  }) && !isDismissed('spring_permission_denied');

  const showExpressFallback = showError && isGrpcExpressFallbackOffered(lastError) && !!onRetryWithExpress;

  const tlsHint = showError ? formatGrpcTlsFailureHint(lastError) : undefined;
  const browserTransportHint = showError ? formatGrpcBrowserTransportFailureHint(lastError) : undefined;

  const handleCopy = useCallback(async () => {
    if (!lastResult) return;
    const text = buildGrpcResponseCopyText(lastResult, auth);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setCopyStatus('failed');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [lastResult, auth]);

  const handleExportProtoSummary = useCallback(() => {
    if (!protoSummaryText || !method || !serviceFullName) return;
    const serviceName = serviceFullName.split('.').at(-1) ?? serviceFullName;
    const filename = `${serviceName}.${method.name}.proto.txt`;
    const blob = new Blob([protoSummaryText], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }, [method, protoSummaryText, serviceFullName]);

  const renderResponseHints = () => {
    if (!showPermissionHint && !tlsHint && !browserTransportHint) return null;
    return (
      <div className="grpc-response-hints" data-testid="grpc-response-hints">
        {browserTransportHint && (
          <p className="grpc-response-transport-hint" data-testid="grpc-response-browser-transport-hint">
            {browserTransportHint}
          </p>
        )}
        {tlsHint && (
          <p className="grpc-response-transport-hint" data-testid="grpc-response-tls-hint">
            {tlsHint}
          </p>
        )}
        {showPermissionHint && (
          <GrpcSpringHintCard
            hintId="spring_permission_denied"
            onDismiss={() => dismiss('spring_permission_denied')}
          />
        )}
      </div>
    );
  };

  return (
    <section className="grpc-response-panel" data-testid="grpc-response-panel">
      <div className="grpc-response-header" data-testid="grpc-response-header">
        {showResult && (
          <>
            <span
              className={`grpc-response-status grpc-response-status--${grpcStatusBadgeModifier(lastResult!.status)}`}
              data-testid="grpc-response-status"
            >
              {formatGrpcRpcStatusLabel(lastResult!.status, lastResult!.statusMessage)}
            </span>
            <span className="grpc-response-duration" data-testid="grpc-response-duration">
              {formatGrpcDurationMs(lastResult!.durationMs)}
            </span>
            <span className="grpc-response-size" data-testid="grpc-response-size">
              · {responseSizeBytes} B
            </span>
            {targetAddress && (
              <span className="grpc-response-target" data-testid="grpc-response-target">
                · {targetAddress}
              </span>
            )}
            {traceEntries.length > 0 && (
              <span className="grpc-response-tracing-chip" data-testid="grpc-response-tracing-chip">
                Tracing · {traceEntries.length}
              </span>
            )}
            <button
              type="button"
              className={`grpc-response-raw-toggle-btn${rawBodyView ? ' grpc-response-raw-toggle-btn--active' : ''}`}
              data-testid="grpc-response-raw-toggle"
              aria-pressed={rawBodyView}
              disabled={disabled}
              onClick={() => setRawBodyView((value) => !value)}
            >
              Raw
            </button>
            <button
              type="button"
              className="grpc-response-copy-btn"
              data-testid="grpc-response-copy"
              disabled={disabled}
              onClick={() => { void handleCopy(); }}
            >
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy Response'}
            </button>
          </>
        )}

        {inFlight && (
          <span className="grpc-response-in-flight" data-testid="grpc-response-in-flight">
            Calling…
          </span>
        )}

        {showCancelled && (
          <span className="grpc-response-cancelled" data-testid="grpc-response-cancelled">
            Call cancelled
          </span>
        )}

        {showError && (
          <span className="grpc-response-error-summary" data-testid="grpc-response-error-summary">
            {formatGrpcErrorSummary(redactGrpcErrorBody(lastError!))}
          </span>
        )}

        {!showResult && !inFlight && !showCancelled && !showError && (
          <span className="grpc-response-idle" data-testid="grpc-response-idle">
            Send a unary call to see the response.
          </span>
        )}
      </div>

      {(showResult || hasProtoSummary) && (
        <div className="grpc-response-top-tabs" role="tablist" aria-label="Response panel view">
          <button
            type="button"
            role="tab"
            aria-selected={topTab === 'response'}
            className={`grpc-response-top-tab${topTab === 'response' ? ' grpc-response-top-tab--active' : ''}`}
            data-testid="grpc-response-top-tab-response"
            onClick={() => setTopTab('response')}
          >
            Response
            {showResult && <span className="grpc-response-top-tab-dot" aria-hidden="true">●</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={topTab === 'proto'}
            className={`grpc-response-top-tab${topTab === 'proto' ? ' grpc-response-top-tab--active' : ''}`}
            data-testid="grpc-response-top-tab-proto"
            onClick={() => setTopTab('proto')}
            disabled={!hasProtoSummary}
          >
            Proto
            {hasProtoSummary && <span className="grpc-response-top-tab-dot" aria-hidden="true">●</span>}
          </button>
        </div>
      )}

      {topTab === 'response' && showResult && (
        <>
          <div className="grpc-response-tabs" role="group" aria-label="Response details">
            <button
              type="button"
              aria-pressed={responseTab === 'body'}
              className={`grpc-response-tab${responseTab === 'body' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-body"
              onClick={() => setResponseTab('body')}
            >
              Body
            </button>
            <button
              type="button"
              aria-pressed={responseTab === 'headers'}
              className={`grpc-response-tab${responseTab === 'headers' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-headers"
              onClick={() => setResponseTab('headers')}
            >
              Headers
              {headerCount > 0 && (
                <span className="grpc-response-tab-badge" data-testid="grpc-response-headers-count">
                  {headerCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={responseTab === 'trailers'}
              className={`grpc-response-tab${responseTab === 'trailers' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-trailers"
              onClick={() => setResponseTab('trailers')}
            >
              Trailers
              {trailerCount > 0 && (
                <span className="grpc-response-tab-badge" data-testid="grpc-response-trailers-count">
                  {trailerCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={responseTab === 'metadata'}
              className={`grpc-response-tab${responseTab === 'metadata' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-metadata"
              onClick={() => setResponseTab('metadata')}
            >
              Metadata
              {metadataEntries.length > 0 && (
                <span className="grpc-response-tab-badge" data-testid="grpc-response-metadata-count">
                  {metadataEntries.length}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={responseTab === 'tracing'}
              className={`grpc-response-tab${responseTab === 'tracing' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-tracing"
              onClick={() => setResponseTab('tracing')}
            >
              Tracing
              {traceEntries.length > 0 && (
                <span className="grpc-response-tab-badge" data-testid="grpc-response-tracing-count">
                  {traceEntries.length}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-pressed={responseTab === 'timing'}
              className={`grpc-response-tab${responseTab === 'timing' ? ' grpc-response-tab--active' : ''}`}
              data-testid="grpc-response-tab-timing"
              onClick={() => setResponseTab('timing')}
            >
              Timing
            </button>
          </div>

          <div className="grpc-response-body">
            {responseTab === 'body' && (
              <div className="grpc-response-json-wrap" data-testid="grpc-response-body-wrap">
                <GrpcJsonCodeToolbar
                  copyText={displayBodyText}
                  prettyDisabled={rawBodyView}
                  onPrettyFormat={() => {
                    if (rawBodyView) return;
                    try {
                      setBodyDisplayOverride(JSON.stringify(JSON.parse(bodyText), null, 2));
                    } catch {
                      // Keep current display when JSON is invalid.
                    }
                  }}
                  testIdPrefix="grpc-response-json"
                />
                <pre className="grpc-response-json grpc-response-json--highlighted" data-testid="grpc-response-body">
                  {highlightedBody}
                </pre>
              </div>
            )}

            {responseTab === 'headers' && (
              <GrpcKvTable
                testId="grpc-response-headers"
                entries={sortedGrpcHeaderEntries(displayResult!.headers)}
                emptyLabel="No response headers."
              />
            )}

            {responseTab === 'trailers' && (
              <GrpcKvTable
                testId="grpc-response-trailers"
                entries={sortedGrpcHeaderEntries(displayResult!.trailers)}
                emptyLabel="No trailers."
              />
            )}

            {responseTab === 'metadata' && (
              <GrpcKvTable
                testId="grpc-response-metadata"
                entries={metadataEntries}
                emptyLabel="No response metadata."
              />
            )}

            {responseTab === 'tracing' && (
              <GrpcTraceTable
                testId="grpc-response-tracing"
                entries={traceEntries}
              />
            )}

            {responseTab === 'timing' && (
              <div className="grpc-response-timing" data-testid="grpc-response-timing">
                <p className="grpc-response-timing-title">RPC call timing breakdown</p>
                <div className="grpc-response-timing-total" data-testid="grpc-response-timing-duration">
                  Total: {formatGrpcDurationMs(lastResult!.durationMs)}
                </div>
                <div className="grpc-response-timing-bars">
                  {timingRows.map((row) => (
                    <div className="grpc-response-timing-bar-row" key={row.key} data-testid={`grpc-response-timing-row-${row.key}`}>
                      <span className="grpc-response-timing-label">{row.label}</span>
                      <div className="grpc-response-timing-bar-track">
                        <div
                          className={`grpc-response-timing-bar-fill ${row.barClass}`}
                          style={{ width: `${grpcTimingBarWidthPercent(row.durationMs, timingBarDenominatorMs)}%` }}
                        />
                      </div>
                      <span className="grpc-response-timing-value">
                        {formatGrpcTimingDurationLabel(row.durationMs)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {renderResponseHints()}
        </>
      )}

      {topTab === 'proto' && hasProtoSummary && (
        <div className="grpc-response-proto-panel" data-testid="grpc-response-proto-panel">
          <div className="grpc-response-proto-header">
            <p className="grpc-response-proto-meta">
              {descriptorSourceLabel ? `Source: ${descriptorSourceLabel}` : 'Method schema summary'}
            </p>
            <button
              type="button"
              className="grpc-response-proto-export-btn"
              data-testid="grpc-response-proto-export"
              onClick={handleExportProtoSummary}
            >
              Export Proto
            </button>
          </div>
          <pre className="grpc-response-proto-code" data-testid="grpc-response-proto-code">
{protoSummaryText}
          </pre>
        </div>
      )}

      {showError && (
        <div className="grpc-response-error-panel" data-testid="grpc-response-error-panel">
          <p className="grpc-response-error-message" data-testid="grpc-response-error-message">
            {redactGrpcErrorBody(lastError!).message}
          </p>
          {showExpressFallback && (
            <button
              type="button"
              className="grpc-retry-express-btn"
              data-testid="grpc-retry-express-btn"
              disabled={disabled}
              onClick={onRetryWithExpress}
            >
              Retry with Express Proxy
            </button>
          )}
          {lastError!.retryable && !showExpressFallback && (
            <p className="grpc-response-error-hint">This error may be retryable.</p>
          )}
          {renderResponseHints()}
        </div>
      )}

      {latencyStats && (
        <footer className="grpc-response-latency-footer" data-testid="grpc-response-latency-footer">
          <div className="grpc-response-latency-stats">
            <span className="grpc-response-latency-chip" data-testid="grpc-response-latency-min">Min {latencyStats.min}ms</span>
            <span className="grpc-response-latency-chip" data-testid="grpc-response-latency-avg">Avg {latencyStats.avg}ms</span>
            <span className="grpc-response-latency-chip" data-testid="grpc-response-latency-p95">p95 {latencyStats.p95}ms</span>
            <span className="grpc-response-latency-chip" data-testid="grpc-response-latency-max">Max {latencyStats.max}ms</span>
            <span className="grpc-response-latency-meta" data-testid="grpc-response-latency-history">
              Session history · {latencyStats.total} request{latencyStats.total === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grpc-response-latency-bars" aria-hidden="true">
            <span
              className="grpc-response-latency-bar grpc-response-latency-bar--fast"
              style={{ width: `${(latencyStats.histogram.fastCount / latencyStats.total) * 100}%` }}
              title={`Fast (<=50ms): ${latencyStats.histogram.fastCount}`}
            />
            <span
              className="grpc-response-latency-bar grpc-response-latency-bar--moderate"
              style={{ width: `${(latencyStats.histogram.moderateCount / latencyStats.total) * 100}%` }}
              title={`Moderate (50ms-1s): ${latencyStats.histogram.moderateCount}`}
            />
            <span
              className="grpc-response-latency-bar grpc-response-latency-bar--slow"
              style={{ width: `${(latencyStats.histogram.slowCount / latencyStats.total) * 100}%` }}
              title={`Slow (>1s): ${latencyStats.histogram.slowCount}`}
            />
          </div>
        </footer>
      )}
    </section>
  );
}

function GrpcKvTable({
  testId,
  entries,
  emptyLabel,
}: {
  testId: string;
  entries: Array<{ key: string; value: string }>;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="grpc-response-kv-empty" data-testid={`${testId}-empty`}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <table className="grpc-response-kv-table" data-testid={testId}>
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={`${entry.key}-${index}`}>
            <td>{entry.key}</td>
            <td>{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GrpcTraceTable({
  testId,
  entries,
}: {
  testId: string;
  entries: GrpcTraceEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="grpc-response-kv-empty" data-testid={`${testId}-empty`}>
        No trace metadata detected.
      </p>
    );
  }

  return (
    <table className="grpc-response-kv-table" data-testid={testId}>
      <thead>
        <tr>
          <th>Source</th>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={`${entry.source}-${entry.key}-${index}`}>
            <td>{entry.source}</td>
            <td>{entry.key}</td>
            <td>{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
