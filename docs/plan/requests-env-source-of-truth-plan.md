# Requests — Environment Source-of-Truth & Collection Model Plan

**Status:** In progress
**Branch:** `feature/create-demo-request-catatalog`
**Owner:** —
**Created:** 2026-07-18

---

## 1. Background & Problem

The Requests workbench currently maintains its **own** environment registry, completely
separate from the app-level Environments configured in **Settings → Environments**. The two
lists share the word "environment" (and often overlapping names), but they are stored
separately and never synced. This produced the reported confusion:

- Adding an environment via the Collection modal's **"+ Add Env"** button (`production`,
  `staging`, `test`) did **not** appear in Settings → Environments.
- Collections could be flipped between **Direct URL** and **Multi-Environment** in the Edit
  modal even though the type is already chosen at creation.
- Sub-collections named after non-existent environments (e.g. `k1`) silently fall back to
  the collection's active environment, producing wrong/unresolved base URLs.

### Two disjoint environment systems (root cause)

| | System A — App / Global | System B — Requests-local |
|---|---|---|
| Type | `Environment[]` | `RequestEnv[]` (in `RequestsData`) |
| State/persistence | `useProjects()` → `environments` / `setEnvironments` | `useRequests()` → `data.environments`, `loadRequests`/`saveRequests` |
| UI | `src/features/environments/EnvironmentManager.tsx` (Settings) | Collection modal `+ Add Env` (`onAddEnv={wb.addEnv}`) |
| Consumers | global header selector, microservice base URLs | collection `baseUrls`, `selectedEnvId`, sub-collection binding |

The app already **bridges** the two by matching on env **name** when a collection is linked
to a microservice (`RequestEditor.tsx:179-192`, auth `:279-289`, sub-collection `:167-172`).
This is why `d01/t01/p01` exist in both lists — a structural crutch we will delete.

---

## 2. Finalized Design Decisions

### 2.1 Environment source of truth
- Environments come **only** from Settings → Environments.
- Remove `RequestsData.environments` and the in-modal **"+ Add Env"** (`onAddEnv` / `wb.addEnv`).
- Delete the name-bridging logic once everything keys off Settings env IDs.

### 2.2 Collection type is fixed at creation
- The `+` menu already picks the type: **Group** (`mode: 'group'`) / **URL Collection**
  (`mode: 'direct'`) / **ENV Collection** (`mode: 'multi-env'`).
- **Remove the URL Mode toggle** from the Edit Collection modal. To convert, recreate.

### 2.3 URL (Direct) collection
- Locked behavior: `mode: 'direct'`, Linked Microservice = **None**, Default Auth = **No Auth**.
  Each request owns its own hostname and its own auth.
- Edit modal shows **only Collection Name** (Linked Microservice, URL Mode, Default Auth all
  removed from the UI).
- Offers only 📁 **Folders** — **no** 📦 sub-collections.

### 2.4 ENV (Multi-Environment) collection
- Mode fixed to Multi-Environment (no Direct option).
- Environment **names read-only from Settings**; **"+ Add Env" removed**.
- **Linked Microservice = X** → per-env hostnames **read-only**, inherited from the
  microservice's per-env base URLs.
- **Linked Microservice = None** → per-env hostname boxes **editable** (manual config); only
  Settings env names are shown as rows.

### 2.5 Sub-collections (📦, ENV collections only)
- Created via a **dropdown of eligible environments** — no free-text name.
- **Eligible = envs that have a configured base URL for this collection**:
  - Linked microservice → the envs the microservice has base URLs for.
  - None (manual) → only the envs with a manually-filled hostname in the collection.
- Selecting an env sets both the sub-collection **name** and an explicit `selectedEnvId`.
- **One sub-collection per env** — envs already used are hidden from the dropdown (duplicates
  not allowed).
- If **no envs are configured**, "Add Sub-Collection" is **disabled** with a prompt to
  configure a base URL first.
- ⇒ `k1`-style orphans become impossible by construction.

### 2.6 Unresolved sub-collection behavior
- Do **not** silently fall back to the active env. (Made moot for new data by 2.5; still add a
  guard/warning for any legacy data.)

### 2.7 Active environment selection (`selectedEnvId`) — DECIDED
- **Keep both independent active-env selections** as they are today:
  - **Global header selector** (`selectedEnvId` from `useProjects`, paired with `selectedSvcId`)
    — drives Harness / Runner / Results (`useDerivedViewState.ts:29-37`). Unchanged.
  - **Requests-local selector** (`wb.selectedEnvId` in `RequestsData`) — the env pills in the
    request editor (`RequestEditor.tsx:552-568`), switched via `wb.setSelectedEnvId`. Stays
    independent from the header.
- Only the **env list/definitions** unify (always from Settings). The transient active
  selection stays as-is. ⇒ `RequestsData.selectedEnvId` / `setSelectedEnvId` are **kept**;
  only `RequestsData.environments` / `addEnv` / `removeEnv` are removed.

### 2.8 Migration — DECIDED (Option A)
- **No auto-migration** of orphaned sub-collections — the user will delete `k1` manually.
- Existing per-env keys (`RequestCollection.baseUrls`, `authPerEnv`,
  `RequestFolder.selectedEnvId`, `RequestFolder.baseUrls`) are keyed by **old `RequestEnv`
  UUIDs**, which differ from Settings env IDs even when names match. These must be **remapped
  by name** to Settings env IDs.
- This is a **runtime reconcile**, not a pure storage migration: it needs the Settings env
  list (loaded via `useProjects`), so it runs once both Settings envs and Requests data are
  loaded, rewrites keys, then persists.
- **Unmatched keys** (names with no Settings env — e.g. `production`, `staging`, `Server 1`,
  `test`): **dropped** (Option A). Show a **one-time toast** summarizing what was dropped so
  it is not silent. No auto-creation of Settings envs.
- **Catalog → Requests export** (`catalogExport.ts:162-201`) currently mints its own wb env
  IDs (reuse-by-name or new UUID) and builds `baseUrls` + per-env sub-collections. It must be
  **reworked** to resolve against Settings envs instead. This is active work in Phase 4, not
  just passive migration.

---

## 3. Current Architecture Reference (as-found)

| Concern | File / Location |
|---|---|
| Requests-local env registry | `src/features/requests/hooks/useRequests.ts:32,50-63,137-143` |
| `RequestsData.environments` type | `src/shared/types/index.ts:766-777` |
| Collection modal (`+ Add Env`) | `src/features/requests/components/RequestCollectionModal.tsx:299-339` |
| Modal wiring (`onAddEnv`, `environments`, `appEnvironments`) | `src/app/components/AppShellOverlays.tsx:61-73` |
| Sub-collection modal | `src/features/requests/components/SubCollectionModal.tsx` |
| Sub-collection creation (name→env match) | `src/features/requests/hooks/useRequests.ts:137-143` |
| Sub-collection inline name input | `src/features/requests/components/RequestsSidebar.tsx:411,481` |
| `+` create menu (URL/ENV/Group) | `src/features/requests/components/RequestsSidebar.tsx:585-592` |
| Env/base-URL resolution + name bridge | `src/features/requests/components/RequestEditor.tsx:167-192,268-289,552-568` |
| URL resolver | `src/features/requests/utils/requestUrlResolver.ts` |
| Settings env manager | `src/features/environments/EnvironmentManager.tsx` |
| Selectors (`REQ.ADD_ENV_*`) | `src/shared/selectors/req.ts:33,115-116` |

---

## 4. Implementation Phases

Each phase is independently testable. Run `npx tsc -b --noEmit` + scoped vitest after each.
**STOP for user verification before merging to `develop`.**

### Phase 1 — URL (Direct) collection modal simplification  ✅
- [x] In `RequestCollectionModal.tsx`, convert `mode` from state → derived const (no `setMode`);
      remove the URL Mode toggle entirely (type is fixed at creation via the `+` menu / edit).
- [x] When `mode === 'direct'`: render **only** Collection Name. Move the Linked Microservice
      dropdown, base-URL section, and Default Auth section **inside the `multi-env` branch**
      (so direct shows none of them).
- [x] `handleSave` for `direct`: early-return `onSave({ id?, name, mode:'direct',
      microserviceId: undefined, baseUrls: undefined, auth: { type:'none' }, authPerEnv:
      undefined })` — locks None / No-Auth even if the collection previously had them.
- [x] Simplify `isEnvMode` to `mode === 'multi-env'`; header subtitle for direct now reads
      "Full URLs & auth per request".
- [x] Suppress 📦 "Add Sub-Collection" when `ctxCol?.mode !== 'multi-env'` at both call sites
      in `SidebarContextMenu.tsx` (collection menu + folder menu).
- [x] Update tests:
  - `RequestCollectionModal.test.tsx`: reworked toggle test → `defaultMode:'multi-env'`; moved
    auth-field + linked-microservice tests to `multi-env` context; added direct name-only + lock
    tests + a "no URL Mode toggle" test. **104 pass.**
  - `SidebarContextMenu.part2.test.tsx`: two "add folder and sub-collection" tests → `multi-env`;
    added collection + folder "direct omits Add Sub-Collection" tests.

### Phase 2 + Phase 4 (merged) — Settings env source-of-truth  ✅
> Merged per user decision (2026-07-18): the ENV modal (Phase 2) is coupled to the runtime
> key-space flip + migration (Phase 4), so they shipped together. **Sub-collection env dropdown
> (Phase 3) and selector/demo-lesson cleanup (Phase 5) remain separate.**

- [x] Feed **Settings** `appEnvironments` into the `environments` prop at every call site
      (`Requests.tsx` → `RequestEditor`; `AppShellOverlays` → `RequestCollectionModal` +
      `SubCollectionModal`; `useHarnessPromotion` `PromotionContext`). The existing name-bridges in
      `RequestEditor`/`requestToScenario` collapse to identity once fed Settings envs, so the
      resolver/auth code needed no logic change — everything now keys off Settings env IDs.
- [x] Modal env rows render from Settings envs (read-only names); removed the "+ Add Env"
      input/button, `newEnvName` state, and `onAddEnv` prop wiring
      (`RequestCollectionModal.tsx`, `AppShellOverlays.tsx`). Empty/hint text now points to
      Settings → Environments.
- [x] Linked microservice → read-only inherited hostnames; None → editable hostname per env
      (unchanged; already Settings-sourced for linked).
- [x] `wb.selectedEnvId` is now a Settings env ID; env pills still switch it (independent of the
      global header per §2.7).
- [x] **One-time runtime reconcile** (`reconcileEnvKeys.ts` + `useRequests.reconcileEnvironmentKeys`,
      wired in `App.tsx`): remaps `collection.baseUrls` / `authPerEnv` / `folder.baseUrls` /
      `folder.selectedEnvId` / `data.selectedEnvId` from legacy `RequestEnv` IDs → Settings IDs by
      name; **drops unmatched keys** and shows a one-time toast; empties `data.environments` so it
      is idempotent. Guarded to wait until Settings envs have loaded.
- [x] Removed `addEnv` / `removeEnv` / `addEnvironments` from `useRequests`; `addSubCollection` no
      longer name-matches a wb env (takes an optional explicit `selectedEnvId` — Phase 3 supplies it).
- [x] **Reworked Catalog → Requests export**: `buildCatalogExport` keys off Settings env IDs
      (`existingEnvNames`), and `useCatalogExport` seeds new Settings envs via `setEnvironments`
      (no more wb-env minting). Threaded `appEnvironments` + `setEnvironments` through `App.tsx`.
- [x] Tests updated: `useRequests.test.ts`, `RequestCollectionModal.test.tsx`,
      `useCatalogExport.test.tsx`, `catalogExport.test.ts`, `useHarnessPromotion.test.tsx`,
      `App.test.tsx`. `tsc -b --noEmit` clean; touched suites green (app: 814 pass).

**Deferred, intentionally:**
- `RequestsData.environments` **field** kept in the type (populated only by legacy loaded data; the
  reconcile reads then empties it). Fully deleting the field is a later cleanup.
- `REQ.ADD_ENV_INPUT` / `REQ.ADD_ENV_BTN` selectors kept — still referenced by the REQ-3 demo
  lesson (`req-multi-env.ts`); removed in Phase 5.
- ~~**Pre-existing** `RequestAuthEditor.test.tsx` failure (5 tests, `AuthTypeSelect` combobox)~~
  **FIXED (2026-07-18):** the auth-type control is now the custom `AuthTypeSelect`
  (button + `role="listbox"`), not a native `<select>`. Added a `selectAuthType()` test helper
  (open trigger → click `role="option"`) for the 3 type-switch tests, and pointed the 2
  profile-select tests at the single remaining native `<select>` via `getByRole('combobox')`.
  Source untouched; 32/32 pass.

> **⚠️ Coupling finding (Phase 2 review, 2026-07-18).** Runtime base-URL resolution is entirely
> in **wb-env-ID space** today: `resolveBaseUrl` reads `resolvedColBaseUrls[selectedEnvId]` where
> `selectedEnvId = wb.selectedEnvId` (a `RequestEnv` UUID); linked collections bridge the
> microservice's Settings-env-keyed URLs → wb IDs by **name** (`RequestEditor.tsx:179-192`).
> `catalogExport.ts:170` mints wb env IDs fresh (`existingId ?? uuidv4()`), so wb IDs ≠ Settings
> IDs. Therefore, if the ENV modal keys `baseUrls`/`authPerEnv` by **Settings** IDs (per Phase 2),
> **manual (None-linked) multi-env base URLs stop resolving** until Phase 4 flips the runtime key
> space + migrates persisted keys. Linked collections are already Settings-sourced + read-only, so
> that half of Phase 2 is effectively already true. ⇒ Phase 2 (UI) and Phase 4 (runtime key space +
> migration) are coupled and cannot ship independently as originally split. **Sequencing decided
> with user below.**

### Phase 3 — Sub-collection env dropdown  ✅
- [x] New shared util `src/features/requests/utils/subCollectionEnvs.ts`:
      `resolveCollectionBaseUrls` (linked-microservice or manual base URLs, keyed by Settings env
      ID — mirrors `RequestEditor.resolvedColBaseUrls`), `usedSubColEnvIds` /
      `usedEnvIdsInCollection` (one-per-env, with legacy name-match fallback),
      `computeEligibleSubColEnvs`, `collectSubCollections`. Full unit tests (15).
- [x] Replaced free-text sub-collection name with an **inline eligible-env `<select>`**
      (`RequestsSidebar.renderNewFolderInput`, `data-testid="req-subcol-env-select"`) at both the
      collection-root and folder-level add sites; selecting an env commits immediately via
      `commitAddSubCollection` → `onAddSubCollection(colId, env.name, parentFolderId, env.id)`.
- [x] Eligible = Settings envs with a configured base URL for the collection, minus envs already
      bound to a sibling sub-collection (one-per-env). `startAddFolder` guards the sub-collection
      path: zero eligible → info toast, no input opened.
- [x] `SidebarContextMenu` receives `getSubColEligibleCount`; **"Add Sub-Collection" is disabled**
      (with "Configure a base URL for an environment first" tooltip) when no eligible envs.
- [x] `addSubCollection` sets explicit `selectedEnvId` from the picked env (no name match) — already
      wired from Phase 2; sidebar now supplies it.
- [x] `SubCollectionModal` env select is Settings-sourced via `resolveCollectionBaseUrls`
      (now also resolves **linked-microservice** base URLs) and excludes sibling-used envs
      (`usedEnvIdsInCollection`, keeping its own bound env selectable). Threaded `microservices`
      through `AppShellOverlays`.
- [x] **Legacy-orphan guard**: `resolveBaseUrl` no longer falls back to the workbench's active env
      when inside a sub-collection (`ctx.parentSubCollection` present → resolve strictly via
      `subColEnvId`). `RequestEditor` shows a red warning
      (`data-testid="req-subcol-orphan-warning"`) when a sub-collection has no resolvable env and no
      own base URLs.
- [x] Tests updated/added: `subCollectionEnvs.test.ts` (new), `RequestsSidebar.test.tsx`
      (dropdown UX, guard toast, eligible-count helper), `SidebarContextMenu.part2.test.tsx`
      (disabled state), `SubCollectionModal.test.tsx` (linked microservice + one-per-env),
      `SidebarContextMenu.test.tsx` (new prop). `tsc -b --noEmit` clean; touched suites green.

### Phase 4 — Remove `RequestsData.environments` + wire to Settings envs  ✅ (merged into Phase 2 above)
> Runtime keying, one-time migration, and catalog-export rework landed with Phase 2. Only the
> full removal of the `RequestsData.environments` **field** is deferred as a later cleanup.
- [ ] Remove `environments`, `addEnv`, `removeEnv` from `useRequests` / `RequestsData`.
      **Keep** `selectedEnvId` / `setSelectedEnvId` (Requests-local active selection stays —
      §2.7).
- [ ] Pass `appEnvironments` (Settings) everywhere `wb.environments` was used
      (`Requests.tsx`, `RequestEditor.tsx`, `AppShellOverlays.tsx`).
- [ ] Delete the name-bridging remap in `RequestEditor.tsx:179-192,268-289,167-172`; key
      directly off Settings env IDs.
- [ ] Env pills (`RequestEditor.tsx:552-568`) draw from Settings envs constrained to the
      collection's configured envs; still switch `wb.selectedEnvId` (independent of header).
- [ ] **Runtime reconcile migration** (§2.8, Option A): once Settings envs + Requests data are
      both loaded, remap `baseUrls` / `authPerEnv` / `folder.selectedEnvId` / `folder.baseUrls`
      keys from old `RequestEnv` UUIDs → Settings env IDs by name; **drop unmatched** keys and
      show a one-time toast summarizing drops; then persist.
- [ ] **Rework Catalog → Requests export** (`catalogExport.ts:162-201`) to resolve against
      Settings envs (no minting of wb env IDs). Update `catalogExport.test.ts`,
      `useCatalogExport.*`.
- [ ] Update tests: `requestUrlResolver.test.ts`, `RequestEditor.*.test.tsx`,
      `useRequests.test.ts`.

### Phase 5 — Demo lesson + docs  ✅
- [x] Created `useDemoSettingsEnvBridge` hook (`src/app/hooks/useDemoSettingsEnvBridge.ts`) exposing
      `__demoEnsureSettingsEnv(name)` / `__demoRemoveSettingsEnv(name)` on window; wired in
      `DemoShellHost`. Added adapter functions `ensureSettingsEnvironment` / `removeSettingsEnvironment`
      to `environmentAdapter.ts` + typed in `bridgeWindow.ts`.
- [x] Reworked `packages/demo-hub/src/lessons/api/req-multi-env.ts` (REQ-3): lesson `setup` now
      seeds "production" / "staging" in Settings via `ensureSettingsEnvironment`, `cleanup` removes
      them via `removeSettingsEnvironment`. `ensureEnvWithBaseUrl` no longer uses `ADD_ENV_INPUT` /
      `ADD_ENV_BTN`; it just waits for the base-URL row (which now exists because the env is in
      Settings). Removed dead `.req-mode-switcher` spotlight (Phase 1 removed that toggle).
- [x] Updated lesson specs: `request-demo-lessons.md` (`req3-add-env` → `req3-fill-env`),
      `request-demo-lessons-v2.md` (step 2 wording).
- [x] Removed `REQ.ADD_ENV_INPUT` / `REQ.ADD_ENV_BTN` selectors from `src/shared/selectors/req.ts`.
- [ ] Follow the [5-item demo-lesson done checklist](../guides/demo-lesson-done-checklist.md)
      (manual 1× run + rapid Next / E2E smoke / helper tests / selectors / tsc+vitest).
- [ ] Follow the [5-item demo-lesson done checklist](../guides/demo-lesson-done-checklist.md).

---

## 5. Testing Strategy

- `npx tsc -b --noEmit` after **every** batch (mandatory).
- Scoped vitest per touched file during dev.
- Product coverage: scoped batch runs; full gate only at PR/merge.
- E2E + full suite only before merging to `develop`.
- Manual visual check (web + Tauri) of: URL modal (name-only), ENV modal (linked read-only vs
  None editable), sub-collection dropdown (eligible/one-per-env/empty-disabled).

---

## 6. Affected Files (running list)

**Production**
- `src/features/requests/components/RequestCollectionModal.tsx`
- `src/features/requests/components/SubCollectionModal.tsx`
- `src/features/requests/components/RequestsSidebar.tsx`
- `src/features/requests/components/SidebarContextMenu.tsx`
- `src/features/requests/components/RequestEditor.tsx`
- `src/features/requests/Requests.tsx`
- `src/features/requests/hooks/useRequests.ts`
- `src/features/requests/utils/requestUrlResolver.ts`
- `src/app/components/AppShellOverlays.tsx`
- `src/shared/types/index.ts`
- `src/shared/selectors/req.ts`

**Tests**
- `src/features/requests/components/RequestCollectionModal.test.tsx`
- `src/features/requests/components/SubCollectionModal.test.tsx`
- `src/features/requests/hooks/useRequests.test.ts`
- `src/features/requests/components/RequestEditor.*.test.tsx`
- `src/features/requests/utils/requestUrlResolver.test.ts`
- `src/app/App.test.tsx`, `src/app/components/AppWorkbenchModals.test.tsx`

**Demo / docs**
- `packages/demo-hub/src/lessons/api/req-multi-env.ts`
- `docs/future/demo-lesson/request-demo-lessons.md`
- `docs/future/demo-lesson/request-demo-lessons-v2.md`

---

## 7. Open Items / Questions

- [x] Phase 4: remap for legacy `baseUrls`/`authPerEnv` keyed by old `RequestEnv` UUIDs →
      Settings env IDs (by name). **DECIDED (§2.8, Option A):** runtime reconcile, remap by
      name, drop unmatched keys with a one-time toast, rework catalog export.
- [x] Phase 4: `selectedEnvId`. **DECIDED (§2.7):** keep both independent selections; only the
      env list unifies to Settings. `RequestsData.selectedEnvId` is retained.

---

## 8. Changelog / Progress Log

- 2026-07-18 — Plan created; design finalized through discussion (env source of truth, URL
  name-only modal, ENV Settings-sourced rows, sub-collection eligible-env dropdown, one
  sub-collection per env, no orphan migration).
- 2026-07-18 — Resolved both Phase-4 open items. Migration = Option A (runtime reconcile,
  remap by name, drop unmatched with toast, rework catalog export). Active selection = keep
  both independent selectors; retain `RequestsData.selectedEnvId`. Branch set to
  `feature/create-demo-request-catatalog`.
- 2026-07-18 — **Phase 1 implemented + reviewed.** URL Mode toggle removed (type fixed at
  creation); direct modal is name-only; direct save locks `microserviceId: undefined` +
  `auth:{type:'none'}`; microservice/base-URL/auth moved inside the multi-env branch; "Add
  Sub-Collection" suppressed for non-multi-env collections. `tsc -b --noEmit` clean; modal +
  context-menu tests pass (104). **Pre-existing (unrelated) failure noted:**
  `RequestAuthEditor.test.tsx` (5 tests) fails on branch HEAD — the auth-type control was
  refactored to `AuthTypeSelect` but the test still queries `getAllByRole('combobox')`. Not
  caused by Phase 1 (verified by stashing). Left for the user to confirm before touching.
- 2026-07-18 — **Phase 2 + Phase 4 (merged) implemented + reviewed.** Per user decision, the ENV
  modal change and the runtime key-space flip + migration shipped together (they are coupled
  through the base-URL key space). Everything now keys off **Settings env IDs**: Settings envs are
  fed into the `environments` prop at all call sites (name-bridges collapse to identity); "+ Add
  Env" removed; one-time reconcile migration (`reconcileEnvKeys.ts`) remaps legacy per-env keys by
  name and drops unmatched with a toast; catalog export reworked to key off Settings IDs + seed
  Settings envs via `setEnvironments`. `useRequests` no longer exposes `addEnv`/`removeEnv`/
  `addEnvironments`. `tsc -b --noEmit` clean; all touched suites green (app: 814 pass). Deferred:
  full removal of the `RequestsData.environments` field, `REQ.ADD_ENV_*` selectors (Phase 5 demo
  lesson still references them), and the pre-existing `RequestAuthEditor.test.tsx` failure.
- 2026-07-18 — **Pre-existing `RequestAuthEditor.test.tsx` failure fixed.** Test-only: migrated the
  5 stale `getAllByRole('combobox')` queries to the custom `AuthTypeSelect` API (trigger +
  `role="option"`) and the single native profile `<select>`. 32/32 pass; no source change.
- 2026-07-18 — **Phase 3 implemented + reviewed.** Sub-collections are now created via an inline
  eligible-environment dropdown (Settings envs with a configured base URL, minus sibling-used envs;
  one-per-env), replacing the free-text name — `k1`-style orphans are impossible by construction.
  "Add Sub-Collection" is disabled with a tooltip when no envs are eligible. Added shared util
  `subCollectionEnvs.ts` (resolves linked-microservice + manual base URLs by Settings env ID).
  `SubCollectionModal` now resolves linked-microservice base URLs and enforces one-per-env. Added a
  legacy-orphan guard: `resolveBaseUrl` no longer silently falls back to the active env inside a
  sub-collection, and `RequestEditor` surfaces a warning for unresolvable sub-collections.
  `tsc -b --noEmit` clean; all touched suites green (app: 814 pass).
- 2026-07-18 — **Phase 5 implemented.** REQ-3 demo lesson reworked: environments are now seeded in
  Settings via a new `useDemoSettingsEnvBridge` hook (exposes `__demoEnsureSettingsEnv` /
  `__demoRemoveSettingsEnv` on window) + adapter functions (`ensureSettingsEnvironment` /
  `removeSettingsEnvironment`). Lesson setup creates "production" / "staging" in Settings;
  cleanup removes them. `ensureEnvWithBaseUrl` no longer references `ADD_ENV_INPUT`/`ADD_ENV_BTN`.
  Removed dead `.req-mode-switcher` spotlight. Removed obsolete `REQ.ADD_ENV_INPUT` /
  `REQ.ADD_ENV_BTN` selectors from `src/shared/selectors/req.ts`. Updated lesson spec docs.
  `tsc -b --noEmit` clean. Demo-lesson 5-item checklist pending (manual 1× run + E2E smoke).
