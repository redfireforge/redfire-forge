# Throughput PR 4 — Test Scenarios for Visual Verification

> PR 4: Multi-Worker Execution
> Completed: 2026-05-18
> Branch: `feature/review-status`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/engine/workerProtocol.ts` | Added `workerIndex` and `totalWorkers` fields to `start` message |
| `src/engine/workerBridge.ts` | Added `getWorkerCount()`, `runTestMultiWorker()` — N-worker spawning, queue splitting, result aggregation |
| `src/features/test-runner/hooks/useTestExecution.ts` | Switched from `runTestInWorker` to `runTestMultiWorker` |
| `src/features/test-runner/hooks/useTestExecution.test.ts` | Updated mock to `runTestMultiWorker` |

---

## Architecture Overview

```
Main Thread (UI + aggregation)
  ├── Worker 1 (scenarios[0..chunk], concurrency=N/workers)  → progress batches
  ├── Worker 2 (scenarios[chunk..2*chunk], concurrency=N/workers)  → progress batches
  ├── ...
  └── Worker K (remaining scenarios, concurrency=N/workers)  → progress batches
  └── Aggregator: merge results, coordinate abort, report to UI
```

- **Worker count**: `Math.max(1, Math.min(navigator.hardwareConcurrency - 1, 8))`
- **Fallback to single worker**: workflow mode, <8 scenarios, or 1 core
- **Each worker**: runs `runTest()` independently with its chunk and proportional concurrency

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Multi-Worker — Basic Split](#test-scenario-1-multi-worker--basic-split) | [ ] | |
| 2 | [Multi-Worker — Result Completeness](#test-scenario-2-multi-worker--result-completeness) | [ ] | |
| 3 | [Multi-Worker — Progress Aggregation](#test-scenario-3-multi-worker--progress-aggregation) | [ ] | |
| 4 | [Multi-Worker — Abort All Workers](#test-scenario-4-multi-worker--abort-all-workers) | [ ] | |
| 5 | [Multi-Worker — Error Propagation](#test-scenario-5-multi-worker--error-propagation) | [ ] | |
| 6 | [Single-Worker Fallback — Small Scenario Count](#test-scenario-6-single-worker-fallback--small-scenario-count) | [ ] | |
| 7 | [Single-Worker Fallback — Workflow Mode](#test-scenario-7-single-worker-fallback--workflow-mode) | [ ] | |
| 8 | [Multi-Worker — High Concurrency Stress](#test-scenario-8-multi-worker--high-concurrency-stress) | [ ] | |
| 9 | [Multi-Worker — Uneven Split](#test-scenario-9-multi-worker--uneven-split) | [ ] | |
| 10 | [Multi-Worker — Tauri HTTP Proxy](#test-scenario-10-multi-worker--tauri-http-proxy) | [ ] | |
| 11 | [Combined — Full Tier 1 Integration](#test-scenario-11-combined--full-tier-1-integration) | [ ] | |

---

## Test Scenario 1: Multi-Worker — Basic Split

**Purpose**: Verify that scenarios are correctly split across N workers and all results are returned.

**Optimization**: 1P — Multi-worker execution

### Steps

1. Create a parameterized test with **20 scenarios** (or 1 scenario × 20 iterations)
2. Target: `GET https://httpbin.org/get`
3. Set **concurrency = 10** in batch mode
4. Run the test

### Expected Outcomes

- [ ] All 20 results are returned in the results panel
- [ ] Results are from all scenarios (check `scenarioName` or `url` if varied)
- [ ] No duplicate results (each result has a unique `id`)
- [ ] Test completes without errors

---

## Test Scenario 2: Multi-Worker — Result Completeness

**Purpose**: Verify that results from all workers are correctly merged — no results lost during aggregation.

**Optimization**: 1P — Result aggregation across workers

### Steps

1. Create a parameterized test with **100 iterations** of a single scenario
2. Target: `POST https://httpbin.org/post` with body `{"i": "{{iteration}}"}`
3. Set **concurrency = 20**
4. Run the test and count results

### Expected Outcomes

- [ ] Exactly 100 results appear in the results table
- [ ] All results have valid `httpStatus` (200)
- [ ] All results have valid `responseTimeMs` (>0)
- [ ] No "undefined" or null entries in the results

---

## Test Scenario 3: Multi-Worker — Progress Aggregation

**Purpose**: Verify that the progress counter correctly sums completed counts from all workers and the progress bar reaches 100%.

**Optimization**: 1P — `completedPerWorker` aggregation in progress callback

### Steps

1. Create a parameterized test with **50 iterations**, **concurrency = 10**
2. Target: `GET https://httpbin.org/delay/1` (slow endpoint for visible progress)
3. Run the test and watch the progress bar

### Expected Outcomes

- [ ] Progress bar starts at 0% and reaches 100%
- [ ] Progress counter increments smoothly (no jumps from 0 to 100)
- [ ] Intermediate progress values are reasonable (not exceeding total)
- [ ] Final completed count matches total (50)

---

## Test Scenario 4: Multi-Worker — Abort All Workers

**Purpose**: Verify that clicking "Abort" during a multi-worker test stops all workers and returns partial results.

**Optimization**: 1P — `abortAll()` sends abort to every worker

### Steps

1. Create a parameterized test with **200 iterations**, **concurrency = 20**
2. Target: `GET https://httpbin.org/delay/2` (slow endpoint)
3. Start the test
4. After ~5 seconds (visible progress), click **Abort**

### Expected Outcomes

- [ ] Test stops within 1-2 seconds of clicking Abort
- [ ] Partial results are displayed (more than 0, less than 200)
- [ ] Status shows "Aborted" or similar indication
- [ ] No console errors about unhandled promise rejections
- [ ] Workers are properly terminated (no lingering background activity)

---

## Test Scenario 5: Multi-Worker — Error Propagation

**Purpose**: Verify that if one worker encounters a fatal error, it propagates to the main thread and aborts other workers.

**Optimization**: 1P — Error handling with `abortAll()` + `cleanupAll()`

### Steps

1. Create a parameterized test targeting a non-existent host (e.g., `https://nonexistent.invalid/api`)
2. Set **iterations = 20**, **concurrency = 10**
3. Run the test

### Expected Outcomes

- [ ] Test completes (doesn't hang)
- [ ] Error results are captured with meaningful error messages
- [ ] Results panel shows the errors clearly
- [ ] No uncaught exceptions in the console

---

## Test Scenario 6: Single-Worker Fallback — Small Scenario Count

**Purpose**: Verify that for fewer than 8 scenarios, the system falls back to single-worker mode (no unnecessary multi-worker overhead).

**Optimization**: 1P — `MIN_SCENARIOS_FOR_MULTI = 8` threshold

### Steps

1. Create a parameterized test with **5 iterations** of a single scenario
2. Run the test
3. Open DevTools → Sources or Performance tab to verify only 1 Worker thread is active

### Expected Outcomes

- [ ] Test completes normally with all 5 results
- [ ] Only 1 Worker is spawned (check DevTools → Sources → Workers)
- [ ] No multi-worker overhead for small test runs
- [ ] Results are identical to what you'd expect from single-worker

---

## Test Scenario 7: Single-Worker Fallback — Workflow Mode

**Purpose**: Verify that workflow execution always uses single-worker mode regardless of scenario count.

**Optimization**: 1P — Workflow fallback (graph dependencies prevent splitting)

### Steps

1. Create a workflow with 3 HTTP nodes and variable extraction between them
2. Run Quick Test (single iteration)
3. Run workflow load test with **iterations = 20**, **concurrency = 5**

### Expected Outcomes

- [ ] Quick Test: completes normally, variables flow between nodes
- [ ] Load test: all 20 iterations complete with correct results
- [ ] Single worker used (no multi-worker splitting for workflows)
- [ ] Variable extraction and substitution works correctly in each iteration

---

## Test Scenario 8: Multi-Worker — High Concurrency Stress

**Purpose**: Stress test the multi-worker system with high iteration count and concurrency to verify stability.

**Optimization**: 1P — All workers under load simultaneously

### Steps

1. Create a parameterized test with **500 iterations**, **concurrency = 50**
2. Target: `GET https://httpbin.org/get`
3. Run the test
4. Monitor: CPU usage (should use multiple cores), memory, any errors

### Expected Outcomes

- [ ] All 500 results are returned
- [ ] CPU utilization shows multiple cores active (check Activity Monitor / Task Manager)
- [ ] No memory leaks (stable memory usage after test completes)
- [ ] No UI freezes during execution
- [ ] RPS is significantly higher than single-worker (target: 2-4x improvement)
- [ ] All results have valid status codes and timing data

---

## Test Scenario 9: Multi-Worker — Uneven Split

**Purpose**: Verify that uneven scenario counts (not divisible by worker count) are handled correctly with no scenarios dropped.

**Optimization**: 1P — `Math.ceil(length / N)` chunking

### Steps

1. Create a parameterized test with **13 iterations** (prime number, not evenly divisible)
2. Run the test

### Expected Outcomes

- [ ] Exactly 13 results are returned
- [ ] No empty chunks cause worker errors
- [ ] All results have correct data
- [ ] Workers with smaller chunks finish faster (no deadlock waiting)

---

## Test Scenario 10: Multi-Worker — Tauri HTTP Proxy

**Purpose**: Verify that multi-worker mode works correctly in Tauri desktop mode where HTTP requests are proxied through the main thread.

**Optimization**: 1P — Each worker sends `http-request` messages, main thread handles them

### Steps

1. Build and run the Tauri desktop app
2. Create a parameterized test with **20 iterations**, **concurrency = 10**
3. Run the test

### Expected Outcomes

- [ ] All 20 results complete successfully
- [ ] HTTP proxy messages are correctly routed (no mixed-up responses)
- [ ] Each worker's `http-request` messages are handled by the main thread
- [ ] No `http-response` messages lost between workers

---

## Test Scenario 11: Combined — Full Tier 1 Integration

**Purpose**: End-to-end validation of ALL Tier 1 optimizations working together — cached prep, combined resolver, connection pool, progress throttle, and multi-worker.

**Optimization**: All Tier 1 items (PR1 + PR2 + PR3 + PR4)

### Steps

1. Create a parameterized test:
   - Endpoint: `POST https://httpbin.org/post`
   - Body: `{"test": "tier1-integration", "timestamp": "{{$timestamp}}"}`
   - Custom headers: `X-Test: tier1`
   - **Iterations = 200**, **concurrency = 50**
2. Run the test and measure:
   - Total time
   - RPS (requests per second)
   - Result completeness
3. Compare against pre-Tier-1 baseline

### Expected Outcomes

- [ ] All 200 results complete successfully
- [ ] RPS is 3-5x higher than pre-Tier-1 baseline
- [ ] Multi-core utilization visible in system monitor
- [ ] Progress updates are smooth (~500ms intervals)
- [ ] All custom headers present in response echo
- [ ] No errors, no hung workers, no UI freeze
- [ ] Memory usage is stable (no leaks from caches or workers)

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Scenarios split correctly across workers | [ ] | Scenarios 1, 9 |
| All results aggregated without loss | [ ] | Scenarios 2, 8 |
| Progress merging from N workers | [ ] | Scenario 3 |
| Abort stops all workers | [ ] | Scenario 4 |
| Error propagation across workers | [ ] | Scenario 5 |
| Fallback for small tests | [ ] | Scenario 6 |
| Fallback for workflow mode | [ ] | Scenario 7 |
| Multi-core CPU utilization | [ ] | Scenario 8 |
| Tauri HTTP proxy with N workers | [ ] | Scenario 10 |
| Full Tier 1 integration | [ ] | Scenario 11 |
