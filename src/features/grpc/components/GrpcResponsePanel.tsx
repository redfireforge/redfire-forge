import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GrpcCallResult, GrpcErrorBody, GrpcAuthConfig } from '../../../shared/grpc/contracts';
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
import { redactGrpcCallResultForDisplay, redactGrpcErrorBody } from '../../../shared/grpc/grpcRedaction';
import { useGrpcStudioHints } from '../hooks/useGrpcStudioHints';
import { shouldShowPermissionDeniedHint } from '../utils/grpcSpringHints';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';
import { isGrpcExpressFallbackOffered } from '../../../shared/grpc/grpcTransportFallback';
import { highlightJson } from '../../../shared/utils/jsonHighlighter';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';

export type GrpcResponseTab = 'body' | 'headers' | 'trailers' | 'timing';

export interface GrpcResponsePanelProps {
  lifecycle: GrpcRequestLifecycle;
  lastResult?: GrpcCallResult;
  lastError?: GrpcErrorBody;
  targetAddress?: string;
  auth?: GrpcAuthConfig;
  disabled?: boolean;
  onRetryWithExpress?: () => void;
}

export function GrpcResponsePanel({
  lifecycle,
  lastResult,
  lastError,
  targetAddress,
  auth,
  disabled = false,
  onRetryWithExpress,
}: GrpcResponsePanelProps) {
  const [responseTab, setResponseTab] = useState<GrpcResponseTab>('body');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
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
  }, [bodyText]);

  const displayBodyText = bodyDisplayOverride ?? bodyText;

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

  const displayResult = useMemo(
    () => (lastResult ? redactGrpcCallResultForDisplay(lastResult) : undefined),
    [lastResult],
  );

  const showResult = lifecycle === 'success' && !!lastResult;
  const showError = lifecycle === 'error' && !!lastError;
  const showCancelled = lifecycle === 'cancelled';

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
            {targetAddress && (
              <span className="grpc-response-target" data-testid="grpc-response-target">
                · {targetAddress}
              </span>
            )}
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

      {showResult && (
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
                  onPrettyFormat={() => {
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
