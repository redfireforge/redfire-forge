import { describe, expect, it } from 'vitest';
import {
  createMockConfig,
  createMockResult,
  createMockScenario,
  createMockSummary,
  mockCanUseRust,
  mockComputeMetrics,
  mockIsRustAvailable,
  mockSupportsWorkers,
  registerUseTestExecutionTestLifecycle,
} from './useTestExecutionTestSetup';

describe('useTestExecutionTestSetup helpers', () => {
  it('exposes factory helpers and platform mock defaults', async () => {
    expect(createMockScenario('sc-x').id).toBe('sc-x');
    expect(createMockConfig({ threads: 3 }).threads).toBe(3);
    expect(createMockResult({ id: 'r1' }).id).toBe('r1');
    expect(createMockSummary({ tps: 99 }).tps).toBe(99);

    await expect(mockIsRustAvailable()).resolves.toBe(false);
    expect(mockCanUseRust()).toBe(false);
  });
});

describe('useTestExecutionTestSetup lifecycle', () => {
  registerUseTestExecutionTestLifecycle();

  it('applies shared fake-timer defaults in beforeEach', () => {
    expect(mockSupportsWorkers()).toBe(false);
    expect(mockCanUseRust()).toBe(false);
    expect(mockComputeMetrics()).toMatchObject({ totalRequests: 10 });
  });
});
