# Workflow ↔ Harness Integration Plan

> **Goal:** Enable users to run saved Workflows as performance tests in the Harness test runner — with full graph topology, configurable iterations/concurrency, and workflow-aware results reporting.

---

## 1. Current State Audit

### What Exists Today

| Layer | Component | Status | Notes |
|---|---|---|---|
| **Engine** | `runWorkflow()` | ✅ Done | Sequential chain with variable extraction, think time, circuit breaker |
| **Engine** | `runWorkflowLoad()` | ✅ Done | N iterations × M concurrency with isolated `VariableContext` per iteration |
| **Engine** | `executor.ts` `mode='workflow'` branch | ✅ Done | Routes to `runWorkflow` / `runWorkflowLoad` based on `totalTransactions` |
| **Types** | `ExecutionMode` includes `'workflow'` | ✅ Done | `'sequential' \| 'batch' \| 'pool' \| 'load-profile' \| 'workflow'` |
| **Types** | `TestConfig.workflowVariables` | ✅ Done | `Record<string, string>` — seeds the `VariableContext` |
| **UI** | Workflow mode radio button in Harness | ✅ Done | `RunnerExecutionConfig.tsx` — user can select "Workflow" mode |
| **UI** | `WorkflowVariablesInput` panel | ✅ Done | Shown when `executionMode === 'workflow'` — key-value input for initial vars |
| **UI** | Workflow picker / selector in Harness | ❌ Missing | No way to select a saved workflow definition |
| **UI** | "Run in Harness" button on Workflow Designer | ❌ Missing | Planned in DESIGN.md but not implemented |
| **UI** | Workflow-aware results display | ❌ Missing | Results show "Batch" label for workflow runs; no iteration grouping |
| **Data** | `TestConfig.workflowId` field | ❌ Missing | No reference to a workflow definition on `TestConfig` |
| **Engine** | `graphRunner` used in Harness mode | ❌ Missing | Harness workflow mode uses flat `workflowRunner` (step chain), not the full graph with conditions/forks/joins |
| **Engine** | Iteration-level reporting | ❌ Missing | All results from N iterations are flattened into one `RequestResult[]` |

### Key Gap: Flat Chain vs Graph Topology

The critical architectural gap is that Harness "workflow mode" currently uses `workflowRunner.ts` — a **flat sequential chain** of `Scenario[]` objects. It does **not** use `graphRunner.ts`, which handles the full graph topology (conditions, forks, joins, loops, switches, sub-workflows). This means:

- Branching logic is ignored
- Parallel fork/join paths are ignored
- Loop nodes are ignored
- The workflow is effectively reduced to a flat ordered list of HTTP steps

---

## 2. Competitive Landscape

### How Leading Tools Handle Workflow-Based Performance Testing

#### k6 (Grafana)

- **Model:** Code-first. Each VU runs a JavaScript function (`export default function()`) that can contain arbitrary multi-step logic including conditionals, loops, and variable extraction.
- **Scenarios:** Multiple named scenarios per script, each with its own executor (shared-iterations, per-VU-iterations, constant-VUs, ramping-VUs, constant/ramping-arrival-rate).
- **Multi-step chaining:** Native — just write sequential `http.get()` / `http.post()` calls in the function body. Variables are JS variables, naturally scoped per VU.
- **Iteration isolation:** Each VU function invocation is a clean iteration. Variables are local to the function scope.
- **Results:** Per-request metrics (response time, status) are automatically tagged with `scenario`, `method`, `name`, `status`. Groups can be used to aggregate related requests.
- **Key takeaway:** k6 treats the entire VU function as the "workflow". No separate workflow/harness split — the scenario IS the workflow.

#### Apache JMeter

- **Model:** XML-based test plan with hierarchical tree structure.
- **Thread Groups:** Configure number of threads (VUs), ramp-up period, loop count, and duration. Each thread executes the full test plan tree.
- **Multi-step chaining:** Samplers (HTTP Request, JDBC, etc.) execute in tree order. Logic Controllers (If, Loop, Transaction, Interleave, Random, Module) control flow.
- **Variable extraction:** Post-Processors (RegEx Extractor, JSON Extractor, CSS/JQuery Extractor) extract values from responses. Variables are thread-local (`${varName}`).
- **Transaction Controller:** Groups multiple samplers into a single "transaction" — reports aggregate timing for the group. This is how JMeter measures workflow-level performance.
- **Test Fragments + Module Controller:** Reusable workflow fragments that can be referenced from multiple thread groups.
- **Results:** Per-sampler and per-transaction metrics. Aggregate Report, Summary Report, Graph Results listeners. JTL (XML/CSV) output.
- **Key takeaway:** JMeter's Transaction Controller is the closest analog to "run a workflow as a performance test". Thread Groups wrap the workflow with iteration/concurrency config. Logic controllers provide branching.

#### Locust (Python)

- **Model:** Python code. Each `HttpUser` subclass defines `@task` methods that are picked randomly (weighted).
- **Multi-step chaining:** Tasks are regular Python methods — write sequential HTTP calls with variable passing via `self` attributes. `on_start()` runs once per user (login, setup).
- **Concurrency:** User count + spawn rate. Each user runs tasks in its own greenlet.
- **Variable isolation:** Each user instance has its own `self` state — naturally isolated.
- **Sequential workflows:** Use `SequentialTaskSet` to force ordered execution of steps within a task group.
- **Results:** Per-request statistics with name grouping. Response time percentiles, RPS, failure rate.
- **Key takeaway:** Locust's `SequentialTaskSet` is the workflow concept. Users run tasks with natural Python flow control. No separate "workflow designer" — the code IS the workflow.

#### Postman

- **Model:** GUI-based. Collections contain ordered requests. Collection Runner iterates over the collection.
- **Performance Testing:** Collection Runner with configurable virtual users, iterations, and duration. Each VU runs the entire collection.
- **Multi-step chaining:** Requests run in order. `pm.environment.set()` / `pm.variables.set()` in test scripts pass data between requests. `postman.setNextRequest()` enables branching.
- **Variable isolation:** Environment and collection variables are shared; local variables are per-request.
- **Results:** Per-request response time, error rate. Aggregate metrics with percentiles.
- **Key takeaway:** Postman's collection IS the workflow. The Collection Runner IS the harness. They are the same concept — select a collection, configure VUs/iterations, run.

### Competitive Comparison Matrix

| Feature | k6 | JMeter | Locust | Postman | RedfireForge (Current) | RedfireForge (Planned) |
|---|---|---|---|---|---|---|
| Multi-step workflow definition | JS function | XML tree | Python class | Collection | Visual graph designer ✅ | Same |
| Performance test configuration | Scenario executors | Thread Group | User count + spawn rate | Collection Runner | Harness TestConfig ✅ | Same |
| **Workflow → Perf test bridge** | Same thing | Same thing | Same thing | Same thing | ❌ Disconnected | ✅ Unified |
| Branching in perf tests | JS if/else | Logic Controllers | Python if/else | `setNextRequest()` | ❌ Flat chain only | ✅ Full graph |
| Parallel paths in perf tests | `http.batch()` | Parallel Controller | `gevent.spawn()` | ❌ | ❌ | ✅ Fork/Join |
| Iteration-level reporting | Per-VU metrics | Transaction Controller | Per-user stats | Per-VU response times | ❌ Flattened | ✅ Per-iteration |
| Variable isolation per iteration | JS function scope | Thread-local vars | `self` attributes | Local vars | ✅ Child VariableContext | Same |
| Think time | `sleep()` | Timer elements | `wait_time` | Pre-request delay | ✅ configurable | Same |

### Key Insight from Competitors

**Every major tool treats the workflow and the performance test as the same concept.** There is no separate "designer" and "harness" — the workflow definition IS what gets iterated under load. RedfireForge's visual graph designer is a differentiator, but the gap is that selecting a workflow for load testing requires manual re-creation in the Harness rather than direct reference.

---

## 3. Implementation Plan

### Phase 1: Data Model & Type Changes (Foundation)

**Priority: Critical | Effort: Small**

#### 1.1 Add `workflowId` to `TestConfig`

```typescript
// src/shared/types/index.ts
export interface TestConfig {
  // ... existing fields ...
  workflowId?: string;           // NEW: reference to a saved workflow definition
  workflowVariables?: Record<string, string>;  // existing
}
```

#### 1.2 Add `iterationIndex` to `RequestResult`

```typescript
// src/shared/types/index.ts
export interface RequestResult {
  // ... existing fields ...
  iterationIndex?: number;  // NEW: which iteration produced this result (0-based)
  workflowNodeId?: string;  // NEW: which workflow node produced this result
}
```

#### 1.3 Update `ExecutionMode` documentation

No type change needed — `'workflow'` already exists. Update JSDoc comments to clarify that workflow mode now supports full graph execution, not just flat chaining.

---

### Phase 2: Workflow Picker in Harness UI

**Priority: Critical | Effort: Medium**

#### 2.1 Workflow Selector Component

When `executionMode === 'workflow'`, show a dropdown/combobox to select a saved workflow:

```
┌─────────────────────────────────────┐
│ Execution Mode: ◉ Workflow          │
│                                     │
│ Workflow:  [▼ Order API E2E Flow  ] │
│            ┌───────────────────────┐ │
│            │ Order API E2E Flow   │ │
│            │ User Registration    │ │
│            │ Payment Processing   │ │
│            │ Search & Filter      │ │
│            └───────────────────────┘ │
│                                     │
│ Iterations: [100]  Concurrency: [10]│
│ Think Time: [── 500ms ──]           │
│                                     │
│ Initial Variables:                  │
│   baseUrl = https://api.example.com │
│   apiKey  = sk-test-xxx             │
│                                     │
│        [▶ Run Performance Test]     │
└─────────────────────────────────────┘
```

**Implementation:**

- New component: `WorkflowPicker.tsx` in `src/features/test-runner/components/`
- Props: `workflows: Workflow[]`, `selectedId: string | null`, `onChange: (id: string) => void`
- Source workflows from the existing workflow store (same data backing the Workflow Designer sidebar)
- When a workflow is selected, auto-populate `workflowVariables` from the workflow's defined variables
- Hide the scenario checkbox tree when a workflow is selected (scenarios come from the workflow graph, not manual selection)

#### 2.2 Disable Scenario Selection in Workflow Mode

When `executionMode === 'workflow'` AND a workflow is selected:
- Gray out / hide the FeatureGroup scenario tree
- Show a read-only summary of the workflow's HTTP nodes: "This workflow has N HTTP steps: Step 1 → Step 2 → ..."
- Scenarios are derived from the workflow graph, not manually selected

---

### Phase 3: Graph-Based Execution in Harness

**Priority: Critical | Effort: Medium**

#### 3.1 Route Harness Workflow Mode Through `graphRunner`

Currently, `executor.ts` routes workflow mode to `runWorkflow()` (flat chain). Change this to route through `runGraph()` (full topology) when a `workflowId` is present.

**In `executor.ts`:**

```typescript
if (mode === 'workflow' && config.workflowId) {
  // Full graph execution — use the same engine as the Workflow Designer
  const workflow = resolveWorkflow(config.workflowId);  // lookup from store
  return runGraphLoad(workflow, iterations, concurrency, opts, config.workflowVariables);
}
if (mode === 'workflow') {
  // Legacy flat chain (backward compatible)
  const ctx = new VariableContext(config.workflowVariables);
  return runWorkflow(scenarios, opts, ctx);
}
```

#### 3.2 New `runGraphLoad()` Function

Create a load-testing wrapper around `runGraph()`, similar to how `runWorkflowLoad()` wraps `runWorkflow()`:

```typescript
// src/features/workflow/engine/graphLoadRunner.ts
export async function runGraphLoad(
  workflow: Workflow,
  iterations: number,
  concurrency: number,
  opts: RunOpts,
  initialVariables?: Record<string, string>,
): Promise<RequestResult[]> {
  const allResults: RequestResult[] = [];
  let iterationIndex = 0;

  const runOne = async (): Promise<void> => {
    const myIndex = iterationIndex++;
    const results = await runGraph(
      workflow.nodes,
      workflow.edges,
      { ...initialVariables },
      {
        onNodeStateChange: () => {},  // no canvas animation in harness mode
        onVariablesChange: () => {},
        onComplete: (results, passed, durationMs) => {
          // Tag each result with iteration index
          for (const r of results) {
            r.iterationIndex = myIndex;
          }
          allResults.push(...results);
        },
      },
    );
  };

  // Concurrency pool (same pattern as runWorkflowLoad)
  // ...
}
```

#### 3.3 Environment & Service Resolution

When running a workflow in Harness mode, resolve environments and services the same way the Workflow Designer does:
- `resolveHttpBaseUrl` — look up the service registry for the selected environment
- `resolveHttpAuth` — look up auth profiles
- `environmentLayer` — inject base URL from the selected Harness environment

---

### Phase 4: Workflow-Aware Results Display

**Priority: High | Effort: Medium**

#### 4.1 Execution Mode Label

Fix `ResultsDashboard.tsx` to show "Workflow" instead of "Batch" when `executionMode === 'workflow'`.

#### 4.2 Iteration-Level Grouping

When results have `iterationIndex`, enable a grouping view:

```
┌─────────────────────────────────────────────────┐
│ Workflow: Order API E2E Flow                    │
│ 100 iterations × 10 concurrency                │
│ Overall: 95% pass | avg 1,234ms | p95 2,100ms  │
├─────────────────────────────────────────────────┤
│ Per-Step Summary:                               │
│  Step 1: Create Order   — avg 245ms  p95 410ms │
│  Step 2: Get Order      — avg 120ms  p95 200ms │
│  Step 3: Update Order   — avg 189ms  p95 350ms │
│  Step 4: Verify Status  — avg 95ms   p95 160ms │
├─────────────────────────────────────────────────┤
│ Per-Iteration Detail:               [Expand ▼]  │
│  Iter #1: ✅ 649ms (4/4 passed)                │
│  Iter #2: ✅ 712ms (4/4 passed)                │
│  Iter #3: ❌ 1,203ms (3/4 — Step 3 failed)    │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

#### 4.3 Per-Step Aggregate Metrics

Group `RequestResult[]` by `workflowNodeId` and compute:
- Count, pass rate, avg/min/max/p50/p95/p99 response time per step
- Error distribution per step
- This gives "which step is the bottleneck?" visibility

#### 4.4 Iteration Timeline Chart

Extend the existing live chart to show:
- X-axis: time
- Y-axis: response time per iteration (total workflow time)
- Color: green (pass) / red (fail)
- Overlay: per-step breakdown within each iteration bar

---

### Phase 5: "Run in Harness" Button

**Priority: Medium | Effort: Small**

#### 5.1 Button on Workflow Toolbar

Add a "Run in Harness" button (or "Performance Test" button) to the Workflow Designer toolbar:

```
[▶ Run] [🐛 Debug] [⚡ Performance Test] [⋯]
```

#### 5.2 Navigation Action

Clicking the button:
1. Switches to the Harness sidebar tab
2. Auto-selects `executionMode = 'workflow'`
3. Pre-selects the current workflow in the workflow picker
4. Pre-populates `workflowVariables` from the workflow's current variable context
5. Focuses the iterations/concurrency inputs for the user to configure

---

### Phase 6: CLI Support

**Priority: Medium | Effort: Small**

#### 6.1 CLI Workflow Performance Test Command

Extend the CLI to support graph-based workflow load testing:

```bash
# Run a saved workflow as a performance test
redfireforge run --workflow order-flow.json --iterations 100 --concurrency 10

# With variables
redfireforge run --workflow order-flow.json --iterations 50 --concurrency 5 \
  --var baseUrl=https://staging.api.example.com \
  --var apiKey=sk-test-xxx
```

#### 6.2 CLI Reporter Enhancements

Add workflow-aware output to the JUnit and JSON reporters:
- Per-step metrics in the summary
- Iteration-level test cases in JUnit XML (each iteration = one `<testcase>`)
- `workflowName` and `iterationIndex` fields in JSON output

---

## 4. Implementation Priority & Sequencing

```
Phase 1 (Types)  ──→  Phase 2 (Picker UI)  ──→  Phase 3 (Graph Engine)
                                                        │
                                                        ▼
Phase 5 (Run in Harness btn)  ←──  Phase 4 (Results Display)
                                          │
                                          ▼
                                   Phase 6 (CLI)
```

| Phase | Priority | Effort | Depends On |
|---|---|---|---|
| 1. Data Model & Types | Critical | S | — |
| 2. Workflow Picker UI | Critical | M | Phase 1 |
| 3. Graph-Based Execution | Critical | M | Phase 1 |
| 4. Results Display | High | M | Phase 3 |
| 5. "Run in Harness" Button | Medium | S | Phase 2 |
| 6. CLI Support | Medium | S | Phase 3 |

**Estimated total: ~6 implementation tasks across 3 priority tiers.**

---

## 5. Design Principles

1. **Workflow IS the test.** Follow industry consensus: the workflow graph IS what gets iterated under load. Don't require users to manually re-select scenarios.

2. **Graph fidelity.** Run the full `graphRunner` topology under load, not a flattened chain. Conditions, forks, joins, loops, and switches should all execute during performance tests — that's the real user journey.

3. **Iteration isolation.** Each iteration gets a fresh `VariableContext` child. No cross-iteration state leakage.

4. **Backward compatibility.** The existing flat-chain `runWorkflow()` path remains for legacy `mode='workflow'` without `workflowId`. No breaking changes.

5. **Per-step observability.** Tag every result with `iterationIndex` and `workflowNodeId` so results can be sliced by step and by iteration — answering both "which step is slow?" and "which iteration failed?".

---

## 6. Non-Goals (Out of Scope)

- **Distributed execution** — Multi-machine load generation is Phase 1.x territory
- **Recording/playback** — HAR-to-workflow conversion (like Locust's `har2locust`)
- **Real browser rendering** — Workflow steps are API calls, not browser interactions
- **Workflow editing from Harness** — The Harness references a workflow; editing happens in the Workflow Designer

---

## 7. Success Criteria

- [ ] User can select a saved workflow in the Harness and run it as a performance test
- [ ] Full graph topology (conditions, forks, joins, loops) is respected during load runs
- [ ] Results show per-step aggregate metrics (avg, p50, p95, p99 per workflow node)
- [ ] Results show per-iteration pass/fail with total duration
- [ ] "Run in Harness" button on Workflow Designer toolbar navigates to pre-configured Harness
- [ ] CLI supports `--workflow` flag for graph-based load testing
- [ ] Existing flat-chain workflow mode continues to work (backward compatible)

---

_Created: 2026-05-01 | Status: Proposed | Related: [DESIGN.md](../workflow/DESIGN.md) §6 Cross-Feature Integration, [ROADMAP.md](../../ROADMAP.md) Phase 0.7.5_
