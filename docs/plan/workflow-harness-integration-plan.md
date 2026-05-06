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
Phase 7a: Auto-resume mode for CorrelationWait (simplest, enables CI smoke tests)
    ↓
Phase 7b: Synthetic Event Injector (realistic delays, production-like)
    ↓
Phase 7c: Webhook Trigger Load Driver (replace "N iterations" with "N webhook POSTs")
    ↓
Phase 7d: WaitForCondition poll throttle (prevent poll storms)
```

| Sub-phase | Priority | Effort | Depends On |
|---|---|---|---|
| 7a. Auto-resume mode | High | S | Phase 3 |
| 7b. Synthetic Event Injector | Medium | M | Phase 3, 7a |
| 7c. Webhook Load Driver | Medium | M | Phase 3 |
| 7d. Poll throttle | Medium | S | Phase 3 |

### 5.8 Success Criteria for Phase 7

- [ ] CorrelationWait nodes can auto-resume with mock payload during load tests
- [ ] Synthetic Event Injector monitors `correlationStore` and fires callbacks with configurable delay + jitter
- [ ] Webhook-triggered workflows can be load tested by sending N webhook POSTs at a configured rate
- [ ] WaitForCondition polling is throttled across iterations to prevent poll storms
- [ ] Harness UI detects event-driven nodes and shows appropriate configuration panels
- [ ] Per-node metrics distinguish between "time waiting for event" and "time executing HTTP call"

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

**Priority: High | Effort: Medium**

### 7.1 Runner Comparison Documentation

Create comprehensive documentation comparing Test Runner vs Workflow Runner:

**File:** `docs/runners-comparison.md`

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

### 7.2 User Guide Sections

Add sections to the user guide:

1. **Choosing Between Runners**
   - When to use Test Runner
   - When to use Workflow Runner
   - Migration path from scenarios to workflows

2. **Workflow Runner Guide**
   - Selecting a workflow
   - Configuring variables
   - Understanding iteration results
   - Per-step metrics interpretation

3. **Results Interpretation**
   - Test Runs vs Workflow Runs filter
   - Workflow-specific metrics (per-step, per-iteration)
   - Comparing runs across both types

---

## Phase 8: Training Manuals & Samples

**Priority: High | Effort: Medium**

### 8.1 Training Manuals

Create training manuals for the workflow integration feature:

| Manual | Difficulty | Path | Description |
|--------|------------|------|-------------|
| `workflow-runner-basics-easy.html` | Easy | workflow | Introduction to Workflow Runner, selecting a workflow, running with defaults |
| `workflow-runner-variables-medium.html` | Medium | workflow | Configuring initial variables, using variable history |
| `workflow-runner-iterations-medium.html` | Medium | workflow | Understanding iterations, concurrency, and load profiles |
| `workflow-runner-results-medium.html` | Medium | workflow | Interpreting workflow results, per-step metrics, iteration drill-down |
| `runner-comparison-easy.html` | Easy | tests | Choosing between Test Runner and Workflow Runner |

### 8.2 Gallery Samples

Add workflow samples that demonstrate performance testing:

| Sample | Category | Description |
|--------|----------|-------------|
| `workflow-perf-simple.json` | workflow | Simple 2-step workflow (GET → POST) for basic load testing |
| `workflow-perf-branching.json` | workflow | Workflow with conditional branching under load |
| `workflow-perf-parallel.json` | workflow | Fork/join workflow demonstrating parallel path execution |

### 8.3 Sample Workflow Presets

Add to test presets for workflow-based testing:

```typescript
{
  id: 'workflow-load-basic',
  name: 'Workflow Load Test - Basic',
  description: 'Run a workflow with 10 iterations at concurrency 2',
  config: {
    executionMode: 'workflow',
    totalTransactions: 10,
    concurrency: 2,
  }
}
```

---

## 10. Non-Goals (Out of Scope)

- **Distributed execution** — Multi-machine load generation is Phase 1.x territory
- **Recording/playback** — HAR-to-workflow conversion (like Locust's `har2locust`)
- **Real browser rendering** — Workflow steps are API calls, not browser interactions
- **Workflow editing from Harness** — The Harness references a workflow; editing happens in the Workflow Designer

---

## 11. Success Criteria

- [x] User can select a saved workflow in the Harness and run it as a performance test
- [x] Full graph topology (conditions, forks, joins, loops) is respected during load runs
- [x] Results show per-step aggregate metrics (avg, p50, p95, p99 per workflow node)
- [x] Results show per-iteration pass/fail with total duration
- [x] "Run in Harness" button on Workflow Designer toolbar navigates to pre-configured Workflow Runner
- [x] CLI supports `workflow` command for graph-based load testing
- [x] Existing flat-chain workflow mode continues to work (backward compatible)
- [ ] CorrelationWait nodes can auto-resume with mock payload during load tests (Phase 7a)
- [ ] Webhook-triggered workflows can be load tested via webhook load driver (Phase 7c)
- [ ] WaitForCondition polling is throttled across iterations (Phase 7d)
- [ ] Documentation comparing Test Runner vs Workflow Runner
- [ ] Training manuals covering Workflow Runner usage
- [ ] Gallery samples demonstrating workflow performance testing

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-05 | Phase 6 complete: Added `workflow` and `validate-workflow` CLI commands. Created workflowLoader with simplified YAML format support. Added workflow-aware reporters (console, JUnit, Markdown). Added sample workflow YAML. |
| 2026-05-05 | Phase 5 complete: Added "Run in Harness" button to Workflow Designer toolbar. Clicking navigates to Workflow Runner tab with workflow pre-selected and variables initialized. Added unit tests for WorkflowToolbar and WorkflowRunner. |
| 2026-05-05 | Phase 4 complete: Fixed "Workflow" execution mode label in results. Created `WorkflowResultsSummary` component with per-step metrics table and per-iteration drill-down. Extended `resultsGrouping.ts` with `workflowStep` and `iteration` grouping levels plus percentile stats. Added workflow-specific grouping options to the results table. |
| 2026-05-05 | Phase 3 complete: Created `graphLoadRunner.ts` for load testing with full graph topology. Updated executor, worker bridge, and protocol to pass workflow data. Results tagged with `iterationIndex` and `workflowNodeId`. |
| 2026-05-05 | Phase 2 complete: Created `WorkflowPicker` component with variable history tracking. Added workflow selection to TestRunner UI. Hides scenario selection when workflow is selected. |
| 2026-05-05 | Phase 1 complete: Added `workflowId` to `TestConfig`, `iterationIndex` and `workflowNodeId` to `RequestResult` in `src/shared/types/index.ts` |

---

_Created: 2026-05-01 | Status: In Progress | Related: [DESIGN.md](../workflow/DESIGN.md) §6 Cross-Feature Integration, [ROADMAP.md](../../ROADMAP.md) Phase 0.7.5_
