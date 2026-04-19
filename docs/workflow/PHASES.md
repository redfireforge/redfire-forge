# Variables & Chaining / Workflow Builder — Phase Tracker

> Checklist for tracking implementation progress across all phases.

---

## Phase A — Engine + Basic Variable UI

**Branch**: `feature/variables-chaining-engine`
**Status**: Complete
**Estimated**: ~900 lines, ~2 weeks

### Tasks

- [x] **A1** — `VariableContext` class + built-in generators
  - [x] `src/engine/workflow/variableContext.ts`
  - [x] `resolve(template)` replaces `{{var}}` in strings
  - [x] `set()` / `get()` with layered priority (extracted > manual > env > generators)
  - [x] `child()` for per-VU isolation
  - [x] Built-in generators: `$uuid`, `$timestamp`, `$isoDate`, `$randomInt(min,max)`, `$randomEmail`, `$randomString(len)`

- [x] **A2** — `resolveScenario()` preprocessor
  - [x] `src/engine/workflow/resolveScenario.ts`
  - [x] Substitutes `{{vars}}` in: `url`, `headers[].value`, `body`, `bodyForm[].value`, `auth.token`, `auth.apiKeyValue`
  - [x] Returns new `Scenario` (does not mutate original)

- [x] **A3** — `Extraction` type + `extractVariables()`
  - [x] Add `Extraction` interface to `src/types/index.ts`
  - [x] Add `extractions?: Extraction[]` to `Scenario` type
  - [x] `src/engine/workflow/extractVariables.ts`
  - [x] Support sources: `body` (JSONPath), `header`, `status`
  - [x] Fallback values when extraction fails

- [x] **A4** — `runWorkflow()` execution mode
  - [x] `src/engine/workflow/workflowRunner.ts`
  - [x] Sequential execution with variable chaining
  - [x] `runWorkflowLoad()` for repeated iterations with isolated per-VU contexts
  - [x] Progress callback for UI updates
  - [x] Abort signal + circuit breaker support
  - [x] Full response body/headers accessible for extraction (not truncated)

- [x] **A5** — Integrate into existing executor + worker
  - [x] Add `'workflow'` to `ExecutionMode` type
  - [x] Route to `runWorkflow()` in `executor.ts`
  - [x] Worker inherits workflow support via `runTest()` routing
  - [x] Added `workflowVariables?: Record<string, string>` to `TestConfig`

- [x] **A6** — CLI: `extract`, `variables`, `mode: workflow`
  - [x] Add `extract` key to `TestFileScenario` in `cli/loader.ts`
  - [x] Add `variables` key to `TestFile`
  - [x] Map `mode: workflow` to new execution mode
  - [x] Pass `workflowVariables` through `buildTestConfig()`

- [x] **A7** — UI: Extraction tab in TestEditorModal
  - [x] New "Extract" tab alongside existing Params/Body/Headers/Auth/Validation
  - [x] Source dropdown: body / header / status
  - [x] JSONPath expression input + variable name input
  - [x] Fallback value input
  - [x] Add/remove extraction rows with `{{varName}}` display

- [x] **A8** — UI: Variable panel
  - [x] `src/components/workflow/VariablePanel.tsx`
  - [x] Shows all variables as chips with `{{name}} = value` format
  - [x] `src/components/workflow/WorkflowVariablesInput.tsx` for initial variables editor

- [x] **A9** — UI: Workflow mode toggle
  - [x] Added "Workflow" radio button to execution mode selector
  - [x] Mode hint: "Multi-step chain: each request can extract values for the next step"
  - [x] Workflow Variables Input shown when workflow mode is active

- [ ] **A10** — Tests (deferred to after Phase A merge — test infrastructure pending)
  - [ ] `variableContext.test.ts` — resolution priority, generators, child isolation
  - [ ] `resolveScenario.test.ts` — substitution in all fields
  - [ ] `extractVariables.test.ts` — JSONPath, header, status, fallbacks
  - [ ] `workflowRunner.test.ts` — sequential chain, conditions, delays
  - [ ] Integration: end-to-end workflow with real HTTP

### Phase A deliverables
- Variables work in URL, headers, body, auth
- Extractions capture response values into variables
- `workflow` mode runs scenarios sequentially with chaining
- CLI supports `extract` + `variables` + `mode: workflow`
- Basic UI: extraction tab + variable panel + mode toggle

---

## Phase B — Visual Workflow Builder (React Flow)

**Branch**: `feature/workflow-visual-builder`
**Status**: Not started
**Depends on**: Phase A complete
**Estimated**: ~1,200 lines, ~3 weeks

### Tasks

- [ ] **B1** — Add `@xyflow/react` dependency
- [ ] **B2** — Workflow + WorkflowStep + WorkflowEdge types (`src/types/workflow.ts`)
- [ ] **B3** — `WorkflowBuilder.tsx` — React Flow canvas + providers
- [ ] **B4** — `HttpStepNode.tsx` — custom node showing method/URL/extractions/assertions
- [ ] **B5** — `ConditionNode.tsx` — diamond decision node with true/false outputs
- [ ] **B6** — `DelayNode.tsx` — timer node with duration config
- [ ] **B7** — `WorkflowPalette.tsx` — draggable block sidebar
- [ ] **B8** — `WorkflowConfigPanel.tsx` — right panel with reused editor tabs
- [ ] **B9** — `WorkflowRunner.tsx` — execute workflow + animate node states
- [ ] **B10** — Workflow storage (save/load workflows)
- [ ] **B11** — `workflow-builder.css` styles
- [ ] **B12** — CATALOG integration: "Add to Workflow →" button
- [ ] **B13** — REQUESTS integration: "Add to Workflow →" button
- [ ] **B14** — HARNESS integration: "Run as Workflow" button

### Phase B deliverables
- Full drag-and-drop visual workflow builder
- Custom node components for HTTP, Condition, Delay
- Block palette, config panel, variable context bar
- Execution animation (nodes pulse, edges animate, variables update live)
- Integration with all three sections (CATALOG, REQUESTS, HARNESS)

---

## Phase C — Advanced Control Flow

**Branch**: `feature/workflow-advanced-controls`
**Status**: Not started
**Depends on**: Phase B complete
**Estimated**: ~800 lines, ~2 weeks

### Tasks

- [ ] **C1** — Parallel (Fork/Join) execution + node
- [ ] **C2** — Loop (For-Each / Repeat N / While) execution + node
- [ ] **C3** — Switch (multi-branch) node
- [ ] **C4** — Try/Catch error handler
- [ ] **C5** — Sub-workflow (reusable workflow call)

### Phase C deliverables
- Parallel branches with wait-all / wait-any merge
- Loop iteration over arrays, counts, and conditions
- Multi-way branching, error handling, workflow composition

---

## Phase D — Polish & Export

**Branch**: `feature/workflow-polish`
**Status**: Not started
**Depends on**: Phase B complete (C optional)
**Estimated**: ~400 lines, ~1 week

### Tasks

- [ ] **D1** — Export workflow as YAML (CLI-compatible)
- [ ] **D2** — Import workflow from YAML
- [ ] **D3** — Workflow results in dashboard (per-step timing breakdown)
- [ ] **D4** — Source-change tracking (sync badge when catalog/request changes)
- [ ] **D5** — CHANGELOG, ROADMAP, README updates

### Phase D deliverables
- Round-trip YAML export/import
- Per-step results with timing waterfall in dashboard
- Source sync indicators
- Documentation complete

---

## Progress Summary

| Phase | Tasks | Done | Status |
|---|---|---|---|
| **A** — Engine | 10 | 9 | Complete (tests deferred) |
| **B** — Visual UI | 14 | 0 | Not started |
| **C** — Advanced | 5 | 0 | Not started |
| **D** — Polish | 5 | 0 | Not started |
| **Total** | **34** | **9** | **26%** |

---

_Last updated: 2026-04-19_
