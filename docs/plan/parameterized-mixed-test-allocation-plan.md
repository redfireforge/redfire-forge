# Parameterized + Mixed Test Allocation — Issue Analysis & Solution Plan

**Created**: May 8, 2026  
**Status**: Planning  
**Priority**: High (UX confusion)  
**Affected Area**: Test Runner (non-workflow), Expansion Summary, Results Display

---

## Problem Statement

When a user selects a mix of **regular tests** and **parameterized tests** (tests with data source rows) and configures a small number of Transactions, the system produces confusing behavior:

1. Tests silently receive 0 allocations
2. The Expansion Summary shows meaningless `0 × 1 = 0` for every test
3. Results display fewer results than expected
4. The user has no visibility into how their configuration maps to actual execution

This is especially problematic when the number of active tests exceeds the configured Transactions.

---

## Issues Identified

### Issue 1: Silent Zero Allocation

**Symptom**: With 16 tests and 5 Transactions, every test gets `Math.round((1/16) × 5) = 0` slots in the Expansion Summary.

**Root Cause**: The UI Expansion Summary uses naive proportional rounding:
```typescript
// TestRunner.tsx ~341
const slots = totalWeight > 0 ? Math.round((w / totalWeight) * totalTransactions) : 0;
```
When `weight/totalWeight` is small (many tests, few transactions), rounding truncates every test to 0.

**Engine Behavior**: The actual engine (`executor.ts` ~97-124) handles this differently — when `total >= activeWeights.length`, it guarantees at least 1 slot per test. When `total < activeWeights.length`, it picks the top N by weight. The UI summary does **not** match the engine's actual allocation.

**Location**: `src/features/test-runner/TestRunner.tsx` lines 329–390

---

### Issue 2: "Transactions" Semantic Confusion

**Symptom**: User sets Transactions=5, expects 5 runs of their test. Instead, 5 is the **total** across **all** 16 tests.

**Root Cause**: "Transactions" means **total HTTP requests across all selected tests**, not "iterations per test." This is not clearly communicated.

**Compounding Factor**: For parameterized tests, each "slot" expands to N requests (one per data row), so the actual HTTP count can exceed the Transaction value before the cap is applied, then get truncated.

**Confusion Matrix**:

| User Thinks | System Does |
|-------------|-------------|
| "Run each test 5 times" | "Run 5 requests total, distributed by weight" |
| "My parameterized test will run all rows 5 times" | "Parameterized test gets 0-1 slots, then expands to N rows, then may be truncated" |
| "5 transactions = 5 results per test" | "5 transactions = 5 results total (before expansion)" |

**Location**: `src/engine/executor.ts` lines 92–137

---

### Issue 3: Mixed Regular + Parameterized Unfair Competition

**Symptom**: Regular tests and parameterized tests compete equally for slots, but parameterized tests need more slots to be useful (each slot expands to N rows).

**Root Cause**: The weight-based allocation treats all tests identically. A regular test with weight=1 gets the same share as a parameterized test with weight=1 and 100 data rows. But the parameterized test needs N× more slots to exercise all its data.

**Example**:
- 15 regular tests (weight 1 each)
- 1 parameterized test (weight 1, 10 rows)
- Transactions = 32
- Each test gets ~2 slots
- Regular tests: 2 requests each = 30 total
- Parameterized test: 2 slots × 10 rows = 20 requests → but capped at remaining 2 slots → truncated

**Location**: `src/engine/executor.ts` lines 92–137, `src/engine/dataSourceExpander.ts` `expandQueue()`

---

### Issue 4: Expansion Summary Misleading for Non-Parameterized Tests

**Symptom**: The Expansion Summary shows `0 × 1 = 0` for regular tests. The `× 1` is confusing — regular tests don't have "rows."

**Root Cause**: The summary shows `slots × 1 = N` for non-parameterized tests (using `1` as a placeholder for "no data rows"), making it look like the test has 1 data row when it actually has none.

**Location**: `src/features/test-runner/TestRunner.tsx` lines 370–378

---

### Issue 5: Expansion Summary Doesn't Match Engine Allocation

**Symptom**: Expansion Summary shows 0 requests for every test, but the engine actually runs 5 requests.

**Root Cause**: The Expansion Summary uses a simplified proportional formula, while the engine uses a different allocation strategy (guaranteed minimum, top-N selection, shuffle). These two calculations diverge.

**Location**:
- UI: `src/features/test-runner/TestRunner.tsx` ~341
- Engine: `src/engine/executor.ts` ~92–137

---

### Issue 6: Post-Expansion Cap Truncates Parameterized Data

**Symptom**: A parameterized test with 10 data rows gets 1 slot → expands to 10 requests → but the cap limits total to 5 → only 5 of 10 rows execute. User doesn't know which rows were dropped.

**Root Cause**: `executor.ts` line 134–137 truncates after expansion:
```typescript
if (total > 0 && expandedQueue.length > total) {
  expandedQueue.length = total;
}
```
This silently drops rows from the end of the expanded queue with no feedback to the user.

**Location**: `src/engine/executor.ts` lines 134–137

---

### Issue 7: Results "N rows" Shows Executed Count, Not Data Source Size

**Symptom**: Results show "1 rows" instead of "10 rows" for a parameterized test with 10 data rows.

**Root Cause**: `DataRowSummaryTable` counts `results.filter(r => r.dataRowId).length`, which is the number of **executed** rows, not the total available rows in the data source. If only 1 row was executed (due to slot allocation), it shows "1 rows."

**Location**: `src/features/results/components/DataRowSummaryTable.tsx` line 54

---

## Solution Options

### Option A: Warning Banner Only (Minimal)

**Effort**: 1 hour

Add a warning when `Transactions < active tests`:

> ⚠️ You have 16 active tests but only 5 transactions. Some tests may not execute. Consider increasing Transactions to at least 16.

**Pros**: Simple, non-breaking  
**Cons**: Doesn't fix the underlying confusion

---

### Option B: Align UI Summary with Engine Logic

**Effort**: 2–3 hours

Extract the engine's allocation logic into a shared `computeAllocation()` function used by both the engine and the UI Expansion Summary. This ensures the summary always matches actual execution.

**Changes**:
1. Extract allocation logic from `executor.ts` into `src/engine/allocationEngine.ts`
2. Import and use in both `executor.ts` and `TestRunner.tsx`
3. Update Expansion Summary to show actual per-test slot counts
4. Show "N/A" instead of `0 × 1 = 0` for non-parameterized tests in the expansion rows

**Pros**: Accurate preview, no behavior change  
**Cons**: Doesn't fix the fairness issue with mixed tests

---

### Option C: Guaranteed Minimum Allocation + Warning

**Effort**: 3–4 hours

1. **Guarantee at least 1 slot per active test** in both engine and UI
2. **Warning banner** when Transactions < active tests: *"Minimum 16 requests will run (1 per active test). Your Transactions setting (5) has been raised to match."*
3. **Update Expansion Summary** to match

**Changes**:
1. `executor.ts`: Already does this for `total >= activeWeights.length`; extend to always do it
2. `TestRunner.tsx`: Update Expansion Summary to use same logic
3. Add a yellow warning bar in the config UI

**Pros**: No test is ever skipped silently, predictable behavior  
**Cons**: Actual request count may exceed user's configured Transactions

---

### Option D: Separate Regular vs Parameterized Allocation

**Effort**: 4–6 hours

Split the transaction budget into two pools:
- **Regular pool**: Transactions allocated to non-parameterized tests
- **Parameterized pool**: Transactions allocated to parameterized tests (pre-expansion)

The user sees two numbers:
```
Transactions: [5] per regular test    [3] per parameterized test (× rows)
```

**Changes**:
1. New UI inputs or automatic split logic
2. Engine changes to allocate separately
3. Updated Expansion Summary with two sections

**Pros**: Fair allocation, clear mental model  
**Cons**: More UI complexity, breaking change

---

### Option E: "Per-Test" vs "Total" Toggle

**Effort**: 3–4 hours

Add a toggle to the Transactions field:

```
Transactions: [5]  ● Per Test  ○ Total
```

- **Per Test**: Each active test gets exactly N transactions (total = N × test count)
- **Total**: Current behavior (N distributed by weight)

For parameterized tests in "Per Test" mode, each test gets N slots, and each slot expands to all data rows.

**Changes**:
1. New `transactionMode: 'perTest' | 'total'` in TestConfig
2. Engine update to respect the mode
3. UI toggle widget
4. Expansion Summary update

**Pros**: Most flexible, preserves backward compatibility  
**Cons**: One more setting for users to learn

---

### Option F: Smart Defaults + Redesigned Summary (Recommended)

**Effort**: 5–6 hours

Combine the best parts of Options B, C, and E:

1. **Default to "Per Test" mode** — Transactions means "runs per test"
   - Total requests = Transactions × active test count (before parameterized expansion)
   - Add a "Total" mode toggle for advanced users who want fine-grained control

2. **Redesigned Expansion Summary** with two sections:
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ Execution Plan                                          │
   ├─────────────────────────────────────────────────────────┤
   │ Regular Tests (15)                                      │
   │   5 runs × 15 tests = 75 requests                      │
   │                                                         │
   │ Parameterized Tests (1)                                 │
   │   ONBOARD_AS_NEW-MX-PN... (Parameterized)              │
   │   5 runs × 1 data rows = 5 requests                    │
   │                                                         │
   │ ─────────────────────────────────────────────────────── │
   │ Total: 80 requests  •  Concurrency: 2                  │
   └─────────────────────────────────────────────────────────┘
   ```

3. **Warning when total is large**:
   > ⚠️ This will generate 80 requests. Estimated time: ~2 minutes at current concurrency.

4. **Guaranteed minimum**: Every active test gets at least 1 run (no silent 0-allocation)

5. **Smart cap for parameterized tests**: When in "Total" mode, parameterized expansion is accounted for in the slot budget (not applied after the cap)

**Pros**: Intuitive default, clear preview, backward compatible via toggle  
**Cons**: Largest implementation effort

---

## Recommendation

**Phase 1 (Quick Fix — 2-3 hours)**: Implement **Option B + C**
- Extract shared allocation function
- Align Expansion Summary with engine
- Add warning banner for Transactions < active tests
- Guarantee minimum 1 slot per active test
- Clean up `× 1` display for non-parameterized tests

**Phase 2 (Follow-Up — 3-4 hours)**: Implement **Option F** additions
- Add "Per Test" / "Total" toggle
- Redesigned "Execution Plan" summary with separate regular/parameterized sections
- Smart cap accounting for parameterized expansion
- Estimated execution time display

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/engine/executor.ts` | Extract allocation logic to shared function |
| `src/engine/allocationEngine.ts` | **New** — shared allocation logic |
| `src/features/test-runner/TestRunner.tsx` | Updated Expansion Summary, warning banner |
| `src/features/results/components/DataRowSummaryTable.tsx` | Show total data source rows vs executed rows |
| `src/shared/types/index.ts` | Add `transactionMode` to `TestConfig` (Phase 2) |
| `src/engine/dataSourceExpander.ts` | Smart cap logic (Phase 2) |

## Tests to Add/Update

| File | Changes |
|------|---------|
| `src/engine/allocationEngine.test.ts` | **New** — allocation logic tests |
| `src/engine/executor.test.ts` | Update for extracted allocation |
| `src/features/test-runner/TestRunner.test.tsx` | Expansion Summary rendering, warning banner |
| `src/features/results/components/DataRowSummaryTable.test.tsx` | Updated row count display |

---

## Appendix: Current Data Flow

```
User Config (Concurrency: 2, Transactions: 5, 16 tests selected)
  │
  ▼
TestRunner.tsx — builds TestConfig with scenarioWeights
  │
  ▼
executor.ts — runTest()
  │
  ├─ Allocation: activeWeights → proportional slot distribution
  │    if total >= activeCount:  guaranteed 1 each + proportional remainder
  │    if total < activeCount:   top-N by weight (random tiebreak)
  │
  ├─ Shuffle queue
  │
  ├─ expandQueue() — parameterized tests → N scenarios per data row
  │
  ├─ Cap: expandedQueue.length = min(expandedQueue.length, total)
  │
  └─ runPool() / runBatch() / runSequential() — execute HTTP requests
       │
       ▼
     Results (RequestResult[]) with dataRowId for parameterized
       │
       ▼
     ResultsDashboard → DataRowSummaryTable ("N rows")
```

---

**End of Plan**
