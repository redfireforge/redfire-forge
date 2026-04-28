# Server Crash Analysis - April 28, 2026

## Findings

### 1. Vite Dev Server Crash (Terminal 5)
- **Symptom**: Process terminated with `Killed: 9` signal
- **Port**: 5173
- **Last activity**: 1:10 PM (HMR updates to TestRunner.tsx, App.tsx, App.css)
- **Cause**: Signal 9 (SIGKILL) indicates forced termination, typically from:
  - OS Out-of-Memory (OOM) killer
  - Manual kill command
  - System resource exhaustion

### 2. Webhook Server Status
- **Port**: 3001
- **Status**: Not found in process list
- **Likely**: Also terminated or never started after recent git operations

### 3. Historical Context (Terminal 7)
- Earlier parse error from unresolved merge conflict in `CatalogEndpointBrowser.tsx`
- Conflict markers: `<<<<<<< HEAD`, `=======`, `>>>>>>> develop`
- **Resolution**: Conflict appears resolved in current working tree

### 4. Current System State
- Git status: Clean (no uncommitted changes or conflicts)
- TypeScript: Compilation succeeds (`npx tsc -b` completed without critical errors)
- Current branch: `feature/troubleshoot`
- Test suite: Last run had 1405/1405 passing

## Root Cause Assessment

**Most Likely**: Memory pressure during development session
- Vite dev server accumulates memory over time during HMR cycles
- Multiple file changes triggering rapid recompiles
- Large dependency graph (604 modules, 564KB bundle)
- Signal 9 is OS-level termination (not graceful shutdown)

## Recommendations

1. **Immediate**: Restart both servers
   - Vite dev server: `npm run dev`
   - Webhook server: `npm run serve` or `node src-server/index.js`

2. **Preventive**:
   - Monitor memory usage during long dev sessions (`top` or Activity Monitor)
   - Restart dev server periodically during heavy refactoring
   - Consider increasing Node.js heap: `NODE_OPTIONS="--max-old-space-size=4096" npm run dev`
   - Watch for HMR update storms (rapid file changes)

3. **Monitoring**:
   - Check for memory leaks in custom hooks or components
   - Review large component re-renders
   - Consider code splitting for large bundles (>500KB warning)

## Recovery Steps

1. ✅ Created `feature/troubleshoot` branch
2. ✅ Restart webhook server (port 3001) - `npm run server`
3. ✅ Restart Vite dev server (port 5173) - `npm run dev`
4. ✅ Verify both servers healthy
   - Webhook: http://127.0.0.1:3001 (PID 281, responding)
   - Vite: http://localhost:5173 (PID 1064, HTTP 200)
5. ⏳ Test UI in browser

## Status: RECOVERED ✅

Both servers successfully restarted and responding to requests.

### Next Steps
1. Open http://localhost:5173 in browser to verify UI loads
2. Monitor memory usage during session
3. Test workflow execution end-to-end
4. If issues persist, consider:
   - Increasing Node.js heap size
   - Enabling memory profiling
   - Reviewing recent code changes for memory leaks

---

## Modal Refactoring Session - April 28, 2026

### Issue Report
User reported Response Detail modal didn't follow standard pattern:
- Should have close and expand/shrink buttons in top right
- Badges should be in one row, not wrapping
- Expanded mode cut off right side

### Mistake Made
**Wrong approach (commits 1004a5b, b30706a, 4ee28cb)**:
- Misinterpreted "badges at top-right" as "move to header"
- Moved badges from body to headerActions prop
- Changed headerClassName to "ram-header"
- Lost original styled gray box design

### Root Cause
- Did NOT check original code first (`git show develop:path/to/file.tsx`)
- Assumed how it should work instead of understanding existing design
- Made structural changes instead of minimal feature additions

### Correct Fix (commit 5e6a6e1)
**Restored original layout with proper improvements**:
1. Badges back in BODY in `.response-detail-meta` styled box
2. Changed `flex-wrap: wrap` → `flex-wrap: nowrap`
3. Added `overflow-x: auto` with styled scrollbar
4. Kept expand/close button functionality (`initialExpanded`, `expandMode`)
5. Kept expanded mode overflow fix (`height: 100%`, `flex: 1`, `min-height: 0`)

### Lesson Learned
**Always check git history FIRST before refactoring**:
```bash
git show develop:path/to/file.tsx
git show develop:path/to/file.css
```

**Documented in**: `/memories/repo/modal-patterns.md`
- Don't move content between header/body/footer unless explicitly requested
- Minimal changes only - add feature, don't restructure
- Respect existing styled layouts and design patterns

### Files Changed
- `src/features/requests/components/ResponseDetailModal.tsx`
- `src/styles/test-runner.css`
- `/memories/repo/modal-patterns.md` (lesson documented)

### Final State
- Badges: In body, one row, horizontal scroll if needed
- Header: Standard title + expand/shrink + close buttons
- Expanded mode: Proper overflow handling, no cut-off
- Design: Original styled gray box preserved

---

## Second Round of Fixes - April 28, 2026

### Issues Reported
User found three more problems after initial fix (commit 5e6a6e1):
1. Expected one row with "Response Detail" + expand/shrink + close
2. Badge box color very similar to background (hard to see)
3. Expanded mode: Right-edge scrollbar not visible (used to work)

### Root Cause Analysis
**Broke during refactoring** (commit 5e6a6e1):
- Removed `headerClassName` prop → lost explicit header styling
- Didn't check expanded mode scrollbar behavior
- Badge box color (var(--surface)) too similar to modal body

### Fixes Applied (commit ad40ba3)

**1. Header Layout**:
```tsx
<AppModalFrame headerClassName="response-detail-header" />
```
```css
.response-detail-header {
  display: flex;
  justify-content: space-between;  /* Title left, controls right */
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
```

**2. Badge Contrast**:
```css
.response-detail-meta {
  background: rgba(255, 255, 255, 0.03);  /* Was: var(--surface) */
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```
Subtle tint provides better visual separation from background.

**3. Expanded Mode Scrollbar**:
```css
/* Normal: thin 5px scrollbar */
.response-detail-body::-webkit-scrollbar { width: 5px; }

/* Expanded/fullscreen: wider 10px visible scrollbar */
.modal-fullscreen .response-detail-body::-webkit-scrollbar,
.modal-expanded .response-detail-body::-webkit-scrollbar {
  width: 10px;
  display: block;
}
```
Pattern copied from workflow modals (workflow.css lines 4093-4118).

### Lessons Reinforced
1. **Always check working examples**: Workflow modals already had scrollbar pattern
2. **Test all states**: Normal AND expanded mode
3. **Explicit styling**: Don't rely on default props for critical layout
4. **Color contrast**: Use rgba() tints or var(--bg) instead of var(--surface) for info boxes

### Documentation
Added to `/memories/repo/modal-patterns.md`:
- Expanded mode scrollbar pattern
- Header layout pattern with explicit className
- Color contrast guidelines for info boxes

### Status
All three issues fixed. Ready for testing.
