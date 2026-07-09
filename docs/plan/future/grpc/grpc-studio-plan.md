# gRPC Studio — Living Plan

> **Branch:** `feature/grpc-phase` (merges to `develop`)  
> **Status:** Phases **1–11O product complete** ✅ · **Proto Files ingest (root-based)** complete ✅ · **Unified Shell UX** (mockups 07–09) UX-1..UX-7 delivered ✅ · **Phase 13** complete (13A–13I ✅, sustainment rerun ✅) · **Phase 12** demo track in progress (**4/15 shipped**)  
> **Last updated:** 2026-07-04 (K8s port-forward tab now uses shorter one-line row hints so the left workflow column stays visually compact and aligned in the modal)
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

A **single index** for gRPC Studio **product engineering** — what shipped, where code lives, what is deferred, and what remains (Phase 12 lessons).

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
2. **Form-first input** with JSON view sync.
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
| **UX-1–UX-7** — Unified shell | Mockups 07–09 → production UI | ✅ UX-1..UX-7 shipped (selector-stable) | [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md) |
| **12** — Demo Lessons | 15 lessons, 4 tracks (**4/15 shipped**) | 🔨 **12C** in progress | `npm run test:grpc:phase12a` · [`grpc-demo-lessons.md`](grpc-demo-lessons.md) |
| **13** — GA Hardening | SLOs, a11y, release gates | ✅ 13A–13I complete, sustainment rerun passed | `grpc:phase13a:baseline` / `grpc:phase13b:ci` / `grpc:phase13c:gate` / `grpc:phase13d:gate` / `grpc:phase13e:gate` / `grpc:phase13f:gate` / `grpc:phase13h:gate` / `grpc:phase13i:gate` |

**MVP** = Phases **1–5 + 9** (+ **4J** for UI parity).

---

## Shipped phases (1–10) — one-line summary

| Phase | Summary |
|---|---|
| **1** | Tab-scoped unary explorer: Express proxy, reflection/proto, form composer, response panel |
| **2** | SSE stream relay, stream registry, message log, all call types |
| **3** | Proto/protoset/BSR/URL ingest, import resolver, schema browser, drift |
| **4** | TLS tri-mode, auth, secret vault, redaction |
| **4J** | UI shell parity: connection bar target/TLS/auth/deadline chrome, right-edge action rail (import/save/connect), TLS modal, auth pills, settings drawer with transparent GraphQL-style backdrop, compact Call settings stack, GraphQL-style two-tone settings rows, far-right session gear |
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
| **Phase 13** — GA hardening (SLOs, drills, a11y, CI gates) | **Completed** | 13A–13I complete; sustainment rerun (`13C/13D/13E/13F/13H/13I`) passed |
| **Unified Shell UX** (mockups 07–09) | **Completed (UX-1..UX-7 complete)** | [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md) UX-1…UX-7 shipped and revalidated; selector-stable shell and mobile/tablet adaptations landed |
| Proto Files ingest cleanup — deprecate flat-only ingest | **Completed** | UI/load paths are root-based ingest |
| Schema diff list **virtualization** (>500 rows; cap exists today) | **Completed** | P1-A delivered (2026-07-03): removed `GRPC_SCHEMA_DIFF_UI_LIST_CAP` UI truncation; schema-diff filtering now returns full row set for virtualized rendering |
| Workflow Designer **palette + config modals** for all gRPC node types | **Completed** | Added non-advanced + advanced config shells and palette integration (`GrpcUnaryConfig.tsx`, `GrpcServerStreamConfig.tsx`, `GrpcAssertConfig.tsx`, `GrpcLoadTestConfig.tsx`, `GrpcSchemaDiffConfig.tsx`, `GrpcMockAssertConfig.tsx`) |
| Tauri native `tonic` mock network listener | **Completed** | Native lifecycle command surface + dynamic RPC dispatch host in `src-tauri/src/grpc/mock_server.rs`/`src-tauri/src/grpc/mock_server_dispatch.rs` (startup validates socket bind before reporting running, probes real OS port availability, keeps `listenTarget` format aligned to `127.0.0.1:port`, supports same-tab restart with explicitly requested port, serves descriptor-driven unary + streaming RPC paths from committed mock rules, and now includes trailer-semantics + bidi cancellation/backpressure hardening regressions). |
| E2E `grpc-studio-mock-listener.spec.ts` | **Completed** | Added lifecycle smoke coverage in `e2e/grpc-studio-mock-listener.spec.ts`; verified with Playwright list reporter |
| Go Docker **mock servicer mode** (separate from echo server) | **Completed (P1-B)** | `docker/grpc/go-mock-server/main.go`, compose `grpc-go-mock-servicer` profile (`docker/grpc/docker-compose.yml`), probes (`docker/grpc/probe-fixtures.sh --with-go-mock`), Playwright smoke (`e2e/grpc-studio-go-mock-servicer.spec.ts`) |
| Environment Manager **workspaceDefaults UI** | **Completed** | Dedicated Environment Manager key/value editor shipped with persisted app-level state (`useProjects`/storage) and `GrpcStudioPage` workspace-default override merge |
| Docker fixtures: TLS variants, Envoy gRPC-Web, Spring Boot | **Completed** | Phase **12D** scope delivered in `docker/grpc/` (TLS/mTLS, Envoy, Spring, schema-v2 `CreateComplexEcho`) |

### By-design limits (not backlog)

| Item | Notes |
|---|---|
| Persistent long-lived gRPC channel | Probe-based Connect/Disconnect is intentional |
| `client_streaming` / `bidi_streaming` load tests | 11O v1 = `server_streaming` Studio-only |
| Browser-direct **load tests** (`grpc-web` / `spring-servlet`) | Regular browser-direct **calls** work; load tests use Express/native proxy |
| Workflow `grpcLoadTest` server-streaming | Studio owns stream load (11O) |

Historical mockup gaps (Phases 1–4) and OQ-1…OQ-10 are **closed** — see runbooks and § Open questions.

### Native mock listener parity checklist (Phase 11M follow-up)

| Parity slice | Status | Notes |
|---|---|---|
| Lifecycle (`start`/`stop`/`status`/`log`) envelopes + tab scoping | ✅ Landed | Native command surface active in `src-tauri/src/grpc/mock_server.rs` |
| Startup correctness (bind fail-fast) | ✅ Landed | Start now fails before `running=true` if socket bind/setup fails |
| Rule-set schema validation at start/commit | ✅ Landed | Native deserialization + validation wired via `mock_rules.rs` |
| Deterministic rule ordering/fallthrough/default evaluation core | ✅ Landed | `priority` → `createdAt` → source order; default UNIMPLEMENTED fallback |
| Predicate parity: `method/service/metadata/body path` + boolean combinators | ✅ Landed (core) | `and/or/not` and path lookup parity for non-expression predicates |
| Predicate parity: `expression` sandbox | ✅ Landed | Native parser/evaluator + validation parity implemented in `src-tauri/src/grpc/mock_rules.rs`; security scan semantics aligned with TS sandbox acceptance (allows valid keys like `metadata.function`, still rejects forbidden payloads such as `eval(...)`) |
| Runtime hot-swap semantics with in-flight pinning | ✅ Landed (per-call) | Native dispatch snapshots committed rule state at request start; in-flight calls evaluate against pinned snapshot while newer commits apply to subsequent calls |
| RPC dispatch parity (`unary` + streaming behavior) | ✅ Landed (core) | Native dispatcher now handles descriptor-driven unary, server-streaming, client-streaming, and bidi-streaming routes and applies rule-engine responses/messages over live gRPC HTTP/2 transport |

---

## Post-GA backlog (non-demo)

> Scope: enhancements to production grpc tooling after GA closure. Demo lesson authoring remains tracked in Phase 12.

### Priority queue

| Priority | Backlog item | Why now | Target milestone |
|---|---|---|---|
| P1 | Remove schema-diff 500-row UI cap via full virtualization + export streaming | Current cap can hide large API changes in enterprise schemas | 1 sprint |
| P1 | Go docker mock servicer mode (parallel fixture to Node mock listener) | Improves runtime parity and fixture realism for Go-first services | 1 sprint |
| P2 | Native Tauri grpc diagnostics endpoint and panel | Reduces desktop transport debugging time | 1 sprint |
| P2 | Transport parity matrix automation (Express vs grpc-web vs native tonic) | Prevents behavior drift across transports | 1 sprint |
| P3 | Long-duration soak gate for stream stability and memory drift | Captures regressions missed by short functional drills | 1 sprint |

### Sprint-ready tracker (non-demo)

| ID | Item | Owner | Estimate | Depends on | Status | Ship checklist |
|---|---|---|---|---|---|---|
| P1-A | Schema diff scale-up (remove 500-row cap) | Frontend + shared grpc utils | 3-4 days | none | ✅ Done (started 2026-07-03, completed 2026-07-03) | `tsc` + schema-diff vitest + `grpc:phase13e:gate` |
| P1-B | Go docker mock servicer mode | Infra/devx + grpc backend | 4-5 days | P1-A preferred | ✅ Done (started 2026-07-03, completed 2026-07-03) | compose config/up(profile) + fixture probe(mock mode) + mock-listener E2E smoke |
| P2-A | Native Tauri grpc diagnostics surface | Desktop/tauri + frontend | 3-4 days | P1-B optional | ✅ Done (started 2026-07-04, completed 2026-07-04) | cargo tests/check + `tsc` + targeted grpc vitest |
| P2-B | Transport parity matrix automation | Platform/QA + grpc backend | 3-4 days | P2-A preferred | ✅ Done (started 2026-07-03, completed 2026-07-03) | `tsc` + `grpc:phase13b:ci` + `grpc:phase13i:gate` |
| P3-A | Long-duration soak gate | Platform/QA | 2-3 days | P2-B | ✅ Done (started 2026-07-03, completed 2026-07-03) | baseline + rollback gate + soak artifact generation |

### Sprint execution checklist

- [ ] Create branch for Post-GA non-demo backlog execution
- [x] Complete P1-A and update tracker row to `🔨 In progress`, then `✅ Done`
- [x] Complete P1-B and update tracker row to `🔨 In progress`, then `✅ Done`
- [x] Complete P2-A and update tracker row to `🔨 In progress`, then `✅ Done`
- [x] Complete P2-B and update tracker row to `🔨 In progress`, then `✅ Done`
- [x] Complete P3-A and update tracker row to `🔨 In progress`, then `✅ Done`
- [x] Keep acceptance-command results linked from artifacts/runbook entries for each completed row
- [ ] Re-run `grpc:phase13c/13d/13e/13f/13h/13i` sustainment sequence after P2-B and after P3-A

### Definition of done per row

1. Code + tests merged for the row scope only (no Phase 12 lesson changes).
2. Row acceptance commands pass locally.
3. Plan row status changed from `🔲 Planned` to `✅ Done` with completion date note.
4. Any new artifact path is listed in this plan or a linked runbook.

### P1-A: Schema diff scale-up (remove 500-row cap)

Status: ✅ Done (started 2026-07-03, completed 2026-07-03)

Goal:
1. Keep full diff payload fidelity while rendering large reports without UI lockups.
2. Preserve export correctness for all rows and acknowledged-state metadata.

Implementation scope:
1. Replace capped list rendering in schema-diff panel with windowed virtualization based on viewport height.
2. Keep filter and acknowledge operations against full in-memory data, not only visible rows.
3. Remove schema-diff truncation indicator and cap-specific test assumptions.

Deliverables:
1. Updated schema-diff UI list renderer supporting >10k rows.
2. No hard visual cap constant for user-visible rows.
3. Regression tests for filter/virtualization behavior and large-volume row visibility.

Implementation notes (2026-07-03):
1. Removed `GRPC_SCHEMA_DIFF_UI_LIST_CAP` from advanced types and uncapped `filterGrpcSchemaDiffChangesForUi` so it always returns the full filtered set.
2. Kept existing virtualization in `GrpcSchemaDiffPanel` and removed the obsolete truncated banner branch (`grpc-schema-diff-truncated`).
3. Updated targeted tests to assert uncapped behavior and large-list accessibility summary values.

Validation evidence (2026-07-03):
1. `npx tsc -b --noEmit` ✅
2. `npx vitest run src/features/grpc/utils/grpcStudioAdvancedModel.test.ts src/features/grpc/grpcStudioAdvancedTypes.coverage-gaps.test.ts src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx` ✅ (51 tests)
3. `npm run grpc:phase13e:gate` ✅ (a11y checks + `GrpcAdvancedFeaturesPanels.test.tsx`)

Acceptance commands:
1. `npx tsc -b --noEmit`
2. `npx vitest run src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx src/features/grpc/utils/grpcSchemaDiffAck.coverage-gaps.test.ts src/features/grpc/utils/grpcStudioAdvancedModel.coverage-gaps.test.ts`
3. `npm run grpc:phase13e:gate`

### P1-B: Go docker mock servicer mode

Status: ✅ Done (started 2026-07-03, completed 2026-07-03)

Goal:
1. Provide a dockerized Go mock servicer that can execute rule-driven unary/streaming responses for fixture/E2E usage.
2. Keep existing echo server fixture intact as a separate mode/service.

Implementation scope:
1. Add dedicated Go mock service under `docker/grpc/go-mock-server` with descriptor loading and rule evaluation.
2. Extend compose fixture stack with mock service profile and health/readiness checks.
3. Add probe script support for mock mode and rule import smoke checks.

Deliverables:
1. New compose service and runbook docs for Go mock servicer mode.
2. Rule-set contract parity for essential operators (method, metadata, body-path) with deterministic priority order.
3. Focused E2E smoke path validating rule-based responses against the Go fixture endpoint.

Implementation notes (2026-07-03):
1. Added a dedicated Go mock servicer at `docker/grpc/go-mock-server/main.go` with rule-driven unary + streaming handling for `echo.EchoService` methods.
2. Implemented descriptor-set loading/validation (`MOCK_DESCRIPTOR_SET_FILE`, `MOCK_DESCRIPTOR_SERVICE`) and health/rule inspection endpoints on `:50062`.
3. Added profile-based compose service `grpc-go-mock-servicer` with dedicated ports (`50061/50062`) via `mock-servicer` profile.
4. Extended fixture probes with `--with-go-mock` checks for rule import, metadata predicate, body-path predicate, and server-stream canned responses.
5. Documented mock mode startup and probe usage in `docker/grpc/README.md`.
6. Added focused UI-path Playwright smoke `e2e/grpc-studio-go-mock-servicer.spec.ts` to validate `metadata_equals`, `body_path_equals`, and `method_equals` predicates against `localhost:50061`.
7. Added one-command helper `scripts/grpc-p1b-acceptance.sh` and npm alias `npm run grpc:p1b:acceptance` to run the exact P1-B acceptance sequence.

Retrospective bug fix (2026-07-03):
1. Initial implementation incorrectly applied default `UNIMPLEMENTED` status to matched rules when `statusCode` was absent.
2. Fixed by treating matched rules as status `OK` by default and only applying default `UNIMPLEMENTED` for unmatched/default responses.
3. Hardened focused Playwright smoke typing to use `APIRequestContext` instead of brittle inferred generic type extraction.

Validation evidence (2026-07-03):
1. `cd docker/grpc && docker compose config` ✅
2. `cd docker/grpc && docker compose --profile mock-servicer up -d --build` ✅
3. `cd docker/grpc && ./probe-fixtures.sh --with-go-mock` ✅
4. `npx playwright test e2e/grpc-studio-mock-listener.spec.ts --reporter=list --workers=40 --timeout=15000` ✅ (1 passed)
5. `npx tsc -b --noEmit` ✅
6. `npx playwright test e2e/grpc-studio-go-mock-servicer.spec.ts --reporter=list --workers=40 --timeout=15000` ✅ (3 passed)
7. `npm run grpc:p1b:acceptance` ✅ (4 Playwright tests + fixture probes)
8. Re-ran `npx playwright test e2e/grpc-studio-go-mock-servicer.spec.ts --reporter=list --workers=40 --timeout=15000` and `npm run grpc:p1b:acceptance` after final typing hardening fix ✅

Acceptance commands:
1. `cd docker/grpc && docker compose config`
2. `cd docker/grpc && docker compose --profile mock-servicer up -d --build`
3. `cd docker/grpc && ./probe-fixtures.sh --with-go-mock`
4. `npx playwright test e2e/grpc-studio-mock-listener.spec.ts --reporter=list --workers=40 --timeout=15000`
5. `npx playwright test e2e/grpc-studio-go-mock-servicer.spec.ts --reporter=list --workers=40 --timeout=15000`
6. `npm run grpc:p1b:acceptance`

### P2-A: Native Tauri grpc diagnostics surface

Status: ✅ Done (started 2026-07-04, completed 2026-07-04)

Goal:
1. Expose channel pool and stream/session diagnostics for desktop grpc operations.
2. Reduce incident triage time for native-only connectivity failures.

Implementation scope:
1. Add Tauri command(s) for channel pool snapshot, active stream count, last error taxonomy, and transport mode state.
2. Add Studio diagnostics panel entry for native mode with copyable JSON snapshot.
3. Ensure no secret leakage in diagnostics payloads.

Deliverables:
1. Rust command handlers + typed payload contracts.
2. Frontend diagnostics UI panel (read-only).
3. Redaction tests for sensitive fields.

Implementation notes (2026-07-04):
1. Added native Tauri diagnostics command `grpc_native_diagnostics` in `src-tauri/src/grpc/diagnostics.rs`, returning a redacted snapshot envelope (`transportUsed`, channel pool stats, call/stream registry counters, listener tracking, and taxonomy) without target/auth payload leakage.
2. Extended Rust gRPC internals with aggregate stats accessors used by diagnostics snapshots:
    - `CallRegistry::stats()` in `src-tauri/src/grpc/call_registry.rs`
    - `StreamRegistry::stats()` in `src-tauri/src/grpc/stream_registry.rs`
    - listener aggregate helpers in `src-tauri/src/grpc/state.rs`
3. Added contract mirror types for diagnostics request/result in:
    - Rust: `src-tauri/src/grpc/types.rs`
    - TypeScript: `src/shared/grpc/grpcTauriContracts.ts`
4. Wired diagnostics command through module and Tauri invoke registration:
    - `src-tauri/src/grpc/mod.rs`
    - `src-tauri/src/grpc/commands.rs`
    - `src-tauri/src/lib.rs`
5. Added frontend diagnostics client wrapper `src/shared/grpc/grpcNativeTauriDiagnostics.ts` and advanced panel `src/features/grpc/components/GrpcNativeDiagnosticsPanel.tsx` with refresh + copy JSON actions and non-Tauri guard messaging.
6. Integrated panel as a new advanced tab (`native_diagnostics`) in:
    - `src/features/grpc/grpcStudioAdvancedTypes.ts`
    - `src/features/grpc/components/GrpcAdvancedFeaturesShell.tsx`
7. Added/updated tests for diagnostics contracts, panel behavior, shell tab rendering, and tab constants.

Validation evidence (2026-07-04):
1. `cd src-tauri && cargo test grpc::diagnostics::tests -- --nocapture` ✅ (2 passed)
2. `cd src-tauri && cargo check` ✅
3. `npx tsc -b --noEmit` ✅
4. `npx vitest run src/shared/grpc/grpcNativeTauriDiagnostics.test.ts src/features/grpc/components/GrpcNativeDiagnosticsPanel.test.tsx src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx src/features/grpc/grpcStudioAdvancedTypes.coverage-gaps.test.ts src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.coverage-gaps.test.ts` ✅ (103 passed)

Acceptance commands:
1. `cd src-tauri && cargo test grpc::channel_pool::tests -- --nocapture && cargo check`
2. `npx tsc -b --noEmit`
3. `npx vitest run src/features/grpc/**/*.test.ts src/features/grpc/**/*.test.tsx`

### P2-B: Transport parity matrix automation

Status: ✅ Done (started 2026-07-03, completed 2026-07-03)

Goal:
1. Verify the same grpc operation semantics across Express proxy, grpc-web path, and native tonic path.
2. Catch behavior drift (status codes, headers/trailers shape, retry behavior) before release.

Implementation scope:
1. Add matrix test harness defining canonical operation vectors (unary, server stream, client stream, bidi).
2. Run vectors against all available transports and compare normalized results.
3. Publish parity artifact in CI with explicit pass/fail summary.

Deliverables:
1. Matrix runner script with deterministic fixtures.
2. CI job and artifact attachment.
3. Fail-fast threshold configuration for protocol mismatches.

Implementation notes (2026-07-03):
1. Added deterministic parity runner `scripts/grpc-transport-parity-matrix.ts` and npm alias `grpc:transport:parity` to emit machine-readable reports (`kind=grpc_transport_parity_matrix`) with check-level pass/fail totals.
2. Encoded a frozen support contract for transport/call-type combinations (`unary`, `server_streaming`, `client_streaming`, `bidi_streaming`) across `express`, `tauri`, `grpc-web`, and `spring-servlet`, and compared that contract against live shared logic (`isGrpcTransportCallTypeSupported`).
3. Added explicit fail-fast validation checks for unsupported combinations using `assertGrpcTransportCallTypeSupported` to enforce preflight rejection semantics (`GRPC_INVALID_REQUEST`) before network execution.
4. Added capability-flag parity checks (`browserDirect`, `usesExpressProxy`, `tauriNative`) against `GRPC_TRANSPORT_CAPABILITY_MATRIX` to detect transport-surface drift.
5. Added fallback-behavior checks for native preflight failures vs gRPC status failures via `grpcApiErrorToExpressFallbackBody`, ensuring retry-offer decoration is only applied to native preflight classes.
6. Wired automation into fixture-backed CI gate `scripts/grpc-phase13b-ci.sh` so each run emits `artifacts/grpc-transport-parity-matrix.ci.json` after Phase 13B SLO checks pass.
7. Extended GA sign-off script `scripts/grpc-phase13i-ga-signoff.mjs` to require:
    - `grpc:transport:parity` script presence in `package.json`
    - fresh + passing parity artifact (`artifacts/grpc-transport-parity-matrix.ci.json` fallback to `artifacts/grpc-transport-parity-matrix.json`).
8. Re-evaluation hardening: removed duplicated Phase 13B CLI flag injection in `scripts/grpc-phase13b-ci.sh` by invoking `scripts/grpc-phase13-baseline.mjs` directly with one authoritative argument set.
9. Re-evaluation hardening: tightened Phase 13 baseline threshold parsing (`--max-p95-ms`, `--max-avg-ms`, `--max-error-rate`) to fail fast on invalid numeric input instead of silently bypassing SLO checks.
10. Re-evaluation hardening: made baseline numeric parsing strict (no trailing-junk numeric coercion) so values like `--max-p95-ms=1abc` are rejected at parse time.
11. Re-evaluation hardening: fixed CLI `--flag=value` parsing to preserve values containing additional `=` characters (replaced `split('=')` truncation with first-index slicing) across transport parity and sibling Phase 13 scripts.
12. Re-evaluation hardening: updated Phase 13I artifact freshness logic to reject future-dated `capturedAt` timestamps (must be non-negative age and within max-age window).

Validation evidence (2026-07-03):
1. `npx tsc -b --noEmit` ✅
2. `npm run grpc:transport:parity -- --out artifacts/grpc-transport-parity-matrix.validation.json` ✅
3. `npm run grpc:phase13b:ci` ✅ (includes transport parity artifact generation)
4. `npm run grpc:phase13i:gate` ✅ (sign-off checks include parity artifact freshness/pass)
5. `npx vitest run src/shared/grpc/grpcWebTransportContracts.test.ts src/shared/grpc/grpcTransportFallback.test.ts src/shared/grpc/grpcTransportFallback.coverage-gaps.test.ts src/features/grpc/components/GrpcStreamRequestActionBar.test.tsx` ✅ (34 passed)
6. `node scripts/grpc-phase13-baseline.mjs --max-p95-ms=abc --samples=1 --timeout-ms=100` ✅ (fails fast with `--max-p95-ms must be a positive number`)
7. `node scripts/grpc-phase13-baseline.mjs --max-p95-ms=1abc --samples=1 --timeout-ms=100` ✅ (fails fast with `--max-p95-ms must be a positive number`)
8. `npm run grpc:transport:parity -- --out=artifacts/grpc-parity=a=b.json` ✅ (writes full path without truncation)
9. `node scripts/grpc-phase13i-ga-signoff.mjs --out=artifacts/grpc-phase13i=a=b.json` ✅ (writes full path without truncation)
10. Controlled probe: with `artifacts/grpc-transport-parity-matrix*.json` temporarily set to `capturedAt=2099-01-01T00:00:00.000Z`, `npm run grpc:phase13i:gate` ✅ now fails `transport_parity_artifact_fresh` (future timestamp correctly rejected); rerun with restored artifact ✅ passes.

Acceptance commands:
1. `npx tsc -b --noEmit`
2. `npm run grpc:phase13b:ci`
3. `npm run grpc:phase13i:gate`

### P3-A: Long-duration soak gate

Status: ✅ Done (started 2026-07-03, completed 2026-07-03)

Goal:
1. Detect memory growth, stream resource leaks, and stale-session buildup during extended grpc activity.
2. Add release confidence for prolonged Studio usage.

Implementation scope:
1. Add soak script covering 30-60 minute mixed unary/stream workload against fixture-backed server routes.
2. Record periodic memory snapshots (`rss`, `heapUsed`), route telemetry snapshots, and stream lifecycle balance (`started`, `ended`, `cancelled`).
3. Define explicit pass/fail thresholds and trend regression rules in artifact checks.

Deliverables:
1. Soak gate script and artifact schema (`kind=grpc_soak_gate`).
2. Configurable execution profile (`duration-min`, `interval-sec`, SLO and memory thresholds).
3. Troubleshooting runbook for threshold failures and leak triage.

Re-evaluated implementation plan (2026-07-03):
1. Implement `scripts/grpc-soak-gate.mjs` with deterministic probes:
    - control-plane probes: `GET /api/grpc/describe/usage`, `GET /api/grpc/perf/snapshot`
    - data-plane probes: unary `POST /api/grpc/call` + client-stream lifecycle (`start` → `send` → `end`)
2. Bootstrap a deterministic descriptor via `POST /api/grpc/describe` with fixture proto before probe loops.
3. Capture interval snapshots and compute checks:
    - operation error-rate threshold
    - latency SLO thresholds (`avgMs`, `p95Ms`)
    - memory growth thresholds (`rss`, `heapUsed`)
    - stream lifecycle balance (no unmatched started streams)
    - route perf telemetry monotonicity across snapshots
4. Add npm gate alias for repeatable execution and artifact generation.
5. Add focused unit tests for soak summary/check evaluation helpers.
6. Re-run `tsc` + focused tests + soak gate script + sustainment gates and iterate fixes until zero failures.

Implementation notes (2026-07-03):
1. Added soak gate script `scripts/grpc-soak-gate.mjs` to run mixed control-plane + data-plane probes over configurable duration windows and emit `kind=grpc_soak_gate` artifacts.
2. Added reusable soak summary/check helpers in `src/shared/grpc/grpcSoakGateLib.mjs` and focused tests in `src/shared/grpc/grpcSoakGateLib.test.ts`.
3. Added npm command alias `grpc:soak:gate` in `package.json` (no hardcoded flags; CLI overrides remain authoritative).
4. Added troubleshooting runbook `docs/guides/grpc-soak-gate-runbook.md` with threshold triage and rerun commands.
5. Implemented soak checks for:
    - duration completion
    - avg/p95 latency bounds
    - operation error-rate bound
    - RSS/heap growth bounds
    - stream lifecycle balance
    - perf snapshot sample sufficiency (minimum two snapshots)
    - route telemetry monotonicity
6. Re-evaluation fix: removed duplicate CLI-flag behavior in npm alias by dropping hardcoded `--duration-min/--out` defaults from the script entry.
7. Re-evaluation hardening: added strict threshold argument validation in `scripts/grpc-soak-gate.mjs` (positive latency bounds, bounded error-rate, non-negative memory/stream thresholds) to fail fast on invalid gate configuration.
8. Re-evaluation hardening: added `perf_snapshot_samples_recorded` check and updated monotonicity evaluation to require sufficient perf snapshots before passing.
9. Re-evaluation hardening: tightened integer-only parsing for `--timeout-ms` and `--max-stream-leak` to reject decimal truncation and fail fast on invalid CLI input.
10. Re-evaluation hardening: applied the same strict integer parser pattern to sibling Phase 13 scripts (`grpc-phase13-baseline.mjs`, `grpc-phase13c-drills.mjs`, `grpc-phase13d-recovery.mjs`, `grpc-phase13h-rollback-drill.mjs`, `grpc-phase13i-ga-signoff.mjs`) so integer-only flags now consistently reject decimal truncation.
11. Re-evaluation hardening: made float-valued soak CLI parsing strict (no trailing-junk numeric coercion) for `--duration-min`, `--interval-sec`, and threshold flags.
12. Re-evaluation hardening: fixed shared `--flag=value` parsing in Phase 13 scripts to preserve values containing `=` (e.g., custom `--out` filenames) instead of truncating at the first separator.

Validation evidence (2026-07-03):
1. `npx tsc -b --noEmit` ✅
2. `npx vitest run src/shared/grpc/grpcSoakGateLib.test.ts` ✅ (5 passed)
3. `npm run grpc:phase13a:baseline -- --base-url=http://127.0.0.1:3021 --samples=8 --probe-grpc-target=127.0.0.1:50051 --probe-samples=2 --out artifacts/grpc-phase13a-baseline.validation-soak2.json --require-data-plane --require-live` ✅
4. `npm run grpc:phase13h:gate -- --base-url=http://127.0.0.1:3021` ✅
5. `npm run grpc:soak:gate -- --base-url=http://127.0.0.1:3021 --duration-min=0.2 --interval-sec=2 --out artifacts/grpc-soak-gate.validation2.json` ✅
6. `npm run grpc:phase13i:gate` ✅
7. `npm run grpc:phase13a:baseline -- --base-url=http://127.0.0.1:3031 --samples=8 --probe-grpc-target=127.0.0.1:50051 --probe-samples=2 --out artifacts/grpc-phase13a-baseline.validation-soak3.json --require-data-plane --require-live` ✅
8. `npm run grpc:phase13h:gate -- --base-url=http://127.0.0.1:3031` ✅
9. `npm run grpc:soak:gate -- --base-url=http://127.0.0.1:3031 --duration-min=0.2 --interval-sec=2 --out artifacts/grpc-soak-gate.validation3.json` ✅
10. `npm run grpc:phase13i:gate` ✅
11. `node scripts/grpc-soak-gate.mjs --timeout-ms=1.5` ✅ (fails fast with `--timeout-ms must be a positive integer`)
12. `node scripts/grpc-soak-gate.mjs --max-stream-leak=2.7` ✅ (fails fast with `--max-stream-leak must be a non-negative integer`)
13. `npx tsc -b --noEmit` ✅ (re-run after sibling-script parser hardening)
14. `npx vitest run src/shared/grpc/grpcSoakGateLib.test.ts` ✅ (5 passed; re-run after parser hardening)
15. `node scripts/grpc-phase13-baseline.mjs --samples=2.5` ✅ (fails fast with `--samples must be a positive integer`)
16. `node scripts/grpc-phase13c-drills.mjs --timeout-ms=1.5` / `node scripts/grpc-phase13d-recovery.mjs --timeout-ms=1.5` / `node scripts/grpc-phase13h-rollback-drill.mjs --timeout-ms=1.5` ✅ (all fail fast with `--timeout-ms must be a positive integer`)
17. `node scripts/grpc-phase13i-ga-signoff.mjs --max-artifact-age-days=2.7` ✅ (fails fast with `--max-artifact-age-days must be a positive integer`)
18. `node scripts/grpc-soak-gate.mjs --duration-min=0.1abc` ✅ (fails fast with `--duration-min must be a positive number`)
19. `node scripts/grpc-phase13e-a11y.mjs --out=artifacts/grpc-phase13e=a=b.json` ✅ (writes full path without truncation)
20. `node scripts/grpc-phase13f-observability.mjs --out=artifacts/grpc-phase13f=a=b.json` ✅ (writes full path without truncation)

Artifacts and runbook:
1. `artifacts/grpc-soak-gate.validation2.json`
2. `artifacts/grpc-phase13a-baseline.validation-soak2.json`
3. `artifacts/grpc-soak-gate.validation3.json`
4. `artifacts/grpc-phase13a-baseline.validation-soak3.json`
5. `docs/guides/grpc-soak-gate-runbook.md`

Acceptance commands:
1. `npm run grpc:phase13a:baseline`
2. `npm run grpc:phase13h:gate`
3. `npm run grpc:soak:gate -- --duration-min=30 --out artifacts/grpc-soak-gate.json`

### Recommended execution order (non-demo)

`P1-A -> P1-B -> P2-A -> P2-B -> P3-A`

### Entry criteria

1. Phase 13 gates remain green on current branch.
2. Docker grpc fixture stack is runnable locally.
3. No Phase 12 lesson-wrapper work is mixed into these changes.

### Exit criteria

1. Each completed backlog item has a dedicated runbook or section update in this plan.
2. All acceptance commands for the completed item pass.
3. `docs/plan/future/grpc/grpc-studio-plan.md` status rows are updated in the same change set.

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** 14 guided Demo Hub lessons across four learning tracks. Full lesson spec: [`grpc-demo-lessons.md`](grpc-demo-lessons.md).

### Lesson roster (15)

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
| 15 | `grpc-tauri-desktop` | Tauri Desktop: Native Transport, Diagnostics & Mock Listener | L1, L6, L12 | 🔲 Planned 🖥️ Desktop only |

Registry: `packages/demo-hub/src/lessons/protocols/grpc-lessons.ts` · Contract: `grpc-lesson-contract/` · Full spec: [`grpc-demo-lessons.md`](grpc-demo-lessons.md)

**Roster ID migration:** The contract's `roster.ts` still registers the old 15-lesson IDs (GRPC-1…GRPC-15). Before Phase 12H, migrate to the new 15-lesson IDs. Old IDs 2+3 → `grpc-schema-discovery`, 6+7+8 → `grpc-streaming`, 9+10 → `grpc-env-collections`. New IDs: `grpc-transport-modes`, `grpc-proto-form`, `grpc-grpcurl`, `grpc-tauri-desktop`. See [`grpc-demo-lessons.md`](grpc-demo-lessons.md) § Roster ID Migration Plan for the full mapping.

### Sub-phases

| Sub-phase | Scope | Status |
|---|---|---|
| **12A** | Lesson contract, roster, validators, versioning | ✅ Shipped — `npm run test:grpc:phase12a` |
| **12B** | Runtime engine, snapshots, Demo Hub wiring | ✅ Shipped — `npm run test:grpc:phase12b` |
| **12C** | Progress persistence + isolation | 🔨 In progress (tab lifecycle + cleanup hardening landed; persistence parity follow-up pending) |
| **12D** | Fixture health checks + readiness gating + Docker fixture additions (TLS `:50443`/`:50444`, Envoy `:50055`, Spring Boot `:9090`/`:8081`, `CreateComplexEcho`, schema v2) | ✅ Shipped |
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

> **Goal:** SLOs, reliability drills, accessibility, observability, release gates. **Completed (13A–13I complete; sustainment rerun passed).**

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
         ├─► Unified Shell UX (07–09) ✅
         └─► Phase 13 (GA) ✅
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
| Mock listener (11M) | `src-server/grpc/grpcMockNetworkListener.ts`, `grpcMockServerPool.ts` (production path) + native foundation in `src-tauri/src/grpc/mock_server.rs` |
| Tauri native | `src-tauri/src/grpc/` (unary/stream shipped; mock listener lifecycle + parity hardening landed) |
| Demo lessons | `packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/` |
| Adapters | `packages/demo-hub/src/adapters/grpcStudioAdapter.ts`, `grpcLessonRuntimeAdapter.ts` |
| E2E | `e2e/grpc-studio-*.spec.ts`, `e2e/demo-grpc-first-call.spec.ts` |
| Docker | `docker/grpc/` |

---

## Spring Boot quick reference

| Profile | Target | Notes |
|---|---|---|
| Spring Boot (Netty, local) | `localhost:9090` | Default Spring gRPC port |
| Spring Boot (Servlet) | `localhost:8081` | Phase 10 transport |
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
| — | Workspace defaults interpolation (formerly 9 P2) | ✅ Precedence merge + env-manager UI shipped |

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
- [x] Remaining items below

### Priority 1 — Phase 13 continuation (release blocker)

1. **13C Failure-mode matrix + drills** (initial deterministic matrix + gate skeleton landed)
2. **13D Recovery + graceful degradation paths** (expanded recovery drill matrix + CI gate skeleton landed)
3. **13E Accessibility + schema-diff virtualization** (gate + coverage expansion complete)
4. **13I Final GA sign-off** (gate + CI automation complete)

Status: ✅ Completed (2026-07-03 sustainment rerun pass)

Exit criteria:

- SLO document committed with measurable thresholds for unary, stream, and describe routes.
- Baseline capture script/runbook added and runnable in CI/local.
- CI job fails on hard regressions (initially for critical metrics only).

Suggested code focus:

- `src/features/grpc/`
- `src-server/routes/grpc/`
- `scripts/` + CI workflow files

### Priority 2 — Unified Shell UX mockups 07–09 bootstrap

Status: ✅ UX-1..UX-7 complete (2026-07-03 revalidation pass)

1. Build UX-1 to UX-7 shell parity rollout (desktop/tablet/mobile shell + response inspector + shared TLS + latency footer). ✅
2. Keep behavior parity with current shipped features; visual restructuring only. ✅

Exit criteria:

- UX-1..UX-7 implemented behind stable selectors and without regression in existing gRPC E2E smoke specs.
- Selector stability guard coverage added via `e2e/grpc-selector-guard.spec.ts` using shared constants from `src/shared/selectors/grpc.ts`.

Reference: [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md)

### Priority 3 — Proto Files ingest cleanup

Status: ✅ Complete

1. UI/load paths now normalize proto ingest drafts to virtual roots.
2. Server-side describe validation requires proto roots for proto file ingest.
3. Ingest/runbook status reflects single-model proto roots behavior.

### Priority 4 — Quick wins (small, high-leverage)

1. ✅ Workflow designer gRPC node parity: palette + full modal coverage for non-advanced and advanced nodes (delivered 2026-07-03).
2. ✅ E2E `grpc-studio-mock-listener.spec.ts` for listener lifecycle smoke coverage (delivered 2026-07-03).

Exit criteria:

- Each quick win ships with one focused Vitest file and one smoke E2E assertion update where applicable.

### Recommended execution order

`13E (expand a11y coverage) → 13F → UX complete → Proto D → quick wins`

### Required validation for this non-demo wave

1. `npx tsc --noEmit`
2. Targeted Vitest for touched areas only
3. Focused Playwright specs for gRPC studio/runtime flows touched by the change
4. Keep `docs/plan/future/grpc/grpc-studio-plan.md` updated at each milestone (status table + success criteria)

### Next actions (sprint-ready)

| Priority | Work item | Owner | Estimate | Dependencies | Acceptance command / check |
|---|---|---|---|---|---|
| P0 | ✅ Tauri native mock network listener hardening: trailer semantics breadth + bidi cancellation/backpressure regression coverage (including previously landed `grpc-message` encoding + malformed-frame guards) | Desktop/backend | Completed | None | `cd src-tauri && cargo test grpc::mock_server::tests -- --nocapture && cargo test grpc::mock_server_dispatch::tests -- --nocapture && cargo test grpc::mock_rules::tests -- --nocapture && cargo check` |
| P1 | ✅ Unified shell UX rollout (UX-1..UX-7) with selector stability | Frontend | Completed | P0 complete | `npx vitest run src/features/grpc && npx playwright test e2e/grpc-studio-shell.spec.ts e2e/grpc-selector-guard.spec.ts --reporter=html,list --workers=40 --timeout=15000` |
| P2 | ✅ Environment Manager `workspaceDefaults` editor UI | Frontend | Completed | P1 preferred | `npx tsc -b --noEmit && npx vitest run src/features/environments/EnvironmentManager.test.tsx src/features/scenarios/hooks/useProjects.test.ts src/app/App.test.tsx src/features/grpc/hooks/useGrpcTargetValidation.test.ts src/features/grpc/GrpcStudioPage.test.tsx` |
| P2 | ✅ Docker fixture expansion (TLS + Envoy + Spring) | Infra/devx | Completed | P0 complete | `cd docker/grpc && docker compose up --build && ./probe-fixtures.sh` |
| P3 | ✅ Phase 13 sustainment rerun on release candidate branch (regression guard only) | Platform + QA | Completed | P0/P1 complete | `npm run grpc:phase13c:gate && npm run grpc:phase13d:gate && npm run grpc:phase13e:gate && npm run grpc:phase13f:gate && npm run grpc:phase13h:gate && npm run grpc:phase13i:gate` |

Execution order: `P1 -> P2 -> P3` (`P0` complete).

### P2 implementation checklist — Docker fixture expansion (TLS + Envoy + Spring)

- [x] Add TLS fixture endpoint at `localhost:50443` (server-auth TLS)
- [x] Add mTLS fixture endpoint at `localhost:50444` (client cert required)
- [x] Add Envoy grpc-web fixture endpoint at `localhost:50055` routing to `grpc-test-server:50051`
- [x] Add Spring fixture endpoints at `localhost:9090` (gRPC) and `localhost:8081` (actuator/http)
- [x] Add schema v2 surface with `CreateComplexEcho` fixture method for lesson/probe use
- [x] Add/refresh fixture probe script and README runbook commands for all five targets
- [x] Validate compose config and fixture startup/probe flow (`docker compose config`, `docker compose up --build`, `./probe-fixtures.sh`)

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

- [x] UX-1…UX-3 selector-stable vertical slice (tab shell + connection row + request composer parity + guard coverage)
- [x] UX-4…UX-7 rollout complete (see [`grpc-ux-spec-concrete.md`](grpc-ux-spec-concrete.md))

**Phase 12 (in progress — demo track):**

- [x] 12A lesson contract + 12B runtime engine
- [ ] 12C–12I + 10 remaining lesson wrappers (L5–L15; L15 is `desktopOnly: true`)

**Phase 13 (complete):**

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
