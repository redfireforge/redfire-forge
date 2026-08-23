import { useCallback, useEffect, useRef, useState } from 'react';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { cloneWorkflowNodeDataForStorage } from '../utils/workflowNodeMerge';
import { createWorkflowVersion, addVersionToList } from '../utils/workflowVersioning';
import type {
  WorkflowNode,
  WorkflowService,
  WorkflowErrorConfig,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  Workflow,
} from '../types/workflow';
import type { SlaTarget } from '@shared/types';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { useNodeClipboard } from './useNodeClipboard';
import type { useUndoRedo } from './useUndoRedo';

export const WORKFLOW_SCHEMA_VERSION = 6;

export interface PersistOverrides {
  services?: WorkflowService[];
  rfNodes?: WorkflowRFNode[];
  variables?: Record<string, string>;
  errorConfig?: WorkflowErrorConfig;
}

interface UseWorkflowPersistenceOpts {
  selected: Workflow | null;
  previewWorkflow?: Workflow | null;
  workflowVariables: Record<string, string>;
  workflowHostProfiles: WorkflowHostProfile[];
  workflowAuthProfiles: WorkflowAuthProfile[];
  workflowServices: WorkflowService[];
  workflowErrorConfig: WorkflowErrorConfig | undefined;
  nodeInitialVarsRef: React.MutableRefObject<Record<string, Record<string, string>>>;
  nodesRef: React.MutableRefObject<WorkflowRFNode[]>;
  edgesRef: React.MutableRefObject<WorkflowRFEdge[]>;
  selectedNodeId: string | null;
  nextNodeYRef: React.MutableRefObject<number>;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowRFNode[]>>;
  setWorkflowVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  workflowVariablesRef: React.MutableRefObject<Record<string, string>>;
  update: (id: string, patch: Partial<Workflow>) => void;
  clipboard: ReturnType<typeof useNodeClipboard>;
  undoRedo: ReturnType<typeof useUndoRedo>;
  toast: { show: (kind: 'info' | 'success' | 'error', title: string, body?: string) => void };
}

/** Pure: serialize React Flow nodes to workflow storage format. */
export function serializeRFNodes(
  rfNodes: WorkflowRFNode[],
  nodeInitialVars: Record<string, Record<string, string>>,
): WorkflowNode[] {
  return rfNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: cloneWorkflowNodeDataForStorage(
      isHttpWorkflowNode(n)
        ? { ...n.data, initialVariables: nodeInitialVars[n.id] ?? n.data.initialVariables }
        : n.data,
    ),
  })) as WorkflowNode[];
}

/** Pure: serialize React Flow edges to workflow storage format. */
export function serializeRFEdges(rfEdges: WorkflowRFEdge[]) {
  return rfEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: typeof e.label === 'string' ? e.label : undefined,
  }));
}

/**
 * Persistence + clipboard orchestration extracted from `WorkflowDesigner`.
 * Owns serialize → update flow, paste/duplicate insertion, and undo/redo
 * toasts. Intentionally keeps storage-format conversion as pure helpers
 * exported alongside so other hooks can reuse them without React deps.
 */
export function useWorkflowPersistence(opts: UseWorkflowPersistenceOpts) {
  const {
    selected, previewWorkflow, workflowVariables, workflowHostProfiles, workflowAuthProfiles,
    workflowServices, workflowErrorConfig, nodeInitialVarsRef, nodesRef, edgesRef, selectedNodeId,
    nextNodeYRef, setNodes, setWorkflowVariables, workflowVariablesRef, update, clipboard, undoRedo, toast,
  } = opts;

  const [saveAcknowledged, setSaveAcknowledged] = useState(false);

  // Mutable ref so persistWorkflow always reads the latest services,
  // even when called from stale closures (e.g. wrappedOnNodesChange).
  const workflowServicesRef = useRef(workflowServices);
  workflowServicesRef.current = workflowServices;

  const serializeNodes = useCallback(
    (rfNodes: WorkflowRFNode[]) => serializeRFNodes(rfNodes, nodeInitialVarsRef.current),
    [nodeInitialVarsRef],
  );
  const serializeEdges = useCallback((rfEdges: WorkflowRFEdge[]) => serializeRFEdges(rfEdges), []);

  const persistWorkflow = useCallback((overrides?: PersistOverrides) => {
    if (!selected) return;
    const wfNodes = serializeNodes(overrides?.rfNodes ?? nodesRef.current);
    const wfEdges = serializeEdges(edgesRef.current);
    update(selected.id, {
      nodes: wfNodes,
      edges: wfEdges,
      variables: overrides?.variables ?? workflowVariables,
      hostProfiles: workflowHostProfiles,
      authProfiles: workflowAuthProfiles,
      services: overrides?.services ?? workflowServicesRef.current,
      errorConfig: overrides?.errorConfig !== undefined ? overrides.errorConfig : workflowErrorConfig,
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
    });
    setSaveAcknowledged(true);

    // Register workflow with server so webhooks can trigger it.
    const hasWebhookTrigger = wfNodes.some((n) => n.type === 'webhook');
    if (hasWebhookTrigger) {
      const wf = {
        id: selected.id,
        name: selected.name,
        nodes: wfNodes,
        edges: wfEdges,
        variables: overrides?.variables ?? workflowVariables,
      };
      fetch(`/api/workflows/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wf),
      }).catch(() => { /* server may not be running */ });
    }
  }, [
    selected, nodesRef, edgesRef, workflowVariables, workflowHostProfiles, workflowAuthProfiles,
    workflowErrorConfig, update, serializeNodes, serializeEdges,
  ]);

  const insertNodeAndPersist = useCallback((newNode: WorkflowRFNode, snapshotLabel: string) => {
    if (!selected) return;
    undoRedo.takeSnapshot(snapshotLabel);
    setNodes((nds) => {
      const updated = [...nds, newNode];
      nodesRef.current = updated;
      const wfNodes = serializeNodes(updated);
      const wfEdges = serializeEdges(edgesRef.current);
      queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
      return updated;
    });
  }, [selected, edgesRef, nodesRef, setNodes, serializeNodes, serializeEdges, update, undoRedo]);

  const handleCopyNode = useCallback((nodeId?: string) => {
    clipboard.copyNode(nodeId);
  }, [clipboard]);

  const handlePasteNode = useCallback(() => {
    if (!selected) return;
    const y = nextNodeYRef.current;
    nextNodeYRef.current += 120;
    const newNode = clipboard.buildPasteNode({ x: 340, y });
    if (!newNode) return;
    insertNodeAndPersist(newNode as WorkflowRFNode, 'Paste node');
    toast.show('info', 'Node pasted', `"${(newNode.data as { label?: string }).label}"`);
  }, [selected, clipboard, insertNodeAndPersist, toast, nextNodeYRef]);

  const handleDuplicateNode = useCallback((nodeId?: string) => {
    if (!selected) return;
    const newNode = clipboard.buildDuplicateNode(nodeId);
    if (!newNode) return;
    const srcNode = nodesRef.current.find((n) => n.id === (nodeId ?? selectedNodeId));
    insertNodeAndPersist(newNode as WorkflowRFNode, 'Duplicate node');
    toast.show(
      'info',
      'Node duplicated',
      `"${(srcNode?.data as { label?: string })?.label}" → "${(newNode.data as { label?: string }).label}"`,
    );
  }, [selected, selectedNodeId, clipboard, insertNodeAndPersist, toast, nodesRef]);

  const handleUndoAction = useCallback(() => {
    const label = undoRedo.undo();
    if (label) toast.show('info', `Undo: ${label}`);
  }, [undoRedo, toast]);

  const handleRedoAction = useCallback(() => {
    const label = undoRedo.redo();
    if (label) toast.show('info', `Redo: ${label}`);
  }, [undoRedo, toast]);

  const handleSave = useCallback(() => {
    if (previewWorkflow) return;
    if (!selected) return;

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Auto-create a version snapshot before saving
    const wfNodes = serializeNodes(currentNodes);
    const wfEdges = serializeEdges(currentEdges);
    const version = createWorkflowVersion(
      wfNodes,
      wfEdges,
      workflowVariables,
      workflowServices,
      selected.versions ?? [],
    );

    if (version) {
      const updatedVersions = addVersionToList(selected.versions ?? [], version);
      update(selected.id, { versions: updatedVersions });
    }

    persistWorkflow();
    toast.show('success', 'Workflow saved', `${currentNodes.length} nodes · ${currentEdges.length} connections`);
  }, [persistWorkflow, previewWorkflow, toast, nodesRef, edgesRef, selected, serializeNodes, serializeEdges, workflowVariables, workflowServices, update]);

  useEffect(() => {
    if (!saveAcknowledged) return;
    const t = window.setTimeout(() => setSaveAcknowledged(false), 2200);
    return () => window.clearTimeout(t);
  }, [saveAcknowledged]);

  const handleUpdateWorkflowVariables = useCallback((vars: Record<string, string>) => {
    workflowVariablesRef.current = vars;
    setWorkflowVariables(vars);
    persistWorkflow({ variables: vars });
  }, [persistWorkflow, setWorkflowVariables, workflowVariablesRef]);

  /** Persist SLA targets for the selected workflow (design-time primary edit — SLA-B8). */
  const handleUpdateWorkflowSlaTargets = useCallback((targets: SlaTarget[]) => {
    if (!selected) return;
    update(selected.id, { slaTargets: targets });
  }, [selected, update]);

  return {
    serializeNodes,
    serializeEdges,
    persistWorkflow,
    insertNodeAndPersist,
    saveAcknowledged,
    setSaveAcknowledged,
    handleCopyNode,
    handlePasteNode,
    handleDuplicateNode,
    handleUndoAction,
    handleRedoAction,
    handleSave,
    handleUpdateWorkflowVariables,
    handleUpdateWorkflowSlaTargets,
    /** Update the services ref immediately (before React re-render) so persistWorkflow sees the latest value. */
    workflowServicesRef,
  };
}
