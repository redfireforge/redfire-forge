# API Testing Demo Lessons — Requests & Catalog

> **Domain:** `api` (currently "coming soon" in Demo Hub)  
> **Categories:** `requests`, `catalog`  
> **Branch:** `feature/api-testing-demo`

---

## Overview

This document plans demo lessons for the **Requests** workbench and **Catalog** features. These are the first lessons for the `api` domain, teaching users how to organize collections, send HTTP requests, import OpenAPI specs, and promote work into the Test Harness.

### Gallery Alignment Strategy

Each lesson references **existing gallery samples** and **training path manuals** rather than creating ad-hoc test data. This ensures:
- Lessons import the same samples users see in the Gallery tab
- Narration can reference training manual content by title
- Live APIs are confirmed working (JSONPlaceholder, DummyJSON, PokéAPI, etc.)

### Lesson Count Summary

| Category | Lessons | Total Steps | Est. Time |
|----------|---------|-------------|-----------|
| Requests | 6 | 56 | ~28 min |
| Catalog  | 4 | 40 | ~19 min |
| **Total** | **10** | **96** | **~47 min** |

---

## Available Gallery Assets

### Request Samples (13 entries in `src/data/galleries/requests/`)

| ID | Name | Category | Difficulty | Live API | Key Demo Use |
|----|------|----------|-----------|----------|------|
| `req-get-all-users` | Get All Users | crud | easy | jsonplaceholder.typicode.com | First GET, array response |
| `req-get-pokemon` | Get Pokémon Details | crud | easy | pokeapi.co | Nested JSON, path params |
| `req-random-dog` | Random Dog Image | crud | easy | dog.ceo | Simplest API call |
| `req-search-countries` | Search Countries by Name | search | easy | restcountries.com | Query params, rich models |
| `req-create-post` | Create a New Post | crud | easy | jsonplaceholder.typicode.com | POST + JSON body |
| `req-search-books` | Search Books | search | medium | openlibrary.org | Large payload search |
| `req-paginated-users` | Paginated User List | pagination | medium | dummyjson.com | limit/skip pagination |
| `req-product-search` | Product Search with Query | search | medium | dummyjson.com | Query param search |
| `req-update-resource` | Update a Resource (PUT) | crud | medium | jsonplaceholder.typicode.com | Full PUT |
| `req-delete-resource` | Delete a Resource | crud | medium | jsonplaceholder.typicode.com | DELETE + idempotency |
| `req-auth-login` | Auth Login (Token) | auth | medium | dummyjson.com | Login → token extraction |
| `req-echo-headers` | Echo Headers & Body | auth | advanced | httpbin.org | Custom headers, `{{$timestamp}}` |
| `req-multi-env-product` | Multi-Env Product Lookup | search | easy | dummyjson.com | Host strategy, multi-env |

### Catalog Specs (8 entries in `src/data/galleries/catalog-specs/`)

| ID | Name | Category | Difficulty | Endpoints | Live API |
|----|------|----------|-----------|-----------|----------|
| `catalog-jsonplaceholder` | JSONPlaceholder API | rest-api | easy | 12 | jsonplaceholder.typicode.com |
| `catalog-fakestore` | FakeStore API | rest-api | easy | 6 | fakestoreapi.com |
| `sample-catalog-pet-store` | Pet Store API | rest-api | easy | 13 | petstore.swagger.io* |
| `catalog-dummyjson` | DummyJSON Products | rest-api | medium | 14 | dummyjson.com |
| `catalog-pokeapi` | PokéAPI | public-api | medium | 10 | pokeapi.co |
| `catalog-rest-countries` | REST Countries | public-api | medium | 8 | restcountries.com |
| `catalog-httpbin` | HTTPBin Toolkit | microservices | advanced | 20 | httpbin.org |
| `sample-catalog-correlation-wait` | Correlation Wait API | webhooks | medium | 9 | localhost:3001 |

### Existing Training Paths (from `src/data/galleries/trainingPaths/contentPaths.ts`)

**Requests path** (14 manuals, 3 phases):
- Phase 1: Overview, Get All Users, Pokémon, Dog, Countries, Create Post
- Phase 2: Books, Paginated, Product Search, Update, Delete, Auth Login
- Phase 3: Response Detail Panel, Echo Headers

**Catalog path** (11 manuals, 4 phases):
- Phase 1: Overview, JSONPlaceholder, FakeStore
- Phase 2: DummyJSON, PokéAPI, REST Countries
- Phase 3: Pet Store, Correlation Wait, HTTPBin
- Phase 4: Send to Harness, Additional Environments

### Public API Overlap (Requests ↔ Catalog)

| Public API | Request Samples | Catalog Spec |
|------------|-----------------|--------------|
| jsonplaceholder.typicode.com | `req-get-all-users`, `req-create-post`, `req-update-resource`, `req-delete-resource` | `catalog-jsonplaceholder` |
| dummyjson.com | `req-paginated-users`, `req-product-search`, `req-auth-login`, `req-multi-env-product` | `catalog-dummyjson` |
| pokeapi.co | `req-get-pokemon` | `catalog-pokeapi` |
| restcountries.com | `req-search-countries` | `catalog-rest-countries` |
| httpbin.org | `req-echo-headers` | `catalog-httpbin` |

---

## Category: Requests

### REQ-1: Quick Start — Gallery to First Send

**Goal:** Get users from zero to their first successful HTTP call in under 4 minutes.

| Field | Value |
|-------|-------|
| `id` | `req-quick-start` |
| `estimatedMinutes` | 4 |
| Steps | 8 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'gallery']` |
| Prerequisites | None (public APIs) |

**Gallery Samples Used:**
- `req-get-all-users` — First GET (JSONPlaceholder, returns 10 users)
- `req-random-dog` — Simplest possible call (dog.ceo, returns image URL)

**Training Path Alignment:** Mirrors Phase 1 of "Request Basics" path (manuals: Request Basics Overview → Get All Users)

**Concept — "Your First HTTP Request"**
- What the Requests workbench is (HTTP client organized by collections)
- Gallery: pre-built samples against live public APIs
- Send → inspect response → explore headers/console → history

**Key Terms:**
- **Collection** — Folder of related API requests (like a Postman collection)
- **Gallery Sample** — Pre-built request with URL, headers, and validation ready to send
- **Response History** — Last 10 sends per request, restorable with one click

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req1-navigate` | Open Requests | Activity bar API icon | Navigate to Requests workbench |
| 2 | `req1-gallery` | Browse the Gallery | Gallery tab | Open Gallery → Requests domain → show sample cards |
| 3 | `req1-import` | Import "Get All Users" | Import button on card | Click Import on `req-get-all-users` → appears in "Gallery Samples" collection |
| 4 | `req1-select` | Select the Request | Sidebar request item | Click "Get All Users" in sidebar → editor opens |
| 5 | `req1-editor` | Tour the Editor | Request editor pane | Spotlight: method badge (GET), URL (`jsonplaceholder.../users`), tabs |
| 6 | `req1-send` | Send the Request | Send button | Click Send → watch status 200, timing badge, JSON body |
| 7 | `req1-response` | Inspect the Response | Response body | JSON tree: expand user object, use search to find "Leanne" |
| 8 | `req1-console` | Console & History | Console tab | Show request/response transcript, then open History dropdown |

---

### REQ-2: Collections & Organization

**Goal:** Teach collection modes, folders, sub-collections, and sidebar operations.

| Field | Value |
|-------|-------|
| `id` | `req-collections` |
| `estimatedMinutes` | 5 |
| Steps | 10 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'gallery']` |
| Prerequisites | None |

**Gallery Samples Used:**
- `req-get-all-users` — Import for first request
- `req-create-post` — Import as second request (POST, different method)
- `req-delete-resource` — Import to show method variety

**Training Path Alignment:** Supplements Phase 1 "Request Basics Overview" (organizational concepts not deeply covered in the path)

**Concept — "Organizing Your API Library"**
- Three collection modes: **Direct** (full URLs, badge: `URL`), **Multi-Env** (relative paths + base URLs, badge: `ENV`), **Group** (organizational, badge: `GRP`)
- Folders nest requests; Sub-collections pin to an environment with auth/URL overrides
- Drag-and-drop reorder; right-click context menu for all operations
- Import/Export preserves full collection structure as JSON

**Key Terms:**
- **Direct Collection** — URLs are absolute (`https://api.example.com/users`)
- **Multi-Env Collection** — URLs are relative (`/users`); base URL varies by environment
- **Group** — Organizational container for related collections (no requests directly)
- **Sub-Collection** — A folder pinned to a specific environment with optional URL/auth overrides

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req2-new-collection` | Create a Collection | + button | New Collection → Direct mode → name "JSONPlaceholder" |
| 2 | `req2-import-samples` | Import Gallery Requests | Gallery | Import `req-get-all-users` + `req-create-post` into the collection |
| 3 | `req2-new-folder` | Create a Folder | Context menu | Right-click collection → New Folder → "Posts" |
| 4 | `req2-drag` | Organize with Drag | Sidebar | Drag "Create a New Post" into Posts folder |
| 5 | `req2-rename` | Rename Inline | Request name | Click request name → rename to "Create Post (Demo)" |
| 6 | `req2-duplicate` | Duplicate & Edit | Context menu | Right-click → Duplicate → change method to PATCH |
| 7 | `req2-search` | Sidebar Search | Search input | Type "post" → filtered to matching requests |
| 8 | `req2-sub-collection` | Add Sub-Collection | Context menu | Right-click collection → New Sub-Collection → pin to one env |
| 9 | `req2-export` | Export Collection | Toolbar ↓ | Export → downloads JSON file |
| 10 | `req2-import` | Import Collection | Toolbar ↑ | Import → select file → merged with dedup |

---

### REQ-3: Multi-Environment Requests

**Goal:** Show how one collection serves dev/staging/prod with environment-aware base URLs.

| Field | Value |
|-------|-------|
| `id` | `req-multi-env` |
| `estimatedMinutes` | 5 |
| Steps | 10 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'gallery']` |
| Prerequisites | None |

**Gallery Samples Used:**
- `req-multi-env-product` — Pre-built multi-env sample (DummyJSON laptop search with host strategy)
- `req-paginated-users` — Second endpoint to show env switching on multiple requests

**Training Path Alignment:** Maps to Catalog Phase 4 "Additional Environments" manual concept + unique multi-env content not in existing paths.

**Concept — "One Collection, Many Environments"**
- Multi-env collections store relative paths (`/products/search?q=laptop`)
- `baseUrls` map each workbench env to a host (e.g., `dev` → `http://localhost:3000`, `prod` → `https://dummyjson.com`)
- Env pills in the editor switch the resolved URL without editing request paths
- Sub-collections can override the base URL for specific environments
- Microservice linking auto-maps app environments to collection env IDs
- Same collection → same assertions → multiple targets

**Key Terms:**
- **Environment Pill** — Clickable badge showing active env; switches base URL resolution
- **Base URL Map** — Per-environment host configuration on a multi-env collection
- **Resolved URL** — Preview bar showing the full URL after env + path join
- **Microservice Link** — Connect collection to an app microservice for automatic env mapping

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req3-gallery` | Import Multi-Env Sample | Gallery card | Import `req-multi-env-product` — auto-creates multi-env collection |
| 2 | `req3-badge` | Notice the ENV Badge | Collection badge | Sidebar shows `ENV` badge — collection is multi-env mode |
| 3 | `req3-edit-collection` | Edit Collection Settings | Collection modal | Open → see base URLs map: env → host |
| 4 | `req3-fill-env` | Fill Environment Base URLs | Base URL row | Fill "production" + "staging" base URL rows (envs seeded from Settings) |
| 5 | `req3-relative-url` | See the Relative URL | URL input | Request URL is `/products/search?q=laptop` (no host) |
| 6 | `req3-env-pill` | Switch Environment | Env pill | Click staging pill → resolved URL preview changes |
| 7 | `req3-send-both` | Send to Each Env | Send button | Send with "dev" → 200; switch to "staging" → send again |
| 8 | `req3-sub-override` | Sub-Collection Override | Sub-collection modal | Create sub-collection → pin to one env with custom base URL |
| 9 | `req3-collection-auth` | Collection-Level Auth | Collection modal auth | Set Bearer as default → all child requests inherit |
| 10 | `req3-per-env-auth` | Per-Environment Auth | Auth matrix | Enable per-env auth → different tokens per environment |

---

### REQ-4: Request Body & Authentication

**Goal:** Cover all body modes and the auth inheritance chain.

| Field | Value |
|-------|-------|
| `id` | `req-body-auth` |
| `estimatedMinutes` | 5 |
| Steps | 10 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'gallery']` |
| Prerequisites | None |

**Gallery Samples Used:**
- `req-create-post` — POST with JSON body (JSONPlaceholder)
- `req-auth-login` — DummyJSON login → token extraction
- `req-echo-headers` — HTTPBin echo (custom headers, `{{$timestamp}}` variable)

**Training Path Alignment:** Mirrors Phase 2 "Auth Login Flow" + Phase 3 "Echo Headers" + Auth Strategies path ("Bearer Token Authentication", "API Key Authentication")

**Concept — "Bodies, Auth & the Inheritance Chain"**
- Body modes: JSON, Form Data, URL-Encoded, XML, Raw Text, File, None
- Auth types: Bearer, Basic, API Key (header/query), OAuth2, Global Profile, Inherit, None
- Inheritance chain: Request → Sub-Collection → Per-Env Collection Auth → Collection Auth → Microservice Profile
- cURL import/export preserves auth headers and body

**Key Terms:**
- **Auth Inheritance** — Requests inherit auth from parent collection unless overridden
- **Per-Env Auth** — Different auth config per environment (e.g., dev token vs prod token)
- **Global Auth Profile** — App-level auth configuration shared across collections/microservices
- **cURL Import** — Paste a cURL command to auto-fill method, URL, headers, body, auth

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req4-import-post` | Import Create Post | Gallery | Import `req-create-post` → POST with JSON body |
| 2 | `req4-json-body` | JSON Body Editor | Body tab | Show JSON body: `{ title, body, userId }`, edit a field |
| 3 | `req4-send-post` | Send POST | Send button | Send → 201 Created, response with generated `id` |
| 4 | `req4-form-data` | Switch to Form Data | Body mode select | Change mode → show key/value/file fields |
| 5 | `req4-import-auth` | Import Auth Login | Gallery | Import `req-auth-login` — DummyJSON login endpoint |
| 6 | `req4-bearer` | Bearer Token Auth | Auth tab | Set Bearer → paste token → send → check Authorization header |
| 7 | `req4-login-flow` | Login → Extract Token | Response body | Send login → extract `accessToken` from response |
| 8 | `req4-inherit` | Auth Inheritance | Auth select | Set collection auth → request uses "Inherit" → same token |
| 9 | `req4-curl-import` | cURL Import | Editor action | Import `req-echo-headers` via cURL paste → auto-fills all |
| 10 | `req4-curl-export` | cURL Export | Editor action | Action menu → Copy cURL → generated command with headers + body |

---

### REQ-5: Send to Harness (Promotion)

**Goal:** Promote individual requests and entire collections into the Test Harness.

| Field | Value |
|-------|-------|
| `id` | `req-send-harness` |
| `estimatedMinutes` | 5 |
| Steps | 10 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'scenarios']` |
| Prerequisites | Seeds requests in setup if none exist |

**Gallery Samples Used:**
- `req-get-all-users` — Simple GET for single promotion
- `req-create-post` — POST for second promotion (shows body snapshot)
- `req-delete-resource` — Part of batch promotion set

**Training Path Alignment:** Maps to Catalog Phase 4 "Send to Harness" manual + unique batch promotion content

**Concept — "From Exploration to Automated Testing"**
- Requests are exploratory; the Test Harness runs repeatable, validated suites
- **Send to Harness** creates a one-time snapshot (absolute URL, resolved auth, body)
- Single promotion: Environment → Microservice → Feature Group → Scenario → Test
- Batch promotion: Collection → Feature Group, Folders → Scenarios, Requests → Tests
- `IN HARNESS` badge tracks which requests have been promoted
- The snapshot is independent — editing the original request doesn't change the test

**Key Terms:**
- **Promotion** — Snapshot a request configuration into a test scenario (one-time copy)
- **Feature Group** — Target container in Test Harness (maps to collection)
- **Batch Promote** — Send an entire collection or folder at once (preserves folder → scenario structure)
- **IN HARNESS Badge** — Visual indicator that a request has been promoted

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req5-setup` | Prepare Requests | Sidebar | Ensure 3 gallery samples imported into one collection |
| 2 | `req5-open-modal` | Open Send to Harness | Editor action | Click "Send to Harness" from editor action menu |
| 3 | `req5-target` | Step 1: Pick Target | Cascade selects | Select Env → Microservice → Feature Group (+ New) → Scenario |
| 4 | `req5-options` | Step 2: Options | Options grid | Auth mode (concrete), validation preset (status-200), preview |
| 5 | `req5-confirm` | Confirm Promotion | Send button | Click Send → success toast → IN HARNESS badge appears |
| 6 | `req5-see-test` | Find in Tests | Tests tab | Auto-navigate to Tests → see promoted test with snapshot |
| 7 | `req5-batch-open` | Batch Promote | Context menu | Right-click collection → "Send Collection to Harness" |
| 8 | `req5-batch-select` | Select Requests | Checkbox grid | Pick 2 of 3 requests → see mapping preview |
| 9 | `req5-batch-confirm` | Confirm Batch | Send button | Send → Feature Group with Scenarios/Tests created |
| 10 | `req5-badge` | IN HARNESS Badges | Sidebar badges | Back to Requests → see badges on promoted items |

---

### REQ-6: Definition Versioning & History

**Goal:** Show auto-snapshots, version diff, and restore.

| Field | Value |
|-------|-------|
| `id` | `req-versioning` |
| `estimatedMinutes` | 4 |
| Steps | 8 |
| `initialTab` | `requests` |
| Prerequisites | None |

**Gallery Samples Used:**
- `req-get-all-users` — Edit this to create version history (tagged `versioning-tutorial`)
- `req-create-post` — Second sample for diff comparison (tagged `versioning-tutorial`)

**Training Path Alignment:** Maps directly to core Versioning path manuals: "Request Definition History" (`req-get-all-users`) + "Request Definition Diff" (`req-create-post`)

**Concept — "Never Lose a Working Request"**
- RedfireForge auto-snapshots request definitions when you navigate away (max 15 versions)
- Version History tab: list with timestamps, rename, compare, restore
- Visual diff highlights changes in URL, headers, body, query params
- Restore reverts the request to any prior snapshot instantly

**Key Terms:**
- **Auto-Snapshot** — Invisible save triggered when you navigate away from an edited request
- **Definition Version** — A frozen point-in-time copy of URL, method, headers, body, params
- **Version Diff** — Side-by-side comparison highlighting what changed between two versions
- **Restore** — One-click revert to any previous version

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `req6-import` | Import Versioning Sample | Gallery | Import `req-get-all-users` (tagged versioning-tutorial) |
| 2 | `req6-edit-url` | Make a URL Change | URL input | Change from `/users` to `/users?_limit=5` |
| 3 | `req6-edit-header` | Add a Header | Headers tab | Add `X-Demo-Version: v2` |
| 4 | `req6-switch-away` | Navigate Away (Auto-Snapshot) | Sidebar | Click another request → auto-snapshot fires silently |
| 5 | `req6-return` | Return & Open History | History tab | Click back → open History tab → see version list |
| 6 | `req6-diff` | Compare Two Versions | Diff button | Select original + edited → diff highlights URL + header changes |
| 7 | `req6-restore` | Restore Original | Restore button | Click Restore → request reverts to clean `/users` state |
| 8 | `req6-rename` | Rename a Version | Context menu | Right-click version → rename to "before pagination" |

---

## Category: Catalog

### CAT-1: Import & Browse an OpenAPI Spec

**Goal:** Import a spec from the Gallery and explore the Swagger-UI-like endpoint browser.

| Field | Value |
|-------|-------|
| `id` | `cat-import-browse` |
| `estimatedMinutes` | 5 |
| Steps | 10 |
| `initialTab` | `catalog` |
| Prerequisites | None (public APIs) |

**Gallery Samples Used:**
- `catalog-jsonplaceholder` — JSONPlaceholder API (12 endpoints, easy, live API)

**Training Path Alignment:** Mirrors Catalog Phase 1 "API Catalog Overview" + "JSONPlaceholder API" manuals

**Concept — "Your API Library, Automatically Organized"**
- Import OpenAPI 3.x or Swagger 2.0 specs (file, URL, paste, or gallery)
- Endpoints auto-grouped by OpenAPI tags with method badges (GET/POST/PUT/DELETE)
- Host strategy: **From Spec** (use spec servers), **Environment** (linked microservice), or **Custom URL**
- Filter endpoints by path, method, summary, operationId
- Expand endpoint cards for parameters, request body schema, response codes

**Key Terms:**
- **OpenAPI Spec** — A machine-readable description of a REST API (paths, schemas, auth)
- **Tag Group** — Endpoints organized by their OpenAPI `tags` (e.g., "Posts", "Users")
- **Host Strategy** — How the catalog resolves the base URL: from spec servers, from app environment, or custom
- **Endpoint Card** — Expandable Swagger-UI-style card showing path, method, params, and responses

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `cat1-navigate` | Open Catalog | Activity bar | Navigate to Catalog tab → see Welcome screen |
| 2 | `cat1-welcome` | Welcome Features | Feature cards | Tour the 5 feature cards (Browse, Try It Out, Versions, Export, Harness) |
| 3 | `cat1-import-btn` | Click Import Spec | Import button | Open import modal |
| 4 | `cat1-gallery-tab` | Gallery Tab | Import gallery tab | Switch to Gallery tab → see catalog spec cards |
| 5 | `cat1-select-spec` | Pick JSONPlaceholder | Card | Click "JSONPlaceholder API" → preview loads |
| 6 | `cat1-confirm` | Confirm Import | Import button | Click Import → spec appears in sidebar |
| 7 | `cat1-overview` | Overview Tab | Overview panel | Version badge, method breakdown (4 GET, 3 POST, etc.), servers |
| 8 | `cat1-endpoints` | Endpoints Tab | Endpoint browser | Tag groups: "Posts", "Users", "Comments" — expandable cards |
| 9 | `cat1-expand` | Expand an Endpoint | Endpoint card | Expand GET /posts → show params, response schema |
| 10 | `cat1-filter` | Filter Endpoints | Filter input | Type "user" → filtered to user-related paths |

---

### CAT-2: Try It Out & Execute

**Goal:** Live-test endpoints directly from the catalog with auto-generated request bodies.

| Field | Value |
|-------|-------|
| `id` | `cat-try-it-out` |
| `estimatedMinutes` | 5 |
| Steps | 11 |
| `initialTab` | `catalog` |
| Prerequisites | Seeds JSONPlaceholder spec in setup |

**Gallery Samples Used:**
- `catalog-jsonplaceholder` — JSONPlaceholder API (live, no auth required)
- Also references `catalog-dummyjson` concept (search + auth) for narration context

**Training Path Alignment:** Extends Phase 1 "JSONPlaceholder API" manual + Phase 2 "DummyJSON Products" (search/auth)

**Concept — "Live Testing Without Leaving the Catalog"**
- **Try It Out** opens inline param/body editors on any endpoint card
- `generateStubJson()` pre-fills the request body from the schema (title, body, userId → real types)
- **Execute** sends via configured host + optional auth → live response inline
- Auto-saves Try-it values (600ms debounce) — revisits remember your inputs
- **Copy cURL** exports the configured call for shell/CI use
- Path params (`/posts/{id}`) get dedicated input fields

**Key Terms:**
- **Schema Stub** — Auto-generated sample JSON from the OpenAPI request body schema
- **Execute** — Live HTTP call from inside the catalog card (no collection needed)
- **Path Parameter** — URL template variable like `{id}` filled from a dedicated input
- **Value Persistence** — Try-it form values saved automatically, restored on next visit

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `cat2-find-post` | Find POST /posts | Endpoint card | Scroll/filter to "Create Post" (POST /posts) |
| 2 | `cat2-try-it` | Click Try It Out | Try It button | Opens inline body/param editors |
| 3 | `cat2-auto-body` | See Auto-Generated Body | Body editor | Pre-filled JSON: `{ title: "string", body: "string", userId: 0 }` |
| 4 | `cat2-edit` | Edit the Body | Body field | Change title to "My Demo Post", userId to 1 |
| 5 | `cat2-execute` | Execute | Execute button | Click → 201 Created response appears inline |
| 6 | `cat2-response` | Inspect Response | Response panel | Status, JSON body with generated `id`, timing |
| 7 | `cat2-curl` | Copy cURL | Copy cURL button | Click → multiline cURL in clipboard → spotlight |
| 8 | `cat2-get-by-id` | Path Parameter | Another endpoint | Expand GET /posts/{id} → Try It Out → fill `id=1` |
| 9 | `cat2-execute-get` | Execute with Path Param | Execute button | Execute → single post returned |
| 10 | `cat2-query-param` | Query Parameters | GET endpoint | GET /posts?userId=1 → fill query → Execute → filtered |
| 11 | `cat2-persistence` | Values Persist | Navigate away | Switch tabs → return → values still filled from auto-save |

---

### CAT-3: Export to Requests & Send to Harness

**Goal:** Show both outbound flows: Catalog → Requests collection and Catalog → Harness directly.

| Field | Value |
|-------|-------|
| `id` | `cat-export-promote` |
| `estimatedMinutes` | 5 |
| Steps | 11 |
| `initialTab` | `catalog` |
| `allowedTabs` | `['catalog', 'requests', 'scenarios']` |
| Prerequisites | Seeds JSONPlaceholder spec in setup |

**Gallery Samples Used:**
- `catalog-jsonplaceholder` — JSONPlaceholder spec (source for export)
- Cross-references `req-get-all-users` (the exported request mirrors this gallery sample)

**Training Path Alignment:** Maps directly to Catalog Phase 4 "Send to Harness" manual + overlaps with Requests "Send to Harness" concept

**Concept — "From Spec to Test Suite in 3 Clicks"**
- **Export to Requests** creates a multi-env collection with `catalogMeta` linkage
- Exported requests retain spec origin: API Info drawer, path param templates, spec version history
- **Coverage badges** show which endpoints are already exported (avoid duplicate work)
- **Send to Harness (direct)** promotes from catalog without saving to Requests first
- Smart re-export: updating a spec + re-exporting merges into existing collection (dedup by endpoint ID)

**Key Terms:**
- **catalogMeta** — Metadata on exported requests linking back to spec, endpoint, original path
- **Coverage Badge** — Shows "Exported" on endpoints already in Requests collection
- **Direct Harness Promotion** — Catalog → Test without intermediate Request save
- **Smart Re-Export** — Re-export after spec update merges into existing collection

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `cat3-single-export` | Export One Endpoint | Export button | Endpoint card → "Export to Requests" |
| 2 | `cat3-export-options` | Export Options | Export modal | Pick environment, custom name, "include sample values" |
| 3 | `cat3-confirm-export` | Confirm Export | Confirm button | Export → success → switches to Requests tab |
| 4 | `cat3-see-request` | Find in Requests | Requests sidebar | See new collection with catalogMeta-linked request |
| 5 | `cat3-api-info` | API Info Drawer | API Info icon | Open → original spec metadata, params, responses |
| 6 | `cat3-coverage` | Coverage Badge | Endpoint card badge | Back to Catalog → endpoint shows "Exported" coverage badge |
| 7 | `cat3-bulk-export` | Bulk Export | Export tab/modal | Open full export modal → select multiple endpoints + envs |
| 8 | `cat3-harness-btn` | Direct to Harness | Send to Harness button | Different endpoint card → "Send to Harness" (no Requests step) |
| 9 | `cat3-harness-target` | Pick Harness Target | Cascade selects | Env → Microservice → Feature Group → Scenario |
| 10 | `cat3-harness-confirm` | Confirm Promotion | Send button | Promote → navigate to Tests tab → see created test |
| 11 | `cat3-spec-version` | Spec Version in Requests | Version switcher | Back to exported request → show SpecVersionSwitcher in editor |

---

### CAT-4: Version History & Spec Diff

**Goal:** Re-import an updated spec and compare endpoint changes across versions.

| Field | Value |
|-------|-------|
| `id` | `cat-version-diff` |
| `estimatedMinutes` | 4 |
| Steps | 8 |
| `initialTab` | `catalog` |
| Prerequisites | Seeds JSONPlaceholder spec in setup |

**Gallery Samples Used:**
- `catalog-jsonplaceholder` — Base version (v1)
- Modified copy as v2 (setup injects a variant with added/removed endpoints to show diff)

**Training Path Alignment:** Extends Catalog Phase 1–3 progression (import → re-import); no existing "Version Diff" manual — this lesson is new content.

**Concept — "Track API Evolution Over Time"**
- Re-importing a spec with the same title adds a **new version** automatically (up to 10)
- Version History panel lists all imports with timestamps and active marker
- **Compare** any two versions: endpoint diff shows added (green), removed (red), changed (amber)
- Switch active version to browse older/newer API shapes
- After switching, re-export updates existing collection (smart merge by endpoint ID)

**Key Terms:**
- **Version History** — Chronological list of all spec imports for one API entry
- **Active Version** — The currently browsed spec version (switch freely)
- **Endpoint Diff** — Visual comparison: added endpoints, removed endpoints, changed parameters/bodies
- **Smart Merge** — Re-exporting after version switch updates existing Requests collection

**Steps:**

| # | ID | Title | Highlight | Action Summary |
|---|---|---|---|---|
| 1 | `cat4-current` | Current Version | Overview badge | Show version badge (v1), import date |
| 2 | `cat4-reimport` | Re-Import Updated Spec | Import modal | Import same-title spec → "Update existing" prompt |
| 3 | `cat4-confirm` | Confirm Update | Import button | Version increments to v2 automatically |
| 4 | `cat4-history` | Open Version History | Context menu | Sidebar right-click → Version History panel |
| 5 | `cat4-list` | Version List | History panel | Two entries with timestamps, active marker on v2 |
| 6 | `cat4-compare` | Compare Versions | Compare button | Select v1 + v2 → click Compare |
| 7 | `cat4-diff` | Diff View | Diff panel | Added (green), Removed (red), Changed (amber) endpoints |
| 8 | `cat4-switch` | Switch Active Version | Set Active button | Click "Set Active" on v1 → endpoints revert to v1 shape |

---

## Blocking Prerequisites

Before any lesson implementation can begin, the following must be completed:

| # | Prerequisite | Scope | Est. Effort |
|---|---|---|---|
| 1 | **Add `data-testid` to Requests components** | `src/features/requests/**/*.tsx` — sidebar items, editor, body tabs, auth tabs, send button, response panels, modals | ~2h |
| 2 | **Add `data-testid` to Catalog components** | `src/features/catalog/**/*.tsx` — sidebar, endpoint browser, cards, try-it, import modal, version panels | ~2h |
| 3 | **Add `data-testid` to Gallery page** | `src/features/gallery/GalleryPage.tsx` — domain tabs, sample cards, import buttons | ~30m |
| 4 | **Create `REQ` + `CAT` selector namespaces** | `src/shared/selectors/req.ts`, `src/shared/selectors/cat.ts` → export from barrel | ~30m |
| 5 | **Register `api` domain as available** | Set `available: true` on `apiDomain` in `packages/demo-hub/src/lessons/index.ts` | ~5m |
| 6 | **Create adapter files** | `packages/demo-hub/src/adapters/requestsAdapter.ts`, `catalogAdapter.ts`, `galleryAdapter.ts` | ~2h |

**Estimated total prerequisite work:** ~7 hours (can be a single preparatory feature branch)

---

## Implementation Notes

### Domain Registration

```typescript
// packages/demo-hub/src/lessons/index.ts
{
  id: 'api',
  name: 'API Testing',
  icon: '🔌',  // matches existing apiDomain definition
  description: 'HTTP Requests, API Catalog, and Test Promotion',
  lessons: [...requestLessons, ...catalogLessons],
  available: true,
  categories: [
    { id: 'requests', label: 'Requests', icon: '📤' },
    { id: 'catalog',  label: 'Catalog',  icon: '📚' },
  ],
}
```

### Gallery Sample → Lesson Mapping

| Lesson | Imports (via `onImportSample`) | References (narration only) |
|--------|-------------------------------|---------------------------|
| REQ-1 | `req-get-all-users` | `req-random-dog` (mention) |
| REQ-2 | `req-get-all-users`, `req-create-post`, `req-delete-resource` | — |
| REQ-3 | `req-multi-env-product`, `req-paginated-users` | — |
| REQ-4 | `req-create-post`, `req-auth-login`, `req-echo-headers` | — |
| REQ-5 | `req-get-all-users`, `req-create-post`, `req-delete-resource` | — |
| REQ-6 | `req-get-all-users`, `req-create-post` | Versioning path manuals |
| CAT-1 | `catalog-jsonplaceholder` (via catalog import) | — |
| CAT-2 | (uses CAT-1 imported spec) | `catalog-dummyjson` (mention for auth) |
| CAT-3 | (uses CAT-1 imported spec) | `req-get-all-users` (cross-ref) |
| CAT-4 | `catalog-jsonplaceholder` (v1 + modified v2) | — |

### Training Path Manual References

| Lesson | Aligns With Manual(s) |
|--------|----------------------|
| REQ-1 | "Request Basics Overview", "Get All Users" |
| REQ-2 | "Request Basics Overview" (organizational subset) |
| REQ-3 | "Additional Environments" (catalog path P4) |
| REQ-4 | "Auth Login Flow", "Echo Headers", Auth Strategies path |
| REQ-5 | "Send to Harness" (catalog path P4) |
| REQ-6 | "Request Definition History", "Request Definition Diff" (versioning path) |
| CAT-1 | "API Catalog Overview", "JSONPlaceholder API" |
| CAT-2 | "JSONPlaceholder API", "DummyJSON Products" |
| CAT-3 | "Send to Harness" (catalog path P4) |
| CAT-4 | New content (no existing manual) |

### Selectors Needed

New `REQ` namespace in `src/shared/selectors/req.ts`:

```typescript
export const REQ = {
  // Sidebar
  SIDEBAR: '[data-testid="requests-sidebar"]',
  SIDEBAR_NEW_BTN: '[data-testid="requests-new-collection-btn"]',
  SIDEBAR_IMPORT_BTN: '[data-testid="requests-import-btn"]',
  SIDEBAR_EXPORT_BTN: '[data-testid="requests-export-btn"]',
  SIDEBAR_SEARCH: '[data-testid="requests-sidebar-search"]',
  COLLECTION_ITEM: '[data-testid="requests-collection-item"]',
  REQUEST_ITEM: '[data-testid="requests-request-item"]',
  FOLDER_ITEM: '[data-testid="requests-folder-item"]',

  // Editor
  EDITOR: '[data-testid="request-editor"]',
  METHOD_SELECT: '[data-testid="request-method-select"]',
  URL_INPUT: '[data-testid="request-url-input"]',
  SEND_BTN: '[data-testid="request-send-btn"]',
  BODY_TAB: '[data-testid="request-body-tab"]',
  AUTH_TAB: '[data-testid="request-auth-tab"]',
  PARAMS_TAB: '[data-testid="request-params-tab"]',
  HEADERS_TAB: '[data-testid="request-headers-tab"]',
  HISTORY_TAB: '[data-testid="request-history-tab"]',
  CONSOLE_TAB: '[data-testid="request-console-tab"]',
  ACTION_MENU: '[data-testid="request-action-menu"]',

  // Body
  BODY_MODE_SELECT: '[data-testid="request-body-mode"]',
  BODY_JSON_EDITOR: '[data-testid="request-body-json"]',

  // Auth
  AUTH_TYPE_SELECT: '[data-testid="request-auth-type"]',
  AUTH_BEARER_INPUT: '[data-testid="request-auth-bearer-token"]',

  // Response
  RESPONSE_BODY: '[data-testid="response-body"]',
  RESPONSE_STATUS: '[data-testid="response-status-badge"]',
  RESPONSE_SEARCH: '[data-testid="response-body-search"]',
  RESPONSE_CONSOLE: '[data-testid="response-console"]',
  HISTORY_DROPDOWN: '[data-testid="response-history-dropdown"]',
  JSON_TREE: '[data-testid="response-json-tree"]',

  // Modals
  COLLECTION_MODAL: '[data-testid="request-collection-modal"]',
  SEND_HARNESS_MODAL: '[data-testid="send-to-harness-modal"]',
  SEND_HARNESS_BTN: '[data-testid="send-to-harness-btn"]',
  BATCH_HARNESS_MODAL: '[data-testid="batch-send-harness-modal"]',
  HARNESS_BADGE: '[data-testid="in-harness-badge"]',

  // Version History
  VERSION_PANEL: '[data-testid="request-version-panel"]',
  VERSION_DIFF: '[data-testid="request-version-diff"]',
  VERSION_RESTORE_BTN: '[data-testid="request-version-restore"]',

  // Env
  ENV_PILL: '[data-testid="request-env-pill"]',
  RESOLVED_URL: '[data-testid="request-resolved-url"]',
  BASE_URL_MAP: '[data-testid="collection-base-url-map"]',
} as const;
```

New `CAT` namespace in `src/shared/selectors/cat.ts`:

```typescript
export const CAT = {
  // Sidebar
  SIDEBAR: '[data-testid="catalog-sidebar"]',
  IMPORT_BTN: '[data-testid="catalog-import-btn"]',
  ENTRY_ITEM: '[data-testid="catalog-entry-item"]',

  // Main panels
  WELCOME: '[data-testid="catalog-welcome"]',
  OVERVIEW_TAB: '[data-testid="catalog-overview-tab"]',
  OVERVIEW: '[data-testid="catalog-overview"]',
  ENDPOINTS_TAB: '[data-testid="catalog-endpoints-tab"]',
  ENDPOINT_BROWSER: '[data-testid="catalog-endpoint-browser"]',
  ENDPOINT_CARD: '[data-testid="catalog-endpoint-card"]',
  TAG_GROUP: '[data-testid="catalog-tag-group"]',

  // Toolbar
  FILTER_INPUT: '[data-testid="catalog-filter-input"]',
  HOST_STRATEGY: '[data-testid="catalog-host-strategy"]',
  HIDE_DEPRECATED: '[data-testid="catalog-hide-deprecated"]',

  // Try It Out
  TRY_IT_BTN: '[data-testid="catalog-try-it-btn"]',
  EXECUTE_BTN: '[data-testid="catalog-execute-btn"]',
  CANCEL_TRY_BTN: '[data-testid="catalog-cancel-try-btn"]',
  BODY_EDITOR: '[data-testid="catalog-body-editor"]',
  PARAM_INPUT: '[data-testid="catalog-param-input"]',
  RESPONSE_PANEL: '[data-testid="catalog-response-panel"]',
  COPY_CURL_BTN: '[data-testid="catalog-copy-curl-btn"]',

  // Auth
  AUTH_BTN: '[data-testid="catalog-authorize-btn"]',
  AUTH_PANEL: '[data-testid="catalog-auth-panel"]',

  // Export
  EXPORT_BTN: '[data-testid="catalog-export-to-requests-btn"]',
  EXPORT_MODAL: '[data-testid="catalog-export-modal"]',
  HARNESS_BTN: '[data-testid="catalog-send-to-harness-btn"]',
  COVERAGE_BADGE: '[data-testid="catalog-coverage-badge"]',

  // Versions
  VERSION_HISTORY: '[data-testid="catalog-version-history"]',
  VERSION_DIFF: '[data-testid="catalog-version-diff"]',
  VERSION_COMPARE_BTN: '[data-testid="catalog-version-compare"]',
  VERSION_SWITCH_BTN: '[data-testid="catalog-version-switch"]',

  // Import Modal
  IMPORT_MODAL: '[data-testid="catalog-import-modal"]',
  IMPORT_GALLERY_TAB: '[data-testid="catalog-import-gallery-tab"]',
  IMPORT_FILE_TAB: '[data-testid="catalog-import-file-tab"]',
  IMPORT_URL_TAB: '[data-testid="catalog-import-url-tab"]',
  IMPORT_CONFIRM_BTN: '[data-testid="catalog-import-confirm"]',

  // API Info (in Requests editor)
  API_INFO_DRAWER: '[data-testid="request-catalog-api-info"]',
  SPEC_VERSION_SWITCHER: '[data-testid="request-spec-version-switcher"]',
} as const;
```

### File Structure

```
packages/demo-hub/src/lessons/api/
├── index.ts                          # Barrel: all request + catalog lessons
├── api-selectors.ts                  # Re-exports REQ + CAT for lesson convenience
├── req-quick-start.ts                # REQ-1
├── req-collections.ts                # REQ-2
├── req-multi-env.ts                  # REQ-3
├── req-body-auth.ts                  # REQ-4
├── req-send-harness.ts               # REQ-5
├── req-versioning.ts                 # REQ-6
├── req-demo-helpers.ts               # Shared: import gallery sample, create collection, fill fields
├── cat-import-browse.ts              # CAT-1
├── cat-try-it-out.ts                 # CAT-2
├── cat-export-promote.ts             # CAT-3
├── cat-version-diff.ts               # CAT-4
└── cat-demo-helpers.ts               # Shared: import spec, seed endpoint state
```

### Adapter Requirements

| Adapter | Purpose | Key Methods |
|---------|---------|-------------|
| `requestsAdapter.ts` | Requests workbench bridge | `importGallerySample(id)`, `createCollection(opts)`, `selectRequest(id)`, `sendRequest()`, `getResponseStatus()` |
| `catalogAdapter.ts` | Catalog bridge | `importCatalogSpec(id)`, `selectEntry(id)`, `executeTryItOut()`, `exportEndpoints(opts)` |
| `galleryAdapter.ts` | Gallery page bridge | `navigateToGallery()`, `findSampleCard(id)`, `importFromGallery(id)` |
| `environmentAdapter.ts` | (exists) | Reuse for env creation in REQ-3 |
| `appShellAdapter.ts` | (exists) | Reuse for tab navigation |

### No Docker Required

All 10 lessons use **public APIs** — no containers needed:
- JSONPlaceholder (GET/POST/PUT/DELETE — all return mock data)
- DummyJSON (search, pagination, auth — real responses)
- PokéAPI (nested JSON — read-only)
- REST Countries (rich geographic data — read-only)
- HTTPBin (echo/debug — reflects requests back)

This keeps the barrier to entry minimal compared to Protocol lessons (Kafka, gRPC) that require Docker.

---

## Lesson Dependency Graph

```
REQ-1 ─── (standalone — first lesson to implement)
REQ-2 ─── (standalone)
REQ-3 ─── (standalone)
REQ-4 ─── (standalone)
REQ-5 ─── depends on requests existing (seeds in setup)
REQ-6 ─── (standalone)

CAT-1 ─── (standalone — first catalog lesson)
CAT-2 ─┬─ needs spec (seeds in setup if missing)
CAT-3 ─┤
CAT-4 ─┘
```

All lessons are **independently runnable** — `setup()` seeds prerequisites. Order is a recommendation for the Training Path, not a hard dependency.

---

## Priority Order (Implementation)

| Priority | Lesson | Rationale |
|----------|--------|-----------|
| 1 | **REQ-1** | Simplest — validates adapter layer + gallery import |
| 2 | **CAT-1** | Validates catalog adapter + spec import |
| 3 | **CAT-2** | Highest visual impact — live API from inside the spec |
| 4 | **REQ-2** | Collection CRUD — tests sidebar interactions |
| 5 | **REQ-4** | Body + Auth — covers breadth of request editing |
| 6 | **REQ-3** | Multi-env — high-value differentiation vs Postman |
| 7 | **CAT-3** | Export + Harness — connects the tools story |
| 8 | **REQ-5** | Send to Harness — connects requests → tests story |
| 9 | **REQ-6** | Versioning — power-user feature |
| 10 | **CAT-4** | Version Diff — power-user feature |

---

## Open Questions

1. **Gallery tab navigation in demos** — REQ-1 through REQ-4 navigate to the Gallery tab to teach importing. The `onImportRequest` callback auto-navigates back to Requests, but the outbound navigation requires `'gallery'` in `allowedTabs` (added above). Alternative: import silently in `setup`/`preAction` and skip Gallery UI — but this loses the educational value of teaching users how to discover and use the Gallery.
2. **Gallery import in demo context** — Does `onImportSample(sampleId)` work inside a demo `action()` context, or do we need a bridge adapter? The `useGalleryImport` hook's `onImportRequest` calls `setActiveTab('requests')` after importing — verify this doesn't conflict with demo's tab management.
3. **Catalog import from gallery** — `onImportCatalog` opens the modal pre-parsed; can we bypass the modal for instant silent import in `preAction`?
4. **[PREREQUISITE] `data-testid` audit** — **Critical:** Production TSX files in `src/features/requests/` and `src/features/catalog/` have **zero** `data-testid` attributes (they only appear in test mocks). A preparatory PR to add `data-testid` attrs to all interactive elements is mandatory before any lesson implementation can begin. This is a blocking dependency.
5. **Multi-env sample** — `req-multi-env-product` is gallery-only (no training path manual). Should we add a manual, or is the lesson sufficient?
6. **CAT-4 v2 spec** — How to inject a "modified" version? Options: (a) hardcode a variant in helpers, (b) modify the raw YAML programmatically in setup, (c) use a second gallery spec as "v2".
7. **Tab navigation** — Confirm `allowedTabs` for cross-tab lessons (REQ-5, CAT-3) prevents the demo auto-exit guard from firing.
8. **REQ-2 step 8: Sub-Collection creation** — The actual API is `addSubCollection(colId, name)` which creates a new folder with `isSubCollection: true`. Verify the context menu exposes "New Sub-Collection" to the user (not "Convert folder").
