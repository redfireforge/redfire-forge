# gRPC Studio — Implementation Plan

> Branch: `feature/grpc-phase` (gRPC Studio work; merges to `develop`)
> Created: 2026-06-28
> Status: **🚧 In progress** — Phases **1–10 complete** (1A–1H through 10A–10I ✅); **Phases 11A–11I complete** ✅; **Phase 12 next**
> **Doc policy (2026-06-30):** This file is the **forward-looking plan only**. Shipped-phase sub-phase specs, sprint logs, re-evaluation passes, and bug-fix history were **removed** — they live in git history and per-phase runbooks under `docs/guides/grpc-phase*-runbook.md`. Do **not** append audit logs here; update the relevant runbook instead.
> Last updated: 2026-07-01 (Phase 11I re-evaluation; hardening verification gates tightened)
> Prior art: `long-term-enhancement-plan.md` P-2; `environment-manager-expansion-plan.md` §gRPC tab

---

## Table of Contents

1. [Overview](#overview)
2. [Competitive Landscape](#competitive-landscape)
3. [Spring Boot Support](#spring-boot-support)
4. [Design Decisions](#design-decisions)
5. [Phase Status Dashboard](#phase-status-dashboard)
6. [Shipped Phases (1–10) — Summary](#shipped-phases-110--summary)
7. [UI / Mockup Parity (Phases 1, 2, 4J)](#ui--mockup-parity-phases-1-2-4j)
8. [Phase 11 — Advanced Features](#phase-11--advanced-features)
9. [Phase 12 — Demo Lessons & Demo Hub](#phase-12--demo-lessons--demo-hub)
10. [Phase 13 — Production Hardening & GA Readiness](#phase-13--production-hardening--ga-readiness)
11. [Phase Dependency Map](#phase-dependency-map)
12. [File Map](#file-map)
13. [Type Definitions](#type-definitions)
14. [Open Questions / Risks](#open-questions--risks)
15. [Docker Test Server](#docker-test-server)

---

## Overview

**gRPC Studio** is a standalone, interactive debug tool for calling gRPC services — analogous to **WebSocket Studio** and **GraphQL Studio**.

Developers and testers can:

- Connect to any gRPC server (plain-text or TLS/mTLS) via proto schema or server reflection
- Browse services and methods (unary + all four streaming types)
- Compose requests with type-aware form input
- Inspect responses (headers, trailers, status codes)
- Save requests as collections; run scenarios in Test Runner; integrate with Workflow engine
- Use native Tauri transport (`tonic`) on desktop
- Interpolate environment variables (`{{grpcHost}}`)

| HTTP world | WebSocket world | gRPC world |
|---|---|---|
| Requests page | Send Panel + Message Log | Service Explorer + Call Panel |
| Environments / Base URL | Connection Profiles | `{{grpcHost}}` per environment |
| Response Body | Message Log | Response Stream + Trailers |
| Catalog | Saved Connections | gRPC Collections |

### Navigation

```
Protocols sub-nav: Kafka | WebSocket | GraphQL | SSE | gRPC
```

---

## Competitive Landscape

> Last researched: 2026-06-28

### Feature comparison matrix

| Feature | Postman | Insomnia | Kreya | grpcui | ezy | **RedfireForge** |
|---|---|---|---|---|---|---|
| Unary RPC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| All streaming types | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Server Reflection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Proto / Protoset Import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type-Aware Form Input | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TLS / mTLS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saved Collections | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Environments / Variables | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| OAuth2 / Bearer Auth | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| gRPC-Web Support | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Spring Servlet Mode | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Workflow Integration | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assertion Engine | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Native Desktop Transport | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Load / Stress Testing | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Built-in Mock Server | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Proto Schema Diff | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Demo Hub Lessons | ❌ | ❌ | ❌ | ❌ | ❌ | 🔲 Phase 12 |

**Key differentiators:** Workflow integration, assertion engine, native Tauri/tonic transport, gRPC-Web, load testing, proto schema diff, built-in mock server.

---

## Spring Boot Support

> Researched: 2026-06-28 — Spring gRPC 1.1.0 (Boot 4.1.x) + net.devh starters

| Ecosystem | Default port | Notes |
|---|---|---|
| Spring gRPC 1.x (official) | **9090** | Netty + Servlet modes; reflection v1 |
| net.devh starter | **9090** | Most widely deployed community starter |
| LogNet starter (legacy) | **6565** | Older apps |

**Studio behaviors:**

1. **Port 9090** — Spring Boot quick-connect profiles use `localhost:9090`, not `50051`.
2. **Netty vs Servlet** — Netty = standard HTTP/2 gRPC; Servlet = HTTP POST `/<service>/<method>` (Phase 10 gRPC-Web / Spring Servlet transport).
3. **Reflection v1** — try v1 first, fall back to v1alpha.
4. **Actuator health** — named services (`db`, `redis`, …) beyond global `""`; hint in Health panel (4J-D).
5. **Spring Security** — Basic, Bearer, mTLS, `@PreAuthorize` → PERMISSION_DENIED surfaced; no new auth types needed.
6. **In-process targets** — accept `in-process:<name>` in connection bar.

### Spring Boot Quick-Connect Profiles

| Profile | Target | TLS | Notes |
|---|---|---|---|
| Spring Boot (Netty, local) | `localhost:9090` | None | Standard local dev |
| Spring Boot (Netty, TLS) | `<host>:9090` | TLS | Production Netty |
| Spring Boot (Servlet) | `localhost:8080` | None | Phase 10 transport |
| net.devh starter | `localhost:9090` | None | Same as official |
| LogNet (legacy) | `localhost:6565` | None | Legacy only |
| Generic gRPC | `localhost:50051` | None | Non-Spring |

---

## Design Decisions

1. **Descriptor source priority:** Reflection → Proto Files → Protoset → BSR → URL Proto. Never silently switch source on transient reflection failure.
2. **Form-first input with JSON fallback** — type-aware widgets; JSON tab syncs bidirectionally.
3. **Transport:** Web = Express `@grpc/grpc-js` proxy + SSE streams; Desktop = Rust `tonic` (Phase 7).
4. **Streaming as first-class** — live message log, compose bar, directional attribution (not batch-only like grpcui).
5. **Metadata as key-value table** — shared `KeyValueEditor`; reserved keys labeled.
6. **Collections stored locally** — service/method tree mirroring proto hierarchy.
7. **`{{grpcHost}}`** — reserved env token (`host:port`, no scheme).

---

## Phase Status Dashboard

| Phase | Delivers | Status | Gate / runbook |
|---|---|---|---|
| **1** — Core Unary | Explorer, unary call, form, response panel | ✅ 1A–1H | [`grpc-phase1-runbook.md`](../../guides/grpc-phase1-runbook.md) |
| **2** — Streaming | Server/client/bidi streams, message log | ✅ 2A–2I | [`grpc-phase2-runbook.md`](../../guides/grpc-phase2-runbook.md) |
| **3** — Proto Management | Upload, reflection, schema browser, drift | ✅ 3A–3I | [`grpc-phase3-runbook.md`](../../guides/grpc-phase3-runbook.md) |
| **4** — TLS & Auth | TLS/mTLS, OAuth2, secret vault | ✅ 4A–4I | [`grpc-phase4-runbook.md`](../../guides/grpc-phase4-runbook.md) |
| **4J** — UI/UX parity | Connection bar, TLS modal, settings drawer | ✅ 4J-A–E | `npm run test:grpc:phase4j` |
| **5** — Collections & History | Save/replay, grpcurl import/export | ✅ 5A–5I | [`grpc-phase5-runbook.md`](../../guides/grpc-phase5-runbook.md) |
| **6** — Workflow | `grpcUnary`, stream nodes, namespace | ✅ 6A–6I | [`grpc-phase6-runbook.md`](../../guides/grpc-phase6-runbook.md) |
| **7** — Tauri Native | Rust `tonic`, channel pool, events | ✅ 7A–7I | [`grpc-phase7-runbook.md`](../../guides/grpc-phase7-runbook.md) |
| **8** — Test Runner | Harness scenarios, field assertions | ✅ 8A–8I | [`grpc-phase8-runbook.md`](../../guides/grpc-phase8-runbook.md) |
| **9** — Env Interpolation | `{{grpcHost}}`, deep resolver | ✅ 9A–9I | [`grpc-phase9-runbook.md`](../../guides/grpc-phase9-runbook.md) |
| **10** — gRPC-Web | grpc-web + Spring Servlet transport | ✅ 10A–10I | [`grpc-phase10-runbook.md`](../../guides/grpc-phase10-runbook.md) |
| **11** — Advanced | Load test, mock server, schema diff | ✅ 11A–11I | [`grpc-phase11-runbook.md`](../../guides/grpc-phase11-runbook.md) |
| **12** — Demo Lessons | 15 Demo Hub lessons | 🔲 **12C** (persistence); 12A–12B ✅; GRPC-1 pilot | — |
| **13** — GA Hardening | SLOs, a11y, release gates | 🔲 Pending | — |

---

## Shipped Phases (1–10) — Summary

> **Do not re-expand shipped phases in this file.** For acceptance checklists, architecture diagrams, sub-phase deliverables, and defect history, use the phase runbook (and validation report where published).

| Phase | One-line summary |
|---|---|
| **1** | Tab-scoped unary explorer: Express proxy, reflection/proto descriptors, form composer, response panel. |
| **2** | SSE stream relay, stream registry, message log UI, all four call types. |
| **3** | Proto/protoset/BSR/URL ingest, import resolver, schema browser, drift detection. |
| **4** | TLS tri-mode, auth (bearer/basic/api_key/oauth2), secret vault, redaction, transport errors. |
| **4J** | UI shell parity: connection bar, TLS modal, auth pills, settings drawer (see below). |
| **5** | IDB collections/history, save/replay, grpcurl import/export, response baseline. |
| **6** | Workflow nodes (`grpcUnary`, streams, assert), output namespace, retry policy. |
| **7** | Tauri `tonic` channel pool, native unary/stream, transport selector, Express fallback. |
| **8** | Harness snapshot builder, field assertions, export redaction, canonical harness result. |
| **9** | `{{var}}` interpolation grammar, deep resolver, cross-surface parity (studio/workflow/harness). |
| **10** | gRPC-Web + Spring Servlet transports, content-type modes, streaming restrictions. |

**Cross-feature matrix:** [`grpc-cross-feature-matrix.md`](grpc-cross-feature-matrix.md)

---

## UI / Mockup Parity (Phases 1, 2, 4J)

> **UI reference:** `docs/plan/future/grpc/mockups/` (01–06)
> **Enforcement:** [`.cursor/rules/grpc-studio-ui.mdc`](../../../.cursor/rules/grpc-studio-ui.mdc)

### Phase 1 vs mockup gap

> **UI reference:** `mockups/01-main-studio.html`

Phase 1 delivers **unary exploration and execution**. The table records what matches, what differs intentionally, and what later phases own — so agents do not “re-discover” missing polish as bugs.

| Mockup region | Phase 1 status | Notes / owner phase |
|---|---|---|
| App header + Protocols sub-nav | ✅ Product shell | `App.tsx` / `AppSubNav` |
| Tab bar (multi-tab, close, rename) | ✅ Shipped | Tab call-type pills → **Phase 2G** |
| Connection bar: target input | ✅ **`GrpcConnectionBar`** + validation strip | Format/resolution badge, not reachability |
| Connection bar: Connect/Disconnect | ✅ Shipped | Target probe via `/api/grpc/status`; status dot + toggle (not persistent channel) |
| TLS badge + Auth badge | ✅ **4J-A/B** | TLS badge → modal |
| Auth chip in connection bar | ✅ **4J-A/C** | Focuses Auth tab; gear → settings drawer |
| Service explorer + Reflect | ✅ Shipped | |
| **Manage Schemas** | ✅ **Phase 3I** | `GrpcProtoManageModal` |
| Send bar + request tabs | ✅ Shipped | Auth tab kept (dual entry with bar chip) |
| Form builder | ✅ Shipped | oneof pills, WKT fields, map key/value rows |
| JSON toolbar (Pretty/Copy) | ✅ Shipped | Request JSON tab + response body toolbar |
| Request JSON syntax highlighting | ✅ Shipped | `GrpcHighlightedJsonTextarea` overlay in request JSON tab |
| Response panel | ✅ Shipped | Snapshot → **Phase 5** |
| Response syntax highlighting | ✅ Shipped | `highlightJson` in response body |
| Timing breakdown bars | ✅ Shipped | Server-measured phases + UI bars |
| Streaming UI | ✅ Phase 2F | See Phase 2 gap table |

**Rule:** Deferred mockup controls are **not** Phase 1 bug-fix scope — extend the owning phase instead.

### Phase 2 vs mockup gap

> **UI reference:** `mockups/02-streaming.html`

| Mockup region | Phase 2 status | Notes |
|---|---|---|
| Tab bar call-type pills (U/SS/CS/BD) | ✅ Phase 2G | Badge on tab title |
| Manual “Call Type” selector | ✅ Shipped | Layout gallery when no method; locked to proto when method selected |
| Server streaming log + status bar | ✅ Phase 2F | |
| Client streaming pending queue | ✅ Shipped | Left panel + Add to queue / Send now / Send all / End stream |
| Bidirectional duplex log | ✅ Phase 2F | |
| Connection bar TLS / settings | ✅ **4J-A/C/D** | |
| Export log JSON | ✅ Shipped | Status bar Export log button |
| Message cap + Clear log | ✅ Phase 2F | 10,000 cap + count badge |

**Call type rule:** Execution uses `method.callType` from the explorer. The call-type selector row is a **layout gallery** when no method is selected; when a method is selected, the row locks to that proto signature (Phase 2 mockup 02).

### Phase 3 vs mockup gap (deferred items)

> **UI reference:** `mockups/03-proto-management.html` + Phase 1 form/JSON polish

| Item | Phase 3 status | Notes |
|---|---|---|
| Request JSON syntax highlighting | ✅ Shipped | `GrpcHighlightedJsonTextarea` (Phase 1 gap closed in Phase 3) |
| Timing breakdown bars | ✅ Shipped | Phase 1G response Timing tab (unchanged) |
| OQ-3 — large proto import graphs | ✅ Shipped | `protoFileDescriptorPool` — cached WKT descriptor set + ingest fingerprint cache |
| OQ-7 — `google.protobuf.Any` form builder | ✅ Shipped | Raw JSON editor + `@type` hint row (type picker deferred) |
| OQ-8 — int64 JSON precision | ✅ Shipped | 64-bit fields as decimal strings; JSON tab rejects numeric literals; encode normalizes strings → Long |

### Phase 4J — Protocol UI/UX Parity

> **Status:** ✅ **Complete** — **4J-A through 4J-E shipped**. Merge gate: `npm run test:grpc:phase4j`.

> **Goal:** Align gRPC connection-bar TLS/auth patterns with GraphQL, WebSocket, and mockups `01` / `04` before new UI work.
>
> **Scope:** Presentation layer only — reuse Phase 4 contracts. No transport/auth-logic changes unless UI wiring bug.

**Rule going forward:** No inline PEM editors or page-level TLS blocks. TLS via **`GrpcTlsConfigModal`** or Connection Settings drawer.

| Pattern | GraphQL / WebSocket | gRPC (after 4J) |
|---|---|---|
| TLS entry | Bar badge → modal | ✅ `GrpcTlsConfigModal` via bar badge |
| TLS tri-mode | GQL/WS skip-verify | ✅ Plaintext / TLS / mTLS in modal |
| Auth entry | Bar chip → Auth tab | ✅ Bar chip + Auth tab (dual entry) |
| Auth form | Type pills + two-tone rows | ✅ Pills + two-tone rows |
| Settings | Modal / drawer | ✅ `GrpcConnectionSettingsDrawer` (4J-C/D) |

**Mockup re-audit:**

| Mockup | Relevance | Status |
|---|---|---|
| `01-main-studio.html` | Connection bar, TLS/Auth badges | ✅ 4J-A/B; Connect dot deferred |
| `02-streaming.html` | Inherits 01 bar | ✅ Reuses `GrpcConnectionBar` |
| `03-proto-management.html` | Schema sources only | ✅ Phase 3I |
| `04-auth-tls.html` | Full settings nav | ✅ 4J-C/D |
| `05-collections-history.html` | Assumes 01 bar | ✅ 4J-A/B |
| `06-advanced-features.html` | Phase 11 panels | ✅ Phase 11G (Load / Mock / Diff; RPC Stats deferred) |

**4J execution order:** `4J-A → 4J-B → 4J-C → 4J-D → 4J-E` (merge gate for Phase 5 UI)

### Phase 4J acceptance checklist

- [x] No visible inline PEM on main surface — TLS via modal/drawer only.
- [x] TLS badge shows Plaintext / TLS / mTLS consistent with tab `tlsMode`.
- [x] TLS badge opens modal; Save/Cancel/Close; dirty reverts on Cancel.
- [x] Auth badge shows type; click focuses Auth tab.
- [x] Settings drawer from gear + deadline badge (4J-C).
- [x] Auth type uses pills, not native `<select>`.
- [x] Secret mask/unmask/clear; exports redact (4E unchanged).
- [x] `npm run test:grpc:phase4i` and `npm run test:grpc:phase4j` pass.
- [x] Phase 1 + Phase 2 gap tables reflect 4J connection bar / modal / drawer.

---

## Phase 11 — Advanced Features

> **Goal:** Load testing, mock gRPC server, and proto schema diff. Addresses the feature gap vs all known competitors.

### Phase 11A — Load & Stress Testing

Powered by `ghz`-inspired logic (Go binary or Rust native):
- Configurable: concurrent workers, total calls, duration, ramp-up
- Metrics: p50/p95/p99 latency, calls/sec, error rate, status code distribution
- Real-time chart (latency histogram + throughput sparkline)
- Supports unary calls (streaming load test in a later iteration)
- Export results as JSON/CSV

Load test execution contract:

- Executes from immutable active-tab snapshot (`target`, `descriptorKey`, `service`, `method`, `body`, metadata/auth/tls).
- `callType` must be `unary` for Phase 11A; reject streaming call types with validation error.
- Safety limits: enforce max concurrency, max duration, and max total calls to avoid local resource exhaustion.
- Warm-up samples are excluded from percentile calculations.
- Export includes run config, resolved environment name, and timestamp for reproducibility.

Suggested load test result shape:

```ts
interface GrpcLoadTestResult {
  runId: string;
  startedAt: string;
  durationMs: number;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  callsPerSec: number;
  latencyMs: { p50: number; p95: number; p99: number; min: number; max: number; avg: number };
  statusDistribution: Record<string, number>; // grpc status code -> count
  errorSamples?: Array<{ grpcStatus?: number; message: string }>;
}
```

### Phase 11B — gRPC Mock Server

Based on proto schema (service + message types):
- Auto-generate mock responses from schema defaults + user-defined rules
- Rules: `method == "GetOrder" AND request.order_id == "123" → response { status: "FOUND", ... }`
- Runs as a separate in-process gRPC server (Rust `tonic` server on desktop; Go subprocess on web)
- Live rule sync: edit rules in UI, mock server reacts immediately

Rule evaluation contract:

- Rules evaluate in deterministic priority order (`priority` asc, then creation order).
- First matching enabled rule wins unless `fallthrough` is explicitly enabled.
- Matching context includes method, metadata, and request body expression predicates.
- If no rule matches, return configurable default (`UNIMPLEMENTED` by default) with optional default body.
- Rule evaluation and expression parsing must be sandboxed (no arbitrary code execution).

Mock runtime behavior:

- Unary and streaming call types can be mocked; streaming emits ordered message sequences with optional inter-message delay.
- Latency simulation uses `defaultLatencyMs` + bounded jitter and is deterministic when seed is provided.
- Hot rule updates must not break in-flight calls; new calls see latest committed rule set.
- Mock server lifecycle follows tab scope for execution, but process lifecycle is app-scoped with per-connection config resolution.

#### Per-tab behavior (aligned with GraphQL)

Mock server configuration must resolve from the active tab context, following the same inheritance model as GraphQL connection settings:

1. **Tab override** (`tab.mockConfig`) if explicitly set
2. **Linked connection/profile mock config** (`connectionId` / target-scoped)
3. **Workspace default mock config**

Execution and sync are **active-tab scoped**:
- Switching tabs immediately switches the effective mock rule set
- Running tab A cannot accidentally use tab B's rules
- Duplicating a tab copies mock override by value
- Closing a tab cleans up tab-local mock execution state

Storage keys:
- `grpc-mock-config-${resolvedTabConnectionId}` for connection-scoped config
- `grpc-mock-tab-override-${tabId}` for explicit per-tab override

Suggested utility parity with GraphQL (`tabConnectionResolution.ts`):
- `resolveGrpcTabConnection(tab, profiles, pageDefaults)`
- `resolveGrpcMockConnectionId(pageDefaultTarget, historyTarget, tabTarget, preferTabOverride)`
- `resolveGrpcTabMockConfig(tab, profile, pageDefaultMockConfig)`

### Phase 11C — Proto Schema Diff

- Compare two proto descriptor states (e.g., loaded from different branches)
- Highlights: added/removed/changed fields, renamed enums, breaking vs non-breaking changes
- Follows Buf's breaking change detection rules
- Useful for API review and regression detection in CI

Schema diff contract:

- Input supports any two descriptor sources (`reflection`, `proto_files`, `protoset`, `bsr`, `url_proto`).
- Output groups changes by severity: `breaking`, `non_breaking`, `informational`.
- Breaking examples: field removal, field number/type wire incompatibility, RPC signature changes.
- Non-breaking examples: adding optional fields, adding enum values (with compatibility caveat notes).
- Exportable report formats: JSON (machine-readable) and Markdown (PR review friendly).

Suggested diff output shape:

```ts
interface GrpcSchemaDiffReport {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  summary: { breaking: number; nonBreaking: number; informational: number };
  changes: Array<{
    severity: 'breaking' | 'non_breaking' | 'informational';
    entityType: 'service' | 'method' | 'message' | 'field' | 'enum' | 'enum_value';
    entityPath: string;
    changeType: string;
    description: string;
  }>;
}
```

### Advanced-features isolation and result contract

- Load testing, mock server, and schema diff operate on immutable run snapshots and must not mutate active tab request drafts.
- Phase 11 tools publish results into isolated namespaces (`loadTest`, `mockRuntime`, `schemaDiff`) to prevent cross-feature overwrite.
- Background operations (load tests, mock rule updates, diff generation) are cancellable and tab-safe.
- All exports (JSON/CSV/Markdown) must apply Phase 4 secret redaction and include source metadata for reproducibility.
- Errors are categorized per feature but normalized for UI consistency (`validation`, `runtime`, `timeout`, `io`, `internal`).

### Detailed sub-phase plan and execution tracker

#### Phase 11A — Feature contracts and shared runtime boundaries

Status:
- ✅ Complete (2026-06-30)

Scope:
- Freeze contracts for load-test, mock-server, and schema-diff modules.
- Define shared execution lifecycle, cancellation semantics, and result namespaces.

Deliverables:
- Cross-feature contract matrix and namespace ownership policy.
- Unified status/error model for advanced-feature operations.
- Shared contract module for: namespace isolation, lifecycle transition policy, cancellation semantics, and load-test Phase 11A validation boundaries (unary-only + safety caps).
- Acceptance gate script and test coverage for contract behavior and source-scan checklist traceability.

Verification gates:
- Contract tests for namespace isolation and cancellation state transitions.
- Validation tests for feature-specific input schemas.
- Gate run must pass: TypeScript, Phase 11A acceptance tests, and Phase 10I regression.

Exit criteria:
- No ambiguity in shared runtime boundaries or result ownership.
- `test:grpc:phase11a` passes and Phase 10I remains green.

#### Phase 11B — Load-test config validation and scheduler core

Status:
- ✅ Complete (2026-06-30)

Implementation Notes / Retrospective:
- The Phase 11B gate was ultimately verified through the full chained regression, but it initially exposed an upstream Demo Hub TypeScript export collision in `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts`; the helper now aliases the shared tab allowlist so the phase gate can reach the scheduler tests cleanly.

Scope:
- Implement load-test config validation (unary-only, safety caps).
- Build run scheduler with bounded concurrency, duration, and stop conditions.

Deliverables:
- Config validator + safety limit enforcement.
- Scheduler/executor core with deterministic start/stop lifecycle.

Verification gates:
- Tests for limit enforcement, invalid configs, and run cancellation.
- Stress tests for bounded resource behavior.

Exit criteria:
- Load tests are safe, bounded, and predictable before metrics integration.

#### Phase 11C — Load-test metrics pipeline and export

Status:
- ✅ Complete (2026-06-30)

Scope:
- Implement metric aggregation (latency percentiles, throughput, status distribution).
- Add JSON/CSV exports with reproducible run metadata.
- Exclude warm-up attempts from latency/throughput percentiles while still reporting them in the run counts and export metadata.

Deliverables:
- Metrics aggregator and run summary serializer.
- Export builders including config, environment, and timestamp context.

Verification gates:
- Tests for percentile correctness and warm-up exclusion.
- Golden tests for JSON/CSV schema stability.

Exit criteria:
- Load-test outputs are accurate, reproducible, and consumable.

#### Phase 11D — Mock rule model and evaluator engine

Status:
- ✅ Complete (2026-06-30)

Scope:
- Implement deterministic rule evaluation ordering (`priority` asc, then `createdAt`/input order).
- Implement `fallthrough` chain semantics (continue on match; last non-fallthrough or last fallthrough match wins).
- Enforce sandboxed predicate parsing/evaluation — no `eval`, `Function`, `require`, or arbitrary JS execution.
- Support matching context: `service`, `method`, `metadata`, and `request` body paths.
- Provide configurable default response when no rule matches (`UNIMPLEMENTED` / status `12` by default).
- **Out of scope for 11D** (deferred to 11E+): mock server process lifecycle, hot-swap runtime manager, streaming emission, latency jitter simulation, tab/connection config resolution UI.

Rule model (canonical types in `src/shared/grpc/grpcMockRuleContracts.ts`):

```ts
interface GrpcMockRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  createdAt?: string; // tie-breaker after priority
  fallthrough?: boolean;
  predicate: GrpcMockPredicate; // structured and/or parsed from sandboxed expression
  response: GrpcMockRuleResponse;
}

interface GrpcMockRuleSet {
  rules: GrpcMockRule[];
  defaultResponse?: GrpcMockDefaultResponse; // default statusCode 12 (UNIMPLEMENTED)
}
```

Predicate sandbox contract:
- Structured predicates: `method_equals`, `service_equals`, `metadata_equals`, `metadata_exists`, `body_path_equals`, `body_path_exists`, `and`, `or`, `not`.
- Expression strings (`predicate.kind === 'expression'`) are parsed into the same AST via `parseGrpcMockPredicateExpression` — never executed with `eval`/`Function`.
- Allowed expression references: `method`, `service`, `request.<jsonPath>` (dot + bracket segments), `metadata.<key>`.
- Allowed operators: `==`, `!=`, `AND`/`and`, `OR`/`or`, `NOT`/`not` (case-insensitive), parentheses.
- Reject forbidden tokens/patterns (`eval`, `Function`, `=>`, `import`, `__proto__`, semicolons, etc.) outside of quoted string literals.
- `validateGrpcMockRuleSet` must parse `expression` predicates at validation time (fail fast on syntax/security errors).

Evaluation contract:
- Sort enabled rules by `priority` asc, then `createdAt` asc, then stable input index.
- On match without `fallthrough`: return rule response immediately.
- On match with `fallthrough`: remember as candidate and continue; if loop ends with only fallthrough matches, return last candidate.
- If no rule matches: return `defaultResponse` (`usedDefault: true`).

Deliverables:
- `src/shared/grpc/grpcMockRuleContracts.ts` — types, validation, default constants.
- `src/shared/grpc/grpcMockPredicateSandbox.ts` — expression parser + sandboxed predicate evaluator.
- `src/shared/grpc/grpcMockRuleEvaluatorCore.ts` — ordering, fallthrough chains, default path.
- `src/shared/grpc/grpcPhase11dAcceptance.test.ts` — acceptance suite.
- `scripts/test-grpc-phase11d.sh` — gate script (`npm run test:grpc:phase11d`).

Verification gates:
- Tests for first-match behavior, fallthrough chains, and default responses.
- Security tests for blocked arbitrary code execution paths in expression parsing.
- Source-scan traceability for sandbox boundary and fallthrough ordering.
- Gate run must pass: TypeScript, Phase 11D acceptance tests, and Phase 11C regression.

Exit criteria:
- Mock rule outcomes are deterministic and safe.
- `test:grpc:phase11d` passes and Phase 11C remains green.

#### Phase 11E — Mock runtime lifecycle and hot-update behavior

Status:
- ✅ Complete (2026-06-30)

Scope:
- Implement tab-scoped mock runtime manager with 11A `mockRuntime` lifecycle wiring (`idle` → `validating` → `running` → `completed`/`failed`/`cancelled`).
- Resolve effective mock config from tab override → connection profile → workspace default (logic only; UI in 11G).
- Hot-swap committed rule sets: in-flight calls pin the rule snapshot taken at `beginCall`; new calls use latest commit.
- Unary mock execution with deterministic latency + bounded jitter (seeded).
- Stream mock planning: ordered `messages[]` emission with per-message delay (server-streaming / bidi server half).
- Tab registry: active-tab routing, per-tab isolation, cleanup on tab close.
- **Out of scope for 11E** (deferred to 11G+): `GrpcMockServerPanel` UI, actual in-process gRPC listener (Go/Tauri), schema auto-generation of mock bodies.

Config resolution contract (`src/shared/grpc/grpcMockConfigResolution.ts`):

```ts
interface GrpcMockConfigSource {
  ruleSet: GrpcMockRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
}

// Inheritance: tab.mockConfigOverride → profile.mockConfig → workspaceDefault
resolveGrpcTabMockConfig(tab, profile, workspaceDefault): GrpcMockResolvedMockConfig;

// Storage keys (persistence wiring in 11G):
// grpc-mock-tab-override-${tabId}
// grpc-mock-config-${connectionId}
```

Hot-swap contract (`src/shared/grpc/grpcMockRuntimeCore.ts`):

- `commitRuleSet(ruleSet)` validates + clones, bumps `generation`, does not mutate in-flight pinned snapshots.
- `beginCall(context)` pins `{ generation, ruleSet }` for the call session.
- `evaluateSession(session)` evaluates against the in-flight pinned snapshot and context only.
- `endCall(callId)` removes in-flight tracking; tab `remove(tabId)` clears manager state.

Latency contract (`src/shared/grpc/grpcMockLatencySimulation.ts`):

```ts
interface GrpcMockLatencyPolicy {
  defaultLatencyMs?: number;
  jitterMs?: number;
  seed?: number; // deterministic jitter when set
}
```

- Per-call latency = `response.latencyMs ?? defaultLatencyMs ?? 0` + bounded jitter.
- Jitter draw is deterministic from `(seed, callSequence)` when seed is provided.
- Enforce caps: `defaultLatencyMs` ≤ 30_000, `jitterMs` ≤ 5_000.

Stream emission contract:

- `server_streaming` / `bidi_streaming`: emit `response.messages[]` when present, else single `response.body`.
- Each message gets `delayBeforeMs` (first message includes resolved unary latency; subsequent use `response.interMessageDelayMs ?? defaultLatencyMs ?? 0`).

Deliverables:
- `src/shared/grpc/grpcMockConfigResolution.ts` — tab/profile/workspace mock config resolution + storage key helpers.
- `src/shared/grpc/grpcMockLatencySimulation.ts` — deterministic latency/jitter resolver.
- `src/shared/grpc/grpcMockRuntimeCore.ts` — runtime manager, call sessions, unary/stream planners.
- `src/shared/grpc/grpcMockRuntimeRegistry.ts` — per-tab manager registry and active-tab routing.
- `src/shared/grpc/grpcPhase11eAcceptance.test.ts` — acceptance suite.
- `scripts/test-grpc-phase11e.sh` — gate script (`npm run test:grpc:phase11e`).

Verification gates:
- In-flight stability: call pinned to generation N completes with rules from N after commit N+1.
- Tab isolation: tab A commit does not affect tab B evaluation.
- Latency determinism: same seed + call sequence → same latency draws.
- Stream planner: multi-message rules emit ordered plan with delays.
- Gate run must pass: TypeScript, Phase 11E acceptance tests, and Phase 11D regression.

Exit criteria:
- Mock runtime is stable, live-editable, and lifecycle-safe.
- `test:grpc:phase11e` passes and Phase 11D remains green.

#### Phase 11F — Schema diff engine and severity classification

Status:
- ✅ Complete (2026-06-30)

Scope:
- Implement descriptor-to-descriptor diff engine with severity classification over normalized `GrpcDescriptor` snapshots (source-agnostic once loaded).
- Align breaking / non-breaking / informational logic with Buf-style wire-compatibility rules documented in Phase 11C.
- Deterministic, sort-stable change lists for CI and PR review exports.
- **Out of scope for 11F** (deferred to 11G+): `GrpcSchemaDiffPanel` UI, snapshot persistence, acknowledgement workflow.

Input contract:
- Compare any two loaded descriptors regardless of source (`reflection`, `proto_files`, `protoset`, `bsr`, `url_proto`).
- `left` = baseline (older); `right` = candidate (newer).
- Descriptor keys (`left.key`, `right.key`) stamp the report for reproducibility.

Severity policy (wire-compatibility aligned):

| Change | Severity | Notes |
|---|---|---|
| Service removed | `breaking` | RPC surface shrink |
| RPC removed | `breaking` | |
| RPC `callType` changed | `breaking` | Streaming semantics change |
| RPC request/response type changed | `breaking` | Signature change |
| Message removed | `breaking` | Type no longer available |
| Field removed (by field number) | `breaking` | Wire data loss |
| Field number changed | `breaking` | Same as remove + add |
| Field wire shape changed (type/label/map/message ref) | `breaking` | Incompatible on the wire |
| Required field added | `breaking` | Proto2 / legacy required semantics |
| Enum removed | `breaking` | |
| Enum value removed | `breaking` | |
| Enum value number changed | `breaking` | |
| Service added | `non_breaking` | |
| RPC added | `non_breaking` | |
| Message added | `non_breaking` | |
| Optional/repeated field added | `non_breaking` | Proto3 default |
| Enum added | `non_breaking` | |
| Enum value added | `non_breaking` | Caveat: clients must tolerate unknown enum values |
| Field renamed (same number + wire shape) | `informational` | Wire-compatible rename |
| Doc comment changed | `informational` | No wire impact |

Report contract (`src/shared/grpc/grpcSchemaDiffContracts.ts`):

```ts
interface GrpcSchemaDiffReport {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  summary: { breaking: number; nonBreaking: number; informational: number };
  changes: GrpcSchemaDiffChange[];
}
```

Export contract (`src/shared/grpc/grpcSchemaDiffExport.ts`):
- `serializeGrpcSchemaDiffReportJson(report)` — stable JSON for CI gates.
- `serializeGrpcSchemaDiffReportMarkdown(report)` — PR-review table with severity counts.

Deliverables:
- `src/shared/grpc/grpcSchemaDiffContracts.ts` — report types, change-type constants, summary helpers.
- `src/shared/grpc/grpcSchemaDiffEngine.ts` — descriptor index builder, comparator, severity classifier.
- `src/shared/grpc/grpcSchemaDiffExport.ts` — JSON + Markdown serializers.
- `src/shared/grpc/grpcPhase11fAcceptance.test.ts` — acceptance suite with breaking/non-breaking corpus.
- `scripts/test-grpc-phase11f.sh` — gate script (`npm run test:grpc:phase11f`).

Verification gates:
- Breaking corpus: field removal, type change, RPC signature change, service removal.
- Non-breaking corpus: optional field add, enum value add, service/RPC add.
- Determinism: identical input → byte-stable sorted `changes` array across repeated runs.
- Export golden: JSON/Markdown structure includes severity summary and sorted changes.
- Gate run must pass: TypeScript, Phase 11F acceptance tests, and Phase 11E regression.

Exit criteria:
- Diff classification is reliable, deterministic, and policy-consistent.
- `test:grpc:phase11f` passes and Phase 11E remains green.

#### Phase 11G — Advanced feature UI surfaces and ergonomics

Status:
- ✅ Complete (2026-06-30)

Scope:
- Build/align UI panels for load test, mock server, and schema diff per mockup `06-advanced-features.html`.
- Wire panels into gRPC Studio via **Advanced** sub-nav view (`studio` | `collections` | `history` | `advanced`).
- Tab-scoped operation state, progress, cancellation, and result display using Phase 11A namespace isolation (`loadTest`, `mockRuntime`, `schemaDiff`).
- **Out of scope for 11G** (deferred to 11H+): RPC Statistics tab, real in-process gRPC listener (Go/Tauri), mock rule visual builder, load-test profile persistence, schema diff acknowledgement workflow, collections/workflow integration.

UI contract (`src/features/grpc/grpcStudioAdvancedTypes.ts`):

```ts
type GrpcAdvancedFeatureTab = 'load_test' | 'mock_server' | 'schema_diff';

interface GrpcTabAdvancedFeaturesUiState {
  activeFeatureTab: GrpcAdvancedFeatureTab;
  runtime: GrpcAdvancedFeatureRuntimeState; // per-namespace operation status from 11A
  loadTest: { config: GrpcLoadTestConfig; lastSummary?: GrpcLoadTestRunSummaryExport; live?: GrpcTabLoadTestLiveProgress };
  mockServer: { rulesJson: string; mockConfigOverride?: GrpcMockConfigSource; latencyPolicy?: GrpcMockLatencyPolicy };
  schemaDiff: { baselineDescriptor?: GrpcDescriptor; severityFilter: 'all' | GrpcSchemaDiffSeverity; lastReport?: GrpcSchemaDiffReport };
}
```

Load test panel contract:
- Uses immutable `prepareExecuteSnapshot` + `captureGrpcLoadTestExecuteSnapshot` from active tab.
- Unary-only gate with inline validation message (reuses `validateGrpcLoadTestConfig`).
- Start → `startGrpcLoadTestSchedulerRun` with `invokeGrpcUnary` execute bridge; Stop → `cancel()`.
- Live progress from scheduler `getState()` counts; completed runs render `buildGrpcLoadTestRunSummaryExport` metrics.
- Export JSON/CSV via Phase 11C serializers.

Mock server panel contract:
- Resolves effective config via `resolveGrpcTabMockConfig` (tab override → profile → workspace default).
- Rules edited as validated JSON (`validateGrpcMockRuleSet`); Start/Stop via `createGrpcMockRuntimeRegistry` per tab.
- Shows runtime status, resolved config source chip, and rule list summary (enabled count, generation).
- **No real network listener** — runtime manager only (actual listener deferred).

Schema diff panel contract:
- **Capture baseline** clones current tab descriptor; **Compare** runs `computeGrpcSchemaDiff` (baseline vs candidate).
- Severity filter + virtualized list cap (`GRPC_SCHEMA_DIFF_UI_LIST_CAP` = 500) for large diffs.
- Export JSON/Markdown via Phase 11F serializers.

Deliverables:
- `src/features/grpc/grpcStudioAdvancedTypes.ts` — tab-scoped UI state types.
- `src/features/grpc/utils/grpcStudioAdvancedModel.ts` — status labels, progress, diff filter/virtualize, mock JSON parse.
- `src/features/grpc/utils/grpcStudioAdvancedCommands.ts` — load-test execute bridge, diff compute, mock start/stop helpers.
- `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts` — orchestration hook (tab isolation + registry cleanup).
- `src/features/grpc/components/GrpcAdvancedFeaturesShell.tsx` — advanced sub-tab bar.
- `src/features/grpc/components/GrpcLoadTestPanel.tsx`
- `src/features/grpc/components/GrpcMockServerPanel.tsx`
- `src/features/grpc/components/GrpcSchemaDiffPanel.tsx`
- `src/shared/selectors/grpc.ts` — `GRPC.ADVANCED_*` selectors.
- `src/styles/grpc-studio.css` — `.grpc-advanced-*` namespace.
- `src/features/grpc/utils/grpcStudioAdvancedModel.test.ts` + `src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx` + `scripts/test-grpc-phase11g.sh`.

Verification gates:
- UI tests for start/stop/cancel/result render paths on all three panels.
- Performance: diff list capped at 500 visible rows; load-test results render summary metrics without rendering full attempt arrays.
- Gate run must pass: TypeScript, Phase 11G acceptance tests, and Phase 11F regression.

Exit criteria:
- Advanced-feature workflows are usable, clear, and tab-safe.
- `test:grpc:phase11g` passes and Phase 11F remains green.

#### Phase 11H — Cross-surface integration and export safety

Status:
- ✅ Complete (2026-06-30)

Scope:
- Add export-safety layer for Phase 11G advanced-feature clipboard exports (load-test JSON/CSV, schema-diff JSON/Markdown).
- Stamp reproducible **source metadata** on load-test exports (service, method, descriptor key, transport mode, target template — no secrets).
- Sanitize load-test `attempts[].errorMessage` and schema-diff change descriptions before export (mirror Phase 8H harness export pattern).
- Extend `GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS` with `grpc_load_test_export` and `grpc_schema_diff_export`; leak-scan at export boundary via `assertGrpcCrossFeatureExportSafe`.
- Document cross-surface integration matrix rows: Collections/History replay → Studio tab → Advanced features (implicit path; no new collection actions in 11H).
- **Out of scope for 11H** (deferred to 11I+): RPC Statistics tab, mock rule visual builder, load-test profile persistence, schema diff acknowledgement workflow, dedicated “Run load test from collection” UI actions, workflow node types for load-test/schema-diff, mock server clipboard export.

Export contract (`src/shared/grpc/grpcAdvancedFeatureExport.ts`):

```ts
interface GrpcAdvancedFeatureSourceMetadata {
  schemaVersion: 1;
  exportedFrom: 'grpc_studio_advanced';
  tabId: string;
  service: string;
  method: string;
  callType: 'unary';
  descriptorKey: string;
  transportMode?: GrpcStudioTransportMode;
  targetTemplate: string; // address template only — no TLS PEM / auth
  connectionId?: string;
  capturedAt?: string;
}

// prepareGrpcLoadTestRunSummaryExportSafe(summary, sourceMetadata)
//   → sanitizes attempts[], stamps sourceMetadata, leak-scans grpc_load_test_export

// prepareGrpcSchemaDiffReportExportSafe(report, { baselineCapturedAt })
//   → sanitizes change descriptions, stamps exportMeta, leak-scans grpc_schema_diff_export
```

Cross-surface integration contract:
- **Collections replay** → `openSavedRequestInStudio` lands on `studio` sub-nav; user switches to `advanced`; load test uses `prepareExecuteSnapshot` (Phase 9H interpolation) — export must remain secret-safe.
- **History replay** → same path via `replayHistoryEntry`.
- **Workflow/harness** → advanced results are not promoted in 11H; existing Phase 4H/8H export paths unchanged.
- Tab isolation from 11G must hold: replay on tab A does not mutate tab B advanced state.

Deliverables:
- `src/shared/grpc/grpcAdvancedFeatureExport.ts` — safe prepare helpers + source metadata builder + safe serializers.
- `src/shared/grpc/grpcAdvancedFeatureExport.test.ts` — leak corpus + metadata stamping tests.
- `src/shared/grpc/grpcPhase11hAcceptance.test.ts` — checklist traceability + source-scan wiring.
- `src/shared/grpc/grpcSecretPolicy.ts` — `grpc_load_test_export`, `grpc_schema_diff_export` forbidden targets.
- `src/features/grpc/grpcStudioAdvancedTypes.ts` — `lastExportSource` on tab load-test state.
- `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts` — capture source metadata at load-test start; route exports through safe prepare.
- `docs/plan/future/grpc/grpc-cross-feature-matrix.md` — Phase 11H matrix rows.
- `scripts/test-grpc-phase11h.sh` — gate script (`npm run test:grpc:phase11h`).

Verification gates:
- Secret-leak regression: load-test export with `Bearer <token>` in `errorMessage` → redacted in safe export.
- Source metadata present on load-test JSON export; schema-diff export includes `exportMeta`.
- Hook wiring: `exportLoadTestJson` / `exportLoadTestCsv` / `exportSchemaDiffJson` / `exportSchemaDiffMarkdown` use safe prepare (source-scan).
- Cross-surface: unit test proves `buildGrpcAdvancedFeatureSourceMetadata` excludes auth/metadata/body from export surface.
- Gate run must pass: TypeScript, Phase 11H acceptance tests, and Phase 11G regression.

Exit criteria:
- Advanced-feature exports pass leak scan across all export types.
- Cross-feature matrix documents replay → advanced integration path.
- `test:grpc:phase11h` passes and Phase 11G remains green.

#### Phase 11I — Hardening gate before Phase 12

Status:
- ✅ Complete (2026-07-01)

Scope:
- Final reliability/security/performance pass for all Phase 11 modules.
- Confirm acceptance checklist traceability and release readiness for Demo lessons.
- Consolidate Phase 11 entry criteria into one deterministic merge gate (`test:grpc:phase11i`).
- Publish operational docs for advanced-feature triage (load test, mock runtime, schema diff, export safety).

Deliverables:
- `src/shared/grpc/grpcPhase11iAcceptance.test.ts` — hardening acceptance checklist + source-scan traceability.
- `docs/guides/grpc-phase11-validation-report.md` — Phase 11 sign-off report (coverage + known limits + residual risks).
- `docs/guides/grpc-phase11-runbook.md` — troubleshooting and operational runbook for advanced features.
- `scripts/test-grpc-phase11i.sh` — gate script (`npm run test:grpc:phase11i`) with 11H regression.
- `package.json` — `test:grpc:phase11i` script entry.

Verification gates:
- No open P0/P1 defects in feature isolation, correctness, or export safety.
- `npx tsc -b --noEmit` = 0 errors.
- `npx vitest run src/shared/grpc/grpcPhase11iAcceptance.test.ts` = green.
- `npx vitest run src/shared/grpc/grpcLoadTestMetrics.test.ts` = green (CSV contract includes Phase 11H source-metadata columns).
- `npm run test:grpc:phase11h` regression chain (11H → 11G → 11F → 11E → 11D → 11C) = green.
- Gate run must pass: `npm run test:grpc:phase11i`.

Execution lanes (to keep local iteration fast):
- Fast local lane: `npm run test:grpc:phase11i:fast` (keeps TypeScript + 11I acceptance + 11C metrics contract, skips chained regressions).
- Standard pre-push lane: `npm run test:grpc:phase11i`.
- Merge/release lane: `npm run test:grpc:phase11i:full` (forces fresh TypeScript and full chained regressions).

Exit criteria:
- Phase 11 is signed off and stable for Phase 12 lesson integration.
- Runbook + validation report are published and referenced by the hardening gate.

### Phase 11 execution order and dependency chain

`11A -> 11B -> 11C -> 11D -> 11E -> 11F -> 11G -> 11H -> 11I`

Notes:
- `11B` and `11D` can overlap after contracts in `11A` are fixed.
- `11C` depends on scheduler outputs from `11B`; `11E` depends on evaluator outputs from `11D`.
- `11F` can run in parallel with load/mock paths once descriptor source contracts are stable.
- `11I` is a strict gate before Phase 12 starts.

### Phase 11 acceptance checklist

- Phase 11A rejects non-unary call types with clear validation feedback.
- Load-test exports contain full run config + reproducible metrics summary.
- Mock rule precedence is deterministic and stable across reloads.
- In-flight mocked calls are not disrupted by live rule edits.
- Schema diff correctly classifies representative breaking/non-breaking samples.
- Diff JSON/Markdown exports are generated and consumable by CI/PR workflows.

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** Guided interactive lessons for gRPC Studio in the Demo Hub, enabling onboarding and training.

### Proposed lesson roster (15)

| GRPC | id | Title | Key Concept | Requires |
|-----|-----|-------|-------------|----------|
| 1 | `grpc-first-call` | Your First gRPC Call | Unary RPC, service explorer | Phase 1 |
| 2 | `grpc-server-reflection` | Service Discovery with Reflection | Reflection API | Phases 1, 3 |
| 3 | `grpc-proto-import` | Importing Proto Files | Proto management | Phase 3 |
| 4 | `grpc-metadata` | Request Metadata & Headers | Metadata key-value | Phase 1 |
| 5 | `grpc-tls` | TLS & Secure Connections | TLS config panel | Phase 4 |
| 6 | `grpc-server-streaming` | Server Streaming RPC | Message log | Phase 2 |
| 7 | `grpc-client-streaming` | Client Streaming RPC | EOF / send multiple | Phase 2 |
| 8 | `grpc-bidi-streaming` | Bidirectional Streaming | Full duplex | Phase 2 |
| 9 | `grpc-collections` | Saving & Organizing Requests | Collections tree | Phase 5 |
| 10 | `grpc-env-variables` | Environments & Variables | `{{grpcHost}}` | Phase 9 |
| 11 | `grpc-workflow-integration` | gRPC in Workflows | Workflow node | Phase 6 |
| 12 | `grpc-load-testing` | Load Testing with gRPC Studio | ghz-style metrics | Phases 11B, 11C |
| 13 | `grpc-mock-server` | Mocking gRPC APIs | Rule-based mock responses | Phases 11D, 11E |
| 14 | `grpc-schema-diff` | Proto Schema Diff in CI | Breaking-change detection | Phase 11F |
| 15 | `grpc-spring-boot` | Spring Boot 4.1 + Spring gRPC | Netty vs Servlet transport behavior | Phases 1, 4, 10 |

Lesson format follows the same pattern as `graphql-lessons.ts` and `ws-lessons.ts` in `packages/demo-hub/src/lessons/protocols/`.

### Lesson runtime contract (Phase 12)

- Each lesson runs from a deterministic scenario snapshot (target, descriptor source, selected method, request payload, expected outcome).
- Steps are active-tab scoped; running or resetting lesson progress in one tab must not mutate other tabs.
- Lessons that depend on unfinished phases must be marked `locked` with a clear dependency message.
- Secret-bearing fields (tokens, api keys, passwords) must be redacted from lesson telemetry and exported progress artifacts.
- Lesson IDs are immutable once published to avoid progress migration breakage.

### Demo environment and fallback rules

- Demo Hub checks availability of required backend fixtures (Go server, Spring server, proxy) before allowing lesson execution.
- If fixture health checks fail, show actionable remediation hints instead of generic connection errors.
- Browser mode lessons that need unsupported transports/call types must either route via supported proxy path or remain locked.

### Lesson progress, telemetry, and fixture-safety contract

- Lesson progress state is isolated by lesson ID and workspace context; progress in one lesson must never mutate another lesson.
- Lesson runtime snapshots are immutable per run and include fixture version/fingerprint for reproducibility.
- Telemetry and exported lesson artifacts must redact all secret-bearing inputs and resolved variables.
- Lesson completion checks are deterministic and based on explicit step assertions, not timing heuristics.
- Fixture fallback behavior is explicit: when prerequisites are unavailable, lesson remains locked or degraded with clear remediation steps.

### Detailed sub-phase plan

#### Phase 12A — Lesson contract model and authoring schema freeze ✅

> **Status:** ✅ **Shipped** — canonical roster, validators, versioning policy, GRPC-1 contract alignment.
> **Pilot note:** GRPC-1 (`grpc-first-call`) was implemented ahead of 12A; 12A formalizes the contract all future lessons must follow.

Scope:
- Finalize lesson schema, step types, checkpoints, and completion criteria model.
- Define versioning strategy for lesson content updates.

Deliverables:
- `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/` — frozen types, roster, validator, versioning.
- `GRPC_LESSON_SCHEMA_VERSION` (currently `1`) — bump only with a migration in `versioning.ts`.
- Canonical roster for all **15** lessons (`roster.ts`) — metadata + fixture matrix even before step content ships.
- `validateGrpcDemoLesson`, `validateGrpcLessonRoster`, `validateGrpcLessonRegistry` — CI-friendly contract checks.
- `GrpcDemoLesson` type — `DemoLesson` + `grpc` metadata block (schema version, roster number, phase deps, fixtures).
- `buildGrpcContractMetaFromRoster()` — DRY `grpc` metadata block for shipped wrappers.
- `packages/demo-hub/src/adapters/grpcStudioAdapter.ts` — shared targets, health probes, setup commands.
- Step id convention — `grpc{N}-{slug}` matching roster number (e.g. `grpc1-target`).
- Selector lint — step `highlight` / `verify` must use `GRPC.*` constants from `src/shared/selectors/grpc.ts`.

Authoring rules (frozen):
| Rule | Requirement |
|---|---|
| Lesson `id` | Immutable kebab-case `grpc-*` once published |
| Roster | Every shipped wrapper must have a matching `GRPC_LESSON_ROSTER` row with `implementationStatus: 'shipped'` |
| Shipped wrappers | Must define `setup` + `cleanup`; spread `buildGrpcLessonShellFromRoster()` + `buildGrpcContractMetaFromRoster()` for roster fields |
| Steps | Unique ids; final step must define `verify` for E2E smoke |
| Docker lessons | `tag` 🐳 requires `dockerEndpoint` or `dockerEndpoints` + `dockerCommand` |
| Browser studio lessons | `requireExpressProxy` fixtures must probe `:3001/health` and document `npm run server` |
| Go echo lessons | `requireGoEcho` fixtures must probe `:50052/health` (Docker) |
| Selectors | No inline `data-testid` strings in `highlight`/`verify` — add to `GRPC` namespace first |
| Progress | `migrateGrpcLessonProgress()` resets on unknown future schema; identity migration at v1 |

Verification gates:
- `npm run test:grpc:phase12a`
- Roster validates all 15 entries; registry validates shipped lessons (currently GRPC-1 only).
- Import audit (`adaptersImportAudit.test.ts`) — lessons must not import `features/grpc/**` directly.
- `assertGrpcLessonMigrationsComplete()` — every schema version ≤ `GRPC_LESSON_SCHEMA_VERSION` has a migration fn.

Exit criteria:
- ✅ Lesson content contracts are stable and migration-safe.
- ✅ All 15 roster rows validate; shipped lessons pass full contract checks.

**Not in 12A scope (deferred):** runtime runner (12B), progress persistence (12C), fixture gating UI (12D), lock badges (12F), full lesson wrappers for GRPC-2…15 (12H).

#### Phase 12B — Lesson runtime engine integration

> **Status:** ✅ **Shipped** — runtime state machine, scenario snapshots, Demo Hub wiring.

Scope:
- Implement lesson runner integration for deterministic step progression.
- Bind lesson runs to immutable scenario snapshots (target, descriptor source, method, payload).
- Wire gRPC lessons into Demo Hub live-mode lifecycle (setup, step advance, pause, restart, teardown).

Deliverables:
- `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/` — state machine, snapshots, step checkpoints, in-memory run session.
- `GrpcLessonScenarioSnapshot` — frozen per-run scenario with stable `fingerprint` for reproducibility.
- `GrpcLessonRuntimeStatus` — `idle | running | paused | completed | failed | locked` (locked reserved for 12F dependency gating).
- `transitionGrpcLessonRun()` — pure state transitions + `assertGrpcLessonRunTransition()` gate helper.
- `buildGrpcScenarioSnapshotForLesson(lessonId)` — snapshot factory registry (GRPC-1 shipped).
- `getGrpcStepCheckpoint(lessonId, stepId)` — maps step ids to runtime flags + verify selector.
- `packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.ts` — `isGrpcStudioLesson`, setup/teardown bridges for `useDemoHub`; step sync after successful step completion (verify pass required when step defines `verify`).
- Demo Hub integration in `useDemoHub.ts` — begin/pause/resume/reset/end run on live-demo lifecycle (`useDemoHubHelpers.ts` remains GraphQL-only).
- `grpc-lesson-helpers.ts` — session flags driven by runtime run state (not ad-hoc module globals).

Authoring rules (runtime):
| Rule | Requirement |
|---|---|
| Snapshot | Built once at run start; never mutated mid-run — restart creates a new `runId` |
| Step checkpoints | Each shipped lesson registers step → flag mapping in `stepCheckpoints.ts` |
| Flags | `targetSet`, `reflected`, `methodSelected`, `messageFilled`, `executed` — extended per lesson in 12H |
| Teardown | Always `endGrpcLessonRun()` + lesson `cleanup()` on exit/restart/hub close |
| Restart window | `clearGrpcStudioLessonRun()` synchronously before async cleanup/setup so stale runs cannot accept step sync |
| Terminal status | `completed` / `failed` / `locked` runs reject further flag mutations and step advances |
| Tab guard | Lessons must declare `allowedTabs` (from roster shell) so history/collections steps do not auto-exit |

**Not in 12B scope (deferred):** durable progress persistence (12C), fixture readiness UI (12D), lock badge UX (12F), GRPC-2…15 content (12H).

Verification gates:
- `npm run test:grpc:phase12b`
- Determinism tests — identical `lessonId` → identical snapshot fingerprint across runs.
- State transition tests — all valid/invalid transitions for `idle/running/paused/completed/failed/locked`.
- Resume/restart tests — pause preserves flags; restart resets flags and issues new `runId`.
- Regression: `npm run test:grpc:phase12a` still passes.

Exit criteria:
- Lesson execution flow is deterministic and recoverable within a live session.
- Demo Hub begins/ends gRPC runs on start/exit/restart without leaking session state.

#### Phase 12C — Progress persistence and isolation boundaries

Scope:
- Implement per-lesson progress persistence with workspace scoping.
- Ensure tab and lesson isolation for progress updates.

Deliverables:
- Progress storage model with lesson/workspace keys.
- Isolation guards preventing cross-lesson progress bleed.

Verification gates:
- Tests for concurrent lesson progress updates.
- Persistence tests across reload/session restore.

Exit criteria:
- Progress is stable, isolated, and resilient to reloads.

#### Phase 12D — Fixture discovery, health checks, and readiness gating

Scope:
- Implement fixture availability checks for Go server, Spring server, and required proxy paths.
- Gate lesson start by prerequisite health status.

Deliverables:
- Fixture health-check service and readiness summary UI.
- Mapping from lesson prerequisites to fixture capabilities.

Verification gates:
- Integration tests for healthy/unhealthy fixture states.
- Tests for locked/degraded lesson behavior on missing prerequisites.

Exit criteria:
- Lessons never run against unknown or invalid fixture conditions.

#### Phase 12E — Lesson UX flows and remediation guidance

Scope:
- Build guided step UI, callouts, validation hints, and remediation prompts.
- Ensure user can recover from expected mistakes without losing progress.

Deliverables:
- Lesson shell interactions (next/back/retry/reset/help).
- Contextual remediation copy for common failure categories.

Verification gates:
- UI tests for step navigation and retry/reset flows.
- Accessibility tests for callouts, focus order, and keyboard-only navigation.

Exit criteria:
- Lessons are clear, recoverable, and accessible.

#### Phase 12F — Locking/unlocking and dependency enforcement

Scope:
- Enforce phase dependency rules for lesson availability.
- Surface clear dependency reasons for locked lessons.

Deliverables:
- Dependency evaluator for lesson `Requires` metadata.
- Lock-state UI badges and explanatory messaging.

Verification gates:
- Tests for each lesson lock/unlock condition.
- Regression tests ensuring no premature unlocks.

Exit criteria:
- Lesson availability consistently matches prerequisite readiness.

#### Phase 12G — Telemetry, export, and redaction pipeline

Scope:
- Implement lesson telemetry/events and export reports with redaction.
- Ensure secret-safe diagnostics and reproducibility metadata.

Deliverables:
- Lesson analytics event schema + export serializer.
- Redaction layer for tokens, auth headers, and secret variables.

Verification gates:
- Secret leak tests for telemetry/export payloads.
- Contract tests for event schema consistency.

Exit criteria:
- Lesson observability is useful and safe by default.

#### Phase 12H — Lesson content validation and regression suite

Scope:
- Validate all lesson scripts against current product behavior and fixtures.
- Prevent drift between lesson instructions and actual UI/actions.

Deliverables:
- Automated lesson validation suite (script checks + smoke runs).
- Content linting rules for step assertions and IDs.

Verification gates:
- Full suite pass across all 15 lessons.
- Drift detection tests for renamed selectors/actions.

Exit criteria:
- Lesson content remains accurate and executable over time.

#### Phase 12I — Hardening gate before Phase 13

Scope:
- Final reliability pass for lesson engine, fixtures, and exports.
- Confirm acceptance checklist coverage and readiness for GA hardening phase.

Deliverables:
- Phase 12 validation report (completion determinism, lock logic, fixture readiness, telemetry safety).
- Operational runbook for lesson troubleshooting.

Verification gates:
- No open P0/P1 defects in lesson execution, isolation, or redaction.
- CI green for lesson runtime and content regression suites.

Exit criteria:
- Phase 12 is signed off and ready for Phase 13 production hardening.

### Phase 12 execution order and dependency chain

`12A -> 12B -> 12C -> 12D -> 12E -> 12F -> 12G -> 12H -> 12I`

Notes:
- `12C` and `12D` can overlap after runtime contracts from `12A/12B` are fixed.
- `12E` should begin once basic runtime and fixture gating are available (`12B/12D`).
- `12H` depends on stable lesson content contracts (`12A`) and UX/action surfaces (`12E/12F`).
- `12I` is a strict gate before Phase 13 starts.

### Phase 12 acceptance checklist

- ✅ (12A) Canonical 15-lesson roster validates; shipped lesson wrappers pass contract checks (`npm run test:grpc:phase12a`).
- ✅ (12B) gRPC lesson runtime snapshots are deterministic; live session pause/resume/restart preserves or resets state correctly (`npm run test:grpc:phase12b`).
- Lesson roster and numbering are internally consistent (including Spring Boot lesson).
- Locked lessons correctly reflect unmet phase prerequisites.
- Per-tab lesson progress is isolated and survives workspace reload.
- Lesson completion criteria are deterministic and reproducible against provided fixtures.
- Redaction policy for secrets is enforced in lesson logs/exports.
- Demo fixtures for Go and Spring servers are documented and health-checkable from the UI.

---

## Phase 13 — Production Hardening & GA Readiness

> **Goal:** Ensure gRPC Studio is production-safe with clear SLOs, accessibility, reliability, and operational release gates before GA.

### Scope

- Performance budgets: descriptor load latency, unary p95 UI response time, and stream rendering throughput budgets.
- Reliability drills: proxy restarts, server disconnects, half-open stream cleanup, and retry/cancel correctness.
- Accessibility: keyboard navigation, focus order, screen-reader labels, color-contrast checks for all gRPC panels.
- Observability and diagnostics: structured logs, error categories, and anonymized usage metrics for key flows.
- Release gating: CI checks for core smoke tests, protocol regressions, and lesson integrity checks.

### GA hardening and release-governance contract

- GA decisions are evidence-based: each hardening area must publish measurable pass/fail artifacts (not narrative-only sign-off).
- SLO and reliability gates use fixed datasets/fixtures and stable measurement windows to avoid non-deterministic pass rates.
- Accessibility and redaction are release blockers, not optional post-GA improvements.
- Production diagnostics must preserve privacy: no secret-bearing request content in logs, telemetry, or exported artifacts.
- Rollback and kill-switch behavior is documented for every high-risk path (stream loops, proxy bridges, lesson runtime hooks).

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 13A — SLO definitions, budgets, and measurement harness

Scope:
- Freeze performance SLO targets, budget thresholds, and measurement methodology.
- Define benchmark datasets and representative workloads for unary and streaming paths.

Deliverables:
- SLO specification document (p50/p95/p99 targets, error budgets, saturation thresholds).
- Reproducible measurement harness contract (fixtures, run window, machine profile assumptions).

Verification gates:
- Review pass for metric definitions and calculation formulas.
- Dry-run benchmark validations proving repeatability within tolerance bands.

Exit criteria:
- SLO budgets are unambiguous, reproducible, and automation-ready.

#### Phase 13B — Performance instrumentation and baseline capture

Scope:
- Add instrumentation for descriptor load, call execution, stream render throughput, and memory footprint.
- Capture baseline measurements across core gRPC workflows.

Deliverables:
- Performance telemetry hooks and baseline report per key flow.
- Regression threshold policy for CI performance checks.

Verification gates:
- Metric completeness tests (all required dimensions emitted).
- Baseline sanity checks across multiple runs and fixtures.

Exit criteria:
- Baselines exist and can detect meaningful regressions.

#### Phase 13C — Reliability failure-mode matrix and drills

Scope:
- Build fault matrix covering disconnects, proxy resets, partial failures, and cancellation races.
- Define expected recovery behavior and user-facing states.

Deliverables:
- Failure-mode catalog with expected transitions and timeout/cancel semantics.
- Drill scripts for deterministic failure injection.

Verification gates:
- Drill tests for orphan-stream prevention and stale-state cleanup.
- Assertions for retry/cancel correctness under concurrent operations.

Exit criteria:
- Reliability behavior is deterministic under documented fault conditions.

#### Phase 13D — Recovery and graceful-degradation controls

Scope:
- Specify recovery strategies for each failure class.
- Define degraded-mode UX and fallback indicators.

Deliverables:
- Recovery policy (backoff, reconnect, reset boundaries, user prompts).
- Graceful-degradation contract for unavailable transports/features.

Verification gates:
- Integration tests for degraded mode transitions and recovery exits.
- UX tests for actionable recovery messaging.

Exit criteria:
- Users can recover from expected failures without ambiguous state.

#### Phase 13E — Accessibility hardening and conformance

Scope:
- Validate keyboard-only navigation, focus management, semantic labeling, and contrast across gRPC surfaces.
- Enforce accessibility parity for advanced features and lesson flows.

Deliverables:
- Accessibility checklist mapped to critical journeys.
- Remediation backlog with severity classification and ownership.

Verification gates:
- Automated accessibility scans on primary pages/panels.
- Manual assistive-tech walkthroughs for high-risk interactions.

Exit criteria:
- No open critical accessibility blockers for GA journeys.

#### Phase 13F — Observability, diagnostics taxonomy, and redaction audit

Scope:
- Standardize diagnostics taxonomy across client/server/runtime surfaces.
- Audit telemetry/log/export streams for secret leakage.

Deliverables:
- Unified error/diagnostic schema and correlation policy.
- Redaction compliance report spanning logs, traces, and exports.

Verification gates:
- Contract tests for diagnostic category consistency.
- Secret-leak regression suite over representative payloads.

Exit criteria:
- Observability is actionable and privacy-safe.

#### Phase 13G — Release gating pipeline and policy automation

Scope:
- Encode hard release gates in CI for performance, reliability, accessibility, and lessons.
- Define gate ownership and escalation policy.

Deliverables:
- CI gate matrix with blocking/non-blocking tiers.
- Release checklist automation for pre-GA verification.

Verification gates:
- End-to-end CI dry runs validating gate behavior on pass/fail cases.
- Policy tests proving blockers fail release as expected.

Exit criteria:
- Release process is enforceable and auditable.

#### Phase 13H — Operational readiness, runbooks, and rollback drills

Scope:
- Prepare operational runbooks for incident triage and recovery.
- Validate rollback/kill-switch procedures for high-risk regressions.

Deliverables:
- On-call runbooks for common incident classes.
- Rollback and kill-switch playbook with decision thresholds.

Verification gates:
- Tabletop exercises for incident response flows.
- Rollback drill verification for minimal recovery time.

Exit criteria:
- Operational teams can respond and recover predictably.

#### Phase 13I — Final GA sign-off and post-GA guardrails

Scope:
- Aggregate evidence from all hardening tracks and perform final sign-off review.
- Define post-GA monitoring guardrails and stabilization window policy.

Deliverables:
- GA evidence pack (SLO, reliability, accessibility, observability, release gates).
- Post-GA watch plan (alerts, ownership, rollback triggers).

Verification gates:
- No open P0/P1 blockers in any hardening category.
- Executive/engineering sign-off checklist fully satisfied.

Exit criteria:
- Phase 13 is fully complete and GA-ready with enforceable post-release safeguards.

### Phase 13 execution order and dependency chain

`13A -> 13B -> 13C -> 13D -> 13E -> 13F -> 13G -> 13H -> 13I`

Notes:
- `13C` and `13E` can proceed in parallel once instrumentation/baselines from `13B` are available.
- `13F` should run continuously but is finalized before release gating in `13G`.
- `13H` starts after release policy is stable (`13G`) to ensure runbooks mirror actual gate behavior.
- `13I` is the strict final gate before GA release approval.

### Phase 13 acceptance checklist

- SLO budgets are documented and validated by automated checks.
- Failure-mode drills pass without orphaned streams or stale UI state.
- Accessibility audits pass for critical user journeys (connect, call, stream, save, lesson run).
- Error telemetry is categorized and redaction-safe.
- GA release checklist is codified and repeatable in CI.

---


## Phase Dependency Map

```
Phase 1 (Core Unary) ──────────────────────────────────┐
   ├─► Phase 2 (Streaming)                              │
   │       └─► Phase 6 (Workflow) ─► Phase 8 (Harness) │
   ├─► Phase 3 (Proto) ─► Phase 10 (gRPC-Web) ✅       │
   │       └─► Phase 11F (Schema Diff)                  │
   ├─► Phase 4 (TLS/Auth) ─► Phase 4J (UI parity) ✅    │
   │       └─► Phase 5 (Collections) ✅                 │
   ├─► Phase 7 (Tauri tonic) ✅ [parallel 1/2]         │
   ├─► Phase 9 (Env vars) ✅                            │
   └─► Phase 11 (Advanced) ✅                            │
                                                        │
Phase 12 (Demo Lessons) ◄── 🔴 NEXT (after Phases 1–11) │
Phase 13 (GA Hardening) ◄── after Phase 12              │
```

MVP = **Phases 1–5 + 9** (core + collections + env vars). MVP **UI** requires **4J-E** gate.

---

## File Map

> Authoritative layout lives in the codebase. Key entry points:

| Area | Path |
|---|---|
| Studio page | `src/features/grpc/GrpcStudioPage.tsx` |
| Connection bar / TLS / settings | `GrpcConnectionBar.tsx`, `GrpcTlsConfigModal.tsx`, `GrpcConnectionSettingsDrawer.tsx` |
| Server routes | `src-server/routes/grpc/grpc-routes.ts` |
| gRPC client / streams | `src-server/grpc/grpcClient.ts`, `grpc-stream-service.ts`, `streamRegistry.ts` |
| Shared contracts | `src/shared/grpc/contracts.ts` |
| Tauri native | `src-tauri/src/grpc/` |
| Selectors | `src/shared/selectors/grpc.ts` |
| E2E specs | `e2e/grpc-studio-*.spec.ts`, `e2e/demo-grpc-first-call.spec.ts` |
| Demo lessons | `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/` |
| gRPC lesson runtime | `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/` |
| gRPC lesson adapter | `packages/demo-hub/src/adapters/grpcStudioAdapter.ts` |
| gRPC runtime adapter | `packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.ts` |
| gRPC lesson registry | `packages/demo-hub/src/lessons/protocols/grpc-lessons.ts` |
| Docker fixture | `docker/grpc/` |

---

## Type Definitions

Canonical types live in **`src/shared/grpc/contracts.ts`** — do not duplicate here. Phase 11 planning shapes (`GrpcLoadTestResult`, `GrpcSchemaDiffReport`, etc.) are defined in § Phase 11 below.

---

## Open Questions / Risks

| # | Question | Status | Resolution |
|---|---|---|---|
| OQ-1 | Dynamic invocation without generated stubs in Node | ✅ Resolved | `protobufjs` + `@grpc/grpc-js` raw framing |
| OQ-2 | Reflection v1 vs v1alpha | ✅ Resolved | Try v1, fall back to v1alpha |
| OQ-3 | Large proto import graphs | ✅ Resolved | `protoFileDescriptorPool` caches bundled WKT + ingest fingerprint |
| OQ-4 | `prost-reflect` binary size (~2MB) | ✅ Accepted | Bundle WKT protos as bytes |
| OQ-5 | Browser plain HTTP/2 gRPC | ✅ Resolved | Express proxy; gRPC-Web/Servlet for browser-native |
| OQ-6 | Stream connection lifecycle | ✅ Resolved | Phase 2 `streamRegistry` + SSE relay |
| OQ-7 | `google.protobuf.Any` in form builder | ✅ Resolved | Raw JSON editor + `@type` hint (picker deferred) |
| OQ-8 | int64 JSON precision | ✅ Resolved | 64-bit fields as JSON strings; JSON tab rejects numeric literals; encode normalizes strings → Long |

---
## Docker Test Server

> **Phase 1 shipped:** unary `Echo` only (`docker/grpc/proto/echo.proto` as of Phase 1H).
> **Phase 2H expands** to all four call types — full proto sketch below.

The E2E test suite requires a real gRPC server with:
- **Server Reflection** enabled (both v1 and v1alpha)
- **Unary**, **server streaming**, **client streaming**, **bidirectional** methods
- **TLS** and **mTLS** variants
- Known proto schema for deterministic assertions

Proposed: Go gRPC server in `docker/grpc/` exposing:
```
service EchoService {
  rpc Echo (EchoRequest) returns (EchoResponse);                  // unary
  rpc ServerStream (EchoRequest) returns (stream EchoResponse);   // server streaming
  rpc ClientStream (stream EchoRequest) returns (EchoResponse);   // client streaming
  rpc BidiStream (stream EchoRequest) returns (stream EchoResponse); // bidi
}

service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder (GetOrderRequest) returns (GetOrderResponse);
  rpc ListOrders (ListOrdersRequest) returns (stream Order);
}
```

Both services registered with `grpc.reflection.v1.ServerReflection`.

### Spring Boot test server (Phase 12 / Demo)

For the Spring Boot lesson (Phase 12, Lesson 15), add a second Docker service: a **Spring Boot 4.1 + Spring gRPC** server at port **9090** with:
- `spring-grpc-spring-boot-starter` (official, not net.devh)
- Same `EchoService` and `OrderService` proto schema
- Server Reflection v1 enabled (`io.grpc:grpc-services` on classpath)
- Spring Actuator health (`/actuator/health` + gRPC health service with `db` and `diskSpace` indicator names)
- Spring Security: `SayHello` requires `ROLE_USER` Bearer JWT; `Echo` open
- Both Netty mode (port 9090) and Servlet mode (port 8080) containers

```yaml
# docker/grpc/docker-compose.yml
services:
  grpc-go:
    build: ./go-server
    ports: ["50051:50051"]
  grpc-spring-boot:
    build: ./spring-boot-server
    ports:
      - "9090:9090"   # Netty native gRPC
      - "8080:8080"   # Servlet mode (HTTP/1.1 + Spring MVC)
```

This lets Phase 12 demos show the concrete difference between connecting to `:50051` (Go server, standard) vs `:9090` (Spring Boot, quick-connect profile).

---
