/**
 * Integration tests for the worker execution path.
 *
 * These tests simulate the full Main ↔ Worker message flow by
 * creating a MockWorker that behaves like the real executionWorker
 * (receives start, posts progress/done, handles abort & http proxy).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestConfig, Scenario, RequestResult } from '../shared/types';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import type { ProgressMeta } from './executor';


vi.mock('../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

// ---------- Mock Worker that simulates engine execution ----------

type MsgHandler = (e: { data: WorkerToMainMessage }) => void;
type ErrHandler = (e: { message: string }) => void;

class SimulatedWorker {
  private msgListeners: MsgHandler[] = [];
  private errListeners: ErrHandler[] = [];
  public postMessage = vi.fn();
  public terminate = vi.fn();
  public scenario: 'normal' | 'error' | 'abort-aware' | 'multi-progress' | 'http-proxy' = 'normal';

  addEventListener(type: string, fn: MsgHandler | ErrHandler) {
    if (type === 'message') this.msgListeners.push(fn as MsgHandler);
    if (type === 'error') this.errListeners.push(fn as ErrHandler);
  }

  removeEventListener(type: string, fn: MsgHandler | ErrHandler) {
    if (type === 'message') this.msgListeners = this.msgListeners.filter(f => f !== fn);
    if (type === 'error') this.errListeners = this.errListeners.filter(f => f !== fn);
  }

  private emit(data: WorkerToMainMessage) {
    this.msgListeners.forEach(fn => fn({ data }));
  }

  /**
   * Called after `runTestInWorker` sends 'start'.
   * Drives the simulated execution based on `this.scenario`.
   */
  async drive() {
    const startMsg = this.postMessage.mock.calls[0]?.[0] as MainToWorkerMessage | undefined;
    if (!startMsg || startMsg.type !== 'start') return;

    switch (this.scenario) {
      case 'normal': {
        const results = this.fakeResults(3);
        this.emit({ type: 'progress', completed: 2, total: 3, newResults: results.slice(0, 2) });
        this.emit({ type: 'done', newResults: results.slice(2) });
        break;
      }
      case 'error': {
        this.emit({ type: 'error', message: 'Engine crashed' });
        break;
      }
      case 'abort-aware': {
        this.emit({ type: 'progress', completed: 1, total: 5, newResults: this.fakeResults(1) });
        // Doesn't send done — waits for abort, then finishes
        break;
      }
      case 'multi-progress': {
        const r = this.fakeResults(6);
        const meta: ProgressMeta = { elapsedMs: 500, targetConcurrency: 3, currentInFlight: 2, durationMs: 5000 };
        this.emit({ type: 'progress', completed: 2, total: 6, newResults: r.slice(0, 2), meta });
        this.emit({ type: 'progress', completed: 4, total: 6, newResults: r.slice(2, 4), meta: { ...meta, elapsedMs: 1000 } });
        this.emit({ type: 'progress', completed: 6, total: 6, newResults: r.slice(4, 6), meta: { ...meta, elapsedMs: 1500 } });
        this.emit({ type: 'done', newResults: [] });
        break;
      }
      case 'http-proxy': {
        // Simulate the worker requesting an HTTP call through the main thread
        this.emit({
          type: 'http-request',
          id: 'proxy-1',
          url: 'http://api.example/data',
          method: 'GET',
          headers: { Accept: 'application/json' },
        } as WorkerToMainMessage);
        // The bridge will post 'http-response' back; we wait for it
        break;
      }
    }
  }

  /** After receiving an http-response, finish the run */
  completeAfterHttpResponse() {
    this.emit({
      type: 'done',
      newResults: this.fakeResults(1),
    });
  }

  finishAfterAbort() {
    this.emit({ type: 'done', newResults: [] });
  }

  private fakeResults(count: number): RequestResult[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `r-${i}`,
      scenarioId: 's1',
      scenarioName: 'Test',
      url: 'http://example.com',
      method: 'GET',
      httpStatus: 200,
      responseTimeMs: 42 + i,
      responseBody: '',
      timestamp: Date.now(),
      passed: true,
      validationMode: 'none' as const,
      failureDetails: [],
    }));
  }
}

let workerInstance: SimulatedWorker;

function WorkerCtor(this: SimulatedWorker) {
  workerInstance = new SimulatedWorker();
  this.postMessage = workerInstance.postMessage;
  this.terminate = workerInstance.terminate;
  this.addEventListener = workerInstance.addEventListener.bind(workerInstance);
  this.removeEventListener = workerInstance.removeEventListener.bind(workerInstance);
  return workerInstance;
}

vi.stubGlobal('Worker', WorkerCtor);

import { runTestInWorker } from './workerBridge';
import { httpFetch } from '../shared/utils/httpClient';
import { isTauri } from '../shared/utils/platform';

const mockedHttpFetch = vi.mocked(httpFetch);
const mockedIsTauri = vi.mocked(isTauri);

function cfg(): TestConfig {
  return { concurrency: 2, totalTransactions: 5, scenarioWeights: [], executionMode: 'batch' };
}
function sc(): Scenario[] {
  return [{ id: 's1', name: 'S', url: 'http://x.com', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } }];
}

describe('Worker Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTauri.mockReturnValue(false);
  });

  it('completes a normal run and accumulates results', async () => {
    workerInstance = undefined as unknown as SimulatedWorker;
    const onProgress = vi.fn();
    const promise = runTestInWorker(cfg(), sc(), onProgress);
    workerInstance.scenario = 'normal';
    await workerInstance.drive();

    const { results } = await promise;
    expect(results).toHaveLength(3);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls[0][0]).toBe(2);
  });

  it('handles multi-progress batches with metadata', async () => {
    const onProgress = vi.fn();
    const promise = runTestInWorker(cfg(), sc(), onProgress);
    workerInstance.scenario = 'multi-progress';
    await workerInstance.drive();

    const { results } = await promise;
    expect(results).toHaveLength(6);
    expect(onProgress).toHaveBeenCalledTimes(3);

    const [, , , meta1] = onProgress.mock.calls[0];
    expect(meta1?.elapsedMs).toBe(500);
    const [, , , meta3] = onProgress.mock.calls[2];
    expect(meta3?.elapsedMs).toBe(1500);

    const thirdResults = onProgress.mock.calls[2][2];
    expect(thirdResults).toHaveLength(6);
  });

  it('rejects on engine error', async () => {
    const promise = runTestInWorker(cfg(), sc(), vi.fn());
    workerInstance.scenario = 'error';
    await workerInstance.drive();

    await expect(promise).rejects.toThrow('Engine crashed');
  });

  it('sends abort and worker finishes gracefully', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const promise = runTestInWorker(cfg(), sc(), onProgress, controller.signal);

    workerInstance.scenario = 'abort-aware';
    await workerInstance.drive();

    expect(onProgress).toHaveBeenCalledTimes(1);

    controller.abort();
    expect(workerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'abort' })
    );

    workerInstance.finishAfterAbort();
    const { results } = await promise;
    expect(results).toHaveLength(1);
  });

  it('proxies HTTP through main thread in Tauri mode', async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedHttpFetch.mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{"data":"yes"}',
    });

    const promise = runTestInWorker(cfg(), sc(), vi.fn());
    workerInstance.scenario = 'http-proxy';
    await workerInstance.drive();

    await vi.waitFor(() => {
      expect(mockedHttpFetch).toHaveBeenCalledWith(
        'http://api.example/data', 'GET', { Accept: 'application/json' }, undefined,
      );
    });

    await vi.waitFor(() => {
      const resp = workerInstance.postMessage.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
      );
      expect(resp).toBeDefined();
      expect(resp![0].response.body).toBe('{"data":"yes"}');
    });

    workerInstance.completeAfterHttpResponse();
    const { results } = await promise;
    expect(results).toHaveLength(1);
  });

  it('handles HTTP proxy failure gracefully', async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedHttpFetch.mockRejectedValue(new Error('Network down'));

    const promise = runTestInWorker(cfg(), sc(), vi.fn());
    workerInstance.scenario = 'http-proxy';
    await workerInstance.drive();

    await vi.waitFor(() => {
      const resp = workerInstance.postMessage.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'http-response'
      );
      expect(resp).toBeDefined();
      expect(resp![0].response.status).toBe(0);
      expect(resp![0].response.error).toBe('Network down');
    });

    workerInstance.completeAfterHttpResponse();
    const { results } = await promise;
    expect(results).toHaveLength(1);
  });
});
