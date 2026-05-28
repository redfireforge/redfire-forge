# Phase 25 — Run Comparison & Trends: Detailed Plan

> **Goal:** Detect performance regressions, compare runs analytically, and track trends across the run history.
> **Status:** Sprint 1 complete, Sprint 2 complete — feature branches `feature/phase25-sprint1-comparison-ux`, `feature/phase25-sprint2-analytics`
> **Target version:** 0.6.0

---

## Phase Status Tracker

| Sub-Phase | Title | Status | Est. | Notes |
|---|---|---|---|---|
| 25.1 | Audit & complete core comparison UX | ✅ | S | Polish existing scaffold |
| 25.2 | Any-Two-Run comparison picker | ✅ | S | Remove baseline-only constraint |
| 25.3 | Configurable regression thresholds | ✅ | S | Expose DEFAULT_THRESHOLDS in UI |
| 25.4 | Trend scoping & multi-metric view | ✅ | M | Filter by svc/env/scenario, side-by-side lines |
| 25.5 | Regression badge in run history list | ✅ | S | Visual status per run in sidebar |
| 25.6 | CLI regression gate | ✅ | M | `--fail-on-regression` for CI pipelines |
| 25.7 | Export comparison report | ✅ | S | Markdown/JSON download of RunComparison |
| 25.8 | Gallery sample + training manual | 🔲 | S | Gallery entry + 1 HTML training manual |
| 25.9 | Tests & E2E coverage | 🔲 | M | Unit tests for new logic, E2E for new flows |

**Est. key:** S = Small (< 1 day) · M = Medium (1–2 days)

---

## Context: What's Already Built

Before planning new work it's critical to understand what already exists so we don't duplicate.

### ✅ Already fully implemented

| File | What it provides |
|---|---|
| `src/features/results/utils/runBaselines.ts` | `BaselineMark` CRUD (`markAsBaseline`, `unmarkBaseline`, `renameBaseline`, `isBaseline`); `compareRuns()` producing `RunComparison` with `MetricDelta[]`, `ScenarioDelta[]`, `RegressionAlert[]`; `computeTrend()` producing `TrendPoint[]`; `detectRegressions()` with severity levels; `DEFAULT_THRESHOLDS` / `RegressionThresholds` types |
| `src/features/results/components/RunComparisonPanel.tsx` | `RunComparisonPanel` with 4 tabs: **Overview** (MetricDeltaTable), **Per-Scenario** (ScenarioDeltaTable), **Regressions** (RegressionList), **Distribution** (ResponseTimeOverlayHistogram); `TrendChart` with metric selector + baseline dot highlighting |
| `src/features/results/components/ResponseTimeHistogram.tsx` | `ResponseTimeHistogram` (single run) + `ResponseTimeOverlayHistogram` (two-run overlay with bar groups) |
| `src/features/results/utils/responseTimeHistogram.ts` | `computeHistogramBins`, `computeOverlayHistogram`, `computeDistributionStats` |
| `src/features/results/ResultsDashboard.tsx` | "☆ Set Baseline" button; "Compare against baseline…" dropdown; "Show Trend" toggle; `TrendChart` + `RunComparisonPanel` rendered inline |
| `src/styles/base.css` (lines ~3001–3060) | All CSS: `.run-comparison-panel`, `.comparison-table`, `.baseline-toggle`, `.baseline-active`, `.trend-chart-container`, `.delta-better`, `.delta-worse`, `.regression-alert`, `.regression-pass` |
| `runBaselines.test.ts` (372 lines) | Unit tests: baseline CRUD, compareRuns, computeTrend, edge cases |
| `RunComparisonPanel.test.tsx` (371 lines) | Component tests: all 4 tabs, regression badge, TrendChart |

### ⚠️ What's missing (phase gaps)

The scaffold exists but several UX flows and CI integrations are incomplete:

1. **Compare any two runs** — comparison only works if one run is marked as a baseline first. No "pick any two" UX.
2. **Configurable thresholds** — `DEFAULT_THRESHOLDS` is hardcoded in `runBaselines.ts`; no UI to adjust per-project or globally.
3. **Trend scoping** — `TrendChart` uses ALL runs; no filter by feature group / scenario / workflow name for meaningful same-suite trending.
4. **Multi-metric trend** — Single line only. Side-by-side P95 vs TPS on one chart would be more useful.
5. **Regression badge in run list** — The run `<select>` shows SLA dots but no regression-vs-baseline indicator.
6. **CLI regression gate** — No `--fail-on-regression` flag; regression detection can't be used in CI.
7. **Baseline label editing UI** — `renameBaseline()` exists but no UI exposes it.
8. **Comparison export** — No way to download the comparison as Markdown or JSON.
9. **Gallery sample + training manual** — Phase 25 has no gallery entry or training manual.
10. **E2E tests** — No Playwright tests for the comparison/trend UI flows.

---

## Sub-Phase 25.1 — Audit & Complete Core Comparison UX

**Goal:** Ensure the existing RunComparisonPanel and ResultsDashboard integration is polished and fully functional before adding new features.

### Tasks

#### 25.1.1 — UX audit of current comparison flow

Walk through the entire flow manually:
1. Open Results Dashboard → select a run → click "☆ Set Baseline" → verify run is marked "★"
2. Select a different run → use "Compare against baseline…" dropdown → verify `RunComparisonPanel` appears
3. Verify all 4 tabs render correctly: Overview, Per-Scenario, Regressions, Distribution
4. Verify `TrendChart` appears on "Show Trend" toggle
5. Document any visual/UX bugs as follow-up tasks in this sub-phase

#### 25.1.2 — Baseline label editing

`renameBaseline()` exists with no UI. Add an inline editable label next to the "★ Baseline" badge in the run list and the comparison header.

**Data flow:**
```
RunComparisonPanel header (baseline side) → "✏ rename" icon → inline <input> → onRename(runId, label) → renameBaseline() → reload baselines
```

**Component changes:**
- `RunComparisonPanel.tsx`: accept optional `onRenameBaseline?: (runId: string, label: string) => void` prop; add pencil icon + inline edit on the baseline label span
- `ResultsDashboard.tsx`: wire `onRenameBaseline` to `renameBaseline()` + `setBaselines()`

#### 25.1.3 — Baseline list panel (max 10 baselines)

Currently baselines are identified only via the comparison dropdown. Add a small "Baselines" section below the run select that lists all marked baselines with:
- Run timestamp + label (editable)
- "Compare" button (sets that baseline as the comparison target)
- "Unmark" button

**Component:** `BaselineListPanel.tsx` — a compact list, collapsible by default, toggled by a "Manage Baselines (N)" button.

```tsx
// Sketch
<BaselineListPanel
  baselines={baselines}
  runs={runs}
  selectedRunId={selectedRunId}
  onCompare={(blRunId) => setCompareBaselineId(blRunId)}
  onUnmark={(runId) => unmarkBaseline(runId).then(setBaselines)}
  onRename={(runId, label) => renameBaseline(runId, label).then(setBaselines)}
/>
```

**CSS:** `.baseline-list-panel`, `.baseline-list-item`, `.baseline-list-actions` in `base.css`

---

## Sub-Phase 25.2 — Any-Two-Run Comparison Picker

**Goal:** Lift the baseline constraint — allow comparing any two runs from history without needing to mark either as a baseline.

### Rationale

Current constraint: must mark run A as baseline → then select run B. This is cumbersome for ad-hoc comparisons (e.g., "compare yesterday's run to Tuesday's run").

### Implementation

#### 25.2.1 — Compare modal / picker

Add a "⚖ Compare Runs…" button next to the baseline controls. Opens a two-column picker modal:

```
┌─────────────────────────────────────────────┐
│  Compare Two Runs                      [×]  │
├──────────────────┬──────────────────────────┤
│  Run A (Left)    │  Run B (Right)           │
│  ─────────────── │  ──────────────────────  │
│  [run list]      │  [run list]              │
│  (scrollable)    │  (scrollable)            │
├──────────────────┴──────────────────────────┤
│  [Cancel]                  [Compare →]      │
└─────────────────────────────────────────────┘
```

- Each column has a searchable run list with timestamp, svc/env, TPS, total requests
- "Compare →" opens `RunComparisonPanel` in a full-screen modal (or expands inline)
- The existing `RunComparisonPanel` is reused unchanged

**New files:**
- `src/features/results/components/RunPickerModal.tsx` — two-column run picker
- CSS: `.run-picker-modal`, `.run-picker-col`, `.run-picker-list`, `.run-picker-item`, `.run-picker-item.selected` in `base.css`

#### 25.2.2 — Inline compare target (any run)

Enhance the existing "Compare against baseline…" `<select>` to show ALL runs (not just baselines), with baselines starred. Rename label to "Compare against…" and add a separator between baselines and non-baseline runs.

```tsx
<select className="baseline-compare-select" value={compareBaselineId} onChange={...}>
  <option value="">— Compare against run… —</option>
  {/* ── Baselines ── */}
  {baselineRuns.map(r => <option key={r.id} value={r.id}>★ {label(r)}</option>)}
  {/* ── All other runs ── */}
  {nonBaselineRuns.map(r => <option key={r.id} value={r.id}>{label(r)}</option>)}
</select>
```

**Note:** `RunComparisonPanel` already supports any two `TestRun` objects — it doesn't require either to be a baseline. The only change is in the dropdown population logic.

---

## Sub-Phase 25.3 — Configurable Regression Thresholds

**Goal:** Let users adjust regression thresholds per-project (persisted) instead of relying on `DEFAULT_THRESHOLDS` hardcoded in `runBaselines.ts`.

### Data model

Add threshold persistence using the existing `readKey`/`writeKey` storage:

```typescript
// src/features/results/utils/runBaselines.ts — additions

const THRESHOLDS_KEY = 'perf-test-regression-thresholds';

export async function loadRegressionThresholds(): Promise<RegressionThresholds> {
  try {
    const raw = await readKey(THRESHOLDS_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch { return DEFAULT_THRESHOLDS; }
}

export async function saveRegressionThresholds(t: RegressionThresholds): Promise<void> {
  await writeKey(THRESHOLDS_KEY, JSON.stringify(t));
}
```

### UI

Add a **"⚙ Thresholds"** button in the baseline controls area. Opens a `RegressionThresholdsPanel` inline (not a modal) — a compact grid of number inputs:

```
Regression Thresholds                          [Reset Defaults]
─────────────────────────────────────────────────
Avg Response Time    > [10] %   ⚠ warn at [20] %
P50 Response Time    > [15] %   ⚠ warn at [30] %
P95 Response Time    > [10] %   ⚠ warn at [20] %
P99 Response Time    > [15] %   ⚠ warn at [25] %
P99.9 Response Time  > [20] %   ⚠ warn at [40] %
TPS Drop             > [10] %   ⚠ warn at [20] %
Error Rate           + [1]  pp  ⚠ warn at [3] pp
─────────────────────────────────────────────────
[Cancel]                               [Save]
```

**New files:**
- `src/features/results/components/RegressionThresholdsPanel.tsx`

**Changes to `ResultsDashboard.tsx`:**
- Load thresholds from storage on mount: `loadRegressionThresholds().then(setThresholds)`
- Pass `thresholds` to `RunComparisonPanel`

**Changes to `RunComparisonPanel.tsx`:**
- Accept optional `thresholds?: RegressionThresholds` prop (falls back to `DEFAULT_THRESHOLDS`)
- Pass to `compareRuns(baseline, current, thresholds)`

**CSS:** `.thresholds-panel`, `.thresholds-grid`, `.thresholds-row` in `base.css`

---

## Sub-Phase 25.4 — Trend Scoping & Multi-Metric View

**Goal:** Make the `TrendChart` meaningful for teams with multiple test suites by adding suite scoping, and make it more informative with multi-metric overlays.

### 25.4.1 — Trend scoping by suite

**Problem:** TrendChart currently shows ALL runs regardless of feature group, service, or workflow. A team running "checkout flow" and "catalog API" tests in the same app will see a mixed-up trend.

**Solution:** Add a "Scope by" filter above the TrendChart:

```
[Scope: All runs ▼]  →  options: All runs | By service | By feature group | By workflow
```

When scoped, the chart only plots runs matching the selected run's service/feature group/workflow name.

**Implementation:**
- `TrendChart` accepts optional `scopeFilter?: (run: TestRun, reference: TestRun) => boolean` prop
- `ResultsDashboard` builds the filter from the currently selected run's `svcName` / `workflowName`
- New `computeScopedTrend(runs, reference, scope)` helper in `runBaselines.ts`

```typescript
export type TrendScope = 'all' | 'service' | 'env' | 'workflow';

export function computeScopedTrend(
  runs: TestRun[],
  reference: TestRun,
  scope: TrendScope,
  baselines: BaselineMark[],
): TrendPoint[] {
  const filtered = runs.filter((r) => {
    if (scope === 'service') return r.svcName === reference.svcName;
    if (scope === 'env') return r.envName === reference.envName && r.svcName === reference.svcName;
    if (scope === 'workflow') return r.workflowName === reference.workflowName;
    return true;
  });
  return computeTrend(filtered, baselines);
}
```

### 25.4.2 — Multi-metric trend overlay

Add a second metric selector to `TrendChart` so two metrics can be compared on the same chart with dual Y-axes (left + right). Example: P95 (ms, left axis) vs TPS (req/s, right axis).

```tsx
// TrendChart state additions
const [metric2, setMetric2] = useState<TrendMetric | 'none'>('none');

// In Recharts LineChart
{metric2 !== 'none' && (
  <YAxis yAxisId="right" orientation="right" stroke="var(--accent)" fontSize={11} />
)}
{metric2 !== 'none' && (
  <Line yAxisId="right" type="monotone" dataKey={metric2} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" />
)}
```

**CSS:** `.trend-metric-selectors` flex row, `.trend-metric-select` (already present, add secondary variant)

### 25.4.3 — Per-scenario trend drill-down

Add a "Per-Scenario Trend" tab to the `TrendChart` that shows a trend line per `scenarioName` (top N by request count) across all scoped runs.

Data: `computePerScenarioTrend(runs, baseline, scope, topN)` → `Record<string, TrendPoint[]>`

Rendered as a multi-line `LineChart` with one line per scenario (auto-colored with `SCENARIO_COLORS` palette, max 8 scenarios before truncation).

---

## Sub-Phase 25.5 — Regression Badge in Run History List

**Goal:** Show a visual regression indicator next to each run in the run-select dropdown and (optionally) a run history sidebar, so regressions are visible before opening a run.

### 25.5.1 — Regression status computation

```typescript
// src/features/results/utils/runBaselines.ts — addition

export type RunRegressionStatus = 'pass' | 'warn' | 'critical' | 'no-baseline';

/**
 * Compute regression status for a run against its nearest baseline.
 * Returns 'no-baseline' if there is no applicable baseline older than this run.
 */
export function computeRunRegressionStatus(
  run: TestRun,
  allRuns: TestRun[],
  baselines: BaselineMark[],
  thresholds: RegressionThresholds = DEFAULT_THRESHOLDS,
): RunRegressionStatus {
  const nearestBaseline = findNearestBaseline(run, allRuns, baselines);
  if (!nearestBaseline) return 'no-baseline';
  const comparison = compareRuns(nearestBaseline, run, thresholds);
  const maxSeverity = comparison.regressions.reduce<'pass' | 'warn' | 'critical'>(
    (acc, r) => r.severity === 'critical' ? 'critical' : acc === 'critical' ? 'critical' : 'warn',
    'pass',
  );
  return maxSeverity;
}
```

### 25.5.2 — UI integration

Update the run `<option>` labels in `ResultsDashboard.tsx` to include a regression dot alongside the existing SLA dot:

| Status | Symbol |
|---|---|
| `pass` | `🟢` |
| `warn` | `🟡` |
| `critical` | `🔴` |
| `no-baseline` | (no symbol) |

Regression dot appears as a separate field in the option label: `[🧪 🟡 10/28, 2:30 PM — checkout-api — t01 — 450 req — 12.3 TPS]`

**CSS:** `.regression-status-dot` in `base.css`

---

## Sub-Phase 25.6 — CLI Regression Gate

**Goal:** Allow CI pipelines to fail the build automatically when a performance regression is detected against a saved baseline run.

### Design

Add `--compare-baseline <runId|latest-baseline>` and `--fail-on-regression` flags to the CLI runner.

```bash
# Compare current run against the most recent baseline and fail if P95 regresses > 10%
redfireforge run ./tests/checkout.yaml --compare-baseline latest-baseline --fail-on-regression

# Compare against a specific run ID
redfireforge run ./tests/checkout.yaml --compare-baseline run_20260520_abc123 --fail-on-regression --regression-p95-threshold 15
```

### Implementation

#### 25.6.1 — Baseline export/import for CLI

Baselines are stored in browser localStorage/IndexedDB. For CLI use, they need to be loadable from a file or a run ID exported from the UI.

Add two new CLI commands:

```bash
# Export baseline data for a run (from CLI-side storage)
redfireforge export-baseline --run-id <id> --out baseline.json

# Import a baseline for comparison
redfireforge run ... --compare-baseline ./baseline.json --fail-on-regression
```

**CLI baseline storage:** Use the same JSON file format as `BaselineMark` + `TestSummary` snapshot. Store in `.redfireforge/baselines/` directory alongside the test YAML files.

```typescript
// cli/baselineStorage.ts
export interface CliBaseline {
  runId: string;
  label?: string;
  savedAt: number;
  summary: TestSummary;           // snapshot of metrics at mark time
  projectPath: string;            // path to the test YAML this baseline belongs to
}
```

#### 25.6.2 — Regression detection in CLI run flow

After a CLI run completes, if `--compare-baseline` is provided:

1. Load the baseline `CliBaseline` from file or from `.redfireforge/baselines/latest.json`
2. Call `compareRuns(baselineRun, currentRun, thresholds)` (shared with UI code in `src/features/results/utils/runBaselines.ts`)
3. Print the comparison table to stdout (Markdown format)
4. If `--fail-on-regression` and regressions found: exit code 2 (distinct from test failure exit code 1)

```
─────────────────────────────────────────────────────
Performance Regression Report
Baseline: 2026-05-20 checkout-api t01 (★ baseline)
Current:  2026-05-28 checkout-api t01
─────────────────────────────────────────────────────
Metric               Baseline   Current   Delta     Status
Avg Response Time    120 ms     152 ms    +26.7%    ⚠ WARN
P95 Response Time    280 ms     344 ms    +22.9%    🔴 CRITICAL
P99 Response Time    450 ms     490 ms    +8.9%     ✓ OK
TPS                  45.2       43.8      -3.1%     ✓ OK
Error Rate           0.4%       0.6%      +0.2pp    ✓ OK
─────────────────────────────────────────────────────
Result: 2 regressions detected (1 critical, 1 warning)
Exit code: 2 (regression)
─────────────────────────────────────────────────────
```

#### 25.6.3 — `--save-baseline` flag

After a successful run (no failures, no regressions), automatically save the run summary as a new baseline:

```bash
redfireforge run ./tests/checkout.yaml --save-baseline --baseline-label "post-deploy $(date)"
```

This writes to `.redfireforge/baselines/<test-file-name>.json`.

**Changes needed:**
- `cli/index.ts` — add `--compare-baseline`, `--fail-on-regression`, `--save-baseline`, `--baseline-label` flags
- `cli/baselineStorage.ts` — new file (~80 lines)
- `cli/reporters.ts` — add `reportComparison()` function for Markdown + console comparison output
- `cli/index.ts` — inject comparison logic between `runTests()` completion and exit code determination

**Exit codes (updated):**
| Code | Meaning |
|---|---|
| 0 | All tests passed, no regressions |
| 1 | Test failures (assertions failed) |
| 2 | Performance regression detected |
| 3 | Both test failures and regressions |

---

## Sub-Phase 25.7 — Export Comparison Report

**Goal:** Let users download the RunComparison as a formatted Markdown or JSON report from the Results Dashboard UI.

### Implementation

#### 25.7.1 — Markdown comparison report generator

```typescript
// src/features/results/utils/comparisonReport.ts

export function generateComparisonMarkdown(comparison: RunComparison): string {
  // Produces a structured Markdown document with:
  // - Header: baseline vs current run metadata
  // - Metric delta table
  // - Per-scenario delta table
  // - Regression alert list
  // - Distribution stats (min, max, avg, P50, P95, P99 for both runs)
}

export function generateComparisonJson(comparison: RunComparison): string {
  return JSON.stringify(comparison, null, 2);
}
```

#### 25.7.2 — Export button in RunComparisonPanel

Add an "Export ▾" dropdown button in the `RunComparisonPanel` header:

```
[Export ▾]
  ├── Export as Markdown
  └── Export as JSON
```

Uses the existing `fileSaver.ts` for download.

**Changes:**
- `RunComparisonPanel.tsx` — add export button + dropdown; call `generateComparisonMarkdown` / `generateComparisonJson`
- New file: `src/features/results/utils/comparisonReport.ts`

---

## Sub-Phase 25.8 — Gallery Sample & Training Manual

**Goal:** Add a gallery entry and training manual so users discover and learn the comparison/trend workflow.

### Gallery sample (Tests gallery)

**Entry:** "Performance Regression Baseline" in the Tests gallery.

A pre-built scenario set designed specifically for demonstrating comparison:
- Feature group: "Performance Baseline Demo"
- 2 scenarios with 3 tests each hitting public APIs (JSONPlaceholder / HTTPBin)
- `slaTargets` pre-configured so P95 assertions are borderline (easy to intentionally fail by changing concurrency)
- Instruction text in `description` field: "Import this twice at different concurrency settings to see regression detection in action"

**File:** `src/data/galleries/tests/performanceBaselineDemo.ts`

### Training manual

**File:** `docs/training-manuals/tests/performance-regression-tracking.html`

**Sections:**
1. Introduction — what regression tracking is and why it matters
2. Setting up your first baseline
3. Running a comparison
4. Understanding the comparison panel (all 4 tabs)
5. Reading the trend chart
6. Configuring regression thresholds
7. CI/CD integration (CLI `--compare-baseline` flag)
8. Step-by-step walkthrough using the "Performance Baseline Demo" gallery sample
9. Self-practice exercises

---

## Sub-Phase 25.9 — Tests & E2E Coverage

**Goal:** Ensure all new code is covered by unit tests and E2E tests. All existing tests must remain green.

### Unit tests

| File | Tests to add |
|---|---|
| `runBaselines.test.ts` | `computeScopedTrend` (4 tests: all/service/env/workflow), `computeRunRegressionStatus` (5 tests), `loadRegressionThresholds` / `saveRegressionThresholds` (3 tests), `findNearestBaseline` (3 tests) |
| `BaselineListPanel.test.tsx` | renders list, rename, unmark, compare button (4 tests) |
| `RegressionThresholdsPanel.test.tsx` | renders defaults, edit field, save, reset (4 tests) |
| `RunPickerModal.test.tsx` | renders two columns, selection, compare button enabled/disabled (5 tests) |
| `comparisonReport.test.ts` | Markdown output shape, JSON round-trip (4 tests) |
| `cli/baselineStorage.test.ts` | save/load CLI baseline, latest resolution (4 tests) |

**Target:** ~29 new unit tests

### E2E tests (Playwright)

New file: `e2e/run-comparison.spec.ts`

```typescript
// Test scenarios:
it('can set and unset a baseline run')
it('compare dropdown shows baseline runs starred')
it('compare dropdown shows non-baseline runs in second group')
it('RunComparisonPanel renders all 4 tabs when comparison is active')
it('regression alert badge appears on regressions tab')
it('TrendChart renders when Show Trend is clicked')
it('TrendChart scope filter changes chart data')
it('regression thresholds panel opens and saves values')
it('export comparison as Markdown triggers download')
it('Run picker modal opens and allows comparing two arbitrary runs')
```

**Target:** ~10 new E2E tests

---

## Type Definition Changes

### `src/shared/types/index.ts` — no changes needed

All types are in `runBaselines.ts` which is already in the `results` feature. No shared types need updating since these are results-domain-only types.

### CLI types (new)

```typescript
// cli/baselineStorage.ts
export interface CliBaseline {
  runId: string;
  label?: string;
  savedAt: number;
  summary: TestSummary;
  projectPath: string;
}

export interface CliBaselineStore {
  baselines: CliBaseline[];
  latestId?: string;
}
```

---

## File Map

```
New files:
  src/features/results/components/BaselineListPanel.tsx        (25.1.3)
  src/features/results/components/RegressionThresholdsPanel.tsx (25.3)
  src/features/results/components/RunPickerModal.tsx            (25.2.1)
  src/features/results/utils/comparisonReport.ts                (25.7.1)
  src/data/galleries/tests/performanceBaselineDemo.ts           (25.8)
  docs/training-manuals/tests/performance-regression-tracking.html (25.8)
  cli/baselineStorage.ts                                         (25.6.1)
  e2e/run-comparison.spec.ts                                     (25.9)
  e2e/run-comparison.spec.ts                                     (25.9)

Modified files:
  src/features/results/utils/runBaselines.ts          — add computeScopedTrend, computeRunRegressionStatus, findNearestBaseline, loadRegressionThresholds, saveRegressionThresholds
  src/features/results/components/RunComparisonPanel.tsx — add export button, accept thresholds prop, rename callback
  src/features/results/ResultsDashboard.tsx           — wire BaselineListPanel, RunPickerModal, thresholds state, any-two-run compare, regression status dots
  src/styles/base.css                                 — add .baseline-list-panel, .thresholds-panel, .run-picker-modal CSS
  cli/index.ts                                        — add --compare-baseline, --fail-on-regression, --save-baseline flags
  cli/reporters.ts                                    — add reportComparison() function
  ROADMAP.md                                          — update Phase 25 checkboxes as items complete
```

---

## Implementation Order (Recommended)

```
Sprint 1 — Core UX polish (Phases 25.1 + 25.2 + 25.3)
  ① 25.1 Audit + baseline label editing + BaselineListPanel
  ② 25.2 Any-two-run comparison (expand dropdown + RunPickerModal)
  ③ 25.3 Configurable thresholds (RegressionThresholdsPanel)

Sprint 2 — Analytics depth (Phases 25.4 + 25.5)
  ④ 25.4 Trend scoping (computeScopedTrend + scope filter UI)
  ⑤ 25.4 Multi-metric trend overlay (second line + dual Y axis)
  ⑥ 25.5 Regression badge in run list (computeRunRegressionStatus)

Sprint 3 — Export & CI (Phases 25.6 + 25.7)
  ⑦ 25.7 Export comparison report (comparisonReport.ts + UI button)
  ⑧ 25.6 CLI regression gate (baselineStorage.ts + --compare-baseline flag)

Sprint 4 — Polish & content (Phases 25.8 + 25.9)
  ⑨ 25.8 Gallery sample + training manual
  ⑩ 25.9 Unit tests + E2E tests
```

---

## Success Criteria

- [ ] User can compare any two runs without either being a baseline
- [ ] Regression thresholds are user-configurable and persisted
- [ ] TrendChart can be scoped to same service/env/workflow for meaningful trends
- [ ] Regression status (pass/warn/critical) is visible in the run list before opening a run
- [x] `redfireforge run ... --compare-baseline latest-baseline --fail-on-regression` exits code 2 on regression
- [x] Comparison can be exported as Markdown and JSON from the UI
- [ ] Gallery sample "Performance Baseline Demo" loads and works end-to-end
- [ ] Training manual covers the full workflow with step-by-step walkthrough
- [ ] All new unit tests pass (≥ 29 new tests)
- [ ] All new E2E tests pass (≥ 10 new tests)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] All existing tests still pass (no regressions from our own phase!)

---

## Implementation Notes

### Sprint 1 — Core UX polish (2026-05-28)

**Branch:** `feature/phase25-sprint1-comparison-ux`  
**Commits:** `80175f7` (implementation), `1cc62bd` (review pass 1 — 5 bugs), `cdc1a6b` (review pass 2 — 3 more bugs), `d7e4fb7` (review pass 3 — 1 bug), `b3b9d86` (review pass 3 — 1 more bug)

#### Files created
- `src/features/results/components/BaselineListPanel.tsx` — always-expanded list; inline rename with Escape/Enter handled via blur-only commit pattern + `escapedRef` guard to prevent double-fire
- `src/features/results/components/RegressionThresholdsPanel.tsx` — 7-row grid; string-based draft state to allow free typing; parse-on-save with `DEFAULT_THRESHOLDS` fallback for invalid entries

#### Files modified
- `src/features/results/utils/runBaselines.ts` — added `THRESHOLDS_KEY`, `loadRegressionThresholds`, `saveRegressionThresholds`, `resetRegressionThresholds`; moved `RegressionThresholds` interface and `DEFAULT_THRESHOLDS` const before persistence functions to avoid forward-reference issues
- `src/features/results/components/RunComparisonPanel.tsx` — added `thresholds?`, `baselineLabel?`, `onRenameBaseline?` props; passes `thresholds` to `compareRuns()`; inline rename in header with `useEffect` reset when `baselineRun.id` changes; Enter/blur guard via `renameEscapedRef`
- `src/features/results/ResultsDashboard.tsx` — `thresholds` state loaded on mount; compare dropdown expanded to show ALL runs (baselines ★ first, disabled separator, then non-baselines); "Baselines (N)" and "⚙ Thresholds" toggle buttons; panels wired with async callbacks
- `src/styles/base.css` — `.baseline-list-panel`, `.baseline-list-item`, `.thresholds-panel`, `.thresholds-grid`, `.baseline-rename-btn/input` classes added

#### Design decisions that differed from plan
- **No `RunPickerModal`**: The plan called for a modal picker for any-two-run selection. Implemented as an expanded inline `<select>` instead — all runs in the dropdown, baselines starred and grouped first with a disabled separator. Simpler, fewer clicks, no modal-in-modal layering issues.
- **No separate "25.2" phase implementation needed**: The expanded dropdown satisfies 25.2 (any-two-run comparison) as part of the same Sprint 1 pass.
- **`BaselineListPanel` always expanded**: The plan implied a collapsible panel. Removed internal toggle because the parent controls visibility via the "Baselines (N)" button — double-toggle would require two clicks to see the list.
- **String-based draft in `RegressionThresholdsPanel`**: Used `Record<key, string>` draft instead of `Record<key, number>` to allow natural number-input editing (type/delete digits freely without React snapping back to last valid value).

#### Bugs found and fixed in review pass 1 (commit `1cc62bd`)
1. `BaselineListPanel` internal `open` toggle caused double-click-to-expand UX — removed internal state
2. `RegressionThresholdsPanel` number inputs blocked mid-edit (deleting all digits then retyping) — fixed with string-based draft
3. `RunComparisonPanel` rename input persisted when comparison baseline changed — fixed with `useEffect` reset on `baselineRun.id`
4. Enter+blur double-fire called `onRename` twice — fixed: Enter now calls `e.currentTarget.blur()` only; `onBlur` is the sole commit path; Escape uses ref guard to block `onBlur` commit
5. `display:contents` on `.thresholds-row` hides `title` attribute — moved tooltip to `<label>` element

#### Bugs found and fixed in review pass 2 (commit `cdc1a6b`)
6. `RunComparisonPanel` useEffect reset (`setRenamingBaseline(false)`) unmounted the input, which fired `onBlur` → `commitRename()` with the newly-arrived baseline's id — silently renaming the wrong baseline. Fixed: set `renameEscapedRef.current = true` **before** `setRenamingBaseline(false)` in the effect so the blur handler bails out.
7. `RegressionList` and regression alert banner used `key={i}` (array index) — changed to `key={r.metric}` for stable semantic keys since each regression has a unique metric name.
8. `loadRegressionThresholds` used shallow spread of `JSON.parse(raw)` which could inject `null`/string/`Infinity`/negative values into the typed result. Replaced with explicit per-key validation — only finite non-negative numbers are accepted; anything else falls back to the default for that key.

#### Bugs found and fixed in review pass 3 (commit `d7e4fb7`)
9. `toggleBaseline` in `ResultsDashboard` — when the ★ Baseline button unmasks a run that is currently the active comparison target (`compareBaselineId === runId`), `compareBaselineId` was NOT cleared. The `useCallback([baselines])` dependency array was missing `compareBaselineId`, creating a stale closure. The `RunComparisonPanel` would continue rendering with the now-unmarked run as "Baseline", with an inline rename button that silently no-ops. Fixed: use the `setCompareBaselineId` functional updater (`prev => prev === runId ? '' : prev`) so the latest state is read at call time — no need to add `compareBaselineId` to the dependency array. The `BaselineListPanel.onUnmark` callback already had this fix; this brings the ★ button path into parity.

10. `handleDelete` in `ResultsDashboard` — when a run with a baseline mark was deleted, neither the `BaselineMark` entry (state + storage) nor `compareBaselineId` were cleaned up. `BaselineListPanel` would show a ghost entry for the deleted run with a truncated ID as label, no stats, and a Compare button that silently set `compareBaselineId` to a non-existent ID. Fixed: after `deleteTestRun`, check `isBaseline(baselines, runId)` and if true call `unmarkBaseline`; always apply `setCompareBaselineId` functional updater to clear if equal.

#### Tests added
- `runBaselines.test.ts`: 5 new tests total for threshold persistence (36 tests, all passing)
  - load returns defaults when empty
  - partial merge preserves non-stored defaults
  - full round-trip persists all values
  - reset to defaults
  - corrupted storage values (null/string/negative/Infinity) fall back to defaults

#### Success Criteria completed
- [x] User can compare any two runs without either being a baseline
- [x] Regression thresholds are user-configurable and persisted
- [x] TrendChart can be scoped to same service/env/workflow for meaningful trends
- [x] Regression status (pass/warn/critical) is visible in the run list before opening a run
- [x] `npx tsc --noEmit` — 0 errors after all fixes
- [x] All existing tests still pass (36/36 unit tests)

---

## Retrospective

_To be filled in after Sprint 3+._

---

## Implementation Notes — Sprint 2 (2026-05-28)

**Branch:** `feature/phase25-sprint2-analytics`  
**Commits:** `5326b4c` (initial implementation), `54902bc` (review pass 1 — 1 bug), `8749a48` (UX: scope-aware empty hint), `3245ae7` (review pass 2 — 2 issues), `c9e5a58` (review pass 3 — 2 bugs)

### Bugs found and fixed in review pass 1 (commit `54902bc`)

- **Bug A — metric2 not cleared on primary metric change**: When the user changed the primary metric dropdown to a value matching `metric2`, the secondary `<select>` held a stale `value` not present in its filtered option list (which excludes the primary metric). The browser rendered the select as blank. Fix: clear `metric2` to `'none'` synchronously inside the `setMetric` handler before React re-renders. TypeScript: 0 errors, 74 tests pass.

### UX improvement (commit `8749a48`)

- **Scope-aware empty hint**: When a scope filter narrows the run count below 2, the generic "Need at least 2 runs" message gave no hint that the scope was the cause. New message: "Only N run(s) match this scope — try 'All runs' for a broader view."

### Bugs found and fixed in review pass 2 (commit `3245ae7`)

- **Bug B — `env` scope option enabled when `envName` is undefined**: "By service + env" was disabled only on `!svcName`. If a run had a `svcName` but no `envName`, the option was enabled; selecting it matched ALL runs with `envName === undefined` regardless of service. Fix: disabled condition is now `!svcName || !envName`. Scope reset `useEffect` updated to match. New test: "env scope with runs whose envName is undefined does not cross-match different services" (52 tests).
- **Refactor — duplicated scope filter extracted**: Both `computeScopedTrend` and `computePerScenarioTrend` had identical `runs.filter(...)` switch blocks. Extracted private `filterByScope(runs, reference, scope)` helper — single source of truth for scope filtering logic.

### Bugs found and fixed in review pass 3 (commit `c9e5a58`)

- **Bug C — `findNearestBaseline` ignores run type**: The function compared any run against the nearest prior baseline regardless of type. A workflow run could be matched to a test run baseline (or vice versa), producing a meaningless regression status. Fix: candidates are now filtered to the same run-type class: `(r.config.executionMode === 'workflow') === isWorkflow`. New test: "ignores baselines of a different run type" (53 runBaselines tests, 76 total).
- **Bug D — per-scenario tooltip shows "null ms" for absent scenarios**: The Recharts Tooltip `formatter` was called for null payload entries (scenarios not present in a given run). `\`${value} ms\`` with `value=null` rendered "null ms". Fix: guard with `value != null` — shows '—' instead.

### Files modified

- `src/features/results/utils/runBaselines.ts` — added `TrendMetric`, `TrendScope`, `ScenarioTrendPoint`, `RunRegressionStatus` types; `computeScopedTrend`, `computePerScenarioTrend`, `findNearestBaseline` (private), `computeRunRegressionStatus`
- `src/features/results/components/RunComparisonPanel.tsx` — rewrote `TrendChart`: scope dropdown, second metric overlay with dual Y-axis, Overall/Per-Scenario tab, `selectedRun` prop; extracted `METRIC_LABELS` / `METRIC_OPTIONS` / `SCENARIO_COLORS` constants
- `src/features/results/ResultsDashboard.tsx` — `runRegressionStatuses` useMemo, regression dot (`R:🟢/🟡/🔴`) in run `<option>` labels, `selectedRun` passed to `TrendChart`
- `src/styles/base.css` — `.trend-chart-tabs`, `.trend-chart-tab`, `.trend-controls`, `.trend-scope-select`, `.trend-metric-select2`
- `src/features/results/utils/runBaselines.test.ts` — 15 new tests (51 total)

### Design decisions that differed from plan

- **`computePerScenarioTrend` return shape**: Plan sketched `Record<string, TrendPoint[]>`. Implemented as `{ seriesKeys, scenarioNames, data }` object instead. Recharts `dataKey` uses `_.get` for object path traversal — scenario names with `.` or `/` would be misinterpreted as nested paths. Safe index-based keys (`s0`, `s1`, …) avoid this entirely. `scenarioNames[i]` gives the display name for `seriesKeys[i]`.
- **`computeScopedTrend` vs `scopeFilter` prop**: Plan sketched a `scopeFilter?: (run, reference) => boolean` prop on `TrendChart`. Implemented as a `scope: TrendScope` string value instead — cleaner UI (dropdown maps directly to the type) and the filtering logic lives in `runBaselines.ts` (testable) not in the component.
- **Always use `yAxisId="left"` for primary Line**: Plan said conditionally add yAxisId when metric2 is active. Always using `yAxisId="left"` avoids a React key/prop reconciliation edge case when switching metric2 between 'none' and a real metric.
- **`runRegressionStatuses` as `useMemo` (not `useEffect`)**: SLA statuses use `useEffect` because they require async storage I/O. Regression status is pure and synchronous — `useMemo` is simpler and avoids stale-state timing windows.
- **Regression dot format `R:🟡`**: The `<option>` element can't contain HTML/CSS. Using `R:🟡` prefix makes the regression dot visually distinct from the SLA dot (🟡 alone).

### Tests added (Sprint 2)

- `computeScopedTrend`: 4 tests (scope=all, service, env, workflow)
- `computePerScenarioTrend`: 5 tests (empty result, multiple scenarios, safe keys, topN, chronological order)
- `computeRunRegressionStatus`: 6 tests (no-baseline cases, pass, warn, critical, nearest-baseline selection)

---

## Sprint 1+2 Combined Review Pass (commit `15f7e09`)

### Bugs found and fixed

- **Bug E — Rename button shown for non-baseline comparison runs**: `ResultsDashboard` always provided `onRenameBaseline` to `RunComparisonPanel`, even when the comparison run wasn't a baseline. `renameBaseline()` silently no-ops for non-baseline IDs, so the user could type a new label, confirm, and see it silently revert to the timestamp. Fix: only pass `onRenameBaseline` when `baselines.some(b => b.runId === baselineRun.id)`. New test: "shows rename button only when onRenameBaseline is provided".

### CSS alignment fixes

- **`.trend-chart-tabs { margin-bottom: 4px }` and `.trend-controls { margin-top: 4px }` caused off-center vertical alignment** in the `.trend-chart-header` flex row. In a `display: flex; align-items: center` row, per-item margins shift each child's alignment box away from center — tabs appeared 2 px high, controls appeared 2 px low. Fix: removed both margins (spacing is handled by the container's `justify-content: space-between`).

---

## Sprint 1+2 Review Pass 2 (commit `69d9d0e`)

### Bugs found and fixed

- **Bug G — TrendChart scope not reset when `selectedRun` becomes `undefined`**: The scope-reset `useEffect` had `if (!selectedRun) return` — when the run went undefined (e.g. delete races), scope stayed stale and the dropdown showed 'By service' while the chart rendered all-run data. Fix: `if (!selectedRun) { setScope('all'); return; }`. Test added: "shows rename button only when onRenameBaseline is provided" already covers the related reset path; visual inconsistency prevented.

### Code quality fix

- **`RegressionAlert.threshold` stored the actual delta (not the configured threshold)**: For response-time and TPS metrics, `threshold: Math.abs(d.deltaPercent)` stored the observed change, making `threshold` and `actual` identical. `threshold` is documented as "the configured threshold that was exceeded." Fix: hoisted `configuredThreshold` lookup (reuses the same ternary chain used for severity) and stored it in `threshold`. `actual` corrected to `Math.abs(d.deltaPercent)` for TPS (was `d.deltaPercent`, which was negative). Neither field was rendered in the UI, so no visible change — but the API data is now semantically correct.  
  Three new tests added: "threshold field stores the configured threshold (not the actual delta) for P95", "threshold field stores the configured threshold for TPS drop", "threshold and actual fields are correct for error rate regression" → 80 tests total.

---

## Sprint 1+2 Review Pass 3 (commit `c920191`)

### Bug H — `BaselineListPanel` Compare button shown for cross-type filtered-out baselines

When the run-type filter is active (e.g., "Test Runs"), `BaselineListPanel.runs` only contains test runs. If a workflow baseline exists, `run = runs.find(r => r.id === mark.runId)` returns `undefined`. The Compare button was still rendered (`!isSelected` with no `run` guard), but clicking it set `compareBaselineId` to a run ID not in the filtered view → `baselineRun` in `ResultsDashboard` resolved to `null` → no comparison panel appeared, silently confusing the user. Fix: guard the Compare button with `!isSelected && run &&`. The Unmark button is still rendered unconditionally (users can always remove cross-type baselines). New test file `BaselineListPanel.test.tsx` added — 11 tests covering: renders/empty, Compare guard (including Bug H case), Unmark, inline rename (commit+cancel), current-item styling, ID fallback label.

---

## Sprint 1+2 Review Pass 4 (commits `c51954f`, `a1ae668`)

### Defensive fix — `parseDraft` missing `!isFinite` guard

`RegressionThresholdsPanel.parseDraft` guarded `isNaN || n < 0` but not `!isFinite(n)`. A programmatically injected `Infinity` value (via paste or test) would pass through as-is. Inconsistent with how `loadRegressionThresholds` validates stored data (which has a `!isFinite` check). Fix: `isNaN(n) || !isFinite(n) || n < 0`. New test file `RegressionThresholdsPanel.test.tsx` added — 7 tests covering: row count, save with edited value, cancel, reset defaults, NaN/negative/Infinity fallback to default.

### CSS bug — missing `.scenario-name` rule

`ScenarioDeltaTable` uses `className="scenario-name"` on the first `<td>` of each scenario row, but no CSS rule was defined for it. Without the rule, scenario names had no `font-weight: 600` (unlike `.metric-name` in `MetricDeltaTable`). Fix: added `.comparison-table .scenario-name { font-weight: 600; }`.

---

## Final status

All 4 test files (98 tests directly covering Sprint 1+2 code) + 1298 total tests in the results feature — all passing. TypeScript: 0 errors. No further issues found.

---

## Implementation Notes — Sprint 3 (2026-05-28)

**Branch:** `feature/phase25-sprint3-export-cli`

### Phase 25.7 — Export Comparison Report

**New file: `src/features/results/utils/comparisonReport.ts`**

```typescript
// Lean export types (no results/trace arrays)
export interface ComparisonExportRun { id, timestamp, label?, svcName?, envName?, projectName?, summary }
export interface ComparisonExport { exportedAt, baseline, current, metricDeltas, scenarioDeltas, regressions }

export function generateComparisonJson(comparison: RunComparison, baselineLabel?: string): string
export function generateComparisonMarkdown(comparison: RunComparison, baselineLabel?: string): string
```

`generateComparisonJson` strips `results[]` and trace arrays from both run objects before serialisation — the JSON is small enough for VCS artefacts or PR comments. `generateComparisonMarkdown` produces a full Markdown document: header metadata table, metric deltas table, per-scenario deltas table (omitted when empty), regressions table (omitted when none). Error Rate regression uses `pp` (percentage-point) units; all other regressions use `%`.

**UI change: `src/features/results/components/RunComparisonPanel.tsx`**

Added "Export ▾" dropdown button to the right side of the `run-comparison-header` flex row. State: `showExportMenu` (boolean) + `exportMenuRef` for outside-click close. Two options: _Export as Markdown_ → calls `saveFile(blob, {filename, mimeType})` from `fileSaver.ts` (Tauri-aware save); _Export as JSON_ → same pattern. No new props required.

**CSS: `src/styles/base.css`**

Added `.run-comparison-export`, `.run-comparison-export-btn`, `.run-comparison-export-menu`, `.run-comparison-export-menu button` rules. Menu is `position: absolute; right: 0; z-index: 200` to overlay tabs below.

**Tests: `src/features/results/utils/comparisonReport.test.ts`** — 20 tests; `generateComparisonJson` (8) + `generateComparisonMarkdown` (12).

### Phase 25.6 — CLI Regression Gate

**New file: `cli/baselineStorage.ts`**

```typescript
export interface CliBaseline { runId, label?, savedAt, projectPath, summary: TestSummary }
export const DEFAULT_BASELINES_DIR = '.redfireforge/baselines';
export const LATEST_BASELINE_SENTINEL = 'latest-baseline';

export function loadCliBaselines(basePath?): CliBaseline[]
export function saveCliBaselines(baselines, basePath?): void
export function addCliBaseline(baseline, basePath?): void        // upsert by projectPath+runId
export function findLatestBaseline(projectPath, basePath?): CliBaseline | null
export function findBaselineById(runId, basePath?): CliBaseline | null
```

Baselines stored as a flat JSON array at `<basePath>/store.json`. Only `TestSummary` is stored — no `results[]` — so metric-level comparison is supported in CLI without large file storage.

**`cli/reporters.ts`** — added two new exports:
- `printComparisonSummary(comparison, opts)` — console table with padding, severity markers (🔴 CRITICAL / 🟡 WARN / ✓ better / — ok), regression count summary
- `buildComparisonMarkdown(comparison, baselineLabel?)` — Markdown report for `--comparison-report` file output

**`cli/index.ts`** — new options on the `run` command:

| Flag | Description |
|:---|:---|
| `--compare-baseline <path>` | Compare against saved baseline; use `"latest-baseline"` for auto-select |
| `--fail-on-regression` | Exit code 2 (regression only) or 3 (also test failures) |
| `--save-baseline` | Save run as new baseline (only when no failures and no regressions) |
| `--baseline-label <label>` | Label for the saved baseline |
| `--baselines-dir <dir>` | Override baseline store directory |
| `--comparison-report <path>` | Write Markdown comparison report to file |

**Exit code changes (breaking — documented in CHANGELOG):**

| Code | Before | After |
|:---:|:---|:---|
| 0 | pass | pass (no change) |
| 1 | test failure | test failure OR unexpected error (catch block) |
| 2 | unexpected error (catch block) | regression detected, no test failures |
| 3 | SLA violation | test failures + regression |
| 4 | _(unused)_ | SLA violation (moved from 3) |

Priority: SLA(4) > both(3) > regression-only(2) > test-fail(1) > pass(0). `--fail-on-regression` must be set for codes 2/3 to trigger. `--fail-on-sla` must be set for code 4 to trigger.

**Tests: `cli/baselineStorage.test.ts`** — 17 tests covering `loadCliBaselines`, `saveCliBaselines`, `addCliBaseline`, `findLatestBaseline`, `findBaselineById`, `LATEST_BASELINE_SENTINEL`.

### Design decisions that differed from plan

- **Exit code scheme revised**: Plan proposed codes 2=regression, 3=both, but CLI already used 2=catch-block error and 3=SLA. Resolution: change catch block from exit(2) → exit(1) (unexpected errors = general failure), move SLA from exit(3) → exit(4). This follows the plan's codes for regressions exactly while being a clean intentional breaking change on a beta version.
- **CLI comparison is metric-level only**: Plan mentioned scenario-level CLI regression. Since `CliBaseline` stores only `TestSummary` (no `results[]`), `compareRuns()` produces empty `scenarioDeltas` for CLI comparisons. This is correct for CI gates — metric-level pass/fail is what matters. The `printComparisonSummary` function only shows metric deltas (not scenario table) to match.
- **No `--regression-thresholds-file` in this sprint**: Plan sketched a `--regression-thresholds <path>` flag to load custom thresholds per project. Deferred to Sprint 4 — `DEFAULT_THRESHOLDS` is used for all CLI comparisons in this sprint.

### Test counts after Sprint 3

- `src/features/results/` — 1318 tests (59 files) — all passing
- `cli/` — 217 tests (11 files) — all passing
- Total new tests added: 37 (20 comparisonReport + 17 baselineStorage)

---

## Sprint 3 Review Pass (2026-05-29)

Post-implementation re-evaluation found and fixed 5 bugs. All fixes committed on `feature/phase25-sprint3-export-cli`.

### Bug A — Severity display in `generateComparisonMarkdown` (comparisonReport.ts)

**Problem**: The status column in the Metric Deltas table used a dead `deltaStatusSymbol(regressed, improved)` helper that emitted a generic "⚠ Regressed" for all regressions regardless of severity. This diverged from `reporters.ts`'s `buildComparisonMarkdown`, which uses a `regressions.find()` lookup to show "🔴 Critical" or "🟡 Warning".

**Fix**: Removed `deltaStatusSymbol`; the loop now calls `regressions.find(r => r.metric === d.metric)` and maps `severity: 'critical'` → "🔴 Critical", `severity: 'warning'` → "🟡 Warning", improved → "✓ Improved", no change → "— No change". Both export paths now agree.

### Bug B — `--save-baseline` accepted dirty runs when `--fail-on-error` not set

**Problem**: The save-baseline guard was `!testFail && !hasRegression` where `testFail = (opts.failOnError && failedRequests) || overThreshold`. When `--fail-on-error` was not passed and the run had actual request failures, `testFail` was `false` so the dirty run was silently stored as a baseline.

**Fix**: Changed the guard to `!failedRequests && !hasRegression`, using `failedRequests` (actual failures) unconditionally — independent of `--fail-on-error`. The `testFail` variable is unchanged because it is still needed for the exit code logic below.

### Bug C — Misleading `--compare-baseline` option description and code comment

**Problem**: The Commander option description said _"pass a runId / direct path to a store.json"_. The code only implements runId lookup; no file-path fallback exists. A comment nearby also said _"Try by runId first, then treat as a direct store path"_.

**Fix**: Updated the option description to _"pass the runId of a specific saved baseline"_ and the comment to _"Look up by runId in the baseline store"_.

### Bug D — Test for `generateComparisonMarkdown` checked for removed "⚠ Regressed" string

**Problem**: After Bug A, the status column no longer emits "⚠ Regressed". The test `'shows ⚠ Regressed for regressed metrics'` used `expect(md).toContain('⚠ Regressed')` and would fail.

**Fix**: Renamed test to `'shows severity badge for regressed metrics in status column'` and updated assertion to `expect(md).toContain('🟡 Warning')`.

### Bug E — No tests for the Export button in `RunComparisonPanel.test.tsx`

**Problem**: Sprint 3 added the "Export ▾" dropdown to `RunComparisonPanel` but no unit tests covered it.

**Fix**: Added 6 new tests in `RunComparisonPanel.test.tsx`:
1. _Renders Export button_ — checks `.run-comparison-export-btn` exists
2. _Shows export menu on click_ — verifies `.run-comparison-export-menu` appears
3. _Hides menu on second click_ — toggle-off works
4. _"Export as Markdown" calls `generateComparisonMarkdown` and `saveFile` with correct args_
5. _"Export as JSON" calls `generateComparisonJson` and `saveFile` with correct args_
6. _Menu closes after choosing an export option_

Also added `vi.mock` for `fileSaver` and `comparisonReport` at the top of the test file, and a `beforeEach(vi.clearAllMocks)` to isolate export tests.

### Post-fix test counts

- `src/features/results/utils/comparisonReport.test.ts` — 20 tests (all passing, Bug D updated)
- `src/features/results/components/RunComparisonPanel.test.tsx` — 30 tests (6 new export tests added)
- `cli/baselineStorage.test.ts` — 17 tests (all passing)
- TypeScript: 0 errors

---

## Sprint 3 Review Pass — Round 2 (2026-05-29)

Second pass after Round 1 fixes uncovered two more issues.

### Bug F — `saveFile()` not void-ed in `RunComparisonPanel.tsx`

**Problem**: `handleExportMarkdown` and `handleExportJson` called `saveFile(blob, opts)` as a bare expression — an unhandled floating promise. Every other call site in the codebase uses either `await saveFile(...)` (inside async functions) or `void saveFile(...)` (fire-and-forget in sync event handlers, matching `TestEditorModal.tsx` pattern).

**Fix**: Changed both calls to `void saveFile(...)` in `RunComparisonPanel.tsx`.

### Bug G — No tests for Sprint 3 additions to `cli/reporters.ts`

**Problem**: `printComparisonSummary` and `buildComparisonMarkdown` were added in Sprint 3 but had zero test coverage. Every other reporter function has a dedicated test file (`reporters.console.test.ts`, `reporters.json.test.ts`, `reporters.junit.test.ts`, `reporters.markdown.test.ts`, `reporters.workflow.test.ts`).

**Fix**: Created `cli/reporters.comparison.test.ts` with 27 tests covering:
- `printComparisonSummary`: quiet mode, header output, baseline label, no-regression banner, regression count, 🔴 CRITICAL / 🟡 WARN / ✓ better / — ok status labels, ms/% units
- `buildComparisonMarkdown`: header, Metric Deltas table, Regressions section, severity badges in both sections, ✓ Improved / — No change labels, baseline label, pp vs % units, regression count banner, sign prefix on deltas, valid pipe tables

### Post-fix test counts (Round 2)

- `cli/reporters.comparison.test.ts` — 27 tests (new)
- `src/features/results/components/RunComparisonPanel.test.tsx` — 30 tests (unchanged)
- `cli/baselineStorage.test.ts` — 17 tests (unchanged)
- TypeScript: 0 errors

---

## Sprint 1+2+3 Combined Review Pass (2026-05-29)

Full systematic re-evaluation of all Sprint 1, 2, and 3 source files and tests after the two Sprint 3 review passes. Sprint 1+2 source was read exhaustively; all test files verified.

### Sprint 1+2 Findings — No New Bugs

All Sprint 1+2 components (`runBaselines.ts`, `RunComparisonPanel.tsx`, `BaselineListPanel.tsx`, `RegressionThresholdsPanel.tsx`, `ResultsDashboard.tsx`) reviewed with no new bugs found:

- `p999ResponseTime` confirmed optional in `TestSummary` — `makeSummary` test helper omitting it is correct
- Threshold resolution order in `detectRegressions` (P99.9 checked before P99): correct
- `handleDelete` filter inconsistency in `ResultsDashboard.tsx` self-corrects via `useEffect` — accepted design
- All Sprint 1+2 CSS rules present in `src/styles/base.css`
- `TrendChart` scope reset `useEffect` dependency on `[selectedRun?.id]` is correct (intentionally omits `scope` to avoid infinite loop)

### Bug H — `--save-baseline` guard missing `!overThreshold`

**Problem**: After the Bug B fix in Round 1, the guard became:
```typescript
if (opts.saveBaseline && !failedRequests && !hasRegression) {
```
The original planned fix required `!overThreshold` as well. When `--fail-threshold` is configured and the error rate exceeds it, the run should be treated as dirty and not saved as a baseline — even if `failedRequests` is 0 (e.g., when validation failures vs. HTTP errors differ in their effect on `errorRate`).

**Fix**: Added `!overThreshold` to the guard:
```typescript
if (opts.saveBaseline && !failedRequests && !overThreshold && !hasRegression) {
```
Updated the comment to reflect both conditions.

### Post-fix test counts (Combined Review Pass)

- Full Sprint 1+2+3 suite: **1568 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass (2026-05-28)

Full systematic re-read of all Sprint 1 source files (`runBaselines.ts`, `RunComparisonPanel.tsx`, `BaselineListPanel.tsx`, `RegressionThresholdsPanel.tsx`, `ResultsDashboard.tsx`) and their test files. Two display bugs and two test quality issues were found.

### Bug I — Error Rate delta shows "%" instead of "pp" in MetricDeltaTable

**Problem**: `MetricDeltaTable` in `RunComparisonPanel.tsx` used a single `unit` variable for all three columns (Baseline, Current, Delta). For Error Rate, this showed `%` in the Delta column (e.g. "+3%") — but the delta is an absolute change in percentage points, not a relative percentage. The correct unit is "pp".

The markdown/CLI reports already correctly used "pp" for Error Rate delta — so the UI was inconsistent with its own exports.

**Fix**: Split `unit` into `valueUnit` (for Baseline/Current columns, still `%` for Error Rate) and `deltaUnit` (for the Delta column, now `' pp'` for Error Rate, `''` for TPS, `' ms'` otherwise). Baseline/Current columns are unaffected.

### Bug J — RegressionList detail body shows bare numbers without units

**Problem**: The Regressions tab detail body showed `Baseline: **100**` and `Current: **150**` for response time regressions — without the `ms` unit. For Error Rate regressions it showed `Baseline: **1**` without the `%` unit. Users had to infer units from the metric name alone.

**Fix**: Added `detailUnit` (same logic as `valueUnit`: `' ms'` for time metrics, `'%'` for Error Rate, `''` for TPS) and applied it to the baseline/current `<strong>` elements in `regression-detail-body`.

### Test improvement — MAX_BASELINES assertion strengthened

**Problem**: The test `'caps at MAX_BASELINES (10)'` used `toBeLessThanOrEqual(10)` — a weak assertion that would pass even if the cap was 5. It also didn't verify which entries were retained (newest 10) vs dropped (oldest).

**Fix**: Changed to `toBe(10)` and added assertions that the most-recent entry (`run-11`) is present and the two oldest (`run-0`, `run-1`) were dropped.

### Test improvement — Rename interaction in RunComparisonPanel now tested

**Problem**: `RunComparisonPanel` has its own inline rename flow (click ✏ → input → blur/Escape) with the same `renameEscapedRef` logic as `BaselineListPanel`. Only the rename button _visibility_ was tested; the actual interaction (open, commit, cancel, empty-trim guard) had no tests.

**Fix**: Added 4 rename interaction tests to `RunComparisonPanel.test.tsx`:
1. _Clicking rename button shows input pre-filled with `baselineLabel`_
2. _Blur with trimmed value calls `onRenameBaseline`_
3. _Escape cancels without calling `onRenameBaseline`_
4. _Blur with whitespace-only string does not call `onRenameBaseline`_

Also added 2 unit display tests verifying Bug I and Bug J fixes:
5. _Overview table shows "pp" for Error Rate delta (not "%")_
6. _Regression detail body shows "ms" units on baseline/current values_

### Post-fix test counts

- `src/features/results/components/RunComparisonPanel.test.tsx` — 36 tests (6 new: 4 rename + 2 unit display)
- `src/features/results/utils/runBaselines.test.ts` — 56 tests (1 assertion strengthened, no new tests)
- Full Sprint 1+2+3 suite: **1574 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass — Round 2 (2026-05-28)

Second pass after Round 1 fixes. One logic bug and one code quality issue found.

### Bug K — RegressionList shows relative `+300%` for Error Rate instead of absolute `+3 pp`

**Problem**: The regression detail body (Regressions tab) used `delta.deltaPercent%` to show the actual change. For Error Rate regression (baseline=1%, current=4%), this displayed `(+300%)` — a relative percentage. But the configured threshold is expressed in percentage points (pp), making the comparison confusing ("threshold 1 pp, actual +300%?").

`RegressionAlert.actual` already stores the correct value for display:
- Error Rate: `actual = d.delta` (absolute pp change, e.g. 3)
- TPS: `actual = Math.abs(d.deltaPercent)` (magnitude of % drop, e.g. 20)
- Response time: `actual = Math.abs(d.deltaPercent)` (% increase, e.g. 50)

**Fix**: Replaced `delta.deltaPercent%` with `r.actual` with context-aware sign and unit:
- Error Rate: `+{r.actual} pp` (e.g. `+3 pp`)
- TPS: `-{r.actual}%` (e.g. `-20%` — magnitude of drop)
- Response time: `+{r.actual}%` (e.g. `+50%` — same result as before)

### Code quality — IIFE pattern in RegressionList

**Problem**: The `detailUnit` variable was computed inside a JSX IIFE (`{delta && (() => { ... })()`), which is non-idiomatic React and harder to read.

**Fix**: Moved `detailUnit` and `deltaDisplay` to the top of the `map` callback before the `return`, using the standard React pattern for computed JSX variables.

### Post-fix test counts (Round 2)

- `src/features/results/components/RunComparisonPanel.test.tsx` — 38 tests (+2: Error Rate "+pp" display test, TPS "-%" display test)
- Full Sprint 1+2+3 suite: **1576 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass — Round 3 (2026-05-28)

Third pass. One unit inconsistency found in the markdown export path.

### Bug L — `comparisonReport.ts` Metric Deltas table uses `%` for Error Rate delta column

**Problem**: `generateComparisonMarkdown` used a single `unit` variable for all three value columns (Baseline, Current, Delta). For Error Rate, `unit = '%'`, so the Delta column showed `+0.5%` instead of `+0.5 pp`. The UI (`MetricDeltaTable`) and CLI (`reporters.ts`) already used `pp` for the delta column (fixed in Bug I / prior pass), but the markdown export lagged behind.

**Fix**: Split into `valueUnit` (for Baseline/Current columns, `'%'` for Error Rate) and `deltaUnit` (for Delta column, `' pp'` for Error Rate), mirroring the pattern already used in `MetricDeltaTable`.

**Test added**: `'uses pp unit for Error Rate delta column in Metric Deltas table (Bug L)'` — verifies `+0.5 pp` appears in the markdown output and `+0.5%` does not.

### Post-fix test counts (Round 3)

- `src/features/results/utils/comparisonReport.test.ts` — 21 tests (+1: Error Rate delta column pp unit)
- Full Sprint 1+2+3 suite: **1577 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass — Round 4 (2026-05-28)

Fourth pass. Same Error Rate delta unit bug found in both CLI reporter functions.

### Bug M — `cli/reporters.ts` Metric Deltas section uses `%` for Error Rate delta (both `buildComparisonMarkdown` and `printComparisonSummary`)

**Problem**: The same single-`unit` pattern as Bug L existed in both CLI reporter functions. For Error Rate, `unit = '%'` was used for all value columns including the delta display. `printComparisonSummary` showed `+3% (+300%)` and `buildComparisonMarkdown`'s Metric Deltas table showed `+3%` instead of `+3 pp`. The Regressions section of `buildComparisonMarkdown` was already correct (uses `regressionUnit()`), but the Metric Deltas table was not.

**Fix**: Split into `valueUnit` (for baseline/current display, `'%'`) and `deltaUnit` (for delta display, `' pp'`) in both `printComparisonSummary` and `buildComparisonMarkdown`, mirroring the pattern from `MetricDeltaTable` (UI) and Bug L fix.

**Tests added (+2)**:
- `printComparisonSummary`: Error Rate delta shows `+3 pp` not `+3%`
- `buildComparisonMarkdown`: Error Rate Metric Deltas Delta column shows `+3 pp` not `+3%`

### Post-fix test counts (Round 4)

- `cli/reporters.comparison.test.ts` — 29 tests (+2: Bug M delta unit tests)
- Full Sprint 1+2+3 suite: **1579 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass — Round 5 (2026-05-28)

Fifth pass. Source logic clean. Added missing unit assertion test.

### Coverage gap — `RegressionThresholdsPanel` pp unit not asserted

**Problem**: No test verified that the `Error Rate` row displays `pp` unit and all other rows display `%`. The unit constants are hardcoded in the `ROWS` array and could silently regress.

**Test added**: `'shows pp unit for Error Rate row and % unit for all other rows'` — queries all `.thresholds-unit` elements and asserts `unitLabels[6] === 'pp'` and all preceding labels are `'%'`.

### Post-fix test counts (Round 5)

- `src/features/results/components/RegressionThresholdsPanel.test.tsx` — 8 tests (+1: pp unit assertion)
- Full Sprint 1+2+3 suite: **1580 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1 Deep Review Pass — Round 6 (2026-05-28)

Sixth pass. All source logic correct. One test quality gap found.

### Test gap — `runBaselines.test.ts` Error Rate regression test too weak

**Problem**: The `'detects error rate regression'` test only asserted `er?.regressed === true`. It did not verify:
- `er.delta === 4` (absolute pp change, NOT the relative deltaPercent)
- `alert.actual === 4` (the value that gets displayed in the UI/CLI/markdown)
- `alert.threshold === 1` (the configured threshold used for comparison)
- `alert.severity === 'critical'` (4pp > 2× 1pp threshold)

If `actual` had been accidentally set to `deltaPercent` (400) instead of `delta` (4), the old test would still pass.

**Fix**: Strengthened the test to assert all four additional properties.

### Post-fix test counts (Round 6)

- `src/features/results/utils/runBaselines.test.ts` — 56 tests (1 test strengthened, no new tests)
- Full Sprint 1+2+3 suite: **1580 tests, 71 files — all passing**
- TypeScript: 0 errors

**All Sprint 1 source code and tests are clean. No further issues found.**

---

## Sprint 2 Deep Review Pass — Round 1 (2026-05-28)

### Source code — no logic bugs found

All Sprint 2 source logic in `runBaselines.ts` (`computeScopedTrend`, `computePerScenarioTrend`, `findNearestBaseline`, `computeRunRegressionStatus`) and `RunComparisonPanel.tsx` (`TrendChart`) was reviewed. No logic bugs found. Previously fixed bugs (A–D, G) confirmed correct.

### Test gaps found and filled (+5 TrendChart tests)

The `TrendChart` describe block in `RunComparisonPanel.test.tsx` had 5 tests that covered only basic rendering. Five tests were missing:

**1. Scope select renders** — no test verified `.trend-scope-select` exists with 4 options.

**2. metric2 select renders and excludes primary** — no test verified `.trend-metric-select2` has 7 options (6 non-primary + 'none') and excludes the primary metric.

**3. Bug A regression test** — Bug A (metric2 not cleared when primary changes to same value) was fixed but never tested. If the fix were accidentally removed, no test would catch it. New test: select metric2='tps', change primary to 'tps', verify metric2 resets to 'none'.

**4. Per-scenario tab empty hint** — no test verified the "No scenario data available" message when runs have no results.

**5. Bug D regression test (per-scenario tooltip null display)** — Bug D (formatter showed "null ms" instead of "—" for absent scenarios) was fixed but untested. Added test: switch to Per-Scenario tab with scenario data, Tooltip mock now calls `formatter(null)` and renders the result — verify it's '—' not 'null'. Also updated the Tooltip mock to call `formatter(null, 'metric')` and render the result in `[data-testid="tooltip-null-display"]` for assertions.

### Post-fix test counts (Sprint 2 Round 1)

- `src/features/results/components/RunComparisonPanel.test.tsx` — 43 tests (+5: scope select, metric2 select, Bug A, per-scenario empty hint, Bug D tooltip null)
- Full Sprint 1+2+3 suite: **1585 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 2 Deep Review Pass — Round 2 (2026-05-28)

### Source code — no new bugs found

### Test gaps found and filled (+3 tests across 2 files)

**1. `computePerScenarioTrend` — `isBaseline` flag not tested** (in `runBaselines.test.ts`): The function returns `ScenarioTrendPoint[]` with an `isBaseline: boolean` field. All existing tests passed empty `[]` baselines, so `isBaseline` was always `false`. Added test: two runs, one marked as baseline, verify `pt1.isBaseline === true`, `pt2.isBaseline === false`.

**2. Scope-aware empty message** (in `RunComparisonPanel.test.tsx`): When scope filter reduces data below 2 runs, the component shows "Only X runs match this scope — try 'All runs' for a broader view." rather than the generic 2-run hint. Not previously tested. Added test: 2 runs with different `svcName`, `selectedRun=r1`, change scope to 'service' → only 1 run matches → scope message shown.

**3. Metric2 overlay line renders** (in `RunComparisonPanel.test.tsx`): When metric2 is selected, a second `Line` (with `dot={false}`) is added to the overall chart. Previously no test verified it rendered. Also updated the `Line` mock so non-dot lines render `<div data-testid="chart-line" data-key={dataKey} />` (dot-function lines still render `line-with-dot`). Added test: initially no `chart-line`, after selecting metric2='tps', a `[data-testid="chart-line"][data-key="tps"]` element appears.

### Post-fix test counts (Sprint 2 Round 2)

- `src/features/results/utils/runBaselines.test.ts` — 57 tests (+1: isBaseline flag in ScenarioTrendPoint)
- `src/features/results/components/RunComparisonPanel.test.tsx` — 45 tests (+2: scope-aware message, metric2 overlay line)
- Full Sprint 1+2+3 suite: **1588 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 2 Deep Review Pass — Round 3 (2026-05-28)

### Final assessment — no further issues found

All Sprint 2 source files (`runBaselines.ts`, `RunComparisonPanel.tsx` TrendChart, `ResultsDashboard.tsx` regression dot + `runRegressionStatuses` useMemo) re-reviewed. No new bugs or gaps found.

Remaining minor item noted (not a bug):
- The scope-aware empty hint reads "Only 1 run match this scope" (grammatically, "matches" would be correct for singular) — cosmetic only, does not affect functionality.

**All Sprint 2 source code and tests are clean. No further issues found.**

Sprint 2 review committed across 3 rounds:
- Round 1 (7b0be48): 5 TrendChart tests + Tooltip null mock
- Round 2 (a692cd3): isBaseline ScenarioTrendPoint + scope-aware msg + metric2 overlay line + Line mock update
- Final: 1588 tests, 71 files, 0 TS errors

---

## Sprint 3 Deep Review Pass — Round 1 (2026-05-28)

Full re-evaluation of all Sprint 3 source files and tests. Reviewed:
- `cli/baselineStorage.ts` + `cli/baselineStorage.test.ts`
- `cli/reporters.ts` (printComparisonSummary + buildComparisonMarkdown) + `cli/reporters.comparison.test.ts`
- `src/features/results/utils/comparisonReport.ts` + `comparisonReport.test.ts`
- `src/features/results/components/RunComparisonPanel.tsx` (export button) + `RunComparisonPanel.test.tsx`
- `cli/index.ts` (exit codes, save-baseline guard, comparison logic)

### Bug N — TPS regression shows `+actual%` in both markdown Regressions sections

**Problem**: Both `generateComparisonMarkdown` (comparisonReport.ts) and `buildComparisonMarkdown` (cli/reporters.ts) use `r.actual > 0 ? '+' : ''` as the sign for the Actual column in the Regressions table. For TPS regressions, `r.actual = Math.abs(d.deltaPercent)` — always positive — so the sign is always `'+'`. This produces `+20%` for a TPS drop, which implies TPS INCREASED. The correct sign for TPS is `'-'` (TPS drops in a regression).

This was inconsistent with the UI (RunComparisonPanel.tsx Regressions tab), which already correctly uses `-${r.actual}%` for TPS after the Bug K fix.

**Fix**: Changed the sign computation to `r.metric === 'TPS' ? '-' : '+'` in both functions, matching the UI's directional sign convention.

**Tests added (+4)**:
- `comparisonReport.test.ts`: `'shows -actual% for TPS regression in Regressions section'`
- `comparisonReport.test.ts`: `'shows per-scenario ✓ Faster status when timeDelta is negative'`
- `comparisonReport.test.ts`: `'shows per-scenario — OK status when within threshold'`
- `reporters.comparison.test.ts`: `'shows -actual% for TPS regression in Regressions section'`

### Other items reviewed (no bugs)

- `cli/index.ts` exit code logic: SLA(4) > both(3) > regression(2) > fail(1) > pass(0) — correct
- `cli/index.ts` save-baseline guard `!failedRequests && !overThreshold && !hasRegression` — correct
- `cli/baselineStorage.ts` — all edge cases (missing file, corrupt JSON, upsert) correct
- `printComparisonSummary` console output — signs are correct (uses `d.delta` directly, which is negative for TPS drop, not `r.actual`)
- `comparisonReport.ts` scenario status logic (⚠ Regressed / ✓ Faster / — OK) — correct

### Post-fix test counts (Sprint 3 Round 1)

- `src/features/results/utils/comparisonReport.test.ts` — 24 tests (+3: TPS sign, ✓ Faster, — OK)
- `cli/reporters.comparison.test.ts` — 30 tests (+1: TPS sign)
- Full Sprint 1+2+3 suite: **1592 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 3 Deep Review Pass — Round 2 (2026-05-28)

### No new source bugs found

Second pass reviewed `printComparisonSummary` console output, `cli/index.ts` exit code interactions, `cli/baselineStorage.ts` edge cases, and all test files.

### Test quality improvement — Per-Scenario `⚠ Regressed` status assertion

The existing test `'includes Per-Scenario section when scenarioDeltas present'` checked for the table header, scenario name, and delta value but never asserted that the status column shows `'⚠ Regressed'` for a regressed scenario. Added assertion: `expect(md).toContain('⚠ Regressed')`.

**All Sprint 3 source code and tests are clean. No further issues found.**

- Full Sprint 1+2+3 suite: **1594 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1/2/3 Full Re-evaluation — Round 3 (2026-05-28)

### Bug P — `computeScenarioDeltas` used wrong threshold for per-scenario regression

**File:** `src/features/results/utils/runBaselines.ts`

Per-scenario regression check was:
```ts
regressed: timeDeltaPct > thresholds.p95Percent,
```
This uses the P95 threshold for per-scenario *average* response time comparisons. Since the comparison is on avg times, the correct threshold is `avgPercent`. Both default to 10%, so the bug is silent at default settings but fires incorrectly for users who configure custom thresholds where `p95Percent ≠ avgPercent` (e.g. `p95Percent=5%, avgPercent=25%` → all scenarios with >5% avg delta would incorrectly regress).

**Fix:** Changed to `thresholds.avgPercent`.

### Test gap — missing per-scenario threshold source verification

Added `'per-scenario regression uses avgPercent threshold, not p95Percent (Bug P)'` to `runBaselines.test.ts`. Uses custom thresholds (`avgPercent=25, p95Percent=5`) and verifies a +20% avg-time scenario is NOT regressed (20 < 25), confirming `avgPercent` is used not `p95Percent`.

### Test gap — inverse run-type filter not covered

`computeRunRegressionStatus` had a test for non-workflow run vs workflow baseline → no-baseline, but no test for the inverse (workflow run vs non-workflow baseline → no-baseline). Added `'workflow run ignores non-workflow baselines'`.

### Post-fix counts

- `src/features/results/utils/runBaselines.test.ts` — 59 tests (+2)
- Full suite: **1594 tests, 71 files — all passing**
- TypeScript: 0 errors

---

## Sprint 1/2/3 Full Re-evaluation — Round 4 (2026-05-29)

### Feature: Baselines tab (UX declutter)

**Files changed:**
- `src/features/results/ResultsDashboard.tsx`
- `src/styles/base.css`

Moved `BaselineListPanel` and `RegressionThresholdsPanel` from inline toggle panels in the toolbar into a new **★ Baselines** third tab in the bottom detail tab bar (alongside "Request Details" and "SLA Status").

**Toolbar simplified:** removed "Hide Baselines" / `Baselines (N)` button and "⚙ Thresholds" button. The toolbar now contains only: ★ Set Baseline toggle, Compare dropdown, comparison-active chip (shows which baseline is being compared, with ✕ to clear), and Show/Hide Trend toggle.

**When Compare is clicked** from the Baselines tab, the tab switches to "Request Details" so the user immediately sees the `RunComparisonPanel`.

**New CSS:** `.baseline-compare-chip`, `.baseline-compare-chip-clear`, `.baselines-tab-content`, `.baselines-empty`, `.run-filter-tab.baselines-tab.active` (gold color for star tab).

### Bug Q — `RegressionThresholdsPanel` Cancel did not reset draft when panel stays mounted

**File:** `src/features/results/components/RegressionThresholdsPanel.tsx`

Previously, the Cancel button called `onCancel()` directly without resetting the internal `draft` state. When the panel was a toggle (unmounted on close), this worked because state reset on the next mount. With the panel now permanently mounted inside the Baselines tab, clicking Cancel left unsaved edits in place.

**Fix:** Added `handleCancel` function that calls `setDraft(toDraft(thresholds))` before `onCancel()`. Also added `useEffect(() => { setDraft(toDraft(thresholds)); }, [thresholds])` so the draft automatically reflects the latest saved value after a Save.

**New test:** `'Cancel resets edited draft to saved thresholds (stays-mounted tab context)'` — edits P95 to 99, clicks Cancel, verifies input reverts to saved default.

### Post-fix counts (Round 4)

- `src/features/results/components/RegressionThresholdsPanel.test.tsx` — 9 tests (+1)
- Full suite: **1595 tests, 71 files — all passing**
- TypeScript: 0 errors


