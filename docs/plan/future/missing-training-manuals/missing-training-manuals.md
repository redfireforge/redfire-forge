# Missing Training Manuals — Coverage Plan

> **Branch:** `feature/training-manual`
> **Status:** Planning
> **Last updated:** 2026-08-23

---

## Context

The following major features have full demo lesson coverage and E2E test coverage
but **zero training manual documentation**. This document plans what each manual
should cover, folder structure, and suggested file names following the conventions
in `docs/training-manuals/CONVENTIONS.md`.

---

## Priority Order

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | **GraphQL** | Major protocol with the richest UI — 12 e2e specs, 5 demo lesson groups |
| 2 | **gRPC** | Major protocol with streams, TLS, schema management — 12 e2e specs |
| 3 | **WebSocket** | Major protocol with mock server, TLS, session replay — 15+ e2e specs |
| 4 | **Environment Manager** | Cross-feature dependency; unlocks all multi-env test scenarios |
| 5 | **Results Dashboard** | High user value — run comparison, timeline, history, console |
| 6 | **API Mock (HTTP)** | Advanced feature: route builder, rules, journal, gallery import |
| 7 | **SSE** | Lightweight but has auth, multi-tab, event filtering |
| 8 | **Webhooks** | Delivery logs, auto-layout, callback pattern docs |
| 9 | **Gallery** | Meta feature — how to use test/workflow factories and import |

---

## 1. GraphQL

**Folder:** `docs/training-manuals/graphql/`

### Scope (from e2e + source)
- Studio layout: editor, variables, headers, response panel
- Query execution (query, mutation, subscription)
- Schema explorer & SDL diff viewer
- Query builder (auto-generate queries from schema)
- Collections (save, replay, organize queries)
- Execution history per-tab
- GraphQL mock server (schema mocking, resolver rules)
- Code generation (generate TypeScript types from SDL)
- Multi-tab workflow (separate contexts per tab)
- Auth integration (Bearer, API Key, Basic)
- Workflow nodes (GraphQL Request node in workflow designer)

### Planned Files

```
graphql/
  graphql.html                              ← master overview
  graphql-first-query-easy.html             ← connect + run first query
  graphql-schema-explorer-easy.html         ← browse types, fields, docs
  graphql-query-builder-medium.html         ← auto-build from schema
  graphql-mutations-medium.html             ← create/update via mutation
  graphql-subscriptions-medium.html         ← real-time subscription stream
  graphql-collections-medium.html           ← save & organize queries
  graphql-auth-medium.html                  ← Bearer/API Key auth setup
  graphql-multi-tab-medium.html             ← per-tab isolation, endpoint overrides, context restore
  graphql-mock-server-advanced.html         ← mock schema + resolver rules
  graphql-code-gen-advanced.html            ← query builder code generation (preview, copy, editor sync)
  graphql-schema-diff-advanced.html         ← detect breaking schema changes
  graphql-workflow-nodes-advanced.html      ← GraphQL node in workflow designer
```

---

## 2. gRPC

**Folder:** `docs/training-manuals/grpc/`

### Scope (from e2e + source)
- Studio layout: method picker, request editor, response panel
- Unary calls
- Server streaming / client streaming / bidirectional streaming
- Schema management: upload `.proto`, protoset, URL, BSR (Buf Schema Registry)
- Schema drift detection (breaking change detection between descriptor snapshots)
- TLS configuration (Plaintext, TLS, mTLS with CA cert, rejectUnauthorized)
- Collections and execution history (save, replay, grpcurl import/export)
- Interpolation (`{{variable}}` injection in target host, request fields)
- Mock listener and mock streams (stub any gRPC service without a real backend)
- Shell isolation and recovery (tab independence, reconnect after error)
- Transport modes: proxy (default, Envoy gRPC-Web) vs native (direct gRPC-H2)

### Added to scope (from deep e2e audit — 2026-08-23)
- grpcurl CLI import: paste a `grpcurl` command into the collections import dialog
- BSR runtime schema fetch: import descriptor directly from Buf Schema Registry URL
- Native transport mode: bypasses Envoy proxy for direct H2 connections (desktop only)
- Mock unary handler: define per-method response stubs in the Mock panel
- Schema browser: tree-view explorer of loaded descriptor types/methods

### Planned Files (11 total)

```
grpc/
  grpc.html                                 ← master overview                    [✅]
  grpc-first-call-easy.html                 ← connect, reflect, first unary call [✅]
  grpc-schema-management-easy.html          ← proto upload, protoset, BSR, browser [✅]
  grpc-server-streaming-medium.html         ← server stream with live log        [✅]
  grpc-client-streaming-medium.html         ← client stream send loop            [✅]
  grpc-bidi-streaming-medium.html           ← bidirectional stream chat pattern  [✅]
  grpc-collections-medium.html              ← save, history, grpcurl import      [✅]
  grpc-tls-advanced.html                    ← Plaintext/TLS/mTLS, native transport [✅]
  grpc-mock-server-advanced.html            ← mock listener, unary/stream stubs  [✅]
  grpc-schema-drift-advanced.html           ← detect proto breaking changes      [✅]
  grpc-interpolation-advanced.html          ← {{var}} in host + request fields   [✅]
```

### Implementation Status
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `grpc.html` | ✅ | Created 2026-08-23 |
| 2 | `grpc-first-call-easy.html` | ✅ | Created 2026-08-23 |
| 3 | `grpc-schema-management-easy.html` | ✅ | Created 2026-08-23 |
| 4 | `grpc-server-streaming-medium.html` | ✅ | Created 2026-08-23 |
| 5 | `grpc-client-streaming-medium.html` | ✅ | Created 2026-08-23 |
| 6 | `grpc-bidi-streaming-medium.html` | ✅ | Created 2026-08-23 |
| 7 | `grpc-collections-medium.html` | ✅ | Created 2026-08-23 |
| 8 | `grpc-tls-advanced.html` | ✅ | Created 2026-08-23 |
| 9 | `grpc-mock-server-advanced.html` | ✅ | Desktop-only callout included; created 2026-08-23 |
| 10 | `grpc-schema-drift-advanced.html` | ✅ | Created 2026-08-23 |
| 11 | `grpc-interpolation-advanced.html` | ✅ | Created 2026-08-23 |

---

## 3. WebSocket

**Folder:** `docs/training-manuals/websocket/`

### Scope (from e2e + source — 15+ specs audited)
- Connect / disconnect (ws:// and wss://) — `connect-btn`, `disconnect-btn`, `status-badge`
- Multi-tab connections (up to 8 independent tabs) — `conn-tab-bar`, tab add/remove, keyboard nav, drag-reorder
- Send pane (text, binary, JSON formatting) — `send-btn`, `.ws-compose-input`, format selector
- Message log (filter, bookmark, export) — `.ws-message-row`, `direction-filter`, `filter-toggle-btn`, `filter-bar`
- Protocol support: plain WebSocket, Socket.IO (EIO4), STOMP (RabbitMQ), GraphQL-over-WS — `protocol-select`, `protocol-badge`
- Auth panel (Bearer, API Key, basic, custom headers) — `ws-auth-type-trigger`, `ws-auth-type-opt-{value}`
- TLS panel (rejectUnauthorized/skip-cert, CA cert, client cert+key, proxy notice) — `tls-panel`, `tls-toggle`, `tls-skip-cert`, `tls-ca-cert`
- Session recording (`start-recording-btn`, `stop-recording-btn`) and replay (`replay-bar`, `replay-playpause-btn`, `replay-speed-select`, `replay-exit-btn`)
- Stats dashboard — `right-tab-stats`, `stats-msg-rate`, `stats-bytes-in`, `stats-bytes-out`, `stats-frames`
- Mock server (start/stop, port config, rules, echo fallback, broadcast, connected-client count) — `mock-start-btn`, `mock-stop-btn`, `mock-status-label`, `mock-port-input`
- Schema inference and validation — `right-tab-schema`, `ws-schema-panel`, `ws-schema-generate-btn`, `ws-schema-add-btn`, `ws-validation-toggle`
- Message diff viewer — `diff-modal`, `diff-close`
- Console commands (scripted send sequences) — `right-tab-console`, `ws-console-cmd-input`, `ws-console-category`
- Load test mode — `right-tab-loadtest`, `lt-start-btn`, `lt-running`
- WS workflow runner (wsConnect, wsSend, wsReceive, wsTrigger nodes) — `wf-palette-block-wsConnect`, `ws-connect-config`

### Planned Files (13 total)

```
websocket/
  websocket.html                            ← master overview                        [✅]
  websocket-first-connection-easy.html      ← connect ws://echo + send/receive       [✅]
  websocket-multi-tab-easy.html             ← open multiple independent connections  [✅]
  websocket-protocols-medium.html           ← Socket.IO, STOMP, GraphQL-WS           [✅]
  websocket-auth-medium.html                ← Bearer/API Key/custom header auth      [✅]
  websocket-recording-replay-medium.html    ← record session, replay at speed        [✅]
  websocket-stats-medium.html               ← live metrics dashboard                 [✅]
  websocket-tls-medium.html                 ← wss:// with CA cert / proxy TLS        [✅]
  websocket-mock-server-advanced.html       ← start mock, define rules, broadcast    [✅]
  websocket-schema-validation-advanced.html ← infer schema, validate messages        [✅]
  websocket-diff-console-advanced.html      ← diff viewer + console scripting        [✅]
  websocket-load-test-advanced.html         ← concurrent connections, throughput     [✅]
  websocket-workflow-runner-advanced.html   ← WS scenario in workflow harness        [✅]
```

### Implementation Status
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `websocket.html` | ✅ | Overview, mode switcher, testid map |
| 2 | `websocket-first-connection-easy.html` | ✅ | echo.websocket.org walkthrough |
| 3 | `websocket-multi-tab-easy.html` | ✅ | Up to 8 tabs, isolation table |
| 4 | `websocket-protocols-medium.html` | ✅ | Socket.IO + STOMP walkthroughs |
| 5 | `websocket-auth-medium.html` | ✅ | Bearer, API Key, Basic, custom headers |
| 6 | `websocket-recording-replay-medium.html` | ✅ | ws-recording-v1 format, replay bar |
| 7 | `websocket-stats-medium.html` | ✅ | msg-rate, bytes-in/out, frames |
| 8 | `websocket-tls-medium.html` | ✅ | skip-cert, CA cert, mTLS, proxy |
| 9 | `websocket-mock-server-advanced.html` | ✅ | Rules engine, broadcast, 2-tab pattern |
| 10 | `websocket-schema-validation-advanced.html` | ✅ | Generate from traffic, live validation |
| 11 | `websocket-diff-console-advanced.html` | ✅ | Side-by-side diff, console commands |
| 12 | `websocket-load-test-advanced.html` | ✅ | Concurrent workers, P50/P95/P99 |
| 13 | `websocket-workflow-runner-advanced.html` | ✅ | 4 WS nodes, trigger pattern |

---

## 4. Environment Manager

**Folder:** `docs/training-manuals/environments/`

### Scope (from e2e + source)
- Create and manage environments (global app-level: dev, staging, prod) — drag to reorder, × to delete
- Create and manage microservices — cards with expand/configure panel
- Deploy toggle — enable a microservice for a specific environment (base URL table checkbox)
- Base URL per microservice × environment — drives `{{baseUrl}}` and `{{host}}` built-in vars
- Global vars — per-microservice key/value pairs shared across all environments (`{{varName}}`)
- Env-var overrides — per-microservice × per-env overrides; "overridden" tag when shadowing a global
- Protocol tabs — add gRPC, GraphQL, SSE, WebSocket per service (`em-protocol-tab-*`)
- Per-protocol endpoints per environment — gRPC target, GraphQL path, WS URL, SSE URL
- Auth profiles — assign a global auth profile to each microservice × env cell
- Microservice-specific additional environments — service-level extra envs beyond global list
- Active environment selector in app header (`header-env-select`)
- Parameterized test runs — cascade environment selection (`send-harness-cascade-environment`)

### Notes on original plan (corrected after code audit 2026-08-23)
- "Secret variables / masking in logs" — **not present** in the EM; secret/masked vars exist only in
  GraphQL Studio's own env modal. Replaced with `environments-protocols-medium.html`.
- "Promote/demote shared data sources" — **not in EM**; SharedDataSource lives in the Scenarios
  feature. Replaced with `environments-additional-env-medium.html`.

### Planned Files

```
environments/
  environments.html                         ← master overview                        [✅]
  environments-basics-easy.html             ← create envs + microservice, deploy, base URL [✅]
  environments-variables-medium.html        ← global vars, env overrides, {{}} interpolation [✅]
  environments-protocols-medium.html        ← protocol tabs, per-env URLs, auth profiles [✅]
  environments-multi-run-advanced.html      ← parameterized runs, cascade env, env selector [✅]
  environments-additional-env-medium.html   ← microservice-specific envs, drag reorder [✅]
```

### Implementation Status
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `environments.html` | ✅ | Overview, 2-panel layout, variable system, learning path map |
| 2 | `environments-basics-easy.html` | ✅ | Create 3 envs, add svc, deploy, base URL, verify {{baseUrl}} |
| 3 | `environments-variables-medium.html` | ✅ | Protocol vars modal, env-var overrides, derived vars panel |
| 4 | `environments-protocols-medium.html` | ✅ | Protocol tabs, gRPC TLS, GraphQL path, auth profiles, SSE fallback |
| 5 | `environments-multi-run-advanced.html` | ✅ | Cascade env, parameterized runner, unresolved warning |
| 6 | `environments-additional-env-medium.html` | ✅ | Service-scoped envs, drag reorder, impact-safe deletion |

---

## 5. Results Dashboard

**Folder:** `docs/training-manuals/results/`

### Scope (from source audit — 2026-08-23)
- Four-tab layout: **Overview** (metrics cards + histogram) · **Request Details** (grouped table) · **SLA** (target editor + check tree) · **Comparison & Trends** (baseline + regression + trend chart)
- Run selector (`ResultsRunSelect`): dropdown with ★ baseline marker, SLA dot, regression dot, TPS, timestamp
- Run type filter tabs: All Runs / 🧪 Test Runs / ⚡ Workflow Runs
- Header actions: Refresh, Import Trace, **Results Explorer** (workflow runs only), Export JSON, Export CSV, Generate Report (HTML/JSON/Markdown), Delete
- **Overview tab**: `ResultsMetricsCards` (TPS/TPM/TPH/TPD, avg/min/max, P50/P95/P99/P99.9, error rate), `SlaCompactBar`, `WorkflowResultsSummary` (workflow runs), `AggregatedTimingTable`, `ResponseTimeHistogram`
- **Request Details tab**: pass/fail filter, search, group-by (scenario/tag/feature), sub-grouping, pagination, click row → response detail modal
- **SLA tab**: `SlaTargetEditor` (add targets per metric/scope), `SlaStatusAccordion` (Feature → Scenario → Check tree), `SlaCompactBar`
- **Comparison & Trends tab**: `BaselineListPanel` (mark/unmark/rename ★ baselines), `ResultsComparisonTrendsToolbar` (select compare run), `RunComparisonPanel` (metric deltas, scenario deltas, regression alerts, distribution overlay), `TrendChart`, `RegressionThresholdsPanel` (configurable warn/critical %/pp thresholds)
- **Results Explorer modal** (`WorkflowResultsExplorerModal` / `FullPanelModal`):
  - Left: `WorkflowExecutionCanvas` (flow diagram, pass/fail/skipped overlay, minimap, search, state filter: all/pass/fail/skipped)
  - Toggle: Diagram view ↔ Timeline view (`ExecutionTimeline` — horizontal Gantt, zoom, hover tooltip)
  - Right: `ResultsExplorerDetailPanel` tabs — Overview, Request, Response, Variables, Assertions
  - Bottom: `IterationMatrixTable` (collapsible), `IterationPicker`
  - `ResultsExplorerConsolePanel` (dockable/floating; log lines, node filter, search, match navigation)
  - Sub-workflow drilldown via trace stack (breadcrumb back button)
  - `MappingTraceOverlay` (data-mapper trace for mapper nodes)
  - Export trace JSON button

### Corrections vs Original Plan
- **`results-console-easy.html`** — WRONG: the console is inside the Results Explorer modal (post-run replay), not a "live console during test run". Replaced by `results-sla-medium.html`.
- **`results-timeline-filters-medium.html`** — WRONG: "filter by method" doesn't exist; the timeline is inside the Explorer, not the main dashboard. Replaced by `results-request-details-medium.html`.
- **`results-explorer-easy.html`** — Difficulty wrong; the Explorer is a medium-difficulty feature. Renamed to `results-explorer-medium.html`.
- **`results-history-medium.html`** — Too thin as a standalone; history = run selector + run type filter tabs. Folded into overview. Slot used for `results-console-timeline-medium.html`.
- **Missing from plan**: Baseline management + regression detection (biggest gap), SLA target editor, trend chart, report generation, iteration matrix, data mapper overlay.

### Planned Files (corrected)

```
results/
  results.html                              ← master overview (4-tab layout, run selector, header actions)    [✅]
  results-overview-easy.html                ← Overview tab: metrics, SLA bar, histogram, export, delete        [✅]
  results-request-details-medium.html       ← Request Details tab: filter/search/group/paginate, row detail    [✅]
  results-sla-medium.html                   ← SLA tab: add targets, check tree, compact bar, scopes            [✅]
  results-comparison-medium.html            ← Comparison & Trends: baseline, regression, thresholds, trend     [✅]
  results-explorer-medium.html              ← Results Explorer: canvas, node detail, iterations, console       [✅]
  results-console-timeline-medium.html      ← Explorer: console panel modes + timeline view + zoom             [✅]
  results-explorer-advanced.html            ← Explorer: sub-workflow drilldown, parallel, mapper, export       [✅]
```

### Implementation Status
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `results.html` | ✅ | Overview: layout, tabs, run selector, header actions |
| 2 | `results-overview-easy.html` | ✅ | Metrics cards, SLA bar, histogram, export, delete |
| 3 | `results-request-details-medium.html` | ✅ | Filter/search/group, pagination, response detail modal |
| 4 | `results-sla-medium.html` | ✅ | SLA target editor, check tree, scopes |
| 5 | `results-comparison-medium.html` | ✅ | Baselines, regression, thresholds, trend chart |
| 6 | `results-explorer-medium.html` | ✅ | Canvas, node detail, iterations, console |
| 7 | `results-console-timeline-medium.html` | ✅ | Console modes, timeline view, zoom |
| 8 | `results-explorer-advanced.html` | ✅ | Sub-workflow drilldown, parallel, mapper, export |

---

## 6. API Mock (HTTP)

**Folder:** `docs/training-manuals/api-mock/`

### Scope (from e2e + source audit — corrected 2026-08-23)

#### Core Studio
- Studio layout: sidebar route list, route editor (5 tabs: Match / Response / Behavior / Examples / Documentation), runtime Dock panel
- Add/edit/delete routes (method: ANY/GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD/TRACE; literal/glob/regex/prefix path matching)
- Route folders: tree organisation, context menus, expand/collapse, drag-reorder
- Undo toast for route edits (`useApiMockRouteUndo`)

#### Match Tab — Predicates
- 7 predicate sources: `pathParam`, `query`, `header`, `cookie`, `security`, `body`, `transport`
- 24 predicate operators: exact/contains/prefix/suffix/regex/glob/present/absent; jsonPath_exists/jsonPath_equals/json_strict/json_subset/jsonSchema; xpath_exists/xpath_equals/xmlSchema; form_field_exact/form_field_regex/form_field_present; multipart_field/multipart_file; binary_exact/binary_sha256
- Predicate combinator: ALL / ANY (nested groups)
- **Pattern Toolbox** (🪄 wand button) — modal with 6 tabs: Regex builder, Path template, JSON body/JSONPath, XPath, Schema (JSON or XML), Query & headers
- **Auth-gated routes** — `security` source predicate: Bearer (`scheme = Bearer`), API Key header (`apiKeyName`), returning 401 when absent; mTLS certificate subject matching

#### Response Tab — Variants
- **Response variants sidebar**: every route has ≥1 named response variant with `isDefault` flag
- **Template expressions** in body: `{{variable}}`, `{{faker.name}}`, `{{request.headers.X-Foo}}`, `{{random.uuid}}` etc.; **Template Helper Modal** shows full function catalog
- Content tabs per variant: Content (body, status, Content-Type preset), Headers (response headers), Timing, Faults, Selection, Outbound
- **Timing tab**: fixed `delayMs`, `jitterMs` (random ±), `maxMatches` (auto-disable after N hits), `expiresAt` (calendar picker)
- **Faults tab** (6 fault cards): None, Timeout / no-response (hold socket), Connection reset, Dribble chunks, Empty / close, Malformed HTTP framing
- **Selection tab** (`ApiMockResponseSelectionPanel`): controls how variants are chosen — condition (`jsonPath_equals` on body), sequence (round-robin step), state (scenario-driven)
- **Outbound tab** (`ApiMockVariantOutboundPanel`): post-response transforms (setHeader/appendHeader/removeHeader/setStatus/replaceBody) + outbound HTTP callbacks (POST/PUT/PATCH to a configured URL after each matched response)

#### Simulate (no server needed)
- **Simulate Modal** (⚗ flask button on each route): fire test requests against the current rule config without starting a live listener
- 4 result tabs: Trace (per-predicate pass/fail with near-miss summary), Request (echoed), Rendered (template-evaluated body), Assertions
- Saved samples: save named request/response pairs per route, replay with one click, export simulation trace

#### Runtime Dock
- **Transactions tab**: live request log (matched/unmatched/ambiguous outcomes); click row → detail (request, response, duration, policy, generation); "Create route from transaction", "Open in Requests", copy
- **Conflicts tab** (`ApiMockConflictInspector`): overlap detection across rules, priority adjustment (↑/↓), acknowledge per-finding, priority policies (highest_priority vs reject_multiple, reject vs specificity_then_id)
- **State tab**: current stateful-scenario state per route + counters + sequence positions; Reset State button
- **Variables tab**: server-level key-value variables; add/edit/delete; values available as `{{variables.key}}` in templates
- **Diagnostics tab** + **Console tab**: server health notices, raw log stream

#### Import (7 sources)
- cURL command → route + sample
- OpenAPI / Swagger (JSON or YAML)
- Catalog endpoints (select operations from API Catalog)
- Requests collection (promote items or folders)
- RedfireForge native export (round-trip)
- WireMock mappings (stub definitions)
- **HAR capture** (browser/devtools archive, auto-redacted) — **was missing from original plan**
- Import mode: Merge / Replace / Copy; optional new folder assignment; import preview with diagnostics + loss report

#### Server Library & Settings
- Server library landing (`ApiMockLibraryLanding`): all saved servers with rule count, example count, open/parked status; max 8 tabs open simultaneously
- **Server Settings Modal**: host (127.0.0.1 / localhost / 0.0.0.0), port, multiple-match policy (highest_priority / reject_multiple), equal-priority policy (reject / specificity_then_id), long-running max ms, fallback mode (static body / closest-match debug JSON / proxy to upstream)
- mTLS settings; header-redact picker for journal sanitisation
- Export: native JSON format; export confirm dialog; round-trip re-import via "RedfireForge export" source

#### Advanced Patterns
- **GraphQL over HTTP mock** — `POST /graphql` route, body `jsonPath_equals` on `$.operationName`/`$.query` to dispatch per-variant responses
- **Stateful sequence** — Selection tab → state mode; `scenarios` panel tracks which step each route is at; reset rewinds to step 0
- **Webhook receiver** — inbound `POST /webhook`, body `json_subset`/`jsonPath_equals` to gate on `$.event`; journal captures payloads; outbound callback on match fires confirmation back
- **Outbound callbacks** after match — post-response HTTP webhook to another system; configurable method/URL/headers/body template; fire-and-forget, errors logged to console

### Plan Corrections (2026-08-23)

| # | Item | Original Plan | Correction |
|---|------|--------------|------------|
| 1 | `api-mock-response-rules-medium.html` | "conditional responses, status codes" | Renamed → `api-mock-response-variants-medium.html`; must cover the variant sidebar, selection modes, template expressions, Template Helper — not just status codes |
| 2 | `api-mock-gallery-import-medium.html` | "import pre-built mock sets from gallery" | Renamed → `api-mock-import-medium.html`; gallery is one of 7 import sources; cover all sources |
| 3 | `api-mock-advanced-routing-advanced.html` | "regex paths, dynamic responses, delays" | Renamed → `api-mock-faults-timing-advanced.html`; covers Pattern Toolbox, all 6 fault types, timing panel fields |
| 4 | Simulate Modal | Missing from plan | New file: `api-mock-simulate-medium.html` — high-value feature |
| 5 | HAR import | Missing from import source list | Added to import scope |
| 6 | Template expressions + Helper Modal | Missing | Covered in `api-mock-response-variants-medium.html` |
| 7 | Pattern Toolbox (🪄) | Missing | Covered in `api-mock-faults-timing-advanced.html` |
| 8 | Response Faults (6 types) | Missing | Covered in `api-mock-faults-timing-advanced.html` |
| 9 | Outbound callbacks | Missing | Covered in `api-mock-webhook-receiver-medium.html` |
| 10 | Server variables | Missing | Covered in `api-mock-export-library-advanced.html` |
| 11 | Conflict Inspector + priority | Missing | Covered in `api-mock-journal-medium.html` (dock tabs) |
| 12 | Server Settings (host/port/policy/fallback/proxy/mTLS) | Missing | Covered in `api-mock-export-library-advanced.html` |

### Planned Files (corrected — 13 files)

```
api-mock/
  api-mock.html                             ← master overview: layout, studio sections, dock, key concepts
  api-mock-first-server-easy.html           ← create server, add route, start listener, send first request
  api-mock-response-variants-medium.html    ← variants sidebar, selection modes, template expressions, headers, faults overview
  api-mock-simulate-medium.html             ← simulate without running: ⚗ modal, trace tab, near-miss, samples
  api-mock-journal-medium.html              ← runtime dock: transactions, conflicts, priority, state, variables
  api-mock-import-medium.html               ← all 7 import sources, merge/replace/copy, folder assignment, import review
  api-mock-folder-organization-medium.html  ← folders, context menus, reorder, naming, undo toast
  api-mock-auth-gated-medium.html           ← security predicate: Bearer, API Key, mTLS cert subject, 401 fallback
  api-mock-graphql-medium.html              ← POST /graphql, jsonPath body dispatch per operation, variant conditions
  api-mock-stateful-sequence-advanced.html  ← state/scenario panel, multi-step transitions, sequence mode, counters
  api-mock-webhook-receiver-medium.html     ← inbound webhook capture, body predicates, journal + outbound callbacks
  api-mock-faults-timing-advanced.html      ← faults (6 types), timing (delay/jitter/maxMatches/expiresAt), Pattern Toolbox
  api-mock-export-library-advanced.html     ← library landing, tab management, server settings, variables, native export
```

### Implementation Status
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `api-mock.html` | ✅ | |
| 2 | `api-mock-first-server-easy.html` | ✅ | |
| 3 | `api-mock-response-variants-medium.html` | ✅ | |
| 4 | `api-mock-simulate-medium.html` | ✅ | |
| 5 | `api-mock-journal-medium.html` | ✅ | |
| 6 | `api-mock-import-medium.html` | ✅ | |
| 7 | `api-mock-folder-organization-medium.html` | ✅ | |
| 8 | `api-mock-auth-gated-medium.html` | ✅ | |
| 9 | `api-mock-graphql-medium.html` | ✅ | |
| 10 | `api-mock-stateful-sequence-advanced.html` | ✅ | |
| 11 | `api-mock-webhook-receiver-medium.html` | ✅ | |
| 12 | `api-mock-faults-timing-advanced.html` | ✅ | |
| 13 | `api-mock-export-library-advanced.html` | ✅ | |

---

## 7. SSE (Server-Sent Events)

**Folder:** `docs/training-manuals/sse/`

### Scope (from source audit — `src/features/sse/`, `e2e/sse-studio.spec.ts`)

**Layout:**
- Split-pane shell (`SseStudioShell`): resizable left / right panes
- URL top bar + connect/disconnect button + state dot
- Status strip below URL bar: event count, uptime, Last-Event-ID
- Left tabs: **Connect** (URL, headers, auto-reconnect, max retries) | **Auth**
- Right tabs: **Events** | **Console**
- Max 8 tabs (`SSE_MAX_TABS`)
- Per-tab state persisted via `sseStorage`

**Connection:**
- URL with `{{envVar}}` interpolation support
- Custom request headers (KeyValueEditor with env vars)
- Auto-reconnect toggle (default: on, max retries: 10)
- Last-Event-ID tracking for resume-after-reconnect
- States: idle → connecting → connected → disconnected → error

**Event Log (right pane → Events tab):**
- Virtualized list (28 px rows, `@tanstack/react-virtual`)
- Per-row: bookmark star, timestamp, event-type badge (coloured by type), data preview (120 chars), byte size
- Click row → inline Event Detail panel (type, Last-Event-ID, size, timestamp, data with JSON auto-detect + pretty-print)
- Search by text (data + event type)
- Filter by event type (dynamic dropdown from received types)
- Bookmark filter (show starred only)
- Clear all events button
- Export events as JSON file
- Max 10,000 events buffered

**Auth tab (left pane):**
- Wraps shared `AuthConfigPanel`
- Modes: None, Bearer token, API Key, Global profile inherit
- "Resolved as" preview (shows which header/param will be sent)
- No browser-mode limitation (fetch-based, headers sent directly)

**Console tab (right pane → Console tab):**
- Shared `ConsolePanel` + `useSseConsole` observer
- Logs connection lifecycle: connecting, handshake (with resolved URL + auth), connected, error, reconnecting, closed
- Structured view + Raw view modes
- Command input: `/help`, `/clear`, `/status`, `/reconnect` (SSE console commands)
- Empty state when no entries

**SSE Wire Format (W3C spec parser):**
- Fields: `event:`, `data:`, `id:`, `retry:`, comments (`:`)
- Multi-line data (multiple `data:` lines joined with `\n`)
- BOM strip on first chunk
- Default event type: `message` when no `event:` field
- Partial-chunk buffering (`carry` mechanism)

### Planned Files

```
sse/
  sse.html                                  ← master overview + quick-reference
  sse-first-connection-easy.html            ← connect, status strip, auto-reconnect, headers
  sse-event-filtering-medium.html           ← event log, search, type filter, bookmarks, export, event detail (expanded scope)
  sse-auth-medium.html                      ← auth modes: Bearer, API Key, global profile, "resolved as" preview
  sse-console-medium.html                   ← NEW: console tab, lifecycle entries, /help /clear /status commands
  sse-multi-tab-advanced.html               ← multi-tab independent streams, SSE wire format deep dive
```

### Implementation Status

| File | Status | Notes |
|------|--------|-------|
| `sse.html` | ✅ | |
| `sse-first-connection-easy.html` | ✅ | |
| `sse-event-filtering-medium.html` | ✅ | Expanded scope vs original plan |
| `sse-auth-medium.html` | ✅ | |
| `sse-console-medium.html` | ✅ | New file (console not in original plan) |
| `sse-multi-tab-advanced.html` | ✅ | Adds wire format section |

---

## 8. Webhooks

**Folder:** `docs/training-manuals/webhooks/`

### Scope (from source audit — `src/features/webhooks/WebhookDeliveryLogs.tsx`, `src-server/webhook-server.ts`, `e2e/webhook-delivery-logs.spec.ts`)

**What "Webhooks" covers in RedfireForge:**
1. **Webhook Delivery Logs** — a read-only viewer for inbound webhook deliveries that triggered workflows (accessed via Workflow tab → Webhook Deliveries)
2. **Webhook Trigger node** — a workflow node type that defines an inbound HTTP endpoint; the URL, method, variable extraction from the request payload

> ❌ Original plan had "auto-layout of delivery graph" and "retry/replay from log" — neither exists. The delivery log is read-only. Auto-layout is a workflow canvas concern, not a logs feature.
> ❌ "Filtering by status/source" does not exist — the only filter is by **date** (prev/next day, date picker); there's a sort order toggle (newest/oldest).

**Delivery Logs page (WebhookDeliveryLogs.tsx):**
- Header: "Webhook Delivery Logs", delivery count, sort toggle badge (↓ Newest / ↑ Oldest)
- Date navigation: ← Prev / date picker / Next → (disabled if today) / Refresh
- Delivery card list: method badge, trigger ID, status badge (`SUCCESS`/`FAILED`/`ERROR`), timestamp, duration
- Detail panel: opens on card click → trigger ID, method, status, duration, timestamp, payload (pretty-printed), error block (if status=error); close button (✕)
- Auto-refresh: subscribes to SSE log stream — when new webhook deliveries arrive today, the list refreshes (500ms debounce)
- Empty state: 🪝 icon + "No webhook deliveries found"
- Error state: error card + Retry button (when server is unavailable)
- Loading state: shown while API call is in-flight

**Webhook Trigger node (server-side):**
- URL format: `POST|PUT|PATCH /webhooks/:workflowId/:triggerId`
- Accepts all HTTP methods that match the node's configured method; 405 if mismatch
- Extracts variables via JSONPath from body, headers, or query params (`$.body.orderId`, `$.headers.x-user-id`, `$.query.page`)
- Defaults to body extraction if path doesn't start with `body`/`headers`/`query`
- Logs every delivery (triggerId, method, payload, status, duration, timestamp, error)
- Optional `_trace=true` query param for full execution trace capture

### Planned Files

```
webhooks/
  webhooks.html                                 ← master overview
  webhooks-delivery-logs-easy.html              ← read delivery cards, view detail panel, status badges, error block
  webhooks-date-sort-medium.html                ← date navigation, sort order toggle, auto-refresh (was "filtering")
  webhooks-trigger-setup-medium.html            ← webhook trigger node: URL, method, JSONPath variable extraction (replaces non-existent "retry" feature)
```

### Implementation Status

| File | Status | Notes |
|------|--------|-------|
| `webhooks.html` | ✅ Done | |
| `webhooks-delivery-logs-easy.html` | ✅ Done | |
| `webhooks-date-sort-medium.html` | ✅ Done | Renamed from webhooks-filtering-medium — date + sort is what actually exists |
| `webhooks-trigger-setup-medium.html` | ✅ Done | Replaces webhooks-retry-advanced — retry UI does not exist |

---

## 9. Gallery

**Folder:** `docs/training-manuals/gallery/`

### Scope (from source audit — `src/features/gallery/GalleryPage.tsx`, `src/shared/components/gallery/GalleryGrid.tsx`, `e2e/gallery.spec.ts`, `e2e/gallery-loaded-badge.spec.ts`)

The Gallery is a rich, multi-domain sample browser with **two distinct modes**:
1. **Samples mode** (default) — paginated card grid across 9 domains with filter sidebar, search, and detail panel
2. **Training Paths mode** — curriculum-first view with expandable phase cards, linked manuals, and full-text search

> ❌ Original plan said "test factory, workflow factory tabs" — incorrect. The gallery is domain-filtered cards, not factory tabs.
> ❌ `gallery-custom-templates-advanced.html` (create/register custom items) — this UI does **not exist**. Gallery items are TypeScript-only; there is no in-app custom template creator.
> ❌ `gallery-import-test-easy.html` and `gallery-import-workflow-easy.html` (two narrow files) — the real story is a single unified import flow covering all 9 domains, with a badge lifecycle and a confirm-update modal.

**Domains (9, each with a filter button):**
| Domain | Label | Action Button | Notes |
|--------|-------|--------------|-------|
| `requests` | Requests 📡 | "Send Request" / secondary "Try It" | Rich RequestPreview; navigates away from gallery on import |
| `catalog` | API Catalog 📚 | "Import Spec" | |
| `tests` | Tests 🧪 | "Load Test" | |
| `workflows` | Workflows ⚡ | "Load Workflow" | Opens wf-preview-banner; "Use as Template" to persist |
| `assertions` | Assertions ✅ | "Apply Preset" | No import handler — applied inline; no navigation |
| `data-mapper` | Data Mapper 🔀 | "Load Sample" | |
| `api-mock` | API Mock 🧪 | "Load Mock Server" | |
| `grpc` | gRPC 🔌 | "Load Sample" | Currently scaffold (0 entries) |
| `websocket` | WebSocket ⚡ | "Load Sample" | Currently scaffold (0 entries) |

**Filter sidebar (resizable):**
- 10 domain buttons (All + 9 domains)
- Category dropdown
- Difficulty dropdown (All / Easy / Medium / Advanced)
- Live API filter (by external hostname)
- Tag filter

**Gallery card features:**
- Icon, name, description, difficulty dots
- Domain badge (when viewing All domains)
- Tags
- Status badge: `✓ Loaded` (same version) or `↻ Reload (Updated)` (newer version available)

**Detail panel:**
- Entry name, description, difficulty dots, tags
- Live API badges (link to external hostname)
- Primary + secondary action buttons
- Preview: `RequestPreview` for requests; truncated JSON (800 chars) for others; expand modal via button
- **Related Training Manuals section** (`.gallery-detail-manuals`) — manual links with title and difficulty dots

**✓ Loaded badge lifecycle (workflows most complex):**
- Not imported: no badge
- Loaded (same version): `✓ Loaded` — clicking navigates to the tab (no modal)
- Loaded (newer version): `↻ Reload (Updated)` — clicking shows ConfirmModal before re-importing
- Workflow-specific: must click "Use as Template" after loading to persist; closing preview without saving removes the badge

**Training Paths mode:**
- Toggle via "Training Paths" button in mode toggle strip
- Shows all 27 training paths as expandable phase cards
- Each path → phases → manuals (with difficulty dots)
- Full-text search across path names, descriptions, phase names, and manual titles
- Back button ("← All Training Paths") when a specific path is active
- `onImportSample` chip navigates back to Samples mode for a specific sample

### Planned Files (corrected)

```
gallery/
  gallery.html                              ← master overview: two modes, 9 domains, entry anatomy, navigation
  gallery-samples-easy.html                 ← Samples mode: domain filter, search, cards, detail panel, preview, related manuals
  gallery-import-easy.html                  ← Importing: per-domain actions, badge lifecycle, ↻ Reload Updated modal, navigation
  gallery-training-paths-medium.html        ← Training Paths mode: switching, browsing paths/phases/manuals, search (replaces custom-templates which doesn't exist)
```

### Implementation Status

| File | Status | Notes |
|------|--------|-------|
| `gallery.html` | ✅ | Overview: 2 modes, 9 domains, card anatomy, filter sidebar, detail panel |
| `gallery-samples-easy.html` | ✅ | Replaces gallery-import-test-easy — domain filters, search, cards, detail panel, preview |
| `gallery-import-easy.html` | ✅ | Replaces gallery-import-workflow-easy — covers all 9 domains' import actions + badge lifecycle |
| `gallery-training-paths-medium.html` | ✅ | Replaces gallery-custom-templates-advanced — Training Paths mode, path/phase/manual hierarchy, search |

---

## Summary

| Feature | Folder | Main File | # Tutorials | Status |
|---------|--------|-----------|-------------|--------|
| GraphQL | `graphql/` | `graphql.html` | 12 | ✅ Done (13 files — overview + 12 tutorials) |
| gRPC | `grpc/` | `grpc.html` | 10 | ✅ Done (11 files — overview + 10 tutorials) |
| WebSocket | `websocket/` | `websocket.html` | 13 | ✅ Done (13 files — overview + 12 tutorials) |
| Environment Manager | `environments/` | `environments.html` | 5 | ✅ Done (6 files — overview + 5 tutorials) |
| Results Dashboard | `results/` | `results.html` | 7 | ✅ Done (8 files — overview + 7 tutorials) |
| API Mock (HTTP) | `api-mock/` | `api-mock.html` | 12 | ✅ Done (13 files — overview + 12 tutorials; 3 files renamed, 1 added) |
| SSE | `sse/` | `sse.html` | 5 | ✅ Done (6 files — overview + 5 tutorials; console tab added, event-filtering expanded) |
| Webhooks | `webhooks/` | `webhooks.html` | 4 | ✅ Complete |
| Gallery | `gallery/` | `gallery.html` | 4 | ✅ Complete (4 files — overview + samples browsing + import lifecycle + training paths mode) |

**Total planned files:** ~65 tutorial HTML files + 9 master overview files

---

## Notes

- All files follow the `<topic>-<difficulty>.html` convention from `CONVENTIONS.md`
- Each master `<feature>.html` file covers all sub-topics with links to individual tutorials
- Difficulty tiers: `-easy` (under 5 steps), `-medium` (5–10 steps), `-advanced` (10+ steps, production patterns)
- Each tutorial must include: concept overview → step-by-step walkthrough using sample files → self-practice exercises
- Sample/example files referenced in walkthroughs must exist in `examples/` before the manual is written
