/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowDesignerGlobalOverlays } from './WorkflowDesignerGlobalOverlays';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';

vi.mock('./modals/WorkflowServiceRegistryModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="svc-reg"><button data-testid="svc-close" onClick={onClose}>x</button></div> : null,
}));
vi.mock('./WorkflowDebugBar', () => ({
  default: ({ onStop, onStepInto, pausedSubWorkflowNodeId }: {
    onStop: () => void;
    onStepInto: (id: string) => void;
    pausedSubWorkflowNodeId: string | null;
  }) => (
    <div data-testid="debug-bar" data-paused={pausedSubWorkflowNodeId ?? ''}>
      <button data-testid="dbg-stop" onClick={onStop}>stop</button>
      <button data-testid="dbg-step" onClick={() => onStepInto('sw1')}>step</button>
    </div>
  ),
}));
vi.mock('./panels/WorkflowConsolePanel', () => ({
  default: ({ onClear, onClose }: { onClear: () => void; onClose: () => void }) => (
    <div data-testid="console"><button data-testid="con-clear" onClick={onClear}>c</button><button data-testid="con-close" onClick={onClose}>x</button></div>
  ),
}));
vi.mock('./canvas/WorkflowShortcutsOverlay', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="shortcuts"><button data-testid="sc-close" onClick={onClose}>x</button></div> : null,
}));
vi.mock('./modals/WorkflowVersionDiff', () => ({
  default: ({ onClose }: { onClose: () => void }) => <div data-testid="ver-diff"><button data-testid="vd-close" onClick={onClose}>x</button></div>,
}));
vi.mock('./canvas/WorkflowCommandPalette', () => ({
  default: ({ open, onClose, actions }: {
    open: boolean;
    onClose: () => void;
    actions: Record<string, (arg?: unknown) => void>;
  }) =>
    open ? (
      <div data-testid="cmd-palette">
        <button data-testid="cmd-close" onClick={onClose}>x</button>
        {Object.entries(actions).map(([k, fn]) => (
          <button key={k} data-testid={`cmd-${k}`} onClick={() => fn()}>{k}</button>
        ))}
      </div>
    ) : null,
}));

function makeVm(over: Partial<WorkflowDesignerViewModel> = {}): WorkflowDesignerViewModel {
  return {
    serviceRegistryMode: 'closed',
    setServiceRegistryMode: vi.fn(),
    workflowServices: [],
    environments: [],
    microservices: [],
    globalAuthProfiles: [],
    selectedEnvId: 'env1',
    selected: { id: 'w1', name: 'WF' },
    handleServiceRegistryApply: vi.fn(),
    isDebugMode: false,
    debugControllerRef: { current: null },
    handleDebugStop: vi.fn(),
    runVariableSnapshot: null,
    workflowVariables: {},
    nodes: [],
    navigateToWorkflow: vi.fn(),
    consoleOpen: false,
    consoleLines: [],
    clearConsole: vi.fn(),
    handleCloseConsole: vi.fn(),
    latestStepSummaries: [],
    consoleRunBehavior: 'append',
    setConsoleRunBehavior: vi.fn(),
    showShortcuts: false,
    setShowShortcuts: vi.fn(),
    versioning: { versionDiffState: null, closeVersionDiff: vi.fn() },
    showCommandPalette: false,
    setShowCommandPalette: vi.fn(),
    handleSave: vi.fn(),
    handleQuickTest: vi.fn(),
    handleDebugQuickTest: vi.fn(),
    handleToggleConsole: vi.fn(),
    handleAutoLayout: vi.fn(),
    rfInstance: { fitView: vi.fn() },
    setShowMinimap: vi.fn(),
    handleAddNode: vi.fn(),
    setShowDefaultsModal: vi.fn(),
    setSelectedNodeId: vi.fn(),
    ...over,
  } as unknown as WorkflowDesignerViewModel;
}

describe('WorkflowDesignerGlobalOverlays', () => {
  it('renders only shortcuts overlay closed by default', () => {
    render(<WorkflowDesignerGlobalOverlays vm={makeVm()} />);
    expect(screen.queryByTestId('svc-reg')).toBeNull();
    expect(screen.queryByTestId('debug-bar')).toBeNull();
    expect(screen.queryByTestId('console')).toBeNull();
    expect(screen.queryByTestId('cmd-palette')).toBeNull();
  });

  it('renders service registry modal when fullscreen and closes', () => {
    const setServiceRegistryMode = vi.fn();
    render(<WorkflowDesignerGlobalOverlays vm={makeVm({ serviceRegistryMode: 'fullscreen', setServiceRegistryMode })} />);
    expect(screen.getByTestId('svc-reg')).toBeTruthy();
    fireEvent.click(screen.getByTestId('svc-close'));
    expect(setServiceRegistryMode).toHaveBeenCalledWith('closed');
  });

  it('renders debug bar with paused sub-workflow and steps into it', () => {
    const navigateToWorkflow = vi.fn();
    const handleDebugStop = vi.fn();
    const debugControllerRef = { current: { getPausedNodeIds: () => ['sw1'] } };
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          isDebugMode: true,
          debugControllerRef: debugControllerRef as unknown as WorkflowDesignerViewModel['debugControllerRef'],
          handleDebugStop,
          navigateToWorkflow,
          nodes: [{ id: 'sw1', type: 'subWorkflow', position: { x: 0, y: 0 }, data: { workflowId: 'wf2' } }] as unknown as WorkflowDesignerViewModel['nodes'],
        })}
      />,
    );
    expect(screen.getByTestId('debug-bar').getAttribute('data-paused')).toBe('sw1');
    fireEvent.click(screen.getByTestId('dbg-step'));
    expect(navigateToWorkflow).toHaveBeenCalledWith('wf2');
    fireEvent.click(screen.getByTestId('dbg-stop'));
    expect(handleDebugStop).toHaveBeenCalled();
  });

  it('renders console panel when consoleOpen', () => {
    const clearConsole = vi.fn();
    const handleCloseConsole = vi.fn();
    render(<WorkflowDesignerGlobalOverlays vm={makeVm({ consoleOpen: true, clearConsole, handleCloseConsole })} />);
    fireEvent.click(screen.getByTestId('con-clear'));
    fireEvent.click(screen.getByTestId('con-close'));
    expect(clearConsole).toHaveBeenCalled();
    expect(handleCloseConsole).toHaveBeenCalled();
  });

  it('renders shortcuts overlay when showShortcuts', () => {
    const setShowShortcuts = vi.fn();
    render(<WorkflowDesignerGlobalOverlays vm={makeVm({ showShortcuts: true, setShowShortcuts })} />);
    fireEvent.click(screen.getByTestId('sc-close'));
    expect(setShowShortcuts).toHaveBeenCalledWith(false);
  });

  it('renders version diff when versionDiffState set', () => {
    const closeVersionDiff = vi.fn();
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          versioning: { versionDiffState: { older: {}, newer: {} }, closeVersionDiff } as unknown as WorkflowDesignerViewModel['versioning'],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('vd-close'));
    expect(closeVersionDiff).toHaveBeenCalled();
  });

  it('renders command palette and invokes all actions', () => {
    const fns = {
      handleSave: vi.fn(),
      handleQuickTest: vi.fn(),
      handleDebugQuickTest: vi.fn(),
      handleToggleConsole: vi.fn(),
      handleAutoLayout: vi.fn(),
      setShowMinimap: vi.fn(),
      setServiceRegistryMode: vi.fn(),
      setSelectedNodeId: vi.fn(),
      setShowDefaultsModal: vi.fn(),
      handleAddNode: vi.fn(),
      setShowShortcuts: vi.fn(),
      setShowCommandPalette: vi.fn(),
    };
    const rfInstance = { fitView: vi.fn() };
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({ showCommandPalette: true, rfInstance: rfInstance as unknown as WorkflowDesignerViewModel['rfInstance'], ...fns })}
      />,
    );
    fireEvent.click(screen.getByTestId('cmd-onSave'));
    fireEvent.click(screen.getByTestId('cmd-onQuickTest'));
    fireEvent.click(screen.getByTestId('cmd-onDebugTest'));
    fireEvent.click(screen.getByTestId('cmd-onToggleConsole'));
    fireEvent.click(screen.getByTestId('cmd-onAutoLayout'));
    fireEvent.click(screen.getByTestId('cmd-onFitView'));
    fireEvent.click(screen.getByTestId('cmd-onToggleMinimap'));
    fireEvent.click(screen.getByTestId('cmd-onOpenServices'));
    fireEvent.click(screen.getByTestId('cmd-onOpenDefaults'));
    fireEvent.click(screen.getByTestId('cmd-onAddNode'));
    fireEvent.click(screen.getByTestId('cmd-onOpenShortcuts'));
    fireEvent.click(screen.getByTestId('cmd-close'));
    expect(fns.handleSave).toHaveBeenCalled();
    expect(rfInstance.fitView).toHaveBeenCalled();
    expect(fns.setShowMinimap).toHaveBeenCalled();
    expect(fns.setServiceRegistryMode).toHaveBeenCalled();
    expect(fns.setSelectedNodeId).toHaveBeenCalledWith(null);
    expect(fns.setShowDefaultsModal).toHaveBeenCalledWith(true);
    expect(fns.setShowShortcuts).toHaveBeenCalledWith(true);
    expect(fns.setShowCommandPalette).toHaveBeenCalledWith(false);
  });

  it('toggles service registry mode via command palette (closed -> panel)', () => {
    const setServiceRegistryMode = vi.fn();
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({ showCommandPalette: true, setServiceRegistryMode })}
      />,
    );
    fireEvent.click(screen.getByTestId('cmd-onOpenServices'));
    // exercise the updater function form
    const updater = setServiceRegistryMode.mock.calls[0][0];
    expect(updater('closed')).toBe('panel');
    expect(updater('panel')).toBe('closed');
  });

  it('toggles minimap via command palette updater', () => {
    const setShowMinimap = vi.fn();
    render(<WorkflowDesignerGlobalOverlays vm={makeVm({ showCommandPalette: true, setShowMinimap })} />);
    fireEvent.click(screen.getByTestId('cmd-onToggleMinimap'));
    const updater = setShowMinimap.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });

  it('does not render debug bar when debugControllerRef.current is null (line 67 guard false branch)', () => {
    // debugControllerRef.current = null — outer guard prevents render
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          isDebugMode: true,
          debugControllerRef: { current: null } as unknown as WorkflowDesignerViewModel['debugControllerRef'],
          handleDebugStop: vi.fn(),
          nodes: [],
        })}
      />,
    );
    // Debug bar should NOT be rendered when current is null
    expect(screen.queryByTestId('debug-bar')).toBeNull();
  });

  it('returns null for pausedSubWorkflowNodeId when no paused subWorkflow found (line 75 ??null branch)', () => {
    // Paused IDs contain only a non-subWorkflow node
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          isDebugMode: true,
          debugControllerRef: { current: { getPausedNodeIds: () => ['n1'] } } as unknown as WorkflowDesignerViewModel['debugControllerRef'],
          handleDebugStop: vi.fn(),
          nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: {} }] as unknown as WorkflowDesignerViewModel['nodes'],
        })}
      />,
    );
    // No subWorkflow node found — mock renders '' for null
    expect(screen.getByTestId('debug-bar').getAttribute('data-paused')).toBe('');
  });

  it('does not navigate when stepped-into node is not subWorkflow (line 79 false branch)', () => {
    const navigateToWorkflow = vi.fn();
    const debugControllerRef = { current: { getPausedNodeIds: () => ['n1'] } };
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          isDebugMode: true,
          debugControllerRef: debugControllerRef as unknown as WorkflowDesignerViewModel['debugControllerRef'],
          handleDebugStop: vi.fn(),
          navigateToWorkflow,
          nodes: [{ id: 'sw1', type: 'http', position: { x: 0, y: 0 }, data: {} }] as unknown as WorkflowDesignerViewModel['nodes'],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('dbg-step'));
    expect(navigateToWorkflow).not.toHaveBeenCalled();
  });

  it('does not navigate when subWorkflow node has no workflowId (line 81 false branch)', () => {
    const navigateToWorkflow = vi.fn();
    const debugControllerRef = { current: { getPausedNodeIds: () => ['sw1'] } };
    render(
      <WorkflowDesignerGlobalOverlays
        vm={makeVm({
          isDebugMode: true,
          debugControllerRef: debugControllerRef as unknown as WorkflowDesignerViewModel['debugControllerRef'],
          handleDebugStop: vi.fn(),
          navigateToWorkflow,
          nodes: [{ id: 'sw1', type: 'subWorkflow', position: { x: 0, y: 0 }, data: { workflowId: '' } }] as unknown as WorkflowDesignerViewModel['nodes'],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('dbg-step'));
    expect(navigateToWorkflow).not.toHaveBeenCalled();
  });
});
