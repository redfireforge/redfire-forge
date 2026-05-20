# Tier 2 Phase 2D — Test Scenarios

> Integration Tests + Edge Cases
> Created: 2026-05-18
> File: `src/features/test-runner/utils/rustBridgeIntegration.test.ts` (58 tests)
> Thorough pre-evaluation of each step before implementation.
> 0 bugs found during implementation.
> Re-evaluation (code quality round): +10 coverage tests added (total 58).

---

## Summary

Phase 2D provides comprehensive integration tests that exercise the full JS→Rust bridge pipeline end-to-end: building execution plans, running tests with mock invoke/listen, validating result mapping with JS-side assertions, abort propagation, circuit breaker integration, and every edge case discovered during 2A-2C re-evaluation.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/features/test-runner/utils/rustBridgeIntegration.test.ts` | NEW — 58 integration tests covering 13 categories |
| `src/test-utils/factories.ts` | NEW — Shared test factories (`makeScenario`, `makeResult`, `makeConfig`) |

---

## Test Categories

### 1. runTestViaRust End-to-End (4 tests)

| # | Test | Expected |
|---|------|----------|
| 1.1 | Batch accumulation across multiple progress events | Results accumulate incrementally; final count matches total |
| 1.2 | Zero iterations produces empty result | Returns `{ results: [] }` |
| 1.3 | Workflow mode rejection | `buildExecutionPlan` returns null → not called |
| 1.4 | Pre-aborted signal | Abort fires immediately, test terminates |

---

### 2. ProgressMeta Forwarding (3 tests)

| # | Test | Expected |
|---|------|----------|
| 2.1 | elapsedMs, targetConcurrency, currentInFlight forwarded | All three meta fields present in onProgress callback |
| 2.2 | Load-profile mode includes durationMs | `meta.durationMs` populated from load profile config |
| 2.3 | total = -1 when unknown | Open-ended execution correctly reports -1 total |

---

### 3. Abort Signal Propagation (2 tests)

| # | Test | Expected |
|---|------|----------|
| 3.1 | Abort during execution calls `abort_load_test` | `invoke('abort_load_test')` called exactly once |
| 3.2 | Listener cleanup after completion | `unlisten` called for both progress and complete listeners |

---

### 4. Circuit Breaker Integration (4 tests)

| # | Test | Expected |
|---|------|----------|
| 4.1 | maxErrorRate 0% maps to 0.0 fraction | `max_error_rate: 0.0` in plan |
| 4.2 | maxErrorRate 75% maps to 0.75 fraction | `max_error_rate: 0.75` |
| 4.3 | maxErrorRate 100% maps to 1.0 fraction | `max_error_rate: 1.0` |
| 4.4 | Breaker-tripped batch halts further results | No new results accumulated after tripped batch |

---

### 5. Fallback Correctness (7 tests)

| # | Test | Expected |
|---|------|----------|
| 5.1 | Digest auth → canUseRustExecutor returns false | Falls back to JS executor |
| 5.2 | Auth inherit → canUseRustExecutor returns true | Rust handles "inherit" (no-op auth) |
| 5.3 | No auth → canUseRustExecutor returns true | Rust handles scenarios without auth |
| 5.4 | Mixed auth (one OAuth2 + others) → false | Any OAuth2 triggers full fallback |
| 5.5 | Batch mode maps to pool plan | `mode: 'pool'` in execution plan |
| 5.6 | Workflow mode → null plan | `buildExecutionPlan` returns null |
| 5.7 | invoke error → onError called | Rust invocation failure handled gracefully |

---

### 6. Retry Behavior Edge Cases (5 tests)

| # | Test | Expected |
|---|------|----------|
| 6.1 | Retry succeeded (retryCount=2, passed=true) | `retryCount: 2`, `passed: true`, no error suffix |
| 6.2 | Retry exhausted (retryCount=3, passed=false) | Error message includes "(after 3 retries)" |
| 6.3 | retryCount=0 (no retries) | No retry info in error message |
| 6.4 | Config retry count maps to plan | `retry_count` and `retry_delay_ms` in plan |
| 6.5 | Default retry (no config) | Defaults to 0 retries, 0 delay |

---

### 7. Scenario Lookup (3 tests)

| # | Test | Expected |
|---|------|----------|
| 7.1 | Composite key `scenarioId:dataRowId` matches | Correct scenario found for parameterized tests |
| 7.2 | scenarioId fallback | Matches by scenarioId alone when no composite key |
| 7.3 | Unknown ID → mapWithoutValidation | Graceful degradation: result mapped without validation |

---

### 8. Load Profile Plan (4 tests)

| # | Test | Expected |
|---|------|----------|
| 8.1 | Ramp-up profile | `profile_type: 'ramp-up'` with ramp_duration_sec, target_rps |
| 8.2 | Spike profile | `profile_type: 'spike'` with spike_rps, base_rps |
| 8.3 | Sustained profile | `profile_type: 'sustained'` with target_rps |
| 8.4 | Missing loadProfile config → pool fallback | Falls back to pool mode gracefully |

---

### 9. Think Time Mapping (3 tests)

| # | Test | Expected |
|---|------|----------|
| 9.1 | Negative values clamped to 0 | `min_ms: 0`, `max_ms: 0` |
| 9.2 | Unknown mode defaults to none | `{ type: 'none' }` |
| 9.3 | Fractional values rounded | `Math.round()` applied for Rust u64 compat |

---

### 10. Preparation Parity (3 tests)

| # | Test | Expected |
|---|------|----------|
| 10.1 | Header/auth/body consistency with JS | Same Authorization header, Content-Type, body as JS path |
| 10.2 | API key in query param | URL contains `?apiKey=value` |
| 10.3 | Allocation queue sizes | Queue length matches `computeAllocation` output |

---

### 11. Validation with Rust Results (4 tests)

| # | Test | Expected |
|---|------|----------|
| 11.1 | expectedFields pass (selective mode) | `passed: true`, no failure details |
| 11.2 | expectedFields fail (missing field) | `passed: false`, failure details describe missing field |
| 11.3 | HTTP status validation (200 expected, 500 received) | `passed: false`, status mismatch in failures |
| 11.4 | JSON body validation | Deep comparison applied, mismatches reported |

---

### 12. Error Message Extraction (4 tests)

| # | Test | Expected |
|---|------|----------|
| 12.1 | `detail` field extracted | Error message from JSON `detail` property |
| 12.2 | `errorMessage` field extracted | Fallback to `errorMessage` property |
| 12.3 | Non-string error field | Stringified via `JSON.stringify` |
| 12.4 | Empty body | Falls back to "HTTP {status}" message |

---

### 13. Settled Guard (1 test)

| # | Test | Expected |
|---|------|----------|
| 13.1 | No double resolution | `onComplete` fires only once even if events race |

---

## Coverage Gaps Addressed (Code Quality Round)

The following 10 additional tests were added during the code quality review to bring `rustBridge.ts` coverage above 90%:

| # | Test | Gap Addressed |
|---|------|---------------|
| C1 | startRustLoadTest calls onError when invoke fails | invoke rejection → onError path |
| C2 | startRustLoadTest onComplete with zeroed summary on invoke fail (no onError) | Fallback synthetic onComplete |
| C3 | buildExecutionPlan maps timeout_ms correctly | `timeout_ms` field coverage |
| C4 | buildExpandedQueue returns empty queue for 0 iterations | Zero-iteration branch |
| C5 | mapRustResult extracts error from JSON body `detail` field | JSON error extraction |
| C6 | mapRustResult extracts error from `errorMessage` field | Alternative error field |
| C7 | mapRustResult handles non-string error field | Type coercion |
| C8 | mapRustResult handles empty response body | Empty body branch |
| C9 | mapRustResult converts null requestLog.body to undefined | null → undefined path |
| C10 | mapRustResult converts null optional fields to undefined | Null handling for optional fields |

---

## Cross-Phase Bugs Validated

All bugs found during 2A-2C re-evaluation were verified as fixed in the 2D test suite:

| Bug (from Phase) | Test that validates fix |
|---|---|
| camelCase serde fix (2A) | All invoke/listen calls use camelCase field names |
| Event listener leak (2B) | Abort signal propagation — listener cleanup |
| invoke error hang (2B) | Invoke failure → onError / fallback onComplete |
| maxErrorRate percent→fraction (2C) | Circuit breaker 0%/75%/100% mapping tests |
| Race condition settled guard (2C) | Settled guard test (13.1) |
| Network error "HTTP 0" (2C) | Error extraction tests |
| scenarioWeights propagation (2C) | Load profile scenario weight mapping |
