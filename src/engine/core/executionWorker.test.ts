/**
 * Unit tests for executionWorker.ts — Web Worker entry that wires HTTP transport,
 * runs `runTest`, and relays progress/done/error/http-proxy messages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainToWorkerMessage } from './workerProtocol';
import { TestConfig, Scenario, RequestResult } from '@shared/types';
import { ProgressMeta } from './executor';
import { HttpResponse } from '@shared/utils/httpClient';

const httpMocks = vi.hoisted(() => {
  const proxyFetch = vi.fn(async (): Promise<HttpResponse> => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '{}',
  }));
  const setHttpTransport = vi.fn();
  return { proxyFetch, setHttpTransport };
});

const runTestMock = vi.hoisted(() => vi.fn());

vi.mock('@shared/utils/httpClient', () => ({
  proxyFetch: httpMocks.proxyFetch,
  setHttpTransport: httpMocks.setHttpTransport,
}));

vi.mock('./executor', () => ({
  runTest: (...args: unknown[]) => runTestMock(...args),
}));

const workerHarness = vi.hoisted(() => {
  let onMessage: ((e: MessageEvent<MainToWorkerMessage>) => void | Promise<void>) | undefined;
  const postMessage = vi.fn();
  const addEventListener = vi.fn((type: string, listener: (e: MessageEvent<MainToWorkerMessage>) => void) => {
    if (type === 'message') onMessage = listener;
  });
  return {
    postMessage,
    addEventListener,
    get self(): { postMessage: typeof postMessage; addEventListener: typeof addEventListener } {
      return { postMessage, addEventListener };
    },
    emit(data: MainToWorkerMessage) {
      if (!onMessage) throw new Error('message handler not registered');
      return Promise.resolve(onMessage({ data } as MessageEvent<MainToWorkerMessage>));
    },
  };
});

function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return _makeConfig(overrides);
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario(overrides) as Scenario;
}

import { makeResult as _makeResult, makeScenario as _makeScenario, makeConfig as _makeConfig } from '@test-utils/factories';

const fixedTimestamp = 1700000000000;
function makeResult(id: string): RequestResult {
  return _makeResult({ id, timestamp: fixedTimestamp });
}

const meta: ProgressMeta = {
  elapsedMs: 1,
  targetConcurrency: 1,
  currentInFlight: 0,
  durationMs: 100,
};

async function loadExecutionWorker(): Promise<void> {
  vi.stubGlobal('self', workerHarness.self);
  vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-123' });
  await import('./executionWorker');
}

describe('executionWorker', () => {
  beforeEach(async () => {
    vi.resetModules();
    workerHarness.postMessage.mockClear();
    workerHarness.addEventListener.mockClear();
    runTestMock.mockReset();
    httpMocks.setHttpTransport.mockClear();
    httpMocks.proxyFetch.mockClear();
    await loadExecutionWorker();
  });

  it('registers message and unhandledrejection listeners on the worker global', () => {
    // Worker registers both 'unhandledrejection' (for error reporting) and 'message' (for commands)
    expect(workerHarness.addEventListener).toHaveBeenCalledTimes(2);
    expect(workerHarness.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    expect(workerHarness.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('uses browser (Vite proxy) transport when useTauriProxy is false', async () => {
    runTestMock.mockResolvedValue({ results: [makeResult('r1')], trace: undefined });
    const cfg = makeConfig();
    const scenarios = [makeScenario()];
    await workerHarness.emit({
      type: 'start',
      config: cfg,
      scenarios,
      useTauriProxy: false,
    });
    await vi.waitFor(() => expect(runTestMock).toHaveBeenCalled());
    expect(httpMocks.setHttpTransport).toHaveBeenCalledWith(httpMocks.proxyFetch);
    expect(runTestMock).toHaveBeenCalledWith(
      cfg,
      scenarios,
      expect.any(Function),
      expect.any(AbortSignal),
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'done', newResults: [makeResult('r1')] }),
      ),
    );
  });

  it('passes workflow to runTest when included in start message', async () => {
    runTestMock.mockResolvedValue({ results: [], trace: undefined });
    const wf = {
      id: 'w1',
      name: 'W',
      nodes: [],
      edges: [],
    };
    await workerHarness.emit({
      type: 'start',
      config: makeConfig({ workflowId: 'w1' }),
      scenarios: [makeScenario()],
      useTauriProxy: false,
      workflow: wf as import('../features/workflow/types/workflow').Workflow,
    });
    await vi.waitFor(() => expect(runTestMock).toHaveBeenCalled());
    expect(runTestMock.mock.calls[0][4]).toBe(wf);
  });

  it('slices progress newResults incrementally using lastSentCount', async () => {
    const r1 = makeResult('a');
    const r2 = makeResult('b');
    const r3 = makeResult('c');
    runTestMock.mockImplementation(
      async (_c, _s, onProgress: (completed: number, total: number, all: RequestResult[], m?: ProgressMeta) => void) => {
        onProgress(1, 3, [r1], meta);
        onProgress(2, 3, [r1, r2], meta);
        return { results: [r1, r2, r3], trace: undefined };
      },
    );
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith({
        type: 'progress',
        completed: 1,
        total: 3,
        newResults: [r1],
        meta,
      }),
    );
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith({
        type: 'progress',
        completed: 2,
        total: 3,
        newResults: [r2],
        meta,
      }),
    );
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith({
        type: 'done',
        newResults: [r3],
        trace: undefined,
      }),
    );
  });

  it('posts Error message when runTest rejects with Error', async () => {
    runTestMock.mockRejectedValue(new Error('boom'));
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'boom' }),
    );
  });

  it('posts stringified error when runTest rejects with non-Error', async () => {
    runTestMock.mockRejectedValue('plain');
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'plain' }),
    );
  });

  it('installs Tauri bridge transport (not vite proxy) when useTauriProxy is true', async () => {
    runTestMock.mockResolvedValue({ results: [], trace: undefined });
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: true,
    });
    await vi.waitFor(() => expect(runTestMock).toHaveBeenCalled());
    const installed = httpMocks.setHttpTransport.mock.calls[0]?.[0];
    expect(installed).toBeDefined();
    expect(installed).not.toBe(httpMocks.proxyFetch);
  });

  it('Tauri transport posts http-request and resolves when http-response arrives', async () => {
    runTestMock.mockResolvedValue({ results: [], trace: undefined });
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: true,
    });
    await vi.waitFor(() => expect(httpMocks.setHttpTransport).toHaveBeenCalled());
    const transport = httpMocks.setHttpTransport.mock.calls[0][0] as (
      url: string,
      method: string,
      headers: Record<string, string>,
      body?: string,
    ) => Promise<HttpResponse>;
    const pending = transport('https://api.example/x', 'POST', { 'X-Foo': '1' }, 'body');
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'http-request',
          id: 'test-uuid-123',
          url: 'https://api.example/x',
          method: 'POST',
          headers: { 'X-Foo': '1' },
          body: 'body',
        }),
      ),
    );
    const httpRes: HttpResponse = {
      status: 201,
      statusText: 'Created',
      headers: {},
      body: 'ok',
    };
    await workerHarness.emit({ type: 'http-response', id: 'test-uuid-123', response: httpRes });
    await expect(pending).resolves.toEqual(httpRes);
  });

  it('ignores http-response for unknown id without throwing', async () => {
    runTestMock.mockResolvedValue({ results: [], trace: undefined });
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });
    await vi.waitFor(() => expect(runTestMock).toHaveBeenCalled());
    await expect(
      workerHarness.emit({
        type: 'http-response',
        id: 'missing',
        response: { status: 200, statusText: 'OK', headers: {}, body: '' },
      }),
    ).resolves.toBeUndefined();
  });

  it('aborts runTest signal when abort message is posted', async () => {
    let signal: AbortSignal | undefined;
    runTestMock.mockImplementation(async (_c, _s, _p, sig) => {
      signal = sig;
      await new Promise<void>(() => {
        /* hang: start handler must not block abort; see void emit below */
      });
      return { results: [], trace: undefined };
    });
    void workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });
    await vi.waitFor(() => expect(signal).toBeDefined());
    await workerHarness.emit({ type: 'abort' });
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it('abort before start is a no-op (no controller yet)', async () => {
    await workerHarness.emit({ type: 'abort' });
    expect(workerHarness.postMessage).not.toHaveBeenCalled();
  });

  it('passes workerIndex to runTest when provided in start message', async () => {
    runTestMock.mockResolvedValue({ results: [], trace: undefined });
    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
      workerIndex: 3,
    });
    await vi.waitFor(() => expect(runTestMock).toHaveBeenCalled());
    expect(runTestMock.mock.calls[0][6]).toBe(3);
  });

  it('batches progress updates within throttle window and flushes pending on completion', async () => {
    const r1 = makeResult('a');
    const r2 = makeResult('b');
    const r3 = makeResult('c');
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    runTestMock.mockImplementation(
      async (_c, _s, onProgress: (completed: number, total: number, all: RequestResult[], m?: ProgressMeta) => void) => {
        onProgress(1, 3, [r1], meta);
        now = 50;
        onProgress(2, 3, [r1, r2], meta);
        return { results: [r1, r2, r3], trace: undefined };
      },
    );

    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });

    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'progress', completed: 2, total: 3, newResults: [r2] }),
      ),
    );
    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'done', newResults: [r3] }),
      ),
    );

    const progressCalls = workerHarness.postMessage.mock.calls.filter(
      (c) => c[0]?.type === 'progress',
    );
    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0][0]).toMatchObject({
      type: 'progress',
      completed: 1,
      total: 3,
      newResults: [r1],
    });
    expect(progressCalls[1][0]).toMatchObject({
      type: 'progress',
      completed: 2,
      total: 3,
      newResults: [r2],
    });
  });

  it('merges pending and new results when throttle window elapses with backlog', async () => {
    const r1 = makeResult('a');
    const r2 = makeResult('b');
    const r3 = makeResult('c');
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    runTestMock.mockImplementation(
      async (_c, _s, onProgress: (completed: number, total: number, all: RequestResult[], m?: ProgressMeta) => void) => {
        onProgress(1, 3, [r1], meta);
        now = 50;
        onProgress(2, 3, [r1, r2], meta);
        now = 300;
        onProgress(3, 3, [r1, r2, r3], meta);
        return { results: [r1, r2, r3], trace: undefined };
      },
    );

    await workerHarness.emit({
      type: 'start',
      config: makeConfig(),
      scenarios: [makeScenario()],
      useTauriProxy: false,
    });

    await vi.waitFor(() =>
      expect(workerHarness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          completed: 3,
          total: 3,
          newResults: [r2, r3],
        }),
      ),
    );
  });

  it('posts error on unhandledrejection with reason message', async () => {
    const rejectionListener = workerHarness.addEventListener.mock.calls.find(
      (c) => c[0] === 'unhandledrejection',
    )?.[1] as (e: PromiseRejectionEvent) => void;
    expect(rejectionListener).toBeDefined();
    rejectionListener({ reason: new Error('worker blew up') } as PromiseRejectionEvent);
    expect(workerHarness.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'Unhandled rejection in worker: worker blew up',
    });
  });

  it('posts stringified reason when unhandledrejection reason has no message', async () => {
    workerHarness.postMessage.mockClear();
    const rejectionListener = workerHarness.addEventListener.mock.calls.find(
      (c) => c[0] === 'unhandledrejection',
    )?.[1] as (e: PromiseRejectionEvent) => void;
    rejectionListener({ reason: 'plain rejection' } as PromiseRejectionEvent);
    expect(workerHarness.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'Unhandled rejection in worker: plain rejection',
    });
  });
});
