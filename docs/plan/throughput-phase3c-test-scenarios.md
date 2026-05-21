# Phase 3C (Constant Arrival Rate) — Test Scenarios for Visual Verification

> Phase 3C: Constant Arrival Rate — Open Model Load Testing
> Sub-phases: PR1 (Rust Engine), PR2 (JS Bridge + Types), PR3 (UI + Live Dashboard)
> Branch: current working branch
> Implemented: 2026-05-21

---

## Files Changed

### PR1 — Rust Core Engine

| File | Changes |
|------|---------|
| `src-tauri/src/arrival_executor.rs` | NEW: `run_constant_arrival()` — timer-based open model with semaphore backpressure, ramp support |
| `src-tauri/src/arrival_executor_test.rs` | NEW: ~25 tests — RPS accuracy, ramp, drops, abort, edge cases |
| `src-tauri/src/types.rs` | `ConstantArrival` variant on `ExecutionPlan`, `ArrivalRampConfig`, `ProgressBatch.targetRps/actualRps/droppedRequests` |
| `src-tauri/src/executor.rs` | Promoted `validate_and_cap`, `cap_body` to `pub(crate)` |
| `src-tauri/src/commands.rs` | New match arm for `ConstantArrival` plan |
| `src-tauri/src/lib.rs` | `mod arrival_executor` |

### PR2 — JS Bridge + Types

| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | `ArrivalRateConfig` interface, `'constant-arrival'` in `ExecutionMode`, `TestSummary.droppedRequests/peakRps/targetRps` |
| `src/shared/utils/executionMode.ts` | Label "Constant Arrival", title, hint, progressLabel for CAR mode |
| `src/engine/executor.ts` | `ProgressMeta.targetRps?`, `actualRps?`, `droppedRequests?` fields |
| `src/features/test-runner/utils/rustBridge.ts` | `RustExecutionPlan` `constant-arrival` variant, `buildExecutionPlan` CAR branch, `RustProgressBatch.targetRps/actualRps/droppedRequests`, progress handler mapping |
| `src/features/test-runner/hooks/useTestExecution.ts` | CAR error gate (throws if no Rust), `peakRps`/`droppedRequests` tracking, `TimeSeriesPoint.targetRps?/actualRps?`, snapshot builder |

### PR3 — UI + Live Dashboard

| File | Changes |
|------|---------|
| `src/features/test-runner/hooks/useRunnerConfig.ts` | `arrivalRate` state (`useState`), save/load/return, default `{ targetRps: 10, durationSec: 30 }` |
| `src/features/test-runner/hooks/runnerConfigDefaults.ts` | `arrivalRate?: ArrivalRateConfig` on `RunnerConfig`, `ResolvedConfig`, `resolveLoadedConfig` |
| `src/features/test-runner/hooks/useRunnerOrchestration.ts` | `isConstantArrival` flag, `updateArrivalRate` callback, `arrivalRate` in `TestConfig` + `PersistedProgress`, `displayArrivalRate` |
| `src/features/test-runner/utils/runnerProgressStorage.ts` | `arrivalRate?: ArrivalRateConfig` on `PersistedProgress` |
| `src/features/test-runner/components/RunnerExecutionConfig.tsx` | 5th radio "Constant Arrival" (disabled on web), arrival config section (Target RPS, Duration, Max In-Flight, Enable Ramp + sub-fields), concurrency/iterations hints |
| `src/features/test-runner/components/LiveProgressPanel.tsx` | `isArrivalRate` flag, arrival header tag, 4 new metric cards (Target RPS, Actual RPS, Dropped, In-Flight), progress bar fallback |
| `src/features/test-runner/components/LiveCharts.tsx` | Target vs Actual RPS chart (dashed target + solid actual area) |
| `src/features/results/ResultsDashboard.tsx` | CAR context tag, metric row (Target RPS, Peak RPS, Dropped Requests with tooltip) |
| `src/features/test-runner/TestRunner.tsx` | Passes `arrivalRate`/`updateArrivalRate`/`displayArrivalRate` to child components |
| `src/features/test-runner/ParameterizedRunner.tsx` | Same prop threading as TestRunner |

---

## Platform & Execution Mode Matrix

> Phase 3C adds a new execution mode that is **desktop-only**. Use this matrix to determine which scenarios require which setup.

| Mode | Platform | Executor | Live Streaming Metrics | Live RPS Chart | Notes |
|------|----------|----------|----------------------|----------------|-------|
| Constant Arrival | Tauri Desktop | Rust | Yes — HDR histogram | Yes — Target vs Actual | **New in Phase 3C** |
| Constant Arrival | Web Browser | — | — | — | **Disabled** — radio grayed out, error if triggered |
| Continuous Pool / Batch | Any | Rust or JS | Rust: HDR, JS: sort | No | Unaffected |
| Load Profile | Any | Rust or JS | Rust: HDR, JS: sort | No | Unaffected |
| Sequential | Any | Rust or JS | Rust: HDR, JS: sort | No | Unaffected |
| Workflow | Any | JS only | No | No | Unaffected |

---

## Before You Start

### How to Navigate

| Destination | Path |
|---|---|
| **Feature Groups** | Activity bar → **Harness** → sub-nav **Feature Groups** |
| **Test Runner** | Activity bar → **Harness** → sub-nav **Test Runner** |
| **Results Dashboard** | Activity bar → **Harness** → sub-nav **Results** |
| **After a run** | Click **View Full Results →** in the completion banner |

### Execution Mode Radio Group

The Test Runner has a radio group labeled **Execution Mode:**. When selecting a mode, two text elements appear:

1. **Exec-mode hint** — one-line summary directly below the radio group
2. **Section description** — longer description inside the config section card (only for Load Profile / Constant Arrival)

| Radio Label | Tooltip (hover) | Exec-mode Hint |
|---|---|---|
| **Sequential** | Executes one request at a time in order - no parallelism | _same as tooltip_ |
| **Batch** | _(batch tooltip)_ | _batch hint_ |
| **Continuous Pool** | _(pool tooltip)_ | _pool hint_ |
| **Load Profile** | _(load-profile tooltip)_ | _load-profile hint_ |
| **Constant Arrival** | Constant Arrival Rate (Open Model) | Fire N requests/second regardless of response time. Desktop only. |

### Run/Stop Buttons

- **Start**: **▶ Run Test** (or **▶ Run Parameterized Test** in Parameterized Runner)
- **Stop**: **■ Stop** (replaces the Run button during execution)
- **Post-run**: **View Full Results →** banner link

### Metric Label Rendering

All metric card labels in LiveProgressPanel and ResultsDashboard use CSS `text-transform: uppercase`, so source labels like `Target RPS` render visually as **TARGET RPS** in the UI. This document uses the source-case labels for clarity.

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Scenario | Pass? | Notes |
|---|----------|-------|-------|
| 1 | [Config UI — Constant Arrival Radio Button](#test-scenario-1-config-ui--constant-arrival-radio-button) | [ ] | |
| 2 | [Config UI — Arrival Rate Section Fields](#test-scenario-2-config-ui--arrival-rate-section-fields) | [ ] | |
| 3 | [Config UI — Ramp Toggle and Sub-Fields](#test-scenario-3-config-ui--ramp-toggle-and-sub-fields) | [ ] | |
| 4 | [Config UI — Concurrency and Iterations Disabled State](#test-scenario-4-config-ui--concurrency-and-iterations-disabled-state) | [ ] | |
| 5 | [Config UI — Fractional RPS Input (0.5 RPS)](#test-scenario-5-config-ui--fractional-rps-input-05-rps) | [ ] | |
| 6 | [Config UI — Disabled on Web (Non-Tauri)](#test-scenario-6-config-ui--disabled-on-web-non-tauri) | [ ] | |
| 7 | [Config UI — All Inputs Disabled While Running](#test-scenario-7-config-ui--all-inputs-disabled-while-running) | [ ] | |
| 8 | [Live Dashboard — Arrival Rate Header Tag](#test-scenario-8-live-dashboard--arrival-rate-header-tag) | [ ] | |
| 9 | [Live Dashboard — Time-Based Progress Bar](#test-scenario-9-live-dashboard--time-based-progress-bar) | [ ] | |
| 10 | [Live Dashboard — Arrival Metric Cards (Target, Actual, Dropped, In-Flight)](#test-scenario-10-live-dashboard--arrival-metric-cards) | [ ] | |
| 11 | [Live Dashboard — Target vs Actual RPS Chart](#test-scenario-11-live-dashboard--target-vs-actual-rps-chart) | [ ] | |
| 12 | [Live Dashboard — No "Concurrency" Label in Arrival Mode](#test-scenario-12-live-dashboard--no-concurrency-label-in-arrival-mode) | [ ] | |
| 13 | [Results Dashboard — Arrival Rate Context Tag](#test-scenario-13-results-dashboard--arrival-rate-context-tag) | [ ] | |
| 14 | [Results Dashboard — Peak RPS and Dropped Requests Metrics](#test-scenario-14-results-dashboard--peak-rps-and-dropped-requests-metrics) | [ ] | |
| 15 | [Config Persistence — Save and Restore Arrival Rate Settings](#test-scenario-15-config-persistence--save-and-restore-arrival-rate-settings) | [ ] | |
| 16 | [Config Persistence — Saved Progress Displays Correctly After Refresh](#test-scenario-16-config-persistence--saved-progress-displays-correctly-after-refresh) | [ ] | |
| 17 | [Ramp Execution — RPS Curve Matches Configuration](#test-scenario-17-ramp-execution--rps-curve-matches-configuration) | [ ] | |
| 18 | [Backpressure — Dropped Requests Warning Style](#test-scenario-18-backpressure--dropped-requests-warning-style) | [ ] | |
| 19 | [Mode Switching — No Residual State When Switching Away and Back](#test-scenario-19-mode-switching--no-residual-state-when-switching-away-and-back) | [ ] | |
| 20 | [Parameterized Runner — Arrival Rate Works Identically](#test-scenario-20-parameterized-runner--arrival-rate-works-identically) | [ ] | |

---

## Test Scenario 1: Config UI — Constant Arrival Radio Button

**Purpose**: Verify that the 5th execution mode radio button "Constant Arrival" appears in the execution mode selector, positioned after "Load Profile".

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — added `'constant-arrival'` to `testRunnerModes` array

### Steps

1. Open the **RedfireForge desktop app** (Tauri build: `npm run tauri:dev`)
2. Navigate to **Harness** (activity bar) → **Test Runner** (sub-nav) → select any test
3. Look at the **Execution Mode:** radio buttons at the top of the configuration panel

### Expected Outcomes

- [ ] Five radio buttons visible in this exact order: **Sequential**, **Batch**, **Continuous Pool**, **Load Profile**, **Constant Arrival**
- [ ] Hovering over the "Constant Arrival" label shows tooltip: **"Constant Arrival Rate (Open Model)"**
- [ ] The "Constant Arrival" radio button is **clickable** (not grayed out) in the desktop app
- [ ] Selecting it changes the hint text below the radio group to: **"Fire N requests/second regardless of response time. Desktop only."**
- [ ] A config section card also appears with description text: **"Fire requests at a fixed rate regardless of response time (open model, like k6 constant-arrival-rate)."**
- [ ] No `Workflow` radio button appears (that mode is only in the Workflow Runner)

---

## Test Scenario 2: Config UI — Arrival Rate Section Fields

**Purpose**: Verify that selecting "Constant Arrival" reveals the arrival rate configuration section with the correct input fields, defaults, and layout.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — arrival rate config section with `Target RPS`, `Duration (sec)`, `Max In-Flight`, and description text

### Steps

1. In **Test Runner** (**Harness** → **Test Runner** sub-nav), select the **Constant Arrival** radio button
2. Observe the configuration section that appears below the mode selector (same area where Load Profile section appears)

### Expected Outcomes

- [ ] A new section appears styled identically to the Load Profile section (same card layout)
- [ ] Description text at top reads: **"Fire requests at a fixed rate regardless of response time (open model, like k6 constant-arrival-rate)."**
- [ ] Three input fields in the first row:
  - **Target RPS** — number input, default value `10`, step `0.1` (accepts fractional values)
  - **Duration (sec)** — number input, default value `30`
  - **Max In-Flight** — number input, default display value `100` (computed as `Math.ceil(targetRps × 10)`), with hint text **"Default: RPS × 10"**
- [ ] The **"Default: RPS × 10"** hint below Max In-Flight uses the multiplication sign `×` (not the letter `x`)
- [ ] An **Enable Ramp** checkbox on the second row (unchecked by default)
- [ ] No ramp sub-fields visible when checkbox is unchecked
- [ ] Note: The Max In-Flight field's actual stored value is `undefined` until manually changed — the `100` is a computed display default

---

## Test Scenario 3: Config UI — Ramp Toggle and Sub-Fields

**Purpose**: Verify that the "Enable Ramp" checkbox correctly toggles the ramp sub-fields and pre-populates sensible defaults.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — ramp checkbox + conditional Start RPS, End RPS, Ramp Duration fields

### Steps

**Part A — Enable ramp**

1. In **Test Runner**, select **Constant Arrival** mode
2. Set **Target RPS** to `50`
3. Set **Duration (sec)** to `60`
4. Check the **Enable Ramp** checkbox

**Part B — Verify defaults**

5. Observe three new fields that appear to the right of the checkbox:
   - **Start RPS** — computed default: `Math.max(0.1, Math.round(targetRps / 10 × 10) / 10)` = `5.0`
   - **End RPS** — defaults to `targetRps` = `50`
   - **Ramp Duration (sec)** — computed default: `Math.min(10, durationSec)` = `10`

**Part C — Disable ramp**

6. Uncheck the **Enable Ramp** checkbox
7. Observe that the ramp fields disappear

### Expected Outcomes

- [ ] Checking "Enable Ramp" reveals three fields: **Start RPS**, **End RPS**, **Ramp Duration (sec)**
- [ ] **Start RPS** default is `5` (for targetRps=50: `Math.max(0.1, Math.round(50/10*10)/10)` = `5.0`)
- [ ] **End RPS** default is `50` (equals targetRps)
- [ ] **Ramp Duration (sec)** default is `10` (= `Math.min(10, 60)`)
- [ ] **Start RPS** and **End RPS** both have `step={0.1}` and accept fractional values (e.g., `2.5`)
- [ ] Unchecking "Enable Ramp" hides all three fields immediately
- [ ] After unchecking and re-checking, the defaults re-populate (not empty/zero)

---

## Test Scenario 4: Config UI — Concurrency and Iterations Disabled State

**Purpose**: Verify that when "Constant Arrival" is selected, the Concurrency and Iterations inputs are disabled with appropriate hint text, since these concepts don't apply to open-model arrival rate testing.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — `isTimeBased` flag disables both inputs, unique hint text per mode

### Steps

1. In **Test Runner**, select **Batch** mode first → note that Concurrency and Iterations are both editable
2. Switch to **Constant Arrival** mode
3. Observe the Concurrency and Iterations fields

### Expected Outcomes

- [ ] **Concurrency** input is disabled (grayed out, not editable)
- [ ] Hint text below Concurrency reads: **"Max in-flight"** (lowercase `f` in `flight` — NOT "Set in profile" which is the Load Profile hint)
- [ ] **Iterations** input is disabled (grayed out, not editable)
- [ ] Hint text below Iterations reads: **"Time-based"**
- [ ] Switching back to Batch mode re-enables both fields and removes the hint text

---

## Test Scenario 5: Config UI — Fractional RPS Input (0.5 RPS)

**Purpose**: Verify that the Target RPS field accepts fractional (decimal) values without truncation. This tests the `parseFloat` fix applied to `NumericInput` when `step < 1`.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` `NumericInput` — auto-detect `parseFloat` vs `parseInt` based on `step` prop

### Steps

1. In **Test Runner**, select **Constant Arrival** mode
2. Click on the **Target RPS** input field
3. Clear the field and type `0.5`
4. Click elsewhere to blur the input
5. Check the displayed value

### Expected Outcomes

- [ ] The input displays `0.5` (not `0` which would indicate `parseInt` truncation)
- [ ] Typing `1.7` shows `1.7` (not `1`)
- [ ] Typing `0.1` shows `0.1` (the minimum allowed value — `min={0.1}`)
- [ ] Typing `0.05` shows `0.1` (clamped to minimum on blur)
- [ ] The **Duration (sec)** field still uses integer parsing: typing `30.5` shows `30` (no `step` prop, so it defaults to `parseInt`)
- [ ] The **Start RPS** and **End RPS** ramp fields also accept fractional values (both have `step={0.1}`)

---

## Test Scenario 6: Config UI — Disabled on Web (Non-Tauri)

**Purpose**: Verify that the "Constant Arrival" radio button is disabled and visually dimmed when running the app in a web browser (non-Tauri environment), since this feature requires the Rust executor.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — `isTauri()` gating with disabled state and tooltip

### Steps

1. Open the app in a **web browser** (via `npm run dev` → `http://localhost:5173`)
2. Navigate to **Harness** → **Test Runner** → select any test
3. Observe the Execution Mode radio buttons

### Expected Outcomes

- [ ] The "Constant Arrival" radio button is **disabled** (cannot be clicked)
- [ ] The label has **reduced opacity** (visually dimmed — `style={{ opacity: 0.5 }}`)
- [ ] Hovering over the disabled label shows tooltip: **"Requires desktop app (Tauri)"**
- [ ] All other four radio buttons (Sequential, Batch, Continuous Pool, Load Profile) are **enabled** and functional
- [ ] No arrival rate config section appears since the mode cannot be selected

---

## Test Scenario 7: Config UI — All Inputs Disabled While Running

**Purpose**: Verify that all arrival rate configuration inputs become disabled during an active test run, preventing changes mid-execution.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — `disabled={isRunning}` on all arrival rate inputs

### Steps

1. In **Test Runner** (desktop app), select **Constant Arrival** mode
2. Configure: Target RPS = `5`, Duration = `15` seconds, check **Enable Ramp**
3. Select at least one test and click **▶ Run Test**
4. While the test is running (within the 15-second window), try to interact with the arrival rate fields

### Expected Outcomes

- [ ] **Target RPS** input is disabled (grayed out)
- [ ] **Duration (sec)** input is disabled
- [ ] **Max In-Flight** input is disabled
- [ ] **Enable Ramp** checkbox is disabled (cannot toggle)
- [ ] **Start RPS**, **End RPS**, **Ramp Duration (sec)** are all disabled
- [ ] The **Execution Mode** radio buttons are all disabled
- [ ] The run button shows **■ Stop** instead of **▶ Run Test**
- [ ] After the run completes, all inputs become editable again and the button reverts to **▶ Run Test**

---

## Test Scenario 8: Live Dashboard — Arrival Rate Header Tag

**Purpose**: Verify that the progress header displays arrival-rate-specific information in the mode tag during a constant arrival rate run.

**Phase 3C changes**: `LiveProgressPanel.tsx` — conditional header tag showing arrival rate details with optional ramp info

### Steps

**Part A — Without ramp**

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `30` seconds, Ramp disabled
2. Select a test and click **▶ Run Test**
3. Observe the progress header — look for a gray badge tag next to "Progress"

**Part B — With ramp**

4. After Part A completes, configure: Target RPS = `20`, Duration = `30` seconds, Enable Ramp (Start: `2`, End: `20`, Ramp Duration: `10`)
5. Click **▶ Run Test** again
6. Observe the progress header tag

### Expected Outcomes

- [ ] **Part A**: Header tag shows **`Arrival Rate · Target:10 RPS · 30s`** (note: no space after `Target:`)
- [ ] **Part B**: Header tag shows **`Arrival Rate · Target:20 RPS · 30s · ramp 2→20 RPS`** (includes `RPS` suffix after ramp end value)
- [ ] The mode name in the tag is **"Arrival Rate"** (from `progressLabel`), not "Constant Arrival"
- [ ] The tag is styled as a gray badge (class `progress-mode-tag`)
- [ ] No "C:1" or "I:0" text appears (these are hidden for time-based modes)

> **Note**: The Results Dashboard context tag (Scenario 13) uses a slightly different format — see that scenario for differences.

---

## Test Scenario 9: Live Dashboard — Time-Based Progress Bar

**Purpose**: Verify that the progress bar displays elapsed time / total duration (not completed/total requests) during a constant arrival rate run, matching the Load Profile behavior.

**Phase 3C changes**: `LiveProgressPanel.tsx` — `isTimeBased` includes `constant-arrival`, progress bar text shows `Xs / Ys (N requests)`

### Steps

1. Configure **Constant Arrival**: Target RPS = `5`, Duration = `20` seconds
2. Select a test and click **▶ Run Test**
3. Watch the progress bar during execution

### Expected Outcomes

- [ ] Progress bar fills gradually from 0% to 100% over the 20-second duration
- [ ] Progress text shows elapsed time format: e.g., **`5.0s / 20s (25 requests)`** — elapsed uses 1 decimal place, total uses 0 decimals
- [ ] At the start (before first progress update), fallback text shows **`0s / 20s (0 requests)`** (uses `arrivalRate.durationSec` for the total)
- [ ] Progress bar reaches exactly 100% at the end of the duration
- [ ] If the run finishes, the final elapsed time matches or slightly exceeds the configured duration

---

## Test Scenario 10: Live Dashboard — Arrival Metric Cards

**Purpose**: Verify that four arrival-rate-specific metric cards appear during a constant arrival rate run, alongside the standard metric cards.

**Phase 3C changes**: `LiveProgressPanel.tsx` — 4 new metric cards gated by `isArrivalRate && profileMeta`

### Steps

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `30` seconds
2. Select a test and click **▶ Run Test**
3. Once the first progress update arrives (1–2 seconds), observe the metric cards in the grid below the progress bar

### Expected Outcomes

- [ ] Four standard metric cards always appear: **TPS**, **Avg Response**, **Error Rate**, **Validation Failures** (optionally **Avg Iteration** if workflow data present)
- [ ] Four additional arrival-rate-specific cards appear in the same grid: **Target RPS**, **Actual RPS**, **Dropped**, **In-Flight**
- [ ] **Target RPS** card shows the configured value (e.g., `10`)
- [ ] **Actual RPS** card shows a live value close to the target (e.g., `9.8`)
- [ ] **Dropped** card shows a count (likely `0` for a low RPS test) — when `0`, the card has NO special styling; when `> 0`, it uses red/error border styling
- [ ] **Dropped** card has a tooltip on the ⓘ icon: **"Requests dropped due to max in-flight backpressure"**
- [ ] **In-Flight** card shows the current number of in-flight requests (e.g., `3`) as a single number
- [ ] No **"Concurrency"** card appears (that card is specific to Load Profile mode, with `X / Y` format)
- [ ] All labels render visually in UPPERCASE in the UI (CSS `text-transform: uppercase`)

---

## Test Scenario 11: Live Dashboard — Target vs Actual RPS Chart

**Purpose**: Verify that a new "Target vs Actual RPS" chart appears during constant arrival rate runs, showing the configured target as a dashed line and the actual achieved RPS as a filled area.

**Phase 3C changes**: `LiveCharts.tsx` — new `AreaChart` with `targetRps` (dashed Line) and `actualRps` (filled Area), gated by `isArrivalRate`

### Steps

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `30` seconds
2. Select a test and click **▶ Run Test**
3. After 3–4 seconds (when at least 2 time series data points exist), observe the charts section

### Expected Outcomes

- [ ] Five charts are visible during an arrival rate run:
  1. **Response Time (ms)** — standard
  2. **Throughput (TPS)** — standard
  3. **Error Rate (%)** — standard
  4. **Target vs Actual RPS** — **new in Phase 3C**
  5. **Concurrency** — appears when any data point has `concurrency > 0`
- [ ] The **Target vs Actual RPS** chart title reads exactly **"Target vs Actual RPS"**
- [ ] The chart shows a **dashed red line** (`#e74c3c`, `strokeDasharray="5 5"`) for Target RPS — should be a flat line at 10
- [ ] The chart shows a **solid orange area** (`#e67e22`, gradient fill) for Actual RPS — should track close to the target line
- [ ] Hovering over a data point shows a tooltip with **"Target RPS: 10"** and **"Actual RPS: 9.8"** (or similar)
- [ ] The **Concurrency** chart shows in-flight count over time as a purple step chart; its tooltip label is **"In-Flight"**
- [ ] When switching to a non-arrival mode (e.g., Batch) and running, the Target vs Actual RPS chart does NOT appear

---

## Test Scenario 12: Live Dashboard — No "Concurrency" Label in Arrival Mode

**Purpose**: Verify that the "Concurrency" metric card (showing `currentInFlight / targetConcurrency`) does NOT appear in arrival rate mode. Instead, arrival mode shows "In-Flight" as a standalone card.

**Phase 3C changes**: `LiveProgressPanel.tsx` — `{isTimeBased && !isArrivalRate && profileMeta && (... Concurrency ...)}` guard

### Steps

1. Configure **Load Profile** mode: **Sustained**, Concurrency `10`, Duration `15`s → click **▶ Run Test** → observe metrics
2. After completion, configure **Constant Arrival**: Target RPS `10`, Duration `15`s → click **▶ Run Test** → observe metrics

### Expected Outcomes

- [ ] **Load Profile run**: Shows a **"Concurrency"** metric card with format `5 / 10` (in-flight / target)
- [ ] **Constant Arrival run**: Does NOT show a "Concurrency" card
- [ ] **Constant Arrival run**: Shows a separate **"In-Flight"** card with a single number (e.g., `3`)
- [ ] The "In-Flight" card does NOT use the `X / Y` format — just a standalone count

---

## Test Scenario 13: Results Dashboard — Arrival Rate Context Tag

**Purpose**: Verify that completed constant arrival rate runs display the correct context tag in the Results Dashboard, showing arrival rate details instead of the standard mode/concurrency/iterations tag.

**Phase 3C changes**: `ResultsDashboard.tsx` — conditional context tag for `'constant-arrival'` mode

### Steps

**Part A — Run without ramp**

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `15` seconds, Ramp disabled
2. Click **▶ Run Test** → wait for completion
3. Click **View Full Results →** (or go to **Harness** → **Results** sub-nav)
4. Select the completed run in the runs list

**Part B — Run with ramp**

5. Configure **Constant Arrival**: Target RPS = `20`, Duration = `15` seconds, Enable Ramp (Start: `2`, End: `20`, Ramp Duration: `5`)
6. Click **▶ Run Test** → completion → go to **Results**

### Expected Outcomes

- [ ] **Part A**: Context tag shows **`Arrival Rate · 10 RPS · 15s`** (no `Target:` prefix — unlike the live header tag)
- [ ] **Part B**: Context tag shows **`Arrival Rate · 20 RPS · 15s · ramp 2→20`** (no `RPS` suffix on ramp — unlike the live header tag which includes `RPS`)
- [ ] The tag is styled as a gray badge (class `exec-mode-tag`)
- [ ] A separate test run done in Batch mode shows the standard **`Batch · C:4 · I:20`** format

> **Key differences from live header tag (Scenario 8)**:
> - Live: `Target:10 RPS` → Results: `10 RPS` (no `Target:` prefix)
> - Live ramp: `ramp 2→20 RPS` → Results ramp: `ramp 2→20` (no `RPS` suffix)

---

## Test Scenario 14: Results Dashboard — Peak RPS and Dropped Requests Metrics

**Purpose**: Verify that the Results Dashboard shows arrival-rate-specific summary metrics (Target RPS, Peak RPS, Dropped Requests) for completed constant arrival rate runs.

**Phase 3C changes**: `ResultsDashboard.tsx` — additional metrics row gated by `executionMode === 'constant-arrival'`

### Steps

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `15` seconds
2. Click **▶ Run Test** → completion → go to **Results** → select the run
3. Observe the metrics section below the percentile tiles

### Expected Outcomes

- [ ] An additional row of metric cards appears **after** the standard metrics (TPS, Avg, P50, P95, P99, P99.9, Error Rate, Total Duration, Total Requests, Validation Failures)
- [ ] The row contains three cards: **Target RPS**, **Peak RPS**, **Dropped Requests**
- [ ] **Target RPS** shows the configured value (`10`) — falls back to `—` if missing
- [ ] **Peak RPS** shows the highest achieved RPS during the run (should be close to 10) — falls back to `—` if missing
- [ ] **Dropped Requests** shows a count (likely `0` for a low-RPS test)
- [ ] When Dropped = `0`: card has **green/success** styling (class `metric-card success`)
- [ ] When Dropped > `0`: card has **red/error** styling (class `metric-card error`)
- [ ] **Dropped Requests** card has a ⓘ tooltip: **"Requests dropped because all in-flight slots were occupied (backpressure)"**
- [ ] This metrics row does NOT appear for non-arrival mode runs (e.g., Batch, Load Profile)

> **Note**: The Dropped tooltip in ResultsDashboard differs slightly from LiveProgressPanel:
> - **Live**: "Requests dropped due to max in-flight backpressure"
> - **Results**: "Requests dropped because all in-flight slots were occupied (backpressure)"

---

## Test Scenario 15: Config Persistence — Save and Restore Arrival Rate Settings

**Purpose**: Verify that arrival rate configuration (target RPS, duration, max in-flight, ramp settings) is automatically saved and restored when switching between environments or refreshing the page.

**Phase 3C changes**: `useRunnerConfig.ts` — `arrivalRate` state auto-saved via `saveRunnerConfig`, conditionally loaded via `resolveLoadedConfig`

### Steps

**Part A — Configure and leave**

1. In **Harness** → **Test Runner**, select **Constant Arrival** mode
2. Set: Target RPS = `25`, Duration = `45`, Max In-Flight = `500`
3. Check **Enable Ramp**, set: Start RPS = `5`, End RPS = `25`, Ramp Duration = `8`
4. Switch to a **different environment/microservice** in the app header dropdowns

**Part B — Return and verify**

5. Switch back to the original environment/microservice
6. The Execution Mode should still show "Constant Arrival" selected
7. Verify all fields restored

### Expected Outcomes

- [ ] Execution Mode is still **Constant Arrival** (radio button selected)
- [ ] **Target RPS** shows `25`
- [ ] **Duration (sec)** shows `45`
- [ ] **Max In-Flight** shows `500` (not the default `250` = `Math.ceil(25 * 10)`)
- [ ] **Enable Ramp** is checked
- [ ] **Start RPS** shows `5`, **End RPS** shows `25`, **Ramp Duration (sec)** shows `8`
- [ ] The **"Default: RPS × 10"** hint does NOT appear below Max In-Flight (because `maxInFlight` was explicitly set to `500`)

---

## Test Scenario 16: Config Persistence — Saved Progress Displays Correctly After Refresh

**Purpose**: Verify that after a constant arrival rate run completes, the progress panel (summary, time series, metrics) is persisted to localStorage and displays correctly after page navigation.

**Phase 3C changes**: `useRunnerOrchestration.ts` — `arrivalRate` included in `PersistedProgress`, `displayArrivalRate` derived from saved progress

### Steps

1. Configure **Constant Arrival**: Target RPS = `10`, Duration = `15` seconds
2. Click **▶ Run Test** → wait for completion — note the final summary (TPS, Avg Response, etc.)
3. Navigate away to **Results** sub-nav
4. Navigate back to **Test Runner** sub-nav

### Expected Outcomes

- [ ] The progress panel re-appears showing the saved summary metrics from the last run
- [ ] The header tag shows **`Arrival Rate · Target:10 RPS · 15s`** (restored from saved progress)
- [ ] The time series charts (Response Time, TPS, Error Rate, Target vs Actual RPS) display with the saved data
- [ ] A **✕ Clear** button appears to dismiss the saved progress
- [ ] Clicking **✕ Clear** removes the progress panel entirely

---

## Test Scenario 17: Ramp Execution — RPS Curve Matches Configuration

**Purpose**: Verify that when ramp is enabled, the actual RPS curve in the Target vs Actual RPS chart visually matches the expected ramp pattern — starting low, climbing to the target, then sustaining.

**Phase 3C changes**: End-to-end ramp: `RunnerExecutionConfig.tsx` ramp fields → `useRunnerOrchestration.ts` → `rustBridge.ts` `rampConfig` → `arrival_executor.rs` linear ramp → `LiveCharts.tsx` chart

### Steps

1. Configure **Constant Arrival**: Target RPS = `20`, Duration = `30` seconds
2. Enable Ramp: Start RPS = `2`, End RPS = `20`, Ramp Duration = `10` seconds
3. Click **▶ Run Test**
4. Watch the **Target vs Actual RPS** chart live during the 30-second run

### Expected Outcomes

- [ ] The **dashed red target line** starts at `2` and climbs linearly to `20` over the first 10 seconds, then stays flat at `20` for the remaining 20 seconds
- [ ] The **solid orange actual RPS area** tracks close to the target line (within ±2 of target for most data points)
- [ ] The ramp is visually smooth (no sharp step changes)
- [ ] After the ramp period (t > 10s), both target and actual stabilize near `20 RPS`
- [ ] The **Actual RPS** metric card value trends from ~2 → ~20 during the ramp, then stays near 20
- [ ] The **Target RPS** metric card stays at the configured target value (changes during ramp to reflect the current target)

---

## Test Scenario 18: Backpressure — Dropped Requests Warning Style

**Purpose**: Verify that when dropped requests occur (due to max in-flight backpressure), the Dropped metric card changes to a warning/error style both during the live run and in the results dashboard.

**Phase 3C changes**: `LiveProgressPanel.tsx` — `error` class on Dropped card when > 0; `ResultsDashboard.tsx` — `error`/`success` class

### Steps

1. Configure **Constant Arrival**: Target RPS = `50`, Duration = `15` seconds
2. Set **Max In-Flight** to `5` (deliberately low to force drops)
3. Select a test with a slow response endpoint: `https://httpbin.org/delay/1` (1 second delay)
4. Click **▶ Run Test**

### Expected Outcomes

**During the live run (LiveProgressPanel):**

- [ ] The **Dropped** metric card shows a number > 0 (requests could not be sent because all 5 in-flight slots were occupied)
- [ ] The **Dropped** card uses a **red/error** border style (CSS class `metric-card error`)
- [ ] The ⓘ tooltip reads: **"Requests dropped due to max in-flight backpressure"**
- [ ] When running a test where drops = 0, the Dropped card has **no special styling** (just `metric-card`, no `success` or `error` class)

**After completion (ResultsDashboard):**

- [ ] The **Dropped Requests** card shows the same count > 0 with **red/error** styling (class `metric-card error`)
- [ ] The ⓘ tooltip reads: **"Requests dropped because all in-flight slots were occupied (backpressure)"** (slightly different wording from live panel)
- [ ] When drops = 0, the Results Dashboard card uses **green/success** styling (class `metric-card success`)

> **Note**: The styling behavior differs between live and results views:
> - **Live (drops=0)**: No special class (plain `metric-card`)
> - **Results (drops=0)**: `metric-card success` (green styling)
> - **Both (drops>0)**: `metric-card error` (red styling)

---

## Test Scenario 19: Mode Switching — No Residual State When Switching Away and Back

**Purpose**: Verify that switching from Constant Arrival to another mode and back does not cause visual artifacts, stale ramp state, or mismatched UI elements.

**Phase 3C changes**: `RunnerExecutionConfig.tsx` — `isConstantArrival` conditional rendering, `useEffect` sync for `rampEnabled`

### Steps

1. Select **Constant Arrival** mode → configure Target RPS = `15`, check **Enable Ramp**
2. Switch to **Batch** mode → observe that the arrival config section disappears
3. Switch back to **Constant Arrival** mode
4. Observe the arrival rate config section

### Expected Outcomes

- [ ] The arrival rate config section re-appears with the previously set values (Target RPS = `15`)
- [ ] The **Enable Ramp** checkbox correctly reflects the saved ramp state (should be checked if ramp was saved)
- [ ] The ramp sub-fields (**Start RPS**, **End RPS**, **Ramp Duration (sec)**) appear if ramp is enabled
- [ ] No Load Profile fields (Ramp-Up / Sustained / Spike profile type buttons) are visible
- [ ] The **Concurrency** field shows hint **"Max in-flight"** (not "Set in profile")
- [ ] The **Iterations** field shows hint **"Time-based"**

---

## Test Scenario 20: Parameterized Runner — Arrival Rate Works Identically

**Purpose**: Verify that the Constant Arrival Rate mode works identically in the Parameterized Runner as it does in the standard Test Runner, since both share the same `useRunnerOrchestration` hook and `RunnerExecutionConfig` component.

**Phase 3C changes**: `ParameterizedRunner.tsx` — passes `arrivalRate`, `updateArrivalRate`, `displayArrivalRate` props

### Steps

1. Navigate to **Harness** → **Test Runner** sub-nav
2. Select a scenario that has a **data source** (CSV or other parameterized data) — this opens the **Parameterized Runner**
3. Verify the **Constant Arrival** radio button is present and functional (desktop app)
4. Select **Constant Arrival** → configure Target RPS = `5`, Duration = `15` seconds
5. Click **▶ Run Parameterized Test** (note: this runner uses a different button label than standard Test Runner)

### Expected Outcomes

- [ ] All 5 execution mode radio buttons are present (including **Constant Arrival**)
- [ ] Selecting Constant Arrival shows the same config section (Target RPS, Duration, Max In-Flight, Enable Ramp)
- [ ] The live progress panel shows the arrival rate header tag and metric cards (same as Test Runner)
- [ ] The Target vs Actual RPS chart appears during execution
- [ ] After completion, the Results Dashboard shows the arrival-rate-specific context tag and metrics
- [ ] The Concurrency and Iterations inputs show the same disabled state and hints as in Test Runner
- [ ] The run button label is **▶ Run Parameterized Test** (not **▶ Run Test**)

---

## Overall Verification Summary

After completing all scenarios:

| Area | Status | Evidence |
|------|--------|----------|
| Arrival radio button visible and clickable (desktop) | [ ] | Scenario 1 |
| Arrival config section with correct fields/defaults | [ ] | Scenario 2 |
| Ramp toggle and sub-field population | [ ] | Scenario 3 |
| Concurrency/Iterations correctly disabled | [ ] | Scenario 4 |
| Fractional RPS values preserved (no parseInt truncation) | [ ] | Scenario 5 |
| Disabled on web with tooltip | [ ] | Scenario 6 |
| All fields disabled during run | [ ] | Scenario 7 |
| Arrival rate header tag in live progress | [ ] | Scenario 8 |
| Time-based progress bar with correct fallback | [ ] | Scenario 9 |
| Four arrival-specific metric cards | [ ] | Scenario 10 |
| Target vs Actual RPS chart + Concurrency chart | [ ] | Scenario 11 |
| No Concurrency label in arrival mode | [ ] | Scenario 12 |
| Results Dashboard context tag (different format from live) | [ ] | Scenario 13 |
| Peak RPS and Dropped Requests metrics + tooltips | [ ] | Scenario 14 |
| Config persistence across env/svc switch | [ ] | Scenario 15 |
| Saved progress restoration after navigation | [ ] | Scenario 16 |
| Ramp curve matches configuration | [ ] | Scenario 17 |
| Dropped requests styling differences (live vs results) | [ ] | Scenario 18 |
| Clean mode switching (no residual state) | [ ] | Scenario 19 |
| Parameterized Runner parity | [ ] | Scenario 20 |
