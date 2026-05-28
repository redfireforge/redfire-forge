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
| 25.6 | CLI regression gate | 🔲 | M | `--fail-on-regression` for CI pipelines |
| 25.7 | Export comparison report | 🔲 | S | Markdown/JSON download of RunComparison |
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
- [ ] `redfireforge run ... --compare-baseline latest-baseline --fail-on-regression` exits code 2 on regression
- [ ] Comparison can be exported as Markdown and JSON from the UI
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
