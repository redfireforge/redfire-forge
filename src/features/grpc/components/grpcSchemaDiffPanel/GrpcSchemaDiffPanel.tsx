import { useMemo, useState, useCallback } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';
import type {
  GrpcSchemaDiffChange,
  GrpcSchemaDiffSeverity,
} from '../../../../shared/grpc/grpcSchemaDiffContracts';
import {
  filterGrpcSchemaDiffChangesForUi,
  presentGrpcAdvancedOperationStatus,
  schemaDiffSeverityBadgeClass,
} from '../../utils/grpcStudioAdvancedModel';
import { grpcSchemaDiffChangeId } from '../../utils/grpcSchemaDiffAck';
import {
  buildChangeSnippet,
  formatChangeAction,
  formatDescriptorKey,
  getChangeImpact,
  groupChangesByParent,
} from './grpcSchemaDiffPanelUtils';
import { ProtoViewModal } from './ProtoViewModal';

export interface GrpcSchemaDiffPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

const SCHEMA_DIFF_VIRTUALIZATION_THRESHOLD = 120;
const SCHEMA_DIFF_VIRTUAL_ROW_HEIGHT = 34;
const SCHEMA_DIFF_VIRTUAL_VIEWPORT_HEIGHT = 320;
const SCHEMA_DIFF_VIRTUAL_OVERSCAN_ROWS = 8;

export function GrpcSchemaDiffPanel({ advanced }: GrpcSchemaDiffPanelProps) {
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [protoViewEntity, setProtoViewEntity] = useState<string | null>(null);

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

  const groups = useMemo(
    () => (!virtual.enabled && filtered ? groupChangesByParent(filtered.visible) : null),
    [virtual.enabled, filtered],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedChangeId((prev) => (prev === id ? null : id));
  }, []);

  const handleSummaryCardClick = useCallback(
    (severity: GrpcSchemaDiffSeverity) => {
      advanced.setSchemaDiffSeverityFilter(
        advanced.schemaDiff.severityFilter === severity ? 'all' : severity,
      );
    },
    [advanced],
  );

  function renderChangeRow(change: GrpcSchemaDiffChange, index: number) {
    const changeId = grpcSchemaDiffChangeId(change);
    const acknowledged = advanced.isSchemaDiffChangeAcknowledged?.(change) ?? false;
    const isExpanded = !virtual.enabled && expandedChangeId === changeId;
    const impact = isExpanded ? getChangeImpact(change) : null;
    const snippet = isExpanded ? buildChangeSnippet(change) : null;

    return (
      <div
        key={`${changeId}:${virtual.startIndex + index}`}
        className={`grpc-sdiff-row grpc-sdiff-row--${change.severity} grpc-sdiff-row--${change.changeType}${acknowledged ? ' grpc-sdiff-row--acked' : ''}${isExpanded ? ' grpc-sdiff-row--open' : ''}`}
        data-testid="grpc-schema-diff-change-row"
        data-change-id={changeId}
        role="listitem"
      >
        <div className="grpc-sdiff-row__cell grpc-sdiff-row__cell--change">
          <span className="grpc-sdiff-row__action">{formatChangeAction(change)}</span>
          <span className="grpc-sdiff-row__change-desc">{change.description}</span>
        </div>
        <div className="grpc-sdiff-row__cell grpc-sdiff-row__cell--path">
          <span className="grpc-sdiff-row__path">{change.entityPath}</span>
        </div>
        <div className="grpc-sdiff-row__cell grpc-sdiff-row__cell--severity">
          <span className={`grpc-advanced-diff-badge ${schemaDiffSeverityBadgeClass(change.severity)}`}>
            {change.severity.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="grpc-sdiff-row__cell grpc-sdiff-row__cell--actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm grpc-sdiff-ack-btn"
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
          {!virtual.enabled && (
            <button
              type="button"
              className={`grpc-sdiff-expand-btn${isExpanded ? ' grpc-sdiff-expand-btn--open' : ''}`}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse change details' : 'Expand change details'}
              onClick={() => toggleExpand(changeId)}
            >
              {isExpanded ? '\u25B2' : '\u25BC'}
            </button>
          )}
        </div>
        {isExpanded && impact && (
          <div className="grpc-sdiff-detail">
            <div className={`grpc-sdiff-impact grpc-sdiff-impact--${change.severity}`}>
              <span className="grpc-sdiff-impact__icon" aria-hidden="true">{impact.icon}</span>
              <div>
                <div className="grpc-sdiff-impact__title">{impact.title}</div>
                <div className="grpc-sdiff-impact__body">{impact.body}</div>
              </div>
            </div>
            <p className="grpc-sdiff-detail__desc">{change.description}</p>
            {snippet && (
              <div className="grpc-sdiff-snippet">
                <div className="grpc-sdiff-snippet__pane grpc-sdiff-snippet__pane--before">
                  <div className="grpc-sdiff-snippet__label">Baseline</div>
                  <pre className="grpc-sdiff-snippet__code">{snippet.before}</pre>
                </div>
                <div className="grpc-sdiff-snippet__pane grpc-sdiff-snippet__pane--after">
                  <div className="grpc-sdiff-snippet__label">Current</div>
                  <pre className="grpc-sdiff-snippet__code">{snippet.after}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-schema-diff-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Proto schema diff</h2>
          <p className="grpc-advanced-card__subtitle">
            Capture a baseline descriptor, then click Compare to detect breaking changes.
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
        <div className="grpc-sdiff-identity">
          <div className="grpc-sdiff-identity__side grpc-sdiff-identity__side--before">
            <span className="grpc-sdiff-identity__label">Baseline</span>
            <span
              className="grpc-sdiff-identity__key"
              data-testid="grpc-schema-diff-baseline-key"
              title={advanced.schemaDiff.baselineDescriptor?.key ?? 'not captured'}
            >
              Baseline: {report
                ? formatDescriptorKey(report.leftDescriptorKey)
                : (advanced.schemaDiff.baselineDescriptor?.key
                    ? formatDescriptorKey(advanced.schemaDiff.baselineDescriptor.key)
                    : 'not captured')}
            </span>
            {advanced.schemaDiff.baselineCapturedAt && (
              <span className="grpc-sdiff-identity__ts">
                Captured: {new Date(advanced.schemaDiff.baselineCapturedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="grpc-sdiff-identity__arrow" aria-hidden="true">→</div>
          <div className="grpc-sdiff-identity__side grpc-sdiff-identity__side--after">
            <span className="grpc-sdiff-identity__label">Current</span>
            <span className="grpc-sdiff-identity__key">
              {report ? formatDescriptorKey(report.rightDescriptorKey) : 'Active descriptor'}
            </span>
            <span className="grpc-sdiff-identity__ts">
              {report ? `Compared: ${new Date(report.generatedAt).toLocaleString()}` : 'Not yet compared'}
            </span>
          </div>
        </div>

        <div className="grpc-sdiff-controls">
          <label className="grpc-advanced-field grpc-advanced-field--inline">
            <span className="grpc-advanced-field__label">Filter</span>
            <select
              className="grpc-advanced-select"
              data-testid="grpc-schema-diff-severity-filter"
              value={advanced.schemaDiff.severityFilter}
              onChange={(event) => {
                advanced.setSchemaDiffSeverityFilter(
                  event.target.value as typeof advanced.schemaDiff.severityFilter,
                );
              }}
            >
              <option value="all">All severities</option>
              <option value="breaking">Breaking only</option>
              <option value="non_breaking">Non-breaking only</option>
              <option value="informational">Informational only</option>
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
          {advanced.schemaDiff.baselineDescriptor && (
            <button
              type="button"
              className="btn btn-ghost btn-sm grpc-sdiff-controls__clear"
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
            <span className="grpc-advanced-status__detail">
              {' '}— {advanced.runtime.schemaDiff.error.message}
            </span>
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
            <div className="grpc-sdiff-summary-cards" data-testid="grpc-schema-diff-summary">
              <button
                type="button"
                className={`grpc-sdiff-card grpc-sdiff-card--breaking${advanced.schemaDiff.severityFilter === 'breaking' ? ' grpc-sdiff-card--active' : ''}`}
                onClick={() => handleSummaryCardClick('breaking')}
                title="Click to filter — breaking changes only"
              >
                <div className="grpc-sdiff-card__count">{report.summary.breaking}</div>
                <div className="grpc-sdiff-card__label">Breaking</div>
                <div className="grpc-sdiff-card__sub">client impact</div>
              </button>
              <button
                type="button"
                className={`grpc-sdiff-card grpc-sdiff-card--safe${advanced.schemaDiff.severityFilter === 'non_breaking' ? ' grpc-sdiff-card--active' : ''}`}
                onClick={() => handleSummaryCardClick('non_breaking')}
                title="Click to filter — non-breaking changes only"
              >
                <div className="grpc-sdiff-card__count">{report.summary.nonBreaking}</div>
                <div className="grpc-sdiff-card__label">Non-breaking</div>
                <div className="grpc-sdiff-card__sub">compatible</div>
              </button>
              <button
                type="button"
                className={`grpc-sdiff-card grpc-sdiff-card--info${advanced.schemaDiff.severityFilter === 'informational' ? ' grpc-sdiff-card--active' : ''}`}
                onClick={() => handleSummaryCardClick('informational')}
                title="Click to filter — informational changes only"
              >
                <div className="grpc-sdiff-card__count">{report.summary.informational}</div>
                <div className="grpc-sdiff-card__label">Informational</div>
                <div className="grpc-sdiff-card__sub">safe metadata</div>
              </button>
            </div>

            {filtered && (
              <>
                <p
                  className="visually-hidden"
                  id="grpc-schema-diff-change-list-summary"
                  data-testid="grpc-schema-diff-a11y-summary"
                >
                  Schema diff contains {filtered.total} changes; {filtered.visible.length} visible after filtering.
                </p>
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
                  <div className="grpc-sdiff-table-head" aria-hidden="true">
                    <span className="grpc-sdiff-table-head__cell grpc-sdiff-table-head__cell--change">Change</span>
                    <span className="grpc-sdiff-table-head__cell grpc-sdiff-table-head__cell--path">Entity path</span>
                    <span className="grpc-sdiff-table-head__cell grpc-sdiff-table-head__cell--severity">Severity</span>
                    <span className="grpc-sdiff-table-head__cell grpc-sdiff-table-head__cell--actions">Actions</span>
                  </div>
                  {virtual.enabled ? (
                    <>
                      <div
                        className="grpc-advanced-diff-virtual-spacer"
                        style={{ height: virtual.topPadding }}
                        aria-hidden="true"
                      />
                      {changesForRender.map((change, index) => renderChangeRow(change, index))}
                      <div
                        className="grpc-advanced-diff-virtual-spacer"
                        style={{ height: virtual.bottomPadding }}
                        aria-hidden="true"
                      />
                    </>
                  ) : (
                    <>
                      {groups?.map((group) => (
                        <div key={group.key} className="grpc-sdiff-group">
                          {group.changes.some((c) => c.entityPath !== group.key) && (
                            <div className="grpc-sdiff-group__header">
                              <span className="grpc-sdiff-group__icon" aria-hidden="true">◈</span>
                              <button
                                type="button"
                                className="grpc-sdiff-group__label grpc-sdiff-group__label--btn"
                                title="View proto definition"
                                data-testid="grpc-sdiff-group-proto-btn"
                                onClick={() => setProtoViewEntity(group.key)}
                              >
                                <span className="grpc-sdiff-group__label-text">{group.label}</span>
                                <span
                                  className="grpc-sdiff-group__modal-badge"
                                  data-testid="grpc-sdiff-group-proto-badge"
                                >
                                  Proto diff
                                </span>
                                <span className="grpc-sdiff-group__view-icon" aria-hidden="true">{'{ }'}</span>
                              </button>
                              <span className="grpc-sdiff-group__count">{group.changes.length}</span>
                            </div>
                          )}
                          {group.changes.map((change, index) => renderChangeRow(change, index))}
                        </div>
                      ))}
                      {filtered.visible.length === 0 && (
                        <p className="grpc-advanced-hint">No changes match the selected filter.</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {protoViewEntity && (
        <ProtoViewModal
          entityPath={protoViewEntity}
          beforeDescriptor={advanced.schemaDiff.baselineDescriptor}
          afterDescriptor={advanced.activeDescriptor}
          relatedChanges={report?.changes ?? []}
          onClose={() => setProtoViewEntity(null)}
        />
      )}
    </section>
  );
}
