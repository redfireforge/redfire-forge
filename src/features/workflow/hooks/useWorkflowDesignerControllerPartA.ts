import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNodesState, useEdgesState, useReactFlow, type NodeChange, type EdgeChange } from '@xyflow/react';

import type { WorkflowVersion } from '../types/workflow';
import { useOnboardingHints } from './useOnboardingHints';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';
import { useResizablePanels } from '../../../shared/hooks/useResizablePanels';
import { enrichNodeData, type WorkflowRFNode, type WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { useWorkflowConsole } from './useWorkflowConsole';
import { useWorkflowKeyboardShortcuts } from './useWorkflowKeyboardShortcuts';
import { useWorkflowPersistence } from './useWorkflowPersistence';
import { useWorkflowVersioning } from './useWorkflowVersioning';
import { useToast } from '../../../shared/hooks/useToast';
import { useUndoRedo } from './useUndoRedo';
import { useNodeClipboard } from './useNodeClipboard';
import { useWorkflowRunCache } from './useWorkflowRunCache';
import type { WorkflowDesignerProps, WorkflowNodeContextMenuData } from '../utils/workflowDesignerShellTypes';
import type {
  WorkflowAuthProfile,
  WorkflowErrorConfig,
  WorkflowHostProfile,
  WorkflowService,
} from '../types/workflow';

/**
 * First half of Workflow Designer controller: graph/run-cache state, persistence,
 * versioning, auto-layout, and keyboard shortcuts. Composed by useWorkflowDesignerController.
 */
export function useWorkflowDesignerControllerPartA({
  wfHook, previewWorkflow, onClearPreview, onUseAsTemplate, onRunInHarness, folders: wfFolders,
  onLoadTemplate, onBrowseGallery,
}: WorkflowDesignerProps) {
  const { workflows, selected: selectedWorkflow, create, update, select } = wfHook;
  const selected = previewWorkflow ?? selectedWorkflow;
  const { paletteWidth, configWidth, startDrag } = useResizablePanels();

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
  const nextNodeYRef = useRef(100);

  const toast = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const rfInstance = useReactFlow();

  const onboarding = useOnboardingHints();

  const hasNodes = useMemo(() => nodes.length > 0, [nodes.length]);
  const prevHasNodesRef = useRef(hasNodes);

  useEffect(() => {
    if (!previewWorkflow && hasNodes && !prevHasNodesRef.current) {
      setTimeout(() => onboarding.showNextHint('first-node'), 500);
    }
    prevHasNodesRef.current = hasNodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showNextHint is stable (useCallback)
  }, [hasNodes, previewWorkflow, onboarding.showNextHint]);

  useEffect(() => {
    if (!previewWorkflow && !hasNodes && !onboarding.isComplete) {
      const timer = setTimeout(() => {
        if (!onboarding.showNextHint('mount')) {
          onboarding.showNextHint('empty-canvas');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isComplete is stable (useMemo), showNextHint is stable (useCallback)
  }, [previewWorkflow, hasNodes, onboarding.isComplete, onboarding.showNextHint]);

  const undoRedo = useUndoRedo(
    () => nodesRef.current,
    () => edgesRef.current,
    (n) => setNodes(n as WorkflowRFNode[]),
    (e) => setEdges(e as WorkflowRFEdge[]),
    selected?.id,
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo object identity changes every render; only clear on workflow switch
  useEffect(() => { undoRedo.clear(); }, [selected?.id]);

  const handleQuickTestRef = useRef<() => void>(() => {});
  const handleDebugQuickTestRef = useRef<() => void>(() => {});

  const clipboard = useNodeClipboard({ getNodes: () => nodesRef.current, selectedNodeId, toast });

  const {
    serializeNodes, serializeEdges, persistWorkflow, insertNodeAndPersist,
    saveAcknowledged, workflowServicesRef,
    handleCopyNode, handlePasteNode, handleDuplicateNode,
    handleUndoAction, handleRedoAction,
    handleSave, handleUpdateWorkflowVariables, handleUpdateWorkflowSlaTargets,
  } = useWorkflowPersistence({
    selected, previewWorkflow,
    workflowVariables, workflowHostProfiles, workflowAuthProfiles,
    workflowServices, workflowErrorConfig,
    nodeInitialVarsRef, nodesRef, edgesRef, selectedNodeId,
    nextNodeYRef, setNodes, setWorkflowVariables, workflowVariablesRef,
    update, clipboard, undoRedo, toast,
  });

  // Wrap onNodesChange to persist on drag-stop and node removal
  const wrappedOnNodesChange = useCallback((changes: NodeChange<WorkflowRFNode>[]) => {
    onNodesChange(changes);
    if (previewWorkflow) return;

    const hasDragStop = changes.some(c => c.type === 'position' && !c.dragging);
    const hasRemove = changes.some(c => c.type === 'remove');

    if (hasDragStop || hasRemove) {
      queueMicrotask(() => persistWorkflow({ rfNodes: nodesRef.current }));
    }
  }, [onNodesChange, previewWorkflow, persistWorkflow, nodesRef]);

  // Wrap onEdgesChange to persist on edge removal
  const wrappedOnEdgesChange = useCallback((changes: EdgeChange<WorkflowRFEdge>[]) => {
    onEdgesChange(changes);
    if (previewWorkflow) return;

    const hasRemove = changes.some(c => c.type === 'remove');
    if (hasRemove) {
      queueMicrotask(() => persistWorkflow());
    }
  }, [onEdgesChange, previewWorkflow, persistWorkflow]);

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

  const handleAutoLayout = useCallback(() => {
    const laid = getAutoLayoutNodes(nodesRef.current as WorkflowRFNode[], edgesRef.current as WorkflowRFEdge[]);
    setNodes(laid);
    setLayoutVersion((v) => v + 1);
    if (!previewWorkflow) {
      setTimeout(() => persistWorkflow({ rfNodes: laid }), 100);
    }
  }, [nodesRef, edgesRef, setNodes, setLayoutVersion, previewWorkflow, persistWorkflow]);

  useWorkflowKeyboardShortcuts({
    selected, previewWorkflow,
    persistWorkflow,
    handleToggleConsole, handleUndoAction, handleRedoAction,
    handleCopyNode, handlePasteNode, handleDuplicateNode,
    handleQuickTestRef, handleDebugQuickTestRef,
    handleAutoLayout,
    setShowShortcuts, setShowCommandPalette, setShowMinimap, toast,
  });

  return {
    workflows,
    selectedWorkflow,
    selected,
    create,
    update,
    select,
    previewWorkflow,
    onClearPreview,
    onUseAsTemplate,
    onRunInHarness,
    paletteWidth,
    configWidth,
    startDrag,
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange: wrappedOnNodesChange,
    onEdgesChange: wrappedOnEdgesChange,
    layoutVersion,
    setLayoutVersion,
    laidOutId,
    setLaidOutId,
    nodesRef,
    edgesRef,
    selectedNodeId,
    setSelectedNodeId,
    showDefaultsModal,
    setShowDefaultsModal,
    nodeStatuses,
    setNodeStatuses,
    lastRunStatus,
    setLastRunStatus,
    lastRunTime,
    setLastRunTime,
    lastRunError,
    setLastRunError,
    runVariableSnapshot,
    setRunVariableSnapshot,
    runHistory,
    pushRunHistory,
    restoreRunFromHistory,
    deleteRunHistoryEntry,
    clearRunHistory,
    consoleLines,
    pushConsoleLine,
    clearConsole,
    consoleOpen,
    consoleOpenRef,
    consoleRunBehavior,
    consoleRunBehaviorRef,
    setConsoleRunBehavior,
    handleToggleConsole,
    handleCloseConsole,
    consoleLinesRef,
    nodeInitialVars,
    setNodeInitialVars,
    nodeInitialVarsRef,
    workflowVariables,
    setWorkflowVariables,
    workflowHostProfiles,
    setWorkflowHostProfiles,
    workflowAuthProfiles,
    setWorkflowAuthProfiles,
    workflowServices,
    setWorkflowServices,
    workflowErrorConfig,
    setWorkflowErrorConfig,
    serviceRegistryMode,
    setServiceRegistryMode,
    workflowVariablesRef,
    activeRunHistoryId,
    setActiveRunHistoryId,
    nodeCtxMenu,
    setNodeCtxMenu,
    showMinimap,
    setShowMinimap,
    nextNodeYRef,
    toast,
    showShortcuts,
    setShowShortcuts,
    showCommandPalette,
    setShowCommandPalette,
    rfInstance,
    undoRedo,
    handleQuickTestRef,
    handleDebugQuickTestRef,
    serializeNodes,
    serializeEdges,
    persistWorkflow,
    insertNodeAndPersist,
    saveAcknowledged,
    workflowServicesRef,
    handleCopyNode,
    handlePasteNode,
    handleDuplicateNode,
    handleUndoAction,
    handleRedoAction,
    handleSave,
    handleUpdateWorkflowVariables,
    handleUpdateWorkflowSlaTargets,
    versioning,
    handleAutoLayout,
    clipboard,
    wfFolders,
    onLoadTemplate,
    onBrowseGallery,
    onboarding,
  };
}

export type WorkflowDesignerControllerPartA = ReturnType<typeof useWorkflowDesignerControllerPartA>;
