import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, RequestCollection, Environment, Microservice, GlobalAuthProfile, AuthConfig, KeyValue } from '../../../shared/types';
import type { CatalogEntry } from '../../catalog/types/catalog';
import type {
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeData,
  HttpNodeData,
  SubWorkflowNodeData,
  WorkflowService,
  ServiceEndpoint,
} from '../types/workflow';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { defaultNodeData } from '../utils/workflowNodeFactory';
import { mergeWorkflowNodeData } from '../utils/workflowNodeMerge';
import { resolveQuickTestHostForRequest } from '../utils/workflowRequestHost';
import { extractToSubWorkflow } from '../utils/workflowExtractSubWorkflow';
import { resolveServiceBaseUrl, stripTrailingSlash } from '../utils/workflowHostResolve';
import type { Workflow } from '../types/workflow';
import type { ToastApi } from '../components/WorkflowToastProvider';
import { findEndpointInEntry } from '../../catalog/utils/catalogTree';
import { findRequestInCollection } from '../../requests/utils/requestTree';
import { markNodeAsNew } from '../components/panels/WorkflowNewNodeContext';

/**
 * Build a WorkflowService from a collection's microservice configuration.
 * Returns `undefined` when the collection has no linked microservice.
 */
export function buildServiceFromCollection(
  col: RequestCollection,
  microservices: Microservice[],
  environments: Environment[],
  globalAuthProfiles: GlobalAuthProfile[],
  existingServices: WorkflowService[],
): WorkflowService | undefined {
  if (!col.microserviceId) return undefined;
  const ms = microservices.find(m => m.id === col.microserviceId);
  if (!ms) return undefined;

  const existing = existingServices.find(s => s.microserviceId === ms.id);
  if (existing) return existing;

  const endpoints: ServiceEndpoint[] = [];

  const allEnvs = [...environments, ...(ms.customEnvs ?? [])];
  for (const env of allEnvs) {
    const url = ms.baseUrls[env.id] ?? '';
    const authProfileId = ms.authProfileIds?.[env.id];
    const authProfile = authProfileId
      ? globalAuthProfiles.find(p => p.id === authProfileId)
      : undefined;

    endpoints.push({
      envId: env.id,
      url,
      enabled: !!url,
      authMode: authProfile ? 'custom' : 'inherit',
      auth: authProfile?.auth,
      source: 'microservice',
    });
  }

  let defaultAuth: AuthConfig | undefined;
  if (col.auth && col.auth.type !== 'none') {
    defaultAuth = col.auth;
  }

  return {
    id: uuidv4(),
    name: ms.name,
    endpoints,
    defaultAuth,
    microserviceId: ms.id,
  };
}

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
  toast: ToastApi;
  /** Shared Y-cursor ref for placing newly-added nodes; provided by parent so other hooks can read/advance it. */
  nextNodeYRef: React.MutableRefObject<number>;
  /** Current workflow services for auto-service creation. */
  workflowServices?: WorkflowService[];
  setWorkflowServices?: React.Dispatch<React.SetStateAction<WorkflowService[]>>;
  globalAuthProfiles?: GlobalAuthProfile[];
  /** Mutable ref to update services immediately so persistWorkflow sees latest value before React re-renders. */
  workflowServicesRef?: React.MutableRefObject<WorkflowService[]>;
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
  nextNodeYRef,
  workflowServices = [],
  setWorkflowServices,
  globalAuthProfiles = [],
  workflowServicesRef,
}: UseWorkflowNodeActionsOpts) {

  const addNodeToCanvas = useCallback((type: WorkflowNodeType, data?: WorkflowNodeData, serviceOverride?: WorkflowService[]) => {
    if (!selected) return;
    undoRedo.takeSnapshot('Add node');
    const y = nextNodeYRef.current;
    nextNodeYRef.current += 120;
    const nodeId = uuidv4();
    const newNode: WorkflowRFNode = {
      id: nodeId,
      type,
      position: { x: 300, y },
      data: data ?? defaultNodeData(type),
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      nodesRef.current = updated;
      const wfNodes = serializeNodes(updated);
      const wfEdges = serializeEdges(edgesRef.current);
      const patch: Partial<Workflow> = { nodes: wfNodes as WorkflowNode[], edges: wfEdges };
      if (serviceOverride) patch.services = serviceOverride;
      queueMicrotask(() => update(selected.id, patch));
      return updated;
    });
    markNodeAsNew(nodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, update, serializeNodes, serializeEdges, edgesRef, nodesRef, undoRedo, setNodes]);

  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    addNodeToCanvas(type);
  }, [addNodeToCanvas]);

  const handleAddFromRequest = useCallback((collectionId: string, requestId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return;

    const req = findRequestInCollection(col, requestId);
    if (!req) return;

    const scenario: Scenario = {
      id: uuidv4(), name: req.name, url: req.url, method: req.method as Scenario['method'],
      headers: req.headers ?? [], body: req.body ?? '', bodyType: req.bodyType,
      bodyForm: req.bodyForm, auth: req.auth ?? { type: 'none' }, validation: { mode: 'none' },
      sourceRequestId: req.id,
      sourceSpecVersionId: req.activeSpecVersionId,
      sourceSpecVersionLabel: req.specVersions?.find(v => v.id === req.activeSpecVersionId)?.catalogVersion,
    };
    const hostPatch = resolveQuickTestHostForRequest(
      col,
      req,
      selectedEnvId,
      resolvedBaseUrl,
      microservices,
      environments,
    );

    const autoService = setWorkflowServices
      ? buildServiceFromCollection(col, microservices, environments, globalAuthProfiles, workflowServices)
      : undefined;
    if (autoService) {
      scenario.auth = { type: 'inherit' } as Scenario['auth'];
      const svcBase = resolveServiceBaseUrl(autoService, microservices, selectedEnvId);
      if (svcBase) {
        const base = stripTrailingSlash(svcBase);
        if (scenario.url.startsWith(base)) {
          scenario.url = scenario.url.slice(base.length) || '/';
        }
      }
    }

    const data: HttpNodeData = {
      label: req.name,
      scenario,
      sourceType: 'requests',
      sourceId: req.id,
      sourceSpecVersionId: req.activeSpecVersionId,
      sourceSpecVersionLabel: req.specVersions?.find(v => v.id === req.activeSpecVersionId)?.catalogVersion,
      specVersionMode: 'latest',
      ...(autoService ? { serviceId: autoService.id } : hostPatch),
    };

    if (autoService && setWorkflowServices) {
      const isNew = !workflowServices.some(s => s.id === autoService.id);
      if (isNew) {
        const updated = [...workflowServices, autoService];
        setWorkflowServices(updated);
        // Update the ref immediately so persistWorkflow (called by wrappedOnNodesChange
        // in response to the new node) sees the new service before React re-renders.
        if (workflowServicesRef) workflowServicesRef.current = updated;
      }
    }

    const serviceOverride = (autoService && !workflowServices.some(s => s.id === autoService.id))
      ? [...workflowServices, autoService]
      : undefined;
    addNodeToCanvas('http', data, serviceOverride);
  }, [collections, addNodeToCanvas, selectedEnvId, resolvedBaseUrl, microservices, environments, workflowServices, setWorkflowServices, globalAuthProfiles, workflowServicesRef]);

  const handleAddFromCatalog = useCallback((entryId: string, endpointId: string) => {
    const entry = catalogEntries.find(e => e.id === entryId);
    if (!entry) return;

    const ep = findEndpointInEntry(entry, endpointId);
    if (!ep) return;

    const baseUrl = entry.servers[0]?.url ?? '';
    const wv = ep.workflowValues;
    const paramValues = wv?.paramValues ?? {};

    const params = ep.parameters ?? [];
    let resolvedPath = ep.path;
    for (const p of params.filter(p => p.in === 'path')) {
      const val = paramValues[p.name];
      if (val) resolvedPath = resolvedPath.replaceAll(`{${p.name}}`, encodeURIComponent(val));
    }

    const queryParts: string[] = [];
    for (const p of params.filter(p => p.in === 'query')) {
      const val = paramValues[p.name];
      if (val) queryParts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
    }

    const fullPath = queryParts.length > 0 ? `${resolvedPath}?${queryParts.join('&')}` : resolvedPath;
    const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${fullPath}` : fullPath;

    const headerValues = wv?.headerValues ?? {};
    const headers: KeyValue[] = params
      .filter(p => p.in === 'header')
      .map(p => ({ key: p.name, value: headerValues[p.name] ?? '' }));
    for (const [k, v] of Object.entries(headerValues)) {
      if (v && !headers.some(h => h.key === k)) headers.push({ key: k, value: v });
    }

    const scenario: Scenario = {
      id: uuidv4(), name: ep.summary || ep.path, url,
      method: ep.method.toUpperCase() as Scenario['method'],
      headers, body: wv?.body ?? '', auth: { type: 'none' }, validation: { mode: 'none' },
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
    const deletedNode = nodesRef.current.find(n => n.id === id);
    const deletedServiceId = (deletedNode?.data as HttpNodeData | undefined)?.serviceId;

    setNodes((nds) => {
      const remaining = nds.filter(n => n.id !== id);

      if (deletedServiceId && setWorkflowServices) {
        const stillUsed = remaining.some(n =>
          (n.data as HttpNodeData | undefined)?.serviceId === deletedServiceId,
        );
        if (!stillUsed) {
          setWorkflowServices(prev => {
            const next = prev.filter(s => s.id !== deletedServiceId);
            queueMicrotask(() => persistWorkflow({ services: next, rfNodes: remaining }));
            return next;
          });
          return remaining;
        }
      }
      nodesRef.current = remaining;
      queueMicrotask(() => persistWorkflow({ rfNodes: remaining }));
      return remaining;
    });
    setEdges((eds) => {
      const next = eds.filter(e => e.source !== id && e.target !== id);
      edgesRef.current = next;
      return next;
    });
    setNodeInitialVars((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedNodeId === id) setSelectedNodeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render
  }, [setNodes, setEdges, selectedNodeId, setSelectedNodeId, setNodeInitialVars, nodesRef, edgesRef, setWorkflowServices, persistWorkflow]);

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
     
  }, [selected, serializeNodes, serializeEdges, workflows, create, update, setNodes, setEdges, persistWorkflow, toast, nodesRef, edgesRef, undoRedo]);

  return {
    nextNodeYRef,
    addNodeToCanvas,
    handleAddNode,
    handleAddFromRequest,
    handleAddFromCatalog,
    handleUpdateNode,
    handleDeleteNode,
    handleExtractToSubWorkflow,
  } as const;
}
