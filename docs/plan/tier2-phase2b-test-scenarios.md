# Tier 2 Phase 2B — Test Scenarios

> Tauri Commands + Event Streaming (JS Bridge)
> Created: 2026-05-18
> File: `src/features/test-runner/utils/rustBridge.ts`
> Test file: `src/features/test-runner/utils/rustBridge.test.ts` (partial — availability, abort, start)
> Re-evaluated R1: 4 issues found and fixed (event listener leak, invoke error hang, isTauri guard, missing tests)
> Re-evaluated R2-R3: Clean — no further issues found.

---

## Summary

Phase 2B creates the TypeScript bridge layer that communicates with the Rust executor via Tauri's `invoke` and `listen` APIs. It provides `isRustExecutorAvailable()`, `startRustLoadTest()`, and `abortRustLoadTest()` with proper cleanup, error handling, and platform guards.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/features/test-runner/utils/rustBridge.ts` | NEW — `isRustExecutorAvailable()`, `startRustLoadTest()`, `abortRustLoadTest()`, type definitions |
| `src/features/test-runner/components/RustExecutorTestPanel.tsx` | NEW — Dev-only integration test UI (6 scenarios) |
| `src/app/App.tsx` | Wired RustExecutorTestPanel via Cmd+Shift+T / `?rust-test` |

---

## Validation Checklist

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Availability — Non-Tauri Fallback](#scenario-1-availability--non-tauri-fallback) | [ ] | |
| 2 | [Availability — Caching](#scenario-2-availability--caching) | [ ] | |
| 3 | [Availability — Reset Cache](#scenario-3-availability--reset-cache) | [ ] | |
| 4 | [Availability — Invoke Failure](#scenario-4-availability--invoke-failure) | [ ] | |
| 5 | [Abort — Non-Tauri No-Op](#scenario-5-abort--non-tauri-no-op) | [ ] | |
| 6 | [Start — Non-Tauri Throws](#scenario-6-start--non-tauri-throws) | [ ] | |
| 7 | [Start — Non-Tauri with onError](#scenario-7-start--non-tauri-with-onerror) | [ ] | |
| 8 | [Start — Invoke Failure with onError](#scenario-8-start--invoke-failure-with-onerror) | [ ] | |
| 9 | [Start — Invoke Failure without onError](#scenario-9-start--invoke-failure-without-onerror) | [ ] | |
| 10 | [Event Listener Cleanup](#scenario-10-event-listener-cleanup) | [ ] | |

**Progress**: 0 / 10 validated

---

## Scenario 1: Availability — Non-Tauri Fallback

- [ ] **VALIDATED**

**Purpose**: Verify `isRustExecutorAvailable()` returns false when not running in Tauri.

**Test**: `rustBridge.test.ts > isRustExecutorAvailable > returns false when not in Tauri`

**Expected**: Returns `false` immediately without calling `invoke`.

---

## Scenario 2: Availability — Caching

- [ ] **VALIDATED**

**Purpose**: Verify availability result is cached after first check.

**Test**: `rustBridge.test.ts > isRustExecutorAvailable > caches the result on subsequent calls`

**Expected**: `invoke` is called only once; subsequent calls return cached value.

---

## Scenario 3: Availability — Reset Cache

- [ ] **VALIDATED**

**Purpose**: Verify `resetAvailabilityCache()` allows re-evaluation.

**Test**: `rustBridge.test.ts > resetAvailabilityCache > allows re-evaluation after reset`

**Expected**: After reset, next call to `isRustExecutorAvailable()` invokes Tauri again.

---

## Scenario 4: Availability — Invoke Failure

- [ ] **VALIDATED**

**Purpose**: Verify graceful fallback when Tauri invoke throws.

**Test**: `rustBridge.test.ts > isRustExecutorAvailable > returns false if Tauri invoke throws`

**Expected**: Returns `false` (not re-thrown), result is cached as false.

---

## Scenario 5: Abort — Non-Tauri No-Op

- [ ] **VALIDATED**

**Purpose**: Verify `abortRustLoadTest()` is a safe no-op outside Tauri.

**Test**: `rustBridge.test.ts > abortRustLoadTest > is a no-op when not in Tauri`

**Expected**: Returns immediately, no errors thrown.

---

## Scenario 6: Start — Non-Tauri Throws

- [ ] **VALIDATED**

**Purpose**: Verify `startRustLoadTest()` throws when called outside Tauri without `onError`.

**Test**: `rustBridge.test.ts > startRustLoadTest > throws when not in Tauri and no onError`

**Expected**: Throws `Error('startRustLoadTest called outside Tauri')`.

---

## Scenario 7: Start — Non-Tauri with onError

- [ ] **VALIDATED**

**Purpose**: Verify `startRustLoadTest()` calls `onError` instead of throwing when provided.

**Test**: `rustBridge.test.ts > startRustLoadTest > calls onError when not in Tauri and onError provided`

**Expected**: `onError` called with Error, `onComplete` not called, returns `{ unlisten: () => {} }`.

---

## Scenario 8: Start — Invoke Failure with onError

- [ ] **VALIDATED**

**Purpose**: Verify invoke deserialization errors route to `onError` callback.

**Test**: `rustBridgeIntegration.test.ts > startRustLoadTest calls onError when invoke fails (deserialization error)`

**Expected**: `onError` called once, `onComplete` not called.

---

## Scenario 9: Start — Invoke Failure without onError

- [ ] **VALIDATED**

**Purpose**: Verify invoke failure falls back to `onComplete` with zeroed summary when no `onError` provided.

**Test**: `rustBridgeIntegration.test.ts > startRustLoadTest fallback behaviors > calls onComplete with zeroed summary when invoke fails and no onError provided`

**Expected**: `onComplete` called with `{ totalResults: 0, durationMs: 0, breakerTripped: false }`.

---

## Scenario 10: Event Listener Cleanup

- [ ] **VALIDATED**

**Purpose**: Verify event listeners are cleaned up after test completion to prevent memory leaks.

**Implementation**: Idempotent `cleanup()` function in `startRustLoadTest` that:
- Calls `unlistenProgress()` and `unlistenComplete()` once
- Uses `cleaned` flag to prevent double-cleanup
- Called automatically on completion event and on invoke error

**Verification**: Run multiple test cycles and confirm no listener accumulation.

---

## Bugs Found During Re-evaluation

| Bug | Severity | Fix |
|-----|----------|-----|
| Event listeners never cleaned up after test | CRITICAL | Added idempotent cleanup on complete event and invoke error |
| invoke error → Promise hangs (onComplete never called) | CRITICAL | Added `onError` callback parameter with fallback |
| `abortRustLoadTest`/`startRustLoadTest` missing `isTauri()` guard | BUG | Added guard checks |
| No tests for non-Tauri behavior | MISSING | Added 3 unit tests |
