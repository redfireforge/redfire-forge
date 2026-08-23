/**
 * Multi-worker bridge tests: `runTestMultiWorker` only.
 *
 * Single-worker bridge + `getWorkerCount` coverage lives in
 * `workerBridge.test.ts`. Shared MockWorker + factories live in
 * `__test-utils__/workerBridgeMocks.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestConfig, LoadProfileConfig, Scenario } from '@shared/types';
import type { MainToWorkerMessage } from './workerProtocol';
import {
  createWorkerCtor,
  makeConfig,
  makeScenario,
  makeResult,
  type WorkerTracker,
} from './__test-utils__/workerBridgeMocks';

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('@shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const tracker: WorkerTracker = { current: undefined, all: [] };
vi.stubGlobal('Worker', createWorkerCtor(tracker));

import { runTestMultiWorker } from './workerBridge';
import { httpFetch } from '@shared/utils/httpClient';
import { isTauri } from '@shared/utils/platform';

const mockedHttpFetch = vi.mocked(httpFetch);
const mockedIsTauri = vi.mocked(isTauri);

const allMockWorkers = tracker.all;

describe('workerBridge — runTestMultiWorker', () => {
  beforeEach(() => {
    resetAllMocks();
    tracker.all.length = 0;
    tracker.current = undefined;
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
      expect(firstCall[1]).toBe(5);

      if (workerCount > 1) {
        allMockWorkers[1].simulateMessage({
          type: 'progress', completed: 3, total: 5, newResults: [makeResult('w1-r1')],
        });
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
      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      allMockWorkers[workerCount - 1].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('uses totalConcurrency for meta in non-load-profile mode', async () => {
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress);

      const meta = { elapsedMs: 500, targetConcurrency: 2, currentInFlight: 2, durationMs: 0 };
      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 2, total: 5, newResults: [makeResult('r1')], meta,
      });

      const call = onProgress.mock.calls[0];
      const aggregatedMeta = call[3];
      expect(aggregatedMeta.targetConcurrency).toBe(4);
      expect(aggregatedMeta.currentInFlight).toBe(4);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
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
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'abort',
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
      await expect(promise).rejects.toThrow('Worker failed to initialize');
    });

    it('uses filename in error message when message is empty but filename exists', async () => {
      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());

      allMockWorkers[0].simulateError('', '/path/to/worker.ts');
      await expect(promise).rejects.toThrow('Failed to load worker module: /path/to/worker.ts');
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
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'abort',
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

    it('aborts all workers when signal fires during progress (not settled)', async () => {
      const controller = new AbortController();
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress, controller.signal);

      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 2, total: 5, newResults: [makeResult('r1')],
      });
      expect(onProgress).toHaveBeenCalled();

      controller.abort();

      for (const w of allMockWorkers) {
        const abortCall = w.postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'abort',
        );
        expect(abortCall).toBeDefined();
      }

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
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
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
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
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
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

    it('routes http-response only to the originating worker, not broadcast', async () => {
      mockedIsTauri.mockReturnValue(true);
      mockedHttpFetch.mockResolvedValue({
        status: 200, statusText: 'OK', headers: {}, body: '{"routed":true}',
      });

      const scenarios = makeScenarios(10);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, vi.fn());
      expect(allMockWorkers.length).toBeGreaterThan(1);

      allMockWorkers[1].simulateMessage({
        type: 'http-request', id: 'iso-req', url: 'http://api.test/iso', method: 'GET', headers: {},
      });

      await vi.waitFor(() => {
        const resp = allMockWorkers[1].postMessage.mock.calls.find(
          (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
        );
        expect(resp).toBeDefined();
        expect(resp![0].id).toBe('iso-req');
      });

      const w0Responses = allMockWorkers[0].postMessage.mock.calls.filter(
        (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response',
      );
      expect(w0Responses).toHaveLength(0);

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      await promise;
    });
  });

  describe('PR4 scenario-specific audits', () => {
    it('Scenario 1/9: 13 tests on N=7 machine produces K=7 workers with correct chunks', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(13);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 10 }), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(7);
      const chunkSizes = allMockWorkers.map((w) => {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        return msg.scenarios.length;
      });
      expect(chunkSizes).toEqual([2, 2, 2, 2, 2, 2, 1]);
      expect(chunkSizes.reduce((a, b) => a + b, 0)).toBe(13);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 9: 14 tests on N=7 produces 7 workers each with 2 tests', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(14);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 10 }), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(7);
      for (const w of allMockWorkers) {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        expect(msg.scenarios).toHaveLength(2);
      }

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 9: 15 tests on N=7 produces 5 workers (chunkSize=3)', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(15);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 10 }), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(5);
      const chunkSizes = allMockWorkers.map((w) => {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        return msg.scenarios.length;
      });
      expect(chunkSizes).toEqual([3, 3, 3, 3, 3]);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 6: 8 tests on N=7 produces K=4 workers', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(8);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 5 }), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(4);
      const chunkSizes = allMockWorkers.map((w) => {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        return msg.scenarios.length;
      });
      expect(chunkSizes).toEqual([2, 2, 2, 2]);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 6: 7 tests falls back to single worker', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(7);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 5 }), scenarios, vi.fn());

      expect(allMockWorkers).toHaveLength(1);

      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 8: concurrency=50 across 7 workers sums to exactly 50', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(20);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 50 }), scenarios, vi.fn());

      const workerConcurrencies = allMockWorkers.map((w) => {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        return msg.config.concurrency ?? 0;
      });
      expect(workerConcurrencies.reduce((a, b) => a + b, 0)).toBe(50);
      expect(Math.max(...workerConcurrencies) - Math.min(...workerConcurrencies)).toBeLessThanOrEqual(1);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 3: progress aggregation never exceeds total and never goes backward', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress);

      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 2, total: 4, newResults: [makeResult('p1'), makeResult('p2')],
      });
      allMockWorkers[1].simulateMessage({
        type: 'progress', completed: 1, total: 4, newResults: [makeResult('p3')],
      });
      if (allMockWorkers[2]) {
        allMockWorkers[2].simulateMessage({
          type: 'progress', completed: 3, total: 2, newResults: [makeResult('p4'), makeResult('p5'), makeResult('p6')],
        });
      }

      let prevCompleted = -1;
      for (const call of onProgress.mock.calls) {
        const completed = call[0] as number;
        const total = call[1] as number;
        expect(completed).toBeGreaterThanOrEqual(prevCompleted);
        if (total > 0) expect(completed).toBeLessThanOrEqual(total);
        prevCompleted = completed;
      }

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 1: all scenario IDs are preserved across workers (no duplicates, no drops)', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(13);
      const originalIds = scenarios.map((s) => s.id);
      const promise = runTestMultiWorker(makeConfig({ concurrency: 10 }), scenarios, vi.fn());

      const distributedIds: string[] = [];
      for (const w of allMockWorkers) {
        const msg = w.getStartMessage() as Extract<MainToWorkerMessage, { type: 'start' }>;
        distributedIds.push(...msg.scenarios.map((s) => s.id));
      }
      expect(distributedIds.sort()).toEqual(originalIds.sort());
      expect(new Set(distributedIds).size).toBe(13);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });

    it('Scenario 4: abort after partial results preserves those results', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      const controller = new AbortController();
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress, controller.signal);

      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 2, total: 5, newResults: [makeResult('partial-1'), makeResult('partial-2')],
      });

      expect(onProgress).toHaveBeenCalled();
      const partialResults = onProgress.mock.calls[0][2];
      expect(partialResults).toHaveLength(2);

      controller.abort();

      for (const w of allMockWorkers) {
        w.simulateMessage({ type: 'done', newResults: [] });
      }
      const { results } = await promise;
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('partial-1');
      expect(results[1].id).toBe('partial-2');
    });

    it('Scenario 5: error results from workers flow through normal aggregation', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      const scenarios = makeScenarios(10);
      const onProgress = vi.fn();
      const promise = runTestMultiWorker(makeConfig({ concurrency: 4 }), scenarios, onProgress);

      const errorResult = makeResult('err-1', false);
      allMockWorkers[0].simulateMessage({
        type: 'progress', completed: 1, total: 5, newResults: [errorResult],
      });

      expect(onProgress).toHaveBeenCalled();
      const results = onProgress.mock.calls[0][2];
      expect(results).toHaveLength(1);
      expect(results[0].httpStatus).toBe(500);

      for (const w of allMockWorkers) w.simulateMessage({ type: 'done', newResults: [] });
      const { results: finalResults } = await promise;
      expect(finalResults.some((r: { httpStatus: number }) => r.httpStatus === 500)).toBe(true);
    });

    it('Scenario 7: workflow with high iterations still uses single worker', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      const scenarios = makeScenarios(20);
      const workflow = { id: 'wf1', name: 'test', nodes: [], edges: [], variables: {} } as never;
      const config = makeConfig({ concurrency: 20, iterations: 100 });
      const promise = runTestMultiWorker(config, scenarios, vi.fn(), undefined, workflow);

      expect(allMockWorkers).toHaveLength(1);

      allMockWorkers[0].simulateMessage({ type: 'done', newResults: [] });
      await promise;
    });
  });
});
