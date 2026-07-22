import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '../../../shared/types';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import WorkflowExecutionCanvas from './WorkflowExecutionCanvas';
import NodeExecutionDetailPanel from './NodeExecutionDetailPanel';
import { CustomSelect } from '../../../shared/components/CustomSelect';

type ReplaySnapshotNode = {
  id: string;
  type?: string;
  data?: { label?: string; name?: string };
};

interface Props {
  trace: WorkflowExecutionTrace;
  onClose: () => void;
}

/**
 * Full-screen modal for visual workflow execution replay (Phase 7e).
 * Supports iteration navigation, node detail panel, and aggregate view.
 */
export default function WorkflowExecutionReplayModal({ trace, onClose }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showMinimap, setShowMinimap] = useState(false);
  // undefined = aggregate view, number = specific iteration (0-based)
  const [selectedIteration, setSelectedIteration] = useState<number | undefined>(
    trace.totalIterations === 1 ? 0 : undefined
  );

  // Get the selected iteration's trace (or all for aggregate)
  const currentIterationTrace = useMemo<WorkflowIterationTrace | undefined>(() => {
    if (selectedIteration === undefined) return undefined;
    return trace.iterations[selectedIteration];
  }, [trace.iterations, selectedIteration]);

  // Build a per-iteration trace for canvas display
  const canvasTrace = useMemo<WorkflowExecutionTrace>(() => {
    if (selectedIteration === undefined) return trace;
    const iter = trace.iterations[selectedIteration];
    if (!iter) return trace;
    return {
      ...trace,
      iterations: [iter],
      traversedEdges: iter.traversedEdges,
      totalIterations: 1,
    };
  }, [trace, selectedIteration]);

  // Get node label for detail panel
  const selectedNodeLabel = useMemo(() => {
    if (!selectedNodeId) return '';
    const node = (trace.workflowSnapshot.nodes as ReplaySnapshotNode[]).find(n => n.id === selectedNodeId);
    return node?.data?.label || node?.data?.name || selectedNodeId;
  }, [selectedNodeId, trace.workflowSnapshot.nodes]);

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
      } else if (e.key === 'a' || e.key === 'A') {
        if (!e.ctrlKey && !e.metaKey) {
          setSelectedIteration(undefined);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedNodeId, trace.totalIterations]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId || undefined);
  }, []);

  const timestamp = useMemo(() => {
    const ts = trace.iterations[0]?.events[0]?.timestamp;
    return ts ? new Date(ts).toLocaleString() : '';
  }, [trace.iterations]);

  return (
    <FullPanelModal
      title={
        <div>
          <div style={{ fontSize: '1.1em', fontWeight: 600 }}>{trace.workflowName}</div>
          <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
            Execution Replay • {timestamp} • {trace.totalIterations} iteration{trace.totalIterations !== 1 ? 's' : ''}
          </div>
          {/* Iteration Selector */}
          {trace.totalIterations > 1 && (
            <div className="replay-iteration-selector">
              <CustomSelect
                value={selectedIteration === undefined ? 'aggregate' : String(selectedIteration)}
                onChange={(v) => setSelectedIteration(v === 'aggregate' ? undefined : Number(v))}
                options={[
                  { value: 'aggregate', label: 'All Iterations (Aggregate)' },
                  ...trace.iterations.map((iter, i) => ({
                    value: String(i),
                    label: `Iteration #${i + 1} — ${iter.passed ? '✓ Pass' : '✗ Fail'} (${Math.round(iter.durationMs)}ms)`,
                  })),
                ]}
                size="sm"
              />
              <div className="replay-iteration-nav">
                <button
                  onClick={() => setSelectedIteration(prev => prev !== undefined && prev > 0 ? prev - 1 : prev)}
                  disabled={selectedIteration === undefined || selectedIteration === 0}
                  title="Previous iteration (←)"
                >
                  ←
                </button>
                <button
                  onClick={() => setSelectedIteration(prev => prev !== undefined && prev < trace.totalIterations - 1 ? prev + 1 : prev)}
                  disabled={selectedIteration === undefined || selectedIteration === trace.totalIterations - 1}
                  title="Next iteration (→)"
                >
                  →
                </button>
                {selectedIteration !== undefined && (
                  <button
                    className="replay-back-to-all"
                    onClick={() => setSelectedIteration(undefined)}
                    title="Back to aggregate view (A)"
                  >
                    ⟵ All
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      }
      onClose={onClose}
      bodyScrollable={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9em', color: '#888' }}>
            {selectedIteration !== undefined
              ? `Iteration #${selectedIteration + 1} — ${currentIterationTrace?.passed ? 'Passed' : 'Failed'} — ${formatDurationMs(currentIterationTrace?.durationMs)}`
              : `Total Duration: ${formatDurationMs(trace.totalDurationMs)} • ${trace.totalIterations} iterations`
            }
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {trace.totalIterations > 1 && (
              <span style={{ fontSize: '0.8em', color: '#666' }}>
                ← → navigate • A aggregate • Esc close
              </span>
            )}
            <button className="cat-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="workflow-execution-replay-canvas" style={{ height: '100%', width: '100%', position: 'relative' }}>
        <ReactFlowProvider>
          <WorkflowExecutionCanvas
            trace={canvasTrace}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            showMinimap={showMinimap}
            onToggleMinimap={() => setShowMinimap(!showMinimap)}
          />
        </ReactFlowProvider>

        {/* Node Detail Panel (slides in from right) */}
        {selectedNodeId && (
          <NodeExecutionDetailPanel
            nodeId={selectedNodeId}
            nodeLabel={selectedNodeLabel}
            iterations={selectedIteration !== undefined ? [trace.iterations[selectedIteration]].filter(Boolean) : trace.iterations}
            selectedIteration={selectedIteration !== undefined ? 0 : undefined}
            onClose={() => setSelectedNodeId(undefined)}
            onIterationClick={selectedIteration === undefined ? (iterIndex) => {
              setSelectedIteration(iterIndex);
            } : undefined}
          />
        )}
      </div>
    </FullPanelModal>
  );
}
