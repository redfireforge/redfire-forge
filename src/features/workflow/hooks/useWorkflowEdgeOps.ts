import { useCallback, useEffect } from 'react';
import { addEdge, reconnectEdge, type OnConnect, type Edge, type Connection } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowNode } from '../types/workflow';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow } from '../types/workflow';
import type { NodeRunStatus } from '../types/workflow';

interface UseWorkflowEdgeOpsOpts {
  selected: Workflow | null;
  nodes: WorkflowRFNode[];
  setEdges: React.Dispatch<React.SetStateAction<WorkflowRFEdge[]>>;
  serializeNodes: (rfNodes: WorkflowRFNode[]) => WorkflowNode[];
  update: (id: string, patch: Partial<Workflow>) => void;
  undoRedo: { takeSnapshot: (label: string) => void };
  nodeStatuses: Record<string, NodeRunStatus>;
}

export function useWorkflowEdgeOps({
  selected,
  nodes,
  setEdges,
  serializeNodes,
  update,
  undoRedo,
  nodeStatuses,
}: UseWorkflowEdgeOpsOpts) {
  const onConnect: OnConnect = useCallback((params) => {
    undoRedo.takeSnapshot('Add connection');
    const newEdge: Edge = {
      ...params,
      id: uuidv4(),
      animated: false,
      label: params.sourceHandle === 'true' ? 'Yes' : params.sourceHandle === 'false' ? 'No' : undefined,
    };
    setEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      if (selected) {
        const wfNodes = serializeNodes(nodes);
        const wfEdges = updated.map(e => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          label: typeof e.label === 'string' ? e.label : undefined,
        }));
        queueMicrotask(() => update(selected.id, { nodes: wfNodes, edges: wfEdges }));
      }
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, selected, nodes, serializeNodes, update]);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => {
        const next = reconnectEdge(oldEdge, newConnection, eds);
        return next.map((e) => {
          if (e.id !== oldEdge.id) return e;
          const sh = e.sourceHandle ?? newConnection.sourceHandle;
          const label = sh === 'true' ? 'Yes' : sh === 'false' ? 'No' : undefined;
          return { ...e, label };
        });
      });
    },
    [setEdges],
  );

  // Derive edge execution states from nodeStatuses
  useEffect(() => {
    const statusKeys = Object.keys(nodeStatuses);
    if (statusKeys.length === 0) {
      setEdges(prev => {
        const needsReset = prev.some(e => e.className);
        if (!needsReset) return prev;
        return prev.map(e => e.className ? { ...e, className: undefined } : e);
      });
      return;
    }

    setEdges(prev => prev.map(edge => {
      const sourceStatus = nodeStatuses[edge.source];
      const targetStatus = nodeStatuses[edge.target];
      const sourceState = sourceStatus?.state;
      const targetState = targetStatus?.state;

      let className: string | undefined;
      if (targetState === 'running') {
        className = 'wf-edge-animated';
      } else if (targetState === 'skipped') {
        className = 'wf-edge-skipped';
      } else if (sourceState === 'pass' && (targetState === 'pass' || targetState === 'fail')) {
        className = targetState === 'pass' ? 'wf-edge-pass' : 'wf-edge-fail';
      } else if (sourceState === 'fail' && targetState === 'fail') {
        className = 'wf-edge-fail';
      }

      if (edge.className === className) return edge;
      return { ...edge, className };
    }));
  }, [nodeStatuses, setEdges]);

  return { onConnect, onReconnect } as const;
}
