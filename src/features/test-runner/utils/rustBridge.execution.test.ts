import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { abortRustLoadTest, startRustLoadTest, runTestViaRust, RustProgressBatch, RustCompletionSummary, RustFinalResults } from './rustBridge';
import { RustExecutionResult } from './rustBridge';
import { isTauri } from '@shared/utils/platform';
import { Scenario, TestConfig } from '@shared/types';
import { makeScenario as _makeScenario, makeConfig as _makeConfig } from '../../../test-utils/factories';

const mockIsTauri = vi.mocked(isTauri);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
    ...overrides,
  });
}

function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return _makeConfig({
    concurrency: 4,
    executionMode: 'pool',
    ...overrides,
  });
}

function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
  return {
    id: 'r-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 42.5,
    responseBody: '{"ok":true}',
    responseHeaders: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    requestLog: { headers: { 'X-Custom': 'test' }, body: null },
    timing: { dnsLookup: 1, tcpConnect: 2, tlsHandshake: 3, ttfb: 30, download: 5, total: 41 },
    retryCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

/* ── abortRustLoadTest ───────────────────────────────────────────── */

describe('abortRustLoadTest', () => {
  it('is a no-op when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    await expect(abortRustLoadTest()).resolves.toBeUndefined();
  });
});

/* ── startRustLoadTest ───────────────────────────────────────────── */

describe('startRustLoadTest', () => {
  it('throws when not in Tauri and no onError', async () => {
    mockIsTauri.mockReturnValue(false);
    await expect(startRustLoadTest(
      { mode: 'pool', scenarios: [], concurrency: 1, timeoutMs: 0, retryCount: 0, retryDelayMs: 0, thinkTime: { type: 'none' }, circuitBreaker: { policy: 'continue' } },
      () => {},
      () => {},
    )).rejects.toThrow('startRustLoadTest called outside Tauri');
  });

  it('calls onError when not in Tauri and onError provided', async () => {
    mockIsTauri.mockReturnValue(false);
    const onError = vi.fn();
    const result = await startRustLoadTest(
      { mode: 'pool', scenarios: [], concurrency: 1, timeoutMs: 0, retryCount: 0, retryDelayMs: 0, thinkTime: { type: 'none' }, circuitBreaker: { policy: 'continue' } },
      () => {},
      () => {},
      onError,
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(result.unlisten).toBeTypeOf('function');
  });
});

/* ── runTestViaRust ──────────────────────────────────────────────── */

describe('runTestViaRust', () => {
  type ListenerCallback<T> = (event: { payload: T }) => void;
  let progressCallback: ListenerCallback<RustProgressBatch> | null = null;
  let completeCallback: ListenerCallback<RustCompletionSummary> | null = null;
  let finalResultsCallback: ListenerCallback<RustFinalResults> | null = null;
  let _invokePromiseResolve: ((v: unknown) => void) | null = null;
  let _invokePromiseReject: ((e: Error) => void) | null = null;

  const mockListen = vi.fn(async <T>(event: string, callback: ListenerCallback<T>) => {
    if (event === 'load-test-progress') {
      progressCallback = callback as ListenerCallback<RustProgressBatch>;
    } else if (event === 'load-test-complete') {
      completeCallback = callback as ListenerCallback<RustCompletionSummary>;
    } else if (event === 'load-test-final-results') {
      finalResultsCallback = callback as ListenerCallback<RustFinalResults>;
    }
    return () => {};
  });

  const mockInvoke = vi.fn(() => new Promise((resolve, reject) => {
    _invokePromiseResolve = resolve;
    _invokePromiseReject = reject;
  }));

  beforeEach(() => {
    progressCallback = null;
    completeCallback = null;
    finalResultsCallback = null;
    _invokePromiseResolve = null;
    _invokePromiseReject = null;
    mockListen.mockClear();
    mockInvoke.mockClear();

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: mockInvoke,
    }));
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: mockListen,
    }));
  });

  it('returns early with empty results when abortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const config = makeConfig();
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    mockIsTauri.mockReturnValue(true);
    const result = await runTestViaRust(config, scenarios, onProgress, controller.signal);

    expect(result.results).toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('rejects when buildExecutionPlan returns null (workflow mode)', async () => {
    const config = makeConfig({ executionMode: 'workflow' });
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    mockIsTauri.mockReturnValue(true);
    await expect(runTestViaRust(config, scenarios, onProgress)).rejects.toThrow('Cannot build Rust execution plan');
  });

  it('handles progress batch with droppedRequests field', async () => {
    mockIsTauri.mockReturnValue(true);

    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: { targetRps: 100, durationSec: 10 },
    });
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    const promise = runTestViaRust(config, scenarios, onProgress);

    await vi.waitFor(() => expect(progressCallback).not.toBeNull());

    const rustResult = makeRustResult({ scenarioId: scenarios[0].id });
    progressCallback!({
      payload: {
        completed: 5,
        total: -1,
        results: [rustResult],
        elapsedMs: 1000,
        currentInFlight: 10,
        targetConcurrency: 50,
        breakerTripped: false,
        targetRps: 100,
        actualRps: 95,
        droppedRequests: 3,
      },
    });

    expect(onProgress).toHaveBeenCalled();
    const call = onProgress.mock.calls[0];
    const meta = call[3];
    expect(meta.droppedRequests).toBe(3);
    expect(meta.targetRps).toBe(100);
    expect(meta.actualRps).toBe(95);

    completeCallback!({ payload: { totalResults: 5, durationMs: 1000, breakerTripped: false } });
    const result = await promise;
    expect(result.results.length).toBe(1);
  });

  it('handles final-results event that replaces all results', async () => {
    mockIsTauri.mockReturnValue(true);

    const config = makeConfig({ executionMode: 'pool' });
    const scenarios = [makeScenario()];
    const onProgress = vi.fn();

    const promise = runTestViaRust(config, scenarios, onProgress);

    await vi.waitFor(() => expect(finalResultsCallback).not.toBeNull());

    const rustResult1 = makeRustResult({ id: 'r-1', scenarioId: scenarios[0].id });
    progressCallback!({
      payload: {
        completed: 1,
        total: 2,
        results: [rustResult1],
        elapsedMs: 500,
        currentInFlight: 1,
        targetConcurrency: 4,
        breakerTripped: false,
      },
    });

    const finalResult = makeRustResult({ id: 'r-final', scenarioId: scenarios[0].id });
    finalResultsCallback!({
      payload: { results: [finalResult] },
    });

    completeCallback!({ payload: { totalResults: 1, durationMs: 1000, breakerTripped: false } });
    const result = await promise;

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe('r-final');
  });

  it('uses mapRustResultWithoutValidation when scenario not found in lookup', async () => {
    mockIsTauri.mockReturnValue(true);

    const config = makeConfig({ executionMode: 'pool' });
    const scenarios = [makeScenario({ id: 'sc-known' })];
    const onProgress = vi.fn();

    const promise = runTestViaRust(config, scenarios, onProgress);

    await vi.waitFor(() => expect(progressCallback).not.toBeNull());

    const unknownResult = makeRustResult({ id: 'r-unknown', scenarioId: 'sc-unknown' });
    progressCallback!({
      payload: {
        completed: 1,
        total: 1,
        results: [unknownResult],
        elapsedMs: 100,
        currentInFlight: 0,
        targetConcurrency: 1,
        breakerTripped: false,
      },
    });

    completeCallback!({ payload: { totalResults: 1, durationMs: 100, breakerTripped: false } });
    const result = await promise;

    expect(result.results.length).toBe(1);
    expect(result.results[0].scenarioId).toBe('sc-unknown');
  });
});
