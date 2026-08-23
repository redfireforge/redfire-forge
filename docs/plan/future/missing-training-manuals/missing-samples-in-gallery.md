# Missing Gallery Samples — Gap Analysis & Implementation Plan

> **Branch:** `feature/training-manual`
> **Status:** Planning
> **Last updated:** 2026-08-23

---

## How the Gallery is Structured

The gallery has 7 registered domains (in `src/data/galleries/types.ts` + `registry.ts`):

| Domain | Key | Source Files |
|--------|-----|--------------|
| Requests | `requests` | `galleries/requests/presets.ts` (13 entries) |
| API Catalog | `catalog` | `galleries/catalog-specs/specs/*.ts` (8 public APIs) |
| Tests | `tests` | `galleries/tests/presets.ts`, `presets-advanced.ts`, `parameterizedPresets.ts`, `sharedDataSourcePresets.ts` |
| Workflows | `workflows` | `galleries/workflows/*.ts` (~30 entries across api-patterns, flow-control, event-driven, orchestration, script, async-correlation, diverse-apis, performance, parallel, kafka, graphql) |
| Assertions | `assertions` | `galleries/assertion-presets/index.ts` (7 entries) |
| Data Mapper | `data-mapper` | `galleries/data-mapper/presets.ts` |
| API Mock | `api-mock` | `galleries/api-mock/presets-*.ts` |

---

## Gap Summary

| Gap Area | Type | Severity |
|----------|------|----------|
| gRPC workflow samples | Missing entries in existing `workflows` domain | 🔴 High — node types exist, 0 samples |
| WebSocket workflow samples | Missing entries in existing `workflows` domain | 🔴 High — node types exist, 0 samples |
| gRPC gallery domain | `GalleryDomain` type + registry missing `'grpc'` | 🔴 High — blocks standalone gRPC samples |
| WebSocket gallery domain | `GalleryDomain` type + registry missing `'websocket'` | 🔴 High — blocks standalone WS samples |
| GraphQL test gallery entries | `tests` domain has 0 GraphQL scenario tests | 🟡 Medium |
| gRPC test gallery entries | `tests` domain has 0 gRPC scenario tests | 🟡 Medium |
| WebSocket test gallery entries | `tests` domain has 0 WS scenario tests | 🟡 Medium |
| GraphQL request gallery entries | `requests` domain is REST-only | 🟡 Medium |
| GraphQL assertion gallery entries | `assertions` domain is REST-only | 🟡 Medium |
| gRPC assertion gallery entries | `assertions` domain is REST-only | 🟡 Medium |
| API Mock — Auth-gated routes sample | `security` predicate covers Bearer + API Key today, no sample | 🟡 Medium |
| API Mock — GraphQL over HTTP sample | Body `jsonPath_equals` on `$.query` works today, no sample | 🟡 Medium |
| API Mock — Stateful sequence sample | `'state'` mode + `ApiMockStateTransitionV1` exist today, no sample | 🟡 Medium |
| API Mock — Webhook receiver sample | Capture + body validate works; HMAC signature verify is **not** a predicate operator | 🟡 Medium — partial (no inbound HMAC) |

---

## Part 1 — Missing Workflow Gallery Samples (Highest Priority)

### Background: Available Workflow Node Types

**gRPC node types** (dispatched in `graphRunner.ts`, implemented in `graphRunnerGrpcNodeHandlers.ts` + `graphRunnerGrpcAdvancedNodeHandlers.ts`):

| Node Type | Description |
|-----------|-------------|
| `grpcUnary` | Single request → single response (Phase 6C) |
| `grpcServerStream` | Single request → stream of response messages (Phase 6D) |
| `grpcAssert` | Assert on a prior gRPC result's captured variables |
| `grpcLoadTest` | Bounded unary load test; publishes `loadTestSummary` (Phase 11N) |
| `grpcSchemaDiff` | Proto descriptor diff; workflow fails on breaking changes |
| `grpcMockAssert` | Unary call against a mock listener target |

**WebSocket node types** (implemented in `graphRunnerWsNodeHandlers.ts`):

| Node Type | Description |
|-----------|-------------|
| `wsConnect` | Open a WebSocket connection; seeds `connectionId` into context |
| `wsSend` | Send a text/binary message over an existing connection |
| `wsReceive` | Wait for and capture an incoming message (with match criteria) |
| `wsTrigger` | Entry-point trigger — waits for an inbound WS message to start the workflow |

---

### 1a. gRPC Workflow Samples (new file: `galleries/workflows/grpc.ts`)

**6 planned entries:**

---

#### WF-GRPC-01 · gRPC Health Check (Easy)
- **ID:** `sample-grpc-health-check`
- **Name:** `gRPC: Health Check`
- **Category:** grpc
- **Difficulty:** easy
- **Description:** Call the `grpc.health.v1.Health/Check` unary method, verify `status` is `SERVING`.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — `target: "grpc.health.v1.Health/Check"`, service: demo gRPC reflect endpoint
  3. `grpcAssert` — assert `$.status === "SERVING"`
  4. `end`
- **Tags:** `grpc`, `health`, `unary`, `easy`
- **liveApis:** `grpc.postman.co` (public gRPC reflect endpoint)
- **Purpose:** Teaches the basics: upload proto / use reflection, configure endpoint, run unary call, assert.

---

#### WF-GRPC-02 · gRPC User Lookup (Easy)
- **ID:** `sample-grpc-user-lookup`
- **Name:** `gRPC: User Lookup`
- **Category:** grpc
- **Difficulty:** easy
- **Description:** Fetch a user by ID using a unary RPC, extract `user.name` and `user.email` into workflow variables.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — `GetUser({ id: 1 })`, output bindings: `userId ← $.user.id`, `userName ← $.user.name`
  3. `grpcAssert` — assert `$.user.id === 1` and field existence
  4. `end`
- **Tags:** `grpc`, `unary`, `extract`, `variable`
- **liveApis:** demo gRPC endpoint
- **Purpose:** Shows output variable binding and chaining variables into downstream nodes.

---

#### WF-GRPC-03 · gRPC Server Streaming — List Orders (Medium)
- **ID:** `sample-grpc-server-stream`
- **Name:** `gRPC: Server Stream — Order Feed`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Call a `ListOrders` server-streaming RPC; the node collects all stream messages and publishes them as `messages[]` into context.
- **Nodes:**
  1. `start`
  2. `grpcServerStream` — `ListOrders({ status: "PENDING" })`, `maxMessages: 20`, `timeoutMs: 5000`
  3. `grpcAssert` — assert `$.messages.length > 0` and `$.messages[0].status === "PENDING"`
  4. `end`
- **Tags:** `grpc`, `streaming`, `server-stream`, `collect`
- **liveApis:** demo gRPC endpoint
- **Purpose:** Demonstrates `grpcServerStream` node — bounded collection, assert on collected array.

---

#### WF-GRPC-04 · gRPC CRUD Flow (Medium)
- **ID:** `sample-grpc-crud`
- **Name:** `gRPC: Create → Fetch → Delete`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Three chained unary calls: `CreateProduct`, `GetProduct` (verify it was created), `DeleteProduct`. Uses output binding to thread the `productId` between steps.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — `CreateProduct({ name: "Test Widget", price: 9.99 })` → binds `productId ← $.product.id`
  3. `grpcUnary` — `GetProduct({ id: {{productId}} })` → binds `fetchedName ← $.product.name`
  4. `grpcAssert` — assert `$.product.name === "Test Widget"`
  5. `grpcUnary` — `DeleteProduct({ id: {{productId}} })` → assert `$.success === true`
  6. `end`
- **Tags:** `grpc`, `crud`, `chain`, `variable-binding`
- **Purpose:** Real multi-step gRPC workflow with variable threading; mirrors the HTTP "Create → Extract → Verify" sample.

---

#### WF-GRPC-05 · gRPC Schema Drift Watchdog (Advanced)
- **ID:** `sample-grpc-schema-diff`
- **Name:** `gRPC: Schema Drift Watchdog`
- **Category:** grpc
- **Difficulty:** advanced
- **Description:** Schedule-triggered workflow that runs `grpcSchemaDiff` against the live proto reflection and fails the workflow if any breaking change is detected. Mirrors the GraphQL Schema Watchdog sample.
- **Nodes:**
  1. `schedule` — `cron: "0 * * * *"` (hourly)
  2. `grpcSchemaDiff` — baseline descriptor in context vs. live reflection
  3. `condition` — `$.hasBreakingChanges === true`
     - true → `logDebug` — "Breaking schema change detected!" → `errorHandler`
     - false → `logDebug` — "Schema OK" → `end`
  4. `end`
- **Tags:** `grpc`, `schema-diff`, `watchdog`, `schedule`, `breaking-change`
- **Purpose:** Shows `grpcSchemaDiff` node and how to gate a pipeline on proto compatibility.

---

#### WF-GRPC-06 · gRPC Load Test (Advanced)
- **ID:** `sample-grpc-load-test`
- **Name:** `gRPC: Load Test — Bounded Unary`
- **Category:** grpc
- **Difficulty:** advanced
- **Description:** Run a `grpcLoadTest` against a unary RPC endpoint with 50 virtual users for 10 seconds, then assert on `loadTestSummary.errorRate <= 1%` and `p95 <= 200ms`.
- **Nodes:**
  1. `start`
  2. `grpcLoadTest` — `target: "GetUser"`, `vus: 50`, `durationMs: 10000`, `request: { id: 1 }`
  3. `grpcAssert` — assert `$.loadTestSummary.errorRate <= 1` and `$.loadTestSummary.p95 <= 200`
  4. `end`
- **Tags:** `grpc`, `load-test`, `performance`, `p95`, `sla`
- **Purpose:** Teaches the `grpcLoadTest` node — config fields, summary output shape, SLA assertions.

---

### 1b. WebSocket Workflow Samples (new file: `galleries/workflows/websocket.ts`)

**5 planned entries:**

---

#### WF-WS-01 · WebSocket Echo — Connect & Send (Easy)
- **ID:** `sample-ws-echo`
- **Name:** `WebSocket: Echo Ping`
- **Category:** websocket
- **Difficulty:** easy
- **Description:** Connect to a public echo WebSocket, send `"ping"`, receive `"ping"` back, assert the echoed message matches.
- **Nodes:**
  1. `start`
  2. `wsConnect` — `url: "wss://echo.websocket.org"`, binds `connectionId`
  3. `wsSend` — `message: "ping"`, `connectionId: {{connectionId}}`
  4. `wsReceive` — `connectionId: {{connectionId}}`, `timeoutMs: 5000`, binds `receivedMessage ← $.data`
  5. `setVariable` — assert-like: `assert $.receivedMessage === "ping"`
  6. `end`
- **Tags:** `websocket`, `echo`, `send`, `receive`, `easy`
- **liveApis:** `echo.websocket.org`
- **Purpose:** Simplest possible WS workflow — demonstrates the three core node types together.

---

#### WF-WS-02 · WebSocket JSON Message Exchange (Easy)
- **ID:** `sample-ws-json-exchange`
- **Name:** `WebSocket: JSON Message Exchange`
- **Category:** websocket
- **Difficulty:** easy
- **Description:** Send a JSON subscribe message, receive a JSON event response, extract a field using `$.data.price`, assert it is numeric.
- **Nodes:**
  1. `start`
  2. `wsConnect` — connects to public demo feed
  3. `wsSend` — sends `{ "action": "subscribe", "channel": "prices" }`
  4. `wsReceive` — match criteria: `messageType: "text"`, binds `price ← $.data.price`
  5. `grpcAssert` (or inline condition) — assert `$.price > 0`
  6. `end`
- **Tags:** `websocket`, `json`, `subscribe`, `extract`
- **Purpose:** Teaches JSON parsing in WS receive + variable extraction from message body.

---

#### WF-WS-03 · WebSocket Chat — Send, Receive, Assert (Medium)
- **ID:** `sample-ws-chat-flow`
- **Name:** `WebSocket: Chat Flow`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Connect to a WS chat endpoint, send an authentication message, receive acknowledgement, send a chat message, receive the broadcast echo, assert message content.
- **Nodes:**
  1. `start`
  2. `wsConnect` — `url: "wss://demo-ws-chat.example.com"`
  3. `wsSend` — `{ "type": "auth", "token": "{{authToken}}" }`
  4. `wsReceive` — wait for `{ "type": "auth_ok" }` (match on `$.type === "auth_ok"`), `timeoutMs: 3000`
  5. `wsSend` — `{ "type": "message", "room": "general", "text": "Hello from workflow" }`
  6. `wsReceive` — wait for broadcast, bind `$.text → receivedText`
  7. `condition` — `$.receivedText === "Hello from workflow"`
     - true → `end`
     - false → `errorHandler`
- **Tags:** `websocket`, `auth`, `chat`, `send-receive`, `conditional`
- **Purpose:** Shows multi-step WS interaction with auth handshake, conditional branching on message content.

---

#### WF-WS-04 · WebSocket Trigger — React to Inbound Event (Medium)
- **ID:** `sample-ws-trigger`
- **Name:** `WebSocket: Inbound Trigger`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Workflow starts when a WebSocket message arrives (`wsTrigger`). Extracts the event payload and makes a downstream HTTP call based on the event data.
- **Nodes:**
  1. `wsTrigger` — waits for inbound WS message, filter: `$.event === "order.created"`, binds `orderId ← $.data.orderId`
  2. `http` — `GET https://api.example.com/orders/{{orderId}}`
  3. `condition` — `$.status === "confirmed"`
     - true → `logDebug` — "Order confirmed, proceeding" → `end`
     - false → `logDebug` — "Order not confirmed" → `errorHandler`
- **Tags:** `websocket`, `trigger`, `inbound`, `event-driven`, `http`
- **Purpose:** Demonstrates `wsTrigger` as a workflow entry point; bridges WS events to HTTP downstream calls.

---

#### WF-WS-05 · WebSocket + HTTP Hybrid — Live Pricing Pipeline (Advanced)
- **ID:** `sample-ws-http-hybrid`
- **Name:** `WebSocket: Live Price → HTTP Enrichment`
- **Category:** websocket
- **Difficulty:** advanced
- **Description:** Connect to a live price feed, wait for a price drop event, extract the product ID, call an HTTP API to get product details, and send a notification back over the same connection.
- **Nodes:**
  1. `start`
  2. `wsConnect` — live price feed
  3. `wsSend` — subscribe to product category
  4. `wsReceive` — wait for `{ "type": "price_drop", "productId": "..." }`, bind `productId ← $.data.productId`, `newPrice ← $.data.price`
  5. `http` — `GET https://fakestoreapi.com/products/{{productId}}`
  6. `setVariable` — `alertMessage ← "Price drop: {{productId}} now ${{newPrice}}"`
  7. `wsSend` — send acknowledgement message back
  8. `end`
- **Tags:** `websocket`, `http`, `hybrid`, `event-driven`, `enrichment`, `advanced`
- **liveApis:** `fakestoreapi.com`
- **Purpose:** Advanced pattern — WS event triggers an HTTP call for enrichment, then WS send for acknowledgement. Combines all three WS node types plus HTTP in one workflow.

---

## Part 2 — Missing Gallery Domains (Infrastructure Prerequisites)

Before any protocol-specific samples can have their own gallery tab, two changes must be made:

### 2a. Add `'grpc'` and `'websocket'` to `GalleryDomain` type

**File:** `src/data/galleries/types.ts`

```typescript
// Current:
export type GalleryDomain = 'requests' | 'catalog' | 'tests' | 'workflows' | 'assertions' | 'data-mapper' | 'api-mock';

// After:
export type GalleryDomain =
  | 'requests' | 'catalog' | 'tests' | 'workflows' | 'assertions'
  | 'data-mapper' | 'api-mock'
  | 'grpc'        // ← new: standalone gRPC request/test samples
  | 'websocket';  // ← new: standalone WebSocket request/test samples
```

### 2b. Register new domains in `registry.ts`

**File:** `src/data/galleries/registry.ts`

```typescript
{
  key: 'grpc',
  label: 'gRPC',
  icon: '🔌',
  description: 'gRPC unary and streaming call samples with .proto schema',
},
{
  key: 'websocket',
  label: 'WebSocket',
  icon: '⚡',
  description: 'WebSocket connection, messaging, and event-driven samples',
},
```

---

## Part 3 — Missing Test Gallery Samples

All existing test gallery entries use HTTP transport. The following protocol test scenarios are missing.

### 3a. GraphQL Test Scenarios (new section in `galleries/tests/presets.ts` or new file `presets-graphql.ts`)

**2 planned entries:**

---

#### TG-GQL-01 · GraphQL Health Check Test (Easy)
- **ID:** `test-graphql-health`
- **Name:** `GraphQL Health Check`
- **Category:** graphql
- **Difficulty:** easy
- **Description:** Single-scenario test: execute `{ __typename }` introspection query against a public GraphQL endpoint, assert response has no `errors` and `$.data.__typename === "Query"`.
- **Scenarios:**
  - `sc-gql-health`: introspection ping
    - step: POST `/graphql` body `{ query: "{ __typename }" }`
    - assertion: `status 200`, `$.data.__typename === "Query"`, `$.errors` does not exist
- **Tags:** `graphql`, `health`, `introspection`
- **liveApis:** `countries.trevorblades.com/graphql`

---

#### TG-GQL-02 · GraphQL Query + Mutation Flow (Medium)
- **ID:** `test-graphql-crud`
- **Name:** `GraphQL: Query & Mutation`
- **Category:** graphql
- **Difficulty:** medium
- **Description:** Two scenarios — one queries a list of items, the second runs a mutation.
- **Scenarios:**
  - `sc-gql-query`: `query { users { id name } }` — assert array length ≥ 1
  - `sc-gql-mutation`: `mutation CreateUser` — assert `$.data.createUser.id` is numeric
- **Tags:** `graphql`, `query`, `mutation`, `crud`
- **liveApis:** `dummyjson.com/graphql` or equivalent

---

### 3b. gRPC Test Scenarios (new file `galleries/tests/presets-grpc.ts`)

**2 planned entries:**

---

#### TG-GRPC-01 · gRPC Unary Smoke Test (Easy)
- **ID:** `test-grpc-health`
- **Name:** `gRPC: Unary Smoke Test`
- **Category:** grpc
- **Difficulty:** easy
- **Description:** Single scenario: call `grpc.health.v1.Health/Check`, assert `status === "SERVING"`.
- **Notes:** Uses `transport: 'grpcUnary'` in the test step config. Requires the new `'grpc'` domain to be added to `GalleryDomain`.
- **Tags:** `grpc`, `health`, `unary`, `smoke`
- **liveApis:** `grpc.postman.co`

---

#### TG-GRPC-02 · gRPC CRUD Scenario (Medium)
- **ID:** `test-grpc-crud`
- **Name:** `gRPC: CRUD Scenarios`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Three scenarios covering `GetUser`, `CreateUser`, `DeleteUser` — each as a separate scenario with assertions on response fields and variable extraction.
- **Tags:** `grpc`, `crud`, `unary`, `variables`

---

### 3c. WebSocket Test Scenarios (new file `galleries/tests/presets-websocket.ts`)

**2 planned entries:**

---

#### TG-WS-01 · WebSocket Echo Test (Easy)
- **ID:** `test-ws-echo`
- **Name:** `WebSocket: Echo Smoke Test`
- **Category:** websocket
- **Difficulty:** easy
- **Description:** Connect to echo endpoint, send "ping", assert received message matches "ping". Uses `transport: 'wsConnect'` / `wsSend` / `wsReceive` in scenario steps.
- **Tags:** `websocket`, `echo`, `smoke`, `easy`
- **liveApis:** `echo.websocket.org`

---

#### TG-WS-02 · WebSocket JSON Subscribe (Medium)
- **ID:** `test-ws-subscribe`
- **Name:** `WebSocket: JSON Subscribe & Assert`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Subscribe to a JSON feed, assert first message has expected shape (`$.type`, `$.data`).
- **Tags:** `websocket`, `json`, `subscribe`, `medium`

---

## Part 4 — Missing Requests Gallery Samples

### 4a. GraphQL Request Samples (add to `galleries/requests/presets.ts`)

All 13 current request entries are HTTP REST. A GraphQL query is technically a POST request, so it fits naturally in the requests gallery.

**3 planned entries:**

---

#### RQ-GQL-01 · GraphQL Introspection Query (Easy)
- **ID:** `req-graphql-introspect`
- **Name:** `GraphQL Introspection`
- **Category:** graphql
- **Difficulty:** easy
- **Description:** POST `{ "query": "{ __typename }" }` to a public GraphQL endpoint. Shows how a GraphQL request differs from REST.
- **URL:** `https://countries.trevorblades.com/graphql`
- **Method:** POST
- **Body:** `{ "query": "{ __typename }" }`
- **Tags:** `graphql`, `introspection`, `post`

---

#### RQ-GQL-02 · GraphQL Query — Country Info (Easy)
- **ID:** `req-graphql-country`
- **Name:** `GraphQL: Country Info`
- **Category:** graphql
- **Difficulty:** easy
- **Description:** Query country name, capital, and currency by country code.
- **URL:** `https://countries.trevorblades.com/graphql`
- **Body:**
  ```graphql
  query {
    country(code: "US") { name capital currency }
  }
  ```
- **Tags:** `graphql`, `query`, `country`

---

#### RQ-GQL-03 · GraphQL Mutation (Medium)
- **ID:** `req-graphql-mutation`
- **Name:** `GraphQL: Create Post Mutation`
- **Category:** graphql
- **Difficulty:** medium
- **Description:** A mutation that creates a post via the DummyJSON GraphQL endpoint.
- **URL:** `https://dummyjson.com/graphql` (or equivalent)
- **Tags:** `graphql`, `mutation`, `create`

---

## Part 5 — Missing Assertion Gallery Samples

### 5a. GraphQL Assertions (add to `galleries/assertion-presets/presets.ts` + `index.ts`)

**2 planned entries:**

---

#### AP-GQL-01 · GraphQL No Errors Guard (Easy)
- **ID:** `preset-graphql-no-errors`
- **Name:** `GraphQL No Errors Guard`
- **Category:** api-validation
- **Difficulty:** easy
- **Description:** Two assertions: verify `$.errors` does not exist, verify `$.data` exists.
- **Assertion Types:** `existence`
- **Tags:** `graphql`, `errors`, `contract`

---

#### AP-GQL-02 · GraphQL Data Shape (Medium)
- **ID:** `preset-graphql-data-shape`
- **Name:** `GraphQL Data Shape`
- **Category:** data-quality
- **Difficulty:** medium
- **Description:** Asserts `$.data` is not null, `$.data.user.id` is numeric, `$.data.user.email` matches email regex.
- **Assertion Types:** `existence`, `typeCheck`, `regex`
- **Tags:** `graphql`, `data`, `type`, `shape`

---

### 5b. gRPC Assertions (add to `galleries/assertion-presets/presets.ts` + `index.ts`)

**2 planned entries:**

---

#### AP-GRPC-01 · gRPC Status OK (Easy)
- **ID:** `preset-grpc-status-ok`
- **Name:** `gRPC Status OK`
- **Category:** api-validation
- **Difficulty:** easy
- **Description:** Assert `$.grpcStatus === 0` (OK) and `$.messages` array is non-empty.
- **Assertion Types:** `numeric`, `arrayLength`
- **Tags:** `grpc`, `status`, `ok`

---

#### AP-GRPC-02 · gRPC Health SERVING (Easy)
- **ID:** `preset-grpc-health-serving`
- **Name:** `gRPC Health — SERVING`
- **Category:** api-validation
- **Difficulty:** easy
- **Description:** Assert `$.status === "SERVING"` (for `grpc.health.v1.Health/Check` responses).
- **Assertion Types:** `equal`
- **Tags:** `grpc`, `health`, `serving`

---

## Implementation Order

```
Phase A — Infrastructure (1-2 days)
  A1. Add 'grpc' | 'websocket' to GalleryDomain type (types.ts)
  A2. Register grpc + websocket domains in registry.ts
  A3. Create src/data/galleries/grpc/ directory + index.ts scaffold
  A4. Create src/data/galleries/websocket/ directory + index.ts scaffold

Phase B — Workflow Samples (3-4 days)
  B1. Create galleries/workflows/grpc.ts (6 entries: WF-GRPC-01 → WF-GRPC-06)
  B2. Create galleries/workflows/websocket.ts (5 entries: WF-WS-01 → WF-WS-05)
  B3. Register both files in galleries/workflows/index.ts
  B4. Write unit tests: galleries/workflows/grpc.test.ts, websocket.test.ts

Phase C — Test Gallery Samples (2-3 days)
  C1. Add GraphQL entries to galleries/tests/presets.ts (TG-GQL-01, TG-GQL-02)
  C2. Create galleries/tests/presets-grpc.ts (TG-GRPC-01, TG-GRPC-02)
  C3. Create galleries/tests/presets-websocket.ts (TG-WS-01, TG-WS-02)
  C4. Register all new files in galleries/tests/index.ts
  C5. Write unit tests for each new preset file

Phase D — Requests + Assertions + API Mock Samples (2-3 days)
  D1. Add GraphQL request entries to galleries/requests/presets.ts (RQ-GQL-01 → RQ-GQL-03)
  D2. Add GraphQL + gRPC assertion entries to galleries/assertion-presets/presets.ts + index.ts
  D3. Add createAuthGatedMock() to galleries/api-mock/presets-matching.ts (AM-AUTH-01)
  D4. Add createGraphQLMock() to galleries/api-mock/presets-matching.ts (AM-GQL-01)
  D5. Create galleries/api-mock/presets-state.ts with order flow sample (AM-STATE-01)
  D6. Create galleries/api-mock/presets-webhook.ts with webhook receiver sample (AM-WH-01)
  D7. Register new API mock entries in galleries/api-mock/index.ts
  D8. Run gallery-loaded-badge.spec.ts + gallery.spec.ts E2E to verify all new entries render

Phase E — Validation
  E1. npx tsc --noEmit — 0 errors
  E2. npx vitest run src/data/galleries/ — all tests pass
  E3. Visual test: open Gallery in browser, verify all new tabs and entries appear
  E4. Import each new workflow sample → verify nodes render correctly in Workflow Designer
  E5. Import each new test/request sample → verify fields populate
```

---

## Part 6 — Missing API Mock Gallery Samples

### Feature Support Reality Check

| Capability | Engine Support | Gallery Sample |
|------------|---------------|----------------|
| Match `POST /graphql` by body `$.query` content | ✅ `body` source + `jsonPath_equals` operator works today | ❌ no sample |
| Receive inbound webhook POST, inspect payload | ✅ any route captures body; `json_subset` / `jsonPath_equals` predicates work | ❌ no sample |
| Verify inbound HMAC signature (`X-Hub-Signature-256`) | ❌ `security` source only covers scheme/username/tokenClaim/apiKey/certSubject — no digest/HMAC operator | — needs new feature |
| Fire outbound callback after match | ✅ Phase 9D `callbacks` field on `ApiMockResponseVariantV1` | ⚠️ `am-gallery-suite` touches it briefly |

The inbound HMAC gap is a **feature gap** in the engine (`ApiMockPredicateOperator` + `predicateEvaluatorHelpers.ts`), not just a missing sample. Adding it requires a new `hmac_sha256` operator in `contracts.ts`, evaluation logic in `predicateEvaluatorHelpers.ts`, and UI support in `ApiMockRouteEditor`. That work is tracked separately below.

---

### 6a. Auth-gated Routes (new entry in `galleries/api-mock/presets-matching.ts`)

**1 planned entry:**

---

#### AM-AUTH-01 · Auth-gated API Routes (Easy)
- **ID:** `am-gallery-auth-gated`
- **Name:** `Auth-gated routes`
- **Category:** `matching`
- **Difficulty:** easy
- **Description:** Demonstrates the `security` predicate source with two protected endpoints — one requires an OAuth2 Bearer token (`scheme` = `Bearer`), another requires an API Key header (`apiKeyName` present). Each route returns `401 Unauthorized` when auth is missing and `200 OK` with a stub payload when present. A third catch-all route shows how an unprotected public endpoint coexists.
- **Routes:**
  1. `GET /api/profile` — predicate: `security scheme exact Bearer` → `{ "id": 1, "name": "Alice" }` (200); variant: `security scheme absent` → `{ "error": "Unauthorized" }` (401)
  2. `GET /api/data` — predicate: `security apiKeyName present` → `{ "rows": [] }` (200); variant: absent → `{ "error": "API key required" }` (401)
  3. `GET /api/public` — no auth predicate → `{ "status": "ok" }` (200)
- **routeCount:** 3
- **teaches:** `['security-predicate', 'bearer-auth', 'api-key-auth', 'auth-gating', 'conditional-variants']`
- **Tags:** `auth`, `bearer`, `api-key`, `security`, `oauth2`
- **Source file:** add `createAuthGatedMock()` to `presets-matching.ts`, register in `index.ts`

---

### 6b. GraphQL over HTTP Mock (new entry in `galleries/api-mock/presets-matching.ts`)

**1 planned entry:**

---

#### AM-GQL-01 · GraphQL Mock Server (Medium)
- **ID:** `am-gallery-graphql`
- **Name:** `GraphQL API mock`
- **Category:** `matching`
- **Difficulty:** medium
- **Description:** A single `POST /graphql` route that uses a `body` predicate with `jsonPath_equals` on `$.operationName` to distinguish queries from mutations, returning different stub payloads per operation. Demonstrates that GraphQL-over-HTTP is just a POST with JSON body matching — no special GraphQL support needed.
- **Routes:**
  1. `POST /graphql` — predicate: `body jsonPath_equals $.operationName GetUser` → response `{ "data": { "user": { "id": 1, "name": "Alice" } } }`
  2. `POST /graphql` — predicate: `body jsonPath_equals $.operationName CreateUser` → response `{ "data": { "createUser": { "id": 99, "name": "New User" } } }`
  3. `POST /graphql` — predicate: `body jsonPath_equals $.query` contains `__typename` → response `{ "data": { "__typename": "Query" } }`
- **routeCount:** 3
- **teaches:** `['jsonpath-body-matching', 'graphql-over-http', 'operation-routing']`
- **Tags:** `graphql`, `jsonpath`, `body-matching`, `post`, `operation`
- **Source file:** add `createGraphQLMock()` to `presets-matching.ts`, register in `presets.ts` and `index.ts`

---

### 6c. Stateful Sequence — Order Flow (new file `galleries/api-mock/presets-state.ts`)

**1 planned entry:**

---

#### AM-STATE-01 · Stateful Order Flow (Medium)
- **ID:** `am-gallery-order-flow`
- **Name:** `Stateful order flow`
- **Category:** `simulation`
- **Difficulty:** medium
- **Description:** Models a three-step order lifecycle using `responseMode: 'state'` and `ApiMockStateTransitionV1`. The mock server tracks a `orderState` key across requests. Calling `POST /orders` transitions from `idle` → `pending`, `POST /orders/:id/pay` transitions `pending` → `paid`, `GET /orders/:id` returns a different status body depending on the current state. Demonstrates stateful API mocking without any external database.
- **Routes:**
  1. `POST /orders` — variant with `transition: { targetState: 'pending' }` → `{ "id": "ord-1", "status": "pending" }` (201)
  2. `POST /orders/:id/pay` — predicate: `stateKey = 'pending'`; transition → `paid`; response `{ "status": "paid" }` (200). Second variant: `stateKey` not pending → `{ "error": "order not in pending state" }` (409)
  3. `POST /orders/:id/confirm` — predicate: `stateKey = 'paid'`; transition → `complete`; response `{ "status": "complete", "receipt": "REC-001" }` (200)
  4. `GET /orders/:id` — three conditional variants returning `{ "status": "pending" | "paid" | "complete" }` based on current state
- **routeCount:** 4
- **teaches:** `['state-mode', 'state-transitions', 'lifecycle-mocking', 'conditional-variants', 'stateKey-predicate']`
- **Tags:** `state`, `sequence`, `order`, `lifecycle`, `stateful`
- **Source file:** create `presets-state.ts`, register in `index.ts`

---

### 6d. Webhook Receiver (new file `galleries/api-mock/presets-webhook.ts`)

**1 planned entry (partial — no HMAC until engine supports it):**

---

#### AM-WH-01 · Webhook Receiver (Medium)

> Formerly listed as `6b` — renumbered to `6d` after adding Auth-gated and Stateful samples above.
- **ID:** `am-gallery-webhook`
- **Name:** `Webhook receiver`
- **Category:** `matching`
- **Difficulty:** medium
- **Description:** A `POST /webhook` route that captures inbound payloads and validates the body shape. Teaches payload inspection via journal, `json_subset` matching, and using `jsonPath_equals` to gate on `$.event` type. The route intentionally does **not** verify `X-Hub-Signature-256` — a note in the sample explains this is a planned feature.
- **Routes:**
  1. `POST /webhook` — predicate: `body json_subset { "event": "order.created" }` → response `{ "ok": true }` (200)
  2. `POST /webhook` — predicate: `body json_subset { "event": "order.cancelled" }` → response `{ "ok": true }` (200)
  3. `POST /webhook` — no predicate (catch-all) → response `{ "error": "unknown event" }` (400)
- **routeCount:** 3
- **teaches:** `['json-subset-matching', 'event-routing', 'catch-all', 'journal-capture']`
- **Tags:** `webhook`, `event`, `json-subset`, `inbound`, `journal`
- **Note:** HMAC signature verification requires engine work — see below.

---

### 6e. Engine Feature Gap — Inbound HMAC Signature Verification

This is a **missing feature**, not just a missing sample. Implementing it requires changes across 4 layers:

| Layer | Change Required |
|-------|-----------------|
| `src/shared/api-mock/contracts.ts` | Add `'hmac_sha256'` to `ApiMockPredicateOperator` union |
| `src/shared/api-mock/predicateEvaluatorHelpers.ts` | Add `case 'hmac_sha256'` in `evaluateOperator()` — extract raw body bytes, compute HMAC-SHA256 with a configured secret, compare to `X-Hub-Signature-256` / `X-Webhook-Signature` / `X-Signature` header |
| `src/shared/api-mock/validation.ts` | Add validation rules for the new operator (requires `security` source or `header` source with a secret field) |
| `src/features/api-mock/components/ApiMockRouteEditor.tsx` | Add UI for configuring the secret key when `hmac_sha256` operator is selected |

The HMAC secret could be stored as a server variable (already supported via `ApiMockVariableV1`) so it doesn't appear in plain text in route predicates.

Once implemented, the webhook receiver sample (AM-WH-01) can be upgraded with a 4th route that validates the signature header.

---

## Total Planned New Entries

| Domain | New Entries | Phase |
|--------|-------------|-------|
| Workflows (gRPC) | 6 | B |
| Workflows (WebSocket) | 5 | B |
| Tests (GraphQL) | 2 | C |
| Tests (gRPC) | 2 | C |
| Tests (WebSocket) | 2 | C |
| Requests (GraphQL) | 3 | D |
| Assertions (GraphQL) | 2 | D |
| Assertions (gRPC) | 2 | D |
| API Mock (Auth-gated routes) | 1 | D |
| API Mock (GraphQL over HTTP) | 1 | D |
| API Mock (Stateful order flow) | 1 | D |
| API Mock (Webhook receiver) | 1 | D |
| **Total** | **28** | |

### Engine Feature Required Before Full Webhook Sample

| Feature | Files | Blocked samples |
|---------|-------|-----------------|
| `hmac_sha256` predicate operator | `contracts.ts`, `predicateEvaluatorHelpers.ts`, `validation.ts`, `ApiMockRouteEditor.tsx` | AM-WH-01 (signature variant) |
