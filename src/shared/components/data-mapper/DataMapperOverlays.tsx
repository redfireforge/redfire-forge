import DataMapperArraySuggestionBar from './DataMapperArraySuggestionBar';
import BottomUtilityDock from './BottomUtilityDock';
import ValidationRulesModal from './ValidationRulesModal';
import ExpressionEditorModal from './ExpressionEditorModal';
import ErrorPopover from './ErrorPopover';
import MapperFooter from './MapperFooter';
import ExampleInferenceModal from './ExampleInferenceModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataMapperOverlays(props: Record<string, any>) {
  return (
    <>
      <DataMapperArraySuggestionBar
        selectedArrayInfo={props.selectedArrayInfo}
        selectedMappingId={props.state.selectedMappingId}
        onApplySuggestedExpression={(mappingId, expression) => {
          props.updateMapping(mappingId, { expression });
        }}
      />
      {props.bottomUtilityMode !== 'none' && (
        <>
          <div className="dm-dock-resize-bar">
            <button
              type="button"
              className="dm-dock-collapse-toggle"
              onClick={props.togglePanelsCollapsed}
              title={props.panelsCollapsed ? 'Show Source/Target panels' : 'Hide Source/Target panels'}
              aria-label={props.panelsCollapsed ? 'Show panels' : 'Hide panels'}
            >
              <span className={`dm-dock-collapse-arrow ${props.panelsCollapsed ? 'down' : 'up'}`}>▲</span>
              {props.panelsCollapsed ? 'Show Panels' : 'Hide Panels'}
            </button>
            <div
              className="dm-dock-resize-handle"
              onMouseDown={props.handleDockResizeStart}
              title="Drag to resize"
            />
          </div>
          <BottomUtilityDock
            mode={props.bottomUtilityMode}
            style={props.panelsCollapsed ? { flex: 1, maxHeight: 'none' } : props.dockHeight != null ? { height: props.dockHeight, maxHeight: 'none' } : undefined}
            mappings={props.state.mappings}
            assertions={props.validationAssertions}
            sources={props.effectiveSources}
            activeSourceId={props.state.activeSourceId}
            targetSampleData={props.effectiveTarget.sampleData}
            customFunctions={props.adapter.customFunctions}
            debugMode={props.debugMode}
            traceByMappingId={props.traceByMappingId}
            selectedMappingId={props.state.selectedMappingId}
            onRemoveMapping={props.removeMapping}
            onSelectMapping={props.handleSelectMappingExclusive}
            verifyStatus={props.verifyHook.result.status}
            failedMappingIds={props.verifyHook.result.failedMappingIds}
            assertionVerifyMap={props.assertionVerifyMap}
          />
        </>
      )}
      {props.rulesModalOpen && (
        <ValidationRulesModal
          value={props.validationSync.dslText}
          onChange={props.validationSync.handleCodeChange}
          errors={props.validationSync.parseErrors}
          samplePaths={props.validationSamplePaths}
          onClose={props.handleCloseRulesModal}
          onJumpToNode={props.handleJumpToNode}
          portalContainerRef={props.containerRef}
          verifyStatus={props.verifyHook.result.status}
          verifyPassedCount={props.verifyHook.result.passedCount}
          verifyFailedCount={props.verifyHook.result.failedCount}
          lineResults={props.rulesLineResults}
          sampleResponseData={props.effectiveTarget.sampleData}
          unorderedArrays={props.unorderedDefault}
        />
      )}
      {props.editingMapping && (
        <ExpressionEditorModal
          mapping={props.editingMapping}
          sources={props.effectiveSources}
          activeSourceId={props.state.activeSourceId}
          customFunctions={props.adapter.customFunctions}
          onSave={props.handleSaveExpression}
          onCancel={() => props.setEditingMappingId(null)}
          onRename={props.effectiveTarget.allowCustomFields ? (_mappingId, oldPath, newPath) => {
            props.handleUpdateCustomField(oldPath, { path: newPath, label: newPath.split('.').pop() || newPath });
          } : undefined}
        />
      )}
      {props.toast && (
        <div className="dm-toast" role="status" aria-live="polite">
          {props.toast}
        </div>
      )}
      {props.errorPopover && (
        <ErrorPopover
          ref={props.errorPopoverRef}
          data={props.errorPopover.data}
          y={props.errorPopover.y}
          onClose={() => props.setErrorPopover(null)}
        />
      )}
      <MapperFooter
        mappings={props.state.mappings}
        arrayMappingInfos={props.arrayMappingInfos}
        typeMismatches={props.typeMismatches}
        resolvedCount={props.mappingResolution.resolved}
        unresolvedCount={props.mappingResolution.unresolved}
        compactMode={props.compactMode}
        verifyPassedCount={props.verifyHook.result.passedCount}
        verifyFailedCount={props.verifyHook.result.failedCount}
        verifyStatus={props.verifyHook.result.status}
        onFilterFailed={props.verifyHook.result.failedCount > 0 ? () => props.setFilterFailedSignal(Date.now()) : undefined}
      />
      {props.showExampleModal && (
        <ExampleInferenceModal
          onClose={() => props.setShowExampleModal(false)}
          onApply={props.handleExampleInferenceApply}
        />
      )}
    </>
  );
}
