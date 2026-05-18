# Results Explorer Guide

The Results Explorer is a full-screen visual analysis tool for workflow execution results. After running a workflow, it shows the execution flow on an interactive diagram with pass/fail overlays, detailed node inspection, and an iteration-by-iteration matrix.

## Opening the Results Explorer

1. Run a workflow in the **Workflow Runner** tab
2. After the run completes, go to the **Results Dashboard**
3. Select the run from the history dropdown
4. Click the **📊 Results Explorer** button

> The button only appears for workflow runs that include an execution trace.

## Layout

The Results Explorer has three panels:

| Panel | Position | Content |
|-------|----------|---------|
| **Workflow Diagram** | Left | Interactive React Flow canvas showing nodes and edges with execution state |
| **Detail Panel** | Right | Tabbed view of the selected node's execution data |
| **Iteration Matrix** | Bottom (collapsible) | Table with rows = iterations, columns = HTTP nodes |

## Workflow Diagram

### Node Colors

| Color | Meaning |
|-------|---------|
| **Green** border + background | All executions passed |
| **Red** border + background | At least one execution failed |
| **Gray** dashed border | Node was never executed (skipped path) |
| **Purple** border | Currently selected node |

### Heatmap Overlay

When 2+ nodes have timing data, nodes are additionally colored on a gradient:
- **Green** = fastest avg response time
- **Yellow/Orange** = moderate
- **Red** = slowest avg response time

A 4px colored bar appears at the bottom of each node.

### Edge Highlighting

- **Traversed edges**: Solid purple with animated flowing dash indicating flow direction
- **Not traversed**: Gray dashed line
- **Branching edges**: Show traversal percentage labels (e.g., "67%") in aggregate view

### Bottleneck Indicators

Nodes identified as bottlenecks get a pulsing border:
- **Critical** (red pulse): Time-dominant nodes (≥40% of total execution time)
- **Warning** (orange pulse): High-variance nodes (coefficient of variation > 0.5)
- **Info** (blue pulse): High-failure nodes (≥20% failure rate)

Hover over a bottleneck node to see the specific insight and optimization suggestion.

### Canvas Controls

The pill-shaped control bar at the bottom provides:

| Button | Action |
|--------|--------|
| **+** / **−** | Zoom in / out |
| **Fit** | Fit all nodes to viewport |
| **Save** (floppy icon) | Save current node positions to local storage |
| **Minimap** | Toggle the minimap overlay |

### Save Layout

Drag nodes to arrange them however you like, then click the **Save** button. Next time you open the Results Explorer for the same workflow, your custom layout is automatically restored.

## Search & Filter

At the top of the diagram panel is a search and filter toolbar.

### Search by Name

Type in the search bar to filter nodes by label. Non-matching nodes are dimmed (low opacity). Press `/` from anywhere in the modal to focus the search bar. Press `Escape` while in the search bar to clear it.

### Filter by State

Click the filter buttons to show only nodes matching a specific state:

| Button | Effect |
|--------|--------|
| **All** | Show all nodes (default) |
| **Pass (N)** | Dim non-passing nodes |
| **Fail (N)** | Dim non-failing nodes |
| **Skip (N)** | Dim non-skipped nodes |

Click an active filter again to reset to All. Search and state filter can be combined.

## Detail Panel

Click any node on the diagram to open the detail panel on the right.

### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Hero stats (pass rate, execution count, avg duration), status breakdown bar, timing stats (min/max/P95), per-iteration breakdown |
| **Request** | HTTP method, URL, headers, request body (via collapsible JSON tree) |
| **Response** | Status code, response headers, response body (via collapsible JSON tree) |
| **Variables** | Input variables at node entry, extracted variables from response |
| **Assertions** | Assertion results with pass/fail status per assertion |

> **Note:** The Request, Response, Variables, and Assertions tabs require **"Capture Full Trace"** to be enabled in the Workflow Runner config before the run.

## Iteration Matrix

For multi-iteration runs (>1 iteration), a collapsible matrix table appears at the bottom.

### Matrix Features

- **Rows** = iterations, **Columns** = HTTP nodes
- Cell colors indicate pass (green) / fail (red) / skipped (gray) with duration
- Click any cell to jump to that iteration + node on the diagram
- **Sort** by iteration number, status, total duration, or per-node duration
- **Filter**: All, Failed Only, Slowest 10%
- **Error search**: Text filter on error messages
- **Overhead column**: Shows non-HTTP time (delay, condition nodes)

Press **M** to toggle the matrix panel.

## Iteration Navigation

### Aggregate vs Single Iteration

- **Aggregate view** (default for multi-iteration): Shows combined metrics across all iterations
- **Single iteration**: Shows data for one specific iteration

### Navigation Methods

| Method | Action |
|--------|--------|
| **Iteration Picker** dropdown | Select specific iteration with filter tabs (All / Failed / Slowest) |
| **← / →** keys | Previous / next iteration |
| **1–9** keys | Jump directly to iteration N |
| **Space** | Toggle between aggregate and iteration #1 |
| **A** | Return to aggregate view |

## Export & Import

### Export

| Button | Output |
|--------|--------|
| **⬇ Export JSON** | Full execution trace as a `.json` file |
| **📊 Export CSV** | Per-HTTP-node aggregate metrics (executions, pass rate, avg, min, max, P95) |

### Import

In the Results Dashboard, click **📂 Import Trace** to load a previously exported trace JSON file. The Results Explorer opens with an "Imported" badge. Imported traces are session-only (not persisted).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `← / →` | Previous / next iteration |
| `1` – `9` | Jump to iteration N |
| `Space` | Toggle aggregate ↔ iteration #1 |
| `A` | Return to aggregate view |
| `M` | Toggle iteration matrix |
| `/` | Focus search bar |
| `Escape` | Clear search → deselect node → close modal (in order) |

## Bottleneck Analysis Panel

When no node is selected, the right panel shows summary statistics and a **Bottleneck Analysis** section (if bottlenecks are detected). Each insight card shows:

- Node name and severity (critical / warning / info)
- Description of the issue
- Optimization suggestion
- Key metric (e.g., "Time share: 45%")

Click an insight card to select that node on the diagram.

## Tips

- **Enable Full Trace** before running to get request/response details in the Detail Panel
- **Use search** to quickly find nodes in large workflows (30+ nodes)
- **Use Fail filter** to focus on problem areas
- **Save your layout** after arranging nodes — it persists across sessions
- **Use the matrix** to spot patterns: click column headers to sort by a specific node's duration
- **Export CSV** for reporting — paste into spreadsheets for stakeholder review

## Related Guides

- [Workflow Runner Guide](./workflow-runner-guide.md) — Running workflows as performance tests
- [Results Guide](./results-guide.md) — Results Dashboard overview
- [Keyboard Shortcuts](./keyboard-shortcuts.md) — All keyboard shortcuts
