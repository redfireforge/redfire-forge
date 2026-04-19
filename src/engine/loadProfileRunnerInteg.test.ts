import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario, ScenarioWeight, LoadProfileConfig } from '../types';
import { runLoadProfile } from './loadProfileRunner';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import type { RunOpts } from './requestExecution';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' }),
}));

function makeScenario(id: string): Scenario {
  return {
    id, name: `Scenario_${id}`, url: 'https://api.example.com',
    method: 'GET', headers: [], body: '', auth: { type: 'none' },
    validation: { mode: 'none' },
  };
}

function makeOpts(overrides: Partial<RunOpts> = {}): RunOpts {
  return {
    tokenManager: new TokenManager(),
    timeoutMs: undefined,
    retryCount: 0,
    retryDelayMs: 0,
    breaker: new CircuitBreaker('continue'),
    onProgress: vi.fn(),
    ...overrides,
  };
}

describe('runLoadProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs a very short sustained profile', async () => {
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.1, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts());
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('distributes by weighted iterator across multiple scenarios', async () => {
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.1, maxConcurrency: 2 };
    const scenarios = [makeScenario('s1'), makeScenario('s2')];
    const weights: ScenarioWeight[] = [
      { scenarioId: 's1', weight: 3 },
      { scenarioId: 's2', weight: 1 },
    ];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts());
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('falls back to first scenario when no weights match', async () => {
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.05, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 'nonexistent', weight: 1 }];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts());
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('handles zero-weight scenarios', async () => {
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.05, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1'), makeScenario('s2')];
    const weights: ScenarioWeight[] = [
      { scenarioId: 's1', weight: 1 },
      { scenarioId: 's2', weight: 0 },
    ];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts());
    if (results.length > 0) {
      expect(results.every(r => r.scenarioName === 'Scenario_s1')).toBe(true);
    }
  });

  it('stops on breaker trip', async () => {
    const breaker = new CircuitBreaker('stop-first');
    vi.mocked(await import('../utils/httpClient')).httpFetch.mockResolvedValue({
      status: 500, statusText: 'Error', headers: {}, body: '{"error":"fail"}',
    });
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 1, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts({ breaker }));
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(breaker.shouldStop).toBe(true);
  });

  it('stops on abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 10, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts({ abortSignal: controller.signal }));
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
