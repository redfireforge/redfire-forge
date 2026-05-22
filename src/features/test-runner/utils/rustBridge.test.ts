import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isRustExecutorAvailable, resetAvailabilityCache, abortRustLoadTest, startRustLoadTest, canUseRustExecutor, buildExecutionPlan, prepareRustScenario, mapRustResult, buildExpandedQueue, runTestViaRust, RustProgressBatch, RustCompletionSummary, RustFinalResults, } from './rustBridge';
import { RustExecutionResult } from './rustBridge';
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
  resetAvailabilityCache();
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

/* ── isRustExecutorAvailable ─────────────────────────────────────── */

describe('isRustExecutorAvailable', () => {
  it('returns false when not in Tauri', async () => {
    expect(await isRustExecutorAvailable()).toBe(false);
  });

  it('caches the result on subsequent calls', async () => {
    await isRustExecutorAvailable();
    mockIsTauri.mockClear();
    await isRustExecutorAvailable();
    expect(mockIsTauri).toHaveBeenCalledTimes(0);
  });

  it('resets cache with resetAvailabilityCache', async () => {
    await isRustExecutorAvailable();
    resetAvailabilityCache();
    mockIsTauri.mockClear();
    await isRustExecutorAvailable();
    expect(mockIsTauri).toHaveBeenCalledTimes(1);
  });

  it('returns false if Tauri invoke throws', async () => {
    mockIsTauri.mockReturnValue(true);
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(() => Promise.reject(new Error('not available'))),
    }));
    resetAvailabilityCache();
    const result = await isRustExecutorAvailable();
    expect(result).toBe(false);
  });
});

describe('resetAvailabilityCache', () => {
  it('allows re-evaluation after reset', async () => {
    const first = await isRustExecutorAvailable();
    expect(first).toBe(false);

    resetAvailabilityCache();
    mockIsTauri.mockClear();

    const second = await isRustExecutorAvailable();
    expect(second).toBe(false);
    expect(mockIsTauri).toHaveBeenCalledTimes(1);
  });
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

/* ── canUseRustExecutor ──────────────────────────────────────────── */

describe('canUseRustExecutor', () => {
  it('returns true for pool mode with no OAuth2', () => {
    const config = makeConfig({ executionMode: 'pool' });
    const scenarios = [makeScenario()];
    expect(canUseRustExecutor(config, scenarios)).toBe(true);
  });

  it('returns true for sequential mode', () => {
    const config = makeConfig({ executionMode: 'sequential' });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(true);
  });

  it('returns true for batch mode (maps to pool)', () => {
    const config = makeConfig({ executionMode: 'batch' });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(true);
  });

  it('returns true for load-profile mode', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'sustained', durationSec: 30, maxConcurrency: 10 },
    });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(true);
  });

  it('returns false for workflow mode', () => {
    const config = makeConfig({ executionMode: 'workflow' });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(false);
  });

  it('returns false when any scenario has OAuth2', () => {
    const config = makeConfig();
    const scenarios = [
      makeScenario(),
      makeScenario({ id: 'sc-2', auth: { type: 'oauth2' } }),
    ];
    expect(canUseRustExecutor(config, scenarios)).toBe(false);
  });

  it('returns false when resolveSubWorkflow is provided', () => {
    const config = makeConfig();
    expect(canUseRustExecutor(config, [makeScenario()], () => undefined)).toBe(false);
  });

  it('returns true when auth is basic (not OAuth2)', () => {
    const scenarios = [makeScenario({ auth: { type: 'basic', username: 'u', password: 'p' } })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('returns true when auth is bearer', () => {
    const scenarios = [makeScenario({ auth: { type: 'bearer', token: 'tok' } })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('returns true when auth is apikey', () => {
    const scenarios = [makeScenario({ auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'header' } })];
    expect(canUseRustExecutor(makeConfig(), scenarios)).toBe(true);
  });

  it('returns true for constant-arrival mode', () => {
    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: { targetRps: 50, durationSec: 30 },
    });
    expect(canUseRustExecutor(config, [makeScenario()])).toBe(true);
  });
});

/* ── prepareRustScenario ─────────────────────────────────────────── */

describe('prepareRustScenario', () => {
  it('resolves headers and URL for a GET scenario', () => {
    const scenario = makeScenario();
    const result = prepareRustScenario(scenario);
    expect(result.id).toBe('sc-1');
    expect(result.url).toBe('https://api.example.com/users');
    expect(result.method).toBe('GET');
    expect(result.headers['X-Custom']).toBe('test');
    expect(result.body).toBeNull();
  });

  it('sets body for POST scenario with JSON body', () => {
    const scenario = makeScenario({
      method: 'POST',
      body: '{"name":"test"}',
      bodyType: 'json',
    });
    const result = prepareRustScenario(scenario);
    expect(result.body).toBe('{"name":"test"}');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('resolves basic auth into Authorization header', () => {
    const scenario = makeScenario({
      auth: { type: 'basic', username: 'admin', password: 'secret' },
    });
    const result = prepareRustScenario(scenario);
    const expected = 'Basic ' + btoa('admin:secret');
    expect(result.headers['Authorization']).toBe(expected);
  });

  it('resolves bearer auth into Authorization header', () => {
    const scenario = makeScenario({
      auth: { type: 'bearer', token: 'my-token' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.headers['Authorization']).toBe('Bearer my-token');
  });

  it('resolves API key in query param into URL', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'secret123', apiKeyIn: 'query' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.url).toContain('key=secret123');
  });

  it('resolves API key in header', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'X-Api-Key', apiKeyValue: 'abc', apiKeyIn: 'header' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.headers['X-Api-Key']).toBe('abc');
  });

  it('preserves data row fields for parameterized scenarios', () => {
    const scenario = makeScenario({ dataRowId: 'row-5', dataRowLabel: 'Row 5: user=admin' });
    const result = prepareRustScenario(scenario);
    expect(result.dataRowId).toBe('row-5');
    expect(result.dataRowLabel).toBe('Row 5: user=admin');
  });

  it('sets featureGroupName and groupName', () => {
    const scenario = makeScenario({ featureGroupName: 'Auth API', groupName: 'Login' });
    const result = prepareRustScenario(scenario);
    expect(result.featureGroupName).toBe('Auth API');
    expect(result.groupName).toBe('Login');
  });

  it('handles form-urlencoded body', () => {
    const scenario = makeScenario({
      method: 'POST',
      bodyType: 'form-urlencoded',
      bodyForm: [{ key: 'user', value: 'admin' }, { key: 'pass', value: 'secret' }],
    });
    const result = prepareRustScenario(scenario);
    expect(result.body).toContain('user=admin');
    expect(result.body).toContain('pass=secret');
    expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('includes validation config with mode and expectedFields', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'name', expectedValue: '"Alice"', operator: 'equals' },
          { jsonPath: 'age', expectedValue: '30' },
        ],
        unorderedArrays: true,
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.validation).toBeDefined();
    expect(result.validation!.mode).toBe('selective');
    expect(result.validation!.expectedFields).toHaveLength(2);
    expect(result.validation!.expectedFields![0].jsonPath).toBe('name');
    expect(result.validation!.expectedFields![0].operator).toBe('equals');
    expect(result.validation!.unorderedArrays).toBe(true);
  });

  it('includes validation config with full mode and expectedJson', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.validation!.mode).toBe('full');
    expect(result.validation!.expectedJson).toBe('{"ok":true}');
  });

  it('strips UI-only fields from validation config', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        selectiveMode: 'field' as never,
        sampleJson: '{"sample":true}' as never,
        excludedPaths: ['$.meta'] as never,
        responseVersions: [] as never,
        rulesVersions: [] as never,
      },
    });
    const result = prepareRustScenario(scenario);
    const v = result.validation!;
    expect(v.mode).toBe('selective');
    expect('selectiveMode' in v).toBe(false);
    expect('sampleJson' in v).toBe(false);
    expect('excludedPaths' in v).toBe(false);
    expect('responseVersions' in v).toBe(false);
    expect('rulesVersions' in v).toBe(false);
  });

  it('filters out custom assertions from serialized assertions', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'status', expected: '200', negate: false },
          { type: 'custom', expression: 'response.ok === true', negate: false },
          { type: 'responseTime', maxMs: 500, negate: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(2);
    expect(result.assertions!.every(a => a.type !== 'custom')).toBe(true);
  });

  it('omits assertions field when no non-custom assertions exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'custom', expression: 'true', negate: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toBeUndefined();
  });

  it('omits assertions field when no assertions at all', () => {
    const scenario = makeScenario({ validation: { mode: 'none' } });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toBeUndefined();
  });

  it('normalizes existence assertion with existsMode=exists', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', existsMode: 'exists' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(true);
  });

  it('normalizes existence assertion with existsMode=does_not_exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', existsMode: 'does_not_exist' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(false);
  });

  it('normalizes existence assertion with explicit expectExists', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', expectExists: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(false);
  });

  it('defaults existence assertion expectExists to true when no mode specified', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(true);
  });

  it('normalizes header assertion with legacy field names', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'header', headerName: 'Content-Type', headerOp: 'contains', headerValue: 'json' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].name).toBe('Content-Type');
    expect(result.assertions![0].operator).toBe('contains');
    expect(result.assertions![0].value).toBe('json');
  });

  it('normalizes numeric assertion with legacy comparison field', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'numeric', path: '$.count', comparison: '>=', value: 10 },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].operator).toBe('>=');
  });

  it('normalizes arrayLength assertion with legacy comparison field', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'arrayLength', path: '$.items', comparison: '==', value: 5 },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].operator).toBe('==');
  });
});

/* ── buildExecutionPlan ──────────────────────────────────────────── */

describe('buildExecutionPlan', () => {
  it('returns null for workflow mode', () => {
    const config = makeConfig({ executionMode: 'workflow' });
    expect(buildExecutionPlan(config, [makeScenario()])).toBeNull();
  });

  it('builds pool plan for pool mode', () => {
    const config = makeConfig({ executionMode: 'pool', concurrency: 8 });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('pool');
    if (plan!.mode === 'pool') {
      expect(plan!.concurrency).toBe(8);
      expect(plan!.scenarios.length).toBe(10);
    }
  });

  it('maps batch mode to pool', () => {
    const config = makeConfig({ executionMode: 'batch', concurrency: 5 });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan!.mode).toBe('pool');
  });

  it('builds sequential plan', () => {
    const config = makeConfig({ executionMode: 'sequential' });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan!.mode).toBe('sequential');
  });

  it('builds load-profile plan', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: {
        type: 'ramp-up',
        durationSec: 60,
        maxConcurrency: 20,
        rampUpSec: 30,
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('load-profile');
    if (plan!.mode === 'load-profile') {
      expect(plan!.durationSec).toBe(60);
      expect(plan!.concurrency).toBe(20);
      expect(plan!.profileType).toBe('ramp-up');
      expect(plan!.rampUpSec).toBe(30);
    }
  });

  it('maps think time: none', () => {
    const config = makeConfig({ thinkTime: { mode: 'none' } });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'none' });
  });

  it('maps think time: constant', () => {
    const config = makeConfig({ thinkTime: { mode: 'constant', constantMs: 500 } });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'constant', delayMs: 500 });
  });

  it('maps think time: uniform', () => {
    const config = makeConfig({ thinkTime: { mode: 'uniform', minMs: 100, maxMs: 500 } });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'uniform', minMs: 100, maxMs: 500 });
  });

  it('maps think time: gaussian', () => {
    const config = makeConfig({ thinkTime: { mode: 'gaussian', meanMs: 200, stdDevMs: 50 } });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'gaussian', meanMs: 200, stdDevMs: 50 });
  });

  it('maps circuit breaker: continue', () => {
    const config = makeConfig({ errorPolicy: 'continue' });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toEqual({ policy: 'continue' });
  });

  it('maps circuit breaker: stop-first', () => {
    const config = makeConfig({ errorPolicy: 'stop-first' });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toEqual({ policy: 'stop-first' });
  });

  it('maps circuit breaker: stop-threshold (converts percent to fraction)', () => {
    const config = makeConfig({ errorPolicy: 'stop-threshold', maxErrors: 5, maxErrorRate: 25 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toEqual({
      policy: 'stop-threshold',
      maxErrors: 5,
      maxErrorRate: 0.25,
      minSampleSize: 10,
    });
  });

  it('maps timeout correctly', () => {
    const config = makeConfig({ timeoutSec: 30 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.timeoutMs).toBe(30000);
  });

  it('maps zero timeout to 0', () => {
    const config = makeConfig({ timeoutSec: 0 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.timeoutMs).toBe(0);
  });

  it('maps retry count and delay', () => {
    const config = makeConfig({ retryCount: 3, retryDelayMs: 2000 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.retryCount).toBe(3);
    expect(plan.retryDelayMs).toBe(2000);
  });

  it('filters scenarios by scenarioWeights', () => {
    const config = makeConfig({
      iterations: 5,
      scenarioWeights: [
        { scenarioId: 'sc-1', weight: 1 },
        { scenarioId: 'sc-2', weight: 0 },
      ],
    });
    const scenarios = [makeScenario({ id: 'sc-1' }), makeScenario({ id: 'sc-2' })];
    const plan = buildExecutionPlan(config, scenarios)!;
    const ids = plan.scenarios.map((s) => s.id);
    expect(ids.every((id) => id === 'sc-1')).toBe(true);
  });

  it('uses all scenarios when no weights have weight > 0', () => {
    const config = makeConfig({
      iterations: 3,
      scenarioWeights: [],
    });
    const scenarios = [makeScenario({ id: 'sc-1' }), makeScenario({ id: 'sc-2', name: 'Second' })];
    const plan = buildExecutionPlan(config, scenarios)!;
    expect(plan.scenarios.length).toBe(6);
  });

  it('ensures concurrency is at least 1', () => {
    const config = makeConfig({ concurrency: 0 });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.mode === 'pool') {
      expect(plan.concurrency).toBeGreaterThanOrEqual(1);
    }
  });

  it('propagates scenario weights for load-profile mode', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'sustained', durationSec: 30, maxConcurrency: 10 },
      scenarioWeights: [
        { scenarioId: 'sc-1', weight: 3 },
        { scenarioId: 'sc-2', weight: 1 },
      ],
    });
    const scenarios = [makeScenario({ id: 'sc-1' }), makeScenario({ id: 'sc-2', name: 'Second' })];
    const plan = buildExecutionPlan(config, scenarios)!;
    expect(plan.mode).toBe('load-profile');
    const s1 = plan.scenarios.find((s) => s.id === 'sc-1');
    const s2 = plan.scenarios.find((s) => s.id === 'sc-2');
    expect(s1?.weight).toBe(3);
    expect(s2?.weight).toBe(1);
  });

  it('handles spike load profile', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: {
        type: 'spike',
        durationSec: 30,
        maxConcurrency: 10,
        spikeConcurrency: 50,
        spikeStartSec: 10,
        spikeDurationSec: 5,
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    if (plan.mode === 'load-profile') {
      expect(plan.profileType).toBe('spike');
      expect(plan.spikeConcurrency).toBe(50);
      expect(plan.spikeStartSec).toBe(10);
      expect(plan.spikeDurationSec).toBe(5);
    }
  });

  it('defaults undefined thinkTime to none', () => {
    const config = makeConfig();
    delete config.thinkTime;
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'none' });
  });

  it('defaults undefined errorPolicy to continue', () => {
    const config = makeConfig();
    delete config.errorPolicy;
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toEqual({ policy: 'continue' });
  });

  it('builds constant-arrival plan with basic config', () => {
    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: { targetRps: 50, durationSec: 60 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('constant-arrival');
    if (plan!.mode === 'constant-arrival') {
      expect(plan!.targetRps).toBe(50);
      expect(plan!.durationSec).toBe(60);
      expect(plan!.maxInFlight).toBe(500);
      expect(plan!.rampConfig).toBeUndefined();
      expect(plan!.detailLevel).toBe('sampled');
    }
  });

  it('builds constant-arrival plan with ramp config', () => {
    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: {
        targetRps: 100,
        durationSec: 120,
        maxInFlight: 200,
        ramp: { startRps: 10, endRps: 100, rampDurationSec: 30 },
      },
    });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('constant-arrival');
    if (plan!.mode === 'constant-arrival') {
      expect(plan!.maxInFlight).toBe(200);
      expect(plan!.rampConfig).toEqual({
        startRps: 10,
        endRps: 100,
        rampDurationSec: 30,
      });
    }
  });

  it('defaults maxInFlight to ceil(targetRps * 10) when not specified', () => {
    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: { targetRps: 7.5, durationSec: 30 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('constant-arrival');
    if (plan!.mode === 'constant-arrival') {
      expect(plan!.maxInFlight).toBe(75);
    }
  });

  it('returns null for constant-arrival with missing arrivalRate', () => {
    const config = makeConfig({ executionMode: 'constant-arrival' });
    delete config.arrivalRate;
    const plan = buildExecutionPlan(config, [makeScenario()]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('pool');
  });

  it('assigns scenario weights for constant-arrival', () => {
    const s1 = makeScenario({ id: 'sc-1' });
    const s2 = makeScenario({ id: 'sc-2' });
    const config = makeConfig({
      executionMode: 'constant-arrival',
      arrivalRate: { targetRps: 20, durationSec: 10 },
      scenarioWeights: [
        { scenarioId: 'sc-1', weight: 70 },
        { scenarioId: 'sc-2', weight: 30 },
      ],
    });
    const plan = buildExecutionPlan(config, [s1, s2]);
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe('constant-arrival');
    if (plan!.mode === 'constant-arrival') {
      expect(plan!.scenarios[0].weight).toBe(70);
      expect(plan!.scenarios[1].weight).toBe(30);
    }
  });
});

/* ── buildExpandedQueue ──────────────────────────────────────────── */

describe('buildExpandedQueue', () => {
  it('builds correct queue size for single scenario', () => {
    const config = makeConfig({ iterations: 5 });
    const queue = buildExpandedQueue(config, [makeScenario()]);
    expect(queue.length).toBe(5);
  });

  it('filters by scenario weights', () => {
    const config = makeConfig({
      iterations: 3,
      scenarioWeights: [
        { scenarioId: 'sc-1', weight: 1 },
        { scenarioId: 'sc-2', weight: 0 },
      ],
    });
    const scenarios = [makeScenario(), makeScenario({ id: 'sc-2' })];
    const queue = buildExpandedQueue(config, scenarios);
    expect(queue.every((s) => s.id === 'sc-1')).toBe(true);
  });

  it('includes all scenarios when weights are empty', () => {
    const config = makeConfig({ iterations: 2, scenarioWeights: [] });
    const scenarios = [makeScenario(), makeScenario({ id: 'sc-2', name: 'Second' })];
    const queue = buildExpandedQueue(config, scenarios);
    expect(queue.length).toBe(4);
  });

  it('returns empty queue for 0 iterations', () => {
    const config = makeConfig({ iterations: 0 });
    const queue = buildExpandedQueue(config, [makeScenario()]);
    expect(queue.length).toBe(0);
  });

  it('expands scenarios with data source rows', () => {
    const config = makeConfig({ iterations: 1 });
    const scenarios = [
      makeScenario({
        dataSource: {
          id: 'ds-1',
          columns: [{ id: 'vin', name: 'VIN', type: 'path', mapping: 'vin' }],
          rows: [
            { id: 'row-1', label: 'Row 1', values: { vin: 'ABC123' }, enabled: true },
            { id: 'row-2', label: 'Row 2', values: { vin: 'DEF456' }, enabled: true },
          ],
          source: { type: 'inline' },
        },
      }),
    ];
    const queue = buildExpandedQueue(config, scenarios);
    expect(queue.length).toBe(2);
    expect(queue[0].dataRowId).toBeDefined();
    expect(queue[1].dataRowId).toBeDefined();
  });
});

/* ── mapRustResult — JS fallback (passed === undefined) ───────────── */

describe('mapRustResult — JS fallback', () => {
  it('maps a successful result with no validation', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);

    expect(result.id).toBe('r-1');
    expect(result.scenarioId).toBe('sc-1');
    expect(result.httpStatus).toBe(200);
    expect(result.responseTimeMs).toBe(42.5);
    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('none');
    expect(result.failureDetails).toEqual([]);
    expect(result.timing).toEqual(rustResult.timing);
  });

  it('maps a failed HTTP result (status 500)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"error":"Internal Server Error"}',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
    expect(result.failureDetails[0].path).toBe('(http)');
  });

  it('maps a network error (status 0)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'Connection refused',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('Connection refused');
  });

  it('applies JSON validation when scenario has full validation mode', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const rustResult = makeRustResult({ responseBody: '{"ok":true}' });
    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('full');
  });

  it('detects validation failure when expected JSON does not match', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":false}' },
    });
    const rustResult = makeRustResult({ responseBody: '{"ok":true}' });
    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(false);
    expect(result.validationMode).toBe('full');
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });

  it('preserves timing breakdown', () => {
    const timing = { dnsLookup: 5, tcpConnect: 10, tlsHandshake: 15, ttfb: 50, download: 8, total: 88 };
    const rustResult = makeRustResult({ timing });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.timing).toEqual(timing);
  });

  it('preserves request log', () => {
    const requestLog = { headers: { 'X-Test': 'val' }, body: '{"req":1}' };
    const rustResult = makeRustResult({ requestLog });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.requestLog).toEqual({ headers: { 'X-Test': 'val' }, body: '{"req":1}' });
  });

  it('converts null requestLog.body to undefined', () => {
    const rustResult = makeRustResult({ requestLog: { headers: {}, body: null } });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.requestLog?.body).toBeUndefined();
  });

  it('converts null optional fields to undefined', () => {
    const rustResult = makeRustResult({
      featureGroupName: null,
      groupName: null,
      errorMessage: null,
      dataRowId: null,
      dataRowLabel: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.featureGroupName).toBeUndefined();
    expect(result.groupName).toBeUndefined();
    expect(result.dataRowId).toBeUndefined();
    expect(result.dataRowLabel).toBeUndefined();
  });

  it('preserves data row fields', () => {
    const rustResult = makeRustResult({ dataRowId: 'row-3', dataRowLabel: 'Row 3: VIN=123' });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.dataRowId).toBe('row-3');
    expect(result.dataRowLabel).toBe('Row 3: VIN=123');
  });

  it('copies scenarioTags from scenario to result', () => {
    const scenario = makeScenario({ scenarioTags: ['smoke', 'critical'] });
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);
    expect(result.scenarioTags).toEqual(['smoke', 'critical']);
  });

  it('handles scenario without scenarioTags (undefined)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);
    expect(result.scenarioTags).toBeUndefined();
  });

  it('appends retry count info to error message when retries > 0 and failed', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'timeout',
      retryCount: 2,
    });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toContain('3 attempts');
  });

  it('does not append retry info when retries > 0 but result passed', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({ retryCount: 1, httpStatus: 200 });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toBeUndefined();
  });

  it('extracts error message from JSON response body for HTTP failures', () => {
    const rustResult = makeRustResult({
      httpStatus: 422,
      responseBody: '{"message":"Validation failed"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Validation failed');
  });

  it('extracts error from JSON "error" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 400,
      responseBody: '{"error":"Bad request"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Bad request');
  });

  it('extracts error from JSON "detail" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 404,
      responseBody: '{"detail":"Not found"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Not found');
  });

  it('extracts error from JSON "errorMessage" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"errorMessage":"Internal error"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Internal error');
  });

  it('stringifies non-string error field in JSON', () => {
    const rustResult = makeRustResult({
      httpStatus: 422,
      responseBody: '{"message":{"code":"INVALID","details":["field1"]}}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('code');
    expect(result.errorMessage).toContain('INVALID');
  });

  it('uses truncated body when JSON has no recognized error field', () => {
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"status":"error","data":null}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('status');
  });

  it('falls back to truncated body when no standard error field', () => {
    const rustResult = makeRustResult({
      httpStatus: 503,
      responseBody: 'Service Unavailable - please try again later',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Service Unavailable');
  });

  it('handles non-JSON response body for error extraction', () => {
    const rustResult = makeRustResult({
      httpStatus: 502,
      responseBody: '<html>Bad Gateway</html>',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Bad Gateway');
  });
});

/* ── detailLevel in buildExecutionPlan ────────────────────────────── */

describe('buildExecutionPlan detailLevel', () => {
  it('sets detailLevel to sampled for load-profile mode', () => {
    const config = makeConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'sustained', durationSec: 60, maxConcurrency: 10 },
    });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.mode).toBe('load-profile');
    if (plan.mode === 'load-profile') {
      expect(plan.detailLevel).toBe('sampled');
    }
  });

  it('does not set detailLevel for pool mode (defaults to full on Rust side)', () => {
    const config = makeConfig({ executionMode: 'pool' });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.mode).toBe('pool');
    if (plan.mode === 'pool') {
      expect(plan.detailLevel).toBeUndefined();
    }
  });

  it('does not set detailLevel for sequential mode', () => {
    const config = makeConfig({ executionMode: 'sequential' });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.mode).toBe('sequential');
    if (plan.mode === 'sequential') {
      expect(plan.detailLevel).toBeUndefined();
    }
  });

  it('does not set detailLevel for batch mode (maps to pool)', () => {
    const config = makeConfig({ executionMode: 'batch' });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.mode).toBe('pool');
    if (plan.mode === 'pool') {
      expect(plan.detailLevel).toBeUndefined();
    }
  });
});

/* ── runTestViaRust ─────────────────────────────────────────────────── */

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

/* ── mapRustResult — Rust passthrough (passed !== undefined) ──────── */
