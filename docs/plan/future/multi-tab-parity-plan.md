# Multi-Tab Parity Plan

> Bring every studio/editor to consistent multi-connection/multi-request tab support.

---

## Current State (July 2026)

### Cross-Feature Comparison

| Feature | Multi-Tab? | Max | Add | Close | Rename | Reorder | Duplicate | Persist Tabs | Per-Tab Isolation |
|---------|-----------|-----|-----|-------|--------|---------|-----------|-------------|-------------------|
| **GraphQL Studio** | **Yes** | 8 (7 user + 1 demo) | Yes | Yes | Yes (dbl-click) | **Yes** (drag, P4) | **Yes** (P4) | Yes (IDB + localStorage) | Full (query, vars, headers, auth, endpoint, TLS, response cache) |
| **gRPC Studio** | **Yes** | 8 | Yes | Yes | Yes (dbl-click) | **Yes** (drag, P4) | Yes | Yes (localStorage, 7-day TTL) | Full (method, body, metadata, auth, TLS, descriptor, stream session) |
| **WebSocket Studio** | **Yes** | 8 | Yes | Yes | Yes (dbl-click, F2) | **Yes** (drag) | **Yes** (P4) | Yes (localStorage) | Full (connection, messages, draft, mock port, console) |
| **SSE Studio** | **Yes** (P2) | 8 | Yes | Yes | Yes (dbl-click, F2) | **Yes** (drag) | **Yes** (P4) | Yes (localStorage) | Full (connection, events, console, auth, headers) |
| **Kafka Studio** | **No** (won't do) | 1 cluster | — | — | — | — | — | Cluster config only | N/A — single session, feature-nav tabs only |
| **Requests** | **Yes** (P1) | 8 | Yes | Yes | Yes (dbl-click) | **Yes** (drag, P4) | **Yes** (P4) | Yes (localStorage) | Full (sub-tab, response cache, env override, history) |

### Maturity Tiers

```
Tier 1 — Full multi-tab
├── GraphQL Studio:  8 tabs, per-tab query/vars/auth/endpoint, IDB persistence
├── gRPC Studio:     8 tabs, per-tab method/body/auth/TLS, duplicate, localStorage
├── WebSocket Studio: 8 tabs, per-tab connection/messages, reorder (drag), localStorage
├── SSE Studio:      8 tabs, per-tab connection/events, reorder (drag), localStorage (P2)
└── Requests:        8 tabs, per-tab sub-tab state/response cache, localStorage (P1)

Tier 2 — Single session with pane/feature navigation (no multi-tab planned)
└── Kafka Studio: 4 feature views (Publish / Consume / Topics / Schema)
```

---

## Phase 1: Requests Multi-Tab — High Value, Medium Effort

### Current Architecture (Detailed)

**State model — `useRequests.ts`:**
- `RequestsData` persisted as single IDB blob (key `'all'` in object store `requests`, DB v12)
- Selection: `selectedCollectionId` + `selectedRequestId` + `selectedEnvId` — one slot each
- `selectRequest(colId, reqId)` auto-saves a definition version snapshot (`autoSaveVersion`) for the leaving request, then updates both IDs
- `selectCollection(colId)` auto-selects the first root request in the target collection
- All request edits auto-save immediately via `updateRequest()` — no dirty/unsaved tracking

**Editor — `RequestEditor.tsx`:**
- Single component instance; NOT keyed by `request.id` — same instance stays mounted, props change
- 15 local `useState` hooks for UI state (active sub-tab, response sub-tab, cURL mode, sending, modals, etc.)
- On `request.id` change: only `responseSearch`, `inputMode`, `curlText`, `generatedCurl`, `showApiInfo` reset — everything else bleeds across requests (including `activeTab`, `responseTab`, `activeHistoryId`)
- Response data via `useResponseCache(request.id)` — per-request-ID Map keyed by `requestId`

**Response cache — `useResponseCache.ts`:**
- `useRef<Map<string, CachedResponse>>()` — component-local ref
- `CachedResponse`: `{ response: HttpResponse | null, responseTime: number, sendAllResults: { envName: string; response: HttpResponse; time: number }[] | null, consoleLines: ConsoleLine[], history: ResponseHistoryEntry[] }`
- `pushHistory`: prepends entry, caps at `MAX_HISTORY = 10`
- `restoreFromHistory(id)`: replays a saved response + clears `sendAllResults`
- Survives `request.id` switches (Map accumulates entries); NO eviction on request deletion
- Lost on full page reload (in-memory only)

**Sidebar — `RequestsSidebar.tsx`:**
- Single-click `onSelectRequest(colId, reqId)` = replace selection
- No modifier-key open, no open indicators, no tab-aware behavior
- Mounted via `AppSidebarRegion` with `display: contents/none` — hidden but not unmounted when on Catalog tab

**Deletion cleanup gaps (pre-existing bugs):**
- `removeRequest`: clears `selectedRequestId` only if deleted === selected; does NOT clean response cache Map
- `removeCollection`: clears both selection IDs if deleted collection was selected
- Sub-collection delete (`removeFolder` with `isSubCollection`): deletes nested requests but NEVER clears `selectedRequestId` → orphan selection → empty editor
- `deleteGroup`: clears `selectedCollectionId` only; doesn't clear `selectedRequestId` when group was selected
- Response cache Map entries for deleted requests are never pruned

### Pivotal Decision: Editor Mounting Model

Two viable architectures — this choice drives P1-C and the whole phase:

| Model | How | Pros | Cons |
|-------|-----|------|------|
| **A. Single editor, props swap** (chosen) | One `RequestEditor` mounted; `Requests.tsx` feeds it the active tab's `collection`/`request`. UI state (sub-tab, cURL mode) comes from the active `RequestTab`. | Minimal change from today; low memory; no N-editor perf cost | In-flight send on a background tab is paused/loses its live UI (response still lands in cache); can't show two editors side-by-side |
| **B. One editor per tab** (WS pattern) | Mount every tab's editor, hide inactive with `display:none` | Background sends keep live UI; future split-view | N `RequestEditor` instances (heavy — Monaco-free but still large); each needs its own response cache slot |

**Decision: Model A (single editor, props swap).** Requests are HTTP request/response — a background send still completes and its result is written to the shared response cache (keyed by `requestId`), so the only thing "lost" on a background tab is the live *sending* spinner, which is acceptable. Model B's cost (N heavy editor trees) is not justified. This makes the response-cache lift (P1-C) about **pruning + surviving editor unmount**, not correctness.

### P1-A: Tab State Layer ✅

**New types in `src/shared/types/requests.ts`:**

```typescript
export interface RequestTab {
  id: string;                    // 'req-tab-1', gap-filled sequence
  collectionId: string;
  requestId: string;
  label: string;                 // auto from request.name, or manual rename
  labelManual?: boolean;         // true = user renamed, blocks auto-naming
  activeSubTab: RequestSubTab;   // params | body | auth | headers | history
  responseSubTab: ResponseSubTab; // preview | headers | console
  inputMode: RequestInputMode;   // builder | curlImport | curlExport
  envId?: string;                // per-tab env override (multi-env collections)
}

export type RequestSubTab = 'params' | 'body' | 'auth' | 'headers' | 'history';
export type ResponseSubTab = 'preview' | 'headers' | 'console';
export type RequestInputMode = 'builder' | 'curlImport' | 'curlExport';
export const REQUEST_MAX_TABS = 8;
```

**New hook: `src/features/requests/hooks/useRequestTabs.ts`**

State: `{ tabs: RequestTab[], activeTabId: string }`.

API:

| Method | Behavior |
|--------|----------|
| `openTab(colId, reqId)` | If request already open → focus that tab. Otherwise: create tab (label from `request.name`), set active. Enforce `REQUEST_MAX_TABS`. |
| `closeTab(tabId)` | Guard: can't close last tab. Guard: if in-flight `sending` → confirm modal. Run `autoSaveVersion` for closing request. Remove tab, select neighbor (prefer left, fallback right). Prune response cache entry. |
| `selectTab(tabId)` | Set `activeTabId`. Run `autoSaveVersion` for the leaving tab's request. |
| `renameTab(tabId, label)` | Set `label`, `labelManual: true`. |
| `updateTabUI(tabId, patch)` | Partial update for `activeSubTab`, `responseSubTab`, `inputMode`, `envId`. |
| `syncTabLabel(tabId, name)` | If `!labelManual`, update `label` from request name change. |
| `removeStaleTab(reqId)` | Called on request/collection/sub-collection delete — close tab if its `requestId` matches. |

**Integration with `useRequests`:**
- Remove `selectedCollectionId`, `selectedRequestId`, `selectedEnvId` from `RequestsData` persisted blob (they become tab state)
- `selectRequest(colId, reqId)` becomes `openTab(colId, reqId)` — callers in App.tsx and AppSidebarRegion unchanged (just rename)
- Wire `removeStaleTab` into `removeRequest`, `removeCollection`, `removeFolder`, `deleteGroup` — fix the orphan selection bugs

**Files to modify:**
- `src/shared/types/requests.ts` — add `RequestTab`, sub-tab types, `REQUEST_MAX_TABS`
- `src/features/requests/hooks/useRequestTabs.ts` — **new file**
- `src/features/requests/hooks/useRequests.ts` — remove selection from `RequestsData`; wire `removeStaleTab` on deletes
- `src/features/requests/Requests.tsx` — consume `useRequestTabs`, pass active tab's col/req to editor
- `src/app/App.tsx` — replace `wb.selectRequest` calls with `wb.openTab`
- `src/app/components/AppSidebarRegion.tsx` — replace `onSelectRequest` with `onOpenTab`

### P1-B: Tab Bar Component ✅

**New file: `src/features/requests/components/RequestTabBar.tsx`**

Design (consistent with `GrpcTabBar` + `WsConnectionTabBar`):

| Feature | Implementation |
|---------|---------------|
| **Layout** | Horizontal scrollable row above editor; `role="tablist"` |
| **Tab button** | Method badge (GET=green, POST=blue, PUT=amber, DELETE=red, PATCH=purple) + label + close `×` |
| **Add** | `+` button at right end; disabled at `REQUEST_MAX_TABS`; tooltip "N/8" counter |
| **Close** | `×` per tab; hidden when `tabs.length === 1`; confirm if `sending` |
| **Rename** | Double-click label → inline `<input>`; Enter/blur commit, Escape cancel; max 40 chars |
| **Switch** | Click tab; `aria-selected="true"` on active |
| **Keyboard** | Arrow Left/Right between tabs, Home/End to first/last, Delete to close |
| **Badges** | `IN HARNESS` pill if `isInHarness`; unsaved dot if we add dirty tracking later |
| **Auto-label** | When request name changes and `!labelManual`, sync tab label |

**Not in P1 (deferred to P4):**
- Reorder (drag-and-drop) — WS-only today, add in P4
- Duplicate — gRPC-only today, add in P4
- Context menu — none exist today, add in P4

**CSS:** Add `.req-tab-bar`, `.req-tab`, `.req-tab-method`, `.req-tab-label`, `.req-tab-close`, `.req-tab-add` to `src/styles/requests.css`. Follow dark theme tokens (`--bg`, `--surface`, `--border`, `--primary`). Method badges use color-mix from `--success` (GET), `--primary` (POST), `--warning` (PUT), `--danger` (DELETE), `--accent` (PATCH).

**Selectors to add to `src/shared/selectors/req.ts`:**

```typescript
TAB_BAR:        '[data-testid="req-tab-bar"]',
TAB_ADD:        '[data-testid="req-tab-add"]',
TAB_ITEM:       '[data-testid="req-tab-item"]',
TAB_CLOSE:      '[data-testid="req-tab-close"]',
TAB_LABEL:      '[data-testid="req-tab-label"]',
tabById: (id: string) => `[data-testid="req-tab-item"][data-tab-id="${id}"]`,
```

### P1-C: Response Cache Lift ✅

**Why lift it (given Model A):** With a single editor swapping props, the current `useRef<Map>` already survives tab switches (same instance, Map keyed by `requestId`) — so correctness is *not* broken by tabs alone. The lift buys two things Model A still needs:
1. **Pruning** — a module-level Map exposes `pruneResponseCache(requestId)` callable from `closeTab()` and the delete handlers (fixes the unbounded-growth bug in P1-G).
2. **Unmount survival** — the sidebar hides Requests via `display:none` today, but any future unmount (route change, project switch) would wipe a ref-local Map; a module singleton is stable.

If we ever move to Model B, the singleton also becomes mandatory (each per-tab editor would otherwise get an empty Map).

**Solution:** Module-level singleton Map with React sync:

```typescript
// src/features/requests/hooks/useResponseCache.ts

const _cache = new Map<string, CachedResponse>();

export function useResponseCache(requestId: string) {
  const [, forceUpdate] = useReducer(c => c + 1, 0);
  // Read from _cache, write triggers forceUpdate
  // Same API as today: response, setResponse, pushHistory, etc.
}

export function pruneResponseCache(requestId: string): void {
  _cache.delete(requestId);
}
```

- `pruneResponseCache(requestId)` called from `useRequestTabs.closeTab()` and `useRequests.removeRequest()`
- `pruneResponseCacheMany(requestIds)` called from `useRequests.removeCollection()` to prune all requests in a deleted collection at once
- `_resetResponseCache()` and `_getResponseCacheSize()` exported for tests only
- No other changes to consumers — same `useResponseCache(requestId)` API

### P1-D: Sidebar Integration ✅

**Status:** Implemented.

**Current:** `onSelectRequest(colId, reqId)` → `wb.selectRequest()` → replaces editor.

**New behavior:**

| User action | Result |
|-------------|--------|
| Click request in sidebar | `openTab(colId, reqId)` — focus existing tab or create new |
| Ctrl/Cmd + Click | Always create new tab (even if request already open) |
| Right-click → "Open in New Tab" | Context menu action → always create new tab |
| Sidebar request already open in a tab | Subtle dot indicator next to request name |
| Click collection header | `selectTab` of first open tab from that collection; or open first request |

**Implemented:**
- `RequestsSidebar.tsx` — new props `openTabRequestIds?: Set<string>` and `onOpenInNewTab?: (colId, reqId) => void`; renders `.req-req-tab-dot` indicator for requests with open tabs
- `SidebarContextMenu.tsx` — "Open in New Tab" action in request context menu (conditional on `onOpenInNewTab` being provided)
- `requests.css` — `.req-req-tab-dot` styles (6px primary-color dot, auto margin-left)
- Tests: 4 new tests in `RequestsSidebar.test.tsx` for tab-dot rendering and prop passthrough
- **Note:** Full integration wiring (replacing `onSelectRequest` with `openTab` in `AppSidebarRegion.tsx`) deferred to P1 integration step when all pieces are assembled

### P1-E: Tab Persistence

**Storage key:** `redfire-request-tabs-v1`

**Storage backend:** IDB for web (new `idbRequestTabs` helper), `readKey`/`writeKey` for Tauri — same dual-mode pattern as other studios.

**Persisted fields per tab:**

```typescript
interface PersistedRequestTab {
  id: string;
  collectionId: string;
  requestId: string;
  label: string;
  labelManual?: boolean;
  activeSubTab: RequestSubTab;
  responseSubTab: ResponseSubTab;
  inputMode: RequestInputMode;
  envId?: string;
}
```

**Persisted at root level:** `{ tabs: PersistedRequestTab[], activeTabId: string }`

**NOT persisted:** response data, console lines, response history, in-flight state, scroll positions.

**Save:** Debounced 500ms after any tab state change. Immediate flush on `beforeunload`.

**Restore flow:**
1. Load tab state from storage
2. Validate each tab: does `collectionId` exist in `data.collections`? Does `requestId` exist in that collection's tree?
3. Remove stale tabs silently (collection/request deleted while app was closed)
4. If no valid tabs remain → create one blank tab (empty state)
5. Restore `activeTabId` if still valid, else first tab

**Migration from legacy `RequestsData` selection (one-time, first load after upgrade):**
- Before P1, selection lived in `RequestsData` (`selectedCollectionId` + `selectedRequestId` + `selectedEnvId`).
- On first load when `redfire-request-tabs-v1` is absent but `RequestsData` has a valid `selectedRequestId`, seed a single tab from it (`envId` from legacy `selectedEnvId`) so the user's current selection survives the upgrade.
- Then strip the three fields from the persisted `RequestsData` blob on the next save (they are no longer read).
- If legacy selection is also empty/stale → fall back to one blank tab.

✅ **Implemented:** `src/features/requests/hooks/useRequestTabPersistence.ts` (15 tests)
- `scheduleSave` / `flushSave` — debounced 500ms save, immediate flush on beforeunload
- `loadPersistedTabs` — load + validate against current collections
- `migrateFromLegacySelection` — one-time migration from `RequestsData` fields
- Storage key: `redfire-request-tabs-v1` via `readKey`/`writeKey` (dual-mode localStorage + Tauri store)

### P1-F: Demo Hub Integration → Moved to P5

Demo Hub bridges, adapters, and lesson updates for Requests multi-tab are **deferred to Phase 5** (Demo Hub Lesson Coverage). This keeps P1 focused on the core product implementation. See P5-A for the full plan.

### P1-H: Integration (wire everything together)

**Goal:** Connect all P1-A through P1-E pieces into the running app.

**Changes:**

| File | Change |
|------|--------|
| `src/features/requests/Requests.tsx` | Mount `RequestTabBar`; consume `useRequestTabs` to derive `collection`/`request` from active tab; pass `onTabUIChange` to `RequestEditor`; replace `wb.selectedCollection`/`wb.selectedRequest` with tab-derived values |
| `src/features/requests/components/RequestEditor.tsx` | Remove ~15 local UI states (`activeSubTab`, `responseSubTab`, `inputMode`, `activeHistoryId`) → read from `RequestTab` prop; accept `onTabUIChange` callback |
| `src/app/components/AppSidebarRegion.tsx` | Pass `openTabRequestIds` and `onOpenInNewTab` to `RequestsSidebar`; wire `onSelectRequest` to call `openTab` instead of `wb.selectRequest` |
| `src/app/App.tsx` | Create `useRequestTabs(getCollections, patchCollections)` in the top-level app; pass tab-related callbacks down; wire `removeStaleTab`/`removeStaleTabsByCollection` into `removeRequest`/`removeCollection`/`removeFolder`/`deleteGroup` callbacks; wire `pruneResponseCache`/`pruneResponseCacheMany` into delete callbacks |

**Sequence:** After P1-E persistence is ready, this step connects the plumbing. It touches the most files but each change is small — mostly prop threading + replacing `selectedRequestId`-based flows with tab-based flows.

✅ **Implemented:**
- `src/features/requests/hooks/useRequestTabCoordinator.ts` — Coordination hook combining `useRequestTabs` + persistence + deletion side-effects + sidebar selection sync (6 tests)
- `src/features/requests/Requests.tsx` — Mounts `RequestTabBar`, derives collection/request from active tab, accepts tab props from parent
- `src/app/App.tsx` — Creates `useRequestTabCoordinator(wb)`, threads tab state to `Requests` and `AppSidebarRegion`
- `src/app/components/AppSidebarRegion.tsx` — Sidebar wired: `onSelectRequest → reqTabs.selectRequest`, `onDeleteRequest → reqTabs.removeRequest`, `onDeleteCollection → reqTabs.removeCollection`, `openTabRequestIds` for dot indicator, `onOpenInNewTab` for context menu
- All navigation paths (Catalog "Navigate to Request", Scenario Builder "Open Request") go through `reqTabs.selectRequest` so they create/focus tabs

### P1-G: Fix Pre-Existing Bugs (While Here) ✅ (partial)

These bugs exist today regardless of multi-tab, but must be fixed as part of the tab migration:

| Bug | Root Cause | Fix | Status |
|-----|-----------|-----|--------|
| Sub-collection delete orphans `selectedRequestId` | `removeFolder` with `isSubCollection` doesn't clear selection | `removeFolder` now collects all request IDs in deleted sub-collection via `collectAllRequests` and clears `selectedRequestId` if it matches | ✅ Fixed |
| `activeTab`/`responseTab` bleed across requests | Component-local state, not reset on `request.id` change | Lifted to per-tab `RequestTab` model: `activeSubTab`, `responseSubTab`, `inputMode` driven by tab props with local fallback for preview mode | ✅ Fixed |
| `activeHistoryId` not reset on request switch | Missing from `prevReqIdForUI` effect | Lifted to per-tab `RequestTab.activeHistoryId` with prop-driven setter; each tab remembers its own active history entry | ✅ Fixed |
| Response cache Map grows without bound | No pruning on request/collection delete | `pruneResponseCache()` + `pruneResponseCacheMany()` APIs added in P1-C; call sites wired in P1-H coordinator | ✅ Fixed |
| `deleteGroup` doesn't clear `selectedRequestId` | Only clears `selectedCollectionId` | `deleteGroup` now also clears `selectedRequestId` when group selection is cleared | ✅ Fixed |

**Tests added:** 3 new tests in `useRequests.test.ts` — sub-collection delete clears selection, sub-collection delete preserves unrelated selection, deleteGroup clears selectedRequestId.

### P1 Estimated Effort

| Sub-phase | Scope | Estimate | Status |
|-----------|-------|----------|--------|
| P1-A: Tab state layer | Types + hook + wiring | 1.5-2 days | ✅ Done |
| P1-B: Tab bar component | UI + CSS + selectors + ARIA | 1 day | ✅ Done |
| P1-C: Response cache lift | Singleton Map + prune API | 0.5 day | ✅ Done |
| P1-D: Sidebar integration | Open semantics + indicators | 0.5 day | ✅ Done |
| P1-E: Tab persistence | localStorage/Tauri store + restore validation + legacy migration | 0.5 day | ✅ Done |
| P1-F: Demo hub integration | → Moved to P5-A | — | — |
| P1-G: Pre-existing bug fixes | 5 deletion/state bugs | 0.5 day | ✅ Done (all 5 fixed) |
| P1-H: Integration | Wire all pieces together | 1-1.5 days | ✅ Done |
| **P1 Total** | | **5-6 days** | **✅ Complete (excl. Demo Hub → P5-A)** |

### P1 Test Plan

| Layer | What | Command |
|-------|------|---------|
| Unit: `useRequestTabs` | openTab, closeTab, selectTab, renameTab, max cap, stale removal, autoSaveVersion on close/switch | `npx vitest run src/features/requests/hooks/useRequestTabs.test.ts` |
| Unit: `RequestTabBar` | Render, click, rename, close, keyboard nav, method badge, ARIA | `npx vitest run src/features/requests/components/RequestTabBar.test.tsx` |
| Unit: `useResponseCache` | Singleton behavior, pruneResponseCache, cross-instance consistency | `npx vitest run src/features/requests/hooks/useResponseCache.test.ts` |
| Unit: `useRequests` deletion | Verify stale tab removal on removeRequest/removeCollection/removeFolder/deleteGroup | Extend existing `useRequests.test.ts` |
| Integration | Tab state ↔ editor ↔ sidebar ↔ persistence round-trip | New integration test file |
| tsc | Zero type errors (mandatory after every batch) | `npx tsc -b --noEmit` |
| Coverage (scoped) | >90% statements/branches/functions/lines on each new/touched file | `bash scripts/run-product-coverage-file.sh <file>` then batch per `coverage-gates.mdc` |
| Monolith check | `RequestEditor.tsx` must stay <900 lines (removing 15 local states should help, not hurt) | monolith check in `run-product-coverage-fast.sh` at merge |
| Demo lessons | Existing `req-body-auth`, `req-quick-start` still work with tab-aware sidebar | Run each lesson E2E spec |

---

## Phase 2: SSE Multi-Tab — ✅ Done

### Current Architecture (Post-Phase 2)

**Connection hook — `useSseConnection.ts`:** (unchanged)
- Uses `fetch()` + `ReadableStream` (NOT browser `EventSource` API)
- `AbortController` per connection; custom `createSseParser()` for SSE frame parsing
- Event buffer: `SseEvent[]` with ring-buffer cap at `MAX_EVENTS = 10_000` (oldest dropped)
- Reconnect: auto-reconnect with exponential backoff; `maxRetries` (default 10); respects server `retry:` field
- One instance per tab (isolation via React hook lifecycle)

**Page — `SseStudioPage.tsx` (tab coordinator):**
- Manages `tabs: SseConnectionTab[]`, `activeTabId`, `connectionStates` state
- Loads/migrates persisted tabs on mount via `loadSseTabState()` / `migrateLegacySseConfig()`
- Debounced save (300ms) + flush on unmount via `saveSseTabState()`
- Tab operations: add, close (with confirm modal for active connections), rename, reorder, select
- Auto-label: `deriveSseTabLabel(url)` — uses URL hostname when not manually renamed
- Tab ID counter synced from persisted tabs on restore to prevent collisions

**Tab content — `SseConnectionTabContent.tsx`:**
- `forwardRef` component wrapping `useSseConnection` + `useSseConsole` per tab
- Syncs tab config → hook on mount, propagates hook config changes → tab model
- Reports connection state changes upward for tab bar indicators
- Imperative handle: `disconnect()` + `getConnectionState()` for close-tab cleanup
- All tab panes stay mounted; inactive ones use `display: none` (keeps background SSE connections alive)

**Tab bar — `SseConnectionTabBar.tsx`:**
- Status dot per tab (idle=gray, connecting=amber, connected=green, error=red)
- Double-click / F2 rename with inline input
- Middle-click close, Delete key close
- Drag-and-drop reorder
- Keyboard navigation (Arrow Left/Right, Home/End, Enter/Space)
- Max tabs indicator (N/8) on add button
- Close button hidden when only 1 tab

**Shell — `SseStudioShell.tsx`:** (unchanged)
- Presentational split-pane layout with left/right pane tabs
- `leftTab` / `rightTab` now driven from per-tab `SseConnectionTab` state

**Types — `sseTypes.ts`:**
- `SseConnectionTab`: id, label, labelManual, url, headers, auth, autoReconnect, maxRetries, leftTab, rightTab
- `SsePersistedTabState`: tabs[], activeTabId
- `SSE_MAX_TABS = 8`
- `createDefaultSseTab(id, label)` factory

**Storage — `sseStorage.ts`:**
- New key: `redfire-sse-tab-state-v1` — full tab state with sanitization on load
- Legacy migration: `migrateLegacySseConfig()` reads `redfire-sse-config-v1` → creates one tab
- `deriveSseTabLabel(url)` utility
- Global keys unchanged: split pane width, console settings

**Selectors — `selectors/sse.ts`:**
- Added: `CONN_TAB_BAR`, `CONN_TAB_ADD`, `CONN_TAB_ITEM`, `CONN_TAB_CLOSE`, `connTabById(id)`

**CSS — `sse-studio.css`:**
- Added `.sse-conn-tab-bar`, `.sse-conn-tab`, indicator, rename input, close button, drag/drop, add button
- Close-tab confirmation uses shared `ConfirmModal` component (consistent with WebSocket studio)

### P2-A: Tab State Model — ✅ Done

Added to `sseTypes.ts`:
- `SseConnectionTab` interface (config + UI state per tab)
- `SsePersistedTabState` interface
- `SSE_MAX_TABS = 8` constant
- `createDefaultSseTab()` factory function

Added selectors to `selectors/sse.ts`:
- `CONN_TAB_BAR`, `CONN_TAB_ADD`, `CONN_TAB_ITEM`, `CONN_TAB_CLOSE`, `connTabById(id)`

### P2-B: Tab Bar Component — ✅ Done

**Created: `src/features/sse/SseConnectionTabBar.tsx`**

| Feature | Status |
|---------|--------|
| Add / Close / Rename | ✅ (dbl-click, F2, middle-click close) |
| Connection status dot | ✅ 5-state color mapping |
| Reorder (drag-and-drop) | ✅ |
| Keyboard nav | ✅ Arrow/Home/End/Enter/Space/Delete/F2 |
| Max tabs indicator | ✅ "N/8" tooltip on add button |

**Test: `SseConnectionTabBar.test.tsx`** — 19 tests covering all features + `computeDropIndex`.

### P2-C: Per-Tab Connection — ✅ Done

**Created: `src/features/sse/SseConnectionTabContent.tsx`**

- Extracted per-tab content from `SseStudioPage` into a `forwardRef` component
- Each tab owns its own `useSseConnection()` + `useSseConsole()` hook instances
- Config sync: tab model → hook on mount; hook → tab model on changes
- Connection state reported upward for tab bar indicator dots
- Imperative handle for parent to call `disconnect()` and `getConnectionState()`
- Close-tab confirm modal when connection is active

**Refactored: `SseStudioPage.tsx`** from single-connection page to tab coordinator:
- Tab lifecycle: add, close (with disconnect + confirm), rename, reorder, select
- Tab ID counter with persistence sync (`syncCounterFromTabs`)
- All tab panes mounted with `display: none` for inactive tabs

### P2-D: Per-Tab Event Buffer — ✅ Verified

Each tab's `useSseConnection` hook instance manages its own `events[]`, `stats`, `bookmarkedIds`.
Each tab's `useSseConsole` hook instance manages its own console entries.
No code changes needed — isolation is inherent in the per-tab hook architecture.

### P2-E: Tab Persistence — ✅ Done

**Extended: `sseStorage.ts`**

| Function | Purpose |
|----------|---------|
| `loadSseTabState()` | Load + sanitize + validate from `redfire-sse-tab-state-v1` |
| `saveSseTabState()` | Persist tab state |
| `migrateLegacySseConfig()` | One-time migration from `redfire-sse-config-v1` |
| `deriveSseTabLabel(url)` | Auto-label from URL hostname |

**Test: `sseStorage.test.ts`** — 15 tests covering load, save, sanitization, migration, label derivation.

### P2-F: Demo Hub Integration — Deferred to P5

Two existing SSE demo lessons (`sse-studio.ts`, `sse-studio-advanced.ts`) work against the active tab.
Window bridges and adapter deferred to P5 (Demo Hub Lesson Coverage phase) per P1 precedent.

### P2 Completion Summary

| Sub-phase | Status | Files |
|-----------|--------|-------|
| P2-A: Tab state model | ✅ Done | `sseTypes.ts`, `selectors/sse.ts` |
| P2-B: Tab bar component | ✅ Done | `SseConnectionTabBar.tsx`, `SseConnectionTabBar.test.tsx`, `sse-studio.css` |
| P2-C: Per-tab connection | ✅ Done | `SseConnectionTabContent.tsx`, `SseStudioPage.tsx` (rewritten) |
| P2-D: Event buffer | ✅ Verified | No changes needed |
| P2-E: Tab persistence | ✅ Done | `sseStorage.ts`, `sseStorage.test.ts` |
| P2-F: Demo hub | Deferred → P5 | — |

**Test results:** 231 tests passing (11 files) — 206 existing + 25 new.
**Type check:** `tsc -b --noEmit` clean (0 errors).

---

## Phase 3: Kafka Multi-Tab — ❌ Won't Do

**Decision (July 2026):** Dropped from the plan. Revisit only on explicit user demand.

**Rationale:**
- Kafka connections are **heavyweight** (TCP broker connections, consumer groups, SASL/TLS handshakes) — fundamentally different from the HTTP-based streams in SSE/WS/GraphQL
- Each tab would mean N simultaneous broker connections with real resource costs
- Kafka Studio already has **4 feature views** (Publish / Consume / Topics / Schema) — those internal tabs serve the role that multi-tab serves in simpler studios
- The typical workflow is sequential: connect to dev cluster → test → disconnect → connect to staging — **cluster switching already covers this**
- The "compare dev vs staging side-by-side" use case is real but rare and doesn't justify 4-5 days of engineering + ongoing maintenance of N-connection lifecycle management
- No user demand has been reported for this capability

If user demand emerges, the architecture notes from the original P3 design are preserved in git history (commit where this section was trimmed).

---

## Phase 4: Tab Bar Parity — Normalize Across All Studios

### Feature Matrix (Post-P4)

| Feature | GQL | gRPC | WS | SSE | Requests |
|---------|-----|------|----|-----|----------|
| Add | ✅ | ✅ | ✅ | ✅ | ✅ |
| Close | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rename (dbl-click + F2) | ✅ (+ F2, P4) | ✅ (+ F2, P4) | ✅ (+ F2) | ✅ (+ F2) | ✅ (+ F2, P4) |
| Reorder (drag) | ✅ (P4) | ✅ (P4) | ✅ | ✅ | ✅ (P4) |
| Duplicate | ✅ (P4) | ✅ | ✅ (P4) | ✅ (P4) | ✅ (P4) |
| Keyboard nav | ✅ (P4) | ✅ (P4) | ✅ | ✅ | ✅ (P1) |
| Context menu | ✅ (P4) | ✅ (P4) | ✅ (P4) | ✅ (P4) | ✅ (P4) |
| In-flight close guard | ✅ (2-step) | ✅ (block) | ✅ (modal) | ✅ (modal) | ✅ |
| Max tabs indicator | ✅ (P4) | ✅ | ✅ (P4) | ✅ | ✅ |

### Design Decision: Shared Hooks, Not a Monolithic Component

After reviewing all 5 tab bars, a single `<StudioTabBar>` component is impractical:

- GQL (267 lines): auth dots, batch badges, op-type badges, unsaved-change 2-step close, demo tab protection
- gRPC (202 lines): call-type pills, call-count badges, in-flight dots, inline duplicate button
- WS (452 lines): connection-state dots, history dropdown, full DnD + keyboard nav
- SSE (305 lines): connection-state dots, full DnD + keyboard nav (P2)
- Requests (175 lines): HTTP method color badges, partial keyboard nav (P1)

A shared component would need so many render slots/overrides that it would be more complex than the sum of its parts. Instead, P4 extracts **shared utilities** that each tab bar consumes, keeping domain-specific rendering in place.

### P4-A: Shared Tab Utilities ✅

**New files under `src/shared/components/studio-tabs/`:**

| File | Purpose |
|------|---------|
| `computeDropIndex.ts` | Deduplicate the identical `computeDropIndex` function from WS + SSE into a single import |
| `useTabDragReorder.ts` | Reusable hook: DnD state (`draggingTabId`, `dragOverTabId`, `dropSide`) + all handlers (`handleDragStart/End/Over/Leave/Drop`) |
| `TabContextMenu.tsx` | Positioned right-click context menu: Close, Close Others, Close Right, Duplicate, Rename, Copy Label |
| `studio-tab-context-menu.css` | Shared context menu + drop indicator CSS |
| `index.ts` | Barrel export |

WS and SSE tab bars are updated to import `computeDropIndex` from the shared module (removing their local copies).

### P4-B: Backfill Reorder (Drag) to GQL, gRPC, Requests ✅

For each studio that lacks drag-reorder:

1. **Tab bar component**: Add `onReorder` optional prop, `draggable` attribute, DnD event handlers using `useTabDragReorder` hook
2. **Parent hook/state**: Add `reorderTabs(fromIndex, toIndex)` handler that splices the tab array
3. **CSS**: Add drop-indicator classes (`.xxx-drop-before`, `.xxx-drop-after`)

| Studio | Tab bar file | Parent state file | CSS file |
|--------|-------------|-------------------|----------|
| GQL | `GqlTabBar.tsx` | `useGqlStudioTabs.ts` | `graphql-studio.css` |
| gRPC | `GrpcTabBar.tsx` | `grpcStudioTabCommands.ts` | `grpc-studio.css` |
| Requests | `RequestTabBar.tsx` | `useRequestTabs.ts` | `requests.css` |

### P4-C: Backfill Duplicate to GQL, WS, SSE, Requests ✅

| Studio | Duplicate semantics | Parent handler location | Status |
|--------|---------------------|------------------------|--------|
| GQL | Deep copy query, vars, headers, auth overrides; reset response; new ID/label | `useGqlStudioTabs.ts` → `duplicateTab()` | ✅ Done |
| WS | Copy URL, headers, auth, draft, studio location; new tab disconnected | `WebSocketStudioPage.tsx` → `handleDuplicateTab()` | ✅ Done |
| SSE | Copy URL, headers, auth, reconnect config; new tab idle | `SseStudioPage.tsx` → `handleDuplicateTab()` | ✅ Done |
| Requests | Open same request in a new tab with independent UI state | `useRequestTabs.ts` → `duplicateTab()` | ✅ Done |

Tab bar UI: ⧉ button (matching gRPC's existing pattern), disabled when at max tabs.

### P4-D: Context Menu for All Tab Bars ✅

Shared `<TabContextMenu>` component, triggered by `onContextMenu` on each tab:

| Action | Available | Key binding |
|--------|-----------|-------------|
| Close Tab | Always (unless last tab or in-flight) | — |
| Close Other Tabs | When > 1 tab | — |
| Close Tabs to the Right | When tabs exist to the right | — |
| Duplicate Tab | When under max tabs | — |
| Rename Tab | Always | F2 |
| Copy Label | Always | — |

### P4-E: Keyboard Navigation for GQL + gRPC ✅

Backfill the WS/SSE keyboard nav pattern to GQL and gRPC tab bars:

- Arrow Left/Right: move focus between tabs (wrap around)
- Home/End: first/last tab
- Enter/Space: activate focused tab
- Delete: close focused tab (when >1 tab)
- F2: start rename

**Note**: `tabElRefs` + `pendingFocusRef` pattern required. GQL uses `<button>` elements (natively focusable); gRPC uses `<div role="tab">` with `tabIndex`.

### P4 Estimated Effort

| Sub-phase | Scope | Estimate | Status |
|-----------|-------|----------|--------|
| P4-A: Shared utilities | Extract + test | 0.5 day | ✅ Done |
| P4-B: Backfill reorder | GQL + gRPC + Requests | 0.5 day | ✅ Done |
| P4-C: Backfill duplicate | GQL + WS + SSE + Requests | 0.5 day | ✅ Done |
| P4-D: Context menu | Shared component + per-studio | 0.5 day | ✅ Done |
| P4-E: Keyboard nav | Backfill to GQL + gRPC | 0.25 day | ✅ Done |
| **P4 Total** | | **2-3 days** | **✅ Complete** |

### P4 Notes & Fixes Applied During Review

1. **WS/SSE duplicate handlers were missing** — `handleDuplicateTab` implemented in `WebSocketStudioPage.tsx` and `SseStudioPage.tsx` and wired to `onDuplicate` prop on their tab bars
2. **GQL context menu crash guard** — `tabs.find()` in `buildContextMenuItems` now guards against `undefined` result (edge case: tab removed between right-click and menu render)
3. **WS/SSE bulk close safety** — `close-others` / `close-right` context menu actions now skip actively connected/connecting tabs to avoid conflicting with the single-tab confirm-close dialog
4. **WS/SSE still use inline DnD state** (not `useTabDragReorder` hook) — this is intentional since they already had working DnD before P4; the shared hook was created for studios that lacked it (GQL, gRPC, Requests)

---

## Phase 5: Demo Hub Lesson Coverage

Multi-tab is a **user-facing feature** — each studio that gains (or already has) tabs needs a Demo Hub lesson that *teaches* it, plus existing lessons updated to be tab-aware. This phase runs **incrementally alongside P1–P4**, not as a separate block: each studio's lesson ships in the same PR as its tab implementation.

### Current Lesson Coverage

| Studio | Has tabs? | Dedicated tab lesson | File | Status |
|--------|-----------|----------------------|------|--------|
| GraphQL | Yes | **Yes** — "Multi-Tab Workspaces" (GQL-14) | `protocols/graphql-multi-tab.ts` | ✅ Reference implementation |
| WebSocket | Yes | **Yes** — "Tabs & Multi-Connection" | `protocols/ws-tabs.ts` | ✅ Reference implementation |
| gRPC | Yes | **No** | — | ❌ **Pre-existing gap** — tabs exist, never taught |
| Requests | After P1 | No | — | ➕ New lesson in P1 |
| SSE | After P2 | No | — | ➕ New lesson in P2 |
| Kafka | No (P3 dropped) | N/A | — | N/A |

**Reference the two existing lessons** (`graphql-multi-tab.ts`, `ws-tabs.ts`) for structure: concept body explaining *why tabs vs. separate windows/tools*, an SVG diagram of the tab bar with per-tab isolation callouts, and a step sequence that opens a 2nd tab, gives it a distinct config, executes, switches back, and shows cached state persists.

### P5-A: Requests Multi-Tab Lesson + Bridges (after P1)

**Prerequisites:** P1-A through P1-H complete (tabs fully functional in the product).

**Part 1 — Window bridges + adapter** (previously P1-F):

| Bridge | Purpose |
|--------|---------|
| `__demoOpenRequestTab(colId, reqId)` | Open/focus a tab for a specific request |
| `__demoCloseAllRequestTabs()` | Reset to single blank tab (lesson cleanup) |
| `__demoGetActiveRequestTabId()` | Read active tab ID for assertions |

**Adapter (new file):** `packages/demo-hub/src/adapters/requestsAdapter.ts`

**Part 2 — New lesson:** `packages/demo-hub/src/lessons/api/req-multi-tab.ts` → register in `api/index.ts` (`requestLessons` array, after `reqBodyAuthLesson`).

| Field | Value |
|-------|-------|
| `id` | `req-multi-tab` |
| `domainId` | `api` |
| `category` | `requests` |
| `name` | `Multi-Tab Requests` |
| `estimatedMinutes` | ~4 (7–8 steps) |

**Concept:** Why open multiple requests at once — compare a GET and its POST side by side, keep an auth-heavy request open while testing another, per-tab response cache so switching tabs doesn't blank the response.

**Step arc (mirrors GQL-14):**
1. Tour the request tab bar (highlight `REQ.TAB_BAR`)
2. Open a first request from the sidebar → tab appears
3. Ctrl/Cmd+click a second request → second tab opens (don't replace)
4. Show method badges differ per tab (GET green vs POST blue)
5. Send on tab 2, switch to tab 1 → tab 1's cached response persists
6. Rename a tab (double-click)
7. Close a tab → neighbor selected; last tab can't close

**Bridges/adapter:** The lesson calls the adapter (Part 1 above), never touches product internals (per `demo-player-lessons.mdc` §8).

**Part 3 — Update existing req-* lessons to be tab-aware:** `req-quick-start`, `req-collections`, `req-multi-env`, `req-body-auth`, `req-send-harness`, `req-versioning` currently assume single-selection. Where they "open a request," route through `__demoOpenRequestTab` so the viewer sees a tab appear (no behavioral break — first open still fills the one tab). Add a one-line narration callout where natural (e.g. req-quick-start: "notice the request opened in its own tab").

### P5-B: SSE Multi-Tab Lesson (ships with P2)

**New lesson:** `packages/demo-hub/src/lessons/protocols/sse-tabs.ts` → register in the protocols index alongside `sse-studio`, `sse-studio-advanced`.

| Field | Value |
|-------|-------|
| `id` | `sse-tabs` |
| `category` | `sse` |
| `name` | `Multi-Connection SSE Tabs` |
| `estimatedMinutes` | ~4 |

**Concept:** Two live SSE streams at once (e.g. two event sources / two environments), each with its own event buffer and connection status dot. Mirror `ws-tabs.ts` closely since SSE reuses the WS tab-bar pattern.

**Step arc:** open tab 1 → connect → events flow; add tab 2 → connect to a different URL → its own event log; switch tabs → each buffer isolated; close a connected tab → confirm-disconnect guard fires.

**Update existing SSE lessons:** `sse-studio`, `sse-studio-advanced` narration should acknowledge the tab bar now exists (single-tab flows still work unchanged after the P2 legacy-config migration seeds one tab).

### P5-C: gRPC Multi-Tab Lesson (backfill — pre-existing gap)

gRPC has had full multi-tab (duplicate included) with **no lesson**. Backfill:

**New lesson:** `packages/demo-hub/src/lessons/protocols/grpc-tabs.ts` (or fold into an existing gRPC lesson if step budget allows). Helper `grpc-lesson-helpers/tabs.ts` already exists — build on it.

| Field | Value |
|-------|-------|
| `id` | `grpc-tabs` |
| `category` | `grpc` |
| `name` | `Multi-Tab gRPC Calls` |
| `estimatedMinutes` | ~4 |

**Concept:** Per-tab method binding + request body + metadata/auth + streaming session; plus gRPC's unique **Duplicate tab** (clone a configured call to tweak one field). Can slot independently of P1–P4 — schedule with P4 (parity) since it also showcases duplicate.

### P5-D: Kafka Multi-Tab Lesson — ❌ Dropped (P3 won't do)

N/A — Kafka multi-tab (P3) was dropped from the plan. No lesson needed.

### P5-E: Parity Feature Callouts (with P4)

When P4 backfills reorder / duplicate / context menu / keyboard nav across studios, update the **two existing** tab lessons (`graphql-multi-tab`, `ws-tabs`) and the new ones to demonstrate the newly-shared capabilities where pedagogically useful (e.g. one step showing drag-reorder, one showing the right-click tab menu). Avoid bloating every lesson — add these callouts only where they teach something new.

### P5 Per-Lesson Done Checklist

Every new/updated lesson follows the 5-item merge gate in `docs/guides/demo-lesson-done-checklist.md` (not the full wrapper unit-test bar):

```text
[ ] 1 manual 1× run + rapid Next (preAction guards recover)
[ ] 2 E2E smoke spec walks the step count
[ ] 3 helper unit tests (if helpers changed)
[ ] 4 selectors in src/shared/selectors + demo tab wiring
[ ] 5 tsc + scoped vitest
```

Plus: new selectors go in `src/shared/selectors/*` (never inline `[data-testid]` in lessons, per `demo-player-lessons.mdc` §9); new bridges go through an adapter (§8); `estimatedMinutes` matches step count (§11).

### P5 Estimated Effort

| Sub-phase | Scope | Ships with | Estimate |
|-----------|-------|-----------|----------|
| P5-A: Requests bridges + lesson + update 6 req-* lessons | Window bridges + adapter + new lesson + tab-aware retrofits + E2E smoke | After P1 | 2 days |
| P5-B: SSE lesson + update 2 sse lessons | New lesson (reuse ws-tabs) + E2E smoke | P2 | 1 day |
| P5-C: gRPC lesson (backfill) | New lesson + E2E smoke | P4 (or standalone) | 1 day |
| P5-D: Kafka lesson | ❌ Dropped (P3 won't do) | — | — |
| P5-E: Parity callouts | Update 2 existing + new lessons | P4 | 0.5 day |
| **P5 Total** | | | **4.5 days** |

> These estimates are **additive** to each phase's effort and assume the P1-F / P2-F bridge plumbing already exists (they build the *lessons* on top of it).

---

## Priority & Sequencing

```
P1: Requests Multi-Tab     █████████████  ✅ Done
P2: SSE Multi-Tab           ██████         ✅ Done
P4: Tab Bar Parity          █████          ✅ Done
P3: Kafka Multi-Tab         ██             ❌ Won't Do — dropped (July 2026)
```

### Total Effort Summary

| Phase | Feature Estimate | + Demo Hub (P5) | Status |
|-------|------------------|-----------------|--------|
| P1: Requests Multi-Tab | 5-6 days | +2 (P5-A) | ✅ Done |
| P2: SSE Multi-Tab | 2-3 days | +1 (P5-B) | ✅ Done |
| P4: Tab Bar Parity | 2-3 days | +1.5 (P5-C gRPC + P5-E callouts) | ✅ Done |
| P3: Kafka Multi-Tab | — | — | ❌ Dropped |
| **Remaining** | **0 days** | **+4.5 days (P5)** | |

> **Grand total remaining: ~4.5 days** (P5 lessons only). Each studio's tab lesson ships in the same PR as its tab implementation — do not defer lessons to a trailing "docs" phase.

### Recommended Order

1. ~~**P1** → Requests multi-tab core~~ ✅ Done
2. ~~**P2** → SSE multi-tab~~ ✅ Done
3. **P4 + P5-C + P5-E** → Normalize all tab bars (shared component, backfill features) + backfill the missing **gRPC tab lesson** + parity callouts
4. **P5-A + P5-B** → Demo Hub lessons for Requests and SSE multi-tab (can run in parallel with P4 or after)

> **Rule:** every phase that adds/changes tabs ships its Demo Hub lesson **in the same PR** (per `demo-lesson-done-checklist.md`). The gRPC tab lesson (P5-C) is a pre-existing gap — gRPC has had tabs with no lesson — and should be picked up at the latest during P4.

---

## Design Decisions

### Open

1. **Requests: env per-tab or global?**
   - Today: `selectedEnvId` is workbench-wide. Sub-collections pin env at the folder level.
   - **Recommendation:** Per-tab. When a multi-env request is opened, the tab inherits the current workbench env but can be changed independently. Consistent with GQL/gRPC where each tab has its own connection override.

2. **Requests: preview mode as a tab?**
   - Today: Gallery preview (`previewRequest`) overlays the whole editor with a banner.
   - **Recommendation:** Keep as overlay (temporary, read-only) — not a persistent tab. Preview is ephemeral and shouldn't consume a tab slot.

3. **Shared `<StudioTabBar>` vs per-studio components?**
   - **Recommendation:** P1/P2 build per-studio components. P4 extracts shared component and migrates existing GQL/gRPC/WS bars. This avoids blocking P1/P2 on a premature abstraction.

4. ~~**Kafka multi-cluster value?**~~ → **Closed.** P3 dropped — see Phase 3 section.

5. **Response cache: module singleton vs React context?**
   - **Recommendation:** Module singleton Map. Simpler, no provider tree changes, matches WS pattern where hook instances share page-level state. React context would be over-engineering for a simple cache.

### Closed

1. **Max tabs: 8** — Consistent across all studios. Proven in GQL/gRPC/WS/SSE/Requests.
2. **Tab IDs: `{prefix}-tab-{n}` with gap-filling** — Consistent naming. GQL uses `gql-tab-{n}`, gRPC uses `grpc-tab-{n}`, WS uses `ws-tab-{n}`.
3. **Close last tab: prevent** — Cannot close the last tab. All studios enforce this.
4. **Persistence: IDB for web, storage abstraction for Tauri** — Proven pattern.
5. **Demo tab isolation for Requests:** Label-based (follow gRPC pattern). No typed `demoLessonId` field needed.
6. **Auto-label:** Tab label syncs from request name / URL hostname unless user manually renamed (`labelManual`). All three Tier 1 studios do this.
7. **Tab persistence is NOT project-scoped** — Verified: neither `tabPersistence.ts` (GQL) nor `idbRequests.ts` scope by project. Request tabs use a single global key (`redfire-request-tabs-v1`) for consistency with existing studios. Stale-tab validation on load (P1-E step 2) already prunes tabs whose collection/request no longer exists, which covers the case where collections differ after a data change.

---

## Reference Implementation Map

| Concern | GraphQL | gRPC | WebSocket |
|---------|---------|------|-----------|
| **Tab types** | `src/features/graphql/utils/tabPersistence.ts` (`GqlStudioTab`) | `src/features/grpc/grpcStudioTypes.ts` (`GrpcStudioTabState`) | `src/shared/websocket/types.ts` (`WsPersistedTab`) |
| **Tab bar UI** | `src/features/graphql/components/GqlTabBar.tsx` | `src/features/grpc/components/GrpcTabBar.tsx` | `src/features/websocket/WsConnectionTabBar.tsx` |
| **Tab lifecycle** | `src/features/graphql/hooks/useGqlStudioTabs.ts` | `src/features/grpc/hooks/grpcStudioTabCommands.ts` | `src/features/websocket/WebSocketStudioPage.tsx` |
| **Persistence** | `src/features/graphql/utils/tabPersistence.ts` (load/save + IDB) | `src/features/grpc/hooks/useGrpcStudioPersistence.ts` | `src/shared/websocket/websocketStorage.ts` |
| **Demo bridges** | `src/features/graphql/utils/gqlDemoWorkspace.ts` | `src/features/grpc/grpcStudioPage/useGrpcStudioPageDemoBridges.ts` | — |
| **Tab selectors** | `src/shared/selectors.ts` (GQL.*) | `src/shared/selectors/grpc.ts` (GRPC.*) | `src/shared/selectors/ws.ts` (WS.CONN_TAB_*) |
| **Reorder util** | — | — | `WsConnectionTabBar.tsx` → `computeDropIndex()` |
| **Duplicate util** | — | `grpcStudioTypes.ts` → `duplicateGrpcStudioTab()` | — |

---

## Appendix A: File Inventory for P1

### New Files

| File | Purpose |
|------|---------|
| `src/features/requests/hooks/useRequestTabs.ts` | Tab CRUD + persistence + lifecycle |
| `src/features/requests/hooks/useRequestTabs.test.ts` | Unit tests |
| `src/features/requests/components/RequestTabBar.tsx` | Tab bar UI |
| `src/features/requests/components/RequestTabBar.test.tsx` | Unit tests |
| `src/features/requests/hooks/useRequestTabPersistence.ts` | Tab persistence (save/load/migrate) |
| `src/features/requests/hooks/useRequestTabPersistence.test.ts` | Unit tests (15 tests) |
| `src/features/requests/hooks/useRequestTabCoordinator.ts` | Coordination hook (tab + persistence + deletion cleanup) |
| `src/features/requests/hooks/useRequestTabCoordinator.test.ts` | Unit tests (6 tests) |

> `packages/demo-hub/src/adapters/requestsAdapter.ts` moved to P5-A.

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/types/requests.ts` | Add `RequestTab`, sub-tab types, `REQUEST_MAX_TABS` |
| `src/shared/selectors/req.ts` | Add `TAB_BAR`, `TAB_ADD`, `TAB_CLOSE`, `TAB_ITEM`, `TAB_LABEL`, `tabById()` |
| `src/features/requests/hooks/useRequests.ts` | Remove selection from `RequestsData`; wire stale tab removal in delete handlers |
| `src/features/requests/hooks/useResponseCache.ts` | Lift Map to module singleton; add `pruneResponseCache()` |
| `src/features/requests/components/RequestEditor.tsx` | Remove 15 local UI states → read from `RequestTab`; accept `onTabUIChange` prop |
| `src/features/requests/components/RequestsSidebar.tsx` | Replace `onSelectRequest` with `onOpenTab`; add open indicators |
| `src/features/requests/Requests.tsx` | Mount `RequestTabBar` + consume `useRequestTabs` |
| `src/app/App.tsx` | Replace `wb.selectRequest` with `wb.openTab` |
| `src/app/components/AppSidebarRegion.tsx` | Replace `onSelectRequest` with `onOpenTab` |
| `src/styles/requests.css` | Add tab bar styles |

### Unchanged (no breaking changes)

| File | Why unchanged |
|------|---------------|
| `src/features/requests/components/BodyEditor.tsx` | No tab awareness needed — reads from `RequestItem` props |
| `src/features/requests/components/RequestAuthEditor.tsx` | Same — props-driven |
| `src/features/requests/components/SidebarContextMenu.tsx` | Add "Open in New Tab" menu item (minimal) |
| `src/shared/utils/idbRequests.ts` | `RequestsData` blob unchanged (selection removed, not schema change) |

## Appendix B: File Inventory for P2

### New Files

| File | Purpose |
|------|---------|
| `src/features/sse/SseConnectionTabBar.tsx` | Tab bar UI (status dots, rename, drag reorder, keyboard nav) |
| `src/features/sse/SseConnectionTabBar.test.tsx` | 19 unit tests |
| `src/features/sse/SseConnectionTabContent.tsx` | Per-tab content wrapper (`useSseConnection` + `useSseConsole` + UI) |
| `src/features/sse/sseStorage.test.ts` | 15 unit tests for tab persistence + migration |

### Modified Files

| File | Changes |
|------|---------|
| `src/features/sse/sseTypes.ts` | Added `SseConnectionTab`, `SsePersistedTabState`, `SSE_MAX_TABS`, `createDefaultSseTab()` |
| `src/features/sse/SseStudioPage.tsx` | Rewritten as tab coordinator (was single-connection page) |
| `src/features/sse/SseStudioPage.test.tsx` | Updated all 65 tests for async tab loading + mocked tab bar |
| `src/features/sse/sseStorage.ts` | Added `loadSseTabState`, `saveSseTabState`, `migrateLegacySseConfig`, `deriveSseTabLabel` |
| `src/shared/selectors/sse.ts` | Added `CONN_TAB_BAR`, `CONN_TAB_ADD`, `CONN_TAB_CLOSE`, `CONN_TAB_ITEM`, `connTabById()` |
| `src/styles/sse-studio.css` | Added tab bar styles (`.sse-conn-tab-*`); close confirm uses shared `ConfirmModal` |
