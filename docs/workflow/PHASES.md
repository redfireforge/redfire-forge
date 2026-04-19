# Workflow Designer — Phase Tracker

> Checklist for tracking implementation progress across all phases.
> Architecture: **Design first, test second** — the visual designer is the primary entry point.

---

## Phase A — Engine Foundation (COMPLETE)

**Branch**: `feature/variables-chaining-engine`
**Status**: Complete

Core engine components that power workflow execution. No UI designer yet.

- [x] **A1** — `VariableContext` class + built-in generators
- [x] **A2** — `resolveScenario()` preprocessor
- [x] **A3** — `Extraction` type + `extractVariables()`
- [x] **A4** — `runWorkflow()` + `runWorkflowLoad()` execution
- [x] **A5** — Integrate into executor + worker
- [x] **A6** — CLI: `extract`, `variables`, `mode: workflow`
- [x] **A7** — UI: Extract tab in TestEditorModal
- [x] **A8** — UI: Variable panel + Variables input components
- [x] **A9** — UI: Workflow execution mode in Runner

---

## Phase 1 — WORKFLOW Section + Visual Designer

**Branch**: `feature/variables-chaining-engine` (continuing)
**Status**: In progress
**Estimated**: ~1,500 lines

Add WORKFLOW as a 4th top-level section with a visual canvas for designing workflows.

### 1A — App Shell & Routing

- [x] **1A.1** — Add `'workflow'` to `Tab` type in `App.tsx`
- [x] **1A.2** — Add WORKFLOW button to sidebar nav rail
- [x] **1A.3** — Fix Harness active predicate (exclude workflow)
- [ ] **1A.4** — Create `WorkflowDesigner` page component
- [ ] **1A.5** — Add workflow-specific CSS (`src/styles/workflow.css`)

### 1B — Data Model & Storage

- [ ] **1B.1** — `src/types/workflow.ts` — `Workflow`, `WorkflowNode`, `WorkflowEdge`, node data types
- [ ] **1B.2** — `src/hooks/useWorkflows.ts` — CRUD hook with dual-mode storage
- [ ] **1B.3** — Storage functions: `saveWorkflows()`, `loadWorkflows()` in `storage.ts`

### 1C — Visual Canvas (React Flow)

- [ ] **1C.1** — Add `@xyflow/react` dependency
- [ ] **1C.2** — `WorkflowCanvas.tsx` — React Flow canvas with providers, zoom, minimap
- [ ] **1C.3** — `WorkflowToolbar.tsx` — New / Open / Save / Rename / Delete / Quick Test
- [ ] **1C.4** — `WorkflowStatusBar.tsx` — Step count, variable count, last run status

### 1D — Node Components

- [ ] **1D.1** — `nodes/HttpStepNode.tsx` — HTTP request node (method badge, URL, extraction count)
- [ ] **1D.2** — `nodes/ConditionNode.tsx` — Diamond if/else node (true/false outputs)
- [ ] **1D.3** — `nodes/DelayNode.tsx` — Timer node with duration display

### 1E — Palette (left panel)

- [ ] **1E.1** — `WorkflowPalette.tsx` — Draggable node blocks (HTTP, Condition, Delay)
- [ ] **1E.2** — REQUESTS browser — collapsible tree of request collections
- [ ] **1E.3** — CATALOG browser — collapsible tree of catalog endpoints
- [ ] **1E.4** — Drag from palette/tree → drop on canvas → create node

### 1F — Config Panel (right panel)

- [ ] **1F.1** — `WorkflowConfigPanel.tsx` — Shows config for selected node
- [ ] **1F.2** — HTTP node config: reuse existing editor tabs (Params, Headers, Body, Auth, Extract)
- [ ] **1F.3** — Condition node config: expression builder (left, operator, right)
- [ ] **1F.4** — Delay node config: fixed/random duration inputs
- [ ] **1F.5** — Initial variables editor (for workflow-level variables)

### 1G — Quick Test Execution

- [ ] **1G.1** — `graphRunner.ts` — Topological traversal of node graph for execution
- [ ] **1G.2** — Quick Test button → runs workflow with live canvas animation
- [ ] **1G.3** — Node state animation: pending → running → pass → fail
- [ ] **1G.4** — `VariableContextBar.tsx` — Live variable updates during execution
- [ ] **1G.5** — Per-step results shown on node (status code, response time)

### Phase 1 deliverables
- WORKFLOW section in sidebar nav rail (same level as REQUESTS, CATALOG, HARNESS)
- Visual canvas with drag-and-drop node placement and edge connections
- Import requests from REQUESTS and CATALOG via palette browser
- Per-node configuration (HTTP, Condition, Delay) in config panel
- Quick Test with live canvas animation and variable tracking
- Save/load workflows

---

## Phase 2 — Advanced Control Flow

**Branch**: TBD
**Status**: Not started
**Depends on**: Phase 1 complete
**Estimated**: ~800 lines

### Tasks

- [ ] **2.1** — `nodes/ForkNode.tsx` — Parallel fork (fan-out)
- [ ] **2.2** — `nodes/JoinNode.tsx` — Parallel join (wait-all / wait-any)
- [ ] **2.3** — `nodes/LoopNode.tsx` — For-each / Repeat N / While
- [ ] **2.4** — `nodes/SwitchNode.tsx` — Multi-way branch
- [ ] **2.5** — `AggregateNode.tsx` — Combine parallel results
- [ ] **2.6** — Try/Catch error handling in graph runner
- [ ] **2.7** — Sub-workflow (embed a saved workflow as a single node)

### Phase 2 deliverables
- Parallel execution with fork/join
- Loop iteration over arrays, counts, and conditions
- Multi-way branching and error handling
- Workflow composition (sub-workflows)

---

## Phase 3 — HARNESS Integration + Polish

**Branch**: TBD
**Status**: Not started
**Depends on**: Phase 1 complete (Phase 2 optional)
**Estimated**: ~500 lines

### Tasks

- [ ] **3.1** — Workflow picker in HARNESS Test Runner
- [ ] **3.2** — "Run in Harness" button in workflow toolbar
- [ ] **3.3** — Workflow results in Results Dashboard (per-step breakdown)
- [ ] **3.4** — Export workflow as YAML (CLI-compatible)
- [ ] **3.5** — Import workflow from YAML
- [ ] **3.6** — Source sync indicators (badge when REQUESTS/CATALOG source changes)
- [ ] **3.7** — CHANGELOG, ROADMAP updates

### Phase 3 deliverables
- Run saved workflows at scale from HARNESS
- Per-step results in Results Dashboard
- Round-trip YAML export/import for CLI
- Source change tracking

---

## Progress Summary

| Phase | Tasks | Done | Status |
|---|---|---|---|
| **A** — Engine Foundation | 9 | 9 | Complete |
| **1** — Visual Designer | 24 | 3 | In progress |
| **2** — Advanced Control Flow | 7 | 0 | Not started |
| **3** — HARNESS + Polish | 7 | 0 | Not started |
| **Total** | **47** | **12** | **26%** |

---

_Last updated: 2026-04-19_
