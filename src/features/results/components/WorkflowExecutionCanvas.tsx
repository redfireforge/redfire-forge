import { useMemo, useCallback, useState, useEffect } from 'react';

import {
  ReactFlow,
  Background,
  MiniMap,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodesChange,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { nodeTypes } from '../../workflow/utils/workflowNodeFactory';

interface Props {
  trace: WorkflowExecutionTrace;
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  fitViewTrigger?: number;
}

function ReplayControls({ showMinimap, onToggleMinimap }: { showMinimap?: boolean; onToggleMinimap?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.01, duration: 200 });
  }, [fitView]);

  return (
    <div className="wf-pill-controls">
      <button type="button" className="wf-pill-btn" title="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button type="button" className="wf-pill-btn" title="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <div className="wf-pill-sep" />
      <button type="button" className="wf-pill-btn" title="Fit view" onClick={handleFitView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>
      {onToggleMinimap && (
        <>
          <div className="wf-pill-sep" />
          <button
            type="button"
            className={`wf-pill-btn ${showMinimap ? 'active' : ''}`}
            title="Toggle minimap"
            onClick={onToggleMinimap}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
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
  showMinimap = true,
  onToggleMinimap,
  fitViewTrigger,
}: Props) {
  const [layoutKey, setLayoutKey] = useState(0);

  useEffect(() => {
    if (fitViewTrigger) {
      setLayoutKey(k => k + 1);
    }
  }, [fitViewTrigger]);
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

  // Managed node state - initialized once, updated via onNodesChange for dragging
  const [rfNodes, setRfNodes] = useState<Node[]>(() =>
    (trace.workflowSnapshot.nodes as Array<any>).map((node) => ({
      ...node,
      draggable: true,
      connectable: false,
      selectable: true,
    }))
  );

  // Apply execution styling as derived data (doesn't reset positions)
  const displayNodes: Node[] = useMemo(() => {
    return rfNodes.map((node) => {
      const executionState = nodeStates.get(node.id);
      const stateClass = executionState?.state || 'skipped';
      const isSelected = selectedNodeId === node.id;

      return {
        ...node,
        className: `replay-node replay-node-${stateClass} ${isSelected ? 'replay-node-selected' : ''}`,
        style: { width: 220, overflow: 'hidden' },
        data: {
          ...node.data,
          executionState,
        },
      };
    });
  }, [rfNodes, nodeStates, selectedNodeId]);

  // Transform workflow edges with traversal highlighting
  const edges: Edge[] = useMemo(() => {
    const traversedSet = new Set(trace.traversedEdges);

    return (trace.workflowSnapshot.edges as Array<any>).map((edge) => {
      const isTraversed = traversedSet.has(edge.id);

      return {
        ...edge,
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

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handlePaneClick = useCallback(() => {
    onNodeClick?.('');
  }, [onNodeClick]);

  // Handle node position changes (enables dragging)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  return (
    <>
      <ReactFlow
        key={`${trace.workflowId}-${layoutKey}`}
        className="results-explorer-flow"
        nodes={displayNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.01 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        zoomOnScroll={true}
        panOnScroll={false}
        minZoom={0.05}
        maxZoom={2.0}
      >
        <Background />
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
      <ReplayControls 
        showMinimap={showMinimap} 
        onToggleMinimap={onToggleMinimap} 
      />
    </>
  );
}
