# Kafka Secure, TLS & Stream — Visual Test Scenarios

> **Covers:** SASL/SCRAM workflow scenarios, TLS-encrypted workflow scenarios, and Kafka Studio Stream testing
> **Created:** 2026-06-05
> **Purpose:** Step-by-step manual guide for verifying Kafka workflows over secure (SASL/SCRAM) and TLS-encrypted
> connections, plus Kafka Studio's continuous Stream consume mode.
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.

---

## Validation Status (2026-06-05)

| Scenario | Method | Status | Notes |
|---|---|---|---|
| **SASL/SCRAM Secure Workflows** | | | |
| **SW-01** (Secure 01 — Produce + Consume) | Playwright + Docker | ✅ Validated | Produce/consume over SASL/SCRAM, PASS in ~3s |
| **SW-02** (Secure 02 — Trigger + HTTP) | Playwright + Docker | ✅ Validated | Sample payload + HTTP enrichment + produce, PASS |
| **SW-03** (Secure 03 — Produce + Wait) | Playwright + Docker | ✅ Validated | Produce + wait with sample payload, PASS in <1s |
| **SW-04** (Secure 06 — Header pass-through) | Playwright + Docker | ✅ Validated | 5 headers forwarded through trigger → produce, PASS |
| **SW-05** (Secure cluster connection) | Playwright UI | ✅ Validated | SASL/SCRAM connect/disconnect cycle verified |
| **SW-06** (Secure Kafka Studio round-trip) | Manual | ☐ Pending | Publish → Consume via Studio on secure broker |
| **TLS-Encrypted Workflows** | | | |
| **TW-01** (TLS 01 — Produce + Consume) | Playwright + Docker | ✅ Validated | Produce/consume over TLS+SASL, PASS |
| **TW-02** (TLS 02 — Trigger + HTTP) | Playwright + Docker | ✅ Validated | Sample payload + HTTP + produce over TLS, PASS |
| **TW-03** (TLS 06 — Header pass-through) | Playwright + Docker | ✅ Validated | 5 headers over TLS, PASS |
| **TW-04** (TLS cluster connection) | Playwright UI | ✅ Validated | TLS+SCRAM connect verified, cert shows RedfireForge-CA |
| **TW-05** (TLS strict mode — self-signed rejection) | Manual | ☐ Pending | rejectUnauthorized=true with self-signed cert |
| **TW-06** (TLS smoke test script) | CLI | ☐ Pending | `./docker/kafka/tls/smoke-test.sh` passes all scenarios |
| **Kafka Studio Stream Mode** | | | |
| **SM-01** (Stream mode UI) | Playwright UI | ✅ Validated | Start/Stop Stream toggle, LIVE badge, message counter, detail pane verified |
| **SM-02** (Live message streaming) | Playwright UI + Docker | ✅ Validated | 92 messages received in real-time on redfireforge.stream.test |
| **SM-03** (Stream stop + message persistence) | Playwright UI | ✅ Validated | Stop Stream → messages preserved, LIVE badge disappears, Start Stream button returns |
| **SM-04** (Stream auto-stop on disconnect) | Manual | ☐ Pending | Disconnect cluster while streaming → stream stops |
| **SM-05** (Stream with filters) | Manual | ☐ Pending | Set key/header filter → only matching messages appear |

**Summary:** 12 scenarios validated (automated + manual), 5 scenarios pending manual verification.

---

## Part 1: SASL/SCRAM Secure Workflow Scenarios

### Prerequisites

1. **Secure Docker broker** running on `localhost:19093`:
   ```bash
   cd docker/kafka/secure && docker compose up -d
   ```
   Wait for the init container to complete (creates users, topics, ACLs).

2. **Kafka cluster configured** in the app:
   - Go to **Settings → Kafka** → **+ New** (or import `docs/test-data/kafka-clusters-import.json`)
   - Cluster Name: `Local Secure (SASL)`
   - Cluster ID: `local-secure`
   - Broker: `127.0.0.1:19093`
   - Auth: **SCRAM-SHA-256**
   - Username: `redfireforge-app`
   - Password: `app-password`
   - TLS: **unchecked**
   - Click **Save Cluster** → Select → **Connect**
   - Verify badge shows **Connected** (green)

3. **Topics created** on secure broker (done by init container):
   ```
   redfireforge.workflow.test, orders.created, orders.enriched, orders.submitted,
   payments.confirmed, orders.approved, notifications.email, users.avro,
   headers.inbound, headers.outbound
   ```

### Cluster Import Shortcut

Instead of creating clusters manually, import the pre-built cluster config:

1. Go to **Settings → Kafka** → click **↑ Import**
2. Select `docs/test-data/kafka-clusters-import.json`
3. This creates 3 clusters: Local Plaintext, Local Secure (SASL), Local TLS (TLS+SASL)

---

### SW-01: Secure Scenario 01 — Produce then Consume

**File:** `docs/test-data/secure/kafka-workflow-scenario-01-produce-consume-secure.json`

**Steps:**
1. Ensure **Local Secure (SASL)** cluster is connected (Settings → Kafka → select → Connect).
2. Go to **Workflow** → **+ New** → **Import Workflow** → select the JSON file above.
3. Select **Secure Kafka Scenario 01** in the sidebar.
4. Click **Quick Test**.

**Expected:**
- [ ] Console shows `[Produce Order Event] PRODUCE redfireforge.workflow.test`
- [ ] Console shows `cluster: local-secure`
- [ ] Console shows `[Consume Order Event] CONSUME redfireforge.workflow.test`
- [ ] Console shows `Consumed 1 message(s)` (from earliest)
- [ ] `Workflow PASS` — all nodes green

**Verify via rpk (optional):**
```bash
docker exec redfireforge-redpanda-secure rpk topic consume redfireforge.workflow.test \
  --offset start --num 1 \
  -X brokers=localhost:9092 \
  -X user=admin -X pass=admin-secret \
  -X sasl.mechanism=SCRAM-SHA-256
```

---

### SW-02: Secure Scenario 02 — Trigger → HTTP → Produce

**File:** `docs/test-data/secure/kafka-workflow-scenario-02-trigger-http-produce-secure.json`

**Steps:**
1. Import the JSON file → select **Secure Kafka Scenario 02** → click **Quick Test**.

**Expected:**
- [ ] Console shows `[Order Created Trigger] Triggered by sample payload (Quick Test)`
- [ ] Console shows `[Enrich Order]` HTTP GET succeeds (200)
- [ ] Console shows `[Produce Enriched Order] PRODUCE orders.enriched` with `cluster: local-secure`
- [ ] Variables extracted: `orderId="ORD-2025-001"`, `customerId="CUST-789"`
- [ ] `Workflow PASS`

---

### SW-03: Secure Scenario 03 — Produce + Wait (Correlation)

**File:** `docs/test-data/secure/kafka-workflow-scenario-03-produce-wait-correlation-secure.json`

**Steps:**
1. Import the JSON file → select **Secure Kafka Scenario 03** → click **Quick Test**.

**Expected:**
- [ ] Console shows `[Send Order] PRODUCE orders.submitted` with `cluster: local-secure`
- [ ] Console shows `[Wait for Payment] KAFKA WAIT` using sample payload
- [ ] Wait resolves in < 1 second (sample payload, not real wait)
- [ ] Variables: `paymentId="PAY-TEST-001"`, `paidAmount="129.99"`
- [ ] `Workflow PASS`

---

### SW-04: Secure Scenario 06 — Header Pass-Through

**File:** `docs/test-data/secure/kafka-workflow-scenario-06-header-passthrough-secure.json`

**Steps:**
1. Import the JSON file → select **Secure Kafka Scenario 06** → click **Quick Test**.

**Expected:**
- [ ] Trigger logs 4 headers: `X-Trace-Id`, `X-Correlation-Id`, `X-Source`, `X-Environment`
- [ ] Produce logs 5 headers (original 4 + `X-Processed-By: redfireforge`)
- [ ] `Workflow PASS`

**Verify headers via rpk:**
```bash
docker exec redfireforge-redpanda-secure rpk topic consume headers.outbound \
  --offset start --num 1 \
  -X brokers=localhost:9092 \
  -X user=admin -X pass=admin-secret \
  -X sasl.mechanism=SCRAM-SHA-256
```

---

### SW-05: Secure Cluster Connection Lifecycle

**Goal:** Verify connect/disconnect/reconnect with SASL/SCRAM.

**Steps:**
1. Go to **Settings → Kafka** → select **Local Secure (SASL)**.
2. Click **Connect** → verify badge shows **Connected**.
3. Click **Disconnect** → verify badge shows **Idle**.
4. Click **Connect** again → verify **Connected** restored.
5. Click **Test Connection** → verify returns success message.

**Expected:**
- [ ] Each state transition works cleanly (no errors)
- [ ] Header badge updates to show `Local Secure (SASL) — Connected`

---

### SW-06: Secure Kafka Studio Publish → Consume

**Goal:** End-to-end verification via Kafka Studio on the secure broker.

**Steps:**
1. Connect to **Local Secure (SASL)** cluster.
2. Go to **Protocols → Kafka → Publish** tab.
3. Set **Topic**: `redfireforge.workflow.test`
4. Set **Key**: `secure-studio-001`
5. Set **Body**: `{"source": "kafka-studio", "secure": true}`
6. Click **Send Once**.

**Verify:**
7. Switch to **Consume** tab.
8. Set **Topic**: `redfireforge.workflow.test`, **Start Position**: `Earliest`.
9. Click **Consume Once**.

**Expected:**
- [ ] Publish returns **✓ Pass**
- [ ] Consume shows message with key `secure-studio-001`
- [ ] Body matches the published JSON

---

## Part 2: TLS-Encrypted Workflow Scenarios

### Prerequisites

1. **Generate TLS certificates** (one-time):
   ```bash
   cd docker/kafka/tls && ./generate-certs.sh
   ```
   Creates `certs/ca.crt`, `certs/broker.crt`, `certs/broker.key` with SAN for `localhost`.

2. **Start TLS Docker broker** on `localhost:19095`:
   ```bash
   cd docker/kafka/tls && docker compose up -d
   ```
   Wait ~15s for health check + init container.

3. **Verify TLS handshake:**
   ```bash
   echo | openssl s_client -connect 127.0.0.1:19095 \
     -CAfile docker/kafka/tls/certs/ca.crt 2>&1 | head -10
   ```
   Expected: `verify return:1` and `CN=localhost` in the certificate chain.

4. **Kafka cluster configured** in the app:
   - Cluster Name: `Local TLS (TLS+SASL)`
   - Cluster ID: `local-tls`
   - Broker: `127.0.0.1:19095`
   - Auth: **SCRAM-SHA-256** (username: `redfireforge-app`, password: `app-password`)
   - TLS: **checked**, Reject Unauthorized: **unchecked** (self-signed cert)
   - Click **Save Cluster** → Select → **Connect**

### Docker Port Summary

| Profile | Container | Kafka Port | Admin Port | Auth |
|---|---|---|---|---|
| Plaintext | `redfireforge-redpanda` | 19092 | 9644 | None |
| Secure | `redfireforge-redpanda-secure` | 19093 | 19645 | SCRAM-SHA-256 |
| TLS | `redfireforge-redpanda-tls` | 19095 | 19648 | SCRAM-SHA-256 + TLS |
| Schema Registry | `redfireforge-redpanda-sr` | 19094 | 19647 | None |

---

### TW-01: TLS Scenario 01 — Produce then Consume

**File:** `docs/test-data/tls/kafka-workflow-scenario-01-produce-consume-tls.json`

**Steps:**
1. Ensure **Local TLS (TLS+SASL)** cluster is connected.
2. Import the JSON file → select **TLS Kafka Scenario 01** → click **Quick Test**.

**Expected:**
- [ ] Console shows `cluster: local-tls`
- [ ] Produce and consume succeed over TLS
- [ ] `Workflow PASS`

---

### TW-02: TLS Scenario 02 — Trigger → HTTP → Produce

**File:** `docs/test-data/tls/kafka-workflow-scenario-02-trigger-http-produce-tls.json`

**Steps:**
1. Import the JSON file → select **TLS Kafka Scenario 02** → click **Quick Test**.

**Expected:**
- [ ] Trigger uses sample payload, HTTP GET succeeds, produce to `orders.enriched` over TLS
- [ ] `Workflow PASS`

---

### TW-03: TLS Scenario 06 — Header Pass-Through

**File:** `docs/test-data/tls/kafka-workflow-scenario-06-header-passthrough-tls.json`

**Steps:**
1. Import the JSON file → select **TLS Kafka Scenario 06** → click **Quick Test**.

**Expected:**
- [ ] 5 headers forwarded over TLS connection
- [ ] `Workflow PASS`

**Verify via rpk inside the container:**
```bash
docker exec redfireforge-redpanda-tls rpk topic consume headers.outbound \
  --offset start --num 1 \
  -X brokers=localhost:19095 \
  -X user=redfireforge-app -X pass=app-password \
  -X sasl.mechanism=SCRAM-SHA-256 \
  -X tls.enabled=true \
  -X tls.ca=/etc/redpanda/certs/ca.crt
```

---

### TW-04: TLS Cluster Connection Verification

**Goal:** Verify TLS handshake and certificate chain.

**Steps:**
1. Go to **Settings → Kafka** → select **Local TLS (TLS+SASL)**.
2. Click **Test Connection**.

**Expected:**
- [ ] Returns success — TLS handshake completes
- [ ] No certificate errors (rejectUnauthorized=false)
- [ ] Badge shows **Connected**

---

### TW-05: TLS Strict Mode — Self-Signed Certificate Rejection

**Goal:** Verify that strict TLS mode rejects self-signed certificates when no CA is provided.

**Steps:**
1. Edit the **Local TLS** cluster → check **Reject Unauthorized** (rejectUnauthorized=true).
2. **Do NOT** paste the CA certificate PEM.
3. Click **Save Cluster** → click **Connect**.

**Expected:**
- [ ] Connection **fails** with a TLS/certificate error
- [ ] Error message indicates certificate validation failure (e.g., "self-signed certificate", "unable to verify", or similar)

**Fix:**
4. Edit the cluster again → paste the contents of `docker/kafka/tls/certs/ca.crt` into the **CA Certificate (PEM)** field.
5. Click **Save Cluster** → click **Connect**.

**Expected:**
- [ ] Connection **succeeds** — the CA cert validates the broker's self-signed certificate
- [ ] Badge shows **Connected**

---

### TW-06: TLS Smoke Test Script

**Goal:** Run the automated TLS smoke test script.

**Prerequisites:** Local dev server running (`npm run server`).

**Steps:**
```bash
cd docker/kafka/tls && ./smoke-test.sh
```

**Expected:**
- [ ] T1 — TLS + SCRAM valid credentials: **PASS**
- [ ] T2 — TLS strict mode: **PASS** (or acceptable variant)
- [ ] T3 — Full lifecycle (connect → produce → consume → disconnect): **PASS**
- [ ] Summary: all scenarios pass

---

## Part 3: Kafka Studio Stream Mode Testing

### Overview

The **Stream** mode in Kafka Studio's Consume tab provides continuous message consumption. Unlike "Consume Once" (which fetches existing messages and stops), Stream mode creates a long-lived subscription and polls for new messages every second.

**Key behaviors:**
- Creates a subscription via `subscribe` API
- Polls every 1 second for new messages via `subscription-messages` API
- Automatically stops when cluster disconnects
- Messages accumulate in a live table until manually cleared

### Stream Mode UI Elements

| Element | Description |
|---|---|
| **Consume Once / Stream** toggle | Mode selector (bottom of consume form, below Schema Registry section) |
| **Start Stream** button | Begins continuous consumption |
| **Stop Stream** button | Stops the subscription and polling |
| **Clear** button | Removes all accumulated stream messages |
| **Message counter** | Shows `N messages` count |
| **Cursor gap** indicator | Shows if messages were missed between polls |

---

### SM-01: Stream Mode UI Verification

**Goal:** Verify the Stream mode UI renders correctly.

**Steps:**
1. Go to **Protocols → Kafka → Consume** tab.
2. Click the **Stream** mode toggle.

**Expected:**
- [ ] The "Start Stream" button appears (replaces "Consume Once" action button)
- [ ] Message counter shows "0 messages"
- [ ] "No stream messages" placeholder text is visible
- [ ] Mode toggle highlights "Stream" as active

---

### SM-02: Live Message Streaming

**Goal:** Verify messages appear in real-time during streaming.

**Steps:**
1. Connect to **Local Plaintext** cluster (or any connected cluster).
2. Go to **Consume** tab → set **Topic**: `redfireforge.workflow.test`.
3. Switch to **Stream** mode → click **Start Stream**.
4. Open a second browser tab → go to **Publish** tab.
5. Set **Topic**: `redfireforge.workflow.test`, **Key**: `stream-test-001`.
6. Set **Body**: `{"event": "stream-test", "seq": 1}`.
7. Click **Send Once**.
8. Repeat with `seq: 2` and `seq: 3`.

**Expected (in the Stream tab):**
- [ ] Messages appear within 1–2 seconds of publishing
- [ ] Message counter updates: "1 messages" → "2 messages" → "3 messages"
- [ ] Each message shows correct key, offset, partition, and value preview
- [ ] Clicking a message row expands the detail view (body + headers)

---

### SM-03: Stream Stop + Message Persistence

**Goal:** Verify that stopping the stream preserves accumulated messages.

**Steps:**
1. Start a stream on any topic (per SM-02 setup).
2. Publish 2–3 messages so they appear in the stream table.
3. Click **Stop Stream**.
4. Verify the messages are still visible in the table.
5. Click **Clear** to remove all messages.

**Expected:**
- [ ] "Stop Stream" button changes back to "Start Stream"
- [ ] All previously received messages remain in the table after stopping
- [ ] Clicking "Clear" removes all messages and resets counter to "0 messages"
- [ ] "No stream messages" placeholder reappears after clear

---

### SM-04: Stream Auto-Stop on Disconnect

**Goal:** Verify that disconnecting the cluster automatically stops the stream.

**Steps:**
1. Start a stream on **Local Plaintext** cluster.
2. Go to **Settings → Kafka** → click **Disconnect**.
3. Go back to **Consume** tab.

**Expected:**
- [ ] Stream automatically stopped (button shows "Start Stream")
- [ ] No error message displayed (graceful stop)
- [ ] Previously received messages may still be visible

---

### SM-05: Stream with Filters

**Goal:** Verify that stream mode respects consume filters.

**Steps:**
1. Go to **Consume** tab → set **Topic**: `redfireforge.workflow.test`.
2. Under **Filters**, set **Key Equals**: `filtered-key`.
3. Switch to **Stream** mode → click **Start Stream**.
4. Publish message with key `other-key` and body `{"match": false}`.
5. Publish message with key `filtered-key` and body `{"match": true}`.

**Expected:**
- [ ] Only the message with key `filtered-key` appears in the stream table
- [ ] Message with key `other-key` is NOT displayed
- [ ] Counter shows "1 messages" (only the matching one)

---

### SM-06: Stream on Secure Broker

**Goal:** Verify Stream mode works over SASL/SCRAM connection.

**Steps:**
1. Connect to **Local Secure (SASL)** cluster.
2. Go to **Consume** tab → set **Topic**: `redfireforge.workflow.test` → switch to **Stream** mode.
3. Click **Start Stream**.
4. In a separate tab/window, publish a message to `redfireforge.workflow.test` on the secure broker.

**Expected:**
- [ ] Stream starts without errors on the SASL-authenticated connection
- [ ] Published messages appear in real-time
- [ ] Stopping and restarting the stream works correctly

---

### SM-07: Stream on TLS Broker

**Goal:** Verify Stream mode works over TLS+SASL connection.

**Steps:**
1. Connect to **Local TLS (TLS+SASL)** cluster.
2. Go to **Consume** tab → set **Topic**: `redfireforge.workflow.test` → switch to **Stream** mode.
3. Click **Start Stream**.
4. Publish a message via rpk or Studio Publish tab.

**Expected:**
- [ ] Stream starts without errors on the TLS-encrypted connection
- [ ] Messages appear in real-time
- [ ] No TLS handshake errors in the browser console

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| Secure broker "Connection error" | Verify `docker compose up -d` in `docker/kafka/secure/`. Wait for init container: `docker logs redfireforge-redpanda-secure-init`. Check credentials match (username: `redfireforge-app`, password: `app-password`). |
| TLS broker unhealthy | Verify certs exist: `ls docker/kafka/tls/certs/`. Regenerate if needed: `cd docker/kafka/tls && ./generate-certs.sh && docker compose down -v && docker compose up -d`. |
| TLS "self-signed certificate" error | Set **Reject Unauthorized** to **unchecked** in cluster settings, or paste the CA cert PEM (`docker/kafka/tls/certs/ca.crt`) into the CA Certificate field. |
| Port conflict on 19094 | The Schema Registry profile uses 19094. TLS uses 19095 to avoid conflicts. Both can run simultaneously. |
| Stream shows 0 messages | Ensure the topic has messages. Publish a message from the Publish tab first. Check that the cluster is connected. |
| Stream stops unexpectedly | Check if the cluster was disconnected. Stream auto-stops on disconnect. Reconnect and restart the stream. |
| Workflow FAIL on secure/TLS | The workflow's `clusterId` must match the connected cluster. Secure workflows use `local-secure`, TLS workflows use `local-tls`. Verify the correct cluster is connected before running. |
| `rpk` fails with SASL on secure broker | Inside the container, use internal port: `-X brokers=localhost:9092`. From host, use external port: `-X brokers=localhost:19093`. |
| Can't import cluster config | Use **↑ Import** button on the Kafka Settings page. The file must have `{ version: 1, clusters: [...] }` format. |

---

## File Reference

### Cluster Config Import
- `docs/test-data/kafka-clusters-import.json` — Pre-built cluster config (Plaintext, Secure, TLS)

### Secure Workflow JSONs (SASL/SCRAM, clusterId: `local-secure`)
| File | Scenario |
|---|---|
| `docs/test-data/secure/kafka-workflow-scenario-01-produce-consume-secure.json` | Produce → Consume |
| `docs/test-data/secure/kafka-workflow-scenario-02-trigger-http-produce-secure.json` | Trigger → HTTP → Produce |
| `docs/test-data/secure/kafka-workflow-scenario-03-produce-wait-correlation-secure.json` | Produce → Wait (Correlation) |
| `docs/test-data/secure/kafka-workflow-scenario-04-schema-registry-produce-secure.json` | Schema Registry Produce |
| `docs/test-data/secure/kafka-workflow-scenario-05-full-event-pipeline-secure.json` | Full Event-Driven Pipeline |
| `docs/test-data/secure/kafka-workflow-scenario-06-header-passthrough-secure.json` | Header Pass-Through |

### TLS Workflow JSONs (TLS+SASL, clusterId: `local-tls`)
| File | Scenario |
|---|---|
| `docs/test-data/tls/kafka-workflow-scenario-01-produce-consume-tls.json` | Produce → Consume |
| `docs/test-data/tls/kafka-workflow-scenario-02-trigger-http-produce-tls.json` | Trigger → HTTP → Produce |
| `docs/test-data/tls/kafka-workflow-scenario-03-produce-wait-correlation-tls.json` | Produce → Wait (Correlation) |
| `docs/test-data/tls/kafka-workflow-scenario-04-schema-registry-produce-tls.json` | Schema Registry Produce |
| `docs/test-data/tls/kafka-workflow-scenario-05-full-event-pipeline-tls.json` | Full Event-Driven Pipeline |
| `docs/test-data/tls/kafka-workflow-scenario-06-header-passthrough-tls.json` | Header Pass-Through |

### Docker Profiles
| Directory | Port | Auth | TLS |
|---|---|---|---|
| `docker/kafka/plaintext/` | 19092 | None | No |
| `docker/kafka/secure/` | 19093 | SCRAM-SHA-256 | No |
| `docker/kafka/tls/` | 19095 | SCRAM-SHA-256 | Yes (self-signed) |
| `docker/kafka/schema-registry/` | 19094 | None | No |

### Scripts
| Script | Purpose |
|---|---|
| `docker/kafka/tls/generate-certs.sh` | Generate self-signed CA + broker TLS certificates |
| `docker/kafka/tls/smoke-test.sh` | Automated TLS smoke test (T1–T3) |
| `docker/kafka/secure/smoke-test.sh` | Automated SASL/SCRAM smoke test (S1–S6) |

---

## Integration Test Plan Cross-Reference

| Integration Test | Scenarios |
|---|---|
| Secure Workflow (SASL/SCRAM) | SW-01, SW-02, SW-03, SW-04 |
| Secure Cluster Connection | SW-05 |
| Secure Kafka Studio E2E | SW-06 |
| TLS Workflow (TLS+SASL) | TW-01, TW-02, TW-03 |
| TLS Cluster Connection | TW-04, TW-05 |
| TLS Smoke Test | TW-06 |
| Kafka Studio Stream UI | SM-01 |
| Kafka Studio Stream Live | SM-02, SM-03 |
| Kafka Studio Stream Lifecycle | SM-04 |
| Kafka Studio Stream Filters | SM-05 |
| Kafka Studio Stream Secure | SM-06, SM-07 |
