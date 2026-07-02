# gRPC Studio — Living Plan

> **Branch:** `feature/grpc-phase` (merges to `develop`)  
> **Status:** Phases **1–11O product complete** ✅ · **Phase 12** in progress (12A–12B ✅, **12C** next; GRPC-1 shipped) · **Phase 13** pending  
> **Last updated:** 2026-07-01 (plan slim-down — removed shipped slice specs, mockup gap tables, and bug-audit history)  
> **Doc policy:** This file is a **short status + forward backlog** only. Shipped sub-phase specs, mockup parity tables, re-evaluation passes, and bug-fix history live in **git history** and **per-phase runbooks** — **do not append audit logs here**.

| Detail lives in | Path |
|---|---|
| Phase runbooks (1–11) | `docs/guides/grpc-phase*-runbook.md` |
| Cross-feature matrix | [`grpc-cross-feature-matrix.md`](grpc-cross-feature-matrix.md) |
| UI mockups + parity | `docs/plan/future/grpc/mockups/` · [`grpc-studio-ui.mdc`](../../../.cursor/rules/grpc-studio-ui.mdc) |
| Phase 1/2 mockup gap tables | [`grpc-phase1-runbook.md`](../../guides/grpc-phase1-runbook.md) · [`grpc-phase2-runbook.md`](../../guides/grpc-phase2-runbook.md) |
| Phase 11 validation report | [`grpc-phase11-validation-report.md`](../../guides/grpc-phase11-validation-report.md) |
| Demo lesson authoring | [`.cursor/rules/demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc) |
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
| **12** — Demo Lessons | 15 lessons (1/15 shipped) | 🔲 **12C** next | `npm run test:grpc:phase12a` |
| **13** — GA Hardening | SLOs, a11y, release gates | 🔲 Pending | — |

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
| **11M** | Network mock listener (web Go subprocess) | `test:grpc:phase11m` |
| **11N** | Workflow advanced nodes, harness/collections helpers | `test:grpc:phase11n` |
| **Phase 11O** | Studio `server_streaming` load test (Express/native transport) | `test:grpc:phase11o` |

Full contracts, acceptance checklists, and troubleshooting: [`grpc-phase11-runbook.md`](../../guides/grpc-phase11-runbook.md).

---

## Deferred / not implemented (product)

Nothing from Phase **1–11** remains **unimplemented** as originally scoped. Items below are intentional deferrals, by-design limits, or owned by Phase **12+**.

| Item | Verdict | Owner |
|---|---|---|
| Schema diff list virtualization (>500 rows) | **Deferred** | Phase **13E** — exports remain full payload |
| RPC Statistics Export JSON (mockup 06) | **Deferred** | Optional; Reset session shipped |
| Workflow Designer palette/config modals for `grpcLoadTest` / `grpcSchemaDiff` / `grpcMockAssert` | **Deferred** | Phase **13** / GRPC-11 v2 — engine handlers in **11N** |
| Collections Compare schema / History Open diff buttons | **Deferred** | Helpers wired; UI TBD |
| Tauri native `tonic` mock network listener | **Deferred** | Post-11M; web uses Go listener |
| E2E `grpc-studio-mock-listener.spec.ts` | **Deferred** | With GRPC-13 lesson |
| Go Docker mock servicer mode | **Deferred** | 11M ships Node listener first |
| Persistent long-lived gRPC channel | **By design** | Probe-based Connect/Disconnect |
| `client_streaming` / `bidi_streaming` load tests | **By design** | 11O v1 = `server_streaming` Studio-only |
| Browser-direct **load tests** (`grpc-web` / `spring-servlet`) | **By design** | Regular browser-direct **calls** work (OQ-9) |
| Workflow `grpcLoadTest` server-streaming | **By design** | Studio owns stream load (11O) |

Historical mockup gaps (Phases 1–4) and OQ-1…OQ-10 are **closed** — see runbooks and § Open questions.

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** 15 guided Demo Hub lessons. **GRPC-12/13/14** prerequisites met (**11J–11O** ✅).

### Lesson roster (15)

| GRPC | id | Title | Requires | Status |
|-----|-----|-------|----------|--------|
| 1 | `grpc-first-call` | Your First gRPC Call | Phase 1 | ✅ Shipped |
| 2 | `grpc-server-reflection` | Service Discovery with Reflection | 1, 3 | 🔲 Planned |
| 3 | `grpc-proto-import` | Importing Proto Files | 3 | 🔲 Planned |
| 4 | `grpc-metadata` | Request Metadata & Headers | 1 | 🔲 Planned |
| 5 | `grpc-tls` | TLS & Secure Connections | 4 | 🔲 Planned |
| 6 | `grpc-server-streaming` | Server Streaming RPC | 2 | 🔲 Planned |
| 7 | `grpc-client-streaming` | Client Streaming RPC | 2 | 🔲 Planned |
| 8 | `grpc-bidi-streaming` | Bidirectional Streaming | 2 | 🔲 Planned |
| 9 | `grpc-collections` | Saving & Organizing Requests | 5 | 🔲 Planned |
| 10 | `grpc-env-variables` | Environments & Variables | 9 | 🔲 Planned |
| 11 | `grpc-workflow-integration` | gRPC in Workflows | 6 | 🔲 Planned |
| 12 | `grpc-load-testing` | Load Testing | **11J**, 11B, 11C | 🔲 Planned |
| 13 | `grpc-mock-server` | Mocking gRPC APIs | **11L**, **11M**, 11D, 11E | 🔲 Planned |
| 14 | `grpc-schema-diff` | Proto Schema Diff in CI | **11J**, 11F | 🔲 Planned |
| 15 | `grpc-spring-boot` | Spring Boot + Spring gRPC | 1, 4, 10 | 🔲 Planned |

Registry: `packages/demo-hub/src/lessons/protocols/grpc-lessons.ts` · Contract: `grpc-lesson-contract/`

### Sub-phases

| Sub-phase | Scope | Status |
|---|---|---|
| **12A** | Lesson contract, roster, validators, versioning | ✅ Shipped — `npm run test:grpc:phase12a` |
| **12B** | Runtime engine, snapshots, Demo Hub wiring | ✅ Shipped — `npm run test:grpc:phase12b` |
| **12C** | Progress persistence + isolation | 🔲 **Next** |
| **12D** | Fixture health checks + readiness gating | 🔲 Pending |
| **12E** | Lesson UX flows + remediation | 🔲 Pending |
| **12F** | Lock/unlock dependency enforcement | 🔲 Pending |
| **12G** | Telemetry + redacted export | 🔲 Pending |
| **12H** | All 15 lesson wrappers + content validation | 🔲 Pending |
| **12I** | Hardening gate before Phase 13 | 🔲 Pending |

**Order:** `12A → 12B → 12C → 12D → 12E → 12F → 12G → 12H → 12I` (12C/12D may overlap).

**Frozen authoring rules:** immutable lesson ids; `GRPC.*` selectors only; `setup`/`cleanup` on shipped wrappers; Docker lessons need fixture probes — see [`demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc).

---

## Phase 13 — Production Hardening & GA Readiness

> **Goal:** SLOs, reliability drills, accessibility, observability, release gates. **Not started.**

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
         ├─► 3 (Proto) ─► 10 (gRPC-Web) ✅
         ├─► 4 (TLS) ─► 4J ─► 5 (Collections) ✅
         ├─► 7 (Tauri) ✅
         ├─► 9 (Env) ✅
         └─► 11A–11I ✅ ─► 11J–11O ✅
                              └─► unblocks GRPC-12/13/14 lessons
Phase 12 (Demo) ◄── IN PROGRESS (12C next)
Phase 13 (GA) ◄── after Phase 12
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
| Tauri native | `src-tauri/src/grpc/` (mock network listener deferred) |
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

---

## Success criteria

**Product (Phases 1–11O):**

- [x] Core studio: connect, reflect, all call types, TLS/auth, collections, workflow, harness, env vars, gRPC-Web
- [x] Advanced: load test, mock server, schema diff, RPC stats, network listener, cross-surface nodes, server-streaming load
- [x] Phase 11I hardening gate — `npm run test:grpc:phase11i`

**Phase 12 (in progress):**

- [x] 12A lesson contract + 12B runtime engine
- [ ] 12C–12I + 14 remaining lesson wrappers

**Phase 13 (pending):**

- [ ] SLO/reliability/a11y/release gates before GA

---

## Docker test server

Go echo server in `docker/grpc/` — unary + all streaming types on `:50052`. See [`docker/grpc/README.md`](../../../../docker/grpc/README.md).

```bash
cd docker/grpc && docker compose up --build
```

Used by E2E specs and lessons with `requireGoEcho` fixtures.
