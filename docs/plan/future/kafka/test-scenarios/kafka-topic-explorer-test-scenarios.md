# Kafka Topic Explorer — Visual Test Scenarios

> **Covers:** Message Studio Phase 4 — Topic Explorer standalone page
> **Created:** 2026-06-04
> **Purpose:** Step-by-step manual guide for verifying the Topic Explorer page:
> topic list with filters, topic detail panel (Messages, Partitions, Consumer Groups, Config tabs),
> message browsing within a topic, and guard states.
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.
> Do **not** pre-check items — verify each one yourself first.

---

## Before You Start

### Navigation

| Destination | How to get there |
|---|---|
| **Kafka Settings** | Click ⚙️ **Settings** in the left activity bar → **Kafka** tab |
| **Topic Explorer** | Click **Protocols** (pulse icon ⏦) in the left activity bar → **Kafka** domain tab → internal **Topics** tab |

### Prerequisites: Configure and Connect a Cluster

These scenarios assume you already have a connected Kafka cluster (see `kafka-settings-test-scenarios.md`, scenarios SC-01 through SC-08).

**Quick setup summary:**
1. Go to **Settings → Kafka** → create a cluster: Name `Local Dev`, Broker `127.0.0.1:19092`
2. Click **Connect** → verify **Connected** badge (green)

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

### Seed Multiple Topics for Rich Filtering

**Recommended (automated):** Run the UI test seed script to create all 16 topics and 20+ messages in one command:

```bash
# From the repo root
docker/kafka/e2e/ui-test-seed.sh
```

This covers all topics and messages needed for every scenario below. Skip the manual commands if using this script.

**Alternative (manual):** The plaintext broker comes with `redfireforge.results.summary`. For richer testing, create additional topics with varying partition counts and seed some messages:

```bash
# Create topics with different partition counts and prefixes
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create orders.created -p 3
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create orders.updated -p 3
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create orders.failed -p 1
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create inventory.adjusted -p 6
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create notifications.email -p 2
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic create redfireforge.debug.consume -p 3

# Seed messages into orders.created (for Messages tab testing)
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.created --key order-001 \
  -H "traceId:trace-001" -H "source:test-seed" \
  <<< '{"orderId":"ORD-001","status":"CREATED","amount":99.50}'

docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.created --key order-002 \
  -H "traceId:trace-002" -H "source:test-seed" \
  <<< '{"orderId":"ORD-002","status":"CREATED","amount":150.00}'

docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
  rpk topic produce orders.created --key order-003 \
  -H "traceId:trace-003" -H "source:checkout" \
  <<< '{"orderId":"ORD-003","status":"CREATED","amount":45.75}'
```

> **Note:** If topics already exist from prior testing, the `rpk topic create` commands will return "TOPIC_ALREADY_EXISTS" — this is fine. The seed messages will still be produced.

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

| # | Scenario | Docker | Server |
|---|---|---|---|
| TE-01 | Guard: Not connected → guard with "Open Kafka Settings" link | No | No |
| TE-02 | Guard: No clusters → "No clusters configured" | No | No |
| TE-03 | Loading state shows "Loading Kafka settings…" | No | No |
| TE-04 | Connected → two-column layout: topic list + empty detail placeholder | ✅ Yes | ✅ Yes |
| TE-05 | Topics load with columns: Topic, Parts, Repl, Traffic, CGs, Health | ✅ Yes | ✅ Yes |
| TE-06 | Search by topic name filters list in real time | ✅ Yes | ✅ Yes |
| TE-07 | Internal topics toggle: checking adds `__consumer_offsets` | ✅ Yes | ✅ Yes |
| TE-08 | Domain chips: "All" (default), dynamic chips by topic prefix | ✅ Yes | ✅ Yes |
| TE-09 | "Recently Active" and "Lagging Consumers" chips (disabled until detail loaded) | ✅ Yes | ✅ Yes |
| TE-10 | Health filter dropdown: All / Healthy / Warning / Unknown | ✅ Yes | ✅ Yes |
| TE-11 | Partition filter dropdown: Any / 1–4 / 5–12 / 12+ | ✅ Yes | ✅ Yes |
| TE-12 | Retention filter dropdown: Any / < 1 day / 1–7 days / > 7 days | ✅ Yes | ✅ Yes |
| TE-13 | Empty state: "No topics match the current filters" | ✅ Yes | ✅ Yes |
| TE-14 | Click topic row → detail panel appears, row highlighted | ✅ Yes | ✅ Yes |
| TE-15 | Click same row again → deselects, detail panel disappears | ✅ Yes | ✅ Yes |
| TE-16 | Detail loading: "Loading topic details…" while fetching | ✅ Yes | ✅ Yes |
| TE-17 | Detail: header shows topic name + health badge | ✅ Yes | ✅ Yes |
| TE-18 | Messages tab: metrics row + consume form + results table | ✅ Yes | ✅ Yes |
| TE-19 | Messages tab: filters (Key Match, Header Match, JSONPath) | ✅ Yes | ✅ Yes |
| TE-20 | Messages tab: click row → detail pane with Copy Key / Copy Value | ✅ Yes | ✅ Yes |
| TE-21 | Partitions tab: table with all partition details + total footer | ✅ Yes | ✅ Yes |
| TE-22 | Consumer Groups tab: group list or empty state | ✅ Yes | ✅ Yes |
| TE-23 | Config tab: key-value config table or empty state | ✅ Yes | ✅ Yes |
| TE-24 | Tab switching preserves topic selection | ✅ Yes | ✅ Yes |
| TE-25 | Switching topics clears previous results | ✅ Yes | ✅ Yes |
| TE-26 | Disconnect during browsing → guard re-appears | ✅ Yes | ✅ Yes |

---

## TE-01 — Guard: Cluster Not Connected

**Prerequisites:** At least one cluster configured but NOT connected

**Steps:**
1. Go to **Settings → Kafka** → click **Disconnect** to ensure the cluster is disconnected
2. Navigate to **Protocols → Kafka → Topics** tab

**Expected:**
- ☐ A centered guard panel appears: **"Cluster is not connected"**
- ☐ Subtitle: *"Connect to a Kafka cluster to use the studio."*
- ☐ Button: **"→ Open Kafka Settings"** — clicking it navigates to Settings → Kafka
- ☐ No topic list or detail panel is visible — the guard replaces the entire page

---

## TE-02 — Guard: No Clusters Configured

**Prerequisites:** No Kafka clusters saved (fresh app or cleared localStorage)

To reset:
```js
// Browser DevTools → Console
localStorage.removeItem('perf-test-kafka-clusters-v1');
localStorage.removeItem('perf-test-kafka-selected-cluster-id');
location.reload();
```

**Steps:**
1. Navigate to **Protocols → Kafka → Topics** tab

**Expected:**
- ☐ Guard panel shows: **"No clusters configured"**
- ☐ Subtitle: *"Add a Kafka cluster in settings to get started."*
- ☐ Button: **"→ Add a cluster"**
- ☐ Clicking the button navigates to Settings → Kafka

**Clean up:** Re-create and connect the cluster before continuing.

---

## TE-03 — Loading State

**Steps:**
1. This state appears briefly when the Kafka settings are still loading from localStorage
2. To observe: do a hard refresh (`Cmd+Shift+R`) and immediately navigate to Protocols → Kafka → Topics tab

**Expected:**
- ☐ A brief message appears: **"Loading Kafka settings…"** (CSS class `kafka-ms-loading`)
- ☐ This is replaced by either the guard or the topic list within ~1 second

> **Note:** This state is very brief on fast machines. It may only be visible for a single frame. It's acceptable to verify this in code review rather than visually.

---

## TE-04 — Connected: Two-Column Layout

**Prerequisites:** Connected to the plaintext broker

**Steps:**
1. Navigate to **Protocols → Kafka → Topics** tab

**Expected:**
- ☐ The page has `data-testid="topic-explorer-page"`
- ☐ A **two-column layout** renders:
  - **Left column:** topic list card with header "Topics" and a count like *"37 of 37"* (filtered count / total count — depends on seed; the full smoke-test seed creates 37 topics)
  - **Right column:** currently empty — no detail panel visible until a topic is clicked
- ☐ The sub-navigation bar shows four tabs: **Publish**, **Consume**, **Topics** (active/highlighted), **Schema Registry**
- ☐ There is also a **"Kafka"** domain label button above the sub-nav tabs

---

## TE-05 — Topic List: Columns and Data

**Prerequisites:** Connected, seeded topics exist

**Steps:**
1. Observe the topic list table

**Expected:**
- ☐ Table columns: **Topic** | **Parts** | **Repl** | **Traffic** | **CGs** | **Health**
- ☐ Each row shows:
  - **Topic**: topic name (e.g., `orders.created`). Internal topics show an **"Internal"** badge next to the name
  - **Parts**: partition count (e.g., `3` for `orders.created`)
  - **Repl**: shows `—` (dash) until the topic detail has been loaded; then shows replication factor (e.g., `1` for single-node Redpanda)
  - **Traffic**: shows `—` until detail loaded; then shows total message count (e.g., `3` or formatted as `1.5K`)
  - **CGs**: shows `—` until detail loaded; then shows consumer group count
  - **Health**: shows `—` until detail loaded; then shows a health badge:
    - **● OK** (green) — fully in-sync replicas
    - **⚠ Warn** (amber) — under-replicated partitions
    - **?** — unknown / not yet fetched
- ☐ The header count shows `N of M` (e.g., *"7 of 7"* when no filters active)
- ☐ Rows are clickable (cursor: pointer)

---

## TE-06 — Search by Topic Name

**Prerequisites:** Multiple topics visible in the list

**Steps:**
1. Find the search input (placeholder: *"Search topics…"*, `data-testid="topic-search"`)
2. Type `orders`
3. Observe the list
4. Clear the search field

**Expected:**
- ☐ The search input is visible above the filter row
- ☐ Typing `orders` immediately filters the list to show only topics containing "orders" (e.g., `orders.created`, `orders.updated`, `orders.failed`)
- ☐ The header count updates (e.g., *"3 of 7"*)
- ☐ Clearing the search restores all topics
- ☐ Search is case-insensitive (`Orders` also matches)

---

## TE-07 — Internal Topics Toggle

**Steps:**
1. Observe the **"Internal"** checkbox label in the filter row
2. Check the checkbox
3. Uncheck the checkbox

**Expected:**
- ☐ By default, internal topics (like `__consumer_offsets`) are **hidden** — the "Internal" checkbox is unchecked
- ☐ Checking "Internal" includes any topics flagged as `isInternal` in the list. Each internal topic shows an **"Internal"** badge next to its name
- ☐ The header count may increase (e.g., from *"37 of 37"* to *"38 of 37"*) — depends on whether Redpanda exposes internal topics
- ☐ Unchecking "Internal" hides internal topics again

> **Note — Redpanda:** When testing with Redpanda, `__consumer_offsets` may not appear in the topic list because Redpanda's admin API typically does not expose internal topics through `fetchTopicMetadata`. This behavior differs from Apache Kafka, where internal topics like `__consumer_offsets` and `__transaction_state` are returned with `isInternal: true`. With Redpanda, checking "Internal" may not change the visible count — this is expected.

---

## TE-08 — Domain Chips

**Steps:**
1. Observe the chip bar below the filter row (`data-testid="domain-chips"`)
2. Click different chips

**Expected:**
- ☐ The chip bar shows: **"All"** (default active, highlighted) followed by dynamic prefix chips derived from topic names
- ☐ Expected chips (based on full smoke-test seed): `All`, `audit`, `headers`, `inventory`, `notifications`, `orders`, `payments`, `redfireforge`, `runner`, `shipping`, `tauri`, `test`, `users`
  - Topic prefixes are derived from the first segment before the first `.` (e.g., `orders.created` → `orders`). Topics without a `.` do not generate a chip.
  - Chips are dynamic — actual list depends on which topics exist in the broker
  - Plus two special chips at the end: **"Recently Active"** and **"Lagging Consumers"** (greyed out until a topic detail is loaded)
- ☐ Clicking **"orders"** filters to only topics with the `orders.` prefix (e.g., `orders.created`, `orders.updated`, `orders.failed`)
- ☐ The header count updates accordingly
- ☐ Clicking **"All"** restores all topics
- ☐ Clicking an active chip again deselects it (toggles back to "All")
- ☐ Domain chip filtering and text search can be **combined** (e.g., chip "orders" + search "created" → only `orders.created`)

---

## TE-09 — "Recently Active" and "Lagging Consumers" Chips

**Prerequisites:** No topic detail has been loaded yet (fresh page)

### Part A — Disabled state

**Steps:**
1. Observe the **"Recently Active"** and **"Lagging Consumers"** chips

**Expected:**
- ☐ Both chips have CSS class `kafka-topic-chip-special` and are visually **disabled** (grayed out)
- ☐ They have the `disabled` attribute set
- ☐ Hover tooltip: *"Load a topic to populate this filter"*
- ☐ Clicking them has no effect

### Part B — Enabled after loading a topic detail

**Steps:**
1. Click any topic row (e.g., `orders.created`) to load its detail
2. Wait for the detail panel to appear (detail loads)
3. Observe the "Recently Active" and "Lagging Consumers" chips

**Expected:**
- ☐ Both chips are now **enabled** (clickable, no `disabled` attribute)
- ☐ Clicking **"Recently Active"** filters to topics that have messages (message count > 0 in cached details)
- ☐ Clicking **"Lagging Consumers"** filters to topics where at least one cached consumer group has `totalLag > 0`
- ☐ If no cached topic has lagging consumers, clicking "Lagging Consumers" shows 0 results

---

## TE-10 — Health Filter Dropdown

**Steps:**
1. Find the **Health** filter dropdown (`data-testid="health-filter"`)
2. Observe its state before any topic detail has been loaded
3. After loading at least one topic detail, change the filter

**Expected:**
- ☐ Options: **"Health: All"** (default), **"Healthy"**, **"Warning"**, **"Unknown"**
- ☐ Before any detail is loaded: the dropdown is **disabled** with tooltip *"Load a topic to populate this filter"*
- ☐ After loading a topic detail: the dropdown becomes **enabled**
- ☐ Selecting **"Healthy"** filters to topics with health status `healthy` (green ● OK badge)
- ☐ The filter only applies to topics that have cached detail data; topics without cached detail are excluded from filtered results when a non-"All" filter is active

---

## TE-11 — Partition Filter Dropdown

**Steps:**
1. Find the **Partition** filter dropdown (`data-testid="partition-filter"`)
2. Select different options

**Expected:**
- ☐ Options: **"Parts: Any"** (default), **"1–4"**, **"5–12"**, **"12+"**
- ☐ This dropdown is **always enabled** (partition counts come from the topic list metadata, not detail)
- ☐ Selecting **"1–4"** shows all topics (default Redpanda setup: most topics have 1 or 3 partitions)
- ☐ Selecting **"5–12"** shows 0 topics with default seeded data (no topics have 5+ partitions unless you created one with `-p 6`)
- ☐ Selecting **"12+"** shows 0 topics with default seeded data
- ☐ To test "5–12", create a topic with more partitions: `rpk topic create test.wide -p 8`
- ☐ The header count updates in real time

---

## TE-12 — Retention Filter Dropdown

**Steps:**
1. Find the **Retention** filter dropdown (`data-testid="retention-filter"`)
2. Observe its state before and after loading a topic detail

**Expected:**
- ☐ Options: **"Retention: Any"** (default), **"< 1 day"**, **"1–7 days"**, **"> 7 days"**
- ☐ Before any detail is loaded: the dropdown is **disabled** with tooltip *"Load a topic to populate this filter"*
- ☐ After loading a topic detail: the dropdown becomes enabled
- ☐ Retention is calculated from the `retention.ms` config value in the cached topic detail
- ☐ Redpanda default retention is typically 604800000 ms (7 days), so most topics will match "1–7 days"

---

## TE-13 — Empty State: No Matching Topics

**Steps:**
1. Type a nonsensical string in the search input (e.g., `zzzznonexistent`)

**Expected:**
- ☐ The topic table body shows a single row spanning all columns: **"No topics match the current filters"**
- ☐ The header count shows *"0 of N"*

**Clean up:** Clear the search input.

---

## TE-14 — Click Topic Row → Detail Panel Appears

**Prerequisites:** Topic list visible, no topic selected

**Steps:**
1. Click the **`orders.created`** row (`data-testid="topic-row-orders.created"`)

**Expected:**
- ☐ The clicked row gets a **selected** highlight (CSS class `selected`)
- ☐ A **detail panel** appears to the right of the topic list
- ☐ While loading: the detail panel shows **"Loading topic details…"** (TE-16)
- ☐ After loading: the detail panel shows the topic name and health badge in the header
- ☐ Four tabs appear below the header: **Messages** (default active), **Partitions**, **Consumer Groups**, **Config** (`data-testid="detail-tabs"`)

---

## TE-15 — Click Same Row Again → Deselects

**Prerequisites:** TE-14 completed (topic selected, detail visible)

**Steps:**
1. Click the same **`orders.created`** row again

**Expected:**
- ☐ The row loses its selected highlight
- ☐ The detail panel disappears from the right column
- ☐ The layout reverts to the topic list occupying the full width (or the right side shows no panel)

---

## TE-16 — Detail Loading State

**Steps:**
1. Click a topic that has NOT been loaded yet (no cached detail) — e.g., `notifications.email` if not previously clicked

**Expected:**
- ☐ The detail panel immediately shows: **"Loading topic details…"**
- ☐ After 1–3 seconds the loading text is replaced by the full detail panel with tabs
- ☐ Subsequent clicks on the same topic do NOT show loading again (detail is cached)

---

## TE-17 — Detail Header: Topic Name + Health Badge

**Prerequisites:** A topic detail is loaded (from TE-14)

**Steps:**
1. Observe the detail panel header

**Expected:**
- ☐ The header shows the **topic name** in bold (e.g., `orders.created`)
- ☐ A **health badge** appears next to the name:
  - **● OK** (green) for healthy topics
  - **⚠ Warn** (amber) for degraded topics
  - **? Unknown** for unknown health status

---

## TE-18 — Messages Tab: Metrics Row + Consume Form + Results

**Prerequisites:** Topic `orders.created` selected, Messages tab active (default)

**Steps:**
1. Observe the Messages tab content (`data-testid="detail-messages-tab"`)
2. Set **Time Window** to **"Earliest"**
3. Leave all filters empty, **Max Messages** at `50`
4. Click **"Consume Once"** (`data-testid="detail-consume-btn"`)

**Expected (before consuming):**
- ☐ **Metrics row** at the top with four boxes:
  - **Partitions**: `3` (for `orders.created`)
  - **Replication**: `1` (single-node Redpanda)
  - **Total Messages**: formatted total (e.g., `3`)
  - **Consumer Groups**: count (e.g., `0` if none)
- ☐ **Consume form** with fields:
  - **Time Window** — dropdown: *Latest* (default), *Last 1 Hour*, *Last 24 Hours*, *Earliest*
  - **Partition** — dropdown: *Any* (default), plus one option per partition (`0`, `1`, `2`)
  - **Key Match** — text input, placeholder *"exact key"*
  - **Header Match** — text input, placeholder *"key=value"* (`data-testid="detail-header-match"`)
  - **JSONPath** — text input, placeholder *"$.store.name"* (`data-testid="detail-jsonpath"`)
  - **JSONPath Expected** — text input, placeholder *"expected value"* (`data-testid="detail-jsonpath-expected"`)
  - **Max Messages** — text input, default `50`
  - **Sort Order** — dropdown: *"Oldest First"* (default), *"Newest First"* — controls display order of the results table
- ☐ **"Consume Once"** button (primary, enabled)

**Expected (after consuming):**
- ☐ Button shows **"Consuming…"** while loading
- ☐ A results zone appears (`data-testid="detail-results"`) with:
  - Message count: **"3 messages"** (or however many exist)
  - Results table with columns: **#** | **Offset** | **Partition** | **Timestamp** | **Key** | **Value**
    - Note: the Messages tab table has a **Timestamp** column that the Kafka Studio consume table does not
  - Each timestamp is formatted as `YYYY-MM-DD HH:MM:SS`
- ☐ **"Export"** and **"Clear"** buttons appear in the action row
- ☐ A **"timed out"** badge may appear if the consumer waited the full timeout

---

## TE-19 — Messages Tab: Filters

**Prerequisites:** TE-18 completed, topic `orders.created` has seeded messages

> **Important — Fresh Consumer Group:** Each topic selection generates a fresh browser-side consumer group. If you've already consumed in TE-18, reload the page and re-select the topic to get a fresh group, OR manually enter a new group ID in the form (if visible).

### Part A — Key Match filter

**Steps:**
1. Set **Key Match** to `order-001`
2. Set **Time Window** to **"Earliest"**
3. Click **"Consume Once"**

**Expected:**
- ☐ Only messages with key `order-001` appear (1 message: ORD-001)

### Part B — Header Match filter

**Steps:**
1. Clear Key Match
2. Set **Header Match** to `source=checkout` (`data-testid="detail-header-match"`)
3. Click **"Consume Once"**

**Expected:**
- ☐ Only the message with header `source: checkout` appears (1 message: ORD-003)

### Part C — JSONPath filter

**Steps:**
1. Clear Header Match
2. Set **JSONPath** to `$.status` (`data-testid="detail-jsonpath"`)
3. Set **JSONPath Expected** to `CREATED` (`data-testid="detail-jsonpath-expected"`)
4. Click **"Consume Once"**

**Expected:**
- ☐ All messages where `$.status === "CREATED"` appear (3 messages in this case — all seeded messages have status CREATED)

### Part D — Partition filter

**Steps:**
1. Clear all text filters
2. Set **Partition** to `0` (select from dropdown)
3. Set **Time Window** to **"Earliest"**
4. Click **"Consume Once"**

**Expected:**
- ☐ Only messages from partition 0 appear (count depends on where Kafka assigned the messages)

**Clean up:** Reset all filters (clear text inputs, set Partition to "Any", Time Window to "Latest").

---

## TE-20 — Messages Tab: Click Row → Detail Pane

**Prerequisites:** TE-18 completed, results table visible

**Steps:**
1. Click the **first row** in the results table (`data-testid="detail-row-0"`)

**Expected:**
- ☐ The row gets a **selected** highlight
- ☐ A **detail pane** appears below the table (`data-testid="detail-msg-pane"`)
- ☐ Detail pane contains:
  - **Action buttons**: **"Copy Key"** (disabled if no key), **"Copy Value"**, **"✕"** close button (aria-label "Close detail")
  - **Pretty-printed JSON body** in a `<pre>` block:
    ```json
    {
      "orderId": "ORD-001",
      "status": "CREATED",
      "amount": 99.5
    }
    ```
  - **Headers table** (if the message has headers):
    - Columns: **Header Key** | **Header Value**
    - Rows: `traceId → trace-001`, `source → test-seed`
- ☐ Clicking the same row again **deselects** it (detail pane closes)
- ☐ Clicking **✕** also closes the detail pane
- ☐ **"Export"** button downloads all results as JSON (same format as Kafka Studio export)
- ☐ **"Clear"** button clears results, table, and detail pane

---

## TE-21 — Partitions Tab

**Prerequisites:** Topic `orders.created` selected, detail loaded

**Steps:**
1. Click the **"Partitions"** tab in the detail panel (`data-testid="detail-partitions-tab"`)

**Expected:**
- ☐ A table appears with columns: **Partition** | **Leader** | **Replicas** | **ISR** | **Earliest** | **Latest** | **Messages**
- ☐ Each row represents one partition of the topic:
  - **Partition**: partition ID (0, 1, 2 for a 3-partition topic)
  - **Leader**: broker ID that leads the partition (e.g., `0` for single-node Redpanda)
  - **Replicas**: comma-separated list of broker IDs (e.g., `0`)
  - **ISR**: shown as a fraction `N / M` — in-sync replicas / total replicas
    - If ISR < replicas, the fraction is highlighted amber (CSS class `kafka-isr-amber`)
    - If ISR = replicas, normal display
  - **Earliest**: earliest offset number
  - **Latest**: latest offset number
  - **Messages**: number of messages (latest - earliest)
- ☐ A **footer row** at the bottom shows **Total** with the combined message count across all partitions
- ☐ The total should match the "Total Messages" metric in the Messages tab metrics row

---

## TE-22 — Consumer Groups Tab

**Prerequisites:** Topic `orders.created` selected, detail loaded

**Steps:**
1. Click the **"Consumer Groups"** tab (`data-testid="detail-groups-tab"`)

**Expected (with consumer groups):**
- ☐ If consumer groups exist for this topic: a table appears with columns: **Group ID** | **State** | **Total Lag**
- ☐ **State** is shown with a color-coded badge:
  - `Stable` → green badge (CSS class `kafka-cg-state-green`)
  - `CompletingRebalance` / `PreparingRebalance` → amber badge (CSS class `kafka-cg-state-amber`)
  - Other states → grey badge (CSS class `kafka-cg-state-grey`)
- ☐ **Total Lag** is color-coded:
  - `0` → green text (CSS class `kafka-lag-green`)
  - `> 0` → amber text (CSS class `kafka-lag-amber`)

**Expected (without consumer groups):**
- ☐ If no consumer groups are associated with this topic: **"No consumer groups found for this topic."** (empty state)

> **Tip:** Consumer group data comes from the initial topic detail fetch (cached on first click). If you consume from `orders.created` in the Messages tab (TE-18) and then switch to Consumer Groups, the newly created `redfireforge-debug-XXXXXXXX` group will **not** appear — the cached detail is stale. To see updated groups, **reload the page** (`Cmd+R`) and re-select the topic. This is a known caching behavior — the Topic Explorer caches detail data on first load and doesn't re-fetch until the page is reloaded.

---

## TE-23 — Config Tab

**Prerequisites:** Topic `orders.created` selected, detail loaded

**Steps:**
1. Click the **"Config"** tab (`data-testid="detail-config-tab"`)

**Expected (with config):**
- ☐ A key-value table appears with columns: **Config Key** | **Value**
- ☐ Typical Redpanda config keys include:
  - `cleanup.policy` → `delete`
  - `retention.ms` → `604800000` (7 days)
  - `segment.bytes` → large number
  - `max.message.bytes` → `1048576` (1MB)
- ☐ All config entries are shown as plain text rows

**Expected (without config):**
- ☐ **"No configuration data available."** (empty state, only if the server returns an empty config object)

---

## TE-24 — Tab Switching Preserves Topic Selection

**Steps:**
1. Select `orders.created` (click the row)
2. Switch between tabs: Messages → Partitions → Consumer Groups → Config → Messages

**Expected:**
- ☐ The topic row remains highlighted (selected) throughout tab switches
- ☐ The detail header (topic name + health badge) remains the same
- ☐ Switching back to the **Messages** tab restores the previous consume results (if any)
- ☐ The tabs are independent — data in each tab is preserved

---

## TE-25 — Switching Topics Clears Previous Results

**Steps:**
1. Select `orders.created` → Messages tab → click "Consume Once" to get results
2. Click a different topic row (e.g., `notifications.email`)

**Expected:**
- ☐ The detail panel switches to `notifications.email`
- ☐ The previous consume results from `orders.created` are **cleared** (no stale data carries over)
- ☐ The Messages tab shows a fresh consume form with no results
- ☐ The `orders.created` row loses its selected highlight
- ☐ The `notifications.email` row gains the selected highlight

---

## TE-26 — Disconnect During Browsing → Guard Re-appears

**Prerequisites:** Connected, Topic Explorer open with a topic selected

**Steps:**
1. While viewing the Topics page with `orders.created` detail open
2. Open a **new browser tab** and navigate to `http://localhost:5173/?tab=kafka-settings`
3. Click **Disconnect** on the Kafka settings page
4. Switch back to the Topics tab

**Expected:**
- ☐ The Topics page is replaced by the **guard panel**: *"Cluster is not connected"*
- ☐ The topic list and detail panel are no longer visible
- ☐ Button: **"→ Open Kafka Settings"**
- ☐ Reconnecting and returning to the Topics page restores the topic list (but previously cached details may need re-loading)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Guard shows "Cluster is not connected" | Go to Settings → Kafka → select cluster → click Connect |
| Topic list is empty | Check that the broker is running: `docker compose ps` |
| Repl/Traffic/CGs/Health columns show "—" | Click a topic row to load its detail — these columns populate from cached detail data |
| Health/Retention filters are disabled | Load at least one topic detail first (click a row) |
| "Recently Active" chip shows 0 results | Only topics with messages AND cached detail data will appear |
| Consume returns 0 messages | Set Time Window to "Earliest"; if still 0, reload the page for a fresh consumer group |
| Partitions tab shows 0 messages | The topic may genuinely have no messages (offsets match) |
| Consumer Groups tab is empty | Consume from the topic first — a consumer group is created when you use "Consume Once" |
| Config tab shows "No configuration data available" | The server may not have returned config — check the server logs for errors |

---

## Reset / Clean Up

To delete seeded topics:

```bash
docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda rpk topic delete orders.created orders.updated orders.failed inventory.adjusted notifications.email redfireforge.debug.consume
```

To stop services:

```bash
cd docker/kafka/plaintext && docker compose down
# Ctrl+C on npm run server and npm run dev terminals
```
