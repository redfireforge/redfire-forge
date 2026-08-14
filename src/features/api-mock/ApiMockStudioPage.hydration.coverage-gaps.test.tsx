/**
 * @vitest-environment jsdom
 *
 * Hydration and runtime-reconciliation branches of `ApiMockStudioPage` (W21 / AMS-010).
 *
 * On mount the page never trusts disk for "running": desktop asks the native runtime
 * per server, web asks the companion for the whole pool, and an unreachable companion
 * leaves every server `unknown` with a notice. Children are stubbed down to the props
 * these paths actually feed, so the assertions read the reconciled result rather than
 * the studio chrome.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const ts = '2026-08-12T00:00:00.000Z';

const loadApiMockWorkspace = vi.fn();
const saveApiMockWorkspace = vi.fn();
const list = vi.fn();
const status = vi.fn();
const start = vi.fn();
const transactions = vi.fn();
const state = vi.fn();
const recordedDrafts = vi.fn();
const isTauri = vi.fn(() => false);

vi.mock('./apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveApiMockWorkspace(...args),
}));
vi.mock('../../shared/utils/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/utils/platform')>()),
  isTauri: () => isTauri(),
}));
vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    start: (...args: unknown[]) => start(...args),
    stop: vi.fn(),
    restart: vi.fn(),
    commit: vi.fn(),
    transactions: (...args: unknown[]) => transactions(...args),
    clearTransactions: vi.fn(),
    state: (...args: unknown[]) => state(...args),
    resetState: vi.fn(),
    recordedDrafts: (...args: unknown[]) => recordedDrafts(...args),
    ackRecordedDrafts: vi.fn(),
    list: (...args: unknown[]) => list(...args),
    status: (...args: unknown[]) => status(...args),
    nextAutoPort: vi.fn().mockResolvedValue({ ok: true, data: { port: 4699 } }),
  },
}));
vi.mock('./useApiMockConsole', () => ({
  useApiMockConsole: () => ({ lines: [], clear: vi.fn() }),
}));
vi.mock('../../app/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(), confirmDialogElement: null }),
}));
vi.mock('../../shared/api-mock/conflictAnalyzer', () => ({ analyzeConflicts: vi.fn() }));
vi.mock('./components/ApiMockStudioTitleBar', () => ({
  ApiMockStudioTitleBar: ({ statusById, dirtyById, onClose }: {
    statusById: Record<string, string>;
    dirtyById: Record<string, boolean>;
    onClose: (id: string) => void;
  }) => (
    <div data-testid="mock-titlebar">
      {Object.keys(statusById).map(id => (
        <span key={id} data-testid={`mock-tab-${id}`}>
          {statusById[id]}:{dirtyById[id] ? 'dirty' : 'clean'}
        </span>
      ))}
      <button data-testid="mock-close-srv-2" onClick={() => onClose('srv-2')}>close-srv-2</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockStudioActiveSection', () => ({
  ApiMockStudioActiveSection: ({ activeServer, status: runtimeStatus, generation, onStart, onSetSimulateOpen }: {
    activeServer: { id: string };
    status: string;
    generation: number;
    onStart: () => void;
    onSetSimulateOpen: (open: boolean) => void;
  }) => (
    <div data-testid="mock-active-section">
      <span data-testid="mock-runtime">{activeServer.id}:{runtimeStatus}:{generation}</span>
      <button data-testid="mock-start" onClick={onStart}>start</button>
      <button data-testid="mock-simulate-close" onClick={() => onSetSimulateOpen(false)}>close-simulate</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockStudioModals', () => ({
  ApiMockStudioModals: ({ onSaveSample }: {
    onSaveSample?: (sample: { id: string; name: string }) => void;
  }) => (
    <div data-testid="mock-modals">
      <button data-testid="mock-save-sample" onClick={() => onSaveSample?.({ id: 's-new', name: 'GET /users' })}>
        save-sample
      </button>
    </div>
  ),
}));

function makeServer(id: string, port: number) {
  return {
    id,
    name: `Mock Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [{
      id: `route-${id}`,
      name: 'Users route',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/users' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{ id: 'resp-1', name: '200', enabled: true, isDefault: true, status: 200, headers: [], cookies: [], body: { kind: 'none', content: '' }, behavior: { delayMs: 0, jitterMs: 0 } }],
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

/** A promise the test resolves by hand, to unmount while hydration is in flight. */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>(resolve => { settle = resolve; });
  return { promise, settle };
}

async function renderPage() {
  const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
  return render(<ApiMockStudioPage />);
}

describe('ApiMockStudioPage hydration reconciliation', () => {
  beforeEach(() => {
    isTauri.mockReturnValue(false);
    loadApiMockWorkspace.mockResolvedValue({
      servers: [makeServer('srv-1', 4600), makeServer('srv-2', 4601)],
      activeServerId: 'srv-1',
    });
    saveApiMockWorkspace.mockResolvedValue(undefined);
    list.mockResolvedValue({ ok: true, data: [] });
    status.mockResolvedValue({ ok: true, data: { state: 'stopped', generation: 0 } });
    transactions.mockResolvedValue({ ok: true, data: { transactions: [], cursor: 0, total: 0, capped: false } });
    state.mockResolvedValue({ ok: true, data: { states: {}, counters: {} } });
    recordedDrafts.mockResolvedValue({ ok: true, data: { drafts: [], total: 0 } });
    start.mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('asks the native runtime per server on desktop, and treats a failed probe as stopped', async () => {
    isTauri.mockReturnValue(true);
    status.mockImplementation(async (id: string) => (
      id === 'srv-1'
        ? { ok: true, data: { state: 'running', generation: 3 } }
        : { ok: false, error: { code: 'MOCK_RUNTIME_ERROR', message: 'no such server', retry: false } }
    ));

    await renderPage();

    await waitFor(() => expect(screen.getByTestId('mock-tab-srv-1')).toHaveTextContent('running:clean'));
    expect(screen.getByTestId('mock-tab-srv-2')).toHaveTextContent('stopped:clean');
    // The generation comes from the live probe, not from disk.
    expect(screen.getByTestId('mock-runtime')).toHaveTextContent('srv-1:running:3');
    expect(list).not.toHaveBeenCalled();
  });

  it('falls back to generation zero when a running probe reports none', async () => {
    isTauri.mockReturnValue(true);
    status.mockResolvedValue({ ok: true, data: { state: 'running' } });

    await renderPage();

    await waitFor(() => expect(screen.getByTestId('mock-tab-srv-1')).toHaveTextContent('running:clean'));
    expect(screen.getByTestId('mock-runtime')).toHaveTextContent('srv-1:running:0');
  });

  it('reconciles against the companion pool on web, adopting its generation', async () => {
    list.mockResolvedValue({
      ok: true,
      data: [{ serverId: 'srv-2', state: 'running', generation: 7 }],
    });

    await renderPage();

    await waitFor(() => expect(screen.getByTestId('mock-tab-srv-2')).toHaveTextContent('running:clean'));
    expect(screen.getByTestId('mock-tab-srv-1')).toHaveTextContent('stopped:clean');
    expect(status).not.toHaveBeenCalled();
  });

  it('leaves every server unknown and says so when the companion cannot be reached', async () => {
    list.mockResolvedValue({ ok: false, error: { code: 'COMPANION_UNAVAILABLE', message: 'fetch failed', retry: true } });

    await renderPage();

    await waitFor(() => expect(screen.getByTestId('api-mock-live-region'))
      .toHaveTextContent(/Companion unavailable/i));
    // `unknown` is neither running nor stopped, so no tab claims a runtime state.
    expect(screen.getByTestId('mock-tab-srv-1')).toHaveTextContent('stopped:clean');
    expect(screen.getByTestId('mock-runtime')).toHaveTextContent('srv-1:stopped:0');
  });

  it('drops the reconciled result when the page unmounts mid-probe', async () => {
    const pending = deferred<{ ok: true; data: [] }>();
    list.mockReturnValue(pending.promise);

    const { unmount } = await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-titlebar')).toBeTruthy());
    unmount();

    await act(async () => { pending.settle({ ok: true, data: [] }); });
    expect(screen.queryByTestId('mock-titlebar')).toBeNull();
  });

  it('drops the reconciled result when a desktop probe resolves after unmount', async () => {
    isTauri.mockReturnValue(true);
    const pending = deferred<{ ok: true; data: { state: 'running'; generation: number } }>();
    status.mockReturnValue(pending.promise);

    const { unmount } = await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-titlebar')).toBeTruthy());
    unmount();

    await act(async () => { pending.settle({ ok: true, data: { state: 'running', generation: 1 } }); });
    expect(screen.queryByTestId('mock-runtime')).toBeNull();
  });

  it('keeps polling the journal while the active server runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-start')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(transactions).toHaveBeenCalledWith('srv-1'));
    const firstPass = transactions.mock.calls.length;

    // The interval keeps the dock live without any further user action.
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(transactions.mock.calls.length).toBeGreaterThan(firstPass);
  });

  it('stops journal polling when the companion says the listener is gone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.mockResolvedValue({
      ok: false,
      error: {
        code: 'MOCK_RUNTIME_ERROR',
        title: 'Not running',
        message: 'Server "srv-1" is not running',
        recoverable: true,
        retry: false,
      },
    });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-start')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-start'));
    await waitFor(() => expect(transactions).toHaveBeenCalledWith('srv-1'));
    const afterGone = transactions.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(4500); });
    expect(transactions.mock.calls.length).toBe(afterGone);
    await waitFor(() => expect(screen.getByTestId('mock-runtime')).toHaveTextContent('srv-1:stopped:'));
  });

  it('closing a tab that never ran leaves the runtime map untouched', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-tab-srv-2')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-close-srv-2'));

    // Parked, not deleted — and there was no runtime entry to forget.
    await waitFor(() => expect(screen.queryByTestId('mock-tab-srv-2')).toBeNull());
    expect(screen.getByTestId('mock-tab-srv-1')).toHaveTextContent('stopped:clean');
  });

  it('saves an example onto the active server only, seeding an absent example list', async () => {
    // A workspace written before examples existed has no `samples` array at all.
    const [first, second] = [makeServer('srv-1', 4600), makeServer('srv-2', 4601)];
    loadApiMockWorkspace.mockResolvedValue({
      servers: [{ ...first, samples: undefined }, second],
      activeServerId: 'srv-1',
    });

    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-modals')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-save-sample'));
    // Closing Simulate must not clear the seed the sample was saved from.
    fireEvent.click(screen.getByTestId('mock-simulate-close'));

    expect(screen.getByTestId('api-mock-live-region')).toHaveTextContent(/Saved sample/);
    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    const saved = saveApiMockWorkspace.mock.calls.at(-1)?.[0] as {
      servers: Array<{ id: string; samples?: Array<{ id: string }> }>;
    };
    expect(saved.servers.find(s => s.id === 'srv-1')?.samples).toHaveLength(1);
    expect(saved.servers.find(s => s.id === 'srv-2')?.samples).toHaveLength(0);
  });

  it('patches the selected rule through the demo bridge, reading live state', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mock-active-section')).toBeTruthy());

    const patch = (window as unknown as {
      __demoPatchApiMockActiveRoute?: (p: { priority?: number }) => boolean;
    }).__demoPatchApiMockActiveRoute;
    expect(patch).toBeTypeOf('function');
    // The bridge reads servers/active tab off a ref, so it sees the hydrated state.
    expect(patch?.({ priority: 42 })).toBe(true);

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    const saved = saveApiMockWorkspace.mock.calls.at(-1)?.[0] as {
      servers: Array<{ id: string; routes: Array<{ priority: number }> }>;
    };
    expect(saved.servers.find(s => s.id === 'srv-1')?.routes[0]?.priority).toBe(42);
  });
});
