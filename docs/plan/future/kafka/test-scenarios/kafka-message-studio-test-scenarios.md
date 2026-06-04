# Kafka Message Studio — Visual Test Scenarios

> **Covers:** Message Studio Phases 1–3 — Core Publish/Consume, Templates, and Streaming
> **Created:** 2026-06-04
> **Purpose:** Step-by-step manual guide for verifying the Kafka Message Studio page:
> Publish Studio (send messages), Consume Studio (fetch / stream messages), Templates (save/load/delete),
> Stream mode (live subscription), and Workflow integration (Use as Workflow Input / Map from Workflow).
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.
> Do **not** pre-check items — verify each one yourself first.

---

## Before You Start

### Navigation

| Destination | How to get there |
|---|---|
| **Kafka Settings** | Click ⚙️ **Settings** in the left activity bar → **Kafka** tab |
| **Kafka Message Studio** | Click **Protocols** (pulse icon ⏦) in the left activity bar → **Kafka** domain tab → internal **Publish** or **Consume** tab |

### Prerequisites: Configure and Connect a Cluster

These scenarios assume you already have a working Kafka cluster configured in Kafka Settings (see `kafka-settings-test-scenarios.md`, scenarios SC-01 through SC-08). If not, complete those first.

**Quick setup summary:**
1. Go to **Settings → Kafka** → **Create First Cluster**
2. Name: `Local Dev`, Broker: `127.0.0.1:19092`, Auth: No authentication, TLS: unchecked
3. Click **Save Cluster** → select it → click **Connect**
4. Verify the badge shows **Connected** (green)

### Docker: Start the Plaintext Broker

```bash
# From the repo root
cd docker/kafka/plaintext
docker compose up -d

# Wait for the broker to be healthy (~10 seconds)
docker compose ps      # Status should show "healthy" for redfireforge-redpanda
```

- **Kafka broker:** `localhost:19092`
- **Redpanda Console (optional UI):** http://localhost:18080

### Seed Test Topics

The broker comes with `redfireforge.results.summary` pre-created. For richer testing, create an additional topic:

```bash
docker compose -f docker/kafka/plaintext/docker-compose.yml exec redpanda \
  rpk topic create orders.events -p 3

# Seed 3 test messages with keys and headers
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.events --key customer-123 \
  -H "traceId:abc-001" -H "source:test-seed" \
  <<< '{"orderId":"ORD-001","customerId":"customer-123","status":"CREATED","amount":99.50}'

docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.events --key customer-456 \
  -H "traceId:abc-002" -H "source:test-seed" \
  <<< '{"orderId":"ORD-002","customerId":"customer-456","status":"CREATED","amount":150.00}'

docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.events --key customer-123 \
  -H "traceId:abc-003" -H "source:test-seed" \
  <<< '{"orderId":"ORD-003","customerId":"customer-123","status":"SHIPPED","amount":45.00}'
```

### Start the Streaming Producer (for MS-26 through MS-31)

In a separate terminal — only needed for streaming scenarios:

```bash
# From the repo root — produces a message every 2 seconds to redfireforge.debug.consume
./docker/kafka/topics/stream-producer.sh
```

### Start the Local Server

```bash
npm run server
```

- Server listens at `http://127.0.0.1:3001`

### Start the Web App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Scenario Summary

| # | Scenario | Docker | Server |
|---|---|---|---|
| MS-01 | Guard: No clusters → "No clusters configured" | No | No |
| MS-02 | Guard: Disconnected → "Cluster is not connected" | No | No |
| MS-03 | Guard: Connecting → spinner + "Connecting to cluster…" | ✅ Yes | ✅ Yes |
| MS-04 | Guard: Error → "Cluster connection error" with message | No | No |
| MS-05 | Connected → tab strip (Publish / Consume), default = Publish | ✅ Yes | ✅ Yes |
| MS-06 | Publish: all fields render correctly | ✅ Yes | ✅ Yes |
| MS-07 | Publish: topic validation hint | No | No |
| MS-08 | Publish: body validation hint | No | No |
| MS-09 | Publish: header CRUD (add, edit, enable/disable, reorder, remove) | No | No |
| MS-10 | Publish: Validate & Format JSON (valid + invalid) | No | No |
| MS-11 | Publish: Send Once → success result | ✅ Yes | ✅ Yes |
| MS-12 | Publish: Send Once → error result | ✅ Yes | ✅ Yes |
| MS-13 | Publish: Clear button clears result and error | ✅ Yes | ✅ Yes |
| MS-14 | Publish: Schema Registry toggle section | No | No |
| MS-15 | Consume: all fields render correctly | ✅ Yes | ✅ Yes |
| MS-16 | Consume: topic validation hint | No | No |
| MS-17 | Consume: Consume Once button disabled when topic empty | No | No |
| MS-18 | Consume: results table with messages | ✅ Yes | ✅ Yes |
| MS-19 | Consume: empty result ("No messages received") | ✅ Yes | ✅ Yes |
| MS-20 | Consume: "max reached" badge | ✅ Yes | ✅ Yes |
| MS-21 | Consume: "timed out" badge | ✅ Yes | ✅ Yes |
| MS-22 | Consume: click row → detail pane | ✅ Yes | ✅ Yes |
| MS-23 | Consume: Export Result Set + Clear | ✅ Yes | ✅ Yes |
| MS-24 | Consume: filters (Key Equals, Header Match, JSONPath) | ✅ Yes | ✅ Yes |
| MS-25 | Consume: Schema Registry toggle section | No | No |
| MS-26 | Templates: Save publish template | No | No |
| MS-27 | Templates: Load publish template from dropdown | No | No |
| MS-28 | Templates: Delete publish template | No | No |
| MS-29 | Templates: Save/Load/Delete consume template | No | No |
| MS-30 | Templates: Consume template strips groupId on load | No | No |
| MS-31 | Templates: persist across page reload | No | No |
| MS-32 | Stream: mode tabs render (Consume Once / Stream) | No | No |
| MS-33 | Stream: Start Stream → LIVE badge + messages | ✅ Yes | ✅ Yes |
| MS-34 | Stream: Stop Stream → badge disappears, messages preserved | ✅ Yes | ✅ Yes |
| MS-35 | Stream: Clear → messages reset to 0 | ✅ Yes | ✅ Yes |
| MS-36 | Stream: Export Stream → downloads JSON | ✅ Yes | ✅ Yes |
| MS-37 | Stream: click message row → detail pane | ✅ Yes | ✅ Yes |
| MS-38 | Workflow: "Use as Workflow Input" button in detail pane | ✅ Yes | ✅ Yes |
| MS-39 | Workflow: "Map from Workflow ▾" disabled / enabled | No | No |

---

## MS-01 — Guard: No Clusters Configured

**Prerequisites:** No Kafka clusters saved (fresh app or cleared localStorage)

To reset:
```js
// Browser DevTools → Console
localStorage.removeItem('perf-test-kafka-clusters-v1');
localStorage.removeItem('perf-test-kafka-selected-cluster-id');
location.reload();
```

**Steps:**
1. Click **Protocols** (pulse icon) in the left activity bar
2. The sub-nav shows a **Kafka** domain tab — click it. The page shows internal tabs: **Publish**, **Consume**, **Topics**, **Schema Registry**

**Expected:**
- ☐ The page shows a centered guard panel with the title: **"No clusters configured"**
- ☐ Below the title: *"Add a Kafka cluster in settings to get started."*
- ☐ A button labeled **"→ Add a cluster"** is visible
- ☐ Clicking the button navigates to **Settings → Kafka**
- ☐ No tab strip (Publish Studio / Consume Studio) is visible — the guard replaces the entire page

---

## MS-02 — Guard: Cluster Disconnected

**Prerequisites:** At least one cluster configured but NOT connected (Idle/Disconnected state)

**Steps:**
1. Go to **Settings → Kafka** → ensure a cluster exists but is **disconnected** (click Disconnect if needed)
2. Navigate to **Protocols → Kafka**

**Expected:**
- ☐ Guard panel shows: **"Cluster is not connected"**
- ☐ Subtitle: *"Connect to a Kafka cluster to use the studio."*
- ☐ Button: **"→ Open Kafka Settings"**
- ☐ Clicking the button navigates back to **Settings → Kafka**

---

## MS-03 — Guard: Connecting State (Spinner)

**Prerequisites:** Docker broker running, server running

**Steps:**
1. Go to **Settings → Kafka** → select a cluster → click **Connect**
2. **Immediately** switch to **Protocols → Kafka** (within 1–2 seconds, before connection completes)

**Expected:**
- ☐ Guard panel briefly shows: **"Connecting to cluster…"**
- ☐ A **spinner** (animated circle) is visible above the text
- ☐ **No button** is shown during the connecting state (no "Open Kafka Settings" link)
- ☐ Once connection succeeds, the guard disappears and the tab strip (Publish Studio / Consume Studio) appears

---

## MS-04 — Guard: Connection Error State

**Prerequisites:** A cluster exists that points to an unreachable broker (e.g., `bad-host:9999`)

**Steps:**
1. In **Settings → Kafka**, edit a cluster and change broker to `bad-host:9999` → Save → click Connect
2. Wait for the connection to fail (status changes to Error)
3. Navigate to **Protocols → Kafka**

**Expected:**
- ☐ Guard panel shows: **"Cluster connection error"**
- ☐ Subtitle shows the actual error message (e.g., *"Failed to fetch"* or *"Connection check failed"*)
- ☐ The subtitle text has `data-testid="guard-subtitle"`
- ☐ Button: **"→ Open Kafka Settings"** with `data-testid="guard-action-btn"`
- ☐ Clicking the button navigates to Settings → Kafka

**Clean up:** Edit the cluster back to `127.0.0.1:19092`, save, and reconnect.

---

## MS-05 — Connected: Tab Strip Renders

**Prerequisites:** Connected to the plaintext broker

**Steps:**
1. Navigate to **Protocols → Kafka**

**Expected:**
- ☐ Four internal tabs appear at the top of the page: **"Publish"** (default active), **"Consume"**, **"Topics"**, **"Schema Registry"**
- ☐ Below the tabs, the **Publish Studio** panel renders (title: "Publish", subtitle: "Send a message to a topic")
- ☐ Clicking **Consume** switches to the Consume panel
- ☐ Clicking **Publish** switches back
- ☐ The active tab has the CSS class `active` (visually highlighted)
- ☐ If a template error exists, a red banner appears below the tabs with `data-testid="template-error"` showing the error text

---

## MS-06 — Publish Studio: All Fields Render

**Prerequisites:** Connected, Publish Studio tab active

**Steps:**
1. Observe the Publish Studio panel

**Expected:**
- ☐ Card header shows title **"Publish"** and subtitle *"Send a message to a topic"*
- ☐ Template controls visible in the header: **"Load ▾"** button and **"Save"** button
- ☐ Fields visible (top to bottom):
  - **Topic** — text input, placeholder *"e.g. orders.events"*, `id="kms-pub-topic"`
  - **Acks** — dropdown with 3 options: *"all (–1)"* (default), *"leader (1)"*, *"none (0)"*, `id="kms-pub-acks"`
  - **Key** — text input, placeholder *"(optional)"*, `id="kms-pub-key"`
  - **Partition** — text input, placeholder *"auto"*, `id="kms-pub-partition"`
  - **Timeout (ms)** — text input, placeholder *"default"*, `id="kms-pub-timeout"`
- ☐ **Headers** section with title "Headers" and **"+ Add"** button
  - Initially shows: *"No headers"*
- ☐ **Message Body (JSON)** — textarea, placeholder `{"key": "value"}`, `id="kms-pub-body"`
- ☐ **Enable Schema Registry** — unchecked checkbox at the bottom
- ☐ Action row: **"Send Once"** button (primary, blue), **"Validate & Format JSON"** button (secondary), **"Map from Workflow ▾"** button (secondary, disabled with tooltip *"Run a workflow first"*)

---

## MS-07 — Publish: Topic Validation Hint

**Steps:**
1. Click into the **Topic** field, then click out (blur) without typing anything

**Expected:**
- ☐ A red hint text appears below the Topic field: **"Topic is required"**
- ☐ The hint has `data-testid="pub-topic-hint"`
- ☐ Typing any text into the Topic field and blurring again — the hint disappears
- ☐ The **Send Once** button is **disabled** while the topic is empty

---

## MS-08 — Publish: Body Validation Hint

**Steps:**
1. Click into the **Message Body (JSON)** textarea, then click out (blur) without typing anything

**Expected:**
- ☐ A red hint text appears below the body textarea: **"Message body is required"**
- ☐ The hint has `data-testid="pub-body-hint"`
- ☐ Typing any text into the body and blurring again — the hint disappears
- ☐ Note: the body hint is cosmetic — **Send Once** is NOT blocked by an empty body (only topic blocks it)

---

## MS-09 — Publish: Header CRUD

**Steps:**
1. In the Headers section, click **"+ Add"**
2. A new header row appears with: ☑ checkbox (enabled), key input (placeholder "key"), value input (placeholder "value"), **×** remove button
3. Type `traceId` in the key field, `test-trace-001` in the value field
4. Click **"+ Add"** again to add a second header row
5. Type `source` in the key, `manual-test` in the value
6. Click the **↑** (Move up) button on the second row
7. Uncheck the checkbox on one of the rows
8. Click **×** on the unchecked row

**Expected:**
- ☐ Clicking "+ Add" adds a new row with an enabled checkbox, two empty text inputs, and a × button
- ☐ The **first** row does NOT have a ↑ (Move up) button — only rows at index > 0 have one
- ☐ Clicking ↑ on the second row moves it above the first row (order swaps)
- ☐ Unchecking a row's checkbox visually dims it (the `enabled` flag controls whether the header is sent)
- ☐ Clicking × removes the row entirely
- ☐ After removing all rows, the empty state *"No headers"* returns

---

## MS-10 — Publish: Validate & Format JSON

### Part A — Valid JSON

**Steps:**
1. In the body textarea, type: `{"orderId":"ORD-TEST","amount":42}`
2. Click **"Validate & Format JSON"**

**Expected:**
- ☐ The body textarea content is replaced with pretty-printed JSON:
  ```json
  {
    "orderId": "ORD-TEST",
    "amount": 42
  }
  ```
- ☐ No error message appears
- ☐ If a previous `INVALID_JSON` error was showing, it is cleared

### Part B — Invalid JSON

**Steps:**
1. Clear the body textarea and type: `{broken json`
2. Click **"Validate & Format JSON"**

**Expected:**
- ☐ An inline error appears below the action row with `data-testid="pub-error"`
- ☐ Error message contains the JSON parse error (e.g., *"Unexpected token b in JSON at position 1"* or similar)
- ☐ The error has a **(non-retryable)** tag
- ☐ The body textarea content is NOT modified (the broken text remains)

### Part C — Empty Body

**Steps:**
1. Clear the body textarea completely (empty)
2. Click **"Validate & Format JSON"**

**Expected:**
- ☐ No error appears — empty body is treated as valid (returns empty string)
- ☐ The textarea remains empty

---

## MS-11 — Publish: Send Once → Success

**Prerequisites:** Connected to broker, topic `orders.events` exists

**Steps:**
1. Set **Topic** to `orders.events`
2. Set **Key** to `test-key-001`
3. Leave Partition as empty (auto)
4. Leave Acks as `all (–1)`
5. Add a header: key = `traceId`, value = `test-trace-send`
6. Set body to: `{"test": true, "from": "manual-test"}`
7. Click **"Send Once"**

**Expected:**
- ☐ Button text changes to **"Sending…"** while the request is in progress
- ☐ After success, a green result block appears with `data-testid="pub-result"`:
  - **"✓ Sent 1 message to orders.events"** (bold topic name)
  - Below: **"partition X, offset Y"** (X is 0–2 for a 3-partition topic; Y is an incrementing integer)
  - Optionally: timestamp if the broker returns one
- ☐ If schema encoding was used, an **"Encoding: plain"** line appears (or `base64-avro` for Avro)
- ☐ The **"Clear"** button appears in the action row
- ☐ The previous result is **replaced** on re-send (never appended)

---

## MS-12 — Publish: Send Once → Error

**Prerequisites:** Connected to broker

**Steps:**
1. Set **Topic** to a non-existent topic that the broker won't auto-create (e.g., `nonexistent.topic.12345`)
2. Set body to `{"test": true}`
3. Click **"Send Once"**

> **Note:** Redpanda auto-creates topics by default. If this doesn't produce an error, try disconnecting the server (`Ctrl+C` on `npm run server`) and then clicking Send Once — this will produce a network error.

**Expected:**
- ☐ An inline error block appears with `data-testid="pub-error"`
- ☐ The error message describes the failure (e.g., *"Failed to fetch"* or *"Produce failed"*)
- ☐ If the error is non-retryable, a **(non-retryable)** tag is shown
- ☐ The **"Clear"** button appears in the action row
- ☐ No success result is shown when an error is present

---

## MS-13 — Publish: Clear Button

**Prerequisites:** A publish result or error is currently displayed (from MS-11 or MS-12)

**Steps:**
1. Click **"Clear"** in the Publish action row

**Expected:**
- ☐ The success result block (`data-testid="pub-result"`) disappears
- ☐ OR the error block (`data-testid="pub-error"`) disappears
- ☐ The "Clear" button itself disappears (only visible when a result or error exists)
- ☐ The publish form fields (topic, key, body, etc.) are **unchanged** — Clear only affects the result/error display

---

## MS-14 — Publish: Schema Registry Toggle

**Steps:**
1. Find the **"Enable Schema Registry"** checkbox at the bottom of the Publish panel
2. Check it

**Expected:**
- ☐ When unchecked: only the checkbox label "Enable Schema Registry" is visible — no fields below
- ☐ When checked, the following fields appear:
  - **Registry URL** — text input, placeholder *"http://schema-registry:8081"*
  - **Format** — dropdown with options: *"Avro"* (default), *"Protobuf"*, *"JSON Schema"*
  - **Username (optional)** — text input, placeholder *"schema-user"*
  - **Password (optional)** — password input, placeholder *"••••••"*
  - **Subject** — text input with placeholder derived from the topic (e.g., *"orders.events-value (default)"*), plus a **↓** button to load subjects from registry
  - **Version** — number input, placeholder *"latest (default)"*, plus a **↓** button to load versions from registry
- ☐ Unchecking the checkbox hides all schema fields and clears the schema config (`schemaConfig` becomes `undefined`)
- ☐ The ↓ buttons are disabled until a Registry URL is entered

---

## MS-15 — Consume Studio: All Fields Render

**Prerequisites:** Connected, switch to **Consume Studio** tab

**Steps:**
1. Click the **Consume Studio** tab
2. Observe the panel layout

**Expected:**
- ☐ Card header shows title **"Consume"** and subtitle *"Fetch messages from a topic"*
- ☐ Template controls in the header: **"Load ▾"** button and **"Save"** button
- ☐ Fields visible (top to bottom):
  - **Topic** — text input, placeholder *"e.g. orders.events"*, `id="kms-con-topic"`
  - **Consumer Group** — text input, auto-generated value like `redfireforge-debug-xxxxxxxx` (8-char UUID prefix), `id="kms-con-group"`
  - **Start Position** — dropdown: *"Latest"* (default), *"Earliest"*, `id="kms-con-pos"`
  - **Timeout (ms)** — text input, pre-filled `10000`, `id="kms-con-timeout"`
  - **Max Messages** — text input, pre-filled `50`, `id="kms-con-max"`
- ☐ **Filters** section:
  - **Key Equals** — text input, placeholder *"exact key match"*, `id="kms-con-key"`
  - **Header Match** — text input, placeholder *"key=value"*, `id="kms-con-header"`
  - **JSONPath** — text input, placeholder *"$.status"*, `id="kms-con-jsonpath"`
  - **JSONPath Equals** — text input, placeholder *"CREATED"*, `id="kms-con-jsonval"`
- ☐ **Enable Schema Registry** — unchecked checkbox
- ☐ **Mode tabs** below the schema section: **"Consume Once"** (default active) and **"Stream"** (`data-testid="con-mode-tabs"`)
- ☐ Action row: **"Consume Once"** button (primary)

---

## MS-16 — Consume: Topic Validation Hint

**Steps:**
1. Click into the **Topic** field in the Consume panel, then click out (blur) without typing

**Expected:**
- ☐ A red hint text appears: **"Topic is required"** with `data-testid="con-topic-hint"`
- ☐ Typing any text and blurring again clears the hint

---

## MS-17 — Consume: Button Disabled When Topic Empty

**Steps:**
1. Ensure the Topic field is empty in the Consume panel

**Expected:**
- ☐ The **"Consume Once"** button (`data-testid="con-consume-btn"`) is **disabled** (greyed out)
- ☐ Typing a topic name enables the button
- ☐ While consuming, the button text changes to **"Consuming…"** and is disabled

---

## MS-18 — Consume: Results Table with Messages

**Prerequisites:** Topic `orders.events` has messages (seeded in "Before You Start")

**Steps:**
1. Set **Topic** to `orders.events`
2. Set **Start Position** to **"Earliest"**
3. Set **Max Messages** to `10`
4. Leave all filters empty
5. Click **"Consume Once"**

**Expected:**
- ☐ Button shows **"Consuming…"** briefly while fetching
- ☐ A results zone appears with `data-testid="con-results-zone"`
- ☐ Results header shows message count: **"3 messages"** (or however many are in the topic)
- ☐ A results table appears with columns: **#** | **Offset** | **Partition** | **Key** | **Value**
- ☐ Each row shows:
  - `#` column: sequential number starting from 1
  - `Offset` column: the Kafka offset (integer)
  - `Partition` column: the partition number (0, 1, or 2 for a 3-partition topic)
  - `Key` column: the message key (e.g., `customer-123`) or `—` if no key
  - `Value` column: truncated preview of the message value (max 60 chars, whitespace collapsed)
- ☐ Rows are clickable (cursor: pointer)
- ☐ A **"timed out"** amber badge may appear if the consumer waited the full timeout (this is normal — see MS-21)
- ☐ **"Export Result Set"** and **"Clear"** buttons appear in the action row

---

## MS-19 — Consume: Empty Result

**Prerequisites:** A topic with no messages, or a filter that matches nothing

**Steps:**
1. Set **Topic** to `orders.events`
2. Set **Start Position** to **"Latest"** (no new messages expected)
3. Set **Timeout (ms)** to `3000` (short timeout)
4. Click **"Consume Once"**

**Expected:**
- ☐ Results header shows **"0 messages"**
- ☐ Below the header: **"No messages received"** (empty state text)
- ☐ The **"timed out"** badge may also appear (amber) if the timeout was reached
- ☐ **"Export Result Set"** button is **disabled** (0 messages to export)
- ☐ **"Clear"** button is enabled

---

## MS-20 — Consume: "Max Reached" Badge

**Prerequisites:** Topic `orders.events` has at least 3 messages

**Steps:**
1. Set **Topic** to `orders.events`
2. Set **Start Position** to **"Earliest"**
3. Set **Max Messages** to `3`
4. Click **"Consume Once"**

**Expected:**
- ☐ Results header shows **"3 messages"** followed by **(max reached)** badge
- ☐ The badge has `data-testid="con-max-reached"`
- ☐ The badge confirms that the consumer stopped because it hit the configured max

---

## MS-21 — Consume: "Timed Out" Badge

**Prerequisites:** A topic with no new messages arriving

**Steps:**
1. Set **Topic** to `orders.events`
2. Set **Start Position** to **"Latest"**
3. Set **Timeout (ms)** to `2000`
4. Set **Max Messages** to `50`
5. Click **"Consume Once"** — do NOT publish any new messages during this time

**Expected:**
- ☐ After ~2 seconds, results appear
- ☐ An amber **"timed out"** badge appears in the results header
- ☐ The badge has `data-testid="con-timed-out"`
- ☐ If some messages were found before timeout, they still appear in the table alongside the badge
- ☐ If no messages were found, the empty state "No messages received" appears WITH the timed out badge

---

## MS-22 — Consume: Click Row → Detail Pane

**Prerequisites:** MS-18 completed (results table visible with messages)

**Steps:**
1. Click the **first row** in the results table

**Expected:**
- ☐ The clicked row gets a **selected** highlight (CSS class `selected`)
- ☐ A **detail pane** appears below the table with `data-testid="con-detail-pane"`
- ☐ Detail pane contains:
  - **Action buttons** row:
    - **"Copy Key"** (`data-testid="con-copy-key-btn"`) — disabled if the message has no key
    - **"Copy Payload"** (`data-testid="con-copy-payload-btn"`)
    - **"Use as Workflow Input"** (`data-testid="con-workflow-input-btn"`) — only visible when the workflow integration prop is provided
    - **"✕"** close button (aria-label "Close detail")
  - **Pretty-printed JSON body** in a `<pre>` block (`data-testid="con-detail-body"`):
    ```json
    {
      "orderId": "ORD-001",
      "customerId": "customer-123",
      "status": "CREATED",
      "amount": 99.5
    }
    ```
  - **Headers table** (if the message has headers):
    - Columns: **Header Key** | **Header Value**
    - Rows: `traceId` → `abc-001`, `source` → `test-seed`
- ☐ Clicking the same row again **deselects** it (detail pane closes)
- ☐ Clicking a different row switches the detail pane to that row's content
- ☐ Clicking **✕** closes the detail pane

### Copy verification:
- ☐ Click **"Copy Key"** → paste in a text editor → should show the message key (e.g., `customer-123`)
- ☐ Click **"Copy Payload"** → paste → should show the raw message value (JSON string)

---

## MS-23 — Consume: Export Result Set + Clear

**Prerequisites:** MS-18 completed (results visible)

### Part A — Export

**Steps:**
1. Click **"Export Result Set"** (`data-testid="con-export-btn"`)

**Expected:**
- ☐ A file downloads with filename pattern: `kafka-consume-orders.events-<timestamp>.json`
  - Timestamp format: `YYYY-MM-DDTHH-MM-SS`
- ☐ File contents: a JSON array of message objects, each containing `topic`, `partition`, `offset`, `key`, `value`, `headers`, `timestamp`
- ☐ Open the file — it should be valid, parseable JSON

### Part B — Clear

**Steps:**
1. Click **"Clear"** (`data-testid="con-clear-btn"`)

**Expected:**
- ☐ The results table disappears
- ☐ The "Export Result Set" and "Clear" buttons disappear
- ☐ The detail pane (if open) closes
- ☐ The consume form fields (topic, group, filters, etc.) are **unchanged**

---

## MS-24 — Consume: Filters

**Prerequisites:** `orders.events` topic has seeded messages with keys `customer-123` and `customer-456`

> **Important — Fresh Consumer Group:** If you already ran a Consume Once earlier in this session (e.g., MS-18), the auto-generated consumer group has committed offsets past all existing messages. Even with "Earliest" selected, Kafka honors committed offsets for the same group. To get a fresh start, either:
> - **Reload the page** (`Cmd+R`) — this generates a new consumer group ID, OR
> - Manually clear the **Consumer Group** field and type a new unique name (e.g., `filter-test-001`)

### Part A — Key Equals filter

**Steps:**
1. Set Topic to `orders.events`, Start Position to "Earliest", Max Messages to `50`
2. Set **Key Equals** to `customer-123`
3. Leave other filters empty
4. Click **"Consume Once"**

**Expected:**
- ☐ Only messages with key `customer-123` appear in the results (2 messages: ORD-001 and ORD-003)
- ☐ Messages with key `customer-456` are NOT in the results

### Part B — Header Match filter

**Steps:**
1. Clear Key Equals
2. Set **Header Match** to `traceId=abc-002`
3. Click **"Consume Once"**

**Expected:**
- ☐ Only the message with header `traceId: abc-002` appears (1 message: ORD-002)

### Part C — JSONPath filter

**Steps:**
1. Clear Header Match
2. Set **JSONPath** to `$.status`
3. Set **JSONPath Equals** to `SHIPPED`
4. Click **"Consume Once"**

**Expected:**
- ☐ Only the message where `$.status` equals `"SHIPPED"` appears (1 message: ORD-003)

### Part D — Combined filters

**Steps:**
1. Set **Key Equals** to `customer-123`
2. Set **JSONPath** to `$.status`, **JSONPath Equals** to `CREATED`
3. Click **"Consume Once"**

**Expected:**
- ☐ Only the message matching BOTH key=customer-123 AND status=CREATED appears (1 message: ORD-001)

**Clean up:** Clear all filter fields after testing.

---

## MS-25 — Consume: Schema Registry Toggle

**Steps:**
1. In the Consume panel, find the **"Enable Schema Registry"** checkbox
2. Check it

**Expected:**
- ☐ Same fields appear as in the Publish panel (MS-14):
  Registry URL, Format, Username, Password, Subject, Version
- ☐ Subject placeholder uses the consume topic (e.g., *"orders.events-value (default)"*)
- ☐ Unchecking hides all fields and clears the schema config

---

## MS-26 — Templates: Save Publish Template

**Steps:**
1. In the Publish panel, set Topic to `orders.events`, Key to `template-key`, Body to `{"from":"template"}`
2. Click the **"Save"** button in the header
3. An inline input row appears with a text input (placeholder "Template name"), a **✓** button, and a **✕** cancel button
4. Type `My Publish Template` and click **✓** (or press Enter)

**Expected:**
- ☐ Clicking "Save" shows the inline save input row (replaces the Save button temporarily)
- ☐ The ✓ button is **disabled** until you type a name
- ☐ After saving: the input row disappears and the "Save" button returns
- ☐ No error banner appears below the tabs

---

## MS-27 — Templates: Load Publish Template

**Steps:**
1. Clear the Topic, Key, and Body fields (type different values or clear them)
2. Click **"Load ▾"** in the Publish header
3. A dropdown appears listing the saved template: **"My Publish Template"**
4. Click the template name

**Expected:**
- ☐ Clicking "Load ▾" opens a dropdown with one entry: "My Publish Template"
- ☐ Each entry shows the template name and a **×** delete button
- ☐ Clicking the template name loads the saved values into the form:
  - Topic: `orders.events`
  - Key: `template-key`
  - Body: `{"from":"template"}`
- ☐ The dropdown closes after selection
- ☐ If no templates are saved, the dropdown shows: **"No saved templates"**

---

## MS-28 — Templates: Delete Publish Template

**Steps:**
1. Click **"Load ▾"** to open the dropdown
2. Click the **×** button next to "My Publish Template"

**Expected:**
- ☐ The template is removed from the dropdown list
- ☐ If it was the only template, the dropdown shows **"No saved templates"**
- ☐ Clicking × does NOT close the dropdown (it stays open)
- ☐ The form fields are NOT cleared — deletion only affects the template storage

---

## MS-29 — Templates: Save/Load/Delete Consume Template

**Steps:**
1. Switch to **Consume Studio** tab
2. Set Topic to `orders.events`, Timeout to `5000`, Key Equals to `customer-123`
3. Click **"Save"** → type `My Consume Template` → click ✓
4. Clear the Topic and Key Equals fields
5. Click **"Load ▾"** → click **"My Consume Template"**
6. Verify the form is restored
7. Click **"Load ▾"** → click **×** next to the template
8. Verify the template is deleted

**Expected:**
- ☐ Save, Load, and Delete work identically to the Publish template flow (MS-26, MS-27, MS-28)
- ☐ Consume templates are stored separately from Publish templates (different localStorage key)

---

## MS-30 — Templates: Consume Template Strips groupId

**Steps:**
1. Save a consume template (as in MS-29)
2. Note the current **Consumer Group** value (e.g., `redfireforge-debug-abc12345`)
3. Reload the page (`Cmd+R` / `Ctrl+R`) — the Consumer Group field now has a **new** auto-generated value
4. Click **"Load ▾"** → load the saved template

**Expected:**
- ☐ After loading, the **Consumer Group** field keeps the **current session's** auto-generated value — it does NOT revert to the saved template's groupId
- ☐ All other fields (Topic, Timeout, Key Equals, etc.) are restored from the template
- ☐ This prevents reusing committed offsets from a previous session

---

## MS-31 — Templates: Persist Across Page Reload

**Steps:**
1. Save a Publish template named "Persist Test Pub" and a Consume template named "Persist Test Con"
2. Reload the page
3. Navigate back to Protocols → Kafka → Publish tab → click "Load ▾"
4. Switch to Consume tab → click "Load ▾"

**Expected:**
- ☐ "Persist Test Pub" appears in the Publish dropdown
- ☐ "Persist Test Con" appears in the Consume dropdown
- ☐ Templates survive full page reload (persisted in localStorage)

**Clean up:** Delete the test templates using the × buttons in each dropdown.

---

## MS-32 — Stream: Mode Tabs Render

**Steps:**
1. In the Consume panel, observe the mode tab strip below the Schema section

**Expected:**
- ☐ Two mode tabs are visible: **"Consume Once"** and **"Stream"**
- ☐ The tab strip has `data-testid="con-mode-tabs"`
- ☐ **"Consume Once"** is the default active tab (`data-testid="con-mode-once"`)
- ☐ Clicking **"Stream"** (`data-testid="con-mode-stream"`) switches to stream mode
- ☐ Clicking **"Consume Once"** switches back

---

## MS-33 — Stream: Start Stream → LIVE Badge + Messages

**Prerequisites:** Stream producer running (`./docker/kafka/topics/stream-producer.sh`), connected to broker

**Steps:**
1. Switch to the **Stream** mode tab
2. Set **Topic** to `redfireforge.debug.consume`
3. Click **"Start Stream"** (`data-testid="stream-start-btn"`)
4. Wait 5–10 seconds for messages to arrive

**Expected:**
- ☐ The **"Start Stream"** button is replaced by a red **"Stop Stream"** button (`data-testid="stream-stop-btn"`)
- ☐ A **"LIVE"** badge appears in the results header (`data-testid="stream-live-badge"`, red/pulsing)
- ☐ The message count increments in real-time: **"1 message"** → **"2 messages"** → **"3 messages"** etc. (`data-testid="stream-count"`)
- ☐ A results table appears with the same columns as Consume Once: **#** | **Offset** | **Partition** | **Key** | **Value**
- ☐ New rows appear at the bottom of the table every ~2 seconds (matching the stream producer interval)
- ☐ The table auto-scrolls to show the newest message
- ☐ If you manually scroll up, auto-scroll pauses; scrolling back to the bottom re-enables it
- ☐ When no messages have arrived yet: **"Waiting for messages…"** is shown as the empty state

---

## MS-34 — Stream: Stop Stream

**Prerequisites:** MS-33 in progress (streaming active with some messages)

**Steps:**
1. Click **"Stop Stream"** (`data-testid="stream-stop-btn"`)

**Expected:**
- ☐ The red "Stop Stream" button is replaced by the green **"Start Stream"** button
- ☐ The **"LIVE"** badge disappears
- ☐ All previously received messages **remain** in the table (not cleared)
- ☐ The message count stays at its final value (e.g., "5 messages")
- ☐ **"Export Stream"** and **"Clear"** buttons remain visible (if messages exist)

---

## MS-35 — Stream: Clear

**Prerequisites:** Stream mode with some messages (stopped or active)

**Steps:**
1. Click **"Clear"** (`data-testid="stream-clear-btn"`)

**Expected:**
- ☐ All messages are removed from the table
- ☐ Message count resets to **"0 messages"**
- ☐ If streaming was active, it continues (LIVE badge stays) — only the accumulated messages are cleared
- ☐ If a cursor gap badge was showing (`data-testid="stream-cursor-gap"`), it is also cleared
- ☐ The "Export Stream" and "Clear" buttons disappear (0 messages)
- ☐ Empty state shows: **"No stream messages"** (if stopped) or **"Waiting for messages…"** (if streaming)

---

## MS-36 — Stream: Export Stream

**Prerequisites:** Stream mode with messages (from MS-33)

**Steps:**
1. Ensure at least 3 stream messages are visible
2. Click **"Export Stream"** (`data-testid="stream-export-btn"`)

**Expected:**
- ☐ A file downloads with filename pattern: `kafka-consume-redfireforge.debug.consume-<timestamp>.json`
- ☐ File contents: JSON array of all streamed message objects (same shape as consume-once export)
- ☐ Each message has: `topic`, `partition`, `offset`, `key`, `value`, `headers`
- ☐ The stream producer's messages have headers: `traceId: stream-N`, `source: stream-producer`

---

## MS-37 — Stream: Click Message Row → Detail Pane

**Prerequisites:** Stream mode with messages

**Steps:**
1. Click any row in the stream results table

**Expected:**
- ☐ The row gets a **selected** highlight (CSS class `selected kafka-ms-stream-row`)
- ☐ A detail pane appears below with `data-testid="con-detail-pane"` — same layout as Consume Once detail:
  - **Copy Key**, **Copy Payload**, **Use as Workflow Input** (if available), **✕** close
  - Pretty-printed JSON body
  - Headers table: `traceId → stream-N`, `source → stream-producer`
- ☐ Clicking the same row deselects it
- ☐ Clicking **✕** closes the detail pane

---

## MS-38 — Workflow: "Use as Workflow Input" Button

**Prerequisites:** Connected, Consume Studio, a message selected in the detail pane (either Consume Once or Stream mode)

**Steps:**
1. Consume or stream messages from `orders.events`
2. Click a row to open the detail pane
3. Observe the **"Use as Workflow Input"** button (`data-testid="con-workflow-input-btn"`)

**Expected:**
- ☐ The button is visible in the detail pane action row (between "Copy Payload" and "✕")
- ☐ The button has CSS classes `kafka-ms-secondary-btn kafka-ms-workflow-btn`
- ☐ Clicking it invokes the `onUseAsWorkflowInput` callback with:
  - `payload`: the message's `value` string
  - `meta`: `{ topic, partition, offset }` from the selected message
- ☐ In the full app context: clicking navigates to the Workflow Runner with pre-seeded Kafka variables

> **Note:** Full workflow navigation behavior depends on App.tsx wiring. If `onUseAsWorkflowInput` is not wired in your build, the button may not appear — this is expected in isolated testing.

---

## MS-39 — Workflow: "Map from Workflow ▾" Button

**Steps:**
1. Switch to **Publish Studio** tab
2. Observe the **"Map from Workflow ▾"** button (`data-testid="pub-map-workflow-btn"`)

### Part A — No workflow output available

**Expected:**
- ☐ The button is **disabled**
- ☐ Hover tooltip: **"Run a workflow first"**

### Part B — After workflow output is available

> This requires the app to have `lastWorkflowOutput` populated, which happens after running a workflow
> that produces output variables. If you cannot trigger this state, skip to the verification below.

**Expected (when output is available):**
- ☐ The button is **enabled**
- ☐ Hover tooltip: *"Map a workflow output variable into the message body"*
- ☐ Clicking opens a dropdown (`data-testid="pub-wf-dropdown"`) with:
  - A search input (`data-testid="pub-wf-search"`, placeholder "Search variables…")
  - A list of workflow output variables (key name + preview of value, truncated at 60 chars)
- ☐ Clicking a variable: its value is pretty-printed (if valid JSON) and placed into the **Body** textarea
- ☐ The dropdown closes after selection
- ☐ Searching filters the variable list; **"No matching variables"** shown when nothing matches

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Guard shows "No clusters configured" | Complete SC-01 through SC-08 from `kafka-settings-test-scenarios.md` first |
| Guard shows "Cluster is not connected" | Go to Settings → Kafka → select cluster → click Connect |
| Send Once hangs forever | Confirm Docker broker is running: `docker compose ps` |
| Consume returns 0 messages | Check Start Position (use "Earliest" to read existing messages); confirm messages were seeded |
| Stream produces no messages | Confirm `stream-producer.sh` is running in a separate terminal |
| Export downloads empty file | Ensure results table has messages before clicking Export |
| Template dropdown shows "No saved templates" | Templates may have been cleared; save a new one |
| "Map from Workflow ▾" always disabled | This requires running a workflow first — expected behavior in standalone testing |
| Copy buttons don't work | Browser may block clipboard API on localhost; try HTTPS or check browser permissions |

---

## Reset / Clean Up

To completely reset the Kafka Message Studio state for a fresh re-test:

```js
// Browser DevTools → Console
localStorage.removeItem('perf-test-kafka-publish-templates-v1');
localStorage.removeItem('perf-test-kafka-consume-templates-v1');
location.reload();
```

To stop Docker services:

```bash
# Stop stream producer: Ctrl+C in its terminal

# Stop broker
cd docker/kafka/plaintext && docker compose down

# Stop server: Ctrl+C on npm run server
```
