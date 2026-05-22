# Phase 3B (Streaming Percentiles) — Test Scenarios for Visual Verification

> Phase 3B: Streaming Percentiles via HDR Histogram
> Sub-phases: 3B.1–3B.8
> PRs: PR1 (Rust-side histogram), PR2 (JS integration + P99.9 UI), PR3 (detailLevel payload reduction)
> Branch: `feature/throughput-streaming-percentiles`

---

## Files Changed

### PR1 — Rust-Side Histogram (3B.1–3B.4)

| File | Changes |
|------|---------|
| `src-tauri/src/histogram.rs` | NEW: `StreamingMetrics` struct (HdrHistogram-backed), `MetricsSnapshot` struct, `record()`, `snapshot()`, NaN guard, `Default` impl |
| `src-tauri/src/histogram_test.rs` | NEW: 25 tests — percentile accuracy, edge cases, NaN rejection, serde roundtrip |
| `src-tauri/src/types.rs` | `ProgressBatch.metrics: Option<MetricsSnapshot>`, `CompletionSummary.final_metrics`, `DetailLevel` enum, `FinalResults` struct, `detail_level` on ExecutionPlan variants |
| `src-tauri/src/executor.rs` | Wired `StreamingMetrics` into `run_pool` + `run_load_profile`, `filter_batch()`, `detail_level` parameter, `load-test-final-results` event |
| `src-tauri/src/commands.rs` | Destructure + pass `detail_level` to executor functions |
| `src-tauri/src/executor_test.rs` | Serde tests for `DetailLevel`, `FinalResults`, `filter_batch` logic, backward compat |

### PR2 — JS Integration + P99.9 UI (3B.5–3B.6)

| File | Changes |
|------|---------|
| `src/engine/executor.ts` | Added `StreamingMetrics` interface, `ProgressMeta.metrics?` field |
| `src/engine/metrics.ts` | `computeMetrics()` now computes `p999ResponseTime` |
| `src/features/test-runner/utils/rustBridge.ts` | `RustMetricsSnapshot` interface, `RustFinalResults` interface, `DetailLevel` type, `startRustLoadTest` `onFinalResults` callback, `buildExecutionPlan` `detailLevel`, `completed` counter fix |
| `src/features/test-runner/hooks/useTestExecution.ts` | `computeIncrementalSummary` streaming vs sort-based paths, `trackResult` skips `times[]` when streaming, final summary override from streaming |
| `src/shared/types/index.ts` | `TestSummary.p999ResponseTime?: number` |
| `src/features/results/ResultsDashboard.tsx` | P99.9 metric tile |
| `src/features/results/components/ResponseTimeHistogram.tsx` | P99.9 reference line on distribution chart |
| `src/features/results/components/RunComparisonPanel.tsx` | P99.9 in TrendChart metric dropdown |
| `src/features/results/utils/runBaselines.ts` | P99.9 in baseline comparison with 20% regression threshold |
| `src/features/results/utils/reportGenerator.ts` | P99.9 in HTML + Markdown exports |
| `src/features/results/utils/responseTimeHistogram.ts` | `p999` in histogram stats |
| `cli/reporters.ts` | P99.9 in console + markdown + workflow summaries |

### PR3 — Payload Reduction + Cleanup (3B.7–3B.8)

| File | Changes |
|------|---------|
| `src-tauri/src/executor.rs` | `is_metrics_only` optimization, `filter_batch`, progress emit without `!batch.is_empty()` guard |
| `src-tauri/src/histogram.rs` | NaN guard on `record()`, `Default` impl |
| `src-tauri/src/json_validator.rs` | 3 clippy fixes (type alias, `strip_prefix`, `find` array pattern) |
| `src-tauri/src/validation_result.rs` | `#[allow(clippy::too_many_arguments)]` |
| `src/features/test-runner/utils/rustBridge.ts` | `detailLevel: 'sampled'` for load-profile, `onFinalResults` replaces `allResults` |

---

## Platform & Execution Mode Matrix

> Phase 3B changes affect different execution paths differently. Use this matrix to understand which scenarios require which setup.

| Mode | Platform | Executor | Live Streaming Metrics | detailLevel | P99.9 in Final Summary |
|------|----------|----------|----------------------|-------------|----------------------|
| Continuous Pool | Tauri Desktop | Rust | Yes — HDR histogram | `full` | Yes (HDR) |
| Continuous Pool | Web Browser | JS / Workers | No — sort-based | N/A | Yes (sort-based) |
| Sequential | Tauri Desktop | Rust | Yes — HDR histogram | `full` | Yes (HDR) |
| Sequential | Web Browser | JS / Workers | No — sort-based | N/A | Yes (sort-based) |
| Load Profile | Tauri Desktop | Rust | Yes — HDR histogram | `sampled` | Yes (HDR) |
| Load Profile | Web Browser | JS / Workers | No — sort-based | N/A | Yes (sort-based) |
| Workflow | Any | JS only | No | N/A | Yes (sort-based) |
| CLI | Node.js | JS only | No | N/A | Yes (sort-based) |

**Rust executor availability**: Tauri desktop only, when `is_rust_executor_available` is true AND the test has no OAuth2 auth AND is not a workflow.

---

## Before You Start

### How to Navigate

| Destination | Path |
|---|---|
| **Feature Groups** | Activity bar → **Harness** → sub-nav **Feature Groups** |
| **Test Runner** | Activity bar → **Harness** → sub-nav **Test Runner** |
| **Results Dashboard** | Activity bar → **Harness** → sub-nav **Results** |
| **After a run** | Click **View Full Results →** in the completion banner |

### Execution Mode Selection

The Test Runner has a radio group labeled **Execution Mode:**. The exact option labels are:

| Radio Label | Internal Mode |
|---|---|
| **Sequential** | `sequential` |
| **Batch** | `batch` |
| **Continuous Pool** | `pool` |
| **Load Profile** | `load-profile` |
| **Constant Arrival** | `constant-arrival` |

- **Start button**: **▶ Run Test** (becomes **■ Stop** during a run)
- **Post-run**: a banner with **View Full Results →** link appears

### Results Dashboard Export Buttons

The Results Dashboard has these separate export controls (NOT a single dropdown):

| Control | Label |
|---|---|
| Button | **Export JSON** |
| Button | **Export CSV** |
| Dropdown trigger | **Generate Report ▾** |
| Submenu item | **HTML Report** |
| Submenu item | **JSON Report** |
| Submenu item | **Markdown Report** |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [P99.9 in Results Dashboard — Pool Mode](#test-scenario-1-p999-in-results-dashboard--pool-mode) | [ ] | |
| 2 | [P99.9 in Results Dashboard — Load Profile Mode](#test-scenario-2-p999-in-results-dashboard--load-profile-mode) | [ ] | |
| 3 | [P99.9 in Response Time Histogram](#test-scenario-3-p999-reference-line-in-response-time-histogram) | [ ] | |
| 4 | [P99.9 in Run Comparison & Trend Chart](#test-scenario-4-p999-in-run-comparison--trend-chart) | [ ] | |
| 5 | [P99.9 in Exported Reports (HTML + Markdown)](#test-scenario-5-p999-in-exported-reports-html--markdown) | [ ] | |
| 6 | [P99.9 in CLI Console Summary](#test-scenario-6-p999-in-cli-console-summary) | [ ] | |
| 7 | [Streaming Metrics Accuracy — Rust vs JS (Pool Mode)](#test-scenario-7-streaming-metrics-accuracy--rust-vs-js-pool-mode) | [ ] | |
| 8 | [Live TPS Stability Under High Volume (Load Profile)](#test-scenario-8-live-tps-stability-under-high-volume-load-profile) | [ ] | |
| 9 | [Sampled detailLevel — Sparse Live Results During Load Profile](#test-scenario-9-sampled-detaillevel--sparse-live-results-during-load-profile) | [ ] | |
| 10 | [Full Results at Completion — Load Profile with Sampled Progress](#test-scenario-10-full-results-at-completion--load-profile-with-sampled-progress) | [ ] | |
| 11 | [Backward Compatibility — Old Saved Runs Show Dash for P99.9](#test-scenario-11-backward-compatibility--old-saved-runs-show-dash-for-p999) | [ ] | |
| 12 | [P99.9 Regression Baseline Alert](#test-scenario-12-p999-regression-baseline-alert) | [ ] | |
| 13 | [Web Browser Fallback — P99.9 Without Rust](#test-scenario-13-web-browser-fallback--p999-without-rust) | [ ] | |
| 14 | [Workflow P99.9 — Post-Run Only](#test-scenario-14-workflow-p999--post-run-only) | [ ] | |
| 15 | [Abort During Rust Load Profile — Metrics Still Saved](#test-scenario-15-abort-during-rust-load-profile--metrics-still-saved) | [ ] | |

---

## Test Scenario 1: P99.9 in Results Dashboard — Pool Mode

**Purpose**: Verify that the new P99.9 metric tile appears in the Results Dashboard after a pool-mode test completes. This is the most common execution mode and the primary visual confirmation that Phase 3B's `computeMetrics` upgrade (sort-based P99.9) works end-to-end.

**Phase 3B changes**: `TestSummary.p999ResponseTime` field + `ResultsDashboard.tsx` P99.9 tile + `computeMetrics()` P99.9 calculation

### Steps

**Part A — Create a test**

1. Go to **Harness** (activity bar) → **Feature Groups** (sub-nav)
2. Create or reuse a Feature Group → Scenario → add a **Test**:
   - **Name**: `P99.9 Pool Check`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Save**

**Part B — Run in pool mode with enough iterations for meaningful P99.9**

3. Switch to **Test Runner** (sub-nav) → select `P99.9 Pool Check`
4. Set **Execution Mode** radio to **Continuous Pool**
5. Set **Concurrency**: `10`, **Iterations**: `100`
6. Click **▶ Run Test** → wait for completion

**Part C — Verify P99.9 in dashboard**

7. After the run finishes, click **View Full Results →** (or go to **Results** sub-nav)
8. In the metrics grid, look for the second row of metric tiles containing percentiles
9. Verify the tile layout (left to right): **P50**, **P95**, **P99**, **P99.9**
10. Verify the **P99.9** tile:
    - Shows a numeric value followed by `ms` (e.g., `245 ms`) — NOT `—` or `undefined`
    - The value is **≥ P99** (P99.9 must always be ≥ P99 by definition)
    - The value is **≤ Max Response Time** (P99.9 cannot exceed max)
11. Take note of the exact P99.9 value for comparison in later scenarios

### Expected Outcomes

- [ ] Results Dashboard shows 4 percentile tiles in order: P50, P95, P99, **P99.9**
- [ ] P99.9 value is a valid number with `ms` suffix (not `—`, `NaN`, or `undefined`)
- [ ] P99.9 ≥ P99 ≥ P95 ≥ P50 (monotonically increasing)
- [ ] P99.9 ≤ Max Response Time
- [ ] TPS, Avg Response, Min/Max, Error Rate tiles all display correctly (no regression)

---

## Test Scenario 2: P99.9 in Results Dashboard — Load Profile Mode

**Purpose**: Verify P99.9 works correctly in load-profile mode on the Tauri desktop app, where the Rust executor provides streaming HDR histogram percentiles. This is the path where `detailLevel: 'sampled'` is active and streaming metrics override `computeMetrics()` at completion.

**Phase 3B changes**: `StreamingMetrics` → `useTestExecution` streaming override → `TestSummary.p999ResponseTime`

> **Requires**: Tauri desktop app (`npm run tauri:dev`)

### Steps

**Part A — Create a test**

1. Go to **Harness** → **Feature Groups** → create or reuse a test:
   - **Name**: `P99.9 Load Profile HDR`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Save**

**Part B — Run in load-profile mode**

2. Switch to **Test Runner** → select `P99.9 Load Profile HDR`
3. Set **Execution Mode** radio to **Load Profile**
4. Configure:
   - Click the **Sustained** profile type button
   - **Concurrency**: `20`
   - **Duration (sec)**: `30`
5. Click **▶ Run Test** → wait for the full 30-second duration

**Part C — Observe live progress**

6. During the run, observe the **Live Progress Panel**:
   - **TPS** metric card should update smoothly (from HDR histogram `streaming.tps`)
   - **Avg Response** metric card should update smoothly (from HDR `streaming.avg`)
   - **Completed requests counter** in the progress bar should climb steadily
   - Note: **P50/P95/P99/P99.9 tiles are NOT shown during live progress** (expected — they appear only in the post-run dashboard)

**Part D — Verify post-run P99.9**

7. After the run completes, click **View Full Results →** (or go to **Results** sub-nav)
8. Verify the **P99.9** tile shows a numeric value with `ms` suffix
9. Compare P99.9 against the other percentiles: P99.9 ≥ P99 ≥ P95 ≥ P50
10. The P99.9 value is from the **HDR histogram** (more accurate than sort-based, especially at high sample counts)

### Expected Outcomes

- [ ] Live progress shows TPS and Avg Response Time updating smoothly during the 30s run
- [ ] Completed request counter climbs steadily (hundreds to thousands of requests over 30s)
- [ ] Post-run Results Dashboard shows **P99.9** tile with a numeric value and `ms` suffix
- [ ] P99.9 ≥ P99 (monotonic ordering preserved)
- [ ] Total requests in dashboard matches the completed count from live progress
- [ ] All results are present in the results table (despite `sampled` progress during the run — full results arrive at completion)

---

## Test Scenario 3: P99.9 Reference Line in Response Time Histogram

**Purpose**: Verify that the Response Time Distribution chart (histogram) shows a **P99.9 reference line** alongside the existing P95 and P99 lines. This visual indicator helps users identify the tail latency boundary.

**Phase 3B changes**: `ResponseTimeHistogram.tsx` — P99.9 dashed reference line, `responseTimeHistogram.ts` — `stats.p999` computation

### Steps

**Part A — Run any test with enough results for visible distribution**

1. Use the run from Scenario 1 or Scenario 2, or run a new test:
   - **Execution Mode**: **Continuous Pool**, **Concurrency**: `10`, **Iterations**: `200`
   - Endpoint: `https://httpbin.org/get`
2. Wait for completion

**Part B — Open the Response Time Histogram**

3. Go to **Results** sub-nav → select this run
4. Scroll down to the **Response Time Distribution** section (bar chart showing latency buckets)
5. Look for vertical reference lines overlaid on the chart:
   - **P95**: dashed line in warning/amber color (`strokeDasharray="3 3"`)
   - **P99**: dashed line in red/error color (`strokeDasharray="3 3"`)
   - **P99.9**: dashed line in gray/muted color (`strokeDasharray="5 2"`) — **this is the new one**

**Part C — Verify reference line positioning**

6. Confirm the P99.9 line is positioned at or to the right of the P99 line
7. The P99.9 line should be at the very right edge of the distribution (in the tail)
8. The label next to the line reads **"P99.9"** in gray text

### Expected Outcomes

- [ ] Response Time Distribution chart renders correctly with histogram bars
- [ ] **P99.9** dashed reference line is visible on the chart (gray/muted color)
- [ ] P99.9 line uses a different dash pattern (`5 2`) than P95/P99 (`3 3`)
- [ ] P99.9 line is labeled **"P99.9"**
- [ ] P99.9 line position is at or right of P99 line
- [ ] P95 and P99 reference lines still render correctly (no regression)
- [ ] With fewer than ~10 results, the P99.9 line may not appear (it requires `stats.p999 != null` — acceptable)

---

## Test Scenario 4: P99.9 in Run Comparison & Trend Chart

**Purpose**: Verify that P99.9 appears in the Run Comparison panel's metric table and as a selectable option in the Trend Chart dropdown. This enables users to track P99.9 tail latency trends across multiple test runs.

**Phase 3B changes**: `RunComparisonPanel.tsx` — `p999ResponseTime` in TrendChart metric selector, `runBaselines.ts` — P99.9 in comparison table with 20% regression threshold

### Steps

**Part A — Create two runs with the same test**

1. Run the same test twice (from Scenario 1) with identical settings:
   - **Execution Mode**: **Continuous Pool**, **Concurrency**: `10`, **Iterations**: `100`
   - Save both runs

**Part B — Set baseline and compare**

2. Go to **Results** sub-nav → select the **first** run
3. Click **☆ Set Baseline** (the button toggles to **★ Baseline** when set)
4. Click the **Compare against baseline...** dropdown → select the baseline run
5. The Run Comparison panel opens below with an **Overview** tab

**Part C — Verify P99.9 in comparison table**

6. In the comparison table, look for a row labeled **P99.9 Response Time**
7. It should show the P99.9 values for both runs (Baseline and Current) and a delta percentage
8. Columns are: **Metric**, **Baseline**, **Current**, **Delta**, **Change**, **Status**

**Part D — Verify P99.9 in Trend Chart**

9. Scroll to the **Performance Trend** section
10. Open the metric dropdown (default option is **P95 Response Time**)
11. Verify the dropdown includes these options:
    - **P95 Response Time** (default)
    - **P50 Response Time**
    - **P99 Response Time**
    - **P99.9 Response Time** ← the new one
    - **Avg Response Time**
    - **TPS**
    - **Error Rate**
12. Select **P99.9 Response Time** — the chart should render with P99.9 values plotted
13. The chart legend should show **P99.9 (ms)**

### Expected Outcomes

- [ ] Run Comparison overview table includes a **"P99.9 Response Time"** row
- [ ] Both runs show numeric P99.9 values (not `—`)
- [ ] Delta percentage is computed (may be small if runs are similar)
- [ ] Trend Chart metric dropdown includes **"P99.9 Response Time"** option
- [ ] Selecting P99.9 renders the trend line with legend label **"P99.9 (ms)"**
- [ ] Other metric options (P50, P95, P99, Avg, TPS, Error Rate) still work (no regression)

---

## Test Scenario 5: P99.9 in Exported Reports (HTML + Markdown)

**Purpose**: Verify that exported test reports include the P99.9 metric in both HTML and Markdown format. This ensures stakeholders who receive exported reports can see tail latency data.

**Phase 3B changes**: `reportGenerator.ts` — P99.9 stat card in HTML, P99.9 table row in Markdown

### Steps

**Part A — Export HTML report**

1. Use any completed run from a previous scenario
2. In the Results Dashboard, click **Generate Report ▾** → click **HTML Report**
3. Open the downloaded HTML file in a browser
4. In the statistics summary bar, look for a **P99.9** stat card
5. Cards appear in order: TPS → Passed → Failed → Pass Rate → Avg → P50 → P95 → P99 → **P99.9**
6. The P99.9 card shows `{value}ms` (e.g., `245ms`) with label **P99.9**

**Part B — Export Markdown report**

7. In the Results Dashboard, click **Generate Report ▾** → click **Markdown Report**
8. Open the downloaded `.md` file in a text editor or Markdown viewer
9. In the metrics table, look for a **P99.9** row: `| P99.9 | {value}ms |`
10. The row appears after P99 and before Error Rate

### Expected Outcomes

- [ ] HTML report shows a P99.9 stat card with a numeric value (not `—`)
- [ ] HTML P99.9 card is positioned after P99 in the summary bar layout
- [ ] Markdown report includes `| P99.9 | {value}ms |` row in the metrics table
- [ ] Markdown P99.9 row appears after P99 and before Error Rate
- [ ] Both formats show consistent P99.9 values (same number)
- [ ] Exporting for an old run without P99.9 data shows `—ms` (not a crash)

---

## Test Scenario 6: P99.9 in CLI Console Summary

**Purpose**: Verify that the CLI test runner displays P99.9 in the console summary output after a test run completes.

**Phase 3B changes**: `cli/reporters.ts` — P99.9 row in `printConsoleSummary`, `buildMarkdownReport`, `printWorkflowConsoleSummary`

> **Requires**: CLI setup (`node cli/index.ts` or `npx tsx cli/index.ts`)

### Steps

**Part A — Run a CLI test**

1. Create a test configuration file (or use an existing one) for the CLI
2. Run the test via CLI:
   ```bash
   npx tsx cli/index.ts --file <test-config>.json
   ```
3. Wait for the test to complete

**Part B — Inspect console output**

4. After completion, look at the summary block printed to the terminal:
   ```
     RedfireForge — Test Run Summary
     Mode:         pool (C:10 I:100)
     Duration:     12.34s
     TPS:          8.1
     Avg Response: 145 ms
     P50:          120 ms
     P95:          280 ms
     P99:          350 ms
     P99.9:        420 ms          ← NEW
     Min / Max:    45 ms / 500 ms
     ...
   ```
5. Verify the **`P99.9:`** line is present with a numeric value and `ms` suffix
6. If P99.9 data is unavailable, it shows `—` (em dash) as fallback

### Expected Outcomes

- [ ] Console summary includes a `P99.9:` line after `P99:`
- [ ] P99.9 value is numeric with `ms` suffix (not `—`, `undefined`, or `NaN`)
- [ ] P99.9 ≥ P99 (monotonic ordering)
- [ ] If the test has very few results (< 10), P99.9 may equal P99 or Max — that's acceptable
- [ ] Markdown report (if `--reporter markdown` is used) also includes a `| **P99.9** | {value} ms |` row

---

## Test Scenario 7: Streaming Metrics Accuracy — Rust vs JS (Pool Mode)

**Purpose**: Verify that the Rust HDR histogram percentiles match the JS sort-based percentiles when running the same test in pool mode. On the Tauri desktop, the Rust executor provides streaming metrics that override the JS sort-based calculation at the end. Both should produce very similar results (within rounding tolerance).

**Phase 3B changes**: `useTestExecution.ts` streaming override, `histogram.rs` HDR calculation

> **Requires**: Tauri desktop app (`npm run tauri:dev`) AND web dev server (`npm run dev` on port 5173)

### Steps

**Part A — Run a test on Tauri desktop (Rust executor)**

1. Go to **Harness** → **Feature Groups** → create a test:
   - **Name**: `Accuracy Compare`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Save**
2. Switch to **Test Runner** → select `Accuracy Compare`
3. Set **Execution Mode**: **Continuous Pool**, **Concurrency**: `10`, **Iterations**: `500`
4. Click **▶ Run Test** → wait for completion
5. Go to **Results** sub-nav and record: P50, P95, P99, P99.9, Avg, Min, Max, TPS

**Part B — Run the same test on web browser (JS executor)**

6. Open the same app in a web browser (not Tauri): `http://localhost:5173`
7. Run the exact same test with identical settings: **Continuous Pool**, C:10, I:500
8. Record the same metrics from the Results Dashboard

**Part C — Compare**

9. Compare the two sets of metrics side-by-side:
   - P50, P95, P99 should be within ±5% of each other (network variability is the main factor, not calculation method)
   - P99.9 should be within ±10% (only 0.5 sample points at 500 results — inherently noisy)
   - TPS should be similar (same network conditions)
   - Min/Max should be similar

### Expected Outcomes

- [ ] Both Tauri (Rust) and Web (JS) runs complete successfully with 500 results each
- [ ] P50, P95, P99 are within ±5% of each other (accounting for network variability)
- [ ] **P99.9** is present in both dashboards (numeric value with `ms`, not `—`)
- [ ] Both dashboards show monotonically increasing percentiles: P50 ≤ P95 ≤ P99 ≤ P99.9 ≤ Max
- [ ] TPS values are roughly similar between platforms
- [ ] Neither run shows NaN or undefined for any metric

---

## Test Scenario 8: Live TPS Stability Under High Volume (Load Profile)

**Purpose**: Verify that the live TPS tile is stable and accurate during a high-volume load-profile run on Tauri desktop. Before Phase 3B, the JS sort-based TPS calculation could become jittery at high sample counts due to re-sorting on every progress tick. With streaming HDR metrics, TPS comes directly from the Rust histogram snapshot — O(1) per tick regardless of sample count.

**Phase 3B changes**: `ProgressBatch.metrics` → `StreamingMetrics.tps` used in live display

> **Requires**: Tauri desktop app (`npm run tauri:dev`)

### Steps

**Part A — Set up a high-volume load test**

1. Go to **Harness** → **Feature Groups** → create a test:
   - **Name**: `High Volume TPS`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Save**
2. Switch to **Test Runner** → select `High Volume TPS`
3. Set **Execution Mode** radio to **Load Profile**
4. Configure:
   - Click the **Sustained** profile type button
   - **Concurrency**: `50`
   - **Duration (sec)**: `60`
5. Click **▶ Run Test**

**Part B — Observe live TPS during the run**

6. Watch the **TPS** metric card in the Live Progress Panel throughout the 60-second run
7. After the initial ramp-up period (first 5-10 seconds), the TPS value should:
   - Stabilize to a relatively consistent value (e.g., 150–300 depending on network)
   - NOT wildly oscillate (e.g., jumping between 50 and 500 every second)
   - Update smoothly every ~500ms
8. Watch the **Avg Response** metric card — it should also be stable, not jittering

**Part C — Note completed request count at end**

9. When the run completes, note the total completed requests from the progress bar (should be hundreds or thousands)
10. Click **View Full Results →** — verify TPS, P50, P95, P99, P99.9 are all present

### Expected Outcomes

- [ ] TPS tile stabilizes after initial ramp-up (first 10s)
- [ ] TPS does NOT wildly oscillate (max variation < 30% after ramp-up)
- [ ] Note: TPS is a cumulative average (`total_completed / elapsed_seconds`), not a sliding window. It may fluctuate early in the run and converge as more samples accumulate.
- [ ] Avg Response tile shows a stable value
- [ ] Completed requests grows steadily throughout the run
- [ ] UI remains responsive during the run (no freezing or jank)
- [ ] Post-run Results Dashboard shows all metrics including P99.9
- [ ] Total duration in dashboard is approximately 60s (±5s)

---

## Test Scenario 9: Sampled detailLevel — Sparse Live Results During Load Profile

**Purpose**: Verify that during a Rust load-profile run, the live results list shows only sampled results (max ~10 per batch) rather than every single result. This is the `detailLevel: 'sampled'` behavior from Sub-Phase 3B.7 that reduces IPC payload.

**Phase 3B changes**: `buildExecutionPlan` sets `detailLevel: 'sampled'` for load-profile, `filter_batch` caps at 10 results per batch, `load-test-final-results` event sends full results at completion

> **Requires**: Tauri desktop app (`npm run tauri:dev`)

### Steps

**Part A — Run a load-profile test and observe live results**

1. Use the same test from Scenario 8 or create a new one:
   - **Method**: `GET`, **URL**: `https://httpbin.org/get`
2. Set **Execution Mode**: **Load Profile**, **Concurrency**: `30`, **Duration (sec)**: `30`
3. Click **▶ Run Test**

**Part B — During the run, observe the live results area**

4. While the run is active, watch the live results list/table:
   - The **completed request counter** in the progress bar should climb rapidly (actual completed count from Rust)
   - The **number of visible result rows** in the live table should be much smaller than the completed count
   - For example: progress bar shows `"2,500 requests"` but only ~100-200 result rows visible (because only ~10 are sent per 100ms batch)
5. Note this difference — it confirms `detailLevel: 'sampled'` is working

**Part C — After completion, verify full results arrive**

6. After the 30s run completes, click **View Full Results →** to go to the Results Dashboard
7. The total result count in the dashboard should match the completed counter from the live progress
8. Scroll through the results table — all results should be present (not just the sampled subset)

### Expected Outcomes

- [ ] During the run: completed counter in progress bar shows high numbers (hundreds+)
- [ ] During the run: live results table shows fewer rows than the completed count (sampled)
- [ ] Completed counter increases steadily (not stuck at 0 — the `Math.max` fix works)
- [ ] After completion: Results Dashboard shows the full result count matching the completed counter
- [ ] All results are available for inspection in the results table post-run
- [ ] Metrics (P50, P95, P99, P99.9, TPS, Avg) are accurate despite sampled progress
- [ ] Note: The very last progress batch before completion may carry more than 10 results (the final drain bypasses the sampling cap) — this is expected behavior

---

## Test Scenario 10: Full Results at Completion — Load Profile with Sampled Progress

**Purpose**: Verify end-to-end that the `load-test-final-results` Tauri event correctly delivers ALL results to the JS frontend when progress batches were sampled. This is the critical data integrity check for Sub-Phase 3B.7.

**Phase 3B changes**: Rust `load-test-final-results` event, JS `onFinalResults` handler in `runTestViaRust`, `allResults.length = 0` + re-populate

> **Requires**: Tauri desktop app (`npm run tauri:dev`)

### Steps

**Part A — Run a load-profile test with validation**

1. Go to **Harness** → **Feature Groups** → create a test with validation:
   - **Name**: `Final Results Integrity`
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Edit** → **Validation** tab → select **Selective Fields** radio
   - Click **Fetch Response** to get a sample response
   - Click **⚡ Data Mapper** → map the `$.url` field → set operator to **contains** → set value to `httpbin`
   - Click **Save** in the Data Mapper, then **Save** in the Edit Test modal
2. Switch to **Test Runner** → select `Final Results Integrity`
3. Set **Execution Mode**: **Load Profile**, **Concurrency**: `20`, **Duration (sec)**: `20`
4. Click **▶ Run Test** → wait for completion

**Part B — Verify result completeness and validation**

5. After the run completes, click **View Full Results →**
6. Check the **Total Requests** count — note the exact number (e.g., 1,234)
7. Check the **Passed** vs **Failed** counts:
   - All results should pass (URL contains "httpbin")
   - If any fail, click to inspect — the failure should be legitimate, not caused by missing data
8. Check the **Validation Failures** count — should be 0

**Part C — Verify assertion results are present**

9. Click on any individual result row in the results table
10. In the result detail modal, verify the validation section shows the `$.url contains "httpbin"` rule with a pass status
11. Spot-check 5 more results spread across the table — all should have validation data

### Expected Outcomes

- [ ] Total result count matches the completed counter from live progress (no results lost)
- [ ] All results have validation data (assertions evaluated — not empty/missing)
- [ ] Pass/fail counts are correct (all should pass for this test)
- [ ] Validation Failures count is 0 in the dashboard
- [ ] Result detail modals show individual validation rule results (not blank)
- [ ] No `undefined` or `NaN` values in any result field

---

## Test Scenario 11: Backward Compatibility — Old Saved Runs Show Dash for P99.9

**Purpose**: Verify that test runs saved before Phase 3B (which don't have `p999ResponseTime` in their `TestSummary`) display gracefully in the updated UI — showing `—` instead of crashing or showing `undefined`.

**Phase 3B changes**: `ResultsDashboard.tsx` uses `summary.p999ResponseTime ?? '—'`

### Steps

**Part A — Load an old saved run**

1. If you have test runs saved from before Phase 3B, navigate to **Harness** → **Results**
2. Select an old run (one that was executed before the P99.9 field was added)
3. The Results Dashboard opens for that run

**Part B — Verify graceful display**

4. In the metrics grid, look at the **P99.9** tile
5. It should display **`— ms`** (em dash + space + ms) — NOT `undefined ms`, `NaN ms`, or cause a crash
6. All other metric tiles (P50, P95, P99, TPS, etc.) should display their saved values normally

**Part C — Verify exports handle missing P99.9**

7. Click **Generate Report ▾** → **HTML Report** for the old run
8. Open the HTML — the P99.9 card should show `—ms`
9. Click **Generate Report ▾** → **Markdown Report** for the old run
10. Open the `.md` — the P99.9 row should show `| P99.9 | —ms |`

### Expected Outcomes

- [ ] Old runs without P99.9 data show `—` in the P99.9 tile
- [ ] No JavaScript errors or crashes when viewing old runs
- [ ] All other tiles (P50, P95, P99, TPS, Avg, etc.) display correctly
- [ ] HTML report shows `—ms` for P99.9
- [ ] Markdown report shows `—ms` for P99.9
- [ ] Histogram chart omits the P99.9 reference line (condition: `stats?.p999 != null` fails — no line rendered)

---

## Test Scenario 12: P99.9 Regression Baseline Alert

**Purpose**: Verify that the baseline regression detection system includes P99.9 in its analysis and alerts when P99.9 regresses beyond the 20% threshold.

**Phase 3B changes**: `runBaselines.ts` — P99.9 in metric comparison with `p999Percent: 20` threshold

> **Regression thresholds reference** (from `DEFAULT_THRESHOLDS`):
> | Metric | Threshold |
> |---|---|
> | P50 | 15% |
> | P95 | 10% |
> | P99 | 15% |
> | **P99.9** | **20%** |
> | Avg | 10% |

### Steps

**Part A — Create a baseline run**

1. Run a pool-mode test: **Continuous Pool**, C:10, I:200 → wait for completion
2. In the Results Dashboard, click **☆ Set Baseline** (button toggles to **★ Baseline** when set)
3. Note the P99.9 value (e.g., 300 ms)

**Part B — Create a "regressed" run**

4. To simulate regression, either:
   - Add a `?delay=500` parameter to the URL (if the endpoint supports it), or
   - Use a slower endpoint, or
   - Simply run the same test but with much higher concurrency to stress the server (P99.9 increases with load)
5. Run the test again with settings likely to produce higher tail latency
6. After completion, go to the Results Dashboard for the new run

**Part C — Check regression alerts**

7. Click the **Compare against baseline...** dropdown → select your baseline
8. In the comparison table, find the **P99.9 Response Time** row
9. If P99.9 increased by > 20% from the baseline:
   - The Status column should show **Regressed** (red/warning)
   - The Delta column shows the percentage increase
10. If P99.9 increased by < 20%, Status shows **No change** (within threshold)

### Expected Outcomes

- [ ] Baseline comparison includes a **P99.9 Response Time** row
- [ ] When P99.9 regresses by > 20%, Status column shows **Regressed**
- [ ] The regression threshold for P99.9 is correctly 20% (P50: 15%, P95: 10%, P99: 15%, P99.9: 20%)
- [ ] Regression alerts for P50, P95, P99 still work correctly (no regression in regression detection)

---

## Test Scenario 13: Web Browser Fallback — P99.9 Without Rust

**Purpose**: Verify that P99.9 works correctly when running in a web browser (no Tauri, no Rust). The JS sort-based `computeMetrics()` path computes P99.9, and the Results Dashboard displays it.

**Phase 3B changes**: `computeMetrics()` P99.9 calculation, `TestSummary.p999ResponseTime`

> **Requires**: Web browser mode (`npm run dev` → `http://localhost:5173`)

### Steps

**Part A — Run a test in web mode**

1. Open the app in a web browser (not Tauri): `http://localhost:5173`
2. Go to **Harness** → **Test Runner**
3. Create or select a test: `GET https://httpbin.org/get`
4. Set **Execution Mode**: **Continuous Pool**, **Concurrency**: `5`, **Iterations**: `50`
5. Click **▶ Run Test** → wait for completion

**Part B — Verify P99.9 in dashboard**

6. Click **View Full Results →** or go to **Results** sub-nav
7. Verify **P99.9** tile shows a numeric value with `ms` suffix
8. Verify P99.9 ≥ P99 ≥ P95 ≥ P50

**Part C — Verify no streaming metrics leakage**

9. During the run (if re-running), verify the live TPS tile shows count-based TPS (expected — no Rust HDR)
10. After completion, the final summary should still have accurate P99.9 (from sort-based calculation)

### Expected Outcomes

- [ ] P99.9 tile shows a numeric value in web browser mode (not `—`)
- [ ] Percentile ordering is correct: P50 ≤ P95 ≤ P99 ≤ P99.9 ≤ Max
- [ ] No errors or warnings in the browser console related to streaming metrics
- [ ] Test completes normally without Tauri/Rust dependency
- [ ] Worker-based execution (if multiple cores) also produces correct P99.9

---

## Test Scenario 14: Workflow P99.9 — Post-Run Only

**Purpose**: Verify that workflow executions also show P99.9 in the Results Dashboard, even though workflows always use the JS executor (no Rust streaming). P99.9 is computed from `computeMetrics()` on the collected results.

**Phase 3B changes**: `computeMetrics()` P99.9, `TestSummary.p999ResponseTime`

### Steps

**Part A — Create a simple workflow**

1. Go to **Workflows** (activity bar) → click **+ New Workflow** → name it `P99.9 Workflow Check`
2. Add a single **HTTP** node:
   - **Method**: `GET`
   - **URL**: `https://httpbin.org/get`
   - Click **Save**

**Part B — Run the workflow multiple iterations**

3. Configure the workflow runner:
   - **Iterations**: `50`
   - **Concurrency**: `5`
4. Click **▶ Run Workflow** → wait for completion

**Part C — Verify P99.9 in results**

5. Click **View Full Results →** or go to the workflow results
6. Verify the **P99.9** tile is present with a numeric value and `ms` suffix
7. Confirm all percentile tiles (P50, P95, P99, P99.9) have values

### Expected Outcomes

- [ ] Workflow execution completes with 50 iterations
- [ ] Results Dashboard shows P99.9 tile with numeric value
- [ ] P99.9 ≥ P99 (monotonic ordering)
- [ ] No streaming metrics during the live workflow run (expected — workflow uses JS only)
- [ ] Post-run summary is accurate and complete
- [ ] Note: The run button in the Workflow Runner is **▶ Run Workflow** (not ▶ Run Test)

---

## Test Scenario 15: Abort During Rust Load Profile — Metrics Still Saved

**Purpose**: Verify that when a user aborts a Rust load-profile run mid-execution, the streaming metrics collected up to that point are preserved in the final summary. The abort triggers `load-test-final-results` with whatever results were collected, and the P99.9/P50/P95/P99 from the HDR histogram are saved.

**Phase 3B changes**: `executor.rs` emits `load-test-final-results` on cancel, `useTestExecution` streaming override on completion

> **Requires**: Tauri desktop app (`npm run tauri:dev`)

### Steps

**Part A — Start a long load-profile test**

1. Go to **Harness** → **Test Runner**
2. Create or select a test: `GET https://httpbin.org/get`
3. Set **Execution Mode**: **Load Profile**
4. Configure: **Sustained**, **Concurrency**: `20`, **Duration (sec)**: `120` (2 minutes — long enough to abort)
5. Click **▶ Run Test**

**Part B — Abort mid-run**

6. Wait ~15 seconds until a good number of requests have completed (watch the progress bar counter)
7. Click the **■ Stop** button
8. Wait for the run to finalize (should take 1-2 seconds after abort)

**Part C — Verify saved metrics**

9. Click **View Full Results →** or go to **Results** sub-nav
10. Verify:
    - **Total Requests** shows the number completed before abort (not 0, not the full duration's worth)
    - **P50, P95, P99, P99.9** tiles all show numeric values with `ms` (from the HDR histogram snapshot at abort time)
    - **TPS** reflects the throughput during the active period
    - **Total Duration** reflects the actual run time (≈15s, not 120s)
11. Results table should contain the results collected before abort

### Expected Outcomes

- [ ] Run is aborted cleanly without crashes
- [ ] Results Dashboard populates with partial results (not empty)
- [ ] P99.9 tile shows a numeric value (not `—` or 0)
- [ ] All percentile tiles show values from the HDR histogram (accurate for the collected data)
- [ ] Total requests reflects actual requests completed (> 0, < what a full 120s run would produce)
- [ ] Total Duration reflects actual run time, not the configured 120s
- [ ] **Edge case**: If you abort very quickly (< 1 second, before any request completes), the `load-test-final-results` event may not fire (empty results set). In this case, metrics tiles may show `—`. Wait at least 5-10 seconds before aborting to ensure meaningful data.

---

## Part 16–18: Bug Fix Verification (Phase 3B)

> **Context:** These scenarios verify specific bugs found during code review of the Phase 3B implementation.

### Test Scenario 16: BUG FIX — P99.9 Baseline Comparison Uses Fallback Instead of Zero

**Bug:** When comparing a current run against an old baseline run that lacks `p999ResponseTime`,
the comparison used `0` as the baseline P99.9 value. This caused:
- Current P99.9 of e.g. `150ms` vs baseline `0ms` = huge delta but `regressed: false` (because
  delta % from zero is clamped to 0 in the calculation)
- Misleading "Improved" status when current is missing but baseline exists

**Fix:** Changed fallback from `?? 0` to `?? p99ResponseTime ?? 0`, so old runs without P99.9
use their P99 value as a reasonable approximation for comparison purposes.

#### Steps to Verify

1. Run a test with **Continuous Pool** (C:10, I:100) → wait for completion → set as **☆ Baseline**
2. Run the same test again → go to **Results** → select the new run
3. Click **Compare against baseline...** → select the baseline
4. Look at the **P99.9 Response Time** row in the comparison table

#### Expected Results

- [ ] P99.9 values shown for both runs are **non-zero** numbers
- [ ] Delta percentage is reasonable (not `0%` or infinite)
- [ ] If P99.9 truly regressed > 20%, Status shows **Regressed**
- [ ] If within threshold, Status shows **No change** or **Improved**

---

### Test Scenario 17: BUG FIX — Execution Plan Preview Hidden for Constant Arrival

**Bug:** When selecting "Constant Arrival" mode in the Test Runner, the Execution Plan Preview
(iteration-based allocation table) was still visible. It showed misleading iteration counts that
don't apply to open-model time-based execution.

**Fix:** Added `isConstantArrival` check alongside `isLoadProfile` to hide the preview.

#### Steps to Verify

1. In **Test Runner**, select **Continuous Pool** or **Batch** mode
2. Observe the **Execution Plan** section below the config — it should be **visible**
3. Switch to **Load Profile** mode → Execution Plan should **disappear**
4. Switch to **Constant Arrival** mode → Execution Plan should **also disappear**

#### Expected Results

- [ ] Execution Plan visible for Sequential, Batch, Continuous Pool
- [ ] Execution Plan hidden for Load Profile
- [ ] Execution Plan hidden for Constant Arrival

---

### Test Scenario 18: BUG FIX — CAR Error Message Distinguishes Tauri vs OAuth2

**Bug:** When Constant Arrival Rate failed because the Rust executor was unavailable (e.g., due to
OAuth2 auth on scenarios), the error message always said "requires the desktop app (Tauri)" even
when running inside Tauri. The real reason was OAuth2 incompatibility with Rust.

**Fix:** Error now checks `__TAURI__` in window and gives specific messages:
- Not on Tauri → "requires the desktop app (Tauri)"
- On Tauri but Rust unavailable → "requires the Rust executor (not available with OAuth2 auth)"

#### Steps to Verify

1. **On web browser** (`http://localhost:5173`): Try to run a test in Constant Arrival mode
   (shouldn't be possible since the radio is disabled, but if forced via config)
2. **On desktop (Tauri)**: Create a test with **OAuth2 Client Credentials** auth and try to
   run it in **Constant Arrival** mode

#### Expected Results

- [ ] Web: Error says "requires the desktop app (Tauri)"
- [ ] Desktop with OAuth2: Error says "requires the Rust executor (not available with OAuth2 auth)"

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| P99.9 in Results Dashboard | [ ] | Scenarios 1, 2 |
| P99.9 in Histogram chart | [ ] | Scenario 3 |
| P99.9 in Run Comparison / Trends | [ ] | Scenario 4 |
| P99.9 in Exported Reports | [ ] | Scenario 5 |
| P99.9 in CLI | [ ] | Scenario 6 |
| Streaming metrics accuracy (Rust vs JS) | [ ] | Scenario 7 |
| Live TPS stability (HDR) | [ ] | Scenario 8 |
| Sampled detailLevel during run | [ ] | Scenario 9 |
| Full results at completion | [ ] | Scenario 10 |
| Backward compat (old runs) | [ ] | Scenario 11 |
| Regression baseline alerts | [ ] | Scenario 12 |
| Web browser fallback | [ ] | Scenario 13 |
| Workflow P99.9 | [ ] | Scenario 14 |
| Abort preserves metrics | [ ] | Scenario 15 |
| P99.9 baseline fallback fix | [ ] | Scenario 16 |
| Exec Plan hidden for CAR | [ ] | Scenario 17 |
| CAR error message fix | [ ] | Scenario 18 |
