import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import WorkflowExecutionCanvas, { type NodeStateFilter } from './WorkflowExecutionCanvas';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import IterationMatrixTable from './IterationMatrixTable';
import IterationPicker from './IterationPicker';
import { saveJsonFile, saveCsvFile, buildExportFilename } from '../../../shared/utils/fileSaver';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import type { BottleneckInsight } from '../utils/bottleneckAnalysis';

interface Props {
  trace: WorkflowExecutionTrace;
  onClose: () => void;
  /** When set, shows an "Imported" info banner with the filename and hides the Export button. */
  importedFileName?: string;
}

/**
 * Results Explorer Modal - Full-screen modal for exploring workflow execution results.
 * Features:
 * - Left panel: Workflow diagram with pass/fail overlay
 * - Right panel: Node detail with Request/Response/Variables/Assertions tabs
 * - Bottom panel: Iteration matrix table (collapsible)
 */
export default function WorkflowResultsExplorerModal({ trace, onClose, importedFileName }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState<number | undefined>(
    trace.totalIterations === 1 ? 0 : undefined
  );
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<NodeStateFilter>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sampledCount = useMemo(
    () => trace.iterations.filter(i => i.sampled !== false).length,
    [trace.iterations],
  );
  const isSampled = sampledCount < trace.iterations.length;

  // Get the selected iteration's trace
  const currentIterationTrace = useMemo<WorkflowIterationTrace | undefined>(() => {
    if (selectedIteration === undefined) return undefined;
    return trace.iterations[selectedIteration];
  }, [trace.iterations, selectedIteration]);

  const isSelectedIterationSampled = selectedIteration !== undefined
    && trace.iterations[selectedIteration]?.sampled !== false;

  const [bottleneckInsights, setBottleneckInsights] = useState<BottleneckInsight[]>([]);

  const handleBottlenecksComputed = useCallback((insights: BottleneckInsight[]) => {
    setBottleneckInsights(insights);
  }, []);

  // Build a per-iteration trace for canvas display
  const canvasTrace = useMemo<WorkflowExecutionTrace>(() => {
    if (selectedIteration === undefined) return trace;
    const iter = trace.iterations[selectedIteration];
    if (!iter || iter.sampled === false) return trace;
    return {
      ...trace,
      iterations: [iter],
      traversedEdges: iter.traversedEdges,
      totalIterations: 1,
    };
  }, [trace, selectedIteration]);

  // Get selected node info
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = (trace.workflowSnapshot.nodes as Array<any>).find(n => n.id === selectedNodeId);
    if (!node) return null;
    return {
      id: node.id,
      type: node.type,
      label: node.data?.label || node.data?.name || node.id,
    };
  }, [selectedNodeId, trace.workflowSnapshot.nodes]);

  // Get events for selected node
  const selectedNodeEvents = useMemo<ExecutionEvent[]>(() => {
    if (!selectedNodeId) return [];
    if (selectedIteration !== undefined) {
      const iter = trace.iterations[selectedIteration];
      if (!iter) return [];
      return iter.events.filter(e => e.nodeId === selectedNodeId);
    }
    return trace.iterations.flatMap(iter => iter.events.filter(e => e.nodeId === selectedNodeId));
  }, [selectedNodeId, selectedIteration, trace.iterations]);

  // Calculate failure count for default filter
  const failedIterationCount = useMemo(() => {
    return trace.iterations.filter(iter => !iter.passed).length;
  }, [trace.iterations]);

  // Node state counts for filter badges
  const nodeStateCounts = useMemo(() => {
    const counts = { pass: 0, fail: 0, skipped: 0 };
    const nodes = trace.workflowSnapshot.nodes as Array<{ id: string }>;
    for (const node of nodes) {
      let state: 'pass' | 'fail' | 'skipped' = 'skipped';
      for (const iter of trace.iterations) {
        for (const ev of iter.events) {
          if (ev.nodeId !== node.id) continue;
          if (ev.state === 'fail') { state = 'fail'; break; }
          if (ev.state === 'pass') state = 'pass';
        }
        if (state === 'fail') break;
      }
      counts[state]++;
    }
    return counts;
  }, [trace]);

  // Calculate average HTTP response time (only HTTP nodes with timing)
  const avgHttpResponseTime = useMemo(() => {
    const httpDurations: number[] = [];
    for (const iter of trace.iterations) {
      for (const event of iter.events) {
        if (event.nodeType === 'http' && event.durationMs !== undefined) {
          httpDurations.push(event.durationMs);
        }
      }
    }
    if (httpDurations.length === 0) return undefined;
    return Math.round(httpDurations.reduce((a, b) => a + b, 0) / httpDurations.length * 100) / 100;
  }, [trace.iterations]);

  // Calculate average iteration time
  const avgIterationTime = useMemo(() => {
    if (trace.iterations.length === 0) return undefined;
    const total = trace.iterations.reduce((sum, iter) => sum + iter.durationMs, 0);
    return Math.round(total / trace.iterations.length * 100) / 100;
  }, [trace.iterations]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedNodeId) {
          setSelectedNodeId(undefined);
        } else {
          onClose();
        }
        return;
      }

      if (trace.totalIterations <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return trace.totalIterations - 1;
          return prev > 0 ? prev - 1 : prev;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return 0;
          return prev < trace.totalIterations - 1 ? prev + 1 : prev;
        });
      } else if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
        setSelectedIteration(undefined);
      } else if (e.key === 'm' || e.key === 'M') {
        setMatrixCollapsed(prev => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        setSelectedIteration(prev => prev === undefined ? 0 : undefined);
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < trace.totalIterations) {
          setSelectedIteration(idx);
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedNodeId, trace.totalIterations]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId || undefined);
  }, []);

  const handleIterationSelect = useCallback((iterIndex: number) => {
    setSelectedIteration(iterIndex);
  }, []);

  const handleCellSelect = useCallback((iterIndex: number, nodeId: string) => {
    setSelectedIteration(iterIndex);
    setSelectedNodeId(nodeId);
  }, []);

  const handleExportTrace = useCallback(() => {
    const date = new Date(trace.iterations[0]?.events[0]?.timestamp || Date.now())
      .toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = buildExportFilename({
      level: 'trace',
      name: trace.workflowName,
      date,
    });
    saveJsonFile(trace, filename);
  }, [trace]);

  const handleExportCsv = useCallback(() => {
    const httpNodes = (trace.workflowSnapshot.nodes as Array<any>).filter(
      (n: any) => n.type === 'http',
    );
    const rows: string[][] = [];
    rows.push(['Node', 'Executions', 'Pass Rate (%)', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'P95 (ms)']);

    for (const node of httpNodes) {
      const durations: number[] = [];
      let passCount = 0;
      let totalCount = 0;
      for (const iter of trace.iterations) {
        for (const ev of iter.events) {
          if (ev.nodeId !== node.id) continue;
          totalCount++;
          if (ev.state === 'pass') passCount++;
          if (ev.durationMs !== undefined) durations.push(ev.durationMs);
        }
      }
      if (totalCount === 0) continue;
      durations.sort((a, b) => a - b);
      const avg = durations.length > 0
        ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length * 100) / 100
        : 0;
      const min = durations.length > 0 ? Math.round(durations[0] * 100) / 100 : 0;
      const max = durations.length > 0 ? Math.round(durations[durations.length - 1] * 100) / 100 : 0;
      const p95Idx = Math.min(Math.ceil(durations.length * 0.95) - 1, durations.length - 1);
      const p95 = durations.length > 0 ? Math.round(durations[Math.max(0, p95Idx)] * 100) / 100 : 0;
      const passRate = Math.round(passCount / totalCount * 10000) / 100;
      const label = node.data?.label || node.data?.name || node.id;
      rows.push([label, String(totalCount), String(passRate), String(avg), String(min), String(max), String(p95)]);
    }

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const date = new Date(trace.iterations[0]?.events[0]?.timestamp || Date.now())
      .toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = buildExportFilename({ level: 'metrics', name: trace.workflowName, date, ext: 'csv' });
    saveCsvFile(csv, filename);
  }, [trace]);

  const timestamp = new Date(trace.iterations[0]?.events[0]?.timestamp || Date.now()).toLocaleString();
  const passedCount = trace.iterations.filter(i => i.passed).length;
  const passRate = trace.totalIterations > 0 ? (passedCount / trace.totalIterations * 100).toFixed(0) : 0;

  return (
    <FullPanelModal
      title={
        <div className="results-explorer-header">
          <div className="results-explorer-title">
            <span className="results-explorer-name">{trace.workflowName}</span>
            <span className="results-explorer-subtitle">Results Explorer</span>
          </div>
          <div className="results-explorer-meta">
            {trace.totalIterations > 1 && (
              <>
                <IterationPicker
                  iterations={trace.iterations}
                  selectedIteration={selectedIteration}
                  onSelect={setSelectedIteration}
                  failedCount={failedIterationCount}
                />
                <span className="results-explorer-meta-sep">•</span>
              </>
            )}
            <span>{timestamp}</span>
            <span className="results-explorer-meta-sep">•</span>
            <span>{trace.totalIterations} iteration{trace.totalIterations !== 1 ? 's' : ''}</span>
            <span className="results-explorer-meta-sep">•</span>
            <span style={{ color: passRate === '100' ? '#22c55e' : Number(passRate) === 0 ? '#ef4444' : '#f59e0b' }}>
              {passRate}% pass
            </span>
            {trace.fullTraceCaptured && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <span className="results-explorer-full-trace-badge">Full Trace</span>
              </>
            )}
            {isSampled && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <span className="results-explorer-sampled-badge" title={`${sampledCount} of ${trace.iterations.length} iterations have full trace data`}>
                  Sampled ({sampledCount}/{trace.iterations.length})
                </span>
              </>
            )}
            {importedFileName && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <span className="results-explorer-imported-badge" title={importedFileName} data-testid="imported-badge">
                  📂 Imported: {importedFileName}
                </span>
              </>
            )}
            {!importedFileName && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <button
                  className="results-explorer-export-btn"
                  onClick={handleExportTrace}
                  title="Export execution trace as JSON"
                  data-testid="export-trace-btn"
                >
                  ⬇ Export JSON
                </button>
                <button
                  className="results-explorer-export-csv-btn"
                  onClick={handleExportCsv}
                  title="Export per-node aggregate metrics as CSV"
                  data-testid="export-csv-btn"
                >
                  📊 Export CSV
                </button>
              </>
            )}
          </div>
        </div>
      }
      onClose={onClose}
      bodyScrollable={false}
      footer={
        <div className="results-explorer-footer">
          <div className="results-explorer-footer-info">
            {selectedIteration !== undefined
              ? (isSelectedIterationSampled
                ? `Iteration #${selectedIteration + 1} — ${currentIterationTrace?.passed ? 'Passed' : 'Failed'} — ${formatDurationMs(currentIterationTrace?.durationMs)}`
                : `Iteration #${selectedIteration + 1} — ${trace.iterations[selectedIteration]?.passed ? 'Passed' : 'Failed'} — Trace not captured (sampled run)`)
              : (
                <>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Avg HTTP:</span>
                    <span className="footer-metric-value">{formatDurationMs(avgHttpResponseTime)}</span>
                  </span>
                  <span className="footer-metric-sep">•</span>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Avg Iteration:</span>
                    <span className="footer-metric-value">{formatDurationMs(avgIterationTime)}</span>
                  </span>
                  <span className="footer-metric-sep">•</span>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Total:</span>
                    <span className="footer-metric-value">{formatDurationMs(trace.totalDurationMs)}</span>
                  </span>
                </>
              )
            }
          </div>
          <div className="results-explorer-footer-actions">
            <span className="results-explorer-shortcuts">
              ← → iterate • 1-9 jump • Space toggle • A all • M matrix • / search • Esc close
            </span>
            <button className="cat-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="results-explorer-body">
        {/* Left Panel: Workflow Diagram */}
        <div className="results-explorer-diagram">
          <div className="node-search-bar" data-testid="node-search-bar">
            <div className="node-search-input-wrap">
              <svg className="node-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="node-search-input"
                placeholder="Search nodes… ( / )"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); (e.target as HTMLInputElement).blur(); } }}
                data-testid="node-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="node-search-clear"
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  data-testid="node-search-clear"
                >×</button>
              )}
            </div>
            <div className="node-filter-btns">
              {(['all', 'pass', 'fail', 'skipped'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`node-filter-btn node-filter-btn-${f}${stateFilter === f ? ' active' : ''}`}
                  onClick={() => setStateFilter(stateFilter === f ? 'all' : f)}
                  data-testid={`node-filter-${f}`}
                >
                  {f === 'all' ? 'All' : f === 'pass' ? `Pass (${nodeStateCounts.pass})` : f === 'fail' ? `Fail (${nodeStateCounts.fail})` : `Skip (${nodeStateCounts.skipped})`}
                </button>
              ))}
            </div>
          </div>
          <ReactFlowProvider>
            <WorkflowExecutionCanvas
              trace={canvasTrace}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              showMinimap={showMinimap}
              onToggleMinimap={() => setShowMinimap(!showMinimap)}
              fitViewTrigger={fitViewTrigger}
              onBottlenecksComputed={handleBottlenecksComputed}
              searchQuery={searchQuery}
              stateFilter={stateFilter}
            />
          </ReactFlowProvider>
        </div>

        {/* Right Panel: Node Detail */}
        <div className="results-explorer-detail">
          {selectedNode ? (
            <ResultsExplorerDetailPanel
              nodeId={selectedNode.id}
              nodeType={selectedNode.type}
              nodeLabel={selectedNode.label}
              events={selectedNodeEvents}
              iterations={trace.iterations}
              selectedIteration={selectedIteration}
              onIterationChange={setSelectedIteration}
              onClose={() => setSelectedNodeId(undefined)}
              fullTraceCaptured={trace.fullTraceCaptured}
            />
          ) : (
            <div className="results-explorer-empty-detail">
              <div className="results-explorer-empty-icon">📊</div>
              <div className="results-explorer-empty-title">Select a Node</div>
              <div className="results-explorer-empty-text">
                Click on a node in the diagram to view its execution details
              </div>
              <div className="results-explorer-summary-stats">
                <div className="summary-stat">
                  <span className="summary-stat-value">{trace.totalIterations}</span>
                  <span className="summary-stat-label">Iterations</span>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-value" style={{ color: '#22c55e' }}>{passedCount}</span>
                  <span className="summary-stat-label">Passed</span>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-value" style={{ color: failedIterationCount > 0 ? '#ef4444' : '#64748b' }}>
                    {failedIterationCount}
                  </span>
                  <span className="summary-stat-label">Failed</span>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-value">{formatDurationMs(trace.totalDurationMs / trace.totalIterations)}</span>
                  <span className="summary-stat-label">Avg Duration</span>
                </div>
              </div>
              {bottleneckInsights.length > 0 && (
                <div className="bottleneck-insights-panel" data-testid="bottleneck-insights">
                  <div className="bottleneck-insights-title">Bottleneck Analysis</div>
                  {bottleneckInsights.map((insight, i) => (
                    <button
                      key={`${insight.nodeId}-${i}`}
                      className={`bottleneck-insight-card bottleneck-insight-${insight.severity}`}
                      onClick={() => handleNodeClick(insight.nodeId)}
                      data-testid={`bottleneck-insight-${i}`}
                    >
                      <div className="bottleneck-insight-header">
                        <span className="bottleneck-insight-icon">
                          {insight.severity === 'critical' ? '🔥' : insight.severity === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <span className="bottleneck-insight-node">{insight.nodeLabel}</span>
                        <span className={`bottleneck-insight-severity bottleneck-severity-${insight.severity}`}>
                          {insight.severity}
                        </span>
                      </div>
                      <div className="bottleneck-insight-message">{insight.message}</div>
                      <div className="bottleneck-insight-suggestion">{insight.suggestion}</div>
                      <div className="bottleneck-insight-metric">
                        {insight.metric.label}: <strong>{insight.metric.value}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Iteration Matrix */}
      {trace.totalIterations > 1 && (
        <div className={`results-explorer-matrix ${matrixCollapsed ? 'collapsed' : ''}`}>
          <div 
            className="results-explorer-matrix-header"
            onClick={() => { setMatrixCollapsed(!matrixCollapsed); setTimeout(() => setFitViewTrigger(c => c + 1), 100); }}
          >
            <span className="matrix-toggle-icon">{matrixCollapsed ? '▶' : '▼'}</span>
            <span className="matrix-title">Iteration Matrix</span>
            <span className="matrix-count">{trace.totalIterations} iterations</span>
            {failedIterationCount > 0 && (
              <span className="matrix-failed-badge">{failedIterationCount} failed</span>
            )}
          </div>
          {!matrixCollapsed && (
            <IterationMatrixTable
              iterations={trace.iterations}
              nodes={trace.workflowSnapshot.nodes as any[]}
              selectedIteration={selectedIteration}
              selectedNodeId={selectedNodeId}
              onIterationSelect={handleIterationSelect}
              onCellSelect={handleCellSelect}
            />
          )}
        </div>
      )}
    </FullPanelModal>
  );
}
