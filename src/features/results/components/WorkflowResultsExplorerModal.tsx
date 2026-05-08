import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import WorkflowExecutionCanvas from './WorkflowExecutionCanvas';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import IterationMatrixTable from './IterationMatrixTable';

interface Props {
  trace: WorkflowExecutionTrace;
  onClose: () => void;
}

/**
 * Results Explorer Modal - Full-screen modal for exploring workflow execution results.
 * Features:
 * - Left panel: Workflow diagram with pass/fail overlay
 * - Right panel: Node detail with Request/Response/Variables/Assertions tabs
 * - Bottom panel: Iteration matrix table (collapsible)
 */
export default function WorkflowResultsExplorerModal({ trace, onClose }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState<number | undefined>(
    trace.totalIterations === 1 ? 0 : undefined
  );
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);

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
                ? `Iteration #${selectedIteration + 1} — ${currentIterationTrace?.passed ? 'Passed' : 'Failed'} — ${formatDuration(currentIterationTrace?.durationMs)}`
                : `Iteration #${selectedIteration + 1} — ${trace.iterations[selectedIteration]?.passed ? 'Passed' : 'Failed'} — Trace not captured (sampled run)`)
              : (
                <>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Avg HTTP:</span>
                    <span className="footer-metric-value">{formatDuration(avgHttpResponseTime)}</span>
                  </span>
                  <span className="footer-metric-sep">•</span>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Avg Iteration:</span>
                    <span className="footer-metric-value">{formatDuration(avgIterationTime)}</span>
                  </span>
                  <span className="footer-metric-sep">•</span>
                  <span className="footer-metric">
                    <span className="footer-metric-label">Total:</span>
                    <span className="footer-metric-value">{formatDuration(trace.totalDurationMs)}</span>
                  </span>
                </>
              )
            }
          </div>
          <div className="results-explorer-footer-actions">
            <span className="results-explorer-shortcuts">
              ← → iterate • A all • M matrix • Esc close
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
          <ReactFlowProvider>
            <WorkflowExecutionCanvas
              trace={canvasTrace}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              showMinimap={showMinimap}
              onToggleMinimap={() => setShowMinimap(!showMinimap)}
              fitViewTrigger={fitViewTrigger}
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
                  <span className="summary-stat-value">{formatDuration(trace.totalDurationMs / trace.totalIterations)}</span>
                  <span className="summary-stat-label">Avg Duration</span>
                </div>
              </div>
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

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
