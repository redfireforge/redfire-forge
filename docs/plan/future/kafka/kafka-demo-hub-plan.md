# Kafka Demo Hub — Lessons Plan

> **Created:** 2026-06-15
> **Branch:** `feature/kafka-demo-hub` (to be cut from `develop`)
> **Domain:** `protocols` (same domain as WS/SSE lessons — `category: 'kafka'`)
> **Lesson files:** `src/features/demo-player/lessons/protocols/kafka-*.ts`
> **Unit tests:** `src/features/demo-player/lessons/protocols/kafka-lessons.test.ts`
> **Existing WS plan reference:** `docs/plan/future/websocket/websocket-demo-hub-plan.md`
> **Status:** 📋 Planning — no lessons shipped yet

---

## Table of Contents

1. [Overview & Goals](#overview--goals)
2. [Architecture Fit](#architecture-fit)
3. [Docker Stacks & Ports](#docker-stacks--ports)
4. [Learning Path Design](#learning-path-design)
5. [Phase Status Tracker](#phase-status-tracker)
6. [Lesson Specifications](#lesson-specifications)
   - [Lesson K1 — Kafka Quick Start](#lesson-k1-kafka-quick-start)
   - [Lesson K2 — Publish Studio](#lesson-k2-publish-studio)
   - [Lesson K3 — Consume Studio](#lesson-k3-consume-studio)
   - [Lesson K4 — Headers & Filters](#lesson-k4-headers--filters)
   - [Lesson K5 — Templates](#lesson-k5-templates)
   - [Lesson K6 — Topic Explorer](#lesson-k6-topic-explorer)
   - [Lesson K7 — Schema Registry](#lesson-k7-schema-registry)
   - [Lesson K8 — Stream Mode](#lesson-k8-stream-mode)
   - [Lesson K9 — Workflow: Produce Node](#lesson-k9-workflow-produce-node)
   - [Lesson K10 — Workflow: Consume & Wait Nodes](#lesson-k10-workflow-consume--wait-nodes)
   - [Lesson K11 — Secure Cluster (SASL/SCRAM)](#lesson-k11-secure-cluster-saslscram)
   - [Lesson K12 — TLS-Encrypted Cluster](#lesson-k12-tls-encrypted-cluster)
   - [Lesson K13 — Run Kafka Workflow in Harness](#lesson-k13-run-kafka-workflow-in-harness)
7. [Selectors](#selectors)
8. [Test Plan](#test-plan)
9. [Unit Test Strategy](#unit-test-strategy)
10. [E2E Mapping](#e2e-mapping)
11. [Open Questions / Risks](#open-questions--risks)

---

## Overview & Goals

**Kafka Demo Hub** adds 13 interactive guided lessons to the Learning Hub's Protocols domain, teaching users how to work with Kafka in RedfireForge — from publishing a first message to running load-tested workflows over TLS.

The lessons mirror the same Learning Hub UX that the 20 WebSocket lessons use:
- Domain card shows `📨 Kafka` category count
- Lesson player with concept panel, step-by-step actions, highlights, prereq gates
- Progress tracked via `useDemoProgress` — survives page reloads
- Docker-backed lessons use `PrerequisiteGate` with `checkEndpoint` auto-polling

**What users will learn end-to-end:**
1. Navigate to Protocols → Kafka and configure a cluster connection
2. Publish messages and inspect results (partition, offset, encoding)
3. Consume messages with filters and explore payloads in the detail pane
4. Add Kafka nodes to workflows (Produce, Consume, Trigger, Wait)
5. Browse topics with Topic Explorer and schema subjects in Schema Registry Browser
6. Stream messages live with auto-scroll
7. Run secure workflows over SASL/SCRAM and TLS
8. Execute a Kafka workflow end-to-end in the Test Harness and inspect results

---

## Architecture Fit

### Category Registration

The `kafka` category is already declared in `src/features/demo-player/lessons/index.ts`:

```typescript
categories: [
  { id: 'kafka',     label: 'Kafka',     icon: '📨' },  // ← already exists
  { id: 'websocket', label: 'WebSocket', icon: '🔌' },
  { id: 'sse',       label: 'SSE',       icon: '📡' },
],
```

Kafka lessons just need `category: 'kafka'` and an entry in the `lessons: [...]` array in `protocolsDomain`.

### Lesson File Naming Convention

```
src/features/demo-player/lessons/protocols/
  kafka-quick-start.ts           # K1
  kafka-publish.ts               # K2
  kafka-consume.ts               # K3
  kafka-headers-filters.ts       # K4
  kafka-templates.ts             # K5
  kafka-topic-explorer.ts        # K6
  kafka-schema-registry.ts       # K7
  kafka-stream-mode.ts           # K8
  kafka-workflow-produce.ts      # K9
  kafka-workflow-consume-wait.ts # K10
  kafka-secure.ts                # K11 🐳 Docker
  kafka-tls.ts                   # K12 🐳 Docker
  kafka-test-runner.ts           # K13
  kafka-lessons.test.ts          # unit tests for all 13 lessons
```

### Setup Helpers

New Kafka-specific setup helpers will be added to `src/features/demo-player/lessons/setup-helpers.ts`:

```typescript
/** Navigate to Protocols → Kafka → ensure cluster is connected (or show gate) */
export async function kafkaSetup(ctx: DemoActionContext): Promise<void>

/** Navigate away from Kafka, no broker cleanup needed */
export async function kafkaCleanup(ctx: DemoActionContext): Promise<void>

/** Navigate to Protocols → Kafka → Topics tab */
export async function kafkaTopicsSetup(ctx: DemoActionContext): Promise<void>

/** Navigate to Protocols → Kafka → Schema Registry tab */
export async function kafkaSchemaSetup(ctx: DemoActionContext): Promise<void>
```

### Selectors Needed

New selectors to add to `src/shared/selectors.ts` under a `KAFKA` namespace (see [Selectors](#selectors) section).

### `useDemoWorkflowBridge`

Lesson K13 (Test Harness) will re-use `window.__wfInsertWorkflow` to seed a `kafkaProduce → kafkaConsume` demo workflow, exactly like Lesson 20 (WS) seeds the WS Echo workflow.

---

## Docker Stacks & Ports

| Stack | Compose file | Broker port | Admin API | Console | Lessons |
|---|---|---|---|---|---|
| **Plaintext** | `docker/kafka/plaintext/docker-compose.yml` | `19092` | `19644` | http://localhost:18080 | K1–K10, K13 |
| **Schema Registry** | `docker/kafka/schema-registry/docker-compose.yml` | `19094` | `19647` | — | K7 |
| **Secure (SASL/SCRAM)** | `docker/kafka/secure/docker-compose.yml` | `19093` | `19645` | — | K11 |
| **TLS (SASL+TLS)** | `docker/kafka/tls/docker-compose.yml` | `19095` | `19648` | — | K12 |

### Start Commands (shown in lesson PrerequisiteGate)

```bash
# Plaintext (K1–K10, K13)
cd docker/kafka/plaintext && docker compose up -d
# Verify: http://localhost:18080 → Redpanda Console

# Schema Registry (K7)
cd docker/kafka/schema-registry && docker compose up -d
# Verify: curl http://localhost:8085/subjects → []

# Secure (K11)
cd docker/kafka/secure && docker compose up -d
# Verify: wait for init container (creates users + topics)

# TLS (K12)
cd docker/kafka/tls && docker compose up -d
# Verify: wait for init container
```

### Health-check endpoints (used by `checkEndpoint`)

| Lesson | `dockerEndpoint` | Notes |
|---|---|---|
| K1–K10, K13 | `http://localhost:18080` | Redpanda Console UI (GET 200) — console service in plaintext compose |
| K7 | `http://localhost:8085` | Schema Registry `GET /subjects` → returns `[]` when ready |
| K11 | `http://localhost:19645` | Redpanda Admin API (secure stack 19645:9644) — HTTP, no auth needed |
| K12 | `http://localhost:19648` | Redpanda Admin API (TLS stack 19648:9644) — HTTP, no auth needed |

---

## Learning Path Design

### Learner-First Progression

Lessons are ordered to build intuition progressively — not by implementation phase:

1. **Quick Start** → cluster setup wizard, 60-second first success (zero-config)
2. **Publish Studio** → send a real message, see partition + offset
3. **Consume Studio** → fetch messages, click a row, read the detail pane
4. **Headers & Filters** → add request headers; filter by key / JSONPath
5. **Templates** → save/load/delete publish and consume templates
6. **Topic Explorer** → browse topics, partitions, consumer groups, health
7. **Schema Registry** → Avro/Protobuf subjects, version browser, schema viewer
8. **Stream Mode** → start a live stream, LIVE badge, auto-scroll, export
9. **Workflow: Produce** → drop a `kafkaProduce` node, configure, Quick Test
10. **Workflow: Consume & Wait** → `kafkaConsume` + `kafkaWait` correlation chain
11. **Secure Cluster (SASL/SCRAM)** 🐳 → connect to SASL broker, run secure workflow
12. **TLS-Encrypted Cluster** 🐳 → connect to TLS+SASL broker, run TLS workflow
13. **Run Kafka Workflow in Harness** → load-test a produce/consume workflow in the Harness

### Category Grouping in the UI

| Category chip | Lessons |
|---|---|
| All | K1–K13 |
| Kafka | K1–K13 |

### Estimated Times

| # | Lesson | Est. | Docker |
|---|---|---|---|
| K1 | Quick Start | 3 min | 🐳 Yes |
| K2 | Publish Studio | 4 min | 🐳 Yes |
| K3 | Consume Studio | 4 min | 🐳 Yes |
| K4 | Headers & Filters | 4 min | 🐳 Yes |
| K5 | Templates | 3 min | No |
| K6 | Topic Explorer | 4 min | 🐳 Yes |
| K7 | Schema Registry | 5 min | 🐳 Yes (SR) |
| K8 | Stream Mode | 4 min | 🐳 Yes |
| K9 | Workflow: Produce | 5 min | 🐳 Yes |
| K10 | Workflow: Consume & Wait | 6 min | 🐳 Yes |
| K11 | Secure Cluster | 6 min | 🐳 Yes (Secure) |
| K12 | TLS Cluster | 6 min | 🐳 Yes (TLS) |
| K13 | Harness Run | 5 min | 🐳 Yes |

---

## Phase Status Tracker

| # | Lesson | ID | File | Status | Steps | E2E Source | Docker |
|---|---|---|---|---|---|---|---|
| K1 | Quick Start | `kafka-quick-start` | `kafka-quick-start.ts` | 🔲 Not started | 7 | `kafka-desktop.spec.ts` | 🐳 Plaintext |
| K2 | Publish Studio | `kafka-publish` | `kafka-publish.ts` | 🔲 Not started | 9 | `kafka-live.spec.ts` | 🐳 Plaintext |
| K3 | Consume Studio | `kafka-consume` | `kafka-consume.ts` | 🔲 Not started | 9 | `kafka-live.spec.ts` | 🐳 Plaintext |
| K4 | Headers & Filters | `kafka-headers-filters` | `kafka-headers-filters.ts` | 🔲 Not started | 8 | `kafka-live.spec.ts` | 🐳 Plaintext |
| K5 | Templates | `kafka-templates` | `kafka-templates.ts` | 🔲 Not started | 7 | — | No |
| K6 | Topic Explorer | `kafka-topic-explorer` | `kafka-topic-explorer.ts` | 🔲 Not started | 9 | `kafka-live.spec.ts` | 🐳 Plaintext |
| K7 | Schema Registry | `kafka-schema-registry` | `kafka-schema-registry.ts` | 🔲 Not started | 9 | `kafka-schema.spec.ts` | 🐳 SR |
| K8 | Stream Mode | `kafka-stream-mode` | `kafka-stream-mode.ts` | 🔲 Not started | 8 | `kafka-live.spec.ts` | 🐳 Plaintext |
| K9 | Workflow: Produce | `kafka-workflow-produce` | `kafka-workflow-produce.ts` | 🔲 Not started | 9 | `kafka-desktop.spec.ts` | 🐳 Plaintext |
| K10 | Workflow: Consume & Wait | `kafka-workflow-consume-wait` | `kafka-workflow-consume-wait.ts` | 🔲 Not started | 10 | `kafka-desktop.spec.ts` | 🐳 Plaintext |
| K11 | Secure Cluster | `kafka-secure` | `kafka-secure.ts` | 🔲 Not started | 9 | — (manual) | 🐳 Secure |
| K12 | TLS Cluster | `kafka-tls` | `kafka-tls.ts` | 🔲 Not started | 9 | — (manual) | 🐳 TLS |
| K13 | Harness Run | `kafka-test-runner` | `kafka-test-runner.ts` | 🔲 Not started | 8 | `kafka-live.spec.ts` | 🐳 Plaintext |

**Total planned:** 13 lessons, 111 steps (sum of per-lesson estimates)

---

## Lesson Specifications

### Lesson K1: Kafka Quick Start

**Why:** First contact — configure a cluster, see it connect, and understand the Kafka nav in RedfireForge in under 3 minutes.

**File:** `src/features/demo-player/lessons/protocols/kafka-quick-start.ts`
**Export:** `kafkaQuickStartLesson`
**Icon:** ⚡ | **Est. time:** 3 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext (`http://localhost:18080`)

#### Concept
- Kafka broker vs cluster ID vs topic
- Why RedfireForge needs a cluster ID (routes API calls to the right broker)
- Settings → Kafka vs Protocols → Kafka (config vs testing)

#### Steps (7)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `ks-intro` | Welcome to Kafka in RedfireForge | `KAFKA_STUDIO_TAB` | Informational — shows the Protocols → Kafka nav |
| 2 | `ks-settings` | Configure a Cluster | `KAFKA_SETTINGS_LINK` | Navigates to Settings → Kafka (link in guard panel) |
| 3 | `ks-create` | Create Your First Cluster | `KAFKA_NEW_CLUSTER_BTN` | Clicks "+ New Cluster" (or "Create First Cluster") |
| 4 | `ks-fill` | Fill in Broker Details | `KAFKA_BROKER_INPUT` | preAction: fills Name="Local Plaintext", Broker="127.0.0.1:19092", Auth=None |
| 5 | `ks-save` | Save the Cluster | `KAFKA_SAVE_BTN` | Clicks Save Cluster |
| 6 | `ks-connect` | Connect | `KAFKA_CONNECT_BTN` | Clicks Connect → waits for status badge to show "connected" |
| 7 | `ks-studio` | Back to the Studio | `KAFKA_STUDIO_TAB` | Navigates to Protocols → Kafka; shows the 4 tabs (Publish/Consume/Topics/Schema Registry) |

**Setup:** Navigate to `kafka-message-studio` tab; show `PrerequisiteGate` for plaintext broker.
**Cleanup:** No-op (cluster config persists intentionally — needed by all subsequent lessons).

**PrerequisiteGate config:**
```typescript
dockerEndpoint: 'http://localhost:18080',
dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
// No dockerDescription field — DemoLesson type only has dockerEndpoint and dockerCommand
```

---

### Lesson K2: Publish Studio

**Why:** Core skill — send a Kafka message and immediately see partition + offset. The Publish tab is the first thing users see when connected.

**File:** `kafka-publish.ts`
**Export:** `kafkaPublishLesson`
**Icon:** 📤 | **Est. time:** 4 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Topics as channels, messages as events
- Partition routing, acks (-1/0/1) — what they mean
- The produce result envelope: `sentCount`, `partition`, `offset`, `valueEncoding`

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `pub-intro` | The Publish Tab | `KAFKA_PUBLISH_TAB` | Informational — overview of all fields |
| 2 | `pub-topic` | Set the Topic | `KAFKA_PUB_TOPIC_INPUT` | preAction: fills `orders.created` |
| 3 | `pub-body` | Write the Message Body | `KAFKA_PUB_BODY_TEXTAREA` | preAction: fills `{"orderId":"DEMO-001","status":"CREATED","amount":99.99}` |
| 4 | `pub-key` | Add a Message Key | `KAFKA_PUB_KEY_INPUT` | preAction: fills `order-demo-001` — explains partition affinity |
| 5 | `pub-acks` | Choose Ack Level | `KAFKA_PUB_ACKS_SELECT` | Informational — explains -1 / 1 / 0 options |
| 6 | `pub-format` | Validate & Format JSON | `KAFKA_PUB_FORMAT_BTN` | Clicks "Validate & Format JSON" → body pretty-prints |
| 7 | `pub-send` | Send Once | `KAFKA_PUB_SEND_BTN` | Clicks "Send Once" — waits for result section to appear |
| 8 | `pub-result` | Inspect the Result | `KAFKA_PUB_RESULT` | Shows partition, offset, timestamp in success panel |
| 9 | `pub-clear` | Clear the Result | `KAFKA_PUB_CLEAR_BTN` | Clicks "Clear" — result disappears |

**Setup:** `kafkaSetup` (navigate to Protocols → Kafka → Publish tab; PrerequisiteGate: plaintext broker).
**Cleanup:** `kafkaCleanup`.

---

### Lesson K3: Consume Studio

**Why:** Consuming is the other half of the Kafka loop. Users must understand how to fetch bounded message sets, click rows, and read the detail pane.

**File:** `kafka-consume.ts`
**Export:** `kafkaConsumeLesson`
**Icon:** 📥 | **Est. time:** 4 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Consumer group ID and offset management
- `startPosition` (earliest vs latest)
- `maxMessages` and `timeoutMs` — how bounded consumption works
- The consume result table: `#`, `Offset`, `Partition`, `Key`, `Value` columns

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `con-intro` | The Consume Tab | `KAFKA_CONSUME_TAB` | Clicks Consume tab — shows all fields |
| 2 | `con-topic` | Set the Topic | `KAFKA_CON_TOPIC_INPUT` | preAction: fills `orders.created` (from Lesson K2) |
| 3 | `con-position` | Start from Earliest | `KAFKA_CON_POSITION_SELECT` | preAction: sets Start Position to "Earliest" |
| 4 | `con-max` | Limit Messages | `KAFKA_CON_MAX_INPUT` | preAction: sets Max Messages to `5` |
| 5 | `con-consume` | Consume Once | `KAFKA_CON_CONSUME_BTN` | Clicks "Consume Once" — waits for results table |
| 6 | `con-table` | The Results Table | `KAFKA_CON_RESULTS_ZONE` | Shows row count, offset/partition/key/value columns |
| 7 | `con-row` | Click a Row | `KAFKA_CON_RESULTS_ZONE` | preAction: clicks first row — detail pane slides in |
| 8 | `con-detail` | The Detail Pane | `KAFKA_CON_DETAIL_PANE` | Shows pretty-printed payload, Copy Key, Copy Payload |
| 9 | `con-export` | Export the Result Set | `KAFKA_CON_EXPORT_BTN` | Clicks "Export Result Set" — downloads JSON file |

**Setup:** `kafkaSetup` (PrerequisiteGate: plaintext broker). Pre-seeds `orders.created` topic with 3 messages via rpk (in setup action, not shown as a step).
**Cleanup:** `kafkaCleanup`.

---

### Lesson K4: Headers & Filters

**Why:** Headers and filters are essential for production Kafka workflows — traceability, correlation, and selective consumption.

**File:** `kafka-headers-filters.ts`
**Export:** `kafkaHeadersFiltersLesson`
**Icon:** 🔍 | **Est. time:** 4 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Kafka headers as metadata (traceId, source, env) — different from message body
- Filter types: Key Equals, Header Match (`key=value`), JSONPath, JSONPath Equals
- Why filters matter: debugging specific events from a high-volume topic

#### Steps (8)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `hf-headers-intro` | Adding Message Headers | `KAFKA_PUB_HEADER_ADD_BTN` | Publish tab — explains headers section |
| 2 | `hf-add-header` | + Add a Header | `KAFKA_PUB_HEADER_ADD_BTN` | Clicks "+ Add" — new row appears |
| 3 | `hf-fill-header` | Fill Key and Value | `KAFKA_PUB_BODY_TEXTAREA` | preAction: fills header key=`traceId`, value=`abc-001`; fills topic=`headers.demo`, body=`{"orderId":"HDR-001","status":"CREATED"}` |
| 4 | `hf-send-header` | Send with Header | `KAFKA_PUB_SEND_BTN` | Clicks "Send Once" — sees result |
| 5 | `hf-filter-intro` | Consume Filters | `KAFKA_CON_TOPIC_INPUT` | Switches to Consume tab — shows filter fields |
| 6 | `hf-key-filter` | Filter by Key | `KAFKA_CON_KEY_FILTER_INPUT` | preAction: sets topic=`headers.demo`, position=earliest, keyEquals=`HDR-001`; clicks "Consume Once" |
| 7 | `hf-jsonpath` | JSONPath Filter | `KAFKA_CON_JSONPATH_INPUT` | preAction: clears key filter, sets JSONPath=`$.status`, JSONPath Equals=`CREATED`; clicks "Consume Once" |
| 8 | `hf-detail` | Headers in the Detail Pane | `KAFKA_CON_DETAIL_PANE` | Clicks a result row — shows headers table in detail pane with `traceId: abc-001` |

**Setup:** `kafkaSetup` (PrerequisiteGate: plaintext broker + topic `headers.demo` created by setup).
**Cleanup:** `kafkaCleanup`.

---

### Lesson K5: Templates

**Why:** Templates save repeated consume/publish setups — essential for teams and repeated test runs.

**File:** `kafka-templates.ts`
**Export:** `kafkaTemplatesLesson`
**Icon:** 📋 | **Est. time:** 3 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** No (templates work without a live broker)

#### Concept
- Publish templates: save the full form (topic, key, acks, headers, body, schema config)
- Consume templates: save all consume fields except `groupId` (stripped on load — each session gets a fresh group)
- Templates are stored in `localStorage` and persist across page reloads

#### Steps (7)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `tmpl-intro` | Saving a Publish Template | `KAFKA_PUB_SAVE_BTN` | Publish tab — informational about the Save button |
| 2 | `tmpl-fill-pub` | Fill a Publish Form | `KAFKA_PUB_TOPIC_INPUT` | preAction: fills topic=`orders.events`, body=`{"type":"test"}` |
| 3 | `tmpl-save-pub` | Save as "Orders Template" | `KAFKA_PUB_SAVE_BTN` | Clicks Save → name input appears → types "Orders Template" → presses Enter |
| 4 | `tmpl-load-pub` | Load ▾ the Template | `KAFKA_PUB_LOAD_BTN` | Clicks "Load ▾" → dropdown shows "Orders Template" → clicks it → form refills |
| 5 | `tmpl-delete-pub` | Delete the Template | `KAFKA_PUB_LOAD_BTN` | Opens dropdown again → clicks × next to "Orders Template" → "No saved templates" |
| 6 | `tmpl-consume` | Consume Templates Work the Same | `KAFKA_CON_SAVE_BTN` | Switches to Consume tab — shows Save/Load buttons for consume |
| 7 | `tmpl-persist` | Templates Persist | `KAFKA_PUB_LOAD_BTN` | Informational — note about localStorage persistence; demonstrates reload survives |

**Setup:** Navigate to Protocols → Kafka → Publish. No Docker needed.
**Cleanup:** Remove any saved templates created during the demo (via `localStorage.removeItem`).

---

### Lesson K6: Topic Explorer

**Why:** Topic Explorer is the power tool for understanding what's in a Kafka cluster — partitions, consumer groups, health, traffic — without writing code.

**File:** `kafka-topic-explorer.ts`
**Export:** `kafkaTopicExplorerLesson`
**Icon:** 🗂️ | **Est. time:** 4 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Topics as durable append-only logs
- Partition count vs replication factor vs consumer group lag
- Health badges: Healthy / Degraded / Unknown
- Domain chips: auto-generated from topic name prefixes (`orders.*`, `payments.*`)

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `te-intro` | The Topics Tab | `KAFKA_TOPICS_TAB` | Clicks Topics tab — shows two-panel layout |
| 2 | `te-list` | Topic List | `KAFKA_TOPIC_TABLE` | Shows topic rows: name, parts, repl, traffic, CGs, health |
| 3 | `te-search` | Search Topics | `KAFKA_TOPIC_SEARCH` | preAction: fills "orders" → only orders.* topics remain |
| 4 | `te-chips` | Domain Chips | `KAFKA_TOPIC_CHIPBAR` | Clears search → clicks "orders" domain chip |
| 5 | `te-filters` | Partition & Health Filters | `KAFKA_TOPIC_HEALTH_FILTER` | Informational — explains Health / Partition / Retention dropdowns |
| 6 | `te-select` | Select a Topic | `KAFKA_TOPIC_TABLE` | Clicks `orders.created` row — detail panel opens on the right |
| 7 | `te-metrics` | Partition Metrics | `KAFKA_TOPIC_METRICS_ROW` | Shows 4 metric boxes: Messages, Partitions, Replicas, CGS |
| 8 | `te-tabs` | Detail Tabs | `KAFKA_DETAIL_TABS` | Clicks Partitions tab → shows leader, HWM, ISR fraction |
| 9 | `te-cg` | Consumer Groups | `KAFKA_DETAIL_GROUPS_TAB` | Clicks Consumer Groups tab → shows lag, state badges |

**Setup:** `kafkaTopicsSetup` (PrerequisiteGate: plaintext broker; seed topics orders.created, orders.events with messages).
**Cleanup:** `kafkaCleanup`.

---

### Lesson K7: Schema Registry

**Why:** Avro and Protobuf are universal in production Kafka. The Schema Registry Browser is the only way to browse subjects without using the CLI.

**File:** `kafka-schema-registry.ts`
**Export:** `kafkaSchemaRegistryLesson`
**Icon:** 📜 | **Est. time:** 5 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Schema Registry stack (`http://localhost:8085`)

#### Concept
- Schema Registry as a contract store: subject = topic + `-value` or `-key`
- Schema evolution: version 1, 2, 3 — backward / forward / full compatibility
- Avro vs Protobuf vs JSON Schema — when to use each
- How RedfireForge encodes/decodes messages using registered schemas

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `sr-intro` | The Schema Registry Tab | `KAFKA_SCHEMA_TAB` | Clicks Schema Registry tab — shows URL input + empty state |
| 2 | `sr-url` | Enter the Registry URL | `KAFKA_SCHEMA_URL_INPUT` | preAction: fills `http://localhost:8085` |
| 3 | `sr-connect` | Connect to Registry | `KAFKA_SCHEMA_CONNECT_BTN` | Clicks "Connect to Registry" — subject list loads |
| 4 | `sr-list` | Subject List | `KAFKA_SCHEMA_SUBJECT_TABLE` | Shows subjects with format badges (Avro / Protobuf / JSON Schema) |
| 5 | `sr-filter` | Filter Subjects | `KAFKA_SCHEMA_SEARCH` | preAction: fills "avro" → only Avro subjects remain |
| 6 | `sr-select` | Select a Subject | `KAFKA_SCHEMA_SUBJECT_TABLE` | Clicks first Avro subject row — detail panel opens |
| 7 | `sr-schema` | Read the Schema | `KAFKA_SCHEMA_CONTENT` | Shows Avro JSON schema in the viewer |
| 8 | `sr-version` | Switch Versions | `KAFKA_SCHEMA_VERSION_SELECT` | Opens version dropdown — selects v1 if multiple versions exist |
| 9 | `sr-copy` | Copy the Schema | `KAFKA_SCHEMA_COPY_BTN` | Clicks "Copy to Clipboard" action button |

**Setup:** `kafkaSchemaSetup` (PrerequisiteGate: Schema Registry broker on 8085; connect cluster at `127.0.0.1:19094`).
**Cleanup:** `kafkaCleanup`.

**PrerequisiteGate:**
```typescript
dockerEndpoint: 'http://localhost:8085',
dockerCommand: 'cd docker/kafka/schema-registry && docker compose up -d',
// No dockerDescription field — DemoLesson type only has dockerEndpoint and dockerCommand
```

---

### Lesson K8: Stream Mode

**Why:** Stream mode is the debugging superpower for event-driven systems — watch messages arrive live without polling.

**File:** `kafka-stream-mode.ts`
**Export:** `kafkaStreamModeLesson`
**Icon:** 📡 | **Est. time:** 4 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Difference between Consume Once (bounded) and Stream (unbounded)
- How LIVE badge, auto-scroll, and cursor gap badge work
- When to use streaming: debugging trigger topics, observing real-time pipelines
- Export Stream — captures the full session for offline analysis

#### Steps (8)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `sm-intro` | Stream Mode | `KAFKA_CON_MODE_TABS` | Consume tab — clicks "Stream" mode tab |
| 2 | `sm-topic` | Set the Topic | `KAFKA_CON_TOPIC_INPUT` | preAction: fills `redfireforge.debug.consume`, position=latest |
| 3 | `sm-start` | Start Stream | `KAFKA_STREAM_START_BTN` | Clicks "Start Stream" — LIVE badge appears |
| 4 | `sm-live` | LIVE Badge + Counter | `KAFKA_STREAM_LIVE_BADGE` | Informational — explains LIVE animation and message counter |
| 5 | `sm-scroll` | Auto-Scroll | `KAFKA_STREAM_RESULTS_ZONE` | Informational — explains auto-scroll and how scrolling up pauses it |
| 6 | `sm-row` | Click a Stream Message | `KAFKA_STREAM_RESULTS_ZONE` | Clicks first row in stream table — detail pane slides in |
| 7 | `sm-stop` | Stop Stream | `KAFKA_STREAM_STOP_BTN` | Clicks "Stop Stream" — LIVE badge disappears, messages preserved |
| 8 | `sm-export` | Export Stream | `KAFKA_STREAM_EXPORT_BTN` | Clicks "Export Stream" — downloads JSON file |

**Setup:** `kafkaSetup` (PrerequisiteGate: plaintext broker). Setup invokes `docker/kafka/topics/stream-producer.sh` in a background process to produce live messages.
**Note:** `stream-producer.sh` exists at `docker/kafka/topics/stream-producer.sh` — produces one message per 2s to `redfireforge.debug.consume`. No external dependency needed.
**Cleanup:** Stop stream (if running) → `kafkaCleanup`.

---

### Lesson K9: Workflow: Produce Node

**Why:** `kafkaProduce` is the most common Kafka workflow node. Users must be able to drop it, configure it, and Quick Test it confidently.

**File:** `kafka-workflow-produce.ts`
**Export:** `kafkaWorkflowProduceLesson`
**Icon:** 🔗 | **Est. time:** 5 min | **initialTab:** `workflow`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Workflow nodes vs Studio tabs: nodes are part of automated sequences; Studio is ad-hoc testing
- `kafkaProduce` node: cluster ID, topic, body template with `{{variable}}` syntax, headers, output bindings
- Quick Test seeding vs live broker execution

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `wp-intro` | Kafka Produce Node | `WORKFLOW_CANVAS` | Navigates to Workflow — informational overview |
| 2 | `wp-new` | Create a New Workflow | `WORKFLOW_NEW_BTN` | Clicks "+ New Workflow" (or uses seeded workflow) |
| 3 | `wp-palette` | Open Node Palette | `WORKFLOW_ADD_NODE_BTN` | Clicks "+ Add Node" — palette opens |
| 4 | `wp-drag` | Drop kafkaProduce | `KAFKA_NODE_PRODUCE` | Searches "kafka" in palette → clicks "Kafka Produce" to add |
| 5 | `wp-config` | Configure the Node | `WORKFLOW_NODE_CONFIG_BTN` | Double-clicks node to open config modal |
| 6 | `wp-fields` | Fill Config Fields | `KAFKA_NODE_TOPIC_INPUT` | preAction: sets Cluster=`local-plaintext`, Topic=`orders.created`, Body=`{"demo":"workflow"}` |
| 7 | `wp-bindings` | Add an Output Binding | `KAFKA_NODE_BINDING_ADD_BTN` | Clicks "+ Binding" → sets source=`partition`, targetVariable=`sentPartition` |
| 8 | `wp-quicktest` | Quick Test | `WORKFLOW_QUICKTEST_BTN` | Clicks "Quick Test" — waits for PASS status |
| 9 | `wp-result` | Read the Console | `WORKFLOW_CONSOLE` | Shows PRODUCE log: topic, cluster, sentCount, partition, offset |

**Setup:** Seeds a minimal Start→kafkaProduce→End workflow via `__wfInsertWorkflow`. PrerequisiteGate: plaintext broker + `local-plaintext` cluster connected.
**Cleanup:** Deletes the seeded workflow via `__wfDeleteByName('Kafka Produce Demo')`.

---

### Lesson K10: Workflow: Consume & Wait Nodes

**Why:** `kafkaConsume` and `kafkaWait` are the inbound half — they complete the event-driven round-trip. The correlation pattern in `kafkaWait` is especially important.

**File:** `kafka-workflow-consume-wait.ts`
**Export:** `kafkaWorkflowConsumeWaitLesson`
**Icon:** ⏱️ | **Est. time:** 6 min | **initialTab:** `workflow`
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- `kafkaConsume` vs `kafkaWait`: Consume reads N messages from a topic; Wait blocks until a correlated message arrives
- Correlation matching: match on a key, header, or JSONPath expression
- `kafkaWait` sample payload for Quick Test (avoids hanging forever)
- Output bindings from consume: `messageBody`, `messageKey`, `headerValue`
- Load test behavior: `auto-resume` vs `wait-for-real` vs `synthetic-inject`

#### Steps (10)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `cw-intro` | Consume and Wait Nodes | `WORKFLOW_CANVAS` | Informational — shows 4-node chain: Produce → Wait |
| 2 | `cw-consume-add` | Drop kafkaConsume | `WORKFLOW_ADD_NODE_BTN` | Palette → "Kafka Consume" → adds node |
| 3 | `cw-consume-config` | Configure Consume | `KAFKA_NODE_TOPIC_INPUT` | preAction: Topic=`orders.created`, Max=3, Timeout=5000, StartPosition=earliest |
| 4 | `cw-consume-binding` | Bind First Message Body | `KAFKA_NODE_BINDING_ADD_BTN` | + Binding: source=`firstMessageBody`, target=`firstOrder` |
| 5 | `cw-consume-test` | Quick Test Consume | `WORKFLOW_QUICKTEST_BTN` | Runs Quick Test → sees CONSUME log + variable `firstOrder` extracted |
| 6 | `cw-wait-intro` | The Wait Node | `WORKFLOW_ADD_NODE_BTN` | Informational — explains event-driven blocking |
| 7 | `cw-wait-add` | Drop kafkaWait | `WORKFLOW_ADD_NODE_BTN` | Palette → "Kafka Wait" → adds after Produce node |
| 8 | `cw-wait-config` | Configure Wait + Sample Payload | `KAFKA_WAIT_SAMPLE_TEXTAREA` | preAction: Topic=`payments.confirmed`, JSONPath=`$.orderId`, matches variable `{{orderId}}`; paste sample payload |
| 9 | `cw-wait-test` | Quick Test with Sample | `WORKFLOW_QUICKTEST_BTN` | Quick Test resolves Wait instantly using sample payload |
| 10 | `cw-load-mode` | Load Test Behavior | `KAFKA_WAIT_LOAD_MODE_SELECT` | Shows `auto-resume` mode — explains why it's needed for load tests |

**Setup:** Seeds a Start→kafkaProduce→kafkaWait→End workflow. PrerequisiteGate: plaintext broker.
**Cleanup:** Deletes seeded workflow.

---

### Lesson K11: Secure Cluster (SASL/SCRAM)

**Why:** Almost every production Kafka cluster requires authentication. SASL/SCRAM is the most common mechanism. Users must know how to add auth credentials and verify them before running workflows.

**File:** `kafka-secure.ts`
**Export:** `kafkaSecureLesson`
**Icon:** 🔐 | **Est. time:** 6 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 Secure stack (port 19093)

#### Concept
- SASL: Simple Authentication and Security Layer — framework for auth mechanisms
- SCRAM-SHA-256: challenge-response, credentials checked by broker (no plaintext password on wire)
- How RedfireForge stores auth: cluster config in `kafkaStorage` — credentials never leave the device
- Testing auth: test connection before saving cluster config

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `sec-intro` | Secure Kafka Cluster | `KAFKA_SETTINGS_LINK` | Navigates to Settings → Kafka — informational |
| 2 | `sec-new` | Create a Secure Cluster | `KAFKA_NEW_CLUSTER_BTN` | Clicks "+ New Cluster" |
| 3 | `sec-broker` | Set Broker and Name | `KAFKA_BROKER_INPUT` | preAction: Name=`Local Secure`, Broker=`127.0.0.1:19093` |
| 4 | `sec-auth` | Enable SCRAM-SHA-256 | `KAFKA_AUTH_TYPE_SELECT` | Sets Auth Type to "SCRAM-SHA-256" |
| 5 | `sec-creds` | Enter Credentials | `KAFKA_AUTH_USER_INPUT` | preAction: fills Username=`redfireforge-app`, Password=`app-password` |
| 6 | `sec-test` | Test Connection | `KAFKA_TEST_BTN` | Clicks "Test Connection" → waits for success indicator |
| 7 | `sec-save` | Save and Connect | `KAFKA_SAVE_BTN` | Clicks Save → then Connect → badge shows Connected |
| 8 | `sec-publish` | Publish to a Secure Topic | `KAFKA_PUB_SEND_BTN` | Switches to Publish tab; preAction: topic=`redfireforge.workflow.test`, body=`{"demo":"secure"}`; clicks Send Once |
| 9 | `sec-result` | Verify Secure Publish | `KAFKA_PUB_RESULT` | Shows success result — confirms messages travel over authenticated connection |

**Setup:** PrerequisiteGate: Secure Docker stack (port 19093).
**Cleanup:** No-op (cluster config kept for K12 follow-up).

**PrerequisiteGate:**
```typescript
dockerEndpoint: 'http://localhost:19645',    // Redpanda Admin API (secure stack: 19645:9644)
dockerCommand: 'cd docker/kafka/secure && docker compose up -d',
// No dockerDescription field — DemoLesson type only has dockerEndpoint and dockerCommand
```

---

### Lesson K12: TLS-Encrypted Cluster

**Why:** TLS is mandatory in cloud/enterprise Kafka. Users must know how to configure TLS and handle self-signed certificate trust in RedfireForge.

**File:** `kafka-tls.ts`
**Export:** `kafkaTlsLesson`
**Icon:** 🛡️ | **Est. time:** 6 min | **initialTab:** `kafka-message-studio`
**Category:** `kafka` | **Docker:** 🐳 TLS stack (port 19095)

#### Concept
- TLS: encrypts all data in transit — even with SASL, without TLS the auth handshake and messages are plain
- Self-signed certificates: common in local dev; `verifyCert: false` disables strict check
- How to view the certificate CN/issuer from the cluster config panel
- TLS + SASL: they are orthogonal — TLS is the transport layer, SASL is the auth layer

#### Steps (9)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `tls-intro` | TLS Encryption for Kafka | `KAFKA_SETTINGS_LINK` | Informational — navigates to Settings → Kafka |
| 2 | `tls-new` | Create a TLS Cluster | `KAFKA_NEW_CLUSTER_BTN` | Clicks "+ New Cluster" |
| 3 | `tls-broker` | Set Broker Details | `KAFKA_BROKER_INPUT` | preAction: Name=`Local TLS`, Broker=`127.0.0.1:19095` |
| 4 | `tls-auth` | Enable SCRAM Auth | `KAFKA_AUTH_TYPE_SELECT` | Sets Auth=SCRAM-SHA-256, User=`redfireforge-app`, Pass=`app-password` |
| 5 | `tls-enable` | Enable TLS | `KAFKA_TLS_TOGGLE` | Checks "Enable TLS" — cert section appears |
| 6 | `tls-ca` | Trust Self-Signed Cert | `KAFKA_TLS_VERIFY_TOGGLE` | Unchecks "Verify server certificate" — explains why needed for local self-signed CA |
| 7 | `tls-test` | Test Connection | `KAFKA_TEST_BTN` | Clicks "Test Connection" — verifies TLS handshake succeeds |
| 8 | `tls-save` | Save and Connect | `KAFKA_SAVE_BTN` | Saves → Connects → badge shows Connected |
| 9 | `tls-publish` | Publish over TLS | `KAFKA_PUB_SEND_BTN` | Publish tab → topic=`orders.created` → body=`{"demo":"tls"}` → Send Once → success result |

**Setup:** PrerequisiteGate: TLS Docker stack (port 19095).
**Cleanup:** No-op.

**PrerequisiteGate:**
```typescript
dockerEndpoint: 'http://localhost:19648',    // Redpanda Admin API (TLS stack: 19648:9644)
dockerCommand: 'cd docker/kafka/tls && docker compose up -d',
// No dockerDescription field — DemoLesson type only has dockerEndpoint and dockerCommand
```

---

### Lesson K13: Run Kafka Workflow in Harness

**Why:** The end-to-end capstone. Users experience the full Kafka loop — produce a message in a workflow, run it in the Test Harness as a load test, and inspect the results in the Results Dashboard.

**File:** `kafka-test-runner.ts`
**Export:** `kafkaTestRunnerLesson`
**Icon:** 🏁 | **Est. time:** 5 min | **initialTab:** none (manages its own navigation)
**Category:** `kafka` | **Docker:** 🐳 Plaintext

#### Concept
- Workflow Runner vs Standard Runner: the Workflow Runner runs a named workflow end-to-end; the Standard Runner executes scenario groups
- Kafka results in the Results Dashboard: `PRODUCE` and `CONSUME` badges instead of HTTP status codes
- TPS, request count, and error rate for Kafka workflows
- Results publishing: run summary sent to a Kafka topic for CI/CD integration

#### Steps (8)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `kr-intro` | Kafka Workflow in the Harness | `HARNESS_WF_RUNNER_TAB` | Navigates to Harness → Workflow Runner |
| 2 | `kr-pick` | Select the Demo Workflow | `HARNESS_WF_PICKER` | Selects "Kafka Produce Demo" from workflow picker dropdown |
| 3 | `kr-vars` | Inspect Initial Variables | `HARNESS_WF_VARS` | Shows `clusterId=local-plaintext` variable pre-set by setup |
| 4 | `kr-iterations` | Set Iterations | `HARNESS_ITERATIONS_INPUT` | preAction: sets Iterations=3, Concurrency=1 |
| 5 | `kr-run` | Run the Workflow | `HARNESS_RUN_BTN` | Clicks "▶ Run Workflow" — progress bar fills |
| 6 | `kr-results` | Workflow Completed | `HARNESS_COMPLETION_BANNER` | Shows timing banner: iterations/TPS/requests/errors |
| 7 | `kr-dashboard` | View Results Dashboard | `HARNESS_RESULTS_LINK` | Clicks "View Results" → navigates to Results Dashboard |
| 8 | `kr-badges` | PRODUCE Badges | `RESULTS_TABLE` | Shows `PRODUCE` badge in the status column (not "200 OK") |

**Setup:** Navigates to Harness; seeds "Kafka Produce Demo" workflow via `__wfInsertWorkflow`; ensures `local-plaintext` cluster is connected.
**Cleanup:** Deletes seeded workflow via `__wfDeleteByName('Kafka Produce Demo')`.

**Seeded workflow (Start → kafkaProduce → End):**
```typescript
function createKafkaProduceDemoWorkflow(): Record<string, unknown> {
  // Start → kafkaProduce(topic: orders.created, clusterId: local-plaintext, body: {"demo":"harness-{{runId}}"}) → End
  // variables: { clusterId: 'local-plaintext', runId: 'demo-001' }
}
```

---

## Selectors

New selectors to add to `src/shared/selectors.ts` under a `KAFKA` export object.

> **Verification status:** All `data-testid` values below were cross-checked against the actual TSX source files. Selectors using CSS class or text-based matching are noted where no testid exists; those may need `data-testid` attributes added to TSX during lesson implementation.

```typescript
export const KAFKA = {
  // ── Navigation ──────────────────────────────────────────────────────
  // Note: KafkaMessageStudioPage root uses class `.kafka-message-studio-page` — no data-testid
  STUDIO_PAGE:              '.kafka-message-studio-page',
  // Note: Publish/Consume tabs have no data-testid; use scoped text selectors
  PUBLISH_TAB:              '.kafka-ms-studio-tabs button:has-text("Publish")',
  CONSUME_TAB:              '.kafka-ms-studio-tabs button:has-text("Consume")',
  TOPICS_TAB:               '[data-testid="tab-topics"]',
  SCHEMA_TAB:               '[data-testid="tab-schema"]',
  // KafkaStudioGuard: guard-action-btn is the "→ Open Kafka Settings" / "→ Add a cluster" button
  SETTINGS_LINK:            '[data-testid="guard-action-btn"]',
  GUARD_SUBTITLE:           '[data-testid="guard-subtitle"]',

  // ── Settings Page ───────────────────────────────────────────────────
  SETTINGS_PAGE:            '[data-testid="kafka-settings-page"]',
  SETTINGS_LIST:            '[data-testid="kafka-settings-list"]',
  // Add-cluster toolbar button (shown when clusters already exist)
  ADD_CLUSTER_BTN:          '[data-testid="kafka-add-cluster-btn"]',
  // Create-first-cluster button (shown on empty state)
  EMPTY_CREATE_BTN:         '[data-testid="kafka-empty-create-btn"]',
  // Combined selector for either variant — use in lessons that don't distinguish
  NEW_CLUSTER_BTN:          '[data-testid="kafka-add-cluster-btn"], [data-testid="kafka-empty-create-btn"]',
  CLUSTER_EDITOR:           '[data-testid="kafka-cluster-editor"]',
  // Cluster save button (KafkaClusterEditor)
  SAVE_BTN:                 '[data-testid="kafka-save-cluster-btn"]',
  // Connection action buttons have no data-testid — use text selectors
  CONNECT_BTN:              '.kafka-shell-actions button:has-text("Connect")',
  TEST_BTN:                 '.kafka-shell-actions button:has-text("Test Connection")',
  DISCONNECT_BTN:           '.kafka-shell-actions button:has-text("Disconnect")',
  AUTO_CONNECT_TOGGLE:      '[data-testid="kafka-auto-connect-toggle"]',
  BROKER_INPUT:             'input[placeholder="127.0.0.1:19092"]',
  // Auth mode: id="kafka-auth-mode"
  AUTH_TYPE_SELECT:         '#kafka-auth-mode',
  // Auth credential fields
  AUTH_USER_INPUT:          '#kafka-auth-username',
  AUTH_PASS_INPUT:          '#kafka-auth-password',
  TLS_TOGGLE:               'label:has-text("Enable TLS") input[type="checkbox"]',
  TLS_VERIFY_TOGGLE:        'label:has-text("Verify server certificate") input[type="checkbox"]',

  // ── Publish Studio ──────────────────────────────────────────────────
  PUB_TOPIC_INPUT:          '#kms-pub-topic',
  PUB_KEY_INPUT:            '#kms-pub-key',
  PUB_ACKS_SELECT:          '#kms-pub-acks',
  PUB_BODY_TEXTAREA:        '#kms-pub-body',
  // Header row add button (no testid — use class)
  PUB_HEADER_ADD_BTN:       '.kafka-ms-add-btn',
  PUB_FORMAT_BTN:           'button:has-text("Validate & Format JSON")',
  PUB_SEND_BTN:             '[data-testid="pub-send-btn"]',
  PUB_RESULT:               '[data-testid="pub-result"]',
  PUB_ERROR:                '[data-testid="pub-error"]',
  // Template buttons have no testid — use scoped text selectors
  PUB_SAVE_BTN:             '.kafka-ms-template-controls button:has-text("Save")',
  PUB_LOAD_BTN:             '.kafka-ms-template-controls button:has-text("Load")',

  // ── Consume Studio ──────────────────────────────────────────────────
  CON_TOPIC_INPUT:          '#kms-con-topic',
  CON_GROUP_INPUT:          '#kms-con-group',
  CON_POSITION_SELECT:      '#kms-con-pos',
  CON_MAX_INPUT:            '#kms-con-max',
  CON_TIMEOUT_INPUT:        '#kms-con-timeout',
  CON_SORT_ORDER:           '[data-testid="con-sort-order"]',
  CON_KEY_FILTER_INPUT:     '#kms-con-key',
  CON_HEADER_FILTER_INPUT:  '#kms-con-header',
  CON_JSONPATH_INPUT:       '#kms-con-jsonpath',
  CON_JSONVAL_INPUT:        '#kms-con-jsonval',
  CON_MODE_TABS:            '[data-testid="con-mode-tabs"]',
  CON_MODE_ONCE:            '[data-testid="con-mode-once"]',
  CON_MODE_STREAM:          '[data-testid="con-mode-stream"]',
  CON_CONSUME_BTN:          '[data-testid="con-consume-btn"]',
  CON_RESULTS_ZONE:         '[data-testid="con-results-zone"]',
  CON_DETAIL_PANE:          '[data-testid="con-detail-pane"]',
  CON_DETAIL_BODY:          '[data-testid="con-detail-body"]',
  CON_COPY_KEY_BTN:         '[data-testid="con-copy-key-btn"]',
  CON_COPY_PAYLOAD_BTN:     '[data-testid="con-copy-payload-btn"]',
  CON_EXPORT_BTN:           '[data-testid="con-export-btn"]',
  CON_CLEAR_BTN:            '[data-testid="con-clear-btn"]',
  CON_ERROR:                '[data-testid="con-error"]',
  CON_LOAD_MORE_BTN:        '[data-testid="con-load-more-btn"]',
  CON_MAX_REACHED:          '[data-testid="con-max-reached"]',
  CON_TIMED_OUT:            '[data-testid="con-timed-out"]',
  // Template buttons (consume side)
  CON_SAVE_BTN:             '.kafka-ms-template-controls button:has-text("Save")',
  CON_LOAD_BTN:             '.kafka-ms-template-controls button:has-text("Load")',

  // ── Stream Mode ─────────────────────────────────────────────────────
  // Stream action row
  STREAM_ACTION_ROW:        '[data-testid="stream-action-row"]',
  STREAM_START_BTN:         '[data-testid="stream-start-btn"]',
  STREAM_STOP_BTN:          '[data-testid="stream-stop-btn"]',
  STREAM_EXPORT_BTN:        '[data-testid="stream-export-btn"]',
  STREAM_CLEAR_BTN:         '[data-testid="stream-clear-btn"]',
  STREAM_RESULTS_ZONE:      '[data-testid="stream-results-zone"]',
  STREAM_COUNT:             '[data-testid="stream-count"]',
  STREAM_LIVE_BADGE:        '[data-testid="stream-live-badge"]',
  STREAM_CURSOR_GAP:        '[data-testid="stream-cursor-gap"]',
  STREAM_ERROR:             '[data-testid="stream-error"]',

  // ── Topic Explorer ───────────────────────────────────────────────────
  TOPIC_EXPLORER_PAGE:      '[data-testid="topic-explorer-page"]',
  TOPIC_SEARCH:             '[data-testid="topic-search"]',
  TOPIC_HEALTH_FILTER:      '[data-testid="health-filter"]',
  TOPIC_PARTITION_FILTER:   '[data-testid="partition-filter"]',
  TOPIC_RETENTION_FILTER:   '[data-testid="retention-filter"]',
  TOPIC_CHIPBAR:            '[data-testid="domain-chips"]',
  // Topic table has no testid; use class
  TOPIC_TABLE:              '.kafka-explorer-topic-table',
  // Detail panel (KafkaTopicDetailPanel)
  DETAIL_TABS:              '[data-testid="detail-tabs"]',
  DETAIL_MESSAGES_TAB:      '[data-testid="detail-messages-tab"]',
  DETAIL_PARTITIONS_TAB:    '[data-testid="detail-partitions-tab"]',
  DETAIL_GROUPS_TAB:        '[data-testid="detail-groups-tab"]',
  DETAIL_CONFIG_TAB:        '[data-testid="detail-config-tab"]',
  DETAIL_CONSUME_BTN:       '[data-testid="detail-consume-btn"]',
  DETAIL_RESULTS:           '[data-testid="detail-results"]',
  DETAIL_MSG_PANE:          '[data-testid="detail-msg-pane"]',
  DETAIL_LOAD_MORE_BTN:     '[data-testid="detail-load-more-btn"]',
  // Metrics row has no testid; use class
  TOPIC_METRICS_ROW:        '.kafka-explorer-metrics-row',

  // ── Schema Registry ──────────────────────────────────────────────────
  SCHEMA_REGISTRY_PAGE:     '[data-testid="schema-registry-page"]',
  SCHEMA_URL_INPUT:         '[data-testid="registry-url-input"]',
  SCHEMA_CONNECT_BTN:       '[data-testid="registry-connect-btn"]',
  SCHEMA_AUTH_USER:         '[data-testid="registry-auth-user"]',
  SCHEMA_AUTH_PASS:         '[data-testid="registry-auth-pass"]',
  SCHEMA_SEARCH:            '[data-testid="subject-filter"]',
  SCHEMA_SUBJECT_TABLE:     '[data-testid="subject-table"]',
  SCHEMA_URL_PROMPT:        '[data-testid="url-prompt"]',
  SCHEMA_ERROR:             '[data-testid="subjects-error"]',
  SCHEMA_DETAIL_PANEL:      '[data-testid="schema-detail-panel"]',
  SCHEMA_VERSION_SELECT:    '[data-testid="version-select"]',
  SCHEMA_FORMAT_BADGE:      '[data-testid="detail-format-badge"]',
  SCHEMA_CONTENT:           '[data-testid="schema-content"]',
  SCHEMA_COPY_BTN:          '[data-testid="copy-schema-btn"]',
  SCHEMA_EXPORT_BTN:        '[data-testid="export-schema-btn"]',
  SCHEMA_SKELETON:          '[data-testid="schema-skeleton"]',
  VERSIONS_ERROR:           '[data-testid="versions-error"]',

  // ── Workflow Kafka Nodes ─────────────────────────────────────────────
  // Node type classes (on canvas node elements)
  NODE_PRODUCE:             '.node-type-kafkaProduce',
  NODE_CONSUME:             '.node-type-kafkaConsume',
  // Config panels (KafkaTriggerConfig, KafkaWaitConfig have data-testid)
  TRIGGER_CONFIG:           '[data-testid="kafka-trigger-config"]',
  WAIT_CONFIG:              '[data-testid="kafka-wait-config"]',
  // Workflow node fields — no testids; use placeholders/labels
  NODE_TOPIC_INPUT:         'input[placeholder="orders.events"]',
  NODE_BINDING_ADD_BTN:     'button:has-text("+ Binding")',
  // Wait node fields — no testids yet; add if needed during implementation
  WAIT_SAMPLE_TEXTAREA:     'textarea[placeholder*="sample"], textarea[data-testid*="sample-payload"]',
  WAIT_LOAD_MODE_SELECT:    'select[data-testid*="load-mode"]',
} as const;

// ── Harness / Workflow Runner selectors (for K13) ───────────────────────────
// These live in the test-runner feature, not the kafka namespace.
// Reference the RUNNER or WF_PICKER namespaces in selectors.ts, or use directly:
//   workflow-select         → WorkflowPicker trigger button
//   wfp-search-input        → search within WorkflowPicker dropdown
// Harness-level run/results controls have no data-testid yet —
//   add minimal testids to the WorkflowRunner component during K13 implementation.
```

> **Selector notes:**
> - The root studio page (`KafkaMessageStudioPage`) uses `.kafka-message-studio-page` class; no `data-testid` is present — use class selector or add a testid during K1 implementation.
> - "Publish" and "Consume" tab buttons have no `data-testid`; the scoped class selector `.kafka-ms-studio-tabs button:has-text(...)` is the safest fallback.
> - Settings page connection action buttons (Connect, Disconnect, Test Connection) have no `data-testid`; use class-scoped text selectors. Consider adding `data-testid` attributes when implementing K1/K11/K12 to avoid fragility.
> - Template Save/Load buttons (both publish and consume sides) have no `data-testid`; use class-scoped text selectors.
> - The `KAFKA_STUDIO_TAB` highlight used in K1 steps 1 and 7 refers to the main app nav item for Protocols → Kafka — this is a navigation concern outside the Kafka feature, not a KAFKA-namespace selector. Use the relevant nav selector from `src/shared/selectors.ts` (e.g. `APP.PROTOCOLS_TAB` or `APP.KAFKA_NAV`).
> - Harness / Workflow Runner selectors for K13 (`HARNESS_WF_RUNNER_TAB`, `HARNESS_ITERATIONS_INPUT`, `HARNESS_RUN_BTN`, etc.) need `data-testid` attributes added to `WorkflowRunner.tsx` and related components — add them minimally during K13 implementation.

---

## Test Plan

### Unit Tests (`kafka-lessons.test.ts`)

Each lesson must have unit tests covering:
1. **Structure validity** — id, domainId, category, name, estimatedMinutes all defined
2. **Steps non-empty** — `steps.length >= 1`
3. **Step IDs unique** — no duplicate step IDs within a lesson
4. **Actions type-safe** — every step that has `action.type` uses a valid `DemoActionType`
5. **Docker lessons have PrerequisiteGate** — lessons K1–K4, K6–K13 must have `dockerEndpoint` on at least one step

**Coverage target:** >90%

**Template (mirrors `ws-lessons.test.ts` pattern):**

```typescript
import { describe, it, expect } from 'vitest';
import { kafkaQuickStartLesson } from './kafka-quick-start';
// ... import all 13 lessons

describe('Kafka Demo Hub — Lesson structure', () => {
  const allLessons = [kafkaQuickStartLesson, kafkaPublishLesson, /* ... */];

  it('all lessons have required fields', () => {
    allLessons.forEach((lesson) => {
      expect(lesson.id).toBeTruthy();
      expect(lesson.domainId).toBe('protocols');
      expect(lesson.category).toBe('kafka');
      expect(lesson.steps.length).toBeGreaterThan(0);
    });
  });

  it('all step IDs are unique per lesson', () => {
    allLessons.forEach((lesson) => {
      const ids = lesson.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('K1 is a Docker lesson with a prerequisite gate step', () => {
    const gate = kafkaQuickStartLesson.steps.find((s) => s.id.includes('prereq') || lesson.dockerEndpoint);
    expect(gate ?? kafkaQuickStartLesson.dockerEndpoint).toBeTruthy();
  });

  // One describe block per lesson for step-level assertions
  describe('K2 Publish Studio', () => {
    it('has 9 steps', () => expect(kafkaPublishLesson.steps).toHaveLength(9));
    it('pub-send step has action type click', () => {
      const sendStep = kafkaPublishLesson.steps.find((s) => s.id === 'pub-send');
      expect(sendStep?.action?.type).toBe('click');
    });
  });
  // ... repeat for each lesson
});
```

### E2E Tests

Kafka demo lessons reuse existing E2E infrastructure — no new spec files needed unless you want smoke-test coverage for the demo lesson itself. The existing `kafka-live.spec.ts` already covers the underlying UI flows.

If a dedicated demo E2E is desired, add to `e2e/kafka-demo.spec.ts`:

```typescript
// Smoke test: verify the Learning Hub shows 13 Kafka lessons
test('Kafka category shows 13 lessons in Learning Hub', async ({ page }) => {
  await page.goto('/?tab=learning-hub');
  await page.locator('[data-testid="domain-protocols"]').click();
  await page.locator('button:has-text("Kafka")').click(); // category filter
  const cards = await page.locator('[data-testid="lesson-card"]').count();
  expect(cards).toBe(13);
});
```

---

## E2E Mapping

The table below shows which existing E2E specs validate the underlying feature each lesson demos:

| Lesson | Feature under demo | Existing E2E spec | Coverage |
|---|---|---|---|
| K1 | Cluster create + connect + badge | `kafka-desktop.spec.ts` | ✅ |
| K2 | Publish Studio → Send Once | `kafka-live.spec.ts` | ✅ |
| K3 | Consume Studio → results table + detail | `kafka-live.spec.ts` | ✅ |
| K4 | Headers + filters (key, JSONPath) | `kafka-live.spec.ts` | ✅ |
| K5 | Templates (save/load/delete) | Unit test coverage | — |
| K6 | Topic Explorer → detail panel | `kafka-live.spec.ts` | ✅ |
| K7 | Schema Registry browser | `kafka-schema.spec.ts` + `kafka-live.spec.ts` | ✅ |
| K8 | Stream mode (start/stop/export) | `kafka-live.spec.ts` | ✅ |
| K9 | kafkaProduce node in workflow | `kafka-desktop.spec.ts` | ✅ |
| K10 | kafkaConsume + kafkaWait nodes | `kafka-desktop.spec.ts` | ✅ |
| K11 | SASL/SCRAM cluster + workflow | Validated manually (see `kafka-secure-tls-stream-test-scenarios.md`) | ☐ |
| K12 | TLS cluster + workflow | Validated manually (see `kafka-secure-tls-stream-test-scenarios.md`) | ☐ |
| K13 | Harness Workflow Runner + PRODUCE badges | `kafka-live.spec.ts` | ✅ |

---

## Open Questions / Risks

### 1. Selector fragility for Settings page ✅ Partially resolved
The Kafka Settings page uses a mix of element IDs and label text. The full audit found:
- Auth type: `#kafka-auth-mode` (id exists) ✅
- Auth username: `#kafka-auth-username` (id exists) ✅
- Auth password: `#kafka-auth-password` (id exists) ✅
- TLS enable checkbox: `label:has-text("Enable TLS") input[type="checkbox"]` (no testid, label text exists) ⚠️
- TLS verify: `label:has-text("Verify server certificate") input[type="checkbox"]` (note: actual label is "Verify server certificate", not "Verify Certificate") ✅
- Connect / Test / Disconnect buttons: **no `data-testid`** — add testids to `KafkaSettingsPage.tsx` during K1 or K11 implementation ⚠️
- Save cluster: `[data-testid="kafka-save-cluster-btn"]` ✅

### 2. Stream producer availability ✅ Resolved
The script `docker/kafka/topics/stream-producer.sh` **exists** in the repo. The K8 lesson setup should invoke it (via a background shell exec in `setup()`) to populate the live stream. Update K8 setup note accordingly.

### 3. Schema Registry lesson relies on registered subjects
K7 needs subjects to already exist in the Schema Registry. The `docker/kafka/schema-registry/docker-compose.yml` init container creates `sr.smoke.avro` and `sr.smoke.batch` topics but does NOT pre-register schemas. A setup script or init container extension may be needed to `curl -X POST` example Avro schemas before the lesson starts.

### 4. `kafkaWait` sample payload for K10
The current `kafkaWait` config panel has a sample payload textarea. Verify the testid and whether it's shown by default or behind a toggle. Adjust the step action accordingly.

### 5. Lesson K13 seeded workflow `clusterId`
The `createKafkaProduceDemoWorkflow()` factory must hard-code `clusterId: 'local-plaintext'` — the same cluster ID used by the seed helper in `kafka-live.spec.ts`. This will only work if the user followed K1 and configured the cluster with exactly that ID. Consider making the cluster ID configurable (passed in as a variable).

### 6. `__wfInsertWorkflow` bridge null-safety
The bridge is only available when `App.tsx` passes `wfHook.insert` to `useDemoWorkflowBridge`. Verify this is wired before implementing K9 and K13 setup. If not, add `insert` to the hook call in `App.tsx` (already done for Lesson 20 — should work as-is).

---

## Implementation Order

Recommended implementation sequence (short lessons and no-Docker first):

| Order | Lesson | Why first |
|---|---|---|
| 1 | K5 Templates | No Docker, pure UI — fast to implement and test |
| 2 | K2 Publish Studio | Core feature, rich selectors already exist |
| 3 | K3 Consume Studio | Builds directly on K2 selectors |
| 4 | K4 Headers & Filters | Extends K2+K3 patterns |
| 5 | K1 Quick Start | Docker, but simple step flow |
| 6 | K6 Topic Explorer | Reuses existing explorer data-testids |
| 7 | K8 Stream Mode | Stream data-testids well defined |
| 8 | K9 Workflow: Produce | Needs `__wfInsertWorkflow`; verify bridge first |
| 9 | K10 Workflow: Consume & Wait | Depends on K9 pattern |
| 10 | K7 Schema Registry | Needs SR Docker stack running |
| 11 | K13 Harness Run | Depends on K9 seeding pattern |
| 12 | K11 Secure Cluster | Docker-heavy; implement after all plaintext lessons |
| 13 | K12 TLS Cluster | Most complex Docker setup — implement last |

---

*Last updated: 2026-06-16 — Selectors section fully audited against TSX source; `dockerDescription` field removed (not on `DemoLesson` type); stream/schema/settings selectors corrected to use verified `data-testid` values; Open Question #2 resolved (stream-producer.sh confirmed present).*
