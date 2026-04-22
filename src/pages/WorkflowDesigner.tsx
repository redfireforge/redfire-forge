import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type OnConnect,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import type { RequestCollection, Scenario, Environment, Microservice, RequestResult, GlobalAuthProfile } from '../types';
import type { CatalogEntry } from '../types/catalog';
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeData,
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  NodeRunStatus,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
} from '../types/workflow';
import {
  collectConditionVariableHints,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
} from '../utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl } from '../utils/workflowHostResolve';
import { resolveQuickTestHostForRequest } from '../utils/workflowRequestHost';
import type { WorkflowHook } from '../hooks/useWorkflows';
import { runGraph, type GraphRunCallbacks } from '../engine/workflow/graphRunner';
import { fetchScenarioSample } from '../engine/workflow/fetchScenarioSample';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';
import { mergeWorkflowNodeData, cloneWorkflowNodeDataForStorage } from '../utils/workflowNodeMerge';
import { checkEnvReadiness } from '../utils/workflowEnvReadiness';
import { WorkflowNodeRunContext } from '../components/workflow/WorkflowNodeRunContext';

import WorkflowToolbar from '../components/workflow/WorkflowToolbar';
import WorkflowPalette from '../components/workflow/WorkflowPalette';
import WorkflowConfigPanel from '../components/workflow/WorkflowConfigPanel';
import WorkflowStatusBar from '../components/workflow/WorkflowStatusBar';
import VariableContextBadge from '../components/workflow/VariableContextBar';
import { WorkflowInspectProvider } from '../components/workflow/WorkflowInspectContext';
import WorkflowDetailModal from '../components/workflow/WorkflowDetailModal';
import WorkflowNodeContextMenu from '../components/workflow/WorkflowNodeContextMenu';
import WorkflowServiceRegistryModal from '../components/workflow/WorkflowServiceRegistryModal';
import WorkflowServicesPanelInline from '../components/workflow/WorkflowServicesPanelInline';
import HttpStepNode from '../components/workflow/nodes/HttpStepNode';
import ConditionNode from '../components/workflow/nodes/ConditionNode';
import DelayNode from '../components/workflow/nodes/DelayNode';

interface Props {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  wfHook: WorkflowHook;
  /**
   * Same Environment + Microservice selection as Harness; Quick Test injects `{{baseUrl}}`.
   * Initial variables override if you set `baseUrl` there explicitly.
   */
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  selectedSvcId: string;
  onEnvSelect: (id: string) => void;
  onSvcSelect: (id: string) => void;
  resolvedBaseUrl: string;
}

interface WorkflowNodeContextMenuData {
  x: number;
  y: number;
  nodeId: string;
}

const nodeTypes = {
  http: HttpStepNode,
  condition: ConditionNode,
  delay: DelayNode,
};

type WorkflowRFNode = Node<WorkflowNodeData, WorkflowNodeType>;
type WorkflowRFEdge = Edge;

function makeEmptyScenario(): Scenario {
  return {
    id: uuidv4(), name: 'New Request', url: '', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  };
}

function defaultNodeData(type: WorkflowNodeType): WorkflowNodeData {
  switch (type) {
    case 'http': return { label: 'HTTP Request', scenario: makeEmptyScenario(), initialVariables: {} } as HttpNodeData;
    case 'condition': return { label: 'If/Else', left: '{{status}}', operator: '==', right: '200' } as ConditionNodeData;
    case 'delay': return { label: 'Delay', delayMs: 1000, mode: 'fixed' } as DelayNodeData;
  }
}

export default function WorkflowDesigner({
  collections,
  catalogEntries,
  wfHook,
  environments,
  microservices,
  globalAuthProfiles,
  selectedEnvId,
  selectedSvcId: _selectedSvcId,
  onEnvSelect,
  onSvcSelect: _onSvcSelect,
  resolvedBaseUrl,
}: Props) {
  const { workflows, selected, create, update, select } = wfHook;

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowRFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowRFEdge>([]);
  /** Always read latest graph in Quick Test (avoids stale closures if React batches updates). */
  const nodesRef = useRef<WorkflowRFNode[]>(nodes);
  const edgesRef = useRef<WorkflowRFEdge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeRunStatus>>({});
  /**
   * Per-node initialVariables stored completely outside React Flow state.
   * React Flow's internal state management drops custom data fields; keeping
   * initialVariables in a separate state guarantees they survive RF updates.
   */
  const [nodeInitialVars, setNodeInitialVars] = useState<Record<string, Record<string, string>>>({});
  const nodeInitialVarsRef = useRef(nodeInitialVars);
  nodeInitialVarsRef.current = nodeInitialVars;
  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [workflowHostProfiles, setWorkflowHostProfiles] = useState<WorkflowHostProfile[]>([]);
  const [workflowAuthProfiles, setWorkflowAuthProfiles] = useState<WorkflowAuthProfile[]>([]);
  const [workflowServices, setWorkflowServices] = useState<WorkflowService[]>([]);
  const [serviceRegistryMode, setServiceRegistryMode] = useState<'closed' | 'panel' | 'fullscreen'>('closed');
  const workflowVariablesRef = useRef(workflowVariables);
  workflowVariablesRef.current = workflowVariables;
  /** Last Quick Test variable snapshot (for canvas badge); not persisted as workflow defaults. */
  const [runVariableSnapshot, setRunVariableSnapshot] = useState<Record<string, string> | null>(null);
  const [lastRunStatus, setLastRunStatus] = useState<'idle' | 'running' | 'pass' | 'fail'>('idle');
  const [lastRunTime, setLastRunTime] = useState<number | undefined>();
  const [lastRunError, setLastRunError] = useState<string | null>(null);
  const [lastQuickTestRequestUrl, setLastQuickTestRequestUrl] = useState<string | null>(null);
  const [extractionSampleJson, setExtractionSampleJson] = useState('');
  const [extractionFetching, setExtractionFetching] = useState(false);
  const [extractionFetchError, setExtractionFetchError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<
    null | { type: 'step'; nodeId: string } | { type: 'variable'; key: string } | { type: 'runError' }
  >(null);
  const [variableDetailDraft, setVariableDetailDraft] = useState('');
  const [saveAcknowledged, setSaveAcknowledged] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextNodeY = useRef(100);

  // Resizable panels
  const [paletteWidth, setPaletteWidth] = useState(260);
  const [configWidth, setConfigWidth] = useState(320);
  const dragRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null);
  const [nodeCtxMenu, setNodeCtxMenu] = useState<WorkflowNodeContextMenuData | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { side, startX, startW } = dragRef.current;
      const delta = e.clientX - startX;
      if (side === 'left') {
        setPaletteWidth(Math.max(180, Math.min(500, startW + delta)));
      } else {
        setConfigWidth(Math.max(220, Math.min(600, startW - delta)));
      }
    };
    const onMouseUp = () => { dragRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // Sync canvas whenever the selected workflow changes (from sidebar or internal)
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
      }));
      setNodes(rfNodes);
      setEdges(rfEdges);
      setSelectedNodeId(null);
      setNodeStatuses({});
      setWorkflowVariables(selected.variables ?? {});
      setWorkflowHostProfiles(selected.hostProfiles ?? []);
      setWorkflowAuthProfiles(selected.authProfiles ?? []);
      setWorkflowServices(selected.services ?? []);
      setRunVariableSnapshot(null);
      setLastRunStatus('idle');
      // Populate per-node initialVariables from saved workflow data (outside React Flow)
      const ivMap: Record<string, Record<string, string>> = {};
      for (const n of selected.nodes) {
        if (isHttpWorkflowNode(n) && n.data.initialVariables) {
          ivMap[n.id] = { ...n.data.initialVariables };
        }
      }
      setNodeInitialVars(ivMap);
      const ys = selected.nodes.map(n => (n.position?.y ?? 0) + 120);
      nextNodeY.current = ys.length ? Math.max(100, ...ys) : 100;
    } else if (!selected) {
      prevSelectedId.current = null;
    }
  }, [selected, setNodes, setEdges]);

  // Compute selected node from React Flow nodes for config panel
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find(n => n.id === selectedNodeId);
    if (!n) return null;
    let data = n.data;
    if (isHttpWorkflowNode(n)) {
      // Use state-managed initialVariables instead of React Flow's node data
      const iv = nodeInitialVars[n.id];
      data = { ...data, initialVariables: iv ?? {} };
    }
    return { id: n.id, type: n.type, position: n.position, data } as WorkflowNode;
  }, [selectedNodeId, nodes, nodeInitialVars]);

  const hintNodes = useMemo<WorkflowNode[]>(() => (
    nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
  ), [nodes]);

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
    if (!selectedNode || selectedNode.type !== 'condition') return [];
    return collectConditionVariableHints(
      hintNodes,
      hintEdges,
      selectedNode.id,
      workflowVariables,
    );
  }, [selectedNode, hintNodes, hintEdges, workflowVariables]);

  const httpVariableHints = useMemo(() => {
    if (!selectedNodeId) return [];
    const raw = nodes.find((x) => x.id === selectedNodeId);
    if (!raw || !isHttpWorkflowNode(raw)) return [];
    const httpData = raw.data;
    const base = collectConditionVariableHints(
      hintNodes,
      hintEdges,
      selectedNodeId,
      workflowVariables,
    );
    return mergeHttpVariableHintsWithStepInitialVars(base, httpData);
  }, [selectedNodeId, nodes, hintNodes, hintEdges, workflowVariables]);

  const effectiveQuickTestBaseUrl = useMemo(() => {
    if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const custom = resolveHttpNodeBaseUrl(selectedNode.data, microservices, workflowHostProfiles, workflowServices, selectedEnvId);
      if (custom) return custom;
    }
    return resolvedBaseUrl;
  }, [selectedNode, microservices, resolvedBaseUrl, workflowHostProfiles, workflowServices, selectedEnvId]);

  const resolveHttpBaseUrlForGraph = useCallback(
    (data: HttpNodeData) => resolveHttpNodeBaseUrl(data, microservices, workflowHostProfiles, workflowServices, selectedEnvId),
    [microservices, workflowHostProfiles, workflowServices, selectedEnvId],
  );

  const resolveHttpAuthForGraph = useCallback(
    (data: HttpNodeData) => {
      // Service Registry auth (new path — uses endpoint matrix)
      if (data.serviceId && workflowServices.length) {
        const svc = workflowServices.find((s) => s.id === data.serviceId);
        if (svc) {
          // New model: check endpoint for custom auth
          if (svc.endpoints?.length && selectedEnvId) {
            const ep = svc.endpoints.find((e) => e.envId === selectedEnvId && e.enabled)
              ?? svc.endpoints.find((e) => e.envId === '__all__' && e.enabled);
            if (ep && ep.authMode === 'custom' && ep.auth) return ep.auth;
            // "inherit" → resolve from environment (microservice authProfileIds)
            if (svc.microserviceId) {
              const ms = microservices.find((m) => m.id === svc.microserviceId);
              if (ms?.authProfileIds?.[selectedEnvId]) {
                const profile = globalAuthProfiles.find((g) => g.id === ms.authProfileIds![selectedEnvId]);
                if (profile?.auth) return profile.auth;
              }
            }
          }
          // Fallback: defaultAuth (new) or legacy fields
          if (svc.defaultAuth) return svc.defaultAuth;
          if (selectedEnvId && svc.authPerEnv?.[selectedEnvId]) return svc.authPerEnv[selectedEnvId];
          return svc.auth;
        }
      }
      // Legacy path
      if (!data.authProfileId) return undefined;
      return workflowAuthProfiles.find((p) => p.id === data.authProfileId)?.auth;
    },
    [workflowAuthProfiles, workflowServices, selectedEnvId, microservices, globalAuthProfiles],
  );

  useEffect(() => {
    setExtractionSampleJson('');
    setExtractionFetchError(null);
  }, [selected?.id, selectedNodeId]);

  const handleExtractionFetchSample = useCallback(async () => {
    if (!selectedNode || !isHttpWorkflowNode(selectedNode)) {
      setExtractionFetchError('Select an HTTP step and open Pick path from the Extract tab.');
      return;
    }
    const scenario = selectedNode.data.scenario;
    setExtractionFetching(true);
    setExtractionFetchError(null);
    try {
      const httpData = selectedNode.data;
      const fetchBase = resolveHttpNodeBaseUrl(httpData, microservices, workflowHostProfiles, workflowServices, selectedEnvId) ?? resolvedBaseUrl;

      const mergedVars = { ...workflowVariables, ...(nodeInitialVarsRef.current[selectedNode.id] ?? httpData.initialVariables ?? {}) };
      const result = await fetchScenarioSample(
        scenario,
        mergedVars,
        fetchBase,
        {
          fetchHostEnabled: !!scenario.fetchHostEnabled,
          fetchHostOverride: scenario.fetchHostOverride ?? '',
        },
      );
      if (result.ok) {
        setExtractionSampleJson(result.body);
      } else {
        setExtractionFetchError(result.error);
      }
    } finally {
      setExtractionFetching(false);
    }
  }, [selectedNode, workflowVariables, microservices, resolvedBaseUrl]);

  const openStepDetail = useCallback((nodeId: string) => {
    setDetailModal({ type: 'step', nodeId });
  }, []);

  const openVariableDetail = useCallback((key: string) => {
    if (selectedNode?.type === 'http') {
      const iv = nodeInitialVarsRef.current[selectedNode.id];
      setVariableDetailDraft(iv?.[key] ?? '');
    } else {
      setVariableDetailDraft(workflowVariables[key] ?? '');
    }
    setDetailModal({ type: 'variable', key });
  }, [workflowVariables, selectedNode]);

  const openRunErrorDetail = useCallback(() => {
    if (lastRunError?.trim()) setDetailModal({ type: 'runError' });
  }, [lastRunError]);

  const inspectActions = useMemo(
    () => ({ openStepDetail, openVariableDetail }),
    [openStepDetail, openVariableDetail],
  );

  const stepDetailMeta = useMemo(() => {
    if (detailModal?.type !== 'step') return { title: '', body: '' };
    const n = nodes.find(x => x.id === detailModal.nodeId);
    const label = n && isHttpWorkflowNode(n) ? n.data.label : 'HTTP step';
    const rs = nodeStatuses[detailModal.nodeId];
    const body = rs?.responseDetail ?? rs?.error ?? 'No details available. Run Quick Test again.';
    return { title: label, body };
  }, [detailModal, nodes, nodeStatuses]);

  const handleNew = useCallback(() => {
    const name = prompt('Workflow name:');
    if (!name?.trim()) return;
    create(name.trim());
  }, [create]);

  const handleSelect = useCallback((id: string) => {
    select(id);
  }, [select]);


  // Save current canvas state to the workflow
  const handleSave = useCallback(() => {
    if (!selected) return;
    const wfNodes: WorkflowNode[] = nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: cloneWorkflowNodeDataForStorage(
        isHttpWorkflowNode(n)
          ? { ...n.data, initialVariables: nodeInitialVarsRef.current[n.id] ?? n.data.initialVariables }
          : n.data,
      ),
    }));
    const wfEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));
    update(selected.id, {
      nodes: wfNodes,
      edges: wfEdges,
      variables: workflowVariables,
      hostProfiles: workflowHostProfiles,
      authProfiles: workflowAuthProfiles,
      services: workflowServices,
      schemaVersion: 3,
    });
    setSaveAcknowledged(true);
  }, [selected, nodes, edges, workflowVariables, workflowHostProfiles, workflowAuthProfiles, workflowServices, update]);

  useEffect(() => {
    if (!saveAcknowledged) return;
    const t = window.setTimeout(() => setSaveAcknowledged(false), 2200);
    return () => window.clearTimeout(t);
  }, [saveAcknowledged]);

  const onConnect: OnConnect = useCallback((params) => {
    const newEdge: Edge = {
      ...params,
      id: uuidv4(),
      animated: false,
      label: params.sourceHandle === 'true' ? 'Yes' : params.sourceHandle === 'false' ? 'No' : undefined,
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

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

  const addNodeToCanvas = useCallback((type: WorkflowNodeType, data?: WorkflowNodeData) => {
    if (!selected) return;
    const y = nextNodeY.current;
    nextNodeY.current += 120;
    const newNode: WorkflowRFNode = {
      id: uuidv4(),
      type,
      position: { x: 300, y },
      data: data ?? defaultNodeData(type),
    };
    setNodes((nds) => [...nds, newNode]);
  }, [selected, setNodes]);

  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    addNodeToCanvas(type);
  }, [addNodeToCanvas]);

  const handleAddFromRequest = useCallback((collectionId: string, requestId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col) return;

    let req = col.requests.find(r => r.id === requestId);
    if (!req) {
      const searchFolders = (folders?: import('../types').RequestFolder[]): import('../types').RequestItem | undefined => {
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

  /** Shallow-merge into the latest node `data` so concurrent edits (HTTP config vs initial variables) never drop fields. */
  const handleUpdateNode = useCallback((id: string, patch: Partial<WorkflowNodeData>) => {
    // Route initialVariables to separate state (outside React Flow)
    if ('initialVariables' in patch) {
      const iv = (patch as Partial<HttpNodeData>).initialVariables ?? {};
      const updated = { ...iv };
      nodeInitialVarsRef.current = { ...nodeInitialVarsRef.current, [id]: updated };
      setNodeInitialVars((prev) => ({ ...prev, [id]: updated }));
      // Don't pass initialVariables into React Flow node data — it drops them
      const { initialVariables: _iv, ...restPatch } = patch as Partial<HttpNodeData>;
      if (Object.keys(restPatch).length === 0) return; // pure initialVariables update, skip RF
      patch = restPatch;
    }
    setNodes((nds) => {
      const next = nds.map(n => (n.id === id
        ? { ...n, data: mergeWorkflowNodeData(n.data, patch) }
        : n));
      nodesRef.current = next;
      return next;
    });
  }, [setNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter(n => n.id !== id));
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
    setNodeInitialVars((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowRFNode) => {
    setSelectedNodeId(node.id);
    setServiceRegistryMode((m) => m === 'panel' ? 'closed' : m);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setNodeCtxMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: WorkflowRFNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setNodeCtxMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  const handleUpdateWorkflowVariables = useCallback((vars: Record<string, string>) => {
    workflowVariablesRef.current = vars;
    setWorkflowVariables(vars);
  }, []);

  const handleApplyVariableDetail = useCallback(() => {
    if (detailModal?.type !== 'variable') return;
    const key = detailModal.key;
    if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const nodeId = selectedNode.id;
      setNodeInitialVars((prev) => {
        const updatedVars = { ...(prev[nodeId] ?? {}), [key]: variableDetailDraft };
        nodeInitialVarsRef.current[nodeId] = { ...updatedVars };
        return { ...prev, [nodeId]: updatedVars };
      });
    } else {
      setWorkflowVariables((prev) => ({ ...prev, [key]: variableDetailDraft }));
    }
    setDetailModal(null);
  }, [detailModal, variableDetailDraft, selectedNode]);


  // ── Quick Test ───────────────────────────────────────

  const handleQuickTest = useCallback(() => {
    if (isRunning) {
      abortRef.current?.abort();
      return;
    }

    if (!selected || nodes.length === 0) return;

    // Pre-flight: check env readiness for all services
    if (selectedEnvId && workflowServices.length) {
      const readiness = checkEnvReadiness(selectedEnvId, workflowServices);
      if (!readiness.ready) {
        const names = readiness.issues.map((i) => i.serviceName).join(', ');
        const envLabel = environments.find((e) => e.id === selectedEnvId)?.name ?? selectedEnvId;
        alert(`Cannot run on "${envLabel}" — missing configuration for: ${names}.\n\nOpen Service Registry to configure these services for this environment.`);
        return;
      }
    }

    setIsRunning(true);
    setLastRunStatus('running');
    setLastRunError(null);
    setLastQuickTestRequestUrl(null);
    setNodeStatuses({});

    abortRef.current = new AbortController();

    const liveWorkflowVariables = workflowVariablesRef.current;
    const wfNodes: WorkflowNode[] = nodesRef.current.map((n) => {
      const base = { id: n.id, type: n.type, position: n.position };
      if (!isHttpWorkflowNode(n)) {
        return { ...base, data: cloneWorkflowNodeDataForStorage(n.data) };
      }
      const d = n.data;
      // Use the ref-backed store as source of truth for initialVariables (survives React Flow state resets)
      const refVars = nodeInitialVarsRef.current[n.id];
      const merged: HttpNodeData = {
        ...d,
        initialVariables: { ...liveWorkflowVariables, ...(refVars ?? d.initialVariables ?? {}) },
      };
      return { ...base, data: cloneWorkflowNodeDataForStorage(merged) };
    });
    const wfEdges = edgesRef.current.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));

    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (nodeId, status) => {
        setNodeStatuses(prev => ({ ...prev, [nodeId]: status }));
      },
      onVariablesChange: (vars) => {
        setRunVariableSnapshot(vars);
      },
      onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => {
        setIsRunning(false);
        setLastRunStatus(passed ? 'pass' : 'fail');
        setLastRunTime(durationMs);
        if (!passed) {
          const fail = results.find((r) => !r.passed);
          setLastRunError(fail ? summarizeRequestFailure(fail) : 'One or more steps failed.');
        } else {
          setLastRunError(null);
        }
        const urlForDebug = results.find((r) => !r.passed)?.url ?? results[results.length - 1]?.url;
        setLastQuickTestRequestUrl(urlForDebug ?? null);
      },
    };

    const envLayer: Record<string, string> = {};
    // Only inject legacy baseUrl when no Service Registry services are configured
    if (!workflowServices.length) {
      const bu = resolvedBaseUrl.trim();
      if (bu) envLayer.baseUrl = bu.replace(/\/$/, '');
    }

    runGraph(
      wfNodes,
      wfEdges,
      liveWorkflowVariables,
      callbacks,
      abortRef.current.signal,
      envLayer,
      resolveHttpBaseUrlForGraph,
      resolveHttpAuthForGraph,
    ).catch(() => {
      setIsRunning(false);
      setLastRunStatus('fail');
      setLastRunError('Workflow run failed or was interrupted.');
    });
  }, [
    isRunning,
    selected,
    nodes,
    edges,
    resolvedBaseUrl,
    resolveHttpBaseUrlForGraph,
    resolveHttpAuthForGraph,
    workflowHostProfiles,
    selectedEnvId,
    workflowServices,
    environments,
  ]);

  const variableCount = useMemo(() => {
    const s = new Set<string>(Object.keys(workflowVariables));
    for (const n of nodes) {
      if (n.type === 'http') {
        const iv = nodeInitialVars[n.id];
        if (iv) for (const k of Object.keys(iv)) s.add(k);
      }
    }
    return s.size;
  }, [workflowVariables, nodes, nodeInitialVars]);

  // ── Render ───────────────────────────────────────────

  if (!selected) {
    return (
      <div className="wf-designer">
        <div className="wf-empty-state">
          <div className="wf-empty-icon">⚡</div>
          <h2>Workflow Designer</h2>
          <p>Design multi-step API workflows with variable chaining, conditions, and delays.</p>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Select a workflow from the sidebar, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-designer">
      <WorkflowToolbar
        workflows={workflows} selected={selected} isRunning={isRunning} saveAcknowledged={saveAcknowledged}
        serviceCount={workflowServices.length}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onEnvSelect={onEnvSelect}
        workflowServices={workflowServices}
        onNew={handleNew} onSelect={handleSelect} onSave={handleSave} onQuickTest={handleQuickTest}
        onOpenServices={() => {
          setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
          setSelectedNodeId(null);
        }}
      />

      <WorkflowInspectProvider value={inspectActions}>
      <div className="wf-body">
        <div style={{ width: paletteWidth, flexShrink: 0 }}>
          <WorkflowPalette
            collections={collections}
            catalogEntries={catalogEntries}
            onAddNode={handleAddNode}
            onAddFromRequest={handleAddFromRequest}
            onAddFromCatalog={handleAddFromCatalog}
          />
        </div>

        <div
          className="wf-resize-handle"
          onMouseDown={(e) => { dragRef.current = { side: 'left', startX: e.clientX, startW: paletteWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        />

        <div className="wf-canvas-area">
          <WorkflowNodeRunContext.Provider value={nodeStatuses}>
            <ReactFlow<WorkflowRFNode, WorkflowRFEdge>
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={handleNodeContextMenu}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              fitView
              connectionMode={ConnectionMode.Loose}
              connectionRadius={40}
              deleteKeyCode={['Backspace', 'Delete']}
              edgesReconnectable
              defaultEdgeOptions={{ animated: false, style: { stroke: 'var(--border)', strokeWidth: 2 } }}
            >
              <Controls />
              <MiniMap pannable zoomable style={{ background: 'var(--surface)' }} />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            </ReactFlow>
          </WorkflowNodeRunContext.Provider>

          {Object.keys(runVariableSnapshot ?? workflowVariables).length > 0 && (
            <VariableContextBadge variables={runVariableSnapshot ?? workflowVariables} />
          )}

          <WorkflowNodeContextMenu
            open={!!nodeCtxMenu}
            x={nodeCtxMenu?.x ?? 0}
            y={nodeCtxMenu?.y ?? 0}
            onDelete={() => {
              if (!nodeCtxMenu) return;
              handleDeleteNode(nodeCtxMenu.nodeId);
            }}
            onClose={() => setNodeCtxMenu(null)}
          />
        </div>

        <div
          className="wf-resize-handle"
          onMouseDown={(e) => { dragRef.current = { side: 'right', startX: e.clientX, startW: configWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        />

        <div style={{ width: configWidth, flexShrink: 0 }}>
          {serviceRegistryMode === 'panel' ? (
            <WorkflowServicesPanelInline
              services={workflowServices}
              environments={environments}
              microservices={microservices}
              globalAuthProfiles={globalAuthProfiles}
              selectedEnvId={selectedEnvId}
              onExpand={() => setServiceRegistryMode('fullscreen')}
              onClose={() => setServiceRegistryMode('closed')}
            />
          ) : (
          <WorkflowConfigPanel
            node={selectedNode}
            workflowVariables={workflowVariables}
            onUpdateWorkflowVariables={handleUpdateWorkflowVariables}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            lastQuickTestRequestUrl={lastQuickTestRequestUrl}
            lastRunStepError={selectedNodeId ? nodeStatuses[selectedNodeId]?.error : undefined}
            effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
            extractionSampleResponseBody={extractionSampleJson}
            extractionFetchSample={{
              onFetch: handleExtractionFetchSample,
              fetching: extractionFetching,
              error: extractionFetchError,
            }}
            conditionVariableHints={conditionVariableHints}
            httpVariableHints={httpVariableHints}
            workflowServices={workflowServices}
          />
          )}
        </div>
      </div>

      <WorkflowDetailModal
        open={detailModal !== null}
        title={
          detailModal?.type === 'step'
            ? `Response — ${stepDetailMeta.title}`
            : detailModal?.type === 'variable'
              ? `Variable {{${detailModal.key}}}`
              : detailModal?.type === 'runError'
                ? 'Quick Test failed'
                : ''
        }
        subtitle={
          detailModal?.type === 'step'
            ? 'Last Quick Test result for this step'
            : detailModal?.type === 'variable'
              ? selectedNode?.type === 'http'
                ? 'Edit the value and click Apply to save to this step’s initial variables.'
                : 'Edit the value and click Apply to save to workflow defaults.'
              : detailModal?.type === 'runError'
                ? 'Full error message (same as the status line, not truncated).'
                : undefined
        }
        body={
          detailModal?.type === 'step'
            ? stepDetailMeta.body
            : detailModal?.type === 'runError'
              ? (lastRunError ?? '')
              : undefined
        }
        variableMode={detailModal?.type === 'variable'}
        variableValue={variableDetailDraft}
        onVariableChange={setVariableDetailDraft}
        onApplyVariable={detailModal?.type === 'variable' ? handleApplyVariableDetail : undefined}
        onClose={() => setDetailModal(null)}
      />

      </WorkflowInspectProvider>

      <WorkflowServiceRegistryModal
        open={serviceRegistryMode === 'fullscreen'}
        services={workflowServices}
        environments={environments}
        microservices={microservices}
        globalAuthProfiles={globalAuthProfiles}
        selectedEnvId={selectedEnvId}
        workflowName={selected?.name}
        onApply={(svcs) => {
          setWorkflowServices(svcs);
          // Sync node labels to updated service names
          const svcMap = new Map(svcs.map((s) => [s.id, s.name]));
          setNodes((nds) =>
            nds.map((n) => {
              if (!isHttpWorkflowNode(n) || !n.data.serviceId) return n;
              const newName = svcMap.get(n.data.serviceId);
              if (newName && n.data.label !== newName) {
                return { ...n, data: { ...n.data, label: newName } };
              }
              return n;
            }),
          );
          // Persist immediately so service changes survive a refresh
          if (selected) {
            const syncedNodes = nodes.map((n) => {
              if (!isHttpWorkflowNode(n) || !n.data.serviceId) return n;
              const newName = svcMap.get(n.data.serviceId);
              if (newName && n.data.label !== newName) {
                return { ...n, data: { ...n.data, label: newName } };
              }
              return n;
            });
            const wfNodes: WorkflowNode[] = syncedNodes.map(n => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: cloneWorkflowNodeDataForStorage(
                isHttpWorkflowNode(n)
                  ? { ...n.data, initialVariables: nodeInitialVarsRef.current[n.id] ?? n.data.initialVariables }
                  : n.data,
              ),
            }));
            const wfEdges = edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              label: typeof e.label === 'string' ? e.label : undefined,
            }));
            update(selected.id, {
              nodes: wfNodes,
              edges: wfEdges,
              variables: workflowVariables,
              hostProfiles: workflowHostProfiles,
              authProfiles: workflowAuthProfiles,
              services: svcs,
              schemaVersion: 3,
            });
            setSaveAcknowledged(true);
          }
        }}
        onClose={() => setServiceRegistryMode('closed')}
      />

      <WorkflowStatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        variableCount={variableCount}
        lastRunStatus={lastRunStatus}
        lastRunTime={lastRunTime}
        lastRunError={lastRunError}
        onOpenRunError={openRunErrorDetail}
      />
    </div>
  );
}
