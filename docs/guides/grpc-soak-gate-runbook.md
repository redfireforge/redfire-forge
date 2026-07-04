# gRPC Soak Gate Runbook

## Purpose

The soak gate validates long-running gRPC stability by repeatedly exercising control-plane and data-plane routes while monitoring latency, error rate, memory growth, and stream lifecycle balance.

## Command

```bash
npm run grpc:soak:gate -- --duration-min=30 --out artifacts/grpc-soak-gate.json
```

## What It Checks

1. Duration window completed.
2. Average latency and p95 latency stay under configured thresholds.
3. Aggregate operation error rate stays under threshold.
4. `rss` and `heapUsed` growth stay under thresholds.
5. Started stream cycles are balanced by end/cancel counts.
6. `/api/grpc/perf/snapshot` `totalRequests` remains monotonic.

## Useful Overrides

```bash
# Faster local verification (2 minutes)
npm run grpc:soak:gate -- --duration-min=2 --interval-sec=10 --out artifacts/grpc-soak-gate.quick.json

# Stricter latency threshold
npm run grpc:soak:gate -- --max-avg-ms=300 --max-p95-ms=600
```

## Failure Triage

### 1) Latency failures (`latency_avg_within_threshold`, `latency_p95_within_threshold`)

1. Run `npm run grpc:phase13a:baseline` and inspect route-level p95 in its artifact.
2. Verify fixture health and local CPU pressure before re-running.
3. Check if failures concentrate on one probe type in `probeSummary.failures`.

### 2) Error-rate failures (`operation_error_rate_within_threshold`)

1. Inspect first failures in `probeSummary.failures`.
2. Verify descriptor bootstrap and fixture target address (`127.0.0.1:50051` by default).
3. Re-run Phase 13 rollback gate to ensure service recovery behavior is intact.

### 3) Memory growth failures (`rss_growth_within_threshold`, `heap_growth_within_threshold`)

1. Compare `memorySummary` growth and peaks with previous known-good artifacts.
2. If growth is sustained across reruns, capture Node heap profiles during soak.
3. Correlate spikes with probe failures or stream imbalance.

### 4) Stream lifecycle failures (`stream_lifecycle_balanced`)

1. Check `streamStarted`, `streamEnded`, `streamCancelled`, and `unresolvedStreams`.
2. Investigate stream start/send/end route responses for specific request IDs.
3. Re-run with shorter interval and verbose logs if needed.

## Artifact Fields

The artifact includes:

1. `inputs` (duration, thresholds, target).
2. `probeSummary` (iterations, totals, failures, latency).
3. `memorySummary` (rss/heap growth and peaks).
4. `perfSummary` (route telemetry request deltas).
5. `checks` and `totals` for gate pass/fail.
