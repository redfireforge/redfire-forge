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

function toWorkflowEdges(edges: WorkflowRFEdge[]) {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: typeof e.label === 'string' ? e.label : undefined,
  }));
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
  const persistEdges = useCallback((updated: WorkflowRFEdge[]) => {
    if (!selected) return;
    const wfNodes = serializeNodes(nodes);
    const wfEdges = toWorkflowEdges(updated);
    queueMicrotask(() => update(selected.id, { nodes: wfNodes, edges: wfEdges }));
  }, [selected, nodes, serializeNodes, update]);

  const onConnect: OnConnect = useCallback((params) => {
    undoRedo.takeSnapshot('Add connection');
    const newEdge: Edge = {
      ...params,
      id: uuidv4(),
      animated: false,
      label: params.sourceHandle === 'true' ? 'Yes' : params.sourceHandle === 'false' ? 'No' : undefined,
      className: params.sourceHandle === 'false' ? 'wf-edge-false-branch' : undefined,
    };
    setEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      persistEdges(updated);
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, persistEdges]);

  const removeEdgeBetween = useCallback((source: string, target: string) => {
    undoRedo.takeSnapshot('Remove connection');
    setEdges((eds) => {
      const updated = eds.filter((e) => !(e.source === source && e.target === target));
      if (updated.length !== eds.length) {
        persistEdges(updated);
      }
      return updated;
    });
  }, [setEdges, persistEdges, undoRedo]);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      undoRedo.takeSnapshot('Reconnect edge');
      setEdges((eds) => {
        const next = reconnectEdge(oldEdge, newConnection, eds);
        const updated = next.map((e) => {
          if (e.id !== oldEdge.id) return e;
          const sh = e.sourceHandle ?? newConnection.sourceHandle;
          const label = sh === 'true' ? 'Yes' : sh === 'false' ? 'No' : undefined;
          return { ...e, label };
        });
        persistEdges(updated);
        return updated;
      });
    },
    [setEdges, persistEdges, undoRedo],
  );

  // Derive edge execution states from nodeStatuses
  useEffect(() => {
    const statusKeys = Object.keys(nodeStatuses);
    if (statusKeys.length === 0) {
      setEdges(prev => {
        return prev.map(e => {
          const base = e.sourceHandle === 'false' ? 'wf-edge-false-branch' : undefined;
          if (e.className === base) return e;
          return { ...e, className: base };
        });
      });
      return;
    }

    setEdges(prev => prev.map(edge => {
      const sourceStatus = nodeStatuses[edge.source];
      const targetStatus = nodeStatuses[edge.target];
      const sourceState = sourceStatus?.state;
      const targetState = targetStatus?.state;

      const baseCls = edge.sourceHandle === 'false' ? 'wf-edge-false-branch' : '';
      let execCls = '';
      if (targetState === 'running') {
        execCls = 'wf-edge-animated';
      } else if (targetState === 'skipped') {
        execCls = 'wf-edge-skipped';
      } else if (sourceState === 'pass' && (targetState === 'pass' || targetState === 'fail')) {
        execCls = targetState === 'pass' ? 'wf-edge-pass' : 'wf-edge-fail';
      } else if (sourceState === 'fail' && targetState === 'fail') {
        execCls = 'wf-edge-fail';
      }

      const className = [baseCls, execCls].filter(Boolean).join(' ') || undefined;
      if (edge.className === className) return edge;
      return { ...edge, className };
    }));
  }, [nodeStatuses, setEdges]);

  // Expose global helpers for the demo player to wire edges programmatically
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__wfConnect = (
      source: string, target: string,
      sourceHandle: string | null = null,
      targetHandle: string | null = null,
    ) => onConnect({ source, target, sourceHandle, targetHandle });
    win.__wfRemoveEdge = (source: string, target: string) => {
      removeEdgeBetween(source, target);
    };
    return () => {
      delete win.__wfConnect;
      delete win.__wfRemoveEdge;
    };
  }, [onConnect, removeEdgeBetween]);

  return { onConnect, onReconnect, removeEdgeBetween } as const;
}
