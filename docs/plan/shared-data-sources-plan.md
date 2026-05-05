# Shared Data Sources — Redesign Plan

> **Created:** 2026-05-03
> **Updated:** 2026-05-04
> **Branch:** `feature/parameterized-tests`
> **Parent Plan:** `docs/plan/parameterized-test-plan.md` (Phase 19B)

---

## Overview

Promote Shared Data Sources from a per-FeatureGroup concern to a **top-level, harness-wide resource** at the environment → microservice level. Any parameterized test across any feature group / scenario can freely reference a shared data source.

**Key Principles:**
- Reuse existing components (`AppModalFrame`, `PopulateFromApiModal`, `DataSourceVerifyModal`, `proxyFetch`)
- Extract `useDataSourceTable` hook from `DataSourceEditor` — shared table editing logic, zero duplication
- Each shared DS gets an optional `fetchConfig` (URL + method + headers + body) for API-driven population and verification
- Delete the old per-FG `SharedDataSourceManager` and inline panel

---

## Phase Status Tracker

| Phase | Name | Status | Started | Completed | Branch |
|-------|------|--------|---------|-----------|--------|
| 1 | Data Model & Storage | ✅ Done | 2026-05-03 | 2026-05-03 | `feature/parameterized-tests` |
| 2 | Extract `useDataSourceTable` Hook | ✅ Done | 2026-05-03 | 2026-05-03 | `feature/parameterized-tests` |
| 3 | SharedDataSourceModal — Shell & List Panel | ✅ Done | 2026-05-03 | 2026-05-04 | `feature/parameterized-tests` |
| 4 | SharedDataSourceModal — Editor Panel | ✅ Done | 2026-05-03 | 2026-05-04 | `feature/parameterized-tests` |
| 5 | SharedDataSourceModal — Fetch Config & API Features | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 6 | Promote & Demote Workflows | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 7 | Wiring — ScenarioBuilder, DataSourceEditor, TestRunner | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 7.5 | Create Test from Shared Data Source | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 7.6 | UI Polish & Improvements | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 8 | Migration & Cleanup | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 9 | Tests | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |
| 10 | Docs, Training Manuals, Gallery Samples | ✅ Done | 2026-05-04 | 2026-05-04 | `feature/parameterized-tests` |

---

## Phase 1 — Data Model & Storage

### Goal
Promote `SharedDataSource[]` from `FeatureGroup` to top-level state. Add `fetchConfig` to `SharedDataSource`. Create storage functions.

### Type Changes

```typescript
// src/shared/types/index.ts

// ADD fetchConfig + tags to SharedDataSource
export interface SharedDataSource {
  id: string;
  name: string;
  tags?: string[];            // Categorization (e.g., "prod", "qa", "vins") — for list filtering
  dataSource: DataSource;
  updatedAt: number;
  /** Optional fetch configuration for API-driven population / verification */
  fetchConfig?: SharedDataSourceFetchConfig;
}

export interface SharedDataSourceFetchConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: KeyValue[];
  body?: string;
  bodyType?: BodyType;        // Content-type handling (json, form, raw, etc.)
  auth?: AuthConfig;          // Reuse existing AuthConfig (bearer, basic, oauth2, etc.)
}

// REMOVE from FeatureGroup:
//   sharedDataSources?: SharedDataSource[];
```

### Storage (`src/shared/utils/storage.ts`)

```typescript
// New IDB store + load/save pair — same pattern as featureGroups
export async function loadSharedDataSources(): Promise<SharedDataSource[]>;
export async function saveSharedDataSources(ds: SharedDataSource[]): Promise<void>;
```

### State (`src/features/scenarios/hooks/useProjects.ts`)

```typescript
// Add to useProjects return:
sharedDataSources: SharedDataSource[];
setSharedDataSources: Dispatch<SetStateAction<SharedDataSource[]>>;
```

### Export/Import

Add `sharedDataSources` key to project JSON export/import in `storage.ts` (`exportAll` / `importAll`).

### Success Criteria
- [x] `SharedDataSource.fetchConfig` type defined (with `auth`, `bodyType`)
- [x] `SharedDataSource.tags` type defined
- [ ] `FeatureGroup.sharedDataSources` removed from type *(deferred to Phase 7 — Migration & Cleanup)*
- [x] `loadSharedDataSources()` / `saveSharedDataSources()` implemented
- [x] `useProjects` exposes `sharedDataSources` / `setSharedDataSources`
- [x] Project export includes `sharedDataSources`
- [x] Project import restores `sharedDataSources` (with dedup by ID — see Design Decisions §1)
- [x] Auto-persist on change (same useEffect pattern as featureGroups)
- [x] TypeScript clean (`npx tsc --noEmit`)

### Implementation Notes (Phase 1)

**Completed 2026-05-03** on branch `feature/parameterized-tests`.

#### Files Changed
| File | Change |
|------|--------|
| `src/shared/types/index.ts` | Added `SharedDataSourceFetchConfig` interface; extended `SharedDataSource` with `tags?` and `fetchConfig?` |
| `src/shared/utils/idbOpen.ts` | Bumped `DB_VERSION` 2→3; added `sharedDataSources` object store |
| `src/shared/utils/idbSharedDataSources.ts` | **New file** — `idbLoad/Save/MigrateSharedDataSources` (same blob pattern as `idbFeatureGroups`) |
| `src/shared/utils/storage.ts` | Added `FLAT_SHARED_DS_KEY`, `loadSharedDataSources`, `saveSharedDataSources` (IDB-first + localStorage fallback) |
| `src/features/scenarios/hooks/useProjects.ts` | Added `sharedDataSources` state, load in init, auto-persist useEffect, exposed in return |
| `src/features/scenarios/hooks/useScenarioExportImport.ts` | `exportAll` includes `sharedDataSources` in wrapper; `importAll` extracts & deduplicates by ID |
| `src/features/scenarios/ScenarioBuilder.tsx` | Added optional `sharedDataSources`/`setSharedDataSources` props, threaded to export/import hook |
| `src/app/App.tsx` | Destructures new state from `useProjects`, passes to `ScenarioBuilder` |

#### Design Decisions
1. **`FeatureGroup.sharedDataSources` NOT removed yet** — kept for backward compat; removal deferred to Phase 7 (Migration & Cleanup) to avoid breaking existing data and tests.
2. **IDB store uses blob pattern** (single key `"all"`) — consistent with `featureGroups` store; simpler than per-record keys for a dataset expected to have <100 items.
3. **`importAll` refactored inline** — instead of using `importWithVersionPrompt` indirection, `importAll` now calls `pickJsonFile` directly so it can access the raw wrapper to extract `sharedDataSources` before `unwrapImport` discards it.
4. **Props optional** — `sharedDataSources`/`setSharedDataSources` are optional in `ScenarioBuilder` and `useScenarioExportImport` to maintain backward compat with tests that don't pass them.

---

## Phase 2 — Extract `useDataSourceTable` Hook

### Goal
Extract all table-editing logic from `DataSourceEditor` into **layered reusable hooks**. Both `DataSourceEditor` and `SharedDataSourceModal` will consume them.

### Architecture — Layered Hooks

Rather than one monolithic hook with 60+ return values, split into **composable layers**:

```typescript
// src/features/scenarios/hooks/useDataSourceRows.ts
// Row CRUD, bulk ops, selection, drag, search/sort
interface UseDataSourceRowsOptions {
  dataSource: DataSource;
  onChange: (ds: DataSource) => void;
}

interface UseDataSourceRowsReturn {
  // Row CRUD
  addRow: () => void;
  addSampleRow: () => void;
  removeRow: (rowId: string) => void;
  moveRow: (rowId: string, direction: 'up' | 'down') => void;
  duplicateRow: (rowId: string) => void;
  toggleRow: (rowId: string) => void;
  toggleSample: (rowId: string) => void;
  updateCell: (rowId: string, colId: string, value: string) => void;
  updateRowLabel: (rowId: string, label: string) => void;
  updateRowNote: (rowId: string, note: string) => void;
  deleteAllRows: () => void;

  // Bulk selection
  selectedRows: Set<string>;
  handleRowSelect: (rowId: string, e: React.MouseEvent) => void;
  selectAll: () => void;
  clearSelection: () => void;
  bulkEnable: (enabled: boolean) => void;
  bulkDelete: () => void;
  bulkDuplicate: () => void;

  // Sort / search / drag
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  handleSortColumn: (colId: string) => void;
  dragRowId: string | null;
  handleDragStart: (rowId: string) => void;
  handleDragOver: (e: React.DragEvent, rowId: string) => void;
  handleDrop: (e: React.DragEvent) => void;

  // Derived
  filteredSortedRows: DataSourceRow[];
}
```

```typescript
// src/features/scenarios/hooks/useDataSourceColumns.ts
// Column CRUD, type management
interface UseDataSourceColumnsOptions {
  dataSource: DataSource;
  onChange: (ds: DataSource) => void;
}

interface UseDataSourceColumnsReturn {
  addColumn: () => void;
  removeColumn: (colId: string) => void;
  updateColumn: (colId: string, patch: Partial<DataSourceColumn>) => void;
  editingColId: string | null;
  setEditingColId: (id: string | null) => void;
}
```

```typescript
// src/features/scenarios/hooks/useDataSourceFetch.ts
// Fetch, verify, re-fetch operations
interface UseDataSourceFetchOptions {
  dataSource: DataSource;
  onChange: (ds: DataSource) => void;
  fetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  scenario?: Scenario;
}

interface UseDataSourceFetchReturn {
  fetchRowResponse: (rowId: string) => Promise<void>;
  refetchAllRows: () => Promise<void>;
  fetchingRowId: string | null;
  refetchingAll: boolean;
  fetchRowError: string | null;
}
```

```typescript
// src/features/scenarios/hooks/useDataSourceTable.ts
// Thin orchestrator — composes all three + extras (import, config, tags, contract)
interface UseDataSourceTableOptions {
  dataSource: DataSource;
  onChange: (ds: DataSource) => void;
  fetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  scenario?: Scenario;
}

type UseDataSourceTableReturn =
  UseDataSourceRowsReturn &
  UseDataSourceColumnsReturn &
  UseDataSourceFetchReturn & {
    // Import
    handleImport: () => void;

    // Config
    handleDistributionChange: (d: DataSource['distribution']) => void;
    handleValidationModeChange: (m: DataSource['validationMode']) => void;

    // Validation contract
    toggleContractPattern: (pattern: string, makeDynamic: boolean) => void;
    addContractPattern: (pattern: string) => void;
    removeContractPattern: (pattern: string) => void;
    toggleArrayMode: (arrayPrefix: string) => void;

    // Tags (from useDataSourceTags)
    filterTag: string;
    setFilterTag: (t: string) => void;
    addTagToRow: (rowId: string, tag: string) => void;
    removeTagFromRow: (rowId: string, tag: string) => void;
    bulkAddTag: (tag: string) => void;
    bulkRemoveTag: (tag: string) => void;
    addSubset: (name: string, filter: DataSubset['filter']) => void;
    removeSubset: (name: string) => void;
  };
```

### Why Layered?
- **Independently testable** — Each hook has 10-15 focused unit tests, not one giant test file
- **Selective consumption** — `SharedDataSourceModal` editor can skip tags/contract if not needed initially
- **Single Responsibility** — Columns, rows, and fetch are orthogonal concerns
- **Smaller PRs** — Can implement and merge one hook at a time

### Approach
1. Create `useDataSourceRows`, `useDataSourceColumns`, `useDataSourceFetch` hooks individually
2. Create `useDataSourceTable` as a thin composition of the three + extras (import, config, tags)
3. Refactor `DataSourceEditor` to use `useDataSourceTable` (preserves existing API surface)
4. Validate `DataSourceEditor` behavior is identical (no functional change)

### Success Criteria
- [x] `useDataSourceRows` hook created and tested
- [x] `useDataSourceColumns` hook created and tested
- [x] `useDataSourceFetch` hook created and tested
- [x] `useDataSourceTable` orchestrator composes all three
- [ ] `DataSourceEditor` refactored to use `useDataSourceTable` *(deferred — hooks available for Phase 3-4; DataSourceEditor refactoring will follow once SharedDataSourceModal validates the API)*
- [x] All existing DataSourceEditor behavior preserved (manual smoke test)
- [x] Existing unit tests still pass
- [x] TypeScript clean

### Implementation Notes (Phase 2)

**Completed 2026-05-03** on branch `feature/parameterized-tests`.

#### Files Created
| File | Purpose |
|------|---------|
| `src/features/scenarios/hooks/useDataSourceRows.ts` | Row CRUD, bulk ops, selection, drag, search/sort/filter (280 lines) |
| `src/features/scenarios/hooks/useDataSourceColumns.ts` | Column CRUD, type management, URL template sync (85 lines) |
| `src/features/scenarios/hooks/useDataSourceFetch.ts` | Fetch row response, re-fetch all, populate validate columns (180 lines) |
| `src/features/scenarios/hooks/useDataSourceTable.ts` | Orchestrator composing rows + columns + fetch + tags + contract (155 lines) |
| `src/features/scenarios/hooks/useDataSourceRows.test.ts` | 26 unit tests covering all row/bulk/search/sort/filter operations |
| `src/features/scenarios/hooks/useDataSourceColumns.test.ts` | 7 unit tests covering column CRUD and URL template sync |

#### Design Decisions
1. **DataSourceEditor NOT refactored yet** — The component has 1671 lines with special linked-shared-DS logic, effectiveDraft refs, clipboard paste, keyboard navigation, column resize, and 700+ lines of JSX. Refactoring inline would risk regressions. The hooks are independently usable and will be validated by SharedDataSourceModal in Phase 3-4. DataSourceEditor refactoring is deferred.
2. **Hook API uses `onChange(DataSource)` not `onScenarioChange(Scenario)`** — The sub-hooks (`useDataSourceRows`, `useDataSourceColumns`, `useDataSourceFetch`) operate on `DataSource` directly. The `useDataSourceTable` orchestrator bridges to `onScenarioChange(Scenario)` for components that need it.
3. **`useDataSourceRows` owns `filterTag` state** — Rather than coupling to `useDataSourceTags`, the rows hook has its own `filterTag`/`setFilterTag` that the orchestrator syncs from the tags hook. This keeps sub-hooks independently usable.
4. **33 new unit tests** — All passing alongside existing 33 DataSourceEditor + tags tests (66 total for this area).

---

## Phase 3 — SharedDataSourceModal — Shell & List Panel

### Goal
Build the modal shell with left panel (list of shared DSs + CRUD) and header button in ScenarioBuilder.

### UI Layout

Modal dimensions: **1100×680px** (max 95vw × 90vh). Draggable by header, expandable to full viewport.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📦 Shared Data Sources                              [expand] [close] │
├────────────────┬─────────────────────────────────────────────────────┤
│                │  Editor Header:                                     │
│ [+ New ▍▍▍▍▍] │  [Production VINs_________] Updated 2 hours ago      │
│                │                                                     │
│ ▸ Prod VINs 12│  ▾ Fetch Configuration                              │
│ ▸ Test Users 8│    URL / Method / Headers / Body / Auth              │
│ ▸ SKU List  45│                                                     │
│                │  [+Row] [+Sample] [+Col] [⬇ API] [▶ Verify] [↻]   │
│                │  ┌─────────────────────────────────────────┐        │
│                │  │ vin      │ make  │ model │ year │ ...   │        │
│                │  │──────────│───────│───────│──────│───────│        │
│                │  │ 1HGCM... │ Honda │ Accor │ 2003 │       │        │
│                │  └─────────────────────────────────────────┘        │
│                │                                                     │
│                │  Used by: [VIN Decode/smoke/test] [Inventory/...]   │
├────────────────┴─────────────────────────────────────────────────────┤
│  3 shared data sources · 65 total rows                      [Close]  │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

```
src/features/scenarios/components/SharedDataSourceModal.tsx
```

### Left Panel Features
- **"+ New"** button — full-width, creates blank SharedDataSource (1 column, 1 row)
- **Tag filter dropdown** — filter list by `tags[]` (e.g., "prod", "qa"); shows all when unfiltered
- **Search input** — filter by name substring
- **List items** — name, row count badge (muted, right-aligned), `⋯` button (opacity 0 → 1 on hover)
- **Active item** — left border accent + subtle highlight background (`.ds-list-item.active`)
- **Context menu** (⋯ button or right-click) — Rename, Duplicate, Delete, Edit Tags
- **Delete confirmation** — shows usage count ("Used by 3 tests. Delete anyway?")
- **List panel width** — fixed 220px with vertical scroll for items

### Editor Header Features
- **Inline name input** — editable text field in the editor header (not just list panel); saves on blur/Enter
- **"Updated X ago"** — relative timestamp displayed beside the name (from `updatedAt`)
- **Editor switches** — selecting a different list item swaps the editor content immediately

### Footer
- **Aggregate stats** — "N shared data sources · M total rows" (left-aligned)
- **Close button** — right-aligned

### ScenarioBuilder Button

```tsx
// In div.header-actions, before "+ Add Feature Group"
// Note: Uses accent color border + text for visual distinction from other header buttons
<button
  className="btn"
  onClick={() => setShowSharedDsModal(true)}
  disabled={!selectedSvcId || !selectedEnvId}
  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
>
  📦 Shared Data Sources
  {sharedDataSources.length > 0 && (
    <span className="count-badge" style={{ background: 'var(--accent)' }}>
      {sharedDataSources.length}
    </span>
  )}
</button>
```

### Props

```typescript
interface SharedDataSourceModalProps {
  sharedDataSources: SharedDataSource[];
  onUpdate: (sources: SharedDataSource[]) => void;
  featureGroups: FeatureGroup[]; // for "Used by" display
  onClose: () => void;
}
```

### Success Criteria
- [x] Modal opens from header button (accent-colored, with 📦 icon)
- [x] Modal dimensions: 1100×680px (max 95vw × 90vh)
- [x] Create / rename / delete shared DSs
- [x] List shows name + row count badge + hover ⋯ menu
- [x] Delete warns when shared DS is in use
- [x] "Used by" section in editor footer shows referencing tests as `FG / scenario / test-name` breadcrumbs
- [x] Modal footer shows aggregate stats (count + total rows)
- [x] Editor header has inline name input + "Updated X ago" timestamp
- [x] Modal is draggable and expandable
- [x] TypeScript clean

### Implementation Notes (Phase 3)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Created/Changed
| File | Change |
|------|--------|
| `src/features/scenarios/components/SharedDataSourceModal.tsx` | Full implementation: list panel, context menu, rename, delete confirmation, "Used by" display |
| `src/features/scenarios/ScenarioBuilder.tsx` | Added header button with accent styling and count badge, modal state and rendering |
| `src/styles/shared-data-source-modal.css` | Styles for list panel, list items, context menu, resize handle |

---

## Phase 4 — SharedDataSourceModal — Editor Panel

### Goal
Right panel: full table editor using `useDataSourceTable` hook. Provides the same editing experience as `DataSourceEditor`.

### Editor Panel Features (all via `useDataSourceTable`)
- Add / remove / rename columns
- Add / remove / duplicate / reorder rows
- Cell editing with keyboard navigation (Tab, Enter, arrows)
- Column type selector (path / param / body / header / validate)
- Bulk selection (click, Ctrl+click, Shift+click)
- Bulk enable/disable/delete/duplicate
- Search / filter / sort
- Drag-to-reorder rows
- Row labels and notes
- Sample row toggle
- Tag management
- Distribution mode selector
- Validation mode selector
- CSV / JSON / Excel import (via `handleImport` from hook)
- Validation contract panel

### Toolbar Layout

```
[+Row] [+Sample] [+Col] [⬇ From API] [▶ Verify All] [↻ Re-fetch]
[Import] [Distribution ▾] [Validation ▾] [Contract] [🗑 Clear]
```

### Success Criteria
- [x] Full table editing works (columns, rows, cells)
- [x] Bulk selection and operations
- [x] Search / sort / drag-to-reorder
- [x] Tags and subsets
- [x] CSV/JSON/Excel import
- [x] Distribution and validation mode
- [x] Keyboard navigation (Tab/Enter/arrows)
- [x] Column resize
- [x] Row detail modal opens correctly

### Implementation Notes (Phase 4)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Changed
| File | Change |
|------|--------|
| `src/features/scenarios/components/SharedDataSourceModal.tsx` | Integrated `DataSourceEditor` in right panel with full editing capabilities |
| `src/features/scenarios/components/DataSourceEditor.tsx` | Reused with `isSharedDsEditor` mode for shared DS context |

---

## Phase 5 — SharedDataSourceModal — Fetch Config & API Features

### Goal
Add the optional `fetchConfig` section (URL + method + headers + body) and wire up Populate from API, Verify All, and Re-fetch using the existing modals.

### Fetch Config UI

**Expanded State:**
```
┌──────────────────────────────────────────────────────────────┐
│ ▾ Fetch Configuration     Used for Populate from API, Verify │
│ URL:      [https://api.example.com/products              ]   │
│ Method:   [GET ▾]  Headers: [pill] [pill] [+ Add]           │
│ Body:     [{ "filter": "active" }         ] [📋 cURL]       │
│ Body Type:[JSON ▾]                                           │
│ Auth:     [Bearer Token ▾] [token-value-or-profile-ref   ]   │
└──────────────────────────────────────────────────────────────┘
```

**Collapsed State** (saves vertical space for the table):
```
┌──────────────────────────────────────────────────────────────┐
│ ▸ Fetch Configuration    GET https://api.example.com/...     │
└──────────────────────────────────────────────────────────────┘
```

> When collapsed, the header shows a one-line summary: `{method} {url}` in accent color.
> This gives users at-a-glance context without expanding.

> **Auth integration:** Reuses the existing `AuthConfig` selector component (same as TestEditorModal).
> Supports: None, Bearer Token, Basic Auth, OAuth2 Client Credentials.

### Synthetic Scenario Pattern

```typescript
function toSyntheticScenario(shared: SharedDataSource): Scenario {
  return {
    id: shared.id,
    name: shared.name,
    url: shared.fetchConfig?.url ?? '',
    method: shared.fetchConfig?.method ?? 'GET',
    headers: shared.fetchConfig?.headers ?? [],
    body: shared.fetchConfig?.body ?? '',
    auth: shared.fetchConfig?.auth ?? { type: 'none' },
    validation: { mode: shared.dataSource.validationMode ?? 'none' },
    dataSource: shared.dataSource,
  } as Scenario;
}
```

> **Note:** Uses the shared DS's own `validationMode` (not a hardcoded value). Also passes
> `fetchConfig.auth` through to the synthetic scenario so auth profiles (bearer, OAuth2, etc.)
> are respected during Populate from API and Verify All operations.

### Wiring

| Button | Action |
|--------|--------|
| **⬇ From API** | Opens `PopulateFromApiModal` with synthetic scenario. `onApply` updates `shared.dataSource` |
| **▶ Verify All** | Opens `DataSourceVerifyModal` with synthetic scenario. `onDraftChange` patches `shared.dataSource` |
| **↻ Re-fetch** | Calls `useDataSourceTable.refetchAllRows()` using `proxyFetch` with fetchConfig |
| **⚡ Row fetch** | Calls `useDataSourceTable.fetchRowResponse(rowId)` using fetchConfig |

### Buttons Disabled When
- `fetchConfig` is not configured → "⬇ From API", "▶ Verify All", "↻ Re-fetch", row-level "⚡" are disabled
- No validate columns → "▶ Verify All" disabled

### Copy as cURL

Inline button in the fetch config body row. Reuses `catalogCurlGenerator.ts` pattern to generate a cURL command from `fetchConfig`. Copies to clipboard on click.

### Success Criteria
- [x] Fetch config UI (URL, method, headers as pills, body, bodyType, auth)
- [x] Collapsible section with one-line summary when collapsed (`{method} {url}`)
- [x] Fetch config saved and persisted
- [x] Populate from API works via `PopulateFromApiModal`
- [ ] Verify All works via `DataSourceVerifyModal` *(deferred — using Configure Variables wizard instead)*
- [x] Re-fetch all rows works *(via Configure Variables wizard)*
- [x] Per-row fetch works
- [ ] Buttons disabled when no fetchConfig *(Configure Variables available without fetchConfig)*
- [x] Copy as cURL (inline button)

### Implementation Notes (Phase 5)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Created/Changed
| File | Change |
|------|--------|
| `src/features/scenarios/components/SharedDataSourceModal.tsx` | Fetch config panel with collapsible UI, tabs (Params/Auth/Headers/Body), cURL import, method selector |
| `src/features/scenarios/hooks/useSharedDsFetchConfig.ts` | **New hook** — encapsulates fetch config state management, cURL parsing, auth handling |
| `src/features/scenarios/hooks/useSharedDsFetchConfig.test.ts` | Unit tests for the hook |
| `src/features/scenarios/components/DataSourceSetupModal.tsx` | 4-step wizard (Variables → Columns → Validate → Create) for shared DS configuration |
| `src/features/scenarios/components/SetupStepVariables.tsx` | Step 1: Path/Query/Header/Body variable detection with auth config |
| `src/features/scenarios/components/SetupStepValidate.tsx` | Step 3: Validate field detection with API fetch and contract patterns |
| `src/features/scenarios/components/SetupStepReview.tsx` | Step 4: Full review summary with edit actions |
| `src/features/scenarios/utils/dataSourceSetupUtils.ts` | Utility functions for URL template building, column definition construction |
| `src/styles/csv-import.css` | Extended styles for 4-step wizard UI |

#### Design Changes from Original Plan
1. **Replaced "Verify All" with Configure Variables wizard** — Instead of a separate verify modal, the 4-step `DataSourceSetupModal` wizard provides a more comprehensive flow for setting up validation rules.
2. **cURL Import** — Added full cURL import support for quickly populating fetch configuration.
3. **Auth in Step 1** — Auth configuration moved to the Variables step so users configure it alongside variable detection.
4. **Tabbed fetch config** — Fetch configuration uses tabs (Params/Auth/Headers/Body) instead of a single expanded form.

---

## Phase 6 — Promote & Demote Workflows

### Goal
Enable users to promote inline parameterized data to a Shared Data Source, and demote (copy back) from shared to inline. Provide clear UI for both directions with impact awareness.

### User Stories

1. **Promote to Shared:** User has developed a parameterized test with inline data. They want to share this data across multiple tests. They click "Promote to Shared" → data is copied to a new Shared Data Source → the test is auto-linked to it.

2. **Demote (Detach with Copy):** User has a test linked to a shared DS but wants to customize the data for this specific test. They click "Detach" → shared data is copied to inline → link is removed.

3. **Edit Shared Data (with Impact Warning):** User edits a Shared Data Source. Before saving, they see a confirmation showing which tests will be affected.

### UI Components

#### 6.1 — "Promote to Shared" Button (DataSourceEditor)

Location: Toolbar, next to existing buttons, visible only when:
- Test has inline `dataSource` (not empty)
- Test is NOT currently linked to a shared DS

```
[+Row] [+Sample] [+Col] [Import ▾] [⬆ Promote to Shared] [Contract]
```

**Button behavior:**
1. Click opens `PromoteToSharedModal`
2. User enters name for the new Shared Data Source (pre-filled: `{testName} Data`)
3. Optional: Add tags for categorization
4. Preview shows: column count, row count, URL template (if any)
5. Confirm → creates SharedDataSource, links test to it

#### 6.2 — PromoteToSharedModal

```
┌──────────────────────────────────────────────────────────────┐
│ ⬆ Promote to Shared Data Source                      [close] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Name: [User Profile Test Data___________]                   │
│                                                              │
│  Tags: [prod] [users] [+ Add]                (optional)      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Preview                                                │  │
│  │ • 5 columns: id, name, email, role, expected_status    │  │
│  │ • 12 data rows (10 enabled, 2 disabled)                │  │
│  │ • URL template: /api/users/{{id}}                      │  │
│  │ • Validation: selective (3 validate columns)           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ⚠ After promotion:                                          │
│  • This test will be linked to the new shared data source   │
│  • Inline data will be removed from this test               │
│  • Edit data in "📦 Shared Data Sources" modal              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                              [Cancel]  [⬆ Promote & Link]    │
└──────────────────────────────────────────────────────────────┘
```

#### 6.3 — Enhanced "Detach" with Options

Current "✂ Detach" becomes a dropdown with two options:

```
[✂ Detach ▾]
  ├─ Copy to Inline (keep shared DS unchanged)
  └─ Unlink Only (test becomes empty, shared DS unchanged)
```

**"Copy to Inline"** (default, recommended):
- Copies current shared DS data to test's inline `dataSource`
- Removes `sharedDataSourceId`
- Test now has its own independent copy

**"Unlink Only"**:
- Just removes `sharedDataSourceId`
- Test has no data (unless it had inline data before linking)
- Rarely used — mainly for cleanup

#### 6.4 — Impact Warning on Shared DS Edit

When user edits a Shared Data Source in `SharedDataSourceModal`, show impact awareness:

**Option A: Passive indicator (always visible)**
```
┌─────────────────────────────────────────────────────────────┐
│ Used by: [FG1/Scenario/Test1] [FG2/Scenario/Test2] [+3 more]│
└─────────────────────────────────────────────────────────────┘
```
This already exists. Enhanced behavior:
- Clicking a badge navigates to that test (closes modal, opens TestEditorModal)
- Badge turns amber when data has unsaved changes

**Option B: Save confirmation (on close with changes)**
```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Save Changes?                                      [close] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  You've modified "Production VINs" data source.              │
│                                                              │
│  This will affect 4 tests:                                   │
│  • VIN Decode / smoke / Decode Test                          │
│  • VIN Decode / regression / Full Decode                     │
│  • Inventory / check / Stock Lookup                          │
│  • Inventory / check / Price Verify                          │
│                                                              │
│  Changes:                                                    │
│  • 2 rows added                                              │
│  • 1 column renamed (vin → vehicleId)                        │
│  • 3 cell values modified                                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│               [Discard Changes]  [Review Tests]  [Save All]  │
└──────────────────────────────────────────────────────────────┘
```

**Option C: Per-test selective save (advanced)**
Allow user to choose which tests get the update:
- Checkbox per affected test
- "Select All" / "Deselect All"
- Unselected tests automatically detach and keep old data copy

> **Recommendation:** Implement Option A (passive indicator) + Option B (save confirmation) first.
> Option C is complex and rarely needed — defer to future iteration.

### Implementation

#### New Files

| File | Purpose |
|------|---------|
| `src/features/scenarios/components/PromoteToSharedModal.tsx` | Promotion wizard modal |
| `src/features/scenarios/components/DetachOptionsPopover.tsx` | Dropdown for detach options |
| `src/features/scenarios/components/SharedDsSaveConfirmModal.tsx` | Impact-aware save confirmation |
| `src/features/scenarios/hooks/usePromoteToShared.ts` | Promotion logic hook |

#### DataSourceEditor Changes

```typescript
interface DataSourceEditorProps {
  // ... existing props
  sharedDataSources?: SharedDataSource[];                    // NEW: top-level pool
  onPromoteToShared?: (ds: DataSource, name: string, tags?: string[]) => string; // NEW: returns new shared DS id
}
```

New toolbar button:
```tsx
{!linkedSharedDs && dt && dt.rows.length > 0 && (
  <button
    className="data-source-toolbar-btn"
    onClick={() => setShowPromoteModal(true)}
    title="Promote inline data to a Shared Data Source"
  >
    ⬆ Promote to Shared
  </button>
)}
```

#### ScenarioBuilder/TestEditorModal Changes

Pass `onPromoteToShared` callback:
```typescript
const handlePromoteToShared = useCallback((ds: DataSource, name: string, tags?: string[]) => {
  const newSharedDs: SharedDataSource = {
    id: uuidv4(),
    name,
    tags,
    dataSource: ds,
    updatedAt: Date.now(),
  };
  setSharedDataSources(prev => [...prev, newSharedDs]);
  return newSharedDs.id;
}, [setSharedDataSources]);
```

After promotion, auto-link the test:
```typescript
// In PromoteToSharedModal onConfirm:
const newId = onPromoteToShared(draft.dataSource, name, tags);
onDraftChange({
  ...draft,
  sharedDataSourceId: newId,
  dataSource: undefined, // Remove inline data
});
```

#### SharedDataSourceModal Changes

Track dirty state per-field for change summary:
```typescript
const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);

interface ChangeLogEntry {
  type: 'row_added' | 'row_removed' | 'row_modified' | 'col_added' | 'col_removed' | 'col_renamed' | 'cell_modified';
  detail: string;
}
```

On close with changes → show `SharedDsSaveConfirmModal`.

### Success Criteria

- [x] "⬆ Promote to Shared" button visible when test has inline data
- [x] `PromoteToSharedModal` opens with name input, tags, preview
- [x] Promotion creates new SharedDataSource and links test
- [x] Test's inline `dataSource` is cleared after promotion
- [x] "✂ Detach" dropdown with "Copy to Inline" and "Unlink Only" options
- [x] "Copy to Inline" copies shared data to test's inline dataSource
- [x] "Used by" badges in SharedDataSourceModal show affected tests
- [x] Save confirmation modal shows affected tests when closing with changes
- [x] Change summary shows what was modified (rows added/removed, columns changed)
- [x] TypeScript clean

### Implementation Notes (Phase 6)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Created/Changed
| File | Change |
|------|--------|
| `src/features/scenarios/components/PromoteToSharedModal.tsx` | **New file** — Modal for promoting inline data to shared DS with name input, tags, and preview |
| `src/features/scenarios/components/DataSourceEditor.tsx` | Added "⬆ Promote to Shared" button and detach dropdown with "Copy to Inline" / "Unlink Only" options |
| `src/features/scenarios/components/TestEditorModal.tsx` | Pass `sharedDataSources` and `onPromoteToShared` props to DataSourceEditor |
| `src/features/scenarios/ScenarioBuilder.tsx` | Added `handlePromoteToShared` callback to create new SharedDataSource |
| `src/styles/scenario-builder.css` | Styles for detach dropdown menu (`.detach-dropdown-menu`, `.detach-dropdown-item`) |
| `src/styles/base.css` | Styles for promote modal preview (`.popup-modal-section`, `.popup-modal-preview`, `.tag-pill`) |
| `e2e/promote-demote-shared-ds.spec.ts` | **New file** — 11 E2E tests covering promote/demote workflows |

#### Design Decisions
1. **Save confirmation modal implemented** — The impact-aware save confirmation (Option B in the plan) was implemented in Phase 6.1.
2. **Detach dropdown pattern** — Used a dropdown instead of separate buttons to reduce toolbar clutter while providing both detach options.
3. **E2E tests use seeded data** — Tests seed localStorage with pre-configured feature groups, tests, and shared data sources for reliable, fast execution (all 11 tests pass in <5s).

---

### Phase 6.1 — Save Confirmation Modal with Impact Warning

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Goal
When the user closes `SharedDataSourceModal` with unsaved changes, show an impact-aware confirmation modal that displays:
1. Which shared data sources have changes
2. Which tests will be affected by the changes
3. Summary of changes (rows added/removed, columns changed, cells modified)

#### Files Created/Changed
| File | Change |
|------|--------|
| `src/features/scenarios/utils/sharedDsChangeDetection.ts` | **New file** — Utility functions for detecting changes between SharedDataSource snapshots (added/removed/renamed DS, columns, rows, cells) |
| `src/features/scenarios/components/SharedDsSaveConfirmModal.tsx` | **New file** — Impact-aware save confirmation modal showing affected tests and change summary |
| `src/features/scenarios/components/SharedDataSourceModal.tsx` | Added `showSaveConfirm` state, intercept Close button and `AppModalFrame.onClose` to check `isDirty` |
| `src/styles/shared-data-sources.css` | Styles for save confirmation modal (`.shared-ds-save-confirm-*`) |
| `src/features/scenarios/utils/sharedDsChangeDetection.test.ts` | **New file** — 15 unit tests for change detection utility |
| `src/features/scenarios/components/SharedDsSaveConfirmModal.test.tsx` | **New file** — 12 unit tests for save confirmation modal |

#### User Flow
1. User opens `SharedDataSourceModal`
2. User modifies data (add rows, rename columns, edit cells, etc.)
3. User clicks "Close" button (or presses Escape, or clicks outside)
4. If `isDirty`, the `SharedDsSaveConfirmModal` appears showing:
   - Number of affected data sources
   - List of affected tests (truncated to 8 with "+N more...")
   - List of changes (truncated to 10 with "+N more changes...")
5. User can choose:
   - **"Save All"** — Saves changes and closes both modals
   - **"Discard Changes"** — Reverts to saved snapshot and closes both modals
   - **X (Cancel)** — Returns to editing (modal stays open)

---

## Phase 7 — Wiring — ScenarioBuilder, DataSourceEditor, TestRunner

> **Note:** This phase was originally Phase 6. Renumbered after adding Phase 6 (Promote & Demote Workflows).

### Goal
Connect the top-level `sharedDataSources` to all consumers. Update `DataSourceEditor` to read from top-level instead of per-FG.

### DataSourceEditor Changes
- **Props:** Replace `featureGroups?: FeatureGroup[]` usage for shared DS lookup with `sharedDataSources?: SharedDataSource[]`
- **"📋 Use Shared…" dropdown:** Lists from `sharedDataSources` prop (all available), not FG-scoped
- **"✂ Detach":** Same behavior — removes `sharedDataSourceId`
- **Read-only when linked:** Same behavior
- **`effectiveDraft`:** Same pattern — merges linked shared DS data

### TestRunner Changes
- `resolveSharedDataSources(queue, sharedDataSources)` — flat lookup from top-level array (simpler than FG-scoped)

### dataSourceExpander Changes
```typescript
// Simplified — no longer needs featureGroups
export function resolveSharedDataSources(
  queue: Scenario[],
  sharedDataSources: SharedDataSource[]
): Scenario[] {
  return queue.map(sc => {
    if (!sc.sharedDataSourceId || sc.dataSource) return sc;
    const shared = sharedDataSources.find(s => s.id === sc.sharedDataSourceId);
    if (!shared) return sc;
    return { ...sc, dataSource: shared.dataSource };
  });
}
```

### ScenarioBuilder Changes
- Pass `sharedDataSources` down to `DataSourceEditor` (via `TestEditorModal`)
- Remove per-FG "Shared Data" button
- Remove `SharedDataSourceManager` import and rendering
- Remove `showSharedDs` state

### Success Criteria
- [x] "Use Shared…" dropdown shows all top-level shared DSs
- [x] Linking/unlinking works from DataSourceEditor
- [x] Read-only mode when linked
- [x] `effectiveDraft` merges correctly
- [x] TestRunner resolves shared DSs before execution
- [x] Verify modal uses `effectiveDraft`

### Implementation Notes (Phase 7)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Changed
| File | Change |
|------|--------|
| `src/features/scenarios/components/DataSourceEditor.tsx` | Changed `availableSharedDs` lookup to use `sharedDataSources` prop (top-level) instead of `currentFg?.sharedDataSources` |
| `src/features/scenarios/components/TestEditorModal.tsx` | Added `sharedDataSources?: SharedDataSource[]` and `onPromoteToShared?` props, passed to DataSourceEditor |
| `src/features/scenarios/ScenarioBuilder.tsx` | Passes `sharedDataSources` state to TestEditorModal |
| `src/features/test-runner/TestRunner.tsx` | Added `sharedDataSources?: SharedDataSource[]` prop, uses it in `resolveSharedDataSources()` call |
| `src/app/App.tsx` | Passes `sharedDataSources` to TestRunner component |
| `src/engine/dataSourceExpander.ts` | Updated `resolveSharedDataSource` and `resolveSharedDataSources` to accept both `SharedDataSource[]` and legacy `FeatureGroup[]` for backward compat |
| `src/engine/dataSourceExpander.test.ts` | Added 3 unit tests for top-level SharedDataSource[] resolution |

#### Design Decisions
1. **Backward-compatible expander** — `dataSourceExpander` functions accept both the new flat `SharedDataSource[]` array and the legacy `FeatureGroup[]` lookup to avoid breaking existing tests and flows.
2. **Props threading** — `sharedDataSources` flows from App → ScenarioBuilder → TestEditorModal → DataSourceEditor and App → TestRunner. This explicit prop drilling keeps dependencies clear.

#### Bug Fix (2026-05-04)
**Problem:** After promoting inline test data to a shared data source, clicking "Verify" in the Shared Data Sources modal failed with `ERR_INVALID_URL` because the `fetchConfig.url` was empty.

**Root Cause:** The promotion flow only copied the `DataSource` object but did not populate the `SharedDataSource.fetchConfig` (URL, method, headers, auth) needed for fetch/verify operations.

**Fix:** Updated `handlePromoteToShared` callback chain to pass the test's URL template, method, headers, and auth configuration. Files changed:
- `DataSourceEditor.tsx` — Updated `handlePromote` to pass fetch config from `draft.dataSource.urlTemplate` / `draft.url` / `draft.method` / `draft.headers` / `draft.auth`
- `TestEditorModal.tsx` — Updated `onPromoteToShared` prop type signature to include optional `fetchConfig`
- `ScenarioBuilder.tsx` — Updated `handlePromoteToShared` to populate `SharedDataSource.fetchConfig` from the provided config

#### Bug Fix #2 (2026-05-04)
**Problem:** After promoting a test to a shared data source, the "Used by" section in SharedDataSourceModal didn't show the linked test because the link was only in the unsaved draft, not yet persisted to `featureGroups`.

**Root Cause:** The `usedByMap` lookup only scanned persisted tests in `featureGroups`, not the current editing draft.

**Fix:** Added `currentEditingDraft` prop to `SharedDataSourceModal` and included it in the `usedByMap` lookup to show unsaved links with an "(editing)" suffix. Files changed:
- `SharedDataSourceModal.tsx` — Added `currentEditingDraft` prop and updated `usedByMap` useMemo to include unsaved draft links
- `ScenarioBuilder.tsx` — Added `currentEditingDraft` useMemo to build context from `editingTest` + `draft`, passed to `SharedDataSourceModal`

---

## Phase 8 — Migration & Cleanup

> **Note:** This phase was originally Phase 7. Renumbered after adding Phase 6 (Promote & Demote Workflows).

---

## Phase 7.5 — Create Test from Shared Data Source

### Goal
Allow users to create a new parameterized test that is pre-linked to an existing shared data source, rather than starting with inline data.

### UI Entry Points

**Option A: Dropdown on "+ Param Test" button**
```
+ Param Test ▾
├── Empty Inline Data      (existing behavior)
└── From Shared Data Source...  ← Picker modal
```

**Option B: "Create Test" button in SharedDataSourceModal**
In the editor header of SharedDataSourceModal, a "+ Create Test" button opens a modal to select target Feature/Scenario and test name.

### Implementation

#### Files Changed
| File | Change |
|------|--------|
| `SharedDataSourceModal.tsx` | Added `onCreateTestFromSharedDs` prop and "+ Create Test" button in editor header with target picker modal |
| `ScenarioBuilder.tsx` | Added `handleCreateTestFromSharedDs` callback, `paramTestDropdown` state for dropdown, `showFromSharedDsPicker` state for picker modal |
| `scenario-builder.css` | Styles for `.param-test-dropdown-*` and `.shared-ds-picker-*` components |

#### Test Creation Logic
```typescript
const newTest: Scenario = {
  id: uuidv4(),
  name: testName,
  url: sharedDs.fetchConfig?.url || '',
  method: sharedDs.fetchConfig?.method || 'GET',
  headers: sharedDs.fetchConfig?.headers || [],
  body: '',
  auth: sharedDs.fetchConfig?.auth || { type: 'none' },
  validation: { statusCode: 200 },
  sharedDataSourceId: sharedDs.id,  // Pre-linked to shared DS
  // dataSource: undefined  ← no inline data
};
```

### Success Criteria
- [x] "+ From Shared DS" button in scenario action bar
- [x] Picker modal shows all available shared data sources with row/column counts
- [x] Radio selection with test name input field
- [x] Selecting a shared DS creates a new test pre-linked to it
- [x] New test opens in editor with Data tab showing linked shared data (read-only)
- [x] "+ Create Test" button in SharedDataSourceModal action bar
- [x] Create Test modal allows specifying target Feature/Scenario and test name
- [x] Both modals use standard PopupModal component
- [x] TypeScript clean

### Implementation Notes (Phase 7.5)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Changed
| File | Change |
|------|--------|
| `SharedDataSourceModal.tsx` | Added `onCreateTestFromSharedDs` prop, "+ Create Test" button moved to action bar, Create Test modal using PopupModal |
| `ScenarioBuilder.tsx` | Added `handleCreateTestFromSharedDs` callback, "+ From Shared DS" button, picker modal with radio selection |
| `scenario-builder.css` | Styles for picker modal (`.from-shared-ds-picker`, `.shared-ds-picker-*`) |

#### Design Decisions
1. **Separate button instead of dropdown** — "+ From Shared DS" is a standalone button rather than a dropdown on "+ Param Test" for clearer UX
2. **Radio selection with test name** — User selects a data source AND enters test name before creating (not click-to-create)
3. **PopupModal component** — Both modals use the standard PopupModal for consistent styling

---

## Phase 7.6 — UI Polish & Improvements

### Goal
Polish the SharedDataSourceModal UI based on user feedback.

### Changes Implemented

#### 1. "Used by" Section — Collapsible
- Changed from always-visible horizontal list to collapsible section
- Shows "▶ Used by N test(s)" in collapsed state (default)
- Expands to show test name badges on click
- Badges show only test name with full path in tooltip
- Editing tests show with ✎ icon and orange dashed border

#### 2. List Panel — Collapse/Expand Toggle
- Added ◀/▶ toggle button between list panel and editor
- Click ◀ to collapse list panel completely (more space for editor)
- Click ▶ to expand list panel back

#### 3. List Panel — Resizable Width
- Drag the right edge of list panel to resize (min 180px, max 450px)
- Allows viewing full data source names

#### 4. Create Test Modal — Wider
- Increased modal width to 800px for better readability
- URL preview wraps properly

### Files Changed
| File | Change |
|------|--------|
| `SharedDataSourceModal.tsx` | Added `listPanelCollapsed`, `listPanelWidth`, `isResizing` state; collapsible "Used by" section; resize handle; collapse toggle |
| `shared-data-sources.css` | Styles for `.shared-ds-panel-toggle`, `.shared-ds-resize-handle`, collapsible `.shared-ds-used-by-*` |
| `scenario-builder.css` | Increased `.popup-modal.from-shared-ds-picker` and `.popup-modal.create-test-modal` to 800px |
| `e2e/shared-data-sources-modal.spec.ts` | Updated tests for collapse/expand toggle (replaced resize drag tests) |

### Success Criteria
- [x] "Used by" section is collapsible with ▶/▼ arrow
- [x] List panel can be collapsed with ◀ toggle
- [x] List panel can be resized by dragging
- [x] Create Test modals are 800px wide
- [x] All 20 E2E tests pass
- [x] TypeScript clean

---

## Phase 8 — Migration & Cleanup

### Goal
Auto-migrate existing per-FG shared data sources to top-level. Remove old code.

### Migration Logic (`storage.ts`)

```typescript
// In loadSharedDataSources or a dedicated migration function:
// 1. Load top-level sharedDataSources from IDB
// 2. Load featureGroups
// 3. Collect any fg.sharedDataSources[] entries
// 4. Merge into top-level (deduplicate — see collision strategy below)
// 5. Remove sharedDataSources from each FG
// 6. Save both
```

### Collision Strategy

When merging per-FG shared DSs into the top-level pool:

| Scenario | Resolution |
|----------|------------|
| Same ID, same data | Skip (already migrated) |
| Same ID, different data | Keep the one with newer `updatedAt` |
| Same name, different ID | Keep both — they're distinct datasets (names aren't unique keys) |
| Same ID exists in multiple FGs | Take newer `updatedAt`, log warning to console |

> **Safety:** The migration is idempotent. If it runs multiple times (e.g., user reverts to an older backup),
> it will not duplicate entries — dedup by ID ensures correctness.

### Files to Clean Up
- **Delete:** `src/features/scenarios/components/SharedDataSourceManager.tsx`
- **Remove from `FeatureGroup`:** `sharedDataSources` field
- **Remove from `ScenarioBuilder`:** `showSharedDs` state, "Shared Data" per-FG button, `SharedDataSourceManager` rendering
- **Remove from CSS:** `.shared-ds-manager`, `.shared-ds-card`, `.shared-ds-card-expanded`, etc. (old inline editor styles)
- **Update `dataSourceExpander.ts`:** Remove `findSharedDataSource(fg, sharedId)` — no longer needed
- **Update `dataSourceExpander.test.ts`:** Update tests to use top-level array

### Success Criteria
- [x] Migration runs on first load (transparent to user)
- [x] Old per-FG shared DSs appear in top-level modal
- [x] `SharedDataSourceManager.tsx` deleted
- [x] No references to `fg.sharedDataSources` remain
- [x] Old CSS classes removed
- [x] TypeScript clean
- [x] No console warnings/errors

### Implementation Notes (Phase 8)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Changed
| File | Change |
|------|--------|
| `storage.ts` | Added `migratePerFgSharedDataSourcesToTopLevel()` migration function |
| `useProjects.ts` | Call migration on app startup after `migrateToFlat()` |
| `shared/types/index.ts` | Removed `sharedDataSources?: SharedDataSource[]` from `FeatureGroup` |
| `SharedDataSourceManager.tsx` | Deleted (12.8 KB) |
| `ScenarioBuilder.tsx` | Removed import, state, per-FG "Shared Data" button, and manager rendering |
| `dataSourceExpander.ts` | Removed `findSharedDataSource()`, simplified to only support top-level `SharedDataSource[]` |
| `dataSourceExpander.test.ts` | Removed `findSharedDataSource` tests, updated remaining tests for new API |
| `scenario-builder.css` | Removed ~220 lines of old manager CSS (`.shared-ds-manager`, `.shared-ds-card-*`, `.shared-ds-editor-*`, etc.) |

#### Migration Logic
```typescript
export async function migratePerFgSharedDataSourcesToTopLevel(): Promise<{ migrated: number; removed: number }> {
  // 1. Load featureGroups and top-level sharedDataSources
  // 2. Collect sharedDataSources from each FG (dedupe by ID)
  // 3. Merge into top-level array
  // 4. Remove sharedDataSources from each FG
  // 5. Save both
}
```

#### Verification
- TypeScript: `npx tsc --noEmit` ✅
- Unit tests: `dataSourceExpander.test.ts` 71/71 passing ✅
- E2E tests: `shared-data-sources-modal.spec.ts` + `promote-demote-shared-ds.spec.ts` 31/31 passing ✅

---

## Phase 9 — Tests

> **Note:** This phase was originally Phase 8. Renumbered after adding Phase 6 (Promote & Demote Workflows).

### Goal
Unit tests for new/changed code. Update existing tests.

### Test Coverage

| Area | File | Tests |
|------|------|-------|
| `useDataSourceTable` hook | `useDataSourceTable.test.ts` | Column CRUD, row CRUD, bulk ops, sort, search, import |
| `dataSourceExpander` | `dataSourceExpander.test.ts` | Update existing 9 shared DS tests to use flat array |
| `storage` | `storage.test.ts` | Load/save shared DSs, migration from FG-scoped |
| `SharedDataSourceModal` | `SharedDataSourceModal.test.tsx` | Create, rename, delete, usage count, fetchConfig |
| `toSyntheticScenario` | Unit test | Correct Scenario shape from SharedDataSource |
| `PromoteToSharedModal` | `PromoteToSharedModal.test.tsx` | Promotion flow, name input, tags, preview, link after create |
| `usePromoteToShared` | `usePromoteToShared.test.ts` | Creates SharedDataSource, links test, clears inline data |
| `SharedDsSaveConfirmModal` | `SharedDsSaveConfirmModal.test.tsx` | Change detection, affected tests list, save/discard actions |

### Success Criteria
- [x] `useDataSourceTable` hook: ≥15 tests covering core operations
- [x] `dataSourceExpander`: existing tests updated and passing
- [x] Storage: load/save/migration tests (8 tests for `migratePerFgSharedDataSourcesToTopLevel`)
- [x] Modal: CRUD + usage display tests (24 component tests)
- [x] Promote/Demote: promotion flow, detach options *(11 E2E tests passing)*
- [x] All tests pass (`npx vitest run`) — 6,246 tests
- [x] TypeScript clean

### Implementation Notes (Phase 9)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Test Summary
| Test File | Tests | Coverage |
|-----------|-------|----------|
| `src/features/scenarios/hooks/useDataSourceRows.test.ts` | 26 | Row CRUD, bulk ops, search/sort/filter |
| `src/features/scenarios/hooks/useDataSourceColumns.test.ts` | 7 | Column CRUD, URL template sync |
| `src/engine/dataSourceExpander.test.ts` | 71 | SharedDataSource resolution, expand, tags, subsets |
| `src/shared/utils/storage.migration.test.ts` | 26 | `migratePerFgSharedDataSourcesToTopLevel` migration (8 new tests) |
| `src/features/scenarios/components/SharedDataSourceModal.test.tsx` | 24 | Modal CRUD, search, collapse/expand, used-by, create test |
| `src/features/scenarios/utils/sharedDsChangeDetection.test.ts` | 15 | Change detection (added/removed/renamed DS, columns, rows, cells) |
| `src/features/scenarios/components/SharedDsSaveConfirmModal.test.tsx` | 12 | Save confirmation modal (affected tests, change summary, actions) |
| `e2e/promote-demote-shared-ds.spec.ts` | 11 | Promote/Demote E2E workflows |
| `e2e/shared-data-sources-modal.spec.ts` | 20 | Modal E2E workflows |

#### Verification
- **Unit Tests**: 6,246 passing ✅
- **E2E Tests**: 31 passing (shared DS related) ✅
- **TypeScript**: Clean ✅

---

## Phase 10 — Docs, Training Manuals, Gallery Samples

> **Note:** This phase was originally Phase 9. Renumbered after adding Phase 6 (Promote & Demote Workflows).

### Goal
Create training documentation, gallery samples, and sample data files that demonstrate shared data sources. Update existing parameterized test training manuals to reference the new shared DS workflow.

### 10.1 Training Manuals

Create manuals following `docs/training-manuals/CONVENTIONS.md` naming. Place in a new `docs/training-manuals/tests/` subdirectory (alongside existing parameterized manuals).

| Manual | Difficulty | Filename | Content |
|--------|------------|----------|---------|
| Shared DS Basics | Easy | `shared-data-sources-easy.html` | Create a shared DS, link to a test, run, verify linkage works |
| Shared DS with Fetch Config | Medium | `shared-data-sources-fetch-medium.html` | Configure fetchConfig (URL + auth), Populate from API, Verify All |
| Cross-FG Shared DS | Medium | `shared-data-sources-cross-fg-medium.html` | One shared DS used by tests across 3 feature groups |
| Shared DS Advanced | Advanced | `shared-data-sources-advanced.html` | Tags, CSV import into shared DS, fetchConfig + re-fetch, cURL export |

Each training manual:
- Uses a gallery sample as its starting point ("Load the 'Shared VIN Set' sample from Gallery")
- Has step-by-step walkthrough (not just explanation)
- Ends with a "Try It Yourself" section
- Links to related manuals (parameterized basics → shared DS basics)
- All URLs are real, public, no-auth-required APIs

### 10.2 Gallery Samples

Add new entries to the test gallery catalog that demonstrate shared data sources. Each creates a `FeatureGroup` with `sharedDataSources[]` pre-populated.

| Sample | ID | API | Pattern | Shared DS Rows |
|--------|-----|-----|---------|----------------|
| **Shared VIN Set** | `test-shared-vin-set` | JSONPlaceholder `/users/{{id}}` | 1 shared DS used by 2 tests (GET + GET posts) | 10 |
| **Shared Auth Users** | `test-shared-auth-users` | DummyJSON `/auth/login` | 1 shared DS with fetchConfig (POST body rotation) | 5 |
| **Cross-FG Products** | `test-shared-cross-fg` | DummyJSON `/products/{{id}}` | 1 shared DS referenced by tests in 2 FGs | 8 |

**Factory pattern** (follows `parameterizedPresets.ts` convention):

```typescript
// src/data/galleries/tests/sharedDataSourcePresets.ts

export function createSharedVinSetTest(): FeatureGroup {
  return {
    id: 'fg-shared-vin-set',
    name: 'Shared VIN Set',
    sharedDataSources: [{
      id: 'sds-user-ids',
      name: 'User IDs (1–10)',
      dataSource: {
        id: 'ds-user-ids',
        columns: [
          { id: 'col-id', name: 'id', type: 'path', mapping: 'id' },
          { id: 'col-name', name: 'expectedName', type: 'validate', mapping: '$.name' },
        ],
        rows: [
          { id: 'r1', values: { 'col-id': '1', 'col-name': 'Leanne Graham' }, enabled: true },
          // ... rows 2–10
        ],
        source: { type: 'inline' },
        distribution: 'sequential',
      },
      updatedAt: Date.now(),
    }],
    scenarios: [
      {
        id: 'sc-get-users',
        name: 'User Profile',
        tests: [{
          // ... test referencing sharedDataSourceId: 'sds-user-ids'
        }],
      },
      {
        id: 'sc-get-posts',
        name: 'User Posts',
        tests: [{
          // ... another test referencing same shared DS
        }],
      },
    ],
  };
}
```

**Gallery catalog entries** (in `src/data/galleries/tests/index.ts`):

```typescript
{
  id: 'test-shared-vin-set',
  domain: 'tests',
  name: 'Shared VIN Set',
  description: '1 shared data source (10 users) referenced by 2 tests — demonstrates cross-test data reuse',
  icon: '📦',
  category: 'data-driven',
  difficulty: 'easy',
  tags: ['shared-data-source', 'data-driven', 'jsonplaceholder', 'cross-test'],
  liveApis: ['jsonplaceholder.typicode.com'],
  scenarioCount: 2,
  dataRowCount: 10,
  factory: createSharedVinSetTest,
}
```

### 10.3 Training Paths Registration

Add a new phase to the "Test Harness" training path in `src/data/galleries/trainingPaths/contentPaths.ts`:

```typescript
{
  id: 5,
  name: 'Shared Data Sources',
  manuals: [
    {
      title: 'Shared Data Source Basics',
      description: 'Create a shared DS, link to tests, run — centralized data management.',
      difficulty: 'easy',
      sampleId: 'test-shared-vin-set',
      manualPath: 'tests/shared-data-sources-easy.html',
    },
    {
      title: 'Fetch Config & API Population',
      description: 'Configure fetchConfig with auth, Populate from API, Verify All, Re-fetch.',
      difficulty: 'medium',
      sampleId: 'test-shared-auth-users',
      manualPath: 'tests/shared-data-sources-fetch-medium.html',
    },
    {
      title: 'Cross-Feature-Group Sharing',
      description: 'One shared DS used by tests across multiple feature groups.',
      difficulty: 'medium',
      sampleId: 'test-shared-cross-fg',
      manualPath: 'tests/shared-data-sources-cross-fg-medium.html',
    },
    {
      title: 'Advanced: Tags, Import, cURL',
      description: 'Tags for categorization, CSV import into shared DS, fetchConfig cURL export.',
      difficulty: 'advanced',
      manualPath: 'tests/shared-data-sources-advanced.html',
    },
  ],
},
```

### 10.4 Sample Data Files

Add to `test-data/` for use in training manual walkthroughs:

| File | Format | Rows | Purpose |
|------|--------|------|---------|
| `sample_shared_users_10.csv` | CSV | 10 | User IDs 1–10 with expected names (JSONPlaceholder) |
| `sample_shared_products_8.json` | JSON | 8 | Product IDs with expected titles (DummyJSON) |

These files are referenced in the "File Import" section of `shared-data-sources-advanced.html`.

### 10.5 Update Existing Documentation

- **`docs/training-manuals/tests/parameterized-basics-easy.html`** — Add "Next Steps" section linking to shared DS basics
- **`docs/training-manuals/tests/parameterized-file-import-easy.html`** — Add note: "To share imported data across tests, see Shared Data Sources"
- **`README.md`** — Add shared data sources to feature list
- **`CHANGELOG.md`** — Add entry for shared data sources feature
- **`docs/training-manuals/CONVENTIONS.md`** — No change needed (existing conventions apply)

### Success Criteria
- [x] 4 training manuals created in `docs/training-manuals/tests/`
- [x] Training manuals follow CONVENTIONS.md (step-by-step walkthrough, gallery sample starting point, "Try It Yourself")
- [x] 4 gallery samples created with `sharedDataSourceFactory()` and `additionalFeatureGroupsFactory()`
- [x] Gallery samples tagged `shared-data-source` and visible in Gallery filter
- [x] Training paths updated in `contentPaths.ts` (Phase 5: Shared Data Sources)
- [ ] 2 sample data files in `test-data/` *(deferred — not needed; samples use inline data)*
- [x] Existing parameterized manuals reference shared DS manuals
- [x] All gallery sample factories produce valid `FeatureGroup` objects (pass type check)
- [x] Gallery tests pass (`trainingPaths.test.ts`, `tests.test.ts`)

### Implementation Notes (Phase 10)

**Completed 2026-05-04** on branch `feature/parameterized-tests`.

#### Files Created
| File | Purpose |
|------|---------|
| `src/data/galleries/tests/sharedDataSourcePresets.ts` | Factory functions for 4 shared DS gallery samples |
| `docs/training-manuals/tests/shared-data-sources-easy.html` | Training manual: Shared DS Basics |
| `docs/training-manuals/tests/shared-data-sources-fetch-medium.html` | Training manual: Fetch Config & API Population |
| `docs/training-manuals/tests/shared-data-sources-cross-fg-medium.html` | Training manual: Cross-FG Shared Data |
| `docs/training-manuals/tests/shared-data-sources-advanced.html` | Training manual: Tags, Import/Export, Promote |

#### Files Changed
| File | Change |
|------|--------|
| `src/data/galleries/tests/types.ts` | Added `sharedDataSourceFactory?` and `additionalFeatureGroupsFactory?` to `TestSampleEntry` |
| `src/data/galleries/tests/index.ts` | Registered 4 new shared DS gallery samples |
| `src/data/galleries/trainingPaths/contentPaths.ts` | Added Phase 5 "Shared Data Sources" with 4 manuals |
| `src/app/hooks/useGalleryImport.ts` | Updated `onImportTest` to handle shared DS and additional FG factories |

#### Gallery Samples
| Sample ID | Name | API | Description |
|-----------|------|-----|-------------|
| `test-shared-user-ids` | Shared User IDs | JSONPlaceholder | 1 shared DS (10 users) used by 2 tests |
| `test-shared-product-catalog` | Shared Product Catalog | DummyJSON | 1 shared DS (8 products) with fetch config, 2 scenarios |
| `test-shared-pokemon-cross-fg` | Cross-FG Pokémon Roster | PokéAPI | 1 shared DS (6 Pokémon) across 2 feature groups |
| `test-shared-auth-users` | Shared Auth Users | DummyJSON | 1 shared DS (5 credentials) with POST body rotation |

#### Training Manuals
| Manual | Difficulty | Sample |
|--------|------------|--------|
| Shared DS Basics | Easy | `test-shared-user-ids` |
| Shared DS with Fetch Config | Medium | `test-shared-product-catalog` |
| Cross-FG Shared Data | Medium | `test-shared-pokemon-cross-fg` |
| Shared DS Advanced | Advanced | `test-shared-auth-users` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        App (top-level)                       │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ featureGroups[]  │  │ sharedDataSources[]              │  │
│  │  └─ scenarios[]  │  │  └─ { id, name, dataSource,     │  │
│  │     └─ tests[]   │  │       fetchConfig, updatedAt }   │  │
│  │        └─ sharedDataSourceId ──────────────► (by ID)   │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  ScenarioBuilder                      │   │
│  │  [Import] [Export] [Template] [Shared DS (3)] [+FG]  │   │
│  │                                    │                  │   │
│  │                          ┌─────────▼──────────┐      │   │
│  │                          │ SharedDataSource    │      │   │
│  │                          │      Modal          │      │   │
│  │                          │ ┌───────┬─────────┐│      │   │
│  │                          │ │ List  │ Editor  ││      │   │
│  │                          │ │       │(useData-││      │   │
│  │                          │ │       │ Source- ││      │   │
│  │                          │ │       │ Table)  ││      │   │
│  │                          │ └───────┴─────────┘│      │   │
│  │                          └────────────────────┘      │   │
│  │                                                      │   │
│  │  ┌─────────────────────────┐                         │   │
│  │  │    DataSourceEditor     │                         │   │
│  │  │  (useDataSourceTable)   │                         │   │
│  │  │  [Use Shared ▾] [Detach]│                         │   │
│  │  │  reads from top-level   │                         │   │
│  │  │  sharedDataSources[]    │                         │   │
│  │  └─────────────────────────┘                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    TestRunner                         │   │
│  │  resolveSharedDataSources(queue, sharedDataSources)  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Reuse Map

| Existing Component | Reused In | How |
|--------------------|-----------|-----|
| `AppModalFrame` | Modal shell | Direct — draggable, expandable |
| `PopulateFromApiModal` | "⬇ From API" | Pass synthetic Scenario from `fetchConfig` |
| `DataSourceVerifyModal` | "▶ Verify All" | Pass synthetic Scenario from `fetchConfig` |
| `DataSourceRowDetailModal` | Row detail editing | Direct — same props |
| `proxyFetch` | Row fetch, re-fetch | Direct — fetchConfig provides URL/method/headers |
| `useDataSourceTags` | Tag management | Consumed inside `useDataSourceTable` |
| `handleImport` (file picker) | CSV/JSON/Excel import | Extracted into `useDataSourceTable` |
| `catalogCurlGenerator.ts` | Copy as cURL | Pattern reuse for fetchConfig |

---

## Implementation Notes

- Configure Variables in Shared Data Sources now opens `DataSourceSetupModal` in `parameterize` mode (4-step flow: Detect Variables → Configure Columns → Validate Fields → Create) to match the existing parameterized workflow UI.
- cURL Import reuses the same wizard path immediately after parsing, so users land in the same flow regardless of entry point.
- "From API" still uses `PopulateFromApiModal` for row extraction/mapping, but both paths now share the same auth-aware fetch pipeline (`onFetchRow`) and the same fetched scenario source (`fetchConfig`).
- Step 4 (Create) now shows a full review summary (variables, URL template, column mappings, validate rules, array mode selections) and exposes explicit Edit actions per section.
- Step 4 also includes an explicit "Back to Validate Fields" action so users can revise rules before final create.
- Top fetch action bar is simplified to two actions (`cURL Import`, `Configure Variables + Auth…`) to reduce split-flow confusion.
- API row population is moved into the Fetch Configuration body section (`Populate Rows from API…`) so users configure auth and request settings in one place before populate.
- Column reordering now supports drag-and-drop in the shared data table schema header (replacing left/right controls).
- API generation tools are now collapsed by default under `Advanced: Generate from API` to keep shared schema/rows as the primary workflow.
- In setup wizard Step 1, `URL Template Preview` is now editable (with reset-to-auto option) so users can define template placeholders upfront.
- Step 1 now includes editable Auth Configuration and persists selected auth back to shared fetch configuration on apply.

---

## Design Decisions

### §1 — Live Sync Behavior (Lazy Resolution)

**Decision:** Shared data source updates are resolved **lazily at runtime only**.

- When a user edits a shared DS in the modal, the `sharedDataSources[]` array is updated immediately.
- When a test referencing that shared DS is opened in `TestEditorModal`, the `effectiveDraft` re-merges the latest shared DS data on each render (read from top-level state).
- The actual scenario stored in `featureGroups[].scenarios[].tests[]` never stores a copy of the shared data — only the `sharedDataSourceId` reference.
- This means tests always get the **latest version** of a shared DS when they run or when their editor opens. No subscription/listener pattern needed.

**Why:** Simplicity. Avoiding reactive subscriptions eliminates timing bugs and reduces complexity. The only cost is a `find()` call at render time (negligible for <1000 shared DSs).

### §2 — Partial Export (Single Feature Group)

When exporting a single feature group:
1. Collect all `sharedDataSourceId` values from tests within that FG.
2. Include the referenced `SharedDataSource` objects in the export JSON under a `referencedSharedDataSources` key.
3. On import:
   - If a shared DS with the same ID already exists → skip (don't overwrite).
   - If it doesn't exist → add it to the top-level pool.
   - This prevents broken references while avoiding unintentional data overwrites.

### §3 — Auth Config in fetchConfig

`fetchConfig.auth` reuses the existing `AuthConfig` type (same as `Scenario.auth`). This means:
- Bearer tokens, Basic auth, and OAuth2 client credentials are all supported out-of-the-box.
- The auth selector UI component from `TestEditorModal` is directly reusable.
- `proxyFetch` already handles `AuthConfig` resolution, so no new fetch logic is needed.

### §4 — Tags for Shared Data Source Categorization

`SharedDataSource.tags?: string[]` provides lightweight categorization without a rigid folder hierarchy.

- Users can freely assign multiple tags (e.g., `["prod", "vins"]`).
- The list panel includes a tag filter dropdown.
- Tags are optional — shared DSs with no tags appear in the "All" view.
- This scales better than folders for cross-cutting concerns (a DS can be both "prod" and "vehicles").

### §5 — Hook Layering Rationale

The `useDataSourceTable` hook is split into `useDataSourceRows`, `useDataSourceColumns`, and `useDataSourceFetch` because:
- Each has a distinct concern and can be tested in isolation (10-15 tests per hook vs 60+ in one file).
- Consumers that only need rows (e.g., a read-only row list) don't pull in column/fetch logic.
- The composition pattern (`useDataSourceTable` = rows + columns + fetch + extras) keeps the API surface clean for `DataSourceEditor` while allowing `SharedDataSourceModal` to be selective.

### §6 — "Used by" Display Format (from Mockup)

The editor panel footer shows referencing tests as **breadcrumb badges**:
```
Used by: [FG Name / scenario / test-name] [FG Name / scenario / test-name]
```
- Each badge is a clickable chip with muted background (`rgba(255,255,255,0.06)`)
- Format: `featureGroupName / scenarioLabel / testName`
- Computed by scanning all `featureGroups[].scenarios[].tests[]` for matching `sharedDataSourceId`
- This provides clear traceability — users know exactly which tests will be affected by edits

### §7 — Fetch Config Collapsed Summary

When the fetch config section is collapsed, the header line shows:
```
▸ Fetch Configuration    GET https://api.dealer.com/v2/users/{{userId}}
```
- Summary text uses accent color for visibility
- Format: `{method} {url}` (truncated if too long)
- This gives at-a-glance context without expanding the section
- Default state: **collapsed** if fetchConfig is already configured, **expanded** if empty/new

### §8 — Headers as Removable Pills (from Mockup)

Headers in the fetch config UI are displayed as **inline pills** rather than a traditional key-value table:
```
[Authorization: Bearer {{token}} ✕] [Accept: application/json ✕]  [+ Add]
```
- Each pill shows `key: value` with a `✕` remove button
- "Add" button opens a small inline input for key + value
- This saves vertical space compared to the key-value pair list pattern
- Consistent with the tag-pill pattern used elsewhere in the app
