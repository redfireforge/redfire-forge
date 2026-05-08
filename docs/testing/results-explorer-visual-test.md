# Results Explorer - Visual Testing Guide

## Quick Start

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open the app at `http://localhost:5173`

3. Navigate to **Workflows** tab

4. Select or create a workflow with multiple HTTP nodes (e.g., at least 2-3 HTTP requests)

---

## Test Scenarios

### Scenario 1: Basic Workflow Run (Without Full Trace)

1. **Setup**: Go to Workflows → Select a workflow → Click "Run in Harness"

2. **Configure**:
   - Set Iterations > 1 (e.g., 5 iterations)
   - Leave "Capture Full Trace" **unchecked**

3. **Execute**: Click "Run Workflow"

4. **After completion**: Go to Results tab → Click "📊 Results Explorer" button

5. **Verify**:
   - ✅ Modal opens with left-right split layout
   - ✅ Left side shows workflow diagram with node status colors
   - ✅ Right side shows "Select a Node" empty state with summary stats
   - ✅ Bottom shows "Iteration Matrix" with all iterations
   - ✅ Header shows workflow name, "Results Explorer" subtitle, timestamp, pass rate

---

### Scenario 2: Explore Node Details

1. **In Results Explorer modal**: Click on an HTTP node in the diagram

2. **Verify right panel**:
   - ✅ Shows node type (HTTP) and label
   - ✅ Quick stats: pass rate, execution count, avg duration
   - ✅ Tabs: Overview, Request, Response, Variables, Assertions
   - ✅ Request/Response/Variables tabs are **disabled** (no full trace)
   - ✅ Overview tab shows:
     - Hero stats (pass rate, executions, avg duration)
     - Status bar (green/red proportional bar)
     - Timing stats (min/avg/max)
     - Per-iteration breakdown list

3. **Click on an iteration** in the per-iteration list → Verify iteration selector changes

4. **Click close button** (✕) → Verify right panel shows empty state again

---

### Scenario 3: Full Trace Capture

1. **Go back to Workflow Runner**

2. **Enable "Capture Full Trace"** checkbox
   - ⚠️ Warning should appear about memory usage

3. **Run workflow** again (e.g., 3 iterations)

4. **Open Results Explorer**

5. **Click on an HTTP node**

6. **Verify Request Tab**:
   - ✅ Tab is now enabled
   - ✅ Shows method + URL
   - ✅ Shows headers (if any)
   - ✅ Shows request body (if any)
   - ✅ Toggle between "Template" and "Resolved" body if different

7. **Verify Response Tab**:
   - ✅ Tab is enabled
   - ✅ Shows status code with color (green < 400, red >= 400)
   - ✅ Shows response headers
   - ✅ Shows response body (JSON formatted)
   - ✅ "Truncated" badge if body was too large

8. **Verify Variables Tab**:
   - ✅ Tab is enabled
   - ✅ Shows "Extracted by This Node" section (if node extracts variables)
   - ✅ Shows "All Variables (after this node)" with all variables at that point
   - ✅ Newly extracted variables highlighted with "new" badge

9. **Verify Assertions Tab**:
   - ✅ Shows assertion count (X of Y passed)
   - ✅ Each assertion shows type, description, expected/actual values
   - ✅ Pass/fail icons for each assertion

---

### Scenario 4: Iteration Matrix Table

1. **Run workflow** with 10+ iterations (some should fail if possible)

2. **Open Results Explorer**

3. **Verify Matrix Table**:
   - ✅ Column headers: Iter, [each HTTP node], Total, Status, Error
   - ✅ Each row shows iteration number, timing per node, total, status icon
   - ✅ Failed rows highlighted in red
   - ✅ Footer shows AVG row

4. **Test Filter Buttons**:
   - Click "Failed (N)" → Only failed iterations shown
   - Click "Slowest 10%" → Only slowest iterations shown
   - Click "All (N)" → All iterations shown

5. **Test Sorting**:
   - Click "Status" column → Verify sort direction toggles
   - Click a node column → Verify sorts by that node's duration
   - Click "Total" column → Verify sorts by total duration

6. **Test Search** (only visible if failures exist):
   - Type in "Search errors..." field
   - Verify matching iterations shown, count displayed

7. **Test Cell Click**:
   - Click a cell in the matrix → Verify both iteration AND node are selected
   - Diagram should highlight the node, detail panel shows that node

8. **Test Row Click**:
   - Click on a row's iteration number (#N) → Verify only iteration changes

9. **Test Collapse/Expand**:
   - Click matrix header → Matrix collapses
   - Click again → Matrix expands

---

### Scenario 5: Keyboard Navigation

1. **With Results Explorer open** (multi-iteration):

2. **Test iteration navigation**:
   - Press `←` → Previous iteration
   - Press `→` → Next iteration
   - Press `A` → Aggregate view (all iterations)

3. **Test matrix toggle**:
   - Press `M` → Collapse/expand matrix

4. **Test escape**:
   - With node selected: Press `Escape` → Node deselected
   - Without node selected: Press `Escape` → Modal closes

---

### Scenario 6: Edge Cases

1. **Single iteration workflow**:
   - Run workflow with 1 iteration
   - Verify matrix is hidden (not needed for single iteration)
   - Verify iteration selector not shown in detail panel

2. **All pass**:
   - Run workflow where all iterations pass
   - Verify "Failed" filter button disabled
   - Verify no error search box
   - Verify pass rate shows 100% (green)

3. **All fail**:
   - Run workflow where all iterations fail
   - Verify pass rate shows 0% (red)
   - Verify error column populated

4. **Large response** (if possible):
   - Make a request that returns > 100KB response
   - With full trace enabled, verify "Truncated" badge appears

---

## Success Checklist

- [ ] Left-right split layout renders correctly
- [ ] Workflow diagram shows with correct node states
- [ ] Empty state shows when no node selected
- [ ] Detail panel updates when node clicked
- [ ] Tabs work correctly (disabled without full trace, enabled with)
- [ ] Request tab shows method, URL, headers, body
- [ ] Response tab shows status, headers, body
- [ ] Variables tab shows extracted and all variables
- [ ] Assertions tab shows pass/fail status
- [ ] Matrix table renders all iterations
- [ ] Filter buttons work (All, Failed, Slowest 10%)
- [ ] Sorting works for all columns
- [ ] Error search filters correctly
- [ ] Cell click selects iteration AND node
- [ ] Collapse/expand matrix works
- [ ] Keyboard shortcuts work (← → navigate, 1-9 jump, Space toggle, A aggregate, M matrix, Esc close)
- [ ] "Full Trace" badge shown when enabled
- [ ] Warning shown before execution when capturing full trace
- [ ] "⬇ Export JSON" button exports trace
- [ ] "📊 Export CSV" button exports per-node metrics
- [ ] "📂 Import Trace" loads and validates JSON
- [ ] Edge traversal percentages visible on branching edges (aggregate view, 2+ iterations)
- [ ] Animated flowing dashes on traversed edges
- [ ] Node tooltips on hover (label, status, avg duration, pass rate, executions)
