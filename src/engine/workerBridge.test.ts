import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TestConfig, LoadProfileConfig } from '../shared/types';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import { makeScenario as _makeScenario, makeResult as _makeResult, makeConfig as _makeConfig } from '../test-utils/factories';

vi.mock('../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../shared/utils/httpClient', () => ({
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
const allMockWorkers: MockWorker[] = [];

function WorkerCtor(this: MockWorker) {
  mockWorkerInstance = new MockWorker();
  allMockWorkers.push(mockWorkerInstance);
  Object.assign(this, mockWorkerInstance);
  this.postMessage = mockWorkerInstance.postMessage;
  this.terminate = mockWorkerInstance.terminate;
  this.addEventListener = mockWorkerInstance.addEventListener.bind(mockWorkerInstance);
  this.removeEventListener = mockWorkerInstance.removeEventListener.bind(mockWorkerInstance);
  return mockWorkerInstance;
}

vi.stubGlobal('Worker', WorkerCtor);

import { runTestInWorker, runTestMultiWorker, getWorkerCount } from './workerBridge';
import { httpFetch } from '../shared/utils/httpClient';
import { isTauri } from '../shared/utils/platform';

const mockedHttpFetch = vi.mocked(httpFetch);
const mockedIsTauri = vi.mocked(isTauri);

const makeConfig = (overrides: Partial<TestConfig> = {}) =>
  _makeConfig({ concurrency: 2, iterations: 5, executionMode: 'batch', scenarioWeights: [], ...overrides });

const makeScenario = (id = 's1') =>
  _makeScenario({ id, name: `Scenario ${id}` });

const makeResult = (id: string, passed = true) =>
  _makeResult({ id, passed, httpStatus: passed ? 200 : 500, responseTimeMs: 50, responseBody: '' });

describe('workerBridge — runTestInWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allMockWorkers.length = 0;
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

    const { results } = await promise;
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
    const { results } = await promise;
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

// ────────────────────────────────────────────────────────
// getWorkerCount
// ────────────────────────────────────────────────────────

describe('getWorkerCount', () => {
  const origDescriptor = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');

  afterEach(() => {
    if (origDescriptor) {
      Object.defineProperty(navigator, 'hardwareConcurrency', origDescriptor);
    }
  });

  it('returns cores - 1, capped at 8', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 10, configurable: true });
    expect(getWorkerCount()).toBe(8);
  });

  it('returns at least 1', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 1, configurable: true });
    expect(getWorkerCount()).toBeGreaterThanOrEqual(1);
  });

  it('handles missing hardwareConcurrency (defaults to 2)', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: undefined, configurable: true });
    expect(getWorkerCount()).toBe(1);
  });

  it('returns cores - 1 for typical 8-core machine', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    expect(getWorkerCount()).toBe(7);
  });

  it('returns 1 for dual-core machine', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true });
    expect(getWorkerCount()).toBe(1);
  });
});

// ────────────────────────────────────────────────────────
// runTestMultiWorker
// ────────────────────────────────────────────────────────

describe('workerBridge — runTestMultiWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allMockWorkers.length = 0;
    mockedIsTauri.mockReturnValue(false);
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
  });

  function makeScenarios(count: number): Scenario[] {
    return Array.from({ length: count }, (_, i) => makeScenario(`s${i}`));
  }

  describe('fallback to single worker', () => {
    it('falls back when scenario count < MIN_SCENARIOS_FOR_MULTI', async () => {
      const scenarios = makeScenarios(3);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig(), scenarios, onProgress);

      expect(allMockWorkers).toHaveLength(1);
      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('falls back when workflow is provided', async () => {
      const scenarios = makeScenarios(20);
      const workflow = { id: 'wf1', name: 'test', nodes: [], edges: [], variables: {} } as never;
      const promise = runTestMultiWorker(makeConfig(), scenarios, vi.fn(), undefined, workflow);

      expect(allMockWorkers).toHaveLength(1);
      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('falls back when hardwareConcurrency is 1', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 1, configurable: true });
      const scenarios = makeScenarios(20);
      const promise = runTestMultiWorker(makeConfig(), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(1);
      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('falls back when scenarios fit in a single chunk', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      const scenarios = makeScenarios(2);
      const config = makeConfig({ concurrency: 1 });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(1);
      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('falls back in load-profile mode when concurrency is 1', async () => {
      const scenarios = makeScenarios(5);
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile: { type: 'sustained', durationSec: 10, maxConcurrency: 1 },
        concurrency: 1,
      });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(1);
      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('handles undefined concurrency (defaults to 1 per worker)', async () => {
      const scenarios = makeScenarios(10);
      const config = makeConfig({ concurrency: undefined });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(startMsg.config.concurrency).toBe(1);
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });

  describe('multi-worker scenario splitting', () => {
    it('spawns multiple workers and splits scenarios', async () => {
      const scenarios = makeScenarios(12);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 6 }), scenarios, onProgress);

      expect(allMockWorkers.length).toBeGreaterThan(1);

      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(startMsg).toBeDefined();
        expect(startMsg.workerIndex).toBeDefined();
        expect(startMsg.totalWorkers).toBe(allMockWorkers.length);
        expect(startMsg.scenarios.length).toBeGreaterThan(0);
      }

      const totalScenarios = allMockWorkers.reduce((sum, w) => {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        return sum + msg.scenarios.length;
      }, 0);
      expect(totalScenarios).toBe(12);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('divides concurrency evenly across workers', async () => {
      const scenarios = makeScenarios(20);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 12 }), scenarios, vi.fn());

      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(startMsg.config.concurrency).toBeGreaterThanOrEqual(1);
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });

  describe('result aggregation', () => {
    it('aggregates results from all workers', async () => {
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress);

      const workerCount = allMockWorkers.length;

      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 2, total: 5, newResults: [makeResult('w0-r1'), makeResult('w0-r2')],
      });

      expect(onProgress).toHaveBeenCalled();
      const firstCall = onProgress.mock.calls[0];
      // After first worker reports total=5, aggregated total = 5 (other workers haven't reported yet)
      expect(firstCall[1]).toBe(5);

      if (workerCount > 1) {
        allMockWorkers[1].simulateMessage({
          type: 'progress', completed: 3, total: 5, newResults: [makeResult('w1-r1')],
        });
        // After both workers report total=5, aggregated total = 10
        const secondWorkerCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
        expect(secondWorkerCall[1]).toBe(10);
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [makeResult(`wdone-${allMockWorkers.indexOf(w)}`)] });
      }
      const { results } = await promise;
      expect(results.length).toBeGreaterThanOrEqual(workerCount);
    });

    it('resolves only when all workers send done', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      const workerCount = allMockWorkers.length;
      let resolved = false;
      promise.then(() => { resolved = true; });

      for (let i = 0; i < workerCount - 1; i++) {
        allMockWorkers[i].simulateMessage({ type: 'done', newResults: [] });
      }
      await new Promise(r => setTimeout(r, 10));
      expect(resolved).toBe(false);

      allMockWorkers[workerCount - 1].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });

  describe('error handling', () => {
    it('rejects and aborts all workers when one errors', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateMessage({ type: 'error', message: 'Worker 0 crashed' });

      await expect(promise).rejects.toThrow('Worker 0 crashed');

      for (const w of allMockWorkers) {
        const abortCall = w.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'abort'
        );
        expect(abortCall).toBeDefined();
        expect(w.terminate).toHaveBeenCalled();
      }
    });

    it('rejects on Worker global error event and cleans up all', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateError('Script load failed');

      await expect(promise).rejects.toThrow('Script load failed');

      for (const w of allMockWorkers) {
        expect(w.terminate).toHaveBeenCalled();
      }
    });

    it('ignores messages after settlement', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateMessage({ type: 'error', message: 'first error' });
      await expect(promise).rejects.toThrow('first error');

      expect(() => {
        allMockWorkers[1]?.simulateMessage({ type: 'error', message: 'second error' });
      }).not.toThrow();
    });

    it('uses fallback message for empty Worker error event', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateError('');
      await expect(promise).rejects.toThrow('Worker error');
    });

    it('ignores global error after settlement', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;

      expect(() => {
        allMockWorkers[0].simulateError('late error');
      }).not.toThrow();
    });
  });

  describe('abort signal', () => {
    it('sends abort to all workers when signal fires', async () => {
      const controller = new AbortController();
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn(), controller.signal);

      controller.abort();

      for (const w of allMockWorkers) {
        const abortCall = w.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'abort'
        );
        expect(abortCall).toBeDefined();
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('rejects immediately if already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn(), controller.signal);
      await expect(promise).rejects.toThrow('Aborted');
    });
  });

  describe('load profile mode', () => {
    const loadProfile: LoadProfileConfig = {
      type: 'sustained',
      durationSec: 10,
      maxConcurrency: 8,
    };

    it('passes full scenarios to each worker in load profile mode', async () => {
      const scenarios = makeScenarios(5);
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile,
        concurrency: 8,
      });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(startMsg.scenarios).toHaveLength(5);
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('reports total=-1 in load profile mode', async () => {
      const scenarios = makeScenarios(5);
      const onProgress = vi.fn();
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile,
        concurrency: 8,
      });
      const promise = runTestMultiWorker(config, scenarios, onProgress);

      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 10, total: -1, newResults: [makeResult('lp-r1')],
      });

      expect(onProgress).toHaveBeenCalledWith(
        expect.any(Number), -1, expect.any(Array), undefined,
      );

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('caps worker count to concurrency in load profile mode', async () => {
      const scenarios = makeScenarios(5);
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile,
        concurrency: 2,
      });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      expect(allMockWorkers.length).toBeLessThanOrEqual(2);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('divides maxConcurrency and spikeConcurrency across workers without overshoot', async () => {
      const scenarios = makeScenarios(5);
      const spikeProfile: LoadProfileConfig = {
        type: 'spike',
        durationSec: 60,
        maxConcurrency: 20,
        spikeConcurrency: 60,
      };
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile: spikeProfile,
        concurrency: 8,
      });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      const wCount = allMockWorkers.length;
      expect(wCount).toBeGreaterThan(1);

      let totalMax = 0;
      let totalSpike = 0;
      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        const lp = startMsg.config.loadProfile!;
        expect(lp.maxConcurrency).toBeGreaterThanOrEqual(1);
        totalMax += lp.maxConcurrency;
        totalSpike += lp.spikeConcurrency!;
      }
      expect(totalMax).toBe(20);
      expect(totalSpike).toBe(60);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('divides pool concurrency across workers without overshoot', async () => {
      const scenarios = makeScenarios(20);
      const config = makeConfig({ concurrency: 10 });
      const promise = runTestMultiWorker(config, scenarios, vi.fn());

      const wCount = allMockWorkers.length;
      expect(wCount).toBeGreaterThan(1);

      let totalConcurrency = 0;
      for (const w of allMockWorkers) {
        const startMsg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(startMsg.config.concurrency).toBeGreaterThanOrEqual(1);
        totalConcurrency += startMsg.config.concurrency ?? 0;
      }
      expect(totalConcurrency).toBe(10);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });

  describe('load-profile meta aggregation', () => {
    it('aggregates currentInFlight and targetConcurrency across workers', async () => {
      const scenarios = makeScenarios(5);
      const config = makeConfig({
        executionMode: 'load-profile' as TestConfig['executionMode'],
        loadProfile: { type: 'sustained', durationSec: 30, maxConcurrency: 10 },
        concurrency: 4,
      });
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(config, scenarios, onProgress);

      const wCount = allMockWorkers.length;
      expect(wCount).toBeGreaterThan(1);

      const meta0 = { elapsedMs: 1000, targetConcurrency: 5, currentInFlight: 3, durationMs: 30000 };
      const meta1 = { elapsedMs: 1200, targetConcurrency: 5, currentInFlight: 4, durationMs: 30000 };
      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 10, total: -1, newResults: [makeResult('lp-0')], meta: meta0,
      });
      allMockWorkers[1].simulateMessage({
        type: 'progress', completed: 8, total: -1, newResults: [makeResult('lp-1')], meta: meta1,
      });

      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(18);
      expect(lastCall[1]).toBe(-1);
      const aggregatedMeta = lastCall[3];
      expect(aggregatedMeta.currentInFlight).toBe(7);
      expect(aggregatedMeta.targetConcurrency).toBe(10);
      expect(aggregatedMeta.elapsedMs).toBe(1200);
      expect(aggregatedMeta.durationMs).toBe(30000);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });

  describe('Tauri HTTP proxy (multi-worker)', () => {
    it('proxies http-request through main-thread httpFetch', async () => {
      mockedIsTauri.mockReturnValue(true);
      mockedHttpFetch.mockResolvedValue({
        status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}',
      });

      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateMessage({
        type: 'http-request', id: 'mw-req-1', url: 'http://api.test', method: 'GET', headers: {},
      });

      await vi.waitFor(() => {
        expect(mockedHttpFetch).toHaveBeenCalledWith('http://api.test', 'GET', {}, undefined);
      });

      await vi.waitFor(() => {
        const resp = allMockWorkers[0].postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
        );
        expect(resp).toBeDefined();
        expect(resp![0].response.status).toBe(200);
      });

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });

    it('sends error response when httpFetch fails', async () => {
      mockedIsTauri.mockReturnValue(true);
      mockedHttpFetch.mockRejectedValue(new Error('Network down'));

      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateMessage({
        type: 'http-request', id: 'mw-req-err', url: 'http://api.test/fail', method: 'POST', headers: {},
      });

      await vi.waitFor(() => {
        const resp = allMockWorkers[0].postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
        );
        expect(resp).toBeDefined();
        expect(resp![0].response.status).toBe(0);
        expect(resp![0].response.error).toBe('Network down');
      });

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });
});
