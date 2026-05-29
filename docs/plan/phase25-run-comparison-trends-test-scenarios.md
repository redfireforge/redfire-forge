# Phase 25 Run Comparison & Trends - Test Scenarios

Feature: Results comparison, baseline management, trends, thresholds, and comparison export/import flow
Plan: docs/plan/phase25-run-comparison-trends.md
Validated branch context: feature/phase25-sprint3-export-cli
Last visual verification: 2026-05-29

## Test Data Artifacts

Use these JSON files for all scenarios below:

- docs/test-data/phase25-run-comparison/baseline-run.json
- docs/test-data/phase25-run-comparison/regression-run.json
- docs/test-data/phase25-run-comparison/improved-run.json
- docs/test-data/phase25-run-comparison/alt-scope-run.json
- docs/test-data/phase25-run-comparison/workflow-run.json
- docs/test-data/phase25-run-comparison/invalid-run.json
- docs/test-data/phase25-run-comparison/exported-from-ui-selected-run.json

Notes:
- Each file is a single TestRun object (the format required by Results import).
- exported-from-ui-selected-run.json is the round-trip import target for export/import validation.

## Before You Start

1. Open RedfireForge.
2. Navigate to Harness -> Results.
3. Ensure no file chooser dialog is open.
4. Keep this document open while executing each scenario in order.

## Validation Checklist

| # | Scenario | Status |
|---|---|---|
| 1 | Import fixture runs into Results | [x] |
| 2 | Custom run picker visual + compact list behavior | [x] |
| 3 | Baseline mark/unmark and Comparison & Trends badge behavior | [x] |
| 4 | Baseline-mode regression comparison | [x] |
| 5 | Improved vs No change classification consistency | [x] |
| 6 | Ad-hoc mode behavior when comparing non-baseline run | [x] |
| 7 | Trend chart (Overall and Per-Scenario) and scope control | [x] |
| 8 | Regression thresholds controls (Reset, Cancel, Save) | [x] |
| 9 | Comparison export menu actions (Markdown/JSON) | [x] |
| 10 | Invalid import rejection message | [x] |
| 11 | Workflow-only filter hides non-visible baseline artifacts | [x] |
| 12 | Export JSON round-trip import | [x] |
| 13 | Run Comparison status source is summary/table only | [x] |

## Scenario 1: Import Fixture Runs Into Results

Goal: Seed reproducible data for all comparison states.

Steps:
1. Click Import Test Results.
2. Import each file in this order:
   - baseline-run.json
   - regression-run.json
   - improved-run.json
   - alt-scope-run.json
   - workflow-run.json
3. Confirm run filter counters update.

Expected:
- All Runs shows 5.
- Test Runs shows 4.
- Workflow Runs shows 1.
- Latest selected run is visible in the run selector row.

## Scenario 2: Custom Run Picker Visual + Compact List Behavior

Goal: Verify custom listbox replaces native dropdown popup and uses compact spacing.

Steps:
1. In Results, click the selected run control (main run selector row).
2. Visually inspect list item density and selection highlight.
3. Select a different run from the popup.

Expected:
- Popup is app-styled (not OS-native menu).
- No macOS orange native highlight artifact appears.
- Items are compact and readable.
- Selected run updates immediately after click.

## Scenario 3: Baseline Mark/Unmark and Comparison & Trends Badge

Goal: Verify baseline anchor controls and Comparison & Trends tab badge.

Steps:
1. Select baseline-run.json run (timestamp around 7:05:10 AM).
2. Click Set Baseline.
3. Open Comparison & Trends tab.
4. Verify badge count and baseline side panel entry.
5. Click Unmark in baseline side panel.

Expected:
- After marking baseline, run label shows star marker.
- Comparison & Trends tab shows count when baseline is visible in current filter.
- Unmark removes baseline marker and updates mode/count accordingly.

## Scenario 4: Baseline-Mode Regression Comparison

Goal: Validate critical regression visualization.

Steps:
1. Mark baseline-run as baseline.
2. Select regression-run as Selected Run.
3. In Comparison & Trends, keep compare target on the baseline run.
4. Review Overview and Regressions tabs in Run Comparison panel.

Expected:
- Mode badge shows Baseline Mode.
- Regression rows show Regressed status across key metrics.
- Regression count remains visible in the summary strip and Regressions tab badge.
- No duplicated top red regression banner list appears above tabs/table.
- Compared/Selected labels in table columns are correct.

## Scenario 5: Improved vs No Change Classification Consistency

Goal: Validate threshold-aware status semantics.

Steps:
1. Select improved-run as Selected Run.
2. Compare against baseline-run.
3. Review metric rows in comparison table.

Expected:
- Some metrics show Improved.
- Some metrics can show No change when not crossing improvement threshold.
- Error Rate 0% -> 0% shows No change.
- No duplicated top green improvement banner list appears above tabs/table.

## Scenario 6: Ad-hoc Mode With Non-Baseline Compare Target

Goal: Verify mode semantics when compare target is not baseline-marked.

Steps:
1. Keep Selected Run as regression-run.
2. In Compare against run dropdown, choose alt-scope-run (non-baseline entry).

Expected:
- Mode badge switches to Ad-hoc Mode.
- Compare chip shows selected ad-hoc target.
- Comparison panel still renders with valid deltas.

## Scenario 7: Trend Chart (Overall and Per-Scenario) + Scope

Goal: Validate trend rendering and scope controls.

Steps:
1. In Comparison & Trends, click Show Trend.
2. Confirm Overall tab renders line chart.
3. Switch to Per-Scenario tab.
4. Change scope dropdown (All runs, By service, By service + env when enabled).

Expected:
- Trend chart appears/disappears with toggle.
- Overall and Per-Scenario tabs both render valid chart content.
- Scope selection updates chart dataset.

## Scenario 8: Threshold Controls (Reset, Cancel, Save)

Goal: Re-validate button behavior that previously broke.

Steps:
1. In Regression Thresholds panel, change Avg Response Time warning value.
2. Click Cancel.
3. Change value again and click Save.
4. Click Reset Defaults and Save.

Expected:
- Cancel restores previously saved values.
- Save persists edited values and shows saved confirmation.
- Reset Defaults returns values to defaults and can be persisted by Save.

## Scenario 9: Comparison Export Menu Actions

Goal: Validate export action wiring for comparison reports.

Steps:
1. Open Run Comparison panel in Comparison & Trends.
2. Click Export in the comparison header.
3. Click Export as JSON.
4. Re-open Export menu and click Export as Markdown.

Expected:
- Menu opens and closes correctly.
- Both menu actions execute without UI errors.
- No broken UI state remains after action.

## Scenario 10: Invalid Import Rejection

Goal: Validate import schema guardrails.

Steps:
1. Click Import Test Results.
2. Select invalid-run.json.

Expected:
- Inline error appears: Import failed: Missing or invalid "config" field.
- Existing run data is unchanged.

## Scenario 11: Workflow-Only Filter Hides Hidden Baseline Artifacts

Goal: Ensure baseline count/list are scoped to visible runs only.

Steps:
1. Switch run filter to Workflow Runs.
2. Open Comparison & Trends tab.

Expected:
- Comparison & Trends tab does not inherit hidden baseline count from test-only baselines.
- Mode can remain Ad-hoc Mode when no visible workflow baseline exists.
- Baseline side panel shows no ghost/truncated baseline entries from non-visible run types.

## Scenario 12: Export JSON Round-Trip Import

Goal: Validate importability of exported-style run JSON.

Steps:
1. Click Import Test Results.
2. Import exported-from-ui-selected-run.json.
3. Check run counters.
4. Select the newly imported run and open Comparison & Trends.

Expected:
- Import succeeds without schema errors.
- All Runs increments by 1.
- Workflow Runs increments when imported run is workflow type.
- Imported run behaves normally in Overview and Comparison & Trends.

## Scenario 13: Run Comparison Status Source Is Summary/Table Only

Goal: Verify status appears once in structured locations (summary strip + tables/tabs) without duplicated top banners.

Steps:
1. Select regression-run as Selected Run.
2. Compare against baseline-run.
3. Observe the comparison header area above tabs.
4. Switch to Overview and Regressions tabs.

Expected:
- Summary strip shows counts (`N regressed · N improved · N no change`).
- Status remains visible in table `Status` cells and Regressions tab badge/list.
- No duplicated top inline alert block appears for regression or improvement metrics.

## Visual Test Notes (2026-05-29)

- Visual checks were executed on the running app at http://127.0.0.1:4173/?tab=results.
- Baseline + trend + comparison views were tested with imported fixture data.
- A real issue was found and fixed during this pass:
  - Workflow-only filter previously surfaced hidden baseline artifacts from test runs.
  - Fix implemented in ResultsDashboard baseline visibility scoping and covered by unit test.
- Additional UI simplification verified:
  - Duplicate top regression/improvement banner blocks in `Run Comparison` were removed.
  - Status source is now summary strip + status columns/tabs only.

## Follow-up Validation Command Set

Use this command set after any code changes to Phase 25 behavior:

1. npx vitest run src/features/results/ResultsDashboard.test.tsx
2. npx tsc -b --noEmit
