# Results Explorer — Sampling & Server Deployment (Part 2 — FUTURE)

> **Status:** 🔮 Future — Requires server infrastructure  
> **Part 1 (Track A — Completed):** See `docs/plan/finished/results-explorer-console-plan-part1.md`

---

## Overview

This document covers the **server-deployment-dependent** phases of the Results Explorer Console plan:

1. **Sampling (Post-Run Debug Re-execution)** — Select specific iterations and re-run them at a higher trace level without re-running the entire workflow.
2. **Storage & Retention Controls** — Server-side trace persistence with retention policies and lazy loading.
3. **Server-Side Controls & Automation** — Admin-level trace level ceilings, auto-downgrade rules, and scheduled run support.

---

## Prerequisites

All Track A work is complete:
- ✅ Trace capture levels (Minimal / Standard / Full / Debug)
- ✅ Console panel in Results Explorer with reconstructed log narrative
- ✅ Debug-level capture (per-node `logLines`, `scriptOutput`)
- ✅ Runner UI with trace level radio buttons
- ✅ CLI `--trace-level` flag
- ✅ Iteration index consistency
- ✅ Sub-workflow trace options threading

---

## Production Storage Controls (Future)

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
  sampledIterations?: SampledIteration[];
}

interface SampledIteration {
  index: number;
  captureLevel: TraceCaptureLevel;
  sampledAt: number;
  trace: WorkflowIterationTrace;
}

interface WorkflowIterationTrace {
  // ... existing fields ...
  sampled?: boolean;
  sampleCaptureLevel?: TraceCaptureLevel;
}
```

### How Sampling Works Internally

1. **Extract iteration context** — From the original run, extract the input state for the selected iteration (variables, CSV row, webhook payload)
2. **Re-execute** — Run `graphRunner` for just that single iteration, with the same input state but at the higher trace level
3. **Merge** — Replace or augment the iteration's trace in `WorkflowExecutionTrace.iterations[index]` with the enriched version, or store separately in `sampledIterations`
4. **UI update** — Results Explorer re-renders; sampled iterations show a 🔬 badge; Console becomes available for those iterations

### Sampling Challenges & Considerations

| Challenge | Approach |
|-----------|----------|
| **Reproducibility** | Show warning: "Results may differ from original run if external services have changed." Store sample timestamp. |
| **Input reconstruction** | `graphLoadRunner` already tracks per-iteration input. `initialVariables` added in Phase 1 enables this. |
| **Webhook-triggered iterations** | Replay captured `webhookInput` from original trace as simulated input. |
| **Correlation wait** | Skip actual wait; use captured response or warn user. |
| **Sub-workflows** | Sample parent iteration; sub-workflow runs included automatically. |
| **Concurrent iterations** | Sampling runs sequentially (no ramp-up needed for debug). |

### UI Indicators

| Element | When Shown |
|---------|-----------|
| 🔬 badge on iteration picker | Iteration has been sampled at a higher level |
| "Debug trace available" tag | Console/detail shows enhanced data |
| "Standard only" tag | Iteration was not sampled; limited data |
| "Sample & Debug" button | Always visible; dropdown with sampling modes |
| Progress bar | During sampling re-execution |
| Warning banner | "Sampled results may differ from original" |

---

## Implementation Phases

### Phase 3 — Sampling (Post-Run Debug Re-execution)

**Depends on:** Track A complete ✅ + server architecture decisions

| # | Task | Status |
|---|------|--------|
| 3.1 | Data model — `sampledIterations`, `SampledIteration` type | 🔮 |
| 3.2 | Rename `sampled` → `traceRetained` (breaking change) | 🔮 |
| 3.3 | Input reconstruction from `initialVariables` + `webhookInput` | 🔮 |
| 3.4 | `sampleIteration()` — single-iteration re-execution engine | 🔮 |
| 3.5 | `skipDelays` option for fast-forwarding Delay nodes | 🔮 |
| 3.6 | `mergeIterationSample()` — find by index, augment, recompress | 🔮 |
| 3.7 | Sampling modes (failed, selected, random, slowest, custom, first-failure) | 🔮 |
| 3.8 | UI — "Sample & Debug" dropdown button | 🔮 |
| 3.9 | UI — Progress modal during sampling | 🔮 |
| 3.10 | UI — 🔬 badges, "Debug trace available" tags | 🔮 |
| 3.11 | Console integration with sampled traces | 🔮 |
| 3.12 | Warning banner for divergence | 🔮 |
| 3.13 | Storage cap during sampling save | 🔮 |
| 3.14 | Correlation wait mock payload injection | 🔮 |
| 3.15 | Unit tests | 🔮 |
| 3.16 | E2E tests | 🔮 |

**Estimated effort:** ~5–6 days

### Phase 4 — Storage & Retention Controls

**Depends on:** Server storage architecture (PostgreSQL / S3 / etc.)

| # | Task | Status |
|---|------|--------|
| 4.1 | Trace storage service — persist to server database | 🔮 |
| 4.2 | Retention policies per trace level | 🔮 |
| 4.3 | Storage quota per run with truncation | 🔮 |
| 4.4 | Lazy loading API (Standard first, bodies on demand) | 🔮 |
| 4.5 | Recursive sub-workflow trimming | 🔮 |
| 4.6 | Export envelope with trace metadata | 🔮 |

**Estimated effort:** ~3–4 days

### Phase 5 — Server-Side Controls & Automation

**Depends on:** Phases 3–4 complete + server admin UI framework

| # | Task | Status |
|---|------|--------|
| 5.1 | Server config API — max trace level, retention, quotas | 🔮 |
| 5.2 | Client enforcement — cap runner selection by server max | 🔮 |
| 5.3 | Auto-downgrade rules (>100 iters → Standard, >1000 → Minimal) | 🔮 |
| 5.4 | Server-side auto-sampling (auto-capture failures at Debug) | 🔮 |
| 5.5 | Cron/scheduled run support with workflow default trace level | 🔮 |
| 5.6 | Admin UI — server settings page for trace controls | 🔮 |
| 5.7 | Live console streaming via WebSocket (optional) | 🔮 |

**Estimated effort:** ~5–7 days

**Track B total: ~13–17 days** (spread across server deployment milestones)

---

## Key Files to Create/Modify (Track B)

| File | Phase | Changes |
|------|-------|---------|
| `src/shared/types/index.ts` | 3 | Add `SampledIteration`, `sampledIterations`; rename `sampled` → `traceRetained` |
| `src/features/workflow/engine/graphRunner.ts` | 3 | Add `skipDelays` option |
| `src/features/workflow/engine/graphLoadRunner.ts` | 3 | Expose single-iteration re-execution |
| `src/features/workflow/engine/graphRunnerControlFlowHandlers.ts` | 3 | Respect `skipDelays` flag |
| `src/features/workflow/engine/graphRunnerCorrelationWaitHandler.ts` | 3 | Mock payload injection |
| `src/shared/utils/storage.ts` | 3, 4 | Recursive sub-workflow trimming, storage quotas |
| `src/shared/utils/traceCompression.ts` | 3 | Rename `sampled` → `traceRetained`, handle `sampledIterations` |
| `src/features/results/components/WorkflowResultsExplorerModal.tsx` | 3 | Sample button, 🔬 badges, sampling progress |
| `src/features/results/components/SamplingButton.tsx` | 3 | **New** — Sample & Debug dropdown |
| `src/features/results/utils/iterationSampler.ts` | 3 | **New** — Input reconstruction, mode selection, merge logic |
| `src-server/traceStorage.ts` | 4 | **New** — Trace persistence service |
| `src-server/retentionWorker.ts` | 4 | **New** — Background pruning jobs |
| `src-server/config.ts` | 5 | Server config for trace level ceiling |
| `src-server/cron-scheduler.ts` | 5 | Read workflow default trace level |
| `src-server/webhook-server.ts` | 5 | Respect server config ceiling |

---

## Remaining Gaps to Address

| Gap | Description | Phase |
|-----|-------------|-------|
| Gap 5 | `sampled` → `traceRetained` rename (breaking change for stored/exported traces) | Phase 3 |
| Gap 9 | Delay nodes execute real wait during sampling re-runs | Phase 3 |
| Gap 10 | Correlation wait / webhook nodes during sampling | Phase 3 |
| Gap 11 | Rerun infrastructure is parameterized-only; need workflow iteration equivalent | Phase 3 |

---

## Open Questions

### Sampling Decisions

1. **Sampling storage** — Should sampled iterations replace the original trace or be stored alongside in `sampledIterations`?
2. **Sampling scope** — Desktop-only, or also CLI / server API?
3. **Sampling limits** — Max iterations per batch? (recommended: cap at 20)
4. **Delay behavior** — Fast-forward recommended, with logged original duration.
5. **Divergence handling** — Side-by-side comparison, or new result with warning?

### Server Architecture

6. **Workflow-level default** — Per-workflow or global default for trace level?
7. **Export format** — Add envelope with run metadata or keep raw `WorkflowExecutionTrace`?
8. **Live console streaming** — Real-time WebSocket stream during execution, or post-run only?
9. **Server-side auto-sampling** — Auto-capture first N failures at Debug during Standard runs?
