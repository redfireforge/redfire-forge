import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  filterGrpcSchemaDiffChangesForUi,
  presentGrpcAdvancedOperationStatus,
  schemaDiffChangeLineClass,
  schemaDiffSeverityBadgeClass,
} from '../utils/grpcStudioAdvancedModel';

export interface GrpcSchemaDiffPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

export function GrpcSchemaDiffPanel({ advanced }: GrpcSchemaDiffPanelProps) {
  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.schemaDiff.status,
    advanced.runtime.schemaDiff.cancellationRequested,
  );
  const report = advanced.schemaDiff.lastReport;
  const filtered = report
    ? filterGrpcSchemaDiffChangesForUi(report.changes, advanced.schemaDiff.severityFilter)
    : undefined;

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-schema-diff-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Proto schema diff</h2>
          <p className="grpc-advanced-card__subtitle">
            Compare a captured baseline against the active tab descriptor.
          </p>
        </div>
        <div className="grpc-advanced-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="grpc-schema-diff-capture-baseline"
            onClick={advanced.captureSchemaBaseline}
          >
            Capture baseline
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="grpc-schema-diff-compare-btn"
            onClick={advanced.runSchemaDiff}
          >
            Compare
          </button>
        </div>
      </header>

      <div className="grpc-advanced-card grpc-advanced-card__body">
        <div className="grpc-advanced-chip-row">
          <span className="grpc-advanced-chip" data-testid="grpc-schema-diff-baseline-key">
            Baseline: {advanced.schemaDiff.baselineDescriptor?.key ?? 'not captured'}
          </span>
          {advanced.schemaDiff.baselineCapturedAt && (
            <span className="grpc-advanced-chip">
              Captured: {new Date(advanced.schemaDiff.baselineCapturedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="grpc-advanced-form-grid grpc-advanced-form-grid--two">
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Severity filter</span>
            <select
              className="grpc-advanced-select"
              data-testid="grpc-schema-diff-severity-filter"
              value={advanced.schemaDiff.severityFilter}
              onChange={(event) => {
                advanced.setSchemaDiffSeverityFilter(event.target.value as typeof advanced.schemaDiff.severityFilter);
              }}
            >
              <option value="all">All</option>
              <option value="breaking">Breaking</option>
              <option value="non_breaking">Non-breaking</option>
              <option value="informational">Informational</option>
            </select>
          </label>
        </div>

        <div className="grpc-advanced-card__actions">
          {advanced.schemaDiff.baselineDescriptor && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-schema-diff-clear-baseline"
              onClick={advanced.clearSchemaBaseline}
            >
              Clear baseline
            </button>
          )}
        </div>

        <div
          className={`grpc-advanced-status grpc-advanced-status--${status.variant}`}
          data-testid="grpc-schema-diff-status"
        >
          Status: {status.label}
          {advanced.runtime.schemaDiff.error?.message && (
            <span className="grpc-advanced-status__detail"> — {advanced.runtime.schemaDiff.error.message}</span>
          )}
        </div>

        {advanced.advancedExportError && (
          <p
            className="grpc-advanced-hint grpc-advanced-hint--error"
            data-testid="grpc-schema-diff-export-error"
          >
            {advanced.advancedExportError}
          </p>
        )}
      </div>

      {report && (
        <div className="grpc-advanced-card" data-testid="grpc-schema-diff-results">
          <div className="grpc-advanced-card__header">
            <h3 className="grpc-advanced-card__title">Diff report</h3>
            <div className="grpc-advanced-card__actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-schema-diff-export-json"
                onClick={() => {
                  const text = advanced.exportSchemaDiffJson();
                  if (text) void navigator.clipboard.writeText(text);
                }}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-schema-diff-export-markdown"
                onClick={() => {
                  const text = advanced.exportSchemaDiffMarkdown();
                  if (text) void navigator.clipboard.writeText(text);
                }}
              >
                Copy Markdown
              </button>
            </div>
          </div>
          <div className="grpc-advanced-card__body">
            <div className="grpc-advanced-metrics-grid" data-testid="grpc-schema-diff-summary">
              <div className="grpc-advanced-metric grpc-advanced-metric--err">
                <div className="grpc-advanced-metric__label">Breaking</div>
                <div className="grpc-advanced-metric__value">{report.summary.breaking}</div>
              </div>
              <div className="grpc-advanced-metric grpc-advanced-metric--ok">
                <div className="grpc-advanced-metric__label">Non-breaking</div>
                <div className="grpc-advanced-metric__value">{report.summary.nonBreaking}</div>
              </div>
              <div className="grpc-advanced-metric">
                <div className="grpc-advanced-metric__label">Informational</div>
                <div className="grpc-advanced-metric__value">{report.summary.informational}</div>
              </div>
            </div>

            {filtered && (
              <>
                {filtered.truncated && (
                  <p className="grpc-advanced-hint" data-testid="grpc-schema-diff-truncated">
                    Showing first {filtered.visible.length} of {filtered.total} changes.
                  </p>
                )}
                <div className="grpc-advanced-diff-list" data-testid="grpc-schema-diff-change-list">
                  {filtered.visible.map((change) => (
                    <div
                      key={`${change.entityPath}:${change.changeType}:${change.description}`}
                      className={`grpc-advanced-diff-line ${schemaDiffChangeLineClass(change.changeType)}`}
                      data-testid="grpc-schema-diff-change-row"
                    >
                      <span className="grpc-advanced-diff-path">{change.entityPath}</span>
                      <span className="grpc-advanced-diff-desc">{change.description}</span>
                      <span className={`grpc-advanced-diff-badge ${schemaDiffSeverityBadgeClass(change.severity)}`}>
                        {change.severity.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                  {filtered.visible.length === 0 && (
                    <p className="grpc-advanced-hint">No changes match the selected filter.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
