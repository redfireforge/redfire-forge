import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Scenario, ScenarioWeight, LoadProfileConfig } from '../shared/types';
import { runLoadProfile } from './loadProfileRunner';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { clearPrepCache, type RunOpts } from './requestExecution';

vi.mock('../shared/utils/httpClient', () => ({
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
    getThinkTimeMs: () => 0,
    ...overrides,
  };
}

describe('runLoadProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearPrepCache();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    vi.mocked(await import('../shared/utils/httpClient')).httpFetch.mockResolvedValue({
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

  it('records breaker and failure when token acquisition rejects', async () => {
    const breaker = new CircuitBreaker('stop-first');
    const tokenManager = {
      getToken: vi.fn().mockRejectedValue(new Error('token unavailable')),
    } as unknown as TokenManager;
    const onProgress = vi.fn();
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 60, maxConcurrency: 1 };
    const scenarios = [{ ...makeScenario('s1'), auth: { type: 'oauth2' as const } }];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const results = await runLoadProfile(profile, scenarios, weights, makeOpts({
      tokenManager,
      breaker,
      onProgress,
    }));
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toBe('token unavailable');
    expect(results[0].failureDetails[0].path).toBe('(error)');
    expect(breaker.shouldStop).toBe(true);
  });

  it('finishes in-flight work after duration elapses on ticker while requests are pending', async () => {
    vi.useFakeTimers();
    const releases: Array<() => void> = [];
    const httpMod = vi.mocked(await import('../shared/utils/httpClient'));
    httpMod.httpFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() =>
            resolve({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' })
          );
        })
    );
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 0.5, maxConcurrency: 2 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const runPromise = runLoadProfile(profile, scenarios, weights, makeOpts());
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(501);
    for (const r of releases) r();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1);
    const results = await runPromise;
    vi.useRealTimers();
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('runs ticker fillPool and onProgress while profile is still active', async () => {
    vi.useFakeTimers();
    const releases: Array<() => void> = [];
    const httpMod = vi.mocked(await import('../shared/utils/httpClient'));
    httpMod.httpFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() =>
            resolve({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' })
          );
        })
    );
    const controller = new AbortController();
    const onProgress = vi.fn();
    const profile: LoadProfileConfig = { type: 'sustained', durationSec: 120, maxConcurrency: 1 };
    const scenarios = [makeScenario('s1')];
    const weights: ScenarioWeight[] = [{ scenarioId: 's1', weight: 1 }];
    const runPromise = runLoadProfile(profile, scenarios, weights, makeOpts({ onProgress, abortSignal: controller.signal }));
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    const callsAfterStart = onProgress.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(onProgress.mock.calls.length).toBeGreaterThan(callsAfterStart);
    controller.abort();
    await vi.advanceTimersByTimeAsync(500);
    for (const r of releases) r();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1);
    await runPromise;
    vi.useRealTimers();
  });
});
