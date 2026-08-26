import { useCallback, useMemo, useState, type MouseEvent } from 'react';

import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl } from '../utils/workflowHostResolve';
import { enrichNodeData, type WorkflowRFNode } from '../utils/workflowNodeFactory';
import { useWorkflowExecution } from './useWorkflowExecution';
import { useWorkflowDragDrop } from './useWorkflowDragDrop';
import { useWorkflowNavigation } from './useWorkflowNavigation';
import { useWorkflowDetailModal } from './useWorkflowDetailModal';
import { useWorkflowNodeActions } from './useWorkflowNodeActions';
import { useWorkflowEdgeOps } from './useWorkflowEdgeOps';
import { useWorkflowCanvasSync, useWorkflowVariableHints } from './useWorkflowCanvasSync';
import { useWorkflowResolvers } from './useWorkflowResolvers';
import { useWorkflowExtractionSample } from './useWorkflowExtractionSample';
import { sampleWorkflowCatalog } from '../../../data/galleries/workflows';
import { getDetailModalProps, buildConfigModalWorkflowList } from '../utils/workflowDesignerUtils';
import { buildQuickTestFailureReport, filterQuickTestVariableSnapshot } from '../utils/workflowRunErrors';
import { collectWorkflowReferencedVariables, countWorkflowDesignerVariables } from '../utils/countWorkflowDesignerVariables';
import { syncHttpNodeLabelsWithServices } from '../utils/syncHttpNodeLabelsWithServices';
import type { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';
import type { WorkflowService } from '../types/workflow';
import { useWorkflowDesignerInspectActions } from './useWorkflowDesignerInspectActions';
import { useWorkflowPreviewReactFlowInit } from './useWorkflowPreviewReactFlowInit';
import { useDemoWorkflowConfigModalBridge } from '@app/hooks/useDemoWorkflowConfigModalBridge';
import { useDemoWorkflowCanvasBridge } from '@app/hooks/useDemoWorkflowCanvasBridge';
import { useDemoWorkflowLivePatchSync } from '@app/hooks/useDemoWorkflowLivePatchSync';
import { useDemoWorkflowRunBridge } from '@app/hooks/useDemoWorkflowRunBridge';
import { useDemoWorkflowHarBridge } from '@app/hooks/useDemoWorkflowHarBridge';
import type { WorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import type { HarParseResult, ParsedHarEntry } from '../utils/harParser';
import { harToWorkflow } from '../utils/harToWorkflow';

/**
 * Second half of Workflow Designer controller: node actions, execution, canvas sync,
 * modals, interactions, and assembled view-model fields consumed by the main layout.
 */
export function useWorkflowDesignerControllerPartB(
  {
    collections, catalogEntries, previewEndpoints, environments, microservices, globalAuthProfiles,
    selectedEnvId, onEnvSelect, resolvedBaseUrl, previewWorkflow, onClearPreview,
  }: WorkflowDesignerProps,
  a: WorkflowDesignerControllerPartA,
) {
  const {
    workflows, selected, create, update, select,
    nodes, setNodes, edges, setEdges, selectedNodeId, setSelectedNodeId,
    nodeStatuses, setNodeStatuses,
    lastRunStatus, setLastRunStatus,
    lastRunTime, setLastRunTime,
    lastRunError, setLastRunError,
    runVariableSnapshot, setRunVariableSnapshot,
    runHistory, pushRunHistory, clearConsole, pushConsoleLine,
    consoleOpenRef, consoleRunBehaviorRef, consoleLinesRef,
    nodeInitialVars, setNodeInitialVars, nodeInitialVarsRef,
    workflowVariables, setWorkflowVariables,
    workflowHostProfiles, workflowAuthProfiles, workflowServices,
    workflowErrorConfig,
    nextNodeYRef,
    persistWorkflow, serializeNodes, serializeEdges, insertNodeAndPersist,
    undoRedo, nodesRef, edgesRef, handleQuickTestRef, handleDebugQuickTestRef,
    setLayoutVersion,
    toast,
    versioning,
    setServiceRegistryMode,
    setNodeCtxMenu,
    setWorkflowHostProfiles,
    setWorkflowAuthProfiles,
    setWorkflowServices,
    setWorkflowErrorConfig,
    setLaidOutId,
    workflowServicesRef,
  } = a;

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
    nextNodeYRef,
    workflowServices, setWorkflowServices, globalAuthProfiles, workflowServicesRef,
  });

  const { handleEnvSelect, resolveHttpBaseUrlForGraph, resolveHttpAuthForGraph } = useWorkflowResolvers({
    selected, previewWorkflow, selectedEnvId, resolvedBaseUrl,
    environments, microservices, globalAuthProfiles,
    workflowHostProfiles, workflowAuthProfiles, workflowServices,
    selectedNode: undefined,
    onEnvSelect, update,
  });

  const {
    isRunning, setIsRunning, isDebugMode, setIsDebugMode,
    debugControllerRef, abortRef,
    runProgress, failedStepLabel,
    lastQuickTestRequestUrlByNode,
    handleQuickTest, handleDebugQuickTest,
    handleDebugStep, handleDebugStop, handleResetRunStatus,
  } = useWorkflowExecution({
    selected, nodes, nodesRef, edgesRef,
    workflowVariablesRef: a.workflowVariablesRef, nodeInitialVarsRef,
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

  useWorkflowCanvasSync({
    selected, previewWorkflow,
    setNodes, setEdges, setSelectedNodeId, setLayoutVersion,
    setWorkflowVariables, setWorkflowHostProfiles, setWorkflowAuthProfiles,
    setWorkflowServices, setWorkflowErrorConfig, setNodeInitialVars,
    nextNodeYRef, isRunning, abortRef, setIsRunning, setIsDebugMode, debugControllerRef,
  });

  const { selectedNode, conditionVariableHints, httpVariableHints } = useWorkflowVariableHints({
    selectedNodeId, nodes, edges, nodeInitialVars, workflowVariables,
  });

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

  const configModalNode = useMemo(() => {
    if (!configModalNodeId) return null;
    const n = nodes.find(n => n.id === configModalNodeId);
    if (!n) return null;
    return enrichNodeData(n, nodeInitialVars);
  }, [configModalNodeId, nodes, nodeInitialVars]);

  // Resolved request URL for the node whose config modal is open — shows THIS node's
  // last request rather than the workflow-wide last step (avoids e.g. the POST node
  // displaying the GET step's `/users/1`).
  const lastQuickTestRequestUrl = configModalNodeId
    ? (lastQuickTestRequestUrlByNode?.[configModalNodeId] ?? null)
    : null;

  const closeConfigModal = useCallback(() => setConfigModalNodeId(null), [setConfigModalNodeId]);
  useDemoWorkflowConfigModalBridge(closeConfigModal);
  useDemoWorkflowCanvasBridge(nodes, handleUpdateNode);
  useDemoWorkflowLivePatchSync(
    selected?.name,
    nodes,
    setWorkflowVariables,
    a.workflowVariablesRef,
    handleUpdateNode,
  );
  useDemoWorkflowRunBridge(handleResetRunStatus, clearConsole, handleQuickTest);

  const effectiveQuickTestBaseUrl = useMemo(() => {
    if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const custom = resolveHttpNodeBaseUrl(selectedNode.data, microservices, workflowHostProfiles, workflowServices, selectedEnvId);
      if (custom) return custom;
    }
    return resolvedBaseUrl;
  }, [selectedNode, microservices, resolvedBaseUrl, workflowHostProfiles, workflowServices, selectedEnvId]);

  const { handleExtractionFetchSample } = useWorkflowExtractionSample({
    selectedNode, configModalNode, selectedId: selected?.id, selectedNodeId,
    nodes, workflowVariables, runVariableSnapshot, nodeInitialVarsRef,
    microservices, workflowHostProfiles, workflowServices, selectedEnvId, resolvedBaseUrl,
    setExtractionSampleJson, setExtractionFetching, setExtractionFetchError,
  });

  const { navStack, setNavStack, navigateToWorkflow, handleBreadcrumbNavigate } = useWorkflowNavigation({
    selected, workflows, select, persistWorkflow,
  });

  const handleNew = useCallback((name: string) => {
    if (!name.trim()) return;
    onClearPreview();
    create(name.trim());
  }, [create, onClearPreview]);

  // ── HAR import state and handlers ─────────────────────────────────────────
  const [harParseResult, setHarParseResult] = useState<HarParseResult | null>(null);
  const [harFileName, setHarFileName] = useState('');

  const handleHarFileParsed = useCallback((result: HarParseResult, fileName: string) => {
    setHarParseResult(result);
    setHarFileName(fileName);
  }, []);
  useDemoWorkflowHarBridge(handleHarFileParsed);

  const handleHarImportClose = useCallback(() => {
    setHarParseResult(null);
    setHarFileName('');
  }, []);

  const handleHarImport = useCallback((entries: ParsedHarEntry[], workflowName: string) => {
    const { nodes: harNodes, edges: harEdges, variables: harVariables } = harToWorkflow(entries);
    onClearPreview();
    const wf = create(workflowName.trim() || 'HAR import');
    // Replace the default start node with the HAR-generated nodes/edges/variables
    update(wf.id, { nodes: harNodes, edges: harEdges, variables: harVariables });
    select(wf.id);
    setHarParseResult(null);
    setHarFileName('');
  }, [create, update, select, onClearPreview]);

  const handleSelect = useCallback((id: string) => {
    onClearPreview();
    setNavStack([]);
    select(id);
  }, [select, onClearPreview, setNavStack]);

  const inspectActions = useWorkflowDesignerInspectActions(
    openStepDetail,
    openVariableDetail,
    openNodeConfig,
    navigateToWorkflow,
    workflows,
  );

  const { onConnect, onReconnect } = useWorkflowEdgeOps({
    selected, nodes, setEdges, serializeNodes, update, undoRedo, nodeStatuses,
  });

  const {
    isDragOver, dropTargetEdgeId, canvasAreaRef,
    handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop,
  } = useWorkflowDragDrop({
    nodesRef, edgesRef, selected,
    addNodeToCanvas, insertNodeAndPersist,
    setNodes, setEdges, serializeNodes, serializeEdges,
    update, undoRedo,
  });

  const handleNodeClick = useCallback((_event: MouseEvent, node: WorkflowRFNode) => {
    setSelectedNodeId(node.id);
    setServiceRegistryMode((m) => m === 'panel' ? 'closed' : m);
    versioning.closeVersionPanel();
  }, [setSelectedNodeId, setServiceRegistryMode, versioning]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setNodeCtxMenu(null);
  }, [setSelectedNodeId, setNodeCtxMenu]);

  const handleNodeContextMenu = useCallback((event: MouseEvent, node: WorkflowRFNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setNodeCtxMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, [setSelectedNodeId, setNodeCtxMenu]);

  const latestStepSummaries = useMemo(() => {
    const latest = runHistory[0];
    return latest?.stepSummaries ?? [];
  }, [runHistory]);

  const variableCount = useMemo(
    () => countWorkflowDesignerVariables(workflowVariables, nodes, nodeInitialVars),
    [workflowVariables, nodes, nodeInitialVars],
  );

  const configModalWorkflows = useMemo(
    () => buildConfigModalWorkflowList(workflows, previewWorkflow, sampleWorkflowCatalog),
    [workflows, previewWorkflow],
  );

  const handleServiceRegistryApply = useCallback((svcs: WorkflowService[]) => {
    setWorkflowServices(svcs);
    const syncedNodes = syncHttpNodeLabelsWithServices(nodes, svcs);
    setNodes(syncedNodes);
    persistWorkflow({ services: svcs, rfNodes: syncedNodes });
  }, [setWorkflowServices, nodes, setNodes, persistWorkflow]);

  const handleReactFlowInit = useWorkflowPreviewReactFlowInit(previewWorkflow, setLaidOutId);

  const detailModalDerived = useMemo(
    () => {
      const failureReport = lastRunStatus === 'fail' && runHistory[0]
        ? buildQuickTestFailureReport(
            undefined,
            runHistory[0].stepSummaries,
            filterQuickTestVariableSnapshot(
              runHistory[0].variableSnapshot,
              collectWorkflowReferencedVariables(
                nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
              ),
              workflowVariables,
            ),
            runHistory[0].durationMs,
            runHistory[0].error,
          )
        : null;
      return getDetailModalProps(
        detailModal,
        stepDetailMeta,
        selectedNode?.type,
        lastRunError,
        failureReport,
      );
    },
    [detailModal, stepDetailMeta, selectedNode?.type, lastRunError, lastRunStatus, runHistory, nodes, workflowVariables],
  );

  return {
    collections,
    catalogEntries,
    previewEndpoints,
    environments,
    microservices,
    globalAuthProfiles,
    selectedEnvId,
    onEnvSelect,
    resolvedBaseUrl,
    handleAddNode,
    handleAddFromRequest,
    handleAddFromCatalog,
    handleUpdateNode,
    handleDeleteNode,
    handleExtractToSubWorkflow,
    handleEnvSelect,
    resolveHttpBaseUrlForGraph,
    resolveHttpAuthForGraph,
    isRunning,
    isDebugMode,
    debugControllerRef,
    runProgress,
    failedStepLabel,
    lastQuickTestRequestUrl,
    handleQuickTest,
    handleDebugQuickTest,
    handleDebugStep,
    handleDebugStop,
    handleResetRunStatus,
    selectedNode,
    conditionVariableHints,
    httpVariableHints,
    detailModal,
    setDetailModal,
    variableDetailDraft,
    setVariableDetailDraft,
    configModalNodeId,
    setConfigModalNodeId,
    extractionSampleJson,
    extractionFetching,
    extractionFetchError,
    openRunErrorDetail,
    openNodeConfig,
    handleApplyVariableDetail,
    configModalNode,
    effectiveQuickTestBaseUrl,
    handleExtractionFetchSample,
    navStack,
    navigateToWorkflow,
    handleBreadcrumbNavigate,
    handleNew,
    handleSelect,
    inspectActions,
    harParseResult,
    harFileName,
    handleHarFileParsed,
    handleHarImportClose,
    handleHarImport,
    onConnect,
    onReconnect,
    isDragOver,
    dropTargetEdgeId,
    canvasAreaRef,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleNodeClick,
    handlePaneClick,
    handleNodeContextMenu,
    latestStepSummaries,
    variableCount,
    configModalWorkflows,
    handleServiceRegistryApply,
    handleReactFlowInit,
    detailModalDerived,
  };
}
