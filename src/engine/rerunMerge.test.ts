import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockComputeMetrics = vi.fn();
vi.mock('./metrics', () => ({
  computeMetrics: (...args: unknown[]) => mockComputeMetrics(...args),
}));

import { mergeRerunResults } from './rerunMerge';
import type { TestRun, TestSummary, RequestResult } from '@shared/types';
import { makeResult as _makeResult, makeSummary as _makeSummary } from '../test-utils/factories';

const makeResult = (overrides: Parameters<typeof _makeResult>[0] = {}) =>
  _makeResult(overrides);

function makeSummary(): TestSummary {
  return _makeSummary({
    tps: 10,
    avgResponseTime: 100,
    minResponseTime: 80,
    maxResponseTime: 120,
    p50ResponseTime: 100,
    p95ResponseTime: 120,
    p99ResponseTime: 120,
    errorRate: 0,
    errorsByStatus: {},
    totalRequests: 2,
    successfulRequests: 2,
    failedRequests: 0,
    failedValidations: 0,
    totalDurationMs: 200,
  });
}

function makeTestRun(results: RequestResult[]): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      iterations: 1,
      concurrency: 1,
      timeoutSec: 30,
      executionMode: 'scenario',
    },
    results,
    summary: makeSummary(),
  };
}

describe('mergeRerunResults', () => {
  beforeEach(() => {
    resetAllMocks();
    mockComputeMetrics.mockReturnValue(makeSummary());
  });

  it('replaces results matching scenarioId + dataRowId', () => {
    const original = makeTestRun([
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', passed: false, httpStatus: 500 }),
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-1', passed: true }),
    ]);
    const reruns = [
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', passed: true, httpStatus: 200 }),
    ];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.results).toHaveLength(2);
    const replacedResult = merged.results.find(r => r.dataRowId === 'row-0');
    expect(replacedResult?.passed).toBe(true);
    expect(replacedResult?.httpStatus).toBe(200);
  });

  it('keeps original results not in the re-run set', () => {
    const original = makeTestRun([
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0' }),
      makeResult({ scenarioId: 'sc-2', dataRowId: 'row-1' }),
    ]);
    const reruns = [
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', httpStatus: 201 }),
    ];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.results).toHaveLength(2);
    const kept = merged.results.find(r => r.scenarioId === 'sc-2');
    expect(kept).toBeDefined();
  });

  it('handles results with undefined dataRowId', () => {
    const original = makeTestRun([
      makeResult({ scenarioId: 'sc-1', dataRowId: undefined }),
    ]);
    const reruns = [
      makeResult({ scenarioId: 'sc-1', dataRowId: undefined, httpStatus: 204 }),
    ];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.results).toHaveLength(1);
    expect(merged.results[0].httpStatus).toBe(204);
  });

  it('recalculates summary using computeMetrics', () => {
    const original = makeTestRun([makeResult()]);
    const reruns = [makeResult({ httpStatus: 201 })];

    mergeRerunResults(original, reruns);
    expect(mockComputeMetrics).toHaveBeenCalledTimes(1);
    expect(mockComputeMetrics).toHaveBeenCalledWith(
      expect.any(Array),
      original.summary.totalDurationMs,
    );
  });

  it('preserves original TestRun metadata', () => {
    const original = makeTestRun([makeResult()]);
    const reruns = [makeResult({ httpStatus: 201 })];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.id).toBe(original.id);
    expect(merged.timestamp).toBe(original.timestamp);
    expect(merged.config).toBe(original.config);
  });
});
