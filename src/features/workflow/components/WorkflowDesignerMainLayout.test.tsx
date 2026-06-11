/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowDesignerMainLayout from './WorkflowDesignerMainLayout';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';

vi.mock('./panels/WorkflowInspectContext', () => ({
  WorkflowInspectProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./canvas/WorkflowToolbar', () => ({
  default: ({ onOpenServices, onOpenDefaults, onRunInHarness }: {
    onOpenServices: () => void;
    onOpenDefaults: () => void;
    onRunInHarness?: () => void;
  }) => (
    <div data-testid="toolbar">
      <button data-testid="tb-services" onClick={onOpenServices}>s</button>
      <button data-testid="tb-defaults" onClick={onOpenDefaults}>d</button>
      {onRunInHarness && <button data-testid="tb-harness" onClick={onRunInHarness}>h</button>}
    </div>
  ),
}));
vi.mock('./WorkflowBreadcrumb', () => ({ default: () => <div data-testid="breadcrumb" /> }));
vi.mock('./canvas/WorkflowStatusBar', () => ({
  default: ({ onRestoreRunHistory, onDeleteRunHistoryEntry, onClearRunHistory }: {
    onRestoreRunHistory: (id: string) => void;
    onDeleteRunHistoryEntry: (id: string) => void;
    onClearRunHistory: () => void;
  }) => (
    <div data-testid="statusbar">
      <button data-testid="sb-restore" onClick={() => onRestoreRunHistory('r1')}>r</button>
      <button data-testid="sb-delete" onClick={() => onDeleteRunHistoryEntry('r1')}>d</button>
      <button data-testid="sb-clear" onClick={onClearRunHistory}>c</button>
    </div>
  ),
}));
vi.mock('./WorkflowDesignerBody', () => ({ WorkflowDesignerBody: () => <div data-testid="body" /> }));
vi.mock('./WorkflowDesignerInspectModals', () => ({ WorkflowDesignerInspectModals: () => <div data-testid="inspect" /> }));
vi.mock('./WorkflowDesignerGlobalOverlays', () => ({ WorkflowDesignerGlobalOverlays: () => <div data-testid="overlays" /> }));
vi.mock('../../test-runner/components/WorkflowSlaPanel', () => ({
  default: ({ onSave }: { onSave: (t: unknown[]) => Promise<void> }) => (
    <div data-testid="sla"><button data-testid="sla-save" onClick={() => void onSave([])}>s</button></div>
  ),
}));

function makeVm(over: Partial<WorkflowDesignerViewModel> = {}): WorkflowDesignerViewModel {
  return {
    selected: { id: 'w1', name: 'WF', slaTargets: [] },
    onRunInHarness: undefined,
    workflows: [],
    wfFolders: [],
    isRunning: false,
    saveAcknowledged: false,
    workflowServices: [],
    variableCount: 0,
    versioning: { versionCount: 0, closeVersionPanel: vi.fn(), openVersionPanel: vi.fn() },
    environments: [],
    selectedEnvId: 'env1',
    handleEnvSelect: vi.fn(),
    previewWorkflow: null,
    handleSelect: vi.fn(),
    handleSave: vi.fn(),
    handleQuickTest: vi.fn(),
    handleDebugQuickTest: vi.fn(),
    isDebugMode: false,
    setServiceRegistryMode: vi.fn(),
    setSelectedNodeId: vi.fn(),
    setShowDefaultsModal: vi.fn(),
    runProgress: null,
    handleResetRunStatus: vi.fn(),
    handleUpdateWorkflowSlaTargets: vi.fn(),
    inspectActions: {},
    navStack: [],
    handleBreadcrumbNavigate: vi.fn(),
    nodes: [],
    edges: [],
    lastRunStatus: null,
    lastRunTime: null,
    lastRunError: null,
    openRunErrorDetail: vi.fn(),
    runHistory: [],
    activeRunHistoryId: null,
    restoreRunFromHistory: vi.fn(),
    setActiveRunHistoryId: vi.fn(),
    deleteRunHistoryEntry: vi.fn(),
    clearRunHistory: vi.fn(),
    consoleLines: [],
    consoleOpen: false,
    handleToggleConsole: vi.fn(),
    ...over,
  } as unknown as WorkflowDesignerViewModel;
}

describe('WorkflowDesignerMainLayout', () => {
  it('returns null when no workflow selected', () => {
    const { container } = render(<WorkflowDesignerMainLayout {...makeVm({ selected: null })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders full layout with all sections', () => {
    render(<WorkflowDesignerMainLayout {...makeVm()} />);
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('sla')).toBeTruthy();
    expect(screen.getByTestId('body')).toBeTruthy();
    expect(screen.getByTestId('inspect')).toBeTruthy();
    expect(screen.getByTestId('overlays')).toBeTruthy();
    expect(screen.getByTestId('statusbar')).toBeTruthy();
    expect(screen.queryByTestId('breadcrumb')).toBeNull();
  });

  it('renders breadcrumb when navStack non-empty', () => {
    render(<WorkflowDesignerMainLayout {...makeVm({ navStack: [{ id: 'p1', name: 'Parent' }] as unknown as WorkflowDesignerViewModel['navStack'] })} />);
    expect(screen.getByTestId('breadcrumb')).toBeTruthy();
  });

  it('toolbar open-services toggles registry mode and clears selection', () => {
    const setServiceRegistryMode = vi.fn();
    const closeVersionPanel = vi.fn();
    const setSelectedNodeId = vi.fn();
    const setShowDefaultsModal = vi.fn();
    render(
      <WorkflowDesignerMainLayout
        {...makeVm({
          setServiceRegistryMode,
          setSelectedNodeId,
          setShowDefaultsModal,
          versioning: { versionCount: 0, closeVersionPanel, openVersionPanel: vi.fn() } as unknown as WorkflowDesignerViewModel['versioning'],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('tb-services'));
    expect(setServiceRegistryMode).toHaveBeenCalled();
    expect(closeVersionPanel).toHaveBeenCalled();
    expect(setSelectedNodeId).toHaveBeenCalledWith(null);
    const updater = setServiceRegistryMode.mock.calls[0][0];
    expect(updater('closed')).toBe('panel');
    expect(updater('panel')).toBe('closed');
    fireEvent.click(screen.getByTestId('tb-defaults'));
    expect(setShowDefaultsModal).toHaveBeenCalledWith(true);
  });

  it('renders harness button and calls onRunInHarness with selected id', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowDesignerMainLayout {...makeVm({ onRunInHarness })} />);
    fireEvent.click(screen.getByTestId('tb-harness'));
    expect(onRunInHarness).toHaveBeenCalledWith('w1');
  });

  it('saves SLA targets', () => {
    const handleUpdateWorkflowSlaTargets = vi.fn();
    render(<WorkflowDesignerMainLayout {...makeVm({ handleUpdateWorkflowSlaTargets })} />);
    fireEvent.click(screen.getByTestId('sla-save'));
    expect(handleUpdateWorkflowSlaTargets).toHaveBeenCalledWith([]);
  });

  it('status bar history handlers fire and clear active id when matching', () => {
    const restoreRunFromHistory = vi.fn();
    const setActiveRunHistoryId = vi.fn();
    const deleteRunHistoryEntry = vi.fn();
    const clearRunHistory = vi.fn();
    render(
      <WorkflowDesignerMainLayout
        {...makeVm({
          restoreRunFromHistory,
          setActiveRunHistoryId,
          deleteRunHistoryEntry,
          clearRunHistory,
          activeRunHistoryId: 'r1',
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('sb-restore'));
    expect(restoreRunFromHistory).toHaveBeenCalledWith('r1');
    expect(setActiveRunHistoryId).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByTestId('sb-delete'));
    expect(deleteRunHistoryEntry).toHaveBeenCalledWith('r1');
    expect(setActiveRunHistoryId).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByTestId('sb-clear'));
    expect(clearRunHistory).toHaveBeenCalled();
  });
});
