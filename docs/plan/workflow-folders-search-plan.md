# Workflow Folders & Search — Implementation Plan

**Status:** Planning  
**Branch:** `feature/workflow-folders-search`  
**Created:** 2026-05-09  

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

## Solution: Workflow Folders + Search

A lightweight **folder** concept for Workflows, plus **instant search** in both the sidebar and runner dropdown.

### Target Hierarchy
```
WorkflowFolder (collapsible)
  └── Workflow
  └── Workflow
WorkflowFolder
  └── Workflow
(unfiled workflows — shown at the bottom)
```

### Design Principles
1. **One level only** — No nested folders. Keeps it simple and avoids the complexity of deep trees.
2. **Optional** — Workflows without a folder appear in an "Unfiled" section at the bottom.
3. **Consistent UX** — Reuse the same collapsible section pattern as Collection Groups in Requests.
4. **Non-breaking** — Existing workflows with no `folderId` work unchanged.
5. **Search everywhere** — Both sidebar and runner dropdown get instant filter-as-you-type.

---

## Data Model Changes

### New Type: `WorkflowFolder`

```typescript
// In src/features/workflow/types/workflow.ts
export interface WorkflowFolder {
  id: string;
  name: string;
  order: number;        // for manual sorting
  collapsed?: boolean;  // UI state: folder collapsed in sidebar
}
```

### Workflow Extension

```typescript
// Add to existing Workflow interface
export interface Workflow {
  // ... existing fields ...
  folderId?: string;    // NEW — reference to WorkflowFolder.id
}
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

### Phase 1: Data Model + Storage (~1-2 hours)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1.1 | Add `WorkflowFolder` interface | `src/features/workflow/types/workflow.ts` | 15min |
| 1.2 | Add `folderId?: string` to `Workflow` | `src/features/workflow/types/workflow.ts` | 5min |
| 1.3 | Add `loadWorkflowFolders` / `saveWorkflowFolders` | `src/shared/utils/storage.ts` | 20min |
| 1.4 | Add folder CRUD hook: `useWorkflowFolders` | `src/features/workflow/hooks/useWorkflowFolders.ts` | 30min |
| 1.5 | Unit tests for folder CRUD + storage | `*.test.ts` | 30min |

**Success criteria:** Folders can be created, renamed, reordered, and deleted. Workflows can be assigned to folders. All persisted.

### Phase 2: Sidebar Folders UI (~3-4 hours)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 2.1 | Add folder state to `WorkflowDesigner` (parent) | `src/features/workflow/WorkflowDesigner.tsx` | 30min |
| 2.2 | Render grouped sidebar: folders → workflows + unfiled section | `WorkflowSidebar.tsx` | 60min |
| 2.3 | Folder CRUD UI: create, rename, delete (inline + context menu) | `WorkflowSidebar.tsx` | 45min |
| 2.4 | Move workflow to folder (context menu → sub-menu or modal) | `WorkflowSidebar.tsx` | 30min |
| 2.5 | Drag-and-drop: reorder workflows within folder, drag to folder | `WorkflowSidebar.tsx` | 45min |
| 2.6 | Collapse/expand folders with persisted state | `WorkflowSidebar.tsx` | 15min |
| 2.7 | CSS for folder sections (expand/collapse, indent, badges) | `src/styles/workflow.css` | 30min |

**Success criteria:** Sidebar shows folders with collapsible sections. Users can create folders, move workflows into them, and reorder via drag-and-drop.

### Phase 3: Search / Filter (~2-3 hours)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 3.1 | Add search input to `WorkflowSidebar` header | `WorkflowSidebar.tsx` | 30min |
| 3.2 | Filter workflows by name (case-insensitive, highlight matches) | `WorkflowSidebar.tsx` | 30min |
| 3.3 | When searching, flatten folders — show all matching workflows | `WorkflowSidebar.tsx` | 15min |
| 3.4 | Add search input to `WorkflowPicker` dropdown (runner) | `WorkflowPicker.tsx` | 30min |
| 3.5 | Group workflows by folder in `WorkflowPicker` dropdown (`<optgroup>`) | `WorkflowPicker.tsx` | 30min |
| 3.6 | Replace `<select>` with custom searchable dropdown in runner | `WorkflowPicker.tsx` | 45min |

**Success criteria:** Both sidebar and runner dropdown support instant search. Runner dropdown groups workflows by folder using `<optgroup>` or a custom dropdown.

### Phase 4: Tests + Polish (~1-2 hours)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 4.1 | Unit tests for `useWorkflowFolders` hook | `useWorkflowFolders.test.ts` | 30min |
| 4.2 | Unit tests for updated `WorkflowSidebar` | `WorkflowSidebar.test.tsx` | 30min |
| 4.3 | Unit tests for updated `WorkflowPicker` | `WorkflowPicker.test.tsx` | 20min |
| 4.4 | Fix any linting / TypeScript issues | various | 15min |
| 4.5 | Verify no regressions in existing workflow E2E tests | `e2e/*.spec.ts` | 15min |

**Success criteria:** All existing tests pass. New features have >90% coverage. Zero TypeScript/ESLint errors.

---

## Total Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Data Model + Storage | 1-2 hours |
| Phase 2: Sidebar Folders UI | 3-4 hours |
| Phase 3: Search / Filter | 2-3 hours |
| Phase 4: Tests + Polish | 1-2 hours |
| **Total** | **7-11 hours** |

---

## UI Mockup (Text-Based)

### Designer Sidebar (After)
```
┌─────────────────────────────┐
│ WORKFLOWS              + New│
│ 🔍 Search workflows...      │
├─────────────────────────────┤
│ ▼ Performance Tests     (5) │
│   · Perf: Fork/Join       8 │
│   · Perf: Branching       5 │
│   · Perf: POST → GET     3 │
│   · Perf: Bottleneck      7 │
│   · Perf: Edge Traversal  6 │
│ ▼ Integration             (4) │
│   · Create → Extract      6 │
│   · Payment Gateway       5 │
│   · Polling Condition     9 │
│   · Schedule Trigger      8 │
│ ▼ Orchestration           (3) │
│   ⚡ Sub-Workflow Orch     9 │
│   · Manager Approval     11 │
│   · Parallel API Calls    7 │
│ ─ Unfiled ─────────────── │
│   · Test Workflow          9 │
│   · Test2 Workflow         2 │
└─────────────────────────────┘
```

### Runner Dropdown (After)
```
┌─────────────────────────────┐
│ 🔍 Search...                │
│ ── Performance Tests ────── │
│   Perf: Fork/Join           │
│   Perf: Branching           │
│ ── Integration ──────────── │
│   Create → Extract → Verify │
│   Payment Gateway Callback  │
│ ── Orchestration ─────────  │
│   Sub-Workflow Orchestrator  │
│ ── Unfiled ──────────────── │
│   Test Workflow              │
└─────────────────────────────┘
```

---

## Migration

No migration needed — `folderId` is optional. Existing workflows have no `folderId` and appear in the "Unfiled" section. Workflow folders are a new empty array on first load.

---

## Shared Components

| Component | Used By |
|-----------|---------|
| `WorkflowFolder` type | `WorkflowSidebar`, `WorkflowPicker`, `useWorkflowFolders` |
| `useWorkflowFolders` hook | `WorkflowDesigner`, `WorkflowRunner` |
| Search filter logic | `WorkflowSidebar`, `WorkflowPicker` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-09 | Initial plan created |
