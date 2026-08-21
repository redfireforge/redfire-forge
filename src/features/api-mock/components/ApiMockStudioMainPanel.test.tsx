/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockStudioMainPanel } from './ApiMockStudioMainPanel';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

vi.mock('./ApiMockRouteExplorer', () => ({
  ApiMockRouteExplorer: ({ onSelect, onCreate, onDelete, onAnalyze, onCloseDrawer, onToggle }: {
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    onAnalyze: () => void;
    onCloseDrawer: () => void;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <div data-testid="mock-explorer">
      <button data-testid="mock-select" onClick={() => onSelect('r1')}>select</button>
      <button data-testid="mock-create" onClick={() => onCreate()}>create</button>
      <button data-testid="mock-delete" onClick={() => onDelete('r1')}>delete</button>
      <button data-testid="mock-delete-missing" onClick={() => onDelete('missing')}>delete-missing</button>
      <button data-testid="mock-analyze" onClick={onAnalyze}>analyze</button>
      <button data-testid="mock-close-drawer" onClick={onCloseDrawer}>close-drawer</button>
      <button data-testid="mock-toggle" onClick={() => onToggle('r1', false)}>toggle</button>
    </div>
  ),
}));
vi.mock('./ApiMockRouteEditor', () => ({
  ApiMockRouteEditor: ({ onSimulate, onReviewConflicts, onUpdate }: {
    onSimulate: () => void;
    onReviewConflicts: () => void;
    onUpdate: (patch: { name: string }) => void;
  }) => (
    <div data-testid="mock-editor">
      <button data-testid="mock-simulate" onClick={() => onSimulate()}>simulate</button>
      <button data-testid="mock-review" onClick={onReviewConflicts}>review</button>
      <button data-testid="mock-update" onClick={() => onUpdate({ name: 'x' })}>update</button>
    </div>
  ),
}));
vi.mock('./ApiMockLiveStrip', () => ({
  ApiMockLiveStrip: () => <div data-testid="mock-live-strip" />,
}));
vi.mock('./ApiMockDock', () => ({
  ApiMockDock: ({ onSelectRoute, onSimulateWitness, onVariablesChange, onServerPatch }: {
    onSelectRoute: (id: string) => void;
    onSimulateWitness: () => void;
    onVariablesChange: (vars: unknown[]) => void;
    onServerPatch: (patch: { name: string }) => void;
  }) => (
    <div data-testid="mock-dock">
      <button data-testid="mock-dock-select" onClick={() => onSelectRoute('r1')}>select</button>
      <button data-testid="mock-dock-sim" onClick={onSimulateWitness}>sim</button>
      <button data-testid="mock-dock-vars" onClick={() => onVariablesChange([])}>vars</button>
      <button data-testid="mock-dock-patch" onClick={() => onServerPatch({ name: 'n' })}>patch</button>
    </div>
  ),
}));
vi.mock('./ApiMockConflictInspector', () => ({
  ApiMockConflictInspector: ({ onSelectRoute, onOpenStudio, onApply }: {
    onSelectRoute: (id: string) => void;
    onOpenStudio: () => void;
    onApply: () => void;
  }) => (
    <div data-testid="mock-conflicts">
      <button data-testid="mock-cf-select" onClick={() => onSelectRoute('r1')}>select</button>
      <button data-testid="mock-cf-studio" onClick={onOpenStudio}>studio</button>
      <button data-testid="mock-cf-apply" onClick={onApply}>apply</button>
    </div>
  ),
  conflictPeerLabel: () => 'peer',
}));

const ts = '2026-08-13T00:00:00.000Z';

function server(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  const route = {
    id: 'r1', name: 'Users', enabled: true, method: 'GET' as const,
    path: { kind: 'exact' as const, value: '/users' }, priority: 10,
    predicates: { id: 'pg', combinator: 'all' as const, children: [] },
    responseMode: 'rules' as const,
    responses: [{
      id: 'resp-1', name: '200', enabled: true, isDefault: true, status: 200,
      headers: [], cookies: [], body: { kind: 'none' as const, content: '' },
      behavior: { delayMs: 0, jitterMs: 0 },
    }],
    tags: [], createdAt: ts, updatedAt: ts,
  };
  return {
    id: 'srv-1', name: 'Demo', enabled: true, host: '127.0.0.1', port: 4600, basePath: '/api',
    folders: [], routes: [route], samples: [], variables: [],
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
    ...overrides,
  };
}

function noopHandlers() {
  return {
    setSelectedRouteId: vi.fn(),
    setMainView: vi.fn(),
    setRoutesDrawerOpen: vi.fn(),
    onRuntimeTabConsumed: vi.fn(),
    onCreateRoute: vi.fn(),
    onConfirmDeleteRoute: vi.fn(),
    onUpdateRoute: vi.fn(),
    onAddFolder: vi.fn(),
    onToggleFolder: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onMoveRoute: vi.fn(),
    onAnalyzeConflicts: vi.fn(),
    onSetSimulateOpen: vi.fn(),
    onOpenConflictInspector: vi.fn(),
    onOpenRuntime: vi.fn(),
    onResetState: vi.fn(),
    onClearTransactions: vi.fn(),
    onClearConsole: vi.fn(),
    onAcknowledgeConflict: vi.fn(),
    onAdjustPriority: vi.fn(),
    onOpenInRequests: vi.fn(),
    onCreateRouteFromTransaction: vi.fn(),
    onCopyTransaction: vi.fn(),
    onSimulateWitness: vi.fn(),
    onApplyActiveServer: vi.fn(),
    onUpdateServer: vi.fn(),
  };
}

describe('ApiMockStudioMainPanel', () => {
  it('covers studio empty/selected states, runtime, and conflicts', () => {
    const handlers = noopHandlers();
    const active = server();
    const { rerender } = render(
      <ApiMockStudioMainPanel
        activeServer={{ ...active, routes: [] }}
        mainView="studio"
        routesDrawerOpen
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-routes-backdrop'));
    expect(handlers.setRoutesDrawerOpen).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByTestId('api-mock-no-route-create'));
    expect(handlers.onCreateRoute).toHaveBeenCalled();
    expect(screen.getByTestId('api-mock-no-route').textContent).toMatch(/returns 404/);

    rerender(
      <ApiMockStudioMainPanel
        activeServer={{ ...active, routes: [] }}
        mainView="studio"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId('api-mock-no-route').textContent).toMatch(/Listening — no rules yet/);
    expect(screen.getByTestId('api-mock-no-route').textContent).toMatch(/GET, POST/);

    rerender(
      <ApiMockStudioMainPanel
        activeServer={active}
        selectedRoute={active.routes[0]}
        selectedRouteId="r1"
        selectedFolderName="Core"
        mainView="studio"
        routesDrawerOpen={false}
        transactions={[{ id: 'tx-1', matchedRouteId: 'r1' } as never]}
        conflictFindings={[]}
        conflictIds={['r1']}
        runtimeRunning
        dirty
        scenarioState={{ sequencePositions: { r1: 2 } } as never}
        consoleLines={[]}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-select'));
    fireEvent.click(screen.getByTestId('mock-delete'));
    fireEvent.click(screen.getByTestId('mock-delete-missing'));
    fireEvent.click(screen.getByTestId('mock-analyze'));
    fireEvent.click(screen.getByTestId('mock-close-drawer'));
    fireEvent.click(screen.getByTestId('mock-toggle'));
    fireEvent.click(screen.getByTestId('mock-simulate'));
    fireEvent.click(screen.getByTestId('mock-review'));
    fireEvent.click(screen.getByTestId('mock-update'));
    expect(handlers.onConfirmDeleteRoute).toHaveBeenCalled();
    expect(handlers.setMainView).toHaveBeenCalledWith('conflicts');

    rerender(
      <ApiMockStudioMainPanel
        activeServer={active}
        mainView="studio"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId('api-mock-no-route').textContent).toMatch(/Pick a rule/);

    rerender(
      <ApiMockStudioMainPanel
        activeServer={active}
        mainView="runtime"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[]}
        conflictIds={['r1']}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-dock-select'));
    fireEvent.click(screen.getByTestId('mock-dock-sim'));
    fireEvent.click(screen.getByTestId('mock-dock-vars'));
    fireEvent.click(screen.getByTestId('mock-dock-patch'));
    expect(handlers.setMainView).toHaveBeenCalledWith('studio');

    rerender(
      <ApiMockStudioMainPanel
        activeServer={active}
        mainView="conflicts"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[{ id: 'f1' } as never]}
        conflictIds={[]}
        conflictStats={{ analyzedRules: 2, durationMs: 4 }}
        runtimeRunning={false}
        dirty
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId('api-mock-conflicts-page').textContent).toMatch(/1 finding/);
    fireEvent.click(screen.getByTestId('api-mock-conflicts-analyze'));
    fireEvent.click(screen.getByTestId('mock-cf-select'));
    fireEvent.click(screen.getByTestId('mock-cf-studio'));
    fireEvent.click(screen.getByTestId('mock-cf-apply'));
    expect(handlers.onApplyActiveServer).toHaveBeenCalled();

    rerender(
      <ApiMockStudioMainPanel
        activeServer={active}
        mainView="conflicts"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    expect(screen.getByTestId('api-mock-conflicts-page').textContent).toMatch(/0 findings/);
  });

  it('exposes a keyboard-resizable rules-panel splitter in Studio', () => {
    render(
      <ApiMockStudioMainPanel
        activeServer={server()}
        mainView="studio"
        routesDrawerOpen={false}
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...noopHandlers()}
      />,
    );
    const splitter = screen.getByTestId('api-mock-explorer-splitter');
    expect(splitter.getAttribute('role')).toBe('separator');
    expect(splitter.getAttribute('aria-orientation')).toBe('vertical');
    const workspace = splitter.parentElement as HTMLElement;
    Object.defineProperty(workspace, 'clientWidth', { configurable: true, value: 1200 });
    fireEvent.mouseDown(splitter, { clientX: 262 });
    fireEvent.mouseMove(window, { clientX: 320 });
    fireEvent.mouseUp(window);
    fireEvent.keyDown(splitter, { key: 'ArrowRight' });
    expect(Number(splitter.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(262);
  });

  it('closes the routes drawer on Escape when no dialog is open', () => {
    const handlers = noopHandlers();
    render(
      <ApiMockStudioMainPanel
        activeServer={server()}
        mainView="studio"
        routesDrawerOpen
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handlers.setRoutesDrawerOpen).toHaveBeenCalledWith(false);
  });

  it('ignores non-Escape keys and prevented Escape for the routes drawer', () => {
    const handlers = noopHandlers();
    render(
      <ApiMockStudioMainPanel
        activeServer={server()}
        mainView="studio"
        routesDrawerOpen
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    fireEvent.keyDown(window, { key: 'Tab' });
    const prevented = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    prevented.preventDefault();
    window.dispatchEvent(prevented);
    expect(handlers.setRoutesDrawerOpen).not.toHaveBeenCalled();
  });

  it('does not close the routes drawer on Escape while a dialog has focus', () => {
    const handlers = noopHandlers();
    render(
      <ApiMockStudioMainPanel
        activeServer={server()}
        mainView="studio"
        routesDrawerOpen
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.tabIndex = 0;
    document.body.appendChild(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(handlers.setRoutesDrawerOpen).not.toHaveBeenCalled();
    dialog.remove();
  });

  it('does not close the routes drawer on Escape when a filter popover is open', () => {
    const handlers = noopHandlers();
    render(
      <ApiMockStudioMainPanel
        activeServer={server()}
        mainView="studio"
        routesDrawerOpen
        transactions={[]}
        conflictFindings={[]}
        conflictIds={[]}
        runtimeRunning={false}
        dirty={false}
        scenarioState={null}
        consoleLines={[]}
        {...handlers}
      />,
    );
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'api-mock-route-filter-panel');
    document.body.appendChild(panel);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handlers.setRoutesDrawerOpen).not.toHaveBeenCalled();
    panel.remove();
  });
});
