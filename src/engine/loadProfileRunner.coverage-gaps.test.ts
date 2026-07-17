import { describe, it, expect, vi } from 'vitest';
import { getTargetConcurrency, runLoadProfile } from './loadProfileRunner';
import { makeScenario, makeResult } from '../test-utils/factories';

vi.mock('./requestExecution', () => ({
  prepareScenario: vi.fn(() => ({
    needsOAuth: false,
    baseHeaders: {},
    body: '{}',
    resolvedUrl: 'http://localhost',
  })),
  executeWithRetry: vi.fn(async (scenario) => makeResult({ scenarioId: scenario.id, passed: true })),
  buildErrorResult: vi.fn((scenario, err) => makeResult({ scenarioId: scenario.id, passed: false, errorMessage: String(err) })),
}));

describe('loadProfileRunner — coverage gaps', () => {
  it('ramp-up starts at 1 when elapsed is zero', () => {
    const profile = {
      type: 'ramp-up' as const,
      durationSec: 60,
      maxConcurrency: 10,
      rampUpSec: 30,
    };
    expect(getTargetConcurrency(profile, 0)).toBe(1);
  });

  it('runLoadProfile completes with think time and abort paths', async () => {
    vi.useFakeTimers();
    const scenario = makeScenario({ id: 'sc-1' });
    const onProgress = vi.fn();
    const abort = new AbortController();
    const promise = runLoadProfile(
      { type: 'sustained', durationSec: 1, maxConcurrency: 1 },
      [scenario],
      [{ scenarioId: 'sc-1', weight: 1 }],
      {
        tokenManager: { getToken: vi.fn(async () => 'tok') },
        timeoutMs: 5000,
        retryCount: 0,
        retryDelayMs: 0,
        breaker: { record: vi.fn(), shouldStop: false },
        onProgress,
        abortSignal: abort.signal,
        getThinkTimeMs: () => 10,
      },
    );
    await vi.advanceTimersByTimeAsync(1200);
    abort.abort();
    await vi.runAllTimersAsync();
    const results = await promise;
    expect(results.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
