import type { TestSummary, TestRun } from '../../../shared/types';

interface Props {
  summary: TestSummary;
  selectedRun: TestRun | null;
}

export function ResultsMetricsCards({ summary, selectedRun }: Props) {
  return (
    <div data-testid="results-metrics-cards">
      <div className="metrics-row">
        <div className="metric-card accent throughput-card">
          <div className="throughput-grid">
            <div className="throughput-item">
              <div className="metric-value">{summary.tps}</div>
              <div className="metric-label">TPS</div>
            </div>
            <div className="throughput-item">
              <div className="metric-value">{(summary.tps * 60).toFixed(1)}</div>
              <div className="metric-label">TPM</div>
            </div>
            <div className="throughput-item">
              <div className="metric-value">{(summary.tps * 3600).toFixed(0)}</div>
              <div className="metric-label">TPH</div>
            </div>
            <div className="throughput-item">
              <div className="metric-value">{(summary.tps * 86400).toFixed(0)}</div>
              <div className="metric-label">TPD</div>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.avgResponseTime} ms</div>
          <div className="metric-label">
            Avg Response
            {summary.avgIterationTime !== undefined && (
              <span className="metric-info" data-tooltip="Average HTTP request duration">ⓘ</span>
            )}
          </div>
        </div>
        {summary.avgIterationTime !== undefined && (
          <div className="metric-card highlight">
            <div className="metric-value">{summary.avgIterationTime} ms</div>
            <div className="metric-label">
              Avg Iteration
              <span className="metric-info" data-tooltip="Average workflow iteration duration (all nodes)">ⓘ</span>
            </div>
          </div>
        )}
        <div className="metric-card">
          <div className="metric-value">{summary.minResponseTime} ms</div>
          <div className="metric-label">Min</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.maxResponseTime} ms</div>
          <div className="metric-label">Max</div>
        </div>
      </div>
      <div className="metrics-row" data-testid="results-metrics-latency-row">
        <div className="metric-card">
          <div className="metric-value">{summary.p50ResponseTime ?? '—'} ms</div>
          <div className="metric-label">P50</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.p95ResponseTime} ms</div>
          <div className="metric-label">P95</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.p99ResponseTime} ms</div>
          <div className="metric-label">P99</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.p999ResponseTime ?? '—'} ms</div>
          <div className="metric-label">P99.9</div>
        </div>
        <div className={`metric-card ${summary.errorRate > 0 ? 'error' : 'success'}`}>
          <div className="metric-value">{summary.errorRate}%</div>
          <div className="metric-label">Error Rate <span className="metric-info" data-tooltip="Percentage of failed requests: HTTP errors (4xx/5xx/timeout) and non-HTTP transport failures (WS/Kafka). Includes intentional negative tests.">ⓘ</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{(summary.totalDurationMs / 1000).toFixed(2)}s</div>
          <div className="metric-label">Total Duration</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.totalRequests}</div>
          <div className="metric-label">Total Requests</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.failedValidations}</div>
          <div className="metric-label">Validation Failures <span className="metric-info" data-tooltip="Requests whose actual response did not match expected assertions. 0 means every test got the response it expected — even negative tests that assert error codes.">ⓘ</span></div>
        </div>
      </div>
      {selectedRun?.config.executionMode === 'constant-arrival' && (
        <div className="metrics-row">
          <div className="metric-card">
            <div className="metric-value">{summary.targetRps ?? '—'}</div>
            <div className="metric-label">Target RPS</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.peakRps ?? '—'}</div>
            <div className="metric-label">Peak RPS</div>
          </div>
          <div className={`metric-card ${(summary.droppedRequests ?? 0) > 0 ? 'error' : 'success'}`}>
            <div className="metric-value">{summary.droppedRequests ?? 0}</div>
            <div className="metric-label">Dropped Requests <span className="metric-info" data-tooltip="Requests dropped because all in-flight slots were occupied (backpressure)">ⓘ</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
