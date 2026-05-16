import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import type { MapperAdapter, Mapping, DataMapperProps } from './types';
import { resolveCapabilities } from './types';
import { useMapperState } from './hooks/useMapperState';
import { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
import { detectArrayMappings } from './utils/arrayMapping';
import type { ArrayLineKind } from './hooks/useConnectionLines';
import SourcePanel from './SourcePanel';
import TargetPanel from './TargetPanel';
import MappingCanvas from './MappingCanvas';
import MapperToolbar from './MapperToolbar';
import ExpressionEditorModal from './ExpressionEditorModal';
import { useDataMapperValidation } from './hooks/useDataMapperValidation';
import { useDataMapperAutoMap } from './hooks/useDataMapperAutoMap';
import { useDataMapperDrop } from './hooks/useDataMapperDrop';
import { useDataMapperEffects } from './hooks/useDataMapperEffects';
import { useDataMapperHandlers } from './hooks/useDataMapperHandlers';
import { useVerifyNavigation } from './hooks/useVerifyNavigation';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useBottomUtilityDock } from './hooks/useBottomUtilityDock';
import { useDataMapperTreeInteraction, type LineFocusNode } from './hooks/useDataMapperTreeInteraction';
import '../../../styles/data-mapper.css';
import '../../../styles/data-mapper-expression.css';

import { enrichConnectionLines } from './utils/lineEnrichment';
import { safeDeserialize } from './utils/bottomUtilityHelpers';
import ExampleInferenceModal from './ExampleInferenceModal';
import ErrorPopover from './ErrorPopover';
import { useDebugOverlay } from './hooks/useDebugOverlay';
import MappingHealthDashboard from './MappingHealthDashboard';
import ValidationRepairPanel from './ValidationRepairPanel';
import MapperFooter from './MapperFooter';
import BulkActionsBar from './BulkActionsBar';
import BottomUtilityDock from './BottomUtilityDock';
import ValidationRulesModal from './ValidationRulesModal';
import { buildAssertionVerifyMap, buildRulesLineResults } from './utils/validationRulesResults';
import { useTargetFields } from './hooks/useTargetFields';
import { usePanelResize } from './hooks/usePanelResize';
import { useMapperKeyboard } from './hooks/useMapperKeyboard';
import { useMappingOverlay } from './hooks/useMappingOverlay';
import { buildTargetTree } from './utils/mapperTreeBuilders';
import { getArrayParentPath } from './utils/subtreeMapping';
import { useMappingDiagnostics } from './hooks/useMappingDiagnostics';
import { useMapperRepairActions } from './hooks/useMapperRepairActions';
import { useBulkSubtreeActions } from './hooks/useBulkSubtreeActions';
import { useHighlightedMappingPaths } from './hooks/useHighlightedMappingPaths';
import { useMapperVisibleLines } from './hooks/useMapperVisibleLines';
import { useDataMapperFocusCallbacks } from './hooks/useDataMapperFocusCallbacks';
import { useSourcePathBulkMapHandlers } from './hooks/useSourcePathBulkMapHandlers';
import DataMapperDebugTraceBar from './DataMapperDebugTraceBar';
import DataMapperArraySuggestionBar from './DataMapperArraySuggestionBar';

export default function DataMapper<TOutput = unknown>({
  adapter,
  initialData,
  onChange,
  onSourceSampleChange,
  height = 500,
  driftMap,
  driftMappingIds,
  repairTick,
  repairedMappingsRef,
  traceData,
  repairSuggestions,
  onApplyRepair,
  onShowDrift,
  unorderedDefault,
  onToggleUnorderedArray,
  hideAdvanced = false,
  onAssertionsChange,
  flushRef,
}: DataMapperProps<TOutput>) {
  const caps = useMemo(() => resolveCapabilities(adapter.capabilities), [adapter.capabilities]);
  const effectiveHideAdvanced = hideAdvanced || caps.hideAdvanced;

  const initialMappings = useMemo(
    () => safeDeserialize(adapter, initialData),
    [adapter, initialData],
  );

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const {
    bottomUtilityMode,
    rulesModalOpen,
    handleTogglePreview,
    handleToggleCodeView,
    handleToggleTableView,
    handleToggleRulesView,
    handleCloseRulesModal,
  } = useBottomUtilityDock();
  const [showMappingLines, setShowMappingLines] = useState(true);
  const [nodeFocusMode, setNodeFocusMode] = useState(false);
  const [lineFocusNode, setLineFocusNode] = useState<LineFocusNode>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSourcePaths, setSelectedSourcePaths] = useState<Set<string>>(new Set());
  const [bulkSourcePath, setBulkSourcePath] = useState<string | null>(null);
  const [bulkSourceId, setBulkSourceId] = useState<string | null>(null);
  const [bulkTargetPath, setBulkTargetPath] = useState<string | null>(null);
  const [targetResetSignal, setTargetResetSignal] = useState<number | null>(null);
  const [filterFailedSignal, setFilterFailedSignal] = useState<number | null>(null);
  const sourceSearchRef = useRef<HTMLInputElement | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);

  const {
    state,
    removeMapping,
    removeMappings,
    updateMapping,
    clearAll,
    selectMapping,
    setActiveSource,
    setSourceSample,
    setMappings,
    acceptPending,
    rejectPending,
    acceptAllPending,
    rejectAllPending,
    replaceMappingsFromProps,
    undo,
    redo,
    canUndo,
    canRedo,
    hasPending,
  } = useMapperState({
    initialMappings,
    initialSourceId: adapter.sources[0]?.id ?? '',
  });

  const prevInitialDataRef = useRef(initialData);
  const prevAdapterRef = useRef(adapter);
  useEffect(() => {
    if (prevInitialDataRef.current === initialData && prevAdapterRef.current === adapter) return;
    prevInitialDataRef.current = initialData;
    prevAdapterRef.current = adapter;
    replaceMappingsFromProps(safeDeserialize(adapter, initialData));
  }, [initialData, adapter, replaceMappingsFromProps]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const layoutTick = useLayoutTick(containerRef);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(() => initialMappings.length < 8);
  const previousMappingCountRef = useRef(initialMappings.length);

  const { focusRegion, focusedPath, setFocusRegion, setFocusedPath, handleTreeKeyDown: rawHandleTreeKeyDown } = useKeyboardNavigation({
    containerRef,
    disabled: !!editingMappingId,
  });

  const {
    hoveredNodePath,
    hoveredNodeRegion,
    handleTreeNodeHover,
    handleBodyMouseLeave,
    handleTreeNodeClickForKeyboard,
    handleTreeNodeClickForLineFocus,
    handleTreeKeyDown,
    clearHover,
  } = useDataMapperTreeInteraction({
    setFocusRegion,
    setFocusedPath,
    rawHandleTreeKeyDown,
    showMappingLines,
    nodeFocusMode,
    setLineFocusNode,
  });

  const {
    effectiveTarget,
    targetFetchError,
    handleAddCustomField,
    handleRemoveCustomField,
    handleUpdateCustomField,
    handleFetchTargetSchema,
    handlePasteTargetSample,
    handleReorderTargetField,
    handleTargetFieldDragStart,
    handleTargetFieldDragEnd,
    getDraggedTargetFieldPath,
  } = useTargetFields({
    adapter,
    mappings: state.mappings,
    removeMappings,
    updateMapping,
  });

  const { sourcePanelWidth, targetPanelWidth, canvasWidth, handleResizeStart } = usePanelResize(containerRef);

  const prevRepairTickRef = useRef(repairTick ?? 0);
  const skipNextOnChangeRef = useRef(false);

  useEffect(() => {
    const tick = repairTick ?? 0;
    if (tick !== prevRepairTickRef.current) {
      prevRepairTickRef.current = tick;
      if (repairedMappingsRef?.current) {
        const repaired = repairedMappingsRef.current;
        skipNextOnChangeRef.current = true;
        setMappings(repaired);
        onChange?.(repaired);
      }
      return;
    }
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }
    onChange?.(state.mappings);
  }, [repairTick, repairedMappingsRef, setMappings, state.mappings, onChange]);

  useEffect(() => {
    onSourceSampleChange?.(state.sourceSampleOverrides);
  }, [state.sourceSampleOverrides, onSourceSampleChange]);

  const autoMapRefCleanupDep = state.mappings;
  const getEffectiveSourceData = useCallback((sourceId: string): unknown => {
    return state.sourceSampleOverrides[sourceId]
      ?? adapter.sources.find((s) => s.id === sourceId)?.sampleData;
  }, [state.sourceSampleOverrides, adapter.sources]);

  const {
    autoMapCandidateCount,
    autoMapScoresRef,
    patternMappingIdsRef,
    handleLoadGallerySample,
    handleApplyProfileDelta,
    handleAutoMap,
  } = useDataMapperAutoMap({
    adapter,
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    setMappings,
    setSelectedIds,
    setSelectedSourcePaths,
    setSourceSample,
    setToast,
    getEffectiveSourceData,
    effectiveTarget,
    confidenceThreshold,
    autoMapDefaultOperator: caps.autoMapDefaultOperator,
  });

  useEffect(() => {
    const currentIds = new Set(autoMapRefCleanupDep.map((m) => m.id));
    for (const id of autoMapScoresRef.current.keys()) {
      if (!currentIds.has(id)) autoMapScoresRef.current.delete(id);
    }
    for (const id of patternMappingIdsRef.current) {
      if (!currentIds.has(id)) patternMappingIdsRef.current.delete(id);
    }
  }, [autoMapRefCleanupDep, autoMapScoresRef, patternMappingIdsRef]);

  const dropHook = useDataMapperDrop({
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    selectedMappingId: state.selectedMappingId,
    getEffectiveSourceData,
    effectiveTarget,
    setMappings,
    setToast,
    setSelectedSourcePaths,
    setSelectedIds,
    selectMapping,
    selectedSourcePaths,
    setBulkSourcePath,
    setBulkSourceId,
    setBulkTargetPath,
    autoMapDefaultOperator: caps.autoMapDefaultOperator,
  });

  const {
    draggedSourceRef, propagationPreview, setPropagationPreview,
    suggestDropExpression, sourceTreeForDrop, targetTreeForDrop,
    sourceLeafPathsForPropagation, targetLeafPathsForPropagation,
    handleSelectSourceNode, handleSelectTargetNode, handleMapFilteredFields,
    handleDrop, handlePreviewPropagation, handleApplyPropagation,
    handleDragStart, handleSourceDragEnd, getDraggedSource,
    handleRemapDrop, handleRemapDragStart, handleRemapDragEnd, getDraggedRemapId,
  } = dropHook;

  const resetDraggedSource = useCallback(() => { draggedSourceRef.current = null; }, [draggedSourceRef]);

  const { handleMapSelectedFields, handleUnmapSelectedFields } = useSourcePathBulkMapHandlers({
    handleMapFilteredFields,
    setSelectedSourcePaths,
    mappings: state.mappings,
    removeMappings,
  });

  const {
    prepareSubtreeDropPlan,
    handleMapSubtree,
    handleMapSiblingSubtrees,
    handleClearTargetSubtree,
    handleReplaceTargetSubtree,
  } = useBulkSubtreeActions({
    bulkSourcePath,
    bulkSourceId,
    bulkTargetPath,
    sourceTree: sourceTreeForDrop,
    targetTree: targetTreeForDrop,
    mappings: state.mappings,
    suggestDropExpression,
    setMappings,
    setToast,
  });

  const subtreeDropPlanRef = dropHook.prepareSubtreeDropPlanRef;
  subtreeDropPlanRef.current = prepareSubtreeDropPlan;

  const {
    fetchError,
    handleFetchSample,
    effectiveSources,
    typeMismatches,
    mismatchIds,
    expressionSuggestions,
    mappedSourcePaths,
  } = useDataMapperEffects({
    adapter: adapter as MapperAdapter,
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    getEffectiveSourceData,
    effectiveTarget,
    setSourceSample,
    setSelectedSourcePaths,
    setSelectedIds,
    setBulkSourcePath,
    setBulkSourceId,
    setBulkTargetPath,
    setPropagationPreview,
    propagationPreview,
    resetDraggedSource,
    showMappingLines,
    nodeFocusMode,
    setLineFocusNode,
    setAdvancedControlsOpen,
    previousMappingCountRef,
    sourceSampleOverrides: state.sourceSampleOverrides,
  });

  const currentMappingIds = useMemo(
    () => new Set(state.mappings.map((m) => m.id)),
    [state.mappings],
  );

  const {
    debugMode, setDebugMode,
    errorPopover, setErrorPopover, errorPopoverRef,
    traceByMappingId, hasTraceData,
    handleShowErrorDetail, traceErrorCount,
    sourceTraceOverlay, targetTraceOverlay,
  } = useDebugOverlay({ traceData, currentMappingIds, activeSourceId: state.activeSourceId });

  const mappingDiagnostics = useMappingDiagnostics(
    state.mappings,
    state.activeSourceId,
    effectiveSources,
    effectiveTarget,
    typeMismatches,
  );

  const {
    visibleRepairIssues,
    handleFixRepairIssue,
    handleReplaceRepairIssue,
    handleIgnoreRepairIssue,
    handleOpenRepairIssue,
    clearIgnoredRepairIssues,
  } = useMapperRepairActions({
    diagnostics: mappingDiagnostics,
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    bulkSourcePath,
    bulkSourceId,
    bulkTargetPath,
    showMappingLines,
    nodeFocusMode,
    setMappings,
    updateMapping,
    selectMapping,
    setSelectedIds,
    setFocusRegion,
    setBulkSourceId,
    setBulkSourcePath,
    setBulkTargetPath,
    setLineFocusNode,
    setToast,
  });

  useEffect(() => {
    clearIgnoredRepairIssues();
  }, [state.mappings, clearIgnoredRepairIssues]);

  const mappingResolution = useMemo(
    () => ({
      unresolved: mappingDiagnostics.unresolved,
      resolved: mappingDiagnostics.resolved,
    }),
    [mappingDiagnostics.unresolved, mappingDiagnostics.resolved],
  );

  const arrayMappingInfos = useMemo(
    () => detectArrayMappings(state.mappings, effectiveSources, effectiveTarget, state.activeSourceId),
    [state.mappings, effectiveSources, effectiveTarget, state.activeSourceId],
  );

  const arrayInfoMap = useMemo(() => {
    const map = new Map<string, { kind: ArrayLineKind; label?: string }>();
    for (const info of arrayMappingInfos) {
      map.set(info.mappingId, { kind: info.kind, label: info.label });
    }
    return map;
  }, [arrayMappingInfos]);

  const { lines: rawLines, containerHeight } = useConnectionLines(state.mappings, containerRef, layoutTick, mismatchIds, arrayInfoMap);

  const lines = useMemo(() => enrichConnectionLines(rawLines, {
    autoMapScores: autoMapScoresRef.current,
    patternMappingIds: patternMappingIdsRef.current,
    driftMappingIds,
    debugMode,
    traceByMappingId,
  }), [rawLines, driftMappingIds, debugMode, traceByMappingId, autoMapScoresRef, patternMappingIdsRef]);

  const visibleLines = useMapperVisibleLines(lines, showMappingLines, nodeFocusMode, lineFocusNode);

  const { highlightedMappingIds, highlightedSourcePaths, highlightedTargetPaths } = useHighlightedMappingPaths(
    hoveredNodePath,
    hoveredNodeRegion,
    focusedPath,
    focusRegion,
    state.mappings,
    state.selectedMappingId,
  );

  const mappedTargetValueOverlay = useMappingOverlay(
    state.mappings,
    state.activeSourceId,
    effectiveSources,
    adapter.customFunctions,
  );

  const {
    handleEditExpression,
    handleClearAllMappings,
    handleSaveExpression,
    handleQuickFix,
    handleApplySuggestion,
    handleUpdateMappingOperator,
    handleToggleMappingNegate,
    handleExampleInferenceApply,
    handleToggleSelectMapping,
    handleToggleSourcePath,
  } = useDataMapperHandlers({
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    clearAll,
    selectMapping,
    updateMapping,
    setMappings,
    setSelectedIds,
    setSelectedSourcePaths,
    setBulkSourcePath,
    setBulkSourceId,
    setBulkTargetPath,
    setPropagationPreview,
    setLineFocusNode,
    setEditingMappingId,
    setTargetResetSignal,
    setToast,
    resetDraggedSource,
  });

  const {
    validationSamplePaths,
    validationAssertions,
    validationSync,
    autoVerifyEnabled,
    verifyHook,
    handleVerifyAll,
    handleFetchAndVerify,
    handleToggleAutoVerify,
    handleAddArrayAssertion,
    handleUpdateArrayAssertion,
    handleRemoveArrayAssertion,
  } = useDataMapperValidation({
    caps,
    adapter,
    mappings: state.mappings,
    activeSourceId: state.activeSourceId,
    setMappings,
    onChange,
    skipNextOnChangeRef,
    initialData,
    effectiveTarget,
    onAssertionsChange,
    flushRef,
    showRulesView: rulesModalOpen,
    handleFetchTargetSchema,
    setToast,
    unorderedArrays: unorderedDefault,
  });


  const selectedArrayInfo = useMemo(() => {
    if (!state.selectedMappingId) return null;
    return arrayMappingInfos.find((i) => i.mappingId === state.selectedMappingId) ?? null;
  }, [state.selectedMappingId, arrayMappingInfos]);

  const healthTargetTree = useMemo(
    () => buildTargetTree(effectiveTarget).tree,
    [effectiveTarget],
  );

  const editingMapping = useMemo(
    () => editingMappingId ? state.mappings.find((m) => m.id === editingMappingId) ?? null : null,
    [editingMappingId, state.mappings],
  );

  useMapperKeyboard({
    undo,
    redo,
    selectedMappingId: state.selectedMappingId,
    removeMapping,
    removeMappings,
    selectMapping,
    editingMappingId,
    selectedIds,
    setSelectedIds,
    sourceSearchRef,
  });

  const { targetPanelRef, verifyFailuresList, handleNavigateToFailure: rawNavigateToFailure } = useVerifyNavigation(verifyHook.result);
  const [scrollToPathSignal, setScrollToPathSignal] = useState<{ path: string; tick: number } | null>(null);

  const {
    handleSelectMappingExclusive,
    handleNavigateToFailure,
    handleJumpToNode,
    handleToggleCompactMode,
  } = useDataMapperFocusCallbacks({
    selectMapping,
    setSelectedIds,
    clearHover,
    rawNavigateToFailure,
    setScrollToPathSignal,
    setCompactMode,
    setAdvancedControlsOpen,
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasBulkSourceAndTarget = !!(
    bulkSourcePath
    && bulkTargetPath
    && bulkSourceId
    && bulkSourceId === state.activeSourceId
  );
  const canMapSiblingSubtrees = useMemo(() => {
    if (!hasBulkSourceAndTarget || !bulkSourcePath || !bulkTargetPath) return false;
    return getArrayParentPath(bulkSourcePath) != null && getArrayParentPath(bulkTargetPath) != null;
  }, [hasBulkSourceAndTarget, bulkSourcePath, bulkTargetPath]);
  const selectedMapping = useMemo(
    () => state.selectedMappingId
      ? state.mappings.find((mapping) => mapping.id === state.selectedMappingId) ?? null
      : null,
    [state.selectedMappingId, state.mappings],
  );
  const canPreviewPropagation = sourceLeafPathsForPropagation.length > 0
    && targetLeafPathsForPropagation.length > 0;

  const rulesLineResults = useMemo(
    () => buildRulesLineResults(verifyHook.result, validationSync.dslText),
    [verifyHook.result, validationSync.dslText],
  );

  const assertionVerifyMap = useMemo(
    () => buildAssertionVerifyMap(verifyHook.result, validationAssertions),
    [verifyHook.result, validationAssertions],
  );

  return (
    <div className="dm-container" ref={containerRef} style={{ height }}>
      <MapperToolbar
        onAutoMap={handleAutoMap}
        onClearAll={handleClearAllMappings}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        mappingCount={state.mappings.length}
        resolvedCount={mappingResolution.resolved}
        unresolvedCount={mappingResolution.unresolved}
        autoMapCount={autoMapCandidateCount}
        showPreview={bottomUtilityMode === 'preview'}
        onTogglePreview={handleTogglePreview}
        hasPending={hasPending}
        onAcceptAllPending={acceptAllPending}
        onRejectAllPending={rejectAllPending}
        contextId={adapter.contextId}
        mappings={state.mappings}
        capabilities={caps}
        onLoadProfile={effectiveHideAdvanced ? undefined : (m: Mapping[]) => { setMappings(m); setSelectedIds(new Set()); setSelectedSourcePaths(new Set()); }}
        onApplyProfileDelta={effectiveHideAdvanced ? undefined : handleApplyProfileDelta}
        showCodeView={bottomUtilityMode === 'code'}
        onToggleCodeView={handleToggleCodeView}
        showTableView={bottomUtilityMode === 'table'}
        onToggleTableView={handleToggleTableView}
        showRulesView={rulesModalOpen}
        onToggleRulesView={caps.codeEditor ? handleToggleRulesView : undefined}
        onVerifyAll={caps.verification ? handleVerifyAll : undefined}
        onFetchAndVerify={caps.verification && adapter.fetchTargetSchema ? handleFetchAndVerify : undefined}
        onToggleAutoVerify={caps.verification ? handleToggleAutoVerify : undefined}
        autoVerify={autoVerifyEnabled}
        verifyStatus={verifyHook.result.status}
        verifyPassedCount={verifyHook.result.passedCount}
        verifyFailedCount={verifyHook.result.failedCount}
        verifyParseErrorCount={validationSync.parseErrors.length}
        verifyFailures={verifyFailuresList}
        onNavigateToFailure={handleNavigateToFailure}
        onLoadGallerySample={effectiveHideAdvanced ? undefined : handleLoadGallerySample}
        hasTraceData={hasTraceData}
        debugMode={debugMode}
        onToggleDebugMode={() => setDebugMode((d) => !d)}
        traceErrorCount={traceErrorCount}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={effectiveHideAdvanced ? undefined : setConfidenceThreshold}
        onLearnFromExamples={effectiveHideAdvanced ? undefined : () => setShowExampleModal(true)}
        showMappingLines={showMappingLines}
        onToggleMappingLines={() => setShowMappingLines((s) => !s)}
        nodeFocusMode={nodeFocusMode}
        onToggleNodeFocusMode={() => setNodeFocusMode((s) => !s)}
        compactMode={compactMode}
        onToggleCompactMode={handleToggleCompactMode}
        advancedOpen={advancedControlsOpen}
        onAdvancedOpenChange={setAdvancedControlsOpen}
      />
      <BulkActionsBar
        bulkSourcePath={bulkSourcePath}
        bulkTargetPath={bulkTargetPath}
        hasBulkSourceAndTarget={hasBulkSourceAndTarget}
        canMapSiblingSubtrees={canMapSiblingSubtrees}
        canPreviewPropagation={canPreviewPropagation}
        selectedMappingTargetPath={selectedMapping?.targetPath ?? null}
        propagationPreview={propagationPreview}
        onMapSubtree={handleMapSubtree}
        onMapSiblingSubtrees={handleMapSiblingSubtrees}
        onClearTargetSubtree={handleClearTargetSubtree}
        onReplaceTargetSubtree={handleReplaceTargetSubtree}
        onPreviewPropagation={handlePreviewPropagation}
        onApplyPropagation={handleApplyPropagation}
        onClosePropagation={() => setPropagationPreview(null)}
      />
      {debugMode && hasTraceData && traceByMappingId && (
        <DataMapperDebugTraceBar
          traceCount={traceByMappingId.size}
          traceErrorCount={traceErrorCount}
        />
      )}
      <MappingHealthDashboard
        mappings={state.mappings}
        targetTree={healthTargetTree}
        driftMappingIds={driftMappingIds}
        typeMismatchCount={typeMismatches.length}
        onShowDrift={onShowDrift}
      />
      <ValidationRepairPanel
        issues={visibleRepairIssues}
        onFix={handleFixRepairIssue}
        onReplace={handleReplaceRepairIssue}
        onIgnoreOnce={handleIgnoreRepairIssue}
        onOpenNode={handleOpenRepairIssue}
      />
      <div className="dm-body" onClickCapture={handleTreeNodeClickForLineFocus} onClick={handleTreeNodeClickForKeyboard} onMouseOver={handleTreeNodeHover} onMouseLeave={handleBodyMouseLeave}>
        <div className="dm-panel-wrapper" style={sourcePanelWidth ? { width: sourcePanelWidth, flex: 'none' } : undefined}>
          <SourcePanel
            sources={effectiveSources}
            activeSourceId={state.activeSourceId}
            sourceSampleOverrides={state.sourceSampleOverrides}
            onSourceChange={setActiveSource}
            onDragStart={handleDragStart}
            onDragEnd={handleSourceDragEnd}
            onSourceSampleChange={setSourceSample}
            onFetchSample={adapter.fetchSampleData ? handleFetchSample : undefined}
            canFetch={!!adapter.fetchSampleData}
            fetchError={fetchError}
            searchInputRef={sourceSearchRef}
            onNodeSelect={handleSelectSourceNode}
            selectedNodePath={bulkSourceId === state.activeSourceId ? bulkSourcePath : null}
            selectedSourcePaths={selectedSourcePaths}
            onToggleSourcePath={handleToggleSourcePath}
            isFocusRegion={focusRegion === 'source'}
            focusedPath={focusRegion === 'source' ? focusedPath : null}
            onFocus={() => setFocusRegion('source')}
            onTreeKeyDown={handleTreeKeyDown}
            driftMap={driftMap}
            traceOverlay={sourceTraceOverlay}
            mappedPaths={mappedSourcePaths}
            onMapFilteredFields={handleMapFilteredFields}
            onMapSelectedFields={handleMapSelectedFields}
            onUnmapSelectedFields={handleUnmapSelectedFields}
            highlightedPaths={highlightedSourcePaths}
          />
        </div>
        <div
          className="dm-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize source panel"
          onMouseDown={(e) => handleResizeStart('source', e)}
        />
        <div className="dm-canvas-wrapper" style={{ width: canvasWidth, flex: 'none' }}>
          <MappingCanvas
            lines={visibleLines}
            width={canvasWidth}
            height={containerHeight || 400}
            selectedMappingId={state.selectedMappingId}
            selectedMappingIds={selectedIds}
            onSelectMapping={handleSelectMappingExclusive}
            onToggleSelectMapping={handleToggleSelectMapping}
            onRemoveMapping={removeMapping}
            onEditExpression={handleEditExpression}
            onAcceptPending={acceptPending}
            onRejectPending={rejectPending}
            debugMode={debugMode}
            traceByMappingId={traceByMappingId}
            onShowErrorDetail={handleShowErrorDetail}
            expressionSuggestions={expressionSuggestions}
            onApplySuggestion={handleApplySuggestion}
            repairSuggestions={repairSuggestions}
            onApplyRepair={onApplyRepair}
            totalMappingCount={state.mappings.length}
            failedMappingIds={verifyHook.result.status === 'complete' ? verifyHook.result.failedMappingIds : undefined}
            highlightedMappingIds={highlightedMappingIds}
            onRemapDragStart={handleRemapDragStart}
            onRemapDragEnd={handleRemapDragEnd}
          />
        </div>
        <div
          className="dm-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize target panel"
          onMouseDown={(e) => handleResizeStart('target', e)}
        />
        <div className="dm-panel-wrapper" ref={targetPanelRef} style={targetPanelWidth ? { width: targetPanelWidth, flex: 'none' } : undefined}>
          <TargetPanel
            target={effectiveTarget}
            mappings={state.mappings}
            onDrop={handleDrop}
            selectedMappingId={state.selectedMappingId}
            onSelectMapping={handleSelectMappingExclusive}
            onEditExpression={handleEditExpression}
            typeMismatches={typeMismatches}
            onQuickFix={handleQuickFix}
            onRemoveMapping={removeMapping}
            isFocusRegion={focusRegion === 'target'}
            focusedPath={focusRegion === 'target' ? focusedPath : null}
            onFocus={() => setFocusRegion('target')}
            onTreeKeyDown={handleTreeKeyDown}
            traceOverlay={debugMode ? targetTraceOverlay : mappedTargetValueOverlay}
            onAddCustomField={effectiveTarget.allowCustomFields ? handleAddCustomField : undefined}
            onRemoveCustomField={handleRemoveCustomField}
            onUpdateCustomField={handleUpdateCustomField}
            onFetchTargetSchema={adapter.fetchTargetSchema ? handleFetchTargetSchema : undefined}
            canFetchTarget={!!adapter.fetchTargetSchema}
            targetFetchError={targetFetchError}
            onPasteTargetSample={handlePasteTargetSample}
            onReorderField={effectiveTarget.sampleData == null ? handleReorderTargetField : undefined}
            onTargetFieldDragStart={handleTargetFieldDragStart}
            onTargetFieldDragEnd={handleTargetFieldDragEnd}
            getDraggedSource={getDraggedSource}
            getDraggedTargetFieldPath={getDraggedTargetFieldPath}
            onNodeSelect={handleSelectTargetNode}
            selectedNodePath={bulkTargetPath}
            resolvedMappingCount={mappingResolution.resolved}
            unresolvedMappingCount={mappingResolution.unresolved}
            resetViewSignal={targetResetSignal}
            unorderedDefault={unorderedDefault}
            onToggleUnorderedArray={onToggleUnorderedArray}
            capabilities={caps}
            onUpdateMappingOperator={caps.operators ? handleUpdateMappingOperator : undefined}
            onToggleMappingNegate={caps.operators ? handleToggleMappingNegate : undefined}
            nodeStatusMap={verifyHook.result.status === 'complete' ? verifyHook.nodeStatusMap : undefined}
            fieldVerifyResults={verifyHook.result.status === 'complete' ? verifyHook.mergedFieldResults : undefined}
            onAddArrayAssertion={caps.arrayAssertions ? handleAddArrayAssertion : undefined}
            onUpdateArrayAssertion={caps.arrayAssertions ? handleUpdateArrayAssertion : undefined}
            onRemoveArrayAssertion={caps.arrayAssertions ? handleRemoveArrayAssertion : undefined}
            arrayAssertions={caps.arrayAssertions ? validationAssertions : undefined}
            assertionVerifyMap={assertionVerifyMap}
            filterFailedSignal={filterFailedSignal}
            highlightedPaths={highlightedTargetPaths}
            onRemapDrop={handleRemapDrop}
            onRemapDragStart={handleRemapDragStart}
            onRemapDragEnd={handleRemapDragEnd}
            getDraggedRemapId={getDraggedRemapId}
            scrollToPathSignal={scrollToPathSignal}
          />
        </div>
      </div>
      <DataMapperArraySuggestionBar
        selectedArrayInfo={selectedArrayInfo}
        selectedMappingId={state.selectedMappingId}
        onApplySuggestedExpression={(mappingId, expression) => {
          updateMapping(mappingId, { expression });
        }}
      />
      {bottomUtilityMode !== 'none' && (
        <BottomUtilityDock
          mode={bottomUtilityMode}
          mappings={state.mappings}
          assertions={validationAssertions}
          sources={effectiveSources}
          activeSourceId={state.activeSourceId}
          targetSampleData={effectiveTarget.sampleData}
          customFunctions={adapter.customFunctions}
          debugMode={debugMode}
          traceByMappingId={traceByMappingId}
          selectedMappingId={state.selectedMappingId}
          onRemoveMapping={removeMapping}
          onSelectMapping={handleSelectMappingExclusive}
          verifyStatus={verifyHook.result.status}
          failedMappingIds={verifyHook.result.failedMappingIds}
        />
      )}
      {rulesModalOpen && (
        <ValidationRulesModal
          value={validationSync.dslText}
          onChange={validationSync.handleCodeChange}
          errors={validationSync.parseErrors}
          samplePaths={validationSamplePaths}
          onClose={handleCloseRulesModal}
          onJumpToNode={handleJumpToNode}
          portalContainerRef={containerRef}
          verifyStatus={verifyHook.result.status}
          verifyPassedCount={verifyHook.result.passedCount}
          verifyFailedCount={verifyHook.result.failedCount}
          lineResults={rulesLineResults}
          sampleResponseData={effectiveTarget.sampleData}
          unorderedArrays={unorderedDefault}
        />
      )}
      {editingMapping && (
        <ExpressionEditorModal
          mapping={editingMapping}
          sources={effectiveSources}
          activeSourceId={state.activeSourceId}
          customFunctions={adapter.customFunctions}
          onSave={handleSaveExpression}
          onCancel={() => setEditingMappingId(null)}
          onRename={effectiveTarget.allowCustomFields ? (_mappingId, oldPath, newPath) => {
            handleUpdateCustomField(oldPath, { path: newPath, label: newPath.split('.').pop() || newPath });
          } : undefined}
        />
      )}
      {toast && (
        <div className="dm-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {errorPopover && (
        <ErrorPopover
          ref={errorPopoverRef}
          data={errorPopover.data}
          y={errorPopover.y}
          onClose={() => setErrorPopover(null)}
        />
      )}
      <MapperFooter
        mappings={state.mappings}
        arrayMappingInfos={arrayMappingInfos}
        typeMismatches={typeMismatches}
        resolvedCount={mappingResolution.resolved}
        unresolvedCount={mappingResolution.unresolved}
        compactMode={compactMode}
        verifyPassedCount={verifyHook.result.passedCount}
        verifyFailedCount={verifyHook.result.failedCount}
        verifyStatus={verifyHook.result.status}
        onFilterFailed={verifyHook.result.failedCount > 0 ? () => setFilterFailedSignal(Date.now()) : undefined}
      />
      {showExampleModal && (
        <ExampleInferenceModal
          onClose={() => setShowExampleModal(false)}
          onApply={handleExampleInferenceApply}
        />
      )}
    </div>
  );
}
