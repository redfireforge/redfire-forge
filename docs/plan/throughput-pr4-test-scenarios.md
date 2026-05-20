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
- **Fallback to single worker**: workflow mode, **fewer than 8 selected tests** in batch/pool/sequential mode, or 1 core
- **Load profile mode**: always multi-worker if concurrency ≥ 2 (workers split concurrency, not the scenario queue)
- **Each worker**: runs `runTest()` independently with its chunk and proportional concurrency

> ⚠️ **Important — what counts as a "scenario" for the multi-worker threshold:**
> The threshold counts **selected tests** in the runner, NOT iterations. With 1 test × 100 iterations, `scenarios.length = 1` → single-worker fallback. To trigger multi-worker in batch/pool/sequential modes you must either **(a) select 8 or more tests** in the runner sidebar, or **(b) switch to load-profile mode** (any test count works).

---

## Shared Test Set (create once, reuse across most scenarios)

Several scenarios below require ≥ 8 tests selected. Create this set **once** at the start, then reuse it.

1. Go to **Test Harness** → create a Feature Group named `PR4 Multi-Worker`
2. Inside it, create a Scenario named `Worker Pool` (parameterized scenario kind is fine)
3. Add **13 tests** to that Scenario. The fastest way: create one `Test 01` and then **Duplicate** it 12 times (rename to `Test 02` … `Test 13`). Configure each identically unless a specific scenario below says otherwise:
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get?test={{$ord}}` (use the test number in the query so results are visibly distinct, e.g., `test=01`, `test=02`, ...). If the harness has no auto-counter, just hard-code `test=01`, `test=02`, etc.
   - **Body Type**: `No Body`
   - **Save** each
4. In the **Test Runner** sidebar, expand `PR4 Multi-Worker → Worker Pool` and check all 13 tests. Confirm the runner shows **"13 tests"** somewhere on the page

This gives you a multi-worker-eligible run for all scenarios that need it. Some scenarios will tell you to reduce or change this set.

---

## Quick reference: verifying worker count in DevTools

For any scenario that asks "verify N workers are spawned":

1. Open the app in Chrome (web dev) → **DevTools → Sources panel**
2. In the right sidebar, expand the **Threads** section (or **Workers**, depending on Chrome version) — each active Web Worker is listed there as `executionWorker.ts`
3. Start your test and watch the list — workers appear when spawned and disappear when terminated
4. To confirm your machine's expected worker count, open DevTools Console and run:
   ```js
   Math.max(1, Math.min((navigator.hardwareConcurrency ?? 2) - 1, 8))
   ```
   This is the value `getWorkerCount()` returns

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

**Purpose**: Verify the runner splits the selected-test queue into N chunks (one per worker) and that all chunks together produce the full result set with no overlap and no losses.

**Optimization**: 1P — `runTestMultiWorker()` chunking via `scenarios.slice(i*chunkSize, (i+1)*chunkSize)`

### Steps

**Part A — Run the shared test set**

1. Use the shared `PR4 Multi-Worker → Worker Pool` set (13 tests) from the setup section
2. Go to **Test Runner** → confirm all 13 tests are checked in the sidebar
3. Set **Execution Mode**: `batch`, **Concurrency**: `10`, **Iterations**: `1`
4. **Before clicking Run**: open DevTools → Sources → Threads panel
5. Click **Run** — watch the Threads panel; you should see N workers spawn (typically 7–8 on Apple Silicon / modern Intel; run the worker-count snippet from the Quick Reference to confirm your N)

**Part B — Verify split and aggregation**

6. After the run finishes, count rows in the results table — should be exactly **13**
7. Sort or scroll the results — confirm every test name `Test 01`…`Test 13` appears exactly once (no duplicates, no missing)
8. Spot-check 2–3 rows to confirm each result has a unique `id` (visible in the URL/details panel) and the URL's `test=NN` matches the row label

### Expected Outcomes

- [ ] DevTools shows N workers spawned at the start of the run, where N = `min(hardwareConcurrency - 1, 8)`
- [ ] Exactly 13 results in the results table (no duplicates, no missing)
- [ ] Every `Test 01`…`Test 13` row is present exactly once
- [ ] No errors in the run status bar; no red rows
- [ ] Workers terminate cleanly after the run (DevTools Threads panel clears)

---

## Test Scenario 2: Multi-Worker — Result Completeness

**Purpose**: Verify that under sustained load with all N workers active, every single completed request is captured in the aggregated result set. This is a stress check on the `allResults.push(r)` aggregation in the main thread's worker handler.

**Optimization**: 1P — Per-worker `progress` message aggregation in `createWorkerHandler`

> Multi-worker triggers in **load-profile** mode regardless of test count. We use 1 test in load-profile so we can easily count expected totals from RPS × duration.

### Steps

**Part A — Create a single fast test**

1. Go to **Test Harness** → in `PR4 Multi-Worker → Worker Pool` (or new), add a Test:
   - **Name**: `Completeness Probe`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"probe": true}`
   - **Save**

**Part B — Run in load-profile mode**

2. Go to **Test Runner** → uncheck the 13 from Scenario 1 → check ONLY `Completeness Probe`
3. Set **Execution Mode**: `load-profile`
4. Configure: **Shape**: `sustained`, **Concurrency**: `20`, **Duration**: `10s`
5. Open DevTools → Sources → Threads, then click **Run**
6. Note the total request count displayed when the run finishes (e.g., "1,247 requests")

**Part C — Verify completeness**

7. Confirm the results table row count **exactly matches** the summary count from step 6 — no missing rows, no extras
8. Sort results by `responseTimeMs` ascending — confirm every row has a numeric value > 0 (no `null`/`undefined`)
9. Sort by `httpStatus` — confirm every row shows 200 (or a small consistent set of statuses if httpbin had transient issues)
10. Confirm DevTools showed N workers active during the run (matches Quick Reference snippet)

### Expected Outcomes

- [ ] Results table row count exactly equals the summary "Total requests" count (zero loss across worker boundaries)
- [ ] Every result has a valid `httpStatus` (200 expected; document any transient rate-limit responses)
- [ ] Every result has `responseTimeMs > 0` (never `null`, `undefined`, or `NaN`)
- [ ] N workers were active during the run (DevTools verification)
- [ ] No "Failed to aggregate result" or similar console warnings

---

## Test Scenario 3: Multi-Worker — Progress Aggregation

**Purpose**: Verify the progress bar correctly sums `completed` counts across all workers (via `completedPerWorker[]`). With N workers running in parallel and each reporting their own completion count, the UI's aggregated counter must equal the **sum** of all worker counts at every tick — never exceed the planned total, never go backward.

**Optimization**: 1P — `completedPerWorker[workerIdx] = msg.completed` aggregation in the progress callback

### Steps

**Part A — Create 12 slow tests for visible progress**

1. Use the shared `PR4 Multi-Worker → Worker Pool` set, but for visible progress, update each test's URL to a slow endpoint:
   - **URL**: `https://httpbin.org/delay/2` (2-second response time per request)
   - (Or duplicate the existing tests into a new Scenario `Slow Worker Pool` to avoid disturbing Scenario 1's setup)

**Part B — Run with visible progress**

2. Go to **Test Runner** → select all 13 slow tests
3. Set **Execution Mode**: `batch`, **Concurrency**: `10`, **Iterations**: `4` (total queue per test = 4 → 52 total requests across the set, runs for ~10s with multi-worker)

   > Note: with batch mode, the threshold of 13 tests triggers multi-worker. The 4 iterations get expanded inside each worker's `runTest()` queue.

4. Click **Run** and **stare at the progress bar**

**Part C — Watch the progress behavior**

5. The progress counter should:
   - Start at `0 / 52` (or whatever the total is)
   - Increment **smoothly** in steps (each step roughly the number of workers, since they finish in batches)
   - Never display a value greater than the total
   - Reach exactly `52 / 52` (100%) when the run completes
6. After completion, the progress bar should hold at 100% (no flicker back to a lower value)

### Expected Outcomes

- [ ] Progress bar starts at 0% and climbs to 100% over the run duration
- [ ] No "phantom" jumps from low to high values (e.g., 5% → 90% → 50% would indicate a race condition in `completedPerWorker` sum)
- [ ] Intermediate count never exceeds the planned total
- [ ] Final count matches the total exactly (no off-by-one)
- [ ] Progress callback fires at a reasonable rate (every ~500ms; not just once at the end)

---

## Test Scenario 4: Multi-Worker — Abort All Workers

**Purpose**: Verify that clicking **Abort** in the runner fans out an abort signal to **every** worker (not just one), causing the entire run to stop quickly with partial results preserved. Without proper fan-out, some workers would keep running in the background after the UI says the test stopped.

**Optimization**: 1P — `abortAll()` posts `{type: 'abort'}` to every worker; `cleanupAll()` terminates them after settle

### Steps

**Part A — Long-running load test**

1. Reuse the `Completeness Probe` test from Scenario 2 (or any slow endpoint). For maximum visibility of abort behavior, point it at a slow endpoint:
   - **URL**: `https://httpbin.org/delay/3`
2. Go to **Test Runner** → select only `Completeness Probe`
3. Set **Execution Mode**: `load-profile`, **Shape**: `sustained`, **Concurrency**: `20`, **Duration**: `60s`
4. Open DevTools → Sources → Threads

**Part B — Abort mid-run**

5. Click **Run** → wait ~5 seconds (you should see ~20 results appear)
6. Click the **Abort** button (usually red, where the Run button was)
7. Start a stopwatch / count "one-Mississippi" — note how long it takes for the run to fully stop

**Part C — Verify clean stop**

8. The run status should change from "Running" to "Aborted" (or similar) within **1–3 seconds** of clicking Abort
9. DevTools Threads panel: all workers should disappear within a couple seconds (no lingering `executionWorker.ts` threads)
10. Results table should still show the partial results that finished BEFORE the abort — these should be intact (not erased)
11. Open DevTools Console — check for any uncaught errors or `Unhandled promise rejection` messages

**Part D — Restart sanity check**

12. After the abort settles, click **Run** again immediately — the test should start cleanly (no "previous run still running" state)

### Expected Outcomes

- [ ] Run reaches a stopped state within 3 seconds of clicking Abort
- [ ] All workers terminate (DevTools Threads list clears within 2–3 seconds)
- [ ] Partial results are preserved in the results table (more than 0, less than the would-have-been total)
- [ ] No `Unhandled promise rejection` or uncaught error messages in the Console
- [ ] Status bar shows "Aborted" (or equivalent) — not stuck on "Running"
- [ ] Starting a new run immediately after works (no stale state blocking)

---

## Test Scenario 5: Multi-Worker — Error Propagation

**Purpose**: Verify that **network-level failures** (DNS lookup failure, connection refused) inside any worker are captured as **structured error results** in the main-thread aggregated output (not as silent drops, hangs, or uncaught promise rejections). Each worker independently catches per-request errors via `executeWithRetry`; the main thread merges them like any other result.

**Optimization**: 1P — Per-worker error handling produces error results that aggregate normally; truly fatal worker errors trigger `abortAll()` + `cleanupAll()`

### Steps

**Part A — Create a test targeting an unreachable host**

1. Go to **Test Harness** → in `PR4 Multi-Worker → Worker Pool` (or new), add a Test:
   - **Name**: `Bad Host Probe`
   - **Method**: `GET`
   - **URL**: `https://nonexistent-host-12345.invalid/api`
   - **Save**
2. Duplicate it 7 times → `Bad Host Probe 02` … `Bad Host Probe 08` (need 8+ for multi-worker in batch mode; OR skip duplication and use load-profile mode in Part B)

**Part B — Run and observe error capture**

3. Go to **Test Runner** → select all 8 Bad Host tests
4. Set **Execution Mode**: `batch`, **Concurrency**: `4`, **Iterations**: `1`
5. Configure: keep retry count at default (probably 0 or 1; check the runner settings)
6. Open DevTools Console (to watch for any uncaught errors)
7. Click **Run**

**Part C — Verify error handling**

8. The run should **complete** (not hang) within a few seconds (or however long the DNS lookup timeout is — usually 5–30s)
9. Results table should show **8 rows**, all in an error state (red status, no httpStatus, or status 0)
10. Click any error row → response detail modal → confirm a **meaningful error message** is present (e.g., `getaddrinfo ENOTFOUND`, `ERR_NAME_NOT_RESOLVED`, `fetch failed`, etc.)
11. Console should be clean — **no** `Uncaught (in promise)` errors, no `Unhandled promise rejection` warnings

### Expected Outcomes

- [ ] All 8 tests produce error result rows (run completes; no hang)
- [ ] Each error row shows a human-readable error message in the detail view
- [ ] DevTools Console has no uncaught exceptions or unhandled rejections from the worker bridge or workers
- [ ] All workers terminate cleanly after the failed run (DevTools Threads clears)
- [ ] A subsequent run on a healthy URL succeeds normally (workers don't get stuck in a bad state)

---

## Test Scenario 6: Single-Worker Fallback — Small Scenario Count

**Purpose**: Verify the runner **skips** multi-worker spawning when fewer than `MIN_SCENARIOS_FOR_MULTI` (= 8) tests are selected in batch/pool/sequential mode. Spawning 7 workers for a 3-test run would be wasteful (worker setup overhead > work done).

**Optimization**: 1P — `MIN_SCENARIOS_FOR_MULTI = 8` threshold in `runTestMultiWorker()` — falls through to `runTestInWorker()` (single worker)

### Steps

**Part A — Run with FEWER than 8 tests selected**

1. Go to **Test Runner** → uncheck any previously selected tests → check **only 5 tests** from the `PR4 Multi-Worker → Worker Pool` (e.g., `Test 01`…`Test 05`)
2. Confirm the runner shows "5 tests"
3. Set **Execution Mode**: `batch`, **Concurrency**: `5`, **Iterations**: `1`
4. Open DevTools → Sources → Threads — note the empty list before running

**Part B — Run and verify single-worker behavior**

5. Click **Run**
6. Watch the DevTools Threads panel during the run — **only 1** `executionWorker.ts` should appear
7. The run should complete normally with **5 results** in the table

**Part C — Boundary check: exactly 8 tests should NOT fall back**

8. After Part B, check 3 more tests (so 8 total are selected) → click **Run** again
9. This time you should see **N workers** spawn (N = `min(hardwareConcurrency - 1, 8)`), confirming the threshold is `< 8` (single worker) vs `>= 8` (multi-worker)

### Expected Outcomes

- [ ] With 5 tests selected: exactly 1 worker spawned (DevTools Threads shows one `executionWorker.ts`)
- [ ] All 5 results returned normally
- [ ] With 8 tests selected: N workers spawned, confirming the threshold boundary
- [ ] No errors or unusual delays in either run
- [ ] Single-worker run is reasonably fast (no overhead from skipped multi-worker setup)

---

## Test Scenario 7: Single-Worker Fallback — Workflow Mode

**Purpose**: Verify that **workflows always run in single-worker mode**, regardless of iteration or concurrency count. Workflows have graph-level dependencies (Node B reads variables extracted by Node A) that cannot be safely split across workers — each workflow execution is an atomic unit and must stay in one worker.

**Optimization**: 1P — `if (workflow) return runTestInWorker(...)` short-circuit in `runTestMultiWorker()`

### Steps

**Part A — Build a 3-node workflow with variable flow**

1. Go to **Workflows** → **+ New Workflow** → name it `Worker Fallback Check`
2. Add three **HTTP** nodes and connect them in sequence: `Node A → Node B → Node C`
3. Configure `Node A`:
   - **Method**: `GET`, **URL**: `https://httpbin.org/uuid`
   - **Extract** tab → variable `uuidA` from `$.uuid`
4. Configure `Node B`:
   - **Method**: `POST`, **URL**: `https://httpbin.org/post`
   - **Body**: `{"received": "{{uuidA}}"}`
   - **Extract** tab → variable `echoedB` from `$.json.received`
5. Configure `Node C`:
   - **Method**: `GET`, **URL**: `https://httpbin.org/get?from-b={{echoedB}}`
6. Save the workflow

**Part B — Quick Test (single execution)**

7. Click **Quick Test** in the workflow toolbar
8. Verify Node A returns a UUID → Node B echoes it back → Node C's URL includes the UUID
9. Open DevTools → Threads — should see **1** `executionWorker.ts` during the Quick Test

**Part C — Workflow load test (many iterations)**

10. Go to **Test Runner** → switch to the **Workflows** tab (or select the workflow target) → select `Worker Fallback Check`
11. Set **Iterations**: `20`, **Concurrency**: `5`
12. Open DevTools → Threads → click **Run**
13. **Critical check**: even with 20 iterations and concurrency=5, you should see **only 1** worker spawned — NOT N workers

**Part D — Verify all iterations completed correctly**

14. Results table should have 20 workflow iteration rows, each with 3 node sub-rows = 60 HTTP requests
15. Spot-check 3 iterations spread across the run — confirm Node B always echoes the unique UUID from its iteration's Node A, and Node C's URL contains that same UUID (no cross-iteration variable leakage)

### Expected Outcomes

- [ ] Quick Test: only 1 worker spawned; all 3 nodes execute with correct variable flow
- [ ] Load test with 20 iterations: still only **1** worker (workflow fallback fires regardless of count)
- [ ] All 20 workflow iterations complete successfully (60 HTTP requests, all 200)
- [ ] Each iteration has its own UUID that flows correctly through Nodes A → B → C with **no cross-iteration variable bleed**
- [ ] No errors related to variable resolution or extraction

---

## Test Scenario 8: Multi-Worker — High Concurrency Stress

**Purpose**: Stress test all N workers running at full concurrency simultaneously to verify stability under load — no UI freezes, no memory leaks, no result corruption, and visible multi-core CPU utilization (proving the workers actually run on separate cores rather than time-sharing one).

**Optimization**: 1P — All N workers running `runTest()` with `concurrency / N` per worker simultaneously

### Steps

**Part A — Set up a fast endpoint and high-concurrency load**

1. Use the `Completeness Probe` test from Scenario 2 (or create one with `POST https://httpbin.org/post` and a small JSON body)
2. Go to **Test Runner** → select only `Completeness Probe`
3. Set **Execution Mode**: `load-profile`, **Shape**: `sustained`, **Concurrency**: `50`, **Duration**: `30s`

**Part B — Capture baseline (single-worker)** *(optional but recommended)*

4. **Before running multi-worker**: temporarily disable multi-worker by selecting < 8 tests AND using batch mode instead. Note the RPS displayed at end of run. This is your baseline.
5. (Or skip baseline if you already have PR3 baseline numbers documented)

**Part C — Run the stress test (multi-worker)**

6. Open **Activity Monitor** (macOS) or **Task Manager** (Windows) → CPU view, sorted by % CPU
7. Note **memory usage** of the browser/Tauri process **before** clicking Run (e.g., 450 MB)
8. Open DevTools → Sources → Threads (to confirm N workers spawn)
9. Click **Run** in the test runner
10. During the run:
    - Confirm DevTools shows **N workers active** (where N = `min(hardwareConcurrency - 1, 8)`)
    - Confirm multiple CPU cores show activity in Activity Monitor (not just one core pegged at 100%)
    - Try clicking around the UI — switching tabs, opening modals — the UI should remain **responsive** (no freezes)
11. After the run completes:
    - Note the final **RPS** value from the runner status bar
    - Wait 10 seconds, then re-check the browser/Tauri process memory — it should settle back close to the baseline (e.g., 450–550 MB), not balloon to multi-GB

### Expected Outcomes

- [ ] All requests complete (results count matches the summary total)
- [ ] DevTools confirmed N workers active throughout the run
- [ ] Activity Monitor shows multiple CPU cores active (not single-threaded)
- [ ] UI remains responsive during the entire 30s run (no spinning beachball, no input lag)
- [ ] RPS is **at least 2× higher** than the single-worker baseline (target: 2–4× depending on core count and network)
- [ ] Memory returns to near-baseline within 10s of run completion (no permanent leak)
- [ ] Every result has valid `httpStatus` and `responseTimeMs > 0` (no corruption from concurrent worker aggregation)

---

## Test Scenario 9: Multi-Worker — Uneven Split

**Purpose**: Verify that an odd test count (not evenly divisible by N workers) is sliced via `Math.ceil(length / N)` and that the trailing worker(s) get smaller chunks **without** any tests being dropped, duplicated, or causing an empty-chunk worker to crash.

**Optimization**: 1P — `Math.ceil(scenarios.length / actualWorkerCount)` chunking with empty-chunk filter (`if (chunk.length > 0) chunks.push(chunk)`)

> Example for N = 8 workers, 13 tests: chunkSize = ⌈13/8⌉ = 2 → chunks are [2,2,2,2,2,2,1,0]. The trailing 0-length chunk is filtered out, so 7 workers actually spawn (each with 2 tests, except the last with 1).

### Steps

**Part A — Select exactly 13 tests**

1. Use the shared `PR4 Multi-Worker → Worker Pool` set (13 tests)
2. Go to **Test Runner** → select all 13 tests
3. Set **Execution Mode**: `batch`, **Concurrency**: `8`, **Iterations**: `1`

**Part B — Run and inspect worker behavior**

4. Open DevTools → Sources → Threads
5. Click **Run**
6. Observe the worker count that spawns — for 13 tests on an 8-core machine:
   - `actualWorkerCount = min(7, 8) = 7` (cores-1 capped at 8)
   - `chunkSize = ceil(13 / 7) = 2`
   - First 6 chunks get 2 tests each (12), 7th chunk gets 1 test, no empty chunks → **7 workers** spawn
   - Adjust expectations for your machine's `hardwareConcurrency` (use the Quick Reference snippet)

**Part C — Verify no test was dropped**

7. Once the run completes, count results — should be exactly **13**
8. Sort results by test name → confirm `Test 01` through `Test 13` are each present **exactly once** (no duplicates, no gaps)
9. Confirm in DevTools that all workers finished within roughly the same time window (the worker with 1 test should finish slightly faster but not get stuck waiting)

### Expected Outcomes

- [ ] Exactly 13 results returned (no missing, no duplicates)
- [ ] Every `Test 01` … `Test 13` appears exactly once
- [ ] No console errors about empty arrays, undefined scenarios, or worker termination
- [ ] No worker hangs or is left running after the others finish (DevTools Threads list clears completely)
- [ ] If you repeat the test with **14** tests selected, the chunk distribution shifts to [2,2,2,2,2,2,2] (7 workers, exactly 2 each) — still no drops

---

## Test Scenario 10: Multi-Worker — Tauri HTTP Proxy

**Purpose**: Verify multi-worker mode works correctly in the Tauri desktop build, where Web Workers **cannot** make HTTP requests directly (the Tauri HTTP plugin lives only on the main thread). Each worker must serialize requests as `http-request` messages, the main thread routes them through Tauri's HTTP plugin, and responses are routed back to the originating worker.

**Optimization**: 1P — Worker→main HTTP proxy with per-worker correlation IDs ensures no response is delivered to the wrong worker

### Steps

**Part A — Run the Tauri desktop build**

1. Build (if not already built): `npx tauri build` → install/launch the `.app` (macOS) or run `npm run tauri:dev` for a dev build
2. Launch the RedfireForge desktop app
3. Confirm you're in Tauri (not web) — look for the native title bar `RedfireForge — Redfire Performance Workbench`, or run `isTauri()` mentally by checking if the window is a native app vs a browser tab

**Part B — Run a multi-worker test with verifiable per-request data**

4. Use the `PR4 Multi-Worker → Worker Pool` set (13 tests)
5. Make sure each test's URL has a **distinct identifier** so proxied responses can be matched back to the right worker. If you used `test={{$ord}}` setup, each URL looks like `https://httpbin.org/get?test=01`, `test=02`, etc.
6. Go to **Test Runner** → select all 13 tests
7. Set **Execution Mode**: `batch`, **Concurrency**: `8`, **Iterations**: `1`
8. Click **Run**

**Part C — Verify no proxy crossover**

9. After the run, open each result row → response detail → check the `args.test` field in the httpbin response
10. **Critical**: confirm `args.test` matches the test number from the row's name (e.g., `Test 05` row → response shows `args.test = "05"`)
11. If any row shows a **mismatched** test number, that's a routing bug — the main-thread proxy sent the wrong response back to a worker
12. Confirm all 13 results returned with status 200 and the run finished cleanly

### Expected Outcomes

- [ ] All 13 results complete with status 200
- [ ] Every result's response body shows the **correct** `args.test` value matching its row name (no crossover)
- [ ] No "Worker received unexpected response" or similar console errors
- [ ] No `http-response` messages lost (result count = expected count)
- [ ] Run completes in roughly the same time as the equivalent web build (proxy overhead is minimal)
- [ ] Memory in Activity Monitor stays stable after the run (no leak from unmatched correlation IDs)

---

## Test Scenario 11: Combined — Full Tier 1 Integration

**Purpose**: End-to-end smoke test that **all four PR optimizations** (PR1 connection pool + PR2 progress throttle + PR3 prep cache & combined resolver + PR4 multi-worker) work together under a realistic load without regressing each other.

**Optimization**: All Tier 1 items (PR1 + PR2 + PR3 + PR4)

### Steps

**Part A — Create the integration test**

1. Go to **Test Harness** → in `PR4 Multi-Worker` (or new), add a Test:
   - **Name**: `Tier 1 Integration`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"test": "tier1-integration", "v": "1"}`
   - **Custom Headers**: `X-Test: tier1`, `Accept: application/json`
   - **Save**

**Part B — Run as a high-throughput load test**

> We use load-profile mode so multi-worker triggers on a single test, and the load runs long enough to make each cache/optimization measurable.

2. Go to **Test Runner** → select only `Tier 1 Integration`
3. Set **Execution Mode**: `load-profile`, **Shape**: `sustained`, **Concurrency**: `50`, **Duration**: `30s`
4. Open DevTools → Sources → Threads, and open **Activity Monitor** / **Task Manager** alongside
5. Note pre-run memory of the browser/Tauri process
6. Click **Run**

**Part C — Monitor live behavior (during the run)**

7. Watch the **progress bar / RPS counter**:
   - Progress should update smoothly at ~500ms intervals (PR2 throttle)
   - RPS should stabilize within the first few seconds and stay roughly constant
8. Check DevTools Threads — **N workers** should be active throughout (PR4)
9. Check Activity Monitor — multiple cores should be busy (PR4)
10. Try clicking around the UI — switching tabs, opening menus — should remain responsive (PR2 throttle + PR4 off-main-thread)

**Part D — Verify after completion**

11. Note the final **total request count** and **RPS** from the runner status bar — record these
12. Compare RPS to pre-Tier-1 baseline (whatever you have from before this branch):
    - PR1 added connection pool (large gain on TLS-heavy endpoints)
    - PR3 added prep cache (small gain per request)
    - PR4 added multi-core (largest gain on multi-core machines)
    - Combined expected gain: **3–5×** over pre-Tier-1 baseline
13. Spot-check 5 random results from start/middle/end of the run:
    - Each shows `X-Test: tier1` in echoed headers (PR3 cache hit, no header drift)
    - Each shows `Content-Type: application/json`
    - Each shows the request body `{"test": "tier1-integration", "v": "1"}`
14. Wait 10s after the run completes → memory should return close to pre-run baseline (no leaks from prep cache, workers, or connection pool)

### Expected Outcomes

- [ ] Total request count matches the runner summary; results table has the same count (no losses)
- [ ] RPS is **at least 3×** the pre-Tier-1 baseline (target: 3–5×; document actual value)
- [ ] Multi-core CPU utilization visible in Activity Monitor (PR4 working)
- [ ] Progress updates feel smooth at ~500ms intervals (PR2 working)
- [ ] All sampled results have correct headers and body (PR3 prep cache working)
- [ ] UI remains responsive throughout the 30s run (no beach-balls, no input lag)
- [ ] All N workers terminate cleanly after the run (DevTools Threads clears)
- [ ] Memory returns to near pre-run baseline within 10s (no leak)
- [ ] No errors or unhandled rejections in the console

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
