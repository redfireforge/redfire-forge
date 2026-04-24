# Workflow Designer — Architecture & Design

> Visual workflow builder for designing, configuring, and testing multi-step API workflows.

---

## 1. Problem Statement

RedfireForge has three sections today:

| Section | Purpose |
|---|---|
| **REQUESTS** | Build & organize individual API requests |
| **CATALOG** | Import & browse OpenAPI specs |
| **HARNESS** | Load-test collections with configurable concurrency |

**Missing capability**: There is no way to chain multiple requests into a multi-step workflow where step outputs feed into step inputs (e.g., `POST /orders` → extract `orderId` → `GET /orders/{{orderId}}` → verify status). Users need this for regression testing, integration testing, and realistic load scenarios.

---

## 2. Solution: WORKFLOW — A 4th Top-Level Section

**WORKFLOW** sits alongside REQUESTS, CATALOG, and HARNESS in the sidebar nav rail.

### User Flow

```
┌──────────────────────────────────────────────────────────┐
│  1. DESIGN         Visual canvas — drag, connect, config │
│  ────────────                                            │
│  • Import steps from REQUESTS or CATALOG                 │
│  • Connect steps with edges (sequential, conditional)    │
│  • Configure per-step: extractions, assertions, delays   │
│  • Configure flow: if/else, parallel, loops, aggregation │
│  • Define initial variables                              │
│                                                          │
│  2. QUICK TEST     Run from the designer to validate     │
│  ──────────────                                          │
│  • Single-pass execution with live node animation        │
│  • Variable panel updates in real-time                   │
│  • See pass/fail per step directly on the canvas         │
│                                                          │
│  3. HARNESS        Run the workflow at scale              │
│  ──────────────                                          │
│  • Select a saved workflow in HARNESS Test Runner        │
│  • Configure iterations, concurrency, think time         │
│  • Each iteration gets its own variable context          │
│  • Results appear in the standard Results Dashboard      │
└──────────────────────────────────────────────────────────┘
```

### Key Principle

> **Design first, test second.**
> All workflow configuration (variables, extraction, branching, parallelism) happens in the WORKFLOW designer UI. HARNESS only controls *how many times* and *how fast* to run it.

---

## 3. UI Layout

The WORKFLOW section is a full-width page (no sidebar tree needed):

```
┌──────────────────────────────────────────────────────────────────┐
│ WORKFLOW toolbar                                                  │
│ [+ New] [Open ▾] [Save] [Rename] [Delete]  │  [▶ Quick Test]    │
├─────────────┬────────────────────────────────┬───────────────────┤
│  PALETTE    │       CANVAS (React Flow)      │  CONFIG PANEL     │
│             │                                │                   │
│  ┌───────┐  │    ┌──────┐    ┌──────┐       │  Step: POST /api  │
│  │ HTTP  │  │    │ POST │───▶│ GET  │       │  ─────────────    │
│  ├───────┤  │    │/order│    │/order│       │  [Extract] tab    │
│  │ Cond  │  │    └──────┘    └──┬───┘       │  [Headers] tab    │
│  ├───────┤  │                   │           │  [Assert] tab     │
│  │ Delay │  │              ┌────▼────┐      │  [Auth] tab       │
│  ├───────┤  │              │ IF 200  │      │                   │
│  │ Loop  │  │              └─┬─────┬─┘      │  Extractions:     │
│  ├───────┤  │             Yes│     │No      │  orderId = $.id   │
│  │ Fork  │  │            ┌───▼┐  ┌─▼──┐    │  token = header   │
│  ├───────┤  │            │ OK │  │Fail│    │                   │
│  │ Join  │  │            └────┘  └────┘    │                   │
│  └───────┘  │                               │                   │
│             │  ── Variable Context Bar ──── │                   │
│  REQUESTS ▾ │  {{orderId}} = 42             │                   │
│  CATALOG  ▾ │  {{token}} = eyJhbG...        │                   │
├─────────────┴────────────────────────────────┴───────────────────┤
│  Status: Ready │ Steps: 5 │ Variables: 3 │ Last run: 2.3s PASS  │
└──────────────────────────────────────────────────────────────────┘
```

### Layout Components

| Component | Purpose |
|---|---|
| **Toolbar** | Workflow CRUD + Quick Test button |
| **Palette** (left) | Draggable node blocks + browse REQUESTS/CATALOG to import |
| **Canvas** (center) | React Flow interactive diagram — nodes, edges, zoom, pan |
| **Config Panel** (right) | Per-node configuration — reuses existing editor components |
| **Variable Context Bar** (bottom of canvas) | Live variable state during execution |
| **Status Bar** (footer) | Step count, variable count, last run summary |

---

## 4. Node Types

### Implemented Nodes ✅

| Node | Shape | Purpose | Config | Status |
|---|---|---|---|---|
| **Start** | Circle (green) | Workflow entry point | Initial variables, trigger settings | ✅ Done |
| **HTTP Request** | Rounded rect | Execute an API call | Method, URL, headers, body, auth, extractions, assertions, service binding | ✅ Done |
| **Condition (If/Else)** | Diamond | Branch based on variable/status | Left operand, operator, right operand, true/false edges | ✅ Done |
| **Delay** | Clock icon | Pause between steps | Duration (fixed or random), min/max ms | ✅ Done |
| **Fork** | Split arrows | Start parallel branches | Fan-out to N children | ✅ Done |
| **Join** | Merge arrows | Wait for parallel branches | Wait-all strategy | ✅ Done |
| **End** | Circle (red) | Workflow exit point | Label only | ✅ Done |
| **Webhook Trigger** | Webhook icon | Start workflow from webhook | HTTP method, path, sample payload, variable extraction | ✅ Done |
| **Schedule Trigger** | Clock/calendar icon | Start workflow on schedule | Cron expression, timezone, schedule description | ✅ Done |

### Planned Nodes 🚧

| Node | Shape | Purpose | Config | Priority |
|---|---|---|---|---|
| **Loop** | Cycle arrows | Repeat steps | For-each array, repeat N, while condition, max iterations | High |
| **Switch** | Multi-diamond | Multi-way branch | Multiple conditions → edges (case 1, case 2, default) | High |
| **Set Variable** | Assignment icon | Set or transform variables | Variable name, value expression, transform function | High |
| **Aggregate** | Sigma icon | Combine parallel results | Merge strategy (concat, first, last, custom JSONPath) | Medium |
| **Script/Transform** | Code icon | Execute JavaScript | Code editor, input/output variables | Medium |
| **Error Handler** | Shield icon | Catch and handle errors | Error type, retry config, fallback path | Medium |
| **Log/Debug** | Bug icon | Log variables or messages | Message template, log level, variable snapshot | Low |
| **Wait for Condition** | Hourglass icon | Poll until condition met | Condition, polling interval, timeout | Low |

### Future Node Ideas 💡

| Node | Purpose | Use Case |
|---|---|---|
| **Sub-workflow** | Call another workflow as a step | Reusable workflow components, modular design |
| **Database Query** | Execute SQL queries | Direct DB testing, data setup/teardown |
| **Rate Limiter** | Control request rate per step | Respect API rate limits, throttle load |
| **Cache** | Cache responses by key | Avoid redundant calls, share data across iterations |
| **File Operations** | Read/write files | CSV input, JSON export, test data generation |
| **Email/Notification** | Send email/Slack/webhook | Alert on failures, report completion |
| **HTTP Polling** | Poll endpoint until condition | Wait for async job completion (status=done) |
| **Batch Request** | Execute multiple similar requests | Bulk operations (delete multiple resources) |
| **Extract to File** | Save response to file | Debug large payloads, export test data |
| **GraphQL Request** | Execute GraphQL queries | GraphQL API testing |

---

## 4.1 Node Implementation Roadmap

### Phase 1: Core Workflow (✅ Complete)
- **Start/End nodes** — Entry and exit points for workflows
- **HTTP Request** — Core API execution with variable extraction
- **Condition** — Basic if/else branching
- **Delay** — Think time and pacing
- **Fork/Join** — Parallel execution

### Phase 2: Triggers & Automation (✅ Complete)
- **Webhook Trigger** — Event-driven workflow initiation
- **Schedule Trigger** — Time-based workflow automation

### Phase 3: Advanced Control Flow (High Priority)
- **Loop** — Iterate over arrays or repeat N times
  - Essential for: data-driven testing, bulk operations, retry logic
  - Config: for-each array variable, repeat count, while condition, max iterations
- **Switch** — Multi-way branching (more than 2 paths)
  - Essential for: status code routing (200/400/404/500), state machines
  - Config: multiple case conditions, default path
- **Set Variable** — Explicit variable manipulation
  - Essential for: data transformation, computed values, test data setup
  - Config: variable assignments, transform functions (uppercase, JSON parse, etc.)

### Phase 4: Reliability & Observability (Medium Priority)
- **Error Handler** — Structured error handling
  - Essential for: retry logic, graceful degradation, error logging
  - Config: error type filters, retry count/backoff, fallback path
- **Aggregate** — Combine parallel branch results
  - Essential for: gathering fork/join results, summary calculations
  - Config: merge strategy (concat arrays, pick first/last, custom JSONPath)
- **Log/Debug** — Workflow debugging and visibility
  - Essential for: troubleshooting, audit trails, variable inspection
  - Config: message template, log level, variable snapshot

### Phase 5: Extended Capabilities (Future)
- **Script/Transform** — JavaScript execution for complex logic
- **Database Query** — Direct SQL testing and data operations
- **Sub-workflow** — Reusable workflow modules
- **Rate Limiter** — Control request pacing
- **Cache** — Response caching and data sharing
- **File Operations** — CSV/JSON input/output
- **Notification** — Email/Slack/webhook alerts

### Priority Justification

**Loop is the #1 priority** because:
- Already designed in original spec
- Blocks common use cases: array iteration, retry logic, bulk operations
- Required for realistic load test scenarios (e.g., create N orders per user)

**Switch is #2** because:
- Improves UX over chained condition nodes
- Natural for HTTP status code routing
- Prevents "diamond spaghetti" diagrams

**Set Variable is #3** because:
- Currently no way to manually transform/compute variables
- Needed for test data preparation
- Fills gap between extractions and request inputs

---

## 5. Data Model

### Workflow (saved artifact)

```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;      // initial variables
  nodes: WorkflowNode[];                  // React Flow nodes with our data
  edges: WorkflowEdge[];                  // React Flow edges
  createdAt: number;
  updatedAt: number;
}

interface WorkflowNode {
  id: string;
  type: 'http' | 'condition' | 'delay' | 'start' | 'end' | 'webhook' | 'schedule' | 'fork' | 'join' | 'loop' | 'aggregate' | 'switch';
  position: { x: number; y: number };
  data: HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | ForkNodeData | JoinNodeData | LoopNodeData | AggregateNodeData;
}

interface HttpNodeData {
  label: string;
  scenario: Scenario;                     // full request definition
  sourceType?: 'requests' | 'catalog';    // where it came from
  sourceId?: string;                      // original request/endpoint ID
}

interface ConditionNodeData {
  label: string;
  expression: string;                     // e.g. "{{status}} == 200"
  operator: '==' | '!=' | '>' | '<' | 'contains' | 'regex';
  left: string;                           // variable reference
  right: string;                          // comparison value
}

interface DelayNodeData {
  label: string;
  delayMs: number;
  mode: 'fixed' | 'random';
  minMs?: number;
  maxMs?: number;
}

interface StartNodeData {
  label: string;
  inputVariables: Record<string, string>;    // Variables provided when workflow starts
}

interface EndNodeData {
  label: string;
}

interface WebhookTriggerNodeData {
  label: string;
  method: 'POST' | 'PUT' | 'PATCH';          // HTTP method expected for webhook
  path: string;                              // Endpoint path (e.g., '/api/vehicle-created')
  samplePayload: string;                     // Sample JSON payload for testing
  extractVariables?: Array<{                 // Variables to extract from webhook body
    name: string;
    jsonPath: string;
  }>;
  notes?: string;
}

interface ScheduleTriggerNodeData {
  label: string;
  cronExpression: string;                    // Cron expression (e.g., '0 9 * * MON-FRI')
  timezone: string;                          // Timezone for cron execution
  scheduleDescription?: string;              // Human-readable description
  inputVariables?: Record<string, string>;   // Optional initial variables
  notes?: string;
}

interface ForkNodeData {
  label: string;
}

interface JoinNodeData {
  label: string;
  strategy?: 'wait-all' | 'wait-any';       // Wait for all branches or first to complete
}

// ── Planned Node Data Types (not yet implemented) ──

interface LoopNodeData {
  label: string;
  loopType: 'count' | 'for-each' | 'while';
  count?: number;
  arrayVariable?: string;                    // variable containing array to iterate
  whileCondition?: string;
  maxIterations?: number;                    // safety limit
}

interface SwitchNodeData {
  label: string;
  cases: Array<{
    condition: string;                       // expression to evaluate
    label: string;                           // case label (e.g., "Case 1", "Success")
  }>;
  hasDefault?: boolean;                      // whether to include default/else path
}

interface SetVariableNodeData {
  label: string;
  variables: Array<{
    name: string;                            // variable name
    value: string;                           // value expression or template
    transform?: 'uppercase' | 'lowercase' | 'trim' | 'json-parse' | 'json-stringify';
  }>;
}

interface AggregateNodeData {
  label: string;
  strategy: 'concat' | 'first' | 'last' | 'custom';
  arrayVariable?: string;                    // where to store aggregated results
  customJsonPath?: string;                   // JSONPath for custom aggregation
}
```

### Where Requests Come From

HTTP nodes are populated from two sources:

1. **REQUESTS** — User browses their request collections in the palette, drags a request onto the canvas. The node stores a copy of the `RequestItem` converted to a `Scenario`.

2. **CATALOG** — User browses catalog endpoints in the palette, drags an endpoint onto the canvas. The node stores a `Scenario` generated from the catalog endpoint definition.

Both store a `sourceType` + `sourceId` reference back to the original, enabling sync indicators when the source changes.

---

## 6. Integration Points

### REQUESTS → WORKFLOW
- Palette shows collapsible REQUESTS tree
- Drag a request onto canvas → creates HTTP node
- "Add to Workflow" context menu on requests

### CATALOG → WORKFLOW
- Palette shows collapsible CATALOG tree
- Drag an endpoint onto canvas → creates HTTP node with default params
- "Add to Workflow" context menu on catalog endpoints

### WORKFLOW → HARNESS
- Saved workflows appear as selectable items in HARNESS Test Runner
- "Run in Harness" button in workflow toolbar
- HARNESS wraps the workflow: configures iterations, concurrency, think time
- Each iteration runs the full workflow with an isolated variable context

### WORKFLOW → CLI
- Export workflow as YAML for `redfire run workflow.yaml`
- CLI `mode: workflow` uses the same engine under the hood

---

## 7. Execution Architecture

### Quick Test (from designer)

```
User clicks ▶ Quick Test
    │
    ▼
WorkflowDesigner calls runWorkflow()
    │
    ├─ For each node in topological order:
    │   ├─ HTTP node → resolveScenario(ctx) → httpFetch → extractVariables → update ctx
    │   ├─ Condition → evaluate expression → choose true/false edge
    │   ├─ Delay → applyThinkTime()
    │   ├─ Fork → launch parallel branches
    │   ├─ Join → await branches
    │   └─ Loop → repeat sub-graph
    │
    ├─ Progress: animate node states (pending → running → pass/fail)
    ├─ Variables: update Variable Context Bar in real-time
    └─ Results: show per-step timing + pass/fail on canvas
```

### Load Test (from HARNESS)

```
User selects workflow in HARNESS → configures iterations/concurrency → Run
    │
    ▼
executor.ts routes mode='workflow' → runWorkflowLoad()
    │
    ├─ Creates N child VariableContexts
    ├─ Runs workflow N times (with concurrency pool)
    ├─ Each iteration: full graph traversal with isolated variables
    └─ Aggregated results → standard ResultsDashboard
```

### Engine Components (already built in Phase A)

| Component | File | Status |
|---|---|---|
| `VariableContext` | `src/engine/workflow/variableContext.ts` | Done |
| `resolveScenario()` | `src/engine/workflow/resolveScenario.ts` | Done |
| `extractVariables()` | `src/engine/workflow/extractVariables.ts` | Done |
| `runWorkflow()` | `src/engine/workflow/workflowRunner.ts` | Done |
| `runWorkflowLoad()` | `src/engine/workflow/workflowRunner.ts` | Done |
| `Extraction` type | `src/types/index.ts` | Done |
| CLI support | `cli/loader.ts` | Done |

---

## 8. Storage

Workflows are saved using the existing dual-mode storage layer (`src/utils/storage.ts`):

- **Web**: `localStorage` key `workflows` → `Workflow[]`
- **Tauri**: File system at `workflows.json`

Each workflow is a self-contained document — all node data, edges, positions, and variables are serialized.

---

## 9. Technology Choice: React Flow

[React Flow](https://reactflow.dev/) (`@xyflow/react`) for the canvas:

- Mature, well-maintained library for node-based editors
- Built-in: zoom, pan, minimap, drag-and-drop, edge routing
- Custom node components (our HTTP/Condition/Delay nodes)
- Controlled mode — we own the node/edge state
- Works with React 18+, TypeScript-first

---

## 10. File Structure

```
src/
├── types/
│   └── workflow.ts              # Workflow, WorkflowNode, WorkflowEdge types
├── pages/
│   └── WorkflowDesigner.tsx     # Top-level page component
├── components/workflow/
│   ├── WorkflowCanvas.tsx       # React Flow canvas wrapper
│   ├── WorkflowToolbar.tsx      # New/Open/Save/Run buttons
│   ├── WorkflowPalette.tsx      # Left panel: node blocks + REQUESTS/CATALOG browser
│   ├── WorkflowConfigPanel.tsx  # Right panel: per-node config editor
│   ├── WorkflowStatusBar.tsx    # Footer: step count, variable count, status
│   ├── VariableContextBar.tsx   # Live variable display during execution
│   ├── VariablePanel.tsx        # Variable chip display (done)
│   ├── WorkflowVariablesInput.tsx  # Initial variables editor (done)
│   └── nodes/
│       ├── HttpStepNode.tsx          # HTTP request node ✅
│       ├── ConditionNode.tsx         # If/Else diamond node ✅
│       ├── DelayNode.tsx             # Timer/delay node ✅
│       ├── StartNode.tsx             # Workflow start node ✅
│       ├── EndNode.tsx               # Workflow end node ✅
│       ├── ForkNode.tsx              # Parallel fork node ✅
│       ├── JoinNode.tsx              # Parallel join node ✅
│       ├── WebhookTriggerNode.tsx    # Webhook trigger node ✅
│       ├── ScheduleTriggerNode.tsx   # Schedule trigger node ✅
│       ├── LoopNode.tsx              # Loop node (planned)
│       ├── SwitchNode.tsx            # Multi-branch node (planned)
│       ├── SetVariableNode.tsx       # Variable assignment node (planned)
│       └── AggregateNode.tsx         # Aggregation node (planned)
├── engine/workflow/
│   ├── variableContext.ts       # Variable store (done)
│   ├── resolveScenario.ts       # Template resolution (done)
│   ├── extractVariables.ts      # Response extraction (done)
│   ├── workflowRunner.ts        # Sequential execution (done)
│   ├── graphRunner.ts           # Graph-based execution (traverses nodes/edges)
│   └── index.ts                 # Barrel exports (done)
├── hooks/
│   └── useWorkflows.ts          # CRUD + storage for workflows
└── styles/
    └── workflow.css              # All workflow-specific styles
```

---

_Last updated: 2026-04-19_
