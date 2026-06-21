# GraphQL Demo Lesson Enhancement Plan

**Status:** Draft  
**Branch target:** `feature/graphql-demo-quality`  
**Created:** 2026-06-20  
**Scope:** All 13 GraphQL demo lessons + new lessons under `src/features/demo-player/lessons/protocols/`

---

## 1. Executive Summary

After a thorough comparison of the Workflow demo lessons (`ws-workflow-builder`, `kafka-workflow-produce`, `kafka-workflow-consume-wait`, `ws-tls-local`, `kafka-secure`, `kafka-tls`) against the 13 GraphQL demo lessons, **five structural quality gaps** were identified:

1. **Concept diagrams are schematic boxes, not mockups** — Workflow lessons use rich 700×430 SVG studio mockups (~190 lines) showing realistic UI chrome. All 13 GraphQL concept diagrams are simple 420×120 pipeline arrows (~22 lines) with no UI fidelity.
2. **Highlight/spotlight mismatches on ~11 steps across 6 lessons** — The `highlight` selector spotlights the *action control* (Execute button, Variables panel) while the step narration describes the *result* (Response body, Tracing tab, response latency). One step (`gql3-write-delete`) has a clear conflict where the primary noun in the description is the editor but the spotlight is the variables panel.
3. **Workflow Integration (GQL-11) steps are thinner than their WS/Kafka counterparts** — No Console tour, no Workflow Runner step, no Debug Mode, no empty-state callout, shorter descriptions overall.
4. **Three entire workflow-era features have no GraphQL lesson** — No GraphQL Mutation node lesson, no GraphQL Subscription node in the Designer, and no "GraphQL Workflow Runner & Results" close-the-loop lesson (analogous to `ws-test-runner` / `kafka-test-runner`).
5. **Security coverage is critically incomplete vs WebSocket and Kafka** — WebSocket has 3 security lessons (Bearer/JWT auth, public TLS, and a 3-phase Docker mTLS lab). Kafka has 2 (SASL and SASL+TLS). GraphQL has 1 (Bearer + API Key auth only) with **no TLS/HTTPS lesson, no subscription authentication, no Basic auth demo, and no OAuth2**. A security-specific Docker stack for GraphQL does not yet exist.

---

## 2. Root Cause Analysis — Why the Quality Gap Exists

### 2.1 Authoring timeline mismatch

The Workflow-adjacent lessons (`ws-workflow-builder`, `kafka-workflow-produce`, `kafka-workflow-consume-wait`) were authored *after* the demo-player authoring rules were fully established. The authors had the rule for "rich concept diagrams" and "always demo power-user features" in hand when they wrote them.

The GraphQL lessons were authored *earlier* (and incrementally extended), before the "full studio mockup SVG" standard was set. Once the baseline was established as simple pipeline arrows, each new GraphQL lesson copied that style. Security topics (`ws-tls`, `ws-tls-local`, `kafka-secure`, `kafka-tls`) were also added in a later wave that did not produce GraphQL equivalents.

### 2.2 Diagram content standard

The WS workspace lesson introduced the richest diagram format: a full painted studio chrome at 700×430 px, showing labeled panels (sidebar, editor pane, response pane, bottom controls) with realistic typography and mock data. This format was never back-ported to the 13 existing GraphQL lessons.

### 2.3 Spotlight strategy inconsistency

The authoring rule says: **highlight the element the user should watch** — not always the button they click. But most GraphQL lessons highlight the *trigger* (Execute, Subscribe, Introspect buttons) even when the narration's payoff is in a different panel (Response body, Tracing waterfall, Schema badge). Workflow lessons carefully separate "action button" steps from "observe result" steps:

- Step N: highlight the **trigger button** → action clicks it
- Step N+1: highlight the **result panel** → spotlight on outcome, action may be None

GraphQL lessons often compress both into one step with a mismatched highlight.

### 2.4 Workflow integration under-scoped

The single GraphQL workflow lesson (`gql-workflow-integration`, 8 steps) shows just the basic "query node + assert node + quick test" loop. WS and Kafka workflow lessons are paired/tripled (`ws-workflow-builder` + `ws-test-runner`; `kafka-workflow-produce` + `kafka-workflow-consume-wait` + `kafka-test-runner`) and include Workflow Runner, Results Dashboard, Console, debug step-through, and load test teardown. No equivalent exists for GraphQL.

### 2.5 Security lessons never prioritized for GraphQL

Auth and TLS lessons were added to the WS and Kafka curricula as dedicated follow-on lessons when those stacks needed Docker-based secure stacks. No one created equivalent Docker infrastructure (`docker/graphql/tls/`) or lesson content for GraphQL security. The existing `gql-auth-headers` (GQL-6) covers only credential injection — not transport encryption, certificate validation, or OAuth.

---

## 3. Lesson Order — Current vs Recommended

### 3.1 Current order (GQL-1 through GQL-13)

```
1  gql-first-query          Your First GraphQL Query
2  gql-variables            Variables & Arguments
3  gql-mutations            Mutations — Create, Update, Delete
4  gql-schema-exploration   Schema Exploration
5  gql-subscriptions        Subscriptions — Real-Time Data
6  gql-auth-headers         Authentication & Headers          ← auth comes AFTER subscriptions
7  gql-query-builder        Query Builder — Visual Operations
8  gql-collections-history  Collections & History
9  gql-export-share         Export & Share Queries
10 gql-performance-tracing  Performance Tracing
11 gql-workflow-integration  Workflow Integration
12 gql-schema-diff          Schema Diff & Breaking Changes
13 gql-mock-server          Mock Server
```

### 3.2 Problems with the current order

| Problem | Detail |
|---------|--------|
| **Auth after subscriptions** | GQL-5 (Subscriptions) teaches real-time GraphQL over WebSocket without any auth context. Real subscription endpoints almost always require Bearer tokens on the WebSocket handshake. Learners finish GQL-5 having never configured auth, then see it for the first time in GQL-6. |
| **No TLS lesson anywhere** | Auth (GQL-6) is not followed by any HTTPS/TLS lesson, leaving a conceptual cliff — learners configure credentials but never learn how to protect them in transit. WebSocket and Kafka both teach auth before or alongside TLS. |
| **Basic auth in concept but not in steps** | GQL-6's `concept.body` mentions Basic auth alongside Bearer and API Key, but no step demonstrates it — an unmet promise in the lesson card. |
| **Workflow lessons split across the curriculum** | GQL-11 (Workflow Integration) sits between Performance Tracing (GQL-10) and Schema Diff (GQL-12), isolated from the new workflow lessons (GQL-14–GQL-16 proposed). These should cluster. |
| **Schema exploration before auth** | Learners are shown the schema tree (GQL-4) before they know how to authenticate — in real teams, endpoints require auth before introspection is allowed. |

### 3.3 Recommended order (after adding new lessons)

The recommended reorder groups lessons into four clear learning arcs:

```
── CORE FUNDAMENTALS ─────────────────────────────────────────────────────
 1  gql-first-query          Your First GraphQL Query  (unchanged)
 2  gql-variables            Variables & Arguments     (unchanged)
 3  gql-schema-exploration   Schema Exploration        (moved up from 4)
── SECURITY ──────────────────────────────────────────────────────────────
 4  gql-auth-headers         Authentication & Headers  (moved up from 6, expanded)
 5  gql-https-tls            HTTPS, TLS & Certificates (NEW — Docker)
── OPERATIONS ────────────────────────────────────────────────────────────
 6  gql-mutations            Mutations                 (moved from 3; now assumes auth)
 7  gql-subscriptions        Subscriptions             (moved from 5; now assumes auth)
── PRODUCTIVITY TOOLING ──────────────────────────────────────────────────
 8  gql-query-builder        Query Builder             (was 7)
 9  gql-collections-history  Collections & History     (was 8)
10  gql-export-share         Export & Share Queries    (was 9)
── ADVANCED / ANALYSIS ───────────────────────────────────────────────────
11  gql-performance-tracing  Performance Tracing       (was 10)
12  gql-schema-diff          Schema Diff               (was 12)
13  gql-mock-server          Mock Server               (was 13)
14  gql-batch-execution      Batch Execution           (NEW)
── WORKFLOW INTEGRATION ──────────────────────────────────────────────────
15  gql-workflow-integration  Workflow Integration     (was 11, expanded)
16  gql-workflow-runner       Workflow Runner & Results (NEW)
17  gql-workflow-mutation     Mutation Node in Workflow (NEW)
18  gql-workflow-subscription Subscription Node        (NEW)
```

**Rationale:**
- Fundamentals (1–3) build core competency before auth concerns
- Security arc (4–5) mirrors WS/Kafka: auth → TLS in sequence; subscriptions now come *after* auth so learners already know how to add tokens
- Operations (6–7) teach mutations and subscriptions knowing auth is available
- Tooling (8–10) and Advanced (11–14) remain structurally similar to current
- Workflow cluster (15–18) groups all four workflow lessons together at the end

---

## 4. Security Gap Analysis

### 4.1 Security curriculum comparison across protocols

| Security Topic | WebSocket | Kafka | GraphQL (current) |
|----------------|-----------|-------|-------------------|
| Bearer / JWT auth | ✅ `ws-auth-transport` — JWT demo token, proxy transport auto-select | N/A (SASL) | ✅ `gql-auth-headers` — env-resolved `{{authToken}}` |
| API Key auth | Mentioned (query-string) | N/A | ✅ `gql-auth-headers` — `X-API-Key` header |
| Basic auth | Mentioned in concept only | N/A | Mentioned in concept only — **not demo'd** |
| OAuth2 / OIDC | Mentioned in concept only | N/A | **❌ Absent** |
| Auth profiles / persistence | ✅ `ws-power-user` (`pu-auth-persist`) | Encrypted local store (`kafka-secure` concept) | ✅ `gql-auth-headers` (profile save step) |
| Auth failure / rejection | Mock accepts any token | Real SASL handshake errors | Server **does not validate tokens** (stated explicitly in concept) |
| Transport mode selection | ✅ `ws-auth-transport` — Direct/Proxy/Native | N/A | **❌ No transport lesson for HTTP** |
| HTTPS / TLS encryption | ✅ `ws-tls` (public wss echo server) | ✅ `kafka-tls` (SASL+TLS, skip-cert) | **❌ No HTTPS/TLS lesson** |
| Skip certificate validation | ✅ `ws-tls` + `ws-tls-local` | ✅ `kafka-tls` | **❌ Absent** |
| Custom CA / certificate chain | ✅ `ws-tls-local` Phase 2 | Partial | **❌ Absent** |
| Mutual TLS (mTLS / client certs) | ✅ `ws-tls-local` Phase 3 | **❌ Absent** | **❌ Absent** |
| SASL / broker auth | N/A | ✅ `kafka-secure` (PLAIN, SCRAM-256, SCRAM-512) | N/A |
| Subscription auth over WebSocket | ✅ `ws-auth-transport` | N/A | **❌ GQL-5 has no auth step** |
| Security-specific Docker stack | ✅ `docker/websocket/` (TLS + mTLS) | ✅ `docker/kafka/secure/` + `docker/kafka/tls/` | **❌ No TLS Docker variant for graphql** |

### 4.2 Verdict

GraphQL's security curriculum covers only **credential injection** (Bearer + API Key). The full security stack — transport encryption, certificate validation, mTLS, subscription channel authentication — is **entirely absent**. This is a significant parity gap given that HTTPS-only GraphQL APIs are the production norm.

---

## 5. Issue Catalog — Specific Highlight/Spotlight Mismatches

### 5.1 Clear conflict (description noun ≠ spotlight target)

| Lesson | Step ID | Description says | highlight points to | Fix |
|--------|---------|-----------------|---------------------|-----|
| GQL-3 Mutations | `gql3-write-delete` | "Load the **deleteUser mutation**" (editor action) | `GQL.VARS_PANEL` (variables panel) | Split into two steps: step A highlights `GQL.EDITOR`, step B highlights `GQL.VARS_PANEL` for variable wiring |

### 5.2 Action/outcome conflation (trigger spotlighted; narration describes result)

| Lesson | Step ID | Spotlight | Narration emphasizes | Fix |
|--------|---------|-----------|----------------------|-----|
| GQL-1 First Query | `gql1-execute` | `GQL.EXECUTE_BTN` | Response tab + `"health": "ok"` body | Add follow-on step `gql1-read-response` on `GQL.RESPONSE_BODY` |
| GQL-3 Mutations | `gql3-create-exec` | `GQL.VARS_PANEL` | Also covers Execute click + response panel outcome | Separate: set-vars step / execute step / read-response step |
| GQL-3 Mutations | `gql3-input-type` | `GQL.EDITOR` | Also covers Variables + Execute + response | Split into write-mutation step / execute step |
| GQL-3 Mutations | `gql3-idempotency` | `GQL.RESPONSE_BODY` | "Click Execute — click Execute again" (two distinct clicks) | Separate the two execute actions; add second execute step |
| GQL-5 Subscriptions | `gql5-intro` | `GQL.TAB_BAR` | Also describes connection bar Subscribe + right panel log | Expand intro or add a `GQL.CONNECTION_BAR` step |
| GQL-5 Subscriptions | `gql5-write-sub` | `GQL.EDITOR` | Also mentions transport select (`gql-transport-select`) | Add `GQL.TRANSPORT_SELECT` step between write-sub and subscribe |
| GQL-10 Perf Tracing | `gql10-execute` | `GQL.EXECUTE_BTN` | Outcome is Tracing badge appearing | Add step `gql10-tracing-badge` spotlighting `GQL.RV_TRACING_BADGE` |
| GQL-11 Workflow | `gql11-run-fail` | `GQL.WF_CANVAS_ASSERT_NODE` | Re-open Assert config before the failure | Split: tighten-threshold step / observe-failure step |
| GQL-13 Mock Server | `gql13-execute-mock` | `GQL.EXECUTE_BTN` | Outcome is `mock-ok` in response body | Add step `gql13-observe-mock-response` on `GQL.RESPONSE_BODY` |
| GQL-13 Mock Server | `gql13-latency` | `GQL.MOCK_LATENCY_SLIDER` | Also describes latency indicator in response | Add step `gql13-observe-latency-effect` on `GQL.RESPONSE_LATENCY` |
| GQL-13 Mock Server | `gql13-restore-live` | `GQL.MOCK_TOGGLE` | Multi-action restore (toggle + endpoint + introspect + execute) | Split into disable-mock step / verify-live step |

### 5.3 Description density gaps in GQL-11 (vs WS/Kafka workflow peers)

| Step ID | Current word count (approx) | Issue |
|---------|------------------------------|-------|
| `gql11-create` | ~30 words | No "watch for" framing, no empty-state callout, no palette overview (compare to WS workflow: 2–3× longer) |
| `gql11-query-node` | ~25 words | No explanation of *why* a GraphQL Query node exists vs a generic HTTP node |
| `gql11-assert-node` | ~25 words | No explanation of what GraphQL Assert does that a generic Assert cannot |
| `gql11-run-pass` | ~35 words | No Console tour, no mention of how to read execution output, no timing notes |

---

## 6. Concept Diagram Enhancement

All 13 GraphQL lessons use 420×120 schematic arrows. Each must be upgraded to match the standard established by `ws-workspace.ts` (700×430 studio mockup, ~190 lines of SVG).

### 6.1 Diagram target matrix

| Lesson | Current diagram | Target diagram style |
|--------|-----------------|----------------------|
| GQL-1 First Query | Endpoint → Introspect → Query → Response pipeline | **GraphQL Studio chrome**: connection bar, editor pane, right panel (Schema/Response tabs), bottom bar. Arrows overlay the 5-step flow. |
| GQL-2 Variables | Pipeline: Query → Variables → Execute → Compare | **Studio chrome** with editor pane + Variables bottom panel; two "Alice / Bob" result columns in mocked response panel |
| GQL-3 Mutations | Three-box: createUser → createOrder → deleteUser | **Studio chrome** with M badge on tab, mutation in editor, returned id in response panel |
| GQL-4 Schema Exploration | Introspect → Browse → Try → Insert pipeline | **Studio chrome** split: editor on left, Schema Explorer tree on right with type detail panel open |
| GQL-5 Subscriptions | createOrder → Subscribe → Events stream | **Studio chrome** with Subscribe button on connection bar, subscription log replacing response panel, event rows accumulating |
| GQL-6 Auth & Headers | Bearer → Env Var → API Key pipeline | **Studio chrome** with auth popover open, bearer input, header preview, HTTPS padlock on endpoint |
| GQL-7 Query Builder | Field tree → Selection → Query → Execute pipeline | **Studio chrome** with Builder mode active, field tree on left, generated query on right |
| GQL-8 Collections & History | Execute → Preview → Collection → Export | **Studio chrome** with left activity bar (History + Collections icons highlighted), save dialog overlay |
| GQL-9 Export & Share | Builder → Preview → Copy → cURL pipeline | **Studio chrome** showing Builder view + history context menu with cURL option |
| GQL-10 Perf Tracing | Complexity → Execute → Waterfall → Histogram | **Studio chrome** with response panel showing Tracing tab, waterfall bars, histogram strip below |
| GQL-11 Workflow Integration | Start → GQL Query → GQL Assert → End | **Workflow Designer chrome**: canvas with 4 nodes wired, Quick Test button, green/red node state overlay |
| GQL-12 Schema Diff | Snapshot → Changelog → Diff → Export | **Studio chrome** showing Schema Explorer with Changelog tab, diff modal overlay |
| GQL-13 Mock Server | Mock → Endpoint → Resolver → Override | **Studio chrome** with Mock panel open on left, endpoint bar showing :3001/mock, mock response in result panel |

### 6.2 SVG size standard

- **Width:** 700px viewBox  
- **Height:** 380–430px viewBox  
- **Style:** Painted chrome (rounded rects for panels, simulated tab bars, text labels for UI elements)  
- **Arrows:** Same `var(--primary)` marker style, sized and positioned over the chrome  
- **Data:** Include mocked field values (e.g. `"health": "ok"`, latency badges `~12ms`) to make diagrams feel real  

---

## 7. New Lessons to Add

Lessons are listed in recommended curriculum order (see §3.3 for context).

---

### 7.1 GQL-5 (new): HTTPS, TLS & Certificates *(HIGH PRIORITY — Security)*

**ID:** `gql-https-tls`  
**Estimated minutes:** 6  
**Position:** Immediately after `gql-auth-headers` in the security arc (slot 5 in recommended order)  
**Docker:** Yes — `docker/graphql/tls/` stack (✅ **IMPLEMENTED** — nginx TLS proxy, certs generated)  
**dockerEndpoint:** `http://localhost:4444/health` (plain HTTP health probe — PrerequisiteGate)  
**dockerCommand:** `cd docker/graphql/tls && ./generate-cert.sh && docker compose up -d`  
**tag:** `🐳 Docker`  
**Analogy:** `ws-tls-local` (3-phase TLS lab: skip-cert → CA cert → mTLS)  

**Port map (all implemented):**

| Port | Purpose |
|------|---------|
| `4443` | HTTPS / WSS — TLS proxy (Phase 1 + Phase 2) |
| `4444` | HTTP — Health probe for PrerequisiteGate (Phase 1 + Phase 2) |
| `4445` | HTTPS / WSS — mTLS proxy (Phase 3) |
| `4446` | HTTP — Health probe (Phase 3) |

**Cert constants to embed in lesson helper (`lesson-https-tls.ts`):**
```
CA cert: docker/graphql/tls/certs/ca.crt      → GQL_TLS_CA_CERT
Client cert: docker/graphql/tls/certs/client.crt → GQL_TLS_CLIENT_CERT
Client key: docker/graphql/tls/certs/client.key  → GQL_TLS_CLIENT_KEY
```
Follow the pattern of `DEV_CA_CERT`, `DEV_CLIENT_CERT`, `DEV_CLIENT_KEY` in `ws-tls-local.ts`.

**Why it matters:** All production GraphQL APIs are served over HTTPS. Learners finish GQL-6 (auth) knowing how to inject credentials but with no understanding of how those credentials are protected in transit. The `ws-tls-local` lesson is the most detailed security lesson in the codebase; GraphQL deserves an equivalent.

**Concept body topics:**
- HTTPS = HTTP + TLS: the cert handshake, chain of trust, what a self-signed cert is
- "Skip certificate verification" — what `rejectUnauthorized: false` disables and why it is dev-only
- Custom CA PEM — trusting your organisation's internal CA (staging environments)
- How RedfireForge applies TLS settings: web → Node.js proxy; Tauri desktop → native Rust (no proxy)
- Table: Plain (port 4010) vs TLS (port 4443) vs SASL+TLS (N/A for HTTP GraphQL)

**Proposed steps (8 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gqlt-intro` | HTTPS for GraphQL | Explain why every production GraphQL API is HTTPS-only. The local TLS server on port 4443 has a self-signed cert — the perfect testbed. Point out the `https://` prefix in the endpoint field. |
| `gqlt-tls-panel` | TLS Configuration Panel | Spotlight the TLS settings section below the endpoint input. It appears when the URL starts with `https://`. Explain the three controls: skip-cert, CA certificate, and client certificate fields. |
| `gqlt-skip-cert` | Phase 1 — Skip Certificate Validation | Enable "Skip certificate validation". Explain what `rejectUnauthorized: false` bypasses (hostname check, chain-of-trust check, expiry check). Show the transport badge changing to Proxy in web mode. |
| `gqlt-connect-skip` | Introspect Over TLS (Phase 1) | Click Introspect against `https://localhost:4443/graphql`. Schema loads despite the self-signed cert. Execute `query { health }` — response body is encrypted in transit. Spotlight `GQL.SCHEMA_BADGE_OK`. |
| `gqlt-ca-cert` | Phase 2 — Custom CA Certificate | Disable skip-cert. Paste the Dev Root CA PEM into the CA Certificate field. Now the proxy validates the full certificate chain: the server's cert was signed by this CA, so the connection is trusted without bypassing validation. |
| `gqlt-connect-ca` | Introspect with CA Validation | Introspect again. Certificate chain validates — connection succeeds and schema loads. The difference from Phase 1: a rogue server with a different certificate would be rejected, not accepted. |
| `gqlt-auth-tls` | Credentials Over TLS | Open the Auth popover → set Bearer `{{authToken}}`. Execute the health query. Open the Metadata tab → confirm `Authorization` header is present. The key point: auth credentials are encrypted inside the TLS tunnel and never travel in plain text. |
| `gqlt-restore` | Restore to Plain HTTP | Switch endpoint back to `http://localhost:4010/graphql`, re-introspect, verify the schema loads without any TLS settings. Explain when to use plain HTTP (local dev only, loopback only, no credentials). |

---

### 7.2 GQL-6 (expanded): Authentication & Headers — Add Basic Auth and Subscription Auth

The existing `gql-auth-headers` lesson (7 steps) needs two additions:

**Addition A — Basic Auth demo steps (currently in concept body only):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql6-basic` | Basic Auth | Open Auth popover → select **Basic**. Enter username `demo` and password `demo-pass`. The preview shows `Authorization: Basic ZGVtbzpkZW1vLXBhc3M=` (base64-encoded). Note: Basic auth requires HTTPS in production — the credentials are only base64-encoded, not encrypted by the auth mechanism itself. |
| `gql6-basic-exec` | Execute with Basic Auth | Click Execute → Metadata tab → confirm the `Authorization: Basic …` header. Compare the value to Bearer — Basic is a different encoding scheme but uses the same `Authorization` header name. |

**Addition B — Subscription channel auth (cross-reference to GQL-7):**

Add a new final step to GQL-6 (`gql6-subscription-auth`):

> **Subscriptions and Auth:** When you configure Bearer or API Key auth on the connection bar, RedfireForge automatically includes the credential in the WebSocket handshake for subscriptions. You don't need separate auth for the subscription channel — the same profile applies. Lesson 7 (Subscriptions) will show this in action.

---

### 7.3 GQL-15 (new): GraphQL Workflow Runner & Results *(HIGH PRIORITY — Workflow)*

**ID:** `gql-workflow-runner`  
**Estimated minutes:** 5  
**initialTab:** `workflow-runner`  
**allowedTabs:** `['workflow', 'workflow-runner']`  
**Docker:** same GraphQL test server  
**Analogy:** `ws-test-runner`, `kafka-test-runner`  
**Position:** Immediately after `gql-workflow-integration` in the workflow arc (slot 16)

**Why it matters:** GQL-11 only shows Quick Test in the Designer. No lesson shows how to take a GraphQL workflow into the Workflow Runner for load testing, inspect Results Dashboard node-level aggregates, or drill into Results Explorer.

**Proposed steps (10 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql15-open-runner` | Open Workflow Runner | Navigate to Workflow Runner, select the "GraphQL Latency Check" workflow from GQL-11. Explain Run vs Quick Test: Quick Test is for single-iteration debugging; Runner is for load, concurrency, and results analysis. |
| `gql15-runner-variables` | Runtime Variable Overrides | Show the variable override panel — change the endpoint variable at run time without editing the workflow definition. Explain this mirrors the `wf-runner-variable` step in `ws-workflow-builder`. |
| `gql15-config-run` | Configure the Run | Set iterations: 10, concurrency: 2, think time: 200ms. Explain what each parameter controls and why concurrency matters for GraphQL (connection pooling vs parallel queries). |
| `gql15-start-run` | Start the Run | Click Run. Watch the node execution counter increment. Highlight the live progress bar and per-node iteration tracker. |
| `gql15-results-dashboard` | Results Dashboard — Overview | Navigate to Results after run completes. Explain throughput cards (req/s, p50, p95, error rate). Highlight how GraphQL latency values map to the tracing data seen in GQL-11. |
| `gql15-node-filter` | Filter by Node | Use the Workflow Runs filter to select "GraphQL Query" node only. Observe how the histogram changes. |
| `gql15-results-explorer` | Open Results Explorer | Click the Results Explorer modal. Show the three-panel layout: canvas, detail panel, iteration matrix. |
| `gql15-canvas-overlay` | Execution State Overlay | Hover a node in the canvas — popover shows per-node latency, pass/fail counts across all iterations. |
| `gql15-bottleneck` | Bottleneck Identification | Sort nodes by P95 latency. The GraphQL Query node should be the only non-trivial node. |
| `gql15-export-results` | Export Results | Export run results as JSON. Explain how CI can consume this for threshold assertions. |

---

### 7.4 GQL-16 (new): GraphQL Mutation Node in Workflow *(MEDIUM PRIORITY)*

**ID:** `gql-workflow-mutation`  
**Estimated minutes:** 4  
**initialTab:** `workflow`  
**Docker:** same GraphQL test server  
**Analogy:** `kafka-workflow-produce`  
**Position:** After GQL-15 (Workflow Runner) in the workflow arc (slot 17)

**Why it matters:** GQL-11 only uses a GraphQL Query node. There is no lesson showing how to chain mutations (create data) then read-back queries (verify the created data) in a workflow — a very common integration-test pattern.

**Proposed steps (8 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql16-intro` | GraphQL Mutation Node | Explain the Mutation node's purpose: write data, bind returned fields as variables for downstream nodes. Prerequisite: GQL-11. Analogous to Kafka's produce node. |
| `gql16-canvas-tour` | The Mutation Workflow | Pre-built canvas: Start → GQL Mutation → GQL Query → GQL Assert → End. Tour each node type and explain the data flow direction. |
| `gql16-config-mutation` | Configure the Mutation | Set endpoint, paste createUser mutation text, set variables JSON with `{{testName}}` template variable. |
| `gql16-output-binding` | Bind the Returned ID | Output tab: bind `data.createUser.id` → `createdUserId`. Explain this is analogous to the Kafka produce output binding. |
| `gql16-config-query` | Read Back the Created User | Wire `createdUserId` into a `user(id: $createdUserId)` query to verify the server persisted the mutation. |
| `gql16-assert` | Assert the User Exists | Assert node: JSONPath `$.user.name`, operator `equals`, expected `{{testName}}`. Show how the variable flows mutation → query → assert. |
| `gql16-quick-test` | Quick Test the Chain | Quick Test — three nodes light green in sequence. Console shows mutation request, query request, assert pass. |
| `gql16-cleanup` | Teardown with deleteUser | Add a GQL Mutation node after assert for deleteUser, wiring `createdUserId`. Explain teardown patterns for integration tests. |

---

### 7.5 GQL-17 (new): GraphQL Subscription Node in Workflow *(MEDIUM PRIORITY)*

**ID:** `gql-workflow-subscription`  
**Estimated minutes:** 5  
**initialTab:** `workflow`  
**Docker:** same GraphQL test server  
**Analogy:** `kafka-workflow-consume-wait`  
**Position:** After GQL-16 (Mutation in Workflow) in the workflow arc (slot 18)

**Why it matters:** The Kafka consume-wait pattern maps directly to GraphQL subscriptions in workflow context: trigger a mutation, wait for the subscription to emit the resulting event, assert the event payload. This is the most powerful real-time testing pattern and has no GraphQL lesson.

**Proposed steps (9 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql17-intro` | GraphQL Subscription Node | Explain event-driven testing: trigger an action, wait for the system to emit the corresponding event. Analogy: Kafka consume-wait. |
| `gql17-canvas-tour` | Seeded Canvas Tour | Pre-built canvas: Start → GQL Mutation (createOrder) → GQL Subscription (orderStatus) → GQL Assert → End. |
| `gql17-config-sub` | Configure the Subscription Node | Set endpoint, paste `subscription { orderStatus(orderId: $orderId) { status } }`, bind `orderId` from mutation output. |
| `gql17-timeout` | Subscription Timeout | Explain the timeout field: how long the node waits before failing if no matching event arrives. Contrast with Kafka's `maxWaitMs`. |
| `gql17-correlation` | Correlation Expression | Show how the subscription node waits for a *specific* event (matching `orderId`) rather than the first event. Compare to Kafka wait-for-correlation. |
| `gql17-sample-payload` | Sample Payload for Quick Test | Set a sample event payload so Quick Test can simulate a matching event without a live WebSocket stream. Anti-hang pattern from Kafka lessons. |
| `gql17-quick-test` | Quick Test | Run Quick Test — mutation fires, subscription node receives simulated COMPLETE event, assert passes. Console shows the full chain. |
| `gql17-load-behavior` | Load Test Behavior | Explain auto-resume vs wait-for-real-event. In load tests, each iteration must get its own subscription event (not shared across concurrent users). |
| `gql17-summary` | Summary | Recap the create → subscribe → assert → close pattern. Tease cross-protocol workflows (HTTP trigger + GQL subscription wait). |

---

### 7.6 GQL-18 (new): GraphQL Batch Execution *(LOW PRIORITY)*

**ID:** `gql-batch-execution`  
**Estimated minutes:** 3  
**Docker:** same GraphQL test server  
**Position:** Slot 14 in advanced/analysis arc

**Why it matters:** The `GQL.BATCH_RESULTS` selector exists in `selectors.ts` but no lesson demonstrates batched query execution or the batch results panel.

**Proposed steps (6 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql18-intro` | Batch Execution | Explain batched GraphQL: send multiple operations in one HTTP request. Show the batch results panel concept. |
| `gql18-add-tab` | Add a Second Tab | Click + to add a second editor tab. Write a different query in each tab. |
| `gql18-batch-run` | Batch Run All Tabs | Click Batch Execute. Explain how all open operations are sent as an array in one request. |
| `gql18-batch-results` | Batch Results Panel | Spotlight `GQL.BATCH_RESULTS`. Each operation result is shown as a numbered entry. |
| `gql18-partial-error` | Partial Error Handling | One query intentionally returns an error; the other succeeds. Show that batch doesn't fail-fast — partial success is valid. |
| `gql18-export-batch` | Export Batch Results | Export all batch results as a single JSON. Explain use in CI baseline snapshots. |

---

## 8. Environment & Microservice Creation in Demo Steps

### 8.1 Current behavior (problem)

The existing `gql1-env-config` step calls `configureProtocolEndpointInEnvManager` which:
1. Opens the Environment Manager
2. Calls `expandFirstMicroservice` — expands **whatever is already there**, with no dedicated name
3. Configures the protocol endpoint on that anonymous microservice

This means:
- If the user has existing microservices, the demo overwrites their configuration
- The demo does not create a recognizable "demo" environment or microservice
- The spotlight (`highlight: EM.PROTOCOL_PANEL`) highlights the correct panel, but the demo step modal **may become obscured** when the lesson action navigates away from the GraphQL Studio to the Environments page

### 8.2 Required behavior

Every lesson that configures environment endpoints **must**:

1. **Create a dedicated environment** named `"GraphQL Demo"` (if not already present)
2. **Create a dedicated microservice** named `"graphql-demo"` (if not already present)
3. **Select that environment and microservice** before configuring the protocol endpoint
4. **Keep the demo step modal visible** — the lesson's spotlight overlay must remain rendered and positioned during the env manager navigation

### 8.3 Implementation plan for `env-manager-lesson-helpers.ts`

Add two new helpers:

```typescript
/** Create (or find existing) a named environment. Returns the environment id. */
export async function ensureDemoEnvironment(
  ctx: DemoActionContext,
  name: string,
): Promise<string>

/** Create (or find existing) a named microservice. Returns the microservice id. */
export async function ensureDemoMicroservice(
  ctx: DemoActionContext,
  name: string,
): Promise<string>
```

And update `configureProtocolEndpointInEnvManager` to accept optional `envName` / `svcName` parameters that, when provided, call the above helpers before expanding the microservice card.

### 8.4 Demo step modal visibility

The demo player renders the step spotlight overlay using a fixed-position element over `document.body`. When a lesson action navigates to a new tab (e.g. Environments), the spotlight remains rendered — **but it may need a repaint tick** to reposition over the new tab's DOM element.

Fix: add `await ctx.delay(400)` after any tab navigation inside an `action()` that also sets a `highlight`. This gives React time to mount the env manager DOM before the spotlight calculates its bounding rect.

The `gql1-env-config` step already does this in `preAction` (navigates back to GQL Studio before the spotlight renders). The TLS lesson's env-config steps must follow the same pattern.

### 8.5 Updated `gql1-env-config` step (reference implementation)

```typescript
{
  id: 'gql1-env-config',
  title: 'Create the GraphQL Demo Environment',
  description:
    'Open **Settings → Environments**. The demo creates a dedicated **GraphQL Demo** ' +
    'environment and **graphql-demo** microservice — separate from your real configs. ' +
    'Click the **GraphQL** protocol tab, set the endpoint to `http://localhost:4010`, ' +
    'and watch `{{graphqlUrl}}` resolve in the derived-variables panel.',
  highlight: EM.PROTOCOL_PANEL,
  pauseAfter: true,
  preAction: async (ctx) => {
    if (!document.querySelector(GQL.ENDPOINT_INPUT)) {
      await navigateToGraphqlStudio(ctx);
    }
  },
  action: async (ctx) => {
    await navigateToEnvironmentManager(ctx);
    await ensureDemoEnvironment(ctx, 'GraphQL Demo');
    await ensureDemoMicroservice(ctx, 'graphql-demo');
    await ctx.delay(400);  // repaint tick so spotlight binds to env manager DOM
    await configureProtocolEndpointInEnvManager(ctx, 'graphql', 'http://localhost:4010', {
      httpFallbackBase: 'http://localhost:4010',
      graphqlPath: '/graphql',
      envName: 'GraphQL Demo',
      svcName: 'graphql-demo',
    });
    await ctx.delay(1500);
  },
},
```

---

## 9. Step-Level Enhancement Plan (Existing Lessons)

### 8.1 Priority 1 — Fix spotlight mismatches (immediate)
*Estimated effort: 2–3 hours*

| File | Step(s) | Change |
|------|---------|--------|
| `graphql-mutations.ts` | `gql3-write-delete` | Change `highlight` from `GQL.VARS_PANEL` to `GQL.EDITOR`. Add separate step `gql3-wire-delete-var` highlighting `GQL.VARS_PANEL`. |
| `graphql-first-query.ts` | `gql1-execute` | Add step `gql1-read-response` highlighting `GQL.RESPONSE_BODY`, narrating `"health": "ok"`. |
| `graphql-mutations.ts` | `gql3-create-exec` | Split: `gql3-set-create-vars` (`GQL.VARS_PANEL`) + `gql3-exec-create` (`GQL.EXECUTE_BTN`) + `gql3-read-create-response` (`GQL.RESPONSE_BODY`). |
| `graphql-mutations.ts` | `gql3-input-type` | Split: `gql3-write-order-mutation` (`GQL.EDITOR`) + `gql3-exec-order` (`GQL.EXECUTE_BTN`). |
| `graphql-subscriptions.ts` | `gql5-intro` | Expand or add step spotlighting `GQL.CONNECTION_BAR` for the Subscribe button callout. |
| `graphql-subscriptions.ts` | `gql5-write-sub` | Add `GQL.TRANSPORT_SELECT` step between write-sub and subscribe. |
| `graphql-performance-tracing.ts` | `gql10-execute` | Add step `gql10-tracing-badge` spotlighting `GQL.RV_TRACING_BADGE`. |
| `graphql-workflow-integration.ts` | `gql11-run-fail` | Split: `gql11-tighten-threshold` (`GQL.WF_ASSERT_ROW`) + `gql11-observe-failure` (`GQL.WF_CANVAS_ASSERT_NODE`). |
| `graphql-mock-server.ts` | `gql13-execute-mock` | Add `gql13-observe-mock-response` step on `GQL.RESPONSE_BODY`. |
| `graphql-mock-server.ts` | `gql13-latency` | Add `gql13-observe-latency-effect` step on `GQL.RESPONSE_LATENCY`. |
| `graphql-mock-server.ts` | `gql13-restore-live` | Split: `gql13-disable-mock` + `gql13-verify-live`. |

### 8.2 Priority 2 — Description depth upgrades for GQL-11

| Step | Upgrade notes |
|------|---------------|
| `gql11-create` | Add: "A blank workflow opens with Start and End nodes pre-placed. The **Blocks Palette** on the left organizes node types into Actions, Logic, and Triggers — GraphQL nodes live in Actions." |
| `gql11-query-node` | Add: "The **GraphQL Query** node is purpose-built for introspection-aware execution — it understands operation type (Q/M/S) and exposes per-field latency in its output bindings, unlike a generic HTTP node." |
| `gql11-config-query` | Add: "The **Output** tab is the GraphQL Query node's superpower — bind `latencyMs`, `responseBody`, `errorCount`, or any extracted JSONPath value to a named workflow variable available in every downstream node." |
| `gql11-assert-node` | Add: "The **GraphQL Assert** node evaluates arbitrary conditions against upstream variables. Unlike a generic Assert, it shows the original GraphQL operation that produced the value, making failures easier to triage." |
| `gql11-run-pass` | Add: "Open the **Console** before clicking Quick Test — it streams per-node execution logs in real time. After the run, green nodes show execution time in the badge; click a node to see its full input/output." |

### 8.3 Priority 3 — Add Console and Debug steps to GQL-11

**New step `gql11-console`** (between `gql11-assert-rule` and `gql11-run-pass`):
- Title: "Open the Console Before Running"  
- highlight: `WF.CONSOLE_BADGE`  
- Description: Click the **Console** badge to expand the execution log panel. Open it *before* Quick Test so you can watch each node's request and response stream in real time.

**New step `gql11-debug-mode`** (after `gql11-run-fail`):
- Title: "Step Through with Debug Mode"  
- highlight: `WF.DEBUG_BTN`  
- Description: Instead of Quick Test, click the **Debug** button. The workflow pauses after each node — inspect intermediate variable values before advancing. Useful for diagnosing assertion failures node by node.

### 8.4 Priority 4 — Add Basic Auth steps and subscription auth callout to GQL-6

Add two steps after `gql6-execute-apikey`:
- `gql6-basic` — Open Auth popover → select Basic → enter username/password → preview header
- `gql6-basic-exec` — Execute + Metadata tab confirms `Authorization: Basic …`

Add a final step `gql6-subscription-auth` explaining that the same credentials apply to subscription WebSocket handshakes (bridge to GQL-7 Subscriptions in recommended order).

### 8.5 Priority 5 — estimatedMinutes accuracy review

| Lesson | Steps (current → after changes) | Current est. | Corrected estimate |
|--------|----------------------------------|-------------|-------------------|
| GQL-1 | 8 → 9 | 4 min | **4 min** ✅ |
| GQL-2 | 8 | 3 min | **4 min** (+1) |
| GQL-3 | 9 → 13 | 4 min | **6 min** (+2) |
| GQL-4 | 7 | 3 min | **3 min** ✅ |
| GQL-5 | 10 → 12 | 4 min | **5 min** (+1) |
| GQL-6 | 7 → 10 | 3 min | **5 min** (+2) |
| GQL-7 | 10 | 4 min | **5 min** (+1) |
| GQL-8 | 8 | 3 min | **4 min** (+1) |
| GQL-9 | 5 | 3 min | **3 min** ✅ |
| GQL-10 | 7 → 8 | 4 min | **4 min** ✅ |
| GQL-11 | 8 → 12 | 4 min | **5 min** (+1) |
| GQL-12 | 7 | 3 min | **3 min** ✅ |
| GQL-13 | 7 → 10 | 3 min | **5 min** (+2) |
| GQL-TLS (new) | 8 | — | **6 min** |
| GQL-WF-Runner (new) | 10 | — | **5 min** |
| GQL-WF-Mutation (new) | 8 | — | **4 min** |
| GQL-WF-Sub (new) | 9 | — | **5 min** |
| GQL-Batch (new) | 6 | — | **3 min** |

**Total curriculum time after all changes:** ~85 min (up from ~41 min)

---

## 9. Complete Lesson Roster (Final State)

```
── CORE FUNDAMENTALS ─────────────────────────────────────────────────────
 1  gql-first-query          Your First GraphQL Query          4 min
 2  gql-variables            Variables & Arguments             4 min
 3  gql-schema-exploration   Schema Exploration                3 min
── SECURITY ──────────────────────────────────────────────────────────────
 4  gql-auth-headers         Authentication & Headers          5 min  [expanded]
 5  gql-https-tls            HTTPS, TLS & Certificates         6 min  [NEW 🐳 Docker]
── OPERATIONS ────────────────────────────────────────────────────────────
 6  gql-mutations            Mutations                         6 min  [reordered + expanded]
 7  gql-subscriptions        Subscriptions                     5 min  [reordered + expanded]
── PRODUCTIVITY TOOLING ──────────────────────────────────────────────────
 8  gql-query-builder        Query Builder                     5 min
 9  gql-collections-history  Collections & History             4 min
10  gql-export-share         Export & Share Queries            3 min
── ADVANCED / ANALYSIS ───────────────────────────────────────────────────
11  gql-performance-tracing  Performance Tracing               4 min
12  gql-schema-diff          Schema Diff & Breaking Changes    3 min
13  gql-mock-server          Mock Server                       5 min  [expanded]
14  gql-batch-execution      Batch Execution                   3 min  [NEW 🐳 Docker]
── WORKFLOW INTEGRATION ──────────────────────────────────────────────────
15  gql-workflow-integration Workflow Integration              5 min  [expanded]
16  gql-workflow-runner      Workflow Runner & Results         5 min  [NEW 🐳 Docker]
17  gql-workflow-mutation    Mutation Node in Workflow         4 min  [NEW 🐳 Docker]
18  gql-workflow-subscription Subscription Node in Workflow   5 min  [NEW 🐳 Docker]
─────────────────────────────────────────────────────────────────────────
                                             Total            ~85 min
```

---

## 10. Implementation Checklist

### Phase 1: Spotlight Fixes
*Estimated effort: 2–3 hours — no new files, no Docker changes*

- [ ] Fix `gql3-write-delete` highlight (`GQL.EDITOR` not `GQL.VARS_PANEL`)
- [ ] Add `gql1-read-response` step after `gql1-execute`
- [ ] Split `gql3-create-exec` into 3 steps
- [ ] Split `gql3-input-type` into 2 steps
- [ ] Add `gql5-connection-bar` intro step or expand `gql5-intro`
- [ ] Add `gql5-transport-select` step
- [ ] Add `gql10-tracing-badge` step
- [ ] Split `gql11-run-fail` into 2 steps
- [ ] Add `gql13-observe-mock-response` step
- [ ] Add `gql13-observe-latency-effect` step
- [ ] Split `gql13-restore-live` into 2 steps
- [ ] Update all affected test files (step count, IDs, estimatedMinutes)
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run` on touched test files → zero failures

### Phase 2: Description Depth + Diagram Upgrades
*Estimated effort: 4–6 hours*

- [ ] Expand GQL-11 step descriptions (5 steps)
- [ ] Add `gql11-console` step
- [ ] Add `gql11-debug-mode` step
- [ ] Add Basic Auth steps to GQL-6 (`gql6-basic`, `gql6-basic-exec`, `gql6-subscription-auth`)
- [ ] Upgrade `estimatedMinutes` on all affected lessons (see §8.5)
- [ ] Upgrade concept diagrams — all 13 lessons to 700×430 studio chrome SVG
  - [ ] GQL-1, GQL-2, GQL-3, GQL-4, GQL-5, GQL-6
  - [ ] GQL-7, GQL-8, GQL-9, GQL-10, GQL-11, GQL-12, GQL-13
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run` on touched test files → zero failures

### Phase 3: Lesson Reorder
*Estimated effort: 1 hour — registry-only change*

- [ ] Update `graphql-lessons.ts` array to new order (§9 roster)
- [ ] Update lesson IDs/numbers in description cross-references ("Lesson 8 covers…" etc.)
- [ ] Update test files that assert lesson index positions
- [ ] `npx tsc -b --noEmit` → zero errors

### Phase 4: New Security Lesson (GQL-5 HTTPS/TLS)
*Estimated effort: 2–3 hours remaining — Docker infrastructure complete*

**Docker infrastructure (✅ DONE — 2026-06-20):**
- [x] `docker/graphql/tls/generate-cert.sh` — CA + leaf chain, OU=GraphQL Studio
- [x] `docker/graphql/tls/generate-client-cert.sh` — mTLS client cert
- [x] `docker/graphql/tls/docker-compose.yml` — TLS proxy (port 4443), health probe (port 4444)
- [x] `docker/graphql/tls/docker-compose.mtls.yml` — mTLS proxy (port 4445), health probe (port 4446)
- [x] `docker/graphql/tls/nginx-gql-tls.conf` — HTTPS + WSS proxy config
- [x] `docker/graphql/tls/nginx-gql-mtls.conf` — mTLS proxy config (ssl_verify_client on)
- [x] `docker/graphql/tls/README.md` — setup docs + curl verification examples
- [x] Certs generated: `ca.crt`, `server.crt/key`, `client.crt/key` in `certs/`

**Lesson implementation (TODO):**
- [ ] Implement `ensureDemoEnvironment` + `ensureDemoMicroservice` helpers in `env-manager-lesson-helpers.ts` (see §8.3)
- [ ] Create `graphql-lesson-helpers/lesson-https-tls.ts` — embed `GQL_TLS_CA_CERT`, `GQL_TLS_CLIENT_CERT`, `GQL_TLS_CLIENT_KEY` from generated certs
- [ ] Create `graphql-https-tls.ts` (8 steps)
- [ ] Create `graphql-https-tls.test.ts`
- [ ] Add to `graphql-lessons.ts` at position 5 (security arc)
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run --coverage` on new files → >90% all metrics

### Phase 5: New Workflow Lessons (GQL-15–GQL-18)
*Estimated effort: 8–12 hours*

- [ ] Create `graphql-workflow-runner.ts` (GQL-15, 10 steps)
  - [ ] Helper: `lesson15-workflow-runner.ts`
  - [ ] Test: `graphql-workflow-runner.test.ts`
- [ ] Create `graphql-workflow-mutation.ts` (GQL-16, 8 steps)
  - [ ] Helper: `lesson16-workflow-mutation.ts`
  - [ ] Test: `graphql-workflow-mutation.test.ts`
- [ ] Create `graphql-workflow-subscription.ts` (GQL-17, 9 steps)
  - [ ] Helper: `lesson17-workflow-subscription.ts`
  - [ ] Test: `graphql-workflow-subscription.test.ts`
- [ ] Create `graphql-batch-execution.ts` (GQL-18, 6 steps) *(if batch UI is stable)*
  - [ ] Helper: `lesson18-batch-execution.ts`
  - [ ] Test: `graphql-batch-execution.test.ts`
- [ ] Add all new lessons to `graphql-lessons.ts` in correct positions
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run --coverage` → all four metrics >90%

### Phase 6: Visual Validation
*Per demo-player authoring rules §10 — required before merge*

- [ ] Open Demo Hub → GraphQL category
- [ ] Run each modified lesson at 1× speed end-to-end
- [ ] Verify spotlight matches what narration says to watch on every step
- [ ] Click Next rapidly through every lesson — confirm `preAction` guards recover
- [ ] Verify 700×430 diagrams render in both light and dark theme
- [ ] Verify new Docker stacks start cleanly with documented `docker compose up -d`
- [ ] Test TLS lesson on both Web (Node proxy) and Tauri desktop (native)
- [ ] Verify `estimatedMinutes` on lesson cards matches updated values

---

## 11. Reference Files

| File | Role in this enhancement |
|------|--------------------------|
| `src/features/demo-player/lessons/protocols/ws-workspace.ts` | Gold standard: 700×430 chrome mockup SVG (~190 lines) |
| `src/features/demo-player/lessons/protocols/ws-tls-local.ts` | Gold standard: 3-phase TLS lesson (skip-cert → CA → mTLS), Docker setup |
| `src/features/demo-player/lessons/protocols/ws-auth-transport.ts` | Gold standard: auth lesson (Bearer + transport modes + proxy explanation) |
| `src/features/demo-player/lessons/protocols/kafka-workflow-produce.ts` | Gold standard: workflow lesson description depth (field table, console timing, bindings) |
| `src/features/demo-player/lessons/protocols/kafka-workflow-consume-wait.ts` | Gold standard: event-driven workflow (correlation, sample payload, load mode) |
| `src/features/demo-player/lessons/protocols/kafka-secure.ts` | Reference: SASL security lesson structure |
| `src/features/demo-player/lessons/protocols/kafka-tls.ts` | Reference: TLS-on-top-of-auth lesson structure |
| `src/shared/selectors.ts` lines 582–894 | All ~130 `GQL.*` selectors for highlight/verify targets |
| `src/features/demo-player/types.ts` | `DemoLesson` and `DemoStep` TypeScript interfaces |
| `docker/graphql/tls/` | ✅ TLS Docker stack — nginx proxy, generated certs, docker-compose for phases 1–3 |
| `docker/graphql/tls/certs/ca.crt` | ✅ Generated CA cert — embed as `GQL_TLS_CA_CERT` in lesson helper |
| `docker/websocket/generate-cert.sh` | Original template used to create the GraphQL TLS scripts |
| `.cursor/rules/demo-player-lessons.mdc` | Authoring rules (delay sizing, preAction guards, WHY framing, estimatedMinutes formula) |
