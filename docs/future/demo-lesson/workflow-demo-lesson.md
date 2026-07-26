# Workflow Demo Lessons — Comprehensive Plan

> **Domain:** `workflow`
> **Status:** New — fills the empty `workflowDomain` (currently `available: false`)

---

## Design Philosophy

These lessons teach the Workflow Designer **from scratch** — building real workflows step by step, not loading pre-made samples. The viewer learns by watching actual construction: dragging nodes, connecting edges, configuring, and executing.

**Key principles:**
- Every workflow is **built live** during the demo — no gallery sample imports
- All HTTP calls use **JSONPlaceholder API** (CORS-friendly, no auth, reliable)
- Each lesson **builds on the prior one's knowledge** but can stand alone via `preAction` guards
- The focus is on **core workflow concepts** (not protocol-specific like gRPC/Kafka/WS — those have their own lessons)
- Execution uses **Quick Test** (graph runner) for instant feedback

---

## Current Coverage Gaps

The existing protocol-specific workflow lessons cover:
- WebSocket workflow builder (`ws-workflow-builder`)
- Kafka produce/consume/wait workflows (`kafka-workflow-produce`, `kafka-workflow-consume-wait`)
- GraphQL query/mutation/subscription workflows (GQL-16 through GQL-19)
- gRPC unary/assert workflows (GRPC-11, GRPC-24)

**What's completely missing:** A general-purpose workflow curriculum that teaches the Designer itself — HTTP workflows, control flow, variables, debugging, versioning. The `workflowDomain` is registered but has zero lessons.

---

## Lesson Summary

| # | ID | Title | Steps | Est. Time | Key Features Covered |
|---|---|---|---|---|---|
| WF-1 | `wf-first-workflow` | Build Your First Workflow | 5 | 5 min | Canvas basics, + New, palette, drag HTTP node, connect edges, Quick Test, result |
| WF-2 | `wf-variables-extraction` | Variables & Data Flow | 5 | 5 min | Extraction, Set Variable, expression syntax, chain data between nodes, variable panel |
| WF-3 | `wf-conditional-logic` | Conditional Branching | 5 | 5 min | userId extraction review, Condition node (if/else), Switch node (multi-way), status-code routing, branch paths |
| WF-4 | `wf-loops-parallel` | Loops & Parallel Execution | 5 | 5 min | Loop node (forEach/count), Fork/Join, Aggregate, parallel API calls |
| WF-5 | `wf-error-handling` | Error Handling & Recovery | 4 | 4 min | Error Handler node, retry config, catch path, error variables, graceful degradation |
| WF-6 | `wf-debug-console` | Quick Test & Debug Mode | 5 | 5 min | Quick Test, Console panel, step-through Debug, variable inspection, exec summary |
| WF-7 | `wf-version-services` | Versioning, Services & Catalog Integration | 5 | 5 min | Version snapshot, compare diff, restore, Service Registry, multi-env resolution, Catalog orphan badge (D3) |
| WF-8 | `wf-protocol-nodes` | Protocol Nodes Overview | 4 | 4 min | gRPC/Kafka/WS/GraphQL palette blocks, multi-protocol workflow, links to deep-dive lessons |
| **Total** | | | **38** | **~38 min** | |

---

## Prerequisite: Seeded Data

- **All lessons** use the JSONPlaceholder API (`https://jsonplaceholder.typicode.com`) as the target
- **WF-1** starts from an empty canvas — no pre-seeded workflow
- **WF-2 through WF-7** seed a minimal workflow programmatically in `setup` (or rely on `preAction` guards) so viewers don't watch the same build sequence repeatedly
- Seeding uses `workflowDesignerAdapter.insertWorkflow()` + `addWorkflowNode()` + `connectWorkflowNodes()`

---

## WF-1: Build Your First Workflow

**Goal:** Create a workflow from scratch — learn the canvas, palette, node configuration, connections, and Quick Test execution.

| Field | Value |
|---|---|
| `id` | `wf-first-workflow` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflows` |
| `allowedTabs` | `['workflows']` |

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf1-create` | Create a New Workflow | `WF.SIDEBAR_NEW_BTN` | Expand app sidebar → click **+ New** → dropdown appears → click **Blank Workflow** → type name "My First Workflow" → confirm → empty canvas appears with Start node (800ms) → spotlight the Start node (1000ms) → spotlight the Palette on the left (1200ms, explain the 5 categories: Triggers, Actions, Logic, Data, Flow) |
| 2 | `wf1-add-http` | Add an HTTP Request Node | `WF.PALETTE` | Spotlight the **Actions** category in palette (1000ms) → spotlight the **HTTP Request** block (1000ms) → click it onto the canvas (animated) → node appears → spotlight the new HTTP node (1200ms, explain: this will make a real API call) |
| 3 | `wf1-connect` | Connect the Nodes | `WF.CANVAS` | Spotlight the **Start** node's output handle (1000ms) → drag from Start output → connect to HTTP node input → edge appears with animation (1200ms) → spotlight the connected edge (1000ms, explain: data flows left to right, edges define execution order) → click **Fit View** to center the graph (800ms) |
| 4 | `wf1-configure` | Configure the HTTP Node | `WF.NODE_CONFIG` | Double-click the HTTP node → config modal opens → spotlight the config modal (1000ms, explain Config/Input/Output/Logs tabs) → fill **URL** field with `https://jsonplaceholder.typicode.com/posts/1` → spotlight the URL field (1000ms) → select **GET** method → spotlight method selector (800ms) → spotlight the **Input** tab (show where variables would go — 1000ms) → click **Save** → modal closes → node shows the configured URL label (1200ms) |
| 5 | `wf1-run` | Quick Test — Run It! | `WF.QUICK_TEST_BTN` | Spotlight the **▶ Quick Test** button in toolbar (1200ms) → click it → nodes show running spinner → HTTP node turns green (pass) with timing badge → spotlight the green status badge (1500ms) → spotlight the **Exec Summary** overlay (1200ms, shows response status 200, timing) → spotlight **Console** badge showing "1 run" (1000ms) |

**Cleanup:** Delete the created workflow. Collapse sidebar.

---

## WF-2: Variables & Data Flow

**Goal:** Extract data from one node's response and use it in the next node — the foundation of multi-step workflows.

| Field | Value |
|---|---|
| `id` | `wf-variables-extraction` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflows` |
| `allowedTabs` | `['workflows']` |

**Prerequisite:** A seeded workflow with Start → HTTP (POST /posts, creates a post) already configured.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf2-variables-panel` | The Variables Panel | `WF.VARIABLES_BTN` | **Define the shared variable first** (before any node references it). Click **Variables** in toolbar → Variables modal opens → type key `baseUrl`, value `https://jsonplaceholder.typicode.com` → click **+** to commit the row into the list (1000ms) → Save → the **Create Post** node already uses `{{baseUrl}}/posts`; the GET will too → spotlight the **Variables** toolbar button now showing a **count badge** (1600ms) |
| 2 | `wf2-extraction` | Extract Data from a Response | `WF.NODE_CONFIG` | Double-click the POST /posts HTTP node → config modal opens → click **Extract** tab → spotlight the **Extraction** section (1200ms, explain: pull values from the response into variables) → add extraction: JSONPath `$.userId` → variable name `userId` → spotlight the configured extraction (1000ms) → Save |
| 3 | `wf2-second-node` | Add a Second HTTP Node | `WF.PALETTE` | Click a second **HTTP Request** from palette onto canvas → connect first HTTP output → second HTTP input → click **Fit View** → Save → spotlight the chain (1200ms) |
| 4 | `wf2-use-variable` | Use the Extracted Variable | `WF.NODE_HTTP` | Open the second HTTP node → URL field → type `{{baseUrl}}/users/{{userId}}` (uses **two** variables: the shared `{{baseUrl}}` host defined in step 1 + the extracted `{{userId}}`) → scroll input to end + spotlight the URL expression (1500ms) → spotlight the **Resolved URL (preview)** row echoing the template (1600ms) → Save & close → re-fit canvas |
| 5 | `wf2-run-chain` | Run the Data Chain | `WF.QUICK_TEST_BTN` | Open the **Console** first → click **▶ Quick Test** → POST executes (`{{baseUrl}}/posts` → returns `userId: 1`) → extraction stores `userId` → GET executes (`{{baseUrl}}/users/1`) → both nodes green → open Console search, type `userId`, spotlight the highlighted match in the live log (2000ms) |

**Cleanup:** Delete seeded workflow.

---

## WF-3: Conditional Branching

**Goal:** Route execution based on response data — the Condition (if/else) and Switch (multi-way) nodes.

| Field | Value |
|---|---|
| `id` | `wf-conditional-logic` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflows` |
| `allowedTabs` | `['workflows']` |

**Prerequisite:** Seeded workflow: Start → HTTP (GET /posts/1) with extraction (`userId` extracted).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf3-review-extraction` | Where userId Comes From | `WF.NODE_HTTP` | **Show the source of `{{userId}}` before branching on it** → double-click the **Get Post** HTTP node → config modal opens → spotlight the **Extract** tab first (1200ms) → switch to it → spotlight the configured extraction row `$.userId → userId` (2000ms, explain: this is the value the Condition/Switch read) → Close the modal |
| 2 | `wf3-condition-node` | Add & Configure a Condition Node | `.wf-palette-block-condition` | Spotlight **Logic** category in palette (1000ms) → spotlight **Condition** block (1000ms, explain: if/else branching) → click onto canvas → connect after the HTTP node → click **Fit View** → spotlight the Condition node showing **Yes** and **No** output handles (1500ms, explain: two paths based on your expression) → double-click Condition → config modal → spotlight **Expression** field (1000ms) → type `{{userId}} === 1` → spotlight the expression (1200ms, explain: evaluates to true/false at runtime) → Save → spotlight the node now labeled with the condition (1000ms) |
| 3 | `wf3-branch-paths` | Wire the Branch Paths | `.wf-palette-block-logDebug` | Spotlight **Log/Debug** palette block → add **Yes** Log node onto canvas → connect Condition **Yes** handle → Yes Log node → click **Fit View** → double-click to **open its config modal**: spotlight **Log Level** (Info, 1100ms) + **Message Template** `User is the author! userId={{userId}}` (2000ms) → Save & close → add **No** Log node onto canvas → connect Condition **No** handle → No Log node → click **Fit View** → double-click to **open its config modal**: spotlight **Log Level** (Warning, 1100ms) + **Message Template** `Different user — userId={{userId}}` (2000ms) → Save & close → spotlight the full diamond/branch shape (1500ms) |
| 4 | `wf3-switch-node` | The Switch Node (Multi-Way) | `.wf-palette-block-switch` | Explain: Condition is binary (yes/no), but **Switch** matches one value against many → add a Switch node onto canvas → connect from the HTTP node output → Switch input (so `userId` exists at runtime) → click **Fit View** → double-click to open config → set expression `{{userId}}` (the **same extracted var**) + 3 cases (`1`, `2`, `3` labelled User #1/#2/#3) → spotlight expression (1400ms) + cases list (1800ms) → **Save & close** → add a Log node onto canvas → connect Switch **User #1** case handle → Log node → click **Fit View** → double-click to **open its config modal**: spotlight **Log Level** (Info) + **Message Template** `Switch matched case → userId={{userId}}` (2000ms) → Save & close → spotlight the node (1200ms) |
| 5 | `wf3-run-condition` | Run and See the Branch Taken | `WF.CONSOLE_BADGE` | **Open the Console first** (spotlight badge 700ms → open → wait) so branch logs stream in live → spotlight **▶ Quick Test** (900ms) → run → HTTP node gets userId=1 → Condition `1 == 1` → **Yes** path taken → Yes-side Log executes (green), No-side Log stays gray (skipped) → in parallel the **Switch** matches `userId` `1` → **User #1** case → its Log executes (green) → spotlight Console filling (1400ms), Yes log (1400ms), skipped No log (1100ms), matched Switch log (1300ms) |

**Cleanup:** Delete seeded workflow.

---

## WF-4: Loops & Parallel Execution

**Goal:** Process collections with loops and run multiple API calls simultaneously with fork/join.

| Field | Value |
|---|---|
| `id` | `wf-loops-parallel` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflows` |
| `allowedTabs` | `['workflows']` |

**Prerequisite:** Seeded workflow: Start → HTTP (GET /posts, returns array of 100 posts).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf4-loop-node` | Add a Loop Node | `.wf-palette-block-loop` | Spotlight **Logic** category → spotlight **Loop** block (1000ms, explain: iterate over arrays or repeat N times) → click onto canvas → connect after HTTP → click **Fit View** → spotlight the Loop node showing **body** output handle and **done** output handle (1500ms, explain: body runs per iteration, done fires after all iterations) |
| 2 | `wf4-configure-loop` | Configure the Loop | `WF.NODE_CONFIG` | Double-click Loop → config modal → spotlight **Loop Type** selector (1000ms): Count, ForEach, While → select **ForEach** → spotlight **Source Array** field → type `{{posts}}` (the extracted response array) → spotlight **Item Variable** → set to `currentPost` (1000ms, explain: each iteration gets `currentPost`) → set **Max Iterations** to 5 (for demo speed) → Save |
| 3 | `wf4-loop-body` | Build the Loop Body | `WF.CANVAS` | Click an HTTP node onto canvas → connect Loop body → HTTP → click **Fit View** → double-click HTTP to configure GET `/posts/{{currentPost.id}}/comments` → Save & close → spotlight the loop body chain (1200ms, explain: this runs 5 times, once per post) → click a **Log/Debug** onto canvas → connect HTTP → Log/Debug → click **Fit View** → double-click to configure message `Post {{currentPost.id}} has comments` → Save & close |
| 4 | `wf4-fork-join` | Parallel Fork & Join | `.wf-palette-block-fork` | Explain: Fork splits into parallel branches → click **Fork** node onto canvas → connect after Loop done → click **Fit View** → click **3 HTTP nodes** onto canvas (get users/1, users/2, users/3) → connect Fork to all 3 → click **Fit View** → configure each HTTP node (double-click → URL → Save & close) → click **Join** node onto canvas → connect all 3 HTTP to Join → click **Fit View** → spotlight the parallel diamond shape (1800ms, explain: all 3 execute simultaneously, Join waits for all) |
| 5 | `wf4-run-parallel` | Run and Watch It All Execute | `WF.QUICK_TEST_BTN` | **Open the Console first** (spotlight badge → click → wait for panel → 1000ms) so logs stream in live → spotlight ▶ Quick Test → click → Loop runs (iterations visible in console) → Fork splits → parallel HTTP nodes run simultaneously → all turn green → Join completes → spotlight the Console filling with iteration logs + parallel timing (2000ms) → fit view → spotlight Loop + Fork nodes (1000ms each) |

**Cleanup:** Delete seeded workflow.

---

## WF-5: Error Handling & Recovery

**Goal:** Handle API failures gracefully — retry, catch, and recover without crashing the workflow.

| Field | Value |
|---|---|
| `id` | `wf-error-handling` |
| `estimatedMinutes` | 4 |
| Steps | 4 |
| `initialTab` | `workflows` |
| `allowedTabs` | `['workflows']` |

**Prerequisite:** Seeded workflow: Start → HTTP (GET /posts/9999 — will 404).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf5-error-handler` | Add an Error Handler Node | `WF.PAL_ERROR_HANDLER` | Spotlight **Flow** category in palette → spotlight **Error Handler** block (1000ms, explain: wraps nodes and provides retry + catch) → click onto canvas → connect Start → Error Handler → click **Fit View** → spotlight the node showing **body**, **catch**, and **done** handles (1500ms, explain: body is the "try" path, catch is the fallback, done runs after either path completes) |
| 2 | `wf5-retry-config` | Configure Retry & Catch | `WF.NODE_CONFIG` | Double-click Error Handler → config modal → spotlight **Error Filter** (all/http-error/assertion-failure/network-error) (1000ms) → spotlight **Retry Settings**: count=2, delay=500ms, backoff=fixed (1200ms, explain: retries the body N times before falling to catch) → spotlight **Continue workflow after catch** checkbox (checked — workflow stays green) (1000ms) → Save → connect the 404 HTTP node to **body** handle → click a Log/Debug onto canvas → connect to **catch** handle → click **Fit View** → double-click Log/Debug to configure "Endpoint not found, using fallback" (1000ms) → Save & close |
| 3 | `wf5-error-variables` | Error Variables in Catch | `WF.NODE_CONFIG` | Double-click the catch Log/Debug → spotlight the message field → show `{{error.message}}`, `{{error.statusCode}}`, `{{error.retryCount}}` (1500ms, explain: the catch path has access to what went wrong and how many retries were attempted) → update message to "Failed after {{error.retryCount}} retries: {{error.statusCode}}" → Save |
| 4 | `wf5-run-error` | Run and Watch Recovery | `WF.QUICK_TEST_BTN` | Click ▶ → HTTP node attempts (spinner) → fails (404) → retries (attempt 2 visible in console) → fails again → catch path fires → Log/Debug node executes with "Failed after 2 retries: 404" → spotlight the **red** HTTP node + **green** catch path (1500ms) → Console shows retry attempts + final catch message (1500ms) → workflow overall is green (caught, not crashed) |

**Cleanup:** Delete seeded workflow.

---

## WF-6: Quick Test & Debug Mode

**Goal:** Master the execution tools — run workflows, inspect results in the Console, step through node-by-node in Debug mode.

| Field | Value |
|---|---|
| `id` | `wf-debug-console` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflow` |
| `allowedTabs` | `['workflow']` |

**Prerequisite:** Seeded workflow: Start → HTTP POST (create post) → extract `id` → HTTP GET (get post by id) → Condition (check title) → Log "Verified!". A 5-node workflow for interesting debug exploration.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf6-quick-test` | Quick Test — Full Run | `WF.QUICK_TEST_BTN` | Open Console first (so logs stream live) → Spotlight ▶ Quick Test (1000ms) → click → all nodes run through → all green → spotlight **Exec Summary** strip (1500ms): total time, pass/fail → spotlight **node badges** showing individual timings (1000ms) |
| 2 | `wf6-console` | The Console Panel | `WF.CONSOLE` | Spotlight Console panel (already open from Step 1) → spotlight structured log entries (1500ms) → spotlight **search bar** → type "postId" → spotlight filtered match (1200ms) → clear search |
| 3 | `wf6-debug-mode` | Step-Through Debug | `WF.DEBUG_BTN` | Reset run state → click **Debug** → Debug Bar appears (1000ms) → spotlight **Resume / Step All / Stop** buttons (1500ms) → per-node Step: Start completes → pause on HTTP POST → Step → HTTP executes → spotlight Console response (1200ms) |
| 4 | `wf6-inspect-variable` | Inspect Variables Mid-Run | `WF.VAR_CONTEXT_BADGE` | While paused after HTTP nodes → spotlight **Variable Context Badge** (1200ms) → click → **Context modal** opens showing live `postId = 101` (1500ms) → close modal → Step to advance → Condition evaluates → Yes path |
| 5 | `wf6-reset-rerun` | Reset & Re-run | `WF.DEBUG_BAR` | Click **Resume** in Debug Bar → remaining nodes execute → spotlight green results (800ms) → click **Reset** → badges clear → spotlight clean canvas (1000ms) → spotlight **Run History** dropdown (1200ms) |

**Cleanup:** Delete seeded workflow. Close Console.

---

## WF-7: Versioning, Services & Catalog Integration

**Goal:** Track workflow changes over time with version snapshots, compare diffs, restore, configure multi-environment service URLs, and understand how workflow nodes relate to Catalog endpoints.

| Field | Value |
|---|---|
| `id` | `wf-version-services` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `workflow` |
| `allowedTabs` | `['workflow', 'catalog']` |

**Prerequisite:** Seeded workflow with 2 versions in history (v1: 3 nodes, v2: 5 nodes with added condition branch). One HTTP node has `catalogRef` pointing to a published Catalog endpoint (seeded via JSONPlaceholder API spec + DOM publish).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf7-versions-panel` | Browse Version History | `WF.VERSIONS_BTN` | Spotlight **Versions** button in toolbar → click → Version panel slides open on the right rail (1000ms) → spotlight the **version list** (2 entries: "Added condition branch" + "Initial workflow") with timestamps, node/edge counts, and change summaries (1500ms) → explain: every Save creates a snapshot if the graph changed |
| 2 | `wf7-compare` | Compare Two Versions | `WF.VERSION_PANEL` | Select both versions with checkboxes → click **Compare** → Version Diff modal opens → spotlight **Nodes tab** showing added Condition + Log nodes (1500ms) → spotlight **Edges tab** showing new connections (1000ms) → spotlight **Variables tab** showing added `userId` variable (1000ms) → close diff modal |
| 3 | `wf7-restore` | Restore a Previous Version | `WF.VERSION_PANEL` | Spotlight **Restore** button on v1 ("Initial workflow") → click → canvas updates (2 nodes disappear back to original 3-node layout) → spotlight the restored canvas (1500ms, explain: the old version is still in history, nothing deleted) → close Version panel |
| 4 | `wf7-services` | Service Registry | `WF.SERVICES_BTN` | Click **Services** in toolbar → Services panel opens → spotlight the panel (1200ms, explain: named services with per-environment URLs) → spotlight the environment matrix → close panel |
| 5 | `wf7-orphan-badge` | Catalog Endpoint Awareness | `WF.ORPHAN_BADGE` | Spotlight the HTTP node with **CAT** source badge (1000ms, explain: this node was created from a published Catalog endpoint) → navigate to **Catalog** → unpublish the endpoint (Palette Only) → return to **Workflow Designer** → Fit View → spotlight the same node now showing **⚠ orphan badge** (1500ms) → navigate to Catalog → re-publish → return to Workflow Designer → Fit View → spotlight badge disappearing (1000ms) |

**Cleanup:** Delete seeded workflow. Delete seeded catalog entry. Close panels.

---

## Feature Coverage Matrix

Every Workflow Designer feature mapped to its lesson:

| Feature | Lesson | Step |
|---|---|---|
| **Create new workflow** | WF-1 | Step 1 |
| **Canvas (React Flow)** | WF-1 | Steps 1-4 |
| **Palette — 5 categories** | WF-1 | Step 1 |
| **Drag node from palette** | WF-1 | Step 2 |
| **HTTP Request node** | WF-1 | Steps 2-3 |
| **Node config modal (Config/Input/Output/Logs)** | WF-1 | Step 3 |
| **Connect edges (output→input)** | WF-1 | Step 4 |
| **Fit View** | WF-1 | Step 4 |
| **Quick Test (▶)** | WF-1 | Step 5 |
| **Node status badges (pass/fail/timing)** | WF-1 | Step 5 |
| **Exec Summary overlay** | WF-1 | Step 5, WF-6 Step 1 |
| **Extraction (Output tab, JSONPath)** | WF-2 | Step 1 |
| **Variable expressions `{{var}}`** | WF-2 | Step 3 |
| **Expression autocomplete** | WF-2 | Step 3 |
| **Variables panel (workflow defaults)** | WF-2 | Step 4 |
| **Variable context badge + modal** | WF-2 | Step 4, WF-6 Step 4 |
| **Data chaining between nodes** | WF-2 | Step 5 |
| **HTTP extraction (userId) review** | WF-3 | Step 1 |
| **Condition node (if/else)** | WF-3 | Steps 2-3 |
| **Yes/No branch paths** | WF-3 | Step 4 |
| **Switch node (multi-way)** | WF-3 | Step 5 |
| **Expression evaluation (boolean)** | WF-3 | Step 3 |
| **Branch path visualization (taken vs skipped)** | WF-3 | Step 6 |
| **Loop node (forEach/count/while)** | WF-4 | Steps 1-2 |
| **Loop body/done handles** | WF-4 | Step 1 |
| **Item variable per iteration** | WF-4 | Step 2 |
| **Fork node (parallel split)** | WF-4 | Step 4 |
| **Join node (parallel merge)** | WF-4 | Step 4 |
| **Parallel execution visualization** | WF-4 | Step 5 |
| **Error Handler node** | WF-5 | Step 1 |
| **Retry configuration** | WF-5 | Step 2 |
| **Catch path** | WF-5 | Step 2 |
| **Error variables (error.message, error.statusCode, error.retryCount)** | WF-5 | Step 3 |
| **Graceful error recovery** | WF-5 | Step 4 |
| **Console panel (structured logs)** | WF-6 | Step 2 |
| **Console search** | WF-6 | Step 2 |
| **Debug mode (step-through)** | WF-6 | Step 3 |
| **Debug bar (Step/Resume/Stop)** | WF-6 | Step 3 |
| **Variable inspection mid-run** | WF-6 | Step 4 |
| **Reset run state** | WF-6 | Step 5 |
| **Run History** | WF-6 | Step 5 |
| **Version History panel** | WF-7 | Step 1 |
| **Version compare (Nodes/Edges/Variables diff)** | WF-7 | Step 2 |
| **Version restore** | WF-7 | Step 3 |
| **Service Registry** | WF-7 | Step 4 |
| **Multi-environment URLs** | WF-7 | Step 4 |
| **Catalog source badge (CAT)** | WF-7 | Step 5 |
| **Orphaned node warning badge (D3)** | WF-7 | Step 5 |
| **Catalog endpoint unpublish → badge appears** | WF-7 | Step 5 |
| **Log/Debug node** | WF-3, WF-5 | Multiple |
| **Set Variable node** | WF-2 | Step 4 (conceptual) |
| **Protocol nodes (gRPC, Kafka, WS, GQL) overview** | WF-8 | Steps 1-3 |
| **Multi-protocol orchestration** | WF-8 | Step 3 |

---

## Not Covered (Protocol-Specific — Handled by Other Lessons)

| Feature | Covered by |
|---|---|
| WebSocket nodes (connect/send/receive) | `ws-workflow-builder` |
| Kafka nodes (produce/consume/trigger/wait) | `kafka-workflow-produce`, `kafka-workflow-consume-wait` |
| GraphQL nodes (query/mutation/subscription/assert) | GQL-16 through GQL-19 |
| gRPC nodes (unary/stream/assert) | GRPC-11, GRPC-24 |
| Webhook Trigger | Future lesson (event-driven WF track) |
| Schedule Trigger | Future lesson |
| Correlation Wait | Future lesson |
| Sub-Workflow node | Future lesson |
| Script node | Future lesson |
| Aggregate node | WF-4 mentions; deep dive future |

> **Note:** WF-8 (Protocol Nodes Overview) provides a high-level tour of these protocol
> blocks in the palette and links to the dedicated deep-dive lessons. It does NOT replace them.

---

## WF-8: Protocol Nodes Overview

**Goal:** Show that the Workflow Designer palette contains protocol-specific blocks (gRPC, Kafka, WebSocket, GraphQL) and demonstrate how they differ from HTTP — then direct users to the dedicated protocol lessons for deep dives.

| Field | Value |
|---|---|
| `id` | `wf-protocol-nodes` |
| `estimatedMinutes` | 4 |
| Steps | 4 |
| `initialTab` | `workflow` |
| `allowedTabs` | `['workflow']` |

**Prerequisite:** Seeded workflow with Start → HTTP (GET /posts/1) already configured.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `wf8-palette-tour` | Protocol Blocks in the Palette | `WF.PALETTE` | Spotlight the palette → scroll to show 4 representative protocol blocks (1000ms each): **Kafka Produce** (Actions), **gRPC Unary** (Actions), **WS Connect** (Actions), **GraphQL Query** (Actions) → explain: these are full-featured nodes for each protocol, not wrappers — they have their own config forms, schema pickers, and connection settings. Protocol blocks are mixed into functional categories (Actions, Triggers, Logic) — not a separate "Protocol" group |
| 2 | `wf8-kafka-node` | Add a Kafka Produce Node | `WF.PAL_KAFKA_PRODUCE` | Click **Kafka Produce** from palette onto canvas → connect after HTTP → click **Fit View** → double-click to open config → spotlight config modal briefly (1200ms) → show: single scroll form with sections (Label, Cluster ID, Topic, Key Template, Headers, Body Template) inside Config/Input/Output/Logs tabs — contrast with HTTP's URL/Method/Headers → close without saving → explain: each protocol has specialized config that matches its semantics |
| 3 | `wf8-multi-protocol` | Multi-Protocol Orchestration | `WF.CANVAS` | Seed a multi-protocol workflow: for each node (HTTP → Kafka Produce → WS Connect → GraphQL Query): click node onto canvas → connect to previous → click **Fit View** → configure → Save & close. Spotlight each node (1000ms) to show how one workflow can orchestrate across protocols seamlessly |
| 4 | `wf8-deep-dive-links` | Where to Learn More | (concept diagram) | Narrate: "Each protocol has dedicated deep-dive lessons in the **Protocols** domain." Show a concept diagram linking to each protocol domain with representative lesson counts. No nav interaction needed — this is a purely informational step with a rich concept diagram |

**Cleanup:** Delete seeded workflow.

---

## Implementation Priority

| Order | Lesson | Reason |
|---|---|---|
| 1 | WF-1 | Foundation — can't teach anything else without this |
| 2 | WF-2 | Core value — data flow is what makes workflows powerful |
| 3 | WF-6 | Debug/Console — essential for understanding what happened |
| 4 | WF-3 | Logic — branching is the first "wow this is powerful" moment |
| 5 | WF-4 | Advanced — loops & parallel are the "production" patterns |
| 6 | WF-5 | Resilience — error handling for real-world use |
| 7 | WF-7 | Tooling — versioning and services for team workflows |

---

## Shared Helpers Needed

### New file: `packages/demo-hub/src/lessons/workflow/wf-core-demo-helpers.ts`

Existing `wf-demo-helpers.ts` is protocol-focused (config modal pacing). We need lesson-specific helpers:

| Helper | Purpose |
|---|---|
| `seedEmptyWorkflow(ctx, name)` | Create blank workflow, select it, ensure empty canvas |
| `seedHttpChainWorkflow(ctx, name)` | Seed: Start → HTTP POST → HTTP GET (with extraction) |
| `seedConditionWorkflow(ctx, name)` | Seed: Start → HTTP → Condition → 2 Log nodes |
| `seedLoopParallelWorkflow(ctx, name)` | Seed: Start → HTTP → Loop (body) + Fork/Join |
| `seedErrorWorkflow(ctx, name)` | Seed: Start → ErrorHandler → HTTP (404) → catch Log |
| `seedDebugWorkflow(ctx, name)` | Seed: 5-node chain for debug exploration |
| `seedVersionedWorkflow(ctx, name)` | Seed: workflow with 2 version snapshots |
| `addNodeFromPalette(ctx, type, position)` | Visible: drag block from palette to position |
| `connectNodes(ctx, sourceId, targetId, handle?)` | Visible: draw edge with animation |
| `openNodeConfig(ctx, nodeType)` | Double-click → modal opens |
| `runQuickTest(ctx)` | Click ▶, wait for completion, return results |
| `waitForNodeStatus(ctx, nodeType, status)` | Wait for a node's badge to show pass/fail |
| `cleanupWorkflow(ctx, name)` | Delete + close panels |

### Reuse from existing `wf-demo-helpers.ts`

- `WF_CONFIG_DEMO_TIMING` — pacing constants for config modals
- `openWfNodeConfigModal`, `fillWfConfigField`, `saveAndCloseWfConfigModal`
- `collapseWfDemoAppSidebar`, `expandWfDemoAppSidebar`
- `openWfConsoleIfClosed`, `closeWfConsoleIfOpen`

---

## New Selectors Needed (`src/shared/selectors/wf.ts`)

| Selector | Target |
|---|---|
| `PAL_HTTP` | `.wf-palette-block-http` |
| `PAL_CONDITION` | `.wf-palette-block-condition` |
| `PAL_SWITCH` | `.wf-palette-block-switch` |
| `PAL_LOOP` | `.wf-palette-block-loop` |
| `PAL_FORK` | `.wf-palette-block-fork` |
| `PAL_JOIN` | `.wf-palette-block-join` |
| `PAL_ERROR_HANDLER` | `.wf-palette-block-errorHandler` |
| `PAL_SET_VARIABLE` | `.wf-palette-block-setVariable` |
| `PAL_LOG_DEBUG` | `.wf-palette-block-logDebug` |
| `PAL_DELAY` | `.wf-palette-block-delay` |
| `PAL_AGGREGATE` | `.wf-palette-block-aggregate` |
| `NODE_HTTP` | `.react-flow__node-http` |
| `NODE_CONDITION` | `.react-flow__node-condition` |
| `NODE_LOOP` | `.react-flow__node-loop` |
| `NODE_FORK` | `.react-flow__node-fork` |
| `NODE_JOIN` | `.react-flow__node-join` |
| `NODE_ERROR_HANDLER` | `.react-flow__node-errorHandler` |
| `NODE_LOG_DEBUG` | `.react-flow__node-logDebug` |
| `NODE_SET_VARIABLE` | `.react-flow__node-setVariable` |
| `CFG_URL_INPUT` | HTTP config URL field |
| `CFG_METHOD_SELECT` | HTTP config method selector |
| `CFG_EXPRESSION_INPUT` | Condition/Switch expression field |
| `CFG_LOOP_TYPE` | Loop type selector (Count/ForEach/While) |
| `CFG_LOOP_SOURCE` | Loop source array field |
| `CFG_RETRY_COUNT` | Error Handler retry count input |
| `VERSIONS_BTN` | Toolbar versions button |
| `VERSIONS_PANEL` | Right-rail version panel |
| `VERSION_COMPARE_BTN` | Compare button in version panel |
| `VERSION_RESTORE_BTN` | Restore button per version |
| `VERSION_DIFF_MODAL` | Version diff modal |
| `SERVICE_REGISTRY` | Service Registry modal |
| `DEBUG_BAR` | Debug mode control bar |
| `DEBUG_RESUME_BTN` | Resume All button in debug bar |
| `VAR_CONTEXT_BAR` | Variable context badge on canvas |
| `RUN_HISTORY_DROPDOWN` | Status bar run history |
| `ORPHAN_BADGE` | `[data-testid="wf-orphan-badge"]` — orphan warning on HTTP node |
| `SOURCE_BADGE_CAT` | `.wf-source-badge` containing "CAT" text |

---

## Domain Registration

Update `packages/demo-hub/src/lessons/index.ts`:

```typescript
export const workflowDomain: DemoDomain = {
  id: 'workflow',
  name: 'Workflows',
  icon: '⚡',
  description: 'Build automated multi-step test sequences with visual flow logic.',
  available: true,  // ← enable
  categories: [
    { id: 'fundamentals', label: 'Fundamentals', icon: '📐' },
    { id: 'logic',        label: 'Logic & Flow', icon: '🔀' },
    { id: 'tooling',      label: 'Tools & Debug', icon: '🔧' },
  ],
  lessons: workflowLessons,
};
```

Category mapping:
- **Fundamentals:** WF-1, WF-2
- **Logic & Flow:** WF-3, WF-4
- **Tools & Debug:** WF-5, WF-6, WF-7, WF-8

---

## Timing & Pacing Guidelines

Since workflows involve canvas interactions (drag, connect, double-click), delays need to be extra generous:

| Action | Minimum delay |
|---|---|
| Drag node from palette to canvas | 1500ms (animate travel) |
| Edge connection animation | 1200ms |
| Config modal opens | 1000ms settle + 800ms before interaction |
| Fill a config field | 600ms after, spotlight 1000ms |
| Quick Test execution | Let it finish naturally + 1500ms on result |
| Debug step | 1200ms per step (viewer tracks the cursor) |
| Panel open/close | 800ms transition + 600ms settle |
| Canvas layout change (restore, add nodes) | 1500ms for viewer to re-orient |

**Total per step:** A 5-beat step should last 15–25 seconds at 1× speed.

---

## Future Expansion (Phase 2)

After the core 8 lessons are complete, consider:

| Lesson | Focus |
|---|---|
| WF-9 | Event-Driven: Webhook Trigger + Schedule + polling |
| WF-10 | Async Correlation: CorrelationWait + simulators |
| WF-11 | Sub-Workflows: parent/child composition + shared variables |
| WF-12 | Script Node: JS sandbox, data transformation, cross-API validation |
| WF-13 | Workflow Runner: iterations, concurrency, SLA, Results Explorer |
| WF-14 | Command Palette & Shortcuts: power-user efficiency |
