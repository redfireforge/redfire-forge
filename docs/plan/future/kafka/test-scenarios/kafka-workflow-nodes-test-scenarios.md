# Kafka Workflow Nodes — Visual Test Scenarios

> **Covers:** Integration Phases 4–5 — Workflow Designer Kafka nodes (Produce, Consume, Trigger, Wait)
> **Created:** 2026-06-05
> **Purpose:** Step-by-step manual guide for verifying Kafka node types in the Workflow Designer:
> kafkaProduce, kafkaConsume, kafkaTrigger, and kafkaWait — including node palette,
> config panels, Quick Test execution, output bindings, mixed chains, load test behavior,
> Results Explorer traces, logging, and event-driven trigger/wait lifecycle.
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.
> Do **not** pre-check items — verify each one yourself first.

---

## Validation Status (2026-06-05)

| Scenario | Method | Status | Notes |
|---|---|---|---|
| **WN-01** (Node palette) | Playwright UI | ✅ Validated | All 4 Kafka nodes in palette with correct labels/descriptions |
| **WN-02** (kafkaProduce drag) | Playwright UI | ✅ Validated | Renders with icon, label, "No topic", configure button |
| **WN-03** (kafkaConsume drag) | Playwright UI | ✅ Validated | Renders with icon, label, "No topic", Max: 1 |
| **WN-04** (kafkaTrigger/Wait drag) | Playwright UI | ✅ Validated | Trigger category "Trigger", Wait category "Integration" |
| **WN-05** (kafkaProduce config) | Playwright UI | ✅ Validated | All fields present: Label, Cluster ID, Topic, Key, Partition, Headers, Body, Ack, Timeout, Bindings, Schema |
| **WN-08** (Schema Config toggle) | Playwright UI | ✅ Validated | Toggle reveals Registry URL, Format, Auth, Subject, Version |
| **WN-09** (Quick Test produce) | API curl | ✅ Validated | Produce API returns partition, offset, sentCount |
| **WN-12** (kafkaConsume config) | Playwright UI | ✅ Validated | All fields present: Label, Cluster, Topic, Key Regex, Header/JSONPath Filters, Timeout, Max, Start, Load Test, Bindings, Schema |
| **WN-13** (Output bindings) | Playwright UI | ✅ Validated | Binding row: Enabled checkbox, source dropdown (5 options), targetVariable, × remove |
| **WN-14** (Quick Test consume) | API curl | ✅ Validated | Consume returns messages with topic, partition, offset, key, value, headers |
| **WN-18** (Consume timeout) | API curl | ✅ Validated | Timeout returns 0 messages, timedOut: true, completes in ~5s |
| **WN-19** (Config persistence) | Playwright UI | ✅ Validated | All values persist after close/reopen |
| **WN-20** (Full reload) | Playwright UI | ✅ Validated | All values survive full page reload |
| **WN-25** (auto-resume config) | Playwright UI | ✅ Validated | Dropdown switches; Mock Payload textarea appears |
| **WN-33** (kafkaTrigger config) | Playwright UI | ✅ Validated | Full config panel: Label, Cluster, Topic, Consumer Group, Offset Policy, Key Regex, Filters, Extract Variables, Test Payload |
| **WN-39** (kafkaWait config) | Playwright UI | ✅ Validated | Full config panel: Label, Cluster, Topic, Correlation Matching, Timeout, Filters, Extract Variables, Test Payload, Load Test |
| **WN-49** (Trigger sample payload) | Playwright UI | ✅ Validated | Sample payload in Quick Test extracts real variable values; downstream nodes use resolved values |
| **WN-50** (Wait sample payload) | Playwright UI | ✅ Validated | Scenario 03 completes in <1s with sample payload instead of hanging forever |
| **WN-51** (Dry-run vs sample) | Playwright UI | ✅ Validated | Console clearly distinguishes dry-run (empty vars) from sample payload (real vars) |

| **WN-52** (Import → Quick Test 01) | Real Kafka Docker | ✅ Validated | Produce writes to `redfireforge.workflow.test`, rpk confirms offset |
| **WN-53** (Import → Quick Test 02) | Real Kafka Docker | ✅ Validated | Trigger sample payload resolves variables, produce to `orders.enriched` verified via rpk |
| **WN-54** (Import → Quick Test 03) | Real Kafka Docker | ✅ Validated | Produce to `orders.submitted` verified, Wait resolves from sample payload in <1s |
| **WN-55** (Import → Quick Test 04) | Real Kafka Docker | ✅ Validated | Real Avro E2E via `local-schema-registry` cluster — Produce encodes Avro, Consume decodes, Kafka Studio cross-verified |
| **WN-56** (Import → Quick Test 05) | Real Kafka Docker | ✅ Validated | Full pipeline: trigger + HTTP + condition + 2 produces to `orders.approved` + `notifications.email`, all rpk verified |
| **WN-57** (Export → Import round-trip) | Playwright UI | ✅ Validated | Delete all → re-import from JSON → all 5 scenarios pass Quick Test |
|
| **WN-58** (Produce → Studio Consume) | Playwright UI | ✅ Validated | Scenario 01 Quick Test → Kafka Studio Consume shows 9 messages with key `order-123` |
| **WN-59** (Studio Publish → Consume) | Playwright UI | ✅ Validated | Publish to `orders.created` via Studio → Consume verifies exact payload at offset 1 |
| **WN-60** (Scenario 02 → Studio Consume) | Playwright UI | ✅ Validated | Scenario 02 Produce → Studio Consume on `orders.enriched` shows key `ORD-2025-001` |
| **WN-61** (Studio Publish trigger topic) | Playwright UI | ✅ Validated | Publish to `orders.created` → Consume confirms message with key `ORD-E2E-001` |
| **WN-62** (Studio Publish wait topic) | Playwright UI | ✅ Validated | Publish to `payments.confirmed` → Consume confirms key `ORD-CORR-001` at offset 0 |
| **WN-63** (Scenario 05 → Studio Consume) | Playwright UI | ✅ Validated | Pipeline produces → Studio Consume verifies `orders.approved` and `notifications.email` topics |
| **WN-64** (Header pass-through E2E) | Playwright UI + Real Kafka Docker | ✅ Validated | Publish with 4 headers → Trigger extracts headers → Produce forwards all 5 headers → Consume verifies headers intact |

**Summary:** 34 scenarios validated (all passing). Phase 5B/5C config panels, Quick Test sample payload support, real Kafka Docker integration, E2E Kafka Studio verification, and header pass-through are fully implemented and verified.

---

## Before You Start

### Navigation

| Destination | How to get there |
|---|---|
| **Workflow Designer** | Click **Workflow** (graph icon) in the left activity bar → select or create a workflow |
| **Node Palette** | Inside Workflow Designer → click **+ Add Node** button on canvas or in the toolbar |
| **Node Config** | Click the ⚙ (gear) button on any node, or double-click the node |
| **Console Panel** | Bottom dock inside the Workflow Designer → **Console** tab |
| **Kafka Settings** | Click ⚙️ **Settings** in the left activity bar → **Kafka** tab |

### Prerequisites: Configure and Connect a Kafka Cluster

Ensure you have a connected Kafka cluster before testing execution scenarios (WN-09 onward). Connection is configured in **Settings → Kafka**.

**Quick setup summary:**
1. Go to **Settings → Kafka** → **Create First Cluster** (or edit existing)
2. Name: `Local Plaintext`, Broker: `127.0.0.1:19092`, Auth: No authentication, TLS: unchecked
3. Click **Save Cluster** → select it → click **Connect**
4. Verify the badge shows **Connected** (green)

### Docker: Start the Plaintext Broker

**Recommended (automated):**

```bash
# From the repo root — starts Docker, seeds topics + messages
docker/kafka/e2e/run-all-smoke.sh --seed-only plaintext
```

**Alternative (manual):**

```bash
cd docker/kafka/plaintext && docker compose up -d
# Wait ~10 seconds for health check
```

- **Kafka broker:** `localhost:19092`

### Seed Test Topics and Messages

The UI test seed script creates all needed topics and messages:

```bash
docker/kafka/e2e/ui-test-seed.sh
```

This creates topics like `orders.created`, `payments.authorized`, `redfireforge.workflow.input`, `redfireforge.workflow.output`, etc.

### Start the Local Server

```bash
npm run server
```

### Start the Web App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Scenario Summary

| ID | Scenario | Docker | Server |
|---|---|---|---|
| **Node Palette & Canvas** | | | |
| WN-01 | Node palette: Kafka category shows 4 node types | No | No |
| WN-02 | Drag kafkaProduce to canvas → correct rendering | No | No |
| WN-03 | Drag kafkaConsume to canvas → correct rendering | No | No |
| WN-04 | Drag kafkaTrigger / kafkaWait to canvas → correct rendering | No | No |
| **kafkaProduce Config & Execution** | | | |
| WN-05 | kafkaProduce config panel: all fields present | No | No |
| WN-06 | Topic field validation: required | No | No |
| WN-07 | Body field: `{{variable}}` interpolation | No | No |
| WN-08 | Schema Config section: Enable Schema Registry toggle | No | No |
| WN-09 | Quick Test: kafkaProduce sends message → logs show partition/offset | ✅ | ✅ |
| WN-10 | Output bindings: partition/offset propagate to downstream node | ✅ | ✅ |
| WN-11 | Disabled output bindings are skipped | ✅ | ✅ |
| **kafkaConsume Config & Execution** | | | |
| WN-12 | kafkaConsume config panel: all fields present | No | No |
| WN-13 | Extraction config: variable output mapping | No | No |
| WN-14 | Quick Test: kafkaConsume retrieves messages → logs show count | ✅ | ✅ |
| WN-15 | Variable extraction: values appear as output variables | ✅ | ✅ |
| WN-16 | Schema Config section with deserialization | No | No |
| WN-17 | Consume earliest replays existing messages | ✅ | ✅ |
| WN-18 | Consume timeout: no match → deterministic timeout | ✅ | ✅ |
| **Config Persistence & Variable Insertion** | | | |
| WN-19 | Configure, close, reopen → all values persist | No | No |
| WN-20 | Save workflow, reload, reopen configs → values survive | No | No |
| WN-21 | Validation blocks save on required fields | No | No |
| **Mixed Workflow Chains** | | | |
| WN-22 | HTTP → kafkaProduce → kafkaConsume → HTTP chain | ✅ | ✅ |
| WN-23 | continueOnError: false → workflow stops at failure | ✅ | ✅ |
| WN-24 | continueOnError: true → failure recorded, downstream runs | ✅ | ✅ |
| **Load Test Behavior** | | | |
| WN-25 | auto-resume mode: no broker call, synthetic result | ✅ | ✅ |
| WN-26 | Log indicates auto-resume path taken | ✅ | ✅ |
| **Results Explorer Trace** | | | |
| WN-27 | kafkaProduce trace: topic, partition, offset, durationMs | ✅ | ✅ |
| WN-28 | kafkaConsume trace: topic, matchedMessages, durationMs | ✅ | ✅ |
| **Logging & Observability** | | | |
| WN-29 | Console panel: structured Kafka logs during execution | ✅ | ✅ |
| WN-30 | Sensitive fields redacted in logs | ✅ | ✅ |
| WN-31 | Error node state: connection failure → error badge | ✅ | ✅ |
| WN-32 | Variable inspector: Kafka variables visible | ✅ | ✅ |
| **kafkaTrigger — Phase 5** | | | |
| WN-33 | kafkaTrigger config: topic, correlation, variable seeding | No | No |
| WN-34 | Trigger starts workflow from real message | ✅ | ✅ |
| WN-35 | Non-matching messages do not start workflow | ✅ | ✅ |
| WN-36 | Run metadata: trigger topic, partition, offset, variables | ✅ | ✅ |
| WN-37 | Offset policy: only post-subscription messages trigger | ✅ | ✅ |
| WN-38 | Backpressure: active-run limit → consumer pauses | ✅ | ✅ |
| **kafkaWait — Phase 5** | | | |
| WN-39 | kafkaWait config: correlation, timeout, cancel settings | No | No |
| WN-40 | Wait resumes only on correlated message | ✅ | ✅ |
| WN-41 | Run history: waiting → resumed → completed | ✅ | ✅ |
| WN-42 | Wait timeout: no match → timeout state | ✅ | ✅ |
| WN-43 | Duplicate callback: idempotent, exactly one resume | ✅ | ✅ |
| WN-44 | Correlation mismatch: body/header/query rejection | ✅ | ✅ |
| WN-45 | Restart recovery: server restart → callback resumes | ✅ | ✅ |
| WN-46 | Resume-path parity: direct vs callback endpoint | ✅ | ✅ |
| WN-47 | Consumer cleanup on timeout: no lingering subscription | ✅ | ✅ |
| WN-48 | Context variable seeding: trigger/wait keys, no cross-contamination | ✅ | ✅ |
| **Quick Test Sample Payload** | | | |
| WN-49 | Trigger sample payload: real variables in Quick Test | No | ✅ |
| WN-50 | Wait sample payload: resolves in <1s | No | ✅ |
| WN-51 | Dry-run vs sample payload comparison | No | ✅ |
| **Real Kafka Docker Integration** | | | |
| WN-52 | Scenario 01: Produce + Consume, rpk verified | ✅ | ✅ |
| WN-53 | Scenario 02: Trigger + HTTP + Produce, rpk verified | ✅ | ✅ |
| WN-54 | Scenario 03: Produce + Wait, rpk verified | ✅ | ✅ |
| WN-55 | Scenario 04: Schema Registry Produce, rpk verified | ✅ | ✅ |
| WN-56 | Scenario 05: Full Pipeline (9 nodes), rpk verified | ✅ | ✅ |
| WN-57 | Export → Delete → Import round-trip | No | ✅ |
| **E2E Kafka Studio Verification** | | | |
| WN-58 | Workflow Produce → Kafka Studio Consume verify | ✅ | ✅ |
| WN-59 | Kafka Studio Publish → Consume round-trip | ✅ | ✅ |
| WN-60 | Scenario 02 Produce → Kafka Studio Consume verify | ✅ | ✅ |
| WN-61 | Kafka Studio Publish to trigger topic → Consume verify | ✅ | ✅ |
| WN-62 | Kafka Studio Publish to wait topic → Consume verify | ✅ | ✅ |
| WN-63 | Scenario 05 Pipeline → Kafka Studio Consume both topics | ✅ | ✅ |
| **Header Pass-Through E2E** | | | |
| WN-64 | Scenario 06: Header pass-through (Publish 4 headers → Trigger → Produce 5 headers → Consume verify) | ✅ | ✅ |

---

## WN-01 — Node Palette: Kafka Category

**Prerequisites:** Open a workflow in the Workflow Designer

**Steps:**
1. Open the node palette (click **+ Add Node** or the add node button)
2. Look for the **Kafka** category

**Expected:**
- ☐ A **Kafka** category is visible in the node palette
- ☐ The category contains exactly 4 node types:
  - **kafkaProduce** — send a message to a topic
  - **kafkaConsume** — consume/match messages from a topic
  - **kafkaTrigger** — start a workflow from a Kafka message
  - **kafkaWait** — pause workflow until a correlated message arrives
- ☐ Each node type has a distinct icon and description
- ☐ Kafka nodes are visually distinguishable from HTTP, Webhook, and other categories

---

## WN-02 — Drag kafkaProduce to Canvas

**Steps:**
1. Drag a **kafkaProduce** node from the palette to the canvas

**Expected:**
- ☐ The node appears on the canvas with a Kafka Produce icon
- ☐ The node label shows **"Kafka Produce"** (default)
- ☐ The node shows **Topic:** "No topic" (placeholder when unconfigured)
- ☐ The node CSS class includes `wf-node-kafkaProduce`
- ☐ The node has both a **target** handle (top, for incoming edges) and a **source** handle (bottom, for outgoing edges)
- ☐ A ⚙ (gear) configure button is visible in the node footer

---

## WN-03 — Drag kafkaConsume to Canvas

**Steps:**
1. Drag a **kafkaConsume** node from the palette to the canvas

**Expected:**
- ☐ The node appears with a Kafka Consume icon
- ☐ Label: **"Kafka Consume"** (default)
- ☐ Shows **Topic:** "No topic" placeholder
- ☐ CSS class: `wf-node-kafkaConsume`
- ☐ Has target handle (top) and source handle (bottom)
- ☐ ⚙ configure button in footer

---

## WN-04 — Drag kafkaTrigger / kafkaWait to Canvas

**Steps:**
1. Drag a **kafkaTrigger** node to the canvas
2. Drag a **kafkaWait** node to the canvas

**Expected (kafkaTrigger):**
- ☐ Label: **"Kafka Trigger"** (default)
- ☐ Shows **Topic:** "No topic" placeholder
- ☐ CSS class: `wf-node-kafkaTrigger`
- ☐ Has only a **source** handle (bottom) — no target handle (triggers are entry points)

**Expected (kafkaWait):**
- ☐ Label: **"Kafka Wait"** (default)
- ☐ Shows **Topic:** "No topic" and **Correlate:** field
- ☐ CSS class: `wf-node-kafkaWait`
- ☐ Has both target handle (top) and source handle (bottom)
- ☐ Shows `correlationIdExpression` preview when configured

---

## WN-05 — kafkaProduce Config Panel

**Prerequisites:** A kafkaProduce node on the canvas

**Steps:**
1. Click the ⚙ button on the kafkaProduce node (or double-click the node)
2. Observe the config panel that opens

**Expected:**
- ☐ **Label** text input
- ☐ **Cluster ID** text input (placeholder: "cluster-a")
- ☐ **Topic** text input (placeholder: "orders.events")
- ☐ **Key Template** input with Insert Variable ({{variable}}) support
- ☐ **Partition** number input (optional)
- ☐ **Headers** section with "+ Add Header" button; each header row has: Enabled checkbox, name input, value input (with Insert Variable), × remove button
- ☐ **Body Template** textarea (6 rows, supports {{variable}} templates)
- ☐ **Ack Mode** dropdown: All / Leader / None
- ☐ **Timeout (ms)** number input (placeholder: "10000")
- ☐ **Output Bindings** section with "+ Add Binding" button; each binding row has: Enabled checkbox, source dropdown (topic/partition/offset/timestamp/key), targetVariable input, × remove
- ☐ **Enable Schema Registry** checkbox (KafkaSchemaConfigSection)
- ☐ **Available Variables** panel at the bottom showing upstream variable hints

---

## WN-06 — Topic Field Validation

**Steps:**
1. Open kafkaProduce config
2. Leave the **Topic** field empty
3. Attempt to run Quick Test or save

**Expected:**
- ☐ The Topic field is visually required (may show a placeholder hint)
- ☐ Quick Test execution without a topic fails with an actionable error message
- ☐ The error indicates that "topic" is required

---

## WN-07 — Body Template with {{variable}} Interpolation

**Steps:**
1. Open kafkaProduce config
2. In the **Body Template** textarea, type: `{"orderId":"{{orderId}}","status":"created"}`
3. Use the Insert Variable picker to add a `{{timestamp}}` variable

**Expected:**
- ☐ The textarea accepts `{{variable}}` syntax without error
- ☐ The "Supports `{{variable}}` templates" hint is visible below the textarea
- ☐ Insert Variable picker opens when the variable button is clicked
- ☐ Selecting a variable inserts it at the cursor position (appended)

---

## WN-08 — Schema Config Section in kafkaProduce

**Steps:**
1. Open kafkaProduce config
2. Check the **Enable Schema Registry** checkbox

**Expected:**
- ☐ Additional fields appear: Registry URL, Format (Avro/Protobuf/JSON Schema), Username, Password, Subject, Version
- ☐ The Subject field has a **↓** button to lazily load subjects from the registry
- ☐ The Version field has a **↓** button to lazily load versions
- ☐ Unchecking the checkbox hides these fields and clears `schemaConfig`

---

## WN-09 — Quick Test: kafkaProduce Sends Message

**Prerequisites:** Connected to plaintext broker, topics seeded

**Steps:**
1. Create a workflow with a **Start** → **kafkaProduce** → **End** chain
2. Configure the kafkaProduce node:
   - Cluster ID: `local-plaintext` (or your cluster ID from Settings)
   - Topic: `redfireforge.workflow.output`
   - Key Template: `wn-09-test`
   - Body Template: `{"test":"WN-09","scenario":"quick-test-produce"}`
   - Ack Mode: All
3. Run **Quick Test** on the workflow

**Expected:**
- ☐ The Console panel shows structured Kafka produce log lines:
  - Start: topic name, node ID
  - Success: partition number, offset number, duration
- ☐ The kafkaProduce node shows a **success** badge (green checkmark)
- ☐ The result includes valid `partition` (non-negative integer) and `offset` (non-negative integer) values
- ☐ The message is actually on the broker (verifiable via `rpk topic consume redfireforge.workflow.output` or the Consume tab)

---

## WN-10 — Output Bindings: Partition/Offset to Downstream

**Prerequisites:** Connected to broker

**Steps:**
1. Create a chain: **Start** → **kafkaProduce** → **HTTP** → **End**
2. Configure kafkaProduce:
   - Topic: `redfireforge.workflow.output`
   - Body: `{"test":"output-bindings"}`
   - Add two Output Bindings:
     - Source: `partition` → targetVariable: `producedPartition`
     - Source: `offset` → targetVariable: `producedOffset`
3. Configure the HTTP node to use the bound variables in its URL:
   - URL: `https://httpbin.org/get?partition={{producedPartition}}&offset={{producedOffset}}`
4. Run Quick Test

**Expected:**
- ☐ The kafkaProduce node produces successfully and populates `producedPartition` and `producedOffset` in the variable context
- ☐ The downstream HTTP node receives **interpolated values** in its URL (not literal `{{producedPartition}}` strings)
- ☐ The HTTP response shows the actual partition and offset numbers as query parameters
- ☐ In the Variable Inspector / Console, `producedPartition` and `producedOffset` are visible with numeric values

---

## WN-11 — Disabled Output Bindings Are Skipped

**Prerequisites:** Workflow from WN-10

**Steps:**
1. Edit the kafkaProduce config
2. Uncheck the **Enabled** checkbox on the `partition` binding
3. Set an upstream variable `producedPartition` to a known value (e.g., via a SetVariable node: `producedPartition = "original-value"`)
4. Re-run Quick Test

**Expected:**
- ☐ The disabled `partition` binding is **not** applied — `producedPartition` retains its original value ("original-value")
- ☐ The enabled `offset` binding still writes the actual offset to `producedOffset`
- ☐ The downstream HTTP node shows `partition=original-value` (the pre-existing value, not overwritten) and `offset=<real-offset>`

---

## WN-12 — kafkaConsume Config Panel

**Prerequisites:** A kafkaConsume node on the canvas

**Steps:**
1. Click ⚙ on the kafkaConsume node

**Expected:**
- ☐ **Label** text input
- ☐ **Cluster ID** text input
- ☐ **Topic** text input
- ☐ **Key Regex** input with Insert Variable support (placeholder: "Optional regex filter")
- ☐ **Header Filters** section with "+ Add Header Filter" button; each row: Enabled checkbox, header name, value (with variable insert), × remove
- ☐ **JSONPath Filters** section with "+ Add JSONPath Filter" button; each row: Enabled checkbox, jsonPath input (placeholder: "$.payload.id"), expected value (with variable insert), × remove
- ☐ **Timeout (ms)** number input (placeholder: "30000")
- ☐ **Max Messages** number input (placeholder: "1")
- ☐ **Start Position** dropdown: Latest / Earliest / Committed
- ☐ **Load Test Behavior** dropdown: Wait for real / Auto resume / Synthetic inject
- ☐ **Output Bindings** section (same as kafkaProduce)
- ☐ **Enable Schema Registry** checkbox
- ☐ **Available Variables** panel

---

## WN-13 — Extraction Config: Variable Output Mapping

**Steps:**
1. Open kafkaConsume config
2. Add an Output Binding: Source: `key`, targetVariable: `capturedKey`
3. Add another: Source: `partition`, targetVariable: `capturedPartition`

**Expected:**
- ☐ Both bindings appear in the Output Bindings section
- ☐ Each has Enabled checkbox, source dropdown, target variable input, × remove
- ☐ Source options: topic, partition, offset, timestamp, key

---

## WN-14 — Quick Test: kafkaConsume Retrieves Messages

**Prerequisites:** Connected, `orders.created` topic has seeded messages

**Steps:**
1. Create: **Start** → **kafkaConsume** → **End**
2. Configure kafkaConsume:
   - Cluster ID: your cluster ID
   - Topic: `orders.created`
   - Start Position: Earliest
   - Max Messages: 3
   - Timeout: 15000
3. Run Quick Test

**Expected:**
- ☐ Console shows Kafka consume log lines: start (topic, max messages), success (message count)
- ☐ The kafkaConsume node shows a **success** badge
- ☐ The logs show the number of messages consumed (up to 3)
- ☐ Message content is visible in the logs (truncated if longer than 512 characters)

---

## WN-15 — Variable Extraction: Values as Output Variables

**Prerequisites:** Workflow from WN-14 with output bindings configured

**Steps:**
1. Add output bindings to kafkaConsume:
   - Source: `key` → targetVariable: `consumedKey`
   - Source: `topic` → targetVariable: `consumedTopic`
2. Add a downstream node (e.g., LogDebug or HTTP) that references `{{consumedKey}}` and `{{consumedTopic}}`
3. Run Quick Test

**Expected:**
- ☐ `consumedKey` is populated with the key of the first consumed message
- ☐ `consumedTopic` is populated with `orders.created`
- ☐ Downstream nodes can access these extracted variables
- ☐ Variable Inspector shows both variables with their values

---

## WN-16 — kafkaConsume Schema Config

**Steps:**
1. Open kafkaConsume config
2. Check **Enable Schema Registry**

**Expected:**
- ☐ Same schema config fields as kafkaProduce appear (Registry URL, Format, Auth, Subject, Version)
- ☐ This configures Avro/Protobuf/JSON Schema deserialization for consumed messages
- ☐ Unchecking hides the fields

---

## WN-17 — Consume Earliest Replays Existing Messages

**Prerequisites:** `orders.created` has pre-existing seeded messages

**Steps:**
1. Configure kafkaConsume:
   - Topic: `orders.created`
   - Start Position: **Earliest**
   - Max Messages: 10
   - Timeout: 15000
2. Run Quick Test from a fresh consumer

**Expected:**
- ☐ The consumer reads from the **beginning** of the topic, not just the latest offset
- ☐ All seeded messages (up to maxMessages) are returned
- ☐ The consumer does not timeout with 0 messages (proves earliest replay works)
- ☐ Console log reflects `startPosition: 'earliest'`

---

## WN-18 — Consume Timeout: No Matching Message

**Prerequisites:** Connected to broker

**Steps:**
1. Configure kafkaConsume:
   - Topic: `redfireforge.debug.consume`
   - Key Regex: `nonexistent-key-pattern-12345`
   - Start Position: Latest
   - Max Messages: 1
   - Timeout: 5000 (5 seconds)
2. Run Quick Test (do NOT publish any messages matching the filter)

**Expected:**
- ☐ The kafkaConsume node waits for 5 seconds (the configured timeout)
- ☐ After timeout, the node completes with a **timeout** state (not an error crash)
- ☐ Console log shows the timeout clearly: duration ~5000ms, 0 messages matched
- ☐ The workflow continues (or ends) deterministically — no hanging state

---

## WN-19 — Config Persistence: Close and Reopen

**Steps:**
1. Open kafkaProduce config, fill in:
   - Label: "Order Publisher"
   - Topic: `orders.created`
   - Key: `{{orderId}}`
   - Body: `{"event":"created"}`
   - Add a header: `traceId` = `{{traceId}}`
   - Add an output binding: partition → `producedPartition`
2. Close the config panel
3. Re-open the config panel

**Expected:**
- ☐ **All values persist**: Label, Topic, Key, Body, Header (name + value + enabled state), Output Binding (source + targetVariable + enabled state)
- ☐ No field was reset or lost during close/reopen

---

## WN-20 — Config Persistence: Full Workflow Reload

**Steps:**
1. With the configured kafkaProduce from WN-19, **save the workflow** (Ctrl+S or Save button)
2. **Reload the browser** (F5) or navigate away and back
3. Open the workflow and click ⚙ on the kafkaProduce node

**Expected:**
- ☐ All values from WN-19 are intact after a full page reload
- ☐ Headers list, output bindings list, and all field values survive serialization/deserialization

---

## WN-21 — Validation: Required Fields

**Steps:**
1. Open kafkaProduce config
2. Clear the **Topic** field
3. Attempt to run Quick Test

**Expected:**
- ☐ An actionable error is shown indicating the required field is missing
- ☐ The error points to the specific field (e.g., "Topic is required")
- ☐ Execution does not proceed without a valid topic

---

## WN-22 — Mixed Chain: HTTP → kafkaProduce → kafkaConsume → HTTP

**Prerequisites:** Connected to broker, seeded topics

**Steps:**
1. Build a 4-node chain: **Start** → **kafkaProduce** → **kafkaConsume** → **HTTP** → **End**
2. Configure kafkaProduce:
   - Topic: `redfireforge.workflow.output`
   - Key: `chain-test-{{runId}}`
   - Body: `{"chain":"mixed","step":"produce"}`
   - Output Binding: offset → `producedOffset`
3. Configure kafkaConsume:
   - Topic: `redfireforge.workflow.output`
   - Start Position: Earliest
   - Max Messages: 1
   - Timeout: 15000
   - Output Binding: key → `consumedKey`
4. Configure HTTP node:
   - URL: `https://httpbin.org/get?key={{consumedKey}}&offset={{producedOffset}}`
5. Run Quick Test

**Expected:**
- ☐ kafkaProduce succeeds (offset populated)
- ☐ kafkaConsume picks up a message (key populated)
- ☐ HTTP node receives interpolated `consumedKey` and `producedOffset` values
- ☐ All 3 action nodes show success badges
- ☐ The chain executes deterministically from start to end

---

## WN-23 — continueOnError: false (Default) Stops at Failure

**Steps:**
1. Build: **Start** → **kafkaProduce (bad config)** → **HTTP** → **End**
2. Configure kafkaProduce with an intentionally failing config:
   - Topic: leave empty (will fail validation) OR use a topic on a disconnected broker
   - Ensure `continueOnError` is **false** (default)
3. Run Quick Test

**Expected:**
- ☐ The kafkaProduce node fails with an error badge
- ☐ The downstream HTTP node does **NOT** execute (no request sent)
- ☐ The workflow terminates at the failing node
- ☐ Console shows the failure with the failure class

---

## WN-24 — continueOnError: true Continues Past Failure

**Steps:**
1. Same workflow as WN-23
2. Set `continueOnError: true` on the kafkaProduce node
3. Run Quick Test

**Expected:**
- ☐ The kafkaProduce node fails and records the failure
- ☐ The downstream HTTP node **still executes** (visible in console/results)
- ☐ The failure is recorded in the Kafka node's trace but does not block the chain
- ☐ Console shows both the Kafka failure and the subsequent HTTP execution

---

## WN-25 — Load Test Behavior: auto-resume Mode

**Prerequisites:** Connected to broker

**Steps:**
1. Create: **Start** → **kafkaConsume** → **End**
2. Configure kafkaConsume:
   - Topic: `orders.created`
   - Load Test Behavior: **Auto resume**
3. Run the workflow under load test mode (if available) or Quick Test

**Expected:**
- ☐ The kafkaConsume node completes immediately with a synthetic empty result
- ☐ No real Kafka broker consume call is made
- ☐ The result is an empty message set (no actual messages)
- ☐ Downstream nodes continue without blocking on broker availability

> **Note:** The auto-resume mode is primarily observable during load/performance test iterations. In Quick Test single-run mode, the behavior may differ. This scenario is best validated through the Load Test runner (covered in `kafka-runner-test-scenarios.md`).

---

## WN-26 — Log Indicates auto-resume Path

**Prerequisites:** Same as WN-25

**Steps:**
1. After running in auto-resume mode, check the Console panel

**Expected:**
- ☐ Console log contains an entry indicating the **auto-resume** path was taken
- ☐ The log does NOT show a genuine Kafka consume connection or message match
- ☐ The log differentiates auto-resume from real consume behavior

---

## WN-27 — Results Explorer: kafkaProduce Trace

**Prerequisites:** Run a workflow with kafkaProduce and have Results Explorer available

**Steps:**
1. Run a workflow containing a kafkaProduce node
2. Open the Results Explorer for the completed run
3. Expand the kafkaProduce node entry

**Expected:**
- ☐ The entry shows `kafkaDetails` with: `topic`, `partition`, `offset`, `durationMs`
- ☐ `partition` is a non-negative integer
- ☐ `offset` is a non-negative integer (or string representation)
- ☐ `durationMs` shows the produce operation duration
- ☐ No auth credentials or TLS material appears in the trace

---

## WN-28 — Results Explorer: kafkaConsume Trace

**Steps:**
1. Run a workflow containing a kafkaConsume node
2. Open the Results Explorer
3. Expand the kafkaConsume node entry

**Expected:**
- ☐ The entry shows `kafkaDetails` with: `topic`, `matchedMessages` (count), `durationMs`
- ☐ No raw message payloads longer than 512 characters appear (truncated with indicator)
- ☐ No credentials or sensitive data in the log
- ☐ Debug trace level shows node lifecycle: start / outcome / summary

---

## WN-29 — Console Panel: Structured Kafka Logs

**Prerequisites:** Run a workflow with both kafkaProduce and kafkaConsume

**Steps:**
1. Open the Console panel in the Workflow Designer
2. Review log entries during and after execution

**Expected:**
- ☐ Log entries include node lifecycle status: **start**, **success**, **failure**
- ☐ Each entry includes **topic name** and **timing** (durationMs)
- ☐ kafkaProduce success logs show partition and offset
- ☐ kafkaConsume success logs show message count
- ☐ Log entries are structured (not raw stack traces)

---

## WN-30 — Sensitive Fields Redacted in Logs

**Steps:**
1. Configure a kafkaProduce node with:
   - A header containing a sensitive name (e.g., `Authorization`)
   - Schema Config with auth credentials
2. Run Quick Test
3. Review Console and Results Explorer logs

**Expected:**
- ☐ Auth credentials (username/password) do NOT appear in any log line
- ☐ TLS key/cert material does NOT appear in logs
- ☐ Protected header values are redacted or truncated
- ☐ Logs remain actionable (topic, error type visible) without exposing secrets

---

## WN-31 — Error Node State: Connection Failure

**Steps:**
1. Configure kafkaProduce with a valid topic but to a **disconnected** broker
2. Run Quick Test

**Expected:**
- ☐ The kafkaProduce node shows an **error badge** (red indicator)
- ☐ The failure class is visible (e.g., "network", "connection")
- ☐ Console shows the error with enough detail to diagnose (broker unreachable, timeout, etc.)
- ☐ The node does NOT hang indefinitely — it fails within the configured timeout

---

## WN-32 — Variable Inspector: Kafka Variables

**Steps:**
1. Run a workflow with kafkaProduce (output bindings configured) and kafkaConsume (output bindings configured)
2. Open the Variable Inspector / Debug panel after execution

**Expected:**
- ☐ Variables set by kafkaProduce bindings are visible (e.g., `producedPartition`, `producedOffset`)
- ☐ Variables set by kafkaConsume bindings are visible (e.g., `consumedKey`, `consumedTopic`)
- ☐ Variable values match the actual Kafka operation results

---

## WN-33 — kafkaTrigger Config Panel

**Steps:**
1. Add a kafkaTrigger node and open its config

**Expected:**
- ☐ **Label** text input (default: "Kafka Trigger")
- ☐ **Cluster ID** text input
- ☐ **Topic** text input — the subscription topic
- ☐ **Consumer Group ID** override input (optional; default derived from workflow+node ID)
- ☐ **Start Position** dropdown: Latest / Earliest (offset policy)
- ☐ **Key Regex** filter input
- ☐ **Header Filters** section (same as kafkaConsume)
- ☐ **JSONPath Filters** section
- ☐ **Max Concurrent Runs** number input (backpressure limit, default: 10)
- ☐ **Extract Variables** section: name + jsonPath pairs for body extraction into workflow context
- ☐ **Test Payload (Quick Test)** section: Message Body (JSON), Message Key, Message Headers (JSON)
- ☐ **Notes** text area

---

## WN-34 — Kafka Trigger Starts Workflow from Real Message

**Prerequisites:** Connected, trigger workflow saved and activated

**Steps:**
1. Create a workflow with **kafkaTrigger** → **LogDebug** → **End**
2. Configure kafkaTrigger:
   - Topic: `orders.created`
   - Start Position: Latest
3. Activate/register the trigger
4. Produce a matching message to `orders.created`:
   ```bash
   docker exec redfireforge-redpanda rpk topic produce orders.created \
     --key trigger-test-001 <<< '{"orderId":"T-001","event":"trigger-test"}'
   ```
5. Observe the workflow

**Expected:**
- ☐ Exactly **one** workflow run is created for the matching message
- ☐ The LogDebug node executes with the trigger message content
- ☐ No duplicate runs for the single message

---

## WN-35 — Non-Matching Messages Do Not Trigger

**Prerequisites:** Trigger workflow with key regex filter set to `^trigger-test-`

**Steps:**
1. Produce a message with a **non-matching** key:
   ```bash
   docker exec redfireforge-redpanda rpk topic produce orders.created \
     --key other-key-999 <<< '{"orderId":"X-999","event":"should-not-trigger"}'
   ```
2. Wait a few seconds
3. Check workflow run history

**Expected:**
- ☐ No new workflow run is created for the non-matching message
- ☐ Only messages matching the filter trigger workflow runs

---

## WN-36 — Trigger Run Metadata

**Prerequisites:** A successful trigger-started run from WN-34

**Steps:**
1. Inspect the run metadata for the triggered workflow run

**Expected:**
- ☐ Run metadata shows trigger **topic**: `orders.created`
- ☐ Metadata shows **partition** and **offset** of the triggering message
- ☐ Extracted variables from the trigger message body are visible in the workflow context

---

## WN-37 — Trigger Offset Policy: Only Post-Subscription Messages

**Prerequisites:** `orders.created` already has seeded messages

**Steps:**
1. Create a fresh trigger workflow with Start Position: **Latest** (default)
2. Subscribe/activate the trigger
3. Verify that **no** workflow runs are created for the pre-existing messages
4. Produce a **new** message after subscription
5. Verify that the new message triggers exactly one run

**Expected:**
- ☐ Pre-subscription messages are NOT replayed — 0 runs created
- ☐ Post-subscription message triggers exactly 1 run
- ☐ Consumer group ID is deterministic: `rf-trigger-<workflowId>-<nodeId>`

---

## WN-38 — Backpressure: Active-Run Limit

**Prerequisites:** Connected, trigger workflow configured

**Steps:**
1. Set **Max Concurrent Runs** to 2 on the kafkaTrigger node
2. Add a **Delay** node (e.g., 5 seconds) in the workflow to simulate processing time
3. Rapidly produce 5 messages:
   ```bash
   for i in $(seq 1 5); do
     docker exec redfireforge-redpanda rpk topic produce orders.created \
       --key "bp-test-$i" <<< "{\"orderId\":\"BP-$i\",\"event\":\"backpressure\"}"
   done
   ```
4. Observe concurrent run count

**Expected:**
- ☐ At most **2** runs execute concurrently
- ☐ The Kafka consumer **pauses** (not disconnects) when the limit is reached
- ☐ Consumer **auto-resumes** and processes remaining messages once active count drops below limit
- ☐ All 5 messages eventually trigger runs — none are silently dropped

---

## WN-39 — kafkaWait Config Panel

**Steps:**
1. Add a kafkaWait node and open its config

**Expected:**
- ☐ **Label** text input (default: "Kafka Wait")
- ☐ **Cluster ID** text input
- ☐ **Topic** text input — the correlation topic
- ☐ **Correlation ID Expression** input: e.g., `{{orderId}}` — the value to match against incoming messages
- ☐ **Correlation Source** dropdown: body / header / key
  - Body: shows **Correlation JSONPath** input (e.g., `$.orderId`)
  - Header: shows **Correlation Header** name input
  - Key: uses message key directly
- ☐ **Timeout (ms)** number input (0 = unlimited)
- ☐ **Key Regex** filter (pre-correlation filter)
- ☐ **Header Filters** section
- ☐ **Extract Variables** section (name + jsonPath)
- ☐ **Test Payload (Quick Test)** section: Message Body (JSON), Message Key, Message Headers (JSON)
- ☐ **Load Test Behavior** dropdown
- ☐ **Notes** text area

---

## WN-40 — KafkaWait Resumes on Correlated Message

**Prerequisites:** Connected, workflow with kafkaWait configured

**Steps:**
1. Create: **Start** → **kafkaProduce** → **kafkaWait** → **LogDebug** → **End**
2. Configure kafkaProduce to publish to `orders.created` with key `wait-test-001`
3. Configure kafkaWait:
   - Topic: `payments.authorized`
   - Correlation Source: key
   - Correlation ID Expression: `wait-test-001`
   - Timeout: 30000
4. Start the workflow
5. Publish a **non-matching** message: key `other-key-999`
6. Publish the **matching** message:
   ```bash
   docker exec redfireforge-redpanda rpk topic produce payments.authorized \
     --key wait-test-001 <<< '{"paymentId":"P-001","authorized":true}'
   ```

**Expected:**
- ☐ Workflow pauses at kafkaWait after the produce step
- ☐ Non-matching message (step 5) does NOT resume the workflow
- ☐ Matching message (step 6) resumes the workflow
- ☐ LogDebug executes with the correlated message content
- ☐ Run completes successfully

---

## WN-41 — Run History: Waiting → Resumed → Completed

**Steps:**
1. After completing WN-40, inspect the run history/timeline

**Expected:**
- ☐ Run history clearly shows state transitions: **waiting** → **resumed** → **completed**
- ☐ The wait duration is visible (time between pause and resume)
- ☐ The resume event metadata shows the correlated message details

---

## WN-42 — KafkaWait Timeout

**Steps:**
1. Configure kafkaWait with a short timeout: 5000ms (5 seconds)
2. Start the workflow but do NOT publish any matching message
3. Wait for the timeout

**Expected:**
- ☐ After 5 seconds, the workflow ends in a **timeout** state
- ☐ No hanging resources — the workflow terminates cleanly
- ☐ The timeout is visible in run history and Console logs
- ☐ UI exposes timeout clearly (not a generic error)

---

## WN-43 — Duplicate Callback Idempotency

**Steps:**
1. Start a workflow paused on kafkaWait with correlation `dup-test-001`
2. Publish the matching message **twice** with the same key and payload

**Expected:**
- ☐ Exactly **one** resume is applied
- ☐ The duplicate callback is classified as **ignored/duplicate**
- ☐ No second completion path is emitted
- ☐ Run history shows only one resume event

---

## WN-44 — Correlation Mismatch: Body/Header/Query Rejection

**Steps:**
1. Configure kafkaWait with:
   - Correlation Source: **body**
   - Correlation JSONPath: `$.orderId`
   - Correlation ID Expression: `ORDER-100`
2. Publish messages with mismatched body values (e.g., `$.orderId` = "ORDER-999")
3. Then publish a matching message (`$.orderId` = "ORDER-100")

**Expected:**
- ☐ Mismatched messages are rejected (workflow stays waiting)
- ☐ Only the matching message resumes the workflow
- ☐ Logs classify the mismatch reason clearly

---

## WN-45 — Restart Recovery: Server Restart Before Callback

**Steps:**
1. Start a workflow paused on kafkaWait
2. **Restart the server** (`npm run server` — kill and restart)
3. After restart, publish the matching callback message

**Expected:**
- ☐ The workflow resumes correctly after server restart
- ☐ No orphaned wait entries remain
- ☐ Context is preserved from the pre-restart state
- ☐ No duplicate runs or lost state

---

## WN-46 — Resume-Path Parity: Direct vs Callback

**Steps:**
1. Start two workflows paused on kafkaWait with different correlation IDs
2. Resume one via **direct resume** endpoint (API call)
3. Resume the other via **callback** endpoint (Kafka message)
4. Compare run histories

**Expected:**
- ☐ Both pathways produce equivalent state transitions (waiting → resumed → completed)
- ☐ Metadata indicates the resume source channel (direct vs callback)
- ☐ Neither path bypasses idempotency or timeout safeguards

---

## WN-47 — Consumer Cleanup on Timeout

**Steps:**
1. Configure kafkaWait with a 3-second timeout
2. Start the workflow, let it timeout
3. After timeout, check active Kafka consumer subscriptions

**Expected:**
- ☐ KafkaWait times out with a clean terminal status
- ☐ No lingering Kafka subscription remains after timeout
- ☐ Correlation store entry is cleaned up (no stale wait entry)
- ☐ Subsequent kafkaWait operations on the same topic are not affected by stale state

---

## WN-48 — Context Variable Seeding: Trigger/Wait Keys

**Prerequisites:** A trigger-started workflow and a wait-resumed workflow

**Steps:**
1. Fire a Kafka Trigger with known topic, key, headers, and JSON body
2. Inspect workflow variable context after trigger fires
3. Resume a KafkaWait node with a correlated message
4. Inspect variables after resume

**Expected (Trigger context):**
- ☐ `kafka.trigger.topic` = trigger topic name
- ☐ `kafka.trigger.partition` = partition number
- ☐ `kafka.trigger.offset` = offset number
- ☐ `kafka.trigger.key` = message key
- ☐ `kafka.trigger.value` = message value (JSON string)
- ☐ `kafka.trigger.header.<name>` for each header (e.g., `kafka.trigger.header.traceId`)

**Expected (Wait context):**
- ☐ `kafka.wait.topic` = wait topic name
- ☐ `kafka.wait.partition` = partition number
- ☐ `kafka.wait.offset` = offset number
- ☐ `kafka.wait.key` = message key
- ☐ `kafka.wait.value` = message value
- ☐ `kafka.wait.header.<name>` for each header

**Expected (No cross-contamination):**
- ☐ No `webhook.*` keys are populated by Kafka trigger/wait paths
- ☐ `kafka.trigger.*` and `kafka.wait.*` are independent namespaces
- ☐ `kafka.wait.*` keys are NOT set by the trigger, and vice versa

---

## Integration Test Plan Cross-Reference

| ITP Scenario | Visual Scenario(s) |
|---|---|
| Scenario 5 (kafkaProduce publishes) | WN-09 |
| Scenario 6 (kafkaConsume captures) | WN-14, WN-15, WN-18 |
| Scenario 6B (Config persistence) | WN-19, WN-20, WN-21 |
| Scenario 6C (Mixed chain) | WN-22 |
| Scenario 6D (Kafka logs) | WN-29, WN-30, WN-31 |
| Scenario 6E (Output bindings) | WN-10, WN-11 |
| Scenario 6F (Consume earliest) | WN-17 |
| Scenario 6G (Load test auto-resume) | WN-25, WN-26 |
| Scenario 6H (Results Explorer trace) | WN-27, WN-28 |
| Scenario 6I (continueOnError) | WN-23, WN-24 |
| Scenario 7 (Kafka Trigger) | WN-34, WN-35, WN-36 |
| Scenario 8 (KafkaWait resumes) | WN-40, WN-41 |
| Scenario 9 (KafkaWait timeout) | WN-42 |
| Scenario 9B (Duplicate callback) | WN-43 |
| Scenario 9C (Correlation mismatch) | WN-44 |
| Scenario 9D (Restart recovery) | WN-45 |
| Scenario 9E (Resume-path parity) | WN-46 |
| Scenario 9F (Trigger offset policy) | WN-37 |
| Scenario 9G (Backpressure) | WN-38 |
| Scenario 9H (Consumer cleanup) | WN-47 |
| Scenario 9I (Context variable seeding) | WN-48 |
| Scenario 10 (Trigger sample payload Quick Test) | WN-49 |
| Scenario 10B (Wait sample payload Quick Test) | WN-50 |
| Scenario 10C (Trigger dry-run vs sample comparison) | WN-51 |
| Scenario 11 (Real Kafka Docker — produce verify) | WN-52, WN-53, WN-54, WN-55, WN-56 |
| Scenario 11B (Export → Import round-trip) | WN-57 |
| Scenario 12 (Workflow → Kafka Studio Consume) | WN-58, WN-60, WN-63 |
| Scenario 12B (Kafka Studio Publish → Consume) | WN-59, WN-61, WN-62 |
| Scenario 13 (Header Pass-Through E2E) | WN-64 |

---

## Scenario 10 — Kafka Trigger Sample Payload (Quick Test)

> **What it tests:** Quick Test uses a configured sample payload instead of dry-running with empty variables, allowing end-to-end workflow verification without a real Kafka subscription.

### WN-49: Trigger Sample Payload Quick Test

**Goal:** Verify that a Kafka Trigger node with a configured sample payload extracts real variable values in Quick Test.

**Pre-requisites:** Import `kafka-workflow-scenario-02-trigger-http-produce.json`.

**Steps:**
1. Open **Kafka Scenario 02 — Trigger → HTTP → Produce** in the Workflow Designer.
2. Click the ⚙ button on the **Order Created Trigger** node.
3. Scroll to the **Test Payload (Quick Test)** section.
4. In **Message Body (JSON)**, paste:
   ```json
   {
     "orderId": "ORD-2025-001",
     "customerId": "CUST-789",
     "status": "new",
     "amount": 149.99
   }
   ```
5. In **Message Key**, type: `ORD-2025-001`
6. Click **Save**.
7. Open the **Console** panel (bottom bar).
8. Click **Quick Test**.

**Expected Results:**
- [ ] Console shows: `[Order Created Trigger] Triggered by sample payload (Quick Test)`
- [ ] Console shows: `topic: orders.created`
- [ ] Console shows: `key: ORD-2025-001`
- [ ] Console shows the full sample body with orderId, customerId, status, amount
- [ ] Console shows: `variables: orderId="ORD-2025-001", customerId="CUST-789"`
- [ ] Downstream **Produce Enriched Order** node shows `key: ORD-2025-001` (not empty)
- [ ] Downstream produce body shows `"orderId": "ORD-2025-001"` and `"customerId": "CUST-789"` (real values, not `{{orderId}}`)
- [ ] Workflow completes with all nodes PASS

---

## Scenario 10B — Kafka Wait Sample Payload (Quick Test)

> **What it tests:** Quick Test resolves a Kafka Wait node using a configured sample payload instead of hanging forever waiting for a real correlated message.

### WN-50: Wait Sample Payload Quick Test

**Goal:** Verify that Scenario 03 (Produce → Wait correlation) completes instantly in Quick Test with sample payload.

**Pre-requisites:** Import `kafka-workflow-scenario-03-produce-wait-correlation.json`.

**Steps:**
1. Open **Kafka Scenario 03 — Produce then Wait (Correlation)** in the Workflow Designer.
2. Click the ⚙ button on the **Wait for Payment** node.
3. Scroll to the **Test Payload (Quick Test)** section.
4. In **Message Body (JSON)**, paste:
   ```json
   {
     "orderId": "ORD-2025-001",
     "paymentId": "PAY-TEST-001",
     "amount": 129.99,
     "status": "confirmed"
   }
   ```
5. In **Message Key**, type: `ORD-2025-001`
6. Click **Save**.
7. Open the **Console** panel.
8. Click **Quick Test**.

**Expected Results:**
- [ ] Workflow completes in under 1 second (previously hung forever)
- [ ] Console shows: `[Wait for Payment] Resolved from sample payload (Quick Test)`
- [ ] Console shows extracted variables: `paymentId = PAY-TEST-001` and `paidAmount = 129.99`
- [ ] Console shows the full sample body JSON
- [ ] All nodes show PASS state

---

## Scenario 10C — Trigger Dry-Run vs Sample Comparison

> **What it tests:** Verifies that removing the sample payload reverts to dry-run mode with empty variables.

### WN-51: Dry-Run vs Sample Payload Comparison

**Goal:** Confirm the three distinct Quick Test modes for Kafka Trigger show different console output.

**Steps (Dry-Run):**
1. Open Scenario 02 Kafka Trigger config.
2. Clear the **Message Body (JSON)** field (leave it empty).
3. Click **Save**.
4. Run **Quick Test**.

**Expected Results (Dry-Run):**
- [ ] Console shows: `[Order Created Trigger] Dry-run (Quick Test) — no sample payload configured`
- [ ] Console shows: `All kafka.trigger.* variables seeded as empty strings`
- [ ] Console shows: `Tip: add a Test Payload in the trigger config to simulate a real message`
- [ ] Console shows: `variables: orderId=(empty), customerId=(empty)`
- [ ] Downstream produce shows `key: {{orderId}}` (unresolved template)

**Steps (Sample Payload):**
1. Re-add the sample payload JSON (see WN-49 step 4).
2. Click **Save** → **Quick Test**.

**Expected Results (Sample Payload):**
- [ ] Console shows: `[Order Created Trigger] Triggered by sample payload (Quick Test)`
- [ ] Variables resolve to real values
- [ ] Downstream produce shows `key: ORD-2025-001`

---

## Real Kafka Docker Testing (WN-52 through WN-57)

> **What it tests:** End-to-end verification that Quick Test actually writes and reads real messages
> from a Kafka broker running in Docker (Redpanda). Each scenario is tested by running Quick Test
> and then verifying the produced messages directly via `rpk` on the Docker container.
>
> This section is designed so **any user** can follow these steps from scratch.

### Prerequisites

1. **Docker running** with the Redpanda containers:
   ```bash
   cd docker/kafka/plaintext && docker compose up -d
   # Also start schema registry if testing Scenario 04:
   cd docker/kafka/schema-registry && docker compose up -d
   ```

2. **Verify containers are healthy:**
   ```bash
   docker ps --filter name=redfireforge-redpanda --format "{{.Names}} {{.Status}}"
   # Expected: redfireforge-redpanda Up ... (healthy)
   ```

3. **Seed topics** (creates all required topics):
   ```bash
   docker/kafka/e2e/ui-test-seed.sh
   ```

4. **Start the server and dev app:**
   ```bash
   npm run server   # Backend on port 3001
   npm run dev      # Frontend on port 5173
   ```

5. **Connect the Kafka cluster** in the app:
   - Go to **Settings → Kafka** → Create/select `Local Plaintext` cluster
   - Broker: `127.0.0.1:19092`, Auth: None, TLS: Off
   - Click **Connect** → verify green badge

### How to Verify Produced Messages with rpk

After each Quick Test run, use `rpk` inside the Docker container to verify the message was actually written:

```bash
# Consume the latest message at a specific offset
docker exec redfireforge-redpanda rpk topic consume <TOPIC> -n 1 -o <OFFSET>

# List all messages from the beginning
docker exec redfireforge-redpanda rpk topic consume <TOPIC> -n 10

# Check topic metadata
docker exec redfireforge-redpanda rpk topic list
```

The Console panel shows the exact **partition** and **offset** for each Produce operation — use those values with rpk.

---

### WN-52: Scenario 01 — Produce then Consume (Real Kafka)

**Goal:** Verify kafkaProduce writes a real message and kafkaConsume reads it back.

**Steps:**
1. Import `docs/test-data/kafka-workflow-scenario-01-produce-consume.json` via **+ New → Import Workflow**.
2. Select **Kafka Scenario 01** in the sidebar.
3. Open the **Console** panel (click "Console" in the footer bar).
4. Click **Quick Test**.

**Verify in Console:**
- [ ] `[Produce Order Event] PRODUCE redfireforge.workflow.test` with cluster `local-plaintext`
- [ ] `[Produce Order Event] Produced — XXms` with `partition: 0, offset: N`
- [ ] `[Produce Order Event]` shows key: `order-123`, headers (`Content-Type`, `X-Source`), and full JSON body
- [ ] `[Consume Order Event] CONSUME redfireforge.workflow.test` with `startPosition: earliest`
- [ ] `[Consume Order Event] Consumed 1 message(s)` with matching key and body
- [ ] `Workflow PASS`

**Verify with rpk (use the offset from Console):**
```bash
docker exec redfireforge-redpanda rpk topic consume redfireforge.workflow.test -n 1 -o <OFFSET>
```
- [ ] rpk shows key `order-123`
- [ ] rpk shows body `{"orderId": "order-123", "amount": 49.99, "currency": "USD", "items": ["widget-A", "gadget-B"]}`
- [ ] rpk shows headers `Content-Type: application/json` and `X-Source: redfireforge-test`

---

### WN-53: Scenario 02 — Trigger → HTTP → Produce (Real Kafka)

**Goal:** Verify kafkaTrigger uses sample payload, HTTP enrichment works, and downstream kafkaProduce writes to real Kafka.

**Steps:**
1. Import `docs/test-data/kafka-workflow-scenario-02-trigger-http-produce.json`.
2. Select **Kafka Scenario 02** in the sidebar.
3. Open the **Console** panel.
4. Click **Quick Test**.

**Verify in Console:**
- [ ] `[Order Created Trigger] Triggered by sample payload (Quick Test)` (NOT "Dry-run")
- [ ] `topic: orders.created`, `key: ORD-2025-001`
- [ ] `variables: orderId="ORD-2025-001", customerId="CUST-789"`
- [ ] `[Enrich Order] 200` — HTTP enrichment succeeds
- [ ] `[Produce Enriched Order] PRODUCE orders.enriched` with `key: ORD-2025-001`
- [ ] `[Produce Enriched Order] Produced — XXms` with partition and offset
- [ ] Produce body contains `"orderId": "ORD-2025-001"` and `"customerId": "CUST-789"` (resolved variables, not `{{...}}`)
- [ ] `Workflow PASS`

**Verify with rpk:**
```bash
docker exec redfireforge-redpanda rpk topic consume orders.enriched -n 1 -o <OFFSET>
```
- [ ] rpk shows key `ORD-2025-001`
- [ ] rpk shows body with resolved `orderId` and `customerId`
- [ ] rpk shows header `X-Enriched-By: redfireforge`

---

### WN-54: Scenario 03 — Produce then Wait (Real Kafka)

**Goal:** Verify kafkaProduce writes to real Kafka and kafkaWait resolves from sample payload with extracted variables.

**Steps:**
1. Import `docs/test-data/kafka-workflow-scenario-03-produce-wait-correlation.json`.
2. Select **Kafka Scenario 03** in the sidebar.
3. Open the **Console** panel.
4. Click **Quick Test**.

**Verify in Console:**
- [ ] `[Send Order] PRODUCE orders.submitted` with `key: ORD-2025-001`
- [ ] `[Send Order] Produced — XXms` with partition and offset
- [ ] `[Wait for Payment] KAFKA WAIT on topic "payments.confirmed"`
- [ ] `correlationId: ORD-2025-001`
- [ ] `[Wait for Payment] Resolved from sample payload (Quick Test)` (NOT "Synthetic inject" or hanging)
- [ ] Extracted variables: `paymentId = PAY-TEST-001`, `paidAmount = 129.99`
- [ ] Full sample body shown in Console
- [ ] `Workflow PASS` — completes in under 1 second

**Verify with rpk:**
```bash
docker exec redfireforge-redpanda rpk topic consume orders.submitted -n 1 -o <OFFSET>
```
- [ ] rpk shows key `ORD-2025-001`
- [ ] rpk shows body with `orderId`, `amount`, `currency`, `submittedAt`

**Publish verification for kafkaWait (optional — for real subscription test):**
If testing with a real Kafka subscription (not Quick Test), publish a correlated message:
```bash
docker exec redfireforge-redpanda rpk topic produce payments.confirmed \
  --key ORD-2025-001 <<< '{"orderId":"ORD-2025-001","paymentId":"PAY-REAL-001","amount":129.99,"status":"confirmed"}'
```
Then verify the workflow resumes and extracts `paymentId = PAY-REAL-001`.

---

### WN-55: Scenario 04 — Produce with Schema Registry (Real Avro E2E)

**Goal:** Verify kafkaProduce writes an **Avro-encoded** message via Confluent Schema Registry and kafkaConsume reads + decodes it back from the `users.avro` topic.

**Prerequisites:**
- Schema Registry Docker profile running: `cd docker/kafka/schema-registry && docker compose up -d`
- `users.avro-value` schema registered (User record: name, email, age, active)
- `local-schema-registry` cluster configured in Kafka Settings (broker: `127.0.0.1:19094`)
- Connected to the Schema Registry cluster

**Steps:**
1. Import `docs/test-data/kafka-workflow-scenario-04-schema-registry-produce.json`.
2. Select **Kafka Scenario 04** in the sidebar.
3. Verify nodes show `Cluster: local-schema-registry` (not `local-plaintext`).
4. Open the **Console** panel.
5. Click **Quick Test**.

**Verify in Console:**
- [ ] `[Produce Avro User] PRODUCE users.avro` with `cluster: local-schema-registry`
- [ ] `[Produce Avro User] key: user-42`, `header Content-Type: application/avro`
- [ ] `[Produce Avro User] Produced — XXms` with partition and offset
- [ ] `[Consume Avro User] CONSUME users.avro` with `cluster: local-schema-registry`
- [ ] `[Consume Avro User] Consumed 1 message(s)` — body shows decoded JSON: `name`, `email`, `age`, `active`
- [ ] `Workflow PASS`

**Verify in Kafka Studio:**
1. Navigate to **Protocols → Kafka → Consume** tab.
2. Topic: `users.avro`, Start Position: **Earliest**.
3. Enable **Schema Registry**: URL = `http://localhost:8085`, Format = Avro.
4. Click **Consume Once**.
- [ ] Messages appear with key `user-42` and decoded JSON body.
- [ ] Click the row → detail panel shows pretty-printed `{"name":"Alice Johnson","email":"alice@example.com","age":30,"active":true}`.

**Verify with rpk:**
```bash
docker exec redfireforge-redpanda-sr rpk topic consume users.avro --offset start --num 3 --brokers localhost:9092
```
- [ ] rpk shows messages including key `user-42`
- [ ] rpk shows binary Avro content (rpk does not decode Avro)

> **Cross-reference:** See `kafka-schema-registry-test-scenarios.md` scenarios SR-E2E-01 through SR-E2E-09 for the full Schema Registry E2E test suite.

---

### WN-56: Scenario 05 — Full Event-Driven Pipeline (Real Kafka)

**Goal:** Verify the complete pipeline: Trigger (sample payload) → HTTP validation → Condition branch → 2 Produces (orders.approved + notifications.email), with Wait resolving from sample payload.

**Steps:**
1. Import `docs/test-data/kafka-workflow-scenario-05-full-event-pipeline.json`.
2. Select **Kafka Scenario 05** in the sidebar.
3. Open the **Console** panel.
4. Click **Quick Test**.

**Verify in Console:**
- [ ] `[New Order Trigger] Triggered by sample payload (Quick Test)` with `key: ORD-PIPE-001`
- [ ] `variables: orderId="ORD-PIPE-001", customerId="CUST-555", amount="249.99"`
- [ ] `[Validate Order] 200` — HTTP validation succeeds
- [ ] `[Order Approved?] 1 !=  → Yes` — condition passes
- [ ] `[Emit Approved Event] PRODUCE orders.approved` with `key: ORD-PIPE-001`
- [ ] Produce body: `"orderId": "ORD-PIPE-001"`, `"customerId": "CUST-555"`, `"amount": 249.99`
- [ ] `[Await Payment] Resolved from sample payload (Quick Test)` (NOT "Synthetic inject")
- [ ] Extracted: `paymentId = PAY-TEST-001`, `paymentStatus = completed`
- [ ] `[Send Notification] PRODUCE notifications.email` with `key: CUST-555`
- [ ] Notification body: `"Payment PAY-TEST-001 received. Status: completed."` (all variables resolved)
- [ ] `Workflow PASS`

**Verify with rpk — orders.approved:**
```bash
docker exec redfireforge-redpanda rpk topic consume orders.approved -n 1 -o <OFFSET>
```
- [ ] rpk shows key `ORD-PIPE-001`
- [ ] rpk shows body with resolved `orderId`, `customerId`, `amount`, `approvedAt`

**Verify with rpk — notifications.email:**
```bash
docker exec redfireforge-redpanda rpk topic consume notifications.email -n 5
```
- [ ] Find the message with key `CUST-555`
- [ ] Body shows `"Payment PAY-TEST-001 received. Status: completed."`

---

### WN-57: Export → Delete → Import Round-Trip

**Goal:** Verify that exported workflow JSON files can be deleted and re-imported, then all scenarios still pass Quick Test.

**Steps:**
1. Right-click **Kafka Scenario 02** in the sidebar → **Export Workflow** → save the JSON file.
2. Right-click **each** of the 5 Kafka scenarios → **Delete Workflow** → confirm deletion.
3. Verify 0 Kafka scenarios remain in the sidebar.
4. Click **+ New → Import Workflow** → select each of the 5 JSON files from `docs/test-data/`:
   - `kafka-workflow-scenario-01-produce-consume.json`
   - `kafka-workflow-scenario-02-trigger-http-produce.json`
   - `kafka-workflow-scenario-03-produce-wait-correlation.json`
   - `kafka-workflow-scenario-04-schema-registry-produce.json`
   - `kafka-workflow-scenario-05-full-event-pipeline.json`
5. Run **Quick Test** on each imported workflow.

**Expected Results:**
- [ ] All 5 workflows import without errors
- [ ] All 5 workflows appear in the sidebar with correct names and node counts
- [ ] All 5 Quick Tests pass — produce nodes write to real Kafka, consume/trigger/wait work correctly
- [ ] Console logs match the expected output from WN-52 through WN-56
- [ ] Exported JSON from step 1 contains `samplePayload`, `sampleKey` fields for trigger/wait nodes

---

## E2E Kafka Studio Verification (WN-58 through WN-63)

> **What it tests:** True end-to-end verification using the app's built-in **Kafka Studio**
> (Publish and Consume tabs) instead of CLI tools like `rpk`. This proves the entire data flow:
> Workflow produces → Kafka Studio Consume reads the message, and
> Kafka Studio Publish writes → Workflow consumes/triggers from it.
>
> **Why this matters:** The Kafka Studio is the user-facing tool for interacting with Kafka.
> Verifying through the Studio proves the same UI a user would use, not just CLI tools.

### Prerequisites

Same as the "Real Kafka Docker Testing" prerequisites above, plus:
- Navigate to the **Protocols** activity bar → **Kafka** tab to access Kafka Studio.
- Kafka Studio has **Publish**, **Consume**, **Topics**, and **Schema Registry** sub-tabs.

### How to Use Kafka Studio

**Publish tab:**
1. Set **Topic** name
2. Set **Key** (optional)
3. Set **Message Body (JSON)**
4. Click **Send Once**
5. Verify the success banner: `✓ Sent 1 message to <topic> — partition X, offset Y`

**Consume tab:**
1. Set **Topic** name
2. Set **Start Position**: `Earliest` (to see all messages) or `Latest` (new messages only)
3. Optionally set **Key Equals** filter to find specific messages
4. Click **Consume Once**
5. Results appear in a table: `# | OFFSET | PARTITION | KEY | VALUE`

---

### WN-58: Workflow Produce → Kafka Studio Consume Verify

**Goal:** After running Scenario 01 Quick Test (which produces to `redfireforge.workflow.test`), verify the produced message appears in Kafka Studio's Consume tab.

**Steps:**
1. Go to **Workflow** → select **Kafka Scenario 01** → click **Quick Test**.
2. Note the **partition** and **offset** shown in the Console panel (e.g., `partition: 0, offset: 8`).
3. Navigate to **Protocols → Kafka → Consume** tab.
4. Set **Topic**: `redfireforge.workflow.test`
5. Set **Start Position**: `Earliest`
6. Set **Key Equals** filter: `order-123`
7. Click **Consume Once**.

**Expected Results:**
- [ ] Kafka Studio shows one or more messages with key `order-123`
- [ ] The latest message (highest offset) matches the offset from the Console
- [ ] The message value contains `{"orderId": "order-123", "amount": 49.99, "currency": "USD", "items": ["widget-A", "gadget-B"]}`
- [ ] The message was produced by the Workflow, not manually — proving the Workflow→Kafka→Studio path works

---

### WN-59: Kafka Studio Publish → Consume Round-Trip

**Goal:** Publish a message entirely through Kafka Studio Publish, then verify it via Kafka Studio Consume.

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab.
2. Set **Topic**: `orders.created`
3. Set **Key**: `ORD-E2E-001`
4. Set **Message Body (JSON)**:
   ```json
   {
     "orderId": "ORD-E2E-001",
     "customerId": "CUST-E2E",
     "amount": 99.99,
     "status": "new"
   }
   ```
5. Click **Send Once**.
6. Verify success: `✓ Sent 1 message to orders.created — partition 0, offset N`.
7. Switch to the **Consume** tab.
8. Set **Topic**: `orders.created`
9. Set **Start Position**: `Earliest`
10. Set **Key Equals**: `ORD-E2E-001`
11. Click **Consume Once**.

**Expected Results:**
- [ ] Publish tab shows `✓ Sent 1 message to orders.created` with partition and offset
- [ ] Consume tab shows exactly 1 message with key `ORD-E2E-001`
- [ ] Message value matches exactly what was published: `orderId`, `customerId`, `amount`, `status`
- [ ] Offset in Consume matches the offset reported by Publish

---

### WN-60: Scenario 02 Produce → Kafka Studio Consume Verify

**Goal:** Scenario 02's kafkaProduce writes to `orders.enriched` — verify this in Kafka Studio Consume.

**Steps:**
1. Go to **Workflow** → select **Kafka Scenario 02** → click **Quick Test**.
2. Note the **offset** from Console: `[Produce Enriched Order] Produced — partition: 0, offset: N`.
3. Navigate to **Protocols → Kafka → Consume** tab.
4. Set **Topic**: `orders.enriched`
5. Set **Start Position**: `Earliest`
6. Set **Key Equals**: `ORD-2025-001`
7. Click **Consume Once**.

**Expected Results:**
- [ ] Kafka Studio shows message(s) with key `ORD-2025-001`
- [ ] The latest message contains `"orderId": "ORD-2025-001"` and `"customerId": "CUST-789"` (resolved variables from the trigger sample payload)
- [ ] The enrichment data from the HTTP call is present in the body (e.g., `"enriched": true`)
- [ ] This proves: Trigger (sample payload) → HTTP enrichment → Produce → Kafka topic → visible in Kafka Studio

---

### WN-61: Kafka Studio Publish to Trigger Topic → Consume Verify

**Goal:** Simulate what a real Kafka Trigger would receive by publishing a message to the trigger's topic (`orders.created`) via Kafka Studio Publish, then verifying it exists via Consume.

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab.
2. Set **Topic**: `orders.created`
3. Set **Key**: `ORD-TRIGGER-001`
4. Set **Message Body (JSON)**:
   ```json
   {
     "orderId": "ORD-TRIGGER-001",
     "customerId": "CUST-TRIGGER",
     "amount": 199.99,
     "status": "new",
     "source": "kafka-studio-e2e"
   }
   ```
5. Click **Send Once**.
6. Verify: `✓ Sent 1 message to orders.created`.
7. Switch to **Consume** tab.
8. Set **Topic**: `orders.created`
9. Set **Key Equals**: `ORD-TRIGGER-001`
10. Set **Start Position**: `Earliest`
11. Click **Consume Once**.

**Expected Results:**
- [ ] Publish succeeds with partition and offset confirmation
- [ ] Consume shows exactly 1 message with key `ORD-TRIGGER-001`
- [ ] Message body matches what was published, including `"source": "kafka-studio-e2e"`
- [ ] This simulates the exact message a real kafkaTrigger node would receive from a producer

> **Context:** In a real production workflow, a kafkaTrigger would subscribe to `orders.created` and process this message automatically. In Quick Test mode, we use sample payloads instead. This E2E test verifies the message is on the topic and would be available for a real trigger subscription.

---

### WN-62: Kafka Studio Publish to Wait Topic → Consume Verify

**Goal:** Simulate a correlated message for kafkaWait by publishing to `payments.confirmed` via Kafka Studio Publish, then verifying via Consume.

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab.
2. Set **Topic**: `payments.confirmed`
3. Set **Key**: `ORD-CORR-001`
4. Set **Message Body (JSON)**:
   ```json
   {
     "paymentId": "PAY-E2E-001",
     "orderId": "ORD-CORR-001",
     "amount": 150.00,
     "status": "confirmed",
     "timestamp": "2025-01-01T12:00:00Z"
   }
   ```
5. Click **Send Once**.
6. Verify: `✓ Sent 1 message to payments.confirmed`.
7. Switch to **Consume** tab.
8. Set **Topic**: `payments.confirmed`
9. Set **Key Equals**: `ORD-CORR-001`
10. Set **Start Position**: `Earliest`
11. Click **Consume Once**.

**Expected Results:**
- [ ] Publish succeeds with offset confirmation
- [ ] Consume shows 1 message with key `ORD-CORR-001`
- [ ] Message body matches: `paymentId`, `orderId`, `amount`, `status`, `timestamp`
- [ ] This verifies the exact message a kafkaWait node would correlate against in a real workflow

> **Context:** In a real workflow (Scenario 03), the kafkaWait node would subscribe to `payments.confirmed` and wait for a message where `$.orderId` matches the correlation ID. This E2E test verifies the correlated message exists on the topic.

---

### WN-63: Scenario 05 Full Pipeline → Kafka Studio Consume Both Topics

**Goal:** Run Scenario 05 (full event-driven pipeline) and verify **both** produced topics (`orders.approved` and `notifications.email`) via Kafka Studio Consume.

**Steps:**
1. Go to **Workflow** → select **Kafka Scenario 05** → click **Quick Test**.
2. Note offsets from Console:
   - `[Emit Approved Event] PRODUCE orders.approved — partition: X, offset: N`
   - `[Send Notification] PRODUCE notifications.email — partition: X, offset: N`

**Verify `orders.approved`:**
3. Navigate to **Protocols → Kafka → Consume** tab.
4. Set **Topic**: `orders.approved`
5. Set **Start Position**: `Earliest`
6. Click **Consume Once**.

**Expected:**
- [ ] Message with key containing order data is visible
- [ ] Body contains `"orderId"`, `"customerId"`, `"amount"`, `"approvedAt"` — all resolved (not `{{...}}` templates)
- [ ] The latest offset matches what the Console reported

**Verify `notifications.email`:**
7. Change **Topic** to: `notifications.email`
8. Set **Start Position**: `Earliest`
9. Click **Consume Once**.

**Expected:**
- [ ] Message with key `CUST-555` is visible (from sample payload)
- [ ] Body contains resolved notification text: `"Payment PAY-TEST-001 received. Status: completed."`
- [ ] No unresolved `{{paymentId}}` or `{{paymentStatus}}` in the body — all variables from the kafkaWait sample payload are resolved
- [ ] This proves the entire pipeline: Trigger → HTTP → Condition → Produce → Wait (sample) → Produce — all verified through Kafka Studio

---

## Header Pass-Through E2E (WN-64)

> **What it tests:** Full header lifecycle — publish a Kafka message with multiple custom headers via Kafka Studio,
> process them in a workflow (kafkaTrigger extracts headers → kafkaProduce forwards them to an output topic),
> then verify all headers are preserved on the output topic via Kafka Studio Consume.

### Prerequisites

1. **Docker**: Plaintext broker running on `localhost:19092` (same as other scenarios).
2. **Topics**: Create test topics:
   ```bash
   docker exec redfireforge-redpanda rpk topic create headers.inbound --partitions 1
   docker exec redfireforge-redpanda rpk topic create headers.outbound --partitions 1
   ```
3. **Kafka Cluster**: `local-plaintext` connected in **Settings → Kafka** (green badge).
4. **Import Scenario 06**: Go to **Workflow → + New → Import Workflow** → select `docs/test-data/kafka-workflow-scenario-06-header-passthrough.json`.

### Scenario 06 Workflow Overview

```
kafkaTrigger ("Inbound Order with Headers")
  ↓  extracts: orderId, amount, customerName from body
  ↓  extracts: kafka.trigger.header.X-Trace-Id, X-Correlation-Id, X-Source, X-Environment
kafkaProduce ("Forward Order — Preserve Headers")
  ↓  topic: headers.outbound
  ↓  body: resolved order JSON with processedAt + processedBy
  ↓  headers: X-Trace-Id, X-Correlation-Id, X-Source, X-Environment (from trigger) + X-Processed-By (static)
End
```

The kafkaTrigger node has a **sample payload** configured:
- **Body**: `{"orderId": "ORD-HDR-001", "amount": 199.99, "customerName": "Alice Johnson"}`
- **Key**: `ORD-HDR-001`
- **Headers**: `{"X-Trace-Id": "TR-E2E-001", "X-Correlation-Id": "COR-E2E-001", "X-Source": "kafka-studio", "X-Environment": "test"}`

The kafkaProduce node references these headers via `{{kafka.trigger.header.X-Trace-Id}}` etc., and adds a new `X-Processed-By: redfireforge` header.

---

### WN-64: Header Pass-Through E2E

**Goal:** Verify that Kafka message headers survive the full lifecycle: Publish (Kafka Studio) → Trigger (workflow) → Produce (workflow) → Consume (Kafka Studio).

#### Part A: Quick Test with Sample Payload

1. Go to **Workflow** → select **Kafka Scenario 06 — Header Pass-Through**.
2. Open the **Console** panel (bottom dock).
3. Click **Quick Test**.

**Expected (Console):**
- [ ] `[Inbound Order (with Headers)] Triggered by sample payload (Quick Test)` — confirms sample payload mode
- [ ] `[Inbound Order (with Headers)]   header X-Trace-Id: TR-E2E-001`
- [ ] `[Inbound Order (with Headers)]   header X-Correlation-Id: COR-E2E-001`
- [ ] `[Inbound Order (with Headers)]   header X-Source: kafka-studio`
- [ ] `[Inbound Order (with Headers)]   header X-Environment: test`
- [ ] `[Inbound Order (with Headers)]   variables: orderId="ORD-HDR-001", amount="199.99", customerName="Alice Johnson"`
- [ ] `[Forward Order (Preserve Headers)] PRODUCE headers.outbound`
- [ ] `[Forward Order (Preserve Headers)]   header X-Trace-Id: TR-E2E-001`
- [ ] `[Forward Order (Preserve Headers)]   header X-Correlation-Id: COR-E2E-001`
- [ ] `[Forward Order (Preserve Headers)]   header X-Source: kafka-studio`
- [ ] `[Forward Order (Preserve Headers)]   header X-Environment: test`
- [ ] `[Forward Order (Preserve Headers)]   header X-Processed-By: redfireforge`
- [ ] `Workflow PASS` — all nodes green

#### Part B: Verify Headers in Kafka Studio Consume

4. Navigate to **Protocols → Kafka → Consume** tab.
5. Set **Topic**: `headers.outbound`
6. Set **Start Position**: `Earliest`
7. Click **Consume Once**.
8. Click on the message row (key: `ORD-HDR-001`) to expand the detail view.

**Expected:**
- [ ] Message body is pretty-printed JSON:
  ```json
  {
    "orderId": "ORD-HDR-001",
    "amount": 199.99,
    "customerName": "Alice Johnson",
    "processedAt": "2026-06-05T10:45:00Z",
    "processedBy": "redfireforge"
  }
  ```
- [ ] Headers table shows **all 5 headers**:

  | HEADER KEY | HEADER VALUE |
  |---|---|
  | X-Trace-Id | TR-E2E-001 |
  | X-Correlation-Id | COR-E2E-001 |
  | X-Source | kafka-studio |
  | X-Environment | test |
  | X-Processed-By | redfireforge |

- [ ] The first 4 headers match the sample payload headers from the trigger
- [ ] `X-Processed-By` is the static header added by the produce node

#### Part C: Publish with Headers via Kafka Studio

This step demonstrates publishing a message with custom headers from Kafka Studio (simulating what a real Kafka producer would do).

9. Navigate to **Protocols → Kafka → Publish** tab.
10. Set **Topic**: `headers.inbound`
11. Set **Key**: `ORD-HDR-002`
12. Click **+ Add** four times to add 4 headers:

   | Key | Value |
   |---|---|
   | X-Trace-Id | TR-E2E-002 |
   | X-Correlation-Id | COR-E2E-002 |
   | X-Source | kafka-studio-publish |
   | X-Environment | production |

13. Set **Message Body**:
    ```json
    {"orderId": "ORD-HDR-002", "amount": 350.00, "customerName": "Bob Smith"}
    ```
14. Click **Send Once**.

**Expected:**
- [ ] Status shows **✓ Pass**
- [ ] Message is confirmed on `headers.inbound` topic

#### Part D: Verify Published Headers via Kafka Studio Consume

15. Switch to **Consume** tab.
16. Set **Topic**: `headers.inbound`
17. Set **Start Position**: `Earliest`
18. Click **Consume Once**.
19. Click on the message row (key: `ORD-HDR-002`).

**Expected:**
- [ ] Body matches: `{"orderId": "ORD-HDR-002", "amount": 350.00, "customerName": "Bob Smith"}`
- [ ] Headers table shows all 4 published headers:

  | HEADER KEY | HEADER VALUE |
  |---|---|
  | X-Trace-Id | TR-E2E-002 |
  | X-Correlation-Id | COR-E2E-002 |
  | X-Source | kafka-studio-publish |
  | X-Environment | production |

#### Part E: Re-run Workflow and Verify Output (Full Cycle)

20. Go back to **Workflow** → **Kafka Scenario 06** → click **Quick Test** again.
21. Navigate to **Consume** → set **Topic**: `headers.outbound`, **Start Position**: `Earliest`.
22. Click **Consume Once** and find the latest message (highest offset).

**Expected:**
- [ ] A new message at the latest offset with key `ORD-HDR-001` and all 5 headers intact
- [ ] This confirms the full E2E: Kafka Studio Publish → Kafka topic → Workflow Trigger → Produce with headers → Kafka topic → Kafka Studio Consume

#### Verification via rpk (Optional CLI Verification)

You can also verify via `rpk` command line:

```bash
# Verify headers on inbound topic
docker exec redfireforge-redpanda rpk topic consume headers.inbound --offset start --num 1

# Verify headers on outbound topic
docker exec redfireforge-redpanda rpk topic consume headers.outbound --offset start --num 1
```

Both should show the full `"headers"` array in the JSON output.

---

### Troubleshooting

| Issue | Resolution |
|---|---|
| `Workflow FAIL` on kafkaProduce | Check Kafka connection: **Settings → Kafka** → verify green badge. Run `docker exec redfireforge-redpanda rpk topic list` to confirm broker is healthy. |
| Trigger shows "Dry-run" instead of "sample payload" | Open the Trigger node config → verify **Test Payload** section has JSON body populated. Re-save and re-run. |
| Wait hangs forever | Open the Wait node config → verify **Test Payload** section has JSON body. Also check that `loadTestBehavior.mode` is `wait-for-real` (not `synthetic-inject`). |
| rpk shows unresolved `{{variables}}` | The workflow was imported from an older JSON without sample payloads. Delete and re-import from the latest JSON files. |
| kafkaConsume timeout | If using `startPosition: latest` and the topic is empty, switch to `earliest`. Or publish a message first with rpk. |
| Docker containers not healthy | Run `docker compose down && docker compose up -d` in the relevant directory. Wait 15 seconds for health checks. |
| Kafka Studio Consume shows 0 messages | Set **Start Position** to `Earliest` instead of `Latest`. If using a Key filter, verify the key matches exactly (case-sensitive). |
| Kafka Studio Publish "Send Once" disabled | The Topic field is empty. Enter a topic name to enable the button. |
| Kafka Studio Consume timeout | Increase **Timeout (ms)** to 15000 or higher. Default is 10000ms which may not be enough for large topics. |
| Headers not showing in Consume detail | Click on the message row to expand the detail panel. Headers appear in a table below the body JSON. |
| Produce headers show `{{kafka.trigger.header.X-...}}` literally | The kafkaTrigger node did not set the header variables. Verify the trigger's **Test Payload → Headers** field has valid JSON with the header names. |
| `X-Processed-By` missing in output | The kafkaProduce node must have a header row with `enabled: true` for `X-Processed-By`. Check the node config. |
| Published headers not appearing in Consume | Verify the correct topic is set in the Consume tab. Headers are stored per-message by Kafka, not per-topic. Use `rpk` to double-check. |
