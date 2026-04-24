import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  MiniMap,
  Background,
  BackgroundVariant,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  applyNodeChanges,
  type OnConnect,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
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
  StartNodeData,
  ForkNodeData,
  JoinNodeData,
  EndNodeData,
  WebhookTriggerNodeData,
  ScheduleTriggerNodeData,
  NodeRunStatus,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  Workflow,
} from '../types/workflow';
import {
  collectConditionVariableHints,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
} from '../utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl, resolveServiceAuth, stripTrailingSlash } from '../utils/workflowHostResolve';
import { resolveQuickTestHostForRequest } from '../utils/workflowRequestHost';
import type { WorkflowHook } from '../hooks/useWorkflows';
import { runGraph, type GraphRunCallbacks } from '../engine/workflow/graphRunner';
import { fetchScenarioSample } from '../engine/workflow/fetchScenarioSample';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';
import { mergeWorkflowNodeData, cloneWorkflowNodeDataForStorage } from '../utils/workflowNodeMerge';
import { checkEnvReadiness } from '../utils/workflowEnvReadiness';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';
import { WorkflowNodeRunContext, WorkflowDebugStepContext } from '../components/workflow/WorkflowNodeRunContext';
import { useResizablePanels } from '../hooks/useResizablePanels';

import WorkflowToolbar from '../components/workflow/WorkflowToolbar';
import WorkflowPalette from '../components/workflow/WorkflowPalette';
import WorkflowNodeConfigModal from '../components/workflow/WorkflowNodeConfigModal';
import WorkflowDefaultsModal from '../components/workflow/WorkflowDefaultsModal';
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
import StartNode from '../components/workflow/nodes/StartNode';
import ForkNode from '../components/workflow/nodes/ForkNode';
import JoinNode from '../components/workflow/nodes/JoinNode';
import EndNode from '../components/workflow/nodes/EndNode';
import WebhookTriggerNode from '../components/workflow/nodes/WebhookTriggerNode';
import ScheduleTriggerNode from '../components/workflow/nodes/ScheduleTriggerNode';
import { DebugController } from '../engine/workflow/debugController';
import WorkflowDebugBar from '../components/workflow/WorkflowDebugBar';

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
  /** Read-only sample workflow preview (not persisted). */
  previewWorkflow: Workflow | null;
  onClearPreview: () => void;
  onUseAsTemplate: (wf: Workflow) => void;
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
  start: StartNode,
  fork: ForkNode,
  join: JoinNode,
  end: EndNode,
  webhook: WebhookTriggerNode,
  schedule: ScheduleTriggerNode,
};

/** Enrich a React Flow node with state-managed initialVariables. */
function enrichNodeData(
  n: WorkflowRFNode,
  nodeInitialVars: Record<string, Record<string, string>>,
): WorkflowNode {
  let data = n.data;
  if (isHttpWorkflowNode(n)) {
    const iv = nodeInitialVars[n.id];
    data = { ...data, initialVariables: iv ?? {} };
  }
  return { id: n.id, type: n.type, position: n.position, data } as WorkflowNode;
}

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
    case 'start': return { label: 'Start', inputVariables: {} } as StartNodeData;
    case 'fork': return { label: 'Parallel Fork' } as ForkNodeData;
    case 'join': return { label: 'Join' } as JoinNodeData;
    case 'end': return { label: 'End' } as EndNodeData;
    case 'webhook': return { 
      label: 'Webhook Trigger', 
      method: 'POST', 
      path: '/api/webhook', 
      samplePayload: '{\n  "event": "example",\n  "data": {}\n}',
      extractVariables: []
    } as WebhookTriggerNodeData;
    case 'schedule': return {
      label: 'Schedule Trigger',
      cronExpression: '0 9 * * MON-FRI',
      timezone: 'America/New_York',
      scheduleDescription: 'Every weekday at 9:00 AM EST',
      inputVariables: {}
    } as ScheduleTriggerNodeData;
  }
}

export default function WorkflowDesignerWrapper(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner {...props} />
    </ReactFlowProvider>
  );
}

function AutoLayoutButton({ nodes, edges, setNodes, persistWorkflow, selected, previewWorkflow, serializeNodes, bumpLayoutVersion }: {
  nodes: WorkflowRFNode[];
  edges: WorkflowRFEdge[];
  setNodes: (nodes: WorkflowRFNode[] | ((nds: WorkflowRFNode[]) => WorkflowRFNode[])) => void;
  persistWorkflow: (overrides?: { rfNodes?: WorkflowRFNode[] }) => void;
  selected: Workflow | null;
  previewWorkflow: Workflow | null;
  serializeNodes: (rfNodes: WorkflowRFNode[]) => WorkflowNode[];
  bumpLayoutVersion: () => void;
}) {
  const { fitView, getNodes, setNodes: rfSetNodes } = useReactFlow<WorkflowRFNode>();
  return (
    <>
      <ControlButton
        onClick={() => {
          // Restore saved positions (revert manual moves without recalculating)
          if (selected) {
            setNodes((nds) => nds.map(n => {
              const saved = selected.nodes.find(sn => sn.id === n.id);
              return saved ? { ...n, position: saved.position } : n;
            }));
            requestAnimationFrame(() => fitView({ padding: 0.2 }));
          }
        }}
        title="Restore saved layout"
        disabled={!!previewWorkflow}
      >
        <svg viewBox="0 0 24 24">
          <rect x="7" y="1" width="10" height="6" rx="1" />
          <rect x="1" y="17" width="10" height="6" rx="1" />
          <rect x="13" y="17" width="10" height="6" rx="1" />
          <rect x="11" y="7" width="2" height="4" />
          <rect x="5" y="11" width="2" height="6" />
          <rect x="6" y="10" width="12" height="2" />
          <rect x="17" y="11" width="2" height="6" />
        </svg>
      </ControlButton>
      <ControlButton
        onClick={() => {
          console.log('=== AUTO-LAYOUT CLICKED ===');
          
          const laid = getAutoLayoutNodes(nodes, edges);
          console.log('After (calculated):', laid.map(n => ({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) })));
          
          // Update state with new positions
          setNodes(laid);
          // Force React Flow to remount with new positions
          bumpLayoutVersion();
          
          // Persist if not preview
          if (!previewWorkflow) {
            setTimeout(() => {
              persistWorkflow({ rfNodes: laid });
            }, 100);
          }
          
          requestAnimationFrame(() => {
            fitView({ padding: 0.2, duration: 300 });
          });
        }}
        title={previewWorkflow ? "Auto-layout preview (click 'Use as Template' to save)" : "Auto-layout and save positions"}
      >
        <svg viewBox="0 0 24 24">
          <rect x="7" y="1" width="10" height="5" rx="1" />
          <rect x="1" y="18" width="10" height="5" rx="1" />
          <rect x="13" y="18" width="10" height="5" rx="1" />
          <rect x="11" y="6" width="2" height="4" />
          <rect x="5" y="10" width="2" height="8" />
          <rect x="6" y="10" width="12" height="2" />
          <rect x="17" y="10" width="2" height="8" />
          <path d="M19 3 L21 5 L19 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="5" x2="21" y2="5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </ControlButton>
    </>
  );
}

function WorkflowDesignerInner({
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
  previewWorkflow,
  onClearPreview,
  onUseAsTemplate,
}: Props) {
  const { workflows, selected: selectedWorkflow, create, update, select } = wfHook;
  const selected = previewWorkflow ?? selectedWorkflow;
  const { paletteWidth, startDrag } = useResizablePanels();

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowRFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowRFEdge>([]);
  /** Bumped to force React Flow remount when programmatic layout changes don't visually update. */
  const [layoutVersion, setLayoutVersion] = useState(0);
  /** Always read latest graph in Quick Test (avoids stale closures if React batches updates). */
  const nodesRef = useRef<WorkflowRFNode[]>(nodes);
  const edgesRef = useRef<WorkflowRFEdge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /** Node being configured in the full-screen config modal (null = closed). */
  const [configModalNodeId, setConfigModalNodeId] = useState<string | null>(null);
  /** Whether the workflow-defaults modal is open. */
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
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
  const [nodeCtxMenu, setNodeCtxMenu] = useState<WorkflowNodeContextMenuData | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // DEBUG: Log nodes whenever they change
  useEffect(() => {
    console.log('🔄 NODES STATE CHANGED:', nodes.map(n => ({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) })));
  }, [nodes]);

  // Compute selected node from React Flow nodes for config panel
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find(n => n.id === selectedNodeId);
    if (!n) return null;
    return enrichNodeData(n, nodeInitialVars);
  }, [selectedNodeId, nodes, nodeInitialVars]);

  /** Node being configured in the config modal (derived from configModalNodeId). */
  const configModalNode = useMemo(() => {
    if (!configModalNodeId) return null;
    const n = nodes.find(n => n.id === configModalNodeId);
    if (!n) return null;
    return enrichNodeData(n, nodeInitialVars);
  }, [configModalNodeId, nodes, nodeInitialVars]);

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
    // Use state-managed initialVariables so hints stay in sync with the modal
    const iv = nodeInitialVars[selectedNodeId];
    const httpData = { ...raw.data, initialVariables: iv ?? {} } as HttpNodeData;
    const base = collectConditionVariableHints(
      hintNodes,
      hintEdges,
      selectedNodeId,
      workflowVariables,
    );
    return mergeHttpVariableHintsWithStepInitialVars(base, httpData);
  }, [selectedNodeId, nodes, nodeInitialVars, hintNodes, hintEdges, workflowVariables]);

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
      // Service Registry auth (delegates to shared resolver)
      const svcAuth = resolveServiceAuth(data, workflowServices, selectedEnvId, microservices, globalAuthProfiles);
      if (svcAuth) return svcAuth;
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

  const openNodeConfig = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setConfigModalNodeId(nodeId);
  }, []);

  const inspectActions = useMemo(
    () => ({ openStepDetail, openVariableDetail, openNodeConfig }),
    [openStepDetail, openVariableDetail, openNodeConfig],
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
    onClearPreview();
    create(name.trim());
  }, [create, onClearPreview]);

  const handleSelect = useCallback((id: string) => {
    onClearPreview();
    select(id);
  }, [select, onClearPreview]);


  /** Serialize React Flow nodes to workflow storage format. */
  const serializeNodes = useCallback((rfNodes: WorkflowRFNode[]): WorkflowNode[] =>
    rfNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: cloneWorkflowNodeDataForStorage(
        isHttpWorkflowNode(n)
          ? { ...n.data, initialVariables: nodeInitialVarsRef.current[n.id] ?? n.data.initialVariables }
          : n.data,
      ),
    })), []);

  /** Serialize React Flow edges to workflow storage format. */
  const serializeEdges = useCallback((rfEdges: WorkflowRFEdge[]) =>
    rfEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    })), []);

  /** Persist the current canvas to the workflow store. */
  const persistWorkflow = useCallback((overrides?: { services?: WorkflowService[]; rfNodes?: WorkflowRFNode[]; variables?: Record<string, string> }) => {
    if (!selected) return;
    const wfNodes = serializeNodes(overrides?.rfNodes ?? nodes);
    const wfEdges = serializeEdges(edges);
    update(selected.id, {
      nodes: wfNodes,
      edges: wfEdges,
      variables: overrides?.variables ?? workflowVariables,
      hostProfiles: workflowHostProfiles,
      authProfiles: workflowAuthProfiles,
      services: overrides?.services ?? workflowServices,
      schemaVersion: 3,
    });
    setSaveAcknowledged(true);
  }, [selected, nodes, edges, workflowVariables, workflowHostProfiles, workflowAuthProfiles, workflowServices, update, serializeNodes, serializeEdges]);

  // Save current canvas state — preserves current positions as-is
  const handleSave = useCallback(() => {
    if (previewWorkflow) return;
    persistWorkflow();
  }, [persistWorkflow, previewWorkflow]);

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
    setEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      // Auto-save edges when a new connection is made
      if (selected) {
        const wfNodes = serializeNodes(nodes);
        const wfEdges = updated.map(e => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          label: typeof e.label === 'string' ? e.label : undefined,
        }));
        update(selected.id, { nodes: wfNodes, edges: wfEdges });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setNodes((nds) => {
      const updated = [...nds, newNode];
      // Auto-save so the new node is persisted immediately
      const wfNodes = updated.map(n => ({
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
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        label: typeof e.label === 'string' ? e.label : undefined,
      }));
      update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges });
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, edges, update]);

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
      // Auto-persist with updated nodes
      persistWorkflow({ rfNodes: next });
      return next;
    });
  }, [setNodes, persistWorkflow]);

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
    persistWorkflow({ variables: vars });
  }, [persistWorkflow]);

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
      if (bu) envLayer.baseUrl = stripTrailingSlash(bu);
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

  // ── Debug Mode ───────────────────────────────────────

  const [isDebugMode, setIsDebugMode] = useState(false);
  const debugControllerRef = useRef<DebugController | null>(null);

  const handleDebugQuickTest = useCallback(() => {
    if (isRunning) {
      // Stop debug
      debugControllerRef.current?.stop();
      abortRef.current?.abort();
      return;
    }
    if (!selected || nodes.length === 0) return;

    // Pre-flight same as handleQuickTest
    if (selectedEnvId && workflowServices.length) {
      const readiness = checkEnvReadiness(selectedEnvId, workflowServices);
      if (!readiness.ready) {
        const names = readiness.issues.map((i) => i.serviceName).join(', ');
        const envLabel = environments.find((e) => e.id === selectedEnvId)?.name ?? selectedEnvId;
        alert(`Cannot run on "${envLabel}" — missing configuration for: ${names}.\n\nOpen Service Registry to configure these services for this environment.`);
        return;
      }
    }

    const dc = new DebugController();
    debugControllerRef.current = dc;
    setIsRunning(true);
    setIsDebugMode(true);
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
        setIsDebugMode(false);
        debugControllerRef.current = null;
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
    if (!workflowServices.length) {
      const bu = resolvedBaseUrl.trim();
      if (bu) envLayer.baseUrl = stripTrailingSlash(bu);
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
      dc,
    ).catch(() => {
      setIsRunning(false);
      setIsDebugMode(false);
      debugControllerRef.current = null;
      setLastRunStatus('fail');
      setLastRunError('Workflow debug run failed or was interrupted.');
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

  const handleDebugStep = useCallback((nodeId: string) => {
    debugControllerRef.current?.stepNode(nodeId);
  }, []);

  const handleDebugStop = useCallback(() => {
    debugControllerRef.current?.stop();
    abortRef.current?.abort();
  }, []);

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
        variableCount={variableCount}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onEnvSelect={onEnvSelect}
        workflowServices={workflowServices}
        isPreview={!!previewWorkflow}
        onNew={handleNew} onSelect={handleSelect} onSave={handleSave}
        onQuickTest={handleQuickTest}
        onDebugTest={handleDebugQuickTest}
        isDebugMode={isDebugMode}
        onOpenServices={() => {
          setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
          setSelectedNodeId(null);
        }}
        onOpenDefaults={() => setShowDefaultsModal(true)}
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
          onMouseDown={(e) => startDrag('left', e)}
        />

        <div className="wf-canvas-area">
          {previewWorkflow && (
            <div className="wf-preview-banner">
              <span>📚 Sample Preview: <strong>{previewWorkflow.name}</strong></span>
              <span className="wf-preview-desc">{previewWorkflow.description}</span>
              <div className="wf-preview-actions">
                <button className="btn btn-sm btn-primary" onClick={() => {
                  // Capture current visual layout (may have been auto-laid)
                  const currentNodes = serializeNodes(nodes);
                  onUseAsTemplate({ ...previewWorkflow, nodes: currentNodes });
                }}>Use as Template</button>
                <button className="btn btn-sm" onClick={onClearPreview}>Close Preview</button>
              </div>
            </div>
          )}
          <WorkflowNodeRunContext.Provider value={nodeStatuses}>
          <WorkflowDebugStepContext.Provider value={isDebugMode ? handleDebugStep : null}>
            <ReactFlow<WorkflowRFNode, WorkflowRFEdge>
              key={layoutVersion}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={(_event, node) => openNodeConfig(node.id)}
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
              <Controls>
                <AutoLayoutButton nodes={nodes} edges={edges} setNodes={setNodes} persistWorkflow={persistWorkflow} selected={selected} previewWorkflow={previewWorkflow} serializeNodes={serializeNodes} bumpLayoutVersion={() => setLayoutVersion(v => v + 1)} />
              </Controls>
              <MiniMap
                pannable
                zoomable
                style={{ background: 'var(--surface)' }}
                nodeColor={(node) => {
                  const status = nodeStatuses[node.id];
                  if (status?.state === 'fail') return '#ef4444';
                  if (status?.state === 'running') return '#eab308';
                  if (status?.state === 'pass') return '#22c55e';
                  if (status?.state === 'skipped') return '#94a3b8';
                  if (node.type === 'condition') return '#a78bfa';
                  if (node.type === 'delay') return '#94a3b8';
                  if (node.type === 'start') return '#22c55e';
                  if (node.type === 'fork') return '#a855f7';
                  return '#3b82f6';
                }}
              />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            </ReactFlow>
          </WorkflowDebugStepContext.Provider>
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

        {serviceRegistryMode === 'panel' && (
          <>
            <div
              className="wf-resize-handle"
              onMouseDown={(e) => startDrag('right', e)}
            />
            <div style={{ width: 320, flexShrink: 0 }}>
              <WorkflowServicesPanelInline
                services={workflowServices}
                environments={environments}
                microservices={microservices}
                globalAuthProfiles={globalAuthProfiles}
                selectedEnvId={selectedEnvId}
                onExpand={() => setServiceRegistryMode('fullscreen')}
                onClose={() => setServiceRegistryMode('closed')}
              />
            </div>
          </>
        )}
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

      {configModalNode && (
        <WorkflowNodeConfigModal
          node={configModalNode}
          workflowVariables={workflowVariables}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setConfigModalNodeId(null)}
          workflowId={selected?.id}
          lastQuickTestRequestUrl={lastQuickTestRequestUrl}
          lastRunStepError={configModalNodeId ? nodeStatuses[configModalNodeId]?.error : undefined}
          effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
          resolveBaseUrl={resolveHttpBaseUrlForGraph}
          fallbackBaseUrl={resolvedBaseUrl}
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

      <WorkflowDefaultsModal
        open={showDefaultsModal}
        workflowVariables={workflowVariables}
        onUpdateWorkflowVariables={handleUpdateWorkflowVariables}
        onClose={() => setShowDefaultsModal(false)}
        workflowServices={workflowServices}
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
          const syncedNodes = nodes.map((n) => {
            if (!isHttpWorkflowNode(n) || !n.data.serviceId) return n;
            const newName = svcMap.get(n.data.serviceId);
            if (newName && n.data.label !== newName) {
              return { ...n, data: { ...n.data, label: newName } };
            }
            return n;
          });
          setNodes(syncedNodes);
          // Persist immediately so service changes survive a refresh
          persistWorkflow({ services: svcs, rfNodes: syncedNodes });
        }}
        onClose={() => setServiceRegistryMode('closed')}
      />

      {isDebugMode && debugControllerRef.current && (
        <WorkflowDebugBar
          debugController={debugControllerRef.current}
          onStop={handleDebugStop}
          variableCount={Object.keys(runVariableSnapshot ?? workflowVariables).length}
        />
      )}

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
