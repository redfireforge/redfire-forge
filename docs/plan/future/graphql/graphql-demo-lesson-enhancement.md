# GraphQL Demo Lesson Enhancement Plan

> **Status:** **Complete** — 19 lessons shipped; Phase 8 human **19/19** (2026-06-27); merge gates ✅ (2026-06-28)  
> **Last updated:** 2026-07-01 (plan slim-down — removed enhancement history, issue catalogs, completed checklists)  
> **Doc policy:** **Living reference** for lesson authoring, roster, and demo workspace rules. Historical enhancement specs, root-cause analysis, and completed phase checklists live in git history — **do not append audit logs here**.

| Detail lives in | Path |
|---|---|
| Studio product status | [`graphql-studio-plan.md`](./graphql-studio-plan.md) |
| Phase 8 human validation | [`phase8-validation-checklist.md`](./phase8-validation-checklist.md) |
| GQL-5 TLS validation | [`gql5-phase8-validation-checklist.md`](./gql5-phase8-validation-checklist.md) |
| Full pre-slim plan | `git show HEAD~1:docs/plan/future/graphql/graphql-demo-lesson-enhancement.md` (or earlier commits) |
| Lesson authoring rules | [`.cursor/rules/demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc) |
| Demo E2E pitfalls | [`e2e/DEMO-LESSON-E2E-MEMO.md`](../../../../e2e/DEMO-LESSON-E2E-MEMO.md) |
| Done checklist (merge gate) | [`docs/guides/demo-lesson-done-checklist.md`](../../guides/demo-lesson-done-checklist.md) |

---

## Naming convention

| Term | Meaning |
|---|---|
| **GQL-N** | Demo Hub card order (**1–19**) — use in narration cross-refs |
| **`id`** | Stable kebab-case (`gql-first-query`) — never rename |
| **Step prefix** | Frozen per file (**§ Step id prefixes**) — **never rename** step ids |

Example: GQL-4 (`gql-auth-headers`) uses step prefix `gql6-*` because the file predates roster reorder.

---

## Implementation status (summary)

| Track | Status |
|---|---|
| Studio Phases 1–7 + 6H per-tab auth | ✅ |
| 19-lesson registry (`graphql-lessons.ts`) | ✅ |
| Enhancement pass GQL-1…19 (diagrams, spotlights) | ✅ |
| §11.0 demo workspace isolation (GQL-1…15) | ✅ |
| Phase 8 human Web + Tauri 1× | ✅ **19/19** |
| §11.0 acceptance E2E (`gql110`) | ✅ 5/5 |
| Demo E2E GQL-1…19 | ✅ |
| `@redfireforge/demo-hub` extraction | ✅ |

**No P0/P1 demo blockers remain.** New work = GQL-20+ or lesson maintenance only.

---

## Deferred / future (optional)

| Item | Notes |
|---|---|
| **GQL-20+** | No registry slots — add new `id` + roster row when scoped |
| Demo-only history bucket | Isolate lesson runs from user history — optional |
| File upload / APQ / batch as standalone lessons | Deferred — power-user topics |
| Per-tab independent PEM stores | Page-level `gql_tls_certs_v1`; tabs inherit |
| Bottom-panel **Fragments** tab | Mockup only — separate feature if scoped |

All prior P1 enhancement items (diagrams, spotlights, GQL-14/15 E2E, 7C profiles/polling) are **shipped** — see git history.

---

## Canonical lesson roster (19)

Registry: `packages/demo-hub/src/lessons/protocols/graphql-lessons.ts` — order must match this table and `graphql-smoke-e2e-alignment.test.ts`.

| Slot | `id` | Title | Steps | Est. | E2E spec (smoke) |
|------|------|-------|-------|------|------------------|
| GQL-1 | `gql-first-query` | Your First GraphQL Query | 13 | 7 min | `demo-gql-first-query.spec.ts` |
| GQL-2 | `gql-variables` | Variables & Arguments | 18 | 9 min | `demo-gql-variables.spec.ts` |
| GQL-3 | `gql-schema-exploration` | Schema Exploration | 10 | 5 min | `demo-gql-schema-exploration.spec.ts` |
| GQL-4 | `gql-auth-headers` | Authentication & Headers | 14 | 6 min | `demo-gql-auth-headers.spec.ts` |
| GQL-5 | `gql-https-tls` | HTTPS, TLS & Certificates | 18 | 10 min | `demo-gql-https-tls.spec.ts` 🐳 |
| GQL-6 | `gql-mutations` | Mutations | 19 | 10 min | `demo-gql-mutations.spec.ts` |
| GQL-7 | `gql-subscriptions` | Subscriptions | 15 | 8 min | `demo-gql-subscriptions.spec.ts` |
| GQL-8 | `gql-query-builder` | Query Builder | 11 | 4 min | `demo-gql-query-builder.spec.ts` |
| GQL-9 | `gql-collections-history` | Collections & History | 9 | 5 min | `demo-gql-collections-history.spec.ts` |
| GQL-10 | `gql-export-share` | Export & Share Queries | 5 | 3 min | `demo-gql-export-share.spec.ts` |
| GQL-11 | `gql-performance-tracing` | Performance Tracing | 8 | 4 min | `demo-gql-performance-tracing.spec.ts` |
| GQL-12 | `gql-schema-diff` | Schema Diff | 7 | 4 min | `demo-gql-schema-diff.spec.ts` |
| GQL-13 | `gql-mock-server` | Mock Server | 15 | 6 min | `demo-gql-mock-server.spec.ts` |
| GQL-14 | `gql-multi-tab` | Multi-Tab Workspaces | 12 | 6 min | `demo-gql-multi-tab.spec.ts` |
| GQL-15 | `gql-batch-execution` | Batch Execution | 10 | 6 min | `demo-gql-batch-execution.spec.ts` |
| GQL-16 | `gql-workflow-integration` | Workflow Integration | 13 | 8 min | `demo-gql-workflow-integration.spec.ts` |
| GQL-17 | `gql-workflow-runner` | Workflow Runner & Results | 10 | 5 min | `demo-gql-workflow-runner.spec.ts` |
| GQL-18 | `gql-workflow-mutation` | Mutation Node in Workflow | 15 | 8 min | `demo-gql-workflow-mutation.spec.ts` |
| GQL-19 | `gql-workflow-subscription` | Subscription Node in Workflow | 9 | 5 min | `demo-gql-workflow-subscription.spec.ts` |

**Total curriculum:** ~104 min (sum of `estimatedMinutes` — guarded by smoke alignment test).

**Arc:** Fundamentals (1–3) → Security (4–5) → Operations (6–7) → Productivity (8–10) → Analysis (11–13) → Studio power (14–15) → Workflow (16–19).

**Reference lessons (authoring quality bar):** GQL-1, GQL-2 — 700×430 diagrams, execute/observe step splits, `preAction` guards.

---

## Step id prefixes (frozen — do not rename)

| Card | `id` | File | Prefix |
|------|------|------|--------|
| GQL-1 | `gql-first-query` | `graphql-first-query.ts` | `gql1-*` |
| GQL-2 | `gql-variables` | `graphql-variables.ts` | `gql2-*` |
| GQL-3 | `gql-schema-exploration` | `graphql-schema-exploration.ts` | `gql4-*` |
| GQL-4 | `gql-auth-headers` | `graphql-auth-headers.ts` | `gql6-*` |
| GQL-5 | `gql-https-tls` | `graphql-https-tls.ts` | `gqlt-*` |
| GQL-6 | `gql-mutations` | `graphql-mutations.ts` | `gql3-*` |
| GQL-7 | `gql-subscriptions` | `graphql-subscriptions.ts` | `gql5-*` |
| GQL-8 | `gql-query-builder` | `graphql-query-builder.ts` | `gql7-*` |
| GQL-9 | `gql-collections-history` | `graphql-collections-history.ts` | `gql8-*` |
| GQL-10 | `gql-export-share` | `graphql-export-share.ts` | `gql9-*` |
| GQL-11 | `gql-performance-tracing` | `graphql-performance-tracing.ts` | `gql10-*` |
| GQL-12 | `gql-schema-diff` | `graphql-schema-diff.ts` | `gql12-*` |
| GQL-13 | `gql-mock-server` | `graphql-mock-server.ts` | `gql13-*` |
| GQL-14 | `gql-multi-tab` | `graphql-multi-tab.ts` | `gql14-*` |
| GQL-15 | `gql-batch-execution` | `graphql-batch-execution.ts` | `gql15-*` |
| GQL-16 | `gql-workflow-integration` | `graphql-workflow-integration.ts` | `gql11-*` |
| GQL-17 | `gql-workflow-runner` | `graphql-workflow-runner.ts` | `gql17-*` |
| GQL-18 | `gql-workflow-mutation` | `graphql-workflow-mutation.ts` | `gql18-*` |
| GQL-19 | `gql-workflow-subscription` | `graphql-workflow-subscription.ts` | `gql19-*` |

**Do not reorder `graphqlLessons[]` without updating this table and `graphql-smoke-e2e-alignment.test.ts`.**

---

## Demo workspace isolation (§11.0 — operational reference)

> **Status:** ✅ Shipped for GQL-1…15. Required reading before authoring or editing GraphQL Studio lessons.

**Problem solved:** Lessons run in the real GraphQL Studio. Without isolation, lesson setup wiped `gql_endpoint_v1` and polluted user tabs.

**Solution:** Reserved **demo tab** in slot 8. User tabs 1–7 and page defaults stay untouched.

| Constant | Value |
|---|---|
| `MAX_TABS` | 8 |
| `MAX_USER_TABS` | 7 |
| Demo reserve | Slot 8 while lesson active |

**Lifecycle:**

1. **Setup:** `ensureGqlDemoTab` → wipe old demo tabs → create demo tab → switch → set **tab** endpoint (not page).
2. **During lesson:** All fills/clicks on active demo tab only.
3. **Cleanup:** `closeGqlDemoTabs` → restore prior active tab → never clear page endpoint.

**Mutation rules:**

| OK on demo tab | Never during lesson |
|---|---|
| Tab `endpoint`, query, variables, headers | `fill(ENDPOINT, '')` on page default (single-tab writes page storage) |
| Demo tab label `Demo: …` | User tabs 1–7 content/labels |
| Prefer tab-scoped auth/TLS | Page-level `gql_auth_v1` / TLS unless unavoidable |

**`tabBudget` (PrerequisiteGate):**

| Lessons | `tabBudget` | Gate |
|---|---|---|
| GQL-1…13, 16…19 | 1 (default) | Demo uses slot 8; user may keep 7 tabs |
| GQL-14, GQL-15 | 2 | Block if user has 7 tabs open — need free slot for lesson tabs |

**Cleanup triggers:** exit live demo, restart, lesson switch, leave Demo Hub, orphan sweep on Studio mount (`purgeOrphanDemoTabs`).

**Key files:**

| File | Role |
|---|---|
| `packages/demo-hub/.../graphql-lesson-helpers/gql-demo-tab.ts` | `ensureGqlDemoTab`, `closeGqlDemoTabs` |
| `packages/demo-hub/.../graphql-lesson-helpers/gql-demo-core/` | Setup/cleanup, endpoint helpers |
| `src/features/graphql/utils/tabPersistence.ts` | `demoLessonId` on `GqlStudioTab` |
| `packages/demo-hub/src/useDemoHub.ts` | Wipe on exit/restart/selectLesson |
| `e2e/demo-gql-workspace-isolation.spec.ts` | 5 acceptance scenarios — `npm run test:e2e:demo:gql110` |

**Acceptance (all ✅):** User URL + tab title survive GQL-1; GQL-14 gate at 7 tabs; no `gql_endpoint_v1 = ''` from lesson setup.

---

## GQL-5 TLS — product notes (for maintainers)

| Topic | Verdict |
|---|---|
| Page PEM persistence | `gql_tls_certs_v1` — CA/client survive refresh |
| Tauri native TLS | rustls for fetch/upload/WS; loopback may use Node `:3001` |
| Docker fixtures | TLS `:4444`, mTLS `:4446`, plain `:4010` — `PrerequisiteGate` |
| APQ GET + PEM | PEM rejected on GET — use POST or skip-cert only |

Full TLS validation checklist: [`gql5-phase8-validation-checklist.md`](./gql5-phase8-validation-checklist.md).

---

## Authoring standards (quick reference)

Consolidated from shipped enhancement work — full rules in `.cursor/rules/demo-player-lessons.mdc`.

| Standard | Target |
|---|---|
| Concept diagram | **700×430** `viewBox`, studio chrome SVG |
| Spotlight | Match narration noun; split **action** vs **observe** steps |
| Delays | Tab switch 800ms+; auto-generate 1500–2000ms; outcome 800–1200ms |
| `preAction` | Recreate state; close stray modals |
| `estimatedMinutes` | ~25–35s per step at 1×; round up |
| Env seeding | `ensureDemoEnvironment` / `ensureDemoMicroservice` via adapters |
| Selectors | `GQL.*` from `src/shared/selectors/gql.ts` only |

**Gold-standard lesson files for copy-paste patterns:** `ws-tls-local.ts`, `ws-auth-transport.ts`, `kafka-workflow-produce.ts` (under `packages/demo-hub/src/lessons/protocols/`).

---

## E2E & validation commands

| Task | Command |
|---|---|
| Single lesson smoke | `npm run test:e2e:demo:gql{N}` (e.g. `gql1`, `gql14`) |
| §11.0 workspace isolation | `npm run test:e2e:demo:gql110` |
| Phase 8 full sweep | `./scripts/phase8-gql-e2e-sweep.sh` |
| Step/roster drift guard | `npx vitest run packages/demo-hub/src/lessons/protocols/graphql-smoke-e2e-alignment.test.ts` |
| Shared walk helpers | `e2e/graphql-lesson-smoke-helpers.ts` |

**Pitfalls:** Never `runNextStep` on final step; scope locators to `data-testid` panels — see `e2e/DEMO-LESSON-E2E-MEMO.md`.

---

## Reference files

| Area | Path |
|---|---|
| Lesson registry | `packages/demo-hub/src/lessons/protocols/graphql-lessons.ts` |
| Lesson wrappers | `packages/demo-hub/src/lessons/protocols/graphql-*.ts` |
| Shared helpers | `packages/demo-hub/src/lessons/protocols/graphql-lesson-helpers/` |
| Studio adapter | `packages/demo-hub/src/adapters/graphqlStudioAdapter.ts` |
| Selectors | `src/shared/selectors/gql.ts` |
| Studio page | `src/features/graphql/GraphqlStudioPage.tsx` |
| Tab resolution | `src/features/graphql/utils/tabConnectionResolution.ts` |
| TLS types / panel | `src/shared/types/gqlTls.ts`, `GraphqlTlsPanel.tsx` |
| Docker TLS stack | `docker/graphql/tls/` |
| Workflow gold standards | `packages/demo-hub/.../kafka-workflow-*.ts`, `ws-tls-local.ts` |

---

## Success criteria (exit gate)

- [x] 19 lessons registered with unit tests + smoke E2E
- [x] §11.0 demo workspace isolation + acceptance E2E
- [x] Phase 8 human validation 19/19 Web + Tauri
- [x] Enhancement quality bar (diagrams, spotlights) on GQL-1…19
- [x] Merge gates (vitest, coverage, E2E sweep)

**GraphQL Demo Hub Phase 8 is complete.** New lessons require a new plan section or GQL-20+ roster row.
