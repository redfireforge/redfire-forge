/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataMapperOverlays } from './DataMapperOverlays';

vi.mock('./DataMapperArraySuggestionBar', () => ({
  default: (props: { onApplySuggestedExpression?: (id: string, expression: string) => void }) => (
    <button
      data-testid="array-suggestion"
      onClick={() => props.onApplySuggestedExpression?.('m1', '$.value')}
    >
      suggestion
    </button>
  ),
}));
vi.mock('./BottomUtilityDock', () => ({ default: () => <div data-testid="dock" /> }));
vi.mock('./ValidationRulesModal', () => ({ default: () => <div data-testid="rules-modal" /> }));
vi.mock('./ExpressionEditorModal', () => ({
  default: (props: { onCancel?: () => void; onRename?: (id: string, oldPath: string, newPath: string) => void }) => (
    <button
      data-testid="expr-modal"
      onClick={() => {
        props.onRename?.('m1', 'a.b', 'a.c');
        props.onCancel?.();
      }}
    >
      expr
    </button>
  ),
}));
vi.mock('./ErrorPopover', () => ({
  default: (props: { onClose?: () => void }) => (
    <button data-testid="error-popover" onClick={props.onClose}>error</button>
  ),
}));
vi.mock('./MapperFooter', () => ({
  default: (props: { onFilterFailed?: () => void }) => (
    <button data-testid="footer" onClick={props.onFilterFailed}>footer</button>
  ),
}));
vi.mock('./ExampleInferenceModal', () => ({
  default: (props: { onClose?: () => void; onApply?: () => void }) => (
    <button
      data-testid="example-modal"
      onClick={() => {
        props.onApply?.();
        props.onClose?.();
      }}
    >
      example
    </button>
  ),
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    selectedArrayInfo: null,
    state: { mappings: [], selectedMappingId: null, activeSourceId: 's1' },
    updateMapping: vi.fn(),
    bottomUtilityMode: 'none',
    panelsCollapsed: false,
    togglePanelsCollapsed: vi.fn(),
    handleDockResizeStart: vi.fn(),
    dockHeight: null,
    validationAssertions: [],
    effectiveSources: [],
    effectiveTarget: { sampleData: {}, allowCustomFields: true },
    adapter: { customFunctions: [] },
    debugMode: false,
    traceByMappingId: new Map(),
    removeMapping: vi.fn(),
    handleSelectMappingExclusive: vi.fn(),
    verifyHook: { result: { status: 'idle', failedMappingIds: [], passedCount: 0, failedCount: 0 } },
    assertionVerifyMap: {},
    rulesModalOpen: false,
    validationSync: { dslText: '', handleCodeChange: vi.fn(), parseErrors: [] },
    validationSamplePaths: [],
    handleCloseRulesModal: vi.fn(),
    handleJumpToNode: vi.fn(),
    containerRef: { current: null },
    rulesLineResults: [],
    unorderedDefault: false,
    editingMapping: null,
    handleSaveExpression: vi.fn(),
    setEditingMappingId: vi.fn(),
    handleUpdateCustomField: vi.fn(),
    toast: null,
    errorPopover: null,
    errorPopoverRef: { current: null },
    setErrorPopover: vi.fn(),
    compactMode: false,
    setFilterFailedSignal: vi.fn(),
    arrayMappingInfos: [],
    typeMismatches: [],
    mappingResolution: { resolved: 0, unresolved: 0 },
    showExampleModal: false,
    setShowExampleModal: vi.fn(),
    handleExampleInferenceApply: vi.fn(),
    ...overrides,
  };
}

describe('DataMapperOverlays', () => {
  it('renders minimal overlays in none mode', () => {
    const props = baseProps();
    render(<DataMapperOverlays {...props} />);

    expect(screen.getByTestId('array-suggestion')).not.toBeNull();
    expect(screen.queryByTestId('dock')).toBeNull();
    expect(screen.getByTestId('footer')).not.toBeNull();

    fireEvent.click(screen.getByTestId('array-suggestion'));
    expect(props.updateMapping).toHaveBeenCalledWith('m1', { expression: '$.value' });
  });

  it('renders dock/modals/toasts/popover/example when enabled', () => {
    const setShowExampleModal = vi.fn();
    const setEditingMappingId = vi.fn();
    const setErrorPopover = vi.fn();
    const props = baseProps({
      bottomUtilityMode: 'preview',
      panelsCollapsed: true,
      rulesModalOpen: true,
      editingMapping: { id: 'm1', targetPath: 'a.b' },
      toast: 'Saved',
      errorPopover: { data: { title: 'Error' }, y: 100 },
      verifyHook: { result: { status: 'idle', failedMappingIds: [], passedCount: 0, failedCount: 2 } },
      showExampleModal: true,
      setShowExampleModal,
      setEditingMappingId,
      setErrorPopover,
      handleExampleInferenceApply: vi.fn(),
      effectiveTarget: { sampleData: {}, allowCustomFields: false },
    });

    render(
      <DataMapperOverlays {...props} />,
    );

    expect(screen.getByTestId('dock')).not.toBeNull();
    expect(screen.getByTestId('rules-modal')).not.toBeNull();
    expect(screen.getByTestId('expr-modal')).not.toBeNull();
    expect(screen.getByText('Saved')).not.toBeNull();
    expect(screen.getByTestId('error-popover')).not.toBeNull();
    expect(screen.getByTestId('example-modal')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show panels' }));
    expect(props.togglePanelsCollapsed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('expr-modal'));
    expect(props.setEditingMappingId).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByTestId('error-popover'));
    expect(props.setErrorPopover).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByTestId('footer'));
    expect(props.setFilterFailedSignal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('example-modal'));
    expect(props.handleExampleInferenceApply).toHaveBeenCalledTimes(1);
    expect(setShowExampleModal).toHaveBeenCalledWith(false);
  });

  it('passes rename callback when custom fields are allowed', () => {
    const props = baseProps({
      editingMapping: { id: 'm1', targetPath: 'a.b' },
      effectiveTarget: { sampleData: {}, allowCustomFields: true },
    });

    render(<DataMapperOverlays {...props} />);
    fireEvent.click(screen.getByTestId('expr-modal'));

    expect(props.handleUpdateCustomField).toHaveBeenCalledWith('a.b', {
      path: 'a.c',
      label: 'c',
    });
  });
});
