# Catalog Demo Lessons — Comprehensive Plan

> **Domain:** `api` → `catalog` category
> **Status:** v2 redesign — replaces CAT-1 through CAT-4

---

## Current Problems (Why Redesign)

The existing 4 lessons (CAT-1 through CAT-4) leave major Catalog features uncovered:

| Feature | Current Coverage |
|---|---|
| Import from Gallery | ✅ CAT-1 |
| Overview tab tour | ✅ CAT-1 |
| Browse endpoints | ✅ CAT-1 |
| Host Strategy | ✅ CAT-1 (added later, thin) |
| Try It Out (POST) | ✅ CAT-2 |
| Path parameters | ✅ CAT-2 |
| cURL copy | ✅ CAT-2 |
| Send to Harness | ✅ CAT-2 (mention only, no walkthrough) |
| Expose to Workflow | ✅ CAT-2 (mention only, no walkthrough) |
| Export one endpoint | ✅ CAT-3 (partial) |
| Coverage badges | ✅ CAT-3 |
| Bulk Export tab | ✅ CAT-3 (brief) |
| Convert Swagger → OpenAPI | ✅ CAT-4 (9 steps, well-done) |
| **Re-import / Update** | ❌ Not covered |
| **Export Original Spec** | ❌ Not covered |
| **Version History** | ❌ Not covered |
| **Version Compare (Diff)** | ❌ Not covered |
| **Version Restore** | ❌ Not covered |
| **Auth panel (Authorize)** | ❌ Not covered |
| **Verify Auth** | ❌ Not covered |
| **Send to Harness (after 2xx)** | ✅ CAT-2 steps 4–5 |
| **Export to Requests — full walkthrough** | ❌ Incomplete (env table, custom names, sample toggles, target group, preview tree) |
| **Edit / Microservice linking** | ❌ Not covered |

The existing lessons also have structural issues:
- CAT-2 mentions "Send to Harness" and "Expose to Workflow" as text-only spotlights without actually demonstrating the actions
- CAT-3 only has 3 steps — too thin for the rich Export to Requests feature
- Host Strategy was retrofitted into CAT-1 as an extra step rather than being taught in context (before Try It Out execution)

---

## Design Goals

1. **Cover every Catalog feature** — no gaps. Every button, modal, and tab the user might encounter
2. **Logical learning journey** — each lesson builds on the prior one's knowledge
3. **Actually demonstrate actions** — click Send to Harness, don't just spotlight the button
4. **Appropriate depth** — Export to Requests is rich and deserves a full lesson, not 1 step
5. **Version management as a dedicated lesson** — Re-import, Export Spec, Version History, Compare, Restore are a coherent feature set

---

## Lesson Summary

| # | ID | Title | Steps | Est. Time | Key Features Covered |
|---|---|---|---|---|---|
| CAT-1 | `cat-import-browse` | Import & Explore Your API | 4 | 4 min | Import (Gallery), Overview tab, Browse endpoints, Filter |
| CAT-2 | `cat-try-execute` | Live API Execution | 7 | 8 min | Host Strategy, Try It Out (POST + GET), Send to Harness Target + Options, Auth panel, cURL |
| CAT-3 | `cat-export-requests` | Export & Workflow Exposure | 10 | 10 min | Single export, Export tab walkthrough, Envs/names/preview, Coverage badges, Send to Harness, Expose to Workflow (Preview + Published), Published panel (View Usage, Republish Stale, Promote Preview) |
| CAT-4 | `cat-version-lifecycle` | Version Management & Spec Lifecycle | 5 | 5 min | Export Spec, Re-import/Update, Version History, Compare, Restore |
| CAT-5 | `cat-convert-openapi` | Convert Swagger 2.0 → OpenAPI 3 | 6 | 5 min | Convert modal, Engine selection, Lint, Prettify, Save as version, Batch Convert |
| **Total** | | | **30** | **~29 min** | |

---

## Prerequisite: Seeded Data

All lessons share a seeded **JSONPlaceholder API** entry (imported via `cat-demo-helpers.ts`).
CAT-5 additionally seeds a **Swagger 2.0 Petstore** entry.

---

## CAT-1: Import & Explore Your API

**Goal:** Import an OpenAPI spec and understand the Catalog's information architecture — Overview metadata, endpoint structure, and search.

| Field | Value |
|---|---|
| `id` | `cat-import-browse` |
| `estimatedMinutes` | 4 |
| Steps | 4 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog']` |

**Public API:** JSONPlaceholder (from Sample Gallery)

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `cat1-import` | Import from the Sample Gallery | `CAT.IMPORT_BTN` | Click **+ Import Spec** → modal opens → spotlight the **4 import tabs** (Upload, Paste, URL, Gallery — 1200ms) → switch to **Sample Gallery** → spotlight gallery cards → pick **JSONPlaceholder API** → spotlight **preview panel** (title, version, endpoint count, servers, tags — 1000ms) → click **Import** → spotlight new entry in sidebar (1000ms) |
| 2 | `cat1-overview` | Tour the Overview | `CAT.OVERVIEW_TAB` | Switch to **Overview** tab → spotlight **format badge** ("OpenAPI 3.0.3") and spec size → spotlight **Servers** section (base URL) → spotlight **method stats** chart (GET/POST/PUT/DELETE bar) → spotlight **By Tag** breakdown (posts, comments, users, todos) → spotlight **Quick Actions** row (Re-import, Export Spec, Convert/Upgrade, Version History — 1200ms, describe what each does) |
| 3 | `cat1-endpoints` | Browse Endpoints by Tag | `CAT.ENDPOINTS_TAB` | Switch to **Endpoints** tab → spotlight **tag folders** (posts, comments, users, todos) → expand **posts** folder → spotlight **endpoint list** (GET, POST, PUT, DELETE with summaries — 1000ms) → expand **GET /posts** card → spotlight **Parameters** section → spotlight **Response 200** section (example value + model tabs) → collapse card |
| 4 | `cat1-filter` | Filter & Explore | `CAT.ENDPOINT_FILTER` | Spotlight filter input → type `"user"` → spotlight **narrowed results** (only user-related endpoints — 1000ms) → clear filter → spotlight **Hide deprecated** checkbox (explain when it appears) → spotlight **resolved Base URL** at top (1000ms) |

**Cleanup:** Delete seeded JSONPlaceholder entry. Close any modals.

---

## CAT-2: Live API Execution

**Goal:** Execute real API calls from the Catalog — configure where requests go (Host Strategy), fill parameters, authenticate, and copy cURL commands.

| Field | Value |
|---|---|
| `id` | `cat-try-execute` |
| `estimatedMinutes` | 8 |
| Steps | 7 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog']` |

**Prerequisite:** JSONPlaceholder entry exists (seeded)

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `cat2-host` | Host Strategy — Where Requests Go | `CAT.HOST_STRATEGY` | Spotlight **From Spec** + server dropdown + Base URL. Click **Environment** → if unlinked, Edit modal opens → spotlight **Microservice** select → pick a service → Save → click Environment again → open env dropdown, spotlight options (env name + base URL), select one → spotlight Base URL change. Click **Custom URL** → type `https://staging.example.com` → spotlight input + Base URL. Switch back to **From Spec**. |
| 2 | `cat2-try-post` | Try It Out — POST /posts | `CAT.endpointCard('POST', '/posts')` | Expand **POST /posts** → click **Try it out** → spotlight **auto-generated request body** from schema (1200ms, explain schema-based stub generation) → edit body `{"title":"Hello","body":"Demo","userId":1}` → spotlight edited body (600ms) → click **Execute** → spotlight **201 Created** status + timing (1000ms) → spotlight **response body** with generated `id: 101` (800ms) |
| 3 | `cat2-path-param` | Path Parameters — GET /posts/{id} | `CAT.endpointCard('GET', '/posts/{id}')` | Expand **GET /posts/{id}** → click **Try it out** → spotlight **Parameters table** with `{id}` editable input (1000ms) → fill `id=1` → **Execute** → spotlight **200 OK** response (800ms) → spotlight JSON body with resolved post data |
| 4 | `cat2-save-test` | Send to Harness — Choose Target | `CAT.SAVE_AS_TEST_BTN` | Click **Send to Harness** → modal opens → spotlight + select **Environment**, **Microservice** → create **Feature Group** + **Test Scenario** with paced highlights → click **Next** |
| 5 | `cat2-save-options` | Send to Harness — Options | `REQ.HARNESS_MODAL` | Spotlight target breadcrumb + preview card → Auth Mode cards → Validation cards → select **Status 200** → spotlight Confirm → **Cancel** (full confirm covered in Requests lesson) |
| 6 | `cat2-auth` | Authorize Your Requests | `CAT.AUTHORIZE_BTN` | Click **Authorize** → auth panel opens → spotlight **auth type selector** (Inherit from Spec, From Environment, No Auth, Bearer, Basic, API Key — 1200ms) → select **Bearer Token** → spotlight **token input** → fill `demo-token-2024` → spotlight **prefix field** (customizable) → spotlight **Verify Auth** button (explain it tests credentials) → close auth panel |
| 7 | `cat2-curl` | Copy as cURL | `CAT.CURL_BTN` | On expanded GET /posts/{id} → spotlight **cURL** button in execute bar → click → spotlight **cURL preview** with syntax highlighting (1000ms) → spotlight **multiline/single-line toggle** → spotlight **Copy** button → click Copy → close cURL popover |

**Cleanup:** Close harness modal. Reset host strategy to From Spec. Clear auth. Collapse all cards. Delete demo feature groups.

---

## CAT-3: Export & Workflow Exposure

**Goal:** Move API definitions from the Catalog into the Requests workspace, expose endpoints to the Workflow Designer (Preview and Published), and manage published endpoints from the governance panel — View Usage, Republish Stale, and Promote Previewed.

| Field | Value |
|---|---|
| `id` | `cat-export-requests` |
| `estimatedMinutes` | 10 |
| Steps | 10 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog', 'requests', 'workflows']` |

**Prerequisite:** JSONPlaceholder entry exists (seeded). A workflow with an HTTP node referencing POST /posts via `catalogRef` (seeded, for D1/D3 demos).

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `cat3-single-export` | Export One Endpoint | `CAT.EXPORT_TO_REQ_BTN` | Expand **GET /posts** → Try it out → spotlight **Export to Requests** button in execute bar (800ms) → click → export modal opens → spotlight **Collection Name** field (pre-filled with API name, "N new endpoints" badge) → spotlight **Target Group** selector (None, existing groups, + New Group) → spotlight **Environments** table (checkboxes per env, base URLs, Select All) → spotlight the selected endpoint row with **Custom Name** input (editable) and **Version** badge (NEW) |
| 2 | `cat3-configure` | Configure Export Options | `CAT.EXPORT_MODAL` | Spotlight **Sample toggle** on the endpoint row (include saved Try It Out values as sample body) → spotlight **preview tree** on the right panel (collection → env folder → method + name hierarchy — 1200ms, explain the tree structure) → confirm export → navigate to Requests tab → spotlight **created collection** (1000ms) → spotlight individual request item (800ms) |
| 3 | `cat3-bulk-tab` | Bulk Export — The Export Tab | `CAT.EXPORT_TAB` | Return to Catalog → switch to **Export to Requests** tab → spotlight full endpoint table (all 12 endpoints with checkboxes, groups, methods, descriptions, custom names, version badges — 1500ms) → spotlight **Select All** checkbox → deselect a few endpoints → spotlight **version badges** (NEW vs "from v1.0.0" for re-exports) |
| 4 | `cat3-coverage` | Coverage Badges — IN REQUESTS | `CAT.ENDPOINTS_TAB` | Switch back to Endpoints tab → spotlight **IN REQUESTS** badge on the exported GET /posts endpoint (1000ms) → hover badge → spotlight **coverage popover** showing the collection/folder path (800ms) → explain: click navigates to the request in the Requests workspace |
| 5 | `cat3-harness` | Send to Harness | `CAT.SEND_TO_HARNESS_BTN` | Expand **POST /posts** with Try It Out → click **Send to Harness** → modal opens → fill Target cascade (Environment, Microservice, create Feature Group, create Scenario) → Next → spotlight Options (Auth Mode, Validation — select Status 200) → Confirm |
| 6 | `cat3-expose-preview` | Expose to Workflow — Preview | `CAT.EXPOSE_TO_WORKFLOW` | Expand **POST /posts** → fill param values (e.g. `title=Demo`, `userId=1`) → open **Workflow Exposure** dropdown → select **Preview** → spotlight the saved Preview badge (◇) on the card (1000ms, explain: Preview is user-local, only you see this in the palette) → navigate to **Workflow Designer** → **Catalog** palette → spotlight **POST /posts** with Preview indicator |
| 7 | `cat3-expose-published` | Expose to Workflow — Published | `CAT.EXPOSE_TO_WORKFLOW` | Return to Catalog → open Workflow Exposure → select **Published** → **Publish modal** opens → spotlight **pre-filled values** from Preview carry-over (params, headers — 1200ms, explain: values entered during Preview are carried over so you don't re-type them) → spotlight **Version** badge + **Note** field → confirm → navigate to Workflow Designer palette → spotlight **POST /posts** with Published badge (📌) |
| 8 | `cat3-published-panel` | The Published Management Panel | `CAT.PUBLISHED_TAB` | Return to Catalog → switch to **Published** tab → spotlight the **Published Endpoints Panel** (table with all published endpoints — 1200ms) → spotlight **filter pills**: All / Current / Stale / Previews (1000ms each) → spotlight **method badge + path + API name** columns → spotlight **Status** column (Current vs Stale badges) → click **Stale** pill → spotlight filtered stale endpoints (1000ms, explain: stale = published from an older spec version) |
| 9 | `cat3-view-usage` | View Usage & Republish | `CAT.PUB_ACTIONS_MENU` | Click **⋮** on a published endpoint → spotlight menu items (View in Catalog, **View Usage**, Republish, Unpublish — 1200ms) → click **View Usage** → spotlight **inline usage row** expanding below showing "Referenced by 1 workflow — My Workflow (2 nodes: POST Create, POST Update)" (1500ms, explain: see which workflows depend on this endpoint before changing it) → close menu → spotlight **Republish All Stale** button in toolbar (1000ms, explain: one click to update all stale endpoints to the current spec version) |
| 10 | `cat3-promote-preview` | Promote Preview from Panel | `CAT.PUB_FILTER_PREVIEW` | Click **Previews** filter pill → spotlight the preview table (different columns: no checkbox, no Status — 1000ms) → click **⋮** on a preview item → spotlight **Promote to Published** action (800ms, explain: skip the endpoint card — promote directly from this panel) → click Promote → Publish modal opens with preview values pre-filled → confirm → spotlight the item now appearing in **All** published list with **Current** status (1200ms) |

**Cleanup:** Delete created Request collection. Unpublish workflow endpoints. Remove previews. Close modals.

---

## CAT-4: Version Management & Spec Lifecycle

**Goal:** Manage API spec versions — export the original spec, update with re-import, browse version history, compare changes, and restore previous versions.

| Field | Value |
|---|---|
| `id` | `cat-version-lifecycle` |
| `estimatedMinutes` | 5 |
| Steps | 5 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog']` |

**Prerequisite:** JSONPlaceholder entry with at least 1 version (seeded). A second version will be created during the lesson via re-import of a slightly different spec.

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `cat4-export-spec` | Export the Original Spec | `CAT.EXPORT_SPEC_BTN` | On the **Overview** tab → spotlight **Export Spec** button (800ms, explain: downloads the original imported YAML/JSON, not a re-serialized version) → click → spec file downloads → spotlight success feedback (800ms) |
| 2 | `cat4-reimport` | Re-import — Update the Spec | `CAT.REIMPORT_BTN` | Spotlight **Re-import** button on Overview (800ms) → click → import modal opens in **re-import mode** (title shows "Re-import / Update Specification") → spotlight **duplicate detection** (same title match) → paste/load an updated spec with additional endpoints → spotlight preview showing **"will add new version"** message → click **Update** → return to Overview (version count / endpoint totals visible; no whole-panel spotlight) |
| 3 | `cat4-history` | Browse Version History | `CAT.VERSION_HISTORY_BTN` | Click **Version History** on Overview → modal opens → spotlight **version list** (2 entries: original + updated — 1200ms) → spotlight per-version metadata: version label, format badge, CURRENT badge, import timestamp, spec size, changelog → spotlight **checkbox selectors** (for compare) |
| 4 | `cat4-compare` | Compare Two Versions | `CAT.VERSION_COMPARE_BTN` | Check both version checkboxes → spotlight **Compare** button → click → spotlight **diff summary** badges (+ added, − removed, ~ changed — 1000ms) → spotlight **Added endpoints** section (new endpoints from re-import) → spotlight **Changed endpoints** section (detail bullets: params, body, responses — 1000ms) |
| 5 | `cat4-restore` | Restore a Previous Version | `CAT.VERSION_RESTORE_BTN` | Spotlight **Restore** button on the original version (800ms) → click Restore → spotlight **confirmation** (original becomes active again) → close history modal → spotlight **Overview** showing restored version's endpoint count and format badge (1000ms, explain: Catalog now shows the original spec, but the updated version is still in history for future reference) |

**Cleanup:** Remove extra versions. Close modals.

---

## CAT-5: Convert Swagger 2.0 → OpenAPI 3

**Goal:** Convert a legacy Swagger 2.0 spec to modern OpenAPI 3.x — choose engine and target, validate, lint, prettify, and save as a new version.

| Field | Value |
|---|---|
| `id` | `cat-convert-openapi` |
| `estimatedMinutes` | 5 |
| Steps | 6 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog']` |

**Prerequisite:** Swagger 2.0 Petstore entry (seeded)

### Steps

| # | ID | Title | Highlight | What happens |
|---|---|---|---|---|
| 1 | `cat5-swagger-badge` | The Swagger 2.0 API | `CAT.FORMAT_BADGE` | Select seeded Petstore entry → spotlight **Swagger 2.0** format badge on Overview (800ms, explain: legacy format, modern tools expect OpenAPI 3.x) → spotlight **Convert / Upgrade OpenAPI** button (800ms) |
| 2 | `cat5-convert-open` | Open the Converter | `CAT.CONVERT_BTN` | Click **Convert / Upgrade OpenAPI** → modal opens → spotlight **live YAML preview** with line numbers (1000ms) → spotlight **engine selector** (swagger2openapi vs Scalar — explain difference) → spotlight **target version** (3.0, 3.1, 3.2 options) → select **OpenAPI 3.1** → spotlight **validation badge** turning green (800ms) |
| 3 | `cat5-lint-search` | Validate & Search | `CAT.CONVERT_SEARCH` | Spotlight **search bar** → search for `openapi: 3.1` → spotlight highlighted match in preview (800ms) → clear search → switch target to **3.0** → click **Deep lint** → spotlight lint results (advisory best-practice rules — 1000ms) → spotlight conversion **warnings** list (1000ms) |
| 4 | `cat5-prettify` | Prettify the Output | `CAT.CONVERT_PRETTIFY` | Spotlight **Prettify** toggle → click ON → spotlight re-ordered YAML (canonical key order: openapi, info, paths, components — 1000ms) → spotlight **Copy YAML** button (explain: copies prettified output to clipboard) |
| 5 | `cat5-save` | Save as New Version | `CAT.CONVERT_SAVE_BTN` | Spotlight **Save as new version** button (800ms) → click → modal closes → spotlight **Overview format badge** now showing **OpenAPI 3.0.3** (1200ms) → spotlight **version count** incremented → explain: original Swagger 2.0 preserved in Version History, new OpenAPI 3 is now active |
| 6 | `cat5-batch` | Batch Convert | `CAT.BATCH_CONVERT_BTN` | Re-seed Swagger 2.0 entry → spotlight **Batch Convert** sidebar button → click → toast confirms conversion → spotlight entry format badge now OpenAPI 3.x |

**Cleanup:** Remove seeded Petstore entry (or restore to Swagger 2.0). Close modals.

---

## Feature Coverage Matrix

Every Catalog feature mapped to its lesson:

| Feature | Lesson | Step |
|---|---|---|
| **Import — Sample Gallery** | CAT-1 | Step 1 |
| **Import — 4 input tabs** (Upload, Paste, URL, Gallery) | CAT-1 | Step 1 (spotlight) |
| **Overview — format badge, servers, stats** | CAT-1 | Step 2 |
| **Overview — quick action buttons** | CAT-1 | Step 2 |
| **Browse endpoints by tag** | CAT-1 | Step 3 |
| **Endpoint card — params, responses, model** | CAT-1 | Step 3 |
| **Filter endpoints** | CAT-1 | Step 4 |
| **Hide deprecated** | CAT-1 | Step 4 |
| **Resolved Base URL display** | CAT-1 | Step 4 |
| **Host Strategy — From Spec** | CAT-2 | Step 1 |
| **Host Strategy — Environment** | CAT-2 | Step 1 |
| **Host Strategy — Custom URL** | CAT-2 | Step 1 |
| **Try It Out — POST** | CAT-2 | Step 2 |
| **Schema-generated request body** | CAT-2 | Step 2 |
| **Execute & inspect response** | CAT-2 | Step 2 |
| **Try It Out — Path parameters** | CAT-2 | Step 3 |
| **Auth panel — type selector** | CAT-2 | Step 4 |
| **Auth — Bearer Token** | CAT-2 | Step 4 |
| **Auth — Verify Auth** | CAT-2 | Step 4 |
| **cURL copy (syntax highlight, toggle)** | CAT-2 | Step 5 |
| **Export one endpoint (from Try It Out)** | CAT-3 | Step 1 |
| **Export modal — collection name, target group** | CAT-3 | Step 1 |
| **Export modal — environments table** | CAT-3 | Step 1 |
| **Export modal — custom names, version badges** | CAT-3 | Step 1 |
| **Export modal — sample toggle** | CAT-3 | Step 2 |
| **Export modal — preview tree** | CAT-3 | Step 2 |
| **Export confirm → navigate to Requests** | CAT-3 | Step 2 |
| **Export to Requests tab (bulk)** | CAT-3 | Step 3 |
| **Select All / deselect endpoints** | CAT-3 | Step 3 |
| **Version badges (NEW vs re-export)** | CAT-3 | Step 3 |
| **Coverage badges — IN REQUESTS** | CAT-3 | Step 4 |
| **Coverage popover (navigate to request)** | CAT-3 | Step 4 |
| **Send to Harness (full modal walkthrough)** | CAT-3 | Step 5 |
| **Expose to Workflow — Preview** | CAT-3 | Step 6 |
| **Expose to Workflow — Published** | CAT-3 | Step 7 |
| **Preview-to-Published values carry-over (D5)** | CAT-3 | Step 7 |
| **Published Endpoints management panel** | CAT-3 | Step 8 |
| **Filter pills (All/Current/Stale/Previews)** | CAT-3 | Step 8 |
| **Stale vs Current status badges** | CAT-3 | Step 8 |
| **View Usage — workflow references (D1)** | CAT-3 | Step 9 |
| **Republish All Stale (D2)** | CAT-3 | Step 9 |
| **Promote Preview from panel (D4)** | CAT-3 | Step 10 |
| **Export Original Spec (download)** | CAT-4 | Step 1 |
| **Re-import / Update** | CAT-4 | Step 2 |
| **Re-import — duplicate detection** | CAT-4 | Step 2 |
| **Re-import — "will add new version"** | CAT-4 | Step 2 |
| **Version History modal** | CAT-4 | Step 3 |
| **Version metadata (label, format, date, size)** | CAT-4 | Step 3 |
| **Version Compare (diff)** | CAT-4 | Step 4 |
| **Diff summary badges** | CAT-4 | Step 4 |
| **Added/Removed/Changed endpoint sections** | CAT-4 | Step 4 |
| **Version Restore** | CAT-4 | Step 5 |
| **Convert Swagger 2.0 → OpenAPI 3** | CAT-5 | Steps 1-5 |
| **Batch Convert** | CAT-5 | Step 6 |
| **Engine selector (swagger2openapi vs Scalar)** | CAT-5 | Step 2 |
| **Target version selection** | CAT-5 | Step 2 |
| **Validation badge** | CAT-5 | Step 2 |
| **YAML search** | CAT-5 | Step 3 |
| **Deep lint** | CAT-5 | Step 3 |
| **Prettify toggle** | CAT-5 | Step 4 |
| **Copy YAML** | CAT-5 | Step 4 |
| **Save as new version** | CAT-5 | Step 5 |

---

## Implementation Priority

| Order | Lesson | Reason |
|---|---|---|
| 1 | CAT-1 | Foundation — import + understand the UI structure |
| 2 | CAT-2 | Core value — live execution, the "wow" moment |
| 3 | CAT-3 | Integration — bridges Catalog → Requests → Harness |
| 4 | CAT-4 | Lifecycle — version management for teams |
| 5 | CAT-5 | Power user — already mostly implemented, consolidate from 9→5 steps |

---

## Changes from Current Implementation

### CAT-1 (was: Import & Browse an OpenAPI Spec)
- **Remove** Host Strategy from this lesson (moved to CAT-2 where it's needed before Execute)
- **Add** deeper Overview tour (quick action buttons explained individually)
- **Keep** Gallery import + endpoint browsing + filter
- Reduced from 5 steps to 4

### CAT-2 (was: Try It Out & Execute → renamed to Live API Execution)
- **Add** Host Strategy as Step 1 (context: configure where requests go before executing)
- **Add** Auth panel walkthrough (Authorize button → type selector → Bearer → Verify)
- **Keep** POST Try It Out + Path parameters + cURL
- **Remove** "Send to Harness" and "Expose to Workflow" text-only spotlights (moved to CAT-3 where they're demonstrated properly)

### CAT-3 (was: Export to Requests & Coverage → renamed Export & Workflow Exposure, expanded significantly)
- **Expand** from 3 steps to 10 — the Export + Workflow Exposure features deserve thorough coverage
- **Add** full walkthrough of Export modal (collection name, target group, environments, custom names, sample toggles, preview tree)
- **Add** actual Send to Harness + Expose to Workflow demonstration (not just spotlight)
- **Move** Coverage badges to after export (natural flow)
- **Add** Expose to Workflow — Preview with parameter values (Step 6)
- **Add** Expose to Workflow — Published with values carry-over from Preview (D5) (Step 7)
- **Add** Published Endpoints management panel tour: filter pills, status badges (Step 8)
- **Add** View Usage inline row + Republish All Stale button (D1, D2) (Step 9)
- **Add** Promote Preview to Published from management panel (D4) (Step 10)

### CAT-4 (NEW: Version Management & Spec Lifecycle)
- **New lesson** covering Re-import, Export Spec, Version History, Compare, Restore
- These features were completely uncovered before

### CAT-5 (was: Convert Swagger 2.0 → OpenAPI 3)
- **Consolidate** from 9 steps to 5 (combine engine selection + target, combine search + lint)
- Same content, better pacing — 9 steps was too granular

---

## Shared Helpers (`cat-demo-helpers.ts`)

Existing helpers to keep:
- `seedCatalogEntry()` — import JSONPlaceholder from gallery
- `ensureCatalogSidebar()` — navigate to catalog tab
- `cleanupCatalogEntry()` — delete seeded entry

New helpers needed:
- `seedSwagger2Entry()` — import Petstore Swagger 2 (for CAT-5)
- `ensureEntrySelected(name)` — select entry by name
- `ensureEndpointExpanded(method, path)` — expand specific endpoint card
- `openVersionHistoryModal()` — open from Overview quick actions
- `closeVersionHistoryModal()` — close history modal
- `seedSecondVersion()` — re-import with modified spec (for CAT-4)
- `seedWorkflowWithCatalogRef(entryId, endpointId)` — seed a workflow with HTTP nodes that have `catalogRef` pointing to the given endpoint (for CAT-3 steps 8-10, D1/D3 demos)
- `ensurePublishedTab()` — navigate to the Published management tab
- `ensurePreviewEndpoint(entryId, endpointId, values)` — set Preview exposure with param values (for D4 promote demo)
- `publishEndpointForDemo(entryId, endpointId)` — quick publish for seeding stale state
- `republishStaleForDemo(entryId, endpointId)` — seed a stale state by updating spec version after publish

---

## Selectors Needed (`src/shared/selectors/cat.ts`)

Existing selectors to verify:
- `CAT.IMPORT_BTN`, `CAT.OVERVIEW_TAB`, `CAT.ENDPOINTS_TAB`, `CAT.EXPORT_TAB`
- `CAT.HOST_STRATEGY`, `CAT.HOST_FROM_SPEC`, `CAT.HOST_ENVIRONMENT`, `CAT.HOST_CUSTOM_URL`
- `CAT.AUTHORIZE_BTN`, `CAT.ENDPOINT_FILTER`
- `CAT.SEND_TO_HARNESS_BTN`, `CAT.EXPOSE_TO_WORKFLOW`
- `CAT.CURL_BTN`, `CAT.EXPORT_TO_REQ_BTN`

New selectors needed (D1–D5 management panel):
- `CAT.PUBLISHED_TAB` — Published view tab button
- `CAT.PUB_PANEL` — Published Endpoints Panel container
- `CAT.PUB_FILTER_ALL` — "All" filter pill
- `CAT.PUB_FILTER_CURRENT` — "Current" filter pill
- `CAT.PUB_FILTER_STALE` — "Stale" filter pill
- `CAT.PUB_FILTER_PREVIEW` — "Previews" filter pill
- `CAT.PUB_ACTIONS_MENU` — ⋮ actions menu on published row
- `CAT.PUB_ACTION_USAGE` — "View Usage" menu item
- `CAT.PUB_USAGE_ROW` — inline usage expansion row
- `CAT.PUB_BULK_REPUBLISH` — "Republish All Stale" toolbar button
- `CAT.PUB_PREVIEW_PROMOTE` — "Promote to Published" menu item
- `CAT.PUB_PREVIEW_REMOVE` — "Remove Preview" menu item

New selectors needed (existing features):
- `CAT.FORMAT_BADGE` — spec format badge on Overview
- `CAT.SERVERS_SECTION` — servers list on Overview
- `CAT.METHOD_STATS` — method bar chart on Overview
- `CAT.BY_TAG_SECTION` — tag breakdown on Overview
- `CAT.QUICK_ACTIONS` — quick action buttons row on Overview
- `CAT.REIMPORT_BTN` — Re-import button
- `CAT.EXPORT_SPEC_BTN` — Export Spec button
- `CAT.CONVERT_BTN` — Convert / Upgrade button
- `CAT.VERSION_HISTORY_BTN` — Version History button
- `CAT.VERSION_LIST` — version list in history modal
- `CAT.VERSION_COMPARE_BTN` — Compare button in history modal
- `CAT.VERSION_RESTORE_BTN` — Restore button per version
- `CAT.VERSION_DIFF` — diff results panel
- `CAT.CONVERT_SEARCH` — search bar in convert modal
- `CAT.CONVERT_PRETTIFY` — Prettify toggle
- `CAT.CONVERT_SAVE_BTN` — Save as new version button
- `CAT.CONVERT_LINT_BTN` — Deep lint button
- `CAT.EXPORT_MODAL` — export to requests modal
- `CAT.EXPORT_PREVIEW_TREE` — preview tree in export modal
- `CAT.AUTH_TYPE_SELECT` — auth type selector in auth panel
- `CAT.VERIFY_AUTH_BTN` — Verify Auth button
