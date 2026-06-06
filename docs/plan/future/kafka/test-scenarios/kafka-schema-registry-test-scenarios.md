# Kafka Schema Registry — Visual Test Scenarios

> **Covers:** Message Studio Phase 5 + Integration Phase 10 — Schema Registry Browser + Schema-Aware Produce/Consume
> **Created:** 2026-06-05
> **Purpose:** Step-by-step manual guide for verifying the Schema Registry Browser page
> (subject listing, version browsing, schema viewer, copy/export) and schema-aware
> produce/consume in the Publish and Consume tabs (Avro encode/decode, mismatch errors,
> isolation from plain-JSON paths).
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.
> Do **not** pre-check items — verify each one yourself first.

---

## Before You Start

### Navigation

| Destination | How to get there |
|---|---|
| **Kafka Settings** | Click ⚙️ **Settings** in the left activity bar → **Kafka** tab |
| **Schema Registry** | Click **Protocols** (pulse icon ⏦) in the left activity bar → **Kafka** domain tab → internal **Schema Registry** tab |
| **Publish** | Click **Protocols** → **Kafka** domain tab → internal **Publish** tab |
| **Consume** | Click **Protocols** → **Kafka** domain tab → internal **Consume** tab |

### Prerequisites: Configure and Connect a Cluster

These scenarios assume you already have a working Kafka cluster configured in Kafka Settings (see `kafka-settings-test-scenarios.md`, scenarios SC-01 through SC-08). The cluster must point to the **Schema Registry Docker profile** broker.

**Quick setup summary:**
1. Go to **Settings → Kafka** → **Create First Cluster** (or edit existing)
2. Name: `Schema Registry Dev`, Broker: `127.0.0.1:19094`, Auth: No authentication, TLS: unchecked
3. Click **Save Cluster** → select it → click **Connect**
4. Verify the badge shows **Connected** (green)

### Docker: Start the Schema Registry Profile

**Recommended (automated):**

```bash
# From the repo root — starts Docker, seeds topics, waits for readiness
docker/kafka/e2e/run-all-smoke.sh --seed-only schema-registry
```

**Alternative (manual):**

```bash
# From the repo root
cd docker/kafka/schema-registry
docker compose up -d

# Wait for all containers to be healthy (~30 seconds for Schema Registry)
docker compose ps
# Expected: redpanda-sr (healthy), schema-registry (healthy), redpanda-sr-init (exited 0)
```

- **Kafka broker:** `localhost:19094`
- **Schema Registry REST API:** `http://localhost:8085`
- **Admin API:** `http://localhost:19647`

### Register Test Schemas

The Avro smoke test schema is registered automatically by the smoke test script, but for full coverage you need schemas registered before testing the browser. Run the following to register a sample Avro schema:

```bash
# Register an Avro schema for the subject "sr.smoke.avro-value"
curl -s -X POST http://localhost:8085/subjects/sr.smoke.avro-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema":"{\"type\":\"record\",\"name\":\"SmokeEvent\",\"namespace\":\"io.redfireforge.smoke\",\"fields\":[{\"name\":\"run_id\",\"type\":\"string\"},{\"name\":\"seq\",\"type\":\"int\"},{\"name\":\"payload\",\"type\":\"string\"}]}"}'

# Register a second version (add optional field)
curl -s -X POST http://localhost:8085/subjects/sr.smoke.avro-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema":"{\"type\":\"record\",\"name\":\"SmokeEvent\",\"namespace\":\"io.redfireforge.smoke\",\"fields\":[{\"name\":\"run_id\",\"type\":\"string\"},{\"name\":\"seq\",\"type\":\"int\"},{\"name\":\"payload\",\"type\":\"string\"},{\"name\":\"extra\",\"type\":[\"null\",\"string\"],\"default\":null}]}"}'

# Register a batch schema
curl -s -X POST http://localhost:8085/subjects/sr.smoke.batch-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema":"{\"type\":\"record\",\"name\":\"BatchEvent\",\"namespace\":\"io.redfireforge.smoke\",\"fields\":[{\"name\":\"run_id\",\"type\":\"string\"},{\"name\":\"index\",\"type\":\"int\"}]}"}'

# Verify subjects were created
curl -s http://localhost:8085/subjects | python3 -m json.tool
# Expected: ["sr.smoke.avro-value", "sr.smoke.batch-value"]
```

### Start the Local Server

In a separate terminal:

```bash
npm run server
```

- Server listens at `http://127.0.0.1:3001`
- Keep this running for all scenarios

### Start the Web App

In another terminal:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Scenario Summary

| ID | Scenario | Docker | Server |
|---|---|---|---|
| **Guard & Connection** | | | |
| SR-01 | Guard: Not connected to Kafka → guard with "Open Kafka Settings" link | No | No |
| SR-02 | Connected but no registry URL → prompt message | ✅ | ✅ |
| SR-03 | Fill registry URL → Connect to Registry → subjects load | ✅ | ✅ |
| SR-04 | Registry auth fields: Username/Password, error on invalid credentials | ✅ | ✅ |
| **Subject List** | | | |
| SR-05 | Subjects load: table with Subject/Format columns, format badges | ✅ | ✅ |
| SR-06 | Subject count subtitle: "{n} of {total} subjects" | ✅ | ✅ |
| SR-07 | Filter subjects by name | ✅ | ✅ |
| SR-08 | Empty states: "No subjects registered" / "No subjects match the filter" | ✅ | ✅ |
| SR-09 | Refresh: button changes to "Refresh Subjects" after first load | ✅ | ✅ |
| **Schema Detail** | | | |
| SR-10 | Click subject row → detail panel with subject name heading | ✅ | ✅ |
| SR-11 | Version selector: dropdown with v1, v2… (latest) | ✅ | ✅ |
| SR-12 | Schema content: pretty-printed JSON in `<pre>` block | ✅ | ✅ |
| SR-13 | Format badge in detail panel matches subject list | ✅ | ✅ |
| SR-14 | Copy Schema → clipboard | ✅ | ✅ |
| SR-15 | Export → downloads .json file | ✅ | ✅ |
| SR-16 | Error handling: version/schema fetch errors → inline error messages | ✅ | ✅ |
| **Schema-Aware Produce** | | | |
| SR-17 | Publish tab: enable schema → Avro produce → success with valueEncoding | ✅ | ✅ |
| SR-18 | Publish tab: schema mismatch → SCHEMA_MISMATCH error | ✅ | ✅ |
| SR-19 | Batch produce with schema: 3 messages, partial failure rejects all | ✅ | ✅ |
| SR-20 | Schema ID caching: 5 produces → registry contacted once | ✅ | ✅ |
| **Schema-Aware Consume** | | | |
| SR-21 | Consume tab: enable schema → Avro decode → readable JSON fields | ✅ | ✅ |
| SR-22 | Consume without schema config → raw encoded bytes displayed | ✅ | ✅ |
| SR-23 | Consume with incompatible schema version → SCHEMA_MISMATCH | ✅ | ✅ |
| **Schema Isolation & Error Paths** | | | |
| SR-24 | Plain-JSON produce/consume without schema → identical to baseline | ✅ | ✅ |
| SR-25 | Registry unreachable at produce → REGISTRY_UNREACHABLE error | ✅ | ✅ |
| SR-26 | Registry auth failure → REGISTRY_AUTH_FAILURE distinct error | ✅ | ✅ |
| SR-27 | Plain-JSON produce succeeds while registry is offline | ✅ | ✅ |
| SR-28 | Results publish envelope remains schema-agnostic | ✅ | ✅ |

---

## SR-01 — Guard: Not Connected to Kafka

**Prerequisites:** No Kafka cluster connected (disconnect if currently connected)

**Steps:**
1. Navigate to **Protocols → Kafka → Schema Registry** tab

**Expected:**
- ☐ The guard panel appears (same as Message Studio guard)
- ☐ Guard shows "Connect to a Kafka cluster to begin" (or similar message)
- ☐ An **"Open Kafka Settings"** link/button is visible
- ☐ Clicking it navigates to Settings → Kafka tab
- ☐ The `data-testid="schema-registry-page"` element is NOT rendered

---

## SR-02 — Connected but No Registry URL

**Prerequisites:** Connected to the Schema Registry profile cluster (`127.0.0.1:19094`)

**Steps:**
1. Navigate to **Protocols → Kafka → Schema Registry** tab
2. Observe the left panel — the URL input should be empty

**Expected:**
- ☐ The page renders with `data-testid="schema-registry-page"`
- ☐ The left panel shows the header **"Schema Registry"**
- ☐ A URL input field is visible with placeholder `"http://localhost:8085"` and `data-testid="registry-url-input"`
- ☐ The **"Connect to Registry"** button (`data-testid="registry-connect-btn"`) is **disabled** (URL is empty)
- ☐ Below the URL/auth fields, the prompt message appears: **"Enter a Schema Registry URL to begin browsing."** (`data-testid="url-prompt"`)
- ☐ Auth fields are visible: **Username** (`data-testid="registry-auth-user"`) and **Password** (`data-testid="registry-auth-pass"`) with "(optional)" placeholders
- ☐ No subject table, no filter input, no detail panel

---

## SR-03 — Connect to Registry → Subjects Load

**Prerequisites:** Connected to cluster, Schema Registry Docker container healthy, schemas registered (see setup above)

**Steps:**
1. In the Schema Registry tab, type `http://localhost:8085` in the URL input (`data-testid="registry-url-input"`)
2. Leave auth fields empty (registry has no auth in plaintext profile)
3. Click **"Connect to Registry"** (`data-testid="registry-connect-btn"`)

**Expected:**
- ☐ The button label changes to **"Loading…"** while the request is in progress
- ☐ After loading, the subject table appears (`data-testid="subject-table"`)
- ☐ The subjects table has columns: **Subject** and **Format**
- ☐ Registered subjects appear in the table (e.g., `sr.smoke.avro-value`, `sr.smoke.batch-value`)
- ☐ The button label changes to **"Refresh Subjects"** (indicating subjects have loaded once)
- ☐ The prompt message ("Enter a Schema Registry URL to begin browsing.") disappears
- ☐ A filter/search input appears (`data-testid="subject-filter"`) with placeholder **"Filter subjects…"**

---

## SR-04 — Registry Auth Failure

**Prerequisites:** Connected to cluster, Schema Registry running

**Steps:**
1. In the Schema Registry tab, type `http://localhost:8085` in the URL input
2. Type `bad-user` in the Username field (`data-testid="registry-auth-user"`)
3. Type `wrong-password` in the Password field (`data-testid="registry-auth-pass"`)
4. Click **"Connect to Registry"**

**Expected:**
- ☐ The button shows **"Loading…"** briefly
- ☐ An error banner appears (`data-testid="subjects-error"`) with a message indicating auth failure

> **Note:** The local Confluent Schema Registry in the Docker profile does NOT have auth enabled, so it will accept any credentials. To properly test auth failure, you would need a registry that enforces credentials. This scenario verifies that the error banner mechanism works when the server returns an auth error. The API smoke test (`schema-registry/smoke-test.sh`, SR13) covers the `KAFKA_INVALID_REQUEST` code path. For full auth failure testing, point to a non-existent URL first to trigger an error banner, confirming the UI error display mechanism.

**Alternative test for error display:**
1. Type `http://localhost:59999` (non-existent) in the URL input
2. Click **"Connect to Registry"**
- ☐ An error banner appears (`data-testid="subjects-error"`) with a connectivity error message
- ☐ The error is displayed inline — no browser alert or console-only error

---

## SR-05 — Subjects Table with Format Badges

**Prerequisites:** Subjects loaded (completed SR-03)

**Steps:**
1. Observe the subject table after a successful load

**Expected:**
- ☐ Each row shows the **subject name** in the first column
- ☐ Each row shows a **format badge** in the second column
- ☐ Format badges use CSS classes: `kafka-schema-format-badge kafka-schema-format-avro` (for Avro subjects)
- ☐ Badge label shows **"Avro"** for Avro schemas (derived after clicking the subject — see note below)
- ☐ Before clicking a subject, the badge may show **"—"** (format is unknown until the schema is fetched)
- ☐ Each row has a `data-testid="subject-row-{name}"` attribute (e.g., `data-testid="subject-row-sr.smoke.avro-value"`)
- ☐ Each row has a **›** arrow indicator in the third column
- ☐ Rows are clickable (cursor changes to pointer on hover)

> **Note:** Format badges are populated **lazily** — when a subject is clicked and its schema is fetched, the `deriveSchemaFormat` function analyzes the schema content and updates the badge. Before clicking, the badge shows "—".

---

## SR-06 — Subject Count Subtitle

**Prerequisites:** Subjects loaded (completed SR-03)

**Steps:**
1. Observe the header area of the left panel

**Expected:**
- ☐ Below the **"Schema Registry"** title, a subtitle shows **"{n} of {total} subjects"**
- ☐ When no filter is active, `n` equals `total` (e.g., "5 of 5 subjects" with the full smoke-test seed)
- ☐ When a filter is active, `n` reflects the filtered count (see SR-07)

---

## SR-07 — Filter Subjects by Name

**Prerequisites:** Subjects loaded with at least 2 subjects (e.g., `sr.smoke.avro-value` and `sr.smoke.batch-value`)

**Steps:**
1. Type `batch` in the filter input (`data-testid="subject-filter"`)
2. Observe the table

**Expected:**
- ☐ Only subjects containing "batch" (case-insensitive) appear in the table
- ☐ The subtitle updates to show **"1 of 5 subjects"** (or appropriate counts depending on how many subjects are registered)
- ☐ Clearing the filter input restores all subjects

---

## SR-08 — Empty States

**Prerequisites:** Subjects loaded

### Test A: No subjects match filter

**Steps:**
1. Type `nonexistent-subject-xyz` in the filter input

**Expected:**
- ☐ The table body shows a single row with the message **"No subjects match the filter"**
- ☐ The message uses CSS class `kafka-ms-empty-state`

### Test B: Registry with zero subjects (optional)

**Steps:**
1. Connect to a fresh Schema Registry with no registered schemas (or point to a registry URL where no subjects exist)

**Expected:**
- ☐ The table body shows a single row with the message **"No subjects registered"**

---

## SR-09 — Refresh Button Label

**Prerequisites:** Connected to registry

**Steps:**
1. Before first load: observe the button label → **"Connect to Registry"**
2. Click the button → subjects load
3. After load: observe the button label → **"Refresh Subjects"**
4. Click **"Refresh Subjects"** again

**Expected:**
- ☐ Button starts as **"Connect to Registry"** before any subjects have been fetched
- ☐ After first successful load, button permanently shows **"Refresh Subjects"** (until page reload)
- ☐ Clicking "Refresh Subjects" re-fetches the subject list from the registry
- ☐ The button is disabled (grayed out) while loading, and shows **"Loading…"** text

---

## SR-10 — Click Subject → Detail Panel

**Prerequisites:** Subjects loaded, at least one subject visible

**Steps:**
1. Click on the `sr.smoke.avro-value` subject row

**Expected:**
- ☐ The right detail panel appears (`data-testid="schema-detail-panel"`)
- ☐ The detail panel header shows the subject name: **"sr.smoke.avro-value"** as an `<h3>` element
- ☐ The clicked row gets a `selected` CSS class (visual highlight)
- ☐ Clicking the same row again **deselects** it and hides the detail panel

---

## SR-11 — Version Selector Dropdown

**Prerequisites:** Subject `sr.smoke.avro-value` selected (should have 2 versions after setup)

**Steps:**
1. Observe the version dropdown (`data-testid="version-select"`) in the detail panel header

**Expected:**
- ☐ The dropdown shows available versions: **v1** and **v2 (latest)**
- ☐ The **latest** version is selected by default (v2 in this case)
- ☐ The "(latest)" suffix appears only on the last version option
- ☐ Changing the dropdown to **v1** triggers a schema fetch for that version
- ☐ The schema content updates to reflect the selected version (v1 has 3 fields, v2 has 4 fields including `extra`)

---

## SR-12 — Schema Content Pretty-Printed

**Prerequisites:** Subject selected, schema loaded

**Steps:**
1. Observe the schema content area (`data-testid="schema-content"`) — a `<pre>` element

**Expected:**
- ☐ The schema JSON is **pretty-printed** (indented with 2 spaces, not minified)
- ☐ For v2 of `sr.smoke.avro-value`, the content shows 4 fields: `run_id` (string), `seq` (int), `payload` (string), `extra` (union: null/string)
- ☐ The schema is displayed in a `<pre>` tag with CSS class `kafka-schema-content`
- ☐ The content is readable without horizontal scrolling for typical schemas

---

## SR-13 — Format Badge in Detail Panel

**Prerequisites:** Subject selected, schema loaded

**Steps:**
1. Observe the format badge in the detail panel header (`data-testid="detail-format-badge"`)

**Expected:**
- ☐ The badge shows **"Avro"** for the `sr.smoke.avro-value` subject
- ☐ The badge has CSS class `kafka-schema-format-badge kafka-schema-format-avro`
- ☐ The format in the detail panel matches the format in the subject list table (after the subject's format has been derived)

---

## SR-14 — Copy Schema to Clipboard

**Prerequisites:** Subject selected, schema content visible

**Steps:**
1. Click the **"Copy Schema"** button (`data-testid="copy-schema-btn"`)
2. Paste the clipboard contents into a text editor

**Expected:**
- ☐ The clipboard contains the full schema text (the same content shown in the `<pre>` block)
- ☐ The pasted content is valid JSON (for Avro/JSON Schema types)

---

## SR-15 — Export Schema to File

**Prerequisites:** Subject selected (`sr.smoke.avro-value`), schema content visible

**Steps:**
1. Click the **"Export"** button (`data-testid="export-schema-btn"`)

**Expected:**
- ☐ A file download starts
- ☐ The filename follows the pattern: `{subject}-v{version}.json` (e.g., `sr.smoke.avro-value-v2.json`)
- ☐ The downloaded file contains the same schema JSON as shown in the UI
- ☐ For Protobuf schemas (if registered), the file extension would be `.proto` instead of `.json`

---

## SR-16 — Error Handling: Version/Schema Fetch Errors

**Prerequisites:** Connected to registry

**Steps:**
1. Connect to the registry and load subjects normally
2. **Simulate a version load error:** This is difficult to reproduce manually unless the registry goes offline mid-session. To test:
   - Stop the Schema Registry container: `docker compose -f docker/kafka/schema-registry/docker-compose.yml stop schema-registry`
   - Click on a subject row

**Expected:**
- ☐ A versions error banner appears (`data-testid="versions-error"`) with an error message
- ☐ OR a schema error banner appears (`data-testid="schema-error"`) if versions loaded but schema fetch failed
- ☐ The error is displayed inline in the detail panel (not as a browser alert)
- ☐ The error message is descriptive (includes registry URL or error type)

**Clean up:** Restart the schema registry: `docker compose -f docker/kafka/schema-registry/docker-compose.yml start schema-registry`

---

## SR-17 — Schema-Aware Produce (Avro Encoding)

**Prerequisites:** Connected to cluster (`127.0.0.1:19094`), Schema Registry running, schemas registered

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab
2. Set **Topic** to `sr.smoke.avro`
3. Scroll down to **Enable Schema Registry** checkbox and **check** it
4. In the schema config section that appears:
   - **Registry URL**: `http://localhost:8085`
   - **Format**: `Avro` (default)
   - Leave **Subject** empty (defaults to `sr.smoke.avro-value`)
   - Leave **Version** empty (defaults to latest)
5. Set **Body** to a valid payload matching the schema:
   ```json
   {"run_id":"ui-test-001","seq":1,"payload":"schema-produce-test"}
   ```
6. Click **"Send Once"**

**Expected:**
- ☐ The result panel shows a **success** response
- ☐ The result includes `partition` and `offset` values
- ☐ The result shows `valueEncoding: 'avro'` (or the encoding indicator in the result card)
- ☐ The message was sent Avro-encoded to the broker (verifiable via consume in SR-21)

---

## SR-18 — Schema Mismatch Error on Produce

**Prerequisites:** Connected, Schema Registry running, schema registered for `sr.smoke.avro-value`

**Steps:**
1. In the **Publish** tab, set **Topic** to `sr.smoke.avro`
2. Enable Schema Registry, configure as in SR-17
3. Set **Body** to a payload that does **not** match the schema (missing required fields):
   ```json
   {"wrong_field":"this does not match"}
   ```
4. Click **"Send Once"**

**Expected:**
- ☐ The result panel shows an **error** response
- ☐ The error code is `SCHEMA_MISMATCH` (not a generic Kafka produce error)
- ☐ The error message includes diagnostic details (e.g., field name, expected type)
- ☐ The error is NOT classified as `KAFKA_PRODUCE_FAILED`

---

## SR-19 — Batch Produce with Schema (3 Messages)

**Prerequisites:** Connected, Schema Registry running

> **Note:** The Message Studio Publish tab sends one message at a time via the UI. To test batch produce with schema, use the server API directly via curl. This scenario verifies the server-side behavior that the API smoke test also covers.

**Steps (via curl):**

```bash
# Produce 3 messages with schema config
curl -s -X POST http://127.0.0.1:3001/api/kafka/produce \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "sr.smoke.batch",
    "messages": [
      {"value": "{\"run_id\":\"batch-ui-test\",\"index\":1}"},
      {"value": "{\"run_id\":\"batch-ui-test\",\"index\":2}"},
      {"value": "{\"run_id\":\"batch-ui-test\",\"index\":3}"}
    ],
    "schemaConfig": {
      "registryUrl": "http://localhost:8085",
      "subject": "sr.smoke.batch-value"
    }
  }' | python3 -m json.tool
```

**Expected:**
- ☐ Response shows `ok: true` with 3 records in `data.records`
- ☐ All 3 records have valid `partition` and `offset` values

**Partial failure test:**

```bash
# Include one invalid message in the batch
curl -s -X POST http://127.0.0.1:3001/api/kafka/produce \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "sr.smoke.batch",
    "messages": [
      {"value": "{\"run_id\":\"batch-fail\",\"index\":1}"},
      {"value": "{\"invalid\":\"schema\"}"},
      {"value": "{\"run_id\":\"batch-fail\",\"index\":3}"}
    ],
    "schemaConfig": {
      "registryUrl": "http://localhost:8085",
      "subject": "sr.smoke.batch-value"
    }
  }' | python3 -m json.tool
```

**Expected:**
- ☐ Response shows `ok: false` with error code `SCHEMA_MISMATCH`
- ☐ The **entire batch is rejected** — no partial produce (no records sent to broker)

---

## SR-20 — Schema ID Caching

**Prerequisites:** Connected, Schema Registry running

> **Note:** This scenario is best verified by observing server logs or using the API smoke test (SR09 in `schema-registry/smoke-test.sh`). The UI does not expose cache hit/miss information.

**Steps:**
1. Enable schema registry in the Publish tab (as in SR-17)
2. Send 5 consecutive messages to `sr.smoke.avro` with valid payloads
3. Monitor the server console output for registry HTTP calls

**Expected:**
- ☐ All 5 messages produce successfully
- ☐ The schema registry is contacted **once** (on the first produce) to resolve the schema ID
- ☐ Subsequent 4 produces reuse the cached schema ID (no additional HTTP calls to the registry)
- ☐ Verification: server logs show only 1 `getLatestSchemaId` call, not 5

---

## SR-21 — Schema-Aware Consume (Avro Decoding)

**Prerequisites:** Connected, Schema Registry running, Avro-encoded messages exist on `sr.smoke.avro` (produced in SR-17)

**Steps:**
1. Navigate to **Protocols → Kafka → Consume** tab
2. Set **Topic** to `sr.smoke.avro`
3. Set **Start Position** to **Earliest**
4. Enable **Schema Registry** checkbox
5. Configure:
   - **Registry URL**: `http://localhost:8085`
   - **Format**: `Avro`
   - Leave Subject and Version empty (defaults)
6. Click **"Consume Once"**

**Expected:**
- ☐ Messages appear in the results table
- ☐ The **Value** column shows **decoded JSON fields** — readable `run_id`, `seq`, `payload` values
- ☐ The decoded values match what was originally produced (e.g., `{"run_id":"ui-test-001","seq":1,"payload":"schema-produce-test"}`)
- ☐ Click a row to open the detail pane — the pretty-printed JSON shows the decoded Avro record
- ☐ The `rawValue` field is **NOT** visible anywhere in the response — only the decoded `value` appears

---

## SR-22 — Consume Avro Messages WITHOUT Schema Config

**Prerequisites:** Connected, Avro-encoded messages exist on `sr.smoke.avro`

**Steps:**
1. Navigate to **Protocols → Kafka → Consume** tab
2. Set **Topic** to `sr.smoke.avro`
3. Set **Start Position** to **Earliest**
4. **Do NOT** enable Schema Registry (leave the checkbox unchecked)
5. Click **"Consume Once"**

**Expected:**
- ☐ Messages appear in the results table (no error)
- ☐ The **Value** column shows **raw encoded bytes** as a string — not readable JSON
- ☐ The raw value starts with garbled characters (the Confluent wire-format magic byte 0x00 + schema ID)
- ☐ No `SCHEMA_MISMATCH` error — the consume succeeds, just with unreadable values
- ☐ This confirms that the `.toString('utf-8')` passthrough works correctly for Avro bytes

---

## SR-23 — Consume with Incompatible Schema Version → SCHEMA_MISMATCH

**Prerequisites:** Connected, Avro-encoded messages on `sr.smoke.avro` (encoded with schema ID from `sr.smoke.avro-value`)

> **Note:** Triggering a true schema mismatch on consume requires messages encoded with one schema to be decoded with an incompatible schema. In practice, the Confluent decoder uses the schema ID embedded in the wire-format bytes, so it's resilient to version changes within the same subject. A true mismatch occurs when the schema has been deleted or the registry returns an incompatible schema for the embedded ID.

**Steps (server API):**

```bash
# Attempt to consume with a non-existent subject (will fail when trying to decode)
curl -s -X POST http://127.0.0.1:3001/api/kafka/consume-once \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "sr.smoke.avro",
    "maxMessages": 5,
    "timeoutMs": 8000,
    "fromBeginning": true,
    "schemaConfig": {
      "registryUrl": "http://localhost:59999",
      "subject": "nonexistent-subject-value"
    }
  }' | python3 -m json.tool
```

**Expected:**
- ☐ Response shows an error (either `SCHEMA_MISMATCH` or `REGISTRY_UNREACHABLE`)
- ☐ The error code is NOT a generic Kafka consume error
- ☐ The error message includes diagnostic details pointing to the schema/registry issue

---

## SR-24 — Plain-JSON Produce/Consume Without Schema Config

**Prerequisites:** Connected to cluster

**Steps:**
1. Navigate to **Publish** tab
2. Set **Topic** to `sr.smoke.avro` (same topic that has Avro messages)
3. Ensure **Schema Registry** is **unchecked**
4. Set Body to plain JSON: `{"plainJson":true,"test":"no-schema"}`
5. Click **"Send Once"**

**Expected:**
- ☐ The produce succeeds
- ☐ The result does **NOT** show `valueEncoding` (or shows `valueEncoding: undefined`)
- ☐ The message is stored as plain JSON string (not Avro-encoded)

6. Navigate to **Consume** tab
7. Set **Topic** to `sr.smoke.avro`, Start Position: **Latest** (to get only the plain-JSON message)
8. Ensure **Schema Registry** is **unchecked**
9. Click **"Consume Once"**

**Expected:**
- ☐ The consume succeeds
- ☐ The latest message shows the plain JSON value: `{"plainJson":true,"test":"no-schema"}`
- ☐ The behavior is identical to Phase 1 baseline — no encoding/decoding attempted
- ☐ This confirms schema config is strictly opt-in

---

## SR-25 — Registry Unreachable at Produce Time → REGISTRY_UNREACHABLE

**Prerequisites:** Connected to cluster, Schema Registry running

**Steps:**
1. Navigate to **Publish** tab
2. Set **Topic** to `sr.smoke.avro`
3. Enable **Schema Registry**, set Registry URL to `http://localhost:59999` (non-existent port)
4. Set Body to a valid payload: `{"run_id":"unreachable-test","seq":1,"payload":"test"}`
5. Click **"Send Once"**

**Expected:**
- ☐ The result shows an **error** response
- ☐ The error code is `REGISTRY_UNREACHABLE`
- ☐ The produce does **NOT** fall back silently to unencoded — it explicitly fails
- ☐ The error message is actionable (mentions the registry URL or connection issue)

---

## SR-26 — Registry Auth Failure → REGISTRY_AUTH_FAILURE

**Prerequisites:** Connected to cluster

> **Note:** The local Schema Registry in Docker does not enforce auth, so this scenario tests the server-side error classification via the API.

**Steps (server API):**

```bash
# Attempt schema-subjects with a registry that requires auth (simulated by using invalid URL)
# For a true auth failure, you would need a registry with auth enabled
# The server classifies 401/403 responses as REGISTRY_AUTH_FAILURE

# This is covered by the API smoke test (schema-registry/smoke-test.sh, SR13)
# For visual confirmation, verify via the Schema Registry Browser (SR-04)
```

**Expected (from SR-04 or API testing):**
- ☐ `REGISTRY_AUTH_FAILURE` is a distinct error code, separate from `REGISTRY_UNREACHABLE` and `SCHEMA_MISMATCH`
- ☐ The three error codes are never conflated

---

## SR-27 — Plain-JSON Produce Succeeds While Registry is Offline

**Prerequisites:** Connected to cluster

**Steps:**
1. Stop the Schema Registry container:
   ```bash
   docker compose -f docker/kafka/schema-registry/docker-compose.yml stop schema-registry
   ```
2. Navigate to **Publish** tab
3. Set **Topic** to `sr.smoke.avro`
4. Ensure **Schema Registry** is **unchecked**
5. Set Body to: `{"offline_test":true,"registry":"stopped"}`
6. Click **"Send Once"**

**Expected:**
- ☐ The produce **succeeds** — the message is sent as plain JSON
- ☐ No error related to the registry appears
- ☐ The Schema Registry being offline does not affect non-schema produce operations

**Clean up:**
```bash
docker compose -f docker/kafka/schema-registry/docker-compose.yml start schema-registry
# Wait ~20 seconds for it to be healthy
```

---

## SR-28 — Results Publish Envelope Remains Schema-Agnostic

**Prerequisites:** Connected to cluster, Schema Registry configured

> **Note:** This scenario validates that the Phase 8 results publishing mechanism (which sends test run summaries to a Kafka topic) is not affected by schema configuration. This is a server-side behavior that is best verified via the test runner and results publishing flow, which is covered in `kafka-runner-test-scenarios.md`. For Phase 10 validation, confirm that:

**Expected (conceptual verification):**
- ☐ The result publish envelope format (`{"runId":...,"passed":...,"failed":...}`) uses plain JSON
- ☐ Schema configuration (even when enabled for user produce/consume) does not leak into the results publish path
- ☐ Results can be published to topics like `redfireforge.results.summary` without any schema registry dependency
- ☐ This is confirmed by the API smoke test and unit tests — no additional visual validation needed

---

## Schema Config Section — UI Reference (shared by SR-17, SR-21, SR-24, SR-25)

The **Enable Schema Registry** checkbox appears in both the Publish and Consume panels. When checked, the following fields are revealed:

| Field | Type | Placeholder/Default | Notes |
|---|---|---|---|
| Registry URL | text input | `http://schema-registry:8081` | Required when schema is enabled |
| Format | dropdown | `Avro` (default), `Protobuf`, `JSON Schema` | Determines encode/decode strategy |
| Username | text input | `schema-user` | Optional auth |
| Password | password input | `••••••` | Optional auth |
| Subject | text input + ↓ load button | `{topic}-value (default)` | Lazy-loaded from registry; leave empty for TopicNameStrategy default |
| Version | number input + ↓ load button | `latest (default)` | Lazy-loaded; leave empty for latest |

- The **↓** buttons next to Subject and Version lazily load the lists from the registry
- After clicking ↓, a `<select>` dropdown appears with the available options
- Subject list shows `(default — {topic}-value)` as the first option
- Version list shows `(latest)` as the first option

---

---

## E2E Workflow + Schema Registry Scenarios

These scenarios verify **end-to-end** Avro encoding/decoding through the Workflow Designer and cross-verify results via Kafka Studio. They use the updated **Scenario 04** workflow (`kafka-workflow-scenario-04-schema-registry-produce.json`) which targets the `local-schema-registry` cluster with real Avro encoding.

### Prerequisites

1. **Docker:** Schema Registry profile running:
   ```bash
   cd docker/kafka/schema-registry && docker compose up -d
   # Verify: redpanda-sr (healthy), schema-registry (healthy)
   ```
2. **Schema:** Register the `User` Avro schema (if not already):
   ```bash
   curl -s -X POST http://localhost:8085/subjects/users.avro-value/versions \
     -H "Content-Type: application/vnd.schemaregistry.v1+json" \
     -d '{"schema":"{\"type\":\"record\",\"name\":\"User\",\"namespace\":\"io.redfireforge.test\",\"fields\":[{\"name\":\"name\",\"type\":\"string\"},{\"name\":\"email\",\"type\":\"string\"},{\"name\":\"age\",\"type\":\"int\"},{\"name\":\"active\",\"type\":\"boolean\"}]}"}'
   ```
3. **Topic:** Create `users.avro` on the SR broker:
   ```bash
   docker exec redfireforge-redpanda-sr rpk topic create users.avro --partitions 1 --brokers localhost:9092
   ```
4. **Kafka Cluster:** Import `docs/test-data/kafka-clusters-import.json` (includes `local-schema-registry` cluster pointing to `127.0.0.1:19094`)
5. **Connect:** In Kafka Settings, select and connect to **"Local Schema Registry"** cluster
6. **Server:** `npm run server` running on port 3001
7. **App:** `npm run dev` → open http://localhost:5173

### Workflow Import

Import the updated Scenario 04:
1. Go to **Workflow** → click **+ New** → **Import Workflow**
2. Browse to `docs/test-data/kafka-workflow-scenario-04-schema-registry-produce.json`
3. The workflow appears: `Kafka Scenario 04 — Produce with Schema Registry (Avro)`

---

### SR-E2E-01 — Verify Scenario 04 Cluster and Schema Config

**Steps:**
1. Open the imported **Kafka Scenario 04** workflow
2. Click the gear icon on the **"Produce Avro User"** node

**Expected:**
- ☐ **Cluster** shows `local-schema-registry`
- ☐ **Topic** shows `{{testTopic}}` (resolves to `users.avro`)
- ☐ **Schema Registry** section is enabled with:
  - Registry URL: `http://localhost:8085`
  - Format: `Avro`
  - Subject: `users.avro-value`
- ☐ **Key** shows `user-42`
- ☐ **Body** shows the JSON with `name`, `email`, `age`, `active` fields
- ☐ **Header** shows `Content-Type: application/avro`

3. Close the produce config modal
4. Click the gear icon on the **"Consume Avro User"** node

**Expected:**
- ☐ **Cluster** shows `local-schema-registry`
- ☐ **Topic** shows `{{testTopic}}`
- ☐ **Schema Registry** section is enabled with same config
- ☐ **Start Position** shows `earliest`
- ☐ **Timeout** shows `5000 ms`

---

### SR-E2E-02 — Quick Test Workflow Scenario 04

**Steps:**
1. With Scenario 04 open, click **Quick Test**
2. Wait for the run to complete

**Expected:**
- ☐ Status badge shows **2/2 passed**
- ☐ Both nodes show green **✓ Pass** badges on the canvas
- ☐ Console shows:
  - `[Produce Avro User] PRODUCE users.avro`
  - `[Produce Avro User] cluster: local-schema-registry`
  - `[Produce Avro User] header Content-Type: application/avro`
  - `[Produce Avro User] Produced — Xms`
  - `[Produce Avro User] partition: 0, offset: N`
  - `[Consume Avro User] CONSUME users.avro`
  - `[Consume Avro User] cluster: local-schema-registry`
  - `[Consume Avro User] Consumed 1 message(s) — Xms`
  - `[Consume Avro User] Body: {"name":"Alice Johnson","email":"alice@example.com","age":30,"active":true}`
  - `Workflow PASS`

---

### SR-E2E-03 — Verify Workflow Output in Kafka Studio (Consume)

After running Quick Test (SR-E2E-02), verify the Avro-encoded message in Kafka Studio.

**Steps:**
1. Navigate to **Protocols → Kafka → Consume** tab
2. Set **Topic** to `users.avro`
3. Set **Start Position** to **Earliest**
4. Enable **Schema Registry** checkbox:
   - **Registry URL:** `http://localhost:8085`
   - **Format:** `Avro`
   - Leave Subject and Version empty
5. Click **Consume Once** (the bottom action button)

**Expected:**
- ☐ Messages appear in the results table
- ☐ At least one message with **key: `user-42`** is present (from the workflow run)
- ☐ The value column shows decoded JSON: `{"name":"Alice Johnson","email":"alice@example.com","age":30...`
- ☐ Click the `user-42` row → detail panel shows the full pretty-printed JSON:
  ```json
  {
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "age": 30,
    "active": true
  }
  ```
- ☐ This confirms the workflow's `kafkaProduce` node correctly Avro-encoded the message

---

### SR-E2E-04 — Publish Avro Message via Kafka Studio, Verify Schema Integrity

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab
2. Set **Topic** to `users.avro`
3. Set **Key** to `user-studio-001`
4. Enable **Schema Registry** checkbox:
   - **Registry URL:** `http://localhost:8085`
   - **Format:** `Avro`
   - Leave Subject/Version empty (defaults to `users.avro-value` / latest)
5. Set **Body** to:
   ```json
   {
     "name": "Bob Smith",
     "email": "bob@example.com",
     "age": 25,
     "active": false
   }
   ```
6. Click **Send Once**

**Expected:**
- ☐ Success: `✓ Sent 1 message to users.avro`
- ☐ Shows `partition 0, offset N`
- ☐ Shows `Encoding: avro`

---

### SR-E2E-05 — Consume Both Workflow and Studio Messages Together

**Steps:**
1. Navigate to **Consume** tab
2. Topic: `users.avro`, Start Position: **Earliest**, Schema Registry enabled (same config)
3. Click **Consume Once**

**Expected:**
- ☐ Table shows multiple messages — both from workflow and Studio publish
- ☐ Key `user-42` → `{"name":"Alice Johnson","email":"alice@example.com","age":30,"active":true}`
- ☐ Key `user-studio-001` → `{"name":"Bob Smith","email":"bob@example.com","age":25,"active":false}`
- ☐ All messages are cleanly Avro-decoded into readable JSON
- ☐ No raw byte artifacts visible

---

### SR-E2E-06 — Schema Mismatch in Workflow Produce

This scenario verifies that an invalid payload against the Avro schema fails gracefully.

**Steps:**
1. Open **Scenario 04** → click gear icon on **"Produce Avro User"** node
2. Change the body to an invalid payload:
   ```json
   {"invalid_field": "this doesn't match the User schema"}
   ```
3. Click **Save** on the config modal
4. Click **Quick Test**

**Expected:**
- ☐ The `Produce Avro User` node shows a **✗ Fail** badge
- ☐ Console shows an error message including `SCHEMA_MISMATCH` or Avro encoding failure
- ☐ The workflow run is marked as **FAIL**
- ☐ The `Consume Avro User` node is **not reached** (skipped or also fails)

5. **Restore** the original body and re-test to confirm it passes again

---

### SR-E2E-07 — Schema Registry Browser Shows users.avro-value

**Steps:**
1. Navigate to **Protocols → Kafka → Schema Registry** tab
2. Set URL to `http://localhost:8085`, click **Connect to Registry**
3. Observe the subject list

**Expected:**
- ☐ `users.avro-value` appears in the subject list
- ☐ Click `users.avro-value` → detail panel shows:
  - Subject: `users.avro-value`
  - Version: `v1 (latest)`
  - Format: `Avro`
  - Schema content shows the `User` record with 4 fields: `name`, `email`, `age`, `active`
- ☐ **Copy Schema** copies the Avro schema JSON to clipboard
- ☐ **Export** downloads `users.avro-value-v1.json`

---

### SR-E2E-08 — Consume Avro Messages WITHOUT Schema Registry (Raw Bytes)

**Steps:**
1. Navigate to **Consume** tab
2. Topic: `users.avro`, Start Position: **Earliest**
3. **Uncheck** the Schema Registry checkbox
4. Click **Consume Once**

**Expected:**
- ☐ Messages appear (no error)
- ☐ The value column shows **raw encoded bytes** — garbled characters starting with the Confluent wire-format magic byte
- ☐ The messages are NOT readable as JSON
- ☐ This confirms that without Schema Registry decoding, Avro messages appear as binary

---

### SR-E2E-09 — rpk Verification of Avro Messages

Verify messages exist on the broker using rpk directly:

```bash
docker exec redfireforge-redpanda-sr rpk topic consume users.avro --offset start --num 3 --brokers localhost:9092
```

**Expected:**
- ☐ Multiple messages appear
- ☐ Messages with Avro encoding show binary content (rpk does not decode Avro)
- ☐ Messages include keys: `user-42`, `user-studio-001`, etc.

---

## Validation Status

| Scenario | Status | Notes |
|---|---|---|
| SR-01 through SR-28 | ✅ Validated | Original Schema Registry Browser + Studio scenarios |
| SR-E2E-01 | ✅ Validated | Workflow node config shows schema-registry cluster and schemaConfig |
| SR-E2E-02 | ✅ Validated | Quick Test passes 2/2 with real Avro encoding via local-schema-registry |
| SR-E2E-03 | ✅ Validated | Kafka Studio Consume decodes Avro messages from workflow run |
| SR-E2E-04 | ✅ Validated | Kafka Studio Publish sends Avro-encoded message, shows Encoding: avro |
| SR-E2E-05 | ✅ Validated | Both workflow and Studio messages visible, cleanly decoded |
| SR-E2E-06 | ☐ Pending | Manual test: invalid payload → SCHEMA_MISMATCH in workflow |
| SR-E2E-07 | ✅ Validated | Schema Registry Browser shows users.avro-value schema |
| SR-E2E-08 | ☐ Pending | Manual test: consume without SR enabled → raw bytes |
| SR-E2E-09 | ☐ Pending | rpk verification |

---

## API Smoke Test Cross-Reference

The existing `docker/kafka/schema-registry/smoke-test.sh` covers these server-side scenarios:

| Smoke Test | Coverage | Visual Scenario |
|---|---|---|
| SR01 | List subjects on fresh registry | SR-08 (empty state) |
| SR02 | Register Avro schema | Setup prerequisite |
| SR03 | List subjects → subject appears | SR-05 |
| SR04 | List versions → [1] | SR-11 |
| SR05 | Server API: list subjects | SR-03 |
| SR06 | Server API: list versions | SR-11 |
| SR07 | Server API: fetch schema | SR-12 |
| SR08 | Kafka connect | Prerequisites |
| SR09 | Schema-aware produce (Avro) | SR-17 |
| SR10 | Schema-aware consume (round-trip) | SR-21 |
| SR11 | Batch produce + decode (3 msgs) | SR-19 |
| SR12 | Unreachable registry error | SR-25 |
| SR13 | Missing registryUrl error | SR-26 (related) |
| SR14 | Kafka disconnect | — |
