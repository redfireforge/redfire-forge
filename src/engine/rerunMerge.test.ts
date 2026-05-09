import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockComputeMetrics = vi.fn();
vi.mock('./metrics', () => ({
  computeMetrics: (...args: unknown[]) => mockComputeMetrics(...args),
}));

import { mergeRerunResults } from './rerunMerge';
import type { TestRun, RequestResult, TestSummary } from '../shared/types';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    scenarioId: 'sc-1',
    scenarioName: 'Test',
    url: 'http://example.com',
    method: 'GET',
    statusCode: 200,
    responseTimeMs: 100,
    passed: true,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSummary(): TestSummary {
  return {
    totalRequests: 2,
    passedRequests: 2,
    failedRequests: 0,
    avgResponseTimeMs: 100,
    minResponseTimeMs: 80,
    maxResponseTimeMs: 120,
    p95ResponseTimeMs: 120,
    p99ResponseTimeMs: 120,
    requestsPerSecond: 10,
    totalDurationMs: 200,
  };
}

function makeTestRun(results: RequestResult[]): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      totalTransactions: 1,
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
    vi.clearAllMocks();
    mockComputeMetrics.mockReturnValue(makeSummary());
  });

  it('replaces results matching scenarioId + dataRowId', () => {
    const original = makeTestRun([
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', passed: false, statusCode: 500 }),
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-1', passed: true }),
    ]);
    const reruns = [
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', passed: true, statusCode: 200 }),
    ];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.results).toHaveLength(2);
    const replacedResult = merged.results.find(r => r.dataRowId === 'row-0');
    expect(replacedResult?.passed).toBe(true);
    expect(replacedResult?.statusCode).toBe(200);
  });

  it('keeps original results not in the re-run set', () => {
    const original = makeTestRun([
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0' }),
      makeResult({ scenarioId: 'sc-2', dataRowId: 'row-1' }),
    ]);
    const reruns = [
      makeResult({ scenarioId: 'sc-1', dataRowId: 'row-0', statusCode: 201 }),
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
      makeResult({ scenarioId: 'sc-1', dataRowId: undefined, statusCode: 204 }),
    ];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.results).toHaveLength(1);
    expect(merged.results[0].statusCode).toBe(204);
  });

  it('recalculates summary using computeMetrics', () => {
    const original = makeTestRun([makeResult()]);
    const reruns = [makeResult({ statusCode: 201 })];

    mergeRerunResults(original, reruns);
    expect(mockComputeMetrics).toHaveBeenCalledTimes(1);
    expect(mockComputeMetrics).toHaveBeenCalledWith(
      expect.any(Array),
      original.summary.totalDurationMs,
    );
  });

  it('preserves original TestRun metadata', () => {
    const original = makeTestRun([makeResult()]);
    const reruns = [makeResult({ statusCode: 201 })];

    const merged = mergeRerunResults(original, reruns);
    expect(merged.id).toBe(original.id);
    expect(merged.timestamp).toBe(original.timestamp);
    expect(merged.config).toBe(original.config);
  });
});
