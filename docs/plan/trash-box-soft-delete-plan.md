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

### Excluded (Future)

- Workflows (separate storage)
- Environments / Microservices (rarely deleted, low risk)
- Webhook saved scenarios (separate storage path)
- Test run history (already has its own retention)

---

## Data Model

### TrashItem Interface

```typescript
// src/shared/types/index.ts (new addition)

export interface TrashItem {
  id: string;                    // unique trash entry ID (uuid)
  deletedAt: number;             // Date.now() at time of deletion
  expiresAt: number;             // deletedAt + retentionMs
  entityType: 'featureGroup' | 'scenario' | 'test';
  entityName: string;            // display name of deleted item
  parentPath: string;            // breadcrumb: "FG Name" or "FG Name > Scenario Name"
  parentFeatureGroupId?: string; // original parent FG id (for scenario/test restore)
  parentScenarioId?: string;     // original parent scenario id (for test restore)
  data: FeatureGroup | TestScenario | Scenario;  // full deep snapshot
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
| Tauri (desktop) | Tauri FS | File: `perf-test-v3-trash.json` |

Settings stored under key: `"perf-test-v3-trash-settings"`

---

## Architecture

### File Structure

```
src/shared/utils/trashStorage.ts        — CRUD for trash items (load/save/purge)
src/shared/utils/idbTrash.ts            — IndexedDB backend for trash (mirrors idbFeatureGroups.ts)
src/features/scenarios/hooks/useTrash.ts — React hook: state, restore, delete permanently
src/features/scenarios/components/TrashPanel.tsx     — UI: list, restore, delete, empty
src/features/scenarios/components/TrashUndoToast.tsx — 5-second undo toast after deletion
src/styles/trash.css                     — Trash panel styles
```

### Persistence Flow

```
User clicks Delete
  → ConfirmModal "Move to Trash?" (updated messaging)
    → useScenarioMutations.removeXxx()
      → 1. Snapshot the item as TrashItem
      → 2. Call trashStorage.addToTrash(item)
      → 3. Filter item from featureGroups state (existing logic)
      → 4. Show TrashUndoToast (5s countdown)
         → If user clicks "Undo" → restoreFromTrash(id)
         → If timeout → toast disappears, item remains in trash

App loads
  → useProjects init
    → trashStorage.purgeExpired() — removes items past expiresAt
```

### Restore Flow

```
User opens Trash Panel → clicks "Restore"
  → useTrash.restoreItem(trashItemId)
    → 1. Load TrashItem from storage
    → 2. Determine restore target:
         a. If entityType === 'featureGroup':
            → Append to featureGroups array
         b. If entityType === 'scenario':
            → Find parentFeatureGroupId in current featureGroups
            → If found → insert into fg.scenarios
            → If not found → create "Restored Items" FG, insert there
         c. If entityType === 'test':
            → Find parentFeatureGroupId + parentScenarioId
            → If both found → insert into scenario.tests
            → If scenario missing → create "Restored Tests" scenario in the FG
            → If FG missing → create "Restored Items" FG with a new scenario
    → 3. Remove from trash storage
    → 4. Save featureGroups (triggers auto-persist)
```

---

## Implementation Phases

### Phase 1: Storage Layer (Est. 2 hours)

**Files to create:**
- `src/shared/utils/idbTrash.ts`
- `src/shared/utils/trashStorage.ts`

**Steps:**

1. **Bump IDB version** in `src/shared/utils/idbOpen.ts`:
   - Increment `DB_VERSION` from 3 → 4
   - Add `if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash');` in `onupgradeneeded`

2. **Create `idbTrash.ts`** (mirrors `idbFeatureGroups.ts`):
   - `idbLoadTrash(): Promise<TrashItem[] | null>`
   - `idbSaveTrash(items: TrashItem[]): Promise<void>`
   - Same IDB availability checks and error handling

3. **Create `trashStorage.ts`**:
   ```typescript
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

4. **Add `TrashItem` and `TrashSettings` types** to `src/shared/types/index.ts`

5. **Unit tests** for `trashStorage.ts`:
   - Add to trash, load, purge expired, empty, max items overflow (oldest evicted)

---

### Phase 2: Hook & Mutation Integration (Est. 2 hours)

**Files to modify:**
- `src/features/scenarios/hooks/useScenarioMutations.ts`

**Files to create:**
- `src/features/scenarios/hooks/useTrash.ts`

**Steps:**

1. **Create `useTrash` hook**:
   ```typescript
   export function useTrash(featureGroups, setFeatureGroups) {
     const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
     const [loading, setLoading] = useState(true);

     // Load trash on mount
     useEffect(() => { loadTrash().then(items => { setTrashItems(items); setLoading(false); }); }, []);

     // moveToTrash(entityType, data, parentPath, parentIds)
     // restoreItem(trashId) — handles all 3 entity types
     // permanentlyDelete(trashId)
     // emptyAllTrash()
     // undoLastDelete() — restores most recent item (for toast)

     return { trashItems, loading, moveToTrash, restoreItem, permanentlyDelete, emptyAllTrash, undoLastDelete, trashCount };
   }
   ```

2. **Modify `useScenarioMutations`**:
   - Accept `moveToTrash` as a parameter (injected from parent)
   - `removeFeatureGroup`: snapshot FG → `moveToTrash('featureGroup', fg, fg.name, {})` → filter
   - `removeScenario`: snapshot scenario → `moveToTrash('scenario', sc, ...)` → filter
   - `removeTest`: snapshot test → `moveToTrash('test', t, ...)` → filter
   - Update confirm dialog messages: "Delete" → "Move to Trash" (softer language)

3. **Wire `useTrash` into `useProjects`**:
   - Call `purgeExpired()` during initialization (alongside loadFeatureGroups)
   - Expose `trashCount` for badge display

4. **Unit tests**:
   - Move to trash preserves full data snapshot
   - Restore into existing parent
   - Restore when parent is missing (creates fallback container)
   - Undo immediately after delete

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

2. **Integrate into `ScenarioBuilder`**:
   - Render `TrashUndoToast` when `lastDeletedItem` is set
   - Clear state after timeout or undo

3. **Styles** in `src/styles/trash.css`:
   - Slide-up animation
   - Progress bar countdown
   - Dark theme consistent with app

---

### Phase 4: Trash Panel UI (Est. 3 hours)

**Files to create:**
- `src/features/scenarios/components/TrashPanel.tsx`
- `src/styles/trash.css` (extend)

**Steps:**

1. **Create `TrashPanel` component**:
   - Accessed via a "Trash" button/icon in the Feature Groups toolbar
   - Opens as a slide-out panel or modal
   - Header: trash icon + item count + "Empty Trash" button (with confirm)
   - List of trashed items, sorted by `deletedAt` (newest first):
     - Icon by entity type (folder / scenario / test)
     - Entity name (bold)
     - Parent path breadcrumb (muted)
     - "Deleted X days ago · Expires in Y days"
     - Action buttons: [Restore] [Delete Forever]
   - Empty state: "Trash is empty" with subtle icon
   - Search/filter by name

2. **Restore confirmation**:
   - If parent exists → restore silently, show success toast
   - If parent missing → show info: "Original location no longer exists. Item will be restored to a new 'Restored Items' group."

3. **Permanent delete confirmation**:
   - ConfirmModal: "Permanently delete '<name>'? This cannot be undone."

4. **Empty Trash confirmation**:
   - ConfirmModal: "Permanently delete all N items? This cannot be undone."

5. **Trash badge** on the toolbar button:
   - Shows count of items in trash (e.g., red/orange badge with number)
   - Hidden when trash is empty

6. **Keyboard shortcut**:
   - `Cmd+Z` / `Ctrl+Z` after a delete triggers undo (same as toast button)

---

### Phase 5: Settings & Polish (Est. 1 hour)

**Steps:**

1. **Add trash settings to Settings page** (if one exists) or to a Trash Panel footer:
   - Retention period: dropdown (7 / 14 / 30 / 60 / 90 days)
   - Max items: input (50 / 100 / 200)
   - "Items are automatically deleted after the retention period"

2. **Update confirm dialog wording**:
   - Old: "Delete feature group 'X'? This cannot be undone."
   - New: "Move feature group 'X' to Trash? You can restore it within 30 days."

3. **Handle edge cases**:
   - Deleting a FG that contains scenarios already in trash (don't duplicate)
   - Restoring a scenario into a FG that was also trashed (offer to restore FG first)
   - Max items overflow: when adding to trash and at capacity, purge oldest expired first, then oldest item if still over limit

4. **Accessibility**:
   - ARIA labels on all trash panel buttons
   - Focus management when opening/closing panel
   - Screen reader announcements for undo toast

---

### Phase 6: Testing (Est. 2 hours)

**Unit tests:**
- `trashStorage.test.ts` — all CRUD operations, purge logic, max items
- `useTrash.test.ts` — hook behavior, restore paths, undo
- `useScenarioMutations` updates — verify moveToTrash is called
- `TrashPanel.test.tsx` — render, restore click, delete click, empty

**Integration considerations:**
- Verify IDB version upgrade doesn't break existing data
- Verify Tauri FS path works correctly
- Test localStorage fallback

---

## UI/UX Reference

### Trash Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│  ◀ Feature Groups    🗑 Trash (3)        [Empty Trash]  │
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
└─────────────────────────────────────────────────────────┘
```

### Undo Toast

```
┌────────────────────────────────────────────┐
│  "Login Flow" moved to Trash    [Undo]     │
│  ████████████░░░░░░░░░░░  3s remaining     │
└────────────────────────────────────────────┘
```

---

## Migration & Compatibility

- **No data migration needed** — trash is a new, additive store
- **IDB version bump** (3 → 4) triggers `onupgradeneeded` which creates the new `"trash"` object store alongside existing stores
- **Backward compatible** — old versions without trash simply don't have the store; upgrading creates it transparently
- **Export/Import** — trash items are NOT included in JSON/CSV exports (only active data is exported)

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

## Estimated Total Effort

| Phase | Effort |
|-------|--------|
| 1. Storage Layer | 2 hours |
| 2. Hook & Mutation Integration | 2 hours |
| 3. Undo Toast | 1 hour |
| 4. Trash Panel UI | 3 hours |
| 5. Settings & Polish | 1 hour |
| 6. Testing | 2 hours |
| 7. Docs, Guides & Gallery | 3 hours |
| **Total** | **~14 hours** |

---

## Open Questions (Resolve Before Implementation)

1. **Panel vs Modal?** — Should the Trash be a slide-out panel (always accessible) or a full modal?
2. **Trash for Workflows?** — Should workflow deletions also go to trash, or keep them separate for now?
3. **Retention default** — 30 days is generous. Should we start with 7 days for web (localStorage size concerns)?
4. **Cross-tab sync** — If user has multiple tabs open, should trash be synced via BroadcastChannel?
