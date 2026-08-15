/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import type { ApiMockMainView } from './components/ApiMockWorkspaceNav';
import type { RuntimeInfo } from './apiMockStudioFactory';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from './apiMockGalleryImport';

const loadApiMockWorkspace = vi.fn();
const saveApiMockWorkspace = vi.fn();
const publishApiMockWorkspace = vi.fn();
const list = vi.fn();
const status = vi.fn();
const isTauri = vi.fn(() => false);

vi.mock('./apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveApiMockWorkspace(...args),
  publishApiMockWorkspace: (...args: unknown[]) => publishApiMockWorkspace(...args),
}));
vi.mock('../../shared/utils/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/utils/platform')>()),
  isTauri: () => isTauri(),
}));
vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    list: (...args: unknown[]) => list(...args),
    status: (...args: unknown[]) => status(...args),
  },
}));

import { useApiMockStudioPersistence } from './useApiMockStudioPersistence';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string): ApiMockServerDefinitionV1 {
  return {
    id, name: id, enabled: true, host: '127.0.0.1', port: 4600, basePath: '',
    folders: [], routes: [], samples: [], variables: [],
    settings: {
      selection: { multipleMatchPolicy: 'highest_priority', equalPriorityPolicy: 'reject', ambiguityResponse: { status: 409, headers: [], body: '{}', contentType: 'application/json' } },
      fallback: { unmatchedResponse: { status: 404, headers: [], body: '{}', contentType: 'application/json' }, mode: 'default_response' },
      cors: { enabled: false, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['Content-Type'], allowCredentials: false, maxAge: 0, exposeHeaders: [] },
      limits: { maxInboundBodyBytes: 1024, maxResponseBodyBytes: 1024, maxConcurrentConnections: 10, maxDelayMs: 0, longRunningEnabled: false, longRunningMaxMs: 0, gracefulDrainMs: 0 },
      journal: { enabled: true, maxEntries: 10, maxCapturedBodyBytes: 1024, persistToDisk: false },
      redaction: { headerNames: [], jsonPaths: [], preserveScheme: true },
    },
    createdAt: ts, updatedAt: ts,
  };
}

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>(resolve => { settle = resolve; });
  return { promise, settle };
}

function Probe() {
  const [servers, setServers] = useState<ApiMockServerDefinitionV1[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | undefined>();
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<Record<string, RuntimeInfo>>({});
  const [transactions, setTransactions] = useState<ApiMockTransactionV1[]>([]);
  const [scenarioState, setScenarioState] = useState<ScenarioStateSnapshot | null>(null);
  const [mainView, setMainView] = useState<ApiMockMainView>('studio');
  const [liveMessage, setLiveMessage] = useState('');
  useApiMockStudioPersistence({
    servers, activeServerId, openTabIds, setServers, setActiveServerId, setOpenTabIds,
    setRuntime, setTransactions, setScenarioState, setMainView, setLiveMessage,
  });
  return (
    <div>
      <span data-testid="live">{liveMessage}</span>
      <span data-testid="view">{mainView}</span>
      <span data-testid="tx">{transactions.length}</span>
      <span data-testid="state">{scenarioState ? 'yes' : 'no'}</span>
      {Object.entries(runtime).map(([id, r]) => (
        <span key={id} data-testid={`rt-${id}`}>{r.status}:{r.generation}</span>
      ))}
    </div>
  );
}

describe('useApiMockStudioPersistence', () => {
  beforeEach(() => {
    isTauri.mockReturnValue(false);
    loadApiMockWorkspace.mockResolvedValue({ servers: [makeServer('srv-1'), makeServer('srv-2')], activeServerId: 'srv-1' });
    saveApiMockWorkspace.mockResolvedValue(undefined);
    list.mockResolvedValue({ ok: true, data: [] });
    status.mockResolvedValue({ ok: true, data: { state: 'stopped', generation: 0 } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reconciles desktop probes and treats a failed status as stopped', async () => {
    isTauri.mockReturnValue(true);
    status.mockImplementation(async (id: string) => (
      id === 'srv-1'
        ? { ok: true, data: { state: 'running', generation: 3 } }
        : { ok: false, error: { code: 'MOCK_RUNTIME_ERROR', message: 'gone', retry: false } }
    ));
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rt-srv-1')).toHaveTextContent('running:3'));
    expect(screen.getByTestId('rt-srv-2')).toHaveTextContent('stopped:0');
    expect(list).not.toHaveBeenCalled();
  });

  it('uses generation zero when a running desktop probe omits it', async () => {
    isTauri.mockReturnValue(true);
    status.mockResolvedValue({ ok: true, data: { state: 'running' } });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rt-srv-1')).toHaveTextContent('running:0'));
  });

  it('reconciles the companion pool on web and surfaces a companion notice', async () => {
    list.mockResolvedValue({
      ok: false,
      error: { code: 'COMPANION_UNAVAILABLE', message: 'fetch failed', retry: true },
    });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('live')).toHaveTextContent(/Companion unavailable|fetch failed/i));
  });

  it('adopts companion generation when list succeeds', async () => {
    list.mockResolvedValue({
      ok: true,
      data: [{ serverId: 'srv-2', state: 'running', generation: 7 }],
    });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rt-srv-2')).toHaveTextContent('running:7'));
    expect(screen.getByTestId('rt-srv-1')).toHaveTextContent('stopped:0');
  });

  it('ignores empty disk hydration and still marks the workspace ready', async () => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [] });
    render(<Probe />);
    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());
    expect(screen.queryByTestId('rt-srv-1')).toBeNull();
  });

  it('drops an in-flight web list after unmount', async () => {
    const pending = deferred<{ ok: true; data: [] }>();
    list.mockReturnValue(pending.promise);
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    unmount();
    await act(async () => { pending.settle({ ok: true, data: [] }); });
    expect(screen.queryByTestId('live')).toBeNull();
  });

  it('invalidates in-flight hydration when the workspace import event fires', async () => {
    const pending = deferred<{ ok: true; data: Array<{ serverId: string; state: 'running'; generation: number }> }>();
    list.mockReturnValue(pending.promise);
    render(<Probe />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    act(() => {
      window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT, {
        detail: { servers: [makeServer('imported')], activeServerId: 'imported' },
      }));
    });
    await waitFor(() => expect(screen.getByTestId('live')).toHaveTextContent('Gallery mock server imported.'));
    await act(async () => {
      pending.settle({ ok: true, data: [{ serverId: 'srv-1', state: 'running', generation: 9 }] });
    });
    expect(screen.queryByTestId('rt-srv-1')).toBeNull();
  });

  it('clears the studio when an import wipes every server', async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rt-srv-1')).toBeTruthy());
    act(() => {
      window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT, {
        detail: { servers: [] },
      }));
    });
    await waitFor(() => expect(screen.getByTestId('live')).toHaveTextContent(''));
    expect(screen.getByTestId('view')).toHaveTextContent('studio');
    expect(screen.getByTestId('tx')).toHaveTextContent('0');
  });

  it('ignores a workspace event without servers and flushes on unmount after hydrate', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rt-srv-1')).toBeTruthy());
    act(() => {
      window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT, { detail: {} }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(saveApiMockWorkspace).toHaveBeenCalled();
    unmount();
    expect(saveApiMockWorkspace.mock.calls.length).toBeGreaterThan(0);
  });
});
