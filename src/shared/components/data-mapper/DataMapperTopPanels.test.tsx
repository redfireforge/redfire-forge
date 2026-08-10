/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataMapperTopPanels } from './DataMapperTopPanels';

vi.mock('./MapperToolbar', () => ({
  default: (props: {
    onToggleDebugMode?: () => void;
    onLearnFromExamples?: () => void;
    onToggleMappingLines?: () => void;
    onToggleNodeFocusMode?: () => void;
    onConfidenceThresholdChange?: (value: number) => void;
  }) => {
    props.onToggleDebugMode?.();
    props.onToggleMappingLines?.();
    props.onToggleNodeFocusMode?.();
    return (
      <div>
        <button data-testid="mapper-toolbar" onClick={props.onToggleDebugMode}>toolbar</button>
        <button data-testid="mapper-learn" onClick={props.onLearnFromExamples}>learn</button>
        <button data-testid="mapper-lines" onClick={props.onToggleMappingLines}>lines</button>
        <button data-testid="mapper-focus" onClick={props.onToggleNodeFocusMode}>focus</button>
        <button data-testid="mapper-confidence" onClick={() => props.onConfidenceThresholdChange?.(0.7)}>confidence</button>
      </div>
    );
  },
}));
vi.mock('./BulkActionsBar', () => ({
  default: (props: { onClosePropagation?: () => void }) => (
    <button data-testid="bulk-actions" onClick={props.onClosePropagation}>bulk</button>
  ),
}));
vi.mock('./DataMapperDebugTraceBar', () => ({
  default: () => <div data-testid="debug-trace" />,
}));
vi.mock('./MappingHealthDashboard', () => ({
  default: () => <div data-testid="health" />,
}));
vi.mock('./ValidationRepairPanel', () => ({
  default: () => <div data-testid="repair" />,
}));

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    handleAutoMap: vi.fn(),
    handleClearAllMappings: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    state: { mappings: [], selectedMappingId: null },
    mappingResolution: { resolved: 0, unresolved: 0 },
    autoMapCandidateCount: 0,
    bottomUtilityMode: 'none',
    handleTogglePreview: vi.fn(),
    hasPending: false,
    acceptAllPending: vi.fn(),
    rejectAllPending: vi.fn(),
    adapter: { contextId: 'ctx', customFunctions: [] },
    caps: { codeEditor: true, verification: true },
    onLoadProfile: vi.fn(),
    onApplyProfileDelta: vi.fn(),
    handleToggleCodeView: vi.fn(),
    handleToggleTableView: vi.fn(),
    rulesModalOpen: false,
    handleToggleRulesView: vi.fn(),
    handleVerifyAll: vi.fn(),
    handleFetchAndVerify: vi.fn(),
    handleToggleAutoVerify: vi.fn(),
    autoVerifyEnabled: false,
    verifyHook: { result: { status: 'idle', passedCount: 0, failedCount: 0 } },
    validationSync: { parseErrors: [] },
    verifyFailuresList: [],
    handleNavigateToFailure: vi.fn(),
    effectiveHideAdvanced: false,
    handleLoadGallerySample: vi.fn(),
    hasTraceData: false,
    debugMode: false,
    setDebugMode: vi.fn(),
    traceErrorCount: 0,
    confidenceThreshold: 0.5,
    setConfidenceThreshold: vi.fn(),
    setShowExampleModal: vi.fn(),
    showMappingLines: true,
    setShowMappingLines: vi.fn(),
    nodeFocusMode: false,
    setNodeFocusMode: vi.fn(),
    compactMode: false,
    handleToggleCompactMode: vi.fn(),
    advancedControlsOpen: false,
    setAdvancedControlsOpen: vi.fn(),
    bulkSourcePath: null,
    bulkTargetPath: null,
    hasBulkSourceAndTarget: false,
    canMapSiblingSubtrees: false,
    canPreviewPropagation: false,
    selectedMapping: null,
    propagationPreview: null,
    handleMapSubtree: vi.fn(),
    handleMapSiblingSubtrees: vi.fn(),
    handleClearTargetSubtree: vi.fn(),
    handleReplaceTargetSubtree: vi.fn(),
    handlePreviewPropagation: vi.fn(),
    handleApplyPropagation: vi.fn(),
    setPropagationPreview: vi.fn(),
    traceByMappingId: new Map(),
    healthTargetTree: null,
    driftMappingIds: [],
    typeMismatches: [],
    onShowDrift: vi.fn(),
    visibleRepairIssues: [],
    handleFixRepairIssue: vi.fn(),
    handleReplaceRepairIssue: vi.fn(),
    handleIgnoreRepairIssue: vi.fn(),
    handleOpenRepairIssue: vi.fn(),
    ...overrides,
  };
}

describe('DataMapperTopPanels', () => {
  it('renders top panel sections and hides debug bar when disabled', () => {
    const props = makeProps();
    render(<DataMapperTopPanels {...props} />);

    expect(screen.getByTestId('mapper-toolbar')).not.toBeNull();
    expect(screen.getByTestId('bulk-actions')).not.toBeNull();
    expect(screen.getByTestId('health')).not.toBeNull();
    expect(screen.getByTestId('repair')).not.toBeNull();
    expect(screen.queryByTestId('debug-trace')).toBeNull();

    fireEvent.click(screen.getByTestId('mapper-toolbar'));
    fireEvent.click(screen.getByTestId('mapper-learn'));
    fireEvent.click(screen.getByTestId('mapper-lines'));
    fireEvent.click(screen.getByTestId('mapper-focus'));
    fireEvent.click(screen.getByTestId('mapper-confidence'));
    fireEvent.click(screen.getByTestId('bulk-actions'));

    expect(props.setDebugMode).toHaveBeenCalled();
    expect(props.setShowExampleModal).toHaveBeenCalledWith(true);
    expect(props.setShowMappingLines).toHaveBeenCalled();
    expect(props.setNodeFocusMode).toHaveBeenCalled();
    expect(props.setConfidenceThreshold).toHaveBeenCalledWith(0.7);
    expect(props.setPropagationPreview).toHaveBeenCalledWith(null);
  });

  it('renders debug trace bar when debug mode and trace data are enabled', () => {
    render(
      <DataMapperTopPanels
        {...makeProps({
          debugMode: true,
          hasTraceData: true,
          traceByMappingId: new Map([['m1', [{ step: 1 }]]]),
        })}
      />,
    );

    expect(screen.getByTestId('debug-trace')).not.toBeNull();
  });

  it('passes undefined advanced/capability callbacks when disabled', () => {
    render(
      <DataMapperTopPanels
        {...makeProps({
          caps: { codeEditor: false, verification: false },
          effectiveHideAdvanced: true,
          adapter: { contextId: 'ctx', customFunctions: [], fetchTargetSchema: undefined },
        })}
      />,
    );

    expect(screen.getByTestId('mapper-toolbar')).not.toBeNull();
  });
});
