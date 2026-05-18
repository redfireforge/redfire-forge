# Throughput PR 1 — Test Scenarios for Visual Verification

> PR 1: Hot-Path Micro-Optimizations
> Completed: 2026-05-18
> Branch: `feature/review-status`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/engine/executor.ts` | 1O: `buildHeaders` string ops; 1H: import `resetResultIdCounter` |
| `src/engine/requestExecution.ts` | 1B: timeout leak fix; 1H: monotonic counter; 1E: conditional parse |
| `src/engine/loadProfileRunner.ts` | 1H: monotonic counter; 1N: remove redundant progress; 1J: error fields |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | 1H: monotonic counter; 1E: conditional parse |
| `src/features/workflow/engine/graphLoadRunner.ts` | 1H: monotonic counter; 1D: counter-based pool |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Parameterized — Standard Execution](#test-scenario-1-parameterized-test--standard-execution) | [ ] | |
| 2 | [Parameterized — With Validation](#test-scenario-2-parameterized-test--with-validation) | [ ] | |
| 3 | [Parameterized — No Validation (Skip Parse)](#test-scenario-3-parameterized-test--no-validation-skip-parse) | [ ] | |
| 4 | [HTTP Error — Error Message Extraction](#test-scenario-4-http-error-handling--error-message-extraction) | [ ] | |
| 5 | [Load Profile — Sustained](#test-scenario-5-load-profile--sustained) | [ ] | |
| 6 | [Load Profile — Ramp-Up](#test-scenario-6-load-profile--ramp-up) | [ ] | |
| 7 | [Load Profile — Error During Execution](#test-scenario-7-load-profile--error-during-execution) | [ ] | |
| 8 | [Workflow — Single Iteration](#test-scenario-8-workflow--single-iteration) | [ ] | |
| 9 | [Workflow — Load Test (Counter Pool)](#test-scenario-9-workflow--load-test-counter-based-pool) | [ ] | |
| 10 | [Workflow — Abort During Load](#test-scenario-10-workflow--abort-during-load) | [ ] | |
| 11 | [Workflow — Breaker Already Tripped](#test-scenario-11-workflow--breaker-already-tripped) | [ ] | |
| 12 | [Batch Mode with Think Time](#test-scenario-12-batch-mode-with-think-time) | [ ] | |
| 13 | [Sequential Mode with Retry](#test-scenario-13-sequential-mode-with-retry) | [ ] | |

**Progress**: 0 / 13 validated

---

## Test Scenario 1: Parameterized Test — Standard Execution

- [ ] **VALIDATED**

**Purpose**: Verify basic parameterized test execution still works with all optimizations applied.

**Steps**:
1. Open RedfireForge → Requests
2. Create a new request: `GET https://httpbin.org/get`
3. Go to Scenarios → create scenario from this request
4. Set iterations to 10, concurrency to 3, execution mode to "Pool"
5. Click "Run"

**Expected**:
- [ ] All 10 iterations complete
- [ ] Results show `r-1` through `r-10` as result IDs (monotonic counter, not UUIDs)
- [ ] Response times are recorded correctly
- [ ] Status codes are 200 for all

**Verifies**: 1H (monotonic IDs), 1O (headers), 1B (timeout cleanup)

---

## Test Scenario 2: Parameterized Test — With Validation

- [ ] **VALIDATED**

**Purpose**: Verify `JSON.parse` still happens when validation is configured.

**Steps**:
1. Use `GET https://httpbin.org/get`
2. Add an assertion: `status == 200`
3. Add a field validation: `$.url` equals `https://httpbin.org/get`
4. Set iterations to 5, mode to "Batch"
5. Run

**Expected**:
- [ ] All 5 pass with green checkmarks
- [ ] Assertion results show correctly
- [ ] Field validation shows actual vs expected
- [ ] `responseBody` in results is properly parsed (not raw string)

**Verifies**: 1E (conditional parse — should parse because assertions exist)

---

## Test Scenario 3: Parameterized Test — No Validation (Skip Parse)

- [ ] **VALIDATED**

**Purpose**: Verify `JSON.parse` is skipped when no validation is configured.

**Steps**:
1. Use `GET https://httpbin.org/get`
2. Set validation mode to "None" (no assertions, no expected fields)
3. Set iterations to 20, concurrency to 5, mode to "Pool"
4. Run

**Expected**:
- [ ] All 20 complete faster than Scenario 2 (proportionally)
- [ ] Results show status 200
- [ ] `responseBody` field still contains truncated body (first 2000 chars)
- [ ] No assertion results (validation is "none")

**Verifies**: 1E (conditional parse — should SKIP parse because no validation)

---

## Test Scenario 4: HTTP Error Handling — Error Message Extraction

- [ ] **VALIDATED**

**Purpose**: Verify error message extraction still works (requires JSON.parse on error responses).

**Steps**:
1. Create request: `GET https://httpbin.org/status/404`
2. Set validation mode to "None"
3. Set iterations to 3
4. Run

**Expected**:
- [ ] All 3 show as failed (HTTP 404)
- [ ] `errorMessage` should contain meaningful error text (not raw JSON string)
- [ ] Result IDs are `r-1`, `r-2`, `r-3`

**Verifies**: 1E (conditional parse — forces parse on HTTP errors even when validation=none), 1H (counter IDs)

---

## Test Scenario 5: Load Profile — Sustained

- [ ] **VALIDATED**

**Purpose**: Verify load profile runner works with optimized per-completion callback (no redundant progress).

**Steps**:
1. Create request: `GET https://httpbin.org/delay/0`
2. Switch to Load Profile mode
3. Set: Sustained, concurrency=5, duration=10s
4. Run

**Expected**:
- [ ] Live progress chart updates smoothly (every ~500ms from ticker)
- [ ] Concurrency stays at 5 throughout
- [ ] Results accumulate steadily
- [ ] No gaps or freezes in the progress chart
- [ ] Error results (if any) include `responseHeaders: {}` and `requestLog` fields

**Verifies**: 1N (removed per-completion progress — ticker still reports), 1J (error result shape)

---

## Test Scenario 6: Load Profile — Ramp-Up

- [ ] **VALIDATED**

**Purpose**: Verify ramp-up profile still works without per-completion `getTargetConcurrency`.

**Steps**:
1. Create request: `GET https://httpbin.org/delay/0`
2. Switch to Load Profile mode
3. Set: Ramp-Up, max concurrency=10, duration=15s, ramp-up=10s
4. Run

**Expected**:
- [ ] Progress chart shows concurrency ramping from 1→10 over first 10 seconds
- [ ] Then sustains at 10 for remaining 5 seconds
- [ ] Smooth curve (no jagged steps larger than ~500ms)

**Verifies**: 1N (ticker-only progress still reflects correct concurrency target)

---

## Test Scenario 7: Load Profile — Error During Execution

- [ ] **VALIDATED**

**Purpose**: Verify the load profile error result now includes `responseHeaders` and `requestLog`.

**Steps**:
1. Create request: `GET https://nonexistent.invalid.domain/test`
2. Switch to Load Profile mode
3. Set: Sustained, concurrency=2, duration=5s
4. Run

**Expected**:
- [ ] All results are errors (network failures)
- [ ] Click any error result → inspect detail
- [ ] Should see `responseHeaders` (empty `{}`) and `requestLog` (with headers and body) — NOT undefined
- [ ] Error IDs are `r-1`, `r-2`, etc. (monotonic, not `err-<timestamp>`)

**Verifies**: 1J (error result fields), 1H (counter IDs in error path)

---

## Test Scenario 8: Workflow — Single Iteration

- [ ] **VALIDATED**

**Purpose**: Verify workflow HTTP execution with conditional body parsing and monotonic IDs.

**Steps**:
1. Open Workflow Designer
2. Create: Start → HTTP (`GET https://httpbin.org/get`) → End
3. Add validation assertion on the HTTP node: `status == 200`
4. Run Quick Test (1 iteration)

**Expected**:
- [ ] Workflow completes with pass
- [ ] HTTP node shows green (pass)
- [ ] Result has monotonic ID (e.g., `r-1`)
- [ ] Response body is properly parsed (assertion evaluated correctly)

**Verifies**: 1H (graphRunnerHelpers monotonic ID), 1E (conditional parse in workflow)

---

## Test Scenario 9: Workflow — Load Test (Counter-Based Pool)

- [ ] **VALIDATED**

**Purpose**: Verify the new counter-based iteration pool in `graphLoadRunner`.

**Steps**:
1. Use the same workflow as Scenario 8
2. Set iterations=20, concurrency=4
3. Run

**Expected**:
- [ ] All 20 iterations complete
- [ ] Progress bar updates smoothly
- [ ] Results are tagged with `iterationIndex` 0-19
- [ ] No timeout or hang (the old `indexOf+splice` bug is fixed)
- [ ] Total time is approximately consistent (no O(n) degradation)

**Verifies**: 1D (counter-based pool — no more `pool.indexOf(p)` + `splice`)

---

## Test Scenario 10: Workflow — Abort During Load

- [ ] **VALIDATED**

**Purpose**: Verify abort works correctly with the new counter-based pool.

**Steps**:
1. Use same workflow as Scenario 9
2. Set iterations=100, concurrency=10
3. Start the run
4. Click "Stop" / abort after ~2-3 seconds

**Expected**:
- [ ] Execution stops promptly (within ~1 second)
- [ ] Partial results are displayed
- [ ] No hang or "waiting for iterations to complete" behavior
- [ ] Some results may show "Cancelled by user"

**Verifies**: 1D (counter-based pool abort handling)

---

## Test Scenario 11: Workflow — Breaker Already Tripped

- [ ] **VALIDATED**

**Purpose**: Verify the counter-based pool resolves immediately when breaker is pre-tripped.

**Steps**:
1. Create workflow with HTTP node targeting `GET https://httpbin.org/status/500`
2. Set error policy to "Stop on First Error"
3. Set iterations=50, concurrency=10
4. Run

**Expected**:
- [ ] Only 1-2 iterations run before breaker trips
- [ ] Execution stops immediately
- [ ] Remaining iterations are NOT launched
- [ ] Total results = small number (not 50)

**Verifies**: 1D (counter-based pool respects breaker.shouldStop)

---

## Test Scenario 12: Batch Mode with Think Time

- [ ] **VALIDATED**

**Purpose**: Verify batch execution with think time still works (no regression from 1B timeout fix).

**Steps**:
1. Create request: `GET https://httpbin.org/get`
2. Set mode to "Batch", iterations=6, concurrency=2
3. Enable think time: Constant, 500ms
4. Run

**Expected**:
- [ ] 3 batches of 2 requests each
- [ ] ~500ms pause between batches
- [ ] Total time ≈ (3 batches × avg response time) + (2 pauses × 500ms) ≈ 2-3 seconds
- [ ] All 6 results pass

**Verifies**: 1B (timeout cleanup doesn't interfere with think time)

---

## Test Scenario 13: Sequential Mode with Retry

- [ ] **VALIDATED**

**Purpose**: Verify retry logic still works with monotonic counter and timeout fix.

**Steps**:
1. Create request: `GET https://httpbin.org/status/503`
2. Set mode to "Sequential", iterations=2
3. Set retry count=2, retry delay=500ms
4. Run

**Expected**:
- [ ] Each iteration retries 2 times (3 total attempts per iteration)
- [ ] All results show as failed (503 is persistent)
- [ ] `errorMessage` shows "(after 3 attempts)"
- [ ] Result IDs are sequential (`r-1`, `r-2`) — no duplicates from retries

**Verifies**: 1B (timeout cleanup during retries), 1H (counter IDs — retries don't create extra IDs because `executeWithRetry` reuses the last result)

---

## Automated Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `src/engine/executor.test.ts` | All pass | ✅ |
| `src/engine/requestExecution.test.ts` | All pass | ✅ |
| `src/engine/loadProfileRunner.test.ts` | All pass | ✅ |
| `src/features/workflow/engine/graphLoadRunner.test.ts` | All pass | ✅ |
| `src/features/workflow/engine/graphRunnerHelpers.test.ts` | All pass | ✅ |
| `src/features/workflow/engine/graphRunnerHelpers.workflowNodeId.test.ts` | All pass | ✅ |
| **Total** | **208 / 208 pass** | ✅ |

```
npx tsc -b --noEmit           → 0 errors
npx vitest run <6 test files> → 208 passed, 0 failed
```

---

## Optimization Summary

| ID | Optimization | File(s) | Status |
|----|-------------|---------|--------|
| 1O | Cache `.trim()` in local variable | `executor.ts` | ✅ Done |
| 1B | Clear timeout after `Promise.race` resolves | `requestExecution.ts` | ✅ Done |
| 1H | Replace `uuidv4()` / `crypto.randomUUID()` with `nextResultId()` | 5 files | ✅ Done |
| 1N | Remove per-completion `getTargetConcurrency` + `onProgress` | `loadProfileRunner.ts` | ✅ Done |
| 1J | Add `responseHeaders`, `requestLog` to error `RequestResult` | `loadProfileRunner.ts` | ✅ Done |
| 1D | Replace `pool.indexOf+splice` with counter-based pattern | `graphLoadRunner.ts` | ✅ Done |
| 1E | Skip `JSON.parse` when no validation/assertions (parse on HTTP error) | `requestExecution.ts`, `graphRunnerHelpers.ts` | ✅ Done |
| 1L | Pre-allocate result arrays | — | ⊘ Skipped (marginal) |
