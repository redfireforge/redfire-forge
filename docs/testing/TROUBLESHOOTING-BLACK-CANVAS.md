# Troubleshooting: Black Canvas in Replay Modal

## Issue
When clicking the "⚡ Replay" button, the modal opens but shows a completely black/empty canvas instead of the workflow diagram.

## Root Causes & Fixes

### 1. Missing ReactFlow CSS ✅ FIXED
**Problem**: ReactFlow styles weren't imported in the canvas component.

**Solution**: Added `import '@xyflow/react/dist/style.css';` to `WorkflowExecutionCanvas.tsx`

### 2. Missing Full Panel Modal CSS ✅ FIXED
**Problem**: `.full-panel-modal` and `.wf-config-modal-body` didn't have proper flexbox layout for full-height rendering.

**Solution**: Added CSS rules in `workflow.css`:
```css
.full-panel-modal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.full-panel-modal .wf-config-modal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0; /* Critical for flex child */
}
```

### 3. Custom Node Types Registered ✅ FIXED
**Problem**: Replay canvas was using default ReactFlow nodes (simple boxes) instead of the rich custom node components from Workflow Designer.

**Solution**: Added `nodeTypes` import from `workflowNodeFactory.ts` and passed it to `<ReactFlow>` component.

**Result**: Replay now shows the **same beautiful node designs** as the Workflow Designer (blue headers, detailed content, colored badges, etc.).

## How to Verify the Fix

1. **Refresh your browser** (Hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. Navigate to **Results Dashboard**
3. Select a workflow run (marked with ⚡)
4. Click **⚡ Replay** button
5. You should now see:
   - Workflow diagram with nodes and edges
   - Colored nodes (green/red/gray)
   - Purple edges for executed paths
   - Zoom/pan controls
   - Minimap in bottom-right

## If Canvas is Still Black

### Check 1: Browser Console
Open DevTools (F12) → Console tab

**Look for**:
- JavaScript errors (red text)
- "container needs a width and a height" warnings

### Check 2: Inspect Element
Right-click on black area → Inspect

**Check these elements**:
```html
<div class="workflow-execution-replay-canvas" style="height: 100%; width: 100%;">
  <div style="width: 100%; height: 100%;">
    <div class="react-flow">...</div>
  </div>
</div>
```

**Verify**:
- `.workflow-execution-replay-canvas` has **computed height** > 0px
- Inner divs inherit height properly
- `.react-flow` element exists

### Check 3: Test Data
Open console and run:
```javascript
// Find the TestRun object
const runs = JSON.parse(localStorage.getItem('testRuns') || '[]');
const workflowRun = runs.find(r => r.config.executionMode === 'workflow');
console.log('Trace:', workflowRun?.executionTrace);
```

**Expected**:
```javascript
{
  workflowId: "...",
  workflowName: "...",
  iterations: [{...}],
  workflowSnapshot: {
    nodes: [{id: "n1", type: "http", ...}],
    edges: [{id: "e1", source: "n1", target: "n2"}]
  }
}
```

**If missing**: The workflow was run before Phase 1 trace capture was implemented. Run it again.

### Check 4: Dev Server
Ensure dev server restarted after new files were created:

```bash
# Kill old server
pkill -f "vite"

# Start fresh
npm run dev
```

## Common Scenarios

### Scenario A: Nodes appear but have no color
**Cause**: CSS not loaded or wrong class names

**Fix**: Check browser DevTools → Elements → find a node element and verify it has classes like `replay-node-pass`, `replay-node-fail`, etc.

### Scenario B: "Node type 'http' not found" warnings
**Cause**: ReactFlow doesn't know about custom node types

**Impact**: None - this is expected. Nodes still render correctly with default appearance + CSS styling.

### Scenario C: Canvas renders but is tiny (not full-screen)
**Cause**: Modal height CSS not applied

**Fix**: Verify `.full-panel-modal` has `height: 100vh` and body has `flex: 1` in DevTools.

## Expected Browser Console Warnings (Non-Critical)

These warnings are **expected** and don't break functionality:

```
[React Flow]: Node type "http" not found. Using fallback type "default".
[React Flow]: Node type "condition" not found. Using fallback type "default".
[React Flow]: Couldn't create edge for source handle id: "body"
```

**Why**: The replay canvas uses raw workflow data with custom types/handles. For Phase 2, we use defaults and CSS styling instead of full custom components.

---

## Files Modified in Fix

1. `src/features/results/components/WorkflowExecutionCanvas.tsx`
   - Added ReactFlow CSS import

2. `src/styles/workflow.css`
   - Added `.full-panel-modal` layout styles
   - Added `.wf-config-modal-body` flex styles
   - Updated `.workflow-execution-replay-canvas` with `flex: 1`

---

**Last Updated**: May 6, 2026  
**Status**: Fixed and deployed
