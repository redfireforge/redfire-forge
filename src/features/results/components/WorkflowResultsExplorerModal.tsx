import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';
import { isSampledIteration } from '../utils/sampledIterations';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import WorkflowExecutionCanvas, { type NodeStateFilter } from './WorkflowExecutionCanvas';
import ExecutionTimeline from './ExecutionTimeline';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import IterationMatrixTable from './IterationMatrixTable';
import IterationPicker from './IterationPicker';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import type { BottleneckInsight } from '../utils/bottleneckAnalysis';
import type { ForkJoinTopology } from '../utils/forkJoinDetection';
import { getIterationByIndex } from '../utils/iterationLookup';
import ResultsExplorerConsolePanel from './ResultsExplorerConsolePanel';
import type { MappingTrace } from '../../../shared/components/data-mapper/utils/mappingTrace';
import MappingTraceOverlay from './MappingTraceOverlay';
import { useExplorerExport } from '../hooks/useExplorerExport';
import { useIterationTransition } from '../hooks/useIterationTransition';

type ReplaySnapshotNode = {
  id: string;
  type?: string;
  data?: { label?: string; name?: string };
};

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
interface TraceStackEntry {
  trace: WorkflowExecutionTrace;
  label: string;
  parentNodeId?: string;
}

export default function WorkflowResultsExplorerModal({ trace, onClose, importedFileName }: Props) {
  const [traceStack, setTraceStack] = useState<TraceStackEntry[]>([
    { trace, label: trace.workflowName },
  ]);
  const currentTrace = traceStack[traceStack.length - 1].trace;

  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState<number | undefined>(
    currentTrace.totalIterations === 1 ? 0 : undefined
  );
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<NodeStateFilter>('all');
  const [viewMode, setViewMode] = useState<'diagram' | 'timeline'>('diagram');
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [mapperOverlay, setMapperOverlay] = useState<{ traces: MappingTrace[]; nodeLabel: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sampledCount = useMemo(
    () => currentTrace.iterations.filter(isSampledIteration).length,
    [currentTrace.iterations],
  );
  const isSampled = sampledCount < currentTrace.iterations.length;

  // Get the selected iteration's trace by logical index (not array position)
  const currentIterationTrace = useMemo<WorkflowIterationTrace | undefined>(() => {
    if (selectedIteration === undefined) return undefined;
    return getIterationByIndex(currentTrace, selectedIteration);
  }, [currentTrace, selectedIteration]);

  const isSelectedIterationSampled = selectedIteration !== undefined
    && (currentIterationTrace ? isSampledIteration(currentIterationTrace) : false);

  const iterationTransitioning = useIterationTransition(selectedIteration);

  const [bottleneckInsights, setBottleneckInsights] = useState<BottleneckInsight[]>([]);
  const [forkJoinTopology, setForkJoinTopology] = useState<ForkJoinTopology | undefined>();

  const handleBottlenecksComputed = useCallback((insights: BottleneckInsight[]) => {
    setBottleneckInsights(insights);
  }, []);

  const handleForkJoinDetected = useCallback((topology: ForkJoinTopology) => {
    setForkJoinTopology(topology);
  }, []);

  // Build a per-iteration trace for canvas display
  const canvasTrace = useMemo<WorkflowExecutionTrace>(() => {
    if (selectedIteration === undefined) return currentTrace;
    const iter = getIterationByIndex(currentTrace, selectedIteration);
    if (!iter || iter.sampled === false) return currentTrace;
    return {
      ...currentTrace,
      iterations: [iter],
      traversedEdges: iter.traversedEdges,
      totalIterations: 1,
    };
  }, [currentTrace, selectedIteration]);

  // Get selected node info
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = (currentTrace.workflowSnapshot.nodes as ReplaySnapshotNode[]).find(n => n.id === selectedNodeId);
    if (!node) return null;
    return {
      id: node.id,
      type: node.type ?? 'unknown',
      label: node.data?.label || node.data?.name || node.id,
    };
  }, [selectedNodeId, currentTrace.workflowSnapshot.nodes]);

  // Get events for selected node
  const selectedNodeEvents = useMemo<ExecutionEvent[]>(() => {
    if (!selectedNodeId) return [];
    if (selectedIteration !== undefined) {
      const iter = getIterationByIndex(currentTrace, selectedIteration);
      if (!iter) return [];
      return iter.events.filter(e => e.nodeId === selectedNodeId);
    }
    return currentTrace.iterations.flatMap(iter => iter.events.filter(e => e.nodeId === selectedNodeId));
  }, [selectedNodeId, selectedIteration, currentTrace]);

  // Calculate failure count for default filter
  const failedIterationCount = useMemo(() => {
    return currentTrace.iterations.filter(iter => !iter.passed).length;
  }, [currentTrace.iterations]);

  // Node state counts for filter badges
  const nodeStateCounts = useMemo(() => {
    const counts = { pass: 0, fail: 0, skipped: 0 };
    const nodes = currentTrace.workflowSnapshot.nodes as Array<{ id: string }>;
    for (const node of nodes) {
      let state: 'pass' | 'fail' | 'skipped' = 'skipped';
      for (const iter of currentTrace.iterations) {
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
  }, [currentTrace]);

  // Calculate average HTTP response time (only HTTP nodes with timing)
  const avgHttpResponseTime = useMemo(() => {
    const httpDurations: number[] = [];
    for (const iter of currentTrace.iterations) {
      for (const event of iter.events) {
        if (event.nodeType === 'http' && event.durationMs !== undefined) {
          httpDurations.push(event.durationMs);
        }
      }
    }
    if (httpDurations.length === 0) return undefined;
    return Math.round(httpDurations.reduce((a, b) => a + b, 0) / httpDurations.length * 100) / 100;
  }, [currentTrace.iterations]);

  // Calculate average iteration time
  const avgIterationTime = useMemo(() => {
    if (currentTrace.iterations.length === 0) return undefined;
    const total = currentTrace.iterations.reduce((sum, iter) => sum + iter.durationMs, 0);
    return Math.round(total / currentTrace.iterations.length * 100) / 100;
  }, [currentTrace.iterations]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mapperOverlay) {
          setMapperOverlay(null);
        } else if (consoleOpen) {
          setConsoleOpen(false);
        } else if (selectedNodeId) {
          setSelectedNodeId(undefined);
        } else {
          onClose();
        }
        return;
      }

      // Cmd/Ctrl+J toggles console
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setConsoleOpen(prev => !prev);
        return;
      }

      if (currentTrace.totalIterations <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return currentTrace.totalIterations - 1;
          return prev > 0 ? prev - 1 : prev;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIteration(prev => {
          if (prev === undefined) return 0;
          return prev < currentTrace.totalIterations - 1 ? prev + 1 : prev;
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
        if (idx < currentTrace.totalIterations) {
          setSelectedIteration(idx);
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        setViewMode(prev => prev === 'diagram' ? 'timeline' : 'diagram');
      } else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        setDetailCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedNodeId, currentTrace.totalIterations, consoleOpen, mapperOverlay]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId || undefined);
  }, []);

  const handleConsoleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleIterationSelect = useCallback((iterIndex: number) => {
    setSelectedIteration(iterIndex);
  }, []);

  const handleCellSelect = useCallback((iterIndex: number, nodeId: string) => {
    setSelectedIteration(iterIndex);
    setSelectedNodeId(nodeId);
  }, []);

  const handleDrillDown = useCallback((childTrace: WorkflowExecutionTrace, parentNodeId: string) => {
    setTraceStack(prev => [...prev, { trace: childTrace, label: childTrace.workflowName, parentNodeId }]);
    setSelectedNodeId(undefined);
    setSelectedIteration(childTrace.totalIterations === 1 ? 0 : undefined);
    setSearchQuery('');
    setStateFilter('all');
    setFitViewTrigger(v => v + 1);
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    if (!nodeId) return;
    const node = (currentTrace.workflowSnapshot.nodes as ReplaySnapshotNode[]).find(n => n.id === nodeId);
    if (node?.type !== 'subWorkflow') return;

    const iterToCheck = selectedIteration !== undefined
      ? getIterationByIndex(currentTrace, selectedIteration)
      : currentTrace.iterations[currentTrace.iterations.length - 1];
    if (!iterToCheck) return;

    const event = iterToCheck.events.find(e => e.nodeId === nodeId);
    if (event?.details?.subWorkflowTrace) {
      handleDrillDown(event.details.subWorkflowTrace, nodeId);
    }
  }, [currentTrace, selectedIteration, handleDrillDown]);

  const handleBreadcrumbNav = useCallback((depth: number) => {
    setTraceStack(prev => prev.slice(0, depth + 1));
    setSelectedNodeId(undefined);
    setSelectedIteration(undefined);
    setSearchQuery('');
    setStateFilter('all');
    setFitViewTrigger(v => v + 1);
  }, []);

  const handleOpenMapper = useCallback((traces: MappingTrace[], nodeLabel: string) => {
    setMapperOverlay({ traces, nodeLabel });
  }, []);

  const {
    exportMenuOpen, setExportMenuOpen, exportMenuRef, exportBusy,
    screenshotBusy, svgBusy,
    handleScreenshotReady, handleSvgReady,
    handleExportTrace, handleExportCsv, handleExportPng, handleExportSvg,
  } = useExplorerExport(currentTrace);

  const timestampMs = currentTrace.iterations[0]?.events[0]?.timestamp;
  const [fallbackTimestamp] = useState(() => Date.now());
  const timestamp = useMemo(
    () => new Date(timestampMs || fallbackTimestamp).toLocaleString(),
    [timestampMs, fallbackTimestamp],
  );
  const passedCount = currentTrace.iterations.filter(i => i.passed).length;
  const passRate = currentTrace.totalIterations > 0 ? (passedCount / currentTrace.totalIterations * 100).toFixed(0) : 0;
  const nodesOk = nodeStateCounts.pass;
  const executedNodes = nodeStateCounts.pass + nodeStateCounts.fail;

  return (
    <FullPanelModal
      title={
        <div className="results-explorer-header">
          <div className="results-explorer-title">
            <span className="results-explorer-name">{currentTrace.workflowName}</span>
            <span className="results-explorer-subtitle">Results Explorer</span>
          </div>
          <div className="results-explorer-view-toggle" data-testid="view-mode-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'diagram' ? 'view-toggle-active' : ''}`}
              onClick={() => setViewMode('diagram')}
              title="Diagram view (T)"
              data-testid="view-toggle-diagram"
            >
              📊 Diagram
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'timeline' ? 'view-toggle-active' : ''}`}
              onClick={() => setViewMode('timeline')}
              title="Timeline view (T)"
              data-testid="view-toggle-timeline"
            >
              📈 Timeline
            </button>
            <span className="view-toggle-sep" />
            <button
              className={`view-toggle-btn view-toggle-console${consoleOpen ? ' view-toggle-active' : ''}`}
              onClick={() => setConsoleOpen(prev => !prev)}
              title="Toggle Console (⌘J)"
              data-testid="console-toggle-btn-header"
            >
              🖥 Console
            </button>
          </div>
          <div className="results-explorer-meta">
            {currentTrace.totalIterations > 1 && (
              <>
                <IterationPicker
                  iterations={currentTrace.iterations}
                  selectedIteration={selectedIteration}
                  onSelect={setSelectedIteration}
                  failedCount={failedIterationCount}
                />
                <span className="results-explorer-meta-sep">•</span>
              </>
            )}
            <span>{timestamp}</span>
            <span className="results-explorer-meta-sep">•</span>
            <span>{currentTrace.totalIterations} iteration{currentTrace.totalIterations !== 1 ? 's' : ''}</span>
            <span className="results-explorer-meta-sep">•</span>
            <span
              style={{ color: passRate === '100' ? '#22c55e' : Number(passRate) === 0 ? '#ef4444' : '#f59e0b' }}
              title={`${passedCount} of ${currentTrace.totalIterations} iterations passed (all nodes OK). ${nodesOk} of ${executedNodes} executed nodes passed.`}
            >
              {passRate}% pass
              {Number(passRate) < 100 && executedNodes > 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.85em', marginLeft: 4 }}>
                  ({nodesOk}/{executedNodes} nodes OK)
                </span>
              )}
            </span>
            {currentTrace.fullTraceCaptured && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <span className="results-explorer-full-trace-badge">Full Trace</span>
              </>
            )}
            {isSampled && (
              <>
                <span className="results-explorer-meta-sep">•</span>
                <span className="results-explorer-sampled-badge" title={`${sampledCount} of ${currentTrace.iterations.length} iterations have full trace data`}>
                  Sampled ({sampledCount}/{currentTrace.iterations.length})
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
                <div className="export-dropdown" ref={exportMenuRef} data-testid="export-dropdown">
                  <button
                    className="export-dropdown-trigger"
                    onClick={() => setExportMenuOpen(prev => !prev)}
                    disabled={exportBusy}
                    data-testid="export-dropdown-trigger"
                  >
                    {exportBusy ? '⏳ Exporting…' : '⬇ Export ▾'}
                  </button>
                  {exportMenuOpen && (
                    <div className="export-dropdown-menu" data-testid="export-dropdown-menu">
                      <button
                        className="export-dropdown-item"
                        onClick={() => { setExportMenuOpen(false); handleExportTrace(); }}
                        data-testid="export-trace-btn"
                      >
                        <span className="export-dropdown-icon">📄</span>
                        <span className="export-dropdown-label">Export JSON</span>
                        <span className="export-dropdown-desc">Full execution trace</span>
                      </button>
                      <button
                        className="export-dropdown-item"
                        onClick={() => { setExportMenuOpen(false); handleExportCsv(); }}
                        data-testid="export-csv-btn"
                      >
                        <span className="export-dropdown-icon">📊</span>
                        <span className="export-dropdown-label">Export CSV</span>
                        <span className="export-dropdown-desc">Per-node aggregate metrics</span>
                      </button>
                      <div className="export-dropdown-divider" />
                      <button
                        className="export-dropdown-item"
                        onClick={() => { setExportMenuOpen(false); handleExportPng(); }}
                        disabled={screenshotBusy}
                        data-testid="export-png-btn"
                      >
                        <span className="export-dropdown-icon">🖼</span>
                        <span className="export-dropdown-label">Export PNG</span>
                        <span className="export-dropdown-desc">High-res raster image</span>
                      </button>
                      <button
                        className="export-dropdown-item"
                        onClick={() => { setExportMenuOpen(false); handleExportSvg(); }}
                        disabled={svgBusy}
                        data-testid="export-svg-btn"
                      >
                        <span className="export-dropdown-icon">🔷</span>
                        <span className="export-dropdown-label">Export SVG</span>
                        <span className="export-dropdown-desc">Scalable vector diagram</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      }
      onClose={onClose}
      bodyScrollable={false}
      footer={
        <div className="results-explorer-footer">
          <div className={`results-explorer-footer-info${iterationTransitioning ? ' iteration-transitioning' : ''}`}>
            {selectedIteration !== undefined
              ? (isSelectedIterationSampled
                ? `Iteration #${selectedIteration + 1} — ${currentIterationTrace?.passed ? 'Passed' : 'Failed'} — ${formatDurationMs(currentIterationTrace?.durationMs)}`
                : `Iteration #${selectedIteration + 1} — ${currentIterationTrace?.passed ? 'Passed' : 'Failed'} — Trace not captured (sampled run)`)
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
                    <span className="footer-metric-value">{formatDurationMs(currentTrace.totalDurationMs)}</span>
                  </span>
                </>
              )
            }
          </div>
          <div className="results-explorer-footer-actions">
            <span className="results-explorer-shortcuts">
              ← → iterate • 1-9 jump • Space toggle • A all • M matrix • D detail • / search • ⌘J console • Esc close
            </span>
            <button className="cat-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      }
    >
      {/* Breadcrumb bar for sub-workflow drill-down */}
      {traceStack.length > 1 && (
        <div className="sub-workflow-breadcrumb" data-testid="sub-workflow-breadcrumb">
          {traceStack.map((entry, idx) => (
            <span key={idx} className="breadcrumb-segment">
              {idx > 0 && <span className="breadcrumb-sep">›</span>}
              {idx < traceStack.length - 1 ? (
                <button
                  type="button"
                  className="breadcrumb-link"
                  onClick={() => handleBreadcrumbNav(idx)}
                  data-testid={`breadcrumb-${idx}`}
                >
                  {entry.label}
                </button>
              ) : (
                <span className="breadcrumb-current" data-testid={`breadcrumb-${idx}`}>
                  {entry.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="results-explorer-body">
        {/* Left Panel: Workflow Diagram */}
        <div className={`results-explorer-diagram${iterationTransitioning ? ' iteration-transitioning' : ''}`}>
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
            <div className="node-filter-btns" data-testid="node-filter-btns">
              <span
                className="node-filter-label"
                title="These counts are NODES (parts of one workflow) — not iterations (workflow runs)."
              >
                NODES:
              </span>
              {(['all', 'pass', 'fail', 'skipped'] as const).map((f) => {
                const totalNodes = nodeStateCounts.pass + nodeStateCounts.fail + nodeStateCounts.skipped;
                const label =
                  f === 'all' ? 'All' :
                  f === 'pass' ? `Pass (${nodeStateCounts.pass})` :
                  f === 'fail' ? `Fail (${nodeStateCounts.fail})` :
                  `Skip (${nodeStateCounts.skipped})`;
                const tooltip =
                  f === 'all' ? `${totalNodes} node${totalNodes === 1 ? '' : 's'} total in this workflow.` :
                  f === 'pass' ? `${nodeStateCounts.pass} of ${totalNodes} nodes passed in every iteration they ran.` :
                  f === 'fail' ? `${nodeStateCounts.fail} of ${totalNodes} nodes failed in at least one iteration. (Not the iteration count — see the iteration picker for that.)` :
                  `${nodeStateCounts.skipped} of ${totalNodes} nodes were never executed (e.g. condition branch never taken).`;
                return (
                  <button
                    key={f}
                    type="button"
                    className={`node-filter-btn node-filter-btn-${f}${stateFilter === f ? ' active' : ''}`}
                    onClick={() => setStateFilter(stateFilter === f ? 'all' : f)}
                    data-testid={`node-filter-${f}`}
                    title={tooltip}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {viewMode === 'diagram' ? (
            <ReactFlowProvider>
              <WorkflowExecutionCanvas
                trace={canvasTrace}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                showMinimap={showMinimap}
                onToggleMinimap={() => setShowMinimap(!showMinimap)}
                fitViewTrigger={fitViewTrigger}
                onBottlenecksComputed={handleBottlenecksComputed}
                searchQuery={searchQuery}
                stateFilter={stateFilter}
                onScreenshotReady={handleScreenshotReady}
                onSvgReady={handleSvgReady}
                onForkJoinDetected={handleForkJoinDetected}
              />
            </ReactFlowProvider>
          ) : (
            <ExecutionTimeline
              trace={currentTrace}
              selectedIteration={selectedIteration}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onDrillDown={handleDrillDown}
              searchQuery={searchQuery}
              stateFilter={stateFilter}
            />
          )}
        </div>

        {/* Detail Panel Toggle */}
        <button
          className="detail-panel-toggle"
          onClick={() => setDetailCollapsed(prev => !prev)}
          title={detailCollapsed ? 'Show detail panel (D)' : 'Hide detail panel (D)'}
          data-testid="detail-panel-toggle"
        >
          {detailCollapsed ? '◀' : '▶'}
        </button>

        {/* Right Panel: Node Detail */}
        {!detailCollapsed && (
          <div className={`results-explorer-detail${iterationTransitioning ? ' iteration-transitioning' : ''}`}>
            {selectedNode ? (
              <ResultsExplorerDetailPanel
                nodeId={selectedNode.id}
                nodeType={selectedNode.type}
                nodeLabel={selectedNode.label}
                events={selectedNodeEvents}
                iterations={currentTrace.iterations}
                selectedIteration={selectedIteration}
                onIterationChange={setSelectedIteration}
                onClose={() => setSelectedNodeId(undefined)}
                fullTraceCaptured={currentTrace.fullTraceCaptured}
                forkJoinTopology={forkJoinTopology}
                onDrillDown={handleDrillDown}
                onOpenMapper={handleOpenMapper}
              />
            ) : (
              <div className="results-explorer-empty-detail">
                <div className="results-explorer-workflow-info" data-testid="workflow-info">
                  <div className="workflow-info-name">{currentTrace.workflowName}</div>
                  {traceStack.length > 1 && (
                    <div className="workflow-info-parent">
                      <span className="workflow-info-parent-label">Parent:</span>
                      <span className="workflow-info-parent-name">{traceStack[traceStack.length - 2].label}</span>
                    </div>
                  )}
                  {traceStack.length <= 1 && (
                    <div className="workflow-info-type">Root Workflow</div>
                  )}
                </div>
                <div className="results-explorer-empty-icon">📊</div>
                <div className="results-explorer-empty-title">Select a Node</div>
                <div className="results-explorer-empty-text">
                  Click on a node in the diagram to view its execution details
                </div>
                <div className="results-explorer-summary-stats">
                  <div className="summary-stat">
                    <span className="summary-stat-value">{currentTrace.totalIterations}</span>
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
                    <span className="summary-stat-value">{formatDurationMs(currentTrace.totalDurationMs / currentTrace.totalIterations)}</span>
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
        )}
      </div>

      {/* Console Panel */}
      {consoleOpen && (
        <ResultsExplorerConsolePanel
          trace={currentTrace}
          iteration={currentIterationTrace}
          captureLevel={currentTrace.captureLevel}
          onNodeSelect={handleConsoleNodeSelect}
          onClose={() => setConsoleOpen(false)}
        />
      )}

      {/* Bottom Panel: Iteration Matrix */}
      {currentTrace.totalIterations > 1 && (
        <div className={`results-explorer-matrix ${matrixCollapsed ? 'collapsed' : ''}`}>
          <div 
            className="results-explorer-matrix-header"
            onClick={() => { setMatrixCollapsed(!matrixCollapsed); setTimeout(() => setFitViewTrigger(c => c + 1), 100); }}
          >
            <span className="matrix-toggle-icon">{matrixCollapsed ? '▶' : '▼'}</span>
            <span className="matrix-title">Iteration Matrix</span>
            <span className="matrix-count">{currentTrace.totalIterations} iterations</span>
            {failedIterationCount > 0 && (
              <span className="matrix-failed-badge">{failedIterationCount} failed</span>
            )}
          </div>
          {!matrixCollapsed && (
            <IterationMatrixTable
              iterations={currentTrace.iterations}
              nodes={(currentTrace.workflowSnapshot.nodes as ReplaySnapshotNode[]).map(n => ({ id: n.id, type: n.type ?? 'unknown', data: n.data }))}
              selectedIteration={selectedIteration}
              selectedNodeId={selectedNodeId}
              onIterationSelect={handleIterationSelect}
              onCellSelect={handleCellSelect}
            />
          )}
        </div>
      )}
      {/* Mapping Trace Overlay */}
      {mapperOverlay && (
        <MappingTraceOverlay
          traces={mapperOverlay.traces}
          nodeLabel={mapperOverlay.nodeLabel}
          onClose={() => setMapperOverlay(null)}
        />
      )}
    </FullPanelModal>
  );
}

