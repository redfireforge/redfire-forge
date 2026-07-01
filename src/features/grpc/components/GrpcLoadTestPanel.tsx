import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  formatLoadTestProgressLabel,
  presentGrpcAdvancedOperationStatus,
} from '../utils/grpcStudioAdvancedModel';

export interface GrpcLoadTestPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function GrpcLoadTestPanel({ advanced }: GrpcLoadTestPanelProps) {
  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.loadTest.status,
    advanced.runtime.loadTest.cancellationRequested,
  );
  const summary = advanced.loadTest.lastSummary;
  const config = advanced.loadTest.config;
  const live = advanced.loadTest.live;
  const canStart = !advanced.loadTestRunning;
  const canStop = advanced.loadTestRunning;

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-load-test-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Load test configuration</h2>
          <p className="grpc-advanced-card__subtitle">
            Tab: {advanced.activeTabLabel}
            {advanced.activeRpcLabel ? ` · ${advanced.activeRpcLabel}` : ''}
          </p>
        </div>
        <div className="grpc-advanced-card__actions">
          {canStart && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="grpc-load-test-start-btn"
              disabled={Boolean(advanced.loadTestValidationError)}
              title={advanced.loadTestValidationError}
              onClick={advanced.startLoadTest}
            >
              Start load test
            </button>
          )}
          {canStop && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              data-testid="grpc-load-test-stop-btn"
              onClick={advanced.cancelLoadTest}
            >
              Stop
            </button>
          )}
        </div>
      </header>

      <div className="grpc-advanced-card grpc-advanced-card__body">
        <div className="grpc-advanced-form-grid">
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Concurrency</span>
            <input
              type="number"
              min={1}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-concurrency"
              value={config.concurrency}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                const value = parsePositiveInt(event.target.value);
                if (value != null) advanced.patchLoadTestConfig({ concurrency: value });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Total requests</span>
            <input
              type="number"
              min={1}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-total-calls"
              value={config.totalCalls ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  totalCalls: parsePositiveInt(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Duration (ms)</span>
            <input
              type="number"
              min={1000}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-duration"
              value={config.durationMs ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  durationMs: parsePositiveInt(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Ramp-up (ms)</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-ramp-up"
              value={config.rampUpMs ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  rampUpMs: parseNonNegativeInt(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Warm-up calls</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-warmup"
              value={config.warmupCalls ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  warmupCalls: parseNonNegativeInt(event.target.value),
                });
              }}
            />
          </label>
        </div>

        {advanced.loadTestValidationError && (
          <p className="grpc-advanced-hint grpc-advanced-hint--error" data-testid="grpc-load-test-validation-error">
            {advanced.loadTestValidationError}
          </p>
        )}

        {advanced.advancedExportError && (
          <p
            className="grpc-advanced-hint grpc-advanced-hint--error"
            data-testid="grpc-load-test-export-error"
          >
            {advanced.advancedExportError}
          </p>
        )}

        <div
          className={`grpc-advanced-status grpc-advanced-status--${status.variant}`}
          data-testid="grpc-load-test-status"
        >
          Status: {status.label}
          {advanced.runtime.loadTest.error?.message && (
            <span className="grpc-advanced-status__detail"> — {advanced.runtime.loadTest.error.message}</span>
          )}
        </div>
      </div>

      {(live || summary) && (
        <div className="grpc-advanced-card" data-testid="grpc-load-test-results">
          <div className="grpc-advanced-card__header">
            <h3 className="grpc-advanced-card__title">Results</h3>
            {summary && !advanced.loadTestRunning && (
              <div className="grpc-advanced-card__actions">
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
                  data-testid="grpc-load-test-export-csv"
                  onClick={() => {
                    const text = advanced.exportLoadTestCsv();
                    if (text) void navigator.clipboard.writeText(text);
                  }}
                >
                  Copy CSV
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
              </>
            )}
            {summary && !live && (
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
            )}
          </div>
        </div>
      )}
    </section>
  );
}
