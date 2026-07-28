import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import type { MapperAdapter, Mapping, DataMapperProps } from './types';
import { resolveCapabilities } from './types';
import { useMapperState } from './hooks/useMapperState';
import { useConnectionLines, useLayoutTick } from './hooks/useConnectionLines';
import { detectArrayMappings } from './utils/arrayMapping';
import type { ArrayLineKind } from './hooks/useConnectionLines';

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
import { safeDeserialize } from './utils/bottomUtilityHelpers';
import { enrichConnectionLines } from './utils/lineEnrichment';
import { useDebugOverlay } from './hooks/useDebugOverlay';
import { buildAssertionVerifyMap, buildRulesLineResults } from './utils/validationRulesResults';
import { useTargetFields } from './hooks/useTargetFields';
import { usePanelResize } from './hooks/usePanelResize';
import { useMapperKeyboard } from './hooks/useMapperKeyboard';
import { useMappingOverlay } from './hooks/useMappingOverlay';
import { useMappingDiagnostics } from './hooks/useMappingDiagnostics';
import { useMapperRepairActions } from './hooks/useMapperRepairActions';
import { useBulkSubtreeActions } from './hooks/useBulkSubtreeActions';
import { buildTargetTree } from './utils/mapperTreeBuilders';
import { getArrayParentPath } from './utils/subtreeMapping';
import { useHighlightedMappingPaths } from './hooks/useHighlightedMappingPaths';
import { useMapperVisibleLines } from './hooks/useMapperVisibleLines';
import { useDataMapperFocusCallbacks } from './hooks/useDataMapperFocusCallbacks';
import { useDataMapperLifecycleEffects } from './hooks/useDataMapperLifecycleEffects';
import { useSourcePathBulkMapHandlers } from './hooks/useSourcePathBulkMapHandlers';
import { useDockResize } from './hooks/useDockResize';
import { DataMapperWorkspace } from './DataMapperWorkspace';
import { DataMapperTopPanels } from './DataMapperTopPanels';
import { DataMapperOverlays } from './DataMapperOverlays';

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

  const containerRef = useRef<HTMLDivElement | null>(null);
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
  const { dockHeight, panelsCollapsed, handleDockResizeStart, togglePanelsCollapsed } = useDockResize(containerRef);
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

  useEffect(() => {
    onSourceSampleChange?.(state.sourceSampleOverrides);
  }, [state.sourceSampleOverrides, onSourceSampleChange]);

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

  const { skipNextOnChangeRef } = useDataMapperLifecycleEffects({
    repairTick,
    repairedMappingsRef,
    setMappings,
    onChange,
    mappings: state.mappings,
    autoMapScoresRef,
    patternMappingIdsRef,
    adapter,
    activeSourceId: state.activeSourceId,
    sourceSampleOverrides: state.sourceSampleOverrides,
    setSourceSample,
    clearIgnoredRepairIssues,
    toast,
    setToast,
  });

  const mappingResolution = useMemo(() => ({
    unresolved: mappingDiagnostics.unresolved, resolved: mappingDiagnostics.resolved,
  }), [mappingDiagnostics.unresolved, mappingDiagnostics.resolved]);

  const arrayMappingInfos = useMemo(() => detectArrayMappings(state.mappings, effectiveSources, effectiveTarget, state.activeSourceId), [state.mappings, effectiveSources, effectiveTarget, state.activeSourceId]);

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
    setSourceSample,
    setToast,
    unorderedArrays: unorderedDefault,
  });

  const selectedArrayInfo = useMemo(() => !state.selectedMappingId ? null : arrayMappingInfos.find((i) => i.mappingId === state.selectedMappingId) ?? null, [state.selectedMappingId, arrayMappingInfos]);
  const healthTargetTree = useMemo(() => buildTargetTree(effectiveTarget).tree, [effectiveTarget]);
  const editingMapping = useMemo(() => editingMappingId ? state.mappings.find((m) => m.id === editingMappingId) ?? null : null, [editingMappingId, state.mappings]);

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

  const hasBulkSourceAndTarget = !!(bulkSourcePath && bulkTargetPath && bulkSourceId && bulkSourceId === state.activeSourceId);
  const canMapSiblingSubtrees = useMemo(() => {
    if (!hasBulkSourceAndTarget || !bulkSourcePath || !bulkTargetPath) return false;
    return getArrayParentPath(bulkSourcePath) != null && getArrayParentPath(bulkTargetPath) != null;
  }, [hasBulkSourceAndTarget, bulkSourcePath, bulkTargetPath]);
  const selectedMapping = useMemo(
    () => state.selectedMappingId ? state.mappings.find((m) => m.id === state.selectedMappingId) ?? null : null,
    [state.selectedMappingId, state.mappings],
  );
  const canPreviewPropagation = sourceLeafPathsForPropagation.length > 0 && targetLeafPathsForPropagation.length > 0;

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
      <DataMapperTopPanels
        handleAutoMap={handleAutoMap}
        handleClearAllMappings={handleClearAllMappings}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        state={state}
        mappingResolution={mappingResolution}
        autoMapCandidateCount={autoMapCandidateCount}
        bottomUtilityMode={bottomUtilityMode}
        handleTogglePreview={handleTogglePreview}
        hasPending={hasPending}
        acceptAllPending={acceptAllPending}
        rejectAllPending={rejectAllPending}
        adapter={adapter}
        caps={caps}
        onLoadProfile={effectiveHideAdvanced ? undefined : (m: Mapping[]) => { setMappings(m); setSelectedIds(new Set()); setSelectedSourcePaths(new Set()); }}
        onApplyProfileDelta={effectiveHideAdvanced ? undefined : handleApplyProfileDelta}
        handleToggleCodeView={handleToggleCodeView}
        handleToggleTableView={handleToggleTableView}
        rulesModalOpen={rulesModalOpen}
        handleToggleRulesView={handleToggleRulesView}
        handleVerifyAll={handleVerifyAll}
        handleFetchAndVerify={handleFetchAndVerify}
        handleToggleAutoVerify={handleToggleAutoVerify}
        autoVerifyEnabled={autoVerifyEnabled}
        verifyHook={verifyHook}
        validationSync={validationSync}
        verifyFailuresList={verifyFailuresList}
        handleNavigateToFailure={handleNavigateToFailure}
        effectiveHideAdvanced={effectiveHideAdvanced}
        handleLoadGallerySample={handleLoadGallerySample}
        hasTraceData={hasTraceData}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        traceErrorCount={traceErrorCount}
        confidenceThreshold={confidenceThreshold}
        setConfidenceThreshold={setConfidenceThreshold}
        setShowExampleModal={setShowExampleModal}
        showMappingLines={showMappingLines}
        setShowMappingLines={setShowMappingLines}
        nodeFocusMode={nodeFocusMode}
        setNodeFocusMode={setNodeFocusMode}
        setLineFocusNode={setLineFocusNode}
        setToast={setToast}
        compactMode={compactMode}
        handleToggleCompactMode={handleToggleCompactMode}
        advancedControlsOpen={advancedControlsOpen}
        setAdvancedControlsOpen={setAdvancedControlsOpen}
        bulkSourcePath={bulkSourcePath}
        bulkTargetPath={bulkTargetPath}
        hasBulkSourceAndTarget={hasBulkSourceAndTarget}
        canMapSiblingSubtrees={canMapSiblingSubtrees}
        canPreviewPropagation={canPreviewPropagation}
        selectedMapping={selectedMapping}
        propagationPreview={propagationPreview}
        handleMapSubtree={handleMapSubtree}
        handleMapSiblingSubtrees={handleMapSiblingSubtrees}
        handleClearTargetSubtree={handleClearTargetSubtree}
        handleReplaceTargetSubtree={handleReplaceTargetSubtree}
        handlePreviewPropagation={handlePreviewPropagation}
        handleApplyPropagation={handleApplyPropagation}
        setPropagationPreview={setPropagationPreview}
        traceByMappingId={traceByMappingId}
        healthTargetTree={healthTargetTree}
        driftMappingIds={driftMappingIds}
        typeMismatches={typeMismatches}
        onShowDrift={onShowDrift}
        visibleRepairIssues={visibleRepairIssues}
        handleFixRepairIssue={handleFixRepairIssue}
        handleReplaceRepairIssue={handleReplaceRepairIssue}
        handleIgnoreRepairIssue={handleIgnoreRepairIssue}
        handleOpenRepairIssue={handleOpenRepairIssue}
      />
      <DataMapperWorkspace
        panelsCollapsed={panelsCollapsed}
        handleTreeNodeClickForLineFocus={handleTreeNodeClickForLineFocus}
        handleTreeNodeClickForKeyboard={handleTreeNodeClickForKeyboard}
        handleTreeNodeHover={handleTreeNodeHover}
        handleBodyMouseLeave={handleBodyMouseLeave}
        sourcePanelWidth={sourcePanelWidth}
        targetPanelWidth={targetPanelWidth}
        canvasWidth={canvasWidth}
        targetPanelRef={targetPanelRef}
        containerHeight={containerHeight}
        handleResizeStart={handleResizeStart}
        effectiveSources={effectiveSources}
        state={state}
        setActiveSource={setActiveSource}
        handleDragStart={handleDragStart}
        handleSourceDragEnd={handleSourceDragEnd}
        setSourceSample={setSourceSample}
        adapter={adapter}
        handleFetchSample={handleFetchSample}
        fetchError={fetchError}
        sourceSearchRef={sourceSearchRef}
        handleSelectSourceNode={handleSelectSourceNode}
        bulkSourceId={bulkSourceId}
        bulkSourcePath={bulkSourcePath}
        selectedSourcePaths={selectedSourcePaths}
        handleToggleSourcePath={handleToggleSourcePath}
        focusRegion={focusRegion}
        focusedPath={focusedPath}
        setFocusRegion={setFocusRegion}
        handleTreeKeyDown={handleTreeKeyDown}
        driftMap={driftMap}
        sourceTraceOverlay={sourceTraceOverlay}
        mappedSourcePaths={mappedSourcePaths}
        handleMapFilteredFields={handleMapFilteredFields}
        handleMapSelectedFields={handleMapSelectedFields}
        handleUnmapSelectedFields={handleUnmapSelectedFields}
        highlightedSourcePaths={highlightedSourcePaths}
        visibleLines={visibleLines}
        nodeFocusMode={nodeFocusMode}
        handleSelectMappingExclusive={handleSelectMappingExclusive}
        selectedIds={selectedIds}
        handleToggleSelectMapping={handleToggleSelectMapping}
        removeMapping={removeMapping}
        handleEditExpression={handleEditExpression}
        acceptPending={acceptPending}
        rejectPending={rejectPending}
        debugMode={debugMode}
        traceByMappingId={traceByMappingId}
        handleShowErrorDetail={handleShowErrorDetail}
        expressionSuggestions={expressionSuggestions}
        handleApplySuggestion={handleApplySuggestion}
        repairSuggestions={repairSuggestions}
        onApplyRepair={onApplyRepair}
        verifyHook={verifyHook}
        highlightedMappingIds={highlightedMappingIds}
        handleRemapDragStart={handleRemapDragStart}
        handleRemapDragEnd={handleRemapDragEnd}
        effectiveTarget={effectiveTarget}
        handleDrop={handleDrop}
        typeMismatches={typeMismatches}
        handleQuickFix={handleQuickFix}
        mappedTargetValueOverlay={mappedTargetValueOverlay}
        targetTraceOverlay={targetTraceOverlay}
        handleAddCustomField={handleAddCustomField}
        handleRemoveCustomField={handleRemoveCustomField}
        handleUpdateCustomField={handleUpdateCustomField}
        handleFetchTargetSchema={handleFetchTargetSchema}
        targetFetchError={targetFetchError}
        handlePasteTargetSample={handlePasteTargetSample}
        handleReorderTargetField={handleReorderTargetField}
        handleTargetFieldDragStart={handleTargetFieldDragStart}
        handleTargetFieldDragEnd={handleTargetFieldDragEnd}
        getDraggedSource={getDraggedSource}
        getDraggedTargetFieldPath={getDraggedTargetFieldPath}
        handleSelectTargetNode={handleSelectTargetNode}
        bulkTargetPath={bulkTargetPath}
        mappingResolution={mappingResolution}
        targetResetSignal={targetResetSignal}
        unorderedDefault={unorderedDefault}
        onToggleUnorderedArray={onToggleUnorderedArray}
        caps={caps}
        handleUpdateMappingOperator={handleUpdateMappingOperator}
        handleToggleMappingNegate={handleToggleMappingNegate}
        validationAssertions={validationAssertions}
        assertionVerifyMap={assertionVerifyMap}
        handleAddArrayAssertion={handleAddArrayAssertion}
        handleUpdateArrayAssertion={handleUpdateArrayAssertion}
        handleRemoveArrayAssertion={handleRemoveArrayAssertion}
        filterFailedSignal={filterFailedSignal}
        highlightedTargetPaths={highlightedTargetPaths}
        handleRemapDrop={handleRemapDrop}
        getDraggedRemapId={getDraggedRemapId}
        scrollToPathSignal={scrollToPathSignal}
      />
      <DataMapperOverlays
        selectedArrayInfo={selectedArrayInfo}
        state={state}
        updateMapping={updateMapping}
        bottomUtilityMode={bottomUtilityMode}
        togglePanelsCollapsed={togglePanelsCollapsed}
        panelsCollapsed={panelsCollapsed}
        handleDockResizeStart={handleDockResizeStart}
        dockHeight={dockHeight}
        validationAssertions={validationAssertions}
        effectiveSources={effectiveSources}
        effectiveTarget={effectiveTarget}
        adapter={adapter}
        debugMode={debugMode}
        traceByMappingId={traceByMappingId}
        removeMapping={removeMapping}
        handleSelectMappingExclusive={handleSelectMappingExclusive}
        verifyHook={verifyHook}
        assertionVerifyMap={assertionVerifyMap}
        rulesModalOpen={rulesModalOpen}
        validationSync={validationSync}
        validationSamplePaths={validationSamplePaths}
        handleCloseRulesModal={handleCloseRulesModal}
        handleJumpToNode={handleJumpToNode}
        containerRef={containerRef}
        rulesLineResults={rulesLineResults}
        unorderedDefault={unorderedDefault}
        editingMapping={editingMapping}
        handleSaveExpression={handleSaveExpression}
        setEditingMappingId={setEditingMappingId}
        handleUpdateCustomField={handleUpdateCustomField}
        toast={toast}
        errorPopover={errorPopover}
        errorPopoverRef={errorPopoverRef}
        setErrorPopover={setErrorPopover}
        arrayMappingInfos={arrayMappingInfos}
        typeMismatches={typeMismatches}
        mappingResolution={mappingResolution}
        compactMode={compactMode}
        setFilterFailedSignal={setFilterFailedSignal}
        showExampleModal={showExampleModal}
        setShowExampleModal={setShowExampleModal}
        handleExampleInferenceApply={handleExampleInferenceApply}
      />
    </div>
  );
}
