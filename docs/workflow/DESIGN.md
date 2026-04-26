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
| **HTTP Request** | Rounded rect | Execute an API call | Method, URL, headers, body, auth, extractions, assertions, service binding; inline `{{` autocomplete in all expression fields | ✅ Done |
| **Condition (If/Else)** | Diamond | Branch based on variable/status | Left operand (searchable variable picker or expression with inline autocomplete), operator, right operand, true/false edges | ✅ Done |
| **Delay** | Clock icon | Pause between steps | Duration (fixed or random), min/max ms | ✅ Done |
| **Fork** | Split arrows | Start parallel branches | Fan-out to N children | ✅ Done |
| **Join** | Merge arrows | Wait for parallel branches | Wait-all strategy | ✅ Done |
| **End** | Circle (red) | Workflow exit point | Label only | ✅ Done |
| **Webhook Trigger** | Webhook icon | Start workflow from webhook | HTTP method, path, sample payload, variable extraction | ✅ Done |
| **Schedule Trigger** | Clock/calendar icon | Start workflow on schedule | Cron expression, timezone, schedule description | ✅ Done |
| **Switch** | Multi-diamond (⇅) | Multi-way branching | Expression, ordered cases (value + label), default fallback | ✅ Done |
| **Loop** | Rounded rect (🔄) | Repeat steps | Count / ForEach / While modes, index/item variables, max iterations safety cap | ✅ Done |
| **Set Variable** | Assignment icon (📝) | Set or transform variables | Variable name, value expression, template resolution | ✅ Done |
| **Aggregate** | Sigma icon (Σ) | Combine/accumulate values | Source/target mappings, strategy (concat, first, last, count, sum, custom) | ✅ Done |
| **Error Handler** | Shield icon (🛡) | Catch and handle step errors | Error filter (HTTP/assertion/network/all), retry count/delay/backoff, retry timeout, continue-on-error flag; body (try) and catch edge paths | ✅ Done |
| **Log/Debug** | Bug icon (🐛) | Log variables or messages | Message template with `{{variable}}` support, log level (info/warn/error/debug), snapshot-all-variables toggle | ✅ Done |
| **Wait for Condition** | Hourglass icon (⏳) | Poll until condition met | Condition expression, polling interval (ms), timeout (ms), max attempts; re-executes body subgraph each poll | ✅ Done |

### Future Nodes 💡

| Node | Shape | Purpose | Config | Priority |
|---|---|---|---|---|
| **Script/Transform** | Code icon | Execute JavaScript | Code editor, input/output variables | Medium |
| **Sub-workflow** | Nested icon | Call another workflow as a step | Workflow reference, input/output mapping | Low |
| **Database Query** | DB icon | Execute SQL queries | Connection, query, result mapping | Low |
| **Rate Limiter** | Throttle icon | Control request rate per step | Requests/sec, burst limit | Low |
| **Cache** | Cache icon | Cache responses by key | Cache key, TTL, invalidation | Low |
| **File Operations** | File icon | Read/write files | File path, format (CSV/JSON), mapping | Low |
| **Email/Notification** | Bell icon | Send email/Slack/webhook | Recipients, template, channel | Low |
| **GraphQL Request** | GraphQL icon | Execute GraphQL queries | Query editor, variables, introspection | Low |

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

### Phase 3: Advanced Control Flow (✅ Complete)
- **Loop** — Iterate over arrays or repeat N times
  - Three modes: Count (fixed iterations), ForEach (iterate JSON array with item/index variables), While (condition-based)
  - Config: for-each array variable, repeat count, while condition, max iterations safety cap
- **Switch** — Multi-way branching (more than 2 paths)
  - Evaluate expression against defined cases; each case creates an output path; unmatched values follow Default
  - Config: multiple case conditions, default path
- **Set Variable** — Explicit variable manipulation
  - Assign variable name/value pairs during execution with template expression support
  - Config: variable assignments, transform functions

### Phase 4: Reliability & Observability (✅ Complete)
- **Aggregate** — Combine parallel branch results
  - Source/target mappings with strategies: concat, sum, count, first, last, array
  - Config: merge strategy, source expression, target variable
- **Error Handler** — Structured error handling with retry/fallback
  - Error filter: HTTP failures, assertion failures, network errors, or all
  - Retry: configurable count, delay, backoff (none/linear/exponential), max timeout
  - Two edge paths: body (try) and catch (fallback)
  - Continue-on-error flag: resume workflow after catch or mark as failed
- **Log/Debug** — Workflow debugging and variable inspection
  - Message template with `{{variable}}` resolution
  - Log levels: info, warn, error, debug
  - Snapshot-all-variables toggle for debugging
- **Wait for Condition** — Polling-based condition wait
  - Re-executes body subgraph on each poll until condition expression is satisfied
  - Configurable polling interval, max timeout, max attempts

### Phase 5: Extended Capabilities (Future)
- **Script/Transform** — JavaScript execution for complex logic
- **Database Query** — Direct SQL testing and data operations
- **Sub-workflow** — Reusable workflow modules
- **Rate Limiter** — Control request pacing
- **Cache** — Response caching and data sharing
- **File Operations** — CSV/JSON input/output
- **Notification** — Email/Slack/webhook alerts

### Priority Justification

Phases 1–4 are complete (all 16 node types implemented). Remaining priorities:

**Script/Transform is #1** because:
- Fills gap for complex data manipulation beyond template expressions
- Needed for response transformation, conditional logic beyond simple operators

**Sub-workflow is #2** because:
- Enables reusable workflow modules (DRY principle)
- Required for complex test suites with shared setup/teardown steps

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
  type: 'http' | 'condition' | 'delay' | 'start' | 'end' | 'webhook' | 'schedule' | 'fork' | 'join' | 'loop' | 'aggregate' | 'switch' | 'setVariable' | 'errorHandler' | 'logDebug' | 'waitForCondition';
  position: { x: number; y: number };
  data: HttpNodeData | ConditionNodeData | DelayNodeData | StartNodeData | EndNodeData | WebhookTriggerNodeData | ScheduleTriggerNodeData | ForkNodeData | JoinNodeData | LoopNodeData | AggregateNodeData | SwitchNodeData | SetVariableNodeData | ErrorHandlerNodeData | LogDebugNodeData | WaitForConditionNodeData;
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

interface ErrorHandlerNodeData {
  label: string;
  errorFilter: 'http' | 'assertion' | 'network' | 'all';  // what counts as an error
  retryCount: number;                        // how many times to retry body
  retryDelayMs: number;                      // delay between retries
  retryBackoff: 'none' | 'linear' | 'exponential';
  retryTimeoutMs: number;                    // max total timeout (0 = unlimited)
  continueOnError: boolean;                  // resume or fail after catch path
}

interface LogDebugNodeData {
  label: string;
  message: string;                           // template with {{variable}} syntax
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  snapshotVariables: boolean;                // snapshot all variables at this point
}

interface WaitForConditionNodeData {
  label: string;
  conditionExpression: string;               // evaluated against variables
  pollIntervalMs: number;                    // ms between polls
  timeoutMs: number;                         // max wait (0 = unlimited)
  maxAttempts: number;                       // max polls (0 = unlimited)
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
│   └── workflow.ts              # Workflow, WorkflowNode, WorkflowEdge, all 16 node data types
├── pages/
│   └── WorkflowDesigner.tsx     # Top-level page component
├── components/workflow/
│   ├── WorkflowCanvas.tsx       # React Flow canvas wrapper
│   ├── WorkflowToolbar.tsx      # New/Open/Save/Run buttons
│   ├── WorkflowPalette.tsx      # Left panel: node blocks + REQUESTS/CATALOG browser
│   ├── WorkflowSidebar.tsx      # Sidebar navigation
│   ├── WorkflowConfigPanel.tsx  # Right panel: per-node config editor
│   ├── WorkflowStatusBar.tsx    # Footer: step count, variable count, status
│   ├── WorkflowConsolePanel.tsx # Execution console with search, timeline, log output
│   ├── WorkflowDebugBar.tsx     # Debug controls (step, continue, breakpoints)
│   ├── WorkflowExecSummary.tsx  # Post-run execution summary
│   ├── WorkflowDetailModal.tsx  # Workflow details/metadata modal
│   ├── WorkflowDefaultsModal.tsx # Default variables modal
│   ├── WorkflowNodeConfigModal.tsx # Full-screen node config modal
│   ├── WorkflowNodeContextMenu.tsx # Right-click context menu on nodes
│   ├── WorkflowNodeRunContext.tsx  # Run-time node context display
│   ├── WorkflowRunHistoryDropdown.tsx # Run history selector
│   ├── WorkflowHarnessContextBar.tsx # Harness integration bar
│   ├── WorkflowResponseBody.tsx # Response body viewer in config panel
│   ├── WorkflowRequestsSettingsModal.tsx # Request settings modal
│   ├── WorkflowServiceRegistryModal.tsx # Service registry management
│   ├── WorkflowServicesPanelInline.tsx  # Inline services panel
│   ├── WorkflowInspectContext.tsx # Variable inspector during debug
│   ├── WorkflowShortcutsOverlay.tsx # Keyboard shortcuts help overlay
│   ├── WorkflowToastProvider.tsx # Toast notification provider
│   ├── WorkflowVariableInsertModal.tsx # Variable picker modal
│   ├── WorkflowVariablesInput.tsx # Initial variables editor
│   ├── VariablePanel.tsx        # Variable chip display
│   ├── AvailableVariables.tsx   # Available variables display
│   ├── ComposeStrip.tsx         # Compose/send strip
│   ├── ServerStatusIndicator.tsx # Server connection status
│   ├── InsertVarField.tsx       # Insert variable field component
│   ├── HttpConfig.tsx           # HTTP node config with ExpressionInput in URL/headers/body
│   ├── ConditionConfig.tsx      # Condition config with SearchableVariableSelect + ExpressionTextarea
│   ├── DelayConfig.tsx          # Delay node configuration
│   ├── ScheduleConfig.tsx       # Schedule trigger configuration
│   ├── LoopConfig.tsx           # Loop node configuration (Count/ForEach/While modes)
│   ├── SwitchConfig.tsx         # Switch node configuration (cases + default)
│   ├── SetVariableConfig.tsx    # SetVariable node configuration
│   ├── AggregateConfig.tsx      # Aggregate node configuration
│   ├── ErrorHandlerConfig.tsx   # Error handler config (retry, backoff, catch path)
│   ├── LogDebugConfig.tsx       # Log/debug node configuration
│   ├── NodeConfigInputTab.tsx   # Config modal input tab
│   ├── NodeConfigOutputTab.tsx  # Config modal output tab
│   ├── NodeConfigLogsTab.tsx    # Config modal logs tab
│   ├── ExpressionInput.tsx      # Input with inline {{variable}} and $function autocomplete
│   ├── ExpressionTextarea.tsx   # Textarea variant of ExpressionInput
│   ├── ExpressionHintDropdown.tsx # Portal-rendered autocomplete dropdown
│   ├── ExpressionBuilderView.tsx # Visual expression builder
│   ├── SearchableVariableSelect.tsx # Searchable combobox for variable picking
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
│       ├── LoopNode.tsx              # Loop node ✅
│       ├── SwitchNode.tsx            # Multi-branch node ✅
│       ├── SetVariableNode.tsx       # Variable assignment node ✅
│       ├── AggregateNode.tsx         # Aggregation node ✅
│       ├── ErrorHandlerNode.tsx      # Error handler node ✅
│       ├── LogDebugNode.tsx          # Log/debug node ✅
│       ├── WaitForConditionNode.tsx  # Wait-for-condition node ✅
│       ├── NodeIcon.tsx              # Shared node icon component
│       ├── NodePausedOverlay.tsx     # Debug pause overlay
│       └── useNodeBase.ts            # Shared node base hook
├── engine/workflow/
│   ├── variableContext.ts       # Variable store (layered: env → manual → extracted)
│   ├── resolveScenario.ts       # Template resolution in URL/headers/body/auth
│   ├── extractVariables.ts      # Response extraction (JSONPath/header/status)
│   ├── graphRunner.ts           # Graph-based execution engine (all 16 node types)
│   ├── workflowRunner.ts        # Sequential/load execution modes
│   ├── debugController.ts       # Step-through debug controller
│   ├── fetchScenarioSample.ts   # Fetch sample data for preview
│   ├── absoluteUrl.ts           # URL resolution utilities
│   └── index.ts                 # Barrel exports
├── hooks/
│   ├── useWorkflows.ts          # CRUD + storage for workflows
│   ├── useWorkflowRunCache.ts   # Run result caching
│   ├── useExpressionHints.ts    # Inline autocomplete for {{var}} and $function triggers
│   ├── useVariableInsertModal.ts # Variable picker modal hook
│   ├── useNodeClipboard.ts      # Copy/paste nodes
│   ├── useUndoRedo.ts           # Undo/redo for workflow edits
│   ├── useListCrud.ts           # Generic ordered-list CRUD (shared by config panels)
│   └── useDebounce.ts           # Debounce hook
├── utils/
│   ├── workflowAutoLayout.ts    # Dagre-based hierarchical auto-layout
│   ├── workflowMigrations.ts    # Data migration for workflow schema changes
│   ├── workflowSourceMap.ts     # Variable source resolution across nodes
│   ├── workflowVariableHints.ts # Variable hint collection and validation
│   ├── workflowNodeMerge.ts     # Node merge/update utilities
│   ├── workflowHostResolve.ts   # Host/base URL resolution for workflow requests
│   ├── workflowEnvReadiness.ts  # Environment readiness checks
│   ├── workflowRequestHost.ts   # Per-request host resolution
│   ├── workflowRunErrors.ts     # Run error handling utilities
│   ├── workflowSessionStorage.ts # Session-scoped workflow state persistence
│   └── expressionFunctions.ts   # Built-in expression function registry ($upper, $concat, etc.)
└── styles/
    └── workflow.css              # All workflow-specific styles
```

---

_Last updated: 2026-04-25_
