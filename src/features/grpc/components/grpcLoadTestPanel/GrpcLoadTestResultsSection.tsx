import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';
import { formatLoadTestProgressLabel } from '../../utils/grpcStudioAdvancedModel';
import {
  serializeGrpcLoadTestRunSummaryExportSafeCsv,
  serializeGrpcLoadTestRunSummaryExportSafeJson,
} from '../../../../shared/grpc/grpcAdvancedFeatureExport';
import {
  buildCompareDetailRows,
  buildCompareDeltas,
  buildCompareStatusComposition,
  buildLatencyHistogram,
  buildStatusBreakdown,
  buildThroughputTimeline,
  downloadTextFile,
  formatStopReason,
  safeFilePart,
  type GrpcLoadTestSummary,
} from './grpcLoadTestPanelUtils';

type StatusBreakdownEntry = ReturnType<typeof buildStatusBreakdown>[number];
type LatencyHistogramBucket = ReturnType<typeof buildLatencyHistogram>[number];
type ThroughputTimelinePoint = ReturnType<typeof buildThroughputTimeline>[number];
type CompareDeltas = ReturnType<typeof buildCompareDeltas>;
type CompareDetailRow = ReturnType<typeof buildCompareDetailRows>[number];
type CompareStatusCompositionRow = ReturnType<typeof buildCompareStatusComposition>[number];

export interface GrpcLoadTestResultsSectionProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
  summary: GrpcLoadTestSummary | undefined;
  live: UseGrpcStudioAdvancedFeaturesReturn['loadTest']['live'];
  config: UseGrpcStudioAdvancedFeaturesReturn['loadTest']['config'];
  selectedRunId: string | undefined;
  runHistory: NonNullable<UseGrpcStudioAdvancedFeaturesReturn['loadTest']['runHistory']>;
  compareRunId: string;
  setCompareRunId: (value: string) => void;
  compareSummary: GrpcLoadTestSummary | undefined;
  compareDeltas: CompareDeltas | undefined;
  compareDetailRows: CompareDetailRow[];
  compareStatusComposition: CompareStatusCompositionRow[];
  statusBreakdown: StatusBreakdownEntry[];
  latencyHistogram: LatencyHistogramBucket[];
  throughputTimeline: ThroughputTimelinePoint[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function GrpcLoadTestResultsSection({
  advanced,
  summary,
  live,
  config,
  selectedRunId,
  runHistory,
  compareRunId,
  setCompareRunId,
  compareSummary,
  compareDeltas,
  compareDetailRows,
  compareStatusComposition,
  statusBreakdown,
  latencyHistogram,
  throughputTimeline,
  collapsed,
  onToggleCollapse,
}: GrpcLoadTestResultsSectionProps) {
  if (!live && !summary) {
    return null;
  }

  return (
    <div className="grpc-advanced-card" data-testid="grpc-load-test-results">
      <div className="grpc-advanced-card__header">
        <div className="grpc-advanced-card__header-main">
          <h3 className="grpc-advanced-card__title">Results</h3>
          {summary && !advanced.loadTestRunning && (
          <div className="grpc-advanced-card__actions">
            {runHistory.length > 0 && (
              <select
                className="grpc-advanced-select grpc-advanced-select--compact"
                data-testid="grpc-load-test-run-history-select"
                value={selectedRunId ?? ''}
                onChange={(event) => {
                  advanced.selectLoadTestRunSummary(event.target.value);
                }}
              >
                {runHistory.map((entry) => (
                  <option key={entry.summary.runId} value={entry.summary.runId}>
                    {entry.summary.runId} · {new Date(entry.summary.completedAt).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-load-test-export-json"
              onClick={() => {
                const text = advanced.exportLoadTestJson();
                if (text) void navigator.clipboard.writeText(text);
              }}
            >
              Copy JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-load-test-download-json"
              onClick={() => {
                if (!summary || !advanced.loadTest.lastExportSource) {
                  return;
                }
                const text = serializeGrpcLoadTestRunSummaryExportSafeJson(
                  summary,
                  advanced.loadTest.lastExportSource,
                );
                const fileName = `${safeFilePart(summary.runId, 'grpc-load-test')}.json`;
                downloadTextFile(text, fileName, 'application/json;charset=utf-8');
              }}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-load-test-export-csv"
              onClick={() => {
                const text = advanced.exportLoadTestCsv();
                if (text) void navigator.clipboard.writeText(text);
              }}
            >
              Copy CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-load-test-download-csv"
              onClick={() => {
                if (!summary || !advanced.loadTest.lastExportSource) {
                  return;
                }
                const text = serializeGrpcLoadTestRunSummaryExportSafeCsv(
                  summary,
                  advanced.loadTest.lastExportSource,
                );
                const fileName = `${safeFilePart(summary.runId, 'grpc-load-test')}.csv`;
                downloadTextFile(text, fileName, 'text/csv;charset=utf-8');
              }}
            >
              Download CSV
            </button>
            {!advanced.loadTestRunning && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-load-test-reset-status"
                onClick={advanced.resetLoadTestStatus}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
        </div>
        <button
          type="button"
          className="grpc-advanced-collapse-chevron"
          onClick={onToggleCollapse}
          title={collapsed ? 'Show results' : 'Hide results'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
      <div className="grpc-advanced-card__body">
        {live && (
          <>
            <div className="grpc-advanced-progress">
              <div className="grpc-advanced-progress__label">
                {formatLoadTestProgressLabel(config, live.counts)}
              </div>
              {live.progressPercent != null && (
                <div className="grpc-advanced-progress__bar" aria-hidden="true">
                  <div
                    className="grpc-advanced-progress__fill"
                    style={{ width: `${live.progressPercent}%` }}
                  />
                </div>
              )}
            </div>
            <div className="grpc-advanced-metrics-grid">
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Completed</div>
                <div className="grpc-advanced-metric__value" data-testid="grpc-load-test-live-completed">
                  {live.counts.completed}
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Succeeded</div>
                <div className="grpc-advanced-metric__value">{live.counts.succeeded}</div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Failed</div>
                <div className="grpc-advanced-metric__value">{live.counts.failed}</div>
              </div>
            </div>
            <div className="grpc-advanced-metrics-grid">
              <div className="grpc-advanced-metric grpc-advanced-metric--ok">
                <div className="grpc-advanced-metric__label">Throughput (live)</div>
                <div className="grpc-advanced-metric__value" data-testid="grpc-load-test-live-throughput">
                  {(live.metrics?.measuredAttemptsPerSecond ?? 0).toFixed(1)}
                  <span className="grpc-advanced-metric__unit">RPS</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Success rate (live)</div>
                <div className="grpc-advanced-metric__value" data-testid="grpc-load-test-live-success-rate">
                  {(live.metrics?.successRatePercent ?? 0).toFixed(1)}
                  <span className="grpc-advanced-metric__unit">%</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">p50 latency (live)</div>
                <div className="grpc-advanced-metric__value" data-testid="grpc-load-test-live-p50">
                  {(live.metrics?.p50Ms ?? 0).toFixed(1)}
                  <span className="grpc-advanced-metric__unit">ms</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Error rate (live)</div>
                <div className="grpc-advanced-metric__value" data-testid="grpc-load-test-live-error-rate">
                  {(live.metrics?.errorRatePercent ?? 0).toFixed(1)}
                  <span className="grpc-advanced-metric__unit">%</span>
                </div>
              </div>
            </div>
          </>
        )}
        {summary && !live && (
          <>
            <div className="grpc-load-test-run-strip" data-testid="grpc-load-test-run-strip">
              <span className="grpc-load-test-run-strip__item">
                Run: <strong>{summary.runId}</strong>
              </span>
              <span className="grpc-load-test-run-strip__item">
                Duration: <strong>{summary.durationMs}ms</strong>
              </span>
              <span className="grpc-load-test-run-strip__item">
                Stop: <strong>{formatStopReason(summary.stopReason)}</strong>
              </span>
              <span className="grpc-load-test-run-strip__item">
                Completed: <strong>{new Date(summary.completedAt).toLocaleTimeString()}</strong>
              </span>
            </div>

            <div className="grpc-advanced-metrics-grid" data-testid="grpc-load-test-summary-metrics">
              <div className="grpc-advanced-metric grpc-advanced-metric--ok">
                <div className="grpc-advanced-metric__label">Throughput</div>
                <div className="grpc-advanced-metric__value">
                  {summary.metrics.throughput.measuredAttemptsPerSecond.toFixed(1)}
                  <span className="grpc-advanced-metric__unit">RPS</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">p50 latency</div>
                <div className="grpc-advanced-metric__value">
                  {summary.metrics.latency.p50Ms}
                  <span className="grpc-advanced-metric__unit">ms</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">p95 / p99</div>
                <div className="grpc-advanced-metric__value">
                  {summary.metrics.latency.p95Ms} / {summary.metrics.latency.p99Ms}
                  <span className="grpc-advanced-metric__unit">ms</span>
                </div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Error rate</div>
                <div className="grpc-advanced-metric__value">
                  {summary.metrics.statusDistribution.measuredAttempts > 0
                    ? (
                      (summary.metrics.statusDistribution.failedAttempts
                        / summary.metrics.statusDistribution.measuredAttempts) * 100
                    ).toFixed(1)
                    : '0.0'}
                  <span className="grpc-advanced-metric__unit">%</span>
                </div>
              </div>
            </div>

            <div className="grpc-load-test-legend-row" data-testid="grpc-load-test-percentile-legend">
              <span className="grpc-load-test-legend-chip">
                <span className="grpc-load-test-legend-chip__dot grpc-load-test-legend-chip__dot--p50" aria-hidden="true" />
                p50: median latency
              </span>
              <span className="grpc-load-test-legend-chip">
                <span className="grpc-load-test-legend-chip__dot grpc-load-test-legend-chip__dot--p95" aria-hidden="true" />
                p95: tail latency
              </span>
              <span className="grpc-load-test-legend-chip">
                <span className="grpc-load-test-legend-chip__dot grpc-load-test-legend-chip__dot--p99" aria-hidden="true" />
                p99: worst-case latency
              </span>
            </div>

            {summary && runHistory.length > 1 && (
              <div className="grpc-load-test-chart-card" data-testid="grpc-load-test-run-compare">
                <div className="grpc-load-test-compare-header">
                  <h4 className="grpc-load-test-chart-card__title">Run-to-run compare</h4>
                  <select
                    className="grpc-advanced-select grpc-advanced-select--compact"
                    data-testid="grpc-load-test-run-compare-select"
                    value={compareRunId}
                    onChange={(event) => setCompareRunId(event.target.value)}
                  >
                    <option value="">Select baseline run…</option>
                    {runHistory
                      .filter((entry) => entry.summary.runId !== summary.runId)
                      .map((entry) => (
                        <option key={entry.summary.runId} value={entry.summary.runId}>
                          {entry.summary.runId}
                        </option>
                      ))}
                  </select>
                </div>

                {compareSummary && compareDeltas && (
                  <>
                    <div className="grpc-load-test-compare-grid">
                      <div className="grpc-load-test-compare-metric">
                        <span className="grpc-load-test-compare-metric__label">Throughput Δ</span>
                        <span className={`grpc-load-test-compare-metric__value ${compareDeltas.throughputDelta >= 0 ? 'grpc-load-test-compare-metric__value--good' : 'grpc-load-test-compare-metric__value--bad'}`}>
                          {compareDeltas.throughputDelta >= 0 ? '+' : ''}{compareDeltas.throughputDelta.toFixed(2)} RPS
                        </span>
                      </div>
                      <div className="grpc-load-test-compare-metric">
                        <span className="grpc-load-test-compare-metric__label">p50 Δ</span>
                        <span className={`grpc-load-test-compare-metric__value ${compareDeltas.p50Delta <= 0 ? 'grpc-load-test-compare-metric__value--good' : 'grpc-load-test-compare-metric__value--bad'}`}>
                          {compareDeltas.p50Delta >= 0 ? '+' : ''}{compareDeltas.p50Delta.toFixed(2)} ms
                        </span>
                      </div>
                      <div className="grpc-load-test-compare-metric">
                        <span className="grpc-load-test-compare-metric__label">p95 Δ</span>
                        <span className={`grpc-load-test-compare-metric__value ${compareDeltas.p95Delta <= 0 ? 'grpc-load-test-compare-metric__value--good' : 'grpc-load-test-compare-metric__value--bad'}`}>
                          {compareDeltas.p95Delta >= 0 ? '+' : ''}{compareDeltas.p95Delta.toFixed(2)} ms
                        </span>
                      </div>
                      <div className="grpc-load-test-compare-metric">
                        <span className="grpc-load-test-compare-metric__label">Error rate Δ</span>
                        <span className={`grpc-load-test-compare-metric__value ${compareDeltas.errorRateDelta <= 0 ? 'grpc-load-test-compare-metric__value--good' : 'grpc-load-test-compare-metric__value--bad'}`}>
                          {compareDeltas.errorRateDelta >= 0 ? '+' : ''}{compareDeltas.errorRateDelta.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="grpc-load-test-compare-detail" data-testid="grpc-load-test-run-compare-details">
                      <div className="grpc-load-test-compare-detail__header">
                        <span>Metric</span>
                        <span>Baseline</span>
                        <span>Current</span>
                        <span>Delta</span>
                      </div>
                      {compareDetailRows.map((row) => (
                        <div key={row.label} className="grpc-load-test-compare-detail__row">
                          <span className="grpc-load-test-compare-detail__metric">{row.label}</span>
                          <span>{row.baseline}</span>
                          <span>{row.current}</span>
                          <span className={row.improved
                            ? 'grpc-load-test-compare-detail__delta grpc-load-test-compare-detail__delta--good'
                            : 'grpc-load-test-compare-detail__delta grpc-load-test-compare-detail__delta--bad'}
                          >
                            {row.delta}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grpc-load-test-compare-status" data-testid="grpc-load-test-run-compare-status-composition">
                      <h5 className="grpc-load-test-compare-status__title">Status composition diff</h5>
                      <div className="grpc-load-test-compare-status__header">
                        <span>Code</span>
                        <span>Baseline</span>
                        <span>Current</span>
                        <span>Δ Count</span>
                        <span>Δ %</span>
                      </div>
                      {compareStatusComposition.map((row) => (
                        <div
                          key={row.statusCode}
                          className="grpc-load-test-compare-status__row"
                          data-testid={`grpc-load-test-run-compare-status-row-${row.statusCode.replace(/[^a-z0-9_-]/gi, '_')}`}
                        >
                          <span>{row.statusCode}</span>
                          <span>{row.baselineCount} ({row.baselinePct.toFixed(2)}%)</span>
                          <span>{row.currentCount} ({row.currentPct.toFixed(2)}%)</span>
                          <span>{row.deltaCount >= 0 ? '+' : ''}{row.deltaCount}</span>
                          <span className={row.deltaPct <= 0
                            ? 'grpc-load-test-compare-status__delta grpc-load-test-compare-status__delta--good'
                            : 'grpc-load-test-compare-status__delta grpc-load-test-compare-status__delta--bad'}
                          >
                            {row.deltaPct >= 0 ? '+' : ''}{row.deltaPct.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grpc-load-test-chart-grid">
              <div className="grpc-load-test-chart-card" data-testid="grpc-load-test-status-breakdown">
                <h4 className="grpc-load-test-chart-card__title">Status breakdown</h4>
                {statusBreakdown.length === 0 && (
                  <p className="grpc-advanced-hint">No measured attempts yet.</p>
                )}
                {statusBreakdown.map((entry) => (
                  <div key={entry.statusCode} className="grpc-load-test-breakdown-row">
                    <span className="grpc-load-test-breakdown-row__label">{entry.statusCode}</span>
                    <span className="grpc-load-test-breakdown-row__bar" aria-hidden="true">
                      <span
                        className="grpc-load-test-breakdown-row__fill"
                        style={{ width: `${Math.max(2, entry.ratio * 100)}%` }}
                      />
                    </span>
                    <span className="grpc-load-test-breakdown-row__value">{entry.count}</span>
                  </div>
                ))}
              </div>

              <div className="grpc-load-test-chart-card" data-testid="grpc-load-test-latency-histogram">
                <h4 className="grpc-load-test-chart-card__title">Latency histogram</h4>
                {latencyHistogram.length === 0 && (
                  <p className="grpc-advanced-hint">No measured attempts yet.</p>
                )}
                {latencyHistogram.map((bucket) => (
                  <div key={bucket.label} className="grpc-load-test-histogram-row">
                    <span className="grpc-load-test-histogram-row__label">{bucket.label}</span>
                    <span className="grpc-load-test-histogram-row__bar" aria-hidden="true">
                      <span
                        className="grpc-load-test-histogram-row__fill"
                        style={{ width: `${Math.max(2, bucket.ratio * 100)}%` }}
                      />
                    </span>
                    <span className="grpc-load-test-histogram-row__value">{bucket.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grpc-load-test-chart-card" data-testid="grpc-load-test-throughput-timeline">
              <h4 className="grpc-load-test-chart-card__title">Throughput over time</h4>
              <div className="grpc-load-test-legend-row grpc-load-test-legend-row--compact" data-testid="grpc-load-test-throughput-legend">
                <span className="grpc-load-test-legend-chip">
                  <span className="grpc-load-test-legend-chip__dot grpc-load-test-legend-chip__dot--ok" aria-hidden="true" />
                  Successful attempts/s
                </span>
                <span className="grpc-load-test-legend-chip">
                  <span className="grpc-load-test-legend-chip__dot grpc-load-test-legend-chip__dot--err" aria-hidden="true" />
                  Failed attempts/s
                </span>
              </div>
              {throughputTimeline.length === 0 && (
                <p className="grpc-advanced-hint">No measured attempts yet.</p>
              )}
              <div className="grpc-load-test-throughput-row">
                {throughputTimeline.map((point) => (
                  <div key={point.second} className="grpc-load-test-throughput-point">
                    <div className="grpc-load-test-throughput-point__bars" aria-hidden="true">
                      {point.succeeded > 0 && (
                        <span
                          className="grpc-load-test-throughput-point__bar grpc-load-test-throughput-point__bar--ok"
                          style={{ height: `${Math.max(6, point.ratio * 96)}px` }}
                        />
                      )}
                      {point.failed > 0 && (
                        <span
                          className="grpc-load-test-throughput-point__bar grpc-load-test-throughput-point__bar--err"
                          style={{ height: `${Math.max(4, (point.failed / Math.max(point.total, 1)) * 48)}px` }}
                        />
                      )}
                    </div>
                    <span className="grpc-load-test-throughput-point__label">{point.second}s</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
