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
| **Total** | **54** | **54** | **100%** |

---

_Last updated: 2026-04-24_
