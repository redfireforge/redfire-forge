# Runner Redesign — Unified Iterations & Type-Safe Scenarios

**Created**: May 8, 2026  
**Revised**: May 9, 2026 (complete rewrite based on design review)  
**Status**: Planning  
**Priority**: High (fundamental UX/architecture fix)  
**Affected Area**: Scenarios, Test Runner, Parameterized Runner (new), Workflow Runner, Executor

---

## Background

The original plan identified 7 symptoms (silent zero allocation, misleading expansion summary, semantic confusion around "Transactions," silent data row truncation, etc.). Upon deeper analysis, these are all consequences of a single **foundational design issue**: the Test Runner was built for homogeneous HTTP tests sharing a total request budget, but the product evolved to support three fundamentally different test types — normal tests, parameterized (data-driven) tests, and workflows — without revisiting the foundation.

Rather than patching individual symptoms, this plan redesigns the runner architecture to **eliminate the conditions that cause all seven issues**.

---

## Design Principles

1. **One word, one meaning, everywhere** — "Iterations" replaces "Transactions" across all runners. It always means "how many times each test runs."
2. **No mixing** — A scenario contains only one test type. A runner handles only one test type. Mixing is prevented by design, not by warnings.
3. **Honest preview** — What the Execution Plan shows is exactly what the engine executes. One shared function computes both.
4. **No silent data loss** — No post-expansion truncation. Every enabled data row runs.
5. **Shared foundation** — The three runners are thin specialized shells on top of shared components. No code duplication.

---

## Current Architecture

```
Environment
  └── Feature Group
        └── TestScenario (folder) ← allows ANY mix of normal + parameterized tests
              └── Scenario[] ← parameterized = Scenario + dataSource (no type distinction)

Test Runner (one tab)
  ├── Selects TestScenario folders (mixed types)
  ├── "Transactions" = total request budget shared by weight
  ├── Expansion Summary uses different math than engine
  ├── Post-expansion cap silently drops data rows
  └── Results show executed count, not source count

Workflow Runner (separate tab) ← already works correctly
  ├── "Iterations" = per-workflow count
  └── Simple, honest, no confusion
```

### Why It Breaks

| Root Cause | Symptoms |
|-----------|----------|
| "Transactions" means "total budget" but users think "per-test count" | Silent zero allocation, semantic confusion |
| UI preview uses `Math.round((w/totalWeight) * total)`, engine uses guaranteed-minimum + proportional | Preview doesn't match execution |
| Normal and parameterized tests compete for the same budget with equal weight | Unfair allocation — parameterized tests need N× more slots |
| `expandedQueue.length = total` truncates after expansion | Silent data row loss |
| No type distinction at scenario or runner level | All of the above compound in mixed scenarios |

---

## Proposed Architecture

```
Environment
  └── Feature Group
        └── TestScenario (folder)
              ├── kind: 'standard'       ← enforced: all tests are normal
              │     └── Scenario[] (no dataSource)
              └── kind: 'parameterized'  ← enforced: all tests have dataSource
                    └── Scenario[] (all with dataSource)

┌─────────────────────────────────────────────────────────────┐
│                     Shared Foundation                        │
│                                                              │
│  useTestExecution       RunnerExecutionConfig                │
│  LiveProgressPanel      executor.ts / runTest()              │
│  HostSelector           ResultsDashboard                     │
│  RunnerLayout           IterationsInput                      │
│  computeAllocation()    ExecutionPlanPreview (base)          │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
    ┌──────┴──────┐   ┌──────┴───────┐   ┌──────┴──────┐
    │ Test Runner │   │Parameterized │   │  Workflow   │
    │             │   │   Runner     │   │   Runner    │
    │ - Standard  │   │ - Param.     │   │ - Workflow  │
    │   selector  │   │   selector   │   │   picker    │
    │ - Simple    │   │ - Rows ×     │   │ - Variables │
    │   preview   │   │   iterations │   │ - Trace     │
    │             │   │   preview    │   │   config    │
    └─────────────┘   └──────────────┘   └─────────────┘
```

### Three Runner Tabs

| Tab | Shows | "Iterations = 5" means | Execution Plan Preview |
|-----|-------|----------------------|----------------------|
| **Test Runner** | Standard scenarios only | Each test runs 5 times | `5 iterations × 10 tests = 50 requests` |
| **Parameterized Runner** | Parameterized scenarios only | Each data row runs 5 times | `5 iterations × 8 rows = 40 requests` (per test breakdown) |
| **Workflow Runner** | Workflows | Workflow executes 5 times | `5 iterations` (already works) |

---

## Data Model Changes

### 1. Add `kind` to `TestScenario`

```typescript
export interface TestScenario {
  id: string;
  name: string;
  kind: 'standard' | 'parameterized';  // NEW
  auth?: AuthConfig;
  tests: Scenario[];
}
```

### 2. Enforce `kind` consistency

- **ScenarioBuilder**: When creating a new scenario, user chooses the type upfront (or it defaults to `'standard'` and switches to `'parameterized'` when a data source is first attached).
- **Adding tests**: If `kind === 'standard'`, prevent attaching a data source. If `kind === 'parameterized'`, require a data source on every test.
- **Type guard**: `isParameterizedScenario(sc: TestScenario): boolean` — checks `kind === 'parameterized'`.

### 3. Replace `totalTransactions` with `iterations`

```typescript
export interface TestConfig {
  // REMOVE: totalTransactions: number;
  iterations: number;           // NEW — how many times each test runs
  // ... rest unchanged
}
```

### 4. Extract `computeAllocation()`

```typescript
// src/engine/allocationEngine.ts — NEW shared module

export interface AllocationResult {
  testId: string;
  testName: string;
  iterations: number;
  rowCount: number;          // 0 for standard tests, N for parameterized
  totalRequests: number;     // iterations × max(rowCount, 1)
}

export function computeAllocation(
  tests: Scenario[],
  iterations: number,
  kind: 'standard' | 'parameterized',
): AllocationResult[];
```

Used by both the Execution Plan Preview (UI) and the executor (engine). **Single source of truth.**

---

## Migration Strategy

### Auto-migration on load (one-time)

When `loadFeatureGroups()` detects a `TestScenario` without `kind`:

1. **Scan tests**: Check if any test in the scenario has `dataSource` or `sharedDataSourceId`.
2. **All normal** → set `kind: 'standard'`.
3. **All parameterized** → set `kind: 'parameterized'`.
4. **Mixed** → split into two scenarios:
   - Original keeps `kind: 'standard'` with normal tests.
   - New scenario created with `kind: 'parameterized'`, name = `"{original name} (Parameterized)"`, containing the parameterized tests.
5. **Bump storage version** (e.g., `perf-test-v4-feature-groups`).
6. **Log migration** — store a one-time notification flag so the UI can show: "Your scenarios have been updated. Parameterized tests have been separated into their own scenarios."

### Config migration

- `totalTransactions` → `iterations` in saved `TestConfig` / run history.
- Default `iterations = 1` when missing.

---

## Implementation Plan

---

### Phase 1: Foundation (~4-5 hours)

> **Goal**: Establish the new type system, migration, shared allocation logic, and rename Transactions → Iterations. This phase is independently shippable — it fixes the allocation math and terminology without any UI restructuring.

#### Task 1.1: Add `kind` to `TestScenario` type (~0.5h)

**File**: `src/shared/types/index.ts`

Add `kind: 'standard' | 'parameterized'` to the `TestScenario` interface. Make it required in the type but handled as optional during migration (see Task 1.2).

```typescript
export interface TestScenario {
  id: string;
  name: string;
  kind: 'standard' | 'parameterized';  // NEW
  auth?: AuthConfig;
  tests: Scenario[];
}
```

Also add a type guard:

```typescript
export function isParameterizedScenario(sc: TestScenario): boolean {
  return sc.kind === 'parameterized';
}
```

**Downstream impact**: Every file that creates or references `TestScenario` will need `kind` set. TypeScript compiler will catch all sites.

#### Task 1.2: Write migration logic (~1h)

**File**: `src/shared/utils/storage.ts`

Add a migration function called during `loadFeatureGroups()`:

```typescript
function migrateScenarioKinds(groups: FeatureGroup[]): { groups: FeatureGroup[]; migrated: boolean } {
  // For each TestScenario without `kind`:
  //   1. Check if ALL tests have dataSource/sharedDataSourceId → 'parameterized'
  //   2. Check if NONE have dataSource/sharedDataSourceId → 'standard'
  //   3. Mixed → split into two scenarios:
  //      - Original keeps normal tests, kind = 'standard'
  //      - New scenario with parameterized tests, kind = 'parameterized'
  //        name = "{original name} (Parameterized)", new UUID
  //        preserves auth from original
}
```

Integrate into the existing storage load path. Bump storage version key from `perf-test-v3-feature-groups` to `perf-test-v4-feature-groups`. Store a `migration-v4-notified` flag for the UI notification (Phase 4).

**Edge cases to handle**:
- Empty scenarios (no tests) → default to `'standard'`
- Scenarios where all tests have `sharedDataSourceId` but no inline `dataSource` → `'parameterized'`
- Split scenarios: ensure the new scenario gets a fresh UUID to avoid ID collisions

#### Task 1.3: Migration unit tests (~0.5h)

**File**: `src/shared/utils/storage.test.ts` (or new `storage.migration.test.ts`)

Test cases:
- All-standard scenario → `kind: 'standard'`, no split
- All-parameterized scenario → `kind: 'parameterized'`, no split
- Mixed scenario → splits into two, correct tests in each, names correct
- Empty scenario → defaults to `'standard'`
- Already-migrated data (has `kind`) → no changes
- Multiple feature groups with multiple scenarios → all migrated correctly
- `sharedDataSourceId` tests classified as parameterized

#### Task 1.4: Rename `totalTransactions` → `iterations` (~0.5h)

**File**: `src/shared/types/index.ts`

```typescript
export interface TestConfig {
  concurrency: number;
  iterations: number;           // was: totalTransactions
  scenarioWeights: ScenarioWeight[];
  executionMode: ExecutionMode;
  // ... rest unchanged
}
```

**Downstream files to update** (TypeScript compiler will find all ~33 references):
- `src/engine/executor.ts` — `config.totalTransactions` → `config.iterations`
- `src/features/test-runner/TestRunner.tsx` — `totalTransactions` state/config
- `src/features/test-runner/WorkflowRunner.tsx` — config building
- `src/features/test-runner/hooks/useRunnerConfig.ts` — stored config
- `src/features/test-runner/hooks/useWorkflowRunnerConfig.ts` — workflow config
- `src/features/test-runner/components/RunnerExecutionConfig.tsx` — input label + field
- `src/features/results/ResultsDashboard.tsx` — display
- `src/features/results/utils/reportGenerator.ts` — report export
- `src/app/hooks/useRerunFailed.ts` — re-run config
- All corresponding `.test.ts` / `.test.tsx` files (~20 files)

Also update saved config migration: when loading a `TestConfig` with `totalTransactions` but no `iterations`, map `totalTransactions` → `iterations`.

#### Task 1.5: Create `computeAllocation()` (~1h)

**File**: `src/engine/allocationEngine.ts` (NEW)

```typescript
export interface AllocationResult {
  testId: string;
  testName: string;
  iterations: number;
  rowCount: number;          // 0 for standard, N for parameterized (enabled rows)
  totalRequests: number;     // iterations × max(rowCount, 1)
}

export interface AllocationSummary {
  items: AllocationResult[];
  totalRequests: number;     // sum of all items
  kind: 'standard' | 'parameterized';
}

export function computeAllocation(
  tests: Scenario[],
  iterations: number,
  kind: 'standard' | 'parameterized',
): AllocationSummary {
  // Standard: each test runs `iterations` times → totalRequests = iterations × tests.length
  // Parameterized: each test runs `iterations` times × enabled rows → totalRequests = sum(iterations × enabledRows)
  // No weight-based distribution. No cap. Straightforward multiplication.
}
```

This function is the **single source of truth** used by:
- `ExecutionPlanPreview` (UI) — shows what will happen before running
- `executor.ts` (engine) — builds the actual execution queue

#### Task 1.6: Unit tests for `computeAllocation()` (~0.5h)

**File**: `src/engine/allocationEngine.test.ts` (NEW)

Test cases:
- Standard: 5 iterations × 3 tests = 15 total requests
- Parameterized: 5 iterations × 1 test with 10 rows = 50 total requests
- Parameterized: 3 iterations × 2 tests (5 rows + 8 rows) = 39 total requests
- Zero iterations → 0 total
- Empty test list → 0 total
- Parameterized test with some disabled rows → only enabled rows counted
- Each `AllocationResult` has correct per-test breakdown

#### Task 1.7: Update executor to use `computeAllocation()` (~0.5h)

**File**: `src/engine/executor.ts`

Replace the current allocation block (lines ~94-126) with a call to `computeAllocation()`. The executor builds the queue from the allocation results instead of doing its own weight-based math.

**Before** (current):
```typescript
const activeWeights = config.scenarioWeights.filter((w) => w.weight > 0);
// ... complex weight-based allocation with guaranteed minimum, top-N, shuffle
```

**After** (new):
```typescript
const allocation = computeAllocation(scenarios, config.iterations, kind);
// Build queue directly from allocation.items
for (const item of allocation.items) {
  const scenario = scenarios.find(s => s.id === item.testId);
  if (!scenario) continue;
  for (let i = 0; i < item.iterations; i++) queue.push(scenario);
}
```

Also **remove the post-expansion cap** (lines ~136-138):
```typescript
// REMOVE:
// if (total > 0 && expandedQueue.length > total) {
//   expandedQueue.length = total;
// }
```

For the Parameterized Runner path, expansion still happens via `expandQueue()`, but without the cap. For the Test Runner path, `expandQueue()` is a no-op (no data sources).

**Note**: Keep `scenarioWeights` in `TestConfig` for backward compatibility but ignore it in the default allocation path. Weight-based mode can be preserved behind an advanced toggle in the future if needed.

#### Task 1.8: Update executor tests (~0.5h)

**File**: `src/engine/executor.test.ts`

- Update all tests that reference `totalTransactions` → `iterations`
- Update allocation expectations to match new `computeAllocation()` behavior (per-test iterations, no weight distribution)
- Remove tests for the post-expansion cap (no longer exists)
- Add test: standard tests with `iterations=5` produces exactly `5 × N` results
- Add test: parameterized tests with `iterations=3` and 10 rows produces exactly `3 × 10` results

#### Phase 1 Success Criteria

- [ ] `TestScenario` has `kind` field; TypeScript compiles with zero errors
- [ ] Migration auto-detects and splits mixed scenarios correctly
- [ ] `totalTransactions` fully renamed to `iterations` across codebase
- [ ] `computeAllocation()` produces correct results for standard and parameterized
- [ ] Executor uses `computeAllocation()` — no more weight-based allocation by default
- [ ] Post-expansion cap removed
- [ ] All existing tests pass (updated for new field names)
- [ ] Phase 1 is shippable independently

---

### Phase 2: Scenario Builder Enforcement (~3-4 hours)

> **Goal**: Enforce that each `TestScenario` contains only one type of test. The ScenarioBuilder UI prevents users from mixing types at creation time. After this phase, no new mixed scenarios can be created.

#### Task 2.1: Scenario creation flow (~1h)

**File**: `src/features/scenarios/ScenarioBuilder.tsx`

When the user creates a new scenario, determine `kind` automatically:

- **New empty scenario**: defaults to `kind: 'standard'`.
- **First test added without data source**: confirms `kind: 'standard'`.
- **First test added with data source** (or data source attached to first test): sets `kind: 'parameterized'`.
- **If scenario already has `kind: 'standard'` and user tries to attach a data source**: show inline message — *"This is a Standard scenario. To use data sources, create a Parameterized scenario."* Prevent the action.
- **If scenario already has `kind: 'parameterized'` and user tries to add a test without a data source**: show inline message — *"This is a Parameterized scenario. All tests must have a data source."* Prevent the action.

Alternatively, offer an explicit choice at creation time:
- "Create Standard Scenario" (default)
- "Create Parameterized Scenario"

This may be simpler and clearer. The user knows what they're creating upfront.

#### Task 2.2: Prevent data source attachment on standard scenarios (~0.5h)

**File**: `src/features/scenarios/ScenarioBuilder.tsx`

In the test editor modal / data source attachment flow:
- If the parent `TestScenario.kind === 'standard'`, hide or disable the "Attach Data Source" / "Import CSV" buttons.
- If the user somehow reaches the data source UI (e.g., via shared data source), prevent saving with a validation error.

#### Task 2.3: Require data source on parameterized scenarios (~0.5h)

**File**: `src/features/scenarios/ScenarioBuilder.tsx`

In the test editor modal, when saving a test inside a `kind: 'parameterized'` scenario:
- Validate that `dataSource` or `sharedDataSourceId` is set.
- If missing, show validation error — *"Parameterized scenarios require a data source on each test."*
- Prevent save until a data source is attached.

#### Task 2.4: Show `kind` badge in scenario list (~0.5h)

**File**: `src/features/scenarios/ScenarioBuilder.tsx`

In the scenario list / tree UI, show a small badge next to each `TestScenario` name:
- Standard scenarios: no badge (or subtle "API" badge)
- Parameterized scenarios: **"CSV"** or **"DATA"** badge (styled pill, similar to existing badges)

This helps the user quickly identify scenario types and understand why certain actions are available/unavailable.

#### Task 2.5: Scenario builder tests (~1h)

**File**: `src/features/scenarios/ScenarioBuilder.test.tsx`

Test cases:
- Creating a new scenario defaults to `kind: 'standard'`
- Adding a test with data source to a standard scenario is prevented
- Adding a test without data source to a parameterized scenario is prevented
- `kind` badge renders correctly for both types
- Existing migrated scenarios (from Phase 1) display correctly
- Explicit creation flow (if implemented): "Create Standard" vs "Create Parameterized" produces correct `kind`

#### Phase 2 Success Criteria

- [ ] New scenarios must have `kind` set at creation
- [ ] Standard scenarios cannot have data sources attached
- [ ] Parameterized scenarios require data sources on all tests
- [ ] `kind` badge visible in scenario list
- [ ] No new mixed scenarios can be created through the UI
- [ ] All scenario builder tests pass

---

### Phase 3: Runner Split (~5-7 hours)

> **Goal**: Split the current Test Runner into two specialized runners (Test Runner + Parameterized Runner) that share a common foundation. Each runner only shows scenarios of its type and has a tailored Execution Plan preview. The Workflow Runner is unchanged.

#### Task 3.1: Extract `RunnerLayout` shared component (~1h)

**File**: `src/features/test-runner/components/RunnerLayout.tsx` (NEW)

Extract the common page structure from `TestRunner.tsx` into a reusable layout:

```typescript
interface RunnerLayoutProps {
  title: string;
  selector: React.ReactNode;           // scenario selector or workflow picker
  executionPlan: React.ReactNode;       // preview component (differs per runner)
  configSection: React.ReactNode;       // RunnerExecutionConfig + iterations input
  children: React.ReactNode;            // results area
  isRunning: boolean;
  onRun: () => void;
  onAbort: () => void;
  progress?: ProgressState;
}
```

This wraps:
- Header with title + run/abort button
- Left column: selector + execution plan preview
- Right column / below: config + progress + results
- `LiveProgressPanel` integration

Both `TestRunner.tsx` and `ParameterizedRunner.tsx` use this layout. `WorkflowRunner.tsx` can optionally adopt it later but is not required in this phase.

#### Task 3.2: Extract `IterationsInput` component (~0.5h)

**File**: `src/features/test-runner/components/IterationsInput.tsx` (NEW)

Replace the current "Transactions" number input with a shared `IterationsInput`:

```typescript
interface IterationsInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;         // defaults to "Iterations"
  min?: number;           // defaults to 1
  helpText?: string;      // contextual help below the input
}
```

Used by all three runners. The `helpText` differs:
- Test Runner: *"Each selected test runs this many times."*
- Parameterized Runner: *"Each data row in each test runs this many times."*
- Workflow Runner: *"The workflow executes this many times."*

Also update `RunnerExecutionConfig.tsx` to use `IterationsInput` instead of the inline Transactions input. Rename the label from "Transactions" to "Iterations" in all display text.

#### Task 3.3: Extract `ExecutionPlanPreview` base component (~1h)

**File**: `src/features/test-runner/components/ExecutionPlanPreview.tsx` (NEW)

Replace the current Expansion Summary with a clean preview that calls `computeAllocation()`:

```typescript
interface ExecutionPlanPreviewProps {
  allocation: AllocationSummary;   // from computeAllocation()
  concurrency: number;
}
```

Renders a card:

**For Test Runner** (`kind: 'standard'`):
```
┌─────────────────────────────────────────────┐
│ Execution Plan                              │
│                                             │
│   5 iterations × 10 tests = 50 requests     │
│   Concurrency: 2                            │
│   Est. time: ~25 seconds                    │
└─────────────────────────────────────────────┘
```

**For Parameterized Runner** (`kind: 'parameterized'`):
```
┌─────────────────────────────────────────────┐
│ Execution Plan                              │
│                                             │
│   Login Test (8 rows)     5 × 8  = 40      │
│   Onboard Test (12 rows)  5 × 12 = 60      │
│                           ─────────────     │
│   Total: 100 requests                       │
│   Concurrency: 2                            │
│   Est. time: ~50 seconds                    │
└─────────────────────────────────────────────┘
```

The preview updates **live** as the user changes iterations, selects/deselects scenarios, or adjusts concurrency.

Remove the old Expansion Summary code from `TestRunner.tsx` (the `breakdown` array and the `× 1 = 0` rendering logic around lines 329–390).

#### Task 3.4: Refactor `TestRunner.tsx` (~1h)

**File**: `src/features/test-runner/TestRunner.tsx`

Simplify to handle **standard scenarios only**:

- **Selector**: Pass `kind: 'standard'` filter to `ScenarioSelector` (Task 3.6) so only standard scenarios appear
- **Config**: Use `IterationsInput` instead of Transactions
- **Preview**: Use `ExecutionPlanPreview` with `computeAllocation(tests, iterations, 'standard')`
- **Execution**: Build `TestConfig` with `iterations` (not `totalTransactions`), no weight-based allocation
- **Remove**: All Expansion Summary / breakdown rendering code, the `× N rows` logic, weight manipulation UI (if present for standard tests)

The refactored `TestRunner` should be **significantly shorter** than the current version — most complexity was handling the mixed case.

#### Task 3.5: Create `ParameterizedRunner.tsx` (~1.5h)

**File**: `src/features/test-runner/ParameterizedRunner.tsx` (NEW)

Mirrors `TestRunner.tsx` structure but specialized for parameterized tests:

- **Selector**: Pass `kind: 'parameterized'` filter to `ScenarioSelector`
- **Config**: Use `IterationsInput` with `helpText` about data rows
- **Preview**: Use `ExecutionPlanPreview` with `computeAllocation(tests, iterations, 'parameterized')` — shows per-test row breakdown
- **Execution**: Build `TestConfig` with `iterations`, call `expandQueue()` during execution (via executor), **no post-expansion cap**
- **Data source info**: Show summary of enabled rows per test in the selector (already partially exists)

Uses `RunnerLayout`, `useTestExecution`, `HostSelector`, `RunnerExecutionConfig`, `LiveProgressPanel` — all shared. The only unique code is the selector filtering and preview rendering.

#### Task 3.6: Update `ScenarioSelector` to accept `kind` filter (~0.5h)

**File**: `src/features/test-runner/components/ScenarioSelector.tsx`

Add an optional `kind` prop:

```typescript
interface ScenarioSelectorProps {
  // ... existing props
  kind?: 'standard' | 'parameterized';  // NEW — if set, only show matching scenarios
}
```

When `kind` is provided, filter `featureGroups → scenarios` to only show `TestScenario` entries where `sc.kind === kind`. Feature groups with no matching scenarios are hidden entirely.

#### Task 3.7: Add third tab in navigation (~0.5h)

**File**: `src/App.tsx`

Add "Parameterized Runner" as a new tab between "Test Runner" and "Workflow Runner" in the main navigation:

```
[Scenarios] [Test Runner] [Parameterized Runner] [Workflow Runner] [Results]
```

Route to `ParameterizedRunner` component. Share the same feature group / environment context.

#### Task 3.8: Remove post-expansion cap (~0.25h)

**File**: `src/engine/executor.ts`

Remove lines ~136-138:
```typescript
// REMOVE THIS BLOCK:
if (total > 0 && expandedQueue.length > total) {
  expandedQueue.length = total;
}
```

With separated runners, the allocation is honest and the cap is unnecessary:
- Test Runner: no expansion happens (no data sources), so nothing to cap
- Parameterized Runner: expansion produces exactly `iterations × rows`, which is what the user configured and the preview showed

#### Task 3.9: Deprecate weight-based allocation as default (~0.5h)

**File**: `src/engine/executor.ts`

The current weight-based proportional allocation (guaranteed minimum + top-N by weight) is replaced by `computeAllocation()` in the default path.

**Decision**: Keep `scenarioWeights` in `TestConfig` for backward compatibility. If the weight array is present and any weight differs from 1, fall back to the legacy allocation as an advanced feature. Otherwise, use the new simple per-test iterations model.

This preserves backward compatibility for any saved configs that used custom weights, while making the default path simple and predictable.

#### Task 3.10: Update all runner tests (~1.5h)

**Files**:
- `src/features/test-runner/TestRunner.test.tsx` — update for standard-only behavior, `iterations` field
- `src/features/test-runner/ParameterizedRunner.test.tsx` (NEW) — selector filtering, data row preview, execution
- `src/features/test-runner/WorkflowRunner.test.tsx` — update `totalTransactions` → `iterations` references
- `src/features/test-runner/hooks/useTestExecution.test.ts` — update config shape
- `src/features/test-runner/hooks/useRunnerConfig.test.ts` — update saved config field
- `src/features/test-runner/hooks/useWorkflowRunnerConfig.test.ts` — update field
- `src/features/test-runner/components/RunnerExecutionConfig.test.tsx` — label change
- `src/features/test-runner/components/ScenarioSelector.test.tsx` — `kind` filter tests

#### Phase 3 Success Criteria

- [ ] `RunnerLayout`, `IterationsInput`, `ExecutionPlanPreview` extracted and shared
- [ ] Test Runner shows only standard scenarios, uses simple `N × tests` preview
- [ ] Parameterized Runner shows only parameterized scenarios, uses `N × rows` preview
- [ ] Workflow Runner unchanged (uses `iterations` field name)
- [ ] Three tabs visible in navigation
- [ ] `ScenarioSelector` filters by `kind`
- [ ] Post-expansion cap removed
- [ ] Weight-based allocation deprecated (kept as fallback)
- [ ] Old Expansion Summary code removed
- [ ] All tests pass across all three runners

---

### Phase 4: Polish & Documentation (~3-4 hours)

> **Goal**: Final UX polish, migration notifications, results display improvements, and documentation updates.

#### Task 4.1: Migration notification banner (~0.5h)

**File**: New UI component (or inline in `App.tsx`)

On first load after migration (check `migration-v4-notified` flag in storage):
- Show a dismissible info banner: *"Your scenarios have been updated. Parameterized tests have been moved into separate scenarios to work with the new Parameterized Runner."*
- Link to the Parameterized Runner tab
- Set the flag after dismissal so it doesn't appear again

#### Task 4.2: Update `DataRowSummaryTable` (~0.5h)

**File**: `src/features/results/components/DataRowSummaryTable.tsx`

Currently counts `results.filter(r => r.dataRowId).length` — the number of **executed** rows. After this fix, show both:

- "Executed: 10 / 10 rows" (when all rows ran)
- "Executed: 5 / 10 rows" (if somehow not all ran — shouldn't happen after the fix, but defensive)

Requires passing the original data source row count into the component (or accessing it via the scenario reference).

#### Task 4.3: Update `ResultsDashboard.tsx` display (~0.5h)

**File**: `src/features/results/ResultsDashboard.tsx`

Update any references to "Transactions" in the results display to show "Iterations." The run summary should display:
- "Iterations: 5" (not "Transactions: 5")
- For parameterized: "Iterations: 5 × 10 rows = 50 requests"

#### Task 4.4: Update training manuals (~1h)

**Files**: `docs/training-manuals/`

- Update or create manuals for:
  - Test Runner (standard tests) — how iterations work, execution plan preview
  - Parameterized Runner — how iterations × rows work, data source requirements
  - Scenario creation — choosing standard vs parameterized
- Register new manuals in `workflowPaths.ts` and `manualMetadata.ts`

#### Task 4.5: Update project documentation (~0.5h)

**Files**:
- `CHANGELOG.md` — document the runner redesign, Transactions → Iterations rename, scenario type enforcement
- `README.md` — update any runner references
- `.cursor/rules/project-conventions.mdc` — add new file references (`allocationEngine.ts`, `ParameterizedRunner.tsx`, `RunnerLayout.tsx`, etc.) to the Key Files table

#### Task 4.6: Update report generator (~0.5h)

**File**: `src/features/results/utils/reportGenerator.ts`

Update exported report format to use "Iterations" instead of "Transactions" in report headers/labels. Ensure backward compatibility when importing old reports that use the "Transactions" label.

#### Phase 4 Success Criteria

- [ ] Migration banner appears once after upgrade, dismissible
- [ ] `DataRowSummaryTable` shows total vs executed row counts
- [ ] Results display uses "Iterations" terminology
- [ ] Training manuals created/updated for all three runners
- [ ] `CHANGELOG.md`, `README.md`, conventions doc updated
- [ ] Report generator uses new terminology
- [ ] All tests pass

---

## Shared vs Specialized Components

### Shared (reused by all three runners)

| Component | Current Location | Notes |
|-----------|-----------------|-------|
| `useTestExecution` | `src/features/test-runner/hooks/useTestExecution.ts` | Execution lifecycle — no changes needed |
| `RunnerExecutionConfig` | `src/features/test-runner/components/RunnerExecutionConfig.tsx` | Concurrency, mode, think time |
| `LiveProgressPanel` | `src/features/test-runner/components/LiveProgressPanel.tsx` | Progress bar, ETA |
| `HostSelector` | `src/features/test-runner/components/HostSelector.tsx` | Base URL selection |
| `executor.ts` / `runTest()` | `src/engine/executor.ts` | Core engine |
| `computeAllocation()` | `src/engine/allocationEngine.ts` | **NEW** — single source of truth |
| `RunnerLayout` | `src/features/test-runner/components/RunnerLayout.tsx` | **NEW** — shared wrapper |
| `IterationsInput` | `src/features/test-runner/components/IterationsInput.tsx` | **NEW** — replaces Transactions |
| `ExecutionPlanPreview` | `src/features/test-runner/components/ExecutionPlanPreview.tsx` | **NEW** — base preview component |
| Results components | `src/features/results/` | Dashboard, detail views |

### Specialized (per runner)

| Component | Runner | Purpose |
|-----------|--------|---------|
| `TestRunner.tsx` (refactored) | Test Runner | Standard scenario selector + simple preview |
| `ParameterizedRunner.tsx` (new) | Parameterized Runner | Parameterized scenario selector + rows × iterations preview |
| `WorkflowRunner.tsx` (unchanged) | Workflow Runner | Workflow picker + variables + trace config |
| `ScenarioSelector` (updated) | Test + Parameterized | Accepts `kind` filter prop |

---

## How Each Problem Is Solved

| # | Original Problem | Root Cause | How It's Solved |
|---|-----------------|-----------|----------------|
| 1 | Silent zero allocation | Weight-based total budget with many tests | Eliminated. "Iterations" = per-test count. Every test runs. |
| 2 | "Transactions" semantic confusion | Label implies per-test, system means total budget | Eliminated. "Iterations" means the same thing everywhere. |
| 3 | Mixed test unfair competition | Normal and parameterized compete for same budget | Eliminated. Can't mix — enforced at scenario level and runner level. |
| 4 | Expansion Summary lies | UI uses different formula than engine | Eliminated. Both use `computeAllocation()`. Single source of truth. |
| 5 | Silent data row truncation | `expandedQueue.length = total` cap after expansion | Eliminated. No cap. Parameterized Runner runs all rows × iterations. |
| 6 | Results show wrong row count | Counts executed rows, not source rows | Fixed. `DataRowSummaryTable` shows both. |
| 7 | User confusion in mixed case | One runner handles all types with one knob | Eliminated by design. Three runners, each handles one type. |

---

## Effort Summary

| Phase | Description | Tasks | Effort |
|-------|-------------|-------|--------|
| Phase 1 | Foundation (types, migration, allocation, executor) | 1.1–1.8 | ~4–5 hours |
| Phase 2 | Scenario Builder enforcement | 2.1–2.5 | ~3–4 hours |
| Phase 3 | Runner split (extract shared, create Parameterized Runner) | 3.1–3.10 | ~5–7 hours |
| Phase 4 | Polish & documentation | 4.1–4.6 | ~3–4 hours |
| **Total** | | **29 tasks** | **~15–20 hours** |

### Phasing Strategy

- **Phase 1 is independently shippable** — fixes the allocation math, adds `kind` to scenarios, migrates existing data, and renames Transactions → Iterations. This alone solves problems 1, 2, 4, and 5 at the engine level.
- **Phase 2 requires Phase 1** — the `kind` field must exist before the ScenarioBuilder can enforce it.
- **Phase 3 requires Phase 2** — runners filter by `kind`, which must be set on all scenarios and enforced at creation.
- **Phase 4 can overlap with Phase 3** — documentation and polish can run in parallel with runner implementation.

### Feature Branch Strategy

Following project conventions:
- `feature/runner-redesign-phase1` → Phase 1 (merge to `develop` after verification)
- `feature/runner-redesign-phase2` → Phase 2 (merge to `develop`)
- `feature/runner-redesign-phase3` → Phase 3 (merge to `develop`)
- Phase 4 tasks can be included in the Phase 3 branch or a separate `feature/runner-redesign-polish` branch

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Existing saved scenarios with mixed types | Data loss if migration fails | Auto-split is deterministic; always preserves all tests. Add migration logging. Write thorough migration tests. |
| Users confused by new third tab | Increased navigation | Tab names are self-explanatory. Scenario `kind` badge guides users to the right runner. |
| Weight-based allocation removal breaks power users | Advanced users lose fine-grained control | Keep as opt-in advanced toggle (collapsed by default). |
| `totalTransactions` references throughout codebase | Build failures | Comprehensive rename with TypeScript compiler catching all references. |

---

## Appendix: Current Data Flow (Before)

```
User selects mixed scenarios + sets "Transactions = 5"
  │
  ▼
TestRunner.tsx — builds TestConfig with scenarioWeights
  │
  ▼
executor.ts — runTest()
  ├─ Allocation: proportional by weight (guaranteed 1 if budget allows)
  ├─ Shuffle
  ├─ expandQueue() — parameterized tests × N rows
  ├─ CAP: expandedQueue.length = total  ← SILENT DATA LOSS
  └─ Execute
       ▼
     Results (missing tests, wrong row counts)
```

## Appendix: New Data Flow (After)

```
User goes to Test Runner or Parameterized Runner
  │
  ▼
Selects scenarios (all same kind — enforced)
Sets "Iterations = 5"
  │
  ▼
ExecutionPlanPreview — calls computeAllocation()
Shows exact plan: "5 × 10 tests = 50 requests"  OR  "5 × 8 rows = 40 requests"
  │
  ▼
User confirms → executor.ts — runTest()
  ├─ Uses same computeAllocation() — guaranteed match with preview
  ├─ Test Runner: no expansion needed
  ├─ Parameterized Runner: expand rows (no cap — all rows run)
  └─ Execute
       ▼
     Results (complete, accurate, no surprises)
```

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-08 | AI Assistant | Initial plan — symptom-level analysis of 7 issues with 6 solution options |
| 2026-05-09 | AI Assistant | Complete rewrite — redesigned as architectural fix. Three runners (Test, Parameterized, Workflow), type-safe scenarios (`kind` field), unified "Iterations" terminology, shared foundation with `computeAllocation()`, migration strategy. All 7 original problems solved by design elimination. |
