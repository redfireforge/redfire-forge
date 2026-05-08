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

**Priority: Critical | Effort: Small | Status: ✅ COMPLETE**

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

**Priority: Critical | Effort: Medium | Status: ✅ COMPLETE**

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

**Priority: Critical | Effort: Medium | Status: ✅ COMPLETE**

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

**Priority: High | Effort: Medium | Status: ✅ COMPLETE**

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

**Priority: Medium | Effort: Small | Status: ✅ COMPLETE**

#### 5.1 Button on Workflow Toolbar

Added a "Run in Harness" button to the Workflow Designer toolbar (between Versions and Environment selector):

```
[Services] [Workflow Variables] [Versions] [📊 Run in Harness] [Env…] | [Save] [▶ Quick Test] [🐛 Debug]
```

#### 5.2 Navigation Action

Clicking the button:
1. ✅ Navigates to the Workflow Runner tab (Testing domain)
2. ✅ Pre-selects the current workflow in the workflow picker
3. ✅ Pre-populates initial variables from the workflow's default variable context
4. ✅ Button is disabled during execution and hidden in preview mode

**Files Modified:**
- `src/features/workflow/components/canvas/WorkflowToolbar.tsx` — Added `onRunInHarness` prop and button
- `src/features/workflow/WorkflowDesigner.tsx` — Added `onRunInHarness` prop, passed to toolbar
- `src/features/test-runner/WorkflowRunner.tsx` — Added `initialWorkflowId` and `onClearInitialWorkflowId` props
- `src/app/App.tsx` — Wired `handleRunInHarness` callback to WorkflowDesigner and WorkflowRunner

**Unit Tests:**
- `src/features/workflow/components/canvas/WorkflowToolbar.test.tsx` — New test file (5 tests)
- `src/features/test-runner/WorkflowRunner.test.tsx` — Added 2 tests for initial workflow selection

---

### Phase 6: CLI Support

**Priority: Medium | Effort: Small | Status: ✅ COMPLETE**

#### 6.1 CLI Workflow Performance Test Command

Added `redfireforge workflow` command for graph-based workflow load testing:

```bash
# Run a workflow file as a performance test
npx tsx cli/index.ts workflow workflow-file.yaml --iterations 100 --concurrency 10

# With variable overrides
npx tsx cli/index.ts workflow workflow-file.yaml -i 50 -c 5 \
  --var baseUrl=https://staging.api.example.com \
  --var apiKey=sk-test-xxx

# With reporters
npx tsx cli/index.ts workflow workflow-file.yaml -i 10 -c 2 \
  --junit results.xml --markdown results.md --output results.json

# Validate without running
npx tsx cli/index.ts validate-workflow workflow-file.yaml
```

**CLI Options:**
- `-i, --iterations <n>` — Total workflow iterations (default: 10)
- `-c, --concurrency <n>` — Concurrent iterations (default: 1)
- `--var <vars...>` — Set variables (format: name=value)
- `--timeout <sec>` — Per-request timeout
- `--error-policy <policy>` — continue, stop-first, stop-threshold
- `--fail-on-error` — Exit code 1 if any request fails
- `--fail-threshold <pct>` — Exit code 1 if error rate exceeds threshold
- `-o, --output <path>` — Write JSON report
- `--junit <path>` — Write JUnit XML report
- `--markdown <path>` — Write Markdown report
- `-q, --quiet` — Suppress progress output

#### 6.2 CLI Reporter Enhancements

✅ Added workflow-aware reporters:
- Console summary with per-step metrics and failed iterations
- JUnit XML with each iteration as a `<testcase>`
- Markdown report with per-step metrics table and failed iteration details
- JSON report with `workflowId`, `workflowName`, and `executionMode: 'workflow'`

#### 6.3 Simplified Workflow YAML Format

The workflow loader supports both full and simplified formats for HTTP nodes:

```yaml
# Simplified format (auto-expanded)
- id: get-users
  type: http
  position: { x: 0, y: 0 }
  data:
    label: Get Users
    method: GET
    url: "{{baseUrl}}/users"
    headers:
      Accept: application/json

# Full format (same as UI export)
- id: get-users
  type: http
  position: { x: 0, y: 0 }
  data:
    label: Get Users
    scenario:
      id: get-users-scenario
      name: Get Users
      url: "{{baseUrl}}/users"
      method: GET
      headers: []
      auth:
        type: none
      validation:
        mode: none
```

**Files Added/Modified:**
- `cli/index.ts` — Added `workflow` and `validate-workflow` commands
- `cli/workflowLoader.ts` — New file: loads and normalizes workflow YAML/JSON
- `cli/reporters.ts` — Added `printWorkflowConsoleSummary`, `buildWorkflowJunitXml`, `buildWorkflowMarkdownReport`
- `examples/workflow-cli-sample.yaml` — Sample workflow for CLI testing

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
| 7. Event-Driven Node Load Testing | Medium | L | Phase 3 |

**Estimated total: ~7 implementation tasks across 3 priority tiers.**

---

## 5. Phase 7: Event-Driven Node Load Testing (Webhooks, Correlation Waits, Polling)

> **Problem:** Standard workflow nodes (HTTP, Condition, Fork/Join) are self-contained — the engine drives them. But three node types are **externally-driven**: they pause execution and wait for something from outside. Running N concurrent iterations of these workflows requires solving the "who triggers the external event?" problem.

### 5.1 The Challenge

| Node Type | Runtime Behavior | Load Testing Problem |
|---|---|---|
| **Webhook Trigger** | Workflow starts when an external HTTP POST hits `/api/webhooks/:path` | The load runner needs to **send** N webhook requests to trigger N workflow iterations — the traditional "configure iterations and click Run" model doesn't apply |
| **CorrelationWait** | Pauses mid-workflow, registers in `correlationStore`, waits for a specific webhook callback matched by `correlationId` | Each of N iterations blocks on a **unique** `correlationId` — needs N matching external callbacks to arrive before the workflow can continue |
| **WaitForCondition** | Polls a body sub-graph repeatedly (interval + timeout + max attempts) until a condition expression evaluates to true | Each of N iterations polls independently — N iterations × M poll attempts = N×M API calls, which can overwhelm the target system |

### 5.2 Strategy 1: Synthetic Event Injector (Recommended for CorrelationWait)

The load runner itself acts as the external system. A background "event injector" monitors the `correlationStore` and automatically fires matching webhook callbacks after a configurable delay.

**How it works:**

```
Iteration #1:
  Start → HTTP Create Order → CorrelationWait(correlationId={{paymentId}})
                                       │
                                       ▼ (pauses, registers pay_001 in correlationStore)
                                       │
       [Event Injector] monitors correlationStore
                │
                ▼ (sees pay_001 waiting, waits configurable delay)
                │
                POST /api/webhooks/payment-callback { paymentId: "pay_001", status: "completed" }
                                       │
                                       ▼ (correlationStore.resume("pay_001") called)
                                       │
                               CorrelationWait resolves → continues to next node
```

**Implementation:**

```typescript
// src/features/workflow/engine/syntheticEventInjector.ts

export interface SyntheticEventConfig {
  /** Delay before sending the synthetic webhook (ms). Simulates real-world latency. */
  responseDelayMs: number;
  /** Mock payload template. Supports {{correlationId}} placeholder. */
  payloadTemplate: Record<string, unknown>;
  /** Optional jitter range (ms) added to responseDelayMs for realistic variance. */
  jitterMs?: number;
}

export class SyntheticEventInjector {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private correlationStore: ICorrelationStore,
    private config: SyntheticEventConfig,
    private webhookEndpoint: (path: string, body: Record<string, unknown>) => Promise<void>,
  ) {}

  start(): void {
    // Poll correlationStore every 50ms for new paused entries
    this.interval = setInterval(() => {
      for (const entry of this.correlationStore.listPaused()) {
        const delay = this.config.responseDelayMs + randomJitter(this.config.jitterMs);
        setTimeout(() => {
          const payload = resolveTemplate(this.config.payloadTemplate, entry.correlationId);
          this.correlationStore.resume(entry.correlationId, payload);
        }, delay);
      }
    }, 50);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
```

**UI in Harness (when workflow contains CorrelationWait nodes):**

```
┌───────────────────────────────────────────────────────────┐
│ ⚡ Event-Driven Nodes Detected                           │
│                                                           │
│ This workflow has 1 CorrelationWait node:                 │
│   • "Wait for Payment Callback" (correlationId={{paymentId}}) │
│                                                           │
│ Load Test Mode:                                           │
│   ◉ Auto-resume with synthetic events                    │
│     Response delay: [200ms]  Jitter: [±50ms]             │
│     Mock payload:                                         │
│     ┌──────────────────────────────────────┐              │
│     │ { "status": "completed",            │              │
│     │   "paymentId": "{{correlationId}}" } │              │
│     └──────────────────────────────────────┘              │
│   ○ Auto-resume immediately (skip wait, use mock payload)│
│   ○ Real external system (requires external event source)│
└───────────────────────────────────────────────────────────┘
```

### 5.3 Strategy 2: Auto-Resume Mode (Lightweight, for CI/Smoke Tests)

For quick performance smoke tests, CorrelationWait nodes can skip the actual wait entirely and immediately resolve with a pre-configured mock payload.

**Implementation:**

Add a `performanceTestBehavior` option to `CorrelationWaitNodeData`:

```typescript
interface CorrelationWaitNodeData {
  // ... existing fields ...
  performanceTestBehavior?: {
    mode: 'wait-for-real' | 'auto-resume' | 'synthetic-inject';
    mockPayload?: Record<string, unknown>;
    syntheticDelayMs?: number;
  };
}
```

In `handleCorrelationWaitNode`, when running under load:

```typescript
if (loadTestMode && data.performanceTestBehavior?.mode === 'auto-resume') {
  // Skip the real wait — immediately inject mock data
  const mockPayload = data.performanceTestBehavior.mockPayload ?? {};
  hCtx.ctx.set('webhook.body', JSON.stringify(mockPayload));
  hCtx.ctx.set('webhook.correlationId', correlationId);
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  return;
}
```

#### Important: Quick Test vs Workflow Runner

| Feature | Quick Test | Workflow Runner |
|---------|------------|-----------------|
| **Purpose** | Debug single workflow runs | Load/performance testing |
| **CorrelationWait behavior** | Always waits for real webhooks | Respects Load Test Behavior setting |
| **Auto-Resume mode** | ❌ Not applied | ✅ Skips wait, injects mock payload |
| **Synthetic Inject mode** | ❌ Not applied | ✅ Waits configured delay, then injects |
| **Use case** | Verify workflow logic works | Test workflow under load |

**Quick Test** is designed for debugging and always executes the workflow as it would run in production, including waiting for real external webhook callbacks. This ensures you can verify the actual integration works.

**Workflow Runner** is for load testing. Since you can't realistically coordinate thousands of external webhooks during a load test, the Load Test Behavior settings allow you to skip or simulate the wait.

To test a workflow with Auto-Resume:
1. Configure the CorrelationWait node with "Auto-Resume" mode and a mock payload
2. Save the workflow
3. Navigate to **Workflow Runner** (not Quick Test)
4. Select the workflow and configure iterations/concurrency
5. Click Run — the CorrelationWait node will immediately inject the mock payload and continue

### 5.4 Strategy 3: Webhook Trigger Load Driver

For workflows that **start** with a Webhook Trigger node (instead of a Start node), the traditional "N iterations" model doesn't work — the workflow only runs when an HTTP POST arrives.

**Solution: Webhook Load Driver**

Instead of iterating `runGraph()` N times internally, the load runner sends N HTTP requests to the workflow's webhook endpoint:

```
┌─────────────────────────────────────────────────────┐
│ Webhook Load Test Configuration                     │
│                                                     │
│ Workflow: "Payment Processing"                      │
│ Trigger: Webhook at /api/webhooks/payment-events    │
│                                                     │
│ Request Rate:                                       │
│   ◉ Fixed rate: [50] requests/sec for [60] seconds │
│   ○ Ramp: [10] → [100] requests/sec over [120] sec │
│   ○ Burst: [200] requests in [5] seconds            │
│                                                     │
│ Payload Template:                                   │
│ ┌─────────────────────────────────────────┐         │
│ │ { "event": "payment.created",          │         │
│ │   "amount": {{$randomInt(100,9999)}},   │         │
│ │   "orderId": "{{$uuid}}" }              │         │
│ └─────────────────────────────────────────┘         │
│                                                     │
│ Built-in generators: {{$uuid}}, {{$randomInt}},     │
│   {{$randomEmail}}, {{$timestamp}}, {{$isoDate}}    │
│                                                     │
│         [▶ Run Webhook Load Test]                   │
└─────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/features/workflow/engine/webhookLoadDriver.ts

export async function runWebhookLoadTest(
  webhookUrl: string,
  payloadTemplate: string,
  config: {
    mode: 'fixed-rate' | 'ramp' | 'burst';
    ratePerSec: number;
    durationSec: number;
    rampTo?: number;
  },
  onProgress: (sent: number, completed: number, results: RequestResult[]) => void,
  abortSignal?: AbortSignal,
): Promise<RequestResult[]> {
  // Use the existing variable generator system ({{$uuid}}, etc.)
  // to create unique payloads per request.
  // Fire HTTP POSTs to the webhook endpoint at the configured rate.
  // Collect responses (the webhook server returns execution results).
}
```

The webhook server (`src-server/webhook-server.ts`) already handles incoming webhooks and triggers workflow execution via `executeWorkflow()`. The load driver just needs to send requests at the right rate.

### 5.5 WaitForCondition Poll Throttle

WaitForCondition nodes poll a sub-graph repeatedly. Under load, N iterations × M polls = N×M sub-graph executions. If the sub-graph contains HTTP calls, this can overwhelm the target.

**Solution: Global poll concurrency limiter**

```typescript
// In runGraphLoad(), when constructing the NodeHandlerContext:
const pollSemaphore = new Semaphore(config.maxConcurrentPolls ?? 20);

// In handleWaitForConditionNode, before each poll attempt:
await pollSemaphore.acquire();
try {
  for (const e of bodyEdges) {
    await hCtx.visit(e.target, `${hCtx.threadId}-poll-${attempt}`);
  }
} finally {
  pollSemaphore.release();
}
```

**UI addition:**

```
┌───────────────────────────────────────────────────────────┐
│ ⚡ Polling Nodes Detected                                │
│                                                           │
│ This workflow has 1 WaitForCondition node:                │
│   • "Wait for Order Shipped" (polls every 2000ms)        │
│                                                           │
│ Max concurrent polls across all iterations: [20]          │
│ (Prevents poll storms against your target API)            │
└───────────────────────────────────────────────────────────┘
```

### 5.6 Combined Example: End-to-End Payment Flow

A real-world workflow with all three event-driven patterns:

```
Webhook Trigger ──→ HTTP: Validate Payment ──→ HTTP: Create Order ──→ CorrelationWait(orderId)
  (payment.created)                                                       │
                                                                          ▼ (waits for shipment webhook)
                                                          HTTP: Confirm Shipment ──→ WaitForCondition
                                                                                       │ (polls: GET /orders/{{orderId}})
                                                                                       │ (condition: status == "delivered")
                                                                                       ▼
                                                                                  HTTP: Send Receipt
```

**Load test config for this workflow:**

| Setting | Value | Why |
|---|---|---|
| Webhook driver rate | 50 req/s for 60s | Simulates payment gateway sending events |
| CorrelationWait mode | Synthetic inject, 500ms ± 100ms delay | Simulates shipment system callback latency |
| WaitForCondition throttle | Max 20 concurrent polls | Prevents overwhelming order status API |
| Expected total requests | ~3,000 webhook triggers → ~3,000 orders → ~3,000 correlation resumes → ~15,000 polls → ~3,000 receipts | Natural amplification from poll loop |

### 5.7 Implementation Sequence

```
Phase 7a: Auto-resume mode for CorrelationWait (simplest, enables CI smoke tests) ✅ COMPLETE
    ↓
Phase 7b: Synthetic Event Injector (realistic delays, production-like)
    ↓
Phase 7c: Webhook Trigger Load Driver (replace "N iterations" with "N webhook POSTs")
    ↓
Phase 7d: WaitForCondition poll throttle (prevent poll storms)
    ↓
Phase 7e: Visual Execution Replay (show results on workflow diagram)
    ↓
Phase 7f: Multi-Webhook Testing UI (advanced workflows with multiple CorrelationWait nodes)
```

| Sub-phase | Priority | Effort | Depends On | Status |
|---|---|---|---|---|
| 7a. Auto-resume mode | High | S | Phase 3 | ✅ COMPLETE |
| 7b. Synthetic Event Injector | Medium | M | Phase 3, 7a | ✅ COMPLETE |
| 7c. Webhook Load Driver | Medium | M | Phase 3 | ✅ COMPLETE |
| 7d. Poll throttle | Medium | S | Phase 3 | ✅ COMPLETE |
| 7e. Visual Execution Replay | Medium | L | Phase 3, 4 | ✅ COMPLETE |
| 7f. Multi-Webhook Testing UI | Low | L | Phase 7a, 7e | ✅ COMPLETE |

### 5.8 Success Criteria for Phase 7

- [x] CorrelationWait nodes can auto-resume with mock payload during load tests (Phase 7a)
- [x] Synthetic Event Injector monitors `correlationStore` and fires callbacks with configurable delay + jitter (Phase 7b)
- [x] Webhook-triggered workflows can be load tested by sending N webhook POSTs at a configured rate (Phase 7c)
- [x] WaitForCondition polling is throttled across iterations to prevent poll storms (Phase 7d)
- [x] Harness UI detects event-driven nodes and shows appropriate configuration panels (Phase 7a)
- [x] Per-node metrics distinguish between "time waiting for event" and "time executing HTTP call"
- [x] Visual Execution Replay: Show workflow diagram with execution results overlay (Phase 7e)
- [x] Multi-Webhook Testing UI: Workflow visualization with webhook queue for complex multi-webhook workflows (Phase 7f)

### 5.9 Phase 7e: Visual Execution Replay (NEW)

After running a workflow in Workflow Runner, users should be able to visualize the execution flow on the workflow diagram. This helps users understand what actually happened during the test.

#### Features

1. **View Execution Flow Button** — After run completes, show "View Execution Flow" button that opens replay view
2. **Read-only Workflow Canvas** — Renders the workflow diagram with execution state overlaid
3. **Node State Visualization** — Color nodes by pass/fail/skipped state from the run
4. **Edge Path Highlighting** — Show which edges were actually traversed
5. **Node Detail on Click** — Click any node to see:
   - Input variables at that point
   - Request/response details (for HTTP nodes)
   - Extracted variables
   - Timing info
   - Error details if failed
6. **Iteration Selector** — For multi-iteration runs, pick specific iteration to replay
7. **Aggregate View** — Show aggregate metrics overlay (e.g., "95% pass, avg 120ms")

#### Data Model Changes

Add `WorkflowExecutionTrace` to `TestRun` for workflow runs:

```typescript
interface WorkflowExecutionTrace {
  // Per-iteration traces (or single trace for 1 iteration)
  iterations: Array<{
    index: number;
    passed: boolean;
    durationMs: number;
    // Ordered list of node execution events
    events: Array<{
      nodeId: string;          // React Flow node ID
      nodeType: string;        // 'http', 'condition', 'delay', etc.
      nodeLabel: string;
      timestamp: number;
      state: 'pass' | 'fail' | 'skipped';
      durationMs?: number;
      details?: {
        statusCode?: number;
        responseTimeMs?: number;
        requestResultId?: string;  // Link to RequestResult
        conditionResult?: boolean;
        inputVariables?: Record<string, string>;
        extractedVariables?: Record<string, string>;
        error?: string;
      };
    }>;
    // Final variable state
    finalVariables: Record<string, string>;
  }>;
  // Which edges were traversed (for highlighting paths)
  traversedEdges: string[];  // Edge IDs
}
```

#### Implementation Tasks

1. **Fix `workflowNodeId`** — Store actual React Flow node ID instead of scenario ID
2. **Capture execution trace** — Add event logging to `runGraph` callbacks
3. **Store trace in `TestRun`** — Add `executionTrace` field to `TestRun`
4. **Create `WorkflowExecutionReplay` component** — Read-only canvas with overlaid results
5. **Create `NodeExecutionDetail` panel** — Show input/output/variables on click
6. **Add "View Execution Flow" action** — Button in results dashboard
7. **Handle multi-iteration** — Iteration selector + aggregate view
8. **Optimize storage** — Consider compression for large traces

### 5.10 Phase 7f: Multi-Webhook Testing UI ✅ COMPLETED

For complex workflows with multiple CorrelationWait nodes, the current "Wait for Real Webhook" mode requires manual curl commands for each webhook. This phase adds advanced UI to make testing multi-webhook workflows more user-friendly.

#### Implementation Summary (Completed May 2026)

**Components Created:**
- `MultiWebhookTestingPanel.tsx` — Orchestrated multi-callback testing UI with:
  - Simplified workflow visualization showing all CorrelationWait nodes in execution order
  - Real-time state sync (pending/paused/completed) via polling `/api/correlations`
  - One-click "Fire Webhook" button for each paused node
  - Inline JSON payload editor with validation
  - Batch "Fire All Paused" button for parallel callback testing
  - Scenario save/load system for repeatable test sequences
- `webhookScenarioStorage.ts` — LocalStorage persistence for webhook scenarios with:
  - CRUD operations for webhook scenarios per workflow
  - Export/import for sharing scenarios
  - `fireWebhook()` utility to call `/api/correlations/resume`
  - `buildPayloadWithCorrelationId()` for template substitution

**Integration:**
- Added to `WorkflowRunner.tsx` — Panel appears when `correlationWaitConfig?.mode === 'wait-for-real'`
- Styled in `test-runner.css` with `.multi-webhook-*` classes

**Test Coverage:**
- `MultiWebhookTestingPanel.test.tsx` — 18 unit tests covering rendering, filtering, firing, scenarios
- `webhookScenarioStorage.test.ts` — 30 unit tests covering all storage/API functions

#### Current Limitation

With a workflow like:
```
HTTP1 → CorrelationWait1 → HTTP2 → CorrelationWait2 → HTTP3
```

Users must:
1. Start workflow, it pauses at CorrelationWait1
2. Copy curl from UI, modify correlation ID, run in terminal
3. Workflow continues to CorrelationWait2, pauses
4. Repeat step 2 for each webhook

This is tedious for multi-webhook workflows.

#### Proposed Features

1. **Workflow Visualization in Runner** — Show read-only workflow graph in the runner panel, highlighting current execution state (which node is paused/running/completed)

2. **Webhook Queue** — Pre-define webhook payloads for each CorrelationWait node before starting the test. The UI auto-fires them when the workflow reaches each node.

3. **Webhook Scenarios** — Save/load predefined webhook response sequences for repeated testing of multi-step workflows.

4. **One-Click Fire** — When workflow pauses at a CorrelationWait, show a "Fire Webhook" button directly in the workflow visualization (instead of copying curl).

5. **Payload Editor** — Edit webhook payload inline before firing, with JSON validation.

#### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Workflow Runner                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Workflow: Payment Flow                                  │ │
│ │ Mode: Wait for Real Webhook (Debug)                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │  [Submit] ──✓── [Wait for] ──⏸── [Confirm] ── [Wait for]│ │
│ │  Payment       Callback          Order          Shipping│ │
│ │    ✓           PAUSED             ...            ...    │ │
│ │                                                         │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ Paused at: Wait for Payment Callback            │   │ │
│ │  │ Correlation ID: pay_12345                       │   │ │
│ │  │                                                  │   │ │
│ │  │ Payload:                                        │   │ │
│ │  │ { "paymentId": "pay_12345", "status": "..." }   │   │ │
│ │  │                                                  │   │ │
│ │  │ [Edit Payload]        [🚀 Fire Webhook]         │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation Tasks

1. **Mini Workflow Visualization** — Render a simplified, horizontal view of the workflow in the runner panel
2. **Real-time State Sync** — Update node states as workflow executes (polling or WebSocket)
3. **Paused Node Expansion** — When a node is paused, expand to show webhook controls
4. **Fire Webhook API** — Integrate with existing `/api/correlations/resume` endpoint
5. **Payload Editor** — JSON editor with validation for webhook payload
6. **Webhook Queue System** — Pre-define payloads for all webhooks before running
7. **Scenario Save/Load** — Persist webhook sequences for repeated testing

#### Dependencies

- Phase 7a (CorrelationWait configuration)
- Phase 7e (Visual Execution Replay — can share workflow canvas components)

---

## 6. Design Principles

1. **Workflow IS the test.** Follow industry consensus: the workflow graph IS what gets iterated under load. Don't require users to manually re-select scenarios.

2. **Graph fidelity.** Run the full `graphRunner` topology under load, not a flattened chain. Conditions, forks, joins, loops, and switches should all execute during performance tests — that's the real user journey.

3. **Iteration isolation.** Each iteration gets a fresh `VariableContext` child. No cross-iteration state leakage.

4. **Backward compatibility.** The existing flat-chain `runWorkflow()` path remains for legacy `mode='workflow'` without `workflowId`. No breaking changes.

5. **Per-step observability.** Tag every result with `iterationIndex` and `workflowNodeId` so results can be sliced by step and by iteration — answering both "which step is slow?" and "which iteration failed?".

---

## 7. Post-Integration Market Position

### Where RedfireForge Becomes Unique

No competitor currently offers **visual graph-based workflow design + full-topology performance testing** in one tool:

| Capability | k6 | JMeter | Locust | Postman | RedfireForge (Post-Integration) |
|---|---|---|---|---|---|
| Visual workflow designer | ❌ | Partial (XML tree) | ❌ | ❌ | ✅ Canvas with drag/drop |
| Branching under load | Code only | XML config | Code only | Limited | ✅ Visual + executed |
| Fork/Join parallelism in perf tests | Manual | XML Parallel Controller | Manual greenlets | ❌ | ✅ Native |
| Loop/retry under load | Code only | Loop Controller | Code only | ❌ | ✅ Visual loop nodes |
| Event-driven load testing (webhooks, correlation) | ❌ | ❌ | ❌ | ❌ | ✅ (Phase 7) |
| Desktop-native (no infra) | ❌ (CLI) | ✅ (Java GUI) | ❌ (CLI) | ✅ (Electron) | ✅ (Tauri) |
| Per-iteration + per-step metrics | Tags/groups | Transaction Controller | Per-user | Per-VU | ✅ Native |

### Competitive Advantages

1. **Visual-first, code-optional** — k6/Locust require code. JMeter requires XML tree manipulation. RedfireForge lets users visually build complex workflows (conditions, forks, loops, sub-workflows) and run them under load with zero code.

2. **Event-driven node load testing (Phase 7)** — This is a gap across ALL competitors. No tool today handles webhook-triggered nodes, correlation waits, or poll-based conditions under load. RedfireForge would be first to market with synthetic event injection and auto-resume strategies.

3. **Unified design ↔ test experience** — Competitors treat workflow=test as the same concept because they have no designer. RedfireForge keeps the visual designer for authoring but makes the bridge seamless ("Run in Harness" button, workflow picker). Best of both worlds.

4. **Desktop-native with no infrastructure** — k6/Locust need CLI + cloud dashboards. JMeter is Java-heavy. Postman moved SaaS-first. RedfireForge via Tauri is lightweight, offline-capable, and owns the data locally.

### Where Competitors Still Win

| Area | Who Wins | Why |
|---|---|---|
| Distributed load generation | k6 Cloud, JMeter Remote | RedfireForge is single-machine |
| Ecosystem & plugins | JMeter (300+ plugins) | Mature community |
| CI/CD integration | k6, Locust | First-class CLI + cloud APIs |
| Enterprise scale (10K+ VUs) | k6 Cloud, Gatling | Cloud infrastructure |
| Protocol diversity (gRPC, WebSocket, JDBC) | k6, JMeter | RedfireForge is HTTP-only |

### Target Segment

Teams that need **complex multi-step API performance testing** without writing code or managing infrastructure:

- **QA engineers who aren't developers** — visual > code
- **Small-to-mid teams (1–50 devs)** — don't need distributed 10K+ VU tests
- **API-first applications** with complex orchestration flows (conditions, retries, event-driven patterns)
- **Privacy-conscious teams** wanting local-first tooling

### Differentiation Statement

> RedfireForge is the only tool that lets you **visually design** complex API workflows with branching, parallelism, and event-driven patterns, then **run them under load** with full graph topology — all from a lightweight desktop app with no infrastructure.

After full integration, RedfireForge wouldn't compete head-to-head with k6 Cloud on scale or JMeter on protocol breadth, but it would own the **visual workflow-based performance testing** niche that no one else occupies.

---

## Phase 7: Documentation

**Priority: High | Effort: Medium | Status: ✅ COMPLETE**

### 7.1 Runner Comparison Documentation

✅ Created `docs/runners-comparison.md` with comprehensive comparison:

| Aspect | Test Runner | Workflow Runner |
|--------|-------------|-----------------|
| **Purpose** | Run scenario-based tests with data-driven parameterization | Run workflow graphs under load with full topology |
| **Input** | Feature Groups → Scenarios → Tests | Workflow definitions (visual graph) |
| **Data Source** | CSV/JSON data sources, shared data sources | Workflow variables (initial context) |
| **Execution** | Weighted random selection from test pool | Full graph traversal (conditions, forks, joins, loops) |
| **Host/Auth** | Configurable per environment/microservice | Defined in workflow HTTP nodes |
| **Validation** | Per-test assertions, selective/full modes | Per-step assertions in workflow |
| **Results Grouping** | Feature → Scenario → Test → Data Row | Iteration → Workflow Step |
| **Use Case** | API contract testing, regression suites | End-to-end flow performance, orchestration testing |

**Additional sections in runners-comparison.md:**
- When to Use Test Runner (with examples)
- When to Use Workflow Runner (with examples)
- Feature Comparison (input, execution, results)
- Results Interpretation for each runner
- Migration Guide (between runners)
- Decision Flowchart
- Common Patterns

### 7.2 User Guide Sections

✅ Created `docs/workflow-runner-guide.md` covering:

1. **Getting Started**
   - Navigate to Workflow Runner
   - Select a workflow
   - Configure initial variables
   - Configure execution settings
   - Run and view results

2. **Understanding Iterations**
   - Isolation between iterations
   - Concurrency model

3. **Results Interpretation**
   - Iteration Performance Chart
   - Per-Step Metrics Table
   - Per-Iteration Detail

4. **Execution Modes**
   - Fixed Iterations
   - Load Profiles (sustained, ramp-up, spike)

5. **Working with Variables**
   - Workflow defaults
   - Runtime overrides
   - Variable history
   - Variable extraction

6. **Error Handling**
   - Error policies
   - Threshold configuration
   - Retry configuration

7. **Tips & Best Practices**

8. **CLI Usage** (link to cli-reference.md)

---

## Phase 8: Training Manuals & Samples ✅ COMPLETE

**Priority: High | Effort: Medium | Status: DONE**

### 8.1 Training Manuals — Detailed Content Plan

Each manual uses **real-world public APIs** that users can test immediately without authentication.

#### Manual 1: `workflow-runner-basics-easy.html`
**Path:** workflow | **Difficulty:** Easy ★☆☆

**Learning Objectives:**
- Navigate to Workflow Runner from sidebar
- Select an existing workflow from the dropdown
- Understand the workflow summary (HTTP steps, node names)
- Run a workflow with default settings (5 iterations, concurrency 1)
- View the completion banner and navigate to results

**Hands-On Exercise:**
Uses the existing **"Sample: Create → Extract → Verify"** workflow from Gallery:
1. Import the sample workflow (JSONPlaceholder API)
2. Navigate to Testing → Workflow Runner
3. Select the workflow from dropdown
4. Click "Run Workflow" (uses defaults)
5. Observe live progress showing 5 iterations
6. Click "View Full Results →" when complete

**API Used:** `https://jsonplaceholder.typicode.com`
- Step 1: POST /posts (create)
- Step 2: GET /posts/{id} (verify)

**Key Screenshots to Include:**
- Workflow picker dropdown
- Workflow summary showing "2 HTTP steps"
- Live progress panel with iteration counter
- Completion banner with "View Full Results" button

---

#### Manual 2: `workflow-runner-variables-medium.html`
**Path:** workflow | **Difficulty:** Medium ★★☆

**Learning Objectives:**
- Understand workflow variables and `{{name}}` syntax
- Edit initial variable values before running
- Use Variable History to restore previous configurations
- Save and label commonly-used variable sets
- Reset variables to workflow defaults

**Hands-On Exercise:**
Create a new workflow "Country Lookup" with variables:
```
Variables: { "countryName": "germany", "fields": "name,capital,population" }
```
Workflow:
- Step 1: GET `https://restcountries.com/v3.1/name/{{countryName}}?fields={{fields}}`
- Step 2: GET `https://restcountries.com/v3.1/alpha/{{countryCode}}` (extracted from step 1)

Exercise:
1. Run with default variables (Germany)
2. Edit `countryName` to "japan", run again
3. Open Variable History panel
4. Click previous config to restore "germany"
5. Label the Germany config as "European Test"
6. Reset to workflow defaults

**API Used:** `https://restcountries.com/v3.1`
- GET /name/{name} — search by country name
- GET /alpha/{code} — get by alpha code

**Key Screenshots:**
- Variables panel with editable inputs
- "Modified" badge showing changes from defaults
- History panel with saved configurations
- Label editing for a history item

---

#### Manual 3: `workflow-runner-iterations-medium.html`
**Path:** workflow | **Difficulty:** Medium ★★☆

**Learning Objectives:**
- Configure total iterations (how many times to run the workflow)
- Configure concurrency (parallel iteration limit)
- Understand iteration vs. request count
- Use Load Profile mode for time-based testing
- Configure think time between iterations

**Hands-On Exercise:**
Uses a 3-step workflow with JSONPlaceholder:
```
Step 1: GET /users/1 → extract userId
Step 2: GET /users/1/posts → extract postIds
Step 3: GET /posts/1/comments → verify comments exist
```

Exercises:
1. **Basic Load:** 10 iterations, concurrency 2
   - Expected: 30 total requests (3 steps × 10 iterations)
   - Observe 2 iterations running at once

2. **Higher Concurrency:** 20 iterations, concurrency 5
   - Compare total duration vs. sequential

3. **Load Profile Mode:** Select "Ramp Up"
   - Duration: 30 seconds
   - Start concurrency: 1, Max: 5
   - Observe ramp pattern in chart

4. **Think Time:** Add fixed 500ms delay
   - Notice slower iteration completion

**API Used:** `https://jsonplaceholder.typicode.com`

**Key Concepts Table:**

| Setting | What It Controls | Example |
|---------|-----------------|---------|
| Iterations | Total workflow executions | 10 iterations = workflow runs 10 times |
| Concurrency | Max parallel iterations | 5 = up to 5 iterations at once |
| Load Profile | Time-based load shaping | Ramp from 1→5 over 30s |
| Think Time | Delay between iterations | 500ms pause after each iteration |

**Key Screenshots:**
- Execution config panel with iteration/concurrency inputs
- Live progress showing "5/20 iterations (25%)"
- Load profile selector expanded
- Response time chart during load test

---

#### Manual 4: `workflow-runner-results-medium.html`
**Path:** workflow | **Difficulty:** Medium ★★☆

**Learning Objectives:**
- Read the Workflow Execution Summary
- Understand pass rate at workflow level
- Interpret per-step metrics table
- Use the Iteration Performance chart
- Drill into per-iteration detail
- Identify failed iterations and debug

**Hands-On Exercise:**
After running a 10-iteration test on a 2-step workflow:

1. **Overall Summary:**
   - "⚡ Workflow Execution Summary"
   - 10 iterations, 2 steps, 20 total requests
   - 100% Pass Rate (green)

2. **Per-Step Metrics Table:**
   | Step | Count | Pass % | Avg | p50 | p95 | Min | Max |
   |------|-------|--------|-----|-----|-----|-----|-----|
   | 1. Create Post | 10 | 100% | 142ms | 138ms | 165ms | 120ms | 180ms |
   | 2. Verify Post | 10 | 100% | 89ms | 85ms | 112ms | 72ms | 125ms |

3. **Iteration Performance Chart:**
   - Bar chart showing each iteration's total duration
   - Green bars = all steps passed
   - Red bars = at least one step failed
   - Dotted line = average duration

4. **Per-Iteration Detail (expand):**
   - Click "▶ Per-Iteration Detail"
   - Expand iteration #3
   - See individual request timings

5. **Debugging Failed Iterations:**
   - Filter to show only failed iterations
   - Click a failed request to see error details
   - Check response body for error message

**API Used:** `https://jsonplaceholder.typicode.com`
- POST /posts → returns 201 with created post
- GET /posts/{id} → returns 200 with post data

**Key Screenshots:**
- Workflow Execution Summary header with metrics
- Per-step metrics table
- Iteration Performance bar chart with tooltip
- Expanded iteration showing request details
- Response detail modal for a failed request

---

#### Manual 5: `runner-comparison-easy.html`
**Path:** tests | **Difficulty:** Easy ★☆☆

**Learning Objectives:**
- Understand when to use Test Runner vs. Workflow Runner
- Know what each runner is optimized for
- Choose the right runner for your testing goal
- Navigate between runners efficiently

**Comparison Content:**

| Aspect | Test Runner | Workflow Runner |
|--------|-------------|-----------------|
| **Input** | Test scenarios (feature groups) | Workflow (graph of nodes) |
| **Best For** | API endpoint testing | Multi-step business flows |
| **Execution** | Independent requests | Sequential/parallel graph |
| **Variables** | CSV data sources, extractions | Workflow variables, node outputs |
| **Conditions** | Assertions on response | Condition/Switch nodes |
| **Results Grouped By** | Feature → Scenario → Test | Workflow → Step → Iteration |
| **Use Cases** | Load testing APIs, regression | End-to-end flow testing |

**Decision Flowchart:**

```
Start
  │
  ├─ Testing a single API endpoint? → Test Runner
  │
  ├─ Testing multiple endpoints in sequence? 
  │     └─ With dependencies (data from one to next)? → Workflow Runner
  │     └─ Independent (no data sharing)? → Test Runner with multiple tests
  │
  ├─ Need conditional logic (if/else, switch)? → Workflow Runner
  │
  ├─ Testing with CSV data variations? → Test Runner (parameterized)
  │
  └─ Testing a user journey (login → action → logout)? → Workflow Runner
```

**Hands-On Exercise:**
1. Open Gallery → Samples tab
2. Find "JSONPlaceholder — List Users" → Import to Test Runner
3. Run with 5 iterations — see results grouped by scenario
4. Find "Sample: Create → Extract → Verify" → Import as Workflow
5. Open Workflow Runner, select it, run with 5 iterations
6. Compare results: Test Runner shows per-request, Workflow Runner shows per-iteration

**APIs Used:** `https://jsonplaceholder.typicode.com`

---

### 8.2 Gallery Samples — Detailed Content Plan

Each sample is a complete, importable workflow using real public APIs.

#### Sample 1: `workflow-perf-simple.json`
**Category:** workflow-performance | **API:** JSONPlaceholder

**Purpose:** Simplest possible workflow for load testing introduction.

**Workflow Structure:**
```
Start → [1. Create Post] → [2. Verify Post] → End
```

**Nodes:**
1. **Create Post** (HTTP POST)
   - URL: `https://jsonplaceholder.typicode.com/posts`
   - Body: `{ "title": "Load Test {{$iteration}}", "body": "Test content", "userId": 1 }`
   - Extract: `postId` from `$.id`

2. **Verify Post** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/posts/{{postId}}`
   - Assert: Status 200, `$.title` contains "Load Test"

**Variables:**
```json
{ }
```

**Recommended Test Config:**
- 10 iterations, concurrency 2
- Expected: 20 requests, ~5-10 seconds

---

#### Sample 2: `workflow-perf-branching.json`
**Category:** workflow-performance | **API:** REST Countries

**Purpose:** Demonstrate conditional branching performance under load.

**Workflow Structure:**
```
Start → [1. Search Country] → [2. Country Found?]
                                   ├── Yes → [3a. Get Details]
                                   └── No  → [3b. Fallback]
```

**Variables:**
```json
{
  "searchTerm": "{{$randomCountry}}",
  "fallbackCode": "US"
}
```

**Nodes:**
1. **Search Country** (HTTP GET)
   - URL: `https://restcountries.com/v3.1/name/{{searchTerm}}?fullText=false`
   - Extract: `countryCode` from `$[0].cca2`, `status` from response

2. **Country Found?** (Condition)
   - Expression: `{{status}} == 200`

3a. **Get Details** (HTTP GET)
   - URL: `https://restcountries.com/v3.1/alpha/{{countryCode}}`

3b. **Fallback** (HTTP GET)
   - URL: `https://restcountries.com/v3.1/alpha/{{fallbackCode}}`

**Recommended Test Config:**
- 20 iterations, concurrency 3
- Mix of found/not-found paths exercises branching

---

#### Sample 3: `workflow-perf-parallel.json`
**Category:** workflow-performance | **API:** JSONPlaceholder

**Purpose:** Demonstrate Fork/Join parallel execution under load.

**Workflow Structure:**
```
Start → [1. Get User] → [Fork] ─┬─ [2a. Get Posts]   ─┬─ [Join] → [4. Verify] → End
                                ├─ [2b. Get Todos]   ─┤
                                └─ [2c. Get Albums]  ─┘
```

**Variables:**
```json
{
  "userId": "1"
}
```

**Nodes:**
1. **Get User** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/users/{{userId}}`
   - Extract: `userName` from `$.name`

2. **Fork** (Fork Node) — 3 parallel paths

2a. **Get Posts** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/users/{{userId}}/posts`
   - Extract: `postCount` from `$.length`

2b. **Get Todos** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/users/{{userId}}/todos`
   - Extract: `todoCount` from `$.length`

2c. **Get Albums** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/users/{{userId}}/albums`
   - Extract: `albumCount` from `$.length`

3. **Join** (Join Node) — waits for all 3 paths

4. **Verify** (HTTP GET)
   - URL: `https://jsonplaceholder.typicode.com/users/{{userId}}`
   - Assert: User still exists

**Recommended Test Config:**
- 10 iterations, concurrency 2
- Expected: 50 requests (5 HTTP nodes × 10 iterations)
- Parallel paths should complete faster than sequential

---

### 8.3 Sample Workflow Presets

Add to `src/data/galleries/tests/parameterizedPresets.ts`:

```typescript
// Workflow Load Test Presets
export const workflowLoadPresets: TestPreset[] = [
  {
    id: 'workflow-load-basic',
    name: 'Workflow: Basic Load',
    description: 'Run workflow 10 times with 2 concurrent iterations',
    config: {
      executionMode: 'workflow',
      totalTransactions: 10,
      concurrency: 2,
      thinkTime: { mode: 'none' },
    }
  },
  {
    id: 'workflow-load-stress',
    name: 'Workflow: Stress Test',
    description: 'Run workflow 50 times with 10 concurrent iterations',
    config: {
      executionMode: 'workflow',
      totalTransactions: 50,
      concurrency: 10,
      thinkTime: { mode: 'none' },
    }
  },
  {
    id: 'workflow-load-ramp',
    name: 'Workflow: Ramp Profile',
    description: '60-second ramp from 1 to 5 concurrent iterations',
    config: {
      executionMode: 'load-profile',
      loadProfile: {
        type: 'ramp',
        durationSec: 60,
        startConcurrency: 1,
        maxConcurrency: 5,
      },
      thinkTime: { mode: 'fixed', fixedMs: 200 },
    }
  },
  {
    id: 'workflow-load-sustained',
    name: 'Workflow: Sustained Load',
    description: '2-minute sustained load at 3 concurrent iterations',
    config: {
      executionMode: 'load-profile',
      loadProfile: {
        type: 'constant',
        durationSec: 120,
        maxConcurrency: 3,
      },
      thinkTime: { mode: 'fixed', fixedMs: 500 },
    }
  },
];
```

### 8.4 Success Criteria

- [x] All 5 training manuals created with consistent styling
- [x] Each manual uses only public APIs (no auth required)
- [x] Hands-on exercises are tested and working
- [x] All 3 gallery workflow samples importable and runnable
- [x] Presets appear in Workflow Runner UI
- [x] Cross-links between related manuals

---

## Phase 9: CLI Distribution & Documentation

**Priority: Medium | Effort: Medium-Large | Status: ✅ COMPLETE (9a, 9b, 9c)**

### 9.1 CLI Access Methods

Support three ways to access the CLI:

#### Method A: Source Repository (Current, for Developers)

For developers and CI/CD pipelines with access to the source:

```bash
# Clone and install
git clone <repo-url>
cd redfireforge
npm install

# Run CLI via npx
npx tsx cli/index.ts run tests/my-test.yaml
npx tsx cli/index.ts workflow tests/my-workflow.yaml
```

**Use case:** Local development, CI/CD pipelines, contributors

#### Method B: Standalone CLI Binary (npm Global Install)

Publish as a standalone npm package for easy global installation:

```bash
# Install globally
npm install -g redfireforge-cli

# Run from anywhere
redfireforge run tests/my-test.yaml
redfireforge workflow tests/my-workflow.yaml
```

**Implementation:**
1. Create `cli/package.json` for standalone package
2. Use `esbuild` or `pkg` to bundle CLI as single executable
3. Publish to npm as `redfireforge-cli`
4. Include pre-built binaries for macOS, Linux, Windows

**Deliverables:**
- [x] `cli/package.json` — Standalone package definition
- [x] `scripts/build-cli-package.sh` — Build script for bundling
- [x] npm publish workflow (GitHub Actions)
- [x] Pre-built binaries in GitHub Releases

#### Method C: CLI Embedded in Desktop App

Allow users who have the desktop app to run CLI commands:

```bash
# macOS
/Applications/RedfireForge.app/Contents/MacOS/RedfireForge --cli run tests/test.yaml

# Or via symlink (created by installer)
redfireforge --cli workflow tests/workflow.yaml
```

**Implementation:**
1. Add CLI argument parsing to Tauri main process
2. When `--cli` flag detected, skip GUI and run CLI mode
3. macOS installer creates `/usr/local/bin/redfireforge` symlink
4. Windows installer adds to PATH

**Deliverables:**
- [x] Tauri CLI mode in `src-tauri/src/main.rs`
- [x] macOS post-install script for symlink
- [x] Windows PATH configuration in installer
- [x] Linux `.desktop` file with CLI alias

### 9.2 CLI Reference Documentation

Create comprehensive CLI documentation at `docs/cli-reference.md`:

**Sections:**
1. **Installation Options** — All three methods (A, B, C)
2. **Quick Start** — First test in 30 seconds
3. **Test File Commands** — `run`, `validate`
4. **Workflow Commands** — `workflow`, `validate-workflow`
5. **All Command Options** — Full reference table for each command
6. **Test File Format** — YAML/JSON schema with examples
7. **Workflow File Format** — Simplified and full formats
8. **Environment Variables** — Supported env vars
9. **Exit Codes** — 0 (success), 1 (test failed), 2 (error)
10. **Troubleshooting** — Common issues and solutions

### 9.3 Working Examples

Create example files in `examples/` with documentation comments:

| Example File | Purpose | Key Options Demonstrated |
|--------------|---------|--------------------------|
| `cli-basic-test.yaml` | Simple API test | `--concurrency`, `--transactions` |
| `cli-assertions.yaml` | Validation with assertions | `--fail-on-error` |
| `cli-parameterized.yaml` | Data-driven testing | `--data`, `--tags`, `--tag-mode` |
| `cli-load-profile.yaml` | Sustained/ramp load testing | `--mode load-profile`, `--duration` |
| `cli-error-handling.yaml` | Error policy testing | `--error-policy`, `--max-errors`, `--max-error-rate` |
| `workflow-cli-parallel.yaml` | Workflow with fork/join | `--iterations`, `--concurrency` |
| `workflow-cli-conditional.yaml` | Workflow with conditions | `--var` variable overrides |

### 9.4 CI/CD Integration Guide

Add `docs/cli-ci-cd.md` with integration examples:

```yaml
# GitHub Actions example (using npm package)
- name: Install RedfireForge CLI
  run: npm install -g redfireforge-cli

- name: Run API Performance Tests
  run: |
    redfireforge run tests/api-tests.yaml \
      --concurrency 5 \
      --transactions 100 \
      --fail-threshold 5 \
      --junit results/junit.xml \
      --markdown results/report.md

# GitHub Actions example (using source)
- name: Setup and Run Tests
  run: |
    npm ci
    npx tsx cli/index.ts workflow tests/order-flow.yaml \
      --iterations 50 \
      --concurrency 10 \
      --var baseUrl=${{ secrets.API_URL }} \
      --fail-on-error \
      --junit results/workflow-junit.xml
```

**CI/CD Platforms Covered:**
- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
- CircleCI

### 9.5 Example Scripts

Create `examples/scripts/` with ready-to-use shell scripts:

| Script | Purpose |
|--------|---------|
| `run-smoke-test.sh` | Quick validation (low concurrency) |
| `run-load-test.sh` | Full load test with reports |
| `run-workflow-test.sh` | Workflow performance test |
| `compare-results.sh` | Compare two JSON reports |

### 9.6 Implementation Sequence

```
Phase 9a: Documentation & Examples (Method A)
    ↓
Phase 9b: Standalone npm Package (Method B)
    ↓
Phase 9c: Desktop App CLI Mode (Method C)
```

| Sub-phase | Priority | Effort | Description |
|-----------|----------|--------|-------------|
| 9a. Documentation | High | S | Docs, examples, CI/CD guide |
| 9b. npm Package | Medium | M | Standalone `redfireforge-cli` package |
| 9c. Desktop CLI | Low | M | Tauri CLI mode + installer integration |

### 9.7 Deliverables

**Phase 9a (Documentation): ✅ COMPLETE**
- [x] `docs/guides/cli-reference.md` — Full command reference (installation, commands, options, file formats)
- [x] `docs/guides/cli-ci-cd.md` — CI/CD integration guide (GitHub Actions, GitLab CI, Jenkins, Azure DevOps, CircleCI)
- [x] `examples/cli-basic-test.yaml` — Basic test with common options
- [x] `examples/cli-assertions.yaml` — Assertion types demonstration
- [x] `examples/cli-parameterized.yaml` — Data-driven testing with tags
- [x] `examples/cli-load-profile.yaml` — Load profile configuration
- [x] `examples/cli-error-handling.yaml` — Error policies and retries
- [x] `examples/workflow-cli-parallel.yaml` — Workflow fork/join example
- [x] `examples/workflow-cli-conditional.yaml` — Workflow switch/branching example
- [x] `examples/scripts/run-basic-test.sh` — Basic test runner script
- [x] `examples/scripts/run-parameterized-test.sh` — Tag-filtered test script
- [x] `examples/scripts/run-load-test.sh` — Configurable load test script
- [x] `examples/scripts/run-workflow-test.sh` — Workflow test script
- [x] `examples/scripts/ci-smoke-test.sh` — CI quick validation script
- [x] `examples/scripts/ci-full-test.sh` — CI full test suite script
- [x] Updated `README.md` — CLI quick-start section with guide links

**Phase 9b (npm Package): ✅ COMPLETE**
- [x] `cli/package.json` — Standalone package config with dependencies, bin entry, npm metadata
- [x] `cli/README.md` — Package documentation with usage examples
- [x] `scripts/build-cli-package.sh` — Build script for creating publishable package
- [x] `.github/workflows/publish-cli.yml` — GitHub Action for npm publish on version tags
- [x] Updated `package.json` with `build:cli-package` script
- [x] Verified CLI bundle works with all commands (run, workflow, validate, validate-workflow)

**Phase 9c (Desktop CLI): ✅ COMPLETE**
- [x] Tauri CLI mode (`--cli` flag) in `src-tauri/src/main.rs` with clap argument parsing
- [x] Full CLI command support (run, workflow, validate, validate-workflow)
- [x] macOS post-install script for `/usr/local/bin/redfireforge` symlink
- [x] Windows WiX installer template with PATH configuration
- [x] Linux post-install script for CLI symlink
- [x] Bundled CLI script in app resources
- [x] Updated CLI documentation for desktop mode

---

## Phase 10: Comprehensive User Guides

**Priority: Medium | Effort: Large**

This phase creates a complete set of user guides covering all major features of RedfireForge. Guides are placed in `docs/guides/` and follow the naming convention `<feature>-guide.md` or `<feature>-<topic>.md`.

### 10.1 Current Guides (Complete)

| Guide | Status | Description |
|-------|--------|-------------|
| `runners-comparison.md` | ✅ | Compare Test Runner vs Workflow Runner |
| `workflow-runner-guide.md` | ✅ | Complete Workflow Runner user guide |
| `cross-platform.md` | ✅ | Desktop vs Web platform differences |

### 10.2 Core Feature Guides (Complete)

#### Getting Started & Overview

| Guide | Priority | Description |
|-------|----------|-------------|
| `getting-started.md` | High | First-time setup, UI tour, first test in 5 minutes |
| `concepts-overview.md` | High | Key concepts: environments, microservices, scenarios, workflows |
| `keyboard-shortcuts.md` | Low | Complete keyboard shortcut reference |

#### Requests & Collections

| Guide | Priority | Description |
|-------|----------|-------------|
| `requests-guide.md` | High | Creating requests, organizing collections, folders |
| `request-editor-guide.md` | Medium | Headers, body types, query params, path variables |
| `request-auth-guide.md` | High | Auth types (Basic, Bearer, API Key, OAuth2), global profiles |
| `request-variables-guide.md` | Medium | Variable syntax, environment variables, extraction |
| `request-versioning-guide.md` | Low | Version history, diff view, restoring versions |

#### API Catalog

| Guide | Priority | Description |
|-------|----------|-------------|
| `catalog-guide.md` | High | Importing OpenAPI specs, browsing endpoints, sending to requests |
| `catalog-import-guide.md` | Medium | Import from URL, file, Swagger 2.0 vs OpenAPI 3.x |

#### Scenarios & Testing

| Guide | Priority | Description |
|-------|----------|-------------|
| `scenarios-guide.md` | High | Creating feature groups, scenarios, tests |
| `test-runner-guide.md` | High | Running tests, execution modes, concurrency |
| `parameterized-testing-guide.md` | High | Data sources, CSV/JSON import, variable substitution |
| `assertions-guide.md` | High | Assertion types, JSONPath, regex, custom assertions |
| `validation-modes-guide.md` | Medium | None, selective, full validation modes |
| `shared-data-sources-guide.md` | Medium | Creating and using shared data sources across tests |
| `test-versioning-guide.md` | Low | Test definition history, diff, restore |

#### Workflow Designer

| Guide | Priority | Description |
|-------|----------|-------------|
| `workflow-designer-guide.md` | High | Canvas basics, adding nodes, connecting edges |
| `workflow-nodes-reference.md` | High | All node types: HTTP, Condition, Delay, Fork, Join, Loop, etc. |
| `workflow-variables-guide.md` | Medium | Workflow variables, extraction, chaining |
| `workflow-services-guide.md` | Medium | Service registry, multi-environment URLs, auth |
| `workflow-debugging-guide.md` | Medium | Debug mode, step-through, console, breakpoints |
| `workflow-triggers-guide.md` | Medium | Webhook triggers, schedule triggers |
| `workflow-correlation-guide.md` | Advanced | CorrelationWait, async patterns, event-driven workflows |
| `workflow-scripts-guide.md` | Advanced | Script nodes, JavaScript execution, libraries |
| `workflow-sub-workflows-guide.md` | Advanced | Sub-workflow nodes, composition patterns |
| `workflow-versioning-guide.md` | Low | Version history, diff, restore |

#### Results & Analysis

| Guide | Priority | Description |
|-------|----------|-------------|
| `results-guide.md` | High | Results dashboard, metrics, filtering, export |
| `results-comparison-guide.md` | Medium | Baseline comparison, trend analysis |
| `results-export-guide.md` | Medium | JSON, CSV, Markdown, JUnit export formats |

#### Environments & Settings

| Guide | Priority | Description |
|-------|----------|-------------|
| `environments-guide.md` | High | Creating environments, microservices, base URLs |
| `global-auth-guide.md` | Medium | Global auth profiles, inheritance |
| `preferences-guide.md` | Low | Theme, settings, customization |

#### Gallery & Training

| Guide | Priority | Description |
|-------|----------|-------------|
| `gallery-guide.md` | Medium | Browsing samples, importing, try-it |
| `training-tracks-guide.md` | Low | Using training tracks, progress tracking |

### 10.3 Implementation Phases

```
Phase 10a: Core Guides (High Priority)
├── getting-started.md
├── concepts-overview.md
├── requests-guide.md
├── request-auth-guide.md
├── scenarios-guide.md
├── test-runner-guide.md
├── parameterized-testing-guide.md
├── assertions-guide.md
├── workflow-designer-guide.md
├── workflow-nodes-reference.md
├── results-guide.md
└── environments-guide.md

Phase 10b: Feature Guides (Medium Priority)
├── request-editor-guide.md
├── request-variables-guide.md
├── catalog-guide.md
├── catalog-import-guide.md
├── validation-modes-guide.md
├── shared-data-sources-guide.md
├── workflow-variables-guide.md
├── workflow-services-guide.md
├── workflow-debugging-guide.md
├── workflow-triggers-guide.md
├── results-comparison-guide.md
├── results-export-guide.md
├── global-auth-guide.md
└── gallery-guide.md

Phase 10c: Advanced & Reference Guides (Low Priority)
├── keyboard-shortcuts.md
├── request-versioning-guide.md
├── test-versioning-guide.md
├── workflow-correlation-guide.md
├── workflow-scripts-guide.md
├── workflow-sub-workflows-guide.md
├── workflow-versioning-guide.md
├── preferences-guide.md
└── training-tracks-guide.md
```

### 10.4 Guide Template

Each guide should follow this structure:

```markdown
# [Feature] Guide

Brief description of what this guide covers.

## Overview
- What is [Feature]?
- When to use it
- Key concepts

## Getting Started
- Prerequisites
- Step-by-step first use

## [Main Topic 1]
### Subtopic
### Subtopic

## [Main Topic 2]
...

## Tips & Best Practices
- Common patterns
- Performance considerations
- Gotchas to avoid

## Related Guides
- Link to related guides

## See Also
- Link to training manuals
- Link to samples
```

### 10.5 Deliverables Summary

| Phase | Guides | Priority | Effort |
|-------|--------|----------|--------|
| 10a | 12 core guides | High | Large |
| 10b | 14 feature guides | Medium | Large |
| 10c | 9 advanced guides | Low | Medium |
| **Total** | **35 guides** | | |

### 10.6 Success Criteria

- [x] All High priority guides complete (Phase 10a)
- [x] Each guide follows the template structure
- [x] Cross-linking between related guides
- [x] All guides accessible from a central index
- [x] Screenshots/diagrams where helpful (ASCII diagrams/flowcharts embedded throughout guides)
- [x] Medium priority guides complete (Phase 10b)
- [x] Low priority guides complete (Phase 10c)

---

## 14. Non-Goals (Out of Scope)

- **Distributed execution** — Multi-machine load generation is Phase 1.x territory
- **Recording/playback** — HAR-to-workflow conversion (like Locust's `har2locust`)
- **Real browser rendering** — Workflow steps are API calls, not browser interactions
- **Workflow editing from Harness** — The Harness references a workflow; editing happens in the Workflow Designer

---

## 15. Success Criteria

- [x] User can select a saved workflow in the Harness and run it as a performance test
- [x] Full graph topology (conditions, forks, joins, loops) is respected during load runs
- [x] Results show per-step aggregate metrics (avg, p50, p95, p99 per workflow node)
- [x] Results show per-iteration pass/fail with total duration
- [x] "Run in Harness" button on Workflow Designer toolbar navigates to pre-configured Workflow Runner
- [x] CLI supports `workflow` command for graph-based load testing
- [x] Existing flat-chain workflow mode continues to work (backward compatible)
- [x] CorrelationWait nodes can auto-resume with mock payload during load tests (Phase 7a)
- [x] Webhook-triggered workflows can be load tested via webhook load driver (Phase 7c)
- [x] WaitForCondition polling is throttled across iterations (Phase 7d)
- [x] Documentation comparing Test Runner vs Workflow Runner
- [x] Training manuals covering Workflow Runner usage (Phase 8 — `src/data/galleries/trainingPaths/`)
- [x] Gallery samples demonstrating workflow performance testing (Phase 8 — `src/data/galleries/workflows/`, `examples/*.yaml`)
- [x] CLI reference documentation with all command options (Phase 9a — `docs/guides/cli-reference.md`)
- [x] Working CLI examples (test files and workflow files) (Phase 9a — `examples/cli-*.yaml`, `examples/workflow-cli-*.yaml`, `examples/scripts/`)
- [x] CI/CD integration guide (Phase 9a — `docs/guides/cli-ci-cd.md`)
- [x] Standalone CLI npm package (`redfireforge-cli`) (Phase 9b — `cli/package.json`, `scripts/build-cli-package.sh`, `.github/workflows/publish-cli.yml`)
- [x] Desktop app CLI mode (`--cli` flag) (Phase 9c — `src-tauri/src/main.rs`)
- [x] Core user guides complete (12 high-priority guides)
- [x] Central guide index with navigation

---

## 16. What's NOT in the Plan Yet (Potential Future Phases)

> Items below are **not yet planned or scheduled**. They represent natural next steps, user-requested features, and competitive gaps that could become future phases. Reference this section when deciding what to implement next.

### Phase 11: Performance & Engine Enhancements

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 11.1 | **Native Rust Executor** | Move HTTP engine to Rust backend (`hyper`/`reqwest` + `tokio`) for 10–50x throughput (5,000–50,000+ RPS). Tauri sidecar with IPC event bridge. | Very High | High |
| 11.2 | **Constant Arrival Rate** | "Send exactly N RPS regardless of response time" (open model). Automatic worker scaling with queue-based dispatching and backpressure. | High | High |
| 11.3 | **Streaming Percentiles** | T-Digest or HDR Histogram for P50/P95/P99 without storing every datapoint. Enables 100K+ result sets without OOM. | Medium | Medium |
| 11.4 | **Distributed Execution** | Multi-machine load generation via controller/worker architecture. Central orchestrator distributes iterations across agent nodes. | Very High | Medium |
| 11.5 | **Graceful Drain** | On abort or profile end, wait for in-flight requests to complete (configurable timeout) instead of dropping them. Ensures accurate final metrics. | Low | Medium |
| 11.6 | **Response Streaming** | Stream large response bodies to disk instead of buffering in memory. Critical for stress-testing file-download APIs. | Medium | Low |

### Phase 12: Run Comparison, Trends & Regression Detection

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 12.1 | **Run Comparison** | Side-by-side comparison of two runs (TPS, P95, P99 deltas with green/red indicators, overlaid histograms). | Medium | High |
| 12.2 | **Baseline Runs** | Mark a run as "baseline" and auto-compare future runs against it. Visual delta badges on results. | Medium | High |
| 12.3 | **Regression Detection** | Automatic alert when P95 increases by configurable % vs baseline. Integrates with CI exit codes. | Medium | High |
| 12.4 | **Trend Analysis** | P95/P99/TPS trend chart across last N runs for the same test suite or workflow. | Medium | Medium |
| 12.5 | **SLA Dashboard** | Persistent SLA targets per test/workflow; traffic light dashboard showing pass/warn/fail against thresholds. | Medium | Medium |

### Phase 13: Protocol & Format Support

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 13.1 | **GraphQL Support** | Query/mutation builder with schema introspection, variable editor, and operation-level assertions. | High | High |
| 13.2 | **gRPC Support** | Protobuf definition import, unary and streaming call execution, proto-based assertions. | High | Medium |
| 13.3 | **WebSocket Support** | Connect, send/receive messages, assert on received payloads, measure message latency. | High | Medium |
| 13.4 | **JSON Schema Validation** | Validate response bodies against JSON Schema (draft 2020-12). Auto-generate schemas from sample responses. | Medium | Medium |
| 13.5 | **Server-Sent Events (SSE)** | Subscribe to SSE endpoints, assert on event types and payloads, measure event delivery latency. | Medium | Low |

### Phase 14: Open-Source Launch & Community

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 14.1 | **CI Test Pipeline** | GitHub Actions: run unit tests (`vitest`), E2E tests (`playwright`), lint, type-check on every push/PR. | Medium | Critical |
| 14.2 | **Live Demo** | Auto-deploy web build to Vercel/Netlify on `master` push. "Try in 10 seconds" link in README. | Low | Critical |
| 14.3 | **Documentation Site** | Docusaurus or GitHub Pages with guides, screenshots, API reference, search. | Medium | High |
| 14.4 | **Branding & Logo** | Professional logo, icon, rebrand tagline to "Visual API Testing Workbench". | Low | High |
| 14.5 | **README Rewrite** | Concise, GIF-heavy README with feature screenshots, quick-start, comparison table. | Low | High |
| 14.6 | **CONTRIBUTING.md** | Setup instructions, coding standards, PR process, issue templates, Code of Conduct. | Low | High |
| 14.7 | **Launch Marketing** | Hacker News "Show HN" post, Reddit (r/webdev, r/node), Dev.to article, YouTube walkthrough. | Low | Medium |

### Phase 15: Advanced Workflow Features

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 15.1 | **HAR-to-Workflow Conversion** | Import HTTP Archive (HAR) recordings from browser DevTools and convert to workflow graphs. Like Locust's `har2locust`. | High | Medium |
| 15.2 | **Workflow Templates Gallery** | Pre-built workflow templates for common patterns (CRUD, OAuth flow, pagination, retry-polling, saga). One-click import and customize. | Medium | Medium |
| 15.3 | **Sub-Workflow Parameters** | Pass parameters to sub-workflows (input/output contract). Enables reusable workflow modules. | Medium | Medium |
| 15.4 | **Workflow Diff & Merge** | Visual diff between two workflow versions showing node/edge/variable changes. Three-way merge for collaboration. | High | Low |
| 15.5 | **Conditional Retry Node** | Retry a failed HTTP node N times with configurable delay and backoff strategy (linear, exponential, jitter). | Medium | Medium |
| 15.6 | **Data-Driven Workflows** | Feed CSV/JSON data rows into workflow iterations — each row becomes a set of workflow variables for one iteration. | Medium | High |

### Phase 16: Extensibility & Integration

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 16.1 | **Plugin API** | Extension points for custom auth providers, assertion functions, reporters, and node types. | Very High | Medium |
| 16.2 | **Pre/Post-Request Scripts** | JS hooks before and after each request for dynamic data transformation. Monaco editor with intellisense. | Medium | Medium |
| 16.3 | **Slack/Teams Notifications** | Post test results summary to Slack or Microsoft Teams channels via webhook. | Low | Medium |
| 16.4 | **Datadog/Grafana Export** | Push metrics (TPS, P95, error rate) to observability platforms for correlation with infra metrics. | Medium | Medium |
| 16.5 | **Harness.io Integration** | Pipeline stage template: run RedfireForge tests, consume JUnit XML for Test Intelligence, gate deployments. | Medium | Medium |
| 16.6 | **Test Tagging & Filtering** | Label tests/workflows with custom tags (`smoke`, `regression`, `critical`); run by tag in UI and CLI. | Low | High |

### Phase 17: User Experience & Polish

| ID | Feature | Description | Complexity | Priority |
|----|---------|-------------|------------|----------|
| 17.1 | **Real Screenshot Guides** | Replace ASCII diagrams in user guides with actual UI screenshots. Auto-capture via Playwright. | Medium | Low |
| 17.2 | **Dark Mode** | Full dark theme for the app with theme toggle and system preference detection. | Medium | Medium |
| 17.3 | **Keyboard Shortcuts** | Comprehensive keyboard shortcuts for common actions (run test, save, navigate tabs). | Low | Medium |
| 17.4 | **Undo/Redo** | Global undo/redo stack for workflow editor changes (node add/remove/move, edge changes, property edits). | High | Medium |
| 17.5 | **Collaborative Editing** | Multi-user real-time editing via CRDT (e.g., Yjs) for workflow designer and test definitions. | Very High | Low |
| 17.6 | **Responsive Mobile View** | Read-only results dashboard accessible on mobile/tablet for on-the-go monitoring. | Medium | Low |

### Prioritized Implementation Order (Suggested)

```
Next Sprint (High Impact, Lower Effort):
  ① Phase 14.1  CI Test Pipeline          — critical for launch
  ② Phase 14.2  Live Demo                 — critical for adoption
  ③ Phase 12.1  Run Comparison            — most-requested analytics feature
  ④ Phase 16.6  Test Tagging & Filtering  — low effort, high value

Medium Term:
  ⑤ Phase 11.1  Native Rust Executor      — the architecture leap to "Excellent"
  ⑥ Phase 11.2  Constant Arrival Rate     — k6's killer feature
  ⑦ Phase 13.1  GraphQL Support           — expand protocol coverage
  ⑧ Phase 15.6  Data-Driven Workflows     — unlock parameterized workflow testing
  ⑨ Phase 14.3  Documentation Site        — community growth

Long Term:
  ⑩ Phase 11.4  Distributed Execution     — enterprise scale
  ⑪ Phase 16.1  Plugin API                — ecosystem growth
  ⑫ Phase 13.2  gRPC Support              — microservice testing
  ⑬ Phase 17.5  Collaborative Editing     — team features
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-07 | **Fixes & parity updates**: (1) Fixed `workflow-cli-conditional.yaml` — added missing End node and 6 edges (switch→branches, branches→end) that left the graph disconnected. (2) Added full option parity to Tauri desktop `--cli` mode (`src-tauri/src/main.rs`) — 10 new options for `run` (`--duration`, `--data`, `--scenario`, `--env`, `--error-policy`, `--max-errors`, `--max-error-rate`, `--data-rows-summary`, `--tags`, `--tag-mode`) and 3 for `workflow` (`--error-policy`, `--max-errors`, `--max-error-rate`). (3) Fixed `run-basic-test.sh` missing `mkdir -p results`. (4) Updated CLI reference doc with desktop CLI parity note. (5) Updated success criteria checkboxes for Phase 10.6 and Section 15. (6) Added "What's NOT in the Plan Yet" section (Phases 11–17) with 40+ potential features. |
| 2026-05-06 | **Phase 7c complete: Webhook Load Driver**. Created `WebhookLoadDriver` class with rate control modes (fixed RPS, ramp up/down, burst). Created `payloadTemplateEngine.ts` with 14 dynamic generators (`{{$uuid}}`, `{{$randomInt}}`, `{{$randomEmail}}`, etc.). Added `WebhookLoadDriverPanel.tsx` UI component for configuring webhook load tests. Updated `WorkflowRunner.tsx` to detect workflows starting with Webhook Trigger nodes and show the webhook load driver UI instead of the standard iteration-based UI. Added 37 unit tests across `payloadTemplateEngine.test.ts` and `webhookLoadDriver.test.ts`. |
| 2026-05-06 | **Phase 7e complete: Results Explorer (redesign)**. Renamed "Visual Execution Replay" to "Results Explorer". Implemented left-right split layout with workflow canvas (left) and node detail panel (right). Added collapsible Iteration Matrix table showing per-iteration, per-node elapsed times with filtering (all, failed, slowest 10%) and sorting. Extended trace capture to store full request/response details when "Capture Full Trace" is enabled. Added dual metrics display: "Avg HTTP Response" and "Avg Iteration Duration" in progress panel, results dashboard, and modal footer. Updated `TestSummary` to include `avgIterationTime`. |
| 2026-05-06 | **Phase 7b complete: Synthetic Event Injector**. Created `SyntheticEventInjector` class that monitors the correlation store for paused workflows and automatically fires synthetic resume calls after configurable delay + jitter. Wired into `graphLoadRunner.ts` — when mode is `synthetic-inject`, creates an `InMemoryCorrelationStore` + `SyntheticEventInjector`. Updated `handleCorrelationWaitNode` to use store-based pause/resume for synthetic mode (with inline delay fallback when no store). Added 10 unit tests for `SyntheticEventInjector`, updated handler tests. This simulates realistic async timing by testing the full pause/resume flow. |
| 2026-05-06 | Phase 7a enhancement: **Simplified Mock Payload UI v2**. Only shows editable dynamic fields (status, paymentStatus, state, etc.) with hint about test scenarios. Fixed fields (transactionId, processedAt) are hidden from input but visible in JSON preview. Added "Mock Payload" preview section showing complete JSON. Updated workflow-runner-guide.md and workflow-correlation-guide.md with new UI examples. |
| 2026-05-07 | **Plan finalized — all phases COMPLETE.** Updated 16 stale checkboxes to `[x]`, set plan status to Complete. Implemented two remaining features: (1) Per-node metrics split "wait for event" vs "processing" for CorrelationWait nodes with visual timing breakdown bar in Results Explorer. (2) Gallery performance presets in Workflow Runner UI with Quick Start chips (import or select). Also: fixed disabled Request/Response/Variables tabs (now show basic data without full trace), redesigned "Last Execution" card with status badge/method pill/duration bar, fixed Perf: Simple POST→GET sample (was 404 due to JSONPlaceholder limitation), made Quick Start chips upsert workflows to keep samples fresh. |
| 2026-05-06 | Phase 7a enhancement: **Simplified Mock Payload UI**. Replaced JSON textarea with field-based inputs for each extract variable. Shows only configurable fields (e.g., `status`) with clear labels. Info text explains all transactions use the same values. Correlation ID is auto-handled. Advanced per-transaction variable editing deferred to Phase 7f. |
| 2026-05-06 | Phase 7a enhancements: (1) **Wait for Real Webhook improvements**: Added curl command modal with actual correlation IDs pre-filled, "Currently Paused Workflows" list shows only when workflows are paused, curl button disabled until workflow is paused. (2) **Single transaction mode**: "Wait for Real Webhook" now forces Concurrency=1, Transactions=1 and disables those fields (not suitable for load testing). (3) **Cancelled status**: Clicking Stop on a paused workflow now marks results as "cancelled" instead of "success". Added `cancelled: boolean` to `RequestResult`. (4) **RemoteCorrelationStore for load runner**: `graphLoadRunner` now creates a `RemoteCorrelationStore` when mode is `wait-for-real`, enabling workflows to actually pause and register with the webhook server. (5) **Phase 7f planned**: Added new phase for Multi-Webhook Testing UI to handle complex workflows with multiple CorrelationWait nodes (workflow visualization in runner, one-click fire, webhook queue). |
| 2026-05-06 | Phase 7a enhancement: Moved CorrelationWait behavior configuration from node-level (`CorrelationWaitNodeData.loadTestBehavior`) to runner-level (`TestConfig.correlationWaitConfig`). This separates workflow logic from test configuration — the same workflow can now be tested with different behaviors without modifying the workflow definition. UI moved from `CorrelationWaitConfig.tsx` design panel to `WorkflowRunner.tsx` with new `CorrelationWaitConfigPanel` component. Config passed through `runGraphLoad` → `runGraph` → `handleCorrelationWaitNode`. Node-level `mockPayload` still works as fallback. Updated unit tests and documentation. |
| 2026-05-06 | Phase 7a complete: Implemented auto-resume mode for CorrelationWait nodes during load tests. Added `loadTestBehavior` field to `CorrelationWaitNodeData` with three modes: `wait-for-real`, `auto-resume`, `synthetic-inject`. Updated `handleCorrelationWaitNode` to skip actual webhook wait and inject mock payload when `loadTestMode=true` and mode is `auto-resume` or `synthetic-inject`. Added `loadTestMode` flag to `NodeHandlerContext` and `runGraph` function. UI config panel added for configuring mock payload and synthetic delay/jitter. 28 unit tests for handler, 20 tests for UI config. |
| 2026-05-05 | Phase 10c complete: Created 9 advanced guides (keyboard-shortcuts, request-versioning-guide, test-versioning-guide, workflow-correlation-guide, workflow-scripts-guide, workflow-sub-workflows-guide, workflow-versioning-guide, preferences-guide, training-tracks-guide). Phase 10 COMPLETE with 35 total guides. |
| 2026-05-05 | Phase 10b complete: Created 14 feature guides (request-editor-guide, request-variables-guide, catalog-guide, catalog-import-guide, validation-modes-guide, shared-data-sources-guide, workflow-variables-guide, workflow-services-guide, workflow-debugging-guide, workflow-triggers-guide, results-comparison-guide, results-export-guide, global-auth-guide, gallery-guide). |
| 2026-05-05 | Phase 10a complete: Created 12 core user guides (getting-started, concepts-overview, requests-guide, request-auth-guide, scenarios-guide, test-runner-guide, parameterized-testing-guide, assertions-guide, workflow-designer-guide, workflow-nodes-reference, results-guide, environments-guide) and guide index (README.md). |
| 2026-05-05 | Phase 7 complete: Created `docs/runners-comparison.md` (comprehensive comparison, decision flowchart, migration guide) and `docs/workflow-runner-guide.md` (full user guide with getting started, iterations, results, variables, error handling, tips). |
| 2026-05-05 | Phase 6 complete: Added `workflow` and `validate-workflow` CLI commands. Created workflowLoader with simplified YAML format support. Added workflow-aware reporters (console, JUnit, Markdown). Added sample workflow YAML. |
| 2026-05-05 | Phase 5 complete: Added "Run in Harness" button to Workflow Designer toolbar. Clicking navigates to Workflow Runner tab with workflow pre-selected and variables initialized. Added unit tests for WorkflowToolbar and WorkflowRunner. |
| 2026-05-05 | Phase 4 complete: Fixed "Workflow" execution mode label in results. Created `WorkflowResultsSummary` component with per-step metrics table and per-iteration drill-down. Extended `resultsGrouping.ts` with `workflowStep` and `iteration` grouping levels plus percentile stats. Added workflow-specific grouping options to the results table. |
| 2026-05-05 | Phase 3 complete: Created `graphLoadRunner.ts` for load testing with full graph topology. Updated executor, worker bridge, and protocol to pass workflow data. Results tagged with `iterationIndex` and `workflowNodeId`. |
| 2026-05-05 | Phase 2 complete: Created `WorkflowPicker` component with variable history tracking. Added workflow selection to TestRunner UI. Hides scenario selection when workflow is selected. |
| 2026-05-05 | Phase 1 complete: Added `workflowId` to `TestConfig`, `iterationIndex` and `workflowNodeId` to `RequestResult` in `src/shared/types/index.ts` |

---

_Created: 2026-05-01 | Status: **Complete** | Related: [DESIGN.md](../workflow/DESIGN.md) §6 Cross-Feature Integration, [ROADMAP.md](../../ROADMAP.md) Phase 0.7.5_
