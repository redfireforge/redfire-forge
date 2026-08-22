/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const h = vi.hoisted(() => {
  const call = (p: Record<string, unknown>, k: string, ...args: unknown[]) => {
    const f = p[k];
    if (typeof f === 'function') (f as (...a: unknown[]) => unknown)(...args);
  };
  return {
    call,
    serverBarProps: {} as Record<string, unknown>,
    navProps: {} as Record<string, unknown>,
  };
});

vi.mock('./ApiMockServerBar', () => ({
  ApiMockServerBar: (props: Record<string, unknown>) => {
    h.serverBarProps = props;
    return (
      <div data-testid="api-mock-server-bar">
        <button data-testid="api-mock-open-routes" onClick={() => h.call(h.serverBarProps, 'onOpenRoutes')} />
      </div>
    );
  },
}));

vi.mock('./ApiMockWorkspaceNav', () => ({
  ApiMockWorkspaceNav: (props: Record<string, unknown>) => {
    h.navProps = props;
    return (
      <div data-testid="api-mock-workspace-nav">
        <button data-testid="nav-view-conflicts" onClick={() => h.call(h.navProps, 'onChange', 'conflicts')} />
        <button data-testid="nav-view-studio" onClick={() => h.call(h.navProps, 'onChange', 'studio')} />
      </div>
    );
  },
}));

vi.mock('./ApiMockStudioMainPanel', () => ({
  ApiMockStudioMainPanel: () => <div data-testid="api-mock-main-panel" />,
}));

import { ApiMockStudioActiveSection } from './ApiMockStudioActiveSection';

function makeServer(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Test Server',
    enabled: true,
    host: '127.0.0.1',
    port: 8080,
    basePath: '/',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: {} as ApiMockServerDefinitionV1['settings'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeProps(overrides: Partial<Parameters<typeof ApiMockStudioActiveSection>[0]> = {}) {
  const base = {
    activeServer: makeServer(),
    mainView: 'studio' as const,
    setMainView: vi.fn(),
    transactions: [],
    conflictFindings: [],
    conflictIds: [],
    conflictStats: undefined,
    runtimeTabRequest: undefined,
    onRuntimeTabConsumed: vi.fn(),
    runtimeRunning: false,
    dirty: false,
    scenarioState: null,
    consoleLines: [],
    selectedRouteId: undefined,
    setSelectedRouteId: vi.fn(),
    selectedRoute: undefined,
    selectedFolderName: undefined,
    routesDrawerOpen: false,
    setRoutesDrawerOpen: vi.fn(),
    onImportOpen: vi.fn(),
    onExport: vi.fn(),
    onAnalyzeConflicts: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onApply: vi.fn(),
    onRestart: vi.fn(),
    onSettings: vi.fn(),
    onCreateRoute: vi.fn(),
    onConfirmDeleteRoute: vi.fn(),
    onUpdateRoute: vi.fn(),
    onAddFolder: vi.fn(),
    onToggleFolder: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onMoveRoute: vi.fn(),
    onSetSimulateOpen: vi.fn(),
    onSimulateSample: vi.fn(),
    onOpenConflictInspector: vi.fn(),
    onOpenRuntime: vi.fn(),
    onResetState: vi.fn(),
    onClearTransactions: vi.fn(),
    onClearConsole: vi.fn(),
    onAcknowledgeConflict: vi.fn(),
    onAdjustPriority: vi.fn(),
    onOpenInRequests: vi.fn(),
    onCreateRouteFromTransaction: vi.fn(),
    onSaveSampleFromTransaction: vi.fn(),
    onCopyTransaction: vi.fn(),
    onUpdateSample: vi.fn(),
    onDeleteSample: vi.fn(),
    onTrySampleInRequests: vi.fn(),
    onSimulateWitness: vi.fn(),
    onUpdateServer: vi.fn(),
    status: 'stopped' as const,
    generation: 1,
    error: undefined,
    ...overrides,
  };
  return base;
}

describe('ApiMockStudioActiveSection', () => {
  it('renders server bar, nav, and main panel', () => {
    render(<ApiMockStudioActiveSection {...makeProps()} />);
    expect(screen.getByTestId('api-mock-server-bar')).toBeTruthy();
    expect(screen.getByTestId('api-mock-workspace-nav')).toBeTruthy();
    expect(screen.getByTestId('api-mock-main-panel')).toBeTruthy();
  });

  it('open-routes button calls setMainView("studio") and setRoutesDrawerOpen(true)', () => {
    const props = makeProps();
    render(<ApiMockStudioActiveSection {...props} />);
    fireEvent.click(screen.getByTestId('api-mock-open-routes'));
    expect(props.setMainView).toHaveBeenCalledWith('studio');
    expect(props.setRoutesDrawerOpen).toHaveBeenCalledWith(true);
  });

  it('navigating to conflicts with no findings triggers onAnalyzeConflicts', () => {
    const props = makeProps({ conflictFindings: [] });
    render(<ApiMockStudioActiveSection {...props} />);
    fireEvent.click(screen.getByTestId('nav-view-conflicts'));
    expect(props.setMainView).toHaveBeenCalledWith('conflicts');
    expect(props.onAnalyzeConflicts).toHaveBeenCalled();
  });

  it('navigating to conflicts when findings exist does not re-trigger analysis', () => {
    const props = makeProps({ conflictFindings: [{ id: 'f1' } as Parameters<typeof ApiMockStudioActiveSection>[0]['conflictFindings'][0]] });
    render(<ApiMockStudioActiveSection {...props} />);
    fireEvent.click(screen.getByTestId('nav-view-conflicts'));
    expect(props.setMainView).toHaveBeenCalledWith('conflicts');
    expect(props.onAnalyzeConflicts).not.toHaveBeenCalled();
  });

  it('navigating to studio view does not trigger analysis', () => {
    const props = makeProps();
    render(<ApiMockStudioActiveSection {...props} />);
    fireEvent.click(screen.getByTestId('nav-view-studio'));
    expect(props.setMainView).toHaveBeenCalledWith('studio');
    expect(props.onAnalyzeConflicts).not.toHaveBeenCalled();
  });
});
