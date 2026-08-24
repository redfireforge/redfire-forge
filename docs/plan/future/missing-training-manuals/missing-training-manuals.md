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

### Scope (from e2e + source)
- Studio layout: route list, route editor, response rules
- Add/edit/delete routes (method, path, status, headers, body)
- Response rules (condition-based routing)
- Journal (request log, replay, inspect)
- Folder tree organization
- Gallery import (load pre-built mock sets)
- Server library (saved mock configurations)
- Demo server presets (built-in mock APIs)
- Export mock configuration
- Expiry scheduling
- **Auth-gated routes** — `security` predicate: Bearer token (`scheme = Bearer`), API Key header (`apiKeyName` present), returning 401 when absent
- **GraphQL over HTTP mock** — `POST /graphql` route using `body → jsonPath_equals` on `$.operationName` / `$.query` to dispatch different stub responses per operation; no special GraphQL mode needed
- **Stateful sequence** — `responseMode: 'state'` with `ApiMockStateTransitionV1`: multi-step lifecycle mocking (e.g. order → payment → confirmation) without any external store
- **Webhook receiver** — inbound `POST /webhook` route; `json_subset` / `jsonPath_equals` body predicates to gate on `$.event` type; journal to inspect captured payloads; note that HMAC signature verification (`X-Hub-Signature-256`) is a planned engine feature not yet available

### Planned Files

```
api-mock/
  api-mock.html                             ← master overview
  api-mock-first-server-easy.html           ← create server, add route, test it
  api-mock-response-rules-medium.html       ← conditional responses, status codes
  api-mock-journal-medium.html              ← inspect request log, replay calls
  api-mock-gallery-import-medium.html       ← import pre-built mock sets from gallery
  api-mock-folder-organization-medium.html  ← folders, route grouping, naming
  api-mock-auth-gated-medium.html           ← Bearer + API Key security predicates, 401 fallback
  api-mock-graphql-medium.html              ← POST /graphql, jsonPath body matching per operation
  api-mock-stateful-sequence-advanced.html  ← state mode, multi-step lifecycle transitions
  api-mock-webhook-receiver-medium.html     ← inbound webhook capture, event routing, journal
  api-mock-advanced-routing-advanced.html   ← regex paths, dynamic responses, delays
  api-mock-export-library-advanced.html     ← save to library, export, share config
```

---

## 7. SSE (Server-Sent Events)

**Folder:** `docs/training-manuals/sse/`

### Scope (from e2e + source)
- Connect to SSE endpoint
- Multi-tab connections (independent streams)
- Event log (filter by event type, search)
- Event detail modal (data, type, id, retry)
- Auth panel (Bearer, API Key)
- SSE parser (custom event formats)
- Console

### Planned Files

```
sse/
  sse.html                                  ← master overview
  sse-first-connection-easy.html            ← connect + view live event stream
  sse-event-filtering-medium.html           ← filter by type, search, inspect detail
  sse-auth-medium.html                      ← auth header setup for protected endpoints
  sse-multi-tab-advanced.html               ← independent SSE streams across tabs
```

---

## 8. Webhooks

**Folder:** `docs/training-manuals/webhooks/`

### Scope (from e2e + source)
- Webhook delivery log viewer
- Auto-layout of delivery graph
- Retry/replay from log
- Filtering and search

### Planned Files

```
webhooks/
  webhooks.html                             ← master overview
  webhooks-delivery-logs-easy.html          ← view incoming webhook deliveries
  webhooks-filtering-medium.html            ← filter by status, source, date
  webhooks-retry-advanced.html              ← replay failed deliveries
```

---

## 9. Gallery

**Folder:** `docs/training-manuals/gallery/`

### Scope (from e2e + source)
- Gallery page layout (test factory, workflow factory tabs)
- Browse and preview gallery items
- Import test from gallery (creates scenario with pre-filled steps)
- Import workflow from gallery (creates workflow with nodes/connections)
- Gallery badge (indicates loaded/imported state)
- Sample templates (built-in starter configs)

### Planned Files

```
gallery/
  gallery.html                              ← master overview
  gallery-import-test-easy.html             ← browse + import a test template
  gallery-import-workflow-easy.html         ← browse + import a workflow template
  gallery-custom-templates-advanced.html    ← create and register custom gallery items
```

---

## Summary

| Feature | Folder | Main File | # Tutorials | Status |
|---------|--------|-----------|-------------|--------|
| GraphQL | `graphql/` | `graphql.html` | 13 | ✅ Done (14 files — overview + 13 tutorials) |
| gRPC | `grpc/` | `grpc.html` | 10 | ✅ Done (11 files — overview + 10 tutorials) |
| WebSocket | `websocket/` | `websocket.html` | 13 | ✅ Done (13 files — overview + 12 tutorials) |
| Environment Manager | `environments/` | `environments.html` | 5 | ✅ Done (6 files — overview + 5 tutorials) |
| Results Dashboard | `results/` | `results.html` | 7 | ✅ Done (8 files — overview + 7 tutorials) |
| API Mock (HTTP) | `api-mock/` | `api-mock.html` | 12 | 🔲 Not started |
| SSE | `sse/` | `sse.html` | 4 | 🔲 Not started |
| Webhooks | `webhooks/` | `webhooks.html` | 3 | 🔲 Not started |
| Gallery | `gallery/` | `gallery.html` | 3 | 🔲 Not started |

**Total planned files:** ~65 tutorial HTML files + 9 master overview files

---

## Notes

- All files follow the `<topic>-<difficulty>.html` convention from `CONVENTIONS.md`
- Each master `<feature>.html` file covers all sub-topics with links to individual tutorials
- Difficulty tiers: `-easy` (under 5 steps), `-medium` (5–10 steps), `-advanced` (10+ steps, production patterns)
- Each tutorial must include: concept overview → step-by-step walkthrough using sample files → self-practice exercises
- Sample/example files referenced in walkthroughs must exist in `examples/` before the manual is written
