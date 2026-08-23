import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isRustExecutorAvailable, resetAvailabilityCache, canUseRustExecutor } from './rustBridge';
import { isTauri } from '@shared/utils/platform';
import { Scenario, TestConfig } from '@shared/types';
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
