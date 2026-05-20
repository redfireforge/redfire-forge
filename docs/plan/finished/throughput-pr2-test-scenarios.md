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
| 1 | [Connection Pool — High Concurrency](#test-scenario-1-connection-pool--high-concurrency) | [x] | Done |
| 2 | [Connection Pool — Pipelining Effect](#test-scenario-2-connection-pool--pipelining-effect) | [x] | Done |
| 3 | [Vite Proxy — Large Response Body](#test-scenario-3-vite-proxy--large-response-body) | [x] | Done |
| 4 | [Vite Proxy — Response Headers Preserved](#test-scenario-4-vite-proxy--response-headers-preserved) | [x] | Done |
| 5 | [Load Profile — Faster Concurrency Fill](#test-scenario-5-load-profile--faster-concurrency-fill) | [x] | Done |
| 6 | [Load Profile — Progress Reporting Rate](#test-scenario-6-load-profile--progress-reporting-rate) | [x] | Done |
| 7 | [Workflow — HTTP Timeout Default (30s)](#test-scenario-7-workflow--http-timeout-default-30s) | [x] | Done |
| 8 | [Workflow — Timeout Error Reporting](#test-scenario-8-workflow--timeout-error-reporting) | [x] | Done |
| 9 | [Worker — Progress Throttle Under Load](#test-scenario-9-worker--progress-throttle-under-load) | [x] | Done |
| 10 | [Worker — Final Progress Drain](#test-scenario-10-worker--final-progress-drain) | [x] | Done |
| 11 | [Combined — Sustained Load with All Optimizations](#test-scenario-11-combined--sustained-load-with-all-optimizations) | [x] | Done |
| 12 | [Combined — Workflow Load Test at Scale](#test-scenario-12-combined--workflow-load-test-at-scale) | [x] | Done |

---

## Test Scenario 1: Connection Pool — High Concurrency

**Purpose**: Verify that the increased connection pool (512 connections, pipelining=10) handles high-concurrency tests without connection refusal or socket exhaustion.

**Optimization**: 1A — Connection pool tuning (`undici.Agent` with `connections: 512`, `pipelining: 10`, `connect.timeout: 10_000`)

### Steps

1. Go to **Test Harness** → create a **Feature Group** → inside it create a **Scenario** → inside it add a **Test**
2. In the test editor, fill in:
   - **Name**: `Pool High Concurrency`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
3. Click **Save**
4. Go to the **Test Runner** page → check the test in the left sidebar to select it
5. In the execution config panel on the right, set:
   - **Execution Mode**: `pool` (maintains N in-flight continuously — best for sustained concurrency)
   - **Concurrency**: `100`
   - **Iterations**: `200`
6. Click **Run**

### Expected Outcomes

- [x] All 200 requests complete successfully (no socket errors, no connection refused)
- [x] No `ECONNREFUSED`, `ECONNRESET`, or `UND_ERR_CONNECT_TIMEOUT` errors in results
- [x] Throughput is higher than with 128 connections (compare against PR1 baseline)
- [x] Result panel shows clean completion without partial failures

---

## Test Scenario 2: Connection Pool — Pipelining Effect

**Purpose**: Verify that HTTP pipelining (10 requests per connection) reduces latency for sequential requests to the same origin.

**Optimization**: 1A — Connection pool tuning (`pipelining: 10`)

### Steps

1. Use the same test from Scenario 1 (or create a new one: Name `Pipelining Effect`, Method `GET`, URL `https://httpbin.org/get`)
2. Go to **Test Runner** → select the test
3. Set **Execution Mode**: `pool`, **Concurrency**: `20`, **Iterations**: `100`
4. Click **Run** and note the total execution time shown in the results panel
5. Compare against any PR1 baseline run you saved (with pipelining=1)

### Expected Outcomes

- [x] Total execution time is measurably lower than with pipelining=1
- [x] All responses are correctly matched (no response mixing/corruption from pipelining)
- [x] Response bodies and status codes are accurate for each request
- [x] No "connection reset" or protocol-level errors

---

## Test Scenario 3: Vite Proxy — Large Response Body

**Purpose**: Verify that the `Buffer.concat` optimization in the Vite proxy handles response bodies correctly without corruption. Note: the engine truncates stored response bodies to 2000 characters (`responseBody.slice(0, 2000)` in `requestExecution.ts`) to conserve memory during batch runs, so use an endpoint whose response fits within that limit.

**Optimization**: 1F — `Buffer.concat` for body accumulation (was string concatenation)

### Steps

1. Go to **Test Harness** → create a Feature Group → Scenario → **Test**:
   - **Name**: `Response Body Integrity`
   - **Method**: `GET`
   - **URL**: `https://jsonplaceholder.typicode.com/posts/1` (returns a single post object, ~300 bytes — well within the 2000-char storage limit)
2. Click **Save**
3. Go to **Test Runner** → select the test
4. First run: set **Iterations**: `1` → click **Run** → click the result row to open the response detail modal → verify the response body is complete, valid JSON with all fields (`userId`, `id`, `title`, `body`)
5. Second run: set **Execution Mode**: `pool`, **Iterations**: `20`, **Concurrency**: `5` → click **Run**
6. Spot-check several result rows — each should have the same complete JSON response

### Expected Outcomes

- [x] Single request: response body is complete valid JSON (`{"userId":1,"id":1,"title":"...","body":"..."}`)
- [x] Batch: all 20 responses show the same complete JSON body (no truncation, no corruption)
- [x] No "Invalid JSON" or "Unexpected end of JSON" errors
- [x] Response timing values are reasonable (not NaN or negative)

---

## Test Scenario 4: Vite Proxy — Response Headers Preserved

**Purpose**: Verify that the `forEach` header collection correctly captures all response headers (replacing `Object.fromEntries(entries())`).

**Optimization**: 1F — `response.headers.forEach((v, k) => { resHeaders[k] = v; })`

### Steps

1. Go to **Test Harness** → create a Feature Group → Scenario → **Test**:
   - **Name**: `Response Headers Check`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/response-headers?Content-Type=application/json&X-Custom=test123`
2. Click **Save**
3. Go to **Test Runner** → select the test → set **Iterations**: `1` → click **Run**
4. Click the result row to open the **Response Detail** modal
5. Check the **Response Headers** section

### Expected Outcomes

- [x] `content-type` header is present and correct in response headers
- [x] `x-custom` header shows `test123` in response headers
- [x] Standard headers (`date`, `server`, etc.) are all captured
- [x] No missing or duplicated headers compared to browser DevTools

---

## Test Scenario 5: Load Profile — Faster Concurrency Fill

**Purpose**: Verify that the 100ms fill ticker provides faster VU ramp-up compared to the previous 500ms interval.

**Optimization**: 1C — `setInterval(fillPool, 100)` (was 500ms); progress reporting gated by `now - lastProgressTime >= 500`

### Steps

1. Use any existing test (e.g., `GET https://httpbin.org/get`)
2. Go to **Test Runner** → select the test
3. Set **Execution Mode**: `load-profile`
4. Configure the load profile:
   - **Type**: `ramp-up`
   - **Max Concurrency**: `50`
   - **Duration**: `30` seconds
   - **Ramp-Up Time**: `30` seconds (fills the full duration)
5. Click **Run** and watch the **Live Progress Panel**
6. Observe the "Current In-Flight" metric as it ramps from 1 → 50

### Expected Outcomes

- [x] VU count increases smoothly (5× more frequent fill checks than before)
- [x] Ramp-up curve appears linear/gradual instead of stepping in 500ms jumps
- [x] Target concurrency is reached within 1–2 seconds of the profile reaching that point
- [x] No excessive CPU usage or UI jank from the faster timer

> **Note — tail drain time**: After the configured duration (e.g., 30s) expires, no new requests are launched, but in-flight requests must still complete. The total wall time will exceed the configured duration by the response time of the slowest in-flight request. For example, with 50 concurrent requests to `httpbin.org/get` (~2–3s avg response), expect ~5–15s of extra drain time after the progress bar shows 30/30s. The completion screen only appears once all in-flight requests have finished (`inFlight === 0`). This is expected behavior, not a hang.

---

## Test Scenario 6: Load Profile — Progress Reporting Rate

**Purpose**: Verify that progress UI updates still occur at ~500ms intervals (not 100ms) despite the faster fill ticker, preventing UI flooding.

**Optimization**: 1C — Decoupled: fill ticker at 100ms, progress reporting gated at 500ms

### Steps

1. Use any existing test (e.g., `GET https://httpbin.org/get`)
2. Go to **Test Runner** → select the test
3. Set **Execution Mode**: `load-profile`
4. Configure the load profile:
   - **Type**: `sustained`
   - **Max Concurrency**: `20`
   - **Duration**: `20` seconds
5. Open browser **DevTools → Performance** tab and start recording
6. Click **Run** and watch the progress panel update frequency
7. Stop the Performance recording after the run completes

### Expected Outcomes

- [x] Progress bar and metrics update approximately every 500ms (not 100ms)
- [x] Results counter increments smoothly without flooding
- [x] No UI lag or excessive re-renders visible in DevTools
- [x] Final result count matches the actual number of completed requests

> **Note — tail drain time**: Same as Scenario 5 — total wall time will exceed the configured 20s duration while remaining in-flight requests complete. This is expected.

---

## Test Scenario 7: Workflow — HTTP Timeout Default (30s)

**Purpose**: Verify that workflow HTTP nodes now have a default 30-second timeout (`httpTimeoutMs: 30_000`) that prevents indefinite hangs.

**Optimization**: 1K — `withTimeout(httpFetch(...), timeoutMs)` using `Promise.race`; error message: `"Request timeout (30s)"`

> **Note**: `httpbin.org/delay/N` caps at 10 seconds, and non-routable IPs like `10.255.255.1` hit the lower-level undici connect timeout (10s) before the 30s HTTP timeout. Use `httpbin.org/drip?delay=60` instead — it completes the TCP handshake but then hangs for 60s before sending data, which triggers the 30s `withTimeout` / `Promise.race`.

### Steps

1. Go to **Workflows** → click **+ New Workflow** to create a new workflow
2. From the palette, drag an **HTTP** node onto the canvas and connect it: **Start → HTTP → End**
3. Click the HTTP node to open its config panel. Fill in:
   - **Label**: `Delay 5s`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/delay/5`
4. Click **Quick Test** (play button in the toolbar) → should complete in ~5 seconds with status 200
5. Click the HTTP node again and change the URL to `https://httpbin.org/drip?duration=60&numbytes=1&code=200&delay=60` (connects but hangs for 60s — exceeds the 30s timeout)
6. Click **Quick Test** again → should fail after ~30 seconds with a timeout error
7. Check the console panel at the bottom and the node status overlay on the canvas

### Expected Outcomes

- [x] 5s delay: request completes normally with status 200
- [x] Drip endpoint: request fails after ~30s with `"Request timeout (30s)"` error message
- [x] Timeout error is properly captured in the workflow result (node shows red/fail state)
- [x] No dangling timer warnings or uncaught promise rejections in console

---

## Test Scenario 8: Workflow — Timeout Error Reporting

**Purpose**: Verify that timeout errors from workflow HTTP nodes are properly reported with clear messages and don't leave the workflow in an inconsistent state.

**Optimization**: 1K — `Promise.race` timeout wrapper with `clearTimeout` on success; `toErrorMessage(err)` captures the timeout message

### Steps

1. Go to **Workflows** → create a new workflow
2. From the palette, drag 3 **HTTP** nodes onto the canvas
3. Connect them in sequence: **Start → Node A → Node B → Node C → End**
4. Configure each node (click to open config):
   - **Node A**: Label `Fast GET`, Method `GET`, URL `https://httpbin.org/get`
   - **Node B**: Label `Will Timeout`, Method `GET`, URL `https://httpbin.org/drip?duration=60&numbytes=1&code=200&delay=60` (connects but hangs 60s — exceeds 30s timeout)
   - **Node C**: Label `After Timeout`, Method `GET`, URL `https://httpbin.org/get`
5. Click **Quick Test** and wait for it to complete (~30s for the timeout on Node B)
6. Observe each node's status overlay on the canvas and check the console panel

### Expected Outcomes

- [x] Node A completes with status 200 (green/pass state)
- [x] Node B fails after ~30s with `"Request timeout (30s)"` error message (red/fail state)
- [x] Node C execution depends on workflow error handling (skip on error or continue)
- [x] Console log shows the timeout message clearly
- [x] No dangling timers after test completes (no delayed console output)

---

## Test Scenario 9: Worker — Progress Throttle Under Load

**Purpose**: Verify that the 250ms progress throttle in the Web Worker reduces `postMessage` frequency without losing result data.

**Optimization**: 1G — `PROGRESS_THROTTLE_MS = 250`; buffers `pendingNewResults` between posts; merges on next flush

### Steps

1. Use any existing test (e.g., `GET https://httpbin.org/get`)
2. Go to **Test Runner** → select the test
3. Set **Execution Mode**: `pool`, **Concurrency**: `50`, **Iterations**: `500`
4. Open browser **DevTools → Performance** tab and start recording
5. Click **Run** (Web Worker execution is the default in browser mode)
6. After the run completes, stop recording and look at `postMessage` events in the flame chart

### Expected Outcomes

- [x] Progress updates are visibly smooth (no stuttering or UI freeze)
- [x] All 500 results are captured in the final results table
- [x] `postMessage` frequency is ~4/second (every 250ms), not 20+/second as before
- [x] No "dropped" results — final count matches 500 exactly

---

## Test Scenario 10: Worker — Final Progress Drain

**Purpose**: Verify that any pending throttled progress message is flushed before the `done` message is sent, ensuring no results are lost at the end of a run.

**Optimization**: 1G — `if (hasPending) { postMsg({ type: 'progress', ... pendingNewResults }); }` before `postMsg({ type: 'done', ... })`

### Steps

1. Go to **Test Harness** → create a Feature Group → Scenario → **Test**:
   - **Name**: `Slow 1s Delay`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/delay/1` (1-second delay per request)
2. Click **Save**
3. Go to **Test Runner** → select the test
4. Set **Execution Mode**: `sequential`, **Iterations**: `3` (concurrency is fixed to 1 in sequential mode)
5. Click **Run** (Web Worker is the default in browser mode)
6. After completion, verify all 3 results appear in the results panel

### Expected Outcomes

- [x] All 3 results are present (no missing last result due to throttle window)
- [x] Results appear in order (result 1, 2, 3)
- [x] "Done" state is reached cleanly without delay after last result
- [x] Result panel shows correct pass/fail status for each

---

## Test Scenario 11: Combined — Sustained Load with All Optimizations

**Purpose**: End-to-end validation that all PR2 optimizations work together under sustained load — pool tuning, proxy improvements, faster fill, and throttled progress.

**Optimization**: All PR2 items (1A, 1F, 1C, 1K, 1G)

### Steps

1. Go to **Test Harness** → create a Feature Group → Scenario → **Test**:
   - **Name**: `Sustained Load POST`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `json`
   - **Body**: `{"test": "value"}`
2. Click **Save**
3. Go to **Test Runner** → select the test
4. Set **Execution Mode**: `load-profile`
5. Configure the load profile:
   - **Type**: `sustained`
   - **Max Concurrency**: `30`
   - **Duration**: `60` seconds
6. Click **Run** and monitor:
   - Progress panel smoothness (should update ~every 500ms)
   - RPS counter in real-time
   - Final results count
7. Compare RPS against PR1 baseline (if available)

### Expected Outcomes

- [x] Test runs for full 60 seconds without crashes or hangs
- [x] RPS is measurably improved compared to PR1 baseline (~20–40% improvement expected)
- [x] Progress panel updates smoothly every ~500ms
- [x] All results have valid status codes and timing data
- [x] No memory leaks visible (check DevTools → Memory tab)
- [x] No console errors during execution

> **Note — tail drain time**: Same as Scenario 5 — total wall time will exceed the configured 60s duration while remaining in-flight requests complete. Expect the TPS chart to spike briefly at the end as throttled progress is flushed. This is expected.

---

## Test Scenario 12: Combined — Workflow Load Test at Scale

**Purpose**: Verify that the combined improvements (pool tuning, graph timeout, throttled progress) handle workflow load testing at higher scale.

**Optimization**: All PR2 items working together in workflow mode

### Steps

1. Go to **Workflows** → create a new workflow
2. From the palette, drag 3 **HTTP** nodes onto the canvas
3. Connect them in sequence: **Start → Node A → Node B → Node C → End**
4. Configure each node:
   - **Node A**: Label `GET Users`, Method `GET`, URL `https://httpbin.org/get`
   - **Node B**: Label `POST Data`, Method `POST`, URL `https://httpbin.org/post`, Body `{"workflow": "test"}`
   - **Node C**: Label `Status Check`, Method `GET`, URL `https://httpbin.org/status/200`
5. **Save** the workflow
6. Go to **Workflow Runner** → select the workflow from the dropdown
7. Set **Iterations**: `50`, **Concurrency**: `10`
8. Click **Run** and monitor progress until completion

### Expected Outcomes

- [x] All 50 iterations complete (150 total HTTP requests across 3 nodes × 50 iterations)
- [x] Each iteration shows 3 results (A, B, C) in the results panel
- [x] 30s timeout protection prevents any hung iterations
- [x] Progress reports show increasing count at ~500ms intervals
- [x] No connection pool exhaustion errors
- [x] Final results panel shows all 150 results with timing data

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Connection pool handles 512 connections | [x] | Scenarios 1, 2 |
| Pipelining doesn't corrupt responses | [x] | Scenario 2 |
| Buffer.concat handles large bodies | [x] | Scenario 3 |
| Response headers fully captured | [x] | Scenario 4 |
| 100ms fill → faster VU ramp | [x] | Scenario 5 |
| Progress at 500ms (not 100ms) | [x] | Scenario 6 |
| 30s HTTP timeout in workflows | [x] | Scenarios 7, 8 |
| Worker throttle reduces postMessage | [x] | Scenario 9 |
| Throttle drain preserves final data | [x] | Scenario 10 |
| All optimizations work under load | [x] | Scenarios 11, 12 |
