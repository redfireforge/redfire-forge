# GraphQL Studio — Living Plan

> **Status:** Phases 1–6G + TLS transport + **Phase 6H** (per-tab auth) **shipped**. Phase 7 demo track **7A–7D ✅**; remaining work is QA/E2E.  
> **Last updated:** 2026-06-22 (P1 lesson quality ✅ · 7C ✅ · page split P3 ✅)  
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
| **Phase 6H — Per-tab auth (Option D)** | ✅ | Slices 1–7 ✅ — bottom Auth tab, badge focus, metadata auth-sent, GQL-4/GQL-14 lessons — see **§ Phase 6H** + [mockup index](mockups/gql-per-tab-auth-index.html) |
| Phase 7 demo track | ✅ | **7A ✅ · 7B ✅ · 7C ✅ · 7D ✅** — optional E2E/QA remain |

---

## Canonical code map

| Area | Path |
|---|---|
| Studio page | `src/features/graphql/GraphqlStudioPage.tsx` (~836 lines) + `components/GraphqlStudioSplitWorkspace.tsx` |
| Components / hooks / utils | `src/features/graphql/components/`, `hooks/`, `utils/` |
| Demo lesson registry | `src/features/demo-player/lessons/protocols/graphql-lessons.ts` |
| Selectors | `src/shared/selectors/gql.ts` |
| Server proxy | `src-server/routes/graphql/` |
| Studio E2E | `e2e/graphql-*.spec.ts` |
| Demo lesson E2E | `e2e/demo-gql-*.spec.ts` |
| Workflow nodes | `src/features/workflow/engine/graphRunnerGraphqlNodeHandlers.ts` |
| Docker test server | `docker/graphql/` · TLS stack `docker/graphql/tls/` |
| **Phase 6H mockups** | `docs/plan/future/graphql/mockups/gql-per-tab-auth-index.html` |

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
| 6G-7 | E2E: two resolved endpoints → two batch groups in Advanced Settings | P2 | ✅ |
| — | `GraphqlStudioPage.tsx` further split if it grows past ~900 lines | P3 | ✅ | Extracted `GraphqlStudioSplitWorkspace.tsx` (2026-06-22) |

New product scope beyond 6H should get a new phase section or a separate plan file.

---

## Open backlog (demo / QA — tracked in enhancement plan)

These are **not** Studio engineering tasks; listed here so this file stays the single “what’s left?” index.

| Item | Priority | Status | Detail |
|------|----------|--------|--------|
| §11.0 acceptance E2E | P0 | ✅ | `demo-gql-workspace-isolation.spec.ts` — user workspace survives GQL-1 |
| Phase 8 human validation | P0 | ✅ **19/19** | 1× auto-play Web + Tauri — complete 2026-06-27 (GQL-17 last) |
| Demo E2E GQL-19 | P2 | ✅ | `demo-gql-workflow-subscription.spec.ts` |
| GQL-3…13 + GQL-16 enhancement | P1 | ✅ | Diagrams, spotlight fixes — shipped 2026-06-22 |
| 7C — GQL-14 optional steps | P2 | ✅ | `gql14-profiles` + `gql14-polling` (10 steps, 6 min) |
| GQL-5 full Docker E2E in default CI | P3 | ✅ | `e2e-gql5-docker` job — `E2E_GQL5_DOCKER=1` + `npm run test:e2e:demo:gql5:ci` |

Full tables: **`graphql-demo-lesson-enhancement.md` § “Pending, Deferred & Not Implemented”**  
GQL-5 checklist: **`gql5-phase8-validation-checklist.md`**

---

## Deferred / not implemented (product)

Features explicitly **out of scope** or replaced by what shipped:

| Feature | Verdict |
|---------|---------|
| Multi-target Code Gen panel (TypeScript types, `python-gql`, file download) | **Not shipped** — Lesson 10 uses Builder SDL preview + History **Copy as cURL** |
| Per-tab independent PEM certificate stores | **Deferred** — page-level `gql_tls_certs_v1`; tabs inherit |
| Native Rust/webview TLS for custom CA/mTLS in Tauri | **Partially shipped** — `gql_http_fetch` + `gql_http_upload` + WS use rustls (2026-06-24); loopback/plain HTTP may still use Node `:3001` |
| Basic Auth / OAuth2 demo lesson beats | **Shipped** — GQL-4 `gql6-basic`, `gql6-oauth`, subscription cross-ref steps |
| GQL-20+ lesson slots | **Not started** — no registry entries |
| File upload / APQ / batch as standalone demo lessons | **Deferred** — power-user; mentioned in docs only |
| Demo-only history bucket (isolate lesson runs from user history) | **Future** — §11.0 tab isolation shipped; history filter optional |

---

## Phase 6 architecture (reference only)

Per-tab isolation is **shipped** for endpoint, TLS, polling, schema, and execution. Resolution chain lives in `tabConnectionResolution.ts`:

**Endpoint:** `tab.endpoint` → linked profile → page default  
**Auth (shipped — Phase 6H Slices 1–6):** `tab.auth` layer → profile.auth → page default (`gql_auth_v1`) — resolution + edit routing live  
**Auth (target — full Option D UX):** bottom **Auth** tab + badge status — see **§ Phase 6H Slice 7** and mockups index  
**Polling:** tab override → page default  
**Batch:** same resolved endpoint only; configure in **Advanced Settings → Batch**

For the original PT-1…PT-12 design notes, see git history on this file (pre-2026-06-22 slim-down).

---

## Phase 6H — Per-tab auth (Option D)

> **Problem:** Auth is stored page-wide (`gql_auth_v1`). The connection bar shows `resolvedTabAuth` for the active tab, but edits always write the page default — so two tabs on the same endpoint cannot use different credentials (e.g. local health check vs authenticated demo).  
> **Decision:** **Option D** — explicit inherit chain, implemented like endpoint/TLS (not headers-only, not profiles-only).  
> **UI mockups (canonical entry):** [`gql-per-tab-auth-index.html`](mockups/gql-per-tab-auth-index.html) — open in Chrome at **1280×900**, then click **Option D — Explicit inherit chain** → [`gql-auth-option-d.html`](mockups/gql-auth-option-d.html).

### Mockup suite (read from the index)

The index compares five interactive mockups. **Do not implement from Option A or the popover alone** when the decision is Option D.

| Mockup file | What it shows | Auth edit surface | Phase 6H relevance |
|-------------|---------------|-------------------|-------------------|
| [`gql-auth-option-current.html`](mockups/gql-auth-option-current.html) | Pre-6H bug — page auth only | Page badge (broken multi-tab) | ❌ Before |
| [`gql-auth-option-a.html`](mockups/gql-auth-option-a.html) | `tab.auth` + badge + tab dots | **Connection bar badge only** — bottom panel says *“auth via badge”*; **no Auth tab** | Slices 1–6 UX ≈ this |
| **[`gql-auth-option-d.html`](mockups/gql-auth-option-d.html)** | **Option A + inherit modes** | **Bottom Auth tab** (primary) + badge (status) + inherit banner + reset | **Target — Slice 7** |
| [`gql-auth-option-b.html`](mockups/gql-auth-option-b.html) | Profiles only | Profile picker bar | Shortcut only |
| [`gql-auth-option-c.html`](mockups/gql-auth-option-c.html) | Headers only | Headers panel | ❌ Rejected |

**What shipped in Slices 1–6:** Option D **data model** (inherit chain, `tab.auth`, resolution, batch) with Option **A-style UX** (connection-bar popover/badge — no bottom Auth tab). That is **not** full Option D per the index.

**What Slice 7 completes:** Option D **mockup UX** — docked Auth tab, badge focuses panel, response metadata auth-sent row.

### Why Option D

| Approach | Verdict |
|----------|---------|
| **Current (page auth only)** | Wrong — matches Postman GraphQL complaints; breaks multi-tab workflows |
| **Option A (`tab.auth` only)** | Fixes the bug; lacks clear inherit UX |
| **Option D (inherit chain)** | **Ship this** — matches Requests, WebSocket Studio, Bruno/Insomnia; three explicit modes |
| **Profiles only (Option B)** | Keep as shortcut; insufficient when same URL needs different auth |
| **Headers only (Option C)** | Reject as primary — breaks OAuth/WS `connectionParams`, GQL-4 lesson |

### Design contract

#### Stored states on `GqlStudioTab.auth`

| Stored value | Meaning | Resolution at execute time |
|--------------|---------|----------------------------|
| *field absent* (`undefined`) | **Inherit workspace** | `profile.auth → page.auth` |
| `null` | **Explicit No Auth** override | No auth headers / empty `connectionParams` |
| `{ type: 'inherit', globalProfileId }` | **Inherit global catalog profile** | `resolveEffectiveGqlAuth` via Environment Manager profile |
| `{ type: 'bearer' \| 'basic' \| 'apiKey' \| … }` | **Explicit override** | Use as-is (after env `{{var}}` substitution) |

Page-level auth (`gql_auth_v1`) remains the **workspace default** for new tabs and single-tab sessions — not live shared state for every tab.

#### Resolution order (single source of truth)

Add `resolveTabAuth(tab, profiles, pageDefaults)` in `tabConnectionResolution.ts`; wire into `resolveTabConnection().auth`:

```
1. resolveTabAuthLayer(tab)     → tab layer (undefined = inherit workspace; null = No Auth)
2. else if profile linked        → profile.auth (missing field → page default)
3. else                          → pageDefaults.auth
```

Profile auth applies only when the tab has **not** set its own auth layer (same rule as endpoint).

#### Edit routing (mirror Phase 6 PT-5/PT-6 endpoint/TLS)

```
usesPageDefaultAuth =
  tabs.length === 1
  && !hasActiveTabAuthOverride
  && !hasActiveTabProfileLink

handleConnectionAuthChange(newAuth):
  if usesPageDefaultAuth → handleAuthChange (writes gql_auth_v1)
  else:
    updateActiveTabAuth(newAuth, {
      clearProfileLink: hasActiveTabConnectionId && !isInheritGlobalAuth(newAuth),
    })
    // nextStored = computeTabAuthStoredValue(newAuth, pageDefaultAuth)
    // inherit-workspace / page-match edits do NOT unlink profile (Slice 3 fix)
    // updateActiveTabAuth only clears connectionId when clearProfileLink && nextStored !== undefined
```

`hasActiveTabAuthOverride` = `isTabAuthOverridden(activeTab)` from `tabConnectionResolution.ts` (`null` counts; bare `{ type: 'inherit' }` without `globalProfileId` does **not**).

`updateActiveTabAuth` uses `computeTabAuthStoredValue(newAuth, pageDefaultAuth)` — matching page default or bare inherit clears the tab field (inherit workspace), mirroring TLS override normalization.

**New tab:** `auth` absent → inherit workspace (do **not** copy previous tab's auth).  
**Duplicate tab:** same — inherit workspace, not copy source.

#### Auth edit surface (Slice 7 — Option D, shipped)

Slices 3–6 used a floating auth **popover** (Option A–style). **Slice 7.4 removed it** — primary editing is the **bottom Auth tab**; the connection bar badge focuses that tab.

| Edit surface (Option D target) | Stored layer | Badge (active tab) |
|--------------------------------|--------------|-------------------|
| **Bottom Auth tab** — inherit workspace | clear tab override (`undefined`) | Dashed `Inherit (…)` from resolved chain |
| **Bottom Auth tab** — inherit global profile | `{ type: 'inherit', globalProfileId }` | `Inherit (ProfileName)` |
| **Bottom Auth tab** — No Auth | `null` on tab, or page null | `No Auth` (+ tab pill when overridden) |
| **Bottom Auth tab** — Bearer / Basic / API Key / … | explicit object | Solid type label (+ tab pill when overridden) |

**Reset to inherit workspace:** `clearActiveTabAuth()` — visible when tab has an override.

Connection profiles stay as named endpoint+auth bundles; saving a profile still snapshots `resolvedTabAuth`. Applying a profile to a tab should clear `tab.auth` so profile auth applies.

### Implementation slices

Ship on branch `feature/gql-per-tab-auth-d`. Slices **1–7** ✅ (engine + Option D mockup UX).

> **Naming:** Slice 7 sub-steps use **7.1–7.6** — not `7A/7B/7D`, which are reserved for **Phase 7 demo track** (GQL-5 TLS, GQL-14 multi-tab, GQL-15 batch) in `graphql-demo-lesson-enhancement.md`.

#### Slice 1 — Data model + resolution (no UX change) ✅

| File | Change |
|------|--------|
| `utils/tabPersistence.ts` | Add `auth?: GraphqlAuth \| null`; `normalizeGraphqlAuth()`; handle in `normalizeTab` |
| `utils/tabConnectionResolution.ts` | Add `resolveTabAuth()`, `isTabAuthOverridden()`; wire into `resolveTabConnection().auth` |
| `utils/tabConnectionResolution.test.ts` | Resolution matrix + `isTabAuthOverridden` |
| `utils/tabPersistence.test.ts` | `normalizeGraphqlAuth`, tab auth round-trip, `loadAuth` inherit |
| `hooks/useGraphqlBatchExecution.test.ts` | Consumer test: tab.auth beats profile in batch headers |
| `utils/tabPersistence.ts` → `loadAuth()` | Use `normalizeGraphqlAuth()` (includes `'inherit'` + `globalProfileId`) |

**Consumers that need no logic change once Slice 1 lands** (already use `resolveTabConnection`):

- `useGqlActiveTabConnection`
- `useGraphqlStudioTabExecution`
- `useGraphqlBatchExecution`
- `buildGraphqlSchemaHeaders` / introspection
- `useSubscriptionOrchestration` (`buildConnectionParams`)

#### Slice 2 — Tab mutations + edit routing ✅

| File | Change |
|------|--------|
| `utils/tabPersistence.ts` | `graphqlAuthEquals()`, `computeTabAuthStoredValue()` |
| `hooks/useGqlStudioTabs.ts` | `updateActiveTabAuth`, `clearActiveTabAuth`, `hasActiveTabAuthOverride`, `pageDefaultAuth` |
| `hooks/useGqlTabConnectionHandlers.ts` | `usesPageDefaultAuth` routing in `handleConnectionAuthChange` |
| `GraphqlStudioPage.tsx` | Wire new handlers/flags |
| `*.test.ts` | Tab auth mutation + edit routing tests |

#### Slice 3 — Popover: three modes + reset ✅ *(interim — Option A UX)*

| File | Change |
|------|--------|
| `utils/gqlAuthPopoverUtils.ts` | `storedAuthToPopoverType`, `buildAuthTypeOptions`, `popoverShowsAuthOverride` |
| `components/GraphqlAuthForm.tsx` | *(was `GraphqlAuthPopover.tsx`)* — stored-auth editor; superseded by bottom Auth panel in Slice 7 |
| `components/GraphqlConnectionBar.tsx` | Pass stored vs resolved auth; wire `onResetAuthToInherit` |
| `GraphqlStudioPage.tsx` | Compute `usesPageDefaultAuth`, `storedAuthForPanel`, `resolvedAuthPreview` |
| `styles/graphql-studio.css` | Inherit banner, reset row, scope pill |
| `shared/selectors/gql.ts` | `AUTH_INHERIT_BANNER`, `AUTH_RESET_INHERIT_BTN`, etc. |
| `*.test.ts` | Popover three-mode + reset tests |

Popover edits **stored** layer (`page` auth or `tab.auth`); footer showed **resolved** preview. **Slice 7** migrated this UI into the bottom Auth tab; **Slice 7.4** removed the popover component.

#### Slice 4 — Badge + tab strip affordances ✅

| File | Change |
|------|--------|
| `utils/authUtils.ts` | `resolveGqlAuthBadgePresentation()` — label + variant (`inherit` / `override` / `profile` / `default`) + scope pill; `resolveTabAuthDotKind()` for tab strip |
| `components/GraphqlConnectionBar.tsx` | Badge variant CSS classes + scope pill on badge (when multi-tab or profile-linked) |
| `GraphqlStudioPage.tsx` | Compute presentation from resolved + override flags; pass `pageDefaultAuth` + `globalAuthProfiles` to tab bar |
| `components/GqlTabBar.tsx` | Auth dot per tab when `tabs.length > 1` |
| `styles/graphql-studio.css` | `.gql-auth-badge--inherit` (dashed) vs `--override` (solid ring) vs `--profile` (success tint); `.gql-tab-auth-dot--*` |
| `shared/selectors/gql.ts` | `AUTH_BADGE_SCOPE_PILL`, `TAB_AUTH_DOT` pattern |
| `*.test.ts` | Badge presentation matrix + tab dot + connection bar class tests |

**Badge rules (active tab, shows resolved auth):**

| State | Variant | Label | Scope pill |
|-------|---------|-------|------------|
| Inherit workspace (no tab override) | `inherit` (dashed) | `Inherit (Bearer)` / `Inherit (No Auth)` from resolved chain | `tab` when multi-tab |
| Profile-linked, no tab override | `profile` (green) | `Inherit (ProfileName)` | `profile` |
| Tab explicit override | `override` (solid) | `Bearer` / `No Auth` / `Inherit (CatalogProfile)` | `tab` |
| Single tab page default | `default` | `Bearer` / etc. (unchanged) | hidden |

#### Slice 5 — Demo lessons + helpers ✅

| Area | Action |
|------|--------|
| `graphql-auth-headers.ts` (GQL-4) | Step 8 + concept: auth is **per-tab** (page default when single tab); subscriptions use **active tab's** resolved auth |
| `graphql-lesson-helpers/core.ts` | `configureDemoTabInheritPageAuth()` / `clearActiveTabAuthOverride()` + popover quiet open/close |
| `lesson6-auth-headers.ts` | `selectNoAuth`, setup calls `configureDemoTabInheritPageAuth` |
| `graphql-multi-tab.ts` (GQL-14) | New step `gql14-per-tab-auth`: Tab 1 No Auth + Tab 2 Bearer; profiles step uses `AUTH_INHERIT_BANNER` |
| `lesson14-multi-tab.ts` | `ensureLesson14PerTabAuthConfigured`, tab auth guards, inherit banner helper |
| `shared/selectors/gql.ts` | No new selectors — `AUTH_RESET_INHERIT_BTN`, `AUTH_INHERIT_BANNER` already present |

Run affected lesson unit tests; E2E at develop merge gate only.

#### Slice 6 — Edge cases ✅

| Case | Handling |
|------|----------|
| Save connection profile | Unchanged — `resolvedTabAuth` snapshot |
| Apply profile to active tab | Clear `tab.auth`; auth from profile (`useGqlStudioTabs.test.ts`) |
| Batch execution | Per-tab via `resolveTabConnection` (`useGraphqlBatchExecution.test.ts`) |
| Demo tab cleanup | `closeDemoWorkspace`: strip `auth` on demo tabs being removed; restore `priorPageAuth` snapshot captured in `prepareDemoWorkspace`; dispatch `GQL_PAGE_AUTH_RELOAD_EVENT` so Studio re-hydrates page auth |
| Migration | None — absent `auth` = inherit workspace (existing tabs unchanged) |

**Slice 6 files:** `tabPersistence.ts` (`capturePageAuthSnapshot`, `restorePageAuthSnapshot`, `stripDemoTabAuthOverride`), `gqlDemoWorkspace.ts` (session snapshot + close restore), `useGraphqlConnectionSettings.ts` (auth reload listener).

#### Slice 7 — Option D bottom Auth panel (mockup UX) ✅

> **Gap vs index:** Open [`gql-per-tab-auth-index.html`](mockups/gql-per-tab-auth-index.html) → **Option D**. Compare to [`gql-auth-option-a.html`](mockups/gql-auth-option-a.html) (what Slices 1–6 UX resembles). Option D adds the **bottom Auth tab** as the primary editor; Option A explicitly says auth is configured via the **badge only**.

##### Mockup parity checklist (Option D interactive mockup)

| Surface | [`gql-auth-option-d.html`](mockups/gql-auth-option-d.html) | Shipped |
|---------|-----------------------------------------------------------|---------|
| Connection bar badge | Status (dashed inherit / solid override) | ✅ Badge → focus Auth tab |
| Bottom panel **Auth** tab | Primary edit surface | ✅ |
| Inherit banner (dashed) | Top of Auth panel | ✅ Docked panel |
| Two-tone form rows | Auth type + fields | ✅ `.gql-auth-panel-form` |
| Reset to inherit | Link in override banner | ✅ Panel banner |
| Resolved preview | Footer of Auth panel | ✅ Panel footer |
| Response metadata | “Request sent with: Authorization: …” | ✅ Dedicated auth-sent row |
| Query tab auth dots | Per-tab glance | ✅ |
| Bottom **Fragments** tab | In mockup | Out of scope |

##### Slice 7.1 — Extract shared auth form ✅

| File | Change |
|------|--------|
| `components/GraphqlAuthForm.tsx` | ✅ Shared form: type select, profile picker, bearer/basic/apiKey fields, inherit banners, reset link |
| `components/GraphqlAuthForm.test.tsx` | ✅ Field/banner/reset tests migrated from popover tests |

**Shared props (`GraphqlAuthFormProps`):**

```typescript
storedAuth: GraphqlAuth | null | undefined;
resolvedPreview: string;
authScope: 'page' | 'tab';
hasAuthOverride?: boolean;
onResetToInherit?: () => void;
onChange: (auth: GraphqlAuth | null) => void;
linkedProfileName?: string | null;
globalAuthProfiles?: GlobalAuthProfile[];
defaultAuthProfileId?: string | null;
// Panel-only two-tone rows (Slice 7.4 removed popover layout)
```

##### Slice 7.2 — Bottom Auth panel component ✅

| File | Change |
|------|--------|
| `components/GraphqlAuthPanel.tsx` | ✅ Docked panel wrapping `GraphqlAuthForm` |
| `styles/graphql-studio.css` | Port mockup `.auth-panel-form`, `.form-row`, `.inherit-banner` using design tokens (two-tone label column, 48px rows, custom select chevron) |
| `shared/selectors/gql.ts` | `BOTTOM_TAB_AUTH`, `AUTH_PANEL`, `AUTH_PANEL_INHERIT_BANNER`, `AUTH_PANEL_RESET_LINK`, `AUTH_PANEL_PREVIEW` |

**Panel states (match mockup `panels[0]` / `panels[1]`):**

| State | Banner | Type select | Fields |
|-------|--------|-------------|--------|
| Tab inherits workspace | Dashed “Inheriting **workspace default**: … uses gql_auth_v1” | Inherit workspace (or disabled until override) | Optional “Switch to explicit override…” CTA |
| Tab inherits profile (linked, no override) | “Inheriting auth from profile **X**” | Inherit global profile | Profile picker |
| Tab explicit override | Solid border “This tab **overrides** workspace default” + reset link | Bearer / Basic / API Key / No Auth / Inherit modes | Type-specific fields |
| Single-tab page default | “Editing **page default** — applies to new tabs” scope hint | Full type list | Writes `gql_auth_v1` via existing routing |

##### Slice 7.3 — Wire into `GqlBottomPanel` + `GraphqlStudioPage` ✅

| File | Change |
|------|--------|
| `graphqlStudioPageTypes.ts` | Extend `BottomPanelTab` → `'variables' \| 'headers' \| 'auth' \| 'files'` |
| `components/GqlBottomPanel.tsx` | Auth tab button with dot badge when `hasAuthOverride`; render `GraphqlAuthPanel` |
| `GraphqlStudioPage.tsx` | Pass auth props; persist `bottomTab` selection per tab optional (default: remember last) |
| `components/GraphqlConnectionBar.tsx` | **Badge click → `onFocusAuthPanel()`** instead of opening popover (or open panel + remove popover after migration) |
| `GraphqlStudioPage.tsx` | Implement `focusAuthPanel`: `setBottomTab('auth')` |

**Tab order:** Variables · Headers · **Auth** · Files (Auth before Files; Files stays for multipart uploads).

##### Slice 7.5 — Response Metadata “auth sent” row ✅

| File | Change |
|------|--------|
| `utils/gqlAuthResolve.ts` | Add `describeAuthSentMetadata(resolvedAuth, source: 'page' \| 'tab' \| 'profile')` |
| `engine/` or execution hook | Stamp `authSource` on response metadata at execute time (or derive from tab state when rendering) |
| `components/GraphqlResponseViewer.tsx` | Metadata tab row: “Authentication sent” with mockup-style mono block |

##### Slice 7.6 — Demo lessons + selectors ✅

| File | Change |
|------|--------|
| `graphql-auth-headers.ts` (GQL-4) | Steps that open/configure auth → click **Auth bottom tab**, not popover |
| `graphql-multi-tab.ts` (GQL-14) | Per-tab auth step uses bottom panel |
| `graphql-lesson-helpers/core.ts` | `openAuthPanelQuiet`, `selectAuthInPanel` helpers |
| `e2e/graphql-lesson-smoke-helpers.ts` | Align selectors |

##### Slice 7.4 — Retire popover as primary editor ✅

| Decision | Outcome |
|----------|---------|
| Keep popover? | **Removed** — `GraphqlAuthPopover.tsx` deleted; Option D has no floating auth dialog |
| Migration | Connection bar badge click → focus Auth bottom tab |
| CSS / selectors | Popover styles and `AUTH_POPOVER*` selectors removed from `graphql-studio.css` / `gql.ts` |

##### Slice 7 tests (must pass)

1. Bottom Auth tab visible; Variables/Headers/Files still work
2. Single tab: panel edits write `gql_auth_v1`
3. Two tabs: Tab A bearer in panel, Tab B inherit banner — independent
4. Reset link in panel clears `tab.auth`
5. Badge click switches to Auth bottom tab (not popover)
6. Response Metadata shows auth-sent with source label after Execute
7. GQL-4 / GQL-14 lesson helpers target bottom panel selectors

```bash
npx vitest run src/features/graphql/components/GraphqlAuthForm.test.tsx
npx vitest run src/features/graphql/components/GraphqlAuthPanel.test.tsx
npx vitest run src/features/graphql/components/GqlBottomPanel.test.tsx
npx vitest run src/features/graphql/components/GraphqlConnectionBar.test.tsx
npx tsc -b --noEmit
```

**Visual validation:** Side-by-side at 1280×900 — running app vs [`gql-auth-option-d.html`](mockups/gql-auth-option-d.html) (linked from [mockup index](mockups/gql-per-tab-auth-index.html)). Switch query tabs in the mockup to verify inherit vs override panel states.

### Deferred (not in 6H)

- Duplicating tab copies source tab auth
- OAuth2 token acquisition (existing Phase 3 defer)
- Bottom-panel **Fragments** tab (mockup shows it; never shipped — separate feature)

### Files touched (estimate — Slices 1–6, shipped)

**Core (~12 files):**

`tabPersistence.ts`, `tabConnectionResolution.ts`, `useGqlStudioTabs.ts`, `useGqlTabConnectionHandlers.ts`, `GraphqlStudioPage.tsx`, `GraphqlAuthForm.tsx`, `GraphqlAuthPanel.tsx`, `GraphqlConnectionBar.tsx`, `authUtils.ts`, `graphql-studio.css`, + matching `*.test.ts`

**Lessons (~4 files):**

`graphql-auth-headers.ts`, `graphql-multi-tab.ts`, `graphql-lesson-helpers/core.ts`, `lesson6-auth-headers.ts`

**Likely unchanged (consume resolution only):**

`useGqlActiveTabConnection.ts`, `useGraphqlStudioTabExecution.tsx`, `gqlAuthResolve.ts` (maybe small helpers)

### Unit test scenarios (must pass before merge)

1. Single tab, no override → auth edit writes `gql_auth_v1`
2. Two tabs: Tab A Bearer, Tab B inherit workspace → independent resolution
3. Tab `{ type: 'inherit', globalProfileId }` while page is Bearer → tab uses catalog, not page
4. Tab explicit `null` while page is Bearer → no headers sent
5. Profile-linked tab, no `tab.auth` → uses `profile.auth`
6. Profile-linked tab, user edits auth → unlinks profile + sets `tab.auth`
7. Reset to inherit clears override; falls back profile → page
8. Batch: two batched tabs with different `tab.auth` → different headers per operation

**During development:**

```bash
npx vitest run src/features/graphql/utils/tabConnectionResolution.test.ts
npx vitest run src/features/graphql/hooks/useGqlStudioTabs.test.ts
npx vitest run src/features/graphql/hooks/useGqlTabConnectionHandlers.test.ts
npx vitest run src/features/graphql/components/GraphqlAuthForm.test.tsx
npx vitest run src/features/graphql/components/GraphqlAuthPanel.test.tsx
npx tsc -b --noEmit
```

**Before merge to `develop`:** full unit suite + coverage gate + user browser verify (two-tab localhost scenario) + **Slice 7 Option D panel vs mockup sign-off**.

### 6H success criteria

- [x] Slice 1 — `tab.auth` persisted in `gql_tabs_v1` with `normalizeTab` round-trip
- [x] Slice 1 — Resolution matrix unit-tested in `tabConnectionResolution.test.ts`
- [x] Slice 1 — `loadAuth()` persists page-level `{ type: 'inherit', globalProfileId? }` via `normalizeGraphqlAuth`
- [x] Slices 2–4 — Multi-tab resolution, edit routing, popover three modes, badge/tab dots
- [x] Slices 5–6 — Demo lessons + edge-case cleanup
- [x] **Slice 7** — Bottom **Auth** tab matches Option D mockup (index → Option D card)
- [x] Slice 7 — Connection bar badge focuses Auth tab (popover removed)
- [x] Slice 7 — Response Metadata auth-sent row with source label
- [x] GQL-4 / GQL-14 lessons updated for bottom Auth panel
- [ ] User sign-off: mockup vs app side-by-side before merge to `develop`

---

## Success criteria (exit gate)

Studio engineering is **done** when:

- [x] Phases 1–6G + TLS transport implemented and unit-tested
- [x] **Phase 6H per-tab auth (Option D)** — see **§ Phase 6H** checklist (user sign-off pending)
- [x] 19 demo lessons registered with unit tests
- [x] §11.0 acceptance E2E passes
- [x] Phase 8 human validation sign-off — **19/19 ✅** (2026-06-27)
- [x] Optional 6G-7 batch-group E2E (two endpoints)

---

## Notes

- `ws-graphql.ts` is a **WebSocket category** lesson (port 4100) — not GraphQL Studio tab scope.
- Lesson 9 was retitled from “Code Generation” to match shipped export surfaces (Builder + cURL).
- Batch lesson (GQL-15) uses Advanced Settings selectors (`gql-adv-batch-tab-cb-*`) — aligned with Phase 6G.
- Fragment panel partial-state safety fix applied in Summary panel (2026-06-20).
- **Phase 6H** aligns GraphQL auth with WebSocket Studio (`tab.auth` on persisted tabs) and Requests (explicit inherit chain). Industry reference: Bruno/Insomnia hierarchical auth; avoid Postman GraphQL page-only auth model.
- Per-tab auth mockups: `docs/plan/future/graphql/mockups/` (`gql-per-tab-auth-index.html`).
