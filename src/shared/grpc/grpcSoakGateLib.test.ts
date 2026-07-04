import { describe, expect, it } from 'vitest';
import {
  computeGrowthMb,
  evaluateSoakChecks,
  summarizeLatencies,
} from './grpcSoakGateLib.mjs';

describe('grpcSoakGateLib', () => {
  it('summarizeLatencies returns expected avg and p95', () => {
    const summary = summarizeLatencies([100, 150, 200, 250, 300]);

    expect(summary.count).toBe(5);
    expect(summary.avgMs).toBe(200);
    expect(summary.p95Ms).toBe(300);
    expect(summary.minMs).toBe(100);
    expect(summary.maxMs).toBe(300);
  });

  it('computeGrowthMb converts bytes to MB delta', () => {
    const start = 100 * 1024 * 1024;
    const end = 132 * 1024 * 1024;
    expect(computeGrowthMb(start, end)).toBe(32);
  });

  it('evaluateSoakChecks passes healthy inputs', () => {
    const result = evaluateSoakChecks({
      latencySummary: { count: 10, avgMs: 120, minMs: 80, maxMs: 190, p95Ms: 180 },
      errorRate: 0.01,
      memoryGrowth: 64,
      heapGrowth: 40,
      streamStarted: 8,
      streamEnded: 8,
      streamCancelled: 0,
      perfSamples: [
        { at: 1, totalRequests: 10 },
        { at: 2, totalRequests: 40 },
        { at: 3, totalRequests: 55 },
      ],
      maxAvgMs: 250,
      maxP95Ms: 500,
      maxErrorRate: 0.05,
      maxMemoryGrowthMb: 128,
      maxHeapGrowthMb: 96,
      maxStreamLeak: 0,
    });

    expect(result.unresolvedStreams).toBe(0);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it('evaluateSoakChecks fails when stream leak and perf monotonicity break', () => {
    const result = evaluateSoakChecks({
      latencySummary: { count: 10, avgMs: 120, minMs: 80, maxMs: 190, p95Ms: 180 },
      errorRate: 0.01,
      memoryGrowth: 64,
      heapGrowth: 40,
      streamStarted: 9,
      streamEnded: 7,
      streamCancelled: 1,
      perfSamples: [
        { at: 1, totalRequests: 10 },
        { at: 2, totalRequests: 9 },
      ],
      maxAvgMs: 250,
      maxP95Ms: 500,
      maxErrorRate: 0.05,
      maxMemoryGrowthMb: 128,
      maxHeapGrowthMb: 96,
      maxStreamLeak: 0,
    });

    const failedIds = result.checks.filter((check) => !check.passed).map((check) => check.id);
    expect(result.unresolvedStreams).toBe(1);
    expect(failedIds).toContain('stream_lifecycle_balanced');
    expect(failedIds).toContain('perf_snapshot_requests_monotonic');
  });

  it('evaluateSoakChecks fails when perf samples are insufficient', () => {
    const result = evaluateSoakChecks({
      latencySummary: { count: 5, avgMs: 100, minMs: 90, maxMs: 110, p95Ms: 110 },
      errorRate: 0,
      memoryGrowth: 8,
      heapGrowth: 4,
      streamStarted: 2,
      streamEnded: 2,
      streamCancelled: 0,
      perfSamples: [{ at: 1, totalRequests: 10 }],
      maxAvgMs: 250,
      maxP95Ms: 500,
      maxErrorRate: 0.05,
      maxMemoryGrowthMb: 128,
      maxHeapGrowthMb: 96,
      maxStreamLeak: 0,
    });

    const failedIds = result.checks.filter((check) => !check.passed).map((check) => check.id);
    expect(failedIds).toContain('perf_snapshot_samples_recorded');
    expect(failedIds).toContain('perf_snapshot_requests_monotonic');
  });
});
