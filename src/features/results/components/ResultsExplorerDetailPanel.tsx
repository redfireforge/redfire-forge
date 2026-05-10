import { useMemo, useState } from 'react';
import type { ExecutionEvent, WorkflowIterationTrace, WorkflowExecutionTrace } from '../../../shared/types';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import { truncate } from '../../../shared/utils/helpers';
import { computeHistogramBins } from '../utils/responseTimeHistogram';
import { formatNodeTypeExplorer as formatNodeType } from '../utils/nodeTypeLabels';
import {
  computeBranchStats,
  BRANCH_COLORS,
  BRANCH_BORDER_COLORS,
  type ForkJoinPair,
  type ForkJoinTopology,
} from '../utils/forkJoinDetection';

type TabId = 'overview' | 'request' | 'response' | 'variables' | 'assertions';

interface Props {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  events: ExecutionEvent[];
  iterations: WorkflowIterationTrace[];
  selectedIteration?: number;
  onIterationChange: (iteration: number | undefined) => void;
  onClose: () => void;
  fullTraceCaptured?: boolean;
  /** Fork/join topology for branch comparison display */
  forkJoinTopology?: ForkJoinTopology;
  onDrillDown?: (childTrace: WorkflowExecutionTrace, parentNodeId: string) => void;
}

export default function ResultsExplorerDetailPanel({
  nodeId,
  nodeType,
  nodeLabel,
  events,
  iterations,
  selectedIteration,
  onIterationChange,
  onClose,
  fullTraceCaptured,
  forkJoinTopology,
  onDrillDown,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Get the event for the current view (selected iteration or latest)
  const currentEvent = useMemo(() => {
    if (events.length === 0) return null;
    if (selectedIteration !== undefined) {
      return events[0]; // Single iteration view
    }
    return events[events.length - 1]; // Latest event for aggregate
  }, [events, selectedIteration]);

  // Calculate aggregate stats
  const stats = useMemo(() => {
    if (events.length === 0) return null;
    
    const durations = events.filter(e => e.durationMs !== undefined).map(e => e.durationMs!);
    const passCount = events.filter(e => e.state === 'pass').length;
    const failCount = events.filter(e => e.state === 'fail').length;

    const waitDurations = events
      .filter(e => e.details?.waitDurationMs !== undefined)
      .map(e => e.details!.waitDurationMs!);

    const sorted = [...durations].sort((a, b) => a - b);
    const p95Duration = sorted.length > 0
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      : undefined;

    return {
      totalExecutions: events.length,
      passCount,
      failCount,
      passRate: events.length > 0 ? (passCount / events.length) * 100 : 0,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined,
      minDuration: durations.length > 0 ? Math.min(...durations) : undefined,
      maxDuration: durations.length > 0 ? Math.max(...durations) : undefined,
      p95Duration,
      durations,
      avgWaitDuration: waitDurations.length > 0 ? waitDurations.reduce((a, b) => a + b, 0) / waitDurations.length : undefined,
    };
  }, [events]);

  const isHttpNode = nodeType === 'http';
  const hasFullTrace = fullTraceCaptured && currentEvent?.details?.request;
  const hasWebhookInput = !!currentEvent?.details?.webhookInput;
  const hasVariables = !!(currentEvent?.details?.variablesSnapshot || currentEvent?.details?.extractedVariables || hasWebhookInput);
  const hasBasicRequest = !!(currentEvent?.details?.method && currentEvent?.details?.url);
  const hasBasicResponse = !!(currentEvent?.details?.statusCode !== undefined || currentEvent?.details?.error);

  return (
    <div className="explorer-detail-panel">
      {/* Header */}
      <div className="explorer-detail-header">
        <div className="explorer-detail-title-row">
          <span className="explorer-detail-type">{formatNodeType(nodeType)}</span>
          <button className="explorer-detail-close" onClick={onClose} title="Close (Escape)">✕</button>
        </div>
        <h3 className="explorer-detail-name">{nodeLabel}</h3>
        
        {/* Quick stats */}
        {stats && (
          <div className="explorer-detail-quick-stats">
            <span className={`quick-stat ${stats.passRate === 100 ? 'pass' : stats.passRate === 0 ? 'fail' : 'mixed'}`}>
              {stats.passRate.toFixed(0)}% pass
            </span>
            <span className="quick-stat">{stats.totalExecutions} exec</span>
            {stats.avgDuration !== undefined && (
              <span className="quick-stat">{formatDurationMs(stats.avgDuration)} avg</span>
            )}
          </div>
        )}

        {/* Iteration selector */}
        {iterations.length > 1 && (
          <div className="explorer-detail-iteration-select">
            <select
              value={selectedIteration === undefined ? 'all' : selectedIteration}
              onChange={(e) => {
                const val = e.target.value;
                onIterationChange(val === 'all' ? undefined : Number(val));
              }}
            >
              <option value="all">All Iterations (Aggregate)</option>
              {iterations.map((iter) => (
                <option key={iter.index} value={iter.index}>
                  #{iter.index + 1} — {iter.passed ? '✓' : '✗'} {formatDurationMs(iter.durationMs)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sub-workflow drill-down CTA */}
      {nodeType === 'subWorkflow' && currentEvent?.details?.subWorkflowTrace && onDrillDown && (
        <button
          type="button"
          className="sub-workflow-drilldown-btn"
          onClick={() => onDrillDown(currentEvent.details!.subWorkflowTrace!, nodeId)}
          data-testid="sub-workflow-drilldown-btn"
        >
          <span className="drilldown-icon">↳</span>
          View Sub-Workflow: {currentEvent.details.subWorkflowTrace.workflowName}
          <span className="drilldown-meta">
            {currentEvent.details.subWorkflowTrace.totalIterations} iter
            {currentEvent.details.subWorkflowTrace.totalIterations !== 1 ? 's' : ''}
            {' · '}
            {formatDurationMs(currentEvent.details.subWorkflowTrace.totalDurationMs)}
          </span>
        </button>
      )}
      {nodeType === 'subWorkflow' && currentEvent && !currentEvent.details?.subWorkflowTrace && (
        <div className="sub-workflow-no-trace" data-testid="sub-workflow-no-trace">
          <span className="drilldown-icon">↳</span>
          Sub-workflow trace not captured
          {currentEvent.details?.subWorkflowId && (
            <span className="drilldown-meta"> ({currentEvent.details.subWorkflowId})</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="explorer-detail-tabs">
        <button
          className={`explorer-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        {isHttpNode && (
          <>
            <button
              className={`explorer-tab ${activeTab === 'request' ? 'active' : ''}`}
              onClick={() => setActiveTab('request')}
              disabled={!hasFullTrace && !hasBasicRequest}
            >
              Request
            </button>
            <button
              className={`explorer-tab ${activeTab === 'response' ? 'active' : ''}`}
              onClick={() => setActiveTab('response')}
              disabled={!hasFullTrace && !hasBasicResponse}
            >
              Response
            </button>
          </>
        )}
        <button
          className={`explorer-tab ${activeTab === 'variables' ? 'active' : ''}`}
          onClick={() => setActiveTab('variables')}
          disabled={!hasVariables}
        >
          Variables
        </button>
        {isHttpNode && (
          <button
            className={`explorer-tab ${activeTab === 'assertions' ? 'active' : ''}`}
            onClick={() => setActiveTab('assertions')}
          >
            Assertions
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="explorer-detail-content">
        {activeTab === 'overview' && (
          <>
            <OverviewTab
              events={events}
              stats={stats}
              currentEvent={currentEvent}
              selectedIteration={selectedIteration}
              onIterationClick={(i) => onIterationChange(i)}
            />
            {(nodeType === 'fork' || nodeType === 'join') && forkJoinTopology && (
              <BranchComparisonSection
                nodeId={nodeId}
                nodeType={nodeType}
                topology={forkJoinTopology}
                iterations={iterations}
              />
            )}
          </>
        )}
        {activeTab === 'request' && currentEvent && (
          <RequestTab event={currentEvent} hasFullTrace={!!hasFullTrace} />
        )}
        {activeTab === 'response' && currentEvent && (
          <ResponseTab event={currentEvent} hasFullTrace={!!hasFullTrace} />
        )}
        {activeTab === 'variables' && currentEvent && (
          <VariablesTab event={currentEvent} hasFullTrace={!!hasVariables} />
        )}
        {activeTab === 'assertions' && currentEvent && (
          <AssertionsTab event={currentEvent} />
        )}
      </div>
    </div>
  );
}

// ─── Branch Comparison (Fork/Join) ───────────────────────────────────────────

interface BranchComparisonProps {
  nodeId: string;
  nodeType: string;
  topology: ForkJoinTopology;
  iterations: WorkflowIterationTrace[];
}

function BranchComparisonSection({ nodeId, nodeType, topology, iterations }: BranchComparisonProps) {
  const pair: ForkJoinPair | undefined = useMemo(() => {
    return topology.pairs.find(
      p => (nodeType === 'fork' && p.forkId === nodeId) ||
           (nodeType === 'join' && p.joinId === nodeId),
    );
  }, [topology.pairs, nodeId, nodeType]);

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const iter of iterations) {
      for (const ev of iter.events) {
        if (ev.nodeLabel && !map.has(ev.nodeId)) {
          map.set(ev.nodeId, ev.nodeLabel);
        }
      }
    }
    return map;
  }, [iterations]);

  const branchStats = useMemo(() => {
    if (!pair) return [];
    return computeBranchStats(pair, iterations, nodeLabelMap);
  }, [pair, iterations, nodeLabelMap]);

  if (!pair || branchStats.length === 0) return null;

  return (
    <div className="branch-comparison-section" data-testid="branch-comparison">
      <div className="branch-comparison-title">
        Parallel Branches
        <span className="branch-comparison-count">{branchStats.length} branches</span>
      </div>
      <table className="branch-comparison-table" data-testid="branch-comparison-table">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Nodes</th>
            <th>Avg Time</th>
            <th>Pass Rate</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {branchStats.map((stat) => {
            const colorIdx = stat.branchIndex % BRANCH_COLORS.length;
            return (
              <tr
                key={stat.branchIndex}
                className={stat.isCriticalPath ? 'branch-row-critical' : ''}
                data-testid={`branch-row-${stat.branchIndex}`}
              >
                <td>
                  <span
                    className="branch-color-dot"
                    style={{
                      background: BRANCH_BORDER_COLORS[colorIdx],
                    }}
                  />
                  {stat.label}
                </td>
                <td>{stat.nodeCount}</td>
                <td>{formatDurationMs(stat.totalDurationMs)}</td>
                <td>
                  <span
                    style={{ color: stat.passRate === 100 ? '#22c55e' : stat.passRate >= 80 ? '#f59e0b' : '#ef4444' }}
                  >
                    {stat.passRate.toFixed(0)}%
                  </span>
                </td>
                <td>
                  {stat.isCriticalPath && (
                    <span className="branch-critical-badge" data-testid="critical-path-badge">⏱ Critical</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  events: ExecutionEvent[];
  stats: {
    totalExecutions: number;
    passCount: number;
    failCount: number;
    passRate: number;
    avgDuration?: number;
    minDuration?: number;
    maxDuration?: number;
    p95Duration?: number;
    durations: number[];
    avgWaitDuration?: number;
  } | null;
  currentEvent: ExecutionEvent | null;
  selectedIteration?: number;
  onIterationClick: (iteration: number) => void;
}

function OverviewTab({ events, stats, currentEvent, selectedIteration, onIterationClick }: OverviewTabProps) {
  if (!stats) {
    return <div className="explorer-empty">No execution data available</div>;
  }

  return (
    <div className="explorer-overview">
      {/* Hero Stats */}
      <div className="explorer-hero-stats">
        <div className="hero-stat">
          <span className="hero-value" style={{ 
            color: stats.passRate === 100 ? '#22c55e' : stats.passRate === 0 ? '#ef4444' : '#f59e0b' 
          }}>
            {stats.passRate.toFixed(0)}%
          </span>
          <span className="hero-label">Pass Rate</span>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <span className="hero-value">{stats.totalExecutions}</span>
          <span className="hero-label">Executions</span>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <span className="hero-value">{formatDurationMs(stats.avgDuration)}</span>
          <span className="hero-label">Avg Duration</span>
        </div>
      </div>

      {/* Status Bar */}
      <div className="explorer-status-bar">
        {stats.passCount > 0 && (
          <div 
            className="status-segment pass" 
            style={{ width: `${(stats.passCount / stats.totalExecutions) * 100}%` }}
            title={`${stats.passCount} passed`}
          />
        )}
        {stats.failCount > 0 && (
          <div 
            className="status-segment fail" 
            style={{ width: `${(stats.failCount / stats.totalExecutions) * 100}%` }}
            title={`${stats.failCount} failed`}
          />
        )}
      </div>
      <div className="explorer-status-legend">
        {stats.passCount > 0 && <span className="legend-pass">✓ {stats.passCount}</span>}
        {stats.failCount > 0 && <span className="legend-fail">✗ {stats.failCount}</span>}
      </div>

      {/* Timing Stats */}
      {stats.avgDuration !== undefined && stats.totalExecutions > 1 && (
        <div className="explorer-timing-stats">
          <div className="timing-stat">
            <span className="timing-label">Min</span>
            <span className="timing-value">{formatDurationMs(stats.minDuration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">Avg</span>
            <span className="timing-value">{formatDurationMs(stats.avgDuration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">P95</span>
            <span className="timing-value">{formatDurationMs(stats.p95Duration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">Max</span>
            <span className="timing-value">{formatDurationMs(stats.maxDuration)}</span>
          </div>
        </div>
      )}

      {/* Mini Duration Histogram */}
      {selectedIteration === undefined && stats.durations.length >= 3 && (
        <MiniDurationHistogram
          durations={stats.durations}
          events={events}
          avgDuration={stats.avgDuration}
          p95Duration={stats.p95Duration}
        />
      )}

      {/* CorrelationWait split timing */}
      {stats.avgWaitDuration !== undefined && (
        <div className="explorer-timing-split">
          <h4>Timing Breakdown</h4>
          <div className="timing-split-bar">
            <div
              className="timing-split-segment wait"
              style={{ flex: stats.avgWaitDuration }}
              title={`Avg wait: ${formatDurationMs(stats.avgWaitDuration)}`}
            />
            <div
              className="timing-split-segment processing"
              style={{ flex: Math.max(0, (stats.avgDuration ?? 0) - stats.avgWaitDuration) }}
              title={`Avg processing: ${formatDurationMs((stats.avgDuration ?? 0) - stats.avgWaitDuration)}`}
            />
          </div>
          <div className="timing-split-legend">
            <span className="legend-wait">Wait for Event: {formatDurationMs(stats.avgWaitDuration)}</span>
            <span className="legend-processing">Processing: {formatDurationMs(Math.max(0, (stats.avgDuration ?? 0) - stats.avgWaitDuration))}</span>
          </div>
        </div>
      )}

      {/* Webhook Input (for webhook trigger nodes) */}
      {currentEvent && currentEvent.details?.webhookInput && (
        <div className="explorer-webhook-input">
          <h4>Webhook Input</h4>
          {currentEvent.details.webhookInput.method && currentEvent.details.webhookInput.path && (
            <div className="webhook-endpoint">
              <span className="webhook-method">{currentEvent.details.webhookInput.method}</span>
              <span className="webhook-path">{currentEvent.details.webhookInput.path}</span>
            </div>
          )}
          <div className="webhook-payload">
            <JsonTreeViewer data={currentEvent.details.webhookInput.payload} defaultExpandDepth={3} maxHeight={300} />
          </div>
        </div>
      )}

      {/* Current Event Details — Card Layout */}
      {currentEvent && currentEvent.details && (
        <div className="exec-card">
          <div className="exec-card-header">
            <span className="exec-card-title">Last Execution</span>
            {currentEvent.details.statusCode !== undefined && (
              <span className={`exec-status-badge ${currentEvent.details.statusCode < 400 ? 'success' : 'error'}`}>
                {currentEvent.details.statusCode}
              </span>
            )}
          </div>

          {currentEvent.details.method && currentEvent.details.url && (
            <div className="exec-endpoint">
              <span className="exec-method">{currentEvent.details.method}</span>
              <span className="exec-url">{currentEvent.details.url}</span>
            </div>
          )}

          {(currentEvent.durationMs !== undefined || currentEvent.details.responseTimeMs !== undefined) && (
            <div className="exec-timing-row">
              <div className="exec-timing-bar-track">
                <div
                  className={`exec-timing-bar-fill ${currentEvent.details.statusCode !== undefined && currentEvent.details.statusCode >= 400 ? 'error' : ''}`}
                  style={{ width: `${Math.min(100, ((currentEvent.durationMs ?? 0) / Math.max(stats?.maxDuration ?? 1, 1)) * 100)}%` }}
                />
              </div>
              <span className="exec-timing-label">{formatDurationMs(currentEvent.durationMs)}</span>
            </div>
          )}

          {currentEvent.details.error && (
            <div className="exec-error">
              <span className="exec-error-icon">!</span>
              <span className="exec-error-text">{currentEvent.details.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Per-Iteration List (in aggregate view) */}
      {selectedIteration === undefined && events.length > 1 && (
        <div className="explorer-iteration-list">
          <h4>Per-Iteration Breakdown</h4>
          <div className="iteration-list-scroll">
            {events.map((event, i) => (
              <div 
                key={i}
                className={`iteration-row ${event.state}`}
                onClick={() => onIterationClick(i)}
              >
                <span className="iteration-num">#{i + 1}</span>
                <span className={`iteration-status ${event.state}`}>
                  {event.state === 'pass' ? '✓' : event.state === 'fail' ? '✗' : '○'}
                </span>
                <span className="iteration-duration">{formatDurationMs(event.durationMs)}</span>
                <span className="iteration-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini Duration Histogram ──────────────────────────────────────────────────

interface MiniHistogramProps {
  durations: number[];
  events: ExecutionEvent[];
  avgDuration?: number;
  p95Duration?: number;
}

function MiniDurationHistogram({ durations, events, avgDuration, p95Duration }: MiniHistogramProps) {
  const bins = useMemo(() => computeHistogramBins(durations, 12), [durations]);
  const maxCount = useMemo(() => Math.max(...bins.map(b => b.count), 1), [bins]);

  const failDurations = useMemo(() => {
    return new Set(
      events.filter(e => e.state === 'fail' && e.durationMs !== undefined).map(e => e.durationMs!)
    );
  }, [events]);

  const binsWithFailRatio = useMemo(() => {
    if (failDurations.size === 0) return bins.map(b => ({ ...b, failCount: 0 }));
    return bins.map(bin => {
      let failCount = 0;
      for (const d of failDurations) {
        if (d >= bin.min && (d < bin.max || (bin === bins[bins.length - 1] && d <= bin.max))) {
          failCount++;
        }
      }
      return { ...bin, failCount };
    });
  }, [bins, failDurations]);

  if (bins.length === 0) return null;

  const rangeMin = bins[0].min;
  const rangeMax = bins[bins.length - 1].max;
  const rangeSpan = rangeMax - rangeMin || 1;

  const avgPct = avgDuration !== undefined ? ((avgDuration - rangeMin) / rangeSpan) * 100 : undefined;
  const p95Pct = p95Duration !== undefined ? ((p95Duration - rangeMin) / rangeSpan) * 100 : undefined;

  return (
    <div className="mini-histogram" data-testid="mini-histogram">
      <h4>Duration Distribution</h4>
      <div className="mini-histogram-chart">
        {binsWithFailRatio.map((bin, i) => {
          const heightPct = (bin.count / maxCount) * 100;
          const failPct = bin.count > 0 ? (bin.failCount / bin.count) * 100 : 0;
          return (
            <div
              key={i}
              className="mini-histogram-bar-wrap"
              title={`${formatDurationMs(bin.min)}–${formatDurationMs(bin.max)}: ${bin.count} exec (${bin.percent}%)${bin.failCount > 0 ? `, ${bin.failCount} failed` : ''}`}
            >
              <div className="mini-histogram-bar" style={{ height: `${heightPct}%` }}>
                {failPct > 0 && (
                  <div className="mini-histogram-bar-fail" style={{ height: `${failPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
        {avgPct !== undefined && avgPct >= 0 && avgPct <= 100 && (
          <div
            className="mini-histogram-marker avg"
            style={{ left: `${avgPct}%` }}
            title={`Avg: ${formatDurationMs(avgDuration)}`}
          />
        )}
        {p95Pct !== undefined && p95Pct >= 0 && p95Pct <= 100 && (
          <div
            className="mini-histogram-marker p95"
            style={{ left: `${p95Pct}%` }}
            title={`P95: ${formatDurationMs(p95Duration)}`}
          />
        )}
      </div>
      <div className="mini-histogram-x-axis">
        <span>{formatDurationMs(rangeMin)}</span>
        <span>{formatDurationMs(rangeMax)}</span>
      </div>
      <div className="mini-histogram-legend">
        <span className="mini-legend-item pass-legend">Pass</span>
        {failDurations.size > 0 && <span className="mini-legend-item fail-legend">Fail</span>}
        <span className="mini-legend-item avg-legend">Avg</span>
        <span className="mini-legend-item p95-legend">P95</span>
      </div>
    </div>
  );
}

// ─── Request Tab ──────────────────────────────────────────────────────────────

function RequestTab({ event, hasFullTrace }: { event: ExecutionEvent; hasFullTrace: boolean }) {
  const [showResolved, setShowResolved] = useState(true);

  const req = event.details?.request;
  const method = req?.method ?? event.details?.method;
  const url = req?.url ?? event.details?.url;

  if (!method && !url && !req) {
    return <div className="explorer-empty">No request data available</div>;
  }

  return (
    <div className="explorer-request">
      {(method || url) && (
        <div className="request-url">
          {method && <span className="request-method">{method}</span>}
          {url && <span className="request-url-text">{url}</span>}
        </div>
      )}

      {req?.headers && Object.keys(req.headers).length > 0 && (
        <div className="request-section">
          <h4>Headers</h4>
          <div className="headers-list">
            {Object.entries(req.headers).map(([key, value]) => (
              <div key={key} className="header-row">
                <span className="header-key">{key}:</span>
                <span className="header-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {req && (req.bodyTemplate || req.bodyResolved) && (
        <div className="request-section">
          <div className="section-header-with-toggle">
            <h4>Body</h4>
            {req.bodyTemplate && req.bodyResolved && req.bodyTemplate !== req.bodyResolved && (
              <button 
                className={`toggle-btn ${showResolved ? 'active' : ''}`}
                onClick={() => setShowResolved(!showResolved)}
              >
                {showResolved ? 'Show Template' : 'Show Resolved'}
              </button>
            )}
          </div>
          <JsonTreeViewer data={showResolved ? req.bodyResolved : req.bodyTemplate} defaultExpandDepth={3} maxHeight={400} />
        </div>
      )}

      {!hasFullTrace && (
        <div className="explorer-trace-hint">
          Enable <strong>Capture Full Trace</strong> to see headers and body.
        </div>
      )}
    </div>
  );
}

// ─── Response Tab ─────────────────────────────────────────────────────────────

function ResponseTab({ event, hasFullTrace }: { event: ExecutionEvent; hasFullTrace: boolean }) {
  const res = event.details?.response;
  const basicStatus = event.details?.statusCode;
  const hasError = !!event.details?.error;

  if (!res && basicStatus === undefined && !hasError) {
    return <div className="explorer-empty">No response data available</div>;
  }

  const statusCode = res?.statusCode ?? basicStatus;

  return (
    <div className="explorer-response">
      <div className="response-status-row">
        {statusCode !== undefined && (
          <span className={`response-status ${statusCode < 400 ? 'success' : 'error'}`}>
            {statusCode}
          </span>
        )}
        {res?.statusText && <span className="response-status-text">{res.statusText}</span>}
        {event.durationMs !== undefined && (
          <span className="response-time">{formatDurationMs(event.durationMs)}</span>
        )}
      </div>

      {event.details?.error && (
        <div className="exec-error" style={{ margin: '8px 0' }}>
          <span className="exec-error-icon">!</span>
          <span className="exec-error-text">{event.details.error}</span>
        </div>
      )}

      {res?.headers && Object.keys(res.headers).length > 0 && (
        <div className="response-section">
          <h4>Headers</h4>
          <div className="headers-list">
            {Object.entries(res.headers).map(([key, value]) => (
              <div key={key} className="header-row">
                <span className="header-key">{key}:</span>
                <span className="header-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res?.body && (
        <div className="response-section">
          <div className="section-header-with-toggle">
            <h4>Body</h4>
            {res.bodyTruncated && <span className="truncated-badge">Truncated</span>}
          </div>
          <JsonTreeViewer data={res.body} defaultExpandDepth={3} maxHeight={400} />
        </div>
      )}

      {!hasFullTrace && (
        <div className="explorer-trace-hint">
          Enable <strong>Capture Full Trace</strong> to see headers and body.
        </div>
      )}
    </div>
  );
}

// ─── Variables Tab ────────────────────────────────────────────────────────────

function VariablesTab({ event, hasFullTrace }: { event: ExecutionEvent; hasFullTrace: boolean }) {
  if (!hasFullTrace) {
    return (
      <div className="explorer-empty">
        <p>Full trace not captured.</p>
        <p className="explorer-empty-hint">Enable "Capture Full Trace" before running to see variable values.</p>
      </div>
    );
  }

  const extracted = event.details?.extractedVariables;
  const snapshot = event.details?.variablesSnapshot;

  if (!extracted && !snapshot) {
    return <div className="explorer-empty">No variable data available</div>;
  }

  return (
    <div className="explorer-variables">
      {extracted && Object.keys(extracted).length > 0 && (
        <div className="variables-section">
          <h4>Extracted by This Node</h4>
          <div className="variables-table">
            {Object.entries(extracted).map(([key, value]) => (
              <div key={key} className="variable-row extracted">
                <span className="variable-name">{key}</span>
                <span className="variable-value">{truncate(value, 100, '...', false)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot && Object.keys(snapshot).length > 0 && (
        <div className="variables-section">
          <h4>All Variables (after this node)</h4>
          <div className="variables-table">
            {Object.entries(snapshot).map(([key, value]) => {
              const isExtracted = extracted && key in extracted;
              return (
                <div key={key} className={`variable-row ${isExtracted ? 'highlighted' : ''}`}>
                  <span className="variable-name">
                    {key}
                    {isExtracted && <span className="new-badge">new</span>}
                  </span>
                  <span className="variable-value">{truncate(value, 100, '...', false)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assertions Tab ───────────────────────────────────────────────────────────

function AssertionsTab({ event }: { event: ExecutionEvent }) {
  const assertions = event.details?.assertions;

  if (!assertions || assertions.length === 0) {
    return (
      <div className="explorer-empty">
        <p>No assertions defined for this node.</p>
      </div>
    );
  }

  const passCount = assertions.filter(a => a.passed).length;

  return (
    <div className="explorer-assertions">
      <div className="assertions-summary">
        <span className={passCount === assertions.length ? 'all-pass' : 'has-fail'}>
          {passCount} of {assertions.length} passed
        </span>
      </div>

      <div className="assertions-list">
        {assertions.map((assertion, i) => (
          <div key={i} className={`assertion-row ${assertion.passed ? 'pass' : 'fail'}`}>
            <span className="assertion-icon">{assertion.passed ? '✓' : '✗'}</span>
            <div className="assertion-content">
              <span className="assertion-type">{assertion.type}</span>
              <span className="assertion-desc">{assertion.description}</span>
              {(assertion.expected || assertion.actual) && (
                <div className="assertion-values">
                  {assertion.expected && (
                    <span className="assertion-expected">Expected: {assertion.expected}</span>
                  )}
                  {assertion.actual && (
                    <span className="assertion-actual">Actual: {assertion.actual}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

