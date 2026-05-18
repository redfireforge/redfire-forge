# Throughput PR 2 — Test Scenarios for Visual Verification

> PR 2: Transport & Scheduling Improvements
> Completed: 2026-05-18
> Branch: `feature/review-status`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/shared/utils/httpClient.ts` | 1A: Connection pool tuning (512 connections, pipelining=10, 10s connect timeout) |
| `vite.config.ts` | 1A: Pool tuning; 1F: Buffer.concat body, in-place header mutation, forEach for response headers, hoisted round2 |
| `src/engine/loadProfileRunner.ts` | 1C: 100ms fill ticker decoupled from 500ms progress reporting |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | 1K: Timeout-aware HTTP fetch with Promise.race |
| `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` | 1K: Added `httpTimeoutMs` field to context interface |
| `src/features/workflow/engine/graphRunnerHttpHandler.ts` | 1K: Thread `httpTimeoutMs` through to executeHttpNode |
| `src/features/workflow/engine/graphRunner.ts` | 1K: Default httpTimeoutMs=30s in context builder |
| `src/engine/executionWorker.ts` | 1G: 250ms progress throttle with pending drain on completion |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Connection Pool — High Concurrency](#test-scenario-1-connection-pool--high-concurrency) | [ ] | |
| 2 | [Connection Pool — Pipelining Effect](#test-scenario-2-connection-pool--pipelining-effect) | [ ] | |
| 3 | [Vite Proxy — Large Response Body](#test-scenario-3-vite-proxy--large-response-body) | [ ] | |
| 4 | [Vite Proxy — Response Headers Preserved](#test-scenario-4-vite-proxy--response-headers-preserved) | [ ] | |
| 5 | [Load Profile — Faster Concurrency Fill](#test-scenario-5-load-profile--faster-concurrency-fill) | [ ] | |
| 6 | [Load Profile — Progress Reporting Rate](#test-scenario-6-load-profile--progress-reporting-rate) | [ ] | |
| 7 | [Workflow — HTTP Timeout Default (30s)](#test-scenario-7-workflow--http-timeout-default-30s) | [ ] | |
| 8 | [Workflow — Timeout Error Reporting](#test-scenario-8-workflow--timeout-error-reporting) | [ ] | |
| 9 | [Worker — Progress Throttle Under Load](#test-scenario-9-worker--progress-throttle-under-load) | [ ] | |
| 10 | [Worker — Final Progress Drain](#test-scenario-10-worker--final-progress-drain) | [ ] | |
| 11 | [Combined — Sustained Load with All Optimizations](#test-scenario-11-combined--sustained-load-with-all-optimizations) | [ ] | |
| 12 | [Combined — Workflow Load Test at Scale](#test-scenario-12-combined--workflow-load-test-at-scale) | [ ] | |

---

## Test Scenario 1: Connection Pool — High Concurrency

**Purpose**: Verify that the increased connection pool (512 connections, pipelining=10) handles high-concurrency parameterized tests without connection refusal or socket exhaustion.

**Optimization**: 1A — Connection pool tuning

### Steps

1. Create a parameterized test targeting a fast HTTP endpoint (e.g., `GET https://httpbin.org/get`)
2. Set **iterations = 200**, **concurrency = 100** in batch mode
3. Run the test

### Expected Outcomes

- [ ] All 200 requests complete successfully (no socket errors, no connection refused)
- [ ] No `ECONNREFUSED`, `ECONNRESET`, or `UND_ERR_CONNECT_TIMEOUT` errors in results
- [ ] Throughput is higher than with 128 connections (compare against PR1 baseline)
- [ ] Result panel shows clean completion without partial failures

---

## Test Scenario 2: Connection Pool — Pipelining Effect

**Purpose**: Verify that HTTP pipelining (10 requests per connection) reduces latency for sequential requests to the same origin.

**Optimization**: 1A — Connection pool tuning (pipelining=10)

### Steps

1. Create a parameterized test targeting a single origin endpoint
2. Set **iterations = 100**, **concurrency = 20** in batch mode
3. Run the test and note total execution time
4. Compare against the same test run before PR2 (with pipelining=1)

### Expected Outcomes

- [ ] Total execution time is measurably lower than with pipelining=1
- [ ] All responses are correctly matched (no response mixing/corruption from pipelining)
- [ ] Response bodies and status codes are accurate for each request
- [ ] No "connection reset" or protocol-level errors

---

## Test Scenario 3: Vite Proxy — Large Response Body

**Purpose**: Verify that the Buffer.concat optimization handles large response bodies correctly without corruption or memory issues.

**Optimization**: 1F — Buffer.concat for body accumulation (was string concatenation)

### Steps

1. Create a request to an endpoint that returns a large JSON body (>100KB), e.g., `GET https://jsonplaceholder.typicode.com/photos`
2. Run a single request first — verify response body is complete and valid JSON
3. Run as parameterized test with **iterations = 20**, **concurrency = 5**
4. Verify all 20 response bodies are complete and identical

### Expected Outcomes

- [ ] Single request: response body is valid JSON, no truncation
- [ ] Batch: all 20 responses are complete and match expected body size
- [ ] No "Invalid JSON" or "Unexpected end of JSON" errors
- [ ] Response timing values are reasonable (not NaN or negative)

---

## Test Scenario 4: Vite Proxy — Response Headers Preserved

**Purpose**: Verify that the `forEach` header collection correctly captures all response headers (replacing `Object.fromEntries(entries())`).

**Optimization**: 1F — forEach for response headers

### Steps

1. Create a `GET` request to `https://httpbin.org/response-headers?Content-Type=application/json&X-Custom=test123`
2. Run the request
3. Inspect the response headers in the result panel

### Expected Outcomes

- [ ] `content-type` header is present and correct in response headers
- [ ] `x-custom` header shows `test123` in response headers
- [ ] Standard headers (`date`, `server`, etc.) are all captured
- [ ] No missing or duplicated headers compared to browser DevTools

---

## Test Scenario 5: Load Profile — Faster Concurrency Fill

**Purpose**: Verify that the 100ms fill ticker provides faster VU ramp-up compared to the previous 500ms interval.

**Optimization**: 1C — 100ms fill ticker (was 500ms)

### Steps

1. Create a load profile test with **ramp-up** shape:
   - Start concurrency: 1
   - End concurrency: 50
   - Duration: 30 seconds
2. Run the test and observe the progress panel
3. Watch the "Current In-Flight" metric

### Expected Outcomes

- [ ] VU count increases more smoothly (5× more frequent fill checks)
- [ ] Ramp-up curve appears more linear/gradual instead of stepping in 500ms jumps
- [ ] Target concurrency is reached within 1-2 seconds of the profile reaching that point
- [ ] No excessive CPU usage or UI jank from the faster timer

---

## Test Scenario 6: Load Profile — Progress Reporting Rate

**Purpose**: Verify that progress UI updates still occur at ~500ms intervals (not 100ms) despite the faster fill ticker, preventing UI flooding.

**Optimization**: 1C — Decoupled progress reporting (500ms) from fill ticker (100ms)

### Steps

1. Create a sustained load profile: **concurrency = 20**, **duration = 20 seconds**
2. Run the test
3. Observe the progress panel update frequency
4. Open browser DevTools → Performance tab to check for excessive re-renders

### Expected Outcomes

- [ ] Progress bar and metrics update approximately every 500ms (not 100ms)
- [ ] Results counter increments smoothly without flooding
- [ ] No UI lag or excessive re-renders visible in DevTools
- [ ] Final result count matches the actual number of completed requests

---

## Test Scenario 7: Workflow — HTTP Timeout Default (30s)

**Purpose**: Verify that workflow HTTP nodes now have a default 30-second timeout that prevents indefinite hangs.

**Optimization**: 1K — Add timeout to graph HTTP execution (default 30s)

### Steps

1. Create a workflow with a single HTTP node targeting `https://httpbin.org/delay/5` (5-second delay)
2. Run Quick Test → should complete successfully within ~5 seconds
3. Now change the target to `https://httpbin.org/delay/35` (35-second delay, exceeds 30s timeout)
4. Run Quick Test → should timeout after ~30 seconds

### Expected Outcomes

- [ ] 5s delay: request completes normally with status 200
- [ ] 35s delay: request fails with "Request timeout (30s)" error message
- [ ] Timeout error is properly captured in the workflow result (shows in node status)
- [ ] No dangling timer warnings or uncaught promise rejections in console

---

## Test Scenario 8: Workflow — Timeout Error Reporting

**Purpose**: Verify that timeout errors from workflow HTTP nodes are properly reported with clear messages and don't leave the workflow in an inconsistent state.

**Optimization**: 1K — Promise.race timeout wrapper with clearTimeout on success

### Steps

1. Create a workflow with 3 sequential HTTP nodes:
   - Node A: `GET https://httpbin.org/get` (fast)
   - Node B: `GET https://httpbin.org/delay/35` (will timeout)
   - Node C: `GET https://httpbin.org/get` (should still execute depending on error config)
2. Run Quick Test

### Expected Outcomes

- [ ] Node A completes with status 200 (pass)
- [ ] Node B fails with "Request timeout (30s)" message
- [ ] Node B shows red/fail state in the workflow canvas
- [ ] Node C execution depends on workflow error config (skip or continue)
- [ ] Console log shows the timeout message clearly
- [ ] No dangling timers after test completes (verify: no delayed console output)

---

## Test Scenario 9: Worker — Progress Throttle Under Load

**Purpose**: Verify that the 250ms progress throttle in the Web Worker reduces postMessage frequency without losing result data.

**Optimization**: 1G — 250ms progress message throttle

### Steps

1. Create a parameterized test with **iterations = 500**, **concurrency = 50** (fast endpoint)
2. Enable Web Worker execution (ensure it's the default in browser mode)
3. Run the test
4. Open DevTools → Performance tab → observe postMessage events

### Expected Outcomes

- [ ] Progress updates are visibly smooth (no stuttering or UI freeze)
- [ ] All 500 results are captured in the final results table
- [ ] postMessage frequency is ~4/second (not 20+/second as before)
- [ ] No "dropped" results — final count matches iteration count exactly

---

## Test Scenario 10: Worker — Final Progress Drain

**Purpose**: Verify that any pending throttled progress message is flushed before the `done` message is sent, ensuring no results are lost.

**Optimization**: 1G — `pendingProgress` drain before `done` message

### Steps

1. Create a parameterized test with **iterations = 3**, **concurrency = 1** (slow endpoint, e.g., 1s delay)
2. Run the test in Web Worker mode
3. Verify all 3 results appear in the results panel

### Expected Outcomes

- [ ] All 3 results are present (no missing last result due to throttle window)
- [ ] Results appear in order (r-1, r-2, r-3)
- [ ] "Done" state is reached cleanly without delay after last result
- [ ] Result panel shows correct pass/fail status for each

---

## Test Scenario 11: Combined — Sustained Load with All Optimizations

**Purpose**: End-to-end validation that all PR2 optimizations work together under sustained load — pool tuning, proxy improvements, faster fill, and throttled progress.

**Optimization**: All PR2 items (1A, 1F, 1C, 1K, 1G)

### Steps

1. Create a load profile test:
   - Endpoint: `POST https://httpbin.org/post` with a JSON body `{"test": "value"}`
   - Shape: **sustained**, concurrency = 30, duration = 60 seconds
2. Run the test and monitor:
   - Progress panel smoothness
   - RPS counter in real-time
   - Final results count
3. Compare RPS against PR1 baseline

### Expected Outcomes

- [ ] Test runs for full 60 seconds without crashes or hangs
- [ ] RPS is measurably improved compared to PR1 baseline (~20-40% improvement expected)
- [ ] Progress panel updates smoothly every ~500ms
- [ ] All results have valid status codes and timing data
- [ ] No memory leaks visible (check DevTools → Memory tab)
- [ ] No console errors during execution

---

## Test Scenario 12: Combined — Workflow Load Test at Scale

**Purpose**: Verify that the combined improvements (pool tuning, graph timeout, throttled progress) handle workflow load testing at higher scale.

**Optimization**: All PR2 items working together in workflow mode

### Steps

1. Create a workflow with 3 HTTP nodes in sequence:
   - Node A: `GET https://httpbin.org/get`
   - Node B: `POST https://httpbin.org/post` with body
   - Node C: `GET https://httpbin.org/status/200`
2. Run as workflow load test: **iterations = 50**, **concurrency = 10**
3. Monitor progress and verify completion

### Expected Outcomes

- [ ] All 50 iterations complete (150 total HTTP requests)
- [ ] Each iteration shows 3 results (A, B, C)
- [ ] Timeout protection prevents any hung iterations
- [ ] Progress reports show increasing count at ~500ms intervals
- [ ] No connection pool exhaustion errors
- [ ] Final results panel shows all 150 results with timing data

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Connection pool handles 512 connections | [ ] | Scenarios 1, 2 |
| Pipelining doesn't corrupt responses | [ ] | Scenario 2 |
| Buffer.concat handles large bodies | [ ] | Scenario 3 |
| Response headers fully captured | [ ] | Scenario 4 |
| 100ms fill → faster VU ramp | [ ] | Scenario 5 |
| Progress at 500ms (not 100ms) | [ ] | Scenario 6 |
| 30s HTTP timeout in workflows | [ ] | Scenarios 7, 8 |
| Worker throttle reduces postMessage | [ ] | Scenario 9 |
| Throttle drain preserves final data | [ ] | Scenario 10 |
| All optimizations work under load | [ ] | Scenarios 11, 12 |
