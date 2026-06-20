# GraphQL Workflow Nodes — Manual Test Scenarios (4F-8)

**Target**: Phase 4 — GraphQL workflow node types (`graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert`)  
**Runner**: RedfireForge dev server (`npm run dev`) + Docker GraphQL test server (port 4010)  
**Prerequisites**:

```bash
# Start the app
npm run dev

# Start the GraphQL test server (optional — only for live-execution tests)
cd docker/graphql
docker compose up -d
# Verify: http://localhost:4010/graphql should return schema
```

**Before You Start**: Open the app → navigate to **Workflow** (sidebar icon) → create a new blank workflow (+New → Blank Workflow).

---

## Section A — Node Registration & Canvas

### A-1: All 5 GraphQL node types appear in the palette

**Goal**: Confirm all 5 node types are registered and discoverable.

**Steps**:
1. Navigate to Workflow tab.
2. In the left palette, click the **Blocks** tab (if not already active).
3. Scroll to the "Integration" section.

**Expected Results**:
- [ ] `GraphQL Query` block is visible in the palette.
- [ ] `GraphQL Mutation` block is visible in the palette.
- [ ] `GraphQL Subscription` block is visible in the palette.
- [ ] `GraphQL Introspect` block is visible in the palette.
- [ ] `GraphQL Assert` block is visible in the palette.
- [ ] Each block shows a distinct icon (GraphQL diamond logo for query/mutation/subscription, a wrench-like icon for introspect, a checkmark for assert).

---

### A-2: Drag-and-drop node from palette to canvas

**Goal**: Dragging each node type onto the canvas creates a functional node.

**Steps** (repeat for each node type):
1. In the palette, locate the node (e.g., "GraphQL Query").
2. Drag it onto the canvas.
3. Observe the resulting canvas node card.

**Expected Results** (per node type):
- [ ] Node card appears on canvas with the correct label (e.g., "GraphQL Query").
- [ ] Node card shows the subcategory tag (e.g., "Integration").
- [ ] "Endpoint: No endpoint" is shown on the card (no default endpoint).
- [ ] A **Configure** button (⚙) is visible on the node card footer.
- [ ] Input and output handles are present (except Start/End nodes).

---

### A-3: Canvas card shows configured data

**Goal**: After configuration, the canvas card reflects the saved data.

**Steps**:
1. Drag a **GraphQL Query** node onto the canvas.
2. Click its **Configure** button.
3. In the modal, fill the endpoint field with `https://api.example.com/graphql`.
4. Click **Save**.
5. Observe the canvas card.

**Expected Results**:
- [ ] Canvas card shows "Endpoint: api.example.com" (host only, truncated).
- [ ] Node label still reads "GraphQL Query" (or the label you set).
- [ ] No error state on the card.

---

## Section B — Query Node Configuration

### B-1: Query config panel opens and shows correct tabs

**Goal**: The query config modal has 6 tabs with correct content.

**Steps**:
1. Add a **GraphQL Query** node to the canvas.
2. Double-click it or click its **Configure** button.
3. Inspect the modal.

**Expected Results**:
- [ ] Modal title contains "graphqlQuery" or "GraphQL Query".
- [ ] **Operation** tab is active by default and shows a code editor with `query { }` template.
- [ ] **Variables** tab shows a JSON editor.
- [ ] **Headers** tab shows "+ Add" button.
- [ ] **Auth** tab shows auth type selector.
- [ ] **Extraction** tab shows "+ Add" button.
- [ ] **Output** tab shows "+ Add" button.
- [ ] **Import from Collections** button is visible.
- [ ] **Save** and **Close** buttons are in the footer.

---

### B-2: Filling and saving a query

**Steps**:
1. Open the Query node config modal.
2. Fill the endpoint field with `https://api.example.com/graphql`.
3. In the Operation tab, type:
   ```graphql
   query GetUser($id: ID!) {
     user(id: $id) {
       id
       name
       email
     }
   }
   ```
4. Switch to Variables tab, fill:
   ```json
   { "id": "1" }
   ```
5. Click **Save**.

**Expected Results**:
- [ ] Modal closes after Save.
- [ ] Canvas card updates to show `api.example.com` in endpoint.
- [ ] Re-opening the config modal shows the saved query and variables.

---

### B-3: Adding extraction rules

**Steps**:
1. Open the Query node config modal.
2. Click the **Extraction** tab.
3. Click **+ Add**.
4. Fill the JSONPath field with `$.data.user.id`.
5. Fill the variable name with `userId`.
6. Click **Save**.

**Expected Results**:
- [ ] New extraction row appears with JSONPath and variable name fields.
- [ ] Canvas card shows "1 extraction" after saving.
- [ ] Re-opening shows the extraction rule persisted.

---

### B-4: Output bindings

**Steps**:
1. Open the Query node config modal.
2. Click the **Output** tab.
3. Click **+ Add**.
4. Select `data` from the field dropdown.
5. Fill variable name `queryResult`.
6. Click **Save**.

**Expected Results**:
- [ ] Output binding row is shown with field select and variable name.
- [ ] Downstream nodes (e.g., Assert) can reference `{{queryResult}}` in the variable picker.

---

### B-5: Auth configuration

**Steps**:
1. Open the Query node config modal.
2. Click the **Auth** tab.
3. Change auth type to **Bearer Token**.
4. Fill the token field.
5. Click **Save**.

**Expected Results**:
- [ ] Bearer token input appears after selecting "Bearer Token".
- [ ] Saved auth is shown on re-opening.
- [ ] When executed, `Authorization: Bearer <token>` header is included in the request.

---

## Section C — Mutation Node Configuration

### C-1: Mutation panel uses mutation template

**Steps**:
1. Add a **GraphQL Mutation** node to the canvas.
2. Click Configure.

**Expected Results**:
- [ ] Modal shows "mutation" panel (not query panel).
- [ ] Default operation template starts with `mutation { }` or similar.
- [ ] Canvas card shows "M" badge distinguishing it from query nodes.

---

### C-2: Mutation execution (requires Docker server)

**Steps**:
1. Configure mutation node with endpoint `http://localhost:4010/graphql`.
2. Set mutation:
   ```graphql
   mutation CreateUser($name: String!) {
     createUser(name: $name) { id name }
   }
   ```
3. Set variables: `{ "name": "Test User" }`
4. Run the workflow (Quick Test button or full Run).

**Expected Results**:
- [ ] Node executes without error.
- [ ] Workflow output shows `id` and `name` in the result.
- [ ] Latency is shown in the execution results.

---

## Section D — Subscription Node Configuration

### D-1: Subscription panel tabs

**Steps**:
1. Add a **GraphQL Subscription** node.
2. Click Configure.

**Expected Results**:
- [ ] Panel has 5 tabs: **Subscription**, **Stop**, **Headers & Auth**, **Extraction**, **Output**.
- [ ] Subscription tab has a query editor showing `subscription { }` template.
- [ ] Transport selector shows `graphql-ws` as default.
- [ ] Stop tab has "Stop after N messages" (default 10) and "Stop after N seconds" inputs.
- [ ] Stop tab has a JSONPath stop condition input.

---

### D-2: Stop condition inputs

**Steps**:
1. Open Subscription config → Stop tab.
2. Change "Stop after N messages" to `5`.
3. Click Save.
4. Reopen the config modal.

**Expected Results**:
- [ ] "5" is shown in the stop-messages field after reopening.
- [ ] Canvas card shows "Stop after 5 msgs" in the card summary.

---

## Section E — Introspect Node Configuration

### E-1: Introspect panel tabs

**Steps**:
1. Add a **GraphQL Introspect** node.
2. Click Configure.

**Expected Results**:
- [ ] Panel has 3 tabs: **Endpoint**, **Schema Validation**, **Output**.
- [ ] Endpoint tab shows endpoint URL field, timeout (default 30000), skip-TLS checkbox.
- [ ] Schema Validation tab has min type count, required types, and required fields inputs.
- [ ] Output tab shows output bindings (sdl, typeCount, fieldCount, schemaHash, queryTypeName).

---

### E-2: Schema validation — required types

**Steps**:
1. Open Introspect config → Schema Validation tab.
2. Fill "Required types" with `User, Order, Product`.
3. Fill "Min type count" with `15`.
4. Click Save and reopen.

**Expected Results**:
- [ ] Required types field shows `User, Order, Product` after reopening.
- [ ] Min type count shows `15`.
- [ ] Canvas card shows "Schema validation enabled" indicator.

---

### E-3: Required fields chip input

**Steps**:
1. Open Introspect config → Schema Validation tab.
2. Click **+ Add field**.
3. Fill type name `User` and field name `id`.
4. Click Add.
5. Save and reopen.

**Expected Results**:
- [ ] A chip/row appears with "User.id".
- [ ] The chip persists after saving.

---

## Section F — Assert Node Configuration

### F-1: Assert panel structure

**Steps**:
1. Add a **GraphQL Assert** node.
2. Click Configure.

**Expected Results**:
- [ ] Panel has 3 tabs: **Source**, **Assertions**, **Behavior**.
- [ ] Source tab has a variable selector for the upstream data source.
- [ ] Assertions tab has "+ Add assertion" button.
- [ ] Behavior tab has two radio options: **Halt workflow on failure** and **Continue with warning**.

---

### F-2: Adding and configuring assertions

**Steps**:
1. Open Assert config → Assertions tab.
2. Click **+ Add assertion**.
3. Fill JSONPath: `$.data.user.id`.
4. Select operator: `exists`.
5. Leave expected value blank (not needed for `exists`).
6. Fill description: `User ID must be present`.
7. Click Save.

**Expected Results**:
- [ ] Assertion row shows JSONPath, operator, and description.
- [ ] Expected value input is hidden for the `exists` operator.
- [ ] After saving, canvas card shows "1 assertion".

---

### F-3: Fail behavior

**Steps**:
1. Open Assert config → Behavior tab.
2. Switch radio to "Continue with warning".
3. Click Save.

**Expected Results**:
- [ ] "Continue with warning" radio is checked after saving.
- [ ] When assertions fail in a workflow run, execution continues and a warning badge appears on the node.

---

### F-4: Assertions with comparison operators

**Steps**:
1. Add an assertion with JSONPath `$.latencyMs`, operator `less_than`, value `500`.
2. Click Save.
3. Run the workflow.

**Expected Results** (with Docker server):
- [ ] If latency < 500ms, assertion passes (green badge).
- [ ] If latency ≥ 500ms, assertion fails (red badge, fail behavior applied).

---

## Section G — End-to-End Workflow (requires Docker server)

### G-1: Health-check workflow — gallery template

**Goal**: The graphql-health-check gallery template runs end-to-end.

**Steps**:
1. Open Gallery (+New → From Template) → Workflows domain.
2. Find **GraphQL Health Check** template.
3. Click **Use as Template** → save to default folder.
4. Workflow loads with 4 nodes: Introspect → Query → Assert → End.
5. Open each node config and set endpoint to `http://localhost:4010/graphql`.
6. Click **Run** (Quick Test).

**Expected Results**:
- [ ] All nodes execute without error.
- [ ] Introspect node result shows `typeCount ≥ 1`.
- [ ] Query node returns data.
- [ ] Assert node passes (latency < 500ms).
- [ ] Final run status: **Passed**.

---

### G-2: Variable binding chain (Query → Assert)

**Goal**: Output binding from Query flows into Assert as input.

**Steps**:
1. Build a workflow: Start → GraphQL Query → GraphQL Assert → End.
2. In the Query node, add output binding: field `data`, variable name `queryResult`.
3. In the Assert node, set source variable to `queryResult`.
4. Add assertion: JSONPath `$.user.id`, operator `exists`.
5. Run the workflow.

**Expected Results**:
- [ ] Assert node receives `queryResult` as its data source.
- [ ] Assertion evaluates against the actual query response data.
- [ ] Workflow passes if `user.id` exists in the response.

---

### G-3: GraphQL errors surface in workflow timeline

**Goal**: When a GraphQL query returns an `errors` array, the workflow node shows an error state.

**Steps**:
1. Build a workflow with a GraphQL Query node.
2. Configure it with an invalid query (e.g., `query { nonExistentField }`).
3. Run the workflow.

**Expected Results**:
- [ ] Query node enters error state (red outline on canvas).
- [ ] Workflow timeline shows the GraphQL error message.
- [ ] Run status: **Failed**.

---

### G-4: Subscription collect and stop

**Goal**: Subscription node collects messages and stops at the configured threshold.

**Steps**:
1. Add a Subscription node configured to subscribe to `subscription { counter }` on the test server.
2. Set stop condition: **Stop after 3 messages**.
3. Run the workflow.

**Expected Results**:
- [ ] Subscription node connects, receives 3 messages, then disconnects.
- [ ] Output binding `messages` contains an array of 3 message objects.
- [ ] `messageCount` binding equals 3.

---

## Section H — Data Integrity

### H-1: Config persists across page reload

**Steps**:
1. Configure a Query node with a specific endpoint and query.
2. Click Save.
3. Reload the page.
4. Open the workflow and re-open the config modal.

**Expected Results**:
- [ ] Endpoint, query, variables, headers, and extraction rules are all preserved.
- [ ] No data loss across reload.

---

### H-2: Import from Collections

**Steps**:
1. In GraphQL Studio (not workflow), save a query to a collection.
2. Navigate to Workflow → open a GraphQL Query config modal.
3. Click **Import from Collections**.
4. Select the saved query.

**Expected Results**:
- [ ] Query text is loaded into the Operation editor.
- [ ] Variables (if any) are populated in the Variables editor.
- [ ] Endpoint may be pre-filled from the collection's connection profile.

---

## Regression Checklist

After completing all above scenarios, verify:

- [ ] No `tsc -b --noEmit` errors introduced.
- [ ] Workflow runner runs a 5-node graphql workflow without crashing.
- [ ] Gallery page still loads with 45+ entries.
- [ ] `graphql-health-check` appears in the Featured Templates section on the empty canvas.
- [ ] All 5 GraphQL palette blocks appear in their expected category (Integration / Action / Logic).
