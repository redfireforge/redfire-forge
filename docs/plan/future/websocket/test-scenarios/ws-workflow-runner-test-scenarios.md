# WebSocket Workflow & Runner Test Scenarios

> **File:** `ws-workflow-runner-test-scenarios.md`
> **Covers:** Phases 4 & 5 — Workflow Integration (WS Connect / WS Send / WS Receive / WS Trigger nodes, output bindings, match criteria, variable extraction) and Runner & Assertions (harness transport selector, WS scenario editors, `wsField` / `wsNumericField` assertions, assertion presets, transport-aware results)
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server (`jmalloc/echo-server` on port 8765)

---

## Before You Start

### Docker Setup

```bash
# Start the echo server (echoes back whatever it receives)
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
# Verify: docker ps --filter name=ws-echo
```

### Dev Server

```bash
# Start the frontend
npm run dev
# → http://localhost:5173

# Start the backend (required — the WS harness/workflow proxy uses /api/ws/* on :3001)
npm run server
```

> **Note:** WS harness tests and WS workflow nodes execute through the backend WebSocket proxy (`/api/ws/connect`, `/api/ws/send`, …). The frontend Test Runner runs scenarios in a Web Worker; the worker now routes relative `/api/*` paths via native `fetch` (Vite forwards `/api` → `:3001`). **The backend (`npm run server`) must be running**, otherwise WS connect operations report a network error.

### Environment & Microservice Setup (one-time)

WS harness tests need an environment + microservice. If you already have one, skip to Navigation.

1. Click **Settings** in the left activity bar
2. Open the **Environments** tab → **+ Add Environment** → name it `t01`
3. Under `t01`, **+ Add Microservice** → name it `ws-demo-service`
4. (Optional) set a base URL — WS scenarios use the explicit `ws://` URL in each node, so a base URL is **not** required for WS connect.
5. Back in the app header, select **Environment = `t01`** and **Service = `ws-demo-service`** in the top selectors.

### Navigation

- **Workflow Designer:** Click **Workflow** in the left activity bar → **Designer**.
- **Harness:** Click **Harness** in the left activity bar → tabs **Feature Groups | Test Runner | Parameterized Runner | Workflow Runner | Results**.

---

# Part A — Workflow Integration (Phase 4)

## Workflow Designer — WS Nodes

### WR-01: Create a blank workflow

**Goal:** Reach the Workflow Designer and create an empty workflow canvas.

**Steps:**
1. Click **Workflow** in the left activity bar
2. Click **Designer** in the sub-navigation
3. Click **+ New** → **Blank Workflow**
4. Enter a name (e.g. `WS Workflow Validation`) → **Create**

**Expected Results:**
- [ ] An empty canvas opens with a **Start** node
- [ ] The node palette is visible on the left with groups: **Triggers**, **Actions**, **Logic**, **Data**, **Flow**
- [ ] The toolbar shows: **Quick Test**, **Debug**, **Run in Harness**, **Save**, **Services**, **Variables**, **Versions**, and an environment dropdown

---

### WR-02: WS nodes appear in the palette

**Goal:** Verify the WebSocket node types are available in the palette.

**Steps:**
1. In the Designer, expand the **Triggers** group
2. Expand the **Actions** group

**Expected Results:**
- [ ] **Triggers** group contains **WS Trigger**
- [ ] **Actions** group contains **WS Connect**, **WS Send**, and **WS Receive**
- [ ] Each WS block shows an icon and a short description on hover

---

### WR-03: Add a WS Connect node to the canvas

**Goal:** Place a WS Connect node and verify its default rendering.

**Steps:**
1. From **Actions**, click **WS Connect**
2. Observe the node added to the canvas

**Expected Results:**
- [ ] A new node appears on the canvas labelled **WS Connect**
- [ ] The node body shows `URL:` (empty) and `ID: ws1` (default connection id)
- [ ] The node has a **Configure** button (or double-click opens the config dialog)

---

### WR-04: Configure the WS Connect node

**Goal:** Verify all WS Connect config fields and defaults.

**Steps:**
1. Open the WS Connect node config (double-click or **Configure**)
2. Review the **Config** tab fields

**Expected Results:**
- [ ] Dialog title reads **`WSCONNECT — WS Connect`**; tabs **Config | Input | Output | Logs**; footer **Close / Save**
- [ ] **Label** field (free text)
- [ ] **URL** field with an **Insert…** button and a `{{variable}}` hint below it
- [ ] **Connection ID** field defaulting to `ws1`
- [ ] **Subprotocols** field (comma-separated) with a placeholder
- [ ] **Timeout** field defaulting to `10000` (ms)
- [ ] **Headers** section with **+ Add Header**
- [ ] **Query Parameters** section with **+ Add Parameter**
- [ ] **Output Bindings** section with **+ Add Binding**
- [ ] Enter URL `ws://localhost:8765`, click **Save** — the node shows `URL: ws://localhost:8765`

---

### WR-05: WS Connect output bindings

**Goal:** Verify WS Connect exposes connect metadata as bindable outputs.

**Steps:**
1. In the WS Connect config, open the **Output Bindings** section
2. Click **+ Add Binding** and inspect the available output fields

**Expected Results:**
- [ ] Output fields include **protocol**, **extensions**, and **latencyMs**
- [ ] Each binding lets you map an output field to a workflow variable name
- [ ] Saved bindings persist on the node after **Save**

---

### WR-06: Configure a WS Send node

**Goal:** Verify WS Send config fields and the wait-for-response toggle.

**Steps:**
1. Add an **Actions → WS Send** node
2. Open its config

**Expected Results:**
- [ ] **Label** field
- [ ] **Connection ID** selector (dropdown of available connection ids from upstream WS Connect nodes, plus a `(custom)` option)
- [ ] **Message Type** selector: **text** / **binary**
- [ ] **Message** textarea (supports `{{variable}}` insertion)
- [ ] **Wait for Response** checkbox (unchecked by default)
- [ ] When **Wait for Response** is checked, a **Response Timeout** field appears defaulting to `5000` (ms)

---

### WR-07: WS Send output bindings (response-dependent)

**Goal:** Verify response output bindings appear only when waiting for a response.

**Steps:**
1. In the WS Send config, leave **Wait for Response** unchecked → check the Output Bindings
2. Check **Wait for Response** → re-check the Output Bindings

**Expected Results:**
- [ ] With **Wait for Response** OFF, no response output bindings are offered
- [ ] With **Wait for Response** ON, output fields **responseBody**, **responseType**, and **latencyMs** become available
- [ ] Bindings persist after **Save**

---

### WR-08: Configure a WS Receive node

**Goal:** Verify WS Receive config including match criteria and extraction rules.

**Steps:**
1. Add an **Actions → WS Receive** node
2. Open its config

**Expected Results:**
- [ ] **Label** field
- [ ] **Connection ID** selector
- [ ] **Timeout** field defaulting to `30000` (ms)
- [ ] **Match Criteria** section with: **Message Type**, **Content Contains**, **Content Regex**, **JSONPath Match** (and an **Expected Value** field that appears once a JSONPath is entered)
- [ ] **Extraction Rules** section to capture values into variables
- [ ] **Output Bindings** include **messageBody**, **messageType**, **matchedAt**, **latencyMs**

---

### WR-09: Configure a WS Trigger node

**Goal:** Verify the WS Trigger (workflow entry point) config and Quick Test payload.

**Steps:**
1. Add a **Triggers → WS Trigger** node
2. Open its config

**Expected Results:**
- [ ] **Label** field
- [ ] **URL** field and **Connection ID** field
- [ ] **Match Criteria** section (same fields as WS Receive)
- [ ] **Extract Variables** section with **+ Add Variable**
- [ ] **Test Payload (Quick Test)** section with a **Sample Payload** textarea used to simulate an inbound message during Quick Test

---

### WR-10: Variable insertion into WS fields

**Goal:** Verify `{{variable}}` insertion works in WS node text fields.

**Steps:**
1. In a WS Connect node, click **Insert…** next to the **URL** field
2. In a WS Send node, use variable insertion in the **Message** textarea

**Expected Results:**
- [ ] An available-variables picker opens listing workflow/global variables
- [ ] Selecting a variable inserts `{{variableName}}` at the cursor
- [ ] The field hint shows that `{{variable}}` syntax is supported

---

### WR-11: Wire a WS connect → send → receive flow

**Goal:** Build a runnable WS workflow by wiring the nodes from Start.

**Steps:**
1. Drag a connection from **Start** → **WS Connect**
2. Wire **WS Connect** → **WS Send** → **WS Receive**
3. Ensure WS Send and WS Receive reference the same **Connection ID** as WS Connect (`ws1`)

**Expected Results:**
- [ ] Edges connect Start → WS Connect → WS Send → WS Receive
- [ ] No validation warning about an unreferenced connection id
- [ ] The canvas reflects the linear flow

---

### WR-12: Quick Test the WS workflow

**Goal:** Execute the wired workflow with Quick Test.

**Steps:**
1. Configure WS Connect URL = `ws://localhost:8765`, WS Send message = `hello`, WS Receive content-contains = `hello`
2. Click **Quick Test** in the toolbar

**Expected Results:**
- [ ] A banner shows **All Steps Passed**
- [ ] A summary shows **N/M passed · 0.Xs**
- [ ] **Clear** and **Run History** controls are available
- [ ] The echo server returns `hello`, so the WS Receive match succeeds

> **Note:** A WS node only executes when it is wired (reachable from **Start**). An unwired node is skipped during Quick Test.

---

### WR-13: Inspect node Output & Logs after Quick Test

**Goal:** Verify per-node Output and Logs tabs capture WS execution detail.

**Steps:**
1. After a Quick Test run, open the WS Connect node config → **Output** tab
2. Open the **Logs** tab
3. Repeat for WS Receive

**Expected Results:**
- [ ] WS Connect **Output** shows `connectionId`, `protocol`, `extensions`, `latencyMs`
- [ ] WS Receive **Output** shows the matched `messageBody`, `messageType`, `matchedAt`
- [ ] **Logs** tab shows the dispatched operation and timing for that node

---

### WR-14: Run the workflow in the Harness

**Goal:** Promote the workflow to a harness execution via Run in Harness.

**Steps:**
1. Click **Run in Harness** in the Designer toolbar
2. Confirm the target (environment `t01` / service `ws-demo-service`)
3. Switch to **Harness → Workflow Runner**

**Expected Results:**
- [ ] The workflow appears in the **Workflow Runner** list
- [ ] Running it produces a workflow run visible under **Results → ⚡ Workflow Runs**
- [ ] Node-level WS results carry transport metadata

---

# Part B — Runner & Assertions (Phase 5)

## Harness Setup & Transport Selection

### WR-15: Create a feature group, scenario, and WS test

**Goal:** Set up the harness hierarchy needed to author a WS test.

**Steps:**
1. Go to **Harness → Feature Groups** (with env `t01` / service `ws-demo-service` selected)
2. Click **+ Add Feature Group** → name it (e.g. `WS Chat Flow`)
3. In the group, click **+ Scenario** → name it (e.g. `Happy Path`)
4. In the scenario, click **+ Test** (or **+ Add Test**) to open the Test Editor

**Expected Results:**
- [ ] The feature group, scenario, and test appear nested in the tree
- [ ] The Test Editor modal opens for the new test

---

### WR-16: Transport selector shows WebSocket options

**Goal:** Verify the Test Editor transport selector groups WS actions.

**Steps:**
1. In the Test Editor, open the **Transport** selector

**Expected Results:**
- [ ] The selector has optgroups **HTTP**, **WebSocket**, and **Kafka**
- [ ] WebSocket options: **WS Connect** (`wsConnect`), **WS Send** (`wsSend`), **WS Receive** (`wsReceive`)
- [ ] Kafka options: **Kafka Produce**, **Kafka Consume**
- [ ] HTTP option: **HTTP**

---

### WR-17: Selecting a WS transport reshapes the editor

**Goal:** Verify switching to a WS transport adjusts method and tabs.

**Steps:**
1. In the Test Editor, set **Transport = WS Connect**
2. Observe the editor tabs and method

**Expected Results:**
- [ ] The HTTP **method** is set to **WEBSOCKET**
- [ ] The editor switches to the **validation** tab
- [ ] HTTP-only tabs (**Params**, **Body**, **Auth**, **Headers**) are hidden
- [ ] Any previously-entered HTTP action config is cleared

---

## WS Scenario Editors

### WR-18: WS Connect scenario editor fields

**Goal:** Verify the wsConnect editor fields and defaults.

**Steps:**
1. With **Transport = WS Connect**, review the editor body

**Expected Results:**
- [ ] **WebSocket URL** field (enter `ws://localhost:8765`)
- [ ] **Connection ID** field
- [ ] **Subprotocols** field (comma-separated)
- [ ] **Timeout** field defaulting to `10000` (ms)
- [ ] **Headers** and **Query Params** key/value sections

---

### WR-19: WS Send scenario editor fields

**Goal:** Verify the wsSend editor fields, including connection reference fallback.

**Steps:**
1. Set **Transport = WS Send**
2. Review the editor body

**Expected Results:**
- [ ] **Connection Ref** dropdown (`— select a connection —`); when the scenario has no `wsConnect` test it shows the hint *"No wsConnect tests found in this scenario. Add one first or enter a connection ID manually."*
- [ ] **Connection Ref (manual)** text field as a fallback (placeholder *"Connection ID from a wsConnect test"*)
- [ ] **Message** field with hint *"Supports `{{variable}}` interpolation from data sources"*
- [ ] **Format** selector: **Text** / **Binary**
- [ ] **Wait for response** checkbox; when checked, a **Response Timeout** field appears defaulting to `5000` (ms)

---

### WR-20: WS Receive scenario editor & match criteria

**Goal:** Verify the wsReceive editor match-criteria fieldset.

**Steps:**
1. Set **Transport = WS Receive**
2. Review the editor body and the **Match Criteria** fieldset

**Expected Results:**
- [ ] **Connection Ref** dropdown + **Connection Ref (manual)** fallback (same as WS Send)
- [ ] **Timeout** field defaulting to `10000` (ms)
- [ ] **Match Criteria (optional)** fieldset with: **Content Contains**, **Content Regex**, **JSON Path** + **Value**, and **Frame Type** (`Any` / `Text` / `Binary`)

---

## Assertions

### WR-21: Add a WS string-field assertion (`wsField`)

**Goal:** Verify the assertion editor exposes WS string targets and operators.

**Steps:**
1. In the WS test's **Validation** tab, the existing/added assertion row is labelled **WS**
2. Open the **WS target** dropdown

**Expected Results:**
- [ ] WS target options (exact labels): **ws.body**, **ws.type**, **ws.protocol**, **ws.connectionId**, **ws.header.name**, **ws.$.path (JSON)**
- [ ] Choosing **ws.header.name** reveals a secondary **header-name** input
- [ ] Choosing **ws.$.path (JSON)** reveals a secondary **JSONPath** input (placeholder `data.status`)
- [ ] Operator dropdown: **equals**, **contains**, **regex**, **exists**
- [ ] A **NOT** toggle is available to negate the operator
- [ ] An **Expected value** input is shown (hidden when operator is `exists`)

---

### WR-22: Add a WS numeric-field assertion (`wsNumericField`)

**Goal:** Verify the numeric WS assertion path.

**Steps:**
1. Click **+ Add** in the Assertions section → open the **WebSocket** category
2. Click **WS Latency** (or **WS Message Size**) to add a numeric assertion row

**Expected Results:**
- [ ] A `wsNumericField` row is added with a **WS numeric target** dropdown offering **ws.latencyMs** and **ws.size**
- [ ] A numeric comparison selector is shown (`=`, `≠`, `<`, `≤`, `>`, `≥`)
- [ ] A numeric value input is shown (e.g. WS Latency defaults to `< 1000`)

---

### WR-23: "+ Add" assertion menu — WebSocket category

**Goal:** Verify the categorized **+ Add** menu exposes WS quick-add assertions.

**Steps:**
1. In the Validation tab, click **+ Add** (the button next to **📋 Presets**)
2. Scroll to the **WebSocket** category

**Expected Results:**
- [ ] The **+ Add** menu is grouped into categories: **Response**, **Field Validation**, **Array & Structure**, **Schema & Advanced**, **WebSocket**
- [ ] The **WebSocket** category contains: **WS Body**, **WS Frame Type**, **WS Protocol**, **WS JSON Path**, **WS Header**, **WS Latency**, **WS Message Size**
- [ ] WS Body/Frame Type/Protocol/JSON Path/Header add a `wsField` row; WS Latency / WS Message Size add a `wsNumericField` row

> **Note:** The separate **📋 Presets** menu is a gallery of ready-made multi-assertion *sets* and only has the categories **API Validation**, **Data Quality**, and **Security** (all HTTP-oriented) — it does **not** contain WebSocket presets. WS assertions are added from the **+ Add** menu instead.

---

## Running & Results

### WR-24: Run a WS Connect test in the Test Runner

**Goal:** Execute a WS scenario and verify a passing result.

**Steps:**
1. Build a scenario with a single **WS Connect** test (URL `ws://localhost:8765`, name e.g. `Connect to echo`)
2. Go to **Harness → Test Runner**, select the scenario, click **▶ Run Test**

**Expected Results:**
- [ ] Progress reaches **1 / 1 (100%)**
- [ ] **Error Rate = 0%**, **Validation Failures = 0**
- [ ] A "Test completed" banner appears with **View Full Results →**

> **Note:** Requires `npm run server` (backend) and the `ws-echo` Docker container running. The Test Runner executes in a Web Worker that proxies WS operations through `/api/ws/*`.

---

### WR-25: Transport-aware result row in Request Details

**Goal:** Verify the results table renders WS-aware status.

**Steps:**
1. From the run, click **View Full Results →** → **Request Details** tab

**Expected Results:**
- [ ] The result row shows **URL = `ws://localhost:8765`**
- [ ] **Status** column shows **`CONNECT`** (not an HTTP status code)
- [ ] **Validation** shows **`none`** (no assertions) or the assertion outcome
- [ ] **Passed** shows **✓**

---

### WR-26: Test Runs vs Workflow Runs tabs in Results

**Goal:** Verify run-type segmentation in the Results page.

**Steps:**
1. Go to **Harness → Results**
2. Observe the run-type filter tabs

**Expected Results:**
- [ ] Tabs: **All Runs (N)**, **🧪 Test Runs (N)**, **⚡ Workflow Runs (N)**
- [ ] A WS harness test run appears under **🧪 Test Runs**
- [ ] A WS workflow run (from WR-14) appears under **⚡ Workflow Runs**

---

### WR-27: WS variable extraction via Data Mapper

**Goal:** Verify WS received-message fields can be extracted into variables.

**Steps:**
1. In a WS Receive node/scenario with extraction rules, open the extraction/Data Mapper UI
2. Map a field from the received message to a variable

**Expected Results:**
- [ ] The WS extraction adapter exposes the received message body as a JSON tree (when the payload is JSON)
- [ ] A mapped variable is captured and available to downstream steps
- [ ] String, JSONPath, and regex extraction modes are offered

---

### WR-28: Export / import a WS test run

**Goal:** Verify WS run metadata survives export/import round-trip.

**Steps:**
1. From **Results**, with a WS run selected, click **Export JSON**
2. Use **📥 Import Test Results** to re-import the exported file

**Expected Results:**
- [ ] The exported JSON includes the WS transport metadata (status `CONNECT`, `ws://` URL, latency)
- [ ] After import, the run reappears with the same transport-aware Status, timings, and pass/fail state
- [ ] No fields are lost or mis-rendered after the round-trip
