/**
 * Shared test helpers for rustBridge test suites
 */
import { vi } from 'vitest';
import type { Scenario, TestConfig } from '../../../../shared/types';
import type { RustExecutionResult } from '../rustBridge';
import { makeScenario as _makeScenario, makeConfig as _makeConfig } from '../../../../test-utils/factories';

/**
 * Creates a test scenario with sensible defaults
 */
export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
    ...overrides,
  });
}

/**
 * Creates a test config with sensible defaults
 */
export function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return _makeConfig({
    concurrency: 4,
    executionMode: 'pool',
    ...overrides,
  });
}

/**
 * Creates a mock Rust execution result for testing
 */
export function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
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

/**
 * Setup mock for platform.isTauri
 */
export function setupTauriMock() {
  return vi.mock('../../../../shared/utils/platform', () => ({
    isTauri: vi.fn(() => false),
  }));
}
