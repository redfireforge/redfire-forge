import { useCallback, useMemo, useState } from 'react';
import type { WsLoadProfile } from '../../shared/websocket/types';
import type { UseWebSocketLoadTestReturn } from './useWebSocketLoadTest';
import { computeExpectedTotal, createDefaultLoadTestConfig } from './wsLoadTestMetrics';
import { round2 } from '../../shared/utils/percentiles';
import { saveJsonFile } from '../../shared/utils/fileSaver';

interface WebSocketLoadTestProps {
  loadTest: UseWebSocketLoadTestReturn;
  isConnected: boolean;
}

const PROFILES: { value: WsLoadProfile; label: string; description: string }[] = [
  { value: 'constant', label: 'Constant', description: 'Fixed rate for a set duration' },
  { value: 'ramp', label: 'Ramp-up', description: 'Gradually increase from start to end rate' },
  { value: 'burst', label: 'Burst', description: 'Send N messages as fast as possible' },
];

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

export function WebSocketLoadTest({ loadTest, isConnected }: WebSocketLoadTestProps) {
  const { state, config, setConfig, progress, result } = loadTest;
  const [confirmStart, setConfirmStart] = useState(false);

  const expectedTotal = useMemo(() => computeExpectedTotal(config), [config]);

  const handleStart = useCallback(() => {
    if (config.rate > 100 && config.profile !== 'burst' && !confirmStart) {
      setConfirmStart(true);
      return;
    }
    setConfirmStart(false);
    loadTest.start();
  }, [loadTest, config.rate, config.profile, confirmStart]);

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
          <div className="ws-lt-section-title">Load Test Configuration</div>

          {/* Profile selector */}
          <div className="ws-lt-field">
            <label className="ws-lt-label">Profile</label>
            <div className="ws-lt-profile-pills" data-testid="lt-profile-pills">
              {PROFILES.map((p) => (
                <button
                  key={p.value}
                  className={`ws-lt-profile-pill ${config.profile === p.value ? 'active' : ''}`}
                  onClick={() => setConfig({ profile: p.value })}
                  title={p.description}
                  data-testid={`lt-profile-${p.value}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message template */}
          <div className="ws-lt-field">
            <label className="ws-lt-label">
              Message Template
              <span className="ws-lt-hint">{'{{counter}} {{timestamp}} {{random}}'}</span>
            </label>
            <textarea
              className="ws-lt-textarea"
              value={config.messageTemplate}
              onChange={(e) => setConfig({ messageTemplate: e.target.value })}
              rows={3}
              placeholder='{"type":"ping","seq":{{counter}}}'
              data-testid="lt-message-template"
            />
          </div>

          {/* Rate config */}
          {config.profile !== 'burst' && (
            <div className="ws-lt-row">
              <div className="ws-lt-field">
                <label className="ws-lt-label">
                  {config.profile === 'ramp' ? 'Start Rate (msg/s)' : 'Rate (msg/s)'}
                </label>
                <input
                  className="ws-lt-input"
                  type="number"
                  value={config.rate}
                  onChange={(e) => setConfig({ rate: parseInt(e.target.value, 10) || 1 })}
                  min={1}
                  max={1000}
                  data-testid="lt-rate"
                />
              </div>
              {config.profile === 'ramp' && (
                <div className="ws-lt-field">
                  <label className="ws-lt-label">End Rate (msg/s)</label>
                  <input
                    className="ws-lt-input"
                    type="number"
                    value={config.rateEnd}
                    onChange={(e) => setConfig({ rateEnd: parseInt(e.target.value, 10) || 1 })}
                    min={1}
                    max={1000}
                    data-testid="lt-rate-end"
                  />
                </div>
              )}
              <div className="ws-lt-field">
                <label className="ws-lt-label">Duration (seconds)</label>
                <div className="ws-lt-duration-row">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d}
                      className={`ws-lt-duration-btn ${config.durationSec === d ? 'active' : ''}`}
                      onClick={() => setConfig({ durationSec: d })}
                    >
                      {d}s
                    </button>
                  ))}
                  <input
                    className="ws-lt-input ws-lt-input-sm"
                    type="number"
                    value={config.durationSec}
                    onChange={(e) => setConfig({ durationSec: parseInt(e.target.value, 10) || 1 })}
                    min={1}
                    max={60}
                    data-testid="lt-duration"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Burst config */}
          {config.profile === 'burst' && (
            <div className="ws-lt-field">
              <label className="ws-lt-label">Total Messages</label>
              <input
                className="ws-lt-input"
                type="number"
                value={config.burstCount}
                onChange={(e) => setConfig({ burstCount: parseInt(e.target.value, 10) || 1 })}
                min={1}
                max={60000}
                data-testid="lt-burst-count"
              />
            </div>
          )}

          {/* Summary */}
          <div className="ws-lt-summary" data-testid="lt-summary">
            Expected: ~{expectedTotal.toLocaleString()} messages
            {config.profile !== 'burst' && ` over ${config.durationSec}s`}
            {config.rate > 100 && config.profile !== 'burst' && (
              <span className="ws-lt-warning"> (high rate — may impact UI responsiveness)</span>
            )}
          </div>

          {/* Actions */}
          <div className="ws-lt-actions">
            {confirmStart ? (
              <div className="ws-lt-confirm" data-testid="lt-confirm">
                <span>Send at {config.rate} msg/s for {config.durationSec}s?</span>
                <button className="ws-lt-btn ws-lt-btn-primary" onClick={handleConfirm} data-testid="lt-confirm-yes">
                  Confirm
                </button>
                <button className="ws-lt-btn" onClick={handleCancelConfirm} data-testid="lt-confirm-no">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  className="ws-lt-btn ws-lt-btn-primary"
                  onClick={handleStart}
                  disabled={!isConnected || !config.messageTemplate.trim()}
                  data-testid="lt-start-btn"
                >
                  Start Load Test
                </button>
                <button className="ws-lt-btn" onClick={handleReset} data-testid="lt-reset-btn">
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
            {state === 'stopping' ? 'Stopping\u2026' : 'Load Test Running'}
          </div>
          <div className="ws-lt-progress-bar-container">
            <div className="ws-lt-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
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
            <span className="ws-lt-section-title">Load Test Results</span>
            <div className="ws-lt-result-actions">
              <button className="ws-lt-btn" onClick={handleExportResult} data-testid="lt-export-btn">
                Export JSON
              </button>
              <button className="ws-lt-btn" onClick={loadTest.clearResult} data-testid="lt-clear-btn">
                New Test
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="ws-lt-result-cards" data-testid="lt-result-cards">
            <div className="ws-lt-card">
              <span className="ws-lt-card-value">{result.totalSent.toLocaleString()}</span>
              <span className="ws-lt-card-label">Messages Sent</span>
            </div>
            <div className="ws-lt-card">
              <span className="ws-lt-card-value">{result.totalReceived.toLocaleString()}</span>
              <span className="ws-lt-card-label">Received</span>
            </div>
            <div className="ws-lt-card">
              <span className="ws-lt-card-value">{formatDuration(result.durationMs)}</span>
              <span className="ws-lt-card-label">Duration</span>
            </div>
            <div className="ws-lt-card">
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
                Round-Trip Latency ({result.latency.samples.toLocaleString()} samples)
              </div>
              <div className="ws-lt-latency-cards">
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.min}ms</span>
                  <span className="ws-lt-latency-label">Min</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.mean}ms</span>
                  <span className="ws-lt-latency-label">Mean</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.p50}ms</span>
                  <span className="ws-lt-latency-label">P50</span>
                </div>
                <div className="ws-lt-latency-card ws-lt-latency-highlight">
                  <span className="ws-lt-latency-value">{result.latency.p95}ms</span>
                  <span className="ws-lt-latency-label">P95</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.p99}ms</span>
                  <span className="ws-lt-latency-label">P99</span>
                </div>
                <div className="ws-lt-latency-card">
                  <span className="ws-lt-latency-value">{result.latency.max}ms</span>
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
        </div>
      )}

      {/* Not connected warning */}
      {!isConnected && !isRunning && !isDone && (
        <div className="ws-lt-warning-banner" data-testid="lt-not-connected">
          Connect to a WebSocket endpoint first to run a load test.
        </div>
      )}
    </div>
  );
}
