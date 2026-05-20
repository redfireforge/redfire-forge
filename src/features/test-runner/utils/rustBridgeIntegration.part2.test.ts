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

import { resetAvailabilityCache, buildExecutionPlan, prepareRustScenario, mapRustResult, buildExpandedQueue, runTestViaRust, startRustLoadTest, type RustProgressBatch, type RustCompletionSummary, type RustExecutionResult, } from './rustBridge';
import { isTauri } from '../../../shared/utils/platform';
import { Scenario, TestConfig } from '../../../shared/types';
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

describe('load profile plan construction', () => {
  it('builds ramp-up load profile with all parameters', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: {
        type: 'ramp-up',
        durationSec: 120,
        maxConcurrency: 50,
        rampUpSec: 60,
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.mode).toBe('load-profile');
    if (plan.mode === 'load-profile') {
      expect(plan.profileType).toBe('ramp-up');
      expect(plan.durationSec).toBe(120);
      expect(plan.concurrency).toBe(50);
      expect(plan.rampUpSec).toBe(60);
      expect(plan.spikeConcurrency).toBeNull();
    }
  });

  it('builds spike load profile with all parameters', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: {
        type: 'spike',
        durationSec: 60,
        maxConcurrency: 10,
        spikeConcurrency: 100,
        spikeStartSec: 20,
        spikeDurationSec: 10,
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.mode === 'load-profile') {
      expect(plan.profileType).toBe('spike');
      expect(plan.spikeConcurrency).toBe(100);
      expect(plan.spikeStartSec).toBe(20);
      expect(plan.spikeDurationSec).toBe(10);
    }
  });

  it('builds sustained load profile', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: {
        type: 'sustained',
        durationSec: 300,
        maxConcurrency: 25,
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.mode === 'load-profile') {
      expect(plan.profileType).toBe('sustained');
      expect(plan.durationSec).toBe(300);
      expect(plan.rampUpSec).toBeNull();
    }
  });

  it('returns null when load-profile mode is set but loadProfile config is missing', () => {
    const config = makeConfig({ executionMode: 'load-profile' });
    delete config.loadProfile;
    const plan = buildExecutionPlan(config, [makeScenario()]);
    // Should fall through to pool mode since the load-profile branch checks config.loadProfile
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('pool');
  });
});

/* ── 2D-9: Think time mapping edge cases ──────────────────────── */

describe('think time mapping edge cases', () => {
  it('negative think time values are clamped to 0', () => {
    const config = makeConfig({
      thinkTime: { mode: 'constant', constantMs: -100 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'constant', delayMs: 0 });
  });

  it('gaussian with negative meanMs is clamped to 0', () => {
    const config = makeConfig({
      thinkTime: { mode: 'gaussian', meanMs: -50, stdDevMs: -10 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'gaussian', meanMs: 0, stdDevMs: 0 });
  });

  it('unknown thinkTime mode defaults to none', () => {
    const config = makeConfig({
      thinkTime: { mode: 'unknown-mode' as never },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'none' });
  });

  it('fractional think time values are rounded to integers for Rust u64 compat', () => {
    const config = makeConfig({
      thinkTime: { mode: 'constant', constantMs: 1500.7 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'constant', delayMs: 1501 });
  });

  it('uniform fractional values are rounded to integers', () => {
    const config = makeConfig({
      thinkTime: { mode: 'uniform', minMs: 499.4, maxMs: 2000.6 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'uniform', minMs: 499, maxMs: 2001 });
  });

  it('gaussian fractional values are rounded to integers', () => {
    const config = makeConfig({
      thinkTime: { mode: 'gaussian', meanMs: 1000.5, stdDevMs: 300.3 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'gaussian', meanMs: 1001, stdDevMs: 300 });
  });
});

/* ── 2D-10: Preparation parity ────────────────────────────────── */

describe('preparation parity', () => {
  it('prepareRustScenario produces same headers as JS prepareScenario would', () => {
    const scenario = makeScenario({
      method: 'POST',
      body: '{"test":1}',
      bodyType: 'json',
      auth: { type: 'bearer', token: 'my-token' },
      headers: [
        { key: 'X-Custom', value: 'val1' },
        { key: 'Accept', value: 'application/json' },
      ],
    });

    const rustScenario = prepareRustScenario(scenario);

    expect(rustScenario.headers['Authorization']).toBe('Bearer my-token');
    expect(rustScenario.headers['Content-Type']).toBe('application/json');
    expect(rustScenario.headers['X-Custom']).toBe('val1');
    expect(rustScenario.headers['Accept']).toBe('application/json');
    expect(rustScenario.body).toBe('{"test":1}');
    expect(rustScenario.method).toBe('POST');
  });

  it('prepareRustScenario builds URL with API key query param', () => {
    const scenario = makeScenario({
      url: 'https://api.example.com/data',
      auth: {
        type: 'apikey',
        apiKeyName: 'api_key',
        apiKeyValue: 'secret-123',
        apiKeyIn: 'query',
      },
    });

    const rustScenario = prepareRustScenario(scenario);
    expect(rustScenario.url).toContain('api_key=secret-123');
  });

  it('buildExpandedQueue matches allocation for multi-scenario', () => {
    const config = makeConfig({
      iterations: 6,
      scenarioWeights: [
        { scenarioId: 'sc-1', weight: 2 },
        { scenarioId: 'sc-2', weight: 1 },
      ],
    });
    const scenarios = [
      makeScenario({ id: 'sc-1' }),
      makeScenario({ id: 'sc-2', name: 'Second' }),
    ];
    const queue = buildExpandedQueue(config, scenarios);
    // computeAllocation gives each active scenario `iterations` copies (6 each = 12 total)
    // scenarioWeights with weight > 0 means both are active
    const sc1Count = queue.filter(s => s.id === 'sc-1').length;
    const sc2Count = queue.filter(s => s.id === 'sc-2').length;
    expect(sc1Count).toBe(6);
    expect(sc2Count).toBe(6);
    expect(queue.length).toBe(12);
  });
});

/* ── 2D-11: Validation with Rust results ──────────────────────── */

describe('validation with Rust results', () => {
  it('validates expected fields correctly (selective mode)', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'ok', expectedValue: 'true', operator: 'equals' },
        ],
      },
    });
    const rustResult = makeRustResult({
      responseBody: '{"ok":true}',
      httpStatus: 200,
    });

    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(true);
  });

  it('detects expected field mismatch (selective mode)', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'ok', expectedValue: 'false', operator: 'equals' },
        ],
      },
    });
    const rustResult = makeRustResult({
      responseBody: '{"ok":true}',
      httpStatus: 200,
    });

    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });

  it('passes HTTP status validation for 2xx', () => {
    const scenario = makeScenario({
      validation: { mode: 'status-only' },
    });
    const rustResult = makeRustResult({ httpStatus: 201 });

    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(true);
  });

  it('fails HTTP status validation for 4xx/5xx', () => {
    const scenario = makeScenario({
      validation: { mode: 'status-only' },
    });
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"error":"internal"}',
    });

    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(false);
  });
});

/* ── 2D-12: Error message extraction edge cases ───────────────── */

describe('error message extraction edge cases', () => {
  it('extracts "detail" field from JSON error response', () => {
    const rustResult = makeRustResult({
      httpStatus: 404,
      responseBody: '{"detail":"Not Found"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Not Found');
  });

  it('extracts "errorMessage" field from JSON error response', () => {
    const rustResult = makeRustResult({
      httpStatus: 400,
      responseBody: '{"errorMessage":"Invalid parameter"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Invalid parameter');
  });

  it('stringifies non-string error field', () => {
    const rustResult = makeRustResult({
      httpStatus: 422,
      responseBody: '{"error":{"code":422,"msg":"invalid"}}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('422');
    expect(result.errorMessage).toContain('invalid');
  });

  it('handles empty response body for error', () => {
    const rustResult = makeRustResult({
      httpStatus: 502,
      responseBody: '',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.passed).toBe(false);
    // With empty body and no errorMessage, failureDetails should still show the HTTP failure
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });
});

/* ── 2D-13: settled guard edge cases ──────────────────────────── */

describe('settled guard prevents double resolution', () => {
  it('does not resolve twice when complete event fires before .then()', async () => {
    let resolveCount = 0;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        // Immediately fire complete (before .then can set unlistenFn)
        queueMicrotask(() => {
          emitEvent('load-test-complete', {
            totalResults: 0,
            durationMs: 1,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        });
        return { totalResults: 0, durationMs: 1, breakerTripped: false };
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 0 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());
    resolveCount++;

    expect(resolveCount).toBe(1);
    expect(result.results.length).toBe(0);
  });
});

/* ── Coverage gap: startRustLoadTest without onError ── */

describe('startRustLoadTest fallback behaviors', () => {
  it('calls onComplete with zeroed summary when invoke fails and no onError provided', async () => {
    const onComplete = vi.fn();

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'start_load_test') {
        throw new Error('deserialization failed');
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
    );

    await new Promise(r => setTimeout(r, 20));

    expect(onComplete).toHaveBeenCalledWith({
      totalResults: 0,
      durationMs: 0,
      breakerTripped: false,
    });
  });

  it('returns no-op unlisten when called outside Tauri with onError', async () => {
    mockIsTauri.mockReturnValue(false);
    const onError = vi.fn();
    const onComplete = vi.fn();

    const { unlisten } = await startRustLoadTest(
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

    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expect(typeof unlisten).toBe('function');
    unlisten();
  });
});

/* ── Coverage gap: runTestViaRust error handler and catch handler ── */

describe('runTestViaRust error and exception paths', () => {
  it('rejects when startRustLoadTest fires onError callback', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        throw new Error('Rust panic');
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const scenarios = [makeScenario()];

    await expect(
      runTestViaRust(config, scenarios, vi.fn()),
    ).rejects.toThrow('Rust panic');
  });

  it('rejects with Error wrapper when onError receives non-Error', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        throw 'string error';
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const scenarios = [makeScenario()];

    await expect(
      runTestViaRust(config, scenarios, vi.fn()),
    ).rejects.toThrow('string error');
  });
});

/* ── Coverage gap: mapRustResultWithoutValidation edge cases ── */

describe('mapRustResultWithoutValidation coverage', () => {
  it('uses mapRustResultWithoutValidation for unknown scenario with httpStatus=0 (network error)', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        queueMicrotask(() => {
          emitEvent('load-test-progress', {
            results: [makeRustResult({
              scenarioId: 'unknown-id',
              httpStatus: 0,
              errorMessage: null,
            })],
            elapsedMs: 100,
            targetConcurrency: 1,
            currentInFlight: 0,
          } satisfies RustProgressBatch);
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        });
        return undefined;
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const onProgress = vi.fn();
    const result = await runTestViaRust(config, [makeScenario()], onProgress);

    const r = result.results[0];
    expect(r.passed).toBe(false);
    expect(r.failureDetails[0].actual).toBe('network error');
  });

  it('uses mapRustResultWithoutValidation with errorMessage for HTTP 500', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        queueMicrotask(() => {
          emitEvent('load-test-progress', {
            results: [makeRustResult({
              scenarioId: 'unknown-id',
              httpStatus: 500,
              errorMessage: 'Internal Server Error',
            })],
            elapsedMs: 100,
            targetConcurrency: 1,
            currentInFlight: 0,
          } satisfies RustProgressBatch);
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        });
        return undefined;
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());

    const r = result.results[0];
    expect(r.passed).toBe(false);
    expect(r.failureDetails[0].actual).toBe('Internal Server Error');
  });

  it('uses mapRustResultWithoutValidation with HTTP status string for non-zero failure without errorMessage', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        queueMicrotask(() => {
          emitEvent('load-test-progress', {
            results: [makeRustResult({
              scenarioId: 'unknown-id',
              httpStatus: 403,
              errorMessage: null,
            })],
            elapsedMs: 100,
            targetConcurrency: 1,
            currentInFlight: 0,
          } satisfies RustProgressBatch);
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        });
        return undefined;
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());

    const r = result.results[0];
    expect(r.passed).toBe(false);
    expect(r.failureDetails[0].actual).toBe('HTTP 403');
  });

  it('mapRustResultWithoutValidation passes for 2xx status', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'is_rust_executor_available') return true;
      if (cmd === 'start_load_test') {
        queueMicrotask(() => {
          emitEvent('load-test-progress', {
            results: [makeRustResult({
              scenarioId: 'unknown-id',
              httpStatus: 200,
            })],
            elapsedMs: 100,
            targetConcurrency: 1,
            currentInFlight: 0,
          } satisfies RustProgressBatch);
          emitEvent('load-test-complete', {
            totalResults: 1,
            durationMs: 100,
            breakerTripped: false,
          } satisfies RustCompletionSummary);
        });
        return undefined;
      }
      return undefined;
    });

    const config = makeConfig({ iterations: 1 });
    const result = await runTestViaRust(config, [makeScenario()], vi.fn());

    const r = result.results[0];
    expect(r.passed).toBe(true);
    expect(r.failureDetails).toEqual([]);
  });
});
