import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import type { ReactNode } from 'react';
import type { WsLoadTestResult, WsLoadProfile } from '@shared/websocket/types';
import type { UseWebSocketLoadTestReturn } from './useWebSocketLoadTest';
import { computeExpectedTotal, createDefaultLoadTestConfig } from './wsLoadTestMetrics';
import { round2 } from '@shared/utils/percentiles';
import { saveJsonFile } from '@shared/utils/fileSaver';

interface WebSocketLoadTestProps {
  loadTest: UseWebSocketLoadTestReturn;
  isConnected: boolean;
  /**
   * Optional live connection-stats panel. When provided it is shown inline
   * beneath the progress metrics while a test is running, so the user can watch
   * throughput/bytes/frame-types without switching to the separate Stats tab.
   */
  statsPanel?: ReactNode;
}

const PROFILES: { value: WsLoadProfile; label: string; icon: string; description: string }[] = [
  { value: 'constant', label: 'Constant', icon: '—', description: 'Fixed rate for a set duration' },
  { value: 'ramp',     label: 'Ramp-up',  icon: '/', description: 'Gradually increase from start to end rate' },
  { value: 'burst',    label: 'Burst',    icon: '•••', description: 'Send N messages as fast as possible' },
];

const TEMPLATE_TOKENS = ['{{counter}}', '{{timestamp}}', '{{random}}'];

/** Insert a token at the cursor position inside a textarea. */
function insertToken(
  ref: RefObject<HTMLTextAreaElement | null>,
  token: string,
  getValue: () => string,
  setValue: (v: string) => void,
) {
  const el = ref.current;
  if (!el) { setValue(getValue() + token); return; }
  const start = el.selectionStart ?? getValue().length;
  const end   = el.selectionEnd   ?? start;
  const next  = getValue().slice(0, start) + token + getValue().slice(end);
  setValue(next);
  // Restore cursor after the inserted token
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + token.length, start + token.length);
  });
}

const DURATION_PRESETS = [5, 10, 15, 30, 60];

function formatDuration(ms: number): string {
  const sec = ms / 1000;
  if (sec < 60) return `${round2(sec)}s`;
  return `${Math.floor(sec / 60)}m ${round2(sec % 60)}s`;
}

function formatRate(rate: number): string {
  if (!isFinite(rate)) return 'Max';
  if (rate >= 1000) return `${round2(rate / 1000)}k/s`;
  return `${round2(rate)}/s`;
}

function SparklineSvg({ data, width = 200, height = 40, color = 'var(--ws-accent-color)' }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="ws-lt-sparkline" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function HistogramBar({ buckets, maxCount }: { buckets: { bucket: string; count: number }[]; maxCount: number }) {
  if (buckets.length === 0) return <div className="ws-lt-histogram-empty">No latency data</div>;
  return (
    <div className="ws-lt-histogram" data-testid="lt-histogram">
      {buckets.map((b) => (
        <div key={b.bucket} className="ws-lt-histogram-row">
          <span className="ws-lt-histogram-label">{b.bucket}</span>
          <div className="ws-lt-histogram-bar-bg">
            <div
              className="ws-lt-histogram-bar-fill"
              style={{ width: `${maxCount > 0 ? (b.count / maxCount) * 100 : 0}%` }}
            />
          </div>
          <span className="ws-lt-histogram-count">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

export function WebSocketLoadTest({ loadTest, isConnected, statsPanel }: WebSocketLoadTestProps) {
  const { state, config, setConfig, progress, result } = loadTest;
  const [confirmStart, setConfirmStart] = useState(false);
  const [formatState, setFormatState] = useState<'idle' | 'ok' | 'err'>('idle');
  const formatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const handleImportResult = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as WsLoadTestResult;
        loadTest.loadResult(data);
      } catch {
        // ignore malformed files
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be imported again
    e.target.value = '';
  }, [loadTest]);

  const handleFormatTemplate = useCallback(() => {
    const raw = config.messageTemplate.trim();
    // Use unique marker values unlikely to appear in real templates.
    // Number marker: preserved as number by JSON.parse, so {{counter}} type is preserved.
    const COUNTER_N = 1234567890;
    const TIMESTAMP_S = '2099-01-01T00:00:00.000Z';
    const RANDOM_S = 'XRND_PLACEHOLDER_X';
    const substituted = raw
      .replace(/\{\{counter\}\}/g, String(COUNTER_N))
      .replace(/\{\{timestamp\}\}/g, TIMESTAMP_S)
      .replace(/\{\{random\}\}/g, RANDOM_S);
    try {
      let pretty = JSON.stringify(JSON.parse(substituted), null, 2);
      pretty = pretty
        .replace(new RegExp(String(COUNTER_N), 'g'), '{{counter}}')
        .replace(new RegExp(`"${TIMESTAMP_S}"`, 'g'), '"{{timestamp}}"')
        .replace(new RegExp(`"${RANDOM_S}"`, 'g'), '"{{random}}"');
      setConfig({ messageTemplate: pretty });
      setFormatState('ok');
    } catch {
      setFormatState('err');
    }
    if (formatTimerRef.current) clearTimeout(formatTimerRef.current);
    formatTimerRef.current = setTimeout(() => setFormatState('idle'), 1500);
  }, [config.messageTemplate, setConfig]);

  const expectedTotal = useMemo(() => computeExpectedTotal(config), [config]);

  const handleStart = useCallback(() => {
    const highRate = config.rate > 100
      || (config.profile === 'ramp' && (config.rateEnd ?? 0) > 100);
    if (highRate && config.profile !== 'burst' && !confirmStart) {
      setConfirmStart(true);
      return;
    }
    setConfirmStart(false);
    loadTest.start();
  }, [loadTest, config.rate, config.rateEnd, config.profile, confirmStart]);

  const handleConfirm = useCallback(() => {
    setConfirmStart(false);
    loadTest.start();
  }, [loadTest]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmStart(false);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(createDefaultLoadTestConfig());
  }, [setConfig]);

  const handleRunAgain = useCallback(() => {
    if (!isConnected) return;
    setConfirmStart(false);
    loadTest.start();
  }, [isConnected, loadTest]);

  const handleExportResult = useCallback(async () => {
    if (!result) return;
    const filename = `ws-load-test-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    await saveJsonFile(result, filename);
  }, [result]);

  const isRunning = state === 'running' || state === 'stopping';
  const isDone = state === 'done';

  const progressPct = useMemo(() => {
    if (!isRunning) return 0;
    if (config.profile === 'burst') {
      return expectedTotal > 0 ? Math.min(100, (progress.totalSent / expectedTotal) * 100) : 0;
    }
    const totalMs = config.durationSec * 1000;
    return totalMs > 0 ? Math.min(100, (progress.elapsedMs / totalMs) * 100) : 0;
  }, [isRunning, config.profile, config.durationSec, progress.elapsedMs, progress.totalSent, expectedTotal]);

  const histogramMax = useMemo(() => {
    if (!result) return 0;
    return Math.max(...result.latencyHistogram.map((b) => b.count), 0);
  }, [result]);

  const throughputData = useMemo(() => {
    if (!result) return [];
    return result.throughputHistory.map((t) => t.sent);
  }, [result]);

  return (
    <div className="ws-lt-container" data-testid="load-test-panel">
      {!isRunning && !isDone && (
        <div className="ws-lt-config" data-testid="lt-config">

          <div className="ws-lt-header">
            <div className="ws-lt-header-text">
              <span className="ws-lt-header-title">Load test</span>
              <span className="ws-lt-header-sub">Configure a profile, message template, and rate — then run against the live connection.</span>
            </div>
          </div>

          {/* Profile */}
          <section className="ws-lt-card-block">
            <div className="ws-lt-section-label">Profile</div>
            <div className="ws-lt-profile-cards" data-testid="lt-profile-pills">
              {PROFILES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`ws-lt-profile-card ${config.profile === p.value ? 'active' : ''}`}
                  onClick={() => setConfig({ profile: p.value })}
                  data-testid={`lt-profile-${p.value}`}
                  aria-pressed={config.profile === p.value}
                >
                  <span className="ws-lt-profile-card-top">
                    <span className="ws-lt-profile-card-icon" aria-hidden="true">{p.icon}</span>
                    <span className="ws-lt-profile-card-name">{p.label}</span>
                    {config.profile === p.value && (
                      <span className="ws-lt-profile-card-check" aria-hidden="true">✓</span>
                    )}
                  </span>
                  <span className="ws-lt-profile-card-desc">{p.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Message template */}
          <section className="ws-lt-card-block">
            <div className="ws-lt-template-header">
              <span className="ws-lt-section-label">Message template</span>
              <span className="ws-lt-section-hint">Click a token to insert at the cursor</span>
              <div className="ws-lt-token-badges">
                {TEMPLATE_TOKENS.map((tok) => (
                  <button
                    key={tok}
                    className="ws-lt-token-badge"
                    onClick={() => insertToken(
                      templateRef,
                      tok,
                      () => config.messageTemplate,
                      (v) => setConfig({ messageTemplate: v }),
                    )}
                    title={`Insert ${tok}`}
                    type="button"
                  >
                    {tok}
                  </button>
                ))}
              </div>
              <button
                className={`ws-lt-format-btn ${formatState === 'ok' ? 'ws-lt-format-ok' : formatState === 'err' ? 'ws-lt-format-err' : ''}`}
                onClick={handleFormatTemplate}
                title="Format as pretty-printed JSON"
                type="button"
                data-testid="lt-format-btn"
              >
                {formatState === 'ok' ? '✓ Formatted' : formatState === 'err' ? '✗ Invalid JSON' : '{ } Format'}
              </button>
            </div>
            <textarea
              ref={templateRef}
              className="ws-lt-textarea"
              value={config.messageTemplate}
              onChange={(e) => setConfig({ messageTemplate: e.target.value })}
              rows={8}
              spellCheck={false}
              placeholder={'{\n  "type": "ping",\n  "seq": {{counter}}\n}'}
              data-testid="lt-message-template"
            />
          </section>

          {/* Rate / Duration / Burst — one field per row */}
          <section className="ws-lt-card-block ws-lt-params-block">
            {config.profile !== 'burst' && (
              <>
                <div className="ws-lt-form-row">
                  <label className="ws-lt-form-label" htmlFor="lt-rate-input">
                    {config.profile === 'ramp' ? 'Start rate' : 'Rate'}
                    <span className="ws-lt-unit-tag">msg/s</span>
                  </label>
                  <div className="ws-lt-form-ctrl">
                    <input
                      id="lt-rate-input"
                      className="ws-lt-input"
                      type="number"
                      value={config.rate}
                      onChange={(e) => setConfig({ rate: parseInt(e.target.value, 10) || 1 })}
                      min={1}
                      max={1000}
                      data-testid="lt-rate"
                    />
                  </div>
                </div>
                {config.profile === 'ramp' && (
                  <div className="ws-lt-form-row">
                    <label className="ws-lt-form-label" htmlFor="lt-rate-end-input">
                      End rate
                      <span className="ws-lt-unit-tag">msg/s</span>
                    </label>
                    <div className="ws-lt-form-ctrl">
                      <input
                        id="lt-rate-end-input"
                        className="ws-lt-input"
                        type="number"
                        value={config.rateEnd}
                        onChange={(e) => setConfig({ rateEnd: parseInt(e.target.value, 10) || 1 })}
                        min={1}
                        max={1000}
                        data-testid="lt-rate-end"
                      />
                    </div>
                  </div>
                )}
                <div className="ws-lt-form-row">
                  <label className="ws-lt-form-label" htmlFor="lt-duration-input">
                    Duration
                    <span className="ws-lt-unit-tag">seconds</span>
                  </label>
                  <div className="ws-lt-form-ctrl ws-lt-form-ctrl--duration">
                    <div className="ws-lt-duration-seg" role="group" aria-label="Duration presets">
                      {DURATION_PRESETS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`ws-lt-seg-btn ${config.durationSec === d ? 'active' : ''}`}
                          onClick={() => setConfig({ durationSec: d })}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                    <input
                      id="lt-duration-input"
                      className="ws-lt-input ws-lt-duration-custom"
                      type="number"
                      value={config.durationSec}
                      onChange={(e) => setConfig({ durationSec: parseInt(e.target.value, 10) || 1 })}
                      min={1}
                      max={3600}
                      placeholder="Custom"
                      data-testid="lt-duration"
                    />
                  </div>
                </div>
              </>
            )}
            {config.profile === 'burst' && (
              <div className="ws-lt-form-row">
                <label className="ws-lt-form-label" htmlFor="lt-burst-input">
                  Total messages
                  <span className="ws-lt-unit-tag">count</span>
                </label>
                <div className="ws-lt-form-ctrl">
                  <input
                    id="lt-burst-input"
                    className="ws-lt-input"
                    type="number"
                    value={config.burstCount}
                    onChange={(e) => setConfig({ burstCount: parseInt(e.target.value, 10) || 1 })}
                    min={1}
                    max={60000}
                    data-testid="lt-burst-count"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Summary + actions */}
          <div className="ws-lt-summary-bar" data-testid="lt-summary">
            <div className="ws-lt-summary-body">
              <span className="ws-lt-summary-value">{expectedTotal.toLocaleString()}</span>
              <span className="ws-lt-summary-detail">
                messages expected
                {config.profile !== 'burst' && <> · {config.durationSec}s duration</>}
              </span>
            </div>
            {(config.rate > 100 || (config.profile === 'ramp' && (config.rateEnd ?? 0) > 100)) && config.profile !== 'burst' && (
              <span className="ws-lt-high-rate-badge">High rate</span>
            )}
          </div>

          <div className="ws-lt-footer">
            {confirmStart ? (
              <div className="ws-lt-confirm-card" data-testid="lt-confirm">
                <span className="ws-lt-confirm-text">{config.profile === 'ramp'
                  ? `Ramp from ${config.rate} to ${config.rateEnd} msg/s over ${config.durationSec}s?`
                  : `Send at ${config.rate} msg/s for ${config.durationSec}s?`}</span>
                <div className="ws-lt-confirm-actions">
                  <button type="button" className="ws-lt-btn ws-lt-btn-primary" onClick={handleConfirm} data-testid="lt-confirm-yes">
                    Confirm
                  </button>
                  <button type="button" className="ws-lt-btn" onClick={handleCancelConfirm} data-testid="lt-confirm-no">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="ws-lt-btn ws-lt-btn-primary ws-lt-btn-start"
                  onClick={handleStart}
                  disabled={!isConnected || !config.messageTemplate.trim()}
                  data-testid="lt-start-btn"
                >
                  Start load test
                </button>
                <button type="button" className="ws-lt-btn ws-lt-btn-ghost" onClick={handleReset} data-testid="lt-reset-btn">
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Running state */}
      {isRunning && (
        <div className="ws-lt-running" data-testid="lt-running">
          <div className="ws-lt-section-title">
            <span className={`ws-lt-live-dot ${state === 'stopping' ? 'ws-lt-live-dot--stopping' : ''}`} aria-hidden="true" />
            {state === 'stopping' ? 'Stopping…' : 'Load test running'}
          </div>
          <div className="ws-lt-progress-bar-container">
            <div className={`ws-lt-progress-bar ${state === 'stopping' ? '' : 'ws-lt-progress-animated'}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="ws-lt-pct-label">{Math.round(progressPct)}%</div>
          <div className="ws-lt-live-metrics">
            <div className="ws-lt-metric">
              <span className="ws-lt-metric-value">{progress.totalSent.toLocaleString()}</span>
              <span className="ws-lt-metric-label">Sent</span>
            </div>
            <div className="ws-lt-metric">
              <span className="ws-lt-metric-value">{progress.totalReceived.toLocaleString()}</span>
              <span className="ws-lt-metric-label">Received</span>
            </div>
            <div className="ws-lt-metric">
              <span className="ws-lt-metric-value">{formatRate(progress.actualRate)}</span>
              <span className="ws-lt-metric-label">Actual Rate</span>
            </div>
            <div className="ws-lt-metric">
              <span className="ws-lt-metric-value">{formatRate(progress.targetRate)}</span>
              <span className="ws-lt-metric-label">Target Rate</span>
            </div>
            <div className="ws-lt-metric">
              <span className="ws-lt-metric-value">{formatDuration(progress.elapsedMs)}</span>
              <span className="ws-lt-metric-label">Elapsed</span>
            </div>
            {progress.errorCount > 0 && (
              <div className="ws-lt-metric ws-lt-metric-error">
                <span className="ws-lt-metric-value">{progress.errorCount}</span>
                <span className="ws-lt-metric-label">Errors</span>
              </div>
            )}
          </div>
          {statsPanel && (
            <div className="ws-lt-live-stats" data-testid="lt-live-stats">
              <div className="ws-lt-subsection-title">Live Connection Stats</div>
              {statsPanel}
            </div>
          )}
          <div className="ws-lt-actions">
            <button
              className="ws-lt-btn ws-lt-btn-danger"
              onClick={loadTest.stop}
              disabled={state === 'stopping'}
              data-testid="lt-stop-btn"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {isDone && result && (
        <div className="ws-lt-results" data-testid="lt-results">
          <div className="ws-lt-section-header">
            <div className="ws-lt-results-heading">
              <button
                type="button"
                className="ws-lt-back-btn"
                onClick={loadTest.clearResult}
                data-testid="lt-clear-btn"
                title="Return to load test configuration"
              >
                ← Edit configuration
              </button>
              <span className="ws-lt-section-title">Load test results</span>
            </div>
            <div className="ws-lt-result-actions">
              <button
                type="button"
                className="ws-lt-btn ws-lt-btn-ghost"
                onClick={handleExportResult}
                data-testid="lt-export-btn"
                title="Download results as JSON"
              >
                Export
              </button>
              <button
                type="button"
                className="ws-lt-btn ws-lt-btn-ghost"
                onClick={() => importRef.current?.click()}
                data-testid="lt-import-btn"
                title="Open a previously exported results file"
              >
                Import
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportResult}
              />
            </div>
          </div>
          {!isConnected && (
            <div className="ws-lt-warning-banner" data-testid="lt-done-disconnected">
              Disconnected — reconnect to run another load test.
            </div>
          )}

          {/* Summary cards */}
          <div className="ws-lt-result-cards" data-testid="lt-result-cards">
            <div className="ws-lt-card ws-lt-card-sent">
              <span className="ws-lt-card-value">{result.totalSent.toLocaleString()}</span>
              <span className="ws-lt-card-label">Messages Sent</span>
            </div>
            <div className="ws-lt-card ws-lt-card-received">
              <span className="ws-lt-card-value">{result.totalReceived.toLocaleString()}</span>
              <span className="ws-lt-card-label">Received</span>
            </div>
            <div className="ws-lt-card ws-lt-card-duration">
              <span className="ws-lt-card-value">{formatDuration(result.durationMs)}</span>
              <span className="ws-lt-card-label">Duration</span>
            </div>
            <div className="ws-lt-card ws-lt-card-rate">
              <span className="ws-lt-card-value">{formatRate(result.avgSendRate)}</span>
              <span className="ws-lt-card-label">Avg Send Rate</span>
            </div>
            {result.errorCount > 0 && (
              <div className="ws-lt-card ws-lt-card-error">
                <span className="ws-lt-card-value">{result.errorCount}</span>
                <span className="ws-lt-card-label">Errors</span>
              </div>
            )}
          </div>

          {/* Latency */}
          {result.latency.samples > 0 && (
            <div className="ws-lt-latency-section">
              <div className="ws-lt-subsection-title">
                Round-trip latency ({result.latency.samples.toLocaleString()} samples)
              </div>
              <div className="ws-lt-latency-cards">
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.min}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">Min</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.mean}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">Mean</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.p50}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">P50</span>
                </div>
                <div className="ws-lt-latency-card ws-lt-latency-highlight">
                  <span className="ws-lt-latency-value">{result.latency.p95}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">P95</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.p99}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">P99</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.max}<span className="ws-lt-latency-unit">ms</span></span>
                  <span className="ws-lt-latency-label">Max</span>
                </div>
              </div>

              {/* Histogram */}
              <div className="ws-lt-subsection-title">Latency Distribution</div>
              <HistogramBar buckets={result.latencyHistogram} maxCount={histogramMax} />
            </div>
          )}

          {/* Throughput sparkline */}
          {throughputData.length > 1 && (
            <div className="ws-lt-throughput-section">
              <div className="ws-lt-subsection-title">Throughput Over Time (msg/s)</div>
              <SparklineSvg data={throughputData} width={400} height={60} />
            </div>
          )}

          {/* Bytes */}
          <div className="ws-lt-bytes-row">
            <span>Bytes sent: {(result.bytesSent / 1024).toFixed(1)} KB</span>
            <span>Bytes received: {(result.bytesReceived / 1024).toFixed(1)} KB</span>
          </div>

          <div className="ws-lt-results-footer">
            <button
              type="button"
              className="ws-lt-btn ws-lt-btn-primary ws-lt-btn-start"
              onClick={handleRunAgain}
              disabled={!isConnected}
              title={isConnected ? 'Run the same configuration again' : 'Reconnect to run the test again'}
              data-testid="lt-run-again-btn"
            >
              Run again
            </button>
            <span className="ws-lt-results-footer-hint">
              Same profile, rate, and template — or use Edit configuration to change settings.
            </span>
          </div>
        </div>
      )}

      {/* Not connected warning */}
      {!isConnected && !isRunning && !isDone && (
        <div className="ws-lt-not-connected-card" data-testid="lt-not-connected">
          <span className="ws-lt-not-connected-title">Not connected</span>
          <span className="ws-lt-not-connected-text">Connect to a WebSocket endpoint first to run a load test.</span>
        </div>
      )}
    </div>
  );
}
