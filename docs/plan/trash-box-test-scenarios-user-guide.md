# Trash Box — User Testing Guide

> Rewritten from user perspective for manual re-testing.
> Each scenario has clear step-by-step instructions you can follow in the app.
> **Do NOT mark as done** — test each one yourself and check off manually.

---

## Before You Start

1. Start the app: `npm run dev` (web) or `npm run tauri:dev` (desktop)
2. Open `http://localhost:5173` in Chrome/Edge
3. Make sure you have DevTools open (F12) → Application → IndexedDB tab ready

---

## Scenario 1: IDB Store Creation

**Goal**: Confirm the IndexedDB `trash` store was created properly.

### Steps

1. Open **DevTools → Application → IndexedDB** (left sidebar)
2. Expand **redfireforge** database
3. Look at the version number in the database header

### What You Should See

- [ ] The database version shows **4**
- [ ] You see 4 object stores: `featureGroups`, `testRuns`, `sharedDataSources`, `trash`
- [ ] No errors in the Console tab about IDB
- [ ] If you had existing data, it's all still there (not wiped)

---

## Scenario 2: Storage Fallback (localStorage)

**Goal**: Confirm trash works even when IndexedDB is unavailable.

### Steps

1. Open an **Incognito/Private** window in your browser
2. Navigate to `http://localhost:5173`
3. Go to **Harness** tab → create a Feature Group → add a scenario
4. Delete the scenario (click the Delete button on the scenario row)
5. Confirm the "Move to Trash" dialog
6. Open **DevTools → Application → Local Storage** → look for keys starting with `perf-test`
7. Open the **Trash** panel from the toolbar

### What You Should See

- [ ] Trash keys appear in localStorage (fallback worked silently)
- [ ] The deleted scenario appears in the Trash Panel
- [ ] Click **Restore** — the scenario returns to the tree
- [ ] No errors about IndexedDB in the Console

---

## Scenario 3: Delete Feature Group → Trash

**Goal**: Confirm that deleting a Feature Group soft-deletes it with all children preserved.

### Steps

1. Go to **Harness** tab
2. Click **+ Add Feature Group** → name it **Payment Flow** → Create
3. Inside Payment Flow, create 2 scenarios:
   - **Happy Path** — add 2 tests inside it
   - **Error Cases** — add 1 test inside it
4. Click the **Delete** button on the **Payment Flow** Feature Group row
5. A dialog appears: *"Move feature group 'Payment Flow' to Trash?"*
6. Click **Move to Trash**

### What You Should See

- [ ] Payment Flow immediately disappears from the sidebar
- [ ] An **undo toast** appears at the bottom: *"Payment Flow moved to Trash"*
- [ ] Wait for the toast to expire (~5 seconds)
- [ ] Click the **Trash** button in the toolbar → the panel opens
- [ ] The item shows:
  - Type badge: **Feature Group**
  - Name: **Payment Flow**
  - Child counts: **2 scenarios · 3 tests**
  - Deletion time: *a few seconds ago* (or similar)
  - Expiry: *Expires in 30 days* (or your current retention setting)
- [ ] No console errors

---

## Scenario 4: Delete Scenario → Trash

**Goal**: Confirm that deleting a scenario preserves its tests and records the parent path.

### Steps

1. Create Feature Group **Auth Tests** → add scenario **Login Flow** → add 3 tests inside it
2. Click the **Delete** button on **Login Flow** scenario
3. Confirm the "Move to Trash" dialog
4. Open the **Trash** panel

### What You Should See

- [ ] Login Flow disappears from Auth Tests, but **Auth Tests** FG remains
- [ ] Undo toast appears
- [ ] In the Trash Panel, the item shows:
  - Type: **Scenario**
  - Parent path: **Auth Tests**
  - Children: **3 tests**
- [ ] No console errors

---

## Scenario 5: Delete Test → Trash

**Goal**: Confirm deleting a single test records both parent FG and parent Scenario in the path.

### Steps

1. Create Feature Group **Users** → Scenario **Get User** → Test **GET /users/1**
2. Click the **Delete** button on the test **GET /users/1**
3. Confirm the dialog
4. Open the Trash Panel

### What You Should See

- [ ] The test disappears from the scenario, but the scenario **Get User** remains
- [ ] Trash item shows:
  - Type: **Test**
  - Parent path: **Users > Get User**
  - No child counts (tests have no children)
- [ ] Undo toast appears
- [ ] No console errors

---

## Scenario 6: Delete Shared Data Source → Trash

**Goal**: Confirm that Shared Data Sources are soft-deleted (not permanently removed).

### Steps

1. Go to **Harness → Data Sources** tab (click "Data Sources" in the top nav)
2. Create a shared data source named **Test Users** — add 3 columns and a few rows
3. Delete **Test Users** using the Delete button
4. Open the Trash Panel

### What You Should See

- [ ] Test Users disappears from the Data Sources list
- [ ] Trash Panel shows it with type: **Shared Data Source**
- [ ] Undo toast appears
- [ ] Click **Restore** in the Trash Panel → Test Users returns to the Data Sources list with all columns and rows intact

---

## Scenario 7: Auto-Purge on Startup

**Goal**: Confirm that expired trash items are automatically removed when the app loads.

### Steps

1. Delete 3 different items (any types) — wait for toasts to expire
2. Open **DevTools → Application → IndexedDB → redfireforge → trash**
3. Click on the `all` key to see the stored trash array
4. Find one item and manually edit its `expiresAt` field to a past timestamp (e.g., `Date.now() - 86400000`)
   - You can do this in the Console: open the trash store, get the value, modify one item's `expiresAt`, put it back
5. **Reload the page** (Cmd+R / Ctrl+R)
6. Open the Trash Panel

### What You Should See

- [ ] The expired item is **gone** from the Trash Panel
- [ ] The other 2 items are still present
- [ ] In the Console, you see a log: `[Trash] Purged 1 expired item(s)`
- [ ] No startup errors

---

## Scenario 8: Undo Toast — Immediate Recovery

**Goal**: Confirm clicking Undo within 5 seconds restores the item instantly.

### Steps

1. Create Feature Group **Temp** → Scenario **SC1** → Test **T1**
2. Delete scenario **SC1** — a toast appears at the bottom
3. **Immediately** click **Undo** on the toast (within 5 seconds)

### What You Should See

- [ ] Toast shows: *"SC1 moved to Trash"* with a shrinking progress bar
- [ ] After clicking Undo, the toast disappears immediately
- [ ] **SC1** reappears inside **Temp** with its test intact
- [ ] Open Trash Panel → it's empty (the item was never committed to trash)

---

## Scenario 9: Undo Toast — Auto-Dismiss After 5s

**Goal**: Confirm the toast auto-dismisses and the item stays in trash.

### Steps

1. Delete any item
2. **Do NOT click** Undo — just watch the toast for 5 seconds

### What You Should See

- [ ] The progress bar shrinks from full to zero over ~5 seconds
- [ ] The toast disappears automatically
- [ ] Open Trash Panel → the item is still there
- [ ] No ghost toast stuck on screen

---

## Scenario 10: Undo Toast — Rapid Deletes (Timer Reset)

**Goal**: Confirm that a second delete replaces the toast and resets the timer.

### Steps

1. Create Feature Group **Multi** → Scenario **A** → Scenario **B**
2. Delete Scenario **A** — toast says: *"A moved to Trash"*
3. **Within 2 seconds**, delete Scenario **B**

### What You Should See

- [ ] The toast changes to: *"B moved to Trash"*
- [ ] The progress bar resets to full width (fresh 5-second countdown)
- [ ] Clicking Undo now restores **B** (the most recent delete)
- [ ] **A** remains in the Trash Panel (its undo window was replaced by B)
- [ ] Only **one** toast is visible at a time (no stacking)

---

## Scenario 11: Trash Panel — Browse & Item Display

**Goal**: Verify the Trash Panel displays all metadata correctly.

### Steps

1. Delete 4 different items:
   - 1 Feature Group (with scenarios/tests)
   - 1 Scenario
   - 1 Test
   - 1 Shared Data Source
2. Wait for all toasts to expire
3. Click the **Trash** button in the toolbar

### What You Should See

- [ ] Trash button shows a badge with **4**
- [ ] Panel title: **Trash (4)**
- [ ] Each item card shows:
  - Entity icon (different for each type)
  - Entity name
  - Type badge (Feature Group / Scenario / Test / Shared Data Source)
  - Parent path (if applicable)
  - Child counts (for FG and Scenario)
  - Relative deletion time (*a few seconds ago*)
  - Expiry countdown (*Expires in 30 days*)
  - **Restore** button
  - **Delete** button
- [ ] Items are sorted newest-first (most recently deleted at top)
- [ ] Footer shows: Retention dropdown, Max items dropdown, Empty Trash button, Close button

---

## Scenario 12: Trash Panel — Search Filter

**Goal**: Confirm the search bar filters items by name and parent path.

### Steps

1. Delete items named: **Login Flow**, **Checkout**, **Auth Config**, **User Data**
2. Open the Trash Panel
3. Type `login` in the search bar

### What You Should See

- [ ] Only **Login Flow** is visible
- [ ] Other items are hidden
- [ ] Clear the search → all items reappear
- [ ] Search is case-insensitive: `LOGIN` and `login` both work
- [ ] Typing a parent path name (e.g., if parent FG is "Auth Tests", typing `auth`) also filters correctly

---

## Scenario 13: Trash Panel — Restore to Original Parent

**Goal**: Confirm restoring puts the item back in its original parent.

### Steps

1. Create Feature Group **API Tests** → Scenario **Users** → add 2 tests
2. Delete Scenario **Users** → wait for toast to expire
3. Open Trash Panel → click **Restore** on **Users**
4. Close the panel

### What You Should See

- [ ] **Users** scenario reappears inside **API Tests**
- [ ] Both original tests are present
- [ ] The item is gone from the Trash Panel
- [ ] Trash badge count decreases by 1

---

## Scenario 14: Trash Panel — Restore Orphan (Parent Deleted)

**Goal**: When the parent FG no longer exists, restoration creates a "Restored Items" FG.

### Steps

1. Create Feature Group **Temp FG** → Scenario **Orphan SC** → 1 test
2. Delete Scenario **Orphan SC** → wait for toast
3. Delete Feature Group **Temp FG** → wait for toast
4. Open Trash Panel
5. **Restore only** **Orphan SC** — leave **Temp FG** in trash

### What You Should See

- [ ] A new Feature Group named **Restored Items** appears in the sidebar
- [ ] **Orphan SC** is inside it with its test intact
- [ ] **Temp FG** remains in the Trash Panel
- [ ] No console errors

---

## Scenario 15: Trash Panel — Permanent Delete

**Goal**: Confirm that permanently deleting removes it forever.

### Steps

1. Delete any item → wait for toast
2. Open Trash Panel → click the **Delete** button on the item
3. A confirmation appears: *"Permanently delete 'X'? This cannot be undone."*
4. Click **Delete** to confirm

### What You Should See

- [ ] The item disappears from the Trash Panel
- [ ] It's gone from IndexedDB (check DevTools → Application → IndexedDB → trash)
- [ ] If you click **Cancel** instead, the item stays
- [ ] The item cannot be recovered after permanent deletion

---

## Scenario 16: Trash Panel — Empty Trash

**Goal**: "Empty Trash" permanently deletes everything.

### Steps

1. Delete 5 different items → wait for toasts
2. Open Trash Panel → should show 5 items
3. Click **Empty Trash** in the footer
4. Confirmation: *"Permanently delete all 5 items?"*
5. Click **Empty Trash** to confirm

### What You Should See

- [ ] Trash Panel shows: *"Trash is empty"*
- [ ] Trash button badge disappears
- [ ] IndexedDB `trash` store is empty
- [ ] Clicking **Cancel** on the confirmation keeps all items

---

## Scenario 17: Settings — Retention Period

**Goal**: Changing retention affects the expiry of newly deleted items.

### Steps

1. Open Trash Panel → change **Retention** dropdown to **7 days** (in the footer)
2. Close the panel
3. Delete a scenario
4. Open Trash Panel → check the new item's expiry

### What You Should See

- [ ] The new item shows **Expires in 7 days** (not 30)
- [ ] Previously deleted items retain their original expiry (e.g., 30 days)
- [ ] The Retention dropdown still shows **7 days**

---

## Scenario 18: Settings — Max Items Enforcement

**Goal**: When trash exceeds the limit, the oldest items are evicted.

### Steps

1. Open Trash Panel → change **Max items** to **50**
2. For a quick test, use DevTools Console to temporarily set max to a low number:
   ```js
   localStorage.setItem('perf-test-v3-trash-settings', JSON.stringify({ retentionDays: 30, maxItems: 3 }));
   ```
3. Reload the page
4. Delete 4+ items

### What You Should See

- [ ] Trash Panel shows at most 3 items (or your chosen max)
- [ ] The oldest item (first deleted) is automatically evicted
- [ ] The newest item is always at the top

---

## Scenario 19: Settings — Persistence Across Reload

**Goal**: Trash settings survive a page reload.

### Steps

1. Open Trash Panel → set **Retention** to **14 days**, **Max items** to **200**
2. Close the panel
3. **Reload the page** (Cmd+R)
4. Open Trash Panel again

### What You Should See

- [ ] Retention still shows **14 days**
- [ ] Max items still shows **200**
- [ ] Check `localStorage` for key `perf-test-v3-trash-settings` — values are persisted

---

## Scenario 20: Restore with ID Collision

**Goal**: Restoring an item whose IDs collide with existing items generates new UUIDs.

### Steps

1. Create Feature Group **Tests** → Scenario **Login** → Test **T1**
2. Export **Tests** as JSON (use Export feature)
3. Delete Scenario **Login** → wait for toast
4. Import the JSON — this recreates **Login** with the same original IDs
5. Open Trash Panel → click **Restore** on the trashed **Login**

### What You Should See

- [ ] The restored scenario appears in **Tests** alongside the imported one
- [ ] The restored scenario has `(restored)` appended to its name
- [ ] No duplicate ID errors in the Console
- [ ] Both scenarios work independently

---

## Scenario 21: Restore with Stale Environment/Microservice

**Goal**: If the original environment/microservice no longer exists, the FG is restored without them.

### Steps

1. Create environment **staging** and microservice **auth-service**
2. Select them in the sidebar filter
3. Create Feature Group **Auth Flow** (associated with staging/auth-service)
4. Delete **Auth Flow** → wait for toast
5. Go to **Settings → Environments** → delete **staging**
6. Open Trash Panel → Restore **Auth Flow**

### What You Should See

- [ ] **Auth Flow** is restored as an **unassociated** Feature Group
- [ ] It appears in the "All" view, not under the deleted environment
- [ ] Scenarios and tests inside are fully intact
- [ ] No console errors

---

## Scenario 22: Structure Change Log — Restored Action

**Goal**: Restored items are recorded in the Feature Group's structure change history.

### Steps

1. Create Feature Group **Logged FG** → Scenario **SC** → Test **T**
2. Delete Scenario **SC** → wait for toast
3. Open Trash Panel → Restore **SC**
4. Check **Logged FG**'s change history (if visible) or inspect localStorage/IDB for structure change log entries

### What You Should See

- [ ] A change entry with action **restored** exists
- [ ] The entry records the restored item's name and type
- [ ] The action label shows *"Restored from trash"* with an icon (↩)
- [ ] The timestamp is correct

---

## Scenario 23: Unit Test Suite — Full Pass

**Goal**: All trash-related unit tests pass.

### Steps

```bash
npx vitest run \
  src/shared/utils/idbTrash.test.ts \
  src/shared/utils/trashStorage.test.ts \
  src/features/scenarios/hooks/useTrash.test.ts \
  src/features/scenarios/components/TrashUndoToast.test.tsx \
  src/features/scenarios/components/TrashPanel.test.tsx \
  src/features/scenarios/utils/structureChangeLog.test.ts \
  src/features/scenarios/hooks/useScenarioMutations.test.ts \
  src/features/scenarios/hooks/useSharedDsCrud.test.ts
```

### What You Should See

- [ ] **228 tests pass** (0 failures)
- [ ] No unexpected console warnings

---

## Scenario 24: TypeScript — Zero Errors

**Goal**: Entire codebase compiles cleanly.

### Steps

```bash
npx tsc -b --noEmit
```

### What You Should See

- [ ] Exit code 0
- [ ] Zero type errors

---

## Scenario 25: Gallery — Sample Visible & Importable

**Goal**: The "Trash Recovery Demo" sample appears in the Gallery.

### Steps

1. Navigate to **Gallery** (top nav)
2. Go to the **Tests** tab
3. Search or scroll to find **Trash Recovery Demo**
4. Click on it to view details
5. Click **Import** to add it to the harness

### What You Should See

- [ ] Sample card shows name **Trash Recovery Demo**, difficulty **Easy**
- [ ] Tags include `#trash`, `#recovery`, `#undo`, `#restore`
- [ ] Live APIs shows `jsonplaceholder.typicode.com`
- [ ] Detail panel shows a linked training manual: *Recovering Deleted Scenarios*
- [ ] Importing creates a Feature Group named **Trash Box — Recovery Demo** with 2 scenarios

---

## Scenario 26: Training Manual — Accessible & Linked

**Goal**: The HTML training manual opens from Gallery and Training Paths.

### Steps

1. Go to **Gallery → Tests** → click **Trash Recovery Demo**
2. In the detail panel, find the **Training Manuals** section → click the manual link
3. Also go to **Gallery → Training Paths** → open the **Test Suites** path → find *Recovering Deleted Scenarios*

### What You Should See

- [ ] Manual opens with cover page, title *Recovering Deleted Scenarios*, badge *Easy*
- [ ] Manual has 8 steps and 4 exercises
- [ ] CSS styling matches other training manuals
- [ ] Training path entry shows a linked sample chip

---

## Scenario 27: User Guide — Accessible from Docs

**Goal**: The user guide is in the docs and has correct content.

### Steps

1. Open `docs/guides/README.md` in your editor
2. Find the "Scenarios & Testing" section
3. Open `docs/guides/trash-box-guide.md`

### What You Should See

- [ ] README has entry: **Trash Box Guide** with link to `./trash-box-guide.md`
- [ ] Guide covers: Overview, How Deletion Works, Instant Undo, Trash Panel, Settings, Automatic Purge, Storage, Tips
- [ ] Has ASCII art mockup of the undo toast
- [ ] Settings table: retention 7–90 days, max items 50–200
- [ ] Related Guides links work

---

## Scenario 28: Conventions & Changelog Updated

**Goal**: Project documentation reflects the Trash Box feature.

### Steps

1. Open `.cursor/rules/project-conventions.mdc` → find **Key Files** table
2. Open `CHANGELOG.md` → find `[Unreleased]` section
3. Open `README.md` → find Feature Reference table and IndexedDB section

### What You Should See

- [ ] Key Files table has 6 trash entries: `trashStorage.ts`, `idbTrash.ts`, `useTrash.ts`, `TrashPanel.tsx`, `TrashUndoToast.tsx`, `trash.css`
- [ ] CHANGELOG has *Trash Box — Soft Delete & Recovery* with 10 bullet points
- [ ] README Feature Reference has **Trash Box** row
- [ ] README IDB table has `trash` store
- [ ] README DB version is **4**

---

## Scenario 29: Data Persistence Across Reload

**Goal**: Trash items, settings, and badge survive a full page reload.

### Steps

1. Delete 3 different entity types (Feature Group, Scenario, Shared Data Source)
2. Change retention to 14 days, max items to 50
3. **Reload the page** (Cmd+R)
4. Open the Trash Panel

### What You Should See

- [ ] All 3 items are present after reload
- [ ] Trash badge shows **3**
- [ ] Retention shows **14 days**
- [ ] Max items shows **50**
- [ ] Item metadata (names, types, child counts, expiry) is preserved
- [ ] Restore still works after reload

---

## Scenario 30: Multi-Entity Trash Workflow (End-to-End)

**Goal**: Full end-to-end test of all trash features.

### Part A — Setup (~2 minutes)

1. Create environments: **dev**, **prod**
2. Create microservice: **user-service**
3. Select **dev** + **user-service**
4. Create Feature Group **User CRUD** (associated with dev/user-service)
5. Add 3 scenarios:
   - **Create User** (2 tests)
   - **Get User** (1 test)
   - **Delete User** (1 test)
6. Go to Data Sources → create **User Test Data** with 5 rows

### Part B — Delete multiple items (~1 minute)

7. Delete Test **GET /users/1** from Get User → click **Undo** immediately → it comes back
8. Delete Scenario **Delete User** → let toast expire
9. Delete Shared Data Source **User Test Data** → let toast expire
10. Delete Feature Group **User CRUD** → let toast expire

### Part C — Trash Panel operations (~2 minutes)

11. Open Trash Panel → verify 3 items (Delete User, User Test Data, User CRUD)
12. Search for `delete` → only **Delete User** and **User CRUD** should match
13. Clear search
14. Restore **Delete User** → since parent FG is also in trash, a **Restored Items** FG should be created
15. Permanently delete **User Test Data** → confirm → it's gone forever
16. Restore **User CRUD** → should appear with only **Create User** and **Get User** scenarios

### Part D — Verify final state (~1 minute)

17. Sidebar should show: **User CRUD** (2 scenarios) + **Restored Items** (1 scenario)
18. **User CRUD** should be associated with **dev** / **user-service** (if they still exist)
19. Trash Panel should be empty
20. Delete **Restored Items** → change retention to 7 days → close → reload → verify settings persisted

### What You Should See

- [ ] Undo works for step 7
- [ ] Orphan restore creates **Restored Items** FG (step 14)
- [ ] Permanent delete removes the item forever (step 15)
- [ ] FG restore preserves remaining children only (step 16)
- [ ] Final sidebar has 2 FGs with correct scenario counts (step 17)
- [ ] Environment/microservice preserved for restored FG (step 18)
- [ ] Trash is empty after all operations (step 19)
- [ ] Settings persist across reload (step 20)
- [ ] No console errors throughout the entire workflow

---

## Bug Found & Fixed During Testing

### Shared Data Source not soft-deleted (Scenario 6)

**Issue**: Deleting a Shared Data Source performed a permanent hard-delete instead of soft-deleting to trash. The `useSharedDsCrud` hook was not wired to the `moveToTrash` function.

**Fix**: Added `moveToTrash` prop to `useSharedDsCrud` and `SharedDataSourceModal`. When provided, `handleDelete` and `confirmDelete` now call `moveToTrash('sharedDataSource', ...)` before removing the item from the list. Three new unit tests were added to verify the integration.

**Files changed**:
- `src/features/scenarios/hooks/useSharedDsCrud.ts` — added `moveToTrash` option, refactored delete to use `performDelete` helper
- `src/features/scenarios/components/SharedDataSourceModal.tsx` — added `moveToTrash` prop, passed to `useSharedDsCrud`
- `src/features/scenarios/components/ScenarioBuilderModals.tsx` — passes `trash.moveToTrash` to `SharedDataSourceModal`
- `src/features/scenarios/hooks/useSharedDsCrud.test.ts` — 3 new tests for moveToTrash integration

### Minor Issue: Hardcoded "30 days" in confirm dialogs

**Issue**: The delete confirmation dialogs in `useScenarioMutations.ts` say *"You can restore it within 30 days"* regardless of the current retention setting. If the user changed retention to 7 days, this message is misleading.

**Status**: Noted for future fix. The actual expiry is correctly calculated from the current retention setting — only the dialog copy is hardcoded.
