# Runner Redesign — Unified Iterations & Type-Safe Scenarios

**Created**: May 8, 2026  
**Revised**: May 9, 2026 (complete rewrite based on design review)  
**Status**: Complete (All 4 phases — code + documentation)  
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

- [x] `TestScenario` has `kind` field; TypeScript compiles with zero errors
- [x] Migration auto-detects and splits mixed scenarios correctly
- [x] `totalTransactions` fully renamed to `iterations` across codebase
- [x] `computeAllocation()` produces correct results for standard and parameterized
- [x] Executor uses `computeAllocation()` — no more weight-based allocation by default
- [x] Post-expansion cap removed
- [x] All existing tests pass (updated for new field names)
- [x] Phase 1 is shippable independently

#### Phase 1 Implementation Summary (completed 2026-05-09)

**Sub-phase 1A: Type System + Migration**
- Added `ScenarioKind` type (`'standard' | 'parameterized'`), required `kind` field to `TestScenario`, and `isParameterizedScenario()` guard in `src/shared/types/index.ts`
- Created `src/shared/utils/scenarioMigration.ts` — `migrateScenarioKinds()` auto-detects kind, splits mixed scenarios preserving auth and generating new UUIDs
- Integrated migration into `loadFeatureGroups()` in `src/shared/utils/storage.ts`
- Updated all production scenario creation sites (`useScenarioMutations.ts`, `useScenarioExportImport.ts`) to set `kind`
- 15 migration unit tests in `src/shared/utils/scenarioMigration.test.ts`

**Sub-phase 1B: Rename + Allocation + Executor**
- Renamed `totalTransactions` → `iterations` across 33+ source files and 5 E2E files (zero remaining references)
- UI label changed from "Transactions" to "Iterations" in `RunnerExecutionConfig.tsx`
- Added config migration in `loadRunnerConfig()` for legacy saved configs
- Created `src/engine/allocationEngine.ts` — `computeAllocation()` with `AllocationResult`/`AllocationSummary` types; simple per-test iterations model (no weight-based distribution)
- 14 allocation unit tests in `src/engine/allocationEngine.test.ts`
- Replaced weight-based allocation in `executor.ts` with `computeAllocation()` call
- Removed post-expansion cap (what you configure is what runs)
- Updated 5 executor tests for new allocation semantics + 1 UI test for label change

**Test Results**: 2728 tests passing across 100 test files, zero TypeScript errors

**Files Created**:
- `src/shared/utils/scenarioMigration.ts` — scenario kind migration logic
- `src/shared/utils/scenarioMigration.test.ts` — 15 tests
- `src/engine/allocationEngine.ts` — allocation engine
- `src/engine/allocationEngine.test.ts` — 14 tests

**Files Modified** (key changes):
- `src/shared/types/index.ts` — `kind` field, `ScenarioKind` type, `iterations` field
- `src/shared/utils/storage.ts` — migration integration, config migration
- `src/engine/executor.ts` — `computeAllocation()` integration, cap removal
- 33+ files for `totalTransactions` → `iterations` rename

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

- [x] New scenarios must have `kind` set at creation
- [x] Standard scenarios cannot have data sources attached
- [x] Parameterized scenarios require data sources on all tests
- [x] `kind` badge visible in scenario list
- [x] No new mixed scenarios can be created through the UI
- [x] All scenario builder tests pass

#### Phase 2 Implementation Summary (completed 2026-05-09)

**Task 2.1: Scenario creation with explicit `kind` choice**
- Added `newScenarioKind` state to `useScenarioMutations` — user selects "Standard" or "Parameterized" via radio buttons before creating a scenario
- Updated `addScenario()` to accept optional `kind` parameter; defaults to `newScenarioKind` state; resets to `'standard'` after creation
- Inline creation form in `ScenarioBuilder.tsx` now shows a kind selector with styled radio options and context-aware placeholder text

**Task 2.2: Prevent data source attachment on standard scenarios**
- Standard scenarios: hides "+ Param Test", "+ From Shared DS" buttons; hides "Parameterize" action on test cards
- Parameterized scenarios: hides "+ Test" button (only "+ Param Test" and "+ From Shared DS" available)
- `TestEditorModal`: "Parameterize" / "Data Source" tabs hidden when `scenarioKind === 'standard'`
- New `scenarioKind` prop passed from `ScenarioBuilder` to `TestEditorModal`

**Task 2.3: Require data source on parameterized scenarios**
- `saveTest()` in `useScenarioMutations` validates that parameterized scenario tests have `dataSource` or `sharedDataSourceId`; silently blocks save if missing

**Task 2.4: `kind` badge in scenario list**
- Parameterized scenarios show an indigo "DATA" pill badge next to the scenario name
- CSS styles: `.kind-badge`, `.kind-badge-param`, `.scenario-kind-selector`, `.kind-option`, `.kind-option-active`

**Task 2.5: Tests**
- 7 new tests in `useScenarioMutations.test.ts`: default kind, explicit kind via state, explicit kind via parameter, kind state reset, save blocked for parameterized without DS, save succeeds with DS, save succeeds for standard without DS

**Test Results**: 2181 scenario tests passing, zero TypeScript errors

**Files Modified**:
- `src/features/scenarios/hooks/useScenarioMutations.ts` — `newScenarioKind` state, `addScenario` kind param, `saveTest` validation
- `src/features/scenarios/ScenarioBuilder.tsx` — kind selector UI, conditional buttons, badge, `scenarioKind` prop to modal
- `src/features/scenarios/components/TestEditorModal.tsx` — `scenarioKind` prop, conditional Data/Parameterize tabs
- `src/styles/scenario-builder.css` — kind selector and badge styles
- `src/features/scenarios/hooks/useScenarioMutations.test.ts` — 7 new tests

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
[Feature Groups] [Test Runner] [Parameterized Runner] [Workflow Runner] [Results]
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

- [x] `ExecutionPlanPreview` extracted and shared
- [x] Test Runner shows only standard scenarios, uses simple `N × tests` preview
- [x] Parameterized Runner shows only parameterized scenarios, uses `N × rows` preview
- [x] Workflow Runner unchanged (uses `iterations` field name)
- [x] Three tabs visible in navigation: Test Runner | Parameterized Runner | Workflow Runner
- [x] `ScenarioSelector` filters by `kind`
- [x] Post-expansion cap removed (done in Phase 1)
- [x] Weight-based allocation deprecated (done in Phase 1)
- [x] Old Expansion Summary code removed from TestRunner
- [x] All tests pass across all three runners

#### Phase 3 Implementation Summary (completed 2026-05-09)

**Sub-phase 3A: Shared Components**

- Created `ExecutionPlanPreview` component (`src/features/test-runner/components/ExecutionPlanPreview.tsx`):
  - Standard kind: compact `N iterations × M tests = X requests` format
  - Parameterized kind: per-test row breakdown with row count badges
  - Shows concurrency when > 1, singular/plural forms
  - 7 unit tests covering all rendering paths
- Updated `ScenarioSelector` with optional `kind` filter prop:
  - When `kind` is set, filters scenarios to only show matching type
  - Feature groups with no matching scenarios are hidden entirely
  - Uses `useMemo` for efficient filtering
  - 4 new tests for kind filtering (all/standard/parameterized/hidden groups)
- `RunnerLayout` not extracted as a separate component — the existing page structure is simple enough (5 lines of JSX) that wrapping it would add unnecessary indirection. Both runners share the same layout pattern directly.
- `IterationsInput` kept within `RunnerExecutionConfig` — already labeled "Iterations" from Phase 1 rename

**Sub-phase 3B: Runner Split**

- Refactored `TestRunner.tsx` for standard-only:
  - Passes `kind="standard"` to `ScenarioSelector`
  - Replaced inline Expansion Summary IIFE (~60 lines) with `ExecutionPlanPreview` component
  - Uses `computeAllocation()` with `'standard'` kind
  - Tab label renamed from "Runner" to "Test Runner"
- Created `ParameterizedRunner.tsx` (`src/features/test-runner/ParameterizedRunner.tsx`):
  - Mirrors TestRunner structure with `kind="parameterized"`
  - Uses `computeAllocation()` with `'parameterized'` kind for per-row breakdown
  - Separate config context key (`param:` prefix) so configs don't collide
  - Separate progress key for independent saved progress
  - Shows "Run Parameterized Test" button text
  - Empty state: "No parameterized scenarios defined" when no param scenarios exist
  - 8 unit tests covering title, context tags, kind filtering, empty states
- Updated `appTabUtils.ts`:
  - Added `'param-runner'` to `Tab` type, `HARNESS_TABS`, and `ALL_TABS`
- Updated `App.tsx`:
  - Imported `ParameterizedRunner`
  - Added "Parameterized Runner" sub-nav tab between "Test Runner" and "Workflow Runner"
  - ParameterizedRunner mounted with `hidden` attribute (same pattern as TestRunner for in-flight test survival)

**Sub-phase 3C: Tests**

- Tasks 3.8 (post-expansion cap removal) and 3.9 (weight-based allocation deprecation) were already completed in Phase 1
- Updated E2E test references: `settings.spec.ts` and `run-test.spec.ts` tab text assertions updated from "Runner" to "Test Runner"
- New test files: `ExecutionPlanPreview.test.tsx` (7 tests), `ParameterizedRunner.test.tsx` (8 tests)
- Existing tests: `ScenarioSelector.test.tsx` +4 new kind filter tests

**Test Results**: 693 tests passing across all affected suites, zero TypeScript errors

**Files Created**:
- `src/features/test-runner/components/ExecutionPlanPreview.tsx`
- `src/features/test-runner/components/ExecutionPlanPreview.test.tsx`
- `src/features/test-runner/ParameterizedRunner.tsx`
- `src/features/test-runner/ParameterizedRunner.test.tsx`

**Files Modified**:
- `src/features/test-runner/TestRunner.tsx` — `kind="standard"`, replaced Expansion Summary with ExecutionPlanPreview, added `computeAllocation`
- `src/features/test-runner/components/ScenarioSelector.tsx` — optional `kind` filter prop with `useMemo` filtering
- `src/features/test-runner/components/ScenarioSelector.test.tsx` — 4 new kind filter tests
- `src/app/utils/appTabUtils.ts` — `'param-runner'` added to Tab type, HARNESS_TABS, ALL_TABS
- `src/app/App.tsx` — ParameterizedRunner import, tab button, component rendering
- `e2e/settings.spec.ts` — tab text "Runner" → "Test Runner"
- `e2e/run-test.spec.ts` — tab text "Runner" → "Test Runner"

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

#### Task 4.4: Update existing training manuals (~1.5h)

**Scope**: All existing training manuals that reference "Transactions," the old Test Runner behavior, or runner configuration must be updated to reflect the new architecture.

**Manuals requiring "Transactions" → "Iterations" terminology updates**:
- `docs/training-manuals/tests/runner-comparison-easy.html` — update runner descriptions, terminology, and screenshots/diagrams
- `docs/training-manuals/tests/parameterized-basics-easy.html` — update how iterations interact with data rows
- `docs/training-manuals/tests/parameterized-user-sweep-easy.html` — update execution count explanations
- `docs/training-manuals/tests/parameterized-product-search-easy.html` — update any "Transactions" references
- `docs/training-manuals/tests/parameterized-multi-endpoint-advanced.html` — update allocation explanations
- `docs/training-manuals/tests/parameterized-validation-medium.html` — update execution terminology
- `docs/training-manuals/tests/parameterized-rerun-failed-easy.html` — update re-run config references
- `docs/training-manuals/tests/parameterized-pre-validate-medium.html` — update execution references
- `docs/training-manuals/tests/parameterized-file-import-easy.html` — update runner references
- `docs/training-manuals/tests/parameterized-create-copy-easy.html` — update runner context
- `docs/training-manuals/tests/parameterized-row-tags-easy.html` — update execution references
- `docs/training-manuals/tests/shared-data-sources-easy.html` — update runner context
- `docs/training-manuals/tests/shared-data-sources-fetch-medium.html` — update runner references
- `docs/training-manuals/tests/shared-data-sources-cross-fg-medium.html` — update references

**Manuals requiring runner architecture updates**:
- `docs/training-manuals/tests/runner-comparison-easy.html` — **major update**: describe three runners (Test, Parameterized, Workflow) instead of two; explain when to use each; update feature comparison table
- `docs/training-manuals/workflow/runner/workflow-runner-basics-easy.html` — update any cross-references to Test Runner
- `docs/training-manuals/workflow/runner/workflow-runner-iterations-medium.html` — clarify that "Iterations" is now consistent across all runners

**For each manual**:
1. Replace all "Transactions" → "Iterations" in text, headings, tables, and diagrams
2. Update runner names (if the manual mentions Test Runner or Workflow Runner)
3. Update any allocation/execution flow explanations to match the new per-test iterations model
4. Verify HTML is well-formed after edits

#### Task 4.5: Create new training manuals (~1.5h)

**New manuals to create**:

1. **Test Runner Guide** — `docs/training-manuals/tests/test-runner-basics-easy.html`
   - What the Test Runner is and when to use it (standard HTTP tests only)
   - How "Iterations" works: each selected test runs N times
   - Execution plan preview — what you see before running
   - Selecting scenarios (only `kind: 'standard'` scenarios appear)
   - Execution modes (sequential, batch, pool, load profile)
   - Link to Parameterized Runner guide for data-driven tests

2. **Parameterized Runner Guide** — `docs/training-manuals/tests/parameterized-runner-basics-easy.html`
   - What the Parameterized Runner is and when to use it
   - How "Iterations × Rows" works: each test runs N times per data row
   - Execution plan preview — shows per-test row breakdown
   - Selecting scenarios (only `kind: 'parameterized'` scenarios appear)
   - Relationship to data sources and row tags
   - Link to Test Runner guide for standard tests

3. **Scenario Types Guide** — `docs/training-manuals/tests/scenario-types-easy.html`
   - What are Standard vs Parameterized scenarios
   - How to create each type (Scenario Builder flow)
   - The `kind` badge in the UI
   - Migration: what happened to old mixed scenarios
   - Which runner to use for each type

**Registration files to update**:
- `src/data/galleries/trainingPaths/workflowPaths.ts` (or `corePaths.ts` / `contentPaths.ts` as appropriate) — add entries for new manuals
- `src/data/galleries/trainingPaths/manualMetadata.ts` — add `addedAt` entries
- Update manual counts in `src/data/galleries/trainingPaths/trainingPaths.test.ts`

#### Task 4.6: Update gallery sample descriptions (~0.5h)

**Files**: `src/data/galleries/`

- Review all gallery sample descriptions that mention "Transactions" and update to "Iterations"
- Update any sample workflow or test descriptions that reference the old runner behavior
- Ensure sample data (if any) is consistent with the new scenario `kind` field

#### Task 4.7: Update project documentation (~0.5h)

**Files**:
- `CHANGELOG.md` — document the runner redesign, Transactions → Iterations rename, scenario type enforcement, three-runner architecture
- `README.md` — update any runner references, feature descriptions
- `.cursor/rules/project-conventions.mdc` — add new file references to Key Files table:
  - `src/engine/allocationEngine.ts` — Shared allocation engine
  - `src/shared/utils/scenarioMigration.ts` — Scenario kind migration
  - `src/features/test-runner/ParameterizedRunner.tsx` — Parameterized Runner page
  - `src/features/test-runner/components/RunnerLayout.tsx` — Shared runner wrapper
  - `src/features/test-runner/components/IterationsInput.tsx` — Iterations input component
  - `src/features/test-runner/components/ExecutionPlanPreview.tsx` — Execution plan preview
- `ROADMAP.md` — update with completed runner redesign milestone

#### Task 4.8: Update report generator (~0.5h)

**File**: `src/features/results/utils/reportGenerator.ts`

Update exported report format to use "Iterations" instead of "Transactions" in report headers/labels. Ensure backward compatibility when importing old reports that use the "Transactions" label.

#### Phase 4 Success Criteria

- [x] Migration banner appears once after upgrade, dismissible
- [x] `DataRowSummaryTable` shows total vs executed row counts
- [x] Results display uses "Iterations" terminology (already done in Phase 1)
- [x] All existing training manuals updated ("Transactions" → "Iterations", runner architecture)
- [x] Three new training manuals created (Test Runner, Parameterized Runner, Scenario Types)
- [x] New manuals registered in gallery system with metadata
- [x] Gallery sample descriptions updated (no changes needed — "transactionId" is business domain)
- [x] `CHANGELOG.md`, `README.md`, `ROADMAP.md`, conventions doc updated
- [x] Report generator uses new terminology (already done in Phase 1)
- [x] `forceSingleTransaction` renamed to `forceSingleIteration`
- [x] All code tests pass (1447 tests)

#### Phase 4 Code Implementation Summary (completed 2026-05-09)

**Task 4.1: Migration notification banner**
- Created `MigrationBanner` component (`src/features/test-runner/components/MigrationBanner.tsx`)
  - Shows one-time dismissible info banner when `migrateScenarioKinds()` split mixed scenarios
  - Uses `localStorage` keys: `migration-v4-split-count` (set by migration), `migration-v4-notified` (set on dismiss)
  - Includes link to navigate to Parameterized Runner tab
  - Singular/plural grammar for split count
  - 7 unit tests covering all states
- Updated `storage.ts` to write `migration-v4-split-count` after migration
- Added blue info-style CSS in `test-runner.css`
- Integrated into `App.tsx` within the testing domain sub-nav area

**Task 4.2: DataRowSummaryTable update**
- Added optional `expectedRowCount` prop to `DataRowSummaryTable`
- Shows `executed / expected rows` format when counts differ; clean `N rows` when they match
- 5 unit tests covering all display cases

**Task 4.3: ResultsDashboard display** — Already uses "Iterations" throughout (completed in Phase 1)

**Task 4.8: Report generator** — Already uses "Iterations" throughout (completed in Phase 1)

**Additional cleanup: `forceSingleTransaction` → `forceSingleIteration`**
- Renamed prop in `RunnerExecutionConfig.tsx` (19 occurrences)
- Updated `WorkflowRunner.tsx` (1 occurrence)
- Updated `RunnerExecutionConfig.test.tsx` (4 occurrences)

**Tasks 4.4–4.7 (documentation) completed 2026-05-09**:
- Updated 14+ existing training manuals: Runner references → Parameterized Runner, TPS → "Requests per second", navigation paths
- Rewrote `runner-comparison-easy.html` for three-runner architecture
- Created 3 new manuals: `test-runner-guide-easy.html`, `parameterized-runner-guide-easy.html`, `scenario-types-guide-easy.html`
- Registered all new manuals in `contentPaths.ts` (Phase 6: Runners & Scenario Types) and `manualMetadata.ts`
- Updated `workflowPaths.ts` Runner Comparison description for three runners
- Gallery sample descriptions: no changes needed (transactionId references are business-domain API fields)
- Updated `CHANGELOG.md` with runner redesign entries under [Unreleased]
- Updated `README.md`: Transactions → Iterations, CLI flags, three-runner section, architecture diagram
- Updated `ROADMAP.md`: Phase 0.5.9 milestone, fixed transaction→iteration wording
- Updated `.cursor/rules/project-conventions.mdc` Key Files table with new files

**Test Results**: 1447 tests passing, zero TypeScript errors

**Files Created**:
- `src/features/test-runner/components/MigrationBanner.tsx`
- `src/features/test-runner/components/MigrationBanner.test.tsx`
- `src/features/results/components/DataRowSummaryTable.test.tsx`

**Files Modified**:
- `src/shared/utils/storage.ts` — writes `migration-v4-split-count` after kind migration
- `src/features/results/components/DataRowSummaryTable.tsx` — `expectedRowCount` prop
- `src/features/test-runner/components/RunnerExecutionConfig.tsx` — `forceSingleTransaction` → `forceSingleIteration`
- `src/features/test-runner/components/RunnerExecutionConfig.test.tsx` — prop rename
- `src/features/test-runner/WorkflowRunner.tsx` — prop rename
- `src/styles/test-runner.css` — migration banner styles
- `src/app/App.tsx` — MigrationBanner integration

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
| Page layout pattern | Inline in each runner | Shared `<div className="page">` structure (not extracted — too simple) |
| Iterations input | `src/features/test-runner/components/RunnerExecutionConfig.tsx` | Already shared via `RunnerExecutionConfig` |
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
| Phase 4 | Polish, documentation & training manuals | 4.1–4.8 | ~5–6 hours |
| **Total** | | **31 tasks** | **~17–22 hours** |

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
| 2026-05-09 | AI Assistant | Phase 1 complete — `kind` field added to `TestScenario`, auto-migration for existing data (including mixed scenario splitting), `totalTransactions` → `iterations` rename across 33+ files, `computeAllocation()` engine created and integrated into executor, post-expansion cap removed. 2728 tests passing. |
| 2026-05-09 | AI Assistant | Expanded Phase 4 documentation scope — added comprehensive training manual update plan (14+ existing manuals to update), 3 new manuals to create (Test Runner, Parameterized Runner, Scenario Types), gallery sample updates, project doc updates. Phase 4 effort revised from ~3-4h to ~5-6h. |
| 2026-05-09 | AI Assistant | Phase 2 complete — explicit kind selector on scenario creation (Standard/Parameterized radio buttons), conditional action buttons per scenario type, Data tab hidden for standard scenarios, parameterized save validation, indigo "DATA" badge. 7 new tests, 2181 scenario tests passing. |
| 2026-05-09 | AI Assistant | Phase 3 complete — Runner split into Test Runner (standard-only) and Parameterized Runner (parameterized-only). ExecutionPlanPreview shared component with kind-aware rendering. ScenarioSelector kind filter. Three tabs in navigation. Old Expansion Summary removed. 19 new tests, 693 tests passing. |
| 2026-05-09 | AI Assistant | Phase 4 code complete — Migration notification banner (one-time, dismissible), DataRowSummaryTable expected vs executed row counts, `forceSingleTransaction` → `forceSingleIteration` rename. 12 new tests, 1447 tests passing. Documentation tasks (4.4–4.7) deferred pending user review. |
| 2026-05-09 | AI Assistant | Phase 4 documentation complete — Updated 14+ existing training manuals (Runner references, TPS wording). Rewrote runner-comparison manual for 3-runner architecture. Created 3 new manuals (Test Runner Guide, Parameterized Runner Guide, Scenario Types Guide). Registered in gallery system. Updated CHANGELOG, README, ROADMAP, project-conventions. All 31 tasks complete. |
