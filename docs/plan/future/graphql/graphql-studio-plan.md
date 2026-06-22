# GraphQL Studio — Living Plan

> **Status:** Studio engineering **complete** (Phases 1–6G + TLS transport). Remaining work is **demo QA**, optional E2E, and lesson polish — not new Studio features.  
> **Last updated:** 2026-06-22  
> **Demo lessons & quality backlog:** `graphql-demo-lesson-enhancement.md`  
> **Completed phase task tables:** `git show 94d99dce:docs/plan/future/graphql/graphql-studio-plan.md`

---

## What this document is

A **short status + backlog** file for GraphQL Studio **product engineering**. It intentionally omits:

- Per-lesson step scripts (live in `src/features/demo-player/lessons/protocols/`)
- Historical bug audits and “plan correction” notes (resolved; see git history)
- Completed PT-1…PT-12 implementation specs (shipped in Phases 6A–6F)

Keeping those here inflated token usage without helping future work.

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Phase 1 — Core Studio | ✅ | Editor, schema explorer, execution, auth, environments |
| Phase 2 — Advanced Studio | ✅ | Subscriptions, `@defer`, upload, builder, tracing |
| Phase 2 deferred (aliases, fragments, histogram, config UI) | ✅ | Re-reviewed 2026-06-20 |
| Phase 3 — Power features | ✅ | Collections/history/scripts, schema diff, mock, APQ/batch/dedup |
| Phase 4 — Workflow integration | ✅ | GraphQL workflow nodes + runner + gallery templates |
| Phase 5 — Demo lessons (code) | ✅ | **19 lessons** in `graphql-lessons.ts` (GQL-1…GQL-19) |
| Phase 6A–6F — Per-tab isolation | ✅ | Endpoint, schema, response cache, profiles, polling, execution layers |
| Phase 6G — Batch UX (Advanced Settings) | ✅ | `GqlBatchSettingsPanel`; read-only **B** badges on tab bar |
| GQL TLS transport | ✅ | Proxy routes, `GraphqlTlsPanel`, page PEM `gql_tls_certs_v1` |
| Phase 7 demo track | 🔨 | **7A ✅ · 7B ✅ · 7D ✅** — see open items below |

---

## Canonical code map

| Area | Path |
|---|---|
| Studio page | `src/features/graphql/GraphqlStudioPage.tsx` |
| Components / hooks / utils | `src/features/graphql/components/`, `hooks/`, `utils/` |
| Demo lesson registry | `src/features/demo-player/lessons/protocols/graphql-lessons.ts` |
| Selectors | `src/shared/selectors/gql.ts` |
| Server proxy | `src-server/routes/graphql/` |
| Studio E2E | `e2e/graphql-*.spec.ts` |
| Demo lesson E2E | `e2e/demo-gql-*.spec.ts` |
| Workflow nodes | `src/features/workflow/engine/graphRunnerGraphqlNodeHandlers.ts` |
| Docker test server | `docker/graphql/` · TLS stack `docker/graphql/tls/` |

**Lesson authoring rules:** `.cursor/rules/demo-player-lessons.mdc`  
**E2E pitfalls:** `e2e/DEMO-LESSON-E2E-MEMO.md`

---

## Demo lesson roster (19)

Registry order matches Demo Hub cards (`graphql-lessons.ts`):

| GQL | id | Title |
|-----|-----|-------|
| 1 | `gql-first-query` | Your First GraphQL Query |
| 2 | `gql-variables` | Variables & Arguments |
| 3 | `gql-schema-exploration` | Schema Exploration |
| 4 | `gql-auth-headers` | Authentication & Headers |
| 5 | `gql-https-tls` | HTTPS, TLS & Certificates |
| 6 | `gql-mutations` | Mutations |
| 7 | `gql-subscriptions` | Subscriptions |
| 8 | `gql-query-builder` | Query Builder |
| 9 | `gql-collections-history` | Collections & History |
| 10 | `gql-export-share` | Export & Share Queries |
| 11 | `gql-performance-tracing` | Performance Tracing |
| 12 | `gql-schema-diff` | Schema Diff |
| 13 | `gql-mock-server` | Mock Server |
| 14 | `gql-multi-tab` | Multi-Tab Workspaces |
| 15 | `gql-batch-execution` | Batch Execution |
| 16 | `gql-workflow-integration` | Workflow Integration |
| 17 | `gql-workflow-runner` | Workflow Runner & Results |
| 18 | `gql-workflow-mutation` | Mutation Node in Workflow |
| 19 | `gql-workflow-subscription` | Subscription Node in Workflow |

Step counts, selectors, diagrams, and enhancement backlog: **`graphql-demo-lesson-enhancement.md` §3**.

---

## Open backlog (Studio engineering)

| # | Item | Priority | Status |
|---|------|----------|--------|
| 6G-7 | E2E: two resolved endpoints → two batch groups in Advanced Settings | P2 | 🔲 |
| — | `GraphqlStudioPage.tsx` line count (999) — optional further split if it grows | P3 | 🔨 watch |

No other Studio feature phases are planned here. New product scope should get a new phase section or a separate plan file.

---

## Open backlog (demo / QA — tracked in enhancement plan)

These are **not** Studio engineering tasks; listed here so this file stays the single “what’s left?” index.

| Item | Priority | Status | Detail |
|------|----------|--------|--------|
| §11.0 acceptance E2E | P0 | 🔲 | User workspace survives lesson exit |
| Phase 8 human validation | P0 | 🔲 | 1× auto-play Web + Tauri for all 19 lessons |
| 7C — GQL-14 optional steps | P2 | 🔲 | Profile-linked tabs + per-tab polling beats |
| Demo E2E GQL-19 | P2 | 🔲 | No `demo-gql-workflow-subscription.spec.ts` yet |
| GQL-3…13 + GQL-16 enhancement | P1 | 🔨 | Diagrams, spotlight fixes — below GQL-1/GQL-2 bar |
| GQL-5 full Docker E2E in default CI | P3 | 🔲 | Needs TLS + mTLS + plain stacks |

Full tables: **`graphql-demo-lesson-enhancement.md` § “Pending, Deferred & Not Implemented”**  
GQL-5 checklist: **`gql5-phase8-validation-checklist.md`**

---

## Deferred / not implemented (product)

Features explicitly **out of scope** or replaced by what shipped:

| Feature | Verdict |
|---------|---------|
| Multi-target Code Gen panel (TypeScript types, `python-gql`, file download) | **Not shipped** — Lesson 10 uses Builder SDL preview + History **Copy as cURL** |
| Per-tab independent PEM certificate stores | **Deferred** — page-level `gql_tls_certs_v1`; tabs inherit |
| Native Rust/webview TLS for custom CA/mTLS in Tauri | **Deferred** — routes through Node proxy (`localhost:3001`) |
| Basic Auth / OAuth2 demo lesson beats | **Deferred** — GQL-4 covers Bearer + API Key only |
| GQL-20+ lesson slots | **Not started** — no registry entries |
| File upload / APQ / batch as standalone demo lessons | **Deferred** — power-user; mentioned in docs only |
| Demo-only history bucket (isolate lesson runs from user history) | **Future** — §11.0 tab isolation shipped; history filter optional |

---

## Phase 6 architecture (reference only)

Per-tab isolation is **shipped**. Resolution chain lives in `tabConnectionResolution.ts`:

**Endpoint:** `tab.endpoint` → linked profile → page default  
**Auth:** linked profile → page default (no `tab.auth` field)  
**Polling:** tab override → page default  
**Batch:** same resolved endpoint only; configure in **Advanced Settings → Batch**

For the original PT-1…PT-12 design notes, see git history on this file (pre-2026-06-22 slim-down).

---

## Success criteria (exit gate)

Studio engineering is **done** when:

- [x] Phases 1–6G + TLS transport implemented and unit-tested
- [x] 19 demo lessons registered with unit tests
- [ ] §11.0 acceptance E2E passes
- [ ] Phase 8 human validation sign-off (all 19 lessons)
- [ ] Optional 6G-7 batch-group E2E (two endpoints)

---

## Notes

- `ws-graphql.ts` is a **WebSocket category** lesson (port 4100) — not GraphQL Studio tab scope.
- Lesson 9 was retitled from “Code Generation” to match shipped export surfaces (Builder + cURL).
- Batch lesson (GQL-15) uses Advanced Settings selectors (`gql-adv-batch-tab-cb-*`) — aligned with Phase 6G.
- Fragment panel partial-state safety fix applied in Summary panel (2026-06-20).
