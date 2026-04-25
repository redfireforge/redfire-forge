import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestConfig, Scenario, RequestResult } from '../types';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

type _Listener = (e: { data: WorkerToMainMessage }) => void;
type _ErrorListener = (e: { message: string }) => void;

class MockWorker {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  public postMessage = vi.fn();
  public terminate = vi.fn();

  addEventListener(type: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter(f => f !== fn));
  }

  simulateMessage(data: WorkerToMainMessage) {
    for (const fn of (this.listeners.get('message') ?? [])) {
      fn({ data });
    }
  }

  simulateError(message: string) {
    for (const fn of (this.listeners.get('error') ?? [])) {
      fn({ message });
    }
  }

  getStartMessage(): MainToWorkerMessage | undefined {
    const call = this.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'start'
    );
    return call?.[0];
  }
}

let mockWorkerInstance: MockWorker;

function WorkerCtor(this: MockWorker) {
  mockWorkerInstance = new MockWorker();
  Object.assign(this, mockWorkerInstance);
  // Forward method calls to the real mock instance
  this.postMessage = mockWorkerInstance.postMessage;
  this.terminate = mockWorkerInstance.terminate;
  this.addEventListener = mockWorkerInstance.addEventListener.bind(mockWorkerInstance);
  this.removeEventListener = mockWorkerInstance.removeEventListener.bind(mockWorkerInstance);
  // Bridge needs to call simulateMessage on the mockWorkerInstance directly,
  // so we also keep the reference
  return mockWorkerInstance;
}

vi.stubGlobal('Worker', WorkerCtor);

import { runTestInWorker } from './workerBridge';
import { httpFetch } from '../utils/httpClient';
import { isTauri } from '../utils/platform';

const mockedHttpFetch = vi.mocked(httpFetch);
const mockedIsTauri = vi.mocked(isTauri);

function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    concurrency: 2,
    totalTransactions: 5,
    scenarioWeights: [],
    executionMode: 'batch',
    ...overrides,
  };
}

function makeScenario(id = 's1'): Scenario {
  return {
    id,
    name: `Scenario ${id}`,
    url: 'http://example.com/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
  };
}

function makeResult(id: string, passed = true): RequestResult {
  return {
    id,
    scenarioId: 's1',
    scenarioName: 'Test',
    url: 'http://example.com',
    method: 'GET',
    httpStatus: passed ? 200 : 500,
    responseTimeMs: 50,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails: [],
  };
}

describe('workerBridge — runTestInWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTauri.mockReturnValue(false);
  });

  it('creates a Worker and sends start message', async () => {
    const config = makeConfig();
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    const promise = runTestInWorker(config, scenarios, onProgress);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledTimes(1);
    const startMsg = mockWorkerInstance.getStartMessage();
    expect(startMsg).toBeDefined();
    expect(startMsg!.type).toBe('start');
    const startData = startMsg as Extract<MainToWorkerMessage, { type: 'start' }>;
    expect(startData.useTauriProxy).toBe(false);
    expect(startData.config).toEqual(config);
    expect(startData.scenarios).toEqual(scenarios);

    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('sets useTauriProxy=true when running in Tauri', async () => {
    mockedIsTauri.mockReturnValue(true);
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

    const startMsg = mockWorkerInstance.getStartMessage();
    expect((startMsg as Extract<MainToWorkerMessage, { type: 'start' }>).useTauriProxy).toBe(true);

    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('resolves with accumulated results from progress + done', async () => {
    const onProgress = vi.fn();
    const promise = runTestInWorker(makeConfig(), [makeScenario()], onProgress);

    const r1 = makeResult('r1');
    const r2 = makeResult('r2');
    const r3 = makeResult('r3');

    mockWorkerInstance.simulateMessage({
      type: 'progress', completed: 2, total: 3, newResults: [r1, r2],
    });

    expect(onProgress).toHaveBeenCalledWith(2, 3, [r1, r2], undefined);

    mockWorkerInstance.simulateMessage({
      type: 'done', newResults: [r3],
    });

    const results = await promise;
    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('r1');
    expect(results[2].id).toBe('r3');
  });

  it('calls onProgress with accumulated allResults and meta', async () => {
    const onProgress = vi.fn();
    const promise = runTestInWorker(makeConfig(), [makeScenario()], onProgress);

    const meta = { elapsedMs: 100, targetConcurrency: 5, currentInFlight: 3, durationMs: 10000 };
    mockWorkerInstance.simulateMessage({
      type: 'progress', completed: 1, total: 5, newResults: [makeResult('r1')], meta,
    });

    expect(onProgress).toHaveBeenCalledWith(1, 5, expect.arrayContaining([expect.objectContaining({ id: 'r1' })]), meta);

    mockWorkerInstance.simulateMessage({
      type: 'progress', completed: 3, total: 5, newResults: [makeResult('r2'), makeResult('r3')],
    });

    const secondCall = onProgress.mock.calls[1];
    expect(secondCall[2]).toHaveLength(3);

    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('rejects with error message on worker error message', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

    mockWorkerInstance.simulateMessage({ type: 'error', message: 'Something broke' });

    await expect(promise).rejects.toThrow('Something broke');
  });

  it('rejects and cleans up on Worker global error event', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

    mockWorkerInstance.simulateError('Script error');

    await expect(promise).rejects.toThrow('Script error');
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  it('terminates worker after done', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
    await promise;
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  it('terminates worker after error', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorkerInstance.simulateMessage({ type: 'error', message: 'fail' });
    await promise.catch(() => {});
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  describe('abort', () => {
    it('sends abort message when abortSignal fires', async () => {
      const controller = new AbortController();
      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn(), controller.signal);

      controller.abort();

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'abort' })
      );

      mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('rejects immediately if abortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn(), controller.signal);
      await expect(promise).rejects.toThrow('Aborted');
    });
  });

  describe('HTTP proxy (Tauri mode)', () => {
    beforeEach(() => {
      mockedIsTauri.mockReturnValue(true);
    });

    it('proxies http-request messages through main-thread httpFetch', async () => {
      mockedHttpFetch.mockResolvedValue({
        status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}',
      });

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

      mockWorkerInstance.simulateMessage({
        type: 'http-request',
        id: 'req-1',
        url: 'http://api.test/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      await vi.waitFor(() => {
        expect(mockedHttpFetch).toHaveBeenCalledWith(
          'http://api.test/data', 'POST',
          { 'Content-Type': 'application/json' }, '{}'
        );
      });

      await vi.waitFor(() => {
        const responseCall = mockWorkerInstance.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
        );
        expect(responseCall).toBeDefined();
        expect(responseCall![0].id).toBe('req-1');
        expect(responseCall![0].response.status).toBe(200);
      });

      mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('sends error response when httpFetch throws', async () => {
      mockedHttpFetch.mockRejectedValue(new Error('Connection refused'));

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

      mockWorkerInstance.simulateMessage({
        type: 'http-request',
        id: 'req-2',
        url: 'http://api.test/fail',
        method: 'GET',
        headers: {},
      });

      await vi.waitFor(() => {
        const responseCall = mockWorkerInstance.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
        );
        expect(responseCall).toBeDefined();
        expect(responseCall![0].response.status).toBe(0);
        expect(responseCall![0].response.error).toBe('Connection refused');
      });

      mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });

  it('ignores duplicate done/error after settlement', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [makeResult('r1')] });
    const results = await promise;
    expect(results).toHaveLength(1);

    // Second done should not cause issues
    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [makeResult('r2')] });
    // No error thrown — the worker was already terminated
  });

  it('ignores Worker global error after settlement', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
    await promise;

    // Subsequent error event is ignored because settled = true
    mockWorkerInstance.simulateError('late crash');
    // No unhandled rejection
  });

  it('uses fallback message for empty Worker error event', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorkerInstance.simulateError('');
    await expect(promise).rejects.toThrow('Worker error');
  });

  describe('HTTP proxy non-Error rejection', () => {
    it('stringifies non-Error throw from httpFetch', async () => {
      mockedIsTauri.mockReturnValue(true);
      mockedHttpFetch.mockRejectedValue('string rejection');

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

      mockWorkerInstance.simulateMessage({
        type: 'http-request',
        id: 'req-str',
        url: 'http://a.test',
        method: 'GET',
        headers: {},
      });

      await vi.waitFor(() => {
        const resp = mockWorkerInstance.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
        );
        expect(resp).toBeDefined();
        expect(resp![0].response.error).toBe('string rejection');
      });

      mockWorkerInstance.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });
});
