# Kafka Integration Plan — Full First-Class Support

> Produce, consume, trigger workflows, wait for messages, load-test Kafka topics
> Created: 2026-05-21 (v0.5.9-beta.2)
> Re-evaluated: 2026-05-21 — expanded to detailed implementation steps per phase

---

## Goals

Make Kafka a **first-class citizen** alongside HTTP:

| Use Case | Description |
|----------|-------------|
| **Kafka as test target** | Produce/consume as the primary test action (like HTTP but for Kafka) |
| **Trigger workflows from Kafka** | Consume a message → seed variables → execute workflow |
| **KafkaWait (correlation)** | Pause workflow → wait for a Kafka message matching a pattern → resume |
| **Publish test results** | After test runs, publish results/metrics to a Kafka topic |
| **Trigger scenarios from Kafka** | Consume a message, use payload as input, execute HTTP scenarios |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Tauri UI                     │
│                                                           │
│  Workflow Designer    Test Runner    Results Explorer      │
│  ┌──────────────┐   ┌──────────┐   ┌──────────────┐     │
│  │ KafkaProduce │   │ Kafka    │   │ Kafka result  │     │
│  │ KafkaConsume │   │ scenario │   │ details       │     │
│  │ KafkaTrigger │   │ runner   │   │               │     │
│  │ KafkaWait    │   │          │   │               │     │
│  └──────┬───────┘   └────┬─────┘   └───────────────┘     │
│         │                │                                 │
│         ▼                ▼                                 │
│  ┌──────────────────────────────────┐                     │
│  │    kafkaClient.ts (transport)    │                     │
│  │    Platform-aware dispatcher     │                     │
│  └──────┬───────────┬───────────────┘                     │
│         │           │                                      │
├─────────┼───────────┼──────────────────────────────────────┤
│ Tauri   │  Browser  │                                      │
│ Desktop │  / Dev    │                                      │
│         │           │                                      │
│    ┌────▼────┐ ┌────▼──────────┐                          │
│    │ Rust    │ │ src-server    │                          │
│    │ rdkafka │ │ :3001         │                          │
│    │ via     │ │               │                          │
│    │ invoke  │ │ /api/kafka/*  │                          │
│    └─────────┘ │ kafkajs       │                          │
│                └───────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

### Transport Selection (mirrors httpClient.ts L133-164 pattern)

| Platform | Transport | Library |
|----------|-----------|---------|
| **Tauri desktop** | `invoke("kafka_produce")`, `invoke("kafka_consume")` | Rust `rdkafka` 0.39 |
| **Browser (dev)** | `POST /api/kafka/produce`, `GET /api/kafka/consume` → SSE | `kafkajs` 2.2.4 in src-server |
| **Node CLI** | Direct `kafkajs` | `kafkajs` 2.2.4 |

### Dependencies

| Package | Where | Version | Purpose |
|---------|-------|---------|---------|
| `kafkajs` | root `package.json` (src-server uses root deps) | ^2.2.4 | Node Kafka client |
| `@kafkajs/confluent-schema-registry` | root `package.json` | ^4.0.8 | Avro/Protobuf schema support (optional Phase 10) |
| `rdkafka` | `src-tauri/Cargo.toml` | 0.39 | Rust Kafka client (Phase 8) |

---

## Phase 1 — Server-Side Kafka Service (Foundation)

**Effort**: 3-4 days
**Prerequisite**: None
**Risk**: Low — isolated module, no existing code changes

### Step 1.1 — Install `kafkajs`

```bash
npm install kafkajs
```

Verify in `package.json` under `dependencies` (not devDependencies — src-server uses it at runtime).

### Step 1.2 — Create Kafka Types (`src-server/kafka-types.ts`)

```typescript
// ── Connection ──────────────────────────────────────

export interface KafkaConnectionConfig {
  brokers: string[];          // e.g. ["localhost:9092", "kafka2:9092"]
  clientId?: string;          // default: "redfire-forge"
  ssl?: boolean | KafkaTlsConfig;
  sasl?: KafkaSaslConfig;
  connectionTimeout?: number; // default: 10_000ms
  requestTimeout?: number;    // default: 30_000ms
}

export interface KafkaSaslConfig {
  mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  username: string;
  password: string;
}

export interface KafkaTlsConfig {
  rejectUnauthorized?: boolean;
  ca?: string;    // PEM cert string
  cert?: string;  // client cert (mTLS)
  key?: string;   // client key (mTLS)
}

// ── Messages ────────────────────────────────────────

export interface KafkaOutboundMessage {
  key?: string;
  value: string;             // JSON-serialized by caller
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;        // epoch ms string
}

export interface KafkaInboundMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
  timestamp: string;         // epoch ms
}

// ── Produce ─────────────────────────────────────────

export interface KafkaProduceRequest {
  topic: string;
  messages: KafkaOutboundMessage[];
  acks?: -1 | 0 | 1;        // default: -1 (all)
  timeout?: number;          // producer timeout ms
}

export interface KafkaProduceResult {
  topicName: string;
  partition: number;
  baseOffset: string;
  errorCode: number;
  logAppendTime: string;
  logStartOffset: string;
  durationMs: number;
}

// ── Consume ─────────────────────────────────────────

export interface KafkaConsumeRequest {
  topic: string;
  groupId?: string;           // auto-generated if empty
  maxMessages?: number;       // default: 1
  timeoutMs?: number;         // default: 10_000
  fromBeginning?: boolean;    // default: false
  filter?: KafkaMessageFilter;
}

export interface KafkaMessageFilter {
  keyPattern?: string;        // regex on key
  headerMatch?: Record<string, string>;
  jsonPathMatch?: { path: string; value: string };
}

export interface KafkaConsumeResult {
  messages: KafkaInboundMessage[];
  durationMs: number;
}

// ── Subscription (streaming) ────────────────────────

export interface KafkaSubscription {
  id: string;
  topic: string;
  groupId: string;
  createdAt: number;
  status: 'active' | 'paused' | 'stopped';
  messagesReceived: number;
}
```

### Step 1.3 — Create Kafka Service (`src-server/kafka-service.ts`)

Singleton module managing kafkajs lifecycle.

```typescript
import { Kafka, Producer, Consumer, logLevel, Admin } from 'kafkajs';
import type { KafkaConnectionConfig, KafkaProduceRequest, KafkaProduceResult,
  KafkaConsumeRequest, KafkaConsumeResult, KafkaInboundMessage,
  KafkaSubscription } from './kafka-types.js';

// ── State ───────────────────────────────────────────

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let admin: Admin | null = null;
const activeSubscriptions = new Map<string, {
  consumer: Consumer;
  abort: AbortController;
  meta: KafkaSubscription;
}>();

// ── Connection ──────────────────────────────────────

export async function connectKafka(config: KafkaConnectionConfig): Promise<void> {
  // 1. Create Kafka instance with config
  // 2. Create + connect admin client (for topic listing)
  // 3. Create + connect producer (reused for all produce calls)
  // 4. Verify connectivity by fetching cluster metadata
  //    admin.describeCluster() → throw if unreachable
}

export async function disconnectKafka(): Promise<void> {
  // 1. Stop all active subscriptions (iterate Map, abort each)
  // 2. Disconnect producer
  // 3. Disconnect admin
  // 4. Null out all references
}

export function isKafkaConnected(): boolean {
  return kafka !== null && producer !== null;
}

// ── Admin ───────────────────────────────────────────

export async function listTopics(): Promise<string[]> {
  // admin.listTopics() → filter out internal topics (__consumer_offsets, etc.)
}

export async function describeCluster(): Promise<{
  brokers: Array<{ nodeId: number; host: string; port: number }>;
  clusterId: string;
}> {
  // admin.describeCluster()
}

// ── Produce ─────────────────────────────────────────

export async function produce(req: KafkaProduceRequest): Promise<KafkaProduceResult[]> {
  // 1. Validate producer is connected (throw if not)
  // 2. Map messages to kafkajs format:
  //    { key: Buffer.from(m.key), value: Buffer.from(m.value),
  //      headers: mapHeaders(m.headers), partition: m.partition }
  // 3. producer.send({ topic, messages, acks, timeout })
  // 4. Map RecordMetadata[] → KafkaProduceResult[]
  // 5. Record timing
}

// ── Consume (one-shot) ──────────────────────────────

export async function consumeOnce(req: KafkaConsumeRequest): Promise<KafkaConsumeResult> {
  // 1. Create temporary consumer with unique groupId
  //    (req.groupId || `redfire-oneshot-${randomUUID()}`)
  // 2. consumer.connect()
  // 3. consumer.subscribe({ topic, fromBeginning })
  // 4. Collect messages via consumer.run({ eachMessage })
  //    - Apply filter (keyPattern regex, headerMatch, jsonPathMatch)
  //    - Push to result array until maxMessages reached
  // 5. Race with timeout (setTimeout → consumer.disconnect)
  // 6. consumer.disconnect()
  // 7. Return { messages, durationMs }
  //
  // IMPORTANT: Must handle consumer rebalance delay —
  // kafkajs takes ~3-5s for initial partition assignment.
  // Use consumer.seek() after assignment if fromBeginning is false
  // and we want latest-only.
}

// ── Subscribe (streaming) ───────────────────────────

export async function subscribe(
  topic: string,
  groupId: string,
  onMessage: (msg: KafkaInboundMessage) => void,
  filter?: KafkaMessageFilter,
): Promise<string> {
  // 1. Generate subscription ID
  // 2. Create consumer with provided groupId
  // 3. consumer.connect() + consumer.subscribe({ topic })
  // 4. consumer.run({ eachMessage }) → filter → onMessage()
  // 5. Store in activeSubscriptions Map
  // 6. Return subscription ID
}

export async function unsubscribe(subscriptionId: string): Promise<boolean> {
  // 1. Look up in activeSubscriptions
  // 2. consumer.stop() + consumer.disconnect()
  // 3. Remove from Map
}

export function getSubscription(id: string): KafkaSubscription | undefined {
  // Return meta from activeSubscriptions
}

export function listSubscriptions(): KafkaSubscription[] {
  // Return all meta values
}
```

### Step 1.4 — Create REST Routes (`src-server/kafka-routes.ts`)

Mirror `createCorrelationRouter()` pattern from `src-server/correlation-handler.ts`.

```typescript
import { Router, type Request, type Response } from 'express';
import * as kafkaService from './kafka-service.js';
import type { LogLine } from '../src/shared/types/server-api';

export function createKafkaRouter(
  broadcastLog: (line: LogLine) => void,
): Router {
  const router = Router();

  // ── POST /api/kafka/connect ───────────────────────
  // Body: KafkaConnectionConfig
  // Response: { ok: true, brokers: [...], clusterId: "..." }
  // Error: { ok: false, error: "Connection failed: ..." }
  router.post('/api/kafka/connect', async (req: Request, res: Response) => {
    try {
      await kafkaService.connectKafka(req.body);
      const cluster = await kafkaService.describeCluster();
      broadcastLog({ level: 'info', source: 'kafka', message: `Connected to Kafka cluster ${cluster.clusterId} (${cluster.brokers.length} brokers)`, timestamp: Date.now() });
      res.json({ ok: true, ...cluster });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── DELETE /api/kafka/connect ─────────────────────
  // Response: { ok: true }
  router.delete('/api/kafka/connect', async (_req: Request, res: Response) => {
    await kafkaService.disconnectKafka();
    broadcastLog({ level: 'info', source: 'kafka', message: 'Disconnected from Kafka', timestamp: Date.now() });
    res.json({ ok: true });
  });

  // ── GET /api/kafka/status ─────────────────────────
  // Response: { connected: boolean, topics?: string[], subscriptions: [...] }
  router.get('/api/kafka/status', async (_req: Request, res: Response) => {
    const connected = kafkaService.isKafkaConnected();
    const topics = connected ? await kafkaService.listTopics() : [];
    const subscriptions = kafkaService.listSubscriptions();
    res.json({ connected, topics, subscriptions });
  });

  // ── POST /api/kafka/produce ───────────────────────
  // Body: KafkaProduceRequest
  // Response: { ok: true, offsets: KafkaProduceResult[], durationMs: number }
  router.post('/api/kafka/produce', async (req: Request, res: Response) => {
    const start = performance.now();
    try {
      const offsets = await kafkaService.produce(req.body);
      broadcastLog({ level: 'debug', source: 'kafka', message: `Produced ${req.body.messages?.length ?? 0} message(s) to ${req.body.topic}`, timestamp: Date.now() });
      res.json({ ok: true, offsets, durationMs: performance.now() - start });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST /api/kafka/consume ───────────────────────
  // Body: KafkaConsumeRequest
  // Response: KafkaConsumeResult
  router.post('/api/kafka/consume', async (req: Request, res: Response) => {
    try {
      const result = await kafkaService.consumeOnce(req.body);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST /api/kafka/subscribe ─────────────────────
  // Body: { topic: string, groupId: string, filter?: KafkaMessageFilter }
  // Response: { subscriptionId: string }
  router.post('/api/kafka/subscribe', async (req: Request, res: Response) => {
    const { topic, groupId, filter } = req.body;
    // onMessage is a no-op here; SSE endpoint delivers messages
    const id = await kafkaService.subscribe(topic, groupId, () => {}, filter);
    res.json({ ok: true, subscriptionId: id });
  });

  // ── GET /api/kafka/subscribe/:id ──────────────────
  // SSE stream of messages
  // Each event: data: JSON(KafkaInboundMessage)
  router.get('/api/kafka/subscribe/:id', (req: Request, res: Response) => {
    const sub = kafkaService.getSubscription(req.params.id);
    if (!sub) { res.status(404).json({ error: 'Subscription not found' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // TODO: Wire subscription's onMessage → SSE events
    // On close: unsubscribe
    req.on('close', () => {
      kafkaService.unsubscribe(req.params.id);
    });
  });

  // ── DELETE /api/kafka/subscribe/:id ────────────────
  router.delete('/api/kafka/subscribe/:id', async (req: Request, res: Response) => {
    const ok = await kafkaService.unsubscribe(req.params.id);
    res.json({ ok });
  });

  // ── GET /api/kafka/topics ─────────────────────────
  // Response: { topics: string[] }
  router.get('/api/kafka/topics', async (_req: Request, res: Response) => {
    try {
      const topics = await kafkaService.listTopics();
      res.json({ ok: true, topics });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  return router;
}
```

### Step 1.5 — Wire into Webhook Server

**File**: `src-server/webhook-server.ts`

Add after line 122 (`app.use(createCorrelationRouter())`):

```typescript
import { createKafkaRouter } from './kafka-routes.js';
// After correlation router mount:
app.use(createKafkaRouter(broadcastLog));
```

### Step 1.6 — Unit Tests

**File**: `src-server/kafka-service.test.ts`

| Test Group | Cases |
|------------|-------|
| Connection | connect succeeds, connect fails (bad broker), disconnect cleans up, isConnected state |
| Produce | single message, batch messages, with headers, with key, producer not connected → error |
| Consume | one-shot consume, timeout behavior, filter by key regex, filter by header, fromBeginning, empty topic |
| Subscribe | create subscription, duplicate groupId handling, unsubscribe cleans consumer, list subscriptions |
| Admin | listTopics filters internals, describeCluster returns broker info |

**File**: `src-server/kafka-routes.test.ts`

| Test Group | Cases |
|------------|-------|
| POST /api/kafka/connect | success → 200, bad config → 500 |
| DELETE /api/kafka/connect | disconnect → 200 |
| GET /api/kafka/status | connected state, disconnected state |
| POST /api/kafka/produce | produce success, not connected → 500 |
| POST /api/kafka/consume | consume success, timeout → partial results |
| POST /api/kafka/subscribe | creates subscription |
| GET /api/kafka/subscribe/:id | SSE stream established |
| DELETE /api/kafka/subscribe/:id | removes subscription |

Mock `kafkajs` entirely — no real broker needed for unit tests.

### Step 1.7 — Build Script Update

**File**: `scripts/build-server.mjs`

Add `kafkajs` to externals array (lines 7-14) alongside `express` and `node-cron`:

```javascript
external: ['express', 'node-cron', 'kafkajs'],
```

---

## Phase 2 — Kafka Configuration UI

**Effort**: 2-3 days
**Prerequisite**: Phase 1 (server routes exist)

### Step 2.1 — Shared Kafka Config Types (`src/shared/types/index.ts`)

Add after the existing `EnvironmentConfig`-related types:

```typescript
// ── Kafka Configuration ─────────────────────────────

export interface KafkaClusterConfig {
  id: string;
  name: string;               // "Local Dev Kafka", "Staging Kafka"
  brokers: string[];           // ["localhost:9092"]
  clientId?: string;           // default: "redfire-forge"
  auth: KafkaAuthConfig;
  ssl: KafkaSslConfig;
  /** Auto-connect when app starts. */
  autoConnect?: boolean;
  /** Publish test results to this topic (Phase 7). */
  resultsTopic?: string;
  resultsEnabled?: boolean;
}

export interface KafkaAuthConfig {
  type: 'none' | 'plain' | 'scram-sha-256' | 'scram-sha-512';
  username?: string;
  password?: string;
}

export interface KafkaSslConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  caCert?: string;             // PEM string
  clientCert?: string;         // mTLS
  clientKey?: string;          // mTLS
}
```

### Step 2.2 — Storage Layer (`src/utils/storage.ts`)

Add Kafka config persistence functions mirroring existing `loadEnvironments`/`saveEnvironments`:

```typescript
export async function loadKafkaClusters(): Promise<KafkaClusterConfig[]> { ... }
export async function saveKafkaClusters(clusters: KafkaClusterConfig[]): Promise<void> { ... }
```

Storage key: `'kafka-clusters'`.

### Step 2.3 — App State Wiring (`src/app/App.tsx`)

1. Add `kafkaClusters` / `setKafkaClusters` state (useState)
2. Load on mount via `loadKafkaClusters()` (in existing init useEffect)
3. Pass as props to new `KafkaSettingsPage`

### Step 2.4 — Settings Tab Registration

**File**: `src/app/utils/appTabUtils.ts`
- Add `'kafka'` to `Tab` union type
- Add to `SETTINGS_TABS` set
- Add to `ALL_TABS` set

**File**: `src/app/components/AppSubNav.tsx`
- Add button in settings domain block (after line 49):
  ```tsx
  <button className={`sub-nav-tab ${activeTab === 'kafka' ? 'active' : ''}`}
          onClick={() => setActiveTab('kafka')}>Kafka</button>
  ```

**File**: `src/app/App.tsx`
- Add content pane: `{activeTab === 'kafka' && <KafkaSettingsPage ... />}`

### Step 2.5 — Kafka Settings Page (`src/features/kafka/KafkaSettingsPage.tsx`)

**Layout** (mirrors EnvironmentManager structure):

```
┌──────────────────────────────────────────────────┐
│  Kafka Clusters                          [+ Add] │
│  ┌─────────────────────────────────────────────┐ │
│  │ ● Local Dev Kafka      [Test] [Edit] [🗑]   │ │
│  │   brokers: localhost:9092                    │ │
│  │   auth: none | status: Connected ✓          │ │
│  ├─────────────────────────────────────────────┤ │
│  │ ○ Staging Kafka         [Test] [Edit] [🗑]   │ │
│  │   brokers: kafka-stg:9092,kafka-stg:9093    │ │
│  │   auth: scram-sha-256 | status: Not tested  │ │
│  └─────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Edit Cluster ─────────────────────────────┐  │
│  │ Name:     [___________________________]     │  │
│  │ Brokers:  [localhost:9092           ] [+]   │  │
│  │           [kafka2:9092              ] [×]   │  │
│  │ Client ID:[redfire-forge            ]       │  │
│  │                                             │  │
│  │ ── Authentication ──────────────────────    │  │
│  │ Type: [None ▼]                              │  │
│  │ Username: [____] Password: [****]           │  │
│  │                                             │  │
│  │ ── SSL/TLS ─────────────────────────────    │  │
│  │ [×] Enable SSL  [ ] Reject unauthorized     │  │
│  │ CA Certificate: [Upload] or [Paste PEM]     │  │
│  │                                             │  │
│  │ ── Test Results Publishing ─────────────    │  │
│  │ [ ] Publish results  Topic: [___________]   │  │
│  │                                             │  │
│  │            [Cancel] [Save]                  │  │
│  └─────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Topic Browser ────────────────────────────┐  │
│  │ 🔍 [filter topics...]                      │  │
│  │ orders.created            (3 partitions)    │  │
│  │ orders.updated            (3 partitions)    │  │
│  │ payments.processed        (6 partitions)    │  │
│  │ notifications.email       (1 partition)     │  │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Subcomponents**:
- `KafkaClusterCard.tsx` — displays cluster info, status badge, action buttons
- `KafkaClusterEditor.tsx` — form for add/edit cluster config
- `KafkaTopicBrowser.tsx` — filterable topic list (calls `GET /api/kafka/topics`)
- `KafkaConnectionStatus.tsx` — reusable connected/disconnected/testing badge

**Interactions**:
- **[Test]** button → `POST /api/kafka/connect` with cluster config → shows spinner → ✓/✗
- **[Save]** → persists to storage via `saveKafkaClusters()`
- Topic browser auto-populates after successful connection test
- Auto-connect clusters on app start if `autoConnect: true`

### Step 2.6 — Kafka Connection Indicator in AppHeader

**File**: `src/app/components/AppHeader.tsx`

Add a small Kafka status indicator next to existing env/svc selectors:
- Green dot + "Kafka" if connected
- Gray dot + "Kafka" if not connected
- Click opens Kafka settings tab

### Step 2.7 — Kafka Client Transport (`src/features/kafka/utils/kafkaClient.ts`)

Platform-aware dispatcher (mirrors `src/shared/utils/httpClient.ts` L133-164):

```typescript
import { isTauri, isNode } from '../../../utils/platform';

export type KafkaOperationType = 'connect' | 'disconnect' | 'produce' | 'consume'
  | 'subscribe' | 'unsubscribe' | 'status' | 'topics';

export interface KafkaOperation {
  type: KafkaOperationType;
  payload: unknown;
}

export type KafkaTransportFn = (op: KafkaOperation) => Promise<unknown>;

let _kafkaTransport: KafkaTransportFn | null = null;

export function setKafkaTransport(fn: KafkaTransportFn | null): void {
  _kafkaTransport = fn;
}

export async function kafkaOp<T = unknown>(op: KafkaOperation): Promise<T> {
  if (_kafkaTransport) return _kafkaTransport(op) as Promise<T>;
  if (isTauri()) return kafkaViaTauri(op) as Promise<T>;  // Phase 8
  return kafkaViaServerProxy(op) as Promise<T>;            // default: /api/kafka/*
}

async function kafkaViaServerProxy(op: KafkaOperation): Promise<unknown> {
  const routeMap: Record<KafkaOperationType, { method: string; path: string }> = {
    connect:     { method: 'POST',   path: '/api/kafka/connect' },
    disconnect:  { method: 'DELETE', path: '/api/kafka/connect' },
    produce:     { method: 'POST',   path: '/api/kafka/produce' },
    consume:     { method: 'POST',   path: '/api/kafka/consume' },
    subscribe:   { method: 'POST',   path: '/api/kafka/subscribe' },
    unsubscribe: { method: 'DELETE', path: '/api/kafka/subscribe/{id}' },
    status:      { method: 'GET',    path: '/api/kafka/status' },
    topics:      { method: 'GET',    path: '/api/kafka/topics' },
  };
  const route = routeMap[op.type];
  const resp = await fetch(route.path, {
    method: route.method,
    headers: route.method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: route.method !== 'GET' ? JSON.stringify(op.payload) : undefined,
  });
  return resp.json();
}

async function kafkaViaTauri(_op: KafkaOperation): Promise<unknown> {
  throw new Error('Tauri Kafka transport not implemented (Phase 8)');
}
```

### Step 2.8 — Unit Tests

- `src/features/kafka/utils/kafkaClient.test.ts` — transport selection, proxy routing, override mechanism
- `src/features/kafka/KafkaSettingsPage.test.tsx` — render, add/edit/delete cluster, connection test
- `src/features/kafka/components/KafkaTopicBrowser.test.tsx` — topic list, filter, empty state

### Step 2.9 — CSS

**File**: `src/styles/kafka.css`
- Connection status badges (green/gray/red dots)
- Cluster card layout
- Topic browser table
- Broker list editor

Import in `src/styles/index.css`.

---

## Phase 3 — Workflow Nodes (KafkaProduce + KafkaConsume)

**Effort**: 4-5 days
**Prerequisite**: Phase 1 (server routes) + Phase 2 (Kafka config types + client)

### Step 3.1 — Type Definitions (`src/features/workflow/types/workflow.ts`)

Add new node data interfaces after `CorrelationWaitNodeData` (line 419):

```typescript
// ── Kafka Produce Node ──────────────────────────────

export interface KafkaProduceNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster config ID from environment. */
  kafkaConfigId: string;
  /** Target topic (supports {{variable}} interpolation). */
  topic: string;
  /** Message key (supports {{variable}} interpolation). Empty = null key. */
  messageKey?: string;
  /** Message body — JSON template with {{variable}} placeholders. */
  messageBody: string;
  /** Additional Kafka headers (name/value pairs, values support {{variable}}). */
  headers?: Array<{ name: string; value: string }>;
  /** Target partition. Omit to let Kafka partitioner decide. */
  partition?: number;
  /** Acknowledgment level: -1=all, 0=none, 1=leader. Default -1. */
  acks?: -1 | 0 | 1;
  /** Variables to extract from produce result (offset, partition, timestamp). */
  extractVariables?: Array<{
    name: string;
    source: 'offset' | 'partition' | 'timestamp' | 'topic';
  }>;
  /** Timeout in ms. 0 = use default (30s). */
  timeoutMs: number;
  /** Optional notes. */
  notes?: string;
}

// ── Kafka Consume Node ──────────────────────────────

export interface KafkaConsumeNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster config ID from environment. */
  kafkaConfigId: string;
  /** Topic to consume from (supports {{variable}} interpolation). */
  topic: string;
  /** Consumer group ID. Auto-generated per execution if empty. */
  groupId?: string;
  /** Max messages to consume before continuing. */
  maxMessages: number;
  /** Start from beginning of topic (true) or latest (false). */
  fromBeginning: boolean;
  /** Timeout in ms (fail node if no messages within timeout). */
  timeoutMs: number;
  /** Message filter criteria. */
  filter?: {
    /** Regex pattern to match message key. */
    keyPattern?: string;
    /** Headers that must all match. */
    headerMatch?: Record<string, string>;
    /** JSONPath match on parsed message value. */
    jsonPathMatch?: { path: string; value: string };
  };
  /** Variables to extract from consumed message(s) via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Optional notes. */
  notes?: string;
  /** Load test behavior: consume-real (actual broker), synthetic-message (mock),
      skip (no-op). Default: consume-real. */
  loadTestBehavior?: 'consume-real' | 'synthetic-message' | 'skip';
  /** Synthetic message body (JSON) for load test synthetic-message mode. */
  syntheticPayload?: string;
}
```

Update union types (line 421-423):

```typescript
export type WorkflowNodeType = '...' | 'kafkaProduce' | 'kafkaConsume';

export type WorkflowNodeData = ... | KafkaProduceNodeData | KafkaConsumeNodeData;
```

### Step 3.2 — Default Node Data (`src/features/workflow/utils/workflowNodeFactory.ts`)

Add cases in `defaultNodeData()` function (after line 182):

```typescript
case 'kafkaProduce':
  return {
    label: 'Kafka Produce',
    kafkaConfigId: '',
    topic: '',
    messageKey: '',
    messageBody: '{\n  \n}',
    headers: [],
    acks: -1,
    extractVariables: [],
    timeoutMs: 30000,
    notes: '',
  } satisfies KafkaProduceNodeData;

case 'kafkaConsume':
  return {
    label: 'Kafka Consume',
    kafkaConfigId: '',
    topic: '',
    groupId: '',
    maxMessages: 1,
    fromBeginning: false,
    timeoutMs: 10000,
    filter: undefined,
    extractVariables: [],
    notes: '',
    loadTestBehavior: 'consume-real',
    syntheticPayload: '{}',
  } satisfies KafkaConsumeNodeData;
```

### Step 3.3 — Visual Node Components

**File**: `src/features/workflow/components/nodes/KafkaProduceNode.tsx`

Follow existing node component pattern (e.g. `HttpStepNode.tsx`):
- Purple-themed node border/icon
- Show topic name + message key preview
- Kafka icon (can use `📤` or custom SVG)
- Label editable on double-click

**File**: `src/features/workflow/components/nodes/KafkaConsumeNode.tsx`

- Teal-themed node border/icon
- Show topic name + filter indicator
- Kafka icon (can use `📥` or custom SVG)

Register in `nodeTypes` map (`workflowNodeFactory.ts` line 52-70):

```typescript
kafkaProduce: KafkaProduceNode,
kafkaConsume: KafkaConsumeNode,
```

### Step 3.4 — Config Components

**File**: `src/features/workflow/components/configs/KafkaProduceConfig.tsx`

```
┌─ Kafka Produce Configuration ──────────────────────┐
│                                                     │
│ ── Connection ──────────────────────────────────    │
│ Kafka Cluster: [Select cluster... ▼]               │
│ Topic:         [orders.created        ]            │
│                                                     │
│ ── Message ─────────────────────────────────────    │
│ Key:           [{{orderId}}           ]            │
│ Body:                                              │
│ ┌─────────────────────────────────────────────┐    │
│ │ {                                           │    │
│ │   "orderId": "{{orderId}}",                 │    │
│ │   "status": "processed",                    │    │
│ │   "timestamp": "{{now}}"                    │    │
│ │ }                                           │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ── Headers ─────────────────────────────────────    │
│ [+ Add Header]                                     │
│ Content-Type: application/json                      │
│ X-Correlation-Id: {{correlationId}}                 │
│                                                     │
│ ── Advanced ────────────────────────────────────    │
│ Partition: [auto ▼]  Acks: [all (-1) ▼]           │
│ Timeout:   [30000  ] ms                            │
│                                                     │
│ ── Extract Variables ───────────────────────────    │
│ [+ Add Extraction]                                 │
│ producedOffset  ← offset                           │
│ producedPart    ← partition                        │
│                                                     │
│ ── Notes ───────────────────────────────────────    │
│ [multiline textarea]                               │
│                                                     │
└────────────────────────────────────────────────────┘
```

Uses `ConfigSectionGroup` for each section (same pattern as `WebhookConfig.tsx`).

**File**: `src/features/workflow/components/configs/KafkaConsumeConfig.tsx`

```
┌─ Kafka Consume Configuration ──────────────────────┐
│                                                     │
│ ── Connection ──────────────────────────────────    │
│ Kafka Cluster: [Select cluster... ▼]               │
│ Topic:         [orders.created        ]            │
│ Consumer Group:[redfire-{{workflowId}}]            │
│                                                     │
│ ── Consumption ─────────────────────────────────    │
│ Max Messages:  [1    ]                             │
│ From Beginning:[  ] (checkbox)                     │
│ Timeout:       [10000] ms                          │
│                                                     │
│ ── Filters ─────────────────────────────────────    │
│ Key Pattern:   [order-.*             ] (regex)     │
│ Header Match:  [+ Add Header Filter]               │
│   X-Type = payment                                 │
│ JSONPath Match:                                    │
│   Path:  [$.status]  Value: [completed]            │
│                                                     │
│ ── Extract Variables ───────────────────────────    │
│ [+ Add Extraction]  [🔗 Data Mapper]               │
│ orderId   ← $.orderId                              │
│ amount    ← $.payment.amount                       │
│                                                     │
│ ── Load Test Behavior ──────────────────────────    │
│ Mode: [Consume Real ▼]                             │
│ (options: Consume Real / Synthetic Message / Skip)  │
│ Synthetic Payload: [JSON editor...]                │
│                                                     │
│ ── Notes ───────────────────────────────────────    │
│ [multiline textarea]                               │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Step 3.5 — Wire Config Modal Dispatch

**File**: `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx`

Add after line 407 (after `correlationWait` block):

```tsx
{draftNode.type === 'kafkaProduce' && (
  <KafkaProduceConfig
    data={draftNode.data as KafkaProduceNodeData}
    onChange={updateDraft}
    kafkaClusters={kafkaClusters}  // pass from App state
  />
)}
{draftNode.type === 'kafkaConsume' && (
  <KafkaConsumeConfig
    data={draftNode.data as KafkaConsumeNodeData}
    onChange={updateDraft}
    onRequestVariableInsert={requestVariableInsert}
    variableHints={variableInsertHints}
    kafkaClusters={kafkaClusters}
  />
)}
```

### Step 3.6 — Palette Entry

**File**: `src/features/workflow/components/canvas/WorkflowPalette.tsx`

Add to `ALL_BLOCKS` array (line 24-44):

```typescript
{ type: 'kafkaProduce', label: 'Kafka Produce', category: 'Actions',
  icon: '📤', description: 'Publish a message to a Kafka topic' },
{ type: 'kafkaConsume', label: 'Kafka Consume', category: 'Actions',
  icon: '📥', description: 'Consume messages from a Kafka topic' },
```

### Step 3.7 — Node Type Labels

**File**: `src/features/results/utils/nodeTypeLabels.ts`

Add to `CONSOLE_LABELS` and `EXPLORER_LABELS`:

```typescript
kafkaProduce: 'Kafka Produce',
kafkaConsume: 'Kafka Consume',
```

### Step 3.8 — Graph Runner Handlers

**File**: `src/features/workflow/engine/graphRunnerKafkaHandlers.ts` (new)

```typescript
import type { WorkflowNode } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import type { KafkaProduceNodeData, KafkaConsumeNodeData } from '../types/workflow';
import { kafkaOp } from '../../kafka/utils/kafkaClient';
import { getByPath } from '../../../shared/utils/jsonPath';

export async function handleKafkaProduceNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as KafkaProduceNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // 1. Resolve templates in topic, key, body, headers
  const topic = hCtx.ctx.resolve(data.topic);
  const key = data.messageKey ? hCtx.ctx.resolve(data.messageKey) : undefined;
  const body = hCtx.ctx.resolve(data.messageBody);
  const headers = (data.headers ?? []).reduce((acc, h) => {
    acc[h.name] = hCtx.ctx.resolve(h.value);
    return acc;
  }, {} as Record<string, string>);

  hCtx.log({ prefix: '→', text: `[${label}] Producing to ${topic}${key ? ` key=${key}` : ''}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' as any });

  const startTime = performance.now();
  try {
    // 2. Call Kafka produce via transport
    const result = await kafkaOp<{ ok: boolean; offsets: Array<{
      partition: number; baseOffset: string; logAppendTime: string;
    }>; durationMs: number }>({
      type: 'produce',
      payload: {
        topic,
        messages: [{ key, value: body, headers, partition: data.partition }],
        acks: data.acks ?? -1,
        timeout: data.timeoutMs || 30000,
      },
    });

    if (!result.ok) throw new Error('Produce failed');

    const offset = result.offsets?.[0];
    const durationMs = performance.now() - startTime;

    // 3. Extract variables
    for (const ev of data.extractVariables ?? []) {
      const val = ev.source === 'offset' ? offset?.baseOffset
        : ev.source === 'partition' ? String(offset?.partition)
        : ev.source === 'timestamp' ? offset?.logAppendTime
        : ev.source === 'topic' ? topic : '';
      if (val != null) hCtx.ctx.set(ev.name, String(val));
      hCtx.log({ prefix: '#', text: `[${label}] ${ev.name} = ${val}` });
    }

    // 4. Trace
    hCtx.traceCollector?.onNodeComplete(nodeId, 'pass', {
      responseTimeMs: durationMs,
      url: `kafka://${topic}`,
      method: 'PRODUCE',
    });

    passed.value = true;
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    hCtx.log({ prefix: '✓', text: `[${label}] Produced to ${topic} offset=${offset?.baseOffset} (${durationMs.toFixed(0)}ms)` });
  } catch (err) {
    const durationMs = performance.now() - startTime;
    hCtx.traceCollector?.onNodeComplete(nodeId, 'fail', {
      responseTimeMs: durationMs, error: String(err),
    });
    passed.value = false;
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail' });
    hCtx.log({ prefix: '✗', text: `[${label}] Produce failed: ${err}` });
  }

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleKafkaConsumeNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as KafkaConsumeNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // Load test: skip mode
  if (hCtx.loadTestMode && data.loadTestBehavior === 'skip') {
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'skipped' as any });
    hCtx.traceCollector?.onNodeComplete(nodeId, 'skipped');
    hCtx.log({ prefix: '⊘', text: `[${label}] Skipped (load test mode)` });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // Load test: synthetic message
  if (hCtx.loadTestMode && data.loadTestBehavior === 'synthetic-message') {
    const payload = data.syntheticPayload ? JSON.parse(data.syntheticPayload) : {};
    for (const ev of data.extractVariables ?? []) {
      const val = getByPath(payload, ev.jsonPath);
      if (val != null) hCtx.ctx.set(ev.name, typeof val === 'string' ? val : JSON.stringify(val));
    }
    passed.value = true;
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    hCtx.log({ prefix: '✓', text: `[${label}] Synthetic message injected` });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // Normal: consume from real broker
  const topic = hCtx.ctx.resolve(data.topic);
  hCtx.log({ prefix: '→', text: `[${label}] Consuming from ${topic} (max=${data.maxMessages}, timeout=${data.timeoutMs}ms)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' as any });

  const startTime = performance.now();
  try {
    const result = await kafkaOp<{ ok: boolean; messages: Array<{
      key: string | null; value: string | null; partition: number;
      offset: string; headers: Record<string, string>; timestamp: string;
    }>; durationMs: number }>({
      type: 'consume',
      payload: {
        topic,
        groupId: data.groupId || undefined,
        maxMessages: data.maxMessages,
        timeoutMs: data.timeoutMs,
        fromBeginning: data.fromBeginning,
        filter: data.filter,
      },
    });

    const messages = result.messages ?? [];
    const durationMs = performance.now() - startTime;

    // Extract variables from first message
    if (messages.length > 0 && messages[0].value) {
      try {
        const payload = JSON.parse(messages[0].value);
        for (const ev of data.extractVariables ?? []) {
          const val = getByPath(payload, ev.jsonPath);
          if (val != null) {
            const strVal = typeof val === 'string' ? val : JSON.stringify(val);
            hCtx.ctx.set(ev.name, strVal);
            hCtx.log({ prefix: '#', text: `[${label}] ${ev.name} = ${strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal}` });
          }
        }
      } catch { /* non-JSON message value — skip extraction */ }
    }

    // Set message count + raw payload in context
    hCtx.ctx.set('kafka.messageCount', String(messages.length));
    if (messages.length > 0) {
      hCtx.ctx.set('kafka.lastMessage', messages[messages.length - 1].value ?? '');
      hCtx.ctx.set('kafka.lastKey', messages[messages.length - 1].key ?? '');
    }

    passed.value = messages.length > 0;
    hCtx.traceCollector?.onNodeComplete(nodeId, passed.value ? 'pass' : 'fail', {
      responseTimeMs: durationMs,
      url: `kafka://${topic}`,
      method: 'CONSUME',
    });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: passed.value ? 'pass' : 'fail' });
    hCtx.log({ prefix: passed.value ? '✓' : '✗', text: `[${label}] Consumed ${messages.length} message(s) from ${topic} (${durationMs.toFixed(0)}ms)` });
  } catch (err) {
    const durationMs = performance.now() - startTime;
    hCtx.traceCollector?.onNodeComplete(nodeId, 'fail', {
      responseTimeMs: durationMs, error: String(err),
    });
    passed.value = false;
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail' });
    hCtx.log({ prefix: '✗', text: `[${label}] Consume failed: ${err}` });
  }

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
```

### Step 3.9 — Wire Handlers into Graph Runner

**File**: `src/features/workflow/engine/graphRunner.ts`

Add dispatch in `visit()` function (after line 258, the `correlationWait` block):

```typescript
} else if (node.type === 'kafkaProduce') {
  await handleKafkaProduceNode(nodeId, node, hCtx, passedFlag);
} else if (node.type === 'kafkaConsume') {
  await handleKafkaConsumeNode(nodeId, node, hCtx, passedFlag);
}
```

Add to barrel export in `graphRunnerNodeHandlers.ts`.

### Step 3.10 — Trace Types Update

**File**: `src/shared/types/trace.ts`

Add to `ExecutionEvent.nodeType` union (line 147):

```typescript
nodeType: '...' | 'kafkaProduce' | 'kafkaConsume';
```

Add to `ExecutionEventDetails` (after `webhookInput`):

```typescript
kafkaDetails?: {
  topic: string;
  operation: 'produce' | 'consume';
  messageCount?: number;
  offset?: string;
  partition?: number;
  key?: string | null;
  filterApplied?: boolean;
};
```

### Step 3.11 — Unit Tests

| File | Tests |
|------|-------|
| `graphRunnerKafkaHandlers.test.ts` | Produce: success, failure, variable extraction, template resolution, timeout. Consume: success with extraction, empty topic, filter match, load test skip mode, synthetic message mode, timeout. |
| `KafkaProduceConfig.test.tsx` | Render, change topic, add header, change acks, extract variable |
| `KafkaConsumeConfig.test.tsx` | Render, change topic, add filter, extraction JSONPath, load test mode toggle |
| `KafkaProduceNode.test.tsx` | Render with topic, label display |
| `KafkaConsumeNode.test.tsx` | Render with topic, filter indicator |

---

## Phase 4 — KafkaTrigger (Workflow Start Node)

**Effort**: 2-3 days
**Prerequisite**: Phase 1 + Phase 3
**Mirrors**: WebhookTrigger pattern (`src/features/workflow/engine/graphRunnerTriggerHandlers.ts` L28-75)

### Step 4.1 — Type Definition

**File**: `src/features/workflow/types/workflow.ts`

```typescript
export interface KafkaTriggerNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster config ID. */
  kafkaConfigId: string;
  /** Topic to subscribe to for triggering. */
  topic: string;
  /** Consumer group ID for the trigger subscription. */
  groupId?: string;
  /** Variables to extract from consumed message body via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Sample payload for Quick Test (JSON string). */
  samplePayload?: string;
  /** Optional key filter (regex). Only messages with matching keys trigger the workflow. */
  keyFilter?: string;
  /** Optional header filter. All specified headers must match. */
  headerFilter?: Record<string, string>;
  /** Notes. */
  notes?: string;
}
```

Update unions: add `'kafkaTrigger'` to `WorkflowNodeType`, `KafkaTriggerNodeData` to `WorkflowNodeData`.

### Step 4.2 — Default Data + Visual Node + Palette

- `defaultNodeData('kafkaTrigger')` → label, kafkaConfigId, topic, samplePayload, extractVariables
- `KafkaTriggerNode.tsx` — orange-themed trigger node (matches existing trigger color scheme)
- Palette entry: `{ type: 'kafkaTrigger', label: 'Kafka Trigger', category: 'Triggers' }`

### Step 4.3 — Config Component (`KafkaTriggerConfig.tsx`)

Mirrors `WebhookConfig.tsx` structure:

```
┌─ Kafka Trigger Configuration ──────────────────────┐
│                                                     │
│ ── Connection ──────────────────────────────────    │
│ Kafka Cluster: [Select cluster... ▼]               │
│ Topic:         [orders.created        ]            │
│ Consumer Group:[redfire-trigger-wf-xxx]            │
│                                                     │
│ ── Filters (optional) ──────────────────────────    │
│ Key Filter:    [order-.*            ] (regex)      │
│ Header Filter: [+ Add]                             │
│                                                     │
│ ── Sample Payload (for Quick Test) ─────────────    │
│ ┌─────────────────────────────────────────────┐    │
│ │ {                                           │    │
│ │   "orderId": "ORD-123",                     │    │
│ │   "amount": 99.95                           │    │
│ │ }                                           │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ── Extract Variables ───────────────────────────    │
│ [+ Add Extraction]  [🔗 Data Mapper]               │
│ orderId   ← $.orderId                              │
│ amount    ← $.amount                               │
│                                                     │
│ ── Notes ───────────────────────────────────────    │
│ [multiline textarea]                               │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Step 4.4 — Graph Runner Handler

**File**: `src/features/workflow/engine/graphRunnerTriggerHandlers.ts`

Add after `handleWebhookTriggerNode` (mirrors its pattern exactly):

```typescript
export async function handleKafkaTriggerNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as KafkaTriggerNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // Check for runtime-injected Kafka payload (from server-side trigger)
  let payload: Record<string, unknown>;
  const runtimePayload = hCtx.ctx.get('__kafkaPayload');
  if (runtimePayload) {
    try { payload = JSON.parse(runtimePayload); }
    catch { payload = {}; }
    hCtx.log({ prefix: '▶', text: `[${label}] Kafka trigger fired from ${data.topic}` });
  } else {
    // Quick Test mode: use samplePayload
    try { payload = JSON.parse(data.samplePayload || '{}'); }
    catch { payload = {}; }
    hCtx.log({ prefix: '▶', text: `[${label}] Using sample payload (Quick Test)` });
  }

  // Extract variables via JSONPath
  if (data.extractVariables) {
    for (const ev of data.extractVariables) {
      const val = getByPath(payload, ev.jsonPath);
      if (val != null) {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        hCtx.ctx.set(ev.name, strVal);
        hCtx.log({ prefix: '#', text: `[${label}] ${ev.name} = ${strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal}` });
      }
    }
  }

  // Set context metadata
  hCtx.ctx.set('__kafkaTopic', data.topic);
  hCtx.ctx.set('__kafkaPayload', JSON.stringify(payload));

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  hCtx.traceCollector?.onNodeComplete(nodeId, 'pass', {
    webhookInput: { payload: JSON.stringify(payload) },
  });

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
```

Add dispatch in `graphRunner.ts`:
```typescript
} else if (node.type === 'kafkaTrigger') {
  await handleKafkaTriggerNode(nodeId, node, hCtx);
```

### Step 4.5 — Server-Side Trigger Loop (`src-server/kafka-trigger.ts`)

Persistent consumer per workflow that has a KafkaTrigger start node:

```typescript
import * as kafkaService from './kafka-service.js';
import { executeWorkflow } from './executeWorkflow.js';
import type { LogLine } from '../src/shared/types/server-api';

interface TriggerSubscription {
  workflowId: string;
  nodeId: string;
  topic: string;
  subscriptionId: string;
  keyFilter?: RegExp;
  headerFilter?: Record<string, string>;
}

const activeTriggers = new Map<string, TriggerSubscription>();

export async function startKafkaTrigger(
  workflowId: string,
  nodeId: string,
  config: { topic: string; groupId?: string; keyFilter?: string; headerFilter?: Record<string, string> },
  broadcastLog: (line: LogLine) => void,
): Promise<void> {
  // 1. Subscribe to topic via kafka-service
  // 2. On each message:
  //    a. Apply key filter (regex)
  //    b. Apply header filter
  //    c. If passes: load workflow definition
  //    d. Set __kafkaPayload, __kafkaTopic, __kafkaKey in initial variables
  //    e. Call executeWorkflow(workflow, variables)
  //    f. Log execution result
  // 3. Store in activeTriggers Map
}

export async function stopKafkaTrigger(workflowId: string): Promise<void> {
  // Unsubscribe and remove from Map
}

export function listKafkaTriggers(): TriggerSubscription[] {
  return [...activeTriggers.values()];
}
```

Wire REST endpoints:

```
POST   /api/kafka/triggers/:workflowId/start
DELETE /api/kafka/triggers/:workflowId/stop
GET    /api/kafka/triggers
```

### Step 4.6 — Unit Tests

| File | Tests |
|------|-------|
| `graphRunnerTriggerHandlers.test.ts` | KafkaTrigger: sample payload extraction, runtime payload, empty payload, keyFilter |
| `kafka-trigger.test.ts` | Start/stop trigger, message filtering, workflow execution call |
| `KafkaTriggerConfig.test.tsx` | Render, sample payload editor, variable extraction |

---

## Phase 5 — KafkaWait (Correlation Pattern)

**Effort**: 3-4 days
**Prerequisite**: Phase 1 + Phase 3
**Mirrors**: CorrelationWait pattern exactly (graphRunnerCorrelationWaitHandler.ts + remoteCorrelationStore.ts + correlation-handler.ts)

### Step 5.1 — Type Definition

**File**: `src/features/workflow/types/workflow.ts`

```typescript
export interface KafkaWaitNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster config ID. */
  kafkaConfigId: string;
  /** Topic to consume from while waiting. */
  topic: string;
  /** Expression resolving to the expected correlation value (e.g. "{{orderId}}"). */
  correlationExpression: string;
  /** Where to find the correlation value in the Kafka message. */
  correlationSource: 'key' | 'value-jsonpath' | 'header';
  /** JSONPath for value-based correlation (when correlationSource is 'value-jsonpath'). */
  correlationJsonPath?: string;
  /** Header name for header-based correlation (when correlationSource is 'header'). */
  correlationHeader?: string;
  /** Variables to extract from matched message body. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Timeout in ms. 0 = unlimited (up to 1h hard cap). */
  timeoutMs: number;
  /** Optional filter expression on message body. */
  messageFilter?: string;
  /** Notes. */
  notes?: string;
  /** Load test behavior (mirrors CorrelationWait exactly). */
  loadTestBehavior?: 'wait-for-real' | 'auto-resume' | 'synthetic-inject';
  /** Synthetic payload for synthetic-inject mode. */
  syntheticPayload?: string;
  /** Synthetic delay before injection (ms). */
  syntheticDelayMs?: number;
  /** Random jitter range (±ms). */
  syntheticJitterMs?: number;
}
```

Update unions: add `'kafkaWait'` to `WorkflowNodeType`.

### Step 5.2 — Server-Side Kafka Correlation Store (`src-server/kafka-correlation-store.ts`)

```typescript
// Architecture:
// 1. Shared consumer per topic (reuse if multiple KafkaWait nodes watch same topic)
// 2. On each message: extract correlation value based on source (key/jsonpath/header)
// 3. Check if any paused workflow is waiting for this correlation value
// 4. If match: notify via resumeWaiters (same pattern as correlation-handler.ts)
// 5. Long-poll endpoint for browser: GET /api/kafka/correlations/:id/wait

interface KafkaPausedEntry {
  correlationId: string;
  correlationValue: string;    // resolved from expression
  topic: string;
  correlationSource: 'key' | 'value-jsonpath' | 'header';
  correlationJsonPath?: string;
  correlationHeader?: string;
  pausedAt: number;
  timeoutAt: number;
}

// REST endpoints:
// POST   /api/kafka/correlations/pause   — register a waiting workflow
// GET    /api/kafka/correlations/:id/wait — long-poll until matched message arrives
// DELETE /api/kafka/correlations/:id      — cancel wait

// Internal: startTopicConsumer(topic) — creates shared consumer
//           matchMessage(msg, pausedEntries) — check if any entry matches
//           notifyResume(correlationId, messagePayload) — wake long-poll
```

### Step 5.3 — Client-Side Kafka Correlation Store

**File**: `src/features/workflow/engine/remoteKafkaCorrelationStore.ts`

Implements `ICorrelationStore` interface (same as `RemoteCorrelationStore`):
- `pause()` → `POST /api/kafka/correlations/pause` + `runWaitLoop()`
- Long-poll: `GET /api/kafka/correlations/:id/wait?timeoutMs=30000`
- Same timeout/retry/cleanup logic as HTTP correlation store

### Step 5.4 — Graph Runner Handler

**File**: `src/features/workflow/engine/graphRunnerKafkaWaitHandler.ts`

Mirror `graphRunnerCorrelationWaitHandler.ts` exactly:
- Same mode resolution (runner config → node config → default)
- Same 3 load-test paths: auto-resume / synthetic-inject / wait-for-real
- Same `injectPayload()` pattern for variable extraction
- Same `WorkflowPausedState` serialization for resumable workflows

### Step 5.5 — Wire into graphLoadRunner.ts

Add Kafka correlation store initialization alongside HTTP correlation store (after line 117):

```typescript
let kafkaCorrelationStore: RemoteKafkaCorrelationStore | InMemoryCorrelationStore | undefined;
// Same pattern: wait-for-real → RemoteKafkaCorrelationStore
//               synthetic-inject → InMemoryCorrelationStore + SyntheticEventInjector
//               auto-resume → undefined
```

Pass to `NodeHandlerContext` as `kafkaCorrelationStore`.

### Step 5.6 — Config Component + Visual Node

- `KafkaWaitConfig.tsx` — topic, correlation expression, source (key/jsonpath/header), extraction, timeout, load test behavior
- `KafkaWaitNode.tsx` — amber-themed (matches CorrelationWait color)
- Palette: `{ type: 'kafkaWait', label: 'Kafka Wait', category: 'Actions' }`

### Step 5.7 — Unit Tests

| File | Tests |
|------|-------|
| `graphRunnerKafkaWaitHandler.test.ts` | All 3 load test modes, normal wait, timeout, variable extraction, correlation matching |
| `kafka-correlation-store.test.ts` | Server: pause/resume/timeout, concurrent waits, topic consumer lifecycle |
| `remoteKafkaCorrelationStore.test.ts` | Client: long-poll loop, timeout, abort, cleanup |
| `KafkaWaitConfig.test.tsx` | Render, correlation source toggle, extraction editor |

---

## Phase 6 — Kafka as Test Target (Scenario Runner)

**Effort**: 3-4 days
**Prerequisite**: Phase 1 + Phase 2
**Goal**: Load test Kafka topics directly from Test Runner (not workflow mode)

### Step 6.1 — Kafka Scenario Type

Since `Scenario` in `src/shared/types/index.ts` is HTTP-only (has `url`, `method`, `headers`, `body`), we need a strategy. Two options:

**Option A (recommended)**: Add optional `protocol` field + Kafka-specific fields to existing `Scenario`:

```typescript
export interface Scenario {
  // ... existing HTTP fields ...

  /** Protocol for this scenario. Default: 'http'. */
  protocol?: 'http' | 'kafka';

  // ── Kafka-specific (only when protocol === 'kafka') ──
  /** Kafka cluster config ID. */
  kafkaConfigId?: string;
  /** Kafka topic. */
  kafkaTopic?: string;
  /** Kafka operation: produce or consume. */
  kafkaOperation?: 'produce' | 'consume';
  /** Kafka message key template. */
  kafkaKey?: string;
  /** Kafka consume options. */
  kafkaConsumeOptions?: {
    groupId?: string;
    maxMessages?: number;
    timeoutMs?: number;
    fromBeginning?: boolean;
    filter?: KafkaMessageFilter;
  };
}
```

**Option B**: Separate `KafkaScenario` interface with discriminated union. More type-safe but requires refactoring every function that takes `Scenario`.

**Decision**: Option A for backward compatibility. The `protocol` field defaults to `'http'` when absent, so all existing code continues working unchanged.

### Step 6.2 — Kafka Execution (`src/engine/kafkaExecution.ts`)

```typescript
import type { Scenario, RequestResult } from '../shared/types';
import { kafkaOp } from '../features/kafka/utils/kafkaClient';

export async function executeKafkaScenario(
  scenario: Scenario,
  resolvedBody?: string,
  timeoutMs?: number,
): Promise<RequestResult> {
  const startTime = performance.now();
  const resultId = nextResultId();

  try {
    if (scenario.kafkaOperation === 'produce') {
      const result = await kafkaOp<{ ok: boolean; offsets: any[]; durationMs: number }>({
        type: 'produce',
        payload: {
          topic: scenario.kafkaTopic,
          messages: [{ key: scenario.kafkaKey, value: resolvedBody || scenario.body }],
          timeout: timeoutMs || 30000,
        },
      });

      return {
        id: resultId,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        url: `kafka://${scenario.kafkaTopic}`,
        method: 'PRODUCE',
        httpStatus: result.ok ? 200 : 0,
        responseTimeMs: performance.now() - startTime,
        passed: result.ok,
        responseBody: JSON.stringify(result.offsets),
        // ... other fields
      };
    }

    if (scenario.kafkaOperation === 'consume') {
      const opts = scenario.kafkaConsumeOptions ?? {};
      const result = await kafkaOp<{ ok: boolean; messages: any[]; durationMs: number }>({
        type: 'consume',
        payload: {
          topic: scenario.kafkaTopic,
          groupId: opts.groupId,
          maxMessages: opts.maxMessages ?? 1,
          timeoutMs: opts.timeoutMs ?? timeoutMs ?? 10000,
          fromBeginning: opts.fromBeginning,
          filter: opts.filter,
        },
      });

      return {
        id: resultId,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        url: `kafka://${scenario.kafkaTopic}`,
        method: 'CONSUME',
        httpStatus: result.messages?.length > 0 ? 200 : 0,
        responseTimeMs: performance.now() - startTime,
        passed: result.ok && result.messages?.length > 0,
        responseBody: JSON.stringify(result.messages),
        // ... other fields
      };
    }

    throw new Error(`Unknown Kafka operation: ${scenario.kafkaOperation}`);
  } catch (err) {
    return {
      id: resultId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      url: `kafka://${scenario.kafkaTopic ?? 'unknown'}`,
      method: scenario.kafkaOperation?.toUpperCase() ?? 'KAFKA',
      httpStatus: 0,
      responseTimeMs: performance.now() - startTime,
      passed: false,
      error: String(err),
    };
  }
}
```

### Step 6.3 — Executor Integration (`src/engine/executor.ts`)

In the main execution loop (runPool, runSequential, etc.), add protocol check:

```typescript
// In executeRequest or equivalent:
if (scenario.protocol === 'kafka') {
  return executeKafkaScenario(scenario, resolvedBody, timeoutMs);
}
// ... existing HTTP path
```

### Step 6.4 — Scenario Builder UI

Add a protocol toggle in `ScenarioBuilder.tsx`:
- Default: HTTP (existing UI)
- Toggle to Kafka: shows topic, operation (produce/consume), key, body, consume options
- Hides HTTP-specific fields (URL, method, headers) when Kafka selected

### Step 6.5 — Results Display

Kafka results display in Results Console with:
- **Topic** instead of URL
- **Operation** (PRODUCE/CONSUME) instead of HTTP method
- **Offset** instead of HTTP status code
- **Message count** for consume operations
- **Latency** (same as HTTP)
- **Message payload** in response body panel

### Step 6.6 — Unit Tests

| File | Tests |
|------|-------|
| `kafkaExecution.test.ts` | Produce success/failure, consume success/empty/timeout, error handling |
| `executor.test.ts` | Protocol routing: kafka → kafkaExecution, http → httpFetch |

---

## Phase 7 — Publish Test Results to Kafka

**Effort**: 1-2 days
**Prerequisite**: Phase 1 + Phase 2

### Step 7.1 — Results Publisher (`src/features/results/hooks/useResultsPublisher.ts`)

```typescript
import { kafkaOp } from '../../kafka/utils/kafkaClient';
import type { KafkaClusterConfig, RequestResult, TestConfig } from '../../../shared/types';

export interface ResultsPublishConfig {
  enabled: boolean;
  kafkaConfigId: string;
  topic: string;
  detailLevel: 'summary' | 'full';
  messageKey?: string;     // template, e.g. "{{testId}}"
}

export async function publishTestResults(
  config: ResultsPublishConfig,
  testConfig: TestConfig,
  results: RequestResult[],
  testId: string,
  durationMs: number,
): Promise<void> {
  if (!config.enabled) return;

  const summary = {
    testId,
    timestamp: new Date().toISOString(),
    config: {
      executionMode: testConfig.executionMode,
      iterations: testConfig.iterations,
      concurrency: testConfig.concurrency,
    },
    metrics: {
      totalRequests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      avgResponseTimeMs: results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length,
      p50: percentile(results.map(r => r.responseTimeMs), 50),
      p95: percentile(results.map(r => r.responseTimeMs), 95),
      p99: percentile(results.map(r => r.responseTimeMs), 99),
      durationMs,
    },
    ...(config.detailLevel === 'full' ? { results } : {}),
  };

  const key = config.messageKey
    ? config.messageKey.replace('{{testId}}', testId)
    : testId;

  await kafkaOp({
    type: 'produce',
    payload: {
      topic: config.topic,
      messages: [{ key, value: JSON.stringify(summary) }],
    },
  });
}
```

### Step 7.2 — Wire into useTestExecution

After test completion, if Kafka results publishing is configured:

```typescript
// In useTestExecution.ts, after test completes:
if (kafkaResultsConfig?.enabled) {
  try {
    await publishTestResults(kafkaResultsConfig, config, results, executionId, durationMs);
  } catch (err) {
    console.warn('Failed to publish results to Kafka:', err);
  }
}
```

### Step 7.3 — Configuration UI

Already covered in Phase 2 (KafkaSettingsPage has "Test Results Publishing" section per cluster).

### Step 7.4 — Unit Tests

| File | Tests |
|------|-------|
| `useResultsPublisher.test.ts` | Publish summary, publish full, disabled config, error handling, message key template |

---

## Phase 8 — Tauri Native Kafka (Desktop Performance)

**Effort**: 5-7 days
**Prerequisite**: Phases 1-7 working via server proxy
**Mirrors**: Rust executor pattern (Phase 2A of throughput plan)

### Step 8.1 — Rust Dependencies

**File**: `src-tauri/Cargo.toml`

```toml
[dependencies]
rdkafka = { version = "0.39", features = ["cmake-build", "ssl-vendored", "tokio"] }
```

**Note**: `ssl-vendored` bundles OpenSSL statically — avoids system OpenSSL dependency.
`cmake-build` builds librdkafka from source. This adds ~30s to first build.

### Step 8.2 — Rust Types (`src-tauri/src/kafka_types.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConnectionConfig {
    pub brokers: Vec<String>,
    pub client_id: Option<String>,
    pub ssl_enabled: Option<bool>,
    pub sasl_mechanism: Option<String>,  // "plain", "scram-sha-256", "scram-sha-512"
    pub sasl_username: Option<String>,
    pub sasl_password: Option<String>,
    pub connection_timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceRequest {
    pub topic: String,
    pub messages: Vec<KafkaOutboundMessage>,
    pub acks: Option<i32>,       // -1, 0, 1
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaOutboundMessage {
    pub key: Option<String>,
    pub value: String,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub partition: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceResult {
    pub partition: i32,
    pub offset: i64,
    pub timestamp: Option<i64>,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConsumeRequest {
    pub topic: String,
    pub group_id: Option<String>,
    pub max_messages: Option<u32>,
    pub timeout_ms: Option<u64>,
    pub from_beginning: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaInboundMessage {
    pub topic: String,
    pub partition: i32,
    pub offset: i64,
    pub key: Option<String>,
    pub value: Option<String>,
    pub headers: std::collections::HashMap<String, String>,
    pub timestamp: i64,
}
```

### Step 8.3 — Rust Kafka Service (`src-tauri/src/kafka_service.rs`)

```rust
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::consumer::{StreamConsumer, Consumer};
use rdkafka::Message;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::Duration;

pub struct KafkaState {
    producer: Arc<Mutex<Option<FutureProducer>>>,
    config: Arc<Mutex<Option<KafkaConnectionConfig>>>,
}

impl KafkaState {
    pub fn new() -> Self { /* ... */ }

    pub async fn connect(&self, config: KafkaConnectionConfig) -> Result<(), String> {
        // 1. Build ClientConfig with brokers, SASL, SSL
        // 2. Create FutureProducer (has internal polling thread)
        // 3. Test connectivity by fetching metadata
        // 4. Store producer + config
    }

    pub async fn disconnect(&self) -> Result<(), String> {
        // Drop producer, clear config
    }

    pub async fn produce(&self, req: KafkaProduceRequest) -> Result<Vec<KafkaProduceResult>, String> {
        // 1. Get producer from state
        // 2. For each message: producer.send(FutureRecord::to(topic).key(k).payload(v), timeout)
        // 3. Await all futures (concurrent via tokio::join_all)
        // 4. Map DeliveryFuture results → KafkaProduceResult
    }

    pub async fn consume(&self, req: KafkaConsumeRequest) -> Result<Vec<KafkaInboundMessage>, String> {
        // 1. Create temporary StreamConsumer with unique group
        // 2. Subscribe to topic
        // 3. consumer.stream().take(max_messages) with timeout
        // 4. Map messages → KafkaInboundMessage
        // 5. Consumer auto-dropped (commits offsets on drop)
    }

    pub async fn list_topics(&self) -> Result<Vec<String>, String> {
        // Use producer's client to fetch metadata
        // Filter internal topics
    }
}
```

### Step 8.4 — Tauri Commands (`src-tauri/src/kafka_commands.rs`)

```rust
use tauri::State;
use crate::kafka_service::KafkaState;

#[tauri::command]
pub async fn kafka_connect(
    config: KafkaConnectionConfig,
    state: State<'_, KafkaState>,
) -> Result<String, String> {
    state.connect(config).await?;
    Ok("connected".to_string())
}

#[tauri::command]
pub async fn kafka_disconnect(
    state: State<'_, KafkaState>,
) -> Result<(), String> {
    state.disconnect().await
}

#[tauri::command]
pub async fn kafka_produce(
    request: KafkaProduceRequest,
    state: State<'_, KafkaState>,
) -> Result<Vec<KafkaProduceResult>, String> {
    state.produce(request).await
}

#[tauri::command]
pub async fn kafka_consume(
    request: KafkaConsumeRequest,
    state: State<'_, KafkaState>,
) -> Result<Vec<KafkaInboundMessage>, String> {
    state.consume(request).await
}

#[tauri::command]
pub async fn kafka_list_topics(
    state: State<'_, KafkaState>,
) -> Result<Vec<String>, String> {
    state.list_topics().await
}

#[tauri::command]
pub fn is_kafka_available() -> bool {
    true
}
```

### Step 8.5 — Register Commands

**File**: `src-tauri/src/lib.rs`

```rust
.manage(kafka_service::KafkaState::new())
.invoke_handler(tauri::generate_handler![
    // existing:
    commands::start_load_test,
    commands::abort_load_test,
    commands::is_rust_executor_available,
    // new:
    kafka_commands::kafka_connect,
    kafka_commands::kafka_disconnect,
    kafka_commands::kafka_produce,
    kafka_commands::kafka_consume,
    kafka_commands::kafka_list_topics,
    kafka_commands::is_kafka_available,
])
```

### Step 8.6 — TypeScript Bridge Update

**File**: `src/features/kafka/utils/kafkaClient.ts`

Implement `kafkaViaTauri()`:

```typescript
import { invoke } from '@tauri-apps/api/core';

async function kafkaViaTauri(op: KafkaOperation): Promise<unknown> {
  switch (op.type) {
    case 'connect':    return invoke('kafka_connect', { config: op.payload });
    case 'disconnect': return invoke('kafka_disconnect');
    case 'produce':    return invoke('kafka_produce', { request: op.payload });
    case 'consume':    return invoke('kafka_consume', { request: op.payload });
    case 'topics':     return invoke('kafka_list_topics');
    case 'status': {
      const available = await invoke<boolean>('is_kafka_available');
      return { connected: available };
    }
    default: throw new Error(`Unsupported Kafka operation via Tauri: ${op.type}`);
  }
}
```

### Step 8.7 — Rust Unit Tests

**File**: `src-tauri/src/kafka_service_test.rs`

| Test Group | Cases |
|------------|-------|
| Config building | SASL Plain, SCRAM-SHA-256, SSL, no auth |
| Produce | Message serialization, key encoding, header mapping |
| Consume | StreamConsumer config, timeout behavior |
| Serde | Round-trip all request/result types, camelCase field names |

### Step 8.8 — Capability Update

**File**: `src-tauri/capabilities/default.json`

No additional Tauri capabilities needed — `#[tauri::command]` doesn't require permission entries (it's app-level code, not a plugin).

---

## Phase 9 — Transport Abstraction Polish

**Effort**: 2 days
**Prerequisite**: Phases 1-8

### Step 9.1 — Worker Kafka Bridge

**File**: `src/engine/workerProtocol.ts`

Add Kafka message types alongside existing HTTP messages:

```typescript
export type WorkerMessage =
  | { type: 'http-request'; ... }
  | { type: 'http-response'; ... }
  | { type: 'kafka-request'; id: string; operation: KafkaOperationType; payload: unknown }
  | { type: 'kafka-response'; id: string; result: unknown; error?: string }
  // ... existing types
```

### Step 9.2 — Worker Bridge Kafka Proxy

**File**: `src/engine/workerBridge.ts`

Add Kafka message handling (mirrors HTTP proxy at lines 78-99):

```typescript
// In worker message handler:
if (msg.type === 'kafka-request') {
  kafkaOp(msg).then(result => {
    worker.postMessage({ type: 'kafka-response', id: msg.id, result });
  }).catch(err => {
    worker.postMessage({ type: 'kafka-response', id: msg.id, error: String(err) });
  });
}
```

### Step 9.3 — Worker-Side Kafka Transport

**File**: `src/engine/executionWorker.ts`

Add Kafka transport override for workers:

```typescript
setKafkaTransport(async (op) => {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingKafkaRequests.set(id, { resolve, reject });
    self.postMessage({ type: 'kafka-request', id, operation: op.type, payload: op.payload });
  });
});
```

### Step 9.4 — Integration Tests

Verify all three transport paths work identically:
1. Browser → server proxy (`/api/kafka/*`)
2. Tauri → Rust invoke (`kafka_produce`, `kafka_consume`)
3. Worker → main thread → (server proxy or Tauri)

---

## Phase 10 (Optional) — Schema Registry Support

**Effort**: 3-4 days
**Prerequisite**: Phase 1

### Step 10.1 — Install Schema Registry Client

```bash
npm install @kafkajs/confluent-schema-registry
```

### Step 10.2 — Schema Service (`src-server/kafka-schema-service.ts`)

- Connect to Confluent Schema Registry
- `getSchema(schemaId)` → Avro/Protobuf schema
- `encode(topic, payload, schemaId)` → encoded Buffer
- `decode(topic, buffer)` → decoded object + schema metadata
- `listSubjects()` → schema subjects
- `getLatestSchema(subject)` → latest version

### Step 10.3 — REST Routes

```
POST   /api/kafka/schema/connect    — connect to registry
GET    /api/kafka/schema/subjects   — list all subjects
GET    /api/kafka/schema/:subject   — get latest schema
POST   /api/kafka/schema/encode     — encode payload
POST   /api/kafka/schema/decode     — decode buffer
```

### Step 10.4 — UI Integration

- Schema viewer in Topic Browser (click topic → see schema)
- Auto-encode/decode in Kafka Produce/Consume config
- Schema-aware body editor (validates against schema)

---

## Implementation Order & Dependencies

```
Phase 1  — Server-side Kafka service                     [3-4 days]  ← FOUNDATION
  └→ Phase 2  — Kafka config UI + client transport       [2-3 days]
       └→ Phase 3  — KafkaProduce + KafkaConsume nodes   [4-5 days]  ← CORE VALUE
       │    └→ Phase 4  — KafkaTrigger start node        [2-3 days]
       │    └→ Phase 5  — KafkaWait correlation node     [3-4 days]
       └→ Phase 6  — Kafka scenario runner               [3-4 days]
       └→ Phase 7  — Results publisher                   [1-2 days]
  └→ Phase 8  — Tauri native Kafka (Rust)                [5-7 days]  ← PERFORMANCE
       └→ Phase 9  — Transport abstraction polish        [2 days]
  └→ Phase 10 — Schema Registry (optional)               [3-4 days]
```

**Total**: 29-38 days (~6-8 weeks)
**MVP (Phases 1-3)**: 10-12 days → connect + produce/consume in workflows
**Full Feature (1-9)**: 26-34 days → all use cases

---

## Files Touched Per Phase (Summary)

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| **1** | `src-server/kafka-types.ts`, `kafka-service.ts`, `kafka-routes.ts`, tests | `src-server/webhook-server.ts`, `scripts/build-server.mjs`, `package.json` |
| **2** | `src/features/kafka/` (page, components, client, tests), `src/styles/kafka.css` | `src/shared/types/index.ts`, `src/utils/storage.ts`, `src/app/App.tsx`, `AppSubNav.tsx`, `appTabUtils.ts`, `AppHeader.tsx` |
| **3** | Node components, config components, `graphRunnerKafkaHandlers.ts`, tests | `workflow.ts` (types), `workflowNodeFactory.ts`, `WorkflowPalette.tsx`, `WorkflowNodeConfigModal.tsx`, `graphRunner.ts`, `graphRunnerNodeHandlers.ts`, `nodeTypeLabels.ts`, `trace.ts` |
| **4** | `KafkaTriggerNode.tsx`, `KafkaTriggerConfig.tsx`, `kafka-trigger.ts`, tests | Same as Phase 3 type files |
| **5** | `KafkaWaitNode.tsx`, `KafkaWaitConfig.tsx`, `graphRunnerKafkaWaitHandler.ts`, `kafka-correlation-store.ts`, `remoteKafkaCorrelationStore.ts`, tests | `graphRunner.ts`, `graphLoadRunner.ts`, `NodeHandlerContext` |
| **6** | `src/engine/kafkaExecution.ts`, tests | `src/shared/types/index.ts` (Scenario), `executor.ts`, `ScenarioBuilder.tsx` |
| **7** | `src/features/results/hooks/useResultsPublisher.ts`, tests | `useTestExecution.ts` |
| **8** | `src-tauri/src/kafka_types.rs`, `kafka_service.rs`, `kafka_commands.rs`, `kafka_service_test.rs` | `src-tauri/Cargo.toml`, `Cargo.lock`, `src-tauri/src/lib.rs`, `kafkaClient.ts` |
| **9** | — | `workerProtocol.ts`, `workerBridge.ts`, `executionWorker.ts` |
| **10** | `src-server/kafka-schema-service.ts`, schema UI components | `kafka-routes.ts`, `package.json` |

---

## Testing Strategy

| Layer | Framework | Approach |
|-------|-----------|----------|
| Server Kafka service | Vitest | Mock `kafkajs` entirely |
| Server routes | Vitest + supertest | Mock kafka-service functions |
| Kafka client transport | Vitest | Mock fetch / invoke |
| Workflow handlers | Vitest | Mock kafkaOp, test variable extraction + trace |
| Config components | Vitest + @testing-library/react | Component interaction tests |
| Node components | Vitest + @testing-library/react | Render + label tests |
| Rust Kafka | `cargo test` | Mock rdkafka, test serde + config building |
| E2E | Playwright | Requires local Kafka (Docker Compose) |

### Local Kafka for E2E

Provide `docker-compose.kafka.yml`:

```yaml
services:
  kafka:
    image: confluentinc/confluent-local:7.8.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
```

---

## Open Questions

1. **Docker Compose bundling**: Should we include `docker-compose.kafka.yml` in the repo for dev/E2E testing? (Recommended: yes)
2. **Schema Registry**: Is Avro/Protobuf schema support needed for initial release? (Recommend: Phase 10 as optional, ship without it first)
3. **Multi-cluster**: One cluster per environment? Or multiple clusters per environment? (Recommend: multiple — matches enterprise patterns)
4. **Consumer group management**: Auto-generate per workflow run? Or let users manage? (Recommend: auto-generate with override option)
5. **Message retention**: Should KafkaConsume cache recently consumed messages for debugging? (Recommend: last 100 messages in memory, visible in Results Explorer)
6. **Compression**: Support GZIP/Snappy/LZ4/ZSTD in produce? (Recommend: yes, kafkajs supports via codec plugins)
