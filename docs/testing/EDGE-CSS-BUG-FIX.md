# Critical Bug Fix: Missing Connection Lines in Workflow Designer

## Issue
User reported: "I think in designer, you removed all line connection between nodes."

**Symptom:** All connection lines (edges) between nodes disappeared in the Workflow Designer after implementing Phase 7e replay canvas.

## Root Cause

When adding CSS for the replay canvas edges, I accidentally created **global CSS rules with `!important`** that applied to ALL ReactFlow instances in the app, not just the replay canvas.

### Problematic Code (src/styles/workflow.css)

```css
/* This was GLOBAL - affected entire app! */
.react-flow__edge-path {
  stroke-width: inherit !important;
}

.react-flow__edge .react-flow__edge-path {
  stroke: inherit !important;
}

.react-flow__edge marker path {
  fill: inherit;
  stroke: none;
}
```

These rules overrode the Workflow Designer's default edge styling, causing edges to inherit `stroke: none` or become invisible.

## Fix Applied

**Scoped the CSS rules to only apply within the replay canvas container:**

```css
/* SCOPED - only affects replay canvas */
.workflow-execution-replay-canvas .react-flow__edge-path {
  stroke-width: inherit !important;
}

.workflow-execution-replay-canvas .react-flow__edge .react-flow__edge-path {
  stroke: inherit !important;
}

.workflow-execution-replay-canvas .react-flow__edge marker path {
  fill: inherit;
  stroke: none;
}
```

By prefixing with `.workflow-execution-replay-canvas`, these rules now **only apply to the replay modal**, leaving the Workflow Designer's edges unaffected.

## Files Modified

1. **`src/styles/workflow.css`** (lines ~6374-6386)
   - Added `.workflow-execution-replay-canvas` prefix to 3 edge CSS rules

## Impact

### Before Fix
- ❌ Workflow Designer: No visible edges between nodes
- ✅ Replay Canvas: Edges visible (but breaking Designer)

### After Fix
- ✅ Workflow Designer: All edges visible with correct styling
- ✅ Replay Canvas: Edges still visible with custom purple/gray styling

## Testing

### Manual Verification Steps

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Test Workflow Designer:**
   - Navigate to "Workflow Designer" (left sidebar)
   - Open any workflow (e.g., "Payment Processing")
   - **Verify:** All connection lines between nodes are visible
   - **Verify:** Lines have arrows at the end
   - **Verify:** Lines are gray/colored appropriately

3. **Test Replay Canvas:**
   - Run a workflow ("Run in Harness")
   - Go to "Results" tab
   - Click "⚡ Replay" button
   - **Verify:** All connection lines visible in replay modal
   - **Verify:** Purple lines for executed paths, gray for skipped

### Automated Tests

```bash
npx vitest run src/features/results/components/WorkflowExecutionCanvas.test.tsx
```

**Result:** ✅ All 12 tests pass

```bash
npx tsc --noEmit
```

**Result:** ✅ 0 TypeScript errors

## Lesson Learned

### CSS Scope Best Practices

1. **Never use global CSS rules with `!important`** for component-specific styling
2. **Always scope CSS to the component container** (e.g., `.workflow-execution-replay-canvas`)
3. **Test multiple instances** when using shared libraries like ReactFlow
4. **Avoid `inherit` without parent context** - can cause unexpected behavior

### Correct Pattern

```css
/* ❌ BAD - Global rule affects entire app */
.react-flow__edge-path {
  stroke-width: inherit !important;
}

/* ✅ GOOD - Scoped to specific component */
.my-component .react-flow__edge-path {
  stroke-width: inherit !important;
}
```

## Related Files

- **Plan:** `/docs/plan/phase-7e-visual-execution-replay.md`
- **Fit View Fix:** `/docs/testing/FITVIEW-FIX-SUMMARY.md`
- **Visual Testing:** `/docs/testing/HOW-TO-VISUALLY-TEST.md`

## Status

✅ **Fixed** - May 6, 2026  
✅ **Verified** - Workflow Designer edges restored  
✅ **Tested** - All unit tests pass  
✅ **No Regression** - Replay canvas still works correctly

---

**Priority:** Critical (broke core Designer functionality)  
**Severity:** High (completely hid edges in Designer)  
**Resolution Time:** ~5 minutes (CSS scoping fix)
