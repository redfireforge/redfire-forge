import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
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
  MarkerType,
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
  StartNodeData,
  ForkNodeData,
  JoinNodeData,
  EndNodeData,
  WebhookTriggerNodeData,
  ScheduleTriggerNodeData,
  SwitchNodeData,
  LoopNodeData,
  SetVariableNodeData,
  AggregateNodeData,
  ErrorHandlerNodeData,
  LogDebugNodeData,
  WaitForConditionNodeData,
  NodeRunStatus,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  WorkflowErrorConfig,
  Workflow,
} from '../types/workflow';
import {
  collectConditionVariableHints,
  collectWaitForConditionVariableHints,
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
import type { RunProgress } from '../components/workflow/WorkflowToolbar';
import WorkflowPalette from '../components/workflow/WorkflowPalette';
import WorkflowNodeConfigModal from '../components/workflow/WorkflowNodeConfigModal';
import WorkflowDefaultsModal from '../components/workflow/WorkflowDefaultsModal';
import WorkflowStatusBar from '../components/workflow/WorkflowStatusBar';
import WorkflowExecSummary from '../components/workflow/WorkflowExecSummary';
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
import SwitchNode from '../components/workflow/nodes/SwitchNode';
import LoopNode from '../components/workflow/nodes/LoopNode';
import SetVariableNode from '../components/workflow/nodes/SetVariableNode';
import AggregateNode from '../components/workflow/nodes/AggregateNode';
import ErrorHandlerNode from '../components/workflow/nodes/ErrorHandlerNode';
import LogDebugNode from '../components/workflow/nodes/LogDebugNode';
import WaitForConditionNode from '../components/workflow/nodes/WaitForConditionNode';
import { DebugController } from '../engine/workflow/debugController';
import WorkflowDebugBar from '../components/workflow/WorkflowDebugBar';
import WorkflowConsolePanel from '../components/workflow/WorkflowConsolePanel';
import { loadConsoleRunBehavior, loadConsoleOpen, saveConsoleOpen, type ConsoleRunBehavior } from '../utils/workflowSessionStorage';
import WorkflowCanvasControls from '../components/workflow/WorkflowCanvasControls';
import WorkflowShortcutsOverlay from '../components/workflow/WorkflowShortcutsOverlay';
import WorkflowCommandPalette from '../components/workflow/WorkflowCommandPalette';
import WorkflowToastProvider from '../components/workflow/WorkflowToastProvider';
import { useToast } from '../hooks/useToast';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useNodeClipboard } from '../hooks/useNodeClipboard';
import { useWorkflowRunCache } from '../hooks/useWorkflowRunCache';

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
  switch: SwitchNode,
  loop: LoopNode,
  setVariable: SetVariableNode,
  aggregate: AggregateNode,
  errorHandler: ErrorHandlerNode,
  logDebug: LogDebugNode,
  waitForCondition: WaitForConditionNode,
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
    case 'switch': return {
      label: 'Switch',
      expression: '{{status}}',
      cases: [],
    } as SwitchNodeData;
    case 'loop': return {
      label: 'Loop',
      mode: 'count',
      count: 3,
      indexVariable: 'i',
      maxIterations: 100,
    } as LoopNodeData;
    case 'setVariable': return {
      label: 'Set Variable',
      assignments: [],
    } as SetVariableNodeData;
    case 'aggregate': return {
      label: 'Aggregate',
      mappings: [],
    } as AggregateNodeData;
    case 'errorHandler': return {
      label: 'Error Handler',
      errorFilter: 'all',
      retryCount: 2,
      retryDelayMs: 1000,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: true,
    } as ErrorHandlerNodeData;
    case 'logDebug': return {
      label: 'Log',
      message: '',
      logLevel: 'info',
      snapshotVariables: false,
    } as LogDebugNodeData;
    case 'waitForCondition': return {
      label: 'Wait for Condition',
      conditionExpression: '',
      pollIntervalMs: 2000,
      timeoutMs: 30000,
      maxAttempts: 0,
    } as WaitForConditionNodeData;
  }
}

export default function WorkflowDesignerWrapper(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowToastProvider>
        <WorkflowDesignerInner {...props} />
      </WorkflowToastProvider>
    </ReactFlowProvider>
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
  onEnvSelect,
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
  /**
   * Tracks which workflow ID has completed auto-layout.
   * When a preview loads, this won't match `selected.id` until onInit finishes
   * auto-layout, so the canvas stays hidden (visibility:hidden) with zero flash.
   * Computed synchronously during render — no useEffect timing gap.
   */
  const [laidOutId, setLaidOutId] = useState<string | null>(null);
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
  const {
    nodeStatuses, setNodeStatuses,
    lastRunStatus, setLastRunStatus,
    lastRunTime, setLastRunTime,
    lastRunError, setLastRunError,
    runVariableSnapshot, setRunVariableSnapshot,
    history: runHistory,
    pushHistory: pushRunHistory,
    restoreFromHistory: restoreRunFromHistory,
    deleteHistoryEntry: deleteRunHistoryEntry,
    clearHistory: clearRunHistory,
    consoleLines, pushConsoleLine, clearConsole,
  } = useWorkflowRunCache(selected?.id ?? null);
  const [consoleOpen, setConsoleOpen] = useState(loadConsoleOpen);
  const consoleOpenRef = useRef(consoleOpen);
  const [consoleRunBehavior, setConsoleRunBehavior] = useState<ConsoleRunBehavior>(loadConsoleRunBehavior);
  const consoleRunBehaviorRef = useRef(consoleRunBehavior);
  useEffect(() => { consoleRunBehaviorRef.current = consoleRunBehavior; }, [consoleRunBehavior]);
  const consoleLinesRef = useRef(consoleLines);
  useEffect(() => { consoleLinesRef.current = consoleLines; }, [consoleLines]);
  const handleToggleConsole = useCallback(() => {
    setConsoleOpen(prev => {
      const next = !prev;
      consoleOpenRef.current = next;
      saveConsoleOpen(next);
      return next;
    });
  }, []);
  const handleCloseConsole = useCallback(() => {
    setConsoleOpen(false);
    consoleOpenRef.current = false;
    saveConsoleOpen(false);
  }, []);

  // ── Phase 5: Run progress tracking ──
  const runStartRef = useRef<number>(0);
  const [runElapsed, setRunElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    runStartRef.current = Date.now();
    setRunElapsed(0);
    const iv = window.setInterval(() => setRunElapsed(Date.now() - runStartRef.current), 250);
    return () => window.clearInterval(iv);
  }, [isRunning]);

  const runProgress = useMemo<RunProgress | null>(() => {
    if (lastRunStatus === 'idle') return null;
    const statuses = Object.values(nodeStatuses);
    const httpStatuses = statuses.filter(s => s.statusCode != null || s.state === 'pass' || s.state === 'fail' || s.state === 'running' || s.state === 'skipped');
    const totalNodes = nodes.filter(n => n.type === 'http').length;
    const completed = httpStatuses.filter(s => s.state === 'pass' || s.state === 'fail' || s.state === 'skipped').length;
    const failed = httpStatuses.filter(s => s.state === 'fail').length;
    const elapsed = lastRunStatus === 'running' ? runElapsed : (lastRunTime ?? 0);
    return { completed, total: totalNodes, failed, elapsedMs: elapsed, lastRunStatus };
  }, [nodeStatuses, nodes, lastRunStatus, lastRunTime, runElapsed]);

  const failedStepLabel = useMemo(() => {
    if (lastRunStatus !== 'fail') return null;
    for (const n of nodes) {
      if (n.type === 'http' && nodeStatuses[n.id]?.state === 'fail') {
        return (n.data as { label?: string }).label || null;
      }
    }
    return null;
  }, [lastRunStatus, nodes, nodeStatuses]);

  const latestStepSummaries = useMemo(() => {
    const latest = runHistory[0];
    return latest?.stepSummaries ?? [];
  }, [runHistory]);

  // Subscribe to server-side webhook execution logs via SSE
  const hasWebhookNode = nodes.some(n => n.type === 'webhook');
  useEffect(() => {
    if (!consoleOpen || !hasWebhookNode) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/logs/stream');
      es.onmessage = (event) => {
        try {
          const line = JSON.parse(event.data);
          pushConsoleLine(line);
        } catch { /* ignore malformed */ }
      };
      es.onerror = () => {
        // Server may not be running; silently reconnect or close
      };
    } catch { /* EventSource creation failed */ }
    return () => { es?.close(); };
  }, [consoleOpen, hasWebhookNode, pushConsoleLine]);
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
  const [workflowErrorConfig, setWorkflowErrorConfig] = useState<WorkflowErrorConfig | undefined>();
  const [serviceRegistryMode, setServiceRegistryMode] = useState<'closed' | 'panel' | 'fullscreen'>('closed');
  const workflowVariablesRef = useRef(workflowVariables);
  workflowVariablesRef.current = workflowVariables;
  /** Last Quick Test variable snapshot (for canvas badge); not persisted as workflow defaults. */
  const [lastQuickTestRequestUrl, setLastQuickTestRequestUrl] = useState<string | null>(null);
  const [activeRunHistoryId, setActiveRunHistoryId] = useState<string | null>(null);
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
  const [showMinimap, setShowMinimap] = useState(true);

  // ── Phase 6: Toast, Undo/Redo, Copy/Paste, Command Palette, Shortcuts ──
  const toast = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const rfInstance = useReactFlow();

  const undoRedo = useUndoRedo(
    () => nodesRef.current,
    () => edgesRef.current,
    (n) => setNodes(n as WorkflowRFNode[]),
    (e) => setEdges(e as WorkflowRFEdge[]),
  );

  // Clear undo stack on workflow switch
  // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render; only clear on workflow switch
  useEffect(() => { undoRedo.clear(); }, [selected?.id]);

  // Stable refs so the keyboard-shortcut handler can call these
  // without depending on them (they are declared later in the file).
  const handleQuickTestRef = useRef<() => void>(() => {});
  const handleDebugQuickTestRef = useRef<() => void>(() => {});

  const clipboard = useNodeClipboard({
    getNodes: () => nodesRef.current,
    selectedNodeId,
    toast,
  });

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
  const persistWorkflow = useCallback((overrides?: { services?: WorkflowService[]; rfNodes?: WorkflowRFNode[]; variables?: Record<string, string>; errorConfig?: WorkflowErrorConfig }) => {
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
      errorConfig: overrides?.errorConfig !== undefined ? overrides.errorConfig : workflowErrorConfig,
      schemaVersion: 3,
    });
    setSaveAcknowledged(true);

    // Register workflow with server so webhooks can trigger it
    const hasWebhookTrigger = wfNodes.some(n => n.type === 'webhook');
    if (hasWebhookTrigger) {
      const wf = { id: selected.id, name: selected.name, nodes: wfNodes, edges: wfEdges, variables: overrides?.variables ?? workflowVariables };
      fetch(`/api/workflows/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wf),
      }).catch(() => { /* server may not be running */ });
    }
  }, [selected, nodes, edges, workflowVariables, workflowHostProfiles, workflowAuthProfiles, workflowServices, workflowErrorConfig, update, serializeNodes, serializeEdges]);

  /** Insert a new node and persist. Shared by paste, duplicate, and drop. */
  const insertNodeAndPersist = useCallback((newNode: WorkflowRFNode, snapshotLabel: string) => {
    if (!selected) return;
    undoRedo.takeSnapshot(snapshotLabel);
    setNodes((nds) => {
      const updated = [...nds, newNode];
      const wfNodes = serializeNodes(updated);
      const wfEdges = serializeEdges(edges);
      queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
      return updated;
    });
  }, [selected, edges, setNodes, serializeNodes, serializeEdges, update, undoRedo]);

  const handleCopyNode = useCallback((nodeId?: string) => {
    clipboard.copyNode(nodeId);
  }, [clipboard]);

  const handlePasteNode = useCallback(() => {
    if (!selected) return;
    const y = nextNodeY.current;
    nextNodeY.current += 120;
    const newNode = clipboard.buildPasteNode({ x: 340, y });
    if (!newNode) return;
    insertNodeAndPersist(newNode as WorkflowRFNode, 'Paste node');
    toast.show('info', 'Node pasted', `"${(newNode.data as { label?: string }).label}"`);
  }, [selected, clipboard, insertNodeAndPersist, toast]);

  const handleDuplicateNode = useCallback((nodeId?: string) => {
    if (!selected) return;
    const newNode = clipboard.buildDuplicateNode(nodeId);
    if (!newNode) return;
    const srcNode = nodesRef.current.find((n) => n.id === (nodeId ?? selectedNodeId));
    insertNodeAndPersist(newNode as WorkflowRFNode, 'Duplicate node');
    toast.show('info', 'Node duplicated', `"${(srcNode?.data as { label?: string })?.label}" → "${(newNode.data as { label?: string }).label}"`);
  }, [selected, selectedNodeId, clipboard, insertNodeAndPersist, toast]);

  const handleUndoAction = useCallback(() => {
    const label = undoRedo.undo();
    if (label) toast.show('info', `Undo: ${label}`);
  }, [undoRedo, toast]);

  const handleRedoAction = useCallback(() => {
    const label = undoRedo.redo();
    if (label) toast.show('info', `Redo: ${label}`);
  }, [undoRedo, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // ? opens shortcuts (but not in input fields)
      if (e.key === '?' && !mod && !isInput) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (!previewWorkflow) {
            persistWorkflow();
            toast.show('success', 'Workflow saved');
          }
          break;
        case 'k':
          e.preventDefault();
          setShowCommandPalette((v) => !v);
          break;
        case 'j':
          e.preventDefault();
          handleToggleConsole();
          break;
        case 'enter':
          e.preventDefault();
          if (e.shiftKey) handleDebugQuickTestRef.current();
          else handleQuickTestRef.current();
          break;
        case 'l':
          if (!isInput) {
            e.preventDefault();
            const laid = getAutoLayoutNodes(nodesRef.current as WorkflowRFNode[], edgesRef.current as WorkflowRFEdge[]);
            setNodes(laid);
            setLayoutVersion((v) => v + 1);
          }
          break;
        case 'm':
          if (!isInput) { e.preventDefault(); setShowMinimap((v) => !v); }
          break;
        case '0':
          if (!isInput) { e.preventDefault(); rfInstance.fitView({ padding: 0.2, duration: 300 }); }
          break;
        case 'z':
          if (!isInput) {
            e.preventDefault();
            if (e.shiftKey) handleRedoAction();
            else handleUndoAction();
          }
          break;
        case 'c':
          if (!isInput) { e.preventDefault(); handleCopyNode(); }
          break;
        case 'v':
          if (!isInput) { e.preventDefault(); handlePasteNode(); }
          break;
        case 'd':
          if (!isInput) { e.preventDefault(); handleDuplicateNode(); }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, previewWorkflow, persistWorkflow, toast, handleToggleConsole, handleUndoAction, handleRedoAction, handleCopyNode, handlePasteNode, handleDuplicateNode, rfInstance, setNodes]);

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
      // Abort any in-flight Quick Test and reset running state
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
      // When loading a sample/preview, remount ReactFlow to trigger fitView
      if (previewWorkflow) {
        setLayoutVersion(v => v + 1);
      }
    } else if (!selected) {
      prevSelectedId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, setNodes, setEdges]);

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
    if (!selectedNode) return [];
    if (selectedNode.type === 'waitForCondition') {
      return collectWaitForConditionVariableHints(
        hintNodes,
        hintEdges,
        selectedNode.id,
        workflowVariables,
      );
    }
    if (['condition', 'switch', 'logDebug', 'loop', 'setVariable', 'aggregate'].includes(selectedNode.type)) {
      return collectConditionVariableHints(
        hintNodes,
        hintEdges,
        selectedNode.id,
        workflowVariables,
      );
    }
    return [];
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
        // Still load the response body (if any) so the user can inspect it
        if (result.body) {
          try { setExtractionSampleJson(JSON.stringify(JSON.parse(result.body), null, 2)); }
          catch { setExtractionSampleJson(result.body); }
        }
      }
    } finally {
      setExtractionFetching(false);
    }
  }, [selectedNode, workflowVariables, microservices, resolvedBaseUrl, selectedEnvId, workflowHostProfiles, workflowServices]);

  const openStepDetail = useCallback((nodeId: string) => {
    setDetailModal({ type: 'step', nodeId });
  }, []);

  const variableDetailApplyRef = useRef<((newValue: string) => void) | null>(null);

  const openVariableDetail = useCallback((key: string, currentValue?: string, onApply?: (newValue: string) => void) => {
    variableDetailApplyRef.current = onApply ?? null;
    if (currentValue !== undefined) {
      setVariableDetailDraft(currentValue);
    } else if (selectedNode?.type === 'http') {
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


  const handleSave = useCallback(() => {
    if (previewWorkflow) return;
    persistWorkflow();
    toast.show('success', 'Workflow saved', `${nodes.length} nodes · ${edges.length} connections`);
  }, [persistWorkflow, previewWorkflow, toast, nodes.length, edges.length]);

  useEffect(() => {
    if (!saveAcknowledged) return;
    const t = window.setTimeout(() => setSaveAcknowledged(false), 2200);
    return () => window.clearTimeout(t);
  }, [saveAcknowledged]);

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
      // Defer cross-component state update to avoid React warning
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
      const wfEdges = serializeEdges(edges);
      queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, edges, update, serializeNodes, serializeEdges]);

  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    addNodeToCanvas(type);
  }, [addNodeToCanvas]);

  // ── Drag-to-place from palette ──
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropTargetEdgeId, setDropTargetEdgeId] = useState<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  /** Find the closest edge to a flow-space point, within a threshold distance. */
  const findClosestEdge = useCallback((flowPos: { x: number; y: number }, threshold = 60): WorkflowRFEdge | null => {
    const rfNodes = nodesRef.current;
    const rfEdges = edgesRef.current;
    const nodeMap = new Map(rfNodes.map(n => [n.id, n]));

    // Special handles that indicate branching edges (should not be split)
    const branchHandles = new Set(['true', 'false', 'body', 'catch', 'done']);

    let bestEdge: WorkflowRFEdge | null = null;
    let bestDist = threshold;

    for (const edge of rfEdges) {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      if (!srcNode || !tgtNode) continue;
      // Skip edges from branching handles (condition true/false, errorHandler body/catch/done, etc.)
      if (edge.sourceHandle && branchHandles.has(edge.sourceHandle)) continue;
      // Also skip switch case handles
      if (edge.sourceHandle && edge.sourceHandle.startsWith('case-')) continue;

      // Approximate edge as line from source bottom-center to target top-center
      const sw = (srcNode.measured?.width ?? (srcNode as unknown as { width?: number }).width ?? 160);
      const sh = (srcNode.measured?.height ?? (srcNode as unknown as { height?: number }).height ?? 60);
      const tw = (tgtNode.measured?.width ?? (tgtNode as unknown as { width?: number }).width ?? 160);
      const sx = srcNode.position.x + sw / 2;
      const sy = srcNode.position.y + sh;
      const tx = tgtNode.position.x + tw / 2;
      const ty = tgtNode.position.y;

      // Point-to-segment distance
      const dx = tx - sx, dy = ty - sy;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1, ((flowPos.x - sx) * dx + (flowPos.y - sy) * dy) / lenSq));
      const px = sx + t * dx, py = sy + t * dy;
      const dist = Math.sqrt((flowPos.x - px) ** 2 + (flowPos.y - py) ** 2);

      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = edge;
      }
    }
    return bestEdge;
  }, []);

  const lastEdgeCheckTime = useRef(0);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/reactflow-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);

      // Throttle edge detection to ~60fps
      const now = performance.now();
      if (now - lastEdgeCheckTime.current > 16) {
        lastEdgeCheckTime.current = now;
        const flowPos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const closest = findClosestEdge(flowPos);
        setDropTargetEdgeId(prev => {
          const next = closest?.id ?? null;
          return prev === next ? prev : next;
        });
      }
    }
  }, [rfInstance, findClosestEdge]);

  const handleCanvasDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDropTargetEdgeId(null);
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropTargetEdgeId(null);
    const type = e.dataTransfer.getData('application/reactflow-type') as WorkflowNodeType;
    if (!type || !selected) return;

    // Convert screen coordinates to React Flow canvas coordinates
    const bounds = canvasAreaRef.current?.querySelector('.react-flow')?.getBoundingClientRect();
    if (!bounds) { addNodeToCanvas(type); return; }

    const position = rfInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const newNode: WorkflowRFNode = {
      id: uuidv4(),
      type,
      position,
      data: defaultNodeData(type),
    };

    // Check if dropping on an edge → split it
    const closestEdge = findClosestEdge(position);
    if (closestEdge) {
      undoRedo.takeSnapshot('Insert node on edge');
      const newEdge1: WorkflowRFEdge = {
        id: uuidv4(),
        source: closestEdge.source,
        target: newNode.id,
        sourceHandle: closestEdge.sourceHandle,
        label: closestEdge.label,
      };
      const newEdge2: WorkflowRFEdge = {
        id: uuidv4(),
        source: newNode.id,
        target: closestEdge.target,
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => {
        const updated = eds.filter(e2 => e2.id !== closestEdge.id).concat(newEdge1, newEdge2);
        const wfNodes = serializeNodes([...rfInstance.getNodes(), newNode]);
        const wfEdges = serializeEdges(updated);
        queueMicrotask(() => update(selected.id, { nodes: wfNodes as WorkflowNode[], edges: wfEdges }));
        return updated;
      });
      return;
    }

    insertNodeAndPersist(newNode, 'Add node');
  }, [selected, addNodeToCanvas, insertNodeAndPersist, rfInstance, findClosestEdge, setNodes, setEdges, serializeNodes, serializeEdges, update, undoRedo]);

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
      // Defer cross-component state update to avoid React warning
      queueMicrotask(() => persistWorkflow({ rfNodes: next }));
      return next;
    });
  }, [setNodes, persistWorkflow]);

  const handleDeleteNode = useCallback((id: string) => {
    undoRedo.takeSnapshot('Delete node');
    setNodes((nds) => nds.filter(n => n.id !== id));
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
    setNodeInitialVars((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedNodeId === id) setSelectedNodeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render
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
    // If a callback was provided by the caller (e.g. config modal draft), use it
    if (variableDetailApplyRef.current) {
      variableDetailApplyRef.current(variableDetailDraft);
    } else if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const nodeId = selectedNode.id;
      setNodeInitialVars((prev) => {
        const updatedVars = { ...(prev[nodeId] ?? {}), [key]: variableDetailDraft };
        nodeInitialVarsRef.current[nodeId] = { ...updatedVars };
        return { ...prev, [nodeId]: updatedVars };
      });
    } else {
      setWorkflowVariables((prev) => ({ ...prev, [key]: variableDetailDraft }));
    }
    variableDetailApplyRef.current = null;
    setDetailModal(null);
  }, [detailModal, variableDetailDraft, selectedNode]);

  // ── Phase 2: Derive edge execution states from nodeStatuses ──

  useEffect(() => {
    const statusKeys = Object.keys(nodeStatuses);
    if (statusKeys.length === 0) {
      // Reset all edge classes when run state is cleared
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


  // ── Quick Test ───────────────────────────────────────

  /** Shared logic for both normal and debug workflow runs. */
  const executeWorkflowRun = useCallback((debugController?: DebugController) => {
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
    if (debugController) setIsDebugMode(true);
    setLastRunStatus('running');
    setLastRunError(null);
    setLastQuickTestRequestUrl(null);
    setNodeStatuses({});
    if (consoleRunBehaviorRef.current === 'append' && consoleLinesRef.current.length > 0) {
      pushConsoleLine({ prefix: '---', text: `Run  ·  ${new Date().toLocaleTimeString()}`, ts: Date.now() });
    } else {
      clearConsole();
    }

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

    const runNodeStatuses: Record<string, NodeRunStatus> = {};
    let runVarSnap: Record<string, string> | null = null;
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (nodeId, status) => {
        runNodeStatuses[nodeId] = status;
        setNodeStatuses(prev => ({ ...prev, [nodeId]: status }));
      },
      onVariablesChange: (vars) => {
        runVarSnap = vars;
        setRunVariableSnapshot(vars);
      },
      onLog: (line) => { if (consoleOpenRef.current) pushConsoleLine(line); },
      onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => {
        setIsRunning(false);
        if (debugController) {
          setIsDebugMode(false);
          debugControllerRef.current = null;
        }
        setLastRunStatus(passed ? 'pass' : 'fail');
        setLastRunTime(durationMs);
        const errorMsg = !passed
          ? (results.find((r) => !r.passed) ? summarizeRequestFailure(results.find((r) => !r.passed)!) : 'One or more steps failed.')
          : null;
        setLastRunError(errorMsg);
        const urlForDebug = results.find((r) => !r.passed)?.url ?? results[results.length - 1]?.url;
        setLastQuickTestRequestUrl(urlForDebug ?? null);
        const stepSummaries = nodesRef.current
          .filter(n => runNodeStatuses[n.id] && n.type === 'http')
          .map(n => {
            const rs = runNodeStatuses[n.id];
            return {
              nodeId: n.id,
              label: (n.data as { label?: string }).label || n.id,
              state: rs.state === 'pass' ? 'pass' as const : rs.state === 'fail' ? 'fail' as const : 'skipped' as const,
              statusCode: rs.statusCode,
              responseTimeMs: rs.responseTimeMs,
              error: rs.error,
            };
          });
        const histId = pushRunHistory({
          timestamp: Date.now(),
          durationMs,
          passed,
          nodeStatuses: { ...runNodeStatuses },
          variableSnapshot: runVarSnap ? { ...runVarSnap } : null,
          stepsExecuted: results.length,
          stepSummaries,
          error: errorMsg,
        });
        setActiveRunHistoryId(histId);
      },
    };

    const envLayer: Record<string, string> = {};
    if (!workflowServices.length && !previewWorkflow) {
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
      debugController,
      workflowErrorConfig,
    ).catch(() => {
      setIsRunning(false);
      if (debugController) {
        setIsDebugMode(false);
        debugControllerRef.current = null;
      }
      setLastRunStatus('fail');
      setLastRunError(debugController ? 'Workflow debug run failed or was interrupted.' : 'Workflow run failed or was interrupted.');
    });
  }, [
    selected,
    nodes,
    resolvedBaseUrl,
    resolveHttpBaseUrlForGraph,
    resolveHttpAuthForGraph,
    selectedEnvId,
    workflowServices,
    environments,
    clearConsole,
    pushConsoleLine,
    pushRunHistory,
    workflowErrorConfig,
    setNodeStatuses,
    setLastRunStatus,
    setLastRunTime,
    setLastRunError,
    setRunVariableSnapshot,
    previewWorkflow,
  ]);

  const handleQuickTest = useCallback(() => {
    if (isRunning) {
      abortRef.current?.abort();
      return;
    }
    executeWorkflowRun();
  }, [isRunning, executeWorkflowRun]);
  handleQuickTestRef.current = handleQuickTest;

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
      debugControllerRef.current?.stop();
      abortRef.current?.abort();
      return;
    }
    const dc = new DebugController();
    debugControllerRef.current = dc;
    executeWorkflowRun(dc);
  }, [isRunning, executeWorkflowRun]);
  handleDebugQuickTestRef.current = handleDebugQuickTest;

  const handleDebugStep = useCallback((nodeId: string) => {
    debugControllerRef.current?.stepNode(nodeId);
  }, []);

  const handleDebugStop = useCallback(() => {
    debugControllerRef.current?.stop();
    abortRef.current?.abort();
  }, []);

  const handleResetRunStatus = useCallback(() => {
    setNodeStatuses({});
    setLastRunStatus('idle');
    setLastRunTime(null);
    setLastRunError(null);
  }, [setNodeStatuses, setLastRunStatus, setLastRunTime, setLastRunError]);

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
        runProgress={runProgress}
        onReset={handleResetRunStatus}
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

        <div
          className={`wf-canvas-area ${isDragOver ? 'wf-canvas-drag-over' : ''}`}
          ref={canvasAreaRef}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          {isDragOver && !dropTargetEdgeId && (
            <div className="wf-drop-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Drop here to add node
            </div>
          )}
          {isDragOver && dropTargetEdgeId && (
            <div className="wf-drop-indicator wf-drop-indicator-edge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="3"/></svg>
              Insert between nodes
            </div>
          )}
          {!previewWorkflow && (
            <WorkflowExecSummary
              runProgress={runProgress}
              failedStepLabel={failedStepLabel}
              onOpenConsole={handleToggleConsole}
            />
          )}
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
              style={previewWorkflow && laidOutId !== selected?.id ? { visibility: 'hidden' as const } : undefined}
              nodes={nodes}
              edges={dropTargetEdgeId ? edges.map(e => e.id === dropTargetEdgeId ? { ...e, className: (e.className ? e.className + ' ' : '') + 'wf-edge-drop-target' } : e) : edges}
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
              onInit={(instance) => {
                // For preview/sample workflows, re-run auto-layout after ReactFlow
                // measures actual node dimensions, then fit viewport to show all nodes.
                if (previewWorkflow) {
                  const currentPreviewId = previewWorkflow.id;
                  setTimeout(() => {
                    const measuredNodes = instance.getNodes();
                    const measuredEdges = instance.getEdges();
                    if (measuredNodes.length > 0) {
                      const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
                      instance.setNodes(laid);
                      // Wait for React to commit the new positions before revealing
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          instance.fitView({ padding: 0.15, maxZoom: 1, duration: 0 });
                          setLaidOutId(currentPreviewId);
                        });
                      });
                    } else {
                      setLaidOutId(currentPreviewId);
                    }
                  }, 100);
                }
              }}
              connectionMode={ConnectionMode.Loose}
              connectionRadius={40}
              deleteKeyCode={['Backspace', 'Delete']}
              edgesReconnectable
              defaultEdgeOptions={{
                animated: false,
                style: { stroke: 'var(--border)', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 12, color: 'var(--border)' },
              }}
            >
              <WorkflowCanvasControls
                showMinimap={showMinimap}
                onToggleMinimap={() => setShowMinimap(v => !v)}
                disableLayout={!!previewWorkflow}
                canUndo={undoRedo.canUndo()}
                canRedo={undoRedo.canRedo()}
                onUndo={handleUndoAction}
                onRedo={handleRedoAction}
                onRestoreLayout={() => {
                  if (selected) {
                    setNodes((nds) => nds.map(n => {
                      const saved = selected.nodes.find(sn => sn.id === n.id);
                      return saved ? { ...n, position: saved.position } : n;
                    }));
                  }
                }}
                onAutoLayout={() => {
                  const laid = getAutoLayoutNodes(nodes, edges);
                  setNodes(laid);
                  setLayoutVersion(v => v + 1);
                  if (!previewWorkflow) {
                    setTimeout(() => persistWorkflow({ rfNodes: laid }), 100);
                  }
                }}
              />
              {showMinimap && (
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
              )}
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
            onCopy={() => {
              if (!nodeCtxMenu) return;
              setSelectedNodeId(nodeCtxMenu.nodeId);
              handleCopyNode(nodeCtxMenu.nodeId);
            }}
            onDuplicate={() => {
              if (!nodeCtxMenu) return;
              setSelectedNodeId(nodeCtxMenu.nodeId);
              handleDuplicateNode(nodeCtxMenu.nodeId);
            }}
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
          nodeRunStatus={configModalNodeId ? nodeStatuses[configModalNodeId] : undefined}
        />
      )}

      <WorkflowDefaultsModal
        open={showDefaultsModal}
        workflowVariables={workflowVariables}
        onUpdateWorkflowVariables={handleUpdateWorkflowVariables}
        onClose={() => setShowDefaultsModal(false)}
        workflowServices={workflowServices}
        errorConfig={workflowErrorConfig}
        onUpdateErrorConfig={(cfg) => { setWorkflowErrorConfig(cfg); persistWorkflow({ errorConfig: cfg }); }}
        workflowNodes={nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data } as WorkflowNode))}
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

      {consoleOpen && (
        <WorkflowConsolePanel
          lines={consoleLines}
          onClear={clearConsole}
          onClose={handleCloseConsole}
          stepSummaries={latestStepSummaries}
          runBehavior={consoleRunBehavior}
          onRunBehaviorChange={setConsoleRunBehavior}
        />
      )}

      <WorkflowShortcutsOverlay
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <WorkflowCommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={{
          onSave: handleSave,
          onQuickTest: handleQuickTest,
          onDebugTest: handleDebugQuickTest,
          onToggleConsole: handleToggleConsole,
          onAutoLayout: () => {
            const laid = getAutoLayoutNodes(nodesRef.current as WorkflowRFNode[], edgesRef.current as WorkflowRFEdge[]);
            setNodes(laid);
            setLayoutVersion((v) => v + 1);
          },
          onFitView: () => rfInstance.fitView({ padding: 0.2, duration: 300 }),
          onToggleMinimap: () => setShowMinimap((v) => !v),
          onOpenServices: () => {
            setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
            setSelectedNodeId(null);
          },
          onOpenDefaults: () => setShowDefaultsModal(true),
          onAddNode: handleAddNode,
          onOpenShortcuts: () => setShowShortcuts(true),
        }}
      />

      <WorkflowStatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        variableCount={variableCount}
        lastRunStatus={lastRunStatus}
        lastRunTime={lastRunTime}
        lastRunError={lastRunError}
        onOpenRunError={openRunErrorDetail}
        runHistory={runHistory}
        activeRunHistoryId={activeRunHistoryId}
        onRestoreRunHistory={(id) => { restoreRunFromHistory(id); setActiveRunHistoryId(id); }}
        onDeleteRunHistoryEntry={(id) => {
          deleteRunHistoryEntry(id);
          if (id === activeRunHistoryId) setActiveRunHistoryId(null);
        }}
        onClearRunHistory={() => { clearRunHistory(); setActiveRunHistoryId(null); }}
        consoleLineCount={consoleLines.length}
        consoleOpen={consoleOpen}
        onToggleConsole={handleToggleConsole}
        runProgress={runProgress}
      />
    </div>
  );
}
