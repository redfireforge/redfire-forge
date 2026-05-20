# Tier 2 — Rust Executor Integration Test Scenarios

> Rust executor via `#[tauri::command]` — requires Tauri desktop build (`npx tauri dev`)
> Created: 2026-05-18
> Phases 2A–2D completed: 2026-05-18

---

## Prerequisites

- Running in **Tauri desktop mode** (not web dev mode) — Rust executor is only available in Tauri
- Accessible via Cmd+Shift+T or `?rust-test` URL param (dev mode) for the test panel
- For production testing, the Rust executor activates automatically when conditions are met

---

## Implementation Summary

| Phase | What | Status |
|-------|------|--------|
| 2A | Rust executor core (reqwest + tokio, pool/load-profile, think time, circuit breaker, retry) | ✅ Done — 62 tests |
| 2B | Tauri commands + event streaming (start_load_test, abort_load_test, progress events) | ✅ Done — 8 tests |
| 2C | JS integration + fallback (buildExecutionPlan, mapRustResult, canUseRustExecutor, runTestViaRust) | ✅ Done — 68 tests |
| 2D | Integration tests + edge cases (48 integration tests covering all execution paths) | ✅ Done — 48 tests |

---

## Validation Checklist

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Rust Executor — Availability Detection](#test-scenario-1-rust-executor--availability-detection) | [ ] | |
| 2 | [Pool Mode — Basic Execution](#test-scenario-2-pool-mode--basic-execution) | [ ] | |
| 3 | [Sequential Mode — Single Concurrency](#test-scenario-3-sequential-mode--single-concurrency) | [ ] | |
| 4 | [Load Profile — Sustained Duration](#test-scenario-4-load-profile--sustained-duration) | [ ] | |
| 5 | [Load Profile — Ramp-Up Concurrency](#test-scenario-5-load-profile--ramp-up-concurrency) | [ ] | |
| 6 | [Abort — Immediate Cancellation](#test-scenario-6-abort--immediate-cancellation) | [ ] | |
| 7 | [Circuit Breaker — Threshold Stop](#test-scenario-7-circuit-breaker--threshold-stop) | [ ] | |
| 8 | [Think Time — Constant Delay](#test-scenario-8-think-time--constant-delay) | [ ] | |
| 9 | [Retry — Network Error Recovery](#test-scenario-9-retry--network-error-recovery) | [ ] | |
| 10 | [Fallback — OAuth2 Scenarios Use JS](#test-scenario-10-fallback--oauth2-scenarios-use-js) | [ ] | |
| 11 | [Fallback — Workflow Mode Uses JS](#test-scenario-11-fallback--workflow-mode-uses-js) | [ ] | |
| 12 | [Validation — Selective Mode in Rust](#test-scenario-12-validation--selective-mode-in-rust) | [ ] | |
| 13 | [Validation — Full Mode (JSON Compare)](#test-scenario-13-validation--full-mode-json-compare) | [ ] | |
| 14 | [Validation — Assertions (Status + Regex + Numeric)](#test-scenario-14-validation--assertions-status--regex--numeric) | [ ] | |
| 15 | [Validation — Custom Assertion Fallback to JS](#test-scenario-15-validation--custom-assertion-fallback-to-js) | [ ] | |
| 16 | [Progress Streaming — Batched Results](#test-scenario-16-progress-streaming--batched-results) | [ ] | |
| 17 | [High Throughput — 1000 Requests Pool](#test-scenario-17-high-throughput--1000-requests-pool) | [ ] | |
| 18 | [Data Source — Parameterized Execution](#test-scenario-18-data-source--parameterized-execution) | [ ] | |

**Progress**: 0 / 18 validated

---

## Test Scenario 1: Rust Executor — Availability Detection

- [ ] **VALIDATED**

**Purpose**: Verify that the Rust executor is detected as available when running in Tauri mode.

**Steps**:
1. Launch the app in Tauri desktop mode (`npx tauri dev`)
2. Open the Rust Executor Test Panel (Cmd+Shift+T)
3. Click "Check Availability"

**Expected**:
- [ ] Panel reports "Rust executor: Available"
- [ ] `is_rust_executor_available` returns true
- [ ] No errors in the console

**Verifies**: 2B (is_rust_executor_available command)

---

## Test Scenario 2: Pool Mode — Basic Execution

- [ ] **VALIDATED**

**Purpose**: Verify pool mode execution through the Rust executor produces correct results.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Batch" (maps to pool), iterations=10, concurrency=5
3. Ensure no OAuth2 auth, no custom assertions (Rust path eligibility)
4. Run

**Expected**:
- [ ] All 10 results complete with HTTP 200
- [ ] Results contain proper timing breakdown (TTFB, download)
- [ ] Response headers are preserved (e.g., `content-type`)
- [ ] Response body is present (capped at 2000 chars)
- [ ] TPS reflects parallel execution (higher than sequential)
- [ ] `requestLog` shows sent headers and body

**Verifies**: 2A (run_pool), 2C (buildExecutionPlan pool mapping)

---

## Test Scenario 3: Sequential Mode — Single Concurrency

- [ ] **VALIDATED**

**Purpose**: Verify sequential mode routes through Rust with concurrency=1.

**Steps**:
1. Create request: `GET https://httpbin.org/delay/1`
2. Set mode to "Sequential", iterations=3
3. Run

**Expected**:
- [ ] 3 results, each ~1 second apart
- [ ] Total duration ~3 seconds (sequential, not parallel)
- [ ] All results pass (HTTP 200)
- [ ] TPS ≈ 1.0

**Verifies**: 2C (sequential → pool with concurrency=1 mapping)

---

## Test Scenario 4: Load Profile — Sustained Duration

- [ ] **VALIDATED**

**Purpose**: Verify load profile (sustained) mode runs for the configured duration.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Load Profile", duration=10s, concurrency=5
3. Profile type: "Sustained"
4. Run

**Expected**:
- [ ] Execution runs for approximately 10 seconds
- [ ] Requests are sent continuously throughout the duration
- [ ] Total results > 20 (depends on response time)
- [ ] Progress events stream in ~100ms intervals
- [ ] Concurrency stays at 5 throughout

**Verifies**: 2A (run_load_profile sustained), 2B (progress event streaming)

---

## Test Scenario 5: Load Profile — Ramp-Up Concurrency

- [ ] **VALIDATED**

**Purpose**: Verify ramp-up profile gradually increases concurrency.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Load Profile", duration=15s, concurrency=10
3. Profile type: "Ramp-Up", ramp-up time: 10s
4. Run and observe live progress

**Expected**:
- [ ] First few seconds: lower TPS (concurrency ramping up)
- [ ] After 10s: full concurrency (10) reached
- [ ] TPS increases linearly during ramp-up phase
- [ ] LiveProgressPanel shows increasing current concurrency

**Verifies**: 2A (get_target_concurrency ramp-up), 2B (target_concurrency in ProgressBatch)

---

## Test Scenario 6: Abort — Immediate Cancellation

- [ ] **VALIDATED**

**Purpose**: Verify abort signal propagates to Rust CancellationToken and stops execution.

**Steps**:
1. Create request: `GET https://httpbin.org/delay/5` (slow endpoint)
2. Set mode to "Batch", iterations=50, concurrency=10
3. Start execution
4. Click "Stop" after 2-3 seconds

**Expected**:
- [ ] Execution stops within 1 second of clicking Stop
- [ ] In-flight requests are cancelled (not waited on)
- [ ] Results show mix of completed (HTTP 200) and cancelled
- [ ] Cancelled results have `errorMessage: "Cancelled"`
- [ ] Progress bar shows actual completion (not 100%)
- [ ] No lingering requests after abort

**Verifies**: 2A (CancellationToken + tokio::select!), 2C (abortRustLoadTest invocation)

---

## Test Scenario 7: Circuit Breaker — Threshold Stop

- [ ] **VALIDATED**

**Purpose**: Verify circuit breaker trips when error threshold is reached.

**Steps**:
1. Create request: `GET https://httpbin.org/status/500`
2. Set mode to "Batch", iterations=50, concurrency=5
3. Set error policy: "Threshold", max errors: 10, error rate: 50%
4. Run

**Expected**:
- [ ] Execution stops after approximately 10 errors
- [ ] Total results < 50 (breaker stops early)
- [ ] ProgressBatch.breaker_tripped = true in final batch
- [ ] Error rate in results is approximately 100% (all 500s)
- [ ] Remaining iterations are NOT launched

**Verifies**: 2A (CircuitBreakerState), 2C (breaker_tripped handling)

---

## Test Scenario 8: Think Time — Constant Delay

- [ ] **VALIDATED**

**Purpose**: Verify think time delays are applied between requests in Rust.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Batch", iterations=6, concurrency=2
3. Enable think time: Constant, 500ms
4. Run

**Expected**:
- [ ] Total duration notably longer than without think time
- [ ] ~500ms pause between batches visible in timing
- [ ] All 6 results pass
- [ ] Think time does NOT count toward response time metrics

**Verifies**: 2A (apply_think_time with tokio::time::sleep)

---

## Test Scenario 9: Retry — Network Error Recovery

- [ ] **VALIDATED**

**Purpose**: Verify retry logic in Rust for network errors.

**Steps**:
1. Create request targeting an unreachable host: `GET http://192.0.2.1:9999/test` (RFC 5737 TEST-NET)
2. Set mode to "Sequential", iterations=2
3. Set retry: 2 times, retry delay: 500ms
4. Set timeout: 3 seconds
5. Run

**Expected**:
- [ ] Each iteration retries 2 times (3 total attempts)
- [ ] Results show `retryCount: 2`
- [ ] Error message indicates timeout or connection refused
- [ ] Total time per iteration ≈ (3 × timeout) + (2 × retryDelay) = ~10s
- [ ] Only 2 results in output (retries don't create extra results)

**Verifies**: 2A (execute_with_retry), 2D (retry behavior edge cases)

---

## Test Scenario 10: Fallback — OAuth2 Scenarios Use JS

- [ ] **VALIDATED**

**Purpose**: Verify that scenarios with OAuth2 auth fall back to JS executor.

**Steps**:
1. Create request with OAuth2 authentication configured
2. Set mode to "Batch", iterations=3
3. Run

**Expected**:
- [ ] Execution completes via JS multi-worker path (not Rust)
- [ ] OAuth2 token refresh/cache logic works correctly
- [ ] Console shows no Rust executor invocation
- [ ] Results are identical to web mode behavior

**Verifies**: 2C (canUseRustExecutor OAuth2 gate)

---

## Test Scenario 11: Fallback — Workflow Mode Uses JS

- [ ] **VALIDATED**

**Purpose**: Verify workflow execution never routes to Rust executor.

**Steps**:
1. Select a workflow with multiple nodes
2. Set iterations=3, concurrency=2
3. Run via Workflow Runner

**Expected**:
- [ ] Execution uses JS graph runner (not Rust)
- [ ] Workflow variables and edges resolve correctly
- [ ] Results show per-node outcomes as expected

**Verifies**: 2C (canUseRustExecutor workflow gate)

---

## Test Scenario 12: Validation — Selective Mode in Rust

- [ ] **VALIDATED**

**Purpose**: Verify Rust-side selective validation (expectedFields with operators) produces correct pass/fail.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Add selective validation:
   - Field `$.url` equals `"https://httpbin.org/get"`
   - Field `$.headers.Host` contains `"httpbin"`
3. Set mode to "Batch", iterations=3
4. Run

**Expected**:
- [ ] All 3 results pass validation
- [ ] No failureDetails present
- [ ] `validationMode` is "selective"
- [ ] Validation was performed in Rust (not JS re-validation)

**Verifies**: 3A Sub-Group D (validate_fields in Rust), 2C (mapRustResult passthrough)

---

## Test Scenario 13: Validation — Full Mode (JSON Compare)

- [ ] **VALIDATED**

**Purpose**: Verify full JSON comparison mode works in Rust.

**Steps**:
1. Create request: `GET https://httpbin.org/ip`
2. Set validation mode to "Full"
3. Set expected JSON to a known-wrong value: `{"origin": "0.0.0.0"}`
4. Run 1 iteration

**Expected**:
- [ ] Result shows validation failure
- [ ] `failureDetails` contains path mismatch (e.g., `$.origin`)
- [ ] Expected shows `"0.0.0.0"`, actual shows your real IP
- [ ] `passed` is false

**Verifies**: 3A Sub-Group D (json_validator.rs full mode + deep_compare)

---

## Test Scenario 14: Validation — Assertions (Status + Regex + Numeric)

- [ ] **VALIDATED**

**Purpose**: Verify multiple assertion types evaluate correctly in Rust.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Add assertions:
   - Status assertion: expected `200`
   - Regex assertion: path `$.url`, pattern `^https://`
   - Numeric assertion: path `$.headers` → (use a scenario returning numeric data, or adjust)
3. Run 1 iteration

**Expected**:
- [ ] Status assertion passes (200 matches)
- [ ] Regex assertion passes (url starts with https://)
- [ ] All assertions shown as passing in results detail
- [ ] `failureDetails` is empty

**Verifies**: 3A Sub-Group C (assertion_evaluator.rs — status, regex, numeric types)

---

## Test Scenario 15: Validation — Custom Assertion Fallback to JS

- [ ] **VALIDATED**

**Purpose**: Verify custom assertions are filtered from Rust and run in JS post-hoc.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Add assertions:
   - Status assertion: expected `200` (runs in Rust)
   - Custom assertion: `$.url.length > 10` (runs in JS)
3. Run 1 iteration

**Expected**:
- [ ] Both assertions evaluate correctly
- [ ] Status assertion evaluated in Rust (no JS re-run)
- [ ] Custom assertion evaluated in JS (after Rust result arrives)
- [ ] Combined result: passed = true, no failures
- [ ] No duplicate assertion evaluation

**Verifies**: 3A Step 8 (custom assertion filter + JS merge in mapRustResult)

---

## Test Scenario 16: Progress Streaming — Batched Results

- [ ] **VALIDATED**

**Purpose**: Verify progress events stream at ~100ms intervals with batched results.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Load Profile", duration=5s, concurrency=10
3. Run and observe LiveProgressPanel updates

**Expected**:
- [ ] LiveProgressPanel updates smoothly (no frozen gaps)
- [ ] Progress increments visible every ~100-200ms
- [ ] TPS/error rate/response time update in real-time
- [ ] Final results match the accumulated batches
- [ ] `elapsedMs` in progress events is monotonically increasing

**Verifies**: 2A (BATCH_INTERVAL_MS), 2B (app.emit progress events), 2C (listener + accumulation)

---

## Test Scenario 17: High Throughput — 1000 Requests Pool

- [ ] **VALIDATED**

**Purpose**: Verify Rust executor handles high-volume pool execution efficiently.

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Batch", iterations=1000, concurrency=50
3. Run

**Expected**:
- [ ] All 1000 requests complete (0% error rate)
- [ ] TPS significantly higher than JS multi-worker path (>2x improvement)
- [ ] Memory usage stays stable (no JS GC pressure)
- [ ] Total duration reasonable for httpbin latency (~200ms avg → ~4-5s total)
- [ ] No socket exhaustion errors

**Verifies**: 2A (Rust executor at scale), performance improvement over Tier 1

---

## Test Scenario 18: Data Source — Parameterized Execution

- [ ] **VALIDATED**

**Purpose**: Verify data source expansion (done in JS) feeds correctly to Rust executor.

**Steps**:
1. Create request: `GET https://httpbin.org/anything/{{row.id}}`
2. Attach CSV data source with 5 rows (id: 1,2,3,4,5)
3. Set mode to "Batch", concurrency=3
4. Run

**Expected**:
- [ ] 5 requests execute (one per data row)
- [ ] Each request URL contains the substituted row ID
- [ ] `dataRowId` and `dataRowLabel` are present in results
- [ ] All 5 pass with unique response bodies
- [ ] Request order may vary (concurrent), but all rows are covered

**Verifies**: 2C (JS expandQueue + prepareScenario → Rust execution), data_row_id/label propagation

---

## Notes

### What stays in JS (never uses Rust executor)

| Feature | Reason |
|---------|--------|
| Workflow mode | Graph topology requires JS variable context and edge traversal |
| OAuth2 scenarios | Token manager has refresh/cache logic in JS |
| Custom assertions | Expression evaluator depends on JS runtime |
| Web/browser mode | No Tauri binary available |

### Performance Comparison Target

| Metric | JS Multi-Worker (Tier 1) | Rust Executor (Tier 2) |
|--------|-------------------------|----------------------|
| RPS (pool mode) | ~6,000-8,000 | ~10,000-15,000 |
| Memory per request | ~1-2 KB (JS object + GC) | ~200 bytes (Rust stack) |
| Startup overhead | ~50ms per Web Worker | ~0ms (tokio running) |
| Connection model | HTTP/1.1 (undici) | HTTP/1.1 + HTTP/2 (hyper) |
