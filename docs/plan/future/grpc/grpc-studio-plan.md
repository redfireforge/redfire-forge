# gRPC Studio — Living Plan

> **Branch:** `feature/grpc-phase` (merges to `develop`)  
> **Status:** Phases **1–11O product complete** ✅ · **Proto Files ingest (root-based)** complete ✅ · **Unified Shell UX** (mockups 07–09) not started · **Phase 13** in progress (13A ✅, 13B baseline+CI ✅, 13C matrix expanded ✅, 13D matrix expanded ✅, 13E gate ✅, 13F gate ✅, 13G CI gating ✅, 13H initial gate ✅) · **Phase 12** demo track in progress (**3/14 shipped**)  
> **Last updated:** 2026-07-03 (status refresh — 13H operational runbook + rollback drill gate landed)  
> **Doc policy:** This file is a **short status + forward backlog** only. Shipped sub-phase specs, mockup parity tables, re-evaluation passes, and bug-fix history live in **git history** and **per-phase runbooks** — **do not append audit logs here**.

| Detail lives in | Path |
|---|---|
| Phase runbooks (1–11) | `docs/guides/grpc-phase*-runbook.md` |
| Cross-feature matrix | [`grpc-cross-feature-matrix.md`](grpc-cross-feature-matrix.md) |
| UI mockups + parity | `docs/plan/future/grpc/mockups/` · [`grpc-studio-ui.mdc`](../../../.cursor/rules/grpc-studio-ui.mdc) |
| Concrete UX concept spec | [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md) |
| Phase 1/2 mockup gap tables | [`grpc-phase1-runbook.md`](../../guides/grpc-phase1-runbook.md) · [`grpc-phase2-runbook.md`](../../guides/grpc-phase2-runbook.md) |
| Phase 11 validation report | [`grpc-phase11-validation-report.md`](../../guides/grpc-phase11-validation-report.md) |
| Demo lesson authoring | [`.cursor/rules/demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc) |
| Demo lesson plan (detailed) | [`grpc-demo-lessons.md`](grpc-demo-lessons.md) |
| Full pre-slim plan (historical) | `git show 26d6187:docs/plan/future/grpc/grpc-studio-plan.md` |
| Docker fixture | [`docker/grpc/README.md`](../../../../docker/grpc/README.md) |

---

## What this document is

A **single index** for gRPC Studio **product engineering** — what shipped, where code lives, what is deferred, and what remains (Phase 12 lessons, Phase 13 GA).

**Intentionally omitted** (token cost, no future value):

- Per-phase deliverable specs for **shipped** Phases 1–11O → runbooks + git history
- Phase 1–4 mockup gap tables (all ✅ closed) → runbooks + mockups
- Phase 11A–11O implementation slices, contracts, and verification prose
- Bug-fix history, “plan correction” notes, and re-evaluation audit logs
- Duplicate type definitions → `src/shared/grpc/contracts.ts`

---

## Overview

**gRPC Studio** is an interactive debug tool for calling gRPC services — analogous to GraphQL Studio and WebSocket Studio.

| HTTP | WebSocket | gRPC |
|---|---|---|
| Requests page | Send Panel + Message Log | Service Explorer + Call Panel |
| Environments | Connection Profiles | `{{grpcHost}}` per environment |
| Response Body | Message Log | Response Stream + Trailers |
| Catalog | Saved Connections | gRPC Collections |

**Navigation:** Protocols sub-nav → `Kafka | WebSocket | GraphQL | SSE | gRPC`

---

## Design decisions (frozen)

1. **Descriptor source priority:** Reflection → Proto Files → Protoset → BSR → URL. Never silently switch on transient reflection failure.
2. **Form-first input** with JSON tab sync.
3. **Transport:** Web = Express `@grpc/grpc-js` + SSE streams; Desktop = Rust `tonic` (Phase 7); gRPC-Web / Spring Servlet (Phase 10).
4. **Streaming first-class** — live message log, directional attribution.
5. **Metadata** — shared `KeyValueEditor`; reserved keys labeled.
6. **Collections** — local IDB; proto hierarchy tree.
7. **`{{grpcHost}}`** — reserved env token (`host:port`, no scheme).
8. **Connect/Disconnect** — probe-based status dot; no persistent long-lived channel (by design).

---

## Phase status dashboard

| Phase | Delivers | Status | Gate / runbook |
|---|---|---|---|
| **1** — Core Unary | Explorer, unary call, form, response | ✅ | [`grpc-phase1-runbook.md`](../../guides/grpc-phase1-runbook.md) |
| **2** — Streaming | All four call types, message log | ✅ | [`grpc-phase2-runbook.md`](../../guides/grpc-phase2-runbook.md) |
| **3** — Proto | Upload, reflection, schema browser | ✅ | [`grpc-phase3-runbook.md`](../../guides/grpc-phase3-runbook.md) |
| **4** — TLS & Auth | TLS/mTLS, OAuth2, secret vault | ✅ | [`grpc-phase4-runbook.md`](../../guides/grpc-phase4-runbook.md) |
| **4J** — UI parity | Connection bar, TLS modal, settings drawer | ✅ | `npm run test:grpc:phase4j` |
| **5** — Collections | Save/replay, grpcurl import/export | ✅ | [`grpc-phase5-runbook.md`](../../guides/grpc-phase5-runbook.md) |
| **6** — Workflow | gRPC workflow nodes + namespace | ✅ | [`grpc-phase6-runbook.md`](../../guides/grpc-phase6-runbook.md) |
| **7** — Tauri Native | Rust `tonic`, channel pool | ✅ | [`grpc-phase7-runbook.md`](../../guides/grpc-phase7-runbook.md) |
| **8** — Test Runner | Harness scenarios, assertions | ✅ | [`grpc-phase8-runbook.md`](../../guides/grpc-phase8-runbook.md) |
| **9** — Env vars | `{{grpcHost}}`, deep resolver | ✅ | [`grpc-phase9-runbook.md`](../../guides/grpc-phase9-runbook.md) |
| **10** — gRPC-Web | grpc-web + Spring Servlet | ✅ | [`grpc-phase10-runbook.md`](../../guides/grpc-phase10-runbook.md) |
| **11A–11I** — Advanced core | Load test, mock, schema diff panels | ✅ | [`grpc-phase11-runbook.md`](../../guides/grpc-phase11-runbook.md) · `npm run test:grpc:phase11i` |
| **11J–11O** — Extensions | Profiles, RPC stats, mock listener, cross-surface, stream load | ✅ | `test:grpc:phase11j` … `test:grpc:phase11o` |
| **1–11O** — Product sign-off | Studio + advanced closure | ✅ | § [Deferrals](#deferred--not-implemented-product) below |
| **Proto Files ingest** | Root-based ingest cleanup | ✅ | § [Universal Proto Files Ingest (Per Virtual Root)](#universal-proto-files-ingest-per-virtual-root) |
| **UX-1–UX-7** — Unified shell | Mockups 07–09 → production UI | 🔲 Not started | [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md) |
| **12** — Demo Lessons | 14 lessons, 4 tracks (**3/14 shipped**) | 🔨 **12C** in progress | `npm run test:grpc:phase12a` · [`grpc-demo-lessons.md`](grpc-demo-lessons.md) |
| **13** — GA Hardening | SLOs, a11y, release gates | 🔨 13A/13B/13E/13F/13G complete, 13C/13D expanded, 13H initial gate landed | `grpc:phase13a:baseline` / `grpc:phase13b:ci` / `grpc:phase13c:gate` / `grpc:phase13d:gate` / `grpc:phase13e:gate` / `grpc:phase13f:gate` / `grpc:phase13h:gate` |

**MVP** = Phases **1–5 + 9** (+ **4J** for UI parity).

---

## Shipped phases (1–10) — one-line summary

| Phase | Summary |
|---|---|
| **1** | Tab-scoped unary explorer: Express proxy, reflection/proto, form composer, response panel |
| **2** | SSE stream relay, stream registry, message log, all call types |
| **3** | Proto/protoset/BSR/URL ingest, import resolver, schema browser, drift |
| **4** | TLS tri-mode, auth, secret vault, redaction |
| **4J** | UI shell parity: connection bar, TLS modal, auth pills, settings drawer |
| **5** | IDB collections/history, grpcurl import/export |
| **6** | Workflow nodes (`grpcUnary`, streams, assert), output namespace |
| **7** | Tauri `tonic` channel pool, native unary/stream |
| **8** | Harness snapshot builder, field assertions, export redaction |
| **9** | `{{var}}` interpolation, cross-surface parity |
| **10** | gRPC-Web + Spring Servlet transports |

---

## Phase 11 (shipped summary)

> **Sign-off:** Phases **11A–11I** complete (2026-07-01). Extension **11J–11O** complete (2026-07-01). **Do not reopen 11A–11I** without a version bump.

| Sub-phase | Delivers | Gate |
|---|---|---|
| **11A** | Unary load-test contracts + safety caps | `test:grpc:phase11a` |
| **11B** | Load scheduler + metrics | `test:grpc:phase11b` |
| **11C** | Metrics export (JSON/CSV) | `test:grpc:phase11c` |
| **11D** | Mock rule evaluator | `test:grpc:phase11d` |
| **11E** | Mock runtime registry | `test:grpc:phase11e` |
| **11F** | Schema diff engine + export | `test:grpc:phase11f` |
| **11G** | Advanced panels (Load / Mock / Diff) | `test:grpc:phase11g` |
| **11H** | Export redaction hardening | `test:grpc:phase11h` |
| **11I** | Hardening gate (11A–11H sign-off) | `npm run test:grpc:phase11i` |
| **11J** | Load profiles, collection handoff, mock export, diff ack | `test:grpc:phase11j` |
| **11K** | RPC Statistics tab | `test:grpc:phase11k` |
| **11L** | Mock rule visual builder | `test:grpc:phase11l` |
| **11M** | Network mock listener (web Node `@grpc/grpc-js`) | `test:grpc:phase11m` |
| **11N** | Workflow advanced nodes, harness/collections helpers | `test:grpc:phase11n` |
| **Phase 11O** | Studio `server_streaming` load test (Express/native transport) | `test:grpc:phase11o` |

Full contracts, acceptance checklists, and troubleshooting: [`grpc-phase11-runbook.md`](../../guides/grpc-phase11-runbook.md).

---

## Deferred / not implemented (product)

> **Re-evaluated 2026-07-03** against codebase. Excludes **Phase 12 demo lessons** (see § Phase 12).

**Phases 1–11O:** all originally scoped gates are **shipped** (`test:grpc:phase11a` … `test:grpc:phase11o`). Nothing below is a missing P0/P1 from that scope — only intentional deferrals, polish, or GA work.

### Closed since earlier plan revisions (no longer backlog)

| Item | Status | Evidence |
|---|---|---|
| Harness auto-hydrate gRPC connection profiles | ✅ Shipped | `src/engine/grpcConnectionProfileHydration.ts`, `executor.ts` → `runtimeOverrides.profiles` |
| `workspaceDefaults` interpolation layer (Studio / workflow / harness) | ✅ Shipped | `grpcInterpolationPrecedence.ts`, `GrpcStudioPage.tsx`, phase 9 validation report |
| Root-based proto ingest rollout | ✅ Shipped | `GrpcProtoManageModal.tsx`, `protoDescriptorParser.ts`, `grpcDescribeUsageTelemetry.ts` |
| Mock network listener (web companion server) | ✅ Shipped (11M) | `grpcMockNetworkListener.ts`, `grpcMockServerPool.ts`, integration test |
| Advanced workflow node **engines** (`grpcLoadTest`, `grpcSchemaDiff`, `grpcMockAssert`) | ✅ Shipped (11N) | `graphRunnerGrpcAdvancedNodeHandlers.ts` |
| Collections “Run load test” handoff | ✅ Shipped (11J) | `GrpcSavedRequestDetail.tsx`, `openSavedRequestForLoadTest` |
| Collections **Compare schema** / History **Open diff** actions | ✅ Shipped | `GrpcSavedRequestDetail.tsx`, `GrpcHistoryPanel.tsx`, `GrpcStudioPage.tsx` |
| RPC Statistics **Export JSON/CSV** actions | ✅ Shipped | `GrpcRpcStatisticsPanel.tsx` |

### Remaining product backlog (excluding demo lessons)

| Item | Verdict | Owner / notes |
|---|---|---|
| **Phase 13** — GA hardening (SLOs, drills, a11y, CI gates) | **In progress** | 13A/13B/13E/13F/13G complete; 13H initial runbook/gate landed |
| **Unified Shell UX** (mockups 07–09) | **Not started** | [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md) UX-1…UX-7 — design-only today; current UI follows mockups 01–06 |
| Proto Files ingest cleanup — deprecate flat-only ingest | **Completed** | UI/load paths are root-based ingest |
| Schema diff list **virtualization** (>500 rows; cap exists today) | **Deferred** | Phase **13E** — `GRPC_SCHEMA_DIFF_UI_LIST_CAP = 500`; exports stay full payload |
| Workflow Designer **palette + config modals** for all gRPC node types | **Deferred** | Phase **13** — no `*Grpc*NodeConfig*.tsx`; engines + validation exist; workflows use JSON/import |
| Tauri native `tonic` mock network listener | **Deferred** | Desktop uses web companion server; no `src-tauri/src/grpc/mock_server.rs` |
| E2E `grpc-studio-mock-listener.spec.ts` | **Deferred** | Optional; `grpc-studio-mock-unary.spec.ts` / `grpc-studio-mock-streams.spec.ts` exist |
| Go Docker **mock servicer mode** (separate from echo server) | **Deferred** | 11M uses Node listener; `docker/grpc/go-server` is echo fixture only |
| Environment Manager **workspaceDefaults UI** | **Deferred** | Interpolation merge works when caller supplies layer; no dedicated env-manager editor |
| Docker fixtures: TLS variants, Envoy gRPC-Web, Spring Boot | **Deferred** | Phase **12D** scope — benefits lessons + future E2E; not in `docker/grpc/` today |

### By-design limits (not backlog)

| Item | Notes |
|---|---|
| Persistent long-lived gRPC channel | Probe-based Connect/Disconnect is intentional |
| `client_streaming` / `bidi_streaming` load tests | 11O v1 = `server_streaming` Studio-only |
| Browser-direct **load tests** (`grpc-web` / `spring-servlet`) | Regular browser-direct **calls** work; load tests use Express/native proxy |
| Workflow `grpcLoadTest` server-streaming | Studio owns stream load (11O) |

Historical mockup gaps (Phases 1–4) and OQ-1…OQ-10 are **closed** — see runbooks and § Open questions.

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** 14 guided Demo Hub lessons across four learning tracks. Full lesson spec: [`grpc-demo-lessons.md`](grpc-demo-lessons.md).

### Lesson roster (14)

Grouped by learning track. Lessons within a track build on each other; tracks can be started independently after Track 1.

**Track 1 — Foundation**

| # | ID | Title | Prerequisite | Status |
|---|---|---|---|---|
| 1 | `grpc-first-call` | Your First gRPC Call | — | ✅ Shipped |
| 2 | `grpc-schema-discovery` | Schema Discovery: Reflection & Proto Import | L1 | ✅ Shipped |
| 3 | `grpc-streaming` | Streaming RPCs: All Four Patterns | L1 | ✅ Shipped |

**Track 2 — Configuration**

| # | ID | Title | Prerequisite | Status |
|---|---|---|---|---|
| 4 | `grpc-metadata-auth` | Request Metadata & Authentication | L1 | 🔲 Planned |
| 5 | `grpc-tls-mtls` | TLS, mTLS & Certificate Configuration | L1 | 🔲 Planned |
| 6 | `grpc-transport-modes` | Transport Modes: Express, gRPC-Web & Spring Servlet | L1 | 🔲 Planned |
| 7 | `grpc-spring-boot` | Spring Boot & Spring gRPC Integration | L1, L6 | 🔲 Planned |

**Track 3 — Productivity**

| # | ID | Title | Prerequisite | Status |
|---|---|---|---|---|
| 8 | `grpc-proto-form` | Proto Form Builder: Schema-Driven Request Editing | L2 | 🔲 Planned |
| 9 | `grpc-env-collections` | Environments, Collections & History | L1, L4 | 🔲 Planned |
| 10 | `grpc-grpcurl` | grpcurl Interop, Replay & Sharing | L1 | 🔲 Planned |

**Track 4 — Advanced**

| # | ID | Title | Prerequisite | Status |
|---|---|---|---|---|
| 11 | `grpc-load-testing` | Load Testing: Concurrent Calls & Metrics | L1, L9 | 🔲 Planned |
| 12 | `grpc-mock-server` | Mocking gRPC APIs: Rules & Network Listener | L1 | 🔲 Planned |
| 13 | `grpc-schema-diff` | Proto Schema Diff & Breaking Change Detection | L2 | 🔲 Planned |
| 14 | `grpc-workflow` | gRPC in Workflows: Nodes, Assertions & Chaining | L1, L9 | 🔲 Planned |

Registry: `packages/demo-hub/src/lessons/protocols/grpc-lessons.ts` · Contract: `grpc-lesson-contract/` · Full spec: [`grpc-demo-lessons.md`](grpc-demo-lessons.md)

**Roster ID migration:** The contract's `roster.ts` still registers the old 15-lesson IDs (GRPC-1…GRPC-15). Before Phase 12H, migrate to the new 14-lesson IDs. Old IDs 2+3 → `grpc-schema-discovery`, 6+7+8 → `grpc-streaming`, 9+10 → `grpc-env-collections`. Three new IDs: `grpc-transport-modes`, `grpc-proto-form`, `grpc-grpcurl`. See [`grpc-demo-lessons.md`](grpc-demo-lessons.md) § Roster ID Migration Plan for the full mapping.

### Sub-phases

| Sub-phase | Scope | Status |
|---|---|---|
| **12A** | Lesson contract, roster, validators, versioning | ✅ Shipped — `npm run test:grpc:phase12a` |
| **12B** | Runtime engine, snapshots, Demo Hub wiring | ✅ Shipped — `npm run test:grpc:phase12b` |
| **12C** | Progress persistence + isolation | 🔨 In progress (tab lifecycle + cleanup hardening landed; persistence parity follow-up pending) |
| **12D** | Fixture health checks + readiness gating + Docker fixture additions (TLS `:50443`/`:50444`, Envoy `:50055`, Spring Boot `:9090`/`:8080`, `CreateComplexEcho`, schema v2) | 🔲 Pending |
| **12E** | Lesson UX flows + remediation | 🔲 Pending |
| **12F** | Lock/unlock dependency enforcement | 🔲 Pending |
| **12G** | Telemetry + redacted export | 🔲 Pending |
| **12H** | All 14 lesson wrappers + content validation | 🔲 Pending |
| **12I** | Hardening gate before Phase 13 | 🔲 Pending |

**Order:** `12A → 12B → 12C → 12D → 12E → 12F → 12G → 12H → 12I` (12C/12D may overlap).

**Frozen authoring rules:** immutable lesson ids; `GRPC.*` selectors only; `setup`/`cleanup` on shipped wrappers; Docker lessons need fixture probes — see [`demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc).

**Selector gaps for Phase 12H:** Before authoring lessons, the following `data-testid` values that exist in the DOM must be added to `src/shared/selectors/grpc.ts`: `LOAD_TEST_EXPORT_JSON`, `LOAD_TEST_EXPORT_CSV`, `SCHEMA_DIFF_EXPORT_JSON`, `SCHEMA_DIFF_EXPORT_MARKDOWN`, `TLS_TEST_RESULT`, `RETRY_EXPRESS_BTN`, `STREAM_RETRY_EXPRESS_BTN`, `METADATA_ADD_BTN`, `PROTO_FIELD_REPEATED_ADD`, `PROTO_FIELD_MAP_ADD`. See [`grpc-demo-lessons.md`](grpc-demo-lessons.md) § Selector Reference for the full list.

### Universal Proto Files Ingest (Per Virtual Root)

> **Status:** ✅ **Phases A–D complete**.

Phase D outcome:

1. UI/load paths are root-first for proto ingest.
2. Server contract for `source=proto_files` is protoRoots-only.
3. Source-level usage telemetry remains available via `GET /api/grpc/describe/usage`.

Primary implementation surface:

- Shared contracts: `src/shared/grpc/contracts.ts`
- Proto modal UI: `src/features/grpc/components/GrpcProtoManageModal.tsx`
- Parser/resolver: `src-server/grpc/protoDescriptorParser.ts`, `src-server/grpc/protoImportResolver.ts`
- Usage telemetry: `src-server/grpc/grpcDescribeUsageTelemetry.ts`

---

## Phase 13 — Production Hardening & GA Readiness

> **Goal:** SLOs, reliability drills, accessibility, observability, release gates. **In progress (13A/13B/13E/13F/13G complete, 13H initial gate landed).**

| Sub-phase | Scope |
|---|---|
| **13A** | SLO definitions + measurement harness |
| **13B** | Performance instrumentation + baselines |
| **13C** | Failure-mode matrix + drills |
| **13D** | Recovery + graceful degradation |
| **13E** | Accessibility + schema-diff virtualization |
| **13F** | Observability taxonomy + redaction audit |
| **13G** | Release gating in CI |
| **13H** | Operational runbooks + rollback drills |
| **13I** | Final GA sign-off |

**Order:** `13A → 13B → 13C → 13D → 13E → 13F → 13G → 13H → 13I`

---

## Phase dependency map

```
Phase 1 ─┬─► 2 (Streaming) ─► 6 (Workflow) ─► 8 (Harness)
         ├─► 3 (Proto) ─► 10 (gRPC-Web) ✅ ─► Root-based proto ingest ✅
         ├─► 4 (TLS) ─► 4J ─► 5 (Collections) ✅
         ├─► 7 (Tauri) ✅
         ├─► 9 (Env) ✅
         └─► 11A–11I ✅ ─► 11J–11O ✅
         │
         ├─► Proto Files ingest cleanup ✅
         ├─► Unified Shell UX (07–09) ◄── not started
         └─► Phase 13 (GA) ◄── after product polish + demo track
Phase 12 (Demo) ◄── IN PROGRESS — excluded from product backlog table
```

---

## Canonical code map

| Area | Path |
|---|---|
| Studio page | `src/features/grpc/GrpcStudioPage.tsx` |
| Connection / TLS / settings | `GrpcConnectionBar.tsx`, `GrpcTlsConfigModal.tsx`, `GrpcConnectionSettingsDrawer.tsx` |
| Advanced features hook | `src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts` |
| Load / mock / diff core | `src/shared/grpc/grpcLoadTestSchedulerCore.ts`, `grpcMockRuntimeCore.ts`, `grpcSchemaDiffEngine.ts` |
| Stream load (11O) | `grpcLoadTestStreamScheduler.ts`, `grpcStudioAdvancedCommands.ts` |
| Server routes | `src-server/routes/grpc/grpc-routes.ts` |
| Shared contracts | `src/shared/grpc/contracts.ts` |
| Selectors | `src/shared/selectors/grpc.ts` |
| Mock listener (11M) | `src-server/grpc/grpcMockNetworkListener.ts`, `grpcMockServerPool.ts` (Node; Tauri native deferred) |
| Tauri native | `src-tauri/src/grpc/` (unary/stream shipped; mock network listener deferred) |
| Demo lessons | `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/` |
| Adapters | `packages/demo-hub/src/adapters/grpcStudioAdapter.ts`, `grpcLessonRuntimeAdapter.ts` |
| E2E | `e2e/grpc-studio-*.spec.ts`, `e2e/demo-grpc-first-call.spec.ts` |
| Docker | `docker/grpc/` |

---

## Spring Boot quick reference

| Profile | Target | Notes |
|---|---|---|
| Spring Boot (Netty, local) | `localhost:9090` | Default Spring gRPC port |
| Spring Boot (Servlet) | `localhost:8080` | Phase 10 transport |
| net.devh starter | `localhost:9090` | Community starter |

Reflection: try v1, fall back to v1alpha. Actuator health supports named services (4J-D).

---

## Competitive landscape (summary)

| Feature | Postman | Kreya | grpcui | **RedfireForge** |
|---|---|---|---|---|
| All streaming types | ✅ | ✅ | ⚠️ | ✅ |
| Workflow + assertions | ❌ | ❌ | ❌ | ✅ |
| Native desktop transport | ❌ | ❌ | ❌ | ✅ |
| Load testing | ❌ | ❌ | ❌ | ✅ |
| Mock server + schema diff | ❌ | ❌ | ❌ | ✅ |
| Demo Hub lessons | ❌ | ❌ | ❌ | 🔲 Phase 12 |

---

## Open questions / risks

All resolved or accepted — details in runbooks.

| # | Topic | Status |
|---|---|---|
| OQ-1 | Dynamic invocation without stubs | ✅ `protobufjs` + raw framing |
| OQ-2 | Reflection v1 vs v1alpha | ✅ Try v1, fallback v1alpha |
| OQ-3 | Large proto import graphs | ✅ Descriptor pool (Phase 3) |
| OQ-4 | Stream backpressure | ✅ SSE relay + caps |
| OQ-5 | Tauri vs Express parity | ✅ Transport selector + fallback |
| OQ-6 | Secret persistence policy | ✅ Vault + export redaction |
| OQ-7 | `google.protobuf.Any` UI | ✅ JSON editor + type picker |
| OQ-8 | int64 JSON precision | ✅ Decimal strings |
| OQ-9 | gRPC-Web streaming limits | ✅ Documented; load tests use proxy |
| OQ-10 | Mock server isolation | ✅ Tab-scoped resolution |
| — | Harness profile auto-hydrate (formerly 8J) | ✅ `grpcConnectionProfileHydration.ts` |
| — | Workspace defaults interpolation (formerly 9 P2) | ✅ Precedence merge; env-manager UI still deferred |

---

## Proto Files Ingest — condensed status

- **A–C shipped** (contracts, parser normalization, root-aware modal, default switch).
- **D completed** (UI/load paths are root-based; server contract is protoRoots-only).
- Detailed execution evidence intentionally removed from this plan; use runbooks and git history for implementation-level audit trails.

---

## Non-demo execution plan (before next lesson wave)

> **Window:** start 2026-07-03  
> **Scope rule:** no new lesson wrappers until items below complete.

Progress snapshot (2026-07-03):

- [x] Phase 13A baseline harness script + guide (`scripts/grpc-phase13-baseline.mjs`, `docs/guides/grpc-phase13a-slo-baselines.md`)
- [x] Phase 13B route performance telemetry + snapshot endpoint (`src-server/grpc/grpcRoutePerformanceTelemetry.ts`, `GET /api/grpc/perf/snapshot`)
- [x] Phase 13B baseline report now includes route telemetry snapshot (`scripts/grpc-phase13-baseline.mjs`)
- [x] Phase 13B optional fixture-backed unary + stream lifecycle probes (`--probe-grpc-target`, `--require-data-plane`)
- [x] Phase 13G skeleton CI gate job (`.github/workflows/ci.yml` → `grpc-phase13a-slo`)
- [x] Quick win: RPC Statistics export actions (JSON/CSV) in Advanced panel
- [x] Runtime gate validation pass captured (`artifacts/grpc-phase13a-gate.validation.json`, base URL override `:3002`)
- [x] Runtime Phase 13B gate validation pass captured (`artifacts/grpc-phase13b-gate.validation.json`) after stream probe `tabId` fix
- [x] Additional review round completed (pass-path + expected fail-path behavior validated; harness log prefix normalized)
- [x] Phase 13B CI promotion (fixture-backed gate wired in `.github/workflows/ci.yml` via `npm run grpc:phase13b:ci`)
- [x] Phase 13C failure drill harness (`scripts/grpc-phase13c-drills.mjs`) + CI drill gate skeleton (`grpc-phase13c-drills`) with expanded deterministic matrix
- [x] Phase 13D recovery drill harness (`scripts/grpc-phase13d-recovery.mjs`) + CI recovery gate skeleton (`grpc-phase13d-recovery`) with expanded recovery matrix
- [x] Phase 13E initial a11y + virtualization gate (`grpc:phase13e:gate`) with schema-diff panel virtualization and accessibility semantics
- [x] Phase 13F initial observability taxonomy + redaction audit gate (`grpc:phase13f:gate`) with CI job wiring
- [x] Phase 13G deep-review fix: phase gate jobs now run on `pull_request` events (not branch-ref-only)
- [x] Phase 13H initial operational runbook + rollback drill gate (`grpc:phase13h:gate`) with CI job wiring
- [x] Phase 13I final GA sign-off gate (`grpc:phase13i:gate`) + CI promotion (`grpc-phase13i-ga-signoff`) with consolidated artifact (`artifacts/grpc-phase13i-ga-signoff.json`)
- [ ] Remaining items below

### Priority 1 — Phase 13 continuation (release blocker)

1. **13C Failure-mode matrix + drills** (initial deterministic matrix + gate skeleton landed)
2. **13D Recovery + graceful degradation paths** (expanded recovery drill matrix + CI gate skeleton landed)
3. **13E Accessibility + schema-diff virtualization** (gate + coverage expansion complete)
4. **13I Final GA sign-off** (gate + CI automation complete)

Exit criteria:

- SLO document committed with measurable thresholds for unary, stream, and describe routes.
- Baseline capture script/runbook added and runnable in CI/local.
- CI job fails on hard regressions (initially for critical metrics only).

Suggested code focus:

- `src/features/grpc/`
- `src-server/routes/grpc/`
- `scripts/` + CI workflow files

### Priority 2 — Unified Shell UX mockups 07–09 bootstrap

1. Build UX-1 to UX-3 as the first vertical slice (navigation/header/state containers).
2. Keep behavior parity with current shipped features; visual restructuring only.

Exit criteria:

- UX-1..UX-3 implemented behind stable selectors and without regression in existing gRPC E2E smoke specs.
- Follow-up checklist added for UX-4..UX-7.

Reference: [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md)

### Priority 3 — Proto Files ingest cleanup

Status: ✅ Complete

1. UI/load paths now normalize proto ingest drafts to virtual roots.
2. Server-side describe validation requires proto roots for proto file ingest.
3. Ingest/runbook status reflects single-model proto roots behavior.

### Priority 4 — Quick wins (small, high-leverage)

1. Workflow designer first-pass gRPC advanced node config modal shells.
2. E2E `grpc-studio-mock-listener.spec.ts` for listener lifecycle smoke coverage.

Exit criteria:

- Each quick win ships with one focused Vitest file and one smoke E2E assertion update where applicable.

### Recommended execution order

`13E (expand a11y coverage) → 13F → UX-1..UX-3 → Proto D → quick wins`

### Required validation for this non-demo wave

1. `npx tsc --noEmit`
2. Targeted Vitest for touched areas only
3. Focused Playwright specs for gRPC studio/runtime flows touched by the change
4. Keep `docs/plan/future/grpc/grpc-studio-plan.md` updated at each milestone (status table + success criteria)

---

## Success criteria

**Product (Phases 1–11O):**

- [x] Core studio: connect, reflect, all call types, TLS/auth, collections, workflow, harness, env vars, gRPC-Web
- [x] Advanced: load test, mock server, schema diff, RPC stats, network listener, cross-surface nodes, server-streaming load
- [x] Phase 11I hardening gate — `npm run test:grpc:phase11i`

**Universal Proto Files Ingest:**

- [x] Root-based ingest contracts, validation, normalization, cache, and loader support
- [x] Phase B: Root-aware UI + collision diagnostics
- [x] Default switch to root-based proto ingest
- [x] Phase D: Flat-only cleanup + deprecation docs

**Unified Shell UX (mockups 07–09):**

- [ ] UX-1…UX-7 per [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md)

**Phase 12 (in progress — demo track):**

- [x] 12A lesson contract + 12B runtime engine
- [ ] 12C–12I + 11 remaining lesson wrappers

**Phase 13 (in progress):**

- [x] 13A SLO baseline harness
- [x] 13B performance baselines + fixture-backed CI gate
- [x] 13G CI promotion for baseline gate
- [x] 13C initial failure-drill harness and CI gate skeleton
- [x] 13D recovery-drill harness with expanded matrix and CI gate skeleton
- [x] 13E initial accessibility/virtualization gate and implementation slice
- [x] 13F initial observability taxonomy and redaction audit gate
- [x] 13H initial operational runbook and rollback drill gate
- [x] 13E coverage expansion before GA
- [x] 13I final GA sign-off

---

## Docker test server

Go echo server in `docker/grpc/` — unary + all streaming types on `:50052`. See [`docker/grpc/README.md`](../../../../docker/grpc/README.md).

```bash
cd docker/grpc && docker compose up --build
```

Used by E2E specs and lessons with `requireGoEcho` fixtures.
