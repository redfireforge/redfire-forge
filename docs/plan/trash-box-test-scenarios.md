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

## Navigation Reference

### Opening the Feature Groups view (Scenario Builder)

1. Click the **Harness** icon in the far-left vertical activity bar (icon: a rectangle with a chevron; tooltip "Harness").
2. In the secondary top navigation strip, click **Feature Groups** (the first tab).
3. In the left sidebar, select a **Service** (microservice) and an **Environment** from the dropdowns. Many header buttons are disabled until both are chosen.

### Creating a Feature Group

1. In the Feature Groups view with a Service and Environment selected, click **+ Add Feature Group** in the top-right header area.
2. An inline text field appears. Type the Feature Group name and press **Enter** (or click the checkmark).

### Creating a Scenario inside a Feature Group

1. Expand the Feature Group by clicking its name/arrow.
2. In the Feature Group's action row, click **+ Add Scenario** (or a similar button — it may be labeled **+ Scenario**).
3. Type the scenario name and press **Enter**.

### Adding a Test to a Scenario

1. Expand the Scenario row.
2. Click the **+ Test** button on the scenario row (in the row's action buttons on the right).
3. The test editor opens. Fill in the name, method, and URL. Save.

### Deleting Items (Feature Group / Scenario / Test)

All delete actions are performed via a **Delete** button (red/danger style) in the action buttons area on the right side of each row:
- **Feature Group**: The **Delete** button appears in the Feature Group header's action buttons.
- **Scenario**: The **Delete** button appears in the scenario row's action buttons (visible when the Feature Group is expanded).
- **Test**: The **Delete** button appears in the test row's action buttons (visible when the Scenario is expanded).

Clicking **Delete** opens a confirmation modal titled **"Move to Trash"** with the message:
> *`Move [entity type] "[name]" to Trash? [child counts if applicable] You can restore it within 30 days.`*

Click **Move to Trash** to confirm. Click **Cancel** to abort.

### Opening the Trash Panel

1. In the Feature Groups view, look at the top header action buttons (same row as Import / Export / **+ Add Feature Group**).
2. Click the **Trash** button. If items are in trash, a count badge (e.g., `3`) is displayed on the button.
3. A modal dialog titled **"Trash (N)"** opens, where N is the total item count.

### Trash Panel Layout

- **Search box** at the top: filters items by name or parent path
- **Item list**: each card shows icon, name, type badge, parent path, child counts, deletion time, expiry
- **Item actions** (right side of each card): **Restore** button and **Delete** button
- **Footer** (bottom of modal):
  - **Retention** dropdown: options are `7`, `14`, `30`, `60`, `90` days (default `30`)
  - **Max items** dropdown: options are `50`, `100`, `200` (default `100`)
  - **Empty Trash** button (disabled when trash is empty)
  - **Close** button

---

---

## Phase 1: Storage Layer

### Test Scenario 1: IDB Store Creation

**Purpose**: Verify that the IndexedDB `trash` object store is created on first load or when the database upgrades from version 3 to version 4.

**Files**: `src/shared/utils/idbOpen.ts`

#### Steps

1. Open RedfireForge in Google Chrome (or any Chromium-based browser).
2. Press **F12** (or right-click anywhere → **Inspect**) to open Chrome DevTools.
3. Click the **Application** tab in DevTools.
4. In the left sidebar, expand **Storage** → **IndexedDB** → expand the entry for `redfireforge` (it may appear as `redfireforge - http://localhost:5173` or similar).
5. At the top of the right panel, look for the **version** number of the database.
6. In the left sidebar under `redfireforge`, expand the list of object stores.

#### Expected Outcomes

- [ ] The database version is **4**
- [ ] The object store list includes all four stores: `featureGroups`, `testRuns`, `sharedDataSources`, and `trash`
- [ ] The `trash` store is listed alongside the original three (not replacing any)
- [ ] Existing data in `featureGroups`, `testRuns`, and `sharedDataSources` is still present and intact (not wiped by the migration)
- [ ] No errors appear in the DevTools Console tab related to IndexedDB, blocked upgrades, or version conflicts

---

### Test Scenario 2: Storage Fallback — localStorage

**Purpose**: Verify that when IndexedDB is unavailable (e.g., private browsing in certain browsers), trash operations silently fall back to localStorage and still function correctly.

**Files**: `src/shared/utils/trashStorage.ts`

#### Steps

> **How to simulate IDB unavailability**: Open a new **Private / Incognito** window in Firefox. Firefox blocks IndexedDB in private browsing mode. (Chrome does not block IDB in incognito, so Firefox is recommended for this scenario.) Alternatively, you can override `indexedDB` in DevTools console: `Object.defineProperty(window, 'indexedDB', { get: () => { throw new Error('IDB blocked'); } });` before loading the app — but this is fragile and the Firefox approach is preferred.

1. Open Firefox and create a new **Private Window** (File → New Private Window, or **Ctrl+Shift+P** / **Cmd+Shift+P**).
2. Navigate to `http://localhost:5173` (the dev server must be running).
3. Open **Harness → Feature Groups**, select a Service and Environment.
4. Create a Feature Group named `Fallback Test` with one Scenario (`SC1`) and one Test (`GET /test`).
5. Click the **Delete** button on `SC1`. In the confirmation modal, click **Move to Trash**.
6. Open DevTools (**F12**) → **Application** → **Local Storage** → select the `localhost:5173` origin.
7. Scroll through the keys to find one starting with `perf-test-trash-items` (or similar).
8. Open the Trash Panel by clicking the **Trash** button in the Feature Groups header.
9. Verify `SC1` appears in the Trash Panel.
10. Click **Restore** on `SC1`.
11. Verify `SC1` reappears in `Fallback Test`.

#### Expected Outcomes

- [ ] After deletion, a `perf-test-trash-items` key exists in localStorage (DevTools → Application → Local Storage) containing a JSON array with the deleted item
- [ ] The Trash Panel correctly reads from localStorage and displays `SC1`
- [ ] No console errors about IndexedDB — the fallback is transparent
- [ ] Restore from localStorage brings `SC1` back to the Feature Groups view with its test intact
- [ ] The app functions normally throughout (no crashes or error banners)

---

## Phase 2: Hook & Mutation Integration

### Test Scenario 3: Delete Feature Group → Trash

**Purpose**: Verify that deleting a Feature Group moves it (along with all its child scenarios and tests) to trash, rather than immediately destroying the data.

**Files**: `src/features/scenarios/hooks/useTrash.ts`, `src/features/scenarios/hooks/useScenarioMutations.ts`

#### Part A — Create the test data

1. Open **Harness → Feature Groups**. Select a Service and Environment.
2. Click **+ Add Feature Group**. Type `Payment Flow` and press **Enter**.
3. Expand `Payment Flow`. Click **+ Add Scenario**, type `Happy Path`, press **Enter**.
4. On the `Happy Path` scenario row, click **+ Test**. In the test editor, add:
   - Name: `Successful Payment`, Method: GET, URL: `https://jsonplaceholder.typicode.com/posts/1`
   - Save.
5. Add a second test to `Happy Path`:
   - Name: `Duplicate Check`, Method: GET, URL: `https://jsonplaceholder.typicode.com/posts/2`
   - Save.
6. Click **+ Add Scenario**, type `Error Cases`, press **Enter**.
7. On the `Error Cases` scenario row, click **+ Test**. Add:
   - Name: `Invalid Card`, Method: POST, URL: `https://jsonplaceholder.typicode.com/posts`
   - Save.
8. Confirm the `Payment Flow` group shows `2 scenarios` and the badge count reflects 3 tests total.

#### Part B — Delete the Feature Group

9. Locate the **Delete** button in the Feature Group `Payment Flow`'s action buttons (right side of the FG header bar). Click it.
10. A confirmation modal appears with:
    - Title: **"Move to Trash"**
    - Message: *`Move feature group "Payment Flow" to Trash? 2 scenarios · 3 tests. You can restore it within 30 days.`*
    - Button: **Move to Trash**
11. Click **Move to Trash**.

#### Part C — Verify

12. Confirm that `Payment Flow` immediately disappears from the Feature Groups list.
13. A toast notification appears at the bottom of the screen (see Scenario 8 for toast details).
14. Click the **Trash** button in the header. The button should show a badge (`1`).
15. In the Trash Panel, find the `Payment Flow` entry and verify it shows:
    - Icon: 📁 (folder icon for Feature Group)
    - Name: `Payment Flow`
    - Type badge: `Feature Group`
    - Child counts: `2 scenarios · 3 tests`
    - Deletion time: `just now` or `a few seconds ago`
    - Expiry: `Expires in 30 days`

#### Expected Outcomes

- [ ] `Payment Flow` disappears from the Feature Groups list immediately after confirming
- [ ] The Trash Panel shows the item with the correct icon, name, type badge, and child counts
- [ ] Deletion time and expiry information are displayed correctly
- [ ] The undo toast appears at the bottom of the screen (not in the modal area)
- [ ] No console errors appear throughout

---

### Test Scenario 4: Delete Scenario → Trash

**Purpose**: Verify that deleting a scenario moves it (and its tests) to trash while leaving the parent Feature Group intact.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Create the test data

1. Open **Harness → Feature Groups** with Service and Environment selected.
2. Create Feature Group `Auth Tests`.
3. Inside `Auth Tests`, create Scenario `Login Flow`.
4. Add 3 tests to `Login Flow`:
   - `Valid Credentials` — GET `https://jsonplaceholder.typicode.com/users/1`
   - `Wrong Password` — GET `https://jsonplaceholder.typicode.com/users/2`
   - `Locked Account` — GET `https://jsonplaceholder.typicode.com/users/3`

#### Part B — Delete the Scenario

5. In the `Auth Tests` Feature Group, expand it so the `Login Flow` scenario row is visible.
6. In the scenario row's action buttons (right side), click the **Delete** button.
7. Confirmation modal:
   - Title: **"Move to Trash"**
   - Message: *`Move scenario "Login Flow" to Trash? 3 tests. You can restore it within 30 days.`*
8. Click **Move to Trash**.

#### Part C — Verify

9. `Login Flow` disappears from `Auth Tests`, but `Auth Tests` itself remains in the list.
10. Open the Trash Panel. Find `Login Flow` and verify:
    - Icon: 📋 (clipboard/scenario icon)
    - Name: `Login Flow`
    - Type badge: `Scenario`
    - Parent path: `Auth Tests`
    - Child counts: `3 tests`
    - Expiry: `Expires in 30 days`

#### Expected Outcomes

- [ ] `Login Flow` disappears but `Auth Tests` feature group remains
- [ ] Trash Panel shows `Login Flow` with type `Scenario`, parent `Auth Tests`, and `3 tests` count
- [ ] Undo toast appears at the bottom of the screen
- [ ] No console errors

---

### Test Scenario 5: Delete Test → Trash

**Purpose**: Verify that deleting an individual test moves only that test to trash while preserving the parent scenario and Feature Group. The trash item should show both the Feature Group and Scenario in its parent path.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Create the test data

1. Create Feature Group `Users`.
2. Inside `Users`, create Scenario `Get User`.
3. Add two tests to `Get User`:
   - `GET /users/1` — GET `https://jsonplaceholder.typicode.com/users/1`
   - `GET /users/2` — GET `https://jsonplaceholder.typicode.com/users/2`

#### Part B — Delete one test

4. Expand the `Get User` scenario so both test rows are visible.
5. Find the **Delete** button in the `GET /users/1` test row's action buttons. Click it.
6. Confirmation modal:
   - Title: **"Move to Trash"**
   - Message: *`Move test "GET /users/1" to Trash? You can restore it within 30 days.`*
7. Click **Move to Trash**.

#### Part C — Verify

8. `GET /users/1` disappears from the `Get User` scenario. `GET /users/2` remains.
9. `Get User` scenario and `Users` Feature Group are still present.
10. Open the Trash Panel. Find `GET /users/1` and verify:
    - Icon: ⚡ (test icon)
    - Name: `GET /users/1`
    - Type badge: `Test`
    - Parent path: `Users > Get User`
    - No child counts (tests have no children)
    - Expiry: `Expires in 30 days`

#### Expected Outcomes

- [ ] Only `GET /users/1` is deleted; `GET /users/2`, `Get User`, and `Users` remain unchanged
- [ ] Trash Panel shows the test with type `Test` and parent path `Users > Get User`
- [ ] No child count is shown (tests have no children)
- [ ] Undo toast appears

---

### Test Scenario 6: Delete Shared Data Source → Trash

**Purpose**: Verify that Shared Data Sources (accessed via the 📦 button in the header) can be soft-deleted and restored from trash.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Create a Shared Data Source

1. In the Feature Groups view, click the **📦 Shared Data Sources** button in the header (it has an orange/accent border).
2. In the Shared Data Sources modal, click **+ New Shared Data Source** (or similar create button).
3. Name it `Test Users`.
4. Add 3 columns: `username`, `email`, `role`.
5. Add 5 rows of sample data (any values).
6. Save and close the modal.

#### Part B — Delete the Shared Data Source

7. Re-open the **📦 Shared Data Sources** modal.
8. Find `Test Users` in the list. Click its **Delete** button.
9. Confirmation modal appears. Click **Move to Trash** (or **Delete** if it is a permanent-only action — note whether the SDS uses soft delete or permanent delete).

#### Part C — Verify in Trash Panel

10. Close the Shared Data Sources modal.
11. Open the Trash Panel via the **Trash** button in the header.
12. Find `Test Users` and verify:
    - Type badge: `Shared Data Source`
    - Name: `Test Users`
    - Expiry: `Expires in 30 days`
13. Click **Restore** on `Test Users`.
14. Re-open the **📦 Shared Data Sources** modal to confirm `Test Users` reappeared with all 5 rows and 3 columns intact.

#### Expected Outcomes

- [ ] `Test Users` disappears from the Shared Data Sources list after deletion
- [ ] Trash Panel shows it with type badge `Shared Data Source`
- [ ] Undo toast appears after deletion
- [ ] After restoring, `Test Users` reappears in the Shared Data Sources modal with all columns and rows intact

---

### Test Scenario 7: Auto-Purge on Startup

**Purpose**: Verify that items whose `expiresAt` timestamp has passed are automatically removed from trash when the app initialises on the next page load.

**Files**: `src/features/scenarios/hooks/useProjects.ts`, `src/shared/utils/trashStorage.ts`

#### Steps

1. Open **Harness → Feature Groups**. Delete 3 different items (e.g., 3 separate tests or scenarios). Let all undo toasts expire.
2. Open the Trash Panel and confirm all 3 items are present. Note their names.
3. Open **DevTools → Application → IndexedDB → redfireforge → trash**.
4. In the object store panel, find one of the 3 trash entries. Click it to expand its record details.
5. Find the `expiresAt` field — it is a Unix timestamp in milliseconds (a large number like `1748123456789`).
6. Double-click the `expiresAt` value to edit it (if editable in your browser's DevTools) and change it to a past timestamp: type `1` (the value `1` represents January 1, 1970 — far in the past). Press **Enter** to save.
   > **Alternative if DevTools editing is not available**: Open the browser console and run:
   > ```js
   > const db = await new Promise((res, rej) => { const r = indexedDB.open('redfireforge'); r.onsuccess = () => res(r.result); r.onerror = rej; });
   > const tx = db.transaction('trash', 'readwrite');
   > const store = tx.objectStore('trash');
   > // Get all items, update the first one
   > const items = await new Promise(res => { const r = store.getAll(); r.onsuccess = () => res(r.result); });
   > items[0].expiresAt = 1;
   > store.put(items[0]);
   > ```
7. **Reload the page** (press **Cmd+R** / **Ctrl+R**).
8. Open the Trash Panel.

#### Expected Outcomes

- [ ] The item whose `expiresAt` was set to `1` (now expired) is **no longer present** in the Trash Panel
- [ ] The other 2 items (still within their retention window) remain in the Trash Panel
- [ ] The Trash button badge count reflects the reduced count (2, not 3)
- [ ] The browser console (DevTools → Console) shows a log message about purging, e.g. `[Trash] Purged 1 expired item(s)` (or similar)
- [ ] No errors appear during startup

---

## Phase 3: Undo Toast

### Test Scenario 8: Undo Toast — Immediate Recovery

**Purpose**: Verify that clicking **Undo** within 5 seconds of a deletion immediately restores the item to its original position, as if the deletion never happened.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`, `src/features/scenarios/hooks/useTrash.ts`

#### Setup

1. Create Feature Group `Temp` with Scenario `SC1` containing 2 tests: `T1` and `T2`.

#### Steps

2. Expand `Temp` so `SC1` is visible.
3. Click the **Delete** button on `SC1`. In the confirmation modal, click **Move to Trash**.
4. Immediately look at the **bottom of the screen** (not inside any modal). A toast notification appears:
   - A `−` icon on the left
   - Text: **`SC1 moved to Trash`**
   - An **Undo** button on the right
   - An **✕** (dismiss) button
   - A thin **progress bar** at the bottom of the toast, visibly shrinking from right to left over 5 seconds
5. Click the **Undo** button within 5 seconds.

#### Verify

6. Confirm `SC1` reappears inside the `Temp` Feature Group at its original position.
7. Open the Trash Panel. Confirm it is empty (or does not contain `SC1`).
8. Expand `SC1` and confirm both `T1` and `T2` are present.

#### Expected Outcomes

- [ ] The toast appears at the bottom of the screen (rendered outside the main layout, overlaying the content)
- [ ] The toast text matches the format `[entity name] moved to Trash`
- [ ] The progress bar shrinks over 5 seconds, giving a visual countdown
- [ ] Clicking **Undo** immediately restores `SC1` inside `Temp` — no Trash Panel interaction needed
- [ ] After undo, `SC1` is absent from the Trash Panel (it was never committed to storage)
- [ ] Both `T1` and `T2` are present on the restored `SC1`
- [ ] The toast disappears after clicking Undo

---

### Test Scenario 9: Undo Toast — Auto-Dismiss After 5s

**Purpose**: Verify that if Undo is not clicked, the toast disappears on its own after 5 seconds, and the deleted item then remains in trash.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`

#### Steps

1. Delete any scenario. A toast appears at the bottom.
2. **Do not click** the Undo or ✕ buttons. Watch the toast.
3. After approximately **5 seconds**, observe what happens to the toast.
4. Open the Trash Panel.

#### Expected Outcomes

- [ ] The toast progress bar reaches zero (empty) after 5 seconds
- [ ] The toast disappears (slides or fades away) after the timer expires — no click required
- [ ] No ghost or residual toast element remains on screen after dismissal
- [ ] The Trash Panel shows the deleted item (it was committed to storage after the 5-second window)
- [ ] The Trash button badge count increased by 1

---

### Test Scenario 10: Undo Toast — Rapid Deletes (Timer Reset)

**Purpose**: Verify that deleting a second item while the first item's toast is still showing replaces the toast content and resets the 5-second timer from the beginning.

**Files**: `src/features/scenarios/components/TrashUndoToast.tsx`

#### Setup

1. Create Feature Group `Multi` with two scenarios: `Scenario A` and `Scenario B`.

#### Steps

2. Delete **Scenario A** — the toast appears: *`Scenario A moved to Trash`*. The progress bar starts counting down.
3. **Within 2 seconds** (while the first toast is still visible), delete **Scenario B**.
4. Observe the toast immediately after the second deletion.
5. Wait another 5 seconds without clicking Undo. Let the toast expire.
6. Open the Trash Panel.

#### Expected Outcomes

- [ ] After step 3: the toast content changes to *`Scenario B moved to Trash`* — the name updates to the latest delete
- [ ] The progress bar resets to full width (fresh 5-second countdown begins)
- [ ] Only one toast is visible at a time — no stacking or duplicate toasts
- [ ] Clicking **Undo** after the timer reset restores **Scenario B** (the most recent delete)
- [ ] After the toast expires: both `Scenario A` and `Scenario B` appear in the Trash Panel (Scenario A was committed to trash when Scenario B replaced it; Scenario B was committed when the timer expired)

---

## Phase 4: Trash Panel UI

### Test Scenario 11: Trash Panel — Browse & Item Display

**Purpose**: Verify that the Trash Panel displays all required metadata for each trashed item, correctly formatted, and sorted newest-first.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Setup

Delete the following 4 items in order (wait for each toast to expire before deleting the next, so they all end up in the Trash Panel):

1. A Feature Group named `FG Alpha` that contains 2 scenarios and 3 tests total
2. A Scenario named `Scenario Beta` (from any Feature Group with at least 1 test)
3. A Test named `Test Gamma` (from any scenario)
4. A Shared Data Source named `DS Delta`

#### Steps

5. After all 4 items are in trash, look at the **Trash** button in the Feature Groups header. Note the badge count.
6. Click the **Trash** button to open the Trash Panel.
7. Examine the panel title.
8. Examine each item card carefully.
9. Examine the footer.

#### Expected Outcomes

- [ ] The **Trash** button shows a badge with **4**
- [ ] The panel title reads **"Trash (4)"**
- [ ] Items are ordered **newest first** (DS Delta at top, FG Alpha at bottom)
- [ ] **FG Alpha** card shows:
  - Icon: 📁
  - Name: `FG Alpha`
  - Type badge: `Feature Group`
  - Child counts: `2 scenarios · 3 tests`
  - Parent path: empty (feature groups have no parent)
  - Deletion time: a relative timestamp (e.g., `2 minutes ago`)
  - Expiry: `Expires in 30 days`
  - **Restore** button and **Delete** button
- [ ] **Scenario Beta** card shows type badge `Scenario`, a parent path (the Feature Group it belonged to), and `1 test`
- [ ] **Test Gamma** card shows type badge `Test`, parent path `[FG Name] > [Scenario Name]`, no child counts
- [ ] **DS Delta** card shows type badge `Shared Data Source`
- [ ] The footer contains: **Retention** dropdown (showing `30 days`), **Max items** dropdown (showing `100`), **Empty Trash** button, **Close** button

---

### Test Scenario 12: Trash Panel — Search Filter

**Purpose**: Verify that the search box filters items by name and also by parent path, and that the filter is case-insensitive.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Setup

Delete 4 items (wait for toasts to expire on each):
- Feature Group: `Login Tests`
- Scenario: `Checkout Flow` (from any FG named something unrelated to "login")
- Test: `Auth Config` (from a Feature Group named `Auth Suite`)
- Scenario: `User Data Load`

#### Steps

1. Open the Trash Panel. All 4 items are visible.
2. Click inside the **Search trash…** input at the top of the panel and type `login`.
3. Observe the list.
4. Clear the search input (press **Backspace** or click the × in the input if present).
5. Type `auth` in the search box.
6. Observe the list.
7. Clear the search. Type `LOGIN` (uppercase).
8. Observe the list.
9. Clear the search. All 4 items should be visible again.

#### Expected Outcomes

- [ ] Typing `login` shows only `Login Tests` (name match); other 3 items are hidden
- [ ] Typing `auth` shows `Auth Config` (name match) AND potentially `Auth Config` via its parent path `Auth Suite > [scenario]` if the parent path is shown — both name and parent path are searched
- [ ] Typing `LOGIN` (uppercase) shows the same results as `login` — search is case-insensitive
- [ ] Clearing the search box restores all 4 items
- [ ] When no items match the search, the panel shows an empty state with 🔍 icon and "No items match your search"

---

### Test Scenario 13: Trash Panel — Restore to Original Parent

**Purpose**: Verify that restoring a trashed item returns it to the exact Feature Group (and Scenario) it came from, provided the parent still exists.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Setup

1. Create Feature Group `API Tests`.
2. Inside `API Tests`, create Scenario `Users`.
3. Add 2 tests to `Users`:
   - `Get User 1` — GET `https://jsonplaceholder.typicode.com/users/1`
   - `Get User 2` — GET `https://jsonplaceholder.typicode.com/users/2`
4. Delete `Users` (click **Delete** on the scenario row → confirm **Move to Trash**).
5. Wait for the undo toast to expire (do **not** click Undo).

#### Part B — Restore

6. Open the Trash Panel. `Users` should be listed with parent path `API Tests` and child count `2 tests`.
7. Click the **Restore** button on the `Users` entry.
8. The Trash Panel updates (the item count decreases). Close the panel.

#### Part C — Verify

9. In the Feature Groups list, find `API Tests` and expand it.
10. Confirm `Users` has reappeared.
11. Expand `Users` and confirm both `Get User 1` and `Get User 2` tests are present.

#### Expected Outcomes

- [ ] `Users` reappears inside `API Tests` at the scenario level
- [ ] Both `Get User 1` and `Get User 2` tests are present and intact
- [ ] The Trash Panel no longer contains `Users` after restoration
- [ ] The Trash button badge count decrements by 1
- [ ] No duplicate `Users` entry is created

---

### Test Scenario 14: Trash Panel — Restore Orphan (Parent Deleted)

**Purpose**: Verify that when a scenario's parent Feature Group has also been deleted (and is currently in trash or permanently gone), restoring the scenario places it inside a new auto-created Feature Group named "Restored Items".

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Setup

1. Create Feature Group `Temp FG`.
2. Inside `Temp FG`, create Scenario `Orphan SC`.
3. Add 1 test to `Orphan SC`: `GET /orphan` — GET `https://jsonplaceholder.typicode.com/posts/1`.
4. Delete `Orphan SC` (the scenario only — **not** the Feature Group yet). Wait for the toast to expire.
5. Now delete `Temp FG` (the Feature Group). Wait for the toast to expire.
6. Open the Trash Panel. Both `Orphan SC` and `Temp FG` should be listed.

#### Part B — Restore the orphan only

7. Click **Restore** on `Orphan SC` only. **Do not restore** `Temp FG`.
8. Close the Trash Panel.

#### Part C — Verify

9. In the Feature Groups list, look for a new Feature Group named **`Restored Items`**.
10. Expand `Restored Items` and confirm `Orphan SC` is inside it.
11. Expand `Orphan SC` and confirm the `GET /orphan` test is present.
12. Re-open the Trash Panel and confirm `Temp FG` is still there.

#### Expected Outcomes

- [ ] A new Feature Group named `Restored Items` appears in the Feature Groups list
- [ ] `Orphan SC` is placed inside `Restored Items` with its test intact
- [ ] `Temp FG` remains in the Trash Panel (it was not restored)
- [ ] The restored scenario has a unique ID (not colliding with the trashed `Temp FG`'s copy of the same scenario)
- [ ] No console errors about missing parent references

---

### Test Scenario 15: Trash Panel — Permanent Delete

**Purpose**: Verify that permanently deleting an item from the Trash Panel shows a confirmation dialog, then removes the item from the trash store completely with no way to recover it.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Setup

1. Delete any scenario and let the undo toast expire. Open the Trash Panel — it shows 1 item.

#### Steps

2. In the Trash Panel, find the item. On the right side of the item card, there are two buttons: **Restore** and **Delete**.
3. Click the **Delete** button (not Restore).
4. A second confirmation modal appears (nested on top of the Trash Panel) with:
   - Title: **"Delete Permanently"**
   - Message: *`Permanently delete "[item name]"? This cannot be undone.`*
   - Button: **Delete** (danger/red)
   - Button: **Cancel**
5. Click **Cancel**. Verify the item is still in the Trash Panel.
6. Click **Delete** again. This time, click **Delete** in the confirmation modal to confirm.

#### Verify

7. Confirm the item card disappears from the Trash Panel.
8. Open DevTools → **Application → IndexedDB → redfireforge → trash**. Confirm the record is no longer present.
9. The Trash Panel badge count decreases. If the item was the only one, the Trash button badge disappears.

#### Expected Outcomes

- [ ] Clicking **Delete** on a trash item opens a second confirmation modal (the Trash Panel stays visible behind it)
- [ ] Clicking **Cancel** on the confirmation modal keeps the item in the Trash Panel — nothing is deleted
- [ ] Clicking **Delete** in the confirmation modal removes the item from the Trash Panel instantly
- [ ] The item is removed from IndexedDB `trash` store (verified in DevTools)
- [ ] The item cannot be recovered — it is permanently gone

---

### Test Scenario 16: Trash Panel — Empty Trash

**Purpose**: Verify that the "Empty Trash" footer button permanently deletes every item in trash simultaneously after a confirmation.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`

#### Setup

1. Delete 5 different items (mix of Feature Groups, Scenarios, and Tests) and let all undo toasts expire. Open the Trash Panel — it should show 5 items.

#### Steps

2. In the Trash Panel footer, click the **Empty Trash** button.
3. A confirmation modal appears with:
   - Title: **"Empty Trash"**
   - Message: *`Permanently delete all 5 items? This cannot be undone.`*
   - Button: **Empty Trash** (danger/red)
   - Button: **Cancel**
4. Click **Cancel**. Verify all 5 items are still in the Trash Panel.
5. Click **Empty Trash** in the footer again. This time, click **Empty Trash** in the confirmation modal to confirm.

#### Verify

6. The Trash Panel body changes to the empty state: a `−` icon with the text **"Trash is empty"**.
7. Close the Trash Panel. The **Trash** button in the header no longer shows a badge.
8. Open DevTools → **Application → IndexedDB → redfireforge → trash**. Confirm the object store has zero records.

#### Expected Outcomes

- [ ] The confirmation message shows the exact item count (`5 items`)
- [ ] Clicking **Cancel** preserves all 5 items — nothing is deleted
- [ ] After confirming **Empty Trash**, all items disappear from the panel instantly
- [ ] The empty-state UI is shown: `−` icon, "Trash is empty" text
- [ ] The Trash button badge disappears (count is 0)
- [ ] IndexedDB `trash` store is empty (verified in DevTools)

---

## Phase 5: Settings & Polish

### Test Scenario 17: Settings — Retention Period

**Purpose**: Verify that changing the **Retention** dropdown in the Trash Panel footer changes the `expiresAt` calculation for *newly* deleted items, without affecting items already in trash.

**Files**: `src/features/scenarios/components/TrashPanel.tsx`, `src/features/scenarios/hooks/useTrash.ts`

#### Steps

1. Open the Trash Panel (click the **Trash** button in the Feature Groups header).
2. In the **footer**, find the **Retention** dropdown. The current value is `30` (days). Click it and select **7 days** from the dropdown options (`7`, `14`, `30`, `60`, `90`).
3. Close the Trash Panel.
4. Delete a new scenario (click **Delete** → **Move to Trash**). Wait for the toast to expire.
5. Open the Trash Panel. Find the newly deleted item.
6. Check the expiry text on the new item.
7. If any older items are also in the panel (from before the setting change), check their expiry text.

#### Expected Outcomes

- [ ] After changing to `7 days`, the **Retention** dropdown in the footer shows `7 days`
- [ ] The newly deleted item shows **`Expires in 7 days`** (not 30)
- [ ] Any items that were already in trash before the change retain their original expiry (still `Expires in ~30 days`)
- [ ] The retention setting is stored immediately — no save button required

---

### Test Scenario 18: Settings — Max Items Enforcement

**Purpose**: Verify that when the number of trash items exceeds the Max items limit, the oldest item(s) are automatically evicted so the total never exceeds the limit.

**Files**: `src/features/scenarios/hooks/useTrash.ts`, `src/shared/utils/trashStorage.ts`

> **Tip**: The minimum Max items value is `50`. To avoid creating 50+ items manually, use the shortcut below.

#### Shortcut: Change the limit via DevTools

1. Open DevTools → **Application → Local Storage → localhost:5173**.
2. Find the key `perf-test-trash-settings`. If it doesn't exist, create it.
3. Set its value to `{"retentionDays":30,"maxItems":3}` (sets the limit to 3 for easy testing).
4. Reload the page.

#### Steps

5. Open the Trash Panel footer. Confirm **Max items** shows `3` (if the shortcut above was used and the value appears in the dropdown) or proceed without the UI showing it.
6. Delete 3 items (Feature Groups, Scenarios, or Tests — any type). Let each toast expire. Verify all 3 appear in the Trash Panel.
7. Delete a **4th item** and let the toast expire.
8. Open the Trash Panel.

#### Expected Outcomes

- [ ] The Trash Panel shows at most **3 items** (the max)
- [ ] The **oldest item** (first deleted — at the bottom of the list) is no longer present
- [ ] The **newest item** (just deleted — at the top of the list) is present
- [ ] If some items had already expired, they are evicted first before evicting by age

#### Cleanup

9. Remove the `perf-test-trash-settings` key from localStorage (or set `maxItems` back to `100`) and reload.

---

### Test Scenario 19: Settings — Persistence Across Reload

**Purpose**: Verify that changes made to the Retention and Max items settings in the Trash Panel footer are saved and survive a full page reload.

**Files**: `src/shared/utils/trashStorage.ts`

#### Steps

1. Open the Trash Panel.
2. In the footer, change **Retention** from `30` to **14 days**.
3. Change **Max items** from `100` to **200**.
4. Close the Trash Panel.
5. **Reload the page** (press **Cmd+R** / **Ctrl+R**).
6. Open the Trash Panel again.
7. Inspect the footer dropdowns.

#### Verify in Storage

8. Open DevTools → **Application → Local Storage → localhost:5173**.
9. Find the key `perf-test-trash-settings` and confirm its value contains `"retentionDays":14` and `"maxItems":200`.

#### Expected Outcomes

- [ ] After reload, the **Retention** dropdown shows `14 days` (not the default 30)
- [ ] After reload, the **Max items** dropdown shows `200` (not the default 100)
- [ ] The `perf-test-trash-settings` localStorage key contains the saved values
- [ ] No errors during reload; trash items (if any) are still present

---

## Phase 2 (Advanced): Edge Cases

### Test Scenario 20: Restore with ID Collision

**Purpose**: Verify that when a trashed item's IDs collide with IDs of items that were re-created (e.g., via import), the restoration generates fresh unique IDs for the restored item to prevent data corruption.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Create the collision

1. Create Feature Group `Tests`.
2. Inside `Tests`, create Scenario `Login`.
3. Add 1 test: `POST /login` — POST `https://jsonplaceholder.typicode.com/posts`.
4. Export `Tests` to a JSON file: click **Export** in the Feature Groups header → save as `tests-export.json`.
5. Delete `Scenario Login` (the scenario only, not the FG). Wait for the toast to expire.
6. Now **import** `tests-export.json` back in: click **Import** in the Feature Groups header → select `tests-export.json`.
7. This recreates `Scenario Login` inside `Tests` with its original IDs (from the export file).
8. You now have a **live** `Scenario Login` (from import) and a **trashed** `Scenario Login` with the same original IDs.

#### Part B — Restore the trashed copy

9. Open the Trash Panel. Click **Restore** on `Scenario Login`.
10. Close the Trash Panel.

#### Part C — Verify

11. In the `Tests` Feature Group, observe how many `Login` scenarios are present and whether they have distinct appearances.
12. Open DevTools → **Console** and look for any ID-related errors.

#### Expected Outcomes

- [ ] The restored scenario appears in `Tests` alongside the imported one (no data is lost or overwritten)
- [ ] The restored scenario has a **different ID** from the imported one (new UUID was generated to avoid collision)
- [ ] The restored scenario's test also has a fresh ID
- [ ] The restored scenario name may have `(restored)` appended or another disambiguation suffix
- [ ] No console errors about duplicate IDs or ID conflicts

---

### Test Scenario 21: Restore with Stale Environment/Microservice

**Purpose**: Verify that restoring a Feature Group whose associated environment or microservice has since been deleted does not cause errors — the FG is restored as an unassociated item.

**Files**: `src/features/scenarios/hooks/useTrash.ts`

#### Part A — Setup with environment and microservice

1. Go to **Settings → Environments** (click the Settings icon in the vertical activity bar → Environments tab). Create an environment named `staging`.
2. Create a microservice named `auth-service` (in the microservices/services section of Settings).
3. Return to **Harness → Feature Groups**. In the left sidebar, select `staging` environment and `auth-service` microservice.
4. Create Feature Group `Auth Flow` with 1 scenario and 1 test.
5. Delete `Auth Flow` (click **Delete** → **Move to Trash**). Wait for the toast to expire.

#### Part B — Delete the environment

6. Go to **Settings → Environments**. Delete the `staging` environment.
7. Return to **Harness → Feature Groups**.

#### Part C — Restore the Feature Group

8. Open the Trash Panel. Click **Restore** on `Auth Flow`.
9. Close the panel.

#### Part D — Verify

10. In the Feature Groups view, look for `Auth Flow`. Note which service/environment context it appears in.
11. Check the sidebar — does it show as associated with a service/environment or unassociated?

#### Expected Outcomes

- [ ] `Auth Flow` is restored and appears in the Feature Groups view
- [ ] The restored FG is **unassociated** — it does not reference the deleted `staging` environment (those references are cleared during restore)
- [ ] The FG's scenarios and tests are fully intact
- [ ] No console errors about missing environment IDs or broken references
- [ ] The app does not crash or show error banners during restore

---

### Test Scenario 22: Structure Change Log — Restored Action

**Purpose**: Verify that restoring an item from trash is recorded in the Feature Group's structure change history with the action type `restored`.

**Files**: `src/features/scenarios/utils/structureChangeLog.ts`

#### Steps

1. Create Feature Group `Logged FG`.
2. Inside `Logged FG`, create Scenario `SC` with 1 test.
3. Delete `SC`. Wait for the toast to expire.
4. Open the Trash Panel. Restore `SC`.
5. Close the Trash Panel.
6. To inspect the change log, open DevTools → **Application → Local Storage** (or IndexedDB, depending on implementation).
7. Look for a key related to structure change logs, e.g. `perf-test-change-log` or similar. The value should be a JSON array of change events.
8. Find the most recent entry for `Logged FG` and examine its `action` field.

> **Alternative inspection method**: If the Scenario Builder has a visible **Change History** button on the Feature Group header row, click it to open the history panel and look for the restored entry.

#### Expected Outcomes

- [ ] A change log entry exists with `action: "restored"` (not `"added"` or `"deleted"`)
- [ ] The entry records the restored entity name (`SC`) and its type (`scenario`)
- [ ] The entry's timestamp matches the time of restoration (approximately `just now`)
- [ ] If a Change History UI is visible on the Feature Group, the history shows a restoration event with a distinct icon or label (not the standard "added" or "deleted" label)

---

## Phase 6: Full Testing

### Test Scenario 23: Unit Test Suite — Full Pass

**Purpose**: Verify all trash-related automated unit tests pass with zero failures.

**Files**: All `*.test.ts` / `*.test.tsx` files for the trash feature

#### Steps

Open a terminal in the project root and run:

```bash
cd /Users/dz5jxr/workspace/gmai/redfire-forge
npx vitest run \
  src/shared/utils/idbTrash.test.ts \
  src/shared/utils/trashStorage.test.ts \
  src/features/scenarios/hooks/useTrash.test.ts \
  src/features/scenarios/components/TrashUndoToast.test.tsx \
  src/features/scenarios/components/TrashPanel.test.tsx \
  src/features/scenarios/utils/structureChangeLog.test.ts \
  src/features/scenarios/hooks/useScenarioMutations.test.ts
```

Wait for all tests to complete.

#### Expected Outcomes

- [ ] All tests pass — output shows `XX tests passed` with 0 failures
- [ ] Total passing count is approximately 197 tests for this subset
- [ ] No tests are skipped (`todo` or `skip` status)
- [ ] No unexpected `console.error` or `console.warn` output in the test runner

---

### Test Scenario 24: TypeScript — Zero Errors

**Purpose**: Confirm the entire codebase compiles without type errors after the Trash Box feature was added.

#### Steps

```bash
cd /Users/dz5jxr/workspace/gmai/redfire-forge
npx tsc -b --noEmit
```

#### Expected Outcomes

- [ ] The command exits with code `0` (no output = success)
- [ ] Zero type errors related to `TrashItem`, `TrashEntityType`, `TrashSettings`, `useTrash`, `TrashPanel`, or `TrashUndoToast`

---

## Phase 7: Documentation & Gallery

### Test Scenario 25: Gallery — Sample Visible & Importable

**Purpose**: Verify the "Trash Recovery Demo" sample appears in the Gallery's Samples tab and can be imported into the Harness.

**Files**: `src/data/galleries/tests/index.ts`, `src/data/galleries/tests/presets.ts`

#### Steps

1. Click the **Gallery** icon in the far-left vertical activity bar (tooltip "Gallery").
2. In the secondary top navigation strip, click **Samples** (the first Gallery tab).
3. Scroll the sample cards or use the search/filter to find **"Trash Recovery Demo"**.
4. Click on the **Trash Recovery Demo** card to open its detail panel (or preview).
5. Inspect the card metadata.
6. Click **Import** (or **Use Sample** / equivalent) to add it to the Harness.
7. Navigate to **Harness → Feature Groups** and confirm the imported group appears.

#### Expected Outcomes

- [ ] A card for **"Trash Recovery Demo"** is visible in the Samples tab
- [ ] The card shows:
  - Icon: 🗑️
  - Name: "Trash Recovery Demo"
  - Difficulty: Easy (or "Easy ★☆☆")
  - Tags include: `trash`, `recovery`, `undo`, `restore`
  - Live API: `jsonplaceholder.typicode.com`
- [ ] The detail panel shows a linked training manual: **"Recovering Deleted Scenarios"**
- [ ] After importing, a Feature Group named **`Trash Box — Recovery Demo`** appears in the Feature Groups view
- [ ] The Feature Group contains 2 scenarios, each with at least 1 test
- [ ] The tests have working assertions (e.g., status code 200)

---

### Test Scenario 26: Training Manual — Accessible & Linked

**Purpose**: Verify the HTML training manual for the Trash feature can be opened from both the Gallery detail panel and the Training Tracks section.

**Files**: `docs/training-manuals/tests/trash-recovery-easy.html`, `src/data/galleries/trainingPaths/contentPaths.ts`

#### Part A — From the Gallery Samples detail panel

1. Navigate to **Gallery → Samples**.
2. Click the **Trash Recovery Demo** card.
3. In the detail panel, find the **Training Manuals** section.
4. Click the link **"Recovering Deleted Scenarios"**.
5. Confirm a new browser tab opens with the training manual HTML file.
6. Inspect the manual's content.

#### Part B — From Training Tracks

7. In the Gallery secondary navigation, click **Training Tracks**.
8. Find and open the **Test Suites** training path (or whichever path contains the trash manual).
9. Navigate to **Phase 1: Getting Started** (or the appropriate phase).
10. Find **"Recovering Deleted Scenarios"** in the content list.
11. Click it to open the manual.

#### Expected Outcomes

- [ ] The manual opens in a new browser tab displaying an HTML page
- [ ] The cover/header shows:
  - Icon: 🗑️
  - Title: **"Recovering Deleted Scenarios"**
  - Difficulty badge: **"Easy ★☆☆"** (or similar)
- [ ] The manual contains step-by-step exercises (at least 4 exercises)
- [ ] CSS styling matches other training manuals (consistent font, heading colors, layout)
- [ ] The manual references the **"Trash Recovery Demo"** gallery sample
- [ ] The training track entry shows a linked sample chip/badge for **"Trash Recovery Demo"** on the training path page

---

### Test Scenario 27: User Guide — Accessible from Docs

**Purpose**: Verify the Trash Box user guide is listed in the docs guides index and contains accurate, complete content.

**Files**: `docs/guides/trash-box-guide.md`, `docs/guides/README.md`

#### Steps

1. Open `docs/guides/README.md` in your text editor or file browser.
2. Find the section listing guides related to **Scenarios & Testing** (or similar grouping).
3. Confirm a `Trash Box Guide` entry exists.
4. Open `docs/guides/trash-box-guide.md` and scan through the sections.

#### Expected Outcomes

- [ ] `docs/guides/README.md` contains an entry like: `[Trash Box Guide](./trash-box-guide.md)` with a short description
- [ ] `docs/guides/trash-box-guide.md` contains sections covering:
  - Overview / what the Trash Box feature does
  - How soft deletion works (Move to Trash vs. permanent delete)
  - Instant Undo (the 5-second toast)
  - Trash Panel usage (browse, search, restore, permanent delete, empty)
  - Settings (Retention period, Max items)
  - Automatic Purge on startup
  - Storage details (IDB store name, localStorage fallback key)
  - Tips / best practices
- [ ] An ASCII art or text mockup of the undo toast is present
- [ ] The Settings table shows the correct values: retention options (`7, 14, 30, 60, 90 days`) and max items options (`50, 100, 200`)
- [ ] "Related Guides" links at the bottom point to existing guide files (no broken links)

---

## Phase 8: Project Conventions

### Test Scenario 28: Conventions & Changelog Updated

**Purpose**: Verify that all project-level documentation files (`project-conventions.mdc`, `CHANGELOG.md`, `README.md`) have been updated to reflect the Trash Box feature.

**Files**: `.cursor/rules/project-conventions.mdc`, `CHANGELOG.md`, `README.md`

#### Part A — project-conventions.mdc

1. Open `.cursor/rules/project-conventions.mdc` in your editor.
2. Find the **Key Files** table or section.
3. Verify that 6 trash-related entries exist.

#### Part B — CHANGELOG.md

4. Open `CHANGELOG.md`.
5. Find the `[Unreleased]` section near the top.
6. Verify a **"Trash Box — Soft Delete & Recovery"** entry or equivalent exists in the Added section.
7. Count the bullet points under the Trash Box entry.

#### Part C — README.md

8. Open `README.md`.
9. Find the **Feature Reference** table. Verify a `Trash Box` row exists with a description.
10. Find the **Data Persistence** or **IndexedDB** section. Verify the `trash` object store is listed.
11. Verify the DB version is listed as `4`.

#### Expected Outcomes

- [ ] `project-conventions.mdc` contains entries for these 6 files: `trashStorage.ts`, `idbTrash.ts`, `useTrash.ts`, `TrashPanel.tsx`, `TrashUndoToast.tsx`, `trash.css`
- [ ] `CHANGELOG.md` has at least 8–10 bullet points under the Trash Box feature entry
- [ ] `README.md` Feature Reference table contains a `Trash Box` row
- [ ] `README.md` IDB store list includes `trash` store with a brief description
- [ ] `README.md` shows database version `4`

---

## Cross-Phase Integration Tests

### Test Scenario 29: Data Persistence Across Reload

**Purpose**: Verify that all trash state — the item list, badge count, and settings — survives a full page reload without data loss.

**Files**: All storage + UI files

#### Steps

1. Open **Harness → Feature Groups** with Service and Environment selected.
2. Delete 3 different entity types (one Feature Group, one Scenario, one Test). Let all 3 undo toasts expire. Confirm the Trash button badge shows `3`.
3. Open the Trash Panel. Change **Retention** to `14 days`. Change **Max items** to `50`. Close the panel.
4. **Reload the page** (press **Cmd+R** / **Ctrl+R**). Wait for the app to fully load.
5. Look at the **Trash** button in the Feature Groups header. Note the badge.
6. Open the Trash Panel.

#### Expected Outcomes

- [ ] The Trash button badge still shows `3` after reload (auto-purge does not remove items that are not expired)
- [ ] All 3 items are present in the Trash Panel with correct names, types, parent paths, and expiry information
- [ ] The **Retention** dropdown shows `14 days` (persisted)
- [ ] The **Max items** dropdown shows `50` (persisted)
- [ ] Restoring any of the 3 items still works correctly after reload

---

### Test Scenario 30: Multi-Entity Trash Workflow (End-to-End)

**Purpose**: Full end-to-end test exercising all trash features in a realistic, complete workflow covering creation, deletion, undo, trash panel operations, and verification of the final state.

**Files**: All Phase 1–5 files

#### Part A — Setup (approx. 2 minutes)

1. In **Settings → Environments**, create environment `dev`. Create environment `prod`.
2. In the microservices/services section of Settings, create `user-service`.
3. Return to **Harness → Feature Groups**. Select `dev` environment and `user-service` microservice.
4. Create Feature Group `User CRUD`.
5. Inside `User CRUD`, create 3 scenarios:
   - `Create User` — add 2 tests: `POST /users` and `Validate Response`
   - `Get User` — add 1 test: `GET /users/1`
   - `Delete User` — add 1 test: `DELETE /users/1`
6. Create a Shared Data Source `User Test Data` (via the **📦 Shared Data Sources** button): add 3 columns and 5 rows.

#### Part B — Delete multiple items (approx. 1 minute)

7. Delete the test `GET /users/1` from the `Get User` scenario. **Immediately click Undo** (within 5 seconds). Confirm the test returns to `Get User`.
8. Delete Scenario `Delete User`. **Let the toast expire** (wait 5 seconds without clicking Undo).
9. Delete the Shared Data Source `User Test Data` (via the 📦 modal). **Let the toast expire**.
10. Delete Feature Group `User CRUD`. **Let the toast expire**.

After Part B, the Trash Panel should contain 3 items: `Delete User`, `User Test Data`, `User CRUD`.

#### Part C — Trash Panel operations (approx. 2 minutes)

11. Click the **Trash** button. Confirm the badge shows `3` and all 3 items are listed.
12. Type `delete` in the search box. Confirm only `Delete User` and `User CRUD` are visible (search matches name).
13. Clear the search. All 3 items are visible again.
14. Click **Restore** on `Delete User`. Since its parent `User CRUD` is also in trash, it should create a `Restored Items` Feature Group.
15. Close the Trash Panel. Confirm `Restored Items` appears in the Feature Groups list with `Delete User` inside it.
16. Re-open the Trash Panel. Click **Delete** on `User Test Data`. In the confirmation modal, click **Delete** to permanently delete it.
17. Click **Restore** on `User CRUD`. Close the Trash Panel.

#### Part D — Verify final state (approx. 1 minute)

18. The Feature Groups list should contain:
    - `User CRUD` — with only `Create User` (2 tests) and `Get User` (1 test). `Delete User` was restored separately and is not inside `User CRUD`.
    - `Restored Items` — with `Delete User` (1 test: `DELETE /users/1`).
19. `User CRUD` should still be associated with `dev` environment and `user-service` (these were not deleted).
20. Open the Trash Panel. It should be empty (all 3 items were either restored or permanently deleted).
21. Delete `Restored Items`. In the Trash Panel footer, change **Retention** to `7 days`. Close the panel. Reload the page.
22. After reload, open the Trash Panel: `Restored Items` is present, Retention shows `7 days`.

#### Expected Outcomes

- [ ] Undo works in Part B step 7: the `GET /users/1` test returns immediately after clicking Undo
- [ ] Orphan restore creates `Restored Items` FG (Part C step 14)
- [ ] Permanent delete removes `User Test Data` forever — it does not appear in Trash Panel again (Part C step 16)
- [ ] `User CRUD` restores with only `Create User` and `Get User` — `Delete User` is in `Restored Items`, not duplicated in `User CRUD` (Part D step 18)
- [ ] Environment/microservice association (`dev` / `user-service`) is preserved for the restored `User CRUD` (Part D step 19)
- [ ] Trash Panel is empty after all operations (Part D step 20)
- [ ] Retention setting of `7 days` persists across reload (Part D step 22)
- [ ] No console errors throughout the entire workflow

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
