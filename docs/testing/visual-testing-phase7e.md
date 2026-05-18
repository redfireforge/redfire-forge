# Visual Testing Guide: Phase 7e Execution Replay

## Overview
This guide explains how to visually test the new **Visual Execution Replay** feature (Phase 7e) in RedfireForge.

## Prerequisites
1. The dev server must be running: `npm run dev`
2. You need at least one workflow created in the Workflow Designer
3. The workflow should have been executed at least once (after Phase 7e implementation)

## Step-by-Step Visual Testing

### 1. Run a Workflow
1. Open the app in your browser: `http://localhost:5173`
2. Navigate to **Workflow Designer** (left sidebar)
3. Open an existing workflow or create a simple test workflow:
   - Add a few HTTP nodes
   - Add a Condition node
   - Connect them
4. Click **Save** to save the workflow
5. Click **Run in Harness** to execute it
6. The Test Runner will execute your workflow and capture execution trace data

### 2. View Results Dashboard
1. After the workflow completes, navigate to **Results Dashboard** (left sidebar)
2. You should see your workflow run in the runs list
3. Select the workflow run from the dropdown (marked with ⚡)

### 3. Open Visual Replay
1. In the Results Dashboard, look for the **⚡ Replay** button at the top
   - This button only appears for workflow runs that have execution trace data
   - If you don't see it, the run doesn't have trace data (was run before Phase 7e)
2. Click the **⚡ Replay** button
3. A full-screen modal should open showing the workflow diagram

### 4. What to Look For

#### Modal Header
- Workflow name
- Timestamp of execution
- Number of iterations (e.g., "1 iteration" or "5 iterations")

#### Canvas View
- **Workflow diagram** rendered with all nodes and edges
- **Node styling** indicating execution state:
  - 🟢 **Pass (Green)**: 
    - Green border with glow effect
    - Green checkmark badge (✓) in top-right corner
    - Subtle green gradient background
  - 🔴 **Fail (Red)**: 
    - Red border with glow effect
    - Red X badge (✕) in top-right corner
    - Subtle red gradient background
  - ⚪ **Skipped (Gray)**: 
    - Gray border, reduced opacity
    - Gray minus badge (−) in top-right corner
    - Indicates node was not executed
- **Edge highlighting**:
  - **Traversed edges**: Purple/accent color with animated pulse effect
  - **Not traversed edges**: Faded gray, dashed line
- **Interactive controls**:
  - Zoom in/out (mouse wheel or + - buttons)
  - Pan (click and drag)
  - Fit view button
  - Minimap in bottom-right corner with colored node indicators

#### Node Selection (Phase 7e Task 2.2)
- Click on a node to select it
- Selected node should have a distinct border/highlight
- Node execution details should be visible (in future Phase 7e tasks)

#### Modal Footer
- **Total Duration**: Shows total execution time in milliseconds
- **Close** button to exit the modal

### 5. Test Different Scenarios

#### Scenario A: Single Iteration Success
1. Create a simple workflow with 3-4 HTTP nodes (all returning 200 OK)
2. Run with 1 iteration
3. Open replay → all nodes should be green

#### Scenario B: Single Iteration with Failure
1. Create a workflow with an HTTP node pointing to a bad URL
2. Run it
3. Open replay → failed node should be red, subsequent nodes may be skipped (gray)

#### Scenario C: Conditional Logic
1. Create a workflow with a Condition node
2. Set condition to true/false
3. Run it
4. Open replay → observe which branch was taken (traversed edges)

#### Scenario D: Multiple Iterations
1. Create a simple workflow
2. Run it with 5 iterations (set in Test Runner config)
3. Open replay → verify iteration count in header
4. Note: Currently shows aggregated state (all iterations combined)

#### Scenario E: Complex Workflow
1. Use a workflow with 10+ nodes, forks, joins, loops
2. Run it
3. Open replay → verify large diagrams render correctly
4. Test zoom, pan, minimap navigation

### 6. Keyboard Shortcuts
- **Escape**: Deselect node, or close modal if no node selected
- **← / →**: Navigate previous / next iteration
- **1–9**: Jump directly to iteration N
- **Space**: Toggle between aggregate view and iteration #1
- **A**: Return to aggregate view
- **M**: Toggle iteration matrix panel

### 7. Browser DevTools Check
Open browser DevTools (F12) and check:
- **Console**: No errors should appear
- **Network**: Verify no failed requests
- **React DevTools** (if installed): Inspect component state

## Known Limitations
- No timeline scrubber or step-through animation controls
- No screenshot export of canvas view
- Heatmap coloring by performance intensity not yet implemented
- Imported traces are session-only (not persisted)

## Troubleshooting

### "⚡ Replay" button doesn't appear
- **Cause**: Selected run has no `executionTrace` data
- **Fix**: Run a workflow after Phase 7e implementation. Old runs won't have trace data.

### Modal opens but canvas is blank
- **Cause**: Trace data structure mismatch or missing nodes/edges
- **Fix**: Check browser console for errors, verify trace data in run object

### Nodes are all gray
- **Cause**: No events recorded or all nodes skipped
- **Fix**: Verify workflow actually executed, check execution logs

### Canvas is not responsive to mouse
- **Cause**: ReactFlow initialization issue
- **Fix**: Refresh page, check for JavaScript errors

## Completed Features
- ✅ **Phase 1**: Trace data model & capture
- ✅ **Phase 2**: Basic replay UI with ReactFlow canvas
- ✅ **Phase 3**: Node detail panel with tabbed view (Overview/Request/Response/Variables/Assertions)
- ✅ **Phase 4**: Multi-iteration support with iteration matrix
- ✅ **Phase 5**: Polish & optimization (17/17 items — compression, sampling, lazy loading, tooltips, export/import, edge traversal percentages, animated edges, CSV export, keyboard shortcuts)

## Files to Monitor
- `src/features/results/ResultsDashboard.tsx` - Replay button integration
- `src/features/results/components/WorkflowExecutionReplayModal.tsx` - Modal container
- `src/features/results/components/WorkflowExecutionCanvas.tsx` - Diagram rendering
- `src/shared/types/index.ts` - Trace data model
- Browser localStorage or Tauri storage - TestRun data with trace

## Success Criteria
✅ Replay button appears for workflow runs with trace data  
✅ Modal opens full-screen when button is clicked  
✅ Workflow diagram renders correctly  
✅ Node colors reflect execution state (pass/fail/skipped)  
✅ Edges show traversal state  
✅ Zoom, pan, minimap controls work  
✅ Modal closes on Escape or Close button  
✅ No console errors during normal operation  

---

**Last Updated**: May 6, 2026  
**Phase**: 7e - Visual Execution Replay (Phase 2 Complete - Tasks 2.1-2.4 Done)
