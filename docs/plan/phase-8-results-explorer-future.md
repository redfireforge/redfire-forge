# Phase 8: Results Explorer — Future Enhancements

> **Status**: 🛠️ In Progress (8a, 8b, 8c complete — 8d not started)  
> **Priority**: Low–Medium  
> **Effort**: Large (~31–38 hours total across 4 features)  
> **Dependencies**: Phase 7e (Visual Execution Replay) — ✅ Complete  
> **Origin**: Identified during Phase 7e development (Q2, Q3, Q4 decisions)

---

## Overview

Four enhancements to the Results Explorer. The first three were identified during Phase 7e; 8d was added during 8b implementation. Each can be implemented independently.

| # | Feature | Size | Priority | Status |
|---|---------|------|----------|--------|
| 8a | Timeline View / Gantt Chart | Large (~16h) | Medium | ✅ Complete |
| 8b | Sub-Workflow Drill-Down | Medium (6–8h) | Low | ✅ Complete |
| 8c | Parallel Execution Visualization | Medium (6–10h) | Low | ✅ Complete |
| 8d | Sub-Workflow Timeline Enhancements | Small (~3–4h) | Low | Not Started |

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
> **Status**: ✅ Complete (2026-05-09)

### Problem

When a workflow contains sub-workflow nodes, the Results Explorer shows them as single nodes with pass/fail state. Users cannot drill into the sub-workflow to see its internal execution flow, node-by-node timing, or where failures occurred inside the sub-workflow.

### Solution

Add a **"View Sub-Workflow"** button in the detail panel when a sub-workflow node is selected. Clicking it opens a nested `WorkflowResultsExplorerModal` showing the sub-workflow's execution trace.

### Implementation Summary

#### Task 8b.1: Capture Nested Trace ✅
- [x] Updated `graphRunner.ts` to capture a full `WorkflowExecutionTrace` for each sub-workflow execution
- [x] Stored nested trace in `ExecutionEventDetails.subWorkflowTrace`
- [x] Added `subWorkflowTrace?: WorkflowExecutionTrace` to `ExecutionEventDetails` type
- [x] Handles recursive sub-workflows (sub-sub-workflows)

#### Task 8b.2: Update Detail Panel ✅
- [x] Added "View Sub-Workflow" button in `ResultsExplorerDetailPanel` when `nodeType === 'subWorkflow'`
- [x] Only shows button if `subWorkflowTrace` exists
- [x] Shows "trace not captured" message when sub-workflow has no trace
- [x] Passes sub-workflow trace to nested modal via `onDrillDown` callback

#### Task 8b.3: Nested Modal & Breadcrumb ✅
- [x] Renders nested `WorkflowResultsExplorerModal` inside the current modal
- [x] Breadcrumb trail shows nesting path (e.g., "Main Workflow > Process Order > Validate Payment")
- [x] Escape key closes inner modal first
- [x] Persists saved layout when re-entering same child workflow

#### Task 8b.4: Execution Chain Wiring ✅
- [x] Wired `resolveSubWorkflow` through load test execution chain
- [x] Resolved sample catalog companion workflows in load runner
- [x] Bypassed Web Worker when `resolveSubWorkflow` is needed (workers can't pass functions)
- [x] Search all catalog companions instead of matching only parent ID

#### Task 8b.5: Tests ✅
- [x] Unit tests for drill-down button visibility and click behavior
- [x] Unit tests for "trace not captured" state
- [x] Unit tests for non-subWorkflow nodes (no button shown)
- [x] 5 Playwright E2E tests for drill-down flow
- [x] Canvas node reset on drill-down tested

### Bugs Found & Fixed During Implementation

- **Canvas node state**: Nodes from parent workflow persisted when drilling into child — fixed by resetting canvas nodes on drill-down.
- **Companion workflow search**: Was matching only parent ID instead of searching all catalog companions — fixed to search full catalog.
- **Web Worker limitation**: `resolveSubWorkflow` function can't be serialized for workers — added bypass to use direct execution when sub-workflows are present.
- **Layout persistence**: Saved node layout was lost when re-entering the same child workflow — fixed to persist layout across drill-down sessions.

### Files Modified

| File | Change |
|------|--------|
| `src/engine/workflow/graphRunner.ts` | Capture sub-workflow traces, accept `resolveSubWorkflow` |
| `src/features/results/components/ResultsExplorerDetailPanel.tsx` | Added drill-down button, "trace not captured" state, `onDrillDown` prop |
| `src/features/results/components/WorkflowResultsExplorerModal.tsx` | Drill-down state, breadcrumb nav, child trace rendering |
| `src/features/results/components/WorkflowExecutionCanvas.tsx` | Reset nodes on drill-down |
| `src/features/test-runner/hooks/useTestExecution.ts` | Wire `resolveSubWorkflow` through execution chain |
| `src/engine/workerBridge.ts` | Bypass worker for sub-workflow-aware execution |
| `src/features/results/components/ResultsExplorerDetailPanel.test.tsx` | 4 new drill-down tests |
| `e2e/sub-workflow-drilldown.spec.ts` | **NEW** — 5 E2E tests |

### Success Criteria

- [x] Clicking sub-workflow node shows "View Sub-Workflow" button ✅
- [x] Button opens nested Results Explorer with sub-workflow trace ✅
- [x] Breadcrumb shows nesting path ✅
- [x] Escape closes inner modal first ✅
- [x] Recursive nesting works (sub-sub-workflows) ✅
- [x] >90% unit test coverage ✅

---

## 8c: Parallel Execution Visualization

> **Origin**: Phase 7e Q4 — "How to handle workflows with parallel execution (Fork/Join)?"  
> **Priority**: Low  
> **Effort**: Medium (~6–10 hours)  
> **Status**: ✅ Complete (2026-05-09)

### Problem

Fork/Join workflows execute multiple branches in parallel. The current diagram shows all nodes and edges correctly, but doesn't visually distinguish:

- Which nodes belong to the same parallel branch
- Which branch was the critical path (slowest)
- How branch durations compare to each other
- Thread/fork execution details

### Solution

Add **swim-lane grouping** for fork/join branches on the ReactFlow canvas, plus a **branch comparison table** in the detail panel for fork/join nodes.

### Implementation Summary

#### Task 8c.1: Fork/Join Topology Detection ✅
- [x] Created `src/features/results/utils/forkJoinDetection.ts`
- [x] Detect fork/join pairs from graph topology (fork = multiple outgoing edges, join = multiple incoming edges)
- [x] Map each node to its branch (branch 0, branch 1, etc.) via `BranchAssignment`
- [x] Handle nested fork/join (recursive detection and skip logic)
- [x] Compute per-branch execution stats (avg duration, pass rate, critical path)
- [x] Compute branch bounding boxes for swim-lane rendering

#### Task 8c.2: Swim-Lane Rendering ✅
- [x] Added `SwimLaneOverlay` component with colored semi-transparent background regions
- [x] Tab-style labels above each lane — colored tab header with white text for high contrast
- [x] Descriptive branch names derived from node labels (e.g., "Fetch Posts → … → Create Summary")
- [x] Positions lanes based on node positions using `computeBranchBounds`
- [x] Critical path branch: solid border, "⏱ Critical Path" badge in tab
- [x] Non-critical branches: dashed border
- [x] 8-color palette for up to 8 parallel branches
- [x] Critical path threshold: only marked when meaningfully slower (≥10% or ≥5ms absolute)

#### Task 8c.3: Branch Comparison in Detail Panel ✅
- [x] Added `BranchComparisonSection` component to `ResultsExplorerDetailPanel`
- [x] Shows branch comparison table: branch name, node count, avg time, pass rate
- [x] Critical path row highlighted with amber background and "⏱ Critical" badge
- [x] Color dots match swim-lane colors for visual consistency
- [x] Appears for both fork and join nodes (same pair)
- [x] `forkJoinTopology` prop piped from Canvas → Modal → DetailPanel

#### Task 8c.4: Tests ✅
- [x] 31 unit tests for fork/join detection (topology, stats, bounds, edge cases)
- [x] 100% line coverage, 97.63% statement coverage on `forkJoinDetection.ts`
- [x] 6 unit tests for branch comparison in detail panel
- [x] 5 Playwright E2E tests for parallel visualization

#### Task 8c.5: Gallery Sample & Training Manual ✅
- [x] Created `src/data/galleries/workflows/parallelShowcase.ts` — 3-branch fork/join workflow (11 nodes)
- [x] Branch A (Content Pipeline): 3 steps — Fetch Posts → Fetch Comments → Create Summary
- [x] Branch B (Quick Check): 1 step — Fetch Albums
- [x] Branch C (Activity Pipeline): 2 steps — Fetch Todos → Check Todo Status
- [x] Registered in `sampleWorkflowCatalog` with tags: fork-join, parallel, swim-lane, critical-path
- [x] Created training manual: `docs/training-manuals/workflow/api-patterns/parallel-showcase-medium.html`
- [x] Added to training path: Workflow API Patterns → Basics phase
- [x] Added manual metadata entry (2026-05-09)
- [x] Updated test counts (35→36 workflows, 5→6 manuals)

### Bugs Found & Fixed During Implementation

- **Pre-existing ESLint error**: `totalNodes` unused variable in `WorkflowResultsExplorerModal.tsx` — removed redundant declaration.

### Files Modified

| File | Change |
|------|--------|
| `src/features/results/utils/forkJoinDetection.ts` | **NEW** — topology detection, branch stats, bounds, color palette |
| `src/features/results/utils/forkJoinDetection.test.ts` | **NEW** — 31 unit tests |
| `src/features/results/components/WorkflowExecutionCanvas.tsx` | Added `SwimLaneOverlay` (tab-style labels, white text), topology detection, `onForkJoinDetected` prop |
| `src/features/results/components/ResultsExplorerDetailPanel.tsx` | Added `BranchComparisonSection`, `forkJoinTopology` prop |
| `src/features/results/components/WorkflowResultsExplorerModal.tsx` | Piped topology state from Canvas to DetailPanel |
| `src/features/results/components/ResultsExplorerDetailPanel.test.tsx` | 6 new branch comparison tests |
| `src/styles/results-explorer.css` | Swim-lane and branch comparison CSS |
| `e2e/parallel-visualization.spec.ts` | **NEW** — 5 E2E tests |
| `src/data/galleries/workflows/parallelShowcase.ts` | **NEW** — 3-branch fork/join showcase factory |
| `src/data/galleries/workflows/index.ts` | Added import + catalog entry for parallel showcase |
| `docs/training-manuals/workflow/api-patterns/parallel-showcase-medium.html` | **NEW** — swim lanes & critical path training manual |
| `src/data/galleries/trainingPaths/workflowPaths.ts` | Added training path entry |
| `src/data/galleries/trainingPaths/manualMetadata.ts` | Added metadata entry |

### Success Criteria

- [x] Fork/Join branches visually grouped with colored lanes ✅
- [x] Tab-style labels with high-contrast white text ✅
- [x] Descriptive branch names from node labels ✅
- [x] Critical path branch highlighted (with meaningful threshold) ✅
- [x] Branch comparison table in detail panel ✅
- [x] Works with nested fork/join ✅
- [x] Gallery sample: 3-branch parallel showcase workflow ✅
- [x] Training manual: swim lanes & critical path guide ✅
- [x] >90% unit test coverage ✅ (100% lines, 97.63% statements)
- [x] 5 Playwright E2E tests passing ✅

---

## 8d: Sub-Workflow Timeline Enhancements

> **Origin**: Phase 8b implementation — sub-workflow nodes appear as empty bars in the Timeline View  
> **Priority**: Low  
> **Effort**: Small (~3–4 hours)

### Problem

In the Timeline View (Gantt chart), sub-workflow nodes are rendered identically to HTTP request nodes — a single solid bar. However:

- **The bar appears empty** because sub-workflow nodes have overall duration but no HTTP-specific details, making them visually indistinguishable from a simple request
- **No visual cue** that this node represents an entire child workflow containing multiple internal steps
- **No drill-down** — clicking a sub-workflow bar in the timeline doesn't offer a way to view the child workflow's timeline
- **Internal timing is hidden** — the sub-workflow bar shows total duration but not the time distribution of its internal nodes

### Proposed Enhancements

#### Enhancement 1: Distinct Color for Sub-Workflow Bars
- Use a **different hue** (e.g., indigo/purple `#6366f1`) for sub-workflow bars to distinguish them from HTTP request bars (green/red)
- Keeps pass/fail semantics: indigo for pass, red for fail, gray for skipped
- Helps users instantly identify which timeline rows represent sub-workflows vs. regular nodes

#### Enhancement 2: Striped / Hatched Bar Pattern
- Apply a **diagonal stripe or hatched SVG pattern** to sub-workflow bars
- Conveys "this bar contains internal structure" at a glance, even without color
- Combine with distinct color for maximum visual differentiation

#### Enhancement 3: Label Badge
- Add a small **"SUB" badge** or **"🔗" icon** next to the node name in the label column
- Consistent with how the diagram view shows node type icons
- Provides a clear textual/iconic indicator alongside the visual bar styling

#### Enhancement 4: Inline Child Timeline (Nested Bars)
- Render the **child workflow's internal nodes as mini-bars inside** the sub-workflow's bar
- Shows time distribution within the sub-workflow at a glance
- Each mini-bar uses standard pass/fail colors
- Clicking a mini-bar could open the detail panel for that child node

#### Enhancement 5: Clickable Drill-Down from Timeline
- **Single-click** a sub-workflow bar → opens detail panel with "View Sub-Workflow" button (existing)
- **Double-click** a sub-workflow bar → directly drills into the child workflow's timeline
- Timeline view switches to show the child workflow's nodes
- Breadcrumb (from 8b) appears for navigation back to parent

### Implementation Tasks

#### Task 8d.1: Distinct Color + Pattern (~1h)
- [ ] Define sub-workflow color constants in timeline layout utils
- [ ] Create SVG `<pattern>` definition for diagonal stripes
- [ ] Apply distinct fill + pattern to sub-workflow bars in `ExecutionTimeline.tsx`
- [ ] Update legend/tooltip to explain the visual distinction

#### Task 8d.2: Label Badge (~0.5h)
- [ ] Detect `nodeType === 'subWorkflow'` in the label column
- [ ] Render "SUB" badge or icon next to node name
- [ ] Style badge with CSS (small, pill-shaped, muted color)

#### Task 8d.3: Inline Child Timeline (~1.5h)
- [ ] Extract child workflow events from `subWorkflowTrace` for the selected iteration
- [ ] Calculate relative positions of child events within the parent bar's time range
- [ ] Render mini `<rect>` elements inside the parent bar
- [ ] Apply pass/fail/skipped colors to mini-bars
- [ ] Handle overflow (many child nodes in a short parent bar)

#### Task 8d.4: Double-Click Drill-Down (~0.5h)
- [ ] Add `onDoubleClick` handler to sub-workflow bars
- [ ] Trigger `onDrillDown` callback (reuse from 8b)
- [ ] Cursor/hover hint indicating drill-down is available

#### Task 8d.5: Tests (~1h)
- [ ] Unit tests for sub-workflow bar styling (color, pattern)
- [ ] Unit tests for label badge rendering
- [ ] Unit tests for inline child bar positions
- [ ] Unit test for double-click drill-down callback
- [ ] E2E test for visual distinction in timeline

### Success Criteria

- [ ] Sub-workflow bars are visually distinct from HTTP request bars (color + pattern)
- [ ] Label column shows "SUB" badge for sub-workflow nodes
- [ ] Internal child nodes rendered as mini-bars within the parent bar
- [ ] Double-click drills into child workflow timeline
- [ ] Breadcrumb navigation works from timeline drill-down
- [ ] >90% unit test coverage

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-08 | AI Assistant | Initial plan created — extracted from Phase 7e Q2/Q3/Q4 decisions |
| 2026-05-08 | AI Assistant | Expanded 8a with detailed 9-step implementation plan, data model, file structure; decided on pure SVG (no external lib) |
| 2026-05-08 | AI Assistant | Completed 8a Steps 1–2 + 4–9: core timeline component, layout engine, CSS, 49 tests. Only Step 3 (view mode toggle) remains. |
| 2026-05-08 | AI Assistant | Completed 8a Step 3: view mode toggle, collapsible detail panel, topological node ordering, responsive layout, time axis polish. 56 tests, all passing. 8a is fully complete. |
| 2026-05-09 | AI Assistant | Completed 8c: Parallel Execution Visualization — swim-lane overlay, branch comparison table, topology detection. 31+6 unit tests (100% line coverage), 5 E2E tests. |
| 2026-05-09 | AI Assistant | 8c polish: tab-style swim-lane labels (white text on colored tab), descriptive branch names from node labels, critical path threshold (>=10% or >=5ms). |
| 2026-05-09 | AI Assistant | 8c gallery: added Parallel Showcase (3 Branches) sample workflow + training manual for swim lanes & critical path. |
| 2026-05-09 | AI Assistant | Added 8d: Sub-Workflow Timeline Enhancements plan (distinct color, striped pattern, label badge, inline child timeline, double-click drill-down). |
| 2026-05-09 | AI Assistant | Consolidated all unmerged feature branches (sub-workflow-drilldown, fix-progress-counter, training-ppt) into feature/parallel-visualization. Updated 8b to reflect completed status with implementation details. |
