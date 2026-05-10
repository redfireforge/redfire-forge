# Results Explorer — Debug Console, Trace Level Control & Sampling Plan

## Overview

Add a **Debug Console** to the Results Explorer modal, introduce **Trace Capture Levels** that control how much data is collected during workflow execution, and provide a **Sampling** feature that lets users re-run selected iterations at a higher trace level from within the Results Explorer. This addresses three needs:

1. **Debugging multi-iteration runs** — Users need console-style log output scoped to individual iterations to diagnose failures in Workflow Runner executions.
2. **Production readiness** — When deployed to a server, full trace capture for every run is unsustainable. A tiered capture system lets admins control storage/performance while giving developers full debug capability when needed.
3. **Post-run investigation** — After reviewing results, users often need deeper data for specific iterations. Sampling lets them selectively re-run and capture detailed traces without re-running the entire workflow.

---

## Current State

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
- `scriptOutput` field exists in `ExecutionEventDetails` **but is not populated**
- No `logLines` field exists — raw console output is lost after execution
- Full HTTP bodies are captured only when `captureFullTrace` is enabled

### Gap

| Data | Designer Console | Trace / Results Explorer |
|------|-----------------|-------------------------|
| HTTP request/response summary | ✓ (via `onLog`) | ✓ (structured in `ExecutionEventDetails`) |
| Full HTTP bodies | ✓ (inline) | Only with `captureFullTrace` |
| Variable extractions | ✓ (via `onLog`) | ✓ (`extractedVariables` in details) |
| Assertion results | ✓ (via `onLog`) | ✓ (structured in details) |
| Errors + stack traces | ✓ (via `onLog`) | ✓ (`error`, `errorStack` in details) |
| Script `console.log` output | ✓ (when `captureConsole: true`) | ✗ (`scriptOutput` exists but not wired) |
| Raw `onLog` lines per node | ✓ (ephemeral, not per-iteration) | ✗ (not captured) |

---

## Design

### Trace Capture Levels

A tiered system that controls what data is collected and stored:

| Level | What's Captured | Use Case | Est. Storage |
|-------|----------------|----------|-------------|
| **Minimal** | Pass/fail, duration, error messages only | Production monitoring, high-volume scheduled runs | ~1 KB/iter |
| **Standard** (default) | + HTTP status/timing, variable snapshots, assertion results, traversed edges | Normal testing, CI/CD pipelines | ~5–20 KB/iter |
| **Full** | + Complete HTTP request/response bodies, all headers | Detailed investigation, compliance audit | ~50–500 KB/iter |
| **Debug** | + Raw `onLog` lines per node, `scriptOutput`, full console capture | Active debugging, small iteration counts | ~100 KB–2 MB/iter |

### Configuration Hierarchy (3 layers)

```
Server Config (admin)           ← enforces ceiling
  ↓
Workflow Definition (designer)  ← default for scheduled/automated runs
  ↓
Runner UI (per execution)       ← user override, capped by server max
```

Effective level: `min(server_max, runner_selection)`

#### Layer 1 — Server Config (future, Phase 3)

```
┌─ Server Admin Settings ─────────────────────────────┐
│  Max allowed trace level: [Standard ▼]               │
│  Max retention days:      [30]                       │
│  Max trace storage/run:   [50 MB]                    │
│  Auto-downgrade:          [>100 iters → Standard]    │
└──────────────────────────────────────────────────────┘
```

#### Layer 2 — Workflow Definition

```typescript
interface Workflow {
  // ... existing fields ...
  defaultTraceLevel?: TraceCaptureLevel;  // saved with workflow
}
```

Used as the default when the workflow is executed by a scheduler or CI trigger.

#### Layer 3 — Runner UI (per execution)

```
┌─ Workflow Runner ────────────────────────────────────┐
│  Iterations: [10]   Ramp: [1/s]                      │
│                                                      │
│  Trace Level: [Standard ▼]  ⓘ                       │
│               ├─ Minimal                             │
│               ├─ Standard ✓                          │
│               ├─ Full                                │
│               └─ Debug                               │
│                                                      │
│  ⚠ Debug trace with >10 iterations increases         │
│    memory usage. Consider reducing iteration count.  │
│                                                      │
│  [▶ Run]                                             │
└──────────────────────────────────────────────────────┘
```

### Data Model Changes

```typescript
// New type
type TraceCaptureLevel = 'minimal' | 'standard' | 'full' | 'debug';

// Extended
interface WorkflowExecutionTrace {
  // ... existing fields ...
  captureLevel: TraceCaptureLevel;
}

interface ExecutionEventDetails {
  // ... existing fields ...
  logLines?: LogLine[];      // populated at 'debug' level
  scriptOutput?: string;     // populated at 'debug' level (field exists, wire it up)
}
```

### Capture Gating in `graphRunner.ts`

```typescript
// Pseudocode — what each level captures
function buildEventDetails(level: TraceCaptureLevel, ...): ExecutionEventDetails {
  const details: ExecutionEventDetails = {};

  if (level === 'minimal') {
    // Only error info
    if (error) { details.error = error.message; details.errorStack = error.stack; }
    return details;
  }

  // Standard+: structured HTTP summary, variables, assertions
  details.method = req.method;
  details.url = req.url;
  details.statusCode = res.status;
  details.durationMs = timing;
  details.extractedVariables = extracted;
  details.assertions = assertionResults;

  if (level === 'full' || level === 'debug') {
    // Full+: complete request/response bodies
    details.request = { method, url, headers, body };
    details.response = { status, headers, body };
  }

  if (level === 'debug') {
    // Debug: raw log lines collected during this node's execution
    details.logLines = collectedLogLines;
    details.scriptOutput = capturedScriptOutput;
  }

  return details;
}
```

### Console Panel in Results Explorer

#### Appearance — Pop-up modal matching Designer Console

```
┌─ Results Explorer ──────────────────────────────────────────────┐
│ [📊 Diagram] [📈 Timeline]    Iter: [◀ 3/5 ▶]                  │
│                                                                  │
│  ┌─ Canvas ──────────┐  ┌─ Detail Panel ──────────────────────┐ │
│  │                    │  │  Fetch Data (HTTP)                  │ │
│  │    (diagram)       │  │  [Overview|Req|Res|Vars|Assertions] │ │
│  │                    │  │  ...                                │ │
│  └────────────────────┘  └────────────────────────────────────-┘ │
│  ┌─ 📋 Console (Iteration 3) ───── [All Nodes ▼] [Dock|Max] ─┐ │
│  │ * 10:23:45.001  ── Run iteration 3 ──                      │ │
│  │ * 10:23:45.002  [Start] trigger fired                      │ │
│  │ > 10:23:45.010  [Fetch Data] GET /api/users                │ │
│  │ < 10:23:45.055  [Fetch Data] 200 OK (45ms)                 │ │
│  │ # 10:23:45.056  [Fetch Data] userId = "abc-123"            │ │
│  │ # 10:23:45.057  [Script] console: token refreshed          │ │
│  │ ✓ 10:23:45.058  [Fetch Data] status == 200                 │ │
│  │ ! 10:23:45.120  [Check Result] condition evaluated → false  │ │
│  │ ! 10:23:45.121  [Handle Error] HTTP 500 Server Error       │ │
│  └────────────────────────── [🔍 Search] [Clear] [✕ Close] ───┘ │
│                                                                  │
│  [▶ Iteration Matrix]                                            │
│  ← → iterate · ⌘J console · / search · Esc close                │
└──────────────────────────────────────────────────────────────────┘
```

#### Console Features

| Feature | Description |
|---------|-------------|
| **Iteration-scoped** | Shows log for the currently selected iteration only |
| **Node filter** | Dropdown: "All Nodes" or pick a specific node |
| **Prefix → icon/color** | Same scheme as Designer Console (`*` info, `>` outbound, `<` inbound, `#` extract, `!` error, `✓` pass, `✗` fail) |
| **Timestamps** | Each line shows `HH:mm:ss.SSS` from the event timestamp |
| **Node labels** | `[Node Name]` prefix on each line for multi-node view |
| **Search** | Filter lines by text (same as Designer Console) |
| **Dock / Maximize** | Bottom-docked (default) or full-height maximize |
| **Toggle** | `⌘J` shortcut, footer button, or keyboard shortcut legend |
| **Click → select node** | Clicking a console line selects that node in the canvas and opens its detail panel |
| **Error highlighting** | Error lines (`!` prefix) get a red-tinted background row |
| **Auto-scroll** | Scrolls to first error line when opening, if errors exist |

#### Adaptive Behavior Based on Trace Level

| Trace Level | Console Content |
|-------------|----------------|
| **Minimal** | Console button disabled. Tooltip: "Re-run with Standard or higher to enable Console." |
| **Standard** | Reconstructed narrative from structured `ExecutionEventDetails` — HTTP summaries, assertions, errors, variable extractions. No raw log lines. |
| **Full** | Same as Standard + inline HTTP body previews (truncated). |
| **Debug** | Full fidelity — raw `onLog` lines, script `console.log` output. Identical to Designer Console experience. |

---

## Production Storage Controls (Future — Server Deployment)

### Retention Policy

| Trace Level | Default Retention | Configurable |
|-------------|-------------------|-------------|
| Minimal | 90 days | Yes |
| Standard | 30 days | Yes |
| Full | 14 days | Yes |
| Debug | 7 days | Yes |

### Auto-Downgrade Rules

When iteration count exceeds a threshold, automatically cap the trace level:

```
If iterations > 100  → cap at Standard (even if user picks Full/Debug)
If iterations > 1000 → cap at Minimal
```

Thresholds configurable by server admin.

### Storage Quota per Run

- If total trace size exceeds the configured limit (e.g., 50 MB):
  - Truncate HTTP bodies with `[truncated after 10KB]` marker
  - Drop `logLines` arrays (keep first + last 10 lines with `[... N lines omitted ...]`)
  - Keep all structured fields (assertions, variables, timing)

### Lazy Loading (Large Traces)

For Full/Debug traces stored on the server:
- Initial load returns Standard-level data (fast)
- HTTP bodies and `logLines` fetched on-demand when user opens Request/Response tabs or Console
- Reduces network transfer and initial render time

### Sampling at Scale

For runs with 1000+ iterations where Full/Debug is requested:
- Capture at requested level for: first 5, last 5, every Nth, plus all failures
- Remaining iterations captured at Standard
- Results Explorer shows a badge: "Debug trace available" on sampled iterations

---

## Sampling — Post-Run Debug Re-execution

### The Problem

A typical debugging workflow today:

1. User runs 50 iterations at Standard level → sees 3 failures in Results Explorer
2. To investigate, user must re-run the **entire** 50-iteration workflow at Debug level
3. This wastes time and resources — only 3 iterations need deeper data

### The Solution: Sample & Re-run from Results Explorer

After viewing results, users can select specific iterations (or let the system auto-select failures) and re-run **only those** at a higher trace level. The enriched trace data is merged back into the existing results.

### User Flow

```
Step 1: Run 50 iterations at Standard
┌─ Workflow Runner ──────────────────────┐
│  Iterations: [50]  Trace: [Standard ▼] │
│  [▶ Run]                               │
└────────────────────────────────────────┘

Step 2: Open Results Explorer, see 3 failed iterations
┌─ Results Explorer ─────────────────────────────────────┐
│  50 iterations • 47 passed • 3 failed                  │
│                                                        │
│  Iteration #12 ✗  |  #28 ✗  |  #41 ✗                  │
│                                                        │
│  Console button is grayed out:                         │
│  "Captured at Standard level. Sample iterations at     │
│   Debug level for full console output."                │
│                                                        │
│  [🔬 Sample & Debug ▼]                                 │
│     ├─ Sample failed iterations (3)                    │
│     ├─ Sample selected iteration                       │
│     ├─ Sample random 5 iterations                      │
│     └─ Custom selection...                             │
└────────────────────────────────────────────────────────┘

Step 3: Click "Sample failed iterations" → re-runs #12, #28, #41 at Debug
┌─ Sampling in Progress ──────────────────┐
│  Re-running 3 iterations at Debug level  │
│  ████████████░░░░  2/3 complete          │
│  [Cancel]                                │
└──────────────────────────────────────────┘

Step 4: Results enriched — Console now available for sampled iterations
┌─ Results Explorer ─────────────────────────────────────┐
│  50 iterations • 47 passed • 3 failed                  │
│  🔬 3 iterations sampled at Debug level                │
│                                                        │
│  Iter: [◀ 12/50 ▶]  🔬 Debug trace available          │
│                                                        │
│  Console panel now shows full log for iteration #12:   │
│  ┌─ 📋 Console (Iteration 12) ───────────────────────┐ │
│  │ * 10:23:45.001  ── Run iteration 12 ──            │ │
│  │ > 10:23:45.010  [Fetch Data] GET /api/users       │ │
│  │ < 10:23:45.055  [Fetch Data] 500 Server Error     │ │
│  │ ! 10:23:45.056  [Fetch Data] Unexpected token ... │ │
│  │ # 10:23:45.057  [Script] console: retry count = 3 │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Sampling Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Failed iterations** | Auto-selects all iterations that failed | Most common — debug what went wrong |
| **Selected iteration** | Re-runs the currently viewed iteration | User already knows which one to inspect |
| **Random sample** | Picks N random iterations (default 5) | Understand general behavior / timing patterns |
| **Slowest N** | Re-runs the N slowest iterations | Performance investigation |
| **Custom selection** | User picks specific iteration numbers | Targeted investigation |
| **First failure** | Re-runs only the first iteration that failed | Quick triage |

### Trace Level for Sampling

The sampling re-run always uses a **higher** trace level than the original:

| Original Level | Sample Level | Rationale |
|---------------|-------------|-----------|
| Minimal | Standard | Get structured data |
| Standard | Full | Get HTTP bodies |
| Full | Debug | Get console logs |
| Debug | Debug | Already at max — re-run to reproduce |

User can also manually pick the sample level from a dropdown.

### Data Model for Sampling

```typescript
interface WorkflowExecutionTrace {
  // ... existing fields ...
  captureLevel: TraceCaptureLevel;

  // Sampling metadata
  sampledIterations?: SampledIteration[];
}

interface SampledIteration {
  index: number;                        // which iteration was re-run
  captureLevel: TraceCaptureLevel;      // level used for this sample
  sampledAt: number;                    // timestamp of the sample run
  trace: WorkflowIterationTrace;        // the enriched trace data
}

interface WorkflowIterationTrace {
  // ... existing fields ...
  sampled?: boolean;                    // already exists — true if this is a sampled re-run
  sampleCaptureLevel?: TraceCaptureLevel;
}
```

### How Sampling Works Internally

1. **Extract iteration context** — From the original run, extract the input state for the selected iteration (variables, CSV row, webhook payload — whatever drove that iteration)
2. **Re-execute** — Run `graphRunner` for just that single iteration, with the same input state but at the higher trace level
3. **Merge** — Replace (or augment) the iteration's trace in `WorkflowExecutionTrace.iterations[index]` with the enriched version, or store separately in `sampledIterations`
4. **UI update** — Results Explorer re-renders; sampled iterations show a 🔬 badge; Console becomes available for those iterations

### Sampling Challenges & Considerations

| Challenge | Approach |
|-----------|----------|
| **Reproducibility** — External state may have changed since original run | Show warning: "Results may differ from original run if external services have changed." Store sample timestamp. |
| **Input reconstruction** — Need to replay the same CSV row / variable state | `graphLoadRunner` already tracks per-iteration input (`iterationIndex` drives CSV row selection). Store initial variable snapshot in trace. |
| **Webhook-triggered iterations** — Can't replay an external webhook | For webhook workflows, sampling replays the captured `webhookInput` from the original trace as simulated input. |
| **Correlation wait** — Original run waited for an external event | Skip actual wait; use the captured response from the original trace if available, or warn user. |
| **Sub-workflows** — Nested execution needs re-running too | Sample the parent iteration; sub-workflow runs are included automatically. |
| **Concurrent iterations** — Original run had ramp-up timing | Sampling runs iterations sequentially (no ramp-up needed for debug). |

### UI Indicators

| Element | When Shown |
|---------|-----------|
| 🔬 badge on iteration picker | Iteration has been sampled at a higher level |
| "Debug trace available" tag | Console/detail shows enhanced data for this iteration |
| "Standard only" tag | Iteration was not sampled; limited data |
| "Sample & Debug" button | Always visible; dropdown with sampling modes |
| Progress bar | During sampling re-execution |
| Warning banner | "Sampled results may differ from original due to timing/state changes" |

---

## Implementation Phases

The plan is divided into two tracks:

- **Track A — Implement Now** (desktop/client-side): Phases that work with the current architecture and provide immediate value.
- **Track B — Server Deployment** (future): Phases that only make sense when the server infrastructure is in place.

```
                        ┌──────────────────────────────────────┐
  TRACK A               │          IMPLEMENT NOW               │
  (Desktop/Client)      │                                      │
                        │  Phase 1: Console + Trace Levels     │
  ~4–5 days             │  Phase 2: Debug-Level Capture        │
  ~2 days               │                                      │
                        └──────────────────────────────────────┘

                        ┌──────────────────────────────────────┐
  TRACK B               │        SERVER DEPLOYMENT TIME        │
  (Server Required)     │                                      │
                        │  Phase 3: Sampling Re-execution      │
  ~5–6 days             │  Phase 4: Storage & Retention        │
  ~5–7 days             │  Phase 5: Server-Side Controls       │
                        │                                      │
                        └──────────────────────────────────────┘
```

---

### TRACK A — IMPLEMENT NOW (Desktop / Client-Side)

These phases work with the current Tauri desktop + browser architecture. No server needed.

#### Phase 1 — Trace Levels + Console Panel (from Structured Data)

**Why now:** The Console panel gives immediate debugging value using data that's already captured in traces. Trace levels prepare the data model for everything that follows.

1. **Data model** — Add `TraceCaptureLevel` type, `captureLevel` to `WorkflowExecutionTrace`, `initialVariables` to `WorkflowIterationTrace` (Gap 2)
2. **Capture gating** — Modify `graphRunner.ts` to respect trace level when building `ExecutionEventDetails`
3. **Thread `traceOptions` to sub-workflows** — Fix `graphRunnerSubWorkflowHandler.ts` to pass `traceOptions` to child `runGraph` calls (Gap 4)
4. **Iteration index consistency** — Add `getIterationByIndex()` utility, fix `IterationPicker` to use `index` field not array position (Gap 3)
5. **Runner UI** — Add Trace Level dropdown to Workflow Runner, with warning for Debug + high iterations
6. **CLI support** — Add `--trace-level` flag to CLI (Gap 1)
7. **Console panel** — Create `ResultsExplorerConsolePanel.tsx`:
   - Reconstruct log lines from structured `ExecutionEventDetails`
   - Reuse line rendering from `WorkflowConsolePanel`
   - Node filter, search, dock/maximize, `⌘J` toggle
   - Graceful handling when trace level is Minimal (disabled state)
8. **Keyboard shortcut** — Wire `⌘J` in Results Explorer
9. **Backward compat** — Infer `captureLevel` from trace content for pre-existing traces (Gap 11)
10. **Unit tests** — Console panel rendering, trace level gating, line reconstruction, iteration index lookup
11. **E2E tests** — Console toggle, iteration switching, node filtering

**Estimated effort:** ~4–5 days

#### Phase 2 — Debug-Level Capture (Full Console Fidelity)

**Why now:** Completes the console experience — raw `onLog` lines and script output give the same fidelity as the Designer Console, but per-iteration and persistent.

1. **`logLines` field** — Add to `ExecutionEventDetails`, populate in `graphRunner.ts` at debug level
2. **`scriptOutput`** — Wire up the existing field for script node completion events
3. **Per-node log collection** — Modify `TraceCollector` to buffer `onLog` lines per active node
4. **Console panel upgrade** — Render raw `logLines` when available, fall back to reconstructed view
5. **Cap enforcement** — 200 log lines per node max; truncation marker
6. **Tests** — Capture fidelity tests, cap enforcement, script output

**Estimated effort:** ~2 days

**Track A total: ~6–7 days**

---

### TRACK B — SERVER DEPLOYMENT TIME (Future)

These phases depend on server infrastructure, multi-user storage, or production-scale concerns. They should be implemented when server deployment architecture is finalized.

**Why postpone:**
- Sampling re-execution needs reliable input reconstruction, which becomes more complex with server-side state (shared databases, webhook registrations, correlation stores)
- Storage controls and retention policies only matter with persistent server storage
- Auto-downgrade and quota enforcement need a server config API
- The `sampled` → `traceRetained` rename (Gap 5) is a breaking change best done in a major version tied to server release

#### Phase 3 — Sampling (Post-Run Debug Re-execution)

**Depends on:** Phases 1-2 complete + server architecture decisions

1. **Data model** — Add `sampledIterations` to `WorkflowExecutionTrace`, `SampledIteration` type. Rename existing `sampled` field to `traceRetained` to avoid confusion (Gap 5)
2. **Input reconstruction** — Extract per-iteration input state from `initialVariables` (added in Phase 1) and `webhookInput` from event details. For correlation wait nodes, inject cached payload as mock input (Gap 10)
3. **Re-execution engine** — Create `sampleIteration()` that runs `graphRunner` for a single iteration with reconstructed input at the target trace level. Add `skipDelays` option to fast-forward Delay nodes (Gap 9)
4. **Merge logic** — New `mergeIterationSample()` function that finds iteration by `index` (not array position), augments with sampled data, handles decompress → merge → recompress for IndexedDB/server storage (Gap 11)
5. **Sampling modes** — Failed iterations, selected, random N, slowest N, custom
6. **UI — Sample button** — "Sample & Debug" dropdown in Results Explorer header with mode picker
7. **UI — Progress** — Modal progress bar during sampling re-execution
8. **UI — Indicators** — 🔬 badge on sampled iterations, "Debug trace available" tags, "Standard only" tags
9. **Console integration** — Console panel auto-uses sampled trace when available for an iteration
10. **Warning banner** — "Sampled results may differ from original run if external services have changed"
11. **Storage cap** — Apply `MAX_LOG_LINES_PER_NODE` and recursive sub-workflow trace trimming during sampling save (Gap 8)
12. **Unit tests** — Input reconstruction, merge logic, sampling mode selection, delay skip, correlation mock injection
13. **E2E tests** — Sample flow end-to-end, badge display, console with sampled data

**Estimated effort:** ~5–6 days

#### Phase 4 — Storage & Retention Controls

**Depends on:** Server storage architecture (PostgreSQL / S3 / etc.)

1. **Trace storage service** — Persist traces to server database with metadata (captureLevel, size, timestamps)
2. **Retention policies** — Configurable per trace level (Debug: 7 days, Standard: 30 days, etc.)
3. **Storage quota per run** — Truncation logic for oversized traces (bodies, logLines, sub-workflow recursion)
4. **Lazy loading API** — Initial load returns Standard-level data; full bodies and logLines fetched on-demand
5. **Recursive sub-workflow trimming** — Apply compression/sampling to nested traces (Gap 8)
6. **Export envelope** — Wrap exported JSON with trace metadata (captureLevel, run config, sampling provenance)

**Estimated effort:** ~3–4 days

#### Phase 5 — Server-Side Controls & Automation

**Depends on:** Phases 3-4 complete + server admin UI framework

1. **Server config API** — Max trace level, retention, quotas, sampling limits
2. **Client enforcement** — Read server config, cap runner selection (`min(server_max, user_selection)`)
3. **Auto-downgrade rules** — `>100 iters → Standard`, `>1000 → Minimal` (configurable thresholds)
4. **Server-side auto-sampling** — During high-iteration runs, automatically capture failures at Debug level even when running at Standard (auto-sample first N failures + every Nth iteration)
5. **Cron/scheduled run support** — Server cron and webhook triggers respect workflow-level default trace level
6. **Admin UI** — Server settings page for trace controls, storage dashboard, retention management
7. **Live console streaming** — Optional WebSocket stream of `onLog` lines from server to client during execution (future enhancement)

**Estimated effort:** ~5–7 days (depends on server architecture)

**Track B total: ~13–17 days** (spread across server deployment milestones)

---

## Key Files to Modify

### Track A Files (Implement Now)

| File | Phase | Changes |
|------|-------|---------|
| **Types & Model** | | |
| `src/shared/types/index.ts` | 1, 2 | Add `TraceCaptureLevel`, `captureLevel`, `initialVariables`, `logLines` |
| **Execution Engine** | | |
| `src/features/workflow/engine/graphRunner.ts` | 1, 2 | Gate capture by level, collect `logLines` at debug |
| `src/features/workflow/engine/graphLoadRunner.ts` | 1 | Pass trace level to `runGraph`, capture `initialVariables` per iteration |
| `src/features/workflow/engine/traceCollector.ts` | 2 | Buffer per-node log lines |
| `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts` | 1 | Thread `traceOptions` to child `runGraph` calls (Gap 4) |
| **Storage** | | |
| `src/shared/utils/storage.ts` | 1 | Update `capAndTruncateResults` for new fields |
| **Runner UI** | | |
| `src/features/test-runner/WorkflowRunner.tsx` | 1 | Trace Level dropdown UI |
| `cli/index.ts` | 1 | `--trace-level` CLI flag |
| **Results Explorer** | | |
| `src/features/results/components/WorkflowResultsExplorerModal.tsx` | 1 | Console toggle, `⌘J`, iteration index fix |
| `src/features/results/components/ResultsExplorerConsolePanel.tsx` | 1 | **New** — Console panel component |
| `src/features/results/components/IterationPicker.tsx` | 1 | Fix to use `index` field, not array position (Gap 3) |
| `src/features/results/utils/iterationLookup.ts` | 1 | **New** — `getIterationByIndex()` utility |
| **Shared UI** | | |
| `src/features/workflow/components/panels/WorkflowConsolePanel.tsx` | 1 | Extract shared line renderer for reuse |
| `src/styles/results-explorer.css` | 1 | Console panel styles |

### Track B Files (Server Deployment Time)

| File | Phase | Changes |
|------|-------|---------|
| **Types & Model** | | |
| `src/shared/types/index.ts` | 3 | Add `SampledIteration`, `sampledIterations`; rename `sampled` → `traceRetained` |
| **Execution Engine** | | |
| `src/features/workflow/engine/graphRunner.ts` | 3 | Add `skipDelays` option |
| `src/features/workflow/engine/graphLoadRunner.ts` | 3 | Expose single-iteration re-execution for sampling |
| `src/features/workflow/engine/graphRunnerControlFlowHandlers.ts` | 3 | Respect `skipDelays` flag on Delay nodes |
| `src/features/workflow/engine/graphRunnerCorrelationWaitHandler.ts` | 3 | Support mock payload injection during sampling |
| **Storage** | | |
| `src/shared/utils/storage.ts` | 3, 4 | Recursive sub-workflow trimming, storage quotas |
| `src/shared/utils/traceCompression.ts` | 3 | Rename `sampled` → `traceRetained`, handle `sampledIterations` |
| **Results Explorer** | | |
| `src/features/results/components/WorkflowResultsExplorerModal.tsx` | 3 | Sample button, 🔬 badges, sampling progress |
| `src/features/results/components/SamplingButton.tsx` | 3 | **New** — Sample & Debug dropdown with mode picker |
| `src/features/results/utils/iterationSampler.ts` | 3 | **New** — Input reconstruction, mode selection, merge logic |
| `src/styles/results-explorer.css` | 3 | Sampling indicators |
| **Server** | | |
| `src-server/traceStorage.ts` | 4 | **New** — Trace persistence service |
| `src-server/retentionWorker.ts` | 4 | **New** — Background pruning jobs |
| `src-server/config.ts` | 5 | Server config for trace level ceiling, quotas, thresholds |
| `src-server/cron-scheduler.ts` | 5 | Read workflow default trace level |
| `src-server/webhook-server.ts` | 5 | Respect server config ceiling |

---

## Known Gaps & Risk Mitigations

Deep analysis of the codebase revealed several issues that must be addressed for this plan to work correctly.

### Gap 1: Multiple Execution Entry Points Need Trace Level Support

**Problem:** Workflows can be executed from 6+ entry points, but only Workflow Runner passes `ExecutionTraceOptions` today.

| Entry Point | Has `traceOptions`? | Action Needed |
|-------------|---------------------|---------------|
| Workflow Runner (`WorkflowRunner.tsx`) | ✓ Via `TestConfig` | Add trace level dropdown (Phase 1) |
| Designer Quick Test (`useWorkflowExecution.ts`) | ✗ | Always run at Debug level (no reason to limit single-iteration debug) |
| CLI (`cli/index.ts`) | ✗ | Add `--trace-level` flag (Phase 1) |
| Server cron (`src-server/cron-scheduler.ts`) | ✗ | Read from workflow default or server config (Phase 4) |
| Server webhook (`src-server/webhook-server.ts`) | Partial | Respect server config ceiling (Phase 4) |
| Web Worker (`executionWorker.ts`) | Inherits from `TestConfig` | Pass through — already works |

**Mitigation:** Phase 1 covers Runner + CLI. Quick Test always at Debug. Server paths deferred to Phase 4.

### Gap 2: No Per-Iteration Initial State Captured

**Problem:** For sampling (re-running specific iterations), we need the input state that drove each iteration. Currently:
- `graphLoadRunner` passes **identical** `{ ...workflow.variables, ...initialVariables }` to every iteration
- `WorkflowIterationTrace` has `finalVariables` but **no `initialVariables`**
- Webhook payloads are sometimes captured in `details.webhookInput` but not always (auto-resume mode skips it)
- No CSV data row index is stored per iteration

**Mitigation:** Add `initialVariables: Record<string, string>` to `WorkflowIterationTrace`. For current architecture (static variables), all iterations share the same initial state so sampling re-runs can use the same input. When CSV parameterization is added later, extend with `dataRowIndex`.

### Gap 3: Iteration Array Ordering vs Index Field

**Problem:** With concurrency > 1, `graphLoadRunner` appends iteration traces in **completion order**, not logical order. `iterations[2]` might have `index: 5`. The `IterationPicker` uses array position, not the `index` field.

**Impact on sampling:** "Re-run iteration #12" must mean the iteration with `index: 12`, not `iterations[12]`.

**Mitigation:** Always look up iterations by `.index` field, not array position. Add a utility: `getIterationByIndex(trace, index)`. Fix `IterationPicker` to use `index` consistently.

### Gap 4: Sub-Workflow Traces Don't Inherit Trace Options

**Problem:** `graphRunnerSubWorkflowHandler.ts` calls `runGraph` for child workflows but **does not pass `traceOptions`**. So even if the parent runs at Full/Debug level, child workflows may capture less data.

**Mitigation:** Thread `traceOptions` through to child `runGraph` calls. The `fullTraceCaptured` flag is already copied to child traces, but the full options object should be passed for consistency.

### Gap 5: `sampled` Flag Semantics Are Inverted

**Problem:** In `traceCompression.ts`, `sampled: true` means the iteration was **kept** (has full data), while `sampled: false` means it was **stripped** (stub only). This is confusing because "sampled" in the new plan means "re-run at higher level."

**Mitigation:** Rename the existing field to `retained` or `traceRetained` to avoid collision with the new sampling concept. Update `sampleIterations()`, `traceCompression.ts`, and `WorkflowResultsExplorerModal.tsx` accordingly.

### Gap 6: Export/Import Doesn't Preserve Trace Metadata

**Problem:** Exported trace JSON is raw `WorkflowExecutionTrace` with no envelope for:
- What trace level was used
- Which iterations were sampled and at what level
- Original run configuration

If someone exports a Debug trace and imports it later, the Results Explorer won't know it has full console data.

**Mitigation:** Add `captureLevel` to `WorkflowExecutionTrace` (Phase 1). Add `sampleCaptureLevel` to `SampledIteration`. These fields survive JSON round-trip automatically. For Phase 4, consider a trace envelope format with run metadata.

### Gap 7: Worker Execution Can't Stream Logs

**Problem:** Web Workers communicate via `postMessage`. The `onLog` callback isn't forwarded from worker to main thread — only progress and final results. For Debug-level traces, log lines would be captured inside the worker and returned with the trace on completion, not streamed live.

**Impact:** Console in Results Explorer is post-hoc (reads from stored trace), so this is fine. But the Designer Console won't show live logs for worker-executed runs.

**Mitigation:** For Phase 1-3 (Results Explorer Console), no issue — Console reads from stored trace data. Live streaming from workers is a separate enhancement if needed later.

### Gap 8: IndexedDB Storage Pressure from Debug Traces

**Problem:** `capAndTruncateResults` in `storage.ts` applies `sampleIterations` and `compressTrace` before storing, but:
- Sub-workflow traces inside `ExecutionEventDetails` are **not** trimmed
- Debug-level traces with `logLines` per node per iteration could be very large
- No byte-level cap exists; only `RESPONSE_BODY_MAX_CHARS` for HTTP bodies

**Mitigation:**
- Phase 1: Apply `RESPONSE_BODY_MAX_CHARS` truncation to `logLines` text content too
- Phase 2: Add `MAX_LOG_LINES_PER_NODE` cap (200) during capture
- Phase 3: Apply sampling/compression to sub-workflow traces recursively
- Phase 4: Server-side storage with retention policies handles this at scale

### Gap 9: Delay Nodes Execute Real Wait During Sampling Re-runs

**Problem:** If a workflow has a 30-second Delay node, sampling re-runs will wait 30 seconds per iteration. This is unnecessary for debugging.

**Mitigation:** Add a `skipDelays?: boolean` option to `runGraph`. When sampling, pass `skipDelays: true` to fast-forward through delay nodes (log the original delay duration but don't wait). Quick Test debug mode could also use this.

### Gap 10: Correlation Wait / Webhook Nodes During Sampling

**Problem:** Correlation wait nodes pause execution waiting for an external webhook. During sampling re-runs, the external system may not re-send the webhook.

**Mitigation:** When sampling, use **auto-resume mode** with the captured `webhookInput` payload from the original trace injected as mock input. If the original trace has no `webhookInput` (auto-resume mode), use `extractedVariables` to reconstruct the state. Show a warning: "Webhook/correlation nodes used cached data from original run."

### Gap 11: Rerun Infrastructure Is Parameterized-Only

**Problem:** `mergeRerunResults` and `useRerunFailed` work with parameterized scenario results keyed by `scenarioId + dataRowId`. There's no equivalent for workflow iteration re-runs.

**Mitigation:** Build a new `mergeIterationSample()` function (Phase 3) that:
- Finds the iteration by `index` in the existing trace
- Replaces or augments its events with the sampled trace
- Preserves the original iteration data alongside the sample
- Handles `compressedTrace` decompress → merge → recompress cycle

---

## Open Questions

### Design Decisions

1. **Workflow-level default** — Should the trace level default be saved per-workflow, or is a global default sufficient for now?
2. **Quick Test** — Should the Designer Quick Test always run at Debug (recommended), or respect trace levels?
3. **Export format** — When exporting traces as JSON, should we add an envelope with run metadata (trace level, config, timestamp), or keep it as raw `WorkflowExecutionTrace`?
4. **Trace upgrade** — If a user re-runs at a higher level, should the new trace replace the old one or be stored alongside?

### Sampling Decisions

5. **Sampling storage** — Should sampled iterations replace the original iteration trace, or be stored in a separate `sampledIterations` array (keeping both the original Standard-level and the Debug-level data)?
6. **Sampling scope** — Should sampling be available only in the desktop app, or also via CLI / server API for automated re-investigation?
7. **Sampling limits** — Max number of iterations that can be sampled in one batch? (e.g., cap at 20 to prevent accidental re-run of 500 iterations at Debug)
8. **Delay behavior** — When sampling, should Delay nodes execute real waits, or fast-forward? (Recommendation: fast-forward with logged original duration)
9. **Divergence handling** — When a sampled re-run produces different results than the original (external state changed), should we show both side-by-side, or just the new result with a warning?

### Naming & Compatibility

10. **`sampled` field rename** — The existing `sampled` boolean on `WorkflowIterationTrace` means "retained during compression." Our new sampling concept conflicts. Rename to `traceRetained`? This is a breaking change for existing stored/exported traces.
11. **Backward compatibility** — Traces exported before trace level support won't have `captureLevel`. Should we infer from content (has full bodies → Full, has logLines → Debug)?

### Future / Server

12. **Live console streaming** — Should the Workflow Runner show a live console during execution (like the Designer), or is post-run Console in Results Explorer sufficient?
13. **Server-side sampling** — Should the server auto-sample failures during execution (capture first N failures at Debug even when running at Standard), or is post-run sampling sufficient?
