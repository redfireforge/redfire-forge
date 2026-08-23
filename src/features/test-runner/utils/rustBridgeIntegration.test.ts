/**
 * Phase 2D: Integration tests + edge cases for the Rust executor bridge.
 *
 * These tests verify end-to-end behavior of runTestViaRust, abort propagation,
 * circuit breaker integration, fallback correctness, retry edge cases, and
 * ProgressMeta forwarding — all using mocked Tauri IPC.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

let mockInvoke: ReturnType<typeof vi.fn>;
let mockListen: ReturnType<typeof vi.fn>;
let registeredListeners: Record<string, ((event: { payload: unknown }) => void)[]>;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { resetAvailabilityCache, canUseRustExecutor, buildExecutionPlan, mapRustResult, runTestViaRust, startRustLoadTest, type RustProgressBatch, type RustCompletionSummary, type RustExecutionResult, } from './rustBridge';
import { isTauri } from '@shared/utils/platform';
import { Scenario, TestConfig } from '@shared/types';
import { ProgressMeta } from '@engine/core/executor';
import { makeScenario as _makeScenario, makeConfig as _makeConfig } from '@test-utils/factories';

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
    id: 'rr-0',
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

function setupMockIPC() {
  registeredListeners = {};

  mockListen = vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
    if (!registeredListeners[event]) registeredListeners[event] = [];
    registeredListeners[event].push(handler);
    const ref = handler;
    return () => {
      if (registeredListeners[event]) {
        registeredListeners[event] = registeredListeners[event].filter(h => h !== ref);
      }
    };
  });

  mockInvoke = vi.fn(async (cmd: string) => {
    if (cmd === 'is_rust_executor_available') return true;
    if (cmd === 'start_load_test') {
      // Default: will be overridden per test
      return { totalResults: 0, durationMs: 0, breakerTripped: false };
    }
    if (cmd === 'abort_load_test') return undefined;
    return undefined;
  });
}

function emitEvent(name: string, payload: unknown) {
  const listeners = registeredListeners[name] ?? [];
  for (const handler of listeners) {
    handler({ payload });
  }
}

beforeEach(() => {
  resetAvailabilityCache();
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(true);
  setupMockIPC();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── 2D-1: runTestViaRust end-to-end with mocked IPC ──────────── */

describe('runTestViaRust — end-to-end integration', () => {
  it('accumulates results across multiple progress batches', async () => {
    const progressCalls: { completed: number; total: number; resultCount: number }[] = [];

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        // Simulate two progress batches then completion
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 2,
            total: 4,
            results: [makeRustResult({ id: 'rr-0' }), makeRustResult({ id: 'rr-1' })],
            elapsedMs: 50,
            currentInFlight: 2,
            targetConcurrency: 4,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);

        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 4,
            total: 4,
            results: [makeRustResult({ id: 'rr-2' }), makeRustResult({ id: 'rr-3' })],
            elapsedMs: 100,
            currentInFlight: 0,
            targetConcurrency: 4,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 10);

        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 4,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 15);

        return { totalResults: 4, durationMs: 100, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 4, concurrency: 4 });
    const scenarios = [makeScenario()];

    const onProgress = (completed: number, total: number, results: unknown[]) => {
      progressCalls.push({ completed, total, resultCount: results.length });
    };

    const result = await runTestViaRust(config, scenarios, onProgress);

    expect(result.results.length).toBe(4);
    expect(progressCalls.length).toBe(2);
    expect(progressCalls[0].resultCount).toBe(2);
    expect(progressCalls[1].resultCount).toBe(4);
  });

  it('resolves with empty results when plan has 0 iterations', async () => {
    const config = makeConfig({ iterations: 0 });
    const scenarios = [makeScenario()];

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 0,
            durationMs: 1,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 5);
        return { totalResults: 0, durationMs: 1, breakerTripped: false };
      }
      return undefined;
    });

    const result = await runTestViaRust(config, scenarios, vi.fn());
    expect(result.results.length).toBe(0);
  });

  it('rejects when buildExecutionPlan returns null (workflow mode)', async () => {
    const config = makeConfig({ executionMode: 'workflow' });
    const scenarios = [makeScenario()];

    await expect(runTestViaRust(config, scenarios, vi.fn())).rejects.toThrow(
      'Cannot build Rust execution plan',
    );
  });

  it('returns immediately when abortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const config = makeConfig();
    const result = await runTestViaRust(config, [makeScenario()], vi.fn(), controller.signal);
    expect(result.results).toEqual([]);
  });
});

/* ── 2D-2: ProgressMeta forwarding ────────────────────────────── */

describe('ProgressMeta forwarding', () => {
  it('forwards elapsedMs, targetConcurrency, currentInFlight from RustProgressBatch', async () => {
    let capturedMeta: ProgressMeta | undefined;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 1,
            results: [makeRustResult()],
            elapsedMs: 123.45,
            currentInFlight: 3,
            targetConcurrency: 8,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 130,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 130, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1, concurrency: 8 });

    await runTestViaRust(
      config,
      [makeScenario()],
      (_completed, _total, _results, meta) => {
        capturedMeta = meta;
      },
    );

    expect(capturedMeta).toBeDefined();
    expect(capturedMeta!.elapsedMs).toBe(123.45);
    expect(capturedMeta!.targetConcurrency).toBe(8);
    expect(capturedMeta!.currentInFlight).toBe(3);
  });

  it('forwards durationMs from loadProfile config for load-profile mode', async () => {
    let capturedMeta: ProgressMeta | undefined;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: -1,
            results: [makeRustResult()],
            elapsedMs: 500,
            currentInFlight: 2,
            targetConcurrency: 10,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 500,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 500, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'sustained', durationSec: 30, maxConcurrency: 10 },
    });

    await runTestViaRust(
      config,
      [makeScenario()],
      (_completed, _total, _results, meta) => {
        capturedMeta = meta;
      },
    );

    expect(capturedMeta!.durationMs).toBe(30000);
  });

  it('sets total=-1 for load-profile mode progress calls', async () => {
    let capturedTotal = 0;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: -1,
            results: [makeRustResult()],
            elapsedMs: 100,
            currentInFlight: 1,
            targetConcurrency: 5,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 100, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'sustained', durationSec: 5, maxConcurrency: 5 },
    });

    await runTestViaRust(
      config,
      [makeScenario()],
      (_completed, total) => { capturedTotal = total; },
    );

    expect(capturedTotal).toBe(-1);
  });
});

/* ── 2D-3: Abort signal propagation ───────────────────────────── */

describe('abort signal propagation', () => {
  it('calls abortRustLoadTest when AbortSignal fires during execution', async () => {
    const controller = new AbortController();
    let abortCalled = false;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'abort_load_test') {
        abortCalled = true;
        return undefined;
      }
      if (cmd === 'start_load_test') {
        // Simulate a long-running test. Abort will fire before completion.
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 100,
            results: [makeRustResult()],
            elapsedMs: 50,
            currentInFlight: 4,
            targetConcurrency: 4,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        // Abort fires at 20ms, completion at 30ms (simulates fast abort)
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 30,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 30);
        return { totalResults: 1, durationMs: 30, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 100 });
    const resultPromise = runTestViaRust(config, [makeScenario()], vi.fn(), controller.signal);

    // Abort after 20ms
    setTimeout(() => controller.abort(), 20);

    const result = await resultPromise;
    expect(abortCalled).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(1);
  });

  it('removes abort listener after completion', async () => {
    const controller = new AbortController();

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 0,
            durationMs: 10,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 5);
        return { totalResults: 0, durationMs: 10, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 0 });
    await runTestViaRust(config, [makeScenario()], vi.fn(), controller.signal);

    // Aborting after completion should NOT call abort_load_test
    mockInvoke.mockClear();
    controller.abort();
    await new Promise(r => setTimeout(r, 10));
    const abortCalls = mockInvoke.mock.calls.filter(c => c[0] === 'abort_load_test');
    expect(abortCalls.length).toBe(0);
  });
});

/* ── 2D-4: Circuit breaker integration ────────────────────────── */

describe('circuit breaker integration', () => {
  it('stop-threshold circuit breaker maps maxErrorRate from percent to fraction', () => {
    const config = makeConfig({
      errorPolicy: 'stop-threshold',
      maxErrors: 10,
      maxErrorRate: 75,
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toEqual({
      policy: 'stop-threshold',
      maxErrors: 10,
      maxErrorRate: 0.75,
      minSampleSize: 10,
    });
  });

  it('stop-threshold with maxErrorRate=0 maps to 0.0 fraction', () => {
    const config = makeConfig({
      errorPolicy: 'stop-threshold',
      maxErrorRate: 0,
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.circuitBreaker.policy === 'stop-threshold') {
      expect(plan.circuitBreaker.maxErrorRate).toBe(0);
    }
  });

  it('stop-threshold with maxErrorRate=100 maps to 1.0 fraction', () => {
    const config = makeConfig({
      errorPolicy: 'stop-threshold',
      maxErrorRate: 100,
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.circuitBreaker.policy === 'stop-threshold') {
      expect(plan.circuitBreaker.maxErrorRate).toBe(1.0);
    }
  });

  it('breaker-tripped progress batch is properly received', async () => {
    let breakerSeen = false;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 10,
            results: [makeRustResult({ httpStatus: 0, errorMessage: 'Connection refused' })],
            elapsedMs: 50,
            currentInFlight: 0,
            targetConcurrency: 4,
            breakerTripped: true,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 55,
            breakerTripped: true,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 55, breakerTripped: true };
      }
      return undefined;
    });

    const config = makeConfig({
      iterations: 10,
      errorPolicy: 'stop-first',
    });

    await runTestViaRust(
      config,
      [makeScenario()],
      (_completed, _total, results) => {
        if (results.some(r => !r.passed)) breakerSeen = true;
      },
    );

    expect(breakerSeen).toBe(true);
  });
});

/* ── 2D-5: Fallback correctness ───────────────────────────────── */

describe('fallback correctness', () => {
  it('canUseRustExecutor returns true for digest auth (not OAuth2)', () => {
    const scenarios = [makeScenario({
      auth: { type: 'digest', username: 'u', password: 'p' },
    })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('canUseRustExecutor returns true for inherit auth', () => {
    const scenarios = [makeScenario({ auth: { type: 'inherit' } })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('canUseRustExecutor returns true for none auth', () => {
    const scenarios = [makeScenario({ auth: { type: 'none' } })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('canUseRustExecutor returns false for mixed auth with one OAuth2', () => {
    const scenarios = [
      makeScenario({ id: 'sc-1', auth: { type: 'basic', username: 'u', password: 'p' } }),
      makeScenario({ id: 'sc-2', auth: { type: 'bearer', token: 'tok' } }),
      makeScenario({ id: 'sc-3', auth: { type: 'oauth2' } }),
    ];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(false);
  });

  it('canUseRustExecutor returns true for batch mode', () => {
    const config = makeConfig({ executionMode: 'batch' });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(true);
  });

  it('buildExecutionPlan maps batch → pool', () => {
    const config = makeConfig({ executionMode: 'batch', concurrency: 3 });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('pool');
  });

  it('runTestViaRust rejects for workflow mode', async () => {
    const config = makeConfig({ executionMode: 'workflow' });
    await expect(runTestViaRust(config, [makeScenario()], vi.fn()))
      .rejects.toThrow('Cannot build Rust execution plan');
  });

  it('startRustLoadTest calls onError when invoke fails (deserialization error)', async () => {
    const onError = vi.fn();
    const onComplete = vi.fn();

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'start_load_test') {
        throw new Error('invalid type: null, expected struct');
      }
      return undefined;
    });

    await startRustLoadTest(
      {
        mode: 'pool',
        scenarios: [],
        concurrency: 1,
        timeoutMs: 0,
        retryCount: 0,
        retryDelayMs: 0,
        thinkTime: { type: 'none' },
        circuitBreaker: { policy: 'continue' },
      },
      vi.fn(),
      onComplete,
      onError,
    );

    // Give async catch time to fire
    await new Promise(r => setTimeout(r, 20));

    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

/* ── 2D-6: Retry behavior edge cases ─────────────────────────── */

describe('retry behavior edge cases', () => {
  it('retry succeeded: retryCount > 0 but passed → no retry message appended', () => {
    const rustResult = makeRustResult({ retryCount: 2, httpStatus: 200 });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.passed).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('retry exhausted: retryCount > 0 and failed → retry message appended', () => {
    const rustResult = makeRustResult({
      retryCount: 3,
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'connection reset',
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('4 attempts');
    expect(result.errorMessage).toContain('connection reset');
  });

  it('retryCount=0 with failure → no retry info in error message', () => {
    const rustResult = makeRustResult({
      retryCount: 0,
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'DNS lookup failed',
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('DNS lookup failed');
    expect(result.errorMessage).not.toContain('attempts');
  });

  it('retryCount config maps to execution plan correctly', () => {
    const config = makeConfig({ retryCount: 5, retryDelayMs: 500 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.retryCount).toBe(5);
    expect(plan.retryDelayMs).toBe(500);
  });

  it('defaults retryCount to 0 and retryDelayMs to 1000 when undefined', () => {
    const config = makeConfig();
    delete config.retryCount;
    delete config.retryDelayMs;
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.retryCount).toBe(0);
    expect(plan.retryDelayMs).toBe(1000);
  });
});

/* ── 2D-7: Scenario lookup and data row matching ─────────────── */

describe('scenario lookup for data-row-expanded results', () => {
  it('matches expanded scenario by composite key (scenarioId::dataRowId)', async () => {
    const parentScenario = makeScenario({
      id: 'sc-1',
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 1,
            results: [makeRustResult({
              scenarioId: 'sc-1',
              dataRowId: 'row-1',
              responseBody: '{"ok":true}',
            })],
            elapsedMs: 50,
            currentInFlight: 0,
            targetConcurrency: 1,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 55,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 55, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [parentScenario], vi.fn());

    expect(result.results.length).toBe(1);
    expect(result.results[0].validationMode).toBe('full');
    expect(result.results[0].passed).toBe(true);
  });

  it('falls back to scenarioId lookup when dataRowId composite not found', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 1,
            results: [makeRustResult({
              scenarioId: 'sc-1',
              dataRowId: 'row-unknown',
              httpStatus: 200,
            })],
            elapsedMs: 50,
            currentInFlight: 0,
            targetConcurrency: 1,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 55,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 55, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());

    expect(result.results.length).toBe(1);
    expect(result.results[0].passed).toBe(true);
  });

  it('uses mapRustResultWithoutValidation for unknown scenario IDs', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 1,
            results: [makeRustResult({
              scenarioId: 'unknown-id',
              httpStatus: 200,
            })],
            elapsedMs: 50,
            currentInFlight: 0,
            targetConcurrency: 1,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 55,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 55, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());

    expect(result.results.length).toBe(1);
    expect(result.results[0].validationMode).toBe('none');
    expect(result.results[0].passed).toBe(true);
  });

  it('matches data-source expanded row via composite lookup key', async () => {
    const parentScenario = makeScenario({
      id: 'sc-ds',
      validation: { mode: 'full', expectedJson: '{"vin":"ABC123"}' },
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'vin', name: 'VIN', type: 'path', mapping: 'vin' }],
        rows: [
          { id: 'row-1', label: 'Row 1', values: { vin: 'ABC123' }, enabled: true },
        ],
        source: { type: 'inline' },
      },
    });

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        setTimeout(() => {
          emitEvent('load-test-progress', {
            completed: 1,
            total: 1,
            results: [makeRustResult({
              scenarioId: 'sc-ds',
              dataRowId: 'row-1',
              responseBody: '{"vin":"ABC123"}',
            })],
            elapsedMs: 50,
            currentInFlight: 0,
            targetConcurrency: 1,
            breakerTripped: false,
          } satisfies RustProgressBatch);
        }, 5);
        setTimeout(() => {
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 55,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        }, 10);
        return { totalResults: 1, durationMs: 55, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [parentScenario], vi.fn());

    expect(result.results.length).toBe(1);
    expect(result.results[0].dataRowId).toBe('row-1');
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].validationMode).toBe('full');
  });
});

/* ── 2D-8: Load profile plan construction ─────────────────────── */
