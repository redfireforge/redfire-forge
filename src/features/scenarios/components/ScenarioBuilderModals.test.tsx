/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioBuilderModals from './ScenarioBuilderModals';
import type { ScenarioBuilderModalsProps } from './ScenarioBuilderModals';
import type { Scenario, FeatureGroup } from '../../../shared/types';
import type { TestEditorInputMode, TestEditorTab } from './TestEditorModal';
import type { UseTrashReturn } from '../hooks/useTrash';

vi.mock('./CopyTestModal', () => ({
  default: ({ onClose, onConfirm }: { onClose: () => void; onConfirm: (a: string, b: string) => void }) => (
    <div data-testid="copy-modal">
      <button onClick={onClose}>copy-close</button>
      <button onClick={() => onConfirm('fg1', 'sc1')}>copy-confirm</button>
    </div>
  ),
}));

vi.mock('./TestEditorModal', () => ({
  default: ({ onCancel, onDraftChange, onSave, onExportTest, draft }: {
    onCancel: () => void;
    onDraftChange: (d: Scenario) => void;
    onSave: () => void;
    onExportTest: (t: Scenario, opts?: unknown) => void;
    draft: Scenario;
  }) => (
    <div data-testid="editor-modal">
      <button onClick={onCancel}>editor-cancel</button>
      <button onClick={() => onDraftChange(draft)}>editor-draft</button>
      <button onClick={onSave}>editor-save</button>
      <button onClick={() => onExportTest(draft, undefined)}>editor-export</button>
    </div>
  ),
}));

vi.mock('./MoveModal', () => ({
  default: ({ onClose, sourceScenarioKind }: { onClose: () => void; sourceScenarioKind?: string }) => (
    <div data-testid="move-modal" data-kind={sourceScenarioKind ?? 'none'}>
      <button onClick={onClose}>move-close</button>
    </div>
  ),
}));

vi.mock('./CsvImportModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="csv-modal"><button onClick={onClose}>csv-close</button></div>
  ),
}));

vi.mock('../../../shared/components/ConfirmModal', () => ({
  default: ({ onCancel, confirmLabel }: { onCancel: () => void; confirmLabel: string }) => (
    <div data-testid="confirm-modal">
      <span>{confirmLabel}</span>
      <button onClick={onCancel}>confirm-cancel</button>
    </div>
  ),
}));

vi.mock('./ImportVersionModal', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="import-modal"><button onClick={onCancel}>import-cancel</button></div>
  ),
}));

vi.mock('./SharedDataSourceModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="shared-ds-modal"><button onClick={onClose}>shared-close</button></div>
  ),
}));

vi.mock('./FromSharedDsPickerModal', () => ({
  default: ({ onClose, onConfirm }: { onClose: () => void; onConfirm: (ds: unknown, name: string) => void }) => (
    <div data-testid="picker-modal">
      <button onClick={onClose}>picker-close</button>
      <button onClick={() => onConfirm({ id: 's1' }, 'NewTest')}>picker-confirm</button>
    </div>
  ),
}));

vi.mock('./TrashPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="trash-panel"><button onClick={onClose}>trash-close</button></div>
  ),
}));

vi.mock('./TrashUndoToast', () => ({
  default: ({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) => (
    <div data-testid="trash-toast">
      <button onClick={onUndo}>toast-undo</button>
      <button onClick={onDismiss}>toast-dismiss</button>
    </div>
  ),
}));

function makeTest(): Scenario {
  return {
    id: 'd1', name: 'Draft', url: 'http://x', method: 'GET',
    headers: [], body: '', auth: { type: 'none' },
    validation: { mode: 'status' } as Scenario['validation'],
  };
}

function makeFeatureGroups(): FeatureGroup[] {
  return [{ id: 'fg1', name: 'FG', scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [] }] }];
}

const trash = {
  moveToTrash: vi.fn(),
  trashItems: [],
  loading: false,
  trashSettings: {},
  updateTrashSettings: vi.fn(),
  restoreItem: vi.fn(),
  permanentlyDelete: vi.fn(),
  emptyAllTrash: vi.fn(),
  lastDeleted: null,
  undoLastDelete: vi.fn(),
  clearLastDeleted: vi.fn(),
} as unknown as UseTrashReturn;

function makeProps(over: Partial<ScenarioBuilderModalsProps> = {}): ScenarioBuilderModalsProps {
  return {
    featureGroups: makeFeatureGroups(),
    globalAuthProfiles: [],
    sharedDataSources: [],
    setSharedDataSources: vi.fn(),
    copyingTest: null,
    setCopyingTest: vi.fn(),
    confirmCopyTest: vi.fn(),
    editingTest: null,
    setEditingTest: vi.fn(),
    draft: makeTest(),
    setDraft: vi.fn(),
    saveTest: vi.fn(),
    inputMode: 'simple' as TestEditorInputMode,
    setInputMode: vi.fn(),
    activeTab: 'request' as TestEditorTab,
    setActiveTab: vi.fn(),
    resolvedBaseUrl: 'http://x',
    allAuthProfiles: [],
    exportTest: vi.fn(),
    handleVersionRestore: vi.fn(),
    handleVersionDelete: vi.fn(),
    handleVersionRename: vi.fn(),
    handleCreateParameterizedCopy: vi.fn(),
    handlePromoteToShared: vi.fn(() => 'id'),
    onOpenSharedDsModal: vi.fn(),
    moveDialog: null,
    setMoveDialog: vi.fn(),
    handleMoveConfirm: vi.fn(),
    csvImportOpen: false,
    setCsvImportOpen: vi.fn(),
    handleCsvImport: vi.fn(),
    confirmDialog: null,
    setConfirmDialog: vi.fn(),
    pendingImport: null,
    cancelPendingImport: vi.fn(),
    showSharedDsModal: false,
    setShowSharedDsModal: vi.fn(),
    sharedDsModalSelectedId: undefined,
    setSharedDsModalSelectedId: vi.fn(),
    currentEditingDraft: undefined,
    handleCreateTestFromSharedDs: vi.fn(),
    showFromSharedDsPicker: null,
    setShowFromSharedDsPicker: vi.fn(),
    showTrashPanel: false,
    setShowTrashPanel: vi.fn(),
    trash,
    ...over,
  };
}

beforeEach(() => resetAllMocks());

describe('ScenarioBuilderModals', () => {
  it('renders nothing when all flags are off', () => {
    const { container } = render(<ScenarioBuilderModals {...makeProps()} />);
    expect(container.querySelector('[data-testid]')).toBeNull();
  });

  it('renders CopyTestModal and wires confirm/close', () => {
    const p = makeProps({ copyingTest: { test: makeTest(), sourceFeatureId: 'fg1', sourceScenarioId: 'sc1' } });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.getByTestId('copy-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('copy-confirm'));
    expect(p.confirmCopyTest).toHaveBeenCalledWith('fg1', 'sc1');
    fireEvent.click(screen.getByText('copy-close'));
    expect(p.setCopyingTest).toHaveBeenCalledWith(null);
  });

  it('renders TestEditorModal and wires its callbacks', () => {
    const p = makeProps({ editingTest: { featureId: 'fg1', scenarioId: 'sc1', testId: 'new' } });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('editor-draft'));
    expect(p.setDraft).toHaveBeenCalled();
    fireEvent.click(screen.getByText('editor-save'));
    expect(p.saveTest).toHaveBeenCalled();
    fireEvent.click(screen.getByText('editor-export'));
    expect(p.exportTest).toHaveBeenCalled();
    fireEvent.click(screen.getByText('editor-cancel'));
    expect(p.setEditingTest).toHaveBeenCalledWith(null);
  });

  it('renders MoveModal with resolved scenario kind for test moves', () => {
    const p = makeProps({ moveDialog: { type: 'test', itemName: 'T', fgId: 'fg1', scenarioId: 'sc1' } });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.getByTestId('move-modal')).toHaveAttribute('data-kind', 'standard');
    fireEvent.click(screen.getByText('move-close'));
    expect(p.setMoveDialog).toHaveBeenCalledWith(null);
  });

  it('renders MoveModal without kind for non-test moves', () => {
    const p = makeProps({ moveDialog: { type: 'scenario', itemName: 'S', fgId: 'fg1' } });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.getByTestId('move-modal')).toHaveAttribute('data-kind', 'none');
  });

  it('renders CsvImportModal and closes', () => {
    const p = makeProps({ csvImportOpen: true });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('csv-close'));
    expect(p.setCsvImportOpen).toHaveBeenCalledWith(false);
  });

  it('renders ConfirmModal with default label and cancels', () => {
    const p = makeProps({ confirmDialog: { title: 'T', message: 'M', onConfirm: vi.fn() } as ScenarioBuilderModalsProps['confirmDialog'] });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    fireEvent.click(screen.getByText('confirm-cancel'));
    expect(p.setConfirmDialog).toHaveBeenCalledWith(null);
  });

  it('renders ConfirmModal with custom label', () => {
    const p = makeProps({ confirmDialog: { title: 'T', message: 'M', confirmLabel: 'Remove', onConfirm: vi.fn() } as ScenarioBuilderModalsProps['confirmDialog'] });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('renders ImportVersionModal and cancels', () => {
    const p = makeProps({ pendingImport: { data: {}, finalize: vi.fn() } as unknown as ScenarioBuilderModalsProps['pendingImport'] });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('import-cancel'));
    expect(p.cancelPendingImport).toHaveBeenCalled();
  });

  it('renders SharedDataSourceModal and closes resetting selected id', () => {
    const p = makeProps({ showSharedDsModal: true, sharedDataSources: [], setSharedDataSources: vi.fn() });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('shared-close'));
    expect(p.setShowSharedDsModal).toHaveBeenCalledWith(false);
    expect(p.setSharedDsModalSelectedId).toHaveBeenCalledWith(undefined);
  });

  it('does not render SharedDataSourceModal without sharedDataSources', () => {
    const p = makeProps({ showSharedDsModal: true, sharedDataSources: undefined });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.queryByTestId('shared-ds-modal')).toBeNull();
  });

  it('renders FromSharedDsPickerModal and wires confirm/close', () => {
    const p = makeProps({
      showFromSharedDsPicker: { fgId: 'fg1', scId: 'sc1' },
      sharedDataSources: [{ id: 's1' }] as unknown as ScenarioBuilderModalsProps['sharedDataSources'],
    });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('picker-confirm'));
    expect(p.handleCreateTestFromSharedDs).toHaveBeenCalledWith({ id: 's1' }, 'fg1', 'sc1', 'NewTest');
    fireEvent.click(screen.getByText('picker-close'));
    expect(p.setShowFromSharedDsPicker).toHaveBeenCalledWith(null);
  });

  it('does not render picker when there are no shared data sources', () => {
    const p = makeProps({ showFromSharedDsPicker: { fgId: 'fg1', scId: 'sc1' }, sharedDataSources: [] });
    render(<ScenarioBuilderModals {...p} />);
    expect(screen.queryByTestId('picker-modal')).toBeNull();
  });

  it('renders TrashPanel and closes', () => {
    const p = makeProps({ showTrashPanel: true });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('trash-close'));
    expect(p.setShowTrashPanel).toHaveBeenCalledWith(false);
  });

  it('renders TrashUndoToast and wires undo/dismiss', () => {
    const lastDeleted = { id: 'x' };
    const localTrash = { ...trash, lastDeleted } as unknown as UseTrashReturn;
    const p = makeProps({ trash: localTrash });
    render(<ScenarioBuilderModals {...p} />);
    fireEvent.click(screen.getByText('toast-undo'));
    expect(localTrash.undoLastDelete).toHaveBeenCalled();
    fireEvent.click(screen.getByText('toast-dismiss'));
    expect(localTrash.clearLastDeleted).toHaveBeenCalled();
  });
});
