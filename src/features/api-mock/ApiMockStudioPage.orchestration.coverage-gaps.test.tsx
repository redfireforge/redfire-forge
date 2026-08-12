/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id = 'srv-1', method = 'GET') {
  return {
    id,
    name: `Mock Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-1',
      name: 'Users route',
      enabled: true,
      method,
      path: { kind: 'exact', value: '/users' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{ id: 'resp-1', name: '200 Default', enabled: true, isDefault: true, status: 200, headers: [], cookies: [], body: { kind: 'none', content: '' }, behavior: { delayMs: 0, jitterMs: 0 } }],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    samples: [],
    variables: [],
    settings: {
      selection: { multipleMatchPolicy: 'highest_priority', equalPriorityPolicy: 'reject', ambiguityResponse: { status: 409, headers: [], body: '{}', contentType: 'application/json' } },
      fallback: { unmatchedResponse: { status: 404, headers: [], body: '{}', contentType: 'application/json' }, mode: 'default_response' },
      cors: { enabled: false, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['Content-Type'], allowCredentials: false, maxAge: 0, exposeHeaders: [] },
      limits: { maxInboundBodyBytes: 1024, maxResponseBodyBytes: 1024, maxConcurrentConnections: 10, maxDelayMs: 0, longRunningEnabled: false, longRunningMaxMs: 0, gracefulDrainMs: 0 },
      journal: { enabled: true, maxEntries: 10, maxCapturedBodyBytes: 1024, persistToDisk: false },
      redaction: { headerNames: [], jsonPaths: [], preserveScheme: true },
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

const loadApiMockWorkspace = vi.fn();
const saveApiMockWorkspace = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const restart = vi.fn();
const commit = vi.fn();
const transactions = vi.fn();
const clearTransactions = vi.fn();
const state = vi.fn();
const resetState = vi.fn();
const analyzeConflicts = vi.fn();
const clearConsole = vi.fn();

vi.mock('./apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveApiMockWorkspace(...args),
}));
vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    start: (...args: unknown[]) => start(...args),
    stop: (...args: unknown[]) => stop(...args),
    restart: (...args: unknown[]) => restart(...args),
    commit: (...args: unknown[]) => commit(...args),
    transactions: (...args: unknown[]) => transactions(...args),
    clearTransactions: (...args: unknown[]) => clearTransactions(...args),
    state: (...args: unknown[]) => state(...args),
    resetState: (...args: unknown[]) => resetState(...args),
  },
}));
vi.mock('./useApiMockConsole', () => ({
  useApiMockConsole: () => ({ lines: [{ ts, level: 'info', message: 'Started' }], clear: clearConsole }),
}));
vi.mock('../../shared/api-mock/conflictAnalyzer', () => ({
  analyzeConflicts: (...args: unknown[]) => analyzeConflicts(...args),
}));
vi.mock('../../app/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: (_message: string, onConfirm: () => void) => onConfirm(),
    confirmDialogElement: <div data-testid="mock-confirm" />,
  }),
}));
vi.mock('./components/ApiMockServerTabs', () => ({
  API_MOCK_WORKSPACE_PANEL_ID: 'api-mock-workspace-panel',
}));
vi.mock('./components/ApiMockStudioTitleBar', () => ({
  ApiMockStudioTitleBar: ({ servers, onCreate, onClose, onSelect, statusById, dirtyById, onImportCurl, onExport }: any) => (
    <div data-testid="mock-titlebar">
      <div data-testid="mock-server-tabs">
        <button data-testid="mock-create-server" onClick={onCreate}>create-server</button>
        {servers.map((s: any) => (
          <button key={s.id} data-testid={`mock-select-${s.id}`} onClick={() => onSelect(s.id)}>
            {s.id}:{statusById?.[s.id] ?? 'stopped'}:{dirtyById?.[s.id] ? 'dirty' : 'clean'}
          </button>
        ))}
        {servers[0] && <button data-testid="mock-close-server" onClick={() => onClose(servers[0].id)}>close-server</button>}
        <button data-testid="mock-close-missing-server" onClick={() => onClose('missing-server')}>close-missing-server</button>
      </div>
      <button data-testid="mock-import-open" onClick={onImportCurl}>import</button>
      <button data-testid="api-mock-export" onClick={onExport}>export</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockServerBar', () => ({
  ApiMockServerBar: ({ status, dirty, generation, error, onUpdate, onStart, onStop, onApply, onRestart, onSettings }: any) => (
    <div data-testid="mock-server-bar">
      <div data-testid="mock-server-status">{status}:{dirty ? 'dirty' : 'clean'}:{generation}:{error ?? ''}</div>
      <button data-testid="mock-server-update" onClick={() => onUpdate({ name: 'Updated server' })}>update-server</button>
      <button data-testid="mock-start" onClick={onStart}>start</button>
      <button data-testid="mock-stop" onClick={onStop}>stop</button>
      <button data-testid="mock-apply" onClick={onApply}>apply</button>
      <button data-testid="mock-restart" onClick={onRestart}>restart</button>
      <button data-testid="mock-settings" onClick={onSettings}>settings</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockRouteExplorer', () => ({
  ApiMockRouteExplorer: ({ routes, folders, selectedRouteId, onSelect, onCreate, onDelete, onToggle, onAnalyze, onAddFolder, onToggleFolder, conflictRouteIds }: any) => (
    <div data-testid="mock-route-explorer">
      <button data-testid="mock-create-route" onClick={onCreate}>create-route</button>
      <button data-testid="mock-analyze" onClick={onAnalyze}>analyze</button>
      <button data-testid="mock-add-folder" onClick={onAddFolder}>add-folder</button>
      {folders?.[0] && <button data-testid="mock-toggle-folder" onClick={() => onToggleFolder(folders[0].id)}>toggle-folder</button>}
      {routes[0] && <>
        <button data-testid="mock-select-route" onClick={() => onSelect(routes[0].id)}>{selectedRouteId ?? 'none'}</button>
        <button data-testid="mock-delete-route" onClick={() => onDelete(routes[0].id)}>delete-route</button>
        <button data-testid="mock-toggle-route" onClick={() => onToggle(routes[0].id, !routes[0].enabled)}>toggle-route</button>
      </>}
      {routes[1] && <>
        <button data-testid="mock-select-route-2" onClick={() => onSelect(routes[1].id)}>select-route-2</button>
        <button data-testid="mock-delete-route-2" onClick={() => onDelete(routes[1].id)}>delete-route-2</button>
      </>}
      <div data-testid="mock-conflicts">{(conflictRouteIds ?? []).join(',')}</div>
    </div>
  ),
}));
vi.mock('./components/ApiMockRouteEditor', () => ({
  ApiMockRouteEditor: ({ route, hasConflict, folderName, onUpdate, onSimulate, onDelete, onReviewConflicts }: any) => (
    <div data-testid="mock-route-editor">
      <div data-testid="mock-route-editor-conflict">{hasConflict ? 'conflict' : 'clear'}</div>
      <div data-testid="mock-route-folder-name">{folderName ?? ''}</div>
      <button data-testid="mock-route-update" onClick={() => onUpdate({ name: `${route.name} updated` })}>update-route</button>
      <button data-testid="mock-route-simulate" onClick={onSimulate}>simulate-route</button>
      <button data-testid="mock-route-review-conflicts" onClick={onReviewConflicts}>review-conflicts</button>
      <button data-testid="mock-route-delete" onClick={onDelete}>delete-route</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockDock', () => ({
  ApiMockDock: ({ conflictCount, transactions, running, liveState, onResetState, onClearTransactions, consoleLines, onClearConsole, onRequestedTabConsumed, onSimulateWitness, onOpenConflicts }: any) => (
    <div data-testid="mock-dock">
      <div data-testid="mock-dock-meta">{conflictCount}:{transactions.length}:{running ? 'running' : 'stopped'}:{Object.keys(liveState ?? {}).length}:{consoleLines.length}</div>
      <button data-testid="mock-reset-state" onClick={onResetState}>reset-state</button>
      <button data-testid="mock-clear-transactions" onClick={onClearTransactions}>clear-transactions</button>
      <button data-testid="mock-clear-console" onClick={onClearConsole}>clear-console</button>
      <button data-testid="mock-dock-consumed" onClick={onRequestedTabConsumed}>consume-requested-tab</button>
      <button data-testid="mock-dock-simulate" onClick={onSimulateWitness}>simulate-witness</button>
      <button data-testid="mock-dock-open-conflicts" onClick={onOpenConflicts}>open-conflicts</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockServerSettingsModal', () => ({
  ApiMockServerSettingsModal: ({ statusLabel, onSave, onClose }: any) => (
    <div data-testid="mock-settings-modal">
      <div data-testid="mock-settings-status">{statusLabel}</div>
      <button data-testid="mock-settings-save" onClick={() => onSave({ name: 'Saved server' })}>save-settings</button>
      <button data-testid="mock-settings-close" onClick={onClose}>close-settings</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockSimulateModal', () => ({
  ApiMockSimulateModal: ({ initialPath, initialMethod, onClose }: any) => (
    <div data-testid="mock-simulate-modal">{initialMethod}:{initialPath}<button data-testid="mock-simulate-close" onClick={onClose}>close-simulate</button></div>
  ),
}));
vi.mock('./components/ApiMockImportReview', () => ({
  ApiMockImportReview: ({ onImport, onCancel }: any) => (
    <div data-testid="mock-import-review">
      <button data-testid="mock-import-zero" onClick={() => onImport([])}>import-zero</button>
      <button data-testid="mock-import-one" onClick={() => onImport([{ ...makeServer('tmp').routes[0], id: 'route-2', name: 'Imported route' }])}>import-one</button>
      <button data-testid="mock-import-cancel" onClick={onCancel}>cancel-import</button>
    </div>
  ),
}));
vi.mock('../../shared/components/AppModalFrame', () => ({
  default: ({ children, onClose, title }: any) => <div data-testid="mock-modal-frame">{title}<button data-testid="mock-modal-close" onClick={onClose}>x</button>{children}</div>,
}));

describe('ApiMockStudioPage orchestration coverage', () => {
  beforeEach(() => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [makeServer()], activeServerId: 'srv-1' });
    saveApiMockWorkspace.mockResolvedValue(undefined);
    start.mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } });
    stop.mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'stopped', generation: 1 } });
    restart.mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2 } });
    commit.mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2 } });
    transactions.mockResolvedValue({ ok: true, data: { transactions: [{ id: 'tx-1' }], cursor: 0, total: 1, capped: false } });
    clearTransactions.mockResolvedValue({ ok: true, data: { cleared: true } });
    state.mockResolvedValue({ ok: true, data: { states: {}, counters: {} } });
    resetState.mockResolvedValue({ ok: true, data: { reset: true } });
    analyzeConflicts.mockResolvedValue({ findings: [{ ruleIds: ['route-1', 'route-1'] }] });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('covers create/select/update/import/settings/simulate/delete and close-server flows', async () => {
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-route-update'));
    fireEvent.click(screen.getByTestId('mock-route-simulate'));
    expect(screen.getByTestId('mock-simulate-modal')).toHaveTextContent('GET:/users');
    fireEvent.click(screen.getByTestId('mock-simulate-close'));

    fireEvent.click(screen.getByTestId('mock-add-folder'));
    fireEvent.click(screen.getByTestId('mock-toggle-folder'));

    fireEvent.click(screen.getByTestId('mock-server-update'));
    fireEvent.click(screen.getByTestId('mock-settings'));
    expect(screen.getByTestId('mock-settings-status')).toHaveTextContent('Stopped');
    fireEvent.click(screen.getByTestId('mock-settings-save'));

    fireEvent.click(screen.getByTestId('mock-import-open'));
    fireEvent.click(screen.getByTestId('mock-import-zero'));
    fireEvent.click(screen.getByTestId('mock-import-one'));
    expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/Imported 1 route/i);

    fireEvent.click(screen.getByTestId('mock-route-delete'));
    expect(screen.getByTestId('api-mock-no-route')).toBeTruthy();

    fireEvent.click(screen.getByTestId('mock-close-server'));
    await waitFor(() => expect(stop).toHaveBeenCalledWith('srv-1'));
    await waitFor(() => expect(screen.getByTestId('api-mock-empty')).toBeTruthy());

    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/created on port 4600/i);
  });

  it('covers runtime success and failure branches, polling, dirty status, and dock actions', async () => {
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(start).toHaveBeenCalled());
    await waitFor(() => expect(transactions).toHaveBeenCalledWith('srv-1'));
    expect(screen.getByTestId('mock-server-tabs').textContent).toContain('running');
    expect(screen.getByTestId('mock-dock-meta').textContent).toContain('0:1:running:2:1');

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-toggle-route'));
    fireEvent.click(screen.getByTestId('mock-route-update'));
    expect(screen.getByTestId('mock-server-tabs').textContent).toContain('dirty');

    fireEvent.click(screen.getByTestId('mock-apply'));
    await waitFor(() => expect(commit).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('mock-restart'));
    await waitFor(() => expect(restart).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('mock-analyze'));
    await waitFor(() => expect(analyzeConflicts).toHaveBeenCalled());
    expect(screen.getByTestId('mock-conflicts').textContent).toContain('route-1');

    fireEvent.click(screen.getByTestId('mock-clear-transactions'));
    await waitFor(() => expect(clearTransactions).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('mock-reset-state'));
    await waitFor(() => expect(resetState).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('mock-clear-console'));
    expect(clearConsole).toHaveBeenCalled();

    stop.mockResolvedValueOnce({ ok: false, error: { title: 'Runtime error', message: 'bad stop', code: 'MOCK_RUNTIME_ERROR', recoverable: true, retry: true } });
    fireEvent.click(screen.getByTestId('mock-stop'));
    await waitFor(() => expect(screen.getByTestId('mock-server-status')).toHaveTextContent('Runtime error: bad stop'));

    start.mockResolvedValueOnce({ ok: false, error: { title: 'Companion unavailable', message: 'down', code: 'COMPANION_UNAVAILABLE', recoverable: true, retry: true } });
    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/Companion unavailable/i));

    commit.mockResolvedValueOnce({ ok: false, error: { title: 'Invalid definition', message: 'bad draft', code: 'MOCK_VALIDATION_ERROR', recoverable: true, retry: false } });
    fireEvent.click(screen.getByTestId('mock-apply'));
    await waitFor(() => expect(screen.getByTestId('mock-server-status')).toHaveTextContent('Invalid definition: bad draft'));

    restart.mockResolvedValueOnce({ ok: false, error: { title: 'Port already in use', message: 'in use', code: 'MOCK_PORT_IN_USE', recoverable: true, retry: false } });
    fireEvent.click(screen.getByTestId('mock-restart'));
    await waitFor(() => expect(screen.getByTestId('mock-server-status')).toHaveTextContent('Port already in use: in use'));
  });

  it('covers load fallback and inactive-route/server early returns', async () => {
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [makeServer('srv-a'), makeServer('srv-b')], activeServerId: undefined });
    analyzeConflicts.mockResolvedValueOnce({ findings: [] });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    expect(screen.getByTestId('mock-server-tabs').textContent).toContain('srv-a');

    fireEvent.click(screen.getByTestId('mock-close-missing-server'));

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-route-delete'));
    expect(screen.getByTestId('api-mock-no-route')).toBeTruthy();
  });

  it('covers simulate ANY fallback, settings close, import modal close, and false poll branches', async () => {
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [makeServer('srv-1', 'ANY')], activeServerId: undefined });
    transactions.mockResolvedValueOnce({ ok: false, error: { title: 'x', message: 'x', code: 'MOCK_RUNTIME_ERROR', recoverable: true, retry: true } });
    state.mockResolvedValueOnce({ ok: false, error: { title: 'x', message: 'x', code: 'MOCK_RUNTIME_ERROR', recoverable: true, retry: true } });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(start).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('mock-settings'));
    expect(screen.getByTestId('mock-settings-status')).toHaveTextContent('Running');
    fireEvent.click(screen.getByTestId('mock-settings-close'));

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-route-simulate'));
    expect(screen.getByTestId('mock-simulate-modal')).toHaveTextContent('GET:/users');
    fireEvent.click(screen.getByTestId('mock-simulate-close'));

    fireEvent.click(screen.getByTestId('mock-settings'));
    fireEvent.click(screen.getByTestId('mock-settings-close'));

    fireEvent.click(screen.getByTestId('mock-import-open'));
    fireEvent.click(screen.getByTestId('mock-modal-close'));

    fireEvent.click(screen.getByTestId('mock-dock-simulate'));
    expect(screen.getByTestId('mock-simulate-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mock-simulate-close'));
    fireEvent.click(screen.getByTestId('mock-dock-consumed'));
    fireEvent.click(screen.getByTestId('mock-dock-open-conflicts'));
  });

  it('covers hydration/poll cancellation on unmount', async () => {
    let resolveLoad!: (v: unknown) => void;
    loadApiMockWorkspace.mockImplementationOnce(() => new Promise(r => { resolveLoad = r; }));
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    const { unmount } = render(<ApiMockStudioPage />);
    unmount();
    resolveLoad({ servers: [makeServer()], activeServerId: 'srv-1' });
    await Promise.resolve();

    let resolveTx!: (v: unknown) => void;
    let resolveState!: (v: unknown) => void;
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [makeServer()], activeServerId: 'srv-1' });
    start.mockResolvedValueOnce({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } });
    transactions.mockImplementationOnce(() => new Promise(r => { resolveTx = r; }));
    state.mockImplementationOnce(() => new Promise(r => { resolveState = r; }));

    const rendered = render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(start).toHaveBeenCalled());
    rendered.unmount();
    resolveTx({ ok: true, data: { transactions: [], cursor: 0, total: 0, capped: false } });
    resolveState({ ok: true, data: { states: {}, counters: {} } });
    await Promise.resolve();
  });

  it('covers empty persisted load without hydrating servers', async () => {
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [], activeServerId: undefined });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-empty')).toBeTruthy());
  });

  it('reclaims an orphan companion listener when Start hits MOCK_PORT_OWNED', async () => {
    start
      .mockResolvedValueOnce({
        ok: false,
        error: {
          title: 'Port owned by another server',
          message: 'Port 4600 is owned by server "srv-orphan"',
          code: 'MOCK_PORT_OWNED',
          recoverable: true,
          retry: false,
        },
      })
      .mockResolvedValueOnce({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(stop).toHaveBeenCalledWith('srv-orphan'));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/Server started on port 4600/i));
  });

  it('reuses the lowest free port after a tab is closed', async () => {
    const a = { ...makeServer('srv-a'), port: 4600 };
    const b = { ...makeServer('srv-b'), port: 4601 };
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [a, b], activeServerId: 'srv-a' });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    fireEvent.click(screen.getByTestId('mock-close-server')); // closes srv-a (first)
    await waitFor(() => expect(stop).toHaveBeenCalledWith('srv-a'));
    fireEvent.click(screen.getByTestId('mock-create-server'));
    await waitFor(() => expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/created on port 4600/i));
  });

  it('covers closing a non-active server tab', async () => {
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [makeServer('srv-a'), makeServer('srv-b')], activeServerId: 'srv-b' });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());
    expect(screen.getByTestId('mock-server-tabs').textContent).toContain('srv-b');
    fireEvent.click(screen.getByTestId('mock-close-server'));
    await waitFor(() => expect(stop).toHaveBeenCalledWith('srv-a'));
    await waitFor(() => {
      const tabs = screen.getByTestId('mock-server-tabs').textContent ?? '';
      expect(tabs).toContain('srv-b');
      expect(tabs).not.toContain('srv-a');
    });
  });

  it('covers plural conflict copy and simulate path fallback for an empty route path', async () => {
    loadApiMockWorkspace.mockResolvedValueOnce({
      servers: [{ ...makeServer('srv-p', 'ANY'), routes: [{ ...makeServer('srv-p', 'ANY').routes[0], path: { kind: 'exact', value: '' } }] }],
      activeServerId: 'srv-p',
    });
    analyzeConflicts.mockResolvedValueOnce({ findings: [{ ruleIds: ['route-1', 'route-2'] }, { ruleIds: ['route-2', 'route-3'] }] });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-route-simulate'));
    expect(screen.getByTestId('mock-simulate-modal')).toHaveTextContent('GET:/');

    fireEvent.click(screen.getByTestId('mock-analyze'));
    await waitFor(() => expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/2 potential conflicts found/i));
  });

  it('covers create-route numbering and deleting a non-selected route', async () => {
    const server = makeServer('srv-many');
    server.routes = [
      server.routes[0],
      { ...server.routes[0], id: 'route-2', name: 'Orders route', path: { kind: 'exact', value: '/orders' } },
    ];
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [server], activeServerId: 'srv-many' });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-select-route-2'));
    fireEvent.click(screen.getByTestId('mock-create-route'));
    expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/New Route 3 added/i);

    fireEvent.click(screen.getByTestId('mock-delete-route'));
    expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/Route deleted/i);
  });

  it('covers folder-name rendering, running close-confirm, status error label, and port-owned no-retry branches', async () => {
    const server = makeServer('srv-folder');
    server.folders = [{ id: 'fld-1', name: 'Core', expanded: true, sortOrder: 0 } as any];
    server.routes[0].folderId = 'fld-1';
    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [server], activeServerId: 'srv-folder' });
    start.mockResolvedValueOnce({ ok: true, data: { serverId: 'srv-folder', port: 4600, state: 'running', generation: 1 } });
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-select-route'));
    expect(screen.getByTestId('mock-route-folder-name')).toHaveTextContent('Core');

    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('mock-close-server'));
    await waitFor(() => expect(stop).toHaveBeenCalledWith('srv-folder'));

    loadApiMockWorkspace.mockResolvedValueOnce({ servers: [makeServer('srv-owned')], activeServerId: 'srv-owned' });
    start.mockResolvedValueOnce({
      ok: false,
      error: {
        title: 'Port owned by another server',
        message: 'Port 4600 is owned by server "srv-owned"',
        code: 'MOCK_PORT_OWNED',
        recoverable: true,
        retry: false,
      },
    });
    const rerendered = render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getAllByTestId('api-mock-studio').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTestId('mock-start').at(-1)!);
    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(stop).not.toHaveBeenCalledWith('srv-owned');

    restart.mockResolvedValueOnce({ ok: false, error: { title: 'Port already in use', message: 'in use', code: 'MOCK_PORT_IN_USE', recoverable: true, retry: false } });
    fireEvent.click(screen.getAllByTestId('mock-restart').at(-1)!);
    await waitFor(() => expect(screen.getAllByTestId('mock-server-status').at(-1)).toHaveTextContent('Port already in use: in use'));
    fireEvent.click(screen.getAllByTestId('mock-settings').at(-1)!);
    expect(screen.getAllByTestId('mock-settings-status').at(-1)).toHaveTextContent('Error');
    rerendered.unmount();
  });

  it('covers export callback and open-conflicts branch when findings already exist', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:api-mock-export');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const originalCreateElement = Document.prototype.createElement;
    const anchorClick = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement.call(document, 'a', options) as HTMLAnchorElement;
        anchor.click = anchorClick;
        return anchor;
      }
      return originalCreateElement.call(document, tagName, options);
    }) as typeof document.createElement);

    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);
    await waitFor(() => expect(screen.getByTestId('api-mock-studio')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-select-route'));
    fireEvent.click(screen.getByTestId('mock-route-review-conflicts'));
    await waitFor(() => expect(analyzeConflicts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/potential conflict/i));
    fireEvent.click(screen.getByTestId('mock-analyze'));
    await waitFor(() => expect(analyzeConflicts).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('mock-route-review-conflicts'));
    await waitFor(() => expect(analyzeConflicts).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('api-mock-export'));
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });
});
