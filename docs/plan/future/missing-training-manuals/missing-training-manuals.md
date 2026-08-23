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

### Scope (from e2e + source)
- Connect / disconnect (ws:// and wss://)
- Multi-tab connections (up to 8 independent tabs)
- Send pane (text, binary, JSON formatting)
- Message log (filter, bookmark, export)
- Protocol support: plain WebSocket, Socket.IO, STOMP, GraphQL-over-WS
- Auth panel (Bearer, API Key, custom headers)
- TLS panel (rejectUnauthorized, CA cert, proxy vs native)
- Session recording and replay
- Stats dashboard (messages/sec, bytes, uptime, errors)
- Mock server (start server, echo/rule-based responses, broadcast)
- Schema inference and validation
- Message diff viewer
- Console commands (scripted send sequences)
- Load test mode
- WS workflow runner (run test scenarios over WebSocket)

### Planned Files

```
websocket/
  websocket.html                            ← master overview
  websocket-first-connection-easy.html      ← connect ws://echo + send/receive
  websocket-multi-tab-easy.html             ← open multiple independent connections
  websocket-protocols-medium.html           ← Socket.IO, STOMP, GraphQL-WS
  websocket-auth-medium.html                ← Bearer/API Key/custom header auth
  websocket-recording-replay-medium.html    ← record session, replay at speed
  websocket-stats-medium.html               ← live metrics dashboard
  websocket-tls-medium.html                 ← wss:// with CA cert / proxy TLS
  websocket-mock-server-advanced.html       ← start mock, define rules, broadcast
  websocket-schema-validation-advanced.html ← infer schema, validate messages
  websocket-diff-console-advanced.html      ← diff viewer + console scripting
  websocket-load-test-advanced.html         ← concurrent connections, throughput
  websocket-workflow-runner-advanced.html   ← WS scenario in workflow harness
```

---

## 4. Environment Manager

**Folder:** `docs/training-manuals/environments/`

### Scope (from e2e + source)
- Create and edit environments (global, feature-group scoped)
- Variable types (string, secret)
- Environment inheritance (child overrides parent)
- Activate/switch environments
- Use variables in requests via `{{variableName}}`
- Promote/demote shared data sources between environments
- Multi-environment test runs (parameterized env rotation)

### Planned Files

```
environments/
  environments.html                         ← master overview
  environments-basics-easy.html             ← create env, add variables, use in request
  environments-inheritance-medium.html      ← global → feature-group scope chain
  environments-secrets-medium.html          ← secret variables, masking in logs
  environments-multi-run-advanced.html      ← rotate envs across parameterized test
  environments-shared-ds-advanced.html      ← promote/demote shared data sources
```

---

## 5. Results Dashboard

**Folder:** `docs/training-manuals/results/`

### Scope (from e2e + source)
- Results explorer (flow canvas, node expand/collapse, fit-view)
- Response detail modal (status, headers, body, assertion results)
- Run comparison (side-by-side diff of two runs)
- Timeline filters (filter by status, method, node type, tag)
- Execution history (browse past runs, re-run, export)
- Results console (live log during execution)
- Parallel visualization (parallel branch results)
- Sub-workflow drilldown
- SLA overlay on results

### Planned Files

```
results/
  results.html                              ← master overview
  results-explorer-easy.html                ← navigate canvas, expand nodes, view response
  results-console-easy.html                 ← live console during test run
  results-timeline-filters-medium.html      ← filter by status/method/node
  results-comparison-medium.html            ← compare two runs side-by-side
  results-history-medium.html               ← browse, re-run, export past runs
  results-parallel-advanced.html            ← visualize parallel branch execution
  results-sub-workflow-advanced.html        ← drill into sub-workflow results
```

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
| WebSocket | `websocket/` | `websocket.html` | 12 | 🔲 Not started |
| Environment Manager | `environments/` | `environments.html` | 5 | 🔲 Not started |
| Results Dashboard | `results/` | `results.html` | 7 | 🔲 Not started |
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
