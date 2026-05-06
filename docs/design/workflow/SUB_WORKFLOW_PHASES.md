# Sub-Workflow Implementation Phases (Approach A — Inline Reference)

## Phase 1 — Data Model & Type Foundations ✅ DONE

**Files changed:**

- **Modified** `src/types/workflow.ts` — Added `SubWorkflowNodeData` interface, extended `WorkflowNodeType` (17 types) and `WorkflowNodeData` unions
- **Modified** `src/utils/workflowMigrations.ts` — Added `migrateV4ToV5()` (no-op bump), updated migration chain to v5
- **Modified** `src/hooks/useWorkflows.ts` — Bumped `WORKFLOW_SCHEMA_VERSION` from 4 to 5
- **Modified** `src/utils/workflowMigrations.test.ts` — Updated all `toBe(4)` → `toBe(5)`, added 8 new tests

### 1a. `SubWorkflowNodeData` interface

Add to `workflow.ts`:

```ts
export interface SubWorkflowNodeData {
  [key: string]: unknown;
  label: string;
  /** UUID of the referenced child workflow. */
  workflowId: string;
  /** Cached display name (for rendering when child isn't loaded). */
  workflowName?: string;
  /** Map parent expressions → child input variables. */
  inputMappings: Array<{ sourceExpression: string; targetVariable: string }>;
  /** Map child output variables → parent variables. */
  outputMappings: Array<{ sourceVariable: string; targetVariable: string }>;
  /** Pass all child final variables to parent (fallback when outputMappings is empty). */
  propagateAllOutputs?: boolean;
  /** Recursion depth limit (default 10). */
  maxDepth?: number;
  /** Abort child if it takes longer than this (0 = unlimited). */
  timeoutMs?: number;
}
```

### 1b. Extend union types

- Add `'subWorkflow'` to `WorkflowNodeType` union (17th type)
- Add `SubWorkflowNodeData` to `WorkflowNodeData` union

### 1c. Schema migration (v3 → v4)

- Add `migrateV3ToV4()` in `workflowMigrations.ts` — no-op structural migration, just bumps `schemaVersion` to 4
- Keeps the migration chain clean for future changes

### Tests (~8) ✅ DONE

- 4 migration tests (v4→v5 bump, v5 unchanged, v1→v5 full chain, subWorkflow node preserved)
- 4 type tests (union membership, optional fields, mapping structure)

---

## Phase 2 — Canvas Node Component ✅ DONE

**Files changed:**

- **New** `src/components/workflow/nodes/SubWorkflowNode.tsx` — Node component
- **New** `src/components/workflow/nodes/SubWorkflowNode.test.tsx` — 12 tests
- **Modified** `src/components/workflow/nodes/NodeIcon.tsx` — Added `subWorkflow` icon (nested rectangles + checkmark, category `flow`)
- **Modified** `src/components/workflow/nodes/NodeIcon.test.tsx` — Added `subWorkflow` to `ALL_TYPES` array
- **Modified** `src/components/workflow/WorkflowPalette.tsx` — Added palette entry in "Flow" category: "Sub-Workflow" / "Execute another workflow"
- **Modified** `src/pages/WorkflowDesigner.tsx` — Import, `nodeTypes` map, `defaultNodeData` case
- **Modified** `src/utils/workflowAutoLayout.ts` — Added `subWorkflow` to `COMPACT_NODE_TYPES`
- **Modified** `src/styles/workflow.css` — CSS for `.wf-node-subWorkflow`, `.wf-subworkflow-body`, `.wf-subworkflow-ref`, `.wf-subworkflow-name`, `.wf-subworkflow-warning`, `.wf-subworkflow-mappings`

### Implementation details

- Uses `useNodeBase(id)` for `stateClass` + `handleConfigure`
- Uses `NodeIcon` + `getNodeCategory` (icon: nested rectangles with checkmark, category: `flow`)
- Shows `data.workflowName || data.workflowId` when workflow selected, `⚠ Select workflow…` otherwise
- Shows input/output mapping count badge: `N in · M out` (hidden when both 0)
- **Handles:** single `target` (top) + single `source` (bottom)
- CSS: indigo accent (`#6366f1`), gradient background
- Default data: `{ label: 'Sub-Workflow', workflowId: '', inputMappings: [], outputMappings: [] }`

### Tests (12) ✅

- Renders default/custom label
- Warning when no workflow selected
- Shows workflow name / falls back to ID
- Mapping count badge shown/hidden
- Target + source handles rendered
- NodeIcon, configure button, selected class, category label

---

## Phase 3 — Config Panel (Workflow Picker + Mapping Editor) ✅ DONE

**Files changed:**

- **New** `src/components/workflow/SubWorkflowConfig.tsx` — Config panel with workflow picker, input/output mapping editors, advanced settings
- **New** `src/components/workflow/SubWorkflowConfig.test.tsx` — 18 tests
- **Modified** `src/components/workflow/WorkflowNodeConfigModal.tsx` — Import, `SubWorkflowNodeData` type, `workflows` prop, render block for `subWorkflow` type
- **Modified** `src/pages/WorkflowDesigner.tsx` — Pass `workflows` prop to config modal
- **Modified** `src/styles/workflow.css` — Mapping row CSS (`.wf-subworkflow-mapping-row`, `-arrow`, `-remove`, `-add`)

### Implementation details

Following `ErrorHandlerConfig.tsx` pattern:

### 3a. Workflow picker

- `<select>` dropdown listing all saved workflows (from IndexedDB / store)
- Filters out the current workflow (prevent direct self-reference)
- On select: sets `workflowId`, caches `workflowName`, auto-populates input/output mappings from the child's Start node `inputVariables` and End node output variables

### 3b. Input mapping editor

- Table with rows: `Source Expression` (parent `{{variable}}` or literal) → `Target Variable` (child input name)
- Auto-populated from child workflow's Start node `inputVariables` keys
- Add/remove rows

### 3c. Output mapping editor

- Table with rows: `Source Variable` (child variable name) → `Target Variable` (parent variable to set)
- Toggle: "Propagate all outputs" checkbox (sets `propagateAllOutputs`)

### 3d. Advanced section

- Max Depth (number, default 10)
- Timeout (ms, default 0 = unlimited)

### 3e. Info box

"How it works" section explaining input/output flow.

### Tests (18) ✅

- Label field render and onChange
- Workflow picker renders available workflows
- Picker filters out current workflow (self-reference prevention)
- Selecting workflow sets workflowId + workflowName
- Empty state hint when no workflows
- Input mapping: render rows, add, remove, update source expression
- Output mapping: add, remove
- `propagateAllOutputs` toggle
- Max depth field (default 10) + onChange
- Timeout field (default 0) + onChange
- "How it works" info section

---

## Phase 4 — Graph Runner Execution ✅ DONE

**Files changed:**

- **Modified** `src/engine/workflow/graphRunner.ts` — Added `SubWorkflowNodeData` + `Workflow` imports, `resolveSubWorkflow` parameter, `subWorkflow` case in `visit()` function
- **New** `src/engine/workflow/graphRunner.subWorkflow.test.ts` — 13 tests
- **Modified** `src/pages/WorkflowDesigner.tsx` — Pass `resolveSubWorkflow` resolver to `runGraph`, added `workflows` to dependency array

### Implementation details

Added `case 'subWorkflow'` in the `visit()` function. Unlike Loop/ErrorHandler (which use `collectReachableFromEdges` for inline body subgraphs), sub-workflow **recursively calls `runGraph()`** on the child workflow's nodes/edges:

1. **Depth guard** — `currentDepth >= maxDepth` (default 10) throws to prevent infinite recursion
2. **Resolve child** — Via `resolveSubWorkflow(workflowId)` callback (keeps graphRunner pure, no DB dependency)
3. **Input mapping** — Resolves parent `{{variable}}` expressions → child initial variables
4. **Timeout** — Optional `AbortController` with `setTimeout` for `timeoutMs`
5. **Recursive execution** — `runGraph()` with child nodes/edges, child inputs, `resolveSubWorkflow` passed through
6. **Output capture** — Child's `onVariablesChange` callback captures final variable snapshot; `onComplete` captures `allPassed`
7. **Output mapping** — Maps child variables → parent context (explicit mappings + `propagateAllOutputs`)
8. **Result aggregation** — Child results pushed to parent results array
9. **Logging** — Child logs prefixed with `[sub]`

### New `runGraph` parameter

`resolveSubWorkflow?: (id: string) => Workflow | undefined` — the caller passes a lookup function. In WorkflowDesigner: `(id) => workflows.find((w) => w.id === id)`.

### Tests (13) ✅

- Executes child workflow and aggregates results
- Throws/fails when child workflow not found
- Passes input mappings to child workflow
- Maps child output variables back to parent
- `propagateAllOutputs` mode (includes filtering `__` prefixed vars)
- Depth limit enforcement (maxDepth=1 → immediate fail)
- Child HTTP failure marks parent node as fail
- Continues to outgoing nodes after sub-workflow completes
- Logs with `[sub]` prefix
- Timeout configuration creates abort controller
- Nested sub-workflows (A → B → C, 2 levels)
- Works without resolveSubWorkflow (graceful fail)
- Does not propagate `__internal` variables
- Timeout enforcement
- Empty mappings (no inputs/outputs)

---

## Phase 5 — Pre-Run Validation ✅ DONE

**Files changed:**

- **New** `src/utils/workflowSubWorkflowValidation.ts` — `validateSubWorkflowNodes()` function with cycle detection
- **New** `src/utils/workflowSubWorkflowValidation.test.ts` — 13 tests

### Implementation details

New `validateSubWorkflowNodes(workflow, allWorkflows)` returns `SubWorkflowValidationIssue[]`:

1. **Empty reference** — `workflowId` empty → error
2. **Dangling reference** — `workflowId` not found in `allWorkflows` → error
3. **Self-reference** — `workflowId === workflow.id` → error
4. **Circular dependency** — Recursive DFS walk through transitive sub-workflow references; returns human-readable cycle chain (e.g. "Child → Parent") → error
5. **Missing input mappings** — Child's Start node `inputVariables` keys not covered by `inputMappings` → warning
6. **Max depth sanity** — `maxDepth` must be 1–100 → error

Each issue includes `nodeId`, `nodeLabel`, `severity` ('error' | 'warning'), and `message`.

### Tests (13) ✅

- Valid reference → no issues
- No sub-workflow nodes → no issues
- Empty workflowId → error
- Dangling reference → error with workflow name
- Direct self-reference → error
- Circular A → B → A → error with cycle chain
- Transitive circular A → B → C → A → error
- Unmapped child input variables → warning
- All child inputs mapped → no warning
- maxDepth < 1 → error
- maxDepth > 100 → error
- Multiple sub-workflow nodes validated independently
- Issue includes nodeId and nodeLabel

---

## Phase 6 — Export/Import Bundling ✅

**File:** `src/utils/workflowBundleExport.ts` (new)

### 6a. `collectWorkflowBundle(rootId, allWorkflows)`

- Recursively walks all sub-workflow references via DFS
- Returns `WorkflowBundle { root, children }` — root + all transitive children
- Deduplicates (same child referenced by multiple parents)
- Handles missing references gracefully (skips)
- Handles circular references (visited set)

### 6b. Import resolver

Three-function pipeline:

1. **`detectImportConflicts(bundle, existingWorkflows)`** — Finds ID collisions, auto-resolves identical content as 'keep'
2. **`resolveImportBundle(bundle, existingWorkflows, resolutions)`** — Applies user-chosen conflict resolutions:
   - `'keep'` → keep existing, skip incoming
   - `'replace'` → overwrite existing with incoming
   - `'copy'` → import with new UUID, remap sub-workflow references
3. **`applyIdRemaps(workflow, idRemap)`** — Internal: updates `workflowId` in sub-workflow nodes when IDs are remapped

Types: `WorkflowBundle`, `ImportConflict`, `ImportConflictResolution`, `ResolvedImport`

### Tests (19) ✅

**collectWorkflowBundle (7):**
- Root with no children
- Root not found → null
- Direct child collection
- Transitive child collection (A → B → C)
- Deduplication of shared children
- Missing child references → graceful skip
- Circular references → no infinite loop

**detectImportConflicts (4):**
- No overlapping IDs → no conflicts
- Same ID + identical content → no conflict (auto-keep)
- Same ID + different content → conflict detected
- Child workflow conflicts detected

**resolveImportBundle (8):**
- New workflows added as-is
- Identical content auto-kept
- 'keep' resolution → kept
- 'replace' resolution → replaced
- 'copy' resolution → new ID + renamed
- Sub-workflow references updated when parent copied
- Sub-workflow references remapped when child copied
- Unresolved conflicts default to 'keep'

---

## Phase 7 — UX Polish ✅

### 7a. "Open Child Workflow" button on SubWorkflowNode

**Files:** `SubWorkflowNode.tsx`, `WorkflowInspectContext.tsx`

- Added `navigateToWorkflow(workflowId)` to `WorkflowInspectActions` context
- SubWorkflowNode renders an "Open" button (external link icon) when a workflow is selected
- Clicking navigates to the child workflow and pushes parent to breadcrumb stack

### 7b. Breadcrumb Navigation

**File:** `WorkflowBreadcrumb.tsx` (new)

- Shows `Parent › Child › GrandChild` breadcrumb bar when navigating into sub-workflows
- Click any ancestor to navigate back (pops stack to that level)
- Stack cleared when selecting a workflow from the sidebar
- Renders above the canvas, below the toolbar

### 7c. "Extract to Sub-Workflow" Context Menu

**File:** `workflowExtractSubWorkflow.ts` (new)

- `extractToSubWorkflow(selectedNodeIds, parentNodes, parentEdges, childName)` utility
- Creates a new child workflow containing selected nodes + internal edges + start/end bookends
- Replaces extracted nodes with a SubWorkflow node at their centroid
- Detects entry/exit nodes from incoming/outgoing edges
- Skips non-extractable nodes (start, end)
- Context menu shows "Extract to Sub-Workflow" on right-click
- Context menu also shows "Open Child Workflow" for sub-workflow nodes

### 7d. Debug Step-Into

**File:** `WorkflowDebugBar.tsx` (modified)

- When debug mode is paused on a sub-workflow node, a "⤵ Step Into" button appears
- Clicking steps the node (executes it) and navigates to the child workflow
- Props: `pausedSubWorkflowNodeId`, `onStepInto`

### Tests (21 new + 7 updated) ✅

**WorkflowBreadcrumb (6):**
- Empty stack renders nothing
- Single parent + current
- Multi-level breadcrumb
- Navigate callback with index
- Separator rendering
- Current item is not a link

**extractToSubWorkflow (8):**
- No extractable nodes → null
- Empty selection → null
- Single HTTP node extraction
- Multiple connected nodes
- Skips start/end nodes
- Centroid positioning
- Child has start/end bookends
- Sub-workflow node references child ID

**WorkflowDebugBar (6 new):**
- Debug indicator + variable count
- Resume/Step All/Stop buttons
- No Step Into without paused sub-workflow
- Step Into appears when paused on sub-workflow
- Step Into calls stepNode + onStepInto
- Stop calls onStop

**SubWorkflowNode (3 updated):**
- Open button renders when workflow selected
- Open button hidden when no workflow
- Open button calls navigateToWorkflow

**WorkflowNodeContextMenu (4 updated):**
- Extract to Sub-Workflow renders/clicks
- Open Child Workflow renders/clicks

---

## Summary

| Phase | Scope | Files | Tests | Status |
|-------|-------|-------|-------|--------|
| 1 | Types + migration | 3 modified | 8 | ✅ Done |
| 2 | Canvas node + palette | 2 new + 6 modified | 12 (+3 updated) | ✅ Done |
| 3 | Config panel | 2 new + 3 modified | 18 | ✅ Done |
| 4 | **Graph execution** | 1 new + 2 modified | 13 | ✅ Done |
| 5 | Pre-run validation | 2 new | 13 | ✅ Done |
| 6 | Export/import bundle | 2 new | 19 | ✅ Done |
| 7 | UX polish | 4 new + 5 modified | 21 (+7 updated) | ✅ Done |
| 8 | Retry + on-failure | 3 modified | 7 new + 2 updated | ✅ Done |
| 9 | Child results in history | 4 modified + 1 new component | 8 new | ✅ Done |
| 10 | Inline canvas preview | 4 modified | 7 new | ✅ Done |
| 11 | Dynamic workflow ID | 4 modified | 12 new | ✅ Done |
| 12 | Multi-instance forEach | 5 modified | 17 new | ✅ Done |

**Total:** ~221 tests across phases 1–12. All phases complete with 0 type errors.

Implementation follows the exact patterns already established by ErrorHandler, Loop, and WaitForCondition nodes — same file structure, same test helpers, same config panel style.

---

## Enhancement Backlog

Features identified from industry research (Camunda BPMN Call Activities, Temporal Child Workflows, Airflow SubDAGs/TaskGroups, Prefect Subflows). Ranked by value/effort.

### E1. Retry Policy on Sub-Workflow Node — ✅ Done (Phase 8)

**Inspiration:** Temporal (retry policy), Airflow (`retries` + `retry_delay`)

Add `retryCount` (default 0) and `retryDelayMs` (default 1000) to `SubWorkflowNodeData`. If the child workflow fails, retry up to N times before marking the parent node as failed.

**Implementation:**
- Add fields to `SubWorkflowNodeData` in `workflow.ts`
- Add retry UI to `SubWorkflowConfig.tsx` advanced section
- Add retry loop in `graphRunner.ts` `subWorkflow` case (wrap child `runGraph` call)
- Log each retry attempt with `[sub:retry N/M]` prefix
- Tests: retry succeeds on 2nd attempt, exhausts retries → fail, retryDelayMs respected

### E2. On-Failure Strategy Selector — ✅ Done (Phase 8)

**Inspiration:** Camunda boundary events (interrupting/non-interrupting)

Currently child failure = parent node failure. Add a `onChildFailure: 'fail' | 'continue'` option (default `'fail'`).

- `'fail'` — Current behavior. Child failure marks parent sub-workflow node as failed.
- `'continue'` — Mark sub-workflow node as passed, set `{{__subWorkflowFailed}}` = `'true'` in parent context. Downstream nodes can branch on this variable.

**Implementation:**
- Add `onChildFailure` to `SubWorkflowNodeData`
- Add toggle in `SubWorkflowConfig.tsx` advanced section
- Modify `graphRunner.ts` `subWorkflow` case: check `onChildFailure` after child completes
- Tests: continue mode sets variable, fail mode propagates failure

### E3. Child Execution Results in Run History — ✅ Done (Phase 9)

**Inspiration:** Temporal (child workflow execution visible in parent's event history), Camunda (call activity shows link to child instance)

Currently child logs are prefixed with `[sub]` but child step results aren't surfaced in the parent's execution history UI. Add:

- Expandable "Child Run" section in `WorkflowExecSummary` or console panel
- Show child workflow name, pass/fail count, duration
- Click to expand individual child step results

**Implementation:**
- Extend `GraphRunCallbacks` with `onSubWorkflowResult` callback
- Capture child results in WorkflowDesigner state
- New `SubWorkflowResultPanel` component or expand `WorkflowConsolePanel`
- Tests: callback fires with child results, UI renders expandable section

### E4. Inline Canvas Preview on Node — ✅ Done (Phase 10)

**Inspiration:** Camunda modeler (call activity shows called process summary)

Show metadata summary directly on the SubWorkflowNode card:
- Node count and edge count of child workflow (e.g., "5 nodes · 4 edges")
- Child workflow's last run status (pass/fail/never run)
- Tiny status indicator dot

**Implementation:**
- SubWorkflowNode reads child workflow metadata via context or prop
- Display compact summary below mapping count badge
- Tests: shows node/edge count, updates on workflow change

### E5. Dynamic Workflow ID (Expression) — ✅ Done (Phase 11)

**Inspiration:** Camunda (`processId` as expression, e.g., `= "shipping-" + tenantId`)

Allow `workflowId` to be a `{{variable}}` expression resolved at runtime. Enables data-driven workflow selection (e.g., run different sub-workflows based on an API response).

**Implementation:**
- Detect `{{` in `workflowId` → treat as expression, resolve via `VariableContext` at runtime
- Validation: warn if expression (can't statically validate), error if resolved ID not found at runtime
- Config panel: toggle between static picker and expression input
- Tests: expression resolution, missing workflow at runtime, static vs dynamic modes

### E6. Multi-Instance (forEach) Mode — ✅ Done (Phase 12)

**Inspiration:** Camunda parallel multi-instance, Airflow dynamic task mapping, Prefect `.map()`

Run the sub-workflow once per item in an array variable (e.g., `{{users}}`), collecting results. Two modes:
- **Sequential** — Run child N times in sequence, accumulate results
- **Parallel** — Run all children concurrently (respecting depth limits)

**Implementation:**
- Add `multiInstance?: { collection: string; elementVariable: string; mode: 'sequential' | 'parallel' }` to `SubWorkflowNodeData`
- GraphRunner: iterate over collection, spawn child runs, aggregate results
- Output: `{{__subWorkflowResults}}` array variable with per-item results
- UI: Show progress (3/10 completed) on node during execution
- Tests: sequential iteration, parallel execution, empty collection, partial failure handling

---

### Priority Recommendation

| Priority | Enhancement | Effort | Suggested Phase |
|----------|------------|--------|-----------------|
| 🔴 High | E1. Retry policy | Low | ✅ Phase 8 |
| 🔴 High | E2. On-failure strategy | Low | ✅ Phase 8 |
| 🟡 Medium | E3. Child results in history | Medium | ✅ Phase 9 |
| 🟢 Low | E4. Inline canvas preview | Medium | ✅ Phase 10 |
| 🟢 Low | E5. Dynamic workflow ID | Medium | ✅ Phase 11 |
| 🟢 Low | E6. Multi-instance forEach | High | ✅ Phase 12 |
