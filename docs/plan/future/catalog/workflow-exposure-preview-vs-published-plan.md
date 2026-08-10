# Catalog — Workflow Exposure: Preview vs Published

> **Status:** Planned  
> **Feature area:** API Catalog → Workflow Designer integration  
> **Created:** 2026-07-24  
> **Goal:** Separate "Preview" (user-local sandbox) from "Published" (shared team contract) exposure modes with distinct storage, lifecycle, governance, and management UX.

---

## Phase Status Tracker

| Phase | Title | Status | Notes |
|---|---|---|---|
| P0 | Foundation already shipped | ✅ Done | Three-state dropdown (Not Exposed / Preview / Published), `workflowExposure` field on `CatalogEndpoint`, `catalogRef` on workflow nodes, `UnpublishConfirmDialog`, `workflowExposureScanner` |
| P1 | Move Preview to user-local storage | ✅ Done | Decouple Preview from shared `CatalogEndpoint`; store in user-scoped `workflowPreviews` map |
| P2 | Publish governance & metadata | ✅ Done | Confirmation modal for Publish, richer `WorkflowPublication` metadata, version tracking |
| P3 | Published Endpoints management panel | ✅ Done | Flat table of all published endpoints, bulk actions, stale version detection |
| P4 | Palette visual separation | ✅ Done | Split palette "Catalog" tab into Published / Preview sections with distinct badges |
| P5 | Spec version drift & update | ✅ Done | Stale badge, "Republish" action (diff preview deferred) |
| P6 | Multi-user / shared repository readiness | ✅ Done | Published = shared across all users; Preview = user-only; access control hooks + audit trail |

---

## 1. Executive Summary

The current implementation treats **Preview** and **Published** almost identically — both write `workflowExposure` on the shared `CatalogEndpoint` and show up in the Workflow Palette for everyone. The only difference today is visual (◇ vs 📌 badge) and the unpublish confirmation dialog.

This plan separates them into two fundamentally different mechanisms:

| Dimension | Preview | Published |
|---|---|---|
| **Who sees it** | Only the user who set it | Everyone (all users sharing the repo) |
| **Where stored** | User-local storage (not on `CatalogEndpoint`) | On `CatalogEndpoint` (shared data) |
| **Lifetime** | Temporary — session or until user clears | Permanent — until explicit un-publish |
| **Set UX** | Quick toggle (no confirmation) | Promote action with confirmation modal |
| **Node behavior** | Nodes marked as preview-origin (soft link) | Nodes have `catalogRef` contract link |
| **Version tracking** | None | `publishedFromVersionId` + stale detection |
| **Multi-user future** | Private sandbox per user | Team contract visible to all |

---

## 2. Current State (P0 — Already Shipped)

### Data model

```typescript
// src/features/catalog/types/catalog.ts
interface CatalogEndpoint {
  // ...
  /** @deprecated Use workflowExposure instead */
  exposedToWorkflow?: boolean;
  workflowExposure?: 'preview' | 'published';
  workflowValues?: CatalogEndpointWorkflowValues;
}

// src/features/workflow/types/workflow/node-core.ts
interface HttpNodeData {
  // ...
  catalogRef?: {
    entryId: string;
    endpointId: string;
    method: string;
    path: string;
  };
}
```

### Existing components

| File | Purpose |
|---|---|
| `CatalogEndpointCard.tsx` | `WorkflowExposureDropdown` (3 options: Not Exposed, Preview, Published) |
| `ApiCatalog.tsx` | `handleSetWorkflowExposure` — apply/downgrade logic |
| `workflowExposureScanner.ts` | `scanWorkflowsForCatalogRef`, `removeCatalogNodesFromWorkflows` |
| `UnpublishConfirmDialog.tsx` | Impact dialog for un-publishing (palette only vs palette + workflows) |
| `WorkflowPalette.tsx` | Filters catalog by `workflowExposure` or `exposedToWorkflow`, shows badges |
| `useWorkflowNodeActions.ts` | Populates `catalogRef` when adding HTTP node from catalog |

### What works today

1. Three-state dropdown on endpoint cards (inside "Try It Out" section)
2. Badge display in Workflow Palette (📌 for published, ◇ for preview)
3. `catalogRef` written to workflow nodes on add from palette
4. Workflow scanning for nodes referencing a catalog endpoint
5. Un-publish dialog with impact summary and remove-from-workflows option

### What doesn't differentiate yet

- Both Preview and Published stored on the same `CatalogEndpoint.workflowExposure` field → both visible to all users
- No confirmation step for Publishing (same instant-toggle UX as Preview)
- No version tracking for Published endpoints
- No management panel to see/audit all published endpoints at once
- No stale detection when spec version changes
- No separate palette sections

---

## 3. Phase 1 — Move Preview to User-Local Storage

### Goal

Make Preview truly user-scoped: only the user who sets Preview sees it in their palette. The `CatalogEndpoint` object should only contain `workflowExposure: 'published'` — never `'preview'`.

### 3.1 New storage model

```typescript
// src/shared/types/workflowPreview.ts (NEW)

export interface WorkflowPreviewEntry {
  entryId: string;
  endpointId: string;
  method: string;
  path: string;
  summary: string;
  entryName: string;
  addedAt: number;
  /** Captured param/header/body values at time of preview. */
  values?: {
    paramValues: Record<string, string>;
    headerValues: Record<string, string>;
    body?: string;
  };
}
```

**Storage key:** `perf-test-v3-workflow-previews`

```typescript
// src/shared/utils/workflowPreviewStorage.ts (NEW)

import { readKey, writeKey } from './storage';

const KEY = 'perf-test-v3-workflow-previews';

export type PreviewMap = Record<string, WorkflowPreviewEntry>;
// Key format: `${entryId}::${endpointId}`

export async function loadWorkflowPreviews(): Promise<PreviewMap>;
export async function saveWorkflowPreviews(map: PreviewMap): Promise<void>;
export async function addWorkflowPreview(entry: WorkflowPreviewEntry): Promise<void>;
export async function removeWorkflowPreview(entryId: string, endpointId: string): Promise<void>;
export async function clearAllPreviews(): Promise<void>;
```

### 3.2 Changes to existing code

| File | Change |
|---|---|
| `CatalogEndpoint` type | Keep type accepting `'preview' \| 'published' \| undefined` for back-compat but migration clears `'preview'` at runtime. Runtime logic treats `'preview'` from the entry as migrated → user-local |
| `ApiCatalog.tsx` | `handleSetWorkflowExposure`: Preview → writes to `workflowPreviewStorage` (user-local); Published → writes to `CatalogEndpoint`. Loads previews on mount, passes merged preview state down |
| `CatalogEndpointBrowser.tsx` | Receives `previewedEndpointIds: Set<string>` prop. Passes each card's merged mode via a new `currentExposureMode` prop |
| `CatalogEndpointCard.tsx` | New prop `currentExposureMode?: 'preview' \| 'published'` so the card doesn't need to read from storage. Dropdown displays this merged mode. `onChange` callback unchanged |
| `WorkflowPalette.tsx` | New prop `previewEndpoints: WorkflowPreviewEntry[]`. Renders preview entries as synthetic catalog items in the Catalog tab alongside Published entries from `catalogEntries` |
| `workflowExposureScanner.ts` | No change — only operates on Published (which have `catalogRef`) |
| `CatalogEndpointCard.test.tsx` | Update test to pass `currentExposureMode` and verify dropdown reflects it |
| `WorkflowPalette.test.tsx` | Add tests for preview endpoints rendered from the new prop |
| `ApiCatalog.test.tsx` | Update tests for preview routing to local storage |

### 3.3 Migration

On first load after upgrade:
1. Scan all `CatalogEndpoint` entries
2. Any with `workflowExposure: 'preview'` → migrate to `workflowPreviewStorage`
3. Clear `workflowExposure` on those endpoints
4. Endpoints with `exposedToWorkflow: true` (legacy) → migrate to Preview storage
5. Clear `exposedToWorkflow`

```typescript
// src/shared/utils/workflowPreviewMigration.ts (NEW)
export async function migratePreviewsToLocalStorage(
  entries: CatalogEntry[],
  updateEntry: (id: string, patch: Partial<CatalogEntry>) => void,
): Promise<number>;
```

### 3.4 Files to create/modify

| File | Action |
|---|---|
| `src/shared/utils/workflowPreviewStorage.ts` | **CREATE** — types + CRUD for user-local previews |
| `src/shared/utils/workflowPreviewMigration.ts` | **CREATE** — one-time migration |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — route Preview to local storage, load previews on mount, pass merged state down |
| `src/features/catalog/components/CatalogEndpointBrowser.tsx` | **MODIFY** — accept + forward `previewedEndpointIds` |
| `src/features/catalog/components/CatalogEndpointCard.tsx` | **MODIFY** — accept `currentExposureMode` prop, display merged mode |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | **MODIFY** — accept `previewEndpoints` prop, render alongside published |
| `src/app/hooks/useCatalogState.ts` or `App.tsx` | **MODIFY** — call migration on first load, hold preview state |

### 3.5 Test plan

- Unit: `workflowPreviewStorage` CRUD (add/remove/clear/load)
- Unit: `workflowPreviewMigration` — converts preview entries, clears legacy fields
- Unit: `WorkflowPalette` — renders both Published and Preview entries from separate sources
- Unit: `CatalogEndpointCard` — dropdown shows correct state for Preview (from local) and Published (from entry)
- Unit: `ApiCatalog` — setting Preview writes to local storage, not entry; setting Published writes to entry

---

## 4. Phase 2 — Publish Governance & Metadata

### Goal

Make Publishing a deliberate, governed action with confirmation, metadata, and version tracking.

### 4.1 Richer metadata on Published endpoints

```typescript
// Added to CatalogEndpoint or as a sub-object

export interface WorkflowPublication {
  /** When this endpoint was published. */
  publishedAt: number;
  /** The catalog version ID at time of publishing. */
  publishedFromVersionId: string;
  /** Captured parameter/header/body defaults for workflow nodes. */
  values?: CatalogEndpointWorkflowValues;
  /** Optional note from the publisher (e.g. "Approved for load testing"). */
  note?: string;
}
```

Replace `workflowExposure: 'published'` + `workflowValues` with a single field:

```typescript
interface CatalogEndpoint {
  // ...
  /** Publication metadata. Present = published; absent = not published. */
  workflowPublication?: WorkflowPublication;
}
```

### 4.2 Publish confirmation modal

When user selects "Publish" from the dropdown, show a confirmation modal:

```
┌──────────────────────────────────────────────────────┐
│ Publish Endpoint to Workflow Designer                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  POST /posts                                         │
│  API: JSONPlaceholder API                            │
│  Version: 1.0.0                                      │
│                                                      │
│  This makes the endpoint permanently available       │
│  in the Workflow Designer palette for all users.     │
│                                                      │
│  Note (optional):                                    │
│  ┌──────────────────────────────────────────────┐    │
│  │ Approved for load testing                    │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ☐ Include current parameter values as defaults      │
│                                                      │
├──────────────────────────────────────────────────────┤
│                        [Cancel]  [Publish Endpoint]  │
└──────────────────────────────────────────────────────┘
```

### 4.3 UX flow change

**Before (P0):**
```
Dropdown: Not Exposed → Published  (instant, no confirmation)
```

**After (P2):**
```
Dropdown: Not Exposed → Preview    (instant, writes to local storage)
Dropdown: Preview → Published      (opens Publish Confirmation modal)
Dropdown: Not Exposed → Published  (opens Publish Confirmation modal)
Dropdown: Published → Preview      (opens Unpublish dialog — existing)
Dropdown: Published → Not Exposed  (opens Unpublish dialog — existing)
Dropdown: Preview → Not Exposed    (instant, removes from local storage)
```

### 4.4 Files to create/modify

| File | Action |
|---|---|
| `src/features/catalog/types/catalog.ts` | **MODIFY** — add `WorkflowPublication` interface, add `workflowPublication?` field (keep `workflowExposure` + `workflowValues` for migration back-compat) |
| `src/features/catalog/components/PublishEndpointModal.tsx` | **CREATE** — confirmation modal with endpoint info, note, include-values checkbox |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — `handlePublish` writes `WorkflowPublication`, show publish modal, migrate reads from new field |
| `src/features/catalog/components/CatalogEndpointBrowser.tsx` | **MODIFY** — `resolveExposureMode` checks `workflowPublication` instead of `workflowExposure` |
| `src/features/catalog/components/CatalogEndpointCard.tsx` | **MODIFY** — no structural change needed (already reads `currentExposureMode` prop from P1) |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | **MODIFY** — filter published by `workflowPublication` presence instead of `workflowExposure` |
| `src/features/workflow/hooks/useWorkflowNodeActions.ts` | **MODIFY** — read `workflowPublication.values` instead of `workflowValues` when creating nodes from catalog |
| `src/features/catalog/utils/workflowExposureScanner.ts` | **NO CHANGE** — operates on `catalogRef` on nodes, not endpoint fields |
| `src/features/catalog/components/UnpublishConfirmDialog.tsx` | **MODIFY** — show publication metadata (published date, version, note) |
| `src/shared/utils/workflowPreviewMigration.ts` | **MODIFY** — add P2 migration converting `workflowExposure: 'published'` → `workflowPublication` |
| `src/app/App.tsx` | **MODIFY** — wire P2 migration on startup |

### 4.5 Migration

```typescript
// Migrate workflowExposure: 'published' + workflowValues → workflowPublication
{
  workflowPublication: {
    publishedAt: Date.now(), // best-effort for existing
    publishedFromVersionId: entry.currentVersionId,
    values: endpoint.workflowValues,
  }
}
```

### 4.6 Test plan

- Unit: `PublishEndpointModal` — renders fields, submit writes metadata, cancel aborts
- Unit: `ApiCatalog` — publish flow stores `WorkflowPublication`, unpublish clears it
- Unit: Migration — converts old `workflowExposure` + `workflowValues` to `WorkflowPublication`
- Unit: `WorkflowPalette` — reads from new field

---

## 5. Phase 3 — Published Endpoints Management Panel ✅ Done

### Goal

Provide a single view to audit, update, and manage all published endpoints across all catalog entries.

### 5.1 Entry point

Two access paths:
1. **Catalog sidebar** — new filter/view option: "Published to Workflow" (alongside All, Folders, Tags)
2. **Catalog Overview pane** — section or tab showing published endpoints for the selected entry

### 5.2 Management panel layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Published Endpoints                              [Search...] [Filter ▾] │
├──────────┬──────────────┬───────────────┬──────────┬──────────┬─────────┤
│ Method   │ Path         │ API           │ Version  │ Status   │ Actions │
├──────────┼──────────────┼───────────────┼──────────┼──────────┼─────────┤
│ POST     │ /posts       │ JSONPlace…    │ 1.0.0    │ ✅ Current│ ⋮       │
│ GET      │ /users/{id}  │ User API      │ 2.1.0    │ ⚠ Stale  │ ⋮       │
│ DELETE   │ /orders/{id} │ Orders API    │ 3.0.0    │ ✅ Current│ ⋮       │
└──────────┴──────────────┴───────────────┴──────────┴──────────┴─────────┘

Actions (⋮ menu per row):
  • Edit default values      — opens value editor for param/header/body defaults
  • Update to latest version — re-syncs values to current spec version
  • View in Catalog          — navigates to the endpoint card in full Catalog
  • View usage               — shows which workflows reference this endpoint
  • Unpublish                — triggers UnpublishConfirmDialog
```

### 5.3 Bulk actions

- **Unpublish selected** — multi-select checkbox + bulk unpublish
- **Update all stale** — one-click to refresh all endpoints whose `publishedFromVersionId !== currentVersionId`

### 5.4 Files to create/modify

| File | Action |
|---|---|
| `src/features/catalog/utils/publishedEndpointAggregator.ts` | **CREATE** — pure function to collect all published endpoints from all entries, detect stale, compute workflow usage |
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **CREATE** — main management panel with table, search, filter, per-row actions menu, bulk unpublish |
| `src/styles/catalog.css` | **MODIFY** — panel styles |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — add `'published'` to View type, add tab button, render panel, wire unpublish/navigate callbacks |

**Deferred to later phases:**
- "Edit default values" action — navigate to the endpoint's "Try It Out" section instead (same as "View in Catalog")
- "Update to latest version" action — depends on P5 (Spec Version Drift); stale badge is shown but update action deferred
- "Update all stale" bulk action — deferred to P5
- Sidebar filter view — deferred; the tab-based access is sufficient for now

### 5.5 Test plan

- Unit: `publishedEndpointAggregator` — scans entries, builds flat list, detects stale
- Unit: `PublishedEndpointsPanel` — renders table, search, filter, actions
- Unit: Bulk unpublish — multi-select + confirm dialog
- Unit: `usePublishedEndpoints` — hook returns correct data shape

---

## 6. Phase 4 — Palette Visual Separation

### Goal

Visually distinguish Published and Preview entries in the Workflow Palette's "Catalog" tab.

### 6.1 Palette structure

```
┌─────────────────────────────────┐
│ BLOCKS  REQUESTS  CATALOG       │
├─────────────────────────────────┤
│ ▸ PUBLISHED (3)                 │  ← Section header with count
│   📌 POST /posts                │
│   📌 GET /users/{id}            │
│   📌 DELETE /orders/{id}        │
│                                 │
│ ▸ PREVIEW (yours) (2)           │  ← Only visible to current user
│   ◇ GET /comments               │
│   ◇ PATCH /posts/{id}           │
└─────────────────────────────────┘
```

### 6.2 Changes

- **Always show both section headers** when at least one endpoint of either type exists. If both empty → show "no endpoints exposed" message.
- Each section header is **collapsible** (click to expand/collapse). Both start expanded.
- Published entries get 📌 badge and solid list style
- Preview entries get ◇ badge and dashed/muted list style  
- Empty section shows "(none published)" / "(no previews)" hint text
- When search is active, both sections are filtered but maintain grouping; collapsed sections auto-expand
- Section expand/collapse uses synthetic IDs (`__pub_section`, `__preview_section`) in the shared `expanded` Set

### 6.3 Files to modify

| File | Action |
|---|---|
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | **MODIFY** — always-visible collapsible Published + Preview sections |
| `src/styles/workflow.css` | **MODIFY** — section header toggle, empty-hint styling |
| `src/features/workflow/components/canvas/WorkflowPalette.test.tsx` | **MODIFY** — update section visibility expectations, add collapse tests |

### 6.4 Test plan

- Unit: Palette renders both section headers when both Published and Preview exist
- Unit: Palette renders both headers when only published exist (preview shows "no previews")
- Unit: Palette renders both headers when only preview exist (published shows "none published")
- Unit: Search filters within both sections
- Unit: Section collapse/expand toggles visibility
- Unit: Empty-hint text shown for empty sections

---

## 7. Phase 5 — Spec Version Drift & Update

### Goal

Detect when a published endpoint's spec has changed since publication and provide update/review tools.

### 7.1 Stale detection

```typescript
function isPublicationStale(
  endpoint: CatalogEndpoint,
  entry: CatalogEntry,
): boolean {
  if (!endpoint.workflowPublication) return false;
  return endpoint.workflowPublication.publishedFromVersionId !== entry.currentVersionId;
}
```

### 7.2 Stale badge

Show a ⚠ badge on:
- The endpoint card in Catalog (next to the Published badge)
- The management panel row
- The palette entry in Workflow Designer

### 7.3 "Republish at current version" action

When clicked:
1. Updates `workflowPublication.publishedFromVersionId` to `entry.currentVersionId`
2. Updates `workflowPublication.publishedAt` to `Date.now()`
3. Keeps existing values and note

**Deferred:** Diff preview modal (requires loading + re-parsing old spec snapshots). The "Republish" action is immediate. A future enhancement can add a diff preview before confirmation using `catalogSpecDiff.ts`.

### 7.4 Future: Review-and-approve mode (P6)

In a multi-user setup, stale endpoints could enter a **"Needs Review"** state:
- Published endpoints with stale specs get a yellow badge in the management panel
- Team lead reviews the diff and approves (updates version) or unpublishes

### 7.5 Files to create/modify

| File | Action |
|---|---|
| `src/features/catalog/utils/publicationDrift.ts` | **CREATE** — `isPublicationStale` pure function (extracted from aggregator pattern) |
| `src/features/catalog/components/CatalogEndpointCard.tsx` | **MODIFY** — accept `isPublicationStale` prop, show ⚠ Stale badge in header |
| `src/features/catalog/components/CatalogEndpointBrowser.tsx` | **MODIFY** — compute and pass `isPublicationStale` to each card |
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **MODIFY** — add "Republish" action in ⋮ menu for stale endpoints |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — wire `onRepublish` handler to update `workflowPublication` |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | **MODIFY** — show ⚠ stale indicator on published palette items |
| `src/features/catalog/utils/publishedEndpointAggregator.ts` | **MODIFY** — reuse `isPublicationStale` from `publicationDrift.ts` |

**Deferred:** `PublicationUpdateModal` (diff preview before republish) — simple republish is sufficient for now.

### 7.6 Test plan

- Unit: `publicationDrift.isPublicationStale` — correct for matching/non-matching versions, no publication, missing version
- Unit: `CatalogEndpointCard` — stale badge renders when `isPublicationStale` is true
- Unit: `PublishedEndpointsPanel` — "Republish" action visible for stale rows, calls `onRepublish`
- Unit: `WorkflowPalette` — stale indicator on published items with version mismatch

---

## 8. Phase 6 — Multi-User / Shared Repository Readiness

### Goal

When a shared/common repository is introduced, ensure Published and Preview have correct visibility and access control.

### 8.1 Key principle

> **Published = shared contract. Preview = personal sandbox.**

This means:
- Published endpoints are stored on the `CatalogEntry` (shared data) → all users see them in their palette
- Preview endpoints are stored in user-local storage → only the user who set them sees them
- This is already the model from P1 — P6 just ensures the hooks and APIs are ready for multi-user storage

### 8.2 Access control hooks

```typescript
interface PublishPermission {
  canPublish: boolean;
  canUnpublish: boolean;
  canRepublish: boolean;
  reason?: string; // e.g. "Only team admins can publish"
}

function usePublishPermission(entryId: string): PublishPermission;
```

Initially all return `true`. When role-based access is added:
- `canPublish` → gated by role (e.g. only admins/leads can publish)
- `canUnpublish` → gated by role
- `canRepublish` → gated by role
- Preview → always available (personal sandbox, no permission needed)

**Wiring into UI components:**
- `ApiCatalog.tsx` — pass permission to `CatalogEndpointBrowser`, `PublishedEndpointsPanel`
- `CatalogEndpointBrowser.tsx` → `CatalogEndpointCard.tsx` — gate the "Published" option in the exposure dropdown (disabled + tooltip when `canPublish` is false)
- `PublishedEndpointsPanel.tsx` — gate "Unpublish" and "Republish" menu actions (hidden when permission denied)
- `WorkflowExposureDropdown` (inside `CatalogEndpointCard.tsx`) — disable "Published" option when `canPublish` is false; disable downgrade from Published when `canUnpublish` is false

### 8.3 Audit trail

Structured audit events logged on publish/unpublish/republish actions. Initially writes to `console.debug` (no-op in production). When a shared backend is introduced, the logger swaps to a real API.

```typescript
type PublicationAuditAction = 'publish' | 'unpublish' | 'republish';

interface PublicationAuditEvent {
  action: PublicationAuditAction;
  entryId: string;
  endpointId: string;
  method: string;
  path: string;
  timestamp: number;
  versionId?: string;
  note?: string;
  affectedWorkflows?: number;
}

function logPublicationAudit(event: PublicationAuditEvent): void;
```

**Wiring into existing flows:**
- `handlePublishConfirm` in `ApiCatalog.tsx` — log `'publish'`
- `handleUnpublishPaletteOnly` / `handleUnpublishPaletteAndWorkflows` — log `'unpublish'`
- `handleRepublish` — log `'republish'`

### 8.4 Files to create/modify

| File | Action |
|---|---|
| `src/features/catalog/hooks/usePublishPermission.ts` | **CREATE** — permission hook (returns all-true initially), exported types |
| `src/features/catalog/utils/publicationAudit.ts` | **CREATE** — typed audit event logger (`console.debug` in dev, no-op in prod) |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — use `usePublishPermission`, wire permissions to children, call `logPublicationAudit` in publish/unpublish/republish flows |
| `src/features/catalog/components/CatalogEndpointBrowser.tsx` | **MODIFY** — accept + forward `publishPermission` prop |
| `src/features/catalog/components/CatalogEndpointCard.tsx` | **MODIFY** — accept `publishPermission` prop, gate dropdown options |
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **MODIFY** — accept `publishPermission` prop, gate ⋮ menu actions |

### 8.5 Test plan

- Unit: `usePublishPermission` — returns all-true for any entryId
- Unit: `logPublicationAudit` — calls `console.debug` in dev mode, no-op otherwise
- Unit: `CatalogEndpointCard` — "Published" dropdown option disabled when `canPublish` is false
- Unit: `PublishedEndpointsPanel` — "Unpublish" hidden when `canUnpublish` is false, "Republish" hidden when `canRepublish` is false

---

## 9. How to Remove or Update Already Published Endpoints

This section directly answers the question: **"How do we remove or update an already Published one? Where and how?"**

### 9.1 Where to remove

Published endpoints can be removed (un-published) from **three places**:

| Location | How | UX |
|---|---|---|
| **Endpoint card** (Catalog → endpoint → "Try It Out") | Change dropdown from "Published" to "Not Exposed" or "Preview" | Opens `UnpublishConfirmDialog` showing affected workflows |
| **Management panel** (Catalog → "Published to Workflow" view) | Click row "⋮" → "Unpublish" | Opens same `UnpublishConfirmDialog` |
| **Management panel bulk** | Select multiple checkboxes → "Unpublish selected" | Opens batch version of `UnpublishConfirmDialog` |

### 9.2 Un-publish dialog behavior

The existing `UnpublishConfirmDialog` already handles this well:

1. **Scan** workflows for nodes with matching `catalogRef` (via `scanWorkflowsForCatalogRef`)
2. **Show impact summary**: "3 workflows use this endpoint (5 nodes total)"
3. **Two choices**:
   - **Remove from Palette Only** — clears `workflowPublication`, existing workflow nodes keep working but lose their catalog link (become standalone HTTP nodes)
   - **Remove from Palette & Workflows** — clears `workflowPublication` AND removes all nodes with matching `catalogRef` from all workflows

### 9.3 Where to update

Published endpoint values (defaults) can be updated from **two places**:

| Location | How | What it updates |
|---|---|---|
| **Endpoint card** | Edit param/header/body values in "Try It Out" → click "Update Published Values" button (new) | `workflowPublication.values` |
| **Management panel** | Click row "⋮" → "Edit default values" | Opens value editor, saves to `workflowPublication.values` |

### 9.4 Version update (when spec changes)

| Location | How | What it updates |
|---|---|---|
| **Endpoint card** | ⚠ Stale badge → click "Update to latest" | Opens diff preview modal, confirms → updates `publishedFromVersionId` |
| **Management panel** | ⚠ Stale column → click "Update" per row | Same modal |
| **Management panel bulk** | "Update all stale" button | Batch update with summary |

### 9.5 Summary flow chart

```
User wants to remove Published endpoint
    │
    ├── From Endpoint Card
    │     └── Dropdown → "Not Exposed"
    │           └── UnpublishConfirmDialog
    │                 ├── Palette Only → clear workflowPublication
    │                 └── Palette & Workflows → clear + remove nodes
    │
    └── From Management Panel
          ├── Single row → ⋮ → Unpublish → same dialog
          └── Multi-select → Unpublish Selected → batch dialog

User wants to update Published endpoint
    │
    ├── Update values (param/header/body defaults)
    │     ├── Endpoint Card → edit + "Update Published Values"
    │     └── Management Panel → ⋮ → Edit default values
    │
    └── Update to latest spec version
          ├── Endpoint Card → ⚠ badge → Update to latest
          └── Management Panel → ⚠ column → Update / Update all stale
```

---

## 10. Implementation Order & Dependencies

```
P1 (Preview to local storage)
 │
 ├── P2 (Publish governance & metadata)
 │    │
 │    ├── P3 (Management panel)
 │    │    │
 │    │    └── P5 (Version drift & update)
 │    │
 │    └── P4 (Palette visual separation)
 │
 └── P6 (Multi-user readiness) ← future, after shared repo exists
```

**P1 is the critical foundation.** Once Preview is user-local, everything else builds cleanly on top.

P2 and P4 can be done in parallel after P1. P3 depends on P2 (needs `WorkflowPublication` metadata). P5 depends on P3 (stale detection shown in management panel).

### Estimated effort

| Phase | Effort | Risk |
|---|---|---|
| P1 | 2–3 days | Medium — migration + dual-source palette |
| P2 | 1–2 days | Low — modal + metadata |
| P3 | 2–3 days | Medium — new panel component |
| P4 | 0.5–1 day | Low — palette sectioning |
| P5 | 1–2 days | Low — reuses existing `catalogSpecDiff` |
| P6 | TBD | Depends on shared repo architecture |

---

## 11. Migration Strategy (Across All Phases)

### P0 → P1 migration

```
CatalogEndpoint.workflowExposure === 'preview'
  → move to workflowPreviewStorage (user-local)
  → clear workflowExposure

CatalogEndpoint.exposedToWorkflow === true (legacy)
  → move to workflowPreviewStorage (user-local)
  → clear exposedToWorkflow
```

### P1 → P2 migration

```
CatalogEndpoint.workflowExposure === 'published'
  → convert to workflowPublication: {
      publishedAt: Date.now(),
      publishedFromVersionId: entry.currentVersionId,
      values: endpoint.workflowValues
    }
  → clear workflowExposure
  → clear workflowValues
```

### Migration guard

Both migrations are idempotent and run on app startup. A version flag in storage tracks which migrations have completed:

```typescript
const MIGRATION_KEY = 'perf-test-v3-workflow-exposure-migration';
// { v1: boolean, v2: boolean }
```

---

## 12. Open Questions

1. **Preview expiration** — Should previews auto-expire after N days of inactivity? Or persist until manually cleared?
   - Recommendation: No auto-expiry in P1. Add optional TTL in a later phase if needed.

2. **Preview-to-Published values carry-over** — When promoting from Preview to Published, should the current Preview values pre-fill the Publish confirmation modal?
   - Recommendation: Yes — reduces friction. User can modify before confirming.

3. **Batch publish** — Should there be a "Publish all previewed" action?
   - Recommendation: Defer to P3 (management panel can show Previews with a "Promote" action).

4. **Notification on Published change** — In multi-user, should other users be notified when someone publishes/unpublishes?
   - Recommendation: Defer to P6 (depends on notification infrastructure).

5. **Published endpoint removal from workflow nodes** — When "Remove from Palette Only" is chosen, should the orphaned nodes show a warning badge in the Workflow Designer?
   - Recommendation: Yes (low effort, high value). Add a "⚠ Source unpublished" badge to nodes whose `catalogRef` no longer resolves to a published endpoint.
