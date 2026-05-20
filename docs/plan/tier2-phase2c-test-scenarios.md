# Tier 2 Phase 2C — Test Scenarios

> JS Integration + Fallback
> Created: 2026-05-18
> File: `src/features/test-runner/utils/rustBridge.ts`
> Test file: `src/features/test-runner/utils/rustBridge.test.ts` (68 tests)
> Re-evaluated R1-R4: 4 bugs found and fixed, tests 67 → 68
> Re-evaluated R5-R19: 0 bugs found across 15 deep audit rounds. Final: 68 tests.

---

## Summary

Phase 2C implements the core JS functions that build Rust execution plans from JS test configs, map Rust results back to JS `RequestResult` format with JS-side validation, detect when to fall back to the JS executor (OAuth2, workflow mode), and wire everything into `useTestExecution`.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/features/test-runner/utils/rustBridge.ts` | `buildExecutionPlan()`, `prepareRustScenario()`, `mapRustResult()`, `canUseRustExecutor()`, `buildExpandedQueue()`, `runTestViaRust()` |
| `src/features/test-runner/hooks/useTestExecution.ts` | Added Rust executor path: `canUseRustExecutor` + `isRustExecutorAvailable` check before worker path |

---

## Validation Checklist

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [canUseRustExecutor — Pool/Sequential/Batch](#1-canuserustexecutor--poolsequentialbatch) | [ ] | |
| 2 | [canUseRustExecutor — Fallback Cases](#2-canuserustexecutor--fallback-cases) | [ ] | |
| 3 | [canUseRustExecutor — Auth Types](#3-canuserustexecutor--auth-types) | [ ] | |
| 4 | [prepareRustScenario — Headers & URL](#4-preparerustscenario--headers--url) | [ ] | |
| 5 | [prepareRustScenario — Auth Resolution](#5-preparerustscenario--auth-resolution) | [ ] | |
| 6 | [prepareRustScenario — Body Serialization](#6-preparerustscenario--body-serialization) | [ ] | |
| 7 | [buildExecutionPlan — Mode Mapping](#7-buildexecutionplan--mode-mapping) | [ ] | |
| 8 | [buildExecutionPlan — Think Time](#8-buildexecutionplan--think-time) | [ ] | |
| 9 | [buildExecutionPlan — Circuit Breaker](#9-buildexecutionplan--circuit-breaker) | [ ] | |
| 10 | [buildExecutionPlan — Load Profile](#10-buildexecutionplan--load-profile) | [ ] | |
| 11 | [buildExecutionPlan — Scenario Filtering](#11-buildexecutionplan--scenario-filtering) | [ ] | |
| 12 | [buildExpandedQueue — Allocation & Shuffle](#12-buildexpandedqueue--allocation--shuffle) | [ ] | |
| 13 | [mapRustResult — Success Path](#13-maprustresult--success-path) | [ ] | |
| 14 | [mapRustResult — Failure & Validation](#14-maprustresult--failure--validation) | [ ] | |
| 15 | [mapRustResult — Retry & Error Extraction](#15-maprustresult--retry--error-extraction) | [ ] | |
| 16 | [Fractional Think Time Rounding](#16-fractional-think-time-rounding) | [ ] | |

**Progress**: 0 / 16 validated

---

## 1. canUseRustExecutor — Pool/Sequential/Batch

- [ ] **VALIDATED**

**Tests**:
- `returns true for pool mode with no OAuth2`
- `returns true for sequential mode`
- `returns true for batch mode (maps to pool)`
- `returns true for load-profile mode`

**Expected**: All standard execution modes return `true` (Rust-eligible).

---

## 2. canUseRustExecutor — Fallback Cases

- [ ] **VALIDATED**

**Tests**:
- `returns false for workflow mode`
- `returns false when resolveSubWorkflow is provided`

**Expected**: Workflow execution always falls back to JS executor.

---

## 3. canUseRustExecutor — Auth Types

- [ ] **VALIDATED**

**Tests**:
- `returns false when any scenario has OAuth2`
- `returns true when auth is basic (not OAuth2)`
- `returns true when auth is bearer`
- `returns true when auth is apikey`

**Expected**: Only OAuth2 triggers fallback; all other auth types are Rust-compatible.

---

## 4. prepareRustScenario — Headers & URL

- [ ] **VALIDATED**

**Tests**:
- `resolves headers and URL for a GET scenario`
- `sets featureGroupName and groupName`

**Expected**: Headers merged into `Record<string, string>`, URL fully resolved.

---

## 5. prepareRustScenario — Auth Resolution

- [ ] **VALIDATED**

**Tests**:
- `resolves basic auth into Authorization header`
- `resolves bearer auth into Authorization header`
- `resolves API key in query param into URL`
- `resolves API key in header`

**Expected**: Auth config translated to appropriate header or query parameter.

---

## 6. prepareRustScenario — Body Serialization

- [ ] **VALIDATED**

**Tests**:
- `sets body for POST scenario with JSON body`
- `handles form-urlencoded body`
- `preserves data row fields for parameterized scenarios`

**Expected**: Body serialized via `serializeWithContentType`, data row metadata preserved.

---

## 7. buildExecutionPlan — Mode Mapping

- [ ] **VALIDATED**

**Tests**:
- `returns null for workflow mode`
- `builds pool plan for pool mode`
- `maps batch mode to pool`
- `builds sequential plan`
- `builds load-profile plan`

**Expected**: Workflow → null (fallback), batch → pool, others → direct mapping.

---

## 8. buildExecutionPlan — Think Time

- [ ] **VALIDATED**

**Tests**:
- `maps think time: none`
- `maps think time: constant`
- `maps think time: uniform`
- `maps think time: gaussian`
- `defaults undefined thinkTime to none`

**Expected**: All four modes mapped correctly; undefined defaults to `{ type: 'none' }`.

---

## 9. buildExecutionPlan — Circuit Breaker

- [ ] **VALIDATED**

**Tests**:
- `maps circuit breaker: continue`
- `maps circuit breaker: stop-first`
- `maps circuit breaker: stop-threshold (converts percent to fraction)`
- `defaults undefined errorPolicy to continue`

**Expected**: `maxErrorRate` divided by 100 (JS percent → Rust 0.0-1.0 fraction).

---

## 10. buildExecutionPlan — Load Profile

- [ ] **VALIDATED**

**Tests**:
- `builds load-profile plan` (sustained)
- `handles spike load profile`
- `propagates scenario weights for load-profile mode`

**Expected**: `loadProfile` config mapped to Rust LoadProfile struct with all fields.

---

## 11. buildExecutionPlan — Scenario Filtering

- [ ] **VALIDATED**

**Tests**:
- `filters scenarios by scenarioWeights`
- `uses all scenarios when no weights have weight > 0`
- `ensures concurrency is at least 1`
- `maps timeout correctly` / `maps zero timeout to 0`
- `maps retry count and delay`

**Expected**: Only scenarios with weight > 0 included; edge cases handled.

---

## 12. buildExpandedQueue — Allocation & Shuffle

- [ ] **VALIDATED**

**Tests**:
- `builds correct queue size for single scenario`
- `filters by scenario weights`
- `includes all scenarios when weights are empty`
- `returns empty queue for 0 iterations`

**Expected**: Queue expanded via `computeAllocation` → `expandQueue`, Fisher-Yates shuffled.

---

## 13. mapRustResult — Success Path

- [ ] **VALIDATED**

**Tests**:
- `maps a successful result with no validation`
- `preserves timing breakdown`
- `preserves request log`
- `converts null requestLog.body to undefined`
- `converts null optional fields to undefined`
- `preserves data row fields`

**Expected**: All Rust result fields mapped to JS `RequestResult`; null → undefined conversion.

---

## 14. mapRustResult — Failure & Validation

- [ ] **VALIDATED**

**Tests**:
- `maps a failed HTTP result (status 500)`
- `maps a network error (status 0)`
- `applies JSON validation when scenario has full validation mode`
- `detects validation failure when expected JSON does not match`

**Expected**: JS-side `buildValidationResult()` applied; failure details populated correctly.

---

## 15. mapRustResult — Retry & Error Extraction

- [ ] **VALIDATED**

**Tests**:
- `appends retry count info to error message when retries > 0 and failed`
- `does not append retry info when retries > 0 but result passed`
- `extracts error message from JSON response body for HTTP failures`
- `falls back to truncated body when no standard error field`
- `handles non-JSON response body for error extraction`

**Expected**: Retry info appended only on failure; error messages extracted from JSON `detail`/`error`/`message`/`errorMessage` fields.

---

## 16. Fractional Think Time Rounding

- [ ] **VALIDATED**

**Tests** (in `rustBridgeIntegration.test.ts`):
- `fractional think time values are rounded to integers for Rust u64 compat`
- `uniform fractional values are rounded to integers`
- `gaussian fractional values are rounded to integers`

**Expected**: `Math.round()` applied to all ms values before sending to Rust `u64`.

---

## Bugs Found During Re-evaluation

| Bug | Severity | Fix |
|-----|----------|-----|
| `mapCircuitBreaker()` sent `maxErrorRate` as 0-100; Rust expects 0.0-1.0 | CRITICAL | Divide by 100 |
| `runTestViaRust()` race: onComplete before `.then()` set `unlistenFn` | CRITICAL | Added `settled` guard boolean |
| `mapRustResultWithoutValidation()` showed "HTTP 0" for network errors | BUG | Changed to "network error" for status 0 |
| Load-profile mode didn't propagate `scenarioWeights` to `RustScenario.weight` | BUG | Map weights from config |
| Fractional ms values could fail Rust `u64` deserialization | BUG | Added `Math.round()` to all ms fields |
