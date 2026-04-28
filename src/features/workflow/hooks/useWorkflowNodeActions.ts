import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, RequestCollection, Environment, Microservice } from '../../../shared/types';
import type { CatalogEntry } from '../../catalog/types/catalog';
import type {
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeData,
  HttpNodeData,
  SubWorkflowNodeData,
  WorkflowService,
} from '../types/workflow';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { defaultNodeData } from '../utils/workflowNodeFactory';
import { mergeWorkflowNodeData } from '../utils/workflowNodeMerge';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { resolveQuickTestHostForRequest } from '../utils/workflowRequestHost';
import { extractToSubWorkflow } from '../utils/workflowExtractSubWorkflow';
import type { Workflow } from '../types/workflow';
import type { UseToastReturn } from '../../../shared/hooks/useToast';

interface UseWorkflowNodeActionsOpts {
  selected: Workflow | null;
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  environments: Environment[];
  microservices: Microservice[];
  selectedEnvId: string;
  resolvedBaseUrl: string;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowRFNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowRFEdge[]>>;
  setNodeInitialVars: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  nodeInitialVarsRef: React.MutableRefObject<Record<string, Record<string, string>>>;
  nodesRef: React.MutableRefObject<WorkflowRFNode[]>;
  edgesRef: React.MutableRefObject<WorkflowRFEdge[]>;
  serializeNodes: (rfNodes: WorkflowRFNode[]) => WorkflowNode[];
  serializeEdges: (rfEdges: WorkflowRFEdge[]) => { id: string; source: string; target: string; sourceHandle?: string; label?: string }[];
  update: (id: string, patch: Partial<Workflow>) => void;
  persistWorkflow: (overrides?: { services?: WorkflowService[]; rfNodes?: WorkflowRFNode[]; variables?: Record<string, string> }) => void;
  undoRedo: { takeSnapshot: (label: string) => void };
  workflows: Workflow[];
  create: (name: string) => void;
  toast: UseToastReturn;
}

export function useWorkflowNodeActions({
  selected,
  collections,
  catalogEntries,
  environments,
  microservices,
  selectedEnvId,
  resolvedBaseUrl,
  selectedNodeId,
  setSelectedNodeId,
  setNodes,
  setEdges,
  setNodeInitialVars,
  nodeInitialVarsRef,
  nodesRef,
  edgesRef,
  serializeNodes,
  serializeEdges,
  update,
  persistWorkflow,
  undoRedo,
  workflows,
  create,
  toast,
}: UseWorkflowNodeActionsOpts) {
  const nextNodeY = useRef(100);

  const addNodeToCanvas = useCallback((type: WorkflowNodeType, data?: WorkflowNodeData) => {
    if (!selected) return;
    undoRedo.takeSnapshot('Add node');
    const y = nextNodeY.current;
    nextNodeY.current += 120;
    const newNode: WorkflowRFNode = {
      id: uuidv4(),
      type,
      position: { x: 300, y },
      data: data ?? defaultNodeData(type),
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      const wfNodes = serializeNodes(updated);
      const wfEdges = serializeEdges(edgesRef.current);
      queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, update, serializeNodes, serializeEdges, edgesRef, undoRedo, setNodes]);

  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    addNodeToCanvas(type);
  }, [addNodeToCanvas]);

  const handleAddFromRequest = useCallback((collectionId: string, requestId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return;

    let req = col.requests.find(r => r.id === requestId);
    if (!req) {
      const searchFolders = (folders?: import('../../../shared/types').RequestFolder[]): import('../../../shared/types').RequestItem | undefined => {
        if (!folders) return undefined;
        for (const f of folders) {
          const found = f.requests.find(r => r.id === requestId);
          if (found) return found;
          const deeper = searchFolders(f.folders);
          if (deeper) return deeper;
        }
        return undefined;
      };
      req = searchFolders(col.folders);
    }
    if (!req) return;

    const scenario: Scenario = {
      id: uuidv4(), name: req.name, url: req.url, method: req.method as Scenario['method'],
      headers: req.headers ?? [], body: req.body ?? '', bodyType: req.bodyType,
      bodyForm: req.bodyForm, auth: req.auth ?? { type: 'none' }, validation: { mode: 'none' },
    };
    const hostPatch = resolveQuickTestHostForRequest(
      col,
      req,
      selectedEnvId,
      resolvedBaseUrl,
      microservices,
      environments,
    );
    const data: HttpNodeData = {
      label: req.name,
      scenario,
      sourceType: 'requests',
      sourceId: req.id,
      ...hostPatch,
    };
    addNodeToCanvas('http', data);
  }, [collections, addNodeToCanvas, selectedEnvId, resolvedBaseUrl, microservices, environments]);

  const handleAddFromCatalog = useCallback((entryId: string, endpointId: string) => {
    const entry = catalogEntries.find(e => e.id === entryId);
    const ep = entry?.endpoints.find(e => e.id === endpointId);
    if (!ep || !entry) return;

    const baseUrl = entry.servers[0]?.url ?? '';
    const scenario: Scenario = {
      id: uuidv4(), name: ep.summary || ep.path, url: `${baseUrl}${ep.path}`,
      method: ep.method.toUpperCase() as Scenario['method'],
      headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
    };
    const data: HttpNodeData = { label: ep.summary || ep.path, scenario, sourceType: 'catalog', sourceId: ep.id };
    addNodeToCanvas('http', data);
  }, [catalogEntries, addNodeToCanvas]);

  const handleUpdateNode = useCallback((id: string, patch: Partial<WorkflowNodeData>) => {
    if ('initialVariables' in patch) {
      const iv = (patch as Partial<HttpNodeData>).initialVariables ?? {};
      const updated = { ...iv };
      nodeInitialVarsRef.current = { ...nodeInitialVarsRef.current, [id]: updated };
      setNodeInitialVars((prev) => ({ ...prev, [id]: updated }));
      const { initialVariables: _iv, ...restPatch } = patch as Partial<HttpNodeData>;
      if (Object.keys(restPatch).length === 0) {
        persistWorkflow();
        return;
      }
      patch = restPatch;
    }
    setNodes((nds) => {
      const next = nds.map(n => (n.id === id
        ? { ...n, data: mergeWorkflowNodeData(n.data, patch) }
        : n));
      nodesRef.current = next;
      queueMicrotask(() => persistWorkflow({ rfNodes: next }));
      return next;
    });
  }, [setNodes, persistWorkflow, nodeInitialVarsRef, setNodeInitialVars, nodesRef]);

  const handleDeleteNode = useCallback((id: string) => {
    undoRedo.takeSnapshot('Delete node');
    setNodes((nds) => nds.filter(n => n.id !== id));
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
    setNodeInitialVars((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedNodeId === id) setSelectedNodeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render
  }, [setNodes, setEdges, selectedNodeId, setSelectedNodeId, setNodeInitialVars]);

  const handleExtractToSubWorkflow = useCallback((nodeId: string) => {
    if (!selected) return;
    const childName = prompt('Sub-workflow name:');
    if (!childName?.trim()) return;

    const currentNodes = serializeNodes(nodesRef.current);
    const currentEdges = serializeEdges(edgesRef.current);
    const result = extractToSubWorkflow([nodeId], currentNodes, currentEdges, childName.trim());
    if (!result) {
      toast.show('warning', 'Cannot extract', 'Start and End nodes cannot be extracted.');
      return;
    }

    undoRedo.takeSnapshot('Extract to sub-workflow');
    create(result.childWorkflow.name);
    const newWf = workflows.find((w) => w.name === result.childWorkflow.name);
    if (newWf) {
      update(newWf.id, {
        nodes: result.childWorkflow.nodes,
        edges: result.childWorkflow.edges,
        variables: result.childWorkflow.variables,
      });
      (result.subWorkflowNode.data as SubWorkflowNodeData).workflowId = newWf.id;
      (result.subWorkflowNode.data as SubWorkflowNodeData).workflowName = result.childWorkflow.name;
    }

    setNodes((nds) => {
      const filtered = nds.filter((n) => !result.extractedNodeIds.has(n.id));
      return [...filtered, result.subWorkflowNode as WorkflowRFNode];
    });
    setEdges((eds) => eds.filter((e) => !result.extractedEdgeIds.has(e.id)));
    queueMicrotask(() => persistWorkflow());
    toast.show('success', 'Extracted', `Created sub-workflow "${childName.trim()}"`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo, create, update object identity
  }, [selected, serializeNodes, serializeEdges, workflows, create, update, setNodes, setEdges, persistWorkflow, toast, nodesRef, edgesRef, undoRedo]);

  return {
    nextNodeY,
    addNodeToCanvas,
    handleAddNode,
    handleAddFromRequest,
    handleAddFromCatalog,
    handleUpdateNode,
    handleDeleteNode,
    handleExtractToSubWorkflow,
  } as const;
}
