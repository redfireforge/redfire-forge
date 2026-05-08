# 🚀 How to Visually Test Phase 7e: Visual Execution Replay

## Quick Start (5-Minute Test)

### 1. Start the App
```bash
npm run dev
```
Open browser to: `http://localhost:5173`

### 2. Run a Test Workflow
1. Navigate to **Workflow Designer** (left sidebar)
2. Create or open a workflow
3. Click **Run in Harness** button
4. Wait for execution to complete

### 3. View the Replay
1. Navigate to **Results Dashboard** (left sidebar)
2. Find your workflow run (marked with ⚡)
3. Click the **⚡ Replay** button at the top
4. 🎉 **You should now see the full-screen visual replay!**

---

## What You Should See

### 📊 Modal Layout
```
┌─────────────────────────────────────────────────┐
│ Workflow Name                                   │
│ Execution Replay • Timestamp • N iterations     │
├─────────────────────────────────────────────────┤
│                                                 │
│          [Workflow Diagram Canvas]              │
│                                                 │
│   • Green nodes = Passed                        │
│   • Red nodes = Failed                          │
│   • Gray nodes = Skipped                        │
│   • Purple edges = Executed path                │
│                                                 │
│   Controls: Zoom, Pan, Minimap                  │
│                                                 │
├─────────────────────────────────────────────────┤
│ Total Duration: XXXms            [Close]        │
└─────────────────────────────────────────────────┘
```

### 🎨 Visual Indicators

#### Nodes (Same Rich Design as Workflow Designer!)
- **Full custom node components** with:
  - Blue headers showing node type
  - Detailed content (URLs, conditions, delays, etc.)
  - Colored status badges
  - Request/scenario names
  
- **Execution state overlay**:
  - ✅ **Pass**: Green border, green glow, checkmark badge
  - ❌ **Fail**: Red border, red glow, X badge  
  - ⊝ **Skip**: Gray border, faded, minus badge

#### Edges (Connections)
- **Executed**: Bright purple, animated pulse
- **Not executed**: Faded gray, dashed

#### Interactive Elements
- **Minimap**: Bottom-right corner, colored dots show node states
- **Zoom controls**: Bottom-left corner (+ / − / fit)
- **Node selection**: Click a node to select (purple outline)

---

## Test Scenarios

### ✅ Scenario 1: All Passing
**Goal**: See all green nodes

1. Create workflow with 3-4 HTTP nodes
2. Point them to reliable endpoints (e.g., `https://httpbin.org/get`)
3. Run the workflow
4. Open replay → Verify all nodes are green with checkmarks

**Expected**:
- All nodes green
- All connecting edges bright purple
- No red or gray nodes

---

### ❌ Scenario 2: Failure Path
**Goal**: See red failed node

1. Create workflow with 2 HTTP nodes
2. Set first node to valid URL
3. Set second node to invalid URL (`https://invalid.example.test`)
4. Run the workflow
5. Open replay → First node green, second node red

**Expected**:
- First node: Green (passed)
- Second node: Red (failed)
- Edge to failed node: Traversed (purple)

---

### 🔀 Scenario 3: Conditional Branch
**Goal**: See which branch was taken

1. Create workflow:
   ```
   Start → HTTP → Condition → Fork A / Fork B
   ```
2. Set condition to true/false
3. Run the workflow
4. Open replay → See only one branch lit up

**Expected**:
- Condition node: Green or red based on result
- Only executed branch edges: Purple
- Non-executed branch edges: Gray, dashed

---

### 🔄 Scenario 4: Multiple Iterations
**Goal**: Verify aggregated state

1. Create simple workflow (2-3 nodes)
2. In Test Runner config, set **Iterations: 5**
3. Run the workflow
4. Open replay → Header shows "5 iterations"

**Expected**:
- Header shows correct iteration count
- Nodes show aggregated state (if any iteration failed, node appears red)
- Duration shows total time across all iterations

---

### 🌐 Scenario 5: Large Complex Workflow
**Goal**: Test canvas performance

1. Create workflow with 10-15 nodes
2. Add forks, joins, loops
3. Run the workflow
4. Open replay → Test zoom, pan, minimap

**Expected**:
- Canvas renders without lag
- Zoom/pan smooth
- Minimap shows entire workflow
- Node states clearly visible even when zoomed out

---

## Interaction Testing

### Mouse/Touch
- ✅ Click node → Node gets purple selection border
- ✅ Click background → Deselects node
- ✅ Scroll wheel → Zoom in/out
- ✅ Click + drag → Pan canvas
- ✅ Click minimap → Jump to that area

### Keyboard
- ✅ Press `Escape` → Modal closes
- ✅ (Future) Arrow keys → Navigate nodes

### Controls
- ✅ Click `+` button → Zoom in
- ✅ Click `−` button → Zoom out
- ✅ Click fit button → Auto-fit to view
- ✅ Click `Close` → Modal closes

---

## Troubleshooting

### ❓ "⚡ Replay" button doesn't appear
**Problem**: Selected run has no execution trace data

**Solutions**:
1. Only workflow runs show the button (not regular test runs)
2. Workflow must have been run **after** Phase 7e implementation
3. Check browser console for trace data errors

### ❓ Modal opens but canvas is blank
**Problem**: Trace data missing or malformed

**Solutions**:
1. Open browser DevTools (F12) → Console tab
2. Look for ReactFlow errors or missing data warnings
3. Verify workflow has nodes/edges saved
4. Try refreshing the page

### ❓ All nodes are gray
**Problem**: No execution events recorded

**Solutions**:
1. Verify workflow actually ran (check Results Dashboard for results)
2. Check if workflow has any nodes
3. Ensure `traceCollector` is capturing events (check code)

### ❓ Canvas doesn't respond to clicks
**Problem**: ReactFlow not initialized

**Solutions**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear localStorage: `localStorage.clear()` in console
3. Check for JavaScript errors in console

---

## Browser DevTools Checks

### Console Tab
✅ Should see: No errors  
❌ Watch for: ReactFlow errors, trace data warnings

### Network Tab
✅ Should see: No failed requests  
❌ Watch for: 404s or 500s

### Application Tab → Local Storage
✅ Should see: `TestRun` objects with `executionTrace` field  
Example:
```json
{
  "id": "run-123",
  "workflowName": "My Workflow",
  "executionTrace": {
    "iterations": [...],
    "workflowSnapshot": {...}
  }
}
```

---

## File Reference

### Where Things Live
| Component | File Path |
|-----------|-----------|
| Replay Button | `src/features/results/ResultsDashboard.tsx` |
| Modal Container | `src/features/results/components/WorkflowExecutionReplayModal.tsx` |
| Canvas/Diagram | `src/features/results/components/WorkflowExecutionCanvas.tsx` |
| CSS Styles | `src/styles/workflow.css` (bottom section) |
| Data Model | `src/shared/types/index.ts` (WorkflowExecutionTrace) |
| Trace Capture | `src/features/workflow/engine/traceCollector.ts` |

### Key Classes to Inspect in DevTools
- `.workflow-execution-replay-canvas` - Canvas container
- `.replay-node-pass` - Passed nodes
- `.replay-node-fail` - Failed nodes
- `.replay-node-skipped` - Skipped nodes
- `.replay-node-selected` - Selected node
- `.replay-edge-traversed` - Executed edges

---

## Success Checklist

**Phase 2 is working correctly if you can:**
- ✅ See the "⚡ Replay" button for workflow runs
- ✅ Open the modal by clicking the button
- ✅ See the workflow diagram with colored nodes
- ✅ **All nodes visible on load** (bottom nodes like "Done" not cut off)
- ✅ **Drag individual nodes** to reposition them for better viewing
- ✅ Green nodes for passed, red for failed, gray for skipped
- ✅ Purple edges for executed paths, gray for skipped
- ✅ **Fit view button works** (shows all nodes with minimal padding)
- ✅ Zoom in/out with mouse or buttons (min: 10%, max: 200%)
- ✅ Pan the canvas with click+drag
- ✅ Click nodes to select them (purple border)
- ✅ See minimap in bottom-right with colored indicators
- ✅ **Toggle minimap** button hides/shows the minimap
- ✅ Close modal with Escape or Close button
- ✅ No console errors during normal use

---

## Known Limitations (Phase 2 Scope)

**Not Yet Implemented** (coming in Phase 3+):
- Iteration-by-iteration playback (currently shows aggregated state)
- Node hover tooltips with execution details
- Timeline scrubber to step through execution
- Node detail panel showing request/response data
- Filtering nodes by state (pass/fail/skip)
- Export replay as video or animated GIF
- Trace compression for very large workflows

---

## Next Phase Preview

**Phase 3** will add:
- Iteration selector dropdown (switch between iteration 1, 2, 3...)
- Timeline slider to scrub through execution
- Node detail panel on selection (status code, duration, variables)

**Phase 4** will add:
- Compression for large traces (>1000 events)
- Performance optimizations for 50+ node workflows

---

## Questions?

If visual testing reveals bugs:
1. Note the exact scenario that failed
2. Capture browser console output
3. Export the TestRun JSON (Export JSON button)
4. Share with the team

---

**Last Updated**: May 6, 2026  
**Phase Completed**: 7e Phase 2 (Tasks 2.1–2.4)  
**Status**: ✅ Ready for Visual Testing
