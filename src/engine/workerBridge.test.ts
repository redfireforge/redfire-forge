/**
 * Single-worker bridge tests: `runTestInWorker` + `getWorkerCount`.
 *
 * Multi-worker coverage (`runTestMultiWorker`) lives in
 * `workerBridge.multiWorker.test.ts`. Shared MockWorker + factories live in
 * `__test-utils__/workerBridgeMocks.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MainToWorkerMessage } from './workerProtocol';
import {
  MockWorker,
  createWorkerCtor,
  makeConfig,
  makeScenario,
  makeResult,
  type WorkerTracker,
} from './__test-utils__/workerBridgeMocks';

vi.mock('../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const tracker: WorkerTracker = { current: undefined, all: [] };
vi.stubGlobal('Worker', createWorkerCtor(tracker));

import { runTestInWorker, getWorkerCount } from './workerBridge';
import { httpFetch } from '../shared/utils/httpClient';
import { isTauri } from '../shared/utils/platform';

const mockedHttpFetch = vi.mocked(httpFetch);
const mockedIsTauri = vi.mocked(isTauri);

function mockWorker(): MockWorker {
  if (!tracker.current) throw new Error('No worker was spawned');
  return tracker.current;
}

describe('workerBridge — runTestInWorker', () => {
  beforeEach(() => {
    resetAllMocks();
    tracker.all.length = 0;
    tracker.current = undefined;
    mockedIsTauri.mockReturnValue(false);
  });

  it('creates a Worker and sends start message', async () => {
    const config = makeConfig();
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    const promise = runTestInWorker(config, scenarios, onProgress);

    expect(mockWorker().postMessage).toHaveBeenCalledTimes(1);
    const startMsg = mockWorker().getStartMessage();
    expect(startMsg).toBeDefined();
    expect(startMsg!.type).toBe('start');
    const startData = startMsg as Extract<MainToWorkerMessage, { type: 'start' }>;
    expect(startData.useTauriProxy).toBe(false);
    expect(startData.config).toEqual(config);
    expect(startData.scenarios).toEqual(scenarios);

    mockWorker().simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('sets useTauriProxy=true when running in Tauri', async () => {
    mockedIsTauri.mockReturnValue(true);
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

    const startMsg = mockWorker().getStartMessage();
    expect((startMsg as Extract<MainToWorkerMessage, { type: 'start' }>).useTauriProxy).toBe(true);

    mockWorker().simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('resolves with accumulated results from progress + done', async () => {
    const onProgress = vi.fn();
    const promise = runTestInWorker(makeConfig(), [makeScenario()], onProgress);

    const r1 = makeResult('r1');
    const r2 = makeResult('r2');
    const r3 = makeResult('r3');

    mockWorker().simulateMessage({
      type: 'progress', completed: 2, total: 3, newResults: [r1, r2],
    });

    expect(onProgress).toHaveBeenCalledWith(2, 3, [r1, r2], undefined);

    mockWorker().simulateMessage({
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
    mockWorker().simulateMessage({
      type: 'progress', completed: 1, total: 5, newResults: [makeResult('r1')], meta,
    });

    expect(onProgress).toHaveBeenCalledWith(1, 5, expect.arrayContaining([expect.objectContaining({ id: 'r1' })]), meta);

    mockWorker().simulateMessage({
      type: 'progress', completed: 3, total: 5, newResults: [makeResult('r2'), makeResult('r3')],
    });

    const secondCall = onProgress.mock.calls[1];
    expect(secondCall[2]).toHaveLength(3);

    mockWorker().simulateMessage({ type: 'done', newResults: [] });
    await promise;
  });

  it('rejects with error message on worker error message', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateMessage({ type: 'error', message: 'Something broke' });
    await expect(promise).rejects.toThrow('Something broke');
  });

  it('rejects and cleans up on Worker global error event', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateError('Script error');
    await expect(promise).rejects.toThrow('Script error');
    expect(mockWorker().terminate).toHaveBeenCalled();
  });

  it('terminates worker after done', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateMessage({ type: 'done', newResults: [] });
    await promise;
    expect(mockWorker().terminate).toHaveBeenCalled();
  });

  it('terminates worker after error', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateMessage({ type: 'error', message: 'fail' });
    await promise.catch(() => {});
    expect(mockWorker().terminate).toHaveBeenCalled();
  });

  describe('abort', () => {
    it('sends abort message when abortSignal fires', async () => {
      const controller = new AbortController();
      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn(), controller.signal);

      controller.abort();

      expect(mockWorker().postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'abort' }),
      );

      mockWorker().simulateMessage({ type: 'done', newResults: [] });
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

      mockWorker().simulateMessage({
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
          { 'Content-Type': 'application/json' }, '{}',
        );
      });

      await vi.waitFor(() => {
        const responseCall = mockWorker().postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
        );
        expect(responseCall).toBeDefined();
        expect(responseCall![0].id).toBe('req-1');
        expect(responseCall![0].response.status).toBe(200);
      });

      mockWorker().simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('sends error response when httpFetch throws', async () => {
      mockedHttpFetch.mockRejectedValue(new Error('Connection refused'));

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

      mockWorker().simulateMessage({
        type: 'http-request',
        id: 'req-2',
        url: 'http://api.test/fail',
        method: 'GET',
        headers: {},
      });

      await vi.waitFor(() => {
        const responseCall = mockWorker().postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
        );
        expect(responseCall).toBeDefined();
        expect(responseCall![0].response.status).toBe(0);
        expect(responseCall![0].response.error).toBe('Connection refused');
      });

      mockWorker().simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });

  it('ignores duplicate done/error after settlement', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateMessage({ type: 'done', newResults: [makeResult('r1')] });
    const { results } = await promise;
    expect(results).toHaveLength(1);
    mockWorker().simulateMessage({ type: 'done', newResults: [makeResult('r2')] });
  });

  it('ignores Worker global error after settlement', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateMessage({ type: 'done', newResults: [] });
    await promise;
    mockWorker().simulateError('late crash');
  });

  it('uses fallback message for empty Worker error event', async () => {
    const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());
    mockWorker().simulateError('');
    await expect(promise).rejects.toThrow('Worker failed to initialize');
  });

  describe('HTTP proxy non-Error rejection', () => {
    it('stringifies non-Error throw from httpFetch', async () => {
      mockedIsTauri.mockReturnValue(true);
      mockedHttpFetch.mockRejectedValue('string rejection');

      const promise = runTestInWorker(makeConfig(), [makeScenario()], vi.fn());

      mockWorker().simulateMessage({
        type: 'http-request',
        id: 'req-str',
        url: 'http://a.test',
        method: 'GET',
        headers: {},
      });

      await vi.waitFor(() => {
        const resp = mockWorker().postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
        );
        expect(resp).toBeDefined();
        expect(resp![0].response.error).toBe('string rejection');
      });

      mockWorker().simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });
});

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
