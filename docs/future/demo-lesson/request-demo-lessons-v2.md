# API Testing Demo Lessons v2 — Rewrite Plan

> **Domain:** `api`  
> **Branch:** `feature/api-testing-demo`  
> **Status:** v2 rewrite — replaces v1 implementations (REQ-1 through REQ-6)

---

## v2 Design Principles

### 0. Create From Scratch — Not Gallery

This is a **Requests** demo, not a Gallery demo. Users need to learn the core workflow:
**Create collection → Add request → Configure method/URL/body → Send → Explore response.**

Gallery samples may appear **once** (briefly, e.g. as a "quick tip" in one step) but are
never the primary mechanism. Every lesson should teach hands-on creation.

### 1. Show Off Every Feature in Detail

When a dropdown opens, a modal appears, or a panel activates:
- **Pause** on the dropdown/modal/panel so the user can see all available options
- **Spotlight each section** individually with a pause (800-1200ms) so the user understands what's there
- **Descriptions explain** what each option/section does — not just "fill the name"

The goal is to give users maximum exposure to the product's capabilities. If there are 3 options in a dropdown, the user should see all 3 and understand what each does. If a modal has 4 sections, spotlight each one before filling.

**Example — Opening a modal:**
1. Click button → modal opens
2. Spotlight **section 1** (name input) — pause 800ms
3. Spotlight **section 2** (mode switcher) — pause 1000ms, description explains both modes
4. Spotlight **section 3** (auth config) — pause 800ms, description explains inheritance
5. Fill the values → Save → spotlight outcome

### 2. Guaranteed Cleanup on Exit

Every lesson **must** clean up all artifacts when:
- User completes the lesson (clicks Complete)
- User stops/exits mid-lesson (clicks ✕ or Esc)
- User restarts the lesson
- User navigates to a different tab (confirmed leave)

**Implementation rules:**
- `cleanup()` deletes **all** created collections, requests, and modifications — not "relative to baseline"
- `cleanup()` closes any open modals, context menus, and dropdowns
- `cleanup()` resets sidebar search input to empty
- `cleanup()` navigates back to requests tab
- `setup()` also runs cleanup logic first (idempotent start) — prevents stale state from crashed prior runs

### 3. Specific Highlights — Never Broad

| Bad (v1) | Good (v2) |
|----------|-----------|
| `REQ.SIDEBAR` (entire sidebar) | `REQ.SIDEBAR_ADD_BTN` (specific + button) |
| `REQ.EDITOR` (entire editor) | `REQ.URL_INPUT` (the specific input field) |
| `REQ.HARNESS_MODAL` (whole modal) | `REQ.HARNESS_CASCADE_ENV` (specific cascade) |
| `REQ.colByName(X)` at end (summary) | `REQ.reqByName(X)` (the created request) |

**Rules:**
- Each step highlights the **one specific element** the viewer should look at during reading
- Highlight the **outcome**, not the container
- `step.highlight` sets the React-managed spotlight ring (during reading phase)
- In `action()`, use `spotlight(ctx, selector, holdMs)` for **in-action** spotlights on important intermediate results
- When multiple sections need attention, spotlight each one sequentially with its own pause

### 4. Remove Old Highlight Before New

The `spotlight` function already removes its ring in `finally`. The React `DemoSpotlight` remounts on step change (new key). **No extra work needed** — but:
- **Never stack** multiple `spotlight` calls without awaiting the prior one
- **Never call** `spotlight` while the React `DemoSpotlight` is active (the body counter suppresses it)

### 5. Minimize Phase Durations (preAction only — action can be rich)

| Phase | v1 Problem | v2 Target |
|-------|-----------|-----------|
| **Preparing** (preAction) | Unnecessary `ctx.delay(100-200)` | Zero delays unless waiting for React render (use `waitFor` instead) |
| **Acting** (action) | Either too fast (no spotlights) or too slow (redundant waits) | Rich sequential spotlights on each UI section; each spotlight 600-1200ms |
| **Verifying** (verify) | 1100ms `DEMO_VERIFY_ABSORB_MS` on every step | Only use `verify` when the outcome truly needs polling; most steps end at `action` phase |

**Rules:**
- `preAction`: No `ctx.delay()` — only `ctx.waitFor()` for DOM readiness
- `action`: Rich — spotlight each important UI section (800-1200ms each), then perform the action, then spotlight outcome. This is where the learning happens.
- `verify`: Only set when the outcome appears asynchronously (e.g., HTTP response status after send). Never for synchronous UI updates.
- Use `pauseAfter: true` only for pure informational steps (concept/summary)

### 6. Public APIs Only

All lessons use **free, public, no-auth-required** APIs:

| API | Base URL | Use Case |
|-----|----------|----------|
| **JSONPlaceholder** | `https://jsonplaceholder.typicode.com` | GET/POST/PUT/DELETE CRUD, returns mock data |
| **DummyJSON** | `https://dummyjson.com` | Search, pagination, auth login flow |
| **PokéAPI** | `https://pokeapi.co/api/v2` | Nested JSON, path params |
| **HTTPBin** | `https://httpbin.org` | Echo headers/body, auth testing |
| **REST Countries** | `https://restcountries.com/v3.1` | Rich geographic data |

No Docker. No authentication setup for basic lessons.

---

## Lesson Count Summary (v2)

| Category | Lessons | Target Steps/Lesson | Est. Time |
|----------|---------|---------------------|-----------|
| Requests | 6 | 3-5 steps | ~3 min each |
| Catalog  | 4 | 3-5 steps | ~3 min each |
| **Total** | **10** | | **~30 min** |

**Philosophy:** Each step is a **complete logical beat** with rich feature exposure. A single step can:
- Open UI → spotlight & pause on each section → fill → spotlight result → confirm
- All within one `action()` function with sequential `spotlight` calls
- The viewer should leave each step knowing **everything** available in that panel/modal

This matches Protocol demos (gRPC, GraphQL) where one step configures an entire modal with 5+ fields.

---

## Category: Requests

### REQ-1: Quick Start — Your First Request

**Goal:** Create a collection, add a request from scratch, send it, and explore the response. Show off every UI section the user will encounter.

| Field | Value |
|-------|-------|
| `id` | `req-quick-start` |
| `estimatedMinutes` | 3 |
| Steps | 4 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests']` |

**Public API:** JSONPlaceholder (`https://jsonplaceholder.typicode.com/users`)

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req1-create-collection` | Create a Collection | `REQ.SIDEBAR_ADD_BTN` | Click + → **spotlight entire dropdown** (1200ms, user sees Group / URL Collection / ENV Collection — description explains each) → spotlight "URL Collection" → click → modal opens → **spotlight Collection Name input** (800ms) → **spotlight URL Mode switcher** (1000ms, shows Direct URL vs Multi-Environment) → **spotlight Default Auth section** (800ms, explains inheritance) → fill name "My API" → spotlight filled name → Click Create → spotlight new collection in sidebar (1000ms) |
| 2 | `req1-add-request` | Add a Request | `REQ.URL_INPUT` | Right-click collection → **spotlight context menu** (1000ms, shows Add Request / Add Folder / Add Sub-Collection / Edit / Duplicate / Delete) → click "Add Request" → editor opens → **spotlight method dropdown** (1000ms, shows GET selected, mentions all 7 methods) → spotlight URL input → type full URL → **spotlight filled URL** (1000ms) → **spotlight editor tabs bar** (800ms, shows Params / Body / Auth / Headers / History available) |
| 3 | `req1-send` | Send & See Response | `REQ.SEND_BTN` | Spotlight Send (800ms) → click → wait for response → **spotlight status badge** (1000ms, explains color coding: green=2xx, yellow=3xx, red=4xx/5xx) → **spotlight response time** (600ms) → **spotlight JSON tree** (1000ms, mentions collapsible/searchable) → **spotlight response tabs row** (800ms, shows Preview / Headers / Console) |
| 4 | `req1-explore` | Console & History | `REQ.RESP_TAB_CONSOLE` | Spotlight Console tab → click → **spotlight console log** (1000ms, full HTTP transcript with headers & timing) → switch back to Preview → spotlight "Just now" trigger (800ms) → click → **spotlight history dropdown** (800ms) → **spotlight individual history entry** (800ms, explains restorable with one click) |

**Cleanup:** Delete "My API" collection. Close any open modals/dropdowns.

---

### REQ-2: Collections & Organization

**Goal:** Folders, move, duplicate, search — organize your API workspace. Show all sidebar capabilities.

| Field | Value |
|-------|-------|
| `id` | `req-collections` |
| `estimatedMinutes` | 3 |
| Steps | 4 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests']` |

**Public API:** JSONPlaceholder

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req2-create` | Create Collection with Requests | `REQ.SIDEBAR_ADD_BTN` | Create "User Service" URL Collection (show modal briefly) → right-click collection → **spotlight context menu** (800ms, shows all options) → click "Add Request" → **spotlight name input** in editor → type "List Users" → spotlight URL input → type `https://jsonplaceholder.typicode.com/users` → spotlight filled (600ms) → Repeat: right-click → Add Request → name "Get User" → URL `.../users/1` → **spotlight both requests in sidebar** (800ms) |
| 2 | `req2-folders` | Create Folder & Move | `REQ.colByName('User Service')` | Right-click collection → spotlight context menu → click "Add Folder" → **spotlight inline folder name input** (600ms) → type "Single" → Enter → **spotlight created folder** (800ms) → right-click "Get User" → **spotlight context menu with "Move to…"** (800ms) → hover "Move to…" → **spotlight submenu showing available folders** (800ms) → click "Single" → **spotlight moved request inside folder** (1000ms) |
| 3 | `req2-search` | Search & Duplicate | `REQ.SIDEBAR_SEARCH` | **Spotlight search input** (600ms) → focus → type "List" → **spotlight filtered results** (1000ms, shows instant filtering) → clear search → right-click "List Users" → **spotlight "Duplicate" in context menu** (600ms) → click → **spotlight duplicated copy** (800ms, shows "(copy)" suffix) |
| 4 | `req2-gallery-tip` | Gallery Quick Tip | `REQ.SIDEBAR_ADD_BTN` | Informational: spotlight + button → explain that besides manual creation, the **Gallery** tab has 50+ pre-built samples against live APIs (JSONPlaceholder, DummyJSON, PokéAPI, etc.) → **spotlight sidebar expand/shrink toggle** (600ms, explains bulk collapse/expand) → **spotlight export button** (800ms, explains JSON export for team sharing) → **spotlight import button** (800ms, explains importing shared collections) |

**Cleanup:** Delete "User Service" collection.

---

### REQ-3: Multi-Environment Requests

**Goal:** Environment-aware collections — relative URLs + switchable base URLs. Show the full ENV Collection modal and environment switching.

| Field | Value |
|-------|-------|
| `id` | `req-multi-env` |
| `estimatedMinutes` | 3 |
| Steps | 5 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'environments']` |

**Public API:** DummyJSON (`https://dummyjson.com`)

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req3-settings-envs` | Create Environments in Settings | `EM.ADD_ENV_INPUT` | Switch to **Settings** tab → spotlight env input (900ms) → type **production** → spotlight **Add Env** (750ms) → click → spotlight new production row (1050ms) → repeat for **staging** → return to Requests tab (520ms pause each tab switch) |
| 2 | `req3-create` | Create Multi-Env Collection | `REQ.SIDEBAR_ADD_BTN` | Click + → spotlight dropdown → click **"ENV Collection"** → modal opens → **spotlight "Base URLs per Environment" section** (1000ms) → fill `production` and `staging` rows with `https://dummyjson.com` (900ms per row spotlight) → **spotlight Default Auth section** (1000ms) → fill name "DummyJSON" → Save → **spotlight ENV badge** on collection (1100ms) |
| 3 | `req3-request` | Add Request & See Resolved URL | `REQ.URL_INPUT` | Right-click → Add Request → rename to **Search Laptops** → **spotlight URL input** (800ms) → type `/products/search?q=laptop&limit=3` → **spotlight resolved URL preview** (1200ms) → **spotlight environment pills bar** (1100ms) |
| 4 | `req3-switch` | Switch Environments & Send | `REQ.envPillByName('staging')` | **Spotlight staging pill** → click → **spotlight resolved URL change** (1200ms) → spotlight production pill → click → spotlight resolved URL back (1100ms) → spotlight Send → click Send → spotlight 200 status/time/size + JSON body |
| 5 | `req3-summary` | When to Use Multi-Env | `REQ.ENV_BAR` | Informational (pauseAfter) — reinforce one relative-path request set across environments and zero URL rewrites |

**Cleanup:** Delete "DummyJSON" collection.

---

### REQ-4: Request Body & Authentication

**Goal:** POST with JSON body, configure auth, and cURL round-trip — all from scratch. Show all body types, auth options, and the cURL workflow.

| Field | Value |
|-------|-------|
| `id` | `req-body-auth` |
| `estimatedMinutes` | 3 |
| Steps | 4 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests']` |

**Public APIs:** JSONPlaceholder (POST), HTTPBin (echo)

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req4-body` | Create POST with JSON Body | `REQ.TAB_BODY` | Create "API Demos" collection → Add Request → **spotlight method dropdown** (800ms) → click → **spotlight all method options** (1000ms, shows GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS with descriptions) → select POST → type URL `https://jsonplaceholder.typicode.com/posts` → click Body tab → **spotlight body type dropdown** (1000ms, shows None/JSON/Form/Text/Binary/GraphQL) → select JSON → **spotlight body editor area** (800ms) → paste `{"title":"Hello","body":"World","userId":1}` → **spotlight filled body** (1000ms) |
| 2 | `req4-send` | Send POST & See 201 | `REQ.SEND_BTN` | Spotlight Send (800ms) → click → **spotlight "201 Created" status** (1000ms, explain 201 = resource created successfully) → **spotlight response body** (1000ms, shows `{"id": 101, "title": "Hello", ...}` — generated ID proves server accepted the request) |
| 3 | `req4-auth` | Configure Bearer Token | `REQ.AUTH_TYPE_SELECT` | Click Auth tab → **spotlight auth type dropdown** (800ms) → click → **spotlight all auth options** (1200ms, shows Inherit / No Auth / Bearer Token / Basic Auth / API Key / OAuth2 with icons & descriptions) → select Bearer → **spotlight token input** (600ms) → fill `demo-token-2024` → **spotlight filled auth section** (1000ms, shows "Authorization: Bearer demo-token-2024" preview) → **spotlight prefix field** (600ms, explain customizable prefix) |
| 4 | `req4-curl` | cURL Import & Export | `REQ.ACTION_MENU_BTN` | **Spotlight action menu button** (800ms) → click → **spotlight dropdown** (800ms, shows cURL Import / cURL Export / Duplicate / Delete) → click "cURL Import" → **spotlight import textarea** (800ms) → paste `curl https://httpbin.org/get -H "Accept: application/json" -H "X-Custom: demo"` → **spotlight Apply button** (600ms) → click Apply → **spotlight populated URL** (800ms, shows httpbin URL parsed) → **spotlight populated headers** (800ms, shows both headers added) → spotlight action menu → click "cURL Export" → **spotlight generated cURL command** (1200ms, shows full reconstructed curl with all headers) → close |

**Cleanup:** Delete "API Demos" collection + close panels.

---

### REQ-5: Send to Harness (Promotion)

**Goal:** Create a request, set up environment target, and promote to automated testing. Show the full promotion workflow including cascade selects, preview, and badges.

| Field | Value |
|-------|-------|
| `id` | `req-send-harness` |
| `estimatedMinutes` | 4 |
| Steps | 5 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests', 'environments']` |

**Public API:** JSONPlaceholder

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req5-setup` | Create Collection & Request | `REQ.SIDEBAR_ADD_BTN` | Create "Promotion Demo" collection → Add Request → name "Get Users" → type URL `.../users` → spotlight URL (600ms) → Send → **spotlight 200 status** (800ms) → confirm working request |
| 2 | `req5-env` | Create Demo Environment | `EM.ADD_ENV_INPUT` | Navigate to Settings → Environments → **spotlight environment list** (800ms) → create "demo" env → **spotlight created environment** (1000ms) → **spotlight microservice section** (800ms) → create "jsonplaceholder" microservice → **spotlight created microservice** (800ms) → click Configure → **spotlight protocol options** (800ms, shows HTTP/gRPC/WebSocket) → add HTTP → fill base URL `https://jsonplaceholder.typicode.com` → **spotlight configured HTTP row** (1200ms, shows base URL + protocol badge) |
| 3 | `req5-promote` | Open Promotion Modal | `REQ.SEND_HARNESS_BTN` | Back to Requests → select request → **spotlight "Send to Harness" button** (1000ms) → click → modal opens → **spotlight Environment cascade** (800ms, select "demo") → **spotlight Microservice cascade** (800ms, select "jsonplaceholder") → **spotlight Feature Group cascade** (800ms, create "API Tests") → **spotlight Scenario cascade** (800ms, create "User Endpoints") → **spotlight all 4 filled cascades** (1000ms) |
| 4 | `req5-confirm` | Confirm & See Badge | `REQ.HARNESS_CONFIRM_BTN` | **Spotlight Next button** → click → **spotlight preview panel** (1000ms, shows scenario snapshot with method/URL/headers) → **spotlight Confirm button** (800ms) → click → **spotlight "IN HARNESS" badge** on sidebar request item (1200ms, explains request is now linked to Test Harness) |
| 5 | `req5-batch` | Batch Promotion | `REQ.colByName('Promotion Demo')` | Right-click collection → spotlight "Send to Harness" in context menu (800ms) → click → **spotlight batch modal** (1000ms, shows checkbox list of all requests in collection) → **spotlight select-all checkbox** (600ms) → **spotlight "folder → scenario" mapping explanation** (800ms) → Cancel → explain this promotes entire collections at once |

**Cleanup:** Delete "Promotion Demo" collection + cancel modals. Keep demo env/svc.

---

### REQ-6: Definition Versioning & History

**Goal:** Auto-snapshots, version diff, and restore — full cycle with hand-created requests. Show the complete version tracking lifecycle.

| Field | Value |
|-------|-------|
| `id` | `req-versioning` |
| `estimatedMinutes` | 3 |
| Steps | 4 |
| `initialTab` | `requests` |
| `allowedTabs` | `['requests']` |

**Public API:** JSONPlaceholder

**Steps:**

| # | ID | Title | Highlight | Action (combined) |
|---|---|---|---|---|
| 1 | `req6-create` | Create Two Requests | `REQ.URL_INPUT` | Create "Version Demo" collection → Add Request → type "Users" name → fill URL `https://jsonplaceholder.typicode.com/users` → **spotlight filled request** (800ms) → Add second Request → type "Posts" → fill URL `.../posts` → **spotlight both requests in sidebar** (800ms) |
| 2 | `req6-edit` | Edit & Navigate (Auto-Snapshot) | `REQ.TAB_HISTORY` | Select "Users" → **spotlight URL input** (600ms) → append `?_limit=5` → **spotlight edited URL** (800ms, explain the change) → click Headers tab → **spotlight headers section** (600ms) → add `X-Version: v2` header → **spotlight new header row** (800ms) → Click "Posts" in sidebar (triggers auto-snapshot on "Users") → click back to "Users" → click History tab → **spotlight version list panel** (1200ms, shows 2 entries: original + edited, with timestamps) → **spotlight auto-snapshot explanation** (800ms, explain "navigate away = save version") |
| 3 | `req6-compare` | Compare Versions | `REQ.VERSION_COMPARE_BTN` | **Spotlight version list** (600ms) → select both entries → **spotlight Compare button** (800ms) → click → **spotlight diff modal** (1500ms, shows side-by-side: URL change highlighted in green/red, new header row highlighted) → **spotlight URL diff line** (800ms) → **spotlight header diff section** (800ms) → close diff modal |
| 4 | `req6-restore` | Restore & Rename | `REQ.VERSION_RESTORE_BTN` | **Spotlight Restore button** on original version (800ms) → click → **spotlight reverted URL** (1000ms, shows `?_limit=5` removed — back to original) → **spotlight Rename button** (800ms) → click → **spotlight inline rename input** (600ms) → type "before pagination" → confirm → **spotlight renamed entry** (1000ms, shows meaningful label instead of timestamp) |

**Cleanup:** Delete "Version Demo" collection.

---

## Category: Catalog

*(Same structure as v1 plan — CAT-1 through CAT-4 unchanged. Implementation after Requests lessons.)*

---

## Shared Implementation Patterns (v2)

### Cleanup Template

```typescript
cleanup: async (ctx) => {
  // 1. Close any open overlays
  dismissContextMenu();
  closeModal('.req-col-modal');
  closeModal('[data-testid="send-harness-modal"]');

  // 2. Clear search input
  const search = document.querySelector<HTMLInputElement>(REQ.SIDEBAR_SEARCH);
  if (search?.value) fillControlledInput(search, '');

  // 3. Delete lesson-created artifacts
  await deleteCollectionByName(ctx, COLLECTION_NAME);

  // 4. Navigate back
  ctx.navigateToTab('requests');
  await ctx.delay(80);
},
```

### Step Action Template (Rich Spotlighting)

```typescript
action: async (ctx) => {
  // 1. Open the UI element
  await spotlight(ctx, REQ.SIDEBAR_ADD_BTN, 800);
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);

  // 2. Spotlight the dropdown so user sees ALL options
  await spotlight(ctx, REQ.ADD_DROPDOWN, 1200);

  // 3. Spotlight the specific option we'll click
  await spotlight(ctx, REQ.ADD_URL_COLLECTION, 800);
  await ctx.click(REQ.ADD_URL_COLLECTION);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);

  // 4. Spotlight EACH section of the modal
  await spotlightEl(ctx, nameGroup, 800);      // Collection Name
  await spotlightEl(ctx, modeSwitcher, 1000);   // URL Mode (explain both)
  await spotlightEl(ctx, authGroup, 800);       // Default Auth

  // 5. Fill and save
  fillControlledInput(nameInput, 'My API');
  await ctx.delay(400);
  saveBtn.click();
  await ctx.delay(400);

  // 6. Spotlight the outcome
  await spotlight(ctx, REQ.colByName('My API'), 1000);
},
```

### PreAction Template

```typescript
preAction: async (ctx) => {
  // Pure state recovery — NO delays, NO visible actions
  ensureRequestsTab(ctx);
  if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
    await ensureCollectionAndRequest(ctx);
  }
  await ctx.waitFor(REQ.URL_INPUT, 2000);
},
```

### spotlight Timing Guide

| Context | Hold Duration |
|---------|-------------|
| Before clicking a button | 800ms |
| Dropdown/modal showing all options | 1000-1200ms |
| Individual section walkthrough | 800ms |
| Important outcome (badge, response, diff) | 1000ms |
| Key feature explanation (mode switcher, auth) | 1000-1200ms |
| Final result (created item, completed action) | 1000ms |

---

## Migration from v1

1. **Rewrite** each lesson file from scratch following v2 patterns
2. **Refactor** `req-demo-helpers.ts`:
   - Remove Gallery-centric helpers (navigateToGalleryRequests, importGallerySample, etc.)
   - Add `createCollectionSilently(ctx, name)` for silent setup
   - Add `addRequestSilently(ctx, collectionName, requestName, url)` for preActions
   - Add `deleteCollectionByName(ctx, name)` for direct cleanup
   - Keep `shrinkAllCollections`, `triggerContextMenu`, `clickContextMenuItem`
3. **Keep** `req-env-helpers.ts` (used by REQ-5)
4. **Keep** `src/shared/selectors/req.ts` (add any missing selectors)
5. **Update** `packages/demo-hub/src/lessons/api/index.ts` barrel

---

## Implementation Priority

| Order | Lesson | Why |
|-------|--------|-----|
| 1 | REQ-1 | Core workflow — validates the v2 "from scratch" pattern |
| 2 | REQ-2 | Tests collection CRUD + context menu + Gallery quick tip |
| 3 | REQ-3 | Multi-env — unique differentiation |
| 4 | REQ-4 | Body + Auth + cURL breadth |
| 5 | REQ-5 | Harness promotion (depends on env) |
| 6 | REQ-6 | Versioning (power user) |
| 7-10 | CAT-1 through CAT-4 | After Requests complete |
