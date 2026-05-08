# Workflow Results Display Design

> **Phase 4**: Workflow-Aware Results Display — Visual Design Specification

## Overview

This document describes the design and implementation of the workflow results display in the Results Dashboard. When viewing results from a workflow run (`executionMode === 'workflow'`), the dashboard shows specialized visualizations and metrics optimized for understanding workflow performance.

## Design Principles

1. **Iteration-Focused**: Workflows run multiple iterations (e.g., 100 iterations × 10 concurrency). Results are grouped and visualized by iteration.
2. **Step-Level Visibility**: Each HTTP node in the workflow becomes a "step". Show per-step metrics to identify bottlenecks.
3. **Progressive Disclosure**: Start with high-level overview, allow drill-down into specific iterations and steps.
4. **Performance-First**: Emphasize response times, percentiles, and pass/fail status for load testing scenarios.

---

## Component: WorkflowResultsSummary

**Location**: `src/features/results/components/WorkflowResultsSummary.tsx`

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Workflow Results Summary                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  📊 Iteration Performance Chart                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                     │  │
│  │  Response Time (ms)                                                 │  │
│  │  2000 ┼─────────────────────────────────────────                   │  │
│  │  1500 ┼                                                             │  │
│  │  1000 ┼     █ █   █   █ █     █                                   │  │
│  │   500 ┼   █ █ █ █ █ █ █ █ █ █ █ █                                │  │
│  │     0 ┼───────────────────────────────────                         │  │
│  │        1   5   10  15  20  25  30                                  │  │
│  │                    Iteration #                                      │  │
│  │                                                                     │  │
│  │  Legend: [█ Green = Pass] [█ Red = Fail]                           │  │
│  │  Stats:  Avg: 847ms | P95: 1,203ms | Min: 412ms | Max: 1,891ms    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                           │
│  📋 Per-Step Performance Summary                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Step                  │ Avg    │ Min   │ Max    │ P50   │ P95    │  │
│  ├──────────────────────┼────────┼───────┼────────┼───────┼────────┤  │
│  │ 1. Create Order       │ 245ms  │ 180ms │ 410ms  │ 230ms │ 350ms  │  │
│  │ 2. Get Order          │ 120ms  │  85ms │ 200ms  │ 115ms │ 165ms  │  │
│  │ 3. Update Order       │ 189ms  │ 140ms │ 350ms  │ 175ms │ 290ms  │  │
│  │ 4. Verify Status      │  95ms  │  60ms │ 160ms  │  88ms │ 140ms  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Click a step to view individual results →                               │
│                                                                           │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                           │
│  🔍 Per-Iteration Detail                                [Expand All ▼]   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ ▶ Iteration #1  ✅ 649ms (4/4 passed)                              │  │
│  │ ▼ Iteration #2  ✅ 712ms (4/4 passed)                              │  │
│  │   ├─ Step 1: Create Order     → 256ms ✅ 201 Created              │  │
│  │   ├─ Step 2: Get Order        → 134ms ✅ 200 OK                   │  │
│  │   ├─ Step 3: Update Order     → 198ms ✅ 200 OK                   │  │
│  │   └─ Step 4: Verify Status    → 124ms ✅ 200 OK                   │  │
│  │ ▶ Iteration #3  ❌ 1,203ms (3/4 — Step 3 failed)                  │  │
│  │ ▶ Iteration #4  ✅ 598ms (4/4 passed)                              │  │
│  │ ...                                                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  [Export CSV] [Export JSON] [Generate Report ▼]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: Iteration Performance Chart

**Purpose**: Visualize per-iteration response times across all iterations.

### Visual Design

**Chart Type**: Vertical bar chart
- **X-axis**: Iteration number (1, 2, 3, ..., N)
- **Y-axis**: Total workflow response time (milliseconds)
- **Bar Color**: 
  - Green (`rgba(34, 197, 94, ...)`) = All steps passed
  - Red (`rgba(239, 68, 68, ...)`) = At least one step failed
- **Bar Width**: Dynamic based on iteration count (2px - 20px)
- **Background Grid**: Horizontal dashed lines at 4 intervals

### Interactive Features

- **Hover Tooltip**: Shows iteration details
  ```
  Iteration #23
  Total Time: 847ms
  Status: ✅ All Passed (4/4)
  Steps: Create Order (245ms) → Get Order (120ms) → ...
  ```
- **Click**: Scrolls to that iteration in the Per-Iteration Detail section

### Statistics Panel (Below Chart)

Displays aggregate metrics:
```
Avg: 847ms | P95: 1,203ms | Min: 412ms | Max: 1,891ms
```

**Formula**:
- **Avg**: Mean of all iteration total times
- **P95**: 95th percentile (sorts times, takes value at 95% position)
- **Min**: Minimum iteration time
- **Max**: Maximum iteration time

---

## Section 2: Per-Step Performance Summary

**Purpose**: Identify slow steps (bottlenecks) across all iterations.

### Table Columns

| Column | Description | Calculation |
|--------|-------------|-------------|
| **Step** | Node label from workflow (e.g., "Create Order") | `node.data.label` |
| **Avg** | Average response time for this step | `sum(times) / count` |
| **Min** | Fastest response for this step | `Math.min(...times)` |
| **Max** | Slowest response for this step | `Math.max(...times)` |
| **P50** | Median response time | 50th percentile |
| **P95** | 95th percentile response time | 95th percentile |
| **Pass Rate** | % of requests that passed | `(passed / total) * 100` |

### Row Styling

- **Normal**: Default text color
- **Warning** (P95 > threshold): Amber background
- **Error** (Pass Rate < 95%): Red background
- **Clickable**: Entire row is clickable to filter results to that step

### Sort Options

- Default: By workflow step order (execution sequence)
- Optional: Sort by Avg, P95, Pass Rate (descending)

---

## Section 3: Per-Iteration Detail

**Purpose**: Drill down into individual iteration results.

### Accordion Structure

Each iteration is an expandable/collapsible row:

#### Collapsed State
```
▶ Iteration #23  ✅ 847ms (4/4 passed)
```

**Format**:
- **Icon**: `▶` (collapsed) or `▼` (expanded)
- **Label**: `Iteration #<N>`
- **Status Icon**: `✅` (all passed) or `❌` (at least one failed)
- **Total Time**: Sum of all step response times
- **Pass Summary**: `(passed / total steps)`

#### Expanded State
```
▼ Iteration #23  ✅ 847ms (4/4 passed)
  ├─ Step 1: Create Order     → 245ms ✅ 201 Created
  ├─ Step 2: Get Order        → 120ms ✅ 200 OK
  ├─ Step 3: Update Order     → 189ms ✅ 200 OK
  └─ Step 4: Verify Status    →  95ms ✅ 200 OK
```

**Step Row Format**:
- **Indent**: Tree-style visual indent (`├─`, `└─`)
- **Step Label**: Node label from workflow
- **Response Time**: Milliseconds
- **Status**: Icon + HTTP status code or validation result
- **Clickable**: Click to open ResponseDetailModal for that specific result

### Bulk Actions

- **[Expand All]**: Expand all iterations
- **[Collapse All]**: Collapse all iterations
- **Filter by status**: Show only failed iterations

---

## Data Flow

### Input: TestRun

```typescript
interface TestRun {
  id: string;
  config: TestConfig;           // Contains executionMode, workflowId
  results: RequestResult[];     // All results from all iterations
  summary: TestSummary;
  timestamp: number;
  // ...
}
```

### Workflow Detection

A run is considered a "workflow run" if:
```typescript
run.config.executionMode === 'workflow'
```

### Result Tagging

Each `RequestResult` in a workflow run has:
```typescript
interface RequestResult {
  // ... standard fields ...
  iterationIndex?: number;      // 0-based iteration number
  workflowNodeId?: string;      // ID of the workflow node that produced this result
}
```

### Processing Pipeline

1. **Detect Workflow Run**: Check `hasWorkflowData(results)`
2. **Compute Step Summaries**: Group by `workflowNodeId`, calculate aggregates
3. **Compute Iteration Summaries**: Group by `iterationIndex`, calculate totals
4. **Render Chart**: Use iteration summaries
5. **Render Tables**: Use step and iteration summaries

---

## Implementation Details

### Functions (in `resultsGrouping.ts`)

```typescript
// Check if results contain workflow data
function hasWorkflowData(results: RequestResult[]): boolean

// Compute per-step aggregate metrics
function computeWorkflowStepSummaries(results: RequestResult[]): WorkflowStepSummary[]

// Compute per-iteration summaries
function computeWorkflowIterationSummaries(results: RequestResult[]): WorkflowIterationSummary[]

// Get total iteration count
function getIterationCount(results: RequestResult[]): number
```

### Interfaces

```typescript
interface WorkflowStepSummary {
  nodeId: string;
  label: string;
  count: number;
  passed: number;
  failed: number;
  passRate: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50Time: number;
  p95Time: number;
  p99Time: number;
}

interface WorkflowIterationSummary {
  iterationIndex: number;
  totalTime: number;
  stepCount: number;
  passedCount: number;
  allPassed: boolean;
  results: RequestResult[];  // All results for this iteration
}
```

---

## Styling

**CSS Location**: `src/styles/results.css`

### Key Classes

```css
.workflow-results-summary {
  /* Container for all workflow results sections */
}

.workflow-iteration-chart {
  /* Chart container */
  height: 200px;
  margin-bottom: 20px;
}

.workflow-step-table {
  /* Per-step summary table */
}

.workflow-iteration-list {
  /* Per-iteration accordion list */
}

.workflow-iteration-row {
  /* Single iteration row (collapsed or expanded) */
  cursor: pointer;
}

.workflow-iteration-step {
  /* Individual step within an expanded iteration */
  padding-left: 30px;
  color: rgba(100, 116, 139, 0.9);
}
```

---

## Interaction Flows

### Flow 1: Identify Bottleneck Step

1. User views workflow results
2. Scans **Per-Step Performance Summary** table
3. Identifies step with highest P95 time (e.g., "Update Order: 350ms")
4. Clicks that row to filter results
5. Views only results from that step across all iterations
6. Analyzes response details, errors, patterns

### Flow 2: Debug Failed Iteration

1. User sees red bar in **Iteration Performance Chart**
2. Clicks the red bar (or scrolls to failed iteration in list)
3. Expands iteration row in **Per-Iteration Detail**
4. Sees which step failed: `Step 3: Update Order → ❌ 500 Internal Server Error`
5. Clicks the failed step
6. ResponseDetailModal opens showing request/response details
7. User debugs the issue (e.g., missing auth token, invalid payload)

### Flow 3: Performance Trend Analysis

1. User views chart with multiple runs over time
2. Notices P95 time increasing from 800ms → 1,200ms
3. Drills into recent runs
4. Compares step-level metrics across runs
5. Identifies that "Get Order" step P95 increased from 120ms → 250ms
6. Investigates database performance, API changes

---

## Comparison: Test Runner vs Workflow Runner Results

| Aspect | Test Runner Results | Workflow Runner Results |
|--------|---------------------|-------------------------|
| **Grouping** | Feature → Scenario → Test → Data Row | Iteration → Step |
| **Primary Metric** | Per-test pass/fail | Per-iteration total time |
| **Visualization** | Pass rate donut chart | Iteration performance chart (bars) |
| **Drill-Down** | By test, by data row | By iteration, by step |
| **Use Case** | API contract testing, validation | Load testing, bottleneck identification |

---

## Future Enhancements

### Planned (Not Yet Implemented)

1. **Visual Execution Replay** (Phase 7e)
   - Show workflow diagram with results overlaid on nodes
   - Color nodes by performance (green = fast, red = slow)
   - Animate execution flow through the graph

2. **Parallel Branch Visualization**
   - For Fork/Join workflows, show parallel execution timing
   - Gantt-chart style view of concurrent steps

3. **Comparison Mode**
   - Compare two workflow runs side-by-side
   - Highlight steps that regressed or improved

4. **Export to HTML Report**
   - Generate standalone HTML report with charts
   - Include interactive charts using Chart.js or Recharts

---

## Testing

### Unit Tests

**Location**: `src/features/results/components/WorkflowResultsSummary.test.tsx`

**Coverage**:
- Renders empty state when no workflow data
- Renders iteration chart with correct bar count
- Computes step summaries correctly
- Expands/collapses iteration rows
- Handles click events on steps
- Exports CSV with workflow-specific columns

### E2E Tests

**Location**: `e2e/workflow-results.spec.ts`

**Scenarios**:
- Run workflow with 10 iterations
- Navigate to Results dashboard
- Verify chart renders
- Verify step table shows 4 steps
- Click iteration to expand
- Click step to open detail modal

---

## Accessibility

- **Keyboard Navigation**: Tab through iterations, Enter to expand/collapse
- **Screen Readers**: ARIA labels on chart bars, table headers, buttons
- **Color Contrast**: Green/red bars meet WCAG AA contrast ratio
- **Focus Indicators**: Visible focus ring on interactive elements

---

## References

- **Implementation**: `src/features/results/components/WorkflowResultsSummary.tsx`
- **Utilities**: `src/features/test-runner/utils/resultsGrouping.ts`
- **Plan**: `docs/plan/workflow-harness-integration-plan.md` (Phase 4)
- **User Guide**: `docs/guides/workflow-runner-guide.md` (Results Interpretation section)
