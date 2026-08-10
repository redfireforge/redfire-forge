import MapperToolbar from './MapperToolbar';
import BulkActionsBar from './BulkActionsBar';
import DataMapperDebugTraceBar from './DataMapperDebugTraceBar';
import MappingHealthDashboard from './MappingHealthDashboard';
import ValidationRepairPanel from './ValidationRepairPanel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataMapperTopPanels(props: any) {
  // c8 ignore next
  const toggleDebugMode = () => props.setDebugMode((d: boolean) => !d);
  // c8 ignore next
  const toggleMappingLines = () => props.setShowMappingLines((s: boolean) => !s);
  // c8 ignore next
  const toggleNodeFocusMode = () => {
    const next = !props.nodeFocusMode;
    props.setNodeFocusMode(next);
    if (!next) {
      props.setLineFocusNode?.(null);
      return;
    }
    const selectedPath = props.selectedMapping?.targetPath as string | undefined;
    if (selectedPath) {
      props.setLineFocusNode?.({ region: 'target', path: selectedPath });
      props.setToast?.(`Focusing ${selectedPath}`);
      return;
    }
    props.setLineFocusNode?.(null);
    props.setToast?.('Focus on — click a Source or Target field to show its lines');
  };

  return (
    <>
      <MapperToolbar
        onAutoMap={props.handleAutoMap}
        onClearAll={props.handleClearAllMappings}
        onUndo={props.undo}
        onRedo={props.redo}
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        mappingCount={props.state.mappings.length}
        resolvedCount={props.mappingResolution.resolved}
        unresolvedCount={props.mappingResolution.unresolved}
        autoMapCount={props.autoMapCandidateCount}
        showPreview={props.bottomUtilityMode === 'preview'}
        onTogglePreview={props.handleTogglePreview}
        hasPending={props.hasPending}
        onAcceptAllPending={props.acceptAllPending}
        onRejectAllPending={props.rejectAllPending}
        contextId={props.adapter.contextId}
        mappings={props.state.mappings}
        capabilities={props.caps}
        onLoadProfile={props.onLoadProfile}
        onApplyProfileDelta={props.onApplyProfileDelta}
        showCodeView={props.bottomUtilityMode === 'code'}
        onToggleCodeView={props.handleToggleCodeView}
        showTableView={props.bottomUtilityMode === 'table'}
        onToggleTableView={props.handleToggleTableView}
        showRulesView={props.rulesModalOpen}
        onToggleRulesView={props.caps.codeEditor ? props.handleToggleRulesView : undefined}
        onVerifyAll={props.caps.verification ? props.handleVerifyAll : undefined}
        onFetchAndVerify={props.caps.verification && props.adapter.fetchTargetSchema ? props.handleFetchAndVerify : undefined}
        onToggleAutoVerify={props.caps.verification ? props.handleToggleAutoVerify : undefined}
        autoVerify={props.autoVerifyEnabled}
        verifyStatus={props.verifyHook.result.status}
        verifyPassedCount={props.verifyHook.result.passedCount}
        verifyFailedCount={props.verifyHook.result.failedCount}
        verifyParseErrorCount={props.validationSync.parseErrors.length}
        verifyFailures={props.verifyFailuresList}
        onNavigateToFailure={props.handleNavigateToFailure}
        onLoadGallerySample={props.effectiveHideAdvanced ? undefined : props.handleLoadGallerySample}
        hasTraceData={props.hasTraceData}
        debugMode={props.debugMode}
        onToggleDebugMode={toggleDebugMode}
        traceErrorCount={props.traceErrorCount}
        confidenceThreshold={props.confidenceThreshold}
        onConfidenceThresholdChange={props.effectiveHideAdvanced ? undefined : props.setConfidenceThreshold}
        onLearnFromExamples={props.effectiveHideAdvanced ? undefined : () => props.setShowExampleModal(true)}
        showMappingLines={props.showMappingLines}
        onToggleMappingLines={toggleMappingLines}
        nodeFocusMode={props.nodeFocusMode}
        onToggleNodeFocusMode={toggleNodeFocusMode}
        compactMode={props.compactMode}
        onToggleCompactMode={props.handleToggleCompactMode}
        advancedOpen={props.advancedControlsOpen}
        onAdvancedOpenChange={props.setAdvancedControlsOpen}
      />
      <BulkActionsBar
        bulkSourcePath={props.bulkSourcePath}
        bulkTargetPath={props.bulkTargetPath}
        hasBulkSourceAndTarget={props.hasBulkSourceAndTarget}
        canMapSiblingSubtrees={props.canMapSiblingSubtrees}
        canPreviewPropagation={props.canPreviewPropagation}
        selectedMappingTargetPath={props.selectedMapping?.targetPath ?? null}
        propagationPreview={props.propagationPreview}
        onMapSubtree={props.handleMapSubtree}
        onMapSiblingSubtrees={props.handleMapSiblingSubtrees}
        onClearTargetSubtree={props.handleClearTargetSubtree}
        onReplaceTargetSubtree={props.handleReplaceTargetSubtree}
        onPreviewPropagation={props.handlePreviewPropagation}
        onApplyPropagation={props.handleApplyPropagation}
        onClosePropagation={() => props.setPropagationPreview(null)}
      />
      {props.debugMode && props.hasTraceData && props.traceByMappingId && (
        <DataMapperDebugTraceBar
          traceCount={props.traceByMappingId.size}
          traceErrorCount={props.traceErrorCount}
        />
      )}
      <MappingHealthDashboard
        mappings={props.state.mappings}
        targetTree={props.healthTargetTree}
        driftMappingIds={props.driftMappingIds}
        typeMismatchCount={props.typeMismatches.length}
        onShowDrift={props.onShowDrift}
      />
      <ValidationRepairPanel
        issues={props.visibleRepairIssues}
        onFix={props.handleFixRepairIssue}
        onReplace={props.handleReplaceRepairIssue}
        onIgnoreOnce={props.handleIgnoreRepairIssue}
        onOpenNode={props.handleOpenRepairIssue}
      />
    </>
  );
}
