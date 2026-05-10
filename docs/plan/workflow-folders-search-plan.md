# Workflow Folders & Search — Implementation Plan

**Status:** ✅ Complete (All 4 phases done)  
**Branch:** `feature/workflow-folders-search`  
**Created:** 2026-05-09  
**Updated:** 2026-05-09  

---

## Problem Statement

As users create more workflows, both the **Designer sidebar** and the **Runner dropdown** become unusable:

1. **No organization** — Workflows are stored as a flat array with no grouping. 20+ workflows in a single list requires scrolling and visual scanning.
2. **No search** — Neither the sidebar nor the runner dropdown has a search/filter input.
3. **Inconsistent with Requests** — The Requests tab has a rich hierarchy (Collection Group → Collection → Folder → Sub-Collection → Request), while Workflows have none.

## Current State

### Requests Data Model (well-organized, 4 levels)
```
CollectionGroup (mode: 'group')
  └── Collection (mode: 'direct' | 'multi-env')
       └── Folder (RequestFolder)
            └── Sub-Collection (isSubCollection: true)
                 └── Request (RequestItem)
```

### Workflows Data Model (flat, 1 level)
```
Workflow[]  ← everything at the same level
```

### Feature Groups (3 levels)
```
FeatureGroup
  └── Scenario (kind: 'standard' | 'parameterized')
       └── Test (Scenario)
```

## Solution: Nested Workflow Folders + Search

A **nested folder** system for Workflows (unlimited depth), plus **instant search** in both the sidebar and runner dropdown.

### Target Hierarchy
```
WorkflowFolder (collapsible)
  └── WorkflowFolder (sub-folder, collapsible)
       └── WorkflowFolder (deeper nesting allowed)
            └── Workflow
       └── Workflow
  └── Workflow
WorkflowFolder
  └── Workflow
(unfiled workflows — shown at the bottom)
```

### Example Structure
```
📁 Performance Tests
   📁 Load Tests
      · Peak Load Workflow
      · Sustained Load Workflow
   📁 Stress Tests
      · CPU Stress Workflow
      · Memory Stress Workflow
📁 Integration
   📁 Payment
      📁 Stripe
         · Stripe Checkout Flow
      📁 PayPal
         · PayPal Express Flow
   📁 User Management
      · Registration → Login
📁 Orchestration
   · Sub-Workflow Orchestrator
   · Manager Approval
── Unfiled ──
   · Test Workflow
```

### Design Principles
1. **Unlimited nesting** — Users can freely create sub-folders to any depth for full organizational freedom.
2. **Full drag-and-drop** — Every folder, sub-folder, and workflow is freely draggable. Users can reorder, reparent, and reorganize everything by dragging.
3. **Optional** — Workflows without a folder appear in an "Unfiled" section at the bottom.
4. **Consistent UX** — Reuse the same collapsible section pattern as Collection Groups in Requests.
5. **Non-breaking** — Existing workflows with no `folderId` work unchanged.
6. **Search everywhere** — Both sidebar and runner dropdown get instant filter-as-you-type.
7. **Design-time freedom, runtime simplicity** — Full nesting in the Designer; flat searchable list with breadcrumb paths in the Runner.

---

## Design-Time vs Runtime Strategy

### Design-Time (Workflow Designer Sidebar)

Full nested folder tree for organization:
- Collapsible folders at any depth
- **Universal drag-and-drop** — every item (folder, sub-folder, workflow) is draggable to any valid target
- Create/rename/delete folders at any level
- Indentation increases with depth

### Runtime (Workflow Runner)

**Flat searchable list with folder breadcrumb paths.** Nested folders are flattened into section headers showing the full path:

```
┌──────────────────────────────────────┐
│ 🔍 Search...                         │
│ ── Performance Tests / Load Tests ── │
│   Peak Load Workflow                  │
│   Sustained Load Workflow             │
│ ── Performance Tests / Stress Tests ──│
│   CPU Stress Workflow                 │
│   Memory Stress Workflow              │
│ ── Integration / Payment / Stripe ── │
│   Stripe Checkout Flow                │
│ ── Integration / Payment / PayPal ── │
│   PayPal Express Flow                 │
│ ── Integration / User Management ──  │
│   Registration → Login                │
│ ── Orchestration ──────────────────  │
│   Sub-Workflow Orchestrator           │
│   Manager Approval                    │
│ ── Unfiled ────────────────────────  │
│   Test Workflow                       │
└──────────────────────────────────────┘
```

**Why flat at runtime?**

| Concern | Decision |
|---------|----------|
| **Usability** | Deep tree navigation in a dropdown is awkward; breadcrumb paths give context without nesting |
| **Selection speed** | Search + flat list is the fastest way to pick a workflow |
| **Batch runs** | Users can select workflows across different folders without navigating trees |
| **Results grouping** | Results are tagged with folder path for filtering in reports |

### "Run Folder" Feature

Right-click a folder in the Designer sidebar → **"Run all in folder"**:
- Collects all workflows in the folder **and all sub-folders** recursively
- Queues them in the runner for batch execution
- Execution order follows folder order (depth-first traversal)

---

## Drag-and-Drop — First-Class Requirement

Every folder, sub-folder, and workflow in the sidebar must be freely movable via drag-and-drop. This is the primary way users organize their workflows.

### Supported Drag Operations

| Drag Source | Valid Drop Targets | Result |
|---|---|---|
| **Workflow** | Another position in same folder | Reorder within folder |
| **Workflow** | A different folder (any depth) | Move workflow to that folder |
| **Workflow** | Root area / "Unfiled" section | Move workflow to root (unfiled) |
| **Workflow** | Between two folders at root | Move workflow to root at that position |
| **Folder** | Another position at same level | Reorder among siblings |
| **Folder** | A different folder (any depth) | Reparent — folder becomes sub-folder of drop target |
| **Folder** | Root area | Move folder to root level |
| **Sub-folder** | Root area | Promote sub-folder to root-level folder |
| **Sub-folder** | A different parent folder | Reparent sub-folder under new parent |

### Drop Zone Visual Feedback

```
┌──────────────────────────────────┐
│ ▼ 📁 Performance Tests       (7) │
│   ┄┄┄┄┄┄┄ ↕ drop here ┄┄┄┄┄┄┄  │  ← between-item indicator line
│   ▼ 📁 Load Tests            (2) │
│   ┌─ 📁 Load Tests ──────────┐  │  ← drop-on-folder highlight (border + background)
│   │  · Peak Load Workflow     │  │
│   │  · Sustained Load         │  │
│   └───────────────────────────┘  │
│   ┄┄┄┄┄┄┄ ↕ drop here ┄┄┄┄┄┄┄  │  ← between-item indicator line
│   ▼ 📁 Stress Tests          (2) │
└──────────────────────────────────┘
```

Two distinct drop zone types:
1. **Between items** — thin horizontal line indicator; drops the item at that position (reorder/move)
2. **On a folder** — folder row highlights with border + subtle background; drops the item inside the folder (reparent)

### Drag Constraints
- **No self-drop** — A folder cannot be dropped onto itself.
- **No descendant-drop** — A folder cannot be dropped onto any of its own descendants (prevents circular trees).
- **Auto-expand on hover** — When dragging over a collapsed folder, it auto-expands after 500ms so the user can drop inside nested sub-folders.
- **Scroll on edge** — When dragging near the top/bottom edge of the sidebar, auto-scroll the list.
- **Drag handle vs full row** — Full row is draggable (grab cursor on hover), no separate drag handle needed.

### Implementation Approach

Use **HTML5 Drag and Drop API** (native) with React wrappers:
- `draggable="true"` on every folder and workflow row
- `onDragStart` — set drag data (item type + id)
- `onDragOver` — determine drop zone (between-item vs on-folder) based on mouse Y position within the row
- `onDrop` — execute the move/reorder operation
- `onDragEnd` — clear all visual indicators

Alternatively, consider **@dnd-kit/core** for smoother animations and better touch support if the native API proves too limited.

---

## Data Model Changes

### New Type: `WorkflowFolder`

```typescript
// In src/features/workflow/types/workflow.ts
export interface WorkflowFolder {
  id: string;
  name: string;
  parentId?: string;    // null/undefined = root-level folder
  order: number;        // for manual sorting within parent
  collapsed?: boolean;  // UI state: folder collapsed in sidebar
}
```

### Workflow Extension

```typescript
// Add to existing Workflow interface
export interface Workflow {
  // ... existing fields ...
  folderId?: string;    // NEW — reference to WorkflowFolder.id
  folderOrder?: number; // NEW — position within the folder for drag-and-drop reordering
}
```

### Helper Utilities

```typescript
// In src/features/workflow/utils/workflowFolderTree.ts

// Build nested tree from flat folder array
export function buildFolderTree(folders: WorkflowFolder[]): FolderTreeNode[];

// Get full breadcrumb path: "Performance Tests / Load Tests / Peak"
export function getFolderPath(folderId: string, folders: WorkflowFolder[]): string;

// Collect all workflow IDs in a folder + sub-folders (recursive)
export function getWorkflowsInFolderRecursive(
  folderId: string,
  folders: WorkflowFolder[],
  workflows: Workflow[]
): Workflow[];

// Flatten nested folders into sorted leaf groups for runner display
export function flattenFoldersForRunner(
  folders: WorkflowFolder[],
  workflows: Workflow[]
): { path: string; workflows: Workflow[] }[];

// Check if targetId is a descendant of sourceId (prevents circular drops)
export function isDescendant(
  sourceId: string,
  targetId: string,
  folders: WorkflowFolder[]
): boolean;

// Move a folder to a new parent (or root) at a given order position
export function moveFolder(
  folderId: string,
  newParentId: string | null,
  newOrder: number,
  folders: WorkflowFolder[]
): WorkflowFolder[];

// Move a workflow to a new folder (or root) at a given order position
export function moveWorkflow(
  workflowId: string,
  newFolderId: string | null,
  newOrder: number,
  workflows: Workflow[]
): Workflow[];
```

### Storage

```typescript
// In src/shared/utils/storage.ts
// New storage key: 'workflow_folders'
export async function loadWorkflowFolders(): Promise<WorkflowFolder[]>;
export async function saveWorkflowFolders(folders: WorkflowFolder[]): Promise<void>;
```

---

## Phased Implementation

### Phase 1: Data Model + Storage + Tree Utils (~3-4 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Add `WorkflowFolder` interface with `parentId` | `src/features/workflow/types/workflow.ts` | ✅ |
| 1.2 | Add `folderId?: string` and `folderOrder?: number` to `Workflow` | `src/features/workflow/types/workflow.ts` | ✅ |
| 1.3 | Add `loadWorkflowFolders` / `saveWorkflowFolders` | `src/shared/utils/storage.ts` | ✅ |
| 1.4 | Create tree utilities (`buildFolderTree`, `getFolderPath`, `getWorkflowsInFolderRecursive`, `flattenFoldersForRunner`) | `src/features/workflow/utils/workflowFolderTree.ts` | ✅ |
| 1.5 | Create drag-and-drop utilities (`isDescendant`, `moveFolder`, `moveWorkflow`) | `src/features/workflow/utils/workflowFolderTree.ts` | ✅ |
| 1.6 | Add folder CRUD hook: `useWorkflowFolders` (includes move operations) | `src/features/workflow/hooks/useWorkflowFolders.ts` | ✅ |
| 1.7 | Unit tests for tree utils + drag utils + folder CRUD + storage (40 tests) | `*.test.ts` | ✅ |

### Phase 2: Sidebar Nested Folders UI + Drag-and-Drop (~5-7 hours)

Phase 2 is split into three sub-phases, each producing a working, testable increment:

#### Sub-phase 2A: Folder Tree Rendering (~2 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2A.1 | Wire `useWorkflowFolders` into `App.tsx` (sidebar parent) | `App.tsx` | ✅ |
| 2A.2 | Render nested tree sidebar: recursive folder rendering with depth-based indentation + "Unfiled" section | `WorkflowSidebar.tsx` | ✅ |
| 2A.3 | Collapse/expand folders with persisted state (chevron toggle) | `WorkflowSidebar.tsx` | ✅ |
| 2A.4 | Folder item count badges (recursive workflow count) | `WorkflowSidebar.tsx` | ✅ |
| 2A.5 | CSS for nested folder sections (depth-based indent, folder icons, expand/collapse chevrons, badges) | `src/styles/workflow.css` | ✅ |

#### Sub-phase 2B: Folder CRUD + Context Menu (~1.5 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2B.1 | Context menu on folders: create sub-folder, rename, delete | `WorkflowSidebar.tsx` | ✅ |
| 2B.2 | Context menu on workflows: move to folder (folder picker sub-menu) | `WorkflowSidebar.tsx` | ✅ |
| 2B.3 | "New Folder" button in sidebar header (creates root-level folder) | `WorkflowSidebar.tsx` | ✅ |
| 2B.4 | Inline rename editing (double-click folder name → input field) | `WorkflowSidebar.tsx` | ✅ |
| 2B.5 | Folder deletion with confirmation (moves orphaned workflows to Unfiled) | `WorkflowSidebar.tsx` | ✅ |
| 2B.6 | "Run all in folder" context menu action (recursive collection, prop ready) | `WorkflowSidebar.tsx` | ✅ |

#### Sub-phase 2C: Drag-and-Drop (~2.5 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2C.1 | Make every folder and workflow row `draggable`; set drag data (type + id) on `onDragStart` | `WorkflowSidebar.tsx` | ✅ |
| 2C.2 | Drop zone detection: "between items" (thin line) vs "on folder" (highlight) based on mouse Y within row | `WorkflowSidebar.tsx` | ✅ |
| 2C.3 | Workflow drag: reorder within same folder, move to different folder, move to root (unfiled) | `WorkflowSidebar.tsx` | ✅ |
| 2C.4 | Folder drag: reorder among siblings, reparent under different folder, promote to root; enforce no self-drop and no descendant-drop | `WorkflowSidebar.tsx` | ✅ |
| 2C.5 | Auto-expand: when hovering over collapsed folder for 500ms while dragging, auto-expand it | `WorkflowSidebar.tsx` | ✅ |
| 2C.6 | Edge scroll: auto-scroll sidebar when dragging near top/bottom edge | `WorkflowSidebar.tsx` | ✅ |
| 2C.7 | Drag CSS: grab cursor on hover, dragging opacity, between-item line indicator, on-folder highlight border | `src/styles/workflow.css` | ✅ |

### Phase 3: Search / Filter (~2-3 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Add search input to `WorkflowSidebar` header | `WorkflowSidebar.tsx` | ✅ |
| 3.2 | Filter workflows by name (case-insensitive, highlight matches) | `WorkflowSidebar.tsx` | ✅ |
| 3.3 | When searching, flatten tree — show all matching workflows with breadcrumb path | `WorkflowSidebar.tsx` | ✅ |
| 3.4 | Replace native `<select>` with custom searchable dropdown | `WorkflowPicker.tsx` | ✅ |
| 3.5 | Add search input with instant filter inside dropdown | `WorkflowPicker.tsx` | ✅ |
| 3.6 | Group workflows by folder breadcrumb path in dropdown sections | `WorkflowPicker.tsx` | ✅ |
| 3.7 | Highlight matching text in search results (both sidebar and runner) | `WorkflowSidebar.tsx`, `WorkflowPicker.tsx` | ✅ |
| 3.8 | Pass `folders` prop through `WorkflowRunner` → `WorkflowPicker` → `App.tsx` | `WorkflowRunner.tsx`, `App.tsx` | ✅ |
| 3.9 | Update existing unit tests for new custom dropdown (84 tests pass) | `WorkflowPicker.test.tsx`, `WorkflowRunner.test.tsx` | ✅ |
| 3.10 | CSS for sidebar search, search results, and runner dropdown | `workflow.css`, `base.css` | ✅ |

**Success criteria:** Both sidebar and runner dropdown support instant search. Sidebar search flattens tree and highlights matches. Runner dropdown shows flat list with "Folder / Sub-Folder" breadcrumb section headers.

### Phase 4: Tests + Polish (~2-3 hours) ✅ COMPLETE

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Unit tests for `workflowFolderTree` utils — expanded to 100% stmt/func/line, 94% branch | `workflowFolderTree.test.ts` | ✅ |
| 4.2 | Unit tests for `useWorkflowFolders` hook — 98% stmt, 100% func/line | `useWorkflowFolders.test.ts` | ✅ |
| 4.3 | Unit tests for `WorkflowSidebar` — 20 tests: folder tree, search, collapse, context menu, drag attrs | `WorkflowSidebar.test.tsx` | ✅ |
| 4.4 | Unit tests for `WorkflowPicker` — 10 new tests: custom dropdown, search, groups, highlights | `WorkflowPicker.test.tsx` | ✅ |
| 4.5 | Fix all linting / TypeScript issues — 0 errors | various | ✅ |
| 4.6 | E2E tests: 16 tests — folder CRUD, search, collapse, sub-folder, runner dropdown groups/search | `e2e/workflow-folders.spec.ts` | ✅ |
| 4.7 | Verify no regressions — updated 5 E2E files using old `<select>` API to custom dropdown | `e2e/workflow-picker.spec.ts`, `e2e/workflow-runner-coverage.spec.ts`, + 5 others | ✅ |

**Success criteria:** ✅ All existing tests pass. New features have >90% coverage. Zero TypeScript/ESLint errors. E2E tests cover folder creation, nesting, search, rename, delete, sub-folder creation, and custom dropdown behavior in both sidebar and runner.

---

## Total Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Data Model + Storage + Tree Utils + Drag Utils | 3-4 hours ✅ |
| Phase 2A: Folder Tree Rendering | 2 hours |
| Phase 2B: Folder CRUD + Context Menu | 1.5 hours |
| Phase 2C: Drag-and-Drop | 2.5 hours |
| Phase 3: Search / Filter | 2-3 hours ✅ |
| Phase 4: Tests + Polish | 2-3 hours ✅ |
| **Total** | **13-17 hours** |

---

## UI Mockup (Text-Based)

### Designer Sidebar (After)
```
┌──────────────────────────────────┐
│ WORKFLOWS                   + New│
│ 🔍 Search workflows...           │
├──────────────────────────────────┤
│ ▼ 📁 Performance Tests       (7) │
│   ▼ 📁 Load Tests            (2) │
│     · Peak Load Workflow       8 │
│     · Sustained Load           5 │
│   ▼ 📁 Stress Tests          (2) │
│     · CPU Stress Workflow      3 │
│     · Memory Stress            7 │
│   · Perf: Fork/Join           6 │
│   · Perf: Branching           5 │
│   · Perf: Edge Traversal      6 │
│ ▼ 📁 Integration             (5) │
│   ▼ 📁 Payment               (3) │
│     ▶ 📁 Stripe              (1) │
│     ▶ 📁 PayPal              (1) │
│     · Payment Callback         9 │
│   ▼ 📁 User Management       (1) │
│     · Registration → Login     8 │
│   · Polling Condition          9 │
│ ▼ 📁 Orchestration           (3) │
│   ⚡ Sub-Workflow Orch         9 │
│   · Manager Approval          11 │
│   · Parallel API Calls         7 │
│ ─ Unfiled ───────────────────── │
│   · Test Workflow              9 │
│   · Test2 Workflow             2 │
└──────────────────────────────────┘
```

### Designer Sidebar — Search Active
```
┌──────────────────────────────────┐
│ WORKFLOWS                   + New│
│ 🔍 "stripe"              ✕ Clear │
├──────────────────────────────────┤
│ Integration / Payment / Stripe    │
│   · [Stripe] Checkout Flow     4 │
│ Integration / Payment             │
│   · [Stripe] Callback Test     6 │
└──────────────────────────────────┘
```

### Runner Dropdown (After)
```
┌──────────────────────────────────────┐
│ 🔍 Search...                         │
│ ── Performance Tests / Load Tests ── │
│   Peak Load Workflow                  │
│   Sustained Load Workflow             │
│ ── Performance Tests / Stress Tests ──│
│   CPU Stress Workflow                 │
│   Memory Stress Workflow              │
│ ── Performance Tests ──────────────  │
│   Perf: Fork/Join                     │
│   Perf: Branching                     │
│   Perf: Edge Traversal               │
│ ── Integration / Payment / Stripe ── │
│   Stripe Checkout Flow                │
│ ── Integration / Payment / PayPal ── │
│   PayPal Express Flow                 │
│ ── Integration / User Management ──  │
│   Registration → Login                │
│ ── Orchestration ──────────────────  │
│   Sub-Workflow Orchestrator           │
│   Manager Approval                    │
│ ── Unfiled ────────────────────────  │
│   Test Workflow                       │
└──────────────────────────────────────┘
```

### Context Menu — Folder Actions
```
┌──────────────────────────┐
│ ✏️ Rename Folder          │
│ 📁 New Sub-Folder         │
│ ▶️ Run All in Folder      │
│ ── Move To ────────────  │
│   📁 Performance Tests    │
│   📁 Integration          │
│   📁 Orchestration        │
│   (root)                  │
│ ─────────────────────── │
│ 🗑️ Delete Folder          │
└──────────────────────────┘
```

---

## Edge Cases

### Folder Deletion
- **Folder with workflows:** Prompt user — "Move workflows to parent folder" or "Delete workflows too"
- **Folder with sub-folders:** Recursive prompt — moves all nested content to parent, or deletes everything
- **Default behavior:** Move contents to parent folder (safe)

### Depth Limit (UX Guard)
- No hard limit in the data model, but the UI should warn at **5+ levels deep** with a toast: "Consider simplifying your folder structure."
- Indentation caps visually at 5 levels (deeper levels share the same indent).

### Circular References
- `parentId` cannot reference itself or any descendant — validated in `useWorkflowFolders` hook and `isDescendant` utility.

### Runner Breadcrumb Truncation
- If the full path exceeds 60 characters, truncate middle segments: `Performance Tests / ... / Deep Folder`

### Drag-and-Drop Edge Cases
- **Self-drop** — Dropping a folder onto itself is a no-op (silently ignored).
- **Descendant-drop** — Dropping a folder onto any of its own descendants is blocked (`isDescendant` check). Visual feedback: drop target shows "not-allowed" cursor.
- **Drag during search** — Drag-and-drop is **disabled** while search is active (filtered/flattened view). The user must clear the search first to reorganize.
- **Empty folder drop** — Dropping a workflow onto an empty collapsed folder expands it and places the workflow inside.
- **Last item in folder** — Dragging the last workflow out of a folder leaves an empty folder (not auto-deleted). Users can delete empty folders via context menu.
- **Cross-browser** — HTML5 drag events behave differently across browsers. If native DnD proves inconsistent, fall back to `@dnd-kit/core` for cross-browser reliability and touch support.
- **Touch devices** — Native HTML5 drag doesn't work on touch. If Tauri targets touch devices, `@dnd-kit` with touch sensor is required.
- **Large trees (100+ items)** — Sidebar should virtualize the list (e.g., `react-window`) if performance degrades with many items. Deferred until needed.

---

## Migration

No migration needed — `folderId` is optional and `parentId` is optional. Existing workflows have no `folderId` and appear in the "Unfiled" section. Workflow folders are a new empty array on first load.

---

## Shared Components

| Component | Used By |
|-----------|---------|
| `WorkflowFolder` type | `WorkflowSidebar`, `WorkflowPicker`, `useWorkflowFolders` |
| `useWorkflowFolders` hook | `WorkflowDesigner`, `WorkflowRunner` |
| `workflowFolderTree` utils | `WorkflowSidebar`, `WorkflowPicker`, `useWorkflowFolders` |
| Search filter logic | `WorkflowSidebar`, `WorkflowPicker` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-09 | Initial plan created |
| 2026-05-09 | Updated: unlimited sub-folder nesting, design-time vs runtime strategy, tree utils, edge cases, "Run all in folder" feature |
| 2026-05-09 | Updated: universal drag-and-drop as first-class requirement — every folder/sub-folder/workflow freely draggable; added DnD section, drop zone visuals, auto-expand, edge scroll, drag constraints, DnD edge cases, `isDescendant`/`moveFolder`/`moveWorkflow` utils, `folderOrder` field |
| 2026-05-09 | Updated: Phase 2 split into sub-phases (2A: Tree Rendering, 2B: CRUD + Context Menu, 2C: Drag-and-Drop); Phase 1 marked complete |
| 2026-05-09 | Sub-phase 2A complete: recursive folder tree rendering, collapse/expand, badges, CSS. Sub-phase 2B complete: folder/workflow context menus, inline rename, folder CRUD, "Move to Folder" sub-menu, "Run all in folder", "New Folder" in header dropdown |
| 2026-05-09 | Sub-phase 2C complete: full drag-and-drop — every folder/sub-folder/workflow draggable with HTML5 DnD API; drop zone detection (above/inside/below); auto-expand on 500ms hover; edge scroll; circular drop prevention; visual indicators (grab cursor, opacity, drop lines, folder highlight); "Drop here for Unfiled" zone |
| 2026-05-10 | Phase 3 complete: search/filter in both sidebar and runner. Sidebar: search input, case-insensitive filter, flattened tree with breadcrumb paths, highlighted matches. Runner: native `<select>` replaced with custom searchable dropdown; workflows grouped by folder breadcrumb path; instant search with highlight. `folders` prop threaded through WorkflowRunner → WorkflowPicker → App.tsx. All 84 existing tests updated and passing. |
| 2026-05-10 | Phase 4 complete: full test coverage. Tree utils: 100% stmt/func/line, 94% branch (42 tests). Hook: 98% stmt, 100% func/line (10 tests). New WorkflowSidebar.test.tsx (20 tests): folder tree rendering, search filtering, breadcrumbs, collapse, context menus, drag attrs. WorkflowPicker expanded +10 tests: custom dropdown open/close, search filter, no-match, groups, highlights. 16 E2E tests in workflow-folders.spec.ts: folder CRUD, search, sub-folders, runner dropdown. Updated 5 existing E2E files from native `<select>` to custom dropdown pattern. All tests green, 0 TS/lint errors. |
| 2026-05-10 | Multi-select drag-and-drop: Ctrl/Cmd+click toggles individual workflow selection, Shift+click range-selects. Multi-selected workflows can be dragged together (badge shows count), moved to folders via context menu (bulk "Move N workflows to Folder"), or bulk-deleted. New `onMoveWorkflowsToFolder` batch callback. Visual: checkbox indicators appear during multi-select, highlighted background on selected items, drag count badge. 6 new unit tests + 7 E2E tests (`e2e/workflow-multi-select.spec.ts`). |
| 2026-05-10 | Gallery import folder picker: "Use as Template" now shows a `FolderPickerModal` allowing users to choose the destination folder (instead of always going to Unfiled). Navigable tree with expand/collapse for nested folders. Companion workflows are also placed in the chosen folder. "✓ Loaded" badge added to `TemplateGalleryContent` / `SampleCard` for already-imported samples. 12 new unit tests for `FolderPickerModal`. Gallery tab already had loaded badge detection via `useGalleryImport` + `gallerySampleId` matching — verified working. |
