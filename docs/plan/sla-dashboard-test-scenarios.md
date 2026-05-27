# SLA Dashboard — Test Scenarios for Manual & Visual Verification

> Feature: SLA Dashboard — Per-test SLA targets, results SLA compact bar, SLA status accordion, CLI import
> Phases: 1–5 (original), A–E (scoped SLA), B10–B16 (per-test SLA), C–D (results display refactor), §5 (CLI import)
> Branch: `feature/review-plan`
> Plan: `docs/plan/sla-dashboard-plan.md`
> Test data: `docs/test-data/sla-dashboard-test-data.json`, `docs/test-data/sla-per-test-scenarios-export.json`, `test-data/cli-sample-run.json`

---

## Files Changed (Summary)

| File | Phase | Changes |
|------|-------|---------|
| `src/shared/types/index.ts` | B1, B2, B10, C1 | Added `slaTargets?: SlaTarget[]` to `Scenario`, `TestScenario`, `FeatureGroup`; added `featureGroupName?: string` to `SlaTarget` |
| `src/features/scenarios/hooks/useScenarioMutations.ts` | B3, B11 | `updateScenarioSlaTargets`, `updateFeatureGroupSlaTargets`, `updateTestSlaTargets` |
| `src/features/scenarios/components/TestSlaModal.tsx` | B12 | Created — per-test SLA editor modal using `AppModalFrame` |
| `src/features/scenarios/components/ScenarioSlaPanel.tsx` | B13 | Rewritten — read-only SLA summary table |
| `src/features/scenarios/ScenarioBuilder.tsx` | B14 | 🎯 button per test card, SLA modal integration, summary panel |
| `src/features/test-runner/hooks/useRunnerOrchestration.ts` | B5, B15 | Auto-collect FG + scenario + test-level SLA targets; merge with runner overrides |
| `src/features/test-runner/components/RunnerPage.tsx` | B6 | `RunnerSlaOverridePanel` — optional SLA override for env-specific thresholds |
| `src/features/results/components/SlaCompactBar.tsx` | C4 | Compact one-line SLA bar with status pill, scope badge, inline editor |
| `src/features/results/components/SlaStatusAccordion.tsx` | C5 | Expandable Feature→Scenario→Check tree with traffic light dots |
| `src/features/results/components/SlaTargetEditor.tsx` | C2 | Scope column (Aggregate/Scenario/Feature Group) + name dropdown |
| `src/features/results/ResultsDashboard.tsx` | C6 | `SlaCompactBar` at top + `SlaStatusAccordion` after timing |
| `src/features/results/utils/slaTargets.ts` | A, C3 | `evaluateSlaTree`, `computeFeatureGroupMetrics`, `SlaTree` types |
| `src/styles/base.css` | B7, B16, C7, F | All SLA CSS: `.scenario-sla-panel`, `.sla-summary-table`, `.btn-sla-active`, `.sla-compact-bar`, `.sla-status-accordion`, `.sla-tree-*`, SLA override modal polish (hover states, column widths, input focus, badge styles, empty state, footer dots) |
| `src/features/test-runner/components/RunnerSlaOverridePanel.tsx` | B6, F | SLA Override panel for test runner + Phase F UI polish (Title Case, inline hints, emoji cleanup, styled badges, empty state, dead code removal) |
| `src/features/test-runner/components/RunnerSlaOverridePanel.test.tsx` | F | Updated assertions: "Overridden ✓" → "Overridden" (checkmark now via CSS) |
| `src/features/workflow/components/WorkflowDesignerMainLayout.tsx` | B8 | Workflow-level SLA in designer (primary) |
| `src/features/test-runner/WorkflowRunner.tsx` | B9 | `RunnerSlaOverridePanel` — override-only for workflow runs |
| `cli/slaEval.ts` | E3 | CLI `--sla-config` / `--fail-on-sla` flags |
| `cli/index.ts` | §5.1 | Embed `config.slaTargets` in CLI JSON output when `--sla-config` is used |
| `src/features/results/utils/importRun.ts` | §5.3 | New: `validateImportedRun()` — validates and normalizes imported CLI JSON |
| `src/features/results/ResultsDashboard.tsx` | §5.2 | "📥 Import Test Results" button + handler in both empty and non-empty states |
| `src/shared/utils/storage.ts` | §5 (bugfix) | Defensive `responseBody ?? ''` in `capAndTruncateResults` |

---

## Test Data Setup

Before running these tests, import the test data file:

1. Locate the file in the repository: `docs/test-data/sla-per-test-scenarios-export.json`
2. Open RedfireForge and click the **Harness** icon in the vertical activity bar on the far left (tooltip: "Harness") — this opens the **Scenario Builder**
3. In the **Service** and **Environment** dropdowns at the top, select any service and environment — the Import button is disabled until both are chosen
4. In the **Feature Groups** section header, click the **Import** button (top-right of the header bar, to the left of the Export button)
   > **Note**: Use the **top-level Import** button (not per-group or per-scenario)
5. In the file picker dialog, select `sla-per-test-scenarios-export.json`
6. Verify that the **"SLA Test Suite"** feature group appears in the list with 3 scenarios:
   - "API Health Checks" (3 tests — 2 with SLA, 1 without)
   - "CRUD Operations" (3 tests — 2 with SLA, 1 without)
   - "No SLA Baseline" (2 tests — none with SLA)

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Phase | Scenario | Pass? | Notes |
|---|-------|----------|-------|-------|
| 1 | B10 | [Per-Test SLA — Type Persistence](#test-scenario-1-per-test-sla--type-persistence) | [ ] | |
| 2 | B12 | [TestSlaModal — Add SLA via 🎯 Button](#test-scenario-2-testslamodal--add-sla-via--button) | [ ] | |
| 3 | B12 | [TestSlaModal — Edit Existing SLA Targets](#test-scenario-3-testslamodal--edit-existing-sla-targets) | [ ] | |
| 4 | B12 | [TestSlaModal — Remove SLA Target](#test-scenario-4-testslamodal--remove-sla-target) | [ ] | |
| 5 | B12 | [TestSlaModal — Validation Errors](#test-scenario-5-testslamodal--validation-errors) | [ ] | |
| 6 | B13 | [ScenarioSlaPanel — Summary Table Display](#test-scenario-6-scenarioslavpanel--summary-table-display) | [ ] | |
| 7 | B14 | [🎯 Button — Active State & Count Badge](#test-scenario-7--button--active-state--count-badge) | [ ] | |
| 8 | B14 | [Scenario Header — Aggregate SLA Badge](#test-scenario-8-scenario-header--aggregate-sla-badge) | [ ] | |
| 9 | B15 | [Runner — Auto-Collect Test-Level SLA Targets](#test-scenario-9-runner--auto-collect-test-level-sla-targets) | [ ] | |
| 10 | B6 | [Runner — SLA Override Panel](#test-scenario-10-runner--sla-override-panel) | [ ] | |
| 11 | C4 | [Results — SlaCompactBar Display](#test-scenario-11-results--slacompactbar-display) | [ ] | |
| 12 | C5 | [Results — SlaStatusAccordion Tree](#test-scenario-12-results--slastatusaccordion-tree) | [ ] | |
| 13 | C4 | [Results — Scope Badge Variants](#test-scenario-13-results--scope-badge-variants) | [ ] | |
| 14 | C4 | [Results — Ad-hoc SLA Editor in CompactBar](#test-scenario-14-results--ad-hoc-sla-editor-in-compactbar) | [ ] | |
| 15 | C5 | [Results — Accordion Auto-Open on Failure](#test-scenario-15-results--accordion-auto-open-on-failure) | [ ] | |
| 16 | D2 | [Results — Save Confirmation Flash](#test-scenario-16-results--save-confirmation-flash) | [ ] | |
| 17 | E2 | [~~Migration Banner — Legacy Workflow SLA~~](#test-scenario-17-migration-banner--legacy-workflow-sla) | [N/A] | Removed in CC-3 cleanup |
| 18 | All | [Export/Import — SLA Targets Preserved](#test-scenario-18-exportimport--sla-targets-preserved) | [ ] | |
| 19 | All | [End-to-End — Run with Per-Test SLA](#test-scenario-19-end-to-end--run-with-per-test-sla) | [ ] | |
| 20 | All | [Unit Test Suite — Full Pass](#test-scenario-20-unit-test-suite--full-pass) | [ ] | |
| 21 | All | [TypeScript — Zero Errors](#test-scenario-21-typescript--zero-errors) | [ ] | |
| 22 | All | [Tauri Desktop — Visual Parity](#test-scenario-22-tauri-desktop--visual-parity) | [ ] | |
| 23 | §5 | [Import CLI Run — Happy Path](#test-scenario-23-import-cli-run--happy-path) | [ ] | |
| 24 | §5 | [Import CLI Run — SLA Targets Display](#test-scenario-24-import-cli-run--sla-targets-display) | [ ] | |
| 25 | §5 | [Import CLI Run — Invalid File Rejection](#test-scenario-25-import-cli-run--invalid-file-rejection) | [ ] | |
| 26 | §5 | [Import CLI Run — Missing Fields Normalization](#test-scenario-26-import-cli-run--missing-fields-normalization) | [ ] | |
| 27 | V | [Visual — SLA Status States (Pass/Fail/Warn/No-Data/Mixed)](#test-scenario-27-visual--sla-status-states) | [ ] | |
| 28 | V | [Visual — Editor Add/Modify/Delete Targets](#test-scenario-28-visual--editor-addmodifydelete-targets) | [ ] | |
| 29 | V | [Visual — Collapse/Expand Panel & Dark Theme](#test-scenario-29-visual--collapseexpand-panel--dark-theme) | [ ] | |
| 30 | V | [Visual — Per-Scenario SLA (SlaTestTable)](#test-scenario-30-visual--per-scenario-sla-slatesttable) | [ ] | |
| 31 | V | [Visual — Workflow-Scoped & Embedded Run-Level SLA](#test-scenario-31-visual--workflow-scoped--embedded-run-level-sla) | [ ] | |
| 32 | V | [Visual — Run List SLA Status Dots](#test-scenario-32-visual--run-list-sla-status-dots) | [ ] | |
| 33 | V | [Visual — Multi-Run Workflow Shared SLA](#test-scenario-33-visual--multi-run-workflow-shared-sla) | [ ] | |
| 34 | F | [SLA Override Modal — Professional Layout](#test-scenario-34-sla-override-modal--professional-layout) | [ ] | |
| 35 | F | [SLA Override Modal — Overrides Section Polish](#test-scenario-35-sla-override-modal--overrides-section-polish) | [ ] | |
| 36 | F | [SLA Override Modal — Input & Button Polish](#test-scenario-36-sla-override-modal--input--button-polish) | [ ] | |
| 37 | F | [Sidebar Toggle — Accessible with SLA Modal Open](#test-scenario-37-sidebar-toggle--accessible-with-sla-modal-open) | [ ] | |

---

## Navigation Reference

### Opening the Scenario Builder

1. On the far-left vertical activity bar, click the **Harness** button (icon: rectangle with chevron; tooltip "Harness").
2. A secondary top navigation strip appears. The first tab, **Scenarios**, is the Scenario Builder. Click it if it is not already active.
3. At the top of the Scenario Builder, select a **Service** and an **Environment** from the two dropdowns. Many controls (Import, + Add Test) are disabled until both are chosen.

### Opening the Test Runner

1. Click the **Harness** button in the vertical activity bar.
2. In the secondary top navigation strip, click **Test Runner**. This shows only `standard` scenarios.
3. *(Alternative)* Click **Parameterized Runner** to see only `parameterized` scenarios.

### Opening the Results Dashboard

1. Click the **Harness** button in the vertical activity bar.
2. In the secondary top navigation strip, click **Results**.

---

## Phase B — Per-Test SLA Definition (SLA-B10–B16)

### Test Scenario 1: Per-Test SLA — Type Persistence

**Purpose**: Verify that `Scenario.slaTargets` is correctly stored in IndexedDB and survives page reload.

**Files**: `src/shared/types/index.ts`

#### Prerequisite

Complete the **Test Data Setup** section so that "SLA Test Suite" exists.

#### Steps

1. Open the app in Google Chrome or Chromium-based browser.
2. Press **F12** → open Chrome DevTools.
3. Click the **Application** tab in DevTools.
4. In the left sidebar under **Storage**, expand **IndexedDB** → expand the `redfireforge` database → click **featureGroups**.
5. Find the **"SLA Test Suite"** feature group and inspect its record.
6. Drill into `scenarios[0]` ("API Health Checks") → `tests[0]` ("Get Users").
7. Confirm the `slaTargets` field is present with 2 entries:
   - `{ metric: "p95", operator: "lte", value: 500, warnAt: 400, label: "Users P95" }`
   - `{ metric: "errorRate", operator: "lte", value: 1.0, label: "Users Error Rate" }`
8. Check `scenarios[0].tests[2]` ("Get Comments") — should have **no** `slaTargets` field.
9. Close DevTools, reload the page (**Cmd+R**), re-open DevTools and repeat steps 6–8.

#### Expected Outcomes

- [ ] `slaTargets` property exists on `Scenario` objects that have SLA defined
- [ ] SLA targets match the imported values (metric, operator, value, warnAt, label)
- [ ] Tests without SLA have no `slaTargets` key (not an empty array)
- [ ] Data persists after page reload

---

### Test Scenario 2: TestSlaModal — Add SLA via 🎯 Button

**Purpose**: Verify that clicking the 🎯 button on a test card opens the TestSlaModal and allows adding SLA targets.

**Files**: `src/features/scenarios/components/TestSlaModal.tsx`, `src/features/scenarios/ScenarioBuilder.tsx`

#### Prerequisite

You are in the **Scenario Builder** with "SLA Test Suite" visible.

#### Steps

1. Expand the **"No SLA Baseline"** scenario (click to toggle).
2. Find the test row for **"Get Albums"**. At the left of the test actions (before Edit), look for the 🎯 button.
3. Click the 🎯 button.
4. **Verify**: A modal opens with title "🎯 SLA Targets — Get Albums".
5. **Verify**: The modal body shows "No SLA targets yet. Click **+ Add Target** to define acceptance criteria for this test."
6. Click **+ Add Target**.
7. **Verify**: A new row appears with columns: Metric (P95 Response Time), Op (≤), Fail at (500), warn →, Warn at (—), Label (optional), ✕.
8. Change the Metric to "Error Rate".
9. **Verify**: The operator auto-changes to ≤ (stays the same for Error Rate).
10. Set Fail at to `2`.
11. Click **Save**.
12. **Verify**: The modal closes. The 🎯 button for "Get Albums" now shows `🎯 1` with an amber highlight background.

#### Expected Outcomes

- [ ] 🎯 button is visible on every test card row
- [ ] Modal opens with correct test name in title
- [ ] Empty state message is shown when no targets exist
- [ ] "+ Add Target" adds a row with P95 default
- [ ] Changing metric auto-adjusts the default operator
- [ ] Save closes modal and updates the button state (amber highlight + count badge)

---

### Test Scenario 3: TestSlaModal — Edit Existing SLA Targets

**Purpose**: Verify editing pre-existing SLA targets on an imported test.

**Files**: `src/features/scenarios/components/TestSlaModal.tsx`

#### Prerequisite

"SLA Test Suite" is imported; "API Health Checks" → "Get Users" has 2 SLA targets.

#### Steps

1. Expand the **"API Health Checks"** scenario.
2. Find **"Get Users"** test row. The 🎯 button should show `🎯 2` with amber highlight.
3. Click the 🎯 button.
4. **Verify**: Modal opens showing 2 rows:
   - Row 1: P95 Response Time, ≤, 500 ms, warn → 400 ms, "Users P95"
   - Row 2: Error Rate, ≤, 1 %, warn → —, "Users Error Rate"
5. Change row 1 Fail at from `500` to `300`.
6. Set row 2 Warn at to `0.5`.
7. Click **Save**.
8. Re-open the modal (click 🎯 again).
9. **Verify**: Row 1 shows Fail at = 300, Row 2 shows Warn at = 0.5%.

#### Expected Outcomes

- [ ] Pre-existing SLA targets are loaded into the editor
- [ ] Values can be modified (Fail at, Warn at, Label)
- [ ] Changes persist after saving and re-opening the modal
- [ ] Count badge still shows `🎯 2` after edit (no targets added/removed)

---

### Test Scenario 4: TestSlaModal — Remove SLA Target

**Purpose**: Verify removing an SLA target row from a test.

**Files**: `src/features/scenarios/components/TestSlaModal.tsx`

#### Prerequisite

A test with at least 2 SLA targets (e.g., "Get Users" with 2 targets).

#### Steps

1. Click the 🎯 button on **"Get Users"**.
2. Click the **✕** (delete) button on the second row (Error Rate).
3. **Verify**: Only 1 row remains (P95 Response Time).
4. Click **Save**.
5. **Verify**: The 🎯 button now shows `🎯 1`.
6. Re-open the modal.
7. **Verify**: Only the P95 target is shown.

#### Expected Outcomes

- [ ] ✕ button removes the target row from the editor
- [ ] Saving with a removed row persists the deletion
- [ ] Count badge updates to reflect the remaining count
- [ ] Removing all targets: 🎯 button loses the amber highlight and count badge

---

### Test Scenario 5: TestSlaModal — Validation Errors

**Purpose**: Verify that invalid values show error messages and block saving.

**Files**: `src/features/scenarios/components/TestSlaModal.tsx`

#### Prerequisite

A test with at least 1 SLA target, or add one via "+ Add Target".

#### Steps

1. Open TestSlaModal on any test (click 🎯).
2. If empty, click "+ Add Target" to add a row.
3. Clear the "Fail at" field (set to empty or 0).
4. **Verify**: An error message appears below the input (e.g., "Must be > 0").
5. Set Fail at to `500`. Set Warn at to `600` (warn > fail for `lte` operator).
6. **Verify**: An error message appears for Warn at (e.g., "Warn must be ≤ fail").
7. **Verify**: The **Save** button is disabled (grayed out, not clickable).
8. Fix the values (set Warn at to `400`).
9. **Verify**: Error messages disappear. Save button is re-enabled.

#### Expected Outcomes

- [ ] Fail at = 0 or empty shows validation error
- [ ] Warn threshold violating operator direction shows validation error
- [ ] Save button is disabled when any row has errors
- [ ] Fixing values clears errors and re-enables Save

---

### Test Scenario 6: ScenarioSlaPanel — Summary Table Display

**Purpose**: Verify the read-only SLA summary table under each scenario.

**Files**: `src/features/scenarios/components/ScenarioSlaPanel.tsx`

#### Prerequisite

"SLA Test Suite" imported with SLA targets on "API Health Checks" (3 targets across 2 tests) and "CRUD Operations" (4 targets across 2 tests).

#### Steps

1. Expand the **"API Health Checks"** scenario.
2. Scroll to the bottom of the test list.
3. **Verify**: A collapsible panel appears: **"🎯 SLA Summary"** with a count badge (3) and hint text "2 tests with SLA targets".
4. Click the panel header to expand it.
5. **Verify**: A table appears with columns: Test, Metric, Op, Fail at, Warn at, Label.
6. **Verify table content**:
   - Row 1: `GET` Get Users | P95 Response Time | ≤ | 500ms | 400ms | Users P95
   - Row 2: (rowSpan) | Error Rate | ≤ | 1% | — | Users Error Rate
   - Row 3: `GET` Get Posts | P95 Response Time | ≤ | 800ms | — | Posts P95
7. **Verify**: "Get Comments" (no SLA) does NOT appear in the summary table.
8. Click any row in the table.
9. **Verify**: TestSlaModal opens for that test.
10. Expand **"No SLA Baseline"** scenario.
11. **Verify**: No SLA Summary panel appears (returns null when no tests have SLA).

#### Expected Outcomes

- [ ] SLA Summary panel appears only when at least one test has SLA targets
- [ ] Count badge shows total target count across all tests
- [ ] Hint text shows count of tests with SLA
- [ ] Table uses `rowSpan` for tests with multiple targets
- [ ] Method badge (GET/POST/etc.) appears before test name
- [ ] Tests without SLA targets are excluded from the table
- [ ] Clicking a row opens TestSlaModal for that test
- [ ] Collapsing/expanding the panel works (▼/▲ chevron toggles)

---

### Test Scenario 7: 🎯 Button — Active State & Count Badge

**Purpose**: Verify visual indicators on the 🎯 button per test.

**Files**: `src/features/scenarios/ScenarioBuilder.tsx`, `src/styles/base.css`

#### Prerequisite

"SLA Test Suite" imported with mixed SLA states.

#### Steps

1. Expand **"API Health Checks"** scenario.
2. Check the 🎯 button for each test:
   - **"Get Users"**: Should show `🎯 2` with amber background (`.btn-sla-active`)
   - **"Get Posts"**: Should show `🎯 1` with amber background
   - **"Get Comments"**: Should show `🎯` with no count, no amber highlight (default button style)
3. Expand **"No SLA Baseline"** scenario.
4. Check both test rows: all 🎯 buttons should be plain (no amber, no count).

#### Expected Outcomes

- [ ] Tests with SLA targets show `🎯 N` with amber background
- [ ] Tests without SLA targets show plain `🎯` with no count
- [ ] Count badge accurately reflects the number of SLA targets on each test
- [ ] Amber highlight uses `.btn-sla-active` class

---

### Test Scenario 8: Scenario Header — Aggregate SLA Badge

**Purpose**: Verify the scenario header shows aggregated SLA target count.

**Files**: `src/features/scenarios/ScenarioBuilder.tsx`

#### Steps

1. Look at the **"API Health Checks"** scenario header row (gray bar).
2. **Verify**: A badge shows `🎯 3 SLA` (total of 2 + 1 = 3 targets from Get Users + Get Posts).
3. Look at the **"CRUD Operations"** scenario header.
4. **Verify**: Badge shows `🎯 4 SLA` (3 from Create Post + 1 from Update Post).
5. Look at the **"No SLA Baseline"** scenario header.
6. **Verify**: No SLA badge is shown (no tests have SLA targets).

#### Expected Outcomes

- [ ] Scenario header aggregates SLA target counts from all tests in the scenario
- [ ] Badge format: `🎯 N SLA`
- [ ] Scenarios with zero test-level SLA targets show no badge
- [ ] Badge updates dynamically when SLA targets are added/removed from tests

---

### Test Scenario 9: Runner — Auto-Collect Test-Level SLA Targets

**Purpose**: Verify the Test Runner automatically collects SLA targets from selected test definitions at run time.

**Files**: `src/features/test-runner/hooks/useRunnerOrchestration.ts`

#### Prerequisite

"SLA Test Suite" imported. You need at least one reachable URL — `jsonplaceholder.typicode.com` should work.

#### Steps

1. Navigate to **Test Runner** (Harness → Test Runner tab).
2. Select the **"API Health Checks"** scenario by checking its checkbox.
3. Select the **"CRUD Operations"** scenario as well.
4. Leave **"No SLA Baseline"** unchecked.
5. Set **Iterations** to 1, **Concurrency** to 1.
6. Click **▶ Run Tests**.
7. Wait for the run to complete.
8. Navigate to **Results** (Harness → Results tab).
9. In the run selector, select the most recent run.
10. **Verify**: The `SlaCompactBar` at the top shows SLA evaluation results.
11. Open Chrome DevTools → **Application** → **IndexedDB** → `redfireforge` → **runs**.
12. Find the most recent run. Expand `config.slaTargets`.
13. **Verify**: The `slaTargets` array contains targets from both "API Health Checks" tests and "CRUD Operations" tests:
    - `{ metric: "p95", scenarioName: "Get Users", value: 500, ... }`
    - `{ metric: "errorRate", scenarioName: "Get Users", value: 1.0, ... }`
    - `{ metric: "p95", scenarioName: "Get Posts", value: 800, ... }`
    - `{ metric: "p95", scenarioName: "Create Post", value: 1000, ... }`
    - `{ metric: "tps", scenarioName: "Create Post", value: 10, ... }`
    - `{ metric: "errorRate", scenarioName: "Create Post", value: 2.0, ... }`
    - `{ metric: "avg", scenarioName: "Update Post", value: 600, ... }`
14. **Verify**: Tests without SLA (Get Comments, Delete Post) have NO entries in `slaTargets`.

#### Expected Outcomes

- [ ] Test-level SLA targets are auto-collected into `config.slaTargets` at run time
- [ ] Each target has `scenarioName` set to the test name (not the scenario group name)
- [ ] Tests without SLA targets produce no entries
- [ ] Unselected scenarios ("No SLA Baseline") contribute nothing

---

### Test Scenario 10: Runner — SLA Override Panel

**Purpose**: Verify the optional SLA Override panel in the Test Runner, including Phase F UI polish.

**Files**: `src/features/test-runner/components/RunnerSlaOverridePanel.tsx`, `src/features/test-runner/components/RunnerPage.tsx`

#### Steps

1. Navigate to **Test Runner**.
2. Look for a collapsible section labeled **"SLA Override"** with a 🎯 trigger bar, below the weights fieldset and before the Run button.
3. Click the trigger bar to expand the override modal.
4. **Verify**: Modal title reads **"SLA Override"** (no emoji prefix).
5. **Verify**: Upper section toggle reads **"Configured Targets"** (no emoji prefix).
6. **Verify**: Upper table columns: Scope | Metric | Threshold | Warn | Label | Action.
7. Click **"Override"** on a target row (e.g., Error Rate for "Get Users").
8. **Verify**: The "Override" button changes to a styled **"Overridden"** badge (checkmark ✓ rendered via CSS `::before`, not text).
9. **Verify**: Lower section header reads **"Overrides for This Run"** (Title Case).
10. **Verify**: Lower table columns: (bar) | Scope | Metric | Threshold | Warn | (delete).
11. **Verify**: Column widths are aligned between upper and lower tables.
12. Modify the override value and check the "was X" hint.
13. **Verify**: The "was X" hint appears **inline** (same line as the input), not on a new line.
14. When no overrides exist, **verify**: an empty state message appears: "No overrides configured. Click 'Override' above or '+ Add Target' below."
15. Run the test.
16. Navigate to **Results** and inspect the run's `config.slaTargets` in IndexedDB.
17. **Verify**: The override target **replaces** the definition target on `metric + scenarioName` conflict.
18. Other targets from the definitions remain unchanged.

#### Expected Outcomes

- [ ] SLA Override panel opens via 🎯 trigger bar in the Test Runner
- [ ] Modal title: "SLA Override" (no emoji)
- [ ] Section headers use Title Case: "Configured Targets", "Overrides for This Run"
- [ ] Column headers match between tables: Threshold / Warn (not Fail If / Warn At)
- [ ] Column widths are visually aligned between upper and lower tables
- [ ] "Overridden" badge shows checkmark via CSS (not text ✓)
- [ ] "was X" hint is inline (not a new line)
- [ ] Empty state shown when no overrides configured
- [ ] Override targets merge with definition targets
- [ ] On `metric + scenarioName` conflict, the runner override wins
- [ ] Override targets are session-only (not persisted to the test definition)

---

## Phase C — Results SLA Display

### Test Scenario 11: Results — SlaCompactBar Display

**Purpose**: Verify the compact SLA bar at the top of the Results Dashboard.

**Files**: `src/features/results/components/SlaCompactBar.tsx`, `src/features/results/ResultsDashboard.tsx`

#### Prerequisite

At least one completed test run with SLA targets (see Scenario 9).

#### Steps

1. Navigate to **Results** (Harness → Results tab).
2. Select the run from Scenario 9 in the run selector dropdown.
3. **Verify**: At the top of the dashboard, a compact bar appears with:
   - A status pill: ✓ (green for all passing) or ⚠ (red/amber for violations/warnings)
   - A scope badge (e.g., "🔒 This Run" or "⚗ Ad-hoc")
   - Detail text: "All N SLA targets passing" or "N violations — M warnings — K passing"
   - An "Edit Targets" button (if not read-only scope)
4. **Verify**: The compact bar is a single horizontal line (not a full panel).

#### Expected Outcomes

- [ ] Compact bar is visible at top of Results
- [ ] Status pill reflects overall SLA status (green for pass, red for fail, amber for warn)
- [ ] Scope badge is shown (see Scenario 13 for variants)
- [ ] Detail text accurately summarizes target counts by status
- [ ] "Edit Targets" button is visible for editable scopes

---

### Test Scenario 12: Results — SlaStatusAccordion Tree

**Purpose**: Verify the expandable SLA status accordion between timing breakdown and request details.

**Files**: `src/features/results/components/SlaStatusAccordion.tsx`

#### Prerequisite

A completed run with SLA targets from multiple tests.

#### Steps

1. Navigate to **Results** and select a run with SLA targets.
2. Scroll down past the Timing Breakdown section.
3. **Verify**: An "SLA Status" accordion section appears between Timing Breakdown and Request Details.
4. Click the accordion header to expand it (if not auto-expanded).
5. **Verify**: A tree structure shows:
   - **Scenario level**: Each test that has SLA targets appears with a traffic light dot (🟢/🟡/🔴/⚫).
   - **Check level**: Under each scenario, individual checks show metric name, actual value, target value.
6. **Verify check details** (example for "Get Users"):
   - `🟢 Users P95 — 123.4ms — ≤ 500ms` (if passing)
   - `🟢 Users Error Rate — 0.0% — ≤ 1%` (if passing)
7. For tests without SLA: **Verify** they do NOT appear in the accordion.

#### Expected Outcomes

- [ ] SLA Status accordion appears between Timing and Request Details
- [ ] Tree shows scenario → check hierarchy
- [ ] Traffic light dots: 🟢 pass, 🟡 warn, 🔴 fail, ⚫ no-data
- [ ] Each check shows: label, actual value, target value
- [ ] Tests without SLA targets are excluded
- [ ] `skipFeatureLevel` optimization: when all scenarios are ungrouped, no "Ungrouped" wrapper

---

### Test Scenario 13: Results — Scope Badge Variants

**Purpose**: Verify all scope badge variants render correctly.

**Files**: `src/features/results/components/SlaCompactBar.tsx`

#### Steps

1. **Run-scoped** (`scope='run'`): Run a test from the Test Runner (non-workflow). Check Results.
   - **Verify**: Badge shows "🔒 This Run" with blue tint.
   - **Verify**: "Edit Targets" is hidden (read-only for embedded run config).
2. **Workflow-def scoped** (`scope='workflow-def'`): Run a workflow that has `workflow.slaTargets` defined.
   - **Verify**: Badge shows "📋 Workflow" with blue tint.
   - **Verify**: "Edit Targets" is hidden (read-only).
3. **Ad-hoc scoped** (`scope=null`): In Results, click "Edit Targets" → add targets → Save.
   - **Verify**: Badge shows "⚗ Ad-hoc" with amber tint.
   - **Verify**: "Edit Targets" is visible (editable).
#### Expected Outcomes

- [ ] Each scope variant renders the correct emoji + text
- [ ] Read-only scopes (`run`, `workflow-def`) hide "Edit Targets"
- [ ] Ad-hoc scope shows amber badge + enables editing
- [ ] Empty state with read-only scope shows "Read-only" instead of "+ Add First Target"

> **Note**: Legacy `scope='workflow'` was removed in CC-1 cleanup (2026-05-25). Only `run`, `workflow-def`, and `null` (ad-hoc) scopes exist now.

---

### Test Scenario 14: Results — Ad-hoc SLA Editor in CompactBar

**Purpose**: Verify the inline SLA target editor within the compact bar.

**Files**: `src/features/results/components/SlaCompactBar.tsx`

#### Prerequisite

A completed run with NO SLA targets (e.g., run from "No SLA Baseline" scenario only, or an older run without SLA).

#### Steps

1. Navigate to **Results** and select a run with no SLA targets.
2. **Verify**: The compact bar shows "No targets defined" + "＋ Add First Target" button.
3. Click "＋ Add First Target".
4. **Verify**: The inline editor opens with one pre-populated row (P95, ≤, 500).
5. Add a second target: click "+ Add Target".
6. Fill in: Metric = TPS, Op = ≥, Fail at = 50.
7. Click **Save**.
8. **Verify**: The compact bar updates to show "✓ All 2 SLA targets passing" (or similar based on actual values).
9. **Verify**: Scope badge shows "⚗ Ad-hoc" (targets defined post-run).

#### Expected Outcomes

- [ ] Empty state shows "＋ Add First Target" for editable scopes
- [ ] Clicking "＋ Add First Target" opens editor with one pre-populated row (not empty editor)
- [ ] Editor allows adding/removing/editing targets inline
- [ ] Save updates the compact bar and accordion immediately
- [ ] Scope changes to "⚗ Ad-hoc" after saving ad-hoc targets

---

### Test Scenario 15: Results — Accordion Auto-Open on Failure

**Purpose**: Verify the SLA accordion auto-opens and expands failing nodes.

**Files**: `src/features/results/components/SlaStatusAccordion.tsx`

#### Steps

1. Create a run where at least one SLA target fails:
   - Option A: Set a very strict SLA (e.g., P95 ≤ 1ms) so it fails.
   - Option B: Use the ad-hoc editor to add a failing target.
2. Navigate to **Results** and select this run.
3. **Verify**: The SLA accordion is **auto-opened** (expanded without user clicking).
4. **Verify**: The failing scenario node is **auto-expanded** to show the failing check.
5. **Verify**: Passing scenario nodes remain collapsed.

#### Expected Outcomes

- [ ] Accordion auto-opens when any target fails
- [ ] Failing nodes auto-expand to show failing checks
- [ ] Passing nodes remain collapsed
- [ ] Manual user collapse is preserved unless a new failure appears

---

### Test Scenario 16: Results — Save Confirmation Flash

**Purpose**: Verify the "✓ Saved" flash after saving SLA targets.

**Files**: `src/features/results/components/SlaCompactBar.tsx`

#### Steps

1. Open the ad-hoc SLA editor (click "Edit Targets" on a run with ad-hoc scope).
2. Make a change (add, edit, or remove a target).
3. Click **Save**.
4. **Verify**: "✓ Saved" text appears in green where the "Edit Targets" button was.
5. **Verify**: After ~1.5 seconds, "Edit Targets" button reappears (flash auto-clears).

#### Expected Outcomes

- [ ] "✓ Saved" green flash appears after save
- [ ] Flash auto-clears after ~1.5 seconds
- [ ] "Edit Targets" button reappears after flash clears

---

## Phase E — Migration

### Test Scenario 17: ~~Migration Banner — Legacy Workflow SLA~~ (REMOVED)

> **Status**: REMOVED — Migration banner, `handleMigrateSlaTargets`, and all `sla-targets-wf-*` legacy support were deleted in CC-3 cleanup (2026-05-25). Legacy workflow localStorage paths no longer exist. This test scenario is no longer applicable.

---

## End-to-End Scenarios

### Test Scenario 18: Export/Import — SLA Targets Preserved

**Purpose**: Verify that exporting and re-importing feature groups preserves per-test SLA targets.

#### Steps

1. In the **Scenario Builder**, find the **"SLA Test Suite"** feature group.
2. Click the **Export** button (on the feature group header or the top-level Export).
3. Save the JSON file to a temporary location.
4. Delete the "SLA Test Suite" feature group (or use a different browser profile).
5. Import the saved JSON file via the **Import** button.
6. Expand **"API Health Checks"** → click 🎯 on **"Get Users"**.
7. **Verify**: The modal shows 2 SLA targets with correct values (P95 ≤ 500, Error Rate ≤ 1.0).
8. Expand **"CRUD Operations"** → check 🎯 badges on tests.
9. **Verify**: Create Post shows `🎯 3`, Update Post shows `🎯 1`, Delete Post shows plain `🎯`.
10. Check the SLA Summary panel under each scenario.
11. **Verify**: Summary tables match the original data.

#### Expected Outcomes

- [ ] Export includes `slaTargets` on individual `Scenario` objects
- [ ] Import restores all SLA target data faithfully
- [ ] 🎯 buttons reflect correct counts after re-import
- [ ] SLA Summary tables display correctly after re-import
- [ ] Feature group-level `slaTargets` are also preserved

---

### Test Scenario 19: End-to-End — Run with Per-Test SLA

**Purpose**: Full end-to-end test: define SLA → run → verify results.

#### Steps

1. **Define SLA**: In Scenario Builder, ensure "SLA Test Suite" has per-test SLA targets (from import).
2. **Run tests**: In Test Runner, select "API Health Checks" + "CRUD Operations" + "No SLA Baseline". Run with 2 iterations, 1 concurrency.
3. **View results**: Navigate to Results. Select the latest run.
4. **Verify Compact Bar**:
   - Shows overall status (likely ✓ All Passing for jsonplaceholder).
   - Shows scope badge "🔒 This Run".
   - Detail text: "All N SLA targets passing" (N = 7 targets from 4 tests).
5. **Verify Accordion**:
   - Expand SLA Status section.
   - "Get Users" shows 🟢 with 2 passing checks.
   - "Get Posts" shows 🟢 with 1 passing check.
   - "Create Post" shows 🟢 with 3 passing checks.
   - "Update Post" shows 🟢 with 1 passing check.
   - "Get Comments", "Delete Post", "Get Albums", "Get Todos" do NOT appear in the accordion.
6. **Verify Run List**: In the run selector dropdown, the run shows a 🟢 SLA dot.

#### Expected Outcomes

- [ ] SLA targets flow from definition → runner config → results display
- [ ] Compact bar shows correct status and scope
- [ ] Accordion shows correct per-test evaluations
- [ ] Tests without SLA targets are excluded from SLA display
- [ ] Run list shows SLA status dot

---

### Test Scenario 20: Unit Test Suite — Full Pass

**Purpose**: Verify all unit tests pass.

#### Steps

```bash
npx vitest run src/features/results/utils/slaTargets.test.ts
npx vitest run src/features/test-runner/hooks/useRunnerOrchestration.test.ts
npx vitest run src/features/scenarios/hooks/useScenarioMutations.test.ts
```

#### Expected Outcomes

- [ ] `slaTargets.test.ts`: 109+ tests pass
- [ ] `useRunnerOrchestration.test.ts`: 83+ tests pass
- [ ] `useScenarioMutations.test.ts`: 82+ tests pass
- [ ] 0 failures across all SLA-related test files

---

### Test Scenario 21: TypeScript — Zero Errors

#### Steps

```bash
npx tsc -b --noEmit
```

#### Expected Outcomes

- [ ] 0 TypeScript errors

---

### Test Scenario 22: Tauri Desktop — Visual Parity

**Purpose**: Verify that all SLA features render identically in the Tauri desktop app.

#### Steps

1. Build and launch the Tauri app: `npm run tauri dev`
2. Repeat Test Scenarios 1–16 in the Tauri window.
3. Pay special attention to:
   - 🎯 button positioning and amber highlight
   - TestSlaModal overlay and positioning
   - ScenarioSlaPanel table rendering
   - SlaCompactBar at top of Results
   - SlaStatusAccordion tree expansion
   - Scope badge colors (may differ due to webview rendering)

#### Expected Outcomes

- [ ] All SLA UI elements render identically in Tauri as in the browser
- [ ] Modal overlays work correctly (no z-index issues)
- [ ] CSS colors, fonts, and spacing match browser version
- [ ] IndexedDB persistence works in Tauri's webview

---

## Phase §5 — Import CLI Test Results into UI

### Test Scenario 23: Import CLI Run — Happy Path

**Purpose**: Verify that a CLI-generated JSON result file can be imported into the UI via the "📥 Import Test Results" button.

**Files**: `src/features/results/ResultsDashboard.tsx`, `src/features/results/utils/importRun.ts`

**Test data**: `test-data/cli-sample-run.json`

#### Steps

1. Navigate to **Results** (Harness → Results tab).
2. **Verify**: An "📥 Import Test Results" button is visible in the top actions bar (even in the empty state).
3. Click the **📥 Import Test Results** button.
4. A file picker dialog opens. Select `test-data/cli-sample-run.json`.
5. Wait for the import to complete (~1–2 seconds).
6. **Verify**: The run selector dropdown now contains a new entry with the project name "CLI Sample Run".
7. **Verify**: The new run is auto-selected.
8. **Verify**: The run details show:
   - Context tags: `staging` environment tag, `Host: hardcoded` tag, `batch` execution mode.
   - Metrics cards: Total Requests = 30, Error Rate = 3.33%.
9. **Verify**: The request detail table shows 4 results (2 GET /api/users, 2 POST /api/orders).
10. **Verify**: The failed request (POST /api/orders with status 500) shows as failed with error "Internal Server Error".

#### Expected Outcomes

- [ ] "📥 Import Test Results" button is visible in both empty and non-empty states
- [ ] File picker opens on click; accepts `.json` files
- [ ] Imported run appears in the run selector with the project name
- [ ] Run is auto-selected after import
- [ ] Context tags (env, execution mode) display correctly
- [ ] Metrics cards show correct summary values
- [ ] Individual request results render in the detail table
- [ ] Failed requests show error details

---

### Test Scenario 24: Import CLI Run — SLA Targets Display

**Purpose**: Verify that embedded `config.slaTargets` from a CLI run are picked up by the SLA compact bar and accordion.

**Files**: `src/features/results/components/SlaCompactBar.tsx`, `src/features/results/components/SlaStatusAccordion.tsx`

**Test data**: `test-data/cli-sample-run.json` (has `config.slaTargets` with 2 targets)

#### Prerequisite

Import `cli-sample-run.json` via Scenario 23 (or re-import it).

#### Steps

1. Select the imported "CLI Sample Run" in the run selector.
2. **Verify**: The SLA compact bar appears at the top with:
   - Status pill: ✓ or similar (depends on whether P95 ≤ 500ms and Error Rate ≤ 5% pass).
   - Scope badge: "🔒 This Run" (because targets are embedded in `config.slaTargets`).
   - Detail text: "All 2 SLA targets passing" (or violations if thresholds are exceeded).
3. **Verify**: No "Edit Targets" button is visible (embedded targets are read-only).
4. Scroll to the SLA Status accordion section.
5. **Verify**: Two checks are listed:
   - "P95 under 500ms" — shows actual P95 value vs. ≤ 500ms threshold.
   - "Error rate under 5%" — shows actual error rate vs. ≤ 5% threshold.
6. **Verify**: Both checks show 🟢 (passing) since P95=250ms ≤ 500ms and Error Rate=3.33% ≤ 5%.
7. In the run selector dropdown, **verify** the run entry shows a 🟢 SLA status dot.

#### Expected Outcomes

- [ ] Embedded `config.slaTargets` are detected and evaluated automatically
- [ ] Scope badge shows "🔒 This Run" (read-only)
- [ ] "Edit Targets" button is hidden (read-only scope)
- [ ] SLA compact bar shows correct pass/fail status
- [ ] SLA accordion lists all embedded targets with evaluations
- [ ] Run selector shows SLA status dot for the imported run

---

### Test Scenario 25: Import CLI Run — Invalid File Rejection

**Purpose**: Verify that importing an invalid JSON file shows an error message.

**Files**: `src/features/results/ResultsDashboard.tsx`, `src/features/results/utils/importRun.ts`

#### Steps

1. Navigate to **Results**.
2. Click the **📥 Import Test Results** button.
3. Select a file that is NOT a valid CLI result (e.g., a plain text file renamed to `.json`, or a JSON file with `{ "not": "a valid run" }`).
4. **Verify**: An error message appears below the toolbar: "Import failed: …" with a specific reason.
5. **Verify**: No crash occurs — the page remains functional.
6. **Verify**: The error message disappears when a subsequent valid import succeeds.

#### Expected Outcomes

- [ ] Invalid JSON shows "Import failed: …" error message
- [ ] Error message includes the specific validation failure (e.g., "config.concurrency must be a number")
- [ ] The page does not crash or go blank
- [ ] Subsequent valid import clears the error

---

### Test Scenario 26: Import CLI Run — Missing Fields Normalization

**Purpose**: Verify that the import normalizes missing optional fields (IDs on results, timestamps).

**Files**: `src/features/results/utils/importRun.ts`

#### Steps

1. Create a minimal valid JSON file with results that lack `id` fields:
   ```json
   {
     "config": { "concurrency": 1, "iterations": 1, "scenarioWeights": [], "executionMode": "sequential" },
     "summary": { "totalRequests": 1, "totalDurationMs": 100 },
     "results": [
       { "scenarioName": "Test", "url": "http://localhost/", "method": "GET",
         "responseTimeMs": 50, "timestamp": 1716700001000, "passed": true,
         "httpStatus": 200, "responseBody": "{}", "validationMode": "none", "failureDetails": [] }
     ]
   }
   ```
2. Import via **📥 Import Test Results**.
3. **Verify**: Import succeeds (no error).
4. Select the imported run.
5. **Verify**: The result row renders correctly (no crash from missing `id`).
6. Open Chrome DevTools → Application → IndexedDB → `redfireforge` → runs.
7. Find the imported run. Check `results[0]`.
8. **Verify**: `results[0].id` is `"imported-0"` (auto-assigned by validation).
9. **Verify**: The run's `id` is a UUID (not the original file's `id` or `undefined`).
10. **Verify**: The `timestamp` defaults to `Date.now()` if missing from the file.

#### Expected Outcomes

- [ ] Results without `id` fields get auto-assigned IDs (`imported-0`, `imported-1`, …)
- [ ] The run's top-level `id` is always a fresh UUID (avoids collisions)
- [ ] Missing `timestamp` defaults to current time
- [ ] The import works for minimal valid JSON (only required fields)

---

## Visual Test Scenarios (Consolidated from sla-dashboard-visual-test-scenarios.md)

> These scenarios test the visual appearance and interaction of the SLA dashboard states.
> Test data is in `docs/test-data/sla-dashboard-test-data.json`.
> See the "How to Seed Test Data" section in the test data JSON for browser console seeding snippets.

### Test Scenario 27: Visual — SLA Status States

**Purpose**: Verify all 5 SLA status states render correctly (empty, pass, fail, warn, no-data, mixed).

**Test data JSON key**: `scenarios.empty`, `scenarios.allPass`, `scenarios.allFail`, `scenarios.warn`, `scenarios.noData`, `scenarios.mixed`

#### Steps

| # | State | Seed | Expected |
|---|-------|------|----------|
| 27.1 | **Empty** | Scenario `empty` — no SLA targets | Compact bar: "No SLA targets defined" + "＋ Add First Target" button; no status pill; no SLA accordion |
| 27.2 | **All Pass** | Scenario `allPass` — 3 targets, all pass | Compact bar pill: "✓ All Passing" (green); detail: "3 targets evaluated"; SLA accordion: "✓ 3 Pass" |
| 27.3 | **All Fail** | Scenario `allFail` — 3 targets, all fail | Compact bar pill: "⚠ 3 Failing" (red); detail: "3 violations"; SLA accordion: "✗ 3 Fail" |
| 27.4 | **Warn** | Scenario `allWarn` — 3 targets, all in warn zone | Compact bar pill: "! 3 Warnings" (amber); detail: "3 warnings"; SLA accordion: "⚠ 3 Warn" |
| 27.5 | **No Data** | Scenario `noData` — metric absent from summary | Compact bar pill: "No data"; SLA accordion shows ⚫ for no-data checks |
| 27.6 | **Mixed** | Scenario `mixed` — multiple statuses | Compact bar pill: "⚠ N Failing" (red, worst-status wins); detail: "N violations — M warnings — K passing"; accordion shows mixed 🟢🟡🔴⚫ rows |

#### Expected Outcomes

- [ ] Each state produces the correct compact bar pill color (green/red/amber/gray)
- [ ] SlaStatusAccordion rows match status: 🟢 pass, 🔴 fail, 🟡 warn, ⚫ no-data
- [ ] Mixed state: worst status wins for pill (fail > warn > no-data > pass)
- [ ] All states are readable in dark theme

> **Note**: `SlaCheckGrid` cards and `SlaTestTable` no longer exist (removed in C-phase refactor). All SLA results display via `SlaCompactBar` (one-line status bar) + `SlaStatusAccordion` (expandable tree below metrics).

---

### Test Scenario 28: Visual — Editor Add/Modify/Delete Targets

**Purpose**: Full editor workflow — add rows, edit values, delete rows, validation.

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 28.1 | Empty state → "＋ Add First Target" | Editor opens with "No targets yet" hint |
| 28.2 | "+ Add Target" | Row: P95 Response Time, ≤, 500 |
| 28.3 | Change metric to **TPS** | Operator auto-changes to **≥** |
| 28.4 | Set value to **50** → Save | Cards appear; editor closes |
| 28.5 | "Edit Targets" → add second row | Second row: P95, ≤, 500 |
| 28.6 | Set warnAt to **400**, value to **300** | Validation error (warn > value for ≤) |
| 28.7 | Fix value to **600** → Save | Error clears; 2 cards visible |
| 28.8 | Edit again → delete TPS row → Save | Only P95 card remains |
| 28.9 | Set value to **-1** | Error: "Must be a non-negative number"; Save disabled |
| 28.10 | Set warnAt = value (equal) for ≤ operator | Error: "Must be less than fail threshold" |
| 28.11 | Refresh page | Targets persist (localStorage) |

#### Expected Outcomes

- [ ] TPS auto-sets operator to ≥; Error Rate auto-sets ≤
- [ ] Validation errors block Save
- [ ] Changes persist after save and page refresh
- [ ] ✕ button removes rows; Save persists deletion

---

### Test Scenario 29: Visual — Collapse/Expand Panel & Dark Theme

**Purpose**: Banner collapse toggle and dark theme verification.

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 29.1 | Default state (pass) | SlaStatusAccordion collapsed showing "✓ N Pass ▸" |
| 29.2 | Click SLA Status accordion header | Accordion expands showing individual check rows |
| 29.3 | Click accordion header again | Accordion collapses; "▸" chevron returns |
| 29.4 | Click "Edit Targets" | Inline editor opens within compact bar area |
| 29.5 | Cancel editor | Editor closes; compact bar returns to read-only view |
| 29.6 | Apply mixed state → dark mode (🌙) | All check row colors readable; inputs have visible borders |
| 29.7 | Toggle to light mode (☀️) → back to dark | All states still readable; no visual regressions |

#### Expected Outcomes

- [ ] SlaStatusAccordion expand/collapse works via header click
- [ ] Inline editor opens/closes correctly in the compact bar
- [ ] All SLA states readable in dark and light theme

---

### Test Scenario 30: Visual — Per-Scenario SLA (SlaStatusAccordion)

**Purpose**: When targets have `scope='scenario'` or `scenarioName`, SlaStatusAccordion shows per-scenario nodes.

**Test data JSON key**: `scenarios.perScenario`

> **Note**: `SlaTestTable` and `SlaCheckGrid` were removed in the C-phase refactor. All results display via `SlaStatusAccordion` which shows a Feature → Scenario → Check tree.

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 30.1 | Seed per-scenario run (checkout + search) | SLA accordion expands to show scenario-level nodes |
| 30.2 | Expand "checkout" scenario node | Shows 2 SLA check rows (P95 🟢 + Error Rate 🟢) |
| 30.3 | "search" scenario (no SLA targets) | Does NOT appear in accordion (only scenarios with SLA show) |
| 30.4 | Compact bar | Pill: "✓ All Passing"; detail: "2 targets evaluated" |
| 30.5 | Edit → change checkout P95 scope to "Aggregate" → Save | Check moves to aggregate level in accordion |
| 30.6 | Edit → change all to "Aggregate" → Save | All checks at aggregate level (no scenario sub-nodes) |

#### Expected Outcomes

- [ ] SlaStatusAccordion shows scenario-level nodes when any target has `scenarioName`
- [ ] Scenarios without SLA targets do NOT appear in the accordion
- [ ] Editor Scope dropdown shows "Aggregate", "Scenario", "Feature Group" options
- [ ] Changing scope to Aggregate moves checks to top-level aggregate section

---

### Test Scenario 31: Visual — Workflow-Scoped & Embedded Run-Level SLA

**Purpose**: Verify `"📋 Workflow"` (`scope='workflow-def'`) and `"🔒 This Run"` (`scope='run'`) badge variants.

**Test data JSON key**: `scenarios.workflowScoped`, `scenarios.embeddedRunLevel`

> **Note**: Legacy `sla-targets-wf-*` workflow localStorage was removed in CC-1/2/3 cleanup (2026-05-25). All workflow SLA is now embedded per-run in `config.slaTargets`. `scope='workflow-def'` is automatically derived when a run has BOTH `config.workflowId` AND `config.slaTargets`. It is always read-only.

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 31.1 | Seed workflow run with `workflowId` + `config.slaTargets` | Compact bar shows `"📋 Workflow"` badge (blue pill); "Read-only" instead of "Edit Targets" |
| 31.2 | Attempt to edit | No "Edit Targets" button; compact bar is non-editable |
| 31.3 | DevTools → localStorage | No `sla-targets-wf-*` key exists; targets live in `config.slaTargets` of the run |
| 31.4 | Seed embedded run (`config.slaTargets`, no `workflowId`) | Compact bar shows `"🔒 This Run"` badge (blue pill); "Read-only" text |
| 31.5 | Accordion shows embedded targets | All read-only; accordion expand/collapse works |
| 31.6 | DevTools → IndexedDB → runs → inspect run | `config.slaTargets` array present; no separate localStorage SLA key |

#### Expected Outcomes

- [ ] `scope='workflow-def'`: `"📋 Workflow"` badge, always read-only, no "Edit Targets" button
- [ ] `scope='run'` (embedded): `"🔒 This Run"` badge, always read-only, no "Edit Targets" button
- [ ] Both read-only scopes show "Read-only" text in the compact bar actions area
- [ ] Badge color and text match scope type
- [ ] No `sla-targets-wf-*` localStorage keys exist (all removed in CC-3)

---

### Test Scenario 32: Visual — Run List SLA Status Dots

**Purpose**: Run selector shows colored SLA dot per run.

**Test data JSON key**: `scenarios.runListDots`

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 32.1 | Seed 4 runs (pass/warn/fail/no-SLA) | Run selector shows all 4 |
| 32.2 | "All Pass Run" | 🟢 dot in selector |
| 32.3 | "Warn Run" | 🟡 dot |
| 32.4 | "All Fail Run" | 🔴 dot |
| 32.5 | "No SLA Run" | ⚫ dot (no targets configured) |
| 32.6 | Edit "Fail Run" → lenient targets → Save | Dot updates from 🔴 to 🟢 |

#### Expected Outcomes

- [ ] Dots appear in run selector per SLA status
- [ ] Dots update dynamically after target edits

---

### Test Scenario 33: Visual — Multi-Run Workflow Shared SLA

**Purpose**: Two runs sharing same `workflowId` share SLA targets via embedded `config.slaTargets`.

**Test data JSON key**: `scenarios.multiRunWorkflow`

> **Note**: Legacy `sla-targets-wf-*` localStorage was removed in CC-1/2 cleanup. Workflow SLA targets are now embedded in each run's `config.slaTargets` at launch time from the workflow definition.

#### Steps

| # | Action | Expected |
|---|--------|----------|
| 33.1 | Seed 2 workflow runs (same `workflowId`) | Both show in selector |
| 33.2 | Select Run A | Badge "📋 Workflow"; targets from workflow definition embedded at launch |
| 33.3 | Switch to Run B | Same embedded targets; same badge |
| 33.4 | Both runs evaluate SLA independently | Each run's results evaluated against its own embedded `config.slaTargets` |

#### Expected Outcomes

- [ ] Both runs show "📋 Workflow" badge (read-only)
- [ ] SLA targets are embedded per-run (snapshot at launch), not shared via localStorage
- [ ] Each run evaluates SLA independently against its own results

---

## Phase F — SLA Override Modal UI Polish (SLA-F1–F16)

### Test Scenario 34: SLA Override Modal — Professional Layout

**Purpose**: Verify the SLA Override modal UI polish from Phase F.

**Files**: `src/features/test-runner/components/RunnerSlaOverridePanel.tsx`, `src/styles/base.css`

#### Prerequisite

At least one scenario with SLA targets selected in the Test Runner.

#### Steps

1. Navigate to **Test Runner** (Harness → Test Runner tab).
2. Select a scenario with SLA targets (e.g., "API Health Checks").
3. Click the 🎯 SLA Override trigger bar to open the modal.
4. **Verify** modal title: **"SLA Override"** (no emoji prefix).
5. **Verify** upper section toggle: **"Configured Targets"** (no 📋 emoji).
6. **Verify** upper table column headers: **Scope | Metric | Threshold | Warn | Label | Action** (not "Fail If" / "Warn At").
7. **Verify** modal has subtle rounded corners (10px), soft shadow, and header has a slight dark background tint.
8. **Verify** table rows show hover effect (slight background highlight on mouse over).
9. **Verify** alternating row shading on the definitions table (even rows slightly different).

#### Expected Outcomes

- [ ] Modal title has no emoji prefix
- [ ] Section header has no emoji
- [ ] Column headers read "Threshold" / "Warn" (matching upper table)
- [ ] Rounded corners (10px) on modal
- [ ] Header has subtle background tint
- [ ] Row hover effects work on both tables
- [ ] Alternating row shading on definitions table

---

### Test Scenario 35: SLA Override Modal — Overrides Section Polish

**Purpose**: Verify lower "Overrides for This Run" section UI improvements.

#### Steps

1. Open the SLA Override modal (🎯 trigger bar).
2. **With no overrides**: Verify the lower section shows an empty state: centered text "No overrides configured. Click 'Override' above or '+ Add Target' below."
3. Click **"Override"** on a row in the upper table.
4. **Verify**: The button changes to a styled **"Overridden"** badge (amber background, rounded, with ✓ via CSS — NOT text "✓").
5. **Verify**: The lower section header reads **"Overrides for This Run"** (Title Case).
6. **Verify**: Lower table columns align with upper table columns (widths match visually).
7. Modify the override value (e.g., change threshold from 500 to 300).
8. **Verify**: A **"was 500"** hint appears **inline** (on the same line as the input), italic, slightly transparent. NOT on a new line.
9. **Verify**: The "was X" hint has `white-space: nowrap` so it doesn't wrap.
10. Click the **✕** (delete) button on the override row.
11. **Verify**: Delete button shows red background highlight on hover (not just a red border).
12. Remove all overrides.
13. **Verify**: Empty state message reappears.

#### Expected Outcomes

- [ ] Empty state message appears when no overrides exist
- [ ] "Overridden" badge is styled (background, rounded) with CSS ✓ (not text)
- [ ] Section header: "Overrides for This Run" (Title Case)
- [ ] Column widths aligned between upper and lower tables
- [ ] "was X" hint is inline, italic, semi-transparent
- [ ] Delete button hover shows red background
- [ ] Empty state reappears after removing all overrides

---

### Test Scenario 36: SLA Override Modal — Input & Button Polish

**Purpose**: Verify input focus states, Add Target button, and footer dots.

#### Steps

1. Open the SLA Override modal. Click **"+ Add Target"** in the overrides section.
2. **Verify**: The "+" Add Target" button has a dashed border; on hover it becomes solid blue.
3. Click into a numeric input (Threshold or Warn).
4. **Verify**: The input shows a subtle blue focus glow (box-shadow).
5. Click into a select dropdown (Metric or Scope).
6. **Verify**: The select also shows a blue focus glow.
7. Look at the modal footer bar.
8. **Verify**: Override count (`N overridden`) has a small amber dot (●) before it.
9. **Verify**: New target count (`N new`) has a small green dot (●) before it.

#### Expected Outcomes

- [ ] "+ Add Target" button: dashed border → solid blue on hover
- [ ] Inputs show blue focus glow (box-shadow)
- [ ] Selects show blue focus glow
- [ ] Footer override count has amber dot prefix
- [ ] Footer new count has green dot prefix

---

### Test Scenario 37: Sidebar Toggle — Accessible with SLA Modal Open

**Purpose**: Verify the sidebar hide/show toggle remains accessible when the SLA Override modal is open.

#### Steps

1. Open the SLA Override modal (🎯 trigger bar).
2. Move the mouse to the far left edge of the screen (where the sidebar toggle button appears).
3. **Verify**: The sidebar toggle button (◀/▶) appears and is clickable — it is NOT hidden behind the modal overlay.
4. Click the sidebar toggle.
5. **Verify**: The sidebar collapses/expands while the SLA Override modal remains open.

#### Expected Outcomes

- [ ] Sidebar toggle has `z-index: 101` (above modal overlay at 100)
- [ ] Toggle button opacity: default 0.45, hover 0.85 (easily visible)
- [ ] Sidebar can be toggled without closing the SLA Override modal

---

## Appendix: Test Data Reference

### Feature Group: "SLA Test Suite"

| Scenario | Test | SLA Targets | Expected in Runner |
|----------|------|------------|-------------------|
| API Health Checks | Get Users | P95 ≤ 500ms (warn 400), Error Rate ≤ 1% | ✅ 2 targets → `scenarioName: "Get Users"` |
| API Health Checks | Get Posts | P95 ≤ 800ms | ✅ 1 target → `scenarioName: "Get Posts"` |
| API Health Checks | Get Comments | (none) | ❌ No SLA entries |
| CRUD Operations | Create Post | P95 ≤ 1000ms (warn 800), TPS ≥ 10 (warn 15), Error Rate ≤ 2% | ✅ 3 targets → `scenarioName: "Create Post"` |
| CRUD Operations | Update Post | Avg ≤ 600ms | ✅ 1 target → `scenarioName: "Update Post"` |
| CRUD Operations | Delete Post | (none) | ❌ No SLA entries |
| No SLA Baseline | Get Albums | (none) | ❌ No SLA entries |
| No SLA Baseline | Get Todos | (none) | ❌ No SLA entries |

**Feature Group-level SLA**: P95 ≤ 2000ms (label: "Feature Group P95 SLA")

**Total test-level SLA targets**: 7 (across 4 tests)
**Total including FG-level**: 8
