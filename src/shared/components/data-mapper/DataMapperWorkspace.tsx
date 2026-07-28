import SourcePanel from './SourcePanel';
import TargetPanel from './TargetPanel';
import MappingCanvas from './MappingCanvas';
import type { MapperTarget, MapperSource, TargetField, FetchErrorDetail, FieldOperator, AdapterCapabilities } from './types';
import type { TraceValueOverlay } from './types';
import type { Mapping } from './types';
import type { TypeMismatch } from './utils/typeMismatch';
import type { FocusRegion } from './hooks/useKeyboardNavigation';
import type { DriftIndicator } from './SourceTreeNode';
import type { Assertion } from '../../types';
import type { ConnectionLine } from './hooks/useConnectionLines';
import type { ExpressionSuggestion } from './utils/expressionSuggestions';
import type { RepairSuggestion } from './utils/schemaRepair';
import type { VerifyResult } from './hooks/useValidationVerify';
import type { MappingTrace } from './utils/mappingTrace';

type MergedFieldResult = {
  passed: boolean;
  actual?: string;
  expected?: string;
  matchContext?: string;
};

export function DataMapperWorkspace(props: {
  panelsCollapsed: boolean;
  handleTreeNodeClickForLineFocus: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTreeNodeClickForKeyboard: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTreeNodeHover: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBodyMouseLeave: () => void;
  sourcePanelWidth: number | null;
  targetPanelWidth: number | null;
  canvasWidth: number;
  targetPanelRef: React.RefObject<HTMLDivElement | null>;
  containerHeight: number;
  handleResizeStart: (panel: 'source' | 'target', e: React.MouseEvent<HTMLDivElement>) => void;
  effectiveSources: MapperSource[];
  state: { mappings: Mapping[]; activeSourceId: string; selectedMappingId: string | null; sourceSampleOverrides: Record<string, unknown> };
  setActiveSource: (sourceId: string) => void;
  handleDragStart: (path: string, sourceId: string, type?: string) => void;
  handleSourceDragEnd: () => void;
  setSourceSample: (sourceId: string, value: unknown) => void;
  adapter: { fetchSampleData?: unknown; fetchTargetSchema?: unknown };
  handleFetchSample: () => Promise<void>;
  fetchError: FetchErrorDetail | null;
  sourceSearchRef: React.RefObject<HTMLInputElement | null>;
  handleSelectSourceNode: (path: string, sourceId: string) => void;
  bulkSourceId: string | null;
  bulkSourcePath: string | null;
  selectedSourcePaths: Set<string>;
  handleToggleSourcePath: (path: string) => void;
  focusRegion: FocusRegion | null;
  focusedPath: string | null;
  setFocusRegion: (region: FocusRegion) => void;
  handleTreeKeyDown: (e: React.KeyboardEvent, region: FocusRegion, expandedPaths: Set<string>, onToggle: (path: string) => void) => void;
  driftMap: Map<string, DriftIndicator> | undefined;
  sourceTraceOverlay: Map<string, TraceValueOverlay> | undefined;
  mappedSourcePaths: Set<string>;
  handleMapFilteredFields: (paths: string[], sourceId: string) => void;
  handleMapSelectedFields: (paths: string[], sourceId: string) => void;
  handleUnmapSelectedFields: (paths: string[]) => void;
  highlightedSourcePaths: Set<string> | null | undefined;
  visibleLines: ConnectionLine[];
  nodeFocusMode: boolean;
  handleSelectMappingExclusive: (id: string | null) => void;
  selectedIds: Set<string>;
  handleToggleSelectMapping: (id: string) => void;
  removeMapping: (id: string) => void;
  handleEditExpression: (id: string) => void;
  acceptPending: (id: string) => void;
  rejectPending: (id: string) => void;
  debugMode: boolean;
  targetTraceOverlay: Map<string, TraceValueOverlay> | undefined;
  traceByMappingId: Map<string, MappingTrace> | null;
  handleShowErrorDetail: (data: import('./MappingCanvas').ErrorDetailData, y: number) => void;
  expressionSuggestions: Map<string, ExpressionSuggestion[]> | undefined;
  handleApplySuggestion: (mappingId: string, expression: string) => void;
  repairSuggestions: Map<string, RepairSuggestion[]> | undefined;
  onApplyRepair?: (mappingId: string, suggestion: RepairSuggestion) => void;
  verifyHook: {
    result: VerifyResult;
    nodeStatusMap: Map<string, 'pass' | 'fail'>;
    mergedFieldResults: Map<string, MergedFieldResult>;
  };
  highlightedMappingIds: Set<string> | null;
  handleRemapDragStart: (id: string) => void;
  handleRemapDragEnd: () => void;
  effectiveTarget: MapperTarget;
  handleDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  typeMismatches: TypeMismatch[];
  handleQuickFix: (mappingId: string, suggestedExpression: string) => void;
  mappedTargetValueOverlay: Map<string, TraceValueOverlay> | Map<string, { value: string; isError: boolean }> | undefined;
  handleAddCustomField: (field: TargetField) => void;
  handleRemoveCustomField: (path: string) => void;
  handleUpdateCustomField: (oldPath: string, updated: TargetField) => void;
  handleFetchTargetSchema: () => Promise<void>;
  targetFetchError: FetchErrorDetail | null;
  handlePasteTargetSample: (data: unknown) => void;
  handleReorderTargetField: (fromPath: string, toPath: string) => void;
  handleTargetFieldDragStart: (path: string) => void;
  handleTargetFieldDragEnd: () => void;
  getDraggedSource: () => { sourceId: string; path: string } | null;
  getDraggedTargetFieldPath: () => string | null;
  handleSelectTargetNode: (path: string) => void;
  bulkTargetPath: string | null;
  mappingResolution: { resolved: number; unresolved: number };
  targetResetSignal: number | null;
  unorderedDefault?: boolean;
  onToggleUnorderedArray?: (arrayPath: string) => void;
  caps: Required<AdapterCapabilities>;
  handleUpdateMappingOperator: (mappingId: string, operator: FieldOperator | undefined, operatorValue: string | undefined) => void;
  handleToggleMappingNegate: (mappingId: string) => void;
  handleAddArrayAssertion: (arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => void;
  handleUpdateArrayAssertion: (index: number, patch: Partial<Assertion>) => void;
  handleRemoveArrayAssertion: (index: number) => void;
  assertionVerifyMap: Map<number, { passed: boolean; actual?: string; expected?: string }>;
  validationAssertions: Assertion[];
  filterFailedSignal: number | null;
  highlightedTargetPaths: Set<string> | null;
  handleRemapDrop: (targetPath: string, mappingId: string) => void;
  getDraggedRemapId: () => string | null;
  scrollToPathSignal: { path: string; tick: number } | null;
}) {
  return (
    <div className={`dm-body${props.panelsCollapsed ? ' dm-body--collapsed' : ''}`} onClickCapture={props.handleTreeNodeClickForLineFocus} onClick={props.handleTreeNodeClickForKeyboard} onMouseOver={props.handleTreeNodeHover} onMouseLeave={props.handleBodyMouseLeave}>
      <div className="dm-panel-wrapper" style={props.sourcePanelWidth ? { width: props.sourcePanelWidth, flex: 'none' } : undefined}>
        <SourcePanel
          sources={props.effectiveSources}
          activeSourceId={props.state.activeSourceId}
          sourceSampleOverrides={props.state.sourceSampleOverrides}
          onSourceChange={props.setActiveSource}
          onDragStart={props.handleDragStart}
          onDragEnd={props.handleSourceDragEnd}
          onSourceSampleChange={props.setSourceSample}
          onFetchSample={props.adapter.fetchSampleData ? props.handleFetchSample : undefined}
          canFetch={!!props.adapter.fetchSampleData}
          fetchError={props.fetchError}
          searchInputRef={props.sourceSearchRef}
          onNodeSelect={props.handleSelectSourceNode}
          selectedNodePath={props.bulkSourceId === props.state.activeSourceId ? props.bulkSourcePath : null}
          selectedSourcePaths={props.selectedSourcePaths}
          onToggleSourcePath={props.handleToggleSourcePath}
          isFocusRegion={props.focusRegion === 'source'}
          focusedPath={props.focusRegion === 'source' ? props.focusedPath : null}
          onFocus={() => props.setFocusRegion('source')}
          onTreeKeyDown={props.handleTreeKeyDown}
          driftMap={props.driftMap}
          traceOverlay={props.sourceTraceOverlay}
          mappedPaths={props.mappedSourcePaths}
          onMapFilteredFields={props.handleMapFilteredFields}
          onMapSelectedFields={props.handleMapSelectedFields}
          onUnmapSelectedFields={props.handleUnmapSelectedFields}
          highlightedPaths={props.highlightedSourcePaths}
        />
      </div>
      <div
        className="dm-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize source panel"
        onMouseDown={(e) => props.handleResizeStart('source', e)}
      />
      <div className="dm-canvas-wrapper" style={{ width: props.canvasWidth, flex: 'none' }}>
        <MappingCanvas
          lines={props.visibleLines}
          width={props.canvasWidth}
          height={props.containerHeight || 400}
          selectedMappingId={props.state.selectedMappingId}
          selectedMappingIds={props.selectedIds}
          onSelectMapping={props.handleSelectMappingExclusive}
          onToggleSelectMapping={props.handleToggleSelectMapping}
          onRemoveMapping={props.removeMapping}
          onEditExpression={props.handleEditExpression}
          onAcceptPending={props.acceptPending}
          onRejectPending={props.rejectPending}
          debugMode={props.debugMode}
          traceByMappingId={props.traceByMappingId}
          onShowErrorDetail={props.handleShowErrorDetail}
          expressionSuggestions={props.expressionSuggestions}
          onApplySuggestion={props.handleApplySuggestion}
          repairSuggestions={props.repairSuggestions}
          onApplyRepair={props.onApplyRepair}
          totalMappingCount={props.state.mappings.length}
          nodeFocusMode={props.nodeFocusMode}
          failedMappingIds={props.verifyHook.result.status === 'complete' ? props.verifyHook.result.failedMappingIds : undefined}
          highlightedMappingIds={props.highlightedMappingIds}
          onRemapDragStart={props.handleRemapDragStart}
          onRemapDragEnd={props.handleRemapDragEnd}
        />
      </div>
      <div
        className="dm-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize target panel"
        onMouseDown={(e) => props.handleResizeStart('target', e)}
      />
      <div className="dm-panel-wrapper" ref={props.targetPanelRef} style={props.targetPanelWidth ? { width: props.targetPanelWidth, flex: 'none' } : undefined}>
        <TargetPanel
          target={props.effectiveTarget}
          mappings={props.state.mappings}
          onDrop={props.handleDrop}
          selectedMappingId={props.state.selectedMappingId}
          onSelectMapping={props.handleSelectMappingExclusive}
          onEditExpression={props.handleEditExpression}
          typeMismatches={props.typeMismatches}
          onQuickFix={props.handleQuickFix}
          onRemoveMapping={props.removeMapping}
          isFocusRegion={props.focusRegion === 'target'}
          focusedPath={props.focusRegion === 'target' ? props.focusedPath : null}
          onFocus={() => props.setFocusRegion('target')}
          onTreeKeyDown={props.handleTreeKeyDown}
          traceOverlay={props.debugMode ? props.targetTraceOverlay : props.mappedTargetValueOverlay}
          onAddCustomField={props.effectiveTarget.allowCustomFields ? props.handleAddCustomField : undefined}
          onRemoveCustomField={props.handleRemoveCustomField}
          onUpdateCustomField={props.handleUpdateCustomField}
          onFetchTargetSchema={props.adapter.fetchTargetSchema ? props.handleFetchTargetSchema : undefined}
          canFetchTarget={!!props.adapter.fetchTargetSchema}
          targetFetchError={props.targetFetchError}
          onPasteTargetSample={props.handlePasteTargetSample}
          onReorderField={props.effectiveTarget.sampleData == null ? props.handleReorderTargetField : undefined}
          onTargetFieldDragStart={props.handleTargetFieldDragStart}
          onTargetFieldDragEnd={props.handleTargetFieldDragEnd}
          getDraggedSource={props.getDraggedSource}
          getDraggedTargetFieldPath={props.getDraggedTargetFieldPath}
          onNodeSelect={props.handleSelectTargetNode}
          selectedNodePath={props.bulkTargetPath}
          resolvedMappingCount={props.mappingResolution.resolved}
          unresolvedMappingCount={props.mappingResolution.unresolved}
          resetViewSignal={props.targetResetSignal}
          unorderedDefault={props.unorderedDefault}
          onToggleUnorderedArray={props.onToggleUnorderedArray}
          capabilities={props.caps}
          onUpdateMappingOperator={props.caps.operators ? props.handleUpdateMappingOperator : undefined}
          onToggleMappingNegate={props.caps.operators ? props.handleToggleMappingNegate : undefined}
          nodeStatusMap={props.verifyHook.result.status === 'complete' ? props.verifyHook.nodeStatusMap : undefined}
          fieldVerifyResults={props.verifyHook.result.status === 'complete' ? props.verifyHook.mergedFieldResults : undefined}
          onAddArrayAssertion={props.caps.arrayAssertions ? props.handleAddArrayAssertion : undefined}
          onUpdateArrayAssertion={props.caps.arrayAssertions ? props.handleUpdateArrayAssertion : undefined}
          onRemoveArrayAssertion={props.caps.arrayAssertions ? props.handleRemoveArrayAssertion : undefined}
          arrayAssertions={props.caps.arrayAssertions ? props.validationAssertions : undefined}
          assertionVerifyMap={props.assertionVerifyMap}
          filterFailedSignal={props.filterFailedSignal}
          highlightedPaths={props.highlightedTargetPaths}
          onRemapDrop={props.handleRemapDrop}
          onRemapDragStart={props.handleRemapDragStart}
          onRemapDragEnd={props.handleRemapDragEnd}
          getDraggedRemapId={props.getDraggedRemapId}
          scrollToPathSignal={props.scrollToPathSignal}
        />
      </div>
    </div>
  );
}
