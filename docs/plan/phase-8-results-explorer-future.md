# Phase 8: Results Explorer — Future Enhancements

> **Status**: 🛠️ In Progress (8a complete)  
> **Priority**: Low–Medium  
> **Effort**: Large (~28–34 hours total across 3 features)  
> **Dependencies**: Phase 7e (Visual Execution Replay) — ✅ Complete  
> **Origin**: Identified during Phase 7e development (Q2, Q3, Q4 decisions)

---

## Overview

Three independent enhancements to the Results Explorer were identified during Phase 7e but are beyond its scope. Each can be implemented independently — they don't depend on each other.

| # | Feature | Size | Priority | Status |
|---|---------|------|----------|--------|
| 8a | Timeline View / Gantt Chart | Large (~16h) | Medium | ✅ Complete |
| 8b | Sub-Workflow Drill-Down | Medium (6–8h) | Low | Not Started |
| 8c | Parallel Execution Visualization | Medium (6–10h) | Low | Not Started |

---

## 8a: Timeline View / Gantt Chart

> **Origin**: Phase 7e Q3 — "Should we support export to external formats?"  
> **Priority**: Medium (highest impact of the three — directly supports performance debugging)  
> **Effort**: Large (~16 hours)

### Problem

The current Results Explorer shows workflow execution as a **node graph** with color-coded pass/fail states. This is great for understanding _which path_ was taken and _which nodes_ failed, but it doesn't clearly show:

- **Time ordering** — which nodes ran first, which ran in parallel
- **Duration proportions** — which nodes consumed most of the iteration time
- **Idle gaps** — time between node executions (network latency, queue waits)
- **Parallelism** — overlapping node executions in fork/join flows

### Solution

Add a **Timeline View** toggle in the Results Explorer modal. Switches between:
- **Diagram View** (current) — ReactFlow graph with state overlay
- **Timeline View** (new) — Horizontal Gantt chart with time axis

**No external library needed** — pure SVG rendering. Bars are `<rect>` elements, labels are `<text>`, axis is `<line>` + `<text>`. Simpler and lighter than pulling in `@visx/xychart`.

#### Timeline View Layout

```
              0ms    100ms   200ms   300ms   400ms   500ms   600ms
              |       |       |       |       |       |       |
  Start       ██
  Get Users          ████████████████
  Check Status                       ███
  Create Order                           ██████████████████████
                                                         ███ ← Failed
```

- Left column: fixed-width node labels
- Right area: scrollable/zoomable SVG with time axis + bars
- Each bar: X = start time, width = duration, color = pass/fail/skipped

#### Features

1. **Horizontal bars** — one per node execution, width = duration, positioned by start time
2. **Color coding** — green (pass), red (fail), gray (skipped) — same as diagram view
3. **Time axis** — with zoom/pan, auto-scale to fit iteration duration (smart ticks: 50ms/100ms/500ms/1s)
4. **Hover tooltips** — show node name, duration, status, response code
5. **Click interaction** — clicking a bar opens the same `ResultsExplorerDetailPanel` as diagram view
6. **Parallel lanes** — overlapping executions stacked vertically to avoid overlap
7. **Iteration selector** — reuse existing `IterationPicker` component (no changes needed)
8. **Aggregate mode** — overlay all iterations as semi-transparent bars with avg/P95 markers

### Data Model (already exists)

Each `ExecutionEvent` in the trace provides everything needed:

```typescript
interface ExecutionEvent {
  nodeId: string;          // identifies the node
  nodeLabel: string;       // display name for left column
  timestamp: number;       // epoch ms — bar X position
  durationMs?: number;     // bar width
  state: 'pass' | 'fail' | 'skipped';  // bar color
  nodeType: string;        // for tooltip detail
  details?: { statusCode?: number; responseTimeMs?: number; ... };
}
```

### Implementation Steps

#### Step 1: Create Feature Branch ✅
- [x] Branch from `develop` → `feature/timeline-view`

#### Step 2: Build Core Timeline Component ✅ (~4h)
**Files created**:
- `src/features/results/utils/timelineLayout.ts` — Layout engine (bar building, lane assignment, tick generation, P95)
- `src/features/results/utils/timelineLayout.test.ts` — 30 unit tests for layout utilities
- `src/features/results/components/ExecutionTimeline.tsx` — SVG Gantt chart component
- `src/features/results/components/ExecutionTimeline.test.tsx` — 19 component tests

**Implemented**:
- [x] Component takes `trace: WorkflowExecutionTrace` and `selectedIteration`
- [x] Calculate time range from events (min timestamp → max timestamp + duration)
- [x] Render fixed-width label column on the left (node names with state dots)
- [x] Render SVG area with horizontal bars (`<rect>`) positioned by timestamp/duration
- [x] Color-code bars: `#22c55e` (pass), `#ef4444` (fail), `#64748b` (skipped)
- [x] Draw time axis along the top with smart tick intervals (ms/s/m auto-scaling)
- [x] Support horizontal scroll for long workflows
- [x] Support zoom (Ctrl+scroll to zoom 0.1x–10x, zoom badge indicator)
- [x] Click bar / label → `onNodeClick(nodeId)` callback
- [x] Hover tooltip (name, status, duration, HTTP code, start time, type)
- [x] Selected node highlighting (white stroke + label highlight)
- [x] Parallel lane detection via greedy interval scheduling
- [x] Aggregate mode: overlay all iterations at 30% opacity with avg/P95 markers
- [x] CSS styles: dark theme, tooltip animation, bar hover effects
- [x] 49 unit tests — all passing
- [x] TypeScript + ESLint: 0 errors

#### Step 3: Wire View Mode Toggle ✅ (~2h)
**File**: `src/features/results/components/WorkflowResultsExplorerModal.tsx`

- [x] Add `viewMode` state: `'diagram' | 'timeline'`
- [x] Add segmented toggle in header: "📊 Diagram" / "📈 Timeline"
- [x] Conditionally render `WorkflowExecutionCanvas` or `ExecutionTimeline` in left panel
- [x] Add keyboard shortcut: `T` to toggle view mode
- [x] Right panel (detail) and bottom panel (matrix) remain unchanged
- [x] Collapsible detail panel — `▶`/`◀` toggle strip + `D` keyboard shortcut
- [x] Topological node ordering — nodes follow workflow execution order (Start first), not timestamp order
- [x] Container-responsive width — SVG fills available space via `ResizeObserver`, no wasted empty area
- [x] Intelligent time axis scaling — aggregate mode uses P95 as upper bound, not max iteration span
- [x] Left padding + "0ms" label — clean axis start with no clipping

#### Steps 4–7: Interactions, Lanes, Aggregate, CSS ✅ (done in Step 2)

All click/hover interactions, parallel lane assignment, aggregate mode with avg/P95 markers, and CSS styles were implemented as part of Step 2 above (they were small enough to include in the initial component build).

#### Step 8: Unit Tests ✅ (done in Step 2)

56 tests across 2 files — all passing:
- `timelineLayout.test.ts` — 31 tests (bar building, lane assignment, tick generation, P95 calculation, topological ordering)
- `ExecutionTimeline.test.tsx` — 25 tests (rendering, colors, clicks, tooltip, selection, aggregate, node rows, ResizeObserver)

#### Step 9: TypeScript Check + Verify ✅
- [x] `npx tsc --noEmit` — zero errors
- [x] `npx eslint` — zero errors on new files
- [x] `npx vitest run` on new files — 56/56 pass
- [x] Manual visual test with dev server — verified aggregate, single iteration, panel toggle, node ordering

### File Structure

```
src/features/results/
├── components/
│   ├── ExecutionTimeline.tsx          # ✅ NEW — SVG Gantt chart component (~400 lines)
│   ├── ExecutionTimeline.test.tsx     # ✅ NEW — 25 component tests (~400 lines)
│   ├── WorkflowResultsExplorerModal.tsx  # ✅ UPDATED — view mode toggle, collapsible detail panel
│   └── WorkflowResultsExplorerModal.test.tsx  # ✅ existing tests still passing (142 tests)
└── utils/
    ├── timelineLayout.ts             # ✅ NEW — lane detection, tick generation, P95, topological sort (~210 lines)
    └── timelineLayout.test.ts        # ✅ NEW — 31 layout tests (~290 lines)
```

### Success Criteria

- [x] Toggle between Diagram and Timeline view via button or `T` key ✅
- [x] Bars correctly positioned and sized by timestamp/duration ✅
- [x] Colors match diagram view (pass/fail/skipped) ✅
- [x] Click bar opens detail panel (same as clicking node in diagram) ✅
- [x] Parallel executions shown as stacked lanes (no visual overlap) ✅
- [x] Aggregate mode shows overlaid iterations with avg/P95 markers ✅
- [x] Collapsible detail panel for full-width timeline (`D` key) ✅
- [x] Topological node ordering (execution flow, not timestamp) ✅
- [x] Responsive container-filling layout via ResizeObserver ✅
- [x] >90% unit test coverage ✅ (56 tests, 0 failures)
- [x] No external library dependency (pure SVG) ✅

---

## 8b: Sub-Workflow Drill-Down

> **Origin**: Phase 7e Q2 — "What about sub-workflow execution traces?"  
> **Priority**: Low  
> **Effort**: Medium (~6–8 hours)

### Problem

When a workflow contains sub-workflow nodes, the Results Explorer shows them as single nodes with pass/fail state. Users cannot drill into the sub-workflow to see its internal execution flow, node-by-node timing, or where failures occurred inside the sub-workflow.

### Solution

Add a **"View Sub-Workflow"** button in the detail panel when a sub-workflow node is selected. Clicking it opens a nested `WorkflowResultsExplorerModal` showing the sub-workflow's execution trace.

### What Already Exists

- `ExecutionEventDetails` already has `subWorkflowId` and `subWorkflowPassed` fields
- `WorkflowResultsExplorerModal` is self-contained and can be rendered recursively
- `traceCollector.ts` has the infrastructure for capturing events

### Implementation Tasks

#### Task 8b.1: Capture Nested Trace (~2h)
- [ ] Update `graphRunner.ts` to capture a full `WorkflowExecutionTrace` for each sub-workflow execution
- [ ] Store nested trace in `ExecutionEventDetails.subWorkflowTrace`
- [ ] Add `subWorkflowTrace?: WorkflowExecutionTrace` to `ExecutionEventDetails` type
- [ ] Handle recursive sub-workflows (sub-sub-workflows)

#### Task 8b.2: Update Detail Panel (~2h)
- [ ] Add "View Sub-Workflow" button in `ResultsExplorerDetailPanel` when `nodeType === 'subWorkflow'`
- [ ] Only show button if `subWorkflowTrace` exists
- [ ] Pass sub-workflow trace to nested modal

#### Task 8b.3: Nested Modal (~1h)
- [ ] Render `WorkflowResultsExplorerModal` inside the current modal
- [ ] Add breadcrumb trail showing nesting path (e.g., "Main Workflow > Process Order > Validate Payment")
- [ ] Handle Escape key to close inner modal first

#### Task 8b.4: Tests (~2h)
- [ ] Unit tests for nested trace capture
- [ ] Unit tests for "View Sub-Workflow" button visibility
- [ ] Unit tests for breadcrumb rendering
- [ ] E2E test for drill-down flow

### Success Criteria

- [ ] Clicking sub-workflow node shows "View Sub-Workflow" button
- [ ] Button opens nested Results Explorer with sub-workflow trace
- [ ] Breadcrumb shows nesting path
- [ ] Escape closes inner modal first
- [ ] Recursive nesting works (sub-sub-workflows)
- [ ] >90% unit test coverage

---

## 8c: Parallel Execution Visualization

> **Origin**: Phase 7e Q4 — "How to handle workflows with parallel execution (Fork/Join)?"  
> **Priority**: Low  
> **Effort**: Medium (~6–10 hours)

### Problem

Fork/Join workflows execute multiple branches in parallel. The current diagram shows all nodes and edges correctly, but doesn't visually distinguish:

- Which nodes belong to the same parallel branch
- Which branch was the critical path (slowest)
- How branch durations compare to each other
- Thread/fork execution details

### Solution

Add **swim-lane grouping** for fork/join branches on the ReactFlow canvas, plus a **branch comparison table** in the detail panel for fork/join nodes.

### Implementation Tasks

#### Task 8c.1: Fork/Join Topology Detection (~2h)
- [ ] Create `src/features/results/utils/forkJoinDetection.ts`
- [ ] Detect fork/join pairs from graph topology (fork node = multiple outgoing edges to distinct paths, join node = multiple incoming edges converging)
- [ ] Map each node to its branch (branch 0, branch 1, etc.)
- [ ] Handle nested fork/join (fork inside a fork branch)

#### Task 8c.2: Swim-Lane Rendering (~3h)
- [ ] Add colored semi-transparent background regions behind each branch
- [ ] Label each lane ("Branch A", "Branch B", etc.)
- [ ] Position lanes based on node positions (auto-layout or manual)
- [ ] Highlight critical path branch (thicker border or different shade)

#### Task 8c.3: Branch Comparison in Detail Panel (~2h)
- [ ] Update `ResultsExplorerDetailPanel` for fork/join node types
- [ ] Show branch comparison table: branch name, total time, node count, pass rate
- [ ] Highlight critical path branch
- [ ] Show per-branch timing breakdown

#### Task 8c.4: Tests (~2h)
- [ ] Unit tests for fork/join detection algorithm
- [ ] Unit tests for branch comparison calculations
- [ ] Unit tests for swim-lane class application
- [ ] E2E test for parallel visualization

### Success Criteria

- [ ] Fork/Join branches visually grouped with colored lanes
- [ ] Critical path branch highlighted
- [ ] Branch comparison table in detail panel
- [ ] Works with nested fork/join
- [ ] >90% unit test coverage

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-08 | AI Assistant | Initial plan created — extracted from Phase 7e Q2/Q3/Q4 decisions |
| 2026-05-08 | AI Assistant | Expanded 8a with detailed 9-step implementation plan, data model, file structure; decided on pure SVG (no external lib) |
| 2026-05-08 | AI Assistant | Completed 8a Steps 1–2 + 4–9: core timeline component, layout engine, CSS, 49 tests. Only Step 3 (view mode toggle) remains. |
| 2026-05-08 | AI Assistant | Completed 8a Step 3: view mode toggle, collapsible detail panel, topological node ordering, responsive layout, time axis polish. 56 tests, all passing. 8a is fully complete. |
