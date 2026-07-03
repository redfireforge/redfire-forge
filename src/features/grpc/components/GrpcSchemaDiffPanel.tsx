import { useMemo, useState } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  filterGrpcSchemaDiffChangesForUi,
  presentGrpcAdvancedOperationStatus,
  schemaDiffChangeLineClass,
  schemaDiffSeverityBadgeClass,
} from '../utils/grpcStudioAdvancedModel';
import { grpcSchemaDiffChangeId } from '../utils/grpcSchemaDiffAck';

export interface GrpcSchemaDiffPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

const SCHEMA_DIFF_VIRTUALIZATION_THRESHOLD = 120;
const SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT = 34;
const SCHEMA_DIFF_VIRTUAL_VIEWPORT_HEIGHT = 320;
const SCHEMA_DIFF_VIRTUAL_OVERSCAN_ROWS = 8;

export function GrpcSchemaDiffPanel({ advanced }: GrpcSchemaDiffPanelProps) {
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.schemaDiff.status,
    advanced.runtime.schemaDiff.cancellationRequested,
  );
  const report = advanced.schemaDiff.lastReport;
  const filtered = report
    ? filterGrpcSchemaDiffChangesForUi(report.changes, advanced.schemaDiff.severityFilter, {
      hideAcknowledged: advanced.schemaDiff.hideAcknowledged ?? false,
      acknowledgedChangeIds: advanced.schemaDiffAckChangeIds ?? new Set<string>(),
      resolveChangeId: grpcSchemaDiffChangeId,
    })
    : undefined;

  const virtual = useMemo(() => {
    const count = filtered?.visible.length ?? 0;
    if (count <= SCHEMA_DIFF_VIRTUALIZATION_THRESHOLD) {
      return {
        enabled: false as const,
        startIndex: 0,
        endIndex: count,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const visibleRows = Math.max(1, Math.ceil(SCHEMA_DIFF_VIRTUAL_VIEWPORT_HEIGHT / SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT));
    const maxFirstVisible = Math.max(0, count - 1);
    const firstVisible = Math.min(
      maxFirstVisible,
      Math.floor(virtualScrollTop / SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT),
    );
    const startIndex = Math.max(0, firstVisible - SCHEMA_DIFF_VIRTUAL_OVERSCAN_ROWS);
    const endIndex = Math.min(count, firstVisible + visibleRows + SCHEMA_DIFF_VIRTUAL_OVERSCAN_ROWS);
    const topPadding = startIndex * SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT;
    const bottomPadding = Math.max(0, (count - endIndex) * SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT);

    return {
      enabled: true as const,
      startIndex,
      endIndex,
      topPadding,
      bottomPadding,
    };
  }, [filtered?.visible.length, virtualScrollTop]);

  const changesForRender = filtered?.visible.slice(virtual.startIndex, virtual.endIndex) ?? [];

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
          <label className="grpc-advanced-field grpc-advanced-field--inline">
            <span className="grpc-advanced-field__label">Hide acknowledged</span>
            <input
              type="checkbox"
              data-testid="grpc-schema-diff-hide-acknowledged"
              checked={advanced.schemaDiff.hideAcknowledged ?? false}
              onChange={(event) => advanced.setSchemaDiffHideAcknowledged(event.target.checked)}
            />
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
          role="status"
          aria-live="polite"
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
                <p className="visually-hidden" id="grpc-schema-diff-change-list-summary" data-testid="grpc-schema-diff-a11y-summary">
                  Schema diff contains {filtered.total} changes; {filtered.visible.length} visible after filtering.
                </p>
                {filtered.truncated && (
                  <p className="grpc-advanced-hint" data-testid="grpc-schema-diff-truncated">
                    Showing first {filtered.visible.length} of {filtered.total} changes.
                  </p>
                )}
                <div
                  className={`grpc-advanced-diff-list${virtual.enabled ? ' grpc-advanced-diff-list--virtual' : ''}`}
                  data-testid="grpc-schema-diff-change-list"
                  role="list"
                  aria-label="Schema diff changes"
                  aria-describedby="grpc-schema-diff-change-list-summary"
                  onScroll={(event) => {
                    if (virtual.enabled) {
                      setVirtualScrollTop((event.currentTarget as HTMLDivElement).scrollTop);
                    }
                  }}
                >
                  {virtual.enabled && (
                    <div
                      className="grpc-advanced-diff-virtual-spacer"
                      style={{ height: virtual.topPadding }}
                      aria-hidden="true"
                    />
                  )}
                  {changesForRender.map((change, index) => {
                    const changeId = grpcSchemaDiffChangeId(change);
                    const acknowledged = advanced.isSchemaDiffChangeAcknowledged?.(change) ?? false;
                    return (
                    <div
                      key={`${changeId}:${virtual.startIndex + index}`}
                      className={`grpc-advanced-diff-line ${schemaDiffChangeLineClass(change.changeType)}${acknowledged ? ' grpc-advanced-diff-line--acked' : ''}`}
                      data-testid="grpc-schema-diff-change-row"
                      data-change-id={changeId}
                      role="listitem"
                      tabIndex={0}
                    >
                      <span className="grpc-advanced-diff-path">{change.entityPath}</span>
                      <span className="grpc-advanced-diff-desc">{change.description}</span>
                      <span className={`grpc-advanced-diff-badge ${schemaDiffSeverityBadgeClass(change.severity)}`}>
                        {change.severity.replace(/_/g, ' ')}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        data-testid="grpc-schema-diff-ack-btn"
                        onClick={() => {
                          if (acknowledged) {
                            void advanced.unacknowledgeSchemaDiffChange(change);
                          } else {
                            void advanced.acknowledgeSchemaDiffChange(change);
                          }
                        }}
                      >
                        {acknowledged ? 'Unacknowledge' : 'Acknowledge'}
                      </button>
                    </div>
                    );
                  })}
                  {virtual.enabled && (
                    <div
                      className="grpc-advanced-diff-virtual-spacer"
                      style={{ height: virtual.bottomPadding }}
                      aria-hidden="true"
                    />
                  )}
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
