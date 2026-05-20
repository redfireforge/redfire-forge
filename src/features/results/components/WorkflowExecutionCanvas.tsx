import { useMemo, useCallback, useState, useEffect, useRef } from 'react';

import {
  ReactFlow,
  Background,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type OnNodesChange,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { isSampledIteration } from '../utils/sampledIterations';
import { nodeTypes } from '../../workflow/utils/workflowNodeFactory';
import { identifyBottlenecks, getBottleneckNodeIds, type BottleneckInsight } from '../utils/bottleneckAnalysis';
import { captureCanvasScreenshot, captureCanvasSvg } from '../utils/canvasScreenshot';
import {
  detectForkJoinTopology,
  computeBranchBounds,
  buildBranchLabel,
  type ForkJoinTopology,
} from '../utils/forkJoinDetection';
import { heatmapColor } from '../utils/heatmapColor';
import { saveLayoutToStorage, loadLayoutFromStorage } from '../utils/replayLayoutStorage';
import { ReplayCanvasControls } from './ReplayCanvasControls';
import {
  EdgePercentageOverlay,
  SwimLaneOverlay,
  type EdgePercentageBadge,
  type SwimLaneBound,
} from './ReplayCanvasOverlays';

type ReplaySnapshotEdge = {
  id: string;
  source: string;
  target: string;
};

export type NodeStateFilter = 'all' | 'pass' | 'fail' | 'skipped';

export type CanvasScreenshotFn = () => Promise<string>;
export type CanvasSvgFn = () => Promise<string>;

interface Props {
  trace: WorkflowExecutionTrace;
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  fitViewTrigger?: number;
  /** Called once with computed bottleneck insights so parent can display a summary */
  onBottlenecksComputed?: (insights: BottleneckInsight[]) => void;
  /** Text filter — nodes whose label doesn't contain this are dimmed */
  searchQuery?: string;
  /** State filter — nodes not matching this state are dimmed */
  stateFilter?: NodeStateFilter;
  /** Called with a screenshot capture function so the parent can trigger PNG export */
  onScreenshotReady?: (fn: CanvasScreenshotFn) => void;
  /** Called with an SVG capture function so the parent can trigger SVG export */
  onSvgReady?: (fn: CanvasSvgFn) => void;
  /** Called when fork/join topology is detected, so parent can show branch comparison */
  onForkJoinDetected?: (topology: ForkJoinTopology) => void;
}

interface NodeExecutionState {
  state: 'pass' | 'fail' | 'skipped';
  avgDuration?: number;
  passRate?: number;
  executionCount: number;
}

/**
 * Read-only workflow canvas showing execution state (Phase 7e).
 * Displays nodes with color-coded states and edges with traversal highlighting.
 */
export default function WorkflowExecutionCanvas({ 
  trace, 
  selectedNodeId,
  onNodeClick,
  onNodeDoubleClick,
  showMinimap = true,
  onToggleMinimap,
  fitViewTrigger,
  onBottlenecksComputed,
  searchQuery = '',
  stateFilter = 'all',
  onScreenshotReady,
  onSvgReady,
  onForkJoinDetected,
}: Props) {
  const [layoutKey, setLayoutKey] = useState(0);
  const hasFittedAfterMeasure = useRef(false);
  const rfInstanceRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  useEffect(() => {
    if (fitViewTrigger) {
      setLayoutKey(k => k + 1);
      hasFittedAfterMeasure.current = false;
    }
  }, [fitViewTrigger]);

  useEffect(() => {
    hasFittedAfterMeasure.current = false;
  }, [trace.workflowId]);
  // Calculate execution state for each node
  const nodeStates = useMemo(() => {
    const states = new Map<string, NodeExecutionState>();

    // Initialize all nodes as skipped
    for (const node of trace.workflowSnapshot.nodes as Array<{ id: string }>) {
      states.set(node.id, {
        state: 'skipped',
        executionCount: 0,
      });
    }

    // Aggregate execution events across all iterations
    for (const iteration of trace.iterations) {
      for (const event of iteration.events) {
        const existing = states.get(event.nodeId);
        if (!existing) continue;

        const newCount = existing.executionCount + 1;
        const totalDuration = (existing.avgDuration || 0) * existing.executionCount + (event.durationMs || 0);
        const avgDuration = totalDuration / newCount;

        // Determine aggregate state: fail if any failed, pass if all passed, skip otherwise
        let newState: 'pass' | 'fail' | 'skipped' = event.state;
        if (existing.state === 'fail' || event.state === 'fail') {
          newState = 'fail';
        } else if (existing.state === 'pass' || event.state === 'pass') {
          newState = 'pass';
        }

        states.set(event.nodeId, {
          state: newState,
          avgDuration: event.durationMs !== undefined ? avgDuration : undefined,
          executionCount: newCount,
          passRate: undefined,
        });
      }
    }

    // Calculate pass rates
    for (const [nodeId, state] of states.entries()) {
      if (state.executionCount === 0) continue;

      const passedCount = trace.iterations.filter(iter =>
        iter.events.some(e => e.nodeId === nodeId && e.state === 'pass')
      ).length;

      states.set(nodeId, {
        ...state,
        passRate: (passedCount / trace.totalIterations) * 100,
      });
    }

    return states;
  }, [trace]);

  // Compute bottleneck insights
  const bottleneckInsights = useMemo(() => identifyBottlenecks(trace), [trace]);
  const bottleneckMap = useMemo(() => getBottleneckNodeIds(bottleneckInsights), [bottleneckInsights]);

  useEffect(() => {
    onBottlenecksComputed?.(bottleneckInsights);
  }, [bottleneckInsights, onBottlenecksComputed]);

  // Restore saved layout positions if available
  const savedLayout = useMemo(() => loadLayoutFromStorage(trace.workflowId), [trace.workflowId]);

  // Managed node state - initialized once, updated via onNodesChange for dragging
  const [rfNodes, setRfNodes] = useState<Node[]>(() =>
    (trace.workflowSnapshot.nodes as Node[]).map((node) => {
      const saved = savedLayout?.[node.id];
      return {
        ...node,
        ...(saved ? { position: { x: saved.x, y: saved.y } } : {}),
        draggable: true,
        connectable: false,
        selectable: true,
      };
    })
  );

  // Reset nodes when trace changes (e.g. sub-workflow drill-down or navigating back)
  const prevSnapshotRef = useRef(trace.workflowSnapshot.nodes);
  useEffect(() => {
    if (trace.workflowSnapshot.nodes !== prevSnapshotRef.current) {
      prevSnapshotRef.current = trace.workflowSnapshot.nodes;
      const layout = loadLayoutFromStorage(trace.workflowId);
      setRfNodes(
        (trace.workflowSnapshot.nodes as Node[]).map((node) => {
          const saved = layout?.[node.id];
          return {
            ...node,
            ...(saved ? { position: { x: saved.x, y: saved.y } } : {}),
            draggable: true,
            connectable: false,
            selectable: true,
          };
        })
      );
    }
  }, [trace.workflowId, trace.workflowSnapshot.nodes]);

  const handleSaveLayout = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const node of rfNodes) {
      positions[node.id] = { x: node.position.x, y: node.position.y };
    }
    saveLayoutToStorage(trace.workflowId, positions);
  }, [rfNodes, trace.workflowId]);

  // Compute heatmap intensity per node (0 = fastest, 1 = slowest)
  const heatmapData = useMemo(() => {
    const durations: number[] = [];
    for (const st of nodeStates.values()) {
      if (st.avgDuration !== undefined && st.executionCount > 0) {
        durations.push(st.avgDuration);
      }
    }
    if (durations.length < 2) return null;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    if (max - min < 1) return null;
    return { min, max };
  }, [nodeStates]);

  const searchLower = searchQuery.toLowerCase().trim();

  // Apply execution styling as derived data (doesn't reset positions)
  const displayNodes: Node[] = useMemo(() => {
    return rfNodes.map((node) => {
      const executionState = nodeStates.get(node.id);
      const stateClass = executionState?.state || 'skipped';
      const isSelected = selectedNodeId === node.id;

      const nodeLabel = ((node.data as Record<string, unknown>)?.label as string)
        || ((node.data as Record<string, unknown>)?.name as string)
        || node.id;
      const matchesSearch = !searchLower || nodeLabel.toLowerCase().includes(searchLower);
      const matchesState = stateFilter === 'all' || (executionState?.state || 'skipped') === stateFilter;
      const isDimmed = !matchesSearch || !matchesState;

      let heatmapClass = '';
      let heatmapStyle: React.CSSProperties = {};
      if (heatmapData && executionState?.avgDuration !== undefined && executionState.executionCount > 0) {
        const t = (executionState.avgDuration - heatmapData.min) / (heatmapData.max - heatmapData.min);
        heatmapClass = ' replay-node-heatmap';
        heatmapStyle = {
          '--heatmap-color': heatmapColor(t),
          '--heatmap-intensity': String(0.12 + t * 0.18),
        } as React.CSSProperties;
      }

      const bottleneck = bottleneckMap.get(node.id);
      const bottleneckClass = bottleneck
        ? ` replay-node-bottleneck replay-node-bottleneck-${bottleneck.severity}`
        : '';
      const dimmedClass = isDimmed ? ' replay-node-dimmed' : '';

      return {
        ...node,
        className: `replay-node replay-node-${stateClass}${heatmapClass}${bottleneckClass}${dimmedClass} ${isSelected ? 'replay-node-selected' : ''}`,
        style: { width: 220, overflow: 'hidden', ...heatmapStyle },
        data: {
          ...node.data,
          executionState,
        },
      };
    });
  }, [rfNodes, nodeStates, selectedNodeId, heatmapData, bottleneckMap, searchLower, stateFilter]);

  // Compute per-edge traversal counts and identify branching edges
  const edgeTraversalData = useMemo(() => {
    const counts = new Map<string, number>();
    const sampledIterations = trace.iterations.filter(isSampledIteration);
    const totalIterations = sampledIterations.length;

    for (const iter of sampledIterations) {
      for (const edgeId of iter.traversedEdges) {
        counts.set(edgeId, (counts.get(edgeId) || 0) + 1);
      }
    }

    // Find branching nodes: source nodes with multiple outgoing edges that were traversed
    const rawEdges = trace.workflowSnapshot.edges as Array<{ id: string; source: string; target: string }>;
    const outgoingBySource = new Map<string, string[]>();
    for (const e of rawEdges) {
      const list = outgoingBySource.get(e.source) || [];
      list.push(e.id);
      outgoingBySource.set(e.source, list);
    }

    const branchingEdges = new Set<string>();
    for (const [, edgeIds] of outgoingBySource) {
      if (edgeIds.length > 1) {
        for (const eid of edgeIds) branchingEdges.add(eid);
      }
    }

    return { counts, totalIterations, branchingEdges };
  }, [trace.iterations, trace.workflowSnapshot.edges]);

  // Transform workflow edges with traversal highlighting and percentage labels
  const edges: Edge[] = useMemo(() => {
    const traversedSet = new Set(trace.traversedEdges);
    return (trace.workflowSnapshot.edges as ReplaySnapshotEdge[]).map((edge) => {
      const isTraversed = traversedSet.has(edge.id);

      return {
        ...edge,
        label: undefined,
        labelStyle: undefined,
        labelBgStyle: undefined,
        labelBgPadding: undefined,
        className: isTraversed ? 'replay-edge-traversed' : 'replay-edge-not-traversed',
        style: {
          stroke: isTraversed ? '#a78bfa' : '#94a3b8',
          strokeWidth: isTraversed ? 2 : 1,
          strokeDasharray: isTraversed ? undefined : '4,4',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 9,
          color: isTraversed ? '#a78bfa' : '#94a3b8',
        },
        animated: false,
      };
    });
  }, [trace.workflowSnapshot.edges, trace.traversedEdges]);

  // Compute percentage badges positioned at edge midpoints (in flow coordinates)
  const edgePctBadges: EdgePercentageBadge[] = useMemo(() => {
    const { counts, totalIterations, branchingEdges } = edgeTraversalData;
    if (totalIterations <= 1) return [];

    const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const n of rfNodes) {
      nodeMap.set(n.id, {
        x: n.position.x,
        y: n.position.y,
        width: (n.measured?.width ?? n.width ?? 200) as number,
        height: (n.measured?.height ?? n.height ?? 60) as number,
      });
    }

    const badges: EdgePercentageBadge[] = [];
    for (const edge of trace.workflowSnapshot.edges as ReplaySnapshotEdge[]) {
      if (!branchingEdges.has(edge.id)) continue;
      const count = counts.get(edge.id) || 0;
      const pct = Math.round((count / totalIterations) * 100);
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const srcCx = src.x + src.width / 2;
      const srcCy = src.y + src.height / 2;
      const tgtCx = tgt.x + tgt.width / 2;
      const tgtCy = tgt.y + tgt.height / 2;

      badges.push({
        edgeId: edge.id,
        pct,
        x: (srcCx + tgtCx) / 2,
        y: (srcCy + tgtCy) / 2,
      });
    }
    return badges;
  }, [edgeTraversalData, rfNodes, trace.workflowSnapshot.edges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick]
  );

  const handlePaneClick = useCallback(() => {
    onNodeClick?.('');
  }, [onNodeClick]);

  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle node position changes (enables dragging) + re-fit after dimension measurement
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));
      if (!hasFittedAfterMeasure.current && changes.some((c) => c.type === 'dimensions')) {
        if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
        fitTimerRef.current = setTimeout(() => {
          hasFittedAfterMeasure.current = true;
          rfInstanceRef.current?.fitView({ padding: 0.05, duration: 200 });
        }, 150);
      }
    },
    []
  );

  // Tooltip hover state
  const [hoveredNode, setHoveredNode] = useState<{ id: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    const target = _event.currentTarget as HTMLElement;
    const container = containerRef.current;
    if (!target || !container) return;
    const containerRect = container.getBoundingClientRect();
    const nodeRect = target.getBoundingClientRect();
    setHoveredNode({
      id: node.id,
      x: nodeRect.left - containerRect.left + nodeRect.width / 2,
      y: nodeRect.top - containerRect.top,
    });
  }, []);

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // Register screenshot capture functions for parent
  useEffect(() => {
    if (!onScreenshotReady) return;
    const captureFn = async () => {
      if (!containerRef.current) throw new Error('Canvas container not mounted');
      return captureCanvasScreenshot(containerRef.current, displayNodes);
    };
    onScreenshotReady(captureFn);
  }, [onScreenshotReady, displayNodes]);

  useEffect(() => {
    if (!onSvgReady) return;
    const captureFn = async () => {
      if (!containerRef.current) throw new Error('Canvas container not mounted');
      return captureCanvasSvg(containerRef.current, displayNodes);
    };
    onSvgReady(captureFn);
  }, [onSvgReady, displayNodes]);

  // Fork/join topology detection for swim lanes
  const forkJoinTopology: ForkJoinTopology = useMemo(
    () => detectForkJoinTopology(
      trace.workflowSnapshot.nodes as Array<{ id: string; type?: string }>,
      trace.workflowSnapshot.edges as Array<{ id: string; source: string; target: string }>,
    ),
    [trace.workflowSnapshot.nodes, trace.workflowSnapshot.edges],
  );

  useEffect(() => {
    onForkJoinDetected?.(forkJoinTopology);
  }, [forkJoinTopology, onForkJoinDetected]);

  // Compute swim-lane bounds from node positions
  const swimLanes: SwimLaneBound[] = useMemo(() => {
    if (forkJoinTopology.pairs.length === 0) return [];

    const nodePositions = new Map<string, { x: number; y: number }>();
    const nodeLabelMap = new Map<string, string>();
    for (const node of rfNodes) {
      nodePositions.set(node.id, node.position);
      const label = (node.data as Record<string, unknown>)?.label;
      if (typeof label === 'string') nodeLabelMap.set(node.id, label);
    }

    const lanes: SwimLaneBound[] = [];

    for (const pair of forkJoinTopology.pairs) {
      const branchAvgs: number[] = [];

      for (let i = 0; i < pair.branches.length; i++) {
        const branchNodeIds = new Set(pair.branches[i]);
        let totalDuration = 0;
        let totalExec = 0;
        for (const iter of trace.iterations) {
          for (const ev of iter.events) {
            if (!branchNodeIds.has(ev.nodeId)) continue;
            totalDuration += ev.durationMs ?? 0;
            totalExec++;
          }
        }
        branchAvgs.push(totalExec > 0 ? totalDuration / trace.totalIterations : 0);
      }

      // Only mark critical path when meaningfully slower (same threshold as computeBranchStats)
      let criticalBranchIdx = -1;
      if (branchAvgs.length >= 2) {
        const sorted = [...branchAvgs].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
        const absDiff = sorted[0].v - sorted[1].v;
        const relDiff = sorted[1].v > 0 ? absDiff / sorted[1].v : (sorted[0].v > 0 ? 1 : 0);
        if (absDiff >= 5 || relDiff >= 0.1) {
          criticalBranchIdx = sorted[0].i;
        }
      }

      for (let i = 0; i < pair.branches.length; i++) {
        const bounds = computeBranchBounds(pair.branches[i], nodePositions);
        if (!bounds) continue;
        lanes.push({
          branchIndex: i,
          label: buildBranchLabel(i, pair.branches[i], nodeLabelMap),
          ...bounds,
          isCriticalPath: i === criticalBranchIdx,
        });
      }
    }

    return lanes;
  }, [forkJoinTopology, rfNodes, trace.iterations, trace.totalIterations]);

  const tooltipData = useMemo(() => {
    if (!hoveredNode) return null;
    const state = nodeStates.get(hoveredNode.id);
    const node = rfNodes.find(n => n.id === hoveredNode.id);
    if (!state) return null;
    return {
      label: (node?.data as Record<string, unknown>)?.label as string || hoveredNode.id,
      ...state,
      bottleneck: bottleneckMap.get(hoveredNode.id),
    };
  }, [hoveredNode, nodeStates, rfNodes, bottleneckMap]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        key={`${trace.workflowId}-${layoutKey}`}
        className="results-explorer-flow"
        nodes={displayNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.05 }}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        zoomOnScroll={true}
        panOnScroll={false}
        minZoom={0.1}
        maxZoom={2.0}
      >
        <Background />
        <SwimLaneOverlay lanes={swimLanes} />
        <EdgePercentageOverlay badges={edgePctBadges} />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const executionState = nodeStates.get(node.id);
              const state = executionState?.state || 'skipped';
              return state === 'pass' ? '#22c55e' : state === 'fail' ? '#ef4444' : '#64748b';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      <ReplayCanvasControls 
        showMinimap={showMinimap} 
        onToggleMinimap={onToggleMinimap}
        onSaveLayout={handleSaveLayout}
      />
      {hoveredNode && tooltipData && (
        <div
          className="replay-node-tooltip"
          style={{
            left: hoveredNode.x,
            top: hoveredNode.y,
          }}
          data-testid="node-tooltip"
        >
          <div className="replay-tooltip-label">{tooltipData.label}</div>
          <div className="replay-tooltip-row">
            <span className={`replay-tooltip-status replay-tooltip-${tooltipData.state}`}>
              {tooltipData.state === 'pass' ? '✓ Pass' : tooltipData.state === 'fail' ? '✕ Fail' : '− Skipped'}
            </span>
          </div>
          {tooltipData.executionCount > 0 && (
            <>
              {tooltipData.avgDuration !== undefined && (
                <div className="replay-tooltip-row">
                  Avg: {tooltipData.avgDuration < 1000
                    ? `${Math.round(tooltipData.avgDuration)} ms`
                    : `${(tooltipData.avgDuration / 1000).toFixed(2)} s`}
                </div>
              )}
              {tooltipData.passRate !== undefined && (
                <div className="replay-tooltip-row">
                  Pass rate: {tooltipData.passRate.toFixed(0)}%
                </div>
              )}
              <div className="replay-tooltip-row">
                Executions: {tooltipData.executionCount}
              </div>
            </>
          )}
          {tooltipData.bottleneck && (
            <div className={`replay-tooltip-bottleneck replay-tooltip-bottleneck-${tooltipData.bottleneck.severity}`}>
              <div className="replay-tooltip-bottleneck-header">
                <span className="replay-tooltip-bottleneck-icon">
                  {tooltipData.bottleneck.severity === 'critical' ? '🔥' : tooltipData.bottleneck.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span>{tooltipData.bottleneck.message}</span>
              </div>
              <div className="replay-tooltip-bottleneck-suggestion">{tooltipData.bottleneck.suggestion}</div>
              <div className="replay-tooltip-bottleneck-metric">
                {tooltipData.bottleneck.metric.label}: <strong>{tooltipData.bottleneck.metric.value}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
