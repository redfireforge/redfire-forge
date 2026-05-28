# SLA Dashboard — Implementation Plan

**Status:** Complete — All phases (1–5, Scoped SLA A–E, Per-Test SLA B10–B16, Results Refactor C–D, UI Polish F) done. Code cleanup: 4 done (CC-1/2/3/5), 2 reclassified as N/A (CC-4/6). Import CLI results into UI (§5) ✅ DONE. Future: SLA history trending (§2.4).  
**Tests:** 1,186+ passing (109 slaTargets + 84 useRunnerOrchestration + 82 useScenarioMutations + 28 RunnerSlaOverridePanel + broader suite)  
**Branch:** `feature/review-plan`  
**Tracker:** `T-5` in `docs/plan/long-term-enhancement-plan.md`

---

## Table of Contents

1. [Completed Work Summary](#1-completed-work-summary)
2. [Key Design Decisions (Reference)](#2-key-design-decisions-reference)
3. [Active Plan — Definition-First Architecture Refactor](#3-active-plan--definition-first-architecture-refactor)
4. [Code Cleanup](#4-code-cleanup)

---

## 1. Completed Work Summary

> All items below are shipped. See git history for detailed implementation notes.

### Original 5-Phase Build (DONE)

| Phase | What was built | Key files |
|-------|---------------|-----------|
| Phase 1 — Data Layer | `SlaTarget`, `SlaMetric`, `evaluateSla()`, `overallSlaStatus()`, storage functions, 36 tests | `src/features/results/utils/slaTargets.ts` |
| Phase 2 — Dashboard Component | `SlaDashboard`, `SlaStatusBanner`, `SlaCheckGrid`, collapse/expand | `src/features/results/components/SlaDashboard.tsx` |
| Phase 3 — Target Editor | Inline SLA target editor rows, metric selector, operator toggle, warn threshold | `SlaDashboard.tsx` (inline) |
| Phase 4 — Integration | Wired into `ResultsDashboard.tsx`; async load/save | `src/features/results/ResultsDashboard.tsx` |
| Phase 5 — Tests | 42 component tests, 36 data layer tests | `SlaDashboard.test.tsx`, `slaTargets.test.ts` |
| Phase 6 — CSS | `.sla-dashboard`, `.sla-status-banner`, `.sla-check-grid`, etc. | `src/styles/base.css` |

### Scoped SLA Enhancement (A–E) — DONE

| Phase | What was built | Tests added |
|-------|---------------|-------------|
| Phase A — Computation layer | `ScenarioMetrics`, `computeScenarioMetrics()`, `extractScenarioNames()`, `evaluateSlaForScenario()` | 30 (66 total) |
| Phase C — Type model | `slaTargets?: SlaTarget[]` on `TestConfig`; `SlaMetric`/`SlaTarget` moved to `src/shared/types/index.ts` | — |
| Phase B — Storage | `resolveTargetsForRun()`, per-run ad-hoc `loadRunSlaTargets()` / `saveRunSlaTargets()` | 14 (80 total) |
| Phase D — UI | `SlaTestTable` (per-scenario rows), scope badge, read-only mode, "Scenario" column in editor | 19 (70 component total) |
| Phase E — Run list | `computeRunSlaStatus()`, SLA status dots in run list (🟢🟡🔴⚪⚫) | 8 (89 total) |

**Implementation checklist (all complete)**:
- [x] `scenarioName?: string` on `SlaTarget`; `ScenarioMetrics` type and computation functions in `slaTargets.ts`
- [x] `slaTargets?: SlaTarget[]` on `TestConfig` in `src/shared/types/index.ts`
- [x] ~~`loadWorkflowSlaTargets()`, `saveWorkflowSlaTargets()`, `resolveTargetsForRun()` storage layer~~ (workflow localStorage functions removed in CC-1/2/3 cleanup 2026-05-25)
- [x] `SlaTestTable` per-scenario component; scope badge (`🔒 This Run` / `📋 Workflow`); read-only mode
- [x] `computeRunSlaStatus()` utility; SLA dots in run list dropdown
- [x] `SlaTargetEditor`, `SlaEmptyState` extracted to `SlaTargetEditor.tsx` (Phase A above)
- [x] `WorkflowSlaPanel` in `WorkflowRunner.tsx`; `scope='workflow-def'` → `📋 Workflow` badge
- [x] ~~Migration banner for legacy `sla-targets-wf-{id}` localStorage entries~~ (removed in CC-3 cleanup 2026-05-25)
- [x] 89 total `slaTargets` tests; 1,186 total results-suite tests; 0 TypeScript errors

---

## 2. Key Design Decisions (Reference)

> Context from the completed Scoped SLA (A–E) work. These decisions remain architecturally in effect.

---

### 2.1 Industry Research

All major load testing tools co-locate SLA thresholds **with the test definition**, not as a separate global store:

| Tool | Scope model |
|---|---|
| **k6** | Thresholds in `options.thresholds` inside the test script. Can be global or scoped per tag/group. Travel with the script. |
| **Artillery** | `ensure` block inside the test YAML config. Run-level aggregate. Part of the test definition. |
| **Gatling** | Assertions API: `.global()`, `.forAll()`, or `.details(scenarioName)`. Three scope levels in code. |
| **JMeter** | Duration/Response Assertions as children of individual request samplers — per-sampler granularity. |

**Key insight:** No major tool has a global-outside-the-test SLA concept. SLA definitions belong with the test, not in a separate persistent store.

---

### 2.2 Design Decisions

#### Decision 1 — No global SLA

SLA is only configured at:
- **Definition level** — embedded in `Scenario.slaTargets[]` (per-test), `FeatureGroup.slaTargets[]` (per-FG), or `Workflow.slaTargets[]` (per-workflow). Auto-collected into `TestConfig.slaTargets` at run time.
- **Ad-hoc post-run** — stored per-run (`sla-targets-run-{runId}`) for targets set after the run in the Results view (⚗ Ad-hoc badge).

If neither is configured for a run, the SLA panel shows empty state. This is honest — a run with no SLA contract defined is not a failure.

#### Decision 2 — SLA is per test type (scenario), grouped across iterations

Given a test run with 3 concurrency and 5 iterations:
```
Test 1 (checkout)  — SLA configured  → 5 iterations × 3 VUs = 15 executions
Test 2 (search)    — no SLA          → 5 iterations × 3 VUs = 15 executions
Test 3 (batch)     — SLA configured  → 5 iterations × 3 VUs = 15 executions
```

SLA is **not** evaluated per iteration. All executions of the same test type are grouped, aggregate metrics are computed across all of them, and SLA is evaluated **once per test type**. Result: 2 SLA evaluations (Test 1 and Test 3). Test 2 shows ⚫.

This matches how k6 evaluates thresholds per scenario (not per VU iteration) and how Gatling uses `.details(scenarioName)`.

#### Decision 3 — Aggregate fallback within a run

A `SlaTarget` with no `scenarioName` applies to the whole run's aggregate `TestSummary`. This supports simple single-scenario runs where grouping is unnecessary. Per-scenario targets (with `scenarioName` set) take precedence over aggregate targets for that scenario.

#### Decision 4 — Run list SLA indicator

The run list sidebar shows a small status dot per run so the user can see SLA pass/fail across all runs without clicking into each one:
- 🟢 all SLA targets passing
- 🟡 one or more warnings
- 🔴 one or more violations
- ⚫ no SLA configured for this run

#### Decision 5 — Metrics computed from `RequestResult[]` at display time

`TestSummary` only has aggregate metrics. Per-scenario P95/TPS/errorRate are not pre-computed. They must be derived from `RequestResult[]` by grouping on `scenarioName` at display time. This is a new computation step but keeps the data model simple — no schema changes to stored run data.

---

### 2.3 What Does NOT Change

- `SlaTarget` evaluation logic (`evaluateSla()`, `overallSlaStatus()`) — pure functions, still used for aggregate fallback targets
- CSS — only minor additions for scenario table, scope badge, read-only state
- Existing run data — `TestSummary` fields unchanged; per-scenario metrics are computed on the fly from `RequestResult[]`
- The `SlaTarget` shape is backward compatible — `scenarioName` is optional, existing targets without it continue working as aggregate checks

---

### 2.4 Out of Scope (Future)

- **SLA history trending** — chart pass/fail rate per test over time across multiple runs
- ~~**Importing SLA from k6/Artillery config files**~~ — removed: users can define SLA via the existing per-test editor or CLI `--sla-config` JSON
- ~~**SLA target templates**~~ — removed: workflow-embedded SLA already acts as reusable definitions
- ~~**CI/CD exit code**~~ — ✅ **DONE** (SLA-E3): `--fail-on-sla` flag in CLI emits exit code 3 on SLA violations
- **Import CLI results into UI** — see §5 below

---

## 5. Import CLI Test Results into UI

> **Motivation:** Users run load tests via CLI (`redfireforge run`) for speed, CI/CD pipelines, or headless environments. They then want to visually inspect results — response time distributions, error details, SLA pass/fail accordion — in the desktop/web UI. Currently there is no way to do this.

### 5.1 Current State

| What exists | Gap |
|---|---|
| CLI `--output results.json` produces a full `TestRun` object (same type the UI stores in IndexedDB) | No import button in Results Dashboard |
| `TestConfig.slaTargets` field already exists — CLI can embed SLA targets in JSON output | CLI currently does NOT embed `slaTargets` into the JSON output even when `--sla-config` is used |
| `📂 Import Workflow Replay` button already exists in Results toolbar (imports workflow execution traces) | No "Import Test Results" equivalent for full test results |
| `saveTestRun()` in `storage.ts` persists a `TestRun` to IndexedDB | Not wired to any file import UI |
| Settings tab has drag-drop + file picker + Tauri dialog pattern (`SettingsExportImportTab.tsx`) | Pattern not yet applied to test runs |

### 5.2 Implementation Steps

#### Step 1 — CLI: Embed `slaTargets` in JSON output

**File:** `cli/reporters.ts` → `buildJsonReport()`

Currently outputs:
```ts
{ id, timestamp, config, summary, results, envName, projectName }
```

**Change:** When `--sla-config <path>` is used, the loaded `SlaTarget[]` should be merged into `config.slaTargets` before calling `buildJsonReport()`. This happens in `cli/index.ts` where `loadSlaTargetFile()` is called — set `config.slaTargets = slaTargets` before building the report.

No change needed in `buildJsonReport()` itself — it already passes the full `config` through.

#### Step 2 — UI: "📥 Import Test Results" button in Results Dashboard toolbar

**File:** `src/features/results/ResultsDashboard.tsx`

Add an "📥 Import Test Results" button next to the existing "📂 Import Workflow Replay" button. Follows the same pattern:
- Hidden `<input type="file" accept=".json">` with ref
- Button click triggers file picker
- `onChange` handler reads the file, parses JSON, validates shape

#### Step 3 — Validation utility

**File:** `src/features/results/utils/importRun.ts` *(new)*

```ts
export function validateImportedRun(data: unknown): { valid: true; run: TestRun } | { valid: false; error: string }
```

Validates:
- Is an object with `id`, `timestamp`, `config`, `summary`, `results`
- `config` has required fields (`concurrency`, `iterations`, `scenarioWeights`, `executionMode`)
- `results` is an array
- `summary` has required fields (`totalRequests`, `totalDurationMs`, etc.)
- `id` is a string (regenerate UUID if missing to avoid collisions)
- `timestamp` is a number

#### Step 4 — Persist and refresh

After validation:
1. Assign a new `id` (avoid collisions with existing runs): `run.id = crypto.randomUUID()`
2. Call `saveTestRun(run)` to persist to IndexedDB
3. Call `refreshRuns()` to reload the run list
4. Auto-select the newly imported run
5. Show success toast: "Imported run: {projectName || 'CLI Run'} ({results.length} requests)"

#### Step 5 — SLA rendering (automatic)

No extra work needed — once the run is in IndexedDB:
- `resolveTargetsForRun()` reads `config.slaTargets` → returns `{ targets, scope: 'run' }`
- `SlaCompactBar` shows the pass/fail pill + "🔒 This Run" badge
- `SlaStatusAccordion` shows the Feature → Scenario → Check tree
- User can also add ad-hoc SLA targets post-import (scope changes to null → "⚗ Ad-hoc")

#### Step 6 — Duplicate detection (optional polish)

Before saving, check if a run with the same `timestamp` + `projectName` + `summary.totalRequests` already exists. If so, prompt: "A similar run already exists. Import anyway?"

#### Step 7 — Unit tests

- `importRun.ts`: validation happy path, missing fields, malformed JSON, duplicate detection
- `ResultsDashboard`: mock file input, verify `saveTestRun` called, verify run list refreshed

#### Step 8 — E2E test

- Create a sample CLI output JSON in `test-data/`
- E2E: navigate to Results → click "📥 Import Test Results" → select file → verify run appears in list → verify SLA bar renders

### 5.3 Files to modify

| File | Change |
|---|---|
| `cli/index.ts` | Set `config.slaTargets = slaTargets` before `buildJsonReport()` when `--sla-config` is used |
| `src/features/results/utils/importRun.ts` | New: `validateImportedRun()` utility |
| `src/features/results/ResultsDashboard.tsx` | Add "📥 Import Test Results" button + handler |
| `src/features/results/utils/importRun.test.ts` | New: unit tests for validation |

### 5.4 Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | CLI: embed slaTargets in JSON output | ✅ DONE |
| 2 | UI: Import Test Results button | ✅ DONE |
| 3 | Validation utility | ✅ DONE |
| 4 | Persist and refresh | ✅ DONE (part of step 2 handler) |
| 5 | SLA rendering (automatic) | ✅ Already done — no work needed |
| 6 | Duplicate detection | SKIPPED (optional polish) |
| 7 | Unit tests | ✅ DONE — 21 tests, 100% coverage |
| 8 | E2E test | ✅ DONE — 3 tests passing |

> Execute in order: **A → C → B → D → E**

#### Phase A — Computation layer
- [x] Add `scenarioName?: string` to `SlaTarget` interface
- [x] Add `ScenarioMetrics` type to `slaTargets.ts` (extends `Record<SlaMetric, number>` for direct indexing)
- [x] Add `computeScenarioMetrics(results, scenarioName)` — uses `r.responseTimeMs`, `r.timestamp`, `!r.passed`; `.reduce()` not spread for min/max
- [x] Add `extractScenarioNames(results)` — no cast needed, `scenarioName` is required `string`
- [x] Add `getScenarioMetricValue(metric, scenarioMetrics)` internal helper
- [x] Add `evaluateSlaFromMetrics(metrics, targets)` internal helper
- [x] Add `evaluateSlaForScenario(scenarioMetrics, targets)` public function
- [x] 30 new tests added (66 total in slaTargets.test.ts, up from 36) — 100% branch/line/function/statement coverage
- [x] All 1144 results-suite tests pass, 0 TypeScript errors
- [x] Audit round 1: removed unreachable `?? durations[n-1]` fallback (dead code); added 3 missing tests (overallSlaStatus warn+no-data, evaluateSlaForScenario empty targets, scenarioName round-trip)

#### Phase C — Type model *(before Phase B)*
- [x] Add `slaTargets?: SlaTarget[]` to `TestConfig` in `src/shared/types/index.ts`
- [x] Move `SlaMetric` type and `SlaTarget` interface from `slaTargets.ts` to `src/shared/types/index.ts`; re-export via `export type { SlaMetric, SlaTarget }` from `slaTargets.ts` for backward compat
- [x] Verify whether `src-tauri/` serializes `TestConfig` — no Rust `TestConfig` struct found; skip Rust changes
- [x] TypeScript: 0 errors

#### Phase B — Storage layer *(after Phase C)*
- [x] Add `loadWorkflowSlaTargets(workflowId)` / `saveWorkflowSlaTargets(workflowId, targets)`
- [x] Add `loadRunSlaTargets(runId)` / `saveRunSlaTargets(runId, targets)` — per-run-scoped storage for standalone runs (priority 3 in `resolveTargetsForRun`)
- [x] Add `resolveTargetsForRun(testRun: TestRun)` with `TestRun` import from `'../../../shared/types'`
- [x] JSDoc note: non-workflow runs without `workflowId` fall through to per-run storage
- [x] 14 new unit tests added (80 total in slaTargets.test.ts): run-level wins, workflow fallback, per-run fallback, null when neither, no-workflowId path, overwrite, corrupt JSON
- [x] All tests pass — 100% branch/line/function/statement coverage

#### Phase D — UI: SLA Dashboard
- [x] Update `SlaDashboardProps` (add `results?: RequestResult[]`, `scope?: 'run' | 'workflow' | null`; keep `summary`; both optional with defaults for backward compat)
- [x] Add `SlaTestTable` component — per-scenario groups with `sla-scenario-group`; ⚫ `sla-neutral-row` for scenarios with no matching target
- [x] Add scope badge to banner (`sla-scope-badge`, `sla-scope-run`/`sla-scope-workflow`; 🔒 for run, 🔗 for workflow)
- [x] Read-only editor when `scope === 'run'` — hide "Edit Targets" button; check grid still visible
- [x] Add "Scenario" column to `SlaTargetEditor` with `sla-scenario-select` dropdown (Aggregate + extracted names from results)
- [x] Update `ResultsDashboard.tsx` — use `resolveTargetsForRun()`, `saveWorkflowSlaTargets()`, pass `results`, `scope`; add `slaScope` state; per-run SLA loading via `useEffect([selectedRunId])`
- [x] Update `SlaDashboard.test.tsx` — 19 new Phase D tests (scope badge: 4, read-only: 3, per-scenario: 6, scenario dropdown: 5); 70 total tests, all passing
- [x] TypeScript: 0 errors; 1177 results suite tests passing

#### Phase E — Run list indicator
- [x] Add `computeRunSlaStatus(testRun, results)` utility — resolves targets via `resolveTargetsForRun`, evaluates aggregate targets against `testRun.summary`, evaluates scenario-specific targets per-scenario from `results`, returns `overallSlaStatus(allChecks)`
- [x] Run list `<select>` in `ResultsDashboard.tsx` gains SLA dot in each option label (🟢🟡🔴⚪⚫); ⚫ when null (no SLA configured), no dot while statuses not yet computed (key absent from map)
- [x] `runSlaStatuses: Map<string, SlaStatus | null>` state; lazy `useEffect([runs])` — non-blocking, cancelled on unmount
- [x] `handleSaveSlaTargets` clears `runSlaStatuses` (sets empty Map) to force recompute after save
- [x] 8 new unit tests: null when no SLA, null when no matching results, pass/fail/warn aggregate, fail/pass scenario, worst-of-all-checks
- [x] 89 total slaTargets tests; 1186 total results-suite tests; 0 TypeScript errors

---

## 3. Active Plan — Definition-First Architecture Refactor

> **Added: 2026-05-24** — Architectural gap identified during SLA Dashboard visual testing.
> **Decision: Option 1 (definition-first)** — confirmed 2026-05-24. SLA belongs on the test definition, matching industry tools (k6, Gatling, Artillery, JMeter).

### 3.1 The Gap

**Root problem**: SLA targets are configured in the *Results* view — after a test run. This is architecturally inverted. SLA is an acceptance criterion (defined before running), not a post-hoc observation.

**Industry standard**: All major load testing tools co-locate thresholds with the test definition:
- **k6** — `options.thresholds` inside the test script; travels with the script
- **Gatling** — `.assertions()` DSL; part of the simulation definition
- **Artillery** — `ensure:` block inside the test YAML
- **JMeter** — assertions as children of individual request samplers

**How the three scenarios map**:

| Scenario | Correct home | Current home |
|----------|-------------|--------------|
| Standalone test run SLA | `TestScenario.slaTargets[]` in Feature Group definition | Post-hoc `sla-targets-run-{id}` localStorage |
| Workflow SLA — **definition** | `Workflow.slaTargets[]` edited in `WorkflowDesignerMainLayout` | ⚠️ Phase A put editing in `WorkflowRunner.tsx` only — **designer has no SLA section yet** |
| Workflow SLA — **override** | `WorkflowRunner` override panel (env-specific, runner wins on conflict) | ⚠️ `WorkflowSlaPanel` in `WorkflowRunner.tsx` is currently the **primary** edit point, not an override |
| Per-feature aggregate SLA | `FeatureGroup.slaTargets[]` in feature group definition | Not yet supported |

**Runner override** is available on top of the definition for environment-specific thresholds. Runner targets WIN on `metric + scenarioName` conflict.

**What is correct today** (keep unchanged):
- `config.slaTargets` embedded in a run's `TestConfig` → Results shows "🔒 This Run" badge, read-only. Correct design — it just has no UI to populate it from the Runner side yet.

---

### 3.2 Storage Layer

**Current** (definition-first, after CC-1/2/3 cleanup):
```
Definitions (built in Feature Groups / Workflow builder):
  FeatureGroup.slaTargets[]      ← feature-aggregate targets
    Scenario.slaTargets[]        ← per-test targets (PRIMARY HOME)
  Workflow.slaTargets[]          ← per-workflow targets

Run execution:
  1. Auto-collect from selected tests + FeatureGroup + Workflow definition
  2. Merge with optional Runner override targets (runner wins on conflict)
  3. Embed merged set into TestConfig.slaTargets (snapshot)

Run result (TestRun):
  └── config.slaTargets[]        ← "🔒 This Run" / "📋 Workflow" — read-only in Results

localStorage / Tauri FS (ad-hoc only):
  └── sla-targets-run-{runId}    ← "⚗ Ad-hoc" — set post-run in Results view editor

Resolution: config.slaTargets → per-run ad-hoc → null (empty state)
```

---

### 3.3 Affected Code Locations

| Location | Change needed | Phase |
|----------|--------------|-------|
| `src/shared/types/index.ts` — `TestScenario` | Add `slaTargets?: SlaTarget[]` | B |
| `src/shared/types/index.ts` — `FeatureGroup` | Add `slaTargets?: SlaTarget[]` | B |
| `src/shared/types/index.ts` — `Scenario` | Add `slaTargets?: SlaTarget[]` (per-test level, PRIMARY home) | B |
| `src/shared/types/index.ts` — `SlaTarget` | Add `featureGroupName?: string` for feature-level targeting | C |
| `src/features/scenarios/ScenarioBuilder.tsx` | Add 🎯 button per test card; `ScenarioSlaPanel` summary; `TestSlaModal` integration | B |
| `src/features/scenarios/hooks/` (mutation hooks) | Add `updateScenarioSlaTargets(fgId, scId, targets)`, `updateFeatureGroupSlaTargets(fgId, targets)`, `updateTestSlaTargets(fgId, scId, testId, targets)` | B |
| `src/features/scenarios/components/TestSlaModal.tsx` *(new)* | Per-test SLA target editor modal | B |
| `src/features/scenarios/components/ScenarioSlaPanel.tsx` *(rewritten)* | Read-only summary table of per-test SLA targets | B |
| `src/features/test-runner/hooks/useRunnerOrchestration.ts` | Auto-collect `slaTargets` from `selectedScenarios` at build-time; merge with runner overrides | B |
| `src/features/test-runner/components/RunnerPage.tsx` | Add optional "SLA Override" collapsible panel before Run button | B |
| `src/features/workflow/components/WorkflowDesignerMainLayout.tsx` | Add collapsible "SLA Targets" section in workflow settings (design-time, primary edit point — same pattern as scenario SLA in Feature Groups) | B |
| `src/features/test-runner/WorkflowRunner.tsx` | ✅ Phase A: `WorkflowSlaPanel` + embed at launch. **Phase B**: reframe panel as **override-only** — reads definition targets from `Workflow.slaTargets`, runner override targets merge on top (runner wins on conflict) | B |
| `src/features/results/components/SlaDashboard.tsx` | Replace with compact `SlaCompactBar` at top | C |
| `src/features/results/components/SlaStatusAccordion.tsx` *(new)* | Feature → Scenario → Test tree with traffic light dots | C |
| `src/features/results/utils/slaTargets.ts` | Add `computeFeatureGroupMetrics`, `evaluateSlaTree` utilities | C |
| `src/features/results/ResultsDashboard.tsx` | Replace `<SlaDashboard>` with `<SlaCompactBar>`; insert `<SlaStatusAccordion>` after Timing | C |
| `src/styles/base.css` | Styles for scenario SLA section, compact bar, accordion tree | B, C |

---

### 3.4 Implementation Phases

#### Phase A — Workflow Definition SLA ✅ DONE

See [§ 11.7 Phase A checklist](#phase-a--computation-layer) and [§ 11.10](#1110-implementation-checklist-future) — all items complete.

> **Note**: Phase A added `WorkflowSlaPanel` inside `WorkflowRunner.tsx`, making the runner the primary SLA edit point. This is architecturally inverted — same gap as standalone test runs. **SLA-B8** adds the SLA section to `WorkflowDesignerMainLayout` (design-time, primary), and **SLA-B9** reframes the runner panel as override-only.

**Scope badge values**:
- `'workflow-def'` → "📋 Workflow" (from workflow definition, read-only in Results)
- `'run'` → "🔒 This Run" (from runner config / embedded `config.slaTargets`, read-only in Results)
- `null` → "⚗ Ad-hoc" (post-run targets set in Results view, editable)

---

#### Phase B — Scenario & Feature Group SLA Definition *(Definition-First)*

**Goal**: SLA targets are defined ON the test definition (`TestScenario`, `FeatureGroup`) in the Feature Groups tab — the same place you define the test itself. The Runner auto-collects them at run time and optionally allows per-run overrides for environment-specific thresholds.

**Why this is correct**: Mirrors k6 `thresholds`, Gatling `.assertions()`, Artillery `ensure:` — the requirement travels with the test. Colleagues sharing a Feature Group automatically get the SLA expectations.

**Key design decisions (confirmed 2026-05-24, updated 2026-05-25)**:
- `Scenario.slaTargets[]` (individual test) is the PRIMARY home — SLA targets per individual API endpoint / test
- `TestScenario.slaTargets[]` (scenario group) is SECONDARY — kept for backward compatibility but no longer used in new UI
- `FeatureGroup.slaTargets[]` is TERTIARY — for aggregate feature-level targets
- UI: 🎯 button per test card in ScenarioBuilder opens `TestSlaModal` for editing; `ScenarioSlaPanel` shows read-only summary table
- Runner auto-collects from all **selected** test-level `Scenario.slaTargets`; each target gets `scenarioName` set from `test.name`
- Runner has an optional "SLA Override" panel — adds new targets or overrides definition ones for environment-specific thresholds; Runner target WINS on `metric + scenarioName` conflict
- `SlaTarget.scenarioName` is already the correct key — no backward compatibility issues
- Results shows `scope='run'` for test runner runs — editable in Results as ad-hoc override if needed

**Detailed file changes**:

| Step | File | Change |
|------|------|--------|
| SLA-B1 | `src/shared/types/index.ts` — `TestScenario` | Add `slaTargets?: SlaTarget[]` optional field |
| SLA-B2 | `src/shared/types/index.ts` — `FeatureGroup` | Add `slaTargets?: SlaTarget[]` optional field |
| SLA-B3 | `src/features/scenarios/hooks/` (mutation hooks) | Add `updateScenarioSlaTargets(fgId, scId, targets: SlaTarget[])` that patches `featureGroups` immutably via `setFeatureGroups`; also `updateFeatureGroupSlaTargets(fgId, targets)` |
| SLA-B4 | `src/features/scenarios/ScenarioBuilder.tsx` | Inside the expanded `TestScenario` section (after the test list, before the "Add Test" row), add a collapsible "SLA Targets" section. Renders `SlaTargetEditor` with `scenarioName` pre-set to `sc.name` (not user-selectable). Shows count badge `N targets` in collapsed state. Calls `updateScenarioSlaTargets` on save. |
| SLA-B5 | `src/features/test-runner/hooks/useRunnerOrchestration.ts` — config build | In `handleRun`, add merge logic: collect `slaTargets` from `selectedScenarios` (each `sc.slaTargets ?? []`, normalized with `scenarioName: sc.name`); collect feature-level targets from parent `FeatureGroup.slaTargets`; merge with any runner-override targets (runner wins); set `testConfig.slaTargets = merged.length ? merged : undefined` |
| SLA-B6 | `src/features/test-runner/components/RunnerPage.tsx` | Add optional collapsed "SLA Override" panel after the weights fieldset, before the Run button. Header: "SLA Override (optional)" with count badge. Subtitle: "Override or add to scenario-defined SLA targets for this run/environment." Session state only (not localStorage — overrides are transient). |
| SLA-B7 | `src/styles/base.css` | Add `.scenario-sla-section`, `.scenario-sla-header`, `.scenario-sla-count`, `.runner-sla-override` styles |
| SLA-B8 | `src/features/workflow/components/WorkflowDesignerMainLayout.tsx` | Add collapsible "SLA Targets" section in the workflow properties panel (right side or below canvas toolbar). Renders `SlaTargetEditor` scoped to the whole workflow (no per-scenario picker needed here — workflow-level targets). Shows count badge in collapsed state. Calls `onUpdateWorkflow(wf.id, { slaTargets })` on save. **This is the primary, design-time edit point** — SLA travels with the workflow definition. |
| SLA-B9 | `src/features/test-runner/WorkflowRunner.tsx` — `WorkflowSlaPanel` | Reframe as **override-only**: (1) show a read-only summary of definition targets ("From workflow: N targets"); (2) rename header to "SLA Override (optional)"; (3) override targets entered here are merged on top of `Workflow.slaTargets` at launch — runner wins on `metric + scenarioName` conflict; (4) override targets are session-scoped, not persisted back to the workflow definition. |
| SLA-B10 | `src/shared/types/index.ts` — `Scenario` | Add `slaTargets?: SlaTarget[]` on individual test (Scenario) interface — the most granular SLA level |
| SLA-B11 | `src/features/scenarios/hooks/useScenarioMutations.ts` | Add `updateTestSlaTargets(fgId, scId, testId, targets)` mutation — patches `featureGroups[fg].scenarios[sc].tests[test].slaTargets` immutably |
| SLA-B12 | `src/features/scenarios/components/TestSlaModal.tsx` *(new)* | Modal using `AppModalFrame` for editing individual test SLA targets. Simplified editor — no Scope column (targets inherently scoped to the test). Columns: Metric, Op, Fail at, warn→, Warn at, Label, Delete. Reuses validation from `SlaTargetEditor`. |
| SLA-B13 | `src/features/scenarios/components/ScenarioSlaPanel.tsx` *(rewritten)* | Transformed from SLA target editor to **read-only summary table** of per-test SLA targets. Shows table: Test, Metric, Op, Fail at, Warn at, Label. Uses `rowSpan` for test names with multiple targets. Clicking a row opens `TestSlaModal`. |
| SLA-B14 | `src/features/scenarios/ScenarioBuilder.tsx` | Added 🎯 button per test card (with `.btn-sla-active` highlight when targets exist + count badge). Updated scenario header badge to aggregate test-level SLA counts. |
| SLA-B15 | `src/features/test-runner/hooks/useRunnerOrchestration.ts` | Added `baseTestTargets` collection in `handleRun()` — collects `test.slaTargets` from individual tests, sets `scenarioName = test.name` |
| SLA-B16 | `src/styles/base.css` | Add `.sla-summary-table`, `.sla-summary-row`, `.btn-sla-active`, `.test-sla-modal` styles |

**Merge algorithm for workflows** (SLA-B8 + SLA-B9):
```
1. Start with Workflow.slaTargets[] (from WorkflowDesigner — definition-first)
2. WorkflowRunner override targets (from SLA-B9 panel, if any)
   → on conflict (same metric + same scenarioName): runner value wins
3. Deduplicate: keep runner value when metric + scenarioName matches
4. Result → TestConfig.slaTargets[] embedded at workflow launch
```

**Merge algorithm** (SLA-B5 + SLA-B15, for non-workflow test runs):
```
1. Start with FeatureGroup.slaTargets[] (feature-aggregate level, keyed by featureGroupName)
2. Collect TestScenario.slaTargets[] for each selected scenario, set scenarioName = sc.name
3. Collect Scenario.slaTargets[] (individual test level), set scenarioName = test.name
4. Runner override targets (from SLA-B6 panel, if any) → on conflict (same metric + same scenarioName), runner value wins
5. Deduplicate: if same metric + scenarioName appears twice, keep runner value
6. Result → TestConfig.slaTargets[]
```

**UI placement in ScenarioBuilder** (SLA-B4, SLA-B10–B14):
```
▼ Test Template Scenario   [PARAM]  [101 tests]  [Auth: inherit]  [smoke]  [🎯 5 SLA]
  ├── 🎯 test row 1  (GET /api/users)        ← 🎯 button opens TestSlaModal
  ├── 🎯2 test row 2  (POST /api/orders)     ← 🎯2 = 2 SLA targets configured
  ├── ... 101 tests ...
  └── ▼ SLA Summary                           ← read-only ScenarioSlaPanel
        ┌──────────────────────────────────────────────────────────┐
        │ Test           │ Metric │ Op │ Fail at │ Warn at │ Label │
        │ GET /api/users │ P95    │ ≤  │ 500ms   │ 400ms   │ P95   │
        │                │ Error  │ ≤  │ 1%      │         │       │
        │ POST /api/...  │ TPS    │ ≥  │ 50      │         │ TPS   │
        └──────────────────────────────────────────────────────────┘
```

---

#### Phase C — Results SLA Display Refactor

**Goal**: Replace the current full `SlaDashboard` panel at the top of Results with (a) a compact one-line summary bar and (b) a new expandable accordion between Timing Breakdown and Request Details.

**Key design decisions (confirmed 2026-05-24)**:
- `SlaTarget` gets `featureGroupName?: string` — if set, evaluates against aggregate of all results under that feature group
- Feature row without its own explicit target → shows rollup (worst child scenario dot)
- SLA accordion **auto-opens** when any target fails
- Both SLA accordion and Request Details accordion are independently expandable

**Compact bar states**:
| State | Display |
|-------|---------|
| Failures | `⚠ 2 Failing` (red pill) + scope badge + "which targets failed" text |
| All passing | `✓ All Passing` (green pill) + scope badge + "N targets evaluated" |
| Workflow-locked | `✓ All Passing` + `📋 Workflow` badge + "Read-only" note (no edit button) |
| No targets | "No targets defined" (muted) + `＋ Add First Target` button |

**Detailed file changes**:

| Step | File | Change |
|------|------|--------|
| SLA-C1 | `src/shared/types/index.ts` — `SlaTarget` | Add `featureGroupName?: string` optional field |
| SLA-C2 | `src/features/results/components/SlaTargetEditor.tsx` | Add "Level" selector (Feature / Scenario) to each target row; name dropdown shows feature group or scenario names accordingly |
| SLA-C3 | `src/features/results/utils/slaTargets.ts` | Add `computeFeatureGroupMetrics(results, featureGroupName)`; add `evaluateSlaTree(results, targets)` returning typed `{ feature, scenarios: [{ scenario, tests: [] }] }` tree with `SlaStatus` at each node |
| SLA-C4 | `src/features/results/components/SlaCompactBar.tsx` *(new)* | Compact one-line bar: overall pass/fail pill, scope badge, reason text, "Edit Targets" / "＋ Add" button |
| SLA-C5 | `src/features/results/components/SlaStatusAccordion.tsx` *(new)* | Accordion: summary pills in header; Feature → Scenario → Test expandable tree; auto-opens on failure; traffic light dot per node |
| SLA-C6 | `src/features/results/ResultsDashboard.tsx` | Replace `<SlaDashboard>` at top with `<SlaCompactBar>`; insert `<SlaStatusAccordion>` after `<AggregatedTimingTable>` and before Request Details; pass `autoOpen={slaStatus === 'fail'}` |
| SLA-C7 | `src/styles/base.css` | Add `.sla-compact-bar`, `.sla-status-accordion`, `.sla-tree-*`, `.sla-dot-*` styles |

---

#### Phase D — Results UI Polish *(after C)*

| ID | Task | Complexity |
|----|------|-----------|
| SLA-D1 | `SlaCompactBar`: when `scope='workflow-def'`, hide "Edit Targets", show "Read-only" | Low |
| SLA-D2 | `SlaTargetEditor` inside accordion: add inline "Save" confirmation | Low |
| SLA-D3 | Add "⚗️ Ad-hoc Override" indicator when targets were set post-run (scope=null) | Low |

---

#### Phase E — Migration & Backward Compatibility

| ID | Task | Complexity |
|----|------|-----------|
| SLA-E1 | ~~`resolveTargetsForRun` reads legacy `sla-targets-wf-*`~~ (removed in CC-1/2 cleanup 2026-05-25) | None |
| SLA-E2 | One-time migration utility: scan all workflows, offer to merge `sla-targets-wf-{id}` into workflow definition | Low |
| SLA-E3 | CLI `--sla-config <path>` flag — loads a JSON SLA target file and merges into the run config | Medium |

---

### 3.5 Priority Order

```
━━━ Phase A — Workflow Definition SLA ━━━━━━━━━━━━━━━━━━━━━━ ✅ DONE
  SLA-A1  Add slaTargets to Workflow type          DONE
  SLA-A2  SlaTargetEditor extracted + WorkflowSlaPanel in WorkflowRunner  DONE
  SLA-A3  WorkflowRunner embeds at launch          DONE
  SLA-A4  "📋 Workflow" badge in Results           DONE
  SLA-A5  Migration banner                         DONE

━━━ Phase B — Scenario & Feature Group SLA Definition ━━━━━━
  SLA-B1  TestScenario.slaTargets? field in types              ✅ DONE
  SLA-B2  FeatureGroup.slaTargets? field in types              ✅ DONE
  SLA-B3  updateScenarioSlaTargets mutation in hooks           ✅ DONE (12 tests)
  SLA-B4  SLA Targets section in ScenarioBuilder.tsx           ✅ DONE (ScenarioSlaPanel)
  SLA-B5  Auto-collect + merge in useRunnerOrchestration       ✅ DONE (9 tests)
  SLA-B6  "SLA Override" panel in RunnerPage.tsx               ✅ DONE (RunnerSlaOverridePanel)
  SLA-B7  CSS for .scenario-sla-section                        ✅ DONE (base.css + scenario-builder.css)
  SLA-B8  SLA Targets section in WorkflowDesignerMainLayout    ✅ DONE (WorkflowSlaPanel, handleUpdateWorkflowSlaTargets)
  SLA-B9  WorkflowRunner SlaPanel → override-only mode         ✅ DONE (RunnerSlaOverridePanel, merge on launch)
  SLA-B10 Scenario.slaTargets? field (per-test level)          ✅ DONE (2026-05-25)
  SLA-B11 updateTestSlaTargets mutation                        ✅ DONE (useScenarioMutations.ts, 82 tests)
  SLA-B12 TestSlaModal component                               ✅ DONE (AppModalFrame-based per-test SLA editor)
  SLA-B13 ScenarioSlaPanel → read-only summary table           ✅ DONE (rewritten from editor to summary)
  SLA-B14 🎯 button per test card in ScenarioBuilder           ✅ DONE (btn-sla-active highlight + count badge)
  SLA-B15 Runner collects test-level slaTargets                ✅ DONE (baseTestTargets in handleRun)
  SLA-B16 CSS for per-test SLA components                      ✅ DONE (sla-summary-table, btn-sla-active, test-sla-modal)

━━━ Phase C — Results SLA Display Refactor ━━━━━━━━━━━━━━━━━ ✅ DONE
  SLA-C1  featureGroupName field on SlaTarget         ✅ DONE
  SLA-C2  Level selector in SlaTargetEditor           ✅ DONE
  SLA-C3  computeFeatureGroupMetrics + evaluateSlaTree ✅ DONE
  SLA-C4  SlaCompactBar component                     ✅ DONE
  SLA-C5  SlaStatusAccordion component                ✅ DONE
  SLA-C6  Wire into ResultsDashboard.tsx              ✅ DONE
  SLA-C7  CSS for new components                      ✅ DONE

━━━ Phase D — Results UI Polish ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ✅ DONE
  SLA-D1  Read-only label for workflow-def scope      ✅ DONE (implemented in Phase C — isReadOnly logic)
  SLA-D2  Inline "Save" confirmation in accordion     ✅ DONE (justSaved flash in SlaCompactBar)
  SLA-D3  Ad-hoc override indicator                   ✅ DONE (⚗ Ad-hoc badge when scope=null)

━━━ Phase E — Migration & CLI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SLA-E1  Backward compat (already done)              ✅ DONE (legacy workflow localStorage paths removed in CC-1/2/3 cleanup)
  SLA-E2  One-time migration utility                  ✅ DONE then REMOVED (handleMigrateSlaTargets + migration banner removed in CC-3 cleanup — no longer needed)
  SLA-E3  CLI --sla-config flag                       ✅ DONE (cli/slaEval.ts + --sla-config/--fail-on-sla in cli/index.ts)
```

### 3.6 Status

| ID | Feature | Status |
|----|---------|--------|
| SLA-A1 | `Workflow.slaTargets` type field | `DONE` |
| SLA-A2 | `SlaTargetEditor` extracted + `WorkflowSlaPanel` in WorkflowRunner | `DONE` — runner is primary; SLA-B8/B9 will move to designer + override |
| SLA-A3 | WorkflowRunner embeds targets at launch | `DONE` |
| SLA-A4 | "📋 Workflow" badge in Results (`scope='workflow-def'`) | `DONE` |
| SLA-A5 | One-time migration banner (workflow) | `DONE then REMOVED` — migration banner + `handleMigrateSlaTargets` + related CSS removed in CC-3 cleanup (2026-05-25); no longer needed after legacy workflow localStorage paths were dropped |
| SLA-B1 | `TestScenario.slaTargets?: SlaTarget[]` in `src/shared/types/index.ts` | `DONE` |
| SLA-B2 | `FeatureGroup.slaTargets?: SlaTarget[]` in `src/shared/types/index.ts` | `DONE` |
| SLA-B3 | `updateScenarioSlaTargets` / `updateFeatureGroupSlaTargets` mutations | `DONE` — 12 tests |
| SLA-B4 | Collapsible "SLA Targets" section in `ScenarioBuilder.tsx` per `TestScenario` | `DONE` — `ScenarioSlaPanel` component |
| SLA-B5 | Auto-collect + merge `slaTargets` in `useRunnerOrchestration` at run time | `DONE` — 9 tests; FG + scenario targets merged; runner wins on conflict |
| SLA-B6 | "SLA Override" collapsible panel in `RunnerPage.tsx` (optional, env-specific) | `DONE` — `RunnerSlaOverridePanel` (session state, amber tint) |
| SLA-B7 | CSS for scenario SLA section | `DONE` — base.css + scenario-builder.css |
| SLA-B8 | Collapsible "SLA Targets" section in `WorkflowDesignerMainLayout.tsx` (design-time, primary) | `DONE` — `WorkflowSlaPanel` via `handleUpdateWorkflowSlaTargets` in vm |
| SLA-B9 | `WorkflowRunner.tsx` `WorkflowSlaPanel` → override-only (reads definition, merges on launch) | `DONE` — `RunnerSlaOverridePanel`; merge: definition + overrides, runner wins on conflict. Bug fix (R1): `workflowSlaOverrides` now reset via `useEffect` when `selectedWorkflowId` changes. |
| SLA-B10 | `Scenario.slaTargets?: SlaTarget[]` in `src/shared/types/index.ts` — per-test level | `DONE` — added 2026-05-25; most granular SLA level, PRIMARY home |
| SLA-B11 | `updateTestSlaTargets(fgId, scId, testId, targets)` in `useScenarioMutations.ts` | `DONE` — patches `featureGroups[fg].scenarios[sc].tests[test].slaTargets` immutably; 82 tests total |
| SLA-B12 | `TestSlaModal` component (`src/features/scenarios/components/TestSlaModal.tsx`) | `DONE` — `AppModalFrame`-based modal; no Scope column; reuses `validateRow`, `METRIC_OPTIONS` from `SlaTargetEditor` |
| SLA-B13 | `ScenarioSlaPanel` rewritten to read-only summary table | `DONE` — shows Test→Metric→Op→Fail at→Warn at→Label table with `rowSpan`; clicking row opens `TestSlaModal` |
| SLA-B14 | 🎯 button per test card in `ScenarioBuilder.tsx` | `DONE` — `.btn-sla-active` highlight when targets exist; count badge `🎯 N`; scenario header aggregates test SLA counts |
| SLA-B15 | Runner collects test-level `slaTargets` in `useRunnerOrchestration.ts` | `DONE` — `baseTestTargets` collects `test.slaTargets` with `scenarioName: test.name`; merged into `baseTargets` |
| SLA-B16 | CSS for per-test SLA components | `DONE` — `.sla-summary-table`, `.sla-summary-row`, `.btn-sla-active`, `.test-sla-modal` in `base.css` |
| SLA-C1 | `featureGroupName?: string` on `SlaTarget` | `DONE` — added to `SlaTarget` in `shared/types`; `computeRunSlaStatus` defensively excludes FG-scoped targets from aggregate pass; 1 new test (90 total) |
| SLA-C2 | Level selector (Feature/Scenario) in `SlaTargetEditor` | `DONE` — Scope column with `sla-level-select` (Aggregate/Scenario/Feature Group) + conditional `sla-name-select`; `featureGroupNames` prop added; backward-compat via `getLevel()` |
| SLA-C3 | `computeFeatureGroupMetrics` + `evaluateSlaTree` in `slaTargets.ts` | `DONE` — added `computeFeatureGroupMetrics`, `evaluateSlaForFeatureGroup`, `SlaTree`/`SlaFeatureNode`/`SlaScenarioNode` types, `evaluateSlaTree`; `computeRunSlaStatus` updated to handle FG targets; 19 new tests (109 total) |
| SLA-C4 | `SlaCompactBar` component (replaces top `SlaDashboard` panel) | `DONE` — compact bar with status pill, scope badge, detail text, inline editor; read-only mode for run/workflow-def scope |
| SLA-C5 | `SlaStatusAccordion` component (Feature→Scenario→Test tree) | `DONE` — expandable Feature→Scenario→Check tree; `skipFeatureLevel` optimization for ungrouped; auto-opens/expands failing nodes |
| SLA-C6 | Wire `SlaCompactBar` + `SlaStatusAccordion` into `ResultsDashboard.tsx` | `DONE` — `SlaDashboard` replaced by `SlaCompactBar` at top; `SlaStatusAccordion` inserted after `AggregatedTimingTable` |
| SLA-C7 | CSS for compact bar + accordion tree | `DONE` — all new classes appended to `base.css`: `.sla-compact-bar`, `.sla-compact-pill`, `.sla-status-accordion`, `.sla-tree-*`, `.sla-dot` |
| SLA-D1 | Read-only label for `scope='workflow-def'` in compact bar | `DONE` — already implemented in Phase C via `isReadOnly = scope === 'run' \| scope === 'workflow-def'`; hides "Edit Targets" and shows "Read-only" label |
| SLA-D2 | Inline save confirmation in accordion editor | `DONE` — `justSaved` state + 1.5 s `setTimeout` in `SlaCompactBar`; shows "✓ Saved" in actions area then restores "Edit Targets"; timer cleared on unmount via `savedTimerRef` |
| SLA-D3 | Ad-hoc override indicator | `DONE` — `scopeLabel` always returns a string; `scope === null` → "⚗ Ad-hoc" badge with `.sla-scope-adhoc` amber style (`base.css`); shown whenever targets exist and no scope is set |
| SLA-E2 | One-time migration utility | `DONE then REMOVED` — `handleMigrateSlaTargets` callback, "Migrate Now" button, migration banner JSX + CSS all removed in CC-3 cleanup (2026-05-25). Legacy `sla-targets-wf-*` workflow localStorage path no longer exists; migration utility is no longer needed. |
| SLA-E3 | CLI `--sla-config` flag | `DONE` — created `cli/slaEval.ts` (pure Node.js-safe evaluation: `loadSlaTargetFile`, `evaluateCliSla`, `overallSlaStatus`, `printSlaReport`); added `--sla-config <path>` + `--fail-on-sla` options to `run` command in `cli/index.ts`; exit code 3 on SLA violations when `--fail-on-sla` set |

---

### Phase B Per-Test SLA Implementation Notes / Retrospective (2026-05-25)

> **Added**: Per-test (individual `Scenario`) SLA targets — SLA-B10 through SLA-B16.

#### Architecture decision: per-test vs. per-scenario-group

The original plan (SLA-B4) placed SLA targets at the `TestScenario` level (scenario group). During implementation, user feedback clarified: **"SLA should be based on Test and Workflow. So configuration should be there."** This led to moving the PRIMARY SLA home down one level from `TestScenario` → `Scenario` (individual test/API endpoint).

**Why per-test is correct**:
- Each API endpoint has different performance characteristics (e.g., GET /users vs POST /orders)
- Per-test SLA matches JMeter's per-sampler assertion model — the most granular of all industry tools
- `Scenario.name` maps directly to `RequestResult.scenarioName` — no mapping layer needed
- `TestScenario.slaTargets` is kept for backward compatibility but no longer populated by new UI

#### UI design: Combined Option B + C

User chose "Combined B and C" design:
- **Option B**: 🎯 button per test card — opens `TestSlaModal` for editing
- **Option C**: Read-only summary table (`ScenarioSlaPanel`) — shows all test SLA targets in tabular form

**Key implementation details**:
- `TestSlaModal` uses `AppModalFrame` (not `WorkflowEditorModalFrame`) since it's a non-workflow dialog
- `ScenarioSlaPanel` was completely rewritten from an SLA editor to a read-only summary table
- The 🎯 button shows active state (`.btn-sla-active` amber background) and count badge when targets exist
- Scenario header badge aggregates all test-level SLA counts via IIFE computing `testSlaCount`
- `updateTestSlaTargets` mutation in `useScenarioMutations.ts` patches at the test level: `fg.scenarios[sc].tests[test].slaTargets`
- Runner's `handleRun()` collects test-level targets via `baseTestTargets` flatMap, setting `scenarioName = test.name`

#### Files created
- `src/features/scenarios/components/TestSlaModal.tsx` — new modal component

#### Files modified
- `src/shared/types/index.ts` — `Scenario.slaTargets?: SlaTarget[]`
- `src/features/scenarios/hooks/useScenarioMutations.ts` — `updateTestSlaTargets()` function
- `src/features/scenarios/components/ScenarioSlaPanel.tsx` — complete rewrite to summary table
- `src/features/scenarios/ScenarioBuilder.tsx` — 🎯 button, state, modal render
- `src/features/test-runner/hooks/useRunnerOrchestration.ts` — `baseTestTargets` collection

#### Bug found during visual testing (2026-05-25)

**`definitionSlaTargetCount` undercounted** — the `useMemo` in `useRunnerOrchestration.ts` only summed FG-level + scenario-level targets, but missed test-level `Scenario.slaTargets`. This caused the Runner's SLA Override panel to show "1 definition target" instead of "8 definition targets". Fixed by adding a `testCount` accumulator that walks `sc.tests[].slaTargets`. Unit test added to cover this case (84 tests now).
- `src/styles/base.css` — `.sla-summary-table`, `.btn-sla-active`, `.test-sla-modal` styles

---

### Phase C Implementation Notes / Retrospective (2026-05-24)

#### Bugs found and fixed during post-implementation re-evaluation

**Bug C-R1 — `SlaCompactBar`: double-click required to open editor for empty targets**
- **Root cause**: "＋ Add First Target" called `openEditor()` which set `draft = []`. User saw `SlaEmptyState` and had to click "Add First Target" a *second time* before editor rows appeared.
- **Fix**: Added `openEditorWithNewTarget()` — pre-populates `draft` with one default P95 target before setting `editorOpen = true`. Empty-editor branch now renders `SlaTargetEditor` directly.
- **File**: `src/features/results/components/SlaCompactBar.tsx`

**Bug C-R2 — `SlaCompactBar`: unused imports with `void` hack**
- **Root cause**: `SLA_METRIC_LABELS` and `SLA_METRIC_UNITS` were imported but never used; `void` calls suppressed the lint error.
- **Fix**: Removed both imports, the void calls, and the now-unnecessary `SlaEmptyState` import.
- **File**: `src/features/results/components/SlaCompactBar.tsx`

**Bug C-R3 — `SlaStatusAccordion`: newly-added failing nodes don't auto-expand**
- **Root cause**: `useEffect` depended on `[tree.overall]`. If overall stayed `'fail'` while a new failing target was added, the effect never re-ran — new failing nodes were not auto-expanded.
- **Fix**: Replaced `[tree.overall]` with a derived `failingNodeKey` (sorted string of failing FG + scenario names). Effect re-runs precisely when the *set* of failing nodes changes. Manual user collapses are preserved unless a genuinely new failure appears.
- **File**: `src/features/results/components/SlaStatusAccordion.tsx`

**Cleanup C-R4 — `SlaTargetEditor`: vestigial `sla-scenario-select` class**
- **Root cause**: Scenario name `<select>` had `className="sla-scenario-select sla-name-select"` — `sla-scenario-select` was a leftover from the pre-Phase-C implementation.
- **Fix**: Changed to just `className="sla-name-select"`.
- **File**: `src/features/results/components/SlaTargetEditor.tsx`

**Bug C-R5 — `ResultsDashboard.tsx`: stale editor + accordion state on run switch**
- **Root cause**: `<SlaCompactBar>` and `<SlaStatusAccordion>` had no `key` prop. When the user switched to a different run, React reused the component instances. `SlaCompactBar`'s `editorOpen=true` and `draft` remained from the previous run (user would see the editor for the wrong run; saving would write old targets to the new run). `SlaStatusAccordion`'s `open` state also persisted (accordion could appear open on a passing run because the previous run failed).
- **Fix**: Added `key={selectedRunId}` to both components in `ResultsDashboard.tsx`. This forces a clean remount with fresh state when the selected run changes.
- **File**: `src/features/results/ResultsDashboard.tsx`

**Bug C-R6 — `SlaTargetEditor`: current scenario/FG name missing from options list**
- **Root cause**: The `sla-name-select` dropdowns were populated only from `scenarioNames`/`featureGroupNames` props (extracted from the current run's results). If a target's `scenarioName` or `featureGroupName` wasn't present in the current run (e.g. target defined against a scenario that doesn't appear in this run's results), the `<select>` would render with no matching `<option>` — the browser would display an empty/blank selection.
- **Fix**: Changed both selects to always include the current target's value first: `[...new Set([...currentValue, ...propNames])]`. The current value is always selectable even when absent from the run's results.
- **File**: `src/features/results/components/SlaTargetEditor.tsx`

**CC-5 completed — `SlaDashboard.tsx` + `SlaDashboard.test.tsx` deleted**
- Both files deleted 2026-05-24. No production code imported `SlaDashboard` after Phase C-6. 109 unit tests remain in `slaTargets.test.ts`.

#### Design decisions that differ from original plan

- `evaluateSlaFromMetrics` stays **private** (not exported); `evaluateSlaTree` uses it internally for both FG and scenario evaluation.
- `computeFeatureGroupMetrics` reuses `ScenarioMetrics` type, storing FG name in `scenarioName` field — avoids a parallel type.
- `SlaStatusAccordion` independently computes its own `SlaTree` (slight duplication vs `SlaCompactBar`) but keeps props clean: neither component needs a pre-computed tree from a parent.
- `skipFeatureLevel` optimization: when exactly one ungrouped feature node with no feature-level checks exists, scenarios render flat without an "Ungrouped" wrapper — the common case for non-grouped runs.
- `SlaCompactBar` empty bar uses `openEditorWithNewTarget` (pre-populate) while "Edit Targets" uses `openEditor` (copy existing). Separate code paths by design.

---

### Phase D Implementation Notes / Retrospective (2026-05-24)

**SLA-D1 — Already done in Phase C**
- `isReadOnly = scope === 'run' || scope === 'workflow-def'` was implemented during Phase C (SLA-C4). No additional code needed; only the plan status needed updating.

**SLA-D2 — Inline "✓ Saved" confirmation (SlaCompactBar)**
- Added `justSaved: boolean` state and `savedTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>` to `SlaCompactBar`.
- `handleSave`: after `onSaveTargets` resolves, sets `justSaved = true` and starts a 1.5 s auto-clear timer (previous timer cancelled via ref to avoid duplicate timers).
- Cleanup `useEffect` clears the timer on unmount to prevent state updates on unmounted components.
- In the actions area: `justSaved` → "✓ Saved" (`.sla-compact-saved`, green). While `justSaved = true`, the "Edit Targets" button is hidden. After 1.5 s it reappears.
- CSS: `.sla-compact-saved { font-size: 0.73rem; color: #4ade80; font-weight: 600; }` added to `base.css`.
- Files: `src/features/results/components/SlaCompactBar.tsx`, `src/styles/base.css`

**SLA-D3 — "⚗ Ad-hoc" scope badge (SlaCompactBar)**
- When `scope === null` and targets exist (ad-hoc targets set post-run in Results view), the scope badge now shows "⚗ Ad-hoc" instead of being absent.
- `scopeLabel` derived from `emptyScopeLabel ?? '⚗ Ad-hoc'` — clean and DRY (no duplicated label strings).
- CSS class: `sla-scope-${scope ?? 'adhoc'}` — evaluates to `sla-scope-adhoc` for null scope.
- CSS: `.sla-scope-adhoc { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); }` added alongside the other scope-badge variants.
- Design rationale: amber color signals "caution" — these targets won't travel with the next run of this test; they're ephemeral post-hoc annotations.
- Files: `src/features/results/components/SlaCompactBar.tsx`, `src/styles/base.css`

#### Bugs found and fixed during Phase D re-evaluation

**Bug D-R1 — `SlaCompactBar`: "＋ Add First Target" shown for read-only scopes in empty state**
- **Root cause**: The empty state branch (`targets.length === 0 && !editorOpen`) always rendered "＋ Add First Target" without checking `isReadOnly`. When `scope === 'run'` or `scope === 'workflow-def'`, users could click into the editor — the parent's `handleSaveSlaTargets` silently returned for read-only scopes, so saves were silently no-ops.
- **Fix**: Added `isReadOnly` check in empty state: when true, show "Read-only" label; when false, show "＋ Add First Target" button. This is also the correct defensive guard for `TestConfig.slaTargets = []` (a valid edge case).
- **File**: `src/features/results/components/SlaCompactBar.tsx`

**Bug D-R2 — `SlaCompactBar`: no scope badge in empty state for non-null scopes**
- **Root cause**: The empty state branch returned early before the `scopeLabel` / badge render. Users viewing a workflow-scoped (`scope='workflow'`) or run-scoped empty SLA panel saw no badge — inconsistent with the normal path which always shows a badge after D3.
- **Fix**: Extracted `emptyScopeLabel` (same label logic without the ad-hoc case) to a variable computed before all early returns. Empty state now renders `{emptyScopeLabel !== null && <span ...>}` in the bar. `scope === null` empty state intentionally shows no badge (no targets exist yet; nothing is ad-hoc yet). The `scopeLabel` in the main render path is now `emptyScopeLabel ?? '⚗ Ad-hoc'` — DRY, no duplicated strings.
- **File**: `src/features/results/components/SlaCompactBar.tsx`

**Stale comment — `ResultsDashboard.tsx` `handleSaveSlaTargets`**
- `setSlaScope(null)` was annotated `// per-run targets: no scope badge` — outdated after D3. Updated to `// per-run targets: shows '⚗ Ad-hoc' badge (SLA-D3)`.
- **File**: `src/features/results/ResultsDashboard.tsx`

---

### Phase E Implementation Notes / Retrospective

**SLA-E1 — Backward compatibility (superseded by CC-1/2/3 cleanup)**
- Legacy `sla-targets-wf-*` workflow localStorage fallback was removed in CC-1/2 cleanup (2026-05-25). `resolveTargetsForRun` now only reads embedded `config.slaTargets` and per-run ad-hoc `sla-targets-run-{id}`.

**SLA-E2 — "Migrate Now" inline migration button (removed in CC-3 cleanup 2026-05-25)**
- This entire feature was removed as part of CC-3 cleanup. The migration banner, `handleMigrateSlaTargets` callback, `slaMigrating` state, `removeKey`/`loadWorkflows`/`saveWorkflows` imports, and all `.sla-migration-banner*` CSS were deleted. Legacy workflow localStorage paths no longer exist, so migration is no longer needed.

**SLA-E3 — CLI `--sla-config` / `--fail-on-sla` options**
- Created `cli/slaEval.ts` — pure Node.js-safe evaluation with no browser/storage dependencies:
  - `loadSlaTargetFile(path)`: reads + parses + validates JSON SLA target array; auto-assigns `id` if missing; detailed error messages.
  - `evaluateCliSla(summary, results, targets)`: handles aggregate (TestSummary), per-scenario, and per-feature-group (RequestResult[] grouped) targets. Mirrors `slaTargets.ts` metric mapping and `computeScenarioMetrics` algorithm exactly (same percentile formula, TPS calculation, errorRate).
  - `overallSlaStatus(checks)`: fail > warn > no-data > pass priority.
  - `printSlaReport(checks, quiet)`: formatted table with pass/warn/fail icons; shows per-check actual vs. threshold; summary line with counts.
- Added to `cli/index.ts` `run` command:
  - `--sla-config <path>` option
  - `--fail-on-sla` flag (exit code 3 on violation)
  - SLA evaluation block runs after report writing, before exit code logic — so all reports are written even on SLA failure.
- Design decision: `--fail-on-sla` uses exit code **3** (distinct from 1=request failures, 2=CLI error) so CI pipelines can differentiate.
- Feature-group scoped CLI targets work the same as scenario targets (grouped by `result.featureGroupName`).
- Files: `cli/slaEval.ts` (new), `cli/index.ts`

---

## 4. Code Cleanup

> All cleanup items are either DONE or reclassified as NOT APPLICABLE. No outstanding tech debt remains.

---

### 4.1 Completed — Legacy Backward Compatibility Cleanup

> **Status: DONE** — All legacy workflow localStorage paths (`sla-targets-wf-*`), migration banner, and `scope='workflow'` code paths have been removed. The `loadRunSlaTargets` / `saveRunSlaTargets` functions are intentionally kept for ad-hoc post-run SLA editing (scope=null → ⚗ Ad-hoc badge). Completed 2026-05-25.

#### CC-1 — `scope='workflow'` legacy localStorage badge path (DONE)

Removed `'workflow'` from scope type unions in `SlaCompactBar`, `ResultsDashboard`, `slaTargets.ts`; deleted `.sla-scope-workflow` CSS; deleted `'🔗 Workflow SLA'` label branch. Replaced by `scope='workflow-def'` (definition-first; targets embedded in `TestConfig.slaTargets`).

#### CC-2 — `loadWorkflowSlaTargets` / `saveWorkflowSlaTargets` + simplify `resolveTargetsForRun` (DONE)

Deleted `SLA_TARGETS_WORKFLOW_KEY`, `loadWorkflowSlaTargets()`, `saveWorkflowSlaTargets()`. Simplified `resolveTargetsForRun` from 3-step (config → workflow localStorage → per-run) to 2-step (config → per-run ad-hoc → null). Kept `loadRunSlaTargets`/`saveRunSlaTargets` for ad-hoc editing. Updated all unit tests (102 pass).

#### CC-3 — `slaMigrationBanner` state + JSX in `ResultsDashboard.tsx` (DONE)

Deleted `slaMigrationBanner`/`slaMigrating` state, `handleMigrateSlaTargets` callback, migration banner JSX, all `.sla-migration-banner*` CSS (8 rules), and `removeKey`/`loadWorkflows`/`saveWorkflows` imports that were only used by the migration feature.

#### CC-4 — ~~Post-hoc `slaScope` / `slaTargets` state for ad-hoc editing~~ (NOT APPLICABLE)

Ad-hoc editing in Results view (`SlaCompactBar` → `handleSaveSlaTargets`) was intentionally kept during Phase C/D implementation. When `scope === null`, the "⚗ Ad-hoc" badge indicates post-run targets (SLA-D3). This is a design decision, not tech debt.

---

### 4.2 Completed — Phase C Cleanup

#### CC-5 — `SlaDashboard.tsx` full component (DONE)

Both `SlaDashboard.tsx` and `SlaDashboard.test.tsx` were deleted (2026-05-24). The `SlaDashboard` import was already removed from `ResultsDashboard.tsx` in Phase C-6. Replaced by `SlaCompactBar.tsx` + `SlaStatusAccordion.tsx`.

---

#### CC-6 — ~~`computeRunSlaStatus` async function~~ (NOT APPLICABLE)

`computeRunSlaStatus` is actively used by run-list SLA dots (🟢🟡🔴⚫) in `ResultsDashboard.tsx`. The function calls `resolveTargetsForRun` (async due to per-run ad-hoc localStorage lookup) and is needed for both embedded `config.slaTargets` and ad-hoc post-run targets. Not a cleanup candidate — this is active, tested functionality.

---

### 4.4 Cleanup Checklist

| ID | Item | Phase | Status |
|----|------|-------|--------|
| CC-0 | Verify `SlaDashboard.tsx` has no duplicated editor logic | Now | ✅ Done |
| CC-1 | Remove `scope='workflow'` legacy badge path | — | `DONE` — removed `'workflow'` from scope type unions in `SlaCompactBar`, `ResultsDashboard`, `slaTargets.ts`; deleted `.sla-scope-workflow` CSS; deleted `'🔗 Workflow SLA'` label branch. Completed 2026-05-25 |
| CC-2 | Delete `loadWorkflowSlaTargets`, `saveWorkflowSlaTargets`, simplify `resolveTargetsForRun` | — | `DONE` — deleted `SLA_TARGETS_WORKFLOW_KEY`, `loadWorkflowSlaTargets`, `saveWorkflowSlaTargets`; simplified `resolveTargetsForRun` to 2-step (embedded config → per-run ad-hoc → null); kept `loadRunSlaTargets`/`saveRunSlaTargets` for ad-hoc editing; updated all tests. Completed 2026-05-25 |
| CC-3 | Delete `slaMigrationBanner` state + detection logic + JSX + CSS | — | `DONE` — deleted `slaMigrationBanner`/`slaMigrating` state, `handleMigrateSlaTargets` callback, migration banner JSX, all `.sla-migration-banner*` CSS, removed `removeKey`/`loadWorkflows`/`saveWorkflows` imports used only by migration. Completed 2026-05-25 |
| CC-4 | ~~Delete `slaTargets` / `slaScope` / `slaStatusVersion` state + `handleSaveSlaTargets` from `ResultsDashboard.tsx`~~ | — | `NOT APPLICABLE` — ad-hoc editing in Results (scope=null → ⚗ Ad-hoc) was intentionally kept during Phase C/D. `handleSaveSlaTargets` is actively passed to `SlaCompactBar.onSaveTargets`. This is a design decision, not tech debt. |
| CC-5 | Delete `SlaDashboard.tsx` + `SlaDashboard.test.tsx` | C | `DONE` — both files deleted 2026-05-24; `SlaDashboard` import removed in C-6; replaced by `SlaCompactBar` + `SlaStatusAccordion` |
| CC-6 | ~~Delete `computeRunSlaStatus`~~ | — | `NOT APPLICABLE` — actively used by run-list SLA dots (🟢🟡🔴⚫). Calls `resolveTargetsForRun` (async for ad-hoc per-run lookup). Not a cleanup candidate. |

---

## 6. Phase F — SLA Override Modal UI Polish (2026-05-26) ✅ DONE

> **Motivation:** During visual review of the SLA Override modal (`RunnerSlaOverridePanel`), several UI/UX inconsistencies and polish opportunities were identified. This phase addresses them comprehensively.

### 6.1 Changes

| ID | Change | Files |
|----|--------|-------|
| SLA-F1 | **Sidebar toggle z-index fix** — `.usb-toggle-btn` raised to `z-index: 101` (above `.sla-modal-overlay` at 100) so sidebar can be collapsed/expanded even when the SLA Override modal is open. Default opacity raised from 0 → 0.45 for discoverability. | `src/styles/base.css` |
| SLA-F2 | **Title case consistency** — "Overrides for this run" → "Overrides for This Run" to match "Configured Targets" Title Case. Column headers "Fail if"/"Warn at" → "Fail If"/"Warn At" (CSS `text-transform: uppercase` renders both the same, but source code is now consistent). | `RunnerSlaOverridePanel.tsx` |
| SLA-F3 | **Inline "was X" hints** — Changed `<div class="sla-was-hint">` (block, forces new line) to `<span>` (inline). "was 500" now appears on the same line as the input value + unit. CSS updated: `margin-top: 2px` → `margin-left: 6px; white-space: nowrap; font-style: italic; opacity: 0.7`. | `RunnerSlaOverridePanel.tsx`, `base.css` |
| SLA-F4 | **Column width alignment** — Unified shared columns (Scope, Metric, Threshold, Warn) to identical widths across both tables. Upper: 200/170/130/100/auto/100. Lower: 6(bar)+194/170/130/100/36(del). The 6px bar column offset keeps visual alignment. | `base.css` |
| SLA-F5 | **Column header consistency** — Lower table headers renamed from "Fail If"/"Warn At" to "Threshold"/"Warn" to match the upper (Configured Targets) table. | `RunnerSlaOverridePanel.tsx` |
| SLA-F6 | **Professional modal polish** — Refined border-radius (8→10px), softer shadow, header gets subtle `background: rgba(0,0,0,0.08)`, consistent 24px horizontal padding. | `base.css` |
| SLA-F7 | **Row hover states** — Added `tr:hover { background: rgba(255,255,255,0.025) }` to both definition and override tables. Alternating row shading (`nth-child(even)`) on definitions table. | `base.css` |
| SLA-F8 | **Overrides section card** — Changed from `border-top` separator to a subtle card (border + background) so it visually peers with the Configured Targets toggle. | `base.css` |
| SLA-F9 | **Empty state** — Added `sla-overrides-empty` centered placeholder text when no overrides exist: "No overrides configured. Click 'Override' above or '+ Add Target' below." Removed the redundant hint text when empty state is visible. | `RunnerSlaOverridePanel.tsx`, `base.css` |
| SLA-F10 | **Footer dot indicators** — Added `::before` pseudo-element colored dots (●) on `.sla-footer-ovr` (amber) and `.sla-footer-new` (green) for visual consistency with the trigger bar's dot stats. | `base.css` |
| SLA-F11 | **"Overridden" badge** — Changed from raw text "Overridden ✓" to styled badge with `background`, `padding`, `border-radius`. Checkmark moved to CSS `::before` for cleaner rendering. | `RunnerSlaOverridePanel.tsx`, `base.css` |
| SLA-F12 | **Input focus glow** — Inputs and selects now show `box-shadow: 0 0 0 2px rgba(59,130,246,0.15)` on focus. Input padding increased (4→5px, 6→8px) for consistent height with selects. | `base.css` |
| SLA-F13 | **Delete button polish** — Hover now shows subtle red background (`rgba(248,113,113,0.08)`) instead of just a red border. Added `transition: all 0.12s` and `border-radius: 4px`. | `base.css` |
| SLA-F14 | **"+ Add Target" button** — Changed to dashed border that becomes solid blue on hover. Added `transition: all 0.12s`. Margin moved from inline `style={{ marginTop: 10 }}` to CSS class. | `RunnerSlaOverridePanel.tsx`, `base.css` |
| SLA-F15 | **Emoji cleanup** — Removed 📋 from "Configured Targets" section header and ✓ from "Overridden" text (now via CSS `::before`). Modal title changed from "🎯 SLA Override" to "SLA Override". Trigger bar keeps 🎯 (appropriate for compact UI). | `RunnerSlaOverridePanel.tsx` |
| SLA-F16 | **Dead code removal** — Removed unused `SlaLevel` type alias and `getLevel()` function from `RunnerSlaOverridePanel.tsx`. | `RunnerSlaOverridePanel.tsx` |

### 6.2 Bug Fixes

| ID | Bug | Fix |
|----|-----|-----|
| SLA-F-R1 | **CSS `\n` literal** — `.sla-add-btn:hover` rule was on the same line as `.sla-add-btn`, separated by a literal `\n` string instead of a newline. The hover rule was never being applied. | Split into proper separate CSS lines. |
| SLA-F-R2 | **Test assertions stale** — Two test expectations referenced `'Overridden ✓'` but the component now renders just `'Overridden'` (checkmark via CSS `::before`). Tests were failing. | Updated both assertions in `RunnerSlaOverridePanel.test.tsx`. |

### 6.3 Test Impact

- 28 RunnerSlaOverridePanel tests: all passing
- 235 SLA-specific tests (4 files): all passing
- 123 orchestration/runner tests (2 files): all passing
- 0 TypeScript errors codebase-wide

---

## 7. Phase G — Bug Fixes + Visual Validation (2026-05-28, `feature/trouble-shoot-sla`) 🔨 In Progress

### 7.1 Bug Fixes

#### SLA-G1 — `definitionTargets` prop missing from `WorkflowRunner.tsx`

**Symptom**: The "Configured Targets" section inside the SLA Override modal in Workflow Runner was always empty, even when the selected workflow had `slaTargets` defined.

**Root cause**: `WorkflowRunner.tsx` passed `definitionTargetCount` (a count integer from `selectedWorkflow.slaTargets?.length`) to `RunnerSlaOverridePanel`, but did NOT pass `definitionTargets` (the actual array). The modal's table had no rows to render.

**Compare**: `RunnerPage.tsx` (the standalone Test Runner) was already correct — it built `definitionSlaTargets` via `useRunnerOrchestration` and passed it through the prop chain.

**Fix**: Added `workflowDefinitionTargets` useMemo in `WorkflowRunner.tsx` that maps `selectedWorkflow.slaTargets` with a `scopeLabel` field, then passes it as `definitionTargets={workflowDefinitionTargets}` to `RunnerSlaOverridePanel`.

```tsx
const workflowDefinitionTargets = useMemo(
  () => (selectedWorkflow?.slaTargets ?? []).map((t) => ({
    ...t,
    scopeLabel: t.scenarioName ? `Test: ${t.scenarioName}` : 'Aggregate',
  })),
  [selectedWorkflow?.slaTargets],
);
// ...
<RunnerSlaOverridePanel
  definitionTargets={workflowDefinitionTargets}  // ← was missing
  definitionTargetCount={selectedWorkflow.slaTargets?.length ?? 0}
  // ...
/>
```

**File**: `src/features/test-runner/WorkflowRunner.tsx`

---

#### SLA-G2 — `workflowDefinitionTargets` useMemo placed before `selectedWorkflow` declaration

**Symptom**: Immediately after the SLA-G1 fix was applied, the Workflow Runner crashed on load with:
```
ReferenceError: Cannot access 'selectedWorkflow' before initialization
  at WorkflowRunner (WorkflowRunner.tsx:34)
```

**Root cause**: The new `workflowDefinitionTargets` useMemo (which references `selectedWorkflow`) was placed *before* the `const selectedWorkflow = ...` declaration in the component body. JavaScript `const` declarations are not hoisted, so the temporal dead zone caused the crash.

**Fix**: Reordered the declarations so `selectedWorkflow` is declared first, then `workflowDefinitionTargets` useMemo follows it.

```tsx
// BEFORE (crash):
const workflowDefinitionTargets = useMemo(
  () => (selectedWorkflow?.slaTargets ?? []).map(...),  // ← selectedWorkflow not yet declared
  [selectedWorkflow?.slaTargets],
);
const selectedWorkflow = workflows.find(...);  // declared here

// AFTER (fixed):
const selectedWorkflow = workflows.find(...);  // declared first
const workflowDefinitionTargets = useMemo(    // references selectedWorkflow safely
  () => (selectedWorkflow?.slaTargets ?? []).map(...),
  [selectedWorkflow?.slaTargets],
);
```

**File**: `src/features/test-runner/WorkflowRunner.tsx`

---

### 7.2 Test Data Files Created

Two synthetic test data files were created for visual validation without requiring a live run:

| File | Purpose |
|------|---------|
| `test-data/workflow-sla-run-result.json` | Synthetic `TestRun` with `config.workflowId = "wf-sla-sample-001"` and 4 `config.slaTargets`. Imports into Results and shows the **"📋 Workflow"** badge. Has 1 failing target (GET /users P95 350ms > 200ms threshold), 1 warning, 2 passing for meaningful visual state. |
| `test-data/workflow-sla-export.json` | Workflow export JSON with 2-node canvas (GET /users → POST /posts) and 4 `slaTargets` at root. Import via Workflow Designer → **+ New → Import Workflow** for Scenario 38 parts 2, 5. |

**Workflow SLA targets in both files** (4 targets):

| # | Metric | Op | Fail | Warn | Scope | Label |
|---|--------|-----|------|------|-------|-------|
| 1 | P95 | ≤ | 2000ms | — | Aggregate | Overall P95 |
| 2 | P95 | ≤ | 200ms | 300ms | GET /users | Get Users P95 |
| 3 | Error Rate | ≤ | 1% | — | GET /users | Get Users Error Rate |
| 4 | P95 | ≤ | 1500ms | 1000ms | POST /posts | Create Post P95 |

### 7.3 Visual Validation Results (2026-05-28)

All three Workflow SLA entry points visually confirmed working on `feature/trouble-shoot-sla`:

| View | What was checked | Status |
|------|-----------------|--------|
| **Workflow Designer — SLA Targets panel** | Imported `workflow-sla-export.json` → expanded SLA Targets panel → showed count badge **4** and all 4 target rows with correct metric/threshold/warn/scope | ✅ Confirmed |
| **Workflow Runner — SLA Override modal** | "Run in Harness" from Designer pre-selected workflow → trigger bar showed **"● 4 configured"** → opened Configure modal → "Configured Targets (4)" table showed all 4 definition rows with correct scope labels (`Aggregate`, `Test: GET /users`, `Test: POST /posts`) | ✅ Confirmed (SLA-G1 fix validated) |
| **Results — Workflow run import** | Imported `workflow-sla-run-result.json` → compact bar showed **"📋 Workflow"** badge + **"⚠ 1 Failing"** pill + **"Read-only"** → SLA Status tab showed full check tree: 1 failing (Get Users P95 350ms > 200ms), 1 warning, 2 passing | ✅ Confirmed |
