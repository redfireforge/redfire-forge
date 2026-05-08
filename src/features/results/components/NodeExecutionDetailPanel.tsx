import { useMemo, useState } from 'react';
import type { ExecutionEvent, WorkflowIterationTrace } from '../../../shared/types';
import { formatDurationMs } from '../../../shared/utils/formatDuration';

type StatusFilter = 'all' | 'pass' | 'fail' | 'skipped';

interface Props {
  nodeId: string;
  nodeLabel: string;
  iterations: WorkflowIterationTrace[];
  selectedIteration?: number;
  onClose: () => void;
  onIterationClick?: (iterationIndex: number) => void;
}

function getStatusBadge(state: 'pass' | 'fail' | 'skipped') {
  const colors = { pass: '#22c55e', fail: '#ef4444', skipped: '#64748b' };
  const labels = { pass: 'Passed', fail: 'Failed', skipped: 'Skipped' };
  return (
    <span style={{ color: colors[state], fontWeight: 600, fontSize: '0.9em' }}>
      {state === 'pass' ? '✓' : state === 'fail' ? '✗' : '○'} {labels[state]}
    </span>
  );
}

export default function NodeExecutionDetailPanel({
  nodeId,
  nodeLabel,
  iterations,
  selectedIteration,
  onClose,
  onIterationClick,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Get events for this node, preserving iteration context
  const nodeEvents = useMemo(() => {
    if (selectedIteration !== undefined) {
      const iter = iterations[selectedIteration];
      if (!iter) return [];
      return iter.events.filter(e => e.nodeId === nodeId);
    }
    return iterations.flatMap(iter => iter.events.filter(e => e.nodeId === nodeId));
  }, [iterations, nodeId, selectedIteration]);

  // Per-iteration summary: one entry per iteration with this node's duration
  const perIterationSummary = useMemo(() => {
    return iterations.map((iter, iterIndex) => {
      const nodeEventsInIter = iter.events.filter(e => e.nodeId === nodeId);
      if (nodeEventsInIter.length === 0) {
        return { iterIndex, state: 'skipped' as const, durationMs: undefined };
      }
      // If multiple events for same node in one iteration, sum the durations
      const totalDuration = nodeEventsInIter.reduce((sum, e) => sum + (e.durationMs || 0), 0);
      // Use worst state (fail > pass > skipped)
      const hasFailure = nodeEventsInIter.some(e => e.state === 'fail');
      const hasPass = nodeEventsInIter.some(e => e.state === 'pass');
      const state = hasFailure ? 'fail' : hasPass ? 'pass' : 'skipped';
      return { iterIndex, state, durationMs: totalDuration };
    });
  }, [iterations, nodeId]);

  const aggregateStats = useMemo(() => {
    if (nodeEvents.length === 0) return null;

    const durations = nodeEvents.filter(e => e.durationMs !== undefined).map(e => e.durationMs!);
    const passCount = nodeEvents.filter(e => e.state === 'pass').length;
    const failCount = nodeEvents.filter(e => e.state === 'fail').length;
    const skippedCount = nodeEvents.filter(e => e.state === 'skipped').length;

    return {
      totalExecutions: nodeEvents.length,
      passRate: nodeEvents.length > 0 ? (passCount / nodeEvents.length) * 100 : 0,
      passCount,
      failCount,
      skippedCount,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined,
      minDuration: durations.length > 0 ? Math.min(...durations) : undefined,
      maxDuration: durations.length > 0 ? Math.max(...durations) : undefined,
      p95Duration: durations.length > 0 ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] : undefined,
    };
  }, [nodeEvents]);

  // Filtered per-iteration summaries for the breakdown list
  const filteredIterations = useMemo(() => {
    const executed = perIterationSummary.filter(s => s.state !== 'skipped' || s.durationMs !== undefined);
    if (statusFilter === 'all') return executed;
    return executed.filter(s => s.state === statusFilter);
  }, [perIterationSummary, statusFilter]);

  const latestEvent = nodeEvents[nodeEvents.length - 1];
  const nodeType = latestEvent?.nodeType || 'unknown';

  function renderTypeSpecificDetails(event: ExecutionEvent) {
    const d = event.details;
    if (!d) return null;

    return (
      <div className="node-detail-http">
        {d.method && d.url && (
          <div className="node-detail-row">
            <span className="node-detail-label">Request</span>
            <span className="node-detail-value">{d.method} {d.url}</span>
          </div>
        )}
        {d.statusCode !== undefined && (
          <div className="node-detail-row">
            <span className="node-detail-label">Status</span>
            <span className="node-detail-value" style={{ color: d.statusCode < 400 ? '#22c55e' : '#ef4444' }}>
              {d.statusCode}
            </span>
          </div>
        )}
        {d.responseTimeMs !== undefined && (
          <div className="node-detail-row">
            <span className="node-detail-label">Response Time</span>
            <span className="node-detail-value">{formatDurationMs(d.responseTimeMs)}</span>
          </div>
        )}
        {d.error && (
          <div className="node-detail-row node-detail-error">
            <span className="node-detail-label">Error</span>
            <span className="node-detail-value">{d.error}</span>
          </div>
        )}
        {d.errorStack && (
          <details className="node-detail-stack">
            <summary>Stack trace</summary>
            <pre>{d.errorStack}</pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="node-detail-panel">
      <div className="node-detail-header">
        <div className="node-detail-title">
          <span className="node-detail-type">{nodeType}</span>
          <h3>{nodeLabel}</h3>
        </div>
        <button className="node-detail-close" onClick={onClose} title="Close (Escape)">✕</button>
      </div>

      <div className="node-detail-body">
        {/* Status overview - redesigned */}
        {aggregateStats && (
          <section className="node-detail-section node-detail-overview">
            {/* Hero stats row */}
            <div className="node-detail-hero">
              <div className="node-detail-hero-stat">
                <span className="node-detail-hero-value" style={{ color: aggregateStats.passRate === 100 ? '#22c55e' : aggregateStats.passRate === 0 ? '#ef4444' : '#f59e0b' }}>
                  {aggregateStats.passRate.toFixed(0)}%
                </span>
                <span className="node-detail-hero-label">Pass Rate</span>
              </div>
              <div className="node-detail-hero-divider" />
              <div className="node-detail-hero-stat">
                <span className="node-detail-hero-value">{aggregateStats.totalExecutions}</span>
                <span className="node-detail-hero-label">Executions</span>
              </div>
              <div className="node-detail-hero-divider" />
              <div className="node-detail-hero-stat">
                <span className="node-detail-hero-value">{formatDurationMs(aggregateStats.avgDuration)}</span>
                <span className="node-detail-hero-label">Avg Duration</span>
              </div>
            </div>

            {/* Status breakdown bar */}
            {aggregateStats.totalExecutions > 0 && (
              <div className="node-detail-status-bar-container">
                <div className="node-detail-status-bar">
                  {aggregateStats.passCount > 0 && (
                    <div
                      className="node-detail-status-segment pass"
                      style={{ width: `${(aggregateStats.passCount / aggregateStats.totalExecutions) * 100}%` }}
                      title={`${aggregateStats.passCount} passed`}
                    />
                  )}
                  {aggregateStats.failCount > 0 && (
                    <div
                      className="node-detail-status-segment fail"
                      style={{ width: `${(aggregateStats.failCount / aggregateStats.totalExecutions) * 100}%` }}
                      title={`${aggregateStats.failCount} failed`}
                    />
                  )}
                  {aggregateStats.skippedCount > 0 && (
                    <div
                      className="node-detail-status-segment skipped"
                      style={{ width: `${(aggregateStats.skippedCount / aggregateStats.totalExecutions) * 100}%` }}
                      title={`${aggregateStats.skippedCount} skipped`}
                    />
                  )}
                </div>
                <div className="node-detail-status-legend">
                  {aggregateStats.passCount > 0 && <span className="legend-pass">✓ {aggregateStats.passCount}</span>}
                  {aggregateStats.failCount > 0 && <span className="legend-fail">✗ {aggregateStats.failCount}</span>}
                  {aggregateStats.skippedCount > 0 && <span className="legend-skipped">○ {aggregateStats.skippedCount}</span>}
                </div>
              </div>
            )}

            {/* Timing stats (when multiple executions) */}
            {aggregateStats.totalExecutions > 1 && aggregateStats.avgDuration !== undefined && (
              <div className="node-detail-timing">
                <div className="node-detail-timing-stat">
                  <span className="node-detail-timing-label">Min</span>
                  <span className="node-detail-timing-value">{formatDurationMs(aggregateStats.minDuration)}</span>
                </div>
                <div className="node-detail-timing-stat">
                  <span className="node-detail-timing-label">Max</span>
                  <span className="node-detail-timing-value">{formatDurationMs(aggregateStats.maxDuration)}</span>
                </div>
                <div className="node-detail-timing-stat">
                  <span className="node-detail-timing-label">P95</span>
                  <span className="node-detail-timing-value">{formatDurationMs(aggregateStats.p95Duration)}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Type-specific details */}
        {latestEvent?.details && (
          <section className="node-detail-section">
            <h4>Details</h4>
            {renderTypeSpecificDetails(latestEvent)}
          </section>
        )}

        {/* Per-iteration breakdown - show only in aggregate view and when multiple iterations exist */}
        {selectedIteration === undefined && perIterationSummary.length > 1 && (
          <section className="node-detail-section">
            <div className="node-detail-section-header">
              <h4>Per-Iteration Breakdown</h4>
              <div className="node-detail-filter">
                {(() => {
                  const executed = perIterationSummary.filter(s => s.state !== 'skipped' || s.durationMs !== undefined);
                  const passCount = executed.filter(s => s.state === 'pass').length;
                  const failCount = executed.filter(s => s.state === 'fail').length;
                  const skippedCount = executed.filter(s => s.state === 'skipped').length;
                  return (
                    <>
                      <button
                        className={`node-detail-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                      >
                        All ({executed.length})
                      </button>
                      {passCount > 0 && (
                        <button
                          className={`node-detail-filter-btn node-detail-filter-pass ${statusFilter === 'pass' ? 'active' : ''}`}
                          onClick={() => setStatusFilter('pass')}
                        >
                          ✓ {passCount}
                        </button>
                      )}
                      {failCount > 0 && (
                        <button
                          className={`node-detail-filter-btn node-detail-filter-fail ${statusFilter === 'fail' ? 'active' : ''}`}
                          onClick={() => setStatusFilter('fail')}
                        >
                          ✗ {failCount}
                        </button>
                      )}
                      {skippedCount > 0 && (
                        <button
                          className={`node-detail-filter-btn node-detail-filter-skipped ${statusFilter === 'skipped' ? 'active' : ''}`}
                          onClick={() => setStatusFilter('skipped')}
                        >
                          ○ {skippedCount}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="node-detail-iteration-list">
              {filteredIterations.length === 0 ? (
                <div className="node-detail-empty">No iterations match this filter</div>
              ) : (
                filteredIterations.map((summary) => {
                  const isClickable = onIterationClick !== undefined;
                  return (
                    <div
                      key={summary.iterIndex}
                      className={`node-detail-iteration-row ${isClickable ? 'clickable' : ''}`}
                      onClick={isClickable ? () => onIterationClick(summary.iterIndex) : undefined}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                    >
                      <span className="node-detail-iter-num">#{summary.iterIndex + 1}</span>
                      {getStatusBadge(summary.state)}
                      <span className="node-detail-iter-duration">{formatDurationMs(summary.durationMs)}</span>
                      {isClickable && <span className="node-detail-iter-arrow">→</span>}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* No events message */}
        {nodeEvents.length === 0 && (
          <section className="node-detail-section">
            <div className="node-detail-empty">
              This node was not executed in {selectedIteration !== undefined ? 'this iteration' : 'any iteration'}.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
