import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { RequestCollection, Environment, Microservice, GlobalAuthProfile } from '../../shared/types';
import type { CatalogEntry } from '../catalog/types/catalog';
import type {
  WorkflowNode,
  SubWorkflowNodeData,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  WorkflowErrorConfig,
  WorkflowVersion,
  Workflow,
} from './types/workflow';
import {
  isHttpWorkflowNode,
} from './utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl } from './utils/workflowHostResolve';
import type { WorkflowHook } from './hooks/useWorkflows';
import { getAutoLayoutNodes } from './utils/workflowAutoLayout';
import { WorkflowNodeRunContext, WorkflowDebugStepContext } from './components/panels/WorkflowNodeRunContext';
import { useResizablePanels } from '../../shared/hooks/useResizablePanels';
import { nodeTypes, enrichNodeData, type WorkflowRFNode, type WorkflowRFEdge } from './utils/workflowNodeFactory';
import { useWorkflowConsole } from './hooks/useWorkflowConsole';
import { useWorkflowExecution } from './hooks/useWorkflowExecution';
import { useWorkflowDragDrop } from './hooks/useWorkflowDragDrop';
import { useWorkflowKeyboardShortcuts } from './hooks/useWorkflowKeyboardShortcuts';
import { useWorkflowNavigation } from './hooks/useWorkflowNavigation';
import { useWorkflowDetailModal } from './hooks/useWorkflowDetailModal';
import { useWorkflowNodeActions } from './hooks/useWorkflowNodeActions';
import { useWorkflowEdgeOps } from './hooks/useWorkflowEdgeOps';
import { useWorkflowCanvasSync, useWorkflowVariableHints } from './hooks/useWorkflowCanvasSync';
import { useWorkflowPersistence } from './hooks/useWorkflowPersistence';
import { useWorkflowResolvers } from './hooks/useWorkflowResolvers';
import { useWorkflowExtractionSample } from './hooks/useWorkflowExtractionSample';

import WorkflowToolbar from './components/canvas/WorkflowToolbar';
import WorkflowPalette from './components/canvas/WorkflowPalette';
import WorkflowNodeConfigModal from './components/modals/WorkflowNodeConfigModal';
import WorkflowDefaultsModal from './components/modals/WorkflowDefaultsModal';
import WorkflowStatusBar from './components/canvas/WorkflowStatusBar';
import WorkflowExecSummary from './components/panels/WorkflowExecSummary';
import VariableContextBadge from './components/panels/VariableContextBar';
import { WorkflowInspectProvider } from './components/panels/WorkflowInspectContext';
import WorkflowDetailModal from './components/modals/WorkflowDetailModal';
import WorkflowNodeContextMenu from './components/canvas/WorkflowNodeContextMenu';
import WorkflowServiceRegistryModal from './components/modals/WorkflowServiceRegistryModal';
import WorkflowServicesPanelInline from './components/panels/WorkflowServicesPanelInline';
import { useWorkflowVersioning } from './hooks/useWorkflowVersioning';
import WorkflowVersionPanel from './components/panels/WorkflowVersionPanel';
import WorkflowVersionDiff from './components/modals/WorkflowVersionDiff';
import WorkflowDebugBar from './components/WorkflowDebugBar';
import WorkflowConsolePanel from './components/panels/WorkflowConsolePanel';
import WorkflowBreadcrumb from './components/WorkflowBreadcrumb';
import WorkflowCanvasControls from './components/canvas/WorkflowCanvasControls';
import WorkflowShortcutsOverlay from './components/canvas/WorkflowShortcutsOverlay';
import WorkflowCommandPalette from './components/canvas/WorkflowCommandPalette';
import { useToast } from '../../shared/hooks/useToast';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useNodeClipboard } from './hooks/useNodeClipboard';
import { useWorkflowRunCache } from './hooks/useWorkflowRunCache';
import { sampleWorkflowCatalog } from '../../data/galleries/workflows';
import { getNodeMiniMapColor, buildConfigModalWorkflowList, getDetailModalProps } from './utils/workflowDesignerUtils';

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

export default function WorkflowDesignerWrapper(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowDesignerInner({
  collections, catalogEntries, wfHook, environments, microservices, globalAuthProfiles,
  selectedEnvId, onEnvSelect, resolvedBaseUrl, previewWorkflow, onClearPreview, onUseAsTemplate,
}: Props) {
  const { workflows, selected: selectedWorkflow, create, update, select } = wfHook;
  const selected = previewWorkflow ?? selectedWorkflow;
  const { paletteWidth, startDrag } = useResizablePanels();

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowRFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowRFEdge>([]);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [laidOutId, setLaidOutId] = useState<string | null>(null);
  const nodesRef = useRef<WorkflowRFNode[]>(nodes);
  const edgesRef = useRef<WorkflowRFEdge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
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

  const hasWebhookNode = nodes.some(n => n.type === 'webhook');
  const {
    consoleOpen, consoleOpenRef,
    consoleRunBehavior, consoleRunBehaviorRef,
    setConsoleRunBehavior,
    handleToggleConsole, handleCloseConsole,
  } = useWorkflowConsole({ hasWebhookNode, pushConsoleLine });
  const consoleLinesRef = useRef(consoleLines);
  useEffect(() => { consoleLinesRef.current = consoleLines; }, [consoleLines]);
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
  const [activeRunHistoryId, setActiveRunHistoryId] = useState<string | null>(null);
  const [nodeCtxMenu, setNodeCtxMenu] = useState<WorkflowNodeContextMenuData | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  // Shared Y-cursor: useWorkflowNodeActions (add) and useWorkflowPersistence (paste) advance the same counter.
  const nextNodeY = useRef(100);

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
    selected?.id,
  );

  // Clear undo stack on workflow switch
  // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render; only clear on workflow switch
  useEffect(() => { undoRedo.clear(); }, [selected?.id]);

  // Stable refs so keyboard-shortcut handler can call these (declared later in file).
  const handleQuickTestRef = useRef<() => void>(() => {});
  const handleDebugQuickTestRef = useRef<() => void>(() => {});

  const clipboard = useNodeClipboard({ getNodes: () => nodesRef.current, selectedNodeId, toast });

  const {
    serializeNodes, serializeEdges, persistWorkflow, insertNodeAndPersist,
    saveAcknowledged,
    handleCopyNode, handlePasteNode, handleDuplicateNode,
    handleUndoAction, handleRedoAction,
    handleSave, handleUpdateWorkflowVariables,
  } = useWorkflowPersistence({
    selected, previewWorkflow, nodes, edges,
    workflowVariables, workflowHostProfiles, workflowAuthProfiles,
    workflowServices, workflowErrorConfig,
    nodeInitialVarsRef, nodesRef, selectedNodeId,
    nextNodeY, setNodes, setWorkflowVariables, workflowVariablesRef,
    update, clipboard, undoRedo, toast,
  });

  // ── Workflow version history (extracted hook) ──
  const versioning = useWorkflowVersioning({
    selectedId: selected?.id ?? null,
    versions: selected?.versions ?? [],
    update: (id, patch) => update(id, patch),
    takeSnapshot: (label) => undoRedo.takeSnapshot(label ?? 'Snapshot'),
    applyToCanvas: useCallback((version: WorkflowVersion) => {
      setNodes(version.nodes.map((n) => enrichNodeData(n as WorkflowRFNode, {})) as WorkflowRFNode[]);
      setEdges(version.edges as WorkflowRFEdge[]);
      setWorkflowVariables(version.variables);
      if (version.services) setWorkflowServices(version.services);
    }, [setNodes, setEdges, setWorkflowVariables, setWorkflowServices]),
    persistRestore: useCallback((version: WorkflowVersion) => {
      if (!selected) return;
      update(selected.id, {
        nodes: version.nodes,
        edges: version.edges,
        variables: version.variables,
        services: version.services ?? selected.services,
      });
    }, [selected, update]),
    showToast: toast.show,
    isPreview: !!previewWorkflow,
    closeServicePanel: useCallback(() => setServiceRegistryMode('closed'), []),
    deselectNode: useCallback(() => setSelectedNodeId(null), []),
  });

  // Keyboard shortcuts (extracted hook)
  useWorkflowKeyboardShortcuts({
    selected, previewWorkflow,
    persistWorkflow,
    handleToggleConsole, handleUndoAction, handleRedoAction,
    handleCopyNode, handlePasteNode, handleDuplicateNode,
    handleQuickTestRef, handleDebugQuickTestRef,
    handleAutoLayout,
    setShowShortcuts, setShowCommandPalette, setShowMinimap, toast,
  });

  // ── Node actions (extracted hook) ── MUST BE BEFORE useWorkflowCanvasSync because it provides nextNodeY
  const {
    addNodeToCanvas, handleAddNode,
    handleAddFromRequest, handleAddFromCatalog,
    handleUpdateNode, handleDeleteNode,
    handleExtractToSubWorkflow,
  } = useWorkflowNodeActions({
    selected, collections, catalogEntries, environments, microservices,
    selectedEnvId, resolvedBaseUrl, selectedNodeId,
    setSelectedNodeId, setNodes, setEdges, setNodeInitialVars,
    nodeInitialVarsRef, nodesRef, edgesRef,
    serializeNodes, serializeEdges, update, persistWorkflow,
    undoRedo, workflows, create, toast,
    nextNodeY,
  });

  // ── Resolver callbacks for execution (extracted hook) ──
  const { handleEnvSelect, resolveHttpBaseUrlForGraph, resolveHttpAuthForGraph } = useWorkflowResolvers({
    selected, previewWorkflow, selectedEnvId, resolvedBaseUrl,
    environments, microservices, globalAuthProfiles,
    workflowHostProfiles, workflowAuthProfiles, workflowServices,
    selectedNode: undefined, // effectiveQuickTestBaseUrl computed after selectedNode is available
    onEnvSelect, update,
  });

  // ── Execution (Quick Test + Debug) via extracted hook ── MUST BE BEFORE useWorkflowCanvasSync
  const {
    isRunning, setIsRunning, isDebugMode, setIsDebugMode,
    debugControllerRef, abortRef,
    runProgress, failedStepLabel,
    lastQuickTestRequestUrl,
    handleQuickTest, handleDebugQuickTest,
    handleDebugStep, handleDebugStop, handleResetRunStatus,
  } = useWorkflowExecution({
    selected, nodes, nodesRef, edgesRef,
    workflowVariablesRef, nodeInitialVarsRef,
    consoleOpenRef, consoleRunBehaviorRef, consoleLinesRef,
    resolvedBaseUrl, selectedEnvId, environments,
    workflowServices, workflowErrorConfig,
    resolveHttpBaseUrlForGraph, resolveHttpAuthForGraph,
    previewWorkflow, workflows,
    nodeStatuses, setNodeStatuses,
    lastRunStatus, setLastRunStatus,
    lastRunTime, setLastRunTime,
    lastRunError, setLastRunError,
    setRunVariableSnapshot,
    pushRunHistory, clearConsole, pushConsoleLine,
    sampleWorkflowCatalog, toast,
  });
  handleQuickTestRef.current = handleQuickTest;
  handleDebugQuickTestRef.current = handleDebugQuickTest;

  // ── Canvas sync (extracted hook) ──
  useWorkflowCanvasSync({
    selected, previewWorkflow,
    setNodes, setEdges, setSelectedNodeId, setLayoutVersion,
    setWorkflowVariables, setWorkflowHostProfiles, setWorkflowAuthProfiles,
    setWorkflowServices, setWorkflowErrorConfig, setNodeInitialVars,
    nextNodeY, isRunning, abortRef, setIsRunning, setIsDebugMode, debugControllerRef,
  });

  // ── Variable hints (extracted hook) ──
  const { selectedNode, conditionVariableHints, httpVariableHints } = useWorkflowVariableHints({
    selectedNodeId, nodes, edges, nodeInitialVars, workflowVariables,
  });

  // ── Detail modal state & callbacks (extracted hook) ──
  const {
    detailModal, setDetailModal,
    variableDetailDraft, setVariableDetailDraft,
    configModalNodeId, setConfigModalNodeId,
    extractionSampleJson, setExtractionSampleJson,
    extractionFetching, setExtractionFetching,
    extractionFetchError, setExtractionFetchError,
    openStepDetail, openVariableDetail, openRunErrorDetail, openNodeConfig,
    handleApplyVariableDetail,
    stepDetailMeta,
  } = useWorkflowDetailModal({
    nodes, nodeStatuses, selectedNode, lastRunError,
    workflowVariables, nodeInitialVarsRef,
    setNodeInitialVars, setWorkflowVariables, setSelectedNodeId,
  });

  /** Node being configured in the config modal (derived from configModalNodeId). */
  const configModalNode = useMemo(() => {
    if (!configModalNodeId) return null;
    const n = nodes.find(n => n.id === configModalNodeId);
    if (!n) return null;
    return enrichNodeData(n, nodeInitialVars);
  }, [configModalNodeId, nodes, nodeInitialVars]);

  const effectiveQuickTestBaseUrl = useMemo(() => {
    if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const custom = resolveHttpNodeBaseUrl(selectedNode.data, microservices, workflowHostProfiles, workflowServices, selectedEnvId);
      if (custom) return custom;
    }
    return resolvedBaseUrl;
  }, [selectedNode, microservices, resolvedBaseUrl, workflowHostProfiles, workflowServices, selectedEnvId]);

  const { handleExtractionFetchSample } = useWorkflowExtractionSample({
    selectedNode, selectedId: selected?.id, selectedNodeId,
    nodes, workflowVariables, runVariableSnapshot, nodeInitialVarsRef,
    microservices, workflowHostProfiles, workflowServices, selectedEnvId, resolvedBaseUrl,
    setExtractionSampleJson, setExtractionFetching, setExtractionFetchError,
  });

  // ── Navigation (extracted hook) ──
  const { navStack, setNavStack, navigateToWorkflow, handleBreadcrumbNavigate } = useWorkflowNavigation({
    selected, workflows, select, persistWorkflow,
  });

  const handleNew = useCallback(() => {
    const name = prompt('Workflow name:');
    if (!name?.trim()) return;
    onClearPreview();
    create(name.trim());
  }, [create, onClearPreview]);

  const handleSelect = useCallback((id: string) => {
    onClearPreview();
    setNavStack([]);
    select(id);
  }, [select, onClearPreview, setNavStack]);

  const inspectActions = useMemo(
    () => ({
      openStepDetail,
      openVariableDetail,
      openNodeConfig,
      navigateToWorkflow,
      getWorkflowPreview: (workflowId: string) => {
        const wf = workflows.find((w) => w.id === workflowId);
        if (!wf) return undefined;
        return {
          nodeCount: wf.nodes.length,
          edgeCount: wf.edges.length,
        };
      },
    }),
    [openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows],
  );

  // ── Edge operations (extracted hook) ──
  const { onConnect, onReconnect } = useWorkflowEdgeOps({
    selected, nodes, setEdges, serializeNodes, update, undoRedo, nodeStatuses,
  });

  // ── Drag-to-place from palette (extracted hook) ──
  const {
    isDragOver, dropTargetEdgeId, canvasAreaRef,
    handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop,
  } = useWorkflowDragDrop({
    nodesRef, edgesRef, selected,
    addNodeToCanvas, insertNodeAndPersist,
    setNodes, setEdges, serializeNodes, serializeEdges,
    update, undoRedo,
  });

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: WorkflowRFNode) => {
    setSelectedNodeId(node.id);
    setServiceRegistryMode((m) => m === 'panel' ? 'closed' : m);
    versioning.closeVersionPanel();
  }, [versioning]);

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

  const latestStepSummaries = useMemo(() => {
    const latest = runHistory[0];
    return latest?.stepSummaries ?? [];
  }, [runHistory]);

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

  const configModalWorkflows = useMemo(
    () => buildConfigModalWorkflowList(workflows, previewWorkflow, sampleWorkflowCatalog),
    [workflows, previewWorkflow],
  );

  const handleServiceRegistryApply = useCallback((svcs: WorkflowService[]) => {
    setWorkflowServices(svcs);
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
    persistWorkflow({ services: svcs, rfNodes: syncedNodes });
  }, [nodes, setNodes, setWorkflowServices, persistWorkflow]);

  /** Shared auto-layout callback used by the canvas controls, command palette, and keyboard shortcuts. */
  const handleAutoLayout = useCallback(() => {
    const laid = getAutoLayoutNodes(nodesRef.current as WorkflowRFNode[], edgesRef.current as WorkflowRFEdge[]);
    setNodes(laid);
    setLayoutVersion((v) => v + 1);
    if (!previewWorkflow) {
      setTimeout(() => persistWorkflow({ rfNodes: laid }), 100);
    }
  }, [nodesRef, edgesRef, setNodes, setLayoutVersion, previewWorkflow, persistWorkflow]);

  /** onInit handler for ReactFlow: auto-layout preview workflows after node measurement. */
  const handleReactFlowInit = useCallback((instance: ReturnType<typeof useReactFlow>) => {
    if (previewWorkflow) {
      const currentPreviewId = previewWorkflow.id;
      setTimeout(() => {
        const measuredNodes = instance.getNodes();
        const measuredEdges = instance.getEdges();
        if (measuredNodes.length > 0) {
          const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
          instance.setNodes(laid);
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
  }, [previewWorkflow]);

  const detailModalDerived = useMemo(
    () => getDetailModalProps(detailModal, stepDetailMeta, selectedNode?.type, lastRunError),
    [detailModal, stepDetailMeta, selectedNode?.type, lastRunError],
  );

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
        versionCount={versioning.versionCount}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onEnvSelect={handleEnvSelect}
        workflowServices={workflowServices}
        isPreview={!!previewWorkflow}
        onNew={handleNew} onSelect={handleSelect} onSave={handleSave}
        onQuickTest={handleQuickTest}
        onDebugTest={handleDebugQuickTest}
        isDebugMode={isDebugMode}
        onOpenServices={() => {
          setServiceRegistryMode((m) => m === 'closed' ? 'panel' : 'closed');
          versioning.closeVersionPanel();
          setSelectedNodeId(null);
        }}
        onOpenDefaults={() => setShowDefaultsModal(true)}
        onOpenVersions={versioning.openVersionPanel}
        runProgress={runProgress}
        onReset={handleResetRunStatus}
      />

      <WorkflowInspectProvider value={inspectActions}>

      {navStack.length > 0 && selected && (
        <WorkflowBreadcrumb
          stack={navStack}
          currentName={selected.name}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

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
              onInit={handleReactFlowInit}
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
                onAutoLayout={handleAutoLayout}
              />
              {showMinimap && (
                <MiniMap
                  pannable
                  zoomable
                  style={{ background: 'var(--surface)' }}
                  nodeColor={(node) => getNodeMiniMapColor(node, nodeStatuses)}
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
            onExtract={nodeCtxMenu ? (() => {
              handleExtractToSubWorkflow(nodeCtxMenu.nodeId);
            }) : undefined}
            onOpenChild={(() => {
              if (!nodeCtxMenu) return undefined;
              const n = nodes.find((x) => x.id === nodeCtxMenu.nodeId);
              if (n?.type !== 'subWorkflow') return undefined;
              const data = n.data as SubWorkflowNodeData;
              if (!data.workflowId) return undefined;
              return () => navigateToWorkflow(data.workflowId);
            })()}
            onDelete={() => {
              if (!nodeCtxMenu) return;
              handleDeleteNode(nodeCtxMenu.nodeId);
            }}
            onClose={() => setNodeCtxMenu(null)}
          />
        </div>

        {serviceRegistryMode === 'panel' && (<>
          <div className="wf-resize-handle" onMouseDown={(e) => startDrag('right', e)} />
          <div style={{ width: 320, flexShrink: 0 }}>
            <WorkflowServicesPanelInline
              services={workflowServices} environments={environments}
              microservices={microservices} globalAuthProfiles={globalAuthProfiles}
              selectedEnvId={selectedEnvId}
              onExpand={() => setServiceRegistryMode('fullscreen')}
              onClose={() => setServiceRegistryMode('closed')}
            />
          </div>
        </>)}

        {versioning.versionPanelOpen && (<>
          <div className="wf-resize-handle" onMouseDown={(e) => startDrag('right', e)} />
          <div style={{ width: 320, flexShrink: 0 }}>
            <WorkflowVersionPanel
              versions={selected?.versions ?? []}
              onRestore={versioning.handleVersionRestore} onDelete={versioning.handleVersionDelete}
              onRename={versioning.handleVersionRename} onCompare={versioning.handleVersionCompare}
              onClose={versioning.closeVersionPanel}
            />
          </div>
        </>)}
      </div>

      <WorkflowDetailModal
        open={detailModal !== null}
        title={detailModalDerived.title}
        subtitle={detailModalDerived.subtitle}
        body={detailModalDerived.body}
        variableMode={detailModal?.type === 'variable'}
        variableValue={variableDetailDraft}
        onVariableChange={setVariableDetailDraft}
        onApplyVariable={detailModal?.type === 'variable' ? handleApplyVariableDetail : undefined}
        onClose={() => setDetailModal(null)}
      />

      {configModalNode && (
        <WorkflowNodeConfigModal
          key={configModalNode.id}
          node={configModalNode}
          workflowVariables={workflowVariables}
          runtimeVariables={runVariableSnapshot ?? undefined}
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
          workflows={configModalWorkflows}
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
        onApply={handleServiceRegistryApply}
        onClose={() => setServiceRegistryMode('closed')}
      />

      {isDebugMode && debugControllerRef.current && (
        <WorkflowDebugBar
          debugController={debugControllerRef.current}
          onStop={handleDebugStop}
          variableCount={Object.keys(runVariableSnapshot ?? workflowVariables).length}
          pausedSubWorkflowNodeId={(() => {
            if (!debugControllerRef.current) return null;
            const pausedIds = debugControllerRef.current.getPausedNodeIds();
            return pausedIds.find((nid) => nodes.find((n) => n.id === nid && n.type === 'subWorkflow')) ?? null;
          })()}
          onStepInto={(nodeId) => {
            const n = nodes.find((x) => x.id === nodeId);
            if (n?.type === 'subWorkflow') {
              const data = n.data as SubWorkflowNodeData;
              if (data.workflowId) navigateToWorkflow(data.workflowId);
            }
          }}
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

      {versioning.versionDiffState && (
        <WorkflowVersionDiff
          open
          older={versioning.versionDiffState.older}
          newer={versioning.versionDiffState.newer}
          onClose={versioning.closeVersionDiff}
        />
      )}

      <WorkflowCommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={{
          onSave: handleSave,
          onQuickTest: handleQuickTest,
          onDebugTest: handleDebugQuickTest,
          onToggleConsole: handleToggleConsole,
          onAutoLayout: handleAutoLayout,
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
