# Phase 8: Results Explorer — Future Enhancements

> **Status**: 📋 Not Started  
> **Priority**: Low–Medium  
> **Effort**: Large (~28–34 hours total across 3 features)  
> **Dependencies**: Phase 7e (Visual Execution Replay) — ✅ Complete  
> **Origin**: Identified during Phase 7e development (Q2, Q3, Q4 decisions)

---

## Overview

Three independent enhancements to the Results Explorer were identified during Phase 7e but are beyond its scope. Each can be implemented independently — they don't depend on each other.

| # | Feature | Size | Priority | Status |
|---|---------|------|----------|--------|
| 8a | Timeline View / Gantt Chart | Large (~16h) | Medium | Not Started |
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

#### Step 1: Create Feature Branch
- [ ] Branch from `develop` → `feature/timeline-view`

#### Step 2: Build Core Timeline Component (~4h)
**File**: `src/features/results/components/ExecutionTimeline.tsx`

- [ ] Create component that takes `trace: WorkflowExecutionTrace` and `selectedIteration`
- [ ] Calculate time range from events (min timestamp → max timestamp + duration)
- [ ] Render fixed-width label column on the left (node names)
- [ ] Render SVG area with horizontal bars (`<rect>`) positioned by timestamp/duration
- [ ] Color-code bars: `#22c55e` (pass), `#ef4444` (fail), `#64748b` (skipped)
- [ ] Draw time axis along the top with smart tick intervals
- [ ] Support horizontal scroll for long workflows
- [ ] Support zoom (mouse wheel on time axis scales the X range)

#### Step 3: Wire View Mode Toggle (~2h)
**File**: `src/features/results/components/WorkflowResultsExplorerModal.tsx`

- [ ] Add `viewMode` state: `'diagram' | 'timeline'`
- [ ] Add segmented toggle in header: "📊 Diagram" / "📈 Timeline"
- [ ] Conditionally render `WorkflowExecutionCanvas` or `ExecutionTimeline` in left panel
- [ ] Add keyboard shortcut: `T` to toggle view mode
- [ ] Right panel (detail) and bottom panel (matrix) remain unchanged

#### Step 4: Add Click & Hover Interactions (~3h)
**Files**: `ExecutionTimeline.tsx`, `src/styles/results-explorer.css`

- [ ] Click bar → call `onNodeClick(nodeId)` (same callback as diagram)
- [ ] Hover bar → show tooltip (node name, status, duration, response code)
- [ ] Highlight selected bar (glow/brighter border matching `replay-node-selected` style)
- [ ] Sync: selecting node in detail panel highlights corresponding bar

#### Step 5: Handle Parallel Executions (~2h)
**File**: `ExecutionTimeline.tsx` (layout logic)

- [ ] Detect overlapping events (event B starts before event A ends)
- [ ] Assign lane index using greedy interval scheduling
- [ ] Stack parallel events vertically within the same time window
- [ ] Adjust row height dynamically based on max lane count

#### Step 6: Aggregate Mode (~2h)
**File**: `ExecutionTimeline.tsx`

- [ ] When `selectedIteration === undefined`, overlay all iterations
- [ ] Render each iteration's bars at reduced opacity (~0.3)
- [ ] Draw vertical marker lines for avg and P95 total duration
- [ ] Highlight outlier iterations (>P95) with distinct shade

#### Step 7: CSS Styles (~1h)
**File**: `src/styles/results-explorer.css`

- [ ] Timeline container layout (label column + SVG area)
- [ ] Bar base styles, hover/selected states
- [ ] Time axis tick and label styles
- [ ] Tooltip styles (reuse existing `.replay-node-tooltip` pattern)
- [ ] View mode toggle button styles

#### Step 8: Unit Tests (~3h)
**Files**: `ExecutionTimeline.test.tsx`, `WorkflowResultsExplorerModal.test.tsx`

- [ ] Bar X position and width calculation from timestamps
- [ ] Time axis tick generation (smart intervals)
- [ ] Color mapping: pass → green, fail → red, skipped → gray
- [ ] Parallel lane assignment algorithm
- [ ] View mode toggle renders correct component
- [ ] Click bar triggers `onNodeClick`
- [ ] Aggregate mode renders overlapping bars

#### Step 9: TypeScript Check + Verify (~30 min)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` on touched files — all pass
- [ ] Manual visual test with dev server

### File Structure

```
src/features/results/
├── components/
│   ├── ExecutionTimeline.tsx          # NEW — SVG Gantt chart component
│   ├── ExecutionTimeline.test.tsx     # NEW — unit tests
│   ├── WorkflowResultsExplorerModal.tsx  # MODIFIED — view mode toggle
│   └── WorkflowResultsExplorerModal.test.tsx  # MODIFIED — toggle tests
└── utils/
    └── timelineLayout.ts             # NEW (optional) — lane detection, tick generation
```

### Success Criteria

- [ ] Toggle between Diagram and Timeline view via button or `T` key
- [ ] Bars correctly positioned and sized by timestamp/duration
- [ ] Colors match diagram view (pass/fail/skipped)
- [ ] Click bar opens detail panel (same as clicking node in diagram)
- [ ] Parallel executions shown as stacked lanes (no visual overlap)
- [ ] Aggregate mode shows overlaid iterations with avg/P95 markers
- [ ] >90% unit test coverage
- [ ] No external library dependency (pure SVG)

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
