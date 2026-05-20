# Trash Box — Soft Delete & Recovery Plan

## Overview

When a user deletes a Feature Group, Scenario, or Test from the Feature Groups page, the item is moved to a **Trash Box** instead of being permanently removed. Items in the Trash remain recoverable for a configurable retention period (default: 30 days). After expiry, items are automatically purged on next app load.

This prevents accidental data loss and provides a familiar "recycle bin" experience.

---

## Scope

### Included (Phase 1)

- Feature Groups (entire group + nested scenarios + tests)
- Scenarios (TestScenario + nested tests)
- Tests (individual Scenario items)
- Shared Data Sources (SharedDataSource items, deleted via `useSharedDsCrud.handleDelete`)

### Excluded (Future)

- Workflows (separate storage via `useWorkflows.remove` / `useWorkflowFolders.remove`)
- Environments / Microservices (rarely deleted, cascading FG unassociation only)
- Request Collections / Folders / Requests (separate feature domain, `useRequests.removeCollection` etc.)
- Webhook saved scenarios (separate storage path)
- Test run history (already has its own retention via `pruneOldRuns` / `idbPruneToMax`)
- Catalog entries (separate domain)

### Rationale for Exclusions

- **Workflows**: Stored separately (`saveWorkflows`/`saveWorkflowFolders`). Deletion handled by `useWorkflows.remove()` and `useWorkflowFolders.remove()`. Different restore semantics (folder moves workflows to "Unfiled" on delete, not lost). Phase 2 candidate.
- **Requests**: Stored under `perf-test-requests` key with tree-based storage (`removeFolderDeep`, `removeRequestFrom`). Different data model and confirm patterns (inline `req-confirm-overlay` vs `ConfirmModal`). Phase 2 candidate.
- **Environments / Microservices**: Delete cascades via unassociation (`EnvironmentManager.tsx`), not data loss. Uses two-stage `useConfirmDialog` pattern (warning → final). Low risk.

---

## Data Model

### TrashItem Interface

```typescript
// src/shared/types/index.ts (new addition)

export interface TrashItem {
  id: string;                    // unique trash entry ID (uuid)
  deletedAt: number;             // Date.now() at time of deletion
  expiresAt: number;             // deletedAt + retentionMs
  entityType: 'featureGroup' | 'scenario' | 'test' | 'sharedDataSource';
  entityName: string;            // display name of deleted item
  parentPath: string;            // breadcrumb: "FG Name" or "FG Name > Scenario Name"
  parentFeatureGroupId?: string; // original parent FG id (for scenario/test restore)
  parentScenarioId?: string;     // original parent scenario id (for test restore)
  environmentId?: string;        // original env assignment (for FG restore context)
  microserviceId?: string;       // original svc assignment (for FG restore context)
  childCounts?: {                // nested item summary for display
    scenarios?: number;
    tests?: number;
  };
  data: FeatureGroup | TestScenario | Scenario | SharedDataSource;  // full deep snapshot
}

export interface TrashSettings {
  retentionDays: number;         // default: 30
  maxItems: number;              // default: 100 (prevent unbounded growth)
}
```

### Storage

| Platform | Backend | Key/Store |
|----------|---------|-----------|
| Browser | IndexedDB | New object store: `"trash"`, key: `"all"` |
| Browser fallback | localStorage | Key: `"perf-test-v3-trash"` |
| Tauri (desktop) | Tauri FS | File: `perf-test-v3-trash.json` (via `tauriStore.setItem`/`getItem`) |

Settings stored under key: `"perf-test-v3-trash-settings"`

> **Note:** Tauri FS stores each key as `$APPDATA/{key}.json` via `src/shared/utils/tauriStore.ts`. The trash storage module must follow the same dual-mode pattern used by `saveFeatureGroups()` in `src/shared/utils/storage.ts` (IDB primary → localStorage fallback on web, Tauri FS on desktop).

---

## Architecture

### File Structure

```
src/shared/utils/trashStorage.ts        — CRUD for trash items (load/save/purge)
src/shared/utils/idbTrash.ts            — IndexedDB backend for trash (mirrors idbFeatureGroups.ts pattern)
src/features/scenarios/hooks/useTrash.ts — React hook: state, restore, delete permanently
src/features/scenarios/components/TrashPanel.tsx     — UI: list, restore, delete, empty
src/features/scenarios/components/TrashUndoToast.tsx — 5-second undo toast after deletion
src/styles/trash.css                     — Trash panel + undo toast styles (import in src/styles/index.css)
```

### Key Integration Points

| File | Integration |
|------|-------------|
| `src/shared/utils/idbOpen.ts` | Bump DB_VERSION 3 → 4, add `"trash"` object store |
| `src/shared/types/index.ts` | Add `TrashItem`, `TrashSettings` types |
| `src/features/scenarios/hooks/useScenarioMutations.ts` | Inject `moveToTrash` into `removeFeatureGroup`, `removeScenario`, `removeTest` |
| `src/features/scenarios/hooks/useProjects.ts` | Call `purgeExpired()` in init block, expose `trashCount` in `UseProjectsReturn` |
| `src/features/scenarios/ScenarioBuilder.tsx` | Add Trash button to `header-actions` div, render `TrashUndoToast` |
| `src/features/scenarios/hooks/useSharedDsCrud.ts` | Inject `moveToTrash` into `handleDelete` |
| `src/styles/index.css` | Add `@import './trash.css';` |

### Persistence Flow

```
User clicks Delete
  → ConfirmModal "Move to Trash?" (updated messaging via useScenarioMutations)
    → useScenarioMutations.removeXxx()
      → 1. Deep-clone the item as TrashItem (structuredClone for snapshot safety)
      → 2. Call trashStorage.addToTrash(item)
      → 3. Filter item from featureGroups state (existing setFeatureGroups filter logic)
      → 4. Structure log: logScenarioRemoved/logTestRemoved still fires on the parent FG
           (so FG's structureLog records the deletion even though item goes to trash)
      → 5. Show TrashUndoToast (5s countdown)
         → If user clicks "Undo" → restoreFromTrash(id) → re-insert into featureGroups
         → If timeout → toast disappears, item remains in trash

App loads
  → useProjects init (after migrateToFlat + migratePerFgSharedDataSourcesToTopLevel)
    → trashStorage.purgeExpired() — runs in the Promise.all alongside loadFeatureGroups
    → Returns purge count for optional telemetry
```

### Restore Flow

```
User opens Trash Panel → clicks "Restore"
  → useTrash.restoreItem(trashItemId)
    → 1. Load TrashItem from storage
    → 2. Determine restore target:
         a. If entityType === 'featureGroup':
            → Append to featureGroups array
            → Preserve original microserviceId/environmentId if those env/svc still exist
            → If env/svc was deleted, clear the assignment (becomes unassociated FG)
         b. If entityType === 'scenario':
            → Find parentFeatureGroupId in current featureGroups
            → If found → insert into fg.scenarios
            → If not found → create "Restored Items" FG, insert there
         c. If entityType === 'test':
            → Find parentFeatureGroupId + parentScenarioId
            → If both found → insert into scenario.tests
            → If scenario missing → create "Restored Tests" scenario in the FG
            → If FG missing → create "Restored Items" FG with a new scenario
         d. If entityType === 'sharedDataSource':
            → Append to sharedDataSources array
            → Check for ID collisions (user may have created a new DS with same name)
    → 3. Remove from trash storage
    → 4. Save featureGroups / sharedDataSources (triggers auto-persist via useProjects effects)
    → 5. Log restore in structureLog if applicable
```

### ID Collision Handling

When restoring, check if an item with the same `id` already exists in the current data:
- If collision found → generate a new UUID for the restored item (and all nested children)
- Append " (restored)" to the name to disambiguate
- This handles the edge case where a user deletes an item, imports data that contains the same ID, then restores

---

## Implementation Phases

### Phase 1: Storage Layer (Est. 2 hours)

**Files to create:**
- `src/shared/utils/idbTrash.ts`
- `src/shared/utils/trashStorage.ts`

**Files to modify:**
- `src/shared/utils/idbOpen.ts`
- `src/shared/types/index.ts`
- `src/shared/utils/storage.ts` (add `loadTrash`/`saveTrash` exports to the dual-mode storage barrel)

**Steps:**

1. **Bump IDB version** in `src/shared/utils/idbOpen.ts`:
   - Increment `DB_VERSION` from 3 → 4
   - Add `if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash');` in `onupgradeneeded`
   - **Important:** The existing `onupgradeneeded` handler does not use version checks — it uses `objectStoreNames.contains()` guards. This pattern naturally handles the upgrade from v3 → v4 without breaking existing stores.
   - **Important:** The `onblocked` handler (line 47) deletes and recreates the entire database. After upgrade, `testRuns`, `featureGroups`, `sharedDataSources`, AND `trash` will all be recreated. This is existing behavior and acceptable.

2. **Create `idbTrash.ts`** (mirror `idbFeatureGroups.ts` exactly):
   ```typescript
   const STORE_NAME = 'trash';

   function idbAvailable(): boolean { return typeof indexedDB !== 'undefined'; }
   function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> { ... }
   function wrap<T>(req: IDBRequest<T>): Promise<T> { ... }

   export async function idbLoadTrash(): Promise<TrashItem[] | null>
   export async function idbSaveTrash(items: TrashItem[]): Promise<void>
   ```
   - Reuse exact same `tx()` and `wrap()` helper pattern from `idbFeatureGroups.ts`
   - Same `idbAvailable()` guard and try/catch fallback

3. **Create `trashStorage.ts`**:
   ```typescript
   import { isTauri } from '../../utils/platform';
   import { idbLoadTrash, idbSaveTrash } from './idbTrash';
   import type { TrashItem, TrashSettings } from '../types';

   const TRASH_KEY = 'perf-test-v3-trash';
   const TRASH_SETTINGS_KEY = 'perf-test-v3-trash-settings';
   const DEFAULT_RETENTION_DAYS = 30;
   const DEFAULT_MAX_ITEMS = 100;

   export async function loadTrash(): Promise<TrashItem[]>
   export async function saveTrash(items: TrashItem[]): Promise<void>
   export async function addToTrash(item: TrashItem): Promise<void>
   export async function removeFromTrash(id: string): Promise<void>
   export async function purgeExpired(): Promise<number>  // returns count purged
   export async function emptyTrash(): Promise<void>
   export async function loadTrashSettings(): Promise<TrashSettings>
   export async function saveTrashSettings(settings: TrashSettings): Promise<void>
   ```
   - `addToTrash`: loads existing items, prepends new item, enforces `maxItems` (evict oldest expired first, then oldest by `deletedAt` if still over), saves
   - `purgeExpired`: filters items where `Date.now() > expiresAt`, saves the filtered list, returns count removed
   - Follow the same IDB-primary / localStorage-fallback / Tauri-FS pattern used by `saveFeatureGroups` in `storage.ts` (lines 412–425)
   - Use `saveJsonKey` / `loadJsonKey` from `storage.ts` for localStorage and Tauri paths

4. **Add `TrashItem` and `TrashSettings` types** to `src/shared/types/index.ts`
   - Add after the `FeatureGroup` interface (around line 389)
   - Import `SharedDataSource` in the union type for `data`

5. **Unit tests** — `src/shared/utils/trashStorage.test.ts`:
   - Add to trash, load, purge expired, empty, max items overflow (oldest evicted)
   - Verify `purgeExpired` only removes items past `expiresAt`, not all items
   - Verify `addToTrash` eviction order: expired first, then oldest
   - Settings load/save round-trip
   - Edge case: empty trash when already empty

---

### Phase 2: Hook & Mutation Integration (Est. 2 hours)

**Files to modify:**
- `src/features/scenarios/hooks/useScenarioMutations.ts` — inject `moveToTrash` callback
- `src/features/scenarios/hooks/useProjects.ts` — add `purgeExpired()` to init, expose `trashCount`
- `src/features/scenarios/ScenarioBuilder.tsx` — pass `moveToTrash` to mutations hook

**Files to create:**
- `src/features/scenarios/hooks/useTrash.ts`

**Steps:**

1. **Create `useTrash` hook**:
   ```typescript
   interface UseTrashParams {
     featureGroups: FeatureGroup[];
     setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
     sharedDataSources: SharedDataSource[];
     setSharedDataSources: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
     environments: Environment[];   // for restore env/svc validation
     microservices: Microservice[];
   }

   export function useTrash({ featureGroups, setFeatureGroups, ... }: UseTrashParams) {
     const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
     const [loading, setLoading] = useState(true);
     const [lastDeleted, setLastDeleted] = useState<TrashItem | null>(null);

     // Load trash on mount
     useEffect(() => {
       loadTrash().then(items => { setTrashItems(items); setLoading(false); });
     }, []);

     // moveToTrash(entityType, data, parentPath, parentIds)
     //   → structuredClone the data for snapshot safety
     //   → compute childCounts for display
     //   → addToTrash + update local state + setLastDeleted for toast
     // restoreItem(trashId) — handles all 4 entity types + ID collision check
     // permanentlyDelete(trashId) — removeFromTrash + update local state
     // emptyAllTrash() — emptyTrash + clear local state
     // undoLastDelete() — restore lastDeleted item, clear toast state

     return {
       trashItems, loading, moveToTrash, restoreItem,
       permanentlyDelete, emptyAllTrash, undoLastDelete,
       lastDeleted, clearLastDeleted: () => setLastDeleted(null),
       trashCount: trashItems.length,
     };
   }
   ```

2. **Modify `useScenarioMutations`**:
   - Add `moveToTrash?: (entityType: TrashItem['entityType'], data: TrashItem['data'], entityName: string, parentPath: string, parentIds: { parentFeatureGroupId?: string; parentScenarioId?: string; environmentId?: string; microserviceId?: string }) => void` to `UseScenarioMutationsOpts` interface
   - **Extend `ConfirmDialog` interface** to include optional `confirmLabel?: string` — currently it only has `title`, `message`, `onConfirm`. The `ConfirmModal` in `ScenarioBuilder.tsx` (line 834) hardcodes `confirmLabel="Delete"`. We need to pass a dynamic label from the dialog state so trash can use "Move to Trash".
   - **Update `ScenarioBuilder.tsx`** `ConfirmModal` render (line 829–837): change `confirmLabel="Delete"` → `confirmLabel={confirmDialog.confirmLabel ?? 'Delete'}` to support the new optional field.
   - `removeFeatureGroup` (line 80–92):
     ```
     Before: setConfirmDialog → message "This cannot be undone." → filter
     After:  if (moveToTrash) → setConfirmDialog with message "Move to Trash? You can restore it within 30 days."
             → onConfirm: moveToTrash('featureGroup', fg, ...) → filter
             → confirmLabel: "Move to Trash"
             else → keep existing hard-delete behavior
     ```
   - `removeScenario` (line 119–134):
     ```
     Same pattern. logScenarioRemoved still fires on the parent FG AFTER filter.
     ```
   - `removeTest` (line 309–331):
     ```
     Same pattern. logTestRemoved still fires on the parent FG AFTER filter.
     ```
   - **Fallback**: If `moveToTrash` is not provided (e.g. in tests), keep the hard-delete behavior. This makes the change backward-compatible.

3. **Modify `useProjects`** (`src/features/scenarios/hooks/useProjects.ts`):
   - Add `purgeExpired()` call in the init block (line 74–86) — add to the `Promise.all`:
     ```typescript
     const [envs, svcs, fgs, auth, sharedDs, selEnv, selSvc, maxR, usage, savedTheme, runs, purgedCount] = await Promise.all([
       loadEnvironments(),
       // ... existing calls ...
       purgeExpired(),
     ]);
     ```
   - `purgeExpired` returns a count — log it to console if > 0 for debugging
   - **Do NOT add `useTrash` state to `useProjects`** — keep `useTrash` in `ScenarioBuilder` (co-located with the deletion UI). `useProjects` only handles the one-time purge at startup.

4. **Wire in `ScenarioBuilder`** (line 47+):
   - Call `useTrash({ featureGroups, setFeatureGroups, sharedDataSources, ... })` at component level
   - Pass `moveToTrash` down to `useScenarioMutations` via opts
   - Keep the `confirmDialog` + `ConfirmModal` rendering (lines 829–837) unchanged — only the message text and `confirmLabel` change

5. **Unit tests** — `src/features/scenarios/hooks/useTrash.test.ts`:
   - Move to trash preserves full data snapshot (structuredClone)
   - Restore into existing parent (FG, scenario)
   - Restore when parent is missing (creates fallback container)
   - Restore with ID collision (generates new UUIDs)
   - Undo immediately after delete
   - Shared data source trash + restore
   - `childCounts` populated correctly for FG and scenario items

---

### Phase 3: Undo Toast (Est. 1 hour)

**Files to create:**
- `src/features/scenarios/components/TrashUndoToast.tsx`

**Steps:**

1. **Create `TrashUndoToast` component**:
   - Fixed-position toast at bottom-center of screen
   - Shows: `"<entityName>" moved to Trash` + [Undo] button + countdown bar (5s)
   - Auto-dismisses after 5 seconds
   - Clicking "Undo" calls `undoLastDelete()` and dismisses immediately
   - Stacks if multiple deletes happen quickly (max 3 visible)
   - Uses `useEffect` with `setTimeout` for auto-dismiss — cleanup on unmount

2. **Integrate into `ScenarioBuilder`** (line ~830 area):
   - Render `TrashUndoToast` when `lastDeleted` from `useTrash` is set
   - `onUndo` → calls `undoLastDelete()` → clears `lastDeleted`
   - `onDismiss` → calls `clearLastDeleted()`

3. **Styles** in `src/styles/trash.css`:
   - Slide-up animation (`@keyframes slideUp`)
   - Progress bar countdown (CSS animation or JS-driven width transition)
   - Dark theme consistent with app (`var(--surface-1)`, `var(--text-primary)`, etc.)
   - `z-index` above modals but below dialogs

4. **Unit test** — `src/features/scenarios/components/TrashUndoToast.test.tsx`:
   - Renders entity name
   - Undo button calls handler
   - Auto-dismisses after timeout
   - Multiple toasts stack correctly

---

### Phase 4: Trash Panel UI (Est. 3 hours)

**Files to create:**
- `src/features/scenarios/components/TrashPanel.tsx`
- `src/styles/trash.css` (extend from Phase 3)

**Steps:**

1. **Create `TrashPanel` component**:
   - Use `PopupModal` shell (same as `ConfirmModal` and `SharedDataSourceModal`) — NOT a slide-out panel. Rationale: consistent with existing modals like Shared Data Sources modal, and avoids layout complexity.
   - Header: trash icon + item count + "Empty Trash" button (with confirm)
   - List of trashed items, sorted by `deletedAt` (newest first):
     - Icon by entity type (folder / scenario / test / data source)
     - Entity name (bold)
     - Parent path breadcrumb (muted)
     - `childCounts` display: "3 scenarios · 8 tests" for FGs, "2 tests" for scenarios
     - "Deleted X days ago · Expires in Y days"
     - Action buttons: [Restore] [Delete Forever]
   - Empty state: "Trash is empty" with subtle icon
   - Search/filter by name

2. **Trash button in ScenarioBuilder toolbar** (`header-actions` div, line 293–305):
   - Insert before the "Shared Data Sources" button
   - Show a `count-badge` with trash item count (hidden when 0)
   - Same badge pattern already used by Shared Data Sources button (line 302)
   - Disable button when no env/svc selected? **No** — trash should always be accessible regardless of current env/svc selection (trash is global, not scoped to a service/environment)
   - Style: ghost/outline button with trash icon, not btn-primary

3. **Restore confirmation**:
   - If parent exists → restore silently, show success toast
   - If parent missing → show info: "Original location no longer exists. Item will be restored to a new 'Restored Items' group."
   - If env/svc of a restored FG no longer exists → restore as unassociated FG

4. **Permanent delete confirmation**:
   - ConfirmModal (reuse existing): "Permanently delete '<name>'? This cannot be undone."

5. **Empty Trash confirmation**:
   - ConfirmModal: "Permanently delete all N items? This cannot be undone."

6. **Unit test** — `src/features/scenarios/components/TrashPanel.test.tsx`:
   - Renders item list
   - Search filters items
   - Restore button calls handler
   - Delete Forever button shows confirm
   - Empty Trash button shows confirm
   - Empty state when no items

---

### Phase 5: Settings & Polish (Est. 1.5 hours) — COMPLETED

**Steps:**

1. **Add trash settings to Trash Panel footer** (not a separate settings page):
   - Retention period: dropdown (7 / 14 / 30 / 60 / 90 days)
   - Max items: dropdown (50 / 100 / 200)
   - "Items are automatically deleted after the retention period"
   - Settings persisted via `trashStorage.saveTrashSettings()`

2. **Update confirm dialog wording** (already covered in Phase 2, but verify):
   - Old: `Delete feature group "${fg?.name}"?${detail} This cannot be undone.` (line 86)
   - New: `Move feature group "${fg?.name}" to Trash?${detail} You can restore it within 30 days.`
   - Old: `confirmLabel: "Delete"` → New: `confirmLabel: "Move to Trash"`
   - Apply same pattern to `removeScenario` (line 126) and `removeTest` (line 315)

3. **Handle edge cases**:
   - **FG delete with nested items already in trash**: When deleting a FG, check if any of its scenarios/tests are already individually trashed. Remove those individual trash entries to prevent duplicates (the FG trash entry contains the complete snapshot).
   - **Restoring a scenario whose parent FG is also in trash**: Show a message offering to restore the FG first, or restore into "Restored Items" FG.
   - **Max items overflow**: When `addToTrash` and at capacity:
     1. Purge expired items first
     2. If still over limit, evict oldest item (lowest `deletedAt`)
     3. Then add the new item
   - **Shared Data Source restore with active references**: If the original DS was deleted because it was unused, but tests have since been modified to reference the ID — check for ID collision and handle gracefully.
   - **Storage size**: IndexedDB has no practical limit. localStorage has ~5MB — if trash + featureGroups approach this limit, `addToTrash` should try IDB first (same fallback pattern as `saveFeatureGroups`). Tauri FS has no practical limit.

4. **Accessibility**:
   - ARIA labels on all trash panel buttons (`aria-label="Restore item"`, `aria-label="Delete permanently"`)
   - Focus management: focus first item when panel opens, return focus to trigger button on close
   - Screen reader announcements for undo toast (`role="alert"`, `aria-live="assertive"`)

5. **Structure log entries for trash operations**:
   - `logScenarioRemoved` and `logTestRemoved` already fire during deletion (existing behavior preserved)
   - Add a new `logItemRestored` entry type to `structureChangeLog.ts` for audit trail on restore
   - New `StructureChangeEntry.action` value: `'restored'`

**Implementation Status — Phase 5:**

| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Added `'restored'` to `StructureChangeAction` union |
| `src/features/scenarios/utils/structureChangeLog.ts` | Added `logItemRestored()`, updated `actionLabel('restored')` → `'Restored from trash'`, `actionIcon('restored')` → `↩` (U+21A9), `actionClass('restored')` → `'added'` |
| `src/features/scenarios/hooks/useTrash.ts` | Added `trashSettings` state + `settingsRef` + `updateTrashSettings` callback; exposed via `UseTrashReturn`; `moveToTrash` reads settings from ref (no async call); `useEffect` init loads both trash + settings with per-promise catch fallbacks; restore helpers call `logItemRestored` on parent FGs |
| `src/features/scenarios/components/TrashPanel.tsx` | Added `trashSettings`/`onUpdateSettings` props; footer now has retention + max items dropdowns + Empty Trash button; removed Empty Trash from header |
| `src/features/scenarios/ScenarioBuilder.tsx` | Passes `trash.trashSettings` + `trash.updateTrashSettings` to `TrashPanel` |
| `src/styles/trash.css` | Added `.trash-panel-settings`, `.trash-panel-setting-label`, `.trash-panel-setting-select`, `.trash-panel-empty-footer-btn` styles; removed unused `.trash-panel-empty-btn` |
| `src/features/scenarios/utils/structureChangeLog.test.ts` | Added 5 tests for `logItemRestored` + `'restored'` action in display helpers; added `'restored'` to exhaustive label coverage test |
| `src/features/scenarios/components/TrashPanel.test.tsx` | Refactored to use `renderPanel` helper; added 4 settings UI tests (retention value, max items value, retention change, max items change) |
| `src/features/scenarios/hooks/useTrash.test.ts` | Added `mockSaveSettings` mock + `logItemRestored` mock; reset in `beforeEach`; added 5 settings tests (load, defaults, persist, failure resilience, expiry calculation) |

**Bugs Found & Fixed (Phase 5):**

1. **Promise.all failure propagation** — `useEffect` init used `Promise.all([loadTrash(), loadTrashSettings()])` with a single `.catch()`. If `loadTrashSettings()` threw, `Promise.all` rejected immediately and discarded successfully-loaded trash items. Fixed by giving each promise its own `.catch()` fallback.
2. **Dead CSS** — `.trash-panel-empty-btn` styles were orphaned after moving Empty Trash from header to footer. Removed.
3. **Test mock reset gap** — `beforeEach` called `vi.clearAllMocks()` without re-initializing `mockLoadSettings`, causing settings-dependent tests to hang on `loading=true`. Fixed by re-initializing both `mockLoadSettings` and `mockSaveSettings` in `beforeEach`.
4. **`restoreItem` storage failure leaves inconsistent state** — If `storageRemoveFromTrash()` threw, the state update (`setTrashItems`) never executed, but the item was already restored to FGs. Fixed: UI state updated first, storage wrapped in `try/catch`.
5. **`permanentlyDelete` storage failure skips state update** — Same pattern as #4. Fixed: UI state first, storage in `try/catch`.
6. **`emptyAllTrash` storage failure skips state update** — Same pattern as #4. Fixed: UI state first, storage in `try/catch`.
7. **`updateTrashSettings` race condition** — eagerly update `settingsRef.current` before `setTrashSettings` so rapid sequential calls always merge from the latest value.

---

### Phase 6: Testing (Est. 2 hours) — COMPLETED

**Implementation Status — Phase 6:**

| Test File | Tests Added | What It Covers |
|-----------|-------------|----------------|
| `src/shared/utils/trashStorage.test.ts` | +4 (→ 21 total) | IDB-primary load/save success paths, IDB→localStorage fallback on throw, IDB save with no localStorage write |
| `src/shared/utils/idbTrash.test.ts` | +2 (→ 7 total) | `openDB()` rejection paths for both `idbLoadTrash` and `idbSaveTrash` |
| `src/features/scenarios/hooks/useTrash.test.ts` | +10 (→ 26 total) | Restore test (3 branches: parent+SC, parent-only, fully orphan), test ID collision, unknown trashId no-op, undo no-op when null, env/svc invalidation, storage error resilience, settings load failure |
| `src/features/scenarios/hooks/useScenarioMutations.test.ts` | +8 (→ 65 total) | Trash dialog titles, confirmLabels, messages, moveToTrash callback args for all 3 entity types (FG, scenario, test), state removal after confirm, dialog cleanup |
| `src/features/scenarios/components/TrashPanel.test.tsx` | +8 (→ 29 total) | formatExpiry (expired, singular, plural), formatChildCounts (singular, absent), cancel flows (delete, empty trash), singular empty-trash message |
| `src/features/scenarios/components/TrashUndoToast.test.tsx` | 0 (11 total) | Already strong coverage — no gaps found |
| `src/features/scenarios/utils/structureChangeLog.test.ts` | 0 (46 total) | Already covers `logItemRestored` + `'restored'` in all display helpers |

**Total test count:** 196 tests across 7 trash-related files, all passing.

**Bugs Found & Fixed (Phase 6):**

1. **`restoreScenario` orphan path — missing ID collision check** — When the parent FG was not found, the scenario was placed into a new "Restored Items" FG without calling `ensureUniqueScenarioIds`. Scenario IDs could collide with existing ones (affecting `expandedScenarios` Set globally). Fixed: now calls `ensureUniqueScenarioIds(scenario, allExistingScs)` before placing into the new FG.
2. **`restoreScenario` orphan path — missing `logItemRestored`** — When creating a new "Restored Items" FG for an orphan scenario, `logItemRestored` was not called. The structure change log missed this restoration event. Fixed: now wraps with `logItemRestored(restoredFg, restored.name)`.
3. **`restoreTest` orphan paths — missing test ID collision check** — When restoring a test into a new scenario (parent FG present, parent SC missing) or a fully new FG (both missing), the test ID was not checked for collisions. Fixed: both paths now check against all existing test IDs and generate a new UUID on collision.
4. **`restoreTest` fully orphan path — missing `logItemRestored`** — Same pattern as bug #2. When creating a new FG+SC for a fully orphan test, `logItemRestored` was not called. Fixed: now wraps with `logItemRestored`.

**Integration considerations (verified):**
- IDB primary path tested via per-test mock overrides in `trashStorage.test.ts`
- IDB `openDB()` rejection tested in `idbTrash.test.ts`
- localStorage fallback explicitly tested when IDB throws
- `purgeExpired()` call site in `useProjects` is an integration concern (no unit test file exists for `useProjects`); the function itself is well-tested in `trashStorage.test.ts`
- Export/import (`useScenarioExportImport`) does not include trash items — trash uses a separate storage key (`perf-test-v3-trash`) and IDB store (`trash`)

---

## UI/UX Reference

### Trash Panel Layout (PopupModal)

```
┌─────────────────────────────────────────────────────────┐
│  Trash (3)                                         [×]  │
├─────────────────────────────────────────────────────────┤
│  🔍 Search trash...                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Feature Group ──────────────────────────────────┐   │
│  │  📁 Payment Integration Tests                    │   │
│  │  3 scenarios · 8 tests                           │   │
│  │  Deleted 2 days ago · Expires in 28 days         │   │
│  │                          [Restore] [Delete]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Scenario ───────────────────────────────────────┐   │
│  │  📋 Login Flow                                   │   │
│  │  in: Auth Feature                                │   │
│  │  2 tests                                         │   │
│  │  Deleted 5 hours ago · Expires in 30 days        │   │
│  │                          [Restore] [Delete]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Test ───────────────────────────────────────────┐   │
│  │  🔗 GET /api/users                               │   │
│  │  in: User Feature > CRUD Operations              │   │
│  │  Deleted 1 hour ago · Expires in 30 days         │   │
│  │                          [Restore] [Delete]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Shared Data Source ─────────────────────────────┐   │
│  │  📦 User Credentials CSV                        │   │
│  │  Deleted 3 days ago · Expires in 27 days         │   │
│  │                          [Restore] [Delete]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Retention: [30 days ▼]  Max items: [100 ▼]            │
│                                      [Empty Trash]      │
└─────────────────────────────────────────────────────────┘
```

### Undo Toast

```
┌────────────────────────────────────────────┐
│  "Login Flow" moved to Trash    [Undo]     │
│  ████████████░░░░░░░░░░░  3s remaining     │
└────────────────────────────────────────────┘
```

### Trash Button in Toolbar

```
[Import] [Export] [Import Template] [🗑 Trash (3)] [📦 Shared Data Sources (2)] [+ Add Feature Group]
```

---

## Migration & Compatibility

- **No data migration needed** — trash is a new, additive store
- **IDB version bump** (3 → 4) triggers `onupgradeneeded` which creates the new `"trash"` object store alongside existing stores. The existing `objectStoreNames.contains()` guards ensure old stores are not recreated.
- **Backward compatible** — old versions without trash simply don't have the store; upgrading creates it transparently
- **`onblocked` handler** — existing behavior (line 47–53 of `idbOpen.ts`) deletes and recreates the entire DB. This means if another tab has the old DB version open, the blocked handler will recreate all stores including the new `trash` store. Acceptable behavior.
- **Export/Import** — trash items are NOT included in JSON/CSV exports (only active data is exported). `wrapExport` in `scenarioImportExport.ts` only serializes the `featureGroups` array, so trash is naturally excluded.
- **`getStorageUsage`** — the `getUsageBytes` function in `tauriStore.ts` scans `perf-test*` keys. The trash key (`perf-test-v3-trash`) will be included automatically. For web, localStorage usage calculation should also account for the trash key.

---

### Cross-Phase Code Review (Post Phase 6) — COMPLETED

Full re-review of all Phases 1–6 source files, test files, types, CSS, and integration points.

**Bug Found & Fixed:**

1. **`moveToTrash` does not enforce `maxItems` in UI state** — `setTrashItems(prev => [item, ...prev])` always prepended without checking the max. Storage-side `addToTrash` calls `enforceMaxItems`, but the UI state could exceed `maxItems` until the next page load. Fixed: `setTrashItems` updater now slices to `maxItems` after prepend.

**Items Verified (no issues):**
- `TrashItem`/`TrashSettings`/`TrashEntityType` types — complete and consistent
- `trashStorage.ts` — dual-mode (IDB/localStorage/Tauri) correct; `enforceMaxItems` splice ordering verified (descending indices, safe)
- `idbTrash.ts` — `idbAvailable` guard, `openDB` error handling, `wrap()` promise pattern correct
- `idbOpen.ts` — DB_VERSION 4, `trash` store creation with `contains()` guard
- `useScenarioMutations.ts` — all 3 entity types (FG, scenario, test) wire `moveToTrash` correctly with proper `parentIds`
- `TrashPanel.tsx` — formatters, search, cancel flows, settings dropdowns, accessibility attributes
- `TrashUndoToast.tsx` — timer lifecycle, `onDismissRef` pattern, progress bar `key={item.id}`
- `ScenarioBuilder.tsx` — `useTrash` params (environments, microservices with `?? []`), `moveToTrash` prop pass
- `structureChangeLog.ts` — `logItemRestored`, `actionLabel`/`actionIcon`/`actionClass` for `'restored'`
- `useProjects.ts` — `purgeExpired()` in `Promise.all` init, log on purge
- `trash.css` — hover, focus-visible, disabled states, animation keyframes

**Test count:** 197 tests across 7 files, all passing. `tsc -b --noEmit`: 0 errors. Lint: 0 errors.

### Cross-Phase Code Review Round 2 (Post Phase 6) — COMPLETED

Second full re-review of all Phases 1–6 source files, test files, types, CSS, and integration points.

**Bug Found & Fixed:**

1. **`useScenarioMutations.ts` `moveToTrash` type missing `SharedDataSource`** — The `data` parameter was typed as `FeatureGroup | TestScenario | Scenario`, omitting `SharedDataSource` from the union. While the mutations hook doesn't call `moveToTrash` with `'sharedDataSource'` entity type, the type was inconsistent with `MoveToTrashFn` in `useTrash.ts` which includes `SharedDataSource`. Fixed: added `SharedDataSource` to the union and imported the type.

**Items Re-Verified (no issues):**
- `enforceMaxItems` splice ordering: re-traced descending-index strategy — safe and correct
- `undoLastDelete` timing: `trashRef.current` synced via render, undo click requires re-render first — safe
- `addToTrash` storage error path: item remains in UI state but not storage; `removeFromTrash` no-ops gracefully — correct
- `ensureUniqueIds`/`ensureUniqueScenarioIds`: all nested ID collision checks verified — FG, scenario, and test levels
- `restoreFeatureGroup` env/svc invalidation: spread of `false` is no-op, spread of `{environmentId: undefined}` clears — correct
- `computeChildCounts`: `0` returns falsy for `formatChildCounts` — correctly omits "0 scenarios/tests"
- `useProjects.ts` `Promise.all` destructuring: `purgedCount` at index 11 matches position — verified
- `ScenarioBuilder.tsx`: `useTrash` params, `useScenarioMutations` moveToTrash pass, TrashPanel/TrashUndoToast rendering — correct
- All 11 source files, 7 test files, CSS — no additional issues found

**Test count:** 197 tests across 7 files, all passing. `tsc -b --noEmit`: 0 errors.

---

## Phase 7: Documentation, Guides & Gallery Content (Est. 3 hours)

Once the Trash Box feature is implemented, we need to provide user-facing documentation, a training manual, and a gallery sample so users can discover and learn the feature through the existing Gallery infrastructure.

### 7.1 User Guide — `docs/guides/trash-box-guide.md`

Create a markdown guide covering:

- What the Trash Box is and how it works
- How to recover deleted items (Undo Toast + Trash Panel)
- How to permanently delete items from Trash
- How to empty the Trash
- Retention period and automatic purge behavior
- Settings (configurable retention period)
- Tips: "If you accidentally delete something, click Undo within 5 seconds for instant recovery"

**File**: `docs/guides/trash-box-guide.md`
**Update**: Add entry to `docs/guides/README.md` under the appropriate section

### 7.2 Training Manual — `docs/training-manuals/tests/trash-recovery-easy.html`

Create a step-by-step HTML training manual:

1. **Lesson title**: "Recovering Deleted Scenarios"
2. **Difficulty**: easy
3. **Steps covered**:
   - Creating a feature group with scenarios
   - Accidentally deleting a scenario
   - Using the Undo toast to recover immediately
   - Opening the Trash Panel to browse deleted items
   - Restoring an item from Trash
   - Permanently deleting items
   - Configuring retention period
4. **Format**: Self-contained HTML with RedfireForge branding (follow existing manual template)

**File**: `docs/training-manuals/tests/trash-recovery-easy.html`

### 7.3 Training Path Entry

Add the manual to the **Tests content path** in `src/data/galleries/trainingPaths/contentPaths.ts`:

```typescript
// In the "Tests" training path, add a new manual entry:
{
  title: 'Recovering Deleted Scenarios',
  description: 'Learn how to use the Trash Box to recover accidentally deleted Feature Groups, Scenarios, and Tests',
  difficulty: 'easy',
  manualPath: 'tests/trash-recovery-easy.html',
}
```

Register in `src/data/galleries/trainingPaths/manualMetadata.ts`:
```typescript
{ manualPath: 'tests/trash-recovery-easy.html', addedAt: date('2026-XX-XX') }
```

### 7.4 Gallery Sample — Trash Recovery Demo

Create a test gallery sample that demonstrates the Trash feature:

**File**: Add to `src/data/galleries/tests/presets.ts`

```typescript
export function createTrashRecoverySample(): FeatureGroup {
  return {
    id: 'gallery-trash-demo',
    name: 'Trash Box — Recovery Demo',
    scenarios: [
      {
        id: 'sc-demo-1',
        name: 'Sample Scenario (delete me!)',
        kind: 'standard',
        tests: [
          // A simple GET request that users can safely delete and recover
          { /* GET https://jsonplaceholder.typicode.com/posts/1 */ }
        ],
      },
      {
        id: 'sc-demo-2',
        name: 'Another Scenario (try deleting this too)',
        kind: 'standard',
        tests: [
          // A simple GET request that users can safely delete and recover
          { /* GET https://jsonplaceholder.typicode.com/users/1 */ }
        ],
      },
    ],
  };
}
```

**Entry** in `src/data/galleries/tests/index.ts`:
```typescript
{
  id: 'test-trash-recovery-demo',
  domain: 'tests',
  name: 'Trash Box — Recovery Demo',
  description: 'Practice deleting and recovering scenarios using the Trash Box feature',
  icon: '🗑️',
  category: 'utility',
  difficulty: 'easy',
  tags: ['trash', 'recovery', 'undo', 'safety'],
  liveApis: ['jsonplaceholder.typicode.com'],
  scenarioCount: 2,
  assertionTypes: [],
  factory: createTrashRecoverySample,
}
```

Link the gallery sample to the training manual via `sampleId: 'test-trash-recovery-demo'` in the training path entry.

### 7.5 Update Existing Guides

Update `docs/guides/scenarios-guide.md` to mention the Trash feature:
- In the "Deleting Scenarios" section, add a note: "Deleted items are moved to Trash and can be recovered within 30 days"
- Add a cross-reference link to `trash-box-guide.md`

### 7.6 Tests for Gallery Content

- Add the new sample to existing gallery test files (`src/data/galleries/tests/tests.test.ts`)
- Verify factory produces valid `FeatureGroup`
- Update `trainingPaths.test.ts` manual count expectations

---

## Phase 8: Update Project Conventions (Est. 30 min)

After implementation, update `.cursor/rules/project-conventions.mdc`:

1. **Key Files table**: Add entries for:
   - `src/shared/utils/trashStorage.ts` — Trash item CRUD + purge logic
   - `src/shared/utils/idbTrash.ts` — IndexedDB backend for trash
   - `src/features/scenarios/hooks/useTrash.ts` — Trash state management hook
   - `src/features/scenarios/components/TrashPanel.tsx` — Trash panel modal UI
   - `src/features/scenarios/components/TrashUndoToast.tsx` — Undo toast after deletion
   - `src/styles/trash.css` — Trash panel + undo toast styles

2. **CHANGELOG.md**: Add entry under `[Unreleased]` → `Added`:
   - Trash Box: soft-delete with 30-day retention for Feature Groups, Scenarios, Tests, and Shared Data Sources
   - Undo toast with 5-second recovery window after deletion
   - Trash Panel: browse, search, restore, and permanently delete trashed items
   - Configurable retention period and max items

3. **README.md**: Add brief mention in feature list

---

## Implementation Status

### Round 1 — Phase 1 (Storage Layer) + Phase 2 (Hook & Mutation Integration): COMPLETED

**Implemented on branch:** `feature/trash-box-soft-delete`

#### Phase 1 — Files Created / Modified

| File | Action | Status |
|------|--------|--------|
| `src/shared/types/index.ts` | Added `TrashEntityType`, `TrashItem`, `TrashSettings` | Done |
| `src/shared/utils/idbOpen.ts` | Bumped `DB_VERSION` 3 → 4, added `trash` object store | Done |
| `src/shared/utils/idbTrash.ts` | **Created** — IDB backend mirroring `idbFeatureGroups.ts` | Done |
| `src/shared/utils/trashStorage.ts` | **Created** — Dual-mode CRUD (IDB/localStorage/Tauri FS) | Done |
| `src/shared/utils/idbTrash.test.ts` | **Created** — 5 tests (load, save, error handling) | Done |
| `src/shared/utils/trashStorage.test.ts` | **Created** — 22 tests (CRUD, eviction, purge, settings) | Done |

#### Phase 2 — Files Created / Modified

| File | Action | Status |
|------|--------|--------|
| `src/features/scenarios/hooks/useTrash.ts` | **Created** — React hook with full restore logic | Done |
| `src/features/scenarios/hooks/useScenarioMutations.ts` | Extended `ConfirmDialog` with `confirmLabel`, added `moveToTrash` injection | Done |
| `src/features/scenarios/hooks/useProjects.ts` | Added `purgeExpired()` to init `Promise.all` | Done |
| `src/features/scenarios/ScenarioBuilder.tsx` | Wired `useTrash`, passed `moveToTrash` to mutations, updated `ConfirmModal` label | Done |
| `src/features/scenarios/hooks/useTrash.test.ts` | **Created** — 12 tests (all entity types, undo, childCounts, collision) | Done |

**Deviation from plan:** `storage.ts` barrel exports were NOT modified — `trashStorage.ts` is imported directly where needed, following the same pattern as `idbTrash.ts`. The plan mentioned adding to the storage barrel, but this was unnecessary since `trashStorage.ts` has its own clean API surface.

#### Bugs Found & Fixed During Code Review (Rounds 2–5)

| Round | Bug | Severity | Fix |
|-------|-----|----------|-----|
| 2 | **Stale state in restore helpers** — All 4 restore functions (`restoreFeatureGroup`, `restoreScenario`, `restoreTest`, `restoreSharedDataSource`) looked up parent items from `ref.current` outside the `setFgs/setDs` updater, creating a race condition where concurrent state updates could cause silent data loss | High | Moved all parent lookups and collision checks inside `setFgs(prev => { ... })` / `setDs(prev => { ... })` updater functions |
| 2 | **`restoreFeatureGroup` only cleared one of env/svc** — Sequential `if/return` branches meant if both `environmentId` and `microserviceId` were stale, only the first was cleared | Medium | Check both independently and clear both when needed |
| 3 | **`moveToTrash` silent data loss on storage failure** — `storageAddToTrash` was awaited before updating React state. If storage threw (quota exceeded, IDB corruption), the item was removed from main state but never added to trash state — total data loss | High | Update UI state first (`setTrashItems`, `setLastDeleted`) before attempting async persistence; wrap `storageAddToTrash` in try/catch |
| 3 | **`loadTrashSettings` failure blocked entire moveToTrash** — If settings load failed, the entire trash operation would silently abort | Medium | Wrap `loadTrashSettings` in try/catch with fallback to default 30-day retention |
| 4 | **Missing `.catch()` on `loadTrash()` in useEffect** — If `loadTrash` unexpectedly threw, `loading` would stay `true` forever, freezing the UI | Low | Added `.catch(() => { setLoading(false); })` |
| 4 | **Dead code cleanup** — After Round 2's fix, `fgRef`, `dsRef`, and `_currentFgs`/`_currentDs` parameters became unused dead code | Code quality | Removed refs and unused parameters; simplified function signatures and call sites |

#### Test Coverage Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `idbTrash.test.ts` | 5 | All pass |
| `trashStorage.test.ts` | 22 | All pass |
| `useTrash.test.ts` | 12 | All pass |
| **Total** | **34** | **All pass** |

#### Verification

- `npx tsc -b --noEmit` — 0 errors
- `npx vitest run` (scoped) — 34/34 tests pass
- 0 lint errors across all new/modified files

### Round 2 — Phase 3 (Undo Toast): COMPLETED

#### Phase 3 — Files Created / Modified

| File | Action | Status |
|------|--------|--------|
| `src/features/scenarios/components/TrashUndoToast.tsx` | **Created** — Portaled toast with 5s auto-dismiss, Undo/Dismiss buttons, countdown bar | Done |
| `src/styles/trash.css` | **Created** — Toast container, slide-up animation, countdown shrink bar, icon badge | Done |
| `src/styles/index.css` | Added `@import './trash.css';` | Done |
| `src/features/scenarios/ScenarioBuilder.tsx` | Added `TrashUndoToast` import and render when `trash.lastDeleted` is set | Done |
| `src/features/scenarios/components/TrashUndoToast.test.tsx` | **Created** — 11 tests (render, undo, dismiss, auto-dismiss, timer reset, portal, unmount cleanup) | Done |

#### Design Decisions

- **Did NOT reuse `useToast()`** — existing `WorkflowToastProvider` has no action button API and is typed for informational toasts only. A dedicated component was needed for the Undo button + countdown bar.
- **Portal to `document.body`** — like `WorkflowToastProvider`, escapes stacking contexts to avoid z-index clipping inside `.page`.
- **z-index: 9999** — matches existing `wf-toast-stack`, sits below scenario modals (10080+). Correct since `ConfirmModal` closes before the toast appears.
- **Single `lastDeleted` (not stacking)** — the `useTrash` hook only tracks one `lastDeleted: TrashItem | null`. Rapid deletes overwrite the previous one. Stacking would require hook changes (e.g. `deletedQueue: TrashItem[]`). Deferred to Phase 5 if needed.
- **Used `onDismissRef`** — avoids stale closure issue where `useEffect` timer would capture an outdated `onDismiss` callback. Ref always points to the latest callback.
- **`key={item.id}` on progress bar** — forces DOM remount when item changes, restarting the CSS animation. Without this, the shrinking progress bar would freeze at its current position when a new item replaces the old one.
- **Icon: `−` (U+2212)** instead of emoji `🗑` — follows project convention "avoid emoji-first labels; use symbols and structured typography." Rendered in a circular danger-colored badge.

#### Bugs Found & Fixed During Code Review

| Round | Bug | Severity | Fix |
|-------|-----|----------|-----|
| 1 | **Fragile timer lifecycle** — `startTimer` useCallback depended on `onDismiss` prop identity. If prop identity changed, the timer would restart, resetting the countdown unexpectedly | Medium | Replaced `useCallback`+`startTimer` pattern with `onDismissRef` (ref always points to latest callback) and a direct `useEffect` that fires once per `item.id` |
| 1 | **Text overflow not working** — `.trash-toast-message` was a `<span>` (inline) with `text-overflow: ellipsis`, which requires block-level display to truncate | Low | Added `display: block` to `.trash-toast-message` |
| 1 | **Emoji icon violated conventions** — Used 🗑 emoji as icon, which violates "avoid emoji-first labels" project convention | Low | Replaced with `−` (U+2212, minus sign) in a circular danger-colored badge |
| 2 | **Timer not resetting on rapid deletes** — `useEffect` had `[]` dependency, so deleting item B while item A's toast was showing didn't restart the 5s timer. Item B would only get the remaining time from item A's timer | Medium | Changed dependency to `[item.id]` so timer resets when the deleted item changes |
| 3 | **Progress bar CSS animation not restarting** — When `item.id` changed, React reused the same DOM node, so the CSS `animation` property didn't re-trigger. The progress bar would freeze at its shrunk position | Low | Added `key={item.id}` to the progress bar div to force DOM remount and CSS animation restart |

#### Test Coverage Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `TrashUndoToast.test.tsx` | 11 | All pass |

#### Verification

- `npx tsc -b --noEmit` — 0 errors
- `npx vitest run` (scoped) — 11/11 tests pass
- 0 lint errors

### Round 3 — Phase 4 (Trash Panel UI): COMPLETED

#### Phase 4 — Files Created / Modified

| File | Action | Status |
|------|--------|--------|
| `src/features/scenarios/components/TrashPanel.tsx` | **Created** — PopupModal with search, list, restore/delete actions, ConfirmModal for delete + empty | Done |
| `src/styles/trash.css` | **Extended** — Panel modal, search, list, item cards, actions, empty state styles | Done |
| `src/features/scenarios/ScenarioBuilder.tsx` | Added `TrashPanel` import, `showTrashPanel` state, Trash toolbar button with badge, TrashPanel render | Done |
| `src/features/scenarios/components/TrashPanel.test.tsx` | **Created** — 18 tests (render, search, filter, restore, delete confirm, empty trash confirm, loading, empty state, close, list roles) | Done |

#### Design Decisions

- **PopupModal** — not `AppModalFrame`. Consistent with `ConfirmModal` and `FromSharedDsPickerModal` for a focused modal experience. Used `dialogClassName="trash-panel-modal"` with `max-width: 560px` for wider list.
- **Trash button always enabled** — per plan, trash is global and not scoped to env/svc selection. Placed before Shared Data Sources button.
- **Badge pattern** — reuses existing `.count-badge` CSS class, hidden when count is 0.
- **Entity icons** — emoji characters matching existing patterns (`📦` for Shared DS already used in toolbar).
- **Time formatting** — reuses `formatRelativeTime` + `formatTimestamp` from existing utility. Custom `formatExpiry` for countdown-to-expiry display.
- **ConfirmModal stacking** — permanent delete and empty trash confirmations render as sibling `ConfirmModal` components outside the `PopupModal`, allowing proper z-index stacking.

#### Bugs Found & Fixed During Code Review

| Round | Bug | Severity | Fix |
|-------|-----|----------|-----|
| 1 | **JSX text content `\u2026` not processed** — `Loading trash\u2026` in JSX text renders literal backslash sequence, not ellipsis | Low | Changed to `Loading trash{'\u2026'}` (JSX expression) |
| 1 | **`formatChildCounts` called twice** — once for condition check, once for rendering, creating redundant array/join operations | Low | Extracted to `const counts` variable in map callback |

#### Test Coverage Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `TrashPanel.test.tsx` | 18 | All pass |

#### Verification

- `npx tsc -b --noEmit` — 0 errors
- `npx vitest run` (scoped) — 18/18 tests pass
- 0 lint errors

### Round 4 — Phase 5 (Settings & Polish): COMPLETED

Phase 5 integrated configurable retention/maxItems settings into the Trash Panel UI and polished behavior. Implemented earlier — see cross-phase review notes above.

### Round 5 — Phase 6 (Full Testing): COMPLETED

Phase 6 expanded test coverage across all Trash components and hooks. 197 tests across 7 files, all passing. Multiple cross-phase code review rounds found and fixed bugs including `maxItems` UI enforcement, `SharedDataSource` type union consistency, orphan restore ID collision checks, and missing `logItemRestored` calls.

### Round 6 — Phase 7 (Documentation, Guides & Gallery Content): COMPLETED

#### Phase 7 — Files Created / Modified

| File | Action | Status |
|------|--------|--------|
| `docs/guides/trash-box-guide.md` | **Created** — User guide covering overview, undo toast, trash panel, settings, storage, tips | Done |
| `docs/guides/README.md` | Added Trash Box Guide entry under Scenarios & Testing | Done |
| `docs/training-manuals/tests/trash-recovery-easy.html` | **Created** — Step-by-step HTML training manual (8 steps + 4 exercises) | Done |
| `src/data/galleries/trainingPaths/contentPaths.ts` | Added manual entry to Tests path Phase 1 with `sampleId: 'test-trash-recovery-demo'` | Done |
| `src/data/galleries/trainingPaths/manualMetadata.ts` | Added metadata entry with `addedAt: date('2026-05-20')` | Done |
| `src/data/galleries/tests/presets.ts` | Added `createTrashRecoveryDemo()` factory — 2 scenarios hitting JSONPlaceholder | Done |
| `src/data/galleries/tests/index.ts` | Added catalog entry `test-trash-recovery-demo` (easy, smoke, 2 scenarios) | Done |
| `src/data/galleries/tests/tests.test.ts` | Updated entry count expectation 20 → 21 | Done |
| `src/data/galleries/trainingPaths/trainingPaths.test.ts` | Updated manual count expectation 34 → 35 | Done |

#### Cross-Reference Verification

| Artifact | ID/Path | Consistent |
|----------|---------|------------|
| Gallery catalog `id` | `test-trash-recovery-demo` | ✓ |
| Factory `FeatureGroup.id` | `test-trash-recovery-demo` | ✓ |
| Training path `sampleId` | `test-trash-recovery-demo` | ✓ |
| Manual file | `docs/training-manuals/tests/trash-recovery-easy.html` | ✓ |
| Metadata `manualPath` | `tests/trash-recovery-easy.html` | ✓ |
| `scenarioCount: 2` | Factory has 2 `ts()` calls | ✓ |
| `assertionTypes` | `['status', 'arrayLength', 'regex']` | ✓ |

#### Verification

- `npx tsc -b --noEmit` — 0 errors
- `npx vitest run` (gallery + training path tests) — 95/95 tests pass
- 0 lint errors

### Round 7 — Phase 8 (Project Conventions Update): COMPLETED

#### Phase 8 — Files Modified

| File | Action | Status |
|------|--------|--------|
| `.cursor/rules/project-conventions.mdc` | Added 6 Trash Box entries to Key Files table | Done |
| `CHANGELOG.md` | Added Trash Box entry under `[Unreleased]` → `Added` (10 bullet points) | Done |
| `README.md` | Added Trash Box to Feature Reference table, `trash` IDB store to Data Persistence, updated DB version 3 → 4 | Done |

#### Verification

- `npx tsc -b --noEmit` — 0 errors
- All cross-references verified (DB_VERSION = 4 matches README, trash store matches idbOpen.ts)

---

## Estimated Total Effort

| Phase | Effort | Status |
|-------|--------|--------|
| 1. Storage Layer | 2 hours | **Done** |
| 2. Hook & Mutation Integration | 2 hours | **Done** |
| 3. Undo Toast | 1 hour | **Done** |
| 4. Trash Panel UI | 3 hours | **Done** |
| 5. Settings & Polish | 1.5 hours | **Done** |
| 6. Testing | 2 hours | **Done** |
| 7. Docs, Guides & Gallery | 3 hours | **Done** |
| 8. Project Conventions Update | 0.5 hours | **Done** |
| **Total** | **~15 hours** | |

---

## Open Questions (Resolve Before Implementation)

1. ~~**Panel vs Modal?**~~ **Resolved: Modal** — Use `PopupModal` shell for consistency with Shared Data Sources modal and other existing modals. Always accessible via toolbar button regardless of env/svc selection.
2. **Trash for Workflows?** — Phase 2 candidate. Workflows use separate storage (`saveWorkflows`/`saveWorkflowFolders`) and different delete semantics (folder delete moves workflows to "Unfiled"). Would need a separate `entityType: 'workflow' | 'workflowFolder'` and integration with `useWorkflows.remove()`.
3. ~~**Retention default**~~ **Resolved: 30 days.** IndexedDB (primary backend on web) has no practical size limit. localStorage is only a fallback. Tauri FS has no limit. 30 days is safe.
4. **Cross-tab sync** — Not needed for Phase 1. BroadcastChannel is not used anywhere in the codebase currently. If a user deletes in Tab A and opens Trash in Tab B, Tab B will load from storage on panel open (fresh `loadTrash()` call). Good enough for now. Phase 2 candidate.
5. ~~**Keyboard shortcut Cmd+Z / Ctrl+Z**~~ **Resolved: Do NOT use Cmd+Z.** The Workflow Designer, Data Mapper, and Expression Editor already bind Cmd+Z for their own undo/redo. Adding a global Cmd+Z for trash undo would conflict. The Undo button in the toast is sufficient. Users can click it within 5 seconds.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IDB version bump breaks existing data | Low | High | `objectStoreNames.contains()` guards; `onblocked` handler recreates DB |
| localStorage quota exceeded with trash | Low | Medium | IDB is primary; localStorage is fallback only. Monitor `getStorageUsage` |
| Slow `purgeExpired()` at startup | Very Low | Low | Runs in `Promise.all`; operates on in-memory array filter |
| Restore with stale env/svc references | Medium | Low | Clear env/svc assignment if not found; restore as unassociated FG |
| ID collision on restore after import | Low | Medium | Generate new UUIDs for restored items when collision detected |
| Concurrent tab writes to trash | Low | Low | Last-write-wins (no cross-tab sync in Phase 1); acceptable for initial release |
