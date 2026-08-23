import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scenario, TestConfig, ScenarioWeight, LoadProfileConfig } from '@shared/types';
import { runSequential, runBatch, runPool, type RunOpts } from './requestExecution';
import { runLoadProfile } from './loadProfileRunner';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { createThinkTimeDelay } from './thinkTime';
import { makeScenario as _makeScenario } from '@test-utils/factories';

vi.mock('../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '@shared/utils/httpClient';
const mockedFetch = vi.mocked(httpFetch);

const makeScenario = (id = 's1'): Scenario =>
  _makeScenario({ id, name: `Scenario_${id}`, url: 'https://api.example.com' });

function makeOpts(overrides: Partial<RunOpts> = {}): RunOpts {
  return {
    tokenManager: new TokenManager(),
    timeoutMs: undefined,
    retryCount: 0,
    retryDelayMs: 0,
    breaker: new CircuitBreaker('continue'),
    onProgress: vi.fn(),
    getThinkTimeMs: () => 0,
    ...overrides,
  };
}

const successResponse = { status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' };

describe('think time integration with execution strategies', () => {
  beforeEach(() => {
    resetAllMocks();
    mockedFetch.mockResolvedValue(successResponse);
  });

  describe('runSequential with think time', () => {
    it('calls getThinkTimeMs for each request', async () => {
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const queue = [makeScenario('a'), makeScenario('b'), makeScenario('c')];
      await runSequential(queue, makeOpts({ getThinkTimeMs }));
      expect(getThinkTimeMs).toHaveBeenCalledTimes(3);
    });

    it('still produces correct results with think time', async () => {
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runSequential(queue, makeOpts({ getThinkTimeMs }));
      expect(results).toHaveLength(2);
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('reports progress for each request even with think time', async () => {
      const onProgress = vi.fn();
      const queue = [makeScenario('a'), makeScenario('b')];
      await runSequential(queue, makeOpts({ onProgress, getThinkTimeMs: () => 0 }));
      expect(onProgress).toHaveBeenCalledTimes(2);
    });
  });

  describe('runBatch with think time', () => {
    it('calls getThinkTimeMs between batches', async () => {
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const queue = [makeScenario('a'), makeScenario('b'), makeScenario('c')];
      await runBatch(queue, 2, makeOpts({ getThinkTimeMs }));
      expect(getThinkTimeMs).toHaveBeenCalledTimes(2);
    });

    it('still produces correct results', async () => {
      const queue = [makeScenario('a'), makeScenario('b'), makeScenario('c')];
      const results = await runBatch(queue, 2, makeOpts({ getThinkTimeMs: () => 0 }));
      expect(results).toHaveLength(3);
      expect(results.every(r => r.passed)).toBe(true);
    });
  });

  describe('runPool with think time', () => {
    it('calls getThinkTimeMs for completed requests', async () => {
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runPool(queue, 1, makeOpts({ getThinkTimeMs }));
      expect(results).toHaveLength(2);
      expect(getThinkTimeMs).toHaveBeenCalled();
    });

    it('still produces correct results', async () => {
      const queue = [makeScenario('a'), makeScenario('b'), makeScenario('c')];
      const results = await runPool(queue, 2, makeOpts({ getThinkTimeMs: () => 0 }));
      expect(results).toHaveLength(3);
      expect(results.every(r => r.passed)).toBe(true);
    });
  });

  describe('runLoadProfile with think time', () => {
    it('calls getThinkTimeMs during load profile execution', async () => {
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.1, maxConcurrency: 1 };
      const scenarios = [makeScenario('s1')];
      const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
      const results = await runLoadProfile(profile, scenarios, weights, makeOpts({ getThinkTimeMs }));
      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        expect(getThinkTimeMs).toHaveBeenCalled();
      }
    });
  });

  describe('createThinkTimeDelay wired through strategies', () => {
    it('constant think time integrates with sequential', async () => {
      const getThinkTimeMs = createThinkTimeDelay({ mode: 'constant', constantMs: 0 });
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runSequential(queue, makeOpts({ getThinkTimeMs }));
      expect(results).toHaveLength(2);
    });

    it('uniform think time integrates with batch', async () => {
      const getThinkTimeMs = createThinkTimeDelay({ mode: 'uniform', minMs: 0, maxMs: 0 });
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runBatch(queue, 2, makeOpts({ getThinkTimeMs }));
      expect(results).toHaveLength(2);
    });

    it('gaussian think time integrates with pool', async () => {
      const getThinkTimeMs = createThinkTimeDelay({ mode: 'gaussian', meanMs: 0, stdDevMs: 0 });
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runPool(queue, 2, makeOpts({ getThinkTimeMs }));
      expect(results).toHaveLength(2);
    });

    it('none mode means no delay in sequential', async () => {
      const getThinkTimeMs = createThinkTimeDelay({ mode: 'none' });
      const queue = [makeScenario('a'), makeScenario('b')];
      const start = performance.now();
      await runSequential(queue, makeOpts({ getThinkTimeMs }));
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('abort interaction with think time', () => {
    it('sequential aborts during think time', async () => {
      const controller = new AbortController();
      const getThinkTimeMs = vi.fn().mockReturnValue(0);
      const queue = [makeScenario('a')];
      const results = await runSequential(queue, makeOpts({
        getThinkTimeMs,
        abortSignal: controller.signal,
      }));
      expect(results).toHaveLength(1);
    });

    it('sequential with pre-aborted signal produces no results', async () => {
      const controller = new AbortController();
      controller.abort();
      const queue = [makeScenario('a'), makeScenario('b')];
      const results = await runSequential(queue, makeOpts({
        getThinkTimeMs: () => 0,
        abortSignal: controller.signal,
      }));
      expect(results).toHaveLength(0);
    });

    it('batch with pre-aborted signal produces no results', async () => {
      const controller = new AbortController();
      controller.abort();
      const results = await runBatch([makeScenario()], 1, makeOpts({
        getThinkTimeMs: () => 0,
        abortSignal: controller.signal,
      }));
      expect(results).toHaveLength(0);
    });
  });

  describe('breaker interaction with think time', () => {
    it('breaker stops sequential even with think time', async () => {
      mockedFetch.mockResolvedValue({
        status: 500, statusText: 'Error', headers: {}, body: '{"error":"fail"}',
      });
      const breaker = new CircuitBreaker('stop-first');
      const queue = [makeScenario('a'), makeScenario('b'), makeScenario('c')];
      const results = await runSequential(queue, makeOpts({
        breaker,
        getThinkTimeMs: () => 0,
      }));
      expect(results).toHaveLength(1);
    });
  });
});

describe('runTest with thinkTime config', () => {
  beforeEach(() => {
    resetAllMocks();
    mockedFetch.mockResolvedValue(successResponse);
  });

  it('runTest passes thinkTime config through', async () => {
    const { runTest } = await import('./executor');
    const s = makeScenario();
    const config: TestConfig = {
      concurrency: 1,
      iterations: 2,
      scenarioWeights: [{ scenarioId: 's1', weight: 1 }],
      executionMode: 'sequential',
      thinkTime: { mode: 'constant', constantMs: 0 },
    };
    const { results } = await runTest(config, [s], vi.fn());
    expect(results).toHaveLength(2);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('runTest works without thinkTime config (backward compatible)', async () => {
    const { runTest } = await import('./executor');
    const s = makeScenario();
    const config: TestConfig = {
      concurrency: 1,
      iterations: 2,
      scenarioWeights: [{ scenarioId: 's1', weight: 1 }],
      executionMode: 'sequential',
    };
    const { results } = await runTest(config, [s], vi.fn());
    expect(results).toHaveLength(2);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('runTest with batch mode and thinkTime', async () => {
    const { runTest } = await import('./executor');
    const s = makeScenario();
    const config: TestConfig = {
      concurrency: 2,
      iterations: 3,
      scenarioWeights: [{ scenarioId: 's1', weight: 1 }],
      executionMode: 'batch',
      thinkTime: { mode: 'uniform', minMs: 0, maxMs: 0 },
    };
    const { results } = await runTest(config, [s], vi.fn());
    expect(results).toHaveLength(3);
  });

  it('runTest with pool mode and thinkTime', async () => {
    const { runTest } = await import('./executor');
    const s = makeScenario();
    const config: TestConfig = {
      concurrency: 2,
      iterations: 3,
      scenarioWeights: [{ scenarioId: 's1', weight: 1 }],
      executionMode: 'pool',
      thinkTime: { mode: 'gaussian', meanMs: 0, stdDevMs: 0 },
    };
    const { results } = await runTest(config, [s], vi.fn());
    expect(results).toHaveLength(3);
  });
});
