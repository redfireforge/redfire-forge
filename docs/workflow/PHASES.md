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

## Phase 1 — WORKFLOW Section + Visual Designer (COMPLETE)

**Branch**: `feature/variables-chaining-engine`
**Status**: Complete

Added WORKFLOW as a 4th top-level section with a visual canvas for designing workflows.

### 1A — App Shell & Routing

- [x] **1A.1** — Add `'workflow'` to `Tab` type in `App.tsx`
- [x] **1A.2** — Add WORKFLOW button to sidebar nav rail
- [x] **1A.3** — Fix Harness active predicate (exclude workflow)
- [x] **1A.4** — Create `WorkflowDesigner` page component
- [x] **1A.5** — Add workflow-specific CSS (`src/styles/workflow.css`)

### 1B — Data Model & Storage

- [x] **1B.1** — `src/types/workflow.ts` — `Workflow`, `WorkflowNode`, `WorkflowEdge`, node data types
- [x] **1B.2** — `src/hooks/useWorkflows.ts` — CRUD hook with dual-mode storage
- [x] **1B.3** — Storage functions: `saveWorkflows()`, `loadWorkflows()` in `storage.ts`

### 1C — Visual Canvas (React Flow)

- [x] **1C.1** — Add `@xyflow/react` dependency
- [x] **1C.2** — `WorkflowCanvas.tsx` — React Flow canvas with providers, zoom, minimap
- [x] **1C.3** — `WorkflowToolbar.tsx` — New / Open / Save / Rename / Delete / Quick Test
- [x] **1C.4** — `WorkflowStatusBar.tsx` — Step count, variable count, last run status

### 1D — Node Components

- [x] **1D.1** — `nodes/HttpStepNode.tsx` — HTTP request node (method badge, URL, extraction count)
- [x] **1D.2** — `nodes/ConditionNode.tsx` — Diamond if/else node (true/false outputs)
- [x] **1D.3** — `nodes/DelayNode.tsx` — Timer node with duration display

### 1E — Palette (left panel)

- [x] **1E.1** — `WorkflowPalette.tsx` — Draggable node blocks (HTTP, Condition, Delay)
- [x] **1E.2** — REQUESTS browser — collapsible tree of request collections
- [x] **1E.3** — CATALOG browser — collapsible tree of catalog endpoints
- [x] **1E.4** — Drag from palette/tree → drop on canvas → create node

### 1F — Config Panel (right panel)

- [x] **1F.1** — `WorkflowNodeConfigModal.tsx` — Full-screen modal for selected node config
- [x] **1F.2** — HTTP node config: reuse existing editor tabs (Params, Headers, Body, Auth, Extract)
- [x] **1F.3** — Condition node config: expression builder (left, operator, right)
- [x] **1F.4** — Delay node config: fixed/random duration inputs
- [x] **1F.5** — Initial variables editor (for workflow-level variables)

### 1G — Quick Test Execution

- [x] **1G.1** — `graphRunner.ts` — Topological traversal of node graph for execution
- [x] **1G.2** — Quick Test button → runs workflow with live canvas animation
- [x] **1G.3** — Node state animation: pending → running → pass → fail
- [x] **1G.4** — Variable context bar — live variable updates during execution
- [x] **1G.5** — Per-step results shown on node (status code, response time)

### Phase 1 deliverables ✅
- WORKFLOW section in sidebar nav rail (same level as REQUESTS, CATALOG, HARNESS)
- Visual canvas with drag-and-drop node placement and edge connections
- Import requests from REQUESTS and CATALOG via palette browser
- Per-node configuration (HTTP, Condition, Delay) in full-screen modal
- Quick Test with live canvas animation and variable tracking
- Save/load workflows

---

## Phase 2 — Advanced Control Flow (COMPLETE)

**Branch**: `feature/webhook-schedule-triggers`
**Status**: Complete

### Tasks

- [x] **2.1** — `nodes/StartNode.tsx` — Workflow entry point with input variable declarations
- [x] **2.2** — `nodes/EndNode.tsx` — Terminal workflow node with success/failure propagation
- [x] **2.3** — `nodes/ForkNode.tsx` — Parallel fork (fan-out) with concurrent execution
- [x] **2.4** — `nodes/JoinNode.tsx` — Parallel join (wait-all barrier synchronization)
- [x] **2.5** — Auto-Layout — Dagre-based hierarchical layout with smart centering
- [x] **2.6** — Parallel execution via Promise.all in graphRunner
- [x] **2.7** — Join barrier coordination with thread tracking

### Phase 2 deliverables ✅
- Start/End nodes for clear workflow boundaries
- Parallel execution with Fork/Join
- Auto-layout with Dagre hierarchical algorithm
- 74 new tests (65 unit + 9 E2E)

---

## Phase 3 — Webhook & Schedule Triggers (COMPLETE)

**Branch**: `feature/webhook-schedule-triggers`
**Status**: Complete

### Tasks

- [x] **3.1** — `nodes/WebhookTriggerNode.tsx` — HTTP endpoint trigger with method/path/payload config
- [x] **3.2** — `nodes/ScheduleTriggerNode.tsx` — Cron-based trigger with timezone and human-readable description
- [x] **3.3** — `WebhookConfig.tsx` — Webhook configuration panel with method, path, sample payload, variable extraction
- [x] **3.4** — `ScheduleConfig.tsx` — Schedule configuration panel with cron expression, timezone, input variables
- [x] **3.5** — GraphRunner integration — `findStartNodes()` prioritizes trigger nodes; webhook variable extraction from samplePayload
- [x] **3.6** — `src-server/webhook-server.ts` — Node.js webhook HTTP server for receiving webhook events
- [x] **3.7** — `src-server/cron-scheduler.ts` — Cron scheduler for time-based workflow triggering
- [x] **3.8** — `src-server/file-storage.ts` — File-based workflow and execution storage
- [x] **3.9** — `src-server/webhook-extractor.ts` — JSONPath variable extraction from webhook payloads
- [x] **3.10** — `WebhookDeliveryLogs.tsx` — Webhook delivery log viewer page
- [x] **3.11** — `WorkflowExecutionHistory.tsx` — Execution history page with status tracking
- [x] **3.12** — `ServerStatusIndicator.tsx` — Server connection status indicator
- [x] **3.13** — Shared types (`server-api.ts`) and formatters (`serverFormatters.ts`)
- [x] **3.14** — 31 new tests (11 unit + 20 E2E) for trigger node functionality

### Phase 3 deliverables ✅
- Webhook and schedule trigger nodes in palette and canvas
- Full configuration modals for both trigger types
- Node.js backend server for webhook reception and cron scheduling
- Webhook delivery logs and execution history pages
- Server status indicator in workflow toolbar

---

## Phase 4 — Switch, Loop, SetVariable & Aggregate Nodes (COMPLETE)

**Branch**: `feature/switch-loop-nodes`
**Status**: Complete

### Types & Data Model

- [x] **4.1** — `SwitchCase` interface — `{ id, value, label? }`
- [x] **4.2** — `SwitchNodeData` interface — `{ label, expression, cases: SwitchCase[] }`
- [x] **4.3** — `LoopMode` type — `'count' | 'forEach' | 'while'`
- [x] **4.4** — `ConditionOperator` type alias — Reuses `ConditionNodeData['operator']`
- [x] **4.5** — `LoopNodeData` interface — `{ label, mode, count?, countExpression?, sourceExpression?, itemVariable?, indexVariable?, whileLeft?, whileOperator?, whileRight?, maxIterations? }`
- [x] **4.6** — Extended `WorkflowNodeType` union with `'switch' | 'loop' | 'setVariable' | 'aggregate'`
- [x] **4.7** — Extended `WorkflowNodeData` union with `SwitchNodeData | LoopNodeData | SetVariableNodeData | AggregateNodeData`
- [x] **4.7a** — `SetVariableAssignment` interface — `{ id, name, expression }`
- [x] **4.7b** — `SetVariableNodeData` interface — `{ label, assignments: SetVariableAssignment[] }`
- [x] **4.7c** — `AggregateStrategy` type — `'concat' | 'first' | 'last' | 'count' | 'sum' | 'custom'`
- [x] **4.7d** — `AggregateMapping` interface — `{ id, sourceExpression, targetVariable, strategy, customExpression? }`
- [x] **4.7e** — `AggregateNodeData` interface — `{ label, mappings: AggregateMapping[] }`

### Node Components

- [x] **4.8** — `nodes/SwitchNode.tsx` — Diamond shape with dynamic output handles per case + default; evenly-spaced handle positioning
- [x] **4.9** — `nodes/LoopNode.tsx` — Rounded rectangle with loop icon (🔄) and mode badge; two source handles ("Body" + "Done")
- [x] **4.9a** — `nodes/SetVariableNode.tsx` — Assignment count preview, up to 2 assignments shown, single in/out handles
- [x] **4.9b** — `nodes/AggregateNode.tsx` — Σ icon, mapping count, up to 2 mappings with strategy display

### Config Panels

- [x] **4.10** — `SwitchConfig.tsx` — Label, expression input, dynamic case list with add/remove/reorder
- [x] **4.11** — `LoopConfig.tsx` — Mode selector (Count/ForEach/While), mode-specific inputs, max iterations safety cap
- [x] **4.11a** — `SetVariableConfig.tsx` — Label, dynamic assignments list with name/expression inputs, add/remove/reorder
- [x] **4.11b** — `AggregateConfig.tsx` — Label, dynamic mappings list with source/target/strategy, custom expression input, add/remove/reorder

### Integration

- [x] **4.12** — `WorkflowNodeConfigModal.tsx` — Render blocks for switch, loop, setVariable, and aggregate node config
- [x] **4.13** — `WorkflowPalette.tsx` — Switch (⇅), Loop (🔄), Set Variable (📝), Aggregate (Σ) blocks added to Logic category
- [x] **4.14** — `WorkflowDesigner.tsx` — Node type registration + default node data for all 4 node types

### Engine — GraphRunner

- [x] **4.15** — Switch execution — Resolve expression, match first case, route to matched handle or default; skip non-taken subtrees via `markSubtreeSkipped()`
- [x] **4.16** — Loop execution — Three modes (count, forEach, while); body subgraph re-traversal per iteration; index/item variable injection; `maxIterations` safety cap
- [x] **4.17** — `collectReachableFromEdges()` helper — BFS to identify loop body subgraph for visited-set clearing between iterations
- [x] **4.18** — While-loop condition evaluation — Reuses `evaluateCondition()` with `ConditionNodeData` shape
- [x] **4.18a** — SetVariable execution — Iterates assignments, resolves expressions via `ctx.resolve()`, sets variables, skips empty names
- [x] **4.18b** — Aggregate execution — Iterates mappings, applies strategy (concat/first/last/count/sum/custom), skips empty targetVariable
- [x] **4.18c** — Refactored `visitOutgoing()` helper — Extracted repeated 'follow outgoing edges' pattern to reduce code duplication

### Layout & CSS

- [x] **4.19** — `workflowAutoLayout.ts` — Added `'switch'`, `'loop'`, `'setVariable'`, `'aggregate'` to `COMPACT_NODE_TYPES`
- [x] **4.20** — `workflow.css` — Styles for `.wf-node-switch`, `.wf-node-loop`, `.wf-node-setVariable`, `.wf-node-aggregate`, config panel elements

### Tests

- [x] **4.21** — `graphRunner.switchLoop.test.ts` — 24 tests: switch routing (match, default, no cases, duplicate values, variable resolution, null-coalesce), loop count/forEach/while modes, forEach JSON array/object/invalid, countExpression resolution, maxIterations safety, abort signal, done-edge traversal
- [x] **4.21a** — `graphRunner.setVarAggregate.test.ts` — 26 tests: SetVariable (single/multiple vars, template resolution, empty names, override, empty list, outgoing edges), Aggregate (concat/first/last/count/sum/custom strategies, empty mappings, empty targetVariable, unknown strategy, non-array JSON, parsed JSON values, multiple mappings)
- [ ] **4.22** — E2E tests for switch/loop/setVariable/aggregate palette, config modals, and canvas integration
- [x] **4.23** — Review, refactor, coverage >90% branch (90.07%)

### Phase 4 deliverables ✅
- Switch node: multi-way branching with dynamic cases and expression matching
- Loop node: three iteration modes (count, forEach, while) with safety limits
- Set Variable node: set/transform variables with template expression resolution
- Aggregate node: accumulate values with 6 strategies (concat, first, last, count, sum, custom)
- Full config UI for all 4 node types with add/remove/reorder support
- GraphRunner execution logic with `visitOutgoing()` refactor to reduce code duplication
- 50 new unit tests (24 switch/loop + 26 setVariable/aggregate)
- 1,831 total tests passing, 90.07% branch coverage

---

## Phase 7A — Async Correlation & Runtime Bridge (COMPLETE)

**Status**: Complete

### Goals
Enable workflows to pause and wait for external webhook callbacks (payment gateways, approval systems, CI/CD pipelines), then resume with injected data.

### Deliverables ✅
- **Correlation Wait Node** — Pause workflow execution, wait for external webhook callback matching correlation ID; extract variables from webhook payload; configurable timeout with failure path
- **RemoteCorrelationStore (browser)** — `ICorrelationStore` implementation that registers paused waits with webhook server and long-polls `GET /api/correlations/:id/wait` until resumed
- **Server: `/api/correlations/:id/wait`** — Long-poll endpoint (1–120s clamp) with parked-waiter pattern + queued-resume reconciliation for race conditions
- **Server: Idempotency fix** — Cache no longer short-circuits replay when active waiter exists; duplicate-key webhooks now correctly notify waiting workflows
- **409 Auto-recovery** — If paused entry already exists from abandoned run, `RemoteCorrelationStore` deletes and retries once
- **Full Config Propagation** — `CorrelationWaitConfig` (source/jsonPath/header/queryParam) propagated to server during pause registration
- **Sample Fixes** — Parallel Payment: added per-branch ID prefixing to avoid collisions; Async Approval: fixed switch case IDs (removed double-prefix); simulators now append `-{{$timestamp}}` to idempotency keys
- **Monolith Refactor** — WorkflowDesigner.tsx: 1062 → 893 lines (extracted `useWorkflowPersistence`, `useWorkflowExtractionSample`); cleaned up duplicate `useEffect` blocks and dead imports
- **Tests** — 53 new hook tests (`useWorkflowPersistence` 13, `useWorkflowExtractionSample` 5, `useWorkflowNavigation` 7, `useWorkflowConsole` 7, `useWorkflowEdgeOps` 8, `useWorkflowRunCache` 13); 14 new correlation/wait tests; 4613 total tests passing
- **Documentation** — Updated `CORRELATION_WAIT_API.md` (new /wait section), `CORRELATION_WAIT_GUIDE.md` (parallel-branch warning), training manuals updated
- **Bug Fixes** — `runProgress` badge: now counts executable nodes consistently (was "11/2 passed"); env selector hidden in preview mode

### Technical Notes
- Async bridge wires runtime workflows (not just tests) to receive callbacks — closes the execution loop for real-world async patterns
- RemoteCorrelationStore uses EventSource-based long-polling fallback if WebSocket upgrade fails
- Server uses parked-waiter queue to handle race where webhook arrives before pause registration completes

---

## Backlog — Structured JSON assertions (cross-cutting)

> Tracked in **ROADMAP.md → Phase 0.10.0** (“Structured JSON body assertions”). Not workflow-only: same validation engine as Harness.

- [ ] **Engine + types** — New `Assertion` variants (or `jsonRule` type) for length / numeric / date; evaluate after `getByPath()` on parsed body; unit tests in `validator.test.ts` / `assertions.test.ts`.
- [ ] **UI** — Test Editor Validation tab: add-rule flow with JSON path picker (reuse tree/picker patterns from regex builder).
- [ ] **Workflow** — No separate feature: HTTP nodes already use `Scenario.validation`; once assertions ship, document in workflow docs if needed.

---

## Progress Summary

| Phase | Tasks | Done | Status |
|---|---|---|---|
| **A** — Engine Foundation | 9 | 9 | Complete |
| **1** — Visual Designer | 24 | 24 | Complete |
| **2** — Advanced Control Flow | 7 | 7 | Complete |
| **3** — Webhook & Schedule Triggers | 14 | 14 | Complete |
| **4** — Switch, Loop, SetVariable & Aggregate | 33 | 32 | Complete (E2E pending) |
| **7A** — Async Correlation & Runtime Bridge | 18 | 18 | Complete |
| **Total** | **105** | **103** | **98%** |

---

_Last updated: 2026-04-28_
