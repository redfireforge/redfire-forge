# GraphQL Studio — Feature Plan

> **Status**: Phase 1 ✅ Complete (1A–1E + Gaps + 23 re-eval rounds, 167 bugs fixed) | Phase 2 Planning ✅ (4 evaluation rounds, 67 tasks prioritized) | **Phase 2.0 Sprints 1–5 ✅** | **Phase 2.1 Sprint 6 ✅** — 992 graphql tests pass, 0 type errors
> **Target Version**: v0.8.x  
> **Prerequisites**: WebSocket Studio (done), Kafka Studio (done), SSE Studio (done)  
> **Last Updated**: 2026-06-18
> **Editor**: Monaco (already in project via `@monaco-editor/react`)

## Implementation Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **1A** | Monaco Editor Integration | ✅ **Done** | Multi-tab editor, variables/headers panels, localStorage persistence, `monaco-graphql` worker, **close-tab two-click confirm** |
| **1B** | Schema Introspection + Explorer | ✅ **Done** | Introspect button, schema parser, schema caching, polling, type explorer with SDL highlighting |
| **1C** | Query Execution Engine | ✅ **Done** | HTTP POST execution, 3-tab response viewer, cancellation, vars validation, **query AST validation squiggles + ⚠ badge**, **Prettify button** |
| **1D** | Connection Management | ✅ **Done** | Auth config popover (Bearer/Basic/API Key), recent endpoints dropdown, **Connection Profiles (save/load endpoint+auth)** |
| **1E** | Environment Variables | ✅ **Done** | `{{var}}` interpolation, two-panel env manager modal, unresolved-var warnings |
| **2A** | Subscription (WS/SSE) | ✅ **Done** | `graphql-ws`, SSE streaming, reconnect, pause/resume, stats, message log |
| **2B–2E Sprint 3–5** | SSE + File Upload + Legacy WS | ✅ **Done** | `graphql-sse` transport, subscription filter bar, multipart file upload, legacy compat, storage.ts migration |
| **2D Sprint 7** | Incremental Delivery + Tracing | ✅ **Done** | `@defer`/`@stream` multipart streaming, `GraphqlTracingView.tsx` Gantt waterfall, query complexity estimator |
| **2F Sprint 6** | Visual Query Builder MVP | ✅ **Done** | `useGraphqlQueryBuilder.ts` (state hook) + `queryBuilderGenerator.ts` (SDL gen) + `GraphqlQueryBuilder.tsx` (field tree, arg inputs, schema search, Edit in Editor) — full-width builder mode with 3-column layout |
| **2C-5 + 2E-4 Sprint 8** | Subscription Assertions + Upload Progress | ✅ **Done** | JSONPath assertion panel, per-message badges, aggregate stats bar, XHR upload progress bar |
| **Phase 2 Deferred (P2 items)** | Fragment Panel, Directive Toggles, Alias, Histogram, Config UI | ⏸ **Deferred** | All P2-priority items explicitly deferred in §23.11 — ship after MVP feedback. See §23.11 for full list. |
| **Phase 3** | Collections + Code Gen | 🔲 Planned — **Re-evaluated 2026-06-18 (27 gaps addressed)** | History (side-panel preview, recent section), collections (runner, variables, fork, schema validation badges), scripts (collection-level + global, rf.test/abort/skip/store, 10s timeout, prototype-safe), code gen (10 targets incl. react-query/go/kotlin, live regen, batch zip), schema diff (lazy-loaded, DEPRECATED, acknowledge, HTML export, op validation, deprecated tracker), mock server (desktop-only, Error mode, scenarios, scalar factories, request log), APQ (hash cache, GET), batching (order, timeout, compat detect), dedup (Promise-store, abort isolation), complexity gate |
| **Phase 4** | Workflow Integration + Lessons | 🔲 Planned | Workflow nodes, demo lessons, gallery templates, E2E tests |

> **Phase 1 Implementation Summaries**: All Phase 1A–1E sub-phases complete with 167 bugs fixed across 23 re-evaluation rounds. CSS class lists, component details, and per-round bug logs are in git history. Key files: `GraphqlStudioPage.tsx`, `GraphqlEditor.tsx`, `GraphqlSchemaExplorer.tsx`, `GraphqlResponseViewer.tsx`, `GraphqlConnectionBar.tsx`, `GraphqlAuthPopover.tsx`, `GraphqlEnvModal.tsx`, `useGraphqlExecution.ts`, `useGraphqlSchema.ts`, `authUtils.ts`, `envUtils.ts`, `monacoGraphqlSetup.ts`, `schemaParser.ts`.

## 1. Executive Summary

Add a **GraphQL Studio** tab to RedfireForge's Protocol Studios, enabling users to:
- Compose and execute queries, mutations, and subscriptions against any GraphQL endpoint
- Explore schemas via introspection with a visual Schema Explorer
- Build operations visually with a point-and-click query builder
- Manage variables, headers, and authentication per-connection
- Track response performance (latency, resolver tracing)
- Save operations to collections and share them
- Integrate with the workflow engine for automated GraphQL testing

This follows the established protocol studio pattern (WebSocket → Kafka → SSE → **GraphQL**).

---

## 2. Market Research & Tool Landscape

### 2.1 Commercial Tools

| Tool | Key Features | Subscription Support | Strengths |
|------|-------------|---------------------|-----------|
| **Postman** | Visual query builder, schema introspection, collections, environments, auth (OAuth2/JWT/AWS), collaboration | ✅ (filterable stream) | Unified platform, team collaboration, multi-protocol |
| **Apollo Studio (GraphOS)** | Schema registry, operation metrics, traces, breaking change detection, Explorer IDE | ✅ (via gateway) | Deep federation support, production monitoring, supergraph management |
| **Insomnia** | Query editor with autocomplete, environment variables, plugins, code generation | ✅ (basic) | Fast, lightweight, open-source core |
| **Thunder Client (VS Code)** | Inline VS Code GraphQL client, collections, env variables | ❌ | IDE-native, zero-config |
| **Hoppscotch** | Open-source Postman alternative, GraphQL tab, real-time subscriptions, collections | ✅ | Free, fast, web-based |
| **RapidAPI/Paw** | Schema explorer, history, code gen, team features | ✅ | Mac-native (Paw), API marketplace |

### 2.2 Open-Source Tools

| Tool | Stars | Key Features | Status |
|------|-------|-------------|--------|
| **GraphiQL** | 16.8k | Official reference IDE, CodeMirror 6/Monaco modes, plugin API, explorer plugin, language service (LSP) | Active (monorepo) |
| **Altair GraphQL Client** | 5k+ | Desktop/Chrome/Firefox, environments, pre-request scripts, file upload, collections, plugin system, auto-schema refresh, query generation from schema | Active (v8.5.4) |
| **GraphQL Playground** | 8.8k | Multi-tab, subscriptions, docs sidebar, tracing, schema polling, sharing (GraphQL Bin) | **Archived** (2026) — merged into GraphiQL |
| **Banana Cake Pop** | — | .NET HotChocolate ecosystem, schema explorer, document sync | Active |
| **GraphQL Voyager** | 7k+ | Visual schema relationship explorer (ER-diagram style) | Maintained |
| **Stellate** | — | Edge caching, rate limiting, metrics dashboard (acquired by The Guild) | Active |
| **Hive (The Guild)** | — | Schema registry, composition checks, observability, gateway, federation audit | Active (MIT) |

### 2.3 Key Libraries for Integration

| Library | Purpose | Notes |
|---------|---------|-------|
| `graphql` (npm) | Core parser/validator/executor | Required — parse, validate, introspect |
| `monaco-graphql` | Monaco editor GraphQL mode | From GraphiQL monorepo — syntax, autocomplete, validation |
| `graphql-language-service` | Autocomplete, diagnostics, hover | Powers `monaco-graphql` under the hood |
| `graphql-ws` | WebSocket subscriptions (spec-compliant) | Modern `graphql-transport-ws` protocol |
| `subscriptions-transport-ws` | Legacy subscription protocol | Deprecated but still used by Apollo Server ≤v3 |
| `@graphql-tools/utils` | Schema utilities, merging | The Guild ecosystem |
| `@graphql-tools/mock` | Auto-mock schema resolvers | For mock server feature |
| `graphql-request` | Minimal GraphQL client | Code-gen target only — not installed as a runtime dependency |
| `extract-files` | File upload (multipart) | GraphQL multipart request spec |
| `meros` | Incremental delivery parsing | `@defer`/`@stream` multipart response |

### 2.4 Key Differentiating Features from Research

Features discovered across competitors that we should prioritize:

| Feature | Found In | Priority for Us |
|---------|----------|----------------|
| **Pre-request / post-response scripts** | Altair, Postman | P2 — dynamic auth tokens, response chaining, advanced testing |
| **File upload (multipart)** | Altair, Postman | P1 — common GraphQL pattern |
| **Persisted queries (APQ)** | Apollo Studio | P2 — production workflow |
| **`@defer`/`@stream` incremental delivery** | Apollo Studio, GraphiQL | P1 — modern spec feature |
| **Query batching** | Apollo, Hoppscotch | P2 — performance optimization |
| **Schema polling / auto-refresh** | GraphQL Playground, Altair | P1 — great DX |
| **Environment variables** | Altair, Postman, Hoppscotch | P0 — essential for teams |
| **Operation collections with folders** | Postman, Apollo, Altair | P1 — organization |
| **Federation-aware introspection** | Apollo Studio, Hive | P2 — enterprise GraphQL |
| **Two-step schema search** (find field → find path) | Apollo Studio | P1 — superior UX |
| **GraphQL Config support** | GraphQL Playground, GraphiQL | P2 — project integration |

---

## 3. Feature Specification

### 3.1 Core Features (Phase 1 — MVP) — ✅ Complete

> **Condensed** — Phase 1 (1A–1E) is fully implemented with 167 bugs fixed. Detailed feature specs preserved in git history.
>
> - **1A** — Monaco Editor: multi-tab editor, `monaco-graphql` worker, variables/headers panels, `⌘ Enter` execute
> - **1B** — Schema Explorer: introspection, polling, 2-pane explorer, SDL tokenizer, click-to-navigate type refs
> - **1C** — Execution Engine: HTTP POST via proxy, 3-tab response viewer, abort, partial results, vars validation
> - **1D** — Connection Management: auth popover (Bearer/Basic/API Key/OAuth2/Custom), recent endpoints, connection profiles
> - **1E** — Environment Variables: `{{var}}` interpolation, two-panel env manager modal, Postman import, unresolved-var warnings

### 3.2 Advanced Features (Phase 2) — ✅ Complete

> **Condensed** — Phase 2 (2A–2G) is fully implemented across 8 sprints, 1015 tests. Detailed feature specs preserved in git history.
>
> - **2A** — WebSocket Subscriptions: `graphql-ws` + `subscriptions-transport-ws` legacy compat, state machine, reconnect, pause/resume
> - **2B** — SSE Subscriptions: `graphql-sse`, auto-detection, transport selector dropdown
> - **2C** — Subscription UI: message log with stats/toolbar/filter/export, JSONPath filter, assertion panel
> - **2D** — Incremental Delivery: `@defer`/`@stream` via `meros`, proxy streaming, chunk tracking
> - **2E** — File Upload: drag-drop UI, multipart FormData, busboy proxy, XHR progress, size validation
> - **2F** — Visual Query Builder: 3-column layout, field tree, arg inputs, schema search, "Edit in Editor"
> - **2G** — Performance & Tracing: Apollo Tracing waterfall, query complexity estimator
### 3.3 Power Features (Phase 3)

Phase 3 is organized into six subsystems (3A–3F). Each subsystem is independently shippable.

#### Phase 3 UI Layout Spec

The Phase 1/2 GraphQL Studio layout has: **Connection Bar** (top), **Editor Tabs** (center), **Schema Explorer** (right sidebar, toggleable). Phase 3 adds five new UI surfaces. Their layout anchors are:

| Surface | Layout anchor | Activation |
|---|---|---|
| **History Panel** (`GraphqlHistoryPanel.tsx`) | Left sidebar — new "History" icon tab in the studio's inner activity strip (separate from the app-level `AppActivityBar`) | Click "History" icon; panel slides in from left, pushes editor inward |
| **Collections Panel** (`GraphqlCollections.tsx`) | Left sidebar — "Collections" icon tab in the same inner activity strip | Click "Collections" icon; same slide-in pattern as History |
| **Collection Runner** (`GraphqlCollectionRunnerPanel.tsx`) | Bottom panel — same area as the script console, activated by "Run All" | Appears as a tab in the bottom panel when a Collection Runner session is active |
| ~~**Code Gen Panel**~~ | ~~Right overlay drawer~~ | **Removed** — 3C cut; "Copy as cURL" in context menus replaces it |
| **Mock Server Panel** (`GraphqlMockPanel.tsx`) | Right sidebar — new "Mock" icon tab in the inner activity strip, disabled (greyed) in web mode | Click "Mock" icon; replaces Schema Explorer while active |

> The inner activity strip (left side of the GraphQL Studio) has 3 icon tabs: History, Collections, Mock (desktop-only). Each is 40px wide and collapses to icon-only at small widths. This is distinct from the app-level `AppActivityBar` — it is local to the GraphQL Studio page. Implement as `GraphqlStudioActivityBar.tsx`. (Code Gen panel removed — was a 4th tab; cut with 3C.)

> **Phase 3 Re-evaluation — 2026-06-18**
>
> This section was comprehensively re-evaluated against leading open-source and commercial GraphQL clients: **Altair GraphQL Client v8.5.0** (most feature-complete standalone OSS tool), **Bruno v3.4.2** (file-system-based, git-native, collection runner + codegen), **Insomnia v12** (Kong, strong collections/scripting, AI mock servers), **Hoppscotch 2026.5.0** (lightweight OSS, pre-request scripts, code snippets), **Apollo Sandbox / Apollo Studio** (schema-first, enterprise), and **Postman v11+** (most established, GraphQL Runner still unsupported). Also evaluated: GraphQL Code Generator v6, `@graphql-inspector/core` v7.1.3, MSW, Mockd, Mockpit, Moquerie. 27 initial gaps + 8 fifth-pass gaps identified and addressed. Changes marked **[R3-new]** (passes 1-4) or **[R5-new]** (pass 5).

---

#### 3A — Collections & History

**Two data stores, one sidebar:**
- **History**: auto-saved ring buffer of every executed operation (last 100 per connection, configurable 10–500). Stored in IndexedDB. Never requires user action.
- **Collections**: named, user-curated sets of operations organized in a folder hierarchy. Also IndexedDB-persisted.

> **Competitive context**: Altair, Bruno, Insomnia, and Postman all have history + collections. Key differentiators: Bruno stores collections as files on disk (git-native); Postman has collection-level variables and a collection runner; Altair has a side-panel operation preview. The gaps below address what each competitor does better. **[R5-3]** Postman's native GraphQL client still cannot run in the Collection Runner (open issue #12196, Jun 2026) — users must wrap GraphQL as POST requests. RedfireForge's native GraphQL Collection Runner (3A-8/3A-9) is a significant competitive advantage. **[R5-5]** Bruno v3.4.2 now has a full collection runner (run folders with iterations) and native code generation from request menu — updated gaps below.

**History storage design** (`useGraphqlHistory.ts` + IndexedDB):
- Each entry is a `GraphqlHistoryItem` (operation + full response + timestamp)
- **`id` = `crypto.randomUUID()`** — NOT a `connectionId + timestamp` composite. Two executions completing in the same millisecond (e.g., inside a Collection Runner) would produce identical composite keys and cause silent overwrites. `randomUUID()` guarantees uniqueness. `connectionId` and `timestamp` are separate indexed fields.
- **Compound IDB index `[connectionId, timestamp]`**: The "recent" top-5 query (`IDBKeyRange.bound([connectionId, 0], [connectionId, Infinity])` ordered by `timestamp` descending) and all per-connection range queries require a compound index, not two separate single-field indexes. A single `connectionId` index would require loading all history entries for all connections and JS-side filtering, which is O(N_total) not O(N_connection).
- **Response size cap**: `GraphqlHistoryItem.response` stores the raw JSON response string. Very large responses (e.g., 10,000-item queries) can be 2–5MB each. At 100 entries this is 200–500MB of IDB usage. **Cap**: truncate stored response to **512KB** before writing. Truncated entries display a `[Response truncated — click to re-execute]` banner in the history preview panel instead of the full JSON. The original response (in the active response panel) is never truncated — only the stored history copy.
- Eviction: when `maxItems` is reached, the oldest entry **for that connection** is deleted (FIFO per connection, not global)
- Grouped by recency in the UI: **Today**, **Yesterday**, **Last 7 days**, **Older** — dividers auto-computed at render time

**History UI** (`GraphqlHistoryPanel.tsx`):
- Full-height sidebar with search bar at top (filters by operation name or query text)
- Each entry shows: operation type badge (Q/M/S), operation name, timestamp, latency, status (✓ / ✗)
- Click → **side-panel preview** (right of history list): shows operation + pretty-printed response JSON. **[R3-new]** Changed from tooltip hover to a dedicated preview panel — tooltips are too small for real responses (Altair uses a side-panel; so should we)
- Double-click → load into current editor tab (does not execute)
- Triple-click or "Open & Run" button in preview panel → load AND execute immediately
- Context menu: "Save to Collection", "Copy query", "Copy as cURL", "Delete"
- **[R3-new]** "Recent" pinned section at top: 5 most recently executed items shown before recency dividers, regardless of age

**Collections data model** (uses `GraphqlCollectionFolder` + `GraphqlCollectionItem` from Section 4.3):
- Infinite folder nesting via `parentId` reference
- Root items have `folderId: undefined`
- Items support pinning (`isPinned: true` → float to top of folder), tags, and per-item pre/post scripts
- **`sortOrder: number`** field on both `GraphqlCollectionItem` and `GraphqlCollectionFolder` stores display order within a parent. Drag-and-drop writes new `sortOrder` values immediately to IndexedDB; items are loaded and sorted by this field. Without an explicit `sortOrder`, all reordering is lost on page reload.
- Drag-and-drop reorder of items and folders (within-folder only; cross-folder via context menu)
- **[R3-new]** **Collection-level variables**: each collection has a `variables: Record<string, string>` map. Accessible exclusively via `rf.getCollectionVar(key)` / `rf.setCollectionVar(key)` in scripts — they are **not** merged into the global env and are **not** visible to `rf.getEnv()`. This keeps collection variables scoped and prevents accidental cross-collection leakage. Resolution priority for `{{var}}` interpolation in the HTTP request itself: global env → item-level overrides; collection variables are **script-only** and do not participate in `{{var}}` URL/header interpolation automatically (scripts must explicitly call `rf.setHeader()` or `rf.setEnv()` to inject them). UI: "Variables" tab on the collection root row. Inspired by Postman's collection variables.
- **[R3-new]** **Collection-level pre-request script**: one script per collection, run before every item in the collection (before item-level pre-request script). Stored on `GraphqlCollection.preRequestScript`. Execution order: `collection.preRequest → item.preRequest → HTTP → item.postResponse → collection.postResponse`.
- **[R3-new]** **Schema validation status**: each collection item is checked against the current introspected schema at load time using `validate(schema, parse(item.operation.query))`. Items with validation errors show a ⚠ amber badge. When schema changes trigger a diff toast, items are re-validated and broken ones are surfaced in a "Broken operations" filter.

**Collections UI** (`GraphqlCollections.tsx`):
- Folder tree with expand/collapse chevrons
- Right-click context menu: Rename, Duplicate, Move to folder, Delete, **Fork collection** [R3-new]
- Double-click folder name for inline rename
- "Save current operation" button in response panel adds directly to selected folder
- Badge per item: last-run status (green ✓ / red ✗ / gray —), latency, ⚠ if schema-invalid
- "Run" button: loads + executes immediately
- Global search bar filters across all folders by name/tag
- **[R3-new]** **Collection Runner**: "Run All" button on a collection/folder header → runs all items in display order sequentially; shows a mini results table (item name, status, latency, errors) with pass/fail summary. Pause and abort supported. Inspired by Postman's Collection Runner. Implemented as `useGraphqlCollectionRunner.ts` + `GraphqlCollectionRunnerPanel.tsx`.
- **[R3-new]** **Fork/Clone collection**: duplicates the entire collection tree (folders + items) with new UUIDs; prompts for the new collection name. Useful for creating a "staging" copy of a production collection.

**Export/Import format:**
```json
{
  "_exportMeta": {
    "version": "1.1",
    "exportedAt": "2026-06-17T10:00:00Z",
    "source": "RedfireForge/GraphQL"
  },
  "collections": [{
    "id": "...",
    "name": "E-Commerce API",
    "variables": { "baseUrl": "https://api.example.com", "tenantId": "acme" },
    "preRequestScript": "// rf.setHeader('X-Tenant', rf.getCollectionVar('tenantId'))",
    "postResponseScript": "",
    "folders": [{ "id": "f1", "name": "User Auth", "parentId": null, "sortOrder": 0 }],
    "items": [{
      "id": "...",
      "name": "GetUserProfile",
      "folderId": "f1",
      "sortOrder": 0,
      "operation": { "query": "...", "variables": "{}", "operationType": "query" },
      "scripts": { "preRequest": "// rf.setHeader(...)", "postResponse": "" },
      "isPinned": false,
      "tags": ["auth", "user"]
    }]
  }]
}
```

> Note: `version` bumped to `"1.1"` to accommodate collection-level variables, scripts, and `sortOrder`. Importers should accept `"1.0"` (no variables/collection scripts/sortOrder) and `"1.1"`. When importing v1.0 data (or any data where `sortOrder` is missing), assign `sortOrder` by array index position (`item.sortOrder = index`) so the original array order is preserved. Never reject an import because `sortOrder` is missing — default to index-based ordering.

**Import merge vs. replace behavior**:
- **Replace** (default): all existing collections are deleted AND the imported data is inserted **within a single IDB transaction** (`tx = db.transaction(['graphql-collections', 'graphql-collection-folders'], 'readwrite')`). This is atomic — if the browser closes mid-operation, either the old data is intact or the new data is fully inserted; there is no half-deleted state. Never use two separate transactions for delete-then-insert.
- **Merge**: existing collections are kept. Imported items are matched by `id`:
  - If the `id` does not exist locally → inserted as new
  - If the `id` exists → user is prompted: "Overwrite?" / "Keep both" (which generates a new UUID for the imported copy) / "Skip"
- Import always validates the `_exportMeta.version` — schema version mismatches show a warning but proceed.
- The import file picker accepts `.json` only; files > 10 MB show an error before parsing.

**IndexedDB object stores** (created in `idbOpen.ts`, schema version incremented at Phase 3 — `DB_VERSION = 6`):
| Store name | Key | Indexes |
|---|---|---|
| `graphql-history` | `id` (`randomUUID`) | `connectionId`, `timestamp`, **`[connectionId, timestamp]` (compound)** |
| `graphql-collections` | `id` | `name` |
| `graphql-collection-folders` | `id` | `collectionId`, `parentId`, **`[collectionId, sortOrder]` (compound)** |
| `graphql-schema-snapshots` | `id` | `connectionId`, `timestamp` |
| `graphql-diff-acknowledgements` | `id` | `connectionId`, `snapshotId` |

> `idbOpen.ts` `DB_VERSION` must be incremented from `5` to **`6`**. The migration path must create these five new stores without touching existing stores (all other stores have `autoIncrement: false` and must not be recreated).

**History max-items configuration**: The configurable ring buffer limit (10–500) is set in a new **"History" tab** of the connection settings popover (alongside the polling interval). The connection-level setting overrides the global default. A "Clear all history" button with confirmation dialog is also in this tab.

---

#### 3B — Pre-Request / Post-Response Scripts

The full `rf.*` scripting API is documented in **Section 14**. This subsection covers the implementation and UI.

> **Competitive context**: Postman has the most powerful scripting model (pm.* API, collection-level scripts, global scripts, `pm.test()` named assertions). Insomnia has pre/post scripts but simpler sandbox (revamped in 2025 with security hardening: `requireInterceptor`, `evalInterceptor`, configurable sandbox settings). Bruno v3 uses isolated async IIFEs with `bru.getVar()`/`bru.setVar()` and a Safe Mode/Developer Mode toggle for sandboxing. Altair has pre-request scripts via `new Function` with `altair.*` API (including `altair.importModule` for external modules). Key gaps in the original plan: no collection-level scripts, only item-level; `rf.assert` is too primitive vs Postman's `pm.test()`; 5s timeout is too short for real OAuth flows; prototype-chain escape not addressed. **[R5-4]** Altair's execution order differs from ours: Altair runs collection pre-request → all parent collections → window (bottom-up). RedfireForge uses Global → Collection → Item (top-down, matching Postman). Users migrating from Altair should be aware of the inversion. **[R5-7]** Postman uses Chai BDD assertions (`pm.expect(value).to.equal(...)`); our `rf.assert()` is more primitive. Added `rf.expect()` (task 3B-12) for migration compatibility.

**Script execution order** (per request) **[R3-new — clarified]**:
```
Collection pre-request script
  → Item pre-request script
    → HTTP request sent
  → Item post-response script
Collection post-response script
```
Each level is optional. If any pre-request script aborts (via `rf.abort()` or thrown error), the levels below it are skipped and the request is not sent.

> **Global scripts (3B-9) are deferred** — a global script layer running across every collection was deemed Postman-specific complexity not suited to a performance workbench. Scripts are scoped to collection + item only.

**Sandbox implementation** (`preRequestScriptRunner.ts`):

Scripts run in a strict sandboxed context using `new Function` with scope injection — the same pattern used by Postman and Altair. Direct access to `window`, `document`, `globalThis`, `process`, `require`, and `eval` is blocked by variable shadowing:

```typescript
async function runScript(source: string, rfContext: RfContext, timeoutMs = 10000): Promise<void> {
  // Shadow dangerous globals AND block prototype-chain escape
  const wrapped = `(async function execute(rf) {
    "use strict";
    const window = undefined, document = undefined, globalThis = undefined,
          process = undefined, require = undefined, eval = undefined,
          Function = undefined, constructor = undefined;
    ${source}
  })`;
  const fn = new Function('return ' + wrapped)();
  await Promise.race([
    fn(rfContext),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Script timeout after ' + timeoutMs + 'ms')), timeoutMs)
    ),
  ]);
}
```

> **[R3-new]** Default timeout changed from 5s to **10s**. OAuth 2.0 token refresh flows and external auth API calls routinely take 5–8 seconds on slow connections. 5s caused valid scripts to time out. `constructor` and `Function` are now also shadowed to block the `constructor.constructor('return process')()` prototype-chain escape.
>
> **Remaining escape vector**: `Object.getPrototypeOf({}).constructor` is still reachable because `Object` is not shadowed (blocking it would break destructuring and spread). This is an accepted trade-off — the same vector exists in Postman, Altair, and Insomnia. Mitigation: all `rf.*` objects passed into the sandbox must be plain value objects (`Object.freeze`d where mutation is not needed), not class instances, so prototype pollution is contained to the sandbox's own scope and cannot reach app internals.

Key behaviors:
- `rf.abort(msg?)` — **[R3-new]** explicit abort: stops the request and shows `msg` in the script console. Replaces `rf.assert(false, msg)` as the canonical "block this request" mechanism. `rf.assert` still works but is now a softer assertion that only throws `GraphqlAssertionError`.
- `rf.skip()` — **[R3-new]** skips the current item in a Collection Runner execution without counting it as a failure.
- `rf.fetch()` is routed through the proxy — no direct network access from scripts
- All `rf.log()` calls are captured and displayed in the script console
- Timeout (default 10s) is configurable per collection item in `GraphqlScriptConfig.timeout`
- **[R3-new]** `rf.store.get(key)` / `rf.store.set(key, value)` — persistent key-value store scoped to the current Collection Runner run. Data does not persist across independent executions. Useful for passing data between items in a run (e.g., "createdId from step 1 → delete in step 5"). Stored in-memory in `useGraphqlCollectionRunner.ts`.

**`RfContext` interface** (the `rf` object injected into scripts):
```typescript
interface RfContext {
  // Environment (global + collection-level variables merged)
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  // Collection-level variables (R3-new)
  getCollectionVar(key: string): string | undefined;
  setCollectionVar(key: string, value: string): void;
  // Request modification (pre-request only — no-op in post-response)
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  // Request control (R3-new)
  abort(message?: string): never;    // block request with message
  skip(): never;                     // skip item in collection runner
  // Named test assertions (R3-new, Postman-compatible)
  test(name: string, fn: () => void | Promise<void>): void;  // fn throws on assertion failure; async fn awaited
  // Simple assertion
  assert(condition: boolean, message?: string): void;
  // Response (populated only in post-response scripts; undefined in pre-request)
  response?: {
    httpStatus:  number;
    httpHeaders: Record<string, string>;
    data:        unknown;
    errors?:     GraphqlError[];
    latencyMs:   number;
  };
  // Logging (captured into script console)
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  // HTTP fetch (proxied)
  fetch(url: string, init?: RequestInit): Promise<Response>;
  // Cross-item store for Collection Runner (R3-new)
  store: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    delete(key: string): void;
  };
}
```

> **[R3-new]** `rf.test('name', fn)` — named test groups, Postman-compatible. **Implementation pattern**: `rf.test()` does not `await fn()` inline — doing so would mean a single failing test blocks all subsequent `rf.test()` calls in the script. Instead, `rf.test()` appends `{ name, fn }` to a `pendingTests[]` array on the `RfContext`. After `runScript()` returns (i.e., after the script body fully executes), the runner calls `await Promise.allSettled(pendingTests.map(t => t.fn()))` to resolve all tests in parallel and collect pass/fail results. This means test assertions run after the script, which is fine — the script body only registers them. Example:
> ```javascript
> rf.test('response has no errors', () => {
>   rf.assert(!rf.response?.errors?.length, 'Expected no errors');
> });
> rf.test('user id is present', () => {
>   rf.assert(rf.response?.data?.user?.id, 'Missing user.id');
> });
> ```

**`rf.test()` internal implementation** — `pendingTests` is NOT a field on the public `RfContext` interface (user scripts must not see it). The implementation pattern uses a closure:

```typescript
function createRfContext(/* ...params */): { rf: RfContext; resolvePendingTests: () => Promise<CollectionRunTestResult[]> } {
  const _pendingTests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  const rf: RfContext = {
    // ... all other fields ...
    test(name, fn) { _pendingTests.push({ name, fn }); },
  };
  async function resolvePendingTests() {
    const results = await Promise.allSettled(_pendingTests.map(t => t.fn()));
    return results.map((r, i) => ({
      name: _pendingTests[i].name,
      passed: r.status === 'fulfilled',
      error: r.status === 'rejected' ? String(r.reason) : undefined,
    }));
  }
  return { rf, resolvePendingTests };
}
```

`runScript()` calls `createRfContext()`, injects `rf` into the sandbox, awaits the script body, then calls `resolvePendingTests()` to collect results — which are returned alongside any `rf.abort()` / `rf.skip()` signals.

**`rf.getCollectionVar()` / `rf.setCollectionVar()` outside a collection context**: when a script runs from a standalone tab (not a collection item), both methods return `undefined` / are silent no-ops. The `RfContext` factory accepts an optional `collectionVars: Record<string, string> | null` parameter — `null` is passed for non-collection contexts, causing both methods to silently do nothing. This is safe: scripts that use `rf.getCollectionVar('x')` will get `undefined` and can guard with `rf.getCollectionVar('x') ?? rf.getEnv('x')`.

**Post-response script timing and error handling**:
- Pre-request script runs **before** the HTTP request is sent; if it throws or calls `rf.abort()` → request is blocked, error shown in script console, response panel shows "Blocked by pre-request script"
- Post-response script runs **after** the response is received and rendered. The response is shown to the user regardless — post-response failures are non-blocking.
- Post-response script failure: logged as `warn` in the script console with an amber `⚠ Post-script error` indicator on the collection item row. The next execution clears this indicator.

**Script scope isolation** (per-tab, per-execution):
- Each execution creates a fresh `RfContext` object — no state carries over between runs (except `rf.store` during a collection runner run)
- Variables set via `rf.setEnv()` modify the active environment and persist across executions (they are written to `GraphqlEnvironment.variables` immediately)
- Variables set via `rf.setHeader()` apply only to the current execution — they are not persisted to the connection's header table
- **`rf.store` outside the Collection Runner**: when a script is run for a single item (not via the Collection Runner), `rf.store` is a **no-op stub** — `get()` always returns `undefined`; `set()` and `delete()` silently do nothing. This prevents errors in scripts written for collection runner use that are tested individually. The Collection Runner passes a live shared `Map` for `rf.store`; the single-item path passes the stub.

**Script editor UI** (integrated into each collection item's detail panel):
- Monaco editor in JavaScript mode — height 120px, resizable; reuses existing Monaco instance
- Custom completions for `rf.*` methods (registered via `monaco.languages.registerCompletionItemProvider`)
- "Test Script" button: runs the script against the most recent history response (dry-run without execution)
- Script console panel below: `rf.log()` output, errors, assertion failures, `rf.test()` results — color-coded (gray log, amber warn, red error, green pass, red fail per test)
- Tab indicator shows if a script is set: `[Script]` badge on the collection item row
- **[R3-new]** Collection-level script editor: "Collection Scripts" tab on the collection root (shows Pre-Request and Post-Response tabs within it)
- **[R3-new]** Global script editor: in app settings → "GraphQL Scripts" → "Global Pre-Request" / "Global Post-Response" (applies to every collection item, every execution). Stored via `setStorage('graphql-global-scripts', ...)` from `src/utils/storage.ts` — **not** raw `localStorage` — to ensure Tauri compatibility.

**Script template library** (dropdown in editor toolbar):

| Template | Inserts |
|---|---|
| OAuth2 Token Refresh | Check expiry via `rf.getEnv('tokenExpiry')`, fetch new token, `rf.setEnv` + `rf.setHeader` |
| JWT Decode (debug) | Decode payload via `atob(parts[1])`, `rf.log` claims |
| Inject Tenant ID | `rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'))` |
| Assert No GraphQL Errors | `rf.test('no errors', () => rf.assert(!rf.response?.errors?.length))` |
| Extract and Chain ID | `rf.setEnv('createdId', rf.response?.data?.createX?.id)` |
| **[R3-new]** Chain with Store | `rf.store.set('createdId', rf.response?.data?.createX?.id)` |
| **[R3-new]** Skip if Env Missing | `if (!rf.getEnv('apiKey')) rf.abort('apiKey env var not set')` |

---

#### 3C — ~~Code Generation~~ (Removed — out of scope)

> **Rationale**: RedfireForge is a **Performance Workbench**, not a client-side code scaffolding tool. Code generation (TypeScript hooks, React Query, Apollo Client, Python gql, Go/Kotlin clients) serves developers *building apps that consume a GraphQL API* — not developers *testing and performance-testing one*. This is the domain of tools like `@graphql-codegen`, Altair's code gen, and Apollo Studio. Shipping a full code gen panel would dilute the product's identity.
>
> **What replaces it**: A lightweight **"Copy as cURL"** action is already specified in the history panel context menu (task 3A-2) and collection item context menu (task 3A-4). This is the one genuinely useful testing-adjacent snippet: it lets a developer share a reproducible request with a colleague or paste it into a terminal. No panel, no code gen engine, no `fflate` dependency needed.

---

#### 3D — Schema Diff & Validation

Uses `@graphql-inspector/core` — the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura).

> **Competitive context**: Apollo Studio has the most advanced schema diff (integrated with CI, change history tracked per deployment). Hive (open source) wraps `@graphql-inspector/core` directly. Most standalone clients (Altair, Insomnia, Bruno) have NO schema diff. This is a strong differentiator. Gaps in original plan: no operation validation against schema changes; no `@deprecated` tracking; no "acknowledge" mechanism; `@graphql-inspector/core` not lazy-loaded (adds to bundle even when unused).

**Lazy loading** **[R3-new]**: `@graphql-inspector/core` is ~70KB gzipped. It must be dynamically imported only when the schema diff feature is used:
```typescript
// schemaDiff.ts
async function computeSchemaDiff(oldSdl: string, newSdl: string): Promise<GraphqlSchemaDiffResult> {
  const { diff: inspectorDiff, CriticalityLevel } = await import('@graphql-inspector/core');
  // ...
}
```
This keeps Phase 3 from bloating the main bundle.

**Snapshot lifecycle** (`schemaSnapshot.ts`):
1. User clicks "Save snapshot" in Schema Explorer toolbar → captures current SDL + `GraphqlSchemaInfo` + timestamp
2. User can add a label: "v2.3 — before user model refactor"
3. Stored in IndexedDB per `connectionId`; limit 20 per connection (oldest evicted)
4. Snapshots listed in "Changelog" tab of Schema Explorer: date, label, type count, diff button

**Schema diff algorithm** (`schemaDiff.ts`):

> **[R3-fix]** `CriticalityLevel` must NOT be imported statically at the top of the file — a static import loads the entire `@graphql-inspector/core` module at bundle time, defeating the lazy-load strategy. Import everything from the single dynamic `await import(...)` call.

```typescript
// NO top-level import of @graphql-inspector/core — everything comes from the dynamic import below
import { buildSchema } from 'graphql';

export async function computeSchemaDiff(oldSdl: string, newSdl: string): Promise<GraphqlSchemaDiffResult> {
  const { diff: inspectorDiff, CriticalityLevel } = await import('@graphql-inspector/core');
  const changes = inspectorDiff(buildSchema(oldSdl), buildSchema(newSdl));
  return {
    changes: changes.map(c => ({
      criticality: c.criticality.level === CriticalityLevel.Breaking  ? 'BREAKING'
                 : c.criticality.level === CriticalityLevel.Dangerous ? 'DANGEROUS' : 'SAFE',
      path:        c.path ?? '',
      description: c.message,
      oldValue:    c.meta?.oldValue,
      newValue:    c.meta?.newValue,
      acknowledged: false,           // R3-new
      acknowledgeNote: undefined,    // R3-new
    })),
    breakingCount:  changes.filter(c => c.criticality.level === CriticalityLevel.Breaking).length,
    dangerousCount: changes.filter(c => c.criticality.level === CriticalityLevel.Dangerous).length,
    safeCount:      changes.filter(c => c.criticality.level === CriticalityLevel.NonBreaking).length,
  };
}
```

**Breaking change severity categories:**

| Severity | Examples |
|---|---|
| `BREAKING` | Field removed, required argument added, field type changed incompatibly, enum value removed |
| `DANGEROUS` | Default value changed, argument type changed compatibly, union member removed |
| `SAFE` | Field added, optional argument added, description changed, directive added |
| **[R3-new]** `DEPRECATED` | `@deprecated` directive added to a field or argument — surfaced separately for visibility |

> **[R3-fix] Implementation note**: `@graphql-inspector/core` has only three native `CriticalityLevel` values: `Breaking`, `Dangerous`, `NonBreaking`. No change's `type` string ever contains the word `DEPRECATED`. The correct approach is a separate `detectDeprecationChanges(oldSdl, newSdl)` function implemented in `schemaDiff.ts`:
>
> ```typescript
> import { buildSchema, isObjectType, isInterfaceType, GraphQLSchema } from 'graphql';
>
> function detectDeprecationChanges(oldSdl: string, newSdl: string): GraphqlSchemaDiffChange[] {
>   const oldSchema = buildSchema(oldSdl);
>   const newSchema = buildSchema(newSdl);
>   const results: GraphqlSchemaDiffChange[] = [];
>   const typeMap = newSchema.getTypeMap();
>
>   for (const typeName of Object.keys(typeMap)) {
>     const newType = typeMap[typeName];
>     if (!isObjectType(newType) && !isInterfaceType(newType)) continue;
>     if (typeName.startsWith('__')) continue; // skip introspection types
>     const oldType = oldSchema.getType(typeName);
>     const oldFields = (isObjectType(oldType) || isInterfaceType(oldType))
>       ? oldType.getFields() : {};
>     for (const [fieldName, newField] of Object.entries(newType.getFields())) {
>       const oldField = oldFields[fieldName];
>       const wasDeprecated = oldField?.deprecationReason != null;
>       const isDeprecated  = newField.deprecationReason != null;
>       if (isDeprecated && !wasDeprecated) {
>         results.push({
>           criticality: 'DEPRECATED',
>           path: `${typeName}.${fieldName}`,
>           description: `Field ${typeName}.${fieldName} was marked @deprecated: ${newField.deprecationReason}`,
>           acknowledged: false, acknowledgeNote: undefined,
>         });
>       }
>       // Also check arguments:
>       for (const arg of newField.args) {
>         const oldArg = oldField?.args.find(a => a.name === arg.name);
>         if (arg.deprecationReason != null && oldArg?.deprecationReason == null) {
>           results.push({
>             criticality: 'DEPRECATED',
>             path: `${typeName}.${fieldName}(${arg.name}:)`,
>             description: `Argument ${arg.name} on ${typeName}.${fieldName} was marked @deprecated`,
>             acknowledged: false, acknowledgeNote: undefined,
>           });
>         }
>       }
>     }
>   }
>   return results;
> }
> ```
>
> `detectDeprecationChanges` is called after `inspectorDiff()` and its results are appended to `changes[]`. The `graphql` package exports `isObjectType`, `isInterfaceType` — both are already in the bundle from Phase 1.

**Schema diff UI** (`GraphqlSchemaDiff.tsx`):
- Side-by-side SDL panels (left = old snapshot, right = current schema) with line-level diff highlights: red deleted lines, green added lines
- Change list panel below: severity badge, path, human-readable description, old/new value
- Summary header: `3 Breaking   2 Dangerous   8 Safe   1 Deprecated` with colored count pills
- Severity filter buttons: `All | Breaking | Dangerous | Safe | Deprecated`
- **[R3-new]** "Acknowledge" button per BREAKING change row: marks the change as intentional; adds a text note field. Acknowledged changes are shown with a checkmark badge and moved to an "Acknowledged" section. Acknowledgements are persisted in IndexedDB alongside the diff metadata.
- "Export diff as JSON" button — exports the full `GraphqlSchemaDiffResult` including acknowledgements
- **[R3-new]** "Export as HTML report" button — generates a standalone HTML file (self-contained, no external deps) matching the `@graphql-inspector` CLI report style. Useful for sharing with teams.
- "Download SDL" button (downloads the current schema SDL)
- Automatic diff toast on schema refresh: "Schema changed — view diff?"

**Snapshot vs. snapshot comparison** (in addition to snapshot-vs-current):
- In the "Changelog" tab of Schema Explorer, each snapshot row has a diff button AND a dropdown to select the comparison target: `vs. Current Schema` (default) or `vs. [other snapshot name]`
- When two snapshots are selected, `computeSchemaDiff(snapshot1.sdl, snapshot2.sdl)` is called — the same function, just using two historical SDLs instead of one + current
- The diff view header updates to show both snapshot labels: `"v2.2 — before migration" vs. "v2.3 — after migration"`
- This enables auditing historical schema evolution without needing the live endpoint
- **Acknowledgements are NOT persisted for snapshot-vs-snapshot comparisons.** The `acknowledged` flag and "Acknowledge" button only apply to `snapshot-vs-current` diffs (because only those changes are actionable — they describe what needs to be addressed before a deployment). Snapshot-vs-snapshot diffs are read-only historical audits. The `GraphqlSchemaDiff.tsx` component hides the "Acknowledge" button when both sides are historical snapshots (i.e., neither is "current schema"). The `snapshotId` field in `graphql-diff-acknowledgements` keys always refers to the baseline snapshot; when comparing two historical snapshots, no IDB writes are performed.

**[R3-new] Collection operation validation against schema changes**:
- When a schema diff is detected (auto-toast on refresh), each collection item's `operation.query` is re-validated via `validate(newSchema, parse(item.operation.query))` (using the `graphql` package's `validate` function — already in our bundle)
- Broken operations (validation errors) are surfaced in a "⚠ N operations broken by this change" banner in the diff view, listing each affected item
- Clicking an item opens the collection item detail with validation errors highlighted inline in Monaco
- Items are also marked with an amber ⚠ badge in the collections tree

**[R3-new] `@deprecated` field usage tracking**:
- Separate from breaking changes: scan each collection item's AST for fields marked `@deprecated` in the current schema
- Show a "Deprecated field usage" section in Schema Explorer sidebar: lists which items use which deprecated fields
- Clicking a deprecated-field row in the list opens the collection item and highlights the deprecated field in Monaco

**Diff result persistence**:
- The diff result is NOT persisted — it is recomputed fresh every time the diff view is opened
- Recomputation is fast (<100ms for typical schemas) since `@graphql-inspector/core` is synchronous
- **Acknowledgements ARE persisted** in a dedicated fifth IDB store: `graphql-diff-acknowledgements`, keyed by `id` = `${connectionId}__${snapshotId}__${changePath}`. Storing acknowledgements on the snapshot object would require mutating a snapshot (which is write-once by design). The separate store allows acknowledgements to outlive snapshot rewrites and be fetched by `connectionId + snapshotId` as a batch. This store is created in the same `idbOpen.ts` migration as the other Phase 3 stores (see task 3A-12 / 3D-9).
- Benefit: always reflects the latest state; no stale diff cache to manage

---

#### 3E — Mock Server

> **Competitive context**: MSW (Mock Service Worker) is the leading browser-based mock solution but is framework-level, not tool-level. Mockpit (Rust-based, MSW-compatible) is 3-4x faster but also framework-level. Mockd (Go standalone binary) supports GraphQL + 6 other protocols with AI-generated mocks and record/replay. Moquerie generates fake GraphQL/REST APIs from schema with a dashboard UI. Apollo Sandbox has "Sandbox" mock mode. Hoppscotch has no mock server. Altair has no mock server. **[R5-6]** Insomnia v12 now has cloud and self-hosted mock servers with AI-generated responses from natural language prompts and Liquid templates — but these are generic HTTP mocks, not schema-aware GraphQL mocks with per-field resolver control. **RedfireForge remains the only standalone GraphQL client with SDL-driven mock server, per-field resolvers, scenario switching, and custom scalar factories** — a strong differentiator. Key gaps in original plan: no custom scalar factories; no scenario/fixture mode; no error simulation; no request logging; Script resolver shares no code with preRequestScriptRunner; not documented as desktop-only.

> **[R3-new] Desktop-only limitation**: The mock server runs inside the Tauri proxy process (`src-server`). It is **not available in web mode** (when running as a browser app without the proxy). The Mock Server panel must display a clear "Desktop app required" message and disable the toggle when `!isTauri()`.

The mock server runs inside the existing proxy server as a dedicated route. Users point their apps at `http://localhost:3001/api/graphql/mock` instead of the real endpoint.

**Proxy routes** (`src-server/routes/graphql/mock.ts`):
- `POST /api/graphql/mock` — execute `{ query, variables }` against in-memory mock schema
- `POST /api/graphql/mock/config` — activate/deactivate mock, set SDL, set custom resolvers, set latency, set scenarios
- `GET /api/graphql/mock/status` — return `{ enabled, schemaHash, activeResolverCount, latencyMs, requestCount }`
- **[R3-new]** `GET /api/graphql/mock/log` — return last N mock requests with query, variables, resolved response, latencyMs

**Server-side mock execution:**
```typescript
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { execute, parse } from 'graphql';

let mockSchema: GraphQLSchema | null = null;
let mockConfig: GraphqlMockConfig | null = null;
const requestLog: MockRequestLogEntry[] = [];  // R3-new

function configureMock(sdl: string, config: GraphqlMockConfig): void {
  const mocks = buildMockMap(config.resolvers, config.scalarFactories);  // R3-new: scalarFactories
  mockSchema = addMocksToSchema({ schema: makeExecutableSchema({ typeDefs: sdl }), mocks });
  mockConfig = config;
}

async function executeMock(query: string, variables: object): Promise<ExecutionResult> {
  if (!mockSchema) throw new Error('Mock not configured — call POST /api/graphql/mock/config first');
  // R3-new: per-field latency (applied via resolver wrapper, not global delay)
  if (mockConfig?.globalLatencyMs) {
    const jitter = mockConfig.globalLatencyJitterMs ?? 0;
    await delay(mockConfig.globalLatencyMs + Math.random() * jitter);
  }
  const result = await execute({ schema: mockSchema, document: parse(query), variableValues: variables });
  requestLog.push({ query, variables, result, timestamp: Date.now() });  // R3-new
  if (requestLog.length > 200) requestLog.shift();
  return result;
}
```

**Mock resolver types** (4 modes per field) **[R3-new: added Error and enhanced Random]**:
- **Random** (default): `@graphql-tools/mock` generates realistic fake data (strings, numbers, IDs)
- **Fixed**: return a hardcoded value specified in the config
- **Script**: JavaScript expression evaluated per call; the sandbox **cannot reuse the browser-side `preRequestScriptRunner.ts`** directly — the mock server runs in the Node.js proxy (`src-server`). A separate `src-server/utils/mockScriptRunner.ts` using **`vm.runInNewContext(script, sandbox)`** must be implemented. The `vm` built-in provides the same script isolation guarantee as `new Function` but in a Node.js context. The `rf`-like context injected into the mock script is a simplified version: `{ field, typeName, args, log }`. Same 10s timeout enforcement via `vm.runInContext` with `{ timeout: 10000 }`. See task 3E-12.
- **[R3-new] Error**: always returns a GraphQL field error for this field; error message configurable. Useful for testing error handling in client code.

**[R3-new] Custom scalar factories** (`config.scalarFactories`):
`@graphql-tools/mock` generates generic strings for custom scalars (`Email`, `DateTime`, `UUID`, `URL`). Users can configure per-scalar factories:

```typescript
interface MockScalarFactory {
  scalarName: string;          // e.g. "Email", "DateTime"
  mode: 'preset' | 'script';
  preset?: 'email' | 'date-iso' | 'uuid' | 'url' | 'phone' | 'name' | 'sentence';
  script?: string;             // JS expression: e.g. "new Date().toISOString()"
}
```

UI: "Scalar Factories" section in `GraphqlMockPanel.tsx`. Each custom scalar type in the schema gets a row with a preset dropdown. Presets use lightweight built-in generators (no faker.js dependency — keep bundle small).

**[R3-new] Scenario / fixture mode**:
A "scenario" is a named set of resolver overrides activated together. Example: "Create Order Success", "Create Order Duplicate Error", "Network Timeout". Users switch between scenarios with a single click — no need to manually toggle individual field overrides.

```typescript
interface MockScenario {
  id: string;
  name: string;
  description?: string;
  resolverOverrides: MockResolverOverride[];  // subset of resolvers to apply
}
```

UI: "Scenarios" tab in `GraphqlMockPanel.tsx`. Dropdown or list of scenario cards; active scenario is highlighted. "Add scenario" → inline form. Switching scenarios: replaces active resolvers + re-syncs to server (immediate, not debounced).

**Mock schema source**:
The mock server needs an SDL to generate its schema. Two sources are supported:
1. **Use introspected schema** (default): the SDL from the most recent successful introspection of the active connection is automatically sent to the mock server when it is activated. No user action required.
2. **Paste custom SDL**: a Monaco editor in SDL mode appears in the mock panel when "Custom SDL" radio is selected. The user pastes or types an SDL; it is sent to `POST /api/graphql/mock/config` immediately.

If neither source is available (never introspected, no custom SDL), the "Mock mode" toggle is disabled with a tooltip: "Introspect first or provide a custom SDL".

**`useGraphqlMockServer.ts` sync trigger**:
- Config is synced to the server (via `POST /api/graphql/mock/config`) on each of these events:
  1. User toggles mock mode ON → sync full config immediately
  2. User changes a resolver override (Random/Fixed/Script/Error) → debounced 300ms, then sync
  3. User changes global latency, jitter, or seed → debounced 300ms, then sync
  4. User pastes custom SDL → sync on blur of the SDL editor (not on every keystroke)
  5. **[R3-new]** User switches scenario → sync immediately (no debounce)
- Mock mode OFF: sends `{ enabled: false }` — server disables without losing resolver config
- If the sync POST fails (server unreachable): toast "Failed to update mock server — check that the proxy is running" + revert the toggle to OFF

**Mock config persistence** (survives proxy restart and browser refresh):
- `useGraphqlMockServer.ts` persists the full `GraphqlMockConfig` (resolvers, scenarios, scalar factories, latency, seed) to `localStorage` under key `graphql-mock-config-${connectionId}` on every change.
- On hook mount (or proxy restart detection via a failed `GET /api/graphql/mock/status`), the hook reads from `localStorage` and **re-syncs** the config to the server automatically. Mock mode is NOT re-enabled automatically on restart — the user must toggle it ON again (to avoid surprise mock behavior after a restart).
- Custom SDL is stored separately under `graphql-mock-sdl-${connectionId}` — SDLs can be large (up to ~100KB) so they are stored apart from the config object.
- `localStorage` keys use `setStorage`/`getStorage` from `src/utils/storage.ts` for Tauri compatibility.

**Mock server UI** (`GraphqlMockPanel.tsx`):
- **[R3-new]** Desktop-only guard: if `!isTauri()`, show "Mock Server requires the desktop app" with a link to download. Toggle is disabled.
- Toggle switch: "Mock mode" — endpoint pill turns amber + shows `[MOCK]` label
- **Schema source** radio: "Use introspected schema" / "Custom SDL" (shows Monaco editor if Custom selected)
- Type tree (same structure as Schema Explorer): each field row has a resolver override dropdown (Random / Fixed / Script / Error)
- Fixed value: inline JSON input field
- Script: mini Monaco editor (1–3 lines)
- **[R3-new]** Error mode: text input for error message
- Global latency slider: 0–5000ms; **[R3-new]** Jitter input: ±Nms added randomly to each response
- Seed input: integer for deterministic randomness
- **[R3-new]** Scenarios tab: list of named scenarios with activate button; add/edit/delete scenario
- **[R3-new]** Scalar Factories tab: per-scalar preset dropdown
- **[R3-new]** Request Log tab: last 50 mock requests; columns: timestamp, operation name, latency, scenario active; click row to expand query + response JSON. Auto-refreshes every 2s when mock mode is ON.
- **[R3-new]** "Export mock config" button: downloads current resolver overrides + scenarios + scalar factories as JSON
- **[R3-new]** "Import mock config" button: loads a previously exported mock config JSON
- "Reset all to defaults", "Copy mock endpoint URL" buttons
- Status row: "Mock active — 3 custom resolvers — 200ms latency ±50ms — Scenario: Create Order Success — endpoint: localhost:3001/api/graphql/mock"

---

#### 3F — Advanced Query Features

> **Competitive context**: APQ is Apollo-specific (Apollo Server, Apollo Router); most tools don't implement it. Batching is supported by Altair (basic) and Insomnia (basic). Request deduplication is unique to RedfireForge — no major standalone tool has this. Gaps in original plan: APQ hash not cached in memory; APQ GET support missing; batch order preservation not specified; dedup "Wait and merge" AbortController isolation not specified; cross-tab deduplication not addressed.

##### Persisted Queries (APQ)

Automatic Persisted Queries (Apollo APQ spec v1) reduce bandwidth by sending only the query hash on repeat executions.

**Two-step flow:**
1. Client sends hash-only: `{ extensions: { persistedQuery: { version: 1, sha256Hash: "abc..." } } }`
2. Server returns `PERSISTED_QUERY_NOT_FOUND` if not cached
3. Client resends with full query + hash — server caches and responds
4. All subsequent requests use hash-only (cache hit)

**`apqClient.ts`** implementation using browser `crypto.subtle` (no extra npm package):
```typescript
import { parse, print } from 'graphql';

// R3-new: in-memory hash cache to avoid re-hashing the same query
// Max 500 entries — evict oldest (FIFO) to prevent unbounded growth in long sessions
const APQ_CACHE_MAX = 500;
const apqHashCache = new Map<string, string>();  // normalizedQuery → hex hash

export async function computeAPQHash(query: string): Promise<string> {
  const normalized = print(parse(query));  // normalize whitespace before hashing
  const cached = apqHashCache.get(normalized);
  if (cached) return cached;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (apqHashCache.size >= APQ_CACHE_MAX) {
    apqHashCache.delete(apqHashCache.keys().next().value);  // evict oldest (FIFO)
  }
  apqHashCache.set(normalized, hash);
  return hash;
}

export async function executeWithAPQ(
  sendFn: (body: object, method?: 'POST' | 'GET') => Promise<GraphqlResponse>,
  operation: GraphqlOperation,
  useGet = false,  // R3-new: GET support for queries
): Promise<GraphqlResponse> {
  const hash = await computeAPQHash(operation.query);
  const exts = { persistedQuery: { version: 1, sha256Hash: hash } };
  // R3-new: queries can use GET for cache-friendliness (mutations always use POST)
  const method = useGet && operation.type === 'query' ? 'GET' : 'POST';
  const r1 = await sendFn({ extensions: exts }, method);
  if (isPersistedQueryNotFound(r1)) {
    return sendFn({ query: operation.query, extensions: exts }, 'POST');
  }
  return r1;
}
```

**APQ UI:**
- Toggle in connection settings: "Automatic Persisted Queries" (default: off)
- **[R3-new]** Sub-option (shown when APQ is on): "Use GET for queries" checkbox — when enabled, the hash-only first request uses HTTP GET with query params. The `extensions` object is encoded as `?extensions=<encodeURIComponent(JSON.stringify({persistedQuery:{version:1,sha256Hash:"..."}})>)`. The proxy `GET /api/graphql/query` handler must decode: `JSON.parse(decodeURIComponent(req.query.extensions))` to reconstruct the body. Variables (if any) are also URL-encoded: `?variables=<encodeURIComponent(JSON.stringify(vars))>`. Mutations must always use POST regardless of this setting.
- Request metadata panel shows `APQ: abc123ef…` (16-char prefix, hover for full hash)
- First send: `[Cache miss]` amber indicator; subsequent: `[Cache hit]` green indicator

**APQ + batch interaction**: **APQ is disabled for batch requests.** When both APQ toggle and batch mode are active simultaneously, APQ is silently skipped for that batch execution — the batch is sent as a standard `[{query, variables}, ...]` array without `extensions`. Reason: batch already reduces per-request overhead; adding per-operation hash extensions to an array payload adds complexity for negligible gain in a developer tool. The connection settings UI should show a `[APQ inactive during batch]` inline note when both features are enabled.

**APQ — server not supported fallback**:
If the server returns a 400 error or an error with `extensions.code !== 'PERSISTED_QUERY_NOT_FOUND'` on the hash-only first request, it likely doesn't support APQ. In this case:
- `apqClient.ts` falls back to a standard full-query request automatically (transparent to user)
- A `[APQ unsupported]` amber badge is shown in the Metadata tab
- The APQ toggle is automatically disabled for this connection with a toast: "This server does not support APQ — disabled for this connection"
- The detection is cached per `connectionId` in `localStorage` so the fallback test is not repeated

##### Query Batching

Send multiple GraphQL operations in one HTTP request as a JSON array — supported by Apollo Server, Yoga, and most modern servers.

**UI:**
- "Batch" checkbox per operation tab (appears on hover)
- When ≥2 tabs checked: `Send Batch (N)` button appears in connection bar
- Results: stacked N response cards, one per batched operation, **[R3-new] in request-index order** (not response arrival order)
- Warning badge if a subscription tab is checked: "Subscriptions cannot be batched — will be skipped"
- **[R3-new]** "Batch timeout" setting (per connection, default 30s): if any operation in the batch exceeds this, the entire batch is aborted with a timeout error

**[R3-new] Server compatibility detection for batching**:
On the first batch attempt, the proxy **tries the real batch directly** (no probing pre-flight — pre-flight requests are surprising and wasteful). If the server returns a 400, 405, or a non-array JSON response for a `[{query}, {query}]` array payload, the proxy catches the failure, falls back to sending each operation individually, and caches `batchSupported: false` for this `connectionId` in `localStorage`. A toast appears: "This server does not support query batching — sent individually instead." All future batch attempts for this connection automatically use the sequential fallback without retrying array-batch. Users can reset this via connection settings → "Reset batch detection".

**Proxy route** `POST /api/graphql/batch`: relay each operation to upstream individually OR as an array (based on `batchSupported` flag), collect results, return as `ExecutionResult[]`

**Server-side batch handling:** detect whether upstream supports array batching (`array-batch` header or config flag) — if yes, forward as array; if no, execute sequentially and aggregate.

**Batch response error display**:
- Each batched operation gets its own response card, independent of others, ordered by request index
- Success card: green header with operation name + latency
- Error card (HTTP error or GraphQL errors): red/amber header; same error display as single-operation response panel
- Partial batch success: `Batch: 3 passed, 1 failed` summary row above the cards
- Individual card body shows full `data` + `errors` if both are present (partial success per-operation is supported)

##### Request Deduplication

Detect when the same query + variables is fired while an identical request is still in-flight.

**`djb2` hash reference implementation** (synchronous, suitable for the hot dedup key path):
```typescript
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0; // coerce to signed 32-bit
  }
  return (h >>> 0).toString(16); // unsigned hex
}
```
This is a well-known, non-cryptographic hash. Collision probability for typical query strings is negligible in a developer tool context (single user, bounded set of queries). If two different queries produce the same hash (a collision), the dedup incorrectly fires — the "Send anyway" option resolves it. This is an acceptable trade-off vs. the overhead of async SHA-256.

**Detection mechanism** (`useGraphqlExecution.ts`):
- In-flight requests tracked in a `Map<string, { controller: AbortController; promise: Promise<GraphqlResponse> }>` keyed by `djb2(connectionId + print(parse(query)) + JSON.stringify(sortedVariables))` — **`connectionId` is required** in the key; without it, identical queries to two different GraphQL endpoints (two open connections) would be incorrectly deduplicated against each other.
- When a duplicate hash is about to fire: show a non-blocking inline badge on the Execute button
- **[R3-new]** The stored value is the full `Promise<GraphqlResponse>` (not just the controller), enabling "Wait and merge" without a second network call
- On network error or server error: the shared Promise rejects; all waiters receive the same rejection. Each caller wraps `await promise` in its own try/catch to handle it independently.

**Duplicate warning UX:**
- Execute button area shows `[Duplicate in flight]` amber badge
- Dropdown with three choices:
  - **Wait and merge** — return the existing `Promise<GraphqlResponse>` directly; 0 extra network requests. **[R3-new] AbortController isolation**: if the waiting caller calls `abort()`, it cancels only its own display — it does NOT abort the shared underlying request (which may have other waiters)
  - **Cancel original** — `AbortController.abort()` the in-flight request, then fire fresh
  - **Send anyway** — allow both; skip dedup for this one execution
- Toggle per connection: "Request deduplication" (default: on)
- **[R3-new]** Deduplication scope is within-tab only. Cross-tab deduplication is explicitly NOT implemented (it would require a `SharedWorker` or `BroadcastChannel` plus complex state synchronization — the complexity is not justified for a developer tool where tabs are intentionally independent).

##### [R3-new] Complexity Gate

Phase 2 implemented query complexity estimation (badge only). Phase 3 adds an **enforcement gate**:
- New "Block threshold" input in connection settings → "Performance" tab (alongside existing complexity threshold)
- When a query's estimated complexity exceeds the block threshold AND "Block high-complexity queries" is enabled → a modal appears: "Query complexity N exceeds limit M. Send anyway / Cancel"
- The modal shows a breakdown of which fields contributed most to the score
- This is a developer-side safety net — prevents accidentally hammering a production API with a deeply nested query during exploration

### 3.4 Workflow Integration (Phase 4)

Phase 4 integrates GraphQL as a first-class protocol in the Workflow Designer — alongside HTTP, WebSocket, and Kafka. It also ships 12 interactive demo lessons. It is organized into six subsystems (4A–4F).

---

#### 4A — Node Type Definitions

GraphQL nodes follow the same structural contract as all other workflow nodes:
- A `XxxNodeData` interface in `src/features/workflow/types/workflow.ts`
- A factory case in `src/features/workflow/utils/workflowNodeFactory.ts`
- Execution branch in `src/features/workflow/engine/graphRunner.ts`
- A visual config panel component `GraphqlXxxConfigPanel.tsx`

**Node types added to `WorkflowNodeType`**:
```typescript
// Append to the existing union in workflow.ts:
type WorkflowNodeType = /* existing types */ |
  'graphqlQuery' | 'graphqlMutation' | 'graphqlSubscription' |
  'graphqlIntrospect' | 'graphqlAssert';
```

**Shared helper types** (added to `workflow.ts`):
```typescript
export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name to store the extracted value under
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlQueryNodeData`** (used for both `graphqlQuery` and `graphqlMutation` — they are structurally identical):
```typescript
export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint ({{var}} supported)
  query: string;                 // GraphQL operation text
  variables: string;             // JSON string ({{var}} interpolated at runtime)
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;            // reuses shared GraphqlAuth type from graphql.ts
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];   // JSONPath extractions from response.data
  outputBindings: GraphqlOutputBinding[];
}
```

**`GraphqlSubscriptionNodeData`**:
```typescript
export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP/WS endpoint; wss:// derived automatically
  subscriptionQuery: string;     // must start with `subscription`
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  // Stop conditions — first condition reached wins
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on last message: e.g. "$.data.status == 'COMPLETE'"
  extractionRules: GraphqlExtractionRule[];   // applied to each individual message
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlIntrospectNodeData`**:
```typescript
export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;              // default 30000; introspection can be slow on cold starts
  // Optional validation rules — if any fail, the node errors
  minTypeCount?: number;          // error if schema has fewer types than this
  requiredTypes?: string[];       // error if any of these type names are missing from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlAssertNodeData`**:
```typescript
export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  // Source: reference a variable from a previous node's output binding
  sourceVariable: string;        // variable name containing the data to assert on
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' = halt workflow; 'warn' = continue with warning badge
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'exists' | 'not_exists' |
           'gt' | 'gte' | 'lt' | 'lte' | 'matches_regex';
  expectedValue?: string;        // stringified expected value; omitted for 'exists'/'not_exists'
  description?: string;          // human-readable label shown in the run timeline
}
```

---

#### 4B — Graph Runner Execution Logic

All five node types are implemented as new `else if` branches in `src/features/workflow/engine/graphRunner.ts`. The execution follows the same async context pattern as existing HTTP and WebSocket nodes.

**Shared utility imports required** (add to `graphRunner.ts` import block):
```typescript
import { JSONPath }         from 'jsonpath-plus';
import { buildClientSchema, printSchema, isObjectType } from 'graphql';
import { computeAPQHash }   from '../../graphql/utils/apqClient';   // sha256 via crypto.subtle
import { evaluateAssertionOp } from '../../engine/fieldOperatorEvaluation';  // existing 24-op evaluator
import { buildAuthHeaders } from '../../graphql/utils/graphqlClient'; // defined in Phase 1 alongside other transport helpers
```

The `sha256` helper used in the `graphqlIntrospect` branch delegates to `computeAPQHash` (which internally uses `crypto.subtle.digest('SHA-256', ...)`). `buildAuthHeaders` is implemented in Phase 1 and converts a `GraphqlAuth` config into an HTTP `Authorization` header string. `evaluateAssertionOp` is the shared 24-operator evaluator already used by HTTP node assertions.

**`graphqlQuery` / `graphqlMutation` execution**:
```typescript
else if (node.type === 'graphqlQuery' || node.type === 'graphqlMutation') {
  const d = node.data as GraphqlQueryNodeData;
  const endpoint  = resolveVars(d.endpoint,  vars);
  const variables = resolveVars(d.variables, vars); // {{var}} in JSON string values
  const headers   = buildGraphqlHeaders(d.headers, d.auth, env);

  let parsedVariables: Record<string, unknown>;
  try {
    parsedVariables = variables ? JSON.parse(variables) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in variables after interpolation: ${variables}` };
  }

  const start = performance.now();
  const resp  = await httpFetch(`${proxyBase}/api/graphql/query`, {
    method:  'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: d.query, variables: parsedVariables }),
    signal:  ctx.abortSignal,
  });
  const latencyMs = performance.now() - start;
  const body = await resp.json() as { data?: unknown; errors?: unknown[] };

  // Apply extraction rules
  for (const rule of d.extractionRules) {
    const extracted = JSONPath.query(body.data, rule.jsonPath)?.[0];
    vars[rule.variableName] = extracted;
  }
  // Bind standard outputs
  applyOutputBindings(d.outputBindings, { data: body.data, errors: body.errors,
    latencyMs, httpStatus: resp.status, operationName: d.label }, vars);

  // Fail node if GraphQL errors present and no extraction rules consumed them
  if (body.errors?.length) {
    return { status: 'error', message: `GraphQL errors: ${JSON.stringify(body.errors)}` };
  }
}
```

**`graphqlSubscription` execution**:
```typescript
else if (node.type === 'graphqlSubscription') {
  const d = node.data as GraphqlSubscriptionNodeData;
  const wsEndpoint  = deriveWsEndpoint(resolveVars(d.endpoint, vars));
  const messages: unknown[] = [];
  let firstMsgLatency = -1;
  const start = performance.now();

  let parsedSubVariables: Record<string, unknown>;
  try {
    parsedSubVariables = d.variables ? JSON.parse(resolveVars(d.variables, vars)) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in subscription variables: ${d.variables}` };
  }

  // Guard: check abort before opening WebSocket
  if (ctx.abortSignal?.aborted) return { status: 'error', message: 'Aborted before subscription started' };

  await new Promise<void>((resolve, reject) => {
    const client = createGraphqlWsClient(wsEndpoint, d.subscriptionTransport, d.auth);
    // timer and cleanup are forward-referenced; cleanup assigned immediately after subscribe() call
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (d.stopAfterMs) timer = setTimeout(() => { cleanup(); resolve(); }, d.stopAfterMs);

    const cleanup = client.subscribe(
      { query: d.subscriptionQuery, variables: parsedSubVariables },
      {
        next(msg) {
          if (firstMsgLatency < 0) firstMsgLatency = performance.now() - start;
          messages.push(msg.data);
          if (d.stopAfterMessages && messages.length >= d.stopAfterMessages) {
            if (timer) clearTimeout(timer); cleanup(); resolve();
          }
          if (d.stopCondition) {
            const condMet = JSONPath.query(msg.data, d.stopCondition)?.[0];
            if (condMet) { if (timer) clearTimeout(timer); cleanup(); resolve(); }
          }
        },
        error(err) { if (timer) clearTimeout(timer); reject(err); },
        complete()  { if (timer) clearTimeout(timer); resolve(); },
      }
    );
    if (ctx.abortSignal) ctx.abortSignal.addEventListener('abort', () => { cleanup(); resolve(); });
  });

  applyOutputBindings(d.outputBindings, {
    messages, messageCount: messages.length,
    firstMessage: messages[0], lastMessage: messages.at(-1),
    latencyMs: firstMsgLatency,
  }, vars);
}
```

**`graphqlIntrospect` execution**:
```typescript
else if (node.type === 'graphqlIntrospect') {
  const d = node.data as GraphqlIntrospectNodeData;
  const headers = buildGraphqlHeaders(d.headers, d.auth, env);
  const resp = await httpFetch(`${proxyBase}/api/graphql/introspect`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: resolveVars(d.endpoint, vars) }),
    signal: ctx.abortSignal,
  });
  const introspectionResult = await resp.json();
  const schema  = buildClientSchema(introspectionResult.data);
  const sdl     = printSchema(schema);
  const types   = Object.values(schema.getTypeMap()).filter(t => !t.name.startsWith('__'));
  const fields  = types.reduce((n, t) => n + (isObjectType(t) ? Object.keys(t.getFields()).length : 0), 0);
  const sdlHash = await sha256(sdl);

  // Validate rules
  if (d.minTypeCount && types.length < d.minTypeCount) {
    return { status: 'error', message: `Schema has ${types.length} types; expected ≥ ${d.minTypeCount}` };
  }
  for (const req of d.requiredTypes ?? []) {
    if (!schema.getType(req)) return { status: 'error', message: `Required type "${req}" missing from schema` };
  }
  for (const { typeName, fieldName } of d.requiredFields ?? []) {
    const t = schema.getType(typeName);
    if (!isObjectType(t) || !t.getFields()[fieldName]) {
      return { status: 'error', message: `Required field "${typeName}.${fieldName}" missing from schema` };
    }
  }

  applyOutputBindings(d.outputBindings, {
    sdl, typeCount: types.length, fieldCount: fields,
    schemaHash: sdlHash, queryTypeName: schema.getQueryType()?.name ?? 'Query',
  }, vars);
}
```

**`graphqlAssert` execution**:
```typescript
else if (node.type === 'graphqlAssert') {
  const d = node.data as GraphqlAssertNodeData;
  const source = vars[d.sourceVariable];
  const failures: string[] = [];

  for (const assertion of d.assertions) {
    const actual = JSONPath.query(source, assertion.jsonPath)?.[0];
    const passed = evaluateAssertionOp(assertion.operator, actual, assertion.expectedValue);
    if (!passed) {
      failures.push(assertion.description
        ?? `${assertion.jsonPath} ${assertion.operator} ${assertion.expectedValue ?? ''}: got ${JSON.stringify(actual)}`
      );
    }
  }

  if (failures.length > 0 && d.failBehavior === 'error') {
    return { status: 'error', message: failures.join('
') };
  }
  if (failures.length > 0 && d.failBehavior === 'warn') {
    ctx.log('warn', `GraphQL assert warnings:
${failures.join('
')}`);
  }
}
```

**Shared helper** (`buildGraphqlHeaders`):
```typescript
function buildGraphqlHeaders(
  rows: GraphqlNodeHeaderRow[],
  auth: GraphqlAuth | undefined,
  env: Record<string, string>
): Record<string, string> {
  const base = Object.fromEntries(
    rows.filter(r => r.enabled).map(r => [resolveVars(r.key, env), resolveVars(r.value, env)])
  );
  return { ...base, ...buildAuthHeaders(auth) };
}
```

---

#### 4C — Node Configuration Panel UI

Each node type has a dedicated config panel rendered in the workflow designer's right sidebar when the node is selected. Config panels follow the same two-column tab layout as existing node panels.

**`GraphqlQueryConfigPanel.tsx`** (used for both `graphqlQuery` and `graphqlMutation`):

Tabs:
1. **Operation** — endpoint URL input with `{{var}}` autocomplete; Monaco editor in GraphQL mode (height 200px, min; full screen button); "Import from Collections" button (picks an operation from Phase 3 collections)
2. **Variables** — Monaco JSON editor (height 120px) with `{{var}}` interpolation note
3. **Headers** — key-value table (same component as existing HTTP node headers tab)
4. **Auth** — auth type selector (Bearer / Basic / API Key); same as HTTP node auth tab
5. **Extraction** — JSONPath extraction rules table: variable name + JSONPath expression + "Test" button
6. **Output** — output binding table: field dropdown (`data | errors | latencyMs | httpStatus`) + variable name

**"Import from Collections" empty state**: if Phase 3 collections are empty or haven't been set up, the collection picker shows: "No saved operations yet — save one from GraphQL Studio first." with a link that navigates to the GraphQL Studio page in a new tab.

**Extraction tab "Test" button behavior**: runs the JSONPath expression against the most recent successful run output stored in the workflow's run trace (`ctx.runTrace`). If no run exists yet for this node, shows a tooltip "No run data available yet — execute the workflow first." Test result shown inline: `→ "value"` (green) or `→ undefined` (amber).

**Panel validation**: inline validation errors shown in the relevant tab's header with a red dot:
- Operation tab: endpoint URL must be non-empty; editor must not be empty (no blank query); invalid `{{var}}` references shown as amber underlines (warn, not block)
- Variables tab: JSON must parse without error; invalid JSON shows red underline + error message below editor
- Extraction tab: JSONPath expression must be non-empty; variable name must be a valid identifier (`[a-zA-Z_][a-zA-Z0-9_]*`)
- Output tab: variable name must be non-empty and a valid identifier; duplicate variable names within the node show a warning

Field on the canvas node card:
- Shows operation type icon (Q / M) + label + endpoint host (truncated)
- Status badge: last run result (green ✓ / red ✗ / gray —), latency

**`GraphqlSubscriptionConfigPanel.tsx`**:

Tabs:
1. **Subscription** — endpoint URL; Monaco GraphQL editor; variables JSON; transport dropdown (`Auto / graphql-transport-ws / graphql-ws / SSE`)
2. **Stop Conditions** — radio: `After N messages` / `After N seconds` / `When condition met` (JSONPath expression input); defaults to `After 10 messages`
3. **Headers & Auth** — same as query panel
4. **Extraction** — per-message JSONPath extractions (applied to each individual message in the array)
5. **Output** — `messages | messageCount | firstMessage | lastMessage | latencyMs`

**`GraphqlIntrospectConfigPanel.tsx`**:

Tabs:
1. **Endpoint** — URL input + auth + headers
2. **Schema Validation** — optional rules: min type count input; required type names (tag input); required fields (TypeName.fieldName chips)
3. **Output** — `sdl | typeCount | fieldCount | schemaHash | queryTypeName`

**`GraphqlAssertConfigPanel.tsx`**:

Tabs:
1. **Source** — variable picker dropdown (populated from output bindings of upstream nodes via `workflowVariableHints`)
2. **Assertions** — assertion table: JSONPath | operator dropdown | expected value | description; `[+ Add assertion]` button; "Run test" button tests assertions against the most recent run output of the node referenced in `sourceVariable`. If no run data exists, shows "No data — run the workflow first." Operator dropdown includes all 11 operators: `eq, neq, contains, not_contains, exists, not_exists, gt, gte, lt, lte, matches_regex`
3. **Behavior** — fail behavior radio: `Halt workflow (error)` / `Continue with warning`

---

#### 4D — Output Bindings and Variable Chain

The extracted and bound values from GraphQL nodes become available as workflow variables for downstream nodes — identical to how HTTP nodes export `{{nodeLabel.data.user.id}}`.

**Variable naming convention** (same as HTTP nodes):
- `{{nodeLabel.data}}` — full `data` object from query response
- `{{nodeLabel.data.user.id}}` — nested field (dot notation)
- `{{nodeLabel.errors}}` — errors array (usually empty)
- `{{nodeLabel.latencyMs}}` — execution time
- `{{nodeLabel.httpStatus}}` — HTTP status code (usually 200)
- Custom extractions: `{{myVar}}` — named by extraction rule variable name

**For subscription nodes**:
- `{{nodeLabel.messages}}` — array of all collected message payloads
- `{{nodeLabel.messageCount}}` — total messages received
- `{{nodeLabel.firstMessage}}` — first message payload
- `{{nodeLabel.lastMessage}}` — last message payload

**`workflowVariableHints.ts` additions**:

A `WorkflowVariableHint` object has this shape (already defined in the workflow types):
```typescript
interface WorkflowVariableHint {
  category:     string;      // e.g. 'GraphQL Steps', 'HTTP Steps'
  nodeLabel:    string;      // node's label (user-facing)
  variablePath: string;      // full variable reference, e.g. '{{GetUser.data.user.id}}'
  displayLabel: string;      // human-readable label shown in picker, e.g. 'data.user.id'
  valueType:    'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';
}
```

New branches to add:
- **`graphqlQuery` / `graphqlMutation`** branch: emits hints for `data`, `errors`, `latencyMs`, `httpStatus`, `operationName`, plus one hint per `extractionRule` (variableName → `valueType: 'unknown'`)
- **`graphqlSubscription`** branch: emits hints for `messages` (array), `messageCount` (number), `firstMessage` (object), `lastMessage` (object), `latencyMs` (number)
- **`graphqlIntrospect`** branch: emits hints for `sdl` (string), `typeCount` (number), `fieldCount` (number), `schemaHash` (string), `queryTypeName` (string)
- Source category for all: `'GraphQL Steps'` (distinct from `'HTTP Steps'`, `'WebSocket Steps'`)

**`countWorkflowDesignerVariables.ts` update**: this utility counts how many exported variables a workflow design contains (used for the variable counter badge in the toolbar). Add cases for all five GraphQL node types:
- `graphqlQuery` / `graphqlMutation`: count = 5 (standard outputs) + `extractionRules.length`
- `graphqlSubscription`: count = 5 (messages, messageCount, firstMessage, lastMessage, latencyMs)
- `graphqlIntrospect`: count = 5 (sdl, typeCount, fieldCount, schemaHash, queryTypeName)
- `graphqlAssert`: count = 0 (assert nodes consume variables, they don't produce them)

**Canvas node rendering** (`workflowNodeFactory.ts` additions):
```typescript
case 'graphqlQuery': return {
  label: 'GraphQL Query',
  icon: 'GqlQ',    // purple Q badge
  color: 'var(--workflow-node-purple)',
  data: { label: 'GraphQL Query', endpoint: '', query: 'query {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlMutation': return {
  label: 'GraphQL Mutation',
  icon: 'GqlM',    // amber M badge
  color: 'var(--workflow-node-amber)',
  data: { label: 'GraphQL Mutation', endpoint: '', query: 'mutation {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlSubscription': return {
  label: 'GraphQL Subscription',
  icon: 'GqlS',    // teal S badge
  color: 'var(--workflow-node-teal)',
  data: { label: 'GraphQL Subscription', endpoint: '', subscriptionQuery: 'subscription {
  
}',
          variables: '{}', headers: [], stopAfterMessages: 10,
          extractionRules: [], outputBindings: [] } as GraphqlSubscriptionNodeData,
};
case 'graphqlIntrospect': return {
  label: 'GraphQL Introspect',
  icon: 'GqlI',    // blue I badge
  color: 'var(--workflow-node-blue)',
  data: { label: 'GraphQL Introspect', endpoint: '', headers: [],
          timeoutMs: 30000, outputBindings: [] } as GraphqlIntrospectNodeData,
};
case 'graphqlAssert': return {
  label: 'GraphQL Assert',
  icon: 'GqlA',    // green/red A badge
  color: 'var(--workflow-node-green)',
  data: { label: 'GraphQL Assert', sourceVariable: '',
          assertions: [], failBehavior: 'error' } as GraphqlAssertNodeData,
};
```

---

#### 4E — Demo Lessons (12 planned)

Lessons are registered under `protocolsDomain` → `graphql` category (new category, alongside existing `websocket` and `sse`). They share the existing lesson infrastructure (`useDemoHub`, `DemoHubContext`, lesson step engine).

**Lesson registration** (`src/features/demo-player/lessons/protocols/graphql-lessons.ts`):

| # | Lesson title | Steps | Est. time | Key concepts covered |
|---|---|---|---|---|
| 1 | Your First GraphQL Query | 7 | 3 min | Endpoint input, introspect, write query, execute, read response |
| 2 | Variables & Arguments | 8 | 3 min | Variables panel, `$id: ID!` syntax, query reuse with different values |
| 3 | Mutations — Create, Update, Delete | 9 | 4 min | Mutation syntax, input types, optimistic UI preview, error handling |
| 4 | Schema Exploration | 7 | 3 min | Type browser, search, click-to-insert, SDL view, field documentation |
| 5 | Subscriptions — Real-Time Data | 10 | 4 min | WS connection, subscribe, live log, pause/filter, disconnect |
| 6 | Authentication & Headers | 6 | 3 min | Connection profiles, Bearer token, API key, environment variable secrets |
| 7 | Query Builder — Visual Operations | 9 | 4 min | Builder tab, checkbox selection, arguments, aliases, directives, "Edit in Editor" |
| 8 | Collections & History | 8 | 3 min | Save operation, folders, history groups, double-click to re-run |
| 9 | Code Generation & Export | 6 | 2 min | Language selector, TypeScript types, copy/download, cURL snippet |
| 10 | Performance Tracing | 7 | 3 min | Enable tracing, waterfall view, slow resolver identification, complexity badge |
| 11 | Workflow Integration | 8 | 4 min | Add graphqlQuery node, wire to graphqlAssert, run workflow, inspect results |
| 12 | Schema Diff & Breaking Changes | 7 | 3 min | Save snapshot, modify schema, compute diff, BREAKING change badge |

**`preAction` guard requirements** (mandatory per demo-player-lessons rules — all stateful steps need guards):

| Lesson | Stateful steps requiring `preAction` | Guard responsibility |
|---|---|---|
| 1 | Steps 2–7 | Ensure connection is set to the test endpoint; restore introspected schema if absent |
| 2 | Steps 2–8 | Ensure a valid parameterized query is in the editor; restore introspected schema |
| 3 | Steps 2–9 | Ensure mutation operation is loaded; ensure `$id` variable is set to last created ID |
| 4 | Steps 2–7 | Ensure introspection has completed (schema tree populated) |
| 5 | Steps 2–10 | Ensure subscription is set up and in the correct state (connected/paused) |
| 6 | Steps 2–6 | Ensure the selected auth profile is active on the connection |
| 7 | Steps 2–9 | Ensure builder tab is active; restore selection state from `localStorage` key |
| 8 | Steps 2–8 | Ensure at least one operation is saved in history |
| 9 | Steps 2–6 | Ensure an introspected schema and an operation are loaded |
| 10 | Steps 2–7 | Ensure a query with Apollo Tracing response is pre-loaded in the response panel |
| 11 | Steps 2–8 | Ensure workflow has the `graphqlQuery` node added and configured |
| 12 | Steps 2–7 | Ensure at least one snapshot is saved in the Changelog tab |

**Lessons 6–12 expanded step detail**:

| Lesson 6 — Authentication & Headers (6 steps) |
|---|
| Step 1: Navigate to Connection settings → "Auth" tab (observe available auth types) |
| Step 2: Select "Bearer Token", paste `{{authToken}}` env var in the token field |
| Step 3: Open the Environment panel, set `authToken` to a test JWT value |
| Step 4: Execute a query — observe `Authorization: Bearer <token>` in the request metadata |
| Step 5: Switch to "API Key" auth, set header name `X-API-Key`, value `{{apiKey}}` |
| Step 6: Execute again — observe header changed in request metadata |

| Lesson 7 — Query Builder (9 steps) |
|---|
| Step 1: Click the "Builder" sub-tab in the editor area |
| Step 2: Expand the `Query` root — observe all available fields |
| Step 3: Check 3 fields — observe generated SDL update live |
| Step 4: Click "Select All" in the builder toolbar (scope: current level) |
| Step 5: Expand a nested object field — add child fields, observe inline fragment handling |
| Step 6: Click on an argument input for a required argument — fill in a test value |
| Step 7: Set an alias on a field — observe alias: fieldName in SDL |
| Step 8: Click "Edit in Editor" — SDL is copied to Monaco editor; builder deactivates |
| Step 9: Edit the SDL in the editor; observe one-way sync (builder does not re-parse) |

| Lesson 8 — Collections & History (8 steps) |
|---|
| Step 1: Execute any query — confirm it appears in History panel with timestamp |
| Step 2: Click a history entry — observe query loaded into editor (not executed) |
| Step 3: Double-click the entry — observe query loads AND executes immediately |
| Step 4: From response panel, click "Save to Collection" — pick or create a folder |
| Step 5: Open Collections panel — verify the saved item appears in the correct folder |
| Step 6: Drag the item to a different folder — confirm it moves |
| Step 7: Click "Export" — download the collections JSON file |
| Step 8: Delete the collection, then import from the downloaded file — verify restore |

| Lesson 9 — Code Generation (6 steps) |
|---|
| Step 1: Select a query with nested fields — ensure schema is introspected |
| Step 2: Open Code Gen panel — default target is `typescript-graphql-request` |
| Step 3: Check "Include TypeScript types" — observe interface definitions appear above the function |
| Step 4: Switch to `curl` target — observe valid curl command with `-H` Authorization header |
| Step 5: Switch to `python-gql` — observe `client.execute(gql(...))` pattern |
| Step 6: Click "Download" — verify a `.ts` file downloads named from the operation |

| Lesson 10 — Performance Tracing (7 steps) |
|---|
| Step 1: Observe the complexity badge next to Execute button (e.g. "Cost: ~14") |
| Step 2: Add a list field to the query — watch complexity badge increase |
| Step 3: Execute a query against an Apollo Server with tracing enabled |
| Step 4: Click the "Tracing" tab in the response panel — observe waterfall |
| Step 5: Hover a slow bar — read exact duration in tooltip |
| Step 6: Click "Sort by duration" — observe slowest resolvers float to top |
| Step 7: Execute 3 more times — observe histogram strip appears at bottom of response panel |

| Lesson 11 — Workflow Integration (8 steps) |
|---|
| Step 1: Navigate to Workflow Designer — create a new blank workflow |
| Step 2: Drag "GraphQL Query" from node palette — observe purple Q node on canvas |
| Step 3: Click the node — open config panel; fill endpoint + write a simple query |
| Step 4: Add a "GraphQL Assert" node — wire it after the query node |
| Step 5: In the Assert panel Source tab — pick `{{GetUser.latencyMs}}` from variable picker |
| Step 6: Add assertion: `$` lt `500` — "Latency must be under 500ms" |
| Step 7: Run the workflow — observe both nodes turn green |
| Step 8: Change assertion to `lt 1` — re-run, observe assert node turns red with failure detail |

| Lesson 12 — Schema Diff (7 steps) |
|---|
| Step 1: In Schema Explorer, click "Save snapshot" — enter label "baseline" |
| Step 2: Observe the Changelog tab now shows the snapshot entry |
| Step 3: Simulate a schema change (switch to a different endpoint with a modified schema) |
| Step 4: Re-introspect — observe the "Schema changed — view diff?" toast |
| Step 5: Click the toast — observe the diff view opens with side-by-side SDL |
| Step 6: Observe the BREAKING badge count and the specific removed/changed field |
| Step 7: Click "Export diff as JSON" — verify the download contains all change entries |

**Lesson step selectors** (`src/shared/selectors.ts` additions — new `GQL` namespace):
```typescript
export const GQL = {
  // Connection bar
  ENDPOINT_INPUT:      '[data-testid="gql-endpoint-input"]',
  INTROSPECT_BTN:      '[data-testid="gql-introspect-btn"]',
  EXECUTE_BTN:         '[data-testid="gql-execute-btn"]',
  CANCEL_BTN:          '[data-testid="gql-cancel-btn"]',
  CONNECTION_STATUS:   '[data-testid="gql-connection-status"]',
  // Editor
  EDITOR_CONTAINER:    '[data-testid="gql-editor-container"]',
  VARIABLES_PANEL:     '[data-testid="gql-variables-panel"]',
  HEADERS_PANEL:       '[data-testid="gql-headers-panel"]',
  // Response
  RESPONSE_VIEWER:     '[data-testid="gql-response-viewer"]',
  RESPONSE_ERRORS_TAB: '[data-testid="gql-response-errors-tab"]',
  TRACING_TAB:         '[data-testid="gql-tracing-tab"]',
  TRACING_WATERFALL:   '[data-testid="gql-tracing-waterfall"]',
  // Schema Explorer
  SCHEMA_EXPLORER:     '[data-testid="gql-schema-explorer"]',
  SCHEMA_SEARCH:       '[data-testid="gql-schema-search"]',
  SCHEMA_TYPE_ITEM:    '[data-testid="gql-schema-type-item"]',
  // Subscription Log
  SUBSCRIPTION_LOG:    '[data-testid="gql-subscription-log"]',
  SUBSCRIPTION_PAUSE:  '[data-testid="gql-subscription-pause"]',
  SUBSCRIPTION_FILTER: '[data-testid="gql-subscription-filter"]',
  // Query Builder
  BUILDER_TAB:         '[data-testid="gql-builder-tab"]',
  BUILDER_FIELD_ROW:   '[data-testid="gql-builder-field-row"]',
  BUILDER_EDIT_BTN:    '[data-testid="gql-builder-edit-btn"]',
  // History & Collections
  HISTORY_PANEL:       '[data-testid="gql-history-panel"]',
  HISTORY_ENTRY:       '[data-testid="gql-history-entry"]',
  COLLECTIONS_PANEL:   '[data-testid="gql-collections-panel"]',
  SAVE_TO_COLLECTION:  '[data-testid="gql-save-to-collection"]',
  // Code gen
  CODE_GEN_PANEL:      '[data-testid="gql-code-gen-panel"]',
  CODE_GEN_LANG_BTN:   '[data-testid="gql-code-gen-lang-btn"]',
  CODE_GEN_COPY:       '[data-testid="gql-code-gen-copy"]',
  // Environments
  ENV_BADGE:           '[data-testid="gql-env-badge"]',
  ENV_MODAL:           '[data-testid="gql-env-modal"]',
  // Schema diff & snapshots (Lesson 12)
  SNAPSHOT_BTN:        '[data-testid="gql-snapshot-btn"]',
  CHANGELOG_TAB:       '[data-testid="gql-changelog-tab"]',
  DIFF_BTN:            '[data-testid="gql-diff-btn"]',
  DIFF_VIEW:           '[data-testid="gql-diff-view"]',
  BREAKING_BADGE:      '[data-testid="gql-breaking-badge"]',
  // Query builder toolbar (Lesson 7)
  BUILDER_SELECT_ALL:  '[data-testid="gql-builder-select-all"]',
  BUILDER_DESELECT:    '[data-testid="gql-builder-deselect"]',
  BUILDER_ARG_INPUT:   '[data-testid="gql-builder-arg-input"]',
  BUILDER_ALIAS_INPUT: '[data-testid="gql-builder-alias-input"]',
  // Code gen (Lesson 9)
  CODE_GEN_DOWNLOAD:   '[data-testid="gql-code-gen-download"]',
  CODE_GEN_TYPES_OPT:  '[data-testid="gql-code-gen-types-option"]',
  // Performance tracing (Lesson 10)
  COMPLEXITY_BADGE:    '[data-testid="gql-complexity-badge"]',
  TRACING_SORT_BTN:    '[data-testid="gql-tracing-sort-btn"]',
  HISTOGRAM_STRIP:     '[data-testid="gql-histogram-strip"]',
  // Mock server
  MOCK_TOGGLE:         '[data-testid="gql-mock-toggle"]',
  MOCK_ENDPOINT_URL:   '[data-testid="gql-mock-endpoint-url"]',
  // Workflow node config panels (Lesson 11)
  WF_QUERY_PANEL:      '[data-testid="gql-wf-query-panel"]',
  WF_ASSERT_PANEL:     '[data-testid="gql-wf-assert-panel"]',
  WF_IMPORT_BTN:       '[data-testid="gql-wf-import-collections-btn"]',
  WF_EXTRACTION_TABLE: '[data-testid="gql-wf-extraction-table"]',
  WF_OUTPUT_TABLE:     '[data-testid="gql-wf-output-table"]',
};
```

---

#### 4F — Gallery Workflow Templates + E2E Coverage

**Gallery templates** (added to `src/features/workflow/data/emptyCanvasTemplates.ts`):

Four GraphQL-themed quick-start workflows available from the empty canvas gallery:

| Template name | Nodes | Description |
|---|---|---|
| `graphql-health-check` | Start → graphqlIntrospect → graphqlQuery → graphqlAssert → End | Verifies schema is reachable, runs a sentinel query, asserts response time < 500ms |
| `graphql-e-commerce-flow` | Start → graphqlMutation (create order) → graphqlSubscription (watch status) → graphqlAssert → End | Creates an order, subscribes to status updates until `COMPLETE`, asserts final status |
| `graphql-schema-watchdog` | Schedule (existing `scheduleTrigger` node) → graphqlIntrospect → condition (existing `condition` node, checks hash changed) → logDebug (existing `logDebug` node) → End | Polls schema on a cron schedule; logs a warning if the schema hash changes |
| `graphql-user-crud` | Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | Full user lifecycle: create → read → verify → delete |

**Variable wiring between nodes** (how data flows in each template):

`graphql-health-check` wiring:
- `graphqlIntrospect` (label: "Introspect API") outputs `schemaHash` → bound to workflow var `apiSchemaHash`
- `graphqlQuery` (label: "Sentinel Query") outputs `latencyMs` → bound to `sentinelLatency`; outputs `data` → bound to `sentinelData`
- `graphqlAssert` (label: "Assert Health") source: `sentinelLatency`; assertion: `$` lt `500`; failBehavior: `error`

`graphql-e-commerce-flow` wiring:
- `graphqlMutation` (label: "Create Order") outputs `data.createOrder.id` (via extraction rule: `$.createOrder.id`) → var `orderId`
- `graphqlSubscription` (label: "Watch Order Status") variables: `{ "orderId": "{{orderId}}" }`; stopCondition: `$.data.orderStatus.status == 'COMPLETE'`; outputs `lastMessage` → var `finalStatus`
- `graphqlAssert` source: `finalStatus`; assertion: `$.data.orderStatus.status` eq `COMPLETE`

`graphql-schema-watchdog` wiring:
- `graphqlIntrospect` (label: "Check Schema") outputs `schemaHash` → var `currentHash`
- `condition` node: expression `{{currentHash}} !== {{lastKnownHash}}`; true branch → `logDebug`; false branch → End
- Template ships with `lastKnownHash` as an empty string workflow variable (user fills it after first run)

`graphql-user-crud` wiring:
- `graphqlMutation` (label: "Create User") extraction rule: `$.createUser.id` → var `createdUserId`
- `graphqlQuery` (label: "Fetch User") variables: `{ "id": "{{createdUserId}}" }`; outputs `data` → var `fetchedUser`
- `graphqlAssert` (label: "Verify User") source: `fetchedUser`; assertion: `$.user.id` eq `{{createdUserId}}`
- `graphqlMutation` (label: "Delete User") variables: `{ "id": "{{createdUserId}}" }`

**Docker test server** (used by E2E tests in 4F-5, 4F-6):

A minimal GraphQL test server is required for E2E tests that hit a real endpoint. This server runs in Docker alongside the Playwright test suite:
- Image: `node:22-alpine` with Apollo Server 4 + `@faker-js/faker`
- Port: `4010` (GraphQL endpoint: `http://localhost:4010/graphql`, WS: `ws://localhost:4010/graphql`)
- Schema: exposes `Query.user(id: ID!): User`, `Mutation.createOrder(input: OrderInput!): Order`, `Subscription.orderStatus(orderId: ID!): OrderStatus`
- Apollo Tracing: enabled (for Lesson 10 E2E)
- Configuration: `e2e/docker-compose.yml` with service `graphql-test-server`
- Pre-test setup hook in `playwright.config.ts`: `globalSetup: './e2e/global-setup.ts'` which starts Docker Compose and waits for the health endpoint `GET /health` → 200
- APQ: enabled on the test server (for Phase 3 APQ E2E)

**E2E test files** (Playwright, `e2e/` directory):

| File | Scenarios covered |
|---|---|
| `e2e/graphql-query-execution.spec.ts` | Query executes, variables interpolated, response rendered, errors displayed |
| `e2e/graphql-subscriptions.spec.ts` | WS subscription connects, messages appear in log, filter works, disconnect |
| `e2e/graphql-schema-explorer.spec.ts` | Introspect renders type tree, search finds field, click-to-insert works |
| `e2e/graphql-query-builder.spec.ts` | Field selection generates SDL, argument filled, directive toggle, "Edit in Editor" |
| `e2e/graphql-collections.spec.ts` | Save to collection, rename folder, drag-drop, export/import round-trip |
| `e2e/graphql-code-gen.spec.ts` | TypeScript + cURL targets generate valid output |
| `e2e/graphql-workflow-nodes.spec.ts` | Health check workflow runs; `graphqlAssert` fails correctly on bad response |
| `e2e/graphql-lessons.spec.ts` | First 3 lessons complete without error (auto-play mode) |
| `e2e/graphql-schema-diff.spec.ts` | Snapshot saved; re-introspect triggers diff toast; diff view shows BREAKING changes; "Export diff JSON" downloads correctly |
| `e2e/graphql-mock-server.spec.ts` | Mock mode enabled; query returns mock data from test server schema; fixed resolver override returns configured value; latency slider adds correct delay |

---

## 4. Architecture

### 4.1 Directory Structure

```
src/features/graphql/
├── GraphqlStudioPage.tsx          # Main page component (tab content)
├── components/
│   ├── GraphqlEditor.tsx          # Monaco editor with monaco-graphql mode
│   ├── GraphqlSchemaExplorer.tsx  # Type browser sidebar (tree + search)
│   ├── GraphqlVariablesPanel.tsx  # Monaco JSON editor for variables
│   ├── GraphqlHeadersPanel.tsx    # Key-value headers with {{var}} support
│   ├── GraphqlResponseViewer.tsx  # Formatted JSON response + metadata
│   ├── GraphqlSubscriptionLog.tsx # Live subscription message stream
│   ├── GraphqlQueryBuilder.tsx    # Visual field selector (Phase 2)
│   ├── GraphqlConnectionBar.tsx   # URL + auth + introspect/execute buttons
│   ├── GraphqlHistoryPanel.tsx    # Operation history sidebar
│   ├── GraphqlCollections.tsx     # Saved collections with folders (Phase 3)
│   ├── GraphqlEnvironments.tsx    # Environment variable management
│   ├── GraphqlFileUpload.tsx      # File variable picker (Phase 2)
│   ├── GraphqlTracingView.tsx     # Apollo Tracing waterfall (Phase 2)
│   ├── GraphqlSchemaDiff.tsx      # Schema diff viewer: side-by-side SDL + change list (Phase 3)
│   ├── GraphqlMockPanel.tsx       # Mock server control panel: resolver overrides + latency (Phase 3)
│   ├── GraphqlQueryConfigPanel.tsx     # Workflow node config panel for graphqlQuery + graphqlMutation (nodeType prop; no separate mutation file) (Phase 4)
│   ├── GraphqlSubscriptionConfigPanel.tsx  # Workflow node config panel for graphqlSubscription (Phase 4)
│   ├── GraphqlIntrospectConfigPanel.tsx    # Workflow node config panel for graphqlIntrospect (Phase 4)
│   └── GraphqlAssertConfigPanel.tsx        # Workflow node config panel for graphqlAssert (Phase 4)
├── hooks/
│   ├── useGraphqlState.ts         # Main state management hook
│   ├── useGraphqlSchema.ts        # Schema introspection + caching + polling
│   ├── useGraphqlExecution.ts     # Query/mutation execution + @defer/@stream
│   ├── useGraphqlSubscription.ts  # Subscription lifecycle (connect/messages/disconnect/reconnect)
│   ├── useGraphqlQueryBuilder.ts  # Visual query builder state (selectedFields, args, aliases, directives, fragments) — Phase 2
│   ├── useGraphqlHistory.ts       # Operation history persistence
│   ├── useGraphqlCollections.ts   # Collection + folder CRUD (add/update/delete/reorder)
│   ├── useGraphqlMockServer.ts    # Mock server enable/disable, custom resolvers, sync to proxy — Phase 3
│   └── useGraphqlEnvironments.ts  # Environment variable resolution
├── types/
│   └── graphql.ts                 # GraphQL-specific types (re-exports from src/shared/types/graphql.ts)
└── utils/
    ├── graphqlClient.ts           # HTTP + WS transport (fetch + graphql-ws + graphql-sse)
    ├── schemaParser.ts            # Introspection result → navigable tree
    ├── queryBuilder.ts            # Visual builder → SDL generation
    ├── monacoGraphqlSetup.ts      # Monaco language registration + schema binding
    ├── multipartParser.ts         # @defer/@stream multipart response parser
    ├── preRequestScriptRunner.ts  # Sandboxed pre/post-request script executor (rf.* API)
    ├── schemaDiff.ts              # @graphql-inspector/core wrapper → GraphqlSchemaDiffResult (Phase 3)
    ├── schemaSnapshot.ts          # Snapshot capture + IndexedDB storage/retrieval (Phase 3)
    └── apqClient.ts               # APQ: SHA-256 hash via crypto.subtle + two-step retry logic (Phase 3)

src/features/demo-player/lessons/protocols/
└── graphql-lessons.ts             # 12 demo lesson definitions for the GraphQL Studio (Phase 4)

# Workflow engine files modified in Phase 4:
src/features/workflow/
├── types/workflow.ts              # +GraphqlQueryNodeData, +GraphqlSubscriptionNodeData, +GraphqlIntrospectNodeData, +GraphqlAssertNodeData, +helper types
├── utils/workflowNodeFactory.ts   # +factory cases for all 5 graphql node types
├── utils/workflowVariableHints.ts # +graphqlQuery/Mutation/Subscription/Introspect hint branches
├── utils/countWorkflowDesignerVariables.ts  # +graphqlAssert extraction rule counting
└── engine/graphRunner.ts          # +execution branches for all 5 graphql node types
```

### 4.2 Transport Layer (Proxy Server)

```
src-server/routes/graphql/
├── index.ts                       # Route registration
├── query.ts                       # POST /api/graphql/query (+ multipart for @defer)
├── introspect.ts                  # POST /api/graphql/introspect
├── subscribe.ts                   # WS upgrade /api/graphql/subscribe (Phase 2)
├── sse.ts                         # GET /api/graphql/sse — SSE subscription relay (Phase 2)
├── upload.ts                      # POST /api/graphql/upload (multipart file upload, Phase 2)
├── batch.ts                       # POST /api/graphql/batch (array of operations, Phase 3)
└── mock.ts                        # POST /api/graphql/mock + /mock/config + GET /mock/status (Phase 3)
```

**Note on schema diff**: `schemaDiff.ts` runs entirely client-side using `@graphql-inspector/core`. There is no `/api/graphql/schema-diff` proxy route — the diff computation happens in the browser and requires no server interaction.

**Why proxy?** (Same rationale as WebSocket/Kafka/SSE Studios)
- Bypass CORS restrictions on target GraphQL endpoints
- Handle mTLS/cert validation server-side (skip-cert-verify option)
- Normalize subscription protocol differences (`graphql-ws` vs `subscriptions-transport-ws`)
- Stream `@defer`/`@stream` multipart responses through to client
- Handle file uploads (multipart form-data → target server)
- Enable Tauri IPC transport compatibility (same API surface)
- Add request/response logging for debugging

### 4.3 Shared Types

```typescript
// src/shared/types/graphql.ts

export interface GraphqlConnection {
  id: string;
  name: string;
  endpoint: string;
  wsEndpoint?: string;       // subscription endpoint (default: swap http(s) → ws(s) from endpoint URL)
  headers: Record<string, string>;
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  schemaPollingInterval?: number;  // ms between schema re-fetches; 0 = disabled (default: 30000)
  createdAt: number;               // Unix ms — used for sorting profiles in the profile switcher dropdown
  updatedAt: number;               // Unix ms — updated whenever the user edits the connection
  // Phase 2 — subscription transport selection
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  sseMode?: 'distinct' | 'single';  // only relevant when subscriptionTransport is 'sse'; default: 'distinct'
  // Phase 2 — query complexity estimator thresholds
  complexityThreshold?: number;  // cost badge turns red above this value (default: 500)
  complexityListMultiplier?: number; // list field cost multiplier (default: 10)
  complexityMaxDepth?: number;   // depth beyond which sub-tree cost doubles (default: 10)
  // Phase 2 — subscription log
  subscriptionBufferSize?: number; // max messages in memory (default: 5000)
  // Phase 2 — file upload
  maxFileSize?: number;            // client-side per-file size limit in bytes (default: 50 * 1024 * 1024 = 50 MB)
  // Phase 3 — history
  historyMaxItems?: number;        // ring buffer size for operation history (default: 100, range: 10–500)
  // Phase 3 — APQ
  apqEnabled?: boolean;            // enable Automatic Persisted Queries (default: false)
  apqUnsupportedDetected?: boolean; // true after server-not-supported detection; disables APQ toggle UI
}

// Phase 1 — represents a single editor tab in GraphqlStudioPage
export interface GraphqlOperationTab {
  id: string;
  label: string;              // operation name from AST, or "Untitled" for anonymous operations
  modelUri: string;           // Monaco model URI — unique per tab (e.g. "graphql://operation/{id}")
  operationType?: 'query' | 'mutation' | 'subscription'; // derived from AST; undefined = not yet parsed
  variables: string;          // JSON string for the Variables panel
  headers: GraphqlHeaderRow[]; // per-tab header overrides (in addition to connection-level headers)
  unsavedChanges: boolean;    // true when query/variables/headers changed since last save/load
  connectionId?: string;      // which connection profile this tab is using (undefined = none)
}

export interface GraphqlHeaderRow {
  id: string;
  key: string;
  value: string;              // {{var}} supported; resolved at runtime
  enabled: boolean;
}

export interface GraphqlAuth {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  token?: string;             // bearer token value
  username?: string;          // basic auth
  password?: string;          // basic auth
  headerName?: string;        // apiKey / custom header name
  headerValue?: string;       // apiKey / custom header value
  oauth2?: {                  // oauth2 client_credentials flow
    tokenUrl: string;
    clientId: string;
    clientSecret: string;     // stored as masked env var reference e.g. {{oauth_secret}}
    scope?: string;
    audience?: string;
  };
}

export interface GraphqlOperation {
  id: string;
  name?: string;
  query: string;
  variables?: string;        // JSON string
  operationType: 'query' | 'mutation' | 'subscription';
}

export interface GraphqlResponse {
  data?: unknown;
  errors?: GraphqlError[];
  extensions?: Record<string, unknown>;
  latencyMs: number;
  httpStatus: number;
  httpHeaders: Record<string, string>;
  timestamp: number;
}

export interface GraphqlError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphqlSchemaInfo {
  sdl: string;
  types: GraphqlTypeNode[];
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  fetchedAt: number;
}

export interface GraphqlTypeNode {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  description?: string;
  fields?: GraphqlFieldNode[];
  enumValues?: string[];
  interfaces?: string[];
  possibleTypes?: string[];
}

export interface GraphqlFieldNode {
  name: string;
  type: string;              // formatted type string e.g. "[User!]!"
  description?: string;
  args?: GraphqlArgNode[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphqlArgNode {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string;
}

export interface GraphqlHistoryItem {
  id: string;
  operation: GraphqlOperation;
  response: GraphqlResponse;
  connectionId: string;
  timestamp: number;           // denormalized from response.timestamp for fast sorting/indexing without deserializing the full response
  latencyMs: number;           // denormalized from response for fast display in history list without parsing response
}

// Phase 1 — named environment containing resolved key-value variable pairs
export interface GraphqlEnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  masked?: boolean;            // true = display as ••••• in the UI (for secrets/tokens)
}

export interface GraphqlEnvironment {
  id: string;
  name: string;                // e.g. "Staging", "Production", "Local Dev"
  variables: GraphqlEnvironmentVariable[];
  isActive: boolean;           // only one environment per workspace can be active at a time
  createdAt: number;
  updatedAt: number;
}

// Phase 2 — individual message received on a live subscription (WS or SSE)
export interface GraphqlSubscriptionMessage {
  id:          string;          // unique within this subscription session (UUID or sequential int as string)
  sessionId:   string;          // ties message to the active subscription session (shared across all messages in one subscribe call)
  index:       number;          // sequential 1-based counter since subscribe() was called
  direction:   'in' | 'out';   // 'in' = server push (`next`); 'out' = client send (e.g. `ping`)
  timestampMs: number;          // absolute Unix ms when this frame was received
  offsetMs:    number;          // ms elapsed since subscribe() was called
  data:        unknown;         // parsed JSON body of the `next` frame payload
  errors?:     GraphqlError[];  // present if the `next` frame contains an `errors` array
  transport:   'graphql-transport-ws' | 'graphql-ws' | 'sse';
}

// Phase 2 — result shape emitted by multipartParser.ts for @defer / @stream responses
export interface IncrementalDeliveryResult {
  type:       'initial' | 'patch';
  patchIndex: number;
  path?:      Array<string | number>;   // undefined for the initial chunk; array path for patches
  data?:      unknown;                  // the patched fragment or list item data
  errors?:    GraphqlError[];           // partial errors for this chunk only
  merged:     unknown;                  // fully merged accumulated result up to this point
  hasNext:    boolean;                  // false when the final chunk has been received
}

export interface GraphqlCollectionFolder {
  id: string;
  name: string;
  parentId?: string;           // undefined = root
  createdAt: number;
}

export interface GraphqlCollectionItem {
  id: string;
  name: string;
  description?: string;        // user-written notes for this operation
  folderId?: string;           // undefined = root collection
  operation: GraphqlOperation;
  connectionId?: string;       // optional — saved connection context
  scripts?: GraphqlScriptConfig;  // per-item pre/post-request scripts (Phase 3)
  isPinned?: boolean;
  tags?: string[];             // user-defined tags for filtering/grouping
  createdAt: number;
  updatedAt: number;
}

export interface GraphqlScriptConfig {
  preRequest?: string;         // JavaScript source for pre-request script (sandboxed)
  postResponse?: string;       // JavaScript source for post-response script (sandboxed)
  timeout?: number;            // max execution time ms (default: 5000)
  enabled?: boolean;           // false = scripts defined but not executed (default: true)
}

export interface RfResponseContext {
  httpStatus:  number;
  httpHeaders: Record<string, string>;
  data:        unknown;
  errors?:     GraphqlError[];
  latencyMs:   number;
}

// The `rf` object injected into pre-request and post-response scripts
export interface RfContext {
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  response?: RfResponseContext;  // undefined in pre-request; populated in post-response
  assert(condition: boolean, message?: string): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  // Operation metadata (read-only, populated before script runs)
  operation: {
    name: string | undefined;        // current operation name (undefined for anonymous operations)
    type: 'query' | 'mutation' | 'subscription';
    variables: Record<string, unknown>;  // parsed variables object (read-only snapshot)
  };
}

export interface GraphqlCodeGenOptions {
  target: 'typescript-graphql-request' | 'typescript-urql' | 'typescript-apollo' |
          'typescript-fetch' | 'python-gql' | 'curl' | 'httpie';
  includeTypes: boolean;          // prepend TypeScript interface definitions
  useEnvVarsForHeaders: boolean;  // replace {{var}} with process.env / os.environ / $VAR
  includeErrorHandling: boolean;  // wrap client call in try/catch (TS) or try/except (Python);
                                  // adds GraphQL errors check (if result.errors throw/raise)
}

export interface GraphqlSchemaSnapshot {
  id: string;
  connectionId: string;
  sdl: string;
  typesCount: number;
  capturedAt: number;
  label?: string;              // user-assigned label e.g. "v2.3 — before migration"
}

export interface GraphqlSchemaDiffChange {
  criticality: 'BREAKING' | 'DANGEROUS' | 'SAFE';
  path: string;                // e.g. "Query.user" or "Order.items[first: Int]"
  description: string;         // human-readable change description
  oldValue?: string;
  newValue?: string;
}

export interface GraphqlSchemaDiffResult {
  changes: GraphqlSchemaDiffChange[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
}

export type MockResolver =
  | { type: 'random' }
  | { type: 'fixed';  value: unknown }
  | { type: 'script'; code: string };  // JS arrow function body: "() => new Date().toISOString()"

export interface GraphqlMockConfig {
  connectionId: string;
  enabled: boolean;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver
  globalLatencyMs: number;    // added to every mock response (0 = no delay)
  seed?: number;              // random seed for deterministic mock data generation
}

export interface GraphqlAPQConfig {
  enabled: boolean;
  hashAlgorithm: 'sha256';    // only SHA-256 is defined in APQ spec v1
}

export interface GraphqlEnvironment {
  id: string;
  name: string;               // e.g. "Production", "Staging", "Local"
  variables: Record<string, string>;  // key → value (values can reference other vars: {{other}})
  isActive: boolean;
}

// ── Phase 4 — Workflow Node Types ─────────────────────────────────────────────
// These types live in src/features/workflow/types/workflow.ts alongside WsConnectNodeData etc.

export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name under which the extracted value is stored in workflow vars
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint; {{var}} supported
  query: string;                 // GraphQL operation text (query or mutation)
  variables: string;             // JSON string; {{var}} interpolated at runtime
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP or WS endpoint; wss:// derived via deriveWsEndpoint() if needed
  subscriptionQuery: string;     // must be a `subscription { }` operation
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on latest message: stop when truthy
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  minTypeCount?: number;          // error if schema type count is below this value
  requiredTypes?: string[];       // error if any of these type names are absent from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'matches_regex';
  expectedValue?: string;        // stringified; omitted for 'exists' / 'not_exists'
  description?: string;          // human-readable label shown in workflow run timeline
}

export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  sourceVariable: string;        // name of the workflow variable to assert on (from a prior node's output)
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' halts the workflow; 'warn' continues with a warning badge
}
```

### 4.4 Tab Registration

```typescript
// In src/app/utils/appTabUtils.ts — add to Tab union and PROTOCOLS_TABS set
type Tab = ... | 'graphql';

// PROTOCOLS_TABS.add('graphql');
```

### 4.5 Workflow Node Registration

```typescript
// New workflow node types
type WorkflowNodeType = ... 
  | 'graphqlQuery' 
  | 'graphqlMutation' 
  | 'graphqlSubscription' 
  | 'graphqlIntrospect' 
  | 'graphqlAssert';
```

### 4.6 UI Layout (Three-Panel Design)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Connection Bar: [URL input] [Auth ▾] [Headers ▾] [▶ Execute] [⟳]  │
├───────────┬─────────────────────────────────┬───────────────────────┤
│           │  Operation Editor (Monaco)      │                       │
│  Schema   │  ┌───────────────────────────┐  │  Response Viewer      │
│  Explorer │  │ query GetUser($id: ID!) { │  │  ┌─────────────────┐  │
│           │  │   user(id: $id) {         │  │  │ { "data": {     │  │
│  [Types]  │  │     name                  │  │  │   "user": {     │  │
│  [Search] │  │     email                 │  │  │     "name": ... │  │
│           │  │   }                       │  │  │   }             │  │
│           │  │ }                         │  │  │ } }             │  │
│           │  └───────────────────────────┘  │  └─────────────────┘  │
│           │  ┌─Variables──┬──Headers──────┐  │  [200 OK] [145ms]    │
│           │  │ {          │ Authorization │  │  [Tracing] [Headers] │
│           │  │   "id": 1  │ Bearer {{t}}  │  │                       │
│           │  │ }          │               │  │                       │
│           │  └────────────┴───────────────┘  │                       │
├───────────┴─────────────────────────────────┴───────────────────────┤
│ Tabs: [Op 1] [Op 2] [Op 3] [+]    | History ▾ | Collections ▾      │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**
- Left sidebar: Schema Explorer (collapsible, like Kafka Topics panel)
- Center: Editor (top) + Variables/Headers tabs (bottom) — resizable split
- Right: Response viewer (collapsible, auto-shows on execute)
- Bottom bar: Operation tabs + History/Collections access
- Follows existing resizable split-panel pattern from SSE Studio

---

## 5. Implementation Phases


> **Phase 1 & Phase 2 task tables**: All tasks complete — 1A (7 tasks), 1B (8 tasks), 1C (6 tasks), 1D (8 tasks), 1E (6 tasks), 2A (9 tasks), 2B (4 tasks), 2C (5 tasks), 2D (5 tasks), 2E (5 tasks), 2F (11 tasks, 6 MVP + 5 deferred), 2G (5 tasks, 2 done + 3 deferred). Per-task details in git history.

### Phase 3 — Collections + Code Gen
**Estimated scope**: ~26 files, ~5500 LOC (revised down: 3C code generation removed entirely −12 tasks/~1200 LOC; 3B-9 global scripts deferred −~200 LOC; 3A-17 Postman import deferred −~200 LOC; 3B-12 rf.expect deferred −~100 LOC; `fflate` dependency removed)

**New client dependencies**: `@graphql-inspector/core` (lazy-imported, schema diff only)  
**New server dependencies**: none beyond Phase 1–2 (`vm` is a Node.js built-in; used for mock script runner)

> `fflate` removed — was only needed for the code gen batch zip download (3C-10), which is cut.

> **Phase 3 Pre-Implementation Reviews (6 passes, 2026-06-18)** — Condensed; all issues resolved and incorporated into the task tables below. Verbose pass-by-pass details in git history.
> - Pass 1: 27 competitive gaps vs. Altair/Bruno/Insomnia/Hoppscotch/Apollo/Postman → tasks marked **[R3-new]**
> - Pass 2: 14 correctness issues, 9 new tasks
> - Pass 3: 7 critical bugs (randomUUID ids, compound IDB index, DEPRECATED detection algorithm, rf.test() async, rf.store stub)
> - Pass 4: 11 architecture gaps (UI layout spec, lastExecutedAt, structured errors, atomic import, 512KB cap, mock persistence, APQ+batch exclusivity)
> - Pass 5: 8 competitive gaps (inspector v7, Codegen v6, Postman runner gap, Altair script order, Bruno v3, Insomnia AI mocks); scope reduction: 3C removed, 3B-9/3B-12/3A-17 deferred
> - Pass 6: 9 type-layer bugs (T1–T9) + 5 plan annotations (P1–P5) — all resolved
#### 3A — Collections & History

| # | Task | Priority |
|---|------|----------|
| 3A-0 | **Type definitions** — add to `src/features/graphql/types/graphql.ts`: `GraphqlHistoryItem` (id: string [randomUUID], connectionId, timestamp, operation, response: string [JSON, capped at 512KB — see 3A-1], latencyMs, status); `GraphqlCollection` (id, name, variables, preRequestScript, postResponseScript, createdAt); `GraphqlCollectionFolder` (id, collectionId, parentId, name, sortOrder); `GraphqlCollectionItem` (id, collectionId, folderId, name, sortOrder, operation, scripts, isPinned, tags, **`lastExecutedAt?: number`**); `GraphqlScriptConfig` (preRequest, postResponse, timeout); `CollectionRunEvent` (type: 'start'\|'result'\|'error'\|'skip', itemId, latencyMs?, tests?: CollectionRunTestResult[], **`error?: { phase: 'pre-script' \| 'http' \| 'post-script', message: string }`**); `CollectionRunTestResult` (name, passed, error?); `GraphqlStudioActivityTab` type (`'history' \| 'collections' \| 'mock'`) for the inner activity bar. `lastExecutedAt` on `GraphqlCollectionItem` is written by the Collection Runner after each successful execution and by single-item "Run" — it drives the "Recent" pinned section ordering. | P0 |
| 3A-1 | `useGraphqlHistory.ts`: IndexedDB-backed ring buffer (max 100/configurable); FIFO eviction; keyed by `connectionId + timestamp`; load/save/clear/search operations; "recent" in-memory cache (top 5 most recently executed) **[R3-new: recent cache]** | P0 |
| 3A-2 | `GraphqlHistoryPanel.tsx`: full-height sidebar with recency groups (Today/Yesterday/7 days/Older) + "Recent" pinned section at top; operation type badge (Q/M/S), status icon (✓/✗), latency; click → side-panel preview; double-click → load into editor; context menu (Save to Collection, Copy, Copy as cURL, Delete) **[R3-new: side-panel preview replaces tooltip; recent section; Copy as cURL]** | P0 |
| 3A-3 | `useGraphqlCollections.ts`: IndexedDB-persisted collection + folder CRUD (add, update, delete, reorder, move); drag-and-drop reorder within folders; pin/unpin; collection-level `variables` map CRUD **[R3-new: collection variables]** | P1 |
| 3A-4 | `GraphqlCollections.tsx`: folder tree (expand/collapse, inline rename, right-click context menu including Fork Collection); item list (run/duplicate/delete); global search bar; "Save current operation" shortcut from response panel; schema-validation status badge (⚠ on invalid items) **[R3-new: Fork; schema badge]** | P1 |
| 3A-5 | Export/import collections: serialize to `_exportMeta v1.1` + `collections[]` JSON (including `variables` + collection-level scripts); import via file picker; merge vs replace mode; backward-compatible import of v1.0 (no variables/scripts) **[R3-new: v1.1 format; collection scripts in export]** | P1 |
| 3A-6 | History entry "Save to Collection" flow: prompt for collection + folder + name; pre-fills name from operation name | P1 |
| 3A-7 | History max-items configuration UI: "History" tab in connection settings popover; numeric input (10–500); "Clear all history" button with confirmation; connection-level setting stored on `GraphqlConnection.historyMaxItems`; global default in app settings | P2 |
| 3A-8 | **[R3-new]** `useGraphqlCollectionRunner.ts`: sequential execution of all items in a collection/folder; pause/abort support; emits `CollectionRunEvent` per item (start, result, error, skip); collects `rf.test()` named assertion results per item; in-memory `rf.store` map shared across the run. **Depends on 3B-1 (preRequestScriptRunner) being implemented first**; items without scripts are still executable (skip script phase). Variables read from `GraphqlCollectionItem.operation.variables` must be `JSON.parse()`d with try/catch — parse failure skips the item with an error event. | P1 |
| 3A-9 | **[R3-new]** `GraphqlCollectionRunnerPanel.tsx`: mini results table showing item name, status (✓/✗/skipped), latency, test pass/fail counts; "Run All" button in collection header; aggregate summary row at bottom; abort button; exports run results as JSON | P1 |
| 3A-10 | **[R3-new]** Collection-level variables UI: "Variables" tab on collection root row; key-value table (add/edit/delete); values accessible via `rf.getCollectionVar(key)` in scripts; stored on `GraphqlCollection.variables` in IndexedDB | P2 |
| 3A-11 | **[R3-new]** Schema validation on collection load: `validate(schema, parse(item.query))` for each collection item when schema is available; store validation result; show ⚠ badge on broken items; "Broken operations" filter in collection tree; re-validate on schema refresh | P2 |
| 3A-12 | **[R3-new]** `idbOpen.ts` migration: increment `DB_VERSION` from `5` to **`6`**; add **five** new object stores in the `onupgradeneeded` handler: `graphql-history` (keyPath: `id`, indexes: single `connectionId` + single `timestamp` + **compound `[connectionId, timestamp]`** for efficient per-connection range queries; `id` = `randomUUID()` not a composite key), `graphql-collections` (keyPath: `id`), `graphql-collection-folders` (keyPath: `id`, indexes: single `collectionId`, single `parentId`, compound `[collectionId, sortOrder]` for ordered folder loads), `graphql-schema-snapshots` (keyPath: `id`, indexes: `connectionId`), `graphql-diff-acknowledgements` (keyPath: `id`, indexes: `connectionId`, `snapshotId`) — all without touching existing stores | P0 |
| 3A-13 | **CSS** — `src/styles/graphql-collections.css`: collections sidebar tree (folder indent, chevron, item rows, badge styles, pinned indicator, ⚠ schema-invalid badge); history panel (recency dividers, entry rows, side-panel preview layout, truncation banner); collection runner results table | P1 |
| 3A-14 | **Unit tests** — `useGraphqlHistory.test.ts`: ring buffer FIFO eviction, `randomUUID` id uniqueness, response truncated to 512KB before write, compound IDB index query, per-connection isolation. `useGraphqlCollections.test.ts`: CRUD, `sortOrder` after reorder, import Replace mode uses single transaction (test by mocking IDB and verifying only one transaction is opened), fork, `lastExecutedAt` updated on Run. | P1 |
| 3A-15 | **`GraphqlStudioActivityBar.tsx`**: inner activity strip for the GraphQL Studio page (History, Collections, Mock tabs); icon-only at narrow widths; Mock tab disabled + tooltip when `!isTauri()`; persists active tab to `localStorage`; connected to `GraphqlHistoryPanel`, `GraphqlCollections`, `GraphqlMockPanel` via shared state | P1 |
| 3A-16 | **Variables JSON validation at save time**: when saving a `GraphqlCollectionItem`, validate `operation.variables` is either empty string or valid JSON (`JSON.parse(variables)`); show inline red error "Variables must be valid JSON" on the Variables input; block save until fixed. Do NOT silently accept malformed JSON — it is more useful to surface the error at edit time than at execution time. | P1 |
| 3A-17 | ~~**Postman Collection v2.1 import**~~ — **Deferred**. Useful migration aid, but lower priority now that code gen (the other Postman-migration feature) is cut. The core export/import format (3A-5) covers the RedfireForge-to-RedfireForge workflow. Reopen in a future sprint if migration demand is confirmed. | ~~P2~~ **Deferred** |

#### 3B — Pre-Request / Post-Response Scripts

| # | Task | Priority |
|---|------|----------|
| 3B-1 | `preRequestScriptRunner.ts`: `new Function`-based sandbox with scope shadowing including `Function` + `constructor` to block prototype-chain escape; async support; configurable timeout (default **10s** — increased from 5s) via `Promise.race`; `rf.abort()` throws a typed `ScriptAbortError`; `rf.test()` supports async fn (`fn: () => void \| Promise<void>`) **[R3-new: constructor/Function shadow; 10s default; rf.abort typed]** | **P1** |
| 3B-2 | Script editor UI: Monaco in JavaScript mode (120px resizable) inside collection item detail panel; custom `rf.*` completions via `registerCompletionItemProvider`; "Test Script" dry-run button | P2 |
| 3B-3 | Script console panel: capture and display `rf.log()` / `rf.warn()` / `rf.error()` output + `rf.test()` named assertion results (green pass / red fail) + timeout errors; color-coded; clear button **[R3-new: rf.test() results in console]** | P2 |
| 3B-4 | Script template library: 7 built-in templates (OAuth2 refresh, JWT decode, inject tenant, named test assertion, extract & chain ID, chain with store, skip if env missing); insertable via dropdown in editor toolbar **[R3-new: 2 new templates]** | P2 |
| 3B-5 | `GraphqlScriptConfig` per collection item: store `preRequest`, `postResponse`, `timeout` on `GraphqlCollectionItem`; badge indicator `[Script]` on item rows that have a script set | P2 |
| 3B-6 | Script error propagation: `rf.abort(msg)` blocks request (pre-request); post-response script failure shows amber `⚠` indicator (non-blocking); `rf.skip()` in collection runner marks item as skipped **[R3-new: rf.abort/rf.skip replace rf.assert as primary mechanisms]** | P2 |
| 3B-7 | `RfContext` + `RfResponseContext` type definitions in `src/features/graphql/types/graphql.ts`: full interface including `rf.test()` with async fn support, `rf.abort()` (return type `never`), `rf.skip()` (return type `never`), `rf.getCollectionVar()`, `rf.setCollectionVar()`, `rf.store`; `ScriptAbortError` and `ScriptSkipError` typed classes; post-response non-blocking error handling; fresh RfContext per execution guarantee **[R3-new: extended interface; typed error classes]** | **P1** |
| 3B-8 | **[R3-new]** Collection-level script editor: "Collection Scripts" tab on collection root row; Pre-Request + Post-Response sub-tabs; stored on `GraphqlCollection.preRequestScript` / `.postResponseScript`; executed before/after every item in the collection | P2 |
| 3B-9 | ~~**Global script editor**~~ — **Deferred**. A global pre/post script that fires for every request in every collection is Postman-territory thinking. In a performance workbench, scripts belong to the test run (collection), not globally. Reopen if use-case demand emerges post-launch. | ~~P2~~ **Deferred** |
| 3B-10 | **[R3-new]** Execution order documentation: render "Script execution order" diagram in the script editor panel header (Collection pre → Item pre → HTTP → Item post → Collection post); collapsible. **Note**: Global level removed from diagram — 3B-9 is deferred. | P2 |
| 3B-11 | **Unit tests** — `preRequestScriptRunner.test.ts`: sandbox isolation (cannot access `window`, `process`), prototype-chain escape attempt returns `undefined`, timeout fires after configured ms, `rf.abort()` throws `ScriptAbortError` and blocks request, `rf.skip()` throws `ScriptSkipError`, `rf.test()` with async fn — all tests collected after script body and resolved via `Promise.allSettled`, `rf.store` is no-op stub in non-runner execution (get returns `undefined`, set is silent), collection-level script runs before item-level in execution order test. Target >90% coverage on `preRequestScriptRunner.ts`. | **P1** |
| 3B-12 | ~~**`rf.expect()` Chai-style BDD assertions**~~ — **Deferred**. Added in R5 to ease Postman migration, but with 3C (code gen) removed and RedfireForge being a testing tool rather than a migration target for Postman power users, `rf.assert(condition, msg)` is sufficient for the current use case. Reopen if users explicitly request Chai-compatible syntax. | ~~P2~~ **Deferred** |

#### 3C — ~~Code Generation~~ (Removed — out of scope)

> All 3C tasks removed. See §3.3 rationale. "Copy as cURL" is the only testing-relevant snippet and is already covered by 3A-2 and 3A-4 context menus.

#### 3D — Schema Diff & Validation

| # | Task | Priority |
|---|------|----------|
| 3D-1 | `schemaSnapshot.ts`: capture `GraphqlSchemaSnapshot` (id, connectionId, sdl, timestamp, label, typeCount); store in IndexedDB `graphql-schema-snapshots` (max 20/connection, FIFO); load/save/delete/list. Warn if SDL > 500KB. | P2 |
| 3D-1b | `schemaDiffAck.ts`: CRUD for `graphql-diff-acknowledgements` IDB store — `addAck(connectionId, snapshotId, changePath, note)`, `getAcks(connectionId, snapshotId)`, `deleteAck(id)`. Separated from `schemaSnapshot.ts` because snapshots are write-once but acknowledgements are mutable. **[R3-new: dedicated store for ack]** | P2 |
| 3D-2 | "Save snapshot" button in Schema Explorer toolbar; "Changelog" tab showing snapshot list (timestamp, label, type count, diff button, comparison target dropdown) | P2 |
| 3D-3 | `schemaDiff.ts`: **lazy dynamic import** of `@graphql-inspector/core`; `BREAKING` / `DANGEROUS` / `SAFE` classification from native `CriticalityLevel`; **custom `DEPRECATED` post-processing** (native inspector has no DEPRECATED level — scan changes where description includes "deprecated" OR field-by-field `@deprecated` directive diff using `buildSchema()` traversal); `acknowledged` and `acknowledgeNote` fields merged from `schemaDiffAck.ts` into each change before returning result **[R3-new: lazy import; custom DEPRECATED detection; ack merge]** | P2 |
| 3D-4 | `GraphqlSchemaDiff.tsx`: side-by-side SDL diff (Monaco diff editor); change list with severity badges + "Acknowledge" button per BREAKING row; summary counts (4 categories); severity filter; Export JSON + Export HTML + Download SDL buttons **[R3-new: Acknowledge; DEPRECATED filter; HTML export]** | P2 |
| 3D-5 | Automatic diff toast on schema hash change; "Schema changed — view diff?" link | P2 |
| 3D-6 | **[R3-new]** Collection operation re-validation on schema change: `validate(newSchema, parse(item.query))` for each collection item; broken items listed in diff view "⚠ N operations broken" banner; broken items marked in collection tree | P2 |
| 3D-7 | **[R3-new]** `@deprecated` field usage tracker: scan all collection items' ASTs for deprecated fields; show "Deprecated field usage" section in Schema Explorer; list which items use each deprecated field; click to open item with deprecated field highlighted. **Re-scan triggers**: (a) when schema introspection completes (new schema available), (b) when schema diff detects a change, (c) when a collection item is saved or updated. | P2 |
| 3D-9 | **[R3-new]** HTML report generation for diff: self-contained HTML file (inline CSS + JS); severity-colored rows; summary stats; acknowledgement notes included; downloadable via `Blob` + `<a download>` | P3 |
| 3D-10 | **Unit tests** — `schemaDiff.test.ts`: BREAKING classification (field removed), DANGEROUS (default value changed), SAFE (field added), custom `DEPRECATED` detection (field gains `@deprecated` between old and new SDL → correctly emitted; field that was already `@deprecated` in old SDL → NOT re-emitted), lazy import called only on first use (mock the dynamic import, verify it is NOT called at module load time), acknowledged changes merged correctly from `schemaDiffAck.ts`. | **P1** |

#### 3E — Mock Server

| # | Task | Priority |
|---|------|----------|
| 3E-1 | `src-server/routes/graphql/mock.ts`: `POST /api/graphql/mock`; `POST /api/graphql/mock/config` (SDL + resolvers + latency + jitter + scenarios + scalarFactories); `GET /api/graphql/mock/status`; `GET /api/graphql/mock/log` **[R3-new: jitter, scenarios, scalarFactories, log route]** | P2 |
| 3E-2 | Server-side mock execution: `@graphql-tools/mock` `addMocksToSchema()`; resolver map from `GraphqlMockConfig`; global latency + jitter; request log ring buffer (max 200); Error resolver mode **[R3-new: jitter, log, Error mode]** | P2 |
| 3E-3 | `useGraphqlMockServer.ts`: hook managing enable/disable, resolvers, latency, jitter, seed, scenarios; immediate sync on scenario switch; debounced 300ms on resolver/latency changes **[R3-new: scenarios; jitter; immediate scenario sync]** | P2 |
| 3E-4 | `GraphqlMockPanel.tsx`: toggle + `!isTauri()` guard (show "Desktop app required" when running in web mode); type tree with resolver dropdown (Random/Fixed/Script/Error); latency slider; jitter input; seed; scenario switcher; scalar factories tab; request log tab; export/import config buttons **[R3-new: isTauri guard; Error mode; jitter; scenarios; scalar factories; log tab; export/import]** | P2 |
| 3E-5 | Fixed resolver UI: inline JSON value input per field with type validation | P2 |
| 3E-6 | Script resolver UI: mini Monaco editor (1–3 lines); **reuses `preRequestScriptRunner.ts` sandbox** — same security model and timeout as 3B scripts **[R3-new: reuses preRequestScriptRunner]** | P2 |
| 3E-7 | Mock schema source UI: "Use introspected schema" / "Custom SDL" radio; Monaco SDL editor for custom SDL; disable mock toggle when neither source available; sync triggers as specified | P1 |
| 3E-8 | **[R3-new]** Custom scalar factories: `MockScalarFactory[]` on `GraphqlMockConfig`; preset options (email, date-iso, uuid, url, phone, name, sentence) using lightweight built-in generators (no faker.js); script mode for custom expressions; UI in "Scalar Factories" tab of mock panel | P2 |
| 3E-9 | **[R3-new]** Scenario/fixture mode: `MockScenario[]` on `GraphqlMockConfig`; scenario = named set of resolver overrides; UI: "Scenarios" tab with activate button, add/edit/delete; switching scenario replaces active resolvers and immediately re-syncs to server | P2 |
| 3E-10 | **[R3-new]** Request log UI: "Request Log" tab in mock panel; last 50 entries; columns: timestamp, operation name, latency, active scenario; click to expand full query + response JSON; auto-refresh every 2s when mock is active | P2 |
| 3E-11 | **[R3-new]** Export/import mock config: download current resolver overrides + scenarios + scalar factories as JSON; import from JSON file to restore | P2 |
| 3E-12 | **[R3-new]** `src-server/utils/mockScriptRunner.ts`: Node.js-side sandbox for mock "Script" resolvers using `vm.runInNewContext(script, { field, typeName, args, log }, { timeout: 10000 })`; distinct from the browser-side `preRequestScriptRunner.ts` which cannot run in Node.js. Injected context is narrower than `RfContext` (no `rf.fetch`, no `rf.setEnv`, no `rf.response`) — mock resolvers only need to return a value or throw. `vm` is a Node.js built-in; no new npm dependency needed. | P2 |
| 3E-13 | **[R3-new]** `buildMockMap(resolvers: MockResolverOverride[], scalars: MockScalarFactory[]): IMocks` utility in `src-server/utils/buildMockMap.ts`: maps our resolver config to the `@graphql-tools/mock` `IMocks` format; handles Random (omit = default), Fixed (return scalar), Script (call `mockScriptRunner`), Error (return `new Error(msg)`) resolver modes; applies scalar factories for custom scalar types | P2 |
| 3E-14 | **Unit tests** — `buildMockMap.test.ts`: Random mode omits field (default mock handles it), Fixed mode returns configured value, Error mode returns `Error` instance, Script mode calls `mockScriptRunner` and returns result, scalar factory preset `email` returns string matching email pattern. `mockScriptRunner.test.ts`: sandbox blocks `require`, timeout fires after 10s, returned value is passed back correctly, thrown error propagates. | P2 |

#### 3F — Advanced Query Features

| # | Task | Priority |
|---|------|----------|
| 3F-1 | `apqClient.ts`: SHA-256 hash via `crypto.subtle`; query normalization via `parse`+`print`; **in-memory FIFO hash cache** (max 500 entries); two-step APQ POST flow; GET support for queries when "Use GET" is enabled. **Also update `src-server/routes/graphql/query.ts`** to accept `GET /api/graphql/query?query=...&extensions=...` in addition to POST — required for APQ GET mode. **[R3-new: hash cache with eviction; GET support; proxy GET route]** | P2 |
| 3F-2 | APQ UI: toggle in connection settings; "Use GET for queries" sub-option **[R3-new]**; request metadata shows hash with cache-miss/cache-hit indicator | P2 |
| 3F-3 | Query batching: "Batch" checkbox per tab; `Send Batch (N)` button; `POST /api/graphql/batch` proxy route; result cards in request-index order **[R3-new: order guarantee]**; batch timeout per connection (default 30s). **Server compat detection** uses try-and-cache-failure (no probing pre-flight): try real batch first; if server returns 400/405/non-array → fall back to sequential, cache `batchSupported: false` for `connectionId` in `localStorage`, show toast; add "Reset batch detection" option in connection settings **[R3-new: timeout; try-and-cache detection]** | P2 |
| 3F-4 | Batch result UI: N stacked response cards ordered by request index; "Batch of N" header; `Batch: N passed / M failed` summary row; individual error cards | P2 |
| 3F-5 | Request deduplication in `useGraphqlExecution.ts`: in-flight `Map<hash, { controller, promise }>` (storing Promise enables Wait-and-merge); hash key = **synchronous djb2 hash** of `connectionId + print(parse(query)) + JSON.stringify(sortedVars)` — **`connectionId` MUST be included** in the hash key, otherwise identical queries sent to different GraphQL endpoints (two connections side by side) would incorrectly share the same in-flight request; fast synchronous hash (NOT `crypto.subtle` SHA-256 which is async) because dedup key generation is on the hot path; duplicate detection shows amber badge with three-choice dropdown; within-tab scope only (cross-tab explicitly not implemented). On rejection: the shared Promise rejects and all waiters receive the same rejection — each caller wraps `await promise` in its own try/catch so one waiter's error handling doesn't affect others. **[R3-new: connectionId in key; rejection propagation; Promise stored; scope documented]** | P2 |
| 3F-6 | Deduplication "Wait and merge": return existing `Promise<GraphqlResponse>`; AbortController isolation — aborting a waiting caller does NOT abort the shared request **[R3-new: isolation clarified]** | P2 |
| 3F-7 | APQ non-supported server detection: fallback to full query; `[APQ unsupported]` badge; auto-disable with toast; cache detection in `localStorage`; batch server compatibility auto-detection on first batch attempt **[R3-new: batch detection added to this task]** | P2 |
| 3F-8 | **[R3-new]** Complexity gate: "Block threshold" input in connection settings → "Performance" tab; when complexity > block threshold AND feature enabled → modal ("Query complexity N exceeds limit M — Send anyway / Cancel") with field-breakdown table and "Remember for this session" checkbox; distinct from the existing complexity display badge | P2 |
| 3F-9 | **Unit tests** — `apqClient.test.ts`: test hash caching (cache hit skips re-hash), FIFO eviction at 500 entries, GET vs POST method selection by operation type, PERSISTED_QUERY_NOT_FOUND retry flow, non-APQ server fallback. `dedupExecution.test.ts`: test djb2 hash consistency, Wait-and-merge returns same promise, aborting a waiting caller does not abort the original controller, within-tab isolation. | **P1** |

### Phase 4 — Workflow Integration + Lessons
**Estimated scope**: ~22 files, ~3800 LOC

**New client dependencies**: none (reuses `graphql-ws`, `graphql-sse`, `graphql` from Phases 1–2)  
**New server dependencies**: none (reuses `/api/graphql/query`, `/api/graphql/introspect`, `/api/graphql/subscribe` proxy routes from Phases 1–2)

#### 4A — Node Type Definitions

| # | Task | Priority |
|---|------|----------|
| 4A-1 | Add `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert` to `WorkflowNodeType` union in `workflow.ts` | P0 |
| 4A-2 | Define shared helper types in `workflow.ts`: `GraphqlNodeHeaderRow`, `GraphqlExtractionRule`, `GraphqlOutputBinding`, `GraphqlSubscriptionOutputBinding`, `GraphqlIntrospectOutputBinding`, `GraphqlWorkflowAssertion`, `GraphqlAssertNodeData` | P0 |
| 4A-3 | Define `GraphqlQueryNodeData` interface (used for both `graphqlQuery` + `graphqlMutation`): endpoint, query, variables, headers, auth, skipTlsVerify, timeoutMs, extractionRules, outputBindings | P0 |
| 4A-4 | Define `GraphqlSubscriptionNodeData` interface: endpoint, subscriptionQuery, variables, headers, auth, subscriptionTransport, stopAfterMessages, stopAfterMs, stopCondition, extractionRules, outputBindings | P0 |
| 4A-5 | Define `GraphqlIntrospectNodeData` interface: endpoint, headers, auth, skipTlsVerify, minTypeCount, requiredTypes, requiredFields, outputBindings | P1 |
| 4A-6 | Define `GraphqlAssertNodeData` interface: sourceVariable, assertions (`GraphqlWorkflowAssertion[]`), failBehavior | P1 |
| 4A-7 | Append all five new node types to `WorkflowNodeData` union type in `workflow.ts` | P0 |

#### 4B — Graph Runner Execution Logic

| # | Task | Priority |
|---|------|----------|
| 4B-1 | Implement `graphqlQuery` + `graphqlMutation` branch in `graphRunner.ts`: resolve `{{var}}` in endpoint/variables/headers, POST to `/api/graphql/query`, apply extraction rules via `jsonpath-plus`, bind outputs; surface GraphQL `errors` array as node error | P0 |
| 4B-2 | Implement `buildGraphqlHeaders(rows, auth, env)` shared helper in `graphRunner.ts` — merges enabled header rows with resolved `{{var}}` values + auth headers from `buildAuthHeaders()` | P0 |
| 4B-3 | Implement `graphqlSubscription` branch: derive WS endpoint via `deriveWsEndpoint()`, create `graphql-ws` (or SSE) client, subscribe, collect messages until first stop condition (count / ms / JSONPath condition) is met; expose `messages[]`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` via output bindings | P1 |
| 4B-4 | Implement `graphqlIntrospect` branch: POST introspection to `/api/graphql/introspect`; use `buildClientSchema` + `printSchema` from `graphql` package; validate `minTypeCount`, `requiredTypes`, `requiredFields`; SHA-256 hash SDL; bind `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` outputs | P1 |
| 4B-5 | Implement `graphqlAssert` branch: resolve `sourceVariable` from workflow vars; apply each `GraphqlWorkflowAssertion` using `jsonpath-plus` + `evaluateAssertionOp`; collect failures; halt or warn based on `failBehavior`; log failure details to run trace | P1 |
| 4B-6 | Implement `applyGraphqlOutputBindings(bindings, values, vars)` helper — mirrors existing `applyOutputBindings` pattern but for GraphQL field names | P0 |
| 4B-7 | Unit tests for all five execution branches: `graphRunner.graphqlQuery.test.ts`, `graphRunner.graphqlSubscription.test.ts`, `graphRunner.graphqlAssert.test.ts` — mock `httpFetch`, `graphql-ws` client, `buildClientSchema` | P1 |

#### 4C — Node Configuration Panel UI

| # | Task | Priority |
|---|------|----------|
| 4C-1 | `GraphqlQueryConfigPanel.tsx` — 6-tab panel (Operation, Variables, Headers, Auth, Extraction, Output); Monaco GraphQL editor in Operation tab with height 200px; "Import from Collections" button opens collection picker modal | P0 |
| 4C-2 | Mutation node uses `GraphqlQueryConfigPanel.tsx` with `nodeType="graphqlMutation"` prop — no separate file created; the `nodeType` prop changes the default query template to `mutation { }` and the amber color accent. This is NOT a new file — update the existing `GraphqlQueryConfigPanel.tsx` to accept and handle `nodeType`. | P0 |
| 4C-3 | `GraphqlSubscriptionConfigPanel.tsx` — 5-tab panel (Subscription, Stop Conditions, Headers & Auth, Extraction, Output); Stop Conditions tab: radio (N messages / N seconds / JSONPath condition); transport dropdown | P1 |
| 4C-4 | `GraphqlIntrospectConfigPanel.tsx` — 3-tab panel (Endpoint, Schema Validation, Output); Schema Validation tab: min type count input, required types tag input, required fields `TypeName.fieldName` chips | P1 |
| 4C-5 | `GraphqlAssertConfigPanel.tsx` — 3-tab panel (Source, Assertions, Behavior); Source tab: variable picker dropdown populated from upstream node output bindings via `workflowVariableHints`; Assertions tab: editable table with JSONPath + operator + expected + description + "Run test" button | P1 |
| 4C-6 | Add all five config panel components to the workflow designer's node properties panel switch statement | P0 |
| 4C-7 | Add `data-testid` attributes to all interactive elements in config panels (using `GQL.*` constants from `selectors.ts`) | P1 |

#### 4D — Output Bindings and Variable Chain

| # | Task | Priority |
|---|------|----------|
| 4D-1 | Add `graphqlQuery`/`graphqlMutation` branch to `workflowVariableHints.ts`: expose `data`, `errors`, `latencyMs`, `httpStatus` + named extraction rule variables; source category `'GraphQL Steps'` | P0 |
| 4D-2 | Add `graphqlSubscription` branch to `workflowVariableHints.ts`: expose `messages`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` | P1 |
| 4D-3 | Add `graphqlIntrospect` branch to `workflowVariableHints.ts`: expose `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` | P1 |
| 4D-4 | Add `graphqlAssert` node to `countWorkflowDesignerVariables.ts` (count extraction rules toward variable total) | P1 |
| 4D-5 | Add factory cases for all 5 node types in `workflowNodeFactory.ts`: `nodeTypes` map + `createWorkflowNode` switch; default `GraphqlQueryNodeData` with `query: 'query {
  
}'`, empty arrays; `GraphqlSubscriptionNodeData` default with `stopAfterMessages: 10`; assign distinct canvas colors (purple for query, amber for mutation, teal for subscription, blue for introspect, green for assert) | P0 |
| 4D-6 | Canvas node card renderer: Q/M/S/I/A badge icons for each graphql node type; show endpoint host (truncated); show last-run status badge and latency | P1 |

#### 4E — Demo Lessons

| # | Task | Priority |
|---|------|----------|
| 4E-1 | Create `src/features/demo-player/lessons/protocols/graphql-lessons.ts` — lesson registry file with all 12 lesson definitions | P1 |
| 4E-2 | Register `graphql` category in `protocolsDomain` lesson catalog (alongside `websocket`, `sse`) | P1 |
| 4E-3 | Lesson 1 "Your First GraphQL Query" (7 steps): endpoint input → introspect → observe schema → write query → execute → read response → save to history | P1 |
| 4E-4 | Lesson 2 "Variables & Arguments" (8 steps): write parameterized query → open Variables panel → fill `$id` var → execute with value A → re-run with value B → compare results | P1 |
| 4E-5 | Lesson 3 "Mutations" (9 steps): write `mutation` → input type fields → execute create → observe response → execute update → execute delete → show idempotency | P1 |
| 4E-6 | Lesson 4 "Schema Exploration" (7 steps): open Schema Explorer → browse types → search for field → read documentation → click-to-insert → SDL view → export SDL | P1 |
| 4E-7 | Lesson 5 "Subscriptions" (10 steps): write subscription → click Subscribe → observe live messages → pause → use filter → resume → view assertion panel → disconnect | P1 |
| 4E-8 | Lessons 6–9 (Auth, Query Builder, Collections, Code Gen) — 4 lesson files, 6–9 steps each | P2 |
| 4E-9 | Lessons 10–12 (Performance Tracing, Workflow Integration, Schema Diff) — 3 lesson files, 7–8 steps each | P2 |
| 4E-10 | Add `GQL.*` selector constants to `src/shared/selectors.ts` — full namespace covering all lesson-interactive elements | P1 |
| 4E-11 | Unit tests for all 12 lesson files (`graphql-lessons.test.ts`): step count, IDs, `estimatedMinutes`, `preAction` guards for stateful steps | P1 |

#### 4F — Gallery Templates and E2E

| # | Task | Priority |
|---|------|----------|
| 4F-1 | Gallery template `graphql-health-check`: Start → graphqlIntrospect → graphqlQuery → graphqlAssert (latency < 500ms) → End; registered in `emptyCanvasTemplates.ts` | P2 |
| 4F-2 | Gallery template `graphql-e-commerce-flow`: Start → graphqlMutation (create order) → graphqlSubscription (collect until `COMPLETE`) → graphqlAssert → End | P2 |
| 4F-3 | Gallery template `graphql-schema-watchdog`: Schedule → graphqlIntrospect → condition (hash changed?) → logDebug → End | P2 |
| 4F-4 | Gallery template `graphql-user-crud`: Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | P2 |
| 4F-5 | E2E test `e2e/graphql-query-execution.spec.ts`: query executes against local Docker test server; variables interpolated; response rendered; GraphQL errors surface correctly | P1 |
| 4F-6 | E2E test `e2e/graphql-workflow-nodes.spec.ts`: health-check workflow runs end-to-end; `graphqlAssert` fails correctly when latency threshold exceeded; all variable bindings resolved | P1 |
| 4F-7 | E2E test `e2e/graphql-lessons.spec.ts`: first 3 lessons complete auto-play without errors (smoke test) | P2 |
| 4F-8 | Test scenario file `docs/plan/graphql-workflow-nodes-test-scenarios.md`: manual test scenarios for all 5 node types with exact click-by-click steps and expected results | P1 |
| 4F-9 | E2E test `e2e/graphql-schema-diff.spec.ts`: save snapshot, re-introspect with modified schema, diff toast shown, BREAKING badge count correct, "Export diff JSON" downloads | P2 |
| 4F-10 | E2E test `e2e/graphql-mock-server.spec.ts`: mock mode ON, query returns data, fixed resolver returns configured value, latency slider adds delay, mock mode OFF restores real endpoint | P2 |
| 4F-11 | `e2e/docker-compose.yml` + `e2e/global-setup.ts`: Docker Compose definition for `graphql-test-server` (Apollo Server 4 on port 4010 with tracing + APQ); `globalSetup` starts and awaits health check before tests | P1 |

#### 4B / 4C — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4B-8 | Add `JSON.parse` try-catch for variables in `graphqlQuery`, `graphqlMutation`, `graphqlSubscription` branches — return `{ status: 'error', message: '...' }` on parse failure rather than throwing | P0 |
| 4B-9 | Add abort-before-start guard in `graphqlSubscription` branch: check `ctx.abortSignal?.aborted` before creating the WS client; return early if already aborted | P1 |
| 4C-8 | Config panel validation: endpoint non-empty, query non-empty, valid JSON in Variables tab, valid identifiers in extraction/output variable names; tab headers show red dot on validation error | P1 |

#### 4D — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4D-7 | `countWorkflowDesignerVariables.ts`: add cases for all 5 GraphQL node types per the spec (5 standard + `extractionRules.length` for query/mutation; 5 for subscription; 5 for introspect; 0 for assert) | P1 |

---

## 6. Dependencies (npm packages)

### Required (Phase 1)
```json
{
  "graphql": "^16.x",
  "monaco-graphql": "^1.x",
  "graphql-language-service": "^5.x"
}
```
**Note**: `@monaco-editor/react` (v4.7.0) is already installed. `monaco-graphql` adds GraphQL language support to the existing Monaco instance.

### Phase 2
```json
{
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "graphql-sse": "^2.x",
  "meros": "^1.x",
  "extract-files": "^13.x"
}
```
**Notes**:
- `subscriptions-transport-ws` is the deprecated Apollo legacy package needed for backward-compat with Apollo Server ≤v3. It uses the WebSocket subprotocol `graphql-ws` (note the naming swap — the modern `graphql-ws` npm package uses subprotocol `graphql-transport-ws`).
- `graphql-sse` implements the GraphQL over SSE transport spec (by the same author as `graphql-ws`). Required for 2B SSE subscriptions. The server must also use `graphql-sse` server-side.
- `meros` streams and splits `multipart/mixed` HTTP responses — required for `@defer`/`@stream` support (2D).
- `extract-files` extracts `File` / `Blob` objects from GraphQL variables for the file upload multipart spec (2E).

### Phase 3
```json
{
  "@graphql-tools/mock": "^9.x",
  "@graphql-tools/schema": "^10.x",
  "@graphql-tools/utils": "^10.x",
  "@graphql-inspector/core": "^7.x"
}
```
**Notes**:
- `@graphql-tools/mock` generates realistic fake resolvers from a schema — powers the mock server (3E).
- `@graphql-tools/schema` builds executable schemas from SDL + resolvers — required by the mock server.
- `@graphql-tools/utils` provides schema utilities (merging, pruning, filtering) used throughout Phase 3.
- `@graphql-inspector/core` is the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura) — required for schema diff + breaking change detection (3D). **Lazy-imported** at runtime (not in main bundle — ~70KB gzipped). **[R5-1]** Updated to `^7.x` (v7.1.3, Apr 2026). Key v7 change: `INPUT_FIELD_ADDED` with a default value is now classified `Dangerous`.
- `fflate` removed — was only needed for code gen batch zip (3C-10), which is cut (3C entire section removed as out of scope for a performance workbench).

### Server-side (src-server) — all phases
```json
{
  "graphql": "^16.x",
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "ws": "^8.x",
  "busboy": "^1.x"
}
```
**Note**: `ws` is already installed for WebSocket proxy. `busboy` handles multipart file upload parsing. `subscriptions-transport-ws` is needed server-side to proxy legacy Apollo subscription connections to upstream servers.

---

## 7. Registration Checklist

Following the established protocol pattern (WebSocket/Kafka/SSE):

- [ ] `src/features/graphql/` — Feature directory with page + components + hooks
- [ ] `src/shared/types/graphql.ts` — Shared TypeScript types
- [ ] `GraphqlStudioPage.tsx` — Main page component
- [ ] Register tab `'graphql'` in `src/app/utils/appTabUtils.ts`
- [ ] Render in `App.tsx` conditional on tab
- [ ] `src-server/routes/graphql/` — Proxy server routes
- [ ] `src/features/graphql/utils/graphqlClient.ts` — Frontend transport client (HTTP + WebSocket)
- [ ] `src/shared/selectors.ts` — Add `GRAPHQL = { ... }` test selectors
- [ ] Workflow nodes: `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert`
- [ ] Node config components with `InsertVarField` + `variableHints`
- [ ] Demo lessons registered in `src/features/demo-player/lessons/index.ts`
- [ ] Storage persistence via existing localStorage/IndexedDB patterns
- [ ] E2E test selectors + Playwright tests

---

## 8. Competitive Differentiation

What makes RedfireForge's GraphQL Studio unique vs. standalone tools:

| Feature | Postman | Apollo Studio | GraphiQL | Altair | **RedfireForge** |
|---------|---------|--------------|----------|--------|-----------------|
| Integrated test runner | ✅ | ❌ | ❌ | ❌ | ✅ (workflow engine + SLA) |
| Multi-protocol in one app | ✅ | ❌ | ❌ | ❌ | ✅ (WS+Kafka+SSE+GraphQL) |
| Workflow automation | ✅ (Flows) | ❌ | ❌ | ❌ | ✅ (DAG workflows) |
| SLA evaluation on responses | ❌ | ❌ | ❌ | ❌ | ✅ |
| Desktop native | ❌ | ❌ | ❌ | ✅ (Electron 200MB+) | ✅ (Tauri ~15MB) |
| Demo/Training system | ❌ | ❌ | ❌ | ❌ | ✅ (interactive lessons) |
| Schema diff + breaking changes | ✅ (paid) | ✅ (paid) | ❌ | ❌ | ✅ (built-in free) |
| `@defer`/`@stream` support | ❌ | ✅ | Partial | ❌ | ✅ |
| Pre-request scripts | ✅ | ✅ (scripting) | ❌ | ✅ | ✅ |
| File upload (multipart) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Cross-protocol workflows | ❌ | ❌ | ❌ | ❌ | ✅ (GraphQL→Kafka→WS in one flow) |
| Open source | ❌ | ❌ | ✅ | ✅ | ✅ |
| Free (no account required) | ❌ (free tier) | ❌ (account) | ✅ | ✅ | ✅ |

**Unique value proposition**: The only tool that lets you build **cross-protocol automated test workflows** combining GraphQL + WebSocket + Kafka + SSE nodes with SLA evaluation — all in a lightweight native desktop app with interactive training.

---

## 9. Design Decisions

### Editor Choice: Monaco with `monaco-graphql`
- **Why**: Project already uses `@monaco-editor/react` (v4.7.0) — zero new editor dependency
- **`monaco-graphql`** provides: syntax highlighting, autocomplete, validation, hover docs, jump-to-definition
- **Schema binding**: Feed introspected schema into `monaco-graphql` worker for live validation
- **Alternative considered**: CodeMirror 6 + `cm6-graphql` (used by GraphiQL) — rejected because it adds a second editor library to the bundle
- **Multi-model**: Each operation tab gets its own Monaco model (same pattern as multi-file editors)

### Subscription Protocol: `graphql-ws` primary
- **Why**: Modern spec-compliant protocol, maintained by The Guild
- **npm package**: `graphql-ws` (the npm package name) uses the WebSocket subprotocol **`graphql-transport-ws`**
- **Legacy**: `subscriptions-transport-ws` (the npm package) uses the WebSocket subprotocol **`graphql-ws`** — this naming is intentionally confusing; the package and subprotocol names are swapped between the two generations
- **Detection algorithm**: Attempt WebSocket handshake advertising subprotocol `graphql-transport-ws` (modern). If server closes with `4406` (subprotocol not acceptable) or `4400` (bad request), retry advertising subprotocol `graphql-ws` (legacy `subscriptions-transport-ws`). Close code `1000` (normal closure) is ambiguous and must not trigger a retry.
- **SSE fallback**: If server responds to HTTP POST with `Content-Type: text/event-stream`, switch to SSE transport

### Proxy vs Direct
- **Decision**: Always proxy through `src-server` (port 3001) by default
- **Why**: CORS bypass, TLS handling, protocol normalization, file upload relay, Tauri compatibility
- **Direct mode**: Optional toggle for local development when CORS isn't an issue
- **Tauri**: Uses same IPC proxy pattern as WebSocket/Kafka (`invoke('graphql_query', {...})`)

### Incremental Delivery (`@defer`/`@stream`)
- **Decision**: Support from Phase 2
- **Why**: Increasingly adopted (Apollo Router, Yoga, Hive Gateway all support it)
- **Implementation**: Parse `multipart/mixed` response with boundary splitting; progressively merge into response JSON
- **UX**: Show partial response immediately with loading indicators on deferred fields

### State Management
- **Decision**: Custom hook (`useGraphqlState`) with localStorage persistence
- **Why**: Matches existing pattern (`useWebsocketState`, `useKafkaState`)
- **No Redux/Zustand**: Keep consistent with other protocol studios
- **Persistence**: Active operation tabs + environments + recent endpoints saved to localStorage

### File Upload
- **Decision**: Follow `graphql-multipart-request-spec` (used by Apollo, Yoga, Altair)
- **Implementation**: Client constructs FormData with operations + file map; proxy relays to target
- **UX**: Files selected via drag-drop or file picker in Variables panel

---

## 10. Success Criteria

### Phase 1 (MVP)
- [ ] Execute a GraphQL query against any public endpoint (e.g., GitHub API, SpaceX API) — receives `data` in Response panel
- [ ] Execute a mutation — response includes the created/updated resource
- [ ] Introspect schema and browse types/fields/arguments in Schema Explorer
- [ ] Autocomplete in the editor suggests fields, arguments, and types from the introspected schema
- [ ] Inline error diagnostics shown for invalid queries (syntax errors, unknown fields) before execution (client-side `graphql.validate()`)
- [ ] GraphQL errors (`errors[]` in 200 response) highlighted in editor with location markers at the correct line/column
- [ ] Partial response (data + errors simultaneously) shows both in the Response panel
- [ ] HTTP-level errors (401, 403, 5xx, CORS) show the correct error banner from Section 12.1
- [ ] Multi-tab: open 3 separate operations, switch between them without losing content; tab label shows operation name from AST
- [ ] `⌘Enter` (or `Ctrl+Enter`) executes the current operation; Escape cancels it
- [ ] Click-to-insert inserts the field name at the current editor cursor position
- [ ] Schema search finds types and fields by name in <100ms for a 500-type schema
- [ ] Environment variable `{{token}}` set in an environment resolves in the Authorization header; unresolved `{{unknownVar}}` shows `!` warning icon on the header row
- [ ] Connection profile saved, page reloaded — profile loads correctly with endpoint + auth; profile list is sorted by most-recently-used
- [ ] Operations (query text, variables) persist across page reloads
- [ ] Schema polling: schema automatically re-fetched after the configured interval (verify by changing the upstream schema)
- [ ] Invalid JSON in Variables panel: Execute button is disabled and "Invalid JSON" error shown on the Variables panel
- [ ] Auth popover: setting Bearer token → Authorization header appears in outgoing request; switching to API Key type → custom header name/value appear in request
- [ ] Server with introspection disabled: yellow "Introspection disabled" banner shown; editor still usable for manual operations
- [ ] Pre-execution `graphql.validate()`: querying a field that doesn't exist on the schema shows a Monaco squiggle immediately (before execution) with `⚠ 1 error` badge on Execute button

### Phase 2
- [ ] WebSocket subscription (modern `graphql-transport-ws`) connects, receives live `next` messages, and displays them in the subscription log
- [ ] Legacy Apollo subscription server (`graphql-ws` subprotocol) is auto-detected via close code `4406`/`4400` and reconnected successfully with `subscriptions-transport-ws`
- [ ] SSE subscription connects (via `graphql-sse`) and receives data in the same subscription log UI as WS
- [ ] Auto-reconnect triggers on unexpected WebSocket disconnect; exponential backoff countdown visible; recovers within the backoff window (≤30s)
- [ ] Authenticated WebSocket subscription: Bearer token from connection auth flows through `connection_init_payload` (`connectionParams`); subscription data reflects authorized user; `4401` close code → permanent error state (no retry)
- [ ] `subscriptionTransport` manual override: selecting "SSE" in connection settings routes the subscription through the SSE proxy instead of WebSocket; selecting "WebSocket (legacy)" forces `graphql-ws` subprotocol
- [ ] `@defer` / `@stream` partial responses render incrementally — deferred fields show skeleton placeholder then fill in on patch arrival; chunk tracker shows `All N chunks received (Xms total)`
- [ ] Combining `@defer` and file upload in the same operation triggers a pre-execution validation error ("cannot combine")
- [ ] File upload mutation executes end-to-end: file selected in Files tab → multipart POST → proxy relays without buffering → server confirms
- [ ] Upload progress indicator fills correctly as the proxy reports bytes transferred
- [ ] Visual query builder generates syntactically valid GraphQL SDL from point-and-click field selection (verified by `graphql.parse()` without throwing)
- [ ] Union/Interface field in query builder: expanding a Union type shows concrete type groups; selecting a field under a concrete type generates correct `... on TypeName { fieldName }` inline fragment in SDL
- [ ] Two-step schema search finds any field by name across all types and auto-expands the tree to its root path
- [ ] Fragment created in builder is correctly inlined in generated SDL as spread + definition; unused fragments show amber warning
- [ ] Subscription log JSONPath assertion `$.data.order.status == "SHIPPED"` correctly hides messages where status is not "SHIPPED"; pass/fail badges update live per message
- [ ] Apollo Tracing waterfall renders when `extensions.tracing` is present; resolver bars are color-coded by duration; sort-by-duration shows slowest resolver first
- [ ] Query complexity badge appears before execution with correct color; a deeply nested query (depth > `maxDepth`) shows red badge; a query costing > 2× threshold shows a confirmation dialog
- [ ] SSE subscription reconnects after a simulated network drop: `Last-Event-ID` is forwarded; no messages are skipped after reconnect; `reconnecting` state is shown in the status pill
- [ ] File exceeding `maxFileSize` (e.g. 51 MB against a 50 MB limit) is rejected immediately at selection time with an inline error; the Execute button stays disabled until the oversized file is removed
- [ ] Query builder state persists across page reload: complex selection (3+ fields with arguments) is restored in the builder after refresh; generated SDL matches pre-reload state
- [ ] A query containing `@defer` automatically triggers multipart response handling; deferred fields show skeleton then fill in; a query without `@defer` does NOT send `Accept: multipart/mixed`

### Phase 3
- [ ] Operation history auto-saves every execution and displays in recency groups (Today / Yesterday / Last 7 days)
- [ ] History entry loads into the editor with one click; double-click loads and immediately executes
- [ ] Collections are organized in folders with drag-and-drop reorder and persist across reloads
- [ ] "Save to Collection" flow from response panel saves operation with correct folder and name
- [ ] Collections export to JSON file; imported file restores all folders and items correctly
- [ ] Import with "Merge" mode keeps existing collections and inserts new items; import with "Replace" mode deletes existing collections first
- [ ] Pre-request script runs before execution — `rf.setHeader` value appears in the outgoing request
- [ ] `rf.assert(false)` in pre-request script blocks the request and shows error in script console
- [ ] Post-response script failure is non-blocking: response is displayed and an amber `⚠ Post-script error` indicator appears on the item row
- [ ] "Copy as cURL" from history and collection context menus produces a correct `curl` command for the operation
- [ ] Schema snapshot saved and diff computed correctly: `@graphql-inspector/core` reports `BREAKING` for a removed field
- [ ] Snapshot-vs-snapshot comparison: selecting two historical snapshots in the Changelog tab computes and displays their diff correctly
- [ ] Mock server active — simple query returns mock data when pointed at `localhost:3001/api/graphql/mock`; "Use introspected schema" mode loads the active connection's SDL automatically
- [ ] Fixed mock resolver returns the configured value; latency slider adds correct delay
- [ ] APQ enabled — first request is a cache miss; identical second request shows `[Cache hit]` and is hash-only
- [ ] APQ with unsupported server: client falls back to full query, shows `[APQ unsupported]` badge, auto-disables APQ for this connection
- [ ] Batch of 2 operations returns 2 result cards with correct data each; if one fails its card shows an error state while the other shows success
- [ ] Script console shows `rf.test()` pass/fail results in the collection runner panel alongside latency and status

### Phase 4
- [ ] `graphqlQuery` workflow node: executes a query against the proxy, resolves `{{var}}` in endpoint/variables/headers, returns `data` + `latencyMs` in output bindings accessible as `{{nodeLabel.data.fieldName}}` in downstream nodes
- [ ] `graphqlMutation` workflow node: executes a mutation identically to `graphqlQuery`; canvas card shows amber M badge
- [ ] GraphQL errors in query/mutation node: when response contains a `errors[]` array, node enters error state and the run timeline shows the GraphQL error message (not just HTTP error)
- [ ] JSONPath extraction rule in query node: `$.user.id` correctly extracts the nested value and stores it in the named variable; downstream `graphqlQuery` node uses that variable in its variables JSON
- [ ] `graphqlSubscription` workflow node: connects via WebSocket (`graphql-transport-ws`), collects messages until `stopAfterMessages` is reached, exposes `messages[]` and `messageCount` as output bindings
- [ ] `graphqlSubscription` stop condition: `stopCondition` JSONPath expression stops collection when first matching message is received
- [ ] `graphqlIntrospect` workflow node: fetches schema, outputs `typeCount` and `schemaHash`; `requiredTypes` validation fails the node correctly when a specified type is absent; `timeoutMs` is respected (node errors on timeout)
- [ ] `graphqlAssert` workflow node: evaluates JSONPath assertions against an upstream variable; assertion failure with `failBehavior: 'error'` halts the workflow and shows failure detail; `failBehavior: 'warn'` continues with warning badge
- [ ] `graphqlAssert` `gte`/`lte` operators work correctly: `latencyMs gte 0` passes; `latencyMs lt 1` fails when actual latency > 1ms
- [ ] Invalid JSON in `graphqlQuery` variables: node enters error state with "Invalid JSON in variables" message rather than crashing the workflow
- [ ] `graphqlSubscription` already-aborted abort signal: node returns error immediately without opening WebSocket connection
- [ ] "Import from Collections" in `GraphqlQueryConfigPanel`: operation saved in Phase 3 collections can be loaded into a workflow node without re-typing; empty-state is shown when no collections exist
- [ ] `'GraphQL Steps'` variable category appears in the variable picker of downstream nodes, showing `data`, `errors`, `latencyMs` from prior graphql nodes
- [ ] `countWorkflowDesignerVariables` counts GraphQL nodes correctly: query node with 2 extraction rules contributes 7 variables (5 standard + 2 extraction)
- [ ] Health-check gallery template loads from empty canvas gallery; variable wiring is pre-configured (`{{sentinelLatency}}` flows to assert node); runs end-to-end against local Docker test server
- [ ] E-commerce gallery template: mutation extraction rule wires `orderId` to subscription variables; subscription stops on `COMPLETE` condition; assert verifies final status
- [ ] Demo lesson 1 "Your First GraphQL Query" completes in auto-play mode: all 7 steps execute with visible ripple animations and correct narration
- [ ] Demo lessons 1–5 are navigable: Restart → play through each step → preAction guards recover state correctly on forward-skip
- [ ] Demo lessons 6–12 are playable: each lesson's steps are navigable, narration is visible, and key interactions complete without error

### Performance
- [ ] Schema introspection < 2s for schemas with ≤500 types
- [ ] Query execution overhead < 100ms (proxy round-trip only)
- [ ] Monaco editor loads within 500ms (lazy-loaded GraphQL worker)

---

## 11. Public GraphQL APIs for Testing

| API | Endpoint | Auth | Features | Subscriptions |
|-----|----------|------|----------|---------------|
| Countries | `https://countries.trevorblades.com/graphql` | None | Simple schema, continents/countries/languages | ❌ |
| Rick and Morty | `https://rickandmortyapi.com/graphql` | None | Characters/episodes/locations, pagination | ❌ |
| Star Wars (SWAPI) | `https://swapi-graphql.netlify.app/.netlify/functions/index` | None | Classic demo API, films/people/planets | ❌ |
| GitHub GraphQL | `https://api.github.com/graphql` | Bearer token | Rich schema, mutations, real data | ❌ |
| SpaceX (unofficial) | `https://spacex-production.up.railway.app/graphql` | None | Launches/rockets/missions | ❌ |
| GraphQL Pokémon | `https://graphql-pokemon2.vercel.app/` | None | Simple, no auth | ❌ |
| Hasura Cloud (demo) | Varies | None | Real-time subscriptions, CRUD mutations | ✅ |
| GraphQL WS Demo | Self-hosted (Docker) | None | Subscriptions via `graphql-ws` | ✅ |

### 11.1 Local Test Server (Docker)

For development and E2E testing, the project ships a local GraphQL test server defined in `e2e/docker-compose.yml` (detailed fully in Section 3.4 4F). Summary:

```yaml
# e2e/docker-compose.yml  (authoritative — see Section 3.4 4F for full spec)
services:
  graphql-test-server:
    image: node:22-alpine
    ports:
      - "4010:4010"    # http://localhost:4010/graphql + ws://localhost:4010/graphql
    command: npx tsx /app/server.ts
```

The pre-test setup hook (`e2e/global-setup.ts`) starts the server and waits for `GET http://localhost:4010/health → 200` before Playwright begins.

Features of the test server:
- **Queries**: `user(id: ID!): User`
- **Mutations**: `createUser`, `updateUser`, `deleteUser`, `createOrder(input: OrderInput!): Order`
- **Subscriptions**: `orderStatus(orderId: ID!): OrderStatus`
- **File upload**: `uploadAvatar(file: Upload!)`
- **`@defer`/`@stream`**: Supports incremental delivery
- **Apollo Tracing**: Returns resolver timing (`extensions.tracing`) for Lesson 10 E2E
- **APQ**: Enabled (for Phase 3 APQ E2E tests)
- **Latency simulation**: Configurable delays per resolver via query param `?latency=N`

---

## 12. Error Handling UX

GraphQL has two error layers — HTTP-level errors and GraphQL-level errors inside a 200 response — both must be handled visibly.

### 12.1 HTTP-Level Errors

| Scenario | Display |
|----------|---------|
| Network unreachable | Red banner: "Cannot connect to endpoint — check URL and network" |
| 401 Unauthorized | Red banner: "Authentication failed — token missing or expired. Update in connection settings." |
| 403 Forbidden | Red banner: "Access denied — token is valid but lacks required permissions for this operation." |
| 5xx server error | Red banner + raw response body shown in Response panel |
| CORS blocked (direct mode) | Yellow banner: "CORS blocked — switch to Proxy mode or enable CORS on server" |
| TLS/cert error | Red banner with option to "Skip TLS verification" (toggle in connection settings) |

### 12.2 GraphQL-Level Errors (200 with `errors` array)

- **Error icon** in Response panel header (⚠ instead of ✓)
- **Errors tab** appears automatically when `errors` array is non-empty
- **Error location markers** — if `locations` is present, highlight the corresponding line(s) in the Monaco editor using error squiggles
- **Path highlighting** — if `path` is present, show which field in the response tree caused the error
- **`extensions.code` display** — show error codes like `UNAUTHENTICATED`, `NOT_FOUND`, `RATE_LIMITED` prominently
- **Partial data** — still display `data` even alongside errors (GraphQL allows partial success)

### 12.3 Subscription Errors

- **Connection close codes** — display WebSocket close code + reason in the message log (e.g., `4400 Bad Request`)
- **`next` payload errors** — surface `errors` array within subscription messages (same treatment as query errors)
- **Auto-reconnect failed** — show retry count and "Give up" option after 5 failed attempts
- **Protocol mismatch** — if server rejects `graphql-transport-ws`, show a "Try legacy protocol?" prompt

---

## 13. Environment Variable Management

### 13.1 Environment Structure

See `GraphqlEnvironment` in Section 4.3 Shared Types for the full interface definition.

### 13.2 Variable Resolution Order

Variables are resolved in this precedence order (highest wins):

1. **Operation-level variables** (set in Variables panel — raw JSON, not `{{var}}` syntax)
2. **Per-tab overrides** (not persisted — scratch values set in the Environments tab of a session)
3. **Active environment variables** (persisted per named environment)
4. **Global defaults** (e.g. `{{baseUrl}}` from connection profile)

### 13.3 `{{var}}` Interpolation Scope

The `{{var}}` syntax is supported in:
- **Endpoint URL** field (e.g. `{{baseUrl}}/graphql`)
- **Headers** values (e.g. `Authorization: Bearer {{accessToken}}`)
- **Variable values** in the Variables JSON panel (e.g. `"userId": "{{currentUserId}}"`)
- **Pre-request scripts** via `rf.getEnv('varName')`

It is **not** applied to the query/operation text itself — GraphQL variables serve that purpose.

### 13.4 UI: Environment Manager

- Accessible from a dropdown badge in the connection bar (e.g. `[Staging]`)
- Environment editor modal: list of named environments on the left, key-value table on the right
- Masked values: toggle visibility per variable (for secrets like tokens)
- Import/export environments as JSON (compatible with Postman environment format)
- Quick-switch between environments without losing the current operation

---

## 14. Pre-Request Script API Reference

Pre-request scripts run in a sandboxed context before each operation execution. The `rf` (RedfireForge) helper object is the scripting API.

### 14.1 Available API

```typescript
// Environment variable access
rf.getEnv(key: string): string | undefined
rf.setEnv(key: string, value: string): void

// HTTP utilities (for fetching tokens, etc.)
await rf.fetch(url: string, options?: RequestInit): Response

// Logging (visible in the script console below the editor)
rf.log(...args: unknown[]): void
rf.warn(...args: unknown[]): void
rf.error(...args: unknown[]): void

// Assertions (fail fast if preconditions aren't met)
rf.assert(condition: boolean, message?: string): void

// Request mutation (headers only — query is immutable)
rf.setHeader(name: string, value: string): void
rf.removeHeader(name: string): void

// Operation metadata (read-only)
rf.operation.name: string | undefined  // current operation name (undefined for anonymous operations)
rf.operation.type: 'query' | 'mutation' | 'subscription'
rf.operation.variables: object         // parsed variables object (read-only)
```

### 14.2 Common Patterns

```javascript
// Pattern 1: Refresh OAuth token before request
const stored = rf.getEnv('accessToken');
const expiry = parseInt(rf.getEnv('tokenExpiry') || '0');
if (Date.now() > expiry) {
  const resp = await rf.fetch('{{authUrl}}/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: rf.getEnv('clientId') ?? '',
      client_secret: rf.getEnv('clientSecret') ?? '',
    }),
  });
  const data = await resp.json();
  rf.setEnv('accessToken', data.access_token);
  rf.setEnv('tokenExpiry', String(Date.now() + data.expires_in * 1000));
}
rf.setHeader('Authorization', `Bearer ${rf.getEnv('accessToken')}`);

// Pattern 2: Inject per-tenant header
rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'));

// Pattern 3: Assert precondition
rf.assert(!!rf.getEnv('userId'), 'userId environment variable must be set');
```

### 14.3 Post-Response Script API

Post-response scripts run after the response is received:

```typescript
// Response access
rf.response.httpStatus: number
rf.response.data: unknown        // parsed JSON data (from `data` field)
rf.response.errors: GraphqlError[] | undefined
rf.response.latencyMs: number
rf.response.headers: Record<string, string>

// Chaining — extract values into env vars for subsequent operations
// Note: rf.response.data is typed as unknown; cast to access fields safely
rf.setEnv('createdUserId', (rf.response.data as any).createUser.id);

// Assertions
rf.assert(rf.response.errors === undefined, 'Expected no GraphQL errors');
rf.assert(rf.response.latencyMs < 500, 'Response took too long');
```

---

## 15. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ Enter` / `Ctrl Enter` | Execute operation |
| `⌘ K` | Focus schema search (schema explorer) — note: `⌘K` is Monaco's chord prefix; only intercept when editor is **not** focused |
| `⌘ Shift F` | Format / prettify operation |
| `⌘ /` | Toggle line comment |
| `⌘ Shift I` | Trigger schema introspection |
| `⌘ T` | New operation tab — note: conflicts with "new browser tab" in web (non-Tauri) mode; Tauri intercepts it correctly |
| `⌘ W` | Close current tab |
| `⌘ ]` / `⌘ [` | Next / previous tab |
| `⌘ B` | Toggle schema explorer sidebar |
| `F1` | Monaco command palette |
| `⌘ Shift C` | Open code generator |
| `⌘ Shift H` | Open operation history |
| `⌘ L` | Clear response |
| `Escape` | Cancel in-progress execution |
| `⌘ Z` / `⌘ Shift Z` | Undo / redo in editor |

---

## 16. Mockup Reference

The `mockups/` directory contains seven HTML mockups illustrating key screens:

| File | Screen | Phase |
|------|--------|-------|
| `graphql-studio-main.html` | Three-panel main editor view: schema explorer + Monaco editor + response viewer | Phase 1 |
| `graphql-schema-explorer.html` | Full-screen schema browser: type list + field detail table + SDL panel | Phase 1 |
| `graphql-subscription-testing.html` | Subscription editor + live message stream + test assertions + stats | Phase 2 |
| `graphql-test-runner.html` | Test collections sidebar + results table with SLA badges + assertion detail panel | Phase 3 |
| `graphql-workflow-testing.html` | Workflow canvas with GraphQL nodes + properties panel + run timeline | Phase 4 |
| `graphql-query-builder.html` | Visual field selector: schema tree + field checkbox grid + live query preview | Phase 2 |
| `graphql-code-generation.html` | Code generation panel: operation + target language selector + generated output + collections | Phase 3 |

All mockups use the Catppuccin Mocha dark theme (`#1e1e2e` base) consistent with the rest of the app.

---

## 17. Phase Status Tracker

| Phase | Status | Start | Complete |
|-------|--------|-------|----------|
| Phase 1 — MVP | Not Started | — | — |
| Phase 2 — Subscriptions + Builder | Not Started | — | — |
| Phase 3 — Collections + Code Gen | Not Started | — | — |
| Phase 4 — Workflow + Lessons | Not Started | — | — |

---

## 18. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `monaco-graphql` bundle size | Medium | Tree-shake, lazy-load the GraphQL worker only when tab is active |
| Subscription protocol fragmentation | Medium | Auto-detect protocol; provide manual override in connection settings |
| Public test APIs going down | Low | Local Docker test server as primary; public APIs as secondary |
| Schema introspection disabled on production APIs | Medium | Allow manual schema upload (SDL file or paste) as alternative |
| `@defer`/`@stream` not widely adopted yet | Low | Feature is additive; basic query/mutation works without it |
| File upload spec variations across servers | Medium | Stick to standard `graphql-multipart-request-spec`; document known server quirks |
| Monaco editor memory with many tabs | Medium | Dispose unused models; limit to 8 tabs (same as WebSocket Studio) |
| `@defer`/`@stream` spec not finalized (multiple format versions in the wild) | High | Version-aware parser; connection-level format selector; default to latest alpha; document supported versions — see Section 23.2.3 |
| `subscriptions-transport-ws` deprecated and unmaintained (no updates since 2022) | Medium | Implement as P2 legacy compat; consider vendoring minimal client code (~200 lines); document as legacy support — see Section 23.2.1 |
| No `src-server/` proxy routes exist yet for GraphQL subscription/upload | High | Must scaffold proxy server routes before Phase 2 work; this is a prerequisite task not in the original plan — see Section 23.7 |
| Apollo Tracing format (`extensions.tracing`) deprecated by Apollo | Low | Support both legacy and emerging OpenTelemetry formats; tracing waterfall is format-agnostic visualization — see Section 23.2.5 |
| Query builder scope creep (11 tasks with complex P2 items) | High | Ship MVP builder (6 tasks) first; defer fragments/directives/unions to post-2.1 iteration — see Section 23.6 |

---

## 19. Testing Strategy

### Unit Tests
- `schemaParser.test.ts` — introspection result → navigable type tree
- `queryBuilder.test.ts` — field selection → valid SDL output
- `multipartParser.test.ts` — chunked response → merged JSON
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation, env mutation, abort on rf.assert failure
- `graphqlClient.test.ts` — HTTP transport, WS transport, protocol detection, auth header injection
- `useGraphqlExecution.test.ts` — hook behavior for query/mutation lifecycle
- `useGraphqlSubscription.test.ts` — connection states, message buffering, reconnect logic
- `useGraphqlSchema.test.ts` — introspection caching, polling interval, stale detection
- `useGraphqlHistory.test.ts` — save/load/clear history, max-items FIFO eviction, recency grouping, search filter, max 100 items enforcement
- `useGraphqlQueryBuilder.test.ts` — toggleField adds/removes from selectedFields; SDL generator produces valid document; alias/directive/fragment state mutations; reset clears all state
- `useGraphqlCollections.test.ts` — add/update/delete items and folders, pin/unpin, drag-and-drop reorder, persistence round-trip
- `useGraphqlMockServer.test.ts` — mock enable/disable, custom resolver CRUD, config sync to server, reset to defaults
- `useGraphqlEnvironments.test.ts` — variable resolution precedence order, `{{var}}` interpolation
- `schemaDiff.test.ts` — removed field is `BREAKING`; added optional field is `SAFE`; changed type is `BREAKING`; zero changes for identical schemas
- `schemaSnapshot.test.ts` — capture saves to IndexedDB; max-20 FIFO eviction; load/delete round-trip
- `apqClient.test.ts` — SHA-256 hash is deterministic for same query; normalized whitespace produces same hash; two-step flow fires full query on `PERSISTED_QUERY_NOT_FOUND`; cache-hit path sends hash-only
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation (window/document undefined), env mutation, abort on rf.assert failure, script timeout at configured limit

### E2E Tests (Playwright)
- `e2e/graphql-basic.spec.ts` — connect, introspect, execute query, verify response
- `e2e/graphql-mutations.spec.ts` — execute mutation, verify state change
- `e2e/graphql-subscriptions.spec.ts` — subscribe, receive messages, unsubscribe
- `e2e/graphql-schema-explorer.spec.ts` — search types, click-to-insert
- `e2e/graphql-collections.spec.ts` — save, organize, re-run operations
- `e2e/graphql-variables.spec.ts` — variable interpolation, environment variables
- `e2e/graphql-file-upload.spec.ts` — upload file via multipart
- `e2e/graphql-workflow-nodes.spec.ts` — workflow with GraphQL nodes executes

### Test Scenarios (docs/plan/future/graphql/test-scenarios/)
- `graphql-editor-test-scenarios.md`
- `graphql-schema-explorer-test-scenarios.md`
- `graphql-subscriptions-test-scenarios.md`
- `graphql-workflow-nodes-test-scenarios.md`
- `graphql-collections-test-scenarios.md`
- `graphql-file-upload-test-scenarios.md`
- `graphql-code-generation-test-scenarios.md`
- `graphql-pre-request-scripts-test-scenarios.md`


## 21. References

- [GraphiQL Monorepo](https://github.com/graphql/graphiql) — 16.8k stars, official GraphQL IDE
- [Altair GraphQL Client](https://altairgraphql.dev/) — v8.5.4, Desktop/browser, environments, plugins, file upload
- [GraphQL Playground](https://github.com/graphql/graphql-playground) — Archived May 2026 (merged into GraphiQL)
- [Postman GraphQL](https://www.postman.com/graphql/) — Visual builder, schema introspection, subscriptions
- [Apollo GraphOS Explorer](https://www.apollographql.com/docs/graphos/explorer/) — Monaco-based, two-step search, operation collections, scripting
- [Hive (The Guild)](https://the-guild.dev/graphql/hive) — Schema registry, federation, observability, MIT licensed
- [Hoppscotch](https://hoppscotch.io/) — Open-source Postman alternative with GraphQL tab
- [graphql-ws](https://github.com/enisdenjo/graphql-ws) — Spec-compliant WebSocket subscriptions (`graphql-transport-ws` protocol)
- [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) — Legacy Apollo subscription protocol (deprecated)
- [graphql-sse](https://github.com/enisdenjo/graphql-sse) — GraphQL over Server-Sent Events transport spec
- [monaco-graphql](https://github.com/graphql/graphiql/tree/main/packages/monaco-graphql) — Monaco GraphQL language mode
- [cm6-graphql](https://github.com/graphql/graphiql/tree/main/packages/cm6-graphql) — CodeMirror 6 GraphQL extension (not used; reference only)
- [GraphQL Multipart Request Spec](https://github.com/jaydenseric/graphql-multipart-request-spec) — File upload standard
- [Incremental Delivery RFC](https://github.com/graphql/graphql-spec/blob/main/rfcs/DeferStream.md) — `@defer`/`@stream` specification
- [GraphQL Spec](https://spec.graphql.org/) — June 2018 + October 2021 editions
- [GraphQL Voyager](https://github.com/graphql-kit/graphql-voyager) — Visual schema relationship explorer
- [WebSocket Studio Plan](../websocket/websocket-studio-plan.md) — Pattern reference for connection management, proxy architecture, and tab layout

---
