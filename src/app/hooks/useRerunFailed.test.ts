/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRerunFailed } from './useRerunFailed';
import type { AuthConfig, FeatureGroup, RequestResult, TestRun, TestScenario, TestSummary } from '@shared/types';
import type { TestResult } from '@engine/core/executor';

// ── Mocks ──

vi.mock('../../engine/dataSourceExpander', () => ({
  expandDataSourceForRows: vi.fn((_scenario, rowIds: string[]) =>
    rowIds.map(id => ({ id: `expanded-${id}`, url: 'http://example.com/api', method: 'GET' })),
  ),
}));

vi.mock('../../engine/executor', () => ({
  runTest: vi.fn(async () => ({
    results: [{ id: 'r1', scenarioId: 's1', passed: true, httpStatus: 200, responseTimeMs: 50 }],
  })),
}));

vi.mock('../../engine/rerunMerge', () => ({
  mergeRerunResults: vi.fn((run: TestRun, rerunResults: TestResult) => ({
    ...run,
    results: [...run.results, ...rerunResults],
  })),
}));

vi.mock('../../features/requests/utils/authResolver', () => ({
  resolveAuth: vi.fn(() => undefined),
}));

vi.mock('../../shared/utils/urlUtils', () => ({
  replaceHost: vi.fn((url: string, _base: string) => url),
}));

vi.mock('../../shared/utils/storage', () => ({
  updateTestRun: vi.fn(async () => {}),
}));

const { expandDataSourceForRows } = await import('../../engine/dataSourceExpander');
const { runTest } = await import('../../engine/executor');
const { mergeRerunResults } = await import('../../engine/rerunMerge');
const { updateTestRun } = await import('../../shared/utils/storage');

// ── Helpers ──

function makeFeatureGroups(): FeatureGroup[] {
  const scenario: TestScenario = {
    id: 'sc1',
    name: 'Scenario 1',
    tests: [{
      id: 's1',
      name: 'Test 1',
      url: 'http://example.com/api',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
      dataSource: {
        columns: [{ name: 'id' }],
        rows: [
          { id: 'row1', enabled: true, values: { id: '1' } },
          { id: 'row2', enabled: true, values: { id: '2' } },
        ],
      },
    }],
  };
  return [{
    id: 'fg1',
    name: 'Feature 1',
    scenarios: [scenario],
  }];
}

function makeTestRun(): TestRun {
  const summary: TestSummary = {
    tps: 0,
    avgResponseTime: 75,
    minResponseTime: 50,
    maxResponseTime: 100,
    p50ResponseTime: 75,
    p95ResponseTime: 100,
    p99ResponseTime: 100,
    errorRate: 50,
    errorsByStatus: {},
    totalRequests: 2,
    successfulRequests: 1,
    failedRequests: 1,
    failedValidations: 0,
    totalDurationMs: 1000,
  };
  const results: RequestResult[] = [
    { id: 'r1', scenarioId: 's1', passed: false, dataRowId: 'row1', httpStatus: 500, responseTimeMs: 100, scenarioName: 'Test 1', method: 'GET', url: 'http://example.com/api' },
    { id: 'r2', scenarioId: 's1', passed: true, dataRowId: 'row2', httpStatus: 200, responseTimeMs: 50, scenarioName: 'Test 1', method: 'GET', url: 'http://example.com/api' },
  ];
  return {
    id: 'run1',
    timestamp: Date.now(),
    baseUrl: 'http://example.com',
    config: {
      concurrency: 1,
      iterations: 2,
      executionMode: 'sequential' as const,
      scenarioWeights: [],
      timeoutSec: 30,
      retryCount: 0,
      retryDelayMs: 0,
    },
    summary,
    results,
  };
}

// ── Tests ──

describe('useRerunFailed', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('returns isRerunning=false initially', () => {
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );
    expect(result.current.isRerunning).toBe(false);
    expect(typeof result.current.handleRerunFailed).toBe('function');
  });

  it('calls runTest and updateTestRun for failed rows', async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
        onComplete,
      }),
    );

    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });

    expect(expandDataSourceForRows).toHaveBeenCalled();
    expect(runTest).toHaveBeenCalled();
    expect(mergeRerunResults).toHaveBeenCalled();
    expect(updateTestRun).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
    expect(result.current.isRerunning).toBe(false);
  });

  it('does nothing when no failed rows match scenarios', async () => {
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );

    const run = makeTestRun();
    // Use a row ID that doesn't exist in any result
    await act(async () => {
      await result.current.handleRerunFailed(run, ['nonexistent-row']);
    });

    expect(runTest).not.toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    vi.mocked(runTest).mockRejectedValueOnce(new Error('network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );

    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Re-run failed:', expect.any(Error));
    expect(result.current.isRerunning).toBe(false);
    consoleSpy.mockRestore();
  });

  it('does not call onComplete on error', async () => {
    vi.mocked(runTest).mockRejectedValueOnce(new Error('fail'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
        onComplete,
      }),
    );

    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });

    expect(onComplete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('skips scenarios not found in feature groups', async () => {
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );

    const run = makeTestRun();
    // Modify result to reference a non-existent scenario
    run.results[0].scenarioId = 'nonexistent-scenario';
    run.results[0].dataRowId = 'row1';
    // Also make the second result reference non-existent scenario so no scenarios are found
    run.results[1].scenarioId = 'nonexistent-scenario2';
    run.results[1].dataRowId = 'row2';
    run.results[1].passed = false; // make it a failure to be included in rerun

    await act(async () => {
      await result.current.handleRerunFailed(run, ['row1', 'row2']);
    });

    // Should not call runTest since no valid scenarios found
    expect(runTest).not.toHaveBeenCalled();
  });

  it('uses empty string baseUrl when not provided', async () => {
    vi.mocked(runTest).mockResolvedValue({ results: [] });
    
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: '',
        globalAuthProfiles: [],
      }),
    );

    const run = makeTestRun();
    run.baseUrl = undefined;

    await act(async () => {
      await result.current.handleRerunFailed(run, ['row1']);
    });

    expect(runTest).toHaveBeenCalled();
  });

  it('finishes successfully when onComplete is not provided', async () => {
    vi.mocked(runTest).mockResolvedValue({ results: [] });
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );
    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });
    expect(updateTestRun).toHaveBeenCalled();
    expect(result.current.isRerunning).toBe(false);
  });

  it('invokes runTest progress noop when executor reports progress', async () => {
    vi.mocked(runTest).mockImplementation(async (_config, _scenarios, onProgress) => {
      onProgress();
      return { results: [] };
    });
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );
    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });
    expect(runTest).toHaveBeenCalled();
    vi.mocked(runTest).mockResolvedValue({ results: [] });
  });

  it('handles gallery source feature groups', async () => {
    vi.mocked(runTest).mockResolvedValue({ results: [] });
    
    const galleryFeatureGroups = makeFeatureGroups();
    galleryFeatureGroups[0].source = 'gallery';

    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: galleryFeatureGroups,
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );

    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });

    expect(runTest).toHaveBeenCalled();
  });

  it('does not start a second rerun while one is in flight', async () => {
    let release!: () => void;
    vi.mocked(runTest).mockImplementation(
      () => new Promise((r) => {
        release = () => r({ results: [] } as never);
      }),
    );
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );
    const run = makeTestRun();
    await act(async () => {
      void result.current.handleRerunFailed(run, ['row1']);
    });
    await act(async () => {
      await result.current.handleRerunFailed(run, ['row1']);
    });
    expect(runTest).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(result.current.isRerunning).toBe(false);
  });

  it('skips rerun when expanded rows list is empty', async () => {
    vi.mocked(expandDataSourceForRows).mockReturnValueOnce([]);
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
      }),
    );
    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });
    expect(runTest).not.toHaveBeenCalled();
    expect(result.current.isRerunning).toBe(false);
  });

  it('passes envFallbackAuth into resolveAuth', async () => {
    const { resolveAuth } = await import('../../features/requests/utils/authResolver');
    vi.mocked(runTest).mockResolvedValue({ results: [] });
    const fb: AuthConfig = { type: 'bearer', token: 't' };
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://example.com',
        globalAuthProfiles: [],
        envFallbackAuth: fb,
      }),
    );
    await act(async () => {
      await result.current.handleRerunFailed(makeTestRun(), ['row1']);
    });
    expect(resolveAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      fb,
    );
  });

  it('calls replaceHost when base URL is set for non-gallery runs', async () => {
    const { replaceHost } = await import('../../shared/utils/urlUtils');
    vi.mocked(runTest).mockResolvedValue({ results: [] });
    const { result } = renderHook(() =>
      useRerunFailed({
        featureGroups: makeFeatureGroups(),
        resolvedBaseUrl: 'http://base.example.com',
        globalAuthProfiles: [],
      }),
    );
    const run = makeTestRun();
    run.baseUrl = undefined;
    await act(async () => {
      await result.current.handleRerunFailed(run, ['row1']);
    });
    expect(replaceHost).toHaveBeenCalledWith('http://example.com/api', 'http://base.example.com');
  });
});
