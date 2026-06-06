# Kafka Test Scenarios Plan

> **Purpose:** Master plan for all Kafka visual test-scenarios MD files.
> **Created:** 2026-06-04
> **Updated:** 2026-06-05
> **Completed:** `kafka-settings-test-scenarios.md` (24), `kafka-message-studio-test-scenarios.md` (39), `kafka-topic-explorer-test-scenarios.md` (26), `kafka-schema-registry-test-scenarios.md` (37), `kafka-workflow-nodes-test-scenarios.md` (48), `kafka-secure-tls-stream-test-scenarios.md` (17), `kafka-runner-test-scenarios.md` (20) — **Total: 211 scenarios across 7 files**
> **In Progress:** None — all files complete except Tauri transport
> **Remaining:** 1 file (`kafka-tauri-transport-test-scenarios.md`, ~18 scenarios)
>
> **Source documents referenced:**
> - `integration-plan.md` — Phase definitions and scope (Phases 1–9 + optional Phase 10)
> - `integration-test-plan.md` — Detailed numbered scenarios (Scenario 1–15I), 50+ visual integration scenarios
> - `integration-tracker.md` — Implementation status and progress notes per phase
> - `kafka-message-studio-plan.md` — Message Studio phases (MS 1–5), success criteria, UI specifications
> - `kafka-settings-test-scenarios.md` — Already completed file covering Integration Phases 1–3 + Phase 9 Tauri settings parity (SC-21)
>
> Each file follows the same workflow:
> 1. Write the test-scenarios MD file with click-by-click instructions
> 2. Manually validate every scenario in the browser with Docker
> 3. Fix any bugs or issues found
> 4. Export test data where applicable
> 5. Re-import and validate from scratch
> 6. User validates independently using the MD file

---

## Status Summary

| # | File | Covers | Integration Test Plan Scenarios | Count | Status |
|---|---|---|---|---|---|
| ✅ | `kafka-settings-test-scenarios.md` | Integration Phases 1–3 + Phase 9 settings Tauri (SC-21) + SASL/SCRAM e2e (SC-23, SC-24) | Scenarios 1–4 | 24 | **Done** |
| ✅ | `kafka-message-studio-test-scenarios.md` | Message Studio Phases 1–3 (Publish, Consume, Templates, Streaming, Workflow) | — (MS Plan Phases 1–3) | 39 | **Done** |
| ✅ | `kafka-topic-explorer-test-scenarios.md` | Message Studio Phase 4 (Topic Explorer standalone page) | Scenario 4 (extended) | 26 | **Done** |
| ✅ | `kafka-schema-registry-test-scenarios.md` | Message Studio Phase 5 + Integration Phase 10 (Registry Browser + schema-aware produce/consume + E2E workflow Avro round-trip) | Scenarios 15–15I | 37 | **Done** |
| ✅ | `kafka-workflow-nodes-test-scenarios.md` | Integration Phases 4–5 (Workflow Kafka nodes, Trigger, Wait) | Scenarios 5–9I | 48 | **Done** |
| ✅ | `kafka-secure-tls-stream-test-scenarios.md` | SASL/SCRAM workflows, TLS-encrypted workflows, Kafka Studio Stream mode | — (cross-cutting) | 17 | **Done** |
| ✅ | `kafka-runner-test-scenarios.md` | Integration Phases 6–8 (Runner, Load Policy, Results Publishing) | Scenarios 10–13G | 20 | **Done** — 20/20 validated, 3 design gaps fixed |
| 7 | `kafka-tauri-transport-test-scenarios.md` | Integration Phase 9 (Tauri-native transport parity, beyond settings) | Scenarios 14–14H | ~18 | Pending |

---

## File 1: `kafka-message-studio-test-scenarios.md`

**Covers:** Message Studio Phases 1–3 — Protocols → Kafka → Publish/Consume tabs
**Navigation:** Left activity bar → **Protocols** → **Kafka** domain tab → **Publish** or **Consume** internal tab
**Docker:** Plaintext broker + `stream-producer.sh` for streaming tests
**Priority:** Highest — core debug UI surface

### Scenario Breakdown

#### Guard & Navigation (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-01 | Guard: Not connected → shows guard with "Open Kafka Settings" link | No | No |
| MS-02 | Guard: Connecting state → spinner with "Connecting to cluster…" | ✅ | ✅ |
| MS-03 | Connected → tab strip (Publish / Consume / Topics / Schema Registry), default = Publish | ✅ | ✅ |

#### Publish — Core (8 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-04 | Publish tab renders all fields: Topic, Acks (-1/1/0), Key, Partition, Timeout, Body, headers section, schema toggle | ✅ | ✅ |
| MS-05 | Topic validation hint after blur when empty ("Topic is required") | No | No |
| MS-06 | Body validation hint after blur when empty ("Message body is required") | No | No |
| MS-07 | Header CRUD: + Add → row with checkbox/key/value, enable/disable, remove, reorder (↑) | No | No |
| MS-08 | Validate & Format JSON: valid JSON → pretty-prints body; invalid JSON → error | No | No |
| MS-09 | Send Once → success result (partition, offset, topic, encoding) | ✅ | ✅ |
| MS-10 | Send Once → error result (non-retryable tag when applicable) | ✅ | ✅ |
| MS-11 | Clear button after send (clears both result and error) | ✅ | ✅ |

#### Consume — Consume Once (9 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-12 | Consume tab renders all fields: Topic, Consumer Group (auto-generated), Start Position, Timeout, Max Messages, Filters (Key/Header/JSONPath/JSONPath Equals), schema toggle | ✅ | ✅ |
| MS-13 | Topic validation hint after blur | No | No |
| MS-14 | Consume Once button disabled when topic empty, shows "Consuming…" while loading | No | No |
| MS-15 | Consume Once → results table with #/Offset/Partition/Key/Value columns | ✅ | ✅ |
| MS-16 | "No messages received" when result is empty array | ✅ | ✅ |
| MS-17 | "max reached" badge when count equals maxMessages; "timed out" badge | ✅ | ✅ |
| MS-18 | Click row → detail pane: pretty-printed JSON, headers table, Copy Key (disabled if no key), Copy Payload, close (✕) | ✅ | ✅ |
| MS-19 | Export Result Set → downloads JSON file; Clear → removes results | ✅ | ✅ |
| MS-20 | Consume with filters: Key Equals, Header Match, JSONPath filter | ✅ | ✅ |

#### Templates — Phase 2 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-21 | Publish: Save template (name input → ✓), Load ▾ dropdown lists saved template, click loads it | No | No |
| MS-22 | Publish: Delete template from dropdown (× button), "No saved templates" when empty | No | No |
| MS-23 | Consume: Save/Load/Delete templates (same flow as publish) | No | No |
| MS-24 | Consume template strips groupId on load (new groupId generated each session) | No | No |
| MS-25 | Templates persist across page reload (localStorage) | No | No |

#### Streaming — Phase 3B (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-26 | Mode tabs render: Consume Once (default active) / Stream; clicking switches modes | No | No |
| MS-27 | Stream mode: Start Stream → LIVE badge, message count increments, auto-scroll to bottom | ✅ | ✅ |
| MS-28 | Stream mode: Stop Stream → LIVE badge disappears, messages preserved, Start Stream re-appears | ✅ | ✅ |
| MS-29 | Stream mode: Clear → messages reset to 0, cursor gap cleared | ✅ | ✅ |
| MS-30 | Stream mode: Export Stream → downloads JSON file with all streamed messages | ✅ | ✅ |
| MS-31 | Stream mode: Click message row → detail pane (same as consume-once detail) | ✅ | ✅ |

#### Workflow Integration — Phase 3C/3D (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| MS-32 | Consume detail: "Use as Workflow Input" button visible when connected, hidden otherwise | ✅ | ✅ |
| MS-33 | Click "Use as Workflow Input" → navigates to Workflow Runner with kafka_message/topic/partition/offset variables | ✅ | ✅ |
| MS-34 | Publish: "Map from Workflow ▾" disabled with tooltip "Run a workflow first" when no output | No | No |
| MS-35 | Publish: "Map from Workflow ▾" enabled after workflow run → dropdown with search, selecting JSON variable pretty-prints into body | ✅ | ✅ |

---

## File 2: `kafka-topic-explorer-test-scenarios.md`

**Covers:** Message Studio Phase 4 — Protocols → Kafka → Topics tab
**Navigation:** Left activity bar → **Protocols** → **Kafka** domain tab → **Topics** internal tab
**Docker:** Plaintext broker with multiple topics, consumer groups, varied partition counts
**Priority:** High

### Scenario Breakdown

#### Guard & Layout (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| TE-01 | Guard: Cluster not connected → guard with "Open Kafka Settings" link | No | No |
| TE-02 | Guard: No clusters configured → "No clusters configured" guard | No | No |
| TE-03 | Loading state shows "Loading Kafka settings…" | No | No |
| TE-04 | Connected → two-column layout: left topic list, right empty placeholder | ✅ | ✅ |

#### Topic List — Left Panel (10 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| TE-05 | Topics load with columns: Topic, Parts, Repl, Traffic, CGs, Health | ✅ | ✅ |
| TE-06 | Search by topic name (placeholder "Search topics…") filters list | ✅ | ✅ |
| TE-07 | Internal topics toggle | ✅ | ✅ |
| TE-08 | Domain chips: "All" (default), dynamic chips by prefix | ✅ | ✅ |
| TE-09 | "Recently Active" and "Lagging Consumers" special chips (disabled until detail loaded) | ✅ | ✅ |
| TE-10 | Health filter dropdown: All / Healthy / Warning / Unknown (disabled until detail loaded) | ✅ | ✅ |
| TE-11 | Partition filter dropdown: Any / 1–4 / 5–12 / 12+ | ✅ | ✅ |
| TE-12 | Retention filter dropdown: Any / < 1 day / 1–7 days / > 7 days (disabled until detail loaded) | ✅ | ✅ |
| TE-13 | Empty state: "No topics match the current filters" when no results | ✅ | ✅ |

#### Topic Selection & Detail (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| TE-14 | Click topic row → detail panel appears on right, row highlighted | ✅ | ✅ |
| TE-15 | Click same row again → deselects, detail panel disappears | ✅ | ✅ |
| TE-16 | Detail loading: "Loading topic details…" while fetching | ✅ | ✅ |
| TE-17 | Detail header: topic name + health badge | ✅ | ✅ |

#### Detail Panel Tabs (9 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| TE-18 | Messages tab: metrics row + consume form + results table | ✅ | ✅ |
| TE-19 | Messages tab: filters (Key Match, Header Match, JSONPath) | ✅ | ✅ |
| TE-20 | Messages tab: click row → detail pane with Copy Key / Copy Value | ✅ | ✅ |
| TE-21 | Partitions tab: table with Partition/Leader/Replicas/ISR/Earliest/Latest/Messages, total footer | ✅ | ✅ |
| TE-22 | Consumer Groups tab: group list with Group ID/State/Total Lag, or "No consumer groups found" | ✅ | ✅ |
| TE-23 | Config tab: key-value table with topic config, or "No configuration data available" | ✅ | ✅ |
| TE-24 | Tab switching preserves topic selection | ✅ | ✅ |
| TE-25 | Switching topics clears previous results | ✅ | ✅ |
| TE-26 | Disconnect during browsing → guard re-appears | ✅ | ✅ |

---

## File 3: `kafka-schema-registry-test-scenarios.md`

**Covers:** Message Studio Phase 5 + Integration Phase 10 — Protocols → Schema Registry tab + schema-aware produce/consume
**Navigation:** Left activity bar → **Protocols** → **Kafka** domain tab → **Schema Registry** internal tab (and back to **Publish**/**Consume** tabs for schema-aware produce/consume)
**Docker:** Schema Registry container (already in compose) + registered Avro/JSON schemas
**Priority:** High
**Integration Test Plan cross-ref:** Scenarios 15–15I

### Scenario Breakdown

#### Guard & Connection (4 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-01 | Guard: Not connected to Kafka → guard with "Open Kafka Settings" link | No | No | — |
| SR-02 | Connected but no registry URL → prompt: "Enter a Schema Registry URL to begin browsing." | ✅ | ✅ | — |
| SR-03 | Fill registry URL (http://localhost:8085) → "Connect to Registry" button → subjects load | ✅ | ✅ | Scenario 15 |
| SR-04 | Registry auth fields: Username/Password (optional), error on invalid credentials | ✅ | ✅ | Scenario 15F |

#### Subject List (5 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-05 | Subjects load: table with Subject/Format columns, format badges (Avro/Protobuf/JSON Schema/—) | ✅ | ✅ | Scenario 15 |
| SR-06 | Subject count: "{n} of {total} subjects" subtitle | ✅ | ✅ | — |
| SR-07 | Filter subjects: search input filters by subject name | ✅ | ✅ | Scenario 15 |
| SR-08 | Empty states: "No subjects registered" (zero), "No subjects match the filter" (filtered empty) | ✅ | ✅ | — |
| SR-09 | Refresh: button label changes to "Refresh Subjects" after first load | ✅ | ✅ | — |

#### Schema Detail (7 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-10 | Click subject row → detail panel with subject name heading | ✅ | ✅ | Scenario 15 |
| SR-11 | Version selector: dropdown with v1, v2… (latest), default = latest version | ✅ | ✅ | Scenario 15 |
| SR-12 | Schema content: pretty-printed JSON/Avro IDL/Protobuf in `<pre>` block | ✅ | ✅ | Scenario 15 |
| SR-13 | Format badge in detail panel matches subject list format | ✅ | ✅ | — |
| SR-14 | Copy Schema button → clipboard contains schema text | ✅ | ✅ | — |
| SR-15 | Export button → downloads file (`.json` or `.proto` based on format) | ✅ | ✅ | — |
| SR-16 | Error handling: version load error, schema fetch error → inline error messages | ✅ | ✅ | Scenario 15 |

#### Schema-Aware Produce — Integration Phase 10 (4 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-17 | Publish tab: enable Schema Registry toggle → select Avro subject/version → publish matching payload → success with `valueEncoding: 'base64-avro'` | ✅ | ✅ | Scenario 15B |
| SR-18 | Publish tab: schema mismatch → `SCHEMA_MISMATCH` error with subject/version/format details (not generic Kafka error) | ✅ | ✅ | Scenario 15D |
| SR-19 | Batch produce with schema config: 3 messages encoded with same schema; partial failure rejects entire batch | ✅ | ✅ | Scenario 15H |
| SR-20 | Schema ID caching: produce 5 messages to same topic/subject → registry contacted once (verify via server log or debug) | ✅ | ✅ | Scenario 15I |

#### Schema-Aware Consume — Integration Phase 10 (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-21 | Consume tab: enable schema → consume Avro-encoded messages → decoded to readable JSON fields | ✅ | ✅ | Scenario 15C |
| SR-22 | Consume tab: consume Avro messages WITHOUT schema config → raw encoded bytes displayed (no error, `.toString('utf-8')` passthrough) | ✅ | ✅ | Scenario 15C |
| SR-23 | Consume tab: incompatible schema version → `SCHEMA_MISMATCH` with diagnostic detail | ✅ | ✅ | Scenario 15D |

#### Schema Isolation & Error Paths (5 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| SR-24 | Plain-JSON produce/consume WITHOUT schema config → identical to Phase 1 baseline (no encoding/decoding) | ✅ | ✅ | Scenario 15E |
| SR-25 | Registry unreachable at produce time → `REGISTRY_UNREACHABLE` error, no silent fallback to unencoded | ✅ | ✅ | Scenario 15G |
| SR-26 | Registry auth failure → `REGISTRY_AUTH_FAILURE` distinct from `REGISTRY_UNREACHABLE` and `SCHEMA_MISMATCH` | ✅ | ✅ | Scenario 15F |
| SR-27 | Plain-JSON produce still succeeds while registry is offline (schema not configured) | ✅ | ✅ | Scenario 15G |
| SR-28 | Phase 8 results publish envelope remains schema-agnostic regardless of schema config | ✅ | ✅ | Scenario 15E |

---

## File 4: `kafka-workflow-nodes-test-scenarios.md`

**Covers:** Integration Phases 4–5 — Workflow Designer Kafka nodes (Produce, Consume, Trigger, Wait)
**Navigation:** Left activity bar → **Workflow** → select/create workflow → canvas
**Docker:** Plaintext broker + seeded topics
**Priority:** Medium-High
**Integration Test Plan cross-ref:** Scenarios 5–9I

### Scenario Breakdown

#### Node Palette & Canvas (4 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-01 | Node palette: Kafka category shows kafkaProduce, kafkaConsume, kafkaTrigger, kafkaWait node types | No | No | — |
| WN-02 | Drag kafkaProduce to canvas → node renders with correct icon and label | No | No | — |
| WN-03 | Drag kafkaConsume to canvas → node renders with correct icon and label | No | No | — |
| WN-04 | Drag kafkaTrigger / kafkaWait to canvas → correct rendering | No | No | — |

#### kafkaProduce Node Config & Execution (7 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-05 | Click kafkaProduce node → config panel opens with Topic, Key, Partition, Acks, Headers, Body, Schema Config fields | No | No | — |
| WN-06 | Topic field validation: required, shows hint when empty | No | No | — |
| WN-07 | Body field supports `{{variable}}` interpolation syntax | No | No | — |
| WN-08 | Schema Config section: Enable Schema Registry toggle with format/subject/version | No | No | — |
| WN-09 | Quick Test: kafkaProduce sends actual message to broker → logs show partition/offset | ✅ | ✅ | Scenario 5 |
| WN-10 | Output bindings: bind `partition` → `producedPartition`, `offset` → `producedOffset`; downstream HTTP node receives interpolated values | ✅ | ✅ | Scenario 6E |
| WN-11 | Disabled output bindings are skipped and do not overwrite existing variables | ✅ | ✅ | Scenario 6E |

#### kafkaConsume Node Config & Execution (7 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-12 | Click kafkaConsume node → config panel with Topic, Group, Start Position, Timeout, Max Messages, Filters | No | No | — |
| WN-13 | Extraction config: variable output mapping (JSONPath → variable name) | No | No | — |
| WN-14 | Quick Test: kafkaConsume retrieves matching messages → logs show count/content | ✅ | ✅ | Scenario 6 |
| WN-15 | Variable extraction: extracted values appear as output variables for downstream nodes | ✅ | ✅ | Scenario 6 |
| WN-16 | Schema Config section with deserialization settings | No | No | — |
| WN-17 | Consume with `startPosition: 'earliest'` replays existing messages (not just latest) | ✅ | ✅ | Scenario 6F |
| WN-18 | Consume timeout: no matching message → deterministic timeout handling | ✅ | ✅ | Scenario 6 |

#### Config Persistence & Variable Insertion (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-19 | Configure templated fields using Insert Variable → save, close, reopen modal → all values persist | No | No | Scenario 6B |
| WN-20 | Save workflow, reload editor, reopen both node configs → values survive full reload | No | No | Scenario 6B |
| WN-21 | Validation blocks save only on required fields with actionable inline errors | No | No | Scenario 6B |

#### Mixed Workflow Chains (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-22 | HTTP → kafkaProduce → kafkaConsume → HTTP chain: downstream HTTP receives extracted Kafka variables | ✅ | ✅ | Scenario 6C |
| WN-23 | Chain with `continueOnError: false` (default) → workflow stops at Kafka failure; downstream does not execute | ✅ | ✅ | Scenario 6I |
| WN-24 | Chain with `continueOnError: true` → failure recorded but downstream HTTP node still executes | ✅ | ✅ | Scenario 6I |

#### Load Test Behavior (2 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-25 | Consume node with `loadTestBehavior.mode: 'auto-resume'` → no real broker call; synthetic empty result per iteration | ✅ | ✅ | Scenario 6G |
| WN-26 | Log indicates auto-resume path was taken (not genuine consume match) | ✅ | ✅ | Scenario 6G |

#### Results Explorer Trace (2 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-27 | Results Explorer: kafkaProduce entry shows topic, partition, offset, durationMs from `kafkaDetails` | ✅ | ✅ | Scenario 6H |
| WN-28 | Results Explorer: kafkaConsume entry shows topic, matchedMessages, durationMs; no credentials in logs; payload truncated at 512 chars | ✅ | ✅ | Scenario 6H |

#### Workflow Kafka Logging & Observability (4 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-29 | Console panel shows structured Kafka logs during execution (start/success/failure, topic, timing) | ✅ | ✅ | Scenario 6D |
| WN-30 | Sensitive fields redacted in logs (auth credentials, TLS material, protected headers) | ✅ | ✅ | Scenario 6D |
| WN-31 | Error node state: connection failure during execution → node shows error badge with failure class | ✅ | ✅ | Scenario 6D |
| WN-32 | Variable inspector: Kafka-extracted variables visible in debug panel | ✅ | ✅ | — |

#### kafkaTrigger — Phase 5 (6 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-33 | kafkaTrigger config: subscription topic, correlation field, variable seeding options | No | No | — |
| WN-34 | Kafka Trigger starts workflow from real message → exactly one run created for matching message | ✅ | ✅ | Scenario 7 |
| WN-35 | Non-matching messages do not start the workflow | ✅ | ✅ | Scenario 7 |
| WN-36 | Run metadata shows trigger topic, partition, offset, extracted variables | ✅ | ✅ | Scenario 7 |
| WN-37 | Trigger offset policy: pre-subscription messages NOT replayed; only post-subscription messages trigger | ✅ | ✅ | Scenario 9F |
| WN-38 | Backpressure: active-run limit set to 2 → at most 2 concurrent runs; consumer pauses (not disconnects), auto-resumes | ✅ | ✅ | Scenario 9G |

#### kafkaWait — Phase 5 (10 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| WN-39 | kafkaWait config: correlation ID matcher, timeout, cancel-on-mismatch settings | No | No | — |
| WN-40 | KafkaWait resumes only when correlated message arrives; non-matching messages leave workflow waiting | ✅ | ✅ | Scenario 8 |
| WN-41 | Run history shows waiting → resumed → completed states | ✅ | ✅ | Scenario 8 |
| WN-42 | KafkaWait timeout: short timeout + no matching message → timeout state without hanging resources | ✅ | ✅ | Scenario 9 |
| WN-43 | Duplicate callback delivery is idempotent → exactly one resume; duplicate classified as ignored | ✅ | ✅ | Scenario 9B |
| WN-44 | Correlation mismatch: body/header/query extraction mismatches rejected; matching callback resumes exactly once | ✅ | ✅ | Scenario 9C |
| WN-45 | Restart recovery: restart server before callback → matching callback after restart resumes correctly; no orphaned waits | ✅ | ✅ | Scenario 9D |
| WN-46 | Resume-path parity: direct resume and callback endpoint produce equivalent state transitions | ✅ | ✅ | Scenario 9E |
| WN-47 | Consumer cleanup on timeout: 3-second timeout → no lingering subscription; correlation store cleaned up | ✅ | ✅ | Scenario 9H |
| WN-48 | Kafka context variable seeding: trigger seeds `kafka.trigger.*`; wait seeds `kafka.wait.*`; no cross-contamination with `webhook.*` | ✅ | ✅ | Scenario 9I |

---

## File 5: `kafka-runner-test-scenarios.md`

**Covers:** Integration Phases 6–8 — Test Runner, Load Policy, Results Publishing
**Navigation:** Left activity bar → **Harness** → Test Runner / Parameterized Runner / Results
**Docker:** Plaintext broker + pre-built feature groups with Kafka scenarios
**Priority:** Medium
**Integration Test Plan cross-ref:** Scenarios 10–13G

### Scenario Breakdown

#### Kafka Scenarios in Standard Runner — Phase 6 (8 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-01 | Feature group with kafkaProduce scenario: renders in scenario list with Kafka icon | No | No | — |
| KR-02 | Feature group with kafkaConsume scenario: renders in scenario list with Kafka icon | No | No | — |
| KR-03 | Run kafkaProduce scenario → result shows partition/offset metadata | ✅ | ✅ | Scenario 10 |
| KR-04 | Run kafkaConsume scenario → result shows message count/content | ✅ | ✅ | Scenario 10 |
| KR-05 | Kafka metadata field assertions: `kafka.partition` (non-negative) and `kafka.header.correlationId` pass/fail correctly | ✅ | ✅ | Scenario 11G |
| KR-06 | Rerun with wrong header value → `failureDetails` identifies field mismatch with expected vs actual | ✅ | ✅ | Scenario 11G |
| KR-07 | HTTP assertion operators are NOT evaluated for Kafka actions (no status code check) | ✅ | ✅ | Scenario 11G |
| KR-08 | Mixed suite: HTTP + Kafka scenarios in same feature group, both types render correctly | ✅ | ✅ | Scenario 11D |

#### Parameterized Runner — Phase 6 (5 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-09 | Kafka scenario with CSV data source: column mapping to topic/key/body | ✅ | ✅ | Scenario 11 |
| KR-10 | Parameterized kafkaProduce: iterates rows, sends each as separate message | ✅ | ✅ | Scenario 11 |
| KR-11 | Parameterized kafkaConsume: each row configures different topic/filter | ✅ | ✅ | Scenario 11 |
| KR-12 | Row-level failure attribution: intentionally failing row identified by row ID/label; successful rows correct | ✅ | ✅ | Scenario 11C |
| KR-13 | Execution plan preview shows Kafka scenarios with correct column mappings | No | No | — |

#### Action-Contract Migration Safety — Phase 6 (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-14 | Import pre-Kafka HTTP-only scenario set → open, run, re-save → no schema breakage | ✅ | ✅ | Scenario 11B |
| KR-15 | Scenarios without `actionType` field treated as `'http'` by runner (no migration error) | ✅ | ✅ | Scenario 11H |
| KR-16 | HTTP-specific result columns (httpStatus, method-badge) render normally for legacy scenarios | ✅ | ✅ | Scenario 11H |

#### Transport-Aware Outcomes & Export — Phase 6 (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-17 | Kafka outcomes classified with transport-aware semantics (not misclassified as HTTP status failures) | ✅ | ✅ | Scenario 11E |
| KR-18 | Export mixed-suite results (JSON/CSV) → Kafka metadata preserved; totals consistent between UI and export | ✅ | ✅ | Scenario 11F |
| KR-19 | Re-open exported artifacts → no action type dropped or transformed into HTTP-only fields | ✅ | ✅ | Scenario 11F |

#### Results Rendering (4 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-20 | Results page: Kafka run results show non-HTTP cards (no status code, show partition/offset) | ✅ | ✅ | Scenario 10 |
| KR-21 | Results dashboard: Kafka metrics cards (throughput, timing) | ✅ | ✅ | — |
| KR-22 | Results filter: filter by run type (test/workflow) includes Kafka-originated results; grouping consistent | ✅ | ✅ | Scenario 11D |
| KR-23 | Results detail: drill into Kafka result shows full message payload | ✅ | ✅ | — |

#### Load-mode Policy — Phase 7 (8 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-24 | Pre-run validation blocks unsafe streaming consume in load mode with actionable message | ✅ | ✅ | Scenario 12 |
| KR-25 | Consume mode selector: wait-for-real / auto-resume / synthetic-inject options | No | No | — |
| KR-26 | Compatibility matrix: each execution mode × consume mode combination has deterministic planner outcome (allow/warn/block) | ✅ | ✅ | Scenario 12B |
| KR-27 | Deterministic replay: same constrained config run 3×; consistent completion, no stale consume state leak | ✅ | ✅ | Scenario 12C |
| KR-28 | Constant-arrival capability gating: unsupported env blocked with explicit message; supported env runs correctly | ✅ | ✅ | Scenario 12D |
| KR-29 | Backpressure observability: target throughput, achieved throughput, dropped-request signals visible | ✅ | ✅ | Scenario 12E |
| KR-30 | `kafkaOperations` threading in workflow-load mode: N iterations × M concurrency all complete without "kafkaOperations undefined" | ✅ | ✅ | Scenario 12F |
| KR-31 | Policy blocks unsupported execution mode × consume mode (`wait-for-real` + `constant-arrival` without Tauri) before any iteration starts | ✅ | ✅ | Scenario 12G |

#### Results Publishing — Phase 8 (7 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| KR-32 | Settings: publish-on-complete toggle visible in runner/results settings | No | No | — |
| KR-33 | Configure target topic + run test → 1 summary payload produced to `redfireforge.results.summary` | ✅ | ✅ | Scenario 13 |
| KR-34 | Publishing disabled → no publish event emitted; local run unchanged; UI shows "publishing disabled" | No | No | Scenario 13B |
| KR-35 | Publish failure with broker unavailable → run completes with normal status; publish diagnostics classify failure | ✅ | ✅ | Scenario 13C |
| KR-36 | Envelope versioning: published payload includes `schemaVersion`, `runId`, timestamp, mode, summary metrics | ✅ | ✅ | Scenario 13D |
| KR-37 | Secure-profile parity: publish in plaintext and secure profiles → same contract-compliant payload shape | ✅ | ✅ | Scenario 13E |
| KR-38 | Publish hook fires at all 3 completion paths (scenario-based, workflow-mode, quota-override force-save) | ✅ | ✅ | Scenario 13G |

---

## File 6: `kafka-tauri-transport-test-scenarios.md`

**Covers:** Integration Phase 9 — Tauri-native Kafka transport parity (beyond settings, which is covered by SC-21)
**Navigation:** Tauri desktop app build → same UI pages as web, but using native `invoke`-based transport
**Docker:** Plaintext broker + Tauri desktop build
**Priority:** Lower (depends on Tauri build readiness)
**Integration Test Plan cross-ref:** Scenarios 14–14H

### Scenario Breakdown

#### Transport Factory & Registration (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-01 | Tauri mode: `setKafkaClientTransport(kafkaNativeTauriTransport)` called at startup; all `dispatchKafkaOperation()` uses native path | ✅ | N/A | Scenario 14D-init |
| TT-02 | Browser/dev mode: `setKafkaClientTransport` NOT called; `kafkaClient.ts` uses `defaultTransport` (server-proxy) | No | ✅ | Scenario 14D-init |
| TT-03 | Transport factory routing: browser routes through server-proxy; Tauri routes through native invoke; no Tauri imports in browser mode | ✅ | ✅ | Scenario 14D |

#### Native Lifecycle Parity (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-04 | Connect/status/topics via native transport → response shapes match server contract (same as `src-server/kafka/contracts.ts`) | ✅ | N/A | Scenario 14 |
| TT-05 | Equivalent errors (bad host, wrong port) map to same UI-safe error messages as server-proxy | ✅ | N/A | Scenario 14 |
| TT-06 | No browser-mode regressions when running same operations in browser/dev | No | ✅ | Scenario 14 |

#### Native Produce & Consume (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-07 | Publish message via native transport → message appears in consumer with correct key, headers, value, offset, partition | ✅ | N/A | Scenario 14B |
| TT-08 | Bounded consume via native transport stops at configured limit | ✅ | N/A | Scenario 14B |
| TT-09 | Native produce returns broker-confirmed metadata consistent with server-proxy produce response shape | ✅ | N/A | Scenario 14B |

#### Native Subscription Lifecycle (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-10 | Subscribe to topic in desktop mode → messages received via Tauri event emission | ✅ | N/A | Scenario 14C |
| TT-11 | Unsubscribe terminates cleanly with no dangling threads | ✅ | N/A | Scenario 14C |
| TT-12 | App close while subscription active → all Kafka connections/subscriptions cleaned up without error | ✅ | N/A | Scenario 14C |

#### Cross-Transport Golden Fixture Parity (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-13 | Same golden fixture inputs (connect, topics, produce, consume) → identical success envelope shape across both transports | ✅ | ✅ | Scenario 14E |
| TT-14 | Same error conditions → identical error envelope shape across both transports | ✅ | ✅ | Scenario 14E |
| TT-15 | Downstream consumers (UI rendering, run results) behave identically regardless of transport | ✅ | ✅ | Scenario 14E |

#### Secure Profile & Concurrency (3 scenarios)

| ID | Scenario | Docker | Server | ITP ref |
|---|---|---|---|---|
| TT-16 | Secure (auth/TLS) broker connection in Tauri mode → same success/failure behavior as server-proxy | ✅ | N/A | Scenario 14F |
| TT-17 | Concurrent produce while subscriber active → both complete without interference; no race conditions or panics | ✅ | N/A | Scenario 14G |
| TT-18 | Broker reconnect with active native subscription → disconnect surfaced clearly; re-subscribing works without app restart | ✅ | N/A | Scenario 14H |

---

## Docker Setup Reference

All test-scenarios files share the same Docker infrastructure:

```bash
# Start plaintext broker
cd docker/kafka/plaintext && docker compose up -d

# Start schema registry (for Schema Registry scenarios)
cd docker/kafka/schema-registry && docker compose up -d

# Start stream producer (for streaming scenarios)
./docker/kafka/topics/stream-producer.sh redfireforge.stream.test 2

# Start backend server
npm run server

# Start frontend dev server
npm run dev
```

| Service | Port | Used by |
|---|---|---|
| Redpanda broker | `localhost:19092` | All files |
| Redpanda Console | `http://localhost:18080` | Optional debugging |
| Schema Registry | `http://localhost:8085` | File 3 (SR-*) |
| Backend server | `http://localhost:3001` | All files (Server column) |
| Frontend (Vite) | `http://localhost:5173` | All files |

---

## Automated Test Scripts

Reusable scripts for setting up the test environment and running API-level smoke tests:

| Script | Purpose | Usage |
|---|---|---|
| `docker/kafka/e2e/ui-test-seed.sh` | Creates 16 topics + seeds 20+ messages for all test-scenario MD files | `./docker/kafka/e2e/ui-test-seed.sh` |
| `docker/kafka/e2e/run-all-smoke.sh` | One-command: start Docker, seed data, run all API smoke tests | `./docker/kafka/e2e/run-all-smoke.sh` |
| `docker/kafka/e2e/run-all-smoke.sh --seed-only` | Start Docker + seed data only (for manual UI testing) | `./docker/kafka/e2e/run-all-smoke.sh --seed-only` |
| `docker/kafka/plaintext/smoke-test.sh` | API smoke test: plaintext connect → topics → produce → consume → disconnect | `./docker/kafka/plaintext/smoke-test.sh` |
| `docker/kafka/secure/smoke-test.sh` | API smoke test: SASL/SCRAM auth validation (6 scenarios, S1–S6) | `./docker/kafka/secure/smoke-test.sh` |
| `docker/kafka/schema-registry/smoke-test.sh` | API smoke test: Avro encode/decode round-trip (14 scenarios, SR01–SR14) | `./docker/kafka/schema-registry/smoke-test.sh` |
| `docker/kafka/topics/seed-messages.sh` | Legacy seed: 10 messages into pre-existing topics (used by old smoke tests) | `./docker/kafka/topics/seed-messages.sh` |

**Quick start for manual UI testing:**

```bash
# 1. Start Docker + seed all test data (one command)
./docker/kafka/e2e/run-all-smoke.sh --seed-only plaintext

# 2. Start the server + web UI
npm run server    # terminal 1
npm run dev       # terminal 2

# 3. Open http://localhost:5173 and follow the test-scenario MD files
```

See `docker/kafka/e2e/README.md` for full documentation.

---

## Execution Order

Recommended order for writing and validating these files:

```
1. kafka-message-studio-test-scenarios.md       (MS-01 → MS-35)   ✅ Done — 39 scenarios
2. kafka-topic-explorer-test-scenarios.md       (TE-01 → TE-26)   ✅ Done — 26 scenarios
3. kafka-schema-registry-test-scenarios.md      (SR-01 → SR-28 + SR-E2E-01 → SR-E2E-09) ✅ Done — 37 scenarios
4. kafka-workflow-nodes-test-scenarios.md        (WN-01 → WN-48)   ✅ Done — 48 scenarios
5. kafka-secure-tls-stream-test-scenarios.md    (SW/TW/SM scenarios) ✅ Done — 17 scenarios
6. kafka-runner-test-scenarios.md               (KR-01 → KR-20)   ✅ Done — 20/20 validated
7. kafka-tauri-transport-test-scenarios.md      (TT-01 → TT-18)   ← Requires Tauri build
```

Each file should be completed end-to-end before moving to the next:
write MD → manual Docker validation → fix bugs → export data → reimport validation → user review.

---

## Relationship to Existing Plans

| Test Scenarios File | Integration Plan Phases | Message Studio Phases | Integration Test Plan Scenarios | Status |
|---|---|---|---|---|
| `kafka-settings-test-scenarios.md` | Phases 1–3 + Phase 9 settings (SC-21) + SASL/SCRAM e2e | — | Scenarios 1–4 | ✅ Done |
| `kafka-message-studio-test-scenarios.md` | Phase 1 (APIs) | MS Phases 1–3 | — (MS Plan-driven) | ✅ Done |
| `kafka-topic-explorer-test-scenarios.md` | Phase 3D (basic topics) | MS Phase 4 | Scenario 4 (extended) | ✅ Done |
| `kafka-schema-registry-test-scenarios.md` | Phase 10 (registry + schema produce/consume + E2E Avro workflow) | MS Phase 5 | Scenarios 15–15I | ✅ Done |
| `kafka-workflow-nodes-test-scenarios.md` | Phases 4–5 | MS Phase 3C/3D (bridge) | Scenarios 5–9I | ✅ Done |
| `kafka-secure-tls-stream-test-scenarios.md` | Cross-cutting (SASL/TLS workflows + Studio Stream) | MS Phase 3B (stream) | — (security + stream) | ✅ Done |
| `kafka-runner-test-scenarios.md` | Phases 6–8 | — | Scenarios 10–13G | ✅ Done |
| `kafka-tauri-transport-test-scenarios.md` | Phase 9 (full transport parity) | — | Scenarios 14–14H | Pending |

---

## Coverage Cross-Reference: `integration-test-plan.md` Scenario → Test Scenarios File

Every numbered scenario from `integration-test-plan.md` must be covered by at least one test-scenarios file:

| ITP Scenario | Phase | Covered By |
|---|---|---|
| Scenario 1 (Plaintext cluster connect) | 3 | ✅ `kafka-settings` SC-03, SC-08 |
| Scenario 2 (Invalid broker/credentials) | 3 | ✅ `kafka-settings` SC-15 |
| Scenario 3 (Auth/SSL combinations) | 3 | ✅ `kafka-settings` SC-16, SC-17, SC-23 (SCRAM e2e web), SC-24 (SCRAM e2e Tauri) |
| Scenario 4 (Topic list search/detail) | 3 | ✅ `kafka-settings` SC-10, SC-11; ✅ `kafka-topic-explorer` TE-05–TE-26 |
| Scenario 5 (kafkaProduce publishes) | 4 | ✅ `kafka-workflow-nodes` WN-09 |
| Scenario 6 (kafkaConsume captures) | 4 | ✅ `kafka-workflow-nodes` WN-14, WN-15, WN-18 |
| Scenario 6B (Config persistence) | 4 | ✅ `kafka-workflow-nodes` WN-19, WN-20, WN-21 |
| Scenario 6C (Mixed chain) | 4 | ✅ `kafka-workflow-nodes` WN-22 |
| Scenario 6D (Kafka node logs) | 4 | ✅ `kafka-workflow-nodes` WN-29, WN-30 |
| Scenario 6E (Output bindings) | 4 | ✅ `kafka-workflow-nodes` WN-10, WN-11 |
| Scenario 6F (Consume earliest) | 4 | ✅ `kafka-workflow-nodes` WN-17 |
| Scenario 6G (Auto-resume) | 4 | ✅ `kafka-workflow-nodes` WN-25, WN-26 |
| Scenario 6H (Results Explorer trace) | 4 | ✅ `kafka-workflow-nodes` WN-27, WN-28 |
| Scenario 6I (continueOnError) | 4 | ✅ `kafka-workflow-nodes` WN-23, WN-24 |
| Scenario 7 (Trigger starts workflow) | 5 | ✅ `kafka-workflow-nodes` WN-34, WN-35, WN-36 |
| Scenario 8 (KafkaWait resumes) | 5 | ✅ `kafka-workflow-nodes` WN-40, WN-41 |
| Scenario 9 (KafkaWait timeout) | 5 | ✅ `kafka-workflow-nodes` WN-42 |
| Scenario 9B (Duplicate callback) | 5 | ✅ `kafka-workflow-nodes` WN-43 |
| Scenario 9C (Correlation mismatch) | 5 | ✅ `kafka-workflow-nodes` WN-44 |
| Scenario 9D (Restart recovery) | 5 | ✅ `kafka-workflow-nodes` WN-45 |
| Scenario 9E (Resume-path parity) | 5 | ✅ `kafka-workflow-nodes` WN-46 |
| Scenario 9F (Trigger offset policy) | 5 | ✅ `kafka-workflow-nodes` WN-37 |
| Scenario 9G (Backpressure) | 5 | ✅ `kafka-workflow-nodes` WN-38 |
| Scenario 9H (Consumer cleanup) | 5 | ✅ `kafka-workflow-nodes` WN-47 |
| Scenario 9I (Variable seeding) | 5 | ✅ `kafka-workflow-nodes` WN-48 |
| Scenario 10 (Standard runner) | 6 | `kafka-runner` KR-03, KR-04 |
| Scenario 11 (Parameterized runner) | 6 | `kafka-runner` KR-09, KR-10, KR-11 |
| Scenario 11B (Migration safety) | 6 | `kafka-runner` KR-14 |
| Scenario 11C (Row-level attribution) | 6 | `kafka-runner` KR-12 |
| Scenario 11D (Mixed-suite rendering) | 6 | `kafka-runner` KR-08, KR-22 |
| Scenario 11E (Transport-aware outcomes) | 6 | `kafka-runner` KR-17 |
| Scenario 11F (Export parity) | 6 | `kafka-runner` KR-18, KR-19 |
| Scenario 11G (Metadata assertions) | 6 | `kafka-runner` KR-05, KR-06, KR-07 |
| Scenario 11H (Backward-compatible load) | 6 | `kafka-runner` KR-15, KR-16 |
| Scenario 12 (Load mode policy) | 7 | `kafka-runner` KR-24 |
| Scenario 12B (Compatibility matrix) | 7 | `kafka-runner` KR-26 |
| Scenario 12C (Deterministic replay) | 7 | `kafka-runner` KR-27 |
| Scenario 12D (Constant-arrival gating) | 7 | `kafka-runner` KR-28 |
| Scenario 12E (Backpressure telemetry) | 7 | `kafka-runner` KR-29 |
| Scenario 12F (kafkaOperations threading) | 7 | `kafka-runner` KR-30 |
| Scenario 12G (Policy blocks combination) | 7 | `kafka-runner` KR-31 |
| Scenario 13 (Run summary published) | 8 | `kafka-runner` KR-33 |
| Scenario 13B (Publishing disabled) | 8 | `kafka-runner` KR-34 |
| Scenario 13C (Publish failure non-blocking) | 8 | `kafka-runner` KR-35 |
| Scenario 13D (Envelope versioning) | 8 | `kafka-runner` KR-36 |
| Scenario 13E (Secure-profile parity) | 8 | `kafka-runner` KR-37 |
| Scenario 13G (Publish 3 paths) | 8 | `kafka-runner` KR-38 |
| Scenario 14 (Native lifecycle) | 9 | `kafka-tauri-transport` TT-04, TT-05, TT-06 |
| Scenario 14B (Native produce/consume) | 9 | `kafka-tauri-transport` TT-07, TT-08, TT-09 |
| Scenario 14C (Native subscription) | 9 | `kafka-tauri-transport` TT-10, TT-11, TT-12 |
| Scenario 14D (Transport factory) | 9 | `kafka-tauri-transport` TT-03 |
| Scenario 14D-init (Transport registration) | 9 | `kafka-tauri-transport` TT-01, TT-02 |
| Scenario 14E (Golden-fixture parity) | 9 | `kafka-tauri-transport` TT-13, TT-14, TT-15 |
| Scenario 14F (Secure-profile parity) | 9 | `kafka-tauri-transport` TT-16 |
| Scenario 14G (Concurrent operations) | 9 | `kafka-tauri-transport` TT-17 |
| Scenario 14H (Broker reconnect) | 9 | `kafka-tauri-transport` TT-18 |
| Scenario 15 (Registry connection) | 10 | ✅ `kafka-schema-registry` SR-03, SR-05, SR-07 |
| Scenario 15B (Schema-aware produce) | 10 | ✅ `kafka-schema-registry` SR-17 |
| Scenario 15C (Schema-aware consume) | 10 | ✅ `kafka-schema-registry` SR-21, SR-22 |
| Scenario 15D (Schema mismatch) | 10 | ✅ `kafka-schema-registry` SR-18, SR-23 |
| Scenario 15E (Plain-JSON unaffected) | 10 | ✅ `kafka-schema-registry` SR-24, SR-28 |
| Scenario 15F (Registry auth failure) | 10 | ✅ `kafka-schema-registry` SR-04, SR-26 |
| Scenario 15G (Registry unavailable) | 10 | ✅ `kafka-schema-registry` SR-25, SR-27 |
| Scenario 15H (Batch produce with schema) | 10 | ✅ `kafka-schema-registry` SR-19 |
| Scenario 15I (Schema ID caching) | 10 | ✅ `kafka-schema-registry` SR-20 |

**Note:** Scenario 12H (`load-profile` execution mode unaffected) and Scenario 13F (retry/idempotency) are automated-only validations without direct visual test scenarios — they are covered by unit tests rather than manual UI testing.
