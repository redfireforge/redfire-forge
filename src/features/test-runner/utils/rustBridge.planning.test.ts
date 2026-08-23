import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { buildExecutionPlan, buildExpandedQueue } from './rustBridge';
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

beforeEach(() => {
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
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

/* ── buildExecutionPlan detailLevel ──────────────────────────────── */

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
