# Results Explorer Redesign Plan

## Overview

Redesign the current "Execution Replay" feature into a more useful "Results Explorer" with:
- Left-right split layout (diagram | detail panel)
- Rich node detail panel with request/response/variables
- Iteration matrix table showing all iterations × nodes
- Optional full trace capture (user chooses before execution)

---

## Layout Design

```
┌─────────────────────────────────┬──────────────────────────────┐
│  [Workflow Diagram - 50%]       │  [Detail Panel - 50%]        │
│                                 │                              │
│  ┌─────────┐                    │  ┌────────────────────────┐  │
│  │  Start  │                    │  │ Submit Payment (POST)  │  │
│  └────┬────┘                    │  │ 201 Created • 199ms    │  │
│       ▼                         │  ├────────────────────────┤  │
│  ┌─────────┐                    │  │ Iteration: [#1 ▼]      │  │
│  │ Submit  │ ◀── selected       │  ├────────────────────────┤  │
│  └────┬────┘                    │  │[Request][Response][Vars]│ │
│       ▼                         │  ├────────────────────────┤  │
│  ┌─────────┐                    │  │ {                      │  │
│  │  Wait   │                    │  │   "title": "Payment",  │  │
│  └────┬────┘                    │  │   "amount": 100        │  │
│       ▼                         │  │ }                      │  │
│  ┌─────────┐                    │  └────────────────────────┘  │
│  │ Confirm │                    │                              │
│  └─────────┘                    │  (No node selected: show     │
│                                 │   aggregate summary stats)   │
│  [🔍+] [🔍-] [⊡ Fit] [🗺 Map]   │                              │
├─────────────────────────────────┴──────────────────────────────┤
│  [▼ Iteration Matrix]                              [Collapse ▲]│
│  ┌────────┬─────────┬────────────┬────────────┬───────┬───────┐│
│  │  Iter  │  Start  │  Submit    │  Confirm   │ Total │Status ││
│  ├────────┼─────────┼────────────┼────────────┼───────┼───────┤│
│  │   #1   │  ✓ —    │  ✓ 199ms   │  ✓ 95ms    │ 294ms │  ✓    ││
│  │   #2   │  ✓ —    │  ✗ 201ms   │   — —      │ 201ms │  ✗    ││
│  └────────┴─────────┴────────────┴────────────┴───────┴───────┘│
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Execution Options & Trace Capture Toggle

### 1.1 Add "Capture Full Trace" Option

**Location**: Workflow Runner settings panel (before execution)

```
┌─────────────────────────────────────────────────────────────┐
│ Execution Mode: ○ Sequential ○ Batch ● Continuous Pool     │
│ Concurrency: [30    ]  Transactions: [100   ]              │
│ ...                                                         │
│ ─────────────────────────────────────────────────────────── │
│ Advanced Options                                            │
│ ☑ Capture Full Trace (stores request/response bodies)      │
│   ⚠ Increases memory usage for large runs                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 New Types

```typescript
// src/shared/types/index.ts

export interface ExecutionTraceOptions {
  /** Capture full request/response bodies */
  captureFullTrace: boolean;
  /** Maximum iterations to capture full trace for (0 = all) */
  maxFullTraceIterations?: number;
  /** Always capture full trace for failed iterations */
  alwaysCaptureFailures?: boolean;
}

export interface NodeExecutionDetail {
  // Basic (always captured)
  nodeId: string;
  nodeType: string;
  state: 'pass' | 'fail' | 'skipped';
  durationMs?: number;
  
  // Full trace (when captureFullTrace=true)
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    bodyTemplate?: string;  // Original with {{variables}}
    bodyResolved?: string;  // After variable substitution
  };
  response?: {
    statusCode: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: string;  // Truncated if too large
    bodyTruncated?: boolean;
  };
  variablesBefore?: Record<string, string>;
  variablesAfter?: Record<string, string>;
  extractedVariables?: Record<string, string>;
  assertions?: AssertionResult[];
}

export interface AssertionResult {
  type: string;
  description: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}
```

### 1.3 Files to Modify

| File | Change |
|------|--------|
| `src/features/test-runner/WorkflowRunner.tsx` | Add checkbox for "Capture Full Trace" |
| `src/features/test-runner/hooks/useWorkflowExecution.ts` | Pass option to `runGraphLoad` |
| `src/features/workflow/engine/graphLoadRunner.ts` | Accept trace options, pass to `runGraph` |
| `src/features/workflow/engine/graphRunner.ts` | Capture full request/response when enabled |
| `src/features/workflow/engine/traceCollector.ts` | Store full trace data |
| `src/shared/types/index.ts` | Add new types |

---

## Phase 2: Left-Right Layout Redesign

### 2.1 Component Structure

```
WorkflowResultsExplorerModal (renamed from WorkflowExecutionReplayModal)
├── Header
│   ├── Title: "{Workflow Name} - Results Explorer"
│   ├── Timestamp
│   └── Summary stats (iterations, pass rate, duration)
├── Body (flex row)
│   ├── Left Panel (50%)
│   │   └── WorkflowExecutionCanvas (existing, with node click)
│   └── Right Panel (50%)
│       └── NodeDetailPanel (redesigned)
│           ├── Header (node name, type, status)
│           ├── Iteration selector dropdown
│           ├── Tab bar: [Request] [Response] [Variables] [Assertions]
│           └── Tab content (JSON viewer, variable table, etc.)
└── Footer (collapsible)
    └── IterationMatrixTable (new component)
```

### 2.2 New Components

**`NodeDetailPanel.tsx`** (redesign existing)
- Tabs for Request/Response/Variables/Assertions
- Iteration selector to view specific iteration data
- JSON syntax highlighting for bodies
- Diff view for variables (before → after)

**`IterationMatrixTable.tsx`** (new)
- Virtualized table for large iteration counts
- Columns: Iteration #, one per node, Total, Status
- Color-coded cells (green/red/gray)
- Click row → select iteration
- Click cell → select node + iteration
- Footer row: AVG/MIN/MAX stats

### 2.3 Layout CSS

```css
.results-explorer-modal {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.results-explorer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.results-explorer-diagram {
  flex: 1;
  min-width: 0;
  border-right: 1px solid var(--border);
}

.results-explorer-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.results-explorer-matrix {
  border-top: 1px solid var(--border);
  max-height: 250px;
  overflow: auto;
  transition: max-height 0.3s ease;
}

.results-explorer-matrix.collapsed {
  max-height: 40px; /* Just header visible */
}
```

---

## Phase 3: Node Detail Panel with Tabs

### 3.1 Tab Content

**Request Tab**
```
┌──────────────────────────────────────────────────┐
│ POST https://api.example.com/payments            │
├──────────────────────────────────────────────────┤
│ HEADERS                                          │
│ ┌──────────────────────────────────────────────┐ │
│ │ Content-Type: application/json               │ │
│ │ Authorization: Bearer {{token}}              │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ BODY (Template)                    [Show Resolved]│
│ ┌──────────────────────────────────────────────┐ │
│ │ {                                            │ │
│ │   "orderId": "{{orderId}}",                  │ │
│ │   "amount": {{amount}}                       │ │
│ │ }                                            │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Response Tab**
```
┌──────────────────────────────────────────────────┐
│ 201 Created                           199ms      │
├──────────────────────────────────────────────────┤
│ HEADERS                                          │
│ ┌──────────────────────────────────────────────┐ │
│ │ Content-Type: application/json               │ │
│ │ X-Request-Id: abc123                         │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ BODY                                 [Copy] [▼]  │
│ ┌──────────────────────────────────────────────┐ │
│ │ {                                            │ │
│ │   "id": 101,                                 │ │
│ │   "status": "created",                       │ │
│ │   "paymentId": "pay_abc123"                  │ │
│ │ }                                            │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Variables Tab**
```
┌──────────────────────────────────────────────────┐
│ EXTRACTED BY THIS NODE                           │
│ ┌────────────────┬───────────────────────────┐   │
│ │ paymentId      │ pay_abc123                │   │
│ │ transactionRef │ TXN-2024-001             │   │
│ └────────────────┴───────────────────────────┘   │
│                                                  │
│ ALL VARIABLES (after this node)      [Expand ▼] │
│ ┌────────────────┬───────────────────────────┐   │
│ │ orderId        │ ORD-12345                 │   │
│ │ amount         │ 100                       │   │
│ │ paymentId      │ pay_abc123 ← new          │   │
│ │ token          │ eyJhbGc...                │   │
│ └────────────────┴───────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Assertions Tab**
```
┌──────────────────────────────────────────────────┐
│ 3 of 3 passed                                    │
├──────────────────────────────────────────────────┤
│ ✓ Status equals 201                              │
│   Expected: 201  Actual: 201                     │
├──────────────────────────────────────────────────┤
│ ✓ Response time < 500ms                          │
│   Expected: <500ms  Actual: 199ms                │
├──────────────────────────────────────────────────┤
│ ✓ Body contains "paymentId"                      │
│   Found at: $.paymentId                          │
└──────────────────────────────────────────────────┘
```

---

## Phase 4: Iteration Matrix Table

### 4.1 Features

- **Virtualized rendering**: Handle 1000+ iterations smoothly
- **Fixed header**: Always visible while scrolling
- **Fixed first column**: Iteration # always visible
- **Color coding**:
  - Green background: pass
  - Red background: fail  
  - Gray text: skipped or no timing
- **Click interactions**:
  - Click row → select iteration (diagram + detail panel update)
  - Click cell → select node + iteration
  - Double-click row → expand to show error details
- **Footer stats row**: AVG, MIN, MAX, P95 per column

### 4.2 Sorting & Filtering

**Sortable Columns** (click header to sort):
| Column | Sort Options |
|--------|--------------|
| Iteration # | Ascending / Descending (default: Asc) |
| Status | Failed First / Passed First / Original Order |
| Total Time | Fastest First / Slowest First |
| Any Node Column | Fastest First / Slowest First / Failed First |

**Default Sort**: Status = Failed First (so failures are immediately visible at top)

**Quick Filters & Search** (toolbar above table):
```
┌──────────────────────────────────────────────────────────────────────┐
│ [All (100)] [● Failed (3)] [Slowest 10%]   🔍 [Search errors...    ] │
└──────────────────────────────────────────────────────────────────────┘
```

- **All**: Show all iterations
- **Failed** (default when failures exist): Show only failed iterations
- **Slowest 10%**: Show iterations with total time in top 10%

**Search Box** - focused on failures:
- Searches within **error messages** across all failed iterations
- Examples: "timeout", "500", "connection", "unauthorized"
- Highlights matching rows and shows match count
- Only active when "Failed" or "All" filter is selected

```
┌──────────────────────────────────────────────────────────────────────┐
│ [All] [● Failed (3)] [Slowest]   🔍 [timeout                ] 2 found│
├──────────────────────────────────────────────────────────────────────┤
│  Iter  │  Submit    │  Confirm   │ Total  │ Status │ Error          │
├────────┼────────────┼────────────┼────────┼────────┼────────────────┤
│   #3   │  ✗ 450ms   │   — —      │  450ms │  ✗     │ Request timeout│ ← highlighted
│   #7   │  ✗ 380ms   │   — —      │  380ms │  ✗     │ Connection tim…│ ← highlighted
└────────┴────────────┴────────────┴────────┴────────┴────────────────┘
```

**Error Column** (new):
- Shows truncated error message for failed iterations
- Hover for full error tooltip
- Click to see full error in detail panel

**Visual Indicators for Sort**:
```
┌────────┬─────────┬────────────┬────────────┬───────▼┬───────┐
│  Iter  │  Start  │  Submit ▲  │  Confirm   │ Total  │Status │
│        │         │  (sorted)  │            │        │       │
├────────┼─────────┼────────────┼────────────┼────────┼───────┤
│   #3   │  ✓ —    │  ✗ 450ms   │   — —      │  450ms │  ✗    │ ← Failed rows
│   #7   │  ✓ —    │  ✗ 380ms   │   — —      │  380ms │  ✗    │   at top
├────────┼─────────┼────────────┼────────────┼────────┼───────┤
│   #1   │  ✓ —    │  ✓ 199ms   │  ✓ 95ms    │  294ms │  ✓    │
│   #2   │  ✓ —    │  ✓ 201ms   │  ✓ 99ms    │  300ms │  ✓    │
└────────┴─────────┴────────────┴────────────┴────────┴───────┘
```

**Failed Row Styling**:
- Entire row has light red background (`rgba(239, 68, 68, 0.1)`)
- Failed cell has darker red background (`rgba(239, 68, 68, 0.2)`)
- Error icon (✗) in Status column is bold red
- Hover shows tooltip with error message

**Keyboard Shortcuts** (when table focused):
- `F` - Toggle Failed First sort
- `T` - Sort by Total Time (slowest first)
- `R` - Reset to original iteration order
- `↑/↓` - Navigate rows
- `Enter` - Select highlighted row

### 4.3 Component Props

```typescript
type SortField = 'iteration' | 'status' | 'total' | string; // string for node IDs
type SortDirection = 'asc' | 'desc';
type SortMode = 'value' | 'status'; // 'value' = by time, 'status' = failed first

interface SortConfig {
  field: SortField;
  direction: SortDirection;
  mode: SortMode;
}

type FilterMode = 'all' | 'failed' | 'slowest10' | 'passOnly';

interface IterationMatrixTableProps {
  iterations: WorkflowIterationTrace[];
  nodes: WorkflowNode[];
  selectedIteration?: number;
  selectedNodeId?: string;
  onIterationSelect: (index: number) => void;
  onCellSelect: (iterationIndex: number, nodeId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  
  // Sorting & Filtering
  initialSort?: SortConfig;        // Default: { field: 'status', direction: 'desc', mode: 'status' }
  initialFilter?: FilterMode;      // Default: 'all'
}
```

### 4.4 Performance Optimizations

- Use `@tanstack/react-virtual` for virtualized rows
- Memoize cell renderers
- Debounce hover effects
- Lazy compute stats (only visible rows + footer)

---

## Phase 5: Data Flow & State Management

### 5.1 State in Modal

```typescript
interface ResultsExplorerState {
  // Selection state
  selectedNodeId: string | null;
  selectedIteration: number | null; // null = aggregate view
  
  // UI state
  matrixCollapsed: boolean;
  activeTab: 'request' | 'response' | 'variables' | 'assertions';
  showResolvedBody: boolean;
  
  // Filters
  iterationFilter: 'all' | 'failed' | 'slowest';
}
```

### 5.2 Data Flow

```
User clicks node in diagram
       │
       ▼
setSelectedNodeId(nodeId)
       │
       ▼
NodeDetailPanel receives:
  - nodeId
  - selectedIteration (null = show last/aggregate)
  - trace.iterations (full data)
       │
       ▼
Panel extracts relevant data:
  - If full trace: show request/response/variables
  - If basic trace: show stats only (with message "Full trace not captured")
```

---

## Implementation Order

### Phase 1: Trace Capture Toggle (1-2 days)
1. Add types for full trace data
2. Add checkbox to WorkflowRunner UI
3. Modify graphRunner to capture full data when enabled
4. Update traceCollector to store full data
5. Add tests

### Phase 2: Layout Redesign (1-2 days)
1. Rename modal to ResultsExplorerModal
2. Implement left-right split layout
3. Update CSS for responsive sizing
4. Wire up existing canvas to left panel
5. Add tests

### Phase 3: Node Detail Panel Tabs (2-3 days)
1. Create tabbed interface
2. Implement Request tab with JSON viewer
3. Implement Response tab
4. Implement Variables tab with diff highlighting
5. Implement Assertions tab
6. Add iteration selector dropdown
7. Handle "no full trace" gracefully
8. Add tests

### Phase 4: Iteration Matrix Table (2-3 days)
1. Create basic table structure
2. Add virtualization for large iteration counts
3. Implement color coding and icons
4. Add click handlers for row/cell selection
5. Add footer stats row
6. Add filtering and sorting
7. Add collapse/expand toggle
8. Add tests

### Phase 5: Polish & Integration (1 day)
1. Keyboard navigation (arrow keys, escape)
2. Loading states
3. Error handling
4. Performance testing with 1000+ iterations
5. Update documentation

---

## Files to Create/Modify

### New Files
- `src/features/results/components/WorkflowResultsExplorerModal.tsx`
- `src/features/results/components/ResultsExplorerDetailPanel.tsx`
- `src/features/results/components/ResultsExplorerTabs.tsx`
- `src/features/results/components/IterationMatrixTable.tsx`
- `src/features/results/components/JsonViewer.tsx` (reusable)
- `src/features/results/components/VariablesDiffTable.tsx`
- `src/styles/results-explorer.css`

### Modified Files
- `src/shared/types/index.ts` - new types
- `src/features/workflow/engine/traceCollector.ts` - capture full data
- `src/features/workflow/engine/graphRunner.ts` - pass full data to collector
- `src/features/test-runner/WorkflowRunner.tsx` - add toggle
- `src/features/test-runner/hooks/useWorkflowExecution.ts` - pass option
- `src/features/results/ResultsDashboard.tsx` - update button label

### Files to Delete (after migration)
- `src/features/results/components/WorkflowExecutionReplayModal.tsx`
- `src/features/results/components/WorkflowExecutionCanvas.tsx` (or keep and reuse)
- `src/features/results/components/NodeExecutionDetailPanel.tsx` (replace with new)

---

## Open Questions

1. **Response body size limit**: What's the max size to store? (suggest 100KB, truncate larger)
2. **Header filtering**: Should we filter sensitive headers (Authorization, cookies)?
3. **Export**: Should we allow exporting iteration data to CSV/JSON?
4. **Comparison mode**: Future enhancement - compare two iterations side by side?

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Trace Capture Toggle | ✅ Complete |
| Phase 2 | Left-Right Layout | ✅ Complete |
| Phase 3 | Detail Panel with Tabs | ✅ Complete |
| Phase 4 | Iteration Matrix Table | ✅ Complete |
| Phase 5 | Polish & Integration | ✅ Complete |
| Phase 5b | FitView & Canvas Layout Fix | ✅ Complete (May 7, 2026) |

### Phase 5b: FitView & Canvas Layout Fix (May 7, 2026)

**Problem**: FitView was not centering nodes correctly in the Results Explorer. Nodes appeared shifted left, controls overlapped the canvas, and compact node sizing was unreliable.

**Root Causes**:
1. Programmatic `fitView` with `setTimeout` was timing-dependent and unreliable across browsers
2. Controls bar (`ReplayControls`) inside ReactFlow canvas caused overlap with bottom nodes
3. CSS specificity issues — compact node styles not reliably applying due to workflow.css `min-width` overrides
4. Excessive `padding` in fitViewOptions created large gaps on wider screens

**Fixes Applied**:
- Switched to **declarative `fitView` prop** (matching the Workflow Designer approach)
- Moved `ReplayControls` to be a **sibling below ReactFlow** with `position: static`
- Added CSS `!important` rules on `.react-flow__node` to force 220px width constraint
- Set `fitViewOptions={{ padding: 0.01 }}` for minimal margin
- Widened detail panel (480px) to reduce diagram panel width and improve fill ratio
- Used `key={workflowId-layoutKey}` to force remount on trigger (same as Designer's `key={layoutVersion}`)

**Result**: Nodes fill 70%+ horizontal space and 95%+ vertical space, symmetrically centered.

### Files Created
- `src/features/results/components/WorkflowResultsExplorerModal.tsx` - Main modal component
- `src/features/results/components/ResultsExplorerDetailPanel.tsx` - Right panel with tabs
- `src/features/results/components/IterationMatrixTable.tsx` - Bottom matrix table
- `src/styles/results-explorer.css` - All styling

### Files Modified
- `src/shared/types/index.ts` - Added `ExecutionTraceOptions`, `CapturedHttpRequest`, `CapturedHttpResponse`, `AssertionResult`
- `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` - Added trace options context
- `src/features/workflow/engine/graphRunnerHttpHandler.ts` - Full trace capture logic
- `src/features/workflow/engine/graphRunner.ts` - Pass trace options
- `src/features/workflow/engine/graphLoadRunner.ts` - Forward trace options
- `src/features/test-runner/WorkflowRunner.tsx` - Trace capture toggle UI
- `src/engine/executor.ts` - Pass trace options
- `src/features/results/ResultsDashboard.tsx` - Updated to use new modal

---

## Success Criteria

- [x] User can toggle "Capture Full Trace" before execution
- [x] Left panel shows workflow diagram with pass/fail overlay
- [x] Right panel shows detailed request/response when node clicked
- [x] Bottom matrix shows all iterations with timing per node
- [x] Clicking iteration row updates diagram and detail panel
- [x] Works smoothly with 100+ iterations
- [x] Clear indication when full trace not captured
- [x] All existing tests pass
- [x] New tests cover new functionality
