# GraphQL Demo Lesson Enhancement Plan

**Status:** Active — **All 19 lessons registered (§3.1 ✅)**; **GQL-1 & GQL-2 enhancement-complete**; **§11.0 demo tab isolation shipped for GQL-1..15**; **GQL-5 TLS/mTLS lesson + studio TLS proxy shipped (2026-06-22)**; Phase 8 visual validation + §11.0 acceptance E2E pending  
**Last Updated:** 2026-06-22 (GQL-5 extended to 12 steps with mTLS; studio TLS transport + page cert persistence; dual Docker health gate; demo E2E shell; APQ/SSE GET PEM hardening; plan sync)  
**Branch target:** `feature/graphql-demo-quality` (or current GraphQL feature branch)  
**Created:** 2026-06-20  
**Scope:** 13 shipped GraphQL demo lessons + 6 new lessons (`gql-https-tls`, `gql-multi-tab`, `gql-batch-execution`, 3 workflow lessons) → **19-lesson final roster**  
**Studio engineering:** ✅ Complete through Phase 6 + optional polish (`graphql-studio-plan.md`)

**Naming convention (use everywhere in this doc):**
- **Slot / Card label `GQL-N`** — Demo Hub display order (**1–19**, defined in **§3.1**). Shown on lesson cards.
- **Stable lesson `id`** — e.g. `gql-first-query`, `gql-multi-tab` (never changes on reorder).
- **Step id prefix** — Frozen per lesson file (see **§3.2**). e.g. `gql3-*` in `graphql-mutations.ts` even when that lesson is card **GQL-6**.
- **New lessons** — Step prefix matches card number when authoring (`gql14-*` for GQL-14).
- **Step ids in existing lessons are NEVER renamed** — `gql6-*` stays `gql6-*` in `graphql-auth-headers.ts` even though auth is card **GQL-4**.

**Enhancement baseline (2026-06-22):** **GQL-1** (**§3.5**) and **GQL-2** (**§3.6**) are locked as **enhancement-complete** (reference quality). **GQL-3..19** are **shipped in code** (`graphql-lessons.ts` matches **§3.1**) — see **§3.7** for per-lesson status. **§11.0** demo tab plumbing (`gqlDemoWorkspace.ts`, `gql-demo-tab.ts`, `tabBudget`, `PrerequisiteGate`) is **implemented for all GraphQL Studio lessons GQL-1..15**; workflow lessons GQL-16..19 use Workflow Designer/Runner tabs (no studio `tabBudget`). Quality pass to GQL-1/GQL-2 bar remains open for GQL-3..13 and GQL-16. **§11.0 acceptance E2E** (user workspace survives lesson) is still pending.

---

## Implementation Status (2026-06-22)

| Track | Phase | Status | Notes |
|-------|-------|--------|-------|
| **Studio product** | Phases 1–6 | ✅ Complete | Per-tab isolation, profiles, polling, lifecycle cache, upload progress |
| **Studio polish** | Optional | ✅ Complete | Auth profile hint, page split, tracing UI, tab auto-label, protocols tab memory |
| **Studio persistence** | 2026-06-21 | ✅ Complete | Endpoint hydrate gate; loopback `localhost`→`127.0.0.1` (corporate proxy); endpoint normalize |
| **Batch UI (Phase 6G)** | 6G | ✅ Complete | Batch config in **Advanced Settings → Batch**; tab bar **B** badges read-only; `GqlBatchSettingsPanel` |
| **Demo Hub registry** | Phase 3 | ✅ **Complete** | `graphql-lessons.ts` — all **19** lessons in **§3.1** order |
| **GQL-1 (`gql-first-query`)** | Phases 1–2 | ✅ **Enhancement complete** | **§3.5** — reference lesson; smoke E2E ✅; §11.0 demo tab ✅ |
| **GQL-2 (`gql-variables`)** | Phases 1–2 | ✅ **Enhancement complete** | **§3.6** — reference lesson; demo E2E spec ✅; §11.0 demo tab ✅ |
| **GQL-3..13 + GQL-16** | Phases 1–2 | 🔨 **Shipped — enhancement pending** | Registered + unit tests + §11.0 demo tab (studio lessons); spotlight/diagram pass — **§3.7** |
| **GQL-5 TLS (`gql-https-tls`)** | **7A** | ✅ **Complete (lesson + product)** | **12 steps** · 8 min · skip-cert → CA → **mTLS (4445)** · `demo-gql-https-tls.spec.ts` shell + **full Docker E2E ✅** · Phase 8 human Web+Tauri pending |
| **GQL-14 Multi-tab (`gql-multi-tab`)** | **7B** | ✅ **Authored** | **9 steps** · 5 min · `tabBudget: 2` · §11.0 ✅ · 7C profiles+polling · **`demo-gql-multi-tab.spec.ts` ✅** |
| **GQL-15 Batch (`gql-batch-execution`)** | Phase 5 / 6G-8 | ✅ **Authored** | **9 steps** · `tabBudget: 2` · Advanced Settings batch UI · §11.0 ✅ · **`demo-gql-batch-execution.spec.ts` ✅** |
| **GQL-17..19 Workflow cluster** | Phase 5 | ✅ **Authored** | Runner / mutation / subscription · unit tests ✅; Phase 8 pending |
| **Env manager helpers** | §8 | ✅ Complete | `ensureDemoEnvironment` / `ensureDemoMicroservice`; GQL-1 uses named demo env |
| **Demo workspace isolation** | **§11.0 / 7-pre** | ✅ **Engineering complete** | `gqlDemoWorkspace.ts`, `gql-demo-tab.ts`, `demoLessonId`, `MAX_USER_TABS`, `PrerequisiteGate`, `useDemoHub` cleanup, `purgeOrphanDemoTabs` — wired **GQL-1..15** |
| **§11.0 acceptance proof** | E2E | 🔲 **Pending** | "User workspace survives GQL-1" case not yet in `e2e/DEMO-LESSON-E2E-MEMO.md` |
| **Studio TLS transport** | Product | ✅ **Complete (2026-06-22)** | `gqlTls.ts`, Node proxy routes, `GraphqlTlsPanel`, per-tab `skipTlsVerify`, page-level PEM persistence (`gql_tls_certs_v1`), upload + SSE + APQ + batch + subscribe |
| **Visual validation** | Phase 8 | 🔨 Partial | Demo E2E shell for GQL-1..10 + TLS; GQL-5 full Docker walk needs stacks; no demo specs for GQL-14/15; human 1× pass pending |

**Recommended implementation order (revised 2026-06-22):**
1. **§11.0 acceptance E2E** — prove user tabs/endpoint survive lesson run; document in `DEMO-LESSON-E2E-MEMO.md`.
2. **Phase 8 (partial)** — Demo Hub 1× human pass **GQL-2**, then spot-check **GQL-5, GQL-6, GQL-14, GQL-15, GQL-17**.
3. **Enhancement pass GQL-3..13 + GQL-16** — spotlight (§9.1), diagram audit (§6.1), description depth.
4. **Demo E2E GQL-14 + GQL-15** — `demo-gql-multi-tab.spec.ts`, `demo-gql-batch-execution.spec.ts`.
5. **Phase 8 (full)** — all 19 lessons at 1× auto-play before `develop` merge.
6. **Expand smoke E2E** — beyond GQL-1..3 per `graphql-lesson-smoke-helpers.ts` pattern.

---

## Pending, Deferred & Not Implemented (2026-06-22)

> **Consolidated backlog** — items still open after §11.0 engineering landed.

### P0 — Proof & safety (not done)

| Item | Track | Notes |
|------|-------|-------|
| §11.0 acceptance E2E | E2E | User custom URL + tab title unchanged after GQL-1 exit; 7-tab + demo slot; GQL-14 gate at 7 tabs |
| `e2e/DEMO-LESSON-E2E-MEMO.md` update | Docs | Document §11.0 patterns + orphan-tab policy |
| Phase 8 human validation | QA | 1× auto-play at 1× for all **19** lessons (partial only today) |

### P1 — Quality enhancement (shipped but below GQL-1/GQL-2 bar)

| Item | Lessons | Notes |
|------|---------|-------|
| 700×430 diagram audit | GQL-3..13, GQL-16 | Replace pipeline-arrow diagrams with full studio chrome |
| Spotlight / highlight fixes | GQL-6, GQL-7, GQL-11, GQL-13, GQL-16 | See **§5** issue catalog |
| GQL-16 workflow depth | GQL-16 | Console tour, Runner step, Debug Mode, empty-state callout (vs WS/Kafka) |
| Narration cross-refs | All | Legacy card numbers → **§3.1** slot titles where still cited |

### P1 — Demo E2E gaps (specs missing)

| Lesson | Status |
|--------|--------|
| GQL-11..13 | No `demo-gql-*` spec |
| GQL-14 Multi-Tab | Engineering E2E only — **no** `demo-gql-multi-tab.spec.ts` |
| GQL-15 Batch | **No** `demo-gql-batch-execution.spec.ts` |
| GQL-16..19 Workflow | **No** demo walk specs |
| GQL-6 Mutations | `demo-gql-mutations.spec.ts` is **legacy card-3** walk — update or add canonical GQL-6 spec |

### P2 — Deferred / optional (explicitly out of scope for now)

| Item | Track | Notes |
|------|-------|-------|
| **7C** GQL-14 optional steps | 7C | `gql14-profiles`, `gql14-polling` — profile-linked tabs, per-tab polling |
| **GQL-20+** | Future | No slots in `graphql-lessons.ts` |
| Basic Auth demo steps | Security Phase 2 | Mentioned in GQL-4 concept only |
| OAuth2 / OIDC lesson beat | Security Phase 2 | Not authored |
| GQL-7 subscription-channel auth step | Security Phase 2 | Cross-ref in GQL-4 only |
| Tab rename `data-testid` for GQL-14 | 11.4 | `gql14-real-world` — verify at E2E time |
| `graphql-studio-plan.md` 6G-7 E2E | Engineering | Two endpoints → two batch groups — 🔲 |
| Per-tab PEM cert fields | TLS product | CA/client cert/key are **page-level defaults** with tab inheritance — not independent per-tab PEM stores |
| Native Rust TLS in Tauri | TLS product | Custom CA/mTLS/APQ-with-PEM routes through **Node proxy** (`localhost:3001`), not native webview TLS |
| GQL-5 full Docker E2E in CI | E2E | `demo-gql-https-tls` full walk requires TLS (4444) + mTLS (4446) + plain GraphQL (4010) — not in default CI |

### ✅ Recently completed (2026-06-22 — GQL-5 TLS/mTLS session)

| Item | Notes |
|------|-------|
| GQL-5 lesson extended | **8 → 12 steps** (`gqlt-mtls-intro`, `gqlt-mtls-creds`, `gqlt-mtls-connect`); **8 min**; mirrors `ws-tls-local` 3-phase arc |
| Studio TLS product | `src/shared/types/gqlTls.ts`; `GraphqlTlsPanel`; `tlsAgent.ts` + consolidated `tlsAgentForEndpoint`; routes for query/batch/subscribe/SSE/upload |
| Web transport | `gqlFetch` → Vite `__proxy` or `/api/graphql/*`; APQ GET supports **skipTlsVerify only** — PEM rejected on GET (`routeTlsQueryGuards.ts`) |
| Tauri transport | Skip-cert + APQ GET + incremental delivery route through Node proxy; relative `/api/*` resolution |
| Page cert persistence | `gql_tls_certs_v1` — CA/client PEM survive refresh (like `skipTlsVerify` page default) |
| `gqlUpload` mTLS | `x-gql-tls-config` header + server-side `buildGraphqlTlsAgent` |
| PrerequisiteGate | `dockerEndpoints: [4444, 4446]` — both TLS and mTLS stacks required before Start Demo |
| Demo E2E | `e2e/demo-gql-https-tls.spec.ts` — shell (12 steps) ✅; full auto-play skips without Docker |
| Tech-debt cleanup | Duplicate `tlsAgentForEndpoint` removed; health-probe gate aligned with `docker-compose.mtls.yml` |

### ✅ Recently completed (2026-06-22 — earlier session)

| Item | Notes |
|------|-------|
| §11.0 demo tab infrastructure | `gqlDemoWorkspace.ts`, `ensureGqlDemoTab`, `closeGqlDemoTabs`, `tabBudget`, `PrerequisiteGate` |
| GQL-1..15 studio lesson migration | All studio lessons use demo tab setup/cleanup (not page `fill('')`) |
| GQL-15 restructure | 9 steps; Advanced Settings → Batch enable + tab inclusion; pacing fixes |
| Mutation tab badge color | `--gql-mutation` amber (was red `--gql-danger`) — aligns with lesson narration |
| Advanced Settings modal default size | 720×560 resizable popover for batch lesson readability |

---

## GQL-5 TLS/mTLS — Limitations, Deferred & Next Work (2026-06-22)

### Product limitations (by design or MVP scope)

| Area | Behavior | Notes |
|------|----------|-------|
| **Web custom TLS** | Node.js proxy required | Browser cannot attach custom CA/mTLS to `fetch`; web mode shows **Proxy** transport badge |
| **Tauri custom TLS** | Routes through Node proxy (`localhost:3001`) | Not native Rust/webview TLS for CA/mTLS/APQ-with-PEM paths |
| **APQ GET** | `skipTlsVerify` only | PEM fields (`caCert`, `clientCert`, `clientKey`) **rejected** on GET — use POST `/api/graphql/query` |
| **SSE GET** | `skipTlsVerify` only | CA/mTLS subscriptions use POST `/api/graphql/sse` with JSON body |
| **PEM storage** | Page-level default | `gql_tls_certs_v1`; tabs inherit via `tabConnectionResolution` — no separate per-tab PEM vault |
| **PrerequisiteGate** | Dual probe | GQL-5 requires **both** `4444/health` (TLS) and `4446/health` (mTLS) — matches `dockerCommand` |
| **Full E2E** | Environmental | `npm run test:e2e:demo:gql5` full walk needs three Docker stacks (TLS + mTLS + plain 4010) |

### Still deferred (not blocking merge)

| Item | Priority | Notes |
|------|----------|-------|
| Phase 8 human validation GQL-5 | P0 | 1× auto-play Web **and** Tauri at 1× speed |
| §11.0 acceptance E2E | P0 | User workspace survives lesson — all studio lessons |
| Basic Auth / OAuth demo steps | P2 | Security Phase 2 — GQL-4 concept only today |
| Per-tab independent PEM stores | P3 | Only if product demands different certs per tab |
| CI Docker matrix for GQL-5 | P3 | Optional job to run full TLS walk on PRs touching TLS code |
| `demo-gql-multi-tab` / `demo-gql-batch-execution` | P1 | Demo E2E specs still missing |

### Recommended next tackles (priority order)

1. **§11.0 acceptance E2E** — highest safety value; unblocks merge confidence for all studio lessons.
2. **Phase 8 spot-check GQL-5** — human Web + Tauri pass with Docker stacks running (validates mTLS steps 9–11).
3. **Demo E2E GQL-14 + GQL-15** — follow `demo-gql-https-tls.spec.ts` pattern.
4. **Enhancement pass GQL-3..13** — spotlight + 700×430 diagrams to GQL-1/GQL-2 bar.
5. **GQL-16 workflow depth** — Console + Debug steps (§9.2–9.3).
6. **7C optional** — profile-linked tabs + per-tab polling beats in GQL-14.

---

## 1. Executive Summary

After a thorough comparison of the Workflow demo lessons (`ws-workflow-builder`, `kafka-workflow-produce`, `kafka-workflow-consume-wait`, `ws-tls-local`, `kafka-secure`, `kafka-tls`) against the 13 GraphQL demo lessons, **six structural quality gaps** were identified:

1. **Concept diagrams are schematic boxes, not mockups** — Workflow lessons use rich 700×430 SVG studio mockups (~190 lines). **GQL-1 & GQL-2 meet this bar** (§3.5, §3.6). **GQL-3..13** (current registry) still use pipeline arrows or interim work — **scheduled for reimplementation**.
2. **Highlight/spotlight mismatches on ~11 steps across 6 lessons** — **GQL-1 & GQL-2 fixed**. Remaining: **GQL-6** Mutations, **GQL-7** Subscriptions, **GQL-11** Tracing, **GQL-16** Workflow, **GQL-13** Mock — fix during enhancement pass.
3. **Workflow Integration (GQL-16) steps are thinner than their WS/Kafka counterparts** — No Console tour, no Workflow Runner step, no Debug Mode, no empty-state callout, shorter descriptions overall.
4. **Three entire workflow-era features have no GraphQL lesson** — ~~No GraphQL Mutation node lesson, no GraphQL Subscription node in the Designer, and no "GraphQL Workflow Runner & Results" close-the-loop lesson~~ **Resolved (2026-06-21):** GQL-17..19 authored; GQL-16 integration lesson still needs enhancement depth.
5. **Security coverage gap vs WebSocket and Kafka** — Credential injection (**GQL-4**). **Transport security + mTLS** (**GQL-5** ✅ — 12-step lesson, studio TLS proxy, Docker 4443/4445). Basic Auth, subscription-channel auth, and OAuth remain open (Enhancement Phase 2 / deferred).
6. **Demo lessons pollute the user's GraphQL Studio workspace** — ~~Lessons run in the real Studio and mutate page-level endpoint storage~~ **Resolved for GQL-1..15 (2026-06-22):** §11.0 reserved demo tab (`ensureGqlDemoTab` / `closeGqlDemoTabs`). **Acceptance E2E proof still pending.**

> **2026-06-22 update:** **GQL-5** extended to **12 steps** with full mTLS arc + studio TLS product. **§11.0 engineering complete** for GQL-1..15. Next: **§11.0 acceptance E2E**, Phase 8 validation (especially GQL-5 Web+Tauri), demo E2E for GQL-14/15, enhancement pass GQL-3..13/GQL-16.

## 2. Root Cause Analysis — Why the Quality Gap Exists

### 2.1 Authoring timeline mismatch

The Workflow-adjacent lessons (`ws-workflow-builder`, `kafka-workflow-produce`, `kafka-workflow-consume-wait`) were authored *after* the demo-player authoring rules were fully established. The authors had the rule for "rich concept diagrams" and "always demo power-user features" in hand when they wrote them.

The GraphQL lessons were authored *earlier* (and incrementally extended), before the "full studio mockup SVG" standard was set. Once the baseline was established as simple pipeline arrows, each new GraphQL lesson copied that style. Security topics (`ws-tls`, `ws-tls-local`, `kafka-secure`, `kafka-tls`) were also added in a later wave that did not produce GraphQL equivalents.

### 2.2 Diagram content standard

The WS workspace lesson introduced the richest diagram format: a full painted studio chrome at 700×430 px. **GQL-1 & GQL-2 meet this standard** (§3.5, §3.6). **GQL-3..13** must be brought to the same bar during **reimplementation**.

### 2.3 Spotlight strategy inconsistency

The authoring rule says: **highlight the element the user should watch** — not always the button they click. But most GraphQL lessons highlight the *trigger* (Execute, Subscribe, Introspect buttons) even when the narration's payoff is in a different panel (Response body, Tracing waterfall, Schema badge). Workflow lessons carefully separate "action button" steps from "observe result" steps:

- Step N: highlight the **trigger button** → action clicks it
- Step N+1: highlight the **result panel** → spotlight on outcome, action may be None

GraphQL lessons often compress both into one step with a mismatched highlight.

### 2.4 Workflow integration under-scoped

The single GraphQL workflow lesson (`gql-workflow-integration`, 8 steps) shows just the basic "query node + assert node + quick test" loop. WS and Kafka workflow lessons are paired/tripled (`ws-workflow-builder` + `ws-test-runner`; `kafka-workflow-produce` + `kafka-workflow-consume-wait` + `kafka-test-runner`) and include Workflow Runner, Results Dashboard, Console, debug step-through, and load test teardown. No equivalent exists for GraphQL.

### 2.5 Security lessons never prioritized for GraphQL

Auth and TLS lessons were added to the WS and Kafka curricula when secure Docker stacks landed. GraphQL now has **`gql-auth-headers` (GQL-4)** and **`gql-https-tls` (GQL-5)** with skip-cert → CA → mTLS parity to `ws-tls-local` — Phase 8 human validation pending. §11.0 demo isolation **shipped for GQL-1..15**.

---

## 3. Lesson Order — Canonical Roster

> **Single source of truth:** Every `GQL-N` label, cross-reference, and enhancement checklist in this document uses **§3.1** only. Step ids use frozen prefixes from **§3.2** (not card numbers).

### 3.1 Canonical lesson roster (19 lessons)

| Slot | `id` | Title | Steps | Est. | Status |
|------|------|-------|-------|------|--------|
| **GQL-1** | `gql-first-query` | Your First GraphQL Query | 13 | 7 min | ✅ **Enhancement complete** (**§3.5**) |
| **GQL-2** | `gql-variables` | Variables & Arguments | 18 | 9 min | ✅ **Enhancement complete** (**§3.6**) |
| **GQL-3** | `gql-schema-exploration` | Schema Exploration | 8 | 4 min | 🔨 Shipped · enhancement pending (**§3.7**) |
| **GQL-4** | `gql-auth-headers` | Authentication & Headers | 12 | 6 min | 🔨 Shipped · enhancement pending |
| **GQL-5** | `gql-https-tls` | HTTPS, TLS & Certificates | **12** | **8 min** | ✅ **Complete (7A + mTLS)** · demo E2E shell ✅ · Phase 8 human pending |
| **GQL-6** | `gql-mutations` | Mutations — Create, Update, Delete | 15 | 7 min | 🔨 Shipped · enhancement pending · §11.0 ✅ · amber **M** badge |
| **GQL-7** | `gql-subscriptions` | Subscriptions — Real-Time Data | 12 | 5 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-8** | `gql-query-builder` | Query Builder | 10 | 4 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-9** | `gql-collections-history` | Collections & History | 8 | 4 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-10** | `gql-export-share` | Export & Share Queries | 5 | 3 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-11** | `gql-performance-tracing` | Performance Tracing | 8 | 4 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-12** | `gql-schema-diff` | Schema Diff | 7 | 3 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-13** | `gql-mock-server` | Mock Server | 10 | 5 min | 🔨 Shipped · enhancement pending · §11.0 ✅ |
| **GQL-14** | `gql-multi-tab` | Multi-Tab Workspaces | 7 | 4 min | ✅ Authored (7B) · `tabBudget:2` · §11.0 ✅ |
| **GQL-15** | `gql-batch-execution` | Batch Execution | **9** | 4 min | ✅ Authored · Advanced Settings batch · `tabBudget:2` · §11.0 ✅ |
| **GQL-16** | `gql-workflow-integration` | Workflow Integration | 10 | 5 min | 🔨 Shipped · enhancement pending · N/A (workflow tab) |
| **GQL-17** | `gql-workflow-runner` | Workflow Runner & Results | 10 | 5 min | ✅ Authored · Phase 8 pending · N/A |
| **GQL-18** | `gql-workflow-mutation` | Mutation Node in Workflow | 8 | 4 min | ✅ Authored · Phase 8 pending · N/A |
| **GQL-19** | `gql-workflow-subscription` | Subscription Node in Workflow | 9 | 5 min | ✅ Authored · Phase 8 pending · N/A |

**Total curriculum time:** ~89 min.

**Arc grouping:**

```
── CORE FUNDAMENTALS (GQL-1..3) ─────────────────────────────────────────
 1  gql-first-query          Your First GraphQL Query
 2  gql-variables            Variables & Arguments
 3  gql-schema-exploration   Schema Exploration
── SECURITY (GQL-4..5) ──────────────────────────────────────────────────
 4  gql-auth-headers         Authentication & Headers  [expanded Phase 2]
 5  gql-https-tls            HTTPS, TLS & Certificates   [NEW 🐳]
── OPERATIONS (GQL-6..7) ─────────────────────────────────────────────────
 6  gql-mutations            Mutations
 7  gql-subscriptions        Subscriptions               [+transport step]
── PRODUCTIVITY (GQL-8..10) ──────────────────────────────────────────────
 8  gql-query-builder        Query Builder
 9  gql-collections-history  Collections & History
10  gql-export-share         Export & Share Queries
── ANALYSIS (GQL-11..13) ─────────────────────────────────────────────────
11  gql-performance-tracing  Performance Tracing
12  gql-schema-diff          Schema Diff
13  gql-mock-server          Mock Server
── STUDIO POWER (GQL-14..15) ─────────────────────────────────────────────
14  gql-multi-tab            Multi-Tab Workspaces        [NEW — teach FIRST]
15  gql-batch-execution      Batch Execution             [NEW — after multi-tab]
── WORKFLOW (GQL-16..19) ─────────────────────────────────────────────────
16  gql-workflow-integration Workflow Integration
17  gql-workflow-runner      Workflow Runner & Results   [NEW]
18  gql-workflow-mutation    Mutation Node in Workflow   [NEW]
19  gql-workflow-subscription Subscription Node in Workflow [NEW]
```

### 3.2 Frozen step id prefixes (do not rename)

Card number (`GQL-N`) and step prefix **diverge** for lessons authored before the roster reorder. Always cite **card + stable `id`** in narration; never rename step ids.

| Card | `id` | Lesson file | Step prefix |
|------|------|-------------|-------------|
| GQL-1 | `gql-first-query` | `graphql-first-query.ts` | `gql1-*` |
| GQL-2 | `gql-variables` | `graphql-variables.ts` | `gql2-*` |
| GQL-3 | `gql-schema-exploration` | `graphql-schema-exploration.ts` | `gql4-*` |
| GQL-4 | `gql-auth-headers` | `graphql-auth-headers.ts` | `gql6-*` |
| GQL-5 | `gql-https-tls` | `graphql-https-tls.ts` *(new)* | `gqlt-*` |
| GQL-6 | `gql-mutations` | `graphql-mutations.ts` | `gql3-*` |
| GQL-7 | `gql-subscriptions` | `graphql-subscriptions.ts` | `gql5-*` |
| GQL-8 | `gql-query-builder` | `graphql-query-builder.ts` | `gql7-*` |
| GQL-9 | `gql-collections-history` | `graphql-collections-history.ts` | `gql8-*` |
| GQL-10 | `gql-export-share` | `graphql-export-share.ts` | `gql9-*` |
| GQL-11 | `gql-performance-tracing` | `graphql-performance-tracing.ts` | `gql10-*` |
| GQL-12 | `gql-schema-diff` | `graphql-schema-diff.ts` | `gql12-*` |
| GQL-13 | `gql-mock-server` | `graphql-mock-server.ts` | `gql13-*` |
| GQL-14 | `gql-multi-tab` | `graphql-multi-tab.ts` *(new)* | `gql14-*` |
| GQL-15 | `gql-batch-execution` | `graphql-batch-execution.ts` *(new)* | `gql15-*` |
| GQL-16 | `gql-workflow-integration` | `graphql-workflow-integration.ts` | `gql11-*` |
| GQL-17 | `gql-workflow-runner` | `graphql-workflow-runner.ts` *(new)* | `gql17-*` |
| GQL-18 | `gql-workflow-mutation` | `graphql-workflow-mutation.ts` *(new)* | `gql18-*` |
| GQL-19 | `gql-workflow-subscription` | `graphql-workflow-subscription.ts` *(new)* | `gql19-*` |

### 3.3 Ordering rationale

| Arc | End-user (learner) rationale | Product rationale |
|-----|------------------------------|-------------------|
| **Fundamentals GQL-1..3** | Query → variables → schema before writes or realtime | Environment Manager seeding in GQL-1; schema browse before auth-gated introspection |
| **Security GQL-4..5** | Auth then TLS before mutations/subscriptions | Mirrors WS/Kafka; **`linkedProfileName` hint** supports GQL-4 profile steps |
| **Operations GQL-6..7** | Writes and subscriptions assume auth/TLS context | GQL-7 can reference auth handshake (Phase 2 `gql6-subscription-auth` in GQL-4) |
| **Productivity GQL-8..10** | Builder, persistence, export after core ops | Collections/history builds on execute patterns from GQL-1..7 |
| **Analysis GQL-11..13** | Tracing, schema drift, mock after daily-driver skills | Mock Server is desktop-only — late enough users understand live endpoint first |
| **Studio Power GQL-14..15** | **Multi-tab (14) before batch (15)** | Per-tab isolation before batch same-endpoint constraint |
| **Workflow GQL-16..19** | Designer → Runner → mutation → subscription chain | Clusters all workflow nodes; GQL-16 expands existing integration lesson |

**Do not reorder `graphqlLessons[]` without updating §3.1 and `graphql-smoke-e2e-alignment.test.ts`.** Registry sync to **§3.1** is ✅ complete as of 2026-06-21 (`graphql-lessons.ts` — 19 entries).

### 3.4 Legacy Demo Hub registry (historical — pre-2026-06-21)

> **Superseded:** Demo Hub now matches **§3.1**. Keep this table only when reading old commits, E2E smoke history, or migration notes.

| Legacy card | `id` | Title | Maps to §3.1 |
|-------------|------|-------|--------------|
| 1 | `gql-first-query` | Your First GraphQL Query | **GQL-1** (unchanged) |
| 2 | `gql-variables` | Variables & Arguments | **GQL-2** (unchanged) |
| 3 | `gql-mutations` | Mutations — Create, Update, Delete | **GQL-6** |
| 4 | `gql-schema-exploration` | Schema Exploration | **GQL-3** |
| 5 | `gql-subscriptions` | Subscriptions — Real-Time Data | **GQL-7** |
| 6 | `gql-auth-headers` | Authentication & Headers | **GQL-4** |
| 7 | `gql-query-builder` | Query Builder | **GQL-8** |
| 8 | `gql-collections-history` | Collections & History | **GQL-9** |
| 9 | `gql-export-share` | Export & Share Queries | **GQL-10** |
| 10 | `gql-performance-tracing` | Performance Tracing | **GQL-11** |
| 11 | `gql-workflow-integration` | Workflow Integration | **GQL-16** |
| 12 | `gql-schema-diff` | Schema Diff | **GQL-12** |
| 13 | `gql-mock-server` | Mock Server | **GQL-13** |

**Phase 3 action (✅ done 2026-06-21):** `graphqlLessons[]` in `graphql-lessons.ts` matches **§3.1** with all 19 lessons. Legacy smoke spec `e2e/demo-gql-mutations.spec.ts` still walks card 3 as mutations — canonical smoke uses GQL-3 schema spec + `graphql-lesson-smoke-helpers.ts`.

### 3.5 GQL-1 (`gql-first-query`) — enhancement status (2026-06-21)

**Overall: ✅ Enhancement complete** — reference lesson for authoring and spotlight patterns. **§11.0 demo tab wired** via `ensureGqlDemoTab` in `gqlFirstQuerySetup` / `gqlFirstQueryCleanup`.

| Area | Status | Detail |
|------|--------|--------|
| **Phase 1 spotlight** | ✅ | `gql1-execute` / `gql1-read-response` split shipped (§9.1) |
| **Phase 2 diagram** | ✅ | 700×430 studio chrome SVG; unit test asserts `viewBox="0 0 700 430"` |
| **Env manager helpers** | ✅ | `ensureDemoEnvironment` / `ensureDemoMicroservice`; named **GraphQL Demo** env |
| **Step count / estimate** | ✅ | 13 steps · 7 min (matches **§3.1**) |
| **Unit tests** | ✅ | `graphql-first-query.test.ts` — structure, preAction guards, diagram, spotlight |
| **Smoke E2E** | ✅ | `e2e/demo-gql-first-query.spec.ts` + drift guard in `graphql-smoke-e2e-alignment.test.ts` |
| **Studio endpoint persistence** | ✅ | `useGraphqlConnectionSettings` hydrate gate — URL survives navigation/refresh |
| **Loopback / corporate proxy** | ✅ | `loopbackUrl.ts` — `localhost`→`127.0.0.1`; Vite proxy + `httpClient` bypass |
| **Demo workspace isolation** | ✅ | **§11.0** — `ensureGqlDemoTab` / `closeGqlDemoTabs`; acceptance E2E proof pending |

**Shipped beyond original plan spec:**

| Step / feature | Notes |
|----------------|-------|
| `gql1-add-protocol` | Split EM: add GraphQL protocol tab (not in original single env-config step) |
| `gql1-env-config` | Configure endpoint on GraphQL tab |
| `gql1-header-select` | Header env/svc selection before Studio endpoint variable |
| `gql1-endpoint-resolved` | **↳ Resolved:** preview step |
| `gql1-response-metadata` | “GraphQL is Just HTTP” — Metadata tab tour |
| Concept diagram | Full chrome + 5-step legend + GraphQL vs REST callout |

**13 step IDs (current):** `gql1-intro` → `gql1-add-protocol` → `gql1-env-config` → `gql1-header-select` → `gql1-endpoint` → `gql1-endpoint-resolved` → `gql1-introspect` → `gql1-schema` → `gql1-write-query` → `gql1-execute` → `gql1-read-response` → `gql1-response-metadata` → `gql1-history`

**Deferred (non-blocking):**

| Item | When | Detail |
|------|------|--------|
| Narration cross-refs | Phase 3 registry sync | Steps may cite legacy card numbers — update to lesson **titles** or **§3.1** slots when syncing `graphql-lessons.ts` |
| Demo Hub 1× human pass | Phase 8 (optional) | Smoke E2E covers functional auto-play; formal human sign-off not required to start new lessons |
| **§11.0 demo tab migration** | ✅ | Shipped — see `gql-demo-tab.ts` |

**GQL-1 enhancement gaps:** §11.0 **acceptance E2E** only (content/spotlight/diagram complete).

---

### 3.6 GQL-2 (`gql-variables`) — enhancement status (2026-06-21)

**Overall: ✅ Enhancement complete** — reference alongside GQL-1. **§11.0 demo tab wired** via `gqlVariablesLessonSetup` / `gqlVariablesLessonCleanup`.

| Area | Status | Detail |
|------|--------|--------|
| **Phase 1 spotlight** | ✅ | Execute/read splits; History icon (`ACTIVITY_HISTORY`); metadata tab; per-step highlight ↔ description audit |
| **Variables metadata step** | ✅ | `gql2-vars-metadata` — Metadata tab shows `query` + `variables` in POST body |
| **Phase 2 diagram** | ✅ | 700×430 studio chrome SVG with Alice / Bob result columns; unit-tested |
| **History compare** | ✅ | Search, compare-mark, side-by-side variables/response diff |
| **Step count / estimate** | ✅ | 18 steps · 9 min (matches **§3.1**) |
| **Unit tests** | ✅ | `graphql-variables.test.ts` — structure, preAction guards, diagram, spotlight |
| **Drift guard** | ✅ | `graphql-smoke-e2e-alignment.test.ts` + `GQL2_LESSON.steps = 18` |
| **Smoke E2E** | 🔨 | `e2e/demo-gql-variables.spec.ts` shipped; full Playwright walk + human 1× pass pending |
| **Studio endpoint persistence** | ✅ | Same hydrate gate as GQL-1 (shared `useGraphqlConnectionSettings`) |
| **Demo workspace isolation** | ✅ | **§11.0** wired |

**Shipped beyond original 16-step registry:**

| Step / feature | Notes |
|----------------|-------|
| `gql2-read-alice` | Execute/read split for Alice (mirrors GQL-1 pattern) |
| `gql2-vars-metadata` | “Variables Travel in the POST Body” — injection-safety teaching moment |
| `gql2-read-bob` | Execute/read split for Bob; History intro moved here |
| Concept diagram | Full 700×430 chrome + Variables panel + Alice/Bob columns |
| Query anatomy diagram | `gql2-write-query` step diagram (signature / argument / selection set) |

**18 step IDs (current):** `gql2-intro` → `gql2-endpoint` → `gql2-endpoint-resolved` → `gql2-introspect` → `gql2-schema` → `gql2-write-query` → `gql2-open-vars` → `gql2-set-alice-vars` → `gql2-exec-alice` → `gql2-read-alice` → `gql2-vars-metadata` → `gql2-set-bob-vars` → `gql2-exec-bob` → `gql2-read-bob` → `gql2-history` → `gql2-history-search` → `gql2-history-compare-mark` → `gql2-history-compare`

**Deferred (non-blocking):**

| Item | When | Detail |
|------|------|--------|
| Narration cross-refs | Phase 3 registry sync | Intro references “Lesson 1” for EM seeding — update to lesson **titles** or **§3.1** slots when syncing registry |
| Demo Hub 1× human pass | Phase 8 (user) | User validates auto-play at 1× before calling E2E done |
| Standalone EM tour | Optional | `ensureGqlDemoHeaderContext` preAction covers GQL-1 dependency without full EM walk |
| **§11.0 demo tab migration** | ✅ | Same as GQL-1 |

**GQL-2 enhancement gaps:** Phase 8 human pass (optional for merge gate).

---

### 3.7 Master lesson status matrix (2026-06-22)

> **Legend:** **Enhancement complete** = GQL-1/GQL-2 quality bar (diagram, spotlight, preAction, WHY descriptions). **Authored** = lesson file + registry + unit tests shipped. **§11.0** = reserved demo tab (`ensureGqlDemoTab`) — **✅** for studio lessons GQL-1..15; **N/A** for workflow lessons GQL-16..19.

| Slot | `id` | Steps | Unit tests | 700×430 diagram | Smoke / demo E2E | Enhancement | §11.0 |
|------|------|-------|------------|-----------------|------------------|-------------|-------|
| GQL-1 | `gql-first-query` | 13 | ✅ | ✅ | ✅ `demo-gql-first-query` | ✅ **Complete** | ✅ |
| GQL-2 | `gql-variables` | 18 | ✅ | ✅ | ✅ `demo-gql-variables` | ✅ **Complete** | ✅ |
| GQL-3 | `gql-schema-exploration` | 8 | ✅ | ✅ | ✅ `demo-gql-schema-exploration` | 🔲 Pending | ✅ |
| GQL-4 | `gql-auth-headers` | 12 | ✅ | 🔨 audit | ✅ `demo-gql-auth-headers` | 🔲 Pending | ✅ |
| GQL-5 | `gql-https-tls` | **12** | ✅ | ✅ | ✅ `demo-gql-https-tls` | ✅ **Complete (7A+mTLS)** | ✅ |
| GQL-6 | `gql-mutations` | 15 | ✅ | 🔨 audit | 🔨 legacy card-3 spec | 🔲 Pending | ✅ |
| GQL-7 | `gql-subscriptions` | 12 | ✅ | 🔨 audit | ✅ `demo-gql-subscriptions` | 🔲 Pending | ✅ |
| GQL-8 | `gql-query-builder` | 10 | ✅ | 🔨 audit | ✅ `demo-gql-query-builder` | 🔲 Pending | ✅ |
| GQL-9 | `gql-collections-history` | 8 | ✅ | 🔨 audit | ✅ `demo-gql-collections-history` | 🔲 Pending | ✅ |
| GQL-10 | `gql-export-share` | 5 | ✅ | 🔨 audit | ✅ `demo-gql-export-share` | 🔲 Pending | ✅ |
| GQL-11 | `gql-performance-tracing` | 8 | ✅ | 🔨 audit | — | 🔲 Pending | ✅ |
| GQL-12 | `gql-schema-diff` | 7 | ✅ | 🔨 audit | — | 🔲 Pending | ✅ |
| GQL-13 | `gql-mock-server` | 10 | ✅ | 🔨 audit | — | 🔲 Pending | ✅ |
| GQL-14 | `gql-multi-tab` | 7 | ✅ | ✅ | — (`e2e/graphql-multi-tab` engineering only) | ✅ Authored | ✅ `tabBudget:2` |
| GQL-15 | `gql-batch-execution` | **9** | ✅ | 🔨 audit | — | ✅ Authored | ✅ `tabBudget:2` |
| GQL-16 | `gql-workflow-integration` | 10 | ✅ | 🔨 audit | — | 🔲 Pending | N/A |
| GQL-17 | `gql-workflow-runner` | 10 | ✅ | 🔨 audit | — | ✅ Authored | N/A |
| GQL-18 | `gql-workflow-mutation` | 8 | ✅ | 🔨 audit | — | ✅ Authored | N/A |
| GQL-19 | `gql-workflow-subscription` | 9 | ✅ | 🔨 audit | — | ✅ Authored | N/A |

**E2E notes (2026-06-22):**

| Spec | Covers |
|------|--------|
| `e2e/demo-gql-first-query.spec.ts` | GQL-1 full walk |
| `e2e/demo-gql-variables.spec.ts` | GQL-2 |
| `e2e/demo-gql-schema-exploration.spec.ts` | GQL-3 (canonical card 3) |
| `e2e/demo-gql-auth-headers.spec.ts` | GQL-4 |
| `e2e/demo-gql-https-tls.spec.ts` | GQL-5 (TLS Docker) |
| `e2e/demo-gql-mutations.spec.ts` | **Legacy** card-3-as-mutations walk — prefer canonical GQL-6 update |
| `e2e/demo-gql-subscriptions.spec.ts` | GQL-7 |
| `e2e/demo-gql-query-builder.spec.ts` | GQL-8 |
| `e2e/demo-gql-collections-history.spec.ts` | GQL-9 |
| `e2e/demo-gql-export-share.spec.ts` | GQL-10 |
| `e2e/graphql-lessons.spec.ts` | Smoke auto-play GQL-1..3 via `graphql-lesson-smoke-helpers.ts` |
| `e2e/graphql-multi-tab.spec.ts` | Engineering isolation (not Demo Hub GQL-14 lesson spec) |
| *(missing)* | GQL-11..13, GQL-14 demo, GQL-15 demo, GQL-16..19 demo |

**Priority queue after §11.0 engineering:**

1. **§11.0 acceptance E2E** — user workspace survives GQL-1; update `DEMO-LESSON-E2E-MEMO.md`.
2. Enhancement pass **GQL-3..13, GQL-16** (spotlight §9.1, diagram audit §6.1).
3. Phase 8 — Demo Hub 1× human pass for all 19; add demo E2E for GQL-14, GQL-15, workflow cluster.

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
| HTTPS / TLS encryption | ✅ `ws-tls` (public wss echo server) | ✅ `kafka-tls` (SASL+TLS, skip-cert) | ✅ **`gql-https-tls` (GQL-5) authored** — Docker `docker/graphql/tls/` |
| Skip certificate validation | ✅ `ws-tls` + `ws-tls-local` | ✅ `kafka-tls` | ✅ GQL-5 step `gqlt-skip-cert` |
| Custom CA / certificate chain | ✅ `ws-tls-local` Phase 2 | Partial | 🔨 GQL-5 CA beat — verify in Phase 8 |
| Mutual TLS (mTLS / client certs) | ✅ `ws-tls-local` Phase 3 | **❌ Absent** | ✅ GQL-5 steps `gqlt-mtls-*` · Docker **4445** / health **4446** |
| SASL / broker auth | N/A | ✅ `kafka-secure` (PLAIN, SCRAM-256, SCRAM-512) | N/A |
| Subscription auth over WebSocket | ✅ `ws-auth-transport` | N/A | **❌ GQL-7 Subscriptions has no auth step** — Phase 2 adds cross-ref in GQL-4 Auth |
| Security-specific Docker stack | ✅ `docker/websocket/` (TLS + mTLS) | ✅ `docker/kafka/secure/` + `docker/kafka/tls/` | ✅ `docker/graphql/tls/` (TLS + mTLS proxies, certs generated) |
| Auth profile hint in Studio UI | N/A | N/A | ✅ Phase 6F polish — `GraphqlAuthPopover` shows linked profile name |

### 4.2 Verdict

GraphQL's security curriculum today covers **credential injection** (Bearer + API Key) via **GQL-4** Auth and **transport security** via **GQL-5** (`gql-https-tls`, authored). Phase 8 validation pending. §11.0 demo isolation **shipped for GQL-1..15**. Basic Auth demo steps, subscription-channel auth, and OAuth remain open (Enhancement Phase 2 / deferred).

---

## 5. Issue Catalog — Specific Highlight/Spotlight Mismatches

### 5.1 Clear conflict (description noun ≠ spotlight target)

| Lesson | Step ID | Description says | highlight points to | Fix |
|--------|---------|-----------------|---------------------|-----|
| **GQL-6** Mutations | `gql3-write-delete` | "Load the **deleteUser mutation**" (editor action) | `GQL.VARS_PANEL` (variables panel) | 🔲 Split + `GQL.EDITOR` highlight (partially shipped — verify) |

### 5.2 Action/outcome conflation (trigger spotlighted; narration describes result)

| Lesson | Step ID | Spotlight | Narration emphasizes | Fix |
|--------|---------|-----------|----------------------|-----|
| GQL-1 First Query | `gql1-execute` | `GQL.EXECUTE_BTN` | Response tab + `"health": "ok"` body | ✅ Fixed — `gql1-read-response` shipped |
| GQL-2 Variables | `gql2-exec-bob` | `GQL.EXECUTE_BTN` | Bob response body + History intro | ✅ Fixed — `gql2-read-bob` shipped |
| **GQL-6** Mutations | create flow | various | execute + response conflation | 🔲 Split action/observe steps (create shipped; order/delete pending) |
| **GQL-6** Mutations | `gql3-idempotency` | `GQL.EXECUTE_BTN` | Second delete + `success: false` outcome | 🔲 Split observe step for `success: false` read |
| **GQL-7** Subscriptions | `gql5-intro` | `GQL.TAB_BAR` | Connection bar Subscribe + log panel | 🔲 Pending |
| `gql-subscriptions` | `gql5-write-sub` | `GQL.EDITOR` | Transport select before subscribe | 🔲 Pending |
| **GQL-11** Performance Tracing | `gql10-execute` | `GQL.EXECUTE_BTN` | Tracing badge outcome | 🔲 Pending |
| **GQL-16** Workflow Integration | `gql11-run-fail` | assert node | Split threshold vs observe | 🔲 Pending |
| GQL-13 Mock Server | mock steps | execute btn | response / latency / restore | 🔲 Pending |

### 5.3 Description density gaps in `gql-workflow-integration` (vs WS/Kafka workflow peers)

Step ids are `gql11-*` (frozen; see **§3.2** — card **GQL-16**, not prefix 16).

| Step ID | Current word count (approx) | Issue |
|---------|------------------------------|-------|
| `gql11-create` | ~30 words | No "watch for" framing, no empty-state callout, no palette overview (compare to WS workflow: 2–3× longer) |
| `gql11-query-node` | ~25 words | No explanation of *why* a GraphQL Query node exists vs a generic HTTP node |
| `gql11-assert-node` | ~25 words | No explanation of what GraphQL Assert does that a generic Assert cannot |
| `gql11-run-pass` | ~35 words | No Console tour, no mention of how to read execution output, no timing notes |

---

## 6. Concept Diagram Enhancement

**GQL-1:** ✅ Shipped — 700×430 studio chrome SVG (§3.5; unit-tested).

**GQL-2:** ✅ Shipped — 700×430 studio chrome SVG with Variables panel + Alice/Bob columns (§3.6; unit-tested).

**GQL-3..13:** 🔲 **Reimplementation pending** — upgrade every remaining lesson to the GQL-1/GQL-2 diagram + step-quality standard.

### 6.1 Diagram target matrix

| Lesson | Status | Current / target diagram style |
|--------|--------|--------------------------------|
| GQL-1 First Query | ✅ Shipped | **GraphQL Studio chrome**: connection bar, editor pane, right panel (Schema/Response tabs), bottom bar, 5-step flow legend |
| GQL-2 Variables | ✅ Shipped | **Studio chrome** with editor pane + Variables bottom panel; Alice / Bob result columns |
| GQL-3 Schema Exploration | 🔲 Pending | **Studio chrome** split: editor on left, Schema Explorer tree on right with type detail panel open |
| GQL-4 Auth & Headers | 🔲 Pending | **Studio chrome** with auth popover open, bearer input, header preview, HTTPS padlock on endpoint |
| GQL-5 HTTPS/TLS | ✅ Shipped | **Studio chrome** with TLS panel, skip-cert, CA + client cert fields, mTLS on 4445 |
| GQL-6 Mutations | 🔲 Pending | **Studio chrome** with M badge on tab, mutation in editor, returned id in response panel |
| GQL-7 Subscriptions | 🔲 Pending | **Studio chrome** with Subscribe button on connection bar, subscription log replacing response panel |
| GQL-8 Query Builder | 🔲 Pending | **Studio chrome** with Builder mode active, field tree on left, generated query on right |
| GQL-9 Collections & History | 🔲 Pending | **Studio chrome** with left activity bar (History + Collections icons highlighted), save dialog overlay |
| GQL-10 Export & Share | 🔲 Pending | **Studio chrome** showing Builder view + history context menu with cURL option |
| GQL-11 Perf Tracing | 🔲 Pending | **Studio chrome** with response panel showing Tracing tab, waterfall bars, histogram strip below |
| GQL-12 Schema Diff | 🔲 Pending | **Studio chrome** showing Schema Explorer with Changelog tab, diff modal overlay |
| GQL-13 Mock Server | 🔲 Pending | **Studio chrome** with Mock panel open on left, endpoint bar showing :3001/mock, mock response in result panel |
| GQL-16 Workflow Integration | 🔲 Pending | **Workflow Designer chrome**: canvas with 4 nodes wired, Quick Test button, green/red node state overlay |

### 6.2 SVG size standard

- **Width:** 700px viewBox  
- **Height:** 380–430px viewBox  
- **Style:** Painted chrome (rounded rects for panels, simulated tab bars, text labels for UI elements)  
- **Arrows:** Same `var(--primary)` marker style, sized and positioned over the chrome  
- **Data:** Include mocked field values (e.g. `"health": "ok"`, latency badges `~12ms`) to make diagrams feel real  

---

## 7. New Lessons & Expansions

Sections ordered by **§3.1 card number** for easy navigation. Step IDs in **new** lessons use `gqlN-*` where N = card slot. Step IDs in **existing** lessons keep frozen prefixes (**§3.2**).

---

### 7.1 GQL-4 (expanded): Authentication & Headers — Basic Auth + Subscription Auth

The existing `gql-auth-headers` lesson (7 steps → **10** after expansion) needs two additions.  
**Step ids stay `gql6-*`** — the lesson file is `graphql-auth-headers.ts` and step IDs are frozen regardless of card reorder.

**Addition A — Basic Auth demo steps (currently in concept body only):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql6-basic` | Basic Auth | Open Auth popover → select **Basic**. Enter username `demo` / password `demo-pass`. Preview shows `Authorization: Basic ZGVtbzpkZW1vLXBhc3M=`. Note: credentials are only base64-encoded, not encrypted — HTTPS (GQL-5) protects them in transit. |
| `gql6-basic-exec` | Execute with Basic Auth | Execute → Metadata tab → confirm `Authorization: Basic …`. Compare encoding to Bearer — same header name, different scheme. |

**Addition B — Subscription channel auth cross-reference:**

Add final step `gql6-subscription-auth`:

> **Subscriptions and Auth:** Bearer / API Key / Basic configured here automatically includes the credential in the WebSocket handshake when you subscribe. GQL-7 Subscriptions shows this in action — you don't need separate auth for the subscription channel.

**preAction:** No state dependency beyond the lesson's existing setup (endpoint configured, introspected).

---

### 7.2 GQL-5 (new): HTTPS, TLS & Certificates *(HIGH PRIORITY — Security)*

**ID:** `gql-https-tls`  
**Final card:** **GQL-5**  
**Estimated minutes:** **8**  
**Position:** Slot **5** — security arc, immediately after `gql-auth-headers` (GQL-4)  
**Docker:** Yes — `docker/graphql/tls/` stack (TLS + mTLS compose files)  
**dockerEndpoint:** `http://127.0.0.1:4444/health` (legacy single-probe field)  
**dockerEndpoints:** `[http://127.0.0.1:4444/health, http://127.0.0.1:4446/health]` — **both** required  
**dockerCommand:** `cd docker/graphql/tls && ./generate-cert.sh && ./generate-client-cert.sh && docker compose up -d && docker compose -f docker-compose.mtls.yml up -d`  
**tag:** `🐳 Docker`  
**Analogy:** `ws-tls-local` (3-phase TLS lab: skip-cert → CA cert → mTLS)  
**Status:** ✅ **Shipped (2026-06-22)** — 12 steps; studio TLS proxy; demo E2E shell; Phase 8 human pass pending

**Port map:**

| Port | Purpose |
|------|---------|
| `4443` | HTTPS / WSS — TLS proxy (Phase 1 + Phase 2) |
| `4444` | HTTP — Health probe for PrerequisiteGate (Phase 1 + Phase 2) |
| `4445` | HTTPS / WSS — mTLS proxy (Phase 3) |
| `4446` | HTTP — Health probe for mTLS stack (Phase 3) |
| `4010` | Plain HTTP GraphQL — restore step |

**Cert constants** (`lesson-https-tls.ts` — embedded PEMs match `docker/graphql/tls/certs/*`):
```
CA cert:     GQL_TLS_CA_CERT
Client cert: GQL_TLS_CLIENT_CERT
Client key:  GQL_TLS_CLIENT_KEY
```

**Shipped steps (12 — prefix `gqlt-*`):**

| Step ID | Title | Phase |
|---------|-------|-------|
| `gqlt-intro` | HTTPS for GraphQL | Intro |
| `gqlt-endpoint` | Set HTTPS Endpoint | Setup |
| `gqlt-tls-panel` | TLS Configuration Panel | UI tour |
| `gqlt-skip-cert` | Skip Certificate Validation | Phase 1 |
| `gqlt-connect-skip` | Introspect Over TLS (Phase 1) | Phase 1 |
| `gqlt-auth-tls` | Credentials Over TLS | Auth + TLS |
| `gqlt-ca-cert` | Custom CA Certificate | Phase 2 |
| `gqlt-connect-ca` | Introspect with CA Validation | Phase 2 |
| `gqlt-mtls-intro` | Mutual TLS (mTLS) | Phase 3 intro |
| `gqlt-mtls-creds` | Client Certificate & Key | Phase 3 |
| `gqlt-mtls-connect` | Connect with mTLS | Phase 3 |
| `gqlt-restore` | Restore to Plain HTTP | Cleanup |

**E2E:** `e2e/demo-gql-https-tls.spec.ts` — shell test (step count) always runs; full auto-play requires TLS + mTLS + plain GraphQL Docker.

**Product files:** `src/shared/types/gqlTls.ts`, `src-server/routes/graphql/tlsAgent.ts`, `GraphqlTlsPanel.tsx`, `tabPersistence.ts` (`gql_tls_certs_v1`).

---

### 7.3 GQL-14 (new): Multi-Tab Workspaces *(HIGH PRIORITY — Phase 6 capstone)*

**ID:** `gql-multi-tab`  
**Final card:** **GQL-14**  
**Estimated minutes:** 4  
**Docker:** GraphQL test server (4010) — same as fundamentals  
**Position:** Slot **14** — Studio Power arc, immediately before GQL-15 Batch  
**Engineering:** ✅ Phase 6A–6F complete; E2E patterns in `e2e/graphql-multi-tab.spec.ts`  
**Step prefix:** `gql14-*`  

Full step spec, `preAction` table, selectors, and helper exports: **§11.1**.

**Why it matters:** Phase 6 shipped per-tab endpoint isolation, per-tab schema, per-tab response cache, profile-linked tabs, and per-tab polling. No lesson demonstrates these capabilities. GQL-14 is the natural capstone — learners already know single-tab Studio from GQL-1..13 and are ready to see independent workspaces.

**Product note:** Auth profile hint (`linkedProfileName` in auth popover, shipped Phase 6F polish) supports optional GQL-14 profile-linked tab beats.

---

### 7.4 GQL-15 (new): Batch Execution *(MEDIUM — after GQL-14)*

**ID:** `gql-batch-execution`  
**Final card:** **GQL-15**  
**Estimated minutes:** 3  
**Docker:** same GraphQL test server (4010)  
**Position:** Slot **15** — Studio Power arc, immediately after `gql-multi-tab` (GQL-14)  
**Step prefix:** `gql15-*`  

**Why it matters:** Batch execution sends multiple operations in one HTTP request — but only works when all checked tabs share the **same** endpoint. Learners who just completed GQL-14 (per-tab isolation) understand endpoint overrides and will immediately grasp why batch requires endpoint parity.

**Proposed steps (6 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql15-intro` | What is Batch Execution? | Explain batched GraphQL: multiple operations → one HTTP array request → one response array. Show when to use it (integration tests, dashboard pre-fetch) vs when not to (mutations with side-effects). |
| `gql15-add-tab` | Add a Second Tab | Click **+**. Write a different query in each tab. **Important:** both tabs must share the same endpoint — if they point at different URLs, **Batch Execute** stays disabled. Cross-reference GQL-14 for cross-endpoint workflows. |
| `gql15-batch-run` | Batch Execute | Click **Batch Execute**. Both operations are sent as a JSON array in one request to the shared endpoint. |
| `gql15-batch-results` | Batch Results Panel | Spotlight `GQL.BATCH_RESULTS`. Each operation result is a numbered entry — the order matches the checked-tab order. |
| `gql15-partial-error` | Partial Error Handling | Set one query to return an error intentionally. Batch doesn't fail-fast — both results arrive; one has `errors`, the other has `data`. |
| `gql15-export-batch` | Export Batch Results | Export all results as a single JSON. Useful for CI regression snapshots. |

**Endpoint parity note** (§11.2): `gql15-add-tab` and `gql15-batch-run` must explicitly mention that batch requires the same endpoint — learners coming from GQL-14 will already know per-tab isolation.

---

### 7.5 GQL-17 (new): GraphQL Workflow Runner & Results *(HIGH PRIORITY — Workflow)*

**ID:** `gql-workflow-runner`  
**Final card:** **GQL-17**  
**Estimated minutes:** 5  
**initialTab:** `workflow-runner`  
**allowedTabs:** `['workflow', 'workflow-runner']`  
**Docker:** same GraphQL test server  
**Analogy:** `ws-test-runner`, `kafka-test-runner`  
**Position:** Slot **17** — immediately after `gql-workflow-integration` (GQL-16)  
**Step prefix:** `gql17-*`

**Why it matters:** GQL-16 (Workflow Integration) only shows Quick Test in the Designer. No lesson shows how to take a GraphQL workflow into the Workflow Runner for load testing, inspect Results Dashboard node-level aggregates, or drill into Results Explorer.

**Proposed steps (10 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql17-open-runner` | Open Workflow Runner | Navigate to Workflow Runner, select the "GraphQL Latency Check" workflow from **GQL-16**. Explain Run vs Quick Test: Quick Test is for single-iteration debugging; Runner is for load, concurrency, and results analysis. |
| `gql17-runner-variables` | Runtime Variable Overrides | Show the variable override panel — change the endpoint variable at run time without editing the workflow definition. Explain this mirrors the `wf-runner-variable` step in `ws-workflow-builder`. |
| `gql17-config-run` | Configure the Run | Set iterations: 10, concurrency: 2, think time: 200ms. Explain what each parameter controls and why concurrency matters for GraphQL (connection pooling vs parallel queries). |
| `gql17-start-run` | Start the Run | Click Run. Watch the node execution counter increment. Highlight the live progress bar and per-node iteration tracker. |
| `gql17-results-dashboard` | Results Dashboard — Overview | Navigate to Results after run completes. Explain throughput cards (req/s, p50, p95, error rate). Highlight how GraphQL latency values map to the tracing data seen in **GQL-11 Performance Tracing**. |
| `gql17-node-filter` | Filter by Node | Use the Workflow Runs filter to select "GraphQL Query" node only. Observe how the histogram changes. |
| `gql17-results-explorer` | Open Results Explorer | Click the Results Explorer modal. Show the three-panel layout: canvas, detail panel, iteration matrix. |
| `gql17-canvas-overlay` | Execution State Overlay | Hover a node in the canvas — popover shows per-node latency, pass/fail counts across all iterations. |
| `gql17-bottleneck` | Bottleneck Identification | Sort nodes by P95 latency. The GraphQL Query node should be the only non-trivial node. |
| `gql17-export-results` | Export Results | Export run results as JSON. Explain how CI can consume this for threshold assertions. |

---

### 7.6 GQL-18 (new): GraphQL Mutation Node in Workflow *(MEDIUM PRIORITY)*

**ID:** `gql-workflow-mutation`  
**Final card:** **GQL-18**  
**Estimated minutes:** 4  
**initialTab:** `workflow`  
**Docker:** same GraphQL test server  
**Analogy:** `kafka-workflow-produce`  
**Position:** Slot **18** — after GQL-17 (Workflow Runner)  
**Step prefix:** `gql18-*`

**Why it matters:** GQL-16 only uses a GraphQL Query node. There is no lesson showing how to chain mutations (create data) then read-back queries (verify the created data) in a workflow — a very common integration-test pattern.

**Proposed steps (8 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql18-intro` | GraphQL Mutation Node | Explain the Mutation node's purpose: write data, bind returned fields as variables for downstream nodes. Prerequisite: **GQL-16**. Analogous to Kafka's produce node. |
| `gql18-canvas-tour` | The Mutation Workflow | Pre-built canvas: Start → GQL Mutation → GQL Query → GQL Assert → End. Tour each node type and explain the data flow direction. |
| `gql18-config-mutation` | Configure the Mutation | Set endpoint, paste createUser mutation text, set variables JSON with `{{testName}}` template variable. |
| `gql18-output-binding` | Bind the Returned ID | Output tab: bind `data.createUser.id` → `createdUserId`. Explain this is analogous to the Kafka produce output binding. |
| `gql18-config-query` | Read Back the Created User | Wire `createdUserId` into a `user(id: $createdUserId)` query to verify the server persisted the mutation. |
| `gql18-assert` | Assert the User Exists | Assert node: JSONPath `$.user.name`, operator `equals`, expected `{{testName}}`. Show how the variable flows mutation → query → assert. |
| `gql18-quick-test` | Quick Test the Chain | Quick Test — three nodes light green in sequence. Console shows mutation request, query request, assert pass. |
| `gql18-cleanup` | Teardown with deleteUser | Add a GQL Mutation node after assert for deleteUser, wiring `createdUserId`. Explain teardown patterns for integration tests. |

---

### 7.7 GQL-19 (new): GraphQL Subscription Node in Workflow *(MEDIUM PRIORITY)*

**ID:** `gql-workflow-subscription`  
**Final card:** **GQL-19**  
**Estimated minutes:** 5  
**initialTab:** `workflow`  
**Docker:** same GraphQL test server  
**Analogy:** `kafka-workflow-consume-wait`  
**Position:** Slot **19** — after GQL-18 (Mutation in Workflow)  
**Step prefix:** `gql19-*`

**Why it matters:** The Kafka consume-wait pattern maps directly to GraphQL subscriptions in workflow context: trigger a mutation, wait for the subscription to emit the resulting event, assert the event payload. This is the most powerful real-time testing pattern and has no GraphQL lesson.

**Proposed steps (9 steps):**

| Step ID | Title | Description focus |
|---------|-------|-------------------|
| `gql19-intro` | GraphQL Subscription Node | Explain event-driven testing: trigger an action, wait for the system to emit the corresponding event. Analogy: Kafka consume-wait. |
| `gql19-canvas-tour` | Seeded Canvas Tour | Pre-built canvas: Start → GQL Mutation (createOrder) → GQL Subscription (orderStatus) → GQL Assert → End. |
| `gql19-config-sub` | Configure the Subscription Node | Set endpoint, paste `subscription { orderStatus(orderId: $orderId) { status } }`, bind `orderId` from mutation output. |
| `gql19-timeout` | Subscription Timeout | Explain the timeout field: how long the node waits before failing if no matching event arrives. Contrast with Kafka's `maxWaitMs`. |
| `gql19-correlation` | Correlation Expression | Show how the subscription node waits for a *specific* event (matching `orderId`) rather than the first event. Compare to Kafka wait-for-correlation. |
| `gql19-sample-payload` | Sample Payload for Quick Test | Set a sample event payload so Quick Test can simulate a matching event without a live WebSocket stream. Anti-hang pattern from Kafka lessons. |
| `gql19-quick-test` | Quick Test | Run Quick Test — mutation fires, subscription node receives simulated COMPLETE event, assert passes. Console shows the full chain. |
| `gql19-load-behavior` | Load Test Behavior | Explain auto-resume vs wait-for-real-event. In load tests, each iteration must get its own subscription event (not shared across concurrent users). |
| `gql19-summary` | Summary | Recap the create → subscribe → assert → close pattern. Tease cross-protocol workflows (HTTP trigger + GQL subscription wait). |

---

## 8. Environment & Microservice Creation in Demo Steps

### 8.1 Current behavior (2026-06-20)

**GQL-1 (`gql-first-query`) already uses** `ensureDemoEnvironment` / `ensureDemoMicroservice` with `GQL_DEMO_ENV_NAME` / `GQL_DEMO_SVC_NAME` via `configureNamedGraphqlEndpoint`. The helpers in `env-manager-lesson-helpers.ts` are **shipped and tested**.

Remaining gap for **TLS lesson (GQL-5)**: ensure the TLS lesson's env-config steps follow the same named-env pattern and include the **400 ms repaint tick** after navigating to Environment Manager (see §8.4).

Legacy note — lessons that still call anonymous `configureProtocolEndpointInEnvManager` without names should migrate to the named-env pattern when touched.

### 8.2 Required behavior

Every lesson that configures environment endpoints **must**:

1. **Create a dedicated environment** named `"GraphQL Demo"` (if not already present)
2. **Create a dedicated microservice** named `"graphql-demo"` (if not already present)
3. **Select that environment and microservice** before configuring the protocol endpoint
4. **Keep the demo step modal visible** — the lesson's spotlight overlay must remain rendered and positioned during the env manager navigation

### 8.3 Implementation plan for `env-manager-lesson-helpers.ts`

**Status: ✅ DONE (2026-06-20)**

Shipped helpers:

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

### 9.1 Priority 1 — Fix spotlight mismatches

| File | Step(s) | Change | Status |
|------|---------|--------|--------|
| `graphql-first-query.ts` | `gql1-execute` | Add `gql1-read-response` on `GQL.RESPONSE_BODY` | ✅ |
| `graphql-variables.ts` | `gql2-exec-bob` | Add `gql2-read-bob` on `GQL.RESPONSE_DATA_USER` | ✅ |
| `graphql-variables.ts` | (after read-alice) | Add `gql2-vars-metadata` on `GQL.RV_TAB_METADATA` | ✅ |
| `graphql-mutations.ts` | `gql3-write-delete` | `GQL.EDITOR` + separate `gql3-wire-delete-var` on `GQL.VARS_PANEL` | 🔨 Partially shipped — verify + order/delete observe splits |
| `graphql-mutations.ts` | create flow | Split: `gql3-set-create-vars` / `gql3-exec-create` / `gql3-observe-create` | ✅ Shipped (**GQL-6**) |
| `graphql-mutations.ts` | order flow | Split: `gql3-write-order-mutation` / `gql3-set-order-vars` / `gql3-exec-order` + observe | ✅ `gql3-observe-order` shipped (**GQL-6**, 16 steps) |
| `graphql-subscriptions.ts` | `gql5-intro` | Expand or add step on `GQL.CONNECTION_BAR` | 🔲 **GQL-7** |
| `graphql-subscriptions.ts` | `gql5-write-sub` | Add `GQL.TRANSPORT_SELECT` step before subscribe | 🔲 |
| `graphql-performance-tracing.ts` | `gql10-execute` | Add `gql10-tracing-badge` on `GQL.RV_TRACING_BADGE` | 🔲 |
| `graphql-workflow-integration.ts` | `gql11-run-fail` | Split: tighten-threshold + observe-failure | 🔲 |
| `graphql-mock-server.ts` | mock steps | Add observe-response / latency / restore splits | 🔲 |

### 9.2 Priority 2 — Description depth upgrades for `gql-workflow-integration` (**GQL-16**)

Step ids stay `gql11-*` (frozen; see naming convention at top).

| Step | Upgrade notes |
|------|---------------|
| `gql11-create` | Add: "A blank workflow opens with Start and End nodes pre-placed. The **Blocks Palette** on the left organizes node types into Actions, Logic, and Triggers — GraphQL nodes live in Actions." |
| `gql11-query-node` | Add: "The **GraphQL Query** node is purpose-built for introspection-aware execution — it understands operation type (Q/M/S) and exposes per-field latency in its output bindings, unlike a generic HTTP node." |
| `gql11-config-query` | Add: "The **Output** tab is the GraphQL Query node's superpower — bind `latencyMs`, `responseBody`, `errorCount`, or any extracted JSONPath value to a named workflow variable available in every downstream node." |
| `gql11-assert-node` | Add: "The **GraphQL Assert** node evaluates arbitrary conditions against upstream variables. Unlike a generic Assert, it shows the original GraphQL operation that produced the value, making failures easier to triage." |
| `gql11-run-pass` | Add: "Open the **Console** before clicking Quick Test — it streams per-node execution logs in real time. After the run, green nodes show execution time in the badge; click a node to see its full input/output." |

### 9.3 Priority 3 — Add Console and Debug steps to `gql-workflow-integration` (**GQL-16**)

Step ids stay `gql11-*`. New steps appended to the existing lesson (8 + 2 = 10 steps → 4 min target, see §9.5).

**New step `gql11-console`** (insert between `gql11-assert-rule` and `gql11-run-pass`):
- Title: "Open the Console Before Running"  
- highlight: `WF.CONSOLE_BADGE`  
- Description: Click the **Console** badge to expand the execution log panel. Open it *before* Quick Test so you can watch each node's request and response stream in real time.

**New step `gql11-debug-mode`** (insert after `gql11-run-fail`):
- Title: "Step Through with Debug Mode"  
- highlight: `WF.DEBUG_BTN`  
- Description: Instead of Quick Test, click the **Debug** button. The workflow pauses after each node — inspect intermediate variable values before advancing. Useful for diagnosing assertion failures node by node.

### 9.4 Priority 4 — Add Basic Auth steps and subscription auth callout to `gql-auth-headers` (**GQL-4**)

Step ids stay `gql6-*` (frozen). Full spec in §7.1.

Add two steps after `gql6-execute-apikey`:
- `gql6-basic` — Open Auth popover → select Basic → enter username/password → preview header
- `gql6-basic-exec` — Execute + Metadata tab confirms `Authorization: Basic …`

Add a final step `gql6-subscription-auth` bridging to **GQL-7 Subscriptions** (do NOT rename to `gql4-*`).

### 9.5 Priority 5 — `estimatedMinutes` accuracy (**§3.1** targets)

> **GQL-1 (§3.5) and GQL-2 (§3.6)** have locked counts. All other rows follow **§3.1** canonical roster.

| Card | `id` | Steps | Est. | Status |
|------|------|-------|------|--------|
| GQL-1 | `gql-first-query` | 13 | 7 min | ✅ **Locked (§3.5)** |
| GQL-2 | `gql-variables` | 18 | 9 min | ✅ **Locked (§3.6)** |
| GQL-3 | `gql-schema-exploration` | **9** | 4 min | 🔨 Enhancement partial (exec/read split) |
| GQL-4 | `gql-auth-headers` | 12 | 6 min | 🔲 Enhancement pending |
| GQL-5 | `gql-https-tls` | **12** | **8 min** | ✅ Shipped (7A + mTLS) · full Docker E2E ✅ |
| GQL-6 | `gql-mutations` | **16** | **8 min** | 🔨 Enhancement partial (`gql3-observe-order`) |
| GQL-7 | `gql-subscriptions` | 10→12 | 5 min | 🔲 Enhancement pending |
| GQL-8 | `gql-query-builder` | 10 | 4 min | 🔲 Enhancement pending |
| GQL-9 | `gql-collections-history` | 8 | 4 min | 🔲 Enhancement pending |
| GQL-10 | `gql-export-share` | 5 | 3 min | 🔲 Enhancement pending |
| GQL-11 | `gql-performance-tracing` | 7→8 | 4 min | 🔲 Enhancement pending |
| GQL-12 | `gql-schema-diff` | 7 | 3 min | 🔲 Enhancement pending |
| GQL-13 | `gql-mock-server` | 7→10 | 5 min | 🔲 Enhancement pending |
| GQL-14 | `gql-multi-tab` | **9** | 5 min | ✅ Authored · 7C profiles+polling · demo E2E ✅ |
| GQL-15 | `gql-batch-execution` | **9** | 4 min | ✅ Authored · demo E2E ✅ |
| GQL-16 | `gql-workflow-integration` | **10** | 5 min | ✅ Enhancement complete (§9.2–9.3) |
| GQL-17–19 | workflow new | 10 / 8 / 9 | 5 / 4 / 5 min | 🔲 New |

**Total curriculum time (19-lesson roster):** ~89 min. See **§3.1**.

---

## 10. Implementation Checklist

### Phase 1: Spotlight Fixes
*Apply during GQL-3..13 **reimplementation** (GQL-1 ✅ §3.5; GQL-2 ✅ §3.6)*  
**Status:** 🔨 Pending for GQL-3..13 — **GQL-1 & GQL-2** marked done

- [x] **GQL-1:** Add `gql1-read-response` step after `gql1-execute`
- [x] **GQL-2:** Add `gql2-read-bob` step after `gql2-exec-bob`
- [x] **GQL-2:** Add `gql2-vars-metadata` step after `gql2-read-alice`
- [ ] **GQL-6:** Verify `gql3-write-delete` + `gql3-wire-delete-var` spotlight alignment
- [ ] **GQL-6:** Add observe steps for order, delete, and idempotency reads
- [ ] **GQL-7:** Add `gql5-connection-bar` intro step or expand `gql5-intro`
- [ ] **GQL-7:** Add `gql5-transport-select` step
- [ ] **GQL-11:** Add `gql10-tracing-badge` step
- [ ] **GQL-16:** Split `gql11-run-fail` into 2 steps
- [ ] Add `gql13-observe-mock-response` step
- [ ] Add `gql13-observe-latency-effect` step
- [ ] Split `gql13-restore-live` into 2 steps
- [ ] Update all affected test files (step count, IDs, estimatedMinutes)
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run` on touched test files → zero failures

### Phase 2: Description Depth + Diagram Upgrades
*Estimated effort: part of GQL-3..13 **reimplementation** pass*
**Status:** 🔨 Pending — **GQL-1 diagram ✅** (§3.5); **GQL-2 diagram ✅** (§3.6); GQL-3..13 not started

- [x] Expand **GQL-16** step descriptions (5 steps)
- [x] Add `gql11-console` step
- [x] Add `gql11-debug-mode` step
- [ ] Add Basic Auth steps to `gql-auth-headers` (`gql6-basic`, `gql6-basic-exec`, `gql6-subscription-auth`) — spec §7.1 (**GQL-4**)
- [ ] Upgrade `estimatedMinutes` on all affected lessons (see §9.5)
- [x] Upgrade concept diagram — **GQL-2** to 700×430 studio chrome SVG (§3.6)
- [ ] Upgrade concept diagrams — **GQL-3..13** to 700×430 studio chrome SVG (during reimplementation)
  - [x] **GQL-1** ✅ (§3.5 — reference implementation)
  - [x] **GQL-2** ✅ (§3.6)
  - [ ] GQL-3, GQL-4, GQL-5, GQL-6
  - [ ] GQL-7, GQL-8, GQL-9, GQL-10, GQL-11, GQL-12, GQL-13
- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] `npx vitest run` on touched test files → zero failures

### Phase 3: Registry sync (Demo Hub order → §3.1)
*Estimated effort: 1 hour — registry-only change*  
**Status:** ✅ **Complete (2026-06-21)** — `graphql-lessons.ts` lists all 19 lessons in **§3.1** order

- [x] Update `graphql-lessons.ts` array to **§3.1** canonical order
- [ ] Update in-lesson cross-references to use **lesson titles** or **§3.1** card numbers (not legacy order from §3.4) — spot-check during enhancement pass
- [ ] **GQL-1:** update narration cross-refs in steps that cite legacy lesson numbers
- [ ] Update legacy E2E `demo-gql-mutations.spec.ts` to align with GQL-3-as-card-3 or deprecate
- [x] `graphql-lessons.test.ts` asserts registry count

### Phase 4: New Security Lesson (GQL-5 HTTPS/TLS)
*Status:* ✅ **Complete (2026-06-22)** — lesson + studio TLS product; Phase 8 human validation pending

**Docker infrastructure (✅ DONE):**
- [x] `docker/graphql/tls/` — TLS (4443/4444) + mTLS (4445/4446) compose files, cert scripts, nginx configs, README

**Lesson implementation (✅ DONE — 12 steps):**
- [x] `graphql-lesson-helpers/lesson-https-tls.ts` — endpoints, embedded PEMs, `GQL_TLS_DOCKER_HEALTH_PROBES`
- [x] `graphql-https-tls.ts` (12 steps, prefix `gqlt-*`, mTLS phase)
- [x] `graphql-https-tls.test.ts`
- [x] Registered at **GQL-5** in `graphql-lessons.ts`
- [x] **§11.0** demo tab migration
- [x] `e2e/demo-gql-https-tls.spec.ts` — shell ✅; full Docker walk (environmental)
- [ ] Phase 8 visual validation Web + Tauri

**Studio TLS product (✅ DONE — 2026-06-22):**
- [x] `src/shared/types/gqlTls.ts` — settings, proxy serialization, APQ POST routing helpers
- [x] `src-server/routes/graphql/tlsAgent.ts` — `buildGraphqlTlsAgent`, `tlsAgentForEndpoint`
- [x] `routeTlsQueryGuards.ts` — reject PEM on GET query strings
- [x] TLS on query/batch/subscribe/SSE/upload routes; `sseRouteHandler.ts` extracted
- [x] `GraphqlTlsPanel.tsx` + connection bar wiring; page PEM persistence `gql_tls_certs_v1`
- [x] `gqlFetch` / Tauri proxy paths; `gqlUpload` mTLS via `x-gql-tls-config`
- [x] `PrerequisiteGate` multi-endpoint (`dockerEndpoints`) for dual Docker health

### Phase 5: New Workflow + Batch Lessons (GQL-15–19)
*Estimated effort: 8–12 hours*  
**Status:** ✅ **Lessons authored (2026-06-21)** — GQL-14, GQL-15, GQL-17, GQL-18, GQL-19 shipped with unit tests; GQL-16 expansion + Phase 8 pending

- [x] Create `graphql-multi-tab.ts` (GQL-14) — **also tracked in Phase 7B**
- [x] Create `graphql-batch-execution.ts` (GQL-15, 6 steps)
  - [x] Step ids `gql15-*`; endpoint-parity copy in add-tab + batch-run (§11.2)
  - [x] Helper: `lesson15-batch-execution.ts`
  - [x] Test: `graphql-batch-execution.test.ts`
- [x] Create `graphql-workflow-runner.ts` (GQL-17, 10 steps)
  - [x] Helper: `lesson17-workflow-runner.ts`
  - [x] Test: `graphql-workflow-runner.test.ts`
- [x] Create `graphql-workflow-mutation.ts` (GQL-18, 8 steps)
  - [x] Helper: `lesson18-workflow-mutation.ts` (or inline helpers)
  - [x] Test: `graphql-workflow-mutation.test.ts`
- [x] Create `graphql-workflow-subscription.ts` (GQL-19, 9 steps)
  - [x] Helper: `lesson19-workflow-subscription.ts`
  - [x] Test: `graphql-workflow-subscription.test.ts`
- [ ] Expand `graphql-workflow-integration.ts` (GQL-16) per §9.2–9.3
- [x] All lessons in `graphql-lessons.ts` in **§3.1** order
- [ ] **§11.0** demo tab migration for all new lessons
- [ ] Phase 8 visual validation

### Phase 7: Demo Teaching Track (GQL-5 TLS + GQL-14 Multi-Tab + optional 6F extensions)

**Status:** 🔨 **7-pre ✅ · 7A ✅ (mTLS) · 7B ✅ authored** — Phase 8 + §11.0 acceptance E2E remain

**Prerequisite (engineering — all ✅):** Phase 6A–6F, TLS Docker, studio TLS proxy, multi-tab selectors, §11.0 demo tab.

**Prerequisite (demo — 🔲):** §11.0 **acceptance E2E**; Phase 8 human validation.

#### 7-pre — Demo workspace isolation (§11.0) — ✅ Complete (2026-06-22)

- [x] `GqlStudioTab.demoLessonId`, `gql-demo-tab.ts`, `tabBudget`, PrerequisiteGate tab-capacity + **`dockerEndpoints[]`**
- [x] Migrated GQL-1..15 setup/cleanup
- [ ] §11.0 acceptance E2E + `e2e/DEMO-LESSON-E2E-MEMO.md` update

#### 7A — GQL-5 HTTPS, TLS & Certificates — ✅ Complete (2026-06-22)

- [x] `lesson-https-tls.ts` + `graphql-https-tls.ts` (**12 steps**, mTLS on 4445)
- [x] Studio TLS product (see Phase 4 product checklist)
- [x] `demo-gql-https-tls.spec.ts`
- [ ] Phase 8 visual validation Web + Tauri

#### 7B — GQL-14 Multi-Tab Workspaces — ✅ Authored (2026-06-21)

- [x] `tabBudget: 2`, `graphql-multi-tab.ts`, unit tests, registry slot 14, §11.0
- [ ] `demo-gql-multi-tab.spec.ts`
- [ ] Phase 8 visual validation

#### 7C — Optional 6F extensions in GQL-14 *(P2 — after 7B ships)* — ✅ Shipped (2026-06-22)

Optional extra steps in `gql-multi-tab` (profile-linked tabs + per-tab polling beat):

- [x] Tab 1 → Staging profile, Tab 2 → Prod; **`linkedProfileName` hint** visible in auth popover (`gql14-profiles`)
- [x] Per-tab polling toggle — Tab 1 on, Tab 2 off (`gql14-polling`)
- [x] Helpers: `ensureTabProfileLink`, `ensureTabPolling` (aliases in `lesson14-multi-tab.ts`)

#### 7D — GQL-15 Batch endpoint-parity copy — ✅ Authored (lesson shipped)

- [x] GQL-15 batch lesson includes endpoint-parity copy in `gql15-add-tab` / `gql15-batch-run` (§7.4, §11.2)
- [ ] **§11.0** + Phase 8 validation

**Shared exit criteria:**

- [ ] `npx tsc -b --noEmit` → zero errors
- [ ] New lesson files covered by unit tests per demo-player rules §8

**Out of scope for Phase 7:** E2E demo step-through spec (engineering E2E already covers isolation in 6B-4 / 6F-13); new GraphQL Studio engineering.

### Phase 8: Visual Validation
*Per demo-player authoring rules §10 — required before merge*

**Status:** 🔨 Partial — **GQL-1:** smoke E2E ✅. **GQL-2:** code complete; Demo Hub human pass + E2E re-run pending user validation. **GQL-3..13:** after reimplementation.

- [x] **GQL-1** — smoke E2E auto-play (`e2e/demo-gql-first-query.spec.ts`, `graphql-lessons.spec.ts`)
- [ ] **GQL-1 (optional)** — Demo Hub 1× human pass for spotlight/narration sign-off
- [ ] Open Demo Hub → GraphQL category
- [ ] Run each modified lesson at 1× speed end-to-end
- [ ] Verify spotlight matches what narration says to watch on every step
- [ ] Click Next rapidly through every lesson — confirm `preAction` guards recover
- [ ] Verify 700×430 diagrams render in both light and dark theme
- [ ] Verify new Docker stacks start cleanly with documented `docker compose up -d`
- [ ] Test TLS lesson on both Web (Node proxy) and Tauri desktop (native)
- [ ] Verify `estimatedMinutes` on lesson cards matches updated values

---

## 11. Per-Tab Endpoint Isolation — Demo Lessons

> **Engineering plan:** Full architecture, implementation phases (PT-1 through PT-12), design decisions, and task list are in `docs/plan/future/graphql/graphql-studio-plan.md` **Phase 6**.  
> **Phase 6 engineering is ✅ complete** (6A–6F + 6D-6 upload progress cache). E2E: `e2e/graphql-multi-tab.spec.ts` (isolation); lesson smoke spec `e2e/graphql-lessons.spec.ts` (GQL-1..3 auto-play — run on demand in lesson stage, not default CI).  
> **This section is the canonical home for demo work** (GQL-14 multi-tab, GQL-5 TLS, GQL-15 batch parity note, optional 6F profile/polling beats). Implement via **§10 Phase 7** checklist.

> **This section is the canonical home for demo work** (GQL-14 multi-tab, GQL-5 TLS, GQL-15 batch parity note, optional 6F profile/polling beats). Implement via **§10 Phase 7** checklist.  
> **Workspace isolation:** Demo lessons must not mutate the user's free-form GraphQL Studio workspace — see **§11.0** (required before reimplementing GQL-1..13 setup/cleanup).

---

### 11.0 Demo Workspace Isolation — Reserved Demo Tab Architecture

> **Status:** ✅ **Engineering complete (2026-06-22)** for GraphQL Studio lessons **GQL-1..15** — `gqlDemoWorkspace.ts`, `gql-demo-tab.ts`, `demoLessonId`, `tabBudget`, `PrerequisiteGate`, `purgeOrphanDemoTabs`. **Acceptance E2E proof pending** (§11.0.11).  
> **Priority:** Was P0 — unblocks pollution-free demos. Remaining: E2E validation + hard-refresh policy doc.  
> **Motivation:** Real user session where custom URL (`http://localhost:4011/graphql`) and manual tab title (`Local 4010 Docker`) were lost after running GQL-1 from Demo Hub and returning to Protocols/GraphQL.

#### 11.0.1 Problem statement

GraphQL demo lessons run in the **real** GraphQL Studio component — same React tree, same persistence keys (`gql_endpoint_v1`, `gql_tabs_v1`, `gql_auth_v1`, etc.). **§11.0 (2026-06-22)** routes lesson mutations through a **reserved demo tab** so user tabs 1–7 and page default endpoint stay untouched during studio lessons GQL-1..15.

**Observed failure mode (2026-06-21):**

1. User configures GraphQL Studio: custom endpoint (e.g. port **4011**), manually renamed tab (**`Local 4010 Docker`**).
2. User opens Demo Hub → starts **GQL-1** (`gql-first-query`).
3. Lesson **setup** clears the connection bar endpoint (`fill('')`) so the lesson can teach `{{graphqlUrl}}` from a clean slate.
4. That empty value is persisted to **`gql_endpoint_v1`** (page-level default).
5. Lesson **cleanup** only resets in-memory session flags — it does **not** restore the user's URL.
6. User returns to Protocols/GraphQL: **tab title survives** (stored in `gql_tabs_v1` with `labelManual: true`) but **URL bar is empty** — confusing split-brain UI.

**Root cause:** Lessons borrow the user's workspace and mutate **page-level** connection state. Tab metadata and page endpoint are stored separately; only the page endpoint was wiped.

**Related fix (already shipped):** `useGraphqlConnectionSettings` hydration gate — prevents empty endpoint from being written to storage *before* restore completes on remount/navigation. That fixes navigation/refresh races but **does not** fix demo lessons intentionally clearing storage during setup.

#### 11.0.2 Design decision — reserved demo tab (not snapshot/restore)

**Chosen approach:** On lesson start, create a **dedicated demo tab** in a reserved slot. All lesson mutations happen on that tab (tab-level endpoint override). User tabs (1–7) and page-level defaults remain untouched. On lesson exit/change, **wipe demo tab(s)**.

**Rejected as primary path:** Full workspace snapshot/restore on every lesson — heavier, invisible to the user, and redundant if demo tab isolation is enforced.

**Optional fallback (not required for v1):** Snapshot only page-level auth/TLS if a lesson must touch globals (prefer avoiding this).

#### 11.0.3 Tab capacity model

| Constant | Value | Meaning |
|----------|-------|---------|
| `MAX_TABS` | 8 (existing) | Hard storage cap in `tabPersistence.ts` |
| `MAX_USER_TABS` | 7 | User-facing cap — **+** button disabled at 7 when no demo active |
| `DEMO_TAB_RESERVE` | 1 | Slot 8 reserved for demo while a lesson is live |

**Rules:**

- Normal use: user may open **at most 7** tabs.
- While a demo lesson is active: demo tab occupies slot 8; user **+** stays disabled (demo owns the reserve).
- Demo tab creation **always succeeds** even when user already has 7 tabs (uses reserved slot).
- Demo tabs are **not** counted toward the user's 7-tab limit for display purposes (soft cap: user sees 7; 8th appears only during lessons, labeled e.g. **`Demo: Your First Query`**).

#### 11.0.4 Demo tab lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  User workspace (tabs 1–7, page endpoint, auth in storage)        │
│  UNTOUCHED during lesson if rules in §11.0.6 are followed         │
└─────────────────────────────────────────────────────────────────┘
                              │
         Lesson start (setup)  ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Wipe any existing demo tab(s) (by demoLessonId / flag)      │
│  2. Save priorActiveTabId                                      │
│  3. Create demo tab in slot 8 — label: Demo: {lesson name}      │
│  4. Switch to demo tab                                          │
│  5. Set tab.endpoint (demo URL / {{graphqlUrl}}) — NOT page     │
│  6. Run lesson-specific setup (editor mode, reset query, etc.) │
└─────────────────────────────────────────────────────────────────┘
                              │
         During lesson         │  All DOM fills/clicks assume active tab = demo
                              │
         Lesson end (cleanup)  ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Close all demo tab(s) for this lesson (or all demo tabs)    │
│  2. Restore activeTabId → priorActiveTabId                      │
│  3. Do NOT clear page-level endpoint                            │
└─────────────────────────────────────────────────────────────────┘
```

**Lesson change:** When user selects a different lesson (or restarts), **wipe demo tab first**, then new lesson creates a **fresh** demo tab with its own configuration. No cross-lesson contamination on the demo tab.

#### 11.0.5 Cleanup triggers (must all wipe demo tab(s))

| Trigger | Hook location | Notes |
|---------|---------------|-------|
| Exit live demo → concept | `useDemoHub.exitLiveDemo` | After view change; run cleanup |
| Restart lesson | `useDemoHub.restartDemo` | Before setup |
| Auto-replay at last step | `useDemoHub.toggleAutoPlay` | cleanup → setup chain |
| Select different lesson | `useDemoHub.selectLesson` | Wipe previous lesson's demo tab |
| Leave Demo Hub for another app tab | `App` tab change or Demo Hub close | Wipe if lesson was active |
| GraphQL Studio mount, no active lesson | `useGqlStudioTabs` hydrate | Orphan sweep — remove stale demo tabs |

**Orphan demo tabs:** Persist demo identity in tab JSON (`demoLessonId?: string` or `isDemoTab: true`). On GraphQL Studio mount when Demo Hub is **not** in live view, delete any tab with demo flag.

#### 11.0.6 Mutation rules during lessons (critical)

| State | Demo lesson MAY mutate | Demo lesson MUST NOT mutate |
|-------|------------------------|----------------------------|
| Connection URL | **Active demo tab** `endpoint` override | Page default `gql_endpoint_v1` via single-tab `setEndpoint('')` |
| Query / variables / headers | Active demo tab content | Other user tabs |
| Tab label | Demo tab only (`Demo: …`) | User tabs' `labelManual` titles |
| Auth / TLS / polling | Prefer demo-tab-scoped only | Page-level keys unless lesson explicitly requires (avoid) |
| Activity panel (History vs Editor) | OK to switch during demo | N/A |

**Connection bar routing reminder:** With **one tab**, URL edits go to **page storage**. With **two+ tabs**, URL edits go to **active tab override**. Therefore:

- Demo setup **must** create demo tab and switch to it **before** any `fill(GQL.ENDPOINT_INPUT, …)`.
- **Remove** blanket `fill(GQL.ENDPOINT_INPUT, '')` from lesson setup hooks (e.g. `gqlFirstQuerySetup`) — it wipes page default when only one tab exists.

#### 11.0.7 Multi-tab lessons — `tabBudget` prerequisite gate

Most lessons need **`tabBudget: 1`** (one demo tab in the reserve slot).

**GQL-14** (`gql-multi-tab`) **teaches** two independent workspace tabs — it needs **2 tab slots** for the lesson itself (in addition to user tabs). **GQL-15** (`gql-batch-execution`) adds a second tab for batch parity teaching — confirm during authoring; likely **`tabBudget: 2`** for the add-tab step.

**`DemoLesson` extension (planned):**

```typescript
/** Free tab slots the lesson needs beyond user workspace (default 1). */
tabBudget?: number; // default 1
```

**Prerequisite gate (before live demo starts):**

- Compute: `requiredSlots = tabBudget ?? 1`
- Compute: `userTabCount` = tabs where `!isDemoTab`
- If `userTabCount > MAX_TABS - requiredSlots`, block start and show:

  > **This lesson needs N workspace tab slot(s).**  
  > You have {userTabCount} tabs open. Close at least **{userTabCount - (MAX_TABS - requiredSlots)}** tab(s) to continue.

| Lesson | `tabBudget` | Gate copy hint |
|--------|-------------|----------------|
| GQL-1 .. GQL-13, GQL-5, GQL-16..19 | **1** | No gate if user has ≤ 7 tabs (demo uses slot 8 automatically) |
| **GQL-14** Multi-Tab | **2** | "This lesson demonstrates two workspace tabs. Close one tab if you have 7 open." |
| **GQL-15** Batch | **2** (verify at author time) | "This lesson adds a second tab for batch execution. Close one tab if you have 7 open." |

**GQL-14 implementation note:** Both lesson tabs should be **demo-tagged** during the lesson (or demo tab + second demo tab created by lesson steps), never user tabs 1–7. Cleanup closes **all** demo tabs. See **§11.1** step spec — update authoring notes to align with **§11.0**.

#### 11.0.8 Persistence schema (planned)

Extend `GqlStudioTab` in `tabPersistence.ts`:

```typescript
/** Present when tab was created by Demo Hub for a live lesson. */
demoLessonId?: string;  // e.g. 'gql-first-query'
/** Alternative: isDemoTab?: boolean */
```

- Demo tabs saved to `gql_tabs_v1` like normal tabs (for crash recovery) but swept on mount if lesson not active.
- **`gql_endpoint_v1`** should reflect **user's** page default only — not lesson demo URLs.

#### 11.0.9 Shared helpers (planned files)

| Helper | Location | Responsibility |
|--------|----------|----------------|
| `ensureGqlDemoTab(ctx, lessonId, label?)` | `graphql-lesson-helpers/gql-demo-tab.ts` | Wipe old demo tabs → create → switch → return tab id |
| `closeGqlDemoTabs(ctx, lessonId?)` | same | Close demo tab(s); restore `priorActiveTabId` |
| `countUserGqlTabs()` | same | Tabs without `demoLessonId` |
| `assertActiveDemoTab(lessonId)` | same | Guard for step actions — fail fast if wrong tab active |

Wire **all** GraphQL lesson `setup` / `cleanup` through these helpers (replace direct `fill(ENDPOINT, '')` patterns).

#### 11.0.10 Impact on existing lesson code (breaking changes)

| Current pattern | New pattern |
|-----------------|-------------|
| `gqlFirstQuerySetup` clears page endpoint with `fill('')` | `ensureGqlDemoTab` only; demo tab starts empty or with lesson default |
| `gqlFirstQueryCleanup` resets session flags only | `closeGqlDemoTabs` + reset session flags |
| `ensureDemoEndpoint` fills connection bar | Fill **demo tab** endpoint only; assert demo tab active |
| GQL-14 `gqlMultiTabLessonCleanup` closes tabs by index | Close **demo-tagged** tabs only; never close user tab 1–7 |
| Lesson tests expecting `fill(ENDPOINT, '')` on setup | Expect `ensureGqlDemoTab` / tab add mocks |

#### 11.0.11 Acceptance criteria

- [ ] User sets custom URL + manual tab title → runs GQL-1 → exits → **URL and title unchanged** on user tab.
- [ ] User with **7 tabs open** can start GQL-1 without closing a tab (demo uses slot 8).
- [ ] User with **7 tabs open** sees prerequisite gate before GQL-14 until one tab is closed.
- [ ] Switch GQL-1 → GQL-2: demo tab wiped and recreated; no leftover GQL-1 query on demo tab.
- [ ] Hard refresh mid-lesson: orphan demo tab removed when not in live demo view (or restored consistently — pick one policy, document in E2E memo).
- [x] `gql_endpoint_v1` never written to `''` by lesson setup (studio lessons use demo tab endpoint).
- [x] Unit tests: `gql-demo-tab.test.ts`, updated `core.test.ts` / `graphql-first-query.test.ts`.
- [ ] E2E: add case to `e2e/DEMO-LESSON-E2E-MEMO.md` — "user workspace survives GQL-1".

#### 11.0.12 Implementation checklist (§11.0)

- [x] `GqlStudioTab.demoLessonId` + `normalizeTab` + tests
- [x] `MAX_USER_TABS = MAX_TABS - 1` enforcement in `useGqlStudioTabs.addTab`
- [x] `gql-demo-tab.ts` helpers + unit tests
- [x] `DemoLesson.tabBudget` + `PrerequisiteGate` tab-capacity variant
- [x] `useDemoHub` — wipe demo tabs on exit / restart / selectLesson (`closeGraphqlDemoWorkspaceQuiet`)
- [x] Migrate GQL-1..15 setup/cleanup via `ensureGqlDemoTab` / `closeGqlDemoTabs`
- [x] `purgeOrphanDemoTabs` on Studio mount (`useGqlStudioTabs`)
- [x] Update **§11.3** impact table
- [ ] Update `e2e/DEMO-LESSON-E2E-MEMO.md` with §11.0 acceptance cases

---

### 11.1 New Demo Lesson: GQL-14 Multi-Tab Workspaces

**ID:** `gql-multi-tab`  
**Final card:** **GQL-14**  
**Estimated minutes:** 4  
**Position:** Slot **14** — Studio Power arc, **before GQL-15 Batch** (**§3.1**)  
**Docker:** Same GraphQL test server (4010) — contrasts `{{graphqlUrl}}` vs direct `http://localhost:4010/graphql` for per-tab endpoint isolation  
**Engineering reference:** `e2e/graphql-multi-tab.spec.ts` (isolation patterns; lesson uses live Docker, not `/__proxy` mocks)

| Step ID | Title | Highlight / verify | Description focus |
|---------|-------|-------------------|-------------------|
| `gql14-intro` | Independent Tab Workspaces | `GQL.TAB_BAR` | Each tab is a full workspace: endpoint override, schema, cached response. Contrast with single-connection tools. |
| `gql14-tab1-endpoint` | Tab 1 — Set First Endpoint | `GQL.ENDPOINT_INPUT` → `GQL.RESPONSE_BODY` | Tab 1 uses `{{graphqlUrl}}`. **Introspect**. Run `query { health }`. Response in Tab 1 only. |
| `gql14-add-tab2` | Add a Second Tab | `GQL.TAB_ADD_BTN` | Tab 2 inherits page default until overridden. |
| `gql14-tab2-endpoint` | Tab 2 — Different Endpoint | `GQL.ENDPOINT_INPUT` → `GQL.SCHEMA_EXPLORER` | Tab 2 override to direct 4010 URL. Schemas do not cross-contaminate on switch. |
| `gql14-switch-responses` | Switch Tabs — Responses Persist | `GQL.TAB_BAR` → `GQL.RESPONSE_BODY` | Execute in Tab 2; switch to Tab 1 — cached responses independent. |
| `gql14-tab-badge` | Tab Endpoint Badge | `GQL.tabEndpointBadge(tabId)` | Custom endpoint → hostname badge; page default → no badge. |
| `gql14-real-world` | Staging vs Production | `GQL.TAB_BAR` | Rename tabs; same query on both endpoints — staging vs prod spot-check. |
| `gql14-profiles` *(optional 7B)* | Profile-Linked Tabs | profile chip → tab badge | Staging vs Prod profiles; **`linkedProfileName`** hint when editing auth. |
| `gql14-polling` *(optional 7B)* | Per-Tab Schema Polling | `GQL.POLLING_TOGGLE` | Polling on Tab 1 only; interval follows active tab. |

**Authoring notes:**
- **§11.0 required:** Lesson runs on demo-tagged tabs only — never mutate user tabs 1–7 or page default endpoint.
- **`tabBudget: 2`** — prerequisite gate if user has 7 tabs open (see **§11.0.7**).
- Two **demo** tabs must exist **before** setting endpoints so edits become per-tab overrides (single-tab edits mutate the page default — no badge). Mirror `prepareTwoTabsWithEndpoints()` from `e2e/graphql-helpers.ts`.
- After endpoint fill, press **Tab** or blur so the override persists (`fillEndpoint` pattern in E2E helpers).
- Use `click → waitFor(child) → delay → interact` for React async renders (demo-player rules §5).
- Split "click execute" and "observe response" if spotlight should land on `GQL.RESPONSE_BODY` rather than `GQL.EXECUTE_BTN`.

**`preAction` requirements:**

| Step | Guard responsibility |
|------|----------------------|
| `gql14-tab1-endpoint` | Tab 1 active; endpoint = `{{graphqlUrl}}`; introspection complete; optional cached `health` response |
| `gql14-add-tab2` | At least two tabs exist |
| `gql14-tab2-endpoint` | Tab 2 active; endpoint override = direct 4010 URL; introspection complete |
| `gql14-switch-responses` | Tab 2 has executed; switch to Tab 1 before spotlight |
| `gql14-tab-badge` | Both tabs have custom endpoint overrides (badges visible) |
| `gql14-real-world` | Both tabs renamed; both endpoints set; both introspected |

**Helper module:** `src/features/demo-player/lessons/protocols/graphql-lesson-helpers/lesson14-multi-tab.ts`

Suggested exports:
- `ensureGqlTabCount(ctx, n)` — add tabs via `GQL.TAB_ADD_BTN` until count reached
- `activateGqlTabByIndex(ctx, index)` — click tab bar `[role="tab"]` nth
- `setActiveTabEndpoint(ctx, url)` — fill `GQL.ENDPOINT_INPUT`, blur
- `introspectActiveTabQuiet(ctx)` — introspect without ripple if schema already loaded
- `executeOnActiveTabQuiet(ctx, query)` — set Monaco model + execute if response missing

---

### 11.2 GQL-15 Batch Execution — Endpoint Parity Note

**Status: ✅ Shipped (2026-06-22)** — 9 steps; batch enable + tab inclusion via **Advanced Settings → Batch** (Phase 6G); `tabBudget: 2`.

| Step | Required addition | Status |
|------|-------------------|--------|
| `gql15-enable-batch` | Enable batching in Advanced Settings (visible toggle `gql-adv-batch-enable-toggle`) | ✅ |
| `gql15-add-tab` | Second demo tab for batch parity; cross-reference **GQL-14** | ✅ |
| `gql15-batch-select` | Select tabs in Advanced Settings → Batch panel (not tab-bar checkboxes) | ✅ |
| `gql15-batch-run` | Narrate common endpoint; verify parity before **Send Batch** | ✅ |

GQL-15 ships **after GQL-14** (7D) so learners already understand per-tab endpoint overrides.

---

### 11.3 Impact on Existing Lessons

| Lesson | Impact |
|--------|--------|
| **GQL-1..15 (studio)** | ✅ **§11.0 complete** — setup/cleanup via `ensureGqlDemoTab` / `closeGqlDemoTabs` |
| GQL-14 Multi-Tab | ✅ `tabBudget: 2`; demo-tagged tabs; prerequisite gate |
| GQL-15 Batch Execution | ✅ `tabBudget: 2`; Advanced Settings batch UI; §11.2 copy shipped |
| GQL-16 Workflow Integration | Expand per §9.2–9.3; uses Workflow Designer (no studio `tabBudget`) |
| GQL-17..19 Workflow cluster | Authored; workflow tabs only |

`configureProtocolEndpointInEnvManager` helpers in lesson `preAction` guards remain valid for **Environment Manager** demo env setup — they configure EM variables, not the user's persisted Studio page default. Studio connection bar during lessons targets **demo tab endpoint** only (**§11.0.6**).

---

### 11.4 Selectors & Files

| Selector / constant | Location | Used in GQL-14 | Status |
|---------------------|----------|----------------|--------|
| `GQL.TAB_BAR` | `selectors.ts` | Tab switch steps | ✅ |
| `GQL.TAB_ADD_BTN` | `selectors.ts` | Add Tab 2 | ✅ |
| `GQL.ENDPOINT_INPUT` | `selectors.ts` | Endpoint override | ✅ |
| `GQL.ENDPOINT_RESET_BTN` | `selectors.ts` | Optional advanced step / guard | ✅ |
| `GQL.tabEndpointBadge(tabId)` | `selectors.ts` | Badge step | ✅ |
| `GQL.INTROSPECT_BTN` | `selectors.ts` | Connection bar introspect | ✅ |
| `GQL.SCHEMA_EXPLORER` | `selectors.ts` | Schema tab verify | ✅ |
| `GQL.EXECUTE_BTN` | `selectors.ts` | Query execution | ✅ |
| `GQL.RESPONSE_BODY` | `selectors.ts` | Response cache verify | ✅ |
| Tab rename affordance | `GqlTabBar` | `gql14-real-world` | 🔲 Verify/add `data-testid` at implement time |
| `GQL.CONNECTION_PROFILE_CHIP` | `selectors.ts` | 7B optional profile step | ✅ |
| `GQL.POLLING_TOGGLE` | `selectors.ts` | 7B optional polling step | ✅ |

| File | Role |
|------|------|
| `graphql-multi-tab.ts` | Lesson definition (7 steps) |
| `graphql-multi-tab.test.ts` | Step count, IDs, guards, action mocks |
| `graphql-lesson-helpers/lesson14-multi-tab.ts` | Shared quiet guards + DOM helpers |
| `graphql-lessons.ts` | Register at slot **14** (**§3.1**) |
| `e2e/graphql-multi-tab.spec.ts` | Engineering E2E (already ✅ — not a demo spec) |

---

### 11.5 Demo Lesson Checklist

See **§10 Phase 7** for the actionable task list. Summary (2026-06-22):

- [x] Phase 6 engineering complete (`graphql-studio-plan.md` — 6A–6F + 6D-6)
- [x] Phase 6G batch UI — Advanced Settings → Batch; `GqlBatchSettingsPanel`
- [x] Optional studio polish (auth profile hint, page split, tracing UI, tab auto-label, protocols tab memory)
- [x] Studio persistence + loopback fix (endpoint hydrate gate, `loopbackUrl.ts`)
- [x] Smoke E2E GQL-1..3 + drift guard (`graphql-smoke-e2e-alignment.test.ts`)
- [x] Demo E2E GQL-1..10 + TLS (`demo-gql-*.spec.ts`)
- [x] E2E isolation spec (`e2e/graphql-multi-tab.spec.ts`, incl. 6F-13)
- [x] TLS Docker stack (`docker/graphql/tls/`)
- [x] Phase 3 registry sync — all 19 lessons in `graphql-lessons.ts`
- [x] **7A** — `graphql-https-tls.ts` + helper + tests + **mTLS** + studio TLS product (**GQL-5**, 12 steps)
- [x] **7B** — `graphql-multi-tab.ts` + `lesson14-multi-tab.ts` + tests (**GQL-14**)
- [x] **Phase 5** — GQL-15 (9 steps), GQL-17, GQL-18, GQL-19 authored
- [x] **§11.0 / 7-pre** — Demo workspace isolation — **engineering complete GQL-1..15**
- [x] Demo E2E GQL-5 shell — `demo-gql-https-tls.spec.ts`
- [x] **Phase 5** — GQL-15 (9 steps), GQL-17, GQL-18, GQL-19 authored
- [ ] **§11.0 acceptance E2E** — user workspace survives lesson
- [ ] **7C** — Optional 6F profile/polling steps in GQL-14
- [ ] **Demo E2E** — GQL-14, GQL-15, GQL-16..19
- [ ] **Phase 8** — Visual validation at 1× auto-play (all **19** lessons)

---

## 12. Reference Files

| File | Role in this enhancement |
|------|--------------------------|
| `src/features/demo-player/lessons/protocols/ws-workspace.ts` | Gold standard: 700×430 chrome mockup SVG (~190 lines) |
| `src/features/demo-player/lessons/protocols/graphql-lessons.ts` | **19-lesson registry** — §3.1 order ✅ (2026-06-21) |
| `src/features/graphql/hooks/useGraphqlConnectionSettings.ts` | Endpoint persistence hydrate gate (2026-06-21) |
| `src/shared/utils/loopbackUrl.ts` | Corporate-proxy `localhost`→`127.0.0.1` fix (2026-06-21) |
| `src/shared/types/gqlTls.ts` | Shared TLS settings + proxy routing helpers (2026-06-22) |
| `src-server/routes/graphql/tlsAgent.ts` | Node `https.Agent` builder for GraphQL upstream TLS/mTLS |
| `src/features/graphql/components/GraphqlTlsPanel.tsx` | TLS panel UI (skip-cert, CA, client cert/key) |
| `e2e/demo-gql-https-tls.spec.ts` | GQL-5 demo E2E — shell + full Docker walk |
| `src/features/demo-player/lessons/protocols/ws-tls-local.ts` | Gold standard: 3-phase TLS lesson (skip-cert → CA → mTLS), Docker setup |
| `src/features/demo-player/lessons/protocols/ws-auth-transport.ts` | Gold standard: auth lesson (Bearer + transport modes + proxy explanation) |
| `src/features/demo-player/lessons/protocols/kafka-workflow-produce.ts` | Gold standard: workflow lesson description depth (field table, console timing, bindings) |
| `src/features/demo-player/lessons/protocols/kafka-workflow-consume-wait.ts` | Gold standard: event-driven workflow (correlation, sample payload, load mode) |
| `src/features/demo-player/lessons/protocols/kafka-secure.ts` | Reference: SASL security lesson structure |
| `src/features/demo-player/lessons/protocols/kafka-tls.ts` | Reference: TLS-on-top-of-auth lesson structure |
| `src/shared/selectors.ts` lines 582–894 | All ~130 `GQL.*` selectors for highlight/verify targets |
| `src/features/demo-player/types.ts` | `DemoLesson` and `DemoStep` TypeScript interfaces; add `tabBudget?: number` (**§11.0.7**) |
| `src/features/graphql/utils/tabPersistence.ts` | `MAX_TABS`, `GqlStudioTab`; add `demoLessonId` (**§11.0.8**) |
| `src/features/graphql/hooks/useGqlStudioTabs.ts` | Tab CRUD; enforce `MAX_USER_TABS` (**§11.0.3**) |
| `src/features/demo-player/lessons/protocols/graphql-lesson-helpers/gql-demo-tab.ts` | **Planned** — `ensureGqlDemoTab` / `closeGqlDemoTabs` (**§11.0.9**) |
| `src/features/demo-player/useDemoHub.ts` | Lesson exit/restart/selectLesson — demo tab wipe (**§11.0.5**) |
| `e2e/DEMO-LESSON-E2E-MEMO.md` | Add user-workspace-survives-lesson pitfall (**§11.0.11**) |
| `docker/graphql/tls/` | ✅ TLS Docker stack — nginx proxy, generated certs, docker-compose for phases 1–3 |
| `docker/graphql/tls/certs/ca.crt` | ✅ Generated CA cert — embed as `GQL_TLS_CA_CERT` in lesson helper |
| `docker/websocket/generate-cert.sh` | Original template used to create the GraphQL TLS scripts |
| `.cursor/rules/demo-player-lessons.mdc` | Authoring rules (delay sizing, preAction guards, WHY framing, estimatedMinutes formula) |
| `docs/plan/future/graphql/graphql-studio-plan.md` Phase 6–7 | Engineering complete; Phase 7 sub-phases 7A–7D (7A=TLS, 7B=Multi-Tab, 7C=6F optional, 7D=batch parity); exit criteria |
| `e2e/graphql-lessons.spec.ts` | Smoke auto-play GQL-1..3 — `npm run test:e2e:demo:gql-smoke` (on demand, not default CI) |
| `e2e/graphql-lesson-smoke-helpers.ts` | Shared walk/prepare; constants guarded by `graphql-smoke-e2e-alignment.test.ts` |
| `src/features/graphql/components/GraphqlStudioPageDialogs.tsx` | Extracted from page split (79 lines); unit tested |
