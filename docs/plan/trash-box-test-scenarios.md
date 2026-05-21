# Trash Box — Test Scenarios for Manual & Visual Verification

> Feature: Trash Box — Soft Delete & Recovery
> Phases: 1–8 (all completed)
> Branch: `feature/trash-box-soft-delete`

---

## Files Changed (Summary)

| File | Phase | Changes |
|------|-------|---------|
| `src/shared/types/index.ts` | 1 | Added `TrashEntityType`, `TrashItem`, `TrashSettings`, `StructureChangeAction: 'restored'` |
| `src/shared/utils/idbOpen.ts` | 1 | Bumped `DB_VERSION` 3 → 4, added `trash` object store |
| `src/shared/utils/idbTrash.ts` | 1 | Created — IndexedDB backend for trash items |
| `src/shared/utils/trashStorage.ts` | 1 | Created — Dual-mode CRUD (IDB/localStorage/Tauri FS) |
| `src/features/scenarios/hooks/useTrash.ts` | 2 | Created — React hook with full restore logic |
| `src/features/scenarios/hooks/useScenarioMutations.ts` | 2 | Extended `ConfirmDialog`, added `moveToTrash` injection |
| `src/features/scenarios/hooks/useProjects.ts` | 2 | Added `purgeExpired()` to init `Promise.all` |
| `src/features/scenarios/ScenarioBuilder.tsx` | 2–4 | Wired `useTrash`, TrashPanel, TrashUndoToast |
| `src/features/scenarios/components/TrashUndoToast.tsx` | 3 | Created — 5-second toast with undo |
| `src/features/scenarios/components/TrashPanel.tsx` | 4 | Created — Modal with browse/search/restore/delete |
| `src/styles/trash.css` | 3–4 | Created — Toast + panel CSS |
| `src/styles/index.css` | 3 | Added `@import './trash.css'` |
| `src/features/scenarios/utils/structureChangeLog.ts` | 2 | Added `logItemRestored`, `'restored'` action support |
| `docs/guides/trash-box-guide.md` | 7 | Created — User guide |
| `docs/training-manuals/tests/trash-recovery-easy.html` | 7 | Created — HTML training manual |
| `src/data/galleries/tests/presets.ts` | 7 | Added `createTrashRecoveryDemo()` factory |
| `src/data/galleries/tests/index.ts` | 7 | Added `test-trash-recovery-demo` catalog entry |
| `src/data/galleries/trainingPaths/contentPaths.ts` | 7 | Added training path entry with `sampleId` |
| `src/data/galleries/trainingPaths/manualMetadata.ts` | 7 | Added metadata entry |
| `.cursor/rules/project-conventions.mdc` | 8 | Added 6 Key Files entries |
| `CHANGELOG.md` | 8 | Added Trash Box under `[Unreleased]` |
| `README.md` | 8 | Added Feature Reference row, IDB `trash` store, DB version 4 |

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Phase | Scenario | Pass? | Notes |
|---|-------|----------|-------|-------|
| 1 | 1 | [IDB Store Creation](#test-scenario-1-idb-store-creation) | [ ] | |
| 2 | 1 | [Storage Fallback — localStorage](#test-scenario-2-storage-fallback--localstorage) | [ ] | |
| 3 | 2 | [Delete Feature Group → Trash](#test-scenario-3-delete-feature-group--trash) | [ ] | |
| 4 | 2 | [Delete Scenario → Trash](#test-scenario-4-delete-scenario--trash) | [ ] | |
| 5 | 2 | [Delete Test → Trash](#test-scenario-5-delete-test--trash) | [ ] | |
| 6 | 2 | [Delete Shared Data Source → Trash](#test-scenario-6-delete-shared-data-source--trash) | [ ] | |
| 7 | 2 | [Auto-Purge on Startup](#test-scenario-7-auto-purge-on-startup) | [ ] | |
| 8 | 3 | [Undo Toast — Immediate Recovery](#test-scenario-8-undo-toast--immediate-recovery) | [ ] | |
| 9 | 3 | [Undo Toast — Auto-Dismiss After 5s](#test-scenario-9-undo-toast--auto-dismiss-after-5s) | [ ] | |
| 10 | 3 | [Undo Toast — Rapid Deletes (Timer Reset)](#test-scenario-10-undo-toast--rapid-deletes-timer-reset) | [ ] | |
| 11 | 4 | [Trash Panel — Browse & Item Display](#test-scenario-11-trash-panel--browse--item-display) | [ ] | |
| 12 | 4 | [Trash Panel — Search Filter](#test-scenario-12-trash-panel--search-filter) | [ ] | |
| 13 | 4 | [Trash Panel — Restore to Original Parent](#test-scenario-13-trash-panel--restore-to-original-parent) | [ ] | |
| 14 | 4 | [Trash Panel — Restore Orphan (Parent Deleted)](#test-scenario-14-trash-panel--restore-orphan-parent-deleted) | [ ] | |
| 15 | 4 | [Trash Panel — Permanent Delete](#test-scenario-15-trash-panel--permanent-delete) | [ ] | |
| 16 | 4 | [Trash Panel — Empty Trash](#test-scenario-16-trash-panel--empty-trash) | [ ] | |
| 17 | 5 | [Settings — Retention Period](#test-scenario-17-settings--retention-period) | [ ] | |
| 18 | 5 | [Settings — Max Items Enforcement](#test-scenario-18-settings--max-items-enforcement) | [ ] | |
| 19 | 5 | [Settings — Persistence Across Reload](#test-scenario-19-settings--persistence-across-reload) | [ ] | |
| 20 | 2 | [Restore with ID Collision](#test-scenario-20-restore-with-id-collision) | [ ] | |
| 21 | 2 | [Restore with Stale Environment/Microservice](#test-scenario-21-restore-with-stale-environmentmicroservice) | [ ] | |
| 22 | 2 | [Structure Change Log — Restored Action](#test-scenario-22-structure-change-log--restored-action) | [ ] | |
| 23 | 6 | [Unit Test Suite — Full Pass](#test-scenario-23-unit-test-suite--full-pass) | [ ] | |
| 24 | 6 | [TypeScript — Zero Errors](#test-scenario-24-typescript--zero-errors) | [ ] | |
| 25 | 7 | [Gallery — Sample Visible & Importable](#test-scenario-25-gallery--sample-visible--importable) | [ ] | |
| 26 | 7 | [Training Manual — Accessible & Linked](#test-scenario-26-training-manual--accessible--linked) | [ ] | |
| 27 | 7 | [User Guide — Accessible from Docs](#test-scenario-27-user-guide--accessible-from-docs) | [ ] | |
| 28 | 8 | [Conventions & Changelog Updated](#test-scenario-28-conventions--changelog-updated) | [ ] | |
| 29 | 1–5 | [Data Persistence Across Reload](#test-scenario-29-data-persistence-across-reload) | [ ] | |
| 30 | 1–5 | [Multi-Entity Trash Workflow (End-to-End)](#test-scenario-30-multi-entity-trash-workflow-end-to-end) | [ ] | |

---

## Phase 1: Storage Layer

### Test Scenario 1: IDB Store Creation

**Purpose**: Verify that the IndexedDB `trash` object store is created on first load or upgrade from version 3 to version 4.

**Files**: `src/shared/utils/idbOpen.ts`

#### Steps

1. Open **DevTools → Application → IndexedDB**
2. Find the `redfireforge` database
3. Check the **version number** — should be `4`
4. Check the **object store list** — should include `featureGroups`, `testRuns`, `sharedDataSources`, and `trash`

#### Expected Outcomes

- [ ] Database version is `4`
- [ ] `trash` object store exists alongside the original 3 stores
- [ ] No console errors about IDB upgrade or blocked database
- [ ] Existing data in `featureGroups`, `testRuns`, `sharedDataSources` is preserved (not wiped)

---

### Test Scenario 2: Storage Fallback — localStorage

**Purpose**: Verify that when IndexedDB is blocked (e.g., private browsing on some browsers), trash operations fall back to localStorage gracefully.

**Files**: `src/shared/utils/trashStorage.ts`

#### Steps

1. Open the browser in **Private/Incognito** mode (or use DevTools to disable IDB)
2. Navigate to RedfireForge
3. Create a Feature Group with a scenario and test
4. Delete the scenario
5. Open **DevTools → Application → Local Storage** → find keys starting with `perf-test-trash`
6. Open the Trash Panel and verify the deleted item appears
7. Click **Restore** and confirm it returns to the tree

#### Expected Outcomes

- [ ] Trash item saved under `perf-test-trash-items` in localStorage
- [ ] Trash Panel displays the item correctly
- [ ] Restore works from localStorage-backed trash
- [ ] No console errors about IDB (fallback should be silent)

---

## Phase 2: Hook & Mutation Integration

### Test Scenario 3: Delete Feature Group → Trash

**Purpose**: Verify that deleting a Feature Group moves it to trash with all its children (scenarios + tests) preserved.

**Files**: `src/features/scenarios/hooks/useTrash.ts`, `useScenarioMutations.ts`

#### Steps

**Part A — Create the data**

1. Go to **Harness** → create a Feature Group named `Payment Flow`
2. Add 2 scenarios: `Happy Path` (with 2 tests) and `Error Cases` (with 1 test)
3. Note: 2 scenarios, 3 tests total

**Part B — Delete the Feature Group**

4. Right-click `Payment Flow` → **Delete**
5. Confirmation dialog should say: *"Move Feature Group 'Payment Flow' to Trash?"*
6. Click **Move to Trash**

**Part C — Verify**

7. `Payment Flow` disappears from the sidebar
8. Open Trash Panel → verify the item appears with:
   - Entity type badge: `FEATURE GROUP`
   - Name: `Payment Flow`
   - Child counts: `2 scenarios · 3 tests`
   - Deletion time: `just now` or `a few seconds ago`
   - Expiry: `Expires in 30 days` (default)

#### Expected Outcomes

- [ ] Feature Group disappears from sidebar immediately
- [ ] Trash Panel shows the item with correct metadata
- [ ] Child counts are accurate (2 scenarios, 3 tests)
- [ ] Undo toast appears at bottom of screen
- [ ] No console errors

---

### Test Scenario 4: Delete Scenario → Trash

**Purpose**: Verify that deleting a scenario preserves its tests and records the parent Feature Group path.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Create a Feature Group `Auth Tests` → add scenario `Login Flow` with 3 tests
2. Right-click `Login Flow` → **Delete** → **Move to Trash**
3. Open Trash Panel

#### Expected Outcomes

- [ ] Scenario disappears from the Feature Group but the Feature Group remains
- [ ] Trash item shows entity type `SCENARIO`
- [ ] Parent path shows `Auth Tests`
- [ ] Child counts: `3 tests`
- [ ] Undo toast appears

---

### Test Scenario 5: Delete Test → Trash

**Purpose**: Verify that deleting an individual test records both parent Feature Group and parent Scenario in the path.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Create Feature Group `Users` → Scenario `Get User` → Test `GET /users/1`
2. Right-click the test → **Delete** → **Move to Trash**
3. Open Trash Panel

#### Expected Outcomes

- [ ] Test disappears from the scenario but the scenario remains
- [ ] Trash item shows entity type `TEST`
- [ ] Parent path shows `Users > Get User`
- [ ] No child counts displayed (tests have no children)
- [ ] Undo toast appears

---

### Test Scenario 6: Delete Shared Data Source → Trash

**Purpose**: Verify that Shared Data Sources (from the Data Sources tab) can be soft-deleted.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Go to **Harness → Data Sources** tab
2. Create a shared data source named `Test Users` with 3 columns and 5 rows
3. Delete `Test Users`
4. Open Trash Panel

#### Expected Outcomes

- [ ] Data source disappears from the Data Sources list
- [ ] Trash item shows entity type `SHARED DATA SOURCE`
- [ ] Name shows `Test Users`
- [ ] Undo toast appears
- [ ] Restoring it brings it back to the Data Sources list with all columns and rows intact

---

### Test Scenario 7: Auto-Purge on Startup

**Purpose**: Verify that expired trash items are automatically purged when the app loads.

**Files**: `src/features/scenarios/hooks/useProjects.ts`, `src/shared/utils/trashStorage.ts`

#### Steps

1. Delete 3 items (any types)
2. Open DevTools → Application → IndexedDB → `redfireforge` → `trash`
3. Find the trash items and manually edit one item's `expiresAt` to a timestamp in the past (e.g., `Date.now() - 86400000`)
4. **Reload the page** (Ctrl+R / Cmd+R)
5. Open Trash Panel

#### Expected Outcomes

- [ ] The expired item is gone from the Trash Panel
- [ ] The two non-expired items are still present
- [ ] Browser console shows a log line about purging (e.g., `[Trash] Purged 1 expired items`)
- [ ] No errors during startup

---

## Phase 3: Undo Toast

### Test Scenario 8: Undo Toast — Immediate Recovery

**Purpose**: Verify that clicking Undo within the 5-second window restores the item to its exact original position.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`, `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Create Feature Group `Temp` → Scenario `SC1` → Test `T1`
2. Delete scenario `SC1`
3. Observe the undo toast at the bottom: *"SC1 moved to Trash"*
4. Click **Undo** within 5 seconds

#### Expected Outcomes

- [ ] Toast appears with entity name and "moved to Trash" text
- [ ] Progress bar is visibly shrinking over 5 seconds
- [ ] Clicking Undo immediately restores `SC1` inside `Temp`
- [ ] Toast disappears after clicking Undo
- [ ] Trash Panel shows zero items (the item was never committed to trash)
- [ ] The restored scenario has all its original tests intact

---

### Test Scenario 9: Undo Toast — Auto-Dismiss After 5s

**Purpose**: Verify that the toast disappears after 5 seconds and the item remains in trash.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`

#### Steps

1. Delete any item
2. **Do not click** Undo — wait 5 seconds
3. Observe the toast

#### Expected Outcomes

- [ ] Toast auto-dismisses after approximately 5 seconds
- [ ] The progress bar reaches zero and the toast slides away
- [ ] Item remains in the Trash Panel
- [ ] No residual UI artifacts (no ghost toast stuck on screen)

---

### Test Scenario 10: Undo Toast — Rapid Deletes (Timer Reset)

**Purpose**: Verify that deleting a second item while the first toast is still showing replaces the toast and resets the 5-second timer.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`

#### Steps

1. Create Feature Group `Multi` → Scenario `A` → Scenario `B`
2. Delete Scenario `A` — toast appears: *"A moved to Trash"*
3. **Within 2 seconds**, delete Scenario `B`
4. Observe the toast

#### Expected Outcomes

- [ ] Toast content changes to *"B moved to Trash"*
- [ ] Progress bar resets to full width (fresh 5-second countdown)
- [ ] Clicking Undo now restores Scenario `B` (the latest delete)
- [ ] Scenario `A` remains in the Trash Panel (cannot be undone, since B replaced it)
- [ ] Only one toast is visible at a time (no stacking)

---

## Phase 4: Trash Panel UI

### Test Scenario 11: Trash Panel — Browse & Item Display

**Purpose**: Verify the Trash Panel displays all required metadata for each trashed item.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Steps

1. Delete 4 items: 1 Feature Group (with scenarios/tests), 1 Scenario, 1 Test, 1 Shared Data Source
2. Wait for all undo toasts to expire
3. Click the **Trash** button in the toolbar

#### Expected Outcomes

- [ ] Trash button shows a badge with `4`
- [ ] Panel opens as a modal with title "Trash" and the count
- [ ] Each item card displays:
  - Entity icon (different for each type)
  - Entity name
  - Entity type badge (uppercase: `FEATURE GROUP`, `SCENARIO`, `TEST`, `SHARED DATA SOURCE`)
  - Parent path (e.g., `FG Name > Scenario Name` for tests)
  - Child counts (for FG and Scenario only)
  - Relative deletion time (e.g., `a few seconds ago`)
  - Expiry countdown (e.g., `Expires in 30 days`)
  - Restore button
  - Delete button
- [ ] Items are ordered newest first (most recently deleted at top)
- [ ] Footer shows settings dropdowns and "Empty Trash" button

---

### Test Scenario 12: Trash Panel — Search Filter

**Purpose**: Verify that the search bar filters trash items by name and parent path.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Steps

1. Delete items named `Login Flow`, `Checkout`, `Auth Config`, `User Data`
2. Open Trash Panel
3. Type `login` in the search bar

#### Expected Outcomes

- [ ] Only `Login Flow` is visible
- [ ] Other items are hidden
- [ ] Clearing the search shows all items again
- [ ] Search is case-insensitive (`LOGIN` also works)
- [ ] Searching by parent path works (e.g., if parent is `Auth Tests`, typing `auth` shows items from that group)

---

### Test Scenario 13: Trash Panel — Restore to Original Parent

**Purpose**: Verify that restoring an item returns it to its original parent when the parent still exists.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

**Part A — Setup**

1. Create Feature Group `API Tests` → Scenario `Users` → 2 tests
2. Delete Scenario `Users`
3. Wait for toast to expire

**Part B — Restore**

4. Open Trash Panel
5. Click **Restore** on `Users`
6. Close the panel

**Part C — Verify**

7. Check the `API Tests` Feature Group in the sidebar

#### Expected Outcomes

- [ ] `Users` scenario reappears inside `API Tests`
- [ ] Both original tests are present inside the restored scenario
- [ ] The scenario is at the same level (not nested differently)
- [ ] The item disappears from the Trash Panel
- [ ] Trash badge count decrements by 1

---

### Test Scenario 14: Trash Panel — Restore Orphan (Parent Deleted)

**Purpose**: Verify that when a scenario's parent Feature Group no longer exists, restoration creates a new "Restored Items" Feature Group.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

**Part A — Setup**

1. Create Feature Group `Temp FG` → Scenario `Orphan SC` → 1 test
2. Delete Scenario `Orphan SC` (wait for toast)
3. Now delete Feature Group `Temp FG` (wait for toast)
4. Restore `Orphan SC` only — leave `Temp FG` in trash

**Part B — Verify**

5. Check the sidebar

#### Expected Outcomes

- [ ] A new Feature Group named `Restored Items` appears in the sidebar
- [ ] `Orphan SC` is inside `Restored Items` with its test intact
- [ ] The restored scenario has a fresh unique ID (not colliding with the trashed FG's copy)
- [ ] `Temp FG` remains in the Trash Panel
- [ ] Structure change log on the new `Restored Items` FG shows a `restored` action

---

### Test Scenario 15: Trash Panel — Permanent Delete

**Purpose**: Verify that permanently deleting a trash item removes it from storage entirely with a confirmation dialog.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Steps

1. Delete any item, wait for toast
2. Open Trash Panel
3. Click the **Delete** button (🗑 icon) on the item
4. Confirmation dialog appears: *"Permanently delete 'X'? This cannot be undone."*
5. Click **Delete** to confirm

#### Expected Outcomes

- [ ] Confirmation dialog appears with the item name
- [ ] After confirming, item disappears from the Trash Panel
- [ ] Item is removed from IndexedDB `trash` store (verify in DevTools)
- [ ] Clicking **Cancel** on the confirmation keeps the item
- [ ] The item cannot be recovered after permanent deletion

---

### Test Scenario 16: Trash Panel — Empty Trash

**Purpose**: Verify that "Empty Trash" permanently deletes all items with a confirmation.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Steps

1. Delete 5 different items, wait for toasts
2. Open Trash Panel — should show 5 items
3. Click **Empty Trash** in the footer
4. Confirmation dialog appears showing the total count
5. Click **Delete All** to confirm

#### Expected Outcomes

- [ ] Confirmation dialog shows: *"Permanently delete all 5 items?"* (or similar)
- [ ] After confirming, the Trash Panel shows the empty state: *"No deleted items"*
- [ ] Trash button badge disappears (count is 0)
- [ ] IndexedDB `trash` store is empty (verify in DevTools)
- [ ] Clicking **Cancel** on the confirmation keeps all items

---

## Phase 5: Settings & Polish

### Test Scenario 17: Settings — Retention Period

**Purpose**: Verify that changing the retention period affects the `expiresAt` calculation for newly deleted items.

**Files**: `src/features/scenarios/hooks/useTrash.ts`, `src/features/scenarios/components/TrashPanel.tsx`

#### Steps

1. Open Trash Panel → in the footer, change **Retention** dropdown to **7 days**
2. Close the panel
3. Delete a scenario
4. Open Trash Panel → check the new item's expiry

#### Expected Outcomes

- [ ] The newly deleted item shows `Expires in 7 days` (not 30)
- [ ] Previously deleted items retain their original expiry (30 days if deleted before the change)
- [ ] The retention dropdown shows `7 days` as selected

---

### Test Scenario 18: Settings — Max Items Enforcement

**Purpose**: Verify that when the trash exceeds the max items limit, the oldest items are evicted.

**Files**: `src/features/scenarios/hooks/useTrash.ts`, `src/shared/utils/trashStorage.ts`

#### Steps

1. Open Trash Panel → change **Max items** to **50**
2. Create and rapidly delete items (create a Feature Group, delete it, repeat)
3. After deleting the 51st item, open the Trash Panel

#### Expected Outcomes

- [ ] Trash Panel shows at most 50 items
- [ ] The oldest item (first deleted) is no longer present
- [ ] The newest item (just deleted) is at the top
- [ ] Expired items are evicted first (if any), then the oldest non-expired

> **Shortcut for testing**: Temporarily set max items to a low number in DevTools by changing the `perf-test-trash-settings` localStorage key, then delete a few items.

---

### Test Scenario 19: Settings — Persistence Across Reload

**Purpose**: Verify that trash settings survive a page reload.

**Files**: `src/shared/utils/trashStorage.ts`

#### Steps

1. Open Trash Panel → set **Retention** to `14 days`, **Max items** to `200`
2. Close the panel
3. **Reload the page** (Ctrl+R / Cmd+R)
4. Open Trash Panel → check the dropdown values

#### Expected Outcomes

- [ ] Retention shows `14 days`
- [ ] Max items shows `200`
- [ ] Settings are stored in `perf-test-trash-settings` in localStorage (or equivalent storage)

---

## Phase 2 (Advanced): Edge Cases

### Test Scenario 20: Restore with ID Collision

**Purpose**: Verify that restoring an item whose IDs collide with existing items generates new unique IDs.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

**Part A — Create collision**

1. Create Feature Group `Tests` → Scenario `Login` → Test `T1`
2. Export `Tests` as JSON
3. Delete Scenario `Login` (wait for toast)
4. Import the JSON — this recreates `Login` with the same original IDs
5. Now you have a live `Login` (from import) and a trashed `Login` (from deletion) with the same IDs

**Part B — Restore and verify**

6. Open Trash Panel → Restore the trashed `Login`

#### Expected Outcomes

- [ ] Restored scenario appears in `Tests` alongside the imported one
- [ ] The restored scenario has a different ID from the imported one (new UUID generated)
- [ ] The restored scenario's tests also have fresh IDs
- [ ] The restored scenario has `(restored)` appended to its name (or similar disambiguation)
- [ ] No duplicate ID errors in console

---

### Test Scenario 21: Restore with Stale Environment/Microservice

**Purpose**: Verify that restoring a Feature Group whose environment or microservice no longer exists clears those references.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Create an environment `staging` and microservice `auth-service`
2. Select `staging` + `auth-service` in the sidebar
3. Create Feature Group `Auth Flow` (associated with staging/auth-service)
4. Delete `Auth Flow` (wait for toast)
5. Go to **Settings → Environments** → delete `staging`
6. Open Trash Panel → Restore `Auth Flow`

#### Expected Outcomes

- [ ] `Auth Flow` is restored as an **unassociated** Feature Group (no environment/microservice)
- [ ] It appears in the "All" view or "Unassigned" section, not under the deleted environment
- [ ] No console errors about missing environment references
- [ ] The restored Feature Group's scenarios and tests are fully intact

---

### Test Scenario 22: Structure Change Log — Restored Action

**Purpose**: Verify that restored items are recorded in the Feature Group's structure change history.

**Files**: `src/features/scenarios/utils/structureChangeLog.ts`

#### Steps

1. Create Feature Group `Logged FG` → Scenario `SC` → Test `T`
2. Delete Scenario `SC`
3. Open Trash Panel → Restore `SC`
4. Open `Logged FG` → check its **Change History** (if visible in UI) or inspect localStorage for structure change entries

#### Expected Outcomes

- [ ] A change entry with action `restored` exists
- [ ] The entry records the restored item's name and type
- [ ] The action label shows the restoration icon/label (not "added" or "deleted")
- [ ] The timestamp is correct

---

## Phase 6: Full Testing

### Test Scenario 23: Unit Test Suite — Full Pass

**Purpose**: Verify all trash-related unit tests pass.

**Files**: All `*.test.ts` / `*.test.tsx` files

#### Steps

```bash
npx vitest run src/shared/utils/idbTrash.test.ts \
  src/shared/utils/trashStorage.test.ts \
  src/features/scenarios/hooks/useTrash.test.ts \
  src/features/scenarios/components/TrashUndoToast.test.tsx \
  src/features/scenarios/components/TrashPanel.test.tsx \
  src/features/scenarios/utils/structureChangeLog.test.ts \
  src/features/scenarios/hooks/useScenarioMutations.test.ts
```

#### Expected Outcomes

- [ ] All 197 tests pass (0 failures)
- [ ] No skipped tests
- [ ] No unexpected console warnings

---

### Test Scenario 24: TypeScript — Zero Errors

**Purpose**: Verify the entire codebase compiles without type errors.

#### Steps

```bash
npx tsc -b --noEmit
```

#### Expected Outcomes

- [ ] Exit code 0
- [ ] Zero type errors
- [ ] No new warnings introduced

---

## Phase 7: Documentation & Gallery

### Test Scenario 25: Gallery — Sample Visible & Importable

**Purpose**: Verify the "Trash Recovery Demo" sample appears in the Gallery and can be imported.

**Files**: `src/data/galleries/tests/index.ts`, `src/data/galleries/tests/presets.ts`

#### Steps

1. Start the dev server (`npm run dev`)
2. Navigate to **Gallery → Tests** tab
3. Search or scroll to find **Trash Recovery Demo**
4. Click on it to view details
5. Click **Import** to add it to the harness

#### Expected Outcomes

- [ ] Sample card shows icon 🗑️, name "Trash Recovery Demo", difficulty "Easy"
- [ ] Description mentions deleting, undoing, and restoring
- [ ] Tags include `trash`, `recovery`, `undo`, `restore`
- [ ] Live APIs shows `jsonplaceholder.typicode.com`
- [ ] Detail panel shows a linked training manual: "Recovering Deleted Scenarios"
- [ ] Importing creates a Feature Group named `Trash Box — Recovery Demo` with 2 scenarios
- [ ] Each scenario has one test with working assertions (status 200, etc.)

---

### Test Scenario 26: Training Manual — Accessible & Linked

**Purpose**: Verify the HTML training manual opens from Gallery and Training Paths.

**Files**: `docs/training-manuals/tests/trash-recovery-easy.html`, `src/data/galleries/trainingPaths/contentPaths.ts`

#### Steps

**Part A — From Gallery Detail Panel**

1. Go to **Gallery → Tests** → click **Trash Recovery Demo**
2. In the detail panel, find the "Training Manuals" section
3. Click the manual link: **Recovering Deleted Scenarios**

**Part B — From Training Paths**

4. Go to **Gallery → Training Paths** tab
5. Open the **Test Suites** path
6. Navigate to **Phase 1: Getting Started**
7. Find **Recovering Deleted Scenarios** in the manual list
8. Click to open

#### Expected Outcomes

- [ ] Manual opens in a new tab/window
- [ ] Cover page shows 🗑️ icon, title "Recovering Deleted Scenarios", badge "Easy ★☆☆"
- [ ] Manual has 8 steps and 4 exercises
- [ ] CSS styling matches other manuals (red headings, navy headers, proper fonts)
- [ ] The manual references "Trash Recovery Demo" gallery sample correctly
- [ ] The manual has a "What's New" badge (added today per `manualMetadata.ts`)
- [ ] The training path entry shows a linked sample chip for "Trash Recovery Demo"

---

### Test Scenario 27: User Guide — Accessible from Docs

**Purpose**: Verify the user guide is listed in the README and contains accurate content.

**Files**: `docs/guides/trash-box-guide.md`, `docs/guides/README.md`

#### Steps

1. Open `docs/guides/README.md`
2. Find the "Scenarios & Testing" section
3. Verify `Trash Box Guide` is listed with description

#### Expected Outcomes

- [ ] Entry exists: `[Trash Box Guide](./trash-box-guide.md)` with description
- [ ] The guide covers: Overview, How Deletion Works, Instant Undo, Trash Panel, Settings, Automatic Purge, Storage, Tips
- [ ] Related Guides links are valid (point to existing guides)
- [ ] ASCII art mockup of the undo toast is present
- [ ] Settings table shows correct values (retention 7–90 days, max items 50–200)

---

## Phase 8: Project Conventions

### Test Scenario 28: Conventions & Changelog Updated

**Purpose**: Verify all project documentation reflects the Trash Box feature.

**Files**: `.cursor/rules/project-conventions.mdc`, `CHANGELOG.md`, `README.md`

#### Steps

**Part A — project-conventions.mdc**

1. Open `.cursor/rules/project-conventions.mdc`
2. Find the **Key Files** table
3. Verify 6 trash-related entries exist

**Part B — CHANGELOG.md**

4. Open `CHANGELOG.md`
5. Find `[Unreleased]` section
6. Verify "Trash Box — Soft Delete & Recovery" entry exists

**Part C — README.md**

7. Open `README.md`
8. Find the **Feature Reference** table → verify `Trash Box` row
9. Find the **Data Persistence → IndexedDB** section → verify `trash` store row
10. Verify DB version is `4`

#### Expected Outcomes

- [ ] `project-conventions.mdc` has entries for: `trashStorage.ts`, `idbTrash.ts`, `useTrash.ts`, `TrashPanel.tsx`, `TrashUndoToast.tsx`, `trash.css`
- [ ] `CHANGELOG.md` has 10 bullet points under Trash Box
- [ ] `README.md` Feature Reference has `Trash Box` with description
- [ ] `README.md` IDB table has `trash` store
- [ ] `README.md` DB version says `version 4`

---

## Cross-Phase Integration Tests

### Test Scenario 29: Data Persistence Across Reload

**Purpose**: Verify that trash items, trash settings, and the trash badge all survive a full page reload.

**Files**: All storage + UI files

#### Steps

1. Delete 3 different entity types (Feature Group, Scenario, Shared Data Source)
2. Change retention to 14 days, max items to 50
3. **Reload the page** (Ctrl+R / Cmd+R)
4. Open Trash Panel

#### Expected Outcomes

- [ ] All 3 items are present in the Trash Panel after reload
- [ ] Trash button badge shows `3` (or correct count, accounting for auto-purge)
- [ ] Retention dropdown shows `14 days`
- [ ] Max items dropdown shows `50`
- [ ] Item metadata (names, types, child counts, expiry) is fully preserved
- [ ] Restore still works after reload

---

### Test Scenario 30: Multi-Entity Trash Workflow (End-to-End)

**Purpose**: Full end-to-end test exercising all trash features in a realistic workflow.

**Files**: All Phase 1–5 files

#### Steps

**Part A — Setup (2 minutes)**

1. Create 2 environments: `dev`, `prod`
2. Create 1 microservice: `user-service`
3. Select `dev` + `user-service`
4. Create Feature Group `User CRUD` (associated with dev/user-service)
5. Add 3 scenarios: `Create User` (2 tests), `Get User` (1 test), `Delete User` (1 test)
6. Create a Shared Data Source `User Test Data` with 5 rows

**Part B — Delete multiple items (1 minute)**

7. Delete Test `GET /users/1` from `Get User` → use **Undo** to restore it
8. Delete Scenario `Delete User` → let toast expire
9. Delete Shared Data Source `User Test Data` → let toast expire
10. Delete Feature Group `User CRUD` → let toast expire

**Part C — Trash Panel operations (2 minutes)**

11. Open Trash Panel → verify 3 items (Delete User, User Test Data, User CRUD)
12. Search for `delete` → only `Delete User` and `User CRUD` should show
13. Clear search
14. Restore `Delete User` → since parent FG is also in trash, it should create a "Restored Items" FG
15. Permanently delete `User Test Data` → confirm dialog → item gone
16. Restore `User CRUD` → should appear as a Feature Group (with only `Create User` and `Get User` scenarios — `Delete User` was separated earlier)

**Part D — Verify final state (1 minute)**

17. Sidebar should show: `User CRUD` (2 scenarios) + `Restored Items` (1 scenario: Delete User)
18. `User CRUD` should be associated with `dev` / `user-service` (if they still exist)
19. Trash Panel should be empty
20. Delete `Restored Items` → change settings to 7 day retention → close → reload → verify settings persisted and `Restored Items` is in trash

#### Expected Outcomes

- [ ] Undo works for the first delete (Part B, step 7)
- [ ] Orphan restore creates `Restored Items` FG (Part C, step 14)
- [ ] Permanent delete removes the item forever (Part C, step 15)
- [ ] Feature Group restore preserves remaining children only (Part C, step 16)
- [ ] Final sidebar state has 2 FGs with correct scenario counts (Part D, step 17)
- [ ] Environment/microservice association is preserved for the restored FG (Part D, step 18)
- [ ] Trash is empty after all operations (Part D, step 19)
- [ ] Settings persist across reload (Part D, step 20)
- [ ] No console errors throughout the entire workflow
- [ ] Total wall-clock time: < 6 minutes

---

## Automated Test Commands

For quick validation of the automated test suite:

```bash
# Phase 6 — All trash unit tests (197 tests)
npx vitest run \
  src/shared/utils/idbTrash.test.ts \
  src/shared/utils/trashStorage.test.ts \
  src/features/scenarios/hooks/useTrash.test.ts \
  src/features/scenarios/components/TrashUndoToast.test.tsx \
  src/features/scenarios/components/TrashPanel.test.tsx \
  src/features/scenarios/utils/structureChangeLog.test.ts \
  src/features/scenarios/hooks/useScenarioMutations.test.ts

# Phase 7 — Gallery & training path tests
npx vitest run \
  src/data/galleries/tests/tests.test.ts \
  src/data/galleries/tests/presets.test.ts \
  src/data/galleries/trainingPaths/trainingPaths.test.ts \
  src/data/galleries/trainingPaths/manualMetadata.test.ts

# TypeScript — must be zero errors
npx tsc -b --noEmit
```

---

## Risk Areas to Watch

| Risk | Scenario | Mitigation |
|------|----------|------------|
| IDB blocked in private browsing | Test Scenario 2 | localStorage fallback verified |
| Rapid deletes causing stale closure | Test Scenario 10 | `useRef` for callbacks, `key={item.id}` for animation reset |
| ID collision on restore after import | Test Scenario 20 | `ensureUniqueIds` / `ensureUniqueScenarioIds` with `uuidv4()` |
| Orphan restore when parent also trashed | Test Scenario 14 | Creates "Restored Items" FG with `logItemRestored` |
| Stale env/svc on restore | Test Scenario 21 | Clears invalid references, restores as unassociated |
| Max items exceeding UI/storage desync | Test Scenario 18 | `setTrashItems` enforces `maxItems` in UI state immediately |
| Large trash affecting startup time | Test Scenario 7 | `purgeExpired` runs in `Promise.all` with other init |
