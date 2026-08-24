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
| Workflows | `workflows` | `galleries/workflows/*.ts` (~30 entries across api-patterns, flow-control, event-driven, orchestration, script, async-correlation, diverse-apis, performance, parallel, kafka, graphql — **0 for gRPC, WebSocket, or GraphQL subscriptions**) |
| Assertions | `assertions` | `galleries/assertion-presets/index.ts` (7 entries) |
| Data Mapper | `data-mapper` | `galleries/data-mapper/presets.ts` (52 entries — well covered) |
| API Mock | `api-mock` | `galleries/api-mock/presets-*.ts` (16 entries — missing auth-gated, GraphQL, stateful, webhook, outbound callbacks) |

---

## Gap Summary

| Gap Area | Type | Severity |
|----------|------|----------|
| gRPC workflow samples | Missing entries in existing `workflows` domain | 🔴 High — node types exist, 0 samples |
| WebSocket workflow samples | Missing entries in existing `workflows` domain | 🔴 High — node types exist, 0 samples |
| **GraphQL Subscription workflow samples** | `graphqlSubscription` node supports `subscriptionTransport: 'ws'\|'sse'`; `graphql.ts` has 3 query/mutation samples but 0 subscription samples | 🔴 High — major node type, 0 samples |
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
| API Mock — Outbound callbacks sample | Phase 9D `callbacks` field exists; `am-gallery-suite` only touches it briefly — no focused teaching sample | 🟡 Medium |

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

**GraphQL node types** (existing — `graphRunnerGraphqlNodeHandlers.ts` + `graphRunnerGraphqlSubscriptionHandler.ts`):

| Node Type | Description |
|-----------|-------------|
| `graphqlQuery` | Single GraphQL query or mutation (HTTP POST) |
| `graphqlIntrospect` | Schema introspection |
| `graphqlSchemaDiff` | Schema diff / watchdog |
| `graphqlSubscription` | Long-lived subscription; `subscriptionTransport: 'ws' \| 'sse'` — **0 gallery samples** |

---

### 1a. gRPC Workflow Samples (new file: `galleries/workflows/grpc.ts`)

**6 planned entries (✅ implemented):**

**Implementation Notes (added before coding):**
- `SampleCategory` in `galleries/workflows/types.ts` did not include `'grpc'` — added it (additive only; no exhaustive switches on SampleCategory exist). `TemplateGalleryModal.tsx` CATEGORIES array also updated to add a `gRPC` filter tab.
- `grpc.postman.co` is a Postman commercial endpoint; changed to `grpcb.in` — a well-known free public gRPC echo + health service.
- `GrpcAssertFieldAssertion` has no `<=` / `>=` numeric operators (only `equals`, `contains`, `exists`). WF-GRPC-06 uses a `condition` node for p95/error-rate numeric gate instead of asserting in `grpcAssert`.
- `saveAs` on gRPC nodes creates `{{grpc.aliasName.field.path}}` bindings for downstream expressions.
- `grpcAssert.source` must match `saveAs` alias (or node id) of the upstream gRPC call node.

---

#### WF-GRPC-01 · gRPC Health Check (Easy) ✅
- **ID:** `sample-grpc-health-check`
- **Name:** `gRPC: Health Check`
- **Category:** grpc
- **Difficulty:** easy
- **Description:** Call the `grpc.health.v1.Health/Check` unary method, verify `status` is `SERVING`.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — service: `grpc.health.v1.Health`, method: `Check`, target: `grpcb.in:443`, `saveAs: 'healthResult'`
  3. `grpcAssert` — source: `'healthResult'`, assert `$.grpcStatus === 0` + `$.status === 'SERVING'`
  4. `end`
- **Tags:** `grpc`, `health`, `unary`, `easy`
- **liveApis:** `grpcb.in` (free public gRPC reflect endpoint — changed from `grpc.postman.co` which is commercial)
- **Purpose:** Teaches the basics: upload proto / use reflection, configure endpoint, run unary call, assert.

---

#### WF-GRPC-02 · gRPC User Lookup (Easy) ✅
- **ID:** `sample-grpc-user-lookup`
- **Name:** `gRPC: User Lookup`
- **Category:** grpc
- **Difficulty:** easy
- **Description:** Fetch a user by ID using a unary RPC, extract `user.name` and `user.email` into workflow variables.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — `GetUser({ id: 1 })`, `saveAs: 'userResult'`
  3. `grpcAssert` — source: `'userResult'`, assert status 0 + `$.user.id === 1` + `$.user.name exists`
  4. `end`
- **Tags:** `grpc`, `unary`, `extract`, `variable`
- **liveApis:** `(configurable gRPC endpoint)`
- **Purpose:** Shows output variable binding and chaining variables into downstream nodes.

---

#### WF-GRPC-03 · gRPC Server Streaming — List Orders (Medium) ✅
- **ID:** `sample-grpc-server-stream`
- **Name:** `gRPC: Server Stream — Order Feed`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Call a `ListOrders` server-streaming RPC; the node collects all stream messages and publishes them as `messages[]` into context.
- **Nodes:**
  1. `start`
  2. `grpcServerStream` — `ListOrders({ status: "PENDING" })`, `collect: { maxMessages: 20, maxDurationMs: 5000 }`, `saveAs: 'orderFeed'`
  3. `grpcAssert` — source: `'orderFeed'`, assert `grpcStreamLength >= 1` (StreamLengthAssertion)
  4. `end`
- **Tags:** `grpc`, `streaming`, `server-stream`, `collect`
- **liveApis:** `(configurable gRPC endpoint)`
- **Purpose:** Demonstrates `grpcServerStream` node — bounded collection, assert on collected array.

---

#### WF-GRPC-04 · gRPC CRUD Flow (Medium) ✅
- **ID:** `sample-grpc-crud`
- **Name:** `gRPC: Create → Fetch → Delete`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Three chained unary calls: `CreateProduct`, `GetProduct` (verify it was created), `DeleteProduct`. Uses `saveAs` to thread the `productId` between steps via `{{grpc.createResult.product.id}}`.
- **Nodes:**
  1. `start`
  2. `grpcUnary` — `CreateProduct({ name: "Test Widget", price: 9.99 })`, `saveAs: 'createResult'`
  3. `grpcUnary` — `GetProduct({ id: {{grpc.createResult.product.id}} })`, `saveAs: 'getResult'`
  4. `grpcAssert` — source: `'getResult'`, assert `$.product.name === 'Test Widget'`
  5. `grpcUnary` — `DeleteProduct({ id: {{grpc.createResult.product.id}} })`, `saveAs: 'deleteResult'`
  6. `grpcAssert` — source: `'deleteResult'`, assert status 0 + `$.success === true`
  7. `end`
- **Tags:** `grpc`, `crud`, `chain`, `variable-binding`
- **Purpose:** Real multi-step gRPC workflow with variable threading; mirrors the HTTP "Create → Extract → Verify" sample.

---

#### WF-GRPC-05 · gRPC Schema Drift Watchdog (Advanced) ✅
- **ID:** `sample-grpc-schema-diff`
- **Name:** `gRPC: Schema Drift Watchdog`
- **Category:** grpc
- **Difficulty:** advanced
- **Description:** Schedule-triggered workflow that runs `grpcSchemaDiff` against the live proto reflection and fails the workflow if any breaking change is detected. Mirrors the GraphQL Schema Watchdog sample.
- **Nodes:**
  1. `schedule` — `cron: "0 * * * *"` (hourly)
  2. `grpcSchemaDiff` — `leftDescriptorKey: '{{baselineDescriptor}}'`, `rightDescriptorKey: '{{liveDescriptor}}'`, `failOnBreaking: false` (branch via condition instead)
  3. `condition` — `{{grpc.diffResult.hasBreakingChanges}} === true`
     - true → `logDebug` (error) "Breaking schema change detected!" → `end`
     - false → `logDebug` (info) "Schema OK" → `end`
  - **Note:** `failOnBreaking: false` lets the condition node control flow. `grpcSchemaDiff.saveAs: 'diffResult'` binds result for the condition expression. Node type is `'schedule'` (not `'scheduleTrigger'`); `cronExpression` field (not `cron`).
- **Tags:** `grpc`, `schema-diff`, `watchdog`, `schedule`, `breaking-change`
- **Purpose:** Shows `grpcSchemaDiff` node and how to gate a pipeline on proto compatibility.

---

#### WF-GRPC-06 · gRPC Load Test (Advanced) ✅
- **ID:** `sample-grpc-load-test`
- **Name:** `gRPC: Load Test — Bounded Unary`
- **Category:** grpc
- **Difficulty:** advanced
- **Description:** Run a `grpcLoadTest` against a unary RPC endpoint with 50 virtual users for 10 seconds, then gate on `p95 <= 200ms` and `errorRate` via a condition node. `GrpcAssertFieldAssertion` has no numeric comparison operators (`<=`/`>=`), so the SLA gate uses a `condition` node instead.
- **Nodes:**
  1. `start`
  2. `grpcLoadTest` — `concurrency: 50`, `durationMs: 10000`, `saveAs: 'loadResult'`
  3. `condition` — `{{grpc.loadResult.p95Ms}} <= 200` and `{{grpc.loadResult.errorRate}} <= 1`
     - true → `logDebug` (info) "SLA passed" → `end`
     - false → `logDebug` (error) "SLA violation — p95 or error rate exceeded" → `end`
- **Tags:** `grpc`, `load-test`, `performance`, `p95`, `sla`
- **Purpose:** Teaches the `grpcLoadTest` node — config fields, summary output shape, SLA assertions via condition.

---

### 1c. GraphQL Subscription Workflow Samples (new entries in `galleries/workflows/graphql.ts`)

**2 planned entries** (added to the existing `graphql.ts` file which already has 3 query/mutation samples):

---

#### WF-GQL-04 · GraphQL Subscription over WebSocket (Medium)
- **ID:** `sample-graphql-subscription-ws`
- **Name:** `GraphQL: Subscription over WebSocket`
- **Category:** graphql / event-driven
- **Difficulty:** medium
- **Description:** Opens a `graphqlSubscription` node with `subscriptionTransport: 'graphql-ws'` (graphql-ws protocol). Subscribes to a live event feed (`subscription OnOrderUpdated { onOrderUpdated { id status updatedAt } }`), collects up to 5 messages or 15 s of wall time, then branches on whether any events were received.
- **Nodes (6):**
  1. `start`
  2. `graphqlSubscription` — `subscriptionTransport: 'graphql-ws'`, `stopAfterMessages: 5`, `stopAfterMs: 15000`, binds `messageCount → receivedCount`, `lastMessage → lastEvent`
  3. `condition` — `{{receivedCount}} > 0`
     - true → `logDebug` "Received {{receivedCount}} live events via WebSocket" → `end`
     - false → `logDebug` (warn) "No events received — verify endpoint and transport" → `end`
- **Note:** The plan originally said `subscriptionTransport: 'ws'`, `maxMessages`, and `timeoutMs` — these are incorrect field names. Actual fields: `subscriptionTransport: 'graphql-ws'`, `stopAfterMessages`, `stopAfterMs`. Also, the plan mentioned `errorHandler` node for the false path — no standalone errorHandler node exists; use `logDebug` (warn) instead.
- **Tags:** `graphql`, `subscription`, `websocket`, `graphql-ws`, `streaming`, `events`, `real-time`
- **liveApis:** `(configurable GraphQL subscription endpoint)` — use `http://localhost:4000/graphql` as default
- **Purpose:** Teaches the `graphqlSubscription` node — key difference from queries, bounded collection, transport choice.

---

#### WF-GQL-05 · GraphQL Subscription over SSE (Medium)
- **ID:** `sample-graphql-subscription-sse`
- **Name:** `GraphQL: Subscription over SSE`
- **Category:** graphql / event-driven
- **Difficulty:** medium
- **Description:** Same structure as WF-GQL-04 but with `subscriptionTransport: 'sse'`. Some GraphQL servers (e.g. using `graphql-sse`) prefer SSE over WebSocket for subscriptions. Default endpoint uses `/stream` suffix (`http://localhost:4000/graphql/stream`) to illustrate that SSE servers often use a distinct path. Shows how to switch transports with a single field change.
- **Nodes (6):**
  1. `start`
  2. `graphqlSubscription` — `subscriptionTransport: 'sse'`, same subscription query, `stopAfterMessages: 5`, `stopAfterMs: 15000`
  3. `condition` + `logDebug` (info / warn) → `end`
- **Note:** Plan originally said `subscriptionTransport: 'sse'` — this is the correct value for SSE. Endpoint default changed to `http://localhost:4000/graphql/stream` to hint at the typical SSE path convention.
- **Tags:** `graphql`, `subscription`, `sse`, `server-sent-events`, `streaming`, `real-time`
- **Purpose:** Shows the `sse` transport variant and how it differs from the WS path — same node type, different transport field.

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
- **Nodes (7 total):**
  1. `start`
  2. `wsConnect` — `url: "wss://echo.websocket.org"`, `connectionId: "ws-echo"`, `timeoutMs: 5000`, `headers: []`, `queryParams: []`, `subprotocols: []`, `outputBindings: []`
  3. `wsSend` — `connectionId: "ws-echo"`, `message: "ping"`, `messageType: "text"`, `waitForResponse: false`, `responseTimeoutMs: 3000`, `outputBindings: []`
  4. `wsReceive` — `connectionId: "ws-echo"`, `timeoutMs: 5000`, `matchCriteria: { messageType: "text" }`, `extractionRules: []`, `outputBindings: [{ field: "messageBody", variableName: "receivedMessage", enabled: true }]`
  5. `condition` — `left: "{{receivedMessage}}"`, `operator: "=="`, `right: "ping"`
     - true → `end`
     - false → `logDebug` (warn) `"Echo mismatch: '{{receivedMessage}}'"` → `end`
  6. `logDebug` (warn) — see above
  7. `end`
- **Tags:** `websocket`, `echo`, `send`, `receive`, `easy`
- **liveApis:** `echo.websocket.org`
- **Purpose:** Simplest possible WS workflow — demonstrates the three core node types together.
- **⚠️ Plan corrections:** `connectionId` is a **literal string key** (`"ws-echo"`), not a variable binding. WsReceive extraction uses `outputBindings` with `field: "messageBody"`. `setVariable` "assert-like" replaced with proper `condition` node (+1 node = 7 total).

---

#### WF-WS-02 · WebSocket JSON Message Exchange (Easy)
- **ID:** `sample-ws-json-exchange`
- **Name:** `WebSocket: JSON Message Exchange`
- **Category:** websocket
- **Difficulty:** easy
- **Description:** Connect to a public Binance WebSocket stream, subscribe to BTC/USDT trade events, receive a trade message, extract the price, and assert it is greater than zero.
- **Nodes (7 total):**
  1. `start`
  2. `wsConnect` — `url: "wss://stream.binance.com:9443/stream"`, `connectionId: "ws-prices"`, `timeoutMs: 8000`, `headers: []`, `queryParams: []`, `subprotocols: []`
  3. `wsSend` — `connectionId: "ws-prices"`, `message: '{"method":"SUBSCRIBE","params":["btcusdt@trade"],"id":1}'`, `messageType: "text"`
  4. `wsReceive` — `connectionId: "ws-prices"`, `timeoutMs: 10000`, `matchCriteria: { jsonPathMatch: "$.data.e", jsonPathValue: "trade" }`, `extractionRules: [{ variableName: "latestPrice", jsonPath: "$.data.p" }]`
  5. `condition` — `left: "{{latestPrice}}"`, `operator: ">"`, `right: "0"`
     - true → `logDebug` (info) `"BTC price OK: ${{latestPrice}}"` → `end`
     - false → `end`
  6. `logDebug` (info) — see above
  7. `end`
- **Tags:** `websocket`, `json`, `subscribe`, `extract`, `easy`
- **liveApis:** `stream.binance.com`
- **Purpose:** Teaches JSON parsing in WS receive + `extractionRules`-based variable extraction from message body.
- **⚠️ Plan corrections:** `grpcAssert` replaced with `condition` node. `extractionRules` (not "binds" shorthand) used for extraction. JSON path updated to `$.data.p` to match Binance stream-combined format. Node count: 7.

---

#### WF-WS-03 · WebSocket Chat — Send, Receive, Assert (Medium)
- **ID:** `sample-ws-chat-flow`
- **Name:** `WebSocket: Chat Flow`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Connect to a WS chat endpoint, send an authentication message, receive acknowledgement, send a chat message, receive the broadcast echo, assert message content.
- **Nodes (9 total):**
  1. `start`
  2. `wsConnect` — `url: "wss://{{wsHost}}/chat"`, `connectionId: "ws-chat"`, `timeoutMs: 5000`
  3. `wsSend` — `connectionId: "ws-chat"`, `message: '{"type":"auth","token":"{{authToken}}"}'`, `messageType: "text"`
  4. `wsReceive` — `connectionId: "ws-chat"`, `timeoutMs: 3000`, `matchCriteria: { jsonPathMatch: "$.type", jsonPathValue: "auth_ok", messageType: "text" }`, `extractionRules: []`
  5. `wsSend` — `connectionId: "ws-chat"`, `message: '{"type":"message","room":"general","text":"Hello from workflow"}'`, `messageType: "text"`
  6. `wsReceive` — `connectionId: "ws-chat"`, `timeoutMs: 5000`, `matchCriteria: { jsonPathMatch: "$.type", jsonPathValue: "message" }`, `extractionRules: [{ variableName: "receivedText", jsonPath: "$.text" }]`
  7. `condition` — `left: "{{receivedText}}"`, `operator: "=="`, `right: "Hello from workflow"`
     - true → `end`
     - false → `logDebug` (warn) `"Chat echo mismatch: '{{receivedText}}'"` → `end`
  8. `logDebug` (warn) — see above
  9. `end`
- **Tags:** `websocket`, `auth`, `chat`, `send-receive`, `conditional`
- **liveApis:** `(configurable WebSocket endpoint)`
- **Purpose:** Shows multi-step WS interaction with auth handshake, conditional branching on message content.
- **⚠️ Plan corrections:** `matchCriteria` uses `jsonPathMatch`/`jsonPathValue` (not `$.type === "auth_ok"` expression). Condition false → `logDebug` (warn) instead of `errorHandler`. Node count: 9.

---

#### WF-WS-04 · WebSocket Trigger — React to Inbound Event (Medium)
- **ID:** `sample-ws-trigger`
- **Name:** `WebSocket: Inbound Trigger`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Workflow starts when a WebSocket message arrives (`wsTrigger`). Extracts the event payload and makes a downstream HTTP GET call based on the event data.
- **Nodes (6 total):**
  1. `wsTrigger` — `url: "wss://{{wsHost}}/events"`, `connectionId: "ws-trigger"`, `matchCriteria: { jsonPathMatch: "$.event", jsonPathValue: "order.created", messageType: "text" }`, `extractionRules: [{ variableName: "orderId", jsonPath: "$.data.orderId" }, { variableName: "customerId", jsonPath: "$.data.customerId" }]`
  2. `http` — `GET https://jsonplaceholder.typicode.com/todos/{{orderId}}`
  3. `condition` — `left: "{{status}}"`, `operator: "=="`, `right: "confirmed"`
     - true → `logDebug` (info) `"Order {{orderId}} confirmed"` → `end`
     - false → `logDebug` (warn) `"Order {{orderId}} not confirmed"` → `end`
  4. `logDebug` (info) — see above
  5. `logDebug` (warn) — see above
  6. `end`
- **Tags:** `websocket`, `trigger`, `inbound`, `event-driven`, `http`
- **liveApis:** `jsonplaceholder.typicode.com`
- **Purpose:** Demonstrates `wsTrigger` as a workflow entry point; bridges WS events to HTTP downstream calls.
- **⚠️ Plan corrections:** `wsTrigger` uses `matchCriteria: {jsonPathMatch, jsonPathValue}` and `extractionRules` (not expression-style filter). HTTP uses JSONPlaceholder. Condition false → `logDebug` (warn) not `errorHandler`. Node count: 6.

---

#### WF-WS-05 · WebSocket + HTTP Hybrid — Live Pricing Pipeline (Advanced)
- **ID:** `sample-ws-http-hybrid`
- **Name:** `WebSocket: Live Price → HTTP Enrichment`
- **Category:** websocket
- **Difficulty:** advanced
- **Description:** Connect to a live price feed, wait for a price drop event, extract the product ID, call an HTTP API to get product details, and send a notification back over the same connection.
- **Nodes (8 total):**
  1. `start`
  2. `wsConnect` — `url: "wss://{{priceWsUrl}}"`, `connectionId: "ws-prices"`, `timeoutMs: 8000`, `headers: []`, `queryParams: []`, `subprotocols: []`, `outputBindings: []`
  3. `wsSend` — `connectionId: "ws-prices"`, `message: '{"type":"subscribe","channel":"price_alerts"}'`, `messageType: "text"`
  4. `wsReceive` — `connectionId: "ws-prices"`, `timeoutMs: 30000`, `matchCriteria: { jsonPathMatch: "$.type", jsonPathValue: "price_drop" }`, `extractionRules: [{ variableName: "productId", jsonPath: "$.data.productId" }, { variableName: "newPrice", jsonPath: "$.data.price" }]`
  5. `http` — `GET https://fakestoreapi.com/products/{{productId}}`
  6. `setVariable` — `name: "alertMessage"`, `value: "Price drop: {{productId}} now ${{newPrice}}"`
  7. `wsSend` — `connectionId: "ws-prices"`, `message: '{"type":"ack","productId":"{{productId}}","alert":"{{alertMessage}}"}'`, `messageType: "text"`
  8. `end`
- **Tags:** `websocket`, `http`, `hybrid`, `event-driven`, `enrichment`, `advanced`
- **liveApis:** `fakestoreapi.com`
- **Purpose:** Advanced pattern — WS event triggers HTTP enrichment, then WS send for acknowledgement. Uses all three WS node types plus HTTP in one workflow.
- **⚠️ Plan corrections:** `wsReceive` uses `extractionRules` (not "bind" shorthand). `setVariable` uses `{ id, name, expression }` fields (`expression` not `value`). `wsSend` ack uses same `connectionId`. Node count: 8.

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

**2 planned entries (✅ implemented):**

---

#### TG-GQL-01 · GraphQL Health Check Test (Easy) ✅
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

#### TG-GQL-02 · GraphQL Query + Mutation Flow (Medium) ✅
- **ID:** `test-graphql-crud`
- **Name:** `GraphQL: Query & Mutation`
- **Category:** graphql
- **Difficulty:** medium
- **Description:** Two scenarios — one queries a list of items, the second runs a mutation.
- **Scenarios:**
  - `sc-gql-query`: `query { posts { data { id title } } }` — assert arrayLength ≥ 1 on `$.data.posts.data`
  - `sc-gql-mutation`: `mutation createPost` — assert `$.data.createPost.id` exists
- **Tags:** `graphql`, `query`, `mutation`, `crud`
- **liveApis:** `graphqlzero.almansi.me` (plan said dummyjson.com/graphql but GraphQLZero has a stable public mutation API)
- **Correction:** Plan listed `dummyjson.com/graphql` — actual implementation uses `graphqlzero.almansi.me/api` (consistent with RQ-GQL-03)

---

### 3b. gRPC Test Scenarios (new file `galleries/tests/presets-grpc.ts`) ✅

**2 implemented entries:**

---

#### TG-GRPC-01 · gRPC Unary Smoke Test (Easy) ✅
- **ID:** `test-grpc-health`
- **Name:** `gRPC: Unary Smoke Test`
- **Category:** grpc (added to `TestCategory` union)
- **Difficulty:** easy
- **Description:** Single scenario: call `grpc.health.v1.Health/Check`, assert gRPC status 0 and `$.status === "SERVING"`.
- **Correction:** Plan said `transport: 'grpcUnary'` — actual type is `actionType: 'grpcCall'` with `grpcCallAction.callType: 'unary'`. Plan said `GalleryDomain` needs 'grpc' — incorrect, test gallery entries all use `domain: 'tests'`. TestCategory extended with `'grpc'`.
- **Tags:** `grpc`, `health`, `unary`, `smoke`
- **liveApis:** `grpcb.in` (plan said `grpc.postman.co` but grpcb.in is the correct reflection-enabled public test server)

---

#### TG-GRPC-02 · gRPC CRUD Scenario (Medium) ✅
- **ID:** `test-grpc-crud`
- **Name:** `gRPC: CRUD Scenarios`
- **Category:** grpc
- **Difficulty:** medium
- **Description:** Three scenarios demonstrating Get/Create/Delete patterns using `grpcb.in:443` helloworld.Greeter and Health services as proxies (replace with your own service). Variable extraction on GetUser.
- **Tags:** `grpc`, `crud`, `unary`, `variables`

---

### 3c. WebSocket Test Scenarios (new file `galleries/tests/presets-websocket.ts`) ✅

**2 implemented entries:**

---

#### TG-WS-01 · WebSocket Echo Test (Easy) ✅
- **ID:** `test-ws-echo`
- **Name:** `WebSocket: Echo Smoke Test`
- **Category:** websocket (added to `TestCategory` union)
- **Difficulty:** easy
- **Description:** Three-scenario test: wsConnect → wsSend "ping" → wsReceive assert `ws.body === "ping"`. `method: 'WEBSOCKET'`, `actionType: 'wsConnect'`/`wsSend`/`wsReceive`.
- **Correction:** `transport` field does not exist on Scenario; correct fields are `actionType` + dedicated action config (`wsConnectAction`, etc.). URL validation in `tests.test.ts` updated to allow `wss://`.
- **Tags:** `websocket`, `echo`, `smoke`
- **liveApis:** `echo.websocket.org`

---

#### TG-WS-02 · WebSocket JSON Subscribe (Medium) ✅
- **ID:** `test-ws-subscribe`
- **Name:** `WebSocket: JSON Subscribe & Assert`
- **Category:** websocket
- **Difficulty:** medium
- **Description:** Two-scenario test: wsConnect + wsReceive first message from Binance BTC/USDT trade stream. Assert `ws.$.e` exists and `ws.$.s === "BTCUSDT"`. Extracts `tradePrice` and `tradeEventType`.
- **Correction:** Plan said assert `$.type` and `$.data` — Binance messages have `$.e` (event) and `$.s` (symbol), not `$.type`/`$.data`.
- **Tags:** `websocket`, `json`, `subscribe`, `binance`
- **liveApis:** `stream.binance.com`

---

## Part 4 — Missing Requests Gallery Samples

### 4a. GraphQL Request Samples (add to `galleries/requests/presets.ts`)

All 13 original request entries were HTTP REST. A GraphQL query is technically a POST request, so it fits naturally in the requests gallery. `RequestCategory` extended with `'graphql'`.

**3 planned entries (✅ implemented):**

---

#### RQ-GQL-01 · GraphQL Introspection Query (Easy) ✅
- **ID:** `req-graphql-introspect`
- **Name:** `GraphQL Introspection`
- **Category:** graphql
- **Difficulty:** easy
- **Description:** POST `{ "query": "{ __typename }" }` to a public GraphQL endpoint. Shows how a GraphQL request differs from REST.
- **URL:** `https://countries.trevorblades.com/graphql`
- **Method:** POST
- **Body:** `{ "query": "{ __typename }" }`
- **Tags:** `graphql`, `introspection`, `post`
- **Validation:** status 200, `$.data` exists, `$.errors` absent

---

#### RQ-GQL-02 · GraphQL Query — Country Info (Easy) ✅
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
- **Validation:** status 200, `$.data.country` exists, name matches regex `.+`

---

#### RQ-GQL-03 · GraphQL Mutation (Medium) ✅
- **ID:** `req-graphql-mutation`
- **Name:** `GraphQL: Add Post Mutation`
- **Category:** graphql
- **Difficulty:** medium
- **Description:** A mutation that creates a post via the GraphQLZero endpoint.
- **URL:** `https://graphqlzero.almansi.me/api` (changed from `dummyjson.com` — GraphQLZero has a stable public mutation API)
- **Tags:** `graphql`, `mutation`, `create`
- **Validation:** status 200, `$.data.createPost.id` exists, `$.errors` absent

---

## Part 5 — Missing Assertion Gallery Samples

### 5a. GraphQL Assertions (add to `galleries/assertion-presets/presets.ts` + `index.ts`)

**2 planned entries (✅ implemented):**

---

#### AP-GQL-01 · GraphQL No Errors Guard (Easy) ✅
- **ID:** `preset-graphql-no-errors`
- **Name:** `GraphQL No Errors Guard`
- **Category:** api-validation
- **Difficulty:** easy
- **Description:** Three assertions: status 200, `$.errors` absent, `$.data` exists.
- **Assertion Types:** `status`, `existence`
- **Tags:** `graphql`, `errors`, `contract`

---

#### AP-GQL-02 · GraphQL Data Shape (Medium) ✅
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
  A1. ✅ Add 'grpc' | 'websocket' to GalleryDomain type (types.ts)
  A2. ✅ Register grpc + websocket domains in registry.ts
  A3. ✅ Create src/data/galleries/grpc/ directory + scaffold (GrpcSampleEntry type + empty catalog)
  A4. ✅ Create src/data/galleries/websocket/ directory + scaffold (WsSampleEntry type + empty catalog)
  Also updated: GalleryPage.tsx (ACTION_LABELS, importHandlers, ALL_ENTRIES), DomainBadge.tsx (DOMAIN_COLORS)

Phase B — Workflow Samples (3-4 days)
  B1. ✅ Create galleries/workflows/grpc.ts (6 entries: WF-GRPC-01 → WF-GRPC-06)
  B2. ✅ Create galleries/workflows/websocket.ts (5 entries: WF-WS-01 → WF-WS-05)
  B3. ✅ Add WF-GQL-04 + WF-GQL-05 to galleries/workflows/graphql.ts (subscription samples)
  B4. ✅ Register new files in galleries/workflows/index.ts (all done: grpc.ts, websocket.ts, subscription entries)
  B5. ✅ Write unit tests: galleries/workflows/grpc.test.ts + websocket.test.ts done
  B6. ✅ Added 'grpc' + 'websocket' to SampleCategory + TemplateGalleryModal CATEGORIES filter tabs

Phase C — Test Gallery Samples (2-3 days)
  C1. ✅ Create galleries/tests/presets-graphql.ts (TG-GQL-01, TG-GQL-02) — separate file, not added to existing presets.ts
  C2. ✅ Create galleries/tests/presets-grpc.ts (TG-GRPC-01, TG-GRPC-02)
  C3. ✅ Create galleries/tests/presets-websocket.ts (TG-WS-01, TG-WS-02)
  C4. ✅ Register all new files in galleries/tests/index.ts (23 → 29 entries)
  C5. ✅ Write unit tests: presets-graphql.test.ts, presets-grpc.test.ts, presets-websocket.test.ts

Phase D — Requests + Assertions + API Mock Samples (2-3 days)
  D1. ✅ Add GraphQL request entries to galleries/requests/presets.ts (RQ-GQL-01 → RQ-GQL-03)
  D2. ✅ Add GraphQL assertion entries to galleries/assertion-presets/presets.ts + index.ts
  D3. ✅ Add createAuthGatedMock() to galleries/api-mock/presets-matching.ts (AM-AUTH-01)
  D4. ✅ Add createGraphQLMock() to galleries/api-mock/presets-matching.ts (AM-GQL-01)
  D5. ✅ Create galleries/api-mock/presets-state.ts with order flow sample (AM-STATE-01)
  D6. ✅ Create galleries/api-mock/presets-webhook.ts with webhook receiver sample (AM-WH-01)
  D7. ✅ Create galleries/api-mock/presets-callbacks.ts with outbound callbacks sample (AM-CALLBACK-01)
  D8. ✅ Register new API mock entries in galleries/api-mock/index.ts
  D9. Run gallery-loaded-badge.spec.ts + gallery.spec.ts E2E to verify all new entries render

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
| Match `POST /graphql` by body `$.query` content | ✅ `body` source + `jsonPath_equals` operator works today | ✅ `am-gallery-graphql` |
| Receive inbound webhook POST, inspect payload | ✅ any route captures body; `json_subset` / `jsonPath_equals` predicates work | ✅ `am-gallery-webhook` |
| Gate routes by Bearer / API Key security predicates | ✅ `security` source with `scheme`/`apiKeyName` operators | ✅ `am-gallery-auth-gated` |
| Stateful order lifecycle (idle→pending→paid→complete) | ✅ `responseMode: 'state'` + `transition` field | ✅ `am-gallery-order-flow` |
| Fire outbound callback after match | ✅ Phase 9D `callbacks` field on `ApiMockResponseVariantV1` | ✅ `am-gallery-callbacks` |
| Verify inbound HMAC signature (`X-Hub-Signature-256`) | ❌ `security` source only covers scheme/username/tokenClaim/apiKey/certSubject — no digest/HMAC operator | — needs new feature |

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

### 6e. Outbound Callbacks (new entry in `galleries/api-mock/presets-simulation.ts` or new file `presets-callbacks.ts`)

**1 planned entry:**

---

#### AM-CALLBACK-01 · Outbound Callbacks After Match (Medium)
- **ID:** `am-gallery-callbacks`
- **Name:** `Outbound callbacks`
- **Category:** `simulation`
- **Difficulty:** medium
- **Description:** Demonstrates the Phase 9D `callbacks` field on `ApiMockResponseVariantV1`. When `POST /checkout` is matched, the mock delivers a `200` response **and** fires a fire-and-forget `POST` to a configured webhook URL with a templated payload. A second route shows callback retry configuration (`maxRetries: 3`, `retryDelayMs: 500`). The sample uses `{{body.orderId}}` template interpolation in the callback body so the outbound event mirrors the inbound request data.
- **Routes:**
  1. `POST /checkout` — response: `{ "received": true }` (200); `callbacks: [{ url: "https://example.com/notify", method: "POST", body: "{ \"event\": \"checkout\", \"orderId\": \"{{body.orderId}}\" }" }]`
  2. `POST /checkout/retry` — same response; `callbacks` with `maxRetries: 3`, `retryDelayMs: 500` to demonstrate retry config
- **routeCount:** 2
- **teaches:** `['callbacks', 'outbound-webhook', 'template-interpolation', 'fire-and-forget', 'retry-config']`
- **Tags:** `callbacks`, `webhook`, `outbound`, `template`, `phase-9d`
- **Source file:** add `createCallbacksMock()` to `presets-simulation.ts` or new `presets-callbacks.ts`, register in `index.ts`

---

### 6f. Engine Feature Gap — Inbound HMAC Signature Verification

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
| **Workflows (GraphQL Subscription)** | **2** | **B** |
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
| **API Mock (Outbound callbacks)** | **1** | **D** |
| **Total** | **31** | |

### Engine Feature Required Before Full Webhook Sample

| Feature | Files | Blocked samples |
|---------|-------|-----------------|
| `hmac_sha256` predicate operator | `contracts.ts`, `predicateEvaluatorHelpers.ts`, `validation.ts`, `ApiMockRouteEditor.tsx` | AM-WH-01 (signature variant) |
