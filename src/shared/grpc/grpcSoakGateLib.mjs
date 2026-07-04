export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0] ?? 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const safeIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[safeIndex] ?? 0;
}

export function summarizeLatencies(samples) {
  if (!samples.length) {
    return {
      count: 0,
      avgMs: 0,
      minMs: 0,
      maxMs: 0,
      p95Ms: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, value) => acc + value, 0);
  return {
    count: samples.length,
    avgMs: round2(sum / samples.length),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    p95Ms: round2(percentile(sorted, 95)),
  };
}

export function computeGrowthMb(startBytes, endBytes) {
  const delta = endBytes - startBytes;
  return round2(delta / (1024 * 1024));
}

export function evaluateSoakChecks(input) {
  const {
    latencySummary,
    errorRate,
    memoryGrowth,
    heapGrowth,
    streamStarted,
    streamEnded,
    streamCancelled,
    perfSamples,
    maxAvgMs,
    maxP95Ms,
    maxErrorRate,
    maxMemoryGrowthMb,
    maxHeapGrowthMb,
    maxStreamLeak,
  } = input;

  const unresolvedStreams = Math.max(0, streamStarted - streamEnded - streamCancelled);
  const perfSamplesRecorded = perfSamples.length >= 2;

  const perfMonotonic = perfSamples.every((sample, index) => {
    if (index === 0) return true;
    const prev = perfSamples[index - 1];
    return sample.totalRequests >= prev.totalRequests;
  });

  const checks = [
    {
      id: 'latency_avg_within_threshold',
      passed: latencySummary.avgMs <= maxAvgMs,
      detail: `Average latency ${latencySummary.avgMs}ms <= ${maxAvgMs}ms`,
      meta: { observedAvgMs: latencySummary.avgMs, maxAvgMs },
    },
    {
      id: 'latency_p95_within_threshold',
      passed: latencySummary.p95Ms <= maxP95Ms,
      detail: `P95 latency ${latencySummary.p95Ms}ms <= ${maxP95Ms}ms`,
      meta: { observedP95Ms: latencySummary.p95Ms, maxP95Ms },
    },
    {
      id: 'operation_error_rate_within_threshold',
      passed: errorRate <= maxErrorRate,
      detail: `Operation error rate ${errorRate} <= ${maxErrorRate}`,
      meta: { observedErrorRate: errorRate, maxErrorRate },
    },
    {
      id: 'rss_growth_within_threshold',
      passed: memoryGrowth <= maxMemoryGrowthMb,
      detail: `RSS growth ${memoryGrowth}MB <= ${maxMemoryGrowthMb}MB`,
      meta: { observedRssGrowthMb: memoryGrowth, maxMemoryGrowthMb },
    },
    {
      id: 'heap_growth_within_threshold',
      passed: heapGrowth <= maxHeapGrowthMb,
      detail: `Heap growth ${heapGrowth}MB <= ${maxHeapGrowthMb}MB`,
      meta: { observedHeapGrowthMb: heapGrowth, maxHeapGrowthMb },
    },
    {
      id: 'stream_lifecycle_balanced',
      passed: unresolvedStreams <= maxStreamLeak,
      detail: `Unresolved streams ${unresolvedStreams} <= ${maxStreamLeak}`,
      meta: {
        streamStarted,
        streamEnded,
        streamCancelled,
        unresolvedStreams,
        maxStreamLeak,
      },
    },
    {
      id: 'perf_snapshot_samples_recorded',
      passed: perfSamplesRecorded,
      detail: 'Collected at least two performance snapshots during soak run',
      meta: {
        sampleCount: perfSamples.length,
      },
    },
    {
      id: 'perf_snapshot_requests_monotonic',
      passed: perfSamplesRecorded && perfMonotonic,
      detail: 'Route performance snapshots show non-decreasing totalRequests',
      meta: {
        sampleCount: perfSamples.length,
      },
    },
  ];

  return {
    checks,
    unresolvedStreams,
  };
}
