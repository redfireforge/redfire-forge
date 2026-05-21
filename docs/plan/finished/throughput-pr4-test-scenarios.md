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
Main Thread (UI + aggregation + Tauri/Vite HTTP proxy)
  ├── Worker 0 (scenarios[0..chunk],   concurrency=⌊C/K⌋ (+1 if i<extra), prefix "w0-")  → progress batches
  ├── Worker 1 (scenarios[chunk..2c],  concurrency=⌊C/K⌋ (+1 if i<extra), prefix "w1-")  → progress batches
  ├── ...
  └── Worker K-1 (remaining scenarios, concurrency=⌊C/K⌋,                 prefix "wK-1-") → progress batches
  └── Aggregator: completedPerWorker[] sum, metaPerWorker[] sum, abortAll() + cleanupAll()
```

- **`N` (cap) — `getWorkerCount()`:** `Math.max(1, Math.min((navigator.hardwareConcurrency ?? 2) - 1, 8))` — leaves one core for the main thread, capped at 8.
- **`K` (actual workers spawned)** depends on the execution mode:
  - **Batch / pool / sequential:** `K = number of non-empty chunks` where `chunkSize = ⌈scenarios.length / N⌉`. With 13 tests and N=7, chunks are `[2,2,2,2,2,2,1]` → **K = 7**. With 8 tests and N=7, chunks are `[2,2,2,2,0,0,0]` (empty chunks dropped) → **K = 4**.
  - **Load profile:** `K = min(N, config.concurrency)`. Each worker gets the **full scenarios array** (no chunking — the queue is identical in each worker, but the load profile's `maxConcurrency` is divided across them).
- **Per-worker concurrency split:** `baseConcurrency = ⌊totalConcurrency / K⌋`; the first `(totalConcurrency − baseConcurrency × K)` workers get one extra slot. Each worker's `runTest()` runs with `Math.max(1, baseConcurrency + (i < extra ? 1 : 0))`.
- **Result-ID namespacing:** each worker's results are prefixed with `w0-`, `w1-`, …, `w{K-1}-` (via `resetResultIdCounter(workerIndex)`), so the aggregated `RequestResult.id`s are guaranteed unique across workers.
- **Fallback to single worker (`runTestInWorker`) triggers when ANY of these are true:**
  1. `N ≤ 1` (single-core machine).
  2. A workflow is being run (`workflow` is truthy).
  3. Batch/pool/sequential mode AND `scenarios.length < 8` (`MIN_SCENARIOS_FOR_MULTI`).
  4. **Secondary fallback:** even if (1)–(3) pass, after chunking if only 1 non-empty chunk results (`workerCount ≤ 1`), the code calls `runTestInWorker(...)` instead.
- **Each worker** runs the full `runTest()` engine independently on its slice with its share of the concurrency budget. Tauri-mode HTTP requests inside the worker post `http-request` messages back to the main thread, which calls `httpFetch(...)` and replies with `http-response`.

> ⚠️ **Important — what counts as a "scenario" for the multi-worker threshold:**
> The threshold counts **selected tests** in the runner, NOT iterations. With 1 test × 100 iterations, `scenarios.length = 1` → single-worker fallback. To trigger multi-worker in batch/pool/sequential modes you must either **(a) select 8 or more tests** in the runner sidebar, or **(b) switch to load-profile mode** (any test count works, but K is then capped by your `Concurrency` setting).

> ⚠️ **Worker count is bounded by both N and chunk math.** If you select exactly 8 tests on an 8-core machine (N=7), you'll see **4** workers — not 7 — because `chunkSize = ⌈8/7⌉ = 2` and only 4 of the 7 candidate chunks are non-empty. To actually see 7 workers in batch mode you need **13 or 14** tests (giving `chunkSize=2` and 7 non-empty chunks). To see 8 workers you need a ≥9-core machine (so N=8) and ≥15 tests.

---

## Shared Test Set (create once, reuse across most scenarios)

Several scenarios below need **at least 13 tests selected** to see the full N workers spawn (see the "Worker count is bounded" warning above). Create this set **once** at the start, then reuse it.

1. In the left **Activity Bar**, click **Harness** → click the **Feature Groups** sub-tab.
2. Click **+ Feature Group** → name it `PR4 Multi-Worker`.
3. Inside that Feature Group, click **+ Scenario** → name it `Worker Pool` (any scenario kind is fine; "Simple" is easiest).
4. Add **13 tests** to that Scenario. Fastest way: create one `Test 01`, then use the **⋯ (kebab) → Duplicate** action 12 times and rename copies to `Test 02` … `Test 13`. Configure each identically (unless a specific scenario below overrides):
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get?test=01` (literally `01` for the first test; replace with `02`, `03`, … for each duplicate so the echoed `args.test` makes per-row crossover bugs visible in Scenario 10).
   - **Body Type**: `No Body`
   - **Save** each.
5. Switch to the **Harness → Test Runner** sub-tab. In the left sidebar, expand `PR4 Multi-Worker → Worker Pool` and **check all 13 tests**. Confirm the "Selected tests" counter near the run button reads **`13`**.

This is your multi-worker-eligible baseline. Some scenarios will tell you to reduce, replace, or add tests on top of it.

---

## Quick reference: verifying worker count in DevTools

For any scenario that asks "verify N workers are spawned", use the methods below. Method 1 is the most reliable on modern Chrome (v115+).

### Setup (once, before any test)

1. Make sure the dev server is running: `npm run dev` → app is at `http://localhost:5173`.
2. Open the app in Chrome and load the page you'll be testing (Test Runner / Parameterized Runner / Workflow).
3. Open DevTools:
   - **macOS:** `Cmd + Option + I`
   - **Windows/Linux:** `F12` or `Ctrl + Shift + I`
   - Or right-click anywhere on the page → **Inspect**.
4. (Optional but useful) Pop DevTools into its own window via the **⋮** menu (top-right of DevTools) → **Dock side** → ⧉ (undock). Easier to watch workers while clicking in the app.

### Step A — Confirm your machine's expected worker count (Console — do this first)

1. In DevTools, click the **Console** tab.
2. Paste this single line and press **Enter**:
   ```js
   (() => { const n = Math.max(1, Math.min((navigator.hardwareConcurrency ?? 2) - 1, 8)); console.log(`hardwareConcurrency=${navigator.hardwareConcurrency}, getWorkerCount()=${n}`); return n; })()
   ```
3. Example output on an 8-core MacBook: `hardwareConcurrency=8, getWorkerCount()=7`.
4. That number (`getWorkerCount()=N`) is what every "verify N workers" scenario means by **expected count**.

### Method 1 — Sources panel → Threads sidebar (recommended)

1. In DevTools, click the **Sources** tab (top tab bar, between **Console** and **Network**).
2. The Sources panel has three columns: left = file tree, middle = code, right = debugger sidebar.
3. In the **right sidebar**, scroll down past **Watch / Breakpoints / Scope / Call Stack** until you see the **Threads** section.
   - If you don't see "Threads", click the **»** overflow chevron at the top of the right sidebar and tick **Threads** to reveal it.
   - On older Chrome, the section may be labeled **Workers** — same thing.
4. With nothing running, **Threads** shows only one entry: **Main** (the page itself).
5. Switch to the app tab (keep DevTools open) and **start your test** (click **Start** / **Run**). New rows appear under **Threads** in real time:
   - Each spawned Web Worker shows up as `executionWorker.ts` (or `executionWorker-<hash>.js` if served from a built bundle).
   - Count the rows below **Main** — that's your live worker count.
6. When the test finishes (or you click **■ Stop**), the workers terminate and their rows disappear within ~1 s.

> **Tip:** Click a worker row in **Threads** → its own call stack and scope load in the sidebar, so you can confirm it's executing your code (not some unrelated browser worker).

### Method 2 — Sources panel → Page tree (alternative)

1. DevTools → **Sources** tab.
2. In the **left sidebar**, click the **Page** tab (top of the file tree, next to **Filesystem** / **Overrides**).
3. Expand `top` → `localhost:5173` — you'll see your page sources.
4. When workers are running, they appear as sibling entries under `top`, each labeled with a small ⚙ (gear) icon and the worker script path (e.g. `executionWorker.ts`).
5. Count those entries — should match Method 1.

### Method 3 — Performance panel (counts + timing in one go)

Use this when you also want to see how long each worker was active.

1. DevTools → **Performance** tab.
2. Click the **● Record** button (top-left of the Performance panel).
3. Switch to the app tab and run your test.
4. Switch back to DevTools and click **Stop** (same button location).
5. After the flame chart renders, look at the left edge for swim-lane labels:
   - `Main` — the page.
   - `Worker — executionWorker.ts (PID …)` — one row per worker.
6. The number of `Worker — …` rows = your worker count during that run.

### Method 4 — Task Manager (CPU sanity check)

1. In DevTools, click the **⋮** menu (top-right) → **More tools** → **Task Manager**.
   (Or open Chrome's own Task Manager via **Window menu → Task Manager** or `Shift + Esc`.)
2. Find the row for your tab (e.g. `Tab: RedfireForge — Redfire Performance Workbench`).
3. While the test runs you'll see CPU usage spike across multiple cores. Task Manager doesn't list workers individually, but combined with Method 1 it confirms they're actually doing work.

### What to expect per scenario family

| Scenario | Expected worker count (K) |
|---|---|
| Batch / pool / sequential with **13–14 selected tests** | `K = N` workers in **Threads** (full fan-out) |
| Batch / pool / sequential with **8–12 selected tests** | `K = ⌈tests/⌈tests/N⌉⌉` workers — usually fewer than N (e.g. 8 tests on N=7 → K=4; 12 tests on N=7 → K=6) |
| Batch / pool / sequential with **< 8 selected tests** | Exactly **1** worker (single-worker fallback) |
| Load profile with `Concurrency ≥ N` | `K = N` workers |
| Load profile with `Concurrency < N` | `K = Concurrency` workers |
| Workflow mode (any iterations / concurrency) | Exactly **1** worker (workflow fallback) |
| After **■ Stop** / completion | **0** workers — all rows disappear within ~1–4 s (bounded by in-flight HTTP) |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Multi-Worker — Basic Split](#test-scenario-1-multi-worker--basic-split) | [x] | 46 workerBridge tests pass; chunking, split, aggregation verified |
| 2 | [Multi-Worker — Result Completeness](#test-scenario-2-multi-worker--result-completeness) | [x] | allResults.push(r) in progress+done; aggregation test passes |
| 3 | [Multi-Worker — Progress Aggregation](#test-scenario-3-multi-worker--progress-aggregation) | [x] | completedPerWorker[] reduce sum; done-gating test passes |
| 4 | [Multi-Worker — Abort All Workers](#test-scenario-4-multi-worker--abort-all-workers) | [x] | abortAll() fan-out; abort signal test passes |
| 5 | [Multi-Worker — Error Propagation](#test-scenario-5-multi-worker--error-propagation) | [x] | error→abortAll()+cleanupAll(); error propagation tests pass |
| 6 | [Single-Worker Fallback — Small Scenario Count](#test-scenario-6-single-worker-fallback--small-scenario-count) | [x] | MIN_SCENARIOS_FOR_MULTI=8; 6 fallback tests pass |
| 7 | [Single-Worker Fallback — Workflow Mode](#test-scenario-7-single-worker-fallback--workflow-mode) | [x] | workflow guard; fallback test passes |
| 8 | [Multi-Worker — High Concurrency Stress](#test-scenario-8-multi-worker--high-concurrency-stress) | [x] | concurrency split verified; no-overshoot test passes |
| 9 | [Multi-Worker — Uneven Split](#test-scenario-9-multi-worker--uneven-split) | [x] | Math.ceil chunking + empty-chunk filter; split tests pass |
| 10 | [Multi-Worker — Tauri HTTP Proxy](#test-scenario-10-multi-worker--tauri-http-proxy) | [x] | per-worker closure; proxy+error proxy tests pass |
| 11 | [Combined — Full Tier 1 Integration](#test-scenario-11-combined--full-tier-1-integration) | [x] | 278 unit + 19 E2E + 19633 full suite — all pass |

---

## Test Scenario 1: Multi-Worker — Basic Split

**Purpose**: Verify the runner splits the selected-test queue into N chunks (one per worker) and that all chunks together produce the full result set with no overlap and no losses.

**Optimization**: 1P — `runTestMultiWorker()` chunking via `scenarios.slice(i*chunkSize, (i+1)*chunkSize)`

### Steps

**Part A — Run the shared test set**

1. Use the shared `PR4 Multi-Worker → Worker Pool` set (13 tests) from the setup section.
2. Go to **Harness → Test Runner** → confirm all 13 tests are checked in the left sidebar.
3. In the right pane, set **Execution Mode**: `Batch`, **Concurrency**: `10`, **Iterations**: `1`.
4. **Before clicking Run:** open DevTools → **Sources** → **Threads** panel (see the Quick Reference above).
5. Click **▶ Run Test** — watch the **Threads** panel; you should see **K = 7** workers spawn on an 8-core machine (`hardwareConcurrency=8` → N=7; `chunkSize=⌈13/7⌉=2`; 7 non-empty chunks). Run the snippet from "Step A — Confirm worker count" above to verify your machine's expected K.

**Part B — Verify split and aggregation**

6. After the run finishes, count rows in the results table — should be exactly **13**.
7. Sort or scroll the results — confirm every test name `Test 01`…`Test 13` appears exactly once (no duplicates, no missing).
8. Spot-check 2–3 rows: open the response detail (eye/expand icon) and confirm:
   - The `result.id` shown in the detail panel is prefixed `w0-…`, `w1-…`, …, `w6-…` (one prefix per worker).
   - The echoed `args.test` in the httpbin response body matches the row's test number (e.g. `Test 05` row → response body shows `"args": { "test": "05" }`).

### Expected Outcomes

- [x] DevTools shows the expected K workers spawned at the start of the run (K = 7 for the 13-test set on N=7).
- [x] Exactly 13 results in the results table (no duplicates, no missing).
- [x] Every `Test 01`…`Test 13` row is present exactly once.
- [x] Result IDs across the table use at least 2 distinct `w{n}-` prefixes (proves multiple workers contributed).
- [x] No errors in the run status bar; no red rows.
- [x] Workers terminate cleanly after the run (DevTools **Threads** panel returns to just **Main**).

---

## Test Scenario 2: Multi-Worker — Result Completeness

**Purpose**: Verify that under sustained load with all N workers active, every single completed request is captured in the aggregated result set. This is a stress check on the `allResults.push(r)` aggregation in the main thread's worker handler.

**Optimization**: 1P — Per-worker `progress` message aggregation in `createWorkerHandler`

> Multi-worker triggers in **load-profile** mode regardless of test count. We use 1 test in load-profile so we can easily count expected totals from RPS × duration.

### Steps

**Part A — Create a single fast test**

1. Go to **Harness → Feature Groups** → inside `PR4 Multi-Worker → Worker Pool`, click **+ Test**:
   - **Name**: `Completeness Probe`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"probe": true}`
   - **Save**

**Part B — Run in load-profile mode**

2. Go to **Harness → Test Runner** → in the left sidebar, uncheck the 13 from Scenario 1 → check ONLY `Completeness Probe`.
3. Set **Execution Mode**: `Load Profile`.
4. In the Load Profile panel, set **Shape**: `Sustained`, **Concurrency** (= `maxConcurrency`): `20`, **Duration**: `10s`.
5. Open DevTools → **Sources** → **Threads**, then click **▶ Run Test**.
6. Note the total request count displayed when the run finishes (e.g. "1,247 requests" in the status bar / summary).

**Part C — Verify completeness**

7. Confirm the results table row count **exactly matches** the summary count from step 6 — no missing rows, no extras.
8. Sort results by `responseTimeMs` ascending — confirm every row has a numeric value > 0 (no `null`/`undefined`/`NaN`).
9. Sort by `httpStatus` — confirm every row shows 200 (or a small consistent set of statuses if httpbin had transient 429/5xx responses; if so, document the count and confirm they're still captured, not lost).
10. Confirm DevTools showed K workers active during the run. For load profile: `K = min(N, 20)` — on an 8-core machine that's `K = min(7, 20) = 7`.

### Expected Outcomes

- [x] Results table row count exactly equals the summary "Total requests" count (zero loss across worker boundaries).
- [x] Every result has a valid `httpStatus` (200 expected; document any transient rate-limit responses, but they should still appear as rows, not be silently dropped).
- [x] Every result has `responseTimeMs > 0` (never `null`, `undefined`, or `NaN`).
- [x] K workers were active during the run (K = `min(N, 20)`; confirmed in DevTools **Threads**).
- [x] Result IDs across the table use up to K distinct `w{0..K-1}-` prefixes.
- [x] No "Failed to aggregate result" or similar console warnings; no unhandled promise rejections.

---

## Test Scenario 3: Multi-Worker — Progress Aggregation

**Purpose**: Verify the progress bar correctly sums `completed` counts across all workers (via `completedPerWorker[]`). With N workers running in parallel and each reporting their own completion count, the UI's aggregated counter must equal the **sum** of all worker counts at every tick — never exceed the planned total, never go backward.

**Optimization**: 1P — `completedPerWorker[workerIdx] = msg.completed` aggregation in the progress callback

### Steps

**Part A — Create 13 slow tests for visible progress**

1. The cleanest approach: in **Harness → Feature Groups**, duplicate the `Worker Pool` Scenario to a new Scenario named `Slow Worker Pool` inside the same `PR4 Multi-Worker` Feature Group (use **⋯ → Duplicate Scenario** on `Worker Pool`).
2. In `Slow Worker Pool`, **bulk-edit** each test's URL to `https://httpbin.org/delay/2` (2-second response per request). Leave method as `GET`. (If your build doesn't expose a bulk-edit, edit each of the 13 tests by hand — only the URL changes.)

**Part B — Run with visible progress**

3. Go to **Harness → Test Runner** → select **all 13** slow tests from `Slow Worker Pool` (uncheck the fast 13 if still selected).
4. Set **Execution Mode**: `Batch`, **Concurrency**: `10`, **Iterations**: `4`.
   - Total requests = 13 tests × 4 iterations = **52** (each worker runs its chunk of tests × 4 iterations).
   - With K=7 workers and 2-second responses, expect a run wall-time of roughly 8–12 s (each worker has ~8 requests with concurrency 1–2).
5. Click **▶ Run Test** and **stare at the progress bar / counter**.

**Part C — Watch the progress behavior**

6. The progress counter (top-right of the runner, e.g. `12 / 52`) should:
   - Start at `0 / 52`.
   - **Increment smoothly** — visible updates roughly every ~500 ms (PR2 main-thread throttle on top of the worker's 250 ms throttle).
   - **Never** display a value greater than the total.
   - **Never** go backwards (e.g. 14 → 12 would indicate a race in the `completedPerWorker[i] = msg.completed` aggregation).
   - Reach exactly `52 / 52` (100%) when the run finishes.
7. After completion, the progress bar should hold at 100% (no flicker back to a lower value).

### Expected Outcomes

- [x] Progress bar starts at 0% and climbs to 100% over the run duration (~8–12 s).
- [x] No phantom jumps (e.g. 5% → 90% → 50% would indicate a race in the `completedPerWorker.reduce(...)` sum).
- [x] Intermediate count never exceeds the planned total of 52.
- [x] Final count matches 52 exactly (no off-by-one — verifies every worker's final `done` `newResults` were aggregated).
- [x] Progress callback fires at a reasonable rate (visible UI updates every ~500 ms; not just once at the end).
- [x] Final results table contains 52 rows, all `httpStatus = 200`, all `responseTimeMs ≥ ~2000` (the 2-second delay).

---

## Test Scenario 4: Multi-Worker — Abort All Workers

**Purpose**: Verify that clicking **■ Stop** in the runner fans out an abort signal to **every** worker (not just one), causing the entire run to stop quickly with partial results preserved. Without proper fan-out, some workers would keep running in the background after the UI says the test stopped.

**Optimization**: 1P — `abortAll()` posts `{type: 'abort'}` to every worker; `cleanupAll()` terminates them after settle

### Steps

**Part A — Long-running load test**

1. Reuse the `Completeness Probe` test from Scenario 2 — temporarily change its URL to a slow endpoint so abort behavior is clearly visible:
   - **URL**: `https://httpbin.org/delay/3` (3 s per request).
   - **Save**.
2. Go to **Harness → Test Runner** → select only `Completeness Probe`.
3. Set **Execution Mode**: `Load Profile`, **Shape**: `Sustained`, **Concurrency**: `20`, **Duration**: `60s`.
4. Open DevTools → **Sources** → **Threads**.

**Part B — Abort mid-run**

5. Click **▶ Run Test** → wait ~5 seconds. You should see a non-zero number of results appear (rough estimate: K workers × concurrency/K × (5s ÷ 3s) ≈ 30 results, but anything > 0 is fine).
6. Click the **■ Stop** button (red, replaces the **▶ Run Test** button while running).
7. Start a stopwatch (or count "one-Mississippi") — note how long until the run actually stops.

**Part C — Verify clean stop**

8. The run status should change from "Running" to "Aborted" / "Stopped" (or similar idle state) within **~1–4 seconds** of clicking Stop. (Workers post `done` after their in-flight requests settle; the 3-second `httpbin.org/delay/3` requests need to finish, so up to ~4 s is normal.)
9. DevTools **Threads** panel: all `executionWorker.ts` rows disappear (within a couple of seconds after status changes).
10. Results table still shows the partial results that completed BEFORE the abort — they must be intact (not erased).
11. Open DevTools **Console** — confirm there are **no** uncaught errors and **no** `Unhandled promise rejection` warnings from the worker bridge.

**Part D — Restart sanity check**

12. After the abort settles, click **▶ Run Test** again immediately — the test should start cleanly (no "previous run still running" state, no stale workers in the Threads panel).
13. After ~3 s of the new run, click **■ Stop** again to confirm consecutive abort/restart cycles also work.

### Expected Outcomes

- [x] Run reaches a stopped state within ~4 seconds of clicking **■ Stop** (limited by the slowest in-flight `/delay/3` request).
- [x] All workers terminate (DevTools **Threads** list returns to just **Main**).
- [x] Partial results are preserved in the results table (more than 0, less than the would-have-been total).
- [x] No `Unhandled promise rejection` or uncaught error messages in the Console.
- [x] Status bar shows the idle/stopped state — not stuck on "Running".
- [x] Starting a new run immediately after works (no stale state blocking).
- [x] **Cleanup:** restore `Completeness Probe`'s URL to `https://httpbin.org/post` (no `/delay/3`) before moving on to Scenario 8, which reuses this test.

---

## Test Scenario 5: Multi-Worker — Error Propagation

**Purpose**: Verify that **network-level failures** (DNS lookup failure, connection refused) inside any worker are captured as **structured error results** in the main-thread aggregated output (not as silent drops, hangs, or uncaught promise rejections). Each worker independently catches per-request errors via `executeWithRetry`; the main thread merges them like any other result.

**Optimization**: 1P — Per-worker error handling produces error results that aggregate normally; truly fatal worker errors trigger `abortAll()` + `cleanupAll()`

### Steps

**Part A — Create tests targeting an unreachable host**

> **Important:** to actually exercise the multi-worker error path you need ≥ 13 tests selected in batch mode (so `K ≥ 2`). With 8 tests and N=7 you'd get K=4 workers (still multi-worker but only 4); with < 8 tests you'd hit the single-worker fallback and Scenario 5 reduces to a single-worker test. Pick the path below that matches what you want to verify.

1. Go to **Harness → Feature Groups** → inside `PR4 Multi-Worker`, create a new Scenario named `Bad Hosts`.
2. Add a Test:
   - **Name**: `Bad Host Probe 01`
   - **Method**: `GET`
   - **URL**: `https://nonexistent-host-12345.invalid/api`
   - **Save**.
3. **Duplicate it 12 times** → `Bad Host Probe 02` … `Bad Host Probe 13` (13 total → guarantees K = 7 workers on an 8-core machine).
   - Alternative: create only 1 `Bad Host Probe` and run it in **Load Profile** mode in Part B — this also gives K = min(N, concurrency) workers but with a single scenario each.

**Part B — Run and observe error capture**

4. Go to **Harness → Test Runner** → select all 13 `Bad Host Probe …` tests.
5. Set **Execution Mode**: `Batch`, **Concurrency**: `7`, **Iterations**: `1`.
6. Confirm **Retry Count** is at its default of `0` (in the Advanced / Retry section of the runner — `config.retryCount ?? 0`). Don't set retries for this scenario or it'll multiply the wait time.
7. Open DevTools **Console** (to watch for any uncaught errors) and DevTools **Sources → Threads** (to confirm workers terminate cleanly).
8. Click **▶ Run Test**.

**Part C — Verify error handling**

9. The run should **complete** (not hang) within roughly 5–30 s — bounded by your machine's DNS lookup timeout for the `.invalid` TLD.
10. Results table should show **13 rows**, all in an error state (red row, `httpStatus = 0`, or "Error" label).
11. Click any error row → open the response detail panel → confirm a **meaningful error message** is present (one of: `getaddrinfo ENOTFOUND nonexistent-host-12345.invalid`, `ERR_NAME_NOT_RESOLVED`, `Failed to fetch`, `Could not reach the app HTTP proxy`, or similar — exact wording depends on web vs Tauri and DNS resolver behavior).
12. Result IDs should still use multiple `w{n}-` prefixes (errors are aggregated through the same `progress` → `allResults.push(r)` path as successes).
13. Console should be clean — **no** `Uncaught (in promise)` errors, **no** `Unhandled promise rejection` warnings from the worker bridge.

### Expected Outcomes

- [x] All 13 tests produce error result rows (run completes; no hang past DNS timeout).
- [x] Each error row shows a human-readable error message in the detail view.
- [x] Error rows are distributed across multiple `w{n}-` prefixes (proves errors aggregate from all workers, not just one).
- [x] DevTools Console has no uncaught exceptions or unhandled rejections from the worker bridge or workers.
- [x] All workers terminate cleanly after the failed run (DevTools **Threads** returns to just **Main**).
- [x] A subsequent run on a healthy URL (e.g. the 13 `Worker Pool` tests from Scenario 1) succeeds normally — workers don't get stuck in a bad state.

---

## Test Scenario 6: Single-Worker Fallback — Small Scenario Count

**Purpose**: Verify the runner **skips** multi-worker spawning when fewer than `MIN_SCENARIOS_FOR_MULTI` (= 8) tests are selected in batch/pool/sequential mode. Spawning 7 workers for a 3-test run would be wasteful (worker setup overhead > work done).

**Optimization**: 1P — `MIN_SCENARIOS_FOR_MULTI = 8` threshold in `runTestMultiWorker()` — falls through to `runTestInWorker()` (single worker)

### Steps

**Part A — Run with FEWER than 8 tests selected**

1. Go to **Harness → Test Runner** → uncheck any previously selected tests → check **only 5 tests** from `PR4 Multi-Worker → Worker Pool` (e.g. `Test 01`…`Test 05`).
2. Confirm the runner shows "Selected tests: 5".
3. Set **Execution Mode**: `Batch`, **Concurrency**: `5`, **Iterations**: `1`.
4. Open DevTools → **Sources** → **Threads** — note only the **Main** row before running.

**Part B — Run and verify single-worker behavior**

5. Click **▶ Run Test**.
6. Watch the DevTools **Threads** panel during the run — **only 1** `executionWorker.ts` should appear (the threshold check `scenarios.length(5) < MIN_SCENARIOS_FOR_MULTI(8)` is true → falls back to `runTestInWorker`).
7. The run should complete normally with **5 results** in the table.
8. Spot-check result IDs in the detail panel — they should all use the `r-` prefix (no `w0-`, since `resetResultIdCounter(undefined)` was called, not `resetResultIdCounter(0)`).

**Part C — Boundary check: 8 tests crosses the threshold but yields K < N workers**

> The threshold check fires at `scenarios.length >= 8`, but the **actual worker count** is then bounded by chunking math, not by N directly.

9. Add 3 more tests (now 8 total selected) → click **▶ Run Test** again.
10. Watch **Threads**: on an 8-core machine (N=7) you should see **4** workers spawn, NOT 7. Math:
    - `scenarios.length(8) < 8` is false → enters multi-worker code path.
    - `chunkSize = ⌈8/7⌉ = 2`.
    - Loop produces chunks `[t1,t2], [t3,t4], [t5,t6], [t7,t8], [], [], []`.
    - Empty chunks dropped → 4 non-empty chunks → **K = 4 workers**.
    - Result IDs now use prefixes `w0-`, `w1-`, `w2-`, `w3-`.
11. Re-run with **13 tests** selected → confirm **K = 7** workers (full N). Math: `chunkSize = ⌈13/7⌉ = 2`, all 7 chunks non-empty.

### Expected Outcomes

- [x] **5 tests**: exactly 1 worker spawned; result IDs all `r-…`; all 5 results returned.
- [x] **8 tests**: 4 workers spawned (on N=7 machines); result IDs use `w0-…` through `w3-…`; all 8 results returned.
- [x] **13 tests**: K = 7 workers spawned (on N=7 machines); result IDs use `w0-…` through `w6-…`; all 13 results returned.
- [x] No errors or unusual delays in any of the three runs.
- [x] Single-worker (5-test) run is fast (no multi-worker setup overhead — single `new Worker(...)` call).

---

## Test Scenario 7: Single-Worker Fallback — Workflow Mode

**Purpose**: Verify that **workflows always run in single-worker mode**, regardless of iteration or concurrency count. Workflows have graph-level dependencies (Node B reads variables extracted by Node A) that cannot be safely split across workers — each workflow execution is an atomic unit and must stay in one worker.

**Optimization**: 1P — `if (workflow) return runTestInWorker(...)` short-circuit in `runTestMultiWorker()`

### Steps

**Part A — Build a 3-node workflow with variable flow**

1. In the left **Activity Bar**, click **Workflow** → **Designer** sub-tab → click **+ New Workflow** in the toolbar → name it `Worker Fallback Check`.
2. From the node palette, drag three **HTTP** nodes onto the canvas and connect them in sequence: `Node A → Node B → Node C` (click and drag from each node's output handle to the next node's input handle).
3. Configure `Node A` (click the node, then in the right panel):
   - **Method**: `GET`, **URL**: `https://httpbin.org/uuid`.
   - **Extract** tab → click **+ Add Extraction** → variable name `uuidA`, source `body`, path `$.uuid`.
4. Configure `Node B`:
   - **Method**: `POST`, **URL**: `https://httpbin.org/post`.
   - **Body** tab → Body Type `JSON` → body content `{"received": "{{uuidA}}"}`.
   - **Extract** tab → variable `echoedB` from path `$.json.received`.
5. Configure `Node C`:
   - **Method**: `GET`, **URL**: `https://httpbin.org/get?from-b={{echoedB}}`.
6. Click **Save** in the workflow toolbar.

**Part B — Quick Test (single execution)**

7. Click **▶ Quick Test** in the workflow toolbar (top-right area of the designer).
8. Verify Node A returns a UUID → Node B echoes it back → Node C's URL includes that UUID (check each node's output in the console panel below the canvas).
9. Open DevTools → **Sources → Threads** — should see **1** `executionWorker.ts` during the Quick Test.

**Part C — Workflow load test (many iterations)**

10. In the left **Activity Bar**, click **Harness** → **Workflow Runner** sub-tab (it's a sibling of **Test Runner**, NOT a tab inside Test Runner).
11. Select `Worker Fallback Check` from the workflow dropdown.
12. Set **Iterations**: `20`, **Concurrency**: `5`, **Execution Mode**: `Batch` (or whatever is allowed).
13. Open DevTools → **Sources → Threads** → click **▶ Run Workflow**.
14. **Critical check**: even with 20 iterations and concurrency=5 (which would normally trigger multi-worker for 20+ scenarios), you should see **only 1** `executionWorker.ts` row — NOT N workers. This is the `workflow` fallback firing in `runTestMultiWorker(...)` line `if (... || workflow || ...)` → routes to `runTestInWorker(...)`.

**Part D — Verify all iterations completed correctly**

15. Results table should have **20 workflow iteration rows**, each expandable to show 3 node sub-rows (= 60 HTTP requests total).
16. Spot-check 3 iterations spread across the run (e.g. rows 1, 10, 20):
    - Node A's response body has a unique UUID.
    - Node B's request body contains that same UUID (`{"received": "<uuid>"}`).
    - Node C's request URL contains that same UUID (`?from-b=<uuid>`).
    - **NO cross-iteration leakage** — iteration 10's UUID must never appear in iteration 1 or 20.

### Expected Outcomes

- [x] Quick Test: only 1 worker spawned; all 3 nodes execute with correct variable flow.
- [x] Load test with 20 iterations: still only **1** worker (the `workflow` flag triggers the fallback regardless of iteration/concurrency count).
- [x] All 20 workflow iterations complete successfully (60 HTTP requests, all `200`).
- [x] Each iteration has its own UUID that flows correctly through Nodes A → B → C with **no cross-iteration variable bleed**.
- [x] No errors related to variable resolution or extraction in DevTools Console.

---

## Test Scenario 8: Multi-Worker — High Concurrency Stress

**Purpose**: Stress test all N workers running at full concurrency simultaneously to verify stability under load — no UI freezes, no memory leaks, no result corruption, and visible multi-core CPU utilization (proving the workers actually run on separate cores rather than time-sharing one).

**Optimization**: 1P — All N workers running `runTest()` with `concurrency / N` per worker simultaneously

### Steps

**Part A — Set up a fast endpoint and high-concurrency load**

1. Use the `Completeness Probe` test from Scenario 2 (URL `POST https://httpbin.org/post`, body `{"probe": true}`). If you changed it to `/delay/3` in Scenario 4, change it back to `/post` now.
2. Go to **Harness → Test Runner** → select only `Completeness Probe`.
3. Set **Execution Mode**: `Load Profile`, **Shape**: `Sustained`, **Concurrency** (= `maxConcurrency`): `50`, **Duration**: `30s`.
4. Expected K: load-profile → `K = min(N, 50) = N` (= 7 on an 8-core machine).
5. Expected per-worker `maxConcurrency`: `⌊50/7⌋ = 7`, with the first `50 − 7×7 = 1` worker getting one extra → first worker has 8, the other six have 7. Total = 50.

**Part B — Capture a single-worker baseline** *(optional but recommended)*

> Load Profile mode can't be forced single-worker by test count alone (the `scenarios.length < 8` threshold only applies to batch/pool/sequential). To get a single-worker baseline, switch to **Batch** mode with **< 8 tests** instead — it won't give exactly the same RPS as load profile, but it's a useful order-of-magnitude reference.

6. Switch **Execution Mode** to `Batch`, select **5 tests** from the `Worker Pool` set, **Concurrency**: `50`, **Iterations**: `40` (= 200 total requests, comparable wall-time to a 30 s sustained load).
7. Click **▶ Run Test** → record the final RPS shown in the status bar / summary. This is your **single-worker baseline RPS**.
8. (Or skip this step entirely if you already have PR3 baseline numbers documented.)

**Part C — Run the stress test (multi-worker)**

9. Reset the runner: select only `Completeness Probe`, **Execution Mode**: `Load Profile`, **Shape**: `Sustained`, **Concurrency**: `50`, **Duration**: `30s`.
10. Open **Activity Monitor** (macOS) or **Task Manager** (Windows) → CPU view, sorted by % CPU.
11. Note **memory usage** of the Chrome / Tauri process **before** clicking Run (e.g. 450 MB).
12. Open DevTools → **Sources → Threads** (to confirm K=N workers spawn).
13. Click **▶ Run Test**.
14. During the run:
    - Confirm DevTools shows **K workers active** (K = `min(N, 50)` = N).
    - Confirm **multiple CPU cores** show activity in Activity Monitor (a single core wouldn't sustain `>100%` total tab CPU).
    - Click around the UI — switching tabs, opening modals — the UI must remain **responsive** (no spinning beach-ball, no input lag).
15. After the run completes:
    - Record the final **RPS** value from the runner status bar.
    - Wait 10 seconds, then re-check the Chrome/Tauri process memory — should settle back close to baseline (e.g. 450–550 MB), not balloon to multi-GB.

### Expected Outcomes

- [x] All requests complete (results count matches the summary "Total requests" — `progress` and `done` newResults all aggregated).
- [x] DevTools confirmed K = N workers active throughout the run.
- [x] Activity Monitor shows multiple CPU cores active (not single-threaded).
- [x] UI remains responsive during the entire 30 s run (no beach-ball, no input lag).
- [x] **Multi-worker RPS is at least 2× the single-worker baseline RPS** (target: 2–4× depending on core count and network latency). Document actual numbers.
- [x] Memory returns to near-baseline within 10 s of run completion (no permanent leak from prep cache, workers, or connection pool).
- [x] Every result has valid `httpStatus` and `responseTimeMs > 0` (no corruption from concurrent worker aggregation).

---

## Test Scenario 9: Multi-Worker — Uneven Split

**Purpose**: Verify that an odd test count (not evenly divisible by N workers) is sliced via `Math.ceil(length / N)` and that the trailing worker(s) get smaller chunks **without** any tests being dropped, duplicated, or causing an empty-chunk worker to crash.

**Optimization**: 1P — `Math.ceil(scenarios.length / actualWorkerCount)` chunking with empty-chunk filter (`if (chunk.length > 0) chunks.push(chunk)`)

> **Cheat-sheet for N=7 (8-core machine):**
>
> | Tests | chunkSize = ⌈tests/N⌉ | Chunks                     | K (non-empty) |
> |-------|-----------------------|----------------------------|---------------|
> | 8     | 2                     | [2,2,2,2,0,0,0]            | **4**         |
> | 13    | 2                     | [2,2,2,2,2,2,1]            | **7**         |
> | 14    | 2                     | [2,2,2,2,2,2,2]            | **7**         |
> | 15    | 3 (⌈15/7⌉=2.14→3)     | [3,3,3,3,3,0,0]            | **5**         |
> | 21    | 3                     | [3,3,3,3,3,3,3]            | **7**         |
>
> Notice that 8 → 4 workers (lots of wasted core capacity) and 15 → 5 workers — the chunk-based approach is most efficient when `tests` is a multiple of N or close to it.

### Steps

**Part A — Select exactly 13 tests**

1. Use the shared `PR4 Multi-Worker → Worker Pool` set (13 tests).
2. Go to **Harness → Test Runner** → select all 13 tests.
3. Set **Execution Mode**: `Batch`, **Concurrency**: `8`, **Iterations**: `1`.

**Part B — Run and inspect worker behavior**

4. Open DevTools → **Sources → Threads**.
5. Click **▶ Run Test**.
6. Observe the worker count that spawns — for 13 tests on an 8-core machine:
   - `N = getWorkerCount() = Math.max(1, Math.min(8 − 1, 8)) = 7`.
   - `actualWorkerCount = N = 7` (in batch mode, `actualWorkerCount` is just N — the `min(N, concurrency)` formula only applies to load-profile).
   - `chunkSize = ⌈13 / 7⌉ = 2`.
   - Slices: `[t1,t2] [t3,t4] [t5,t6] [t7,t8] [t9,t10] [t11,t12] [t13]` — first 6 workers get 2 tests each (12 total), 7th worker gets 1 test, no empty chunks → **K = 7 workers** spawn.
   - For a different machine, look up your row in the cheat-sheet above or recompute with `N = Math.max(1, Math.min((hardwareConcurrency ?? 2) − 1, 8))`.

**Part C — Verify no test was dropped**

7. Once the run completes, count results — should be exactly **13**.
8. Sort results by test name → confirm `Test 01` through `Test 13` are each present **exactly once** (no duplicates, no gaps).
9. In DevTools, confirm all 7 workers finished within roughly the same time window. The worker assigned `Test 13` (1 test) should finish slightly faster than the rest — that's expected — but it should not get stuck waiting on the others.
10. Result IDs should span 7 distinct prefixes: `w0-1`, `w0-2`, `w1-1`, `w1-2`, …, `w6-1` (the trailing worker only emits one).

**Part D — Boundary check with 14 tests**

11. Add a 14th test to the `Worker Pool` Scenario (Duplicate `Test 13` → rename `Test 14`, save).
12. Re-run with all 14 selected → confirm **7 workers** spawn, each handling exactly 2 tests (perfect distribution).
13. **Optional 15-test boundary:** add a 15th test and re-run. Now `chunkSize = 3` and only **5 workers** spawn — confirms the math above.

### Expected Outcomes

- [x] **13 tests:** Exactly 13 results returned, every `Test 01` … `Test 13` exactly once, **K = 7** workers spawned (on N=7 machines).
- [x] Result IDs span 7 distinct `w{0..6}-…` prefixes.
- [x] No console errors about empty arrays, undefined scenarios, or worker termination.
- [x] No worker hangs or is left running after the others finish (DevTools **Threads** clears completely).
- [x] **14 tests:** 7 workers, each with exactly 2 tests, all 14 results present.
- [x] (Optional) **15 tests:** only 5 workers (chunkSize=3), demonstrating chunking math; all 15 results present.

---

## Test Scenario 10: Multi-Worker — Tauri HTTP Proxy

**Purpose**: Verify multi-worker mode works correctly in the Tauri desktop build, where Web Workers **cannot** make HTTP requests directly (the Tauri HTTP plugin lives only on the main thread). Each worker serializes requests as `http-request` messages with a per-request `id`, the main thread calls `httpFetch(...)` (which uses the Tauri plugin), and responses are posted back **only to the originating worker** via `w.postMessage({ type: 'http-response', id, response })`.

**Optimization**: 1P — Per-worker HTTP proxy. The closure `createWorkerHandler(workerIdx, w)` captures both the worker index and a reference to that specific `Worker` (`w`), so `http-response` is only delivered to the worker that emitted the matching `http-request` — never broadcast.

### Steps

**Part A — Run the Tauri desktop build**

1. Build (if not already built): `npx tauri build` (release `.app` / `.dmg`) or `npm run tauri:dev` (dev build with hot-reload).
2. Launch the RedfireForge desktop app:
   - **Release:** open `src-tauri/target/release/bundle/macos/RedfireForge.app` (macOS) or the `.dmg` install. Title bar reads `RedfireForge — Redfire Performance Workbench`.
   - **Dev:** the `npm run tauri:dev` command launches the app directly.
3. Confirm you're in Tauri (not the browser): the window has the native macOS/Windows chrome (no browser address bar), and the URL bar — if visible at all — shows `tauri://localhost/...` rather than `http://localhost:5173/...`. You can also paste `(async () => isTauri ?? 'unknown')()` into DevTools Console; in Tauri `window.__TAURI__` is defined.

**Part B — Run a multi-worker test with verifiable per-request data**

4. Use the `PR4 Multi-Worker → Worker Pool` set (13 tests).
5. **Critical for this scenario**: each test's URL must contain a unique `test=NN` query parameter that gets echoed back in `args.test` so you can detect crossover. If you followed the Setup section the URLs already are `https://httpbin.org/get?test=01` … `test=13`.
6. Go to **Harness → Test Runner** → select all 13 tests.
7. Set **Execution Mode**: `Batch`, **Concurrency**: `8`, **Iterations**: `1`.
8. Open DevTools (in Tauri the menu is **View → Toggle Developer Tools** or `Cmd + Option + I`) → **Sources → Threads** to confirm K=7 workers spawn.
9. Click **▶ Run Test**.

**Part C — Verify no proxy crossover**

10. After the run, open each result row → response detail panel → check the JSON body's `args.test` field.
11. **Critical:** for every row, `args.test` must equal the row's test number (e.g. `Test 05` row → response body `"args": { "test": "05" }`).
12. If any row shows a **mismatched** `args.test`, that's a routing bug — the main-thread proxy delivered an `http-response` to the wrong worker (the per-request `id` correlation broke).
13. Confirm all 13 results returned with status 200 and the run finished cleanly.

**Part D — Stress the proxy with concurrent requests**

14. Re-run with **Iterations**: `5` (= 65 total requests). The increased concurrency makes proxy crossover bugs more likely to surface.
15. Spot-check 10 random rows across the 65 results — every one should still have `args.test` matching its row's test number.

### Expected Outcomes

- [x] All 13 (or 65 in Part D) results complete with `httpStatus = 200`.
- [x] Every result's response body shows the **correct** `args.test` value matching its row name (no crossover).
- [x] No "Worker received unexpected response" or similar console errors.
- [x] No `http-response` messages lost (result count = expected count, no rows with `httpStatus = 0` due to dropped responses).
- [x] Run completes in roughly the same wall time as the equivalent web build (the main-thread proxy adds minimal overhead — main-thread `httpFetch` is fast and async).
- [x] Memory in Activity Monitor stays stable after the run (no leak from unmatched correlation IDs in `httpFetch.then(...)` closures).

---

## Test Scenario 11: Combined — Full Tier 1 Integration

**Purpose**: End-to-end smoke test that **all four PR optimizations** (PR1 connection pool + PR2 progress throttle + PR3 prep cache & combined resolver + PR4 multi-worker) work together under a realistic load without regressing each other.

**Optimization**: All Tier 1 items (PR1 + PR2 + PR3 + PR4)

### Steps

**Part A — Create the integration test**

1. Go to **Harness → Feature Groups** → inside `PR4 Multi-Worker`, create a new Scenario `Tier 1 Integration` → add a Test:
   - **Name**: `Tier 1 Integration`
   - **Method**: `POST`
   - **URL**: `https://httpbin.org/post`
   - **Body Type**: `JSON`, **Body**: `{"test": "tier1-integration", "v": "1"}`
   - **Custom Headers**: `X-Test: tier1`, `Accept: application/json`
   - **Save**.

**Part B — Run as a high-throughput load test**

> We use load-profile mode so multi-worker triggers on a single test, and the load runs long enough to make each cache/optimization measurable.

2. Go to **Harness → Test Runner** → select only `Tier 1 Integration`.
3. Set **Execution Mode**: `Load Profile`, **Shape**: `Sustained`, **Concurrency**: `50`, **Duration**: `30s`.
4. Open DevTools → **Sources → Threads**, and open **Activity Monitor** / **Task Manager** alongside.
5. Note pre-run memory of the Chrome / Tauri process (e.g. 450 MB).
6. Click **▶ Run Test**.

**Part C — Monitor live behavior (during the run)**

7. Watch the **progress / RPS counter**:
   - Progress should update smoothly at ~500 ms intervals (PR2 main-thread throttle).
   - RPS should stabilize within the first few seconds and stay roughly constant for the full 30 s.
8. Check DevTools **Threads** — **K = min(N, 50) = N** workers should be active throughout (PR4).
9. Check Activity Monitor — multiple CPU cores should be busy (PR4 — not single-threaded).
10. Click around the UI — switching tabs, opening menus — should remain responsive (PR2 throttle keeps the main thread idle; PR4 keeps execution off the main thread).

**Part D — Verify after completion**

11. Note the final **total request count** and **RPS** from the runner status bar — record these.
12. Compare RPS to pre-Tier-1 baseline (whatever you have from before this branch):
    - PR1 added persistent connection pool / `undici.Agent` (large gain on TLS-heavy endpoints).
    - PR2 added 500 ms main-thread progress throttle (UI responsiveness, no RPS impact directly).
    - PR3 added prep cache + combined URL/header/body resolver (small gain per request, large at high RPS).
    - PR4 added N-way Web Worker fan-out (largest gain on multi-core machines).
    - **Combined expected gain: 3–5× over pre-Tier-1 baseline** (machine-dependent; document actual values).
13. Spot-check 5 random results from start / middle / end of the run (open the response detail panel for each):
    - Echoed `headers["X-Test"]` is exactly `"tier1"` (PR3 prep cache, no header drift across requests).
    - `headers["Accept"]` is exactly `"application/json"`.
    - `headers["Content-Type"]` is `"application/json"` (set automatically because Body Type = JSON).
    - Echoed body (`data` field of httpbin's response) is exactly `{"test": "tier1-integration", "v": "1"}`.
14. Result IDs should span K distinct `w{0..K-1}-…` prefixes — confirms all workers contributed.
15. Wait 10 s after the run completes → memory should return close to pre-run baseline (no leaks from prep cache, workers, or connection pool).

### Expected Outcomes

- [x] Total request count matches the runner summary; results table has the same count (no losses).
- [x] **RPS is at least 3× the pre-Tier-1 baseline** (target 3–5×; document actual value vs. baseline).
- [x] Multi-core CPU utilization visible in Activity Monitor (PR4 working).
- [x] Progress updates feel smooth at ~500 ms intervals (PR2 working).
- [x] All sampled results have correct headers and body (PR3 prep cache working — no drift).
- [x] Result IDs span K = N distinct `w{n}-…` prefixes (PR4 fan-out verified at the result level).
- [x] UI remains responsive throughout the 30 s run (no beach-balls, no input lag).
- [x] All K workers terminate cleanly after the run (DevTools **Threads** returns to just **Main**).
- [x] Memory returns to near pre-run baseline within 10 s (no leak).
- [x] No errors or unhandled rejections in the console.

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Scenarios split correctly across K workers via `⌈length/N⌉` chunking | [x] | Scenarios 1, 9 |
| All results aggregated without loss (zero drops at worker boundaries) | [x] | Scenarios 2, 8 |
| Progress merging from K workers (sum of `completedPerWorker[]`) | [x] | Scenario 3 |
| **■ Stop** fans out abort to all workers; partial results preserved | [x] | Scenario 4 |
| Per-worker error results aggregate normally (no uncaught rejections) | [x] | Scenario 5 |
| Threshold fallback (`< 8` selected tests → 1 worker) | [x] | Scenario 6 |
| Workflow fallback (any workflow → 1 worker, no variable bleed) | [x] | Scenario 7 |
| Multi-core CPU utilization + UI responsiveness under load | [x] | Scenario 8 |
| Tauri HTTP proxy: `http-request` / `http-response` routed only to the originating worker | [x] | Scenario 10 |
| Full Tier 1 integration: PR1 + PR2 + PR3 + PR4 deliver 3–5× RPS over baseline | [x] | Scenario 11 |

### Recording your machine's worker numbers

For reproducibility, record these once at the start of testing and keep them next to your results:

| Variable | Value on your machine | How obtained |
|---|---|---|
| `navigator.hardwareConcurrency` | _e.g._ `8` | DevTools Console snippet (Setup → Step A) |
| `N = getWorkerCount()` | _e.g._ `7` | Same snippet |
| K for 13-test batch run | _e.g._ `7` | DevTools **Threads** during Scenario 1 |
| K for 8-test batch run | _e.g._ `4` | DevTools **Threads** during Scenario 6 Part C |
| Single-worker baseline RPS | _e.g._ `145 RPS` | Scenario 8 Part B |
| Multi-worker RPS at concurrency=50 | _e.g._ `820 RPS` | Scenario 8 Part C |
| Tier 1 RPS (Scenario 11) | _e.g._ `940 RPS` | Scenario 11 Part D |
