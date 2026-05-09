import { useRef, useEffect, useMemo } from 'react';
import type {
  WorkflowNode,
  WorkflowEdge,
  HttpNodeData,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  WorkflowErrorConfig,
  Workflow,
} from '../types/workflow';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { cloneWorkflowNodeDataForStorage, } from '../utils/workflowNodeMerge';
import { enrichNodeData } from '../utils/workflowNodeFactory';
import {
  collectConditionVariableHints,
  collectWaitForConditionVariableHints,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
} from '../utils/workflowVariableHints';

interface UseWorkflowCanvasSyncOpts {
  selected: Workflow | null;
  previewWorkflow: Workflow | null;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowRFNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowRFEdge[]>>;
  setSelectedNodeId: (id: string | null) => void;
  setLayoutVersion: React.Dispatch<React.SetStateAction<number>>;
  setWorkflowVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setWorkflowHostProfiles: React.Dispatch<React.SetStateAction<WorkflowHostProfile[]>>;
  setWorkflowAuthProfiles: React.Dispatch<React.SetStateAction<WorkflowAuthProfile[]>>;
  setWorkflowServices: React.Dispatch<React.SetStateAction<WorkflowService[]>>;
  setWorkflowErrorConfig: React.Dispatch<React.SetStateAction<WorkflowErrorConfig | undefined>>;
  setNodeInitialVars: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  nextNodeYRef: React.MutableRefObject<number>;
  // execution abort
  isRunning: boolean;
  abortRef: React.MutableRefObject<AbortController | null>;
  setIsRunning: (v: boolean) => void;
  setIsDebugMode: (v: boolean) => void;
  debugControllerRef: React.MutableRefObject<unknown>;
}

/**
 * Syncs the React Flow canvas whenever the selected workflow changes.
 * Also provides selectedNode, configModalNode, and variable hint memos.
 */
export function useWorkflowCanvasSync({
  selected,
  previewWorkflow,
  setNodes,
  setEdges,
  setSelectedNodeId,
  setLayoutVersion,
  setWorkflowVariables,
  setWorkflowHostProfiles,
  setWorkflowAuthProfiles,
  setWorkflowServices,
  setWorkflowErrorConfig,
  setNodeInitialVars,
  nextNodeYRef,
  isRunning,
  abortRef,
  setIsRunning,
  setIsDebugMode,
  debugControllerRef,
}: UseWorkflowCanvasSyncOpts) {
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    if (selected && selected.id !== prevSelectedId.current) {
      prevSelectedId.current = selected.id;
      const rfNodes: WorkflowRFNode[] = selected.nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
          ? n.position
          : { x: 0, y: 0 },
        data: cloneWorkflowNodeDataForStorage({ ...n.data }),
        selected: false,
      }));
      const rfEdges: WorkflowRFEdge[] = selected.edges.map(e => ({
        id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label, animated: false,
        className: e.sourceHandle === 'false' ? 'wf-edge-false-branch' : undefined,
      }));
      setNodes(rfNodes);
      setEdges(rfEdges);
      setSelectedNodeId(null);
      if (isRunning) {
        abortRef.current?.abort();
        setIsRunning(false);
        setIsDebugMode(false);
        debugControllerRef.current = null;
      }
      setWorkflowVariables(selected.variables ?? {});
      setWorkflowHostProfiles(selected.hostProfiles ?? []);
      setWorkflowAuthProfiles(selected.authProfiles ?? []);
      setWorkflowServices(selected.services ?? []);
      setWorkflowErrorConfig(selected.errorConfig);
      const ivMap: Record<string, Record<string, string>> = {};
      for (const n of selected.nodes) {
        if (isHttpWorkflowNode(n) && n.data.initialVariables) {
          ivMap[n.id] = { ...n.data.initialVariables };
        }
      }
      setNodeInitialVars(ivMap);
      const ys = selected.nodes.map(n => (n.position?.y ?? 0) + 120);
      nextNodeYRef.current = ys.length ? Math.max(100, ...ys) : 100;
      if (previewWorkflow) {
        setLayoutVersion(v => v + 1);
      }
    } else if (!selected) {
      prevSelectedId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, setNodes, setEdges]);
}

interface UseWorkflowVariableHintsOpts {
  selectedNodeId: string | null;
  nodes: WorkflowRFNode[];
  edges: WorkflowRFEdge[];
  nodeInitialVars: Record<string, Record<string, string>>;
  workflowVariables: Record<string, string>;
}

export function useWorkflowVariableHints({
  selectedNodeId,
  nodes,
  edges,
  nodeInitialVars,
  workflowVariables,
}: UseWorkflowVariableHintsOpts) {
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find(nd => nd.id === selectedNodeId);
    if (!n) return null;
    return enrichNodeData(n, nodeInitialVars);
  }, [selectedNodeId, nodes, nodeInitialVars]);

  const hintNodes = useMemo<WorkflowNode[]>(() => (
    nodes.map((n) => enrichNodeData(n, nodeInitialVars))
  ), [nodes, nodeInitialVars]);

  const hintEdges = useMemo<WorkflowEdge[]>(() => (
    edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }))
  ), [edges]);

  const conditionVariableHints = useMemo(() => {
    if (!selectedNode) return [];
    if (selectedNode.type === 'waitForCondition') {
      return collectWaitForConditionVariableHints(hintNodes, hintEdges, selectedNode.id, workflowVariables);
    }
    if (['condition', 'switch', 'logDebug', 'loop', 'setVariable', 'aggregate', 'script'].includes(selectedNode.type)) {
      return collectConditionVariableHints(hintNodes, hintEdges, selectedNode.id, workflowVariables);
    }
    return [];
  }, [selectedNode, hintNodes, hintEdges, workflowVariables]);

  const httpVariableHints = useMemo(() => {
    if (!selectedNodeId) return [];
    const raw = nodes.find((x) => x.id === selectedNodeId);
    if (!raw || !isHttpWorkflowNode(raw)) return [];
    const iv = nodeInitialVars[selectedNodeId];
    const httpData = { ...raw.data, initialVariables: iv ?? {} } as HttpNodeData;
    const base = collectConditionVariableHints(hintNodes, hintEdges, selectedNodeId, workflowVariables);
    return mergeHttpVariableHintsWithStepInitialVars(base, httpData);
  }, [selectedNodeId, nodes, nodeInitialVars, hintNodes, hintEdges, workflowVariables]);

  return { selectedNode, hintNodes, hintEdges, conditionVariableHints, httpVariableHints } as const;
}
