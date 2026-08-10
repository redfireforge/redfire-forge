import { useMemo, useState } from 'react';
import type { ExecutionEvent, WorkflowIterationTrace, WorkflowExecutionTrace } from '../../../shared/types';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import { truncate } from '../../../shared/utils/helpers';
import type { MappingTrace } from '../../../shared/components/data-mapper/utils/mappingTrace';
import { formatTraceValue, isTraceError } from '../../../shared/components/data-mapper/utils/mappingTrace';
import { formatNodeTypeExplorer as formatNodeType } from '../utils/nodeTypeLabels';
import {
  computeBranchStats,
  BRANCH_COLORS,
  BRANCH_BORDER_COLORS,
  type ForkJoinPair,
  type ForkJoinTopology,
} from '../utils/forkJoinDetection';
import OverviewTab from './DetailOverviewTab';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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
  /** Called when user clicks "Open in Mapper" for a node's mapping traces. */
  onOpenMapper?: (traces: MappingTrace[], nodeLabel: string) => void;
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
  onOpenMapper,
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
  const hasMappingTraces = !!(currentEvent?.details?.mappingTraces && currentEvent.details.mappingTraces.length > 0);
  const hasVariables = !!(currentEvent?.details?.variablesSnapshot || currentEvent?.details?.extractedVariables || hasWebhookInput || hasMappingTraces);
  const hasBasicRequest = !!(currentEvent?.details?.method && currentEvent?.details?.url);
  const hasBasicResponse = !!(currentEvent?.details?.statusCode !== undefined || currentEvent?.details?.error);

  return (
    <div className="explorer-detail-panel">
      {/* Header */}
      <div className="explorer-detail-header">
        <div className="explorer-detail-title-row">
          <span className="explorer-detail-type">{formatNodeType(nodeType)}</span>
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
            <CustomSelect
              value={selectedIteration === undefined ? 'all' : String(selectedIteration)}
              onChange={(v) => onIterationChange(v === 'all' ? undefined : Number(v))}
              options={[
                { value: 'all', label: 'All Iterations (Aggregate)' },
                ...iterations.map((iter) => ({
                  value: String(iter.index),
                  label: `#${iter.index + 1} — ${iter.passed ? '✓' : '✗'} ${formatDurationMs(iter.durationMs)}`,
                })),
              ]}
              size="sm"
            />
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
          <VariablesTab
            event={currentEvent}
            hasFullTrace={!!hasFullTrace}
            onOpenMapper={onOpenMapper ? (traces) => onOpenMapper(traces, nodeLabel) : undefined}
          />
        )}
        {activeTab === 'assertions' && currentEvent && (
          <AssertionsTab event={currentEvent} />
        )}
      </div>
      <div className="explorer-detail-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
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

function VariablesTab({
  event,
  hasFullTrace,
  onOpenMapper,
}: {
  event: ExecutionEvent;
  hasFullTrace: boolean;
  onOpenMapper?: (traces: MappingTrace[]) => void;
}) {
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
  const mappingTraces = event.details?.mappingTraces;

  if (!extracted && !snapshot && (!mappingTraces || mappingTraces.length === 0)) {
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

      {mappingTraces && mappingTraces.length > 0 && (
        <div className="variables-section">
          <div className="variables-section-header">
            <h4>Mapping Traces</h4>
            {onOpenMapper && (
              <button
                className="open-in-mapper-btn"
                onClick={() => onOpenMapper(mappingTraces)}
                data-testid="open-in-mapper-btn"
              >
                Open in Mapper
              </button>
            )}
          </div>
          <div className="variables-table">
            {mappingTraces.map((trace) => {
              const hasError = isTraceError(trace);
              return (
                <div key={trace.mappingId} className={`variable-row ${hasError ? 'fail' : ''}`} data-testid={`mapping-trace-${trace.mappingId}`}>
                  <span className="variable-name">
                    {trace.sourcePath} → {trace.targetPath}
                    {trace.expression && <span className="mapping-trace-expr" title={trace.expression}>fx</span>}
                  </span>
                  <span className={`variable-value ${hasError ? 'error-text' : ''}`}>
                    {trace.error
                      ? `Error: ${truncate(trace.error, 60, '...', false)}`
                      : formatTraceValue(trace.targetValue, 80)}
                  </span>
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

