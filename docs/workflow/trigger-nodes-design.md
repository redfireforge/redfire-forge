# Workflow Trigger Nodes & Defaults Redesign

> Design document for adding explicit trigger/entry-point nodes to the Workflow Designer
> and restructuring how default variables are provided.

**Status:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ⏳

**Progress Summary:**
- ✅ Phase 1: Start node + Workflow Variables (merged to develop April 23, 2026)
- ✅ Phase 2: Fork/Join nodes with parallel execution (merged to develop April 23, 2026)
- ✅ Phase 3: Webhook Trigger node (merged to develop April 23, 2026)
- ✅ Phase 4: Schedule Trigger node (merged to develop April 23, 2026)
- ⏳ Phase 5: Backend webhook server & cron runner (pending - requires Tauri/Node backend)

**Latest Merge:** `feature/webhook-schedule-triggers` → `develop` (April 23, 2026)
- 31 new tests (11 unit + 20 E2E), all passing
- Webhook & Schedule trigger nodes fully integrated with graphRunner
- Variable extraction from webhook payloads, automatic time variables for schedules
- Configuration UI complete with method selection, cron expressions, timezone support

**Previous Merge:** `feature/workflow-trigger-nodes` → `develop` (April 23, 2026)
- 53 files changed, +6,236 insertions, -470 deletions
- Test coverage: 91.68% branch coverage in workflow directory
- All 70 E2E tests passing, 1554 unit tests passing

---

## Motivation

1. **Implicit entry points** — currently any node with no incoming edge is a starting node; this is invisible and confusing when multiple branches start independently.
2. **Global defaults are too flat** — the "Defaults" modal stores a single `Record<string, string>` for the entire workflow. When branches have different input requirements, all variables are lumped together.
3. **No trigger concept** — workflows always run manually. There's no way to express that a workflow should be invoked by an external event (webhook, scheduler).

---

## New Block Types

### 1. Manual Start

| Property | Value |
|----------|-------|
| Type ID | `start` |
| Icon | ▶ (play) |
| Color | Green |
| Purpose | Explicit entry point — user clicks "Run" |
| Max per workflow | 1 (enforced) |

**Node data:**

```typescript
interface StartNodeData {
  label: string;            // e.g. "Start"
  inputVariables: Record<string, string>;  // variables provided at trigger time
}
```

**Behavior:**
- Auto-created when a new workflow is made (cannot be deleted)
- Has only an **output** handle (no input)
- Clicking "Configure" opens a panel to define input variables
- At runtime, these variables seed the `VariableContext` before the first step
- Replaces the need to put common variables in the global "Defaults" modal

**Visual:**

```
┌──────────────────────┐
│  ▶  Manual Start     │
│  ──────────────────  │
│  vin: "1G1YY22G..."  │
│  env: "t01"          │
│  country: "US"       │
└──────────┬───────────┘
           │
           ▼
     [First Step]
```

---

### 2. Webhook Trigger

| Property | Value |
|----------|-------|
| Type ID | `webhook` |
| Icon | 🔗 (link) |
| Color | Blue |
| Purpose | Workflow invoked by an incoming HTTP request |
| Max per workflow | Multiple allowed |

**Node data:**

```typescript
interface WebhookNodeData {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                    // e.g. "/api/trigger/kafka"
  variableMapping: Array<{
    variableName: string;          // workflow variable name
    source: 'body' | 'header' | 'query' | 'path';
    expression: string;            // JSONPath or header name
  }>;
}
```

**Behavior:**
- Has only an **output** handle
- Defines how incoming request data maps to workflow variables
- At runtime (future): exposes an HTTP endpoint; on request, starts the workflow with mapped variables
- For now (test mode): user can simulate by providing sample payload in the configure panel

**Visual:**

```
┌──────────────────────────────┐
│  🔗  Webhook Trigger         │
│  ────────────────────────── │
│  POST /api/trigger/kafka     │
│  ────────────────────────── │
│  vin     ← $.body.vin        │
│  country ← $.body.country    │
│  traceId ← $.headers.X-Trace │
└──────────────┬───────────────┘
               │
               ▼
         [First Step]
```

---

### 3. Schedule Trigger

| Property | Value |
|----------|-------|
| Type ID | `schedule` |
| Icon | 🕐 (clock) |
| Color | Orange |
| Purpose | Workflow runs on a cron or interval schedule |
| Max per workflow | 1 |

**Node data:**

```typescript
interface ScheduleNodeData {
  label: string;
  mode: 'cron' | 'interval';
  cronExpression?: string;         // e.g. "0 */5 * * *"
  intervalMs?: number;             // e.g. 300000 (5 min)
  inputVariables: Record<string, string>;  // static variables for each run
}
```

**Auto-injected variables at runtime:**

| Variable | Description |
|----------|-------------|
| `{{$scheduledTime}}` | ISO timestamp of the scheduled run |
| `{{$runCount}}` | Number of times this schedule has fired |
| `{{$previousRunStatus}}` | `pass` / `fail` / `none` |

**Visual:**

```
┌──────────────────────────────┐
│  🕐  Schedule Trigger        │
│  ────────────────────────── │
│  Cron: 0 */5 * * *  (5 min)  │
│  ────────────────────────── │
│  baseUrl: "https://..."      │
│  apiKey:  "sk-..."           │
└──────────────┬───────────────┘
               │
               ▼
         [First Step]
```

---

### 4. Parallel Fork

| Property | Value |
|----------|-------|
| Type ID | `fork` |
| Icon | ⑃ (fork) |
| Color | Purple |
| Purpose | Fan-out to multiple branches simultaneously |
| Handles | 1 input, N outputs |

**Node data:**

```typescript
interface ForkNodeData {
  label: string;
  branches: Array<{
    id: string;
    label: string;                             // e.g. "Trial Offer", "Onstar Profile"
    variableOverrides?: Record<string, string>; // per-branch variable overrides
  }>;
}
```

**Behavior:**
- Each output handle corresponds to a named branch
- Branches execute in parallel
- Optional per-branch variable overrides (e.g. branch A gets `endpoint=/trial`, branch B gets `endpoint=/onstar`)
- All branches must complete before any downstream join node

**Visual:**

```
        [▶ Manual Start]
               │
        [⑃ Parallel Fork]
         /        |        \
  [Trial      [Onstar     [Kafka
   Offer]      Profile]    Status]
```

---

## Variable Resolution Redesign

### Current: Flat Global

```
Workflow Variables (Defaults button)
        ↓
   All nodes read from one pool
```

### Proposed: Tiered Scoping

```
Priority (highest wins):
┌────────────────────────────────┐
│  1. Node Variables             │  ← Per-node overrides (existing initialVariables)
├────────────────────────────────┤
│  2. Extracted Variables        │  ← From upstream node extractions
├────────────────────────────────┤
│  3. Fork Branch Variables      │  ← Per-branch overrides from Parallel Fork
├────────────────────────────────┤
│  4. Trigger Variables          │  ← From the trigger node (Start / Webhook / Schedule)
├────────────────────────────────┤
│  5. Workflow Variables         │  ← Global constants (renamed "Defaults")
├────────────────────────────────┤
│  6. Built-in Generators        │  ← {{$uuid}}, {{$timestamp}}, etc.
└────────────────────────────────┘
```

### Impact on "Defaults" Button

| Before | After |
|--------|-------|
| "Defaults" button in toolbar | Rename to **"Workflow Variables"** |
| Stores all input variables | Stores only **shared constants** (baseUrl, apiKey, auth tokens) |
| Trigger-specific inputs mixed in | Trigger-specific inputs move to **trigger node config panel** |

---

## Handling Multiple Entry Points

### Scenario A: Single Trigger → Parallel Branches

Best for: same trigger, different API calls in parallel.

```
[▶ Manual Start]
  vin, env, country
       │
  [⑃ Parallel Fork]
     /          \
[Trial Offer]  [Onstar Profile]
     \          /
  [⑃ Join / Merge]  (future)
       │
  [Process Results]
```

### Scenario B: Multiple Triggers → Independent Branches

Best for: different trigger mechanisms for different branches.

```
[▶ Manual Start]        [🔗 Webhook: Kafka Event]
  vin, env                   vin ← $.body.vin
     │                            │
[Trial Offer]           [Kafka Status Check]
```

### Scenario C: Schedule + Manual Override

Best for: regular polling with ability to trigger on-demand.

```
[🕐 Schedule: Every 5 min]     [▶ Manual Start]
  baseUrl, apiKey                  baseUrl, apiKey, forceRefresh=true
            \                    /
             [⑃ Merge Point]  (takes first trigger that fires)
                    │
            [Refresh Cache API]
```

---

## Node Config Panel Changes

### Start Node Config

```
┌──────────────────────────────────────┐
│  Configure: Manual Start             │
│  ────────────────────────────────── │
│                                      │
│  Input Variables                     │
│  ┌──────────┬───────────────────┐   │
│  │ Name     │ Default Value     │   │
│  ├──────────┼───────────────────┤   │
│  │ vin      │ 1G1YY22G965...   │   │
│  │ env      │ t01              │   │
│  │ country  │ US               │   │
│  │ baseUrl  │ https://api...   │   │
│  └──────────┴───────────────────┘   │
│  [+ Add Variable]                    │
│                                      │
│  ┌──────┐  ┌────────┐              │
│  │ Save │  │ Cancel │              │
│  └──────┘  └────────┘              │
└──────────────────────────────────────┘
```

### Webhook Node Config

```
┌──────────────────────────────────────┐
│  Configure: Webhook Trigger          │
│  ────────────────────────────────── │
│                                      │
│  Method: [POST ▼]                    │
│  Path:   /api/trigger/kafka          │
│                                      │
│  Variable Mapping                    │
│  ┌────────────┬────────┬───────────┐│
│  │ Variable   │ Source │ Path      ││
│  ├────────────┼────────┼───────────┤│
│  │ vin        │ body   │ $.vin     ││
│  │ country    │ body   │ $.country ││
│  │ traceId    │ header │ X-Trace   ││
│  └────────────┴────────┴───────────┘│
│  [+ Add Mapping]                     │
│                                      │
│  Sample Payload (for testing)        │
│  ┌──────────────────────────────┐   │
│  │ {                            │   │
│  │   "vin": "1G1YY22G965...",   │   │
│  │   "country": "US"           │   │
│  │ }                            │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────┐  ┌────────┐              │
│  │ Save │  │ Cancel │              │
│  └──────┘  └────────┘              │
└──────────────────────────────────────┘
```

---

## Blocks Panel Update

Current:

```
BLOCKS
├── HTTP Request       — API call with extraction
├── Condition          — If/Else branching
└── Delay              — Pause between steps
```

Proposed:

```
BLOCKS
┌─ Triggers
│  ├── Manual Start     — Run workflow manually
│  ├── Webhook Trigger  — Invoke via HTTP endpoint
│  └── Schedule Trigger — Run on cron/interval
│
├─ Logic
│  ├── Condition        — If/Else branching
│  ├── Parallel Fork    — Fan-out to parallel branches
│  └── Delay            — Pause between steps
│
└─ Actions
   └── HTTP Request     — API call with extraction
```

---

## Implementation Order

| Phase | Scope | Effort | Status |
|-------|-------|--------|--------|
| **Phase 1** | Manual Start node + rename Defaults → Workflow Variables | Small | ✅ Complete |
| **Phase 2** | Parallel Fork node | Medium | ✅ Complete |
| **Phase 3** | Webhook Trigger node (UI + simulate mode) | Medium | 🚧 In Progress |
| **Phase 4** | Schedule Trigger node (UI + simulate mode) | Medium | ⏳ Pending |
| **Phase 5** | Backend: actual webhook server & cron runner (Tauri/Node) | Large | ⏳ Pending |

### Phase 1 Detail (Manual Start) — ✅ COMPLETE

**Implemented:**
1. ✅ Added `start` to `WorkflowNodeType` union
2. ✅ Created `StartNode.tsx` component with green play icon
3. ✅ Auto-insert Start node on new workflow creation
4. ✅ Start node stores initial variables in `inputVariables`
5. ✅ Renamed "Defaults" button → "Workflow Variables" in toolbar
6. ✅ Updated `runGraph()` engine to seed variables from Start node
7. ✅ Unit tests (19 tests) + E2E tests (9 tests including Start node visibility)
8. ✅ Added End node for terminal states
9. ✅ Migration: auto-create Start node for existing workflows (schema v3 → v4)

**Merged:** feature/workflow-trigger-nodes → develop (commit 460b5f1)

### Phase 2 Detail (Parallel Fork) — ✅ COMPLETE

**Implemented:**
1. ✅ Added `fork` and `join` to `WorkflowNodeType` union
2. ✅ Created `ForkNode.tsx` component (parallel split with multiple output handles)
3. ✅ Created `JoinNode.tsx` component (parallel merge with wait-all semantics)
4. ✅ Updated `graphRunner.ts` for parallel execution:
   - Fork spawns concurrent execution paths
   - Join waits for all incoming branches before proceeding
   - HTTP requests on parallel paths execute concurrently
5. ✅ DebugController: "Waiting for N threads" status on Join nodes
6. ✅ Auto-layout support: Dagre algorithm + smart fork/join path centering
7. ✅ Unit tests (27 new tests in graphRunner.additional.test.ts) + E2E tests (9 tests)
8. ✅ Test coverage: 91.68% branch coverage in workflow directory

**Merged:** feature/workflow-trigger-nodes → develop (commit 460b5f1)

### Phase 3 Detail (Webhook Trigger) — 🚧 IN PROGRESS

**Scope:**
1. Add `webhook` to `WorkflowNodeType` union
2. Create `WebhookTriggerNode.tsx` component
3. Webhook configuration UI: HTTP method (POST/PUT/PATCH), endpoint path, sample payload
4. "Simulate Webhook" feature in WorkflowToolbar (modal to paste test JSON)
5. Update `graphRunner.ts` to handle webhook entry points
6. Variable extraction from webhook payload via JSONPath
7. Unit tests for webhook node configuration and execution
8. E2E tests (deferred until develop → release merge per git-branching policy)

**Testing Note:** Per `.cursor/rules/git-branching.mdc`, E2E tests are NOT required for feature→develop merges. E2E tests will be run when merging develop→release or release→master.

### Phase 4 Detail (Schedule Trigger) — 🚧 IN PROGRESS

**Scope:**
1. Add `schedule` to `WorkflowNodeType` union
2. Create `ScheduleTriggerNode.tsx` component  
3. Schedule configuration UI: cron expression, timezone, recurrence pattern
4. "Simulate Schedule" feature in WorkflowToolbar (manual trigger)
5. Update `graphRunner.ts` to handle schedule entry points
6. Variable injection: current time, trigger timestamp
7. Unit tests for schedule node configuration
8. E2E tests (deferred until develop → release merge per git-branching policy)

**Testing Note:** Per `.cursor/rules/git-branching.mdc`, E2E tests are NOT required for feature→develop merges. E2E tests will be run when merging develop→release or release→master.

1. Add `start` to `WorkflowNodeType` union
2. Create `StartNode.tsx` component
3. Auto-insert Start node on new workflow creation
4. Move trigger-specific variables from Defaults → Start node config
5. Rename "Defaults" button → "Workflow Variables"
6. Update `runWorkflow()` engine to seed variables from Start node
7. Unit tests + E2E tests

---

## Migration Strategy

Existing workflows (no Start node):

1. On load, if no `start` node exists, auto-create one at position `(x: firstNode.x, y: firstNode.y - 150)`
2. Connect Start node to all root nodes (nodes with no incoming edges)
3. Move `workflow.variables` → Start node's `inputVariables`
4. Keep `workflow.variables` as "Workflow Variables" (shared constants)
5. Bump `schemaVersion` from 3 → 4
