# Results Explorer — Debug Console & Trace Level Control (Part 1 — COMPLETED)

> **Status:** ✅ All Track A phases complete  
> **Part 2 (Track B — Server Deployment):** See `docs/plan/revisited/results-explorer-console-plan-part2.md`

---

## Overview

Added a **Debug Console** to the Results Explorer modal and introduced **Trace Capture Levels** that control how much data is collected during workflow execution. This addresses two immediate needs:

1. **Debugging multi-iteration runs** — Console-style log output scoped to individual iterations to diagnose failures in Workflow Runner executions.
2. **Configurable capture depth** — A tiered capture system lets users control detail level from Minimal (errors only) through Debug (full console fidelity).

---

## Current State (Before This Work)

### Designer Console (`WorkflowConsolePanel`)

- Renders live `LogLine` entries (`{ prefix, text, ts }`) during Quick Test execution
- Supports Log view (raw lines) and Timeline view (step summaries)
- Dockable / floating / maximizable panel, toggled via `⌘J` or status bar
- **Ephemeral** — lines are only captured when the console is open (`consoleOpenRef` gates push)
- **Not per-iteration** — all output mixed into one stream
- **Not persisted in traces** — `onLog` lines go to UI only, not into `ExecutionEvent`

### Trace Capture (`TraceCollector` → `WorkflowExecutionTrace`)

- `ExecutionEvent` captures structured data: node start/end, timing, state
- `ExecutionEventDetails` has fields for HTTP request/response, assertions, variables, errors
- `scriptOutput` field exists in `ExecutionEventDetails` **but was not populated**
- No `logLines` field existed — raw console output was lost after execution
- Full HTTP bodies captured only when `captureFullTrace` was enabled

---

## Design

### Trace Capture Levels

| Level | What's Captured | Use Case | Est. Storage |
|-------|----------------|----------|-------------|
| **Minimal** | Pass/fail, duration, error messages only | Production monitoring, high-volume scheduled runs | ~1 KB/iter |
| **Standard** (default) | + HTTP status/timing, variable snapshots, assertion results, traversed edges | Normal testing, CI/CD pipelines | ~5–20 KB/iter |
| **Full** | + Complete HTTP request/response bodies, all headers | Detailed investigation, compliance audit | ~50–500 KB/iter |
| **Debug** | + Raw `onLog` lines per node, `scriptOutput`, full console capture | Active debugging, small iteration counts | ~100 KB–2 MB/iter |

### Runner UI Controls

Trace Level, Execution Mode, and Think Time all use a consistent single-line layout:
- Bold label prefix (e.g., "Trace Level:")
- Radio buttons for mode selection
- Inline parameters (sampling checkbox/threshold for Full/Debug trace; delay inputs for Think Time)
- Contextual hint text

---

## Implementation — Track A (COMPLETED)

### Phase 1 — Trace Levels + Console Panel (from Structured Data) ✅

#### Sub-phase 1A: Data Model + Type Changes ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1A.1 | Add `TraceCaptureLevel` type | `src/shared/types/index.ts` | ✅ |
| 1A.2 | Add `captureLevel` to `WorkflowExecutionTrace` | `src/shared/types/index.ts` | ✅ |
| 1A.3 | Add `traceLevel` to `ExecutionTraceOptions` | `src/shared/types/index.ts` | ✅ |
| 1A.4 | Add `initialVariables` to `WorkflowIterationTrace` | `src/shared/types/index.ts` | ✅ |
| 1A.5 | `inferCaptureLevel()` utility for backward compat | `src/features/results/utils/inferCaptureLevel.ts` | ✅ |
| 1A.6 | `getIterationByIndex()` utility | `src/features/results/utils/iterationLookup.ts` | ✅ |
| 1A.7 | Unit tests | `inferCaptureLevel.test.ts`, `iterationLookup.test.ts` | ✅ |

#### Sub-phase 1B: Engine — Capture Gating + Sub-Workflow Fix ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1B.1 | Gate `ExecutionEventDetails` by trace level | `graphRunner.ts` | ✅ |
| 1B.2 | Capture `initialVariables` per iteration | `graphLoadRunner.ts` | ✅ |
| 1B.3 | Set `captureLevel` on assembled trace | `graphLoadRunner.ts` | ✅ |
| 1B.4 | Thread `traceOptions` into sub-workflow calls | `graphRunnerSubWorkflowHandler.ts` | ✅ |
| 1B.5 | Quick Test always at `debug` level | `useWorkflowExecution.ts` | ✅ |
| 1B.6 | Preserve fields through truncation | `storage.ts`, `traceCompression.ts` | ✅ |
| 1B.7–8 | Unit tests for capture gating, initial vars, sub-workflow threading | Multiple test files | ✅ |

#### Sub-phase 1C: Runner UI + CLI — Trace Level Selection ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1C.1–2 | Trace Level radio buttons (replaced Full Trace checkbox) | `WorkflowRunner.tsx` | ✅ |
| 1C.3 | Warning for Debug + high iterations | `WorkflowRunner.tsx` | ✅ |
| 1C.4 | Persist trace level in runner config | `useWorkflowRunnerConfig.ts` | ✅ |
| 1C.5–6 | CLI `--trace-level` flag | `cli/index.ts` | ✅ |
| 1C.7 | CSS — consistent radio button style | `src/styles/test-runner.css` | ✅ |
| 1C.8 | Unit tests | `WorkflowRunner.test.tsx` | ✅ |

#### Sub-phase 1D: Iteration Index Consistency ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1D.1–4 | Fix all iteration lookups to use `.index` field | `IterationPicker.tsx`, `WorkflowResultsExplorerModal.tsx`, `ResultsExplorerDetailPanel.tsx`, `IterationMatrixTable.tsx` | ✅ |
| 1D.5 | Unit tests for out-of-order completion | `IterationPicker.test.tsx` | ✅ |

#### Sub-phase 1E: Console Panel + Keyboard Shortcut ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1E.1–2 | Extract shared `ConsoleLogLine` component | `src/shared/components/ConsoleLogLine.tsx` | ✅ |
| 1E.3 | `reconstructLogLines()` utility | `src/features/results/utils/reconstructLogLines.ts` | ✅ |
| 1E.4 | `ResultsExplorerConsolePanel` component | `src/features/results/components/ResultsExplorerConsolePanel.tsx` | ✅ |
| 1E.5 | Adaptive behavior per trace level | `ResultsExplorerConsolePanel.tsx` | ✅ |
| 1E.6 | Click-to-select node | `ResultsExplorerConsolePanel.tsx` | ✅ |
| 1E.7 | Auto-scroll to first error | `ResultsExplorerConsolePanel.tsx` | ✅ |
| 1E.8–10 | Wire into modal, `⌘J` shortcut, footer toggle | `WorkflowResultsExplorerModal.tsx` | ✅ |
| 1E.11 | CSS | `src/styles/results-explorer.css` | ✅ |
| 1E.12–14 | Unit tests | Multiple test files | ✅ |
| 1E.17–25 | Enhancements (sub-workflow drill-down, enhanced search, aggregate view, node filter, etc.) | Multiple files | ✅ |

#### Sub-phase 1F: Designer Canvas Consistency ✅

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1F.1–7 | Viewport persistence, save layout, simplified toolbar | Multiple files | ✅ |
| 1F.8 | Unit tests | Multiple test files | ✅ |

### Phase 2 — Debug-Level Capture (Full Console Fidelity) ✅

#### Sub-phase 2A: Per-Node Log Buffering ✅

| # | Task | Status |
|---|------|--------|
| 2A.1–4 | `nodeLogBuffer` in `graphRunner.ts`, concurrent fork handling | ✅ |

#### Sub-phase 2B: Wire scriptOutput ✅

| # | Task | Status |
|---|------|--------|
| 2B.1–3 | `capturedScriptOutput` map, attach at debug level | ✅ |

#### Sub-phase 2C: Cap Enforcement ✅

| # | Task | Status |
|---|------|--------|
| 2C.1 | `MAX_LOG_LINES_PER_NODE = 200` with truncation marker | ✅ |

#### Sub-phase 2D: Console Panel Upgrade ✅

| # | Task | Status |
|---|------|--------|
| 2D.1–4 | `preferRawLogs` option, `scriptOutput` rendering, sub-workflow propagation | ✅ |

#### Sub-phase 2E: Unit Tests ✅

| # | Task | Status |
|---|------|--------|
| 2E.1–8 | Full test coverage for debug capture, log cap, console panel upgrade | ✅ |

---

## UI Consistency Updates (Post-Phase 2) ✅

After completing the core console and trace level features, additional UI consistency work was done:

| Change | Description | Status |
|--------|-------------|--------|
| Trace Level → radio buttons | Replaced dropdown with inline radio buttons matching Execution Mode style | ✅ |
| Think Time → inline layout | Restructured Think Time to single-line: label + radios + inline param inputs | ✅ |
| Console header badge | Shows current trace level in console panel header | ✅ |
| Minimal mode behavior | Console shows captured errors (not disabled) at Minimal level | ✅ |
| Shared node type labels | Extracted `nodeTypeLabels.ts` for console and explorer label consistency | ✅ |
| Sampled iteration helpers | Extracted `sampledIterations.ts` for consistent filtering | ✅ |

---

## Key Files Modified/Created

| File | Purpose |
|------|---------|
| `src/shared/types/index.ts` | `TraceCaptureLevel`, `captureLevel`, `initialVariables`, `logLines` |
| `src/features/workflow/engine/graphRunner.ts` | Capture gating by level, `nodeLogBuffer`, `scriptOutput` |
| `src/features/workflow/engine/graphLoadRunner.ts` | `traceLevel` pass-through, `initialVariables` capture |
| `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts` | `traceOptions` threading to child workflows |
| `src/features/results/components/ResultsExplorerConsolePanel.tsx` | **New** — Console panel |
| `src/features/results/utils/reconstructLogLines.ts` | **New** — Structured → log line conversion |
| `src/features/results/utils/buildAggregateSummary.ts` | **New** — Aggregate console view |
| `src/features/results/utils/nodeTypeLabels.ts` | **New** — Shared node type label maps |
| `src/features/results/utils/sampledIterations.ts` | **New** — Sampled iteration helpers |
| `src/features/results/utils/inferCaptureLevel.ts` | **New** — Backward compat level inference |
| `src/features/results/utils/iterationLookup.ts` | **New** — Index-based iteration lookup |
| `src/shared/components/ConsoleLogLine.tsx` | **New** — Shared log line renderer |
| `src/features/test-runner/WorkflowRunner.tsx` | Trace Level radio buttons, sampling controls |
| `src/features/test-runner/components/RunnerExecutionConfig.tsx` | Think Time inline layout |
| `src/styles/results-explorer.css` | Console panel styles, header badge |
| `src/styles/test-runner.css` | Radio button styles, inline param inputs |
| `cli/index.ts` | `--trace-level` CLI flag |

---

## Known Gaps Addressed

| Gap | Resolution |
|-----|-----------|
| Gap 1: Multiple entry points | Runner + CLI + Quick Test covered. Server paths deferred to Part 2. |
| Gap 2: No per-iteration initial state | `initialVariables` added to `WorkflowIterationTrace` |
| Gap 3: Iteration array vs index | All components use `.index` field via `getIterationByIndex()` |
| Gap 4: Sub-workflow trace inheritance | `traceOptions` threaded to child `runGraph` calls |
| Gap 6: Export metadata | `captureLevel` persists through JSON round-trip |
| Gap 7: Worker log streaming | Console reads from stored trace (post-hoc) — no issue |
| Gap 8: Storage pressure | `MAX_LOG_LINES_PER_NODE` cap + body truncation applied |

---

**Track A total effort: ~6–7 days** (Phase 1 + Phase 2 — COMPLETE)
