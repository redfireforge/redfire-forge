import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  buildGrpcRpcMethodKey,
  listGrpcRpcMethodRows,
} from '../../../shared/grpc/grpcRpcSessionStats';

export interface GrpcRpcStatisticsPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0ms';
  }
  return `${Math.round(ms)}ms`;
}

function latencyBarWidth(avgMs: number, maxAvgMs: number): number {
  if (maxAvgMs <= 0 || avgMs <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((avgMs / maxAvgMs) * 72));
}

export function GrpcRpcStatisticsPanel({ advanced }: GrpcRpcStatisticsPanelProps) {
  const rows = listGrpcRpcMethodRows(advanced.rpcSessionStats);
  const summary = advanced.rpcSessionSummary;
  const maxAvgLatency = rows.reduce((max, row) => Math.max(max, row.latencyMs.avg), 0);

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-rpc-stats-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">RPC statistics — session</h2>
          <p className="grpc-advanced-card__subtitle">
            Tab: {advanced.activeTabLabel}
            {advanced.activeRpcLabel ? ` · ${advanced.activeRpcLabel}` : ''}
          </p>
        </div>
        <div className="grpc-advanced-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="grpc-rpc-stats-reset-btn"
            onClick={advanced.resetRpcSessionStats}
            disabled={summary.totalCalls === 0}
          >
            Reset session
          </button>
        </div>
      </header>

      <div className="grpc-advanced-card">
        <div className="grpc-advanced-card__body">
          <div className="grpc-rpc-stats-metrics" data-testid="grpc-rpc-stats-summary">
            <div className="grpc-rpc-stats-metric">
              <div className="grpc-rpc-stats-metric__label">Total calls</div>
              <div className="grpc-rpc-stats-metric__value" data-testid="grpc-rpc-stats-total-calls">
                {summary.totalCalls}
              </div>
              <div className="grpc-rpc-stats-metric__sub">This session</div>
            </div>
            <div className={`grpc-rpc-stats-metric${summary.successRatePercent >= 90 ? ' grpc-rpc-stats-metric--ok' : summary.totalErrors > 0 ? ' grpc-rpc-stats-metric--err' : ''}`}>
              <div className="grpc-rpc-stats-metric__label">Success rate</div>
              <div className="grpc-rpc-stats-metric__value" data-testid="grpc-rpc-stats-success-rate">
                {summary.successRatePercent.toFixed(1)}
                <span className="grpc-rpc-stats-metric__unit">%</span>
              </div>
              <div className="grpc-rpc-stats-metric__sub">
                {summary.totalCalls - summary.totalErrors} OK / {summary.totalErrors} errors
              </div>
            </div>
            <div className="grpc-rpc-stats-metric">
              <div className="grpc-rpc-stats-metric__label">Avg latency</div>
              <div className="grpc-rpc-stats-metric__value" data-testid="grpc-rpc-stats-avg-latency">
                {formatLatency(summary.avgLatencyMs)}
              </div>
              <div className="grpc-rpc-stats-metric__sub">
                p95: {formatLatency(summary.p95LatencyMs)}
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="grpc-rpc-stats-empty" data-testid="grpc-rpc-stats-empty">
              No RPC calls recorded in this session yet. Send unary or streaming calls from this tab,
              or run a load test, to populate statistics.
            </p>
          ) : (
            <div className="grpc-rpc-stats-table-wrap">
              <table className="grpc-rpc-stats-table" data-testid="grpc-rpc-stats-table">
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col">Calls</th>
                    <th scope="col">OK</th>
                    <th scope="col">Errors</th>
                    <th scope="col">Min</th>
                    <th scope="col">Avg</th>
                    <th scope="col">p95</th>
                    <th scope="col">Max</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const methodKey = buildGrpcRpcMethodKey(row.service, row.method);
                    const okCount = row.calls - row.errors;
                    const statusEntries = Object.entries(row.statusDistribution)
                      .sort(([a], [b]) => a.localeCompare(b));
                    return (
                      <tr key={methodKey} data-testid="grpc-rpc-stats-row" data-method-key={methodKey}>
                        <td className="grpc-rpc-stats-table__method">{methodKey}</td>
                        <td>{row.calls}</td>
                        <td className="grpc-rpc-stats-table__ok">{okCount}</td>
                        <td className="grpc-rpc-stats-table__err">{row.errors}</td>
                        <td>{formatLatency(row.latencyMs.min)}</td>
                        <td>
                          <span
                            className="grpc-rpc-stats-latency-bar"
                            style={{ width: `${latencyBarWidth(row.latencyMs.avg, maxAvgLatency)}px` }}
                            aria-hidden
                          />
                          {formatLatency(row.latencyMs.avg)}
                        </td>
                        <td>{formatLatency(row.latencyMs.p95)}</td>
                        <td>{formatLatency(row.latencyMs.max)}</td>
                        <td>
                          <div className="grpc-rpc-stats-status-chips">
                            {statusEntries.map(([status, count]) => (
                              <span
                                key={status}
                                className={`grpc-rpc-stats-status-chip${status === '0' ? ' grpc-rpc-stats-status-chip--ok' : ' grpc-rpc-stats-status-chip--err'}`}
                              >
                                {status}: {count}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
