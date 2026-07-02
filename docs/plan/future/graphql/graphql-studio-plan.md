# GraphQL Studio — Living Plan

> **Status:** Phases **1–7** product + demo track **complete** ✅ (2026-06-28). No open Studio engineering phases.  
> **Last updated:** 2026-07-01 (plan slim-down — removed shipped 6H slice specs and completed backlog tables)  
> **Doc policy:** This file is a **short status + forward backlog** only. Shipped slice specs, bug audits, test matrices, and lesson enhancement detail live in git history and sibling docs — **do not append audit logs here**.

| Detail lives in | Path |
|---|---|
| Demo lesson enhancement & Phase 8 QA | [`graphql-demo-lesson-enhancement.md`](./graphql-demo-lesson-enhancement.md) |
| GQL-5 TLS validation | [`gql5-phase8-validation-checklist.md`](./gql5-phase8-validation-checklist.md) |
| Phase 8 human validation | [`phase8-validation-checklist.md`](./phase8-validation-checklist.md) |
| Full pre-slim plan (historical) | `git show 94d99dce:docs/plan/future/graphql/graphql-studio-plan.md` |
| Lesson authoring rules | [`.cursor/rules/demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc) |
| Demo E2E pitfalls | [`e2e/DEMO-LESSON-E2E-MEMO.md`](../../../../e2e/DEMO-LESSON-E2E-MEMO.md) |

---

## What this document is

A **single index** for GraphQL Studio **product engineering** — what shipped, where code lives, what is deferred, and where to look for lesson/QA work.

**Intentionally omitted** (token cost, no future value):

- Per-lesson step scripts → `packages/demo-hub/src/lessons/protocols/`
- Phase 6H implementation slices 1–7 (shipped) → mockup index + `tabConnectionResolution.ts`
- Completed P0/P1/P2 backlog rows (all ✅)
- Bug-fix history and “plan correction” notes

---

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Phase 1 — Core Studio | ✅ | Editor, schema explorer, execution, auth, environments |
| Phase 2 — Advanced Studio | ✅ | Subscriptions, `@defer`, upload, builder, tracing |
| Phase 2 deferred (aliases, fragments, histogram, config UI) | ✅ | Closed 2026-06-20 |
| Phase 3 — Power features | ✅ | Collections/history/scripts, schema diff, mock, APQ/batch/dedup |
| Phase 4 — Workflow integration | ✅ | GraphQL workflow nodes + runner + gallery templates |
| Phase 5 — Demo lessons (registry) | ✅ | **19 lessons** — `packages/demo-hub/.../graphql-lessons.ts` |
| Phase 6A–6F — Per-tab isolation | ✅ | Endpoint, schema, response cache, profiles, polling, execution layers |
| Phase 6G — Batch UX | ✅ | `GqlBatchSettingsPanel`; read-only **B** badges on tab bar |
| GQL TLS transport | ✅ | Proxy routes, `GraphqlTlsPanel`, page PEM `gql_tls_certs_v1`; Tauri rustls |
| Phase 6H — Per-tab auth (Option D) | ✅ | Bottom Auth tab, inherit chain, badge focus — see **§ Phase 6H (shipped)** |
| Phase 7 demo track (7A–7D) | ✅ | GQL-5 TLS, GQL-14 multi-tab, GQL-15 batch, lesson polish |
| Phase 8 human + E2E validation | ✅ | 19/19 lessons — see enhancement plan |

**Studio engineering exit gate:** all items above ✅ — new product scope needs a **new phase section** or a **separate plan file**.

---

## Canonical code map

| Area | Path |
|---|---|
| Studio page | `src/features/graphql/GraphqlStudioPage.tsx` + `components/GraphqlStudioSplitWorkspace.tsx` |
| Components / hooks / utils | `src/features/graphql/components/`, `hooks/`, `utils/` |
| Per-tab resolution | `src/features/graphql/utils/tabConnectionResolution.ts` |
| Demo lesson registry | `packages/demo-hub/src/lessons/protocols/graphql-lessons.ts` |
| Selectors | `src/shared/selectors/gql.ts` |
| Server proxy | `src-server/routes/graphql/` |
| Studio E2E | `e2e/graphql-*.spec.ts` |
| Demo lesson E2E | `e2e/demo-gql-*.spec.ts` |
| Workflow nodes | `src/features/workflow/engine/graphRunnerGraphqlNodeHandlers.ts` |
| Docker test server | `docker/graphql/` · TLS `docker/graphql/tls/` |
| Phase 6H mockups | `docs/plan/future/graphql/mockups/gql-per-tab-auth-index.html` |

---

## Demo lesson roster (19)

Registry order matches Demo Hub cards. Step counts, selectors, diagrams, and QA backlog: **`graphql-demo-lesson-enhancement.md`** (roster §, step prefixes, §11.0 isolation).

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

---

## Open backlog (Studio engineering)

| # | Item | Priority | Status |
|---|------|----------|--------|
| — | New product features beyond Phases 1–7 | — | **Not started** — add new phase section when scoped |

All prior Studio backlog items (6G-7 E2E, page split, 6H slices) are **shipped** — see git history if needed.

---

## Open backlog (demo / QA)

**Not Studio engineering.** Tracked in [`graphql-demo-lesson-enhancement.md`](./graphql-demo-lesson-enhancement.md) § “Pending, Deferred & Not Implemented”.

Phase 8 demo validation is **complete** (19/19 human Web + Tauri, E2E sweep). No P0 demo blockers remain.

---

## Deferred / not implemented (product)

Features explicitly **out of scope** or not shipped:

| Feature | Verdict |
|---------|---------|
| Multi-target Code Gen panel (TS types, `python-gql`, file download) | **Not shipped** — Lesson 10 uses Builder SDL preview + History **Copy as cURL** |
| Per-tab independent PEM certificate stores | **Deferred** — page-level `gql_tls_certs_v1`; tabs inherit |
| Native Rust/webview TLS for all edge cases | **Partial** — `gql_http_fetch` / upload / WS use rustls; loopback/plain HTTP may use Node `:3001` |
| GQL-20+ lesson slots | **Not started** — no registry entries |
| File upload / APQ / batch as standalone demo lessons | **Deferred** — power-user; docs only |
| Demo-only history bucket (isolate lesson runs from user history) | **Future** — §11.0 tab isolation shipped; history filter optional |
| Bottom-panel **Fragments** tab | **Not shipped** — shown in 6H mockup only; separate feature if ever scoped |
| Duplicate tab copies source tab auth | **Deferred** — new/duplicate tabs inherit workspace, not copy source |

---

## Phase 6 architecture (reference)

Per-tab isolation is **shipped** for endpoint, TLS, polling, schema, auth, and execution.

**Resolution chain** (`tabConnectionResolution.ts`):

| Concern | Order |
|---|---|
| Endpoint | `tab.endpoint` → linked profile → page default |
| Auth (6H) | `tab.auth` layer → `profile.auth` → page `gql_auth_v1` |
| Polling | tab override → page default |
| Batch | same resolved endpoint only; **Advanced Settings → Batch** |

**Edit routing:** single tab with no override → writes page default; multi-tab or override → writes `tab.auth` via `updateActiveTabAuth` / `clearActiveTabAuth`.

For PT-1…PT-12 design notes and pre-6H auth bug context, see git history on this file (pre-2026-07-01).

---

## Phase 6H — Per-tab auth (shipped summary)

> **Shipped:** Option D — explicit inherit chain + bottom **Auth** tab (primary editor) + connection-bar badge (status/focus).  
> **Mockups (canonical):** [`gql-per-tab-auth-index.html`](mockups/gql-per-tab-auth-index.html) → Option D → [`gql-auth-option-d.html`](mockups/gql-auth-option-d.html)

**Stored `GqlStudioTab.auth`:**

| Value | Meaning |
|---|---|
| *absent* | Inherit workspace (`profile → page`) |
| `null` | Explicit No Auth on tab |
| `{ type: 'inherit', globalProfileId? }` | Inherit catalog profile |
| `{ type: 'bearer' \| … }` | Explicit override |

**Key files:** `tabPersistence.ts`, `tabConnectionResolution.ts`, `useGqlStudioTabs.ts`, `GraphqlAuthPanel.tsx`, `GraphqlConnectionBar.tsx`, `GqlBottomPanel.tsx`, `authUtils.ts`.

**Lessons:** GQL-4 (`gql-auth-headers`), GQL-14 (`gql-multi-tab`) — bottom Auth panel selectors.

**Tests:** `tabConnectionResolution.test.ts`, `GraphqlAuthPanel.test.tsx`, `GqlBottomPanel.test.tsx`.

Full slice-by-slice implementation spec (Slices 1–7) removed from this file — see git commit before 2026-07-01 slim-down if needed.

---

## Success criteria (exit gate)

- [x] Phases 1–6G + TLS transport implemented and unit-tested
- [x] Phase 6H per-tab auth (Option D)
- [x] 19 demo lessons registered with unit tests
- [x] §11.0 acceptance E2E (`demo-gql-workspace-isolation.spec.ts`)
- [x] Phase 8 human validation — **19/19** (2026-06-27)
- [x] Optional 6G-7 batch-group E2E (two endpoints)

---

## Notes

- `ws-graphql.ts` is a **WebSocket category** lesson (port 4100) — not GraphQL Studio tab scope.
- Lesson 9 retitled from “Code Generation” to match shipped export surfaces (Builder + cURL).
- Batch lesson (GQL-15) uses Advanced Settings selectors (`gql-adv-batch-tab-cb-*`) — Phase 6G.
- Phase 6H aligns auth with WebSocket Studio (`tab.auth`) and Requests (inherit chain); avoid Postman-style page-only auth.
